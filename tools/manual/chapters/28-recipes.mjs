// Chapter 28: recipes. A search bar, a chat bubble, code, Bengali and Japanese, mixed fonts with a
// Stable rig, speed keyed to a voice-over, nudging baked keystrokes.
import { BG, WHITE, GREY, rig, SWATCH } from "../scenes.mjs";
import { keystrokes } from "../charts.mjs";

/** Seconds until the text is typed with the Average preset (the engine, as in After Effects), plus a hold. */
const until = (text, values = {}) => keystrokes(text, values).at(-1).frame / 30 + 0.9;

const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const LIGHT = [0.93, 0.94, 0.96];
const INK = [0.13, 0.13, 0.16];

async function searchBar(s) {
  await s.scene({
    name: "Search bar", width: 1280, height: 300, duration: 6, fps: 30, bg: LIGHT,
    shapes: [{ name: "Search box", size: [1040, 110], pos: [640, 150], color: [1, 1, 1], round: 55 }],
    texts: [{ name: "Query", text: "how to make natural typing in after effects", font: "SegoeUI", size: 44, color: INK, pos: [170, 165] }]
  });
  await rig(s, ["Query"], { typing: "b:Very Fast" });
  await s.gif("28-search", { duration: 5, fps: 30, width: 720, swatch: ["edeff4", "ffffff", "212128", "8a8a90"] });
}

async function chat(s) {
  await s.scene({
    name: "Chat bubble", width: 1280, height: 420, duration: 12, fps: 30, bg: LIGHT,
    shapes: [{ name: "Bubble", size: [760, 210], pos: [520, 210], color: [0.38, 0.47, 0.95], round: 36 }],
    texts: [{ name: "Message", text: "Are we still on for tonight? I can bring the snacks if you want.", font: "SegoeUI", size: 40, color: [1, 1, 1], pos: [520, 215], box: [680, 160] }]
  });
  await rig(s, ["Message"]);
  await s.gif("28-chat", { duration: until("Are we still on for tonight? I can bring the snacks if you want."), fps: 30, width: 720, swatch: ["edeff4", "ffffff", "6178f2"] });
}

async function code(s) {
  await s.scene({
    name: "Code", width: 1280, height: 400, duration: 16, fps: 30, bg: [0.07, 0.07, 0.09],
    texts: [{ name: "Code", text: "function greet(name) {\r  return `Hello, ${name}!`;\r}", font: "Consolas", size: 44, color: [0.85, 0.87, 0.95], pos: [110, 140] }]
  });
  await rig(s, ["Code"], { cursor: "b:Box" });
  await s.gif("28-code", { duration: until("function greet(name) {\r  return `Hello, ${name}!`;\r}"), fps: 30, width: 720, swatch: ["121217", "d9deF2", "8d87a8"] });
}

async function scripts(s) {
  await s.scene({
    name: "Other scripts", width: 1280, height: 450, duration: 12, fps: 30, bg: BG,
    texts: [
      { name: "Label 3", text: "Bengali, Stable", font: "SegoeUI", size: 24, color: GREY, pos: [50, 360], locked: true },
      { name: "Bengali Stable", text: "\u0986\u09ae\u09bf \u09ac\u09be\u0982\u09b2\u09be\u09df \u099f\u09be\u0987\u09aa \u0995\u09b0\u09bf\u0964 \u098f\u099f\u09be\u0993 \u099a\u09b2\u09c7\u0964", font: "NirmalaUI", size: 46, color: WHITE, pos: [260, 364] },
      { name: "Label 1", text: "Bengali, Dynamic", font: "SegoeUI", size: 24, color: GREY, pos: [50, 120], locked: true },
      { name: "Bengali", text: "আমি বাংলায় টাইপ করি। এটাও চলে।", font: "NirmalaUI", size: 46, color: WHITE, pos: [260, 124] },
      { name: "Label 2", text: "Japanese", font: "SegoeUI", size: 24, color: GREY, pos: [50, 240], locked: true },
      { name: "Japanese", text: "これも打てます。自然に。", font: "YuGothic-Regular", size: 46, color: WHITE, pos: [260, 244] }
    ]
  });
  await rig(s, ["Bengali", "Japanese"]);
  await rig(s, ["Bengali Stable"], { type: "stable" });
  await s.gif("28-scripts", { duration: until("\u0986\u09ae\u09bf \u09ac\u09be\u0982\u09b2\u09be\u09df \u099f\u09be\u0987\u09aa \u0995\u09b0\u09bf\u0964 \u098f\u099f\u09be\u0993 \u099a\u09b2\u09c7\u0964"), fps: 30, width: 720, swatch: SWATCH });
}

