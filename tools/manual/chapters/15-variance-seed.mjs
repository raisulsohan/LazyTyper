// Chapter 15: Variance and Random Seed. The same line at Variance 0, 35 and 100, the same line with
// three seeds, and charts of which keys the engine makes late.

import { rig } from "../scenes.mjs";

const LINE = "Typing looks human when some keys come late.";

const late = (i, w, w0) => i > 0 && w[i] / w0[i] > 1.2;

export async function charts(c) {
  await c.drawChart(c.browser, "15-variance-chart", c.rowsChart({
    title: "The same line at four Variance values",
    sub: "Random Seed 1, every other control at its default (the Average preset). A highlighted letter is a key the engine made late.",
    legendMark: "a late key",
    rows: [0, 35, 70, 100].map((v) => ({
      label: `Variance ${v} %${v === 35 ? " (default)" : ""}`, text: LINE, values: { Variance: v }, base: { Variance: 0 }, mark: late
    }))
  }));
  await c.drawChart(c.browser, "15-seed-chart", c.rowsChart({
    title: "The same Variance with three Random Seeds",
    sub: "Variance 35 %. Each seed picks its own keys to make late; the same seed always picks the same ones.",
    legendMark: "a late key",
    rows: [1, 2, 3].map((seed) => ({
      label: `Random Seed ${seed}`, text: LINE, values: { Variance: 35, "Random Seed": seed }, base: { Variance: 0 }, mark: late
    }))
  }));
  await c.drawChart(c.browser, "15-total-duration-chart", c.rowsChart({
    title: "Variance in Total Duration mode",
    sub: "Speed Mode Total Duration, 90 frames. The take still lasts 90 frames: late keys borrow their time from the others.",
    legendMark: "a late key",
    rows: [0, 100].map((v) => ({
      label: `Variance ${v} %`, text: LINE, values: { Variance: v, "Speed Mode": 2, "Total Duration": 90 },
      base: { Variance: 0, "Speed Mode": 2, "Total Duration": 90 }, mark: late
    }))
  }));
}

const WHITE = [0.95, 0.94, 0.98];
const GREY = [0.55, 0.53, 0.66];
const SWATCH = ["15131f", "f1effa", "8d87a8", "a78bfa"];

/** Three copies of the line, each with a label, in one comp. */
function threeLines(name, labels) {
  return {
    name, width: 1280, height: 440, duration: 10, fps: 30, bg: [0.082, 0.075, 0.122],
    texts: labels.flatMap((label, i) => [
      { name: label, text: label, font: "SegoeUI", size: 26, color: GREY, pos: [60, 120 + i * 120], locked: true },
      { name: `Line ${i + 1}`, text: LINE, font: "SegoeUI", size: 44, color: WHITE, pos: [300, 122 + i * 120] }
    ])
  };
}

const rigLines = (s) => rig(s, ["Line 1", "Line 2", "Line 3"]);

export async function run(s) {
  // Variance 0, 35 and 100 side by side.
  await s.scene(threeLines("Variance", ["Variance 0 %", "Variance 35 %", "Variance 100 %"]));
  await rigLines(s);
  await s.controls("Line 1", { "Variance": 0 });
  await s.controls("Line 3", { "Variance": 100 });
  await s.select(["Line 3"], 0);
  await s.effectsShot("15-effect-controls", { layer: "Line 3", controls: ["Variance", "Random Seed"], context: 5, upTo: "Slow: Capitals" });
  await s.gif("15-variance", { duration: 9.6, fps: 30, width: 720, swatch: SWATCH });

  // Random Seed 1, 2 and 3 at Variance 35.
  await s.scene(threeLines("Seeds", ["Random Seed 1", "Random Seed 2", "Random Seed 3"]));
  await rigLines(s);
  await s.controls("Line 2", { "Random Seed": 2 });
  await s.controls("Line 3", { "Random Seed": 3 });
  await s.gif("15-seeds", { duration: 7.5, fps: 30, width: 720, swatch: SWATCH });
}
