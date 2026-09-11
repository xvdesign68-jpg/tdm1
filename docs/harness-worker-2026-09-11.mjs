// Harness worker 2026-09-11 (Đợt 1 automation): R-15 · R-9 · R-8 · R-2 · dryRun · pre-flight R-1 · W-6/W-11/W-13/E-5
// Chạy: cd wk11 && node mk.mjs && node t11.mjs   (cần _w.mjs sinh từ worker.mjs 2026-09-11 + stubs.mjs in-memory Firestore)
import { runFunnel, checkReplies, gqlComment, domComment, safetyRecalc, onFail, onNeedLogin, refundQuota, preflight, onHuman, humanBusy, dryFunnel, replyLoop, requestStop, tick, tickLoop, nextMorningVN, runNick, execOnPage, claimBatch,
  CFG, __store as store, __setExit, __stopping, __setStopping, __running, __busy, __replyBusy, __setEffMax, activeProfiles, readingProfiles } from './_w.mjs';
import { chromium } from './stubs.mjs';
let pass = 0, total = 0; const check = (n, ok, x) => { total++; if (ok) pass++; console.log(ok ? 'PASS' : 'FAIL', n, x == null ? '' : (typeof x === 'string' ? x : JSON.stringify(x))); };
const wait = ms => new Promise(r => setTimeout(r, ms));
const logsOf = () => [...store.entries()].filter(([k]) => k.startsWith('outreach_log/')).map(([, v]) => v);
CFG.hoursVN = [0, 24]; CFG.actionDelayMs = 1; CFG.warmup = false; CFG.closeAfter = true; CFG.nickTimeoutMs = 5000; CFG.safety = { enabled: true, pauseBelow: 30, slowBelow: 60 };
CFG.graphql = { reactDocId: 'R1', commentDocId: 'C1', replyDocId: 'C1', friendDocId: 'F1' }; CFG.inbox = { enabled: true, maxThreads: 5, everyMin: 60, days: 7, backoffH: [1, 3, 6, 12, 24] }; CFG.dryRun = false; CFG.replyLoop = true; CFG.requireViUI = false;
let exits = 0; __setExit(() => { exits++; });
const T = (id, extra) => Object.assign({ taskId: id + '__funnel', leadId: id, pid: 'k1', brandCode: 'hscl-01', brandName: 'HSCL', name: 'A', temp: 'hot', score: 90, action: 'funnel', adspower_id: 'k1',
  payload: { steps: ['react', 'comment'], comment_msg: 'Chào anh, bên em có sẵn hàng nhé', inbox_msg: 'Chào anh', reaction: 'LOVE', post_url: 'https://www.facebook.com/groups/1733640124552320/posts/1234567890/' } }, extra || {});
const DAY = () => new Date(Date.now() + 7 * 3600e3).toISOString().slice(0, 10);

/* ---------- page mock "canned": evaluate theo chữ ký mã nguồn, fbGraphql theo hook ---------- */
function mkPage(o) {
  o = o || {}; let cur = 'https://www.facebook.com/'; const calls = { gql: [], dom: [], typed: [], enter: 0 };
  const locCount = sel => (o.visible ? o.visible(sel) : 0);
  const el = sel => ({ count: async () => locCount(sel), isVisible: async () => true, click: async () => { calls.dom.push('click:' + sel.slice(0, 40)); }, scrollIntoViewIfNeeded: async () => { }, innerText: async () => o.boxText ? o.boxText() : '', hover: async () => { }, filter: () => el(sel), locator: () => el(sel) });
  const page = {
    calls, goto: async u => { cur = u; page.visited.push(u); if (o.onGoto) await o.onGoto(u); }, url: () => cur, visited: [],
    locator: sel => ({ first: () => el(sel), filter: () => ({ first: () => el(sel) }) }), getByText: () => ({ first: () => ({ count: async () => (o.textFound ? 1 : 0) }) }),
    $$: async () => [], keyboard: { type: async t => { calls.typed.push(t); }, press: async k => { if (k === 'Enter') calls.enter++; }, down: async () => { }, up: async () => { } },
    context: () => ({ pages: () => [page] }), screenshot: async () => { }, mouse: { wheel: async () => { } }, setDefaultTimeout() { }, setDefaultNavigationTimeout() { },
    evaluate: async (fn, arg) => {
      const src = String(fn);
      if (src.includes('fb_api_req_friendly_name')) { calls.gql.push(arg); return o.gql ? o.gql(arg, calls.gql.length) : { ok: false, hasErr: true, sample: 'err' }; }
      if (src.includes('CurrentUserInitialData')) return '100013727043931';
      if (src.includes('DTSGInitialData')) return 'DTSG';
      if (src.includes("getAttribute('lang')")) return 'vi';
      if (src.includes('al:android:url')) return (o.uidByUrl || {})[cur] || null;
      if (src.includes('NodeFilter.SHOW_TEXT')) return !!o.posted; // verifyCommentPosted
      if (src.includes('data-sl-cbox')) return o.cboxPick ? o.cboxPick() : null; // domComment pick
      if (src.includes('cidRe')) return { base: true, cid: true, txt: '' }; // waitForContent
      if (src.includes('bạn đã gửi')) { const m = cur.match(/messages\/t\/(\d+)/); return (m && (o.replyByUid || {})[m[1]]) || { ok: false }; }
      if (src.includes('role="dialog"')) return ''; // detectChallengeStrict zones
      if (src.includes('document.body.innerText')) return '';
      return null;
    },
    evaluateHandle: async () => ({ asElement: () => null })
  };
  return page;
}
function seedThread(id, extra) { store.set('outreach_threads/' + id, Object.assign({ pid: 'k1', step: 'funnel', active: true, doneSteps: [], reservedDay: DAY() }, extra || {})); }
function seedBase() { store.clear(); store.set('fb_accounts/k1', { active: true, adspower_id: 'k1', brand: 'hscl-01', workerId: 'vps-1', safetyV: 2 }); store.set('brands/hscl-01', { outreach: { on: true } }); store.set('leads/L1', { brand: 'hscl-01', stage: 'new' }); store.set('outreach_usage/k1__' + DAY(), { react: 3, comment: 2, friend: 1, inbox: 1 }); }
const GQL_REACT = { ok: true, hasErr: false, data: { feedback_react: { feedback: { id: 'f1', reaction_count: 6 } } }, sample: 'ok' };
const GQL_FRIEND = { ok: true, hasErr: false, data: { friend_request_send: { friend_requestee: { id: 'u1' } } }, sample: 'ok' };
const GQL_AUTO = a => (/React/.test(a.friendlyName) ? GQL_REACT : /Friend/.test(a.friendlyName) ? GQL_FRIEND : GQL_OK);
const GQL_OK = { ok: true, hasErr: false, data: { comment_create: { feedback_comment_edge: { node: { id: 'c1' } } } }, sample: 'ok' };
const GQL_AMB = { ok: true, hasErr: false, data: { something: 1 }, sample: 'amb' };
const GQL_ERR = { ok: false, hasErr: true, data: null, sample: '{"errors":[{"code":1675012}]}' };

