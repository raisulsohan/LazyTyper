// Writes every rig expression to %TEMP%\LazyTyper\expressions so tools/check-extendscript.js
// can compile them as ES3 (what After Effects' legacy expression engine understands).
//
//   node tools/dump-expressions.mjs
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const rig = require("../client/rig.js");
const dir = path.join(process.env.TEMP || os.tmpdir(), "LazyTyper", "expressions");
fs.rmSync(dir, { recursive: true, force: true });
fs.mkdirSync(dir, { recursive: true });
const set = rig.expressionSet();
let n = 0;
for (const [name, src] of Object.entries(set)) {
  if (name === "version") continue;
  const body = src.replace("/*LT_DATA*/", "[0,100,[0,0,10,0]]").replace("/*LT_SIZES*/", "[0,100]")
    .replace("/*LT_METRICS*/", "var SIZE = 100, LEAD = 120, B0 = 0, X0 = 0, SPW = 25, GAP = 4;");
  fs.writeFileSync(path.join(dir, `${name}.js`), body, "utf8");
  n++;
}
console.log(`wrote ${n} expressions to ${dir}`);
