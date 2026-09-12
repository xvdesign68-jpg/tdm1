// lib/multitouch.js — SmartLead (Session 17) — BƯỚC A: gộp lead "multi-touch"
// Cùng một người (identityKey = user_url / SĐT / email) đăng/comment ở NHIỀU nơi trong cửa sổ 48h
// (trượt theo lần gần nhất, chỉ gộp lead CÒN MỞ) -> gộp về 1 lead + mảng touches + boost điểm nóng.
// Nguyên tắc: "thà sót còn hơn nhầm" — chỉ gộp khi khoá định danh mạnh; ẩn danh không contact thì để riêng.
// Fail-safe: hàm này CHỈ được gọi trong try/catch ở index.js; lỗi -> tạo lead thường, không bao giờ chặn lead.
// ESM, khớp ~/firebase-s13/functions.

function isOpen(stage){ const s = String(stage || 'new'); return s !== 'closed' && s !== 'won' && s !== 'lost'; }

// Khoá nhận diện người: user_url -> SĐT -> email. Rỗng nếu ẩn danh & không có contact (=> không gộp).
export function mtIdentityKey(userUrl, phone, email){
  const u = String(userUrl || '').trim().toLowerCase().replace(/\/+$/, '');
  if (u) return 'u:' + u;
  if (phone) return 'p:' + String(phone).trim();
  if (email) return 'e:' + String(email).trim().toLowerCase();
  return '';
}

// 1 lần chạm — đúng shape frontend cần: {source,time,kind,url,snippet,ts}
// atMs (tùy chọn): mốc thời gian THỰC của bài/comment (epoch ms). Nếu không có -> dùng nowMs (lúc quét).
export function mtTouch({ source, time, kind, url, text, atMs } = {}, nowMs){
  const fallback = nowMs || Date.now();
  return {
    source: String(source || ''),
    time: String(time || ''),
    kind: String(kind || 'post'),
    url: String(url || ''),
    snippet: String(text || '').replace(/\s+/g, ' ').trim().slice(0, 240),
    ts: (Number(atMs) > 0 ? Number(atMs) : fallback)
  };
}

// Nhãn khoảng thời gian giữa touch cũ nhất -> mới nhất (VD "35 phút", "2 giờ", "2 ngày").
// Trả '' khi span quá nhỏ (< 2 phút) — thường do nhiều bài được quét trong cùng 1 lần chạy,
// mốc ts bị trùng nên nhãn "0 phút" sẽ gây hiểu nhầm; lúc đó để trống, frontend chỉ hiện số nhóm.
function spanLabel(touches){
  const ts = touches.map(t => t.ts || 0).filter(Boolean);
  if (ts.length < 2) return '';
  const ms = Math.max(...ts) - Math.min(...ts);
  if (ms < 2 * 60000) return '';
  const m = Math.round(ms / 60000);
  if (m < 60) return m + ' phút';
  const h = Math.round(ms / 3600000);
  if (h < 24) return h + ' giờ';
  return Math.round(ms / 86400000) + ' ngày';
}

// Boost điểm CHỈ theo số NHÓM khác nhau — tín hiệu chắc chắn, không phụ thuộc mốc thời gian quét.
// +7 mỗi nhóm tăng thêm, trần +20 (2 nhóm +7, 3 nhóm +14, 4+ nhóm +20).
function calcBoost(groupCount){
  return Math.min(20, Math.max(0, groupCount - 1) * 7);
}

/* Gộp 1 lead mới vào lead multi-touch đang mở của cùng người (nếu có).
 * db: Firestore admin; lead: object lead sắp ghi (đã có author_url/phone/email/source/time/kind/post_url/text/score);
 * opts: { windowH=48, hotThreshold=80 }.
 * Trả TRUE nếu ĐÃ gộp (đã update lead cũ, KHÔNG tạo lead mới, KHÔNG bắn ZNS lại); FALSE nếu không có gì để gộp. */
export async function tryMergeTouch(db, lead, opts = {}){
  const windowH = opts.windowH || 48;
  const hotThreshold = (typeof opts.hotThreshold === 'number') ? opts.hotThreshold : 80;
  const idk = mtIdentityKey(lead.author_url, lead.phone, lead.email);
  if (!idk) return false;                                   // ẩn danh, không contact -> không gộp

  const now = Date.now();
  const cutoff = now - windowH * 3600 * 1000;
  const snap = await db.collection('leads')
    .where('identityKey', '==', idk)
    .where('last_seen_ms', '>=', cutoff)
    .orderBy('last_seen_ms', 'desc').limit(6).get();

  let doc = null;
  snap.forEach(d => { if (!doc) { const x = d.data() || {}; if (isOpen(x.stage)) doc = d; } });
  if (!doc) return false;                                   // không có lead mở phù hợp -> tạo lead mới bình thường

  const cur = doc.data() || {};
  /* v-patch need-split: cung 1 nguoi nhung NHU CAU KHAC NHAU -> khong gop, de tao lead rieng.
     Chi gop khi dung kieu "rai cung 1 bai di nhieu nhom" (noi dung trung cao / cung SDT). */
  try {
    const __pA = String(cur.phone||'').replace(/\D/g,''), __pB = String(lead.phone||'').replace(/\D/g,'');
    if (__pA && __pB && __pA.slice(-9) !== __pB.slice(-9)) return false;   // 2 so dien thoai khac nhau -> 2 nhu cau
    const __tok = z => new Set(String(z||'').toLowerCase().replace(/[^0-9a-z\u00c0-\u1ef9\s]/gi,' ').split(/\s+/).filter(w=>w.length>1));
    const __A = __tok(cur.text), __B = __tok(lead.text);
    if (__A.size && __B.size) {
      let __i = 0; for (const w of __B) if (__A.has(w)) __i++;
      if (__i / (__A.size + __B.size - __i) < 0.55) return false;          // noi dung khac han -> lead rieng
    }
  } catch (e) {}
  const touches = Array.isArray(cur.touches) ? cur.touches.slice() : [];
  const atMs = Number(lead.post_ts || lead.date_posted_ms || 0) || now;  // mốc thực nếu index.js có, không thì lúc quét
  const url = lead.post_url || lead.url || '';
  const nt = mtTouch({ source: lead.source, time: lead.time, kind: lead.kind, url, text: lead.text, atMs }, now);

  // Bài này đã nằm trong hồ sơ (quét lại đúng 1 bài) -> "nhận" để KHÔNG tạo lead trùng, nhưng không ghi lại gì.
  if (nt.url && touches.some(t => t.url === nt.url)) return true;
  touches.push(nt);

  const group_count = new Set(touches.map(t => t.source).filter(Boolean)).size;
  const base_score = Math.max(Number(cur.base_score || cur.score || 0), Number(lead.score || 0));
  const score = Math.min(100, base_score + calcBoost(group_count));

  const upd = {
    touches, group_count, base_score, score,
    last_seen_ms: now,
    merged_at_ms: now,
    insight_stale: group_count >= 2            // đánh dấu cần AI tổng hợp lại (BƯỚC B xử lý)
  };
  const wl = spanLabel(touches);
  if (wl) upd.window_label = wl;               // chỉ đặt khi có nhãn hợp lý, tránh ghi đè bằng "0 phút"
  if (score >= hotThreshold) upd.temp = 'hot';  // multi-touch mạnh -> nóng

  await doc.ref.update(upd);
  return true;
}
