// Scenes the chapters share: comps of labelled lines, one line, a search bar; and rigging layers
// through the real panel. Every comp is built by session.scene() (ExtendScript), every rig by the
// panel's own Create Typing Rig button.

export const BG = [0.082, 0.075, 0.122];
export const WHITE = [0.95, 0.94, 0.98];
export const GREY = [0.55, 0.53, 0.66];
/** Key colours for GIF palettes: the dark ground, the text, the labels. */
export const SWATCH = ["15131f", "f1effa", "8d87a8"];

/**
 * Lines one under another, each with a grey label on the left: rows = [{ label, text, name? }].
 * Line layers are named "Line 1", "Line 2", ... unless a row names its own.
 */
export function rows(name, list, { size = 44, labelSize = 24, labelWidth = 300, gap = 110, top = 110, width = 1280, duration = 10, font = "SegoeUI", lines = 1 } = {}) {
  const pitch = gap + (lines - 1) * size * 1.2;
  return {
    name, width, height: Math.round(top + pitch * (list.length - 1) + (lines - 1) * size * 1.2 + 70), duration, fps: 30, bg: BG,
    texts: list.flatMap((r, i) => [
      { name: `Label ${i + 1}`, text: r.label, font: "SegoeUI", size: labelSize, color: GREY, pos: [50, top + i * pitch], locked: true },
      { name: r.name ?? `Line ${i + 1}`, text: r.text, font: r.font ?? font, size: r.size ?? size, color: r.color ?? WHITE, pos: [labelWidth, top + i * pitch + 2] }
    ])
  };
}

/** One line of text on the dark ground. */
export function line(name, layer, text, { size = 64, width = 1280, height = 260, duration = 8, font = "SegoeUI", x = 110 } = {}) {
  return { name, width, height, duration, fps: 30, bg: BG, texts: [{ name: layer, text, font, size, color: WHITE, pos: [x, Math.round(height / 2 + size * 0.35)] }] };
}

/**
 * Rigs the named layers in one click through the panel: rig type, typing style and cursor picked
 * in 1 · Create rig as a user does. Returns the toast.
 */
export async function rig(s, layers, { type = "dynamic", typing = "b:Average", cursor = "b:Vertical", time = 0 } = {}) {
  await s.select(layers, time);
  await s.info((i) => i.layers && i.layers.length === layers.length, `${layers.join(", ")} selected`);
  await s.rigType(type);
  await s.set("createTyping", typing);
  await s.set("createCursor", cursor);
  const t = await s.click("btnCreate");
  if (!/^Rigged /.test(t)) throw new Error(`create: ${t}`);
  await s.hideToast();
  return t;
}

/** Rows marked in a chart: the keys a control changes (its weight differs from the control at 0). */
export const touched = (i, w, w0) => i > 0 && Math.abs(w[i] / w0[i] - 1) > 0.005;