async function mixed(s) {
  await s.scene({
    name: "Mixed styles", width: 1280, height: 300, duration: 12, fps: 30, bg: BG,
    texts: [{ name: "Mixed", text: "Some words are bold, some BIG, some gold.", font: "SegoeUI", size: 50, color: WHITE, pos: [90, 170] }]
  });
  // Styles on parts of the text, as a designer sets them by selecting characters in the Comp panel.
  const r = await s.ae(`(function () {
    var st = app.project.activeItem.layer("Mixed").property("ADBE Text Properties").property("ADBE Text Document");
    var d = st.value; var t = d.text;
    if (typeof d.characterRange !== "function") return "no characterRange";
    function range(word, fn) { var i = t.indexOf(word); var cr = d.characterRange(i, i + word.length); fn(cr); }
    range("bold", function (cr) { cr.font = "SegoeUI-Bold"; });
    range("BIG", function (cr) { cr.fontSize = 80; });
    range("gold", function (cr) { cr.fillColor = [0.98, 0.75, 0.14]; });
    st.setValue(d);
    return "ok";
  })()`);
  if (r !== "ok") throw new Error(`mixed styles: ${r}`);
  await rig(s, ["Mixed"], { type: "stable" });
  await s.gif("28-mixed", { duration: until("Some words are bold, some BIG, some gold."), fps: 30, width: 720, swatch: [...SWATCH, "fbbf24"] });
}

async function voiceOver(s) {
  await s.scene({
    name: "Voice-over", width: 1280, height: 260, duration: 8, fps: 30, bg: BG,
    texts: [{ name: "Line", text: "Slow at first... then faster and faster!", font: "SegoeUI", size: 54, color: WHITE, pos: [90, 150] }]
  });
  await rig(s, ["Line"]);
  await s.marker("Line", 0, "VO: slow at first");
  await s.marker("Line", 2.4, "VO: then faster");
  await s.controls("Line", { "Frames Per Character": [[0, 6], [2.4, 6], [4, 1.5]] });
  await s.reveal("Line");
  await s.select(["Line"], 2.4);
  await s.aeShot("28-voiceover-timeline", { panel: "timeline", slice: [0, 4.6], height: 150 });
  await s.gif("28-voiceover", { duration: 6, fps: 30, width: 720, swatch: SWATCH });
}

async function nudge(s) {
  await s.scene({
    name: "Nudge", width: 1280, height: 260, duration: 10, fps: 30, bg: BG,
    texts: [{ name: "Line", text: "Hmm... wait for it.", font: "SegoeUI", size: 64, color: WHITE, pos: [110, 155] }]
  });
  await rig(s, ["Line"]);
  await s.select(["Line"], 0);
  await s.click("btnBake");
  await s.hideToast();
  await s.reveal("Line");
  // Keystroke 7 (the space after "Hmm...") and every one after it, moved later by 12 frames in
  // three steps, the way a selection of keyframes is dragged along the Timeline.
  const times = await s.ae(`(function () { var p = app.project.activeItem.layer("Line").property("ADBE Effect Parade").property("Characters Shown").property(1); return String(p.keyTime(7)); })()`);
  const t7 = Number(times);
  const move = (frames) => s.ae(`(function () {
    var c = app.project.activeItem; var p = c.layer("Line").property("ADBE Effect Parade").property("Characters Shown").property(1);
    var T = [], V = [], L = [];
    for (var i = 7; i <= p.numKeys; i++) { T.push(p.keyTime(i) + ${frames} * c.frameDuration); V.push(p.keyValue(i)); L.push(p.keyLabel(i)); }
    for (var r = p.numKeys; r >= 7; r--) p.removeKey(r);
    p.setValuesAtTimes(T, V);
    for (var k = 7; k <= p.numKeys; k++) { p.setInterpolationTypeAtKey(k, KeyframeInterpolationType.HOLD, KeyframeInterpolationType.HOLD); p.setLabelAtKey(k, L[k - 7]); p.setSelectedAtKey(k, true); }
    return "ok";
  })()`);
  // Rows after U on the baked layer: Characters Shown, then its keyframes (y 139 in the picture).
  const shot = { panel: "timeline", slice: [[0, 0.4], [t7 - 0.6, t7 + 1.2]], height: 222 };
  const at = [t7, t7, t7 + 4 / 30, t7 + 8 / 30, t7 + 12 / 30];
  await s.aeGif("28-nudge", {
    steps: [async () => {}, async () => {}, () => move(4), () => move(4), () => move(4)],
    shot, fps: 3,
    pointer: (i, pic) => ({ x: pic.place(at[i]), y: 139 })
  });
  await s.gif("28-nudged", { duration: 4, fps: 30, width: 720, swatch: SWATCH });
}

export async function run(s) {
  for (const recipe of [searchBar, chat, code, scripts, mixed, voiceOver, nudge]) {
    console.log(`  recipe: ${recipe.name}`);
    await recipe(s);
    await wait(300);
  }
}
