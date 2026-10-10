// Tests the typing engine (client/engine.js) and the expression builders (client/rig.js) in Node.
//
//   node tools/test-engine.mjs
//
// The engine is the same code the rig's expressions run in After Effects, so these checks
// cover the timing itself; tools/ae-test.jsx covers the expressions inside After Effects.
import { createRequire } from "node:module";
import vm from "node:vm";

const require = createRequire(import.meta.url);
const { lazyTyperRun } = require("../client/engine.js");
const rig = require("../client/rig.js");

let failed = 0;
let passed = 0;
function check(name, ok, detail) {
  if (ok) passed++;
  else {
    failed++;
    console.log(`  FAIL ${name}${detail === undefined ? "" : ` - ${detail}`}`);
  }
}

const FD = 1 / 30;
function defaults(extra) {
  const v = {};
  for (const c of rig.TEXT_CONTROLS) v[c.name] = c.value;
  return Object.assign(v, extra || {});
}
/** Every control flat except Frames Per Character: plain, robotic typing. */
function flat(extra) {
  const v = defaults();
  for (const k of rig.TYPING_PRESET_KEYS) if (/^(Slow|Fast|Slow\/Fast):/.test(k)) v[k] = 0;
  v.Variance = 0;
  return Object.assign(v, extra || {});
}
function io(time, vals, text, extra) {
  const num = (n, t) => {
    if (!(n in vals)) throw new Error(`unknown control ${n}`);
    const v = vals[n];
    return typeof v === "function" ? v(t) : v;
  };
  const textAt = typeof text === "function" ? text : () => text;
  return Object.assign({ time, fd: FD, start: 0, num, text: textAt, pauses: [] }, extra || {});
}
const frameOf = (t) => Math.round(t / FD);
const events = (vals, text, extra, until = 30) =>
  lazyTyperRun(io(until, vals, text, Object.assign({ record: true }, extra || {}))).map(([t, k]) => [frameOf(t), k]);

// 1. Flat typing: first character at once, then one every N frames.
{
  const ev = events(flat({ "Frames Per Character": 3 }), "abcde");
  check("flat: first character at frame 0", ev[0][0] === 0 && ev[0][1] === 1, JSON.stringify(ev));
  check("flat: one character every 3 frames", JSON.stringify(ev) === JSON.stringify([[0, 1], [3, 2], [6, 3], [9, 4], [12, 5]]), JSON.stringify(ev));
  check("flat: count at frame 7 is 3", lazyTyperRun(io(7 * FD, flat({ "Frames Per Character": 3 }), "abcde")) === 3);
  check("flat: count before the layer starts", lazyTyperRun(io(-1, flat(), "abcde")) === 0);
}

// 2. Fractional speeds carry over between frames; zero never loops forever.
{
  const ev = events(flat({ "Frames Per Character": 0.5 }), "abcdef");
  check("half a frame per character: two per frame", JSON.stringify(ev) === JSON.stringify([[0, 1], [1, 3], [2, 5], [3, 6]]), JSON.stringify(ev));
  const ev2 = events(flat({ "Frames Per Character": 1.5 }), "abcde");
  check("1.5 frames per character", JSON.stringify(ev2.map((e) => e[0])) === JSON.stringify([0, 2, 3, 5, 6]), JSON.stringify(ev2));
  const zero = lazyTyperRun(io(1, flat({ "Frames Per Character": 0 }), "x".repeat(500)));
  check("zero speed types everything at once", zero === 500, zero);
}

// 3. Total Duration: the whole text takes that many frames, whatever the modifiers.
{
  const text = "Hello, world. Natural typing, with pauses!";
  const v = defaults(Object.assign({}, rig.TYPING_PRESETS[2].values, { "Speed Mode": 2, "Total Duration": 120 }));
  const ev = events(v, text, null, 20);
  const last = ev[ev.length - 1];
  check("total duration: last character on frame 120", last[1] === text.length && Math.abs(last[0] - 120) <= 1, JSON.stringify(last));
}

// 4. Typing switched off holds the text; on again continues at once.
{
  const typing = (t) => (frameOf(t) >= 6 && frameOf(t) < 20 ? 0 : 1);
  const ev = events(flat({ "Frames Per Character": 2, Typing: typing }), "abcdefghij");
  check("off at frame 6 holds at 3", lazyTyperRun(io(15 * FD, flat({ "Frames Per Character": 2, Typing: typing }), "abcdefghij")) === 3);
  check("on at frame 20 types at once", ev.some((e) => e[0] === 20 && e[1] === 4), JSON.stringify(ev));
  check("typing off from the start shows nothing", lazyTyperRun(io(2, flat({ Typing: 0 }), "abc")) === 0);
}

