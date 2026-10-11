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

    // Mixed sizes in a Stable rig: the cursor takes the size of the last character typed, and
    // the panel asks for a Refresh when part of the text changes size, not when it only
    // changes colour.
    (function () {
      var name = tag + "mixed sizes";
      var ml = makeText(comp, { id: "mixed", text: "Small BIG small", box: null, just: "left" });
      var mst = LT.sourceText(ml);
      var md = mst.value;
      if (typeof md.characterRange !== "function") {
        check(name + ": characterRange available", false, "missing");
        return;
      }
      md.characterRange(6, 9).fontSize = 128;
      mst.setValue(md);
      select(comp, ml);
      var mres = call("createRig", { type: "stable", cursor: true });
      check(name + ": create", mres.ok && !mres.problems.length, mres.msg || mres.problems);
      ml = comp.layer("mixed");
      mst = LT.sourceText(ml);
      var mcs = LT.control(ml, "Characters Shown");
      var mcur = LT.findCursor(ml);
      var mpath = mcur.property("ADBE Root Vectors Group").property("Cursor").property("ADBE Vectors Group")
        .property("ADBE Vector Shape - Group").property("ADBE Vector Shape");
      var mfill = mcur.property("ADBE Root Vectors Group").property("Cursor").property("ADBE Vectors Group")
        .property("ADBE Vector Graphic - Fill").property("ADBE Vector Fill Color");
      /* The first frame k characters show. */
      function frameWhen(k) {
        for (var f = 0; f < 360; f++) if (Math.round(mcs.valueAtTime(f * FD, false)) === k) return f;
        return -1;
      }
      /* The cursor shape's box when k characters show: [left, top, width, height]. */
      function boxWhen(k) {
        var f = frameWhen(k);
        if (f < 0) return [-1, -1, -1, -1];
        var v = mpath.valueAtTime(f * FD, false).vertices;
        var x0 = 1e9, x1 = -1e9, y0 = 1e9, y1 = -1e9;
        for (var q = 0; q < v.length; q++) {
          x0 = Math.min(x0, v[q][0]);
          x1 = Math.max(x1, v[q][0]);
          y0 = Math.min(y0, v[q][1]);
          y1 = Math.max(y1, v[q][1]);
        }
        return [x0, y0, x1 - x0, y1 - y0];
      }
      function heightWhen(k) {
        return boxWhen(k)[3];
      }
      function colorWhen(k) {
        var c = mfill.valueAtTime(frameWhen(k) * FD, false);
        return Math.round(c[0] * 100) / 100 + "," + Math.round(c[1] * 100) / 100 + "," + Math.round(c[2] * 100) / 100;
      }
      function setCursor(n, v) {
        LT.control(LT.findCursor(comp.layer("mixed")), n).setValue(v);
      }
      var hSmall = heightWhen(5);
      var hBig = heightWhen(9);
      var hBack = heightWhen(15);
      check(name + ": cursor grows beside the big word", hSmall > 0 && hBig > hSmall * 1.8 && Math.abs(hBack - hSmall) < 1,
        hSmall + " -> " + hBig + " -> " + hBack);
      // The Vertical preset keeps its width beside the big word; Underscore grows.
      check(name + ": a vertical bar keeps its width", Math.abs(boxWhen(9)[2] - boxWhen(5)[2]) < 0.01, boxWhen(5)[2] + " " + boxWhen(9)[2]);
      call("applyValues", { kind: "cursor", values: fx.presets.underscore });
      check(name + ": an underscore grows wider", boxWhen(9)[2] > boxWhen(5)[2] * 1.8, boxWhen(5)[2] + " " + boxWhen(9)[2]);
      call("applyValues", { kind: "cursor", values: args.cursorValues });
      // Size From: after "Small " (6 characters) the next character is the big B.
      // After "Small BI" the G comes next (big); after "Small BIG" the space (small).
      setCursor("Size From", 2);
      check(name + ": size from the character after", heightWhen(6) > hSmall * 1.8 && Math.abs(heightWhen(8) - hBig) < 1 &&
        Math.abs(heightWhen(9) - hSmall) < 1, heightWhen(6) + " " + heightWhen(8) + " " + heightWhen(9));
      setCursor("Size From", 1);
      check(name + ": size from the character before", Math.abs(heightWhen(6) - hSmall) < 1, heightWhen(6));
      // Offsets in % of the font size grow beside the big word; in pixels they do not.
      setCursor("Offset Unit", 2);
      setCursor("Y Offset", 10);
      var pctSmall = boxWhen(5)[1], pctBig = boxWhen(9)[1];
      setCursor("Offset Unit", 1);
      var pxSmall = boxWhen(5)[1], pxBig = boxWhen(9)[1];
      setCursor("Y Offset", 0);
      var nSmall = boxWhen(5)[1], nBig = boxWhen(9)[1];
      check(name + ": Y Offset in % of the font size", Math.abs(pctSmall - nSmall - 6.4) < 0.05 && Math.abs(pctBig - nBig - 12.8) < 0.05,
        (pctSmall - nSmall) + " " + (pctBig - nBig));
      check(name + ": Y Offset in pixels", Math.abs(pxSmall - nSmall - 10) < 0.05 && Math.abs(pxBig - nBig - 10) < 0.05, (pxSmall - nSmall) + " " + (pxBig - nBig));
      // Show Cursor.
      var mop = mcur.property("ADBE Transform Group").property("ADBE Opacity");
      setCursor("Show Cursor", 0);
      var hiddenOp = mop.valueAtTime(4, false);
      setCursor("Show Cursor", 1);
      check(name + ": Show Cursor off hides it", hiddenOp === 0 && mop.valueAtTime(0.2, false) === 100, hiddenOp);
      function asks() {
        select(comp, comp.layer("mixed"));
        var inf = call("selectionInfo", { detail: true });
        return inf.layers && inf.layers[0] ? inf.layers[0].needsRefresh : "no layer";
      }
      check(name + ": no Refresh asked after create", asks() === false, asks());
      // The cursor takes the text's colour (white); a colour change asks for a Refresh while it does.
      check(name + ": cursor in the text's colour", colorWhen(3) === "1,1,1", colorWhen(3));
      md = mst.value;
      md.characterRange(0, 5).fillColor = [1, 0.5, 0];
      mst.setValue(md);
      check(name + ": a colour change asks for a Refresh (Use Text Color)", asks() === true, asks());
      setCursor("Use Text Color", 0);
      check(name + ": not with Use Text Color off", asks() === false, asks());
      setCursor("Use Text Color", 1);
      select(comp, comp.layer("mixed"));
      call("refreshRig", {});
      mcs = LT.control(comp.layer("mixed"), "Characters Shown");
      check(name + ": after Refresh the cursor takes the new colour", colorWhen(3) === "1,0.5,0" && colorWhen(9) === "1,1,1",
        colorWhen(3) + " / " + colorWhen(9));
      check(name + ": colour changes then ask nothing", asks() === false, asks());
      md = mst.value;
      md.characterRange(10, 15).fontSize = 90;
      mst.setValue(md);
      check(name + ": a size change on the last word asks for Refresh", asks() === true, asks());
      select(comp, comp.layer("mixed"));
      call("refreshRig", {});
      check(name + ": Refresh clears it", asks() === false, asks());
      // Keyframed text: the fingerprint must not depend on where the playhead is.
      mst = LT.sourceText(comp.layer("mixed"));
      var k0 = mst.value;
      mst.setValueAtTime(0, k0);
      var k1 = mst.value;
      k1.text = "Then something else";
      mst.setValueAtTime(2, k1);
      select(comp, comp.layer("mixed"));
      call("refreshRig", {});
      comp.time = 0;
      var a0 = asks();
      comp.time = 3;
      var a3 = asks();
      check(name + ": keyframed text, same answer at any time", a0 === false && a3 === false, a0 + " " + a3);
      comp.time = 0;
    })();
    save();

    /* Keystroke frames that differ from the expected ones (at most five), at fd seconds a frame. */
    function mismatches(prop, expected, fd) {
      var out = [];
      var prev = 0;
      for (var e = 0; e < expected.length && out.length < 5; e++) {
        var f = expected[e][0];
        var got = Math.round(prop.valueAtTime(f * fd, false));
        if (got !== expected[e][1]) out.push("frame " + f + ": " + got + " not " + expected[e][1]);
        if (f > 0) {
          var before = Math.round(prop.valueAtTime((f - 1) * fd, false));
          if (before !== prev) out.push("frame " + (f - 1) + ": " + before + " not " + prev);
        }
        prev = expected[e][1];
      }
      return out;
    }

    /* The rig's controls that LazyTyper knows, in Effect Controls order. */
    function controlOrder(layer) {
      var known = {};
      var want = [];
      for (var d = 0; d < args.textControls.length; d++) {
        known[args.textControls[d].name] = true;
        want.push(args.textControls[d].name);
      }
      var got = [];
      var fxs = layer.property("ADBE Effect Parade");
      for (var i = 1; i <= fxs.numProperties; i++) if (known[fxs.property(i).name]) got.push(fxs.property(i).name);
      return { ok: got.join("|") === want.join("|"), got: got.join(", ") };
    }

    // A rig made with 1.2.0 (its engine, none of the newer controls, a negative Fast: Repeated
    // Letters that 1.2.0 ignored) types as it did, and still does after Refresh (Stable) or Bake
    // and Unbake (Dynamic), which bring its controls up to date.
    (function () {
      var U = fx.upgrade;
      function oldRig(id, type) {
        var l = makeText(comp, { id: id, text: U.text, box: null, just: "left" });
        select(comp, l);
        comp.time = 0;
        var r = call("createRig", { type: type, cursor: false, typing: U.values });
        l = comp.layer(id);
        for (var i = 0; i < U.since.length; i++) l.property("ADBE Effect Parade").property(U.since[i]).remove();
        if (type === "stable") LT.control(l, "Characters Shown").expression = U.stableCount;
        else LT.sourceText(l).expression = U.dynamicText;
        check(tag + id + ": made", r.ok && LT.control(l, "Fast: Repeated Letters").value === -40 && !LT.control(l, U.since[0]),
          r.msg || LT.stringify(r));
        return l;
      }
      var name = tag + "1.2.0 rig";
      var sl = oldRig("old-stable", "stable");
      var bad = mismatches(LT.control(sl, "Characters Shown"), U.expected, FD);
      check(name + ": types with its own engine", !bad.length, bad.join("; "));
      select(comp, sl);
      var rf = call("refreshRig", {});
      sl = comp.layer("old-stable");
      check(name + ": refresh", rf.ok && !rf.problems.length, rf.msg || rf.problems.join(" | "));
      var order = controlOrder(sl);
      check(name + ": Refresh adds the newer controls in their places", order.ok, order.got);
      var zero = true;
      for (var i = 0; i < U.since.length; i++) if (LT.control(sl, U.since[i]).value !== 0) zero = false;
      check(name + ": the newer controls change nothing", zero);
      check(name + ": the ignored negative Repeated Letters becomes 0", LT.control(sl, "Fast: Repeated Letters").value === 0,
        LT.control(sl, "Fast: Repeated Letters").value);
      bad = mismatches(LT.control(sl, "Characters Shown"), U.expected, FD);
      check(name + ": after Refresh, the same keystrokes", !bad.length, bad.join("; "));

      var dl = oldRig("old-dynamic", "dynamic");
      bad = mismatches(LT.control(dl, "Characters Shown"), U.expected, FD);
      check(name + " (Dynamic): types with its own engine", !bad.length, bad.join("; "));
      select(comp, dl);
      var b = call("bake", {});
      dl = comp.layer("old-dynamic");
      var cs = LT.control(dl, "Characters Shown");
      bad = mismatches(cs, U.expected, FD);
      check(name + " (Dynamic): Bake records the same keystrokes", b.ok && cs.numKeys === U.expected.length && !bad.length,
        b.msg || (cs.numKeys + " keys; " + bad.join("; ")));
      var u = call("unbake", {});
      dl = comp.layer("old-dynamic");
      bad = mismatches(LT.control(dl, "Characters Shown"), U.expected, FD);
      check(name + " (Dynamic): after Unbake, the same keystrokes", u.ok && !bad.length, u.msg || bad.join("; "));
      order = controlOrder(dl);
      check(name + " (Dynamic): Bake added the newer controls in their places", order.ok, order.got);
    })();
    save();

    /* Calls another host (its LT object: a 1.2.0 host) with its own rig arguments. */
    function callWith(host, base, name, extra) {
      var a = {};
      for (var k in base) if (base.hasOwnProperty(k)) a[k] = base[k];
      for (var e in extra) if (extra.hasOwnProperty(e)) a[e] = extra[e];
      return eval("(" + host.call(name, host.stringify(a)) + ")");
    }

    /*
     * Loads a host file and returns its LT without disturbing this one. $.evalFile runs a file in
     * the scope of the function that calls it (like eval), so the inner function gets its own LT; and
     * in case it lands in the global scope, the current LT and LT_call are put back there.
     */
    function loadHost(path) {
      var keepLT = LT;
      var keepCall = LT_call;
      var other = (function () {
        $.evalFile(new File(path));
        return LT;
      })();
      try {
        if ($.global.LT === other) {
          $.global.LT = keepLT;
          $.global.LT_call = keepCall;
        }
      } catch (eG) {}
      return other;
    }

    function cursorParts(cur) {
      var grp = cur.property("ADBE Root Vectors Group").property("Cursor").property("ADBE Vectors Group");
      return {
        pos: cur.property("ADBE Transform Group").property("ADBE Position"),
        op: cur.property("ADBE Transform Group").property("ADBE Opacity"),
        path: grp.property("ADBE Vector Shape - Group").property("ADBE Vector Shape"),
        fill: grp.property("ADBE Vector Graphic - Fill").property("ADBE Vector Fill Color")
      };
    }

    /*
     * What a rig shows over its first 4 s, frame by frame: characters shown, and its cursor's box in
     * the text layer's space (position + the shape's bounds; a Dynamic cursor's parent, the guide,
     * shares that space), colour and opacity, rounded.
     */
    function snapshot(layer) {
      var cs = LT.control(layer, "Characters Shown");
      var cur = LT.findCursor(layer);
      var P = cur ? cursorParts(cur) : null;
      var out = [];
      for (var f = 0; f <= 120; f += 2) {
        var t = f * FD;
        var row = [Math.round(cs.valueAtTime(t, false))];
        if (P) {
          var p = P.pos.valueAtTime(t, false);
          var v = P.path.valueAtTime(t, false).vertices;
          var x0 = 1e9, x1 = -1e9, y0 = 1e9, y1 = -1e9;
          for (var q = 0; q < v.length; q++) {
            x0 = Math.min(x0, v[q][0]);
            x1 = Math.max(x1, v[q][0]);
            y0 = Math.min(y0, v[q][1]);
            y1 = Math.max(y1, v[q][1]);
          }
          var c = P.fill.valueAtTime(t, false);
          row.push(Math.round((p[0] + x0) * 10) / 10, Math.round((p[1] + y0) * 10) / 10, Math.round((x1 - x0) * 10) / 10,
            Math.round((y1 - y0) * 10) / 10, Math.round(c[0] * 100), Math.round(c[1] * 100), Math.round(c[2] * 100),
            Math.round(P.op.valueAtTime(t, false)));
        }
        out.push(row.join(","));
      }
      return out;
    }

    function firstDiff(a, b) {
      for (var i = 0; i < Math.max(a.length, b.length); i++) if (a[i] !== b[i]) return "frame " + i * 2 + ": " + a[i] + " | " + b[i];
      return "";
    }

    function hasEffect(layer, n) {
      return !!layer.property("ADBE Effect Parade").property(n);
    }

    // Real 1.2.0 rigs (made by 1.2.0's host with 1.2.0's controls and expressions) type, sit and look
    // exactly as before after this version's Refresh; a baked one is baked again to the same keys.
    (function () {
      var V = fx.v12;
      var name = tag + "real 1.2.0 rig";
      var made = [];
      var OLD = loadHost(V.host);
      check(name + ": 1.2.0 host loaded", OLD && OLD.version === "1.2.0" && OLD !== LT, OLD ? OLD.version : "none");
      (function () {
        var specs = [
          { id: "v12-dynamic", type: "dynamic", text: "Made with 1.2.0, typing on." },
          { id: "v12-stable", type: "stable", text: "Small BIG small", big: true },
          { id: "v12-baked", type: "dynamic", text: "Baked in 1.2.0.", bake: true }
        ];
        for (var s = 0; s < specs.length; s++) {
          var sp = specs[s];
          var l = makeText(comp, { id: sp.id, text: sp.text, box: null, just: "left" });
          l.property("ADBE Transform Group").property("ADBE Position").setValue([200, 300 + 120 * s]);
          if (sp.big) {
            var st = LT.sourceText(l);
            var d = st.value;
            d.characterRange(6, 9).fontSize = 128;
            st.setValue(d);
          }
          select(comp, l);
          comp.time = 0;
          var r = callWith(OLD, V.args, "createRig", { type: sp.type, cursor: true });
          l = comp.layer(sp.id);
          var cur = OLD.findCursor(l);
          check(name + " " + sp.id + ": made by 1.2.0", r.ok && r.made.length === 1 && cur && OLD.control(cur, "Text Layer"),
            r.msg || LT.stringify(r));
          if (!cur) continue;
          OLD.control(cur, "X Offset").setValue(6);
          OLD.control(cur, "Y Offset").setValue(-4);
          if (s === 0) OLD.control(cur, "Cursor Color").setValue([1, 0.5, 0.2, 1]);
          if (sp.bake) {
            select(comp, l);
            callWith(OLD, V.args, "bake", {});
          }
          made.push(sp);
        }
      })();
      for (var m = 0; m < made.length; m++) {
        var id = made[m].id;
        var layer = comp.layer(id);
        var before = snapshot(layer);
        var keysBefore = LT.control(layer, "Characters Shown").numKeys;
        select(comp, layer);
        var rf = call("refreshRig", { rebake: !!made[m].bake });
        layer = comp.layer(id);
        check(name + " " + id + ": refresh", rf.ok && rf.done.length === 1 && !rf.problems.length, rf.msg || LT.stringify(rf));
        var after = snapshot(layer);
        check(name + " " + id + ": types, sits and looks the same", !firstDiff(before, after), firstDiff(before, after));
        var cur2 = LT.findCursor(layer);
        check(name + " " + id + ": the link controls are gone", cur2 && !hasEffect(cur2, "Text Layer") && !hasEffect(cur2, "Guide Layer"), "");
        check(name + " " + id + ": newer cursor controls keep it as it was", cur2 && LT.control(cur2, "Use Text Color").value === 0 &&
          LT.control(cur2, "Offset Unit").value === 1 && LT.control(cur2, "Show Cursor").value === 1 && LT.control(cur2, "X Offset").value === 6,
          cur2 ? LT.control(cur2, "Use Text Color").value + " " + LT.control(cur2, "Offset Unit").value : "no cursor");
        if (made[m].type === "dynamic") {
          var g = LT.findGuide(layer);
          check(name + " " + id + ": the cursor sits under the guide", cur2 && g && cur2.parent && cur2.parent.index === g.index, "");
        }
        if (made[m].bake) {
          var cs = LT.control(layer, "Characters Shown");
          check(name + " " + id + ": baked again to the same keys", rf.rebaked.length === 1 && cs.numKeys === keysBefore && cs.expression === "",
            cs.numKeys + " vs " + keysBefore);
        }
        select(comp, layer);
        var inf = call("selectionInfo", { detail: true }).layers[0];
        check(name + " " + id + ": no Refresh asked after it", inf.cursor === true && inf.needsRefresh === false, LT.stringify(inf));
      }
    })();
    save();

    // Shift+click Refresh: Dynamic to Stable and back, every typing and cursor value kept; a baked rig
    // is refreshed only with rebake, and baked again from its controls.
    (function () {
      var name = tag + "switch type";
      var l = makeText(comp, { id: "switch", text: "Switch me, PLEASE. Now 2026!", box: null, just: "left" });
      l.property("ADBE Transform Group").property("ADBE Position").setValue([200, 760]);
      select(comp, l);
      comp.time = 0;
      call("createRig", { type: "dynamic", cursor: true });
      l = comp.layer("switch");
      LT.control(l, "Frames Per Character").setValue(2.5);
      LT.control(l, "Slow: Capitals").setValue(77);
      var cur = LT.findCursor(l);
      var cvals = { "Width": 30, "Blink": 0, "Size From": 2, "Offset Unit": 1, "X Offset": 5, "Roundness": 40 };
      for (var k in cvals) if (cvals.hasOwnProperty(k)) LT.control(cur, k).setValue(cvals[k]);
      function typed(layer) {
        var cs = LT.control(layer, "Characters Shown");
        var o = [];
        for (var f = 0; f <= 150; f++) o.push(Math.round(cs.valueAtTime(f * FD, false)));
        return o.join(",");
      }
      function kept(layer) {
        var c = LT.findCursor(layer);
        if (!c) return "no cursor";
        var bad = [];
        for (var n in cvals) if (cvals.hasOwnProperty(n) && LT.control(c, n).value !== cvals[n]) bad.push(n + " " + LT.control(c, n).value);
        if (LT.control(layer, "Frames Per Character").value !== 2.5) bad.push("Frames Per Character");
        if (LT.control(layer, "Slow: Capitals").value !== 77) bad.push("Slow: Capitals");
        return bad.join(", ");
      }
      /* The cursor's x after the whole text against the text's right edge (a probe without the rig). */
      function endGap(layer) {
        var c = LT.findCursor(layer);
        var x = c.property("ADBE Transform Group").property("ADBE Position").valueAtTime(9.5, false)[0];
        var probe = layer.duplicate();
        var pfx = probe.property("ADBE Effect Parade");
        while (pfx.numProperties) pfx.property(1).remove();
        LT.sourceText(probe).expression = "";
        var an = probe.property("ADBE Text Properties").property("ADBE Text Animators");
        while (an.numProperties) an.property(1).remove();
        var r = probe.sourceRectAtTime(9.5, false);
        probe.remove();
        return Math.round(x - (r.left + r.width));
      }
      var t0 = typed(l);
      select(comp, l);
      var r1 = call("refreshRig", { convert: true });
      l = comp.layer("switch");
      var c1 = LT.findCursor(l);
      check(name + ": Dynamic to Stable", r1.ok && r1.types[0] === "stable" && call("selectionInfo", {}).layers[0].rig === "stable" &&
        !LT.findGuide(l) && c1 && c1.parent.index === l.index, r1.msg || LT.stringify(r1));
      check(name + ": Stable keeps the typing", typed(l) === t0, "");
      check(name + ": Stable keeps every value", kept(l) === "", kept(l));
      check(name + ": Stable cursor after the text", Math.abs(endGap(l)) < 14, endGap(l));
      check(name + ": Stable has no expression problems", !r1.problems.length, r1.problems.join(" | "));
      select(comp, l);
      var r2 = call("refreshRig", { convert: true });
      l = comp.layer("switch");
      var c2 = LT.findCursor(l);
      var g2 = LT.findGuide(l);
      check(name + ": Stable to Dynamic", r2.ok && r2.types[0] === "dynamic" && g2 && c2 && c2.parent.index === g2.index &&
        !l.property("ADBE Text Properties").property("ADBE Text Animators").property("LazyTyper"), r2.msg || LT.stringify(r2));
      check(name + ": Dynamic again keeps the typing and values", typed(l) === t0 && kept(l) === "", kept(l));
      check(name + ": Dynamic cursor after the text", Math.abs(endGap(l)) < 14, endGap(l));
      // Baked: Refresh without rebake leaves it alone; with it, keystrokes moved by hand go back.
      select(comp, l);
      call("bake", {});
      l = comp.layer("switch");
      var cs = LT.control(l, "Characters Shown");
      var keys = cs.numKeys;
      var keyVal = cs.keyValue(4);
      cs.setValueAtKey(4, 0);
      var r3 = call("refreshRig", {});
      check(name + ": baked, Refresh without rebake is skipped", r3.ok && !r3.done.length && r3.skipped.length === 1 &&
        LT.control(l, "Characters Shown").keyValue(4) === 0, LT.stringify(r3));
      var r4 = call("refreshRig", { rebake: true });
      cs = LT.control(comp.layer("switch"), "Characters Shown");
      check(name + ": baked, Refresh bakes it again from its controls", r4.ok && r4.rebaked.length === 1 && cs.numKeys === keys &&
        cs.keyValue(4) === keyVal && cs.expression === "", cs.numKeys + " " + cs.keyValue(4));
      var r5 = call("refreshRig", { convert: true, rebake: true });
      l = comp.layer("switch");
      cs = LT.control(l, "Characters Shown");
      check(name + ": baked, switching keeps it baked", r5.ok && r5.types[0] === "stable" && cs.numKeys === keys && cs.expression === "" &&
        typed(l) === t0, cs.numKeys + " " + LT.stringify(r5));
      call("refreshRig", { convert: true, rebake: true });
      // A Stable rig with mixed styles warns that Dynamic shows one style.
      var mixed = comp.layer("mixed");
      select(comp, mixed);
      var r6 = call("refreshRig", { convert: true });
      check(name + ": mixed styles to Dynamic says it shows one style", r6.ok && /first font size/.test(r6.problems.join(" ")), LT.stringify(r6));
      select(comp, comp.layer("mixed"));
      call("refreshRig", { convert: true });
    })();
    save();

    // A whole rig (text, cursor, guide) duplicated, or copied and pasted into another comp, is a rig
    // of its own: its cursor follows the copy, and the original is left as it was.
    (function () {
      var name = tag + "copied rig";
      function cmd(n, id) {
        var c = 0;
        try {
          c = app.findMenuCommandId(n);
        } catch (e) {}
        app.executeCommand(c > 0 ? c : id);
      }
      function rigLayers(layer) {
        var out = [layer];
        var cur = LT.findCursor(layer);
        var g = LT.findGuide(layer);
        if (cur) out.push(cur);
        if (g) out.push(g);
        return out;
      }
      function selectAll(c, list) {
        for (var i = 1; i <= c.numLayers; i++) c.layer(i).selected = false;
        for (var j = 0; j < list.length; j++) list[j].selected = true;
      }
      function textOfSelection(c) {
        var sel = c.selectedLayers;
        for (var i = 0; i < sel.length; i++) if (sel[i] instanceof TextLayer && sel[i].comment !== "LazyTyper guide") return sel[i];
        return null;
      }
      function cursorX(layer, t) {
        return LT.findCursor(layer).property("ADBE Transform Group").property("ADBE Position").valueAtTime(t, false)[0];
      }
      var dyn = makeText(comp, { id: "copy-dyn", text: "Copy me please", box: null, just: "left" });
      dyn.property("ADBE Transform Group").property("ADBE Position").setValue([200, 900]);
      select(comp, dyn);
      comp.time = 0;
      call("createRig", { type: "dynamic", cursor: true });
      var stb = makeText(comp, { id: "copy-stb", text: "Stable copy", box: null, just: "left" });
      stb.property("ADBE Transform Group").property("ADBE Position").setValue([200, 1000]);
      select(comp, stb);
      call("createRig", { type: "stable", cursor: true });
      dyn = comp.layer("copy-dyn");
      stb = comp.layer("copy-stb");
      var dynX = cursorX(dyn, 5);
      var dynPos = LT.findCursor(dyn).property("ADBE Transform Group").property("ADBE Position").expression;

      // Edit > Duplicate, the Dynamic rig.
      comp.openInViewer();
      selectAll(comp, rigLayers(dyn));
      cmd("Duplicate", 2080);
      var copy = textOfSelection(comp);
      check(name + ": Duplicate made a copy", copy && copy.index !== comp.layer("copy-dyn").index, copy ? copy.name : "none");
      if (copy) {
        var cst = LT.sourceText(copy);
        var cd = cst.value;
        cd.text = "A longer line for the copy";
        cst.setValue(cd);
        copy.property("ADBE Transform Group").property("ADBE Position").setValue([1000, 900]);
        var ccur = LT.findCursor(copy);
        var cg = LT.findGuide(copy);
        check(name + ": the copy has its own cursor and guide", ccur && cg && ccur.parent.index === cg.index && cg.parent.index === copy.index &&
          ccur.index !== LT.findCursor(comp.layer("copy-dyn")).index, "");
        check(name + ": the copy's cursor follows the copy's text", cursorX(copy, 6) > cursorX(comp.layer("copy-dyn"), 6) + 100,
          Math.round(cursorX(copy, 6)) + " vs " + Math.round(cursorX(comp.layer("copy-dyn"), 6)));
        check(name + ": the original is left as it was", Math.abs(cursorX(comp.layer("copy-dyn"), 5) - dynX) < 0.01 &&
          LT.findCursor(comp.layer("copy-dyn")).property("ADBE Transform Group").property("ADBE Position").expression === dynPos, "");
        select(comp, copy);
        var ci = call("selectionInfo", { detail: true }).layers[0];
        check(name + ": the panel sees the copy's rig", ci.rig === "dynamic" && ci.cursor === true && ci.needsRefresh === false &&
          ci.text === "A longer line for the copy", LT.stringify(ci));
      }

      // Edit > Duplicate, the Stable rig (text and cursor).
      selectAll(comp, rigLayers(stb));
      cmd("Duplicate", 2080);
      var scopy = textOfSelection(comp);
      if (scopy) {
        var scur = LT.findCursor(scopy);
        check(name + ": Stable copy has its own cursor", scur && scur.parent.index === scopy.index &&
          scur.index !== LT.findCursor(comp.layer("copy-stb")).index, "");
        select(comp, scopy);
        var rr = call("refreshRig", {});
        check(name + ": refreshing the Stable copy leaves the original's cursor alone", rr.ok && LT.findCursor(comp.layer("copy-stb")).parent.index ===
          comp.layer("copy-stb").index, LT.stringify(rr));
      } else check(name + ": Stable Duplicate made a copy", false, "none");

      // Copy both rigs, paste them into a new comp.
      var dest = app.project.items.addComp("LazyTyper paste", 1920, 1080, 1, 12, 30);
      comp.openInViewer();
      selectAll(comp, rigLayers(comp.layer("copy-dyn")).concat(rigLayers(comp.layer("copy-stb"))));
      cmd("Copy", 19);
      dest.openInViewer();
      cmd("Paste", 20);
      check(name + ": pasted five layers", dest.numLayers === 5, dest.numLayers);
      var pd = null, ps = null;
      for (var i = 1; i <= dest.numLayers; i++) {
        var pl = dest.layer(i);
        if (pl.name === "copy-dyn") pd = pl;
        if (pl.name === "copy-stb") ps = pl;
      }
      var pairs = [[pd, comp.layer("copy-dyn")], [ps, comp.layer("copy-stb")]];
      for (var p = 0; p < pairs.length; p++) {
        var a = pairs[p][0], o = pairs[p][1];
        if (!a) {
          check(name + ": pasted " + o.name, false, "missing");
          continue;
        }
        var acur = LT.findCursor(a);
        check(name + ": pasted " + o.name + " has its cursor", acur && acur.containingComp.id === dest.id, "");
        var same = acur && Math.abs(cursorX(a, 2) - cursorX(o, 2)) < 0.01 && Math.abs(cursorX(a, 5) - cursorX(o, 5)) < 0.01 &&
          Math.round(LT.control(a, "Characters Shown").valueAtTime(1, false)) === Math.round(LT.control(o, "Characters Shown").valueAtTime(1, false));
        check(name + ": pasted " + o.name + " types and its cursor follows", same, acur ? Math.round(cursorX(a, 2)) + " vs " + Math.round(cursorX(o, 2)) : "");
        select(dest, a);
        var pi = call("selectionInfo", { detail: true }).layers[0];
        check(name + ": the panel sees pasted " + o.name, pi && pi.cursor === true && pi.needsRefresh === false, LT.stringify(pi));
      }
      comp.openInViewer();
    })();
    save();

    // A 24 fps comp: presets made at 30 fps are converted, so they type as many characters a second.
    (function () {
      var F = fx.fps24;
      var name = tag + "24 fps";
      var c24 = app.project.items.addComp("LazyTyper 24 fps", 1920, 1080, 1, 12, 24);
      c24.openInViewer();
      var l = makeText(c24, { id: "fps24", text: F.text, box: null, just: "left" });
      select(c24, l);
      c24.time = 0;
      var r = call("createRig", { type: "stable", cursor: false, typingFps: 30 });
      l = c24.layer("fps24");
      var fpc = LT.control(l, "Frames Per Character");
      check(name + ": create converts Frames Per Character", r.ok && fpc && Math.abs(fpc.value - F.fpc) < 1e-4,
        r.msg || (fpc ? fpc.value + " not " + F.fpc : "no control"));
      var bad = mismatches(LT.control(l, "Characters Shown"), F.expected, 1 / 24);
      check(name + ": typing matches the Node engine", !bad.length, bad.join("; "));
      var ap = call("applyValues", { kind: "typing", values: F.vf, fps: 30 });
      check(name + ": Apply converts too", ap.ok && Math.abs(LT.control(l, "Frames Per Character").value - F.vfFpc) < 1e-4,
        ap.msg || LT.control(l, "Frames Per Character").value + " not " + F.vfFpc);
      var rv = call("readValues", { kind: "typing", keys: ["Frames Per Character"] });
      check(name + ": Save as preset keeps the frame rate", rv.ok && rv.fps === 24, LT.stringify(rv));
      comp.openInViewer();
    })();
    save();

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
    check(tag + "selection info", info.ok && info.layers.length === 1 && info.layers[0].rig === fx.cases[0].type, LT.stringify(info));
    var rm = call("removeRig", {});
    check(tag + "remove rig", rm.ok && !LT.control(first, "Typing") && !LT.findCursor(first), rm.msg);

    // Dynamic rig erased with nothing typed after: the panel still reads the full text.
    // (Any Dynamic case but the first, whose rig was just removed; none when run with --only.)
    var dc = null;
    for (var dci = 1; dci < fx.cases.length && !dc; dci++) if (fx.cases[dci].type === "dynamic") dc = fx.cases[dci];
    if (!dc) {
      save();
      return;
    }
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
