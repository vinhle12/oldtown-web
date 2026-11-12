// Diễn đàn OLD TOWN — tương tác: tạo bài, trả lời, bình chọn, cảm xúc,
// ghim đáp án, báo cáo, ghim/khóa/xóa (quản trị / tác giả).
(function () {
  "use strict";
  const $ = (s, c) => (c || document).querySelector(s);
  function toast(msg) {
    const t = $("#toast");
    if (!t) { alert(msg); return; }
    t.textContent = msg;
    t.classList.add("show", "f-toast");
    clearTimeout(t._h);
    t._h = setTimeout(() => t.classList.remove("show"), 3600);
  }

  // --- drawer chuyen muc tren mobile ---
  const drawerBtn = $("#forumDrawerBtn"), drawer = $("#forumSide"), overlay = $("#forumDrawerOverlay");
  function closeDrawer() {
    if (drawer) drawer.classList.remove("open");
    if (overlay) overlay.classList.remove("show");
  }
  if (drawerBtn && drawer) drawerBtn.addEventListener("click", () => {
    drawer.classList.add("open");
    if (overlay) overlay.classList.add("show");
  });
  if (overlay) overlay.addEventListener("click", closeDrawer);
  document.addEventListener("keydown", (e) => { if (e.key === "Escape") closeDrawer(); });
  async function post(url, obj) {
    const r = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(obj),
    });
    return r.json();
  }
  function msg(id, ok, text) {
    const m = $(id);
    if (m) { m.className = "form-msg " + (ok ? "ok" : "err"); m.textContent = text; }
  }

  // --- bam hang chu de de mo (tag ben trong van la link rieng) ---
  document.addEventListener("click", (e) => {
    const row = e.target.closest(".f-thread");
    if (row && row.dataset.href && !e.target.closest("a,button")) location.href = row.dataset.href;
  });
  document.addEventListener("keydown", (e) => {
    if ((e.key === "Enter" || e.key === " ") && e.target.classList && e.target.classList.contains("f-thread")) {
      e.preventDefault();
      location.href = e.target.dataset.href;
    }
  });

  // --- đính kèm ảnh: tải lên ngay khi chọn, hiện ảnh nhỏ, bấm × để bỏ ---
  const MAX_IMG = 4, MAX_BYTES = 4 * 1024 * 1024;
  document.querySelectorAll("[data-attach]").forEach((box) => {
    const input = box.querySelector('input[type="file"]');
    const list = box.querySelector(".f-attach-list");
    const pick = box.querySelector("[data-attach-pick]");
    box._urls = [];
    function render() {
      list.textContent = "";
      box._urls.forEach((u, i) => {
        const item = document.createElement("span");
        item.className = "f-attach-item";
        const im = document.createElement("img");
        im.src = u; im.alt = "";
        const rm = document.createElement("button");
        rm.type = "button"; rm.textContent = "×"; rm.setAttribute("aria-label", "Bỏ ảnh này");
        rm.addEventListener("click", () => { box._urls.splice(i, 1); render(); });
        item.append(im, rm);
        list.appendChild(item);
      });
    }
    pick.addEventListener("click", () => input.click());
    input.addEventListener("change", async () => {
      const label = pick.textContent;
      pick.disabled = true;
      for (const file of Array.from(input.files)) {
        if (box._urls.length >= MAX_IMG) { toast("Mỗi bài tối đa " + MAX_IMG + " ảnh."); break; }
        if (file.size > MAX_BYTES) { toast("“" + file.name + "” lớn hơn 4 MB — hãy chọn ảnh nhẹ hơn."); continue; }
        pick.textContent = "Đang tải ảnh…";
        const fd = new FormData();
        fd.append("file", file);
        try {
          const d = await (await fetch("/api/forum/upload", { method: "POST", body: fd })).json();
          if (d.ok) { box._urls.push(d.url); render(); }
          else toast(d.error || "Tải ảnh thất bại.");
        } catch (err) { toast("Không tải được ảnh — thử lại sau."); }
      }
      pick.textContent = label;
      pick.disabled = false;
      input.value = "";
    });
  });
  // Ghép chữ + các dòng đánh dấu ảnh thành nội dung gửi lên server.
  function withImages(form, text) {
    const box = form.querySelector("[data-attach]");
    const marks = ((box && box._urls) || []).map((u) => "[anh:" + u + "]");
    return [String(text || "").trim()].concat(marks).filter(Boolean).join("\n");
  }

  // --- tạo chủ đề mới ---
  const nf = $("#newThreadForm");
  if (nf) nf.addEventListener("submit", async (e) => {
    e.preventDefault();
    const content = withImages(nf, $("#ntContent").value);
    if (!content) { msg("#ntMsg", false, "Hãy viết nội dung hoặc thêm ít nhất một ảnh."); return; }
    const b = nf.querySelector('button[type="submit"]');
    b.disabled = true;
    try {
      const d = await post("/api/forum/threads", {
        category_id: $("#ntCat").value,
        title: $("#ntTitle").value,
        tags: $("#ntTags").value,
        content,
      });
      if (d.ok) { location.href = "/dien-dan/chu-de/" + d.id; return; }
      msg("#ntMsg", false, d.error || "Đăng bài thất bại.");
    } catch (err) { msg("#ntMsg", false, "Không nối được tới server — thử lại sau."); }
    b.disabled = false;
  });

  // --- trả lời (kèm trả lời lồng vào 1 bài cụ thể) ---
  const rf = $("#replyForm");
  if (rf) {
    const parentInput = $("#rpParent"), parentLabel = $("#rpParentLabel"), parentName = $("#rpParentName");
    document.addEventListener("click", (e) => {
      const rb = e.target.closest("[data-reply]");
      if (rb) {
        parentInput.value = rb.dataset.reply;
        const art = rb.closest(".f-post");
        const nameEl = art && art.querySelector("header b");
        parentName.textContent = nameEl ? nameEl.textContent : ("bài #" + rb.dataset.reply);
        parentLabel.hidden = false;
        $("#rpContent").focus();
        $("#rpContent").scrollIntoView({ behavior: "instant", block: "center" });
      }
      if (e.target.closest("#rpCancel")) {
        parentInput.value = "";
        parentLabel.hidden = true;
      }
    });
    rf.addEventListener("submit", async (e) => {
      e.preventDefault();
      const content = withImages(rf, $("#rpContent").value);
      if (!content) { msg("#rpMsg", false, "Hãy viết trả lời hoặc thêm ít nhất một ảnh."); return; }
      const b = rf.querySelector('button[type="submit"]');
      b.disabled = true;
      try {
        const d = await post("/api/forum/posts", {
          thread_id: $("#rpThread").value,
          parent_post_id: parentInput.value || null,
          content,
        });
        if (d.ok) { location.reload(); return; }
        msg("#rpMsg", false, d.error || "Gửi trả lời thất bại.");
      } catch (err) { msg("#rpMsg", false, "Không nối được tới server — thử lại sau."); }
      b.disabled = false;
    });
  }

  // --- bình chọn / cảm xúc / ghim đáp án / báo cáo / quản trị / xóa ---
  document.addEventListener("click", async (e) => {
    const v = e.target.closest("[data-vote]");
    if (v) {
      const d = await post("/api/forum/vote", { post_id: v.dataset.post, value: Number(v.dataset.vote) }).catch(() => null);
      if (d && d.ok) location.reload();
      else toast((d && d.error) || "Bình chọn thất bại.");
      return;
    }
    const rc = e.target.closest("[data-react]");
    if (rc) {
      const d = await post("/api/forum/reaction", { post_id: rc.dataset.post, type: rc.dataset.react }).catch(() => null);
      if (d && d.ok) location.reload();
      else toast((d && d.error) || "Thả cảm xúc thất bại.");
      return;
    }
    const bb = e.target.closest("[data-best]");
    if (bb) {
      const d = await post("/api/forum/best-answer", { post_id: bb.dataset.best }).catch(() => null);
      if (d && d.ok) location.reload();
      else toast((d && d.error) || "Ghim đáp án thất bại.");
      return;
    }
    const rp = e.target.closest("[data-report]");
    if (rp) {
      const reason = prompt("Lý do báo cáo bài này (để trống nếu không rõ):") || "";
      const d = await post("/api/forum/report", { post_id: rp.dataset.report, reason }).catch(() => null);
      toast(d && d.ok ? "Đã gửi báo cáo cho quản trị." : ((d && d.error) || "Báo cáo thất bại."));
      return;
    }
    const fl = e.target.closest("[data-flag]");
    if (fl) {
      const d = await post("/api/forum/flags", { thread_id: fl.dataset.thread, field: fl.dataset.flag }).catch(() => null);
      if (d && d.ok) location.reload();
      else toast((d && d.error) || "Đổi trạng thái thất bại.");
      return;
    }
    const dt = e.target.closest("[data-delthread]");
    if (dt) {
      if (!confirm("Xóa cả chủ đề này cùng toàn bộ bài trả lời? Không khôi phục được.")) return;
      const d = await post("/api/forum/delete-thread", { thread_id: dt.dataset.delthread }).catch(() => null);
      if (d && d.ok) { location.href = "/dien-dan"; return; }
      toast((d && d.error) || "Xóa chủ đề thất bại.");
      return;
    }
    const dp = e.target.closest("[data-delpost]");
    if (dp) {
      if (!confirm("Xóa bài trả lời này?")) return;
      const d = await post("/api/forum/delete-post", { post_id: dp.dataset.delpost }).catch(() => null);
      if (d && d.ok) location.reload();
      else toast((d && d.error) || "Xóa bài thất bại.");
    }
  });
})();
