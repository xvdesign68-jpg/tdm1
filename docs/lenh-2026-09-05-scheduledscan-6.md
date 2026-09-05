# LỆNH #22 — 3 việc anh chốt sau sự cố scheduledScan (05/09/2026)

> **Quyết định của anh (05/09)**: (1) **TẮT** 5 nguồn quét bằng nick (neu1 · bk-1 · nguyên căn 1 · hhqcvain1 · Tm S Con Sen) — đường quét nick chết (thiếu cookie + `BROWSER_SVC_URL` chưa cấu hình) → mỗi lượt +5 `scrapeErrors` vô ích; (2) **`SCANNED_TTL_DAYS` = 3 ngày** + sửa `lib/config.js` đọc đúng từ `.env` (trước đây `.env` có nhưng config.js quên đọc → TTL "Bài đã quét" luôn 1 ngày); (3) **dời địa chỉ VPS** khỏi mặc định trong `lib/config.js` (`VPS_URL`) sang `.env` — LỆNH tự chép giá trị hiện tại vào `.env` nếu chưa có rồi mới đổi mặc định thành `''` → hành vi không đổi. **Không in địa chỉ VPS ra màn hình** (mọi grep đều che IP).
>
> Cách chạy: dán NGUYÊN KHỐI vào Cloud Shell (`~/firebase-s13/functions`). Mọi bước xích `&&` (bài học #20) — lỗi ở đâu dừng ở đó, dòng lỗi ngay trên. Idempotent: chạy lại không ghi đè lần 2. Rollback: `cp lib/config.js.bak-<TS> lib/config.js; cp .env.bak-<TS> .env` rồi deploy lại.

## KHỐI 1 — chạy ngay

```bash
cd ~/firebase-s13/functions || exit 1
echo "=== (a) backup config.js + .env ==="; TS=$(date +%Y%m%d-%H%M%S); cp lib/config.js "lib/config.js.bak-$TS" && cp .env ".env.bak-$TS" && chmod 600 ".env.bak-$TS" && ls -1 "lib/config.js.bak-$TS" ".env.bak-$TS"

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

echo "=== (b) patch lib/config.js + .env ===" \
 && node /tmp/ss22.cjs && node --check lib/config.js && echo "SYNTAX OK lib/config.js" \
 && echo "--- config.js (đã che IP) ---" && grep -n "SCANNED_TTL_DAYS\|VPS_URL" lib/config.js | sed -E 's#[0-9]{1,3}(\.[0-9]{1,3}){3}#<IP>#g' \
 && echo "--- .env (chỉ tên/số) ---" && echo ".env dòng VPS_URL: $(grep -c '^VPS_URL=' .env) (kỳ vọng 1)" && grep '^SCANNED_TTL_DAYS=' .env \
 && echo "=== (c) import test với .env ===" \
 && ( set -a; . ./.env; set +a; node --input-type=module -e "const {CFG}=await import('./lib/config.js'); console.log('CFG.SCANNED_TTL_DAYS =',CFG.SCANNED_TTL_DAYS,'(kỳ vọng 3) | VPS_URL đã đặt =',!!CFG.VPS_URL,'| dài',String(CFG.VPS_URL).length,'ký tự | FULLSWEEP_HOURS =',CFG.FULLSWEEP_HOURS)" ) \
 && echo "=== (d) nơi dùng VPS_URL trong code (đã che IP) ===" \
 && ( grep -rn "VPS_URL" --include=*.js --include=*.mjs --include=*.cjs . 2>/dev/null | grep -v node_modules | grep -v "\.bak-" | sed -E 's#[0-9]{1,3}(\.[0-9]{1,3}){3}#<IP>#g' || echo "(không thấy chỗ nào khác dùng VPS_URL)" ) \
 && echo "=== (e) tắt 5 nguồn nick ===" \
 && node _ss22_src.mjs && rm -f _ss22_src.mjs \
 && echo "=== (f) deploy scheduledScan + manualScan (nhận .env mới + TTL) ===" \
 && firebase deploy --only functions:scheduledScan,functions:manualScan \
 && echo "=== (g) kiểm env trên Cloud Run (chỉ tên + độ dài, không in giá trị VPS) ===" \
 && for svc in scheduledscan manualscan; do gcloud run services describe $svc --region asia-southeast1 --format=json | node -e "let s='';process.stdin.on('data',d=>s+=d).on('end',()=>{const j=JSON.parse(s);const e=(j.spec.template.spec.containers[0].env||[]);const f=e.filter(x=>/^(SCANNED_TTL_DAYS|VPS_URL|SCAN_SOURCE_INTERVAL_MIN|BD_SOW_MODE)$/.test(x.name)).map(x=>x.name+'='+(x.name==='VPS_URL'?(x.value?'(đã đặt, '+x.value.length+' ký tự)':'(TRỐNG!)'):x.value));console.log('$svc:',j.status.latestReadyRevisionName,'|',f.join(' | ')||'(không thấy biến nào)')})"; done \
 && rm -f /tmp/ss22.cjs \
 && echo "=== XONG LỆNH #22 — chờ ≥6 phút rồi chạy KHỐI 2 ==="
```

**Kỳ vọng output**: (b) `PATCH OK` + 4 dòng tóm tắt (config.js thêm `SCANNED_TTL_DAYS`, `.env` thêm `VPS_URL`, config.js `VPS_URL` → `''`, `.env` `SCANNED_TTL_DAYS x → 3`); (c) `CFG.SCANNED_TTL_DAYS = 3 | VPS_URL đã đặt = true`; (d) danh sách file/dòng dùng `VPS_URL` (chỉ để em biết chỗ dùng — em chưa map được vì nằm ngoài dump); (e) `nick đang bật: 5` + 5 dòng `SẼ TẮT` + `ĐÃ TẮT 5 nguồn … đang bật 23 | nick đang bật 0`; (f) 2 function `Successful update operation`; (g) mỗi service in `SCANNED_TTL_DAYS=3 | VPS_URL=(đã đặt, N ký tự) | SCAN_SOURCE_INTERVAL_MIN=… | BD_SOW_MODE=…` (hai biến sau chỉ hiện nếu anh từng đặt trong `.env`).

Nếu (e) in `SỐ NGUỒN NICK ĐANG BẬT = N ≠ 5 → KHÔNG GHI` thì lệnh DỪNG trước deploy — gửi em output, em xem danh sách rồi quyết (không ép `--force` khi chưa rõ).

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
