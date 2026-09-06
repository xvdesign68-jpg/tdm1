# FE v119-55 / v120-esm-e (06/09/2026, đi cùng LỆNH #34 + worker 2026-09-06c): Content Studio — card "📈 Hiệu quả nội dung" (tỉ lệ khách phản hồi theo kiểu nội dung
# máy đã gửi, đọc leads.outreach.content do worker ghi) + mô tả modal theo cấu trúc mới (bình luận nhẹ dưới bài chào bán của người khác, inbox 2-3 câu kết bằng 1 câu hỏi).
# Dùng: python3 fe55.py <root> iife|esm  (áp giống nhau cho 2 cây; card chỉ dùng D/esc/oaIsDemo đã có trong 45 → không thêm import/export)
import sys, os
root, mode = sys.argv[1], sys.argv[2]
def patch(path, pairs):
    s = open(path, encoding='utf-8').read()
    for a, b in pairs:
        assert s.count(a) == 1, (path, a[:80])
        s = s.replace(a, b)
    open(path, 'w', encoding='utf-8').write(s)
CARD = r'''  /* v119-55 (LỆNH #34): 📈 Hiệu quả nội dung — tỉ lệ khách phản hồi theo KIỂU nội dung máy đã gửi. Worker 2026-09-06c ghi leads.outreach.content = meta
     (mode/kiểu bình luận/bài gốc/biến thể mở đầu/CTA) + inbox_at; phản hồi = máy phát hiện (outreach_replied / outreach.replied_at) hoặc sales chuyển "Đã phản hồi" trở đi.
     Tính trên lead đã nạp trên máy (cửa sổ realtime) — đủ cho vài trăm tin; mỗi dòng cần ≥30 tin mới đáng tin. */
  const CS_META_VI = {
    mode: ['Cách soạn', { ai: 'AI cá nhân hoá', template: 'Mẫu xoay vòng', reply: 'Gợi ý có sẵn (cách cũ)' }],
    parent: ['Bài gốc', { seller: 'Dưới bài chào bán của người khác', buyer: 'Dưới bài hỏi mua', other: 'Dưới bài khác', '': 'Lead là bài' }],
    style: ['Kiểu bình luận', { direct: 'Trực tiếp + CTA', soft: 'Nhẹ + CTA mềm' }],
    cta: ['CTA', { brand: 'CTA brand', def: 'CTA mặc định', cmp: 'Chỉ mời nhắn riêng (bài đối thủ)' }],
    variant: ['Mở đầu inbox (AI xoay)', { 0: 'Đồng cảm', 1: 'Câu hỏi ngắn', 2: 'Nhắc chi tiết bài', 3: 'Khen nhẹ', 4: 'Đi thẳng giá trị', 5: 'Kể tình huống', '-1': '(không xoay)' }]
  };
  function csEffData(code) {
    const all = (D.leads || []).filter(l => l.outreach && l.outreach.content && typeof l.outreach.content === 'object' && (oaIsDemo() || String(l.brand || '') === String(code)));
    const sent = all.filter(l => Array.isArray(l.outreach.steps) && l.outreach.steps.includes('inbox'));
    const rep = l => !!(l.outreach_replied || l.outreach.replied_at || ['responded', 'booked', 'closed'].includes(l.stage));
    const dims = Object.keys(CS_META_VI).map(dim => {
      const m = new Map();
      sent.forEach(l => { const raw = l.outreach.content[dim]; const k = String(raw == null ? '' : raw); const o = m.get(k) || { k, n: 0, r: 0 }; o.n++; if (rep(l)) o.r++; m.set(k, o); });
      return { dim, title: CS_META_VI[dim][0], rows: [...m.values()].sort((a, b) => (b.r / b.n) - (a.r / a.n) || b.n - a.n).map(x => ({ label: CS_META_VI[dim][1][x.k] || x.k || '—', n: x.n, r: x.r })) };
    });
    return { total: sent.length, replied: sent.filter(rep).length, dims, tagged: all.length };
  }
  function csEffHtml(code) {
    const e = csEffData(code); const pct = (r, n) => n ? Math.round(r * 100 / n) + '%' : '—';
    const multi = e.dims.filter(d => d.rows.length > 1);
    let body;
    if (!e.total) body = `<div class="muted" style="font-size:12px">Chưa có tin inbox nào mang dấu vết nội dung${e.tagged ? ' (đã có ' + e.tagged + ' lead gắn dấu, chưa tới bước inbox)' : ''}. Cần backend LỆNH #34 + worker 2026-09-06c; số liệu tự hiện khi máy gửi inbox.</div>`;
    else body = `<div class="cs-eff-sum">Đã inbox <b>${e.total}</b> · khách phản hồi <b>${e.replied}</b> (<b>${pct(e.replied, e.total)}</b>)</div>` + (multi.length
      ? multi.map(d => `<table class="cs-eff-t"><thead><tr><th>${esc(d.title)}</th><th class="n">Đã gửi</th><th class="n">Phản hồi</th><th class="n">Tỉ lệ</th></tr></thead><tbody>${d.rows.map(r => `<tr><td>${esc(r.label)}</td><td class="n">${r.n}</td><td class="n">${r.r}</td><td class="n"><b>${pct(r.r, r.n)}</b>${r.n < 30 ? ' <span class="muted">ít mẫu</span>' : ''}</td></tr>`).join('')}</tbody></table>`).join('')
      : `<div class="muted" style="font-size:12px">Mọi tin cùng một kiểu (${esc(e.dims.map(d => d.rows[0] ? d.rows[0].label : '').filter(Boolean).join(' · '))}) — chưa có gì để so sánh; AI xoay 6 kiểu mở đầu nên vài chục tin nữa sẽ có bảng.</div>`);
    return `<div class="cs-preview cs-eff" id="csEff"><div class="cf-k">📈 Hiệu quả nội dung <span class="muted" style="font-weight:400;font-size:11px">(lead đã nạp trên máy · phản hồi = máy phát hiện hoặc sales chuyển "Đã phản hồi" trở đi · mỗi dòng cần ≥30 tin mới đáng tin)</span></div>${body}</div>`;
  }
'''
p = os.path.join(root, 'src/app/45-outreach.js')
patch(p, [
  ("  function oaOpenContent(code) {\n", CARD + "  function oaOpenContent(code) {\n"),
  ('<div class="sub" style="margin-top:4px">AI soạn <b>bình luận</b> (công khai, mềm, gợi mở) và <b>inbox mở đầu</b> (cá nhân hoá, thuyết phục, có CTA) theo TỪNG bài của lead + hồ sơ brand dưới đây, tự xoay biến thể chống spam.</div></div>',
   '<div class="sub" style="margin-top:4px">AI soạn <b>bình luận</b> (trả lời đúng câu khách + CTA; đứng dưới <b>bài chào bán của người khác</b> thì tự chuyển kiểu nhẹ: không nêu brand/giá, chỉ mời nhắn riêng) và <b>inbox mở đầu</b> (2-3 câu, nhắc đúng chi tiết khách nêu, kết bằng 1 câu hỏi dễ trả lời) theo TỪNG bài của lead + hồ sơ brand dưới đây, tự xoay biến thể chống spam.</div></div>'),
  ('          <div id="csOut" class="cs-out" hidden></div>\n        </div>\n        <div style="display:flex;gap:10px;margin-top:18px;flex-wrap:wrap">',
   '          <div id="csOut" class="cs-out" hidden></div>\n        </div>\n        ${csEffHtml(code)}\n        <div style="display:flex;gap:10px;margin-top:18px;flex-wrap:wrap">'),
])
p = os.path.join(root, 'assets/css/app.css')
patch(p, [(".cs-aihint .btn { padding: 3px 9px; font-size: 11.5px; }\n",
  ".cs-aihint .btn { padding: 3px 9px; font-size: 11.5px; }\n/* v119-55: card Hiệu quả nội dung trong Content Studio */\n.cs-eff { margin-top: 12px; }\n.cs-eff .cf-k .muted { display: block; margin-top: 2px; }\n.cs-eff-sum { font-size: 13px; margin: 4px 0 8px; }\n.cs-eff-t { width: 100%; border-collapse: collapse; font-size: 12px; margin-top: 6px; background: #fff; border: 1px solid var(--hairline); border-radius: 8px; overflow: hidden; }\n.cs-eff-t th, .cs-eff-t td { padding: 5px 8px; border-bottom: 1px solid var(--hairline); text-align: left; }\n.cs-eff-t th { font-size: 11px; color: var(--ink-500); font-weight: 600; }\n.cs-eff-t .n { text-align: right; white-space: nowrap; }\n.cs-eff-t tr:last-child td { border-bottom: 0; }\n")])
