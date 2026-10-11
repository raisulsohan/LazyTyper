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
  for (const p of rig.TYPING_PRESETS) {
    const missing = rig.TYPING_PRESET_KEYS.filter((k) => p.values[k] === undefined);
    check(`${p.name} sets every typing control`, !missing.length, missing.join(", "));
    check(`${p.name} says its frame rate`, p.fps === 30, p.fps);
  }
  const cnames = new Set(rig.CURSOR_CONTROLS.map((c) => c.name));
  for (const p of rig.CURSOR_PRESETS) for (const k of Object.keys(p.values)) check(`cursor preset key ${k}`, cnames.has(k));
  const src = rig.engineSource();
  const read = new Set([...src.matchAll(/"((?:Slow|Fast|Slow\/Fast): [^"]+|Typing|Start at Character|Speed Mode|Frames Per Character|Total Duration|Variance|Random Seed)"/g)].map((m) => m[1]));
  for (const n of read) check(`engine control ${n}`, names.has(n));
  for (const c of rig.TEXT_CONTROLS) if (c.group !== "output") check(`the engine reads ${c.name}`, read.has(c.name));
  // A control added later changes nothing at its default, so Refresh can add it to an older rig.
  for (const c of rig.TEXT_CONTROLS) if (c.since) check(`${c.name} defaults to no effect`, c.value === 0, c.value);
}

