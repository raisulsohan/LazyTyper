// Runs an ExtendScript file inside After Effects and waits for the file it writes.
//
//   node tools/ae-run.mjs <script.jsx> <result file> [timeout seconds]
//
// Starts After Effects (with its UI) when it is not running, waits until it accepts
// scripts, then sends the script with AfterFX.com -r. The script must write <result file>
// containing "done":true; this prints it and exits 0, or exits 1 on timeout. After Effects is
// left running.
//
// Dialogs. A script sent while another one runs (a panel's call, say) is refused with a
// "second script" warning and not run at all, so that warning is closed and the script sent
// again (three tries). An error box that comes while our script runs is closed too; the script
// then carries on, so it is only sent again when nothing more arrives. Every dialog is logged
// with a picture of the screen in %TEMP%\LazyTyper\dialogs. Scripts are never sent while a
// dialog is open: they would queue up and each come back later as another warning.
import fs from "node:fs";
import path from "node:path";
import { execFileSync, spawn } from "node:child_process";
import { fileURLToPath } from "node:url";
import { runPs } from "./ps.mjs";

const here = path.dirname(fileURLToPath(import.meta.url));
const aeCom = process.env.LT_AFTERFX ?? "C:\\Program Files\\Adobe\\Adobe After Effects 2026\\Support Files\\AfterFX.com";
const [script, resultFile, timeoutArg] = process.argv.slice(2);
if (!script || !resultFile) {
  console.error("usage: node tools/ae-run.mjs <script.jsx> <result file> [timeout seconds]");
  process.exit(2);
}
const timeoutMs = Number(timeoutArg ?? 600) * 1000;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const tmp = path.join(process.env.TEMP, "LazyTyper");
fs.mkdirSync(path.join(tmp, "dialogs"), { recursive: true });

function aeRunning() {
  const out = execFileSync("tasklist", ["/FO", "CSV", "/NH", "/FI", "IMAGENAME eq AfterFX.exe"], { encoding: "utf8" });
  return /AfterFX\.exe/i.test(out);
}

/**
 * After Effects' visible message boxes (errors, warnings), if any: untitled #32770 windows.
 * The "Executing Script ..." progress window is a #32770 too, but has a title.
 */
function aeDialogs() {
  try {
    const out = runPs(path.join(here, "ae-dialogs.ps1"));
    return out.split(/\r?\n/).filter((l) => /\[#32770\] ''/.test(l));
  } catch {
    return [];
  }
}

/** Saves a picture of the screen, closes the dialogs, returns the picture's path. */
function closeDialogs() {
  const shot = path.join(tmp, "dialogs", `dialog-${Date.now()}.png`);
  try {
    runPs(path.join(here, "screen-capture.ps1"), [shot]);
  } catch {}
  runPs(path.join(here, "ae-dismiss.ps1"));
  return shot;
}

/**
 * Sends a script and waits until isDone() says so. Returns "done", "dialog" or "timeout".
 * progress() tells whether the script is getting anywhere (its result file growing).
 */
async function send(file, isDone, waitMs, progress) {
  spawn(aeCom, ["-r", file], { detached: true, stdio: "ignore" }).unref();
  const until = Date.now() + waitMs;
  let checks = 0;
  while (Date.now() < until) {
    await sleep(1000);
    if (isDone()) return "done";
    if (++checks % 2 === 0 && aeDialogs().length) {
      const before = progress();
      const shot = closeDialogs();
      console.error(`closed an After Effects dialog (screen: ${shot})`);
      // An error box during our own script: it goes on once the box is closed.
      for (let i = 0; i < 8; i++) {
        await sleep(1000);
        if (isDone() || progress() !== before) break;
      }
      if (isDone()) return "done";
      if (progress() !== before) continue;
      return "dialog";
    }
  }
  return "timeout";
}

async function sendWithRetries(file, isDone, waitMs, progress) {
  for (let attempt = 1; attempt <= 3; attempt++) {
    if (aeDialogs().length) console.error(`closed an After Effects dialog first (screen: ${closeDialogs()})`);
    const r = await send(file, isDone, waitMs, progress);
    if (r !== "dialog") return r;
    await sleep(2000);
  }
  return "dialog";
}

const started = Date.now();
if (!aeRunning()) {
  console.log("starting After Effects");
  spawn(path.join(path.dirname(aeCom), "AfterFX.exe"), [], { detached: true, stdio: "ignore" }).unref();
  // A script sent before After Effects has started can end the session with it, so wait.
  for (let i = 0; i < 120 && !aeRunning(); i++) await sleep(1000);
  await sleep(25000);
}

// 1. A tiny script that writes a flag: After Effects is ready for scripts.
const flag = path.join(tmp, "ae-ready.flag");
fs.rmSync(flag, { force: true });
const ping = path.join(tmp, "ae-ping.jsx");
fs.writeFileSync(ping, `var f = new File(${JSON.stringify(flag.replace(/\\/g, "/"))}); f.open("w"); f.write(app.version); f.close();`, "utf8");
const ready = await sendWithRetries(ping, () => fs.existsSync(flag), Math.min(timeoutMs, 180000), () => 0);
if (ready !== "done") {
  console.error(`After Effects did not answer (${ready})`);
  process.exit(1);
}
console.log(`After Effects ready after ${Math.round((Date.now() - started) / 1000)} s`);

// 2. The script itself.
fs.rmSync(resultFile, { force: true });
const resultText = () => (fs.existsSync(resultFile) ? fs.readFileSync(resultFile, "utf8") : "");
const r = await sendWithRetries(path.resolve(script), () => /"done":true/.test(resultText()), timeoutMs, () => resultText().length);
if (r === "done") {
  console.log(resultText());
  process.exit(0);
}
console.error(`${r === "timeout" ? "timed out" : "stopped by After Effects dialogs"}; partial result:`);
console.error(resultText());
process.exit(1);