console.log('\n=== A. R-15 gqlComment: bộ biến capture 06/09 · fallback · ambiguous ===');
{
  const p = mkPage({ gql: () => GQL_OK });
  const r = await gqlComment(p, 'FB1', 'xin chào', '1733640124552320');
  const v = p.calls.gql[0].variables;
  check('A1 gid số: feedLocation POST_PERMALINK_DIALOG · feedbackSource 2 · groupID · feedback_source OBJECT · ORIGINAL', v.feedLocation === 'POST_PERMALINK_DIALOG' && v.feedbackSource === 2 && v.groupID === '1733640124552320' && v.input.feedback_source === 'OBJECT' && v.translationType === 'ORIGINAL' && v.__relay_internal__pv__CometUFICommentAutoTranslationTyperelayprovider === 'ORIGINAL', { fl: v.feedLocation, fs: v.feedbackSource, g: v.groupID, ifs: v.input.feedback_source, tt: v.translationType });
  check('A1 doc_id + text + kết quả ok/variant capture', p.calls.gql[0].docId === 'C1' && v.input.message.text === 'xin chào' && r.ok && !r.ambiguous && r.variant === 'capture', r);
  const p2 = mkPage({ gql: () => GQL_OK }); const r2 = await gqlComment(p2, 'FB2', 'hi', null); const v2 = p2.calls.gql[0].variables;
  check('A2 bài KHÔNG có gid số (slug/không nhóm): cùng bộ capture, KHÔNG có groupID', v2.feedLocation === 'POST_PERMALINK_DIALOG' && !('groupID' in v2) && v2.input.feedback_source === 'OBJECT' && r2.ok, { g: v2.groupID });
  const p3 = mkPage({ gql: (a, n) => (n === 1 ? GQL_ERR : GQL_OK) }); const r3 = await gqlComment(p3, 'FB3', 'hi', null); const v3b = p3.calls.gql[1].variables;
  check('A3 FB trả LỖI RÕ → thử đúng 1 lần bộ cũ (DEDICATED_COMMENTING_SURFACE/AUTO_TRANSLATE) → ok, variant legacy', p3.calls.gql.length === 2 && v3b.feedLocation === 'DEDICATED_COMMENTING_SURFACE' && v3b.translationType === 'AUTO_TRANSLATE' && r3.ok && r3.variant === 'legacy', { n: p3.calls.gql.length, r: r3 });
  const p3b = mkPage({ gql: (a, n) => (n === 1 ? GQL_ERR : GQL_OK) }); await gqlComment(p3b, 'FB3', 'hi', '99'); const v3c = p3b.calls.gql[1].variables;
  check('A3b bộ cũ với gid số = GROUP/PROFILE + groupID (đúng bộ 29/08)', v3c.feedLocation === 'GROUP' && v3c.input.feedback_source === 'PROFILE' && v3c.groupID === '99', v3c.feedLocation);
  const p4 = mkPage({ gql: () => GQL_AMB }); const r4 = await gqlComment(p4, 'FB4', 'hi', '1');
  check('A4 mơ hồ (200 không errors, không comment_create) → ambiguous, KHÔNG gọi lại (chống double)', p4.calls.gql.length === 1 && !r4.ok && r4.ambiguous === true, r4);
  const p5 = mkPage({ gql: (a, n) => GQL_ERR }); const r5 = await gqlComment(p5, 'FB5', 'hi', '1');
  check('A5 lỗi cả 2 bộ → ok=false, ambiguous=false → bên gọi rơi DOM', p5.calls.gql.length === 2 && !r5.ok && !r5.ambiguous, r5);
  CFG.graphql = {}; check('A6 graphql tắt → null (DOM như cũ)', (await gqlComment(mkPage({}), 'x', 'y', null)) === null); CFG.graphql = { reactDocId: 'R1', commentDocId: 'C1', replyDocId: 'C1', friendDocId: 'F1' };
}