// 15. A rig or preset made with 1.2.0 types exactly as it did, frame for frame, once Refresh has
// added the newer controls at their defaults (tools/fixtures/engine-1.2.0.js is 1.2.0's engine).
{
  const old = require("./fixtures/engine-1.2.0.js").lazyTyperRun;
  const OLD_KEYS = rig.TEXT_CONTROLS.filter((c) => !c.since).map((c) => c.name);
  const oldPreset = (fpc, variance, slow, fast, either) => ({
    "Speed Mode": 1, "Frames Per Character": fpc, "Total Duration": 90, "Variance": variance, "Random Seed": 1,
    "Slow: Capitals": slow[0], "Slow: Numbers": slow[1], "Slow: Symbols": slow[2], "Slow: Punctuation": slow[3],
    "Slow: After Punctuation": slow[4], "Slow: Sentence End": slow[5], "Slow: New Line": slow[6],
    "Slow: Word Start": slow[7], "Slow: Long Words": slow[8], "Slow: Rare Letters": slow[9],
    "Fast: Repeated Letters": fast[0], "Fast: Common Pairs": fast[1], "Fast: Common Words": fast[2],
    "Fast: Word Momentum": fast[3],
    "Slow/Fast: Spaces": either[0], "Slow/Fast: Same Hand": either[1], "Slow/Fast: Fatigue": either[2]
  });
  // The 1.2.0 built-in presets, as 1.2.0 shipped them.
  const OLD_PRESETS = [
    oldPreset(2.2, 15, [30, 30, 60, 20, 150, 300, 250, 20, 0, 10], [40, 40, 30, 30], [-20, 10, 0]),
    oldPreset(3, 35, [60, 60, 120, 40, 250, 500, 400, 50, 30, 40], [30, 30, 20, 20], [0, 20, 10]),
    oldPreset(6, 60, [150, 120, 250, 80, 300, 600, 500, 100, 60, 100], [10, 10, 20, 0], [-30, 0, 20])
  ];
  let seed = 7;
  const rand = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
  const pick = (lo, hi) => Math.round((lo + rand() * (hi - lo)) * 10) / 10;
  const randomSet = () => {
    const v = {};
    for (const k of OLD_KEYS) {
      const c = rig.TEXT_CONTROLS.find((d) => d.name === k);
      v[k] = c.value;
      if (/^Slow:/.test(k)) v[k] = pick(-20, 600);
      if (/^Fast:/.test(k)) v[k] = pick(-150, 200);
      if (/^Slow\/Fast:/.test(k)) v[k] = pick(-90, 200);
    }
    v["Frames Per Character"] = pick(0.3, 7);
    v.Variance = pick(0, 100);
    v["Random Seed"] = Math.round(pick(0, 50));
    v["Total Duration"] = pick(10, 200);
    v["Speed Mode"] = rand() < 0.3 ? 2 : 1;
    return v;
  };
  const sets = [...OLD_PRESETS, Object.fromEntries(rig.TEXT_CONTROLS.filter((c) => !c.since).map((c) => [c.name, c.value]))];
  for (let r = 0; r < 12; r++) sets.push(randomSet());
  const TEXTS = [
    "Hello there, this is a typing test. It should feel natural!",
    "NASA and the ESA launched 2026 missions; call 555-0199 or EMAIL us.",
    "Dear team,\rThe meeting moved to 3 PM.\r\r\rThanks! ",
    "Committee, coffee, bookkeeper: ed de ce un my tr fr ol ki.\r",
    "আমি বাংলায় টাইপ করি। এটাও চলে।",
    "\rStarts with a break and ends with dots...  "
  ];
  let bad = [];
  let runs = 0;
  for (const [si, base] of sets.entries()) {
    // The rig after Refresh: the 1.2.0 values, the newer controls at their defaults, and
    // anything 1.2.0 ignored raised to what it acted as (rig.js upgradeValues; host.jsx does the same).
    const now = Object.assign({}, base);
    rig.upgradeValues(now);
    for (const c of rig.TEXT_CONTROLS) if (now[c.name] === undefined) now[c.name] = c.value;
    const before = Object.assign({}, base, { Typing: 1, "Start at Character": 0, "Characters Shown": 0 });
    for (const text of TEXTS) {
      for (const fps of [24, 30, 60]) {
        for (const variant of ["plain", "paused", "keyed"]) {
          const extra = { fd: 1 / fps, record: true };
          const a = Object.assign({}, before);
          const b = Object.assign({}, now, { Typing: 1, "Start at Character": 0 });
          if (variant === "paused") extra.pauses = [[0.4, 0.9], [2, 2.5]];
          if (variant === "keyed") {
            // Typing off 1-1.5 s, back on; Start at Character dropping 3 while off (an erase).
            const typing = (t) => (t >= 1 && t < 1.5 ? 0 : 1);
            const startAt = (t) => (t < 1.1 ? 0 : t >= 1.3 ? -3 : -Math.round((t - 1.1) / 0.2 * 3));
            a.Typing = b.Typing = typing;
            a["Start at Character"] = b["Start at Character"] = startAt;
          }
          const ea = old(io(20, a, text, extra));
          const eb = lazyTyperRun(io(20, b, text, extra));
          runs++;
          if (JSON.stringify(ea) !== JSON.stringify(eb) && bad.length < 4) bad.push(`set ${si}, ${fps} fps, ${variant}, "${text.slice(0, 16)}"`);
        }
      }
    }
  }
  check(`1.2.0 rig timing unchanged (${runs} takes, same keystroke frames)`, !bad.length, bad.join("; "));

  // Saved presets from 1.2.0: no frame rate, no newer controls; brought up to date, they type as before.
  const saved = { name: "Mine", values: Object.assign({}, OLD_PRESETS[1], { "Fast: Repeated Letters": -40 }) };
  check("old preset: upgraded", rig.upgradeTypingPreset(saved) === true && saved.fps === 30);
  check("old preset: newer controls added at no effect", rig.TEXT_CONTROLS.filter((c) => c.since).every((c) => saved.values[c.name] === 0));
  check("old preset: a negative Repeated Letters (ignored by 1.2.0) becomes 0", saved.values["Fast: Repeated Letters"] === 0);
  check("old preset: upgrading twice changes nothing", rig.upgradeTypingPreset(saved) === false);
  const text = "Hello, NASA! See you at 10:30.\rBye.";
  const ea = old(io(20, Object.assign({}, OLD_PRESETS[1], { "Fast: Repeated Letters": -40, Typing: 1, "Start at Character": 0 }), text, { record: true }));
  const eb = lazyTyperRun(io(20, defaults(saved.values), text, { record: true }));
  check("old preset: types as 1.2.0 did", JSON.stringify(ea) === JSON.stringify(eb));
  const fresh = Object.assign({}, rig.TYPING_PRESETS[0].values, { "Fast: Repeated Letters": -40 });
  check("a current preset keeps a negative Repeated Letters", !rig.upgradeValues(fresh) && fresh["Fast: Repeated Letters"] === -40);
}

