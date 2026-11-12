# -*- coding: utf-8 -*-
"""Diễn đàn OLD TOWN — lớp dữ liệu SQLite cho website thật trên .110.

- Dùng chung tài khoản game/web (tên trong cookie ot_session), KHÔNG tạo
  tài khoản forum riêng, KHÔNG có tài khoản/mật khẩu mẫu nào ở đây.
- DB nằm ở /var/lib/oldtown/forum.db (thư mục thuộc user oldtown, ghi được
  dù service chạy ProtectSystem=full — /opt/oldtown/web chỉ đọc với user này).
- Dữ liệu seed là dữ liệu MẪU lấy nguyên văn từ bản dựng thử (artifact
  dien-dan-old-town): 7 chuyên mục, 10 chủ đề, 25 bài, 8 thành viên mẫu.
  Tất cả đều gắn cờ is_sample=1 để xóa/lọc sau này.
"""
import os
import sqlite3

FORUM_DB = os.environ.get("FORUM_DB", "/var/lib/oldtown/forum.db")
ADMIN_USERS = set(
    x.strip().lower()
    for x in os.environ.get("ADMIN_USERS", "").split(",")
    if x.strip()
)

REACTION_TYPES = ("like", "fire", "idea")
REACTION_LABEL = {"like": "Thích", "fire": "Cháy", "idea": "Ý hay"}

CATEGORIES = [
    (1, "Thông báo", "Thông báo chính thức từ ban quản trị server", "megaphone", "#b45309", 1),
    (2, "Hướng dẫn người mới", "Đăng ký, chọn nghề, kiếm tiền và những điều cần biết khi mới vào OLD TOWN", "book", "#177245", 2),
    (3, "Khoe nhà / Build", "Show công trình, xin góp ý và khoe góc build tâm đắc", "home", "#0e7490", 3),
    (4, "Tuyển town / Tìm đồng đội", "Tìm người lập town, tuyển cư dân, rủ nhau đi farm và khám phá", "users", "#6d28d9", 4),
    (5, "Chợ / Trade", "Mua bán qua /ah và /trade, rao giá và tìm món đang cần", "cart", "#be5a0b", 5),
    (6, "Hỏi đáp / Báo lỗi", "Thắc mắc về luật, nghề, redstone và báo lỗi khi chơi (Java & PE)", "help", "#b91c1c", 6),
    (7, "Chuyện ngoài lề", "Tán gẫu ngoài Minecraft, miễn không vi phạm nội quy", "chat", "#4d5560", 7),
]

# (thread_id, category_id, author, title, tags, pinned, views, created_at)
SEED_THREADS = [
    (1, 1, "AdminOT", "Nội quy diễn đàn & luật server OLD TOWN — đọc kỹ §5, §6, §7 trước khi chơi",
     "nội-quy,luật-server", 1, 842, "2026-10-06T16:20:08Z"),
    (2, 1, "AdminOT", "Diễn đàn OLD TOWN mở bản dựng thử — mời cư dân vào góp ý",
     "thông-báo", 1, 517, "2026-11-03T16:20:08Z"),
    (3, 2, "ModLinh", "Người mới bắt đầu: đăng ký web, liên kết Gmail, chọn nghề và kiếm tiền đầu tiên",
     "người-mới,nghề,kiếm-tiền", 1, 689, "2026-10-16T16:20:08Z"),
    (4, 6, "DanChoJava", "Sao máy redstone của mình cứ đứng yên, không chạy nữa?",
     "redstone,chống-lag", 0, 356, "2026-10-30T16:20:08Z"),
    (5, 3, "KienXayNha", "Khoe căn nhà gỗ sồi đầu tiên ở khu ngoại ô — xin góp ý phần mái",
     "nhà-gỗ,góp-ý", 0, 274, "2026-11-01T16:20:08Z"),
    (6, 5, "ThoMo99", "[Bán] Quặng sắt + kim cương đào tay, giá chợ — giao dịch qua /ah cho an toàn",
     "bán,quặng", 0, 198, "2026-11-04T16:20:08Z"),
    (7, 4, "LaoNongOT", "Khu nông trại Sông Xanh tuyển 2 cư dân: có đất sẵn, chỉ cần chăm farm đúng nghề",
     "tuyển-người,nông-trại", 0, 167, "2026-10-31T16:20:08Z"),
    (8, 6, "BeThaoPE", "PE đăng nhập bằng Gmail thế nào? Mình nhập mật khẩu cũ nó báo không đúng",
     "pe,đăng-nhập,gmail", 0, 231, "2026-11-02T16:20:08Z"),
    (9, 2, "LaoNongOT", "Hiểu đúng trần farm §7: 15 con/chunk, quá 8 con/ô là ngạt — đừng dồn chuồng",
     "farm,chăn-nuôi", 0, 302, "2026-10-27T16:20:08Z"),
    (10, 7, "CuDanMoi", "Ngoài OLD TOWN, mọi người đang cày thêm game gì?",
     "tán-gẫu", 0, 143, "2026-11-05T07:20:08Z"),
]

