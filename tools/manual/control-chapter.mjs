// The chapters on the Slow:, Fast: and Slow/Fast: controls share one shape: a chart of the keys
// each control touches (from client/engine.js), a comp rendered by After Effects with one line per
// control (that control raised, the others at their defaults) under a line with all of them at 0,
// and Effect Controls with the controls ringed.

import { rows, rig, touched, SWATCH } from "./scenes.mjs";
import { keystrokes } from "./charts.mjs";

/**
 * id: chapter id (picture names start with it); text: the line; controls: [[name, value]] the
 * raised value each is shown at; lines: text lines per row (2 for a line break); duration: comp
 * seconds; extra: rows added to the chart, as { label, values }.
 */
export function controlChapter({ id, title, text, controls, lines = 1, duration = 10, extra = [], size = 40 }) {
  const zero = Object.fromEntries(controls.map(([n]) => [n, 0]));
  const pct = (v) => `${v > 0 ? "" : "−"}${Math.abs(v)} %`;
  return {
    async charts(c) {
      await c.drawChart(c.browser, `${id}-chart`, c.rowsChart({
        title,
        sub: "The same line, every other control at its default. Highlighted: the keys the control on that row changes.",
        legendMark: "a key the control changes",
        rows: [
          { label: "All of them at 0", text, values: zero },
          { label: "Defaults", text, values: {} },
          ...controls.map(([n, v]) => ({ label: `${n.replace(/^.*?: /, "")} ${pct(v)}`, text, values: { [n]: v }, base: { [n]: 0 }, mark: touched })),
          ...extra.map((r) => ({ text, mark: touched, ...r }))
        ]
      }));
    },
    async run(s) {
      const list = [{ label: "All at 0 %", text }, ...controls.map(([n, v]) => ({ label: `${n.replace(/^.*?: /, "")} ${pct(v)}`, text }))];
      await s.scene(rows(title, list, { duration, lines, size, gap: lines > 1 ? 100 : 90, top: 90 }));
      const layers = list.map((_, i) => `Line ${i + 1}`);
      await rig(s, layers);
      await s.controls("Line 1", zero);
      for (const [i, [n, v]] of controls.entries()) await s.controls(`Line ${i + 2}`, { [n]: v });
      await s.effectsShot(`${id}-effect-controls`, { layer: "Line 2", controls: controls.map(([n]) => n), context: 0 });
      // When the slowest line has finished (the engine in Node, which matches After Effects frame for frame).
      const end = Math.max(...[zero, ...controls.map(([n, v]) => ({ [n]: v }))].map((v) => keystrokes(text, v).at(-1).frame)) / 30;
      await s.gif(id, { duration: Math.min(duration, end + 0.8), fps: 30, width: 720, swatch: SWATCH });
    }
  };
}
