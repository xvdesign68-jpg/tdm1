/* FIXTURE LỆNH #46 — outreach.js dựng lại từ dump #43/#44a + patch #37/#44 (chỉ mốc cần cho patch; không phải bản đầy đủ) */
import { getFirestore, FieldValue, onSchedule, onRequest, genForLead, SecretManagerServiceClient } from './stub.mjs';
const REGION = 'asia-southeast1';
const CAPS = { react: 40, comment: 12, inbox: 8, friend: 10 };
const HOURS = { start: 8, end: 22 };
const GAP_MIN_MS = 3 * 60 * 1000;
const GAP_RAND_MS = 5 * 60 * 1000;
const WARM_REACT_TO_COMMENT = [2, 5];
const WARM_COMMENT_TO_INBOX = [1, 4];
const REACT_MIX = ['LOVE', 'LOVE', 'LOVE', 'LOVE', 'LIKE'];

const sm = new SecretManagerServiceClient();
let _db = null;
function db() { return _db || (_db = getFirestore()); }
const rand = (a, b) => a + Math.floor(Math.random() * (b - a + 1));
const pick = arr => arr[Math.floor(Math.random() * arr.length)];
const nowMs = () => Date.now();
function vnHour() { return (new Date().getUTCHours() + 7) % 24; }
function inHours() { return true; }
const dayKey = () => { const d = new Date(nowMs() + 7 * 3600 * 1000); return d.toISOString().slice(0, 10); };
function parsePost(url) { const m = /\/posts\/(\d+)/.exec(url || ''); return { post_id: m ? m[1] : null }; }
function commentIdOf(lead){ return lead.comment_id || null; }
function commentUrlOf0(lead,cid){ return lead.comment_url || (lead.post_url + '?comment_id=' + cid); }
function uidFromAuthor(url) { const m = /profile\.php\?id=(\d+)/.exec(url || ''); return m ? m[1] : null; }
async function addLog(o) { await db().collection('outreach_log').add(Object.assign({ at: FieldValue.serverTimestamp() }, o)); }
async function tryConsume(pid, kind, capOverride) {
  const ref = db().collection('outreach_usage').doc(`${pid}__${dayKey()}`);
  return db().runTransaction(async tx => {
    const s = await tx.get(ref); const d = s.exists ? s.data() : {};
    const used = Number(d[kind]) || 0;
    const cap = (Number(capOverride) > 0) ? Number(capOverride) : CAPS[kind];
    if (used >= cap) return false;
    tx.set(ref, { [kind]: used + 1, pid, day: dayKey(), updatedAt: FieldValue.serverTimestamp() }, { merge: true });
    return true;
  });
}
async function usageOf(pid) {
  const s = await db().collection('outreach_usage').doc(`${pid}__${dayKey()}`).get();
  const d = s.exists ? s.data() : {};
  return { react: Number(d.react) || 0, comment: Number(d.comment) || 0, inbox: Number(d.inbox) || 0 };
}
async function stepNick(brand, acct) {
  const pid = acct.id || acct.pid;
  const token = await getToken(pid).catch(() => null);
  if (!token) { await addLog({ pid, brand: brand.name || brand.code, brandCode: brand.code, action: 'Bỏ qua: thiếu token nick', status: 'sched' }); return false; }
  const immediate = !!(brand.outreach && brand.outreach.immediate); // "Xử lý ngay": chạy trọn phễu 1 mạch, không chờ giãn
  const threads = db().collection('outreach_threads');

  async function drive(tref) {
    let guard = 0, prevStep = null;
    while (guard++ < 4) {
      const snap = await tref.get(); if (!snap.exists) return;
      const t = snap.data();
      if (!t.active || t.step === prevStep) return; // không tiến (cap/auth/xong) → dừng
      prevStep = t.step;
      // LENH #37: func-path theo MA TRẬN + VAN theo brand (như AdsPower). Bước bị brand tắt (t.allow[kind]===false) → nhảy bước kế, không tốn lượt;
      //   hết van brand cho bước này → hẹn lại 1 giờ (không chặn nick nạp lead khác ở tick sau). Thread cũ không có t.allow → hành vi cũ.
      const kind37 = t.step === 'react' ? 'react' : t.step === 'comment' ? 'comment' : t.step === 'inbox' ? 'inbox' : null;
      if (kind37 && t.allow && t.allow[kind37] === false) { const nx = kind37 === 'react' ? 'comment' : kind37 === 'comment' ? 'inbox' : 'done'; await tref.set(nx === 'done' ? { step: 'done', active: false } : { step: nx, nextAt: nowMs() }, { merge: true }); if (nx === 'done') return; continue; }
      if (kind37) { const u37 = await usageOf(pid); const c37 = brandCaps(brand); if ((Number(u37[kind37]) || 0) >= (Number(c37[kind37]) || 0)) { await tref.set({ nextAt: nowMs() + 60 * 60000 }, { merge: true }); return; } }
      let ok = false;
      if (t.step === 'react') ok = await doReact(brand, pid, token, tref, t);
      else if (t.step === 'comment') ok = await doComment(brand, pid, token, tref, t);
      else if (t.step === 'inbox') ok = await doInbox(brand, pid, token, tref, t);
      else { await tref.set({ step: 'done', active: false }, { merge: true }); return; }
      if (!ok) return;             // cap hết → dừng
      if (!immediate) return;      // chế độ thường: mỗi tick 1 bước
    }
  }

  const pend = await threads
    .where('pid', '==', pid).where('active', '==', true)
    .where('nextAt', '<=', nowMs()).orderBy('nextAt', 'asc').limit(1).get();
  if (!pend.empty) { await drive(pend.docs[0].ref); return true; }

  const u = await usageOf(pid);
  if (u.react >= brandCaps(brand).react) return false;
  const leadsSnap = await db().collection('leads')
    .where('brand', '==', brand.code).orderBy('detected_at', 'desc').limit(40).get();
  for (const ld of leadsSnap.docs) {
    const lead = ld.data(); lead.id = ld.id;
    if (lead.dropped || lead.lost) continue;
    // LENH #37: gate như AdsPower — bỏ junk · ma trận brand tắt react cho nhiệt độ này · chủ bài/người bán (LỆNH #31) · lead-là-bình-luận (func chưa tym/reply đúng comment → để AdsPower lo)
    const temp37 = lead.temp || 'cold';
    if (temp37 === 'junk') continue;
    if (lead.ai_scored === false) continue; // LENH #46: điểm tạm (AI chưa chấm) → máy không chạm
    if (typeof brandAllow === 'function' && !brandAllow(brand, temp37, 'react')) continue;
    if (typeof roleBlockOf === 'function' && roleBlockOf(lead)) continue;
    if (typeof commentIdOf === 'function' && commentIdOf(lead)) continue;
    const tref = threads.doc(ld.id);
    const ex = await tref.get(); if (ex.exists) continue;
    const { post_id } = parsePost(lead.post_url);
    if (!post_id) continue;
    await tref.set({ leadId: ld.id, brand: brand.code, brandName: brand.name || brand.code,
      name: lead.name || 'Ẩn danh', temp: lead.temp || 'cold', score: Number(lead.score) || 0,
      post_url: lead.post_url, author_url: lead.author_url || '', uid: uidFromAuthor(lead.author_url),
      reply: lead.reply || '', need: lead.need || '', intent: lead.intent || '', service: lead.service || '', industry: lead.industry || '',
      pid, step: 'react', active: true, nextAt: nowMs(), createdAt: FieldValue.serverTimestamp(),
      allow: { comment: (typeof brandAllow === 'function') ? !!brandAllow(brand, temp37, 'comment') : true, inbox: (typeof brandAllow === 'function') ? !!brandAllow(brand, temp37, 'inbox') : true } }); // LENH #37: ma trận brand cho các bước sau
    await drive(tref);
    return true;
  }
  return false;
}

