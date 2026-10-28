// Computing's pioneers building the Analytical Engine: a thread, a bot, an
// admin, a code block, reactions, typing and a few DMs. The link preview image.

export default {
  open: { room: "engine" },
  waitFor: "just been Turing-tested",

  users: {
    ada: { user_id: "ada", name: "Ada Lovelace", status: "online" },
    grace: { user_id: "grace", name: "Grace Hopper", status: "online", roles: ["admin"] },
    alan: { user_id: "alan", name: "Alan Turing", status: "online" },
    charles: { user_id: "charles", name: "Charles Babbage", status: "idle" },
    hedy: { user_id: "hedy", name: "Hedy Lamarr", status: "online" },
    katherine: { user_id: "katherine", name: "Katherine Johnson", status: "online" },
    engine: { user_id: "engine", name: "difference-engine", status: "online", roles: ["bot"] },
  },

  rooms: [
    { room_id: "engine", title: "Analytical Engine", description: "Building a general-purpose computer, one gear at a time.", members: ["ada", "grace", "alan", "charles", "hedy", "katherine", "engine"] },
    { room_id: "note-g", parent_room_id: "engine", title: "Note G", description: "Reviews for the Bernoulli program", members: ["ada", "alan", "charles"] },
    { room_id: "bugs", title: "Bugs", members: ["ada", "grace", "katherine"] },
    { room_id: "crypto", title: "Cryptography", members: ["ada", "alan", "hedy"] },
    { room_id: "dm-alan", private: true, members: ["ada", "alan"] },
    { room_id: "dm-hedy", private: true, members: ["ada", "hedy"] },
    { room_id: "dm-grace", private: true, members: ["ada", "grace"] },
  ],

  script: [
    [300, "dm-grace", "grace", "Coffee at 3? I'll bring the nanosecond wires."],
    [280, "dm-hedy", "hedy", "Back on set until 6, then I'm all yours for the torpedo radio."],
    [190, "bugs", "grace", "Found the relay fault. It was an actual moth. Taped it into the logbook 🦋"],
    [160, "engine", "charles", "Parliament declined the funding again. Rebuilding the budget in brass.", { key: "funding" }],
    [120, "engine", "ada", "Note G is up: the Engine can compute Bernoulli numbers. Reviews in the thread 🙏\n\n```text\nV4 = V2 × V3\nV5 = V4 − V1\nV11 = V5 ÷ V4\n```", { key: "noteg" }],
    [110, "dm-hedy", "hedy", "Frequency-hopping patch is in, written between takes 🎬"],
    [100, "note-g", "alan", "Lovely. Though I suspect it could compute anything, given enough tape."],
    [95, "engine", "engine", "Tabulated `log₁₀` to 7 places. **0 errors**, 4,000 gears turned.", { key: "tabulated" }],
    [80, "engine", "katherine", "Checked the bot's numbers by hand. They're right. This time.", { key: "checked" }],
        [8, "dm-alan", "alan", "Tea later? I have a question about thinking machines."],
    [5, "engine", "alan", "Has anyone else noticed the bot is getting harder to tell apart from Charles?", { key: "turing" }],
    [2, "engine", "ada", "Charles, I believe you've just been Turing-tested.", { reply: "turing", key: "tested" }],
  ],

  reactions: [
    [115, "noteg", "alan", ["🤯"]],
    [114, "noteg", "grace", ["🤯", "🎉"]],
    [113, "noteg", "katherine", ["🎉"]],
    [78, "checked", "grace", ["💯"]],
    [77, "checked", "ada", ["😂"]],
    [4, "turing", "grace", ["😂"]],
    [3, "turing", "hedy", ["😂"]],
    [3, "turing", "charles", ["😤"]],
    [1, "tested", "hedy", ["😂"]],
  ],

  typing: [{ room_id: "engine", user: "charles" }],
};
