// UI test helper: selects the layer named in %TEMP%\LazyTyper\ui\select.txt (only that one),
// sets the comp time from the second line, and writes select.json.
(function () {
  var dir = Folder.temp.fsName + "/LazyTyper/ui";
  var f = new File(dir + "/select.txt");
  f.open("r");
  var lines = f.read().split("\n");
  f.close();
  var comp = app.project.activeItem;
  var ok = false;
  if (comp instanceof CompItem) {
    for (var i = 1; i <= comp.numLayers; i++) comp.layer(i).selected = comp.layer(i).name === lines[0];
    if (lines.length > 1 && lines[1] !== "") comp.time = parseFloat(lines[1]);
    ok = true;
  }
  var o = new File(dir + "/select.json");
  o.open("w");
  o.write("{\"done\":true,\"ok\":" + ok + "}");
  o.close();
})();
