// Preview server (Node) — mo phong app.py cua OLD TOWN de xem thu front end.
// Chi dung de xem giao dien: doc templates + static truc tiep tu thu muc du an,
// tra du lieu mau cho API, sinh HTML dien dan giong het cac ham trong app.py.
"use strict";
const http = require("http");
const fs = require("fs");
const path = require("path");

const BASE = process.env.OT_BASE || path.join(__dirname, "..", "oldtown-web");
const PORT = Number(process.env.PORT || 8787);
const esc = (s) => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
const V = () => Date.now().toString(36);

function renderPage(name, title, tokens, active, headExtra) {
  let layout = fs.readFileSync(path.join(BASE, "templates", "layout.html"), "utf8");
  let body = fs.readFileSync(path.join(BASE, "templates", name), "utf8");
  for (const [k, v] of Object.entries(tokens || {})) body = body.split("%%" + k + "%%").join(v);
  const v = V();
  layout = layout.split("%%HEAD_EXTRA%%").join((headExtra || "").split("%%V%%").join(v));
  layout = layout.split("%%ASSET_V%%").join(v);
  const nav = {};
  for (const k of ["home", "luat", "huongdan", "forum", "bxh", "taikhoan"]) nav[k] = k === active ? ' class="active"' : "";
  return layout.split("%%TITLE%%").join(esc(title)).split("%%BODY%%").join(body)
    .split("%%NAV_HOME%%").join(nav.home).split("%%NAV_LUAT%%").join(nav.luat)
    .split("%%NAV_HD%%").join(nav.huongdan).split("%%NAV_FORUM%%").join(nav.forum)
    .split("%%NAV_BXH%%").join(nav.bxh).split("%%NAV_TK%%").join(nav.taikhoan);
}

// ---------- guide_section (sach trong game) ----------
function guideSection(text) {
  const lines = text.replace(/§[0-9a-fk-orx]/gi, "").split("\n").map((l) => l.trimEnd()).filter((l) => l.trim() !== "");
  if (!lines.length) return "";
  const out = ['<div class="guide-card"><h3><span class="sec-no">§</span>' + esc(lines[0]) + "</h3>"];
  let inList = false;
  for (const ln of lines.slice(1)) {
    const e = esc(ln);
    if (ln.startsWith("▪")) {
      if (!inList) { out.push("<ul>"); inList = true; }
      out.push("<li>" + e.slice(1).trim() + "</li>");
    } else {
      if (inList) { out.push("</ul>"); inList = false; }
      out.push("<p>" + e + "</p>");
    }
  }
  if (inList) out.push("</ul>");
  out.push("</div>");
  return out.join("");
}
const GUIDE = [
  "Bìa",
  "§1 LUẬT CHUNG\n▪ Tôn trọng mọi cư dân — không chửi bới, phân biệt, quấy rối.\n▪ Cấm hack/cheat, phần mềm thứ ba và lợi dụng lỗi game dưới mọi hình thức.\n▪ Cấm phá hoại (grief) công trình và tài sản của người khác.\n▪ Không quảng cáo server khác, không spam chat.\nVi phạm sẽ bị xử theo §6 Chế tài.",
  "LỆNH CƠ BẢN\n▪ /sach — nhận lại sách hướng dẫn\n▪ /diemdanh — điểm danh nhận tiền mỗi ngày\n▪ /playtime — xem giờ chơi và quà\n▪ /spawn — về quảng trường thị trấn",
  "LÀNG & ĐẤT ĐAI\n▪ /town new <tên> — lập làng (50.000₫)\n▪ /town join <tên> — xin vào làng\n▪ /town claim — mua ô đất đang đứng (500₫)\n▪ /cccd — xem căn cước cư dân",
  "KINH TẾ\n▪ /shop — cửa hàng server\n▪ /ah — chợ đấu giá người chơi\n▪ /bank — ngân hàng, lãi 2%/ngày\n▪ /trade <tên> — giao dịch tận tay an toàn",
  "CHIẾN ĐẤU\n▪ /danhhieu — danh hiệu hầm ngục\n▪ /cuonghoa — cường hóa trang bị\n▪ /duel <tên> — thách đấu tay đôi\n▪ /bounty <tên> <tiền> — treo thưởng",
];

