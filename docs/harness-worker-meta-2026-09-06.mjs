// Harness v2026-09-06c (LỆNH #34): payload.content_meta → leads/{id}.outreach.content + comment_at/inbox_at; không meta → không ghi thêm; không đè replied_at
import { runFunnel, CFG, __store as store } from './_w.mjs';
CFG.actionDelayMs = 1;
const OWN = '100013727043931'; const PURL = 'https://www.facebook.com/people/Nguyen-Ut/100001111122222/';
const POST = 'https://www.facebook.com/groups/1733640124552320/posts/1735915220991477/'; const CURL = POST + '?comment_id=1744380153478317';
function pageApi() { // bài/bình luận đi API nội bộ OK (như t_cmtapi)
  let cur = 'https://www.facebook.com/';
  const loc = () => ({ filter: () => loc(), first: () => ({ count: async () => 0, isVisible: async () => true, click: async () => { }, scrollIntoViewIfNeeded: async () => { }, innerText: async () => '' }) });
  const page = { visited: [], goto: async u => { cur = u; page.visited.push(u); }, url: () => cur, locator: loc, getByText: () => loc(), $$: async () => [], keyboard: { type: async () => { }, press: async () => { }, down: async () => { }, up: async () => { } }, context: () => ({ pages: () => [page] }), screenshot: async () => { }, mouse: { wheel: async () => { } },
    evaluate: async (fn, arg) => { const src = String(fn); if (src.includes('/api/graphql/')) { if (arg.friendlyName === 'CometUFIFeedbackReactMutation') return { ok: true, hasErr: false, data: { feedback_react: { feedback: { id: 'x' } } }, sample: 'ok' }; return { ok: true, hasErr: false, data: { comment_create: { feedback: { id: 'y' } } }, sample: 'ok' }; } if (src.includes('CurrentUserInitialData')) return OWN; if (src.includes('cidRe')) return { base: true, cid: true, txt: '' }; if (src.includes('data-sl-cid')) return null; return null; },
    evaluateHandle: async () => ({ asElement: () => null }) };
  return page;
}
function pageProfile(opts) { // kết bạn + inbox DOM trên trang cá nhân (như t_refund)
  let cur = 'https://www.facebook.com/';
  const loc = (sel) => ({ first: () => ({ count: async () => (opts.visible || (() => 0))(sel), isVisible: async () => true, click: async () => { }, scrollIntoViewIfNeeded: async () => { } }) });
  const box = { click: async () => { }, innerText: async () => '' };
  const page = { goto: async u => { cur = u; page.visited.push(u); }, url: () => cur, visited: [], locator: loc, $$: async () => [], keyboard: { type: async () => { }, press: async () => { }, down: async () => { }, up: async () => { } }, context: () => ({ pages: () => [page] }), screenshot: async () => { }, mouse: { wheel: async () => { } },
    evaluate: async fn => { const src = String(fn); if (src.includes('CurrentUserInitialData')) return OWN; if (src.includes('al:android:url')) return (opts.uidByUrl || {})[cur] || null; return null; }, evaluateHandle: async () => ({ asElement: () => box }) };
  return page;
}
let pass = 0, total = 0; const check = (n, ok, x) => { total++; if (ok) pass++; console.log(ok ? 'PASS' : 'FAIL', n, x !== undefined ? '→ ' + x : ''); };
const META = { v: 34, mode: 'ai', model: 'gpt-5.6-sol', style: 'direct', parent: 'seller', variant: 3, cta: 'cmp', q: 1, ilen: 180, clen: 120, spam: 3, at: 1 };
const GQ = { reactDocId: '27646120298312844', commentDocId: '28781864408106143', replyDocId: '28781864408106143' };
const mkCmt = (id, meta) => ({ taskId: id + '__funnel', leadId: id, pid: 'k1', brandCode: 'hscl-01', brandName: 'HSCL', name: 'Hiền', temp: 'warm', score: 62, action: 'funnel', payload: Object.assign({ kind: 'comment', steps: ['react', 'comment'], post_url: POST, comment_url: CURL, comment_id: '1744380153478317', comment_msg: 'Dạ chị hỏi đúng món ạ.', reaction: 'LOVE' }, meta === undefined ? {} : { content_meta: meta }) });
const mkProf = (id, meta) => ({ taskId: id + '__funnel', leadId: id, pid: 'k1', brandCode: 'hscl-01', brandName: 'HSCL', name: 'A', temp: 'hot', score: 90, action: 'funnel', payload: Object.assign({ steps: ['react', 'comment', 'add_friend', 'inbox'], profile_url: PURL, inbox_msg: 'Chào chị', comment_msg: 'x', reaction: 'LOVE', post_url: POST }, meta === undefined ? {} : { content_meta: meta }) });
// A) comment-lead API: react+comment → content + comment_at (không inbox_at)
store.clear(); CFG.graphql = { ...GQ }; store.set('outreach_threads/A1', { pid: 'k1', step: 'funnel', active: true, doneSteps: [] });
await runFunnel(pageApi(), mkCmt('A1', META));
let o = (store.get('leads/A1') || {}).outreach || {};
check('A: outreach.content = meta (v34, parent seller, variant 3, cta cmp)', o.content && o.content.v === 34 && o.content.parent === 'seller' && o.content.variant === 3 && o.content.cta === 'cmp', JSON.stringify(o.content));
check('A: comment_at là số ms, KHÔNG có inbox_at; steps react+comment', typeof o.comment_at === 'number' && !('inbox_at' in o) && o.steps.includes('react') && o.steps.includes('comment') && o.last === 'comment', JSON.stringify(Object.keys(o)));
// B) kết bạn + inbox (react/comment đã done) → inbox_at + content; replied_at có sẵn KHÔNG bị đè
store.clear(); CFG.graphql = {}; store.set('outreach_threads/B1', { pid: 'k1', step: 'funnel', active: true, doneSteps: ['react', 'comment'] }); store.set('leads/B1', { name: 'A', outreach: { replied_at: 123, content: { v: 1 } } });
await runFunnel(pageProfile({ uidByUrl: { [PURL]: '100001111122222' }, visible: sel => /Thêm bạn bè|Nhắn tin/.test(sel) ? 1 : 0 }), mkProf('B1', META));
o = (store.get('leads/B1') || {}).outreach || {};
check('B: inbox_at số ms, content thay bằng meta mới (v34), last=inbox', typeof o.inbox_at === 'number' && o.content && o.content.v === 34 && o.last === 'inbox' && o.steps.includes('add_friend') && o.steps.includes('inbox'), JSON.stringify({ keys: Object.keys(o), v: o.content && o.content.v }));
check('B: replied_at có sẵn KHÔNG bị đè (set merge)', o.replied_at === 123, o.replied_at);
// C) không meta → không content, vẫn inbox_at
store.clear(); store.set('outreach_threads/C1', { pid: 'k1', step: 'funnel', active: true, doneSteps: ['react', 'comment'] });
await runFunnel(pageProfile({ uidByUrl: { [PURL]: '100001111122222' }, visible: sel => /Thêm bạn bè|Nhắn tin/.test(sel) ? 1 : 0 }), mkProf('C1'));
o = (store.get('leads/C1') || {}).outreach || {};
check('C: không meta → không có outreach.content, vẫn inbox_at', !('content' in o) && typeof o.inbox_at === 'number', JSON.stringify(Object.keys(o)));
// D) meta rác (chuỗi) → bỏ qua
store.clear(); store.set('outreach_threads/D1', { pid: 'k1', step: 'funnel', active: true, doneSteps: ['react', 'comment'] });
await runFunnel(pageProfile({ uidByUrl: { [PURL]: '100001111122222' }, visible: sel => /Thêm bạn bè|Nhắn tin/.test(sel) ? 1 : 0 }), mkProf('D1', 'rác'));
o = (store.get('leads/D1') || {}).outreach || {};
check('D: meta không phải object → bỏ qua', !('content' in o) && typeof o.inbox_at === 'number', JSON.stringify(Object.keys(o)));
// E) nhánh "đã là bạn" (noStat) vẫn ghi content; inbox_at có
store.clear(); store.set('outreach_threads/E1', { pid: 'k1', step: 'funnel', active: true, doneSteps: ['react', 'comment'] });
await runFunnel(pageProfile({ uidByUrl: { [PURL]: '100001111122222' }, visible: sel => /Bạn bè|Nhắn tin/.test(sel) ? 1 : 0 }), mkProf('E1', META));
o = (store.get('leads/E1') || {}).outreach || {};
check('E: đã-là-bạn vẫn ghi content + inbox_at, không comment_at', o.content && o.content.v === 34 && typeof o.inbox_at === 'number' && !('comment_at' in o), JSON.stringify(Object.keys(o)));
console.log(`\n${pass}/${total} PASS`); if (pass !== total) process.exit(1);
