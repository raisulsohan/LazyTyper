// Timing charts for the manual, computed with the real typing engine (client/engine.js, the same
// function the rigs run in After Effects, which npm run test:ae checks frame for frame) and drawn
// in headless Edge. Each chart says it is a chart.
//
// Chapter scripts call these from their `charts(c)` export; tools/manual/capture.mjs --charts runs
// them without After Effects.

import path from "node:path";
import { createRequire } from "node:module";
import { media } from "./session.mjs";

const require = createRequire(import.meta.url);
const { lazyTyperRun } = require("../../client/engine.js");
export const RIG = require("../../client/rig.js");

/** Every text control at its default, then `values` on top (numbers, or functions of time). */
export function controls(values = {}) {
  const v = {};
  for (const c of RIG.TEXT_CONTROLS) v[c.name] = c.value;
  return Object.assign(v, values);
}

/**
 * When each character of `text` appears: [{ c, frame }] for every character, frame counted from the
 * layer's start, at `fps`. Uses the engine's record mode, exactly as Bake does.
 */
export function keystrokes(text, values = {}, { fps = 30, pauses = [], seconds = 120 } = {}) {
  const v = controls(values);
  const fd = 1 / fps;
  const log = lazyTyperRun({
    time: seconds, fd, start: 0, record: true, pauses,
    num: (n, t) => (typeof v[n] === "function" ? v[n](t) : v[n]),
    text: () => text
  });
  const out = [];
  let shown = 0;
  for (const [t, count] of log) {
    while (shown < count) out.push({ c: text.charAt(shown++), frame: Math.round(t / fd) });
  }
  return out;
}

/**
 * How long each character takes relative to the base speed (the engine's weight): measured with
 * the engine itself at 1000 frames per character, where rounding to whole frames no longer matters.
 */
export function weights(text, values = {}) {
  const ks = keystrokes(text, { ...values, "Speed Mode": 1, "Frames Per Character": 1000 }, { fps: 30, seconds: text.length * 25000 / 30 });
  if (ks.length !== text.length) throw new Error(`weights: only ${ks.length} of ${text.length} characters typed`);
  return ks.map((k, i) => (i === 0 ? 1 : (k.frame - ks[i - 1].frame) / 1000));
}

export function classOf(c) {
  if (c === " " || c === "\r" || c === "\n" || c === "\t" || c === "\u0003") return "spaces";
  if (c >= "0" && c <= "9") return "numbers";
  if (c.toLowerCase() !== c.toUpperCase() || c.charCodeAt(0) > 127) return "letters";
  return "punct";
}

const COLORS = { letters: "#a78bfa", numbers: "#fbbf24", punct: "#f472b6", spaces: "#34d399", mark: "#ff6a2b" };

const PAGE = (body, script) => `<!doctype html><html><head><meta charset="utf-8"><style>
  html, body { margin: 0; background: #15131f; color: #f1effa; font: 15px/1.35 "Segoe UI", Arial, sans-serif; }
  .wrap { padding: 22px 26px 20px; }
  h1 { font-size: 19px; margin: 0 0 3px; font-weight: 600; }
  .sub { color: #c3bedb; font-size: 13.5px; margin-bottom: 16px; }
  .tag { display: inline-block; font-size: 11px; letter-spacing: .06em; text-transform: uppercase; color: #8d87a8; border: 1px solid #463f66; border-radius: 4px; padding: 1px 6px; margin-right: 8px; vertical-align: 2px; }
  .row { display: grid; grid-template-columns: 210px 1fr; grid-gap: 4px 16px; padding: 10px 0 12px; border-top: 1px solid #312c48; }
  .label b { display: block; font-size: 15px; }
  .label span { color: #8d87a8; font-size: 13px; }
  .text { font: 16px/1.25 Consolas, "Courier New", monospace; white-space: pre; letter-spacing: .5px; }
  .text i { font-style: normal; border-radius: 3px; }
  .text i.late { background: #ff6a2b; color: #15131f; }
  canvas { display: block; width: 100%; height: 46px; }
  .legend { color: #8d87a8; font-size: 12.5px; margin-top: 10px; }
  .legend em { display: inline-block; width: 10px; height: 10px; border-radius: 2px; margin: 0 5px 0 14px; vertical-align: -1px; }
</style></head><body><div class="wrap">${body}</div><script>${script};window.__ready = true;</script></body></html>`;

