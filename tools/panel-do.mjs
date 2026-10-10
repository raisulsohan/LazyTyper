// Does one thing in the real LazyTyper panel (DevTools port 8125), for trying it out by hand.
//
//   node tools/panel-do.mjs "<JavaScript run in the panel>" [shot-name]
//
// Prints what the JavaScript returns (JSON) and the panel's toast, if one shows; with a
// shot name, saves a screenshot of the panel to .cache/journey/<shot-name>.png.
// Helpers available in the panel: click(id, shift), pick(id, value), seg(value), info().
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { connectPanel } from "./cep-devtools.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const [code, shot] = process.argv.slice(2);
const panel = await connectPanel({ timeoutMs: 20000 });
const helpers = `
  function click(id, shift) { document.getElementById(id).dispatchEvent(new MouseEvent("click", { bubbles: true, shiftKey: !!shift })); return "clicked " + id; }
  function pick(id, value) { var s = document.getElementById(id); s.value = value; s.dispatchEvent(new Event("change")); return id + " = " + s.value; }
  function seg(value) { document.querySelector(".seg-btn[data-value=" + value + "]").click(); return "rig type " + value; }
  function info() { return LazyTyperPanel.info(); }
`;
const result = await panel.evaluate(`(function(){ ${helpers}; return (${code || "null"}); })()`);
await new Promise((r) => setTimeout(r, 1800));
const toast = await panel.evaluate("document.getElementById('toast').className.indexOf('hidden') < 0 ? document.getElementById('toastText').textContent : ''");
console.log(JSON.stringify(result, null, 1));
if (toast) console.log(`toast: ${toast}`);
if (shot) {
  const dir = path.join(root, ".cache", "journey");
  fs.mkdirSync(dir, { recursive: true });
  const file = path.join(dir, `${shot}.png`);
  fs.writeFileSync(file, await panel.screenshot());
  console.log(`screenshot: ${file}`);
}
panel.close();
