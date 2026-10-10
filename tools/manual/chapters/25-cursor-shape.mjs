// Chapter 25: Width, Top and Bottom.
import { cursorChapter } from "../cursor-chapter.mjs";

export const { run } = cursorChapter({
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
  ring: [["Width", "Top", "Bottom"], 1],
  still: 3.2,
  size: 72,
  gap: 120
});
