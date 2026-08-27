'use strict';
/* safety.js — VAN AN TOÀN theo từng nick (profile), tính theo NGÀY (giờ máy VPS).
   Lưu trạng thái ra file JSON (STATE_FILE). Chống: quá hạn mức/ngày, thao tác dồn dập, ngoài khung giờ.
   Đây là lớp bảo vệ QUAN TRỌNG NHẤT chống bay nick — đừng tắt. */
const fs = require('fs');
const path = require('path');
const cfg = require('./config');

const FILE = path.isAbsolute(cfg.caps.stateFile)
  ? cfg.caps.stateFile
  : path.join(__dirname, '..', cfg.caps.stateFile);

function todayKey() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function load() {
  try { return JSON.parse(fs.readFileSync(FILE, 'utf8')); } catch { return {}; }
}
function save(state) {
  try { fs.writeFileSync(FILE, JSON.stringify(state, null, 2)); }
  catch (e) { console.warn('[safety] không ghi được state file:', e.message); }
}

function capFor(action) {
  if (action === 'react') return cfg.caps.react;
  if (action === 'comment') return cfg.caps.comment;
  if (action === 'inbox') return cfg.caps.inbox;
  return Infinity; // open/list không giới hạn
}

function withinActiveHours() {
  const { from, to } = cfg.caps.hours;
  const h = new Date().getHours();
  if (from <= to) return h >= from && h < to;
  return h >= from || h < to; // khung giờ vắt qua nửa đêm
}

/**
 * Kiểm tra được phép làm không. Trả { ok, reason }.
 * KHÔNG tự tăng bộ đếm — gọi record() SAU khi làm thành công.
 */
function check(profileId, action) {
  if (!withinActiveHours()) {
    const { from, to } = cfg.caps.hours;
    return { ok: false, reason: `ngoài khung giờ hoạt động (${from}-${to}h, giờ VPS)` };
  }
  const state = load();
  const day = todayKey();
  const rec = (state[profileId] && state[profileId][day]) || { react: 0, comment: 0, inbox: 0, lastAt: 0 };

  const cap = capFor(action);
  if ((rec[action] || 0) >= cap) {
    return { ok: false, reason: `đã đạt hạn mức ${action}/ngày (${cap}) cho nick này` };
  }
  const gapMs = cfg.caps.minGapSec * 1000;
  const since = Date.now() - (rec.lastAt || 0);
  if (since < gapMs) {
    return { ok: false, reason: `chưa đủ khoảng cách tối thiểu ${cfg.caps.minGapSec}s (còn ${Math.ceil((gapMs - since) / 1000)}s)` };
  }
  return { ok: true };
}

/** Ghi nhận đã làm 1 thao tác thành công (tăng bộ đếm + mốc thời gian). */
function record(profileId, action) {
  const state = load();
  const day = todayKey();
  state[profileId] = state[profileId] || {};
  const rec = state[profileId][day] || { react: 0, comment: 0, inbox: 0, lastAt: 0 };
  if (action in rec) rec[action] = (rec[action] || 0) + 1;
  rec.lastAt = Date.now();
  state[profileId][day] = rec;
  // dọn ngày cũ cho gọn (giữ lại 7 ngày gần nhất)
  for (const pid of Object.keys(state)) {
    const days = Object.keys(state[pid]).filter(k => /^\d{4}-\d{2}-\d{2}$/.test(k)).sort();
    while (days.length > 7) delete state[pid][days.shift()];
  }
  save(state);
}

/** Xem nhanh số đã dùng hôm nay của 1 nick. */
function usage(profileId) {
  const rec = (load()[profileId] && load()[profileId][todayKey()]) || { react: 0, comment: 0, inbox: 0 };
  return { react: rec.react || 0, comment: rec.comment || 0, inbox: rec.inbox || 0, caps: { ...cfg.caps } };
}

module.exports = { check, record, usage, withinActiveHours };
