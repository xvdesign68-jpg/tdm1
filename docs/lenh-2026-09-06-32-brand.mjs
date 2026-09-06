// LENH #32 (06/09/2026) — đặt trong ~/firebase-s13/functions (cần firebase-admin + .env đã nạp: set -a; . ./.env; set +a)
//  (1) chuyển Content Studio brand (mặc định hscl-01) sang chế độ AI cá nhân hoá + kiểu "Trực tiếp + CTA rõ" (giữ CTA/giọng/hồ sơ/từ cấm đã soạn)
//  (2) sinh THỬ nội dung cho 2 lead thật đang mở (1 lead-bài + 1 lead-bình luận) → in comment/inbox để anh duyệt (KHÔNG ghi gì lên lead)
//  --regen : soạn lại comment/inbox cho các thread funnel ĐANG MỞ của brand mà CHƯA bình luận (áp cấu hình mới cho việc đang xếp hàng)
//  --dry   : chỉ in, không ghi (áp cho cả (1) và --regen) · --brand=<code> : brand khác
import admin from 'firebase-admin'; if (admin.apps.length === 0) admin.initializeApp();
const db = admin.firestore();
const { genForLead } = await import('./content.js');
const args = process.argv.slice(2); const DRY = args.includes('--dry'); const REGEN = args.includes('--regen');
const CODE = (args.find(a => a.startsWith('--brand=')) || '--brand=hscl-01').slice(8);
const cut = (s, n) => { s = String(s || '').replace(/\s+/g, ' ').trim(); return s.length > n ? s.slice(0, n) + '…' : s; };
const isCmt = l => !!(l.kind === 'comment' || l.comment_id || l.comment_url);
const isOpen = l => !l.dropped && !l.lost && l.stage !== 'closed' && !['seller', 'poster_self'].includes(l.role) && !l.self_comment;

/* (1) Content Studio → AI + direct */
const bref = db.doc('brands/' + CODE); const bs = await bref.get();
if (!bs.exists) { console.log('KHÔNG có brand', CODE); process.exit(1); }
const brand = Object.assign({ code: CODE }, bs.data() || {}); const c = brand.content || {}; const ai = brand.ai || {};
console.log('Brand', CODE, '·', brand.name || '', '· automation:', brand.outreach && brand.outreach.on ? 'BẬT' : 'tắt');
console.log('Content Studio hiện tại:', JSON.stringify({ mode: c.mode || '(mặc định: ' + ((c.intro || ai.dichvu || ai.nganh || ai.khach) ? 'ai' : 'reply') + ')', commentStyle: c.commentStyle || '(mặc định direct)', cta: c.cta || '(trống → CTA mặc định)', tone: c.tone || 'friendly', intro: cut(c.intro, 80) || '(trống → dùng Hồ sơ AI: ' + cut([ai.nganh, ai.dichvu].filter(Boolean).join(' · '), 60) + ')' }));
const want = { mode: 'ai', commentStyle: 'direct' };
const diff = Object.keys(want).filter(k => c[k] !== want[k]);
if (!diff.length) console.log('→ đã ở chế độ AI + direct, không cần đổi');
else if (DRY) console.log('→ DRY: sẽ ghi content.' + diff.map(k => k + '=' + want[k]).join(', content.'));
else { await bref.set({ content: Object.assign({}, want, { updatedBy: 'LENH32', updatedAt: Date.now() }) }, { merge: true }); console.log('→ ĐÃ GHI content.' + diff.map(k => k + '=' + want[k]).join(', content.') + ' (giữ CTA/giọng/hồ sơ/từ cấm/mẫu)'); }
const brandNew = Object.assign({}, brand, { content: Object.assign({}, c, want) }); // sinh thử theo cấu hình MỚI (kể cả --dry)