// ---------- du lieu mau dien dan (rut gon tu forum.py) ----------
const CATS = [
  [1, "Thông báo", "Thông báo chính thức từ ban quản trị server", "megaphone"],
  [2, "Hướng dẫn người mới", "Đăng ký, chọn nghề, kiếm tiền và những điều cần biết khi mới vào OLD TOWN", "book"],
  [3, "Khoe nhà / Build", "Show công trình, xin góp ý và khoe góc build tâm đắc", "home"],
  [4, "Tuyển town / Tìm đồng đội", "Tìm người lập town, tuyển cư dân, rủ nhau đi farm và khám phá", "users"],
  [5, "Chợ / Trade", "Mua bán qua /ah và /trade, rao giá và tìm món đang cần", "cart"],
  [6, "Hỏi đáp / Báo lỗi", "Thắc mắc về luật, nghề, redstone và báo lỗi khi chơi (Java & PE)", "help"],
  [7, "Chuyện ngoài lề", "Tán gẫu ngoài Minecraft, miễn không vi phạm nội quy", "chat"],
].map(([id, name, description, icon]) => ({ id, name, description, icon }));
const THREADS = [
  [1, 1, "AdminOT", "Nội quy diễn đàn & luật server OLD TOWN — đọc kỹ §5, §6, §7 trước khi chơi", "nội-quy,luật-server", 1, 842, "06/10/2026 16:20", 2, 3, 0, "Chào cư dân OLD TOWN. Đây là bản tóm tắt luật đang áp dụng trên server, đăng lên diễn đàn để mọi người tra cứu bất cứ lúc nào"],
  [2, 1, "AdminOT", "Diễn đàn OLD TOWN mở bản dựng thử — mời cư dân vào góp ý", "thông-báo", 1, 517, "03/11/2026 16:20", 1, 3, 0, "Diễn đàn cộng đồng của OLD TOWN chính thức có bản dựng thử. Mọi người có thể đăng bài, trả lời, thả cảm xúc"],
  [3, 2, "ModLinh", "Người mới bắt đầu: đăng ký web, liên kết Gmail, chọn nghề và kiếm tiền đầu tiên", "người-mới,nghề,kiếm-tiền", 1, 689, "16/10/2026 16:20", 2, 3, 0, "Hướng dẫn nhanh cho cư dân mới vào OLD TOWN: 1. Đăng ký tài khoản CHỈ trên website của server"],
  [4, 6, "DanChoJava", "Sao máy redstone của mình cứ đứng yên, không chạy nữa?", "redstone,chống-lag", 0, 356, "30/10/2026 16:20", 2, 3, 10, "Mình dựng cái clock nhỏ bằng repeater với observer mà chạy được vài giây là đứng yên, tắt luôn."],
  [5, 3, "KienXayNha", "Khoe căn nhà gỗ sồi đầu tiên ở khu ngoại ô — xin góp ý phần mái", "nhà-gỗ,góp-ý", 0, 274, "01/11/2026 16:20", 2, 3, 0, "Sau 3 buổi tối chặt gỗ (nghề tiều phu nên gỗ là của nhà trồng được), mình dựng xong căn nhà gỗ sồi 2 tầng"],
  [6, 5, "ThoMo99", "[Bán] Quặng sắt + kim cương đào tay, giá chợ — giao dịch qua /ah cho an toàn", "bán,quặng", 0, 198, "04/11/2026 16:20", 1, 3, 0, "Mình là thợ mỏ, vừa xong chuyến đào sâu nên dư: sắt thô, ít kim cương và redstone"],
  [7, 4, "LaoNongOT", "Khu nông trại Sông Xanh tuyển 2 cư dân: có đất sẵn, chỉ cần chăm farm đúng nghề", "tuyển-người,nông-trại", 0, 167, "31/10/2026 16:20", 1, 3, 0, "Khu nông trại của mình ở ven sông đang thừa 2 khoảnh đất đẹp. Tuyển cư dân nghề nông dân"],
  [8, 6, "BeThaoPE", "PE đăng nhập bằng Gmail thế nào? Mình nhập mật khẩu cũ nó báo không đúng", "pe,đăng-nhập,gmail", 0, 231, "02/11/2026 16:20", 2, 3, 20, "Mình chơi trên điện thoại. Tài khoản của mình đã liên kết Gmail trên web rồi"],
].map(([id, category_id, author_name, title, tags, pinned, views, created, replies, likes, solved, excerpt]) =>
  ({ id, category_id, author_name, title, tags, pinned, views, created, replies, likes, solved_post_id: solved, excerpt, locked: 0, is_sample: 1,
     category_name: CATS.find((c) => c.id === category_id).name }));

