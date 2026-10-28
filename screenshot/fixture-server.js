// Scripted Apron Chat v9 server that serves a fixed, realistic scene for
// screenshots of an Apron client. Requires Bun; no dependencies.
// Run: bun screenshot/fixture-server.js [--scene team] [--port 8765]
//        [--tls-cert cert.pem --tls-key key.pem]
//
// Scenes live in scenes/<name>.js. Every connection signs in as "ada" and sees
// the scene's rooms, members, history and reactions. Messages and reactions it
// sends are accepted and broadcast, but nothing persists across restarts.
// Timestamps are relative to startup, so the scene always looks recent.
//
// A scene can also serve live streams at /streams/<name> (they never end, so
// clients show them as live), files at /files/<name>, and typing. Paths in
// messages that start with /streams/ or /files/ are sent as URLs on the
// server's own origin, which clients require for stream and image embeds.

const arg = (name, fallback) => {
  const at = process.argv.indexOf(`--${name}`);
  return at > 0 ? process.argv[at + 1] : fallback;
};
const port = Number(arg("port", process.env.PORT)) || 8765;
const sceneName = arg("scene", "team");
// With a certificate it serves wss:// and https://, for a client that's told
// the server is at some real-looking host.
const tls = arg("tls-cert") && { cert: Bun.file(arg("tls-cert")), key: Bun.file(arg("tls-key")) };
if (!/^[a-z]+$/.test(sceneName)) throw new Error(`Invalid scene: ${sceneName}`);
const scene = (await import(`./scenes/${sceneName}.js`)).default;
const { users } = scene;

const GREETING = {
  apron: 9,
  agent: "apron-screenshot-fixture/2",
  auth: ["guest", "token"],
  capabilities: ["rooms", "history", "reactions", "status", "activity", "embed:upload", "embed:stream"],
};

// --- The log -----------------------------------------------------------------

const start = Date.now();
let lastLogId = 0;
function logIdAt(time) {
  lastLogId = Math.max(time, lastLogId + 1);
  return String(lastLogId);
}

const logs = new Map(); // room_id -> records in ascending log_id order
const roomsById = new Map();
const messagesByKey = new Map();
const messagesById = new Map();

const minutesAgo = minutes => start - minutes * 60_000;

function recorded(user) {
  return { user_id: user.user_id, name: user.name };
}

for (const room of scene.rooms) {
  // A private room without a title is a conversation, which clients name for its members.
  const record = { room_id: room.room_id, log_id: logIdAt(minutesAgo(240)) };
  if (room.title) record.title = room.title;
  if (room.private) record.private = true;
  if (room.description) record.description = room.description;
  if (room.parent_room_id) record.parent_room_id = room.parent_room_id;
  roomsById.set(room.room_id, { ...room, record });
  logs.set(room.room_id, [record]);
}

const events = [
  ...scene.script.map(([ago, room_id, from, text, opts = {}]) => ({ ago, type: "message", room_id, from, text, ...opts })),
  ...(scene.reactions ?? []).map(([ago, key, from, emojis]) => ({ ago, type: "reactions", key, from, emojis })),
].sort((a, b) => b.ago - a.ago);

for (const event of events) {
  if (event.type === "message") {
    const body = { text: event.text, format: "markdown" };
    if (event.mentions) body.mentions = event.mentions;
    if (event.embeds) body.embeds = event.embeds;
    postMessage(event.room_id, users[event.from], body, event.reply && messagesByKey.get(event.reply), minutesAgo(event.ago), event.key);
  } else {
    react(messagesByKey.get(event.key), users[event.from], event.emojis, minutesAgo(event.ago));
  }
}

function postMessage(room_id, user, body, replyTo, time = Date.now(), key) {
  const log_id = logIdAt(time);
  const message = { message_id: log_id, log_id, room_id, from: recorded(user), body };
  if (replyTo) message.reply_to = replyTo;
  logs.get(room_id).push(message);
  messagesById.set(message.message_id, message);
  if (key) messagesByKey.set(key, message);
  return message;
}

function react(message, user, emojis, time = Date.now()) {
  const record = {
    log_id: logIdAt(time), message_id: message.message_id, room_id: message.room_id,
    reactions: [{ from: recorded(user), emojis }],
  };
  logs.get(message.room_id).push(record);
  return record;
}

function availability(room_id) {
  const log = logs.get(room_id);
  return { latest_log_id: log.at(-1).log_id, history_log_id: log[0].log_id };
}

function roomRecord(room, members) {
  const record = { ...room.record, ...availability(room.room_id) };
  if (members) record.members = room.members.map(user_id => ({ user_id }));
  return record;
}

// --- Requests ----------------------------------------------------------------

function check(condition, message, code = -32602) {
  if (!condition) throw { code, message };
}

function roomList(params, you) {
  let matches = [...roomsById.values()];
  if (params.room_id) matches = matches.filter(room => room.room_id === params.room_id);
  else if (params.parent_room_id) matches = matches.filter(room => room.parent_room_id === params.parent_room_id);
  matches.sort((a, b) => Number(availability(b.room_id).latest_log_id) - Number(availability(a.room_id).latest_log_id));

  const isMember = room => room.members.includes(you.user_id);
  const filter = params.filter ?? "all";
  const result = {};
  if (filter !== "not_joined") result.joined = matches.filter(isMember).map(room => roomRecord(room, params.members));
  if (filter !== "joined") {
    result.not_joined = matches
      .filter(room => !isMember(room) && (params.room_id || params.parent_room_id || !room.parent_room_id))
      .map(room => roomRecord(room, params.members));
  }
  if (params.members) {
    const ids = new Set(matches.flatMap(room => room.members));
    result.users = [...ids].map(id => users[id]);
  }
  return result;
}

