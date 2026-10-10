// Chapter 3: how a rig works: Dynamic and Stable side by side on centred paragraph text, the layers
// each makes, Characters Shown.
import { BG, WHITE, GREY, rig, SWATCH } from "../scenes.mjs";

const PARA = "Words wrap onto the next line as they are typed, and the line stays centred.";

export async function run(s) {
  await s.scene({
    name: "Dynamic and Stable", width: 1280, height: 520, duration: 9, fps: 30, bg: BG,
    texts: [
      { name: "Dynamic label", text: "Dynamic", font: "SegoeUI-Semibold", size: 30, color: GREY, pos: [330, 90], just: "center", locked: true },
      { name: "Stable label", text: "Stable", font: "SegoeUI-Semibold", size: 30, color: GREY, pos: [950, 90], just: "center", locked: true },
      { name: "Dynamic text", text: PARA, font: "SegoeUI", size: 42, color: WHITE, pos: [330, 300], just: "center", box: [520, 300] },
      { name: "Stable text", text: PARA, font: "SegoeUI", size: 42, color: WHITE, pos: [950, 300], just: "center", box: [520, 300] }
    ]
  });
  await rig(s, ["Dynamic text"], { type: "dynamic" });
  await rig(s, ["Stable text"], { type: "stable" });
  await s.select(["Dynamic text"], 2.5);
  // The Timeline right after Create, as After Effects leaves it: the Stable text shows its new
  // LazyTyper animator, the Dynamic rig's guide is open below its text.
  await s.aeShot("03-layers", { panel: "timeline", slice: [0, 0.6], height: 430 });
  await s.gif("03-dynamic-stable", { duration: 8.5, fps: 30, width: 720, swatch: SWATCH });
  await s.effectsShot("03-characters-shown", { layer: "Dynamic text", controls: ["Characters Shown"], context: 1 });
}
