// Try-out step, what a designer does by hand: Source Text keyframes, the old text at 0 s and
// a new one at 3.2 s. Writes %TEMP%\LazyTyper\journey.json.
(function () {
  var out = { done: true };
  try {
    var comp = app.project.activeItem;
    var l = comp.layer("Query");
    var st = l.property("ADBE Text Properties").property("ADBE Text Document");
    var keep = st.expressionEnabled;
    st.expressionEnabled = false;
    var doc = st.value;
    st.setValueAtTime(0, doc);
    doc.text = "how to make natural typing in premiere pro";
    st.setValueAtTime(3.2, doc);
    st.expressionEnabled = keep;
    out.keys = st.numKeys;
  } catch (e) {
    out.error = String(e) + " line " + e.line;
  }
  var f = new File(Folder.temp.fsName + "/LazyTyper/journey.json");
  f.open("w");
  f.write("{\"done\":true,\"keys\":" + (out.keys || 0) + (out.error ? ",\"error\":\"" + out.error.replace(/"/g, "'") + "\"" : "") + "}");
  f.close();
})();
