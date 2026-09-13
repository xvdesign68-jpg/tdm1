/* LỆNH G (13/09/2026) — Đợt 2.5 PC-3 "BỘ NHỚ NGƯỜI VIẾT" (author_memory): 3 file index.js · stats.js · push.js, marker `LENH G`, fail-closed NGUYÊN TỬ (đủ mốc cả 3 file mới ghi), idempotent.
   Mốc trên MÃ SAU LỆNH F (index.js có marker LENH F; stats.js/push.js có marker LENH C). Anh chốt (critic 11/09): CHỈ khoá theo link hồ sơ (id:<uid> | u:<username>) hoặc author_uid số — KHÔNG khoá theo tên (2 người trùng tên).
   (1) index.js — author_memory/{key}: sellerHits/sellerIds (bài AI chấm vai `seller`, mỗi bài đếm 1 lần, chỉ phán quyết THẬT của AI — không đếm dự phòng), buyerHits/buyerIds (bài thành lead), lastRole/lastAt, leadIds, brands.<brand>{lastLeadId}, expireAt +180 ngày (TTL).
       Pha 2: đọc theo LÔ (getAll như seen) → người bán quen = sellerHits ≥ 2 & buyerHits 0 & lastSellerAt < 30 ngày → decision `seller_known` (không tốn AI; seen.brands = 'seller'); "Quét lại từ đầu" (force) vẫn chấm.
       Pha 3b: khách cũ = author_memory.brands[<brand này>].lastStage ∈ responded/booked/closed → lead mới mang returning/returning_lead_id/returning_stage/returning_at/returning_assignee(_uid) + ghi chú hệ thống; scans.sellerKnown/returning; scanned_posts.author_key/memHits.
       Sweeper #46 (chấm lại điểm tạm) cũng nuôi bộ nhớ. Ghi theo lô cuối lượt (memFlushG: increment + arrayUnion, dedup theo bài).
   (2) stats.js — statsOnLead: lead đổi giai đoạn responded/booked/closed → author_memory.brands.<brand> = { lastStage, lastStageAt, lastLeadId } (hàm thuần stageMemG/authorKeyG → harness).
   (3) push.js — returningGateG: lead mới có returning (1 lần) → push "🔁 Khách cũ quay lại" tới người từng phụ trách (không có → admin brand + super), thay push "Lead nóng mới" ở cùng lần ghi.
   (4) export * from './authmemcf.js' (CF clearAuthorMemory — super gỡ nhãn / đánh dấu người bán; .sh chép file).
   Dùng: node _lg_patch.cjs index.js stats.js push.js   (cwd = ~/firebase-s13/functions) */
'use strict';
const fs = require('fs');
const [FI, FS, FP] = process.argv.slice(2); if (!FI || !FS || !FP) { console.error('cần: node _lg_patch.cjs index.js stats.js push.js'); process.exit(2); }
const files = { index: fs.readFileSync(FI, 'utf8'), stats: fs.readFileSync(FS, 'utf8'), push: fs.readFileSync(FP, 'utf8') };
const has = Object.keys(files).filter(k => /LENH G\b/.test(files[k]));
if (has.length === 3) { console.log('đã vá (marker LENH G có sẵn ở cả 3 file) — idempotent, bỏ qua'); process.exit(0); }
if (has.length) { console.error('DỪNG: marker LENH G chỉ có ở ' + has.join(',') + ' (vá dở?) — khôi phục từ .bak rồi chạy lại. KHÔNG ghi gì.'); process.exit(1); }
if (!/LENH F\b/.test(files.index) || !/LENH E\b/.test(files.index) || !/LENH B\b/.test(files.index)) { console.error('DỪNG: index.js thiếu marker LENH B/E/F (mốc G đặt trên mã sau F). KHÔNG ghi gì.'); process.exit(1); }
if (!/LENH C\b/.test(files.stats) || !/LENH C\b/.test(files.push) || !/hotGateC/.test(files.push)) { console.error('DỪNG: stats.js/push.js thiếu marker LENH C (hotGateC). KHÔNG ghi gì.'); process.exit(1); }
const ops = { index: [], stats: [], push: [] };
const A = (f, label, from, to) => { const n = files[f].split(from).length - 1; if (n !== 1) { console.error('DỪNG: mốc ' + label + ' (' + f + ') gặp ' + n + ' lần (cần đúng 1). KHÔNG ghi gì.'); process.exit(1); } ops[f].push([label, from, to]); };
const R = String.raw;

