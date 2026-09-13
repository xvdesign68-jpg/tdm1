# bash — LỆNH G · KHỐI 1 (13/09/2026) — Đợt 2.5 PC-3 "BỘ NHỚ NGƯỜI VIẾT" (author_memory): người bán quen bỏ TRƯỚC AI (không tốn tiền) · khách cũ quay lại được cờ + ghi chú + push tới người từng phụ trách · CF clearAuthorMemory (super gỡ nhãn / đánh dấu người bán) · Rules đọc author_memory + ai_feedback (super) · TTL 180 ngày
#   Mốc trên mã SAU LỆNH F (index.js có marker LENH F; stats.js/push.js có marker LENH C). Patch 3 file index.js (13 mốc) · stats.js (2) · push.js (2), marker LENH G, fail-closed NGUYÊN TỬ, idempotent + file MỚI authmemcf.js + `export * from './authmemcf.js'` + Rules 2 block.
#   Khoá người viết = link hồ sơ (id:<uid> | u:<username>) hoặc author_uid số — KHÔNG khoá theo tên (anh chốt). Người bán quen = ≥2 bài KHÁC NHAU AI chấm seller · 0 bài thành lead · 30 ngày; force (Quét lại từ đầu) vẫn chấm. Không worker.
#   Thứ tự: backup .bak-<TS> (3 file + firestore.rules + authmemcf.js nếu có) → chép authmemcf.js → patch 3 file → Rules → node --check → import test (.env) → deploy rules + scheduledScan + manualScan + statsOnLead + pushOnLead + clearAuthorMemory (gated "Deploy complete") → TTL author_memory.expireAt → describe 5 function.
# Dán: tạo file /tmp/lg.sh bằng heredoc quoted rồi bash /tmp/lg.sh   (không shebang, không dấu chấm than ngoài heredoc — Cloud Shell history-expand)
set -o pipefail
cd ~/firebase-s13/functions || { echo 'DỪNG: không vào được ~/firebase-s13/functions'; exit 1; }
TS=$(date -u +%Y%m%d-%H%M%S); echo "backup TS=$TS (giờ UTC)"
cat > _lg_patch.cjs <<'EOF_PATCH'
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
EOF_PATCH
cat > _lg_authmemcf.js <<'EOF_CF'
/* authmemcf.js — LỆNH G (13/09/2026) PC-3 "bộ nhớ người viết":
   CF clearAuthorMemory (onRequest, Bearer idToken; region asia-southeast1; cors) — CHỈ Super Admin. body { key? | author_url? + author_uid?, action: 'clear' | 'seller', post_url?, note? }
   'clear'  = "Không phải người bán": xoá nhãn người bán quen (sellerHits 0, sellerIds [], lastRole '', lastSellerAt 0, clearedAt/By) — bài của người này lại được AI chấm bình thường;
   'seller' = "Đánh dấu người bán": sellerHits 2 + buyerHits 0 + lastSellerAt now + markedBy → mọi bài mới của người này bỏ trước AI (30 ngày, tự hết hạn; sau đó AI chấm lại).
   Mỗi thao tác ghi 1 doc ai_feedback {kind, key, by, at, post_url, note} (nuôi PC-1 Sổ tay brand). Ghi bằng Admin SDK (Rules author_memory/ai_feedback write=false). Khởi tạo LƯỜI (bài học LỆNH #10). Không secret. */