const ICONS = {
  megaphone: '<path d="m3 11 18-5v12L3 13v-2z"/><path d="M11.6 16.8a3 3 0 1 1-5.8-1.6"/>',
  book: '<path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"/><path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"/>',
  home: '<path d="m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><path d="M9 22V12h6v10"/>',
  users: '<path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>',
  cart: '<circle cx="8" cy="21" r="1"/><circle cx="19" cy="21" r="1"/><path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6"/>',
  help: '<circle cx="12" cy="12" r="10"/><path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"/><line x1="12" y1="17" x2="12.01" y2="17"/>',
  chat: '<path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>',
  flame: '<path d="M8.5 14.5A2.5 2.5 0 0 0 11 12c0-1.38-.5-2-1-3-1.072-2.143-.224-4.054 2-6 .5 2.5 2 4.9 4 6.5 2 1.6 3 3.5 3 5.5a7 7 0 1 1-14 0c0-1.153.433-2.294 1-3a2.5 2.5 0 0 0 2.5 2.5z"/>',
  search: '<circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>',
  menu: '<line x1="4" y1="6" x2="20" y2="6"/><line x1="4" y1="12" x2="20" y2="12"/><line x1="4" y1="18" x2="20" y2="18"/>',
  "chev-up": '<polyline points="18 15 12 9 6 15"/>',
  "chev-down": '<polyline points="6 9 12 15 18 9"/>',
};
const icon = (n, s = 18) => `<svg width="${s}" height="${s}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${ICONS[n] || ICONS.chat}</svg>`;
function avatar(name, size = 42) {
  const nm = (name || "?").trim();
  const initials = (nm.match(/[\p{L}\p{N}]/gu) || []).slice(0, 2).join("").toUpperCase() || "?";
  const idx = [...Buffer.from(nm, "utf8")].reduce((a, b) => a + b, 0) % 10;
  return `<span class="f-avatar f-av-${idx}${size <= 32 ? " f-av-sm" : ""}">${esc(initials)}</span>`;
}
const rolePill = (n) => n === "AdminOT" ? '<span class="f-badge role-admin">Quản trị</span>' : (n === "ModLinh" ? '<span class="f-badge role-mod">Điều hành</span>' : "");
const trustLabel = (c) => c >= 10 ? "Cư dân lâu năm" : c >= 5 ? "Cư dân tích cực" : c >= 1 ? "Cư dân mới" : "Mới tham gia";
function badges(t) {
  let o = "";
  if (t.pinned) o += '<span class="f-badge gold">Ghim</span>';
  if (t.locked) o += '<span class="f-badge">Đã khóa</span>';
  if (t.solved_post_id) o += '<span class="f-badge ok">Đã giải đáp</span>';
  if (t.is_sample) o += '<span class="f-badge sample">Bài mẫu</span>';
  return o;
}
const tagChips = (tags) => (tags || "").split(",").map((t) => t.trim()).filter(Boolean)
  .map((t) => `<a class="f-tag" href="/dien-dan?tag=${esc(t)}">#${esc(t)}</a>`).join(" ");
function threadRow(t) {
  return `<div class="f-thread" data-href="/dien-dan/chu-de/${t.id}" tabindex="0" role="link">${avatar(t.author_name)}`
    + `<span class="f-thread-main"><span class="f-thread-title">${esc(t.title)}</span>`
    + `<span class="f-thread-excerpt">${esc(t.excerpt)}</span>`
    + (t.id === 5 ? `<span class="f-thread-img"><img src="${SAMPLE_IMG}" alt="" loading="lazy"></span>` : "")
    + `<span class="f-thread-meta">${esc(t.author_name)} · ${t.created} · ${esc(t.category_name)} ${badges(t)}</span>`
    + `<span class="f-thread-tags">${tagChips(t.tags)}</span></span>`
    + `<span class="f-thread-stats"><b>${t.replies}</b> trả lời<br><b>${t.views}</b> lượt xem<br><b>${t.likes}</b> thích</span></div>`;
}
const hotRow = (rank, t) => `<a class="f-hot-row" href="/dien-dan/chu-de/${t.id}"><span class="f-hot-num">${rank}</span>`
  + `<span class="f-hot-main"><span class="f-hot-title">${esc(t.title)}</span>`
  + `<span class="f-hot-meta">${t.replies} trả lời · ${t.views} lượt xem · ${t.likes} thích</span></span></a>`;
