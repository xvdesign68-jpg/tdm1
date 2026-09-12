/* stats.js — v119-49 (nhóm 3 · P35): counter server-side `daily_stats/{brand}__{YYYY-MM-DD giờ VN}` cho Bảng brand (agency).
   Trigger onDocumentWritten leads/{id} → FieldValue.increment (an toàn ghi đồng thời từ nhiều nguồn, không đọc-rồi-ghi).
   Field: new (lead hợp lệ, không junk) · hot/warm/cold/junk · contacted (first_care_at lần đầu) · careN/careMinSum/careLe15/30/60/120
          · responded/booked/closed/lost/dropped (chuyển trạng thái LẦN ĐẦU) · deal (Σ deal_value khi chốt / chỉnh sau) · atMs.
   Khởi tạo Admin SDK LƯỜI trong handler (bài học LỆNH #10: initializeApp top-level làm Firebase CLI không phân tích được codebase).
   Xoá lead: KHÔNG trừ (số quá khứ giữ nguyên) — cần đối soát thì chạy lại backfill (_stats_backfill.mjs). */
import { onDocumentWritten } from '<che>';
import { initializeApp, getApps } from 'firebase-admin/app';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';

const REGION = 'asia-southeast1', OFF = 7 * 3600e3;
export const vnDay = ms => new Date((Number(ms) || Date.now()) + OFF).toISOString().slice(0, 10);
export const toMs = v => { if (!v) return 0; if (typeof v === 'number') return v; if (typeof v.toMillis === 'function') return v.toMillis(); if (v.seconds) return v.seconds * 1000; const d = new Date(v); return isNaN(d) ? 0 : d.getTime(); };
export const tempOf = l => { const t = l && l.temp; if (t === 'hot' || t === 'warm' || t === 'cold' || t === 'junk') return t; const s = Number(l && l.score) || 0; return s >= 80 ? 'hot' : s >= 60 ? 'warm' : s >= 40 ? 'cold' : 'junk'; };
const RESP = new Set(['responded', 'booked', 'closed']), BOOK = new Set(['booked', 'closed']);
/* LENH #36 (06/09/2026) — HIỆU QUẢ NỘI DUNG: counter cộng dồn content_stats/{brand} = { brandCode, atMs, all:{sent,rep,tagged}, <dim>:{<khoá>:{sent,rep}} }
   dim = mode/style/parent/cta/variant (khớp CS_META_VI ở FE 45-outreach). Khoá làm sạch: variant → v0..v5 (vx = -1/không xoay), rỗng → none, ký tự lạ → _.
   sent = lead có outreach.inbox_at (đếm lần đầu xuất hiện) · rep = lead ĐÃ inbox rồi có phản hồi (đếm 1 lần) · tagged = lead có content meta (lần đầu).
   Hàm thuần (không I/O) → backfill (_cs_backfill.mjs, before=null) dùng chung. FE: csEffFromCounters đổi ngược khoá → nhãn. */
