/* LỆNH F · KHỐI 2 — CHỈ ĐỌC (đặt trong ~/firebase-s13/functions, chạy ≥15′ sau deploy; tốt nhất 1–2 giờ ban ngày khi có bình luận). Không ghi gì.
   In: (1) 10 lượt quét gần nhất: cmtExtra/phoneFromCmt/commentsFetched · (2) lead 24 h: có text_extra, contact_source (post/comment/manual), có SĐT theo nguồn, kiểm Zalo · (3) lead có SĐT 7 ngày: tỉ lệ có SĐT trước/sau F · (4) zaloCheckLead: lead phone_set_by 7 ngày · (5) describe CF. Đọc theo trang ≤300 + select() (kèm field orderBy). */
import { initializeApp, applicationDefault, getApps } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
if (!getApps().length) initializeApp({ credential: applicationDefault(), projectId: 'smartlead-z15' }); const db = getFirestore();
const OFF = 7 * 3600e3, now = Date.now(); const ms = v => !v ? 0 : (typeof v === 'number' ? v : (v.toMillis ? v.toMillis() : (v.seconds ? v.seconds * 1000 : (Date.parse(v) || 0))));
const hm = v => ms(v) ? new Date(ms(v) + OFF).toISOString().slice(5, 16).replace('T', ' ') : '—';
async function pageAll(q, orderField, sel, max) {
  const fields = (sel && sel.length) ? ((orderField === '__name__' || sel.includes(orderField)) ? sel : sel.concat(orderField)) : null; const out = []; let last = null;
  while (out.length < (max || 3000)) { let qq = q.orderBy(orderField, 'desc').limit(300); if (fields) qq = qq.select(...fields); if (last) qq = qq.startAfter(last); const s = await qq.get(); if (s.empty) break; s.docs.forEach(d => out.push(Object.assign({ __id: d.id }, d.data()))); last = s.docs[s.docs.length - 1]; if (s.size < 300) break; }
  return out;
}
const sec = async (label, fn) => { try { await fn(); } catch (e) { console.log(label + ' LỖI (mục này bỏ qua, mục sau vẫn chạy): ' + String(e && e.message).slice(0, 220)); } };
const cnt = (arr, f) => arr.reduce((m, x) => { const k = String(f(x)); m[k] = (m[k] || 0) + 1; return m; }, {});
const pct = (a, b) => b ? Math.round(a / b * 1000) / 10 + ' %' : '—';
console.log('== LỆNH F KHỐI 2 — ' + new Date(now + OFF).toISOString().slice(0, 16).replace('T', ' ') + ' VN ==');
await sec('1.', async () => {
  const sc = await pageAll(db.collection('scans').where('at', '>=', new Date(now - 6 * 3600e3)), 'at', ['at', 'trigger', 'status', 'cmtExtra', 'phoneFromCmt', 'commentsFetched', 'leadsCreated', 'postsFetched', 'durationMs'], 600);
  const f = sc.filter(s => s.cmtExtra !== undefined); console.log('1. lượt quét 6 h: ' + sc.length + ' · bản F (có cmtExtra): ' + f.length + ' · Σ cmtExtra ' + f.reduce((a, s) => a + (s.cmtExtra || 0), 0) + ' · Σ phoneFromCmt ' + f.reduce((a, s) => a + (s.phoneFromCmt || 0), 0) + '   (kỳ vọng: mọi lượt sau deploy có cmtExtra; số > 0 khi có bình luận cùng tác giả)');
  sc.slice(0, 10).forEach(s => console.log('   ' + hm(s.at) + ' ' + String(s.trigger || '').padEnd(9) + ' ' + String(s.status || '').padEnd(6) + (s.cmtExtra === undefined ? ' (trước F)' : ' cmtExtra ' + s.cmtExtra + ' · phoneFromCmt ' + s.phoneFromCmt) + ' · bình luận ' + (s.commentsFetched || 0) + ' · bài ' + (s.postsFetched || 0) + '/lead ' + (s.leadsCreated || 0) + ' · ' + Math.round((s.durationMs || 0) / 1000) + ' s'));
});
await sec('2.', async () => {
  const ls = await pageAll(db.collection('leads').where('detected_at', '>=', new Date(now - 864e5)), 'detected_at', ['text_extra', 'contact_source', 'phone', 'phone_has_zalo', 'zalo_defer', 'temp', 'brand', 'kind', 'name', 'text_extra_at', 'phone_set_by'], 3000);
  const withX = ls.filter(l => l.text_extra), withP = ls.filter(l => l.phone);
  console.log('2. lead 24 h: ' + ls.length + ' · có text_extra ' + withX.length + ' · có SĐT ' + withP.length + ' (' + pct(withP.length, ls.length) + ') · contact_source ' + JSON.stringify(cnt(withP, l => l.contact_source || '(trước F)')) + ' · kiểm Zalo ' + JSON.stringify(cnt(withP, l => l.phone_has_zalo === true ? 'có' : l.phone_has_zalo === false ? 'không' : (l.zalo_defer ? 'hoãn (lạnh)' : 'chưa'))));
  withX.slice(0, 6).forEach(l => console.log('   ' + String(l.brand || '').padEnd(12) + ' ' + String(l.name || '').slice(0, 18).padEnd(18) + ' ' + (l.kind === 'comment' ? 'bình luận' : 'bài     ') + ' · SĐT ' + (l.phone || '—') + ' (' + (l.contact_source || '') + ') · thêm: ' + String(l.text_extra || '').replace(/\s+/g, ' ').slice(0, 90)));
  const cmtP = withP.filter(l => l.contact_source === 'comment'); if (cmtP.length) console.log('   → ' + cmtP.length + ' lead có SĐT NHỜ bình luận cùng tác giả (trước F sales không có số để gọi)');
});
await sec('3.', async () => {
  const ls = await pageAll(db.collection('leads').where('detected_at', '>=', new Date(now - 7 * 864e5)), 'detected_at', ['phone', 'contact_source', 'kind'], 6000);
  const f = ls.filter(l => l.contact_source !== undefined), o = ls.filter(l => l.contact_source === undefined);
  console.log('3. lead 7 ngày: ' + ls.length + ' · tỉ lệ có SĐT — bản F: ' + pct(f.filter(l => l.phone).length, f.length) + ' (n ' + f.length + ') · trước F: ' + pct(o.filter(l => l.phone).length, o.length) + ' (n ' + o.length + ')   (đo lại sau vài ngày để thấy chênh)');
});
await sec('4.', async () => {
  const ls = await pageAll(db.collection('leads').where('phone_set_at', '>=', now - 7 * 864e5), 'phone_set_at', ['phone', 'phone_prev', 'phone_set_by', 'phone_has_zalo', 'brand', 'name'], 300);
  console.log('4. "Dùng số này" 7 ngày: ' + ls.length + (ls.length ? ' · ' + ls.slice(0, 5).map(l => (l.name || '') + ' ' + (l.phone_prev || '∅') + ' → ' + l.phone + ' (' + (l.phone_set_by || '') + ', Zalo ' + l.phone_has_zalo + ')').join(' | ') : ' (chưa ai dùng — zip v119-92 cần deploy)'));
});
console.log('== XONG (chỉ đọc) ==');
process.exit(0);
