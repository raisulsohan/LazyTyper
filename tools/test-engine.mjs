// Tests the typing engine (client/engine.js) and the expression builders (client/rig.js) in Node.
//
//   node tools/test-engine.mjs
//
// The engine is the same code the rig's expressions run in After Effects, so these checks
// cover the timing itself; tools/ae-test.jsx covers the expressions inside After Effects.
import { createRequire } from "node:module";
import vm from "node:vm";
import fs from "node:fs";

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

  // The cursor shape takes the size of the last character typed when sizes are mixed.
  const shapeAt = (sizes, shown) => {
    const controls = { Width: 10, Top: 80, Bottom: 20, Roundness: 0, "Individual Corners": 0,
      "Top Left": 0, "Top Right": 0, "Bottom Right": 0, "Bottom Left": 0 };
    const textLayer = { effect: () => () => ({ value: shown }) };
    const shape = vm.runInNewContext(set.cursorPath.replace("/*LT_SIZES*/", sizes), {
      time: 1,
      effect: (n) => (n === "Text Layer" ? () => textLayer : () => ({ value: controls[n] })),
      createPath: (pts) => pts
    });
    const ys = shape.map((p) => p[1]);
    return Math.round(Math.max(...ys) - Math.min(...ys));
  };
  check("cursor size: one size for all", shapeAt("[0,50]", 3) === 50, shapeAt("[0,50]", 3));
  check("cursor size: follows the last character typed", shapeAt("[0,[50,50,100,100,50]]", 2) === 100 && shapeAt("[0,[50,50,100,100,50]]", 4) === 50,
    `${shapeAt("[0,[50,50,100,100,50]]", 2)} ${shapeAt("[0,[50,50,100,100,50]]", 4)}`);
  check("cursor size: past the end keeps the last", shapeAt("[0,[50,100]]", 9) === 100, shapeAt("[0,[50,100]]", 9));
}

