# -*- coding: utf-8 -*-
"""Website OLD TOWN — chay tren .110, doc du lieu game qua cau du lieu .145.
Chi dung aiohttp (da co trong venv cua bot) + stdlib."""
import asyncio
import base64
import hashlib
import hmac
import html
import json
import os
import re
import secrets
import sqlite3
import time
from collections import defaultdict, deque

from aiohttp import web, ClientSession, ClientTimeout

import forum as forum_mod

BASE = os.path.dirname(os.path.abspath(__file__))
# Cache-busting cho CSS/JS: version = hash noi dung file tinh, doi moi khi deploy.
# (Su co 5/11: Safari iPhone cache style.css cu 24h nen /dien-dan hien dang vo
#  hoan toan tren mobile du CSS moi da len server — URL moi ?v=... buoc trinh
#  duyet tai lai file moi ngay lap tuc, khong cho hard-refresh.)
def _asset_version():
    h = hashlib.sha256()
    for _fn in ("style.css", "forum.js", "app.js"):
        try:
            with open(os.path.join(BASE, "static", _fn), "rb") as _f:
                h.update(_f.read())
        except OSError:
            pass
    return h.hexdigest()[:10]
ASSET_V = _asset_version()
BRIDGE_URL = os.environ.get("BRIDGE_URL", "http://192.168.10.145:8920")
BRIDGE_TOKEN = open(os.environ.get("BRIDGE_TOKEN_FILE", "/etc/oldtown/bridge-token")).read().strip()
SECRET = os.environ.get("WEB_SECRET", "")
if not SECRET:
    raise SystemExit("Thieu WEB_SECRET")
DISCORD_DB = "/opt/oldtown/bridge/bridge.db"

# ---------- Gmail OTP (xac nhan dang ky + khoi phuc mat khau) ----------
SMTP_USER = os.environ.get("SMTP_USER", "")
SMTP_PASS = os.environ.get("SMTP_PASS", "")
EMAIL_ON = bool(SMTP_USER and SMTP_PASS)
GMAIL_RE = re.compile(r"^[A-Za-z0-9._%+-]+@gmail\.com$")

def _send_mail_sync(to, subject, text, html_body=None):
    import smtplib
    from email.mime.text import MIMEText
    from email.mime.multipart import MIMEMultipart
    from email.header import Header
    if html_body:
        msg = MIMEMultipart("alternative")
        msg.attach(MIMEText(text, "plain", "utf-8"))
        msg.attach(MIMEText(html_body, "html", "utf-8"))
    else:
        msg = MIMEText(text, "plain", "utf-8")
    msg["Subject"] = Header(subject, "utf-8")
    msg["From"] = f"OLD TOWN <{SMTP_USER}>"
    msg["To"] = to
    with smtplib.SMTP("smtp.gmail.com", 587, timeout=20) as s:
        s.starttls()
        s.login(SMTP_USER, SMTP_PASS)
        s.sendmail(SMTP_USER, [to], msg.as_string())

def otp_html(code, muc_dich):
    return f"""<!DOCTYPE html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head><body style="margin:0;padding:0;background:#0b100c;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#0b100c;padding:28px 12px;">
<tr><td align="center">
<table role="presentation" width="560" cellpadding="0" cellspacing="0" style="max-width:560px;width:100%;background:#12180f;border:1px solid #2c3626;border-radius:16px;">
<tr><td style="padding:26px 32px 6px;text-align:center;">
<div style="font-family:Georgia,'Times New Roman',serif;font-size:30px;font-weight:900;letter-spacing:3px;color:#efe9dc;">OLD <span style="color:#3ddc97;">TOWN</span></div>
<div style="font-size:11px;letter-spacing:2.5px;color:#9aa48d;margin-top:6px;">TOWNS · SINH TỒN · JAVA &amp; BEDROCK (PE)</div>
</td></tr>
<tr><td style="padding:14px 32px 0;"><div style="border-top:2px solid #e8b33c;font-size:0;">&nbsp;</div></td></tr>
<tr><td style="padding:20px 32px 0;font-family:Arial,sans-serif;">
<div style="font-size:12px;letter-spacing:2px;color:#e8b33c;font-weight:bold;">MÃ XÁC NHẬN</div>
<p style="font-size:15px;line-height:1.6;color:#d8d2c0;margin:10px 0 0;">Xin chào cư dân, đây là mã xác nhận cho {muc_dich}:</p>
</td></tr>
<tr><td style="padding:16px 32px 0;">
<div style="background:#0b100c;border:2px solid #e8b33c;border-radius:12px;text-align:center;padding:16px 8px;font-family:Georgia,serif;font-size:36px;font-weight:900;letter-spacing:10px;color:#f5eeda;">{code}</div>
</td></tr>
<tr><td style="padding:16px 32px 0;font-family:Arial,sans-serif;font-size:14px;line-height:1.6;color:#b9bfae;">
Mã có hiệu lực <b style="color:#efe9dc;">10 phút</b> và chỉ dùng được 1 lần. Nhập mã vào trang web để tiếp tục — không cần trả lời thư này.
</td></tr>
<tr><td style="padding:14px 32px 0;">
<div style="background:#1a1408;border-left:4px solid #e8b33c;border-radius:6px;padding:12px 14px;font-family:Arial,sans-serif;font-size:13.5px;line-height:1.55;color:#d8c9a0;">
<b>Chống lừa đảo:</b> đội ngũ OLD TOWN <b>không bao giờ</b> hỏi mã này. Nếu bạn không yêu cầu, hãy bỏ qua thư và đừng chia sẻ mã cho bất kỳ ai.
</div>
</td></tr>
<tr><td style="padding:20px 32px 26px;font-family:Arial,sans-serif;font-size:13px;line-height:1.7;color:#8b937e;text-align:center;">
Địa chỉ vào game (Java &amp; PE) luôn được cập nhật ở trang chủ website OLD TOWN.<br>
— Đội ngũ OLD TOWN
</td></tr>
</table>
</td></tr></table>
</body></html>"""

async def send_otp_mail(to, code, muc_dich):
    subject = f"[OLD TOWN] Mã xác nhận của bạn: {code}"
    text = ("Xin chào cư dân OLD TOWN,\n\n"
            f"Mã xác nhận cho {muc_dich} là: {code}\n\n"
            "Mã có hiệu lực 10 phút và chỉ dùng được 1 lần.\n"
            "Nếu bạn không yêu cầu mã này, hãy bỏ qua thư — và TUYỆT ĐỐI không chia sẻ mã "
            "cho bất kỳ ai, kể cả người tự xưng là admin.\n\n— Đội ngũ OLD TOWN")
    loop = asyncio.get_running_loop()
    await loop.run_in_executor(None, _send_mail_sync, to, subject, text, otp_html(code, muc_dich))

OTPS = {}  # key -> {"hash","exp","attempts","data"}
OTP_TTL = 600

def otp_new(key, data):
    code = f"{secrets.randbelow(1000000):06d}"
    OTPS[key] = {"hash": hashlib.sha256((code + SECRET).encode()).hexdigest(),
                 "exp": time.time() + OTP_TTL, "attempts": 0, "data": data}
    return code

def otp_check(key, code):
    rec = OTPS.get(key)
    if not rec:
        return None
    if rec["exp"] < time.time():
        OTPS.pop(key, None)
        return None
    rec["attempts"] += 1
    if rec["attempts"] > 5:
        OTPS.pop(key, None)
        return None
    digest = hashlib.sha256((str(code) + SECRET).encode()).hexdigest()
    if not hmac.compare_digest(digest, rec["hash"]):
        return None
    OTPS.pop(key, None)
    return rec["data"]

def mask_email(email):
    if not email:
        return None
    user, _, dom = email.partition("@")
    return (user[:2] + "***@" + dom) if len(user) > 2 else (user[:1] + "***@" + dom)
IP_FILE = os.path.join(BASE, "public_ip.json")

_cache = {}
_rate = defaultdict(deque)
_http = None

# ---------- tien ich ----------
def cache_get(key, ttl):
    ent = _cache.get(key)
    if ent and time.time() - ent[0] < ttl:
        return ent[1]
    return None

def cache_set(key, val):
    _cache[key] = (time.time(), val)

def rate_ok(ip, key, limit, window):
    now = time.time()
    dq = _rate[(key, ip)]
    while dq and now - dq[0] > window:
        dq.popleft()
    if len(dq) >= limit:
        return False
    dq.append(now)
    return True

async def bridge(method, path, payload=None):
    global _http
    if _http is None:
        _http = ClientSession(timeout=ClientTimeout(total=8))
    try:
        async with _http.request(method, BRIDGE_URL + path,
                                 json=payload,
                                 headers={"X-Bridge-Token": BRIDGE_TOKEN}) as r:
            return await r.json()
    except Exception:
        return None

def strip_codes(text):
    return re.sub(r"§[0-9a-fk-orx]", "", text or "", flags=re.I)

def guide_section(page_text):
    """Chuyen 1 trang sach game thanh HTML: dong dau = tieu de, cac dong '▪' = danh sach."""
    lines = [ln.rstrip() for ln in strip_codes(page_text).split("\n")]
    lines = [ln for ln in lines if ln.strip() != ""]
    if not lines:
        return ""
    title = html.escape(lines[0])
    out = [f'<div class="guide-card"><h3><span class="sec-no">§</span>{title}</h3>']
    in_list = False
    for ln in lines[1:]:
        esc = html.escape(ln)
        if ln.startswith("▪"):
            if not in_list:
                out.append("<ul>")
                in_list = True
            out.append(f"<li>{esc[1:].strip()}</li>")
        else:
            if in_list:
                out.append("</ul>")
                in_list = False
            out.append(f"<p>{esc}</p>")
    if in_list:
        out.append("</ul>")
    out.append("</div>")
    return "".join(out)

