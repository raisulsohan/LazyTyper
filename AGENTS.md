# LazyTyper - operating guide

LazyTyper is a free, MIT-licensed CEP panel for After Effects that builds natural typing
rigs on text layers (typing engine in expressions, cursor layer, presets, pauses, erase,
bake). One of Raisul Sohan's Lazy tools; built from WriteTyper's public feature list, never
from its code.

## Read first

1. This file, then [docs/development.md](docs/development.md) (architecture, After Effects
   facts, tests, release).
2. `git status` and `git log --oneline -10`.

## Hard rules

- **Commits are Raisul Sohan's alone.** No AI or co-author lines in commits, pull requests
  or releases. No subagents or workflows.
- **Reply in Bengali.** Code, comments, docs, commit messages and file names are English.
- **Ask before launching After Effects or downloading anything.** Other sessions may be
  using After Effects; check before every run and never close a project without the
  backup `tools/ae/fresh-project.jsx` makes.
- **Never open, copy or commit `Signing key (do not share)/`, `*.p12` or `password.txt`.**
- **`host/host.jsx`, `client/engine.js` and the expressions are ES3 and ASCII.** Run
  `npm run check` after touching them. The legacy expression engine throws on missing
  properties; read only fields that always exist.
- **The panel is ES5** (CEP 9, Chromium 61): no `let`/`const`, arrows, template strings,
  flex `gap`.
- **No background polling of After Effects** from the panel (it caused "internal
  verification failure" boxes); poll on pointer-over, focus and after actions only.
- **Animations or demos get the full player control bar and are never rendered to video.**

## Reflexes

| When you are about to... | Do this |
|---|---|
| change `engine.js` | `npm test`; then `npm run test:ae` (the AE result must match Node frame for frame) |
| change an expression in `rig.js` | `npm test`, `npm run test:ae` (both engines) |
| change `host.jsx` | `npm run check`, `npm run test:ae`, `npm run test:ui` |
| change the panel | `npm run preview` for layout, `npm run test:ui` in After Effects |
| add a control | `rig.js` TEXT_CONTROLS/CURSOR_CONTROLS (+ presets), the README tables |
| release | docs/development.md "Building a release" |
