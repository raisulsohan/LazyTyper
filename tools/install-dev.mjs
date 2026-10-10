// Links this repository into After Effects' CEP extensions folder, so After Effects loads the
// panel straight from the working copy (Window > Extensions > LazyTyper after a restart).
//
//   node tools/install-dev.mjs            link (refuses when a real install is there)
//   node tools/install-dev.mjs --remove   unlink
//
// Unsigned panels need PlayerDebugMode; ENABLE_DEBUG_MODE.bat sets it. A signed release
// install and this link share one extension id, so only one of them can be there at a time.
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const base = process.platform === "win32"
  ? path.join(process.env.APPDATA, "Adobe", "CEP", "extensions")
  : path.join(os.homedir(), "Library", "Application Support", "Adobe", "CEP", "extensions");
const target = path.join(base, "com.sohan.LazyTyper");

function isLink(p) {
  try {
    return fs.lstatSync(p).isSymbolicLink();
  } catch {
    return false;
  }
}

if (process.argv.includes("--remove")) {
  if (isLink(target)) {
    fs.unlinkSync(target);
    console.log(`removed the link ${target}`);
  } else console.log("no dev link to remove");
  process.exit(0);
}

fs.mkdirSync(base, { recursive: true });
if (fs.existsSync(target) || isLink(target)) {
  if (isLink(target) && path.resolve(fs.realpathSync(target)) === root) {
    console.log(`already linked: ${target} -> ${root}`);
    process.exit(0);
  }
  console.error(`${target} already exists (a release install?). Remove it first.`);
  process.exit(1);
}
fs.symlinkSync(root, target, "junction");
console.log(`linked ${target} -> ${root}`);