console.log('\n=== B. runFunnel bình luận bài: ok → không DOM · mơ hồ+đã hiện → không DOM · mơ hồ+chưa hiện → DOM · execOnPage ===');
{
  seedBase(); seedThread('L1', { doneSteps: ['react'] });
  let p = mkPage({ gql: () => GQL_OK }); await runFunnel(p, T('L1'));
  let th = store.get('outreach_threads/L1');
  check('B1 API ok → thread done, doneSteps có comment, không bấm DOM', th.step === 'done' && th.doneSteps.includes('comment') && !p.calls.dom.length && p.calls.enter === 0, { dom: p.calls.dom, ds: th.doneSteps });
  seedBase(); seedThread('L1', { doneSteps: ['react'] });
  p = mkPage({ gql: () => GQL_AMB, visible: sel => /role="article"/.test(sel) ? 1 : 0 }); await runFunnel(p, T('L1'));
  th = store.get('outreach_threads/L1');
  const lg = logsOf().find(l => /Bình luận vào bài/.test(l.action) && l.status === 'done');
  check('B2 API mơ hồ + verifyComment thấy → done, KHÔNG gõ DOM, log ghi "API mơ hồ — đã thấy hiển thị"', th.step === 'done' && p.calls.enter === 0 && !p.calls.typed.length && lg && /API mơ hồ/.test(lg.text), { enter: p.calls.enter, text: lg && lg.text });
  seedBase(); seedThread('L1', { doneSteps: ['react'] });
  let opened = false;
  p = mkPage({ gql: () => GQL_AMB, visible: sel => (/aria-label="Bình luận"/.test(sel) ? 1 : (opened && /data-sl-cbox/.test(sel) ? 1 : 0)), cboxPick: () => (opened ? { how: 'focus', label: 'viết bình luận công khai…' } : null), boxText: () => '' });
  p.locator = (orig => sel => { const L = orig(sel); if (/aria-label="Bình luận"/.test(sel)) { const f = L.first(); const c = f.click; f.click = async (...a) => { opened = true; return c(...a); }; return { first: () => f }; } return L; })(p.locator);
  await runFunnel(p, T('L1'));
  th = store.get('outreach_threads/L1');
  check('B3 API mơ hồ + CHƯA hiện → DOM: bấm nút Bình luận, nhận ô theo focus, gõ + Enter → done', th.step === 'done' && p.calls.enter >= 1 && p.calls.typed.join('').includes('Chào anh') && p.calls.dom.some(d => /Bình luận/.test(d)), { enter: p.calls.enter, dom: p.calls.dom });
  seedBase(); seedThread('L1', { doneSteps: ['react'] });
  p = mkPage({ gql: () => GQL_ERR, visible: () => 0 });
  let err = null; try { await runFunnel(p, T('L1')); } catch (e) { err = e; }
  check('B4 API lỗi + DOM không thấy nút/ô → dừng phễu, failKind = ui (không trừ Safety), doneSteps giữ react', err && err.failKind === 'ui' && /không thấy ô Bình luận lẫn nút/.test(err.message) && store.get('outreach_threads/L1').doneSteps.join() === 'react', err && err.message);
  // execOnPage (task comment lẻ)
  seedBase(); seedThread('L1', { doneSteps: [] });
  p = mkPage({ gql: () => GQL_AMB, visible: sel => /role="article"/.test(sel) ? 1 : 0 });
  await execOnPage(p, { taskId: 'x', leadId: 'L1', pid: 'k1', action: 'comment', payload: { post_url: 'https://www.facebook.com/groups/1/posts/2/', message: 'Chào anh nhé' } });
  check('B5 execOnPage comment: API mơ hồ + đã hiện → không DOM', p.calls.enter === 0 && !p.calls.typed.length, p.calls);
}

console.log('\n=== C. R-8: doneSteps ghi TRƯỚC log — log lỗi vẫn không double ===');
{
  seedBase(); seedThread('L1', { doneSteps: [] });
  const p = mkPage({ gql: a => GQL_AUTO(a) });
  // stub: ghi outreach_log ném lỗi 1 lần đúng lúc log bước react
  const Col = Object.getPrototypeOf(store.constructor === Map ? {} : {}); // no-op
  const origAdd = (await import('./stubs.mjs')).db.collection('outreach_log').constructor.prototype.add;
  let boom = 1; (await import('./stubs.mjs')).db.collection('outreach_log').constructor.prototype.add = async function (data) { if (this.name === 'outreach_log' && boom-- > 0 && /cảm xúc/.test(data.action || '')) throw new Error('net'); return origAdd.call(this, data); };
  let err = null; try { await runFunnel(p, T('L1')); } catch (e) { err = e; }
  (await import('./stubs.mjs')).db.collection('outreach_log').constructor.prototype.add = origAdd;
  const th = store.get('outreach_threads/L1');
  check('C1 ghi log react LỖI → doneSteps ĐÃ có react (markDone trước) → retry sẽ bỏ qua react (không double)', th.doneSteps.includes('react'), { ds: th.doneSteps, err: err && err.message });
  seedBase(); seedThread('L1', { doneSteps: ['react'] });
  const p2 = mkPage({ gql: () => GQL_OK }); await runFunnel(p2, T('L1'));
  check('C2 retry: react đã xong → chỉ làm comment (1 gql), thread done', p2.calls.gql.length === 1 && store.get('outreach_threads/L1').step === 'done', p2.calls.gql.length);
}

