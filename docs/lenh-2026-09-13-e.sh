# bash — LỆNH E · KHỐI 1 (13/09/2026) — CHẤM ĐIỂM v2 = Đợt 2.2 PA-1 (prompt theo BRAND + vai reseller/proxy) + Đợt 2.3 PC-2 (6 tiêu chí con × config.weights, hotness tính bằng code, CHẠY BÓNG)
#   Mốc trên mã SAU LỆNH D/#49 (index.js có marker LENH C + LENH D; lib/scorer.js có LENH #48). Patch fail-closed NGUYÊN TỬ 3 file (lib/config.js · lib/scorer.js · index.js; đủ 19 mốc mới ghi), idempotent (marker LENH E).
#   Mặc định sau deploy: promptV2 BẬT (prompt theo brand) · scoreV2 = shadow (điểm hiển thị VẪN là điểm AI như cũ; điểm tiêu chí ghi ở lead.ai_v2 để so). Tắt/bật trên web (Chấm điểm AI, zip v119-91) hoặc .env PROMPT_BRAND_V2 / SCORE_V2.
#   Thứ tự: backup .bak-<TS> → patch → node --check → import test (.env) → (c) gọi thử AI THẬT 1 bài (không chặn) → deploy scheduledScan + manualScan (gated "Deploy complete") → describe → (e) so prompt cũ ↔ v2 trên 40 bài thật (chỉ đọc, ≈ $0,12, không chặn).
# Dán: tạo file /tmp/le.sh bằng heredoc quoted (cat > /tmp/le.sh, dán nguyên khối, kết bằng dòng kết heredoc) rồi: bash /tmp/le.sh   (không shebang, không dấu chấm than ngoài heredoc — Cloud Shell history-expand)
set -o pipefail
cd ~/firebase-s13/functions || { echo 'DỪNG: không vào được ~/firebase-s13/functions'; exit 1; }
TS=$(date -u +%Y%m%d-%H%M%S); echo "backup TS=$TS (giờ UTC)"
cat > _le_patch.cjs <<'EOF_PATCH'
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
EOF_PATCH
cat > _le_live.mjs <<'EOF_LIVE'
/* LỆNH E · KHỐI 1 bước (c) — gọi THẬT scoreLead v2 (prompt theo brand + criteria) trên 1 bài gần nhất đã thành lead (scanned_posts decision 'lead'). CHỈ ĐỌC Firestore, 1 lượt AI (~$0.003). Lỗi KHÔNG chặn deploy.
   Đặt trong ~/firebase-s13/functions; chạy sau `set -a; . ./.env; set +a`. */
