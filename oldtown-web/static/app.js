// OLD TOWN — giao dien "Vanilla Pixel": menu, trang thai, so lieu,
// copy IP, bxh, muc luc trang doc, tai khoan (OTP Gmail).
(function () {
  "use strict";
  const $ = (s, c) => (c || document).querySelector(s);
  const $$ = (s, c) => Array.from((c || document).querySelectorAll(s));
  const fmt = (n) => new Intl.NumberFormat("vi-VN").format(Math.round(n)) + "₫";
  const reduced = matchMedia("(prefers-reduced-motion: reduce)").matches;

  function toast(msg) {
    const t = $("#toast");
    if (!t) return;
    t.textContent = msg;
    t.classList.add("show");
    clearTimeout(t._h);
    t._h = setTimeout(() => t.classList.remove("show"), 2600);
  }

  // --- menu mobile ---
  // hotbar: danh dau o dang chon (ke ca /cap-nhat, trang khong co token active tu server)
  const links = $("#navLinks");
  if (links) {
    const here = location.pathname.replace(/\/+$/, "") || "/";
    $$("a", links).forEach((a) => {
      const href = a.getAttribute("href");
      if (href === here || (href !== "/" && here.startsWith(href + "/"))) a.setAttribute("aria-current", "page");
    });
  }

  // video nen: neu nguoi dung bat "giam chuyen dong" thi dung o khung hinh cho
  const heroVideo = $(".hero-bg video");
  if (heroVideo && reduced) { heroVideo.removeAttribute("autoplay"); heroVideo.pause(); }

  // --- thanh XP = tien do cuon trang (gan qua CSSOM, khong vi pham CSP) ---
  const xp = $("#xpFill");
  if (xp) {
    let ticking = false;
    const paint = () => {
      ticking = false;
      const h = document.documentElement, max = h.scrollHeight - h.clientHeight;
      xp.style.transform = "scaleX(" + (max > 0 ? Math.min(1, h.scrollTop / max) : 0) + ")";
    };
    const queue = () => { if (!ticking) { ticking = true; requestAnimationFrame(paint); } };
    addEventListener("scroll", queue, { passive: true });
    addEventListener("resize", queue);
    paint();
  }

  // --- muc luc cho trang doc dai (luat / huong dan / cap nhat) ---
  const doc = $(".doc"), toc = $("#docToc");
  if (doc && toc) {
    const heads = $$(".guide-card > h3", doc);
    if (heads.length >= 3) {
      const title = document.createElement("p");
      title.className = "doc-toc-title";
      title.textContent = "Mục lục";
      toc.appendChild(title);
      const items = heads.map((h, i) => {
        const card = h.parentElement;
        if (!card.id) card.id = "muc-" + (i + 1);
        const a = document.createElement("a");
        a.href = "#" + card.id;
        const no = $(".sec-no", h), noText = no ? no.textContent.trim() : "";
        const label = h.textContent.replace(/\s+/g, " ").trim().slice(noText.length).trim();
        a.textContent = (noText && noText !== "§" ? noText + " " : "") + label;
        toc.appendChild(a);
        return { card, a };
      });
      doc.classList.add("has-toc");
      if ("IntersectionObserver" in window) {
        const seen = new Set();
        const io = new IntersectionObserver((entries) => {
          entries.forEach((en) => { if (en.isIntersecting) seen.add(en.target); else seen.delete(en.target); });
          const cur = items.find((it) => seen.has(it.card));
          if (cur) items.forEach((it) => it.a.classList.toggle("on", it === cur));
        }, { rootMargin: "-96px 0px -55% 0px" });
        items.forEach((it) => io.observe(it.card));
      }
    }
  }

  // --- dem so len (count-up) ---
  function countUp(el, target, suffix) {
    if (!el) return;
    suffix = suffix || "";
    if (reduced || target <= 0) { el.textContent = new Intl.NumberFormat("vi-VN").format(target) + suffix; return; }
    const dur = 1100, t0 = performance.now();
    (function step(t) {
      const p = Math.min(1, (t - t0) / dur), e = 1 - Math.pow(1 - p, 3);
      el.textContent = new Intl.NumberFormat("vi-VN").format(Math.round(target * e)) + suffix;
      if (p < 1) requestAnimationFrame(step);
    })(t0);
  }

  // --- trang thai + IP + so lieu ---
  let IPS = { java: "", pe: "" };
  async function loadStatus() {
    try {
      const d = await (await fetch("/api/status")).json();
      IPS = d.ip || IPS;
      const ij = $("#ipJava"), ip = $("#ipPe");
      if (ij) ij.textContent = IPS.java || "—";
      if (ip) ip.textContent = IPS.pe || "—";
      const dot = $("#statusDot"), txt = $("#statusText");
      if (txt) {
        if (d.server.offline) { txt.textContent = "Server đang tắt — sẽ mở lại sớm"; if (dot) dot.className = "dot off"; }
        else { txt.textContent = "Server đang mở · " + d.server.online + "/" + d.server.max + " người chơi · " + d.server.version; if (dot) dot.className = "dot on"; }
      }
      // chip trang thai tren thanh HUD (co o moi trang)
      const hd = $("#hudDot"), ho = $("#hudOnline");
      if (ho) {
        ho.textContent = d.server.offline ? "Đang tắt" : d.server.online + "/" + d.server.max;
        if (hd) hd.className = d.server.offline ? "dot off" : "dot on";
      }
      const so = $("#stOnline");
      if (so) countUp(so, d.server.offline ? 0 : d.server.online);
    } catch (e) { const ho = $("#hudOnline"); if (ho) ho.textContent = "—"; }
    if (!$("#stResidents")) return;
    try {
      const s = await (await fetch("/api/stats")).json();
      countUp($("#stResidents"), s.residents || 0);
      countUp($("#stMoney"), s.total_money || 0, "₫");
    } catch (e) { /* bo qua */ }
  }
  if ($("#statusText") || $("#stOnline") || $("#hudOnline")) loadStatus();

  // --- copy IP ---
  $$("[data-copy]").forEach((btn) => btn.addEventListener("click", async () => {
    const v = IPS[btn.dataset.copy];
    if (!v) { toast("Đang tải địa chỉ, thử lại sau giây lát…"); return; }
    try {
      await navigator.clipboard.writeText(v);
      toast("Đã sao chép: " + v);
      const lbl = $(".ip-copy", btn);
      if (lbl) {
        if (!lbl.dataset.t) lbl.dataset.t = lbl.textContent;
        lbl.textContent = "ĐÃ CHÉP";
        btn.classList.add("copied");
        clearTimeout(btn._h);
        btn._h = setTimeout(() => { lbl.textContent = lbl.dataset.t; btn.classList.remove("copied"); }, 1800);
      }
    }
    catch (e) { toast("Địa chỉ: " + v); }
  }));

  // --- bang xep hang + top 5 trang chu ---
  async function loadBoard() {
    const body = $("#boardBody"), pod = $("#podium"), prev = $("#topPreview");
    if (!body && !prev) return;
    try {
      const d = await (await fetch("/api/topmoney?limit=50")).json();
      const rows = d.top || d.players || [];
      if (prev) {
        if (!rows.length) { prev.innerHTML = '<li><span class="tp-name muted">Chưa có dữ liệu.</span></li>'; return; }
        prev.innerHTML = rows.slice(0, 5).map((p, i) =>
          '<li><span class="rank">' + (i + 1) + '</span><span class="tp-name">' +
          p.name.replace(/</g, "&lt;") + '</span><span class="tp-amt">' + fmt(p.balance) + "</span></li>").join("");
        return;
      }
      if (!rows.length) { body.innerHTML = '<tr><td colspan="3" class="muted">Chưa có dữ liệu.</td></tr>'; return; }
      // buc 3 bac: hang 1 o giua (CSS order), khoi vang / sat / dong
      if (pod) pod.innerHTML = rows.slice(0, 3).map((p, i) =>
        '<div class="pod pod-' + (i + 1) + '"><img class="pod-head" src="/static/img/px/head.svg" width="64" height="64" alt="">' +
        '<div class="pname">' + p.name.replace(/</g, "&lt;") + '</div><div class="pbal">' + fmt(p.balance) +
        '</div><div class="pod-block">' + (i + 1) + "</div></div>").join("");
      body.innerHTML = rows.map((p, i) =>
        '<tr><td><span class="rank">' + (i + 1) + '</span></td><td>' + p.name.replace(/</g, "&lt;") +
        '</td><td class="num">' + fmt(p.balance) + "</td></tr>").join("");
    } catch (e) {
      if (body) body.innerHTML = '<tr><td colspan="3" class="muted">Chưa tải được dữ liệu, thử lại sau.</td></tr>';
    }
  }
  loadBoard();
  if ($("#boardBody")) setInterval(loadBoard, 60000);

  // --- dien dan: 3 chu de dang hot tren trang chu ---
  const fh = $("#forumHot");
  if (fh) (async () => {
    try {
      const d = await (await fetch("/api/forum/threads?sort=hot&limit=3")).json();
      const rows = d.threads || [];
      if (!rows.length) { fh.innerHTML = '<p class="f-hot-meta">Diễn đàn vừa mở — hãy là người đăng bài đầu tiên.</p>'; return; }
      fh.innerHTML = rows.map((t, i) =>
        '<a class="f-hot-row" href="/dien-dan/chu-de/' + t.id + '">'
        + '<span class="f-hot-num">' + (i + 1) + '</span>'
        + '<span class="f-hot-main"><span class="f-hot-title">'
        + (t.author ? '<b class="chat-name">&lt;' + String(t.author).replace(/</g, "&lt;") + '&gt;</b> ' : "")
        + t.title.replace(/</g, "&lt;") + '</span>'
        + '<span class="f-hot-meta">' + t.replies + ' trả lời · ' + t.views + ' lượt xem · ' + t.likes + ' thích</span></span></a>').join("");
    } catch (e) { fh.innerHTML = '<p class="f-hot-meta">Chưa tải được diễn đàn — <a href="/dien-dan">vào diễn đàn →</a></p>'; }
  })();

  // --- tai khoan ---
  async function post(url, obj) {
    const r = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(obj) });
    return r.json();
  }
  function msg(id, ok, text) { const m = $(id); if (m) { m.className = "form-msg " + (ok ? "ok" : "err"); m.textContent = text; } }

  // --- tab dang nhap / dang ky ---
  const tabL = $("#tabLogin"), tabR = $("#tabRegister");
  function setTab(reg) {
    if (!tabL || !tabR) return;
    tabL.classList.toggle("active", !reg);
    tabR.classList.toggle("active", reg);
    tabL.closest(".auth-tabs").classList.toggle("reg", reg);
    $("#loginForm").hidden = reg;
    $("#registerForm").hidden = !reg;
    $("#authSuccess").hidden = true;
  }
  if (tabL && tabR) {
    tabL.addEventListener("click", () => setTab(false));
    tabR.addEventListener("click", () => setTab(true));
  }

  // --- nut Hien/An mat khau ---
  $$("[data-pw]").forEach((b) => b.addEventListener("click", () => {
    const inp = b.parentElement.querySelector("input");
    const show = inp.type === "password";
    inp.type = show ? "text" : "password";
    b.textContent = show ? "Ẩn" : "Hiện";
    inp.focus();
  }));

  // --- kiem tra truc tiep khi dang ky ---
  const regName = $("#regName"), regPass = $("#regPass"), regConfirm = $("#regConfirm");
  if (regName) regName.addEventListener("input", () => {
    const h = $("#nameHint"), v = regName.value.trim();
    if (!v) { h.textContent = ""; h.className = "field-hint"; return; }
    const ok = /^\.?[A-Za-z0-9_]+( [A-Za-z0-9_]+)*$/.test(v) && v.length >= 3 && v.length <= 17;
    h.textContent = ok ? (v.startsWith(".")
        ? "Tên PE hợp lệ — vào game bằng điện thoại với đúng tên này (kèm dấu chấm)."
        : "Tên hợp lệ — hãy nhớ đúng chữ hoa/thường này khi vào game.")
      : "Tên chưa hợp lệ: 3–17 ký tự (chữ, số, dấu _); người chơi PE thêm dấu . ở đầu tên.";
    h.className = "field-hint " + (ok ? "ok" : "err");
  });
  if (regPass) regPass.addEventListener("input", () => {
    const v = regPass.value, s = $("#strength");
    let n = 0;
    if (v.length >= 6) n++;
    if (v.length >= 10) n++;
    if (/[a-z]/.test(v) && /[A-Z]/.test(v) && (/\d/.test(v) || /[^A-Za-z0-9]/.test(v))) n++;
    s.className = "strength" + (v ? " s" + Math.max(1, n) : "");
    checkConfirm();
  });
  function checkConfirm() {
    if (!regConfirm) return;
    const h = $("#confirmHint");
    if (!regConfirm.value) { h.textContent = ""; h.className = "field-hint"; return; }
    const ok = regConfirm.value === regPass.value;
    h.textContent = ok ? "Mật khẩu khớp." : "Mật khẩu nhập lại chưa khớp.";
    h.className = "field-hint " + (ok ? "ok" : "err");
  }
  if (regConfirm) regConfirm.addEventListener("input", checkConfirm);

  // --- gui form (co trang thai dang xu ly) ---
  function setLoading(form, on) {
    const b = form.querySelector('button[type="submit"]');
    if (!b) return;
    b.classList.toggle("loading", on);
    b.disabled = on;
    const lbl = b.querySelector(".btn-label");
    if (lbl) { if (on) { lbl.dataset.t = lbl.textContent; lbl.textContent = "Đang xử lý…"; } else if (lbl.dataset.t) lbl.textContent = lbl.dataset.t; }
  }

  const lf = $("#loginForm");
  if (lf) lf.addEventListener("submit", async (e) => {
    e.preventDefault();
    setLoading(lf, true);
    const fd = new FormData(lf);
    try {
      const d = await post("/api/login", { name: fd.get("name"), password: fd.get("password") });
      if (d.ok) { msg("#loginMsg", true, "Đăng nhập thành công! Đang mở hồ sơ…"); setTimeout(() => location.href = "/ho-so", 600); return; }
      msg("#loginMsg", false, d.error || "Đăng nhập thất bại.");
    } catch (err) { msg("#loginMsg", false, "Không nối được tới server — thử lại sau ít phút."); }
    setLoading(lf, false);
  });

  // ===== Gmail OTP: cau hinh + o nhap ma dung chung =====
  let EMAIL_ON = null;
  const ensureConfig = async () => {
    if (EMAIL_ON === null) {
      try { const c = await (await fetch("/api/config")).json(); EMAIL_ON = !!c.email_on; }
      catch (e) { EMAIL_ON = false; }
      if (!EMAIL_ON) document.body.classList.add("no-email");
    }
    return EMAIL_ON;
  };
  ensureConfig();

  function bindOtp(row) {
    if (!row) return { get: () => "", clear: () => {} };
    const boxes = Array.from(row.querySelectorAll(".otp-box"));
    boxes.forEach((b, i) => {
      b.addEventListener("input", () => {
        b.value = b.value.replace(/\D/g, "").slice(-1);
        if (b.value && i < boxes.length - 1) boxes[i + 1].focus();
      });
      b.addEventListener("keydown", (e) => {
        if (e.key === "Backspace" && !b.value && i > 0) boxes[i - 1].focus();
      });
      b.addEventListener("paste", (e) => {
        e.preventDefault();
        const t = (e.clipboardData.getData("text") || "").replace(/\D/g, "").slice(0, 6);
        t.split("").forEach((ch, j) => { if (boxes[j]) boxes[j].value = ch; });
        if (t.length) boxes[Math.min(t.length, 5)].focus();
      });
    });
    return {
      get: () => boxes.map((b) => b.value).join(""),
      clear: () => { boxes.forEach((b) => { b.value = ""; }); if (boxes[0]) boxes[0].focus(); },
    };
  }

  function cooldown(btn, sec) {
    if (!btn) return;
    const orig = "Gửi lại mã";
    btn.disabled = true;
    let left = sec;
    btn.textContent = orig + " (" + left + "s)";
    const t = setInterval(() => {
      left--;
      if (left <= 0) { clearInterval(t); btn.disabled = false; btn.textContent = orig; }
      else btn.textContent = orig + " (" + left + "s)";
    }, 1000);
  }

  const GMAIL_OK = /^[A-Za-z0-9._%+-]+@gmail\.com$/i;

  // ===== Dang ky: 2 buoc khi bat Gmail OTP =====
  const rf = $("#registerForm");
  const regOtp = bindOtp($("#regOtpRow"));
  let regPending = null;
  async function sendRegOtp() {
    return post("/api/otp/register", regPending);
  }
  if (rf) rf.addEventListener("submit", async (e) => {
    e.preventDefault();
    const fd = new FormData(rf);
    if (fd.get("password") !== fd.get("confirm")) { msg("#registerMsg", false, "Mật khẩu nhập lại chưa khớp."); return; }
    const on = await ensureConfig();
    if (!on) {
      setLoading(rf, true);
      try {
        const d = await post("/api/register", { name: fd.get("name"), password: fd.get("password"), confirm: fd.get("confirm") });
        if (d.ok) {
          rf.hidden = true;
          $("#authSuccessText").innerHTML = "Tài khoản <b>" + String(fd.get("name")).replace(/</g, "&lt;") +
            "</b> đã được tạo và dùng chung cho web + game.";
          $("#authSuccess").hidden = false;
          return;
        }
        msg("#registerMsg", false, d.error || "Đăng ký thất bại.");
      } catch (err) { msg("#registerMsg", false, "Không nối được tới server — thử lại sau ít phút."); }
      setLoading(rf, false);
      return;
    }
    const email = String(fd.get("email") || "").trim().toLowerCase();
    if (!GMAIL_OK.test(email)) { msg("#registerMsg", false, "Hãy nhập đúng địa chỉ Gmail (@gmail.com) — mã xác nhận sẽ gửi về đó."); return; }
    regPending = { name: String(fd.get("name") || "").trim(), password: fd.get("password"), confirm: fd.get("confirm"), email };
    setLoading(rf, true);
    try {
      const d = await sendRegOtp();
      if (!d.ok) { msg("#registerMsg", false, d.error || "Không gửi được mã xác nhận."); setLoading(rf, false); return; }
      $("#otpEmailEcho").textContent = email;
      rf.hidden = true;
      $("#otpPane").hidden = false;
      regOtp.clear();
      cooldown($("#otpResend"), 60);
    } catch (err) { msg("#registerMsg", false, "Không nối được tới server — thử lại sau ít phút."); }
    setLoading(rf, false);
  });
  const ovb = $("#otpVerifyBtn");
  if (ovb) ovb.addEventListener("click", async () => {
    const code = regOtp.get();
    if (!regPending) return;
    if (code.length < 6) { msg("#otpMsg", false, "Hãy nhập đủ 6 số trong thư."); return; }
    setLoading(ovb, true);
    try {
      const d = await post("/api/otp/register/verify", { email: regPending.email, code });
      if (d.ok) {
        $("#otpPane").hidden = true;
        $("#authSuccessText").innerHTML = "Tài khoản <b>" + regPending.name.replace(/</g, "&lt;") +
          "</b> đã được tạo và dùng chung cho web + game.";
        const sm = $("#authSuccessMail");
        if (sm) sm.innerHTML = "Gmail khôi phục đã liên kết: <b>" + regPending.email.replace(/</g, "&lt;") + "</b> — quên mật khẩu là lấy lại được ngay.";
        $("#authSuccess").hidden = false;
        return;
      }
      msg("#otpMsg", false, d.error || "Mã xác nhận chưa đúng.");
    } catch (err) { msg("#otpMsg", false, "Không nối được tới server — thử lại sau ít phút."); }
    setLoading(ovb, false);
  });
  const orb = $("#otpResend");
  if (orb) orb.addEventListener("click", async () => {
    if (!regPending) return;
    const d = await sendRegOtp().catch(() => null);
    if (d && d.ok) { msg("#otpMsg", true, "Đã gửi lại mã mới — kiểm tra hộp thư."); cooldown(orb, 60); }
    else msg("#otpMsg", false, (d && d.error) || "Chưa gửi lại được — chờ một lúc.");
  });
  const obk = $("#otpBack");
  if (obk) obk.addEventListener("click", () => {
    $("#otpPane").hidden = true;
    rf.hidden = false;
  });

  // ===== Quen mat khau qua Gmail =====
  const ff = $("#forgotForm");
  if (ff) {
    const forgotOtp = bindOtp($("#forgotOtpRow"));
    let forgotEmail = "";
    ensureConfig().then((on) => {
      if (!on) { ff.hidden = true; const fo = $("#forgotOff"); if (fo) fo.hidden = false; }
    });
    ff.addEventListener("submit", async (e) => {
      e.preventDefault();
      const fd = new FormData(ff);
      const email = String(fd.get("email") || "").trim().toLowerCase();
      if (!GMAIL_OK.test(email)) { msg("#forgotMsg", false, "Hãy nhập đúng địa chỉ Gmail (@gmail.com)."); return; }
      setLoading(ff, true);
      try {
        const d = await post("/api/otp/forgot", { name: String(fd.get("name") || "").trim(), email });
        if (d.ok) {
          forgotEmail = email;
          ff.hidden = true;
          $("#forgotStep2").hidden = false;
          forgotOtp.clear();
          return;
        }
        msg("#forgotMsg", false, d.error || "Không gửi được mã.");
      } catch (err) { msg("#forgotMsg", false, "Không nối được tới server — thử lại sau ít phút."); }
      setLoading(ff, false);
    });
    const fbk = $("#forgotBack");
    if (fbk) fbk.addEventListener("click", () => { $("#forgotStep2").hidden = true; ff.hidden = false; });
    const fs2 = $("#forgotStep2");
    fs2.addEventListener("submit", async (e) => {
      e.preventDefault();
      const fd = new FormData(fs2);
      if (fd.get("new") !== fd.get("confirm")) { msg("#forgotMsg2", false, "Mật khẩu mới nhập lại chưa khớp."); return; }
      const code = forgotOtp.get();
      if (code.length < 6) { msg("#forgotMsg2", false, "Hãy nhập đủ 6 số trong thư."); return; }
      setLoading(fs2, true);
      try {
        const d = await post("/api/otp/forgot/reset", { email: forgotEmail, code, new: fd.get("new"), confirm: fd.get("confirm") });
        if (d.ok) { fs2.hidden = true; $("#forgotDone").hidden = false; return; }
        msg("#forgotMsg2", false, d.error || "Đặt lại mật khẩu thất bại.");
      } catch (err) { msg("#forgotMsg2", false, "Không nối được tới server — thử lại sau ít phút."); }
      setLoading(fs2, false);
    });
  }

  // ===== Lien ket Gmail trong ho so =====
  const ef = $("#emailForm");
  if (ef) {
    const pfOtp = bindOtp($("#pfOtpRow"));
    ef.addEventListener("submit", async (e) => {
      e.preventDefault();
      const fd = new FormData(ef);
      const email = String(fd.get("email") || "").trim().toLowerCase();
      if (!GMAIL_OK.test(email)) { msg("#emailMsg", false, "Hãy nhập đúng địa chỉ Gmail (@gmail.com)."); return; }
      setLoading(ef, true);
      try {
        const d = await post("/api/otp/setemail", { email });
        if (d.ok) {
          $("#emailOtpForm").hidden = false;
          pfOtp.clear();
          msg("#emailMsg", true, "Đã gửi mã 6 số tới " + email + " — nhập mã ở dưới để hoàn tất.");
        } else msg("#emailMsg", false, d.error || "Không gửi được mã.");
      } catch (err) { msg("#emailMsg", false, "Không nối được tới server — thử lại sau ít phút."); }
      setLoading(ef, false);
    });
    const eof2 = $("#emailOtpForm");
    eof2.addEventListener("submit", async (e) => {
      e.preventDefault();
      const code = pfOtp.get();
      if (code.length < 6) { msg("#emailOtpMsg", false, "Hãy nhập đủ 6 số trong thư."); return; }
      setLoading(eof2, true);
      try {
        const d = await post("/api/otp/setemail/verify", { code });
        if (d.ok) {
          $("#pfEmailStatus").textContent = "Đã liên kết: " + (d.email || "") + " — quên mật khẩu là lấy lại được qua Gmail.";
          eof2.hidden = true;
          msg("#emailMsg", true, "Liên kết Gmail thành công!");
        } else msg("#emailOtpMsg", false, d.error || "Mã xác nhận chưa đúng.");
      } catch (err) { msg("#emailOtpMsg", false, "Không nối được tới server — thử lại sau ít phút."); }
      setLoading(eof2, false);
    });
  }

  const cf = $("#changeForm");
  if (cf) cf.addEventListener("submit", async (e) => {
    e.preventDefault();
    const fd = new FormData(cf);
    if (fd.get("new") !== fd.get("confirm")) { msg("#changeMsg", false, "Mật khẩu mới nhập lại chưa khớp."); return; }
    const d = await post("/api/changepass", { old: fd.get("old"), new: fd.get("new"), confirm: fd.get("confirm") });
    if (d.ok) { msg("#changeMsg", true, "Đổi mật khẩu thành công!"); cf.reset(); }
    else msg("#changeMsg", false, d.error || "Đổi mật khẩu thất bại.");
  });

  const lo = $("#logoutBtn");
  if (lo) lo.addEventListener("click", async () => { await post("/api/logout", {}); location.href = "/tai-khoan"; });

  if ($("#pfName")) (async () => {
    try {
      const d = await (await fetch("/api/me")).json();
      if (!d.ok) { location.href = "/tai-khoan"; return; }
      $("#pfName").textContent = d.name;
      $("#pfUuid").textContent = d.uuid;
      $("#pfBalance").textContent = d.balance == null ? "—" : fmt(d.balance);
      $("#pfDiscord").textContent = d.discord_id ? ("Đã liên kết · Discord ID " + d.discord_id) : "Chưa liên kết — gõ /lienket ở bot Discord";
      const es = $("#pfEmailStatus");
      if (es) es.textContent = d.email ? ("Đã liên kết: " + d.email + " — quên mật khẩu là lấy lại được qua Gmail.") : "Chưa liên kết Gmail — hãy liên kết ngay bên dưới để tự lấy lại mật khẩu khi quên.";
    } catch (e) { location.href = "/tai-khoan"; }
  })();
})();