// 5. Start at Character: starts later in the text; lowering it while off deletes.
{
  check("start at 4 shows 4 before typing", lazyTyperRun(io(0, flat({ Typing: 0, "Start at Character": 4 }), "abcdefgh")) === 4);
  check("start at 4 types from the 5th", lazyTyperRun(io(0, flat({ "Start at Character": 4 }), "abcdefgh")) === 5);
  // Type 6, stop at frame 12, delete 6 characters over frames 15-21.
  const typing = (t) => (frameOf(t) < 12 ? 1 : 0);
  const start = (t) => {
    const f = frameOf(t);
    return f <= 15 ? 0 : f >= 21 ? -6 : -(f - 15);
  };
  const vals = flat({ "Frames Per Character": 2, Typing: typing, "Start at Character": start });
  check("before deleting: 6 typed", lazyTyperRun(io(14 * FD, vals, "abcdefghij")) === 6);
  check("halfway through deleting: 3 left", lazyTyperRun(io(18 * FD, vals, "abcdefghij")) === 3);
  check("deleted: none left", lazyTyperRun(io(25 * FD, vals, "abcdefghij")) === 0);
  // Retype new text: typing on at frame 30 with new text from frame 28.
  const typing2 = (t) => (frameOf(t) < 12 || frameOf(t) >= 30 ? 1 : 0);
  const text2 = (t) => (frameOf(t) >= 28 ? "XYZ" : "abcdefghij");
  const vals2 = flat({ "Frames Per Character": 2, Typing: typing2, "Start at Character": start });
  check("retype: first new character at frame 30", lazyTyperRun(io(30 * FD, vals2, text2)) === 1);
  check("retype: all three by frame 34", lazyTyperRun(io(34 * FD, vals2, text2)) === 3);
  check("deleting below zero stays at zero", lazyTyperRun(io(25 * FD, flat({ Typing: 0, "Start at Character": -50 }), "abc")) === 0);
}

// 6. Pause markers hold typing; it continues at once when the pause ends.
{
  const vals = flat({ "Frames Per Character": 2 });
  const pauses = [[4 * FD, 14 * FD]];
  check("pause holds", lazyTyperRun(io(10 * FD, vals, "abcdefghij", { pauses })) === 2);
  const ev = events(vals, "abcdefghij", { pauses });
  check("pause ends at frame 14", ev.some((e) => e[0] === 14 && e[1] === 3), JSON.stringify(ev));
}

// 7. Modifiers: each one changes the wait of the characters it is about.
{
  const base = flat({ "Frames Per Character": 2 });
  const gap = (vals, text, i) => {
    const ev = events(vals, text);
    const at = (k) => ev.find((e) => e[1] === k)[0];
    return at(i + 1) - at(i);
  };
  check("capitals: +100% doubles the wait", gap(Object.assign({}, base, { "Slow: Capitals": 100 }), "aB", 1) === 4);
  check("after punctuation", gap(Object.assign({}, base, { "Slow: After Punctuation": 300 }), "a, b", 2) === 8);
  check("sentence end", gap(Object.assign({}, base, { "Slow: Sentence End": 200 }), "a. b", 2) === 6);
  check("new line", gap(Object.assign({}, base, { "Slow: New Line": 100 }), "a\rb", 2) === 4);
  check("repeated letters speed up", gap(Object.assign({}, base, { "Fast: Repeated Letters": 100 }), "xll", 2) === 1);
  check("spaces can speed up", gap(Object.assign({}, base, { "Slow/Fast: Spaces": -100 }), "a b", 1) === 1);
  check("spaces can slow down", gap(Object.assign({}, base, { "Slow/Fast: Spaces": 100 }), "a b", 1) === 4);
  check("numbers", gap(Object.assign({}, base, { "Slow: Numbers": 50 }), "a12", 1) === 3);
  check("word start", gap(Object.assign({}, base, { "Slow: Word Start": 100 }), "a bc", 2) === 4);
}

