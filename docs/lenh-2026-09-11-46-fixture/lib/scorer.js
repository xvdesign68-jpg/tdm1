/* v-ai1500: noi gioi han dichvu/khach 700->1500 dong bo voi web v104 */
/* AI chấm điểm lead. Dùng LLM (tương thích OpenAI). Nếu không có key → heuristic dự phòng. */
import { CFG } from './config.js';
import { log } from './logger.js';

/* ===== v-brandai: Ho so AI theo brand (brands/{code}.ai) =====
   Brand khai bao nganh/dich vu/khach muc tieu -> khoi ngu canh nay duoc noi vao system prompt
   cua prefilter + scorer + needsynth. Brand chua khai (ai rong) -> tra '' -> hanh vi cu 100%. */
export function brandAiCtx(ai) {
  if (!ai) return '';
  const p = [];
  if (ai.nganh)  p.push('- Ngành nghề: ' + String(ai.nganh).slice(0, 200));
  if (ai.dichvu) p.push('- Sản phẩm/dịch vụ & thế mạnh: ' + String(ai.dichvu).slice(0, 1500));
  if (ai.khach)  p.push('- Khách mục tiêu & nhu cầu thường gặp: ' + String(ai.khach).slice(0, 1500));
  if (!p.length) return '';
  return '\n\n=== BRAND ĐANG PHỤC VỤ (QUAN TRỌNG - áp dụng THAY CHO mặc định "agency marketing" ở trên) ===\n'
    + p.join('\n')
    + '\nĐịnh nghĩa lead cho brand này: người CÓ NHU CẦU MUA / TÌM / THUÊ sản phẩm-dịch vụ thuộc ngành trên (diễn đạt trực tiếp hay gián tiếp đều tính).'
    + '\nKHÔNG loại bài chỉ vì nó không liên quan marketing/quảng cáo. Các tiêu chí về ads/TikTok Shop/KOC/agency chỉ áp dụng khi khớp ngành của brand.'
    + '\nNếu JSON có field "service": gợi ý 1 sản phẩm/dịch vụ CỦA BRAND phù hợp nhất (không dùng danh sách dịch vụ marketing mặc định).';
}

const SYS = `Bạn là bộ lọc lead cho một agency marketing tại Việt Nam.
Phân tích bài đăng CÔNG KHAI và trả về DUY NHẤT một JSON:
{"is_real_lead":bool,"hotness":0-100,"intent":string,"industry":string,"service":string,"reply":string,"role":"buyer|seller|poster_self|other","role_reason":string}
Quy tắc:
- Loại (is_real_lead=false, hotness thấp) các bài: bán dịch vụ ngược, tuyển dụng, bán khoá học, sinh viên hỏi định hướng, chia sẻ kinh nghiệm chung.
- Chấm CAO (80-100) khi người đăng đang CẦN MUA / TÌM NHÀ CUNG CẤP, có dấu hiệu ngân sách/độ gấp.
- "service": gợi ý 1 dịch vụ phù hợp (Performance Marketing, Creative Production, TikTok Shop Operation, Booking KOC, AI Automation...).
- "reply": 1 đoạn gợi ý phản hồi ngắn, đúng ngữ cảnh, lịch sự, không spam.
- "role" = VAI của người viết so với brand: "buyer" = đang CẦN MUA / TÌM / THUÊ thứ brand cung cấp; "seller" = đang CHÀO BÁN / CUNG CẤP / TUYỂN NGƯỜI cho chính họ, hoặc là nhà cung cấp cùng ngành với brand (ĐỐI THỦ) — kể cả khi chỉ viết ngắn kiểu "ib em", "em gửi giá", "nhà em có sẵn", "bên mình có", "check ib nhé", "liên hệ zalo"; "poster_self" = người bình luận CHÍNH LÀ tác giả bài gốc (tự trả lời dưới bài của mình); "other" = còn lại (hỏi chơi, tag bạn, cảm ơn, bàn luận).
- Với BÌNH LUẬN: đọc BÀI GỐC để biết ai là người mua, ai là người bán. Bài gốc của NGƯỜI MUA (cần tìm / cần mua) mà người bình luận chào hàng, gửi giá, mời ib → role="seller" (đối thủ), is_real_lead=false. Người bình luận là tác giả bài gốc (dòng "CÙNG MỘT NGƯỜI" = CÓ, hoặc giọng chủ bài: "ib mình", "gửi kết bạn nhận JD", "còn hàng nhé") → role="poster_self", is_real_lead=false (nhu cầu nếu có đã nằm ở bài gốc). Bài gốc của NGƯỜI BÁN (chào hàng / tuyển dụng) mà người bình luận hỏi mua, hỏi giá, xin ib → có thể là role="buyer".
- CHỈ role="buyer" mới được is_real_lead=true. "role_reason": 1 câu ngắn tiếng Việt giải thích vì sao xếp vai đó.`;

/* ===== TẦNG 1: sàng lọc ngữ cảnh bằng model RẺ (gpt-4o-mini) =====
   Đọc HIỂU bài (không dựa keyword) → quyết định bài có ĐÁNG đưa lên model thông minh chấm sâu không.
   Trả { maybe:bool, _usage, _llm }. Lỗi/không có key → maybe:true (fail-open, không bỏ sót lead). */
