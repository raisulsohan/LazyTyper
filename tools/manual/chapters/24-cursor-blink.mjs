// Chapter 24: Blink, Blinks per Second, Blink While Typing and Blink Softness.
import { cursorChapter } from "../cursor-chapter.mjs";

export const { run } = cursorChapter({
  id: "24-cursor-blink",
  title: "Blink",
  text: "Blink, blink",
  list: [
    { label: "Blink off", values: { Blink: 0 } },
    { label: "1 per second (default)" },
    { label: "3 per second", values: { "Blinks per Second": 3 } },
    { label: "Softness 100 %", values: { "Blink Softness": 100 } },
    { label: "Blink While Typing on", values: { "Blink While Typing": 1 } }
  ],
  ring: [["Blink", "Blinks per Second", "Blink While Typing", "Blink Softness"], 2],
  gif: { duration: 4.5 },
  size: 46,
  gap: 90
});
