# 25. Width, Top and Bottom

The cursor is a rectangle that starts right after the last typed character. **Width** sets how wide
it is, **Top** how far it reaches above the baseline, **Bottom** how far below. All three are
percentages of the font size, so the cursor fits whatever size the text is.

![Five cursors: the default, Width 25, Top 40, Bottom 40, and Width 55 with Top −6 and Bottom 14 (an underscore), rendered by After Effects](media/25-cursor-shape.png)

## Where to find them

![Effect Controls of a cursor layer: Width, Top and Bottom ringed](media/25-cursor-shape-effect-controls.png)

## What each does

| Control | Default | What it does |
|---|---|---|
| **Width** | 7 | The width, growing to the right from where the cursor starts. Below 0 acts as 0. |
| **Top** | 80 | How far the top edge is above the baseline. Negative: below the baseline. |
| **Bottom** | 16 | How far the bottom edge is below the baseline. Negative: above it. |

All in % of the font size: at 72 px, Width 7 is about 5 px and Top 80 about 58 px. If Top and Bottom
cross (the top edge below the bottom edge), they swap.

The **Underscore** preset is Width 55, Top −6, Bottom 14: a flat bar below the baseline, starting
right after the last character. **Box** is Width 55, Top 80, Bottom 18.

## Step by step

1. Select the cursor layer.
2. Set Width, Top and Bottom in Effect Controls.
3. Save the shape as a cursor preset if you'll want it again (chapter 12).

## Tips and pitfalls

- **Mixed font sizes** in a Stable rig: the cursor takes the size of the last character typed, so
  it grows beside a big word and shrinks back after it (After Effects 24.3 and later; older
  versions use the text's first style).
- **A cursor that starts too far from the text**: use X Offset (chapter 27), not Width.
- **After changing the font size**, the panel asks for a Refresh: the cursor is measured again
  (chapter 9).

## Related

- [26. Roundness and the corners](26-cursor-corners.md)
- [27. X Offset and Y Offset](27-cursor-offset.md)
