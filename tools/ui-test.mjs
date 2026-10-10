// Drives the real LazyTyper panel inside After Effects through DevTools (port 8125).
//
//   node tools/ui-test.mjs
//
// Needs the dev link (node tools/install-dev.mjs) and PlayerDebugMode. Starts After Effects
// when it is not running, builds a test project (tools/ae/ui-setup.jsx, never saved), opens
// the panel, presses its buttons the way a user would and checks what the panel reports.
// Screenshots of the panel and rendered comp frames go to .cache/ui/.
import fs from "node:fs";
import path from "node:path";
import { execFileSync, spawn } from "node:child_process";
import { fileURLToPath } from "node:url";
import { connectPanel } from "./cep-devtools.mjs";
import { runPs } from "./ps.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const aeCom = process.env.LT_AFTERFX ?? "C:\\Program Files\\Adobe\\Adobe After Effects 2026\\Support Files\\AfterFX.com";
const tmp = path.join(process.env.TEMP, "LazyTyper", "ui");
const out = path.join(root, ".cache", "ui");
fs.mkdirSync(tmp, { recursive: true });
fs.rmSync(out, { recursive: true, force: true });
fs.mkdirSync(out, { recursive: true });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function aeScript(name, resultName, timeout = 300) {
  execFileSync(process.execPath, [path.join(root, "tools", "ae-run.mjs"), path.join(root, "tools", "ae", name), path.join(tmp, resultName), String(timeout)], { stdio: "ignore" });
  return JSON.parse(fs.readFileSync(path.join(tmp, resultName), "utf8"));
}

let failed = 0;
let passed = 0;
function check(name, ok, detail) {
  if (ok) passed++;
  else failed++;
  console.log(`${ok ? "  ok  " : "  FAIL"} ${name}${!ok && detail !== undefined ? ` - ${detail}` : ""}`);
}

// A new project in a run of its own (see fresh-project.jsx), then the setup in the next one.
fs.rmSync(path.join(process.env.TEMP, "LazyTyper", "fresh.json"), { force: true });
execFileSync(process.execPath, [path.join(root, "tools", "ae-run.mjs"), path.join(root, "tools", "ae", "fresh-project.jsx"),
  path.join(process.env.TEMP, "LazyTyper", "fresh.json"), "300"], { stdio: "ignore" });
const setup = aeScript("ui-setup.jsx", "setup.json");
check("test project", setup.ok, setup.error);
async function panelUp() {
  try {
    const list = await (await fetch("http://127.0.0.1:8125/json")).json();
    return list.some((t) => /LazyTyper/.test(t.title));
  } catch {
    return false;
  }
}
// The menu command toggles the panel, so only send it while the panel is closed.
for (let attempt = 0; attempt < 4 && !(await panelUp()); attempt++) {
  spawn(aeCom, ["-r", path.join(root, "tools", "ae", "open-panel.jsx")], { detached: true, stdio: "ignore" }).unref();
  for (let w = 0; w < 15 && !(await panelUp()); w++) await sleep(1000);
}
const panel = await connectPanel({ timeoutMs: 30000 });
await panel.evaluate("location.reload(), 1");
await sleep(2500);

let shot = 0;
async function screenshot(name) {
  shot++;
  const file = path.join(out, `${String(shot).padStart(2, "0")}-${name}.png`);
  fs.writeFileSync(file, await panel.screenshot());
  return file;
}
const info = async () => JSON.parse(await panel.evaluate("LazyTyperPanel.poll(), JSON.stringify(LazyTyperPanel.info())"));
async function waitInfo(pred, what, ms = 30000) {
  const until = Date.now() + ms;
  let last = null;
  while (Date.now() < until) {
    await sleep(700);
    last = await info();
    if (pred(last)) return last;
  }
  check(what, false, JSON.stringify(last).slice(0, 300));
  return last;
}
const click = (id, shift = false) =>
  panel.evaluate(`document.getElementById(${JSON.stringify(id)}).dispatchEvent(new MouseEvent("click", { bubbles: true, shiftKey: ${shift} })), 1`);