function catRow(c) {
  const ts = THREADS.filter((t) => t.category_id === c.id);
  let latest = `${ts.length} chủ đề · ${ts.length * 3} bài viết`;
  if (ts.length) latest += ` · mới nhất: ${ts[ts.length - 1].title}`;
  return `<a class="f-cat" href="/dien-dan/chuyen-muc/${c.id}"><span class="f-cat-icon f-ci-${c.id}">${icon(c.icon, 22)}</span>`
    + `<span class="f-cat-main"><b>${esc(c.name)}</b><span>${esc(c.description)}</span>`
    + `<span class="f-cat-meta">${esc(latest)}</span></span><span class="f-cat-go">Vào</span></a>`;
}
function sidebar(active, me) {
  const profile = me
    ? `<div class="f-card"><div class="f-profile">${avatar(me)}<span><span class="f-pname">${esc(me)}</span><span class="f-ptrust">Cư dân tích cực · 6 bài viết</span></span></div><div class="f-mt"><a class="f-btn" href="/ho-so">Hồ sơ của tôi</a></div></div>`
    : `<div class="f-card"><div class="f-profile">${avatar("?")}<span><span class="f-pname">Chưa đăng nhập</span><span class="f-ptrust">Đăng nhập để viết bài, bình chọn</span></span></div><div class="f-mt"><a class="f-btn f-btn-accent" href="/tai-khoan">Đăng nhập</a></div></div>`;
  const nav = '<div class="f-side-label">Diễn đàn</div><a class="f-navlink" href="/dien-dan">Trang chủ diễn đàn</a>'
    + '<a class="f-navlink" href="/luat">Luật &amp; nội quy</a><a class="f-navlink" href="/bang-xep-hang">Bảng xếp hạng</a>'
    + '<div class="f-side-label">Chuyên mục</div>';
  const links = CATS.map((c) => `<a class="f-catlink${active === c.id ? " active" : ""}" href="/dien-dan/chuyen-muc/${c.id}">`
    + `<span class="f-cc-${c.id}">${icon(c.icon, 17)}</span><span>${esc(c.name)}</span>`
    + `<span class="f-count">${THREADS.filter((t) => t.category_id === c.id).length} chủ đề</span></a>`).join("");
  return `<aside class="f-side" id="forumSide">${profile}${nav}${links}</aside>`;
}
function rail() {
  const top = [["AdminOT", 4, 6], ["ModLinh", 3, 5], ["LaoNongOT", 4, 3], ["BeThaoPE", 5, 3], ["CuDanMoi", 4, 3]];
  const rows = top.map(([n, p, l], i) => `<div class="f-rail-row"><span class="f-rank">${i + 1}</span>${avatar(n, 32)}`
    + `<span class="f-rname">${esc(n)}</span><span class="f-rmeta">${p} bài · ${l} thích</span></div>`).join("");
  return '<aside class="f-rail"><div class="f-card"><h3>Cư dân nổi bật</h3>' + rows + '</div>'
    + '<div class="f-card"><h3>Luật cần nhớ</h3><div class="f-law">'
    + '<p><b>§ 5</b> Giao dịch ngoài hệ thống tự chịu rủi ro, admin không đòi đồ hộ.</p>'
    + '<p><b>§ 6</b> Admin chỉ can thiệp hack/cheat, lừa đảo hệ thống, lỗi diện rộng.</p>'
    + '<p><b>§ 7</b> Trần farm 15 con/chunk, quá 8 con/ô bị ngạt; đa số linh kiện redstone bị chặn.</p></div></div>'
    + '<div class="f-card"><h3>Thống kê</h3><div class="f-law"><p>8 thành viên đã viết bài</p><p>10 chủ đề · 25 bài viết</p></div></div></aside>';
}
function fHeader(q, me) {
  const login = me ? '<a class="f-btn" href="/ho-so">Tài khoản</a>' : '<a class="f-btn" href="/tai-khoan">Đăng nhập</a>';
  return '<div class="f-topbar"><button class="f-btn f-drawer-btn" id="forumDrawerBtn" type="button" aria-label="Mở chuyên mục">'
    + icon("menu", 18) + ' Chuyên mục</button><a class="f-logo" href="/dien-dan"><span class="f-logo-mark">OT</span>'
    + '<span><span class="f-logo-name">Diễn đàn</span><span class="f-logo-sub">OLD TOWN</span></span></a>'
    + `<form class="f-search-pill" method="get" action="/dien-dan">${icon("search", 18)}`
    + `<input type="search" name="q" value="${esc(q || "")}" placeholder="Tìm chủ đề, hướng dẫn…" aria-label="Tìm trong diễn đàn"></form>`
    + '<a class="f-btn f-btn-accent" href="/dien-dan/tao-bai">Tạo bài viết</a>' + login + '</div>';
}
const fLayout = (h, s, m, r) => h + '<div class="f-drawer-overlay" id="forumDrawerOverlay"></div><div class="f-grid">' + s + '<div class="f-main">' + m + '</div>' + r + '</div>';
function sortTabs(base, sort) {
  return '<div class="f-tabs">' + [["new", "Mới nhất"], ["hot", "Đang hot"], ["top", "Nhiều thích"]]
    .map(([k, l]) => `<a href="${base}?sort=${k}"${k === sort ? ' class="active"' : ""}>${l}</a>`).join("") + "</div>";
}
const ATTACH = '<div class="f-attach" data-attach><input type="file" accept="image/png,image/jpeg,image/webp,image/gif" multiple hidden>'
  + '<button type="button" class="f-mini" data-attach-pick>+ Thêm ảnh</button><span class="f-attach-note">Tối đa 4 ảnh, mỗi ảnh không quá 4 MB (PNG, JPG, WebP, GIF)</span>'
  + '<div class="f-attach-list"></div></div>';