async function handleAuth(){ return false; }

const OA_DEF_MATRIX = { hot: { react: 1, comment: 1, friend: 1, inbox: 1 }, warm: { react: 1, comment: 1, friend: 1, inbox: 0 }, cold: { react: 1, comment: 0, friend: 0, inbox: 0 } };
const HARD_CAPS44 = { react: 80, comment: 30, friend: 20, inbox: 15 }; // LENH #44 (E-17): trần cứng = hardCaps mặc định worker → van hiệu lực = min(van brand, trần cứng); web (F-2) chặn nhập cùng số
function brandCaps(brand) { const c = (brand.outreach && brand.outreach.caps) || {}; const o = {}; ['react','comment','friend','inbox'].forEach(k => { const v = Number(c[k]) > 0 ? Number(c[k]) : CAPS[k]; o[k] = Math.min(v, HARD_CAPS44[k] || v); }); return o; }
function brandAllow(brand, temp, action) { if (temp !== 'hot' && temp !== 'warm' && temp !== 'cold') return false; const m = (brand.outreach && brand.outreach.matrix) || {}; const row = m[temp] || {}; const def = OA_DEF_MATRIX[temp]; return (row[action] != null) ? !!row[action] : !!def[action]; }

async function apEnqueueFunnel(acct, brand, lead, tref) {
  const pid = acct.id || acct.pid;
  const temp = lead.temp || 'cold';
  if (temp === 'junk') return false;
  const caps = brandCaps(brand);
  const allow = a => brandAllow(brand, temp, a);
  const hasProfile = !!lead.author_url;
  const uid = uidFromAuthor(lead.author_url);
  const steps = [];
  if (allow('react') && await tryConsume(pid, 'react', caps.react)) steps.push('react');
  if (allow('comment') && await tryConsume(pid, 'comment', caps.comment)) steps.push('comment');
  if (allow('friend') && hasProfile && await tryConsume(pid, 'friend', caps.friend)) steps.push('add_friend');
  if (allow('inbox') && hasProfile && steps.indexOf('add_friend') >= 0 && await tryConsume(pid, 'inbox', caps.inbox)) steps.push('inbox');
  if (!steps.length) return false;
  /* v119-41 Content Studio: comment + inbox RIÊNG theo bài của lead + hồ sơ brand (brands/{code}.content); AI lỗi → mẫu/lead.reply, không chặn phễu */
  const gen = (steps.includes('comment') || steps.includes('inbox')) ? await genForLead(brand, lead) : { comment: '', inbox: '', mode: 'none' };
  const payload = { post_url: lead.post_url, reaction: pick(REACT_MIX), comment_msg: gen.comment, inbox_msg: gen.inbox, content_meta: (gen && gen.meta) || null, /* LENH #34: meta nội dung → worker ghi lên lead.outreach.content */ content_mode: gen.mode || '', uid: uid || null, profile_url: lead.author_url || '', steps };
  const _cid = commentIdOf(lead); const _curl = _cid ? commentUrlOf(lead, _cid) : null;
  if (_cid && _curl) { payload.kind = 'comment'; payload.comment_id = _cid; payload.comment_url = _curl; }
  const meta = { leadId: lead.id, name: lead.name || 'An danh', brandName: brand.name || brand.code, brandCode: brand.code, temp: lead.temp || 'cold', score: Number(lead.score) || 0 };
  await db().collection('outreach_tasks').doc(lead.id + '__funnel').set(Object.assign({}, meta, { pid, adspower_id: acct.adspower_id || null, action: 'funnel', workerId: acct.workerId || '', payload, status: 'queued', createdAt: FieldValue.serverTimestamp() }));
  await tref.set(Object.assign({}, meta, { brand: brand.code, pid, step: 'funnel', active: true, taskStatus: 'queued', nextAt: nowMs() + 30 * 60000, fpayload: payload, reservedDay: dayKey(), /* LENH #44 (E-4) */ createdAt: FieldValue.serverTimestamp() }), { merge: true });
  return true;
}
const __SL_ANON31 = /an danh|anonymous|nguoi tham gia|facebook user|nguoi dung facebook/;
function __slFold31(s) { return String(s || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/đ/g, 'd').toLowerCase().trim(); }
function roleBlockOf(lead) {
  const r = String(lead.role || '').toLowerCase().trim();
  if (r === 'seller') return 'người bán/đối thủ' + (lead.role_reason ? ' (AI: ' + lead.role_reason + ')' : ' (AI)');
  if (r === 'poster_self' || lead.self_comment === true) return 'chính chủ bài tự bình luận';
  if (lead.kind === 'comment' && lead.name && lead.parent_author) {
    const a = __slFold31(lead.name), p = __slFold31(lead.parent_author);
    if (a && a === p && !__SL_ANON31.test(a)) return 'chính chủ bài tự bình luận (tên khớp)';
  }
  return '';
}
async function skipLeadRole(lead, brand, acct, why) {
  const pid = acct.id || acct.pid;
  await db().collection('outreach_threads').doc(lead.id).set({ leadId: lead.id, brand: brand.code, brandCode: brand.code, pid, name: lead.name || '', temp: lead.temp || 'cold', active: false, step: 'skipped_role', taskStatus: 'skipped', skipReason: why, nextAt: 0, createdAt: FieldValue.serverTimestamp() }, { merge: true });
  await addLog({ leadId: lead.id, name: lead.name || '', brand: brand.name || '', brandCode: brand.code, pid, temp: lead.temp || 'cold', action: '⏭ Bỏ qua lead — ' + why + ' (không tiếp cận đối thủ/chủ bài)', status: 'skip' });
}

