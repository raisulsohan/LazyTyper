// Chapter 14: Speed Mode, Frames Per Character and Total Duration.
import { rows, rig, SWATCH } from "../scenes.mjs";

const LINE = "Every key waits its turn.";
const SHORT = "Short line.";
const LONG = "A much longer line that still ends on time.";

export async function charts(c) {
  await c.drawChart(c.browser, "14-fpc-chart", c.rowsChart({
    title: "Frames Per Character",
    sub: "The same line at four base speeds, every other control at its default.",
    rows: [1, 2, 3, 6].map((f) => ({ label: `${f} frame${f === 1 ? "" : "s"}${f === 3 ? " (default)" : ""}`, text: LINE, values: { "Frames Per Character": f } }))
  }));
  await c.drawChart(c.browser, "14-total-duration-chart", c.rowsChart({
    title: "Total Duration",
    sub: "Speed Mode Total Duration, 90 frames: a short and a long line both end on frame 90.",
    rows: [SHORT, LONG].map((t) => ({ label: `${t.length} characters`, text: t, values: { "Speed Mode": 2, "Total Duration": 90 } }))
  }));
}

export async function run(s) {
  await s.scene(rows("Frames Per Character", [2, 3, 6].map((f) => ({ label: `${f} frames per character`, text: LINE }))));
  await rig(s, ["Line 1", "Line 2", "Line 3"]);
  await s.controls("Line 1", { "Frames Per Character": 2 });
  await s.controls("Line 3", { "Frames Per Character": 6 });
  await s.effectsShot("14-effect-controls", { layer: "Line 3", controls: ["Speed Mode", "Frames Per Character", "Total Duration"], context: 1 });
  await s.gif("14-fpc", { duration: 7.6, fps: 30, width: 720, swatch: SWATCH });

  await s.scene(rows("Total Duration", [{ label: "Total Duration 90", text: SHORT }, { label: "Total Duration 90", text: LONG }], { duration: 5 }));
  await rig(s, ["Line 1", "Line 2"]);
  await s.controls("Line 1", { "Speed Mode": 2 });
  await s.controls("Line 2", { "Speed Mode": 2 });
  await s.effectsShot("14-total-duration-controls", { layer: "Line 2", controls: ["Speed Mode", "Total Duration"], context: 0 });
  await s.gif("14-total-duration", { duration: 4, fps: 30, width: 720, swatch: SWATCH });
}
