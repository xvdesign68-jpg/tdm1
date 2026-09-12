/* LỆNH C (13/09/2026) — PB-10 push "brand xuất hiện" · PB-6 bộ đếm trừ khi MÁY loại/đổi nhiệt · source_health [SCAN-NO-LEAD] · backfill_done theo brand.
   3 file trong ~/firebase-s13/functions, marker `LENH C`, content-anchored theo MÃ ĐANG CHẠY sau LỆNH B (fixture docs/lenh-2026-09-12-b-fixture + patch B; push.js = fixture #46 + patch #46),
   FAIL-CLOSED NGUYÊN TỬ (đủ mốc CẢ 3 file mới ghi), idempotent (file đã có marker → bỏ qua; 1 file có marker + file khác không → LỆCH, dừng).
   Dùng: node _lc_patch.cjs stats.js push.js index.js   ·   node _lc_patch.cjs --anchors → JSON mốc (harness đối chiếu).
   (1) stats.js  machineDroppedC + MACHINE_BY (dropped_by rescore/rescore_role/lenh31b/scanner/engine/worker/ai…) → countable loại lead máy đã loại (trừ new/<temp> đúng ngày phát hiện);
                 máy ĐỔI nhiệt độ (AI chấm lại) → chuyển bucket cùng ngày; dropped của máy → aiDropped (dropped giữ cho người). Sales bấm Loại: GIỮ như cũ (anh chốt câu 1).
   (2) push.js   hotGateC(before, after) thuần: push "Lead nóng mới" đúng 1 lần khi brand/brand_hint XUẤT HIỆN (lead ghi 2 bước) hoặc AI chấm lại điểm tạm → nóng; bỏ dropped/lost/vai người bán/chủ bài;
                 người nhận theo brand || brand_hint.
   (3) index.js  bfKey(url, brand) (đọc cả khoá cũ, ghi khoá mới có brand) · cuối lượt ghi source_health/{source_id} (days.<ngày>.posts/leads/hot/err, lastPostAt, lastLeadAt, errStreak)
                 · nhịp việc phụ: healthEvalC (thuần) → dọn ngày cũ, cảnh báo WARNING [SCAN-NO-LEAD] (≤1 lần/6 h/nguồn), ERROR [SCAN-HEALTH] khi ≥3 nguồn & ≥½ nguồn bật có vấn đề, system_status/scan.health. */
const fs = require('fs');
const ANCH = { stats: {}, push: {}, index: {} };
const A = (g, k, s) => { ANCH[g][k] = s; return s; };

/* ================= (1) stats.js ================= */
const ST1 = A('stats', 'ST1 tempOf', "export const tempOf = l => {");
const ST1_NEW = `/* LENH C (13/09/2026) — PB-6: lead do MÁY loại (AI chấm lại / cổng vai / sweeper) KHÔNG còn là lead hợp lệ → trừ bộ đếm đúng ngày phát hiện (anh chốt câu 1 12/09);
   sales bấm Loại (dropped_by = uid/email người) GIỮ như cũ. Nhận diện theo dropped_by. Dùng chung với _lc_recount.mjs. */
export const MACHINE_BY = /^(rescore|rescore_role|lenh31b|ai|scanner|engine|worker|machine|system|sweep|auto)(:[\\w-]+)?$/i; /* token máy CHÍNH XÁC (tuỳ chọn hậu tố :x) — email/uid người (có @ hoặc dài) không bao giờ khớp */
export const machineDroppedC = l => !!(l && l.dropped === true && MACHINE_BY.test(String(l.dropped_by || '')));
` + ST1;
const ST2 = A('stats', 'ST2 countable', "  const countable = l => !!(l && String(l.brand || '').trim() && (l.temp != null || l.score != null) && !roleBad(l));");
const ST2_NEW = "  const countable = l => !!(l && String(l.brand || '').trim() && (l.temp != null || l.score != null) && !roleBad(l) && !machineDroppedC(l)); /* LENH C (PB-6): máy loại → không đếm */";
const ST3 = A('stats', 'ST3 else-if uncountable', "  else if (!countable(after) && countable(before)) { const t = tempOf(before); const dB = toMs(before.detected_at) || det || now; if (t === 'junk') push(vnDay(dB), { junk: -1 }); else push(vnDay(dB), { new: -1, [t]: -1 }); }");
const ST3_NEW = ST3 + `
  else if (countable(after) && countable(before) && tempOf(after) !== tempOf(before)) { /* LENH C (PB-6): MÁY đổi nhiệt độ (AI chấm lại hạ/nâng) → chuyển bucket cùng ngày phát hiện; sales không đổi được temp */
    const tA = tempOf(after), tB = tempOf(before); const dB = toMs(before.detected_at) || det || now; const inc = {};
    if (tB === 'junk') inc.junk = (inc.junk || 0) - 1; else { inc.new = (inc.new || 0) - 1; inc[tB] = (inc[tB] || 0) - 1; }
    if (tA === 'junk') inc.junk = (inc.junk || 0) + 1; else { inc.new = (inc.new || 0) + 1; inc[tA] = (inc[tA] || 0) + 1; }
    Object.keys(inc).forEach(k => { if (!inc[k]) delete inc[k]; }); push(vnDay(dB), inc); }`;
