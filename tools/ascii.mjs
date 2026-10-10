// Rewrites every non-ASCII character in the given files as a \uXXXX escape.
//
//   node tools/ascii.mjs client/engine.js host/host.jsx
//
// For the files that must stay ASCII: host.jsx (ExtendScript reads it as ASCII) and the
// engine, whose source becomes After Effects expressions. Use it only on files whose
// non-ASCII characters all sit inside string literals.
import fs from "node:fs";

let changed = 0;
for (const file of process.argv.slice(2)) {
  const src = fs.readFileSync(file, "utf8");
  const out = src.replace(/[^\x00-\x7f]/g, (c) => "\\u" + c.charCodeAt(0).toString(16).toUpperCase().padStart(4, "0"));
  if (out !== src) {
    fs.writeFileSync(file, out);
    changed++;
    console.log(`escaped ${file}`);
  }
}
if (!changed) console.log("all ASCII");
