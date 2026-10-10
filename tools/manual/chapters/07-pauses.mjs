// Chapter 7: pauses: Add pause, the Pause marker, dragging its end, a marker typed by hand.
import { line, rig, SWATCH } from "../scenes.mjs";
import { keystrokes } from "../charts.mjs";

const TEXT = "Let me think... yes, that works.";
// One frame after "think..." has been typed (the 15th character, Average preset): a pause that
// starts on the very frame a key would appear holds that key back until it ends.
const AT = (keystrokes(TEXT, {})[14].frame + 1) / 30;
const wait = (ms) => new Promise((r) => setTimeout(r, ms));

export async function charts(c) {
  await c.drawChart(c.browser, "07-pause-chart", c.rowsChart({
    title: "A Pause marker",
    sub: `Every control at its default. The marker starts at ${AT.toFixed(2)} s, one frame after "think..." has been typed.`,
    rows: [
      { label: "No marker", text: TEXT, values: {} },
      { label: "Pause, 15 frames", text: TEXT, values: {}, pauses: [[AT, AT + 15 / 30]] },
      { label: "Pause, 45 frames", text: TEXT, values: {}, pauses: [[AT, AT + 45 / 30]] }
    ]
  }));
}

export async function run(s) {
  await s.scene(line("Pause", "Line", TEXT, { duration: 10 }));
  await rig(s, ["Line"]);
  await s.select(["Line"], AT);
  await s.set("pauseFrames", 15);
  await s.shot("07-card", { clip: "cardTimeline", mark: ["btnPause", "pauseFrames"] });
  await s.record("07-add", async () => {
    await s.pointTo("btnPause", { press: true });
    const t = await s.click("btnPause");
    if (!/Pause of 15 frames/.test(t)) throw new Error(`pause: ${t}`);
    await wait(1800);
  }, { clip: "cardTimeline", toast: true, fps: 8 });
  await s.hideToast();
  const shot = { panel: "timeline", slice: [AT - 0.6, AT + 2.2], height: 116 };
  await s.aeShot("07-marker", shot);
  // Dragging the marker's end from 15 to 45 frames: a script changes the marker step by step and
  // the pointer shows where a hand drags it (the marker's end, on the Line layer's row).
  const frames = [15, 15, 20, 25, 30, 35, 40, 45];
  await s.aeGif("07-drag", {
    steps: frames.map((f) => async () => { await s.markerFrames("Line", 1, f); }),
    shot, fps: 5,
    pointer: (i, pic) => ({ x: pic.place(AT + frames[i] / 30), y: 104 })
  });
  await s.gif("07-pause", { duration: 9.6, fps: 30, width: 720, swatch: SWATCH });
}
