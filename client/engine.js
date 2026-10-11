/*
 * LazyTyper timing engine.
 *
 * One function, lazyTyperRun(io), decides how many characters of a text layer
 * are showing at a given time. The panel copies its source (through
 * Function.prototype.toString) into the rig's expressions, the Node tests call
 * it directly, and the bake step runs it once with io.record set to get every
 * keystroke. So it must stay plain ES3: it runs in After Effects' legacy
 * ExtendScript expression engine as well as the JavaScript one. No let/const,
 * arrow functions, Array.prototype.indexOf, forEach, JSON, getters or trailing
 * commas, and only full-line comments inside the function (the expression
 * builder strips them).
 *
 * io = {
 *   time:   the time to answer for (seconds),
 *   fd:     the comp's frame duration,
 *   start:  when the layer starts (typing never runs before it),
 *   num:    function (controlName, t) -> number (a control's value at t),
 *   text:   function (t) -> string (the full text at t, before any expression),
 *   pauses: [[from, to], ...] times when typing waits (pause markers),
 *   record: true to get [[frameTime, count], ...] for every change instead of the count
 * }
 * Every field must be set: the legacy expression engine throws on reading a missing one.
 *
 * Typing model. Every character waits a number of frames before it appears:
 * the base speed (Frames Per Character, or Total Duration shared out over the
 * text) times a weight that the slow down / speed up controls and Variance
 * set from the character and its neighbours. Typing only runs while the
 * Typing checkbox is on and no pause marker covers the frame; the first
 * character of each run appears at once. The characters shown are
 * Start at Character + characters typed so far, kept between 0 and the text
 * length, so lowering Start at Character while typing is off deletes text and
 * typing on later continues from wherever the text is.
 */