import { initializeApp, applicationDefault, getApps } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { scoreLead } from './lib/scorer.js';
if (!getApps().length) initializeApp({ credential: applicationDefault(), projectId: 'smartlead-z15' }); const db = getFirestore();
const t0 = Date.now(); const kill = setTimeout(() => { console.log('LIVE: quá 90 s — bỏ qua (không chặn deploy)'); process.exit(0); }, 90000);
try {
  const q = await db.collection('scanned_posts').where('decision', '==', 'lead').orderBy('createdAt', 'desc').limit(1).get().catch(async () => db.collection('scanned_posts').orderBy('createdAt', 'desc').limit(30).get());
  const doc = q.docs.find(d => (d.data() || {}).decision === 'lead') || q.docs[0];
  if (!doc) { console.log('LIVE: không có scanned_posts để thử — bỏ qua'); clearTimeout(kill); process.exit(0); }
  const p = doc.data() || {}; const brand = String(p.brand || '').trim();
  const bs = brand ? await db.collection('brands').doc(brand).get() : null; const ai = (bs && bs.exists && (bs.data() || {}).ai) || null;
  const cfg = await db.collection('config').doc('app').get(); const weights = (cfg.exists && (cfg.data() || {}).weights) || [];
  const post = { post_id: doc.id, url: p.post_url || '', text: p.text || '', author: p.author || '', kind: p.kind || 'post', parent_text: p.parent_text || '', parent_author: p.parent_author || '', comment_id: p.comment_id || '', comment_url: p.comment_url || '', self_comment: false };
  console.log('LIVE: bài ' + doc.id + ' · brand ' + (brand || '?') + ' · hồ sơ AI ' + (scoreLead.hasProfileE(ai) ? 'CÓ' + (ai.banSi ? ' (bán sỉ)' : '') : 'KHÔNG') + ' · điểm cũ ' + (p.score || 0) + ' · vai cũ ' + (p.role || '') + ' · text: ' + String(p.text || '').slice(0, 90).replace(/\s+/g, ' '));
  const r = await scoreLead(post, { name: p.source || '', industry: '' }, weights, ai, { tries: 2, v2: { prompt: true, mode: 'shadow' } });
  const v = r.ai_v2 || {};
  console.log('LIVE OK · ' + (r._model || '') + ' · ' + Math.round((Date.now() - t0) / 100) / 10 + ' s · is_real_lead ' + r.is_real_lead + ' · hotness raw ' + r.hotness_raw + ' · v2 ' + v.score + ' · conf ' + v.conf + ' · role ' + r.role + ' (' + String(r.role_reason || '').slice(0, 80) + ')');
  console.log('  criteria ' + JSON.stringify(v.criteria) + ' · w ' + v.w + ' · why ' + JSON.stringify(v.why) + ' · service ' + JSON.stringify(r.service) + ' · industry ' + JSON.stringify(r.industry));
  console.log('  need: ' + String(r.need || '').slice(0, 120) + ' | intent: ' + String(r.intent || '').slice(0, 120));
} catch (e) { console.log('LIVE LỖI (không chặn deploy): ' + String((e && e.message) || e).slice(0, 300)); }
clearTimeout(kill); process.exit(0);
EOF_LIVE
cat > _promptcmp.mjs <<'EOF_CMP'
/* LỆNH E — `_promptcmp.mjs` (PA-1 bước (d)): SO SÁNH prompt cũ ↔ prompt v2 theo brand trên bài THẬT đã có quyết định (scanned_posts N ngày gần nhất).
   CHỈ ĐỌC Firestore + gọi AI (mỗi bài 1 lượt gpt-5.6-sol ≈ $0,003 → 40 bài ≈ $0,12). KHÔNG ghi gì. Đặt trong ~/firebase-s13/functions; chạy sau `set -a; . ./.env; set +a`.
   Dùng: node _promptcmp.mjs [--n=40] [--days=3] [--brand=<code>] [--conc=3]
   In: từng bài (brand · quyết định/điểm/vai CŨ ↔ v2: is_real_lead/raw/điểm tiêu chí/vai/conf/service/why) + tổng kết (đồng ý lead↔lead, lead→không, không→lead, |Δ| TB, phân bố nhiệt độ raw/v2, đổi vai, brand thiếu hồ sơ, chi phí). */
