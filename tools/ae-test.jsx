// LazyTyper inside After Effects: builds rigs from %TEMP%\LazyTyper\ae-test\fixture.json
// (written by tools/ae-test.mjs) and checks them against the Node engine's keystroke frames.
// Runs one expression engine (fixture.engine) in the open project, which
// tools/ae/fresh-project.jsx made new in a separate run. Writes results-<engine>.json.
(function () {
  var dir = Folder.temp.fsName + "/LazyTyper/ae-test";
  var R = { checks: [], version: app.version };

  function readText(path) {
    var f = new File(path);
    f.encoding = "UTF-8";
    f.open("r");
    var s = f.read();
    f.close();
    return s;
  }
  function save() {
    var f = new File(dir + "/results-" + fx.engine + ".json");
    f.encoding = "UTF-8";
    f.open("w");
    f.write(LT.stringify(R));
    f.close();
  }
  function check(name, ok, detail) {
    R.checks.push({ name: name, ok: !!ok, detail: ok ? "" : String(detail === undefined ? "" : detail) });
  }

  var fx = eval("(" + readText(dir + "/fixture.json") + ")");
  $.evalFile(new File(fx.root + "/host/host.jsx"));
  var args = fx.args;
  var FD = 1 / 30;

  function call(name, extra) {
    var a = {};
    for (var k in args) if (args.hasOwnProperty(k)) a[k] = args[k];
    for (var e in extra) if (extra.hasOwnProperty(e)) a[e] = extra[e];
    return eval("(" + LT_call(name, LT.stringify(a)) + ")");
  }

  function select(comp, layer) {
    for (var i = 1; i <= comp.numLayers; i++) comp.layer(i).selected = false;
    layer.selected = true;
  }

  function makeText(comp, c) {
    var l = c.box ? comp.layers.addBoxText(c.box, c.text) : comp.layers.addText(c.text);
    var st = LT.sourceText(l);
    var d = st.value;
    d.fontSize = 64;
    if (c.font) d.font = c.font;
    d.applyFill = true;
    d.fillColor = [1, 1, 1];
    d.justification = c.just === "center" ? ParagraphJustification.CENTER_JUSTIFY :
      (c.just === "right" ? ParagraphJustification.RIGHT_JUSTIFY : ParagraphJustification.LEFT_JUSTIFY);
    st.setValue(d);
    l.name = c.id;
    l.property("ADBE Transform Group").property("ADBE Position").setValue(c.box ? [960, 540] : [200, 300]);
    return l;
  }

  function exprErrors(layer) {
    var errs = [];
    function walk(group) {
      for (var i = 1; i <= group.numProperties; i++) {
        var p = group.property(i);
        if (p.propertyType === PropertyType.PROPERTY) {
          if (p.canSetExpression && p.expression !== "") {
            try {
              p.valueAtTime(1, false);
            } catch (e) {}
            if (p.expressionError) errs.push(p.name + ": " + p.expressionError);
          }
        } else walk(p);
      }
    }
    walk(layer);
    return errs;
  }

  function runEngine(engine) {
    app.project.expressionEngine = engine;
    var tag = "[" + engine + "] ";
    var comp = app.project.items.addComp("LazyTyper test", 1920, 1080, 1, 12, 30);
    comp.openInViewer();

    for (var ci = 0; ci < fx.cases.length; ci++) {
      var c = fx.cases[ci];
      var name = tag + c.id;
      var layer = makeText(comp, c);
      select(comp, layer);
      comp.time = 0;
      var res = call("createRig", { type: c.type, cursor: true });
      check(name + ": create", res.ok && res.made && res.made.length === 1, res.msg || LT.stringify(res));
      if (!res.ok) {
        save();
        continue;
      }
      check(name + ": no expression problems", !res.problems.length, res.problems.join(" | "));
      layer = comp.layer(c.id);
      var cs = LT.control(layer, "Characters Shown");

      // Typing frames match the Node engine.
      var t0 = $.hiresTimer;
      var bad = [];
      var prev = 0;
      for (var e = 0; e < c.expected.length && bad.length < 5; e++) {
        var f = c.expected[e][0];
        var k = c.expected[e][1];
        var got = Math.round(cs.valueAtTime(f * FD, false));
        if (got !== k) bad.push("frame " + f + ": " + got + " not " + k);
        if (f > 0) {
          var before = Math.round(cs.valueAtTime((f - 1) * FD, false));
          if (before !== prev) bad.push("frame " + (f - 1) + ": " + before + " not " + prev);
        }
        prev = k;
      }
      var ms = ($.hiresTimer - t0) / 1000;
      check(name + ": typing matches the Node engine", !bad.length, bad.join("; "));
      t0 = $.hiresTimer;
      cs.valueAtTime(9.9, false);
      R[c.id + "-" + engine + "-ms-at-10s"] = ($.hiresTimer - t0) / 1000;

      // Stable: the opacity range starts at the first untyped character (line breaks have no index).
      if (c.type === "stable") {
        var sel = layer.property("ADBE Text Properties").property("ADBE Text Animators").property("LazyTyper")
          .property("ADBE Text Selectors").property(1).property("ADBE Text Index Start");
        var badSel = [];
        for (var se = 0; se < c.expected.length; se += 3) {
          var kk = c.expected[se][1];
          var unitsBefore = 0;
          for (var bi = 0; bi < kk; bi++) if (c.text.charAt(bi) !== "\r" && !LT.joinsPrevious(c.text, bi)) unitsBefore++;
          var sv = Math.round(sel.valueAtTime(c.expected[se][0] * FD, false));
          if (sv !== unitsBefore) badSel.push(kk + "->" + sv);
        }
        check(name + ": typing range counts units, skips line breaks", !badSel.length, badSel.join(", "));
      }

      // Dynamic: the text layer shows exactly the typed characters.
      if (c.type === "dynamic") {
        var mid = c.expected[Math.floor(c.expected.length / 2)];
        var shown = String(LT.sourceText(layer).valueAtTime(mid[0] * FD, false).text);
        check(name + ": source text shows the typed part", shown === c.text.substr(0, mid[1]), "\"" + shown + "\"");
        check(name + ": guide layer exists", !!LT.findGuide(layer));
      }

      // Cursor: no expression errors; moves right while a line types; sits after the last glyph.
      var cur = LT.findCursor(layer);
      check(name + ": cursor exists", !!cur);
      if (cur) {
        var errs = exprErrors(cur);
        check(name + ": cursor expressions run", !errs.length, errs.join(" | "));
        var pos = cur.property("ADBE Transform Group").property("ADBE Position");
        var xs = [];
        var ys = [];
        for (var q = 1; q < Math.min(8, c.expected.length); q++) {
          var p = pos.valueAtTime(c.expected[q][0] * FD, false);
          xs.push(Math.round(p[0]));
          ys.push(Math.round(p[1]));
        }
        var grows = true;
        // Joined letters: the cursor may hold still while a vowel sign or virama joins the letter.
        for (var x = 1; x < xs.length; x++) if ((c.joined ? xs[x] < xs[x - 1] : xs[x] <= xs[x - 1]) && ys[x] === ys[x - 1]) grows = false;
        check(name + ": cursor moves right as it types", grows, xs.join(","));
        // Joined letters: after every keystroke the cursor sits after what shows, measured on a
        // scratch layer holding that text (Dynamic: the typed characters; Stable: whole units).
        if (c.joined) {
          var scratch = layer.duplicate();
          var sfx = scratch.property("ADBE Effect Parade");
          while (sfx.numProperties) sfx.property(1).remove();
          var sst = LT.sourceText(scratch);
          sst.expression = "";
          var san = scratch.property("ADBE Text Properties").property("ADBE Text Animators");
          while (san.numProperties) san.property(1).remove();
          var badX = [];
          for (var jx = 0; jx < c.expected.length; jx++) {
            var kx = c.expected[jx][1];
            if (kx < 1 || c.text.charAt(kx - 1) === " ") continue;
            var upto = kx;
            if (c.type === "stable") while (upto < c.text.length && LT.joinsPrevious(c.text, upto)) upto++;
            var sd = sst.value;
            sd.text = c.text.substr(0, upto);
            sst.setValue(sd);
            var sr = scratch.sourceRectAtTime(0, false);
            var px = pos.valueAtTime(c.expected[jx][0] * FD, false)[0];
            if (Math.abs(px - (sr.left + sr.width)) > 8) badX.push(kx + ": " + Math.round(px) + " vs " + Math.round(sr.left + sr.width));
          }
          scratch.remove();
          check(name + ": cursor after every keystroke", !badX.length, badX.slice(0, 6).join("; "));
        }
        // After the whole text: compare with a scratch layer holding the text up to its last glyph.
        var endF = c.expected[c.expected.length - 1][0] + 2;
        var pe = pos.valueAtTime(endF * FD, false);
        var probe = layer.duplicate();
        var pfx = probe.property("ADBE Effect Parade");
        while (pfx.numProperties) pfx.property(1).remove();
        var pst = LT.sourceText(probe);
        pst.expression = "";
        var an = probe.property("ADBE Text Properties").property("ADBE Text Animators");
        while (an.numProperties) an.property(1).remove();
        var r = probe.sourceRectAtTime(endF * FD, false);
        probe.remove();
        // Right-aligned and centred lines: the last line ends at the rect's right only for left text,
        // so compare x for the first case styles and y (last baseline) for all.
        if (c.just === "left" && c.text.indexOf("\r") < 0) {
          var right = r.left + r.width;
          check(name + ": cursor after the last letter", Math.abs(pe[0] - right) < 12, Math.round(pe[0]) + " vs " + Math.round(right));
        }
        var bottom = r.top + r.height;
        check(name + ": cursor on the last line", pe[1] <= bottom + 4 && pe[1] >= bottom - 64 * 0.6, Math.round(pe[1]) + " vs text bottom " + Math.round(bottom));
      }

      // Bake to keyframes and back.
      select(comp, layer);
      var b = call("bake", {});
      check(name + ": bake", b.ok && b.done && b.done.length === 1, b.msg || LT.stringify(b));
      cs = LT.control(layer, "Characters Shown");
      check(name + ": baked keyframes = keystrokes", cs.numKeys === c.expected.length, cs.numKeys + " vs " + c.expected.length);
      var badBake = [];
      for (var bk = 0; bk < c.expected.length && badBake.length < 3; bk++) {
        var bv = Math.round(cs.valueAtTime(c.expected[bk][0] * FD, false));
        if (bv !== c.expected[bk][1]) badBake.push(c.expected[bk][0] + ":" + bv);
      }
      check(name + ": baked values", !badBake.length, badBake.join(", "));
      if (typeof cs.keyLabel === "function" && cs.numKeys > 1) {
        check(name + ": baked keys have labels", cs.keyLabel(2) > 0, cs.keyLabel(2));
      }
      if (c.type === "dynamic") {
        var mid2 = c.expected[Math.floor(c.expected.length / 2)];
        var shown2 = String(LT.sourceText(layer).valueAtTime(mid2[0] * FD, false).text);
        check(name + ": baked text still types", shown2 === c.text.substr(0, mid2[1]), "\"" + shown2 + "\"");
        var bi2 = call("selectionInfo", { detail: true }).layers[0];
        check(name + ": baked, the panel reads the full text", bi2.text === c.text && bi2.length === c.text.length,
          bi2.length + " \"" + bi2.text + "\"");
      }
      var u = call("unbake", {});
      cs = LT.control(layer, "Characters Shown");
      check(name + ": unbake", u.ok && cs.numKeys === 0 && cs.expression !== "", u.msg || "keys " + cs.numKeys);
      var mid3 = c.expected[Math.floor(c.expected.length / 2)];
      check(name + ": unbaked typing", Math.round(cs.valueAtTime(mid3[0] * FD, false)) === mid3[1]);

      // A Stable rig from 1.1.1 or earlier on joined letters (a typing range counting characters)
      // asks for a Refresh; the Refresh below must clear that.
      if (c.joined && c.type === "stable") {
        select(comp, layer);
        var fresh = call("selectionInfo", { detail: true }).layers[0];
        check(name + ": a new rig needs no refresh", !fresh.needsRefresh && !fresh.olderRig, LT.stringify(fresh));
        var oldSel = layer.property("ADBE Text Properties").property("ADBE Text Animators").property("LazyTyper")
          .property("ADBE Text Selectors").property(1).property("ADBE Text Index Start");
        oldSel.expression = "Math.round(effect(\"Characters Shown\")(1).value)";
        var older = call("selectionInfo", { detail: true }).layers[0];
        check(name + ": an older rig asks for a refresh", older.needsRefresh === true && older.olderRig === true, LT.stringify(older));
      }

      // Refresh keeps it working.
      var rf = call("refreshRig", {});
      check(name + ": refresh", rf.ok && !rf.problems.length, rf.msg || rf.problems.join(" | "));
      cs = LT.control(layer, "Characters Shown");
      check(name + ": typing after refresh", Math.round(cs.valueAtTime(mid3[0] * FD, false)) === mid3[1]);
      if (c.joined) {
        select(comp, layer);
        var after = call("selectionInfo", { detail: true }).layers[0];
        check(name + ": no refresh needed after a refresh", !after.needsRefresh && !after.olderRig, LT.stringify(after));
      }
      save();
    }

    // Timeline helpers on the first rig.
    var first = comp.layer(fx.cases[0].id);
    select(comp, first);
    comp.time = 1;
    var csF = LT.control(first, "Characters Shown");
    var atStop = Math.round(csF.valueAtTime(1, false));
    var st = call("stopHere", {});
    check(tag + "stop typing here", st.ok && Math.round(csF.valueAtTime(3, false)) <= atStop + 1,
      st.msg || (atStop + " then " + Math.round(csF.valueAtTime(3, false))));
    comp.time = 4;
    var er = call("eraseHere", { all: true, frames: 10 });
    check(tag + "erase here", er.ok && Math.round(csF.valueAtTime(4 + 11 * FD, false)) === 0,
      er.msg || Math.round(csF.valueAtTime(4 + 11 * FD, false)));
    comp.time = 5;
    var ps = call("pauseHere", { frames: 15 });
    check(tag + "add pause", ps.ok && first.property("ADBE Marker").numKeys === 1, ps.msg);
    var cv = call("readValues", { kind: "cursor", keys: ["Width", "Top"] });
    check(tag + "read cursor values", cv.ok && cv.values.Width === args.cursorValues.Width, LT.stringify(cv));
    var ap = call("applyValues", { kind: "typing", values: { "Frames Per Character": 4 } });
    check(tag + "apply typing values", ap.ok && LT.control(first, "Frames Per Character").value === 4, ap.msg);
    var info = call("selectionInfo", {});
    check(tag + "selection info", info.ok && info.layers.length === 1 && info.layers[0].rig === "stable", LT.stringify(info));
    var rm = call("removeRig", {});
    check(tag + "remove rig", rm.ok && !LT.control(first, "Typing") && !LT.findCursor(first), rm.msg);

    // Dynamic rig erased with nothing typed after: the panel still reads the full text.
    var dc = fx.cases[1];
    var dyn = comp.layer(dc.id);
    select(comp, dyn);
    comp.time = 1;
    var dShown = Math.round(LT.control(dyn, "Characters Shown").valueAtTime(1, false));
    var der = call("eraseHere", { all: true, frames: 10 });
    var dEnd = Math.round(LT.control(dyn, "Characters Shown").valueAtTime(dyn.outPoint - FD, false));
    check(tag + "dynamic erase leaves nothing at the end", der.ok && dShown > 0 && dEnd === 0, der.msg || dShown + " then " + dEnd);
    var dexpr = LT.sourceText(dyn).expression;
    var di = call("selectionInfo", { detail: true }).layers[0];
    check(tag + "dynamic erased: panel reads the full text", di.text === dc.text && di.length === dc.text.length && di.shown === dShown,
      di.shown + " / " + di.length + " \"" + di.text + "\"");
    check(tag + "dynamic erased: cursor needs no refresh", di.needsRefresh === false, di.needsRefresh);
    check(tag + "selection info leaves the expression alone",
      LT.sourceText(dyn).expressionEnabled && LT.sourceText(dyn).expression === dexpr && dexpr.indexOf("LT_PEEK") > 0, "");
    save();
  }

  try {
    app.beginSuppressDialogs();
    runEngine(fx.engine);
  } catch (err) {
    R.error = String(err) + " line " + err.line;
  }
  try {
    app.endSuppressDialogs(false);
  } catch (e2) {}
  R.done = true;
  save();
})();
