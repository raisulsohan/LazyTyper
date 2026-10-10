// Chapter 26: Roundness, Individual Corners and the four corners, on the Box cursor.
import { cursorChapter } from "../cursor-chapter.mjs";

export const { run } = cursorChapter({
  id: "26-cursor-corners",
  title: "Corners",
  text: "Box",
  list: [
    { label: "Roundness 0", preset: "b:Box", values: { Roundness: 0 } },
    { label: "Roundness 8 (Box preset)", preset: "b:Box" },
    { label: "Roundness 50", preset: "b:Box", values: { Roundness: 50 } },
    { label: "Roundness 100", preset: "b:Box", values: { Roundness: 100 } },
    { label: "Individual: Top Left 100", preset: "b:Box", values: { "Individual Corners": 1, "Top Left": 100, "Top Right": 0, "Bottom Right": 0, "Bottom Left": 0 } },
    { label: "Individual: TR + BL 100", preset: "b:Box", values: { "Individual Corners": 1, "Top Left": 0, "Top Right": 100, "Bottom Right": 0, "Bottom Left": 100 } }
  ],
  ring: [["Roundness", "Individual Corners", "Top Left", "Top Right", "Bottom Right", "Bottom Left"], 5],
  still: 3.2,
  size: 72,
  gap: 105
});