import { onRequest } from 'firebase-functions/v2/https';
import { getApps, initializeApp } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore } from 'firebase-admin/firestore';
const REGION = 'asia-southeast1';
function ensureApp() { if (!getApps().length) initializeApp(); }
const db = () => { ensureApp(); return getFirestore(); };
export function authorKeyOfG(url, uid) { const s = String(url || '').trim(); let m = s.match(/profile\.php\?id=(\d+)/) || s.match(/\/people\/[^/]+\/(\d+)/); if (m) return 'id:' + m[1]; m = s.match(/facebook\.com\/([A-Za-z0-9.]{3,})\/?(?:[?#]|$)/); if (m && !/^(groups|people|profile\.php|photo|photos|watch|share|reel|reels|stories|events|pages|marketplace|hashtag|posts|permalink\.php|story\.php)$/i.test(m[1])) return 'u:' + m[1].toLowerCase(); const u = String(uid || '').trim(); return /^\d{5,}$/.test(u) ? 'id:' + u : ''; }
export const memIdOfG = k => String(k || '').replace(/[^\w.:-]/g, '_').slice(0, 300);
async function verifySuper(req) {
  const m = /^Bearer (.+)$/.exec(req.get('Authorization') || ''); if (!m) return null;
  let dec; try { ensureApp(); dec = await getAuth().verifyIdToken(m[1]); } catch (e) { return null; }
  const email = String(dec.email || '').toLowerCase(); const superEmail = String(process.env.SUPER_EMAIL || '').toLowerCase();
  if (superEmail && email === superEmail) return { uid: dec.uid, email, role: 'superadmin' };
  let d = {}; try { const s = await db().collection('users').doc(dec.uid).get(); d = s.exists ? (s.data() || {}) : {}; } catch (e) { d = {}; }
  return { uid: dec.uid, email, role: (d.role === 'superadmin' && d.active !== false) ? 'superadmin' : String(d.role || 'pending') };
}
export const clearAuthorMemory = onRequest({ region: REGION, cors: true }, async (req, res) => {
  const caller = await verifySuper(req); if (!caller) { res.status(401).json({ error: 'unauthenticated' }); return; }
  if (caller.role !== 'superadmin') { res.status(403).json({ error: 'forbidden', message: 'Chỉ Super Admin' }); return; }
  const b = (req.body && typeof req.body === 'object') ? req.body : {};
  const key = String(b.key || '').trim() || authorKeyOfG(b.author_url, b.author_uid);
  if (!key || !/^(id:\d{5,}|u:[a-z0-9.]{3,})$/.test(key)) { res.status(400).json({ error: 'bad_request', message: 'Cần khoá người viết (id:<uid> | u:<username>) hoặc author_url/author_uid giải mã được' }); return; }
  const action = b.action === 'seller' ? 'seller' : 'clear'; const now = Date.now(); const ref = db().collection('author_memory').doc(memIdOfG(key));
  const up = action === 'seller'
    ? { key, sellerHits: 2, buyerHits: 0, lastRole: 'seller', lastSellerAt: now, lastAt: now, markedAt: now, markedBy: caller.email, updatedAt: now, expireAt: new Date(now + 180 * 86400e3) }
    : { key, sellerHits: 0, sellerIds: [], lastRole: '', lastSellerAt: 0, clearedAt: now, clearedBy: caller.email, updatedAt: now, expireAt: new Date(now + 180 * 86400e3) };
  await ref.set(up, { merge: true });
  try { await db().collection('ai_feedback').add({ kind: action === 'seller' ? 'mark_seller' : 'not_seller', key, by: caller.email, by_uid: caller.uid, at: now, post_url: String(b.post_url || '').slice(0, 300), note: String(b.note || '').slice(0, 300) }); } catch (e) { console.warn('[LENH G] ai_feedback', e && e.message); }
  res.json({ ok: true, key, action });
});
EOF_CF
cat > _lg_rules.cjs <<'EOF_RULES'
/* LỆNH G — Rules: 2 block đọc cho web (zip v119-93): author_memory (bộ nhớ người viết — scanner/stats ghi) + ai_feedback (phản hồi super: không phải người bán / đánh dấu người bán — CF ghi) · read = super, write = false.
   Chèn 1 dòng/block ngay sau `match /databases/{database}/documents {` (cách LỆNH #23/C). Idempotent (block đã có → bỏ qua). Fail-closed: mốc ≠ 1 → dừng, không ghi.
   Dùng: node functions/_lg_rules.cjs   (cwd = ~/firebase-s13) */
const fs = require('fs'); const f = process.argv[2] || 'firestore.rules';
let s = fs.readFileSync(f, 'utf8');
const B1 = "    match /author_memory/{k} { allow read: if isSuperAdmin(); allow write: if false; } /* LENH G */\n";
const B2 = "    match /ai_feedback/{k} { allow read: if isSuperAdmin(); allow write: if false; } /* LENH G */\n";
const hasAM = /match \/author_memory\//.test(s), hasAF = /match \/ai_feedback\//.test(s);
if (hasAM && hasAF) { console.log('đã vá (Rules đã có block author_memory + ai_feedback) — idempotent, bỏ qua'); process.exit(0); }
const D = /match \/databases\/\{database\}\/documents \{[ \t]*\n/; const nd = (s.match(new RegExp(D.source, 'g')) || []).length;
if (nd !== 1) { console.error('KHONG THAY MOC "match /databases/{database}/documents {" (đếm ' + nd + ', cần 1) — KHÔNG ghi gì'); process.exit(1); }
if (!/function isSuperAdmin\(\)/.test(s)) { console.error('Rules không có helper isSuperAdmin() — KHÔNG ghi gì'); process.exit(1); }
s = s.replace(D, m => m + (hasAM ? '' : B1) + (hasAF ? '' : B2));
fs.writeFileSync(f, s); console.log('PATCH OK firestore.rules: block đọc ' + [!hasAM ? 'author_memory' : '', !hasAF ? 'ai_feedback' : ''].filter(Boolean).join(' + ') + ' (super, write=false) (LENH G)');
EOF_RULES
cat > _lg_after.mjs <<'EOF_AFTER'
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
EOF_AFTER
node --check _lg_patch.cjs && node --check _lg_authmemcf.js && node --check _lg_rules.cjs && node --check _lg_after.mjs || { echo 'DỪNG: script lỗi cú pháp (chưa đụng gì)'; rm -f _lg_patch.cjs _lg_authmemcf.js _lg_rules.cjs _lg_after.mjs; exit 1; }
echo "=== (a) guard + backup + chép authmemcf.js + patch 3 file + Rules ==="
for f in index.js stats.js push.js ../firestore.rules; do [ -f "$f" ] || { echo "DỪNG: thiếu $f"; rm -f _lg_authmemcf.js; exit 1; }; done
grep -q "LENH F" index.js || { echo 'DỪNG: index.js chưa có marker LENH F — LỆNH G đặt mốc trên mã SAU LỆNH F. Chạy LỆNH E rồi F trước.'; rm -f _lg_authmemcf.js; exit 1; }
grep -q "LENH C" stats.js && grep -q "hotGateC" push.js || { echo 'DỪNG: stats.js/push.js chưa có marker LENH C (hotGateC) — gửi em output'; rm -f _lg_authmemcf.js; exit 1; }
if grep -q "LENH G" index.js && [ -f _lg_backup_ts ]; then TSB=$(cat _lg_backup_ts); echo "index.js ĐÃ có marker LENH G (chạy lại) — KHÔNG tạo .bak mới; bản gốc trước LENH G = *.bak-$TSB"
elif grep -q "LENH G" index.js; then echo "DỪNG: index.js đã có marker LENH G nhưng thiếu _lg_backup_ts — khôi phục từ .bak-<TS gốc> hoặc gửi em output"; rm -f _lg_authmemcf.js; exit 1
else TSB=$TS; for f in index.js stats.js push.js; do cp "$f" "$f.bak-$TSB" || { echo "DỪNG: không backup được $f"; exit 1; }; done; cp ../firestore.rules "../firestore.rules.bak-$TSB" || { echo 'DỪNG: không backup được firestore.rules'; exit 1; }; [ -f authmemcf.js ] && cp authmemcf.js "authmemcf.js.bak-$TSB"; echo "$TSB" > _lg_backup_ts
fi
mv -f _lg_authmemcf.js authmemcf.js
restore() { for f in index.js stats.js push.js; do cp "$f.bak-$TSB" "$f"; done; cp "../firestore.rules.bak-$TSB" ../firestore.rules; echo "ĐÃ KHÔI PHỤC index.js/stats.js/push.js/firestore.rules từ .bak-$TSB (authmemcf.js để nguyên — không được export nên vô hại)"; }
describe5() { for f in scheduledScan manualScan statsOnLead pushOnLead clearAuthorMemory; do gcloud functions describe "$f" --region asia-southeast1 --gen2 --format='value(name,state,updateTime)' 2>/dev/null | sed 's|projects/smartlead-z15/locations/asia-southeast1/functions/||' || echo "(describe $f lỗi)"; done; }
node _lg_patch.cjs index.js stats.js push.js || { echo 'DỪNG (a): patch không áp — KHÔNG ghi gì. Gửi em output.'; exit 1; }
node --check index.js && node --check stats.js && node --check push.js && node --check authmemcf.js || { echo 'DỪNG (a): lỗi cú pháp sau patch'; restore; exit 1; }
node _lg_rules.cjs ../firestore.rules || { echo 'DỪNG (a): Rules không áp'; restore; exit 1; }
echo "marker LENH G: index.js $(grep -c 'LENH G' index.js) · stats.js $(grep -c 'LENH G' stats.js) · push.js $(grep -c 'LENH G' push.js) · rules $(grep -c 'LENH G' ../firestore.rules) dòng · authmemcf.js $(wc -l < authmemcf.js) dòng"
echo "=== (b) import test (.env) ==="
set -a; . ./.env; set +a
node --input-type=module -e "const m=await import('./index.js'); const st=await import('./stats.js'); const pu=await import('./push.js'); const am=await import('./authmemcf.js'); const okA = (typeof m.scheduledScan==='function' && typeof m.manualScan==='function' && typeof st.statsOnLead==='function' && typeof pu.pushOnLead==='function' && typeof m.clearAuthorMemory==='function' && st.authorKeyG('https://www.facebook.com/profile.php?id=100012345678901')==='id:100012345678901' && st.authorKeyG('https://www.facebook.com/nguyen.van.a?x=1')==='u:nguyen.van.a' && st.authorKeyG('','100055555555555')==='id:100055555555555' && st.authorKeyG('https://www.facebook.com/groups/1/')==='' && st.stageMemG({stage:'new'},{stage:'booked',author_uid:'100012345678901'}).stage==='booked' && st.stageMemG({stage:'new'},{stage:'contacted',author_uid:'100012345678901'})===null && pu.returningGateG(null,{returning:true,returning_lead_id:'x',brand_hint:'b'})==='returning' && pu.returningGateG({returning:true},{returning:true,returning_lead_id:'x',brand:'b'})==='' && am.authorKeyOfG('https://www.facebook.com/people/T/100011112222333/')==='id:100011112222333'); console.log('IMPORT OK · scheduledScan', typeof m.scheduledScan, '· statsOnLead', typeof st.statsOnLead, '· pushOnLead', typeof pu.pushOnLead, '· clearAuthorMemory', typeof m.clearAuthorMemory, '· authorKeyG', st.authorKeyG('https://www.facebook.com/profile.php?id=100012345678901'), st.authorKeyG('https://www.facebook.com/nguyen.van.a?x=1'), '· stageMemG booked', JSON.stringify(st.stageMemG({stage:'new'},{stage:'booked',author_uid:'100012345678901'})), '· returningGateG', pu.returningGateG(null,{returning:true,returning_lead_id:'x',brand_hint:'b'})); if (okA === false) { console.log('IMPORT: giá trị SAI'); process.exit(1); }" || { echo "DỪNG (b): import/ca kiểm sai — khôi phục"; restore; exit 1; }
echo "=== (c) deploy Rules + scheduledScan + manualScan + statsOnLead + pushOnLead + clearAuthorMemory ==="
cd ~/firebase-s13 && firebase deploy --only firestore:rules,functions:scheduledScan,functions:manualScan,functions:statsOnLead,functions:pushOnLead,functions:clearAuthorMemory > /tmp/lg_deploy.log 2>&1; RC=$?; tail -8 /tmp/lg_deploy.log
[ "$RC" = "0" ] && grep -q "Deploy complete" /tmp/lg_deploy.log || { echo "DEPLOY LỖI (RC=$RC) — firebase deploy đưa Rules rồi từng function lên lần lượt nên lỗi giữa chừng = MỘT PHẦN đã lên; bảng describe dưới: updateTime ≥ $TS = đã lên bản mới. Cách xử lý: chạy LẠI đúng lệnh deploy ở (c) (idempotent) — hoặc quay lui: cd ~/firebase-s13/functions; for f in index.js stats.js push.js; do cp \$f.bak-$TSB \$f; done; cp ../firestore.rules.bak-$TSB ../firestore.rules; cd ~/firebase-s13; firebase deploy --only firestore:rules,functions:scheduledScan,functions:manualScan,functions:statsOnLead,functions:pushOnLead"; describe5; exit 1; }
echo "=== (d) TTL author_memory.expireAt (180 ngày, tự dọn người viết không hoạt động) ==="
gcloud firestore fields ttls update expireAt --collection-group=author_memory --enable-ttl --project=smartlead-z15 --quiet > /tmp/lg_ttl.log 2>&1 && echo "TTL author_memory.expireAt: OK (ACTIVE sau vài phút)" || echo "TTL author_memory.expireAt: CHƯA bật (xem /tmp/lg_ttl.log) — không chặn, gửi em output"
describe5
echo "=== XONG KHỐI 1 (exit=0) — KHỐI 2 (sau ≥ 15′; bộ nhớ đầy dần sau vài ngày quét): cd ~/firebase-s13/functions && node _lg_after.mjs · web: deploy zip v119-93 (chip Khách cũ + Bài đã quét seller_known + nút Không phải người bán / Đánh dấu người bán) ==="
