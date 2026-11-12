// Xuat ban demo tinh (du lieu mau) de dua len GitHub Pages.
//   node tools/export-static.js <thu muc ra> [/ten-repo]
// Chay preview-server o cong rieng, tai tung trang, doi duong dan tuyet doi
// sang co tien to (Pages phuc vu duoi /ten-repo/), ghi API mau thanh file tinh.
"use strict";
const fs = require("fs"), path = require("path"), { spawn } = require("child_process");
// ten repo truyen KHONG kem dau "/" (Git Bash tren Windows tu doi "/abc" thanh duong dan o dia)
const OUT = process.argv[2], NAME = (process.argv[3] || "").replace(/^\/+|\/+$/g, ""), BASE = NAME ? "/" + NAME : "";
if (!OUT) throw new Error("usage: node export-static.js <out dir> [/base]");
const ROOT = path.join(__dirname, ".."), PORT = 8791, ORIGIN = "http://127.0.0.1:" + PORT;
const ROUTES = "luat|huong-dan|cap-nhat|bang-xep-hang|tai-khoan|ho-so|quen-mat-khau|dien-dan|static|api|uploads";

const PAGES = ["/", "/luat", "/huong-dan", "/cap-nhat", "/bang-xep-hang", "/tai-khoan", "/ho-so", "/quen-mat-khau", "/dien-dan", "/dien-dan/tao-bai"]
  .concat([1, 2, 3, 4, 5, 6, 7].map((i) => "/dien-dan/chuyen-muc/" + i), [1, 2, 3, 4, 5, 6, 7, 8].map((i) => "/dien-dan/chu-de/" + i));
const APIS = ["/api/status", "/api/stats", "/api/topmoney", "/api/config", "/api/forum/threads", "/api/me"];
const NOTE = '<div class="demo-note" role="note">Bản demo giao diện · dữ liệu mẫu · đăng nhập và đăng bài không hoạt động ở đây</div>';

const fixHtml = (h) => h
  .replace(/\b(href|src|action|poster|srcset|data-href)="\/(?!\/)/g, `$1="${BASE}/`)
  .replace("</head>", '<meta name="robots" content="noindex">\n</head>')
  .replace('<div id="toast"', NOTE + '\n<div id="toast"');
const fixJs = (s) => s.replace(new RegExp(`(["'])/(${ROUTES})(?=[/"'?])`, "g"), `$1${BASE}/$2`);

function copyDir(src, dst) {
  fs.mkdirSync(dst, { recursive: true });
  for (const e of fs.readdirSync(src, { withFileTypes: true })) {
    const a = path.join(src, e.name), b = path.join(dst, e.name);
    if (e.isDirectory()) copyDir(a, b);
    else if (/\.js$/.test(e.name)) fs.writeFileSync(b, fixJs(fs.readFileSync(a, "utf8")));
    else if (!/^(media-generation-|hero(-\d+)?\.webp$)/.test(e.name)) fs.copyFileSync(a, b); // bo file thua, anh hero cu
  }
}

(async () => {
  for (const e of fs.existsSync(OUT) ? fs.readdirSync(OUT) : []) if (e !== ".git") fs.rmSync(path.join(OUT, e), { recursive: true, force: true });
  fs.mkdirSync(OUT, { recursive: true });
  const srv = spawn(process.execPath, [path.join(__dirname, "preview-server.js")], { env: Object.assign({}, process.env, { PORT: String(PORT) }), stdio: "ignore" });
  try {
    for (let i = 0; i < 50; i++) { try { await fetch(ORIGIN + "/api/config"); break; } catch (e) { await new Promise((r) => setTimeout(r, 200)); } }
    for (const p of PAGES) {
      const r = await fetch(ORIGIN + p);
      if (r.status !== 200) throw new Error(p + " -> " + r.status);
      const dir = path.join(OUT, p);
      fs.mkdirSync(dir, { recursive: true });
      fs.writeFileSync(path.join(dir, "index.html"), fixHtml(await r.text()));
    }
    for (const p of APIS) {
      const f = path.join(OUT, p);
      fs.mkdirSync(path.dirname(f), { recursive: true });
      fs.writeFileSync(f, fixJs(await (await fetch(ORIGIN + p)).text()));
    }
  } finally { srv.kill(); }
  copyDir(path.join(ROOT, "oldtown-web", "static"), path.join(OUT, "static"));
  fs.appendFileSync(path.join(OUT, "static", "style.css"),
    "\n/* chi co o ban demo tinh */\n.demo-note{background:#000;color:var(--mc-yellow);text-align:center;font:500 20px/1.3 var(--font-mono);padding:10px 16px}\n");
  fs.copyFileSync(path.join(OUT, "index.html"), path.join(OUT, "404.html"));
  fs.writeFileSync(path.join(OUT, ".nojekyll"), "");
  fs.writeFileSync(path.join(OUT, "README.md"), "# OLD TOWN — bản demo giao diện\n\nBản tĩnh xuất từ website OLD TOWN, chỉ để xem giao diện với dữ liệu mẫu.\nKhông phải sản phẩm chính thức của Minecraft; không liên kết với Mojang hay Microsoft.\n");
  console.log("exported", PAGES.length, "pages ->", OUT, "base", BASE || "/");
})().catch((e) => { console.error(e); process.exit(1); });