const ST4 = A('stats', 'ST4 dropped', "  if (after.dropped && !b.dropped) push(vnDay(toMs(after.dropped_at) || now), { dropped: 1 });");
const ST4_NEW = "  if (after.dropped && !b.dropped) push(vnDay(toMs(after.dropped_at) || now), { [machineDroppedC(after) ? 'aiDropped' : 'dropped']: 1 }); /* LENH C (PB-6): máy loại → aiDropped, người loại → dropped */";

/* ================= (2) push.js ================= */
const PU1 = A('push', 'PU1 brand', "  const id = ev.params.id, name = after.name || 'Lead', brand = after.brand || '';");
const PU1_NEW = "  const id = ev.params.id, name = after.name || 'Lead', brand = String(after.brand || after.brand_hint || '').trim(); /* LENH C (PB-10): lead ghi 2 bước → brand_hint có trước brand */";
const PU2 = A('push', 'PU2 hot if', "  if (((!before && after.ai_scored !== false) || (before && before.ai_scored === false && after.ai_scored === true && !after.dropped)) && after.temp === 'hot') { // LENH #46: không push lead dự phòng (điểm tạm); AI chấm lại thành nóng → push");
const PU2_NEW = "  const whyC = hotGateC(before, after); if (whyC) { /* LENH C (PB-10): thay điều kiện #46 bằng hotGateC (brand/brand_hint xuất hiện · AI chấm lại điểm tạm → nóng) */";
const PU3 = A('push', 'PU3 hot log', "    console.log('push hot', id, 'sent', n);");
const PU3_NEW = "    console.log('push hot', id, whyC, 'sent', n); /* LENH C */";
const PU4 = A('push', 'PU4 export pushOnLead', "export const pushOnLead = onDocumentWritten(");
const PU4_NEW = `/* LENH C (13/09/2026) — PB-10: lead ghi 2 bước (tạo doc có brand_hint/không brand → gán brand) → "Lead nóng mới" push ĐÚNG 1 LẦN khi brand hoặc brand_hint XUẤT HIỆN
   (before không có, after có), hoặc AI chấm lại lead điểm tạm thành nóng (#46). Bỏ lead đã loại / không thành / vai người bán / chủ bài / điểm tạm. Hàm thuần → harness. */
export function hotGateC(before, after) {
  if (!after || after.temp !== 'hot' || after.ai_scored === false || after.dropped || after.lost) return '';
  if (/^(seller|poster_self)$/.test(String(after.role || '')) || after.self_comment === true) return '';
  const brandOf = l => String((l && (l.brand || l.brand_hint)) || '').trim();
  if (!brandOf(after)) return '';
  if (!before) return 'new';
  if (!brandOf(before)) return 'tagged';
  if (before.ai_scored === false && after.ai_scored === true) return 'rescored';
  return '';
}
` + PU4;

