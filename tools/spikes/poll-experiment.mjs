// Experiment: do After Effects' "internal verification failure {no current context}" dialogs come
// from the panel polling while a script closes and opens projects?
// Runs the "new" step three times with the panel parked on about:blank, then three times with
// the panel polling, and counts dialogs after each.
import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { connectPanel } from "../cep-devtools.mjs";
import { runPs } from "../ps.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");
const tmp = path.join(process.env.TEMP, "LazyTyper");
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const ps = (file) => runPs(path.join(root, "tools", file));
const dialogs = () => ps("ae-dialogs.ps1").split(/\r?\n/).filter((l) => /\[#32770\] ''/.test(l));

async function round(label) {
  let count = 0;
  for (let i = 0; i < 3; i++) {
    fs.writeFileSync(path.join(tmp, "step.txt"), "new");
    try {
      execFileSync(process.execPath, [path.join(root, "tools", "ae-run.mjs"), path.join(root, "tools", "spikes", "step.jsx"), path.join(tmp, "step.json"), "90"], { stdio: "ignore" });
    } catch {}
    await sleep(3000);
    const d = dialogs();
    count += d.length;
    if (d.length) ps("ae-dismiss.ps1");
  }
  console.log(`${label}: ${count} dialog(s) in 3 runs`);
}

ps("ae-dismiss.ps1");
const panel = await connectPanel();
const url = await panel.evaluate("location.href");
await panel.evaluate("location.href = 'about:blank', 1");
panel.close();
await sleep(1500);
await round("panel parked (no polling)");
const p2 = await connectPanel({ timeoutMs: 10000, anyPage: true }).catch(() => null);
const target = p2;
if (target) {
  await target.evaluate(`location.href = ${JSON.stringify(url)}, 1`);
  target.close();
}
await sleep(3000);
await round("panel polling");
