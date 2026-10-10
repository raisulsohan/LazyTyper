// Chapter 1: installing. The panel as it first opens, before any comp is open.
export async function run(s) {
  await s.info((i) => !i.comp, "no comp open");
  await s.shot("01-first-open");
}
