// One step in the manual's session, for trying a picture or a scene by hand:
//
//   node tools/manual/poke.mjs "<JavaScript using s>"          e.g. "await s.aeShot('probe', { keep: false })"
//
// Runs the code with s = a session from session.mjs (no new project) and prints what it returns.
import { openSession } from "./session.mjs";

const s = await openSession();
try {
  const fn = new Function("s", `return (async () => { ${process.argv[2] ?? ""} })();`);
  console.log(JSON.stringify(await fn(s), null, 1));
} finally {
  await s.close();
}