// 16. Presets type as many characters a second at any frame rate.
{
  const text = "Hello there, this is a typing test. It should feel natural!";
  const cps = (p, fps) => {
    const v = defaults(rig.valuesForFps(p.values, p.fps, fps));
    const ev = lazyTyperRun(io(60, v, text, { fd: 1 / fps, record: true }));
    return text.length / ev[ev.length - 1][0];
  };
  for (const p of rig.TYPING_PRESETS) {
    const at30 = cps(p, 30);
    const off = [24, 25, 29.97, 50, 60].map((fps) => [fps, cps(p, fps)]).filter(([, c]) => Math.abs(c / at30 - 1) > 0.03);
    check(`${p.name}: same characters a second at 24-60 fps`, !off.length, `${at30.toFixed(2)} at 30; ${off.map(([f, c]) => `${c.toFixed(2)} at ${f}`).join(", ")}`);
  }
  const v = rig.valuesForFps({ "Frames Per Character": 2.2, "Total Duration": 90, Variance: 15 }, 30, 24);
  check("24 fps: frames scaled, the rest kept", v["Frames Per Character"] === 1.76 && v["Total Duration"] === 72 && v.Variance === 15, JSON.stringify(v));
  const same = rig.valuesForFps(rig.TYPING_PRESETS[1].values, 30, 30);
  check("30 fps: values untouched", JSON.stringify(same) === JSON.stringify(rig.TYPING_PRESETS[1].values));
  check("a preset saved at 25 fps doubles its frames at 50", rig.valuesForFps({ "Frames Per Character": 1.5 }, 25, 50)["Frames Per Character"] === 3);
  check("no frame rate means 30", rig.valuesForFps({ "Frames Per Character": 3 }, undefined, 60)["Frames Per Character"] === 6);
  const hostCtx = {};
  vm.createContext(hostCtx);
  vm.runInContext(fs.readFileSync(new URL("../host/host.jsx", import.meta.url), "utf8"), hostCtx);
  const cases = [[rig.TYPING_PRESETS[0].values, 30, 24], [rig.TYPING_PRESETS[2].values, 30, 59.94], [{ "Frames Per Character": 1.7083 }, 25, 30], [rig.TYPING_PRESETS[1].values, undefined, 50]];
  check("host and panel convert alike", cases.every(([vals, from, to]) =>
    JSON.stringify(hostCtx.LT.forComp(rig.TEXT_CONTROLS, vals, from, to)) === JSON.stringify(rig.valuesForFps(vals, from, to))));
}