/* ================= (3) index.js ================= */
const IX1 = A('index', 'IX1 bfKey', "  const bfKey = (url) => ('bf_' + String(url || '') + '|' + (opts.startDate || '') + '|' + (opts.endDate || '')).replace(/[^\\w-]/g, '_').slice(0, 480);");
const IX1_NEW = "  const bfKey = (url, brand) => ('bf_' + String(url || '') + '|' + (opts.startDate || '') + '|' + (opts.endDate || '') + (brand ? '|' + String(brand) : '')).replace(/[^\\w-]/g, '_').slice(0, 480); /* LENH C: khoá theo brand (group dùng chung: brand khác vẫn backfill được); đọc cả khoá cũ không brand */";
const IX2 = A('index', 'IX2 bf get', "const bd = await db.collection('backfill_done').doc(bfKey(src.url)).get(); if (bd.exists) {");
const IX2_NEW = "const bd0 = await db.collection('backfill_done').doc(bfKey(src.url, src.brand)).get(); const bd = bd0.exists ? bd0 : await db.collection('backfill_done').doc(bfKey(src.url)).get(); if (bd.exists) { /* LENH C */";
const IX3 = A('index', 'IX3 bf set', "await db.collection('backfill_done').doc(bfKey(src.url)).set({ url: src.url || '',");
const IX3_NEW = "await db.collection('backfill_done').doc(bfKey(src.url, src.brand)).set({ url: src.url || '', brand: String(src.brand || ''), /* LENH C */";
const IX4 = A('index', 'IX4 summary.range', "  if (range) summary.range = range;\n  let scanId = null;");
const IX4_NEW = `  if (range) summary.range = range;
  /* LENH C (13/09/2026) — source_health: sức khoẻ TỪNG NGUỒN cộng dồn theo ngày (giữ 7 ngày) từ bySource của lượt này: bài/lead/nóng/lỗi BrightData + lastPostAt/lastLeadAt/errStreak.
     Chỉ ghi dòng có hoạt động hoặc lỗi trigger (thường vài dòng/lượt, ≤ số nguồn). Đánh giá + cảnh báo [SCAN-NO-LEAD] ở nhịp việc phụ (healthEvalC). Lỗi ghi chỉ log, không đụng luồng chính. */
  const errIdsC = bySource.filter(r => r.bd === 'err' && r.source_id).map(r => String(r.source_id)); const prevErrC = new Set(((stScanB && stScanB.healthErrIds) || []).map(String));
  try { const dayC = new Date(Date.now() + 7 * 3600e3).toISOString().slice(0, 10); const bw = db.batch(); let nW = 0;
    for (const r of bySource) { const sid = String(r.source_id || ''); if (!sid) continue; const isErr = r.bd === 'err'; const act = (r.posts || 0) > 0 || (r.leads || 0) > 0 || isErr || (r.bd === 'ok' && prevErrC.has(sid)); if (!act) continue; /* nguồn vừa lỗi lượt trước mà lượt này BrightData OK → ghi để errStreak về 0 */
      const patch = { name: r.name || '', brand: r.brand || '', gid: String(r.gid || ''), url: r.url || '', updatedAt: Date.now(), days: { [dayC]: { posts: FieldValue.increment(r.posts || 0), leads: FieldValue.increment(r.leads || 0), hot: FieldValue.increment(r.hot || 0), err: FieldValue.increment(isErr ? 1 : 0) } } };
      if ((r.posts || 0) > 0) patch.lastPostAt = Date.now(); if ((r.leads || 0) > 0) patch.lastLeadAt = Date.now();
      if (isErr) { patch.errStreak = FieldValue.increment(1); patch.lastError = String(r.error || '').slice(0, 160); } else { patch.errStreak = 0; }
      bw.set(db.collection('source_health').doc(sid), patch, { merge: true }); nW++; if (nW >= 400) break; }
    if (nW) await bw.commit(); } catch (e) { console.warn('[LENH C] source_health:', e && e.message); }
  let scanId = null;`;
