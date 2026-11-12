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

  // --- tạo chủ đề mới ---
  const nf = $("#newThreadForm");
  if (nf) nf.addEventListener("submit", async (e) => {
    e.preventDefault();
    const b = nf.querySelector('button[type="submit"]');
    b.disabled = true;
    try {
      const d = await post("/api/forum/threads", {
        category_id: $("#ntCat").value,
        title: $("#ntTitle").value,
        tags: $("#ntTags").value,
        content: $("#ntContent").value,
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
      const b = rf.querySelector('button[type="submit"]');
      b.disabled = true;
      try {
        const d = await post("/api/forum/posts", {
          thread_id: $("#rpThread").value,
          parent_post_id: parentInput.value || null,
          content: $("#rpContent").value,
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
