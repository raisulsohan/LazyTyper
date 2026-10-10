# LazyTyper

**Natural typing animation for After Effects, in one click.** Select a text layer, press
*Create Typing Rig*, and it types on like a person would: faster through common words,
slower on capitals and symbols, a breath after a comma, a longer one after a full stop,
with a blinking cursor that follows the text. **Version 1.1** · free · MIT licence · one of
Raisul Sohan's Lazy tools.

Other typing rigs give every character the same time, which looks robotic. LazyTyper sets
a base speed and lets each character's neighbours speed it up or slow it down, so the
rhythm stays natural, and it stays natural when you change the text.

## What it does

- **One-click typing rig** on any text layer, point or paragraph text, several layers at once.
- **Base speed** as *Frames Per Character* or as a *Total Duration* for the whole text.
- **Variance**: how often a key comes late, repeatable through a random seed.
- **Slow down** controls: capitals, numbers, symbols, punctuation, after punctuation,
  sentence ends, new lines, word starts, long words, hard-to-reach letters.
- **Speed up** controls: repeated letters, common letter pairs, common words, momentum inside a word.
- **Slow down or speed up** controls: spaces, letters typed with the same hand, fatigue over the text.
- **Three typing presets** (Very Fast, Average, Hunt & Peck) and your own, saved from any rig.
- **Every control can be keyframed**: change speed mid-sentence, stop, delete, type again.
- **Pauses** where you want them: a *Pause* layer marker; drag its end to set the length.
- **Erase** everything or the last few characters, backspace by backspace, then retype.
- **Two rig types**: *Dynamic* (re-wraps and re-centres as it types) and *Stable* (keeps mixed fonts and colours).
- **Bake to keyframes** coloured by what is typed (letters, numbers, punctuation, spaces,
  deleting) and nudge any keystroke by hand. Shift+click to unbake.
- **A real cursor layer**: colour, blink rate and softness, solid while typing, width that
  grows to the right, top and bottom set separately, all four corners rounded together or
  one by one, offsets. Presets: Vertical, Underscore, Box, and your own.
- Works with both expression engines (JavaScript and Legacy ExtendScript); everything is
  plain expressions, so a rig keeps working without the panel.

## Install

1. Download `LazyTyper-v1.1.zip` from the [releases page](https://github.com/raisulsohan/LazyTyper/releases) and unzip it.
2. Close After Effects.
3. Windows: double-click **Install LazyTyper.bat**. macOS: double-click **Install LazyTyper (macOS).command**.
4. Start After Effects and open **Window › Extensions › LazyTyper**.

The panel is signed: no extension manager, no debug switch. *Read me first.txt* in the
download has the details and what to do if the panel opens blank.

## Quick start

1. Select one or more text layers.
2. In **1 · Create rig** choose *Dynamic* or *Stable*, a typing style and a cursor.
3. Click **Create Typing Rig** and press play.

| | Dynamic | Stable |
|---|---|---|
| Paragraph text wraps word by word as it types | yes | no (layout fixed) |
| Centred or right-aligned lines re-centre as they grow | yes | no |
| Mixed fonts, sizes and colours | no (first style) | yes |
| Extra layers | cursor + hidden guide | cursor |
| Change the text | nothing to do | click Refresh |
| Change font, size, tracking or the box | click Refresh | click Refresh |

## The controls

On the **text layer** (Effect Controls):

| Control | What it does |
|---|---|
| Typing | Typing runs while this is on. Each time it switches on, the first character comes at once. |
| Start at Character | Characters already showing when typing starts. Lower it while Typing is off to delete. |
| Speed Mode | *Frames Per Character* or *Total Duration*. |
| Frames Per Character / Total Duration | The base speed. |
| Variance, Random Seed | How likely a key comes late (by 25-150 %), and which keys. |
| Slow: … | 100 % makes those characters take twice as long. |
| Fast: … | 100 % makes those characters twice as fast. |
| Slow/Fast: … | Positive slows down, negative speeds up. |
| Characters Shown | The result. *Bake* turns it into keyframes. |

**Matching a typist:** a fast typist has a quick base speed, low variance, a few
slow-downs and some speed-ups; a slow typist the opposite.

On the **cursor layer**: Text Layer, Cursor Color, Cursor Opacity, Blink, Blinks per
Second, Blink While Typing (off: solid while keys come in), Blink Softness, Width, Top,
Bottom (percent of the font size), Roundness, Individual Corners with Top Left, Top Right,
Bottom Right, Bottom Left, X Offset, Y Offset.

## The panel

- **Typing speed**: apply a preset to the selected rigs, see the rhythm it gives the
  selected text, save a rig's settings as your own preset.
- **At the playhead**: *Start typing*, *Stop typing*, *Add pause*, *Erase* (everything or
  the last N characters over N frames).
- **Rig**: *Refresh*, *Bake* (Shift+click: unbake), *Remove* (the cursor and guide go too).
  When the font, size, layout or (Stable) text changed since the cursor was measured, the top
  of the panel turns amber and says so; click it to refresh.
- **Cursor**: apply or save cursor presets, add a cursor to a rig that has none.
- **Settings**: the label colours baked keyframes get.

Delete and retype: *Stop typing*, *Erase*, keyframe the new Source Text, *Start typing*.

## Good to know

- Long texts: the JavaScript expression engine (File › Project Settings › Expressions) is
  several times faster than Legacy ExtendScript; baking makes any rig instant.
- A rig is made of ordinary expression controls, a text animator and expressions. Sending a
  project to someone without LazyTyper is fine.

## Building from source

See [docs/development.md](docs/development.md): how it works, the tests (Node and inside
After Effects) and how a release is built.

## Licence

MIT, see [LICENSE](LICENSE). `lib/CSInterface.js` is Adobe's, under its own licence.
