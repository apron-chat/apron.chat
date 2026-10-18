# Live Demo screenshots

The screenshots on the landing page are a real Apron web client talking to a
scripted server, so they show lived-in chats without anyone's real messages.

- `fixture-server.js` is an Apron Chat v8 server for Bun with no
  dependencies. It serves one scene from `scenes/`. Timestamps are relative to
  when it starts. It also serves a scene's live streams at `/streams/<name>`
  (they never end, so clients show them as live), its files at
  `/files/<name>`, and typing.
- `capture.mjs` runs each scene in turn: it starts the fixture, opens the web
  client against it with Playwright, waits for the scene to load, and saves
  `public/images/<file>` at 2x.

| scene | file | shows |
|---|---|---|
| `team` | `demo.png` | rooms, a thread, bot and admin badges, replies, a code block, reactions, presence |
| `agent` | `demo-agent.png` | a coding agent in a thread, with a finished and a live terminal stream (`embed:stream`) |
| `rich` | `demo-rich.png` | an uploaded image, a mention, a link preview, reactions, typing |

Each scene in `scenes/<name>.js` defines its users, rooms, a script of
messages (with optional replies, mentions and embeds), reactions, and
optionally `streams`, `files` and `typing`, plus the room to open and the
text to wait for. Paths in messages that start with `/streams/` or `/files/`
are sent as URLs on the server's own origin, which the client requires for
streams and images.

`assets/apron-stickers.png` is a sticker sheet made from the Apron logo, the
pixel-art apron in shazow/apron's `art/`, and a `wss://` badge.

## Run

Requires [Bun](https://bun.sh) and Node.js.

```sh
npm install
npm run screenshot            # every scene
npm run screenshot -- agent   # one scene
```

To look at a scene yourself, run `npm run fixture -- --scene agent` and open
<https://web.apron.chat/?server=ws%3A%2F%2Fchat.localhost%3A8765%2F> (the
client asks before it connects to a new server).

Options, as environment variables:

- `CLIENT_URL`: the client to capture (default `https://web.apron.chat/`),
  such as a local apron-web dev server.
- `PORT`: the fixture's port (default `8765`).
