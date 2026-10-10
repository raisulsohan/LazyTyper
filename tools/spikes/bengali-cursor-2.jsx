// Bengali cursor spike, part 2: an Expression Selector based on "Characters Excluding Spaces"
// that needs no Source Text read (textIndex === textTotal leaves the last non-space unit), its
// speed on a long line, and whether a Stable rig's opacity range counts clusters.
//   node tools/ae-run.mjs tools/spikes/bengali-cursor-2.jsx %TEMP%\LazyTyper\spikes\bengali-2.json 600
(function () {
  var R = { done: false };
  var dir = new Folder(Folder.temp.fsName + "/LazyTyper/spikes");
  if (!dir.exists) dir.create();
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
    var f = new File(dir.fsName + "/bengali-2.json");
    f.encoding = "UTF-8";
    f.open("w");
    f.write(ser(R));
    f.close();
  }
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
  function guide(l, basedOn, expr) {
    var a = animators(l).addProperty("ADBE Text Animator");
    a.name = "E";
    animators(l).property("E").property("ADBE Text Selectors").addProperty("ADBE Text Expressible Selector");
    animators(l).property("E").property("ADBE Text Animator Properties").addProperty("ADBE Text Scale 3D").setValue([0, 0, 0]);
    var sel = animators(l).property("E").property("ADBE Text Selectors").property(1);
    sel.property("ADBE Text Range Type2").setValue(basedOn);
    sel.property("ADBE Text Expressible Amount").expression = expr;
    return sel.property("ADBE Text Expressible Amount");
  }
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

  var CHEAP = "textIndex === textTotal ? 0 : 100";
  var CHEAP3 = "var a = textIndex === textTotal ? 0 : 100;\n[a, a, a]";
  var BN = "\u0986\u09AE\u09BF \u09AC\u09BE\u0982\u09B2\u09BE\u09DF";
  var CASES = [
    ["en", "SegoeUI", "Hello, world"],
    ["en-space", "SegoeUI", "Hello, world "],
    ["en-2space", "SegoeUI", "Hello, world  "],
    ["en-nbsp", "SegoeUI", "Hello, world\u00A0"],
    ["en-tab", "SegoeUI", "Hello, world\t"],
    ["en-thin", "SegoeUI", "Hello, world\u2009"],
    ["en-break", "SegoeUI", "Hello, world\r"],
    ["en-break-space", "SegoeUI", "Hello,\rworld \r "],
    ["ja-ideo", "YuGothic-Regular", "\u3053\u308C\u3082\u3000"],
    ["bn", "NirmalaUI", BN],
    ["bn-space", "NirmalaUI", BN + " "],
    ["bn-mid", "NirmalaUI", "\u0986\u09AE\u09BF \u09AC"],
    ["bn-halant", "NirmalaUI", "\u0995\u09B0\u09CD"],
    ["blank", "SegoeUI", "  "]
  ];

  app.beginSuppressDialogs();
  try {
    R.version = app.version;
    comp = app.project.items.addComp("LT Bengali spike 2", 1920, 1080, 1, 10, 30);
    comp.openInViewer();
    var engines = ["extendscript", "javascript-1.0"];
    for (var e = 0; e < engines.length; e++) {
      app.project.expressionEngine = engines[e];
      var rows = [];
      for (var c = 0; c < CASES.length; c++) {
        var C = CASES[c];
        var trimmed = C[2].replace(/[\s\u00A0\u3000\u2009]+$/, "");
        var truth = addText(trimmed.length ? trimmed : "x", C[1]);
        var a = addText(C[2], C[1]);
        var ea = guide(a, 2, CHEAP);
        var b = addText(C[2], C[1]);
        var eb = guide(b, 2, CHEAP3);
        rows.push([C[0], trimmed.length ? lr(truth) : null, lr(a), lr(b), ea.expressionError, eb.expressionError]);
        truth.remove();
        a.remove();
        b.remove();
      }
      R["rows-" + engines[e]] = rows;
      save();
    }

    // Speed on a 600-character line (JavaScript engine): cheap selector, the probe-1 selector, range.
    app.project.expressionEngine = "javascript-1.0";
    var longS = "";
    while (longS.length < 600) longS += "The quick brown fox jumps over the lazy dog. ";
    var none = addText(longS, "SegoeUI");
    $.hiresTimer;
    for (var n0 = 0; n0 < 10; n0++) {
      setText(none, longS.substr(0, 600 - n0 * 7));
      lr(none);
    }
    R.longNoGuideMs = $.hiresTimer / 10000;
    none.remove();
    var big = addText(longS, "SegoeUI");
    guide(big, 2, CHEAP);
    $.hiresTimer;
    for (var b1 = 0; b1 < 10; b1++) {
      setText(big, longS.substr(0, 600 - b1 * 7));
      lr(big);
    }
    R.longCheapMs = $.hiresTimer / 10000;
    big.remove();
    var big2 = addText(longS, "SegoeUI");
    var pick2 = rangeGuide(big2);
    $.hiresTimer;
    for (var b2 = 0; b2 < 10; b2++) {
      setText(big2, longS.substr(0, 600 - b2 * 7));
      pick2(590 - b2 * 7);
      lr(big2);
    }
    R.longRangeMs = $.hiresTimer / 10000;
    big2.remove();

    // Stable: does a range from index k hide from the k-th cluster (unit)?
    var st = addText(BN, "NirmalaUI");
    var an = animators(st).addProperty("ADBE Text Animator");
    an.name = "O";
    animators(st).property("O").property("ADBE Text Selectors").addProperty("ADBE Text Selector");
    animators(st).property("O").property("ADBE Text Animator Properties").addProperty("ADBE Text Scale 3D").setValue([0, 0, 0]);
    var os = animators(st).property("O").property("ADBE Text Selectors").property(1);
    os.property("ADBE Text Range Advanced").property("ADBE Text Range Units").setValue(2);
    os.property("ADBE Text Index End").setValue(99999);
    // Scale 0 from index k on: the rect is what an opacity range from k would leave visible.
    var ext = [];
    for (var k2 = 0; k2 <= 8; k2++) {
      os = animators(st).property("O").property("ADBE Text Selectors").property(1);
      os.property("ADBE Text Index Start").setValue(k2);
      ext.push([k2, lr(st)]);
    }
    R.stableRange = ext;
  } catch (err) {
    R.error = String(err) + " line " + err.line;
  }
  try {
    app.endSuppressDialogs(false);
  } catch (e2) {}
  R.done = true;
  save();
})();
