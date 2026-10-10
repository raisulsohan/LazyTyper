// Try-out step, the animator's way: select baked keystroke 10 and every one after it and drag
// them 8 frames later (a hesitation before key 10). Writes %TEMP%\LazyTyper\journey.json.
(function () {
  var out = { done: true };
  try {
    var comp = app.project.activeItem;
    var p = comp.layer("Query").property("ADBE Effect Parade").property("Characters Shown").property(1);
    var fd = comp.frameDuration;
    var times = [], values = [], labels = [];
    for (var i = 10; i <= p.numKeys; i++) {
      times.push(p.keyTime(i) + 8 * fd);
      values.push(p.keyValue(i));
      labels.push(p.keyLabel(i));
    }
    out.firstBefore = Math.round(p.keyTime(10) / fd);
    for (var r = p.numKeys; r >= 10; r--) p.removeKey(r);
    p.setValuesAtTimes(times, values);
    for (var k = 10; k <= p.numKeys; k++) {
      p.setInterpolationTypeAtKey(k, KeyframeInterpolationType.HOLD, KeyframeInterpolationType.HOLD);
      p.setLabelAtKey(k, labels[k - 10]);
    }
    out.firstAfter = Math.round(p.keyTime(10) / fd);
    var seq = [];
    for (var f = out.firstBefore - 2; f <= out.firstAfter + 2; f++) seq.push(f + "f:" + p.valueAtTime(f * fd, false));
    out.sequence = seq.join(" ");
    out.keys = p.numKeys;
  } catch (e) {
    out.error = String(e) + " line " + e.line;
  }
  var w = new File(Folder.temp.fsName + "/LazyTyper/journey.json");
  w.open("w");
  var s = [];
  for (var key in out) s.push("\"" + key + "\":\"" + String(out[key]).replace(/"/g, "'") + "\"");
  w.write("{" + s.join(",") + ",\"done\":true}");
  w.close();
})();
