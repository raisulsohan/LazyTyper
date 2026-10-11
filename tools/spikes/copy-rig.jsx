// Spike for copying a whole rig (text + guide + cursor): what After Effects does with parenting,
// layer-control links and comments when layers are duplicated (Edit > Duplicate) or copied and
// pasted into another comp; whether a Layer Control can take an expression; whether assigning
// layer.parent moves the child; whether removing a parent moves its child; and per-character fill
// colours (TextDocument.characterRange).
//   node tools/ae-run.mjs tools/ae/fresh-project.jsx %TEMP%\LazyTyper\fresh.json 300
//   node tools/ae-run.mjs tools/spikes/copy-rig.jsx %TEMP%\LazyTyper\spikes\copy-rig.json 300
(function () {
  var R = { done: false, notes: [] };
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
    if (typeof v === "number") return isFinite(v) ? String(Math.round(v * 1000) / 1000) : "null";
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
    var f = new File(dir.fsName + "/copy-rig.json");
    f.encoding = "UTF-8";
    f.open("w");
    f.write(ser(R));
    f.close();
  }
  function cmd(name, fallback) {
    var id = 0;
    try {
      id = app.findMenuCommandId(name);
    } catch (e) {}
    return id > 0 ? id : fallback;
  }
  function tr(l) {
    return l.property("ADBE Transform Group");
  }
  function addLayerControl(l, name, target) {
    var fx = l.property("ADBE Effect Parade").addProperty("ADBE Layer Control");
    fx.name = name;
    if (target) l.property("ADBE Effect Parade").property(name).property(1).setValue(target.index);
    return l.property("ADBE Effect Parade").property(name).property(1);
  }
  function ctl(l, name) {
    var fx = l.property("ADBE Effect Parade").property(name);
    return fx ? fx.property(1) : null;
  }
  function nameAt(comp, idx) {
    return idx > 0 && idx <= comp.numLayers ? comp.layer(idx).name + " #" + idx : "none (" + idx + ")";
  }
  function describe(comp, l) {
    var d = { name: l.name, index: l.index, comment: l.comment, parent: l.parent ? l.parent.name + " #" + l.parent.index : null };
    var tl = ctl(l, "Text Layer");
    var gl = ctl(l, "Guide Layer");
    if (tl) d.textLayer = nameAt(comp, tl.value);
    if (gl) d.guideLayer = nameAt(comp, gl.value);
    try {
      d.shy = l.shy;
      d.enabled = l.enabled;
      d.guide = l.guideLayer;
    } catch (e) {}
    return d;
  }
  function selectOnly(comp, list) {
    for (var i = 1; i <= comp.numLayers; i++) comp.layer(i).selected = false;
    for (var j = 0; j < list.length; j++) list[j].selected = true;
  }

  try {
    app.beginSuppressDialogs();
    app.project.expressionEngine = "javascript-1.0";
    var A = app.project.items.addComp("Spike A", 1920, 1080, 1, 10, 30);
    var B = app.project.items.addComp("Spike B", 1920, 1080, 1, 10, 30);
    A.openInViewer();

    // A rig-shaped set: text T, guide G (parented to T), cursor C (parented to T, links to T and
    // G), cursor C1 (parented to G).
    var T = A.layers.addText("Hello copy");
    T.name = "Line";
    T.comment = "spike text";
    tr(T).property("ADBE Position").setValue([300, 400]);
    tr(T).property("ADBE Rotate Z").setValue(10);
    var G = T.duplicate();
    G.name = "Line Guide";
    G.comment = "LazyTyper guide";
    G.parent = T;
    tr(G).property("ADBE Position").setValue([0, 0]);
    tr(G).property("ADBE Rotate Z").setValue(0);
    G.guideLayer = true;
    G.enabled = false;
    G.shy = true;
    var C = A.layers.addShape();
    C.name = "Line Cursor";
    C.comment = "LazyTyper cursor";
    C.parent = T;
    addLayerControl(C, "Text Layer", T);
    addLayerControl(C, "Guide Layer", G);
    var C1 = A.layers.addShape();
    C1.name = "Line Cursor 1";
    C1.comment = "LazyTyper cursor";
    C1.parent = G;
    tr(C1).property("ADBE Position").setValue([5, 5]);
    tr(C1).property("ADBE Position").expression = "[parent.index, parent.parent.index]";
    R.before = [describe(A, T), describe(A, G), describe(A, C), describe(A, C1)];

    // 1. Can a Layer Control take an expression, and what does it accept?
    var N = A.layers.addNull();
    N.name = "Probe";
    N.parent = T;
    var lp = addLayerControl(N, "Text Layer", null);
    R.layerControl = { canSetExpression: lp.canSetExpression };
    var tries = ["parent", "parent.index", "thisComp.layer(\"Line\")", "thisComp.layer(\"Line\").index"];
    for (var ti = 0; ti < tries.length; ti++) {
      var res = {};
      try {
        lp.expression = tries[ti];
        res.value = lp.value;
        res.valueAtTime = lp.valueAtTime(1, false);
        res.error = lp.expressionError;
        res.enabled = lp.expressionEnabled;
      } catch (eX) {
        res.thrown = String(eX);
      }
      R.layerControl[tries[ti]] = res;
    }
    try {
      app.project.expressionEngine = "extendscript";
      lp.expression = "parent";
      R.layerControl.legacyParent = { value: lp.value, error: lp.expressionError };
      app.project.expressionEngine = "javascript-1.0";
    } catch (eL) {
      R.layerControl.legacyThrown = String(eL);
    }
    try {
      lp.expression = "";
    } catch (eE) {}
    save();

    // 2. Edit > Duplicate with the four selected.
    A.openInViewer();
    var n0 = A.numLayers;
    selectOnly(A, [T, G, C, C1]);
    app.executeCommand(cmd("Duplicate", 2080));
    R.duplicate = { added: A.numLayers - n0, layers: [] };
    for (var di = 1; di <= A.numLayers; di++) R.duplicate.layers.push(describe(A, A.layer(di)));
    // Expression of the copied C1 (which parent does it see?).
    for (var dj = 1; dj <= A.numLayers; dj++) {
      var dl = A.layer(dj);
      if (dl.name !== "Line Cursor 1" || dl === C1) continue;
      try {
        R.duplicate.c1ExprValue = tr(dl).property("ADBE Position").value;
      } catch (eV) {}
    }
    save();

    // 3. Copy the originals, paste into comp B.
    selectOnly(A, [T, G, C, C1]);
    A.openInViewer();
    app.executeCommand(cmd("Copy", 19));
    B.openInViewer();
    var b0 = B.numLayers;
    app.executeCommand(cmd("Paste", 20));
    R.paste = { added: B.numLayers - b0, layers: [] };
    for (var pi = 1; pi <= B.numLayers; pi++) R.paste.layers.push(describe(B, B.layer(pi)));
    save();

    // 4. Assigning layer.parent: does the child jump (its values change)?
    A.openInViewer();
    var P = A.layers.addNull();
    P.name = "Parent probe";
    tr(P).property("ADBE Position").setValue([500, 300]);
    tr(P).property("ADBE Rotate Z").setValue(30);
    var Q = A.layers.addNull();
    Q.name = "Child probe";
    tr(Q).property("ADBE Position").setValue([10, 20]);
    Q.parent = P;
    R.parentAssign = { afterAssign: tr(Q).property("ADBE Position").value, rotation: tr(Q).property("ADBE Rotate Z").value };
    Q.parent = null;
    R.parentAssign.afterUnassign = tr(Q).property("ADBE Position").value;
    Q.parent = P;
    P.remove();
    R.parentAssign.afterParentRemoved = { position: tr(Q).property("ADBE Position").value, rotation: tr(Q).property("ADBE Rotate Z").value, parent: Q.parent ? Q.parent.name : null };
    save();

    // 5. Per-character fill colours.
    var M = A.layers.addText("Small BIG small");
    var mst = M.property("ADBE Text Properties").property("ADBE Text Document");
    var md = mst.value;
    md.applyFill = true;
    md.fillColor = [1, 1, 1];
    mst.setValue(md);
    md = mst.value;
    if (typeof md.characterRange === "function") {
      md.characterRange(6, 9).fillColor = [1, 0, 0];
      mst.setValue(md);
      md = mst.value;
      var cols = [];
      for (var k = 0; k < md.text.length; k++) {
        var cr = md.characterRange(k, k + 1);
        var cc = {};
        try {
          cc.fill = cr.fillColor;
        } catch (eF) {
          cc.fillThrown = String(eF);
        }
        try {
          cc.applyFill = cr.applyFill;
        } catch (eA) {
          cc.applyFillThrown = String(eA);
        }
        cols.push(cc);
      }
      R.colors = { perChar: cols, docFill: md.fillColor };
      try {
        R.colors.mixedRange = md.characterRange(4, 8).fillColor;
      } catch (eM) {
        R.colors.mixedRangeThrown = String(eM);
      }
    } else R.colors = "no characterRange";
  } catch (err) {
    R.error = String(err) + " line " + err.line;
  }
  try {
    app.endSuppressDialogs(false);
  } catch (e2) {}
  R.done = true;
  save();
})();
