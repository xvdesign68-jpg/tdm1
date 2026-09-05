// Harness DOM THẬT (Chromium): comment-lead tym + trả lời khi FB vẽ ô trả lời NGOÀI article; waitForContent; pageLang; runFunnel tích hợp
import fs from 'fs';
import { chromium } from 'playwright-core';
import { findCommentEl, tymComment, replyComment, verifyComment, waitForContent, pageLang, actionLabel, runFunnel, CFG, __store as store } from './_w.mjs';
CFG.actionDelayMs = 1; CFG.graphql = {};
const exe = fs.readdirSync('/opt/pw-browsers').filter(d => /chrom/.test(d)).map(d => '/opt/pw-browsers/' + d).flatMap(d => [d + '/chrome-linux/chrome', d + '/chrome-linux/headless_shell', d + '/chrome'].filter(fs.existsSync))[0];
const browser = await chromium.launch({ executablePath: exe, headless: true });
const ctx = await browser.newContext();
let HTML = '';
await ctx.route('**/*', r => r.fulfill({ status: 200, contentType: 'text/html; charset=utf-8', body: HTML }));
let pass = 0, total = 0;
const check = (name, ok, extra) => { total++; if (ok) pass++; console.log(ok ? 'PASS' : 'FAIL', name, extra || ''); };
const BASE = 'https://www.facebook.com/groups/1/posts/2/';
const CURL = BASE + '?comment_id=555';
// mode: outside | inside | none | postlabel | en | nolabel ; lang: vi|en
function mock(mode, lang) {
  const L = lang === 'en' ? { like: 'Like', reply: 'Reply', liked: 'Liked', main: 'Comment as Test', rbox: 'Reply as Test' } : { like: 'Thích', reply: 'Phản hồi', liked: 'Đã thích', main: 'Bình luận dưới tên Test', rbox: 'Trả lời dưới tên Test' };
  const art = (id, href, txt) => `<li><div role="article" id="${id}"><a href="${href}">·</a><span>${txt}</span><div role="button">${L.like}</div><div role="button">${L.reply}</div></div></li>`;
  return `<html lang="${lang || 'vi'}"><body><div role="article" id="postArt"><span>Bài viết gốc</span><div role="button" aria-label="${L.like}">${L.like}</div></div><ul>
${art('c1', BASE + '?comment_id=5551', 'Comment A')}
${art('c2', BASE + '?comment_id=555', 'Comment Target')}
${art('c3', BASE + '?comment_id=5552&reply_comment_id=555', 'Comment C')}
</ul><form><div role="textbox" contenteditable="true" aria-label="${L.main}" id="mainbox" style="min-height:20px;border:1px solid #ccc"></div></form>
<script>
window.MODE=${JSON.stringify(mode)};
document.querySelectorAll('ul div[role=article]').forEach(a=>{
  const btns=[...a.querySelectorAll('div[role=button]')];
  const like=btns.find(b=>b.textContent.trim()==='${L.like}'); like.addEventListener('click',()=>{ like.textContent='${L.liked}'; });
  const rb=btns.find(b=>b.textContent.trim()==='${L.reply}');
  rb.addEventListener('click',()=>{
    if(window.MODE==='none') return;
    const box=document.createElement('div'); box.setAttribute('role','textbox'); box.contentEditable='true'; box.style.minHeight='20px'; box.style.border='1px solid #999';
    if(window.MODE==='postlabel') box.setAttribute('aria-label','${L.main}'); else if(window.MODE!=='nolabel') box.setAttribute('aria-label','${L.rbox}');
    box.className='replybox';
    box.addEventListener('keydown',e=>{ if(e.key==='Enter'&&!e.shiftKey){ e.preventDefault(); const r=document.createElement('div'); r.setAttribute('role','article'); r.className='reply'; r.setAttribute('data-parent',a.id); r.textContent=box.textContent; box.remove(); a.parentElement.appendChild(r);} });
    if(window.MODE==='inside') a.appendChild(box); else a.parentElement.appendChild(box);
    box.focus();
  });
});
const mb=document.getElementById('mainbox'); mb.addEventListener('keydown',e=>{ if(e.key==='Enter'&&!e.shiftKey){ e.preventDefault(); const r=document.createElement('div'); r.className='toplevel'; r.textContent=mb.textContent; document.body.appendChild(r); mb.textContent=''; } });
</script></body></html>`;
}
async function state(page) {
  return page.evaluate(() => ({ replies: [...document.querySelectorAll('.reply')].map(r => ({ parent: r.getAttribute('data-parent'), text: r.textContent })), toplevel: [...document.querySelectorAll('.toplevel')].map(r => r.textContent), main: document.getElementById('mainbox').textContent, liked: [...document.querySelectorAll('ul div[role=article]')].filter(a => a.querySelector('div[role=button]')).map(a => a.id + ':' + a.querySelector('div[role=button]').textContent) }));
}
async function run(name, mode, lang, msg, expectOk) {
  HTML = mock(mode, lang);
  const page = await ctx.newPage();
  let err = null;
  try {
    const el = await findCommentEl(page, CURL, '555');
    await tymComment(page, el);
    await replyComment(page, el, msg);
  } catch (e) { err = e; }
  const st = await state(page);
  const okReply = st.replies.length === 1 && st.replies[0].parent === 'c2' && st.replies[0].text.includes(msg.split('\n').pop());
  const clean = st.toplevel.length === 0 && st.main === '';
  if (expectOk) check(name, !err && okReply && clean && st.liked.includes('c2:' + (lang === 'en' ? 'Liked' : 'Đã thích')), err ? String(err.message) : JSON.stringify(st));
  else check(name, !!err && st.replies.length === 0 && clean, err ? ('throw: ' + err.message.slice(0, 90)) : JSON.stringify(st));
  await page.close();
}
await run('ô trả lời NGOÀI article (sibling sau, nhãn "Trả lời dưới tên") → trả lời đúng comment, ô bài không đụng', 'outside', 'vi', 'Dạ chào chị, bên em có hàng sẵn ạ.', true);
await run('ô trả lời TRONG article → vẫn OK', 'inside', 'vi', 'Chào anh ạ', true);
await run('tin nhiều dòng → Shift+Enter, chỉ Enter cuối mới gửi', 'outside', 'vi', 'Dòng một\nDòng hai kết', true);
await run('giao diện English (Like/Reply/"Reply as") → OK', 'outside', 'en', 'Hello there', true);
await run('bấm Phản hồi KHÔNG ra ô nào → throw, không gõ đâu cả', 'none', 'vi', 'không được gõ', false);
await run('ô mới xuất hiện nhưng là nhãn "Bình luận dưới tên" (ô bài) → từ chối, throw', 'postlabel', 'vi', 'không được gõ', false);
await run('ô mới KHÔNG nhãn nhưng là ô mới duy nhất → chấp nhận', 'nolabel', 'vi', 'Ô không nhãn', true);