def render_page(name, title, body_tokens=None, active="", head_extra=""):
    with open(os.path.join(BASE, "templates", "layout.html"), encoding="utf-8") as f:
        layout = f.read()
    with open(os.path.join(BASE, "templates", name), encoding="utf-8") as f:
        body = f.read()
    for k, v in (body_tokens or {}).items():
        body = body.replace("%%" + k + "%%", v)
    layout = layout.replace("%%HEAD_EXTRA%%", head_extra)
    layout = layout.replace("%%ASSET_V%%", ASSET_V)
    nav = {}
    for key in ("home", "luat", "huongdan", "forum", "bxh", "taikhoan"):
        nav[key] = ' class="active"' if key == active else ""
    return (layout.replace("%%TITLE%%", html.escape(title))
                  .replace("%%BODY%%", body)
                  .replace("%%NAV_HOME%%", nav["home"])
                  .replace("%%NAV_LUAT%%", nav["luat"])
                  .replace("%%NAV_HD%%", nav["huongdan"])
                  .replace("%%NAV_FORUM%%", nav["forum"])
                  .replace("%%NAV_BXH%%", nav["bxh"])
                  .replace("%%NAV_TK%%", nav["taikhoan"]))

def page_response(name, title, tokens=None, active="", head_extra=""):
    return web.Response(text=render_page(name, title, tokens, active, head_extra),
                        content_type="text/html", charset="utf-8")

# ---------- phien dang nhap (cookie ky HMAC) ----------
def make_session(name, uuid):
    payload = {"name": name, "uuid": uuid, "exp": int(time.time()) + 7 * 86400}
    raw = base64.urlsafe_b64encode(json.dumps(payload).encode()).decode()
    sig = hmac.new(SECRET.encode(), raw.encode(), hashlib.sha256).hexdigest()
    return raw + "." + sig

def read_session(request):
    val = request.cookies.get("ot_session", "")
    if "." not in val:
        return None
    raw, sig = val.rsplit(".", 1)
    expect = hmac.new(SECRET.encode(), raw.encode(), hashlib.sha256).hexdigest()
    if not hmac.compare_digest(sig, expect):
        return None
    try:
        payload = json.loads(base64.urlsafe_b64decode(raw.encode()))
    except Exception:
        return None
    if payload.get("exp", 0) < time.time():
        return None
    return payload

def discord_link(mc_name):
    try:
        conn = sqlite3.connect(f"file:{DISCORD_DB}?mode=ro", uri=True)
        row = conn.execute("SELECT discord_id FROM links WHERE mc_name = ?",
                           (mc_name.lower(),)).fetchone()
        conn.close()
        return row[0] if row else None
    except Exception:
        return None

# ---------- trang ----------
async def pg_home(request):
    return page_response("home.html", "OLD TOWN — Server Minecraft Việt Nam",
                         active="home")

async def pg_luat(request):
    guide = cache_get("guide", 300)
    if guide is None:
        guide = await bridge("GET", "/guide") or {"pages": []}
        cache_set("guide", guide)
    pages = guide.get("pages", [])
    luat_html = guide_section(pages[1]) if len(pages) > 1 else "<p>Đang tải luật từ server…</p>"
    return page_response("luat.html", "Luật server — OLD TOWN",
                         {"LUAT_GAME": luat_html}, active="luat")

async def pg_capnhat(request):
    return page_response("capnhat.html", "Nhật ký cập nhật — OLD TOWN")

async def pg_huongdan(request):
    guide = cache_get("guide", 300)
    if guide is None:
        guide = await bridge("GET", "/guide") or {"pages": []}
        cache_set("guide", guide)
    pages = guide.get("pages", [])
    parts = [guide_section(p) for p in pages[2:6]]
    return page_response("huongdan.html", "Hướng dẫn chơi — OLD TOWN",
                         {"HD_GAME": "".join(parts)}, active="huongdan")

async def pg_bxh(request):
    return page_response("bxh.html", "Bảng xếp hạng tiền — OLD TOWN", active="bxh")

async def pg_taikhoan(request):
    if read_session(request):
        raise web.HTTPFound("/ho-so")
    return page_response("taikhoan.html", "Tài khoản — OLD TOWN", active="taikhoan")

async def pg_hoso(request):
    if not read_session(request):
        raise web.HTTPFound("/tai-khoan")
    return page_response("hoso.html", "Hồ sơ — OLD TOWN", active="taikhoan")

async def pg_forgot(request):
    return page_response("quenmatkhau.html", "Quên mật khẩu — OLD TOWN", active="taikhoan")

# ---------- dien dan ----------
# Dung chung tai khoan game/web (cookie ot_session). Khong co tai khoan
# forum rieng. Quyen dieu hanh: ADMIN_USERS trong web.env (mac dinh rong),
# ngoai ra tac gia duoc tu xoa/sua bai cua minh.
def fmt_dt(iso):
    try:
        from datetime import datetime
        dt = datetime.fromisoformat(str(iso).replace("Z", "+00:00"))
        return dt.strftime("%d/%m/%Y %H:%M")
    except Exception:
        return str(iso)[:16]



FORUM_ICONS = {
    "megaphone": '<path d="m3 11 18-5v12L3 13v-2z"/><path d="M11.6 16.8a3 3 0 1 1-5.8-1.6"/>',
    "book": '<path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"/><path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"/>',
    "home": '<path d="m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><path d="M9 22V12h6v10"/>',
    "users": '<path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>',
    "cart": '<circle cx="8" cy="21" r="1"/><circle cx="19" cy="21" r="1"/><path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6"/>',
    "help": '<circle cx="12" cy="12" r="10"/><path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"/><line x1="12" y1="17" x2="12.01" y2="17"/>',
    "chat": '<path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>',
    "flame": '<path d="M8.5 14.5A2.5 2.5 0 0 0 11 12c0-1.38-.5-2-1-3-1.072-2.143-.224-4.054 2-6 .5 2.5 2 4.9 4 6.5 2 1.6 3 3.5 3 5.5a7 7 0 1 1-14 0c0-1.153.433-2.294 1-3a2.5 2.5 0 0 0 2.5 2.5z"/>',
    "search": '<circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>',
    "menu": '<line x1="4" y1="6" x2="20" y2="6"/><line x1="4" y1="12" x2="20" y2="12"/><line x1="4" y1="18" x2="20" y2="18"/>',
    "chev-up": '<polyline points="18 15 12 9 6 15"/>',
    "chev-down": '<polyline points="6 9 12 15 18 9"/>',
}


def forum_icon(name, size=18):
    inner = FORUM_ICONS.get(name, FORUM_ICONS["chat"])
    return (f'<svg width="{size}" height="{size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" '
            f'stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">{inner}</svg>')


AVATAR_COLORS = ["#177245", "#0e7490", "#6d28d9", "#b45309", "#be5a0b",
                 "#b91c1c", "#4d5560", "#0f766e", "#9d174d", "#365314"]


def forum_avatar(name, size=42):
    # Khong dung style="" inline: CSP style-src 'self' chan no. Mau qua class f-av-N.
    nm = (name or "?").strip()
    initials = "".join(ch for ch in nm if ch.isalnum())[:2].upper() or "?"
    idx = sum(nm.encode()) % len(AVATAR_COLORS)
    sm = " f-av-sm" if size <= 32 else ""
    return (f'<span class="f-avatar f-av-{idx}{sm}">'
            f'{html.escape(initials)}</span>')


def forum_role_pill(name):
    if forum_mod.is_admin(name) or (name or "") == "AdminOT":
        return '<span class="f-badge role-admin">Quản trị</span>'
    if (name or "") == "ModLinh" or (name or "").lower().startswith("mod"):
        return '<span class="f-badge role-mod">Điều hành</span>'
    return ""


def forum_trust_label(posts_count):
    if posts_count >= 10:
        return "Cư dân lâu năm"
    if posts_count >= 5:
        return "Cư dân tích cực"
    if posts_count >= 1:
        return "Cư dân mới"
    return "Mới tham gia"


def forum_trust_pill(posts_count):
    return f'<span class="f-badge trust">{forum_trust_label(posts_count)}</span>'


def forum_badges(t):
    out = ""
    if t["pinned"]:
        out += '<span class="f-badge gold">Ghim</span>'
    if t["locked"]:
        out += '<span class="f-badge">Đã khóa</span>'
    if t["solved_post_id"]:
        out += '<span class="f-badge ok">Đã giải đáp</span>'
    if t["is_sample"]:
        out += '<span class="f-badge sample">Bài mẫu</span>'
    return out


# ---------- anh dinh kem dien dan ----------
# Anh luu ngoai thu muc web (cung cho voi forum.db, ghi duoc khi ProtectSystem=full),
# phuc vu qua /uploads/. Trong noi dung bai, moi anh la 1 dong danh dau
# "[anh:/uploads/<32 hex>.<duoi>]" — khong can doi schema DB.
UPLOAD_DIR = os.environ.get("FORUM_UPLOAD_DIR") or os.path.join(
    os.path.dirname(forum_mod.FORUM_DB) or ".", "uploads")
UPLOAD_MAX = 4 * 1024 * 1024
UPLOAD_PER_POST = 4
_IMG_PATH = r"/uploads/[0-9a-f]{32}\.(?:png|jpg|webp|gif)"
IMG_LINE_RE = re.compile(r"^\[anh:(" + _IMG_PATH + r")\]$")
IMG_ANY_RE = re.compile(r"\[anh:(" + _IMG_PATH + r")\]")


def sniff_image(head):
    """Nhan dang anh bang chu ky file (khong tin ten file / Content-Type gui len)."""
    if head.startswith(b"\x89PNG\r\n\x1a\n"):
        return "png"
    if head.startswith(b"\xff\xd8\xff"):
        return "jpg"
    if head[:6] in (b"GIF87a", b"GIF89a"):
        return "gif"
    if head[:4] == b"RIFF" and head[8:12] == b"WEBP":
        return "webp"
    return None


def forum_img_html(url):
    return (f'<figure class="f-img"><a href="{url}" target="_blank" rel="noopener">'
            f'<img src="{url}" alt="Ảnh đính kèm" loading="lazy"></a></figure>')


# Khoi "Them anh" dung chung cho form tao bai va form tra loi (forum.js xu ly).
FORUM_ATTACH_HTML = (
    '<div class="f-attach" data-attach>'
    '<input type="file" accept="image/png,image/jpeg,image/webp,image/gif" multiple hidden>'
    '<button type="button" class="f-mini" data-attach-pick>+ Thêm ảnh</button>'
    '<span class="f-attach-note">Tối đa 4 ảnh, mỗi ảnh không quá 4 MB (PNG, JPG, WebP, GIF)</span>'
    '<div class="f-attach-list"></div></div>')


def forum_plain(content):
    """Bo cac dong danh dau anh (ke ca dong bi cat do substr) de lam doan trich."""
    text = IMG_ANY_RE.sub("", content or "")
    return re.sub(r"\[anh:[^\]\n]*$", "", text).strip()