p = os.path.join(root, 'tools/smoke.js')
patch(p, [("    (cs.intro && cs.save && cs.mode === 'ai') ? ok('Content Studio: modal hồ sơ brand + chế độ AI mặc định') : fail('Content Studio sai: ' + JSON.stringify(cs));\n    await page.evaluate(() => { const c = document.getElementById('csCancel'); if (c) c.click(); }); await page.waitForTimeout(200);\n",
  "    (cs.intro && cs.save && cs.mode === 'ai') ? ok('Content Studio: modal hồ sơ brand + chế độ AI mặc định') : fail('Content Studio sai: ' + JSON.stringify(cs));\n    /* v119-55: card Hiệu quả nội dung — rỗng khi chưa có dấu vết; bơm 3 lead có outreach.content (2 phản hồi) → tổng + bảng theo kiểu; trả lead về như cũ */\n    const eff0 = await page.evaluate(() => { const e = document.getElementById('csEff'); return e ? e.textContent : ''; });\n    await page.evaluate(() => { const c = document.getElementById('csCancel'); if (c) c.click(); }); await page.waitForTimeout(200);\n    await page.evaluate(() => { const L = window.SL_DATA.leads; const mk = (i, parent, rep) => { L[i].__bak = L[i].outreach; L[i].outreach = { steps: ['react', 'comment', 'inbox'], last: 'inbox', content: { v: 34, mode: 'ai', style: 'direct', parent, variant: i % 6, cta: parent === 'seller' ? 'cmp' : 'brand' }, replied_at: rep ? Date.now() : null }; }; mk(0, 'seller', true); mk(1, '', false); mk(2, 'buyer', true); });\n    await page.click('button[data-oa-content]'); await page.waitForTimeout(300);\n    const eff1 = await page.evaluate(() => { const e = document.getElementById('csEff'); return e ? { sum: (e.querySelector('.cs-eff-sum') || {}).textContent || '', rows: e.querySelectorAll('.cs-eff-t tbody tr').length } : null; });\n    await page.evaluate(() => { const c = document.getElementById('csCancel'); if (c) c.click(); [0, 1, 2].forEach(i => { const l = window.SL_DATA.leads[i]; if (l.__bak === undefined) delete l.outreach; else l.outreach = l.__bak; delete l.__bak; }); }); await page.waitForTimeout(200);\n    (/Chưa có tin inbox/.test(eff0) && eff1 && /Đã inbox 3/.test(eff1.sum) && /phản hồi 2/.test(eff1.sum) && eff1.rows >= 4) ? ok('v119-55: card Hiệu quả nội dung (rỗng → 3 tin/2 phản hồi, bảng theo bài gốc/CTA/biến thể)') : fail('v119-55 card hiệu quả sai: ' + JSON.stringify({ eff0: String(eff0).slice(0, 60), eff1 }));\n")])
print('FE55 OK', mode)