// comment_id không khớp (prefix/reply_comment_id) → findCommentEl throw
{ HTML = mock('outside', 'vi'); const page = await ctx.newPage(); let err = null; try { await findCommentEl(page, BASE + '?comment_id=55', '55'); } catch (e) { err = e; }
  check('comment_id=55 (prefix của 555/5551) → không định vị → throw (không skip vì bài có nhưng cid không: đây là skip có chủ ý)', !!err && !!err.skip === true, err ? err.message.slice(0, 100) : 'no err'); await page.close(); }
// waitForContent: nội dung không hiển thị → skip
{ HTML = '<html lang="vi"><body><div role="dialog"><h2>Nội dung này hiện không hiển thị</h2><p>Lỗi này thường do chủ sở hữu chỉ chia sẻ nội dung với một nhóm nhỏ...</p></div></body></html>';
  const page = await ctx.newPage(); await page.goto(BASE, { waitUntil: 'domcontentloaded' }); let err = null; const t0 = Date.now(); try { await waitForContent(page, { waitMs: 5000 }); } catch (e) { err = e; }
  check('"Nội dung này hiện không hiển thị" → skip nhanh (<3 s)', !!(err && err.skip) && Date.now() - t0 < 3000, err ? err.message.slice(0, 80) + ' ' + (Date.now() - t0) + 'ms' : 'no err'); await page.close(); }
// waitForContent: bài vẽ chậm 1200ms → chờ được, không skip
{ HTML = '<html lang="vi"><body><div id="x">Đang tải…</div><script>setTimeout(()=>{const a=document.createElement("div");a.setAttribute("role","article");a.textContent="bài";document.body.appendChild(a);},1200)</script></body></html>';
  const page = await ctx.newPage(); await page.goto(BASE, { waitUntil: 'domcontentloaded' }); const t0 = Date.now(); const r = await waitForContent(page, { waitMs: 5000 });
  check('bài vẽ chậm 1,2 s → waitForContent chờ tới khi có article (true)', r === true && Date.now() - t0 >= 1000 && Date.now() - t0 < 4000, (Date.now() - t0) + 'ms'); await page.close(); }
// waitForContent: nhóm riêng tư (Tham gia nhóm, không article) → skip sau waitMs
{ HTML = '<html lang="vi"><body><h1>Nhóm riêng tư</h1><div role="button">Tham gia nhóm</div><p>Chỉ thành viên mới xem được bài viết</p></body></html>';
  const page = await ctx.newPage(); await page.goto(BASE, { waitUntil: 'domcontentloaded' }); let err = null; try { await waitForContent(page, { waitMs: 1500 }); } catch (e) { err = e; }
  check('nhóm riêng tư (Tham gia nhóm, 0 bài) → skip', !!(err && err.skip) && /riêng tư/.test(err.message), err ? err.message.slice(0, 80) : 'no err'); await page.close(); }
