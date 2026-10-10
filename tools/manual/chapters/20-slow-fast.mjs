// Chapter 20: Slow/Fast: Spaces, Same Hand and Fatigue, which slow down above 0 and speed up below it.
import { controlChapter } from "../control-chapter.mjs";

export const { charts, run } = controlChapter({
  id: "20-slow-fast",
  title: "Slow/Fast: Spaces, Same Hand and Fatigue",
  text: "Typing a longer line slowly tires the hands out",
  controls: [["Slow/Fast: Spaces", 200], ["Slow/Fast: Same Hand", 200], ["Slow/Fast: Fatigue", 200]],
  extra: [
    { label: "Spaces −50 %", values: { "Slow/Fast: Spaces": -50 }, base: { "Slow/Fast: Spaces": 0 } },
    { label: "Same Hand −50 %", values: { "Slow/Fast: Same Hand": -50 }, base: { "Slow/Fast: Same Hand": 0 } },
    { label: "Fatigue −50 %", values: { "Slow/Fast: Fatigue": -50 }, base: { "Slow/Fast: Fatigue": 0 } }
  ],
  duration: 12
});
