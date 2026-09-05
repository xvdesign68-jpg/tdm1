// LENH #30: binh luan cong khai LUON co CTA dieu huong + bam dung cau khach hoi + tham chieu goi y sales. Idempotent (marker LENH #30), fail-closed (thieu moc = khong ghi).
const fs = require('fs'); const F = process.argv[2] || 'content.js';
let s = fs.readFileSync(F, 'utf8');
if (s.includes('LENH #30')) { console.log('da patch roi (LENH #30) - bo qua'); process.exit(0); }
const reps = [];
const rep = (name, a, b) => { const i = s.indexOf(a); if (i < 0) throw new Error('KHONG THAY MOC: ' + name); if (s.indexOf(a, i + 1) >= 0) throw new Error('MOC TRUNG: ' + name); reps.push([i, a, b]); };
// (A) CMT_SOFT co CTA + CTA_DEF/CTA_RE/ensureCta
rep('CMT_SOFT', `const CMT_SOFT = ['Mình cũng từng loay hoay vụ {nhucau} này, hỏi kỹ vài chỗ rồi so sánh sẽ chọn được bên hợp. Chúc bạn sớm tìm được nhé!', 'Nhu cầu {nhucau} này giờ nhiều bên làm lắm, bạn cứ hỏi rõ cam kết và thời gian trước khi chốt cho chắc nha.', 'Bài này đúng vấn đề nhiều người gặp. Nếu cần mình chia sẻ thêm kinh nghiệm về {nhucau}, cứ hỏi nhé.'];`,
`const CMT_SOFT = ['Mình cũng từng loay hoay vụ {nhucau} này. Bạn cần mình chia sẻ kinh nghiệm thì nhắn riêng mình nhé!', 'Nhu cầu {nhucau} này giờ nhiều bên làm lắm, quan trọng là hỏi rõ cam kết trước khi chốt. Cần mình gợi ý thêm thì inbox mình nha.', 'Bài này đúng vấn đề nhiều người gặp. Bạn nhắn mình, mình chia sẻ thêm về {nhucau} nhé.']; // LENH #30: mẫu mềm vẫn kết bằng CTA
/* LENH #30: bình luận công khai LUÔN kết bằng CTA điều hướng (thị trường VN: câu "vô thưởng vô phạt" không chuyển đổi).
   CTA_RE = dấu hiệu đã có CTA (mời nhắn/inbox, xin số lượng, hỏi sỉ-lẻ, báo giá…); thiếu → nối CTA của brand (Content Studio) hoặc CTA mặc định. */
const CTA_DEF = ['Anh/chị nhắn riêng mình để nhận báo giá chi tiết nhé.', 'Cần báo giá nhanh anh/chị inbox mình nhé.', 'Anh/chị cho mình biết lấy sỉ hay lẻ và số lượng dự kiến để mình báo giá phù hợp nhé.'];
const CTA_RE = /inbox|\\bib\\b|nhắn|liên hệ|để lại|báo giá|bảng giá|gửi giá|tư vấn|số lượng|\\bsỉ\\b|\\blẻ\\b|cho (?:mình|em|bên mình|shop) (?:xin|biết|hỏi)/i;
function ensureCta(s, c) {
  s = String(s || '').trim(); if (!s || CTA_RE.test(s)) return s;
  const cta = (c && c.cta && c.cta.length <= 140) ? c.cta : pick(CTA_DEF);
  const room = 360 - cta.length - 2; const body = s.length > room ? clean(s, room) : s;
  return joinSent(body, cta);
}`);
// (B) mac dinh kieu binh luan: co CTA (direct); 'soft' chi khi brand chon ro
rep('contentOf.commentStyle', `commentStyle: c.commentStyle === 'direct' ? 'direct' : 'soft',`, `commentStyle: c.commentStyle === 'soft' ? 'soft' : 'direct', /* LENH #30: mặc định có CTA */`);
// (C) templateGen + replyGen qua ensureCta (va tran 220 -> 320 con sot tu LENH #27)
rep('templateGen', `return { comment: clean(fill(pick(cm), lead, c), 220),`, `return { comment: ensureCta(clean(fill(pick(cm), lead, c), 320), c),`);
rep('replyGen', `return { comment: clean(r, 500),`, `return { comment: ensureCta(clean(r, 500), c),`);
// (D) style + isCmt + ngu canh comment-lead
rep('style', `  const style = c.commentStyle === 'direct' ? 'giới thiệu NHẸ 1 câu là bên bạn có thể giúp + mời nhắn riêng, không nêu giá' : 'ĐỒNG CẢM hoặc GỢI MỞ hữu ích, TUYỆT ĐỐI KHÔNG chào bán, không mời inbox, không nhắc tên brand';`,
`  // LENH #30: nhận diện lead là BÌNH LUẬN (khách viết dưới bài người khác) + tách text khách / bài gốc theo field có sẵn
  const norm = v => (typeof v === 'string' ? v : '').replace(/\\s+/g, ' ').trim();
  const isCmt = !!(lead.comment_id || lead.comment_url || lead.kind === 'comment');
  const t0 = norm(lead.text), ct = norm(lead.comment_text || lead.commentText || lead.comment);
  const custText = ((isCmt && ct) ? ct : t0).slice(0, 700);
  const parentText = isCmt ? norm(lead.parent_text || lead.parentText || lead.post_text || lead.postText || lead.parent_post || ((ct && ct !== t0) ? t0 : '')).slice(0, 400) : '';
  const style = c.commentStyle === 'soft'
    ? 'giọng ĐỒNG CẢM/gợi mở, KHÔNG nhắc tên brand, KHÔNG kể sản phẩm; nhưng câu cuối vẫn PHẢI là CTA nhẹ (mời khách nhắn riêng, hoặc hỏi 1 câu ngắn để khách trả lời)'
    : 'trả lời ĐÚNG ý khách + có thể nói NHẸ nửa câu là bên mình có sẵn sản phẩm/dịch vụ này; câu cuối PHẢI là CTA rõ: mời nhắn riêng/inbox để nhận báo giá, hoặc hỏi lấy sỉ hay lẻ / số lượng dự kiến';`);
