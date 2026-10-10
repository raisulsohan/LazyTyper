# 17. Slow: After Punctuation, Sentence End and New Line

People stop after a comma, longer after a full stop, and take a moment at the start of a new line.
These three controls slow the character that comes **after** such a place.

![One line with each control raised, under a line with all three at 0, rendered by After Effects](media/17-slow-after.gif)

*Rendered by After Effects: the top line has all three at 0; each line below raises one (After
Punctuation 600 %, Sentence End 1000 %, New Line 1000 %), the others at their defaults.*

## Where to find them

![Effect Controls: Slow: After Punctuation, Sentence End and New Line ringed (this line has After Punctuation at 600)](media/17-slow-after-effect-controls.png)

## Which characters

| Control | Slows the character after | Default |
|---|---|---|
| **Slow: After Punctuation** | `, ; :` and the Arabic `،` and Japanese `、` | 250 |
| **Slow: Sentence End** | `. ! ?` and `। ॥ ؟ 。` | 500 |
| **Slow: New Line** | a line break (Return in the text) | 400 |

At **v %** that character takes **1 + v/100** times as long: the default 500 % makes the key after a
full stop take six times as long, a clear breath between sentences.

Things worth knowing:

- It is the **next character** that waits, whatever it is: usually the space after the full stop.
- When a line break comes right after "!", the line break is the character after the sentence end
  (it waits for Sentence End) and the first letter of the new line waits for New Line, so both apply.
- **"..."** counts each dot as a sentence end: the second and third dots wait, and so does the
  character after them.

![Chart: the line with all three at 0, at the defaults, and with each one raised, the keys each one slows highlighted](media/17-slow-after-chart.png)

For "Well, maybe. Wait: no!", a line break, "Start again." (35 characters with the line break):

| | The take |
|---|---|
| all three at 0 | 161 frames |
| defaults (250, 500, 400) | 254 frames |
| After Punctuation 600 % | 288 frames |
| Sentence End 1000 % | 291 frames |
| New Line 1000 % | 300 frames |

## Step by step

1. Select the rigged text layer.
2. Set the control in Effect Controls.
3. Play.

## Tips and pitfalls

- **Pauses you place by hand** come on top of these waits only in part: the first key after a Pause
  marker appears at once (chapter 7). If you place a pause after every sentence, lower Sentence End.
- **Lists and code** ("a, b, c" or `f(a, b)`) wait after every comma: lower After Punctuation.
- **A paragraph that wraps by itself** has no line breaks: New Line only applies where the text has a
  Return.

## Related

- [16. Slow: Capitals, Numbers, Symbols and Punctuation](16-slow-characters.md)
- [7. Pauses](07-pauses.md)