/* (2) sinh thử 2 lead thật */
const snap = await db.collection('leads').where('brand', '==', CODE).orderBy('detected_at', 'desc').limit(80).get();
const leads = snap.docs.map(d => Object.assign({ id: d.id }, d.data())).filter(isOpen);
const post = leads.find(l => !isCmt(l)); const cmt = leads.find(isCmt);
console.log('\nLead đang mở trong 80 lead mới nhất:', leads.length, '· chọn mẫu:', post ? 'bài ' + post.id : 'KHÔNG có lead-bài', '·', cmt ? 'bình luận ' + cmt.id : 'KHÔNG có lead-bình luận');
for (const l of [post, cmt].filter(Boolean)) {
  console.log('\n--- LEAD', l.id, '(' + (isCmt(l) ? 'BÌNH LUẬN' : 'BÀI') + ')', '·', l.name || 'Ẩn danh', '·', l.temp || '-', l.score || '', '· nhu cầu:', cut(l.need, 60));
  console.log('   khách viết:', JSON.stringify(cut(l.text || l.content, 160)));
  if (isCmt(l)) console.log('   bài gốc của', l.parent_author || '?', ':', JSON.stringify(cut(l.parent_text, 120)));
  console.log('   gợi ý sẵn (lead.reply):', JSON.stringify(cut(l.reply, 140)));
  const t0 = Date.now(); let g;
  try { g = await genForLead(brandNew, l); } catch (e) { console.log('   LỖI genForLead:', e.message); continue; }
  console.log('   → mode', g.mode, '|', g.model || '-', '| spam', g.spam, '|', Math.round((Date.now() - t0) / 1000) + 's', g.note ? '| ' + cut(g.note, 100) : '');
  console.log('   COMMENT:', g.comment);
  console.log('   INBOX  :', g.inbox);
}

/* --regen: thread funnel đang mở chưa bình luận của brand */
if (REGEN) {
  const ts = await db.collection('outreach_threads').where('active', '==', true).get();
  const th = ts.docs.map(d => Object.assign({ id: d.id }, d.data())).filter(t => t.step === 'funnel' && t.fpayload && Array.isArray(t.fpayload.steps) && t.fpayload.steps.includes('comment') && !(t.doneSteps || []).includes('comment'));
  console.log('\n[regen] thread funnel đang mở CHƯA bình luận (mọi brand):', th.length, DRY ? '(DRY)' : '');
  let n = 0;
  for (const t of th) {
    const ld = await db.doc('leads/' + t.id).get(); if (!ld.exists) continue;
    const lead = Object.assign({ id: t.id }, ld.data()); if ((lead.brand || t.brandCode) !== CODE) continue;
    if (!isOpen(lead)) { console.log(' -', t.id, 'lead đã đóng/loại/vai không phải khách → bỏ'); continue; }
    const g = await genForLead(brandNew, lead);
    console.log(' -', t.id, '|', cut(lead.name, 22), '|', isCmt(lead) ? 'bình luận' : 'bài', '|', g.mode, '|', cut(g.comment, 110));
    if (DRY) continue;
    await db.doc('outreach_threads/' + t.id).update({ 'fpayload.comment_msg': g.comment, 'fpayload.inbox_msg': g.inbox, 'fpayload.content_mode': g.mode, regenBy: 'LENH32', regenAt: Date.now() });
    const task = await db.doc('outreach_tasks/' + t.id + '__funnel').get(); const st = task.exists ? (task.data() || {}).status : '-';
    if (task.exists && ['queued', 'failed', 'paused'].includes(st)) await task.ref.update({ 'payload.comment_msg': g.comment, 'payload.inbox_msg': g.inbox, 'payload.content_mode': g.mode });
    console.log('   → thread cập nhật; task', st, ['queued', 'failed', 'paused'].includes(st) ? 'cập nhật' : 'giữ nguyên'); n++;
  }
  console.log(DRY ? '[regen] DRY — không ghi gì' : '[regen] ĐÃ CẬP NHẬT ' + n + ' thread');
}
console.log('\nXONG _l32_brand.mjs' + (DRY ? ' (DRY)' : ''));
