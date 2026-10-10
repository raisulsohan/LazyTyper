// UI test setup, in the new project tools/ae/fresh-project.jsx made in an earlier run: one
// comp and two text layers; selects the first. Writes %TEMP%\LazyTyper\ui\setup.json.
(function () {
  var out = {};
  try {
    app.project.expressionEngine = "javascript-1.0";
    var comp = app.project.items.addComp("LazyTyper UI test", 1920, 1080, 1, 10, 30);
    var bg = comp.layers.addSolid([0.08, 0.07, 0.12], "Background", 1920, 1080, 1);
    bg.locked = true;
    function text(str, pos, size, just, box) {
      var l = box ? comp.layers.addBoxText(box, str) : comp.layers.addText(str);
      var st = l.property("ADBE Text Properties").property("ADBE Text Document");
      var d = st.value;
      d.fontSize = size;
      d.applyFill = true;
      d.fillColor = [0.95, 0.94, 0.98];
      d.justification = just;
      st.setValue(d);
      l.property("ADBE Transform Group").property("ADBE Position").setValue(pos);
      return l;
    }
    var b = text("Words wrap onto the next line as they are typed, just like a real editor.", [960, 700], 56,
      ParagraphJustification.CENTER_JUSTIFY, [1200, 300]);
    b.name = "Paragraph";
    var a = text("Hello, this is LazyTyper.", [300, 380], 96, ParagraphJustification.LEFT_JUSTIFY, null);
    a.name = "Headline";
    comp.openInViewer();
    for (var i = 1; i <= comp.numLayers; i++) comp.layer(i).selected = false;
    comp.layer("Headline").selected = true;
    out.ok = true;
  } catch (err) {
    out.error = String(err) + " line " + err.line;
  }
  out.done = true;
  var f = new File(Folder.temp.fsName + "/LazyTyper/ui/setup.json");
  f.parent.create();
  f.open("w");
  f.write(out.error ? "{\"done\":true,\"error\":\"" + out.error.replace(/"/g, "'") + "\"}" : "{\"done\":true,\"ok\":true}");
  f.close();
})();
