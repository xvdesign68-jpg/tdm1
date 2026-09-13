/* LỆNH G · KHỐI 2 — CHỈ ĐỌC (đặt trong ~/firebase-s13/functions, chạy ≥15′ sau deploy; bộ nhớ đầy dần sau vài ngày). Không ghi gì.
   In: (1) 10 lượt quét gần nhất: sellerKnown/returning · (2) author_memory: tổng, người bán quen (sellerHits ≥2, 0 buyer, 30 ngày), khách cũ (brands.*.lastStage) · (3) scanned_posts 24 h decision seller_known (mẫu) · (4) lead 24 h returning (mẫu) · (5) ai_feedback 7 ngày.
   Đọc theo trang ≤300 + select() (kèm field orderBy). */
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
console.log('== LỆNH G KHỐI 2 — ' + new Date(now + OFF).toISOString().slice(0, 16).replace('T', ' ') + ' VN ==');
await sec('1.', async () => {
  const sc = await pageAll(db.collection('scans').where('at', '>=', new Date(now - 6 * 3600e3)), 'at', ['at', 'trigger', 'status', 'sellerKnown', 'returning', 'postsFetched', 'leadsCreated', 'llmCalls', 'durationMs'], 600);
  const g = sc.filter(s => s.sellerKnown !== undefined);
  console.log('1. lượt quét 6 h: ' + sc.length + ' · bản G (có sellerKnown): ' + g.length + ' · Σ sellerKnown ' + g.reduce((a, s) => a + (s.sellerKnown || 0), 0) + ' · Σ returning ' + g.reduce((a, s) => a + (s.returning || 0), 0) + '   (kỳ vọng: mọi lượt sau deploy có trường; sellerKnown > 0 khi bộ nhớ đã có ≥2 bài/người bán)');
  sc.slice(0, 10).forEach(s => console.log('   ' + hm(s.at) + ' ' + String(s.trigger || '').padEnd(9) + ' ' + String(s.status || '').padEnd(6) + (s.sellerKnown === undefined ? ' (trước G)' : ' sellerKnown ' + s.sellerKnown + ' · returning ' + s.returning) + ' · bài ' + (s.postsFetched || 0) + '/lead ' + (s.leadsCreated || 0) + ' · AI ' + (s.llmCalls || 0) + ' · ' + Math.round((s.durationMs || 0) / 1000) + ' s'));
});
await sec('2.', async () => {
  const am = await pageAll(db.collection('author_memory'), 'updatedAt', ['key', 'name', 'sellerHits', 'buyerHits', 'lastRole', 'lastSellerAt', 'brands', 'markedBy', 'clearedBy', 'updatedAt'], 3000);
  const known = am.filter(m => (Number(m.sellerHits) || 0) >= 2 && (Number(m.buyerHits) || 0) === 0 && now - (Number(m.lastSellerAt) || 0) < 30 * 86400e3);
  const cust = am.filter(m => m.brands && Object.values(m.brands).some(e => /^(responded|booked|closed)$/.test(String((e || {}).lastStage || ''))));
  console.log('2. author_memory: ' + am.length + ' người · người bán quen (≥2 bài seller, 0 lead, 30 ngày) ' + known.length + ' · seller 1 lần ' + am.filter(m => (Number(m.sellerHits) || 0) === 1).length + ' · khách cũ (từng responded/booked/closed) ' + cust.length + ' · super đánh dấu ' + am.filter(m => m.markedBy).length + ' · super gỡ ' + am.filter(m => m.clearedBy).length);
  known.slice(0, 8).forEach(m => console.log('   🏪 ' + String(m.name || '').slice(0, 24).padEnd(24) + ' ' + m.key + ' · seller ' + m.sellerHits + ' · lần cuối ' + hm(m.lastSellerAt)));
  cust.slice(0, 5).forEach(m => console.log('   🔁 ' + String(m.name || '').slice(0, 24).padEnd(24) + ' ' + m.key + ' · ' + Object.entries(m.brands).map(([b, e]) => b + ':' + (e || {}).lastStage).join(' ')));
});
await sec('3.', async () => {
  const sp = await pageAll(db.collection('scanned_posts').where('createdAt', '>=', new Date(now - 864e5)), 'createdAt', ['decision', 'author', 'author_key', 'memHits', 'brand', 'post_url', 'text', 'createdAt'], 4000);
  const sk = sp.filter(p => p.decision === 'seller_known');
  console.log('3. scanned_posts 24 h: ' + sp.length + ' · seller_known ' + sk.length + ' · seller (AI) ' + sp.filter(p => p.decision === 'seller').length + ' · có author_key ' + sp.filter(p => p.author_key).length + ' (' + (sp.length ? Math.round(sp.filter(p => p.author_key).length / sp.length * 100) : 0) + ' %)   (seller_known = bài KHÔNG tốn AI nhờ bộ nhớ)');
  sk.slice(0, 5).forEach(p => console.log('   ' + hm(p.createdAt) + ' ' + String(p.brand || '').padEnd(12) + ' ' + String(p.author || '').slice(0, 20).padEnd(20) + ' hits ' + (p.memHits || 0) + ' · ' + String(p.text || '').replace(/\s+/g, ' ').slice(0, 70)));
});
await sec('4.', async () => {
  const ls = await pageAll(db.collection('leads').where('detected_at', '>=', new Date(now - 864e5)), 'detected_at', ['returning', 'returning_stage', 'returning_lead_id', 'returning_assignee', 'name', 'brand', 'score', 'temp', 'detected_at'], 3000);
  const r = ls.filter(l => l.returning === true);
  console.log('4. lead 24 h: ' + ls.length + ' · khách cũ quay lại ' + r.length + (r.length ? '' : '   (0 là bình thường khi bộ nhớ mới; tăng dần sau khi sales đổi giai đoạn lead)'));
  r.slice(0, 6).forEach(l => console.log('   🔁 ' + String(l.brand || '').padEnd(12) + ' ' + String(l.name || '').slice(0, 20).padEnd(20) + ' ' + (l.temp || '') + ' ' + (l.score || 0) + 'đ · từng ' + l.returning_stage + (l.returning_assignee ? ' (' + l.returning_assignee + ')' : '') + ' · lead cũ ' + l.returning_lead_id));
});
await sec('5.', async () => {
  const fb = await pageAll(db.collection('ai_feedback').where('at', '>=', now - 7 * 864e5), 'at', ['kind', 'key', 'by', 'at', 'post_url'], 300);
  console.log('5. ai_feedback 7 ngày: ' + fb.length + (fb.length ? ' · ' + fb.slice(0, 5).map(x => x.kind + ' ' + x.key + ' (' + x.by + ')').join(' | ') : ' (chưa ai bấm Không phải người bán / Đánh dấu người bán — zip v119-93 cần deploy)'));
});
console.log('== XONG (chỉ đọc) ==');
process.exit(0);
