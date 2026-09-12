#!/bin/bash
# LỆNH C (13/09/2026) — sau LỆNH B. PB-10 push "Lead nóng mới" khi brand/brand_hint xuất hiện (lead ghi 2 bước) · PB-6 bộ đếm daily_stats TRỪ khi MÁY loại/đổi nhiệt (sales bấm Loại giữ nguyên; anh chốt câu 1 12/09) + recount 60 ngày
#   · Rules leads whitelist + dropped_reason/ai_feedback/phone (nền zip FE PC-6/PA-5) · ZBS notifyBrandZalo không bắn cho lead đã loại/điểm tạm/người bán (tuỳ chọn, lỗi = cảnh báo) · source_health/{source_id} + healthEvalC → WARNING [SCAN-NO-LEAD], ERROR [SCAN-HEALTH] (alert #9), system_status/scan.health
#   · backfill_done khoá theo brand (đọc cả khoá cũ) · dọn group_state cũ theo URL (dry — xoá bằng `node _lc_clean.mjs --apply` sau khi xem)
#   → backup .bak-<TS> → patch fail-closed NGUYÊN TỬ 3 file (stats.js push.js index.js; đủ mốc cả 3 mới ghi) → Rules → node --check → import test (.env) → deploy rules + 4 function (xích &&) → zalo-fn (cảnh báo) → recount → clean dry
set -o pipefail
cd ~/firebase-s13/functions || { echo 'KHONG VAO DUOC ~/firebase-s13/functions'; exit 1; }
TS=$(date +%Y%m%d-%H%M%S); echo "backup TS=$TS (giờ UTC)"
cat > _lc_patch.cjs <<'EOF_PATCH'
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
EOF_PATCH
cat > _lc_rules.cjs <<'EOF_RULES'
/* LỆNH C — Rules: (1) leads whitelist update cho non-super thêm 'dropped_reason' (PC-6 Loại có lý do), 'ai_feedback' (PC-6/PC-1 phản hồi 1 chạm), 'phone' (PA-5 SĐT gọi được ngay); (2) block đọc source_health + group_state cho Super Admin (web v119-90: cột Nhịp · Sức khoẻ ở Nguồn quét).
   Content-anchored: mốc `'dropped', 'dropped_at', 'dropped_by', ` trong hasOnly([...]) của match /leads/{id} (LỆNH #8). Idempotent (đã có 'dropped_reason' → bỏ qua). Fail-closed: mốc ≠ 1 → dừng, không ghi.
   Dùng: node functions/_lc_rules.cjs   (cwd = ~/firebase-s13) */