def forum_text(content):
    """Escape HTML; dong '> ' thanh trich dan; dong [anh:/uploads/...] thanh anh."""
    parts, plain = [], []

    def flush_plain():
        if plain:
            parts.append("<br>".join(plain))
            plain.clear()

    for ln in html.escape(content or "").split("\n"):
        img = IMG_LINE_RE.match(ln.strip())
        if img:
            flush_plain()
            parts.append(forum_img_html(img.group(1)))
        elif ln.startswith("&gt;"):
            flush_plain()
            parts.append("<blockquote><p>" + ln[4:].strip() + "</p></blockquote>")
        else:
            plain.append(ln)
    flush_plain()
    return "".join(parts)


def forum_tag_chips(tags):
    out = []
    for t in (tags or "").split(","):
        t = t.strip()
        if t:
            out.append(f'<a class="f-tag" href="/dien-dan?tag={html.escape(t)}">#{html.escape(t)}</a>')
    return " ".join(out)


def forum_thread_row(conn, t, me_name=None):
    st = forum_mod.thread_stats(conn, t["id"])
    excerpt = forum_plain(t["excerpt"]) if "excerpt" in t.keys() else ""
    first_img = IMG_ANY_RE.search(t["op_content"] or "") if "op_content" in t.keys() else None
    # Hang thread la <div> (khong phai <a>): tag ben trong cung la <a>, HTML cam
    # long <a> trong <a> — trinh duyet se be cau truc. Dieu huong bang JS (forum.js).
    row = (
        f'<div class="f-thread" data-href="/dien-dan/chu-de/{t["id"]}" tabindex="0" role="link">'
        f'{forum_avatar(t["author_name"])}'
        f'<span class="f-thread-main"><span class="f-thread-title">{html.escape(t["title"])}</span>')
    if excerpt:
        row += f'<span class="f-thread-excerpt">{html.escape(excerpt)}</span>'
    if first_img:
        row += f'<span class="f-thread-img"><img src="{first_img.group(1)}" alt="" loading="lazy"></span>'
    row += (
        f'<span class="f-thread-meta">{html.escape(t["author_name"])} · {fmt_dt(t["created_at"])} '
        f'· {html.escape(t["category_name"])} {forum_badges(t)}</span>'
        f'<span class="f-thread-tags">{forum_tag_chips(t["tags"])}</span></span>'
        f'<span class="f-thread-stats"><b>{st["replies"]}</b> trả lời<br>'
        f'<b>{t["views"]}</b> lượt xem<br>'
        f'<b>{st["likes"]}</b> thích</span></div>')
    return row


def forum_hot_row(rank, t):
    return (f'<a class="f-hot-row" href="/dien-dan/chu-de/{t["id"]}">'
            f'<span class="f-hot-num">{rank}</span>'
            f'<span class="f-hot-main"><span class="f-hot-title">{html.escape(t["title"])}</span>'
            f'<span class="f-hot-meta">{t["replies"]} trả lời · {t["views"]} lượt xem · {t["likes"]} thích</span></span></a>')


def forum_cat_row(c, cnt):
    latest = f'{cnt["tc"]} chủ đề · {cnt["pc"]} bài viết'
    if cnt["lt"]:
        latest += f' · mới nhất: {cnt["lt"]}'
    return (f'<a class="f-cat" href="/dien-dan/chuyen-muc/{c["id"]}">'
            f'<span class="f-cat-icon f-ci-{c["id"]}">{forum_icon(c["icon"], 22)}</span>'
            f'<span class="f-cat-main"><b>{html.escape(c["name"])}</b>'
            f'<span>{html.escape(c["description"])}</span>'
            f'<span class="f-cat-meta">{html.escape(latest)}</span></span>'
            f'<span class="f-cat-go">Vào</span></a>')


def forum_common(conn, me=None):
    cats = conn.execute(
        "SELECT c.*, (SELECT COUNT(*) FROM threads t WHERE t.category_id=c.id) AS threads_count"
        " FROM categories c ORDER BY c.sort_order").fetchall()
    top = conn.execute(
        "SELECT p.author_name, COUNT(*) AS posts,"
        " (SELECT COALESCE(SUM(v.value),0) FROM votes v JOIN posts p2 ON p2.id=v.post_id"
        "  WHERE p2.author_name=p.author_name AND v.value=1) AS likes"
        " FROM posts p WHERE p.deleted=0 GROUP BY p.author_name"
        " ORDER BY posts*2 + likes DESC, posts DESC LIMIT 5").fetchall()
    stats = conn.execute("SELECT (SELECT COUNT(*) FROM threads) AS t,"
                         " (SELECT COUNT(*) FROM posts WHERE deleted=0) AS p,"
                         " (SELECT COUNT(DISTINCT author_name) FROM posts) AS m").fetchone()
    me_posts = 0
    if me:
        row = conn.execute("SELECT COUNT(*) AS n FROM posts WHERE author_name=? AND deleted=0",
                           (me,)).fetchone()
        me_posts = row["n"] if row else 0
    return {"cats": cats, "top": top, "stats": stats, "me_posts": me_posts}


def forum_sidebar(cats, active_cat=None, me=None, me_posts=0):
    if me:
        profile = (f'<div class="f-card"><div class="f-profile">{forum_avatar(me)}'
                   f'<span><span class="f-pname">{html.escape(me)}</span>'
                   f'<span class="f-ptrust">{forum_trust_label(me_posts)} · {me_posts} bài viết</span></span></div>'
                   '<div class="f-mt"><a class="f-btn" href="/ho-so">Hồ sơ của tôi</a></div></div>')
    else:
        profile = ('<div class="f-card"><div class="f-profile">'
                   f'{forum_avatar("?")}'
                   '<span><span class="f-pname">Chưa đăng nhập</span>'
                   '<span class="f-ptrust">Đăng nhập để viết bài, bình chọn</span></span></div>'
                   '<div class="f-mt"><a class="f-btn f-btn-accent" href="/tai-khoan">Đăng nhập</a></div></div>')
    nav = ('<div class="f-side-label">Diễn đàn</div>'
           '<a class="f-navlink" href="/dien-dan">Trang chủ diễn đàn</a>'
           '<a class="f-navlink" href="/luat">Luật &amp; nội quy</a>'
           '<a class="f-navlink" href="/bang-xep-hang">Bảng xếp hạng</a>'
           '<div class="f-side-label">Chuyên mục</div>')
    links = []
    for c in cats:
        cls = " active" if active_cat and int(active_cat) == c["id"] else ""
        links.append(
            f'<a class="f-catlink{cls}" href="/dien-dan/chuyen-muc/{c["id"]}">'
            f'<span class="f-cc-{c["id"]}">{forum_icon(c["icon"], 17)}</span>'
            f'<span>{html.escape(c["name"])}</span>'
            f'<span class="f-count">{c["threads_count"]} chủ đề</span></a>')
    return f'<aside class="f-side" id="forumSide">{profile}{nav}{"".join(links)}</aside>'


def forum_rail(top, stats):
    rows = []
    for i, u in enumerate(top, 1):
        rows.append(f'<div class="f-rail-row"><span class="f-rank">{i}</span>{forum_avatar(u["author_name"], 32)}'
                    f'<span class="f-rname">{html.escape(u["author_name"])}</span>'
                    f'<span class="f-rmeta">{u["posts"]} bài · {u["likes"] or 0} thích</span></div>')
    return (
        '<aside class="f-rail">'
        '<div class="f-card"><h3>Cư dân nổi bật</h3>' + "".join(rows) + '</div>'
        '<div class="f-card"><h3>Luật cần nhớ</h3><div class="f-law">'
        '<p><b>§ 5</b> Giao dịch ngoài hệ thống tự chịu rủi ro, admin không đòi đồ hộ.</p>'
        '<p><b>§ 6</b> Admin chỉ can thiệp hack/cheat, lừa đảo hệ thống, lỗi diện rộng.</p>'
        '<p><b>§ 7</b> Trần farm 15 con/chunk, quá 8 con/ô bị ngạt; đa số linh kiện redstone bị chặn.</p>'
        '</div></div>'
        '<div class="f-card"><h3>Thống kê</h3><div class="f-law">'
        f'<p>{stats["m"]} thành viên đã viết bài</p>'
        f'<p>{stats["t"]} chủ đề · {stats["p"]} bài viết</p>'
        '</div></div></aside>')


def forum_header(q="", me=None):
    login_btn = ('<a class="f-btn" href="/ho-so">Tài khoản</a>' if me
                 else '<a class="f-btn" href="/tai-khoan">Đăng nhập</a>')
    return (
        '<div class="f-topbar">'
        '<button class="f-btn f-drawer-btn" id="forumDrawerBtn" type="button" aria-label="Mở chuyên mục">'
        f'{forum_icon("menu", 18)} Chuyên mục</button>'
        '<a class="f-logo" href="/dien-dan"><span class="f-logo-mark">OT</span>'
        '<span><span class="f-logo-name">Diễn đàn</span><span class="f-logo-sub">OLD TOWN</span></span></a>'
        f'<form class="f-search-pill" method="get" action="/dien-dan">{forum_icon("search", 18)}'
        f'<input type="search" name="q" value="{html.escape(q)}" placeholder="Tìm chủ đề, hướng dẫn…" aria-label="Tìm trong diễn đàn"></form>'
        '<a class="f-btn f-btn-accent" href="/dien-dan/tao-bai">Tạo bài viết</a>'
        + login_btn + '</div>')


def forum_layout(header_html, sidebar_html, main_html, rail_html):
    return (header_html
            + '<div class="f-drawer-overlay" id="forumDrawerOverlay"></div>'
            + '<div class="f-grid">' + sidebar_html + '<div class="f-main">'
            + main_html + '</div>' + rail_html + '</div>')


