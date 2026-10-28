# apron.chat

apron.chat website: a static landing page for the [Apron Chat Protocol](https://github.com/shazow/apron).

- `public/` is the site. `site.css` is hand-edited, and so is `404.html`, served
  for any path with no file, which points to the spec and its Markdown. The
  landing page is hand-edited in `templates/index.html`, and `npm run build`
  writes it to `public/index.html` with the protocol version from PROTOCOL.md
  filled in for `{{version}}` and the questions from shazow/apron's FAQ.md for
  `{{faq}}`, each linked to its answer.
- `/protocol` is [PROTOCOL.md](https://github.com/shazow/apron/blob/main/PROTOCOL.md)
  from shazow/apron, rendered into `public/protocol.html` by `npm run build`
  with `templates/protocol.html` as its page, and its code blocks colored by
  [highlight.js](https://highlightjs.org/). The raw Markdown is served at
  `/protocol.md` as `text/plain` (set in `public/_headers`), since some agents
  won't open `text/markdown`, with a comment such as `<!-- #a4-links -->` above
  each heading so a `/protocol#a4-links` link can be found in it. It is also
  served in four parts, one for each tier the page sorts sections into
  (below), for agents that can't read it at once: `/protocol-core.md`,
  `/protocol-capabilities.md`, `/protocol-informative.md` and
  `/protocol-draft.md`. A note atop each lists the parts and which part holds
  each section it links to. These are generated, not committed.
- `/llms.txt` is the [llms.txt](https://llmstxt.org/) index for agents,
  hand-edited in `templates/llms.txt`. `npm run build` writes it to
  `public/llms.txt` with each part's section ids filled in for
  `{{ids_required}}` and the like. It also writes `public/llms-full.txt`: the
  index, then PROTOCOL.md and HISTORY.md in full.
- `src/worker.js` serves Markdown to agents that ask for it: `/` and
  `/protocol` with `Accept: text/markdown` (or `text/plain`) return `llms.txt`
  and the spec's Markdown. Every other path is a static file.
- `wrangler.jsonc` deploys it with Cloudflare Workers Builds: `main` goes to
  apron.chat, and each pull request gets a preview URL. The Worker's build
  command is `npm run build`.
- `screenshot/` regenerates the Live Demo screenshot; see its
  [README](screenshot/README.md).

## Develop

```sh
npm install
npx wrangler dev        # runs npm run build, then serves http://localhost:8787
```

`npm run build` renders the spec from shazow/apron's `main`. Set `APRON_REF`
to render another branch, tag or commit, or `APRON_PROTOCOL=../apron/PROTOCOL.md`
to render a local copy.

The spec page sorts the top-level sections into tiers by their headings:
required from the first section, optional from "N. Capabilities",
informative from "N. Security considerations", and draft from "Appendix X —
Under consideration". Each tier gets its own paper color, and the
capabilities fold to a line each, taken from the capability table
(`| capability | adds | fallback | spec |`) in the Capabilities section.

The build fails, before writing anything, if it can't fetch the spec or
resolve the ref, if the spec has no title, no sections, or no `version: N` in its
front matter, if HISTORY.md has no `## vN (date)` entry, if a tier's heading
or the capability table is missing, or if a
template has a `{{placeholder}}` it has no value for. Workers
Builds then keeps the last good deploy.

## Protocol frames

The frame examples on the landing page are plain JSON with a little markup, so
they stay easy to edit:

```html
<span class="client">{"method": <b>"auth"</b>, "id": <mark>"c1"</mark>, "params": {"name": <strong>"Ada"</strong>}}</span>
```

`client` or `server` labels the sender, `<b>` marks the method, `<mark>` a
request id, and `<strong>` what the user sees. Everything else is dimmed.
