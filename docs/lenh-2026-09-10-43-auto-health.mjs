/* LỆNH #43 — CHỈ ĐỌC: đo "sức khoẻ" mảng automation Tiếp cận (engine + worker + nội dung) từ Firestore.
   Đặt trong ~/firebase-s13/functions (có firebase-admin). Không ghi gì. Không in secret.
   Dùng: node _auto_health.mjs [--days=7] [--brand=hscl-01]                                        (10/09/2026) */
import admin from 'firebase-admin';
if (!admin.apps.length) admin.initializeApp();
const db = admin.firestore();
const arg = k => { const a = process.argv.find(x => x.startsWith('--' + k + '=')); return a ? a.split('=').slice(1).join('=') : null; };
const DAYS = Math.max(1, Number(arg('days')) || 7), ONLY = arg('brand') || '';
const H = 3600e3, D = 24 * H, now = Date.now(), since = now - DAYS * D;
const toMs = v => !v ? 0 : (v.toMillis ? v.toMillis() : (v._seconds ? v._seconds * 1000 : (typeof v === 'number' ? v : (Date.parse(v) || 0))));
const vn = ms => ms ? new Date(ms + 7 * H).toISOString().slice(5, 16).replace('T', ' ') : '—';
const ago = ms => !ms ? '—' : (now - ms < H ? Math.round((now - ms) / 60000) + '′' : now - ms < D ? Math.round((now - ms) / H) + 'h' : Math.round((now - ms) / D) + 'd');
const dayVN = ms => new Date(ms + 7 * H).toISOString().slice(0, 10);
const inc = (o, k, n = 1) => { o[k] = (o[k] || 0) + n; return o; };
const top = (o, n = 8) => Object.entries(o).sort((a, b) => b[1] - a[1]).slice(0, n).map(([k, v]) => `${k}=${v}`).join(' · ') || '—';
const pct = (a, b) => b ? Math.round(a / b * 100) + '%' : '—';
const sec = t => console.log('\n=== ' + t + ' ===');
const safe = async (t, f) => { try { await f(); } catch (e) { console.log('  (lỗi mục này: ' + String(e && e.message || e).slice(0, 140) + ')'); } };
console.log(`LỆNH #43 auto-health · ${vn(now)} VN · cửa sổ ${DAYS} ngày${ONLY ? ' · brand ' + ONLY : ''}`);

// 1) VPS
const workers = {};
await safe('VPS', async () => { sec('1) VPS worker'); const s = await db.collection('workers').get();
  s.forEach(d => { const x = d.data() || {}; workers[d.id] = x; const ls = toMs(x.lastSeen); const on = x.online && now - ls < 2 * 60000;
    console.log(`  ${on ? '🟢' : '🔴'} ${d.id} v${x.version || '?'} · lastSeen ${ago(ls)} · chạy ${x.running || 0}/${x.maxConcurrent || '?'} · RAM ${x.ramUsedPct || '?'}% · paused=${!!x.paused} · inboxCheck=${!!x.inboxCheck}`); });
  if (s.empty) console.log('  (chưa có VPS nào báo heartbeat)'); });

