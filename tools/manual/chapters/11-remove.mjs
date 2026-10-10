// Chapter 11: Remove: the rig, its cursor and its guide go; the text layer stays.
import { line, rig } from "../scenes.mjs";

const wait = (ms) => new Promise((r) => setTimeout(r, ms));

export async function run(s) {
  await s.scene(line("Remove", "Line", "Back to a plain text layer.", { duration: 5 }));
  await rig(s, ["Line"]);
  await s.select(["Line"], 4);
  await s.aeShot("11-before", { panel: "timeline", slice: [0, 0.5], height: 240 });
  await s.shot("11-card", { clip: "cardRig", mark: ["btnRemove"] });
  await s.record("11-click", async () => {
    await s.pointTo("btnRemove", { press: true });
    const t = await s.click("btnRemove");
    if (!/Removed the rig from Line/.test(t)) throw new Error(`remove: ${t}`);
    await wait(1800);
  }, { clip: "cardRig", toast: true, fps: 8 });
  await s.hideToast();
  await s.select(["Line"], 4);
  await s.aeShot("11-after", { panel: "timeline", slice: [0, 0.5], height: 240 });
}
