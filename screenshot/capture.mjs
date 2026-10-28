// Takes the landing page's screenshots: for each scene, starts the fixture
// server, opens an Apron web client against it, waits for the scene to load,
// and saves public/images/<file>.
// Run: npm run screenshot [-- <shot> ...]
//
// CLIENT_URL picks the client (default https://web.apron.chat/, or a local
// apron-web dev server). PORT picks the fixture's port (default 8765).

import { execFileSync, spawn } from "node:child_process";
import { mkdtempSync } from "node:fs";
import { connect } from "node:net";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { setTimeout as sleep } from "node:timers/promises";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";

// Each shot is a scene (the shot's own name unless it says), the file it's
// saved to, and how it's taken.
const SHOTS = {
  team: { file: "demo.png" },
  agent: { file: "demo-agent.png" },
  rich: { file: "demo-rich.png" },
  // The link preview image (og:image), at the 1200x630 that link cards use.
  // `host` names the server: the browser resolves it to the fixture, which
  // serves it over TLS with a throwaway certificate.
  og: { scene: "piper", file: "og.png", width: 1200, height: 630, colorScheme: "dark", host: "apron.chat" },
};

const here = fileURLToPath(new URL(".", import.meta.url));
const port = process.env.PORT || "8765";
const clientUrl = process.env.CLIENT_URL || "https://web.apron.chat/";
const chosen = process.argv.slice(2);
for (const name of chosen) if (!SHOTS[name]) throw new Error(`Unknown shot: ${name}`);

const listening = () => new Promise(resolve => {
  const socket = connect(Number(port), "127.0.0.1", () => {
    socket.end();
    resolve(true);
  });
  socket.on("error", () => resolve(false));
});

async function waitForServer() {
  for (let i = 0; i < 50; i++) {
    if (await listening()) return;
    await sleep(100);
  }
  throw new Error("Fixture server did not start");
}

// A self-signed certificate for the shots that name a host; the browser is
// told to accept it.
let certificate;
function tlsArgs() {
  if (!certificate) {
    const dir = mkdtempSync(join(tmpdir(), "apron-fixture-"));
    certificate = { cert: join(dir, "cert.pem"), key: join(dir, "key.pem") };
    execFileSync("openssl", ["req", "-x509", "-newkey", "rsa:2048", "-nodes", "-days", "1", "-subj", "/CN=apron-fixture", "-keyout", certificate.key, "-out", certificate.cert], { stdio: "ignore" });
  }
  return ["--tls-cert", certificate.cert, "--tls-key", certificate.key];
}

async function capture(browser, shot) {
  const { scene: name, file, width = 1280, height = 760, colorScheme = "light", host } = shot;
  const scene = (await import(`./scenes/${name}.js`)).default;
  const output = fileURLToPath(new URL(`../public/images/${file}`, import.meta.url));
  const server = spawn("bun", [`${here}fixture-server.js`, "--scene", name, "--port", port, ...(host ? tlsArgs() : [])], { stdio: "inherit" });
  try {
    await waitForServer();
    const page = await browser.newPage({
      viewport: { width, height },
      deviceScaleFactor: 2,
      colorScheme,
      timezoneId: "UTC",
      ignoreHTTPSErrors: Boolean(host),
    });
    // The client only offers a linked server it hasn't used before, so seed it
    // as a recent server, which a link then switches to at once.
    const chat = host ? `wss://${host}/` : `ws://chat.localhost:${port}/`;
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

// The hosts that shots name all resolve to the fixture. Behind an HTTPS proxy,
// keep the fixture out of it.
const hosts = [...new Set(Object.values(SHOTS).map(shot => shot.host).filter(Boolean))];
const proxy = process.env.HTTPS_PROXY;
const browser = await chromium.launch({
  args: [
    ...(hosts.length ? [`--host-resolver-rules=${hosts.map(host => `MAP ${host} 127.0.0.1:${port}`).join(", ")}`] : []),
    ...(proxy ? [`--proxy-server=${proxy}`, `--proxy-bypass-list=<-loopback>;127.0.0.1;localhost;*.localhost;${hosts.join(";")}`] : []),
  ],
});
try {
  for (const name of chosen.length ? chosen : Object.keys(SHOTS)) await capture(browser, { scene: name, ...SHOTS[name] });
} finally {
  await browser.close();
}
