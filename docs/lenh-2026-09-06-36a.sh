#!/bin/bash
# LỆNH #36 KHỐI 1 (06/09/2026) — vá push.js (a) + stats.js content_stats (h) + Rules content_stats + deploy + đếm lại content_stats. Fail-closed từng bước, backup .bak-<TS>, idempotent.
set -o pipefail
cd ~/firebase-s13/functions || { echo 'KHONG VAO DUOC ~/firebase-s13/functions'; exit 1; }
TS=$(date +%Y%m%d-%H%M%S); echo "backup TS=$TS (giờ UTC của Cloud Shell)"
cat > _l36_push.cjs <<'EOF_PUSH'
/* LỆNH #36 (a) = LỆNH #16 (a) 04/09: push.js — thông báo "khách phản hồi" ĐỨNG LẠI tới khi bấm (require:'1') + nút "Mở lead"; hẹn chăm + nút "Mở việc".
   FE v119-48 (sw.js/90-boot) đã đọc require/actionTitle. Regex khoan dung (LỆNH #12 có thể đã đổi phần trước trong dòng), idempotent, fail-closed. */
const fs = require('fs'); const F = process.argv[2] || 'push.js'; let s = fs.readFileSync(F, 'utf8'); let n = 0;
if (!/require: '1'/.test(s)) { const r = /tag: 'reply-' \+ id \}/; if (!r.test(s)) { console.error("KHONG THAY MOC reply (tag: 'reply-' + id }). Dòng hiện có:\n" + (s.split('\n').filter(l => l.includes("'reply-'")).join('\n') || '(không có)')); process.exit(1); } s = s.replace(r, () => "tag: 'reply-' + id, require: '1', actionTitle: 'Mở lead' }"); n++; } else console.log('push.js: reply đã có require/actionTitle (idempotent)');
if (!/actionTitle: 'Mở việc'/.test(s)) { const r = /tag: 'fu-' \+ d\.id \}/; if (!r.test(s)) { console.error("KHONG THAY MOC hẹn chăm (tag: 'fu-' + d.id }). Dòng hiện có:\n" + (s.split('\n').filter(l => l.includes("'fu-'")).join('\n') || '(không có)')); process.exit(1); } s = s.replace(r, () => "tag: 'fu-' + d.id, actionTitle: 'Mở việc' }"); n++; } else console.log('push.js: hẹn chăm đã có actionTitle (idempotent)');
if (n) fs.writeFileSync(F, s); console.log('PATCH push.js n=' + n + ' (2 = mới vá đủ, 0 = đã vá trước)');
EOF_PUSH
cat > _l36_stats.cjs <<'EOF_STATS'
/* LỆNH #36 (06/09/2026) — stats.js: + counter HIỆU QUẢ NỘI DUNG `content_stats/{brand}` (card "📈 Hiệu quả nội dung" ở Content Studio chính xác mọi quy mô,
   không phụ thuộc cửa sổ lead đã nạp trên máy). Nguồn: dấu vết `leads.outreach.content` (meta do genForLead/LỆNH #34 đóng dấu, worker 2026-09-06c ghi) +
   `outreach.inbox_at` + phản hồi (outreach_replied / outreach.replied_at / stage responded|booked|closed). Cùng trigger statsOnLead (onDocumentWritten leads/{id}).
   Patch content-anchored, fail-closed (thiếu mốc → không ghi), idempotent (marker LENH #36). Dùng: node _l36_stats.cjs [stats.js] */
