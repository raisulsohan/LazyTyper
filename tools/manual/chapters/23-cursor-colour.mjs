// Chapter 23: Show Cursor, Use Text Color, Cursor Color and Cursor Opacity.
import { cursorChapter } from "../cursor-chapter.mjs";

export const { run } = cursorChapter({
  id: "23-cursor-colour",
  title: "Cursor colour",
  text: "Colour me in",
  list: [
    { label: "Use Text Color (white)" },
    { label: "Cursor Color amber", values: { "Use Text Color": 0, "Cursor Color": [0.98, 0.75, 0.14, 1] } },
    { label: "Cursor Color pink", values: { "Use Text Color": 0, "Cursor Color": [0.96, 0.45, 0.71, 1] } },
    { label: "Cursor Opacity 35 %", values: { "Cursor Opacity": 35 } }
  ],
  ring: [["Show Cursor", "Use Text Color", "Cursor Color", "Cursor Opacity"], 2],
  still: 3.2
});
