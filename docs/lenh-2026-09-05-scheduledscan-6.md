# LỆNH #22 — 3 việc anh chốt sau sự cố scheduledScan (05/09/2026)

> **Quyết định của anh (05/09)**: (1) **TẮT** 5 nguồn quét bằng nick (neu1 · bk-1 · nguyên căn 1 · hhqcvain1 · Tm S Con Sen) — đường quét nick chết (thiếu cookie + `BROWSER_SVC_URL` chưa cấu hình) → mỗi lượt +5 `scrapeErrors` vô ích; (2) **`SCANNED_TTL_DAYS` = 3 ngày** + sửa `lib/config.js` đọc đúng từ `.env` (trước đây `.env` có nhưng config.js quên đọc → TTL "Bài đã quét" luôn 1 ngày); (3) **dời địa chỉ VPS** khỏi mặc định trong `lib/config.js` (`VPS_URL`) sang `.env` — LỆNH tự chép giá trị hiện tại vào `.env` nếu chưa có rồi mới đổi mặc định thành `''` → hành vi không đổi. **Không in địa chỉ VPS ra màn hình** (mọi grep đều che IP).
>
> **★ KẾT QUẢ LẦN CHẠY 1 (05/09 03:41 VN) + BÀI HỌC**: (a)+(b) chạy đúng — backup `lib/config.js.bak-20260905-034109` + `.env.bak-20260905-034109` (= BẢN GỐC để rollback), `PATCH OK` (config.js thêm `SCANNED_TTL_DAYS`, `.env` thêm `VPS_URL`, `VPS_URL` mặc định → `''`, `.env` `SCANNED_TTL_DAYS 7 → 3`). **Dừng ở (c)**: bash tương tác của Cloud Shell làm **history expansion ký tự `!`** trên dòng lệnh (kể cả trong dấu nháy kép và trên dòng nối `\`): `!!CFG.VPS_URL` bị thay bằng LỆNH TRƯỚC (nguyên heredoc `_ss22_src.mjs`) → node `SyntaxError`; `(TRỐNG!)` ở (g) → `-bash: !: event not found`. Heredoc `<<'EOF'` KHÔNG bị (script `ss22.cjs` có `!m`… vẫn chạy đúng). ⇒ **Từ nay mọi chuỗi lệnh dài ghi vào file `.sh` bằng heredoc quoted rồi `bash file.sh`; không dùng `!` ngoài heredoc.** Chưa deploy, chưa tắt nguồn → chạy lại KHỐI 1 (bản dưới, idempotent: (a) thấy marker `v-ttl-vps` thì giữ backup cũ; (b) báo "đã có, giữ nguyên").
>
> Cách chạy: dán NGUYÊN KHỐI vào Cloud Shell. Khối chỉ tạo 3 file bằng heredoc rồi `bash /tmp/ss22_run.sh`; trong script mọi bước xích `&&` (bài học #20) — lỗi ở đâu dừng ở đó. Rollback: `cp lib/config.js.bak-20260905-034109 lib/config.js; cp .env.bak-20260905-034109 .env` rồi deploy lại.

## KHỐI 1 — chạy ngay (bản 2, chạy qua file .sh)

```bash
cd ~/firebase-s13/functions || exit 1

cat > /tmp/ss22.cjs <<'EOF'
/* LỆNH #22 (05/09/2026) — patch lib/config.js + .env theo MỐC NỘI DUNG, idempotent (marker v-ttl-vps), KHÔNG in giá trị VPS_URL.
   (2) SCANNED_TTL_DAYS: config.js đọc từ .env (mặc định 3) + .env đặt = 3.
   (3) VPS_URL: chép mặc định trong config.js sang .env (nếu .env chưa có/để trống) rồi đổi mặc định trong config.js thành ''. */
const fs = require('fs');
const CFG_F = 'lib/config.js', ENV_F = '.env';
const TTL_DAYS = '3';
let cfg = fs.readFileSync(CFG_F, 'utf8');
let envTxt = fs.existsSync(ENV_F) ? fs.readFileSync(ENV_F, 'utf8') : '';
const out = [];
const C = cfg.split('\n');

/* ---- (2) SCANNED_TTL_DAYS trong config.js ---- */
if (C.some(l => /^\s*SCANNED_TTL_DAYS\s*:/.test(l))) {
  out.push('config.js: SCANNED_TTL_DAYS đã có (giữ nguyên)');
} else {
  let after = C.findIndex(l => /^\s*FULLSWEEP_HOURS\s*:/.test(l));
  if (after < 0) after = C.findIndex(l => /^\s*POSTS_PER_GROUP\s*:/.test(l));
  if (after < 0) { console.log('KHONG THAY MOC FULLSWEEP_HOURS/POSTS_PER_GROUP trong lib/config.js — KHONG GHI GI'); process.exit(2); }
  C.splice(after + 1, 0,
    "  // v-ttl-vps 05/09/2026: TTL 'Bài đã quét' KHÔNG thành lead (ngày) — .env có sẵn nhưng config.js quên đọc → trước đây luôn 1 ngày",
    "  SCANNED_TTL_DAYS: num(env.SCANNED_TTL_DAYS, " + TTL_DAYS + "),");
  out.push('config.js: đã thêm SCANNED_TTL_DAYS: num(env.SCANNED_TTL_DAYS, ' + TTL_DAYS + ') sau dòng ' + (after + 1));
}

/* ---- (3) VPS_URL: config.js → .env ---- */
const vi = C.findIndex(l => /^\s*VPS_URL\s*:/.test(l));
if (vi < 0) { console.log('KHONG THAY MOC VPS_URL trong lib/config.js — KHONG GHI GI'); process.exit(2); }
const m = C[vi].match(/^(\s*VPS_URL\s*:\s*env\.VPS_URL\s*\|\|\s*)(['"])(.*?)\2(\s*,?)(.*)$/);
if (!m) { console.log('DONG VPS_URL KHONG DUNG DANG env.VPS_URL || \'…\' — KHONG GHI GI. Dòng (đã che IP): ' + C[vi].replace(/\d{1,3}(\.\d{1,3}){3}/g, '<IP>')); process.exit(2); }
const cfgDefault = m[3];                       // giá trị mặc định đang nằm trong code (KHÔNG in)
let envLines = envTxt.split('\n');
const ei = envLines.findIndex(l => /^\s*VPS_URL\s*=/.test(l));
const envVal = ei >= 0 ? envLines[ei].replace(/^\s*VPS_URL\s*=/, '').trim().replace(/^(['"])(.*)\1$/, '$2') : '';
if (envVal) {
  out.push('.env: VPS_URL đã có giá trị (giữ nguyên .env)');
} else if (cfgDefault) {
  const line = 'VPS_URL=' + cfgDefault;
  if (ei >= 0) { envLines[ei] = line; out.push('.env: VPS_URL đang TRỐNG → đã điền mặc định từ config.js'); }
  else { if (envLines.length && envLines[envLines.length - 1] !== '') envLines.push(''); envLines.splice(envLines.length - 1, 0, line); out.push('.env: đã THÊM VPS_URL (chép mặc định từ config.js)'); }
} else {
  out.push('.env: không có VPS_URL và config.js cũng không có mặc định → bỏ qua');
}
if (cfgDefault) {
  C[vi] = m[1] + "''" + m[4] + "  // v-ttl-vps 05/09/2026: địa chỉ VPS CHỈ ở .env (không để trong code)";
  out.push("config.js: VPS_URL mặc định → '' (địa chỉ đã dời sang .env)");
} else out.push("config.js: VPS_URL mặc định đã là '' (giữ nguyên)");

/* ---- (2b) SCANNED_TTL_DAYS trong .env = 3 ---- */
const ti = envLines.findIndex(l => /^\s*SCANNED_TTL_DAYS\s*=/.test(l));
if (ti >= 0) { const old = envLines[ti].split('=').slice(1).join('=').trim(); envLines[ti] = 'SCANNED_TTL_DAYS=' + TTL_DAYS; out.push('.env: SCANNED_TTL_DAYS ' + (old || '(trống)') + ' → ' + TTL_DAYS); }
else { if (envLines.length && envLines[envLines.length - 1] !== '') envLines.push(''); envLines.splice(envLines.length - 1, 0, 'SCANNED_TTL_DAYS=' + TTL_DAYS); out.push('.env: đã THÊM SCANNED_TTL_DAYS=' + TTL_DAYS); }

/* ---- ghi ---- */
let envOut = envLines.join('\n'); if (!envOut.endsWith('\n')) envOut += '\n';
fs.writeFileSync(CFG_F, C.join('\n'));
fs.writeFileSync(ENV_F, envOut, { mode: 0o600 });
out.forEach(l => console.log('  ' + l));
console.log('PATCH OK (lib/config.js + .env)');
EOF

cat > _ss22_src.mjs <<'EOF'
/* LỆNH #22 (e) — TẮT các nguồn quét bằng NICK (có authAccountId) đang bật.
   Lý do: đường quét nick chết (thiếu cookie + BROWSER_SVC_URL chưa cấu hình) → mỗi lượt +5 scrapeErrors vô ích.
   Fail-closed: số nguồn nick đang bật phải ĐÚNG 5 (như bySource 120/120 lượt) mới ghi; khác 5 → không ghi (trừ khi --force). */
import admin from 'firebase-admin';
if (!admin.apps.length) admin.initializeApp();
const db = admin.firestore(); const FV = admin.firestore.FieldValue;
const EXPECT = 5, force = process.argv.includes('--force');
const snap = await db.collection('sources').get();
const all = snap.docs.map(d => ({ id: d.id, ...d.data() }));
const isOn = s => s.active !== false;
const nick = all.filter(s => s.authAccountId);
const on = nick.filter(isOn);
console.log('sources:', all.length, '| đang bật:', all.filter(isOn).length, '| nguồn nick:', nick.length, '| nick đang bật:', on.length);
on.forEach(s => console.log('  SẼ TẮT →', s.id, '|', s.name || '(không tên)', '| brand', s.brand || '-', '| nick', s.authAccountId));
nick.filter(s => !isOn(s)).forEach(s => console.log('  (đã tắt sẵn)', s.id, '|', s.name || ''));
if (!on.length) { console.log('Không có nguồn nick nào đang bật — không ghi gì (có thể đã tắt ở lần chạy trước).'); process.exit(0); }
if (on.length !== EXPECT && !force) { console.log('SỐ NGUỒN NICK ĐANG BẬT = ' + on.length + ' ≠ ' + EXPECT + ' → KHÔNG GHI. Gửi em output này (muốn ép: node _ss22_src.mjs --force).'); process.exit(3); }
const b = db.batch();
on.forEach(s => b.set(db.collection('sources').doc(s.id), { active: false, disabledAt: FV.serverTimestamp(), disabledReason: 'LỆNH #22 05/09/2026: nguồn quét bằng nick chưa có cookie/BROWSER_SVC_URL — tắt cho hết scrapeErrors' }, { merge: true }));
await b.commit();
const after = await db.collection('sources').get();
let act = 0, nickOn = 0; after.forEach(d => { const s = d.data(); if (isOn(s)) { act++; if (s.authAccountId) nickOn++; } });
console.log('ĐÃ TẮT', on.length, 'nguồn. SAU KHI TẮT: đang bật', act, '| nick đang bật', nickOn, '(kỳ vọng', (all.filter(isOn).length - on.length) + ' | 0)');
EOF

cat > /tmp/ss22_run.sh <<'EOF'
# LỆNH #22 — chạy bằng `bash /tmp/ss22_run.sh` (KHÔNG dán từng dòng): shell tương tác của Cloud Shell làm history expansion ký tự `!` → vỡ lệnh (bài học lần chạy 1).
cd ~/firebase-s13/functions || exit 1
echo "=== (a) backup config.js + .env ==="
if grep -q 'v-ttl-vps' lib/config.js; then
  echo "config.js đã có marker v-ttl-vps (patch từ lần chạy trước) → GIỮ backup cũ, không backup đè:"; ls -1 lib/config.js.bak-* .env.bak-* 2>/dev/null | tail -4
else
  TS=$(date +%Y%m%d-%H%M%S); cp lib/config.js "lib/config.js.bak-$TS" && cp .env ".env.bak-$TS" && chmod 600 ".env.bak-$TS" && ls -1 "lib/config.js.bak-$TS" ".env.bak-$TS" || exit 1
fi
echo "=== (b) patch lib/config.js + .env (idempotent) ===" \
 && node /tmp/ss22.cjs && node --check lib/config.js && echo "SYNTAX OK lib/config.js" \
 && echo "--- config.js (đã che IP) ---" && grep -n "SCANNED_TTL_DAYS\|VPS_URL" lib/config.js | sed -E 's#[0-9]{1,3}(\.[0-9]{1,3}){3}#<IP>#g' \
 && echo "--- .env (chỉ tên/số) ---" && echo ".env dòng VPS_URL: $(grep -c '^VPS_URL=' .env) (kỳ vọng 1)" && grep '^SCANNED_TTL_DAYS=' .env \
 && echo "=== (c) import test với .env ===" \
 && ( set -a; . ./.env; set +a; node --input-type=module -e "const {CFG}=await import('./lib/config.js'); console.log('CFG.SCANNED_TTL_DAYS =',CFG.SCANNED_TTL_DAYS,'(kỳ vọng 3) | VPS_URL đã đặt =',Boolean(CFG.VPS_URL),'| dài',String(CFG.VPS_URL).length,'ký tự | FULLSWEEP_HOURS =',CFG.FULLSWEEP_HOURS)" ) \
 && echo "=== (d) nơi dùng VPS_URL trong code (đã che IP) ===" \
 && ( grep -rn "VPS_URL" --include=*.js --include=*.mjs --include=*.cjs . 2>/dev/null | grep -v node_modules | grep -v "\.bak-" | sed -E 's#[0-9]{1,3}(\.[0-9]{1,3}){3}#<IP>#g' || echo "(không thấy chỗ nào khác dùng VPS_URL)" ) \
 && echo "=== (e) tắt 5 nguồn nick ===" \
 && node _ss22_src.mjs && rm -f _ss22_src.mjs \
 && echo "=== (f) deploy scheduledScan + manualScan (nhận .env mới + TTL) ===" \
 && firebase deploy --only functions:scheduledScan,functions:manualScan \
 && echo "=== (g) kiểm env trên Cloud Run (chỉ tên + độ dài, không in giá trị VPS) ===" \
 && for svc in scheduledscan manualscan; do gcloud run services describe $svc --region asia-southeast1 --format=json | node -e "let s='';process.stdin.on('data',d=>s+=d).on('end',()=>{const j=JSON.parse(s);const e=(j.spec.template.spec.containers[0].env||[]);const f=e.filter(x=>/^(SCANNED_TTL_DAYS|VPS_URL|SCAN_SOURCE_INTERVAL_MIN|BD_SOW_MODE)$/.test(x.name)).map(x=>x.name+'='+(x.name==='VPS_URL'?(x.value?'(đã đặt, '+x.value.length+' ký tự)':'(TRỐNG)'):x.value));console.log('$svc:',j.status.latestReadyRevisionName,'|',f.join(' | ')||'(không thấy biến nào)')})"; done \
 && rm -f /tmp/ss22.cjs /tmp/ss22_run.sh \
 && echo "=== XONG LỆNH #22 — chờ ≥6 phút rồi chạy KHỐI 2 ==="
EOF

bash /tmp/ss22_run.sh; echo "exit=$?"
```

**Kỳ vọng output**: (a) "đã có marker v-ttl-vps → GIỮ backup cũ" + tên 2 backup `…034109`; (b) `PATCH OK` với 4 dòng "đã có/giữ nguyên"; (c) `CFG.SCANNED_TTL_DAYS = 3 | VPS_URL đã đặt = true`; (d) danh sách file/dòng dùng `VPS_URL` (chỗ dùng nằm ngoài dump — em cần để map); (e) `nick đang bật: 5` + 5 dòng `SẼ TẮT` + `ĐÃ TẮT 5 nguồn … đang bật 23 | nick đang bật 0`; (f) 2 function `Successful update operation`; (g) mỗi service in `SCANNED_TTL_DAYS=3 | VPS_URL=(đã đặt, N ký tự)`; cuối cùng `exit=0`.

Nếu (e) in `SỐ NGUỒN NICK ĐANG BẬT = N ≠ 5 → KHÔNG GHI` thì script DỪNG trước deploy (`exit=3`) — gửi em output, em xem danh sách rồi quyết (không ép `--force` khi chưa rõ).

## KHỐI 2 — kiểm sau ≥6 phút (chỉ đọc)

```bash
cd ~/firebase-s13/functions || exit 1
cat > _ss22_after.mjs <<'EOF'
/* LỆNH #22 — KIỂM SAU ≥6 PHÚT (chỉ đọc): 4 lượt quét gần nhất phải có sourcesCount 23 · scrapeErr 0 · authRuns 0. */
import admin from 'firebase-admin';
if (!admin.apps.length) admin.initializeApp();
const db = admin.firestore();
const toMs = v => v && v.toMillis ? v.toMillis() : (v && v._seconds ? v._seconds * 1000 : (typeof v === 'number' ? v : 0));
const vn = ms => new Date(ms + 7 * 3600e3).toISOString().slice(5, 19).replace('T', ' ');
const sc = await db.collection('scans').orderBy('at', 'desc').limit(4).get();
sc.forEach(d => { const s = d.data(); console.log(vn(toMs(s.at)), '| trigger', s.trigger, '| dur', Math.round((s.durationMs || 0) / 1000) + 's', '| nguồn', s.sourcesCount, '| scrapeErr', s.scrapeErrors, '| authRuns', s.authRuns, '| bài', s.postsFetched, '| bd', s.bdRecords, '| lead', s.leadsCreated); });
const src = await db.collection('sources').get(); let a = 0, n = 0; src.forEach(d => { const s = d.data(); if (s.active !== false) { a++; if (s.authAccountId) n++; } });
console.log('sources đang bật:', a, '| nick đang bật:', n, '(kỳ vọng 23 | 0)');
const ss = await db.doc('system_status/brightdata').get(); console.log('system_status/brightdata:', ss.exists ? JSON.stringify({ ok: ss.data().ok, runs: ss.data().runs }) : '(chưa có)');
EOF
node _ss22_after.mjs; rm -f _ss22_after.mjs
```

**Kỳ vọng**: 4 lượt gần nhất (sau deploy) có `nguồn 23 | scrapeErr 0 | authRuns 0`; `sources đang bật: 23 | nick đang bật: 0`; `system_status/brightdata: {"ok":true}`. Lượt ngay sau deploy có thể vẫn `nguồn 28` nếu nó bắt đầu trước khi tắt nguồn — nhìn 2–3 lượt sau.

## Ghi chú kỹ thuật
- **TTL**: `index.js` dòng ~270 `TTL_MS = max(0, CFG.SCANNED_TTL_DAYS || 1) ngày` → từ nay 3 ngày cho `scanned_posts` KHÔNG thành lead (bài thành lead `expireAt:null`, giữ mãi). `cleanupScannedPosts` (hằng ngày, `where expireAt <= now`) tự dọn. Doc cũ giữ `expireAt` cũ (1 ngày) — không backfill. Dedupe bài đã quét là collection `seen` (vĩnh viễn) — TTL KHÔNG ảnh hưởng chấm điểm lại/lead trùng.
- **VPS_URL**: các function KHÁC (không deploy trong LỆNH này) vẫn chạy code cũ có mặc định trong config.js → không đổi hành vi; tới lần deploy kế của chúng sẽ nhận `.env` `VPS_URL` (đã có sẵn từ LỆNH này). Firebase CLI nạp `.env` cho MỌI function lúc deploy.
- **Tắt nguồn**: ghi `active:false` + `disabledAt` + `disabledReason` (merge) vào `sources/{id}` — web (Cấu hình → Nguồn quét) hiện "tạm dừng" như bật/tắt tay; muốn bật lại thì gạt công tắc trên web (chỉ có ích khi đã cấp cookie nick + cấu hình `BROWSER_SVC_URL`).
- `.env.bak-<TS>` chứa secret — nằm trong Cloud Shell của anh như `.env`, không gửi đi đâu.
- **Bài học shell**: bash tương tác history-expand `!` trên dòng lệnh (cả trong `"…"`, cả dòng nối `\`), KHÔNG expand trong heredoc `<<'EOF'`. Chuỗi lệnh dài → file `.sh` + `bash`. Dry-run cục bộ bằng `bash file` KHÔNG bắt được lỗi này (non-interactive) → thêm bước `grep '!'` ngoài heredoc trước khi gửi.

## ★ KẾT QUẢ KHỐI 1 bản 2 (05/09 03:5x VN) — THÀNH CÔNG, `exit=0`
- (a) giữ backup gốc (`lib/config.js.bak-20260905-034109` + `.env.bak-20260905-034109`); (b) idempotent đúng ("đã có/giữ nguyên"); (c) `CFG.SCANNED_TTL_DAYS = 3 | VPS_URL đã đặt = true | dài 24 ký tự`.
- (d) nơi dùng `VPS_URL`: `lib/config.js:59` (đã rỗng) và **`lib/autoSend.js:81` `var VPS_URL = process.env.VPS_URL || "http://<IP>:8080"`** + `:99 fetch(VPS_URL + "/comment")` → còn 1 chỗ hard-code IP → **LỆNH #22c** bên dưới.
- (e) `sources: 32 | đang bật: 28 | nguồn nick: 5 | nick đang bật: 5` → tắt đúng 5 (neu1 · bk-1 · nguyên căn 1 · hhqcvain1 · Tm S Con Sen — đều brand `test-agency`, nick `acc_Nick_A_*`) → `đang bật 23 | nick đang bật 0`.
- (f) deploy `manualScan` + `scheduledScan` Successful (cảnh báo `GOOGLE_CLOUD_QUOTA_PROJECT is not usable…` là warning quen của Firebase CLI trong Cloud Shell, vô hại). (g) `scheduledscan-00067-but` + `manualscan-00072-qim`: `SCANNED_TTL_DAYS=3 | VPS_URL=(đã đặt, 24 ký tự)`.

## LỆNH #22c — dời nốt IP mặc định trong `lib/autoSend.js` (chạy sau KHỐI 2, KHÔNG deploy)

```bash
cd ~/firebase-s13/functions || exit 1
cat > /tmp/ss22c.cjs <<'EOF'
/* LỆNH #22c (05/09/2026) — dời nốt địa chỉ VPS mặc định trong lib/autoSend.js (dòng ~81, lộ ra ở bước (d) LỆNH #22) sang .env.
   Fail-closed: .env phải có VPS_URL khác rỗng mới gỡ mặc định. Idempotent (marker v-ttl-vps). KHÔNG in giá trị. */
const fs = require('fs');
const F = 'lib/autoSend.js';
if (!fs.existsSync(F)) { console.log('KHONG CO ' + F + ' — bo qua'); process.exit(0); }
const envL = (fs.existsSync('.env') ? fs.readFileSync('.env', 'utf8') : '').split('\n').find(l => /^\s*VPS_URL\s*=/.test(l));
const envVal = envL ? envL.replace(/^\s*VPS_URL\s*=/, '').trim().replace(/^(['"])(.*)\1$/, '$2') : '';
if (!envVal) { console.log('.env CHUA CO VPS_URL (hoặc trống) → KHONG GHI GI (fail-closed)'); process.exit(3); }
const L = fs.readFileSync(F, 'utf8').split('\n');
if (L.some(l => l.includes('v-ttl-vps'))) { console.log('autoSend.js: đã có marker v-ttl-vps (patch trước đó) → giữ nguyên'); process.exit(0); }
const i = L.findIndex(l => /^\s*(var|let|const)\s+VPS_URL\s*=\s*process\.env\.VPS_URL\s*\|\|/.test(l));
if (i < 0) { console.log('KHONG THAY MOC "VPS_URL = process.env.VPS_URL ||" trong ' + F + ' — KHONG GHI GI'); process.exit(2); }
const m = L[i].match(/^(\s*(?:var|let|const)\s+VPS_URL\s*=\s*process\.env\.VPS_URL\s*\|\|\s*)(['"])(.*?)\2(\s*;?)(.*)$/);
if (!m) { console.log('DONG KHONG DUNG DANG (đã che IP): ' + L[i].replace(/\d{1,3}(\.\d{1,3}){3}/g, '<IP>')); process.exit(2); }
const TS = new Date().toISOString().replace(/[-:T]/g, '').slice(0, 15).replace(/(\d{8})(\d{6})/, '$1-$2');
fs.copyFileSync(F, F + '.bak-' + TS);
L[i] = m[1] + '""' + m[4] + '  // v-ttl-vps 05/09/2026: địa chỉ VPS CHỈ ở .env (không để trong code)';
fs.writeFileSync(F, L.join('\n'));
console.log('backup: ' + F + '.bak-' + TS);
console.log('PATCH OK ' + F + ' dòng ' + (i + 1) + ': mặc định → "" (địa chỉ đã có trong .env, ' + envVal.length + ' ký tự)');
EOF
cat > /tmp/ss22c_run.sh <<'EOF'
# LỆNH #22c — chạy bằng `bash /tmp/ss22c_run.sh` (không dán từng dòng — tránh history expansion).
cd ~/firebase-s13/functions || exit 1
echo "=== (a) patch lib/autoSend.js (mặc định VPS_URL → rỗng) ===" \
 && node /tmp/ss22c.cjs && node --check lib/autoSend.js && echo "SYNTAX OK lib/autoSend.js" \
 && echo "=== (b) dòng VPS_URL trong autoSend.js sau patch (đã che IP) ===" \
 && grep -n "VPS_URL" lib/autoSend.js | sed -E 's#[0-9]{1,3}(\.[0-9]{1,3}){3}#<IP>#g' \
 && echo "=== (c) file nào import lib/autoSend.js (để biết function nào mang nó) ===" \
 && ( grep -rln "autoSend" --include=*.js --include=*.mjs . 2>/dev/null | grep -v node_modules | grep -v "\.bak-" || echo "(không file nào)" ) \
 && echo "=== (d) rà mọi IPv4 literal còn trong code (đã che, tối đa 20 dòng) ===" \
 && ( grep -rnE "[0-9]{1,3}(\.[0-9]{1,3}){3}" --include=*.js --include=*.mjs --include=*.cjs . 2>/dev/null | grep -v node_modules | grep -v "\.bak-" | sed -E 's#[0-9]{1,3}(\.[0-9]{1,3}){3}#<IP>#g' | head -20 || true ) \
 && echo "=== XONG #22c (KHÔNG deploy — function dùng autoSend.js sẽ nhận .env VPS_URL ở lần deploy kế) ===" \
 && rm -f /tmp/ss22c.cjs /tmp/ss22c_run.sh
EOF
bash /tmp/ss22c_run.sh; echo "exit=$?"
```

**Kỳ vọng**: `PATCH OK lib/autoSend.js dòng 81: mặc định → ""` + `SYNTAX OK`; (b) 2 dòng VPS_URL không còn IP; (c) danh sách file import autoSend.js (em cần để biết function nào mang nó); (d) các IPv4 literal còn lại trong code (đã che) — kỳ vọng còn rất ít hoặc 0. Không deploy: function đang chạy giữ code cũ (vẫn có mặc định) → không đổi hành vi; lần deploy kế của function dùng autoSend.js sẽ đọc `.env` (đã có `VPS_URL`). Fail-closed: `.env` thiếu `VPS_URL` → không ghi (`exit=3`).

## ★ KẾT QUẢ KHỐI 2 + #22c (05/09 ~11:00 VN; LƯU Ý: timestamp backup Cloud Shell là giờ UTC = VN − 7h)
- **KHỐI 2**: 2 lượt trước khi tắt nguồn (10:46/10:49 VN) còn `nguồn 28 | scrapeErr 5 | authRuns 5`; **2 lượt sau deploy: 10:52 `nguồn 23 | scrapeErr 0 | authRuns 0` (5 s, lượt gieo/skip) · 10:56 `nguồn 23 | scrapeErr 0 | authRuns 0 | bài 24 | bd 24` (74 s, lượt gặt)**. `sources đang bật: 23 | nick đang bật: 0`. `system_status/brightdata {ok:true, runs:0}`. ⇒ **hết hẳn 5 scrapeErrors cố định, hệ quét chạy đúng sau LỆNH #22.**
- **#22c**: `PATCH OK lib/autoSend.js dòng 81: mặc định → ""` + `SYNTAX OK`; backup `lib/autoSend.js.bak-20260905-035825`; (c) **KHÔNG file nào import `lib/autoSend.js`** (chỉ chính nó khớp) → module mồ côi trong s13 (cụm auto-send thật nằm ở `~/codebase2`) → không function nào bị ảnh hưởng. (d) rà IPv4 literal: **còn đúng 1 chỗ `lib/approveEngagement.js:7` `const SVC=()=>process.env.BROWSER_SVC_URL||'http://<IP>:8080'`** → LỆNH #22d.

## LỆNH #22d — dời IP mặc định CUỐI CÙNG (`lib/approveEngagement.js:7`, KHÔNG deploy)

> `approveEngagement` là function ĐANG chạy từ s13 → không deploy lại trong LỆNH này (function giữ code cũ có mặc định, hành vi không đổi). Script chép mặc định vào `.env` (`BROWSER_SVC_URL=…`) nếu `.env` chưa có/trống, RỒI mới đổi mặc định trong code thành `''` → lần deploy kế đọc `.env`. Sau #22d, code s13 không còn IPv4 literal nào.

```bash
cd ~/firebase-s13/functions || exit 1
cat > /tmp/ss22d.cjs <<'EOF'
/* LỆNH #22d (05/09/2026) — dời IP mặc định CUỐI CÙNG: lib/approveEngagement.js dòng ~7 `process.env.BROWSER_SVC_URL||'http://<IP>:8080'`.
   Cách làm như VPS_URL: chép mặc định vào .env (BROWSER_SVC_URL=…) nếu .env chưa có/trống → rồi đổi mặc định trong code thành ''. Idempotent (marker v-ttl-vps). KHÔNG in giá trị. */
const fs = require('fs');
const F = 'lib/approveEngagement.js', ENV_F = '.env';
if (!fs.existsSync(F)) { console.log('KHONG CO ' + F + ' — bo qua'); process.exit(0); }
const L = fs.readFileSync(F, 'utf8').split('\n');
if (L.some(l => l.includes('v-ttl-vps'))) { console.log(F + ': đã có marker v-ttl-vps → giữ nguyên'); process.exit(0); }
const i = L.findIndex(l => /process\.env\.BROWSER_SVC_URL\s*\|\|\s*['"]/.test(l));
if (i < 0) { console.log('KHONG THAY MOC process.env.BROWSER_SVC_URL||\'…\' trong ' + F + ' — KHONG GHI GI'); process.exit(2); }
const m = L[i].match(/^(.*process\.env\.BROWSER_SVC_URL\s*\|\|\s*)(['"])(.*?)\2(.*)$/);
if (!m) { console.log('DONG KHONG DUNG DANG (đã che IP): ' + L[i].replace(/\d{1,3}(\.\d{1,3}){3}/g, '<IP>')); process.exit(2); }
const def = m[3];
let envLines = (fs.existsSync(ENV_F) ? fs.readFileSync(ENV_F, 'utf8') : '').split('\n');
const ei = envLines.findIndex(l => /^\s*BROWSER_SVC_URL\s*=/.test(l));
const envVal = ei >= 0 ? envLines[ei].replace(/^\s*BROWSER_SVC_URL\s*=/, '').trim().replace(/^(['"])(.*)\1$/, '$2') : '';
const out = [];
if (envVal) out.push('.env: BROWSER_SVC_URL đã có giá trị (giữ nguyên .env, ' + envVal.length + ' ký tự)');
else if (def) {
  const line = 'BROWSER_SVC_URL=' + def;
  if (ei >= 0) { envLines[ei] = line; out.push('.env: BROWSER_SVC_URL đang TRỐNG → đã điền mặc định từ code'); }
  else { if (envLines.length && envLines[envLines.length - 1] !== '') envLines.push(''); envLines.splice(envLines.length - 1, 0, line); out.push('.env: đã THÊM BROWSER_SVC_URL (chép mặc định từ code, ' + def.length + ' ký tự)'); }
} else { console.log('Mặc định trong code rỗng và .env cũng không có → không có gì để dời'); process.exit(0); }
const TS = new Date().toISOString().replace(/[-:T]/g, '').slice(0, 15).replace(/(\d{8})(\d{6})/, '$1-$2');
fs.copyFileSync(F, F + '.bak-' + TS);
L[i] = m[1] + "''" + m[4] + '  // v-ttl-vps 05/09/2026: địa chỉ dịch vụ trình duyệt CHỈ ở .env (không để trong code)';
let envOut = envLines.join('\n'); if (!envOut.endsWith('\n')) envOut += '\n';
fs.writeFileSync(ENV_F, envOut, { mode: 0o600 });
fs.writeFileSync(F, L.join('\n'));
out.forEach(l => console.log('  ' + l));
console.log('backup: ' + F + '.bak-' + TS);
console.log('PATCH OK ' + F + ' dòng ' + (i + 1) + ": mặc định → '' (địa chỉ đã ở .env)");
EOF
cat > /tmp/ss22d_run.sh <<'EOF'
# LỆNH #22d — chạy bằng `bash /tmp/ss22d_run.sh` (không dán từng dòng — tránh history expansion).
cd ~/firebase-s13/functions || exit 1
echo "=== (a) patch lib/approveEngagement.js + .env ===" \
 && node /tmp/ss22d.cjs && node --check lib/approveEngagement.js && echo "SYNTAX OK lib/approveEngagement.js" \
 && echo "=== (b) dòng BROWSER_SVC_URL sau patch (đã che IP) ===" \
 && grep -n "BROWSER_SVC_URL" lib/approveEngagement.js | sed -E 's#[0-9]{1,3}(\.[0-9]{1,3}){3}#<IP>#g' \
 && echo ".env dòng BROWSER_SVC_URL: $(grep -c '^BROWSER_SVC_URL=' .env) (kỳ vọng 1)" \
 && echo "=== (c) file nào import lib/approveEngagement.js ===" \
 && ( grep -rln "approveEngagement" --include=*.js --include=*.mjs . 2>/dev/null | grep -v node_modules | grep -v "\.bak-" || echo "(không file nào)" ) \
 && echo "=== (d) rà lại IPv4 literal trong code (kỳ vọng: 0 dòng) ===" \
 && ( grep -rnE "[0-9]{1,3}(\.[0-9]{1,3}){3}" --include=*.js --include=*.mjs --include=*.cjs . 2>/dev/null | grep -v node_modules | grep -v "\.bak-" | sed -E 's#[0-9]{1,3}(\.[0-9]{1,3}){3}#<IP>#g' | head -20; echo "(hết)" ) \
 && echo "=== XONG #22d (KHÔNG deploy — approveEngagement đang chạy giữ code cũ; lần deploy kế đọc .env) ===" \
 && rm -f /tmp/ss22d.cjs /tmp/ss22d_run.sh
EOF
bash /tmp/ss22d_run.sh; echo "exit=$?"
```

**Kỳ vọng**: `.env: đã THÊM BROWSER_SVC_URL (chép mặc định từ code, 24 ký tự)` (hoặc "đã có giá trị (giữ nguyên)" nếu `.env` sẵn có) + `PATCH OK … dòng 7` + `SYNTAX OK`; (b) dòng 7 không còn IP, `.env dòng BROWSER_SVC_URL: 1`; (c) file import approveEngagement.js (kỳ vọng `index.js`); (d) `(hết)` ngay, không dòng IP nào; `exit=0`.

**Tuỳ chọn về sau**: nếu bật lại đường quét nick (`fetchPostsAuth`), thêm `BROWSER_SVC_URL`/`BROWSER_SVC_SECRET` vào `lib/config.js` (`env.BROWSER_SVC_URL || ''`) — hiện config.js không map nên `fetchPostsAuth` luôn báo "Chưa cấu hình"; 5 nguồn nick đã tắt nên không ảnh hưởng.
