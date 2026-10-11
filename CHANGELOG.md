# Changelog

## Unreleased

Rigs and presets made with 1.2.0 keep typing and looking exactly as before: the new controls
start at values that change nothing, and Refresh, Bake and Unbake add them to an older rig.

- **Presets type as fast at any frame rate.** A typing preset keeps the frame rate it was made
  at (the built-in ones 30 fps; a saved one, its comp's) and converts *Frames Per Character* and
  *Total Duration* to the comp's rate when it is applied or used to create a rig: Very Fast types
  about 14 characters a second at 24, 25, 30, 50 or 60 fps (it was 11 at 24 fps and 27 at 60).
  Presets saved with 1.2.0 or earlier count as made at 30 fps; a copy of the old file is kept
  as `presets-before-1.3.json`. Under the preset, the panel shows how many characters a second
  it types and what that is in this comp's frames.
- **Slow: Last Character**: an extra wait before the last character of the text (spaces and
  line breaks after it don't count), so a closing "." or "!" lands with a beat.
- **Fast: Capitals in a Row** and **Fast: Numbers in a Row**: in "NASA" or "2026" the first
  key keeps all of *Slow: Capitals* or *Slow: Numbers* and the ones after it lose this share of
  it (100 %: they type like small letters).
- **Line breaks in stages**: **Slow: Before Line Break** is the wait before Return is pressed
  (*Slow: New Line* is still the wait after it), and **Slow/Fast: Empty Lines** makes each extra
  Return in a row slower or faster.
- **Slow: Same Finger**: two letters in a row typed by the same finger on different keys (QWERTY
  touch typing: "ed", "un", "lo"), which slows fast typists down.
- **Fast: Repeated Letters** works both ways: below 0 a double letter slows down (fast typists
  stumble on it), above 0 it speeds up as before. A rig or preset from 1.2.0 with a value below
  0, which did nothing then, gets 0 when it is brought up to date.
- The built-in presets use the new controls: Very Fast slows on double letters and same-finger
  pairs, Hunt & Peck speeds up on double letters; their base speeds moved a little (Very Fast
  2.05 frames per character, Average 2.9) so each types as many characters a second as before.
- Refresh puts controls it adds in their place in Effect Controls, not at the end.

The cursor:

- **Size From** (Character Before / Character After, can be keyframed): with mixed font sizes
  in a Stable rig, the cursor takes the size of the character it follows, as before, or of the
  one it comes before. **Height Follows Size** and **Width Follows Size** choose what grows: the
  Vertical preset now keeps its width beside a big word (only its height grows), Underscore and
  Box grow both ways. A dimension that does not follow keeps the text's main size.
- **Show Cursor**: switch the cursor off and on (keyframe it), whatever its opacity and blink.
- **Offset Unit**: X Offset and Y Offset in pixels, or in % of the font size so they grow with
  the text (new rigs and the built-in presets). Cursors made earlier, and cursor presets saved
  earlier, keep pixels.
- **Use Text Color**: a new cursor takes the text's fill colour (white when it has none): a
  Dynamic rig the first character's, a Stable rig the colour of the character it takes its size
  from, so it turns red beside a red word. Turn it off to use Cursor Color. While it is on, the
  panel asks for a Refresh when the text's colours change. Older cursors keep Cursor Color.
- **Shift+click Refresh** switches the selected rigs between Dynamic and Stable, keeping every
  typing and cursor value (a Stable rig with mixed sizes or colours shows its first style as a
  Dynamic rig; switching back brings them back).
- **Refresh on a baked rig** unbakes it, rebuilds it and bakes it again from its controls, so the
  keys follow a changed text. The panel asks first: keystrokes moved by hand go back.
- **Duplicating or pasting a whole rig** (text, cursor and guide, in the same comp or another)
  gives a rig of its own: the cursor finds its text by parenting, which After Effects carries over
  to the copies (a Dynamic cursor now sits under the guide). The cursor's Text Layer and Guide
  Layer controls, which a copy kept pointing at the original, are gone; Refresh takes them off an
  older rig, which until then keeps working as before.

## 1.2.0 - 2026-10-11

- Mixed font sizes in a Stable rig: the cursor takes the size of the last character typed (it
  grows beside a big word and shrinks back after it), and the gap after a letter and the width
  of a space follow each character's size. Reads the text's character styles (After Effects
  24.3 and later; older versions keep using the first style).
- The panel's Refresh prompt now also notices a font, size or tracking change on part of a
  Stable rig's text (it compares where the lines start and end and the text's bounds), but not
  a colour change, which needs no Refresh. Rigs made earlier get the new check at their next
  Refresh.

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
