/**
 * Curation state for the job report.
 *
 * The report is a static file: it can show a posting but it cannot remember
 * that you removed one. This is the only writable thing in the deployment and
 * it holds exactly one map — posting key -> "applied" | "dismissed" — until
 * `scour.py sync` takes it into the database and clears it. So the map stays
 * small: it only ever holds removals made since the last run.
 *
 * Deliberately dependency-free. site/ has no package.json and no build step,
 * and pulling in an SDK to store a hash of sixteen-character keys would cost
 * that for nothing. CommonJS on purpose too — without a package.json declaring
 * otherwise, .js here is CommonJS.
 */

const FIELD = 'jobscour:marks';
const STATES = ['applied', 'dismissed'];
const KEY_RE = /^[A-Za-z0-9_-]{1,64}$/;
const MAX_MARKS = 500;

// Either naming works: Vercel's own KV integration sets the first pair, a
// direct Upstash connection sets the second.
const env = (...names) => names.map(n => process.env[n]).find(Boolean) || '';

async function redis(...command) {
  const url = env('KV_REST_API_URL', 'UPSTASH_REDIS_REST_URL');
  const token = env('KV_REST_API_TOKEN', 'UPSTASH_REDIS_REST_TOKEN');
  if (!url || !token) throw fail(503, 'No store is connected to this deployment.');

  const r = await fetch(url, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(command),
  });
  const body = await r.json().catch(() => ({}));
  if (!r.ok || body.error) throw fail(502, body.error || `store returned ${r.status}`);
  return body.result;
}

function fail(status, message) {
  const e = new Error(message);
  e.status = status;
  return e;
}

// HGETALL answers with a flat [field, value, field, value] array.
function pairs(flat) {
  const out = {};
  for (let i = 0; i + 1 < (flat || []).length; i += 2) out[flat[i]] = flat[i + 1];
  return out;
}

/**
 * One shared password, sent as a bearer token by both the webpage and the CLI.
 * Unset means unconfigured, and unconfigured fails closed — an open write
 * endpoint on a public URL is worse than a broken one.
 */
function authorised(req) {
  const want = process.env.MARK_TOKEN || '';
  if (!want) return false;
  const got = String(req.headers.authorization || '').replace(/^Bearer\s+/i, '');
  if (got.length !== want.length) return false;
  let diff = 0;
  for (let i = 0; i < want.length; i++) diff |= got.charCodeAt(i) ^ want.charCodeAt(i);
  return diff === 0;
}

module.exports = async (req, res) => {
  res.setHeader('Cache-Control', 'no-store');
  // The same report is also read from disk as job_report.html, whose origin is
  // "null". The token travels in a header and never in a cookie, so opening
  // CORS costs nothing and keeps the local copy working.
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Headers', 'Authorization, Content-Type');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  if (req.method === 'OPTIONS') return res.status(204).end();

  if (!process.env.MARK_TOKEN)
    return res.status(503).json({ error: 'MARK_TOKEN is not set on this deployment.' });
  if (!authorised(req))
    return res.status(401).json({ error: 'Wrong or missing password.' });

  try {
    if (req.method === 'GET')
      return res.status(200).json({ marks: pairs(await redis('HGETALL', FIELD)) });

    if (req.method !== 'POST')
      return res.status(405).json({ error: `${req.method} is not allowed here.` });

    const body = typeof req.body === 'string'
      ? JSON.parse(req.body || '{}')
      : (req.body || {});
    const marks = body.marks;
    if (!marks || typeof marks !== 'object' || Array.isArray(marks))
      return res.status(400).json({
        error: 'Send {"marks": {"<posting key>": "applied" | "dismissed" | "open"}}',
      });

    const entries = Object.entries(marks);
    if (entries.length > MAX_MARKS)
      return res.status(413).json({ error: `At most ${MAX_MARKS} marks per request.` });

    // Validated in full before anything is written, so a bad key in a batch
    // cannot leave half of it applied.
    const set = [], del = [];
    for (const [k, v] of entries) {
      if (!KEY_RE.test(k))
        return res.status(400).json({ error: `Not a posting key: ${String(k).slice(0, 24)}` });
      if (v === 'open') del.push(k);
      else if (STATES.includes(v)) set.push(k, v);
      else return res.status(400).json({ error: `Not a state: ${String(v).slice(0, 24)}` });
    }

    if (set.length) await redis('HSET', FIELD, ...set);
    if (del.length) await redis('HDEL', FIELD, ...del);

    // Answer with the whole map so the caller reconciles in one round trip
    // rather than guessing that its write landed.
    return res.status(200).json({ marks: pairs(await redis('HGETALL', FIELD)) });
  } catch (e) {
    return res.status(e.status || 500).json({ error: e.message || 'Unexpected failure.' });
  }
};
