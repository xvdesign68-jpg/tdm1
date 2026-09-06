// LENH #32 (06/09/2026) — patch 3 file trong ~/firebase-s13/functions (chạy: node /tmp/c32.cjs từ thư mục functions).
//  (1) content.js : dòng opt-out khớp cách xưng hô đã dùng trong tin (anh/chị → anh | chị | bạn) — 3 chỗ nối opt-out + helper withOptout/fitOptout/pronounOf
//  (2) outreach.js: commentUrlOf — post_url đã có "?" → dấu "?" thứ 2+ đổi thành "&" (wrapper, đổi tên bản gốc → commentUrlOf0)
//  (3) lib/config.js: map BROWSER_SVC_URL / BROWSER_SVC_SECRET từ .env (scraper.fetchPostsAuth đọc CFG.* nhưng config.js chưa map)
//  Nguyên tắc: tìm ĐỦ mốc của cả 3 file trước, thiếu mốc nào → KHÔNG ghi file nào (fail-closed); đã có marker → bỏ qua file đó (idempotent).
const fs = require('fs');
const MARK = 'LENH #32';
const out = {}; const notes = [];
function need(cond, msg) { if (!cond) { console.error('KHONG TIM THAY MOC: ' + msg); process.exit(1); } }
function countOf(s, needle) { return s.split(needle).length - 1; }

