# 18. Slow: Word Start, Long Words and Rare Letters

A typist hesitates at the start of each word, slows down through long ones, and hunts for the keys
they seldom use. These three controls slow characters by their place in a word, or by being rare.

![One line with each control raised, under a line with all three at 0, rendered by After Effects](media/18-slow-words.gif)

*Rendered by After Effects: the top line has all three at 0; each line below raises one (Word Start
200 %, Long Words 300 %, Rare Letters 300 %), the others at their defaults.*

## Where to find them

![Effect Controls: Slow: Word Start, Long Words and Rare Letters ringed (this line has Word Start at 200)](media/18-slow-words-effect-controls.png)

## Which characters

A **word** here is a run of letters and digits; spaces and punctuation end it.

| Control | Slows | Default |
|---|---|---|
| **Slow: Word Start** | the first letter or digit of every word | 50 |
| **Slow: Long Words** | every letter of a word longer than 6 characters, more for longer words: a 7-character word gets 1/6 of the value, 9 characters half, 12 or more all of it | 30 |
| **Slow: Rare Letters** | q, z, x, j, k and v, in either case | 40 |

At **v %** a character takes **1 + v/100** times as long (for Long Words, v times the share above).
The first character of a run appears at once and is never slowed.

![Chart: the line with all three at 0, at the defaults, and with each one raised, the keys each one slows highlighted](media/18-slow-words-chart.png)

For "Jack quickly fixed the extraordinary vintage jukebox" (52 characters):

| | The take |
|---|---|
| all three at 0 | 192 frames |
| defaults (50, 30, 40) | 245 frames |
| Word Start 200 % | 301 frames |
| Long Words 300 % | 419 frames |
| Rare Letters 300 % | 378 frames |

## Step by step

1. Select the rigged text layer.
2. Set the control in Effect Controls.
3. Play.

## Tips and pitfalls

- **Word Start and Common Words work against each other** on short common words ("the", "and"):
  the first letter is slowed, the whole word sped up (chapter 19).
- **Technical text** (long words, x, z, k) gets slow fast: lower Long Words and Rare Letters for
  product names and code.
- **Rare Letters is about English keyboards**; letters with accents are not counted as rare.

## Related

- [19. Fast: Repeated Letters, Common Pairs, Common Words and Word Momentum](19-fast.md)
- [16. Slow: Capitals, Numbers, Symbols and Punctuation](16-slow-characters.md)
