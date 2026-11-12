// Thu app.py that: trang, tai anh, dang bai kem anh, hien thi anh.
const crypto = require("crypto"), fs = require("fs");
const B = "http://127.0.0.1:8788", SECRET = "devsecret";
const raw = Buffer.from(JSON.stringify({ name: "Chooty_427", uuid: "u-1", exp: Math.floor(Date.now() / 1000) + 3600 })).toString("base64url") + "==".slice(0, 0);
const b64 = Buffer.from(JSON.stringify({ name: "Chooty_427", uuid: "u-1", exp: Math.floor(Date.now() / 1000) + 3600 })).toString("base64").replace(/\+/g, "-").replace(/\//g, "_");
const cookie = "ot_session=" + b64 + "." + crypto.createHmac("sha256", SECRET).update(b64).digest("hex");
const ok = (c, m) => { console.log((c ? "PASS " : "FAIL ") + m); if (!c) process.exitCode = 1; };
(async () => {
  for (let i = 0; i < 90; i++) { try { await fetch(B + "/api/config"); break; } catch (e) { await new Promise((r) => setTimeout(r, 2000)); } }
  for (const p of ["/", "/luat", "/huong-dan", "/cap-nhat", "/bang-xep-hang", "/tai-khoan", "/quen-mat-khau", "/dien-dan", "/dien-dan/chuyen-muc/3", "/dien-dan/chu-de/4"]) {
    const r = await fetch(B + p); const t = await r.text(); ok(r.status === 200 && !t.includes("%%"), "GET " + p + " " + r.status);
  }
  let r = await fetch(B + "/dien-dan/tao-bai", { headers: { cookie } }); let t = await r.text();
  ok(r.status === 200 && t.includes("data-attach-pick"), "form tao bai co nut Them anh");
  r = await fetch(B + "/api/forum/upload", { method: "POST", body: (() => { const f = new FormData(); f.append("file", new Blob([Buffer.from("khong phai anh")]), "x.png"); return f; })() });
  ok(r.status === 401, "upload khi chua dang nhap -> 401");
  const fd0 = new FormData(); fd0.append("file", new Blob([Buffer.from("<svg onload=alert(1)>")]), "x.png");
  let d = await (await fetch(B + "/api/forum/upload", { method: "POST", headers: { cookie }, body: fd0 })).json();
  ok(d.ok === false, "tu choi file khong phai anh: " + d.error);
  const fdBig = new FormData(); fdBig.append("file", new Blob([Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), Buffer.alloc(5 * 1024 * 1024)])]), "big.png");
  d = await (await fetch(B + "/api/forum/upload", { method: "POST", headers: { cookie }, body: fdBig })).json().catch((e) => ({ ok: false, error: "ket noi dong: " + e.message }));
  ok(d.ok === false, "tu choi anh > 4MB: " + d.error);
  const png = fs.readFileSync(process.argv[2]);
  const fd = new FormData(); fd.append("file", new Blob([png]), "icon.png");
  d = await (await fetch(B + "/api/forum/upload", { method: "POST", headers: { cookie }, body: fd })).json();
  ok(d.ok && /^\/uploads\/[0-9a-f]{32}\.png$/.test(d.url), "upload PNG -> " + d.url);
  const url = d.url;
  r = await fetch(B + url); const got = Buffer.from(await r.arrayBuffer());
  ok(r.status === 200 && got.equals(png) && r.headers.get("content-type") === "image/png", "GET anh: " + r.status + " " + r.headers.get("content-type") + " nosniff=" + r.headers.get("x-content-type-options"));
  ok((await fetch(B + "/uploads/..%2fforum.db")).status === 404, "khong doc duoc file ngoai thu muc uploads");
  d = await (await fetch(B + "/api/forum/threads", { method: "POST", headers: { cookie, "Content-Type": "application/json" }, body: JSON.stringify({ category_id: 3, title: "Khoe nhà có ảnh", tags: "ảnh", content: "Nhà mới của mình đây <b>x</b>\n[anh:" + url + "]" }) })).json();
  ok(d.ok, "tao chu de kem anh -> id " + d.id);
  t = await (await fetch(B + "/dien-dan/chu-de/" + d.id)).text();
  ok(t.includes('<figure class="f-img"><a href="' + url + '"') && t.includes("&lt;b&gt;x&lt;/b&gt;") && !t.includes("[anh:"), "trang chu de hien anh, van escape HTML");
  t = await (await fetch(B + "/dien-dan")).text();
  ok(t.includes('<span class="f-thread-img"><img src="' + url + '"') && !t.includes("[anh:") && t.includes("f-quick"), "danh sach co anh thu nho + o dang nhanh");
  const tid = d.id;
  d = await (await fetch(B + "/api/forum/posts", { method: "POST", headers: { cookie, "Content-Type": "application/json" }, body: JSON.stringify({ thread_id: tid, content: "[anh:" + url + "]" }) })).json();
  ok(d.ok, "tra loi chi co anh");
  d = await (await fetch(B + "/api/forum/posts", { method: "POST", headers: { cookie, "Content-Type": "application/json" }, body: JSON.stringify({ thread_id: tid, content: Array(5).fill("[anh:" + url + "]").join("\n") }) })).json();
  ok(d.ok === false, "chan bai > 4 anh: " + d.error);
  d = await (await fetch(B + "/api/forum/threads?sort=hot&limit=3")).json();
  ok(d.ok && d.threads.length === 3 && d.threads[0].author, "API chu de hot co tac gia");
})().catch((e) => { console.log("ERR", e); process.exitCode = 1; });
