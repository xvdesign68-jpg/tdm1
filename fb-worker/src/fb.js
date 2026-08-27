'use strict';
/* fb.js — thao tác Facebook bằng nick cá nhân qua Puppeteer (bám vào Chrome của AdsPower).
   Cảnh báo thực tế: FB đổi DOM liên tục → selector có thể phải chỉnh. Mọi selector gom ở đây,
   ưu tiên aria-label (ổn định nhất) và thử cả tiếng Việt lẫn English. */
const puppeteer = require('puppeteer-core');
const { pause, humanType, idleScroll, sleep, rand } = require('./humanize');

/* ---------- Bảng nhãn (VN + EN) — chỉnh ở đây khi FB đổi ---------- */
const L = {
  like:   ['Thích', 'Like'],
  react: {
    like:  ['Thích', 'Like'],
    love:  ['Yêu thích', 'Love'],
    care:  ['Thương thương', 'Care'],
    haha:  ['Haha'],
    wow:   ['Wow'],
    sad:   ['Buồn', 'Sad'],
    angry: ['Phẫn nộ', 'Angry'],
  },
  commentBox: ['Viết bình luận', 'Write a comment', 'Bình luận với tư cách', 'Comment as', 'Bình luận', 'Comment'],
  messageBox: ['Tin nhắn', 'Message', 'Nhắn tin', 'Aa'],
};

