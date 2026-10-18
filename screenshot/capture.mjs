// Takes the landing page's screenshots: for each scene, starts the fixture
// server, opens an Apron web client against it, waits for the scene to load,
// and saves public/images/<file>.
// Run: npm run screenshot [-- <scene> ...]
//
// CLIENT_URL picks the client (default https://web.apron.chat/, or a local
// apron-web dev server). PORT picks the fixture's port (default 8765).

import { spawn } from "node:child_process";
import { setTimeout as sleep } from "node:timers/promises";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";

const SCENES = {
  team: "demo.png",
  agent: "demo-agent.png",
  rich: "demo-rich.png",
};

const here = fileURLToPath(new URL(".", import.meta.url));
const port = process.env.PORT || "8765";
const clientUrl = process.env.CLIENT_URL || "https://web.apron.chat/";
const chosen = process.argv.slice(2);
for (const name of chosen) if (!SCENES[name]) throw new Error(`Unknown scene: ${name}`);

async function waitForServer() {
  for (let i = 0; i < 50; i++) {
    try {
      await fetch(`http://127.0.0.1:${port}/`);
      return;
    } catch {
      await sleep(100);
    }
  }
  throw new Error("Fixture server did not start");
}

async function capture(browser, name) {
  const scene = (await import(`./scenes/${name}.js`)).default;
  const output = fileURLToPath(new URL(`../public/images/${SCENES[name]}`, import.meta.url));
  const server = spawn("bun", [`${here}fixture-server.js`, "--scene", name, "--port", port], { stdio: "inherit" });
  try {
    await waitForServer();
    const page = await browser.newPage({
      viewport: { width: 1280, height: 760 },
      deviceScaleFactor: 2,
      colorScheme: "light",
      timezoneId: "UTC",
    });
    // The client only offers a linked server it hasn't used before, so seed it
    // as a recent server, which a link then switches to at once.
    const chat = `ws://chat.localhost:${port}/`;
    await page.addInitScript(chat => {
      localStorage.setItem("apron.serverUrl", chat);
      localStorage.setItem("apron.recentServers", JSON.stringify([{ url: chat }]));
      // Wide enough to show the whole server name.
      localStorage.setItem("apron.sidebar", JSON.stringify({ width: 330, collapsed: false }));
    }, chat);
    const url = new URL(clientUrl);
    url.searchParams.set("server", chat);
    url.searchParams.set("room", scene.open.room);
    if (scene.open.thread) url.searchParams.set("thread", scene.open.thread);
    // Live streams never finish loading, so don't wait for the network to go quiet.
    await page.goto(url.toString(), { waitUntil: "load" });
    await page.getByText(scene.waitFor).filter({ visible: true }).first().waitFor({ timeout: 20_000 });
    // A thread opens at its first message; show the latest instead.
    const jump = page.locator('button[title="Jump to latest"]');
    if (await jump.isVisible()) await jump.click();
    // Keep the pointer off the messages, so no hover toolbar shows.
    await page.mouse.move(1, 1);
    await page.waitForTimeout(1500);
    await page.screenshot({ path: output });
    console.log(`Saved ${output}`);
    await page.close();
  } finally {
    server.kill();
  }
}

// Behind an HTTPS proxy, keep the fixture on loopback out of it.
const proxy = process.env.HTTPS_PROXY;
const browser = await chromium.launch({ args: proxy ? [`--proxy-server=${proxy}`, "--proxy-bypass-list=<-loopback>;127.0.0.1;localhost;*.localhost"] : [] });
try {
  for (const name of chosen.length ? chosen : Object.keys(SCENES)) await capture(browser, name);
} finally {
  await browser.close();
}
