// Chapter 8: Erase. Erase everything and retype another line; erase the last 6 characters to fix a
// typo and retype the word. The timings come from client/engine.js (Average preset): "Draft one:
// not quite right." is typed by 4.23 s, "Meet me at the libary" by 2.87 s.

import { WHITE, BG, SWATCH, rig as rigLayers } from "../scenes.mjs";

function oneLine(name, layer, text) {
  return {
    name, width: 1280, height: 260, duration: 11, fps: 30, bg: BG,
    texts: [{ name: layer, text, font: "SegoeUI", size: 64, color: WHITE, pos: [110, 152] }]
  };
}

const rig = (s, layer) => rigLayers(s, [layer]);

export async function run(s) {
  // 1. Erase everything, then type another line.
  await s.scene(oneLine("Erase everything", "Draft", "Draft one: not quite right."));
  await rig(s, "Draft");
  await s.select(["Draft"], 5);
  await s.info((i) => i.layers[0] && i.layers[0].shown === 27, "all 27 characters typed at 5 s");
  await s.set("eraseWhat", "all");
  await s.set("eraseFrames", 12);
  await s.shot("08-erase-panel", { clip: "cardTimeline", mark: ["eraseWhat", "eraseFrames", "btnErase"] });
  await s.aeShot("08-playhead", { panel: "timeline", slice: [4, 6], height: 116 });
  await s.record("08-erase-click", async () => {
    await s.pointTo("btnErase", { press: true });
    const t = await s.click("btnErase");
    if (!/backspace away over 12 frames/.test(t)) throw new Error(`erase: ${t}`);
    await new Promise((r) => setTimeout(r, 1800));
  }, { clip: "cardTimeline", toast: true, fps: 10 });
  await s.hideToast();
  await s.reveal("Draft");
  await s.aeShot("08-erase-timeline", { panel: "timeline", slice: [[0, 0.5], [4.6, 6.2]], height: 256 });
  // The new text: the expression off, Source Text keyed at 0 s and at 5.8 s, the expression on again.
  await s.select(["Draft"], 5.8);
  await s.expression("Draft", false);
  await s.retext("Draft", 5.8, "Draft two: much better.");
  await s.expression("Draft", false);
  await s.reveal("Draft");
  await s.aeShot("08-new-text-timeline", { panel: "timeline", slice: [[0, 0.5], [4.6, 6.2]], height: 256 });
  await s.aeShot("08-new-text-viewer", { panel: "viewer" });
  await s.expression("Draft", true);
  const started = await s.click("btnStart");
  if (!/Typing starts here/.test(started)) throw new Error(`start: ${started}`);
  await s.hideToast();
  await s.reveal("Draft");
  await s.aeShot("08-retype-timeline", { panel: "timeline", slice: [[0, 0.5], [4.6, 6.2]], height: 256 });
  await s.gif("08-erase-all", { duration: 10.2, fps: 30, width: 720, swatch: SWATCH });

  // 2. The last 6 characters: a typo fixed.
  await s.scene(oneLine("Erase the last", "Typo", "Meet me at the libary"));
  await rig(s, "Typo");
  await s.select(["Typo"], 3.4);
  await s.info((i) => i.layers[0] && i.layers[0].shown === 21, "all 21 characters typed at 3.4 s");
  await s.set("eraseWhat", "all");
  await s.set("eraseFrames", 12);
  await s.record("08-erase-last-click", async () => {
    await s.pointTo("eraseWhat", { press: true });
    await s.set("eraseWhat", "some");
    await s.pointTo("eraseChars", { press: true });
    await s.set("eraseChars", 6);
    await s.pointTo("eraseFrames", { press: true });
    await s.set("eraseFrames", 8);
    await s.pointTo("btnErase", { press: true });
    const t = await s.click("btnErase");
    if (!/the last 6 characters backspace away over 8 frames/.test(t)) throw new Error(`erase: ${t}`);
    await new Promise((r) => setTimeout(r, 1800));
  }, { clip: "cardTimeline", toast: true, fps: 10 });
  await s.hideToast();
  await s.shot("08-erase-last-panel", { clip: "cardTimeline", mark: ["eraseWhat", "eraseChars", "eraseFrames", "btnErase"] });
  await s.select(["Typo"], 3.8);
  await s.info((i) => i.layers[0] && i.layers[0].shown === 15, "15 characters shown at 3.8 s");
  await s.retext("Typo", 3.9, "Meet me at the library");
  await s.select(["Typo"], 3.9);
  await s.click("btnStart");
  await s.hideToast();
  await s.gif("08-erase-last", { duration: 5.6, fps: 30, width: 720, swatch: SWATCH });
}
