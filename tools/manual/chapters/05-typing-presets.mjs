// Chapter 5: typing presets: the three built in, Apply, the rhythm strip, Save as preset, Delete.
import { rows, rig, SWATCH } from "../scenes.mjs";

const LINE = "Presets change the whole feel of a line.";
const wait = (ms) => new Promise((r) => setTimeout(r, ms));

export async function charts(c) {
  const presets = Object.fromEntries(c.RIG.TYPING_PRESETS.map((p) => [p.name, p.values]));
  await c.drawChart(c.browser, "05-presets-chart", c.rowsChart({
    title: "The three typing presets",
    sub: "The same line with each built-in preset (Random Seed 1 in all three).",
    rows: ["Very Fast", "Average", "Hunt & Peck"].map((n) => ({ label: n, text: LINE, values: presets[n] }))
  }));
}

export async function run(s) {
  await s.scene(rows("Presets", [{ label: "Very Fast", text: LINE }, { label: "Average", text: LINE }, { label: "Hunt & Peck", text: LINE }], { duration: 9 }));
  await rig(s, ["Line 1", "Line 2", "Line 3"]);
  await s.select(["Line 1"], 0);
  await s.info((i) => i.layers[0] && i.layers[0].name === "Line 1", "Line 1");
  await s.set("typingPreset", "b:Average");
  await s.shot("05-speed-card", { clip: "cardSpeed", mark: ["typingPreset", "btnApplyTyping", "rhythm", "btnSaveTyping"] });
  await s.record("05-rhythm", async () => {
    for (const p of ["b:Very Fast", "b:Average", "b:Hunt & Peck"]) {
      await s.pointTo("typingPreset", { press: true });
      await s.set("typingPreset", p);
      await wait(1400);
    }
  }, { clip: "cardSpeed", fps: 8 });
  await s.set("typingPreset", "b:Very Fast");
  await s.record("05-apply", async () => {
    await s.pointTo("btnApplyTyping", { press: true });
    const t = await s.click("btnApplyTyping");
    if (!/Applied/.test(t)) throw new Error(`apply: ${t}`);
    await wait(1500);
  }, { clip: "cardSpeed", toast: true, fps: 8 });
  await s.hideToast();
  await s.select(["Line 3"], 0);
  await s.info((i) => i.layers[0] && i.layers[0].name === "Line 3", "Line 3");
  await s.set("typingPreset", "b:Hunt & Peck");
  await s.click("btnApplyTyping");
  await s.hideToast();
  await s.gif("05-presets", { duration: 8.6, fps: 30, width: 720, swatch: SWATCH });

  // Save Line 3's controls as a preset of your own, then delete it.
  await s.controls("Line 3", { "Random Seed": 7 });
  await s.record("05-save", async () => {
    await s.pointTo("btnSaveTyping", { press: true });
    await s.click("btnSaveTyping", { toast: false });
    await s.pointTo("saveTypingName", { press: true });
    await s.typeInto("saveTypingName", "Slow and careful");
    await s.pointTo("btnSaveTypingOk", { press: true });
    const t = await s.click("btnSaveTypingOk");
    if (!/Saved/.test(t)) throw new Error(`save: ${t}`);
    await wait(1500);
  }, { clip: "cardSpeed", toast: true, fps: 8 });
  await s.hideToast();
  await s.shot("05-saved", { clip: "cardSpeed", mark: ["typingPreset", "btnDeleteTyping"] });
  await s.record("05-delete", async () => {
    await s.pointTo("btnDeleteTyping", { press: true });
    const t = await s.click("btnDeleteTyping");
    if (!/Deleted/.test(t)) throw new Error(`delete: ${t}`);
    await wait(1500);
  }, { clip: "cardSpeed", toast: true, fps: 8 });
  await s.hideToast();
}