# (post_id, thread_id, parent_post_id, author, content, created_at, is_best)
SEED_POSTS = [
    (1, 1, None, "AdminOT",
     """Chào cư dân OLD TOWN. Đây là bản tóm tắt luật đang áp dụng trên server, đăng lên diễn đàn để mọi người tra cứu bất cứ lúc nào:

§5 — Giao dịch ngoài hệ thống (giao dịch tay, qua trung gian ngoài /ah và /trade) là tự chịu rủi ro. Admin không đòi đồ, không đền bù hộ các giao dịch ngoài hệ thống.

§6 — Admin không giải quyết việc cá nhân, lẻ tẻ. Ban quản trị chỉ can thiệp khi có hack/cheat, lừa đảo qua hệ thống của server, hoặc lỗi ảnh hưởng diện rộng.

§7 — Giới hạn chống lag: trần vật nuôi 15 con/chunk (quá 8 entity/ô sẽ bị ngạt dần); đa số linh kiện redstone (bụi đỏ, phễu, piston, observer, comparator, repeater, dispenser, dropper...) bị chặn đặt và chế tạo; máy vượt trần tần suất sẽ đứng yên — đó là cơ chế chống lag, không phải lỗi.

Trên diễn đàn: đăng bài đúng chuyên mục, không spam, không rao bán ngoài mục Chợ. Bài mẫu trong bản dựng thử này đều là dữ liệu mẫu để mọi người xem giao diện.""",
     "2026-10-06T16:20:08Z", 0),
    (2, 1, 1, "BeThaoPE",
     "Đã đọc rõ ạ. Mục §7 giải thích luôn lý do máy redstone cũ của em đứng yên, trước giờ cứ tưởng server lag.",
     "2026-10-07T16:20:08Z", 0),
    (3, 1, 1, "ModLinh",
     "Ai chưa rõ điều nào trong §5–§7 thì hỏi ngay dưới bài này, mình ghim bài lên đầu chuyên mục Thông báo để người mới dễ thấy.",
     "2026-10-07T16:20:08Z", 0),
    (4, 2, None, "AdminOT",
     """Diễn đàn cộng đồng của OLD TOWN chính thức có bản dựng thử. Mọi người có thể đăng bài, trả lời, thả cảm xúc, bình chọn và xem hồ sơ thành viên ngay trên điện thoại (đa số cư dân chơi PE nên diễn đàn làm theo kiểu chạm là chính, nút to, không cần di chuột).

Lưu ý: toàn bộ thành viên và bài viết hiện tại là DỮ LIỆU MẪU để xem giao diện. Muốn thử đăng bài thì tự đăng ký một tài khoản ở góc trên bên phải — mất chưa tới một phút. Góp ý giao diện cứ để lại dưới bài này.""",
     "2026-11-03T16:20:08Z", 0),
    (5, 2, 4, "CuDanMoi",
     "Em vào bằng điện thoại thấy bấm rất vừa tay. Mong sớm có bản thật để anh em trao đổi ngoài giờ chơi.",
     "2026-11-04T16:20:08Z", 0),
    (6, 3, None, "ModLinh",
     """Hướng dẫn nhanh cho cư dân mới vào OLD TOWN:

1. Đăng ký tài khoản CHỈ trên website của server (trong game đã tắt đăng ký). Đăng ký 2 bước với mã OTP gửi về Gmail, và tài khoản nào đã liên kết Gmail thì đăng nhập bằng Gmail + mật khẩu.

2. Mỗi người đúng 1 nghề: thợ mỏ, tiều phu, nông dân, thợ săn, ngư dân, thợ đào. Làm việc của nghề khác sẽ không ra sản phẩm đúng nghề. Đổi nghề tốn 25.000₫, chờ 7 ngày và reset cấp — cân nhắc kỹ trước khi chọn.

3. Kiếm tiền: làm việc đúng nghề rồi bán qua chợ /ah hoặc giao dịch /trade với người chơi khác. /shop không còn thu mua hàng nghề để chợ người chơi sống được.

4. Ở hoang dã được chặt gỗ, đặt/đập đuốc và đập quặng lộ thiên; quặng chôn kín và tài sản trong town của người khác thì không.""",
     "2026-10-16T16:20:08Z", 0),
    (7, 3, 6, "CuDanMoi",
     "Phần đổi nghề tốn 25.000₫ và chờ 7 ngày rất đáng lưu ý. Em xém chọn bừa thợ đào, may đọc bài này trước.",
     "2026-10-17T16:20:08Z", 0),
    (8, 3, 6, "LaoNongOT",
     "Thêm mẹo nhỏ: chọn nghề nông dân thì đầu tư chuồng trại vừa phải thôi, nhớ trần 15 con/chunk ở §7 kẻo đàn bị ngạt.",
     "2026-10-18T16:20:08Z", 0),
    (9, 4, None, "DanChoJava",
     "Mình dựng cái clock nhỏ bằng repeater với observer mà chạy được vài giây là đứng yên, tắt luôn. Server lag hay máy mình hỏng vậy mọi người? Trước đây vẫn chạy bình thường.",
     "2026-10-30T16:20:08Z", 0),
    (10, 4, 9, "AdminOT",
     "Không phải lỗi đâu bạn. Server có RedstoneGuard: clock đổi trạng thái quá 3 lần/giây tại một vị trí sẽ bị giữ nhịp, và đa số linh kiện redstone (observer, repeater, comparator, piston, phễu...) nằm trong danh sách chặn đặt/chế tạo theo §7 để chống lag. Máy vượt trần thì đứng yên — đó là cơ chế, không phải bug. Cần gạt, nút bấm, tấm đạp, đèn đỏ vẫn dùng bình thường.",
     "2026-10-30T16:20:08Z", 1),
    (11, 4, 10, "DanChoJava",
     "À ra vậy, cảm ơn admin. Vậy mình chuyển sang cơ chế tay gạt + đèn đỏ cho khu nhà là ổn.",
     "2026-10-30T16:20:08Z", 0),
    (12, 5, None, "KienXayNha",
     "Sau 3 buổi tối chặt gỗ (nghề tiều phu nên gỗ là của nhà trồng được), mình dựng xong căn nhà gỗ sồi 2 tầng ở khu ngoại ô: tầng 1 làm kho + lò nung, tầng 2 phòng ngủ nhìn ra sông. Phần mái mình đang phân vân giữa đá phiến và gạch nung — gạch thì ấm mà nặng mắt, đá phiến thì hợp mái dốc hơn. Mọi người thấy sao?",
     "2026-11-01T16:20:08Z", 0),
    (13, 5, 12, "BeThaoPE",
     "Đá phiến đi bạn, nhìn từ xa mái dốc nổi hẳn. Thêm hàng rào gỗ quanh sân nữa là đúng chất ngoại ô OLD TOWN.",
     "2026-11-01T16:20:08Z", 0),
    (14, 5, 12, "LaoNongOT",
     "Nhà đẹp. Góp ý nhỏ: trồng thêm 2 luống hoa trước sân, vừa đẹp vừa có chỗ cho ong nếu sau này bạn nuôi ong lấy mật.",
     "2026-11-02T16:20:08Z", 0),
    (15, 6, None, "ThoMo99",
     "Mình là thợ mỏ, vừa xong chuyến đào sâu nên dư: sắt thô, ít kim cương và redstone (bụi đỏ vẫn bán được làm vật phẩm nấu thuốc/chế đèn nhé). Tất cả mình treo trên /ah, giá theo mặt bằng chợ. Nhắc lại §5: giao dịch ngoài hệ thống là tự chịu rủi ro, nên cứ /ah và /trade cho chắc.",
     "2026-11-04T16:20:08Z", 0),
    (16, 6, 15, "CuDanMoi",
     "Em mới vào đang cần sắt làm bộ giáp đầu tiên, đã mua trên /ah của anh rồi, giao nhanh gọn.",
     "2026-11-04T20:20:08Z", 0),
    (17, 7, None, "LaoNongOT",
     "Khu nông trại của mình ở ven sông đang thừa 2 khoảnh đất đẹp. Tuyển cư dân nghề nông dân (hoặc sắp chọn nghề) vào ở chung: đất mình cấp sẵn, giống ban đầu mình hỗ trợ, thu hoạch bán qua /ah chia theo công. Điều kiện duy nhất: farm trong trần 15 con/chunk và không phá ruộng của nhau. Ai quan tâm trả lời dưới bài này.",
     "2026-10-31T16:20:08Z", 0),
    (18, 7, 17, "BeThaoPE",
     "Em chơi PE, nghề đang tính chọn nông dân. Cho em xin 1 suất, tối em online đều.",
     "2026-11-01T16:20:08Z", 0),
    (19, 8, None, "BeThaoPE",
     "Mình chơi trên điện thoại. Tài khoản của mình đã liên kết Gmail trên web rồi, vào game nhập kiểu cũ /login <mật khẩu> thì bị từ chối. Giờ đăng nhập bằng cách nào vậy mọi người?",
     "2026-11-02T16:20:08Z", 0),
    (20, 8, 19, "ModLinh",
     "Từ khi bật đăng nhập Gmail: tài khoản đã liên kết Gmail thì khi vào game, nhập địa chỉ Gmail qua khung chat (tin nhắn bị chặn lại, không phát ra ngoài), sau đó gõ mật khẩu trên bàn phím PIN. Hoặc dùng /login <Gmail> <mật khẩu>. Kiểu cũ /login <mật khẩu> bị từ chối là đúng thiết kế. Sai Gmail hay mật khẩu đều báo chung một câu, sai 5 lần sẽ bị kick.",
     "2026-11-02T16:20:08Z", 1),
    (21, 8, 20, "BeThaoPE",
     "Được rồi ạ, em vào được ngay sau khi nhập Gmail. Cảm ơn mod!",
     "2026-11-02T16:20:08Z", 0),
    (22, 9, None, "LaoNongOT",
     "Nhiều bạn thắc mắc sao đàn bò tự nhiên chết dần. Lý do nằm ở §7: mỗi chunk nuôi tối đa 15 con vật nuôi (bò/lợn/cừu/gà/dê/thỏ/nấm); đầy trần thì chặn sinh sản và trứng nở. Thêm nữa, quá 8 entity trong cùng 1 ô sẽ bị ngạt và chết dần theo thời gian. Chuồng dồn sẵn từ trước không bị xóa, nhưng cứ dồn thêm là thiệt. Lời khuyên: chia chuồng theo chunk, mỗi ô để thưa ra, đếm sơ số con trước khi cho sinh sản.",
     "2026-10-27T16:20:08Z", 0),
    (23, 9, 22, "ThoMo99",
     "Hóa ra con số 8 là giới hạn ngạt theo ô, còn 15 là trần theo chunk. Trước giờ mình cứ tưởng chung một loại trần.",
     "2026-10-28T16:20:08Z", 0),
    (24, 10, None, "CuDanMoi",
     "Tò mò hỏi chơi: ngoài giờ vào OLD TOWN xây nhà đào mỏ, anh em còn đang chơi game gì nữa không? Em đang phân vân tìm 1 game nhẹ chơi trên điện thoại lúc không mở Minecraft được.",
     "2026-11-05T07:20:08Z", 0),
    (25, 10, 24, "DanChoJava",
     "Mình thì ngoài Minecraft chỉ còn giữ đúng 1 game đua xe nhẹ để giải trí nhanh. Tuổi này thời gian ít, tập trung một server là đủ rồi.",
     "2026-11-05T11:20:08Z", 0),
]

