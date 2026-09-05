cat > /tmp/c30.cjs <<'EOF'
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
EOF
cat > /tmp/run30.sh <<'EOF'
set -e
cd ~/firebase-s13/functions
TS=$(date +%Y%m%d-%H%M%S)
if grep -q "LENH #30" content.js; then echo "content.js đã có LENH #30 (giữ backup cũ)"; else cp content.js "content.js.bak-$TS"; echo "backup content.js.bak-$TS"; fi
node /tmp/c30.cjs content.js
node --check content.js && echo "SYNTAX OK"
set -a; . ./.env; set +a
node --input-type=module -e "const m = await import('./content.js'); console.log('IMPORT OK · genForLead =', typeof m.genForLead, '· genContent =', typeof m.genContent)"
echo "== test thật genForLead: 1 lead BÌNH LUẬN + 1 lead BÀI mới nhất của hscl-01 =="
cat > _l30_test.mjs <<'JS'
import admin from 'firebase-admin'; if (admin.apps.length === 0) admin.initializeApp();
const db = admin.firestore();
const { genForLead } = await import('./content.js');
const CTA_RE = /inbox|\bib\b|nhắn|liên hệ|để lại|báo giá|bảng giá|gửi giá|tư vấn|số lượng|\bsỉ\b|\blẻ\b|cho (?:mình|em|bên mình|shop) (?:xin|biết|hỏi)/i;
const b = Object.assign({ code: 'hscl-01' }, (await db.doc('brands/hscl-01').get()).data() || {});
console.log('brand.content:', JSON.stringify(b.content || null), '| có Hồ sơ AI:', !!(b.ai && (b.ai.dichvu || b.ai.nganh)));
const s = await db.collection('leads').where('brand', '==', 'hscl-01').orderBy('detected_at', 'desc').limit(80).get();
const all = s.docs.map(d => Object.assign({ id: d.id }, d.data()));
const isC = l => !!(l.comment_id || l.comment_url || l.kind === 'comment');
const picks = [['LEAD BÌNH LUẬN', all.find(isC)], ['LEAD BÀI', all.find(l => !isC(l))]];
for (const [label, l] of picks) {
  if (!l) { console.log('--', label, ': không có trong 80 lead mới'); continue; }
  const tf = {}; for (const k of ['kind', 'text', 'comment_text', 'commentText', 'parent_text', 'parentText', 'post_text', 'need', 'intent', 'service', 'reply', 'temp', 'name']) { if (l[k] != null && l[k] !== '') tf[k] = typeof l[k] === 'string' ? l[k].slice(0, 120) : l[k]; }
  console.log('--', label, l.id, '| field:', Object.keys(l).filter(k => !/phone|email/.test(k)).sort().join(','));
  console.log('   text-ish:', JSON.stringify(tf));
  const t0 = Date.now(); const g = await genForLead(b, l);
  console.log('   mode', g.mode, '| model', g.model || '?', '| ' + Math.round((Date.now() - t0) / 1000) + ' s', '| spam', g.spam, '| note', g.note || '—');
  console.log('   COMMENT (' + g.comment.length + ') ' + (CTA_RE.test(g.comment) ? 'CÓ CTA ✓' : 'THIẾU CTA ✗') + ':', g.comment);
  console.log('   INBOX (' + g.inbox.length + '):', g.inbox);
}
JS
node _l30_test.mjs; rm -f _l30_test.mjs
echo "== deploy =="
cd ~/firebase-s13 && firebase deploy --only functions:outreachTick,functions:genContent --force
echo "== xong == exit=$?"
EOF
bash /tmp/run30.sh
