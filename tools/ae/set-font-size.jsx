// Test helper, a designer's edit by hand: sets the font size of the layer named on the first line
// of %TEMP%\LazyTyper\ui\font.txt to the size on its second line (every Source Text keyframe,
// or the text itself). Writes font.json.
(function () {
  var dir = Folder.temp.fsName + "/LazyTyper/ui";
  var f = new File(dir + "/font.txt");
  f.open("r");
  var lines = f.read().split("\n");
  f.close();
  var ok = false;
  try {
    var st = app.project.activeItem.layer(lines[0]).property("ADBE Text Properties").property("ADBE Text Document");
    var keep = st.expressionEnabled;
    st.expressionEnabled = false;
    var size = parseFloat(lines[1]);
    if (st.numKeys > 0) {
      for (var i = 1; i <= st.numKeys; i++) {
        var d = st.keyValue(i);
        d.fontSize = size;
        st.setValueAtKey(i, d);
      }
    } else {
      var v = st.value;
      v.fontSize = size;
      st.setValue(v);
    }
    st.expressionEnabled = keep;
    ok = true;
  } catch (e) {}
  var o = new File(dir + "/font.json");
  o.open("w");
  o.write("{\"done\":true,\"ok\":" + ok + "}");
  o.close();
})();
