# Building from source

How LazyTyper works, the rules its code keeps, how it is tested and how a release is
built. *Written for LazyTyper 1.2.0.*

## How it fits together

```
client/  (CEP panel: Chromium 61 + Node 8, mixed context, ES5)
  engine.js   lazyTyperRun(io): how many characters show at a time. ES3. Its source is
              copied into the rig's expressions, run by the Node tests, and run once with
              io.record = true to bake.
  rig.js      the controls a rig adds, the built-in presets, and every expression the
              host writes (built from engine.js with Function.prototype.toString)
  main.js     the panel: presets and settings (%APPDATA%\LazyTyper), the host bridge,
              the rhythm preview
      |  CSInterface.evalScript('LT_call("createRig", "{...}")')
      v
host/host.jsx  (ExtendScript, ES3, ASCII)
  builds, measures, refreshes, bakes and removes rigs; every call returns JSON
```

The panel sends the control definitions and the expressions with every call, so the host
holds no copy of them.

### A rig

| Layer | Stable | Dynamic |
|---|---|---|
| Text layer | the controls; *Characters Shown* runs the engine; an animator **LazyTyper** (Opacity 0, index range from the first untyped character) | the controls; **Source Text** runs the engine and shows `text.substr(0, count)`; *Characters Shown* reads the shown length back |
| Cursor (shape layer, comment `LazyTyper cursor`) | parented to the text; position from a table of cursor points per Source Text keyframe, measured with *Create Shapes from Text* | parented to the text; position from the guide's bounds |
| Guide (comment `LazyTyper guide`) | none | a hidden, disabled guide copy parented to the text with an identity transform; shows what the text shows, and an animator (Scale 0, an Expression Selector on Characters Excluding Spaces that leaves out the last unit) makes `sourceRectAtTime` the box of that one unit |

Baking replaces *Characters Shown*'s expression with hold keyframes (labelled by
character class) from one recorder run; a Dynamic rig's Source Text then switches to an
expression that reads those keyframes.

## After Effects facts the design rests on

Found by `tools/spikes/spikes.jsx` and later probes in After Effects 26.5:

- `sourceRectAtTime` follows text animators that **scale** characters (not opacity), so a
  Scale-0 animator can measure a single character.
- A range selector's index **does not count line breaks**, and it counts **units** (grapheme
  clusters), not characters: a Bengali consonant with its vowel sign, a conjunct or a reph is
  one unit (`LT_unit`/`LT_join` in rig.js, `joinsPrevious` in host.jsx; `tools/spikes/bengali-cursor.jsx`).
- An Expression Selector's `textIndex`/`textTotal` count the same units; based on Characters
  Excluding Spaces, `textIndex === textTotal` is the last unit with a shape.
- Create Shapes from Text names each glyph after a character of its unit, not always its own
  (the Bengali i-sign drawn before its letter carries the letter's name), in visual order.
- Range selector *Index End* is capped at 99999.
- The legacy expression engine has no `sourceText.style` and **throws on reading a
  property that does not exist**; the expressions read only fields they always set, use
  `hasOwnProperty`, or `try`.
- Inside its own expression, `thisProperty.valueAtTime(t)` and `value` give the
  pre-expression value. From ExtendScript, a Source Text value is always read **after** its
  expression (`valueAtTime(t, true)` and `keyValue` included); only switching the
  expression off shows the raw text, which the host does inside undo groups only. To read
  a Dynamic rig's full text while polling, the host asks its expression instead: at
  `LT_PEEK + t` (hours before the comp starts) it shows the whole text at t.
- `valueAtTime` clamps times to -10800 .. 10800 s (3 hours, the longest comp), for
  expressions too.
- Two expressions that read each other (Source Text and Characters Shown) resolve
  unpredictably in the JavaScript engine, so the Dynamic rig keeps one direction at a time.
- Create Shapes from Text (`3781`) makes one group per glyph, named by its character, in
  the text layer's space; spaces and line breaks get none.
- `TextDocument.characterRange(i, i + 1).fontSize` (After Effects 24.3+) reads one
  character's size: a Stable rig's cursor sizes (`charSizes`, `cursorSizes` in host.jsx) come
  from it. A font, size or tracking change on part of the text moves `baselineLocs` (each
  line's start and end) and the text's bounds, which is what the Refresh fingerprint
  compares; a colour change moves neither.

## Rules the code keeps

- `host/host.jsx`, `client/engine.js` and every expression are **ES3 and ASCII**: no
  trailing commas, no `Array.prototype.indexOf`, no reserved words as property names,
  non-ASCII as `\uXXXX` (`npm run check` escapes and verifies). Full-line comments only
  inside `lazyTyperRun`: they are stripped when it becomes an expression.
- The panel is ES5 (CEP 9): no `let`/`const`, arrow functions, template strings or flex
  `gap`.
- The panel asks After Effects about the selection only while the pointer is over it or
  right after an action. Background polling made After Effects show "internal
  verification failure" boxes and refuse other tools' scripts.
- Every host call runs with dialogs suppressed, in one undo group per action, and puts the
  layer selection back afterwards.

## Tests

```
npm test            # ES3/ASCII check of host, engine and all expressions + engine tests (Node)
npm run test:ae     # rigs built and checked inside After Effects, both expression engines
npm run test:ui     # the real panel driven through DevTools (port 8125), screenshots in .cache/ui
```

`test:ae` and `test:ui` start After Effects when it is not running and work in a new
project (`tools/ae/fresh-project.jsx` saves a copy of an open, non-empty project to
`%TEMP%\LazyTyper\backups` first). They need the dev link and PlayerDebugMode:

```
ENABLE_DEBUG_MODE.bat
npm run dev:link        # %APPDATA%\Adobe\CEP\extensions\com.sohan.LazyTyper -> this folder
```

Driving After Effects from the command line (`tools/ae-run.mjs`):

- Close a project and build in the new one in **separate** script runs, or After Effects
  shows "internal verification failure, sorry! {no current context}".
- Send each script once. A script sent while a box is open queues and later comes back as
  "Attempt was made to run a second script".
- The "Executing Script ..." progress window is a `#32770` window like a message box but
  has a title; closing it cancels the script ("Unable to execute script at line N.
  Execution halted"). `tools/ae-dismiss.ps1` only closes untitled ones.
- Both test runners fail when an After Effects message box is on screen at the end.
- The PowerShell helpers (`ae-dialogs.ps1`, `ae-dismiss.ps1`, `screen-capture.ps1`) run through
  `tools/ps.mjs` as an encoded command: Windows' default execution policy refuses
  `powershell -File`, and the tools never change that policy.

`npm run preview` serves the panel at http://localhost:5191/client/index.html with a
stand-in host, for working on the layout in a browser.

## Building a release

1. Set the version in `package.json`; add the CHANGELOG entry.
2. `npm run release:cert` once (creates `Signing key (do not share)/lazytyper.p12`; never
   commit or share it), then `npm run release`: tests, version sync, signing, and the zip
   in `D:\GitHub\00. Install from here`.
3. Try the zip on After Effects by hand (remove the dev link first: `npm run dev:unlink`).
4. GitHub release `vX.Y.Z` with the zip and its SHA-256.
