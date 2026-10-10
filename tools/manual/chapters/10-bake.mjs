// Chapter 10: Bake and Unbake, and the keyframe colours in Settings.
import { line, rig } from "../scenes.mjs";

const wait = (ms) => new Promise((r) => setTimeout(r, ms));

export async function run(s) {
  await s.scene(line("Bake", "Line", "Hello, world! 42 keys, baked.", { duration: 10 }));
  await rig(s, ["Line"]);
  await s.select(["Line"], 0);
  await s.shot("10-card", { clip: "cardRig", mark: ["btnBake", "bakeNote"] });
  await s.record("10-bake-click", async () => {
    await s.pointTo("btnBake", { press: true });
    const t = await s.click("btnBake");
    if (!/^Baked Line \(\d+ keyframes\)/.test(t)) throw new Error(`bake: ${t}`);
    await wait(1800);
  }, { clip: "cardRig", toast: true, fps: 8 });
  await s.hideToast();
  await s.select(["Line"], 1);
  await s.info((i) => i.layers[0] && i.layers[0].baked, "baked");
  await s.shot("10-baked-status", { clip: "status" });
  await s.reveal("Line");
  await s.aeShot("10-keyframes", { panel: "timeline", slice: [0, 3.6], height: 222 });

  // Settings: Letters from Blue (the default) to Purple, then bake again to see it.
  await s.shot("10-settings-closed", { clip: "cardSettings", mark: ["settingsToggle"] });
  await s.click("settingsToggle", { toast: false });
  await wait(500);
  await s.record("10-settings", async () => {
    await s.pointTo("#labelGrid select[data-key=letters]", { press: true });
    await s.js("(function () { var e = document.querySelector('#labelGrid select[data-key=letters]'); e.value = '10'; e.dispatchEvent(new Event('change')); return 1; })()");
    await wait(1400);
  }, { clip: "cardSettings", fps: 8, tail: 400 });
  await s.shot("10-settings-open", { clip: "cardSettings", mark: ["labelGrid"] });
  await s.record("10-unbake", async () => {
    await s.pointTo("btnBake", { press: true });
    const t = await s.click("btnBake", { shift: true });
    if (!/Back to live typing/.test(t)) throw new Error(`unbake: ${t}`);
    await wait(1800);
  }, { clip: "cardRig", toast: true, fps: 8 });
  await s.hideToast();
  await s.click("btnBake");
  await s.hideToast();
  await s.reveal("Line");
  await s.aeShot("10-keyframes-purple", { panel: "timeline", slice: [0, 3.6], height: 222 });
  await s.click("settingsToggle", { toast: false });
}