def forum_list_threads(conn, sort="new", category_id=None, q="", tag="", limit=30, offset=0):
    where = ["1=1"]
    params = []
    if category_id:
        where.append("t.category_id=?")
        params.append(category_id)
    if q:
        where.append("(t.title LIKE ? OR t.id IN (SELECT thread_id FROM posts WHERE content LIKE ?))")
        params += [f"%{q}%", f"%{q}%"]
    if tag:
        where.append("(',' || t.tags || ',' LIKE ?)")
        params.append(f"%,{tag},%")
    order = {
        "new": "t.pinned DESC, t.created_at DESC",
        "hot": "t.pinned DESC, (replies*2 + likes + t.views/100.0) DESC",
        "top": "t.pinned DESC, likes DESC, t.views DESC",
    }.get(sort, "t.pinned DESC, t.created_at DESC")
    sql = (
        "SELECT t.*, c.name AS category_name,"
        " (SELECT COUNT(*) FROM posts p WHERE p.thread_id=t.id AND p.deleted=0)-1 AS replies,"
        " (SELECT COALESCE(SUM(v.value),0) FROM votes v JOIN posts p ON p.id=v.post_id"
        "  WHERE p.thread_id=t.id) AS likes,"
        " (SELECT substr(content,1,140) FROM posts p WHERE p.thread_id=t.id"
        "   AND p.parent_post_id IS NULL) AS excerpt,"
        " (SELECT content FROM posts p WHERE p.thread_id=t.id"
        "   AND p.parent_post_id IS NULL) AS op_content"
        f" FROM threads t JOIN categories c ON c.id=t.category_id"
        f" WHERE {' AND '.join(where)} ORDER BY {order} LIMIT ? OFFSET ?")
    return conn.execute(sql, params + [limit, offset]).fetchall()


def forum_sort_tabs(base, sort, q="", tag=""):
    extra = ""
    if q:
        extra += f"&q={html.escape(q)}"
    if tag:
        extra += f"&tag={html.escape(tag)}"
    tabs = []
    for key, label in (("new", "Mới nhất"), ("hot", "Đang hot"), ("top", "Nhiều thích")):
        cls = ' class="active"' if key == sort else ""
        tabs.append(f'<a href="{base}?sort={key}{extra}"{cls}>{label}</a>')
    return '<div class="f-tabs">' + "".join(tabs) + "</div>"


async def pg_forum(request):
    sort = request.query.get("sort", "new")
    if sort not in ("new", "hot", "top"):
        sort = "new"
    q = (request.query.get("q", "") or "").strip()[:120]
    tag = (request.query.get("tag", "") or "").strip()[:40]
    sess = read_session(request)
    me = sess["name"] if sess else None
    conn = forum_mod.forum_conn()
    try:
        common = forum_common(conn, me)
        cats = common["cats"]
        total = common["stats"]
        hot = forum_list_threads(conn, "hot", limit=5)
        threads = forum_list_threads(conn, sort, q=q, tag=tag, limit=30)
        cat_html = []
        for c in cats:
            cnt = conn.execute(
                "SELECT COUNT(*) AS tc, (SELECT COUNT(*) FROM posts p JOIN threads t"
                " ON t.id=p.thread_id WHERE t.category_id=? AND p.deleted=0) AS pc,"
                " (SELECT title FROM threads WHERE category_id=? ORDER BY created_at DESC LIMIT 1) AS lt,"
                " (SELECT author_name FROM threads WHERE category_id=? ORDER BY created_at DESC LIMIT 1) AS la"
                " FROM threads WHERE category_id=?", (c["id"], c["id"], c["id"], c["id"])).fetchone()
            cat_html.append(forum_cat_row(c, cnt))
        main = (
            '<div class="f-hero"><h1>Cộng đồng cư dân OLD TOWN</h1>'
            '<p>Chỗ cư dân hỏi đáp, khoe nhà, tuyển town và rao đồ — dùng chung tài khoản web + game, '
            'đăng nhập rồi mới đăng bài được. Bài gắn nhãn “Bài mẫu” là dữ liệu mẫu từ bản dựng thử.</p>'
            '<a class="f-quick" href="/dien-dan/tao-bai">' + forum_avatar(me or "?") +
            '<span class="f-quick-text">Bạn muốn chia sẻ gì với thị trấn?</span>'
            '<span class="f-quick-btn">Ảnh</span><span class="f-quick-btn f-quick-post">Đăng bài</span></a>'
            f'<p class="f-stats"><b>{total["m"]}</b> thành viên · <b>{total["t"]}</b> chủ đề · <b>{total["p"]}</b> bài viết</p></div>'
            + '<h2 class="f-h2">' + forum_icon("flame", 20) + ' Đang hot</h2><div>'
            + "".join(forum_hot_row(i + 1, t) for i, t in enumerate(hot)) + '</div>'
            + '<h2 class="f-h2">Chuyên mục</h2><div class="f-cats">' + "".join(cat_html) + '</div>'
            + '<h2 class="f-h2">Tất cả chủ đề</h2>' + forum_sort_tabs("/dien-dan", sort, q, tag)
            + '<div class="f-list">' + "".join(forum_thread_row(conn, t) for t in threads)
            + ('</div><p class="center muted">Chưa có chủ đề nào khớp.</p>' if not threads else "</div>"))
        body = forum_layout(forum_header(q, me),
                            forum_sidebar(cats, None, me, common["me_posts"]),
                            main, forum_rail(common["top"], total))
        return page_response("forum.html", "Diễn đàn — OLD TOWN",
                             {"FORUM_BODY": body}, active="forum",
                             head_extra='<script src="/static/forum.js?v=' + ASSET_V + '" defer></script>')
    finally:
        conn.close()


async def pg_forum_category(request):
    try:
        cid = int(request.match_info["cid"])
    except Exception:
        raise web.HTTPNotFound()
    sort = request.query.get("sort", "new")
    if sort not in ("new", "hot", "top"):
        sort = "new"
    sess = read_session(request)
    me = sess["name"] if sess else None
    conn = forum_mod.forum_conn()
    try:
        cat = conn.execute("SELECT * FROM categories WHERE id=?", (cid,)).fetchone()
        if not cat:
            raise web.HTTPNotFound()
        common = forum_common(conn, me)
        threads = forum_list_threads(conn, sort, category_id=cid, limit=50)
        main = (
            f'<p class="f-crumb"><a href="/dien-dan">Diễn đàn</a> / {html.escape(cat["name"])}</p>'
            f'<div class="f-hero"><h1>{html.escape(cat["name"])}</h1>'
            f'<p>{html.escape(cat["description"])}</p></div>'
            + forum_sort_tabs(f"/dien-dan/chuyen-muc/{cid}", sort)
            + '<div class="f-list">' + "".join(forum_thread_row(conn, t) for t in threads)
            + ('</div><p class="center muted">Chuyên mục này chưa có chủ đề nào — hãy là người mở đầu.</p>' if not threads else "</div>")
            + '<div class="f-mt-lg"><a class="f-btn f-btn-accent" href="/dien-dan/tao-bai">Tạo bài viết mới</a></div>')
        body = forum_layout(forum_header("", me),
                            forum_sidebar(common["cats"], cid, me, common["me_posts"]),
                            main, forum_rail(common["top"], common["stats"]))
        return page_response("forum.html", f'{cat["name"]} — Diễn đàn OLD TOWN',
                             {"FORUM_BODY": body}, active="forum",
                             head_extra='<script src="/static/forum.js?v=' + ASSET_V + '" defer></script>')
    finally:
        conn.close()


async def pg_forum_new(request):
    sess = read_session(request)
    if not sess:
        raise web.HTTPFound("/tai-khoan")
    conn = forum_mod.forum_conn()
    try:
        common = forum_common(conn, sess["name"])
        cats = common["cats"]
        opts = "".join(
            f'<option value="{c["id"]}">{html.escape(c["name"])}</option>' for c in cats)
        main = (
            '<p class="f-crumb"><a href="/dien-dan">Diễn đàn</a> / Tạo bài viết mới</p>'
            '<div class="f-hero"><h1>Tạo bài viết mới</h1>'
            '<p>Đăng bằng tên tài khoản của bạn: <b>' + html.escape(sess["name"]) + "</b>. "
            "Bài đăng đúng chuyên mục, không spam, không rao bán ngoài mục Chợ.</p></div>"
            '<form class="form f-form" id="newThreadForm">'
            '<label>Chuyên mục<select name="category_id" id="ntCat">' + opts + "</select></label>"
            '<label>Tiêu đề<input name="title" id="ntTitle" maxlength="120" required placeholder="Viết tiêu đề ngắn gọn, rõ ý…"></label>'
            '<label>Thẻ (cách nhau bằng dấu phẩy, tối đa 5)<input name="tags" id="ntTags" maxlength="120" placeholder="vd: nhà-gỗ, góp-ý"></label>'
            '<label>Nội dung<textarea name="content" id="ntContent" rows="10" maxlength="7500" placeholder="Viết nội dung bài viết…"></textarea></label>'
            + FORUM_ATTACH_HTML +
            '<p class="form-msg" id="ntMsg"></p>'
            '<button class="f-btn f-btn-accent f-btn-block" type="submit">Đăng bài</button>'
            "</form>")
        body = forum_layout(forum_header("", sess["name"]),
                            forum_sidebar(cats, None, sess["name"], common["me_posts"]),
                            main, forum_rail(common["top"], common["stats"]))
        return page_response("forum.html", "Tạo bài viết — Diễn đàn OLD TOWN",
                             {"FORUM_BODY": body}, active="forum",
                             head_extra='<script src="/static/forum.js?v=' + ASSET_V + '" defer></script>')
    finally:
        conn.close()


