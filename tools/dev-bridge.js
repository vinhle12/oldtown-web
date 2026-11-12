// Bridge gia cho app.py khi chay thu tren may nay (du lieu mau).
const http = require("http");
const TOP = [["Chooty_427", 1284500], [".Lntphong207", 962300], ["KienXayNha", 731250], ["ThoMo99", 598400], ["LaoNongOT", 455120], ["BeThaoPE", 310900]].map(([name, balance]) => ({ name, balance }));
const GUIDE = ["Bìa", "§1 LUẬT CHUNG\n▪ Tôn trọng mọi cư dân.\n▪ Cấm hack/cheat.", "LỆNH CƠ BẢN\n▪ /sach — nhận lại sách\n▪ /diemdanh — điểm danh", "LÀNG & ĐẤT ĐAI\n▪ /town new <tên>\n▪ /town claim", "KINH TẾ\n▪ /shop\n▪ /ah\n▪ /bank", "CHIẾN ĐẤU\n▪ /danhhieu\n▪ /cuonghoa"];
http.createServer((req, res) => {
  const u = new URL(req.url, "http://x"); let d = {};
  if (u.pathname === "/serverinfo") d = { offline: false, online: 37, max: 100, version: "Purpur" };
  else if (u.pathname === "/topmoney") d = { top: TOP };
  else if (u.pathname === "/guide") d = { pages: GUIDE };
  else if (u.pathname === "/balance") d = { exists: true, balance: 1284500 };
  else if (u.pathname === "/emailof") d = { email: null };
  res.writeHead(200, { "Content-Type": "application/json" }); res.end(JSON.stringify(d));
}).listen(8920, "127.0.0.1", () => console.log("bridge 8920"));