import { initializeApp, applicationDefault, getApps } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { scoreLead } from './lib/scorer.js';
import { CFG } from './lib/config.js';
if (!getApps().length) initializeApp({ credential: applicationDefault(), projectId: 'smartlead-z15' }); const db = getFirestore();
const arg = (k, d) => { const m = process.argv.find(a => a.startsWith('--' + k + '=')); return m ? m.slice(k.length + 3) : d; };
const N = Math.max(4, Math.min(200, Number(arg('n', 40)) || 40)), DAYS = Math.max(1, Number(arg('days', 3)) || 3), BRAND = String(arg('brand', '')).trim(), CONC = Math.max(1, Math.min(6, Number(arg('conc', 3)) || 3));
const OFF = 7 * 3600e3; const ms = v => !v ? 0 : (typeof v === 'number' ? v : (v.toMillis ? v.toMillis() : (v.seconds ? v.seconds * 1000 : (Date.parse(v) || 0))));
const tempOf = h => h >= 80 ? 'hot' : h >= 60 ? 'warm' : h >= 40 ? 'cold' : 'junk';
async function pageAll(q, orderField, sel, max) {
  const fields = (sel && sel.length) ? ((orderField === '__name__' || sel.includes(orderField)) ? sel : sel.concat(orderField)) : null; const out = []; let last = null;
  while (out.length < (max || 3000)) { let qq = q.orderBy(orderField, 'desc').limit(300); if (fields) qq = qq.select(...fields); if (last) qq = qq.startAfter(last); const s = await qq.get(); if (s.empty) break; s.docs.forEach(d => out.push(Object.assign({ __id: d.id }, d.data()))); last = s.docs[s.docs.length - 1]; if (s.size < 300) break; }
  return out;
}
console.log('== LỆNH E · _promptcmp — ' + new Date(Date.now() + OFF).toISOString().slice(0, 16).replace('T', ' ') + ' VN · n=' + N + ' · ' + DAYS + ' ngày' + (BRAND ? ' · brand ' + BRAND : '') + ' · model ' + CFG.LLM_MODEL + ' ==');
if (!CFG.LLM_API_KEY) { console.log('DỪNG: thiếu LLM_API_KEY (chạy `set -a; . ./.env; set +a` trước)'); process.exit(1); }
const since = new Date(Date.now() - DAYS * 864e5);
const sp = await pageAll(db.collection('scanned_posts').where('createdAt', '>=', since), 'createdAt', ['brand', 'decision', 'score', 'role', 'text', 'kind', 'author', 'parent_text', 'parent_author', 'comment_id', 'comment_url', 'post_url', 'source', 'ai_v2'], 2500);
const pool = sp.filter(p => (p.decision === 'lead' || p.decision === 'scored_low' || p.decision === 'seller' || p.decision === 'reseller') && String(p.text || '').trim().length >= 15 && (!BRAND || p.brand === BRAND) && !p.ai_v2);
const byBrand = {}; for (const p of pool) (byBrand[p.brand || '?'] = byBrand[p.brand || '?'] || { lead: [], rej: [] })[p.decision === 'lead' ? 'lead' : 'rej'].push(p);
const brands = Object.keys(byBrand); if (!brands.length) { console.log('Không có bài nào trong ' + DAYS + ' ngày (hoặc tất cả đã có ai_v2 = đã chấm bằng v2). Tăng --days.'); process.exit(0); }
const per = Math.max(2, Math.ceil(N / brands.length / 2)); const pick = [];
for (const b of brands) { pick.push(...byBrand[b].lead.slice(0, per), ...byBrand[b].rej.slice(0, per)); }
const items = pick.slice(0, N);
console.log('bài trong kho ' + sp.length + ' · đủ điều kiện ' + pool.length + ' · brand ' + brands.join(', ') + ' · chọn ' + items.length + ' (mỗi brand ≤' + per + ' lead + ≤' + per + ' loại)');
const cfgDoc = await db.collection('config').doc('app').get(); const weights = (cfgDoc.exists && (cfgDoc.data() || {}).weights) || [];
const aiCache = {}; const aiOf = async b => { if (!b) return null; if (!(b in aiCache)) { const s = await db.collection('brands').doc(b).get(); aiCache[b] = (s.exists && (s.data() || {}).ai) || null; } return aiCache[b]; };
const noProfile = new Set(); for (const b of brands) if (!scoreLead.hasProfileE(await aiOf(b))) noProfile.add(b);
if (noProfile.size) console.log('⚠ brand CHƯA có Hồ sơ AI (v2 chấm bằng prompt trung tính SME): ' + [...noProfile].join(', ') + ' → super khai ở Người dùng → Hồ sơ AI trước khi bật v2');
const rows = []; let tokIn = 0, tokOut = 0, fail = 0;
async function one(p) {
  const ai = await aiOf(p.brand); const post = { post_id: p.__id, url: p.post_url || '', text: p.text || '', author: p.author || '', kind: p.kind || 'post', parent_text: p.parent_text || '', parent_author: p.parent_author || '', comment_id: p.comment_id || '', comment_url: p.comment_url || '', self_comment: false };
  try { const r = await scoreLead(post, { name: p.source || '', industry: '' }, weights, ai, { tries: 2, v2: { prompt: true, mode: 'shadow' } });
    const u = r._usage || {}; tokIn += u.prompt || 0; tokOut += u.completion || 0; const v = r.ai_v2 || {}; const role = String(r.role || '');
    const resBlock = role === 'reseller' && !(ai && ai.banSi === true); const isLeadNew = !!r.is_real_lead && !(role === 'seller' || role === 'poster_self' || resBlock) && (r.hotness || 0) >= CFG.MIN_KEEP_SCORE;
    rows.push({ p, r, v, isLeadNew, role }); }
  catch (e) { fail++; rows.push({ p, err: String((e && e.message) || e).slice(0, 120) }); }
}
let i = 0; await Promise.all(Array.from({ length: CONC }, async () => { while (i < items.length) { const p = items[i++]; await one(p); } }));
const short = (s, n) => String(s || '').replace(/\s+/g, ' ').slice(0, n);
console.log('\n#  brand        | CŨ: quyết định / điểm / vai   | V2: lead? / raw / điểm tiêu chí / vai / tin cậy | service · why · text');
rows.forEach((x, k) => { const p = x.p; if (x.err) { console.log(String(k + 1).padStart(2) + '  ' + String(p.brand || '?').padEnd(12) + ' | ' + p.decision + ' / ' + (p.score || 0) + ' / ' + (p.role || '') + ' | LỖI ' + x.err); return; }
  const c = x.v.criteria || {}; const cs = ['intent', 'fit', 'timing', 'industry', 'area', 'quality'].map(k2 => (c[k2] === null || c[k2] === undefined) ? '-' : c[k2]).join('');
  console.log(String(k + 1).padStart(2) + '  ' + String(p.brand || '?').padEnd(12) + ' | ' + String(p.decision).padEnd(10) + ' ' + String(p.score || 0).padStart(3) + ' ' + String(p.role || '-').padEnd(11) + ' | ' + (x.isLeadNew ? 'LEAD ' : 'no   ') + String(x.v.raw).padStart(3) + ' ' + String(x.v.score === null || x.v.score === undefined ? '-' : x.v.score).padStart(3) + ' [' + cs + '] ' + x.role.padEnd(11) + ' ' + (x.v.conf === null || x.v.conf === undefined ? '-' : x.v.conf) + ' | ' + short(x.r.service, 24) + ' · ' + short((x.v.why || []).join('; '), 70) + ' · ' + short(p.text, 60)); });