const fs = require('fs'); const f = process.argv[2] || 'firestore.rules';
let s = fs.readFileSync(f, 'utf8');
/* 2 block đọc cho web (zip v119-90): source_health (sức khoẻ nguồn — LỆNH C ghi) + group_state (nhịp thích ứng — LỆNH B ghi) · read = super, write = false (chỉ Admin SDK ghi). Chèn 1 dòng/block ngay sau `match /databases/{database}/documents {` (cách LỆNH #23 dùng cho system_status). */
const B1 = "    match /source_health/{sid} { allow read: if isSuperAdmin(); allow write: if false; } /* LENH C */\n";
const B2 = "    match /group_state/{gid} { allow read: if isSuperAdmin(); allow write: if false; } /* LENH C */\n";
const hasWL = /'dropped_reason'/.test(s), hasSH = /match \/source_health\//.test(s), hasGS = /match \/group_state\//.test(s);
if (hasWL && hasSH && hasGS) { console.log('đã vá (Rules leads đã có dropped_reason + block source_health/group_state) — idempotent, bỏ qua'); process.exit(0); }
const A = "'dropped', 'dropped_at', 'dropped_by', "; const n = s.split(A).length - 1;
if (!hasWL && n !== 1) { console.error('KHONG THAY MOC Rules hasOnly (đếm ' + n + ', cần 1) — KHÔNG ghi gì'); process.exit(1); }
if (!hasWL && (!/match \/leads\/\{id\}/.test(s) || !/hasOnly\(\['stage', 'stage_at'/.test(s))) { console.error('Rules không có block leads/hasOnly như LỆNH #8 — KHÔNG ghi gì'); process.exit(1); }
const D = /match \/databases\/\{database\}\/documents \{[ \t]*\n/; const nd = (s.match(new RegExp(D.source, 'g')) || []).length;
if ((!hasSH || !hasGS) && nd !== 1) { console.error('KHONG THAY MOC "match /databases/{database}/documents {" (đếm ' + nd + ', cần 1) — KHÔNG ghi gì'); process.exit(1); }
if (!/function isSuperAdmin\(\)/.test(s)) { console.error('Rules không có helper isSuperAdmin() — KHÔNG ghi gì'); process.exit(1); }
const did = [];
if (!hasWL) { s = s.replace(A, () => A + "'dropped_reason', 'ai_feedback', 'phone', "); did.push('leads whitelist + dropped_reason, ai_feedback, phone'); }
if (!hasSH || !hasGS) { s = s.replace(D, m => m + (hasSH ? '' : B1) + (hasGS ? '' : B2)); did.push('block đọc ' + [!hasSH ? 'source_health' : '', !hasGS ? 'group_state' : ''].filter(Boolean).join(' + ') + ' (super)'); }
fs.writeFileSync(f, s); console.log('PATCH OK firestore.rules: ' + did.join(' · ') + ' (LENH C)');
EOF_RULES
cat > _lc_zbs.cjs <<'EOF_ZBS'
/* LỆNH C — ZBS guard (tuỳ chọn): notifyBrandZalo (~/smartlead-zalo-fn/functions/index.js) KHÔNG bắn ZNS cho sales khi lead đã loại / không thành / điểm tạm (ai_scored:false) / vai người bán / chủ bài;
   AI chấm lại lead điểm tạm → được bắn (zalo_notified vẫn chặn trùng). Content-anchored theo dump #47d dòng 288–298, marker `LENH C`, idempotent, fail-closed.
   Dùng: node ~/firebase-s13/functions/_lc_zbs.cjs ~/smartlead-zalo-fn/functions/index.js */
const fs = require('fs'); const f = process.argv[2]; if (!f) { console.error('thiếu đường dẫn index.js zalo-fn'); process.exit(1); }
let s = fs.readFileSync(f, 'utf8');
if (s.includes('LENH C')) { console.log('đã vá (notifyBrandZalo có marker LENH C) — idempotent, bỏ qua'); process.exit(0); }
const A1 = "    if (!brand) return;                       // no brand yet\n";
const B1 = A1 + "    if (after.dropped || after.lost || after.ai_scored === false || /^(seller|poster_self)$/.test(String(after.role || '')) || after.self_comment === true) return; // LENH C: không bắn ZBS cho lead đã loại / không thành / điểm tạm / người bán / chủ bài\n";
const A2 = "    if (!justTagged && before.score === after.score) return;";
const B2 = "    if (!justTagged && !(before.ai_scored === false && after.ai_scored === true) && before.score === after.score) return; // LENH C: AI chấm lại lead điểm tạm → cho qua (zalo_notified vẫn chặn trùng)";
const miss = [[A1, 'guard sau if (!brand)'], [A2, 'justTagged/score']].filter(([a]) => s.split(a).length - 1 !== 1).map(x => x[1]);
if (miss.length) { console.error('KHONG THAY MOC notifyBrandZalo: ' + miss.join(', ') + ' — KHÔNG ghi gì'); process.exit(1); }
if (!/exports\.notifyBrandZalo = onDocumentUpdated\(/.test(s)) { console.error('không thấy exports.notifyBrandZalo — KHÔNG ghi gì'); process.exit(1); }
s = s.replace(A1, () => B1).replace(A2, () => B2); fs.writeFileSync(f, s); console.log('PATCH OK notifyBrandZalo: guard dropped/lost/ai_scored:false/vai + AI chấm lại (LENH C)');
EOF_ZBS
cat > _lc_recount.mjs <<'EOF_RECOUNT'
/* _lc_recount.mjs (= _l42_recount + LỆNH C PB-6: bỏ lead do MÁY loại; tempOf theo nhiệt độ HIỆN TẠI sau AI chấm lại) — (1) chẩn đoán: 6 lead mới nhất + so daily_stats 4 ngày gần nhất;
   (2) DỰNG LẠI tuyệt đối new/hot/warm/cold/junk theo NGÀY PHÁT HIỆN (VN) cho daily_stats N ngày (set merge — field khác giữ nguyên). Idempotent. Số KPI 14 ngày sẽ GIẢM (lead máy loại không còn đếm).
   Dùng: node _lc_recount.mjs [--dry] [--days=60]   (đặt trong ~/firebase-s13/functions, cạnh stats.js) */
import { vnDay, toMs, tempOf } from './stats.js';
export const MACHINE_BY_C = /^(rescore|rescore_role|lenh31b|ai|scanner|engine|worker|machine|system|sweep|auto)(:[\w-]+)?$/i; /* token máy CHÍNH XÁC (tuỳ chọn hậu tố :x) — email/uid người (có @ hoặc dài) không bao giờ khớp */
export const machineDropped = l => !!(l && l.dropped === true && MACHINE_BY_C.test(String(l.dropped_by || '')));
/* Hàm THUẦN (harness dùng chung): leads → {brand__day: {brandCode, day, new, hot, warm, cold, junk}} cho ngày >= from; bỏ: không brand/không detected_at/vai người bán/máy loại. */
export function newAgg(leads, from) {
  const agg = {}; const skipped = { noBrand: 0, noDet: 0, roleBad: 0, aiDropped: 0 };
  (leads || []).forEach(l => { const brand = String((l && l.brand) || '').trim(); if (!brand) { skipped.noBrand++; return; }
    if (/^(seller|poster_self)$/.test(String(l.role || '')) || l.self_comment === true) { skipped.roleBad++; return; } /* LENH #42 */
    if (machineDropped(l)) { skipped.aiDropped++; return; } /* LENH C (PB-6) */
    const det = toMs(l.detected_at); if (!det) { skipped.noDet++; return; } const day = vnDay(det); if (day < from) return;
    const k = brand + '__' + day; const o = agg[k] || (agg[k] = { brandCode: brand, day, new: 0, hot: 0, warm: 0, cold: 0, junk: 0 });
    const t = tempOf(l); if (t === 'junk') o.junk++; else { o.new++; o[t]++; } });
  return { agg, skipped };
}
const isMain = process.argv[1] && /_lc_recount\.mjs$/.test(process.argv[1]);
if (isMain) {
  const { initializeApp, applicationDefault } = await import('firebase-admin/app'); const { getFirestore } = await import('firebase-admin/firestore');
  const DRY = process.argv.includes('--dry'); const dArg = process.argv.find(a => a.startsWith('--days=')); const DAYS = dArg ? Math.max(1, Number(dArg.slice(7)) || 60) : 60;
  initializeApp({ credential: applicationDefault(), projectId: 'smartlead-z15' }); const db = getFirestore();
  const NOW = Date.now(), from = vnDay(NOW - (DAYS - 1) * 864e5);
  const leads = []; let last = null, scanned = 0;
  for (;;) { let q = db.collection('leads').orderBy('__name__').select('brand', 'temp', 'score', 'detected_at', 'role', 'self_comment', 'dropped', 'dropped_by').limit(300); if (last) q = q.startAfter(last); const snap = await q.get(); if (snap.empty) break;
    snap.docs.forEach(d => { scanned++; leads.push(d.data() || {}); }); last = snap.docs[snap.docs.length - 1]; if (snap.size < 300) break; }
  const { agg, skipped } = newAgg(leads, from); const keys = Object.keys(agg).sort();
  const d4 = vnDay(NOW - 3 * 864e5); const ks4 = keys.filter(k => agg[k].day >= d4);
  console.log('=== daily_stats 4 ngày gần nhất: hiện có → đếm lại (new/hot/junk) ===');
  for (const k of ks4) { const cur = await db.collection('daily_stats').doc(k).get(); const x = cur.exists ? (cur.data() || {}) : {}; const o = agg[k];
    const same = (Number(x.new) || 0) === o.new && (Number(x.hot) || 0) === o.hot && (Number(x.junk) || 0) === o.junk;
    console.log(' ', k, '| doc', (x.new ?? '∅') + '/' + (x.hot ?? '∅') + '/' + (x.junk ?? '∅'), '→ đếm lại', o.new + '/' + o.hot + '/' + o.junk, same ? '✓' : '✗ LỆCH (dự kiến: lead máy loại/đổi nhiệt trước LỆNH C)'); }
  const perBrand = {}; keys.forEach(k => { const o = agg[k]; const p = perBrand[o.brandCode] || (perBrand[o.brandCode] = { days: 0, new: 0, hot: 0, junk: 0 }); p.days++; p.new += o.new; p.hot += o.hot; p.junk += o.junk; });
  console.log((DRY ? '[DRY] ' : '') + 'recount new/hot/warm/cold/junk: quét ' + scanned + ' lead (bỏ qua: không brand ' + skipped.noBrand + ', không detected_at ' + skipped.noDet + ', vai người bán/chủ bài ' + skipped.roleBad + ', MÁY loại ' + skipped.aiDropped + ') → ' + keys.length + ' doc daily_stats từ ' + from + ' (' + DAYS + ' ngày)');
  Object.keys(perBrand).sort().forEach(b => { const p = perBrand[b]; console.log('  ' + b + ': ' + p.days + ' ngày · lead hợp lệ ' + p.new + ' · nóng ' + p.hot + ' · rác ' + p.junk); });
  if (DRY) { console.log('[DRY] không ghi gì.'); process.exit(0); }
  let wrote = 0; for (let i = 0; i < keys.length; i += 400) { const bw = db.batch(); for (const k of keys.slice(i, i + 400)) { const o = agg[k]; bw.set(db.collection('daily_stats').doc(k), { brandCode: o.brandCode, day: o.day, new: o.new, hot: o.hot, warm: o.warm, cold: o.cold, junk: o.junk, recountAt: NOW, recountBy: 'lenhC' }, { merge: true }); wrote++; } await bw.commit(); }
  /* doc trong khoảng mà không còn lead nào → đưa về 0 (không xoá field khác) */
  let zeroed = 0; const ex = await db.collection('daily_stats').where('day', '>=', from).select('brandCode', 'day', 'new').get();
  const bw2 = db.batch(); for (const d of ex.docs) { if (agg[d.id]) continue; const x = d.data() || {}; if (!(Number(x.new) || 0) && !(Number(x.hot) || 0)) continue; bw2.set(d.ref, { new: 0, hot: 0, warm: 0, cold: 0, junk: 0, recountAt: NOW, recountBy: 'lenhC' }, { merge: true }); zeroed++; } if (zeroed) await bw2.commit();
  console.log('ĐÃ GHI ' + wrote + ' doc daily_stats' + (zeroed ? ' + đưa về 0: ' + zeroed : '') + ' — F5 web: KPI 14 ngày + Bảng brand theo số mới (đã bỏ lead máy loại).');
}
EOF_RECOUNT
cat > _lc_clean.mjs <<'EOF_CLEAN'
/* _lc_clean.mjs — dọn doc group_state CŨ khoá theo URL (LỆNH B đã di trú sang g_<gid>/s_<slug>). Mặc định DRY (chỉ liệt kê); `--apply` mới xoá.
   An toàn: chỉ xoá khi (a) có ≥ 15 doc gkey mới, (b) doc cũ không được ghi sau mốc deploy B (12/09/2026 12:11Z), (c) mọi group_state cũ có doc mới tương ứng (gkeyBySrcUrl từ sources) hoặc nguồn đã tắt/không còn.
   Đặt trong ~/firebase-s13/functions. Không đụng collection khác. */
import { initializeApp, applicationDefault, getApps } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
if (!getApps().length) initializeApp({ credential: applicationDefault(), projectId: 'smartlead-z15' }); const db = getFirestore();
const APPLY = process.argv.includes('--apply'); const B_DEPLOY = Date.parse('2026-09-12T12:11:00Z');
const ms = v => !v ? 0 : (typeof v === 'number' ? v : (v.toMillis ? v.toMillis() : (v.seconds ? v.seconds * 1000 : (Date.parse(v) || 0))));
const gs = (await db.collection('group_state').get()).docs.map(d => Object.assign({ id: d.id }, d.data() || {}));
const NEW = gs.filter(x => /^(g_|s_)/.test(x.id)), OLD = gs.filter(x => !/^(g_|s_)/.test(x.id));
console.log('group_state: ' + gs.length + ' doc = mới (g_/s_) ' + NEW.length + ' + cũ (URL) ' + OLD.length);
if (!OLD.length) { console.log('không có doc cũ — xong.'); process.exit(0); }
if (NEW.length < 15) { console.log('DỪNG: doc mới < 15 (' + NEW.length + ') — B chưa di trú đủ, chưa dọn.'); process.exit(0); }
const late = OLD.filter(x => Math.max(ms(x.lastTriggerAt), ms(x.updatedAt), ms(x.at), ms(x.lastHarvestAt), ms(x.lastSweepAt)) > B_DEPLOY);
if (late.length) { console.log('DỪNG: ' + late.length + ' doc cũ còn được GHI sau deploy B (' + late.slice(0, 5).map(x => x.id).join(' · ') + ') — có đường code còn dùng khoá URL? gửi em.'); process.exit(0); }
OLD.slice(0, 40).forEach(x => console.log('  cũ:', x.id.slice(0, 90), '· ghi cuối', new Date(Math.max(ms(x.lastTriggerAt), ms(x.updatedAt), ms(x.at)) + 7 * 3600e3).toISOString().slice(0, 16).replace('T', ' ') + ' VN'));
if (!APPLY) { console.log('[DRY] sẽ xoá ' + OLD.length + ' doc cũ. Chạy lại với --apply để xoá.'); process.exit(0); }
let n = 0; for (let i = 0; i < OLD.length; i += 400) { const bw = db.batch(); for (const x of OLD.slice(i, i + 400)) { bw.delete(db.collection('group_state').doc(x.id)); n++; } await bw.commit(); }
console.log('ĐÃ XOÁ ' + n + ' doc group_state cũ.');
EOF_CLEAN
cat > _lc_after.mjs <<'EOF_AFTER'
/* LỆNH C KHỐI 2 (13/09/2026) — CHỈ ĐỌC: nghiệm thu sau deploy C (chạy sau ≥ 15′, tốt nhất 1–2 giờ ban ngày).
   In: (1) daily_stats 4 ngày gần nhất (new/hot/aiDropped/dropped) + so recount · (2) lead 24 h: máy loại (dropped_by) / sales loại / đổi nhiệt (ai_prev) · (3) log pushOnLead 24 h ("push hot … new|tagged|rescored sent N")
   · (4) source_health: số doc, top theo bài 7 ngày, nguồn xấu theo system_status/scan.health + log [SCAN-NO-LEAD]/[SCAN-HEALTH] · (5) backfill_done khoá mới · (6) group_state doc cũ còn lại · (7) Rules/ZBS: marker trong file local + describe notifyBrandZalo.
   Đọc theo TRANG ≤300 + select(). Đặt trong ~/firebase-s13/functions. Không ghi gì. */
import { initializeApp, applicationDefault, getApps } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { execSync } from 'node:child_process'; import fs from 'node:fs'; import os from 'node:os'; import path from 'node:path';
if (!getApps().length) initializeApp({ credential: applicationDefault(), projectId: 'smartlead-z15' }); const db = getFirestore();
const OFF = 7 * 3600e3, now = Date.now();
const ms = v => !v ? 0 : (typeof v === 'number' ? v : (v.toMillis ? v.toMillis() : (v.seconds ? v.seconds * 1000 : (Date.parse(v) || 0))));
const hm = v => ms(v) ? new Date(ms(v) + OFF).toISOString().slice(5, 16).replace('T', ' ') : '—';
const mask = s => String(s || '').replace(/sk-[A-Za-z0-9_-]{6,}/g, 'sk-…').replace(/\b\d{1,3}(\.\d{1,3}){3}\b/g, '<ip>').slice(0, 200);
const vnDay = v => new Date(ms(v) + OFF).toISOString().slice(0, 10);
async function pageAll(q, orderField, sel, max) { const out = []; let last = null; while (out.length < (max || 3000)) { let qq = q.orderBy(orderField).limit(300); if (sel && sel.length) qq = qq.select(...sel); if (last) qq = qq.startAfter(last); const s = await qq.get(); s.docs.forEach(d => out.push(Object.assign({ id: d.id }, d.data()))); if (s.size < 300) break; last = s.docs[s.docs.length - 1]; } return out; }
const MACHINE = /^(rescore|rescore_role|lenh31b|ai|scanner|engine|worker|machine|system|sweep|auto)(:[\w-]+)?$/i; /* token máy CHÍNH XÁC (tuỳ chọn hậu tố :x) — email/uid người (có @ hoặc dài) không bao giờ khớp */
console.log('== LỆNH C KHỐI 2 — ' + new Date(now + OFF).toISOString().slice(0, 16).replace('T', ' ') + ' VN ==');
// 1. daily_stats 4 ngày
{ const from = vnDay(now - 3 * 864e5); const ds = (await db.collection('daily_stats').where('day', '>=', from).get()).docs.map(d => Object.assign({ id: d.id }, d.data()));
  const byB = {}; ds.forEach(x => { const b = x.brandCode || '?'; const o = byB[b] || (byB[b] = { new: 0, hot: 0, aiDropped: 0, dropped: 0, days: 0, recount: 0 }); o.new += Number(x.new) || 0; o.hot += Number(x.hot) || 0; o.aiDropped += Number(x.aiDropped) || 0; o.dropped += Number(x.dropped) || 0; o.days++; if (x.recountBy === 'lenhC') o.recount++; });
  console.log('1. daily_stats 4 ngày (' + from + ' →): ' + ds.length + ' doc · ' + Object.keys(byB).sort().map(b => b + ' hợp lệ ' + byB[b].new + '/nóng ' + byB[b].hot + '/máy loại ' + byB[b].aiDropped + '/sales loại ' + byB[b].dropped + (byB[b].recount ? ' (recount C ' + byB[b].recount + ' doc)' : '')).join(' · ') + '  (kỳ vọng: doc có recountBy lenhC; aiDropped bắt đầu đếm từ deploy C)'); }
// 2. lead 24 h
{ const L = await pageAll(db.collection('leads').where('detected_at', '>=', new Date(now - 24 * 3600e3)), 'detected_at', ['brand', 'brand_hint', 'temp', 'dropped', 'dropped_by', 'dropped_reason', 'ai_prev', 'rescored_at', 'ai_scored', 'role', 'push_hot_at'], 3000);
  const mach = L.filter(l => l.dropped && MACHINE.test(String(l.dropped_by || ''))), hum = L.filter(l => l.dropped && !MACHINE.test(String(l.dropped_by || ''))), resc = L.filter(l => l.ai_prev && l.rescored_at);
  const by = {}; mach.forEach(l => { const k = String(l.dropped_by || '?'); by[k] = (by[k] || 0) + 1; });
  console.log('2. Lead 24 h: ' + L.length + ' · máy loại ' + mach.length + ' ' + JSON.stringify(by) + ' · sales loại ' + hum.length + (hum.length ? ' (dropped_by mẫu: ' + [...new Set(hum.map(l => String(l.dropped_by || '').slice(0, 24)))].slice(0, 3).join(', ') + ')' : '') + ' · AI chấm lại đổi điểm ' + resc.length + ' · có dropped_reason ' + L.filter(l => l.dropped_reason).length + '  (kỳ vọng: dropped_by người KHÔNG khớp regex máy — nếu khớp, gửi em mẫu)'); }
// 3. log pushOnLead 24 h
try { const filt = 'resource.type="cloud_run_revision" AND resource.labels.service_name="pushonlead" AND timestamp>="' + new Date(now - 24 * 3600e3).toISOString() + '" AND textPayload:"push hot"';
  const out = execSync('gcloud logging read \'' + filt + '\' --project smartlead-z15 --limit 200 --format="value(timestamp,textPayload)" 2>/dev/null', { encoding: 'utf8', maxBuffer: 8e6 }); const lines = out.split('\n').filter(Boolean);
  const cnt = { new: 0, tagged: 0, rescored: 0, old: 0 }, sent = { n: 0, s: 0 }; for (const l of lines) { const m = /push hot \S+ (new|tagged|rescored) sent (\d+)/.exec(l); if (m) { cnt[m[1]]++; sent.n++; sent.s += Number(m[2]); } else if (/push hot/.test(l)) cnt.old++; }
  console.log('3. Log pushOnLead 24 h "push hot": ' + lines.length + ' dòng · sau C ' + JSON.stringify({ new: cnt.new, tagged: cnt.tagged, rescored: cnt.rescored }) + ' · tổng sent ' + sent.s + '/' + sent.n + ' lượt · dòng trước C ' + cnt.old + '  (kỳ vọng: lead nóng mới → "new" (đường B có brand_hint) với sent ≥ 1 khi admin brand/super có token)');
  lines.slice(0, 4).forEach(l => console.log('   ' + mask(l.replace(/\s+/g, ' ')).slice(0, 160)));
} catch (e) { console.log('3. Log pushOnLead: không đọc được (' + mask(e.message).slice(0, 80) + ')'); }
// 4. source_health
{ const hs = (await db.collection('source_health').get()).docs.map(d => Object.assign({ id: d.id }, d.data())); const sum = hs.map(h => { const days = h.days || {}; let p = 0, l = 0; Object.values(days).forEach(x => { p += Number(x.posts) || 0; l += Number(x.leads) || 0; }); return { id: h.id, name: h.name, brand: h.brand, p, l, err: Number(h.errStreak) || 0, last: h.lastPostAt, nd: Object.keys(days).length }; }).sort((a, b) => b.p - a.p);
  const st = (await db.collection('system_status').doc('scan').get()).data() || {}; const H = st.health || {};
  console.log('4. source_health: ' + hs.length + ' nguồn có dữ liệu · health lúc ' + hm(H.at) + ': ' + (H.n ?? '—') + ' xấu / ' + (H.active ?? '—') + ' bật' + (H.bad && H.bad.length ? ' → ' + H.bad.slice(0, 6).map(b => (b.name || b.id) + ' [' + (b.brand || '') + ']: ' + b.why).join(' · ') : ' (không nguồn xấu)') + '  (kỳ vọng: sau vài lượt có bài, mỗi nguồn hoạt động 1 doc; days ≤ 7 khoá)');
  sum.slice(0, 8).forEach(s => console.log('   ' + (s.name || s.id).slice(0, 34).padEnd(34) + ' [' + (s.brand || '') + '] bài 7 ngày ' + s.p + ' · lead ' + s.l + ' · errStreak ' + s.err + ' · bài cuối ' + hm(s.last) + ' · ' + s.nd + ' ngày'));
  try { const filt = 'resource.type="cloud_run_revision" AND resource.labels.service_name="scheduledscan" AND timestamp>="' + new Date(now - 24 * 3600e3).toISOString() + '" AND (jsonPayload.message:"[SCAN-NO-LEAD]" OR jsonPayload.message:"[SCAN-HEALTH]" OR textPayload:"[LENH C]")';
    const out = execSync('gcloud logging read \'' + filt + '\' --project smartlead-z15 --limit 100 --format="value(timestamp,jsonPayload.message,textPayload)" 2>/dev/null', { encoding: 'utf8', maxBuffer: 8e6 }); const lines = out.split('\n').filter(Boolean);
    console.log('   log 24 h: [SCAN-NO-LEAD] ' + lines.filter(l => /SCAN-NO-LEAD/.test(l)).length + ' · [SCAN-HEALTH] ' + lines.filter(l => /SCAN-HEALTH/.test(l)).length + ' · [LENH C] lỗi ghi ' + lines.filter(l => /\[LENH C\]/.test(l)).length + '  (kỳ vọng: lỗi ghi 0; NO-LEAD chỉ khi nguồn thật sự im/không lead/lỗi trigger)'); lines.slice(0, 4).forEach(l => console.log('   ' + mask(l.replace(/\s+/g, ' ')).slice(0, 170)));
  } catch (e) { console.log('   log: không đọc được (' + mask(e.message).slice(0, 60) + ')'); } }
// 5. backfill_done + 6. group_state cũ
{ const bf = await db.collection('backfill_done').orderBy('at', 'desc').limit(20).get().catch(() => ({ docs: [] })); const withB = bf.docs.filter(d => (d.data() || {}).brand).length;
  console.log('5. backfill_done 20 gần nhất: ' + bf.docs.length + ' · có brand (khoá mới sau C) ' + withB + '  (kỳ vọng: backfill sau C có brand; cũ không có = bình thường)');
  const gs = await db.collection('group_state').get(); const old = gs.docs.filter(d => !/^(g_|s_)/.test(d.id)).length; console.log('6. group_state: ' + gs.size + ' doc · cũ theo URL còn ' + old + '  (kỳ vọng: 0 sau `node _lc_clean.mjs --apply`; còn = chưa dọn, không sao)'); }
// 7. Rules/ZBS
{ let r = '—', z = '—'; try { r = /'dropped_reason'/.test(fs.readFileSync(path.join(os.homedir(), 'firebase-s13', 'firestore.rules'), 'utf8')) ? 'có dropped_reason/ai_feedback/phone' : 'CHƯA có dropped_reason'; } catch (e) { r = 'không đọc được'; }
  try { z = /LENH C/.test(fs.readFileSync(path.join(os.homedir(), 'smartlead-zalo-fn', 'functions', 'index.js'), 'utf8')) ? 'có marker LENH C' : 'CHƯA có marker'; } catch (e) { z = 'không đọc được'; }
  let d = ''; try { d = execSync('gcloud functions describe notifyBrandZalo --region asia-southeast1 --gen2 --format="value(state,updateTime)" 2>/dev/null', { encoding: 'utf8' }).trim(); } catch (e) { d = '(describe lỗi)'; }
  console.log('7. Rules local: ' + r + ' · zalo-fn index.js: ' + z + ' · notifyBrandZalo: ' + d + '  (kỳ vọng: updateTime ≥ giờ chạy KHỐI 1 nếu deploy ZBS OK)'); }
console.log('== XONG (chỉ đọc) ==');
EOF_AFTER
node --check _lc_patch.cjs && node --check _lc_rules.cjs && node --check _lc_zbs.cjs && node --check _lc_recount.mjs && node --check _lc_clean.mjs && node --check _lc_after.mjs || { echo 'DỪNG: script lỗi cú pháp (chưa đụng gì)'; exit 1; }
FILES="stats.js push.js index.js"
echo "=== (a) backup + patch 3 file ==="
for f in $FILES; do [ -f "$f" ] || { echo "DỪNG: thiếu $f"; exit 1; }; done
[ -f ../firestore.rules ] || { echo 'DỪNG: thiếu ~/firebase-s13/firestore.rules'; exit 1; }
grep -q "LENH B" index.js || { echo 'DỪNG: index.js chưa có marker LENH B — LỆNH C đặt mốc trên mã SAU LỆNH B. Chạy LỆNH B trước.'; exit 1; }
if grep -q "LENH C" index.js && [ -f _lc_backup_ts ]; then TSB=$(cat _lc_backup_ts); echo "index.js ĐÃ có marker LENH C (chạy lại) — KHÔNG tạo .bak mới; bản gốc trước LENH C = *.bak-$TSB"
elif grep -q "LENH C" index.js; then echo "DỪNG: index.js đã có marker LENH C nhưng thiếu _lc_backup_ts — khôi phục từ .bak-<TS gốc> hoặc gửi em output"; exit 1
else TSB=$TS
  for f in $FILES; do cp "$f" "$f.bak-$TSB" || { echo "DỪNG: không backup được $f"; exit 1; }; done
  cp ../firestore.rules "../firestore.rules.bak-$TSB" || { echo 'DỪNG: không backup được firestore.rules'; exit 1; }
  echo "$TSB" > _lc_backup_ts
fi
restore() { for f in $FILES; do cp "$f.bak-$TSB" "$f"; done; cp "../firestore.rules.bak-$TSB" ../firestore.rules; echo "ĐÃ KHÔI PHỤC 3 file + firestore.rules từ .bak-$TSB"; }
describe4() { for f in scheduledScan manualScan statsOnLead pushOnLead; do gcloud functions describe "$f" --region asia-southeast1 --gen2 --format='value(name,state,updateTime)' 2>/dev/null | sed 's|projects/smartlead-z15/locations/asia-southeast1/functions/||' || echo "(describe $f lỗi)"; done; }
node _lc_patch.cjs $FILES || { echo 'DỪNG (a): patch không áp — KHÔNG ghi gì. Gửi em output.'; exit 1; }
for f in $FILES; do node --check "$f" || { echo "DỪNG (a): lỗi cú pháp sau patch ($f)"; restore; exit 1; }; done
echo "marker LENH C (stats/push/index):"; grep -c "LENH C" $FILES
echo "=== (b) Rules: leads whitelist + dropped_reason/ai_feedback/phone ==="
( cd ~/firebase-s13 && node functions/_lc_rules.cjs ) || { echo 'DỪNG (b): không vá được Rules'; restore; exit 1; }
echo "=== (c) import test (.env) ==="
set -a; . ./.env; set +a
node --input-type=module -e "const m=await import('./index.js'); const s=await import('./stats.js'); const p=await import('./push.js'); console.log('IMPORT OK · healthEvalC', typeof m.healthEvalC, '· machineDroppedC', typeof s.machineDroppedC, '· hotGateC', typeof p.hotGateC, '· statsOnLead', typeof s.statsOnLead, '· pushOnLead', typeof p.pushOnLead); const ev=s.statsEvents({brand:'x',temp:'hot',score:85,detected_at:Date.now()-3600e3},{brand:'x',temp:'hot',score:85,detected_at:Date.now()-3600e3,dropped:true,dropped_by:'rescore'},Date.now()); console.log('statsEvents máy loại →', JSON.stringify(ev.map(e=>e.inc))); console.log('hotGateC brand_hint →', p.hotGateC(null,{temp:'hot',brand_hint:'x'}), '| bước 2 →', p.hotGateC({temp:'hot',brand_hint:'x'},{temp:'hot',brand_hint:'x',brand:'x'})||'(không push lại)')" || { echo 'DỪNG (c): import lỗi'; restore; exit 1; }
echo "=== (d) deploy Rules + 4 function (scheduledScan manualScan statsOnLead pushOnLead) ==="
cd ~/firebase-s13 && firebase deploy --only firestore:rules,functions:scheduledScan,functions:manualScan,functions:statsOnLead,functions:pushOnLead > /tmp/lc_deploy.log 2>&1; RC=$?; tail -6 /tmp/lc_deploy.log
[ "$RC" = "0" ] && grep -q "Deploy complete" /tmp/lc_deploy.log || { echo "DEPLOY LỖI (RC=$RC) — firebase deploy đưa từng function lên lần lượt nên lỗi giữa chừng = MỘT PHẦN đã lên; bảng describe dưới: updateTime ≥ $TS = đã lên bản mới. Cách xử lý: chạy LẠI đúng lệnh deploy ở (d) (idempotent) — hoặc quay lui: cd ~/firebase-s13/functions; for f in $FILES; do cp \"\$f.bak-$TSB\" \"\$f\"; done; cp ~/firebase-s13/firestore.rules.bak-$TSB ~/firebase-s13/firestore.rules; rồi deploy lại cùng danh sách. Gửi em /tmp/lc_deploy.log + bảng describe."; describe4; exit 1; }
describe4
echo "=== (e) ZBS notifyBrandZalo (~/smartlead-zalo-fn): guard lead đã loại/điểm tạm/người bán — lỗi ở đây = CẢNH BÁO, không chặn ==="
if [ -f ~/smartlead-zalo-fn/functions/index.js ]; then
  ZF=~/smartlead-zalo-fn/functions/index.js
  if grep -q "LENH C" "$ZF"; then echo "zalo-fn đã có marker LENH C (chạy lại) — không backup lại"; else cp "$ZF" "$ZF.bak-$TS"; fi
  node ~/firebase-s13/functions/_lc_zbs.cjs "$ZF" && node --check "$ZF" && ( cd ~/smartlead-zalo-fn && if [ -f firebase.json ]; then firebase deploy --only functions:notifyBrandZalo > /tmp/lc_zbs_deploy.log 2>&1; RC2=$?; tail -4 /tmp/lc_zbs_deploy.log; [ "$RC2" = "0" ] && grep -q "Deploy complete" /tmp/lc_zbs_deploy.log; else echo "zalo-fn không có firebase.json — chưa deploy (gửi em: deploy tay bằng gcloud từ source, giữ secrets)"; false; fi ) && gcloud functions describe notifyBrandZalo --region asia-southeast1 --gen2 --format='value(name,state,updateTime)' 2>/dev/null | sed 's|projects/smartlead-z15/locations/asia-southeast1/functions/||' || echo "CẢNH BÁO (e): notifyBrandZalo chưa deploy được (xem /tmp/lc_zbs_deploy.log) — hệ thống vẫn chạy như cũ (ZBS vẫn bắn cho lead điểm tạm/đã loại tới khi deploy). Gửi em output."
else
  echo "(e) không thấy ~/smartlead-zalo-fn/functions/index.js — bỏ qua (gửi em đường dẫn zalo-fn)"
fi
echo "=== (f) recount daily_stats 60 ngày (bỏ lead MÁY loại; KPI 14 ngày sẽ giảm nhẹ = số thật) ==="
cd ~/firebase-s13/functions && node _lc_recount.mjs || echo "CẢNH BÁO (f): recount lỗi — bộ đếm vẫn đúng từ giờ trở đi (trigger đã vá); chạy lại: cd ~/firebase-s13/functions && node _lc_recount.mjs"
echo "=== (g) group_state cũ theo URL — chỉ liệt kê (dry) ==="
node _lc_clean.mjs || echo "(g) clean dry lỗi — không sao"
echo "=== XONG KHỐI 1 (exit=0) — KHỐI 2 (sau ≥ 15′): cd ~/firebase-s13/functions && node _lc_after.mjs  · xoá group_state cũ (tuỳ chọn, sau khi xem (g)): node _lc_clean.mjs --apply ==="
