#!/bin/bash
# LỆNH #36 KHỐI 2 (06/09/2026) — bảo trì + chỉ đọc: (b) TTL log cũ · (c) dọn rác functions/ · (d) lead rác Lan Anh Nguyễn (chỉ liệt kê) · (e) dump stepNick · (f) LỆNH #24 worker uid/checkReplies · (g) KHỐI 4 LỆNH #31. Mỗi mục độc lập.
cd ~/firebase-s13/functions || { echo 'KHONG VAO DUOC ~/firebase-s13/functions'; exit 1; }
cat > _l36_ttl.mjs <<'EOF_TTL'
/* LỆNH #36 (b) = LỆNH #16 (b): gắn expireAt = at + 60 ngày cho outreach_log CŨ (trước bản S3 không có expireAt → TTL policy không xoá). Batch 400, chỉ đọc-ghi field expireAt. */
import { initializeApp, applicationDefault, getApps } from 'firebase-admin/app';
import { getFirestore, Timestamp } from 'firebase-admin/firestore';
if (!getApps().length) initializeApp({ credential: applicationDefault(), projectId: 'smartlead-z15' }); const db = getFirestore();
const DAY = 864e5; let scanned = 0, fixed = 0, last = null;
for (;;) {
  let q = db.collection('outreach_log').orderBy('__name__').limit(400); if (last) q = q.startAfter(last);
  const snap = await q.get(); if (snap.empty) break;
  const batch = db.batch(); let inBatch = 0;
  snap.docs.forEach(d => { scanned++; const x = d.data() || {}; if (x.expireAt) return;
    const atMs = x.at && x.at.toMillis ? x.at.toMillis() : (Number(x.at) || Date.now());
    batch.update(d.ref, { expireAt: Timestamp.fromMillis(atMs + 60 * DAY) }); inBatch++; fixed++; });
  if (inBatch) await batch.commit(); last = snap.docs[snap.docs.length - 1]; if (snap.size < 400) break;
}
console.log('outreach_log: quét', scanned, 'doc | gắn expireAt cho', fixed, 'doc cũ (log cũ hơn 60 ngày sẽ được Firestore TTL tự xoá trong ~24h)');
EOF_TTL
cat > _l36_junk.mjs <<'EOF_JUNK'
/* LỆNH #36 (d) = LỆNH #16 (d): liệt kê lead tên chứa "Lan Anh Nguyễn" (bỏ dấu, không phân biệt hoa thường). --delete = xoá thật (recursiveDelete kèm ghi chú). */
import { initializeApp, applicationDefault, getApps } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
if (!getApps().length) initializeApp({ credential: applicationDefault(), projectId: 'smartlead-z15' }); const db = getFirestore();
const fold = s => String(s || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/đ/g, 'd').replace(/Đ/g, 'D').toLowerCase();
const DEL = process.argv.includes('--delete');
const snap = await db.collection('leads').get(); const hit = snap.docs.filter(d => fold((d.data() || {}).name).includes('lan anh nguy'));
console.log('Tìm thấy', hit.length, 'lead tên chứa "Lan Anh Nguyễn" trong', snap.size, 'lead:');
for (const d of hit) { const l = d.data() || {}; const det = l.detected_at && l.detected_at.toDate ? l.detected_at.toDate().toISOString().slice(0, 16) : String(l.detected_at || '').slice(0, 16);
  console.log(' ', d.id, '|', l.name, '| brand=', l.brand, '| stage=', l.stage, '| score=', l.score, '| detected=', det, '| nguồn=', String(l.source || l.source_name || '').slice(0, 30));
  if (DEL) { await db.recursiveDelete(d.ref); console.log('    → ĐÃ XOÁ (kể cả ghi chú)'); } }