async def pg_forum_thread(request):
    try:
        tid = int(request.match_info["tid"])
    except Exception:
        raise web.HTTPNotFound()
    sess = read_session(request)
    me = sess["name"] if sess else None
    conn = forum_mod.forum_conn()
    try:
        conn.execute("UPDATE threads SET views=views+1 WHERE id=?", (tid,))
        conn.commit()
        t = conn.execute(
            "SELECT t.*, c.name AS category_name FROM threads t"
            " JOIN categories c ON c.id=t.category_id WHERE t.id=?", (tid,)).fetchone()
        if not t:
            raise web.HTTPNotFound()
        posts = conn.execute(
            "SELECT * FROM posts WHERE thread_id=? AND deleted=0 ORDER BY created_at, id",
            (tid,)).fetchall()
        by_parent = {}
        for p in posts:
            by_parent.setdefault(p["parent_post_id"], []).append(p)
        author_counts = {r["author_name"]: r["n"] for r in conn.execute(
            "SELECT author_name, COUNT(*) AS n FROM posts WHERE deleted=0 GROUP BY author_name").fetchall()}
        common = forum_common(conn, me)

        def render_post(p, depth=0):
            score = forum_mod.post_score(conn, p["id"])
            reacts = forum_mod.post_reactions(conn, p["id"])
            my_vote = None
            my_reacts = []
            if me:
                v = conn.execute("SELECT value FROM votes WHERE post_id=? AND author_name=?",
                                 (p["id"], me)).fetchone()
                my_vote = v["value"] if v else None
                my_reacts = [r["type"] for r in conn.execute(
                    "SELECT type FROM reactions WHERE post_id=? AND author_name=?",
                    (p["id"], me)).fetchall()]
            is_author = me and me == p["author_name"]
            is_op = p["parent_post_id"] is None
            can_mod = bool(me) and (forum_mod.is_admin(me) or is_author)
            best = ""
            if p["is_best"]:
                best = '<span class="f-badge ok">Đáp án hay nhất</span>'
            elif me and me == t["author_name"] and not is_op:
                best = (f'<button class="f-mini" data-best="{p["id"]}">Ghim làm đáp án hay nhất</button>')
            react_btns = "".join(
                f'<button class="f-react{" on" if rt in my_reacts else ""}" data-react="{rt}" data-post="{p["id"]}">'
                f'{forum_mod.REACTION_LABEL[rt]} {reacts.get(rt, 0)}</button>'
                for rt in forum_mod.REACTION_TYPES)
            op_badge = ' <span class="f-badge">Chủ thớt</span>' if is_op else ""
            child_depth = min(depth + 1, 3)
            children = "".join(render_post(c, child_depth) for c in by_parent.get(p["id"], []))
            depth_cls = f" f-depth-{depth}" if depth else ""
            return (
                f'<article class="f-post{" f-op" if is_op else ""}{" f-best" if p["is_best"] else ""}{depth_cls}" id="post-{p["id"]}">'
                '<div class="f-post-inner"><div class="f-post-main">'
                f'<header>{forum_avatar(p["author_name"], 40)}'
                f'<span><b>{html.escape(p["author_name"])}</b> {forum_role_pill(p["author_name"])}'
                f'{op_badge} {forum_trust_pill(author_counts.get(p["author_name"], 0))} {best}'
                f'<span class="muted"> · {fmt_dt(p["created_at"])}</span></span></header>'
                f'<div class="f-post-body">{forum_text(p["content"])}</div>'
                f'<div class="f-actions">{react_btns}'
                + (f'<button class="f-mini" data-reply="{p["id"]}">Trả lời</button>' if me and not t["locked"] else "")
                + (f'<button class="f-mini" data-report="{p["id"]}">Báo cáo</button>' if me else "")
                + (f'<button class="f-mini danger" data-delpost="{p["id"]}">Xóa bài</button>' if can_mod and not is_op else "")
                + '</div></div>'
                f'<div class="f-vote-col">'
                f'<button class="f-vote{" on-up" if my_vote == 1 else ""}" data-vote="1" data-post="{p["id"]}" aria-label="Bình chọn +1">{forum_icon("chev-up", 16)}</button>'
                f'<span class="f-vote-score">{score}</span>'
                f'<button class="f-vote{" on-down" if my_vote == -1 else ""}" data-vote="-1" data-post="{p["id"]}" aria-label="Bình chọn -1">{forum_icon("chev-down", 16)}</button>'
                '</div></div>' + children + "</article>")

        mod_bar = ""
        if me and forum_mod.is_admin(me):
            mod_bar = (
                f'<div class="f-modbar">Quản trị: '
                f'<button class="f-mini" data-flag="pinned" data-thread="{tid}">{"Bỏ ghim" if t["pinned"] else "Ghim"}</button> '
                f'<button class="f-mini" data-flag="locked" data-thread="{tid}">{"Mở khóa" if t["locked"] else "Khóa"}</button> '
                f'<button class="f-mini danger" data-delthread="{tid}">Xóa chủ đề</button></div>')
        elif me and me == t["author_name"]:
            mod_bar = (f'<div class="f-modbar"><button class="f-mini danger" data-delthread="{tid}">Xóa chủ đề của tôi</button></div>')
        fab = ""
        reply_box = ""
        if me and not t["locked"]:
            fab = '<a class="f-fab" href="#replyForm" aria-label="Trả lời">+</a>'
            reply_box = (
                '<div class="f-composer"><form class="form f-form" id="replyForm">'
                f'<input type="hidden" id="rpThread" value="{tid}">'
                '<input type="hidden" id="rpParent" value="">'
                '<label id="rpParentLabel" hidden>Đang trả lời bài <b id="rpParentName"></b> '
                '<button type="button" class="f-mini" id="rpCancel">Hủy</button></label>'
                '<label>Trả lời với tên <b>' + html.escape(me) + "</b>"
                '<textarea id="rpContent" rows="5" maxlength="7500" placeholder="Viết trả lời của bạn…"></textarea></label>'
                + FORUM_ATTACH_HTML +
                '<p class="form-msg" id="rpMsg"></p>'
                '<button class="f-btn f-btn-accent f-btn-block" type="submit">Gửi trả lời</button></form></div>')
        elif t["locked"]:
            reply_box = '<p class="center muted">Chủ đề này đã bị khóa — không trả lời thêm được.</p>'
        else:
            reply_box = ('<p class="center"><a class="f-btn f-btn-accent" href="/tai-khoan">Đăng nhập để trả lời</a></p>')
        main = (
            f'<p class="f-crumb"><a href="/dien-dan">Diễn đàn</a> / <a href="/dien-dan/chuyen-muc/{t["category_id"]}">{html.escape(t["category_name"])}</a></p>'
            f'<h1 class="f-title">{html.escape(t["title"])}</h1>'
            f'<p class="f-thread-head-meta">{html.escape(t["author_name"])} · {fmt_dt(t["created_at"])} · {t["views"]} lượt xem · {forum_tag_chips(t["tags"])} {forum_badges(t)}</p>'
            + mod_bar
            + "".join(render_post(p) for p in by_parent.get(None, []))
            + '<h2 class="f-h2">Trả lời</h2>' + reply_box + fab)
        body = forum_layout(forum_header("", me),
                            forum_sidebar(common["cats"], t["category_id"], me, common["me_posts"]),
                            main, forum_rail(common["top"], common["stats"]))
        return page_response("forum.html", f'{t["title"]} — Diễn đàn OLD TOWN',
                             {"FORUM_BODY": body}, active="forum",
                             head_extra='<script src="/static/forum.js?v=' + ASSET_V + '" defer></script>')
    finally:
        conn.close()


def forum_me(request):
    sess = read_session(request)
    if not sess:
        return None, web.json_response({"ok": False, "error": "Hãy đăng nhập trước."}, status=401)
    return sess["name"], None


def forum_content_error(content):
    """Kiem tra chung cho bai moi / tra loi; tra ve cau bao loi hoac None."""
    if not (1 <= len(content) <= 8000):
        return "Bài viết cần có chữ hoặc ảnh, tối đa 8000 ký tự."
    if len(IMG_ANY_RE.findall(content)) > UPLOAD_PER_POST:
        return f"Mỗi bài tối đa {UPLOAD_PER_POST} ảnh."
    return None


async def api_forum_upload(request):
    """Nhan 1 anh (multipart, truong 'file'), luu vao UPLOAD_DIR, tra ve duong dan."""
    me, err = forum_me(request)
    if err:
        return err
    ip = request.remote or "?"
    if not rate_ok(ip, "forum_upload", 20, 600):
        return web.json_response({"ok": False, "error": "Bạn tải ảnh quá nhanh — chờ một lúc rồi thử lại."})
    try:
        reader = await request.multipart()
        part = await reader.next()
    except Exception:
        part = None
    if part is None or getattr(part, "name", None) != "file":
        return web.json_response({"ok": False, "error": "Không nhận được ảnh."})
    # Doc theo tung khuc va tu chan dung luong (client_max_size khong ap cho multipart stream).
    buf = bytearray()
    while True:
        chunk = await part.read_chunk(65536)
        if not chunk:
            break
        buf += chunk
        if len(buf) > UPLOAD_MAX:
            return web.json_response({"ok": False, "error": "Ảnh quá lớn — tối đa 4 MB mỗi ảnh."})
    ext = sniff_image(bytes(buf[:16]))
    if not ext:
        return web.json_response({"ok": False, "error": "Chỉ nhận ảnh PNG, JPG, WebP hoặc GIF."})
    name = secrets.token_hex(16) + "." + ext
    try:
        os.makedirs(UPLOAD_DIR, exist_ok=True)
        with open(os.path.join(UPLOAD_DIR, name), "wb") as f:
            f.write(buf)
    except OSError:
        return web.json_response({"ok": False, "error": "Server chưa lưu được ảnh — báo admin kiểm tra thư mục uploads."})
    return web.json_response({"ok": True, "url": "/uploads/" + name})


async def pg_upload(request):
    """Phuc vu anh da tai len. Ten file bi rang buoc 32 hex + duoi nen khong the di ra ngoai thu muc."""
    name = request.match_info["name"]
    if not re.fullmatch(r"[0-9a-f]{32}\.(?:png|jpg|webp|gif)", name):
        raise web.HTTPNotFound()
    path = os.path.join(UPLOAD_DIR, name)
    if not os.path.isfile(path):
        raise web.HTTPNotFound()
    return web.FileResponse(path, headers={"Cache-Control": "public, max-age=604800, immutable"})


async def api_forum_threads_list(request):
    sort = request.query.get("sort", "new")
    if sort not in ("new", "hot", "top"):
        sort = "new"
    try:
        limit = min(max(int(request.query.get("limit", "30")), 1), 50)
    except Exception:
        limit = 30
    q = (request.query.get("q", "") or "").strip()[:120]
    tag = (request.query.get("tag", "") or "").strip()[:40]
    cat = request.query.get("category")
    conn = forum_mod.forum_conn()
    try:
        rows = forum_list_threads(conn, sort,
                                  category_id=int(cat) if cat and cat.isdigit() else None,
                                  q=q, tag=tag, limit=limit)
        out = []
        for t in rows:
            st = forum_mod.thread_stats(conn, t["id"])
            out.append({"id": t["id"], "title": t["title"], "author": t["author_name"],
                        "category": t["category_name"], "category_id": t["category_id"],
                        "tags": [x for x in (t["tags"] or "").split(",") if x],
                        "pinned": bool(t["pinned"]), "locked": bool(t["locked"]),
                        "solved": bool(t["solved_post_id"]), "views": t["views"],
                        "replies": st["replies"], "likes": st["likes"],
                        "created_at": t["created_at"], "is_sample": bool(t["is_sample"])})
        return web.json_response({"ok": True, "threads": out})
    finally:
        conn.close()


