# Changelog

## 1.1.2 - 2026-10-11

- Bengali (and Devanagari and the other Indian scripts): the cursor follows the text. After
  Effects counts a joined letter (a consonant with its vowel sign, a conjunct, a reph) as one
  unit, and LazyTyper counted characters: a Dynamic rig's cursor stayed at the start of the
  line, a Stable rig's trailed the text by about a word and its text ran ahead. The Dynamic
  guide now measures the last unit with an Expression Selector, a Stable rig's typing range
  counts units, and its cursor table groups the outlined glyphs by unit. The panel asks for
  a Refresh on such a rig made with 1.1.1 or earlier.

## 1.1.1 - 2026-10-11

- After Erase with no typing later, a Dynamic rig's status counted "0 / 0 characters" and
  the rhythm preview fell back to the sample text. The panel now reads the rig's full text
  from its own expression, so it says "0 / 25 characters" and previews the real text. Rigs
  made with an earlier version get this after one Refresh.

## 1.1.0 - 2026-10-10

From trying 1.0.0 the way a designer would:

- The panel notices when a rig's cursor needs a Refresh (the font, size, tracking, alignment
  or box changed; for a Stable rig also the text) and says so in amber at the top; clicking
  that message refreshes. The Refresh button stands out too.
- Typing presets at believable speeds: Very Fast about 14 characters a second at 30 fps
  (was 26, faster than anyone types), Average about 7, Hunt & Peck about 2.5. New rigs start
  at 3 frames per character.
- Erase says what it does: typing stops and the characters backspace away over the frames.

## 1.0.0 - 2026-10-10

First version.

- Typing rigs for text layers, Dynamic (live layout, guide layer) and Stable (fixed layout,
  mixed styles), from the panel in one click, on several layers at once.
- Typing engine: base speed by Frames Per Character or Total Duration, Variance with a
  random seed, ten slow-down, four speed-up and three either-way controls, all of them
  keyframable; pause markers; deleting through Start at Character.
- Presets: Very Fast, Average, Hunt & Peck, and saved presets; rhythm preview in the panel.
- Cursor layer with blink, size, per-corner roundness and offsets; Vertical, Underscore and
  Box presets and saved presets.
- Bake to hold keyframes coloured by character type (colours in Settings), unbake.
- Timeline helpers: Start typing, Stop typing, Add pause, Erase.
- Works in both expression engines.
