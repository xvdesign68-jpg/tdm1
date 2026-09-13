/* LỆNH E — `_pc2_shadow.mjs` (PC-2 chạy bóng): so ĐIỂM AI (raw, đang dùng) ↔ ĐIỂM TIÊU CHÍ v2 (ai_v2.score) trên lead THẬT + kết quả sales (phản hồi / hẹn / chốt / loại) theo dải điểm.
   CHỈ ĐỌC. Đặt trong ~/firebase-s13/functions. Dùng: node _pc2_shadow.mjs [--days=14] [--minAge=7] [--brand=<code>]
   Chạy sau ≥3 ngày để xem phân bố; sau ≥14 ngày (cohort ≥7 ngày tuổi) để quyết bật `config/app.scoring.scoreV2 = 'on'` (web) — tiêu chí: dải NÓNG theo v2 có tỉ lệ phản hồi/hẹn/chốt ≥ dải nóng theo raw và ít bị người loại hơn. */
import { initializeApp, applicationDefault, getApps } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
if (!getApps().length) initializeApp({ credential: applicationDefault(), projectId: 'smartlead-z15' }); const db = getFirestore();
const arg = (k, d) => { const m = process.argv.find(a => a.startsWith('--' + k + '=')); return m ? m.slice(k.length + 3) : d; };
const DAYS = Math.max(1, Number(arg('days', 14)) || 14), MIN_AGE = Math.max(0, Number(arg('minAge', 7)) || 7), BRAND = String(arg('brand', '')).trim();
const OFF = 7 * 3600e3, now = Date.now(); const ms = v => !v ? 0 : (typeof v === 'number' ? v : (v.toMillis ? v.toMillis() : (v.seconds ? v.seconds * 1000 : (Date.parse(v) || 0))));
const tempOf = h => h >= 80 ? 'hot' : h >= 60 ? 'warm' : h >= 40 ? 'cold' : 'junk'; const BANDS = ['hot', 'warm', 'cold', 'junk'];
async function pageAll(q, orderField, sel, max) {
  const fields = (sel && sel.length) ? ((orderField === '__name__' || sel.includes(orderField)) ? sel : sel.concat(orderField)) : null; const out = []; let last = null;
  while (out.length < (max || 3000)) { let qq = q.orderBy(orderField, 'desc').limit(300); if (fields) qq = qq.select(...fields); if (last) qq = qq.startAfter(last); const s = await qq.get(); if (s.empty) break; s.docs.forEach(d => out.push(Object.assign({ __id: d.id }, d.data()))); last = s.docs[s.docs.length - 1]; if (s.size < 300) break; }
  return out;
}
console.log('== LỆNH E · _pc2_shadow — ' + new Date(now + OFF).toISOString().slice(0, 16).replace('T', ' ') + ' VN · lead ' + DAYS + ' ngày · cohort ≥' + MIN_AGE + ' ngày tuổi' + (BRAND ? ' · brand ' + BRAND : '') + ' ==');
const ls = await pageAll(db.collection('leads').where('detected_at', '>=', new Date(now - DAYS * 864e5)), 'detected_at', ['ai_v2', 'score', 'temp', 'brand', 'stage', 'dropped', 'dropped_by', 'lost', 'closed_at', 'first_care_at', 'last_touch_at', 'outreach_replied', 'role', 'contact_via_poster', 'ai_scored'], 6000);
const withV2 = ls.filter(l => l.ai_v2 && typeof l.ai_v2 === 'object' && l.ai_v2.score !== null && l.ai_v2.score !== undefined && (!BRAND || l.brand === BRAND));
console.log('lead ' + DAYS + ' ngày: ' + ls.length + ' · có ai_v2 (chấm bằng v2): ' + withV2.length + ' · mode ' + JSON.stringify(withV2.reduce((m, l) => { const k = l.ai_v2.mode || '?'; m[k] = (m[k] || 0) + 1; return m; }, {})) + ' · vai: ' + JSON.stringify(withV2.reduce((m, l) => { const k = l.role || '-'; m[k] = (m[k] || 0) + 1; return m; }, {})) + ' · đăng hộ ' + withV2.filter(l => l.contact_via_poster).length);
if (!withV2.length) { console.log('Chưa có lead nào chấm bằng v2 (chờ lượt quét sau deploy E).'); process.exit(0); }
const brands = [...new Set(withV2.map(l => l.brand || '?'))];
const human = l => !!(ms(l.first_care_at) || ms(l.last_touch_at) || (l.stage && l.stage !== 'new'));
const responded = l => !!(l.outreach_replied || /^(responded|booked|closed)$/.test(String(l.stage || ''))); const booked = l => /^(booked|closed)$/.test(String(l.stage || '')); const closed = l => !!(l.closed_at || l.stage === 'closed');
const humanDrop = l => !!((l.dropped && !/rescore|lenh31b|ai|scanner|engine|worker|machine|system|sweep|auto/i.test(String(l.dropped_by || ''))) || l.lost);
const pct = (a, b) => b ? Math.round(a / b * 1000) / 10 + ' %' : '—';
for (const b of ['*', ...brands]) {
  const L = b === '*' ? withV2 : withV2.filter(l => (l.brand || '?') === b); if (!L.length) continue;
  console.log('\n-- ' + (b === '*' ? 'TẤT CẢ' : b) + ' (n ' + L.length + ') — ma trận nhiệt độ raw (hàng) × v2 (cột): hot / warm / cold / junk');
  for (const r of BANDS) { const row = L.filter(l => tempOf(Number(l.ai_v2.raw ?? l.score) || 0) === r); console.log('   raw ' + r.padEnd(5) + ' n ' + String(row.length).padStart(4) + ' → ' + BANDS.map(c => String(row.filter(l => tempOf(l.ai_v2.score) === c).length).padStart(4)).join(' ')); }
  const dd = L.map(l => (Number(l.ai_v2.raw ?? l.score) || 0) - l.ai_v2.score); const mean = dd.reduce((a, x) => a + x, 0) / dd.length; const abs = dd.map(Math.abs).reduce((a, x) => a + x, 0) / dd.length;
  console.log('   raw − v2: TB ' + (Math.round(mean * 10) / 10) + ' · |Δ| TB ' + (Math.round(abs * 10) / 10) + ' · v2 cao hơn raw ' + dd.filter(x => x < 0).length + ' · thấp hơn ' + dd.filter(x => x > 0).length + ' · conf TB ' + (Math.round(L.filter(l => l.ai_v2.conf !== null && l.ai_v2.conf !== undefined).reduce((a, l) => a + Number(l.ai_v2.conf), 0) / Math.max(1, L.filter(l => l.ai_v2.conf !== null && l.ai_v2.conf !== undefined).length) * 100) / 100));
  const C = L.filter(l => now - ms(l.detected_at) >= MIN_AGE * 864e5); if (!C.length) { console.log('   cohort ≥' + MIN_AGE + ' ngày: chưa có'); continue; }
  console.log('   KẾT QUẢ theo dải (cohort ≥' + MIN_AGE + ' ngày, n ' + C.length + '):  dải | n | sales chăm | phản hồi | hẹn | chốt | người loại');
  for (const mode of ['raw', 'v2']) { for (const band of BANDS) { const g = C.filter(l => tempOf(mode === 'raw' ? (Number(l.ai_v2.raw ?? l.score) || 0) : l.ai_v2.score) === band); if (!g.length) continue;
    console.log('   ' + mode.padEnd(3) + ' ' + band.padEnd(5) + ' | ' + String(g.length).padStart(4) + ' | ' + pct(g.filter(human).length, g.length).padStart(7) + ' | ' + pct(g.filter(responded).length, g.length).padStart(7) + ' | ' + pct(g.filter(booked).length, g.length).padStart(7) + ' | ' + pct(g.filter(closed).length, g.length).padStart(7) + ' | ' + pct(g.filter(humanDrop).length, g.length).padStart(7)); } }
  const hr = C.filter(l => tempOf(Number(l.ai_v2.raw ?? l.score) || 0) === 'hot'), hv = C.filter(l => tempOf(l.ai_v2.score) === 'hot');
  if (hr.length >= 10 && hv.length >= 10) { const sr = hr.filter(l => responded(l) || booked(l)).length / hr.length, sv = hv.filter(l => responded(l) || booked(l)).length / hv.length; const dr = hr.filter(humanDrop).length / hr.length, dv = hv.filter(humanDrop).length / hv.length;
    console.log('   ⇒ dải NÓNG: raw phản hồi/hẹn ' + pct(sr * hr.length, hr.length) + ' · loại ' + pct(dr * hr.length, hr.length) + ' | v2 phản hồi/hẹn ' + pct(sv * hv.length, hv.length) + ' · loại ' + pct(dv * hv.length, hv.length) + ' → ' + ((sv >= sr && dv <= dr) ? 'v2 KHÔNG kém → có thể bật scoreV2=on' : (sv < sr && dv > dr) ? 'v2 KÉM hơn → giữ shadow, xem lại trọng số' : 'lẫn lộn → chờ thêm mẫu')); }
  else console.log('   ⇒ dải nóng chưa đủ 10 mẫu mỗi cách → chờ thêm');
}
console.log('\nKHÔNG ghi gì. Bật v2 thật: web Chấm điểm AI → "Điểm theo tiêu chí" = Áp dụng (config/app.scoring.scoreV2 = "on"); tắt: "off"/"shadow". Lead cũ giữ điểm cũ; lead mới + sweeper chấm lại theo v2.');
process.exit(0);