/* ---------- (1) content.js ---------- */
{
  const f = 'content.js'; let s = fs.readFileSync(f, 'utf8');
  if (s.includes(MARK)) notes.push(f + ': đã có marker → bỏ qua');
  else {
    const A1 = "if (c.optout && !inbox.includes(c.optout.slice(0, 15))) inbox = joinSent(inbox, c.optout);";
    const A2 = "if (c.optout && !inbox.includes(c.optout.slice(0, 15))) inbox = joinSent(clean(inbox, 560), c.optout);";
    const A3 = /^function contentOf\(brand\) \{/m;
    need(countOf(s, A1) === 2, f + ' mốc A1 (templateGen + replyGen nối opt-out) phải đúng 2 chỗ, thấy ' + countOf(s, A1));
    need(countOf(s, A2) === 1, f + ' mốc A2 (AI nối opt-out) phải đúng 1 chỗ, thấy ' + countOf(s, A2));
    need(A3.test(s), f + ' mốc A3 (function contentOf)');
    const A4 = "  return joinSent(body, cta);\n}"; // ensureCta: CTA mặc định cũng dùng "anh/chị" → khớp xưng hô theo thân bình luận
    need(countOf(s, A4) === 1, f + ' mốc A4 (ensureCta return) phải đúng 1 chỗ, thấy ' + countOf(s, A4));
    const HELPER = `/* ${MARK} (06/09/2026): dòng opt-out khớp CÁCH XƯNG HÔ đã dùng trong tin — "anh/chị" → "chị" | "anh" | "bạn". Tin dùng lẫn/không rõ → giữ nguyên "anh/chị". */
function pronounOf(body) {
  const b = ' ' + String(body || '').toLowerCase() + ' ';
  const chi = /(^|[^\\p{L}\\/])chị(?=[^\\p{L}\\/]|$)/u.test(b);   // "chị" đứng riêng (không phải "anh/chị")
  const anh = /(^|[^\\p{L}\\/])anh(?=[^\\p{L}\\/]|$)/u.test(b);   // "anh" đứng riêng (không phải "anh/chị")
  const ban = /(^|[^\\p{L}])bạn(?=[^\\p{L}]|$)/u.test(b);
  if (chi && !anh) return 'chị';
  if (anh && !chi) return 'anh';
  if (!anh && !chi && ban) return 'bạn';
  return '';
}
function fitOptout(optout, body) {
  const p = pronounOf(body); if (!p || !/anh\\s*\\/\\s*chị/i.test(optout)) return optout;
  return optout.replace(/anh\\s*\\/\\s*chị/gi, m => (m[0] === 'A' ? p.charAt(0).toUpperCase() + p.slice(1) : p));
}
function withOptout(inbox, c, maxBefore) { // nối opt-out (nếu chưa có) + sửa xưng hô ngay tại chỗ; thân tin giữ nguyên
  inbox = String(inbox || ''); if (!c || !c.optout) return inbox;
  const i = inbox.indexOf(c.optout.slice(0, 15));
  if (i < 0) { const body = maxBefore ? clean(inbox, maxBefore) : inbox; return joinSent(body, fitOptout(c.optout, body)); }
  const j = inbox.indexOf(c.optout, i); if (j < 0) return inbox; // AI đã sửa câu opt-out theo ý nó → không đụng
  const body = inbox.slice(0, j) + inbox.slice(j + c.optout.length);
  return inbox.slice(0, j) + fitOptout(c.optout, body) + inbox.slice(j + c.optout.length);
}
`;
    s = s.split(A1).join(`inbox = withOptout(inbox, c); /* ${MARK} */`);
    s = s.replace(A2, () => `inbox = withOptout(inbox, c, 560); /* ${MARK} */`);
    s = s.replace(A3, () => HELPER + 'function contentOf(brand) {');
    s = s.replace(A4, () => `  return joinSent(body, fitOptout(cta, body)); /* ${MARK}: CTA khớp xưng hô */\n}`);
    out[f] = s; notes.push(f + ': A1×2 + A2 + A4 (ensureCta) + helper OK');
  }
}

/* ---------- (2) outreach.js ---------- */
{
  const f = 'outreach.js'; let s = fs.readFileSync(f, 'utf8');
  if (s.includes(MARK)) notes.push(f + ': đã có marker → bỏ qua');
  else {
    const lines = s.split('\n');
    const reFn = /^(async\s+)?function\s+commentUrlOf\s*\(/;            // khai báo TOP-LEVEL (không thụt đầu dòng)
    const reVar = /^(const|let|var)\s+commentUrlOf\s*=/;
    const hits = []; lines.forEach((ln, i) => { if (reFn.test(ln) || reVar.test(ln)) hits.push(i); });
    const indented = lines.filter(ln => /^\s+(async\s+)?function\s+commentUrlOf\s*\(|^\s+(const|let|var)\s+commentUrlOf\s*=/.test(ln)).length;
    need(hits.length === 1, f + ' khai báo top-level commentUrlOf phải đúng 1 chỗ (thấy ' + hits.length + (indented ? ', có ' + indented + ' khai báo THỤT ĐẦU DÒNG — không patch được kiểu lồng' : '') + ')');
    need(!/commentUrlOf0/.test(s), f + ' đã có commentUrlOf0 mà thiếu marker — kiểm tay');
    const i = hits[0];
    lines[i] = lines[i].replace(/commentUrlOf(\s*[(=])/, 'commentUrlOf0$1');
    const WRAP = `
/* ${MARK} (06/09/2026): post_url có sẵn "?" (vd ?mibextid=…) → URL bình luận dựng ra bị 2 dấu "?" → worker không định vị được comment (rớt lead-comment).
   Chuẩn hoá: dấu "?" thứ 2 trở đi → "&". Bản gốc đổi tên commentUrlOf0, wrapper giữ đúng tên/chữ ký cũ. */
function commentUrlOf(lead, cid) {
  let u = commentUrlOf0(lead, cid);
  if (typeof u === 'string') { const q = u.indexOf('?'); if (q >= 0) u = u.slice(0, q + 1) + u.slice(q + 1).replace(/\\?/g, '&'); }
  return u;
}
`;
    s = lines.join('\n').replace(/\s*$/, '\n') + WRAP;
    out[f] = s; notes.push(f + ': commentUrlOf → commentUrlOf0 (dòng ' + (i + 1) + ') + wrapper cuối file');
  }
}

/* ---------- (3) lib/config.js ---------- */
{
  const f = 'lib/config.js'; let s = fs.readFileSync(f, 'utf8');
  if (/BROWSER_SVC_URL\s*:/.test(s)) notes.push(f + ': đã có BROWSER_SVC_URL → bỏ qua');
  else {
    const re = /^([ \t]*)SCANNED_TTL_DAYS:\s*num\(env\.SCANNED_TTL_DAYS,[^\n]*\n/m;
    const m = s.match(re); need(m, f + ' mốc SCANNED_TTL_DAYS');
    need(countOf(s, 'SCANNED_TTL_DAYS:') === 1, f + ' SCANNED_TTL_DAYS phải đúng 1 chỗ');
    const ind = m[1];
    const ADD = `${ind}// ${MARK} (06/09/2026): quét bằng nick qua browser service (scraper.fetchPostsAuth đọc CFG.BROWSER_SVC_URL/SECRET nhưng config.js chưa map → luôn "Chưa cấu hình"). Địa chỉ CHỈ ở .env.\n${ind}BROWSER_SVC_URL: env.BROWSER_SVC_URL || '',\n${ind}BROWSER_SVC_SECRET: env.BROWSER_SVC_SECRET || '',\n`;
    s = s.replace(re, () => m[0] + ADD);
    out[f] = s; notes.push(f + ': + BROWSER_SVC_URL/SECRET sau SCANNED_TTL_DAYS');
  }
}

for (const f of Object.keys(out)) fs.writeFileSync(f, out[f]);
console.log('PATCH OK ' + MARK + ' — ' + notes.join(' | '));
