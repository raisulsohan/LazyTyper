// Draws the demo page frame by frame in headless Microsoft Edge (or Chrome) and saves PNG stills,
// 960x540 (the page's layout size, one device pixel each). Nothing is recorded as video: the page
// draws any frame on request with window.__demo.frame(i), i counting 30 fps frames.
//
//   node tools/demo/capture.mjs [--fps 30] [--frames 0,60,250] [--scale 1] [--out .cache/demo/frames]
//
// --fps below 30 takes every 30/fps-th frame (the typing is still timed at 30 fps). The browser is
// found at LAZYTYPER_BROWSER or the usual Edge and Chrome paths. The page uses the system's fonts
// (Segoe UI, Arial), so frames are identical from run to run on the same machine and browser.

import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawn } from "node:child_process";
import { fileURLToPath, pathToFileURL } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");
const arg = (name, fallback) => { const i = process.argv.indexOf(name); return i > 0 ? process.argv[i + 1] : fallback; };
const fps = Number(arg("--fps", "30"));
const scale = Number(arg("--scale", "1"));
const outDir = path.resolve(root, arg("--out", ".cache/demo/frames"));
const page = pathToFileURL(path.join(root, "docs/demo/lazytyper-demo.html")).href;

const browser = [process.env.LAZYTYPER_BROWSER,
  "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe", "C:/Program Files/Microsoft/Edge/Application/msedge.exe",
  "C:/Program Files/Google/Chrome/Application/chrome.exe", "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
  "/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge"].find((p) => p && fs.existsSync(p));
if (!browser) throw new Error("no Edge or Chrome found; set LAZYTYPER_BROWSER");

fs.rmSync(outDir, { recursive: true, force: true });
fs.mkdirSync(outDir, { recursive: true });
const port = 9335;
const profile = fs.mkdtempSync(path.join(os.tmpdir(), "lt-demo-"));
const proc = spawn(browser, ["--headless=new", `--remote-debugging-port=${port}`, `--user-data-dir=${profile}`,
  "--window-size=1400,900", "--force-device-scale-factor=1", "--mute-audio", "about:blank"], { stdio: "ignore" });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

try {
  let target;
  for (let i = 0; i < 50 && !target; i++) {
    try { target = (await (await fetch(`http://127.0.0.1:${port}/json`)).json()).find((t) => t.type === "page"); } catch {}
    if (!target) await sleep(200);
  }
  if (!target) throw new Error("the browser did not open its debugging port");
  const ws = new WebSocket(target.webSocketDebuggerUrl);
  await new Promise((r) => ws.addEventListener("open", r));
  let id = 0;
  const pending = new Map();
  ws.addEventListener("message", (e) => { const m = JSON.parse(e.data); pending.get(m.id)?.(m); pending.delete(m.id); });
  const send = (method, params = {}) => new Promise((r) => { const i = ++id; pending.set(i, r); ws.send(JSON.stringify({ id: i, method, params })); });
  const evaluate = async (expression) => {
    const m = await send("Runtime.evaluate", { expression, awaitPromise: true, returnByValue: true });
    if (m.result.exceptionDetails) throw new Error(m.result.exceptionDetails.exception?.description ?? m.result.exceptionDetails.text);
    return m.result.result.value;
  };
  await send("Page.navigate", { url: page });
  let ready = false;
  for (let i = 0; i < 100 && !ready; i++) {
    await sleep(100);
    try { ready = await evaluate("!!(window.__demo && __demo.ready) && document.fonts.status === 'loaded'"); } catch {}
  }
  if (!ready) throw new Error("the demo page did not get ready");
  const N = await evaluate(`(() => { __demo.state.playing = false; __demo.setScale(${scale}); return __demo.N; })()`);
  const frames = arg("--frames") ? arg("--frames").split(",").map(Number)
    : Array.from({ length: Math.ceil(N * fps / 30) }, (_, k) => Math.floor(k * 30 / fps + 1e-6)).filter((f) => f < N);
  for (let i = 0; i < frames.length; i++) {
    const url = await evaluate(`(() => { __demo.frame(${frames[i]}); return document.getElementById("cv").toDataURL("image/png"); })()`);
    fs.writeFileSync(path.join(outDir, `f${String(i).padStart(4, "0")}.png`), Buffer.from(url.split(",")[1], "base64"));
  }
  ws.close();
  console.log(`${frames.length} frames in ${path.relative(root, outDir)}`);
} finally {
  proc.kill();
}
