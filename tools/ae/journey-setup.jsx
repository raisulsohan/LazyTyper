// Try-out scene, as a designer would set it up: a search bar shot. Runs in the new project
// tools/ae/fresh-project.jsx made in an earlier run. Writes %TEMP%\LazyTyper\journey.json.
(function () {
  var out = { done: true };
  try {
    var comp = app.project.items.addComp("Search Bar", 1920, 1080, 1, 8, 30);
    comp.openInViewer();
    var bg = comp.layers.addSolid([0.93, 0.94, 0.96], "Background", 1920, 1080, 1);
    bg.locked = true;
    var bar = comp.layers.addShape();
    bar.name = "Search box";
    var g = bar.property("ADBE Root Vectors Group").addProperty("ADBE Vector Group");
    g = bar.property("ADBE Root Vectors Group").property(1);
    var rect = g.property("ADBE Vectors Group").addProperty("ADBE Vector Shape - Rect");
    rect.property("ADBE Vector Rect Size").setValue([1200, 120]);
    rect.property("ADBE Vector Rect Roundness").setValue(60);
    g = bar.property("ADBE Root Vectors Group").property(1);
    var fill = g.property("ADBE Vectors Group").addProperty("ADBE Vector Graphic - Fill");
    fill.property("ADBE Vector Fill Color").setValue([1, 1, 1]);
    bar.property("ADBE Transform Group").property("ADBE Position").setValue([960, 540]);
    var t = comp.layers.addText("how to make natural typing in after effects");
    t.name = "Query";
    var st = t.property("ADBE Text Properties").property("ADBE Text Document");
    var d = st.value;
    d.fontSize = 54;
    d.applyFill = true;
    d.fillColor = [0.13, 0.13, 0.16];
    d.justification = ParagraphJustification.LEFT_JUSTIFY;
    st.setValue(d);
    t.property("ADBE Transform Group").property("ADBE Position").setValue([420, 560]);
    for (var i = 1; i <= comp.numLayers; i++) comp.layer(i).selected = false;
    t.selected = true;
    out.ok = true;
  } catch (e) {
    out.error = String(e) + " line " + e.line;
  }
  var f = new File(Folder.temp.fsName + "/LazyTyper/journey.json");
  f.open("w");
  f.write("{\"done\":true,\"ok\":" + (out.ok ? "true" : "false") + (out.error ? ",\"error\":\"" + out.error.replace(/"/g, "'") + "\"" : "") + "}");
  f.close();
})();
