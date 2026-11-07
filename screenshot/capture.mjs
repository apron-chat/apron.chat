// Takes the landing page's screenshots: for each shot, opens an Apron web
// client on a scene from scene.apron.chat, waits for it to load, and saves
// public/images/<file>.
// Run: npm run screenshot [-- <shot> ...]
//
// CLIENT_URL picks the client (default https://web.apron.chat/, or a local
// apron-web dev server). SCENES_URL picks the scene server (default
// https://scene.apron.chat, or a local one such as http://localhost:8787).

import { chromium } from "playwright";

// Each shot is a scene (the shot's own name unless it says), the room (and
// thread) it opens, text to wait for, the file it's saved to, and how it's
// taken.
const SHOTS = {
  // Team chat, the shot shown first: Pied Piper's Engineering room. Its
  // times are Pacific, as the scene's are.
  team: { scene: "piper", file: "demo.png", room: "eng", waitFor: "actually doing this", timezoneId: "America/Los_Angeles" },
  agent: { file: "demo-agent.png", room: "general", thread: "fix-reconnect", waitFor: "12/19" },
  rich: { file: "demo-rich.png", room: "design", waitFor: "is typing" },
  // The link preview image (og:image), at the 1200x630 that link cards use,
  // with the server shown as apron.chat (`host`): the page's connection to
  // it is handed to the scene. Its times are Pacific, as the scene's are.
  og: {
    scene: "piper", file: "og.png", room: "eng", waitFor: "actually doing this",
    width: 1200, height: 630, colorScheme: "dark", host: "apron.chat", timezoneId: "America/Los_Angeles",
  },
};

const clientUrl = process.env.CLIENT_URL || "https://web.apron.chat/";
const scenesUrl = (process.env.SCENES_URL || "https://scene.apron.chat").replace(/\/$/, "");
const chosen = process.argv.slice(2);
for (const name of chosen) if (!SHOTS[name]) throw new Error(`Unknown shot: ${name}`);

// A scene happened at fixed times; the page's clock starts just after its
// last event, so it reads as a moment ago.
async function sceneEnd(name) {
  const response = await fetch(`${scenesUrl}/${name}/scene.jsonl`);
  if (!response.ok) throw new Error(`${scenesUrl}/${name}/scene.jsonl: ${response.status}`);
  const times = [...(await response.text()).matchAll(/"log_id":"(\d+)"/g)].map(match => Number(match[1]));
  return Math.max(...times);
}

// Hands a connection the page opened to the scene instead.
function bridge(page, url) {
  const scene = new WebSocket(url);
  const waiting = [];
  scene.onopen = () => waiting.splice(0).forEach(frame => scene.send(frame));
  scene.onmessage = event => page.send(event.data);
  scene.onclose = () => page.close();
  page.onMessage(frame => scene.readyState === WebSocket.OPEN ? scene.send(frame) : waiting.push(frame));
  page.onClose(() => scene.close());
  return scene;
}

async function capture(browser, shot) {
  const { scene: name, file, room, thread, waitFor, width = 1280, height = 760, colorScheme = "light", host, timezoneId = "UTC" } = shot;
  const output = new URL(`../public/images/${file}`, import.meta.url).pathname;
  const scene = `${scenesUrl.replace(/^http/, "ws")}/${name}`;
  const chat = host ? `wss://${host}/` : scene;
  const page = await browser.newPage({ viewport: { width, height }, deviceScaleFactor: 2, colorScheme, timezoneId });
  await page.clock.install({ time: (await sceneEnd(name)) + 2 * 60_000 });
  const bridged = [];
  if (host) await page.routeWebSocket(chat, ws => bridged.push(bridge(ws, scene)));
  // The client only offers a linked server it hasn't used before, so seed it
  // as a recent server, which a link then switches to at once.
  await page.addInitScript(chat => {
    localStorage.setItem("apron.serverUrl", chat);
    localStorage.setItem("apron.recentServers", JSON.stringify([{ url: chat }]));
    // Wide enough to show the whole server name.
    localStorage.setItem("apron.sidebar", JSON.stringify({ width: 330, collapsed: false }));
  }, chat);
  const url = new URL(clientUrl);
  // The client reads where to go from the fragment.
  url.hash = new URLSearchParams({ server: chat, room, ...(thread ? { thread } : {}) }).toString();
  // Live text never finishes loading, so don't wait for the network to go quiet.
  await page.goto(url.toString(), { waitUntil: "load" });
  await page.getByText(waitFor).filter({ visible: true }).first().waitFor({ timeout: 20_000 });
  // A thread opens at its first message; show the latest instead.
  const jump = page.locator('button[title="Jump to latest"]');
  if (await jump.isVisible()) await jump.click();
  // Keep the pointer off the messages, so no hover toolbar shows.
  await page.mouse.move(1, 1);
  await page.waitForTimeout(1500);
  await page.screenshot({ path: output });
  console.log(`Saved ${output}`);
  await page.close();
  for (const socket of bridged) socket.close();
}

const proxy = process.env.HTTPS_PROXY;
const browser = await chromium.launch({
  args: proxy ? [`--proxy-server=${proxy}`, "--proxy-bypass-list=<-loopback>;127.0.0.1;localhost;*.localhost"] : [],
});
try {
  for (const name of chosen.length ? chosen : Object.keys(SHOTS)) await capture(browser, { scene: name, ...SHOTS[name] });
} finally {
  await browser.close();
}