const PRE_SYS = `Bạn là bộ SÀNG LỌC NHANH cho agency marketing tại Việt Nam.
Đọc HIỂU NGỮ CẢNH bài đăng CÔNG KHAI (đừng chỉ bắt từ khoá) và trả về DUY NHẤT JSON: {"maybe":bool}.
- maybe=true nếu bài CÓ KHẢ NĂNG là người đang CẦN MUA / TÌM / THUÊ một dịch vụ (chạy ads, vận hành sàn/TikTok Shop, sản xuất nội dung/video, booking KOC/KOL, thiết kế, automation, agency...), kể cả khi diễn đạt gián tiếp.
- maybe=false nếu RÕ RÀNG không phải nhu cầu mua: bán/chào dịch vụ ngược, tuyển dụng, bán khoá học, chia sẻ kinh nghiệm chung, hỏi vu vơ, tin rác, giao lưu.
- maybe=false nếu người viết là NGƯỜI BÁN / nhà cung cấp đang chào hàng, gửi giá, mời inbox (kể cả bình luận ngắn kiểu "ib em", "em gửi giá", "bên mình có sẵn") hoặc bình luận là của CHÍNH tác giả bài gốc (dòng "CÙNG MỘT NGƯỜI" = CÓ).
Khi phân vân → để maybe=true.`;

/* v-selfcmt (LỆNH #31b 05/09/2026): vai người viết (buyer/seller/poster_self/other). Chuẩn hoá giá trị AI trả: đồng nghĩa → 4 giá trị chuẩn, lạ → "other", trống → "". */
export function normRole(r) {
  const s = String(r || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[đĐ]/g, 'd').toLowerCase().trim().replace(/[\s-]+/g, '_');
  if (!s) return '';
  if (/^(buyer|seller|poster_self|other)$/.test(s)) return s;
  if (/self|author|tac.?gia|chu.?bai|poster|nguoi.?dang|owner/.test(s)) return 'poster_self';
  if (/sell|vendor|supplier|compet|doi.?thu|nguoi.?ban|nha.?cung|recruit|tuyen/.test(s)) return 'seller';
  if (/buy|customer|khach|nguoi.?mua|lead|prospect/.test(s)) return 'buyer';
  return 'other';
}

/* Dựng nội dung gửi LLM. Với BÌNH LUẬN: kèm ngữ cảnh BÀI GỐC để AI đánh giá đúng ý định người bình luận. */
function buildPostContent(post, maxLen) {
  const body = String(post.text || '').slice(0, maxLen);
  if (post.kind === 'comment' && post.parent_text) {
    const ctx = String(post.parent_text).slice(0, 500);
    const anon = s => /ẩn danh|anonymous|người tham gia|facebook user/i.test(s);
    const pa = String(post.parent_author || '').trim().slice(0, 80), ca = String(post.author || '').trim().slice(0, 80);
    const same = post.self_comment ? 'CÓ — người bình luận CHÍNH LÀ tác giả bài gốc' : ((pa && ca && !anon(pa) && !anon(ca)) ? 'KHÔNG (tên khác nhau)' : 'không rõ');
    return `Đây là BÌNH LUẬN dưới một bài đăng (hãy đánh giá theo Ý ĐỊNH và VAI của NGƯỜI BÌNH LUẬN trong ngữ cảnh bài gốc).\nTÁC GIẢ BÀI GỐC: ${pa || '(không rõ)'}\nBÀI GỐC: """${ctx}"""\nNGƯỜI BÌNH LUẬN: ${ca || '(không rõ)'}\nCÙNG MỘT NGƯỜI VỚI TÁC GIẢ BÀI GỐC? ${same}\nBÌNH LUẬN: """${body}"""`;
  }
  return `Bài: """${body}"""`;
}

export async function prefilterLead(post, brandAi) { /* v-brandai */
  if (!CFG.LLM_API_KEY) return { maybe: true, _usage: { prompt: 0, completion: 0, total: 0 }, _llm: false };
  try {
    const r = await fetch(`${CFG.LLM_BASE_URL}/chat/completions`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${CFG.LLM_API_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: CFG.LLM_PREFILTER_MODEL,
        response_format: { type: 'json_object' },
        messages: [
          { role: 'system', content: PRE_SYS + brandAiCtx(brandAi) },
          { role: 'user', content: buildPostContent(post, 1200) }
        ]
      })
    });
    if (!r.ok) throw new Error(`prefilter ${r.status}: ${(await r.text()).slice(0, 120)}`);
    const j = await r.json();
    const obj = JSON.parse(j.choices[0].message.content);
    const u = j.usage || {};
    const pt = Number(u.prompt_tokens) || 0, ct = Number(u.completion_tokens) || 0;
    return { maybe: !!obj.maybe, _llm: true, _usage: { prompt: pt, completion: ct, total: Number(u.total_tokens) || (pt + ct) } };
  } catch (e) {
    // s18: loi tam thoi -> thu lai 1 lan sau 1.5s; het credit thi khoi thu (vo ich)
    if (!post._preRetried && !/insufficient_quota|credit_balance_exhausted/.test(String(e.message))) {
      post._preRetried = true;
      await new Promise(res => setTimeout(res, 1500));
      return prefilterLead(post, brandAi);
    }
    log.warn('prefilter lỗi, cho qua tầng 2:', e.message);
    return { maybe: true, _usage: { prompt: 0, completion: 0, total: 0 }, _llm: false };
  }
}

