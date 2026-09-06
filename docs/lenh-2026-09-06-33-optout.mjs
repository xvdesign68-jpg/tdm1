// LENH #33 (06/09/2026) — đặt trong ~/firebase-s13/functions. Gỡ dòng opt-out khỏi: (1) brands/*.content.optout đang là câu mặc định; (2) inbox_msg của thread funnel ĐANG MỞ + task đang xếp hàng.
//  --dry = chỉ in. Không gọi AI, không đụng comment_msg.
import admin from 'firebase-admin'; if (admin.apps.length === 0) admin.initializeApp();
const db = admin.firestore();
const DRY = process.argv.includes('--dry');
const RE = /\s*Nếu không tiện,\s*(?:anh\/chị|anh|chị|bạn|em|mình)\s+cứ bỏ qua tin này nhé\.?/giu;
const strip = s => String(s || '').replace(RE, '').replace(/\s+$/, '');
/* (1) brands */
const bs = await db.collection('brands').get(); let nb = 0;
for (const d of bs.docs) {
  const c = (d.data() || {}).content; if (!c || !c.optout) continue;
  const isDef = /bỏ qua tin này/i.test(c.optout);
  console.log('brand', d.id, '· optout =', JSON.stringify(c.optout), isDef ? '→ XOÁ (câu mặc định)' : '→ GIỮ (brand tự ghi câu riêng)');
  if (!isDef || DRY) continue;
  await d.ref.set({ content: { optout: '', updatedBy: 'LENH33', updatedAt: Date.now() } }, { merge: true }); nb++;
}
console.log('brands: đã xoá opt-out ở', nb, 'brand', DRY ? '(DRY)' : '');
/* (2) thread funnel đang mở + task */
const ts = await db.collection('outreach_threads').where('active', '==', true).get(); let nt = 0, nk = 0;
for (const d of ts.docs) {
  const t = d.data() || {}; const fp = t.fpayload || {}; if (!fp.inbox_msg || !RE.test(fp.inbox_msg)) { RE.lastIndex = 0; continue; }
  RE.lastIndex = 0; const cleaned = strip(fp.inbox_msg);
  console.log(' - thread', d.id, '| inbox:', JSON.stringify(fp.inbox_msg.slice(-70)), '→', JSON.stringify(cleaned.slice(-50)));
  if (DRY) continue;
  await d.ref.update({ 'fpayload.inbox_msg': cleaned, optoutStrippedAt: Date.now() }); nt++;
  const task = await db.doc('outreach_tasks/' + d.id + '__funnel').get();
  if (task.exists) { const p = (task.data() || {}).payload || {}; if (p.inbox_msg && RE.test(p.inbox_msg)) { RE.lastIndex = 0; await task.ref.update({ 'payload.inbox_msg': strip(p.inbox_msg) }); nk++; } RE.lastIndex = 0; }
}
console.log('threads: đã gỡ ở', nt, 'thread +', nk, 'task', DRY ? '(DRY)' : '');
console.log('XONG _l33_optout.mjs' + (DRY ? ' (DRY)' : ''));