// 2) Brand automation + nick
const brands = {}, nicks = {}; const nickByBrand = {};
await safe('brand/nick', async () => { sec('2) Brand bật automation ↔ nick sống');
  (await db.collection('brands').get()).forEach(d => { brands[d.id] = d.data() || {}; });
  (await db.collection('fb_accounts').get()).forEach(d => { const x = d.data() || {}; nicks[d.id] = x; (nickByBrand[x.brand || ''] = nickByBrand[x.brand || ''] || []).push(Object.assign({ id: d.id }, x)); });
  for (const [code, b] of Object.entries(brands)) { if (ONLY && code !== ONLY) continue; const o = b.outreach || {}; const ns = nickByBrand[code] || [];
    const alive = ns.filter(n => n.active !== false && !n.needLogin && !n.safetyPaused && !n.challenge);
    const w = alive.filter(n => n.engine === 'adspower' && n.workerId && workers[n.workerId] && workers[n.workerId].online);
    const flag = o.on && !alive.length ? '  ⚠ BẬT nhưng 0 nick sống' : (o.on && alive.length && !w.length && alive.some(n => n.engine === 'adspower') ? '  ⚠ nick sống nhưng VPS offline/chưa gán' : '');
    const caps = o.caps || {}; const mx = o.matrix ? 'tuỳ chỉnh' : 'mặc định';
    console.log(`  ${o.on ? 'BẬT ' : 'tắt '} ${code.padEnd(16)} nick ${alive.length}/${ns.length} sống · ma trận ${mx} · van ${caps.react || 40}/${caps.comment || 12}/${caps.friend || 10}/${caps.inbox || 8} · nội dung ${(b.content && b.content.mode) || (b.ai ? 'ai(hồ sơ AI)' : 'reply')}${o.immediate ? ' · ⚡ngay' : ''}${flag}`); }
  sec('2b) Nick'); for (const [id, x] of Object.entries(nicks)) { if (ONLY && x.brand !== ONLY) continue;
    const st = x.active === false ? 'TẮT' : x.needLogin ? 'needLogin' : x.safetyPaused ? 'safetyPaused' : x.challenge ? 'checkpoint:' + x.challenge : 'OK';
    console.log(`  ${st.padEnd(14)} ${id} ${(x.label || '').slice(0, 18).padEnd(18)} ${x.engine || 'func'} brand=${x.brand || '—'} vps=${x.workerId || '—'} safety=${x.safety == null ? '—' : x.safety} ok/fail=${x.okCount || 0}/${x.failCount || 0} nl=${x.needLoginTotal || 0} cp=${x.challengeTotal || 0} lang=${x.uiLang || '?'} nextFree=${ago(Number(x.nextFreeAt) || 0)} replyCheck=${ago(Number(x.replyCheckAt) || 0)}/${x.replyFound || 0}`); } });

// 3) Task
await safe('task', async () => { sec('3) outreach_tasks'); const s = await db.collection('outreach_tasks').select('status', 'workerId', 'createdAt', 'startedAt', 'brandCode', 'pid', 'action', 'lastError').get();
  const st = {}, byW = {}, orphan = {}; let oldestQ = 0, runOld = 0, n = 0;
  s.forEach(d => { const x = d.data() || {}; if (ONLY && x.brandCode !== ONLY) return; n++; inc(st, x.status || '?'); const c = toMs(x.createdAt);
    if (x.status === 'queued') { inc(byW, x.workerId || '(chưa gán)'); if (!oldestQ || c < oldestQ) oldestQ = c; const w = workers[x.workerId]; if (!w || !w.online) inc(orphan, x.workerId || '(chưa gán)'); }
    if (x.status === 'running' && now - toMs(x.startedAt) > 30 * 60000) runOld++; });
  console.log(`  tổng ${n} · ${top(st)}`); console.log(`  queued theo VPS: ${top(byW)} · queued chờ VPS offline/chưa gán: ${top(orphan)} · queued cũ nhất ${ago(oldestQ)} · running >30′: ${runOld}`); });

// 4) Thread
const threads = []; const threadByLead = new Set();
await safe('thread', async () => { sec('4) outreach_threads'); const s = await db.collection('outreach_threads').get();
  const step = {}, ts = {}, stuck = [], deadN = { n: 0 }, byNickDead = {}, doneMix = {}; let active = 0, replied = 0, cl = 0;
  s.forEach(d => { const x = d.data() || {}; if (ONLY && (x.brandCode || x.brand) !== ONLY) return; threads.push(Object.assign({ id: d.id }, x)); threadByLead.add(d.id);
    inc(step, (x.step || '?') + (x.active ? '·active' : '')); inc(ts, x.taskStatus || '?'); if (x.active) active++; if (x.replied) replied++; if (x.fpayload && x.fpayload.kind === 'comment') cl++;
    (x.doneSteps || []).forEach(k => inc(doneMix, k)); if ((x.tries || 0) >= 5) deadN.n++;
    const nk = nicks[x.pid] || {}; if (x.active && (nk.active === false || nk.needLogin || nk.safetyPaused)) inc(byNickDead, x.pid || '?');
    if (x.active && Number(x.nextAt) && now - Number(x.nextAt) > 2 * H) stuck.push({ id: d.id, pid: x.pid, step: x.step, task: x.taskStatus, wait: ago(Number(x.nextAt)), err: String(x.lastError || '').slice(0, 70) }); });
  console.log(`  tổng ${threads.length} · active ${active} · replied ${replied} · comment-lead ${cl} · tries≥5 (chết) ${deadN.n}`);
  console.log(`  step: ${top(step, 12)}`); console.log(`  taskStatus: ${top(ts)}`); console.log(`  bước đã làm: ${top(doneMix)}`);
  console.log(`  thread ACTIVE trên nick TẮT/needLogin/safetyPaused (kẹt, cần _l34_move hoặc đăng nhập lại): ${top(byNickDead)}`);
  console.log(`  thread active quá hạn nextAt >2h (không ai chạy): ${stuck.length}`); stuck.slice(0, 8).forEach(x => console.log(`    ${x.id} nick=${x.pid} step=${x.step} task=${x.task} quá ${x.wait}${x.err ? ' · ' + x.err : ''}`)); });

