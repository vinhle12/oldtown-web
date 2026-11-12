// Sinh asset pixel-art GOC cho OLD TOWN: icon SVG (ve tay bang luoi ky tu),
// texture PNG (nhieu thu tuc), favicon. Khong dung asset cua Mojang.
"use strict";
const fs = require("fs");
const path = require("path");
const zlib = require("zlib");

const OUT = process.argv[2];
const SHEET = process.argv[3];
if (!OUT) throw new Error("usage: node gen.js <static/img dir> [contact-sheet.png]");
fs.mkdirSync(path.join(OUT, "px"), { recursive: true });
fs.mkdirSync(path.join(OUT, "tex"), { recursive: true });

// ---------- PNG encoder (RGBA) ----------
const crcTable = (() => { const t = []; for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; t[n] = c >>> 0; } return t; })();
function crc(buf) { let c = 0xffffffff; for (const b of buf) c = crcTable[(c ^ b) & 255] ^ (c >>> 8); return (c ^ 0xffffffff) >>> 0; }
function chunk(type, data) { const len = Buffer.alloc(4); len.writeUInt32BE(data.length); const td = Buffer.concat([Buffer.from(type), data]); const c = Buffer.alloc(4); c.writeUInt32BE(crc(td)); return Buffer.concat([len, td, c]); }
function png(w, h, rgba) {
  const ihdr = Buffer.alloc(13); ihdr.writeUInt32BE(w, 0); ihdr.writeUInt32BE(h, 4); ihdr[8] = 8; ihdr[9] = 6;
  const raw = Buffer.alloc((w * 4 + 1) * h);
  for (let y = 0; y < h; y++) { raw[y * (w * 4 + 1)] = 0; rgba.copy(raw, y * (w * 4 + 1) + 1, y * w * 4, (y + 1) * w * 4); }
  return Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk("IHDR", ihdr), chunk("IDAT", zlib.deflateSync(raw, { level: 9 })), chunk("IEND", Buffer.alloc(0))]);
}
const hex = (h) => { h = h.replace("#", ""); return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16), h.length > 6 ? parseInt(h.slice(6, 8), 16) : 255]; };
// grid: mang [h][w] cac mau hex (hoac null = trong suot) -> PNG phong to "scale" lan
function gridPng(grid, scale) {
  const h = grid.length, w = grid[0].length, W = w * scale, H = h * scale, buf = Buffer.alloc(W * H * 4);
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const c = grid[Math.floor(y / scale)][Math.floor(x / scale)]; if (!c) continue;
    const [r, g, b, a] = hex(c), i = (y * W + x) * 4; buf[i] = r; buf[i + 1] = g; buf[i + 2] = b; buf[i + 3] = a;
  }
  return png(W, H, buf);
}

// ---------- bang mau ----------
const PAL = {
  k: "#16181a", K: "#3d3f42", s: "#8b8b8b", S: "#c6c6c6", w: "#ffffff",
  g: "#5d9c3a", G: "#3f7426", l: "#86c953",
  d: "#8a5d3b", D: "#5e3b22", t: "#b88d55", T: "#7a5a30",
  y: "#f2c13c", Y: "#b8860b", o: "#ffe98a",
  r: "#c8402f", R: "#7d1f17", p: "#f39a8b",
  e: "#2ecc71", E: "#157a45", m: "#a5f7c8",
  c: "#5fdbe8", C: "#1f8fa0", b: "#3f73d6", B: "#1f3f8a",
  n: "#d9a066", N: "#a8713f", h: "#4a2f1a", v: "#7b4bc4",
  i: "#efe6cc", I: "#b9ab82",
};

