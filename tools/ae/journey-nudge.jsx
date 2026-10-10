// Try-out step, what an animator does by hand after Bake: drags keystroke 10 eight frames later
// (After Effects has no "move key", so: remove it and set it again with its label). Also counts
// the label colours. Writes %TEMP%\LazyTyper\journey.json.
(function () {
  var out = { done: true };
  try {
    var comp = app.project.activeItem;
    var l = comp.layer("Query");
    var p = l.property("ADBE Effect Parade").property("Characters Shown").property(1);
    var labels = {};
    for (var i = 1; i <= p.numKeys; i++) {
      var lb = p.keyLabel(i);
      labels[lb] = (labels[lb] || 0) + 1;
    }
    var parts = [];
    for (var k in labels) parts.push(k + ":" + labels[k]);
    out.labels = parts.join(" ");
    var t = p.keyTime(10);
    var v = p.keyValue(10);
    var lab = p.keyLabel(10);
    p.removeKey(10);
    var nt = t + 8 * comp.frameDuration;
    p.setValueAtTime(nt, v);
    var idx = p.nearestKeyIndex(nt);
    p.setInterpolationTypeAtKey(idx, KeyframeInterpolationType.HOLD, KeyframeInterpolationType.HOLD);
    p.setLabelAtKey(idx, lab);
    out.moved = "key 10 (" + v + " characters) from " + Math.round(t / comp.frameDuration) + "f to " + Math.round(nt / comp.frameDuration) + "f";
    out.before = Math.round(t / comp.frameDuration);
    out.after = Math.round(nt / comp.frameDuration);
    out.shownAtOld = p.valueAtTime(t + comp.frameDuration, false);
    out.value = v;
  } catch (e) {
    out.error = String(e) + " line " + e.line;
  }
  var f = new File(Folder.temp.fsName + "/LazyTyper/journey.json");
  f.open("w");
  var s = [];
  for (var key in out) s.push("\"" + key + "\":\"" + String(out[key]).replace(/"/g, "'") + "\"");
  f.write("{" + s.join(",") + ",\"done\":true}");
  f.close();
})();