// 5) Van hôm nay: usage (reserve) vs stats (done) vs cap brand
await safe('van', async () => { sec('5) Van hôm nay (usage = engine reserve · stats = worker đã làm)'); const day = dayVN(now);
  const us = await db.collection('outreach_usage').get(); const st = await db.collection('outreach_stats').where('day', '==', day).get(); const stB = {};
  st.forEach(d => { const x = d.data() || {}; stB[x.brandCode] = x; });
  us.forEach(d => { if (!d.id.endsWith('__' + day)) return; const x = d.data() || {}; const pid = d.id.split('__')[0]; const nk = nicks[pid] || {}; if (ONLY && nk.brand !== ONLY) return;
    const b = brands[nk.brand] || {}; const caps = (b.outreach || {}).caps || {}; const neg = ['react', 'comment', 'friend', 'inbox'].filter(k => Number(x[k]) < 0);
    console.log(`  ${pid} (${nk.brand || '—'}): reserve react ${x.react || 0}/${caps.react || 40} · comment ${x.comment || 0}/${caps.comment || 12} · friend ${x.friend || 0}/${caps.friend || 10} · inbox ${x.inbox || 0}/${caps.inbox || 8}${neg.length ? '  ⚠ ÂM: ' + neg.join(',') + ' (refund quá tay)' : ''}`); });
  for (const [code, x] of Object.entries(stB)) { if (ONLY && code !== ONLY) continue; console.log(`  stats ${code}: react ${x.react || 0} · comment ${x.comment || 0} · friend ${x.friend || 0} · inbox ${x.inbox || 0} · replied ${x.replied || 0}`); }
  if (us.empty) console.log('  (chưa có usage hôm nay — engine chưa reserve bước nào)'); });

// 6) Log N ngày
await safe('log', async () => { sec(`6) outreach_log ${DAYS} ngày`); const s = await db.collection('outreach_log').where('at', '>=', admin.firestore.Timestamp.fromMillis(since)).orderBy('at', 'desc').limit(3000).get();
  const st = {}, byB = {}, failWhy = {}, skipWhy = {}, pauseWhy = {}, act = {}; let n = 0;
  s.forEach(d => { const x = d.data() || {}; if (ONLY && x.brandCode !== ONLY) return; n++; inc(st, x.status || '?'); inc(byB, x.brandCode || '—');
    const a = String(x.action || ''); const cat = /cảm xúc/.test(a) ? 'react' : /[Bb]ình luận/.test(a) ? 'comment' : /kết bạn/.test(a) ? 'friend' : /[Ii]nbox/.test(a) ? 'inbox' : /[Pp]hễu/.test(a) ? 'funnel' : /phản hồi/.test(a) ? 'reply' : 'khác';
    inc(act, cat + ':' + (x.status || '?'));
    if (x.status === 'fail' || x.status === 'error') inc(failWhy, (a.replace(/ thất bại.*$/, '') + ' | ' + String(x.text || '').slice(0, 50)).slice(0, 90));
    if (x.status === 'skip') inc(skipWhy, a.slice(0, 80)); if (x.status === 'paused') inc(pauseWhy, a.slice(0, 70)); });
  console.log(`  ${n} dòng (trần 3000) · ${top(st)}`); console.log(`  theo brand: ${top(byB)}`); console.log(`  theo bước·trạng thái: ${top(act, 14)}`);
  console.log(`  lý do FAIL: ${top(failWhy, 6)}`); console.log(`  lý do SKIP: ${top(skipWhy, 5)}`); console.log(`  lý do PAUSED: ${top(pauseWhy, 5)}`); });

