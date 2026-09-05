/* Harness LỆNH #31b — chạy trên bản đã vá trong try/ */
import fs from 'node:fs';
let pass = 0, fail = 0;
const ok = (c, m) => { if (c) { pass++; console.log('  ✓', m); } else { fail++; console.log('  ✗', m); } };

/* 1) scorer.js: mock fetch → kiểm prompt + normRole + gate */
let lastBody = null, reply = {};
globalThis.fetch = async (url, opt) => { lastBody = JSON.parse(opt.body); return { ok: true, json: async () => ({ choices: [{ message: { content: JSON.stringify(reply) } }], usage: { prompt_tokens: 1, completion_tokens: 1 } }) }; };
const sc = await import('./try/lib/scorer.js');
console.log('-- scorer.js');
ok(typeof sc.normRole === 'function', 'export normRole');
ok(sc.normRole('Seller') === 'seller' && sc.normRole('competitor') === 'seller' && sc.normRole('người bán') === 'seller' && sc.normRole('recruiter') === 'seller', 'normRole → seller (đồng nghĩa)');
ok(sc.normRole('poster_self') === 'poster_self' && sc.normRole('Post Author') === 'poster_self' && sc.normRole('chủ bài') === 'poster_self', 'normRole → poster_self');
ok(sc.normRole('buyer') === 'buyer' && sc.normRole('khách hàng') === 'buyer' && sc.normRole('') === '' && sc.normRole(undefined) === '' && sc.normRole('zzz') === 'other', 'normRole buyer/rỗng/lạ');
const post = { kind: 'comment', text: 'Ib em', author: 'Yến Nhi Lifood', parent_author: 'Ẩn danh', parent_text: 'Mình cần tìm nguồn hải sản đông lạnh rẻ', user_url: '' };
reply = { is_real_lead: true, hotness: 80, intent: 'x', industry: 'hs', service: 's', reply: 'r', role: 'SELLER', role_reason: 'chào hàng dưới bài người mua' };
const ai = await sc.scoreLead(post, { industry: 'hs' }, [], { nganh: 'hải sản' });
const sys = lastBody.messages[0].content, usr = lastBody.messages[1].content;
ok(/"role":"buyer\|seller\|poster_self\|other","role_reason":string/.test(sys), 'SYS JSON có role/role_reason');
ok(/CHỈ role="buyer" mới được is_real_lead=true/.test(sys) && /poster_self/.test(sys), 'SYS có quy tắc vai');
ok(/TÁC GIẢ BÀI GỐC: Ẩn danh/.test(usr) && /NGƯỜI BÌNH LUẬN: Yến Nhi Lifood/.test(usr) && /CÙNG MỘT NGƯỜI VỚI TÁC GIẢ BÀI GỐC\? không rõ/.test(usr), 'prompt bình luận: 2 danh tính + cờ (ẩn danh → không rõ)');
ok(ai.role === 'seller' && ai.role_reason.startsWith('chào hàng'), 'scoreLead chuẩn hoá role SELLER → seller');
const gate = a => { const r = String(a.role || '').toLowerCase().trim(), b = (r === 'seller' || r === 'poster_self'); return !!a.is_real_lead && !b && (a.hotness || 0) >= 40; };
ok(gate(ai) === false, 'gate index: seller dù is_real_lead=true → KHÔNG lead');
reply = { is_real_lead: true, hotness: 70, role: 'buyer' };
const ai2 = await sc.scoreLead({ kind: 'comment', text: 'Ib', author: 'Nguyễn Hải', parent_author: 'Mai Đỗ', parent_text: 'Sò gạo tàu về', self_comment: false }, { industry: '' }, [], null);
ok(/CÙNG MỘT NGƯỒI VỚI TÁC GIẢ BÀI GỐC\? KHÔNG \(tên khác nhau\)/.test(lastBody.messages[1].content.replace('NGƯỜI VỚI', 'NGƯỒI VỚI')) || /KHÔNG \(tên khác nhau\)/.test(lastBody.messages[1].content), 'cờ KHÔNG khi 2 tên thật khác nhau');
ok(gate(ai2) === true && ai2.role === 'buyer', 'buyer hợp lệ → lead');
reply = { is_real_lead: true, hotness: 76 };
const ai3 = await sc.scoreLead({ kind: 'comment', text: 'Em cần sz 10-12', author: 'Đỗ Minh Hương', parent_author: 'Đỗ Minh Hương', parent_text: 'Em cần mực trứng', self_comment: true }, { industry: '' }, [], null);
ok(/CÙNG MỘT NGƯỜI VỚI TÁC GIẢ BÀI GỐC\? CÓ — người bình luận CHÍNH LÀ tác giả bài gốc/.test(lastBody.messages[1].content), 'cờ CÓ khi self_comment');
ok(ai3.role === '' && gate(ai3) === true, 'AI không trả role → role rỗng, không chặn (tương thích cũ)');
const plain = await sc.scoreLead({ kind: 'post', text: 'Cần tìm nguồn mực' }, { industry: '' }, [], null);
ok(/^Bài: """Cần tìm nguồn mực"""$/m.test(lastBody.messages[1].content.split('\n').pop()), 'bài thường: prompt không đổi');
reply = { maybe: false };
await sc.prefilterLead(post, null);
ok(/maybe=false nếu người viết là NGƯỜI BÁN/.test(lastBody.messages[0].content), 'PRE_SYS có quy tắc người bán/chủ bài');