# Thành viên mẫu (chỉ để hiển thị hồ sơ/bảng xếp hạng mẫu — không phải tài khoản).
SEED_MEMBERS = [
    ("AdminOT", "Quản trị viên server OLD TOWN. Có việc gấp về hack/cheat hay lỗi diện rộng thì cứ tag mình.", "2026-07-08T16:20:08Z"),
    ("ModLinh", "Điều hành viên diễn đàn — giữ nhà cửa gọn gàng, bài sai chuyên mục mình sẽ chuyển giúp.", "2026-07-18T16:20:08Z"),
    ("KienXayNha", "Dân build chính hiệu, mê nhà gỗ sồi và mái đá phiến. Nhận góp ý công trình.", "2026-09-06T16:20:08Z"),
    ("BeThaoPE", "Chơi bằng điện thoại (PE) 100%. Ai cần test tính năng trên PE cứ gọi mình.", "2026-09-21T16:20:08Z"),
    ("ThoMo99", "Thợ mỏ toàn thời gian. Đào sâu, bán quặng, sống chậm.", "2026-09-28T16:20:08Z"),
    ("LaoNongOT", "Nông dân kỳ cựu, chuyên lúa mì và chuồng trại đúng trần farm của server.", "2026-10-06T16:20:08Z"),
    ("DanChoJava", "Chơi Java trên PC, thích redstone trong giới hạn cho phép của server.", "2026-10-15T16:20:08Z"),
    ("CuDanMoi", "Mới vào OLD TOWN được vài hôm, đang học chọn nghề và kiếm tiền đầu tiên.", "2026-11-02T16:20:08Z"),
]