/* ===== LENH #44 (11/09/2026) — nick cờ · van hiệu lực · người thật · reserve lại · sweeper ===== */
const dayOfMs44 = ms => new Date(Number(ms) + 7 * 3600 * 1000).toISOString().slice(0, 10);
const tsMs44 = v => !v ? 0 : (typeof v === 'number' ? v : (typeof v.toMillis === 'function' ? v.toMillis() : (v.seconds ? v.seconds * 1000 : (v instanceof Date ? v.getTime() : Number(v) || 0))));
// E-16: nick có cờ → KHÔNG xếp việc (uiLang cố ý không lọc: worker ghi lại mỗi phiên, lọc ở engine = kẹt vĩnh viễn)
function nickFlag44(a) { if (!a) return 'thiếu nick'; if (a.active === false) return 'nick tắt'; if (a.needLogin) return 'cần đăng nhập lại'; if (a.safetyPaused) return 'tạm dừng Safety'; if (a.challenge) return 'checkpoint ' + a.challenge; return ''; }
// R-1: lead người thật đang chăm / đã hẹn / đã chốt / không thành / đã phản hồi → máy không chạm (assignee chỉ khi brand.outreach.skipAssigned)
function humanBusy44(lead, brand) {
  if (!lead) return 'thiếu lead';
  if (lead.lost) return 'không thành'; if (lead.closed_at) return 'đã chốt'; if (lead.outreach_replied) return 'khách đã phản hồi';
  const st = String(lead.stage || ''); if (st && st !== 'new') return 'giai đoạn ' + st;
  if (tsMs44(lead.first_care_at)) return 'sales đã chăm'; if (tsMs44(lead.last_touch_at)) return 'sales đã liên hệ';
  if (lead.assignee && brand && brand.outreach && brand.outreach.skipAssigned) return 'đã giao sales';
  return '';
}
function nextMorning44() { const d = new Date(nowMs() + 7 * 3600 * 1000); d.setUTCDate(d.getUTCDate() + 1); d.setUTCHours(HOURS.start, rand(0, 40), 0, 0); return d.getTime() - 7 * 3600 * 1000; }
const KIND44 = { react: 'react', comment: 'comment', add_friend: 'friend', inbox: 'inbox' };
function pendingKinds44(th) { const p = (th && th.fpayload) || {}; const done = new Set(Array.isArray(th && th.doneSteps) ? th.doneSteps : []); return (Array.isArray(p.steps) ? p.steps : []).filter(s => KIND44[s] && !done.has(s)).map(s => KIND44[s]); }
function reservedDay44(th) { if (!th) return ''; if (th.reservedDay) return String(th.reservedDay); const c = tsMs44(th.createdAt); return c ? dayOfMs44(c) : ''; }
// E-5: hoàn van CÙNG NGÀY reserve, clamp ≥ 0
async function refund44(pid, day, kinds) {
  if (!pid || !day || !Array.isArray(kinds) || !kinds.length) return false;
  const ref = db().collection('outreach_usage').doc(pid + '__' + day);
  return db().runTransaction(async tx => { const s = await tx.get(ref); if (!s.exists) return false; const d = s.data() || {}; const p = {}; kinds.forEach(k => { p[k] = Math.max(0, (Number(d[k]) || 0) - 1); }); tx.set(ref, p, { merge: true }); return true; }).catch(() => false);
}
// E-4: phễu reserve ngày khác → reserve lại các bước CHƯA làm trên nick hiện tại; không đủ → trả lại phần vừa lấy → 'wait'
async function reReserve44(pid, brand, th) {
  const today = dayKey(); if (reservedDay44(th) === today) return 'ok';
  const need = pendingKinds44(th); if (!need.length) return 'ok';
  const caps = brandCaps(brand); const got = [];
  for (const k of need) { if (await tryConsume(pid, k, caps[k])) got.push(k); else break; }
  if (got.length === need.length) return 'ok';
  await refund44(pid, today, got); return 'wait';
}
async function taskRunning44(leadId) { try { const s = await db().collection('outreach_tasks').doc(leadId + '__funnel').get(); return !!(s.exists && s.data().status === 'running'); } catch (_) { return false; } }
// huỷ task đang XẾP HÀNG (worker chỉ nhận status 'queued'); giao dịch — không đụng task đang chạy
async function cancelQueued44(leadId, why) {
  const ref = db().collection('outreach_tasks').doc(leadId + '__funnel');
  return db().runTransaction(async tx => { const s = await tx.get(ref); if (!s.exists || s.data().status !== 'queued') return false; tx.set(ref, { status: 'cancelled', cancelledAt: nowMs(), cancelReason: why }, { merge: true }); return true; }).catch(() => false);
}
// R-6: sweeper ≤ 1 lần/25′ — thread active trên nick chết/tắt > 2h → chuyển nick sống cùng brand (giãn 10′) · > 72h → đóng · system_status/outreach + ERROR khi brand BẬT rơi về 0 nick
const SWEEP_EVERY44 = 25 * 60000, ORPHAN_AFTER44 = 2 * 3600e3, EXPIRE_AFTER44 = 72 * 3600e3, MOVE_MAX44 = 20;
async function sweep44(brandMap, now) {
  const stRef = db().collection('system_status').doc('outreach');
  const st = await stRef.get().catch(() => null); const prev = (st && st.exists) ? (st.data() || {}) : {};
  if (prev.at && now - tsMs44(prev.at) < SWEEP_EVERY44) return null;
  const snap = await db().collection('outreach_threads').where('active', '==', true).limit(300).get();
  const nickCache = {}, brandNicks = {}, rr = {};
  const nickOf = async pid => { if (!(pid in nickCache)) { const s = await db().collection('fb_accounts').doc(String(pid)).get().catch(() => null); nickCache[pid] = (s && s.exists) ? Object.assign({ id: s.id }, s.data()) : null; } return nickCache[pid]; };
  const nicksOf = async code => { if (!brandNicks[code]) { const s = await db().collection('fb_accounts').where('brand', '==', code).get().catch(() => ({ docs: [] })); brandNicks[code] = s.docs.map(d => Object.assign({ id: d.id }, d.data())).filter(a => a.engine === 'adspower' || a.engine === 'func' || a.adspower_id || a.tokenSet); } return brandNicks[code]; }; // nick automation (bỏ nick quét acc_*)
  const aliveOf = async code => (await nicksOf(code)).filter(a => !nickFlag44(a));           // giám sát: mọi engine
  const aliveApOf = async code => (await aliveOf(code)).filter(a => !!a.adspower_id);          // đích chuyển phễu: chỉ AdsPower
  const out = { at: now, threadsActive: snap.size, moved: 0, closed: 0, orphan: 0, brands: {} };
  for (const d of snap.docs) {
    const th = d.data() || {}; const code = th.brandCode || th.brand || ''; const brand = brandMap[code]; const born = tsMs44(th.movedAt) || tsMs44(th.createdAt) || now;
    const b = out.brands[code] || (out.brands[code] = { on: !!brand, threads: 0, orphan: 0 }); b.threads++;
    if (!brand) continue; // brand đang tắt automation → chờ, không đụng
    if (now - born > EXPIRE_AFTER44) {
      await d.ref.set({ active: false, step: 'expired', taskStatus: 'cancelled', closedAt: now, lastError: 'quá 72 giờ chưa xong — đóng phễu' }, { merge: true });
      await cancelQueued44(d.id, 'quá 72 giờ');
      if (reservedDay44(th) === dayKey()) await refund44(th.pid, dayKey(), pendingKinds44(th));
      await addLog({ leadId: d.id, name: th.name || '', brand: th.brandName || code, brandCode: code, temp: th.temp || '', score: th.score || 0, pid: th.pid || '', action: '⏳ Đóng phễu — quá 72 giờ chưa hoàn tất', text: 'bước đã làm: ' + ((Array.isArray(th.doneSteps) && th.doneSteps.length) ? th.doneSteps.join(', ') : 'chưa bước nào'), status: 'skip' });
      out.closed++; continue;
    }
    if (th.step !== 'funnel' || !th.fpayload) continue; // chỉ phễu AdsPower
    const nick = await nickOf(th.pid); const flag = nickFlag44(nick); if (!flag) continue;
    const last = Math.max(tsMs44(th.nextAt) || 0, born);
    if (now - last < ORPHAN_AFTER44) continue; // mới kẹt < 2h → cho nick cơ hội tự hồi
    const alive = await aliveApOf(code);
    if (alive.length && out.moved < MOVE_MAX44) {
      const i = (rr[code] = (rr[code] || 0) + 1) - 1; const to = alive[i % alive.length]; const k = Math.floor(i / alive.length);
      await cancelQueued44(d.id, 'chuyển nick');
      if (reservedDay44(th) === dayKey()) await refund44(th.pid, dayKey(), pendingKinds44(th)); // van nick cũ trả lại (nick mới reserve lại ở lượt re-enqueue)
      await d.ref.set({ pid: to.id, movedFrom: th.pid || '', movedAt: now, taskStatus: 'moved', nextAt: now + k * 10 * 60000 + (i % alive.length) * 60000, reservedDay: 'moved', /* ép nick mới reserve lại van ở lượt re-enqueue */ lastError: null }, { merge: true });
      await addLog({ leadId: d.id, name: th.name || '', brand: th.brandName || code, brandCode: code, temp: th.temp || '', score: th.score || 0, pid: to.id, action: '🔀 Chuyển phễu sang nick khác — nick cũ ' + flag, text: (to.label || to.id) + ' nhận (nick cũ ' + (th.pid || '?') + ')', status: 'sched' });
      out.moved++;
    } else { b.orphan++; out.orphan++; if (!th.orphanAt) await d.ref.set({ orphanAt: now, orphanWhy: flag }, { merge: true }); }
  }
  for (const code of Object.keys(brandMap)) {
    const all = await nicksOf(code); const alive = await aliveOf(code);
    const b = out.brands[code] || (out.brands[code] = { on: true, threads: 0, orphan: 0 }); b.nicksAlive = alive.length; b.nicksTotal = all.length;
    if (!alive.length && all.length) { const was = prev.brands && prev.brands[code] ? Number(prev.brands[code].nicksAlive) : NaN; const sev = (Number.isNaN(was) || was > 0) ? 'ERROR' : 'WARNING'; console.log(JSON.stringify({ severity: sev, message: '[OUTREACH-NO-NICK] brand ' + code + ' BẬT tự động nhưng 0/' + all.length + ' nick chạy được (' + b.orphan + ' phễu chờ)' })); }
  }
  await stRef.set(out).catch(() => {});
  return out;
}
async function stepNickAdspower(brand, acct) {
  const pid = acct.id || acct.pid;
  if (!acct.adspower_id) { await addLog({ pid, brand: brand.name, brandCode: brand.code, action: 'Bo qua: nick AdsPower thieu Profile ID', status: 'sched' }); return false; }
  const threads = db().collection('outreach_threads');
  const retry = await threads.where('pid', '==', pid).where('active', '==', true).where('nextAt', '<=', nowMs()).orderBy('nextAt', 'asc').limit(1).get();
  if (!retry.empty) {
    const d = retry.docs[0], th = d.data();
    if (th.fpayload) {
      // LENH #44 (E-4): phễu reserve NGÀY KHÁC → reserve lại van cho bước chưa làm; hết van → hẹn sáng mai (không đốt lượt) · (E-7): task đang running → không đè
      const re44 = await reReserve44(pid, brand, th);
      if (re44 === 'wait') { await d.ref.set({ nextAt: nextMorning44(), lastError: 'hết van hôm nay — chờ sáng mai' }, { merge: true }); }
      else if (await taskRunning44(d.id)) { await d.ref.set({ nextAt: nowMs() + 30 * 60000 }, { merge: true }); return false; }
      else {
        await db().collection('outreach_tasks').doc(d.id + '__funnel').set({ leadId: d.id, name: th.name, brandName: th.brandName, brandCode: th.brandCode || th.brand, temp: th.temp, score: th.score, pid, adspower_id: acct.adspower_id || null, action: 'funnel', workerId: acct.workerId || '', payload: th.fpayload, status: 'queued', createdAt: FieldValue.serverTimestamp() });
        await d.ref.set({ taskStatus: 'queued', nextAt: nowMs() + 30 * 60000, reservedDay: dayKey() }, { merge: true });
        return true;
      }
    } else await d.ref.set({ active: false }, { merge: true });
  }
  const u = await usageOf(pid);
  if (u.react >= brandCaps(brand).react) return false; // LENH #44 (E-17): early-out theo van brand (đã min trần cứng), không còn CAPS toàn cục
  const leadsSnap = await db().collection('leads').where('brand', '==', brand.code).orderBy('detected_at', 'desc').limit(40).get();
  for (const ld of leadsSnap.docs) {
    const lead = ld.data(); lead.id = ld.id;
    if (lead.dropped) continue;
    if (lead.ai_scored === false) continue; // LENH #46: điểm tạm (AI chưa chấm) → máy không chạm tới khi AI chấm lại
    if (humanBusy44(lead, brand)) continue; // LENH #44 (R-1): người thật đang chăm/đã hẹn/đã chốt/không thành → máy không chạm
    if ((lead.temp || 'cold') === 'junk') continue;
    const tref = threads.doc(lead.id);
    if ((await tref.get()).exists) continue;
    { const __rb = roleBlockOf(lead); if (__rb) { await skipLeadRole(lead, brand, acct, __rb); continue; } } /* v-selfcmt */
    if (!parsePost(lead.post_url).post_id) continue;
    if (await apEnqueueFunnel(acct, brand, lead, tref)) return true;
  }
  return false;
}
export const outreachTick = onSchedule({ schedule: 'every 5 minutes', region: REGION, timeZone: 'Asia/Ho_Chi_Minh', timeoutSeconds: 300, maxInstances: 1, memory: '512MiB' }, async () => {
  if (!inHours()) return;
  const now = nowMs();
  const brandsSnap = await db().collection('brands').get();
  const brandMap = {};
  brandsSnap.docs.forEach(d => { const b = Object.assign({ code: d.id }, d.data()); if (b.outreach && b.outreach.on) brandMap[b.code] = b; });
  if (!Object.keys(brandMap).length) return;
  // v120-scale P2: CHỈ nạp nick TỚI HẠN (active + nextFreeAt<=now), FIFO theo nextFreeAt — KHÔNG đọc hết fb_accounts, KHÔNG tuần tự → hết timeout + hết starvation đuôi.
  const BATCH = 800;
  const dueSnap = await db().collection('fb_accounts')
    .where('active', '==', true).where('nextFreeAt', '<=', now)
    .orderBy('nextFreeAt', 'asc').limit(BATCH).get();
  const dueAll = dueSnap.docs.map(d => Object.assign({ id: d.id }, d.data())).filter(a => brandMap[a.brand]);
  // LENH #44 (E-16): nick có cờ (needLogin / safetyPaused / checkpoint) KHÔNG xếp việc; đẩy nextFreeAt +1h để không chiếm batch mỗi tick (web "✓ Đã xử lý" đặt nextFreeAt:0 → chạy ngay)
  const due = dueAll.filter(a => !nickFlag44(a));
  for (const a of dueAll) { if (nickFlag44(a)) { try { await db().collection('fb_accounts').doc(a.id).set({ nextFreeAt: now + 60 * 60000 }, { merge: true }); } catch (_) { } } }
  // LENH #44 (R-6): sweeper thread mồ côi + giám sát system_status/outreach (chạy cả khi không nick nào tới hạn)
  try { await sweep44(brandMap, now); } catch (e) { console.error('[outreach] sweep44', e && e.message); }
  if (!due.length) return;
  const CONC = 25;
  let idx = 0;
  const runOne = async () => {
    while (idx < due.length) {
      const acct = due[idx++];
      const brand = brandMap[acct.brand];
      const pid = acct.id;
      let acted = false;
      try { acted = await (acct.engine === 'adspower' ? stepNickAdspower : stepNick)(brand, acct); }
      catch (e) { console.error('[outreach] step', pid, e && e.message); }
      const gap = acted ? (GAP_MIN_MS + Math.floor(Math.random() * GAP_RAND_MS)) : (rand(20, 40) * 60 * 1000);
      try { await db().collection('fb_accounts').doc(pid).set({ nextFreeAt: now + gap }, { merge: true }); } catch (_) { }
    }
  };
  await Promise.all(Array.from({ length: Math.min(CONC, due.length) }, runOne));
});

export const funcWebhook = onRequest({ cors: true, region: REGION }, async (req, res) => { return res.json({ ok: true }); });

/* LENH #32 (06/09/2026): post_url có sẵn "?" → worker không định vị được comment (rớt lead-comment). */
function commentUrlOf(lead, cid) {
  let u = commentUrlOf0(lead, cid);
  if (typeof u === 'string') { const q = u.indexOf('?'); if (q >= 0) u = u.slice(0, q + 1) + u.slice(q + 1).replace(/\?/g, '&'); }
  return u;
}
export { stepNickAdspower, apEnqueueFunnel, brandCaps };