// 17. The newer controls: last character, capitals and digits in a row, line breaks in stages,
// same finger, repeated letters both ways.
{
  const base = flat({ "Frames Per Character": 2 });
  const gap = (vals, text, i) => {
    const ev = events(Object.assign({}, base, vals), text);
    const at = (k) => ev.find((e) => e[1] === k)[0];
    return at(i + 1) - at(i);
  };
  const gaps = (vals, text) => {
    const ev = events(Object.assign({}, base, vals), text);
    return ev.slice(1).map((e, i) => e[0] - ev[i][0]).join(",");
  };
  // Last character: only the last key that is not a space or line break.
  check("last character: the closing mark waits", gaps({ "Slow: Last Character": 100 }, "abc.") === "2,2,4", gaps({ "Slow: Last Character": 100 }, "abc."));
  check("last character: trailing spaces and breaks do not count", gaps({ "Slow: Last Character": 100 }, "ab!\r ") === "2,4,2,2", gaps({ "Slow: Last Character": 100 }, "ab!\r "));
  // Capitals and digits in a row: the first keeps its slow-down, the rest lose that share of it.
  const caps = { "Slow: Capitals": 100 };
  check("in a row at 0: every capital slow (as 1.2.0)", gaps(caps, "xNASA") === "4,4,4,4", gaps(caps, "xNASA"));
  check("capitals in a row 100: only the first slow", gaps(Object.assign({ "Fast: Capitals in a Row": 100 }, caps), "xNASA") === "4,2,2,2",
    gaps(Object.assign({ "Fast: Capitals in a Row": 100 }, caps), "xNASA"));
  check("capitals in a row 50: the rest half as slow", gap(Object.assign({ "Fast: Capitals in a Row": 50 }, caps), "xNASA", 2) === 3);
  check("capitals in a row: above 100 acts as 100", gaps(Object.assign({ "Fast: Capitals in a Row": 300 }, caps), "xNASA") === "4,2,2,2");
  check("capitals in a row: after a small letter it is a first", gaps(Object.assign({ "Fast: Capitals in a Row": 100 }, caps), "xNaSA") === "4,2,4,2",
    gaps(Object.assign({ "Fast: Capitals in a Row": 100 }, caps), "xNaSA"));
  check("capitals in a row: nothing to take away without Slow: Capitals", gaps({ "Fast: Capitals in a Row": 100 }, "xNASA") === "2,2,2,2");
  const nums = { "Slow: Numbers": 100, "Fast: Numbers in a Row": 100 };
  check("numbers in a row: 2026", gaps(nums, "x2026") === "4,2,2,2", gaps(nums, "x2026"));
  check("numbers in a row: capitals are not digits", gaps(Object.assign({ "Slow: Capitals": 100 }, nums), "x2A3") === "4,4,4", gaps(Object.assign({ "Slow: Capitals": 100 }, nums), "x2A3"));
  // Line breaks in stages: before Return, after it, and each extra Return.
  check("before line break: the break itself waits", gaps({ "Slow: Before Line Break": 100 }, "ab\rcd") === "2,4,2,2", gaps({ "Slow: Before Line Break": 100 }, "ab\rcd"));
  check("before line break: only the first of several", gaps({ "Slow: Before Line Break": 100 }, "ab\r\rcd") === "2,4,2,2,2", gaps({ "Slow: Before Line Break": 100 }, "ab\r\rcd"));
  check("new line: after each break (as 1.2.0)", gaps({ "Slow: New Line": 100 }, "ab\r\rcd") === "2,2,4,4,2", gaps({ "Slow: New Line": 100 }, "ab\r\rcd"));
  check("empty lines: slower", gaps({ "Slow: New Line": 100, "Slow/Fast: Empty Lines": 100 }, "ab\r\rcd") === "2,2,8,4,2",
    gaps({ "Slow: New Line": 100, "Slow/Fast: Empty Lines": 100 }, "ab\r\rcd"));
  check("empty lines: faster", gaps({ "Slow: New Line": 100, "Slow/Fast: Empty Lines": -100 }, "ab\r\r\rcd") === "2,2,2,2,4,2",
    gaps({ "Slow: New Line": 100, "Slow/Fast: Empty Lines": -100 }, "ab\r\r\rcd"));
  // Same finger, different key (QWERTY touch typing).
  const finger = { "Slow: Same Finger": 100 };
  check("same finger: e then d", gap(finger, "xed", 2) === 4);
  check("same finger: r t, u n, o l, k i, a z", ["xrt", "xun", "xol", "xki", "xaz"].every((s) => gap(finger, s, 2) === 4));
  check("same finger: capitals count", gap(finger, "xEd", 2) === 4);
  check("same finger: not the same key", gap(finger, "xee", 2) === 2);
  check("same finger: not another finger", ["xek", "xed".replace("d", "f"), "xpq", "x1d"].every((s) => gap(finger, s, 2) === 2));
  check("same finger: not across a space", gap(finger, "e d", 2) === 2);
  // Repeated letters both ways.
  check("repeated letters: below 0 slows down", gap({ "Fast: Repeated Letters": -100 }, "xll", 2) === 4);
  check("repeated letters: above 0 still speeds up", gap({ "Fast: Repeated Letters": 100 }, "xll", 2) === 1);
}

