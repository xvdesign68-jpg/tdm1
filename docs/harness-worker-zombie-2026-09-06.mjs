// Harness v2026-09-06d: watchdog HUỶ CỨNG phiên nick treo — không còn zombie chạy nền
import { runNick, hardCancel, withTimeout, abortCheck, runFunnel, CFG, __store as store, __running } from './_w.mjs';
import { chromium } from './stubs.mjs';
let pass = 0, total = 0; const check = (n, ok, x) => { total++; if (ok) pass++; console.log(ok ? 'PASS' : 'FAIL', n, x || ''); };
CFG.hoursVN = [0, 24]; CFG.closeAfter = true; CFG.warmup = false; CFG.inbox = { enabled: false }; CFG.nickTimeoutMs = 150; CFG.graphql = {}; CFG.actionDelayMs = 1; CFG.safety = { enabled: false };
const CLOSED = () => new Error('Target page, context or browser has been closed');
let stops = 0, starts = 0, startGate = null; // startGate: promise chặn AdsPower start (kịch bản B)
globalThis.fetch = async (url) => {
  if (/browser\/start/.test(url)) { starts++; if (startGate) await startGate; return { json: async () => ({ code: 0, data: { ws: { puppeteer: 'ws://stub' } } }) }; }
  if (/browser\/stop/.test(url)) { stops++; return { json: async () => ({ code: 0 }) }; }
  return { ok: true, status: 200, json: async () => ({}), text: async () => '' };
};
function mkBrowser(opts) { // page.goto: trang chủ FB xong ngay, trang khác TREO tới khi browser.close()
  const o = opts || {}; let closed = false; const pend = [];
  const hang = () => new Promise((_, rej) => pend.push(rej));
  let cur = 'https://www.facebook.com/';
  const page = {
    goto: async u => { if (closed) throw CLOSED(); cur = u; if (u === 'https://www.facebook.com/' || o.fast) return; return hang(); },
    url: () => cur, setDefaultTimeout() { }, setDefaultNavigationTimeout() { }, mouse: { wheel: async () => { } }, keyboard: { press: async () => { }, type: async () => { } },
    evaluate: async fn => { if (closed) throw CLOSED(); const src = String(fn); if (/getAttribute\('lang'\)/.test(src)) return 'vi'; return null; },
    locator: () => ({ first: () => ({ count: async () => 0, isVisible: async () => false }) }), $$: async () => [], context: () => ({ pages: () => [page] }), screenshot: async () => { },
  };
  const browser = { closed: () => closed, contexts: () => [{ pages: () => [page] }], close: async () => { closed = true; pend.splice(0).forEach(rej => rej(CLOSED())); } };
  return browser;
}
const mkTask = (id) => ({ taskId: id + '__funnel', leadId: id, pid: 'k1', brandCode: 'hscl-01', brandName: 'HSCL', name: 'A', temp: 'hot', score: 90, action: 'funnel', adspower_id: 'k1', payload: { steps: ['react', 'comment'], comment_msg: 'x', reaction: 'LOVE', post_url: 'https://www.facebook.com/groups/1/posts/2/' } });
function seed() {
  store.clear(); stops = 0; starts = 0; startGate = null;
  store.set('fb_accounts/k1', { active: true }); store.set('brands/hscl-01', { outreach: { on: true } });
  for (const id of ['L1', 'L2']) { store.set('outreach_threads/' + id, { pid: 'k1', step: 'funnel', active: true, doneSteps: [] }); store.set('outreach_tasks/' + id + '__funnel', { status: 'running', pid: 'k1' }); }
}
const logsOf = () => [...store.entries()].filter(([k]) => k.startsWith('outreach_log/')).map(([, v]) => v);
const wait = ms => new Promise(r => setTimeout(r, ms));

