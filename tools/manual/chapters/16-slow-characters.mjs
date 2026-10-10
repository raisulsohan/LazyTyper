// Chapter 16: Slow: Capitals, Numbers, Symbols and Punctuation, the controls that slow keys by what they are.
import { controlChapter } from "../control-chapter.mjs";

export const { charts, run } = controlChapter({
  id: "16-slow-characters",
  title: "Slow: Capitals, Numbers, Symbols and Punctuation",
  text: "Order #42: ships to NYC & Rome (today)!",
  controls: [["Slow: Capitals", 300], ["Slow: Numbers", 300], ["Slow: Symbols", 300], ["Slow: Punctuation", 300]]
});
