// Chapter 22: how the cursor finds its rig (parenting), and a whole rig duplicated.
import { rig, BG, WHITE } from "../scenes.mjs";

export async function run(s) {
  await s.scene({ name: "Links", width: 1280, height: 380, duration: 8, fps: 30, bg: BG,
    texts: [{ name: "Line", text: "The cursor follows its text.", font: "SegoeUI", size: 56, color: WHITE, pos: [110, 140] }] });
  await rig(s, ["Line"]);
  await s.select(["Line Cursor"], 3);
  await s.aeShot("22-timeline", { panel: "timeline", slice: [0, 0.3], height: 150, columns: 860 });

  // Edit > Duplicate with the text, its cursor and its guide selected; the copy moved down and given
  // other words: it types them, with its own cursor.
  const r = await s.ae(`(function () {
    var c = app.project.activeItem;
    for (var i = 1; i <= c.numLayers; i++) { var n = c.layer(i).name; c.layer(i).selected = n === "Line" || n === "Line Cursor" || n === "Line Guide"; }
    c.openInViewer();
    app.executeCommand(app.findMenuCommandId("Duplicate") || 2080);
    var copy = null, sel = c.selectedLayers;
    for (var k = 0; k < sel.length; k++) if (sel[k] instanceof TextLayer && sel[k].comment !== "LazyTyper guide") copy = sel[k];
    if (!copy) return "no copy";
    var st = copy.property("ADBE Text Properties").property("ADBE Text Document");
    var d = st.value; d.text = "And its copy types its own words."; st.setValue(d);
    var pos = copy.property("ADBE Transform Group").property("ADBE Position");
    pos.setValue([pos.value[0], pos.value[1] + 150]);
    for (var j = 1; j <= c.numLayers; j++) c.layer(j).selected = false;
    return "ok";
  })()`);
  if (r !== "ok") throw new Error(`duplicate: ${r}`);
  await s.strip("22-duplicate", [{ time: 7, label: "" }], { width: 1280 });
}