/* ---------- Helper ---------- */
const cssAria = labels => labels.map(t => `[aria-label="${cssEscape(t)}"]`).join(',');
function cssEscape(s) { return String(s).replace(/["\\]/g, '\\$&'); }

async function connect(wsEndpoint) {
  const browser = await puppeteer.connect({ browserWSEndpoint: wsEndpoint, defaultViewport: null });
  const pages = await browser.pages();
  let page = pages.find(p => { const u = p.url(); return u && !u.startsWith('devtools://'); });
  if (!page) page = await browser.newPage();
  page.setDefaultTimeout(30000);
  return { browser, page };
}

/** Điều hướng an toàn + kiểm tra checkpoint/đăng nhập ngay sau khi tải. */
async function gotoAndGuard(page, url) {
  await page.goto(url, { waitUntil: 'domcontentloaded' });
  await sleep(rand(1500, 3000));
  const st = await pageState(page);
  if (st === 'login') throw new Error('NICK CHƯA ĐĂNG NHẬP FB trên profile này — mở AdsPower đăng nhập lại.');
  if (st === 'checkpoint') throw new Error('NICK ĐANG BỊ CHECKPOINT (FB yêu cầu xác minh) — xử lý thủ công trước, tạm dừng nick này.');
  return st;
}

/** Trả 'login' | 'checkpoint' | 'ok' */
async function pageState(page) {
  const url = page.url();
  if (/\/checkpoint\//.test(url)) return 'checkpoint';
  if (/\/login\/?($|\?)/.test(url) || /login\.php/.test(url)) return 'login';
  return await page.evaluate(() => {
    const has = sel => !!document.querySelector(sel);
    // form đăng nhập
    if (has('input[name="pass"]') && has('input[name="email"]')) return 'login';
    const body = (document.body && document.body.innerText || '').slice(0, 4000).toLowerCase();
    if (body.includes('xác nhận danh tính') || body.includes('confirm your identity') ||
        body.includes('tài khoản của bạn đã bị tạm khóa') || body.includes('your account has been locked') ||
        body.includes('chúng tôi đã hạn chế') || body.includes("we've temporarily")) return 'checkpoint';
    return 'ok';
  });
}

/** Chờ 1 trong các selector xuất hiện & hiển thị, trả ElementHandle (hoặc null). */
async function waitVisible(page, selector, timeout = 12000) {
  try {
    await page.waitForSelector(selector, { visible: true, timeout });
    const handles = await page.$$(selector);
    for (const h of handles) {
      const box = await h.boundingBox().catch(() => null);
      if (box && box.width > 0 && box.height > 0) return h;
    }
    return handles[0] || null;
  } catch { return null; }
}

async function safeClick(page, handle) {
  if (!handle) return false;
  try { await handle.click({ delay: rand(40, 120) }); return true; }
  catch {
    try { await page.evaluate(el => el.click(), handle); return true; }
    catch { return false; }
  }
}

/* ---------- Hành động ---------- */

/** Thả cảm xúc lên 1 bài viết. reaction ∈ like|love|care|haha|wow|sad|angry (mặc định like). */
async function react(page, postUrl, reaction = 'like') {
  await gotoAndGuard(page, postUrl);
  await idleScroll(page);

  const likeBtn = await waitVisible(page, `${cssAria(L.like)}[role="button"], ${cssAria(L.like)}`, 12000);
  if (!likeBtn) return { ok: false, detail: 'không thấy nút Thích trên bài (post có thể bị ẩn/riêng tư hoặc DOM đổi)' };

  await likeBtn.hover().catch(() => {});
  await sleep(rand(700, 1500)); // đợi thanh cảm xúc hiện

  const want = (L.react[reaction] || L.react.like);
  const reactBtn = await waitVisible(page, cssAria(want), 3500);
  if (reactBtn && await safeClick(page, reactBtn)) {
    await pause();
    return { ok: true, detail: `đã thả "${reaction}"` };
  }
  // fallback: bấm thẳng nút Thích (= Like)
  if (await safeClick(page, likeBtn)) {
    await pause();
    return { ok: true, detail: 'đã thả "like" (fallback — không mở được thanh cảm xúc)' };
  }
  return { ok: false, detail: 'thấy nút nhưng không click được' };
}

/** Bình luận vào 1 bài viết. */
async function comment(page, postUrl, text) {
  if (!text || !text.trim()) return { ok: false, detail: 'thiếu nội dung bình luận' };
  await gotoAndGuard(page, postUrl);
  await idleScroll(page);

  let box = await waitVisible(page, cssAria(L.commentBox), 12000);
  if (!box) box = await waitVisible(page, 'div[contenteditable="true"][role="textbox"]', 6000);
  if (!box) return { ok: false, detail: 'không thấy ô bình luận (post có thể tắt bình luận hoặc DOM đổi)' };

  await safeClick(page, box);
  await sleep(rand(400, 900));
  await humanType(page, text);
  await sleep(rand(500, 1200));
  await page.keyboard.press('Enter');
  await pause();
  return { ok: true, detail: 'đã gửi bình luận' };
}

/** Inbox 1 người. target = UID số, hoặc username, hoặc URL profile/messenger. */
async function inbox(page, target, text) {
  if (!text || !text.trim()) return { ok: false, detail: 'thiếu nội dung tin nhắn' };
  const url = messengerUrl(target);
  await gotoAndGuard(page, url);
  await sleep(rand(1500, 3000));

  let box = await waitVisible(page, 'div[contenteditable="true"][role="textbox"]', 15000);
  if (!box) box = await waitVisible(page, cssAria(L.messageBox), 5000);
  if (!box) return { ok: false, detail: 'không thấy ô soạn tin (chưa mở được hội thoại / cần tương tác trước / DOM đổi)' };

  await safeClick(page, box);
  await sleep(rand(500, 1100));
  await humanType(page, text);
  await sleep(rand(600, 1400));
  await page.keyboard.press('Enter');
  await pause();
  return { ok: true, detail: 'đã gửi tin nhắn (kiểm tra: có thể vào mục "Tin nhắn đang chờ" của người nhận nếu là người lạ)' };
}

/** Chỉ mở FB để anh kiểm tra nick đã đăng nhập/khoẻ chưa. */
async function openHome(page) {
  const st = await gotoAndGuard(page, 'https://www.facebook.com/me');
  return { ok: true, detail: `trạng thái nick: ${st}` };
}

/* ---------- Chuẩn hoá target → URL Messenger ---------- */
function messengerUrl(target) {
  const t = String(target || '').trim();
  if (/^https?:\/\//i.test(t)) {
    // đã là URL: nếu là messenger/t thì giữ; nếu là profile thì đổi sang messages/t/<id-hoặc-username>
    const m = t.match(/facebook\.com\/(?:profile\.php\?id=)?([0-9]+)/i);
    if (m) return `https://www.facebook.com/messages/t/${m[1]}`;
    const u = t.match(/facebook\.com\/([A-Za-z0-9.]+)\/?/i);
    if (u && u[1] && !['profile.php', 'messages'].includes(u[1])) return `https://www.facebook.com/messages/t/${u[1]}`;
    return t;
  }
  // uid số hoặc username
  return `https://www.facebook.com/messages/t/${encodeURIComponent(t)}`;
}

module.exports = { connect, react, comment, inbox, openHome, pageState, messengerUrl };
