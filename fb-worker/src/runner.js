'use strict';
/* runner.js — điều phối 1 thao tác trọn vẹn:
   van an toàn → bật profile AdsPower → Puppeteer bám vào → làm → tắt profile → ghi nhận.
   Dùng chung cho test.js (chạy tay) và worker.js (đọc hàng đợi). */
const adspower = require('./adspower');
const fb = require('./fb');
const safety = require('./safety');

/**
 * @param {object} task
 * @param {string} task.profileId  user_id của profile trong AdsPower (nick sẽ hành động)
 * @param {'react'|'comment'|'inbox'|'open'} task.action
 * @param {string} [task.target]   URL bài viết (react/comment) hoặc uid/url người nhận (inbox)
 * @param {string} [task.text]     nội dung (comment/inbox)
 * @param {string} [task.reaction] like|love|care|haha|wow|sad|angry (react)
 * @param {boolean} [task.dryRun]  mở & tìm phần tử nhưng KHÔNG gửi thật
 * @param {boolean} [task.keepOpen] giữ profile mở sau khi xong (mặc định tắt)
 */
async function executeAction(task, log = console) {
  const { profileId, action } = task;
  if (!profileId) return { ok: false, detail: 'thiếu profileId (user_id AdsPower)' };

  // 1) Van an toàn (bỏ qua với open/list)
  if (['react', 'comment', 'inbox'].includes(action)) {
    const gate = safety.check(profileId, action);
    if (!gate.ok) return { ok: false, skipped: true, detail: `van an toàn chặn: ${gate.reason}` };
  }

  // 2) Bật profile
  log.info?.(`[${profileId}] bật profile AdsPower…`);
  const { wsEndpoint } = await adspower.startProfile(profileId);

  let browser;
  try {
    // 3) Bám vào browser
    const conn = await fb.connect(wsEndpoint);
    browser = conn.browser;
    const page = conn.page;

    // 4) Làm
    if (task.dryRun && action !== 'open') {
      log.info?.(`[${profileId}] DRY-RUN: chỉ mở & kiểm tra, không gửi.`);
      const st = await fb.openHome(page); // guard login/checkpoint
      return { ok: true, dryRun: true, detail: `dry-run ok (${st.detail})` };
    }

    let res;
    if (action === 'open') res = await fb.openHome(page);
    else if (action === 'react') res = await fb.react(page, task.target, task.reaction || 'like');
    else if (action === 'comment') res = await fb.comment(page, task.target, task.text);
    else if (action === 'inbox') res = await fb.inbox(page, task.target, task.text);
    else res = { ok: false, detail: `action không hỗ trợ: ${action}` };

    // 5) Ghi nhận vào van an toàn nếu thành công
    if (res.ok && ['react', 'comment', 'inbox'].includes(action)) safety.record(profileId, action);
    return res;
  } finally {
    // ngắt kết nối (KHÔNG close để khỏi giết browser), rồi tắt profile qua AdsPower
    try { if (browser) await browser.disconnect(); } catch {}
    if (!task.keepOpen) await adspower.stopProfile(profileId);
  }
}

module.exports = { executeAction };
