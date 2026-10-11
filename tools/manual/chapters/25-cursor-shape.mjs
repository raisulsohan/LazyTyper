// Chapter 25: Width, Top, Bottom and Size From; with mixed font sizes, the two Follow switches.
import { cursorChapter } from "../cursor-chapter.mjs";
import { rows, rig, SWATCH } from "../scenes.mjs";
import { keystrokes } from "../charts.mjs";
import { createRequire } from "node:module";

const RIG = createRequire(import.meta.url)("../../../client/rig.js");

const shape = cursorChapter({
  id: "25-cursor-shape",
  title: "Cursor shape",
  text: "Shape",
  list: [
    { label: "Width 7, Top 80, Bottom 16 (default)" },
    { label: "Width 25", values: { Width: 25 } },
    { label: "Top 40", values: { Top: 40 } },
    { label: "Bottom 40", values: { Bottom: 40 } },
    { label: "Width 55, Top −6, Bottom 14", values: { Width: 55, Top: -6, Bottom: 14 } }
  ],
  ring: [["Width", "Top", "Bottom", "Size From", "Height Follows Size", "Width Follows Size"], 1],
  still: 3.2,
  size: 72,
  gap: 120
});

const MIXED = "Small BIG small";

/*
 * A Stable line with a word at twice the size, three times: the Vertical cursor (taller, not
 * wider, beside the big word), the Underscore (both), and the Vertical with Size From: Character
 * After (already big before the B).
 */
async function mixedSizes(s) {
  const list = [
    { label: "Vertical", text: MIXED },
    { label: "Underscore", text: MIXED },
    { label: "Vertical, Size From: Character After", text: MIXED }
  ];
  await s.scene(rows("Mixed sizes", list, { size: 48, gap: 130, top: 120, duration: 8, labelWidth: 520 }));
  const r = await s.ae(`(function () {
    var c = app.project.activeItem;
    for (var n = 1; n <= 3; n++) {
      var st = c.layer("Line " + n).property("ADBE Text Properties").property("ADBE Text Document");
      var d = st.value;
      if (typeof d.characterRange !== "function") return "no characterRange";
      d.characterRange(6, 9).fontSize = 96;
      st.setValue(d);
    }
    return "ok";
  })()`);
  if (r !== "ok") throw new Error(`mixed sizes: ${r}`);
  await rig(s, ["Line 1", "Line 3"], { type: "stable", cursor: "b:Vertical" });
  await rig(s, ["Line 2"], { type: "stable", cursor: "b:Underscore" });
  await s.controls("Line 3 Cursor", { "Size From": 2 });
  const end = keystrokes(MIXED, RIG.TYPING_PRESETS[1].values).at(-1).frame / 30;
  await s.gif("25-mixed-sizes", { duration: end + 1.2, fps: 30, width: 720, swatch: SWATCH });
}

export async function run(s) {
  await shape.run(s);
  await mixedSizes(s);
}
