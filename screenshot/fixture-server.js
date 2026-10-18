// Scripted Apron Chat v8 server that serves a fixed, realistic scene for
// screenshots of an Apron client. Requires Bun; no dependencies.
// Run: bun screenshot/fixture-server.js [--port 8765]
//
// Every connection signs in as "ada" and sees the same rooms, members,
// history and reactions. Messages and reactions it sends are accepted and
// broadcast, but nothing persists across restarts. Timestamps are relative to
// startup, so the scene always looks recent.

const port = Number(process.argv[process.argv.indexOf("--port") + 1]) || Number(process.env.PORT) || 8765;

const GREETING = {
  apron: 8,
  agent: "apron-screenshot-fixture/1",
  auth: ["guest", "token"],
  capabilities: ["rooms", "history", "reactions", "status"],
};

// --- The scene ---------------------------------------------------------------

const users = {
  ada: { user_id: "ada", name: "Ada", status: "online" },
  priya: { user_id: "priya", name: "Priya", status: "online", roles: ["admin"] },
  tomas: { user_id: "tomas", name: "Tomás", status: "idle" },
  mira: { user_id: "mira", name: "Mira", status: "online" },
  jun: { user_id: "jun", name: "Jun", status: "offline" },
  deploybot: { user_id: "deploybot", name: "deploy-bot", status: "online", roles: ["bot"] },
};

const rooms = [
  { room_id: "general", title: "General", description: "Day-to-day chatter for the team.", members: ["ada", "priya", "tomas", "mira", "jun", "deploybot"] },
  { room_id: "ops", title: "Ops", description: "Deploys, alerts and on-call.", members: ["ada", "priya", "deploybot"] },
  { room_id: "random", title: "Random", members: ["ada", "tomas", "mira", "jun"] },
  { room_id: "release-0-9", parent_room_id: "general", title: "Release 0.9", description: "Follow-ups for the 0.9 release", members: ["ada", "mira", "tomas"] },
  { room_id: "design", title: "Design", description: "Mockups and reviews.", members: ["mira", "jun"] },
];

// Minutes before startup, then who said what. `key` names a message for
// replies and reactions.
const script = [
  [190, "random", "jun", "Anyone else's sourdough starter staging a coup this week?"],
  [176, "ops", "deploybot", "Deployed `api` **v1.4.1** to staging."],
  [150, "general", "priya", "Morning! Staging is back up after the disk swap.", { key: "staging" }],
  [146, "general", "tomas", "Thanks. The new reconnect logic held up on the train: dropped wifi twice and history caught right up.", { key: "reconnect" }],
  [131, "general", "mira", "Nice. Could someone review the room settings PR before lunch?", { key: "review" }],
  [129, "general", "jun", "On it.", { reply: "review" }],
  [97, "ops", "deploybot", "Deployed `web` **v0.9.0** to production."],
  [96, "general", "deploybot", "Deployed `web` **v0.9.0** to production. Changelog: 14 commits, 2 contributors.", { key: "deploy" }],
  [94, "release-0-9", "mira", "Collecting follow-ups for 0.9 here."],
  [90, "release-0-9", "tomas", "The thread list should remember its collapsed state. Filing it."],
  [72, "general", "priya", "Heads up, the bot token moved. New config:\n\n```toml\n[bot]\nserver = \"wss://chat.example.com/\"\ntoken_file = \"/run/secrets/apron\"\n```", { key: "config" }],
  [70, "general", "deploybot", "Picked up the new token. Reconnected as `deploy-bot`.", { reply: "config" }],
  [41, "general", "mira", "0.9 is out 🎉 Thread for follow-ups is under **Release 0.9**."],
  [12, "general", "tomas", "Writing up the changelog now. Anything I missed, drop it in the thread."],
];

const reactionScript = [
  [95, "deploy", "mira", ["🎉"]],
  [94, "deploy", "jun", ["🎉"]],
  [93, "deploy", "tomas", ["🎉", "🚀"]],
  [92, "deploy", "priya", ["👍"]],
  [140, "reconnect", "jun", ["👍"]],
  [140, "reconnect", "priya", ["👍"]],
  [68, "config", "tomas", ["🙏"]],
];

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

for (const room of rooms) {
  const record = { room_id: room.room_id, log_id: logIdAt(minutesAgo(240)), title: room.title };
  if (room.description) record.description = room.description;
  if (room.parent_room_id) record.parent_room_id = room.parent_room_id;
  roomsById.set(room.room_id, { ...room, record });
  logs.set(room.room_id, [record]);
}

const events = [
  ...script.map(([ago, room_id, from, text, opts = {}]) => ({ ago, type: "message", room_id, from, text, ...opts })),
  ...reactionScript.map(([ago, key, from, emojis]) => ({ ago, type: "reactions", key, from, emojis })),
].sort((a, b) => b.ago - a.ago);

for (const event of events) {
  if (event.type === "message") {
    postMessage(event.room_id, users[event.from], { text: event.text, format: "markdown" }, event.reply && messagesByKey.get(event.reply), minutesAgo(event.ago), event.key);
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
  const room_id = params.room_id ?? "general";
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

function broadcast(frame) {
  const text = JSON.stringify(frame);
  for (const ws of sockets) if (ws.data.you) ws.send(text);
}

function handle(ws, frame) {
  const { method, params = {} } = frame;
  const you = ws.data.you;
  if (method === "auth") {
    ws.data.you = users.ada;
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
      const room_id = params.room_id ?? "general";
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

Bun.serve({
  hostname: "127.0.0.1",
  port,
  fetch(request, server) {
    if (server.upgrade(request, { data: { you: null } })) return;
    return new Response("Apron screenshot fixture: connect with WebSocket\n", { headers: { "Access-Control-Allow-Origin": "*" } });
  },
  websocket: {
    open(ws) {
      sockets.add(ws);
      ws.send(JSON.stringify({ method: "server", params: GREETING }));
    },
    close(ws) {
      sockets.delete(ws);
    },
    message(ws, data) {
      let frame;
      try {
        frame = JSON.parse(data);
      } catch {
        return ws.send(JSON.stringify({ error: { code: -32700, message: "Invalid JSON" } }));
      }
      if (frame.method === "ping") return ws.send(JSON.stringify({ method: "pong" }));
      try {
        const result = handle(ws, frame);
        if (frame.id !== undefined) ws.send(JSON.stringify({ id: frame.id, result }));
      } catch (error) {
        if (frame.id === undefined) return;
        const { code = -32603, message = "Internal error" } = error;
        ws.send(JSON.stringify({ id: frame.id, error: { code, message } }));
      }
    },
  },
});

console.log(`Apron screenshot fixture on ws://127.0.0.1:${port}/`);