console.log('\n=== D. R-9 Safety: onFail kind ui/fb/none · đếm theo phiên · needLogin 1 lần/phiên · decay đúng · di trú ===');
{
  seedBase(); seedThread('L1'); seedThread('L2');
  await onFail(T('L1', { __sess: 's1' }), 'không thấy nút Thích', { kind: 'ui' });
  let a = store.get('fb_accounts/k1');
  check('D1 kind ui → uiFailCount +1, failCount KHÔNG đổi, lastFailKind ui', a.uiFailCount === 1 && !a.failCount && a.lastFailKind === 'ui', a);
  await onFail(T('L1', { __sess: 's1' }), 'verify không ăn', { kind: 'fb' }); await onFail(T('L2', { __sess: 's1' }), 'verify không ăn', { kind: 'fb' });
  a = store.get('fb_accounts/k1');
  check('D2 kind fb ×2 cùng phiên → failCount +1 (đếm theo PHIÊN)', a.failCount === 1, a.failCount);
  await onFail(T('L2', { __sess: 's2' }), 'soft', { kind: 'fb' }); a = store.get('fb_accounts/k1');
  check('D3 phiên khác → failCount +1 nữa = 2', a.failCount === 2, a.failCount);
  await onFail(T('L1', { __sess: 's3' }), 'checkpoint:RATE_LIMIT'); a = store.get('fb_accounts/k1');
  check('D4 checkpoint:* mặc định kind none → không cộng gì', a.failCount === 2 && a.uiFailCount === 1, { f: a.failCount, u: a.uiFailCount });
  // needLogin 1 lần/phiên qua runNick loggedOut
  seedBase(); seedThread('L1'); seedThread('L2'); seedThread('L3');
  store.set('outreach_tasks/L1__funnel', { status: 'running' }); store.set('outreach_tasks/L2__funnel', { status: 'running' }); store.set('outreach_tasks/L3__funnel', { status: 'running' });
  globalThis.fetch = async url => (/browser\/(start|stop)/.test(String(url)) ? { json: async () => ({ code: 0, data: { ws: { puppeteer: 'ws://x' } } }) } : { ok: true, status: 200, json: async () => ({}), text: async () => '' });
  const pgL = mkPage({}); pgL.goto = async u => { pgL.visited.push(u); }; pgL.url = () => 'https://www.facebook.com/login.php';
  chromium.connectOverCDP = async () => ({ contexts: () => [{ pages: () => [pgL] }], close: async () => { } });
  await runNick('k1', [T('L1'), T('L2'), T('L3')]);
  a = store.get('fb_accounts/k1');
  check('D5 phiên đăng xuất với 3 việc → needLoginTotal 1, needLoginCount 1 (không ×3), 3 thread hẹn lại, 1 log', a.needLoginTotal === 1 && a.needLoginCount === 1 && a.needLogin === true && logsOf().filter(l => /đăng nhập lại/.test(l.action)).length === 1 && store.get('outreach_threads/L3').lastError === 'nick cần đăng nhập lại', { t: a.needLoginTotal, c: a.needLoginCount, logs: logsOf().length });
  // safetyRecalc: di trú + decay neo safetyDecayAt
  store.set('fb_accounts/k9', { active: true, failCount: 43, okCount: 74 }); await safetyRecalc('k9', {});
  a = store.get('fb_accounts/k9');
  check('D6 di trú v2: failCount 43 → uiFailCount 43, failCount 0, safety cao (không tự tắt nick), safetyWhy có "lỗi giao diện 43"', a.safetyV === 2 && a.failCount === 0 && a.uiFailCount === 43 && a.safety >= 90 && a.active === true && /lỗi giao diện 43/.test(a.safetyWhy), { s: a.safety, why: a.safetyWhy });
  const d3 = Date.now() - 3 * 864e5 - 1000;
  store.set('fb_accounts/k8', { active: true, safetyV: 2, failCount: 5, uiFailCount: 10, challengeTotal: 1, needLoginTotal: 3, okCount: 0, safetyDecayAt: d3, safetyAt: Date.now() - 1000 });
  await safetyRecalc('k8', {}); a = store.get('fb_accounts/k8');
  check('D7 decay 3 ngày (safetyAt mới ghi 1 s trước KHÔNG chặn): fail 5→2, ui 10→4, nl 3→2, cp giữ 1; safetyDecayAt tiến đúng 3 ngày', a.failCount === 2 && a.uiFailCount === 4 && a.needLoginTotal === 2 && a.challengeTotal === 1 && Math.abs(a.safetyDecayAt - (d3 + 3 * 864e5)) < 5, { f: a.failCount, u: a.uiFailCount, nl: a.needLoginTotal, cp: a.challengeTotal });
  await safetyRecalc('k8', {}); const a2 = store.get('fb_accounts/k8');
  check('D8 chạy lại ngay: chưa đủ 1 ngày → không giảm thêm', a2.failCount === 2 && a2.uiFailCount === 4, { f: a2.failCount });
  store.set('fb_accounts/k7', { active: true, safetyV: 2, failCount: 0, challengeTotal: 4, okCount: 0, safetyDecayAt: Date.now() });
  await safetyRecalc('k7', {}); a = store.get('fb_accounts/k7');
  check('D9 checkpoint 4 → safety 20 < 30 → tự tạm dừng (safetyPaused) + log 🛡 có lý do', a.safety === 20 && a.safetyPaused === true && a.active === false && logsOf().some(l => /Safety Score 20/.test(l.action) && /checkpoint 4/.test(l.action)), a.safety);
}

