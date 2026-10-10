// The pictures of the manual (docs/manual/media/): drives the real LazyTyper panel inside After
// Effects through DevTools (port 8125), takes pictures of the panel, of After Effects' own window
// (PrintWindow: that window only, never the desktop) and of comp frames After Effects renders, and
// turns frame sequences into GIFs with ffmpeg. Never writes a video file: PNG and GIF only.
//
// Used by tools/manual/capture.mjs; see its header for how to run it.

import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { execFileSync, spawn } from "node:child_process";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";
import { connectPanel } from "../cep-devtools.mjs";

const RIG = createRequire(import.meta.url)("../../client/rig.js");

const aeCom = process.env.LT_AFTERFX ?? "C:\\Program Files\\Adobe\\Adobe After Effects 2026\\Support Files\\AfterFX.com";
export const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");
export const media = path.join(root, "docs", "manual", "media");
export const work = path.join(root, ".cache", "manual");
const here = path.dirname(fileURLToPath(import.meta.url));
const temp = path.join(os.tmpdir(), "LazyTyper");
export const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

/** The panel's size in every picture of it (CSS pixels, drawn at twice the density). */
export const PANEL = { width: 380, height: 1180, scale: 2 };

/** The ring and badge colour that marks a control in a picture. */
const MARK = "#ff6a2b";

/** Where the Timeline's layer columns end, before Parent & Link (Default workspace, px). */
const TIMELINE_COLUMNS = 700;

/** Room under a clipped picture for a toast (CSS px). */
const TOAST_ROOM = 62;

function aeRunning() {
  const out = execFileSync("tasklist", ["/FO", "CSV", "/NH", "/FI", "IMAGENAME eq AfterFX.exe"], { encoding: "utf8" });
  return /AfterFX/i.test(out);
}

/** The node processes other than this one, as { pid, cmd }. */
function otherNodeProcesses() {
  try {
    const out = execFileSync("powershell", ["-NoProfile", "-Command", "Get-CimInstance Win32_Process -Filter \"Name='node.exe'\" | ForEach-Object { \"$($_.ProcessId)`t$($_.CommandLine)\" }"], { encoding: "utf8" });
    return out
      .split(/\r?\n/)
      .map((line) => ({ pid: Number(line.split("\t")[0]), cmd: line.slice(line.indexOf("\t") + 1) }))
      .filter((p) => p.pid && p.pid !== process.pid && p.pid !== process.ppid);
  } catch {
    return [];
  }
}

const lockFile = path.join(temp, "manual-session.lock");
const otherLocks = [path.join(os.tmpdir(), "LazyMapLayers", "manual-session.lock")];

/**
 * Why After Effects is not ours to drive right now, or null: another session's test run, capture,
 * spike or poke script is at work (LazyTyper's or LazyMapLayers'), or holds a session lock.
 */
export function someoneElseDriving() {
  const others = otherNodeProcesses();
  const busy = others.find((p) => /ae-test\.mjs|ui-test\.mjs|ae-run\.mjs|ae-spikes\.mjs|tools[\\/]manual[\\/](capture|poke)\.mjs|journey/i.test(p.cmd));
  if (busy) return `process ${busy.pid} drives After Effects (${busy.cmd.trim()}).`;
  for (const file of [lockFile, ...otherLocks]) {
    try {
      const lock = JSON.parse(fs.readFileSync(file, "utf8"));
      const holder = others.find((p) => p.pid === lock.pid);
      if (holder) return `process ${lock.pid} holds ${file} (${holder.cmd.trim()}).`;
    } catch {
      // No lock, or one left by a process that has ended.
    }
  }
  return null;
}

function takeLock() {
  fs.mkdirSync(path.dirname(lockFile), { recursive: true });
  fs.writeFileSync(lockFile, JSON.stringify({ pid: process.pid, cmd: process.argv.join(" "), since: new Date().toISOString() }), "utf8");
  process.on("exit", () => {
    try {
      if (JSON.parse(fs.readFileSync(lockFile, "utf8")).pid === process.pid) fs.rmSync(lockFile, { force: true });
    } catch {
      // Already gone.
    }
  });
}

/** Runs one tools/ae/*.jsx (or any jsx) through tools/ae-run.mjs, which sends it once with -r. */
export function aeRun(script, resultName, timeout = 300) {
  const result = path.join(temp, resultName);
  fs.mkdirSync(temp, { recursive: true });
  execFileSync(process.execPath, [path.join(root, "tools", "ae-run.mjs"), script, result, String(timeout)], { stdio: "ignore" });
  return JSON.parse(fs.readFileSync(result, "utf8"));
}

async function panelUp() {
  try {
    const list = await (await fetch("http://127.0.0.1:8125/json")).json();
    return list.some((t) => /LazyTyper/.test(t.title));
  } catch {
    return false;
  }
}

/**
 * Runs a .ps1 with arguments, passed as an encoded command: this PC's execution policy
 * refuses -File, and changing the policy is not ours to do.
 */
export function ps(file, args = []) {
  const quoted = args.map((a) => `'${String(a).replace(/'/g, "''")}'`).join(" ");
  const script = ["$ProgressPreference = 'SilentlyContinue'", "& {", fs.readFileSync(file, "utf8"), `} ${quoted}`].join("\n");
  return execFileSync("powershell", ["-NoProfile", "-NonInteractive", "-EncodedCommand", Buffer.from(script, "utf16le").toString("base64")], { encoding: "utf8" });
}

