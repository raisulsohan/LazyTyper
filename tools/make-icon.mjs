// Draws the panel icon (client/icons/icon-dark.png, 23x23, and a 46x46 @2x copy):
// a violet-to-pink rounded square with a white "T" and a caret, like the panel's header.
//
//   node tools/make-icon.mjs
import fs from "node:fs";
import path from "node:path";
import zlib from "node:zlib";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

function crc32(buf) {
  let c;
  const table = [];
  for (let n = 0; n < 256; n++) {
    c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    table[n] = c >>> 0;
  }
  let crc = 0xffffffff;
  for (const b of buf) crc = table[(crc ^ b) & 0xff] ^ (crc >>> 8);
  return (crc ^ 0xffffffff) >>> 0;
}

function png(w, h, rgba) {
  const chunk = (type, data) => {
    const len = Buffer.alloc(4);
    len.writeUInt32BE(data.length);
    const td = Buffer.concat([Buffer.from(type, "latin1"), data]);
    const crc = Buffer.alloc(4);
    crc.writeUInt32BE(crc32(td));
    return Buffer.concat([len, td, crc]);
  };
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(w, 0);
  ihdr.writeUInt32BE(h, 4);
  ihdr[8] = 8;
  ihdr[9] = 6;
  const raw = Buffer.alloc((w * 4 + 1) * h);
  for (let y = 0; y < h; y++) {
    raw[y * (w * 4 + 1)] = 0;
    rgba.copy(raw, y * (w * 4 + 1) + 1, y * w * 4, (y + 1) * w * 4);
  }
  return Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    chunk("IHDR", ihdr),
    chunk("IDAT", zlib.deflateSync(raw)),
    chunk("IEND", Buffer.alloc(0))
  ]);
}

/** Coverage of a pixel by a shape, by 4x4 supersampling. */
function draw(size) {
  const S = 4;
  const out = Buffer.alloc(size * size * 4);
  const u = size / 23;
  const inRound = (x, y) => {
    const r = 5 * u;
    const cx = Math.min(Math.max(x, r), size - r);
    const cy = Math.min(Math.max(y, r), size - r);
    return (x - cx) ** 2 + (y - cy) ** 2 <= r * r;
  };
  const inRect = (x, y, x0, y0, x1, y1) => x >= x0 * u && x < x1 * u && y >= y0 * u && y < y1 * u;
  const white = (x, y) =>
    inRect(x, y, 4.5, 5.5, 14.5, 8) || inRect(x, y, 8.2, 5.5, 10.8, 17.5) || inRect(x, y, 16.2, 5, 18, 18);
  for (let py = 0; py < size; py++) {
    for (let px = 0; px < size; px++) {
      let bg = 0;
      let fg = 0;
      for (let sy = 0; sy < S; sy++) {
        for (let sx = 0; sx < S; sx++) {
          const x = px + (sx + 0.5) / S;
          const y = py + (sy + 0.5) / S;
          if (inRound(x, y)) {
            bg++;
            if (white(x, y)) fg++;
          }
        }
      }
      const t = (px + py) / (2 * size);
      const r = Math.round(0x8b + (0xdb - 0x8b) * t);
      const g = Math.round(0x5c + (0x27 - 0x5c) * t);
      const b = Math.round(0xf6 + (0x77 - 0xf6) * t);
      const a = bg / (S * S);
      const f = bg ? fg / bg : 0;
      const i = (py * size + px) * 4;
      out[i] = Math.round(r + (255 - r) * f);
      out[i + 1] = Math.round(g + (255 - g) * f);
      out[i + 2] = Math.round(b + (255 - b) * f);
      out[i + 3] = Math.round(a * 255);
    }
  }
  return out;
}

const dir = path.join(root, "client", "icons");
fs.mkdirSync(dir, { recursive: true });
fs.writeFileSync(path.join(dir, "icon-dark.png"), png(23, 23, draw(23)));
fs.writeFileSync(path.join(dir, "icon-dark@2x.png"), png(46, 46, draw(46)));
console.log("wrote client/icons/icon-dark.png and icon-dark@2x.png");