console.log('\n=== E. E-5 refundQuota: kẹp ≥0 · theo reservedDay · onSkip/onHuman dùng reservedDay ===');
{
  seedBase(); store.set('outreach_usage/k1__' + DAY(), { react: 1, comment: 0, friend: 0, inbox: 0 });
  await refundQuota('k1', ['react', 'comment', 'friend'], ['react'], DAY());
  let u = store.get('outreach_usage/k1__' + DAY());
  check('E1 hoàn comment+friend từ 0 → vẫn 0 (không âm), react (đã làm) giữ 1', u.comment === 0 && u.friend === 0 && u.react === 1, u);
  store.set('outreach_usage/k1__' + DAY(), { react: 5, comment: 3 });
  await refundQuota('k1', ['react', 'comment'], [], '2026-01-01'); u = store.get('outreach_usage/k1__' + DAY());
  check('E2 reservedDay KHÁC hôm nay → không hoàn (van hôm đó đã qua)', u.react === 5 && u.comment === 3, u);
  await refundQuota('k1', ['react', 'comment'], [], undefined); u = store.get('outreach_usage/k1__' + DAY());
  check('E3 thread cũ không reservedDay → coi như hôm nay → hoàn 5→4, 3→2', u.react === 4 && u.comment === 2, u);
  await refundQuota('k1', ['react'], [], 'moved'); u = store.get('outreach_usage/k1__' + DAY());
  check('E4 reservedDay "moved" → hoàn (4→3)', u.react === 3, u.react);
}

console.log('\n=== F. R-1 pre-flight + kiểm giữa phễu · onHuman ===');
{
  seedBase(); seedThread('L1');
  check('F1 humanBusy: lead new/trống → ""', humanBusy({ stage: 'new' }, null) === '' && humanBusy({}, null) === '');
  check('F2 humanBusy: first_care_at / stage responded / closed_at / outreach_replied / lost / dropped', !!humanBusy({ first_care_at: 1 }) && !!humanBusy({ stage: 'responded' }) && !!humanBusy({ closed_at: 1 }) && !!humanBusy({ outreach_replied: true }) && !!humanBusy({ lost: true }) && !!humanBusy({ dropped: true }));
  check('F3 humanBusy: assignee chỉ chặn khi brand.outreach.skipAssigned', humanBusy({ assignee: 'u1' }, { outreach: {} }) === '' && !!humanBusy({ assignee: 'u1' }, { outreach: { skipAssigned: true } }));
  check('F4 preflight lead sạch → null', (await preflight(T('L1'))) === null);
  store.set('leads/L1', { brand: 'hscl-01', stage: 'new', first_care_at: Date.now() });
  const pf = await preflight(T('L1')); check('F5 preflight lead sales đã chăm → {human, why}', pf && pf.human && /đã chăm/.test(pf.why), pf);
  await onHuman(T('L1'), pf); const th = store.get('outreach_threads/L1'); const u = store.get('outreach_usage/k1__' + DAY());
  check('F6 onHuman: thread step human/active false/taskStatus cancelled + log 🙋 status skip + hoàn van react/comment (3→2, 2→1)', th.step === 'human' && th.active === false && th.taskStatus === 'cancelled' && logsOf().some(l => /🙋/.test(l.action) && l.status === 'skip') && u.react === 2 && u.comment === 1, { th: th.step, u });
  seedBase(); seedThread('L2', { active: false });
  const pf2 = await preflight(T('L2')); check('F7 thread đã tắt → obsolete', pf2 && pf2.obsolete === true, pf2);
  const n0 = logsOf().length; await onHuman(T('L2'), pf2); check('F8 onHuman obsolete → không ghi log/không đụng thread', logsOf().length === n0 && store.get('outreach_threads/L2').step === 'funnel');
  seedBase(); seedThread('L3', { step: 'expired' }); check('F9 thread expired → obsolete', ((await preflight(T('L3'))) || {}).obsolete === true);
  // giữa phễu: sau react, lead bị chốt → comment KHÔNG chạy
  seedBase(); seedThread('L1');
  let n = 0; const p = mkPage({ gql: a => { n++; if (n === 1) store.set('leads/L1', { brand: 'hscl-01', stage: 'closed', closed_at: Date.now() }); return GQL_AUTO(a); } });
  let err = null; try { await runFunnel(p, T('L1')); } catch (e) { err = e; }
  check('F10 người thật chốt lead giữa phễu → ném {human}, chỉ 1 gql (react), comment không chạy, doneSteps=[react]', err && err.human && n === 1 && store.get('outreach_threads/L1').doneSteps.join() === 'react', err && err.human);
  // runNick: preflight trong vòng việc → task cancelled, không mở thao tác
  seedBase(); seedThread('L1'); store.set('leads/L1', { brand: 'hscl-01', stage: 'responded' }); store.set('outreach_tasks/L1__funnel', { status: 'running' });
  const pg = mkPage({ gql: () => GQL_OK }); chromium.connectOverCDP = async () => ({ contexts: () => [{ pages: () => [pg] }], close: async () => { } });
  await runNick('k1', [T('L1')]);
  check('F11 runNick: preflight bắt lead responded → task cancelled, thread human, 0 gql', store.get('outreach_tasks/L1__funnel').status === 'cancelled' && store.get('outreach_threads/L1').step === 'human' && pg.calls.gql.length === 0, store.get('outreach_tasks/L1__funnel'));
}

