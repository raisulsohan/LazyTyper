// Runs tools/spikes/step.jsx step by step and lists any After Effects dialog after each step.
//   node tools/spikes/steps.mjs new dynamic stable time frame bake unbake refreshStable refreshDynamic remove
import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { runPs } from "../ps.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");
const tmp = path.join(process.env.TEMP, "LazyTyper");
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function dialogs() {
  const out = runPs(path.join(root, "tools", "ae-dialogs.ps1"));
  return out.split(/\r?\n/).filter((l) => /\[#32770\] ''/.test(l));
}

for (const step of process.argv.slice(2)) {
  fs.writeFileSync(path.join(tmp, "step.txt"), step);
  let res = "";
  try {
    res = execFileSync(process.execPath, [path.join(root, "tools", "ae-run.mjs"), path.join(root, "tools", "spikes", "step.jsx"), path.join(tmp, "step.json"), "120"], { encoding: "utf8" });
  } catch (e) {
    res = "timed out (a dialog blocking?)";
  }
  await sleep(2500);
  const d = dialogs();
  const line = res.split(/\r?\n/).find((l) => l.startsWith("{")) || res.trim();
  console.log(`${step}: ${line.slice(0, 160)}`);
  for (const w of d) console.log(`   DIALOG ${w}`);
  if (d.length) {
    const shot = path.join(tmp, `dialog-${step}-${Date.now()}.png`);
    runPs(path.join(root, "tools", "screen-capture.ps1"), [shot]);
    console.log(`   screen: ${shot}`);
    runPs(path.join(root, "tools", "ae-dismiss.ps1"));
  }
}
