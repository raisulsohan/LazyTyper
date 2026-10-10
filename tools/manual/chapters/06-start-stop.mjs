// Chapter 6: Start typing and Stop typing at the playhead.
import { line, rig, SWATCH } from "../scenes.mjs";

const wait = (ms) => new Promise((r) => setTimeout(r, ms));

export async function run(s) {
  await s.scene(line("Start and stop", "Line", "Typing stops here, and goes on later.", { duration: 9 }));
  await rig(s, ["Line"]);
  await s.select(["Line"], 1.6);
  await s.shot("06-card", { clip: "cardTimeline", mark: ["btnStart", "btnStop"] });
  await s.record("06-stop", async () => {
    await s.pointTo("btnStop", { press: true });
    const t = await s.click("btnStop");
    if (!/stops here/.test(t)) throw new Error(`stop: ${t}`);
    await wait(1200);
  }, { clip: "cardTimeline", toast: true, fps: 8 });
  await s.hideToast();
  await s.select(["Line"], 3);
  await s.record("06-start", async () => {
    await s.pointTo("btnStart", { press: true });
    const t = await s.click("btnStart");
    if (!/starts here/.test(t)) throw new Error(`start: ${t}`);
    await wait(1200);
  }, { clip: "cardTimeline", toast: true, fps: 8 });
  await s.hideToast();
  await s.reveal("Line");
  await s.aeShot("06-timeline", { panel: "timeline", slice: [[0, 0.4], [1.2, 3.4]], height: 206 });
  await s.gif("06-start-stop", { duration: 8.5, fps: 30, width: 720, swatch: SWATCH });
}
