# apron.chat

apron.chat website: a static landing page for the [Apron Chat Protocol](https://github.com/shazow/apron).

- `public/` is the site. `index.html` and `site.css` are hand-edited.
- `/protocol` is [PROTOCOL.md](https://github.com/shazow/apron/blob/main/PROTOCOL.md)
  from shazow/apron, rendered into `public/protocol.html` by `npm run build`
  with `templates/protocol.html` as its page. The raw Markdown is served at
  `/protocol.md`. These are generated, not committed.
- `public/llms.txt` is the [llms.txt](https://llmstxt.org/) index for agents,
  hand-edited. `npm run build` also writes `public/llms-full.txt`: the index,
  then PROTOCOL.md and HISTORY.md in full.
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

## Protocol frames

The frame examples on the landing page are plain JSON with a little markup, so
they stay easy to edit:

```html
<span class="client">{"method": <b>"auth"</b>, "id": <mark>"c1"</mark>, "params": {"name": <strong>"Ada"</strong>}}</span>
```

`client` or `server` labels the sender, `<b>` marks the method, `<mark>` a
request id, and `<strong>` what the user sees. Everything else is dimmed.