/**
 * A chart of rows, each one take of the same kind of line: the text with the keys the engine made
 * late (or any other marked keys) highlighted, and a strip with one bar per keystroke at its frame,
 * taller after a longer wait, on one time scale for all rows.
 *   rows: [{ label, note, text, values, mark: (i, weightsHere, weightsBase) => bool }]
 */
export function rowsChart({ title, sub, rows, fps = 30, legendMark = "" }) {
  const data = rows.map((r) => {
    const ks = keystrokes(r.text, r.values, { fps, pauses: r.pauses ?? [] });
    const w = r.mark ? weights(r.text, r.values) : null;
    const w0 = r.mark && r.base ? weights(r.text, r.base) : null;
    const marked = r.mark ? ks.map((_, i) => !!r.mark(i, w, w0)) : ks.map(() => false);
    const end = ks.length ? ks[ks.length - 1].frame : 0;
    return { label: r.label, note: r.note ?? `${(end / fps).toFixed(1)} s · ${end} frames`, chars: ks.map((k, i) => ({ c: k.c, f: k.frame, k: classOf(k.c), m: marked[i] })) };
  });
  const maxFrame = Math.max(...data.map((d) => (d.chars.length ? d.chars[d.chars.length - 1].f : 0)));
  const body = `<h1><span class="tag">Chart</span>${title}</h1><div class="sub">${sub}</div>` +
    data.map((d, i) => `<div class="row"><div class="label"><b>${d.label}</b><span>${d.note}</span></div><div>` +
      `<div class="text">${d.chars.map((c) => `<i${c.m ? ' class="late"' : ""}>${show(c.c)}</i>`).join("")}</div>` +
      `<canvas id="c${i}"></canvas></div></div>`).join("") +
    `<div class="legend">One bar per keystroke at the frame it appears (${fps} fps); a taller bar waited longer.` +
    `<em style="background:${COLORS.letters}"></em>letters<em style="background:${COLORS.punct}"></em>punctuation<em style="background:${COLORS.spaces}"></em>spaces<em style="background:${COLORS.numbers}"></em>numbers` +
    (legendMark ? `<em style="background:${COLORS.mark}"></em>${legendMark}` : "") + `</div>`;
  const script = `
    var DATA = ${JSON.stringify(data)}, MAX = ${maxFrame}, FPS = ${fps}, COL = ${JSON.stringify(COLORS)};
    DATA.forEach(function (d, i) {
      var cv = document.getElementById("c" + i), r = window.devicePixelRatio || 1;
      var w = cv.clientWidth, h = cv.clientHeight; cv.width = w * r; cv.height = h * r;
      var g = cv.getContext("2d"); g.scale(r, r);
      var x = function (f) { return 2 + f / Math.max(1, MAX) * (w - 6); };
      g.fillStyle = "#312c48"; g.fillRect(0, h - 12, w, 1);
      g.fillStyle = "#8d87a8"; g.font = "10px Segoe UI";
      var step = MAX / FPS > 12 ? 2 : 1;
      for (var s = 0; s * FPS <= MAX; s += step) { var sx = Math.round(x(s * FPS)); g.fillRect(sx, h - 14, 1, 5); if (s > 0) g.fillText(s + " s", sx + 3, h - 1); }
      var prev = 0;
      d.chars.forEach(function (c, k) {
        var wait = k === 0 ? 0 : c.f - prev; prev = c.f;
        var bh = Math.max(3, Math.min(h - 18, 3 + wait * 2.6));
        g.fillStyle = c.m ? COL.mark : COL[c.k];
        g.fillRect(Math.round(x(c.f)) - 1, h - 13 - bh, 2, bh);
      });
    });`;
  return PAGE(body, script);
}

/** A character as the chart shows it: a line break as a return arrow, HTML escaped. */
const show = (c) => (/[\r\n\u0003]/.test(c) ? "\u21b5" : c.replace(/&/g, "&amp;").replace(/</g, "&lt;"));

/** Draws a chart page to docs/manual/media/<name>.png. */
export async function drawChart(browser, name, html, { width = 1180 } = {}) {
  const file = path.join(media, `${name}.png`);
  await browser.snap(html, file, { width });
  console.log(`  ${path.relative(path.resolve(media, "..", "..", ".."), file)}`);
  return file;
}
