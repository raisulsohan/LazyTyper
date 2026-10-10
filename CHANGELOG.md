# Changelog

## Unreleased

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
