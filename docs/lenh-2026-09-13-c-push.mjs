/* LỆNH C · kiểm push "Lead nóng mới" sau deploy C (13/09/2026) — _lc_push.mjs, CHỈ ĐỌC.
   Vì sao: KHỐI 2 thấy 0 dòng "push hot" sau deploy (00:10Z) — chưa rõ do không có lead nóng mới hay hotGateC không kích.
   Làm: (1) lead NÓNG detected_at ≥ mốc (mặc định 2026-09-13T00:10:00Z; tham số 1 = mốc khác) có brand/brand_hint, không dropped/lost/vai/điểm tạm
   → (2) log pushOnLead từ mốc: dòng `push hot <id> new|tagged|rescored sent N` → so từng lead: có dòng push? sent bao nhiêu? · (3) người nhận có token: users có fcmTokens theo brand/role.
   Kết luận tự động: lead nóng đủ điều kiện mà KHÔNG có dòng push → LỖI cổng (gửi em id); có dòng nhưng sent 0 → không ai có token (bình thường nếu admin brand chưa bật thông báo). */
import { initializeApp, applicationDefault, getApps } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { execSync } from 'node:child_process';
if (!getApps().length) initializeApp({ credential: applicationDefault(), projectId: 'smartlead-z15' }); const db = getFirestore();
const OFF = 7 * 3600e3; const SINCE = process.argv[2] || '2026-09-13T00:10:00Z'; const sinceMs = Date.parse(SINCE);
const ms = v => !v ? 0 : (typeof v === 'number' ? v : (v.toMillis ? v.toMillis() : (v.seconds ? v.seconds * 1000 : (Date.parse(v) || 0))));
const hm = t => new Date(t + OFF).toISOString().slice(5, 16).replace('T', ' ');
console.log('== kiểm push lead nóng từ ' + SINCE + ' (' + hm(sinceMs) + ' VN) ==');
const out = []; let last = null; for (;;) { let q = db.collection('leads').where('detected_at', '>=', new Date(sinceMs)).orderBy('detected_at').limit(300).select('brand', 'brand_hint', 'temp', 'score', 'detected_at', 'dropped', 'lost', 'role', 'self_comment', 'ai_scored', 'name', 'kind'); if (last) q = q.startAfter(last); const s = await q.get(); if (s.empty) break; s.docs.forEach(d => out.push(Object.assign({ id: d.id }, d.data() || {}))); last = s.docs[s.docs.length - 1]; if (s.size < 300 || out.length >= 3000) break; }
const hot = out.filter(l => l.temp === 'hot');
const elig = hot.filter(l => (l.brand || l.brand_hint) && l.dropped !== true && l.lost !== true && l.ai_scored !== false && /^(seller|poster_self)$/.test(String(l.role || '')) === false && l.self_comment !== true);
console.log('1. lead từ mốc: ' + out.length + ' · nóng ' + hot.length + ' · nóng ĐỦ ĐIỀU KIỆN push ' + elig.length + (hot.length > elig.length ? ' (bị loại khỏi push: ' + (hot.length - elig.length) + ' = dropped/lost/vai/điểm tạm/không brand)' : ''));
let lines = []; try { const raw = execSync('gcloud logging read \'resource.labels.service_name="pushonlead" AND textPayload:"push hot" AND timestamp>="' + SINCE + '"\' --project=smartlead-z15 --format="value(timestamp,textPayload)" --limit=500 2>/dev/null', { encoding: 'utf8' }); lines = raw.split('\n').map(s => s.trim()).filter(Boolean); } catch (e) { console.log('   (gcloud logging lỗi: ' + String(e.message || e).slice(0, 120) + ')'); }
const pushed = {}; lines.forEach(ln => { const m = ln.match(/push hot (\S+)(?: (new|tagged|rescored))? sent (\d+)/); if (m) { const o = pushed[m[1]] || (pushed[m[1]] = { n: 0, sent: 0, why: [] }); o.n++; o.sent += Number(m[3]); if (m[2]) o.why.push(m[2]); } });
console.log('2. log pushOnLead từ mốc: ' + lines.length + ' dòng "push hot" · lead có push ' + Object.keys(pushed).length);
let miss = 0, zero = 0; elig.forEach(l => { const p = pushed[l.id]; const tag = p ? (p.sent > 0 ? 'push ✓ ' + p.why.join('/') + ' sent ' + p.sent + (p.n > 1 ? ' (' + p.n + ' dòng)' : '') : 'push nhưng sent 0 ' + p.why.join('/')) : 'KHÔNG CÓ DÒNG PUSH'; if (p === undefined) miss++; else if (p.sent === 0) zero++; console.log('   ' + hm(ms(l.detected_at)) + ' ' + l.id.slice(0, 34).padEnd(34) + ' ' + String(l.brand || l.brand_hint).padEnd(18) + ' ' + String(l.score).padStart(3) + ' ' + (l.kind === 'comment' ? 'cmt ' : 'post') + ' → ' + tag); });
const extra = Object.keys(pushed).filter(id => elig.some(l => l.id === id) === false); if (extra.length) console.log('   (push cho lead ngoài danh sách đủ điều kiện: ' + extra.length + ' — ' + extra.slice(0, 3).join(', ') + ')');
const us = (await db.collection('users').select('brand', 'role', 'fcmTokens', 'active').get()).docs.map(d => d.data() || {}).filter(u => Array.isArray(u.fcmTokens) && u.fcmTokens.length > 0);
console.log('3. người dùng có token thông báo: ' + us.length + ' — ' + us.map(u => (u.role || '?') + '@' + (u.brand || '-') + '×' + u.fcmTokens.length).join(', '));
console.log('KẾT LUẬN: ' + (elig.length === 0 ? 'chưa có lead nóng đủ điều kiện kể từ mốc → chưa kết luận được, chạy lại sau (node _lc_push.mjs).' : miss === 0 ? 'cổng hotGateC KÍCH đúng cho ' + elig.length + '/' + elig.length + ' lead nóng' + (zero ? ' (' + zero + ' lead sent 0 = admin brand chưa bật thông báo)' : '') + ' ✓' : 'LỖI: ' + miss + '/' + elig.length + ' lead nóng đủ điều kiện KHÔNG có dòng push → gửi em output này.'));