/* Heuristic dự phòng khi không cấu hình LLM */
function heuristic(text, source) {
  const t = (text || '').toLowerCase();
  const buy = ['cần tìm', 'thuê', 'tìm agency', 'tìm đơn vị', 'báo giá', 'trọn gói', 'cần chạy', 'nhận vận hành', 'cần tư vấn'];
  const bad = ['khoá học', 'khóa học', 'tuyển', 'chia sẻ kinh nghiệm', 'inbox nhé', '2k', 'sinh viên', 'tự học'];
  let score = 35;
  if (buy.some(k => t.includes(k))) score += 45;
  if (/\d+\s*(tr|triệu|k\b)/.test(t)) score += 10;     // có ngân sách
  if (bad.some(k => t.includes(k))) score -= 40;
  score = Math.max(0, Math.min(100, score));
  return {
    is_real_lead: score >= 40,
    hotness: score,
    intent: score >= 60 ? 'Cần mua / tìm nhà cung cấp' : 'Hỏi kinh nghiệm / không rõ',
    industry: source.industry || '',
    service: source.industry ? 'Performance Marketing' : '',
    reply: '',
    _llm: false,
    _usage: { prompt: 0, completion: 0, total: 0 }
  };
}

/* Gợi ý trọng số chấm điểm (từ config/app.weights) → 1 dòng hướng dẫn cho LLM */
function weightsHint(weights) {
  if (!Array.isArray(weights) || !weights.length) return '';
  const parts = weights
    .filter(w => w && w.label)
    .map(w => `${w.label}: ${w.weight ?? 0}%`);
  return parts.length ? `\nƯu tiên chấm điểm theo trọng số: ${parts.join(', ')}.` : '';
}

export async function scoreLead(post, source, weights, brandAi) { /* v-brandai */
  if (!CFG.LLM_API_KEY) return heuristic(post.text, source);
  try {
    const r = await fetch(`${CFG.LLM_BASE_URL}/chat/completions`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${CFG.LLM_API_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: CFG.LLM_MODEL,
        response_format: { type: 'json_object' },
        messages: [
          { role: 'system', content: SYS + brandAiCtx(brandAi) },
          { role: 'user', content: `Ngành ưu tiên: ${(brandAi && brandAi.nganh) || source.industry || 'đa ngành'}.${weightsHint(weights)}\nYêu cầu bổ sung về JSON: THÊM field "need" = tóm tắt NHU CẦU của khách (khách đang cần gì — 1 câu ngắn tiếng Việt); còn field "intent" = NHẬN ĐỊNH Ý ĐỊNH MUA (mức độ sẵn sàng chi tiền, độ gấp, mức chủ động, tín hiệu ngân sách/hẹn gặp — 1 câu tiếng Việt, KHÔNG lặp lại nội dung của "need").\n${buildPostContent(post, 1500)}` }
        ]
      })
    });
    if (!r.ok) throw new Error(`LLM ${r.status}: ${(await r.text()).slice(0,200)}`);
    const j = await r.json();
    const obj = JSON.parse(j.choices[0].message.content);
    // Bền vững nếu model trả hotness dạng chữ ('low'/'high'…) thay vì số
    const HMAP = { low:30, medium:60, high:85, hot:90, warm:65, cold:35, none:0 };
    let h = obj.hotness;
    if (typeof h === 'string') { const k=h.toLowerCase().trim(); h = (k in HMAP) ? HMAP[k] : Number(h); }
    obj.hotness = Math.max(0, Math.min(100, Number(h) || 0));
    if (!obj.industry) obj.industry = source.industry || '';
    obj.role = normRole(obj.role); obj.role_reason = String(obj.role_reason || '').slice(0, 200); /* v-selfcmt */
    // Ghi nhận token để thống kê chi phí (lịch sử quét)
    const u = j.usage || {};
    const pt = Number(u.prompt_tokens) || 0, ct = Number(u.completion_tokens) || 0;
    obj._llm = true;
    obj._usage = { prompt: pt, completion: ct, total: Number(u.total_tokens) || (pt + ct) };
    return obj;
  } catch (e) {
    // s18: loi tam thoi -> thu lai 1 lan sau 1.5s; het credit thi khoi thu (vo ich)
    if (!post._retried && !/insufficient_quota|credit_balance_exhausted/.test(String(e.message))) {
      post._retried = true;
      await new Promise(res => setTimeout(res, 1500));
      return scoreLead(post, source, weights, brandAi);
    }
    log.warn('LLM lỗi, dùng heuristic:', e.message);
    return heuristic(post.text, source);
  }
}