const SAMPLE_IMG = "/static/img/hero-sakura.webp";
const imgHtml = (u) => '<figure class="f-img"><a href="' + u + '" target="_blank" rel="noopener"><img src="' + u + '" alt="Ảnh đính kèm" loading="lazy"></a></figure>';
const forumPage = (title, body) => renderPage("forum.html", title, { FORUM_BODY: body }, "forum", '<script src="/static/forum.js?v=%%V%%" defer></script>');

function pgForum(sort, me) {
  const main = '<div class="f-hero"><h1>Cộng đồng cư dân OLD TOWN</h1>'
    + '<p>Chỗ cư dân hỏi đáp, khoe nhà, tuyển town và rao đồ — dùng chung tài khoản web + game, đăng nhập rồi mới đăng bài được. Bài gắn nhãn “Bài mẫu” là dữ liệu mẫu từ bản dựng thử.</p>'
    + '<a class="f-quick" href="/dien-dan/tao-bai">' + avatar(me || "?") + '<span class="f-quick-text">Bạn muốn chia sẻ gì với thị trấn?</span>'
    + '<span class="f-quick-btn">Ảnh</span><span class="f-quick-btn f-quick-post">Đăng bài</span></a>'
    + '<p class="f-stats"><b>8</b> thành viên · <b>10</b> chủ đề · <b>25</b> bài viết</p></div>'
    + '<h2 class="f-h2">' + icon("flame", 20) + ' Đang hot</h2><div>' + THREADS.slice(0, 5).map((t, i) => hotRow(i + 1, t)).join("") + '</div>'
    + '<h2 class="f-h2">Chuyên mục</h2><div class="f-cats">' + CATS.map(catRow).join("") + '</div>'
    + '<h2 class="f-h2">Tất cả chủ đề</h2>' + sortTabs("/dien-dan", sort) + '<div class="f-list">' + THREADS.map(threadRow).join("") + '</div>';
  return forumPage("Diễn đàn — OLD TOWN", fLayout(fHeader("", me), sidebar(null, me), main, rail()));
}
function pgCat(cid, sort, me) {
  const cat = CATS.find((c) => c.id === cid) || CATS[0];
  const ts = THREADS.filter((t) => t.category_id === cat.id);
  const main = `<p class="f-crumb"><a href="/dien-dan">Diễn đàn</a> / ${esc(cat.name)}</p><div class="f-hero"><h1>${esc(cat.name)}</h1><p>${esc(cat.description)}</p></div>`
    + sortTabs(`/dien-dan/chuyen-muc/${cat.id}`, sort) + '<div class="f-list">' + ts.map(threadRow).join("")
    + (ts.length ? "</div>" : '</div><p class="center muted">Chuyên mục này chưa có chủ đề nào — hãy là người mở đầu.</p>')
    + '<div class="f-mt-lg"><a class="f-btn f-btn-accent" href="/dien-dan/tao-bai">Tạo bài viết mới</a></div>';
  return forumPage(cat.name, fLayout(fHeader("", me), sidebar(cat.id, me), main, rail()));
}
function pgNew(me) {
  const opts = CATS.map((c) => `<option value="${c.id}">${esc(c.name)}</option>`).join("");
  const main = '<p class="f-crumb"><a href="/dien-dan">Diễn đàn</a> / Tạo bài viết mới</p><div class="f-hero"><h1>Tạo bài viết mới</h1>'
    + '<p>Đăng bằng tên tài khoản của bạn: <b>' + esc(me) + '</b>. Bài đăng đúng chuyên mục, không spam, không rao bán ngoài mục Chợ.</p></div>'
    + '<form class="form f-form" id="newThreadForm"><label>Chuyên mục<select name="category_id" id="ntCat">' + opts + '</select></label>'
    + '<label>Tiêu đề<input name="title" id="ntTitle" maxlength="120" required placeholder="Viết tiêu đề ngắn gọn, rõ ý…"></label>'
    + '<label>Thẻ (cách nhau bằng dấu phẩy, tối đa 5)<input name="tags" id="ntTags" maxlength="120" placeholder="vd: nhà-gỗ, góp-ý"></label>'
    + '<label>Nội dung<textarea name="content" id="ntContent" rows="10" maxlength="7500" placeholder="Viết nội dung bài viết…"></textarea></label>' + ATTACH
    + '<p class="form-msg" id="ntMsg"></p><button class="f-btn f-btn-accent f-btn-block" type="submit">Đăng bài</button></form>';
  return forumPage("Tạo bài viết", fLayout(fHeader("", me), sidebar(null, me), main, rail()));
}
function pgThread(tid, me) {
  const t = THREADS.find((x) => x.id === tid) || THREADS[3];
  const posts = [
    { id: 9, parent: null, a: "DanChoJava", c: "Mình dựng cái clock nhỏ bằng repeater với observer mà chạy được vài giây là đứng yên, tắt luôn. Server lag hay máy mình hỏng vậy mọi người? Trước đây vẫn chạy bình thường.\n> Máy vượt trần tần suất sẽ đứng yên — đó là cơ chế chống lag, không phải lỗi.\nMình đọc câu trên ở §7 mà vẫn chưa hiểu lắm.", d: "30/10/2026 16:20", best: 0, score: 3, n: 3 },
    { id: 10, parent: 9, a: "AdminOT", c: "Không phải lỗi đâu bạn. Server có RedstoneGuard: clock đổi trạng thái quá 3 lần/giây tại một vị trí sẽ bị giữ nhịp, và đa số linh kiện redstone (observer, repeater, comparator, piston, phễu...) nằm trong danh sách chặn đặt/chế tạo theo §7 để chống lag. Máy vượt trần thì đứng yên — đó là cơ chế, không phải bug.", d: "30/10/2026 16:25", best: 1, score: 5, n: 12 },
    { id: 11, parent: 10, a: "DanChoJava", c: "À ra vậy, cảm ơn admin. Vậy mình chuyển sang cơ chế tay gạt + đèn đỏ cho khu nhà là ổn.", d: "30/10/2026 16:40", best: 0, score: 1, n: 3 },
    { id: 12, parent: 9, a: "ModLinh", c: "Bổ sung: cần gạt, nút bấm, tấm đạp, đèn đỏ vẫn dùng bình thường nhé.", d: "30/10/2026 17:02", best: 0, score: 0, n: 6 },
  ];
  const kids = (pid) => posts.filter((p) => p.parent === pid);
  const text = (c) => { const parts = []; let plain = []; const fl = () => { if (plain.length) { parts.push(plain.join("<br>")); plain = []; } };
    for (const ln of esc(c).split("\n")) { if (ln.startsWith("&gt;")) { fl(); parts.push("<blockquote><p>" + ln.slice(4).trim() + "</p></blockquote>"); } else plain.push(ln); } fl(); return parts.join(""); };
  function post(p, depth) {
    const isOp = p.parent === null;
    const best = p.best ? '<span class="f-badge ok">Đáp án hay nhất</span>' : (me && me === t.author_name && !isOp ? `<button class="f-mini" data-best="${p.id}">Ghim làm đáp án hay nhất</button>` : "");
    const reacts = [["like", "Thích", 2], ["fire", "Cháy", 1], ["idea", "Ý hay", 0]].map(([k, l, n], i) =>
      `<button class="f-react${me && i === 0 && p.best ? " on" : ""}" data-react="${k}" data-post="${p.id}">${l} ${n}</button>`).join("");
    const children = kids(p.id).map((c) => post(c, Math.min(depth + 1, 3))).join("");
    return `<article class="f-post${isOp ? " f-op" : ""}${p.best ? " f-best" : ""}${depth ? " f-depth-" + depth : ""}" id="post-${p.id}">`
      + '<div class="f-post-inner"><div class="f-post-main">'
      + `<header>${avatar(p.a, 40)}<span><b>${esc(p.a)}</b> ${rolePill(p.a)}${isOp ? ' <span class="f-badge">Chủ thớt</span>' : ""} <span class="f-badge trust">${trustLabel(p.n)}</span> ${best}`
      + `<span class="muted"> · ${p.d}</span></span></header><div class="f-post-body">${text(p.c)}${isOp ? imgHtml(SAMPLE_IMG) : ""}</div><div class="f-actions">${reacts}`
      + (me ? `<button class="f-mini" data-reply="${p.id}">Trả lời</button><button class="f-mini" data-report="${p.id}">Báo cáo</button>` : "")
      + (me && !isOp && p.a === me ? `<button class="f-mini danger" data-delpost="${p.id}">Xóa bài</button>` : "")
      + '</div></div><div class="f-vote-col">'
      + `<button class="f-vote${me && p.best ? " on-up" : ""}" data-vote="1" data-post="${p.id}" aria-label="Bình chọn +1">${icon("chev-up", 16)}</button>`
      + `<span class="f-vote-score">${p.score}</span>`
      + `<button class="f-vote" data-vote="-1" data-post="${p.id}" aria-label="Bình chọn -1">${icon("chev-down", 16)}</button>`
      + '</div></div>' + children + "</article>";
  }
  const modBar = me ? `<div class="f-modbar">Quản trị: <button class="f-mini" data-flag="pinned" data-thread="${t.id}">Ghim</button> <button class="f-mini" data-flag="locked" data-thread="${t.id}">Khóa</button> <button class="f-mini danger" data-delthread="${t.id}">Xóa chủ đề</button></div>` : "";
  const reply = me
    ? '<div class="f-composer"><form class="form f-form" id="replyForm">' + `<input type="hidden" id="rpThread" value="${t.id}">`
      + '<input type="hidden" id="rpParent" value=""><label id="rpParentLabel" hidden>Đang trả lời bài <b id="rpParentName"></b> <button type="button" class="f-mini" id="rpCancel">Hủy</button></label>'
      + '<label>Trả lời với tên <b>' + esc(me) + '</b><textarea id="rpContent" rows="5" maxlength="7500" placeholder="Viết trả lời của bạn…"></textarea></label>' + ATTACH
      + '<p class="form-msg" id="rpMsg"></p><button class="f-btn f-btn-accent f-btn-block" type="submit">Gửi trả lời</button></form></div>'
    : '<p class="center"><a class="f-btn f-btn-accent" href="/tai-khoan">Đăng nhập để trả lời</a></p>';
  const main = `<p class="f-crumb"><a href="/dien-dan">Diễn đàn</a> / <a href="/dien-dan/chuyen-muc/${t.category_id}">${esc(t.category_name)}</a></p>`
    + `<h1 class="f-title">${esc(t.title)}</h1><p class="f-thread-head-meta">${esc(t.author_name)} · ${t.created} · ${t.views} lượt xem · ${tagChips(t.tags)} ${badges(t)}</p>`
    + modBar + kids(null).map((p) => post(p, 0)).join("") + '<h2 class="f-h2">Trả lời</h2>' + reply
    + (me ? '<a class="f-fab" href="#replyForm" aria-label="Trả lời">+</a>' : "");
  return forumPage(t.title, fLayout(fHeader("", me), sidebar(t.category_id, me), main, rail()));
}

