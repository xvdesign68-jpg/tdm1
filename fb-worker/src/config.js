'use strict';
/* config.js — nạp .env (không cần thư viện dotenv) + đặt mặc định an toàn.
   Mọi số đều có default để worker chạy được ngay cả khi anh chưa sửa .env. */
const fs = require('fs');
const path = require('path');

// nạp .env thủ công (tránh thêm dependency) — dòng KEY=VALUE, bỏ qua # và dòng trống
(function loadDotEnv() {
  const p = path.join(__dirname, '..', '.env');
  if (!fs.existsSync(p)) return;
  for (const raw of fs.readFileSync(p, 'utf8').split('\n')) {
    const line = raw.trim();
    if (!line || line.startsWith('#')) continue;
    const i = line.indexOf('=');
    if (i < 0) continue;
    const k = line.slice(0, i).trim();
    const v = line.slice(i + 1).trim();
    if (!(k in process.env)) process.env[k] = v;   // biến môi trường thật thắng .env
  }
})();

const num = (k, d) => {
  const v = Number(process.env[k]);
  return Number.isFinite(v) ? v : d;
};
const str = (k, d) => (process.env[k] != null && process.env[k] !== '' ? process.env[k] : d);

// ACTIVE_HOURS dạng "8-22" → {from:8,to:22}
function parseHours(s) {
  const m = String(s || '').match(/^(\d{1,2})\s*-\s*(\d{1,2})$/);
  if (!m) return { from: 0, to: 24 };
  return { from: Math.max(0, +m[1]), to: Math.min(24, +m[2]) };
}

const cfg = {
  adspower: {
    api: str('ADSPOWER_API', 'http://local.adspower.net:50325').replace(/\/+$/, ''),
    minReqGapMs: num('ADSPOWER_MIN_REQ_GAP_MS', 1100),
    headless: str('ADSPOWER_HEADLESS', '0') === '1',
    launchArgs: str('ADSPOWER_LAUNCH_ARGS', ''),
  },
  pace: {
    minDelay: num('ACTION_MIN_DELAY_MS', 1400),
    maxDelay: num('ACTION_MAX_DELAY_MS', 4200),
    typeMin: num('TYPE_MIN_MS', 45),
    typeMax: num('TYPE_MAX_MS', 155),
  },
  caps: {
    react: num('DAILY_CAP_REACT', 80),
    comment: num('DAILY_CAP_COMMENT', 25),
    inbox: num('DAILY_CAP_INBOX', 15),
    minGapSec: num('MIN_GAP_SEC', 45),
    hours: parseHours(str('ACTIVE_HOURS', '8-22')),
    stateFile: str('STATE_FILE', './state.json'),
  },
  localeHint: str('LOCALE_HINT', 'vi').toLowerCase(),
  worker: {
    collection: str('FIRESTORE_COLLECTION', 'outreach_tasks'),
    pollMs: num('WORKER_POLL_MS', 5000),
    batch: num('WORKER_BATCH', 5),
    credsPath: str('GOOGLE_APPLICATION_CREDENTIALS', ''),
  },
};

module.exports = cfg;
