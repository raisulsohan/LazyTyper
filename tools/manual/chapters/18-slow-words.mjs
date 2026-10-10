// Chapter 18: Slow: Word Start, Long Words and Rare Letters.
import { controlChapter } from "../control-chapter.mjs";

export const { charts, run } = controlChapter({
  id: "18-slow-words",
  title: "Slow: Word Start, Long Words and Rare Letters",
  text: "Jack quickly fixed the extraordinary vintage jukebox",
  controls: [["Slow: Word Start", 200], ["Slow: Long Words", 300], ["Slow: Rare Letters", 300]],
  duration: 15
});
