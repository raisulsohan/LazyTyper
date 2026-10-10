// Chapter 4: creating a rig: rig type, typing style, cursor, several layers in one click, what is skipped.
import { BG, WHITE, SWATCH } from "../scenes.mjs";

const wait = (ms) => new Promise((r) => setTimeout(r, ms));

export async function run(s) {
  await s.scene({
    name: "Three lines", width: 1280, height: 420, duration: 7, fps: 30, bg: BG,
    texts: [
      { name: "Headline", text: "Three lines, one click.", font: "SegoeUI-Semibold", size: 60, color: WHITE, pos: [110, 140] },
      { name: "Subhead", text: "Each gets its own rig and cursor.", font: "SegoeUI", size: 40, color: [0.76, 0.75, 0.86], pos: [110, 230] },
      { name: "Caption", text: "The cursor takes the colour of the text.", font: "SegoeUI", size: 34, color: [0.98, 0.75, 0.14], pos: [110, 320] }
    ]
  });
  await s.select(["Headline", "Subhead", "Caption"], 0);
  await s.info((i) => i.layers.length === 3, "three selected");
  await s.rigType("dynamic");
  await s.set("createTyping", "b:Average");
  await s.set("createCursor", "b:Vertical");
  await s.shot("04-create-card", { clip: "cardCreate", mark: ["rigType", "rigNotes", "createTyping", "createCursor", "btnCreate"] });
  await s.record("04-rig-type", async () => {
    await s.pointTo(".seg-btn[data-value=stable]", { press: true });
    await s.rigType("stable");
    await wait(1500);
    await s.pointTo(".seg-btn[data-value=dynamic]", { press: true });
    await s.rigType("dynamic");
    await wait(1200);
  }, { clip: "cardCreate", fps: 8 });
  await s.aeShot("04-selected", { panel: "timeline", slice: [0, 0.5], height: 150 });
  await s.shot("04-status-three", { clip: "status" });
  await s.record("04-create-click", async () => {
    await s.pointTo("btnCreate", { press: true });
    const t = await s.click("btnCreate");
    if (!/^Rigged /.test(t)) throw new Error(`create: ${t}`);
    await wait(1500);
  }, { clip: "cardCreate", toast: true, fps: 8 });
  await s.hideToast();
  // The guides are shy: with the comp's Hide Shy Layers on, the Timeline lists texts and cursors.
  await s.hideShy(true);
  await s.aeShot("04-after", { panel: "timeline", slice: [0, 0.5], height: 200 });
  await s.hideShy(false);
  // Create again on a rigged layer: skipped, with a warning.
  await s.select(["Headline"], 0);
  await s.info((i) => i.layers[0] && i.layers[0].rig, "Headline rigged");
  const warn = await s.click("btnCreate");
  if (!/already has a rig/.test(warn)) throw new Error(`warn: ${warn}`);
  await s.shot("04-skipped", { clip: "toast", margin: 0 });
  await s.hideToast();
  await s.gif("04-result", { duration: 6.5, fps: 30, width: 720, swatch: [...SWATCH, "fbbf24", "c2bedb"] });
}
