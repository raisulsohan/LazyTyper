// UI test helper: saves comp frames as PNGs at the times listed in %TEMP%\LazyTyper\ui\frames.txt
// (one per line), into that folder as frame-<n>.png, then writes frames.json.
(function () {
  var dir = Folder.temp.fsName + "/LazyTyper/ui";
  var f = new File(dir + "/frames.txt");
  f.open("r");
  var times = f.read().split("\n");
  f.close();
  var comp = app.project.activeItem;
  var saved = [];
  var err = "";
  try {
    for (var i = 0; i < times.length; i++) {
      if (times[i] === "") continue;
      var file = new File(dir + "/frame-" + i + ".png");
      comp.saveFrameToPng(parseFloat(times[i]), file);
      saved.push(i);
    }
  } catch (e) {
    err = String(e);
  }
  var o = new File(dir + "/frames.json");
  o.open("w");
  o.write("{\"done\":true,\"saved\":" + saved.length + ",\"error\":\"" + err.replace(/"/g, "'") + "\"}");
  o.close();
})();