const C_DIMS = ['mode', 'style', 'parent', 'cta', 'variant'];
export const contentKey = (dim, v) => { if (dim === 'variant') { const n = Number(v); return Number.isFinite(n) && n >= 0 ? 'v' + Math.min(9, Math.floor(n)) : 'vx'; } const k = String(v == null ? '' : v).replace(/[^A-Za-z0-9_-]/g, '_').slice(0, 24); return k || 'none'; };
const isRep = l => !!(l && (l.outreach_replied || (l.outreach && l.outreach.replied_at) || RESP.has(String(l.stage || ''))));
export function contentEvents(before, after) {
  const b = before || {}; const ao = (after && after.outreach) || {}; const bo = b.outreach || {};
  const meta = ao.content; if (!meta || typeof meta !== 'object' || Array.isArray(meta)) return null;
  const inc = {};
  if (!(bo.content && typeof bo.content === 'object' && !Array.isArray(bo.content))) inc.tagged = 1;
  const sentNow = !!ao.inbox_at, sentBefore = !!bo.inbox_at;
  if (sentNow && !sentBefore) inc.sent = 1;
  if (sentNow && isRep(after) && !(sentBefore && isRep(b))) inc.rep = 1;
  return Object.keys(inc).length ? { inc, meta } : null;
}
export function contentPatch(brand, ev) {
  const p = { brandCode: brand, atMs: Date.now(), all: {} };
  Object.keys(ev.inc).forEach(k => { p.all[k] = FieldValue.increment(ev.inc[k]); });
  C_DIMS.forEach(d => { const o = {}; ['sent', 'rep'].forEach(f => { if (ev.inc[f]) o[f] = FieldValue.increment(ev.inc[f]); }); if (Object.keys(o).length) p[d] = { [contentKey(d, ev.meta[d])]: o }; });
  return p;
}
/* LENH #40 (08/09/2026) — SLA theo ngưỡng riêng brand, cohort ngày phát hiện: slaN/slaOk ghi lên doc NGÀY PHÁT HIỆN. FE 25-agency v119-80 ưu tiên khi slaN > 0. */
export function slaInc(inc, fc, det, bad) { if (det && fc >= det) { const min = (fc - det) / 60000; if (min < 30 * 1440) { inc.slaN = (inc.slaN || 0) + 1; if (min <= (Number(bad) > 0 ? Number(bad) : 60)) inc.slaOk = (inc.slaOk || 0) + 1; } } }
const _slaCache = new Map(); let _cfgBad = { v: 0, t: 0 };
/* Ngưỡng quá hạn của brand (phút): brands/{code}.slaBadMin > config/app.slaBadMin > 60. Chỉ đọc khi CÓ sự kiện chăm lần đầu (đa số write không đọc gì); cache 5'. Lỗi đọc → 60. */
export async function slaBadOf(brand, before, after) {
  const fc = toMs(after && after.first_care_at); if (!fc || (before && toMs(before.first_care_at))) return 60;
  try { if (!getApps().length) initializeApp(); const db = getFirestore(); const now = Date.now();
    let c = _slaCache.get(brand); if (!c || now - c.t > 300e3) { const d = await db.collection('brands').doc(brand).get(); const v = d.exists ? Number((d.data() || {}).slaBadMin) : 0; c = { v: v > 0 ? Math.round(v) : 0, t: now }; _slaCache.set(brand, c); }
    if (c.v > 0) return c.v;
    if (now - _cfgBad.t > 300e3) { const a = await db.collection('config').doc('app').get(); const v = a.exists ? Number((a.data() || {}).slaBadMin) : 0; _cfgBad = { v: v > 0 ? Math.round(v) : 0, t: now }; }
    return _cfgBad.v > 0 ? _cfgBad.v : 60;
  } catch (e) { return 60; }
}
function careInc(inc, fc, det) {
  inc.contacted = (inc.contacted || 0) + 1;
  if (det && fc >= det) { const min = (fc - det) / 60000; if (min < 30 * 1440) { inc.careN = (inc.careN || 0) + 1; inc.careMinSum = (inc.careMinSum || 0) + Math.round(min * 10) / 10;
    if (min <= 15) inc.careLe15 = (inc.careLe15 || 0) + 1; if (min <= 30) inc.careLe30 = (inc.careLe30 || 0) + 1; if (min <= 60) inc.careLe60 = (inc.careLe60 || 0) + 1; if (min <= 120) inc.careLe120 = (inc.careLe120 || 0) + 1; } }
}
/* Sự kiện thống kê giữa 2 bản lead → [{day, inc}]. Thuần (không I/O) — dùng cho cả trigger (before/after) lẫn backfill (before=null, after=lead hiện tại:
   mọi mốc lấy từ field đã lưu detected_at/first_care_at/stage_at/closed_at/lost_at/dropped_at → xấp xỉ hợp lý). */
