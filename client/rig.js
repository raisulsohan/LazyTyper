/*
 * LazyTyper rig definitions: the controls a rig adds, the built-in presets and
 * the expressions the host writes into the layers.
 *
 * Plain ES5 (CEP 9's Chromium 61). Sets window.LazyTyperRig and, for the Node
 * tests, module.exports. The expressions themselves are ES3 so they run in
 * both of After Effects' expression engines; none of them uses the
 * sourceText.style API, which the legacy engine does not have.
 */
(function () {
  var engine = (typeof lazyTyperRun === "function") ? lazyTyperRun :
    (typeof require === "function" ? require("./engine.js").lazyTyperRun : null);

  var VERSION = "1.2.0";
  var TAG = "LazyTyper";

  /*
   * Controls on the text layer, in the order they appear in Effect Controls.
   *   frames   the value counts frames: a preset made at one frame rate is converted to the comp's
   *   since    added in that version, with a value that changes nothing, so Refresh can add it to
   *            an older rig and the rig keeps its timing
   *   oldFloor rigs and presets made before the "since" controls ignored values below this; they
   *            are raised to it when such a rig or preset is brought up to date
   */
  var TEXT_CONTROLS = [
    { name: "Typing", type: "checkbox", value: 1, group: "typing" },
    { name: "Start at Character", type: "slider", value: 0, group: "typing" },
    { name: "Speed Mode", type: "dropdown", items: ["Frames Per Character", "Total Duration"], value: 1, group: "speed" },
    { name: "Frames Per Character", type: "slider", value: 3, group: "speed", frames: true },
    { name: "Total Duration", type: "slider", value: 90, group: "speed", frames: true },
    { name: "Variance", type: "slider", value: 35, group: "speed" },
    { name: "Random Seed", type: "slider", value: 1, group: "speed" },
    { name: "Slow: Capitals", type: "slider", value: 60, group: "slow" },
    { name: "Slow: Numbers", type: "slider", value: 60, group: "slow" },
    { name: "Slow: Symbols", type: "slider", value: 120, group: "slow" },
    { name: "Slow: Punctuation", type: "slider", value: 40, group: "slow" },
    { name: "Slow: After Punctuation", type: "slider", value: 250, group: "slow" },
    { name: "Slow: Sentence End", type: "slider", value: 500, group: "slow" },
    { name: "Slow: Last Character", type: "slider", value: 0, group: "slow", since: "1.3.0" },
    { name: "Slow: Before Line Break", type: "slider", value: 0, group: "slow", since: "1.3.0" },
    { name: "Slow: New Line", type: "slider", value: 400, group: "slow" },
    { name: "Slow: Word Start", type: "slider", value: 50, group: "slow" },
    { name: "Slow: Long Words", type: "slider", value: 30, group: "slow" },
    { name: "Slow: Rare Letters", type: "slider", value: 40, group: "slow" },
    { name: "Slow: Same Finger", type: "slider", value: 0, group: "slow", since: "1.3.0" },
    { name: "Fast: Repeated Letters", type: "slider", value: 30, group: "fast", oldFloor: 0 },
    { name: "Fast: Capitals in a Row", type: "slider", value: 0, group: "fast", since: "1.3.0" },
    { name: "Fast: Numbers in a Row", type: "slider", value: 0, group: "fast", since: "1.3.0" },
    { name: "Fast: Common Pairs", type: "slider", value: 30, group: "fast" },
    { name: "Fast: Common Words", type: "slider", value: 20, group: "fast" },
    { name: "Fast: Word Momentum", type: "slider", value: 20, group: "fast" },
    { name: "Slow/Fast: Spaces", type: "slider", value: 0, group: "either" },
    { name: "Slow/Fast: Empty Lines", type: "slider", value: 0, group: "either", since: "1.3.0" },
    { name: "Slow/Fast: Same Hand", type: "slider", value: 20, group: "either" },
    { name: "Slow/Fast: Fatigue", type: "slider", value: 10, group: "either" },
    { name: "Characters Shown", type: "slider", value: 0, group: "output" }
  ];

  /*
   * Controls on the cursor layer. Sizes are percentages of the font size.
   *   since    added in that version; Refresh adds it to an older cursor
   *   oldValue the value an older cursor gets when Refresh adds the control, when it differs from a
   *            new rig's (so the cursor keeps looking as it did); otherwise value
   * The cursor finds its text by parenting (Stable: its parent; Dynamic: its parent is the guide,
   * whose parent is the text), which After Effects carries over when a whole rig is duplicated or
   * pasted. Cursors made before 1.3.0 had two Layer Controls for that, Text Layer and Guide Layer,
   * which a copy kept pointing at the original; Refresh takes them off.
   */
  var CURSOR_CONTROLS = [
    { name: "Show Cursor", type: "checkbox", value: 1, since: "1.3.0" },
    { name: "Use Text Color", type: "checkbox", value: 1, oldValue: 0, since: "1.3.0" },
    { name: "Cursor Color", type: "color", value: [1, 1, 1] },
    { name: "Cursor Opacity", type: "slider", value: 100 },
    { name: "Blink", type: "checkbox", value: 1 },
    { name: "Blinks per Second", type: "slider", value: 1 },
    { name: "Blink While Typing", type: "checkbox", value: 0 },
    { name: "Blink Softness", type: "slider", value: 0 },
    { name: "Width", type: "slider", value: 7 },
    { name: "Top", type: "slider", value: 80 },
    { name: "Bottom", type: "slider", value: 16 },
    { name: "Size From", type: "dropdown", items: ["Character Before", "Character After"], value: 1, since: "1.3.0" },
    { name: "Height Follows Size", type: "checkbox", value: 1, since: "1.3.0" },
    { name: "Width Follows Size", type: "checkbox", value: 1, since: "1.3.0" },
    { name: "Roundness", type: "slider", value: 0 },
    { name: "Individual Corners", type: "checkbox", value: 0 },
    { name: "Top Left", type: "slider", value: 0 },
    { name: "Top Right", type: "slider", value: 0 },
    { name: "Bottom Right", type: "slider", value: 0 },
    { name: "Bottom Left", type: "slider", value: 0 },
    { name: "Offset Unit", type: "dropdown", items: ["Pixels", "% of Font Size"], value: 2, oldValue: 1, since: "1.3.0" },
    { name: "X Offset", type: "slider", value: 0 },
    { name: "Y Offset", type: "slider", value: 0 }
  ];

  /* The typing controls a preset stores (everything but the start/stop and output controls). */
  var TYPING_PRESET_KEYS = [];
  for (var i = 0; i < TEXT_CONTROLS.length; i++) {
    var g = TEXT_CONTROLS[i].group;
    if (g !== "typing" && g !== "output") TYPING_PRESET_KEYS.push(TEXT_CONTROLS[i].name);
  }
  /* What a cursor preset stores: the shape and the blink, not the colour or Show Cursor. */
  var CURSOR_PRESET_KEYS = ["Cursor Opacity", "Blink", "Blinks per Second", "Blink While Typing", "Blink Softness",
    "Width", "Top", "Bottom", "Size From", "Height Follows Size", "Width Follows Size", "Roundness", "Individual Corners",
    "Top Left", "Top Right", "Bottom Right", "Bottom Left", "Offset Unit", "X Offset", "Y Offset"];

  /* A typing preset's values: the base speed, Variance and every Slow, Fast and Slow/Fast control. */
  function preset(fpc, variance, controls) {
    var v = { "Speed Mode": 1, "Frames Per Character": fpc, "Total Duration": 90, "Variance": variance, "Random Seed": 1 };
    for (var k in controls) if (controls.hasOwnProperty(k)) v[k] = controls[k];
    return v;
  }

  /*
   * A typing preset keeps the frame rate its frame counts were made at (fps); applying it to a
   * comp at another rate converts them, so it types as many characters a second at any rate.
   * The built-in ones were tuned at 30 fps: about 14, 7 and 2.5 characters a second (a very
   * fast typist, an everyday one sped up a little for the screen, and two fingers).
   */
  var TYPING_PRESETS = [
    { name: "Very Fast", builtIn: true, fps: 30, values: preset(2.05, 15, {
      "Slow: Capitals": 30, "Slow: Numbers": 30, "Slow: Symbols": 60, "Slow: Punctuation": 20,
      "Slow: After Punctuation": 150, "Slow: Sentence End": 300, "Slow: Last Character": 100,
      "Slow: Before Line Break": 50, "Slow: New Line": 250, "Slow: Word Start": 20, "Slow: Long Words": 0,
      "Slow: Rare Letters": 10, "Slow: Same Finger": 40,
      "Fast: Repeated Letters": -25, "Fast: Capitals in a Row": 60, "Fast: Numbers in a Row": 50,
      "Fast: Common Pairs": 40, "Fast: Common Words": 30, "Fast: Word Momentum": 30,
      "Slow/Fast: Spaces": -20, "Slow/Fast: Empty Lines": -60, "Slow/Fast: Same Hand": 10, "Slow/Fast: Fatigue": 0
    }) },
    { name: "Average", builtIn: true, fps: 30, values: preset(2.9, 35, {
      "Slow: Capitals": 60, "Slow: Numbers": 60, "Slow: Symbols": 120, "Slow: Punctuation": 40,
      "Slow: After Punctuation": 250, "Slow: Sentence End": 500, "Slow: Last Character": 150,
      "Slow: Before Line Break": 60, "Slow: New Line": 400, "Slow: Word Start": 50, "Slow: Long Words": 30,
      "Slow: Rare Letters": 40, "Slow: Same Finger": 20,
      "Fast: Repeated Letters": 15, "Fast: Capitals in a Row": 50, "Fast: Numbers in a Row": 40,
      "Fast: Common Pairs": 30, "Fast: Common Words": 20, "Fast: Word Momentum": 20,
      "Slow/Fast: Spaces": 0, "Slow/Fast: Empty Lines": -50, "Slow/Fast: Same Hand": 20, "Slow/Fast: Fatigue": 10
    }) },
    { name: "Hunt & Peck", builtIn: true, fps: 30, values: preset(6, 60, {
      "Slow: Capitals": 150, "Slow: Numbers": 120, "Slow: Symbols": 250, "Slow: Punctuation": 80,
      "Slow: After Punctuation": 300, "Slow: Sentence End": 600, "Slow: Last Character": 100,
      "Slow: Before Line Break": 100, "Slow: New Line": 500, "Slow: Word Start": 100, "Slow: Long Words": 60,
      "Slow: Rare Letters": 100, "Slow: Same Finger": 0,
      "Fast: Repeated Letters": 60, "Fast: Capitals in a Row": 30, "Fast: Numbers in a Row": 40,
      "Fast: Common Pairs": 10, "Fast: Common Words": 20, "Fast: Word Momentum": 0,
      "Slow/Fast: Spaces": -30, "Slow/Fast: Empty Lines": -40, "Slow/Fast: Same Hand": 0, "Slow/Fast: Fatigue": 20
    }) }
  ];

  /* The frame rate assumed for a saved preset that does not say (saved before presets kept one). */
  var PRESET_FPS = 30;

  /*
   * A typing preset's values for a comp at fps frames a second: the controls that count frames
   * (Frames Per Character, Total Duration) scaled from the preset's own rate.
   */
  function valuesForFps(values, fromFps, fps) {
    var out = {};
    var k;
    for (k in values) if (values.hasOwnProperty(k)) out[k] = values[k];
    var from = fromFps > 0 ? fromFps : PRESET_FPS;
    if (!(fps > 0) || Math.abs(fps - from) < 1e-6) return out;
    for (var i = 0; i < TEXT_CONTROLS.length; i++) {
      var d = TEXT_CONTROLS[i];
      if (d.frames && typeof out[d.name] === "number") out[d.name] = Math.round(out[d.name] * fps / from * 10000) / 10000;
    }
    return out;
  }

  /*
   * Typing values read from an older rig or preset lack the "since" controls: adds them at the
   * values that change nothing and, when none of them was there, raises oldFloor controls, so the
   * values type as they did. Returns true if anything changed.
   */
  function upgradeValues(values) {
    var i, d;
    var older = true;
    for (i = 0; i < TEXT_CONTROLS.length; i++) if (TEXT_CONTROLS[i].since && values[TEXT_CONTROLS[i].name] !== undefined) older = false;
    var changed = false;
    for (i = 0; i < TEXT_CONTROLS.length; i++) {
      d = TEXT_CONTROLS[i];
      if (d.since && values[d.name] === undefined) {
        values[d.name] = d.value;
        changed = true;
      } else if (older && d.oldFloor !== undefined && values[d.name] < d.oldFloor) {
        values[d.name] = d.oldFloor;
        changed = true;
      }
    }
    return changed;
  }

  /*
   * Brings a saved typing preset up to date; returns true if it changed. One without a frame rate
   * was saved before presets kept one (1.2.0 and earlier): it gets PRESET_FPS.
   */
  function upgradeTypingPreset(p) {
    var changed = false;
    if (!p.values) p.values = {};
    if (!(p.fps > 0)) {
      p.fps = PRESET_FPS;
      changed = true;
    }
    return upgradeValues(p.values) || changed;
  }

  /*
   * Beside a bigger word (mixed sizes in a Stable rig) every cursor grows taller; a vertical bar
   * keeps its width (widthFollows 0), an underscore or a box grows wider too.
   */
  function cursorPreset(width, top, bottom, round, widthFollows) {
    return {
      "Cursor Opacity": 100, "Blink": 1, "Blinks per Second": 1, "Blink While Typing": 0, "Blink Softness": 0,
      "Width": width, "Top": top, "Bottom": bottom,
      "Size From": 1, "Height Follows Size": 1, "Width Follows Size": widthFollows,
      "Roundness": round, "Individual Corners": 0,
      "Top Left": round, "Top Right": round, "Bottom Right": round, "Bottom Left": round,
      "Offset Unit": 2, "X Offset": 0, "Y Offset": 0
    };
  }
  var CURSOR_PRESETS = [
    { name: "Vertical", builtIn: true, values: cursorPreset(7, 80, 16, 0, 0) },
    { name: "Underscore", builtIn: true, values: cursorPreset(55, -6, 14, 0, 1) },
    { name: "Box", builtIn: true, values: cursorPreset(55, 80, 18, 8, 1) }
  ];

  /*
   * Brings a saved cursor preset up to date; returns true if it changed. One saved before 1.3.0
   * lacks the newer shape controls: it gets the values that keep it looking as it did (its
   * offsets stay in pixels).
   */
  function upgradeCursorPreset(p) {
    var changed = false;
    if (!p.values) p.values = {};
    for (var i = 0; i < CURSOR_CONTROLS.length; i++) {
      var d = CURSOR_CONTROLS[i];
      if (!d.since || p.values[d.name] !== undefined) continue;
      var keep = false;
      for (var k = 0; k < CURSOR_PRESET_KEYS.length; k++) if (CURSOR_PRESET_KEYS[k] === d.name) keep = true;
      if (!keep) continue;
      p.values[d.name] = d.oldValue !== undefined ? d.oldValue : d.value;
      changed = true;
    }
    return changed;
  }

  /* After Effects label colours (index 1-16) for baked keyframes. */
  var LABELS = ["None", "Red", "Yellow", "Aqua", "Pink", "Lavender", "Peach", "Sea Foam", "Blue", "Green",
    "Purple", "Orange", "Brown", "Fuchsia", "Cyan", "Sandstone", "Dark Green"];
  var LABEL_HEX = ["#5a5a5a", "#b53838", "#e4d84c", "#a9cbc7", "#e5bcc9", "#a9a9ca", "#e7c19e", "#b3c7b3", "#677de0",
    "#4aa44c", "#8e2c9a", "#e8920d", "#7f452a", "#f46dd6", "#3da2a5", "#a89677", "#1e401e"];
  var DEFAULT_KEY_LABELS = { letters: 8, numbers: 2, punctuation: 13, spaces: 9, deleting: 1 };

  /* ---------------- expressions ---------------- */

  function engineSource() {
    // Keep the function body only, minus full-line comments (strings never start a line).
    return String(engine).replace(/^[ \t]*\/\/.*(\r?\n)/gm, "");
  }

  function header(what) {
    return "// " + TAG + " " + VERSION + " - " + what + ". The LazyTyper panel writes this; Refresh Rig rewrites it.\n";
  }

  /*
   * Text of a Source Text value in either engine: the JavaScript engine gives an object with
   * .text, the legacy one a string. The legacy engine throws on a property that does not exist,
   * so the expressions never read one without try, hasOwnProperty or a field they always set.
   */
  var STR_FN = "function LT_str(v) { var s; try { s = v.text; } catch (e) {} return typeof s === \"string\" ? s : \"\" + v; }\n";

  /*
   * The full text over time, as LT_text(t). textProp is "text.sourceText" or "thisProperty"
   * (inside the Source Text expression, where valueAtTime and value give the text before the
   * expression).
   */
  function textPart(textProp, staticText) {
    return STR_FN +
      "var LT_src = " + textProp + ";\n" +
      "var LT_kt = [], LT_ks = [];\n" +
      "for (var LT_i = 1; LT_i <= LT_src.numKeys; LT_i++) { var LT_tk = LT_src.key(LT_i).time; LT_kt.push(LT_tk); LT_ks.push(LT_str(LT_src.valueAtTime(LT_tk))); }\n" +
      "var LT_s0 = LT_kt.length ? \"\" : LT_str(" + staticText + ");\n" +
      "function LT_text(t) {\n" +
      "  if (!LT_kt.length) return LT_s0;\n" +
      "  var j = 0;\n" +
      "  while (j + 1 < LT_kt.length && LT_kt[j + 1] <= t + 1e-6) j++;\n" +
      "  return LT_ks[j];\n" +
      "}\n";
  }

  /* LT_text plus control sampling, the pause markers and the engine itself. */
  function preamble(textProp, staticText) {
    return textPart(textProp, staticText) +
      "var LT_L = thisLayer;\n" +
      "var LT_cache = {};\n" +
      "function LT_num(n, t) {\n" +
      "  var c;\n" +
      "  if (LT_cache.hasOwnProperty(n)) c = LT_cache[n];\n" +
      "  else { var p = LT_L.effect(n)(1); c = { p: p, k: p.numKeys > 0, v: p.value }; LT_cache[n] = c; }\n" +
      "  return c.k ? c.p.valueAtTime(t) : c.v;\n" +
      "}\n" +
      "var LT_P = [];\n" +
      "for (var LT_m = 1; LT_m <= thisLayer.marker.numKeys; LT_m++) {\n" +
      "  var LT_mk = thisLayer.marker.key(LT_m);\n" +
      "  var LT_cm = \"\" + LT_mk.comment;\n" +
      "  if (/^\\s*pause/i.test(LT_cm)) {\n" +
      "    var LT_d = LT_mk.duration;\n" +
      "    if (!(LT_d > 0)) { var LT_n = LT_cm.match(/[0-9.]+/); LT_d = (LT_n ? parseFloat(LT_n[0]) : 12) * thisComp.frameDuration; }\n" +
      "    LT_P.push([LT_mk.time, LT_mk.time + LT_d]);\n" +
      "  }\n" +
      "}\n" +
      engineSource() + "\n";
  }

  function runCall(record) {
    return "lazyTyperRun({ time: time, fd: thisComp.frameDuration, start: thisLayer.inPoint, num: LT_num, text: LT_text, pauses: LT_P, record: " +
      (record ? "true" : "false") + " })";
  }

  /* Stable rig: Characters Shown runs the engine (Source Text has no expression). */
  function stableCount() {
    return header("typing engine") + preamble("text.sourceText", "text.sourceText.value") + runCall(false);
  }

  /*
   * ExtendScript reads Source Text only after its expression, so the host asks a Dynamic
   * rig's expression itself for the full text: evaluated at LT_PEEK + t, hours before any time
   * the comp shows, it gives LT_text(t) whole. LT_PEEK is the earliest time valueAtTime
   * reaches (it clamps to 3 hours either way); the host reads it from the expression.
   */
  var PEEK = "var LT_PEEK = -10800;\n";

  function peekOr(shown) {
    return "time <= LT_PEEK + thisComp.duration ? LT_text(time - LT_PEEK) : " + shown;
  }

  /*
   * Dynamic rig: Source Text runs the engine and Characters Shown reads its length back.
   * It must not touch Characters Shown at all, or the two expressions would depend on each
   * other, which After Effects resolves unpredictably. Bake swaps in dynamicTextBaked.
   */
  function dynamicText() {
    return header("dynamic typing") + PEEK + preamble("thisProperty", "value") +
      peekOr("LT_text(time).substr(0, Math.max(0, " + runCall(false) + "))");
  }

  /* Dynamic rig, baked: Characters Shown holds keyframes and Source Text follows them. */
  function dynamicTextBaked() {
    return header("dynamic typing, baked") + PEEK + textPart("thisProperty", "value") +
      peekOr("LT_text(time).substr(0, Math.max(0, Math.round(effect(\"Characters Shown\")(1).value)))");
  }

  /* Dynamic rig: Characters Shown reads how much Source Text shows. */
  function dynamicCount() {
    return header("characters shown") + STR_FN + "LT_str(text.sourceText.value).length";
  }

  /* Bake: a temporary Source Text expression that lists every change as "time:count;". */
  function recorder() {
    return header("bake recorder") + preamble("thisProperty", "value") +
      "var LT_e = " + runCall(true) + ";\n" +
      "var LT_o = [];\n" +
      "for (var LT_j = 0; LT_j < LT_e.length; LT_j++) LT_o.push(LT_e[LT_j][0].toFixed(6) + \":\" + LT_e[LT_j][1]);\n" +
      "LT_o.join(\";\")";
  }

  var TRAILING_SCAN =
    "function LT_nl(c) { return c === \"\\r\" || c === \"\\n\" || c === \"\\u0003\" || c === \"\\u2028\" || c === \"\\u2029\"; }\n" +
    "function LT_sp(c) { return c === \" \" || c === \"\\t\" || c === \"\\u00A0\" || c === \"\\u3000\" || c === \"\\u2009\"; }\n";

  /*
   * Text animators count units, not characters: a letter with its marks is one unit (a grapheme
   * cluster), and so are Bengali, Devanagari, Gujarati, Oriya, Telugu and Malayalam consonants
   * joined by a virama ("kSa" is one unit, "mi" is one unit). LT_join(s, i) is true when
   * s.charAt(i) belongs to the unit of the character before it. ES3, copied into the expressions
   * as written; host.jsx keeps the same function as joinsPrevious (the Node tests compare them).
   */
  function LT_join(s, i) {
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

  /*
   * A range selector's index counts units and skips line breaks: the units that start before
   * string position k (a unit typed in part counts, After Effects shows it whole).
   */
  var UNIT_FN = String(LT_join) + "\n" +
    "function LT_unit(s, k) { var n = 0; for (var i = 0; i < k && i < s.length; i++) if (!LT_nl(s.charAt(i)) && !LT_join(s, i)) n++; return n; }\n";

  /* Stable rig: the opacity range starts at the first unit not typed yet. */
  function stableSelectorStart() {
    return header("typing range") + STR_FN + TRAILING_SCAN + UNIT_FN +
      "LT_unit(LT_str(text.sourceText.value), Math.round(effect(\"Characters Shown\")(1).value))";
  }

  /* Dynamic guide: shows what the text layer shows, in the guide's own (flattened) style. */
  function guideText() {
    return header("guide text") + STR_FN + "LT_str(parent.text.sourceText.value)";
  }

  /*
   * Dynamic guide: the Amount of an Expression Selector based on Characters Excluding Spaces.
   * It leaves only the last unit with a shape out of the Scale 0 animator, counted by After
   * Effects itself, so letters that join (Bengali, Devanagari) are measured whole.
   */
  function guideSelector() {
    return header("guide selector") + "textIndex === textTotal ? 0 : 100";
  }

  function point3() {
    return "value.length > 2 ? [x, y, 0] : [x, y]";
  }

  /*
   * The cursor expressions below carry data the host measures in After Effects, so they are
   * templates: the host swaps each marker for its numbers.
   *   LT_DATA     stable tables, "[time,size,[x0,y0,x1,y1,...]],...": one per Source Text
   *               keyframe; point k is where the cursor sits after k characters
   *   LT_METRICS  "var SIZE = .., LEAD = .., B0 = .., X0 = .., SPW = .., GAP = ..;"
   *   LT_SIZES    "[time,main,before,after],...": the font sizes from each Source Text keyframe on.
   *               main is the size most of the text has; before and after are the size of the
   *               character before and after the cursor, a number, or for mixed sizes "[s0,s1,...]"
   *               (one for each count of characters shown)
   *   LT_COLORS   "[time,before,after],...": the same for the text's fill colour, each "[r,g,b]" or
   *               "[[r,g,b],...]"
   *   LT_TEXT     how the cursor reaches its text layer: "parent" (Stable) or "parent.parent"
   *               (Dynamic: the cursor's parent is the guide)
   */
  var DATA = "/*LT_DATA*/";
  var METRICS = "/*LT_METRICS*/";
  var SIZES = "/*LT_SIZES*/";
  var COLORS = "/*LT_COLORS*/";
  var TEXT = "/*LT_TEXT*/";

  /* The cursor's table entry for now: the last one whose time has come. */
  function entryNow(list, name) {
    return "var " + name + " = " + list + "[0];\n" +
      "for (var LT_i = 1; LT_i < " + list + ".length; LT_i++) if (" + list + "[LT_i][0] <= time + 1e-6) " + name + " = " + list + "[LT_i];\n";
  }

  /* LT_pick(list): a list's entry for the number of characters shown now (read once). */
  var PICK_FN =
    "var LT_k = -1;\n" +
    "function LT_pick(list) {\n" +
    "  if (LT_k < 0) LT_k = Math.max(0, Math.round(LT_T.effect(\"Characters Shown\")(1).value));\n" +
    "  return list[Math.min(list.length - 1, LT_k)];\n" +
    "}\n";
  /* Which character the cursor takes its size (and with Use Text Color, its colour) from. */
  var AFTER_NOW = "Math.round(effect(\"Size From\")(1).value) === 2";

  function stableCursorPosition() {
    return header("stable cursor") +
      "var LT_T = " + TEXT + ";\n" +
      "var LT_D = [" + DATA + "];\n" +
      entryNow("LT_D", "LT_e") +
      "var P = LT_e[2];\n" +
      "var k = Math.round(LT_T.effect(\"Characters Shown\")(1).value);\n" +
      "k = Math.max(0, Math.min(P.length / 2 - 1, k));\n" +
      "var x = P[2 * k];\n" +
      "var y = P[2 * k + 1];\n" +
      point3();
  }

  /* Dynamic cursor position, measured live from the guide layer (the cursor's parent). */
  function dynamicCursorPosition() {
    return header("dynamic cursor") + STR_FN + TRAILING_SCAN +
      "var G = parent;\n" +
      METRICS + "\n" +
      "var s = LT_str(G.text.sourceText.value);\n" +
      "var sp = 0, nl = 0, j = s.length - 1;\n" +
      "while (j >= 0) {\n" +
      "  var c = s.charAt(j);\n" +
      "  if (LT_nl(c)) nl++;\n" +
      "  else if (LT_sp(c)) { if (nl === 0) sp++; }\n" +
      "  else break;\n" +
      "  j--;\n" +
      "}\n" +
      "var line = 0, x = X0;\n" +
      "if (j >= 0) {\n" +
      "  var r = G.sourceRectAtTime(time, false);\n" +
      "  if (r.width > 0 || r.height > 0) {\n" +
      "    line = Math.max(0, Math.round((r.top + r.height / 2 - B0 + 0.35 * SIZE) / LEAD));\n" +
      "    x = r.left + r.width + GAP;\n" +
      "  }\n" +
      "}\n" +
      "if (nl > 0) { line += nl; x = X0; }\n" +
      "x += sp * SPW;\n" +
      "var y = B0 + line * LEAD;\n" +
      point3();
  }

  /*
   * Cursor rectangle: width grows to the right, top and bottom from the baseline, corners rounded,
   * moved by the offsets (in pixels, or in % of the font size: X like the width, Y like the height).
   * Its size comes from the character before or after the cursor (Size From); height and width
   * each follow that size or keep the text's main size.
   */
  function cursorPath() {
    return header("cursor shape") +
      "var LT_T = " + TEXT + ";\n" +
      "var LT_Z = [" + SIZES + "];\n" +
      entryNow("LT_Z", "Z") +
      PICK_FN +
      "var S = " + AFTER_NOW + " ? Z[3] : Z[2];\n" +
      "if (typeof S === \"object\") S = LT_pick(S);\n" +
      "var SH = effect(\"Height Follows Size\")(1).value > 0.5 ? S : Z[1];\n" +
      "var SW = effect(\"Width Follows Size\")(1).value > 0.5 ? S : Z[1];\n" +
      "var pct = Math.round(effect(\"Offset Unit\")(1).value) === 2;\n" +
      "var ox = effect(\"X Offset\")(1).value * (pct ? SW / 100 : 1);\n" +
      "var oy = effect(\"Y Offset\")(1).value * (pct ? SH / 100 : 1);\n" +
      "var w = Math.max(0, effect(\"Width\")(1).value) / 100 * SW;\n" +
      "var y0 = -effect(\"Top\")(1).value / 100 * SH;\n" +
      "var y1 = effect(\"Bottom\")(1).value / 100 * SH;\n" +
      "if (y1 < y0) { var tmp = y0; y0 = y1; y1 = tmp; }\n" +
      "var lim = Math.min(w, y1 - y0) / 2;\n" +
      "var ind = effect(\"Individual Corners\")(1).value > 0.5;\n" +
      "var all = effect(\"Roundness\")(1).value;\n" +
      "function R(n) { var v = (ind ? effect(n)(1).value : all) / 100; return Math.max(0, Math.min(1, v)) * lim; }\n" +
      "var a = R(\"Top Left\"), b = R(\"Top Right\"), c = R(\"Bottom Right\"), d = R(\"Bottom Left\");\n" +
      "var K = 0.5523, x0 = ox, x1 = ox + w;\n" +
      "y0 += oy;\n" +
      "y1 += oy;\n" +
      "createPath(\n" +
      "  [[x0 + a, y0], [x1 - b, y0], [x1, y0 + b], [x1, y1 - c], [x1 - c, y1], [x0 + d, y1], [x0, y1 - d], [x0, y0 + a]],\n" +
      "  [[-a * K, 0], [0, 0], [0, -b * K], [0, 0], [c * K, 0], [0, 0], [0, d * K], [0, 0]],\n" +
      "  [[0, 0], [b * K, 0], [0, 0], [0, c * K], [0, 0], [-d * K, 0], [0, 0], [0, -a * K]],\n" +
      "  true)";
  }

  /* Show Cursor off hides it; otherwise Cursor Opacity, blinking. */
  function cursorOpacity() {
    return header("cursor blink") +
      "var T = " + TEXT + ";\n" +
      "var o = effect(\"Cursor Opacity\")(1).value;\n" +
      "if (effect(\"Show Cursor\")(1).value < 0.5) o = 0;\n" +
      "else if (effect(\"Blink\")(1).value > 0.5) {\n" +
      "  var rate = Math.max(0.01, effect(\"Blinks per Second\")(1).value);\n" +
      "  var busy = false;\n" +
      "  if (effect(\"Blink While Typing\")(1).value < 0.5) {\n" +
      "    var cs = T.effect(\"Characters Shown\")(1);\n" +
      "    busy = Math.round(cs.value) !== Math.round(cs.valueAtTime(time - 0.4));\n" +
      "  }\n" +
      "  if (!busy) {\n" +
      "    var ph = (time * rate) % 1;\n" +
      "    if (ph < 0) ph += 1;\n" +
      "    var soft = Math.max(0, Math.min(1, effect(\"Blink Softness\")(1).value / 100));\n" +
      "    var hard = ph < 0.5 ? 1 : 0;\n" +
      "    var wave = 0.5 + 0.5 * Math.cos(ph * 2 * Math.PI);\n" +
      "    o *= hard * (1 - soft) + wave * soft;\n" +
      "  }\n" +
      "}\n" +
      "o";
  }

  /*
   * Use Text Color on: the fill colour of the character the cursor takes its size from (measured
   * per character in a Stable rig, the first character's in a Dynamic one). Off: Cursor Color.
   */
  function cursorColor() {
    return header("cursor colour") +
      "var LT_T = " + TEXT + ";\n" +
      "var LT_C = [" + COLORS + "];\n" +
      PICK_FN +
      "var LT_c = effect(\"Cursor Color\")(1).value;\n" +
      "if (effect(\"Use Text Color\")(1).value > 0.5) {\n" +
      "  " + entryNow("LT_C", "Z").replace(/\n(?=.)/g, "\n  ") +
      "  var v = " + AFTER_NOW + " ? Z[2] : Z[1];\n" +
      "  if (typeof v[0] === \"object\") v = LT_pick(v);\n" +
      "  LT_c = [v[0], v[1], v[2], 1];\n" +
      "}\n" +
      "LT_c";
  }

  /* Everything the host needs to build or refresh a rig, in one object. */
  function expressionSet() {
    return {
      version: VERSION,
      stableCount: stableCount(),
      dynamicText: dynamicText(),
      dynamicTextBaked: dynamicTextBaked(),
      dynamicCount: dynamicCount(),
      recorder: recorder(),
      stableSelectorStart: stableSelectorStart(),
      guideText: guideText(),
      guideSelector: guideSelector(),
      cursorOpacity: cursorOpacity(),
      cursorColor: cursorColor(),
      stableCursorPosition: stableCursorPosition(),
      dynamicCursorPosition: dynamicCursorPosition(),
      cursorPath: cursorPath()
    };
  }

  var api = {
    VERSION: VERSION,
    TAG: TAG,
    TEXT_CONTROLS: TEXT_CONTROLS,
    CURSOR_CONTROLS: CURSOR_CONTROLS,
    TYPING_PRESET_KEYS: TYPING_PRESET_KEYS,
    CURSOR_PRESET_KEYS: CURSOR_PRESET_KEYS,
    TYPING_PRESETS: TYPING_PRESETS,
    CURSOR_PRESETS: CURSOR_PRESETS,
    PRESET_FPS: PRESET_FPS,
    valuesForFps: valuesForFps,
    upgradeValues: upgradeValues,
    upgradeTypingPreset: upgradeTypingPreset,
    upgradeCursorPreset: upgradeCursorPreset,
    LABELS: LABELS,
    LABEL_HEX: LABEL_HEX,
    DEFAULT_KEY_LABELS: DEFAULT_KEY_LABELS,
    engineSource: engineSource,
    joins: LT_join,
    expressionSet: expressionSet
  };
  if (typeof window !== "undefined") window.LazyTyperRig = api;
  if (typeof module !== "undefined" && module.exports) module.exports = api;
})();
