/*
 * LazyTyper host engine (ExtendScript, ES3, ASCII only).
 *
 * The panel calls LT_call(name, argsJson); every call returns a JSON string
 * { ok: true, ... } or { ok: false, msg }. The panel sends the control
 * definitions and the expressions with each call (client/rig.js), so this
 * file only builds and changes layers. It never saves the project.
 */
var LT = (function () {
  var VERSION = "1.2.0";
  var CURSOR_TAG = "LazyTyper cursor";
  var GUIDE_TAG = "LazyTyper guide";
  var ANIMATOR = "LazyTyper";
  var GUIDE_ANIMATOR = "LazyTyper Guide";
  var COUNT = "Characters Shown";

  /* ---------------- JSON ---------------- */

  function quote(s) {
    s = String(s);
    var out = "\"";
    for (var i = 0; i < s.length; i++) {
      var c = s.charAt(i);
      var n = s.charCodeAt(i);
      if (c === "\"" || c === "\\") out += "\\" + c;
      else if (n < 32 || n > 126) {
        var h = n.toString(16);
        while (h.length < 4) h = "0" + h;
        out += "\\u" + h;
      } else out += c;
    }
    return out + "\"";
  }

  function stringify(v) {
    if (v === null || v === undefined) return "null";
    var t = typeof v;
    if (t === "number") return isFinite(v) ? String(v) : "null";
    if (t === "boolean") return v ? "true" : "false";
    if (t === "string") return quote(v);
    if (v instanceof Array) {
      var a = [];
      for (var i = 0; i < v.length; i++) a.push(stringify(v[i]));
      return "[" + a.join(",") + "]";
    }
    var parts = [];
    for (var k in v) {
      if (v.hasOwnProperty(k) && typeof v[k] !== "function") parts.push(quote(k) + ":" + stringify(v[k]));
    }
    return "{" + parts.join(",") + "}";
  }

  /* Arguments come from the panel's JSON.stringify, never from a file or the user. */
  function parse(s) {
    if (!s) return {};
    return eval("(" + s + ")");
  }

  function fail(msg) {
    var e = new Error(msg);
    e.ltUser = true;
    throw e;
  }

  /* ---------------- project helpers ---------------- */

  function activeComp() {
    var item = app.project ? app.project.activeItem : null;
    if (!item || !(item instanceof CompItem)) fail("Open a composition first.");
    return item;
  }

  function isText(layer) {
    return layer instanceof TextLayer;
  }

  function parade(layer) {
    return layer.property("ADBE Effect Parade");
  }

  function effectNamed(layer, name) {
    var p = parade(layer);
    if (!p) return null;
    for (var i = 1; i <= p.numProperties; i++) {
      if (p.property(i).name === name) return p.property(i);
    }
    return null;
  }

  function control(layer, name) {
    var fx = effectNamed(layer, name);
    return fx ? fx.property(1) : null;
  }

  function sourceText(layer) {
    return layer.property("ADBE Text Properties").property("ADBE Text Document");
  }

  function animators(layer) {
    return layer.property("ADBE Text Properties").property("ADBE Text Animators");
  }

  function animatorNamed(layer, name) {
    var a = animators(layer);
    for (var i = 1; i <= a.numProperties; i++) {
      if (a.property(i).name === name) return a.property(i);
    }
    return null;
  }

  /* The text at t as it shows (after any expression: ExtendScript cannot read before it). */
  function textOf(layer, t) {
    var v = sourceText(layer).valueAtTime(t, false);
    return v ? String(v.text) : "";
  }

  /*
   * A Dynamic rig's full text and style at t, read without changing anything (the panel polls
   * this). ExtendScript only reads Source Text after its expression, so it asks the expression:
   * at LT_PEEK + t it shows the whole text (rig.js peekOr). A rig made before the peek existed
   * shows its full text only once typing is done, so it is read at the layer's end.
   */
  function dynamicDoc(layer, t) {
    var st = sourceText(layer);
    var m = /var LT_PEEK = (-?[0-9]+);/.exec(st.expression);
    if (m) return st.valueAtTime(parseInt(m[1], 10) + t, false);
    return st.valueAtTime(Math.max(layer.inPoint, layer.outPoint - layer.containingComp.frameDuration), false);
  }

  /*
   * Runs fn with the Source Text expression switched off, so the layer's own full text and
   * style can be read. Only inside an undo group: the switch is an undoable change.
   */
  function withoutExpression(layer, fn) {
    var st = sourceText(layer);
    var was = st.expression !== "" && st.expressionEnabled;
    if (was) st.expressionEnabled = false;
    try {
      return fn();
    } finally {
      if (was) st.expressionEnabled = true;
    }
  }

  function removeKeys(prop) {
    if (!prop || !prop.canVaryOverTime) return;
    while (prop.numKeys > 0) prop.removeKey(prop.numKeys);
  }

  function setExpression(prop, expr) {
    if (prop.canSetExpression) prop.expression = expr;
  }

  /* Sets a control now: at the current time when it has keyframes, as its value otherwise. */
  function setNow(prop, value, t) {
    if (prop.numKeys > 0) prop.setValueAtTime(t, value);
    else prop.setValue(value);
  }

  function sameComp(a, b) {
    return a && b && a.containingComp && b.containingComp && a.containingComp.id === b.containingComp.id;
  }

  /* ---------------- rig discovery ---------------- */

  function isOurExpression(expr) {
    return expr && expr.indexOf("// LazyTyper") === 0;
  }

  function rigType(layer) {
    if (!isText(layer)) return null;
    if (!effectNamed(layer, COUNT)) return null;
    if (isOurExpression(sourceText(layer).expression)) return "dynamic";
    return "stable";
  }

  function layerControlTarget(layer, name) {
    var p = control(layer, name);
    if (!p) return 0;
    try {
      return p.value;
    } catch (e) {
      return 0;
    }
  }

  function findCursor(layer) {
    var comp = layer.containingComp;
    for (var i = 1; i <= comp.numLayers; i++) {
      var l = comp.layer(i);
      if (l.comment === CURSOR_TAG && layerControlTarget(l, "Text Layer") === layer.index) return l;
    }
    return null;
  }

  function findGuide(layer) {
    var comp = layer.containingComp;
    for (var i = 1; i <= comp.numLayers; i++) {
      var l = comp.layer(i);
      if (l.comment === GUIDE_TAG && l.parent && l.parent.index === layer.index) return l;
    }
    return null;
  }

  /* The text layer a selected layer belongs to: itself, or the one its cursor or guide follows. */
  function owner(layer) {
    if (isText(layer) && layer.comment !== GUIDE_TAG) return layer;
    var comp = layer.containingComp;
    if (layer.comment === CURSOR_TAG) {
      var idx = layerControlTarget(layer, "Text Layer");
      if (idx > 0 && idx <= comp.numLayers) return comp.layer(idx);
    }
    if (layer.comment === GUIDE_TAG && layer.parent) return layer.parent;
    return null;
  }

  /* Selected text layers (or the text layers behind selected cursors and guides), no repeats. */
  function targets(comp) {
    var out = [];
    var seen = {};
    var sel = comp.selectedLayers;
    for (var i = 0; i < sel.length; i++) {
      var l = owner(sel[i]);
      if (l && !seen[l.index]) {
        seen[l.index] = true;
        out.push(l);
      }
    }
    return out;
  }

  /* ---------------- controls ---------------- */

  var MATCH = {
    slider: "ADBE Slider Control",
    checkbox: "ADBE Checkbox Control",
    color: "ADBE Color Control",
    layer: "ADBE Layer Control",
    dropdown: "ADBE Dropdown Control",
    point: "ADBE Point Control"
  };

  function controlValue(def, v) {
    if (def.type === "color") {
      var c = v || def.value || [1, 1, 1];
      return [c[0], c[1], c[2], c.length > 3 ? c[3] : 1];
    }
    if (def.type === "checkbox") return v ? 1 : 0;
    return v;
  }

  /* Adds one expression control named def.name; returns its property. */
  function addControl(layer, def, value) {
    var p = parade(layer);
    var fx = p.addProperty(MATCH[def.type]);
    fx.name = def.name;
    var index = fx.propertyIndex;
    if (def.type === "dropdown" && def.items) {
      var menu = p.property(index).property(1);
      try {
        menu.setPropertyParameters(def.items);
      } catch (e) {}
      p.property(index).name = def.name;
    }
    var prop = p.property(index).property(1);
    var v = value === undefined ? def.value : value;
    if (v !== undefined && def.type !== "layer") prop.setValue(controlValue(def, v));
    return prop;
  }

  /* Adds every missing control in order; returns how many it added. */
  function ensureControls(layer, defs, values, skip) {
    var added = 0;
    for (var i = 0; i < defs.length; i++) {
      var d = defs[i];
      if (skip && skip(d)) continue;
      if (effectNamed(layer, d.name)) continue;
      addControl(layer, d, values && values[d.name] !== undefined ? values[d.name] : undefined);
      added++;
    }
    return added;
  }

  /* ---------------- transforms ---------------- */

  function resetProp(prop, v) {
    if (!prop) return;
    removeKeys(prop);
    if (prop.canSetExpression) prop.expression = "";
    prop.setValue(v);
  }

  /* Makes the layer's own space the same as its parent's: no offset, scale or turn. */
  function identity(layer) {
    var tr = layer.property("ADBE Transform Group");
    var three = layer.threeDLayer;
    var pos = tr.property("ADBE Position");
    if (pos.dimensionsSeparated) pos.dimensionsSeparated = false;
    resetProp(tr.property("ADBE Anchor Point"), three ? [0, 0, 0] : [0, 0]);
    resetProp(pos, three ? [0, 0, 0] : [0, 0]);
    resetProp(tr.property("ADBE Scale"), three ? [100, 100, 100] : [100, 100]);
    resetProp(tr.property("ADBE Rotate Z"), 0);
    if (three) {
      resetProp(tr.property("ADBE Rotate X"), 0);
      resetProp(tr.property("ADBE Rotate Y"), 0);
      resetProp(tr.property("ADBE Orientation"), [0, 0, 0]);
    }
  }

  function attach(child, parent) {
    if (typeof child.setParentWithJump === "function") child.setParentWithJump(parent);
    else child.parent = parent;
    identity(child);
  }

  /* ---------------- measuring ---------------- */

  function rectOf(layer, t) {
    var r = layer.sourceRectAtTime(t, false);
    return { left: r.left, top: r.top, width: r.width, height: r.height };
  }

  function baselines(doc) {
    var b = doc.baselineLocs;
    var lines = [];
    if (!b) return lines;
    for (var i = 0; i + 3 < b.length; i += 4) lines.push({ x1: b[i], y: b[i + 1], x2: b[i + 2] });
    return lines;
  }

  function justificationOf(doc) {
    var j = doc.justification;
    if (j === ParagraphJustification.CENTER_JUSTIFY || j === ParagraphJustification.FULL_JUSTIFY_LASTLINE_CENTER) return "center";
    if (j === ParagraphJustification.RIGHT_JUSTIFY || j === ParagraphJustification.FULL_JUSTIFY_LASTLINE_RIGHT) return "right";
    return "left";
  }

  /* A copy of the layer with no effects, expressions, keyframes or LazyTyper animators. */
  function scratchCopy(layer) {
    var c = layer.duplicate();
    c.comment = "";
    var p = parade(c);
    while (p.numProperties > 0) p.property(1).remove();
    var st = sourceText(c);
    st.expression = "";
    removeKeys(st);
    var a = animators(c);
    for (var i = a.numProperties; i >= 1; i--) {
      var n = a.property(i).name;
      if (n === ANIMATOR || n === GUIDE_ANIMATOR) a.property(i).remove();
    }
    return c;
  }

  /*
   * Font metrics in layer space from the text's first style:
   * size, line spacing, first baseline, where an empty line starts, space width and the gap
   * between a letter's right edge and the next letter.
   */
  function measureMetrics(layer, t) {
    var base = withoutExpression(layer, function () {
      return sourceText(layer).valueAtTime(t, false);
    });
    var size = base.fontSize;
    var just = justificationOf(base);
    var boxed = base.boxText;
    var boxPos = boxed ? base.boxTextPos : null;
    var boxSize = boxed ? base.boxTextSize : null;
    var autoLeading = base.autoLeading;
    var leading = base.leading;
    var tmp = scratchCopy(layer);
    var st = sourceText(tmp);
    function set(str) {
      base.text = str;
      st.setValue(base);
      return st.value;
    }
    var m = {};
    try {
      set("X");
      var rX = rectOf(tmp, t);
      set("XX");
      var rXX = rectOf(tmp, t);
      set("X X");
      var rXsX = rectOf(tmp, t);
      var two = baselines(set("X\rX"));
      var one = baselines(set("X"));
      m.size = size;
      /* Half the side bearings of an "X", plus a little air so the caret never touches a glyph. */
      m.gap = Math.max(0, (rXX.width - 2 * rX.width) / 2) + size * 0.03;
      m.spaceWidth = Math.max(size * 0.1, rXsX.width - rXX.width);
      m.firstBaseline = one.length ? one[0].y : 0;
      m.leading = two.length > 1 ? two[1].y - two[0].y : (autoLeading ? size * 1.2 : leading);
      if (!(m.leading > 0)) m.leading = size * 1.2;
      m.lineStart = 0;
      if (boxed) {
        m.lineStart = just === "center" ? boxPos[0] + boxSize[0] / 2 : (just === "right" ? boxPos[0] + boxSize[0] : boxPos[0]);
      }
    } finally {
      tmp.remove();
    }
    return m;
  }

  function menuCommand(name, fallback) {
    var id = 0;
    try {
      id = app.findMenuCommandId(name);
    } catch (e) {}
    return id > 0 ? id : fallback;
  }

  /*
   * Every glyph of the text at the comp's current time, in the text layer's space, from
   * After Effects' own Create Shapes from Text: [{ name, l, t, r, b }] in reading order.
   */
  function outlineGlyphs(layer) {
    var comp = layer.containingComp;
    var t = comp.time;
    var keep = comp.selectedLayers;
    var wasEnabled = layer.enabled;
    var wasLocked = layer.locked;
    layer.locked = false;
    for (var i = 1; i <= comp.numLayers; i++) comp.layer(i).selected = false;
    layer.selected = true;
    var before = comp.numLayers;
    comp.openInViewer();
    app.executeCommand(menuCommand("Create Shapes from Text", 3781));
    if (comp.numLayers <= before) fail("After Effects could not outline \"" + layer.name + "\".");
    var shape = comp.selectedLayers.length ? comp.selectedLayers[0] : comp.layer(layer.index - 1);
    var glyphs = [];
    try {
      var tr = rectOf(layer, t);
      var sr = rectOf(shape, t);
      var dx = tr.left - sr.left;
      var dy = tr.top - sr.top;
      var root = shape.property("ADBE Root Vectors Group");
      for (var g = 1; g <= root.numProperties; g++) {
        var grp = root.property(g);
        var inner = grp.property("ADBE Vectors Group");
        var gt = grp.property("ADBE Vector Transform Group");
        var off = [0, 0];
        if (gt) {
          var gp = gt.property("ADBE Vector Position").value;
          var ga = gt.property("ADBE Vector Anchor").value;
          off = [gp[0] - ga[0], gp[1] - ga[1]];
        }
        var box = null;
        for (var k = 1; inner && k <= inner.numProperties; k++) {
          var item = inner.property(k);
          if (item.matchName !== "ADBE Vector Shape - Group") continue;
          var v = item.property("ADBE Vector Shape").value.vertices;
          for (var m = 0; m < v.length; m++) {
            var x = v[m][0] + off[0] + dx;
            var y = v[m][1] + off[1] + dy;
            if (!box) box = { l: x, t: y, r: x, b: y };
            else {
              if (x < box.l) box.l = x;
              if (x > box.r) box.r = x;
              if (y < box.t) box.t = y;
              if (y > box.b) box.b = y;
            }
          }
        }
        if (box) {
          box.name = grp.name;
          glyphs.push(box);
        }
      }
    } finally {
      shape.remove();
      layer.enabled = wasEnabled;
      for (var s = 1; s <= comp.numLayers; s++) comp.layer(s).selected = false;
      for (var q = 0; q < keep.length; q++) {
        try {
          keep[q].selected = true;
        } catch (e2) {}
      }
      layer.locked = wasLocked;
    }
    return glyphs;
  }

  function isBreak(c) {
    return c === "\r" || c === "\n" || c === "\u0003" || c === "\u2028" || c === "\u2029";
  }

  function isBlank(c) {
    return c === " " || c === "\t" || c === "\u00A0" || c === "\u3000" || c === "\u2009" || isBreak(c);
  }

  /*
   * True when s.charAt(i) belongs to the text unit (grapheme cluster) of the character before
   * it: a letter with its marks, or consonants joined by a virama. The same function as
   * LT_join in client/rig.js, which the Stable typing range runs; the Node tests compare them.
   */
  function joinsPrevious(s, i) {
    function mark(n) {
      if (n === 0x200C || n === 0x200D) return true;
      if ((n >= 0x0300 && n <= 0x036F) || (n >= 0x1AB0 && n <= 0x1AFF) || (n >= 0x1DC0 && n <= 0x1DFF) ||
        (n >= 0x20D0 && n <= 0x20FF) || (n >= 0xFE00 && n <= 0xFE0F) || (n >= 0xFE20 && n <= 0xFE2F)) return true;
      if (n < 0x0900 || n > 0x0D7F || n === 0x0980 || n === 0x09CE || n === 0x0D4E) return false;
      var o = n & 0x7F;
      return o <= 3 || (o >= 0x3A && o <= 0x4F && o !== 0x3D) || (o >= 0x51 && o <= 0x57) || o === 0x62 || o === 0x63 ||
        n === 0x0A70 || n === 0x0A71 || n === 0x0A75;
    }
    function linker(n) {
      return n === 0x094D || n === 0x09CD || n === 0x0ACD || n === 0x0B4D || n === 0x0C4D || n === 0x0D4D;
    }
    function consonant(n) {
      var o = n & 0x7F;
      return n >= 0x0900 && n <= 0x0D7F && ((o >= 0x15 && o <= 0x39) || (o >= 0x58 && o <= 0x5F) || n === 0x09F0 || n === 0x09F1);
    }
    if (i <= 0 || i >= s.length) return false;
    var c = s.charCodeAt(i);
    var p = s.charCodeAt(i - 1);
    if (p === 13 || p === 10 || p === 3 || p === 0x2028 || p === 0x2029) return false;
    if (c >= 0xDC00 && c <= 0xDFFF) return p >= 0xD800 && p <= 0xDBFF;
    if (mark(c)) return true;
    if (!consonant(c)) return false;
    var j = i - 1;
    var linked = false;
    while (j >= 0 && mark(s.charCodeAt(j))) {
      if (linker(s.charCodeAt(j))) linked = true;
      j--;
    }
    return linked && j >= 0 && consonant(s.charCodeAt(j)) && (s.charCodeAt(j) >> 7) === (c >> 7);
  }

  /* True when some character of s joins the one before it (the text has multi-character units). */
  function hasJoins(s) {
    for (var i = 1; i < s.length; i++) if (joinsPrevious(s, i)) return true;
    return false;
  }

  /*
   * Indic vowel signs. A shaper may draw one apart from its letter (the Bengali i-sign before
   * it) and Create Shapes from Text then names that glyph after the letter.
   */
  function isVowelSign(n) {
    if (n < 0x0900 || n > 0x0D7F) return false;
    var o = n & 0x7F;
    return (o >= 0x3E && o <= 0x4C) || o === 0x57 || o === 0x62 || o === 0x63;
  }

  /* Vowel signs drawn in two parts, one each side of the letter (Bengali o and au, ...). */
  function isTwoPart(n) {
    return n === 0x09CB || n === 0x09CC || n === 0x0B48 || n === 0x0B4B || n === 0x0B4C ||
      (n >= 0x0BCA && n <= 0x0BCC) || (n >= 0x0D4A && n <= 0x0D4C);
  }

  /*
   * Takes the characters a glyph is named after from a unit's tokens: each one exactly, or,
   * when the character is in the unit but used up, a vowel sign the glyph stands for. All or
   * nothing; true when taken.
   */
  function takeTokens(tokens, name, unit) {
    var left = tokens.slice(0);
    for (var c = 0; c < name.length; c++) {
      var ch = name.charAt(c);
      var hit = -1;
      var k;
      for (k = 0; k < left.length && hit < 0; k++) if (left[k].c === ch) hit = k;
      if (hit < 0 && unit.indexOf(ch) >= 0) {
        for (k = 0; k < left.length && hit < 0; k++) if (left[k].loose) hit = k;
      }
      if (hit < 0) return false;
      left.splice(hit, 1);
    }
    tokens.length = 0;
    for (var t = 0; t < left.length; t++) tokens.push(left[t]);
    return true;
  }

  /*
   * The box of each character's unit, from the outlined glyphs (in reading order, named by a
   * character of their unit, none for spaces and line breaks). A unit takes glyphs while their
   * names match its characters, so a letter with a vowel sign drawn in two or three glyphs, or
   * a conjunct drawn as one, gets them all; every character of the unit gets the unit's box.
   */
  function unitBoxes(text, glyphs) {
    var n = text.length;
    var G = [];
    var i;
    for (i = 0; i < n; i++) G.push(null);
    var gi = 0;
    i = 0;
    while (i < n && gi < glyphs.length) {
      if (isBlank(text.charAt(i))) {
        i++;
        continue;
      }
      var end = i + 1;
      while (end < n && joinsPrevious(text, end)) end++;
      var unit = text.substring(i, end);
      var tokens = [];
      for (var k = i; k < end; k++) {
        var code = text.charCodeAt(k);
        tokens.push({ c: text.charAt(k), loose: isVowelSign(code) });
        if (isTwoPart(code)) tokens.push({ c: text.charAt(k), loose: false });
      }
      var box = null;
      while (gi < glyphs.length) {
        var g = glyphs[gi];
        var name = String(g.name);
        if (!box && name.length > end - i && text.substr(i, name.length) === name) {
          /* A ligature over several units ("fi"): it covers them all. */
          end = i + name.length;
          while (end < n && joinsPrevious(text, end)) end++;
          box = { l: g.l, t: g.t, r: g.r, b: g.b };
          gi++;
          break;
        }
        /* The first glyph is the unit's even when its name does not match (keeps the count). */
        if (!takeTokens(tokens, name, unit) && box) break;
        if (!box) box = { l: g.l, t: g.t, r: g.r, b: g.b };
        else {
          box.l = Math.min(box.l, g.l);
          box.t = Math.min(box.t, g.t);
          box.r = Math.max(box.r, g.r);
          box.b = Math.max(box.b, g.b);
        }
        gi++;
        if (!tokens.length) break;
      }
      for (k = i; k < end; k++) G[k] = box;
      i = end;
    }
    return G;
  }

  /*
   * Where the cursor sits after k characters, for k = 0..text.length, as a flat
   * [x0, y0, x1, y1, ...] in the text layer's space. A character inside a unit puts the cursor
   * after the whole unit, which the Stable rig shows as soon as its first character is typed.
   * sizes (optional) holds each character's font size: the gap after a letter and the width of
   * a space grow and shrink with it, as they do in the text.
   */
  function cursorTable(text, glyphs, lines, m, sizes) {
    var n = text.length;
    var G = unitBoxes(text, glyphs);
    var i;
    if (!lines.length) lines = [{ x1: m.lineStart, y: m.firstBaseline, x2: m.lineStart }];
    function scale(at) {
      if (!sizes || at < 0 || at >= sizes.length || !(m.size > 0)) return 1;
      return sizes[at] / m.size;
    }
    function lineOf(g, at) {
      var cy = (g.t + g.b) / 2 + 0.35 * m.size * scale(at);
      var best = 0;
      var bestD = 1e9;
      for (var L = 0; L < lines.length; L++) {
        var d = Math.abs(lines[L].y - cy);
        if (d < bestD) {
          bestD = d;
          best = L;
        }
      }
      return best;
    }
    function lineY(L) {
      if (L < lines.length) return lines[L].y;
      return lines[lines.length - 1].y + (L - lines.length + 1) * m.leading;
    }
    function lineX(L) {
      if (L < lines.length) return lines[L].x1;
      return m.lineStart;
    }
    var out = [];
    var line = 0;
    var x;
    var first = -1;
    for (i = 0; i < n; i++) {
      if (G[i]) {
        first = i;
        break;
      }
      if (isBreak(text.charAt(i))) break;
    }
    if (n > 0 && G[0]) {
      line = lineOf(G[0], 0);
      x = G[0].l - m.gap * scale(0);
    } else {
      x = lineX(0);
    }
    out.push(x, lineY(line));
    var last = null;
    var lastAt = -1;
    var run = 0;
    for (var k = 1; k <= n; k++) {
      var c = text.charAt(k - 1);
      if (G[k - 1]) {
        last = G[k - 1];
        lastAt = k - 1;
        line = lineOf(last, lastAt);
        x = last.r + m.gap * scale(lastAt);
        run = 0;
      } else if (isBreak(c)) {
        line++;
        last = null;
        run = 0;
        x = lineX(line);
      } else {
        run++;
        var j = k;
        while (j < n && !G[j] && !isBreak(text.charAt(j))) j++;
        var next = j < n ? G[j] : null;
        var runLen = run + (j - k);
        var from = last ? last.r + m.gap * scale(lastAt) : lineX(line);
        if (last && next && lineOf(next, j) === line && next.l - m.gap * scale(j) > from) {
          x = from + (next.l - m.gap * scale(j) - from) * run / runLen;
        } else {
          x = from + run * m.spaceWidth * scale(k - 1);
        }
      }
      out.push(x, lineY(line));
    }
    return out;
  }

  function fmt(v) {
    var r = Math.round(v * 10) / 10;
    return isFinite(r) ? String(r) : "0";
  }

  /* The times to measure at: each Source Text keyframe, or now. */
  function textTimes(layer) {
    var st = sourceText(layer);
    var times = [];
    for (var i = 1; i <= st.numKeys; i++) times.push(st.keyTime(i));
    if (!times.length) times.push(layer.containingComp.time);
    return times;
  }

  /*
   * The font size of every character, from the text's own character styles
   * (TextDocument.characterRange, After Effects 24.3 and later). Older versions, or a range
   * that cannot be read, give the first style's size.
   */
  function charSizes(doc) {
    var n = String(doc.text).length;
    var base = doc.fontSize;
    var out = [];
    var ranged = typeof doc.characterRange === "function";
    for (var i = 0; i < n; i++) {
      var s = base;
      if (ranged) {
        try {
          var v = doc.characterRange(i, i + 1).fontSize;
          if (v > 0) s = v;
        } catch (e) {}
      }
      out.push(s);
    }
    return out;
  }

  /*
   * The cursor's size after k characters, for k = 0..text.length: the size of the last
   * character typed, or at the start of a line, of the next one.
   */
  function cursorSizes(text, sizes, base) {
    var n = text.length;
    var out = [];
    for (var k = 0; k <= n; k++) {
      var at = k - 1;
      if (at < 0 || isBreak(text.charAt(at))) at = k < n ? k : k - 1;
      out.push(at >= 0 && at < n ? sizes[at] : base);
    }
    return out;
  }

  /* "size" when every entry is the same, "[s0,s1,...]" otherwise (one per character count). */
  function sizesData(list, base) {
    if (!list.length) return fmt(base);
    var same = true;
    for (var i = 1; i < list.length; i++) {
      if (Math.abs(list[i] - list[0]) > 0.05) {
        same = false;
        break;
      }
    }
    if (same) return fmt(list[0]);
    var parts = [];
    for (var p = 0; p < list.length; p++) parts.push(fmt(list[p]));
    return "[" + parts.join(",") + "]";
  }

  /* Stable rig: one cursor table per Source Text keyframe, ready for the LT_DATA marker. */
  function measureStable(layer, m) {
    var comp = layer.containingComp;
    var keepTime = comp.time;
    var anim = animatorNamed(layer, ANIMATOR);
    var animOn = anim ? anim.enabled : false;
    if (anim) anim.enabled = false;
    var data = [];
    var sizes = [];
    try {
      var times = textTimes(layer);
      for (var i = 0; i < times.length; i++) {
        var t = times[i];
        var ct = Math.max(0, Math.min(comp.duration - comp.frameDuration, t));
        comp.time = ct;
        var doc = sourceText(layer).valueAtTime(ct, true);
        var text = String(doc.text);
        var glyphs = text.length ? outlineGlyphs(layer) : [];
        var each = charSizes(doc);
        var pts = cursorTable(text, glyphs, baselines(doc), m, each);
        var parts = [];
        for (var p = 0; p < pts.length; p++) parts.push(fmt(pts[p]));
        data.push("[" + fmt(t) + "," + fmt(doc.fontSize) + ",[" + parts.join(",") + "]]");
        sizes.push("[" + fmt(t) + "," + sizesData(cursorSizes(text, each, doc.fontSize), doc.fontSize) + "]");
      }
    } finally {
      if (anim) anim.enabled = animOn;
      comp.time = keepTime;
    }
    return { data: data.join(",\n"), sizes: sizes.join(",") };
  }

  function metricsLine(m) {
    return "var SIZE = " + fmt(m.size) + ", LEAD = " + fmt(m.leading) + ", B0 = " + fmt(m.firstBaseline) +
      ", X0 = " + fmt(m.lineStart) + ", SPW = " + fmt(m.spaceWidth) + ", GAP = " + fmt(m.gap) + ";";
  }

  /* ---------------- building ---------------- */

  function addTypingAnimator(layer, expr) {
    var a = animators(layer).addProperty("ADBE Text Animator");
    a.name = ANIMATOR;
    a = animatorNamed(layer, ANIMATOR);
    var sel = a.property("ADBE Text Selectors").addProperty("ADBE Text Selector");
    sel.name = "Typed";
    a = animatorNamed(layer, ANIMATOR);
    var op = a.property("ADBE Text Animator Properties").addProperty("ADBE Text Opacity");
    op.setValue(0);
    a = animatorNamed(layer, ANIMATOR);
    sel = a.property("ADBE Text Selectors").property(1);
    var adv = sel.property("ADBE Text Range Advanced");
    adv.property("ADBE Text Range Units").setValue(2);
    adv.property("ADBE Text Range Type2").setValue(1);
    sel.property("ADBE Text Index End").setValue(99999);
    sel.property("ADBE Text Index Start").expression = expr.stableSelectorStart;
  }

  /*
   * Scale 0 on every unit but the last one with a shape: an Expression Selector based on
   * Characters Excluding Spaces, so After Effects counts the units (a Bengali conjunct or a
   * letter with its vowel sign is one) and trailing spaces and line breaks never count.
   */
  function addGuideAnimator(guide, expr) {
    var a = animators(guide).addProperty("ADBE Text Animator");
    a.name = GUIDE_ANIMATOR;
    a = animatorNamed(guide, GUIDE_ANIMATOR);
    a.property("ADBE Text Selectors").addProperty("ADBE Text Expressible Selector");
    a = animatorNamed(guide, GUIDE_ANIMATOR);
    var sc = a.property("ADBE Text Animator Properties").addProperty("ADBE Text Scale 3D");
    sc.setValue([0, 0, 0]);
    a = animatorNamed(guide, GUIDE_ANIMATOR);
    var sel = a.property("ADBE Text Selectors").property(1);
    sel.name = "Last Unit";
    sel.property("ADBE Text Range Type2").setValue(2);
    sel.property("ADBE Text Expressible Amount").expression = expr.guideSelector;
  }

  /* A guide made by 1.1.1 or earlier picks the last character by string index (wrong for joined letters). */
  function oldGuide(layer) {
    var g = findGuide(layer);
    var a = g ? animatorNamed(g, GUIDE_ANIMATOR) : null;
    if (!a) return false;
    return a.property("ADBE Text Selectors").property(1).matchName !== "ADBE Text Expressible Selector";
  }

  /* A Stable typing range made by 1.1.1 or earlier counts characters, not units. */
  function oldTypingRange(layer) {
    var a = animatorNamed(layer, ANIMATOR);
    if (!a) return false;
    var e = a.property("ADBE Text Selectors").property(1).property("ADBE Text Index Start").expression;
    return e !== "" && e.indexOf("LT_unit") < 0;
  }

  /* Dynamic rig: a hidden copy of the text layer whose bounds show where the cursor goes. */
  function makeGuide(layer, expr) {
    var old = findGuide(layer);
    if (old) old.remove();
    var g = scratchCopy(layer);
    g.name = layer.name + " Guide";
    g.comment = GUIDE_TAG;
    g.moveAfter(layer);
    attach(g, layer);
    sourceText(g).expression = expr.guideText;
    addGuideAnimator(g, expr);
    g.guideLayer = true;
    g.enabled = false;
    g.shy = true;
    return g;
  }

  function cursorExpressions(cursor, layer, type, expr, m, stable) {
    var tr = cursor.property("ADBE Transform Group");
    var path = cursor.property("ADBE Root Vectors Group").property("Cursor").property("ADBE Vectors Group")
      .property("ADBE Vector Shape - Group").property("ADBE Vector Shape");
    var fill = cursor.property("ADBE Root Vectors Group").property("Cursor").property("ADBE Vectors Group")
      .property("ADBE Vector Graphic - Fill").property("ADBE Vector Fill Color");
    var stamp = MEASURED + signature(layer, type) + "\n";
    if (type === "stable") {
      tr.property("ADBE Position").expression = stamp + expr.stableCursorPosition.replace("/*LT_DATA*/", stable.data);
      path.expression = expr.cursorPath.replace("/*LT_SIZES*/", stable.sizes);
    } else {
      tr.property("ADBE Position").expression = stamp + expr.dynamicCursorPosition.replace("/*LT_METRICS*/", metricsLine(m));
      path.expression = expr.cursorPath.replace("/*LT_SIZES*/", "[0," + fmt(m.size) + "]");
    }
    fill.expression = expr.cursorColor;
    tr.property("ADBE Opacity").expression = expr.cursorOpacity;
  }

  /*
   * What a cursor's measurements depend on, as a short fingerprint: the text's first style
   * (font, size, tracking, leading, alignment, box) and, for a Stable rig, the text of every
   * Source Text keyframe. It is stored at the top of the cursor's Position expression when
   * the cursor is measured; when it stops matching, the panel asks for a Refresh.
   */
  var MEASURED = "// measured:";
  var STYLE_KEYS = ["font", "fontSize", "tracking", "leading", "autoLeading", "justification", "fauxBold",
    "fauxItalic", "allCaps", "smallCaps", "horizontalScale", "verticalScale", "baselineShift", "boxText"];

  function styleOf(doc) {
    var parts = [];
    for (var i = 0; i < STYLE_KEYS.length; i++) {
      try {
        parts.push(String(doc[STYLE_KEYS[i]]));
      } catch (e) {
        parts.push("-");
      }
    }
    try {
      if (doc.boxText) parts.push(String(doc.boxTextSize), String(doc.boxTextPos));
    } catch (e2) {}
    return parts.join("|");
  }

  function hash(s) {
    var h = 5381;
    for (var i = 0; i < s.length; i++) h = ((h * 33) ^ s.charCodeAt(i)) & 0x7fffffff;
    return h.toString(36);
  }

  function signature(layer, type) {
    var st = sourceText(layer);
    if (type === "dynamic") {
      /* The guide follows the text by itself; only the style matters. */
      return hash(styleOf(dynamicDoc(layer, Math.max(layer.inPoint, layer.outPoint - layer.containingComp.frameDuration))));
    }
    var times = textTimes(layer);
    var s = "";
    for (var i = 0; i < times.length; i++) {
      var d = st.valueAtTime(times[i], false);
      s += styleOf(d) + "#" + d.text + "#" + layoutOf(layer, d, times[i]) + "\n";
    }
    return hash(s);
  }

  /*
   * Where the text's lines start and end, and its bounds: any font, size or tracking change on
   * part of the text moves these, a colour change does not. Rounded to a pixel, so the
   * fingerprint only changes when the layout does.
   */
  function layoutOf(layer, doc, t) {
    var parts = [];
    try {
      var b = doc.baselineLocs;
      for (var i = 0; b && i < b.length; i++) parts.push(Math.round(b[i]));
    } catch (e) {}
    try {
      var r = layer.sourceRectAtTime(t, false);
      parts.push(Math.round(r.left), Math.round(r.top), Math.round(r.width), Math.round(r.height));
    } catch (e2) {}
    return parts.join(",");
  }

  /* True when the cursor was measured for a style or text the layer no longer has. */
  function needsRefresh(layer, type, cursor) {
    var e = cursor.property("ADBE Transform Group").property("ADBE Position").expression;
    if (e.indexOf(MEASURED) !== 0) return false;
    var stored = e.substring(MEASURED.length, e.indexOf("\n"));
    return stored !== signature(layer, type);
  }

  function makeCursor(layer, type, opts, guide) {
    var comp = layer.containingComp;
    var c = comp.layers.addShape();
    c.name = layer.name + " Cursor";
    c.comment = CURSOR_TAG;
    c.moveBefore(layer);
    c.inPoint = layer.inPoint;
    c.outPoint = layer.outPoint;
    c.label = layer.label;
    var root = c.property("ADBE Root Vectors Group");
    var grp = root.addProperty("ADBE Vector Group");
    grp.name = "Cursor";
    grp = root.property("Cursor");
    grp.property("ADBE Vectors Group").addProperty("ADBE Vector Shape - Group");
    grp = root.property("Cursor");
    grp.property("ADBE Vectors Group").addProperty("ADBE Vector Graphic - Fill");
    if (layer.threeDLayer) c.threeDLayer = true;
    attach(c, layer);
    var values = opts.cursorValues || {};
    if (!values["Cursor Color"]) {
      try {
        var doc = sourceText(layer).valueAtTime(comp.time, true);
        if (doc.applyFill) values["Cursor Color"] = doc.fillColor;
      } catch (e) {}
    }
    ensureControls(c, opts.cursorControls, values, function (d) {
      return d.dynamicOnly && type !== "dynamic";
    });
    control(c, "Text Layer").setValue(layer.index);
    if (guide) control(c, "Guide Layer").setValue(guide.index);
    return c;
  }

  function checkExpressions(layer, out) {
    var props = [control(layer, COUNT), sourceText(layer)];
    for (var i = 0; i < props.length; i++) {
      var p = props[i];
      if (!p || !p.expression) continue;
      try {
        p.valueAtTime(layer.containingComp.time, false);
      } catch (e) {}
      if (p.expressionError) out.push(layer.name + ": " + p.expressionError);
    }
  }

  /* ---------------- calls ---------------- */

  /*
   * What is selected, for the panel. The panel asks often, so this reads as little as it can:
   * only with a.detail does it evaluate expressions (the typed count and a Dynamic rig's text),
   * which After Effects can refuse with an "internal verification failure" while it is busy
   * switching projects. Dialogs stay suppressed for the whole call.
   */
  function selectionInfo(a) {
    var proj = app.project;
    if (!proj) return { ok: true, comp: null, layers: [] };
    var item = proj.activeItem;
    if (!item || !(item instanceof CompItem)) return { ok: true, comp: null, layers: [], engine: proj.expressionEngine };
    var list = [];
    var tl = targets(item);
    for (var i = 0; i < tl.length; i++) {
      var l = tl[i];
      var type = rigType(l);
      var cs = type ? control(l, COUNT) : null;
      var info = { name: l.name, index: l.index, rig: type, baked: !!(cs && cs.numKeys > 0 && cs.expression === "") };
      var cursor = type ? findCursor(l) : null;
      if (type) info.cursor = !!cursor;
      if (a.detail && cursor) {
        try {
          info.needsRefresh = needsRefresh(l, type, cursor);
        } catch (eR) {}
      }
      if (a.detail) {
        var full = "";
        try {
          /* Polling must not switch the expression off, so a Dynamic rig is asked (dynamicDoc). */
          full = type === "dynamic" ? String(dynamicDoc(l, item.time).text) : textOf(l, item.time);
        } catch (e0) {}
        info.text = full.substr(0, 2000);
        /* Joined letters (Bengali, Devanagari) need the unit-counting parts of a newer rig. */
        if (type && hasJoins(full)) {
          try {
            if (type === "dynamic" ? (cursor && oldGuide(l)) : oldTypingRange(l)) {
              info.needsRefresh = true;
              info.olderRig = true;
            }
          } catch (eO) {}
        }
        if (type) {
          try {
            info.shown = Math.round(cs.valueAtTime(item.time, false));
          } catch (e) {}
          info.length = full.length;
        }
      }
      list.push(info);
    }
    var other = item.selectedLayers.length - tl.length;
    return {
      ok: true,
      comp: item.name,
      fps: Math.round(1 / item.frameDuration * 1000) / 1000,
      time: item.time,
      layers: list,
      otherSelected: other > 0 ? other : 0,
      engine: app.project.expressionEngine
    };
  }

  function createRig(a) {
    var comp = activeComp();
    var list = targets(comp);
    if (!list.length) fail("Select a text layer first.");
    var made = [];
    var skipped = [];
    var problems = [];
    app.beginUndoGroup("LazyTyper: Create Typing Rig");
    try {
      for (var i = 0; i < list.length; i++) {
        var layer = list[i];
        if (rigType(layer)) {
          skipped.push(layer.name + " already has a rig");
          continue;
        }
        var st = sourceText(layer);
        if (a.type === "dynamic" && st.expression && !isOurExpression(st.expression)) {
          skipped.push(layer.name + " has its own Source Text expression");
          continue;
        }
        try {
          var m = measureMetrics(layer, comp.time);
          var stable = a.type === "stable" ? measureStable(layer, m) : null;
          var guide = a.type === "dynamic" ? makeGuide(layer, a.expr) : null;
          ensureControls(layer, a.textControls, a.typing);
          var cs = control(layer, COUNT);
          if (a.type === "stable") {
            cs.expression = a.expr.stableCount;
            addTypingAnimator(layer, a.expr);
          } else {
            cs.expression = a.expr.dynamicCount;
            st.expression = a.expr.dynamicText;
          }
          if (a.cursor) {
            var cur = makeCursor(layer, a.type, a, guide);
            cursorExpressions(cur, layer, a.type, a.expr, m, stable);
          }
        } catch (e) {
          /* Leave the layer as it was rather than half rigged. */
          try {
            stripRig(layer, a.textControls);
          } catch (e2) {}
          throw e;
        }
        checkExpressions(layer, problems);
        made.push(layer.name);
      }
    } finally {
      app.endUndoGroup();
    }
    return { ok: true, made: made, skipped: skipped, problems: problems };
  }

  function refreshRig(a) {
    var comp = activeComp();
    var list = targets(comp);
    var done = [];
    var problems = [];
    app.beginUndoGroup("LazyTyper: Refresh Rig");
    try {
      for (var i = 0; i < list.length; i++) {
        var layer = list[i];
        var type = rigType(layer);
        if (!type) continue;
        ensureControls(layer, a.textControls, null);
        var cs = control(layer, COUNT);
        var baked = cs.numKeys > 0 && cs.expression === "";
        var st = sourceText(layer);
        if (type === "stable") {
          if (!baked) cs.expression = a.expr.stableCount;
          var anim = animatorNamed(layer, ANIMATOR);
          if (anim) anim.remove();
          addTypingAnimator(layer, a.expr);
        } else {
          if (!baked) cs.expression = a.expr.dynamicCount;
          st.expression = baked ? a.expr.dynamicTextBaked : a.expr.dynamicText;
        }
        var guide = null;
        var cur = findCursor(layer);
        var m = measureMetrics(layer, comp.time);
        if (type === "dynamic") guide = makeGuide(layer, a.expr);
        if (cur) {
          ensureControls(cur, a.cursorControls, null, function (d) {
            return d.dynamicOnly && type !== "dynamic";
          });
          if (guide) control(cur, "Guide Layer").setValue(guide.index);
          control(cur, "Text Layer").setValue(layer.index);
          var stable = type === "stable" ? measureStable(layer, m) : null;
          cursorExpressions(cur, layer, type, a.expr, m, stable);
        }
        checkExpressions(layer, problems);
        done.push(layer.name);
      }
    } finally {
      app.endUndoGroup();
    }
    if (!done.length) fail("Select a text layer with a LazyTyper rig.");
    return { ok: true, done: done, problems: problems };
  }

  /* Takes every LazyTyper part off a text layer: cursor, guide, expression, animator, controls. */
  function stripRig(layer, textControls) {
    var cur = findCursor(layer);
    if (cur) cur.remove();
    var guide = findGuide(layer);
    if (guide) guide.remove();
    var st = sourceText(layer);
    if (isOurExpression(st.expression)) st.expression = "";
    var anim = animatorNamed(layer, ANIMATOR);
    if (anim) anim.remove();
    for (var d = 0; d < textControls.length; d++) {
      var fx = effectNamed(layer, textControls[d].name);
      if (fx) fx.remove();
    }
  }

  function removeRig(a) {
    var comp = activeComp();
    var list = targets(comp);
    var done = [];
    app.beginUndoGroup("LazyTyper: Remove Rig");
    try {
      for (var i = 0; i < list.length; i++) {
        var layer = list[i];
        if (!rigType(layer)) continue;
        stripRig(layer, a.textControls);
        done.push(layer.name);
      }
    } finally {
      app.endUndoGroup();
    }
    if (!done.length) fail("Select a text layer with a LazyTyper rig.");
    return { ok: true, done: done };
  }

  function charClass(c) {
    if (c === "") return "spaces";
    if (isBlank(c)) return "spaces";
    if (c >= "0" && c <= "9") return "numbers";
    if (c.toLowerCase() !== c.toUpperCase() || c.charCodeAt(0) > 127) {
      if (".,;:!?'\"-()[]".indexOf(c) < 0) return "letters";
    }
    return "punctuation";
  }

  function bake(a) {
    var comp = activeComp();
    var list = targets(comp);
    var done = [];
    var skipped = [];
    app.beginUndoGroup("LazyTyper: Bake Typing");
    try {
      for (var i = 0; i < list.length; i++) {
        var layer = list[i];
        var type = rigType(layer);
        if (!type) continue;
        var cs = control(layer, COUNT);
        if (cs.numKeys > 0 && cs.expression === "") {
          skipped.push(layer.name + " is already baked");
          continue;
        }
        var st = sourceText(layer);
        var keep = st.expression;
        var log;
        try {
          st.expression = a.expr.recorder;
          log = String(st.valueAtTime(layer.outPoint, false).text);
          if (st.expressionError) fail(layer.name + ": " + st.expressionError);
        } finally {
          st.expression = keep;
        }
        var times = [];
        var values = [];
        var labels = [];
        var prev = 0;
        var items = log ? log.split(";") : [];
        for (var k = 0; k < items.length; k++) {
          var pair = items[k].split(":");
          if (pair.length !== 2) continue;
          var tk = parseFloat(pair[0]);
          var v = parseInt(pair[1], 10);
          if (isNaN(tk) || isNaN(v)) continue;
          var label;
          if (v < prev) label = a.labels.deleting;
          else label = a.labels[charClass(textOf(layer, tk).charAt(v - 1))];
          times.push(tk);
          values.push(v);
          labels.push(label);
          prev = v;
        }
        cs.expression = "";
        removeKeys(cs);
        if (!times.length) {
          times.push(layer.inPoint);
          values.push(0);
          labels.push(0);
        }
        cs.setValuesAtTimes(times, values);
        for (var n = 1; n <= cs.numKeys; n++) {
          cs.setInterpolationTypeAtKey(n, KeyframeInterpolationType.HOLD, KeyframeInterpolationType.HOLD);
          if (typeof cs.setLabelAtKey === "function") {
            try {
              cs.setLabelAtKey(n, labels[n - 1] || 0);
            } catch (e) {}
          }
        }
        /* Only now, with no expression left on Characters Shown, may Source Text read it. */
        if (type === "dynamic") st.expression = a.expr.dynamicTextBaked;
        done.push(layer.name + " (" + cs.numKeys + " keyframes)");
      }
    } finally {
      app.endUndoGroup();
    }
    if (!done.length && !skipped.length) fail("Select a text layer with a LazyTyper rig.");
    return { ok: true, done: done, skipped: skipped };
  }

  function unbake(a) {
    var comp = activeComp();
    var list = targets(comp);
    var done = [];
    app.beginUndoGroup("LazyTyper: Unbake Typing");
    try {
      for (var i = 0; i < list.length; i++) {
        var layer = list[i];
        var type = rigType(layer);
        if (!type) continue;
        /* Source Text stops reading Characters Shown before that reads Source Text again. */
        if (type === "dynamic") sourceText(layer).expression = a.expr.dynamicText;
        var cs = control(layer, COUNT);
        removeKeys(cs);
        cs.expression = type === "stable" ? a.expr.stableCount : a.expr.dynamicCount;
        done.push(layer.name);
      }
    } finally {
      app.endUndoGroup();
    }
    if (!done.length) fail("Select a text layer with a LazyTyper rig.");
    return { ok: true, done: done };
  }

  /* Sets preset values on the selected rigs (kind "typing") or their cursors (kind "cursor"). */
  function applyValues(a) {
    var comp = activeComp();
    var list = targets(comp);
    var done = [];
    app.beginUndoGroup("LazyTyper: Apply Preset");
    try {
      for (var i = 0; i < list.length; i++) {
        var layer = list[i];
        if (!rigType(layer)) continue;
        var target = a.kind === "cursor" ? findCursor(layer) : layer;
        if (!target) continue;
        var defs = a.kind === "cursor" ? a.cursorControls : a.textControls;
        for (var d = 0; d < defs.length; d++) {
          var def = defs[d];
          if (a.values[def.name] === undefined) continue;
          var p = control(target, def.name);
          if (p) setNow(p, controlValue(def, a.values[def.name]), comp.time);
        }
        done.push(layer.name);
      }
    } finally {
      app.endUndoGroup();
    }
    if (!done.length) fail(a.kind === "cursor" ? "Select a text layer whose rig has a cursor." : "Select a text layer with a LazyTyper rig.");
    return { ok: true, done: done };
  }

  function readValues(a) {
    var comp = activeComp();
    var list = targets(comp);
    for (var i = 0; i < list.length; i++) {
      var layer = list[i];
      if (!rigType(layer)) continue;
      var target = a.kind === "cursor" ? findCursor(layer) : layer;
      if (!target) continue;
      var values = {};
      for (var k = 0; k < a.keys.length; k++) {
        var p = control(target, a.keys[k]);
        if (!p) continue;
        var v = p.valueAtTime(comp.time, false);
        values[a.keys[k]] = (v instanceof Array) ? [v[0], v[1], v[2]] : Math.round(v * 1000) / 1000;
      }
      return { ok: true, values: values, layer: layer.name };
    }
    fail(a.kind === "cursor" ? "Select a text layer whose rig has a cursor." : "Select a text layer with a LazyTyper rig.");
  }

  function addCursor(a) {
    var comp = activeComp();
    var list = targets(comp);
    var done = [];
    app.beginUndoGroup("LazyTyper: Add Cursor");
    try {
      for (var i = 0; i < list.length; i++) {
        var layer = list[i];
        var type = rigType(layer);
        if (!type || findCursor(layer)) continue;
        var m = measureMetrics(layer, comp.time);
        var guide = type === "dynamic" ? (findGuide(layer) || makeGuide(layer, a.expr)) : null;
        var cur = makeCursor(layer, type, a, guide);
        cursorExpressions(cur, layer, type, a.expr, m, type === "stable" ? measureStable(layer, m) : null);
        done.push(layer.name);
      }
    } finally {
      app.endUndoGroup();
    }
    if (!done.length) fail("Select a text layer with a LazyTyper rig and no cursor.");
    return { ok: true, done: done };
  }

  /* ---------------- timeline helpers ---------------- */

  function eachRig(undo, fn) {
    var comp = activeComp();
    var list = targets(comp);
    var done = [];
    app.beginUndoGroup("LazyTyper: " + undo);
    try {
      for (var i = 0; i < list.length; i++) {
        if (!rigType(list[i])) continue;
        fn(list[i], comp);
        done.push(list[i].name);
      }
    } finally {
      app.endUndoGroup();
    }
    if (!done.length) fail("Select a text layer with a LazyTyper rig.");
    return { ok: true, done: done };
  }

  function typingAt(layer, comp, on) {
    var p = control(layer, "Typing");
    var t = comp.time;
    if (p.numKeys === 0) {
      var before = p.value;
      if (t > layer.inPoint + comp.frameDuration / 2) p.setValueAtTime(layer.inPoint, before);
    }
    p.setValueAtTime(t, on ? 1 : 0);
  }

  function startHere(a) {
    return eachRig("Start Typing Here", function (layer, comp) {
      typingAt(layer, comp, true);
    });
  }

  function stopHere(a) {
    return eachRig("Stop Typing Here", function (layer, comp) {
      typingAt(layer, comp, false);
    });
  }

  function pauseHere(a) {
    return eachRig("Add Pause", function (layer, comp) {
      var mv = new MarkerValue("Pause");
      mv.duration = Math.max(1, a.frames || 12) * comp.frameDuration;
      layer.property("ADBE Marker").setValueAtTime(comp.time, mv);
    });
  }

  function eraseHere(a) {
    return eachRig("Erase Here", function (layer, comp) {
      var t = comp.time;
      var typing = control(layer, "Typing");
      if (typing.valueAtTime(t, false) > 0.5 || typing.numKeys > 0) typingAt(layer, comp, false);
      var cs = control(layer, COUNT);
      var shown = Math.round(cs.valueAtTime(t, false));
      var n = a.all ? shown : Math.min(shown, Math.max(0, a.chars || 0));
      var sa = control(layer, "Start at Character");
      var s0 = sa.valueAtTime(t, false);
      var frames = Math.max(1, a.frames || 12);
      sa.setValueAtTime(t, s0);
      sa.setValueAtTime(t + frames * comp.frameDuration, s0 - n);
    });
  }

  var calls = {
    selectionInfo: selectionInfo,
    createRig: createRig,
    refreshRig: refreshRig,
    removeRig: removeRig,
    bake: bake,
    unbake: unbake,
    applyValues: applyValues,
    readValues: readValues,
    addCursor: addCursor,
    startHere: startHere,
    stopHere: stopHere,
    pauseHere: pauseHere,
    eraseHere: eraseHere
  };

  /* Puts back the layers that were selected, minus any the call removed. */
  function restoreSelection(comp, keep) {
    var back = 0;
    for (var i = 0; i < keep.length; i++) {
      try {
        if (keep[i].containingComp.id === comp.id) {
          keep[i].selected = true;
          back++;
        }
      } catch (e) {}
    }
    return back;
  }

  var READ_ONLY = { selectionInfo: true, readValues: true };

  function call(name, argsJson) {
    app.beginSuppressDialogs();
    try {
      return run(name, argsJson);
    } finally {
      app.endSuppressDialogs(false);
    }
  }

  function run(name, argsJson) {
    try {
      var fn = calls[name];
      if (!fn) fail("Unknown call " + name);
      var item = app.project ? app.project.activeItem : null;
      var comp = item instanceof CompItem ? item : null;
      var keep = comp && !READ_ONLY[name] ? comp.selectedLayers : [];
      var result;
      try {
        result = fn(parse(argsJson));
      } finally {
        if (comp && !READ_ONLY[name]) {
          for (var i = 1; i <= comp.numLayers; i++) comp.layer(i).selected = false;
          restoreSelection(comp, keep);
        }
      }
      return stringify(result);
    } catch (e) {
      var msg = e.ltUser ? e.message : (String(e) + (e.line ? " (host.jsx line " + e.line + ")" : ""));
      return stringify({ ok: false, msg: msg });
    }
  }

  return {
    version: VERSION,
    call: call,
    stringify: stringify,
    cursorTable: cursorTable,
    unitBoxes: unitBoxes,
    joinsPrevious: joinsPrevious,
    measureMetrics: measureMetrics,
    sourceText: sourceText,
    control: control,
    findCursor: findCursor,
    findGuide: findGuide
  };
})();

function LT_call(name, argsJson) {
  return LT.call(name, argsJson);
}
