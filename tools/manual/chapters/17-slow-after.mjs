// Chapter 17: Slow: After Punctuation, Sentence End, Last Character and line breaks, the pauses
// around a character.
import { controlChapter } from "../control-chapter.mjs";

export const { charts, run } = controlChapter({
  id: "17-slow-after",
  title: "Slow: After Punctuation, Sentence End, Last Character and line breaks",
  text: "Well, maybe. Wait: no!\rStart again.",
  lines: 2,
  controls: [["Slow: After Punctuation", 600], ["Slow: Sentence End", 1000], ["Slow: New Line", 1000]],
  extra: [
    { label: "Last Character 300 %", values: { "Slow: Last Character": 300 }, base: { "Slow: Last Character": 0 } },
    { label: "Before Line Break 300 %", values: { "Slow: Before Line Break": 300 }, base: { "Slow: Before Line Break": 0 } }
  ],
  ring: ["Slow: After Punctuation", "Slow: Sentence End", "Slow: Last Character", "Slow: Before Line Break", "Slow: New Line"],
  duration: 12
});