export function statsEvents(before, after, nowMs, opts) { // LENH #40: opts.slaBad = ngưỡng brand (phút)
  const out = []; const push = (day, inc) => { if (Object.keys(inc).length) out.push({ day, inc }); };
  const now = nowMs || Date.now(); const b = before || {}; const det = toMs(after.detected_at);
  /* LENH #41 (09/09/2026): "lead mới" = lần ĐẦU doc đủ điều kiện đếm (có brand + có temp/score) — trước chỉ đếm khi before==null nên lead ghi 2 bước
     (tạo doc rồi mới gán brand/chấm điểm) không bao giờ vào new/hot; doc chưa có điểm cũng không bị tính junk oan. Tạo 1 bước đủ dữ liệu: hành vi y như cũ. */
  /* LENH #42 (09/09/2026): người bán / chủ bài / tự bình luận dưới bài mình KHÔNG phải lead hợp lệ → không cộng new/hot; đã đếm rồi mới bị gắn vai → trừ lại đúng ngày phát hiện. */
  const roleBad = l => !!(l && (/^(seller|poster_self)$/.test(String(l.role || '')) || l.self_comment === true));
  const countable = l => !!(l && String(l.brand || '').trim() && (l.temp != null || l.score != null) && !roleBad(l));
  if (countable(after) && !countable(before)) { const inc = {}; const t = tempOf(after); if (t === 'junk') inc.junk = 1; else { inc.new = 1; inc[t] = 1; } push(vnDay(det || now), inc); }
  else if (!countable(after) && countable(before)) { const t = tempOf(before); const dB = toMs(before.detected_at) || det || now; if (t === 'junk') push(vnDay(dB), { junk: -1 }); else push(vnDay(dB), { new: -1, [t]: -1 }); }
  const fc = toMs(after.first_care_at);
  if (fc && !toMs(b.first_care_at)) { const inc = {}; careInc(inc, fc, det); push(vnDay(fc), inc); if (tempOf(after) !== 'junk') { const sl = {}; slaInc(sl, fc, det, opts && opts.slaBad); push(vnDay(det || fc), sl); } } // LENH #40: slaN/slaOk theo NGÀY PHÁT HIỆN
  const st = String(after.stage || ''), bst = String(b.stage || ''); const stAt = toMs(after.stage_at) || now;
  if (RESP.has(st) && !RESP.has(bst)) push(vnDay(stAt), { responded: 1 });
  if (BOOK.has(st) && !BOOK.has(bst)) push(vnDay(stAt), { booked: 1 });
  if (st === 'closed' && bst !== 'closed') { const inc = { closed: 1 }; const dv = Number(after.deal_value) || 0; if (dv > 0) inc.deal = dv; push(vnDay(toMs(after.closed_at) || stAt), inc); }
  else if (st === 'closed' && bst === 'closed') { const d = (Number(after.deal_value) || 0) - (Number(b.deal_value) || 0); if (d) push(vnDay(now), { deal: d }); }
  if (after.lost && !b.lost) push(vnDay(toMs(after.lost_at) || now), { lost: 1 });
  if (after.dropped && !b.dropped) push(vnDay(toMs(after.dropped_at) || now), { dropped: 1 });
  return out;
}
/* LENH #44 (11/09/2026) — R-1: NGƯỜI THẬT vào lead (chăm / liên hệ / đổi giai đoạn / chốt / không thành / loại) → tắt phễu máy đang chạy (step 'human')
   + huỷ task đang xếp hàng + hoàn van CÙNG NGÀY (clamp ≥ 0) + log. Máy tự ghi (stage responded kèm outreach_replied — funcWebhook/worker) KHÔNG tính là người thật.
   Hàm thuần humanTookOver(before, after) → harness dùng chung. Ghi chú (notes) không nằm trên doc lead nên không kích ở đây. */