// ---------- icon (16x16, hoac 8x8) ----------
const ICONS = {
  grass: `
kkkkkkkkkkkkkkkk
klglgglglgglglgk
kglgGglgglgGgllk
kgGgggGgGgggGggk
kgdgGdggdgGdgdGk
kdddgddDddgdddgk
kdDdddddddDddddk
kddddDdddddddDdk
kdddddddDddddddk
kDddDdddddddDddk
kdddddDddddddddk
kddDddddddDdddDk
kdddddddDddddddk
kdDddDdddddDdddk
kddddddddDdddddk
kkkkkkkkkkkkkkkk`,
  house: `
................
.......kk.......
......krrk..kk..
.....krrrrk.kTk.
....krRrrRrkkTk.
...krrrrrrrrkTk.
..krRrrRrrRrrkk.
.krrrrrrrrrrrrk.
kkkkkkkkkkkkkkkk
.kiiiiiiiiiiiik.
.kiikkkkiiTTTik.
.kiikcckiiTtTik.
.kiikcckiiTtTik.
.kiikkkkiiTtyik.
.kIIIIIIIITtTIk.
.kkkkkkkkkkkkkk.`,
  book: `
................
..kkkkkkkkkkk...
.kRrrrrrrrrrrk..
.kRryyyyyyyrrk..
.kRryrrrrryrrk..
.kRryrrrrryrrk..
.kRryyyyyyyrrk..
.kRrrrrrrrrrrk..
.kRrrrrrrrrrrk..
.kRrrryyyrrrrk..
.kRrrrrrrrrrrk..
.kRrrrrrrrrrrkk.
.kRRRRRRRRRRRkik
.kiiiiiiiiiiiiik
.kkIIIIIIIIIIIk.
..kkkkkkkkkkkk..`,
  compass: `
................
.....kkkkkk.....
...kkSSSSSSkk...
..kSSwwwwwwSSk..
..kSwwwwwwrwSk..
.kSwwwwwwrrwwSk.
.kSwwwwwrrwwwSk.
.kSwwwwkrwwwwSk.
.kSwwwwKkwwwwSk.
.kSwwwKKwwwwwSk.
.kSwwKKwwwwwwSk.
..kSwKwwwwwwSk..
..kSSwwwwwwSSk..
...kkSSSSSSkk...
.....kkkkkk.....
................`,
  sign: `
................
.kkkkkkkkkkkkkk.
.kttttttttttttk.
.ktTTTTtTTTTTtk.
.kttttttttttttk.
.ktTTTtTTTTtTtk.
.kttttttttttttk.
.ktTTTTTtTTTttk.
.kttttttttttttk.
.kkkkkkkkkkkkkk.
......kTTk......
......kTTk......
......kTTk......
......kTTk......
......kTTk......
......kkkk......`,
  paper: `
................
...kkkkkkkkkk...
..kiiiiiiiiiik..
..kiKKKKKKiiik..
..kiiiiiiiiiik..
..kiKKKKKKKKik..
..kiiiiiiiiiik..
..kiKKKKKiiiik..
..kiiiiiiiiiik..
..kiKKKKKKKiik..
..kiiiiiiiiiik..
..kiKKKKiiiiik..
..kiiiiiiiiIIk..
..kiiiiiiiIkk...
..kkkkkkkkkk....
................`,
  coin: `
................
.....kkkkkk.....
...kkooooookk...
..kooyyyyyyyYk..
..koyyYYYYyyYk..
.koyyYooyyYyyYk.
.koyyYoyyyYyyYk.
.koyyYyyyyYyyYk.
.koyyYyyyyYyyYk.
.koyyYyyyyYyyYk.
.koyyYyyyyYyyYk.
..koyyYYYYyyYk..
..koyyyyyyyyYk..
...kkYYYYYYkk...
.....kkkkkk.....
................`,
  head: `
GGGGGGGG
GggggggG
GGGGGGGG
hnnnnnnh
nknnnnkn
nnnnnnnn
nnNNNNnn
nnnnnnnn`,
  emerald: `
................
......kkkk......
.....kmmeEk.....
....kmmeeEEk....
...kmmmeeeEEk...
..kmwmeeeeeEEk..
..kmwmeeeeeEEk..
..kmmmeeeeeEEk..
..kmmeeeeeeEEk..
..kmeeeeeeeEEk..
..kmeeeeeeEEEk..
...keeeeeEEEk...
....keeeEEEk....
.....keEEEk.....
......kkkk......
................`,
  skull: `
................
....kkkkkkkk....
...kwwwwwwwwk...
..kwwwwwwwwwwk..
..kwwwwwwwwwSk..
..kwkkkwwkkkSk..
..kwkkkwwkkkSk..
..kwkkkwwkkkSk..
..kwwwwkkwwwSk..
..kwwwwkkwwSSk..
...kwwwwwwSSk...
....kwkwkwkk....
....kwkwkwSk....
....kkkkkkkk....
................
................`,
  anvil: `
................
................
.kkkkkkkkkkkkkk.
.kSSSSSSSSSSSsk.
.kSsssssssssssk.
..kksssssssKkk..
....ksssssKk....
.....kssssKk....
.....kssssKk....
.....kssssKk....
....ksssssKKk...
...kSsssssssKk..
..kSSsssssssKKk.
..kssssssssKKKk.
..kkkkkkkkkkkkk.
................`,
  sword: `
.............kkk
............kcwk
...........kcwck
..........kcwck.
.........kcwck..
........kcwck...
.......kcwck....
..kk..kcwck.....
..kTkkcwck......
...kTCcck.......
....kTCk........
...kTkTTk.......
..kTk.kTTk......
.kyk...kkk......
kyyk............
kkk.............`,
  target: `
................
.....kkkkkk.....
...kkrrrrrrkk...
..krrwwwwwwrrk..
..krwwrrrrwwrk..
.krwwrrwwrrwwrk.
.krwrrwwwwrrwrk.
.krwrwwrrwwrwrk.
.krwrwwrrwwrwrk.
.krwrrwwwwrrwrk.
.krwwrrwwrrwwrk.
..krwwrrrrwwrk..
..krrwwwwwwrrk..
...kkrrrrrrkk...
.....kkkkkk.....
................`,
  shield: `
................
.kkkkkkkkkkkkkk.
.kSSSSSSbbbbbbk.
.kSSSSSSbbbbbbk.
.kSSSSSSbbbbbbk.
.kSSSSSSbbbbbbk.
.kSSSSSSbbbbbbk.
.kbbbbbbSSSSSSk.
.kbbbbbbSSSSSSk.
.kbbbbbbSSSSSSk.
..kbbbbbSSSSSk..
..kBbbbbSSSSsk..
...kBbbbSSSsk...
....kkBbSskk....
......kkkk......
................`,
  chest: `
................
................
.kkkkkkkkkkkkkk.
.kttttttttttttk.
.ktTttttttttTtk.
.kttttttttttttk.
.kTTTTTkkTTTTTk.
.kkkkkkSSkkkkkk.
.kttttkSSkttttk.
.kttttkkkkttttk.
.ktTttttttttTtk.
.kttttttttttttk.
.kttttttttttttk.
.kTTTTTTTTTTTTk.
.kkkkkkkkkkkkkk.
................`,
  heart: `
................
................
..kkkk....kkkk..
.krrrrk..krrrrk.
krpwrrrkkrrrrrRk
krwprrrrrrrrrrRk
krprrrrrrrrrrrRk
krrrrrrrrrrrrrRk
.krrrrrrrrrrrRk.
..krrrrrrrrrRk..
...krrrrrrrRk...
....krrrrrRk....
.....krrrRk.....
......krRk......
.......kk.......
................`,
  pickaxe: `
................
...kkkkkkkk.....
..kccccccccck...
...kkkkkkcccck..
........kTkcck..
.......kTk.kcck.
......kTk..kcck.
.....kTk...kcck.
....kTk....kcck.
...kTk......kck.
..kTk.......kck.
.kTk.........k..
kTk.............
kk..............
................
................`,
  torch: `
................
.......oo.......
......oyyo......
......yoyy......
.....kyyyyk.....
.....kyrryk.....
.....kkTTkk.....
......kTTk......
......kTtk......
......kTTk......
......kTtk......
......kTTk......
......kTtk......
......kTTk......
......kkkk......
................`,
  clock: `
................
.....kkkkkk.....
...kkyyyyyykk...
..kyyoooooyyYk..
..kyowwwkwwoYk..
.kyowwwwkwwwoYk.
.kyowwwwkwwwoYk.
.kyowwwwkwwwoYk.
.kyowwwwkkkwoYk.
.kyowwwwwwwwoYk.
.kyowwwwwwwwoYk.
..kyowwwwwwoYk..
..kyyoooooyyYk..
...kkYYYYYYkk...
.....kkkkkk.....
................`,
  star: `
................
.......kk.......
......kook......
......kyyk......
.kkkkkkyykkkkkk.
.koyyyyyyyyyyYk.
..kyyyyyyyyyYk..
...kyyyyyyyYk...
....kyyyyyyk....
...kyyyyyyyyk...
...kyyyYYyyyk...
..kyyyYkkYyyyk..
..kyyYk..kYyyk..
.kyYkk....kkYyk.
.kkk........kkk.
................`,
  trophy: `
................
..kkkkkkkkkkkk..
.kkoyyyyyyyyYkk.
kykoyyyyyyyyYkyk
kykoyyyyyyyyYkyk
kykoyyyyyyyyYkyk
.kkoyyyyyyyyYkk.
..kkoyyyyyyYkk..
...kkoyyyyYkk...
....kkoyyYkk....
......kyYk......
......kyYk......
.....kkyYkk.....
....koyyyyYk....
....kkkkkkkk....
................`,
};