const ok = rows.filter(x => !x.err); const oldLead = x => x.p.decision === 'lead';
const agree = ok.filter(x => oldLead(x) === x.isLeadNew).length, l2n = ok.filter(x => oldLead(x) && !x.isLeadNew).length, n2l = ok.filter(x => !oldLead(x) && x.isLeadNew).length;
const dRaw = ok.map(x => Math.abs((Number(x.p.score) || 0) - (x.v.raw || 0))); const dV2 = ok.filter(x => x.v.score !== null && x.v.score !== undefined).map(x => Math.abs((x.v.raw || 0) - x.v.score));
const dist = (f) => { const d = { hot: 0, warm: 0, cold: 0, junk: 0 }; ok.forEach(x => { const s = f(x); if (s !== null && s !== undefined) d[tempOf(s)]++; }); return d; };
const roleChg = {}; ok.forEach(x => { const a = String(x.p.role || '-'), b = x.role || '-'; if (a !== b) roleChg[a + '→' + b] = (roleChg[a + '→' + b] || 0) + 1; });
const cost = (tokIn / 1e6) * CFG.LLM_PRICE_IN + (tokOut / 1e6) * CFG.LLM_PRICE_OUT;
console.log('\n== TỔNG KẾT ==');
console.log('chấm ' + ok.length + '/' + rows.length + ' bài (lỗi ' + fail + ') · đồng ý lead↔lead ' + agree + '/' + ok.length + ' (' + (ok.length ? Math.round(agree / ok.length * 100) : 0) + ' %) · lead cũ → v2 KHÔNG ' + l2n + ' · loại cũ → v2 LEAD ' + n2l);
console.log('|Δ điểm| cũ ↔ raw v2 TB ' + (dRaw.length ? Math.round(dRaw.reduce((a, b) => a + b, 0) / dRaw.length) : '-') + ' · |raw − điểm tiêu chí| TB ' + (dV2.length ? Math.round(dV2.reduce((a, b) => a + b, 0) / dV2.length) : '-') + ' · thiếu criteria ' + ok.filter(x => x.v.score === null || x.v.score === undefined).length);
console.log('phân bố nhiệt độ — cũ ' + JSON.stringify(dist(x => Number(x.p.score) || 0)) + ' · v2 raw ' + JSON.stringify(dist(x => x.v.raw)) + ' · v2 tiêu chí ' + JSON.stringify(dist(x => x.v.score)));
console.log('đổi vai (cũ→v2): ' + (Object.keys(roleChg).length ? Object.entries(roleChg).map(([k, v]) => k + ' ' + v).join(' · ') : 'không') + ' · reseller ' + ok.filter(x => x.role === 'reseller').length + ' · proxy ' + ok.filter(x => x.role === 'proxy').length + ' · vai rỗng/other mà is_real_lead ' + ok.filter(x => x.r.is_real_lead && (x.role === '' || x.role === 'other')).length);
console.log('token ' + tokIn + '/' + tokOut + ' ≈ $' + (Math.round(cost * 1000) / 1000) + ' · KHÔNG ghi gì. Đọc: "lead cũ → v2 KHÔNG" là bài v2 gạt bỏ (xem why/vai có hợp lý), "loại cũ → v2 LEAD" là bài v2 cứu (đúng ngành brand?). Ưng → giữ mặc định (promptV2 bật, scoreV2 shadow); không ưng → config/app.scoring.promptV2=false (web) hoặc .env PROMPT_BRAND_V2=false.');
process.exit(0);
EOF_CMP
cat > _pc2_shadow.mjs <<'EOF_SHADOW'
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
EOF_SHADOW
cat > _le_after.mjs <<'EOF_AFTER'
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
EOF_AFTER
node --check _le_patch.cjs && node --check _le_live.mjs && node --check _promptcmp.mjs && node --check _pc2_shadow.mjs && node --check _le_after.mjs || { echo 'DỪNG: script lỗi cú pháp (chưa đụng gì)'; exit 1; }
FILES="lib/config.js lib/scorer.js index.js"
echo "=== (a) backup + patch 3 file ==="
for f in $FILES; do [ -f "$f" ] || { echo "DỪNG: thiếu $f"; exit 1; }; done
grep -q "LENH D" index.js || { echo 'DỪNG: index.js chưa có marker LENH D — LỆNH E đặt mốc trên mã SAU LỆNH D. Chạy LỆNH D trước.'; exit 1; }
grep -q "LENH #48" lib/scorer.js || { echo 'DỪNG: lib/scorer.js chưa có marker LENH #48 — LỆNH E đặt mốc trên mã SAU #48.'; exit 1; }
grep -q "LENH #49" lib/scraper.js || echo "CẢNH BÁO: lib/scraper.js chưa có marker LENH #49 (LỆNH E không đụng scraper — vẫn chạy; nên chạy #49 sau)"
if grep -q "LENH E" index.js && [ -f _le_backup_ts ]; then TSB=$(cat _le_backup_ts); echo "index.js ĐÃ có marker LENH E (chạy lại) — KHÔNG tạo .bak mới; bản gốc trước LENH E = *.bak-$TSB"
elif grep -q "LENH E" index.js; then echo "DỪNG: index.js đã có marker LENH E nhưng thiếu _le_backup_ts — khôi phục từ .bak-<TS gốc> hoặc gửi em output"; exit 1
else TSB=$TS
  for f in $FILES; do cp "$f" "$f.bak-$TSB" || { echo "DỪNG: không backup được $f"; exit 1; }; done
  echo "$TSB" > _le_backup_ts