const fs = require('fs'); const F = process.argv[2] || 'stats.js'; let s = fs.readFileSync(F, 'utf8');
if (s.includes('LENH #36')) { console.log('stats.js: ĐÃ patch (idempotent) — bỏ qua'); process.exit(0); }
const A1 = "const RESP = new Set(['responded', 'booked', 'closed']), BOOK = new Set(['booked', 'closed']);";
const A2 = "  const evs = statsEvents(before, after, Date.now()); if (!evs.length) return;";
const A3 = "    return db.collection('daily_stats').doc(brand + '__' + day).set(patch, { merge: true }); }));";
for (const [i, a] of [A1, A2, A3].entries()) { const n = s.split(a).length - 1; if (n !== 1) { console.error('KHONG THAY MOC A' + (i + 1) + ' (đếm ' + n + '): ' + a.slice(0, 80)); process.exit(1); } }
const helpers = A1 + `
/* LENH #36 (06/09/2026) — HIỆU QUẢ NỘI DUNG: counter cộng dồn content_stats/{brand} = { brandCode, atMs, all:{sent,rep,tagged}, <dim>:{<khoá>:{sent,rep}} }
   dim = mode/style/parent/cta/variant (khớp CS_META_VI ở FE 45-outreach). Khoá làm sạch: variant → v0..v5 (vx = -1/không xoay), rỗng → none, ký tự lạ → _.
   sent = lead có outreach.inbox_at (đếm lần đầu xuất hiện) · rep = lead ĐÃ inbox rồi có phản hồi (đếm 1 lần) · tagged = lead có content meta (lần đầu).
   Hàm thuần (không I/O) → backfill (_cs_backfill.mjs, before=null) dùng chung. FE: csEffFromCounters đổi ngược khoá → nhãn. */
const C_DIMS = ['mode', 'style', 'parent', 'cta', 'variant'];
export const contentKey = (dim, v) => { if (dim === 'variant') { const n = Number(v); return Number.isFinite(n) && n >= 0 ? 'v' + Math.min(9, Math.floor(n)) : 'vx'; } const k = String(v == null ? '' : v).replace(/[^A-Za-z0-9_-]/g, '_').slice(0, 24); return k || 'none'; };
const isRep = l => !!(l && (l.outreach_replied || (l.outreach && l.outreach.replied_at) || RESP.has(String(l.stage || ''))));
export function contentEvents(before, after) {
  const b = before || {}; const ao = (after && after.outreach) || {}; const bo = b.outreach || {};
  const meta = ao.content; if (!meta || typeof meta !== 'object' || Array.isArray(meta)) return null;
  const inc = {};
  if (!(bo.content && typeof bo.content === 'object' && !Array.isArray(bo.content))) inc.tagged = 1;
  const sentNow = !!ao.inbox_at, sentBefore = !!bo.inbox_at;
  if (sentNow && !sentBefore) inc.sent = 1;
  if (sentNow && isRep(after) && !(sentBefore && isRep(b))) inc.rep = 1;
  return Object.keys(inc).length ? { inc, meta } : null;
}
export function contentPatch(brand, ev) {
  const p = { brandCode: brand, atMs: Date.now(), all: {} };
  Object.keys(ev.inc).forEach(k => { p.all[k] = FieldValue.increment(ev.inc[k]); });
  C_DIMS.forEach(d => { const o = {}; ['sent', 'rep'].forEach(f => { if (ev.inc[f]) o[f] = FieldValue.increment(ev.inc[f]); }); if (Object.keys(o).length) p[d] = { [contentKey(d, ev.meta[d])]: o }; });
  return p;
}`;
s = s.replace(A1, () => helpers);
s = s.replace(A2, () => "  const evs = statsEvents(before, after, Date.now()); const cev = contentEvents(before, after); if (!evs.length && !cev) return; // LENH #36: + hiệu quả nội dung");
s = s.replace(A3, () => A3 + "\n  if (cev) await db.collection('content_stats').doc(brand).set(contentPatch(brand, cev), { merge: true }); // LENH #36: set-merge + increment lồng → an toàn ghi đồng thời");
fs.writeFileSync(F, s); console.log('PATCH OK stats.js (LENH #36: contentKey/contentEvents/contentPatch + content_stats)');
EOF_STATS
cat > _l36_rules.cjs <<'EOF_RULES'
/* LỆNH #36 — Rules: match /content_stats/{id} = bản sao block outreach_stats (super đọc hết / brand user đọc brandCode == brand mình, write false — CF ghi bằng Admin SDK).
   Chạy trong ~/firebase-s13 (nơi có firestore.rules). Idempotent, fail-closed (không thấy block outreach_stats → dừng). */