SCHEMA = """
CREATE TABLE IF NOT EXISTS categories(
  id INTEGER PRIMARY KEY, name TEXT NOT NULL, description TEXT NOT NULL DEFAULT '',
  icon TEXT NOT NULL DEFAULT 'chat', color TEXT NOT NULL DEFAULT '#4d5560',
  sort_order INTEGER NOT NULL DEFAULT 0);
CREATE TABLE IF NOT EXISTS members(
  name TEXT PRIMARY KEY, bio TEXT NOT NULL DEFAULT '', joined_at TEXT NOT NULL DEFAULT '',
  is_sample INTEGER NOT NULL DEFAULT 0);
CREATE TABLE IF NOT EXISTS threads(
  id INTEGER PRIMARY KEY, category_id INTEGER NOT NULL REFERENCES categories(id),
  author_name TEXT NOT NULL, title TEXT NOT NULL, tags TEXT NOT NULL DEFAULT '',
  pinned INTEGER NOT NULL DEFAULT 0, locked INTEGER NOT NULL DEFAULT 0,
  solved_post_id INTEGER, views INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL, updated_at TEXT NOT NULL, is_sample INTEGER NOT NULL DEFAULT 0);
CREATE TABLE IF NOT EXISTS posts(
  id INTEGER PRIMARY KEY, thread_id INTEGER NOT NULL REFERENCES threads(id),
  parent_post_id INTEGER REFERENCES posts(id), author_name TEXT NOT NULL,
  content TEXT NOT NULL, is_best INTEGER NOT NULL DEFAULT 0,
  deleted INTEGER NOT NULL DEFAULT 0, created_at TEXT NOT NULL,
  is_sample INTEGER NOT NULL DEFAULT 0);
CREATE TABLE IF NOT EXISTS votes(
  post_id INTEGER NOT NULL REFERENCES posts(id), author_name TEXT NOT NULL,
  value INTEGER NOT NULL, PRIMARY KEY(post_id, author_name));
CREATE TABLE IF NOT EXISTS reactions(
  post_id INTEGER NOT NULL REFERENCES posts(id), author_name TEXT NOT NULL,
  type TEXT NOT NULL, PRIMARY KEY(post_id, author_name, type));
CREATE TABLE IF NOT EXISTS reports(
  id INTEGER PRIMARY KEY AUTOINCREMENT, post_id INTEGER NOT NULL,
  reporter_name TEXT NOT NULL, reason TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL DEFAULT 'mo', created_at TEXT NOT NULL);
CREATE INDEX IF NOT EXISTS idx_posts_thread ON posts(thread_id);
CREATE INDEX IF NOT EXISTS idx_threads_cat ON threads(category_id);
"""


