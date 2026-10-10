// Spike: ways to read a Source Text value before its expression, from ExtendScript.
(function () {
  var out = {};
  try {
    var comp = app.project.items.addComp("pre", 640, 360, 1, 5, 30);
    var l = comp.layers.addText("Full text here");
    var st = l.property("ADBE Text Properties").property("ADBE Text Document");
    st.expression = "value.substr(0, 3)";
    out.value = String(st.value.text);
    out.valueAtTimeFalse = String(st.valueAtTime(0, false).text);
    out.valueAtTimeTrue = String(st.valueAtTime(0, true).text);
    st.expressionEnabled = false;
    out.disabled = String(st.value.text);
    st.expressionEnabled = true;
    st.setValueAtTime(0, new TextDocument("Keyed text"));
    out.keyValue = String(st.keyValue(1).text);
    out.keyedValueAtTimeTrue = String(st.valueAtTime(0, true).text);
    comp.remove();
  } catch (e) {
    out.error = String(e) + " line " + e.line;
  }
  var f = new File(Folder.temp.fsName + "/LazyTyper/pre.json");
  f.open("w");
  var s = [];
  for (var k in out) s.push("\"" + k + "\":\"" + String(out[k]).replace(/"/g, "'") + "\"");
  f.write("{\"done\":true," + s.join(",") + "}");
  f.close();
})();