const IX5 = A('index', 'IX5 zalo catch', "  } catch (e) { console.warn('[zaloCheck] v89 quet-vet loi: ' + (e && e.message)); }");
const IX5_NEW = IX5 + `
  if (hkDueB) try { /* LENH C (13/09/2026) — source_health: đánh giá + cảnh báo theo nhịp việc phụ (5′), không đụng luồng chính */
    const hsC = await db.collection('source_health').get(); const actC = new Map((sources || []).map(s => [String(s.__id || ''), s]));
    const evC = healthEvalC(hsC.docs.map(d => Object.assign({ id: d.id }, d.data() || {})), actC, Date.now());
    if (evC.updates.length) { const bwC = db.batch(); let nC = 0; for (const u of evC.updates) { bwC.set(db.collection('source_health').doc(u.id), u.patch, { merge: true }); nC++; if (nC >= 400) break; } await bwC.commit(); }
    for (const w of evC.warn) console.log(JSON.stringify({ severity: 'WARNING', message: '[SCAN-NO-LEAD] ' + w }));
    if (evC.error) console.log(JSON.stringify({ severity: 'ERROR', message: '[SCAN-HEALTH] ' + evC.error }));
    await db.collection('system_status').doc('scan').set({ health: { at: Date.now(), n: evC.bad.length, active: evC.active, bad: evC.bad.slice(0, 30) } }, { merge: true });
  } catch (e) { console.warn('[LENH C] healthEval:', e && e.message); }`;
const IX7 = A('index', 'IX7 system_status done', "sown: sownB, harvested: harvestedB, dupLead: dupLeadB }, hkDueB ? { lastHousekeepingAt: Date.now() } : {}), { merge: true }); } catch (_) {}");
const IX7_NEW = "sown: sownB, harvested: harvestedB, dupLead: dupLeadB, healthErrIds: errIdsC /* LENH C */ }, hkDueB ? { lastHousekeepingAt: Date.now() } : {}), { merge: true }); } catch (_) {}";
const IX6 = A('index', 'IX6 scanAllB0', "async function scanAllB0(trigger = 'scheduled', opts = {}) { /* LENH B: thân lượt quét (khoá lượt ở scanAll) */");
const IX6_NEW = `/* LENH C (13/09/2026) — hàm THUẦN đánh giá sức khoẻ nguồn (harness dùng chung): docs source_health + Map(source_id → nguồn đang bật) → { updates:[{id,patch}] (dọn ngày >7, alertedAt), warn:[], bad:[], error:'', active }.
   Nguồn CÓ VẤN ĐỀ khi đang bật và: noLead (≥15 bài/7 ngày mà 0 lead) · silent (có bài trước đây nhưng >48 h không bài mới) · err (BrightData trigger lỗi ≥6 lượt liên tiếp).
   Cảnh báo WARNING mỗi nguồn ≤1 lần/6 h (alertedAt); ERROR [SCAN-HEALTH] (alert #9) khi ≥3 nguồn và ≥½ nguồn bật có vấn đề. Nguồn tắt: chỉ dọn ngày cũ. */
export function healthEvalC(docs, actSrc, now) {
  const dayOf = ms => new Date(ms + 7 * 3600e3).toISOString().slice(0, 10); const keep = new Set(); for (let i = 0; i < 7; i++) keep.add(dayOf(now - i * 864e5));
  const num = v => Number(v) || 0; const out = { updates: [], warn: [], bad: [], error: '', active: 0 };
  for (const d of docs || []) {
    const patch = {}; let dirty = false; const days = (d && d.days) || {}; let p7 = 0, l7 = 0;
    for (const k of Object.keys(days)) { if (!keep.has(k)) { patch['days.' + k] = FieldValue.delete(); dirty = true; continue; } const x = days[k] || {}; p7 += num(x.posts); l7 += num(x.leads); }
    const src = actSrc && actSrc.get ? actSrc.get(String(d.id)) : null; const on = !!(src && src.active !== false);
    if (on) { out.active++; const why = [];
      if (p7 >= 15 && l7 === 0) why.push(p7 + ' bài/7 ngày nhưng 0 lead');
      if (num(d.lastPostAt) && now - num(d.lastPostAt) > 48 * 3600e3) why.push('không có bài mới ' + Math.round((now - num(d.lastPostAt)) / 3600e3) + ' h');
      if (num(d.errStreak) >= 6) why.push('BrightData lỗi ' + num(d.errStreak) + ' lượt liên tiếp' + (d.lastError ? ' (' + String(d.lastError).slice(0, 80) + ')' : ''));
      if (why.length) { const label = (d.name || d.id) + (d.brand ? ' [' + d.brand + ']' : ''); out.bad.push({ id: String(d.id), name: d.name || '', brand: d.brand || '', why: why.join(' · '), p7, l7 });
        if (now - num(d.alertedAt) > 6 * 3600e3) { out.warn.push(label + ': ' + why.join(' · ')); patch.alertedAt = now; dirty = true; } }
      else if (num(d.alertedAt)) { patch.alertedAt = 0; dirty = true; } }
    if (dirty) out.updates.push({ id: String(d.id), patch });
  }
  if (out.bad.length >= 3 && out.bad.length * 2 >= out.active) out.error = out.bad.length + '/' + out.active + ' nguồn đang bật có vấn đề: ' + out.bad.slice(0, 5).map(b => b.name || b.id).join(', ');
  return out;
}
` + IX6;

