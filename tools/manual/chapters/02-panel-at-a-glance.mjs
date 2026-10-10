// Chapter 2: the panel at a glance: every part, the status line in each state, the engine pill,
// the three kinds of toast, Settings.
import { BG, WHITE, rig } from "../scenes.mjs";

export async function run(s) {
  const states = [];
  await s.info((i) => !i.comp, "no comp open");
  states.push(await s.shot("02-status-no-comp", { clip: "status", keep: false }));
  await s.scene({
    name: "Title Card", width: 1280, height: 400, duration: 6, fps: 30, bg: BG,
    texts: [{ name: "Headline", text: "Natural typing, in one click.", font: "SegoeUI", size: 64, color: WHITE, pos: [110, 220] }],
    shapes: [{ name: "Underline", size: [600, 6], pos: [410, 260], color: [0.65, 0.55, 0.98] }]
  });
  await s.select([], 1);
  await s.info((i) => i.comp && !i.layers.length && !i.otherSelected, "nothing selected");
  states.push(await s.shot("02-status-comp", { clip: "status", keep: false }));
  await s.select(["Underline"], 1);
  await s.info((i) => i.otherSelected > 0, "a shape layer selected");
  states.push(await s.shot("02-status-other", { clip: "status", keep: false }));
  await s.select(["Headline"], 1);
  await s.info((i) => i.layers.length === 1 && !i.layers[0].rig, "text layer without rig");
  states.push(await s.shot("02-status-text", { clip: "status", keep: false }));
  await s.shot("02-panel-no-rig");

  await rig(s, ["Headline"], { time: 1 });
  await s.select(["Headline"], 1);
  await s.info((i) => i.layers[0].rig === "dynamic", "rigged");
  states.push(await s.shot("02-status-rig", { clip: "status", keep: false }));
  await s.shot("02-panel", { mark: [".brand", "enginePill", "status", "cardCreate", "cardSpeed", "cardTimeline", "cardRig", "cardCursor", "cardSettings"] });

  // Three toasts, from real actions.
  const toasts = [];
  await s.set("typingPreset", "b:Average");
  await s.click("btnApplyTyping");
  toasts.push(await s.shot("02-toast-ok", { clip: "toast", margin: 0, keep: false }));
  await s.hideToast();
  const warn = await s.click("btnCreate");
  if (!/already has a rig/.test(warn)) throw new Error(`warn toast: ${warn}`);
  toasts.push(await s.shot("02-toast-warn", { clip: "toast", margin: 0, keep: false }));
  await s.hideToast();

  // Baked state.
  await s.click("btnBake");
  await s.hideToast();
  await s.select(["Headline"], 1);
  await s.info((i) => i.layers[0].baked, "baked");
  states.push(await s.shot("02-status-baked", { clip: "status", keep: false }));
  await s.click("btnBake", { shift: true });
  await s.hideToast();

  // Needs a Refresh: the font size changed after the cursor was measured.
  await s.textDoc("Headline", { fontSize: 90 });
  await s.select(["Headline"], 1);
  await s.info((i) => i.layers[0].needsRefresh, "needs refresh");
  states.push(await s.shot("02-status-refresh", { clip: "status", keep: false }));
  s.stack("02-status", states);

  // An error toast: Save as preset with a shape layer selected (that button is never dimmed).
  await s.select(["Underline"], 1);
  await s.info((i) => !i.layers.length, "shape selected");
  await s.click("btnSaveTyping", { toast: false });
  await s.typeInto("saveTypingName", "Test", 20);
  const bad = await s.click("btnSaveTypingOk");
  if (!/Select a text layer/.test(bad)) throw new Error(`bad toast: ${bad}`);
  await s.click("btnSaveTypingCancel", { toast: false });
  toasts.push(await s.shot("02-toast-bad", { clip: "toast", margin: 0, keep: false }));
  await s.hideToast();
  s.stack("02-toasts", toasts);

  // The engine pill in both engines.
  const pills = [await s.shot("02-pill-js", { clip: ".topbar", keep: false })];
  await s.engine("extendscript");
  await s.select(["Headline"], 1);
  await s.info((i) => i.engine === "extendscript", "legacy engine");
  pills.push(await s.shot("02-pill-legacy", { clip: ".topbar", keep: false }));
  await s.engine("javascript-1.0");
  s.stack("02-engine-pill", pills);

  // Settings, open.
  await s.click("settingsToggle", { toast: false });
  await s.shot("02-settings", { clip: "cardSettings", mark: ["settingsToggle", "labelGrid"] });
  await s.click("settingsToggle", { toast: false });
}