async def api_forum_create_thread(request):
    me, err = forum_me(request)
    if err:
        return err
    ip = request.remote or "?"
    if not rate_ok(ip, "forum_thread", 5, 3600):
        return web.json_response({"ok": False, "error": "Bạn tạo bài quá nhanh — chờ một lúc rồi thử lại."})
    body = await body_json(request)
    try:
        cid = int(body.get("category_id") or 0)
    except Exception:
        cid = 0
    title = (body.get("title") or "").strip()
    content = (body.get("content") or "").strip()
    tags = ",".join(t.strip()[:40] for t in str(body.get("tags") or "").split(",") if t.strip())[:5]
    if not (3 <= len(title) <= 120):
        return web.json_response({"ok": False, "error": "Tiêu đề cần 3–120 ký tự."})
    bad = forum_content_error(content)
    if bad:
        return web.json_response({"ok": False, "error": bad})
    conn = forum_mod.forum_conn()
    try:
        cat = conn.execute("SELECT id FROM categories WHERE id=?", (cid,)).fetchone()
        if not cat:
            return web.json_response({"ok": False, "error": "Chuyên mục không tồn tại."})
        from datetime import datetime, timezone
        now = datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")
        cur = conn.execute(
            "INSERT INTO threads(category_id,author_name,title,tags,created_at,updated_at)"
            " VALUES(?,?,?,?,?,?)", (cid, me, title, tags, now, now))
        tid = cur.lastrowid
        conn.execute(
            "INSERT INTO posts(thread_id,parent_post_id,author_name,content,created_at)"
            " VALUES(?,NULL,?,?,?)", (tid, me, content, now))
        conn.commit()
        return web.json_response({"ok": True, "id": tid})
    finally:
        conn.close()


async def api_forum_create_post(request):
    me, err = forum_me(request)
    if err:
        return err
    ip = request.remote or "?"
    if not rate_ok(ip, "forum_post", 20, 600):
        return web.json_response({"ok": False, "error": "Bạn trả lời quá nhanh — chờ một lúc rồi thử lại."})
    body = await body_json(request)
    try:
        tid = int(body.get("thread_id") or 0)
        parent = int(body.get("parent_post_id") or 0) or None
    except Exception:
        return web.json_response({"ok": False, "error": "Chủ đề không hợp lệ."})
    content = (body.get("content") or "").strip()
    bad = forum_content_error(content)
    if bad:
        return web.json_response({"ok": False, "error": bad})
    conn = forum_mod.forum_conn()
    try:
        t = conn.execute("SELECT locked FROM threads WHERE id=?", (tid,)).fetchone()
        if not t:
            return web.json_response({"ok": False, "error": "Chủ đề không tồn tại."})
        if t["locked"]:
            return web.json_response({"ok": False, "error": "Chủ đề này đã bị khóa."})
        if parent:
            p = conn.execute("SELECT id FROM posts WHERE id=? AND thread_id=? AND deleted=0",
                             (parent, tid)).fetchone()
            if not p:
                return web.json_response({"ok": False, "error": "Bài cần trả lời không tồn tại."})
        from datetime import datetime, timezone
        now = datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")
        cur = conn.execute(
            "INSERT INTO posts(thread_id,parent_post_id,author_name,content,created_at)"
            " VALUES(?,?,?,?,?)", (tid, parent, me, content, now))
        conn.execute("UPDATE threads SET updated_at=? WHERE id=?", (now, tid))
        conn.commit()
        return web.json_response({"ok": True, "id": cur.lastrowid})
    finally:
        conn.close()


async def api_forum_vote(request):
    me, err = forum_me(request)
    if err:
        return err
    ip = request.remote or "?"
    if not rate_ok(ip, "forum_vote", 30, 300):
        return web.json_response({"ok": False, "error": "Bạn bình chọn quá nhanh — chờ một lúc."})
    body = await body_json(request)
    try:
        pid = int(body.get("post_id") or 0)
        value = int(body.get("value") or 0)
    except Exception:
        return web.json_response({"ok": False, "error": "Dữ liệu không hợp lệ."})
    if value not in (1, -1):
        return web.json_response({"ok": False, "error": "Dữ liệu không hợp lệ."})
    conn = forum_mod.forum_conn()
    try:
        p = conn.execute("SELECT id FROM posts WHERE id=? AND deleted=0", (pid,)).fetchone()
        if not p:
            return web.json_response({"ok": False, "error": "Bài viết không tồn tại."})
        cur = conn.execute("SELECT value FROM votes WHERE post_id=? AND author_name=?", (pid, me)).fetchone()
        if cur and cur["value"] == value:
            conn.execute("DELETE FROM votes WHERE post_id=? AND author_name=?", (pid, me))
        else:
            conn.execute("INSERT INTO votes(post_id,author_name,value) VALUES(?,?,?)"
                         " ON CONFLICT(post_id,author_name) DO UPDATE SET value=excluded.value",
                         (pid, me, value))
        conn.commit()
        return web.json_response({"ok": True, "score": forum_mod.post_score(conn, pid)})
    finally:
        conn.close()


async def api_forum_reaction(request):
    me, err = forum_me(request)
    if err:
        return err
    ip = request.remote or "?"
    if not rate_ok(ip, "forum_react", 30, 300):
        return web.json_response({"ok": False, "error": "Bạn thả cảm xúc quá nhanh — chờ một lúc."})
    body = await body_json(request)
    try:
        pid = int(body.get("post_id") or 0)
    except Exception:
        return web.json_response({"ok": False, "error": "Dữ liệu không hợp lệ."})
    rtype = (body.get("type") or "").strip()
    if rtype not in forum_mod.REACTION_TYPES:
        return web.json_response({"ok": False, "error": "Loại cảm xúc không hợp lệ."})
    conn = forum_mod.forum_conn()
    try:
        p = conn.execute("SELECT id FROM posts WHERE id=? AND deleted=0", (pid,)).fetchone()
        if not p:
            return web.json_response({"ok": False, "error": "Bài viết không tồn tại."})
        cur = conn.execute("SELECT 1 FROM reactions WHERE post_id=? AND author_name=? AND type=?",
                           (pid, me, rtype)).fetchone()
        if cur:
            conn.execute("DELETE FROM reactions WHERE post_id=? AND author_name=? AND type=?",
                         (pid, me, rtype))
        else:
            conn.execute("INSERT INTO reactions(post_id,author_name,type) VALUES(?,?,?)",
                         (pid, me, rtype))
        conn.commit()
        return web.json_response({"ok": True, "reactions": forum_mod.post_reactions(conn, pid)})
    finally:
        conn.close()


async def api_forum_best(request):
    me, err = forum_me(request)
    if err:
        return err
    body = await body_json(request)
    try:
        pid = int(body.get("post_id") or 0)
    except Exception:
        return web.json_response({"ok": False, "error": "Dữ liệu không hợp lệ."})
    conn = forum_mod.forum_conn()
    try:
        p = conn.execute("SELECT * FROM posts WHERE id=? AND deleted=0", (pid,)).fetchone()
        if not p or p["parent_post_id"] is None:
            return web.json_response({"ok": False, "error": "Chỉ ghim được bài trả lời, không ghim bài gốc."})
        t = conn.execute("SELECT * FROM threads WHERE id=?", (p["thread_id"],)).fetchone()
        if not t or (me != t["author_name"] and not forum_mod.is_admin(me)):
            return web.json_response({"ok": False, "error": "Chỉ chủ thớt hoặc quản trị mới ghim đáp án."})
        if t["solved_post_id"] == pid:
            conn.execute("UPDATE threads SET solved_post_id=NULL WHERE id=?", (t["id"],))
            conn.execute("UPDATE posts SET is_best=0 WHERE id=?", (pid,))
        else:
            conn.execute("UPDATE posts SET is_best=0 WHERE thread_id=?", (t["id"],))
            conn.execute("UPDATE posts SET is_best=1 WHERE id=?", (pid,))
            conn.execute("UPDATE threads SET solved_post_id=? WHERE id=?", (pid, t["id"]))
        conn.commit()
        return web.json_response({"ok": True})
    finally:
        conn.close()


async def api_forum_report(request):
    me, err = forum_me(request)
    if err:
        return err
    ip = request.remote or "?"
    if not rate_ok(ip, "forum_report", 10, 3600):
        return web.json_response({"ok": False, "error": "Bạn báo cáo quá nhiều — chờ một lúc."})
    body = await body_json(request)
    try:
        pid = int(body.get("post_id") or 0)
    except Exception:
        return web.json_response({"ok": False, "error": "Dữ liệu không hợp lệ."})
    reason = (body.get("reason") or "").strip()[:300]
    conn = forum_mod.forum_conn()
    try:
        p = conn.execute("SELECT id FROM posts WHERE id=? AND deleted=0", (pid,)).fetchone()
        if not p:
            return web.json_response({"ok": False, "error": "Bài viết không tồn tại."})
        from datetime import datetime, timezone
        now = datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")
        conn.execute("INSERT INTO reports(post_id,reporter_name,reason,created_at) VALUES(?,?,?,?)",
                     (pid, me, reason or "Không ghi lý do", now))
        conn.commit()
        return web.json_response({"ok": True})
    finally:
        conn.close()


async def api_forum_flags(request):
    me, err = forum_me(request)
    if err:
        return err
    if not forum_mod.is_admin(me):
        return web.json_response({"ok": False, "error": "Chỉ quản trị mới dùng được chức năng này."}, status=403)
    body = await body_json(request)
    try:
        tid = int(body.get("thread_id") or 0)
    except Exception:
        return web.json_response({"ok": False, "error": "Dữ liệu không hợp lệ."})
    field = (body.get("field") or "").strip()
    if field not in ("pinned", "locked"):
        return web.json_response({"ok": False, "error": "Dữ liệu không hợp lệ."})
    conn = forum_mod.forum_conn()
    try:
        t = conn.execute("SELECT * FROM threads WHERE id=?", (tid,)).fetchone()
        if not t:
            return web.json_response({"ok": False, "error": "Chủ đề không tồn tại."})
        conn.execute(f"UPDATE threads SET {field}=1-{field} WHERE id=?", (tid,))
        conn.commit()
        row = conn.execute(f"SELECT {field} FROM threads WHERE id=?", (tid,)).fetchone()
        return web.json_response({"ok": True, field: bool(row[field])})
    finally:
        conn.close()


