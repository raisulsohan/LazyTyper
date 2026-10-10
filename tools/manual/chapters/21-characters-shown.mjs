// Chapter 21: Characters Shown, the rig's result, read by another layer.
import { BG, WHITE, GREY, rig, SWATCH } from "../scenes.mjs";

export async function run(s) {
  await s.scene({
    name: "Characters Shown", width: 1280, height: 320, duration: 6, fps: 30, bg: BG,
    texts: [
      { name: "Line", text: "Every keystroke counts.", font: "SegoeUI", size: 60, color: WHITE, pos: [110, 150] },
      { name: "Counter", text: "0", font: "Consolas", size: 30, color: GREY, pos: [110, 240] }
    ]
  });
  await rig(s, ["Line"]);
  await s.expressionOn("Counter", ["ADBE Text Properties", "ADBE Text Document"],
    'var n = Math.round(thisComp.layer("Line").effect("Characters Shown")(1).value);\n"Characters Shown: " + n');
  await s.effectsShot("21-effect-controls", { layer: "Line", controls: ["Characters Shown"], context: 1 });
  await s.gif("21-counter", { duration: 4.5, fps: 30, width: 720, swatch: SWATCH });
}
