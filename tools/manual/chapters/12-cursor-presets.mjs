// Chapter 12: cursor presets: Vertical, Underscore and Box, Apply, Add cursor, Save as preset, Delete.
import { rows, rig, line, SWATCH } from "../scenes.mjs";

const LINE = "Pick a cursor";
const wait = (ms) => new Promise((r) => setTimeout(r, ms));

export async function run(s) {
  await s.scene(rows("Cursors", [{ label: "Vertical", text: LINE }, { label: "Underscore", text: LINE }, { label: "Box", text: LINE }], { size: 60, gap: 120, duration: 5 }));
  await rig(s, ["Line 1", "Line 2", "Line 3"]);
  await s.select(["Line 2"], 0);
  await s.info((i) => i.layers[0] && i.layers[0].name === "Line 2", "Line 2");
  await s.set("cursorPreset", "b:Underscore");
  await s.shot("12-card", { clip: "cardCursor", mark: ["cursorPreviews", "cursorPreset", "btnApplyCursor", "btnSaveCursor"] });
  await s.record("12-apply", async () => {
    await s.pointTo("btnApplyCursor", { press: true });
    const t = await s.click("btnApplyCursor");
    if (!/Cursor set to/.test(t)) throw new Error(`apply: ${t}`);
    await wait(1600);
  }, { clip: "cardCursor", toast: true, fps: 8 });
  await s.hideToast();
  await s.select(["Line 3"], 0);
  await s.info((i) => i.layers[0] && i.layers[0].name === "Line 3", "Line 3");
  await s.record("12-chip", async () => {
    await s.pointTo(".cursor-chip[data-id='b:Box']", { press: true });
    await s.js("(document.querySelector(\".cursor-chip[data-id='b:Box']\").click(), 1)");
    await wait(900);
    await s.pointTo("btnApplyCursor", { press: true });
    const t = await s.click("btnApplyCursor");
    if (!/Box/.test(t)) throw new Error(`apply box: ${t}`);
    await wait(1600);
  }, { clip: "cardCursor", toast: true, fps: 8 });
  await s.hideToast();
  await s.strip("12-presets", [{ time: 3.3, label: "Vertical, Underscore and Box (blink on)" }], { width: 900 });

  // Save Line 3's cursor as a preset, then delete it.
  await s.record("12-save", async () => {
    await s.pointTo("btnSaveCursor", { press: true });
    await s.click("btnSaveCursor", { toast: false });
    await s.pointTo("saveCursorName", { press: true });
    await s.typeInto("saveCursorName", "Fat block");
    await s.pointTo("btnSaveCursorOk", { press: true });
    const t = await s.click("btnSaveCursorOk");
    if (!/Saved/.test(t)) throw new Error(`save: ${t}`);
    await wait(1500);
    await s.hideToast();
    await s.pointTo("btnDeleteCursor", { press: true });
    const d = await s.click("btnDeleteCursor");
    if (!/Deleted/.test(d)) throw new Error(`delete: ${d}`);
    await wait(1500);
  }, { clip: "cardCursor", toast: true, fps: 8 });
  await s.hideToast();

  // A rig made with No cursor gets one with Add cursor.
  await s.scene(line("No cursor", "Line", "A cursor, added later.", { duration: 5 }));
  await rig(s, ["Line"], { cursor: "none" });
  await s.select(["Line"], 0);
  await s.info((i) => i.layers[0] && i.layers[0].rig && !i.layers[0].cursor, "no cursor");
  await s.set("cursorPreset", "b:Vertical");
  await s.record("12-add", async () => {
    await s.pointTo("btnAddCursor", { press: true });
    const t = await s.click("btnAddCursor");
    if (!/Cursor added/.test(t)) throw new Error(`add: ${t}`);
    await wait(1600);
  }, { clip: "cardCursor", toast: true, fps: 8 });
  await s.hideToast();
}
