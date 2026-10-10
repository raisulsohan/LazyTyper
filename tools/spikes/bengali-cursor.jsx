// Bengali cursor spike: how After Effects counts and outlines shaped (joining) text.
// Run in a new project (tools/ae/fresh-project.jsx first, in a run of its own):
//   node tools/ae-run.mjs tools/spikes/bengali-cursor.jsx %TEMP%\LazyTyper\spikes\bengali.json 600
// For each test string it records:
//   units   - for range selector index k (Subtract, one unit wide, over a Scale-0 "All"
//             selector), the left and right of what is left: which index shows which glyph
//   glyphs  - Create Shapes from Text group names and boxes, in order
//   prefix  - for every typed prefix: the true right edge (the prefix laid out alone), the
//             right edge the 1.1.1 guide measures (last character by string index) and the
//             one an Expression Selector measures (the last unit by textIndex/textTotal)
// Leaves the project open, unsaved.
(function () {
  var R = { done: false };
  var dir = new Folder(Folder.temp.fsName + "/LazyTyper/spikes");
  if (!dir.exists) {
    new Folder(Folder.temp.fsName + "/LazyTyper").create();
    dir.create();
  }

  function q(s) {
    s = String(s);
    var o = "\"";
    for (var i = 0; i < s.length; i++) {
      var c = s.charAt(i), n = s.charCodeAt(i);
      if (c === "\"" || c === "\\") o += "\\" + c;
      else if (n < 32 || n > 126) {
        var h = n.toString(16);
        while (h.length < 4) h = "0" + h;
        o += "\\u" + h;
      } else o += c;
    }
    return o + "\"";
  }
  function ser(v) {
    if (v === null || v === undefined) return "null";
    if (typeof v === "number") return isFinite(v) ? String(Math.round(v * 10) / 10) : "null";
    if (typeof v === "boolean") return v ? "true" : "false";
    if (typeof v === "string") return q(v);
    if (v instanceof Array) {
      var a = [];
      for (var i = 0; i < v.length; i++) a.push(ser(v[i]));
      return "[" + a.join(",") + "]";
    }
    var parts = [];
    for (var k in v) if (v.hasOwnProperty(k)) parts.push(q(k) + ":" + ser(v[k]));
    return "{" + parts.join(",") + "}";
  }
  function save() {
    var f = new File(dir.fsName + "/bengali.json");
    f.encoding = "UTF-8";
    f.open("w");
    f.write(ser(R));
    f.close();
  }

  var TEXTS = [
    { id: "bn", font: "NirmalaUI", s: "\u0986\u09ae\u09bf \u09ac\u09be\u0982\u09b2\u09be\u09df \u099f\u09be\u0987\u09aa \u0995\u09b0\u09bf\u0964 \u098f\u099f\u09be\u0993 \u099a\u09b2\u09c7\u0964" },
    // Conjuncts, reph, a two-part vowel sign and a nukta letter: kshama karma stri kothay.
    { id: "bn2", font: "NirmalaUI", s: "\u0995\u09cd\u09b7\u09ae\u09be \u0995\u09b0\u09cd\u09ae \u09b8\u09cd\u09a4\u09cd\u09b0\u09c0 \u0995\u09cb\u09a5\u09be\u09af\u09bc" },
    { id: "ja", font: "YuGothic-Regular", s: "\u3053\u308c\u3082\u6253\u3066\u307e\u3059\u3002\u81ea\u7136\u306b\u3002" },
    { id: "en", font: "SegoeUI", s: "Hello, world." }
  ];

  var comp;
  function textProp(l) {
    return l.property("ADBE Text Properties").property("ADBE Text Document");
  }
  function addText(str, font) {
    var l = comp.layers.addText(str);
    var st = textProp(l);
    var d = st.value;
    d.font = font;
    d.fontSize = 46;
    d.justification = ParagraphJustification.LEFT_JUSTIFY;
    d.applyFill = true;
    d.fillColor = [1, 1, 1];
    st.setValue(d);
    l.property("ADBE Transform Group").property("ADBE Position").setValue([200, 300]);
    return l;
  }
  function setText(l, str) {
    var st = textProp(l);
    var d = st.value;
    d.text = str;
    st.setValue(d);
  }
  function lr(l) {
    var r = l.sourceRectAtTime(0, false);
    if (!(r.width > 0 || r.height > 0)) return null;
    return [r.left, r.left + r.width];
  }
  function animators(l) {
    return l.property("ADBE Text Properties").property("ADBE Text Animators");
  }

  /* Scale 0 on all units but one range-selector unit (Subtract), as the 1.1.1 guide does. */
  function rangeGuide(l) {
    var a = animators(l).addProperty("ADBE Text Animator");
    a.name = "G";
    animators(l).property("G").property("ADBE Text Selectors").addProperty("ADBE Text Selector");
    animators(l).property("G").property("ADBE Text Selectors").addProperty("ADBE Text Selector");
    animators(l).property("G").property("ADBE Text Animator Properties").addProperty("ADBE Text Scale 3D").setValue([0, 0, 0]);
    var sels = animators(l).property("G").property("ADBE Text Selectors");
    sels.property(1).property("ADBE Text Range Advanced").property("ADBE Text Range Units").setValue(2);
    sels.property(1).property("ADBE Text Index End").setValue(99999);
    var adv = sels.property(2).property("ADBE Text Range Advanced");
    adv.property("ADBE Text Range Units").setValue(2);
    adv.property("ADBE Text Selector Mode").setValue(2);
    return function (k) {
      var s2 = animators(l).property("G").property("ADBE Text Selectors").property(2);
      s2.property("ADBE Text Index Start").setValue(k);
      s2.property("ADBE Text Index End").setValue(k + 1);
    };
  }

  /* Scale 0 on every unit but the last non-blank one, from an Expression Selector. */
  var EXPR_SEL =
    "function LT_str(v) { var s; try { s = v.text; } catch (e) {} return typeof s === \"string\" ? s : \"\" + v; }\n" +
    "var s = LT_str(text.sourceText.value), n = 0, j = s.length - 1;\n" +
    "while (j >= 0) { var c = s.charAt(j); if (c === \" \" || c === \"\\u00A0\") n++; else if (c !== \"\\r\" && c !== \"\\n\") break; j--; }\n" +
    "var a = textIndex === textTotal - n ? 0 : 100;\n" +
    "[a, a, a]";
  function exprGuide(l) {
    var a = animators(l).addProperty("ADBE Text Animator");
    a.name = "E";
    var sel = animators(l).property("E").property("ADBE Text Selectors").addProperty("ADBE Text Expressible Selector");
    var kids = [];
    for (var i = 1; i <= sel.numProperties; i++) kids.push(sel.property(i).matchName + "=" + sel.property(i).name);
    R.exprSelectorProps = kids;
    animators(l).property("E").property("ADBE Text Animator Properties").addProperty("ADBE Text Scale 3D").setValue([0, 0, 0]);
    sel = animators(l).property("E").property("ADBE Text Selectors").property(1);
    sel.property("ADBE Text Expressible Amount").expression = EXPR_SEL;
    return sel.property("ADBE Text Expressible Amount");
  }

  function isBlank(c) {
    return c === " " || c === "\r" || c === "\n";
  }

  function probe(T) {
    var out = { id: T.id, length: T.s.length };
    // units
    var l = addText(T.s, T.font);
    l.name = T.id + " units";
    out.font = textProp(l).value.font;
    out.full = lr(l);
    var pick = rangeGuide(l);
    var units = [];
    for (var k = 0; k <= T.s.length + 1; k++) {
      pick(k);
      units.push([k, lr(l)]);
    }
    out.units = units;
    l.remove();
    save();

    // glyphs (Create Shapes from Text)
    var g = addText(T.s, T.font);
    g.name = T.id + " glyphs";
    for (var i = 1; i <= comp.numLayers; i++) comp.layer(i).selected = false;
    g.selected = true;
    comp.openInViewer();
    var before = comp.numLayers;
    app.executeCommand(app.findMenuCommandId("Create Shapes from Text") || 3781);
    var glyphs = [];
    if (comp.numLayers > before) {
      var shape = comp.selectedLayers.length ? comp.selectedLayers[0] : comp.layer(g.index - 1);
      var root = shape.property("ADBE Root Vectors Group");
      for (var gi = 1; gi <= root.numProperties; gi++) {
        var grp = root.property(gi);
        var inner = grp.property("ADBE Vectors Group");
        var gt = grp.property("ADBE Vector Transform Group");
        var off = [0, 0];
        if (gt) {
          var gp = gt.property("ADBE Vector Position").value;
          var ga = gt.property("ADBE Vector Anchor").value;
          off = [gp[0] - ga[0], gp[1] - ga[1]];
        }
        var box = null;
        for (var pk = 1; inner && pk <= inner.numProperties; pk++) {
          var item = inner.property(pk);
          if (item.matchName !== "ADBE Vector Shape - Group") continue;
          var v = item.property("ADBE Vector Shape").value.vertices;
          for (var m = 0; m < v.length; m++) {
            var x = v[m][0] + off[0];
            if (!box) box = [x, x];
            else {
              if (x < box[0]) box[0] = x;
              if (x > box[1]) box[1] = x;
            }
          }
        }
        glyphs.push([grp.name, box]);
      }
      var sr = shape.sourceRectAtTime(0, false);
      var tr = g.sourceRectAtTime(0, false);
      out.shapeDx = tr.left - sr.left;
      shape.remove();
    } else out.glyphError = "no shape layer";
    out.glyphs = glyphs;
    g.remove();
    save();

    // prefixes: truth vs 1.1.1 guide vs expression selector, in both expression engines
    var engines = ["extendscript", "javascript-1.0"];
    for (var e = 0; e < engines.length; e++) {
      app.project.expressionEngine = engines[e];
      var truth = addText(T.s, T.font);
      var old = addText(T.s, T.font);
      var ex = addText(T.s, T.font);
      var oldPick = rangeGuide(old);
      var amount = exprGuide(ex);
      var rows = [];
      for (var p = 1; p <= T.s.length; p++) {
        var str = T.s.substr(0, p);
        setText(truth, str);
        setText(old, str);
        setText(ex, str);
        var j = p - 1;
        while (j >= 0 && isBlank(str.charAt(j))) j--;
        oldPick(j < 0 ? 0 : j);
        $.hiresTimer;
        var exr = lr(ex);
        var ms = $.hiresTimer / 1000;
        rows.push([p, str.charAt(p - 1), lr(truth), lr(old), exr, ms]);
      }
      out["prefix-" + engines[e]] = rows;
      out["exprError-" + engines[e]] = amount.expressionError;
      truth.remove();
      old.remove();
      ex.remove();
      save();
    }
    return out;
  }

  app.beginSuppressDialogs();
  try {
    R.version = app.version;
    comp = app.project.items.addComp("LT Bengali spike", 1920, 1080, 1, 10, 30);
    comp.openInViewer();
    R.results = [];
    for (var t = 0; t < TEXTS.length; t++) {
      R.results.push(probe(TEXTS[t]));
      save();
    }
    // Speed: a 600-character English line, the expression selector at 10 prefixes.
    app.project.expressionEngine = "javascript-1.0";
    var longS = "";
    while (longS.length < 600) longS += "The quick brown fox jumps over the lazy dog. ";
    var big = addText(longS, "SegoeUI");
    exprGuide(big);
    $.hiresTimer;
    for (var b = 0; b < 10; b++) {
      setText(big, longS.substr(0, 600 - b * 7));
      lr(big);
    }
    R.longExprMsPerFrame = $.hiresTimer / 10000;
    var big2 = addText(longS, "SegoeUI");
    var pick2 = rangeGuide(big2);
    $.hiresTimer;
    for (var b2 = 0; b2 < 10; b2++) {
      setText(big2, longS.substr(0, 600 - b2 * 7));
      pick2(590 - b2 * 7);
      lr(big2);
    }
    R.longRangeMsPerFrame = $.hiresTimer / 10000;
  } catch (err) {
    R.error = String(err) + " line " + err.line;
  }
  try {
    app.endSuppressDialogs(false);
  } catch (e2) {}
  R.done = true;
  save();
})();
