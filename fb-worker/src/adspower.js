'use strict';
/* adspower.js — client cho AdsPower Local API.
   Tài liệu: AdsPower → Setting → Local API (bật lên). Mặc định http://local.adspower.net:50325
   - start:  GET /api/v1/browser/start?user_id=<profileId>  → trả data.ws.puppeteer (CDP endpoint để Puppeteer bám vào)
   - stop:   GET /api/v1/browser/stop?user_id=<profileId>
   - active: GET /api/v1/browser/active?user_id=<profileId>
   - list:   GET /api/v1/user/list?page_size=100
   AdsPower giới hạn ~1 request/giây → ta tự xếp hàng cho an toàn. */
const cfg = require('./config');

let _lastReqAt = 0;
async function throttle() {
  const wait = _lastReqAt + cfg.adspower.minReqGapMs - Date.now();
  if (wait > 0) await new Promise(r => setTimeout(r, wait));
  _lastReqAt = Date.now();
}

async function api(pathname, params = {}) {
  await throttle();
  const url = new URL(cfg.adspower.api + pathname);
  for (const [k, v] of Object.entries(params)) if (v != null) url.searchParams.set(k, v);
  let res;
  try {
    res = await fetch(url, { method: 'GET' });
  } catch (e) {
    throw new Error(`Không gọi được AdsPower Local API (${cfg.adspower.api}). ` +
      `Kiểm tra: AdsPower đang mở? Local API đã Enable? Cổng đúng chưa? — chi tiết: ${e.message}`);
  }
  const json = await res.json().catch(() => ({}));
  // AdsPower trả { code: 0, msg: 'success', data: {...} }; code != 0 là lỗi.
  if (json.code !== 0) {
    throw new Error(`AdsPower API lỗi tại ${pathname}: code=${json.code} msg=${json.msg || 'unknown'}`);
  }
  return json.data;
}

/** Bật profile, trả về { wsEndpoint, raw }. wsEndpoint = CDP để Puppeteer.connect. */
async function startProfile(userId, { headless = cfg.adspower.headless } = {}) {
  const params = {
    user_id: userId,
    open_tabs: 1,                 // mở sẵn 1 tab trống
    headless: headless ? 1 : 0,
    // AdsPower nhận launch_args dạng JSON mảng string; chỉ gắn khi có
  };
  if (cfg.adspower.launchArgs) params.launch_args = JSON.stringify(cfg.adspower.launchArgs.split(' ').filter(Boolean));
  const data = await api('/api/v1/browser/start', params);
  const wsEndpoint = data && data.ws && data.ws.puppeteer;
  if (!wsEndpoint) throw new Error('AdsPower start OK nhưng thiếu ws.puppeteer — bản AdsPower quá cũ? Cập nhật lên bản có Local API mới.');
  return { wsEndpoint, raw: data };
}

async function stopProfile(userId) {
  try { await api('/api/v1/browser/stop', { user_id: userId }); }
  catch (e) { /* stop lỗi không nên làm hỏng luồng chính */ }
}

async function isActive(userId) {
  const data = await api('/api/v1/browser/active', { user_id: userId });
  return data && data.status === 'Active';
}

async function listProfiles({ pageSize = 100 } = {}) {
  const data = await api('/api/v1/user/list', { page_size: pageSize });
  return (data && data.list) || [];
}

module.exports = { startProfile, stopProfile, isActive, listProfiles, api };