// 12. The expressions compile and the engine copy behaves like the original.
{
  const set = rig.expressionSet();
  for (const [k, src] of Object.entries(set)) {
    if (typeof src !== "string" || k === "version") continue;
    const body = src.replace("/*LT_DATA*/", "[0,100,[0,0,10,0]]").replace("/*LT_SIZES*/", "[0,100,100,100]")
      .replace("/*LT_COLORS*/", "[0,[1,1,1],[1,1,1]]").split("/*LT_TEXT*/").join("parent")
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
      "Top Left": 0, "Top Right": 0, "Bottom Right": 0, "Bottom Left": 0, "Size From": 1,
      "Height Follows Size": 1, "Width Follows Size": 1, "Offset Unit": 1, "X Offset": 0, "Y Offset": 0 };
    const textLayer = { effect: () => () => ({ value: shown }) };
    const shape = vm.runInNewContext(set.cursorPath.replace("/*LT_SIZES*/", sizes).split("/*LT_TEXT*/").join("parent"), {
      time: 1,
      parent: textLayer,
      effect: (n) => () => ({ value: controls[n] }),
      createPath: (pts) => pts
    });
    const ys = shape.map((p) => p[1]);
    return Math.round(Math.max(...ys) - Math.min(...ys));
  };
  check("cursor size: one size for all", shapeAt("[0,50,50,50]", 3) === 50, shapeAt("[0,50,50,50]", 3));
  const mixed = "[0,50,[50,50,100,100,50],[50,100,100,50,50]]";
  check("cursor size: follows the last character typed", shapeAt(mixed, 2) === 100 && shapeAt(mixed, 4) === 50,
    `${shapeAt(mixed, 2)} ${shapeAt(mixed, 4)}`);
  check("cursor size: past the end keeps the last", shapeAt("[0,50,[50,100],[100,100]]", 9) === 100, shapeAt("[0,50,[50,100],[100,100]]", 9));
}

