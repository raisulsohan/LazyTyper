// LazyTyper design spikes: answers the After Effects questions the rig design depends on.
// Run inside After Effects: AfterFX.com -r tools\spikes\spikes.jsx
// Writes %TEMP%\LazyTyper\spikes\results.json and leaves the test project open, unsaved.
(function () {
  var R = {};
  var dir = new Folder(Folder.temp.fsName + "/LazyTyper/spikes");
  if (!dir.exists) { new Folder(Folder.temp.fsName + "/LazyTyper").create(); dir.create(); }

  function q(s) {
    s = String(s);
    var o = "\"";
    for (var i = 0; i < s.length; i++) {
      var c = s.charAt(i), n = s.charCodeAt(i);
      if (c === "\"" || c === "\\") o += "\\" + c;
      else if (n < 32 || n > 126) { var h = n.toString(16); while (h.length < 4) h = "0" + h; o += "\\u" + h; }
      else o += c;
    }
    return o + "\"";
  }
  function ser(v) {
    if (v === null || v === undefined) return "null";
    if (typeof v === "number") return isFinite(v) ? String(Math.round(v * 1000) / 1000) : "null";
    if (typeof v === "boolean") return v ? "true" : "false";
    if (typeof v === "string") return q(v);
    if (v instanceof Array) { var a = []; for (var i = 0; i < v.length; i++) a.push(ser(v[i])); return "[" + a.join(",") + "]"; }
    var parts = [];
    for (var k in v) if (v.hasOwnProperty(k)) parts.push(q(k) + ":" + ser(v[k]));
    return "{" + parts.join(",") + "}";
  }
  function save() {
    var f = new File(dir.fsName + "/results.json");
    f.encoding = "UTF-8"; f.open("w"); f.write(ser(R)); f.close();
  }
  function rect(layer, t) {
    var r = layer.sourceRectAtTime(t || 0, false);
    return [r.left, r.top, r.width, r.height];
  }
  function tryRun(name, fn) {
    try { R[name] = fn(); } catch (e) { R[name] = { error: String(e) + " line " + e.line }; }
    save();
  }

  app.beginSuppressDialogs();
  app.newProject();
  var comp = app.project.items.addComp("LT spikes", 1920, 1080, 1, 10, 30);
  R.version = app.version;
  R.engine = app.project.expressionEngine;

  function addText(str) {
    var l = comp.layers.addText(str);
    var st = l.property("ADBE Text Properties").property("ADBE Text Document");
    var d = st.value;
    d.fontSize = 100;
    d.justification = ParagraphJustification.LEFT_JUSTIFY;
    d.applyFill = true; d.fillColor = [1, 1, 1];
    st.setValue(d);
    return l;
  }
  function animator(l, propMatch, value, start, end) {
    var anims = l.property("ADBE Text Properties").property("ADBE Text Animators");
    var a = anims.addProperty("ADBE Text Animator");
    var sel = a.property("ADBE Text Selectors").addProperty("ADBE Text Selector");
    sel.property("ADBE Text Range Advanced").property("ADBE Text Range Units").setValue(2);
    sel.property("ADBE Text Index Start").setValue(start);
    sel.property("ADBE Text Index End").setValue(end);
    var p = a.property("ADBE Text Animator Properties").addProperty(propMatch);
    p.setValue(value);
    return { animator: a, selector: sel, prop: p };
  }

  // T2: trailing spaces in sourceRectAtTime.
  tryRun("T2_trailingSpace", function () {
    var a = addText("Hello"), b = addText("Hello   ");
    var o = { plain: rect(a), trailing: rect(b) };
    a.remove(); b.remove();
    return o;
  });

  // T1: does sourceRectAtTime follow text animators?
  tryRun("T1_animatorRect", function () {
    var out = {};
    var l = addText("ABCDEFGHIJ");
    out.none = rect(l);
    var s = animator(l, "ADBE Text Scale 3D", [0, 0, 0], 0, 5);
    out.scale0_first5 = rect(l);
    s.animator.remove();
    s = animator(l, "ADBE Text Opacity", 0, 0, 5);
    out.opacity0_first5 = rect(l);
    s.animator.remove();
    s = animator(l, "ADBE Text Position 3D", [0, 500, 0], 0, 5);
    out.position_first5 = rect(l);
    s.animator.remove();
    l.remove();
    return out;
  });

  // T3: does the index range selector count a line break as a character?
  tryRun("T3_lineBreakIndex", function () {
    var l = addText("ab\rcd");
    var out = { full: rect(l) };
    var s = animator(l, "ADBE Text Scale 3D", [0, 0, 0], 0, 3);
    out.hide0to3 = rect(l);
    s.selector.property("ADBE Text Index End").setValue(4);
    out.hide0to4 = rect(l);
    var c = addText("cd"); c.property("Position").setValue(l.property("Position").value);
    out.cdAlone = rect(c);
    var d = addText("d");
    out.dAlone = rect(d);
    c.remove(); d.remove(); l.remove();
    return out;
  });

  // T4: a slider reading text.sourceText while sourceText's expression reads the slider.
  tryRun("T4_circular", function () {
    var l = addText("Hello world");
    var fx = l.property("ADBE Effect Parade").addProperty("ADBE Slider Control");
    fx.name = "S";
    var sl = fx.property(1);
    sl.expression = "text.sourceText.length";
    var st = l.property("ADBE Text Properties").property("ADBE Text Document");
    st.expression = "var n = effect(\"S\")(1).value; value.substr(0, 3) + \"|\" + n";
    var o = {
      slider: sl.valueAtTime(0, false), sliderErr: sl.expressionError,
      text: st.valueAtTime(0, false).text, textErr: st.expressionError
    };
    // Same thing through keys (pre-expression values).
    st.setValueAtTime(0, new TextDocument("Hello world"));
    sl.expression = "text.sourceText.key(1).value.length";
    o.keySlider = sl.valueAtTime(0, false); o.keySliderErr = sl.expressionError;
    o.keyText = st.valueAtTime(0, false).text; o.keyTextErr = st.expressionError;
    l.remove();
    return o;
  });

  // T8: thisProperty.valueAtTime inside its own expression.
  tryRun("T8_selfValueAtTime", function () {
    var l = comp.layers.addNull();
    var fx = l.property("ADBE Effect Parade").addProperty("ADBE Slider Control");
    var p = fx.property(1);
    p.setValueAtTime(0, 0); p.setValueAtTime(1, 100);
    p.expression = "thisProperty.valueAtTime(0.5) + 1000";
    var o = { v: p.valueAtTime(0, false), err: p.expressionError };
    l.remove();
    return o;
  });

  // T5: Create Shapes from Text.
  tryRun("T5_shapesFromText", function () {
    var id = app.findMenuCommandId("Create Shapes from Text");
    var l = addText("Hi, yo\rok");
    l.property("Position").setValue([300, 400]);
    for (var i = 1; i <= comp.numLayers; i++) comp.layer(i).selected = false;
    l.selected = true;
    comp.openInViewer();
    app.executeCommand(id);
    var o = { cmd: id, numLayers: comp.numLayers, textRect: rect(l) };
    var sh = comp.layer(1);
    if (sh !== l) {
      o.shapeName = sh.name;
      o.shapePos = sh.property("Position").value;
      o.shapeAnchor = sh.property("Anchor Point").value;
      o.textAnchor = l.property("Anchor Point").value;
      o.shapeRect = rect(sh);
      var root = sh.property("ADBE Root Vectors Group");
      o.groups = [];
      for (var g = 1; g <= root.numProperties; g++) {
        var grp = root.property(g);
        var inner = grp.property("ADBE Vectors Group");
        var xs = [];
        var tr = grp.property("ADBE Vector Transform Group");
        var minX = 1e9, maxX = -1e9, minY = 1e9, maxY = -1e9;
        for (var k = 1; k <= inner.numProperties; k++) {
          var item = inner.property(k);
          if (item.matchName === "ADBE Vector Shape - Group") {
            var v = item.property("ADBE Vector Shape").value.vertices;
            for (var m = 0; m < v.length; m++) {
              if (v[m][0] < minX) minX = v[m][0]; if (v[m][0] > maxX) maxX = v[m][0];
              if (v[m][1] < minY) minY = v[m][1]; if (v[m][1] > maxY) maxY = v[m][1];
            }
          }
          xs.push(item.matchName);
        }
        o.groups.push({
          name: grp.name, items: xs.join(","), bounds: [minX, minY, maxX, maxY],
          pos: tr.property("ADBE Vector Position").value, anchor: tr.property("ADBE Vector Anchor").value
        });
      }
      sh.remove();
    }
    l.remove();
    return o;
  });

  // T6: baselineLocs for box text that wraps, and for point text.
  tryRun("T6_baselineLocs", function () {
    var b = comp.layers.addBoxText([500, 400], "The quick brown fox jumps over the lazy dog again and again");
    var st = b.property("ADBE Text Properties").property("ADBE Text Document");
    var d = st.value; d.fontSize = 60; st.setValue(d);
    d = st.value;
    var o = { box: d.baselineLocs, boxPos: d.boxTextPos, boxSize: d.boxTextSize, boxRect: rect(b), leading: d.leading, autoLeading: d.autoLeading };
    var p = addText("Line one\rLine two\rx");
    o.point = p.property("ADBE Text Properties").property("ADBE Text Document").value.baselineLocs;
    o.pointRect = rect(p);
    b.remove(); p.remove();
    return o;
  });

  // T7, T10, T12, T13: misc APIs.
  tryRun("T7_misc", function () {
    var l = addText("Hello World");
    var fx = l.property("ADBE Effect Parade").addProperty("ADBE Slider Control");
    var p = fx.property(1);
    p.setValueAtTime(0, 1); p.setValueAtTime(1, 2);
    var o = { setLabelAtKey: typeof p.setLabelAtKey, keyLabel: typeof p.keyLabel };
    try { p.setLabelAtKey(1, 3); o.labelRead = p.keyLabel(1); } catch (e1) { o.labelErr = String(e1); }
    var dd = l.property("ADBE Effect Parade").addProperty("ADBE Dropdown Control");
    try {
      var menu = dd.property(1);
      var np = menu.setPropertyParameters(["Frames Per Character", "Total Duration"]);
      o.dropdown = np ? np.parentProperty.name : "?";
      o.dropdownVal = l.property("ADBE Effect Parade").property(2).property(1).value;
    } catch (e2) { o.dropdownErr = String(e2); }
    var s2 = l.property("ADBE Effect Parade").addProperty("ADBE Slider Control");
    s2.property(1).expression = "var s = text.sourceText.style; [s.fontSize, s.autoLeading ? 1 : 0, s.leading, text.sourceText.getStyleAt(0, 0).fontSize].join(',').length";
    o.styleExprErr = s2.property(1).expressionError;
    o.styleExprVal = s2.property(1).valueAtTime(0, false);
    var s3 = l.property("ADBE Effect Parade").addProperty("ADBE Slider Control");
    s3.property(1).expression = "text.sourceText.style.fontSize * 1000 + (text.sourceText.style.autoLeading ? 1 : 0)";
    o.fontSizeExpr = s3.property(1).valueAtTime(0, false);
    o.fontSizeErr = s3.property(1).expressionError;
    l.remove();
    var shp = comp.layers.addShape();
    var grp = shp.property("ADBE Root Vectors Group").addProperty("ADBE Vector Group");
    var path = grp.property("ADBE Vectors Group").addProperty("ADBE Vector Shape - Group");
    path.property("ADBE Vector Shape").expression = "createPath([[0,0],[10,0],[10,10]], [], [], true)";
    o.createPathErr = path.property("ADBE Vector Shape").expressionError;
    shp.remove();
    return o;
  });

  // T14: sourceRectAtTime of a hidden guide layer.
  tryRun("T14_hiddenGuide", function () {
    var l = addText("Guide text");
    l.guideLayer = true; l.enabled = false;
    var o = { rect: rect(l) };
    var n = comp.layers.addNull();
    var fx = n.property("ADBE Effect Parade").addProperty("ADBE Slider Control");
    fx.property(1).expression = "thisComp.layer(\"" + l.name + "\").sourceRectAtTime(time, false).width";
    o.exprWidth = fx.property(1).valueAtTime(0, false);
    o.err = fx.property(1).expressionError;
    l.remove(); n.remove();
    return o;
  });

  // T15: sourceRectAtTime with a Source Text expression that shortens the text.
  tryRun("T15_exprText", function () {
    var l = addText("ABCDEFGHIJ");
    l.property("ADBE Text Properties").property("ADBE Text Document").expression = "value.substr(0, 3)";
    var o = { rect: rect(l) };
    l.remove();
    return o;
  });

  app.endSuppressDialogs(false);
  R.done = true;
  save();
})();
