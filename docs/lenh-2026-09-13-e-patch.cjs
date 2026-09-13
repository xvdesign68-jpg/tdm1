/* LỆNH E (13/09/2026) — CHẤM ĐIỂM v2 = Đợt 2.2 (PA-1) + Đợt 2.3 (PC-2) báo cáo rà soát quét→lọc→chấm điểm 11/09 (anh chốt câu 3 + câu 7 ngày 12/09).
   PA-1  prompt chấm điểm theo BRAND TỪ ĐẦU (Hồ sơ AI brands/{code}.ai: ngành · sản phẩm · khách · giọng) thay prompt "agency marketing" + khối đè (L-2);
         vai mới: reseller (đại lý / mua sỉ / mua để bán lại — CHỈ là lead khi brand bật cờ ai.banSi) · proxy (đăng hộ — LÀ lead, liên hệ qua người đăng: contact_via_poster) (N2-6);
         hợp đồng JSON chặt: is_real_lead chuẩn hoá bool, hotness 0–1 → ×100 (N2-12); role rỗng/other KHÔNG chặn — chỉ đếm scans.roleUnknown (critic);
         brand chưa có Hồ sơ AI → prompt trung tính SME + scans.noProfileBrands (web cảnh báo).
   PC-2  AI trả 6 tiêu chí con 0–3 = đúng 6 key config/app.weights (intent · fit · timing · industry · area · quality) + confidence + why[] → hotness_v2 = Σ w·c/3 ÷ Σ w × 100 tính bằng CODE (C-1/F-B1);
         CHẠY BÓNG: scoreV2 = 'shadow' (mặc định) → score/temp VẪN theo hotness AI (raw), ghi thêm ai_v2 lên lead + scanned_posts + scans.distV2 để so (`_pc2_shadow.mjs`); 'on' → score = hotness_v2; 'off' → không ghi ai_v2.
   Công tắc: .env PROMPT_BRAND_V2 (true) / SCORE_V2 (shadow) — config/app.scoring {promptV2:bool, scoreV2:'off'|'shadow'|'on'} ghi đè (web, không cần deploy).
   3 file: lib/config.js (2 khoá) · lib/scorer.js (normRole + prompt v2 + chuẩn hoá + helper) · index.js (v2E theo lượt, prefilter/scoreLead/sweeper truyền v2, cổng reseller/proxy, ai_v2 lên lead/scanned_posts, scans.distV2/roleUnknown/noProfileBrands).
   Marker `LENH E`. FAIL-CLOSED NGUYÊN TỬ: mỗi mốc đúng 1 lần ở CẢ 3 file mới ghi (thiếu 1 mốc → không ghi file nào). Idempotent. Mốc = mã sau LỆNH #49 (đòi marker LENH #49 ở scraper KHÔNG cần; đòi LENH #48 + LENH D ở index/scorer/config).
   Dùng: node _le_patch.cjs lib/config.js lib/scorer.js index.js   (cwd = ~/firebase-s13/functions) */
