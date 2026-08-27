'use strict';
/* humanize.js — mô phỏng hành vi người thật để giảm dấu vết tự động.
   LƯU Ý: chỉ giảm rủi ro bị nhận diện theo NHỊP/HÀNH VI; không thay được van an toàn (cap/ngày). */
const cfg = require('./config');

const rand = (min, max) => Math.floor(min + Math.random() * (max - min + 1));
const sleep = ms => new Promise(r => setTimeout(r, ms));

/** nghỉ ngẫu nhiên giữa các thao tác (nhịp người) */
async function pause(scale = 1) {
  await sleep(Math.round(rand(cfg.pace.minDelay, cfg.pace.maxDelay) * scale));
}

/** gõ từng ký tự với độ trễ ngẫu nhiên vào element đang focus */
async function humanType(page, text) {
  for (const ch of String(text)) {
    await page.keyboard.type(ch, { delay: rand(cfg.pace.typeMin, cfg.pace.typeMax) });
    if (Math.random() < 0.06) await sleep(rand(120, 480)); // thi thoảng khựng như người thật
  }
}

/** cuộn trang vu vơ vài nhịp để trông tự nhiên trước khi hành động */
async function idleScroll(page) {
  const times = rand(1, 3);
  for (let i = 0; i < times; i++) {
    await page.mouse.wheel({ deltaY: rand(200, 900) }).catch(() => {});
    await sleep(rand(400, 1200));
  }
}

module.exports = { rand, sleep, pause, humanType, idleScroll };