const PLAN = {
  'stats.js': { marker: 'LENH C', reps: [[ST1, ST1_NEW], [ST2, ST2_NEW], [ST3, ST3_NEW], [ST4, ST4_NEW]] },
  'push.js': { marker: 'LENH C', reps: [[PU1, PU1_NEW], [PU2, PU2_NEW], [PU3, PU3_NEW], [PU4, PU4_NEW]] },
  'index.js': { marker: 'LENH C', reps: [[IX1, IX1_NEW], [IX2, IX2_NEW], [IX3, IX3_NEW], [IX4, IX4_NEW], [IX5, IX5_NEW], [IX6, IX6_NEW], [IX7, IX7_NEW]] },
};
if (process.argv.includes('--anchors')) { console.log(JSON.stringify(ANCH, null, 1)); process.exit(0); }
const argFiles = process.argv.slice(2).filter(a => !a.startsWith('--'));
const files = argFiles.length ? argFiles : ['stats.js', 'push.js', 'index.js'];
const byBase = f => { const b = f.replace(/^.*\//, ''); const k = Object.keys(PLAN).find(p => p === b); if (!k) { console.error('KHONG BIET FILE: ' + f); process.exit(1); } return k; };
const state = {}; let fail = 0, done = 0;
for (const f of files) { const k = byBase(f); let s; try { s = fs.readFileSync(f, 'utf8'); } catch (e) { console.error('KHONG DOC DUOC ' + f); process.exit(1); }
  const p = PLAN[k]; if (s.includes(p.marker)) { state[f] = { skip: true }; done++; continue; }
  let t = s; const miss = [];
  for (const [a, b] of p.reps) { const n = t.split(a).length - 1; if (n !== 1) { miss.push('[' + n + '×] ' + a.slice(0, 90).replace(/\n/g, '⏎')); continue; } t = t.replace(a, () => b); }
  if (miss.length) { fail++; console.error('KHONG THAY MOC (' + f + '): ' + miss.length + ' mốc — ' + miss.join(' | ')); }
  state[f] = { out: t };
}
if (fail) { console.error('DỪNG: patch không áp (fail-closed, KHÔNG ghi file nào).'); process.exit(1); }
if (done && done < files.length) { console.error('LỆCH: ' + done + '/' + files.length + ' file đã có marker LENH C, file còn lại chưa — KHÔNG ghi gì. Kiểm backup .bak rồi chạy lại đồng bộ.'); process.exit(1); }
if (done === files.length) { console.log('đã vá (marker LENH C có ở ' + files.length + '/' + files.length + ' file) — idempotent, bỏ qua'); process.exit(0); }
for (const f of files) fs.writeFileSync(f, state[f].out);
console.log('PATCH OK ' + files.length + ' file (LENH C): stats.js machineDroppedC/aiDropped/đổi nhiệt · push.js hotGateC brand_hint · index.js bfKey theo brand + source_health + healthEvalC');