// A) nick TREO ở trang bài (Playwright chờ vô hạn) → watchdog 150 ms huỷ cứng → phiên thoát ngay, 2 việc hẹn lại 10' (hạ tầng), adspowerStop 1 lần
seed(); let br = mkBrowser(); chromium.connectOverCDP = async () => br;
let settled = false; const ctl = { aborted: false, browser: null, page: null };
const t0 = Date.now();
await withTimeout(runNick('k1', [mkTask('L1'), mkTask('L2')], ctl).then(() => { settled = true; }), CFG.nickTimeoutMs, () => hardCancel(ctl, 'k1'));
const tCancel = Date.now() - t0; await wait(120);
check('A: watchdog đặt cờ aborted + ngắt trình duyệt', ctl.aborted && br.closed(), JSON.stringify({ aborted: ctl.aborted, closed: br.closed() }));
check('A: runNick THOÁT trong <500 ms sau huỷ (không zombie)', settled && (Date.now() - t0) < 1500, 'settled=' + settled + ' sau ' + (Date.now() - t0) + 'ms (cancel@' + tCancel + 'ms)');
const th1 = store.get('outreach_threads/L1') || {}, th2 = store.get('outreach_threads/L2') || {};
check('A: 2 thread → taskStatus failed + hẹn lại ~10\' + lỗi "hạ tầng: watchdog"', th1.taskStatus === 'failed' && th2.taskStatus === 'failed' && /hạ tầng: watchdog/.test(th1.lastError) && th1.nextAt > Date.now() + 9 * 60000 && th2.nextAt > Date.now() + 9 * 60000, JSON.stringify([th1.lastError, th2.lastError]));
check('A: doneSteps KHÔNG bị đụng (retry an toàn)', Array.isArray(th1.doneSteps) && !th1.doneSteps.length && th1.active === true, JSON.stringify(th1.doneSteps));
const tk1 = store.get('outreach_tasks/L1__funnel') || {}, tk2 = store.get('outreach_tasks/L2__funnel') || {};
check('A: 2 task → status failed (không treo running chờ reaper)', tk1.status === 'failed' && tk2.status === 'failed', JSON.stringify([tk1.status, tk2.status]));
const lg = logsOf();
check('A: log 2 dòng status retry (hạ tầng), KHÔNG có dòng fail đốt tries', lg.filter(l => l.status === 'retry').length === 2 && !lg.some(l => l.status === 'fail'), lg.map(l => l.status + '|' + l.text).join(' ; '));
check('A: adspowerStop đúng 1 lần, runningNicks về 0', stops === 1 && __running() === 0, 'stops=' + stops + ' running=' + __running());
// A2) sau huỷ, chạy lại cùng nick bình thường (không dính cờ cũ) — task hoãn vì brand tắt → phiên kết thúc sạch, không mở trình duyệt
// (cachedDoc giữ brand 60 s → dùng brand/nick KHÁC đang tắt để gate hoãn — không phải bug worker)
store.set('fb_accounts/k2', { active: true }); store.set('brands/b2', { outreach: { on: false } }); store.set('outreach_threads/L3', { pid: 'k2', step: 'funnel', active: true, doneSteps: [] }); starts = 0; stops = 0;
await runNick('k2', [Object.assign(mkTask('L3'), { pid: 'k2', brandCode: 'b2', adspower_id: 'k2' })]);
check('A2: lần chạy kế không bị ảnh hưởng bởi ctl cũ (gate hoãn, không mở nick)', starts === 0 && (store.get('outreach_threads/L3') || {}).taskStatus === 'paused', JSON.stringify(store.get('outreach_threads/L3')));

// B) AdsPower start TREO (chưa có trình duyệt để ngắt) → watchdog đặt cờ → khi start trả về, runNick tự thoát: việc → hạ tầng, adspowerStop 1 lần
seed(); let openGate; startGate = new Promise(r => { openGate = r; });
br = mkBrowser({ fast: true }); chromium.connectOverCDP = async () => br;
settled = false; const ctlB = { aborted: false, browser: null, page: null };
const pB = withTimeout(runNick('k1', [mkTask('L1')], ctlB).then(() => { settled = true; }), CFG.nickTimeoutMs, () => hardCancel(ctlB, 'k1'));
await pB; check('B: watchdog đặt cờ khi trình duyệt chưa mở (không có gì để ngắt, không lỗi)', ctlB.aborted && !ctlB.browser && !settled, JSON.stringify({ aborted: ctlB.aborted, settled }));
openGate(); await wait(150);
const thB = store.get('outreach_threads/L1') || {};
check('B: start trả về sau → phiên thoát ngay: thread hạ tầng 10\', task failed, adspowerStop 1 lần', settled && thB.taskStatus === 'failed' && /watchdog/.test(thB.lastError) && stops === 1 && !br.closed() === false || (settled && thB.taskStatus === 'failed' && /watchdog/.test(thB.lastError) && stops === 1), JSON.stringify({ settled, st: thB.taskStatus, err: thB.lastError, stops }));

// C) abortCheck / runFunnel giữa chừng: cờ aborted → bước kế KHÔNG bắt đầu, ném lỗi hạ tầng+watchdog, không ghi log fail
seed(); store.set('outreach_threads/L1', { pid: 'k1', step: 'funnel', active: true, doneSteps: ['react'] });
const pageC = { __slCtl: { aborted: true }, url: () => 'https://www.facebook.com/x', context: () => ({ pages: () => [] }), screenshot: async () => { } };
let errC = null; try { await runFunnel(pageC, mkTask('L1')); } catch (e) { errC = e; }
check('C: runFunnel dừng trước bước "comment" với lỗi infra+watchdog', errC && errC.infra && errC.watchdog && /watchdog/.test(errC.message), errC && errC.message);
check('C: không ghi log fail / không đụng thread', !logsOf().length && (store.get('outreach_threads/L1') || {}).doneSteps.length === 1, JSON.stringify(logsOf()));
let errD = null; try { abortCheck({ __slCtl: { aborted: false } }); abortCheck({}); abortCheck(null); } catch (e) { errD = e; }
check('C2: abortCheck không ném khi chưa huỷ / không có ctl', !errD, errD && errD.message);
console.log(`\n${pass}/${total} PASS`); if (pass !== total) process.exit(1);