'use strict';
const fs = require('fs');
const [FC, FS, FI] = process.argv.slice(2);
if (!FC || !FS || !FI) { console.error('cần 3 đường dẫn: lib/config.js lib/scorer.js index.js'); process.exit(2); }
const files = { config: FC, scorer: FS, index: FI };
const src = {}; for (const k of Object.keys(files)) src[k] = fs.readFileSync(files[k], 'utf8');
const has = Object.keys(files).filter(k => /LENH E\b/.test(src[k]));
if (has.length === 3) { console.log('đã vá (marker LENH E có sẵn ở 3 file) — idempotent, bỏ qua'); process.exit(0); }
if (has.length) { console.error('DỪNG: LỆCH — marker LENH E chỉ có ở ' + has.join(', ') + ' (không phải cả 3). Khôi phục từ .bak rồi chạy lại. KHÔNG ghi gì.'); process.exit(1); }
if (!/LENH #48/.test(src.scorer) || !/LENH #48/.test(src.index) || !/LENH D\b/.test(src.index) || !/LENH D\b/.test(src.config) || !/LENH C\b/.test(src.index)) { console.error('DỪNG: thiếu marker LENH #48 / LENH C / LENH D (mốc E đặt trên mã sau #49). KHÔNG ghi gì.'); process.exit(1); }
const ops = { config: [], scorer: [], index: [] };
const A = (k, label, from, to) => { const n = src[k].split(from).length - 1; if (n !== 1) { console.error('DỪNG: mốc ' + label + ' (' + files[k] + ') gặp ' + n + ' lần (cần đúng 1). KHÔNG ghi gì.'); process.exit(1); } ops[k].push([label, from, to]); };

/* ===================== lib/config.js ===================== */
A('config', 'C1 khoá PROMPT_BRAND_V2/SCORE_V2',
  "  PREFILTERED_TTL_DAYS: num(env.PREFILTERED_TTL_DAYS, 14),",
  "  /* LENH E (13/09/2026): chấm điểm v2 — prompt theo BRAND + vai reseller/proxy (PA-1) · 6 tiêu chí con → hotness tính bằng code, chạy bóng (PC-2). config/app.scoring {promptV2, scoreV2} ghi đè (web) */\n" +
  "  PROMPT_BRAND_V2: bool(env.PROMPT_BRAND_V2, true),           // true = prompt dựng theo Hồ sơ AI brand (+ criteria/role mới); false = prompt agency cũ 100 %\n" +
  "  SCORE_V2: String(env.SCORE_V2 || 'shadow'),                  // off = không ghi ai_v2 · shadow = score theo AI, ghi ai_v2 để so · on = score = hotness_v2 (Σ w·c/3)\n" +
  "  PREFILTERED_TTL_DAYS: num(env.PREFILTERED_TTL_DAYS, 14),");

/* ===================== lib/scorer.js ===================== */
A('scorer', 'S1 normRole reseller/proxy',
  "  if (/^(buyer|seller|poster_self|other)$/.test(s)) return s;\n  if (/self|author|tac.?gia|chu.?bai|poster|nguoi.?dang|owner/.test(s)) return 'poster_self';",
  "  if (/^(buyer|seller|poster_self|other|reseller|proxy)$/.test(s)) return s; /* LENH E: + reseller (đại lý/mua sỉ) · proxy (đăng hộ) */\n" +
  "  if (/resell|dai.?ly|mua.?si|ban.?buon|ban.?lai|wholesale|distribut|nhap.?hang|nhap.?si/.test(s)) return 'reseller'; /* LENH E (trước 'seller' vì 'reseller' chứa 'sell') */\n" +
  "  if (/proxy|dang.?ho|hoi.?ho|mua.?ho|tim.?ho|thay.?mat|behalf|nguoi.?than|giup|gium/.test(s)) return 'proxy'; /* LENH E */\n" +
  "  if (/self|author|tac.?gia|chu.?bai|poster|nguoi.?dang|owner/.test(s)) return 'poster_self';");
A('scorer', 'S2 prefilter system prompt',
  "      { role: 'system', content: PRE_SYS + brandAiCtx(brandAi) },",
  "      { role: 'system', content: preSysE(brandAi, opts && opts.v2) }, /* LENH E: tầng 1 theo brand (v2) hoặc PRE_SYS cũ */");
A('scorer', 'S3 scoreLead system prompt',
  "      { role: 'system', content: SYS + brandAiCtx(brandAi) },",
  "      { role: 'system', content: sysE(brandAi, opts.v2) }, /* LENH E: prompt theo brand + criteria/role mới (v2) hoặc SYS cũ */");
A('scorer', 'S4 scoreLead chuẩn hoá v2',
  "    obj.role = normRole(obj.role); obj.role_reason = String(obj.role_reason || '').slice(0, 200); /* v-selfcmt */",
  "    obj.role = normRole(obj.role); obj.role_reason = String(obj.role_reason || '').slice(0, 200); /* v-selfcmt */\n" +
  "    normalizeE(obj, weights, opts.v2); /* LENH E: is_real_lead bool · hotness_raw · criteria → ai_v2 {score,criteria,conf,why} · mode on → hotness = score v2 */");
A('scorer', 'S5 helper v2 (cuối file)',
  "scoreLead.replyOnly48 = replyOnly48; scoreLead.brandKw48 = brandKw48; /* LENH #48 */",
  "scoreLead.replyOnly48 = replyOnly48; scoreLead.brandKw48 = brandKw48; /* LENH #48 */\n" +
  "\n/* ===== LENH E (13/09/2026) — CHẤM ĐIỂM v2: prompt theo BRAND (PA-1) + 6 tiêu chí con → hotness tính bằng code, chạy bóng (PC-2) =====\n" +
  "   scoringModeE(config): công tắc theo lượt = config/app.scoring {promptV2, scoreV2} ghi đè .env PROMPT_BRAND_V2 / SCORE_V2. promptV2=false → prompt cũ 100 % (SYS/PRE_SYS + brandAiCtx), không ai_v2.\n" +
  "   sysE/preSysE: Hồ sơ AI brand (nganh/dichvu/khach/giong/banSi) dựng prompt TỪ ĐẦU (không còn khối \"áp dụng THAY CHO agency\"); brand chưa có hồ sơ → prompt trung tính SME.\n" +
  "   normalizeE: is_real_lead → bool (chuỗi \"false\"/\"no\" = false); hotness 0<h<1 → ×100; criteria 6 key 0–3 (nhận 0–10 / 0–100 rồi quy về 0–3) → hotness_v2 = Σ w·c/3 ÷ Σ w × 100 (w = config/app.weights, thiếu → 30/25/15/12/8/10);\n" +
  "   ai_v2 = {v:1, mode, raw, score, criteria, conf, why[≤3], w} ghi lên lead/scanned_posts; mode 'on' → obj.hotness = score v2 (temp/push/van theo v2); 'shadow' → hotness giữ raw; 'off' → không ai_v2. */\n" +
  "const DEF_W_E = { intent: 30, fit: 25, timing: 15, industry: 12, area: 8, quality: 10 };\n" +
  "const CRIT_E = ['intent', 'fit', 'timing', 'industry', 'area', 'quality'];\n" +
  "const JSON_E = '{\"is_real_lead\":bool,\"hotness\":0-100,\"criteria\":{\"intent\":0-3,\"fit\":0-3,\"timing\":0-3,\"industry\":0-3,\"area\":0-3,\"quality\":0-3},\"confidence\":0-1,\"why\":[tối đa 3 cụm ngắn],\"intent\":string,\"need\":string,\"industry\":string,\"service\":string,\"reply\":string,\"role\":\"buyer|reseller|proxy|seller|poster_self|other\",\"role_reason\":string}';\n" +
  "function scoringModeE(config) {\n" +
  "  const c = (config && typeof config.scoring === 'object' && config.scoring) || {};\n" +
  "  const prompt = (c.promptV2 === undefined || c.promptV2 === null) ? (CFG.PROMPT_BRAND_V2 !== false) : (c.promptV2 === true || c.promptV2 === 'true' || c.promptV2 === 1);\n" +
  "  let mode = String((c.scoreV2 === undefined || c.scoreV2 === null || c.scoreV2 === '') ? (CFG.SCORE_V2 || 'shadow') : c.scoreV2).toLowerCase().trim(); if (!/^(off|shadow|on)$/.test(mode)) mode = 'shadow';\n" +
  "  return { prompt, mode };\n" +
  "}\n" +
  "function v2ModeE(v) { if (v && typeof v === 'object') return { prompt: v.prompt !== false, mode: /^(off|shadow|on)$/.test(String(v.mode || '')) ? String(v.mode) : 'shadow' }; return scoringModeE(null); }\n" +
  "function normBoolE(v) { if (typeof v === 'boolean') return v; if (typeof v === 'number') return v > 0; const s = String(v == null ? '' : v).trim().toLowerCase(); if (!s) return false; if (/^(true|yes|y|1|co|có|dung|đúng)$/.test(s)) return true; return false; }\n" +
  "function hotNumE(h) { if (typeof h === 'string') { const k = h.toLowerCase().trim(); const HM = { low: 30, medium: 60, high: 85, hot: 90, warm: 65, cold: 35, none: 0 }; h = (k in HM) ? HM[k] : Number(h); } h = Number(h); if (!isFinite(h)) return 0; if (h > 0 && h < 1) h = h * 100; return Math.max(0, Math.min(100, Math.round(h))); }\n" +
  "function critE(c) { if (!c || typeof c !== 'object') return null; const out = {}; let n = 0; for (const k of CRIT_E) { let v = c[k]; if (v === undefined || v === null || v === '') { out[k] = null; continue; } v = Number(v); if (!isFinite(v)) { out[k] = null; continue; } if (v > 3 && v <= 10) v = v / 10 * 3; else if (v > 10) v = v / 100 * 3; out[k] = Math.max(0, Math.min(3, Math.round(v * 10) / 10)); n++; } return n >= 4 ? out : null; } /* thiếu ≥3/6 tiêu chí → không tính v2 (giữ raw) */\n" +
  "function weightsE(weights) { const w = Object.assign({}, DEF_W_E); if (Array.isArray(weights)) for (const x of weights) { if (x && CRIT_E.includes(String(x.key)) && isFinite(Number(x.weight))) w[String(x.key)] = Math.max(0, Number(x.weight)); } let sum = 0; for (const k of CRIT_E) sum += w[k]; return (sum > 0) ? w : Object.assign({}, DEF_W_E); }\n" +
  "function hotnessV2E(criteria, weights) { const c = critE(criteria); if (!c) return null; const w = weightsE(weights); let num = 0, den = 0; for (const k of CRIT_E) { if (c[k] === null) continue; num += w[k] * (c[k] / 3); den += w[k]; } return (den > 0) ? Math.max(0, Math.min(100, Math.round(num / den * 100))) : null; }\n" +
  "function normalizeE(obj, weights, v2) {\n" +
  "  v2 = v2ModeE(v2); obj.is_real_lead = normBoolE(obj.is_real_lead);\n" +
  "  const raw = hotNumE(obj.hotness); obj.hotness = raw; obj.hotness_raw = raw;\n" +
  "  if (!v2.prompt || v2.mode === 'off') { delete obj.criteria; delete obj.confidence; delete obj.why; return obj; }\n" +
  "  const c = critE(obj.criteria); const s = hotnessV2E(c, weights); const w = weightsE(weights);\n" +
  "  let conf = Number(obj.confidence); conf = isFinite(conf) ? Math.round(Math.max(0, Math.min(1, (conf > 1 && conf <= 100) ? conf / 100 : conf)) * 100) / 100 : null;\n" +
  "  let why = obj.why; if (typeof why === 'string') why = [why]; why = Array.isArray(why) ? why.map(x => String(x == null ? '' : x).trim().slice(0, 90)).filter(Boolean).slice(0, 3) : [];\n" +
  "  obj.ai_v2 = { v: 1, mode: v2.mode, raw, score: s, criteria: c, conf, why, w: CRIT_E.map(k => w[k]).join('/') };\n" +
  "  if (v2.mode === 'on' && s !== null) obj.hotness = s;\n" +
  "  delete obj.criteria; delete obj.confidence; delete obj.why; return obj;\n" +
  "}\n" +
  "function brandProfileE(ai) {\n" +
  "  if (!ai || typeof ai !== 'object') return null;\n" +
  "  const nganh = String(ai.nganh || '').trim().slice(0, 200), dichvu = String(ai.dichvu || '').trim().slice(0, 1500), khach = String(ai.khach || '').trim().slice(0, 1500), giong = String(ai.giong || '').trim().slice(0, 200);\n" +
  "  if (!nganh && !dichvu && !khach) return null;\n" +
  "  const products = [...new Set(dichvu.split(/\\r?\\n|[;•·|]|,\\s|\\s[-–]\\s|\\s\\d+[).]\\s/).map(x => x.replace(/^[\\s\\-–•*]+|^\\d+[).]\\s*/g, '').trim()).filter(x => x.length >= 2 && x.length <= 80))].slice(0, 12);\n" +
  "  return { nganh, dichvu, khach, giong, products, banSi: ai.banSi === true };\n" +
  "}\n" +
  "const ROLE_RULES_E = '- \"role\" = VAI của người viết so với brand: \"buyer\" = cần mua/tìm/thuê/đặt cho chính mình; \"reseller\" = mua để BÁN LẠI / đại lý / nhập sỉ / cửa hàng, quán nhập hàng; \"proxy\" = ĐĂNG HỘ hoặc hỏi giúp người khác (\"chị mình cần…\", \"hỏi giúp bạn…\") — vẫn là lead, liên hệ qua người đăng; \"seller\" = đang CHÀO BÁN / CUNG CẤP / TUYỂN NGƯỜI cho chính họ, hoặc là nhà cung cấp cùng ngành với brand (ĐỐI THỦ) — kể cả khi chỉ viết ngắn kiểu \"ib em\", \"em gửi giá\", \"nhà em có sẵn\", \"bên mình có\", \"check ib nhé\", \"liên hệ zalo\"; \"poster_self\" = người bình luận CHÍNH LÀ tác giả bài gốc (tự trả lời dưới bài của mình); \"other\" = còn lại (hỏi chơi, tag bạn, cảm ơn, bàn luận).\\n' +\n" +
  "  '- Với BÌNH LUẬN: đọc BÀI GỐC để biết ai là người mua, ai là người bán. Bài gốc của NGƯỜI MUA (cần tìm / cần mua) mà người bình luận chào hàng, gửi giá, mời ib → role=\"seller\" (đối thủ), is_real_lead=false. Người bình luận là tác giả bài gốc (dòng \"CÙNG MỘT NGƯỜI\" = CÓ, hoặc giọng chủ bài: \"ib mình\", \"gửi kết bạn nhận JD\", \"còn hàng nhé\") → role=\"poster_self\", is_real_lead=false (nhu cầu nếu có đã nằm ở bài gốc). Bài gốc của NGƯỜI BÁN (chào hàng / tuyển dụng) mà người bình luận hỏi mua, hỏi giá, xin ib → có thể là role=\"buyer\".';\n" +
  "function sysE(brandAi, v2) {\n" +
  "  v2 = v2ModeE(v2); if (!v2.prompt) return SYS + brandAiCtx(brandAi);\n" +
  "  const p = brandProfileE(brandAi); const L = [];\n" +
  "  if (p) {\n" +
  "    L.push('Bạn là bộ lọc lead cho MỘT BRAND tại Việt Nam' + (p.nganh ? ' – ngành: ' + p.nganh : '') + '. Chấm bài đăng CÔNG KHAI theo đúng HỒ SƠ BRAND dưới đây (KHÔNG dùng tiêu chí marketing/agency mặc định).');\n" +
  "    L.push('HỒ SƠ BRAND:');\n" +
  "    if (p.nganh) L.push('- Ngành nghề: ' + p.nganh);\n" +
  "    if (p.dichvu) L.push('- Sản phẩm/dịch vụ & thế mạnh: ' + p.dichvu);\n" +
  "    if (p.khach) L.push('- Khách mục tiêu & nhu cầu thường gặp: ' + p.khach);\n" +
  "    L.push(p.banSi ? '- Brand CÓ bán sỉ / có đại lý: người mua để BÁN LẠI, đại lý, cửa hàng/quán nhập hàng = KHÁCH HỢP LỆ (role \"reseller\", is_real_lead=true khi có nhu cầu nhập hàng thật).' : '- Brand KHÔNG bán sỉ: người mua để bán lại / đại lý / nhập sỉ KHÔNG phải khách mục tiêu → role \"reseller\", is_real_lead=false.');\n" +
  "  } else {\n" +
  "    L.push('Bạn là bộ lọc NHU CẦU MUA cho một doanh nghiệp SME tại Việt Nam (brand này chưa khai hồ sơ ngành). Chấm bài đăng CÔNG KHAI: lead = người đang CẦN MUA / TÌM / THUÊ / ĐẶT một sản phẩm-dịch vụ nào đó cho chính họ hoặc người thân.');\n" +
  "    L.push('- Chưa rõ ngành brand: mọi nhu cầu mua thật đều có thể là lead; \"industry\" = ngành hàng của nhu cầu; role \"reseller\" (mua để bán lại) → is_real_lead=false.');\n" +
  "  }\n" +
  "  L.push('Trả về DUY NHẤT một JSON:'); L.push(JSON_E); L.push('Quy tắc:');\n" +
  "  L.push('- Lead (is_real_lead=true) = người CÓ NHU CẦU MUA / TÌM / THUÊ / ĐẶT sản phẩm-dịch vụ' + (p ? ' thuộc ngành của brand' : '') + ' (diễn đạt trực tiếp hay gián tiếp đều tính). Loại (is_real_lead=false, hotness thấp): bài chào bán/cung cấp ngược, tuyển dụng, bán khoá học, chia sẻ kinh nghiệm chung, hỏi vu vơ, tin rác.');\n" +
  "  L.push('- \"hotness\" 0-100 = đánh giá TỔNG THỂ của bạn: 80-100 khi đang CẦN MUA rõ, có dấu hiệu ngân sách/độ gấp; 60-79 có nhu cầu nhưng chưa gấp; 40-59 mới hỏi thăm; dưới 40 không phải nhu cầu mua.');\n" +
  "  L.push('- \"criteria\" chấm RIÊNG từng mục 0-3 (0 = không có, 3 = rất rõ): intent = ý định mua (3 = cần mua ngay / đã có ngân sách); fit = độ khớp với sản phẩm-dịch vụ của brand; timing = độ gấp / thời điểm; industry = đúng ngành hàng brand phục vụ; area = khu vực brand phục vụ được (không rõ khu vực → 2); quality = người đăng thật, thông tin rõ, không spam. \"confidence\" 0-1 = mức chắc chắn. \"why\" = tối đa 3 cụm ngắn giải thích điểm.');\n" +
  "  L.push('- \"need\" = tóm tắt NHU CẦU của khách (khách đang cần gì — 1 câu ngắn tiếng Việt); \"intent\" = NHẬN ĐỊNH Ý ĐỊNH MUA (sẵn sàng chi tiền, độ gấp, mức chủ động, tín hiệu ngân sách/hẹn gặp — 1 câu, KHÔNG lặp lại \"need\").');\n" +
  "  L.push((p && p.products.length) ? ('- \"service\": chọn ĐÚNG 1 trong danh sách sản phẩm-dịch vụ của brand: ' + p.products.map(x => '\"' + x + '\"').join(', ') + ' — không khớp cái nào → \"khác\". \"industry\": \"' + (p.nganh || 'khác') + '\".') : '- \"service\": 1 sản phẩm/dịch vụ phù hợp nhất với nhu cầu (tên ngắn); \"industry\": ngành hàng của nhu cầu.');\n" +
  "  L.push('- \"reply\": 1 đoạn gợi ý phản hồi ngắn, đúng ngữ cảnh, lịch sự, không spam' + (p && p.giong ? ' (giọng điệu brand: ' + p.giong + ')' : '') + '.');\n" +
  "  L.push(ROLE_RULES_E);\n" +
  "  L.push('- CHỈ role \"buyer\", \"proxy\"' + (p && p.banSi ? ', \"reseller\"' : '') + ' mới được is_real_lead=true. \"role_reason\": 1 câu ngắn tiếng Việt giải thích vì sao xếp vai đó.');\n" +
  "  return L.join('\\n');\n" +
  "}\n" +
  "function preSysE(brandAi, v2) {\n" +
  "  v2 = v2ModeE(v2); if (!v2.prompt) return PRE_SYS + brandAiCtx(brandAi);\n" +
  "  const p = brandProfileE(brandAi); const L = [];\n" +
  "  if (p) { L.push('Bạn là bộ SÀNG LỌC NHANH lead cho một brand' + (p.nganh ? ' ngành \"' + p.nganh + '\"' : '') + ' tại Việt Nam.'); if (p.dichvu) L.push('Sản phẩm/dịch vụ của brand: ' + p.dichvu.slice(0, 700)); if (p.khach) L.push('Khách mục tiêu: ' + p.khach.slice(0, 700)); }\n" +
  "  else L.push('Bạn là bộ SÀNG LỌC NHANH nhu cầu mua cho một doanh nghiệp SME tại Việt Nam (chưa rõ ngành).');\n" +
  "  L.push('Đọc HIỂU NGỮ CẢNH bài đăng CÔNG KHAI (đừng chỉ bắt từ khoá) và trả về DUY NHẤT JSON: {\"maybe\":bool}.');\n" +
  "  L.push('- maybe=true nếu bài CÓ KHẢ NĂNG là người đang CẦN MUA / TÌM / THUÊ / ĐẶT ' + (p ? 'sản phẩm-dịch vụ thuộc ngành của brand' : 'một sản phẩm-dịch vụ nào đó') + ', kể cả diễn đạt gián tiếp, hỏi giá, hỏi chỗ bán, đăng hộ người khác' + (p && p.banSi ? ', kể cả đại lý / mua sỉ / nhập hàng để bán lại' : '') + '.');\n" +
  "  L.push('- maybe=false nếu RÕ RÀNG không phải nhu cầu mua: chào bán/cung cấp ngược, tuyển dụng, bán khoá học, chia sẻ kinh nghiệm chung, hỏi vu vơ, tin rác, giao lưu' + (p ? ', hoặc nhu cầu hoàn toàn khác ngành brand' : '') + '.');\n" +
  "  L.push('- maybe=false nếu người viết là NGƯỜI BÁN / nhà cung cấp đang chào hàng, gửi giá, mời inbox (kể cả bình luận ngắn kiểu \"ib em\", \"em gửi giá\", \"bên mình có sẵn\") hoặc bình luận là của CHÍNH tác giả bài gốc (dòng \"CÙNG MỘT NGƯỜI\" = CÓ).');\n" +
  "  L.push('Khi phân vân → để maybe=true.');\n" +
  "  return L.join('\\n');\n" +
  "}\n" +
  "function hasProfileE(ai) { return !!brandProfileE(ai); }\n" +
  "scoreLead.scoringModeE = scoringModeE; scoreLead.hotnessV2E = hotnessV2E; scoreLead.normalizeE = normalizeE; scoreLead.sysE = sysE; scoreLead.preSysE = preSysE; scoreLead.brandProfileE = brandProfileE; scoreLead.hasProfileE = hasProfileE; scoreLead.normBoolE = normBoolE; scoreLead.weightsE = weightsE; /* LENH E */");

/* ===================== index.js ===================== */
A('index', 'I1 v2E theo lượt (sau sowMode)',
  "  const sowMode = (trigger === 'scheduled' || quickManualB) && !force && !(opts.startDate || opts.endDate) && CFG.BD_SOW_MODE !== false;",
  "  const sowMode = (trigger === 'scheduled' || quickManualB) && !force && !(opts.startDate || opts.endDate) && CFG.BD_SOW_MODE !== false;\n" +
  "  const v2E = scoreLead.scoringModeE(config); const noProfileE = new Set(); /* LENH E: công tắc chấm điểm v2 theo lượt (config/app.scoring ghi đè .env) + brand chưa có Hồ sơ AI */");
A('index', 'I2 bộ đếm distV2/roleUnknown',
  "  const dist = { hot: 0, warm: 0, cold: 0, junk: 0 };",
  "  const dist = { hot: 0, warm: 0, cold: 0, junk: 0 };\n" +
  "  const distV2E = { hot: 0, warm: 0, cold: 0, junk: 0 }; let roleUnknownE = 0; /* LENH E: phân bố nhiệt độ theo điểm tiêu chí (chạy bóng) · AI trả vai rỗng/other mà vẫn is_real_lead (N2-12: chỉ đếm) */");
A('index', 'I3 prefilter truyền v2',
  "await __brandAiOf(x.effSrc || x.src || x.source), { tries: cb48.open ? 1 : 2 })",
  "await __brandAiOf(x.effSrc || x.src || x.source), { tries: cb48.open ? 1 : 2, v2: v2E /* LENH E */ })");
A('index', 'I4 scoreLead truyền v2',
  "ai = await scoreLead(x.post, x.effSrc, config.weights, await __brandAiOf(x.effSrc), { tries: cb48.open ? 1 : 0 });",
  "ai = await scoreLead(x.post, x.effSrc, config.weights, await __brandAiOf(x.effSrc), { tries: cb48.open ? 1 : 0, v2: v2E /* LENH E */ });");
A('index', 'I5 cổng vai reseller/proxy + roleUnknown + distV2',
  "    const __role = String(ai.role || '').toLowerCase().trim(), __roleBlock = (__role === 'seller' || __role === 'poster_self');",
  "    const __brandAiE = await __brandAiOf(x.effSrc); if (v2E.prompt && !scoreLead.hasProfileE(__brandAiE)) noProfileE.add(String(x.brandB || (x.src && x.src.brand) || (x.src && x.src.__id) || '?')); /* LENH E */\n" +
  "    const __role = String(ai.role || '').toLowerCase().trim(), __resBlockE = (__role === 'reseller' && !(__brandAiE && __brandAiE.banSi === true)), __roleBlock = (__role === 'seller' || __role === 'poster_self' || __resBlockE); /* v-selfcmt · LENH E: reseller chỉ là lead khi brand bật ai.banSi; proxy (đăng hộ) = lead */\n" +
  "    if (ai._llm && ai.is_real_lead && (__role === '' || __role === 'other')) roleUnknownE++; /* LENH E (N2-12): đếm, KHÔNG đổi yield */\n" +
  "    if (ai.ai_v2 && ai.ai_v2.score !== null && ai.ai_v2.score !== undefined) { const __tv = tempOf(ai.ai_v2.score); if (distV2E[__tv] !== undefined) distV2E[__tv]++; } /* LENH E */");
A('index', 'I6 recordPost decision reseller + ai_v2',
  "    recordPost(x, { decision: isLead ? 'lead' : (__roleBlock ? (__role === 'seller' ? 'seller' : 'self_comment') : 'scored_low'), score: ai.hotness || 0, temp: t,\n      intent: ai.intent || '', service: ai.service || '', kept: isLead, role: __role });",
  "    recordPost(x, { decision: isLead ? 'lead' : (__roleBlock ? (__role === 'seller' ? 'seller' : (__resBlockE ? 'reseller' : 'self_comment')) : 'scored_low'), score: ai.hotness || 0, temp: t,\n      intent: ai.intent || '', service: ai.service || '', kept: isLead, role: __role, ai_v2: ai.ai_v2 || null }); /* LENH E: decision 'reseller' (brand không bán sỉ) + ai_v2 */");
A('index', 'I7 recordPost ghi ai_v2',
  "      intent: fields.intent || '', service: fields.service || '', kept, role: String(fields.role || '').slice(0, 24),",
  "      intent: fields.intent || '', service: fields.service || '', kept, role: String(fields.role || '').slice(0, 24), ai_v2: (fields.ai_v2 && typeof fields.ai_v2 === 'object') ? fields.ai_v2 : null, /* LENH E */");
A('index', 'I8 lead ghi ai_v2 + contact_via_poster',
  "      service: ai.service || '', stage: 'new', assignee: null, reply: ai.reply || '', role: __role, role_reason: String(ai.role_reason || '').slice(0, 160),",
  "      service: ai.service || '', stage: 'new', assignee: null, reply: ai.reply || '', role: __role, role_reason: String(ai.role_reason || '').slice(0, 160),\n" +
  "      ai_v2: ai.ai_v2 || null, contact_via_poster: __role === 'proxy', /* LENH E: điểm tiêu chí (chạy bóng) · đăng hộ = liên hệ qua người đăng */");
A('index', 'I9 scans summary',
  "model: CFG.LLM_MODEL || '', tokensReasoning: reasonTok48, runId: runId48, status: 'done', /* LENH #48 */",
  "model: CFG.LLM_MODEL || '', tokensReasoning: reasonTok48, runId: runId48, status: 'done', /* LENH #48 */\n" +
  "    promptV2: v2E.prompt, scoreV2: v2E.mode, distV2: distV2E, roleUnknown: roleUnknownE, noProfileBrands: [...noProfileE].slice(0, 20), /* LENH E */");
A('index', 'I10 sweeper scoreLead truyền v2',
  "ai = await scoreLead(post46, src46, config.weights, await brandAiOf46(l.brand), { tries: 2 });",
  "ai = await scoreLead(post46, src46, config.weights, await brandAiOf46(l.brand), { tries: 2, v2: v2E /* LENH E */ });");
A('index', 'I11 sweeper cổng reseller',
  "roleBlock = (role === 'seller' || role === 'poster_self');",
  "__bAiE = await brandAiOf46(l.brand), roleBlock = (role === 'seller' || role === 'poster_self' || (role === 'reseller' && !(__bAiE && __bAiE.banSi === true))); /* LENH E */");
A('index', 'I12 sweeper ghi ai_v2',
  "ai_scored: true, base_score: h, rescore_lease: FieldValue.delete()",
  "ai_v2: ai.ai_v2 || null, contact_via_poster: role === 'proxy', /* LENH E */ ai_scored: true, base_score: h, rescore_lease: FieldValue.delete()");
A('index', 'I13 sweeper lý do loại reseller',
  "(role === 'seller' ? 'người bán/đối thủ' : 'chính chủ bài')",
  "(role === 'seller' ? 'người bán/đối thủ' : role === 'reseller' ? 'đại lý/mua sỉ – brand không bán sỉ' : 'chính chủ bài') /* LENH E */");

/* ===================== áp + kiểm sau thay ===================== */
const out = {};
for (const k of Object.keys(files)) { let s = src[k]; for (const [, from, to] of ops[k]) s = s.replace(from, () => to); out[k] = s; }
for (const k of Object.keys(files)) for (const [label, , to] of ops[k]) { if (out[k].split(to).length - 1 !== 1) { console.error('DỪNG: sau thay mốc ' + label + ' không đúng 1 lần — KHÔNG ghi gì.'); process.exit(1); } }
for (const k of Object.keys(files)) if (!/LENH E\b/.test(out[k])) { console.error('DỪNG: ' + files[k] + ' sau vá không có marker LENH E — KHÔNG ghi gì.'); process.exit(1); }
for (const k of Object.keys(files)) fs.writeFileSync(files[k], out[k]);
const n = ops.config.length + ops.scorer.length + ops.index.length;
console.log('PATCH OK 3 file (LENH E): config ' + ops.config.length + ' mốc (PROMPT_BRAND_V2/SCORE_V2) · scorer ' + ops.scorer.length + ' mốc (normRole reseller/proxy · prompt theo brand v2 · normalizeE/ai_v2 · helper) · index ' + ops.index.length + ' mốc (v2E theo lượt · cổng reseller/proxy · ai_v2 lên lead/scanned_posts · scans.distV2/roleUnknown/noProfileBrands · sweeper) = ' + n + ' mốc');
