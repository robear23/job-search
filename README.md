# Job search report

A single self-contained page listing English-only job postings in Hungary,
filtered and scored. Deployed from this repository by Vercel.

`index.html` is generated output — it is overwritten wholesale on every publish,
so edits made here are lost on the next run. The generator lives in a separate
private project, which is where any change belongs.

## Deploying

Vercel builds on every push to `main`. There is nothing to compile: the page is
one file with its CSS, JavaScript and data inlined, so the project settings are

- **Framework preset** — Other
- **Build command** — none
- **Output directory** — none (repository root)

`vercel.json` sets the page to revalidate on each load rather than being cached,
because it is replaced whenever the scour runs.

## Not indexed

`robots.txt` and the `X-Robots-Tag` header ask search engines to stay away, and
the page carries a `noindex` meta tag. This keeps the report out of results but
does **not** make it private — anyone with the URL can read it. Use Vercel's
Deployment Protection if the contents should be restricted.
