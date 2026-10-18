// A coding agent fixing a flaky test in a thread: a finished terminal run
// that reproduces the bug, then a live one (capability `embed:stream`) still
// running the full suite when the screenshot is taken.

const ESC = "\u001b";
const green = text => `${ESC}[32m${text}${ESC}[0m`;
const red = text => `${ESC}[31m${text}${ESC}[0m`;
const yellow = text => `${ESC}[33m${text}${ESC}[0m`;
const dim = text => `${ESC}[2m${text}${ESC}[0m`;
const bold = text => `${ESC}[1m${text}${ESC}[0m`;

const reproduced = [
  dim("$ npm test -- --repeat 50 tests/reconnect.test.ts"),
  "",
  ` ${green("✓")} reconnect › resumes history after a drop ${dim("(47 runs)")}`,
  ` ${red("×")} reconnect › resumes history after a drop ${dim("(3 runs)")}`,
  `   ${red("AssertionError: expected 12 messages, received 13")}`,
  `   ${dim("❯ tests/reconnect.test.ts:88:5")}`,
  "",
  ` ${bold("Tests")}  ${red("3 failed")} | ${green("47 passed")} ${dim("(50)")}`,
].join("\n");

const file = (name, tests, time) => ` ${green("✓")} ${name} ${dim(`(${tests} tests)`)} ${yellow(time)}\n`;
// Progress overwrites itself, as a terminal shows it: carriage return, erase line.
const progress = done => `\r${ESC}[2K ${yellow("❯")} tests/threads.test.ts ${dim(`${done}/19`)}`;

export default {
  open: { room: "general", thread: "fix-reconnect" },
  waitFor: "12/19",

  users: {
    ada: { user_id: "ada", name: "Ada", status: "online" },
    tomas: { user_id: "tomas", name: "Tomás", status: "online" },
    priya: { user_id: "priya", name: "Priya", status: "online", roles: ["admin"] },
    mira: { user_id: "mira", name: "Mira", status: "idle" },
    patch: { user_id: "patch", name: "Patch", status: "online", roles: ["bot"] },
  },

  rooms: [
    { room_id: "general", title: "General", description: "Day-to-day chatter for the team.", members: ["ada", "tomas", "priya", "mira", "patch"] },
    { room_id: "fix-reconnect", parent_room_id: "general", title: "Flaky reconnect test", description: "Patch is on it", members: ["ada", "tomas", "priya", "patch"] },
    { room_id: "ops", title: "Ops", description: "Deploys, alerts and on-call.", members: ["ada", "priya", "patch"] },
    { room_id: "random", title: "Random", members: ["ada", "tomas", "mira"] },
  ],

  script: [
    [55, "general", "tomas", "CI is red again: the reconnect test. Asking Patch to take a look in a thread."],
    [40, "fix-reconnect", "tomas", "@patch `tests/reconnect.test.ts` fails about 1 run in 20 on CI. Can you find out why?", { mentions: ["patch"] }],
    [39, "fix-reconnect", "patch", "On it. Plan:\n\n1. Reproduce it with `--repeat 50`\n2. Find the race\n3. Fix it, then run the full suite"],
    [31, "fix-reconnect", "patch", "Reproduced: 3 failures in 50 runs, each with one message too many.", {
      embeds: [{ embed_id: "embed_repro", kind: "stream", format: "terminal", title: "npm test -- --repeat 50", text: reproduced }],
    }],
    [8, "fix-reconnect", "patch", "Found it: the reconnect timer can still fire after `close()`, so history replays twice. The fix is on `fix/reconnect-race`. Running the full suite now.", {
      key: "fix",
      embeds: [{ embed_id: "embed_suite", kind: "stream", format: "terminal", title: "npm test", url: "/streams/suite" }],
    }],
    [3, "fix-reconnect", "priya", "Nice catch. That explains the duplicate messages on flaky wifi.", { reply: "fix" }],
  ],

  reactions: [
    [6, "fix", "tomas", ["👀"]],
    [2, "fix", "priya", ["🙌"]],
  ],

  // Served at /streams/<name>: [milliseconds to wait, text to write]. The
  // stream stays open after the last chunk, so it shows as Live.
  streams: {
    suite: [
      [300, dim("$ npm test") + "\n\n"],
      [200, file("tests/envelope.test.ts", 24, "41ms")],
      [200, file("tests/history.test.ts", 38, "96ms")],
      [300, file("tests/reconnect.test.ts", 17, "1.2s")],
      [200, file("tests/rooms.test.ts", 29, "88ms")],
      [200, file("tests/composer.test.ts", 31, "140ms")],
      [200, progress(3)],
      [200, progress(7)],
      [200, progress(12)],
    ],
  },
};