/** After Effects' visible message boxes (untitled #32770 windows), as lines. */
export function aeDialogs() {
  try {
    const out = ps(path.join(root, "tools", "ae-dialogs.ps1"));
    return out.split(/\r?\n/).filter((l) => /\[#32770\] ''/.test(l));
  } catch {
    return [];
  }
}

/** One connection to the panel, with the helpers every chapter script uses. */
export async function openSession({ start = false } = {}) {
  const busy = someoneElseDriving();
  if (busy) throw new Error(`After Effects is in use: ${busy} Wait until it ends.`);
  if (!aeRunning() && !start) throw new Error("After Effects is not running. Ask Sohan, then pass --start.");
  takeLock();
  if (!(await panelUp())) {
    // tools/ae-run.mjs starts After Effects when needed and waits until it takes scripts.
    aeRun(path.join(here, "ae", "ready.jsx"), "manual-ready.json", 300);
    // The menu command toggles the panel, so it is sent once, only while the panel is closed.
    if (!(await panelUp())) spawn(aeCom, ["-r", path.join(root, "tools", "ae", "open-panel.jsx")], { detached: true, stdio: "ignore" }).unref();
  }
  for (let i = 0; i < 60 && !(await panelUp()); i++) await sleep(1000);
  const panel = await connectPanel({ timeoutMs: 30000 });
  fs.mkdirSync(media, { recursive: true });
  fs.mkdirSync(work, { recursive: true });
  const js = (expression) => panel.evaluate(expression);
  const revealed = new Set();

  const s = {
    panel,
    js,

    /** Runs ExtendScript in After Effects (through the panel) and returns its result as a string. */
    ae(script) {
      return js(`new Promise(function (resolve) { window.__adobe_cep__.evalScript(${JSON.stringify(script)}, resolve); })`);
    },

    /** Sizes the panel the same for every picture. */
    async size(height = PANEL.height) {
      await panel.send("Emulation.setDeviceMetricsOverride", { width: PANEL.width, height, deviceScaleFactor: PANEL.scale, mobile: false });
      await sleep(300);
    },

    /** Asks After Effects what is selected and waits until `pred(info)` holds. */
    async info(pred = () => true, what = "panel state", ms = 20000) {
      const until = Date.now() + ms;
      let last = null;
      while (Date.now() < until) {
        await js("LazyTyperPanel.poll(), 1");
        await sleep(700);
        last = await js("JSON.parse(JSON.stringify(LazyTyperPanel.info()))");
        if (pred(last)) return last;
      }
      throw new Error(`${what}: ${JSON.stringify(last).slice(0, 300)}`);
    },

    /** Clicks a panel control by id (Shift held when asked) and returns the toast it shows, if any. */
    async click(id, { shift = false, toast = true } = {}) {
      await js(`(function () { var e = document.getElementById(${JSON.stringify(id)}); if (!e) throw new Error("no control ${id}"); e.dispatchEvent(new MouseEvent("click", { bubbles: true, shiftKey: ${shift} })); return 1; })()`);
      if (!toast) return "";
      for (let i = 0; i < 60; i++) {
        await sleep(500);
        const t = await s.toastText();
        if (t) return t;
      }
      return "";
    },

    toastText: () => js("document.getElementById('toast').className.indexOf('hidden') < 0 ? document.getElementById('toastText').textContent : ''"),

    /** Hides the toast (so the next picture shows the panel without it). */
    async hideToast() {
      await js("(document.getElementById('toast').className = 'toast hidden', 1)");
      await sleep(200);
    },

    /** Sets a select or input by id and fires the events the panel listens to. */
    async set(id, value) {
      await js(`(function () { var e = document.getElementById(${JSON.stringify(id)}); if (!e) throw new Error("no control ${id}"); e.value = ${JSON.stringify(String(value))}; e.dispatchEvent(new Event("input", { bubbles: true })); e.dispatchEvent(new Event("change", { bubbles: true })); return e.value; })()`);
      await sleep(250);
    },

    /** Types into a panel field one character at a time, as a person does (for GIFs). */
    async typeInto(id, text, ms = 90) {
      await js(`(function () { var e = document.getElementById(${JSON.stringify(id)}); e.focus(); e.value = ""; return 1; })()`);
      for (let i = 1; i <= text.length; i++) {
        await js(`(function () { var e = document.getElementById(${JSON.stringify(id)}); e.value = ${JSON.stringify(text.slice(0, i))}; e.dispatchEvent(new Event("input", { bubbles: true })); return 1; })()`);
        await sleep(ms);
      }
    },

    /**
     * Puts an expression on a property of a layer, found by match names from the layer down
     * (e.g. ["ADBE Text Properties", "ADBE Text Document"]).
     */
    async expressionOn(layer, path, expr) {
      const r = await s.ae(`(function () { var p = app.project.activeItem.layer(${JSON.stringify(layer)}); var q = ${JSON.stringify(path)}; for (var i = 0; i < q.length; i++) p = p.property(q[i]); p.expression = ${JSON.stringify(expr)}; return p.expressionError ? "error: " + p.expressionError : "ok"; })()`);
      if (r !== "ok") throw new Error(`expression on ${layer}: ${r}`);
    },

    /** Dynamic or Stable in 1 · Create rig. */
    async rigType(value) {
      await js(`(document.querySelector('.seg-btn[data-value=${value}]').click(), 1)`);
      await sleep(250);
    },

    /** Makes only these layers selected (by name) and moves the time indicator (seconds). */
    async select(names, time) {
      const r = await s.ae(`(function () {
        var c = app.project.activeItem; if (!(c instanceof CompItem)) return "no comp";
        var want = ${JSON.stringify([].concat(names))}; var n = 0;
        for (var i = 1; i <= c.numLayers; i++) { var on = false; for (var k = 0; k < want.length; k++) if (c.layer(i).name === want[k]) on = true; c.layer(i).selected = on; if (on) n++; }
        ${time === undefined ? "" : `c.time = ${time};`}
        return "ok " + n;
      })()`);
      if (!/^ok/.test(r)) throw new Error(`select ${names}: ${r}`);
      await sleep(300);
    },

    /**
     * Shows the layer's keyframed properties in the Timeline, as pressing U does: the layer alone
     * selected, then After Effects' own menu command.
     */
    async reveal(layer) {
      // U shows a layer's keyframed properties and toggles: from hidden it reveals, from revealed it
      // hides. A layer revealed before (its keyframes may have changed since) gets it twice, which
      // ends revealed either way. Only for a layer with keyframes, alone: on a layer with none U does
      // nothing, and with several layers selected it opens cursors' effects.
      const times = revealed.has(layer) ? 2 : 1;
      revealed.add(layer);
      const r = await s.ae(`(function () {
        var c = app.project.activeItem; var id = app.findMenuCommandId("Reveal Properties with Keyframes");
        if (!(id > 0)) return "no reveal command";
        for (var j = 1; j <= c.numLayers; j++) c.layer(j).selected = c.layer(j).name === ${JSON.stringify(layer)};
        for (var k = 0; k < ${times}; k++) app.executeCommand(id);
        return "ok";
      })()`);
      if (!/^ok/.test(r)) throw new Error(`reveal ${layer}: ${r}`);
      await sleep(500);
    },

    /**
     * The comp's Hide Shy Layers switch: a rig's guide layers are shy, so with it on the Timeline
     * shows only the text and cursor layers.
     */
    async hideShy(on) {
      await s.ae(`(function () { app.project.activeItem.hideShyLayers = ${!!on}; return "ok"; })()`);
      await sleep(400);
    },

    /** Folds a layer revealed with reveal(). */
    async fold(layer) {
      if (!revealed.has(layer)) return;
      revealed.delete(layer);
      await s.ae(`(function () { var c = app.project.activeItem; for (var j = 1; j <= c.numLayers; j++) c.layer(j).selected = c.layer(j).name === ${JSON.stringify(layer)}; app.executeCommand(app.findMenuCommandId("Reveal Properties with Keyframes")); return "ok"; })()`);
      await sleep(400);
    },

    /** Moves the time indicator of the active comp (seconds). */
    async time(seconds) {
      await s.ae(`(function () { var c = app.project.activeItem; if (c) c.time = ${seconds}; return "ok"; })()`);
      await sleep(300);
    },

    /**
     * Builds a comp with text layers (ExtendScript, in its own call: never in the call that made the
     * project). spec: { name, width, height, duration, fps, bg: [r,g,b], texts: [{ name, text, font,
     * size, color, pos, just, box, tracking }], shapes: [{ name, size, pos, color, round }] }.
     */
    async scene(spec) {
      const r = await s.ae(`(function () {
        var sp = ${JSON.stringify(spec)};
        app.project.expressionEngine = sp.engine || "javascript-1.0";
        var comp = app.project.items.addComp(sp.name, sp.width, sp.height, 1, sp.duration, sp.fps || 30);
        comp.bgColor = sp.bg || [0.08, 0.07, 0.12];
        comp.comment = "LazyTyper manual scene";
        var bg = comp.layers.addSolid(sp.bg || [0.08, 0.07, 0.12], "Background", sp.width, sp.height, 1);
        bg.locked = true;
        var shapes = sp.shapes || [];
        for (var q = 0; q < shapes.length; q++) {
          var sh = shapes[q];
          var bar = comp.layers.addShape();
          bar.name = sh.name;
          var g = bar.property("ADBE Root Vectors Group").addProperty("ADBE Vector Group");
          g = bar.property("ADBE Root Vectors Group").property(1);
          var rect = g.property("ADBE Vectors Group").addProperty("ADBE Vector Shape - Rect");
          rect.property("ADBE Vector Rect Size").setValue(sh.size);
          rect.property("ADBE Vector Rect Roundness").setValue(sh.round || 0);
          g = bar.property("ADBE Root Vectors Group").property(1);
          var fill = g.property("ADBE Vectors Group").addProperty("ADBE Vector Graphic - Fill");
          fill.property("ADBE Vector Fill Color").setValue(sh.color);
          bar.property("ADBE Transform Group").property("ADBE Position").setValue(sh.pos);
          bar.locked = true;
        }
        var J = { left: ParagraphJustification.LEFT_JUSTIFY, center: ParagraphJustification.CENTER_JUSTIFY, right: ParagraphJustification.RIGHT_JUSTIFY };
        var texts = sp.texts || [];
        for (var i = 0; i < texts.length; i++) {
          var t = texts[i];
          var l = t.box ? comp.layers.addBoxText(t.box, t.text) : comp.layers.addText(t.text);
          l.name = t.name;
          var st = l.property("ADBE Text Properties").property("ADBE Text Document");
          var d = st.value;
          if (t.font) d.font = t.font;
          d.fontSize = t.size || 60;
          d.applyFill = true;
          d.fillColor = t.color || [0.95, 0.94, 0.98];
          d.applyStroke = false;
          d.tracking = t.tracking || 0;
          d.justification = J[t.just || "left"];
          st.setValue(d);
          l.property("ADBE Transform Group").property("ADBE Position").setValue(t.pos);
          if (t.locked) l.locked = true;
        }
        comp.openInViewer();
        for (var k = 1; k <= comp.numLayers; k++) comp.layer(k).selected = false;
        return "ok";
      })()`);
      if (r !== "ok") throw new Error(`scene ${spec.name}: ${r}`);
      revealed.clear();
      await sleep(800);
    },

    /** Sets controls on a layer: { "Variance": 100, ... } now, or at times: { "Typing": [[0, 1], [3, 0]] }. */
    async controls(layer, values) {
      const r = await s.ae(`(function () {
        var c = app.project.activeItem; var l = c.layer(${JSON.stringify(layer)}); var v = ${JSON.stringify(values)};
        app.beginUndoGroup("manual: controls");
        for (var k in v) {
          var fx = l.property("ADBE Effect Parade").property(k); if (!fx) return "no control " + k;
          var p = fx.property(1);
          if (v[k] instanceof Array && v[k].length && v[k][0] instanceof Array) { for (var i = 0; i < v[k].length; i++) p.setValueAtTime(v[k][i][0], v[k][i][1]); }
          else if (p.numKeys > 0) p.setValueAtTime(c.time, v[k]); else p.setValue(v[k]);
        }
        app.endUndoGroup();
        return "ok";
      })()`);
      if (r !== "ok") throw new Error(`controls on ${layer}: ${r}`);
    },

    /** Switches the Source Text expression of a layer off or on (the = switch in the Timeline). */
    async expression(layer, on) {
      const r = await s.ae(`(function () { var st = app.project.activeItem.layer(${JSON.stringify(layer)}).property("ADBE Text Properties").property("ADBE Text Document"); st.expressionEnabled = ${!!on}; return "ok"; })()`);
      if (r !== "ok") throw new Error(`expression switch on ${layer}: ${r}`);
      await sleep(300);
    },

    /** Keyframes Source Text of a layer with new text at a time (switching its expression off while it does). */
    async retext(layer, time, text) {
      const r = await s.ae(`(function () {
        var c = app.project.activeItem; var st = c.layer(${JSON.stringify(layer)}).property("ADBE Text Properties").property("ADBE Text Document");
        app.beginUndoGroup("manual: retext");
        var keep = st.expressionEnabled; st.expressionEnabled = false;
        if (st.numKeys === 0) st.setValueAtTime(0, st.value);
        var d = st.valueAtTime(${time}, false); d.text = ${JSON.stringify(text)}; st.setValueAtTime(${time}, d);
        st.expressionEnabled = keep;
        app.endUndoGroup();
        return "ok";
      })()`);
      if (r !== "ok") throw new Error(`retext ${layer}: ${r}`);
    },

    /**
     * A picture of the panel into docs/manual/media/<name>.png. `mark` rings controls (ids or CSS
     * selectors) with numbered badges; `clip` is a selector (or several) whose box is kept, with a margin.
     */
    async shot(name, { mark = [], clip = null, margin = 8, toast = false, keep = true } = {}) {
      await s.size();
      if (toast) await s.toastRoom(clip, margin);
      // A picture of the toast alone: the panel behind it would show at its rounded edges.
      const alone = clip === "toast";
      if (alone) await js("(document.getElementById('app').style.visibility = 'hidden', 1)");
      await js(`(function () {
        Array.prototype.forEach.call(document.querySelectorAll(".lt-manual-mark"), function (m) { m.remove(); });
        var marks = ${JSON.stringify(mark)};
        marks.forEach(function (m, i) {
          var e = document.getElementById(m) || document.querySelector(m);
          if (!e) throw new Error("nothing to mark: " + m);
          var r = e.getBoundingClientRect();
          var ring = document.createElement("div");
          ring.className = "lt-manual-mark";
          ring.style.cssText = "position:absolute;box-sizing:border-box;z-index:99999;pointer-events:none;border:2px solid ${MARK};border-radius:7px;left:" + (r.left + window.scrollX - 2) + "px;top:" + (r.top + window.scrollY - 2) + "px;width:" + (r.width + 4) + "px;height:" + (r.height + 4) + "px";
          if (marks.length > 1) {
            var b = document.createElement("div");
            b.textContent = String(i + 1);
            b.style.cssText = "position:absolute;right:-8px;top:-8px;width:16px;height:16px;border-radius:8px;background:${MARK};color:#fff;font:bold 11px/16px Segoe UI,sans-serif;text-align:center;box-shadow:0 0 0 2px rgba(0,0,0,.55)";
            ring.appendChild(b);
          }
          document.body.appendChild(ring);
        });
        return 1;
      })()`);
      await sleep(200);
      const box = await s.clipBox(clip, margin, toast);
      const params = { format: "png", captureBeyondViewport: true, clip: { ...box, scale: 1 } };
      const result = await panel.send("Page.captureScreenshot", params);
      if (alone) await js("(document.getElementById('app').style.visibility = '', 1)");
      await js(`(Array.prototype.forEach.call(document.querySelectorAll(".lt-manual-mark"), function (m) { m.remove(); }), 1)`);
      const file = path.join(keep ? media : work, `${name}.png`);
      fs.writeFileSync(file, Buffer.from(result.data, "base64"));
      if (keep) console.log(`  ${path.relative(root, file)}`);
      return file;
    },

    /** The page box (CSS px) around the elements matching `clip` (ids or selectors), or the whole panel. */
    async clipBox(clip, margin = 8, toEnd = false) {
      return js(`(function () {
        var H = window.innerHeight;
        var sel = ${JSON.stringify(clip ? [].concat(clip) : null)};
        var W = document.documentElement.clientWidth;
        if (!sel) { var app = document.getElementById("app"); var r0 = app.getBoundingClientRect(); return { x: 0, y: 0, width: W, height: Math.ceil(r0.bottom + window.scrollY + 6) }; }
        var x0 = 1e9, y0 = 1e9, x1 = -1e9, y1 = -1e9;
        sel.forEach(function (q) { var e = document.getElementById(q) || document.querySelector(q); if (!e) throw new Error("nothing to clip: " + q); var r = e.getBoundingClientRect(); x0 = Math.min(x0, r.left); y0 = Math.min(y0, r.top + window.scrollY); x1 = Math.max(x1, r.right); y1 = Math.max(y1, r.bottom + window.scrollY); });
        var m = ${margin};
        var top = Math.max(0, Math.floor(y0 - m));
        return { x: 0, y: top, width: W, height: ${toEnd} ? H - top : Math.ceil(y1 - y0 + 2 * m) };
      })()`);
    },

    /** Makes the panel end just below `clip`, so a toast shows right under it. */
    async toastRoom(clip, margin = 8) {
      const box = await s.clipBox(clip, margin);
      await s.size(Math.ceil(box.y + box.height + TOAST_ROOM));
    },

    /**
     * A drawn pointer over the panel, for GIFs of the panel: moves to an element in `ms`, and with
     * `press` shows the click. Only for pictures; the click itself is s.click().
     */
    async pointTo(target, { ms = 450, press = false } = {}) {
      await js(`(function () {
        var p = document.getElementById("lt-manual-pointer");
        if (!p) {
          p = document.createElement("div");
          p.id = "lt-manual-pointer";
          p.innerHTML = '<svg width="22" height="26" viewBox="0 0 22 26"><path d="M2 2 L2 20 L7 15.5 L10.5 23 L13.6 21.6 L10.2 14.3 L17 14.3 Z" fill="#fff" stroke="#111" stroke-width="1.6" stroke-linejoin="round"/></svg><i></i>';
          p.style.cssText = "position:absolute;z-index:100000;pointer-events:none;left:" + (document.documentElement.clientWidth - 40) + "px;top:40px;transition:left ${ms}ms ease-in-out, top ${ms}ms ease-in-out";
          var ring = p.querySelector("i");
          ring.style.cssText = "position:absolute;left:-9px;top:-9px;width:20px;height:20px;border-radius:12px;border:2px solid ${MARK};opacity:0;transform:scale(.4);transition:all 260ms ease-out";
          document.body.appendChild(p);
        }
        p.style.transition = "left ${ms}ms ease-in-out, top ${ms}ms ease-in-out";
        var t = ${JSON.stringify(target)};
        var e = document.getElementById(t) || document.querySelector(t);
        if (!e) throw new Error("nothing to point at: " + t);
        var r = e.getBoundingClientRect();
        p.style.left = Math.round(r.left + Math.min(r.width * 0.5, 60)) + "px";
        p.style.top = Math.round(r.top + window.scrollY + r.height * 0.55) + "px";
        return 1;
      })()`);
      await sleep(ms + 60);
      if (press) {
        await js(`(function () { var i = document.querySelector("#lt-manual-pointer i"); i.style.opacity = "1"; i.style.transform = "scale(1.3)"; setTimeout(function () { i.style.opacity = "0"; i.style.transform = "scale(.4)"; }, 320); return 1; })()`);
        await sleep(200);
      }
    },

    async hidePointer() {
      await js(`(function () { var p = document.getElementById("lt-manual-pointer"); if (p) p.remove(); return 1; })()`);
    },

    /**
     * Records the panel (or the box around `clip`) while `action` runs, as media/<name>.gif: for
     * showing what a click or a choice does in the panel itself.
     */
    async record(name, action, { clip = null, fps = 10, width = 680, colors = 64, tail = 900, margin = 8, toast = false } = {}) {
      await s.size();
      if (toast) await s.toastRoom(clip, margin);
      const frames = path.join(work, `rec-${name}`);
      fs.rmSync(frames, { recursive: true, force: true });
      fs.mkdirSync(frames, { recursive: true });
      let n = 0;
      let done = false;
      const box = await s.clipBox(clip, margin, toast);
      const params = { format: "png", captureBeyondViewport: true, clip: { ...box, scale: 1 } };
      const loop = (async () => {
        while (!done) {
          const started = Date.now();
          const shot = await panel.send("Page.captureScreenshot", params);
          fs.writeFileSync(path.join(frames, `f${String(n++).padStart(4, "0")}.png`), Buffer.from(shot.data, "base64"));
          await sleep(Math.max(0, 1000 / fps - (Date.now() - started)));
        }
      })();
      try {
        await action();
        await sleep(tail);
      } finally {
        done = true;
        await loop;
        await s.hidePointer();
      }
      return encodeGif(name, { dir: frames, fps, width, colors, pattern: "f%04d.png" });
    },

    /**
     * A picture of After Effects' own window (PrintWindow: nothing else on the screen) cropped to
     * one panel: `panel` is "timeline", "effects" or "viewer" (see findPanel); `crop` [x, y, w, h]
     * trims it further, relative to that panel; `scale` resizes; `controls` rings those controls
     * of a text layer's rig in Effect Controls.
     *
     * A Timeline is wider than a page can show readably, so with `slice: [t0, t1]` (seconds, or
     * several such ranges) the picture keeps the layer columns (up to Parent & Link) and only those
     * stretches of time, side by side with a visible break before each; `height` keeps the top rows.
     */
    async aeShot(name, { panel: which = null, crop = null, scale = 1, keep = true, slice = null, height = null, controls = [], columns = TIMELINE_COLUMNS } = {}) {
      if (which === "effects") await s.showEffects();
      // The comp's Timeline to the front of its frame (a render puts the Render Queue there).
      if (which === "timeline") await s.ae("(function () { var c = app.project.activeItem; if (c instanceof CompItem) c.openInViewer(); return 'ok'; })()");
      await sleep(700);
      const full = path.join(work, `${name}-window.png`);
      const kids = path.join(work, `${name}-window.json`);
      const out = ps(path.join(here, "ae-window.ps1"), [full, kids]).trim().split(/\r?\n/).pop();
      if (!/^ok/.test(out)) throw new Error(`picture of After Effects: ${out}`);
      let rect = null;
      if (which) {
        const list = JSON.parse(fs.readFileSync(kids, "utf8").replace(/^\uFEFF/, ""));
        const hit = findPanel(list, which);
        if (!hit) throw new Error(`no After Effects panel "${which}" in this workspace`);
        rect = { x: hit.x, y: hit.y, w: hit.w, h: hit.h };
      }
      const file = path.join(keep ? media : work, `${name}.png`);
      if (slice && which === "timeline") {
        const dur = Number(await s.ae("(function () { return String(app.project.activeItem.duration); })()"));
        const panelFile = path.join(work, `${name}-panel.png`);
        execFileSync("ffmpeg", ["-v", "error", "-y", "-i", full, "-vf", `crop=${rect.w}:${rect.h}:${rect.x}:${rect.y}`, panelFile]);
        // The work-area bar spans the whole comp (a new comp's work area is all of it): row 68 of the panel.
        const row = execFileSync("ffmpeg", ["-v", "error", "-i", panelFile, "-vf", `crop=${rect.w}:1:0:68,format=gray`, "-f", "rawvideo", "-"]);
        // The longest grey run on that row (icons in the columns cross it too).
        let a = -1;
        let b = -1;
        for (let x = 0, st = -1; x <= row.length; x++) {
          const on = x < row.length && row[x] > 70 && row[x] < 140;
          if (on && st < 0) st = x;
          if (!on && st >= 0) { if (x - 1 - st > b - a) { a = st; b = x - 1; } st = -1; }
        }
        if (a < 0 || b - a < 200) throw new Error("no work-area bar in the Timeline picture");
        const X = (t) => Math.round(a + ((b - a) * t) / dur);
        const h = height ?? rect.h;
        const left = columns;
        const ranges = Array.isArray(slice[0]) ? slice : [slice];
        const parts = ["[0:v]crop=" + left + ":" + h + ":0:0[c0]"];
        const order = ["[c0]"];
        ranges.forEach(([t0, t1], i) => {
          const x0 = Math.max(0, X(t0) - 6);
          parts.push(`[0:v]crop=${X(t1) + 6 - x0}:${h}:${x0}:0[r${i}]`);
          parts.push(`color=c=0x0b0b0b:s=10x${h}:d=1,drawbox=x=4:y=0:w=2:h=ih:color=0x5a5a5a:t=fill[g${i}]`);
          order.push(`[g${i}]`, `[r${i}]`);
        });
        execFileSync("ffmpeg", ["-v", "error", "-y", "-i", panelFile,
          "-filter_complex", `${parts.join(";")};${order.join("")}hstack=inputs=${order.length}`, "-frames:v", "1", file]);
        if (keep) console.log(`  ${path.relative(root, file)} (columns + ${ranges.map((r) => r.join("-")).join(", ")} s)`);
        // Where time t lands in the picture (x), for drawing a pointer on it.
        const place = (t) => {
          let x = left;
          for (const [t0, t1] of ranges) {
            const x0 = Math.max(0, X(t0) - 6);
            if (t >= t0 && t <= t1) return x + 10 + X(t) - x0;
            x += 10 + X(t1) + 6 - x0;
          }
          return null;
        };
        return { file, window: full, children: kids, place };
      }
      // Rings around the named controls in Effect Controls: each expression control takes two rows
      // (its name and its value), 38 px from y = 47 under the panel's tab, in the rig's order.
      const order = [...RIG.TEXT_CONTROLS.map((c) => c.name)];
      const rings = which === "effects" ? controls.map((n) => {
        const k = order.indexOf(n);
        if (k < 0) throw new Error(`no control ${n}`);
        return `drawbox=x=3:y=${45 + 38 * k}:w=${rect.w - 22}:h=40:color=0xff6a2b:t=2`;
      }) : [];
      const vf = [rect ? `crop=${rect.w}:${rect.h}:${rect.x}:${rect.y}` : null, ...rings,
        crop ? `crop=${crop[2]}:${crop[3]}:${crop[0]}:${crop[1]}` : null,
        scale !== 1 ? `scale=iw*${scale}:-2:flags=lanczos` : null].filter(Boolean).join(",") || "null";
      execFileSync("ffmpeg", ["-v", "error", "-y", "-i", full, "-vf", vf, file]);
      if (keep) console.log(`  ${path.relative(root, file)}`);
      return { file, window: full, children: kids };
    },

    /**
     * Renders the active comp (or `comp`) from `start` for `duration` seconds to frames through the
     * render queue, then encodes media/<name>.gif. `crop` [x, y, w, h] in comp pixels.
     */
    async gif(name, { comp = "", start = 0, duration = 4, fps = 30, width = 720, colors = 48, crop = null, swatch = [] } = {}) {
      const frames = path.join(work, name);
      fs.rmSync(frames, { recursive: true, force: true });
      fs.mkdirSync(frames, { recursive: true });
      const target = path.join(frames, "f_[####].tif").replace(/\\/g, "/");
      const result = await s.ae(`(function () {
        var c = ${JSON.stringify(comp)} ? null : app.project.activeItem;
        if (!c) for (var i = 1; i <= app.project.numItems; i++) { var it = app.project.item(i); if (it instanceof CompItem && it.name === ${JSON.stringify(comp)}) { c = it; break; } }
        if (!(c instanceof CompItem)) return "error: no comp";
        var rq = app.project.renderQueue.items.add(c);
        try {
          rq.timeSpanStart = ${start};
          rq.timeSpanDuration = ${duration};
          rq.setSettings({ "Resolution": "Full", "Use this frame rate": ${fps} });
          var om = rq.outputModule(1);
          om.applyTemplate("TIFF Sequence with Alpha");
          om.file = new File(${JSON.stringify(target)});
          app.project.renderQueue.render();
        } finally {
          try { rq.remove(); } catch (e) {}
        }
        // The Render Queue comes to the front of the Timeline's frame; the comp goes back there.
        c.openInViewer();
        return "ok " + c.name;
      })()`);
      if (!/^ok/.test(result ?? "")) throw new Error(`render of ${name}: ${result}`);
      const list = fs.readdirSync(frames).filter((f) => f.endsWith(".tif")).sort();
      if (!list.length) throw new Error(`render of ${name} wrote no frames`);
      const first = list[0].match(/(\d+)\.tif$/)[1];
      return encodeGif(name, { dir: frames, fps, width, colors, crop, swatch, pattern: list[0].replace(/\d+\.tif$/, `%0${first.length}d.tif`), startNumber: Number(first) });
    },

    /** A still of one frame of the active comp (or `comp`) into media/<name>.png. */
    async still(name, { time = 0, comp = "", width = 1280, crop = null, keep = true } = {}) {
      const file = path.join(work, `${name}-still.png`).replace(/\\/g, "/");
      fs.rmSync(file, { force: true });
      const result = await s.ae(`(function () {
        var c = ${JSON.stringify(comp)} ? null : app.project.activeItem;
        if (!c) for (var i = 1; i <= app.project.numItems; i++) { var it = app.project.item(i); if (it instanceof CompItem && it.name === ${JSON.stringify(comp)}) { c = it; break; } }
        if (!(c instanceof CompItem)) return "error: no comp";
        var keep = c.resolutionFactor; c.resolutionFactor = [1, 1];
        try { c.saveFrameToPng(${time}, new File(${JSON.stringify(file)})); } finally { c.resolutionFactor = keep; }
        return "ok";
      })()`);
      if (result !== "ok") throw new Error(`still of ${name}: ${result}`);
      for (let i = 0; i < 120 && !fs.existsSync(file); i++) await sleep(500);
      await sleep(500);
      const out = path.join(keep ? media : work, `${name}.png`);
      const vf = [crop ? `crop=${crop[2]}:${crop[3]}:${crop[0]}:${crop[1]}` : null, `scale=${width}:-2:flags=lanczos`].filter(Boolean).join(",");
      execFileSync("ffmpeg", ["-v", "error", "-y", "-i", file, "-vf", vf, out]);
      fs.rmSync(file, { force: true });
      if (keep) console.log(`  ${path.relative(root, out)}`);
      return out;
    },

    /** The project's expression engine: "javascript-1.0" or "extendscript" (Legacy ExtendScript). */
    async engine(name) {
      await s.ae(`(function () { app.project.expressionEngine = ${JSON.stringify(name)}; return "ok"; })()`);
      await sleep(400);
    },

    /**
     * Changes a text layer's style or text as a designer does in the Character panel: every Source
     * Text keyframe (or the text itself), with its expression switched off meanwhile. props: font,
     * fontSize, tracking, fillColor, justification ("left", "center", "right"), text.
     */
    async textDoc(layer, props) {
      const r = await s.ae(`(function () {
        var st = app.project.activeItem.layer(${JSON.stringify(layer)}).property("ADBE Text Properties").property("ADBE Text Document");
        var p = ${JSON.stringify(props)};
        var J = { left: ParagraphJustification.LEFT_JUSTIFY, center: ParagraphJustification.CENTER_JUSTIFY, right: ParagraphJustification.RIGHT_JUSTIFY };
        app.beginUndoGroup("manual: text");
        var keep = st.expressionEnabled; st.expressionEnabled = false;
        function apply(d) { for (var k in p) { if (k === "justification") d.justification = J[p[k]]; else if (k === "fillColor") { d.applyFill = true; d.fillColor = p[k]; } else d[k] = p[k]; } return d; }
        if (st.numKeys > 0) { for (var i = 1; i <= st.numKeys; i++) st.setValueAtKey(i, apply(st.keyValue(i))); }
        else st.setValue(apply(st.value));
        st.expressionEnabled = keep;
        app.endUndoGroup();
        return "ok";
      })()`);
      if (r !== "ok") throw new Error(`text of ${layer}: ${r}`);
      await sleep(300);
    },

    /** Adds a layer marker; frames > 0 gives it a duration. Returns its index. */
    async marker(layer, time, comment, frames = 0) {
      return s.ae(`(function () {
        var c = app.project.activeItem; var m = new MarkerValue(${JSON.stringify(comment)});
        if (${frames} > 0) m.duration = ${frames} * c.frameDuration;
        var p = c.layer(${JSON.stringify(layer)}).property("ADBE Marker"); p.setValueAtTime(${time}, m);
        return String(p.nearestKeyIndex(${time}));
      })()`);
    },

    /** Sets the duration (frames) of a layer's marker number `index`, as dragging its end does. */
    async markerFrames(layer, index, frames) {
      await s.ae(`(function () {
        var c = app.project.activeItem; var p = c.layer(${JSON.stringify(layer)}).property("ADBE Marker");
        var t = p.keyTime(${index}); var m = p.keyValue(${index}); m.duration = ${frames} * c.frameDuration;
        p.setValueAtTime(t, m); return "ok";
      })()`);
    },

    /**
     * A GIF of After Effects' Timeline (or another panel) as it changes: `steps` is a list of
     * functions run one after another, each followed by a picture (aeShot options in `shot`).
     * `pointer(i, picture)` may return { x, y } to draw the pointer there, on the picture's own
     * pixels: the change is made by a script, the pointer shows where a hand would do it.
     */
    async aeGif(name, { steps, shot = {}, pointer = null, fps = 6, hold = 6 } = {}) {
      const dir = path.join(work, `seq-${name}`);
      fs.rmSync(dir, { recursive: true, force: true });
      fs.mkdirSync(dir, { recursive: true });
      let n = 0;
      const pointerPng = path.join(here, "pointer.png");
      for (let i = 0; i < steps.length; i++) {
        await steps[i]();
        const pic = await s.aeShot(`${name}-step`, { ...shot, keep: false });
        const at = pointer ? pointer(i, pic) : null;
        const out = path.join(dir, `f${String(n++).padStart(4, "0")}.png`);
        if (at) execFileSync("ffmpeg", ["-v", "error", "-y", "-i", pic.file, "-i", pointerPng, "-filter_complex", `[1:v]scale=22:-1[p];[0:v][p]overlay=${Math.round(at.x - 2)}:${Math.round(at.y - 2)}`, out]);
        else fs.copyFileSync(pic.file, out);
        // The last picture stays a while.
        if (i === steps.length - 1) for (let k = 0; k < hold; k++) fs.copyFileSync(out, path.join(dir, `f${String(n++).padStart(4, "0")}.png`));
      }
      const w = Number(execFileSync("ffprobe", ["-v", "error", "-select_streams", "v:0", "-show_entries", "stream=width", "-of", "csv=p=0", path.join(dir, "f0000.png")], { encoding: "utf8" }).trim());
      return encodeGif(name, { dir, fps, width: w, colors: 64, pattern: "f%04d.png" });
    },

    /** Pictures (files) stacked top to bottom with a thin gap, into media/<name>.png. */
    stack(name, files, { gap = 8, color = "0x15131f" } = {}) {
      const out = path.join(media, `${name}.png`);
      const w = Math.max(...files.map((f) => Number(execFileSync("ffprobe", ["-v", "error", "-show_entries", "stream=width", "-of", "csv=p=0", f], { encoding: "utf8" }).trim())));
      const parts = files.map((_, i) => `[${i}:v]pad=${w}:ih+${gap}:0:0:color=${color}[p${i}]`).join(";");
      execFileSync("ffmpeg", ["-v", "error", "-y", ...files.flatMap((f) => ["-i", f]), "-filter_complex", `${parts};${files.map((_, i) => `[p${i}]`).join("")}vstack=inputs=${files.length}`, "-frames:v", "1", out]);
      console.log(`  ${path.relative(root, out)}`);
      return out;
    },

    /** Stills of the active comp side by side (or stacked, `rows`), a label under each, into media/<name>.png. */
    async strip(name, frames, { width = 1280, rows = false } = {}) {
      const files = [];
      for (const [i, f] of frames.entries()) files.push(await s.still(`${name}-part${i}`, { ...f, width: rows ? width : Math.round(width / frames.length), keep: false }));
      // Labels go through files: drawtext would read a colon as the end of an option.
      const labelFile = (i) => {
        const file = path.join(work, `${name}-label${i}.txt`);
        fs.writeFileSync(file, frames[i].label ?? "");
        return file.replace(/\\/g, "/").replace(/:/g, "\\:");
      };
      const labelled = frames.map((f, i) => !f.label ? `[${i}:v]null[l${i}]` : `[${i}:v]drawbox=y=ih-30:w=iw:h=30:color=black@0.55:t=fill,drawtext=textfile='${labelFile(i)}':fontfile='C\\:/Windows/Fonts/segoeui.ttf':fontsize=17:fontcolor=white:x=(w-tw)/2:y=h-24[l${i}]`).join(";");
      const out = path.join(media, `${name}.png`);
      execFileSync("ffmpeg", ["-v", "error", "-y", ...files.flatMap((f) => ["-i", f]), "-filter_complex", frames.length === 1 ? `${labelled};[l0]null` : `${labelled};${frames.map((_, i) => `[l${i}]`).join("")}${rows ? "vstack" : "hstack"}=inputs=${frames.length}`, out]);
      for (const f of files) fs.rmSync(f, { force: true });
      console.log(`  ${path.relative(root, out)}`);
      return out;
    },

    /**
     * A picture of Effect Controls for `layer` (selected first) with `controls` ringed, scrolled so
     * they show: Effect Controls only shows about 16 controls, so the panel is scrolled by posting
     * mouse-wheel messages to its window (ae-wheel.ps1: no focus taken, the real pointer never
     * moves). How far it scrolled is measured, not guessed: the scrolled picture is matched against
     * the unscrolled one. Each control takes two rows, 38 px, from y = 45 under the tab. The picture
     * keeps the panel's top (tab and layer name) and the controls from `context` before the first
     * ringed one to `context` after the last, with a grey break where rows are left out.
     */
    async effectsShot(name, { layer, controls = [], context = 1, upTo = null } = {}) {
      await s.select([layer]);
      await s.showEffects();
      const names = (await s.ae(`(function () { var p = app.project.activeItem.layer(${JSON.stringify(layer)}).property("ADBE Effect Parade"); var o = []; for (var i = 1; i <= p.numProperties; i++) o.push(p.property(i).name); return o.join("|"); })()`)).split("|");
      const idx = controls.map((n) => { const k = names.indexOf(n); if (k < 0) throw new Error(`no effect ${n} on ${layer}`); return k; });
      const first = Math.max(0, Math.min(...(idx.length ? idx : [0])) - context);
      const last = Math.min(names.length - 1, upTo !== null ? names.indexOf(upTo) : Math.max(...(idx.length ? idx : [0])) + context);
      // Later pictures use the same frame window as the first (After Effects may resize its frames
      // in between), and must find it the same size, or the rows would not line up.
      const grab = async (tag, same = null) => {
        const full = path.join(work, `${name}-${tag}.png`);
        const kids = path.join(work, `${name}-${tag}.json`);
        ps(path.join(here, "ae-window.ps1"), [full, kids]);
        const list = JSON.parse(fs.readFileSync(kids, "utf8").replace(/^\uFEFF/, ""));
        const f = same ? list.find((k) => k.hwnd === same.hwnd) : findPanel(list, "effects");
        if (!f || (same && (f.w !== same.w || f.h !== same.h))) throw new Error("Effect Controls changed size between pictures; try again");
        const panelFile = path.join(work, `${name}-${tag}-panel.png`);
        execFileSync("ffmpeg", ["-v", "error", "-y", "-i", full, "-vf", `crop=${f.w}:${f.h}:${f.x}:${f.y}`, panelFile]);
        const gray = execFileSync("ffmpeg", ["-v", "error", "-i", panelFile, "-vf", "format=gray", "-f", "rawvideo", "-"]);
        return { f, panelFile, gray };
      };
      const wheel = async (f, notches) => { ps(path.join(here, "ae-wheel.ps1"), [f.hwnd, f.x + Math.round(f.w / 2), f.y + Math.round(f.h / 2), notches]); await sleep(900); };
      let top = await grab("top");
      await wheel(top.f, 60);
      top = await grab("top", top.f);
      const H = top.f.h;
      const W = top.f.w;
      let shot = top;
      let d = 0;
      if (45 + 38 * (last + 1) > H - 4) {
        await wheel(top.f, -60);
        shot = await grab("bottom", top.f);
        // The shift d at which the scrolled rows line up with the unscrolled ones.
        let best = Infinity;
        for (let k = 0; k < H - 160; k++) {
          let sum = 0;
          let n = 0;
          for (let y = 45; y + k < H - 4; y += 2) for (let x = 30; x < W - 40; x += 6) { sum += Math.abs(shot.gray[y * W + x] - top.gray[(y + k) * W + x]); n++; }
          if (n > 4000 && sum / n < best) { best = sum / n; d = k; }
        }
        if (45 + 38 * first - d < 45) throw new Error(`${controls.join(", ")} do not fit in Effect Controls at once`);
      }
      const y0 = 45 + 38 * first - d;
      const y1 = Math.min(H - 2, 45 + 38 * (last + 1) - d + 2);
      const rings = idx.map((k) => `drawbox=x=3:y=${45 + 38 * k - d}:w=${W - 22}:h=40:color=0xff6a2b:t=2`);
      const file = path.join(media, `${name}.png`);
      const body = `[0:v]${rings.length ? rings.join(",") + "," : ""}split=2[a][b];[a]crop=${W}:45:0:0[hd];[b]crop=${W}:${y1 - y0}:0:${y0}[bd]`;
      const join = y0 > 46 ? `;color=c=0x0b0b0b:s=${W}x10:d=1,drawbox=x=0:y=4:w=iw:h=2:color=0x5a5a5a:t=fill[g];[hd][g][bd]vstack=inputs=3` : ";[hd][bd]vstack=inputs=2";
      execFileSync("ffmpeg", ["-v", "error", "-y", "-i", shot.panelFile, "-filter_complex", body + join, "-frames:v", "1", file]);
      console.log(`  ${path.relative(root, file)}${d ? ` (scrolled ${d} px)` : ""}`);
      return file;
    },

    /**
     * Brings Effect Controls to the front of its frame. Window > Effect Controls (command 2163)
     * toggles the panel and no script can read whether it shows, so the picture tells: the front
     * tab of the frame has a white underline at row 25, long under "Effect Controls <layer>" and
     * short under "Properties", wherever the tab sits.
     */
    async showEffects() {
      const front = () => {
        const full = path.join(work, "effects-check.png");
        const kids = path.join(work, "effects-check.json");
        ps(path.join(here, "ae-window.ps1"), [full, kids]);
        const f = findPanel(JSON.parse(fs.readFileSync(kids, "utf8").replace(/^\uFEFF/, "")), "effects");
        const row = execFileSync("ffmpeg", ["-v", "error", "-i", full, "-vf", `crop=${f.w}:1:${f.x}:${f.y + 25},format=gray`, "-f", "rawvideo", "-"]);
        let run = 0;
        let best = 0;
        for (const v of row) { run = v > 150 ? run + 1 : 0; best = Math.max(best, run); }
        return best > 110;
      };
      for (let i = 0; i < 3; i++) {
        if (front()) return;
        await s.ae("(function () { app.executeCommand(2163); return 'ok'; })()");
        await sleep(800);
      }
      if (!front()) throw new Error("Effect Controls did not come to the front");
    },

    /** Lets the panel be its own size again and closes the connection. */
    async close() {
      try {
        await panel.send("Emulation.clearDeviceMetricsOverride", {});
      } catch {
        // The panel may have gone.
      }
      panel.close();
    }
  };
  await s.size();
  return s;
}

/**
 * One of After Effects' panel frames, from the child windows ae-window.ps1 lists (their titles are
 * all "DroverLord - Frame Window", so they are told apart by place, in the Default workspace):
 * "timeline" is the widest frame in the lower half, "effects" the second frame from the left in
 * the top row (Effect Controls shares it with Properties), "viewer" the widest frame in the top row.
 */
export function findPanel(list, which) {
  const frames = list.filter((k) => /Frame Window/.test(k.title));
  const maxY = Math.max(...frames.map((f) => f.y + f.h));
  const top = frames.filter((f) => f.y < maxY / 3 && f.h > 200).sort((a, b) => a.x - b.x);
  if (which === "timeline") return frames.filter((f) => f.y > maxY / 3).sort((a, b) => b.w - a.w)[0];
  if (which === "effects") return top[1];
  if (which === "viewer") return [...top].sort((a, b) => b.w - a.w)[0];
  throw new Error(`unknown panel ${which}`);
}

/**
 * Gives After Effects a new, empty project in a script run of its own (tools/manual/ae/fresh.jsx
 * saves a copy of an open project with items first, unless it is the manual's own scratch), then
 * reloads the panel so nothing carries over from the last chapter. Now and then After Effects turns
 * the -r script away right after a chapter (no box, nothing run); then it is sent once more.
 */
export async function freshProject(s) {
  let r;
  try {
    r = aeRun(path.join(here, "ae", "fresh.jsx"), "fresh.json", 300);
  } catch {
    await sleep(5000);
    if (aeDialogs().length) throw new Error("After Effects shows a message box; close it first");
    r = aeRun(path.join(here, "ae", "fresh.jsx"), "fresh.json", 300);
  }
  if (!r.ok) throw new Error(`fresh project: ${r.error}`);
  if (r.backup) console.log(`  the open project was backed up to ${r.backup}`);
  await sleep(1500);
  // A new project opens Sohan's template (a comp, folders, the Legacy engine): this scratch project
  // starts empty instead, in the JavaScript engine. A call of its own, not the one that made it.
  await s.ae("(function () { var p = app.project; for (var i = p.numItems; i >= 1; i--) { try { p.item(i).remove(); } catch (e) {} } p.expressionEngine = 'javascript-1.0'; return String(p.numItems); })()");
  await sleep(800);
  await s.js("(location.reload(), 1)").catch(() => undefined);
  for (let i = 0; i < 40; i++) {
    await sleep(500);
    const ready = await s.js("!!window.LazyTyperPanel").catch(() => false);
    if (ready) break;
  }
  await s.size();
  await sleep(800);
}

/**
 * Encodes frames into media/<name>.gif: one palette for the whole clip (a swatch of key colours
 * keeps thin ones such as the cursor), no dither, no dropped frames, so a 30 fps clip keeps the
 * typing rhythm (GIF delays alternate 3 and 4 hundredths). Steps down in colours, then in width,
 * until it is within BUDGET_MB.
 */
export const BUDGET_MB = 1.5;
export function encodeGif(name, { dir = path.join(work, name), pattern, startNumber = 0, fps = 30, width = 720, colors = 48, crop = null, swatch = [] } = {}) {
  const palette = path.join(dir, "palette.png");
  const out = path.join(media, `${name}.gif`);
  const input = ["-start_number", String(startNumber), "-framerate", String(fps), "-i", path.join(dir, pattern)];
  const ffmpeg = (...args) => execFileSync("ffmpeg", ["-v", "error", "-y", ...args], { stdio: "inherit" });
  const swatchFile = path.join(dir, "swatch.png");
  const first = path.join(dir, pattern.replace(/%0(\d)d/, (_, n) => String(startNumber).padStart(Number(n), "0")));
  const [srcW, srcH] = execFileSync("ffprobe", ["-v", "error", "-select_streams", "v:0", "-show_entries", "stream=width,height", "-of", "csv=p=0", first], { encoding: "utf8" }).trim().split(",").map(Number);
  const encode = (w, c) => {
    const pre = `${crop ? `crop=${crop[2]}:${crop[3]}:${crop[0]}:${crop[1]},` : ""}scale=${w}:-2:flags=lanczos,setsar=1,format=rgb24`;
    if (swatch.length) {
      // The swatch is drawn at the clip's own size, so palettegen sees it as one more frame.
      const h = 2 * Math.round(((crop ? crop[3] : srcH) * w) / (crop ? crop[2] : srcW) / 2);
      const stripe = Math.ceil(w / swatch.length);
      ffmpeg(...swatch.flatMap((c) => ["-f", "lavfi", "-i", `color=c=0x${c.replace("#", "")}:s=${stripe}x${h}:d=1`]),
        "-filter_complex", `${swatch.length > 1 ? `hstack=inputs=${swatch.length},` : ""}crop=${w}:${h}:0:0`, "-frames:v", "1", swatchFile);
      ffmpeg(...input, "-loop", "1", "-t", "1", "-framerate", String(fps), "-i", swatchFile,
        "-filter_complex", `[0:v]${pre}[a];[1:v]setsar=1,format=rgb24[b];[a][b]concat=n=2:v=1,palettegen=max_colors=${c}:stats_mode=full`, palette);
    } else {
      ffmpeg(...input, "-vf", `${pre},palettegen=max_colors=${c}:stats_mode=full`, palette);
    }
    ffmpeg(...input, "-i", palette, "-lavfi", `[0:v]${pre}[v];[v][1:v]paletteuse=dither=none:diff_mode=rectangle`, "-loop", "0", out);
    return fs.statSync(out).size / 1e6;
  };
  let mb = encode(width, colors);
  for (const [w, c] of [[width, 32], [Math.round(width * 0.85), 32], [Math.round(width * 0.75), 24]]) {
    if (mb <= BUDGET_MB) break;
    mb = encode(w, c);
  }
  const count = fs.readdirSync(dir).filter((f) => /\.(png|tif)$/.test(f) && !/palette|swatch/.test(f)).length;
  console.log(`  ${path.relative(root, out)} ${mb.toFixed(2)} MB, ${count} frames at ${fps} fps`);
  return out;
}