const setSelect = (id, value) =>
  panel.evaluate(`(function(){ var s = document.getElementById(${JSON.stringify(id)}); s.value = ${JSON.stringify(value)}; s.dispatchEvent(new Event("change")); return s.value; })()`);
const toastText = () => panel.evaluate("document.getElementById('toast').className.indexOf('hidden') < 0 ? document.getElementById('toastText').textContent : ''");
async function waitToast(what) {
  for (let i = 0; i < 40; i++) {
    await sleep(500);
    const t = await toastText();
    if (t) return t;
  }
  return "";
}
function select(layer, time = "") {
  fs.writeFileSync(path.join(tmp, "select.txt"), `${layer}\n${time}`);
  aeScript("select.jsx", "select.json", 60);
}

// 1. The panel sees the selected text layer.
let i1 = await waitInfo((i) => i.layers && i.layers.length === 1 && i.layers[0].name === "Headline", "panel sees the Headline layer");
check("panel sees the Headline layer", i1.layers[0] && i1.layers[0].name === "Headline" && !i1.layers[0].rig);
await screenshot("selected");

// 2. Create a Dynamic rig with the Vertical cursor.
await panel.evaluate("document.querySelector('.seg-btn[data-value=dynamic]').click(), 1");
await setSelect("createTyping", "b:Average");
await setSelect("createCursor", "b:Vertical");
await click("btnCreate");
let t2 = await waitToast();
check("create toast", /Rigged Headline/.test(t2), t2);
let i2 = await waitInfo((i) => i.layers[0] && i.layers[0].rig === "dynamic" && i.layers[0].cursor, "Headline has a Dynamic rig with a cursor");
check("Headline has a Dynamic rig with a cursor", i2.layers[0].rig === "dynamic" && i2.layers[0].cursor);
await screenshot("dynamic-created");

// 2b. A bigger font makes the measured cursor stale: the panel asks for Refresh, Refresh fixes it.
fs.writeFileSync(path.join(tmp, "font.txt"), "Headline\n120");
aeScript("set-font-size.jsx", "font.json", 60);
let i2b = await waitInfo((i) => i.layers[0] && i.layers[0].needsRefresh, "panel asks for Refresh after a font change");
check("panel asks for Refresh after a font change", i2b.layers[0].needsRefresh);
check("Refresh button stands out", await panel.evaluate("document.getElementById('btnRefresh').classList.contains('is-attention')"));
await screenshot("needs-refresh");
await click("status");
await waitToast();
let i2c = await waitInfo((i) => i.layers[0] && !i.layers[0].needsRefresh, "Refresh clears the request");
check("Refresh clears the request", !i2c.layers[0].needsRefresh);

// 3. A Stable rig with the Box cursor on the paragraph.
select("Paragraph", "0");
await waitInfo((i) => i.layers[0] && i.layers[0].name === "Paragraph", "panel follows the selection");
await panel.evaluate("document.querySelector('.seg-btn[data-value=stable]').click(), 1");
await setSelect("createTyping", "b:Very Fast");
await setSelect("createCursor", "b:Box");
await click("btnCreate");
let t3 = await waitToast();
check("stable create toast", /Rigged Paragraph/.test(t3), t3);
let i3 = await waitInfo((i) => i.layers[0] && i.layers[0].rig === "stable", "Paragraph has a Stable rig");
check("Paragraph has a Stable rig", i3.layers[0].rig === "stable");

// 4. Rendered frames: the text types on with a cursor.
fs.writeFileSync(path.join(tmp, "frames.txt"), ["0.4", "1.0", "1.6", "2.4", "4.0", "6.0"].join("\n"));
const fr = aeScript("frames.jsx", "frames.json", 300);
check("comp frames rendered", fr.saved === 6, fr.error);
for (let k = 0; k < 6; k++) {
  const src = path.join(tmp, `frame-${k}.png`);
  if (fs.existsSync(src)) fs.copyFileSync(src, path.join(out, `frame-${k}.png`));
}