function parseIcon(name, src) {
  const rows = src.trim().split("\n");
  const w = rows[0].length;
  rows.forEach((r, i) => { if (r.length !== w) throw new Error(`icon ${name}: row ${i} has ${r.length} cols (want ${w}): "${r}"`); });
  if (rows.length !== w) throw new Error(`icon ${name}: ${rows.length} rows x ${w} cols`);
  return rows.map((r) => [...r].map((ch) => { if (ch === ".") return null; if (!PAL[ch]) throw new Error(`icon ${name}: unknown color '${ch}'`); return PAL[ch]; }));
}
function iconSvg(grid) {
  const n = grid.length; let rects = "";
  for (let y = 0; y < n; y++) {
    let x = 0;
    while (x < n) {
      const c = grid[y][x]; if (!c) { x++; continue; }
      let x2 = x; while (x2 < n && grid[y][x2] === c) x2++;
      rects += `<rect x="${x}" y="${y}" width="${x2 - x}" height="1" fill="${c}"/>`;
      x = x2;
    }
  }
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${n} ${n}" width="${n * 4}" height="${n * 4}" shape-rendering="crispEdges">${rects}</svg>\n`;
}
const grids = {};
for (const [name, src] of Object.entries(ICONS)) {
  grids[name] = parseIcon(name, src);
  fs.writeFileSync(path.join(OUT, "px", name + ".svg"), iconSvg(grids[name]));
}
// favicon
fs.writeFileSync(path.join(OUT, "icon.png"), gridPng(grids.grass, 4));
fs.writeFileSync(path.join(OUT, "icon-192.png"), gridPng(grids.grass, 12));