// waitForContent: trang không rõ (không article, không text đặc biệt) → false, KHÔNG throw
{ HTML = '<html lang="vi"><body><p>xin chào</p></body></html>';
  const page = await ctx.newPage(); await page.goto(BASE, { waitUntil: 'domcontentloaded' }); let err = null, r = null; try { r = await waitForContent(page, { waitMs: 1200 }); } catch (e) { err = e; }
  check('trang không rõ → trả false, không throw (fail-closed về đường cũ)', !err && r === false); await page.close(); }
// pageLang
{ HTML = '<html lang="en"><body>x</body></html>'; const page = await ctx.newPage(); await page.goto('https://www.facebook.com/', { waitUntil: 'domcontentloaded' }); check('pageLang đọc <html lang="en">', (await pageLang(page)) === 'en'); await page.close(); }
{ HTML = '<html lang="vi"><body>x</body></html>'; const page = await ctx.newPage(); await page.goto('https://www.facebook.com/', { waitUntil: 'domcontentloaded' }); check('pageLang đọc <html lang="vi">', (await pageLang(page)) === 'vi'); await page.close(); }
{ HTML = '<html><body>x</body></html>'; const page = await ctx.newPage(); await page.goto('https://www.facebook.com/', { waitUntil: 'domcontentloaded' }); check('không có lang → rỗng (không chặn)', (await pageLang(page)) === ''); await page.close(); }
// actionLabel funnel
check('actionLabel(funnel) không còn "Inbox mở đầu"', actionLabel('funnel', {}) === 'Phễu tự động cho Lead' && actionLabel('inbox', {}) === 'Inbox mở đầu cho Lead');

// runFunnel tích hợp: comment-lead react+comment trên DOM thật (Firestore stub)
{ HTML = mock('outside', 'vi'); store.clear(); store.set('outreach_threads/CL1', { pid: 'k1', step: 'funnel', active: true });
  const page = await ctx.newPage();
  const t = { taskId: 'CL1__funnel', leadId: 'CL1', pid: 'k1', brandCode: 'hscl-01', brandName: 'HSCL', name: 'Đỗ Minh Hương', temp: 'warm', score: 70, action: 'funnel',
    payload: { kind: 'comment', steps: ['react', 'comment'], post_url: BASE, comment_url: CURL, comment_id: '555', comment_msg: 'Dạ chị ơi bên em có sẵn ạ.', reaction: 'LOVE' } };
  let err = null; try { await runFunnel(page, t); } catch (e) { err = e; }
  const th = store.get('outreach_threads/CL1'); const st = await state(page);
  const logs = [...store.entries()].filter(([k]) => k.startsWith('outreach_log/')).map(([, v]) => v);
  check('runFunnel comment-lead: thread done + doneSteps react,comment', !err && th.step === 'done' && th.active === false && th.doneSteps.includes('react') && th.doneSteps.includes('comment'), err ? err.message : JSON.stringify({ step: th.step, ds: th.doneSteps }));
  check('runFunnel: reply đúng comment c2, ô bài sạch, log 2 dòng done đúng nhãn', st.replies.length === 1 && st.replies[0].parent === 'c2' && st.toplevel.length === 0 && logs.filter(l => l.status === 'done').length === 2 && logs.some(l => /Thả cảm xúc .* vào bình luận/.test(l.action)) && logs.some(l => l.action === 'Trả lời bình luận của Lead'), logs.map(l => l.action + '|' + l.status).join(' ; '));
  await page.close(); }
// runFunnel: bài không hiển thị → throw skip, không log fail, thread chưa đổi
{ HTML = '<html lang="vi"><body><div role="dialog"><h2>Nội dung này hiện không hiển thị</h2></div></body></html>'; store.clear(); store.set('outreach_threads/CL2', { pid: 'k1', step: 'funnel', active: true });
  const page = await ctx.newPage();
  const t = { taskId: 'CL2__funnel', leadId: 'CL2', pid: 'k1', brandCode: 'hscl-01', brandName: 'HSCL', name: 'X', temp: 'warm', score: 70, action: 'funnel', payload: { steps: ['react', 'comment'], post_url: BASE, comment_msg: 'x', reaction: 'LOVE' } };
  let err = null; try { await runFunnel(page, t); } catch (e) { err = e; }
  const logs = [...store.entries()].filter(([k]) => k.startsWith('outreach_log/')).map(([, v]) => v);
  check('runFunnel bài-lead không hiển thị → ném e.skip, không log fail, thread còn active', !!(err && err.skip) && logs.length === 0 && store.get('outreach_threads/CL2').active === true, err ? err.message.slice(0, 80) : 'no err');
  await page.close(); }
await browser.close();
console.log(`${pass}/${total}`);
process.exit(pass === total ? 0 : 1);
