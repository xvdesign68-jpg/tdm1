/* LỆNH E · KHỐI 2 — CHỈ ĐỌC (đặt trong ~/firebase-s13/functions, chạy ≥15′ sau deploy). Không ghi gì.
   In: (1) config/app.scoring + system_status/llm · (2) 10 lượt quét gần nhất: promptV2/scoreV2/dist ↔ distV2/roleUnknown/noProfileBrands/llmFail · (3) lead 24 h: có ai_v2, vai (reseller/proxy), contact_via_poster, raw ↔ v2 ·
   (4) scanned_posts 24 h theo decision (reseller mới) · (5) brand: Hồ sơ AI có/không + cờ banSi. Đọc theo trang ≤300 + select() (kèm field orderBy). */
import { initializeApp, applicationDefault, getApps } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
if (!getApps().length) initializeApp({ credential: applicationDefault(), projectId: 'smartlead-z15' }); const db = getFirestore();
const OFF = 7 * 3600e3, now = Date.now(); const ms = v => !v ? 0 : (typeof v === 'number' ? v : (v.toMillis ? v.toMillis() : (v.seconds ? v.seconds * 1000 : (Date.parse(v) || 0))));
const hm = v => ms(v) ? new Date(ms(v) + OFF).toISOString().slice(5, 16).replace('T', ' ') : '—';
const tempOf = h => h >= 80 ? 'hot' : h >= 60 ? 'warm' : h >= 40 ? 'cold' : 'junk';
async function pageAll(q, orderField, sel, max) {
  const fields = (sel && sel.length) ? ((orderField === '__name__' || sel.includes(orderField)) ? sel : sel.concat(orderField)) : null; const out = []; let last = null;
  while (out.length < (max || 3000)) { let qq = q.orderBy(orderField, 'desc').limit(300); if (fields) qq = qq.select(...fields); if (last) qq = qq.startAfter(last); const s = await qq.get(); if (s.empty) break; s.docs.forEach(d => out.push(Object.assign({ __id: d.id }, d.data()))); last = s.docs[s.docs.length - 1]; if (s.size < 300) break; }
  return out;
}
const sec = async (label, fn) => { try { await fn(); } catch (e) { console.log(label + ' LỖI (mục này bỏ qua, mục sau vẫn chạy): ' + String(e && e.message).slice(0, 220)); } };
const cnt = (arr, f) => arr.reduce((m, x) => { const k = String(f(x)); m[k] = (m[k] || 0) + 1; return m; }, {});
console.log('== LỆNH E KHỐI 2 — ' + new Date(now + OFF).toISOString().slice(0, 16).replace('T', ' ') + ' VN ==');
await sec('1.', async () => {
  const c = await db.collection('config').doc('app').get(); const sc = (c.exists && (c.data() || {}).scoring) || null; const w = (c.exists && (c.data() || {}).weights) || [];
  console.log('1. config/app.scoring: ' + (sc ? JSON.stringify(sc) : '(chưa đặt → theo .env: PROMPT_BRAND_V2 true · SCORE_V2 shadow)') + ' · weights ' + (Array.isArray(w) && w.length ? w.map(x => x.key + ':' + x.weight).join(' ') + ' (Σ ' + w.reduce((a, x) => a + (Number(x.weight) || 0), 0) + ')' : '(trống → mặc định 30/25/15/12/8/10)'));
  const l = await db.collection('system_status').doc('llm').get(); const d = l.exists ? (l.data() || {}) : {};
  console.log('   system_status/llm: ok=' + d.ok + ' · at ' + hm(d.at) + ' · pre=' + d.pre + ' · cbOpen=' + d.cbOpen + '   (kỳ vọng ok=true, pre=true)');
});
await sec('2.', async () => {
  const sc = await pageAll(db.collection('scans').where('at', '>=', new Date(now - 6 * 3600e3)), 'at', ['at', 'trigger', 'status', 'promptV2', 'scoreV2', 'dist', 'distV2', 'roleUnknown', 'noProfileBrands', 'leadsCreated', 'postsFetched', 'llmFail', 'llmOk', 'scoreCalls', 'durationMs'], 600);
  const e = sc.filter(s => s.scoreV2 !== undefined); console.log('2. lượt quét 6 h: ' + sc.length + ' · bản E (có scoreV2): ' + e.length + '   (kỳ vọng: mọi lượt sau deploy có promptV2/scoreV2)');
  sc.slice(0, 10).forEach(s => console.log('   ' + hm(s.at) + ' ' + String(s.trigger || '').padEnd(9) + ' ' + String(s.status || '').padEnd(6) + (s.scoreV2 === undefined ? ' (trước E)' : ' promptV2 ' + s.promptV2 + ' · scoreV2 ' + s.scoreV2 + ' · dist ' + JSON.stringify(s.dist) + ' · distV2 ' + JSON.stringify(s.distV2) + ' · roleUnknown ' + s.roleUnknown + (s.noProfileBrands && s.noProfileBrands.length ? ' · ⚠ chưa hồ sơ AI: ' + s.noProfileBrands.join(',') : '')) + ' · bài ' + (s.postsFetched || 0) + '/lead ' + (s.leadsCreated || 0) + ' · llm ok/fail ' + (s.llmOk || 0) + '/' + (s.llmFail || 0) + ' · ' + Math.round((s.durationMs || 0) / 1000) + ' s'));
  const np = new Set(); e.forEach(s => (s.noProfileBrands || []).forEach(b => np.add(b))); if (np.size) console.log('   ⚠ brand CHƯA có Hồ sơ AI (v2 dùng prompt trung tính SME): ' + [...np].join(', ') + ' → Người dùng → Hồ sơ AI');
  console.log('   llm fail tổng (bản E): ' + e.reduce((a, s) => a + (s.llmFail || 0), 0) + ' · roleUnknown tổng ' + e.reduce((a, s) => a + (s.roleUnknown || 0), 0) + '   (kỳ vọng fail 0; roleUnknown nhỏ)');
});
await sec('3.', async () => {
  const ls = await pageAll(db.collection('leads').where('detected_at', '>=', new Date(now - 864e5)), 'detected_at', ['ai_v2', 'role', 'contact_via_poster', 'score', 'temp', 'brand', 'kind', 'name', 'ai_scored', 'service', 'industry'], 3000);
  const v = ls.filter(l => l.ai_v2 && typeof l.ai_v2 === 'object'); console.log('3. lead 24 h: ' + ls.length + ' · có ai_v2 ' + v.length + ' · mode ' + JSON.stringify(cnt(v, l => l.ai_v2.mode || '?')) + ' · vai ' + JSON.stringify(cnt(ls, l => l.role || '-')) + ' · đăng hộ (contact_via_poster) ' + ls.filter(l => l.contact_via_poster).length);
  const vv = v.filter(l => l.ai_v2.score !== null && l.ai_v2.score !== undefined); if (vv.length) { const d = vv.map(l => (Number(l.ai_v2.raw) || 0) - l.ai_v2.score); console.log('   raw ↔ v2: n ' + vv.length + ' · raw−v2 TB ' + Math.round(d.reduce((a, x) => a + x, 0) / d.length * 10) / 10 + ' · |Δ| TB ' + Math.round(d.map(Math.abs).reduce((a, x) => a + x, 0) / d.length * 10) / 10 + ' · nhiệt độ raw ' + JSON.stringify(cnt(vv, l => tempOf(Number(l.ai_v2.raw) || 0))) + ' · v2 ' + JSON.stringify(cnt(vv, l => tempOf(l.ai_v2.score))) + ' · thiếu criteria ' + (v.length - vv.length)); }
  v.slice(0, 6).forEach(l => console.log('   ' + String(l.brand || '').padEnd(12) + ' ' + String(l.name || '').slice(0, 18).padEnd(18) + ' score ' + String(l.score).padStart(3) + ' (' + (l.temp || '') + ') · raw ' + l.ai_v2.raw + ' · v2 ' + l.ai_v2.score + ' · ' + JSON.stringify(l.ai_v2.criteria) + ' · conf ' + l.ai_v2.conf + ' · ' + (l.role || '-') + ' · ' + String(l.service || '').slice(0, 24) + ' · why ' + String((l.ai_v2.why || []).join('; ')).slice(0, 70)));
  const s = ls.filter(l => l.ai_v2 && l.ai_v2.mode === 'shadow' && l.ai_v2.score !== null && l.ai_v2.score !== undefined && l.score !== l.ai_v2.raw); if (s.length) console.log('   ⚠ shadow nhưng score ≠ raw: ' + s.length + ' lead (kỳ vọng 0 — trừ lead multitouch gộp/rescore)');
});
await sec('4.', async () => {
  const sp = await pageAll(db.collection('scanned_posts').where('createdAt', '>=', new Date(now - 864e5)), 'createdAt', ['decision', 'role', 'brand', 'ai_v2'], 3000);
  console.log('4. scanned_posts 24 h: ' + sp.length + ' · decision ' + JSON.stringify(cnt(sp, p => p.decision || '?')) + ' · có ai_v2 ' + sp.filter(p => p.ai_v2 && typeof p.ai_v2 === 'object').length + ' · vai (đã chấm) ' + JSON.stringify(cnt(sp.filter(p => p.role), p => p.role)) + '   (decision "reseller" = đại lý/mua sỉ bị chặn vì brand không bán sỉ)');
});
await sec('5.', async () => {
  const bs = await db.collection('brands').get(); const rows = bs.docs.map(d => { const b = d.data() || {}; const ai = b.ai || {}; const has = !!(ai.nganh || ai.dichvu || ai.khach); return d.id + (has ? ' ✓' : ' ✗ CHƯA HỒ SƠ AI') + (ai.banSi === true ? ' · bán sỉ' : '') + (b.active === false ? ' · tắt' : ''); });
  console.log('5. brands (' + bs.size + '): ' + rows.join(' | ') + '   → brand ✗ dùng prompt trung tính SME: super khai Hồ sơ AI (Người dùng → Hồ sơ AI); brand bán sỉ tick "Brand có bán sỉ / đại lý" (zip v119-91)');
});
console.log('== XONG (chỉ đọc) — bước kế: 3 ngày sau chạy `node _pc2_shadow.mjs --days=3 --minAge=0` xem phân bố; ≥14 ngày `node _pc2_shadow.mjs` quyết bật scoreV2=on ==');
process.exit(0);
