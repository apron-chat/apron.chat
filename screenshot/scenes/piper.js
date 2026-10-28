// Pied Piper's engineering room: a benchmark in a terminal, a rival's press
// release, an overeager bot, a feud in replies, a mention, a thread and DMs.
// The link preview image.

export default {
  open: { room: "eng" },
  waitFor: "actually doing this",

  users: {
    ada: { user_id: "ada", name: "Richard", status: "online" },
    gilfoyle: { user_id: "gilfoyle", name: "Gilfoyle", status: "online", roles: ["admin"] },
    dinesh: { user_id: "dinesh", name: "Dinesh", status: "online" },
    jared: { user_id: "jared", name: "Jared", status: "online" },
    erlich: { user_id: "erlich", name: "Erlich", status: "idle" },
    bighead: { user_id: "bighead", name: "Big Head", status: "offline" },
    anton: { user_id: "anton", name: "son-of-anton", status: "online", roles: ["bot"] },
  },

  rooms: [
    { room_id: "eng", title: "Engineering", members: ["ada", "gilfoyle", "dinesh", "jared", "erlich", "bighead", "anton"] },
    { room_id: "middle-out", parent_room_id: "eng", title: "Middle-out", description: "Compression, starting from the middle", members: ["ada", "gilfoyle", "dinesh"] },
    { room_id: "hostel", title: "Hacker Hostel", members: ["ada", "erlich", "gilfoyle", "dinesh", "bighead"] },
    { room_id: "board", title: "Board", members: ["ada", "erlich", "jared"] },
    { room_id: "dm-jared", private: true, members: ["ada", "jared"] },
    { room_id: "dm-erlich", private: true, members: ["ada", "erlich"] },
    { room_id: "dm-bighead", private: true, members: ["ada", "bighead"] },
  ],

  script: [
    [600, "dm-bighead", "bighead", "hey richard, did you know i'm on the board of something?"],
    [500, "hostel", "erlich", "Whoever finished my yogurt: I know. I don't know yet, but I know."],
    [400, "dm-jared", "jared", "I made you a lunch, it's in the fridge with a note of encouragement 🙂"],
    [300, "middle-out", "gilfoyle", "Benchmarks are in the thread above the thread. Kidding. They're here."],
    [200, "dm-erlich", "erlich", "Do not tell anyone, but I've already ordered the jackets."],
    [120, "eng", "anton", "Fixed all failing tests. **0 failures.** (Deleted the tests.)", { key: "anton" }],
    [100, "eng", "dinesh", "Hooli copied us again:", {
      key: "hooli",
      embeds: [{
        embed_id: "embed_hooli", kind: "link", url: "https://hooli.example.com/news/nucleus",
        og: {
          site_name: "Hooli Newsroom",
          title: "Introducing Hooli Nucleus",
          description: "Making the world a better place, through minimal message-oriented transport layers.",
        },
      }],
    }],
    [60, "eng", "dinesh", "Also, my branch is in. Pretty sure it's the best code in the repo.", { key: "branch" }],
    [58, "eng", "gilfoyle", "It compiles. That's the nicest thing anyone will ever say about it.", { reply: "branch", key: "compiles" }],
    [30, "eng", "erlich", "@ada This is the moment. I'm calling the press. Nobody tell Gavin.", { key: "press", mentions: ["ada"] }],
    [5, "eng", "ada", "Middle-out just hit **5.2**. We're... we're actually doing this.", {
      key: "bench",
      embeds: [{
        embed_id: "embed_bench", kind: "stream", format: "terminal", title: "pied-piper bench",
        text: "$ pied-piper bench --corpus 4k-video\ncodec          ratio   weissman\ngzip           2.61    2.6\nhooli-nucleus  2.89    2.9\nmiddle-out     5.20    5.2\n",
      }],
    }],
  ],

  reactions: [
    [119, "anton", "gilfoyle", ["👍"]],
    [118, "anton", "dinesh", ["😱"]],
    [99, "hooli", "erlich", ["🖕"]],
    [57, "compiles", "erlich", ["💀"]],
    [56, "compiles", "jared", ["😬"]],
    [29, "press", "jared", ["🙏"]],
    [4, "bench", "jared", ["🎉", "🥹"]],
    [3, "bench", "dinesh", ["🤯"]],
    [3, "bench", "erlich", ["🚀"]],
  ],

  typing: [{ room_id: "eng", user: "gilfoyle" }],
};
