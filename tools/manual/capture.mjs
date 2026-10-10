// Makes the pictures of the manual (docs/manual/media/).
//
//   node tools/manual/capture.mjs --charts [--only 15-variance-seed]   charts only, no After Effects
//   node tools/manual/capture.mjs --only 08-erase[,15-variance-seed]   one or more chapters, in After Effects
//   node tools/manual/capture.mjs                                       every chapter
//   ... --start            start After Effects when it is not running (ask Sohan first)
//
// Each chapter is tools/manual/chapters/<id>.mjs and may export `charts(c)` (timing charts drawn
// from client/engine.js in headless Edge; c = { browser, ...charts.mjs }) and `run(s)` (pictures
// from the real panel and After Effects; s = a session from session.mjs). Every chapter's run
// starts in a new project (tools/manual/ae/fresh.jsx keeps a copy of an open project first,
// unless it is the manual's own scratch).
//
// Needs, for run: the dev link (npm run dev:link) with PlayerDebugMode, ffmpeg on PATH, and no
// other session driving After Effects (checked before starting). Leaves After Effects open.

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const all = fs.readdirSync(path.join(here, "chapters")).filter((f) => f.endsWith(".mjs")).map((f) => f.slice(0, -4)).sort();
const arg = (name) => { const i = process.argv.indexOf(name); return i > 0 ? process.argv[i + 1] : null; };
const wanted = arg("--only") ? arg("--only").split(",") : all;
for (const id of wanted) if (!all.includes(id)) throw new Error(`no chapter script ${id}; there are ${all.join(", ")}`);
const chartsOnly = process.argv.includes("--charts");

let failed = 0;
const chapters = [];
for (const id of wanted) chapters.push({ id, mod: await import(pathToFileURL(path.join(here, "chapters", `${id}.mjs`)).href) });

// Charts first: they need only Node and a browser.
const withCharts = chapters.filter((c) => c.mod.charts);
if (withCharts.length) {
  const charts = await import("./charts.mjs");
  const { openBrowser } = await import("./browser.mjs");
  const browser = await openBrowser();
  try {
    for (const { id, mod } of withCharts) {
      console.log(`- ${id} (charts)`);
      try {
        await mod.charts({ browser, ...charts });
      } catch (error) {
        failed++;
        console.log(`  FAILED: ${error.stack ?? error}`);
      }
    }
  } finally {
    browser.close();
  }
}

if (!chartsOnly) {
  const withRun = chapters.filter((c) => c.mod.run);
  if (withRun.length) {
    const { openSession, freshProject, aeDialogs } = await import("./session.mjs");
    const s = await openSession({ start: process.argv.includes("--start") });
    // The chapters save presets, pick presets and change label colours in the real panel, which
    // writes %APPDATA%\LazyTyper\settings.json and presets.json: they are put back afterwards.
    const userData = path.join(process.env.APPDATA, "LazyTyper");
    const kept = {};
    for (const f of ["settings.json", "presets.json"]) {
      const p = path.join(userData, f);
      kept[f] = fs.existsSync(p) ? fs.readFileSync(p) : null;
    }
    try {
      for (const { id, mod } of withRun) {
        console.log(`- ${id}`);
        const started = Date.now();
        try {
          await freshProject(s);
          await mod.run(s);
          console.log(`  done in ${Math.round((Date.now() - started) / 1000)} s`);
        } catch (error) {
          failed++;
          console.log(`  FAILED: ${error.stack ?? error}`);
        }
        const boxes = aeDialogs();
        if (boxes.length) {
          failed++;
          console.log(`  After Effects shows a message box: ${boxes.join(" | ")}`);
          break;
        }
      }
    } finally {
      for (const [f, data] of Object.entries(kept)) {
        const p = path.join(userData, f);
        if (data) fs.writeFileSync(p, data);
        else fs.rmSync(p, { force: true });
      }
      await s.js("(location.reload(), 1)").catch(() => undefined);
      await s.close();
    }
  }
}
process.exit(failed ? 1 : 0);
