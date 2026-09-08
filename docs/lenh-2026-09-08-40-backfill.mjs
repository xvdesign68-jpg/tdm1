/* _l40_backfill.mjs — dựng lại slaN/slaOk (SLA đạt theo ngưỡng riêng brand, cohort NGÀY PHÁT HIỆN) cho daily_stats N ngày gần nhất từ leads.
   Ghi TUYỆT ĐỐI 2 field (set merge) — các field khác của doc giữ nguyên. Chạy sau khi deploy statsOnLead bản LỆNH #40; chạy lại bao nhiêu lần cũng ra cùng số.
   Dùng: node _l40_backfill.mjs [--dry] [--days=60]   (đặt trong ~/firebase-s13/functions, cạnh stats.js) */
import { vnDay, toMs, tempOf } from './stats.js';
const OFF = 7 * 3600e3;
/* Hàm THUẦN (harness dùng chung): leads → {brand__day: {brandCode, day, slaN, slaOk}} cho ngày >= from. badOf(brand) → phút. Lead rác bỏ qua (mẫu số `new` không tính rác). */
export function slaAgg(leads, badOf, from) {
  const agg = {};
  (leads || []).forEach(l => { const brand = String((l && l.brand) || '').trim(); if (!brand || tempOf(l) === 'junk') return;
    const det = toMs(l.detected_at); if (!det) return; const day = vnDay(det); if (day < from) return;
    const k = brand + '__' + day; const o = agg[k] || (agg[k] = { brandCode: brand, day, slaN: 0, slaOk: 0 });
    const fc = toMs(l.first_care_at); if (fc && fc >= det) { const min = (fc - det) / 60000; if (min < 30 * 1440) { o.slaN++; if (min <= badOf(brand)) o.slaOk++; } } });
  return agg;
}
export function badOfFactory(brandDocs, cfgApp) { const m = new Map(); (brandDocs || []).forEach(b => { const v = Number(b && b.slaBadMin); if (v > 0) m.set(String(b.code || b.id || ''), Math.round(v)); }); const g = Number(cfgApp && cfgApp.slaBadMin); const def = g > 0 ? Math.round(g) : 60; return brand => m.get(brand) || def; }

const isMain = process.argv[1] && /_l40_backfill\.mjs$/.test(process.argv[1]);
if (isMain) {
  const { initializeApp, applicationDefault } = await import('firebase-admin/app'); const { getFirestore } = await import('firebase-admin/firestore');
  const DRY = process.argv.includes('--dry'); const dArg = process.argv.find(a => a.startsWith('--days=')); const DAYS = dArg ? Math.max(1, Number(dArg.slice(7)) || 60) : 60;
  initializeApp({ credential: applicationDefault(), projectId: 'smartlead-z15' }); const db = getFirestore();
  const from = vnDay(Date.now() - (DAYS - 1) * 864e5), NOW = Date.now();
  const bs = await db.collection('brands').get(); const brandDocs = bs.docs.map(d => Object.assign({ id: d.id }, d.data()));
  const cfg = await db.collection('config').doc('app').get(); const badOf = badOfFactory(brandDocs, cfg.exists ? cfg.data() : {});
  const leads = []; let last = null, scanned = 0;
  for (;;) { let q = db.collection('leads').orderBy('__name__').select('brand', 'temp', 'score', 'detected_at', 'first_care_at').limit(500); if (last) q = q.startAfter(last); const snap = await q.get(); if (snap.empty) break;
    snap.docs.forEach(d => { scanned++; leads.push(d.data() || {}); }); last = snap.docs[snap.docs.length - 1]; if (snap.size < 500) break; }
  const agg = slaAgg(leads, badOf, from); const keys = Object.keys(agg).sort();
  const perBrand = {}; keys.forEach(k => { const o = agg[k]; const p = perBrand[o.brandCode] || (perBrand[o.brandCode] = { days: 0, slaN: 0, slaOk: 0, bad: badOf(o.brandCode) }); p.days++; p.slaN += o.slaN; p.slaOk += o.slaOk; });
  console.log((DRY ? '[DRY] ' : '') + 'backfill slaN/slaOk: quét ' + scanned + ' lead → ' + keys.length + ' doc daily_stats từ ' + from + ' (' + DAYS + ' ngày)');
  Object.keys(perBrand).sort().forEach(b => { const p = perBrand[b]; console.log('  ' + b + ': ngưỡng ' + p.bad + '′ · ' + p.days + ' ngày · đã chăm ' + p.slaN + ' · đạt ' + p.slaOk + (p.slaN ? ' (' + Math.round(p.slaOk / p.slaN * 100) + '% trên lead đã chăm)' : '')); });
  if (DRY) { console.log('DRY: không ghi. Chạy lại không --dry để ghi.'); process.exit(0); }
  let batch = db.batch(), n = 0, w = 0; const flush = async () => { if (n) { await batch.commit(); batch = db.batch(); n = 0; } };
  for (const k of keys) { const o = agg[k]; batch.set(db.collection('daily_stats').doc(k), { brandCode: o.brandCode, day: o.day, slaN: o.slaN, slaOk: o.slaOk, atMs: NOW }, { merge: true }); n++; w++; if (n >= 400) await flush(); }
  await flush(); console.log('ĐÃ GHI ' + w + ' doc daily_stats (slaN/slaOk tuyệt đối, field khác giữ nguyên)');
}