async def api_forum_delete_thread(request):
    me, err = forum_me(request)
    if err:
        return err
    body = await body_json(request)
    try:
        tid = int(body.get("thread_id") or 0)
    except Exception:
        return web.json_response({"ok": False, "error": "Dữ liệu không hợp lệ."})
    conn = forum_mod.forum_conn()
    try:
        t = conn.execute("SELECT * FROM threads WHERE id=?", (tid,)).fetchone()
        if not t:
            return web.json_response({"ok": False, "error": "Chủ đề không tồn tại."})
        if me != t["author_name"] and not forum_mod.is_admin(me):
            return web.json_response({"ok": False, "error": "Chỉ tác giả hoặc quản trị mới xóa được."}, status=403)
        conn.execute("DELETE FROM votes WHERE post_id IN (SELECT id FROM posts WHERE thread_id=?)", (tid,))
        conn.execute("DELETE FROM reactions WHERE post_id IN (SELECT id FROM posts WHERE thread_id=?)", (tid,))
        conn.execute("DELETE FROM reports WHERE post_id IN (SELECT id FROM posts WHERE thread_id=?)", (tid,))
        conn.execute("DELETE FROM posts WHERE thread_id=?", (tid,))
        conn.execute("DELETE FROM threads WHERE id=?", (tid,))
        conn.commit()
        return web.json_response({"ok": True})
    finally:
        conn.close()


async def api_forum_delete_post(request):
    me, err = forum_me(request)
    if err:
        return err
    body = await body_json(request)
    try:
        pid = int(body.get("post_id") or 0)
    except Exception:
        return web.json_response({"ok": False, "error": "Dữ liệu không hợp lệ."})
    conn = forum_mod.forum_conn()
    try:
        p = conn.execute("SELECT * FROM posts WHERE id=? AND deleted=0", (pid,)).fetchone()
        if not p:
            return web.json_response({"ok": False, "error": "Bài viết không tồn tại."})
        if p["parent_post_id"] is None:
            return web.json_response({"ok": False, "error": "Bài gốc chỉ xóa cùng cả chủ đề."})
        if me != p["author_name"] and not forum_mod.is_admin(me):
            return web.json_response({"ok": False, "error": "Chỉ tác giả hoặc quản trị mới xóa được."}, status=403)
        conn.execute("UPDATE posts SET deleted=1, content='' WHERE id=?", (pid,))
        conn.commit()
        return web.json_response({"ok": True})
    finally:
        conn.close()


async def api_forum_leaderboard(request):
    conn = forum_mod.forum_conn()
    try:
        rows = conn.execute(
            "SELECT p.author_name, COUNT(*) AS posts,"
            " (SELECT COALESCE(SUM(v.value),0) FROM votes v JOIN posts p2 ON p2.id=v.post_id"
            "  WHERE p2.author_name=p.author_name AND v.value=1) AS likes,"
            " MAX(m.is_sample) AS is_sample, MAX(m.bio) AS bio"
            " FROM posts p LEFT JOIN members m ON m.name=p.author_name"
            " WHERE p.deleted=0 GROUP BY p.author_name"
            " ORDER BY posts*2 + likes DESC, posts DESC LIMIT 10").fetchall()
        out = [{"name": r["author_name"], "posts": r["posts"], "likes": r["likes"] or 0,
                "score": r["posts"] * 2 + (r["likes"] or 0),
                "is_sample": bool(r["is_sample"]), "bio": r["bio"] or ""} for r in rows]
        return web.json_response({"ok": True, "users": out})
    finally:
        conn.close()


async def api_forum_reports(request):
    me, err = forum_me(request)
    if err:
        return err
    if not forum_mod.is_admin(me):
        return web.json_response({"ok": False, "error": "Chỉ quản trị mới xem được báo cáo."}, status=403)
    conn = forum_mod.forum_conn()
    try:
        rows = conn.execute(
            "SELECT r.*, p.thread_id, p.author_name AS post_author, p.content"
            " FROM reports r JOIN posts p ON p.id=r.post_id"
            " ORDER BY r.created_at DESC LIMIT 50").fetchall()
        out = [{"id": r["id"], "post_id": r["post_id"], "thread_id": r["thread_id"],
                "post_author": r["post_author"], "reporter": r["reporter_name"],
                "reason": r["reason"], "status": r["status"],
                "created_at": r["created_at"],
                "content": (r["content"] or "")[:300]} for r in rows]
        return web.json_response({"ok": True, "reports": out})
    finally:
        conn.close()

# ---------- API ----------
async def api_status(request):
    st = cache_get("status", 15)
    if st is None:
        st = await bridge("GET", "/serverinfo") or {"offline": True, "online": 0, "max": 0}
        cache_set("status", st)
    ip = {"java": "—", "pe": "—"}
    try:
        with open(IP_FILE, encoding="utf-8") as f:
            ip = json.load(f)
    except Exception:
        pass
    # Che tên phần mềm server: trạng thái ping trả về tên bản (vd "Purpur 26.3")
    # nhưng trang công khai chỉ cần biết server đang mở — thay bằng nhãn chung.
    if isinstance(st, dict):
        st = dict(st)
        st["version"] = "OLD TOWN"
    return web.json_response({"server": st, "ip": ip})

async def api_topmoney(request):
    data = cache_get("topmoney", 30)
    if data is None:
        data = await bridge("GET", "/topmoney?limit=50") or {"top": []}
        cache_set("topmoney", data)
    return web.json_response(data)

async def api_stats(request):
    data = cache_get("stats", 60)
    if data is None:
        top = await bridge("GET", "/topmoney?limit=200") or {"top": []}
        players = top.get("top", [])
        data = {"residents": len(players),
                "total_money": round(sum(p.get("balance", 0) for p in players))}
        cache_set("stats", data)
    return web.json_response(data)

async def body_json(request):
    """Doc JSON an toan: loi dinh dang -> {} (cac handler tu bao loi than thien)."""
    try:
        data = await request.json()
        return data if isinstance(data, dict) else {}
    except Exception:
        return {}

async def api_login(request):
    ip = request.remote or "?"
    if not rate_ok(ip, "login", 10, 300):
        return web.json_response({"ok": False, "error": "Thử quá nhiều lần — chờ 5 phút rồi thử lại."})
    body = await body_json(request)
    ident = (body.get("name") or "").strip()
    if GMAIL_RE.match(ident.lower()):
        res = await bridge("POST", "/auth/verifyemail",
                           {"email": ident.lower(), "password": body.get("password", "")})
    else:
        # Dang nhap bang ten chi con la duong lien ket lan dau cho tai khoan CHUA co Gmail;
        # tai khoan da co Gmail bat buoc dang nhap bang Gmail (ca web lan trong game)
        from urllib.parse import quote
        eof = await bridge("GET", "/emailof?name=" + quote(ident))
        if eof and eof.get("email"):
            return web.json_response({"ok": False, "error": "Tài khoản này đã liên kết Gmail — hãy đăng nhập bằng Gmail của bạn."})
        res = await bridge("POST", "/auth/verify",
                           {"name": ident, "password": body.get("password", "")})
    if not res:
        return web.json_response({"ok": False, "error": "Không nối được tới server game — thử lại sau."})
    if not res.get("ok"):
        return web.json_response({"ok": False, "error": "Sai thông tin đăng nhập hoặc mật khẩu."})
    resp = web.json_response({"ok": True, "name": res["name"]})
    resp.set_cookie("ot_session", make_session(res["name"], res["uuid"]),
                    max_age=7 * 86400, httponly=True, samesite="Lax", path="/")
    return resp

async def api_register(request):
    ip = request.remote or "?"
    if not rate_ok(ip, "register", 5, 3600):
        return web.json_response({"ok": False, "error": "Đăng ký quá nhiều lần — chờ một lúc rồi thử lại."})
    body = await body_json(request)
    if body.get("password") != body.get("confirm"):
        return web.json_response({"ok": False, "error": "Mật khẩu nhập lại không khớp."})
    res = await bridge("POST", "/auth/register",
                        {"name": body.get("name", ""), "password": body.get("password", "")})
    if not res:
        return web.json_response({"ok": False, "error": "Không nối được tới server game — thử lại sau."})
    return web.json_response(res)

async def api_config(request):
    return web.json_response({"email_on": EMAIL_ON})

async def api_otp_register(request):
    ip = request.remote or "?"
    if not EMAIL_ON:
        return web.json_response({"ok": False, "error": "Tính năng xác nhận Gmail chưa bật."})
    body = await body_json(request)
    name = (body.get("name") or "").strip()
    email = (body.get("email") or "").strip().lower()
    if body.get("password") != body.get("confirm"):
        return web.json_response({"ok": False, "error": "Mật khẩu nhập lại không khớp."})
    if len(body.get("password") or "") < 4:
        return web.json_response({"ok": False, "error": "Mật khẩu phải từ 4 ký tự trở lên (giống hệt quy định trong game)."})
    if not GMAIL_RE.match(email):
        return web.json_response({"ok": False, "error": "Chỉ chấp nhận địa chỉ Gmail (@gmail.com)."})
    if not rate_ok(ip, "otp:" + email, 3, 3600) or not rate_ok(ip, "otp", 10, 3600):
        return web.json_response({"ok": False, "error": "Gửi mã quá nhiều lần — chờ một lúc rồi thử lại."})
    bal = await bridge("GET", "/balance?name=" + name)
    if bal and bal.get("exists"):
        return web.json_response({"ok": False, "error": "Tên này đã có người đăng ký trong game."})
    code = otp_new("reg:" + email, {"name": name, "password": body.get("password"), "email": email})
    try:
        await send_otp_mail(email, code, "việc đăng ký tài khoản OLD TOWN")
    except Exception:
        OTPS.pop("reg:" + email, None)
        return web.json_response({"ok": False, "error": "Không gửi được email xác nhận — kiểm tra lại địa chỉ Gmail rồi thử lại."})
    return web.json_response({"ok": True, "step": "otp"})

