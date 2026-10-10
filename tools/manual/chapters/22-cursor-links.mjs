// Chapter 22: Text Layer and Guide Layer, the cursor's links to its rig.
import { line, rig } from "../scenes.mjs";

export async function run(s) {
  await s.scene(line("Links", "Line", "The cursor follows its text.", { duration: 5 }));
  await rig(s, ["Line"]);
  await s.effectsShot("22-effect-controls", { layer: "Line Cursor", controls: ["Text Layer", "Guide Layer"], context: 1 });
  await s.select(["Line Cursor"], 3);
  await s.aeShot("22-timeline", { panel: "timeline", slice: [0, 0.3], height: 150, columns: 860 });
}
