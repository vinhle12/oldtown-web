// Ve "khung GUI" 9-slice va cac canh isometric bang voxel cho OLD TOWN.
// Tat ca la hinh tu ve bang code (khong dung asset cua Mojang).
//   node tools/gen-art.js oldtown-web/static/img
"use strict";
const fs = require("fs");
const path = require("path");
const zlib = require("zlib");

const OUT = process.argv[2];
if (!OUT) throw new Error("usage: node gen-art.js <static/img dir>");
fs.mkdirSync(path.join(OUT, "ui"), { recursive: true });
fs.mkdirSync(path.join(OUT, "art"), { recursive: true });

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
const rgb = (h) => [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)];
const toHex = (c) => "#" + c.map((v) => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, "0")).join("");
const mul = (h, f) => toHex(rgb(h).map((v) => v * f));
const lift = (h, a) => toHex(rgb(h).map((v) => v + (255 - v) * a));
function gridPng(grid, scale) {
  const h = grid.length, w = grid[0].length, W = w * scale, H = h * scale, buf = Buffer.alloc(W * H * 4);
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const c = grid[Math.floor(y / scale)][Math.floor(x / scale)]; if (!c) continue;
    const [r, g, b] = rgb(c), i = (y * W + x) * 4; buf[i] = r; buf[i + 1] = g; buf[i + 2] = b; buf[i + 3] = 255;
  }
  return png(W, H, buf);
}
function rng(seed) { let s = seed >>> 0; return () => { s = (s + 0x6d2b79f5) >>> 0; let t = Math.imul(s ^ (s >>> 15), 1 | s); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }

// ---------- khung GUI 9-slice: goc khuyet 1 pixel nhu cua so trong game ----------
function frame(name, c) {
  const rows = [
    ".ooooooo.",
    "ohhhhhhmo",
    "ohfffffso",
    "ohfffffso",
    "ohfffffso",
    "ohfffffso",
    "ohfffffso",
    "omsssssso",
    ".ooooooo.",
  ];
  const g = rows.map((r) => [...r].map((ch) => (ch === "." ? null : c[ch])));
  fs.writeFileSync(path.join(OUT, "ui", name + ".png"), gridPng(g, 6));
}
frame("frame-dark", { o: "#040605", h: "#39443c", m: "#1e2521", f: "#151a17", s: "#0a0d0b" });
frame("frame-raised", { o: "#040605", h: "#4b594e", m: "#283029", f: "#1d2420", s: "#0d110f" });
frame("frame-gui", { o: "#0a0a0a", h: "#ffffff", m: "#c6c6c6", f: "#c6c6c6", s: "#555555" });
frame("frame-paper", { o: "#231d12", h: "#fbf6e4", m: "#ece3c8", f: "#ece3c8", s: "#c9bb95" });
frame("frame-tip", { o: "#12061c", h: "#5a1fd0", m: "#3f1496", f: "#12061c", s: "#2d0d70" });
frame("frame-toast", { o: "#0a0a0a", h: "#5c5c5c", m: "#3a3a3a", f: "#212121", s: "#141414" });

// ---------- voxel isometric ----------
const IS = 4, IH = 5; // nua be ngang mot khoi, chieu cao mat ben (pixel)
const MAT = {
  grass: { t: "#6fae48", s: "#8a5d3b", cap: "#5c9a3c" }, turf: "#63a342", dirt: "#8a5d3b", stone: "#8c908c", deep: "#4c4e57",
  cobble: "#9c988c", wall: "#bdb5a2", plank: "#b88d55", wood: "#6b4a2b", roof: "#2f8a5b", roofd: "#236b47",
  leaf: "#3f8f3a", leaf2: "#327a34", path: "#c7ae7c", water: { t: "#5aa7e0", s: "#3b7fb8" }, brick: "#a0523c",
  red: "#c8402f", white: "#eeeae0", farm: "#6b4428", wheat: "#e2c044", obs: "#231a3c", coal: "#2b2b30", chest: "#a9773f",
  glow: { e: "#ffd76a" }, gold: { e: "#f2c13c" }, portal: { e: "#a55cf2" }, diamond: { e: "#63d8e6" }, redst: { e: "#e2392d" },
  emer: { e: "#3ddc84" }, lava: { e: "#ff8a2a" },
};
function Scene() {
  const v = new Map(), key = (x, y, z) => x + "," + y + "," + z;
  const api = {
    v, has: (x, y, z) => v.has(key(x, y, z)),
    set: (x, y, z, m) => { v.set(key(x, y, z), { x, y, z, m }); },
    del: (x, y, z) => { v.delete(key(x, y, z)); },
    box: (x0, y0, z0, x1, y1, z1, m) => { for (let x = x0; x <= x1; x++) for (let y = y0; y <= y1; y++) for (let z = z0; z <= z1; z++) api.set(x, y, z, m); },
  };
  return api;
}
function renderIso(sc) {
  const list = [...sc.v.values()].sort((a, b) => (a.x + a.y) - (b.x + b.y) || a.z - b.z);
  let x0 = 1e9, x1 = -1e9, y0 = 1e9, y1 = -1e9;
  for (const q of list) {
    const cx = (q.x - q.y) * IS, cy = (q.x + q.y) * (IS / 2) - q.z * IH;
    x0 = Math.min(x0, cx - IS); x1 = Math.max(x1, cx + IS - 1); y0 = Math.min(y0, cy); y1 = Math.max(y1, cy + IS + IH - 1);
  }
  const W = x1 - x0 + 1, Hh = y1 - y0 + 1, g = Array.from({ length: Hh }, () => Array(W).fill(null));
  const put = (x, y, c) => { if (y >= 0 && y < Hh && x >= 0 && x < W) g[y][x] = c; };
  for (const q of list) {
    const m = MAT[q.m]; if (!m) throw new Error("mat " + q.m);
    const j = 1 + ((((q.x * 73856093) ^ (q.y * 19349663) ^ (q.z * 83492791)) >>> 0) % 7 - 3) * 0.014;
    const emissive = typeof m !== "string" && m.e;
    let top, left, right, capL = null, capR = null;
    if (typeof m === "string") { top = lift(mul(m, j), 0.16); left = mul(m, j); right = mul(m, j * 0.76); }
    else if (emissive) { top = lift(m.e, 0.25); left = m.e; right = mul(m.e, 0.86); }
    else { top = lift(mul(m.t, j), 0.1); left = mul(m.s, j); right = mul(m.s, j * 0.76); if (m.cap) { capL = mul(m.cap, j); capR = mul(m.cap, j * 0.78); } }
    // bong do nhe: co khoi cao hon dung ngay phia sau thi mat tren toi di
    if (!emissive && (sc.has(q.x - 1, q.y, q.z + 1) || sc.has(q.x, q.y - 1, q.z + 1))) top = mul(top, 0.84);
    const ox = (q.x - q.y) * IS - x0, oy = (q.x + q.y) * (IS / 2) - q.z * IH - y0;
    for (let i = 0; i < IS; i++) { const half = i < IS / 2 ? 2 * (i + 1) : 2 * (IS - i); for (let dx = -half; dx < half; dx++) put(ox + dx, oy + i, top); }
    for (let dx = -IS; dx < 0; dx++) { const st = IS / 2 + 1 + Math.floor((dx + IS) / 2); for (let k = 0; k < IH; k++) put(ox + dx, oy + st + k, k === 0 && capL ? capL : left); }
    for (let dx = 0; dx < IS; dx++) { const st = IS / 2 + 1 + Math.floor((IS - 1 - dx) / 2); for (let k = 0; k < IH; k++) put(ox + dx, oy + st + k, k === 0 && capR ? capR : right); }
  }
  return g;
}

// Thi tran: dao noi co thap dong ho, hai nha mai xanh, quang truong, cho, ao, ruong
function buildTown() {
  const sc = Scene(), N = 23, G = 5, C = 11, R = rng(7);
  const inside = (x, y, inset) => Math.pow(Math.abs(x - C) / (C + 0.7 - inset), 4) + Math.pow(Math.abs(y - C) / (C + 0.7 - inset), 4) <= 1;
  for (let x = 0; x < N; x++) for (let y = 0; y < N; y++) {
    if (!inside(x, y, 0)) continue;
    sc.set(x, y, G, "grass"); sc.set(x, y, G - 1, "dirt");
    if (inside(x, y, 1.3)) sc.set(x, y, G - 2, "dirt");
    if (inside(x, y, 2.8)) sc.set(x, y, G - 3, R() < 0.12 ? "coal" : "stone");
    if (inside(x, y, 4.6)) sc.set(x, y, G - 4, "stone");
    if (inside(x, y, 6.5) && R() < 0.5) sc.set(x, y, G - 5, "stone");
  }
  const ground = (x, y) => sc.has(x, y, G);
  // duong + quang truong + dai phun nuoc
  for (let i = 0; i < N; i++) for (const a of [10, 11]) { if (ground(a, i)) sc.set(a, i, G, "path"); if (ground(i, a)) sc.set(i, a, G, "path"); }
  for (let x = 8; x <= 14; x++) for (let y = 8; y <= 14; y++) sc.set(x, y, G, "path");
  sc.box(10, 10, G + 1, 12, 12, G + 1, "cobble"); sc.set(11, 11, G + 1, "water");
  // thap dong ho
  sc.box(2, 2, G + 1, 6, 6, G + 10, "stone");
  sc.box(1, 1, G + 11, 7, 7, G + 11, "roofd"); sc.box(2, 2, G + 12, 6, 6, G + 12, "roof"); sc.box(3, 3, G + 13, 5, 5, G + 13, "roof");
  sc.set(4, 4, G + 14, "roofd"); sc.set(4, 4, G + 15, "gold");
  sc.set(6, 4, G + 8, "gold"); sc.set(4, 6, G + 8, "gold");
  sc.set(6, 4, G + 1, "wood"); sc.set(6, 4, G + 2, "wood");
  sc.set(4, 6, G + 4, "glow"); sc.set(6, 3, G + 5, "glow"); sc.set(6, 5, G + 5, "glow");
  // nha mai xanh
  function house(x0, y0, x1, y1, axis) {
    sc.box(x0, y0, G + 1, x1, y1, G + 3, "wall");
    for (let x = x0; x <= x1; x++) for (let y = y0; y <= y1; y++) if (x === x0 || x === x1 || y === y0 || y === y1) sc.set(x, y, G + 1, "cobble");
    let k = 0;
    if (axis === "x") for (let a = y0 - 1, b = y1 + 1; a <= b; a++, b--, k++) {
      for (let x = x0 - 1; x <= x1 + 1; x++) { sc.set(x, a, G + 4 + k, a === b ? "roofd" : "roof"); sc.set(x, b, G + 4 + k, a === b ? "roofd" : "roof"); }
      for (let x = x0; x <= x1; x++) for (let y = a + 1; y <= b - 1; y++) sc.set(x, y, G + 4 + k, "wall");
    } else for (let a = x0 - 1, b = x1 + 1; a <= b; a++, b--, k++) {
      for (let y = y0 - 1; y <= y1 + 1; y++) { sc.set(a, y, G + 4 + k, a === b ? "roofd" : "roof"); sc.set(b, y, G + 4 + k, a === b ? "roofd" : "roof"); }
      for (let y = y0; y <= y1; y++) for (let x = a + 1; x <= b - 1; x++) sc.set(x, y, G + 4 + k, "wall");
    }
  }
  house(14, 2, 19, 6, "x");
  sc.set(16, 6, G + 1, "wood"); sc.set(16, 6, G + 2, "wood"); sc.set(14, 6, G + 2, "glow"); sc.set(18, 6, G + 2, "glow"); sc.set(19, 4, G + 2, "glow"); sc.set(19, 4, G + 5, "glow");
  sc.box(15, 3, G + 6, 15, 3, G + 8, "brick");
  house(2, 14, 6, 19, "y");
  sc.set(6, 16, G + 1, "wood"); sc.set(6, 16, G + 2, "wood"); sc.set(6, 14, G + 2, "glow"); sc.set(6, 18, G + 2, "glow"); sc.set(4, 19, G + 2, "glow"); sc.set(4, 19, G + 5, "glow");
  // den long o 4 goc quang truong
  for (const [x, y] of [[8, 8], [14, 8], [8, 14], [14, 14]]) { sc.set(x, y, G + 1, "wood"); sc.set(x, y, G + 2, "wood"); sc.set(x, y, G + 3, "glow"); }
  // sap cho mai soc do trang
  for (const [x, y] of [[15, 14], [18, 14], [15, 16], [18, 16]]) sc.box(x, y, G + 1, x, y, G + 2, "wood");
  for (let x = 15; x <= 18; x++) for (let y = 14; y <= 16; y++) sc.set(x, y, G + 3, (x + y) % 2 ? "red" : "white");
  sc.set(16, 15, G + 1, "chest"); sc.set(17, 15, G + 1, "plank");
  // ao nuoc
  for (const [x, y] of [[17, 18], [18, 18], [19, 18], [17, 19], [18, 19], [19, 19], [18, 20], [16, 19]]) if (ground(x, y)) sc.set(x, y, G, "water");
  // ruong lua
  for (let x = 13; x <= 15; x++) for (let y = 18; y <= 21; y++) if (ground(x, y) && !(x === 15 && y === 18)) { sc.set(x, y, G, "farm"); if ((x + y) % 2 === 0 || y % 2) sc.set(x, y, G + 1, "wheat"); }
  // cay
  function tree(x, y, h) {
    if (!ground(x, y)) return;
    for (let z = 1; z <= h; z++) sc.set(x, y, G + z, "wood");
    for (let dx = -1; dx <= 1; dx++) for (let dy = -1; dy <= 1; dy++) { sc.set(x + dx, y + dy, G + h, (dx + dy) % 2 ? "leaf2" : "leaf"); sc.set(x + dx, y + dy, G + h + 1, (dx + dy) % 2 ? "leaf" : "leaf2"); }
    for (const [dx, dy] of [[0, 0], [1, 0], [-1, 0], [0, 1], [0, -1]]) sc.set(x + dx, y + dy, G + h + 2, "leaf");
    sc.set(x, y, G + h + 3, "leaf2");
  }
  tree(8, 3, 3); tree(20, 9, 3); tree(2, 9, 4); tree(8, 20, 3); tree(20, 14, 2); tree(13, 6, 2);
  return sc;
}

// Mat cat ham nguc: khoi dat cat goc, lo ra phong co cong tim va ruong
function buildMine() {
  const sc = Scene(), N = 9, T = 11, R = rng(19);
  for (let x = 0; x < N; x++) for (let y = 0; y < N; y++) for (let z = 0; z <= T; z++) {
    let m = z === T ? "grass" : z >= T - 2 ? "dirt" : z >= 4 ? "stone" : "deep";
    const face = x === N - 1 || y === N - 1 || z === T;
    if (face && m === "stone") { const q = R(); if (q < 0.05) m = "coal"; else if (q < 0.08) m = "gold"; else if (q < 0.1) m = "redst"; }
    if (face && m === "deep") { const q = R(); if (q < 0.07) m = "diamond"; else if (q < 0.12) m = "redst"; else if (q < 0.15) m = "emer"; }
    sc.set(x, y, z, m);
  }
  for (let x = 4; x < N; x++) for (let y = 4; y < N; y++) for (let z = 4; z <= T; z++) sc.del(x, y, z);
  for (let x = 4; x < N; x++) for (let y = 4; y < N; y++) sc.set(x, y, 3, (x + y) % 2 ? "deep" : "obs");
  // cong tim tren tuong sau (mat y=3)
  sc.box(5, 3, 4, 8, 3, 8, "obs"); sc.box(6, 3, 4, 7, 3, 7, "portal");
  // duoc, ruong, bac da, dung nham
  sc.set(3, 6, 7, "glow"); sc.set(3, 6, 6, "wood");
  sc.set(7, 7, 4, "chest"); sc.set(5, 8, 4, "cobble"); sc.set(5, 8, 5, "cobble"); sc.set(5, 7, 4, "cobble");
  sc.set(8, 5, 4, "lava");
  // cay nho tren mat dat
  sc.set(1, 1, T + 1, "wood"); sc.set(1, 1, T + 2, "wood");
  for (let dx = -1; dx <= 1; dx++) for (let dy = -1; dy <= 1; dy++) sc.set(1 + dx, 1 + dy, T + 3, (dx + dy) % 2 ? "leaf2" : "leaf");
  sc.set(1, 1, T + 4, "leaf");
  return sc;
}

// Khoi co (logo)
function buildBlock() {
  const sc = Scene();
  sc.box(0, 0, 0, 3, 3, 2, "dirt"); sc.box(0, 0, 3, 3, 3, 3, "turf");
  sc.set(3, 1, 2, "turf"); sc.set(1, 3, 2, "turf"); sc.set(3, 3, 2, "turf"); sc.set(0, 3, 2, "turf");
  return sc;
}

for (const [name, build, scale] of [["town", buildTown, 6], ["mine", buildMine, 6], ["block", buildBlock, 8]]) {
  const g = renderIso(build());
  fs.writeFileSync(path.join(OUT, "art", name + ".png"), gridPng(g, scale));
  console.log("art", name, g[0].length + "x" + g.length, "->", g[0].length * scale + "x" + g.length * scale);
}
