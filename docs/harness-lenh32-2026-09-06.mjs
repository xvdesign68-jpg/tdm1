// Harness LENH #32 — chạy trong thư mục c32/t SAU khi patch: node ../t32.mjs
import fs from 'fs'; import path from 'path'; import { pathToFileURL } from 'url';
const here = f => pathToFileURL(path.resolve(f)).href;
process.env.LLM_API_KEY = 'x'; process.env.LLM_MODEL = 'gpt-test'; process.env.LLM_BASE_URL = 'http://llm.test/v1';
// dựng _c.mjs từ content.js đã patch: thay import Firebase bằng stub + export hàm nội bộ
let src = fs.readFileSync('content.js', 'utf8');
src = src.replace(/^import \{ onRequest \} from 'firebase-functions\/v2\/https';$/m, 'const onRequest=(o,f)=>f;')
  .replace(/^import \{ getFirestore \} from 'firebase-admin\/firestore';$/m, 'const getFirestore=()=>({});')
  .replace(/^import \{ getAuth \} from 'firebase-admin\/auth';$/m, 'const getAuth=()=>({});');
if (/^import /m.test(src)) { console.error('còn import chưa stub:', src.match(/^import .*$/mg)); process.exit(1); }
src += '\nexport { contentOf, templateGen, replyGen, withOptout, fitOptout, pronounOf };\n';
fs.writeFileSync('_c.mjs', src);
const C = await import(here('_c.mjs'));
let pass = 0, total = 0; const check = (n, ok, x) => { total++; if (ok) pass++; console.log(ok ? 'PASS' : 'FAIL', n, x !== undefined ? '→ ' + x : ''); };
const OPT = 'Nếu không tiện, anh/chị cứ bỏ qua tin này nhé.';
/* pronounOf */
check('pronounOf chị', C.pronounOf('Chào chị Lan, em thấy chị cần mực khô.') === 'chị');
check('pronounOf anh', C.pronounOf('Chào anh Nam, em gửi anh bảng giá.') === 'anh');
check('pronounOf bạn', C.pronounOf('Chào bạn, mình thấy bạn đang tìm thực tập.') === 'bạn');
check('pronounOf "anh/chị" → không rõ', C.pronounOf('Chào anh/chị, em bên hải sản Cường Linh.') === '');
check('pronounOf lẫn (chị + tên Lan Anh) → không rõ', C.pronounOf('Chào chị Lan Anh, em gửi bảng giá.') === '');
check('pronounOf không xưng hô → rỗng', C.pronounOf('Bên mình có mực khô loại 1.') === '');
check('pronounOf không nhận "Anh" trong từ khác (thanh, nhanh)', C.pronounOf('Giao nhanh trong ngày, thanh toán khi nhận.') === '');
/* fitOptout */
check('fitOptout → chị', C.fitOptout(OPT, 'Chào chị Lan') === 'Nếu không tiện, chị cứ bỏ qua tin này nhé.');
check('fitOptout viết hoa đầu câu → Anh', C.fitOptout('Anh/chị không cần thì bỏ qua nhé.', 'Chào anh Nam') === 'Anh không cần thì bỏ qua nhé.');
check('fitOptout brand không dùng anh/chị → giữ nguyên', C.fitOptout('Nếu không tiện, bạn cứ bỏ qua nhé.', 'Chào chị') === 'Nếu không tiện, bạn cứ bỏ qua nhé.');
check('fitOptout không rõ xưng hô → giữ anh/chị', C.fitOptout(OPT, 'Bên mình có mực khô.') === OPT);
/* withOptout */
const c = C.contentOf({ content: {} });
check('contentOf optout mặc định', c.optout === OPT);
let r = C.withOptout('Chào chị Lan, em bên Cường Linh.', c);
check('withOptout chưa có → nối + khớp chị', r === 'Chào chị Lan, em bên Cường Linh. Nếu không tiện, chị cứ bỏ qua tin này nhé.', r);
r = C.withOptout('Chào anh Nam, em gửi anh bảng giá. ' + OPT, c);
check('withOptout AI đã chép nguyên văn → sửa tại chỗ, thân tin nguyên', r === 'Chào anh Nam, em gửi anh bảng giá. Nếu không tiện, anh cứ bỏ qua tin này nhé.', r);
r = C.withOptout('Chào anh/chị, em gửi bảng giá. ' + OPT, c);
check('withOptout thân tin dùng anh/chị → giữ nguyên', r === 'Chào anh/chị, em gửi bảng giá. ' + OPT);
r = C.withOptout('Chào chị, em gửi bảng giá. Nếu không tiện, chị bỏ qua giúp em nhé.', c);
check('withOptout AI tự sửa câu opt-out (15 ký tự đầu khớp, đủ câu không khớp) → không đụng', r === 'Chào chị, em gửi bảng giá. Nếu không tiện, chị bỏ qua giúp em nhé.', r);
const longBody = Array.from({ length: 12 }, (_, i) => 'Câu số ' + (i + 1) + ' trong tin nhắn dài gửi cho chị để kiểm tra cắt câu.').join(' ');
r = C.withOptout(longBody, c, 560);
check('withOptout maxBefore=560 → thân tin cắt ở CUỐI CÂU rồi nối opt-out chị', r.length < longBody.length && /\.\s*Nếu không tiện, chị cứ bỏ qua tin này nhé\.$/.test(r) && !/cắt câu\.\s*Câu số 12/.test(r), r.slice(-90));
check('withOptout brand tắt opt-out → nguyên', C.withOptout('Chào chị.', { optout: '' }) === 'Chào chị.');
/* replyGen / templateGen */
r = C.replyGen({ reply: 'Chào chị Lan, em thấy chị cần mực khô loại 1. Chị cho em xin số lượng để báo giá nhé.' }, c);
check('replyGen: inbox opt-out khớp chị', /\. Nếu không tiện, chị cứ bỏ qua tin này nhé\.$/.test(r.inbox), r.inbox.slice(-70));
check('replyGen: comment vẫn có CTA, không dính opt-out', /nhé\.$/.test(r.comment) && !/bỏ qua tin này/.test(r.comment), r.comment.slice(-60));
r = C.replyGen({ reply: 'Dạ chị cần cá gì ạ?' }, c);
check('ensureCta: CTA mặc định "Anh/chị…" khớp xưng hô "chị" của câu gốc', !/anh\/chị/i.test(r.comment) && /chị/i.test(r.comment) && r.comment.startsWith('Dạ chị cần cá gì ạ? '), r.comment);
r = C.replyGen({ reply: 'Dạ bên em có ghẹ đá sỉ.' }, c);
check('ensureCta: câu gốc không xưng hô → CTA giữ anh/chị', /anh\/chị/i.test(r.comment), r.comment);
r = C.ensureCta ? null : null;
r = C.templateGen({ name: 'Tuấn', need: 'mua ghẹ đá sỉ', service: 'ghẹ đá' }, c);
check('templateGen: mẫu dùng "bạn" → opt-out "bạn cứ bỏ qua"', /Nếu không tiện, bạn cứ bỏ qua tin này nhé\.$/.test(r.inbox), r.inbox.slice(-70));
/* AI mode với fetch giả */
let reply = { comment: 'Dạ cá lóc khô giá tuỳ loại và quy cách ạ. Chị cho em xin số lượng để báo giá nhé.', inbox: 'Chào chị Hiền, em thấy chị hỏi giá cá lóc khô. Bên em có sẵn loại 1 nắng và khô kỹ. Chị lấy sỉ hay lẻ ạ? Chị inbox em gửi bảng giá nhé. ' + OPT, spam: 3, note: 'ok' };
globalThis.fetch = async (url, o) => ({ ok: true, status: 200, json: async () => ({ choices: [{ message: { content: JSON.stringify(reply) }, finish_reason: 'stop' }] }) });
const brandAi = { code: 'hscl-01', ai: { nganh: 'Hải sản', dichvu: 'Hải sản khô, mực khô', khach: 'người kinh doanh' } };
const lead = { id: 'L1', name: 'Hien Chau Thi Thu', temp: 'warm', need: 'mua cá lóc khô', text: 'Giá', comment_id: '555', kind: 'comment', parent_text: 'Cá lóc khô sỉ 1 nắng', reply: 'Dạ anh/chị cần lấy sỉ hay lẻ ạ?' };
r = await C.genForLead(brandAi, lead);
check('AI: opt-out AI chép nguyên văn + thân tin "chị" → sửa thành "chị", đúng 1 lần', r.mode === 'ai' && (r.inbox.match(/bỏ qua tin này nhé/g) || []).length === 1 && /Nếu không tiện, chị cứ bỏ qua tin này nhé\.$/.test(r.inbox) && r.inbox.startsWith('Chào chị Hiền, em thấy chị hỏi giá'), r.inbox.slice(-70));
reply = { ...reply, inbox: 'Chào anh Nam, em thấy anh cần ghẹ đá cho nhà hàng. Bên em có sẵn hàng sỉ. Anh cho em xin số lượng nhé.' };
r = await C.genForLead(brandAi, lead);
check('AI: thiếu opt-out + thân tin "anh" → nối "anh cứ bỏ qua"', /nhé\. Nếu không tiện, anh cứ bỏ qua tin này nhé\.$/.test(r.inbox), r.inbox.slice(-75));
reply = { ...reply, inbox: 'Chào anh/chị, em bên Cường Linh. Anh/chị cho em xin số lượng nhé. ' + OPT };
r = await C.genForLead(brandAi, lead);
check('AI: thân tin "anh/chị" → giữ nguyên opt-out', r.inbox.endsWith(OPT) && (r.inbox.match(/bỏ qua tin này nhé/g) || []).length === 1);
/* outreach.js wrapper */
const O = await import(here('outreach.js'));
let p = O.payloadOf({ post_url: 'https://www.facebook.com/groups/111/posts/222/?mibextid=abc', comment_id: '333' });
check('commentUrlOf: post_url có sẵn ? → &comment_id', p.comment_url === 'https://www.facebook.com/groups/111/posts/222/?mibextid=abc&comment_id=333', p.comment_url);
p = O.payloadOf({ post_url: 'https://www.facebook.com/groups/111/posts/222/', comment_id: '333' });
check('commentUrlOf: post_url sạch → ?comment_id (như cũ)', p.comment_url === 'https://www.facebook.com/groups/111/posts/222/?comment_id=333', p.comment_url);
p = O.payloadOf({ post_url: 'https://www.facebook.com/groups/111/posts/222/?x=1', comment_url: 'https://www.facebook.com/groups/111/posts/222/?comment_id=444' });
check('commentUrlOf: có comment_url sẵn → giữ', p.comment_url === 'https://www.facebook.com/groups/111/posts/222/?comment_id=444' && p.comment_id === '444');
p = O.payloadOf({ post_url: 'https://www.facebook.com/groups/1/posts/2/' });
check('lead-bài không cid → payload post như cũ', p.kind === 'post');
check('outreach.js: outreachTick còn export', typeof O.outreachTick === 'function');
/* config.js */
process.env.BROWSER_SVC_URL = 'http://svc.test:8080'; process.env.BROWSER_SVC_SECRET = 's3';
const K = await import(here('lib/config.js')+'?a');
check('config.js: CFG.BROWSER_SVC_URL/SECRET map từ env', K.CFG.BROWSER_SVC_URL === 'http://svc.test:8080' && K.CFG.BROWSER_SVC_SECRET === 's3' && K.CFG.SCANNED_TTL_DAYS === 3);
console.log(`\n${pass}/${total} PASS`); if (pass !== total) process.exit(1);
