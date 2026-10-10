// Takes PNG pictures of HTML pages in headless Microsoft Edge (or Chrome), for the manual's charts.
// Nothing is recorded as video.
//
//   const b = await openBrowser(); await b.snap(html, file, { width, height }); b.close();

import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawn } from "node:child_process";

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

export async function openBrowser({ scale = 2 } = {}) {
  const exe = [process.env.LAZYTYPER_BROWSER,
    "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe", "C:/Program Files/Microsoft/Edge/Application/msedge.exe",
    "C:/Program Files/Google/Chrome/Application/chrome.exe"].find((p) => p && fs.existsSync(p));
  if (!exe) throw new Error("no Edge or Chrome found; set LAZYTYPER_BROWSER");
  const port = 9336;
  const profile = fs.mkdtempSync(path.join(os.tmpdir(), "lt-manual-"));
  const proc = spawn(exe, ["--headless=new", `--remote-debugging-port=${port}`, `--user-data-dir=${profile}`,
    "--window-size=1600,1200", `--force-device-scale-factor=${scale}`, "--hide-scrollbars", "--mute-audio", "about:blank"], { stdio: "ignore" });
  let target;
  for (let i = 0; i < 60 && !target; i++) {
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
  return {
    /** Draws `html` at `width` CSS px and saves the page, as tall as its content, to `file` (`transparent`: no page background). */
    async snap(html, file, { width = 1200, transparent = false } = {}) {
      const page = path.join(profile, "page.html");
      fs.writeFileSync(page, html, "utf8");
      await send("Emulation.setDeviceMetricsOverride", { width, height: 800, deviceScaleFactor: scale, mobile: false });
      await send("Emulation.setDefaultBackgroundColorOverride", transparent ? { color: { r: 0, g: 0, b: 0, a: 0 } } : {});
      await send("Page.navigate", { url: `file:///${page.replace(/\\/g, "/")}` });
      let ready = false;
      for (let i = 0; i < 100 && !ready; i++) {
        await sleep(100);
        try { ready = await evaluate("document.readyState === 'complete' && document.fonts.status === 'loaded' && !!window.__ready"); } catch {}
      }
      if (!ready) throw new Error("the chart page did not finish drawing");
      const height = await evaluate("Math.ceil(document.documentElement.getBoundingClientRect().height)");
      const shot = await send("Page.captureScreenshot", { format: "png", captureBeyondViewport: true, clip: { x: 0, y: 0, width, height, scale: 1 } });
      fs.mkdirSync(path.dirname(file), { recursive: true });
      fs.writeFileSync(file, Buffer.from(shot.result.data, "base64"));
    },
    close() {
      try { ws.close(); } catch {}
      proc.kill();
      setTimeout(() => { try { fs.rmSync(profile, { recursive: true, force: true }); } catch {} }, 1500).unref();
    }
  };
}