/* ================= (1) index.js ================= */
const G1 = "  let cmtExtraF = 0, phoneCmtF = 0; /* LENH F (PA-5): bài/bình luận nhận thêm bình luận cùng tác giả · SĐT lấy từ bình luận */";
A('index', 'G1 helper + bộ đếm author_memory', G1, G1 + "\n" + R`  /* LENH G (PC-3): BỘ NHỚ NGƯỜI VIẾT author_memory/{key} — key = link hồ sơ (id:<uid> | u:<username>, __slProfileKey31) hoặc author_uid số; KHÔNG khoá theo tên (2 người trùng tên = 2 người).
     Người bán quen = ≥2 bài KHÁC NHAU AI chấm vai seller, 0 bài thành lead, trong 30 ngày → bỏ TRƯỚC AI (decision seller_known; force = "Quét lại từ đầu" vẫn chấm). Khách cũ = brand này từng responded/booked/closed (stats.js ghi) → lead mới mang cờ returning + ghi chú + push. */
  let sellerKnownG = 0, returningG = 0; const memCacheG = new Map(), memBufG = new Map(); const MEM_DAYS_G = 30, MEM_TTL_DAYS_G = 180;
  const authorKeyG = (url, uid) => { const k = __slProfileKey31(url); if (k) return k; const u = String(uid || '').trim(); return /^\d{5,}$/.test(u) ? 'id:' + u : ''; };
  const memDocG = k => db.collection('author_memory').doc(String(k).replace(/[^\w.:-]/g, '_').slice(0, 300));
  const brandKeyG = b => String(b || '').replace(/[^\w-]/g, '_').slice(0, 60);
  const stageViG = s => ({ responded: 'đã phản hồi', booked: 'đã hẹn tư vấn', closed: 'đã chốt' })[String(s || '')] || String(s || '');
  const sellerKnownOfG = m => !!(m && (Number(m.sellerHits) || 0) >= 2 && (Number(m.buyerHits) || 0) === 0 && (Date.now() - (Number(m.lastSellerAt) || 0)) < MEM_DAYS_G * 86400e3);
  const returningOfG = (m, b) => { const e = m && m.brands && b && m.brands[brandKeyG(b)]; return (e && /^(responded|booked|closed)$/.test(String(e.lastStage || '')) && e.lastLeadId) ? e : null; };
  async function memGetG(k) { if (!k) return null; if (memCacheG.has(k)) return memCacheG.get(k); let m = null; try { const s = await memDocG(k).get(); m = s.exists ? (s.data() || {}) : null; } catch (_) { m = null; } memCacheG.set(k, m); return m; }
  async function memLoadG(keys) { const need = [...new Set(keys.filter(k => k && !memCacheG.has(k)))]; if (!need.length) return; try { const got = await db.getAll(...need.map(k => memDocG(k))); need.forEach((k, i) => memCacheG.set(k, (got[i] && got[i].exists) ? (got[i].data() || {}) : null)); } catch (e) { need.forEach(k => memCacheG.set(k, null)); } }
  function memNoteG(k, o) { if (!k) return; const b = memBufG.get(k) || { seller: new Set(), buyer: new Set(), leadIds: new Set(), brands: {}, name: '', lastRole: '' }; if (o.role) b.lastRole = String(o.role).slice(0, 24); if (o.name && !b.name) b.name = String(o.name).slice(0, 120); if (o.postId) { if (o.seller) b.seller.add(String(o.postId).slice(0, 200)); else if (o.buyer) b.buyer.add(String(o.postId).slice(0, 200)); } if (o.leadId) { b.leadIds.add(String(o.leadId)); if (o.brand) b.brands[brandKeyG(o.brand)] = { lastLeadId: String(o.leadId), lastLeadAt: Date.now() }; } memBufG.set(k, b); }
  async function memFlushG() { if (!memBufG.size) return; const ents = [...memBufG]; memBufG.clear(); const now = Date.now();
    for (let i = 0; i < ents.length; i += 300) { const wb = db.batch();
      for (const [k, b] of ents.slice(i, i + 300)) { const m = memCacheG.get(k) || {}; const had = new Set([...(Array.isArray(m.sellerIds) ? m.sellerIds : []), ...(Array.isArray(m.buyerIds) ? m.buyerIds : [])].map(String)); const sNew = [...b.seller].filter(p => !had.has(p)), bNew = [...b.buyer].filter(p => !had.has(p) && !b.seller.has(p));
        const p = { key: k, updatedAt: now, expireAt: new Date(now + MEM_TTL_DAYS_G * 86400e3) }; if (b.name) p.name = b.name; if (b.lastRole) { p.lastRole = b.lastRole; p.lastAt = now; }
        if (sNew.length) { p.sellerHits = FieldValue.increment(sNew.length); p.sellerIds = FieldValue.arrayUnion(...sNew.slice(0, 20)); p.lastSellerAt = now; }
        if (bNew.length) { p.buyerHits = FieldValue.increment(bNew.length); p.buyerIds = FieldValue.arrayUnion(...bNew.slice(0, 20)); p.lastBuyerAt = now; }
        if (b.leadIds.size) p.leadIds = FieldValue.arrayUnion(...[...b.leadIds].slice(0, 5)); if (Object.keys(b.brands).length) p.brands = b.brands;
        wb.set(memDocG(k), p, { merge: true }); }
      try { await wb.commit(); } catch (e) { console.warn('[LENH G] ghi author_memory lỗi:', e && e.message); } } }`);
