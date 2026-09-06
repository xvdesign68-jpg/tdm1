// Harness LỆNH #34: (5) nhận biết bài gốc = bài chào bán của người khác → bình luận nhẹ · (2) inbox ngắn kết bằng 1 câu hỏi · (6) meta nội dung
import fs from 'fs'; import path from 'path'; import { pathToFileURL } from 'url';
process.env.LLM_API_KEY = 'x'; process.env.LLM_MODEL = 'gpt-test';
let src = fs.readFileSync('content.js', 'utf8');
src = src.replace(/^import \{ onRequest \} from 'firebase-functions\/v2\/https';$/m, 'const onRequest=(o,f)=>f;').replace(/^import \{ getFirestore \} from 'firebase-admin\/firestore';$/m, 'const getFirestore=()=>({});').replace(/^import \{ getAuth \} from 'firebase-admin\/auth';$/m, 'const getAuth=()=>({});');
src += '\nexport { contentOf, templateGen, replyGen, parentKindOf, cmpFinish, ensureQuestion, ensureCta, metaOf, leadTexts };\n'; fs.writeFileSync('_c.mjs', src);
const C = await import(pathToFileURL(path.resolve('_c.mjs')).href);
let pass = 0, total = 0; const check = (n, ok, x) => { total++; if (ok) pass++; console.log(ok ? 'PASS' : 'FAIL', n, x !== undefined ? '→ ' + x : ''); };
const SELL = 'Mực khô loại 1 Phú Quốc 350k/kg, ship toàn quốc, ib mình nhé'; const BUY = 'Mọi người cho mình hỏi chỗ nào bán mực khô ngon uy tín với ạ'; const OTHER = 'Hôm nay trời đẹp quá, cả nhà đi biển chơi vui ghê';
/* --- parentKindOf --- */
let k = C.parentKindOf({ kind: 'comment', text: 'Giá', parent_text: SELL });
check('pk: bài có giá/ship/ib → seller (chắc)', k.kind === 'seller' && k.sure === true, k.why);
k = C.parentKindOf({ kind: 'comment', text: 'mình cũng đang tìm', parent_text: BUY });
check('pk: bài hỏi mua → buyer (chắc)', k.kind === 'buyer' && k.sure === true, k.why);
k = C.parentKindOf({ kind: 'comment', text: 'Giá', parent_text: OTHER });
check('pk: bài thường + khách hỏi "Giá" → seller (không chắc)', k.kind === 'seller' && k.sure === false, k.why);
k = C.parentKindOf({ kind: 'comment', text: 'đẹp quá', parent_text: OTHER });
check('pk: bài thường + bình luận thường → chưa rõ ("")', k.kind === '' && k.sure === false, k.why);
k = C.parentKindOf({ kind: 'comment', text: 'Ib', parent_text: '' });
check('pk: không có bài gốc → seller (không chắc)', k.kind === 'seller' && k.sure === false, k.why);
k = C.parentKindOf({ kind: 'comment', text: 'Giá', parent_text: 'Ai cần mua cá khô ngon ib mình, giá 120k/kg' });
check('pk: vừa bán vừa "cần mua" → seller', k.kind === 'seller', k.why);
k = C.parentKindOf({ text: 'Cần mua 1 tấn cá xốp', post_url: 'x' });
check('pk: lead là BÀI → ""', k.kind === '' && k.sure === true);
k = C.parentKindOf({ kind: 'comment', text: 'Giá', parent_text: OTHER, parent_role: 'buyer' });
check('pk: scanner gắn parent_role → tin scanner', k.kind === 'buyer' && k.sure === true, k.why);
k = C.parentKindOf({ kind: 'comment', text: 'ok', parent_text: 'Cần tuyển 5 nhân viên kho lương 8tr, liên hệ zalo' });
check('pk: bài tuyển dụng → seller', k.kind === 'seller' && k.sure === true, k.why);
/* --- cmpFinish: gọt giá/tên brand/so sánh + CTA mời nhắn riêng, ≤200 --- */
let x = C.cmpFinish('Chị Hiền ơi, bên Hải Sản Cường Linh có mực khô loại 1 giá 320k/kg, rẻ hơn bên kia nhiều. Mực dày mình, phơi 2 nắng nên ngọt thịt. Chị lấy khoảng bao nhiêu ạ?', 'Hải Sản Cường Linh');
check('cmpFinish: bỏ câu có giá + tên brand + "rẻ hơn"', !/320k|Cường Linh|rẻ hơn/i.test(x), x);
check('cmpFinish: ≤200 ký tự + có mời nhắn riêng/CTA', x.length <= 200 && /nhắn|inbox|số lượng|bao nhiêu/i.test(x), x.length);
x = C.cmpFinish('Bên mình giá 300k/kg nhé chị.', 'HSCL');
check('cmpFinish: gọt hết → mẫu mặc định khớp xưng hô "chị"', /^(?:Chị|Giá)/.test(x) && /chị/.test(x) && !/anh\/chị/i.test(x) && !/300k/.test(x), x);
x = C.cmpFinish('Chị ơi loại này tuỳ cỡ ạ, chị cần cỡ nào? Em nhắn riêng cho chị nhé.', 'HSCL');
check('cmpFinish: câu sạch có CTA sẵn → giữ nguyên', x === 'Chị ơi loại này tuỳ cỡ ạ, chị cần cỡ nào? Em nhắn riêng cho chị nhé.', x);
/* --- ensureQuestion --- */
x = C.ensureQuestion('Chào chị Lan, em thấy chị cần mực khô loại 1. Bên em mực dày, phơi 2 nắng.');
check('ensureQuestion: thiếu ? → nối 1 câu hỏi khớp "chị"', /\?$/.test(x) && /chị/i.test(x.split('. ').pop()) && !/anh\/chị/i.test(x), x.slice(-70));
check('ensureQuestion: đã có ? → giữ nguyên', C.ensureQuestion('Chị lấy bao nhiêu ạ?') === 'Chị lấy bao nhiêu ạ?');
/* --- ensureCta alt --- */
x = C.ensureCta('Dạ loại này tuỳ cỡ ạ.', { cta: 'Anh/chị ghé shop 123 Lê Lợi hoặc gọi hotline nhé' }, ['Em nhắn riêng cho anh/chị nhé.']);
check('ensureCta(alt): dùng CTA thay thế, không dùng CTA brand', /Em nhắn riêng cho anh\/chị nhé\.$/.test(x) && !/hotline/.test(x), x);
/* --- reply mode --- */
const cR = C.contentOf({ content: { mode: 'reply', cta: 'Anh/chị inbox em gửi bảng giá nhé' } });
const REPLY = 'Chào chị Hiền, bên Hải Sản Cường Linh có cá lóc khô tẩm ớt giá 180k/kg, ngon hơn bên kia. Chị inbox em gửi bảng giá nhé.';
let r = C.replyGen({ kind: 'comment', text: 'Giá', parent_text: SELL, reply: REPLY }, cR, 'Hải Sản Cường Linh');
check('reply/bài đối thủ: comment nhẹ (không giá, không brand, không so sánh)', !/180k|Cường Linh|ngon hơn/.test(r.comment) && r.comment.length <= 200, r.comment);
check('reply/bài đối thủ: inbox = nguyên gợi ý (không đụng)', r.inbox === REPLY);
check('reply/bài đối thủ: meta parent=seller, cta=cmp, mode=reply, variant=-1', r.meta && r.meta.parent === 'seller' && r.meta.cta === 'cmp' && r.meta.mode === 'reply' && r.meta.variant === -1 && r.meta.v === 34, JSON.stringify(r.meta));
check('reply/bài đối thủ: note ghi rõ bài gốc', /bài gốc:.*bình luận nhẹ/.test(r.note), r.note);
r = C.replyGen({ kind: 'comment', text: 'mình cũng tìm', parent_text: BUY, reply: REPLY }, cR, 'Hải Sản Cường Linh');
check('reply/bài hỏi mua: comment TRỰC TIẾP như cũ (giữ brand)', /Cường Linh/.test(r.comment) && r.meta.parent === 'buyer' && r.meta.cta === 'brand', r.comment.slice(0, 60));
r = C.replyGen({ text: 'Cần mua 1 tấn cá xốp', reply: REPLY }, cR, 'Hải Sản Cường Linh');
check('reply/lead là bài: hành vi cũ, meta parent=""', /Cường Linh/.test(r.comment) && r.meta.parent === '' && r.inbox === REPLY, JSON.stringify(r.meta));
/* --- template mode --- */
const cT = C.contentOf({ content: { mode: 'template' } });
r = C.templateGen({ kind: 'comment', name: 'Hiền', text: 'Giá', parent_text: SELL, service: 'mực khô' }, cT, 'HSCL');
check('template/bài đối thủ: dùng mẫu nhẹ, không {dichvu} chào bán', !/mực khô|Bên mình có làm/.test(r.comment) && /nhắn riêng|inbox/i.test(r.comment) && r.meta.parent === 'seller', r.comment);
r = C.templateGen({ name: 'Tuấn', need: 'mua ghẹ đá sỉ', service: 'ghẹ đá' }, cT, 'HSCL');
check('template/inbox mẫu mới: ngắn ≤ 200, kết bằng câu hỏi', r.inbox.length <= 200 && /\?$/.test(r.inbox.trim()), r.inbox);
/* --- AI mode (mock fetch) --- */
let lastSys = '', lastUsr = '', reply = {};
globalThis.fetch = async (u, o) => { const b = JSON.parse(o.body); lastSys = b.messages[0].content; lastUsr = b.messages[1].content; return { ok: true, status: 200, json: async () => ({ choices: [{ message: { content: JSON.stringify(reply) }, finish_reason: 'stop' }] }) }; };
const brandAi = { code: 'hscl-01', name: 'Hải Sản Cường Linh', ai: { nganh: 'Hải sản', dichvu: 'Mực khô, cá khô', khach: 'người kinh doanh' }, content: { mode: 'ai', cta: 'Anh/chị inbox em gửi bảng giá nhé' } };
// (1) comment-lead dưới bài thường, AI nói seller → nhẹ
reply = { comment: 'Chị Hiền ơi, bên Hải Sản Cường Linh có cá lóc khô 180k/kg ngon lắm. Chị inbox em nhé.', inbox: 'Chào chị Hiền, em thấy chị hỏi cá lóc khô tẩm ớt. Bên em cá phơi 2 nắng, tẩm ớt vừa ăn. Chị lấy khoảng bao nhiêu ạ?', parent_kind: 'seller', spam: 3, note: 'ok' };
r = await C.genForLead(brandAi, { id: 'L1', name: 'Hiền', temp: 'warm', text: 'Giá', parent_text: OTHER, comment_id: '5', kind: 'comment', reply: 'x' });
check('AI/cmt: prompt có bước xác định bài gốc + parent_kind + nhận định hệ thống', /TRƯỚC HẾT xác định bài gốc/.test(lastSys) && /"parent_kind"/.test(lastSys) && /Nhận định của hệ thống: có vẻ là bài CHÀO BÁN/.test(lastSys) && /BÀI GỐC mà khách đang bình luận \(có vẻ/.test(lastUsr));
check('AI/cmt: AI nói seller → comment gọt giá/brand + CTA nhẹ', !/180k|Cường Linh/.test(r.comment) && /nhắn|inbox/i.test(r.comment) && r.comment.length <= 200, r.comment);
check('AI/cmt: inbox giữ nguyên (đã có ?), meta parent=seller cta=cmp q=1 variant 0..5', r.inbox === reply.inbox && r.meta.parent === 'seller' && r.meta.cta === 'cmp' && r.meta.q === 1 && r.meta.variant >= 0 && r.meta.variant <= 5 && r.meta.mode === 'ai' && r.meta.model === 'gpt-test', JSON.stringify(r.meta));
check('AI/cmt: note nêu bài gốc', /bài gốc: bài chào bán của người khác → bình luận nhẹ/.test(r.note), r.note);
check('AI/cmt: prompt inbox 2-3 câu kết bằng câu hỏi', /2-3 câu, dưới 220 ký tự/.test(lastSys) && /PHẢI kết bằng câu hỏi/.test(lastSys) && /KHÔNG nhắc tới chủ bài kia/.test(lastSys));
// (2) heuristic chắc seller, AI nói buyer → vẫn seller (nhẹ)
reply = { comment: 'Bên Hải Sản Cường Linh có sẵn ạ, chị inbox em.', inbox: 'Chào chị. Chị lấy bao nhiêu ạ?', parent_kind: 'buyer', spam: 3, note: '' };
r = await C.genForLead(brandAi, { id: 'L2', name: 'Hiền', text: 'Giá', parent_text: SELL, comment_id: '5', kind: 'comment' });
check('AI/cmt: heuristic CHẮC seller, AI nói buyer → vẫn seller', r.meta.parent === 'seller' && !/Cường Linh/.test(r.comment), r.comment);
// (3) heuristic không chắc ("" bài thường), AI nói buyer → buyer (trực tiếp)
reply = { comment: 'Bên Hải Sản Cường Linh có sẵn ạ, chị inbox em.', inbox: 'Chào chị. Chị lấy bao nhiêu ạ?', parent_kind: 'buyer', spam: 3, note: '' };
r = await C.genForLead(brandAi, { id: 'L3', name: 'Hiền', text: 'mình cũng tìm', parent_text: OTHER, comment_id: '5', kind: 'comment' });
check('AI/cmt: heuristic chưa rõ, AI nói buyer → buyer, comment trực tiếp giữ brand', r.meta.parent === 'buyer' && /Cường Linh/.test(r.comment) && r.meta.cta === 'brand', r.comment);
// (4) heuristic chưa rõ, AI không trả parent_kind → seller (an toàn)
reply = { comment: 'Bên Hải Sản Cường Linh có sẵn ạ, chị inbox em.', inbox: 'Chào chị. Chị lấy bao nhiêu ạ?', spam: 3, note: '' };
r = await C.genForLead(brandAi, { id: 'L4', name: 'Hiền', text: 'đẹp quá', parent_text: OTHER, comment_id: '5', kind: 'comment' });
check('AI/cmt: chưa rõ + AI không nói → seller (an toàn)', r.meta.parent === 'seller' && !/Cường Linh/.test(r.comment), r.comment);
// (5) lead là bài: không có parent_kind trong prompt; inbox thiếu ? → nối câu hỏi; dài → cắt ≤~320
reply = { comment: 'Dạ bên em có sẵn cá xốp ạ. Anh inbox em gửi bảng giá nhé.', inbox: 'Chào anh Quân, em thấy anh cần 1 tấn cá xốp. Bên em cá xốp đánh bắt Phú Quốc, giao tận kho. Anh cứ liên hệ em nhé.', spam: 2, note: 'ok' };
r = await C.genForLead(brandAi, { id: 'L5', name: 'Quân', temp: 'hot', text: 'Cần mua 1 tấn cá xốp giao HCM', post_url: 'https://www.facebook.com/groups/1/posts/2/' });
check('AI/bài: prompt KHÔNG có parent_kind; comment như cũ', !/parent_kind/.test(lastSys) && !/TRƯỚC HẾT xác định/.test(lastSys) && /Cường Linh|bên em/.test(r.comment) && r.meta.parent === '', r.comment);
check('AI/bài: inbox thiếu ? → nối đúng 1 câu hỏi khớp "anh"', /\?$/.test(r.inbox) && r.meta.q === 1 && /anh/i.test(r.inbox.split('. ').pop()) && !/anh\/chị/i.test(r.inbox), r.inbox);
reply = { comment: 'ok. Anh inbox em nhé.', inbox: 'Chào anh Quân, em thấy anh cần 1 tấn cá xốp giao HCM. Bên em cá xốp đánh bắt Phú Quốc, cấp đông ngay trên tàu nên giữ độ tươi. Bên em giao tận kho trong 24h, có xuất hoá đơn đầy đủ. Ngoài ra bên em còn có mực, ghẹ, tôm các loại cho anh tham khảo thêm. Anh cần giao trong tuần này hay tuần sau ạ?', spam: 2, note: 'ok' };
r = await C.genForLead(brandAi, { id: 'L6', name: 'Quân', temp: 'hot', text: 'Cần mua 1 tấn cá xốp giao HCM', post_url: 'x' });
check('AI/bài: inbox AI quá dài → cắt ở cuối câu ≤ ~320 rồi vẫn kết bằng câu hỏi', r.inbox.length <= 330 && /\?$/.test(r.inbox) && r.meta.ilen === r.inbox.length, r.inbox.length + ' | ' + r.inbox.slice(-50));
// (6) optout brand tự ghi → đứng sau câu hỏi, khớp xưng hô
const brandOpt = Object.assign({}, brandAi, { content: { mode: 'ai', optout: 'Không cần thì anh/chị bỏ qua giúp em ạ.' } });
reply = { comment: 'Dạ có ạ. Chị inbox em nhé.', inbox: 'Chào chị Lan, em thấy chị cần mực khô. Chị lấy bao nhiêu ạ?', spam: 2, note: '' };
r = await C.genForLead(brandOpt, { id: 'L7', name: 'Lan', text: 'cần mực khô', post_url: 'x' });
check('AI/bài: opt-out brand tự ghi → nối sau câu hỏi, khớp "chị"', /ạ\? Không cần thì chị bỏ qua giúp em ạ\.$/.test(r.inbox), r.inbox.slice(-60));
// (7) AI lỗi → fallback reply có meta + gate đối thủ
globalThis.fetch = async () => { throw new Error('mạng'); };
r = await C.genForLead(brandAi, { id: 'L8', name: 'Hiền', text: 'Giá', parent_text: SELL, comment_id: '5', kind: 'comment', reply: REPLY });
check('AI lỗi → fallback reply: vẫn gate bài đối thủ + meta', r.mode === 'reply' && r.meta && r.meta.parent === 'seller' && !/180k|Cường Linh/.test(r.comment) && /AI lỗi/.test(r.note), r.note);
console.log(`\n${pass}/${total} PASS`); if (pass !== total) process.exit(1);
