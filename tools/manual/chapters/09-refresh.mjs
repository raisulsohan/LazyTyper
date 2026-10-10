// Chapter 9: Refresh: the font size changes after the rig was made, the cursor no longer fits, the
// panel turns amber, one click puts it right.
import fs from "node:fs";
import { line, rig } from "../scenes.mjs";

const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const T = 4.2;

export async function run(s) {
  await s.scene(line("Refresh", "Line", "Bigger text, same cursor?", { size: 56, height: 300, duration: 5 }));
  await rig(s, ["Line"]);
  await s.select(["Line"], T);
  const parts = [await s.strip("09-part1", [{ time: T, label: "The rig made at 56 px" }], { width: 640 })];
  await s.textDoc("Line", { fontSize: 84 });
  await s.select(["Line"], T);
  await s.info((i) => i.layers[0] && i.layers[0].needsRefresh, "the panel asks for a Refresh");
  parts.push(await s.strip("09-part2", [{ time: T, label: "Font size 84 px: the cursor still sits where 56 px ended" }], { width: 640 }));
  await s.shot("09-amber", { clip: ["status", "cardRig"], mark: ["status", "btnRefresh"] });
  await s.record("09-click", async () => {
    await s.pointTo("status", { press: true });
    await s.js("(document.getElementById('status').click(), 1)");
    let t = "";
    for (let i = 0; i < 40 && !t; i++) { await wait(500); t = await s.toastText(); }
    if (!/Refreshed Line/.test(t)) throw new Error(`refresh: ${t}`);
    await wait(1600);
  }, { clip: ["status", "cardRig"], toast: true, fps: 8 });
  await s.hideToast();
  parts.push(await s.strip("09-part3", [{ time: T, label: "After Refresh" }], { width: 640 }));
  s.stack("09-before-after", parts, { gap: 6 });
  for (const p of parts) fs.rmSync(p, { force: true });
}