// 18. The cursor (1.3.0): parenting links, size from the character before or after, height and
// width following the size or not, offsets in % of the font size, Show Cursor, the text's colour.
// A cursor made with 1.2.0 looks the same once Refresh has rewritten it with the values Refresh
// gives it (tools/fixtures/rig-1.2.0.js is 1.2.0's rig.js).
{
  const old = require("./fixtures/rig-1.2.0.js");
  const oldSet = old.expressionSet();
  const set = rig.expressionSet();
  const hostCtx = {};
  vm.createContext(hostCtx);
  vm.runInContext(fs.readFileSync(new URL("../host/host.jsx", import.meta.url), "utf8"), hostCtx);
  const LT = hostCtx.LT;
  const refreshed = {};
  for (const c of rig.CURSOR_CONTROLS) refreshed[c.name] = c.oldValue !== undefined ? c.oldValue : c.value;

  // A fake cursor layer: controls by name, a text layer showing `shown` characters.
  const env = (controls, shown, extra) => {
    const textLayer = { effect: (n) => () => ({ value: n === "Characters Shown" ? shown : 0 }) };
    return Object.assign({
      time: 1,
      parent: textLayer,
      effect: (n) => (n === "Text Layer" ? () => textLayer : () => {
        if (!(n in controls)) throw new Error(`no control ${n}`);
        return { value: controls[n] };
      }),
      createPath: (pts, ins, outs) => ({ pts, ins, outs })
    }, extra || {});
  };
  const runNew = (src, controls, shown, data) => vm.runInNewContext(src.split("/*LT_TEXT*/").join("parent")
    .replace("/*LT_SIZES*/", data.sizes || "[0,100,100,100]").replace("/*LT_COLORS*/", data.colors || "[0,[1,1,1],[1,1,1]]"), env(controls, shown));
  const runOld = (src, controls, shown, sizes) => vm.runInNewContext(src.replace("/*LT_SIZES*/", sizes), env(controls, shown));
  const round = (v) => JSON.stringify(v, (k, x) => (typeof x === "number" ? Math.round(x * 1e6) / 1e6 : x));

  // 1.2.0's shape at the position plus its offsets == the new shape (offsets inside) at the point.
  let seed = 11;
  const rand = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
  const pick = (lo, hi) => Math.round((lo + rand() * (hi - lo)) * 10) / 10;
  let bad = [];
  for (let r = 0; r < 60; r++) {
    const c = Object.assign({}, refreshed, {
      Width: pick(-5, 80), Top: pick(-20, 120), Bottom: pick(-20, 60), Roundness: pick(0, 100),
      "Individual Corners": rand() < 0.3 ? 1 : 0, "Top Left": pick(0, 100), "Top Right": pick(0, 100),
      "Bottom Right": pick(0, 100), "Bottom Left": pick(0, 100), "X Offset": pick(-30, 30), "Y Offset": pick(-30, 30)
    });
    const before = [40, 40, 90, 90, 90, 40, 40];
    const oldSizes = r % 2 ? "[0,64]" : `[0,[${before.join(",")}]]`;
    const newSizes = r % 2 ? "[0,64,64,64]" : `[0,40,[${before.join(",")}],[40,90,90,40,40,40,40]]`;
    const shown = r % 7;
    const o = runOld(oldSet.cursorPath, c, shown, oldSizes);
    const n = runNew(set.cursorPath, c, shown, { sizes: newSizes });
    const moved = o.pts.map(([x, y]) => [x + c["X Offset"], y + c["Y Offset"]]);
    if (round(moved) !== round(n.pts) || round(o.ins) !== round(n.ins) || round(o.outs) !== round(n.outs)) {
      if (bad.length < 3) bad.push(`${r}: ${round(moved)} vs ${round(n.pts)}`);
    }
  }
  check("1.2.0 cursor shape unchanged after Refresh (60 random shapes, offsets now in the shape)", !bad.length, bad.join("; "));
  bad = [];
  for (let r = 0; r < 40; r++) {
    const c = Object.assign({}, refreshed, { "Cursor Opacity": pick(0, 100), Blink: rand() < 0.7 ? 1 : 0,
      "Blinks per Second": pick(0, 4), "Blink While Typing": rand() < 0.5 ? 1 : 0, "Blink Softness": pick(0, 100) });
    const extra = { time: pick(0, 9) };
    const shown = { value: 3, valueAtTime: (t) => (t < extra.time - 0.2 ? 2 : 3) };
    const textLayer = { effect: () => () => shown };
    const e2 = (src) => vm.runInNewContext(src.split("/*LT_TEXT*/").join("parent"), env(c, 3, Object.assign({}, extra, {
      parent: textLayer,
      effect: (n) => (n === "Text Layer" ? () => textLayer : () => ({ value: c[n] }))
    })));
    if (Math.abs(e2(oldSet.cursorOpacity) - e2(set.cursorOpacity)) > 1e-9 && bad.length < 3) bad.push(r);
  }
  check("1.2.0 cursor blink unchanged after Refresh (Show Cursor on)", !bad.length, bad.join(","));
  const oldColor = vm.runInNewContext(oldSet.cursorColor, env({ "Cursor Color": [0.2, 0.4, 0.6, 1] }, 0));
  const newColor = runNew(set.cursorColor, Object.assign({}, refreshed, { "Cursor Color": [0.2, 0.4, 0.6, 1] }), 0, { colors: "[0,[1,0,0],[1,0,0]]" });
  check("1.2.0 cursor colour unchanged after Refresh (Use Text Color off)", round(oldColor.value) === round(newColor), `${round(oldColor.value)} ${round(newColor)}`);

  // Show Cursor.
  const hidden = runNew(set.cursorOpacity, Object.assign({}, refreshed, { "Show Cursor": 0, Blink: 0 }), 3, {});
  const shownOp = runNew(set.cursorOpacity, Object.assign({}, refreshed, { "Show Cursor": 1, Blink: 0, "Cursor Opacity": 70 }), 3, {});
  check("Show Cursor off hides it, on shows Cursor Opacity", hidden === 0 && shownOp === 70, `${hidden} ${shownOp}`);

  // Size From, Height/Width Follows Size, Offset Unit.
  const box = (controls, shown, sizes) => {
    const p = runNew(set.cursorPath, Object.assign({}, refreshed, { Roundness: 0 }, controls), shown, { sizes }).pts;
    const xs = p.map((q) => q[0]);
    const ys = p.map((q) => q[1]);
    return [Math.min(...xs), Math.min(...ys), Math.max(...xs) - Math.min(...xs), Math.max(...ys) - Math.min(...ys)].map((v) => Math.round(v * 100) / 100);
  };
  // "ab CD": a and b at 50, C and D at 100; main size 50.
  const sz = "[0,50,[50,50,50,50,100,100],[50,50,50,100,100,100]]";
  const base = { Width: 10, Top: 80, Bottom: 20 };
  check("size from before: after 'ab ' the space's size", box(base, 3, sz)[3] === 50);
  check("size from after: after 'ab ' the C's size", box(Object.assign({ "Size From": 2 }, base), 3, sz)[3] === 100);
  check("height follows, width does not (Vertical)", JSON.stringify(box(Object.assign({ "Width Follows Size": 0 }, base), 5, sz)) === JSON.stringify([0, -80, 5, 100]),
    JSON.stringify(box(Object.assign({ "Width Follows Size": 0 }, base), 5, sz)));
  check("width follows, height does not", JSON.stringify(box(Object.assign({ "Height Follows Size": 0 }, base), 5, sz)) === JSON.stringify([0, -40, 10, 50]),
    JSON.stringify(box(Object.assign({ "Height Follows Size": 0 }, base), 5, sz)));
  check("offsets in pixels", JSON.stringify(box(Object.assign({ "X Offset": 6, "Y Offset": -4 }, base), 5, sz).slice(0, 2)) === JSON.stringify([6, -84]));
  check("offsets in % of the font size: X like the width, Y like the height",
    JSON.stringify(box(Object.assign({ "Offset Unit": 2, "X Offset": 10, "Y Offset": 10, "Width Follows Size": 0 }, base), 5, sz).slice(0, 2)) === JSON.stringify([5, -70]),
    JSON.stringify(box(Object.assign({ "Offset Unit": 2, "X Offset": 10, "Y Offset": 10, "Width Follows Size": 0 }, base), 5, sz)));

  // Use Text Color: the colour of the character the size comes from.
  const cols = "[0,[[1,1,1],[1,1,1],[1,0,0],[1,0,0]],[[1,1,1],[1,0,0],[1,0,0],[1,0,0]]]";
  const col = (controls, shown) => JSON.stringify(runNew(set.cursorColor, Object.assign({}, refreshed, { "Cursor Color": [0, 0, 1, 1] }, controls), shown, { colors: cols }));
  check("Use Text Color off: Cursor Color", col({ "Use Text Color": 0 }, 1) === "[0,0,1,1]", col({ "Use Text Color": 0 }, 1));
  check("Use Text Color: the character before", col({ "Use Text Color": 1 }, 1) === "[1,1,1,1]" && col({ "Use Text Color": 1 }, 2) === "[1,0,0,1]");
  check("Use Text Color: the character after", col({ "Use Text Color": 1, "Size From": 2 }, 1) === "[1,0,0,1]");
  check("Use Text Color: one colour for all", JSON.stringify(runNew(set.cursorColor, Object.assign({}, refreshed, { "Use Text Color": 1 }), 0,
    { colors: "[0,[0.5,0.5,0],[0.5,0.5,0]]" })) === "[0.5,0.5,0,1]");

  // The host's tables: which character the cursor takes after, the main size, colour lists.
  const sizesOf = (text, each, after) => Array.from(LT.cursorSizes(text, each, 99, after)).join(",");
  const oldCursorSizes = (text, sizes, b) => {
    const out = [];
    for (let k = 0; k <= text.length; k++) {
      let at = k - 1;
      if (at < 0 || /[\r\n\u0003\u2028\u2029]/.test(text.charAt(at))) at = k < text.length ? k : k - 1;
      out.push(at >= 0 && at < text.length ? sizes[at] : b);
    }
    return out.join(",");
  };
  const t1 = "ab CD\rx";
  const s1 = [50, 50, 50, 100, 100, 40, 60];
  check("sizes before: as 1.2.0 did", sizesOf(t1, s1, false) === oldCursorSizes(t1, s1, 99), sizesOf(t1, s1, false));
  check("sizes after: the next character, the last at a line end", sizesOf(t1, s1, true) === "50,50,50,100,100,100,60,60", sizesOf(t1, s1, true));
  check("sizes: an empty text keeps the base", sizesOf("", [], true) === "99" && sizesOf("", [], false) === "99");
  check("main size: what most characters have", LT.mainSize("Small BIG small", [64, 64, 64, 64, 64, 64, 128, 128, 128, 64, 64, 64, 64, 64, 64], 128) === 64);
  check("main size: spaces do not count", LT.mainSize("A b", [10, 50, 10], 99) === 10 && LT.mainSize("  ", [5, 5], 99) === 99);
  check("colours: one for all", LT.colorsData([[1, 1, 1], [1, 1, 1]], [0, 0, 0]) === "[1,1,1]");
  check("colours: a list when they differ", LT.colorsData([[1, 1, 1], [1, 0, 0]], [0, 0, 0]) === "[[1,1,1],[1,0,0]]");

  // Presets: every built-in sets every cursor preset key; old saved ones keep their look.
  for (const p of rig.CURSOR_PRESETS) {
    const missing = rig.CURSOR_PRESET_KEYS.filter((k) => p.values[k] === undefined);
    check(`${p.name} cursor preset sets every key`, !missing.length, missing.join(", "));
  }
  const cnames = new Set(rig.CURSOR_CONTROLS.map((c) => c.name));
  check("cursor preset keys are cursor controls", rig.CURSOR_PRESET_KEYS.every((k) => cnames.has(k)));
  check("Vertical keeps its width beside a big word, Underscore and Box grow",
    rig.CURSOR_PRESETS.map((p) => p.values["Width Follows Size"]).join(",") === "0,1,1");
  const savedCursor = { name: "Mine", values: Object.assign({}, old.CURSOR_PRESETS[0].values, { "X Offset": 12 }) };
  check("old cursor preset: upgraded", rig.upgradeCursorPreset(savedCursor) === true);
  check("old cursor preset: offsets stay pixels, size follows as before", savedCursor.values["Offset Unit"] === 1 &&
    savedCursor.values["X Offset"] === 12 && savedCursor.values["Size From"] === 1 &&
    savedCursor.values["Height Follows Size"] === 1 && savedCursor.values["Width Follows Size"] === 1, JSON.stringify(savedCursor.values));
  check("old cursor preset: no colour or Show Cursor added", savedCursor.values["Show Cursor"] === undefined && savedCursor.values["Use Text Color"] === undefined);
  check("old cursor preset: upgrading twice changes nothing", rig.upgradeCursorPreset(savedCursor) === false);
  // A control added later keeps an older cursor as it was.
  for (const c of rig.CURSOR_CONTROLS) if (c.since) {
    const v = c.oldValue !== undefined ? c.oldValue : c.value;
    const asBefore = { "Show Cursor": 1, "Use Text Color": 0, "Size From": 1, "Height Follows Size": 1, "Width Follows Size": 1, "Offset Unit": 1 }[c.name];
    check(`${c.name}: an older cursor gets ${asBefore}`, v === asBefore, v);
  }
  // No expression reads the old link controls any more.
  check("cursor expressions use parenting, not Text Layer or Guide Layer",
    ["stableCursorPosition", "dynamicCursorPosition", "cursorPath", "cursorOpacity", "cursorColor"].every((k) => !/Text Layer|Guide Layer/.test(set[k])));
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
