# Job search report

A single self-contained page listing English-only job postings in Hungary,
filtered and scored. Deployed from this repository by Vercel.

`index.html` is generated output — it is overwritten wholesale on every publish,
so edits made here are lost on the next run. The generator lives in a separate
private project, which is where any change belongs.

`api/marks.js` is not generated and is edited here. It is the one writable thing
in the deployment: the page cannot remember that you removed a posting, so it
records that here instead.

## The marks endpoint

`GET /api/marks` returns `{"marks": {"<posting key>": "applied" | "dismissed"}}`.
`POST` the same shape to change it, with `"open"` to clear an entry; either way
the whole map comes back, so a caller reconciles in one round trip.

It needs two things set on the Vercel project, and fails closed without them —
an open write endpoint on a public URL is worse than a broken one:

| Variable | What it is |
|---|---|
| `MARK_TOKEN` | The password the page and the CLI send as a bearer token. Any string. |
| `KV_REST_API_URL` + `KV_REST_API_TOKEN` | An Upstash Redis. `UPSTASH_REDIS_REST_URL` / `UPSTASH_REDIS_REST_TOKEN` are accepted too, for a store connected directly. |

The store is `upstash-kv-apricot-ocean`, provisioned from this directory with

```
vercel install upstash/upstash-kv
```

which installs the integration, connects it to the project and pulls the
credentials in one step. **Storage is not under Project Settings** — that
sidebar has no such entry and looking for it there is a dead end. In the
dashboard it lives in the *team* sidebar, at `/[team]/~/stores`.

The map only ever holds removals made since the last scour: `scour.py sync`
takes them into the database, which bakes them into the next page, and then
clears the keys it read. Nothing else is stored, so there is no growth to
manage and the free tier is never in sight.

There is no `package.json` and no build step, deliberately. The endpoint talks
to Upstash over plain HTTP with the runtime's own `fetch`, so `site/` stays a
directory of static files with one function in it.

## Deploying

**A push to `main` does not deploy.** The Vercel project reports the GitHub
repository as connected, but no build fires — verified 2026-08-11, when two
commits reached `origin/main` and the site carried on serving a four-hour-old
build. Every deployment this project has ever had came from the CLI. Treat git
as the history and the CLI as the publish:

```
vercel deploy --prod --yes
```

The scour does both automatically at the end of each run (`scour.py publish` to
do it by hand). If the webhook is ever repaired, the deploy step becomes
redundant rather than wrong.

There is nothing to compile — the page is one file with its CSS, JavaScript and
data inlined — so the project settings are

- **Framework preset** — Other
- **Build command** — none
- **Output directory** — none (repository root)

`vercel.json` sets the page to revalidate on each load rather than being cached,
because it is replaced whenever the scour runs.

## Not indexed, but readable by link previews

The `noindex` meta tag on the page and the `X-Robots-Tag` header in
`vercel.json` keep the report out of search results. `robots.txt` does something
different and must not be confused with them: it controls who may *fetch* the
page at all. It named a blanket `Disallow`, which also turned away LinkedIn's
crawler and left shared links with no preview card, so the social crawlers are
now allowed through by name while everything else is still refused.

None of this makes the page private — anyone with the URL can read it. Use
Vercel's Deployment Protection if the contents should be restricted.