// ---------- API mau ----------
const TOP = [["CuDanMau", 1284500], [".BanPE_Mau", 962300], ["KienXayNha", 731250], ["ThoMo99", 598400], ["LaoNongOT", 455120],
  ["BeThaoPE", 310900], ["DanChoJava", 248000], ["CuDanMoi", 96500], ["Steve_VN", 74200], [".MeoMuop", 51800], ["HoaiNam", 33900], ["BlockLover", 12050]]
  .map(([name, balance]) => ({ name, balance }));
function api(p, q, req) {
  if (p === "/api/status") return q.get("off") ? { server: { offline: true, online: 0, max: 0, version: "OLD TOWN" }, ip: { java: "play.oldtown.vn:11000", pe: "play.oldtown.vn" } }
    : { server: { offline: false, online: 37, max: 100, version: "OLD TOWN" }, ip: { java: "play.oldtown.vn:11000", pe: "play.oldtown.vn" } };
  if (p === "/api/stats") return { residents: 412, total_money: 18645300 };
  if (p === "/api/topmoney") return { top: TOP };
  if (p === "/api/config") return { email_on: true };
  if (p === "/api/forum/threads") return { threads: THREADS.slice(0, 3).map((t) => ({ id: t.id, title: t.title, author: t.author_name, category: t.category_name, replies: t.replies, views: t.views, likes: t.likes })) };
  if (p === "/api/me") return { ok: true, name: "CuDanMau", uuid: "3f2b9c1e-7a4d-4e0b-9c55-0d6f1a2b3c4d", balance: 1284500, discord_id: null, email: "ch***@gmail.com", email_on: true };
  if (p === "/api/forum/upload") return { ok: true, url: SAMPLE_IMG };
  if (p === "/api/otp/register" || p === "/api/otp/forgot" || p === "/api/otp/setemail") return { ok: true };
  if (req.method === "POST") return { ok: false, error: "Bản xem thử: thao tác này chỉ chạy trên server thật." };
  return null;
}