export function humanTookOver(before, after) {
  const b = before, a = after || {}; if (!b) return '';
  if (toMs(a.first_care_at) && !toMs(b.first_care_at)) return 'sales đã chăm lead';
  if (toMs(a.last_touch_at) && toMs(a.last_touch_at) !== toMs(b.last_touch_at)) return 'sales vừa liên hệ';
  if (a.closed_at && !b.closed_at) return 'đã chốt'; if (a.lost && !b.lost) return 'không thành'; if (a.dropped && !b.dropped) return 'đã loại';
  const st = String(a.stage || ''), bst = String(b.stage || '');
  const byMachine = (!!a.outreach_replied && !b.outreach_replied) || (!!toMs(a.outreach_replied_at) && !toMs(b.outreach_replied_at));
  if (st !== bst && st && st !== 'new' && !byMachine) return 'đổi giai đoạn → ' + st;
  return '';
}
const KIND44 = { react: 'react', comment: 'comment', add_friend: 'friend', inbox: 'inbox' };
export async function stopMachine(db, leadId, why) {
  const id = String(leadId || ''); if (!id) return false;
  const tref = db.collection('outreach_threads').doc(id); const ts = await tref.get(); if (!ts.exists) return false; const t = ts.data() || {}; if (t.active !== true) return false;
  const now = Date.now();
  await tref.set({ active: false, step: 'human', taskStatus: 'cancelled', stoppedAt: now, stopReason: String(why || '').slice(0, 120) }, { merge: true });
  const taskRef = db.collection('outreach_tasks').doc(id + '__funnel');
  await db.runTransaction(async tx => { const s = await tx.get(taskRef); if (s.exists && s.data().status === 'queued') tx.set(taskRef, { status: 'cancelled', cancelledAt: now, cancelReason: why }, { merge: true }); }).catch(() => {});
  const day = vnDay(now); const rd = t.reservedDay ? String(t.reservedDay) : (toMs(t.createdAt) ? vnDay(toMs(t.createdAt)) : '');
  if (t.pid && rd === day && t.fpayload && Array.isArray(t.fpayload.steps)) {
    const done = new Set(Array.isArray(t.doneSteps) ? t.doneSteps : []); const kinds = t.fpayload.steps.filter(s => KIND44[s] && !done.has(s)).map(s => KIND44[s]);
    if (kinds.length) { const uref = db.collection('outreach_usage').doc(t.pid + '__' + day); await db.runTransaction(async tx => { const s = await tx.get(uref); if (!s.exists) return; const d = s.data() || {}; const p = {}; kinds.forEach(k => { p[k] = Math.max(0, (Number(d[k]) || 0) - 1); }); tx.set(uref, p, { merge: true }); }).catch(() => {}); }
  }
  await db.collection('outreach_log').add({ leadId: id, name: t.name || '', brand: t.brandName || t.brandCode || t.brand || '', brandCode: t.brandCode || t.brand || '', temp: t.temp || '', score: t.score || 0, pid: t.pid || '', action: '🙋 Người thật đã tiếp quản — dừng phễu tự động', text: String(why || ''), status: 'skip', at: FieldValue.serverTimestamp(), expireAt: new Date(now + 60 * 86400000) }).catch(() => {});
  return true;
}
export const statsOnLead = onDocumentWritten({ document: 'leads/{id}', region: REGION, memory: '256MiB', maxInstances: 10 }, async (ev) => {
  const after = ev.data && ev.data.after && ev.data.after.exists ? ev.data.after.data() : null;
  if (!after) return;
  const before = ev.data.before && ev.data.before.exists ? ev.data.before.data() : null;
  const brand = String(after.brand || '').trim(); if (!brand) return;
  const hum44 = humanTookOver(before, after); // LENH #44 (R-1)
  if (hum44) { try { if (!getApps().length) initializeApp(); await stopMachine(getFirestore(), (ev.params && ev.params.id) || (ev.data.after && ev.data.after.id) || '', hum44); } catch (e) { console.error('[LENH44] stopMachine', e && e.message); } }
  const slaBad = await slaBadOf(brand, before, after); // LENH #40
  const evs = statsEvents(before, after, Date.now(), { slaBad }); const cev = contentEvents(before, after); if (!evs.length && !cev) return; // LENH #36: + hiệu quả nội dung
  if (!getApps().length) initializeApp(); const db = getFirestore();
  const byDay = {}; evs.forEach(e => { const o = byDay[e.day] || (byDay[e.day] = {}); Object.keys(e.inc).forEach(k => { o[k] = (o[k] || 0) + e.inc[k]; }); });
  await Promise.all(Object.keys(byDay).map(day => { const patch = { brandCode: brand, day, atMs: Date.now() }; Object.keys(byDay[day]).forEach(k => { patch[k] = FieldValue.increment(byDay[day][k]); });
    return db.collection('daily_stats').doc(brand + '__' + day).set(patch, { merge: true }); }));
  if (cev) await db.collection('content_stats').doc(brand).set(contentPatch(brand, cev), { merge: true }); // LENH #36: set-merge + increment lồng → an toàn ghi đồng thời
});
