# apron.chat

apron.chat website: a static landing page for the [Apron Chat Protocol](https://github.com/shazow/apron).

- `public/` is the site, served as-is. There is no build step.
- `wrangler.jsonc` deploys it with Cloudflare Workers Builds: `main` goes to
  apron.chat, and each pull request gets a preview URL.
- `screenshot/` regenerates the Live Demo screenshot; see its
  [README](screenshot/README.md).

To preview locally, serve `public/` with any static server, such as
`npx serve public`, or run `npx wrangler dev`.