fi
restore() { for f in $FILES; do cp "$f.bak-$TSB" "$f"; done; echo "ĐÃ KHÔI PHỤC 3 file từ .bak-$TSB"; }
describe2() { for f in scheduledScan manualScan; do gcloud functions describe "$f" --region asia-southeast1 --gen2 --format='value(name,state,updateTime)' 2>/dev/null | sed 's|projects/smartlead-z15/locations/asia-southeast1/functions/||' || echo "(describe $f lỗi)"; done; }
node _le_patch.cjs $FILES || { echo 'DỪNG (a): patch không áp — KHÔNG ghi gì. Gửi em output.'; exit 1; }
for f in $FILES; do node --check "$f" || { echo "DỪNG (a): lỗi cú pháp sau patch ($f)"; restore; exit 1; }; done
echo "marker LENH E (config/scorer/index):"; grep -c "LENH E" $FILES
echo "=== (b) import test (.env) ==="
set -a; . ./.env; set +a
node --input-type=module -e "const m=await import('./index.js'); const s=await import('./lib/scorer.js'); const c=(await import('./lib/config.js')).CFG; const L=s.scoreLead; const W=[{key:'intent',weight:30},{key:'fit',weight:25},{key:'timing',weight:15},{key:'industry',weight:12},{key:'area',weight:8},{key:'quality',weight:10}]; const h=L.hotnessV2E({intent:3,fit:3,timing:3,industry:3,area:3,quality:3},W), h2=L.hotnessV2E({intent:3,fit:0,timing:0,industry:0,area:0,quality:0},W), h3=L.hotnessV2E({intent:3},W); const md=L.scoringModeE({}); const r1=s.normRole('đại lý'), r2=s.normRole('đăng hộ'), r3=s.normRole('người bán'); const sys=L.sysE({nganh:'Hải sản khô',dichvu:'Mực khô',khach:'quán nhậu',giong:'thân thiện',banSi:true},{prompt:true,mode:'shadow'}); console.log('IMPORT OK · scheduledScan', typeof m.scheduledScan, '· manualScan', typeof m.manualScan, '· PROMPT_BRAND_V2', c.PROMPT_BRAND_V2, '· SCORE_V2', c.SCORE_V2, '· mode(env)', JSON.stringify(md), '· v2(đủ 3)', h, '· v2(intent 3, còn lại 0)', h2, '· v2(thiếu 5/6 tiêu chí → null giữ raw)', h3, '· normRole', r1+'/'+r2+'/'+r3, '· sysE brand-first', /HỒ SƠ BRAND/.test(sys) && /criteria/.test(sys) && /agency marketing/.test(sys) === false); const OKE = (typeof m.scheduledScan==='function' && h===100 && h2===30 && h3===null && r1==='reseller' && r2==='proxy' && r3==='seller' && md.prompt===true && md.mode==='shadow' && /HỒ SƠ BRAND/.test(sys) && /agency marketing/.test(sys) === false); if (OKE === false) { console.log('IMPORT: giá trị SAI'); process.exit(1); }" || { echo "DỪNG (b): import/ca kiểm sai — khôi phục"; restore; exit 1; }
echo "=== (c) gọi thử AI THẬT 1 bài gần nhất (shadow, ≈ 0,003 USD, không ghi, không chặn deploy) ==="
node _le_live.mjs || echo "CẢNH BÁO (c): live lỗi — không chặn"
echo "=== (d) deploy scheduledScan + manualScan ==="
cd ~/firebase-s13 && firebase deploy --only functions:scheduledScan,functions:manualScan > /tmp/le_deploy.log 2>&1; RC=$?; tail -6 /tmp/le_deploy.log
[ "$RC" = "0" ] && grep -q "Deploy complete" /tmp/le_deploy.log || { echo "DEPLOY LỖI (RC=$RC) — firebase deploy đưa từng function lên lần lượt nên lỗi giữa chừng = MỘT PHẦN đã lên; bảng describe dưới: updateTime ≥ $TS = đã lên bản mới. Cách xử lý: chạy LẠI đúng lệnh deploy ở (d) (idempotent) — hoặc quay lui: cd ~/firebase-s13/functions; for f in $FILES; do cp \$f.bak-$TSB \$f; done; cd ~/firebase-s13; firebase deploy --only functions:scheduledScan,functions:manualScan"; describe2; exit 1; }
describe2
cd ~/firebase-s13/functions || exit 1
echo "=== (e) so prompt CŨ ↔ v2 trên 40 bài thật 3 ngày (chỉ đọc, ≈ 0,12 USD, 2–4 phút; lỗi không chặn) ==="
node _promptcmp.mjs --n=40 --days=3 || echo "CẢNH BÁO (e): _promptcmp lỗi — chạy lại sau: cd ~/firebase-s13/functions && set -a; . ./.env; set +a; node _promptcmp.mjs --n=40 --days=3"
echo "=== XONG KHỐI 1 (exit=0) — KHỐI 2 (sau ≥ 15′): cd ~/firebase-s13/functions && node _le_after.mjs · sau 3 ngày: node _pc2_shadow.mjs --days=3 --minAge=0 · sau 14 ngày: node _pc2_shadow.mjs (quyết bật scoreV2=on trên web) ==="
