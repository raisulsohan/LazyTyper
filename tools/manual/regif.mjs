// Encodes a GIF again from frames already rendered into .cache/manual/<name>/, without After
// Effects: for trying another width or palette, or bringing a GIF within budget.
//
//   node tools/manual/regif.mjs 08-erase-all [15-variance ...] [--fps 30 --width 720 --colors 48]

import fs from "node:fs";
import path from "node:path";
import { encodeGif, work } from "./session.mjs";

const args = process.argv.slice(2);
const option = (name, fallback) => { const i = args.indexOf(name); return i >= 0 ? Number(args[i + 1]) : fallback; };
const names = args.filter((a, i) => !a.startsWith("--") && !(i > 0 && args[i - 1].startsWith("--")));
for (const name of names) {
  const dir = fs.existsSync(path.join(work, name)) ? path.join(work, name) : path.join(work, `rec-${name}`);
  const list = fs.readdirSync(dir).filter((f) => /\.(tif|png)$/.test(f) && !/palette|swatch/.test(f)).sort();
  const first = list[0].match(/(\d+)\.(tif|png)$/);
  encodeGif(name, {
    dir, fps: option("--fps", 30), width: option("--width", 720), colors: option("--colors", 48),
    pattern: list[0].replace(/\d+\.(tif|png)$/, `%0${first[1].length}d.${first[2]}`), startNumber: Number(first[1])
  });
}
