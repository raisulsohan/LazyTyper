// Try-out step, what a designer does by hand: makes the query text bigger (54 -> 80 px) on
// every Source Text keyframe. Writes %TEMP%\LazyTyper\journey.json.
(function () {
  var out = { done: true };
  try {
    var st = app.project.activeItem.layer("Query").property("ADBE Text Properties").property("ADBE Text Document");
    var keep = st.expressionEnabled;
    st.expressionEnabled = false;
    for (var i = 1; i <= st.numKeys; i++) {
      var d = st.keyValue(i);
      d.fontSize = 80;
      st.setValueAtKey(i, d);
    }
    st.expressionEnabled = keep;
    out.ok = true;
  } catch (e) {
    out.error = String(e) + " line " + e.line;
  }
  var f = new File(Folder.temp.fsName + "/LazyTyper/journey.json");
  f.open("w");
  f.write("{\"done\":true,\"ok\":" + (out.ok ? "true" : "false") + (out.error ? ",\"error\":\"" + out.error.replace(/"/g, "'") + "\"" : "") + "}");
  f.close();
})();