function history(params) {
  const room_id = params.room_id ?? scene.rooms[0].room_id;
  check(logs.has(room_id), "Unknown room");
  const limit = Math.min(params.limit ?? 50, 200);
  check(Number.isInteger(limit) && limit > 0, "Invalid limit");
  const after = Number(params.after ?? 0);
  const before = Number(params.before ?? Number.MAX_SAFE_INTEGER);
  const matches = logs.get(room_id).filter(record => Number(record.log_id) >= after && Number(record.log_id) <= before);
  const slice = "after" in params ? matches.slice(0, limit) : matches.slice(-limit);
  const result = {
    rooms: slice.filter(record => !record.message_id).map(record => ({ ...record, ...availability(room_id) })),
    messages: slice.filter(record => record.message_id && record.body),
    reactions: slice.filter(record => record.reactions),
    more: matches.length > limit,
    ...availability(room_id),
  };
  if (slice.length) {
    result.first_log_id = slice[0].log_id;
    result.last_log_id = slice.at(-1).log_id;
  }
  return result;
}

const sockets = new Set();

// Sends a frame, with /streams/ and /files/ paths as URLs on this connection's origin.
function send(ws, frame) {
  ws.send(JSON.stringify(frame).replace(/"\/(streams|files)\//g, `"${ws.data.origin}/$1/`));
}

function broadcast(frame) {
  for (const ws of sockets) if (ws.data.you) send(ws, frame);
}

function handle(ws, frame) {
  const { method, params = {} } = frame;
  const you = ws.data.you;
  if (method === "auth") {
    ws.data.you = users.ada;
    // Typing shows once the client knows the rooms.
    for (const { room_id, user } of scene.typing ?? []) {
      setTimeout(() => send(ws, { method: "activity", params: { room_id, from: recorded(users[user]), typing: 600 } }), 1500);
    }
    return { you: users.ada };
  }
  check(you, "Sign in first", -32001);
  switch (method) {
    case "me":
      if (typeof params.name === "string") users.ada.name = params.name || "ada";
      if (typeof params.status === "string") users.ada.status = params.status;
      return { you: users.ada };
    case "room_list":
      return roomList(params, you);
    case "history":
      return history(params);
    case "message": {
      check(!("message_id" in params), "Editing is unsupported", -32601);
      const room_id = params.room_id ?? scene.rooms[0].room_id;
      check(logs.has(room_id), "Unknown room");
      check(params.body && (params.body.text || params.body.embeds?.length), "Missing body");
      const replyTo = params.reply_to && messagesById.get(params.reply_to.message_id);
      const message = postMessage(room_id, you, params.body, replyTo);
      broadcast({ method: "message", params: message });
      return { message_id: message.message_id };
    }
    case "reactions": {
      const message = messagesById.get(params.message_id);
      check(message, "Unknown message");
      check(Array.isArray(params.emojis), "Invalid emojis");
      broadcast({ method: "reactions", params: react(message, you, params.emojis) });
      return {};
    }
    case "status":
    case "room_join":
    case "room_leave":
      return {};
    default:
      throw { code: -32601, message: "Unsupported method" };
  }
}

// --- HTTP: streams and files -------------------------------------------------

const cors = { "Access-Control-Allow-Origin": "*" };

// Writes the stream's chunks on their schedule, then stays open.
function stream(chunks) {
  const encoder = new TextEncoder();
  let next = 0;
  const body = new ReadableStream({
    async pull(controller) {
      if (next === chunks.length) return new Promise(() => {});
      const [wait, text] = chunks[next++];
      await Bun.sleep(wait);
      controller.enqueue(encoder.encode(text));
    },
  });
  return new Response(body, { headers: { ...cors, "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "no-store" } });
}

function serveHttp(url) {
  const [, kind, name] = url.pathname.match(/^\/(streams|files)\/([\w.-]+)$/) ?? [];
  if (kind === "streams" && scene.streams?.[name]) return stream(scene.streams[name]);
  if (kind === "files" && scene.files?.[name]) return new Response(Bun.file(new URL(scene.files[name], new URL(`./scenes/${sceneName}.js`, import.meta.url))), { headers: cors });
  if (kind) return new Response("Not found\n", { status: 404, headers: cors });
  return new Response("Apron screenshot fixture: connect with WebSocket\n", { headers: cors });
}

Bun.serve({
  hostname: "127.0.0.1",
  port,
  ...(tls && { tls }),
  idleTimeout: 0, // Streams stay open with nothing more to send.
  fetch(request, server) {
    const origin = `${tls ? "https" : "http"}://${request.headers.get("host") ?? `127.0.0.1:${port}`}`;
    if (server.upgrade(request, { data: { you: null, origin } })) return;
    return serveHttp(new URL(request.url));
  },
  websocket: {
    open(ws) {
      sockets.add(ws);
      send(ws, { method: "server", params: GREETING });
    },
    close(ws) {
      sockets.delete(ws);
    },
    message(ws, data) {
      let frame;
      try {
        frame = JSON.parse(data);
      } catch {
        return send(ws, { error: { code: -32700, message: "Invalid JSON" } });
      }
      if (frame.method === "ping") return send(ws, { method: "pong" });
      try {
        const result = handle(ws, frame);
        if (frame.id !== undefined) send(ws, { id: frame.id, result });
      } catch (error) {
        if (frame.id === undefined) return;
        const { code = -32603, message = "Internal error" } = error;
        send(ws, { id: frame.id, error: { code, message } });
      }
    },
  },
});

console.log(`Apron screenshot fixture, scene "${sceneName}", on ${tls ? "wss" : "ws"}://127.0.0.1:${port}/`);