const G2 = "  const seenUpdB = new Map(); const SEEN_DEC_B = { lead: 'lead', scored_low: 'low', prefiltered_out: 'pre', excluded: 'ex', no_keyword: 'ex', self_comment: 'self', seller: 'seller', too_old: 'old' }; /* LENH D */";
A('index', 'G2 SEEN_DEC_B seller_known', G2, "  const seenUpdB = new Map(); const SEEN_DEC_B = { lead: 'lead', scored_low: 'low', prefiltered_out: 'pre', excluded: 'ex', no_keyword: 'ex', self_comment: 'self', seller: 'seller', too_old: 'old', seller_known: 'seller' /* LENH G */ }; /* LENH D */");
const G3 = "      comment_url: x.post.comment_url || '',\n      decision: fields.decision || 'scored_low',";
A('index', 'G3 recordPost author_key/memHits', G3, "      comment_url: x.post.comment_url || '',\n      author_key: authorKeyG(x.post.user_url, x.post.author_uid), memHits: Number(fields.memHits) || 0, /* LENH G (PC-3): khoá người viết (web: nút Không phải người bán) · số bài AI đã chấm seller */\n      decision: fields.decision || 'scored_low',");
const G4 = "    const tooOldD = (p) => { const lim = Math.max(1, Number(CFG.TOO_OLD_DAYS) || 45) * 86400e3; const t = tsMsB(p && p.time); return !!(t > 0 && (Date.now() - t) > lim); }; /* LENH D (PB-9): bài đăng quá cũ (time không đọc được → không chặn) */";
A('index', 'G4 Pha 2 đọc author_memory theo lô', G4, "    await memLoadG(slice.map(x => authorKeyG(x.post.user_url, x.post.author_uid))); /* LENH G (PC-3): đọc bộ nhớ người viết theo LÔ (1 getAll/lô, như seen) */\n" + G4);
const G5 = "      if (x.post.self_comment) { selfSkipped++; recordPost(x, { decision: 'self_comment' }); return; } /* v-selfcmt: chủ bài tự bình luận → không phải lead, không gọi AI */";
A('index', 'G5 Pha 2 cổng người bán quen', G5, G5 + "\n      { const kG = authorKeyG(x.post.user_url, x.post.author_uid), mG = kG ? memCacheG.get(kG) : null; if (!force && sellerKnownOfG(mG)) { sellerKnownG++; recordPost(x, { decision: 'seller_known', role: 'seller', memHits: Number(mG.sellerHits) || 0 }); return; } } /* LENH G (PC-3): người bán quen (≥2 bài AI chấm seller · 0 lead · 30 ngày) → không tốn AI; force (Quét lại từ đầu) vẫn chấm */");
const G6 = "      intent: ai.intent || '', service: ai.service || '', kept: isLead, role: __role, ai_v2: ai.ai_v2 || null }); /* LENH E: decision 'reseller' (brand không bán sỉ) + ai_v2 */";
A('index', 'G6 Pha 3b nuôi bộ nhớ', G6, G6 + "\n    const kG = authorKeyG(x.post.user_url, x.post.author_uid); if (kG && ai._llm !== false) memNoteG(kG, { role: __role, name: x.post.author, postId: x.post.post_id, seller: __role === 'seller', buyer: isLead }); /* LENH G (PC-3): chỉ phán quyết THẬT của AI (không đếm dự phòng), mỗi bài 1 lần */");
const G7 = "    await commitLeadNow(x.row, { ...__pf,";
A('index', 'G7 khách cũ quay lại (đọc bộ nhớ theo brand)', G7, R`    let __retG = {}; try { const mG = kG ? await memGetG(kG) : null; const eG = returningOfG(mG, x.brandB || brandBySource[x.post.source] || ''); if (eG) { const oS = await db.collection('leads').doc(String(eG.lastLeadId)).get(); const oD = oS.exists ? (oS.data() || {}) : null; if (oD) { __retG = { returning: true, returning_lead_id: String(eG.lastLeadId), returning_stage: String(eG.lastStage || ''), returning_at: Number(eG.lastStageAt) || 0, returning_assignee_uid: String(oD.assignee_uid || ''), returning_assignee: String(oD.assignee || '') }; returningG++; } } } catch (e) { __retG = {}; } /* LENH G (PC-3): khách cũ của brand này quay lại → cờ + push (push.js) */
    const __leadG = { ...__pf, ...__retG, /* LENH G */`);