// 8. Variance is random but repeatable, and only ever slows characters down.
{
  const text = "The quick brown fox jumps over the lazy dog.";
  const v1 = flat({ "Frames Per Character": 2, Variance: 50, "Random Seed": 3 });
  const a = JSON.stringify(events(v1, text));
  const b = JSON.stringify(events(v1, text));
  check("variance repeats", a === b);
  const c = JSON.stringify(events(Object.assign({}, v1, { "Random Seed": 4 }), text));
  check("a different seed changes it", a !== c);
  const evFlat = events(flat({ "Frames Per Character": 2 }), text);
  const evVar = events(v1, text);
  check("variance only slows down", evVar[evVar.length - 1][0] > evFlat[evFlat.length - 1][0]);
}

// 9. Presets type a sentence in a believable time.
for (const p of rig.TYPING_PRESETS) {
  const text = "Hello there, this is a typing test. It should feel natural!";
  const ev = events(defaults(p.values), text, null, 60);
  const last = ev[ev.length - 1];
  const sec = last[0] * FD;
  const cps = text.length / sec;
  // Believable on screen: a very fast typist, an everyday one, two fingers.
  const range = { "Very Fast": [11, 17], Average: [5, 9], "Hunt & Peck": [1.8, 3.5] }[p.name];
  check(`${p.name}: ${cps.toFixed(1)} characters per second`, last[1] === text.length && cps >= range[0] && cps <= range[1], `${cps}`);
}

// 10. Keyframed controls change speed over time.
{
  const fpc = (t) => (frameOf(t) < 10 ? 1 : 5);
  const ev = events(flat({ "Frames Per Character": fpc }), "abcdefghijklmnop");
  const gaps = ev.slice(1).map((e, i) => e[0] - ev[i][0]);
  check("speed change takes effect", gaps[0] === 1 && gaps[gaps.length - 1] === 5, JSON.stringify(gaps));
}

// 11. Every preset key is a real control, and every control the engine reads exists.
{
  const names = new Set(rig.TEXT_CONTROLS.map((c) => c.name));
  for (const p of rig.TYPING_PRESETS) for (const k of Object.keys(p.values)) check(`preset key ${k}`, names.has(k));
  const cnames = new Set(rig.CURSOR_CONTROLS.map((c) => c.name));
  for (const p of rig.CURSOR_PRESETS) for (const k of Object.keys(p.values)) check(`cursor preset key ${k}`, cnames.has(k));
  const src = rig.engineSource();
  for (const m of src.matchAll(/(?:slow|fast|either|num)\("([^"]+)"/g)) check(`engine control ${m[1]}`, names.has(m[1]));
}

// 12. The expressions compile and the engine copy behaves like the original.
{
  const set = rig.expressionSet();
  for (const [k, src] of Object.entries(set)) {
    if (typeof src !== "string" || k === "version") continue;
    const body = src.replace("/*LT_DATA*/", "[0,100,[0,0,10,0]]").replace("/*LT_SIZES*/", "[0,100]")
      .replace("/*LT_METRICS*/", "var SIZE = 100, LEAD = 120, B0 = 0, X0 = 0, SPW = 25, GAP = 4;");
    try {
      new Function(body);
      check(`expression ${k} compiles`, true);
    } catch (e) {
      check(`expression ${k} compiles`, false, e.message);
    }
    check(`expression ${k} is ASCII`, /^[\x09\x0a\x0d\x20-\x7e]*$/.test(src));
    check(`expression ${k} has no //@ directive`, !/\/\/\s*@/.test(src));
  }
  // Run the Stable count expression in a fake After Effects environment.
  const vals = flat({ "Frames Per Character": 3 });
  const ctx = {
    time: 7 * FD,
    thisLayer: {
      effect: (n) => () => ({ numKeys: 0, value: vals[n], valueAtTime: () => vals[n] }),
      marker: { numKeys: 0 },
      inPoint: 0
    },
    thisComp: { frameDuration: FD },
    text: { sourceText: { numKeys: 0, value: "abcde" } }
  };
  ctx.thisLayer.text = ctx.text;
  const out = vm.runInNewContext(set.stableCount, ctx);
  check("stable count expression runs", out === 3, out);
}

// 13. The engine source stays ES3-friendly.
{
  const src = rig.engineSource();
  check("no let/const", !/\b(let|const)\s/.test(src));
  check("no arrow functions", !/=>/.test(src));
  check("no Array indexOf (only on strings)", !/\]\.indexOf|\bArray\b/.test(src));
  check("no template strings", !/`[^"]*\$\{/.test(src));
}

console.log(`${failed ? "FAILED" : "ok"}: ${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
