// Takes the Live Demo screenshot: starts the fixture server, opens an Apron
// web client against it, and saves images/demo.png.
// Run: npm run screenshot
//
// CLIENT_URL picks the client (default https://web.apron.chat/, or a local
// apron-web dev server). PORT picks the fixture's port (default 8765).

import { spawn } from "node:child_process";
import { setTimeout as sleep } from "node:timers/promises";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";

const here = fileURLToPath(new URL(".", import.meta.url));
const port = process.env.PORT || "8765";
const clientUrl = process.env.CLIENT_URL || "https://web.apron.chat/";
const output = fileURLToPath(new URL("../images/demo.png", import.meta.url));

const server = spawn("bun", [`${here}fixture-server.js`, "--port", port], { stdio: "inherit" });
const stop = () => server.kill();
process.on("exit", stop);

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

await waitForServer();

// Behind an HTTPS proxy, keep the fixture on loopback out of it.
const proxy = process.env.HTTPS_PROXY;
const browser = await chromium.launch({ args: proxy ? [`--proxy-server=${proxy}`, "--proxy-bypass-list=<-loopback>;127.0.0.1;localhost;*.localhost"] : [] });
try {
  const page = await browser.newPage({
    viewport: { width: 1280, height: 760 },
    deviceScaleFactor: 2,
    colorScheme: "light",
    timezoneId: "UTC",
  });
  // The client only offers a linked server it hasn't used before, so seed it
  // as a recent server, which a link then switches to at once.
  const server = `ws://chat.localhost:${port}/`;
  await page.addInitScript(server => {
    localStorage.setItem("apron.serverUrl", server);
    localStorage.setItem("apron.recentServers", JSON.stringify([{ url: server }]));
    // Wide enough to show the whole server name.
    localStorage.setItem("apron.sidebar", JSON.stringify({ width: 330, collapsed: false }));
  }, server);
  const url = new URL(clientUrl);
  url.searchParams.set("server", server);
  url.searchParams.set("room", "general");
  await page.goto(url.toString(), { waitUntil: "networkidle" });
  await page.getByText("Writing up the changelog now").waitFor({ timeout: 15_000 });
  await page.waitForTimeout(1000);
  await page.screenshot({ path: output });
  console.log(`Saved ${output}`);
} finally {
  await browser.close();
  stop();
}
