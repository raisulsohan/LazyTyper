// Checks the manual: every link to a chapter or a file resolves (anchors too), every picture a
// chapter shows exists and has alt text, and lists pictures no chapter shows and pictures over budget.
//
//   node tools/manual/check.mjs

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");
const dir = path.join(root, "docs", "manual");
const GIF_MB = 1.5;
const PNG_MB = 0.6;
const files = fs.readdirSync(dir).filter((f) => f.endsWith(".md"));
const used = new Set();
let problems = 0;
const problem = (text) => { console.log(text); problems++; };

/** GitHub's anchor for a heading. */
const slug = (h) => h.trim().toLowerCase().replace(/[^\w\- ]/g, "").replace(/ /g, "-");
const anchors = (file) => new Set([...fs.readFileSync(file, "utf8").matchAll(/^#{1,6} (.+)$/gm)].map((m) => slug(m[1].replace(/[*`]/g, ""))));

for (const file of files) {
  const text = fs.readFileSync(path.join(dir, file), "utf8");
  for (const [, alt] of text.matchAll(/!\[([^\]]*)\]\(/g)) if (!alt.trim()) problem(`${file}: a picture without alt text`);
  for (const [, target] of text.matchAll(/\]\(([^)\s]+)\)/g)) {
    if (/^(https?:|mailto:)/.test(target)) continue;
    const [local, hash] = target.split("#");
    const resolved = local ? path.join(dir, local) : path.join(dir, file);
    if (local.startsWith("media/")) used.add(local.slice(6));
    if (local && !fs.existsSync(resolved)) {
      problem(`${file}: missing ${target}`);
      continue;
    }
    if (hash && resolved.endsWith(".md") && !anchors(resolved).has(hash)) problem(`${file}: no heading for #${hash} in ${local || file}`);
  }
}
const mediaDir = path.join(dir, "media");
const media = fs.existsSync(mediaDir) ? fs.readdirSync(mediaDir) : [];
for (const m of media) {
  if (!used.has(m)) console.log(`not shown anywhere: media/${m}`);
  const mb = fs.statSync(path.join(mediaDir, m)).size / 1e6;
  if (m.endsWith(".gif") && mb > GIF_MB) problem(`over budget: media/${m} ${mb.toFixed(2)} MB (GIFs up to ${GIF_MB} MB)`);
  if (m.endsWith(".png") && mb > PNG_MB) problem(`over budget: media/${m} ${mb.toFixed(2)} MB (pictures up to ${PNG_MB} MB)`);
  if (!/\.(png|gif)$/.test(m)) problem(`not a PNG or GIF: media/${m}`);
}
const total = media.reduce((sum, m) => sum + fs.statSync(path.join(mediaDir, m)).size, 0) / 1e6;
console.log(`${files.length} pages, ${media.length} pictures (${total.toFixed(1)} MB), ${problems} problems`);
process.exit(problems ? 1 : 0);
