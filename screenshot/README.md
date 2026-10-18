# Live Demo screenshot

`images/demo.png` on the landing page is a real Apron web client talking to a
scripted server, so the screenshot shows a lived-in chat without anyone's real
messages.

- `fixture-server.js` is an Apron Chat v8 server for Bun with no
  dependencies. It serves one fixed scene: a small team with rooms, a thread,
  a bot, an admin, replies, a code block, reactions and presence. Timestamps
  are relative to when it starts. Edit `users`, `rooms`, `script` and
  `reactionScript` to change the scene.
- `capture.mjs` starts the fixture, opens the web client against it with
  Playwright, waits for the last message, and saves `images/demo.png` at 2x.

## Run

Requires [Bun](https://bun.sh) and Node.js.

```sh
npm install
npm run screenshot
```

To look at the scene yourself, run `npm run fixture` and open
<https://web.apron.chat/?server=ws%3A%2F%2Fchat.localhost%3A8765%2F> (the
client asks before it connects to a new server).

Options, as environment variables:

- `CLIENT_URL`: the client to capture (default `https://web.apron.chat/`),
  such as a local apron-web dev server.
- `PORT`: the fixture's port (default `8765`).
