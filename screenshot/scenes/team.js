// A small team's General room: a thread, a bot, an admin, replies, a code
// block, reactions and presence. The landing page's main screenshot.

export default {
  open: { room: "general" },
  waitFor: "Writing up the changelog now",

  users: {
    ada: { user_id: "ada", name: "Ada", status: "online" },
    priya: { user_id: "priya", name: "Priya", status: "online", roles: ["admin"] },
    tomas: { user_id: "tomas", name: "Tomás", status: "idle" },
    mira: { user_id: "mira", name: "Mira", status: "online" },
    jun: { user_id: "jun", name: "Jun", status: "offline" },
    deploybot: { user_id: "deploybot", name: "deploy-bot", status: "online", roles: ["bot"] },
  },

  rooms: [
    { room_id: "general", title: "General", description: "Day-to-day chatter for the team.", members: ["ada", "priya", "tomas", "mira", "jun", "deploybot"] },
    { room_id: "ops", title: "Ops", description: "Deploys, alerts and on-call.", members: ["ada", "priya", "deploybot"] },
    { room_id: "random", title: "Random", members: ["ada", "tomas", "mira", "jun"] },
    { room_id: "release-0-9", parent_room_id: "general", title: "Release 0.9", description: "Follow-ups for the 0.9 release", members: ["ada", "mira", "tomas"] },
    { room_id: "design", title: "Design", description: "Mockups and reviews.", members: ["mira", "jun"] },
  ],

  // Minutes before startup, room, sender, Markdown text, and options: `key`
  // names a message for replies and reactions, `reply` replies to one.
  script: [
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
  ],

  // Minutes before startup, the message's key, who reacted, and with what.
  reactions: [
    [95, "deploy", "mira", ["🎉"]],
    [94, "deploy", "jun", ["🎉"]],
    [93, "deploy", "tomas", ["🎉", "🚀"]],
    [92, "deploy", "priya", ["👍"]],
    [140, "reconnect", "jun", ["👍"]],
    [140, "reconnect", "priya", ["👍"]],
    [68, "config", "tomas", ["🙏"]],
  ],
};