const G8 = "      detected_at: FieldValue.serverTimestamp()\n    });\n    await settle48(x); // LENH #48: ghi lead xong mới gỡ lease/doc chờ";
A('index', 'G8 ghi lead + ghi chú khách cũ + lead id vào bộ nhớ', G8, R`      detected_at: FieldValue.serverTimestamp()
    }; const __okG = await commitLeadNow(x.row, __leadG); /* LENH G */
    await settle48(x); // LENH #48: ghi lead xong mới gỡ lease/doc chờ
    if (typeof __okG === 'string' && kG) { memNoteG(kG, { leadId: __okG, brand: x.brandB || __leadG.brand_hint || brandBySource[x.post.source] || '' }); /* LENH G (PC-3): lead mới của người này */
      if (__retG.returning) { try { const dG = __retG.returning_at ? new Date(__retG.returning_at + 7 * 3600e3).toISOString() : ''; await db.collection('leads').doc(__okG).collection('notes').add({ leadId: __okG, brand: String(x.brandB || __leadG.brand_hint || ''), vis: 'team', text: '🔁 Khách cũ quay lại: từng "' + stageViG(__retG.returning_stage) + '"' + (dG ? ' ngày ' + dG.slice(8, 10) + '/' + dG.slice(5, 7) : '') + (__retG.returning_assignee ? ' (' + __retG.returning_assignee + ' phụ trách)' : '') + ' — lead cũ ' + __retG.returning_lead_id + '. Ưu tiên gọi lại.', by_uid: 'engine', by_name: 'Bộ nhớ người viết (tự động)', at: Date.now() }); } catch (_) {} } }`);
