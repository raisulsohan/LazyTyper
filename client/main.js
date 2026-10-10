/*
 * LazyTyper panel controller.
 *
 * Plain ES5 for CEP 9 (Chromium 61, Node 8): no let/const, arrow functions,
 * template strings, optional chaining or flex gap. Talks to host/host.jsx
 * through LT_call(name, json); every argument is built with JSON.stringify.
 * Presets and settings live in a JSON file in the user's app-data folder
 * (localStorage outside After Effects, for the browser preview).
 */
(function () {
  var RIG = window.LazyTyperRig;
  var EXPR = RIG.expressionSet();
  var inCep = !!(window.__adobe_cep__);
  var cs = inCep ? new CSInterface() : null;

  function $(id) { return document.getElementById(id); }

  /* ---------------- storage ---------------- */

  var nodeFs = null;
  var nodePath = null;
  var dataDir = null;
  try {
    if (typeof require === "function") {
      nodeFs = require("fs");
      nodePath = require("path");
      var os = require("os");
      var base = process.platform === "win32" ? (process.env.APPDATA || os.homedir()) :
        nodePath.join(os.homedir(), "Library", "Application Support");
      dataDir = nodePath.join(base, "LazyTyper");
    }
  } catch (e) {
    nodeFs = null;
  }

  function loadJson(name, fallback) {
    try {
      if (nodeFs) {
        var p = nodePath.join(dataDir, name);
        if (!nodeFs.existsSync(p)) return fallback;
        return JSON.parse(nodeFs.readFileSync(p, "utf8"));
      }
      var s = window.localStorage.getItem("LazyTyper." + name);
      return s ? JSON.parse(s) : fallback;
    } catch (e) {
      return fallback;
    }
  }

  function saveJson(name, value) {
    try {
      if (nodeFs) {
        if (!nodeFs.existsSync(dataDir)) nodeFs.mkdirSync(dataDir);
        var p = nodePath.join(dataDir, name);
        nodeFs.writeFileSync(p + ".tmp", JSON.stringify(value, null, 2), "utf8");
        nodeFs.renameSync(p + ".tmp", p);
        return true;
      }
      window.localStorage.setItem("LazyTyper." + name, JSON.stringify(value));
      return true;
    } catch (e) {
      toast("Could not save " + name + ": " + e.message, "bad");
      return false;
    }
  }

  var settings = loadJson("settings.json", {});
  if (!settings.labels) settings.labels = {};
  for (var lk in RIG.DEFAULT_KEY_LABELS) {
    if (settings.labels[lk] === undefined) settings.labels[lk] = RIG.DEFAULT_KEY_LABELS[lk];
  }
  if (settings.rigType !== "stable") settings.rigType = "dynamic";
  if (!settings.typingPreset) settings.typingPreset = "b:Average";
  if (!settings.cursorPreset) settings.cursorPreset = "b:Vertical";
  if (!settings.createCursor) settings.createCursor = "b:Vertical";

  var saved = loadJson("presets.json", { typing: [], cursor: [] });
  if (!saved.typing) saved.typing = [];
  if (!saved.cursor) saved.cursor = [];

  function persistSettings() { saveJson("settings.json", settings); }

  /* ---------------- host bridge ---------------- */

  var busy = 0;

  function host(name, args, done) {
    var payload = {};
    var k;
    for (k in args) if (args.hasOwnProperty(k)) payload[k] = args[k];
    var script = "LT_call(" + JSON.stringify(name) + "," + JSON.stringify(JSON.stringify(payload)) + ")";
    busy++;
    var finish = function (raw) {
      busy--;
      var res;
      try {
        res = JSON.parse(raw);
      } catch (e) {
        res = { ok: false, msg: raw && raw !== "EvalScript error." ? String(raw) : "After Effects did not answer. Close and reopen the panel." };
      }
      if (done) done(res);
    };
    if (inCep) cs.evalScript(script, finish);
    else setTimeout(function () { finish(JSON.stringify(mockHost(name, payload))); }, 60);
  }

  /* Every call that changes layers carries the definitions and expressions. */
  function rigArgs(extra) {
    var a = {
      textControls: RIG.TEXT_CONTROLS,
      cursorControls: RIG.CURSOR_CONTROLS,
      expr: EXPR,
      labels: settings.labels
    };
    for (var k in extra) if (extra.hasOwnProperty(k)) a[k] = extra[k];
    return a;
  }

  /* ---------------- toast ---------------- */

  var toastTimer = null;
  function toast(text, kind) {
    var t = $("toast");
    $("toastText").textContent = text;
    t.className = "toast" + (kind === "bad" ? " toast--bad" : (kind === "warn" ? " toast--warn" : ""));
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { t.className = "toast hidden"; }, kind === "bad" ? 7000 : 3800);
  }

  function report(res, okText) {
    if (!res.ok) {
      toast(res.msg || "Something went wrong.", "bad");
      return false;
    }
    var notes = [];
    if (res.skipped && res.skipped.length) notes.push(res.skipped.join("; "));
    if (res.problems && res.problems.length) notes.push(res.problems.join("; "));
    if (notes.length) toast(okText + " " + notes.join(" | "), "warn");
    else toast(okText, "ok");
    return true;
  }

  /* ---------------- presets ---------------- */

  function presetList(kind) {
    var builtIn = kind === "typing" ? RIG.TYPING_PRESETS : RIG.CURSOR_PRESETS;
    var out = [];
    var i;
    for (i = 0; i < builtIn.length; i++) out.push({ id: "b:" + builtIn[i].name, name: builtIn[i].name, values: builtIn[i].values, builtIn: true });
    var mine = saved[kind];
    for (i = 0; i < mine.length; i++) out.push({ id: "u:" + mine[i].name, name: mine[i].name, values: mine[i].values, builtIn: false });
    return out;
  }

  function findPreset(kind, id) {
    var list = presetList(kind);
    for (var i = 0; i < list.length; i++) if (list[i].id === id) return list[i];
    return list[0];
  }

  function fillPresetSelect(sel, kind, value, withNone) {
    sel.innerHTML = "";
    if (withNone) {
      var none = document.createElement("option");
      none.value = "none";
      none.textContent = "No cursor";
      sel.appendChild(none);
    }
    var list = presetList(kind);
    var groups = { b: null, u: null };
    for (var i = 0; i < list.length; i++) {
      var key = list[i].builtIn ? "b" : "u";
      if (!groups[key]) {
        groups[key] = document.createElement("optgroup");
        groups[key].label = list[i].builtIn ? "Built in" : "Saved";
        sel.appendChild(groups[key]);
      }
      var o = document.createElement("option");
      o.value = list[i].id;
      o.textContent = list[i].name;
      groups[key].appendChild(o);
    }
    sel.value = value;
    if (sel.value !== value) sel.value = withNone ? "none" : list[0].id;
  }

  function renderPresets() {
    fillPresetSelect($("createTyping"), "typing", settings.typingPreset, false);
    fillPresetSelect($("typingPreset"), "typing", settings.typingPreset, false);
    fillPresetSelect($("createCursor"), "cursor", settings.createCursor, true);
    fillPresetSelect($("cursorPreset"), "cursor", settings.cursorPreset, false);
    $("btnDeleteTyping").classList.toggle("hidden", settings.typingPreset.indexOf("u:") !== 0);
    $("btnDeleteCursor").classList.toggle("hidden", settings.cursorPreset.indexOf("u:") !== 0);
    renderCursorPreviews();
    drawRhythm();
  }

  /* ---------------- rig type ---------------- */

  var NOTES = {
    dynamic: {
      pro: ["Wraps word by word", "Re-centres as it types", "Text edits need no refresh"],
      con: ["One font style", "Adds a hidden guide layer"]
    },
    stable: {
      pro: ["Mixed fonts and colours", "No extra layers"],
      con: ["Layout fixed while typing", "Refresh after text edits"]
    }
  };

  function renderRigType() {
    var btns = $("rigType").querySelectorAll(".seg-btn");
    for (var i = 0; i < btns.length; i++) btns[i].classList.toggle("is-on", btns[i].getAttribute("data-value") === settings.rigType);
    var n = NOTES[settings.rigType];
    var box = $("rigNotes");
    box.innerHTML = "";
    var j;
    for (j = 0; j < n.pro.length; j++) box.appendChild(chip(n.pro[j], "pro"));
    for (j = 0; j < n.con.length; j++) box.appendChild(chip(n.con[j], "con"));
  }

  function chip(text, kind) {
    var s = document.createElement("span");
    s.className = "chip chip--" + kind;
    s.textContent = (kind === "pro" ? "+ " : "– ") + text;
    return s;
  }

  /* ---------------- selection ---------------- */

  var info = { comp: null, layers: [] };

  function firstRig() {
    for (var i = 0; i < info.layers.length; i++) if (info.layers[i].rig) return info.layers[i];
    return null;
  }

  function renderStatus() {
    var st = $("status");
    var title = $("statusTitle");
    var sub = $("statusSub");
    var fill = $("statusMeterFill");
    var layers = info.layers || [];
    var rig = firstRig();
    st.className = "status";
    fill.style.width = "0";
    if (!info.comp) {
      title.textContent = "Open a composition";
      sub.textContent = "Then select one or more text layers.";
    } else if (!layers.length) {
      title.textContent = "Select a text layer";
      sub.textContent = info.otherSelected ? "The selected layers are not text layers." : "In “" + info.comp + "”.";
    } else if (rig) {
      st.className = "status " + (rig.baked ? "status--baked" : "status--rig");
      title.textContent = rig.name + (layers.length > 1 ? "  +" + (layers.length - 1) + " more" : "");
      var kind = rig.rig === "dynamic" ? "Dynamic" : "Stable";
      sub.textContent = rig.needsRefresh ? "⚠ The text or its style changed: click here to refresh the cursor." :
        kind + " rig" + (rig.baked ? " · baked" : "") + (rig.cursor ? " · cursor" : "") +
        (rig.length !== undefined ? " · " + (rig.shown || 0) + " / " + rig.length + " characters" : "");
      if (rig.needsRefresh) st.className += " status--refresh";
      if (rig.length) fill.style.width = Math.min(100, Math.round((rig.shown || 0) / rig.length * 100)) + "%";
    } else {
      st.className = "status status--text";
      title.textContent = layers[0].name + (layers.length > 1 ? "  +" + (layers.length - 1) + " more" : "");
      sub.textContent = "Text layer, no rig yet.";
    }
    var eng = $("enginePill");
    var legacy = info.engine === "extendscript";
    eng.textContent = legacy ? "Legacy JS" : "JS";
    eng.className = "pill" + (legacy ? " pill--legacy" : "");
    eng.title = legacy ? "This project uses the Legacy ExtendScript expression engine. LazyTyper works with it, but the JavaScript engine (File > Project Settings > Expressions) is several times faster." :
      "Expression engine: JavaScript";
    $("bakeLabel").textContent = rig && rig.baked ? "Unbake" : "Bake";
    $("btnRefresh").classList.toggle("is-attention", !!(rig && rig.needsRefresh));
    var hasRig = !!rig;
    var hasText = layers.length > 0;
    $("cardCreate").classList.toggle("is-disabled", !hasText);
    $("cardTimeline").classList.toggle("is-disabled", !hasRig);
    $("cardRig").classList.toggle("is-disabled", !hasRig);
    $("btnApplyTyping").classList.toggle("is-disabled", !hasRig);
    $("btnAddCursor").classList.toggle("hidden", !(rig && !rig.cursor));
    $("speedHint").textContent = rig ? "for " + rig.name : (hasText ? "for " + layers[0].name : "");
    drawRhythm();
  }

  /*
   * The panel only asks After Effects what is selected while someone is using it: when the
   * pointer comes in, every POLL_MS while it stays, and after each action. A call that lands
   * while After Effects is switching projects can make it show "internal verification failure",
   * and one that runs while an automation script arrives makes it refuse that script, so it
   * never polls in the background.
   */
  var POLL_MS = 1200;
  var pointerInside = false;
  var lastInfo = "";
  function poll() {
    if (busy > 0) return;
    host("selectionInfo", { detail: true }, function (res) {
      if (!res.ok) return;
      var key = JSON.stringify(res);
      if (key === lastInfo) return;
      lastInfo = key;
      info = res;
      renderStatus();
    });
  }

  /* ---------------- rhythm preview ---------------- */

  var SAMPLE = "Hello there! This is how the typing will feel, word by word.";

  function classOf(c) {
    if (c === " " || c === "\r" || c === "\n" || c === "\t" || c === "\u0003") return "spaces";
    if (c >= "0" && c <= "9") return "numbers";
    if (c.toLowerCase() !== c.toUpperCase() || c.charCodeAt(0) > 127) return "letters";
    return "punct";
  }

  var CLASS_COLORS = { letters: "#a78bfa", numbers: "#fbbf24", punct: "#f472b6", spaces: "#34d399" };

  function drawRhythm() {
    var canvas = $("rhythmCanvas");
    if (!canvas || !canvas.getContext) return;
    var preset = findPreset("typing", $("typingPreset").value || settings.typingPreset);
    var values = {};
    var i;
    for (i = 0; i < RIG.TEXT_CONTROLS.length; i++) values[RIG.TEXT_CONTROLS[i].name] = RIG.TEXT_CONTROLS[i].value;
    for (var k in preset.values) if (preset.values.hasOwnProperty(k)) values[k] = preset.values[k];
    var layer = firstRig() || (info.layers && info.layers[0]);
    var text = layer && layer.text ? layer.text : SAMPLE;
    var fps = info.fps || 30;
    var fd = 1 / fps;
    var ev = window.lazyTyperRun({
      time: Math.max(10, text.length * 2), fd: fd, start: 0, record: true, pauses: [],
      num: function (n) { return values[n]; },
      text: function () { return text; }
    });
    var ratio = window.devicePixelRatio || 1;
    var w = canvas.clientWidth || 300;
    var h = canvas.clientHeight || 44;
    canvas.width = Math.round(w * ratio);
    canvas.height = Math.round(h * ratio);
    var ctx = canvas.getContext("2d");
    ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
    ctx.clearRect(0, 0, w, h);
    if (!ev.length) return;
    var end = ev[ev.length - 1][0] || 1;
    // Baseline and second ticks.
    ctx.fillStyle = "#312c48";
    ctx.fillRect(0, h - 10, w, 1);
    ctx.fillStyle = "#8d87a8";
    ctx.font = "9px Segoe UI, sans-serif";
    var step = end > 20 ? 5 : (end > 8 ? 2 : 1);
    for (var s = 0; s <= end; s += step) {
      var sx = Math.round(s / end * (w - 4)) + 2;
      ctx.fillRect(sx, h - 12, 1, 4);
      if (s > 0 && sx < w - 14) ctx.fillText(s + "s", sx + 2, h - 1);
    }
    // One bar per keystroke: taller after a longer wait.
    var prevT = 0;
    for (i = 0; i < ev.length; i++) {
      var t = ev[i][0];
      var kk = ev[i][1];
      var c = text.charAt(kk - 1);
      var wait = i === 0 ? 0 : t - prevT;
      prevT = t;
      var bh = Math.max(4, Math.min(h - 14, 6 + wait * 60));
      var x = Math.round(t / end * (w - 4)) + 2;
      ctx.fillStyle = CLASS_COLORS[classOf(c)];
      ctx.fillRect(x - 1, h - 11 - bh, 2, bh);
    }
    var secs = end;
    $("rhythmTotal").textContent = (layer && layer.text ? "" : "sample · ") + secs.toFixed(1) + " s · " +
      Math.round(text.length / Math.max(0.01, secs)) + " char/s";
  }

  /* ---------------- cursor previews ---------------- */

  function renderCursorPreviews() {
    var box = $("cursorPreviews");
    box.innerHTML = "";
    var list = presetList("cursor");
    for (var i = 0; i < list.length && i < 6; i++) {
      var p = list[i];
      var v = p.values;
      var el = document.createElement("div");
      el.className = "cursor-chip" + (settings.cursorPreset === p.id ? " is-on" : "");
      var sample = document.createElement("div");
      sample.className = "cursor-sample";
      sample.appendChild(document.createTextNode("Ab"));
      var caret = document.createElement("i");
      var size = 18;
      var top = v.Top / 100 * size;
      var bottom = v.Bottom / 100 * size;
      caret.style.width = Math.max(1.5, v.Width / 100 * size) + "px";
      caret.style.height = Math.max(1.5, Math.abs(top + bottom)) + "px";
      caret.style.marginBottom = (-Math.max(bottom, -top) + 3) + "px";
      caret.style.borderRadius = Math.min(4, (v.Roundness || 0) / 100 * 4) + "px";
      if (v["Cursor Opacity"] !== undefined) caret.style.opacity = "";
      sample.appendChild(caret);
      var name = document.createElement("div");
      name.className = "cursor-name";
      name.textContent = p.name;
      el.appendChild(sample);
      el.appendChild(name);
      el.setAttribute("data-id", p.id);
      el.addEventListener("click", onCursorChip);
      box.appendChild(el);
    }
  }

  function onCursorChip(e) {
    var id = e.currentTarget.getAttribute("data-id");
    settings.cursorPreset = id;
    persistSettings();
    renderPresets();
  }

  /* ---------------- settings: key colours ---------------- */

  var LABEL_ROWS = [
    { key: "letters", name: "Letters" },
    { key: "numbers", name: "Numbers" },
    { key: "punctuation", name: "Punctuation" },
    { key: "spaces", name: "Spaces" },
    { key: "deleting", name: "Deleting" }
  ];

  function renderLabels() {
    var grid = $("labelGrid");
    grid.innerHTML = "";
    for (var i = 0; i < LABEL_ROWS.length; i++) {
      var row = LABEL_ROWS[i];
      var name = document.createElement("div");
      name.className = "lg-name";
      var sw = document.createElement("i");
      sw.style.background = RIG.LABEL_HEX[settings.labels[row.key]] || "#555";
      name.appendChild(sw);
      name.appendChild(document.createTextNode(row.name));
      var sel = document.createElement("select");
      for (var l = 0; l < RIG.LABELS.length; l++) {
        var o = document.createElement("option");
        o.value = String(l);
        o.textContent = RIG.LABELS[l];
        sel.appendChild(o);
      }
      sel.value = String(settings.labels[row.key]);
      sel.setAttribute("data-key", row.key);
      sel.addEventListener("change", onLabelChange);
      grid.appendChild(name);
      grid.appendChild(sel);
    }
  }

  function onLabelChange(e) {
    settings.labels[e.target.getAttribute("data-key")] = parseInt(e.target.value, 10);
    persistSettings();
    renderLabels();
  }

  /* ---------------- actions ---------------- */

  function withBusy(btn, fn) {
    if (btn.classList.contains("is-busy")) return;
    btn.classList.add("is-busy");
    fn(function () {
      btn.classList.remove("is-busy");
      lastInfo = "";
      poll();
    });
  }

  function onCreate() {
    var typing = findPreset("typing", $("createTyping").value);
    var cursorId = $("createCursor").value;
    var cursor = cursorId === "none" ? null : findPreset("cursor", cursorId);
    withBusy($("btnCreate"), function (done) {
      host("createRig", rigArgs({
        type: settings.rigType,
        typing: typing.values,
        cursor: !!cursor,
        cursorValues: cursor ? cursor.values : {}
      }), function (res) {
        if (res.ok && !res.made.length) {
          toast(res.skipped.length ? res.skipped.join("; ") : "Nothing to rig.", "warn");
        } else {
          report(res, "Rigged " + (res.made || []).join(", ") + ".");
        }
        done();
      });
    });
  }

  function simple(btnId, call, extra, okText) {
    withBusy($(btnId), function (done) {
      host(call, rigArgs(extra || {}), function (res) {
        report(res, typeof okText === "function" ? okText(res) : okText);
        done();
      });
    });
  }

  function onBake(e) {
    var rig = firstRig();
    var unbake = e.shiftKey || (rig && rig.baked);
    if (unbake) {
      simple("btnBake", "unbake", {}, "Back to live typing. Keyframe timing changes are gone.");
    } else {
      simple("btnBake", "bake", {}, function (res) {
        return "Baked " + (res.done || []).join(", ") + ". Shift+click Bake to unbake.";
      });
    }
  }

  function onApplyTyping() {
    var p = findPreset("typing", $("typingPreset").value);
    simple("btnApplyTyping", "applyValues", { kind: "typing", values: p.values }, "Applied “" + p.name + "”.");
  }

  function onApplyCursor() {
    var p = findPreset("cursor", $("cursorPreset").value);
    simple("btnApplyCursor", "applyValues", { kind: "cursor", values: p.values }, "Cursor set to “" + p.name + "”.");
  }

  function onAddCursor() {
    var p = findPreset("cursor", settings.cursorPreset);
    simple("btnAddCursor", "addCursor", { cursorValues: p.values }, "Cursor added.");
  }

  function openSave(kind) {
    var row = $(kind === "typing" ? "saveTypingRow" : "saveCursorRow");
    row.classList.remove("hidden");
    var input = $(kind === "typing" ? "saveTypingName" : "saveCursorName");
    input.value = "";
    input.focus();
  }

  function closeSave(kind) {
    $(kind === "typing" ? "saveTypingRow" : "saveCursorRow").classList.add("hidden");
  }

  function doSave(kind) {
    var input = $(kind === "typing" ? "saveTypingName" : "saveCursorName");
    var name = input.value.replace(/^\s+|\s+$/g, "");
    if (!name) {
      toast("Give the preset a name.", "warn");
      return;
    }
    var keys = kind === "typing" ? RIG.TYPING_PRESET_KEYS : RIG.CURSOR_PRESET_KEYS;
    host("readValues", { kind: kind, keys: keys }, function (res) {
      if (!res.ok) {
        toast(res.msg, "bad");
        return;
      }
      var list = saved[kind];
      var replaced = false;
      for (var i = 0; i < list.length; i++) {
        if (list[i].name === name) {
          list[i].values = res.values;
          replaced = true;
        }
      }
      if (!replaced) list.push({ name: name, values: res.values });
      if (saveJson("presets.json", saved)) {
        if (kind === "typing") settings.typingPreset = "u:" + name;
        else settings.cursorPreset = "u:" + name;
        persistSettings();
        renderPresets();
        closeSave(kind);
        toast((replaced ? "Updated" : "Saved") + " “" + name + "” from " + res.layer + ".", "ok");
      }
    });
  }

  function doDelete(kind) {
    var id = kind === "typing" ? settings.typingPreset : settings.cursorPreset;
    if (id.indexOf("u:") !== 0) return;
    var name = id.substr(2);
    var list = saved[kind];
    for (var i = list.length - 1; i >= 0; i--) if (list[i].name === name) list.splice(i, 1);
    saveJson("presets.json", saved);
    if (kind === "typing") settings.typingPreset = "b:Average";
    else settings.cursorPreset = "b:Vertical";
    persistSettings();
    renderPresets();
    toast("Deleted “" + name + "”.", "ok");
  }

  function num(id, fallback) {
    var v = parseInt($(id).value, 10);
    return isFinite(v) && v > 0 ? v : fallback;
  }

  /* ---------------- wiring ---------------- */

  function on(id, ev, fn) { $(id).addEventListener(ev, fn); }

  function wire() {
    var segs = $("rigType").querySelectorAll(".seg-btn");
    for (var i = 0; i < segs.length; i++) {
      segs[i].addEventListener("click", function (e) {
        settings.rigType = e.currentTarget.getAttribute("data-value");
        persistSettings();
        renderRigType();
      });
    }
    on("createTyping", "change", function (e) {
      settings.typingPreset = e.target.value;
      persistSettings();
      renderPresets();
    });
    on("typingPreset", "change", function (e) {
      settings.typingPreset = e.target.value;
      persistSettings();
      renderPresets();
    });
    on("createCursor", "change", function (e) {
      settings.createCursor = e.target.value;
      persistSettings();
    });
    on("cursorPreset", "change", function (e) {
      settings.cursorPreset = e.target.value;
      persistSettings();
      renderPresets();
    });
    on("btnCreate", "click", onCreate);
    on("btnApplyTyping", "click", onApplyTyping);
    on("btnSaveTyping", "click", function () { openSave("typing"); });
    on("btnSaveTypingOk", "click", function () { doSave("typing"); });
    on("btnSaveTypingCancel", "click", function () { closeSave("typing"); });
    on("saveTypingName", "keydown", function (e) { if (e.keyCode === 13) doSave("typing"); if (e.keyCode === 27) closeSave("typing"); });
    on("btnDeleteTyping", "click", function () { doDelete("typing"); });
    on("btnApplyCursor", "click", onApplyCursor);
    on("btnAddCursor", "click", onAddCursor);
    on("btnSaveCursor", "click", function () { openSave("cursor"); });
    on("btnSaveCursorOk", "click", function () { doSave("cursor"); });
    on("btnSaveCursorCancel", "click", function () { closeSave("cursor"); });
    on("saveCursorName", "keydown", function (e) { if (e.keyCode === 13) doSave("cursor"); if (e.keyCode === 27) closeSave("cursor"); });
    on("btnDeleteCursor", "click", function () { doDelete("cursor"); });
    on("btnStart", "click", function () { simple("btnStart", "startHere", {}, "Typing starts here."); });
    on("btnStop", "click", function () { simple("btnStop", "stopHere", {}, "Typing stops here."); });
    on("btnPause", "click", function () {
      var f = num("pauseFrames", 15);
      simple("btnPause", "pauseHere", { frames: f }, "Pause of " + f + " frames added (a layer marker; drag its end to change it).");
    });
    on("eraseWhat", "change", function () {
      var some = $("eraseWhat").value === "some";
      $("eraseChars").classList.toggle("hidden", !some);
      $("eraseCharsLabel").textContent = some ? "characters" : "";
      $("eraseCharsLabel").classList.toggle("hidden", !some);
    });
    on("btnErase", "click", function () {
      var all = $("eraseWhat").value === "all";
      var chars = num("eraseChars", 5);
      var frames = num("eraseFrames", 12);
      simple("btnErase", "eraseHere", { all: all, chars: chars, frames: frames },
        "Typing stops here and " + (all ? "everything" : "the last " + chars + " characters") +
        " backspace away over " + frames + " frames. Start typing again later to type on.");
    });
    on("btnRefresh", "click", function () {
      simple("btnRefresh", "refreshRig", {}, function (res) { return "Refreshed " + (res.done || []).join(", ") + "."; });
    });
    on("btnBake", "click", onBake);
    on("status", "click", function () {
      var rig = firstRig();
      if (rig && rig.needsRefresh) $("btnRefresh").click();
    });
    on("btnRemove", "click", function () {
      simple("btnRemove", "removeRig", {}, function (res) { return "Removed the rig from " + (res.done || []).join(", ") + "."; });
    });
    on("settingsToggle", "click", function () {
      var body = $("settingsBody");
      body.classList.toggle("hidden");
      $("settingsChev").innerHTML = body.classList.contains("hidden") ? "&#9662;" : "&#9652;";
    });
    on("footLink", "click", function (e) {
      e.preventDefault();
      if (inCep) cs.openURLInDefaultBrowser("https://raisulsohan.com");
      else window.open("https://raisulsohan.com");
    });
    window.addEventListener("resize", drawRhythm);
    if (inCep) {
      try {
        var hostPath = cs.getSystemPath(SystemPath.EXTENSION).replace(/\\/g, "/") + "/host/host.jsx";
        cs.evalScript("$.evalFile(" + JSON.stringify(hostPath) + ")");
      } catch (e) {}
      try {
        cs.addEventListener("com.adobe.csxs.events.WindowVisibilityChanged", function () { lastInfo = ""; poll(); });
      } catch (e2) {}
    }
  }

  /* ---------------- browser preview (outside After Effects) ---------------- */

  function mockHost(name, a) {
    if (name === "selectionInfo") {
      return {
        ok: true, comp: "Title Card", fps: 30, time: 1.2, engine: "javascript-1.0", otherSelected: 0,
        layers: [{ name: "Headline", index: 2, rig: "dynamic", baked: false, cursor: true, shown: 21, length: 48,
          text: "Natural typing, without the robotic rhythm. 2026!" }]
      };
    }
    if (name === "readValues") {
      var v = {};
      for (var i = 0; i < a.keys.length; i++) v[a.keys[i]] = 1;
      return { ok: true, values: v, layer: "Headline" };
    }
    if (name === "createRig") return { ok: true, made: ["Headline"], skipped: [], problems: [] };
    return { ok: true, done: ["Headline"] };
  }

  /* ---------------- start ---------------- */

  /* For tests and the browser preview. */
  window.LazyTyperPanel = {
    info: function () { return info; },
    busy: function () { return busy; },
    poll: function () { lastInfo = ""; poll(); },
    settings: settings
  };

  $("footVersion").textContent = "LazyTyper " + RIG.VERSION;
  wire();
  renderRigType();
  renderPresets();
  renderLabels();
  renderStatus();
  poll();
  document.documentElement.addEventListener("mouseenter", function () {
    pointerInside = true;
    poll();
  });
  document.documentElement.addEventListener("mouseleave", function () { pointerInside = false; });
  window.addEventListener("focus", function () { poll(); });
  setInterval(function () { if (pointerInside) poll(); }, POLL_MS);
})();