// 5. Bake and unbake the Headline from the panel.
select("Headline", "1");
await waitInfo((i) => i.layers[0] && i.layers[0].name === "Headline", "back on Headline");
await click("btnBake");
let t5 = await waitToast();
check("bake toast", /Baked Headline/.test(t5), t5);
let i5 = await waitInfo((i) => i.layers[0] && i.layers[0].baked, "Headline is baked");
check("Headline is baked", i5.layers[0].baked);
const bakeLabel = await panel.evaluate("document.getElementById('bakeLabel').textContent");
check("button says Unbake", bakeLabel === "Unbake", bakeLabel);
await screenshot("baked");
await click("btnBake", true);
await waitToast();
let i6 = await waitInfo((i) => i.layers[0] && !i.layers[0].baked, "Headline is unbaked");
check("Headline is unbaked", !i6.layers[0].baked);

// 6. Presets: apply Hunt & Peck, save the rig's values as a new preset, delete it again.
await setSelect("typingPreset", "b:Hunt & Peck");
await click("btnApplyTyping");
let t7 = await waitToast();
check("apply typing preset", /Applied/.test(t7), t7);
await click("btnSaveTyping");
await panel.evaluate("document.getElementById('saveTypingName').value = 'UI test preset', 1");
await click("btnSaveTypingOk");
let t8 = await waitToast();
check("save typing preset", /Saved|Updated/.test(t8), t8);
const fpc = await panel.evaluate("JSON.stringify((function(){ var o = document.getElementById('typingPreset'); return o.value; })())");
check("saved preset selected", /UI test preset/.test(fpc), fpc);
await click("btnDeleteTyping");
let t9 = await waitToast();
check("delete typing preset", /Deleted/.test(t9), t9);
await setSelect("cursorPreset", "b:Underscore");
await click("btnApplyCursor");
let t10 = await waitToast();
check("apply cursor preset", /Cursor set/.test(t10), t10);

// 7. Timeline helpers.
select("Headline", "2.5");
await waitInfo((i) => i.time > 2.4, "playhead at 2.5 s");
await click("btnStop");
check("stop typing", /stops here/.test(await waitToast()));
await panel.evaluate("document.getElementById('eraseWhat').value = 'all', 1");
select("Headline", "3");
await waitInfo((i) => i.time > 2.9, "playhead at 3 s");
await click("btnErase");
check("erase", /backspace away/.test(await waitToast()));
select("Headline", "3.7");
let i11 = await waitInfo((i) => i.time > 3.6, "playhead at 3.7 s");
check("erased by 3.7 s", i11.layers[0].shown === 0, i11.layers[0].shown);
check("erased: the panel still knows the full text", i11.layers[0].text === "Hello, this is LazyTyper." &&
  i11.layers[0].length === 25, `${i11.layers[0].length} "${i11.layers[0].text}"`);
const sub11 = await panel.evaluate("document.getElementById('statusSub').textContent");
check("erased: status counts out of the full text", /0 \/ 25 characters/.test(sub11), sub11);
await click("btnPause");
check("pause", /Pause/.test(await waitToast()));
await screenshot("after-helpers");

// 8. Refresh and remove.
await click("btnRefresh");
check("refresh", /Refreshed Headline/.test(await waitToast()));
await click("btnRemove");
check("remove", /Removed the rig/.test(await waitToast()));
let i12 = await waitInfo((i) => i.layers[0] && !i.layers[0].rig, "rig removed");
check("rig removed", !i12.layers[0].rig);

panel.close();
await sleep(4000);
const dialogs = runPs(path.join(root, "tools", "ae-dialogs.ps1"))
  .split(/\r?\n/).filter((l) => /\[#32770\] ''/.test(l));
check("no After Effects error dialogs", !dialogs.length, dialogs.join(" | "));
console.log(`${failed ? "FAILED" : "ok"}: ${passed} passed, ${failed} failed. Screenshots in ${out}`);
process.exit(failed ? 1 : 0);