console.log('\n=== G. dryRun: mở bài/trang cá nhân, log [DRY], KHÔNG thao tác, hoãn 2h ===');
{
  seedBase(); seedThread('L1'); store.set('outreach_tasks/L1__funnel', { status: 'running' }); CFG.dryRun = true;
  const pg = mkPage({ gql: () => GQL_OK, visible: sel => /Nhắn tin|Thêm bạn bè/.test(sel) ? 1 : 0, uidByUrl: { 'https://www.facebook.com/Ng.April': '100001111122222' } });
  chromium.connectOverCDP = async () => ({ contexts: () => [{ pages: () => [pg] }], close: async () => { } });
  await runNick('k1', [T('L1', { payload: { steps: ['react', 'comment', 'add_friend', 'inbox'], comment_msg: 'x', inbox_msg: 'y', reaction: 'LOVE', post_url: 'https://www.facebook.com/groups/1/posts/2/', profile_url: 'https://www.facebook.com/Ng.April' } })]);
  const th = store.get('outreach_threads/L1'), lg = logsOf();
  check('G1 KHÔNG gọi API/DOM/gõ, KHÔNG doneSteps/okCount', pg.calls.gql.length === 0 && pg.calls.enter === 0 && !pg.calls.typed.length && !(th.doneSteps || []).length && !store.get('fb_accounts/k1').okCount, { gql: pg.calls.gql.length, ds: th.doneSteps });
  check('G2 4 dòng log [DRY] status dry (bài mở ✓ · nút kết bạn ✓ · Nhắn tin ✓ · uid)', lg.filter(l => l.status === 'dry' && /^\[DRY\]/.test(l.action)).length === 4 && lg.some(l => /mở được bài/.test(l.text)) && lg.some(l => /nút Nhắn tin ✓/.test(l.text) && /uid 100001111122222/.test(l.text)), lg.map(l => l.action + '|' + l.text).join(' ; '));
  check('G3 thread hoãn ~2h (taskStatus paused, lastError chạy thử), task paused', th.taskStatus === 'paused' && /dryRun/.test(th.lastError) && th.nextAt > Date.now() + 110 * 60000 && store.get('outreach_tasks/L1__funnel').status === 'paused', { st: th.taskStatus, err: th.lastError });
  check('G4 mở đúng 2 URL (bài + trang cá nhân) sau trang chủ', pg.visited.filter(u => u !== 'https://www.facebook.com/').length === 2, pg.visited);
  CFG.dryRun = false;
}