const MIME = { ".css": "text/css; charset=utf-8", ".js": "application/javascript; charset=utf-8", ".png": "image/png", ".webp": "image/webp",
  ".svg": "image/svg+xml", ".json": "application/json", ".ico": "image/x-icon", ".woff2": "font/woff2", ".jpg": "image/jpeg" };
const CSP = "default-src 'self'; img-src 'self' data:; style-src 'self' https://fonts.googleapis.com; font-src 'self' https://fonts.gstatic.com; script-src 'self'";

http.createServer((req, res) => {
  const u = new URL(req.url, "http://x");
  const p = decodeURIComponent(u.pathname);
  const me = u.searchParams.get("me") || (/(?:^|; )pv_me=([^;]+)/.exec(req.headers.cookie || "") || [])[1] || null;
  const send = (code, type, body, extra) => { res.writeHead(code, Object.assign({ "Content-Type": type, "Content-Security-Policy": CSP, "X-Content-Type-Options": "nosniff", "Cache-Control": "no-store" }, extra || {})); res.end(body); };
  const html = (b) => send(200, "text/html; charset=utf-8", b);
  try {
    if (p.startsWith("/static/")) {
      const f = path.join(BASE, p);
      if (!f.startsWith(path.join(BASE, "static")) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) return send(404, "text/plain", "404");
      return send(200, MIME[path.extname(f).toLowerCase()] || "application/octet-stream", fs.readFileSync(f));
    }
    if (p.startsWith("/api/")) { const d = api(p, u.searchParams, req); return d ? send(200, "application/json", JSON.stringify(d)) : send(404, "application/json", "{}"); }
    if (p === "/") return html(renderPage("home.html", "OLD TOWN — Server Minecraft Việt Nam", null, "home"));
    if (p === "/luat") return html(renderPage("luat.html", "Luật server — OLD TOWN", { LUAT_GAME: guideSection(GUIDE[1]) }, "luat"));
    if (p === "/cap-nhat") return html(renderPage("capnhat.html", "Nhật ký cập nhật — OLD TOWN"));
    if (p === "/huong-dan") return html(renderPage("huongdan.html", "Hướng dẫn chơi — OLD TOWN", { HD_GAME: GUIDE.slice(2, 6).map(guideSection).join("") }, "huongdan"));
    if (p === "/bang-xep-hang") return html(renderPage("bxh.html", "Bảng xếp hạng tiền — OLD TOWN", null, "bxh"));
    if (p === "/tai-khoan") return html(renderPage("taikhoan.html", "Tài khoản — OLD TOWN", null, "taikhoan"));
    if (p === "/ho-so") return html(renderPage("hoso.html", "Hồ sơ — OLD TOWN", null, "taikhoan"));
    if (p === "/quen-mat-khau") return html(renderPage("quenmatkhau.html", "Quên mật khẩu — OLD TOWN", null, "taikhoan"));
    const sort = u.searchParams.get("sort") || "new";
    if (p === "/dien-dan") return html(pgForum(sort, me));
    if (p === "/dien-dan/tao-bai") return html(pgNew(me || "CuDanMau"));
    let m;
    if ((m = /^\/dien-dan\/chuyen-muc\/(\d+)$/.exec(p))) return html(pgCat(Number(m[1]), sort, me));
    if ((m = /^\/dien-dan\/chu-de\/(\d+)$/.exec(p))) return html(pgThread(Number(m[1]), me));
    send(404, "text/plain; charset=utf-8", "404: Not Found");
  } catch (e) { send(500, "text/plain; charset=utf-8", String(e && e.stack || e)); }
}).listen(PORT, "127.0.0.1", () => console.log("preview http://127.0.0.1:" + PORT));