if (!DEL && hit.length) console.log('Xoá thật: node _l36_junk.mjs --delete');
EOF_JUNK
cat > _wk_check.mjs <<'EOF_WK'
/* LỆNH #36 (f) = LỆNH #24 — chỉ đọc (đặt trong ~/firebase-s13/functions): worker 2026-09-05 (uid giải mã, checkReplies) + luồng comment-lead */
import admin from 'firebase-admin';
if (!admin.apps.length) admin.initializeApp();
const db = admin.firestore();
const toMs = v => v && v.toMillis ? v.toMillis() : (v && v._seconds ? v._seconds * 1000 : (typeof v === 'number' ? v : 0));
const vn = ms => ms ? new Date(ms + 7 * 3600e3).toISOString().slice(5, 16).replace('T', ' ') : '—';
const D7 = Date.now() - 7 * 86400e3;
// 1) VPS + phiên bản worker
const ws = await db.collection('workers').get();
ws.forEach(d => { const x = d.data() || {}; console.log('VPS', d.id, '| v' + (x.version || '?'), '| online', x.online, '| lastSeen', vn(toMs(x.lastSeen)), '| inboxCheck', x.inboxCheck, '| running', x.running + '/' + x.maxConcurrent, '| RAM', x.ramUsedPct + '%'); });
// 2) thread: uid có sẵn / giải mã / thiếu (chỉ thread đã inbox)
const th = await db.collection('outreach_threads').get();
let inboxed = 0, hasUid = 0, resolved = 0, noUid = 0, noUidHasProfile = 0, replied = 0; const cl = [];
th.forEach(d => { const x = d.data() || {};
  const ds = Array.isArray(x.doneSteps) ? x.doneSteps : [];
  if (ds.includes('inbox')) { inboxed++; if (x.uid) { hasUid++; if (x.uidResolvedAt) resolved++; } else { noUid++; if (x.fpayload && x.fpayload.profile_url) noUidHasProfile++; } }
  if (x.replied) replied++;
  if (x.fpayload && x.fpayload.kind === 'comment') cl.push({ id: d.id, step: x.step, active: x.active, tries: x.tries || 0, taskStatus: x.taskStatus, done: ds.join('>'), err: String(x.lastError || '').slice(0, 90), nextAt: vn(Number(x.nextAt) || 0) });
});
console.log('\nTHREAD đã inbox:', inboxed, '| có uid', hasUid, '(trong đó giải mã bởi worker mới:', resolved + ')', '| thiếu uid', noUid, '(có profile_url để giải mã:', noUidHasProfile + ')', '| đã phản hồi (mọi thời điểm)', replied);
console.log('→ kỳ vọng sau vài phiên: "giải mã bởi worker mới" tăng, "thiếu uid có profile_url" giảm dần (checkReplies giải mã 5 thread/nick/giờ).');
// 3) checkReplies theo nick
const fa = await db.collection('fb_accounts').get();
fa.forEach(d => { const x = d.data() || {}; if (x.engine !== 'adspower') return; console.log('nick', d.id, '|', x.label || '', '| active', x.active, '| replyCheckAt', vn(Number(x.replyCheckAt) || 0), '| replyFound', x.replyFound || 0, '| needLogin', !!x.needLogin, '| safety', x.safety == null ? '—' : x.safety); });
// 4) log reply 7 ngày (từ worker: text "qua inbox")
const lg = await db.collection('outreach_log').where('status', '==', 'reply').orderBy('at', 'desc').limit(20).get().catch(e => { console.log('log reply: cần index status+at? ', e.message.slice(0, 80)); return null; });
if (lg) { let n = 0; lg.forEach(d => { const x = d.data() || {}; if (toMs(x.at) < D7) return; n++; console.log('  reply', vn(toMs(x.at)), '| lead', x.leadId, '| nick', x.pid, '|', String(x.text || '').slice(0, 60)); }); console.log('log reply 7 ngày:', n); }
// 5) luồng comment-lead
console.log('\nCOMMENT-LEAD threads:', cl.length);
cl.slice(0, 20).forEach(c => console.log('  ', c.id, '| step', c.step, '| active', c.active, '| tries', c.tries, '| task', c.taskStatus, '| done', c.done || '—', '| nextAt', c.nextAt, c.err ? '| lỗi: ' + c.err : ''));
const dead = await db.collection('outreach_tasks').where('status', '==', 'dead').limit(50).get().catch(() => null);
if (dead) { let n = 0; dead.forEach(d => { const x = d.data() || {}; if (x.payload && x.payload.kind === 'comment') { n++; console.log('  DEAD comment-lead task', d.id, '|', String(x.lastError || '').slice(0, 100)); } }); console.log('dead-letter comment-lead:', n); }
console.log('\nKẾT LUẬN: gửi em nguyên output này.');
EOF_WK
echo "=== (b) TTL: gắn expireAt cho outreach_log cũ (chỉ doc thiếu expireAt) ==="
node _l36_ttl.mjs || echo '(b) LỖI — gửi em output, không ảnh hưởng mục khác'
echo "=== (c) dọn rác functions/: diag/reset/stepnick + giữ 1 bản .bak mới nhất mỗi file (GIỮ nguyên _l3x_*/_ss*/_wk*/_cl* script) ==="
rm -fv diag.mjs diag2.mjs reset.mjs stepnick.txt _ttl.mjs 2>/dev/null
for f in $(ls *.bak-* lib/*.bak-* 2>/dev/null | sed 's/\.bak-.*//' | sort -u); do ls -t "$f".bak-* | tail -n +2 | xargs -r rm -v; done
echo "--- .bak còn lại:"; ls -1 *.bak-* lib/*.bak-* 2>/dev/null
echo "--- script tiện ích còn lại:"; ls -1 _*.mjs _*.cjs 2>/dev/null | tr '\n' ' '; echo
echo "=== (d) lead rác 'Lan Anh Nguyễn' — CHỈ LIỆT KÊ (xoá thật: node _l36_junk.mjs --delete) ==="
node _l36_junk.mjs || echo '(d) LỖI — gửi em output'
echo "=== (e) dump stepNick → handleAuth (đường func) để gate theo ma trận ==="
awk '/async function stepNick\(/,/async function handleAuth\(/' outreach.js | nl -ba > ~/stepnick-dump-0906.txt
echo "dòng: $(wc -l < ~/stepnick-dump-0906.txt) (0 = không thấy mốc stepNick/handleAuth)"; head -3 ~/stepnick-dump-0906.txt | cut -c1-100
cloudshell download ~/stepnick-dump-0906.txt 2>/dev/null || echo "(tải tay: cat ~/stepnick-dump-0906.txt)"
echo "=== (f) LỆNH #24: thread uid/giải mã, checkReplies theo nick, log reply 7 ngày, comment-lead ==="
node _wk_check.mjs || echo '(f) LỖI — gửi em output'
echo "=== (g) KHỐI 4 LỆNH #31 — 5 giờ gần nhất (self_comment / vai lead mới) ==="
if [ -f _l31_after.mjs ]; then node _l31_after.mjs 5 || echo '(g) LỖI — gửi em output'; else echo '_l31_after.mjs không có trong functions/ (KHỐI 2-4 LỆNH #31 chưa tạo) — bỏ qua'; fi
echo "KHỐI 2 XONG"
