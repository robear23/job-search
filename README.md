# Job search report

A single self-contained page listing English-only job postings in Hungary,
filtered and scored. Deployed from this repository by Vercel.

`index.html` is generated output — it is overwritten wholesale on every publish,
so edits made here are lost on the next run. The generator lives in a separate
private project, which is where any change belongs.

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
