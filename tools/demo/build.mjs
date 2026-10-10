// Builds docs/demo/lazytyper-demo.html from tools/demo/page.template.html. The page runs the real
// typing engine and presets, so client/engine.js and client/rig.js go in as they are, and the
// panel colours are the :root variables of client/style.css. One file that also opens from disk.
//
//   node tools/demo/build.mjs

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, "..", "..");
const out = path.join(root, "docs", "demo", "lazytyper-demo.html");
const read = (f) => fs.readFileSync(path.join(root, f), "utf8").replace(/\r\n/g, "\n");

const css = read("client/style.css");
const vars = css.match(/:root\s*\{([^}]*)\}/);
if (!vars) throw new Error("client/style.css has no :root block");
const theme = {};
for (const m of vars[1].matchAll(/--([\w-]+)\s*:\s*([^;]+);/g)) theme[m[1]] = m[2].trim();

const parts = {
  "/*@ENGINE@*/": read("client/engine.js").trimEnd(),
  "/*@RIG@*/": read("client/rig.js").trimEnd(),
  "/*@THEME@*/": JSON.stringify(theme),
};
let html = read("tools/demo/page.template.html");
for (const [mark, value] of Object.entries(parts)) {
  if (html.split(mark).length !== 2) throw new Error(`page.template.html must hold ${mark} exactly once`);
  if (value.includes("</script")) throw new Error(`${mark} would close its <script> early`);
  html = html.replace(mark, () => value);
}
fs.mkdirSync(path.dirname(out), { recursive: true });
fs.writeFileSync(out, html);
console.log(`${path.relative(root, out)} ${(html.length / 1024).toFixed(0)} KB`);
