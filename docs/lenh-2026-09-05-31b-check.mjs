/* _l31_check.mjs — LỆNH #31b KHỐI 4b (chỉ đọc): soi các quyết định seller/self_comment gần đây theo BRAND + Hồ sơ AI brand
   node _l31_check.mjs [giờ=6] */
import admin from 'firebase-admin'; if (!admin.apps.length) admin.initializeApp();
const db = admin.firestore(); const cut = (s, n) => String(s || '').replace(/\s+/g, ' ').slice(0, n);
const H = Number(process.argv[2]) || 6; const since = new Date(Date.now() - H * 3600e3);
const vn = t => t && t.toDate ? new Date(t.toDate().getTime() + 7 * 3600e3).toISOString().slice(5, 16).replace('T', ' ') : '?';
const sp = await db.collection('scanned_posts').where('createdAt', '>=', since).get();
const rows = sp.docs.map(d => d.data()).filter(x => x.decision === 'seller' || x.decision === 'self_comment' || x.decision === 'lead');
console.log(`scanned_posts ${H}h: ${sp.size} · in seller/self_comment/lead: ${rows.length}`);
for (const x of rows.sort((a, b) => (a.createdAt?.toMillis?.() || 0) - (b.createdAt?.toMillis?.() || 0)))
  console.log(`  ${vn(x.createdAt)} VN | ${x.decision.padEnd(12)} | brand ${cut(x.brand, 18).padEnd(18)} | nguồn ${cut(x.source, 22).padEnd(22)} | ${x.kind === 'comment' ? 'BL' : 'BÀI'} | điểm ${x.score ?? '-'} ${x.temp || ''} | role ${x.role || '-'} | ${cut(x.author, 18)}${x.parent_author ? ' vs chủ bài ' + cut(x.parent_author, 18) : ''} || ${JSON.stringify(cut(x.text, 110))}`);
console.log('\nHồ sơ AI theo brand (ai.nganh / ai.khach) + chế độ nội dung:');
(await db.collection('brands').get()).forEach(d => { const b = d.data() || {}, ai = b.ai || {}; console.log(`  ${d.id.padEnd(20)} | ngành: ${cut(ai.nganh, 60) || '(trống)'} | khách: ${cut(ai.khach, 140) || '(trống)'} | content.mode ${b.content?.mode || '-'} | automation ${b.outreach?.on ? 'BẬT' : 'tắt'}`); });
console.log('\nlead mới nhất 6h (mốc detected_at VN, vai):');
(await db.collection('leads').where('detected_at', '>=', since).orderBy('detected_at', 'desc').limit(10).get()).forEach(d => { const l = d.data(); console.log(`  ${vn(l.detected_at)} VN | ${cut(l.brand, 18)} | ${l.kind || 'post'} | ${l.temp} ${l.score} | role ${l.role || '(rỗng)'} | ${cut(l.name, 18)} || ${JSON.stringify(cut(l.text, 80))}`); });
