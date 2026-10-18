// Rich messages in a Design room: an uploaded image, a mention, a link
// preview, reactions, and someone typing.

export default {
  open: { room: "design" },
  waitFor: "is typing",

  users: {
    ada: { user_id: "ada", name: "Ada", status: "online" },
    mira: { user_id: "mira", name: "Mira", status: "online" },
    jun: { user_id: "jun", name: "Jun", status: "online" },
    priya: { user_id: "priya", name: "Priya", status: "online", roles: ["admin"] },
    tomas: { user_id: "tomas", name: "Tomás", status: "online" },
  },

  rooms: [
    { room_id: "design", title: "Design", description: "Mockups, stickers and reviews.", members: ["ada", "mira", "jun", "priya", "tomas"] },
    { room_id: "general", title: "General", description: "Day-to-day chatter for the team.", members: ["ada", "mira", "jun", "priya", "tomas"] },
    { room_id: "random", title: "Random", members: ["ada", "tomas", "mira", "jun"] },
  ],

  script: [
    [34, "design", "mira", "Printed the first batch of stickers 🎉", {
      key: "stickers",
      embeds: [{
        embed_id: "embed_stickers", kind: "upload", title: "apron-stickers.png", url: "/files/apron-stickers.png",
        og: { title: "apron-stickers.png", image: { url: "/files/apron-stickers.png", type: "image/png", width: 1200, height: 420, alt: "Three stickers: the apron logo, the pixel apron, and a wss:// badge" } },
      }],
    }],
    [20, "design", "priya", "@mira these look great. Can we get a stack for the meetup?", { mentions: ["mira"] }],
    [9, "design", "jun", "And the spec for the meetup demo is up for review:", {
      key: "spec",
      embeds: [{
        embed_id: "embed_spec", kind: "link", url: "https://github.com/example/team-chat/issues/212",
        og: {
          site_name: "GitHub · example/team-chat",
          title: "Remember the collapsed state of the thread list",
          description: "The thread list forgets which rooms were folded after a reload. Keep it per room, next to the sidebar width.",
        },
      }],
    }],
  ],

  reactions: [
    [33, "stickers", "priya", ["😍"]],
    [32, "stickers", "jun", ["😍"]],
    [30, "stickers", "tomas", ["🔥"]],
    [5, "spec", "mira", ["👍"]],
  ],

  // Served at /files/<name>, relative to this file.
  files: {
    "apron-stickers.png": "../assets/apron-stickers.png",
  },

  // Shown to the client shortly after it signs in.
  typing: [{ room_id: "design", user: "tomas" }],
};
