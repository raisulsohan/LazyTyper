// Runs LazyTyper inside the real After Effects and checks it against the Node engine.
//
//   node tools/ae-test.mjs            (asks nothing: start After Effects yourself or let it start)
//
// For each expression engine (legacy ExtendScript, then JavaScript):
// 1. tools/ae/fresh-project.jsx gives After Effects a new project (saving a copy of the open
//    one first if it has anything in it), in a run of its own.
// 2. Writes %TEMP%\LazyTyper\ae-test\fixture.json: the rig arguments the panel would send,
//    the test texts and, for each, the keystroke frames the Node engine expects.
// 3. Runs tools/ae-test.jsx (through tools/ae-run.mjs), which builds and checks the rigs.
// Then looks for After Effects error dialogs on screen, prints everything and exits 1 if
// anything failed.
import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const require = createRequire(import.meta.url);
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const rig = require("../client/rig.js");
const { lazyTyperRun } = require("../client/engine.js");

const dir = path.join(process.env.TEMP, "LazyTyper", "ae-test");
fs.mkdirSync(dir, { recursive: true });

const FD = 1 / 30;
const typing = Object.assign({}, rig.TYPING_PRESETS[1].values);
const values = {};
for (const c of rig.TEXT_CONTROLS) values[c.name] = c.value;
Object.assign(values, typing);

// "ami banglay kshama karma kotha." with a conjunct, a reph and a two-part vowel sign.
const BENGALI = "আমি বাংলায় ক্ষমা কর্ম কোথা।";
const cases = [
  { id: "stable-point", type: "stable", text: "Hello, world. This is LazyTyper!", box: null, just: "left" },
  { id: "dynamic-point", type: "dynamic", text: "Dynamic text, typing on.\rSecond line here", box: null, just: "left" },
  { id: "dynamic-box", type: "dynamic", text: "A paragraph that wraps across the box as each word is typed on screen.", box: [700, 400], just: "center" },
  { id: "stable-box", type: "stable", text: "Stable paragraph text keeps its layout while it types.", box: [700, 400], just: "right" },
  { id: "stable-lines", type: "stable", text: "First line\rSecond, line two\r\rFourth", box: null, just: "center" },
  // Joined letters: After Effects counts units (grapheme clusters), not characters.
  { id: "dynamic-bengali", type: "dynamic", text: BENGALI, box: null, just: "left", font: "NirmalaUI", joined: true },
  { id: "stable-bengali", type: "stable", text: BENGALI, box: null, just: "left", font: "NirmalaUI", joined: true }
];
for (const c of cases) {
  const ev = lazyTyperRun({
    time: 9.9, fd: FD, start: 0, record: true, pauses: [],
    num: (n) => values[n], text: () => c.text
  });
  c.expected = ev.map(([t, k]) => [Math.round(t / FD), k]);
}

const expr = rig.expressionSet();
const args = {
  textControls: rig.TEXT_CONTROLS,
  cursorControls: rig.CURSOR_CONTROLS,
  typing,
  cursorValues: Object.assign({}, rig.CURSOR_PRESETS[0].values),
  expr,
  labels: rig.DEFAULT_KEY_LABELS
};
const aeRun = (script, result, timeout) =>
  execFileSync(process.execPath, [path.join(root, "tools", "ae-run.mjs"), script, result, String(timeout)], { stdio: "ignore" });

let failed = 0;
let total = 0;
let version = "";
for (const engine of ["extendscript", "javascript-1.0"]) {
  // A new project in a run of its own, then the test in the next run (see fresh-project.jsx).
  const fresh = path.join(process.env.TEMP, "LazyTyper", "fresh.json");
  try {
    aeRun(path.join(root, "tools", "ae", "fresh-project.jsx"), fresh, 300);
  } catch {
    console.log("  ERROR could not start a new project");
    process.exit(1);
  }
  const fr = JSON.parse(fs.readFileSync(fresh, "utf8"));
  if (fr.backup) console.log(`  (the open project was saved first to ${fr.backup})`);
  fs.writeFileSync(path.join(dir, "fixture.json"), JSON.stringify({ root: root.replace(/\\/g, "/"), engine, args, cases }), "utf8");
  const resultFile = path.join(dir, `results-${engine}.json`);
  fs.rmSync(resultFile, { force: true });
  try {
    aeRun(path.join(root, "tools", "ae-test.jsx"), resultFile, 900);
  } catch {
    console.error(`After Effects run failed (${engine})`);
  }
  if (!fs.existsSync(resultFile)) {
    failed++;
    continue;
  }
  const res = JSON.parse(fs.readFileSync(resultFile, "utf8"));
  version = res.version;
  for (const r of res.checks || []) {
    total++;
    if (!r.ok) failed++;
    console.log(`${r.ok ? "  ok  " : "  FAIL"} ${r.name}${r.detail ? ` - ${r.detail}` : ""}`);
  }
  for (const k of Object.keys(res)) if (/-ms-at-10s$/.test(k)) console.log(`  time ${k}: ${res[k].toFixed(1)} ms`);
  if (res.error) {
    failed++;
    console.log(`  ERROR ${res.error}`);
  }
}
// After Effects' own error boxes never reach a script, so look for them on screen too
// (they can come a moment after the script ends).
await new Promise((r) => setTimeout(r, 4000));
const dialogs = execFileSync("powershell", ["-NoProfile", "-File", path.join(root, "tools", "ae-dialogs.ps1")], { encoding: "utf8" })
  .split(/\r?\n/).filter((l) => /\[#32770\] ''/.test(l));
if (dialogs.length) {
  failed++;
  console.log(`  FAIL After Effects shows ${dialogs.length} dialog(s)`);
}
console.log(`${failed ? "FAILED" : "ok"}: ${total - failed} passed, ${failed} failed (After Effects ${version})`);
process.exit(failed ? 1 : 0);
