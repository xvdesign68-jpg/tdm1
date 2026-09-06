// LENH #34 (06/09/2026) — đặt trong ~/firebase-s13/functions (cần .env đã nạp). Sinh THỬ nội dung theo bản vá #34 cho 2 lead thật đang mở của brand
// (1 lead-bài + 1 lead-bình-luận) → in nhận định bài gốc + comment + inbox + meta. KHÔNG ghi gì. --brand=<code> đổi brand (mặc định hscl-01).
import admin from 'firebase-admin'; if (admin.apps.length === 0) admin.initializeApp();
const db = admin.firestore();
const { genForLead } = await import('./content.js');
const args = process.argv.slice(2); const CODE = (args.find(a => a.startsWith('--brand=')) || '--brand=hscl-01').slice(8);
const cut = (s, n) => { s = String(s || '').replace(/\s+/g, ' ').trim(); return s.length > n ? s.slice(0, n) + '…' : s; };
const isCmt = l => !!(l.kind === 'comment' || l.comment_id || l.comment_url);
const isOpen = l => !l.dropped && !l.lost && l.stage !== 'closed' && !['seller', 'poster_self'].includes(l.role) && !l.self_comment;
const bs = await db.doc('brands/' + CODE).get(); if (!bs.exists) { console.log('KHÔNG có brand', CODE); process.exit(1); }
const brand = Object.assign({ code: CODE }, bs.data() || {}); const c = brand.content || {};
console.log('Brand', CODE, '·', brand.name || '', '· Content Studio: mode', c.mode || '(mặc định)', '· commentStyle', c.commentStyle || '(mặc định direct)', '· cta', c.cta ? '"' + cut(c.cta, 50) + '"' : '(trống → mặc định)');
const snap = await db.collection('leads').where('brand', '==', CODE).orderBy('detected_at', 'desc').limit(80).get();
const leads = snap.docs.map(d => Object.assign({ id: d.id }, d.data())).filter(isOpen);
const post = leads.find(l => !isCmt(l)), cmt = leads.find(l => isCmt(l));
console.log('Lead mở trong 80 lead mới nhất:', leads.length, '| lead-bài:', post ? post.id : '(không có)', '| lead-bình luận:', cmt ? cmt.id : '(không có)');
let warn = 0;
for (const l of [post, cmt].filter(Boolean)) {
  const cm = isCmt(l);
  console.log('\n--- LEAD', l.id, cm ? '(BÌNH LUẬN)' : '(BÀI)', '|', cut(l.name, 30), '|', l.temp, l.score + 'đ');
  console.log('   KHÁCH VIẾT:', '"' + cut(l.text, 160) + '"');
  if (cm) console.log('   BÀI GỐC (' + cut(l.parent_author, 30) + '):', '"' + cut(l.parent_text, 200) + '"');
  let g; const t0 = Date.now();
  try { g = await genForLead(brand, l); } catch (e) { console.log('   LỖI genForLead:', e.message); warn++; continue; }
  const m = g.meta || {};
  console.log('   → mode', g.mode, '|', g.model || '-', '|', Math.round((Date.now() - t0) / 1000) + 's', '| spam', g.spam, '| bài gốc:', m.parent || '(lead là bài)', '| CTA:', m.cta, '| biến thể:', m.variant, '| inbox', m.ilen + ' ký tự', m.q + ' câu hỏi', '| comment', m.clen + ' ký tự');
  console.log('   NOTE:', g.note);
  console.log('   COMMENT:', g.comment);
  console.log('   INBOX  :', g.inbox);
  const bad = [];
  if (m.q < 1) bad.push('inbox KHÔNG kết bằng câu hỏi');
  if (m.ilen > 340) bad.push('inbox dài > 340');
  if (cm && m.parent === 'seller') { if (m.clen > 200) bad.push('comment dưới bài đối thủ > 200'); if (brand.name && brand.name.length >= 3 && g.comment.toLowerCase().includes(brand.name.toLowerCase())) bad.push('comment dưới bài đối thủ nêu tên brand'); if (/\d[\d.,]*\s*(?:k|đ|vnd|nghìn|ngàn|triệu|tr)(?!\p{L})/iu.test(g.comment)) bad.push('comment dưới bài đối thủ có giá'); }
  if (bad.length) { warn++; console.log('   ⚠ KIỂM:', bad.join(' · ')); } else console.log('   ✓ KIỂM OK');
}
console.log('\nXONG _l34_test.mjs' + (warn ? ' — ' + warn + ' cảnh báo (đọc lại nội dung, không chặn)' : ' — KIỂM OK hết'));