/* 2) index.js helper (eval từ file đã vá) */
console.log('-- index.js helper');
const idx = fs.readFileSync('./try/index.js', 'utf8');
const h0 = idx.indexOf('const __SL_ANON31'), h1 = idx.indexOf('function recordPost(x, fields)');
const helper = idx.slice(h0, h1);
const isSelf = new Function(helper + '\nreturn __slIsSelfComment31;')();
ok(isSelf({ author: 'Đỗ Minh Hương', parent_author: 'Do Minh Huong' }) === true, 'tên khớp bỏ dấu (Đ→d)');
ok(isSelf({ author: 'Vũ  Hồng Đức ', parent_author: 'vũ hồng đức' }) === true, 'tên khớp khác hoa/khoảng trắng');
ok(isSelf({ author: 'Ẩn danh', parent_author: 'Ẩn danh' }) === false, 'cả 2 Ẩn danh → KHÔNG tính');
ok(isSelf({ author: 'Người tham gia ẩn danh', parent_author: 'Người tham gia ẩn danh' }) === false, 'người tham gia ẩn danh → KHÔNG tính');
ok(isSelf({ author: 'Nguyễn Hải', parent_author: 'Mai Đỗ' }) === false, 'tên khác → false');
ok(isSelf({ author: 'A', parent_author: 'B', user_url: 'https://www.facebook.com/profile.php?id=100013727043931', parent_user_url: 'https://facebook.com/profile.php?id=100013727043931&sk=about' }) === true, 'profile id khớp → true');
ok(isSelf({ author: 'A', parent_author: 'B', user_url: 'https://www.facebook.com/Ng.April2704', parent_user_url: 'https://www.facebook.com/ng.april2704/' }) === true, 'username khớp (khác hoa) → true');
ok(isSelf({ author: 'A', parent_author: 'B', user_url: 'https://www.facebook.com/groups/123/user/456', parent_user_url: 'https://www.facebook.com/groups/123/user/789' }) === false, 'link groups → không lấy làm key');
ok(isSelf({ author: 'A', parent_author: 'B', user_url: '', parent_user_url: '' }) === false, 'không có gì → false');
ok(idx.includes("comment.self_comment = __slIsSelfComment31(comment)") && idx.includes("recordPost(x, { decision: 'self_comment' }); return;"), 'vòng comment gắn cờ + Pha 2 bỏ trước AI');
ok(idx.includes("role: __role, role_reason: String(ai.role_reason || '').slice(0, 160)"), 'lead doc ghi role/role_reason');
ok(/parentUserUrl: x\.post\.user_url/.test(idx) && /parentUserUrl: String\(c\.parentUserUrl/.test(idx) && /parentUserUrl: m\.parentUserUrl/.test(idx), 'ctx bài cha có parentUserUrl ở 3 chỗ (bài/sowMeta/gặt)');

/* 3) outreach.js roleBlockOf */
console.log('-- outreach.js gate');
const oa = fs.readFileSync('./try/outreach.js', 'utf8');
const o0 = oa.indexOf('const __SL_ANON31'), o1 = oa.indexOf('async function skipLeadRole');
const roleBlockOf = new Function(oa.slice(o0, o1) + '\nreturn roleBlockOf;')();
ok(/người bán\/đối thủ \(AI: chào hàng\)/.test(roleBlockOf({ role: 'seller', role_reason: 'chào hàng' })), 'role seller → chặn kèm lý do AI');
ok(roleBlockOf({ role: 'poster_self' }) === 'chính chủ bài tự bình luận', 'role poster_self → chặn');
ok(roleBlockOf({ kind: 'comment', name: 'Phạm Khánh Ly', parent_author: 'Pham Khanh Ly' }).startsWith('chính chủ bài'), 'lead cũ không role: tên khớp chủ bài → chặn');
ok(roleBlockOf({ kind: 'comment', name: 'Ẩn danh', parent_author: 'Ẩn danh' }) === '', 'ẩn danh không chặn');
ok(roleBlockOf({ kind: 'post', name: 'X', parent_author: 'X', role: 'buyer' }) === '', 'lead bài / buyer → không chặn');
ok(roleBlockOf({ kind: 'comment', name: 'Nguyễn Hải', parent_author: 'Mai Đỗ' }) === '', 'comment người khác không role → không chặn');
ok(oa.indexOf("if ((await tref.get()).exists) continue;") < oa.indexOf('roleBlockOf(lead); if (__rb)') && oa.indexOf('roleBlockOf(lead); if (__rb)') < oa.indexOf('if (!parsePost(lead.post_url).post_id) continue;'), 'gate đặt SAU kiểm thread tồn tại, TRƯỚC enqueue');

console.log(`\nKẾT QUẢ: ${pass} PASS / ${fail} FAIL`);
process.exit(fail ? 1 : 0);
