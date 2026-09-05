process.env.LLM_API_KEY = 'x'; process.env.LLM_MODEL = 'gpt-test';
const { genForLead, contentOf, templateGen, replyGen, ensureCta, CTA_RE } = await import('./_c.mjs');
let pass = 0, total = 0; const check = (n, ok, x) => { total++; if (ok) pass++; console.log(ok ? 'PASS' : 'FAIL', n, x || ''); };
let lastBody = null, reply = { comment: 'Mình hiểu, cá lóc khô thì giá tuỳ loại và quy cách đóng gói.', inbox: 'Chào chị, em thấy chị hỏi giá cá lóc khô. Bên em có sẵn nhiều loại. Chị lấy sỉ hay lẻ ạ? Chị inbox em gửi bảng giá nhé.', spam: 3, note: 'ok' };
globalThis.fetch = async (url, o) => { lastBody = JSON.parse(o.body); return { ok: true, status: 200, json: async () => ({ choices: [{ message: { content: JSON.stringify(reply) }, finish_reason: 'stop' }] }) }; };
const brandAi = { code: 'hscl-01', ai: { nganh: 'Hải sản', dichvu: 'Hải sản khô, mực khô', khach: 'người kinh doanh' } };
const cmtLead = { id: 'L1', name: 'Hien Chau Thi Thu', temp: 'warm', need: 'mua cá lóc khô', service: 'cá lóc khô', industry: 'Hải sản', text: 'Giá', comment_id: '555', kind: 'comment', parent_text: 'Cá lóc khô sỉ 1 nắng, hàng mới về, ai cần liên hệ', reply: 'Dạ anh/chị cần lấy sỉ hay lẻ và dự kiến số lượng bao nhiêu ạ? Bên em báo giá phù hợp và hỗ trợ giao toàn quốc nhé.' };
const postLead = { id: 'L2', name: 'Tuyến Tôm', temp: 'warm', need: 'tìm nhà cung cấp sỉ ghẹ đá', text: 'Cần tìm nhà cung cấp sỉ ghẹ đá số lượng lớn cho nhà hàng', reply: 'Dạ bên em có ghẹ đá sỉ, anh/chị cho em xin số lượng để báo giá ạ.' };
// 1) contentOf mac dinh
check('mặc định commentStyle = direct (có CTA)', contentOf(brandAi).commentStyle === 'direct' && contentOf(brandAi).mode === 'ai');
check('brand chọn soft rõ → giữ soft', contentOf({ content: { commentStyle: 'soft' } }).commentStyle === 'soft');
// 2) AI mode, comment thiếu CTA → nối CTA (brand chưa có cta → CTA mặc định)
let r = await genForLead(brandAi, cmtLead);
check('AI comment thiếu CTA → tự nối CTA mặc định', CTA_RE.test(r.comment) && r.comment.startsWith('Mình hiểu') && r.mode === 'ai', r.comment);
check('prompt comment-lead: có BÌNH LUẬN CỦA KHÁCH + BÀI GỐC + GỢI Ý SALES', /BÌNH LUẬN CỦA KHÁCH[^"]*"Giá"/.test(lastBody.messages[1].content) && /BÀI GỐC mà khách đang bình luận: "Cá lóc khô/.test(lastBody.messages[1].content) && /GỢI Ý ĐÃ SOẠN CHO SALES[^"]*"Dạ anh\/chị cần lấy sỉ/.test(lastBody.messages[1].content), lastBody.messages[1].content.slice(-260));
check('prompt sys: yêu cầu trả lời ĐÚNG BÌNH LUẬN + câu cuối CTA', /ĐÚNG BÌNH LUẬN khách vừa viết/.test(lastBody.messages[0].content) && /câu cuối PHẢI là CTA rõ/.test(lastBody.messages[0].content));
// 3) brand có CTA riêng → nối CTA brand
const brandCta = { ...brandAi, content: { cta: 'Anh/chị inbox em gửi bảng giá sỉ và lẻ hôm nay nhé' } };
r = await genForLead(brandCta, cmtLead);
check('brand có CTA → nối đúng CTA brand', r.comment.endsWith('Anh/chị inbox em gửi bảng giá sỉ và lẻ hôm nay nhé') && /đóng gói\. Anh\/chị inbox/.test(r.comment), r.comment);
// 4) AI comment đã có CTA → giữ nguyên
reply = { ...reply, comment: 'Dạ giá cá lóc khô tuỳ loại và quy cách ạ. Chị cho em xin số lượng để em báo giá tốt nhất nhé.' };
r = await genForLead(brandCta, cmtLead);
check('AI comment đã có CTA → không nối thêm', r.comment === 'Dạ giá cá lóc khô tuỳ loại và quy cách ạ. Chị cho em xin số lượng để em báo giá tốt nhất nhé.', r.comment);
// 5) post-lead prompt
r = await genForLead(brandAi, postLead);
check('prompt post-lead: BÀI ĐĂNG CỦA KHÁCH, không có BÀI GỐC', /BÀI ĐĂNG CỦA KHÁCH: "Cần tìm/.test(lastBody.messages[1].content) && !/BÀI GỐC/.test(lastBody.messages[1].content) && /bài đăng của khách/.test(lastBody.messages[0].content));
// 6) soft style prompt
r = await genForLead({ ...brandAi, content: { commentStyle: 'soft' } }, postLead);
check('soft: prompt vẫn đòi CTA nhẹ, không nhắc brand', /KHÔNG nhắc tên brand/.test(lastBody.messages[0].content) && /CTA nhẹ/.test(lastBody.messages[0].content));
// 7) template + reply
const c = contentOf({ content: { mode: 'template', commentStyle: 'soft' } });
for (let i = 0; i < 6; i++) { const t = templateGen(postLead, c); if (!CTA_RE.test(t.comment)) { check('templateGen soft có CTA', false, t.comment); break; } if (i === 5) check('templateGen soft luôn có CTA (6 lần)', true); }
r = replyGen({ ...postLead, reply: 'Bài của bạn hay quá, chúc bạn sớm tìm được nguồn hàng tốt.' }, contentOf({ content: { mode: 'reply' } }));
check('replyGen: gợi ý không CTA → nối CTA', CTA_RE.test(r.comment) && r.comment.startsWith('Bài của bạn hay quá'), r.comment);
r = replyGen(postLead, contentOf({ content: { mode: 'reply' } }));
check('replyGen: gợi ý đã có CTA → giữ nguyên', r.comment === postLead.reply);
// 8) ensureCta giới hạn độ dài
const long = Array(12).fill('Câu này khá dài để thử giới hạn độ dài của bình luận công khai.').join(' ');
const e = ensureCta(long, { cta: 'Anh/chị inbox em nhé.' });
check('ensureCta thân dài → cắt ở cuối câu rồi nối CTA, ≤ ~400', e.endsWith('Anh/chị inbox em nhé.') && e.length <= 420 && /\. Anh\/chị inbox/.test(e), e.length + ' ký tự');
// 9) AI lỗi → fallback replyGen có CTA
globalThis.fetch = async () => { throw new Error('boom'); };
r = await genForLead(brandAi, { ...cmtLead, reply: 'Cảm ơn bạn đã chia sẻ.' });
check('AI lỗi → fallback gợi ý có sẵn + CTA', r.mode === 'reply' && CTA_RE.test(r.comment), r.comment);
console.log(`${pass}/${total}`); process.exit(pass === total ? 0 : 1);
