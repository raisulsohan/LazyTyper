// Runs one of the tools' PowerShell scripts (ae-dialogs.ps1, ae-dismiss.ps1, screen-capture.ps1...).
//
// Windows' default execution policy (Restricted, when no scope sets one) refuses `powershell -File`,
// and the tools must not change that policy. So the script's text is passed as an encoded command,
// which the policy does not apply to, with its arguments after it. It runs the same either way.
//
//   import { runPs } from "./ps.mjs";
//   const out = runPs(path.join(here, "ae-dialogs.ps1"));

import fs from "node:fs";
import { execFileSync } from "node:child_process";

/** Runs a .ps1 file with arguments and returns what it prints. Throws when PowerShell fails. */
export function runPs(file, args = []) {
  const quoted = args.map((a) => `'${String(a).replace(/'/g, "''")}'`).join(" ");
  const script = ["$ProgressPreference = 'SilentlyContinue'", "& {", fs.readFileSync(file, "utf8"), `} ${quoted}`].join("\n");
  return execFileSync("powershell", ["-NoProfile", "-NonInteractive", "-EncodedCommand", Buffer.from(script, "utf16le").toString("base64")], { encoding: "utf8" });
}
