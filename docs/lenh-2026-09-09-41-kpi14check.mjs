/* _l41_kpi14.mjs — KIỂM CHỈ ĐỌC (không ghi gì): in đúng con số mà 4 ô KPI Bảng điều khiển (v119-80, kỳ 14 ngày giờ VN) PHẢI hiện
   theo bộ đếm daily_stats, đối chiếu với đếm trực tiếp từ kho leads cùng cửa sổ (kể cả phần đã "Loại"/không thành/vai người bán).
   Dùng: node _l41_kpi14.mjs [--brand=hscl-01]   (đặt trong ~/firebase-s13/functions) · node _l41_kpi14.mjs --selftest (không cần Firestore) */
import { vnDay, toMs, tempOf } from './stats.js';
const pct = (a, b) => b > 0 ? +(((a - b) / b) * 100).toFixed(1) : null;
/* Hàm THUẦN: docs daily_stats + leads (select) → số KPI 14 ngày (cur) vs 14 ngày trước (prev) */
export function kpiAgg(docs, leads, nowMs, brand) {
  const d0 = vnDay(nowMs - 13 * 864e5), dP = vnDay(nowMs - 27 * 864e5), t = vnDay(nowMs);
  const Z = () => ({ new: 0, hot: 0, closed: 0, scanned: 0 });
  const cur = Z(), prev = Z(), byBrand = {};
  (docs || []).forEach(x => { if (!x || !x.day || x.day < dP || x.day > t) return; if (brand && x.brandCode !== brand) return;
    const o = x.day >= d0 ? cur : prev; ['new', 'hot', 'closed', 'scanned'].forEach(k => { o[k] += Number(x[k]) || 0; });
    if (x.day >= d0) { const b = byBrand[x.brandCode] || (byBrand[x.brandCode] = Z()); ['new', 'hot', 'closed', 'scanned'].forEach(k => { b[k] += Number(x[k]) || 0; }); } });
  /* đếm trực tiếp từ leads trong CÙNG cửa sổ 14 ngày theo detected_at (giờ VN) */
  const L = { all: 0, valid: 0, hot: 0, junk: 0, dropped: 0, lost: 0, roleBad: 0, validOpen: 0 };
  (leads || []).forEach(l => { if (!l) return; if (brand && String(l.brand || '') !== brand) return; const det = toMs(l.detected_at); if (!det) return; const day = vnDay(det); if (day < d0 || day > t) return;
    L.all++; const tp = tempOf(l); if (tp === 'junk') { L.junk++; return; } L.valid++; if (tp === 'hot') L.hot++;
    const rb = /^(seller|poster_self)$/.test(String(l.role || '')) || l.self_comment === true; if (rb) L.roleBad++; if (l.dropped) L.dropped++; if (l.lost) L.lost++;
    if (!l.dropped && !l.lost && !rb) L.validOpen++; });
  return { d0, dP, t, cur, prev, byBrand, leads: L, delta: { new: pct(cur.new, prev.new), hot: pct(cur.hot, prev.hot), closed: pct(cur.closed, prev.closed), scanned: pct(cur.scanned, prev.scanned) },
    closeRate: cur.new ? +(cur.closed / cur.new * 100).toFixed(1) : null };
}
const isMain = process.argv[1] && /_l41_kpi14\.mjs$/.test(process.argv[1]);
if (process.argv.includes('--selftest')) {
  const NOW = Date.parse('2026-09-09T02:00:00Z'); const D = ms => vnDay(ms);
  const docs = [{ brandCode: 'a', day: D(NOW), new: 2, hot: 1, closed: 0, scanned: 10 }, { brandCode: 'a', day: D(NOW - 13 * 864e5), new: 3, hot: 0, closed: 1, scanned: 5 },
    { brandCode: 'a', day: D(NOW - 14 * 864e5), new: 4, hot: 2, closed: 0, scanned: 7 }, { brandCode: 'b', day: D(NOW - 30 * 864e5), new: 9, hot: 9 }, { brandCode: 'b', day: D(NOW - 1 * 864e5), new: 1 }];
  const leads = [{ brand: 'a', score: 85, detected_at: NOW }, { brand: 'a', score: 50, detected_at: NOW - 13 * 864e5, dropped: true, role: 'poster_self' }, { brand: 'a', score: 10, detected_at: NOW },
    { brand: 'a', score: 70, detected_at: NOW - 14 * 864e5 }, { brand: 'b', score: 65, detected_at: NOW - 864e5, lost: true }];
  const r = kpiAgg(docs, leads, NOW); const rb = kpiAgg(docs, leads, NOW, 'b');
  const ok = r.cur.new === 6 && r.cur.hot === 1 && r.cur.closed === 1 && r.cur.scanned === 15 && r.prev.new === 4 && r.delta.new === 50 && r.byBrand.a.new === 5 && r.byBrand.b.new === 1
    && r.leads.all === 4 && r.leads.valid === 3 && r.leads.hot === 1 && r.leads.junk === 1 && r.leads.dropped === 1 && r.leads.roleBad === 1 && r.leads.lost === 1 && r.leads.validOpen === 1
    && rb.cur.new === 1 && rb.prev.new === 0 && rb.delta.new === null && rb.leads.valid === 1 && rb.leads.validOpen === 0;
  console.log(ok ? 'SELFTEST OK' : 'SELFTEST FAIL ' + JSON.stringify(r)); process.exit(ok ? 0 : 1);
}
if (isMain) {
  const { initializeApp, applicationDefault } = await import('firebase-admin/app'); const { getFirestore } = await import('firebase-admin/firestore');
  initializeApp({ credential: applicationDefault(), projectId: 'smartlead-z15' }); const db = getFirestore();
  const bArg = process.argv.find(a => a.startsWith('--brand=')); const brand = bArg ? bArg.slice(8) : '';
  const NOW = Date.now(); const dP = vnDay(NOW - 27 * 864e5);
  const ds = (await db.collection('daily_stats').where('day', '>=', dP).get()).docs.map(d => d.data());
  const leads = []; let last = null;
  for (;;) { let q = db.collection('leads').orderBy('__name__').select('brand', 'temp', 'score', 'detected_at', 'dropped', 'lost', 'role', 'self_comment').limit(500); if (last) q = q.startAfter(last); const s = await q.get(); if (s.empty) break; s.docs.forEach(d => leads.push(d.data() || {})); last = s.docs[s.docs.length - 1]; if (s.size < 500) break; }
  const r = kpiAgg(ds, leads, NOW, brand || undefined);
  console.log('=== KPI 14 ngày (giờ VN) ' + (brand ? 'brand ' + brand : 'MỌI brand (Super Admin)') + ' · kỳ ' + r.d0 + ' → ' + r.t + ' · kỳ trước từ ' + r.dP + ' · doc daily_stats đọc ' + ds.length + ' · lead quét ' + leads.length + ' ===');
  const f = (v) => v == null ? '—' : ((v > 0 ? '+' : '') + String(v).replace('.', ',') + '%');
  console.log(' Ô "Bài đã quét"  : ' + r.cur.scanned + '  (' + f(r.delta.scanned) + ' so với 14 ngày trước ' + r.prev.scanned + ')');
  console.log(' Ô "Lead hợp lệ"  : ' + r.cur.new + '  (' + f(r.delta.new) + ' so với 14 ngày trước ' + r.prev.new + ')');
  console.log(' Ô "Lead nóng"    : ' + r.cur.hot + '  (' + f(r.delta.hot) + ' so với 14 ngày trước ' + r.prev.hot + ')');
  console.log(' Ô "Đã chốt"      : ' + r.cur.closed + '  (tỷ lệ chốt ' + (r.closeRate == null ? '—' : String(r.closeRate).replace('.', ',') + '%') + ' · ' + f(r.delta.closed) + ' so với 14 ngày trước ' + r.prev.closed + ')');
  console.log('--- theo brand (14 ngày, từ bộ đếm) ---');
  Object.keys(r.byBrand).sort().forEach(b => { const o = r.byBrand[b]; console.log('  ' + b + ': lead hợp lệ ' + o.new + ' · nóng ' + o.hot + ' · chốt ' + o.closed + ' · bài quét ' + o.scanned); });
  const L = r.leads;
  console.log('--- đếm trực tiếp từ kho leads, cùng cửa sổ 14 ngày theo detected_at ---');
  console.log('  lead có điểm: ' + L.all + ' = hợp lệ ' + L.valid + ' (nóng ' + L.hot + ') + rác ' + L.junk + (L.valid === r.cur.new ? '   ✓ khớp ô "Lead hợp lệ"' : '   ✗ LỆCH ô "Lead hợp lệ" (' + r.cur.new + ')'));
  console.log('  trong ' + L.valid + ' lead hợp lệ: đã Loại (dropped) ' + L.dropped + ' · không thành (lost) ' + L.lost + ' · vai người bán/chủ bài ' + L.roleBad + ' → còn mở thật sự ' + L.validOpen);
  console.log('  (ô KPI đếm theo ngày PHÁT HIỆN nên vẫn tính cả lead sau đó bị Loại/không thành — đúng nghĩa "AI đã lọc rác", không phải "còn mở")');
}
