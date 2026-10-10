# 5. Typing presets

A **typing preset** is a whole set of speed values: the base speed, Variance, Random Seed and every
Slow, Fast and Slow/Fast control. LazyTyper comes with three; any rig's values can be saved as a
preset of your own.

![The same line typed with Very Fast, Average and Hunt & Peck, rendered by After Effects](media/05-presets.gif)

## Where to find it

Card **2 · Typing speed**:

![The Typing speed card: 1 the preset, 2 Apply, 3 the rhythm strip, 4 Save as preset](media/05-speed-card.png)

1. **Preset**: built-in presets first, then your saved ones.
2. **Apply**: sets the selected rigs' controls to the preset.
3. **The rhythm strip**: what the preset does to the selected text.
4. **Save as preset…**: saves the selected rig's values as a preset of your own (**Delete** appears
   next to it when a saved preset is chosen).

The card's corner says which layer it is about (*for Line 1*).

## The three built-in presets

| | Very Fast | Average | Hunt & Peck |
|---|---|---|---|
| Frames Per Character | 2.2 | 3 | 6 |
| Variance | 15 | 35 | 60 |
| Slow: Capitals, Numbers, Symbols, Punctuation | 30, 30, 60, 20 | 60, 60, 120, 40 | 150, 120, 250, 80 |
| Slow: After Punctuation, Sentence End, New Line | 150, 300, 250 | 250, 500, 400 | 300, 600, 500 |
| Slow: Word Start, Long Words, Rare Letters | 20, 0, 10 | 50, 30, 40 | 100, 60, 100 |
| Fast: Repeated Letters, Common Pairs, Common Words, Word Momentum | 40, 40, 30, 30 | 30, 30, 20, 20 | 10, 10, 20, 0 |
| Slow/Fast: Spaces, Same Hand, Fatigue | −20, 10, 0 | 0, 20, 10 | −30, 0, 20 |
| About, at 30 fps | 14 characters a second | 7 | 2.5 to 3 |

All three use Speed Mode *Frames Per Character* and Random Seed 1. **Average** is also what a new rig
gets when nothing else is chosen.

![Chart: the same line with each preset](media/05-presets-chart.png)

## Apply a preset

1. Select the rigged text layers (one or several).
2. Choose the preset.
3. Click **Apply**. The toast says *Applied "Very Fast".*

![Choosing Very Fast and clicking Apply](media/05-apply.gif)

A control that already has keyframes gets a keyframe at the time indicator instead of losing its
animation; the others simply change. Applying is one undo step.

## The rhythm strip

![Switching the preset from Very Fast to Average to Hunt & Peck: the strip and the timing change](media/05-rhythm.gif)

The strip types the selected layer's text with the chosen preset, before you apply it: one bar per
keystroke, coloured by what is typed (letters, numbers, punctuation, spaces), taller after a longer
wait, on a time scale in seconds at the comp's frame rate. On the right: the whole take, and
characters a second. With no text layer selected it types a sample sentence and says *sample*.

The strip shows the preset's values, not the rig's current ones, and no pauses, Typing keyframes or
Start at Character: it is the preset's rhythm on that text.

## Save your own

1. Set up a rig the way you like it (Effect Controls) and select it.
2. Click **Save as preset…**, type a name, press **Save** (or Enter; Esc cancels).
3. The toast says *Saved "Slow and careful" from Line 3.* and the new preset is chosen.

![Save as preset: the name typed, Save clicked, the toast](media/05-save.gif)

![The saved preset chosen in the list, with Delete next to Save as preset](media/05-saved.png)

The preset keeps the 22 speed controls at the time indicator: Speed Mode, Frames Per Character,
Total Duration, Variance, Random Seed and every Slow, Fast and Slow/Fast control. Typing, Start at
Character and Characters Shown belong to the shot, not the style, and are not kept. Saving under a
name that exists replaces that preset (*Updated "…"*).

## Delete a saved preset

Choose it and click **Delete**. Built-in presets cannot be deleted (the button only shows for your
own). The list goes back to *Average*.

![Delete clicked: the toast says Deleted "Slow and careful"](media/05-delete.gif)

Saved presets are in `presets.json` in `%APPDATA%\LazyTyper` (Windows) or
`~/Library/Application Support/LazyTyper` (macOS): copy that file to take them to another computer.

## Tips and pitfalls

- **Apply sets Random Seed back to the preset's seed** (1 for the built-in ones). Save your own
  preset to keep a seed.
- **Typing style in Create rig is the same choice** as this card's preset.
- **Matching a typist**: a fast typist has a quick base speed, low Variance, a few slow-downs and
  some speed-ups; a slow typist the opposite.

## Related

- [14. Speed Mode, Frames Per Character and Total Duration](14-speed.md)
- [15. Variance and Random Seed](15-variance-seed.md)
- Chapters [16](16-slow-characters.md) to [20](20-slow-fast.md): what each control in a preset does.