console.log('\n=== H. R-2 checkReplies: backoff replyNextAt · W-6 nhận diện · force · replyLoop độc lập ===');
{
  seedBase();
  const now = Date.now();
  store.set('outreach_threads/T1', { pid: 'k1', step: 'done', doneSteps: ['react', 'comment', 'add_friend', 'inbox'], uid: '111', leadId: 'T1', inboxAt: now - 3600e3 });
  store.set('outreach_threads/T2', { pid: 'k1', step: 'done', doneSteps: ['react', 'comment', 'add_friend', 'inbox'], uid: '222', leadId: 'T2', inboxAt: now - 3600e3, replyChecks: 2 });
  store.set('outreach_threads/T3', { pid: 'k1', step: 'done', doneSteps: ['inbox'], uid: '333', leadId: 'T3', inboxAt: now - 3600e3, replyNextAt: now + 3600e3 });
  store.set('outreach_threads/T4', { pid: 'k1', step: 'done', doneSteps: ['inbox'], uid: '444', leadId: 'T4', inboxAt: now - 10 * 86400e3 });
  store.set('leads/T1', { brand: 'hscl-01', stage: 'new' });
  const pg = mkPage({ replyByUid: { 111: { ok: true, replied: true, text: 'Dạ em cần 5kg' }, 222: { ok: true, replied: false } } });
  await checkReplies(pg, { pid: 'k1', force: true });
  const t1 = store.get('outreach_threads/T1'), t2 = store.get('outreach_threads/T2'), t3 = store.get('outreach_threads/T3'), t4 = store.get('outreach_threads/T4');
  check('H1 T1 có phản hồi → replied, lead responded + outreach_replied, note, log reply, replied +1', t1.replied === true && t1.step === 'replied' && store.get('leads/T1').stage === 'responded' && store.get('leads/T1').outreach_replied === true && logsOf().some(l => l.status === 'reply') && (store.get('outreach_stats/hscl-01__' + DAY()) || {}).replied === 1 && [...store.keys()].some(k => /^leads\/T1\/notes\//.test(k) && store.get(k).brand === 'hscl-01'), { t1: t1.step, lead: store.get('leads/T1').stage, stats: store.get('outreach_stats/hscl-01__' + DAY()) });
  check('H2 T2 chưa phản hồi (replyChecks 2→3) → replyNextAt ≈ +12h (backoffH[3])', t2.replyChecks === 3 && Math.abs(t2.replyNextAt - (Date.now() + 12 * 3600e3)) < 5000, { c: t2.replyChecks, dh: (t2.replyNextAt - Date.now()) / 3600e3 });
  check('H3 T3 replyNextAt tương lai → bỏ qua (không mở) · T4 quá cửa sổ 7 ngày → bỏ', !pg.visited.some(u => /t\/333|t\/444/.test(u)) && !t3.replyChecks && !t4.replyChecks, pg.visited);
  check('H4 fb_accounts.replyCheckAt + replyFound 1', store.get('fb_accounts/k1').replyFound === 1 && store.get('fb_accounts/k1').replyCheckAt > now - 1000);
  // W-6: chạy THẬT hàm nhận diện trên DOM giả
  const src = String(checkReplies); const m = src.match(/page\.evaluate\(\(\) => \{([\s\S]*?)\}\)\.catch\(\(\) => \(\{ ok: false \}\)\)/);
  const fnBody = m && m[1];
  check('H5 (tự kiểm) tách được thân hàm nhận diện bong bóng', !!fnBody);
  const detect = els => { globalThis.document = { querySelectorAll: () => els.map(e => ({ getAttribute: () => e.l, innerText: e.t })) }; try { return new Function(fnBody)(); } finally { delete globalThis.document; } };
  const r1 = detect([{ l: 'Bạn đã gửi', t: 'Chào anh' }, { l: 'Đã gửi', t: '' }, { l: 'Đã xem', t: '' }]);
  check('H6 W-6: sau tin của mình chỉ có nhãn trạng thái "Đã gửi"/"Đã xem" (trống) → KHÔNG tính phản hồi', r1.ok === true && r1.replied === false, r1);
  const r2 = detect([{ l: 'Bạn đã gửi', t: 'Chào anh' }, { l: 'Đã gửi', t: '' }, { l: 'Nguyễn Văn A đã gửi', t: 'Dạ em cần 5kg' }]);
  check('H7 W-6: "<Tên> đã gửi" có nội dung SAU tin mình → phản hồi, text đúng', r2.ok && r2.replied && /5kg/.test(r2.text), r2);
  const r3 = detect([{ l: 'Nguyễn Văn A đã gửi', t: 'hello' }, { l: 'Bạn đã gửi', t: 'Chào anh' }]);
  check('H8 W-6: tin khách TRƯỚC tin mình → chưa phản hồi', r3.ok && r3.replied === false, r3);
  const r4 = detect([{ l: 'Tin nhắn', t: 'x' }]);
  check('H9 W-6: không thấy tin của mình → ok:false (không kết luận)', r4.ok === false, r4);
  // replyLoop: nick có thread tới hạn → mở nick; nick không tới hạn → chỉ ghi replyCheckAt; nick đang chạy → bỏ
  seedBase(); let starts = 0, stops = 0;
  globalThis.fetch = async url => { if (/browser\/start/.test(String(url))) starts++; if (/browser\/stop/.test(String(url))) stops++; return { json: async () => ({ code: 0, data: { ws: { puppeteer: 'ws://x' } } }), ok: true, status: 200, text: async () => '' }; };
  store.set('fb_accounts/k1', { active: true, adspower_id: 'k1', workerId: 'vps-1', brand: 'hscl-01' });
  store.set('fb_accounts/k2', { active: true, adspower_id: 'k2', workerId: 'vps-1', brand: 'hscl-01' });
  store.set('fb_accounts/k3', { active: true, adspower_id: 'k3', workerId: 'vps-1', brand: 'hscl-01', needLogin: true });
  store.set('fb_accounts/k4', { active: true, adspower_id: 'k4', workerId: 'other' });
  store.set('outreach_threads/A1', { pid: 'k1', step: 'done', doneSteps: ['inbox'], uid: '111', leadId: 'A1', inboxAt: now - 3600e3 });
  store.set('outreach_threads/A3', { pid: 'k3', step: 'done', doneSteps: ['inbox'], uid: '333', leadId: 'A3', inboxAt: now - 3600e3 });
  store.set('leads/A1', { brand: 'hscl-01', stage: 'new' });
  const pgR = mkPage({ replyByUid: { 111: { ok: true, replied: true, text: 'ok em' } } }); chromium.connectOverCDP = async () => ({ contexts: () => [{ pages: () => [pgR] }], close: async () => { } });
  await replyLoop();
  check('H10 replyLoop: chỉ nick k1 (có thread tới hạn) được mở (1 start/1 stop); k2 không thread → chỉ replyCheckAt; k3 needLogin bỏ; k4 VPS khác bỏ', starts === 1 && stops === 1 && store.get('fb_accounts/k2').replyCheckAt > 0 && !store.get('fb_accounts/k3').replyCheckAt && !store.get('fb_accounts/k4').replyCheckAt, { starts, stops });
  check('H11 replyLoop: A1 phát hiện phản hồi qua vòng độc lập (không cần việc mới)', store.get('outreach_threads/A1').replied === true && store.get('leads/A1').stage === 'responded' && readingProfiles.size === 0);
  starts = 0; await replyLoop(); check('H12 replyLoop lần 2 trong everyMin → không mở lại (replyCheckAt mới)', starts === 0, starts);
  store.set('fb_accounts/k1', { active: true, adspower_id: 'k1', workerId: 'vps-1', brand: 'hscl-01' }); store.set('outreach_threads/A1', { pid: 'k1', step: 'done', doneSteps: ['inbox'], uid: '111', leadId: 'A1', inboxAt: now - 3600e3 });
  activeProfiles.add('k1'); await replyLoop(); check('H13 nick đang chạy phễu (activeProfiles) → replyLoop bỏ qua', starts === 0, starts); activeProfiles.delete('k1');
  CFG.dryRun = true; store.set('outreach_threads/A1', { pid: 'k1', step: 'done', doneSteps: ['inbox'], uid: '111', leadId: 'A1', inboxAt: now - 3600e3 }); store.set('leads/A1', { brand: 'hscl-01', stage: 'new' });
  await replyLoop(); check('H14 dryRun: đọc thấy phản hồi nhưng KHÔNG ghi lead/thread', store.get('leads/A1').stage === 'new' && !store.get('outreach_threads/A1').replied, store.get('leads/A1')); CFG.dryRun = false;
  // claimBatch bỏ nick đang đọc
  store.set('outreach_tasks/Q1__funnel', { status: 'queued', workerId: 'vps-1', adspower_id: 'k1', pid: 'k1', leadId: 'Q1', action: 'funnel', createdAt: 1 });
  readingProfiles.add('k1'); __setEffMax(2); const bn = await claimBatch(); readingProfiles.delete('k1');
  check('H15 claimBatch: nick đang được đọc inbox → không claim (task vẫn queued)', bn.size === 0 && store.get('outreach_tasks/Q1__funnel').status === 'queued');
}

console.log('\n=== I. R-8 tắt êm: requestStop giữa phễu → xong bước, việc còn lại hẹn 5\', không nhận việc mới, goOffline ===');
{
  seedBase(); seedThread('L1'); seedThread('L2'); store.set('outreach_tasks/L1__funnel', { status: 'running' }); store.set('outreach_tasks/L2__funnel', { status: 'running' });
  exits = 0; __setStopping(false); let gate; const gateP = new Promise(r => { gate = r; }); let n = 0;
  const pg = mkPage({ gql: async a => { n++; if (n === 1) { requestStop('SIGINT'); await gateP; } return GQL_AUTO(a); } });
  chromium.connectOverCDP = async () => ({ contexts: () => [{ pages: () => [pg] }], close: async () => { } });
  const run = runNick('k1', [T('L1'), T('L2')]);
  await wait(20); check('I1 nhận SIGINT giữa bước react của L1 → stopping=true, tick() không claim', __stopping() === true && (await tick()) === 0);
  gate(); await run;
  const th1 = store.get('outreach_threads/L1'), th2 = store.get('outreach_threads/L2');
  check('I2 L1: bước react XONG (doneSteps có react), bước comment KHÔNG chạy → hoãn 5\' "worker đang tắt"', th1.doneSteps.includes('react') && !th1.doneSteps.includes('comment') && th1.taskStatus === 'paused' && /đang tắt/.test(th1.lastError) && n === 1, { ds: th1.doneSteps, err: th1.lastError, n });
  check('I3 L2 (chưa bắt đầu) → hoãn 5\', task paused', th2.taskStatus === 'paused' && store.get('outreach_tasks/L2__funnel').status === 'paused', th2.lastError);
  await tickLoop(); await wait(5);
  check('I4 tickLoop khi stopping + không nick chạy → goOffline (thoát) đúng 1 lần', exits === 1 && __running() === 0, exits);
  await requestStop('SIGINT'); check('I5 tín hiệu lần 2 → thoát ngay', exits === 2, exits);
  __setStopping(false); exits = 0;
}

console.log('\n=== J. nhỏ: nextMorningVN (W-11) · gateCheck stopping · config merge sâu · heartbeat ===');
{
  const realNow = Date.now; CFG.hoursVN = [8, 22];
  Date.now = () => Date.UTC(2026, 8, 11, 20, 0, 0); // 03:00 VN 12/09
  let nm = new Date(nextMorningVN() + 7 * 3600e3);
  check('J1 03:00 VN → hẹn 8:xx CÙNG NGÀY (12/09), không +1 ngày', nm.getUTCDate() === 12 && nm.getUTCHours() === 8, nm.toISOString());
  Date.now = () => Date.UTC(2026, 8, 12, 3, 0, 0); // 10:00 VN 12/09
  nm = new Date(nextMorningVN() + 7 * 3600e3);
  check('J2 10:00 VN → hẹn 8:xx NGÀY MAI (13/09)', nm.getUTCDate() === 13 && nm.getUTCHours() === 8, nm.toISOString());
  Date.now = realNow; CFG.hoursVN = [0, 24];
  check('J3 CFG.inbox merge sâu giữ backoffH mặc định', Array.isArray(CFG.inbox.backoffH) && CFG.inbox.backoffH.length === 5, CFG.inbox.backoffH);
  __setStopping(true); seedBase(); seedThread('L1'); store.set('outreach_tasks/L1__funnel', { status: 'running' });
  const pg = mkPage({ gql: () => GQL_OK }); chromium.connectOverCDP = async () => ({ contexts: () => [{ pages: () => [pg] }], close: async () => { } });
  await runNick('k1', [T('L1')]);
  check('J4 gateCheck khi stopping → hoãn 5\' không mở nick (0 gql)', pg.calls.gql.length === 0 && /đang tắt/.test(store.get('outreach_threads/L1').lastError), store.get('outreach_threads/L1').lastError);
  __setStopping(false);
}

console.log(`\n${pass}/${total} PASS`); if (pass !== total) process.exit(1);