const G9 = "    if (lead && lead.phone) row.ekyc = (row.ekyc || 0) + 1; // v-patch chi-phí: 1 lead có SĐT ≈ 1 lượt check eKYC\n    return true;";
A('index', 'G9 commitLeadNow trả id doc mới', G9, "    if (lead && lead.phone) row.ekyc = (row.ekyc || 0) + 1; // v-patch chi-phí: 1 lead có SĐT ≈ 1 lượt check eKYC\n    return ref.id || true; /* LENH G (PC-3): trả id doc MỚI (gộp multitouch ở trên vẫn trả true) */");
const G10 = "          await c.ref.set(up, { merge: true }); rescoredLeads46++;";
A('index', 'G10 sweeper nuôi bộ nhớ', G10, G10 + " { const kG = authorKeyG(l.author_url, l.author_uid); if (kG && ai._llm !== false) memNoteG(kG, { role, name: l.name, postId: l.post_id || c.id, seller: role === 'seller', buyer: isLead }); } /* LENH G (PC-3): chấm lại điểm tạm cũng nuôi bộ nhớ */");
const G11 = "  const durationMs = Date.now() - t0;";
A('index', 'G11 flush author_memory cuối lượt', G11, "  await memFlushG(); /* LENH G (PC-3): ghi author_memory theo lô (increment + arrayUnion, dedup theo bài) */\n" + G11);
const G12 = "    cmtExtra: cmtExtraF, phoneFromCmt: phoneCmtF, /* LENH F (PA-5) */";
A('index', 'G12 scans summary', G12, G12 + "\n    sellerKnown: sellerKnownG, returning: returningG, /* LENH G (PC-3) */");
const G13 = "export * from './contactcf.js'; /* LENH F (PA-5): zaloCheckLead — Dùng số này + Kiểm Zalo từ web */";
A('index', 'G13 export authmemcf.js', G13, G13 + "\nexport * from './authmemcf.js'; /* LENH G (PC-3): clearAuthorMemory — super gỡ nhãn / đánh dấu người bán quen */");

/* ================= (2) stats.js ================= */
const S1 = "export const statsOnLead = onDocumentWritten({ document: 'leads/{id}', region: REGION, memory: '256MiB', maxInstances: 10 }, async (ev) => {";
A('stats', 'S1 helper authorKeyG/stageMemG', S1, R`/* LENH G (13/09/2026) — PC-3 bộ nhớ người viết: lead của brand đổi giai đoạn responded/booked/closed → author_memory/{key}.brands.<brand> = { lastStage, lastStageAt, lastLeadId }
   (khoá = link hồ sơ id:<uid>/u:<username> hoặc author_uid số — cùng công thức __slProfileKey31 của scanner; KHÔNG khoá theo tên). Scanner đọc ở Pha 3b → lead mới của khách cũ mang cờ returning + push. Hàm thuần → harness. */
export function authorKeyG(url, uid) { const s = String(url || '').trim(); let m = s.match(/profile\.php\?id=(\d+)/) || s.match(/\/people\/[^/]+\/(\d+)/); if (m) return 'id:' + m[1]; m = s.match(/facebook\.com\/([A-Za-z0-9.]{3,})\/?(?:[?#]|$)/); if (m && !/^(groups|people|profile\.php|photo|photos|watch|share|reel|reels|stories|events|pages|marketplace|hashtag|posts|permalink\.php|story\.php)$/i.test(m[1])) return 'u:' + m[1].toLowerCase(); const u = String(uid || '').trim(); return /^\d{5,}$/.test(u) ? 'id:' + u : ''; }
export const memIdG = k => String(k || '').replace(/[^\w.:-]/g, '_').slice(0, 300);
export const brandKeyG = b => String(b || '').replace(/[^\w-]/g, '_').slice(0, 60);
const STAGE_MEM_G = new Set(['responded', 'booked', 'closed']);
export function stageMemG(before, after) { const st = String((after && after.stage) || ''), bst = String((before && before.stage) || ''); if (!STAGE_MEM_G.has(st) || st === bst) return null; const key = authorKeyG(after.author_url, after.author_uid); return key ? { key, stage: st } : null; }
` + S1);
const S2 = "  const slaBad = await slaBadOf(brand, before, after); // LENH #40";
A('stats', 'S2 statsOnLead ghi lastStage', S2, "  { const mg = stageMemG(before, after); if (mg) { try { if (!getApps().length) initializeApp(); const idL = String((ev.params && ev.params.id) || (ev.data.after && ev.data.after.id) || ''); await getFirestore().collection('author_memory').doc(memIdG(mg.key)).set({ key: mg.key, name: String(after.name || '').slice(0, 120), updatedAt: Date.now(), expireAt: new Date(Date.now() + 180 * 86400e3), brands: { [brandKeyG(brand)]: { lastStage: mg.stage, lastStageAt: Date.now(), lastLeadId: idL } } }, { merge: true }); } catch (e) { console.warn('[LENH G] author_memory stage', e && e.message); } } } /* LENH G (PC-3): khách của brand này (responded/booked/closed) → bộ nhớ người viết */\n" + S2);

