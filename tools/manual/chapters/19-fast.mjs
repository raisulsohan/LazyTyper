// Chapter 19: Fast: Repeated Letters, Capitals and Numbers in a Row, Common Pairs, Common Words and
// Word Momentum.
import { controlChapter } from "../control-chapter.mjs";

const CAPS = "NASA and ESA booked 2026 seats for $1500";

export const { charts, run } = controlChapter({
  id: "19-fast",
  title: "Fast: Repeated Letters, Capitals and Numbers in a Row, Common Pairs, Common Words and Word Momentum",
  text: "the committee will meet in the coffee shop at noon",
  controls: [["Fast: Repeated Letters", 200], ["Fast: Common Pairs", 200], ["Fast: Common Words", 200], ["Fast: Word Momentum", 200]],
  extra: [
    { label: "Repeated Letters −50 %", values: { "Fast: Repeated Letters": -50 }, base: { "Fast: Repeated Letters": 0 } },
    { label: "Capitals: defaults", text: CAPS, values: {}, mark: null },
    { label: "Capitals in a Row 100 %", text: CAPS, values: { "Fast: Capitals in a Row": 100 }, base: { "Fast: Capitals in a Row": 0 } },
    { label: "Numbers in a Row 100 %", text: CAPS, values: { "Fast: Numbers in a Row": 100 }, base: { "Fast: Numbers in a Row": 0 } }
  ],
  ring: ["Fast: Repeated Letters", "Fast: Capitals in a Row", "Fast: Numbers in a Row", "Fast: Common Pairs", "Fast: Common Words", "Fast: Word Momentum"],
  duration: 9
});
