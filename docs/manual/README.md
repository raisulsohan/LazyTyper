# The LazyTyper manual

Every option of LazyTyper, one tutorial at a time: what it does, where to find it, how to use it step
by step, what the typing engine really does with it, and the mistakes to avoid. The pictures come
from the real panel and from After Effects itself; the animations are rendered by After Effects, and
the charts are drawn from the same typing engine the rigs run.

The short version is the [README](../../README.md). This manual is the long one. It is also on
[raisulsohan.com](https://raisulsohan.com/en/portfolio/lazytyper/documentation/).

## How every chapter is laid out

1. **What it does**: a paragraph and the result, usually as an animation.
2. **Where to find it**: the panel or Effect Controls with the control ringed.
3. **Step by step**: numbered steps, each with the picture of where it happens.
4. **Every setting**: what each field or value changes, exactly.
5. **Tips and pitfalls**: what goes wrong, and why.
6. **Related**: the chapters that go with this one.

Pictures marked **Chart** are drawn from `client/engine.js`, the function the rigs run inside After
Effects, so they match After Effects frame for frame. Timeline pictures that skip a stretch of time
show a grey break where they do.

## Part 1. Getting started

1. [Installing, and opening the panel](01-install.md)
2. [The panel at a glance](02-panel-at-a-glance.md): the status line, the Refresh prompt, the engine pill, the toasts
3. [How a rig works](03-how-a-rig-works.md): Dynamic and Stable, the cursor layer, the hidden guide, Characters Shown

## Part 2. The panel, card by card

4. [Creating a rig](04-create-rig.md): rig type, typing style, cursor, one layer or several
5. [Typing presets](05-typing-presets.md): Apply, the rhythm strip, Save as preset, Delete, frame rates
6. [Start typing and Stop typing](06-start-stop.md)
7. [Pauses](07-pauses.md): Add pause, Pause markers, dragging their end
8. [Erase](08-erase.md): everything or the last few characters, over a number of frames, and retyping
9. [Refresh](09-refresh.md)
10. [Bake and Unbake](10-bake.md), and the keyframe colours in Settings
11. [Remove](11-remove.md)
12. [Cursor presets](12-cursor-presets.md): Apply, Add cursor, Save as preset, Delete

## Part 3. The text layer's controls

13. [Typing and Start at Character](13-typing-start-at-character.md)
14. [Speed Mode, Frames Per Character and Total Duration](14-speed.md)
15. [Variance and Random Seed](15-variance-seed.md)
16. [Slow: Capitals, Numbers, Symbols and Punctuation](16-slow-characters.md)
17. [Slow: After Punctuation, Sentence End, Last Character and line breaks](17-slow-after.md): Before Line Break, New Line, Empty Lines
18. [Slow: Word Start, Long Words, Rare Letters and Same Finger](18-slow-words.md)
19. [Fast: Repeated Letters, Capitals and Numbers in a Row, Common Pairs, Common Words and Word Momentum](19-fast.md)
20. [Slow/Fast: Spaces, Same Hand and Fatigue](20-slow-fast.md)
21. [Characters Shown](21-characters-shown.md)

## Part 4. The cursor layer's controls

22. [How the cursor finds its rig](22-cursor-links.md)
23. [Show Cursor, Use Text Color, Cursor Color and Cursor Opacity](23-cursor-colour.md)
24. [Blink, Blinks per Second, Blink While Typing and Blink Softness](24-cursor-blink.md)
25. [Width, Top, Bottom and Size From](25-cursor-shape.md)
26. [Roundness, Individual Corners and the four corners](26-cursor-corners.md)
27. [Offset Unit, X Offset and Y Offset](27-cursor-offset.md)

## Part 5. Recipes and help

28. [Recipes](28-recipes.md): a search bar, a chat bubble, code, a paragraph that wraps, delete and retype, Bengali
    and other non-Latin text, mixed fonts, speed keyed to a voice-over, nudging baked keystrokes,
    rigs without the panel, the legacy expression engine
29. [When something goes wrong](29-troubleshooting.md)
