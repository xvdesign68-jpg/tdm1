// LENH #34 (06/09/2026) — đặt trong ~/firebase-s13/functions (cần .env đã nạp: set -a; . ./.env; set +a)
// Soạn LẠI comment/inbox (+ content_meta) cho thread funnel ĐANG MỞ mà CHƯA bình luận — áp bản vá #34 (inbox ngắn + 1 câu hỏi, bình luận nhẹ dưới bài đối thủ)
// cho việc đang xếp hàng. Mặc định MỌI brand; --brand=<code> giới hạn; --dry chỉ in không ghi.
import admin from 'firebase-admin'; if (admin.apps.length === 0) admin.initializeApp();
const db = admin.firestore();
const { genForLead } = await import('./content.js');
const args = process.argv.slice(2); const DRY = args.includes('--dry'); const ONLY = (args.find(a => a.startsWith('--brand=')) || '').slice(8);
const cut = (s, n) => { s = String(s || '').replace(/\s+/g, ' ').trim(); return s.length > n ? s.slice(0, n) + '…' : s; };
const isCmt = l => !!(l.kind === 'comment' || l.comment_id || l.comment_url);
const isOpen = l => !l.dropped && !l.lost && l.stage !== 'closed' && !['seller', 'poster_self'].includes(l.role) && !l.self_comment;
const brands = {};
const ts = await db.collection('outreach_threads').where('active', '==', true).get();
const th = ts.docs.map(d => Object.assign({ id: d.id }, d.data())).filter(t => t.step === 'funnel' && t.fpayload && Array.isArray(t.fpayload.steps) && t.fpayload.steps.includes('comment') && !(t.doneSteps || []).includes('comment'));
console.log('[regen #34] thread funnel đang mở CHƯA bình luận:', th.length, ONLY ? '(chỉ brand ' + ONLY + ')' : '(mọi brand)', DRY ? '(DRY)' : '');
let n = 0, skip = 0;
for (const t of th) {
  const ld = await db.doc('leads/' + t.id).get(); if (!ld.exists) { skip++; continue; }
  const lead = Object.assign({ id: t.id }, ld.data()); const code = lead.brand || t.brandCode || '';
  if (ONLY && code !== ONLY) { skip++; continue; }
  if (!isOpen(lead)) { console.log(' -', t.id, 'lead đã đóng/loại/vai không phải khách → bỏ'); skip++; continue; }
  if (!brands[code]) { const bs = await db.doc('brands/' + code).get(); brands[code] = bs.exists ? Object.assign({ code }, bs.data() || {}) : null; }
  if (!brands[code]) { console.log(' -', t.id, 'không có brand', code, '→ bỏ'); skip++; continue; }
  let g; try { g = await genForLead(brands[code], lead); } catch (e) { console.log(' -', t.id, 'LỖI genForLead:', e.message); skip++; continue; }
  const m = g.meta || {};
  console.log(' -', t.id, '|', code, '|', cut(lead.name, 22), '|', isCmt(lead) ? 'bình luận' : 'bài', '|', g.mode, '| bài gốc:', m.parent || '-', '| inbox', m.ilen + 'c/' + m.q + '?', '|', cut(g.comment, 100));
  if (DRY) continue;
  await db.doc('outreach_threads/' + t.id).update({ 'fpayload.comment_msg': g.comment, 'fpayload.inbox_msg': g.inbox, 'fpayload.content_mode': g.mode, 'fpayload.content_meta': g.meta || null, regenBy: 'LENH34', regenAt: Date.now() });
  const task = await db.doc('outreach_tasks/' + t.id + '__funnel').get(); const st = task.exists ? (task.data() || {}).status : '-';
  if (task.exists && ['queued', 'failed', 'paused'].includes(st)) await task.ref.update({ 'payload.comment_msg': g.comment, 'payload.inbox_msg': g.inbox, 'payload.content_mode': g.mode, 'payload.content_meta': g.meta || null });
  console.log('   → thread cập nhật; task', st, ['queued', 'failed', 'paused'].includes(st) ? 'cập nhật' : 'giữ nguyên'); n++;
}
console.log(DRY ? '[regen #34] DRY — không ghi gì (bỏ --dry để áp)' : '[regen #34] ĐÃ CẬP NHẬT ' + n + ' thread' + (skip ? ' · bỏ qua ' + skip : ''));
