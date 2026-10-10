// Chapter 17: Slow: After Punctuation, Sentence End and New Line, the pauses after a character.
import { controlChapter } from "../control-chapter.mjs";

export const { charts, run } = controlChapter({
  id: "17-slow-after",
  title: "Slow: After Punctuation, Sentence End and New Line",
  text: "Well, maybe. Wait: no!\rStart again.",
  lines: 2,
  controls: [["Slow: After Punctuation", 600], ["Slow: Sentence End", 1000], ["Slow: New Line", 1000]],
  duration: 12
});
