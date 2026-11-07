# Live Demo screenshots

The screenshots on the landing page are a real Apron web client showing
scenes from [scene.apron.chat](https://scene.apron.chat), so they show
lived-in chats without anyone's real messages. Each scene is a read-only Apron
server replaying an archive; its messages, avatars, images and live text all
live in the [scene.apron.chat](https://github.com/apron-chat/scene.apron.chat)
repository, and are changed there.

`capture.mjs` takes each shot in turn: it opens the web client on the shot's
scene with Playwright, waits for it to load, and saves `public/images/<file>`
at 2x. The page's clock is set to just after the scene's last event, so its
messages read as recent.

| shot | scene | file | shows |
|---|---|---|---|
| `team` | [team](https://scene.apron.chat/team) | `demo.png` | rooms, a thread, bot and admin badges, replies, a code block, reactions, presence |
| `agent` | [agent](https://scene.apron.chat/agent) | `demo-agent.png` | a coding agent in a thread, with a finished and a live terminal |
| `rich` | [rich](https://scene.apron.chat/rich) | `demo-rich.png` | an uploaded image, a mention, a link preview, reactions, typing |
| `og` | [piper](https://scene.apron.chat/piper) | `og.png` | dark, at 1200x630: the link preview image (`og:image`), with avatars, a mention, a terminal, replies, a bot, threads and DMs |

`og.png` is also apron-web's `static/og.png`: copy it there when it changes.

A shot with a `host` shows the server under that name instead of
`scene.apron.chat`: the page's connection to that host is handed to the scene.

## Run

Requires Node.js 22 or later.

```sh
npm install
npm run screenshot            # every shot
npm run screenshot -- agent   # one shot
```

Options, as environment variables:

- `CLIENT_URL`: the client to capture (default `https://web.apron.chat/`),
  such as a local apron-web dev server.
- `SCENES_URL`: the scene server (default `https://scene.apron.chat`), such
  as a local one from scene.apron.chat's `npm run dev`
  (`http://localhost:8787`), to capture a scene before it's deployed.