const fs = require('fs'); const F = 'firestore.rules'; let s = fs.readFileSync(F, 'utf8');
if (/match \/content_stats\//.test(s)) { console.log('Rules: block content_stats ĐÃ CÓ - bỏ qua'); process.exit(0); }
const m1 = s.match(/([ \t]*)match \/outreach_stats\/\{[^}]*\}\s*\{[\s\S]*?\n\1\}/);          // block nhiều dòng
const m2 = m1 ? null : s.match(/([ \t]*)match \/outreach_stats\/\{[^}]*\}\s*\{[^\n]*\}[ \t]*/); // block 1 dòng
const m = m1 || m2;
if (!m) { console.log('KHONG TIM THAY block outreach_stats trong firestore.rules - dán cho em 30 dòng quanh "outreach_stats"'); process.exit(1); }
const blk = m[0].replace(/outreach_stats/g, 'content_stats');
if (!/superadmin|isSuperAdmin\(\)/.test(blk) || !/brandCode/.test(blk)) { console.log('Block chép được KHONG đúng dạng (thiếu superadmin/brandCode) - dừng để em xem:\n' + blk); process.exit(1); }
const note = m[1] + '// LENH #36 06/09/2026: counter hiệu quả nội dung content_stats/{brand} (CF statsOnLead ghi) — cùng quyền đọc như outreach_stats';
s = s.replace(m[0], () => m[0] + '\n' + note + '\n' + blk);
fs.writeFileSync(F, s); console.log('Rules: đã chèn block content_stats:\n' + blk);
EOF_RULES
cat > _cs_backfill.mjs <<'EOF_CSBF'
/* LỆNH #36 — _cs_backfill.mjs (đặt trong ~/firebase-s13/functions): ĐẾM LẠI content_stats/{brand} từ lead có dấu vết máy (leads.outreach.at > 0), ghi ĐÈ doc
   (= đối soát; chạy lại bất cứ lúc nào). Dùng contentEvents/contentKey của stats.js (before=null) → cùng định nghĩa với trigger. */
import { initializeApp, applicationDefault, getApps } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { contentEvents, contentKey } from './stats.js';
if (!getApps().length) initializeApp({ credential: applicationDefault(), projectId: 'smartlead-z15' });
const db = getFirestore(); const DIMS = ['mode', 'style', 'parent', 'cta', 'variant'];
const snap = await db.collection('leads').where('outreach.at', '>', 0).get();
const by = {}; let withMeta = 0;
snap.forEach(d => { const l = d.data() || {}; const brand = String(l.brand || '').trim(); if (!brand) return; const ev = contentEvents(null, l); if (!ev) return; withMeta++;
  const o = by[brand] || (by[brand] = { brandCode: brand, atMs: Date.now(), all: { sent: 0, rep: 0, tagged: 0 } });
  ['sent', 'rep', 'tagged'].forEach(k => { o.all[k] += ev.inc[k] || 0; });
  if (ev.inc.sent) DIMS.forEach(dim => { const k = contentKey(dim, ev.meta[dim]); const m = o[dim] || (o[dim] = {}); const c = m[k] || (m[k] = { sent: 0, rep: 0 }); c.sent += 1; c.rep += ev.inc.rep || 0; }); });