// 14. Text units (grapheme clusters) for joined letters, as After Effects 26.5 counts them
// (tools/spikes/bengali-cursor.jsx measured the Bengali splits and glyphs used here).
{
  const hostCtx = {};
  vm.createContext(hostCtx);
  vm.runInContext(fs.readFileSync(new URL("../host/host.jsx", import.meta.url), "utf8"), hostCtx);
  const LT = hostCtx.LT;
  const units = (s) => {
    const out = [];
    for (let i = 0; i < s.length; i++) {
      if (/[\r\n]/.test(s[i])) continue;
      if (out.length && LT.joinsPrevious(s, i)) out[out.length - 1] += s[i];
      else out.push(s[i]);
    }
    return out;
  };
  const BN = "আমি বাংলায় টাইপ করি। এটাও চলে।";
  const BN2 = "ক্ষমা কর্ম স্ত্রী কোথায়";
  const samples = [BN, BN2, "Hello,\rworld\n", "étè", "a😀b", "অ্যা",
    "क्षत्रिय हिन्दी", "க்ஷ தமிழ்",
    "কর্", "ক্‍ষ", "これも。", "্ক া"];
  let same = true;
  for (const s of samples) for (let i = -1; i <= s.length; i++) if (LT.joinsPrevious(s, i) !== rig.joins(s, i)) same = false;
  check("units: host and expression agree", same);
  check("units: Bengali split as After Effects counts it", units(BN).length === 22 &&
    units(BN).join("|") === "আ|মি| |বাং|লা|য়| |টা|ই|প| |ক|রি|।| |এ|টা|ও| |চ|লে|।",
  units(BN).join("|"));
  check("units: conjuncts, reph, two-part vowel, nukta", units(BN2).join("|") ===
    "ক্ষ|মা| |ক|র্ম| |স্ত্রী| |কো|থা|য়",
  units(BN2).join("|"));
  check("units: a trailing hasanta stays on its letter", units("কর্").length === 2);
  check("units: Latin, Japanese and line breaks one per character", units("Hello,\rworld\n").length === 11 &&
    units("これも。").length === 4);
  check("units: combining accents and surrogate pairs join", units("étè").length === 3 && units("a😀b").length === 3);

  // The Stable typing range counts units that have started, line breaks skipped.
  const set = rig.expressionSet();
  const rangeAt = (s, k) => vm.runInNewContext(set.stableSelectorStart, {
    text: { sourceText: { value: s } },
    effect: (n) => () => ({ value: n === "Characters Shown" ? k : 0 })
  });
  check("stable range: Latin is the character count minus line breaks", rangeAt("ab\rcd", 4) === 3 && rangeAt("ab\rcd", 0) === 0);
  // Measured: index 1 shows "আ", 2 shows "আমি", 4 shows up to "বাং".
  const bnRange = [0, 1, 2, 2, 3, 4, 4, 4, 5, 5, 6, 7];
  check("stable range: Bengali counts units", bnRange.every((u, k) => rangeAt(BN, k) === u),
    bnRange.map((u, k) => rangeAt(BN, k)).join(","));

  // Cursor table from the glyphs After Effects outlined (names and x extents as measured).
  const glyphs = (list) => list.map(([name, l, r]) => ({ name, l, r, t: -34, b: 0 }));
  const m = { size: 46, gap: 0, spaceWidth: 12, firstBaseline: 0, leading: 60, lineStart: 0 };
  const xs = (text, g) => {
    const t = LT.cursorTable(text, glyphs(g), [{ x1: 0, y: 0, x2: 0 }], m);
    const o = [];
    for (let k = 0; k < t.length; k += 2) o.push(Math.round(t[k]));
    return o;
  };
  const BN_GLYPHS = [["আ", -1, 56], ["ম", 55, 92], ["ম", 66, 101], ["ব", 112, 142], ["ব", 140, 153],
    ["ং", 156, 171], ["ল", 173, 208], ["া", 207, 220], ["য়", 218, 249], ["ট", 260, 290],
    ["া", 289, 302], ["ই", 300, 330], ["প", 331, 366], ["ক", 377, 419], ["র", 418, 455],
    ["র", 429, 459], ["।", 469, 472], ["এ", 492, 523], ["ট", 523, 554], ["া", 553, 566],
    ["ও", 567, 596], ["চ", 609, 638], ["ল", 637, 657], ["ল", 656, 691], ["।", 700, 704]];
  // After each unit: the right edge of the text typed so far, measured in After Effects.
  const bnX = xs(BN, BN_GLYPHS);
  const bnEnds = { 1: 56, 3: 101, 7: 171, 9: 220, 10: 249, 13: 302, 14: 330, 15: 366, 17: 419, 19: 459, 20: 472,
    22: 523, 24: 566, 25: 596, 27: 638, 29: 691, 30: 704 };
  const bnBad = Object.entries(bnEnds).filter(([k, x]) => bnX[k] !== x).map(([k, x]) => `${k}: ${bnX[k]} not ${x}`);
  check("cursor table: Bengali after every unit", !bnBad.length, bnBad.join("; "));
  check("cursor table: Bengali inside a unit sits after the unit", bnX[2] === 101 && bnX[5] === 171, bnX.join(","));
  check("cursor table: Bengali after a space (up to the next letter)", bnX[4] === 112 && bnX[11] === 260, bnX.join(","));
  const BN2_GLYPHS = [["ক", -1, 47], ["ম", 45, 80], ["া", 79, 92], ["ক", 103, 145], ["র", 143, 178],
    ["ম", 168, 185], ["স", 189, 226], ["ী", 198, 238], ["ক", 253, 269], ["ক", 268, 310],
    ["ো", 308, 321], ["থ", 323, 351], ["া", 350, 363], ["য", 361, 392]];
  const bn2X = xs(BN2, BN2_GLYPHS);
  const bn2Ends = { 3: 47, 5: 92, 7: 145, 10: 185, 17: 238, 20: 321, 22: 363, 24: 392 };
  const bn2Bad = Object.entries(bn2Ends).filter(([k, x]) => bn2X[k] !== x).map(([k, x]) => `${k}: ${bn2X[k]} not ${x}`);
  check("cursor table: conjuncts, reph, two-part vowel, nukta", !bn2Bad.length, bn2Bad.join("; "));
  // Repeated syllables whose glyphs carry the same names: each unit takes only its own.
  check("cursor table: repeated syllables (baba)", xs("বাবা", [["ব", 0, 30], ["ব", 28, 40], ["ব", 40, 70], ["ব", 68, 80]]).join(",") === "0,40,40,80,80");
  check("cursor table: repeated syllables (mimi)", xs("মিমি", [["ম", 0, 37], ["ম", 11, 46], ["ম", 46, 83], ["ম", 57, 92]]).join(",") === "0,46,46,92,92");
  check("cursor table: repeated two-part vowels (koko)", xs("কোকো", [["ক", 0, 16], ["ক", 15, 57], ["ো", 55, 68], ["ক", 68, 84], ["ক", 83, 125], ["ো", 123, 136]]).join(",") === "0,68,68,136,136");
  check("cursor table: Latin one glyph per character", xs("Hi yo", [["H", 0, 30], ["i", 34, 40], ["y", 52, 70], ["o", 72, 90]]).join(",") === "0,30,40,52,70,90");
  check("cursor table: a ligature named by two characters", xs("fix", [["fi", 0, 30], ["x", 31, 50]]).join(",") === "0,30,30,50");
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
