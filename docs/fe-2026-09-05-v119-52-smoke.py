import sys, io
p = sys.argv[1] + '/tools/smoke.js'; s = io.open(p, encoding='utf8').read()
anchor = "  (sf.n >= 2 && sf.warn >= 1) ? ok(`Tiếp cận: badge Safety Score nick (${sf.n}, ${sf.warn} cảnh báo)`) : fail('Safety badge sai: ' + JSON.stringify(sf));\n"
assert s.count(anchor) == 1, 'anchor smoke'
block = anchor + r"""  // ===== v119-52 (LỆNH #31): chip vai 🏪 người bán / 👤 chủ bài + bài gốc trong modal + nhãn "Bài đã quét" =====
  await page.evaluate(() => { const D = window.SL_DATA; const l = D.leads.find(x => !x.dropped && !x.lost && x.stage !== 'closed'); l.kind = 'comment'; l.parent_author = 'Nguyễn Chủ Bài'; l.parent_text = 'Mình cần tìm nguồn hải sản đông lạnh rẻ cho cửa hàng'; l.parent_url = 'https://facebook.com/groups/1/posts/2/'; l.role = 'seller'; l.role_reason = 'chào hàng dưới bài người mua'; D.scannedPosts = D.scannedPosts || []; D.scannedPosts.unshift({ author: 'Nguyễn Chủ Bài', text: 'Ib tôi', decision: 'self_comment', kind: 'comment', parent_author: 'Nguyễn Chủ Bài', parent_text: 'Tuyển NV live', post_url: 'https://facebook.com/groups/1/posts/3/?comment_id=9', parent_url: 'https://facebook.com/groups/1/posts/3/', comment_id: '9', createdAt: new Date() }); location.hash = 'feed'; window.SLApp.reload(D); });
  await page.waitForTimeout(500);
  const rc1 = await page.evaluate(() => { const c = document.querySelector('#feedList .lead-card .chip-role'); return c ? c.textContent.trim() : ''; });
  await page.click('#feedList .lead-card:has(.chip-role) [data-chatbox]'); await page.waitForTimeout(400);
  const rc2 = await page.evaluate(() => ({ show: document.getElementById('modalBg').classList.contains('show'), role: (document.querySelector('#modal .chip-role') || {}).textContent || '', cm: (document.querySelector('#modal .chip-warm') || {}).textContent || '', sum: (document.querySelector('#modal .ld-parent summary') || {}).textContent || '', body: (document.querySelector('#modal .ld-parent p') || {}).textContent || '' }));
  (rc1 === '🏪 Người bán' && rc2.show && /Người bán/.test(rc2.role) && /dưới bài của Nguyễn Chủ Bài/.test(rc2.cm) && /Bài gốc của Nguyễn Chủ Bài/.test(rc2.sum) && /hải sản đông lạnh/.test(rc2.body))
    ? ok('v119-52: thẻ + modal có chip 🏪 Người bán · "Từ bình luận · dưới bài của …" · khối Bài gốc (parent_text)') : fail('Chip vai/bài gốc sai: ' + JSON.stringify({ rc1, rc2 }));
  await page.keyboard.press('Escape'); await page.waitForTimeout(300);
  await page.evaluate(() => { location.hash = 'scanned'; window.SLApp.reload(window.SL_DATA); }); await page.waitForTimeout(600);
  const sc31 = await page.evaluate(() => ({ lbl: /Chủ bài tự bình luận · bỏ/.test(document.getElementById('view').textContent), err: 0 }));
  sc31.lbl ? ok('Bài đã quét: nhãn "Chủ bài tự bình luận · bỏ" cho decision self_comment') : fail('Bài đã quét thiếu nhãn self_comment');
"""
s = s.replace(anchor, block); io.open(p, 'w', encoding='utf8').write(s); print('smoke patched', p)
