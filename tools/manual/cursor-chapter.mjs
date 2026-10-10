// The chapters on the cursor layer's controls share one shape: lines one under another, each
// rigged with a cursor whose controls differ (set on the "<line> Cursor" layer, as a user does in
// Effect Controls), rendered by After Effects as a still or a GIF, and Effect Controls of one
// cursor layer with the controls ringed.

import { rows, rig, SWATCH } from "./scenes.mjs";

/**
 * id: chapter id; list: [{ label, values, preset }] one line each (preset: a cursor preset id to
 * create the rig with, "b:Vertical" by default); ring: [cursor controls to ring, from which line];
 * still: time of a still (a GIF when gif is set: { start, duration }).
 */
export function cursorChapter({ id, title, text, list, ring, still = null, gif = null, size = 56, gap = 110, duration = 6, swatch = [] }) {
  return {
    async run(s) {
      await s.scene(rows(title, list.map((r) => ({ label: r.label, text })), { size, gap, duration, labelWidth: 470 }));
      const layers = list.map((_, i) => `Line ${i + 1}`);
      // One click per cursor preset in use, as a user would rig them.
      const byPreset = new Map();
      list.forEach((r, i) => { const p = r.preset ?? "b:Vertical"; if (!byPreset.has(p)) byPreset.set(p, []); byPreset.get(p).push(layers[i]); });
      for (const [preset, names] of byPreset) await rig(s, names, { cursor: preset });
      for (const [i, r] of list.entries()) if (r.values) await s.controls(`Line ${i + 1} Cursor`, r.values);
      if (ring) await s.effectsShot(`${id}-effect-controls`, { layer: `Line ${ring[1]} Cursor`, controls: ring[0], context: 0 });
      if (still !== null) await s.strip(id, [{ time: still, label: "" }], { width: 1280 });
      if (gif) await s.gif(id, { start: gif.start ?? 0, duration: gif.duration, fps: 30, width: 720, swatch: [...SWATCH, ...swatch] });
    }
  };
}