// ---------- texture thu tuc ----------
function rng(seed) { let s = seed >>> 0; return () => { s = (s + 0x6d2b79f5) >>> 0; let t = Math.imul(s ^ (s >>> 15), 1 | s); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
const pick = (r, arr, weights) => { let t = r() * weights.reduce((a, b) => a + b, 0); for (let i = 0; i < arr.length; i++) { t -= weights[i]; if (t <= 0) return arr[i]; } return arr[arr.length - 1]; };
function noiseTex(seed, colors, weights, streak) {
  const r = rng(seed), g = [];
  for (let y = 0; y < 16; y++) { g.push([]); for (let x = 0; x < 16; x++) {
    if (streak && x > 0 && r() < streak) g[y].push(g[y][x - 1]); else g[y].push(pick(r, colors, weights));
  } }
  return g;
}
const TEX = {};
TEX.dirt = noiseTex(11, ["#8a5d3b", "#7b5133", "#986a45", "#6b472c", "#a57850"], [5, 3, 3, 2, 1], 0.25);
TEX.grass_top = noiseTex(23, ["#63a03c", "#589235", "#70af45", "#4d842e", "#80bd50"], [5, 3, 3, 2, 1], 0.2);
TEX.stone = noiseTex(37, ["#7f7f7f", "#888888", "#757575", "#8f8f8f", "#6c6c6c"], [5, 3, 3, 1, 1], 0.55);
TEX.deepslate = noiseTex(41, ["#48484e", "#505057", "#3e3e44", "#5a5a61", "#36363b"], [5, 3, 3, 1, 1], 0.65);
TEX.bedrock = noiseTex(53, ["#343434", "#555555", "#1c1c1c", "#757575", "#0e0e0e"], [4, 3, 3, 1, 2], 0.3);
// co ben hong: dat + lop co rang cua phia tren
TEX.grass_side = (() => {
  const g = TEX.dirt.map((row) => row.slice()), r = rng(71), greens = ["#63a03c", "#589235", "#70af45", "#4d842e"];
  for (let x = 0; x < 16; x++) { const depth = 3 + Math.floor(r() * 3); for (let y = 0; y < depth; y++) g[y][x] = y === depth - 1 ? "#4d842e" : pick(r, greens, [4, 3, 3, 1]); }
  return g;
})();
// van go soi: 4 thanh ngang cao 4px
TEX.planks = (() => {
  const r = rng(89), g = [], cols = ["#b88d55", "#ad8450", "#c2975e", "#a47b49"];
  for (let y = 0; y < 16; y++) { g.push([]); for (let x = 0; x < 16; x++) {
    const board = Math.floor(y / 4), joint = [5, 12, 2, 9][board];
    if (y % 4 === 3) g[y].push("#7e5f36"); else if (x === joint) g[y].push("#8c6b3e");
    else g[y].push(x > 0 && r() < 0.6 && g[y][x - 1] !== "#8c6b3e" ? g[y][x - 1] : pick(r, cols, [5, 3, 2, 2]));
  } }
  return g;
})();
// quang: da + cac dom mau
function ore(seed, a, b) {
  const g = TEX.stone.map((row) => row.slice());
  for (const [x, y] of [[3, 3], [4, 3], [3, 4], [10, 2], [11, 2], [11, 3], [6, 8], [7, 8], [6, 9], [7, 9], [12, 10], [12, 11], [11, 11], [3, 12], [4, 12], [4, 13]])
    g[y][x] = (x + y + seed) % 3 === 0 ? b : a;
  return g;
}
TEX.ore_diamond = ore(1, "#5fdbe8", "#d4f9fc");
TEX.ore_gold = ore(2, "#f2c13c", "#ffe98a");
TEX.ore_redstone = ore(3, "#d8281c", "#ff6a55");
TEX.ore_emerald = ore(4, "#2ecc71", "#a5f7c8");
for (const [name, g] of Object.entries(TEX)) fs.writeFileSync(path.join(OUT, "tex", name + ".png"), gridPng(g, 8));
// hat giay: o 32x32 (moi hat 2px khi hien 64px), den alpha rat nhe
(() => {
  const r = rng(101), g = [];
  for (let y = 0; y < 32; y++) { g.push([]); for (let x = 0; x < 32; x++) { const v = r(); g[y].push(v < 0.06 ? "#00000012" : v < 0.16 ? "#0000000a" : v > 0.95 ? "#ffffff14" : null); } }
  fs.writeFileSync(path.join(OUT, "tex", "grain.png"), gridPng(g, 2));
})();

// ---------- bang xem thu ----------
if (SHEET) {
  const names = Object.keys(grids), tnames = Object.keys(TEX), cols = 7, cell = 18;
  const rows = Math.ceil(names.length / cols) + Math.ceil(tnames.length / cols);
  const sheet = Array.from({ length: rows * cell }, () => Array(cols * cell).fill("#cfc6a8"));
  const put = (g, idx, rowOff) => { const cx = (idx % cols) * cell + 1, cy = (Math.floor(idx / cols) + rowOff) * cell + 1, s = 16 / g.length;
    for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) { const c = g[Math.floor(y / s)][Math.floor(x / s)]; if (c) sheet[cy + y][cx + x] = c; } };
  names.forEach((n, i) => put(grids[n], i, 0));
  tnames.forEach((n, i) => put(TEX[n], i, Math.ceil(names.length / cols)));
  fs.writeFileSync(SHEET, gridPng(sheet, 6));
  console.log("icons:", names.join(" "), "\ntex:", tnames.join(" "));
}
