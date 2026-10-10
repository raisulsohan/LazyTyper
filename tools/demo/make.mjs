// Makes the README demo, in order:
//   1. build.mjs     docs/demo/lazytyper-demo.html (the player page, from page.template.html with
//                    client/engine.js, client/rig.js and the colours of client/style.css)
//   2. capture.mjs   PNG frames of the page in a headless browser, 30 fps     (with --gif)
//   3. gif.mjs       docs/demo/lazytyper-demo.gif, 960x540, 30 fps          (with --gif)
//
//   node tools/demo/make.mjs [--gif]
//
// Needs ffmpeg on PATH and, for --gif, Edge or Chrome. The same machine and browser give the same
// GIF byte for byte. The animation itself is edited in page.template.html; open the built page to
// play it.

import path from "node:path";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const steps = ["build.mjs", ...(process.argv.includes("--gif") ? ["capture.mjs", "gif.mjs"] : [])];
for (const step of steps) {
  console.log(`- ${step}`);
  execFileSync(process.execPath, [path.join(here, step)], { stdio: "inherit" });
}