/* ================= (3) push.js ================= */
const P1 = "export const pushOnLead = onDocumentWritten(";
A('push', 'P1 returningGateG', P1, R`/* LENH G (13/09/2026) — PC-3: lead MỚI mang cờ returning (scanner đặt khi author_memory nói brand này từng responded/booked/closed) → push "Khách cũ quay lại" ĐÚNG 1 LẦN
   (before chưa có cờ) tới người từng phụ trách lead cũ (returning_assignee_uid), không có → admin brand (+ super). Thay push "Lead nóng mới" ở cùng lần ghi. Hàm thuần → harness. */
export function returningGateG(before, after) {
  if (!after || after.returning !== true || !after.returning_lead_id || after.dropped || after.lost) return '';
  if (!String((after.brand || after.brand_hint) || '').trim()) return '';
  return (before && before.returning === true) ? '' : 'returning';
}
const STAGE_VI_G = s => ({ responded: 'đã phản hồi', booked: 'đã hẹn tư vấn', closed: 'đã chốt' })[String(s || '')] || String(s || '');
` + P1);
const P2 = "  const whyC = hotGateC(before, after); if (whyC) { /* LENH C (PB-10): thay điều kiện #46 bằng hotGateC (brand/brand_hint xuất hiện · AI chấm lại điểm tạm → nóng) */";
A('push', 'P2 nhánh push khách cũ', P2, R`  if (returningGateG(before, after)) { /* LENH G (PC-3): khách cũ quay lại → người từng phụ trách (không có → admin brand + super) */
    const uidsG = after.returning_assignee_uid ? [after.returning_assignee_uid] : await brandAdmins(brand);
    const nG = await send(await tokensFor(uidsG), { title: '🔁 Khách cũ quay lại' + (after.score ? ' (' + after.score + 'đ)' : '') + ': ' + name, body: ('Từng ' + STAGE_VI_G(after.returning_stage) + (after.returning_assignee ? ' · ' + after.returning_assignee + ' phụ trách' : '') + ' · ' + String(after.need || after.intent || '')).slice(0, 120), link: SITE + '#feed', tag: 'ret-' + id, require: '1', actionTitle: 'Mở lead' });
    console.log('push returning', id, 'sent', nG); return; }
` + P2);

for (const f of Object.keys(ops)) for (const [, from, to] of ops[f]) files[f] = files[f].replace(from, () => to);
for (const f of Object.keys(ops)) { for (const [label, , to] of ops[f]) { if (files[f].split(to).length - 1 !== 1) { console.error('DỪNG: sau thay mốc ' + label + ' (' + f + ') không đúng 1 lần — KHÔNG ghi gì.'); process.exit(1); } } if (!/LENH G\b/.test(files[f])) { console.error('DỪNG: ' + f + ' sau vá không có marker LENH G — KHÔNG ghi gì.'); process.exit(1); } }
fs.writeFileSync(FI, files.index); fs.writeFileSync(FS, files.stats); fs.writeFileSync(FP, files.push);
console.log('PATCH OK 3 file (LENH G): index.js ' + ops.index.length + ' mốc · stats.js ' + ops.stats.length + ' mốc · push.js ' + ops.push.length + ' mốc — author_memory (đọc lô Pha 2 · seller_known · returning + ghi chú · sweeper · flush cuối lượt · scans sellerKnown/returning · scanned_posts author_key) · stats lastStage theo brand · push khách cũ quay lại · export authmemcf.js');