// 7) Lead: máy đã chạm, phản hồi, chồng người thật, backlog chưa chạm
await safe('lead', async () => { sec(`7) Lead ${DAYS} ngày: máy chạm · phản hồi · chồng lấn người thật · backlog`);
  const touched = await db.collection('leads').where('outreach.at', '>=', since).select('brand', 'temp', 'stage', 'assignee', 'first_care_at', 'outreach', 'outreach_replied', 'detected_at', 'dropped', 'lost', 'role').get();
  const byB = {}, tempMix = {}, steps = {}; let n = 0, replied = 0, inboxed = 0, human = 0, dropped = 0, roleBad = 0, meta = 0, lag = [];
  touched.forEach(d => { const x = d.data() || {}; if (ONLY && x.brand !== ONLY) return; n++; inc(byB, x.brand || '—'); inc(tempMix, x.temp || '?'); const o = x.outreach || {}; (o.steps || []).forEach(k => inc(steps, k));
    if (o.inbox_at || (o.steps || []).includes('inbox')) inboxed++; if (x.outreach_replied || o.replied_at || x.stage === 'responded') replied++;
    if (Number(x.first_care_at) && Number(x.first_care_at) < Number(o.at || 0)) human++; if (x.dropped || x.lost) dropped++; if (x.role === 'seller' || x.role === 'poster_self') roleBad++; if (o.content && o.content.v) meta++;
    const det = toMs(x.detected_at); if (det && o.at) lag.push((Number(o.at) - det) / H); });
  lag.sort((a, b) => a - b); const med = lag.length ? lag[Math.floor(lag.length / 2)] : null;
  console.log(`  máy đã chạm ${n} lead · theo brand ${top(byB)} · nhiệt ${top(tempMix)} · bước ${top(steps)}`);
  console.log(`  đã inbox ${inboxed} · khách phản hồi ${replied} (${pct(replied, inboxed)} trên đã inbox) · có meta nội dung ${meta} · đã loại/không thành ${dropped} · vai người bán/chủ bài bị chạm ${roleBad}${roleBad ? ' ⚠' : ''}`);
  console.log(`  người thật đã chăm TRƯỚC khi máy chạm: ${human} (${pct(human, n)}) · trễ phát hiện→máy chạm trung vị ${med == null ? '—' : med.toFixed(1) + 'h'}`);
  // backlog: brand bật → lead 7 ngày chưa có thread
  for (const [code, b] of Object.entries(brands)) { if (!(b.outreach || {}).on || (ONLY && code !== ONLY)) continue;
    const ls = await db.collection('leads').where('brand', '==', code).orderBy('detected_at', 'desc').limit(300).select('temp', 'detected_at', 'dropped', 'lost', 'role', 'stage').get();
    const bl = {}; let oldestHot = 0, total = 0;
    ls.forEach(d => { const x = d.data() || {}; const det = toMs(x.detected_at); if (!det || det < since) return; if (x.dropped || x.lost || x.temp === 'junk' || x.role === 'seller' || x.role === 'poster_self') return; total++;
      if (threadByLead.has(d.id)) return; inc(bl, x.temp || '?'); if (x.temp === 'hot' && (!oldestHot || det < oldestHot)) oldestHot = det; });
    console.log(`  backlog ${code}: ${total} lead hợp lệ ${DAYS} ngày (mẫu 300 mới nhất) · CHƯA có thread: ${top(bl)}${oldestHot ? ' · lead nóng chưa chạm cũ nhất ' + ago(oldestHot) : ''}`); } });

// 8) content_stats
await safe('content', async () => { sec('8) content_stats (hiệu quả nội dung, máy chủ đếm cộng dồn)'); const s = await db.collection('content_stats').get();
  s.forEach(d => { const x = d.data() || {}; if (ONLY && (x.brandCode || d.id) !== ONLY) return; const a = x.all || {};
    const dim = k => Object.entries(x[k] || {}).map(([kk, v]) => `${kk} ${v.rep || 0}/${v.sent || 0}`).join(' · ') || '—';
    console.log(`  ${d.id}: sent ${a.sent || 0} · rep ${a.rep || 0} (${pct(a.rep || 0, a.sent || 0)}) · tagged ${a.tagged || 0}`); console.log(`    mode: ${dim('mode')} | style: ${dim('style')} | parent: ${dim('parent')} | cta: ${dim('cta')} | variant: ${dim('variant')}`); });
  if (s.empty) console.log('  (chưa có doc — CF statsOnLead LỆNH #36 chưa đếm được lead nào có inbox_at)'); });
console.log('\nXONG — gửi em nguyên output.');
