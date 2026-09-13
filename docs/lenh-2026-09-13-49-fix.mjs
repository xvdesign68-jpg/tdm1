/* LỆNH #49 · KHỐI 2 — dọn lead có author_url là ẢNH ĐẠI DIỆN (fbcdn.net) do LỆNH #48 map nhầm `commentator_profile_url` (từ 12/09 08:53Z tới lúc deploy #49).
   DRY mặc định (chỉ in); `--apply` mới ghi. Quy tắc: author_uid là uid số → author_url = https://www.facebook.com/profile.php?id=<uid>; không → author_url = '' (worker không mở ảnh; kết bạn/inbox bỏ qua, react/comment vẫn chạy).
   Ghi dấu author_url_fix49 {old (120 ký tự), at}. Kèm outreach_threads/{leadId}.fpayload.profile_url nếu cũng là ảnh. Đặt trong ~/firebase-s13/functions. Đọc theo trang ≤300 + select(). */
import { initializeApp, applicationDefault, getApps } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
if (!getApps().length) initializeApp({ credential: applicationDefault(), projectId: 'smartlead-z15' }); const db = getFirestore();
const APPLY = process.argv.includes('--apply'); const BAD = /fbcdn\.net|\/v\/t\d{2}\./i; const OFF = 7 * 3600e3;
const ms = v => !v ? 0 : (typeof v === 'number' ? v : (v.toMillis ? v.toMillis() : (v.seconds ? v.seconds * 1000 : (Date.parse(v) || 0))));
const hm = v => ms(v) ? new Date(ms(v) + OFF).toISOString().slice(5, 16).replace('T', ' ') : '—';
async function pageAll(q, orderField, sel, max) {
  const fields = (sel && sel.length) ? ((orderField === '__name__' || sel.includes(orderField)) ? sel : sel.concat(orderField)) : null; const out = []; let last = null;
  while (out.length < (max || 3000)) { let qq = q.orderBy(orderField).limit(300); if (fields) qq = qq.select(...fields); if (last) qq = qq.startAfter(last); const s = await qq.get(); if (s.empty) break; s.docs.forEach(d => out.push(Object.assign({ __id: d.id }, d.data()))); last = s.docs[s.docs.length - 1]; if (s.size < 300) break; }
  return out;
}
console.log('== LỆNH #49 KHỐI 2 — ' + (APPLY ? 'APPLY (ghi)' : 'DRY (chỉ in)') + ' — ' + new Date(Date.now() + OFF).toISOString().slice(0, 16).replace('T', ' ') + ' VN ==');
const since = new Date('2026-09-12T08:53:00Z');
const ls = await pageAll(db.collection('leads').where('detected_at', '>=', since), 'detected_at', ['author_url', 'author_uid', 'kind', 'comment_id', 'name', 'brand', 'author_url_fix49'], 4000);
const bad = ls.filter(l => BAD.test(String(l.author_url || '')));
console.log('1. lead từ 12/09 15:53 VN: ' + ls.length + ' · author_url là ảnh/CDN: ' + bad.length + ' (đã sửa trước đó: ' + ls.filter(l => l.author_url_fix49).length + ')');
const plan = bad.map(l => { const uid = /^\d{6,}$/.test(String(l.author_uid || '')) ? String(l.author_uid) : ''; return { id: l.__id, at: l.detected_at, brand: l.brand, name: l.name, kind: (l.kind === 'comment' || l.comment_id) ? 'cmt' : 'bài', old: String(l.author_url), uid, next: uid ? 'https://www.facebook.com/profile.php?id=' + uid : '' }; });
plan.forEach(p => console.log('   ' + p.kind + ' ' + hm(p.at) + ' ' + String(p.brand || '').padEnd(14) + ' ' + String(p.name || '').slice(0, 18).padEnd(18) + ' → ' + (p.next || '(xoá author_url — không có uid số)') + ' · cũ ' + p.old.slice(0, 60) + '…'));
const refs = plan.map(p => db.collection('outreach_threads').doc(p.id)); const thr = refs.length ? await db.getAll(...refs) : [];
const thrBad = thr.filter(t => t.exists && BAD.test(String(((t.data() || {}).fpayload || {}).profile_url || '')));
console.log('2. outreach_threads của các lead trên có fpayload.profile_url là ảnh: ' + thrBad.length + '/' + thr.filter(t => t.exists).length + ' thread');
if (!APPLY) { console.log('DRY xong — không ghi gì. Ưng thì: node _l49_fix.mjs --apply'); }
else {
  let w = 0; for (let i = 0; i < plan.length; i += 400) { const b = db.batch(); plan.slice(i, i + 400).forEach(p => { b.update(db.collection('leads').doc(p.id), { author_url: p.next, author_url_fix49: { old: p.old.slice(0, 120), at: Date.now(), uid: p.uid || null } }); w++; }); await b.commit(); }
  let wt = 0; for (const t of thrBad) { const p = plan.find(x => x.id === t.id); await t.ref.update({ 'fpayload.profile_url': p ? p.next : '' }); wt++; }
  console.log('ĐÃ GHI: lead ' + w + ' · thread ' + wt + ' (chạy lại DRY sẽ thấy 0 ảnh/CDN)');
}
console.log('== XONG ==');
