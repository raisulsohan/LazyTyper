// Chapter 13: Typing and Start at Character.
import { rows, rig, SWATCH } from "../scenes.mjs";

const LINE = "Already here, then the rest types on.";

export async function charts(c) {
  await c.drawChart(c.browser, "13-chart", c.rowsChart({
    title: "Typing and Start at Character",
    sub: "Every other control at its default.",
    rows: [
      { label: "Start at Character 0", text: LINE, values: {} },
      { label: "Start at Character 13", text: LINE, values: { "Start at Character": 13 } },
      { label: "Typing off until 1 s", text: LINE, values: { Typing: (t) => (t < 1 - 1e-6 ? 0 : 1) } }
    ]
  }));
}

export async function run(s) {
  await s.scene(rows("Typing and Start", [
    { label: "Start at Character 0", text: LINE },
    { label: "Start at Character 13", text: LINE },
    { label: "Typing off until 1 s", text: LINE }
  ], { duration: 7 }));
  await rig(s, ["Line 1", "Line 2", "Line 3"]);
  await s.controls("Line 2", { "Start at Character": 13 });
  await s.controls("Line 3", { Typing: [[0, 0], [1, 1]] });
  await s.effectsShot("13-effect-controls", { layer: "Line 2", controls: ["Typing", "Start at Character"], context: 0, upTo: "Speed Mode" });
  await s.reveal("Line 3");
  await s.select(["Line 3"], 1);
  await s.aeShot("13-timeline", { panel: "timeline", slice: [0, 1.6], height: 150 });
  await s.gif("13-typing", { duration: 6, fps: 30, width: 720, swatch: SWATCH });
}