async def api_otp_register_verify(request):
    body = await body_json(request)
    email = (body.get("email") or "").strip().lower()
    data = otp_check("reg:" + email, (body.get("code") or "").strip())
    if not data:
        return web.json_response({"ok": False, "error": "Mã xác nhận sai hoặc đã hết hạn."})
    res = await bridge("POST", "/auth/register",
                       {"name": data["name"], "password": data["password"], "email": data["email"]})
    if not res:
        return web.json_response({"ok": False, "error": "Không nối được tới server game — thử lại sau."})
    if not res.get("ok"):
        return web.json_response(res)
    resp = web.json_response({"ok": True, "name": data["name"].lower(), "email": data["email"]})
    resp.set_cookie("ot_session", make_session(data["name"], res["uuid"]),
                    max_age=7 * 86400, httponly=True, samesite="Lax", path="/")
    return resp

async def api_otp_forgot(request):
    ip = request.remote or "?"
    body = await body_json(request)
    name = (body.get("name") or "").strip()
    email = (body.get("email") or "").strip().lower()
    if not EMAIL_ON:
        return web.json_response({"ok": False, "error": "Tính năng khôi phục qua Gmail chưa bật."})
    if not rate_ok(ip, "otp:" + email, 3, 3600) or not rate_ok(ip, "otp", 10, 3600):
        return web.json_response({"ok": False, "error": "Gửi mã quá nhiều lần — chờ một lúc rồi thử lại."})
    # Tra loi trung lap du khop hay khong (chong do tim tai khoan); chi gui khi khop
    chk = await bridge("POST", "/auth/emailcheck", {"name": name, "email": email})
    if chk and chk.get("match"):
        code = otp_new("forgot:" + email, {"name": name.lower(), "email": email})
        try:
            await send_otp_mail(email, code, "việc đặt lại mật khẩu OLD TOWN")
        except Exception:
            OTPS.pop("forgot:" + email, None)
    return web.json_response({"ok": True, "step": "otp"})

async def api_otp_forgot_reset(request):
    body = await body_json(request)
    email = (body.get("email") or "").strip().lower()
    if body.get("new") != body.get("confirm"):
        return web.json_response({"ok": False, "error": "Mật khẩu mới nhập lại không khớp."})
    if len(body.get("new") or "") < 4:
        return web.json_response({"ok": False, "error": "Mật khẩu mới phải từ 4 ký tự trở lên (giống hệt quy định trong game)."})
    data = otp_check("forgot:" + email, (body.get("code") or "").strip())
    if not data:
        return web.json_response({"ok": False, "error": "Mã xác nhận sai hoặc đã hết hạn."})
    res = await bridge("POST", "/auth/resetpass",
                       {"name": data["name"], "email": data["email"], "new": body.get("new")})
    if not res:
        return web.json_response({"ok": False, "error": "Không nối được tới server game — thử lại sau."})
    return web.json_response(res)

async def api_otp_setemail(request):
    sess = read_session(request)
    if not sess:
        return web.json_response({"ok": False}, status=401)
    ip = request.remote or "?"
    body = await body_json(request)
    email = (body.get("email") or "").strip().lower()
    if not EMAIL_ON:
        return web.json_response({"ok": False, "error": "Tính năng Gmail chưa bật."})
    if not GMAIL_RE.match(email):
        return web.json_response({"ok": False, "error": "Chỉ chấp nhận địa chỉ Gmail (@gmail.com)."})
    if not rate_ok(ip, "otp:" + email, 3, 3600):
        return web.json_response({"ok": False, "error": "Gửi mã quá nhiều lần — chờ một lúc rồi thử lại."})
    code = otp_new("setmail:" + sess["name"].lower(), {"name": sess["name"], "email": email})
    try:
        await send_otp_mail(email, code, "việc liên kết Gmail với tài khoản OLD TOWN")
    except Exception:
        OTPS.pop("setmail:" + sess["name"].lower(), None)
        return web.json_response({"ok": False, "error": "Không gửi được email xác nhận — thử lại sau."})
    return web.json_response({"ok": True, "step": "otp"})

async def api_otp_setemail_verify(request):
    sess = read_session(request)
    if not sess:
        return web.json_response({"ok": False}, status=401)
    body = await body_json(request)
    data = otp_check("setmail:" + sess["name"].lower(), (body.get("code") or "").strip())
    if not data:
        return web.json_response({"ok": False, "error": "Mã xác nhận sai hoặc đã hết hạn."})
    res = await bridge("POST", "/auth/setemail", {"name": data["name"], "email": data["email"]})
    if not res:
        return web.json_response({"ok": False, "error": "Không nối được tới server game — thử lại sau."})
    if res.get("ok"):
        return web.json_response({"ok": True, "email": mask_email(data["email"])})
    return web.json_response(res)

async def api_logout(request):
    resp = web.json_response({"ok": True})
    resp.del_cookie("ot_session", path="/")
    return resp

async def api_me(request):
    sess = read_session(request)
    if not sess:
        return web.json_response({"ok": False}, status=401)
    bal = await bridge("GET", f"/balance?name={sess['name']}")
    did = discord_link(sess["name"])
    from urllib.parse import quote
    eof = await bridge("GET", "/emailof?name=" + quote(sess["name"]))
    return web.json_response({
        "ok": True, "name": sess["name"], "uuid": sess["uuid"],
        "balance": (bal or {}).get("balance", 0),
        "discord_id": did,
        "email": mask_email((eof or {}).get("email")),
        "email_on": EMAIL_ON,
    })

async def api_changepass(request):
    sess = read_session(request)
    if not sess:
        return web.json_response({"ok": False}, status=401)
    ip = request.remote or "?"
    if not rate_ok(ip, "changepass", 10, 300):
        return web.json_response({"ok": False, "error": "Thử quá nhiều lần — chờ ít phút."})
    body = await body_json(request)
    if body.get("new") != body.get("confirm"):
        return web.json_response({"ok": False, "error": "Mật khẩu mới nhập lại không khớp."})
    res = await bridge("POST", "/auth/changepass",
                        {"name": sess["name"], "old": body.get("old", ""), "new": body.get("new", "")})
    if not res:
        return web.json_response({"ok": False, "error": "Không nối được tới server game — thử lại sau."})
    return web.json_response(res)

@web.middleware
async def security_headers(request, handler):
    resp = await handler(request)
    resp.headers["Server"] = "OLD TOWN"
    if request.path.startswith("/static/") and resp.status == 200:
        # CSS/JS chi cache 5 phut + must-revalidate (kem ?v= hash o URL):
        # lan truoc max-age=86400 khien Safari giu style.css cu ca ngay,
        # /dien-dan vo layout tren mobile du CSS moi da deploy.
        if request.path.endswith((".css", ".js")):
            resp.headers["Cache-Control"] = "public, max-age=300, must-revalidate"
        else:
            resp.headers["Cache-Control"] = "public, max-age=86400"
    resp.headers.setdefault("X-Content-Type-Options", "nosniff")
    resp.headers.setdefault("Referrer-Policy", "same-origin")
    resp.headers.setdefault("X-Frame-Options", "DENY")
    resp.headers.setdefault("Content-Security-Policy",
                            "default-src 'self'; img-src 'self' data:; style-src 'self' https://fonts.googleapis.com; "
                            "font-src 'self' https://fonts.gstatic.com; script-src 'self'")
    return resp

def build_app():
    app = web.Application(middlewares=[security_headers], client_max_size=65536)
    app.router.add_get("/", pg_home)
    app.router.add_get("/luat", pg_luat)
    app.router.add_get("/cap-nhat", pg_capnhat)
    app.router.add_get("/huong-dan", pg_huongdan)
    app.router.add_get("/bang-xep-hang", pg_bxh)
    app.router.add_get("/tai-khoan", pg_taikhoan)
    app.router.add_get("/ho-so", pg_hoso)
    app.router.add_get("/quen-mat-khau", pg_forgot)
    app.router.add_get("/dien-dan", pg_forum)
    app.router.add_get("/dien-dan/tao-bai", pg_forum_new)
    app.router.add_get("/dien-dan/chuyen-muc/{cid}", pg_forum_category)
    app.router.add_get("/dien-dan/chu-de/{tid}", pg_forum_thread)
    app.router.add_get("/api/forum/threads", api_forum_threads_list)
    app.router.add_get("/api/forum/leaderboard", api_forum_leaderboard)
    app.router.add_get("/api/forum/reports", api_forum_reports)
    app.router.add_post("/api/forum/threads", api_forum_create_thread)
    app.router.add_post("/api/forum/posts", api_forum_create_post)
    app.router.add_post("/api/forum/upload", api_forum_upload)
    app.router.add_get("/uploads/{name}", pg_upload)
    app.router.add_post("/api/forum/vote", api_forum_vote)
    app.router.add_post("/api/forum/reaction", api_forum_reaction)
    app.router.add_post("/api/forum/best-answer", api_forum_best)
    app.router.add_post("/api/forum/report", api_forum_report)
    app.router.add_post("/api/forum/flags", api_forum_flags)
    app.router.add_post("/api/forum/delete-thread", api_forum_delete_thread)
    app.router.add_post("/api/forum/delete-post", api_forum_delete_post)
    app.router.add_get("/api/config", api_config)
    app.router.add_post("/api/otp/register", api_otp_register)
    app.router.add_post("/api/otp/register/verify", api_otp_register_verify)
    app.router.add_post("/api/otp/forgot", api_otp_forgot)
    app.router.add_post("/api/otp/forgot/reset", api_otp_forgot_reset)
    app.router.add_post("/api/otp/setemail", api_otp_setemail)
    app.router.add_post("/api/otp/setemail/verify", api_otp_setemail_verify)
    app.router.add_get("/api/status", api_status)
    app.router.add_get("/api/topmoney", api_topmoney)
    app.router.add_get("/api/stats", api_stats)
    app.router.add_get("/api/me", api_me)
    app.router.add_post("/api/login", api_login)
    app.router.add_post("/api/register", api_register)
    app.router.add_post("/api/logout", api_logout)
    app.router.add_post("/api/changepass", api_changepass)
    app.router.add_static("/static/", os.path.join(BASE, "static"))
    return app

if __name__ == "__main__":
    web.run_app(build_app(), host="0.0.0.0", port=int(os.environ.get("PORT", "80")),
                access_log=None)