for (const b of Object.keys(by).sort()) { await db.collection('content_stats').doc(b).set(by[b]); console.log('content_stats/' + b, '| all', JSON.stringify(by[b].all), '| mode', JSON.stringify(by[b].mode || {}), '| parent', JSON.stringify(by[b].parent || {})); }
console.log('quét', snap.size, 'lead có dấu vết máy →', withMeta, 'lead có meta nội dung → ghi', Object.keys(by).length, 'doc content_stats (ghi đè = đếm lại từ đầu; lead cũ trước worker 06c không có meta → không đếm)');
EOF_CSBF
echo "=== (a) push.js: thông báo khách phản hồi ĐỨNG LẠI + nút Mở lead / Mở việc ==="
[ -f push.js ] || { echo 'KHONG THAY push.js'; exit 1; }
cp push.js "push.js.bak-$TS" && node _l36_push.cjs push.js || { echo 'DỪNG (a): patch push.js không áp — gửi em output'; exit 1; }
node --check push.js || { echo 'DỪNG (a): push.js lỗi cú pháp — khôi phục: cp push.js.bak-'"$TS"' push.js'; exit 1; }
echo "=== (h) stats.js: + contentEvents/contentPatch → content_stats/{brand} ==="
[ -f stats.js ] || { echo 'KHONG THAY stats.js (LỆNH #17 chưa chạy?)'; exit 1; }
cp stats.js "stats.js.bak-$TS" && node _l36_stats.cjs stats.js || { echo 'DỪNG (h): patch stats.js không áp — gửi em output'; exit 1; }
node --check stats.js || { echo 'DỪNG (h): stats.js lỗi cú pháp — khôi phục: cp stats.js.bak-'"$TS"' stats.js'; exit 1; }
grep -n "LENH #36" stats.js | cut -c1-90 | head -4
echo "=== import test (bài học #10: codebase phải phân tích được) ==="
set -a; . ./.env; set +a
node --input-type=module -e "const m=await import('./index.js'); const s=await import('./stats.js'); console.log('IMPORT OK · statsOnLead =', typeof m.statsOnLead, '· pushOnLead =', typeof m.pushOnLead, '· pushDueFollowups =', typeof m.pushDueFollowups, '· contentEvents =', typeof s.contentEvents, '· contentKey(variant,3) =', s.contentKey('variant', 3), '· contentKey(parent,\"\") =', s.contentKey('parent', ''))" || { echo 'DỪNG: import lỗi — gửi em output'; exit 1; }
echo "=== Rules: match /content_stats/{id} (bản sao outreach_stats) ==="
cd ~/firebase-s13 || exit 1
cp firestore.rules "firestore.rules.bak-$TS" && node functions/_l36_rules.cjs || { echo 'DỪNG: Rules không chèn được — gửi em output'; exit 1; }
echo "=== deploy statsOnLead + pushOnLead + pushDueFollowups (asia-southeast1) ==="
firebase deploy --only functions:statsOnLead,functions:pushOnLead,functions:pushDueFollowups > /tmp/l36_deploy1.log 2>&1; tail -4 /tmp/l36_deploy1.log
grep -q "Deploy complete" /tmp/l36_deploy1.log || { echo 'DEPLOY FUNCTIONS LỖI — gửi em: grep -iE "error|warn" /tmp/l36_deploy1.log | head'; exit 1; }
echo "=== deploy Rules ==="
firebase deploy --only firestore:rules > /tmp/l36_deploy2.log 2>&1; tail -3 /tmp/l36_deploy2.log
grep -q "Deploy complete" /tmp/l36_deploy2.log || { echo 'DEPLOY RULES LỖI — gửi em: cat /tmp/l36_deploy2.log | tail -20'; exit 1; }
echo "=== kiểm describe ==="
gcloud functions describe statsOnLead --region asia-southeast1 --gen2 --format='value(state,updateTime)' 2>/dev/null || echo '(describe bỏ qua)'
echo "=== đếm lại content_stats từ lead có dấu vết máy (ghi đè) ==="
cd ~/firebase-s13/functions && node _cs_backfill.mjs || { echo 'BACKFILL content_stats LỖI — gửi em output (deploy đã xong, chỉ thiếu đối soát)'; exit 1; }
echo "KHỐI 1 XONG — exit=0"
