// Chapter 18: Slow: Word Start, Long Words, Rare Letters and Same Finger.
import { controlChapter } from "../control-chapter.mjs";

export const { charts, run } = controlChapter({
  id: "18-slow-words",
  title: "Slow: Word Start, Long Words, Rare Letters and Same Finger",
  text: "Jack quickly fixed the extraordinary vintage jukebox",
  controls: [["Slow: Word Start", 200], ["Slow: Long Words", 300], ["Slow: Rare Letters", 300]],
  extra: [
    { label: "Same Finger 300 %", values: { "Slow: Same Finger": 300 }, base: { "Slow: Same Finger": 0 } }
  ],
  ring: ["Slow: Word Start", "Slow: Long Words", "Slow: Rare Letters", "Slow: Same Finger"],
  duration: 15
});