def forum_conn():
    conn = sqlite3.connect(FORUM_DB, timeout=10)
    conn.row_factory = sqlite3.Row
    try:
        conn.execute("PRAGMA journal_mode=WAL")
        conn.execute("PRAGMA busy_timeout=10000")
        conn.execute("PRAGMA foreign_keys=ON")
        conn.executescript(SCHEMA)
        conn.commit()
        seed_if_empty(conn)
    except Exception:
        # Khong bao gio de connection loi ro ri giu lock DB.
        try:
            conn.rollback()
        except Exception:
            pass
        conn.close()
        raise
    return conn


def seed_if_empty(conn):
    if conn.execute("SELECT COUNT(*) FROM categories").fetchone()[0]:
        return
    conn.executemany(
        "INSERT INTO categories(id,name,description,icon,color,sort_order) VALUES(?,?,?,?,?,?)",
        CATEGORIES)
    conn.executemany(
        "INSERT INTO members(name,bio,joined_at,is_sample) VALUES(?,?,?,1)",
        SEED_MEMBERS)
    for tid, cat, author, title, tags, pinned, views, created in SEED_THREADS:
        conn.execute(
            "INSERT INTO threads(id,category_id,author_name,title,tags,pinned,locked,"
            "solved_post_id,views,created_at,updated_at,is_sample) "
            "VALUES(?,?,?,?,?,?,0,NULL,?,?,?,1)",
            (tid, cat, author, title, tags, pinned, views, created, created))
    for pid, tid, parent, author, content, created, is_best in SEED_POSTS:
        conn.execute(
            "INSERT INTO posts(id,thread_id,parent_post_id,author_name,content,"
            "is_best,deleted,created_at,is_sample) VALUES(?,?,?,?,?,0,0,?,1)",
            (pid, tid, parent, author, content, created))
        if is_best:
            conn.execute("UPDATE posts SET is_best=1 WHERE id=?", (pid,))
            conn.execute("UPDATE threads SET solved_post_id=? WHERE id=?", (pid, tid))
    # Bài gốc mỗi chủ đề được 3 lượt +1 mẫu (đúng số liệu bản thử).
    others = [m[0] for m in SEED_MEMBERS]
    for tid, _cat, author, _t, _tags, _p, _v, _c in SEED_THREADS:
        op = conn.execute(
            "SELECT id FROM posts WHERE thread_id=? AND parent_post_id IS NULL",
            (tid,)).fetchone()
        if not op:
            continue
        voters = [n for n in others if n != author][:3]
        for v in voters:
            conn.execute(
                "INSERT OR IGNORE INTO votes(post_id,author_name,value) VALUES(?,?,1)",
                (op["id"], v))
    conn.commit()


def is_admin(name):
    return bool(name) and name.lower() in ADMIN_USERS


def thread_stats(conn, thread_id):
    row = conn.execute(
        "SELECT (SELECT COUNT(*) FROM posts WHERE thread_id=? AND deleted=0)-1 AS replies,"
        " (SELECT COALESCE(SUM(value),0) FROM votes v JOIN posts p ON p.id=v.post_id"
        "  WHERE p.thread_id=?) AS likes",
        (thread_id, thread_id)).fetchone()
    return {"replies": max(0, row["replies"]), "likes": row["likes"] or 0}


def post_score(conn, post_id):
    row = conn.execute(
        "SELECT COALESCE(SUM(value),0) AS s FROM votes WHERE post_id=?",
        (post_id,)).fetchone()
    return row["s"] or 0


def post_reactions(conn, post_id):
    rows = conn.execute(
        "SELECT type, COUNT(*) AS n FROM reactions WHERE post_id=? GROUP BY type",
        (post_id,)).fetchall()
    return {r["type"]: r["n"] for r in rows}