rep('prompt comment', `1) "comment": bình luận CÔNG KHAI dưới bài của khách — \${style}. Tối đa 2 câu, dưới 180 ký tự. KHÔNG link, KHÔNG số điện thoại, KHÔNG hashtag, KHÔNG giá.`,
`1) "comment": bình luận CÔNG KHAI trả lời \${isCmt ? 'ĐÚNG BÌNH LUẬN khách vừa viết dưới bài (không trả lời bài gốc)' : 'bài đăng của khách'} — \${style}. Cấu trúc: câu 1 bám đúng điều khách hỏi/cần, hữu ích và cụ thể (khách hỏi giá → nói giá tuỳ loại/quy cách/số lượng, KHÔNG nêu con số); câu cuối = CTA (dựa trên "CTA mong muốn" bên dưới, diễn đạt lại cho khớp cách xưng hô với khách). Tối đa 3 câu, dưới 220 ký tự. KHÔNG link, KHÔNG số điện thoại, KHÔNG hashtag, KHÔNG con số giá. KHÔNG viết câu vô thưởng vô phạt kiểu "chúc bạn sớm tìm được".`);
rep('usr', `\\nBÀI/BÌNH LUẬN CỦA KHÁCH: "\${String(lead.text || '').replace(/\\s+/g, ' ').slice(0, 700)}"\`;`,
`\\nGỢI Ý ĐÃ SOẠN CHO SALES (tham khảo, giữ cùng ý khi phù hợp): "\${norm(lead.reply).slice(0, 300) || '(không có)'}"\\n\${isCmt ? 'BÌNH LUẬN CỦA KHÁCH (khách viết dưới bài của người khác)' : 'BÀI ĐĂNG CỦA KHÁCH'}: "\${custText}"\${parentText ? '\\nBÀI GỐC mà khách đang bình luận: "' + parentText + '"' : ''}\`;`);
// (E) hau xu ly: ensureCta cho comment AI
rep('post-process', `let comment = stripForbid(clean(j.comment, 320).replace(/(?:\\+?84|0)(?:[\\s.-]?\\d){9}(?!\\d)/g, ''), c.forbid);`,
`let comment = ensureCta(stripForbid(clean(j.comment, 320).replace(/(?:\\+?84|0)(?:[\\s.-]?\\d){9}(?!\\d)/g, ''), c.forbid), c); /* LENH #30 */`);
// ap dung (tu cuoi len de offset khong lech)
reps.sort((x, y) => y[0] - x[0]);
for (const [i, a, b] of reps) s = s.slice(0, i) + b + s.slice(i + a.length);
fs.writeFileSync(F, s);
console.log('PATCH OK (' + reps.length + ' mốc) → ' + F);
