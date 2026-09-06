// Harness v2026-09-06: add_friend "đã là bạn / đã gửi lời mời" → hoàn 1 suất van kết bạn (outreach_usage friend -1), KHÔNG cộng KPI friend; đường bình thường không hoàn
import { runFunnel, CFG, __store as store } from './_w.mjs';
CFG.graphql = {}; CFG.actionDelayMs = 1;
const OWN = '100013727043931';
function mkPage(opts) {
  let cur = 'https://www.facebook.com/';
  const loc = (sel) => ({ first: () => ({ count: async () => (opts.visible || (() => 0))(sel), isVisible: async () => true, click: async () => { }, scrollIntoViewIfNeeded: async () => { } }) });
  const box = { click: async () => { }, innerText: async () => '' };
  const page = { goto: async u => { cur = u; page.visited.push(u); }, url: () => cur, visited: [], locator: loc, $$: async () => [], keyboard: { type: async () => { }, press: async () => { }, down: async () => { }, up: async () => { } },
    context: () => ({ pages: () => [page] }), screenshot: async () => { }, mouse: { wheel: async () => { } },
    evaluate: async fn => { const src = String(fn); if (src.includes('CurrentUserInitialData')) return OWN; if (src.includes('al:android:url')) return (opts.uidByUrl || {})[cur] || null; return null; },
    evaluateHandle: async () => ({ asElement: () => box }) };
  return page;
}
let pass = 0, total = 0; const check = (n, ok, x) => { total++; if (ok) pass++; console.log(ok ? 'PASS' : 'FAIL', n, x || ''); };
const day = new Date(Date.now() + 7 * 3600e3).toISOString().slice(0, 10);
const PURL = 'https://www.facebook.com/Ng.April2704';
const mk = (id) => ({ taskId: id + '__funnel', leadId: id, pid: 'k1', brandCode: 'hscl-01', brandName: 'HSCL', name: 'A', temp: 'hot', score: 90, action: 'funnel', payload: { steps: ['react', 'comment', 'add_friend', 'inbox'], profile_url: PURL, inbox_msg: 'Chào chị', comment_msg: 'x', reaction: 'LOVE', post_url: 'https://www.facebook.com/groups/1/posts/2/' } });
// A) đã gửi lời mời trước ("Huỷ lời mời" hiện) → hoàn van, không cộng KPI friend, vẫn done + inbox chạy
store.clear(); store.set('outreach_threads/L9', { pid: 'k1', step: 'funnel', active: true, doneSteps: ['react', 'comment'] });
await runFunnel(mkPage({ uidByUrl: { [PURL]: '100001111122222' }, visible: sel => /Huỷ lời mời|Nhắn tin/.test(sel) ? 1 : 0 }), mk('L9'));
const th = store.get('outreach_threads/L9'); const usage = store.get('outreach_usage/k1__' + day) || {}; const stats = store.get('outreach_stats/hscl-01__' + day) || {};
const logs = [...store.entries()].filter(([k]) => k.startsWith('outreach_log/')).map(([, v]) => v);
check('A: thread done, doneSteps có add_friend + inbox', th.step === 'done' && th.doneSteps.includes('add_friend') && th.doneSteps.includes('inbox'), JSON.stringify(th.doneSteps));
check('A: hoàn 1 suất van kết bạn (outreach_usage.friend = -1)', usage.friend === -1, JSON.stringify(usage));
check('A: KPI brand KHÔNG cộng friend, inbox vẫn +1', !stats.friend && stats.inbox === 1, JSON.stringify(stats));
check('A: log kết bạn ghi rõ bỏ qua + hoàn van', logs.some(l => /kết bạn/i.test(l.action) && /hoàn 1 suất/.test(l.text) && l.status === 'done'), logs.map(l => l.action + '|' + l.text).join(' ; '));
// B) chưa là bạn ("Thêm bạn bè" hiện) → gửi lời mời thật: KHÔNG hoàn, KPI friend +1
store.clear(); store.set('outreach_threads/L8', { pid: 'k1', step: 'funnel', active: true, doneSteps: ['react', 'comment'] });
await runFunnel(mkPage({ uidByUrl: { [PURL]: '100001111122222' }, visible: sel => /Thêm bạn bè|Nhắn tin/.test(sel) ? 1 : 0 }), mk('L8'));
const usage2 = store.get('outreach_usage/k1__' + day); const stats2 = store.get('outreach_stats/hscl-01__' + day) || {};
check('B: không hoàn van (không có doc outreach_usage)', !usage2, JSON.stringify(usage2));
check('B: KPI friend +1, inbox +1', stats2.friend === 1 && stats2.inbox === 1, JSON.stringify(stats2));
console.log(`\n${pass}/${total} PASS`); if (pass !== total) process.exit(1);
