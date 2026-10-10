// Encodes the captured frames into docs/demo/lazytyper-demo.gif with ffmpeg's palettegen and
// paletteuse: 960x540, one palette for the whole animation, looping.
//
//   node tools/demo/gif.mjs [--fps 30] [--colors 48]       (after node tools/demo/capture.mjs)
//
// What keeps the GIF small and the typing true:
//  - flat colours only (the panel's own, After Effects' greys, a light search bar), no gradients,
//    so most frames change a few small rectangles, the only thing a GIF frame stores;
//  - no dithering, and few colours;
//  - a swatch of the key colours (every panel colour from client/style.css, the label colours the
//    bake uses, After Effects' blue) is fed to palettegen as extra frames, so colours that cover few
//    pixels, or sit close to their neighbours like the panel's dark shades, are not merged away;
//  - no mpdecimate: dropping still frames stops the GIF muxer from storing only the changes;
//  - at 30 fps the muxer writes delays of 3 and 4 hundredths in turn (a GIF counts in hundredths),
//    so the frames keep their place on the 30 fps grid the typing was timed on.

import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");
const arg = (name, fallback) => { const i = process.argv.indexOf(name); return i > 0 ? process.argv[i + 1] : fallback; };
const fps = Number(arg("--fps", "30"));
const colors = Number(arg("--colors", "48"));
const cache = path.join(root, ".cache", "demo");
const frames = path.join(cache, "frames", "f%04d.png");
const out = path.join(root, "docs", "demo", "lazytyper-demo.gif");
if (!fs.existsSync(path.join(cache, "frames", "f0000.png"))) throw new Error("no frames: run node tools/demo/capture.mjs first");

const css = fs.readFileSync(path.join(root, "client", "style.css"), "utf8");
const panel = [...css.match(/:root\s*\{([^}]*)\}/)[1].matchAll(/--[\w-]+\s*:\s*#([0-9a-f]{6})\s*;/gi)].map((m) => m[1].toLowerCase());
const KEY_COLOURS = [...new Set([
  ...panel,
  "b53838", "677de0", "4aa44c",                                   // bake labels: deleting, letters, spaces
  "141414", "232323", "3a3a3a", "cccccc", "8a8a8a", "2d8ceb",     // After Effects
  "e9edf3", "ffffff", "d3d9e2", "202124", "80868b", "000000",     // the search bar shot, the pointer
])];
const ffmpeg = (...args) => execFileSync("ffmpeg", ["-v", "error", "-y", ...args], { stdio: "inherit" });
const swatch = path.join(cache, "swatch.png");
const palette = path.join(cache, "palette.png");

const stripe = 24;
ffmpeg(...KEY_COLOURS.flatMap((c) => ["-f", "lavfi", "-i", `color=c=0x${c}:s=${stripe}x540:d=1`]),
  "-filter_complex", `hstack=inputs=${KEY_COLOURS.length},scale=${stripe * KEY_COLOURS.length}:540`, "-frames:v", "1", swatch);
ffmpeg("-framerate", String(fps), "-i", frames, "-loop", "1", "-t", "3", "-framerate", String(fps), "-i", swatch,
  "-filter_complex", `[0:v]format=rgb24[a];[1:v]fps=${fps},scale=960:540:flags=neighbor,format=rgb24[b];[a][b]concat=n=2:v=1,palettegen=max_colors=${colors}:stats_mode=full`,
  palette);
ffmpeg("-framerate", String(fps), "-i", frames, "-i", palette,
  "-lavfi", "[0:v][1:v]paletteuse=dither=none:diff_mode=rectangle", "-loop", "0", out);

const mb = fs.statSync(out).size / 1e6;
console.log(`${path.relative(root, out)} ${mb.toFixed(2)} MB (${fps} fps, ${colors} colours, ${KEY_COLOURS.length} key colours)${mb >= 3 ? "  - over 3 MB" : ""}`);