function lazyTyperRun(io) {
  var fd = io.fd > 0 ? io.fd : 1 / 30;
  var num = io.num;
  var pauses = io.pauses;
  var PUNCT = ".,;:!?'\"-()[]\u2026\u2014\u2013\u2018\u2019\u201C\u201D\u00BF\u00A1\u0964\u0965\u060C\u061F\u3001\u3002";
  var SYM = "@#$%^&*_+=<>{}|\\/~`";
  var AFTER = ",;:\u060C\u3001";
  var ENDS = ".!?\u0964\u0965\u061F\u3002";
  var PAIRS = ",th,he,in,er,an,re,on,at,en,nd,ti,es,or,te,of,ed,is,it,al,ar,st,to,nt,ng,se,ha,as,ou,io,le,ve,co,me,de,hi,ri,ro,ic,ne,ea,ra,ce,";
  var WORDS = ",the,and,to,of,a,in,is,it,you,that,for,on,with,as,was,i,be,at,this,have,are,he,she,we,they,but,not,or,my,your,so,if,do,can,will,just,all,an,by,from,";
  var LEFT = "qwertasdfgzxcvb";
  var RIGHT = "yuiophjklnm";
  var FINGERS = "qaz wsx edc rfvtgb yhnujm ik ol p";

  function isNL(c) { return c === "\r" || c === "\n" || c === "\u0003" || c === "\u2028" || c === "\u2029"; }
  function isSpace(c) { return c === " " || c === "\t" || c === "\u00A0" || c === "\u3000" || c === "\u2009"; }
  function isDigit(c) { return c >= "0" && c <= "9"; }
  function isPunct(c) { return c !== "" && PUNCT.indexOf(c) >= 0; }
  function isSym(c) { return c !== "" && SYM.indexOf(c) >= 0; }
  function isLetter(c) {
    if (c === "") return false;
    if (c.toLowerCase() !== c.toUpperCase()) return true;
    return c > "\u007F" && !isSpace(c) && !isNL(c) && !isPunct(c) && !isSym(c);
  }
  function isWord(c) { return isLetter(c) || isDigit(c); }
  function hand(c) {
    if (c === "") return -1;
    if (LEFT.indexOf(c) >= 0) return 0;
    if (RIGHT.indexOf(c) >= 0) return 1;
    return -1;
  }
  // QWERTY touch typing: which finger types a lower-case letter (FINGERS lists each finger's
  // letters, left little finger first), or -1.
  function finger(c) {
    if (c === "" || c === " ") return -1;
    var at = FINGERS.indexOf(c);
    return at < 0 ? -1 : FINGERS.substring(0, at).split(" ").length;
  }
  // The last character of s that is not a space or line break, or -1.
  function lastKey(s) {
    var k = s.length - 1;
    while (k >= 0 && (isSpace(s.charAt(k)) || isNL(s.charAt(k)))) k--;
    return k;
  }
  function rnd(i, seed) {
    var x = Math.sin(i * 12.9898 + seed * 78.233 + 1.618) * 43758.5453;
    return x - Math.floor(x);
  }
  function clamp(v, lo, hi) { return v < lo ? lo : (v > hi ? hi : v); }
  function on(t) {
    if (num("Typing", t) < 0.5) return false;
    for (var p = 0; p < pauses.length; p++) {
      if (t >= pauses[p][0] - 1e-6 && t < pauses[p][1] - 1e-6) return false;
    }
    return true;
  }

  // How much longer (>1) or shorter (<1) than the base speed character i of s takes.
  function weight(s, i, t) {
    var c = s.charAt(i);
    var p = i > 0 ? s.charAt(i - 1) : "";
    var lc = c.toLowerCase();
    var w = 1;
    function slow(name, scale) { var v = num(name, t) / 100 * scale; if (v > 0) w *= 1 + v; }
    function fast(name, scale) { var v = num(name, t) / 100 * scale; if (v > 0) w /= 1 + v; }
    function either(name, scale) {
      var v = num(name, t) / 100 * scale;
      if (v > 0) w *= 1 + v;
      else if (v < 0) w /= 1 - v;
    }
    // A Fast: control that also goes the other way: below 0 it slows down.
    function fastOrSlow(name) {
      var v = num(name, t) / 100;
      if (v > 0) w /= 1 + v;
      else if (v < 0) w *= 1 - v;
    }
    // A Slow: control on a character that follows one of its kind (the A of NASA, the 0 of
    // 2026): the "in a row" control takes that share (0 to 100 %) of the slow-down away.
    function slowInRow(name, inRow, follows) {
      var v = num(name, t) / 100;
      if (!(v > 0)) return;
      if (follows) {
        var off = clamp(num(inRow, t) / 100, 0, 1);
        if (off > 0) v *= 1 - off;
      }
      w *= 1 + v;
    }
    var ws = i, we = i;
    if (isWord(c)) {
      while (ws > 0 && isWord(s.charAt(ws - 1))) ws--;
      while (we < s.length && isWord(s.charAt(we))) we++;
    }
    var wordLen = we - ws;
    var inWord = i - ws;
    var lp = p.toLowerCase();

    if (isLetter(c) && c !== lc) slowInRow("Slow: Capitals", "Fast: Capitals in a Row", isLetter(p) && p !== lp);
    if (isDigit(c)) slowInRow("Slow: Numbers", "Fast: Numbers in a Row", isDigit(p));
    if (isSym(c)) slow("Slow: Symbols", 1);
    if (isPunct(c)) slow("Slow: Punctuation", 1);
    if (p !== "" && AFTER.indexOf(p) >= 0) slow("Slow: After Punctuation", 1);
    if (p !== "" && ENDS.indexOf(p) >= 0) slow("Slow: Sentence End", 1);
    if (i === lastKey(s)) slow("Slow: Last Character", 1);
    // A line break in three stages: the wait before Return, the wait after it (before the
    // next line's first key), and each Return more in a row (an empty line).
    if (isNL(c) && !isNL(p)) slow("Slow: Before Line Break", 1);
    if (p !== "" && isNL(p)) slow("Slow: New Line", 1);
    if (isWord(c) && inWord === 0) slow("Slow: Word Start", 1);
    if (isLetter(c) && wordLen > 6) slow("Slow: Long Words", Math.min(1, (wordLen - 6) / 6));
    if ("qzxjkv".indexOf(lc) >= 0 && lc !== "") slow("Slow: Rare Letters", 1);
    if (isLetter(c) && isLetter(p) && lc !== lp && finger(lc) >= 0 && finger(lc) === finger(lp)) slow("Slow: Same Finger", 1);

    if (isLetter(c) && p !== "" && lc === lp) fastOrSlow("Fast: Repeated Letters");
    if (isLetter(c) && isLetter(p) && PAIRS.indexOf("," + (p + c).toLowerCase() + ",") >= 0) fast("Fast: Common Pairs", 1);
    if (isWord(c) && WORDS.indexOf("," + s.substring(ws, we).toLowerCase() + ",") >= 0) fast("Fast: Common Words", 1);
    if (isLetter(c) && inWord >= 2) fast("Fast: Word Momentum", Math.min(1, (inWord - 1) / 4));

    if (isSpace(c)) either("Slow/Fast: Spaces", 1);
    if (isNL(c) && p !== "" && isNL(p)) either("Slow/Fast: Empty Lines", 1);
    if (isLetter(c) && isLetter(p) && hand(lc) >= 0 && hand(lc) === hand(p.toLowerCase())) either("Slow/Fast: Same Hand", 1);
    if (s.length > 1) either("Slow/Fast: Fatigue", i / (s.length - 1));

    var variance = num("Variance", t) / 100;
    if (variance > 0) {
      var seed = num("Random Seed", t);
      if (rnd(i, seed) < variance) w *= 1.25 + 1.25 * rnd(i + 0.37, seed);
    }
    return w;
  }

  var tdMode = false;
  var unit = 1;
  // Frames to wait before character i of s appears.
  function frames(s, i, t) {
    var base = tdMode ? unit : num("Frames Per Character", t);
    return Math.max(0.02, base * weight(s, i, t));
  }

  var typed = 0;
  var acc = 0;
  var need = -1;
  var needFor = -1;
  var needText = null;
  var running = false;
  var shown = -1;
  var log = [];
  var start = io.start;
  var n = Math.floor((io.time - start) / fd + 1e-4);
  if (n < 0) n = -1;

  for (var f = 0; f <= n; f++) {
    var t = start + f * fd;
    var s = io.text(t);
    var len = s.length;
    var startAt = Math.round(num("Start at Character", t));
    var pos = clamp(startAt + typed, 0, len);
    if (!on(t)) {
      running = false;
      acc = 0;
      need = -1;
    } else if (pos < len) {
      if (!running) {
        running = true;
        tdMode = Math.round(num("Speed Mode", t)) === 2;
        if (tdMode) {
          // The run's first character appears at once, so the duration covers the rest.
          var total = 0;
          for (var q = pos + 1; q < len; q++) total += weight(s, q, t);
          unit = Math.max(0, num("Total Duration", t)) / Math.max(1e-6, total);
        }
        need = -1;
        acc = 1e9;
      } else {
        acc += 1;
      }
      var guard = 0;
      while (pos < len && guard < 100000) {
        guard++;
        if (need < 0 || needFor !== pos || needText !== s) {
          need = frames(s, pos, t);
          needFor = pos;
          needText = s;
        }
        if (acc >= 1e8) {
          acc = 0;
        } else if (acc + 1e-9 < need) {
          break;
        } else {
          acc -= need;
        }
        typed++;
        pos++;
        need = -1;
      }
    } else {
      acc = 0;
      need = -1;
    }
    if (io.record) {
      var now = clamp(startAt + typed, 0, len);
      if (now !== shown) {
        log.push([t, now]);
        shown = now;
      }
    }
  }
  if (io.record) return log;
  var last = io.text(io.time);
  if (n < 0) return clamp(Math.round(num("Start at Character", io.time)), 0, last.length);
  return clamp(Math.round(num("Start at Character", io.time)) + typed, 0, last.length);
}

if (typeof window !== "undefined") window.lazyTyperRun = lazyTyperRun;
if (typeof module !== "undefined" && module.exports) module.exports = { lazyTyperRun: lazyTyperRun };
