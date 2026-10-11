// Chapter 27: Offset Unit, X Offset and Y Offset (new rigs count offsets in % of the font size).
import { cursorChapter } from "../cursor-chapter.mjs";

export const { run } = cursorChapter({
  id: "27-cursor-offset",
  title: "Offsets",
  text: "Offset",
  list: [
    { label: "X 0, Y 0 (default)" },
    { label: "X Offset 20", values: { "X Offset": 20 } },
    { label: "X Offset −8", values: { "X Offset": -8 } },
    { label: "Y Offset 12", values: { "Y Offset": 12 } },
    { label: "Underscore, Y Offset −6", preset: "b:Underscore", values: { "Y Offset": -6 } }
  ],
  ring: [["Offset Unit", "X Offset", "Y Offset"], 2],
  still: 3.2,
  size: 72,
  gap: 115
});
