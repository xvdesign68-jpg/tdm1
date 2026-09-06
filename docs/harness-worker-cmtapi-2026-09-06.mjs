// Harness stub: comment-lead đi API nội bộ (worker 2026-09-06b) — tym bình luận + trả lời bình luận qua /api/graphql/, fallback DOM khi API tắt/lỗi, chống double khi API mơ hồ
import { runFunnel, CFG, __store as store } from './_w.mjs';
CFG.actionDelayMs = 1;
const OWN = '100003873470611';
const POST = 'https://www.facebook.com/groups/1733640124552320/posts/1735915220991477/';
const CURL = POST + '?comment_id=1744380153478317';
const dec = b64 => Buffer.from(String(b64 || ''), 'base64').toString('utf8');
function mkPage(o) {
  let cur = 'https://www.facebook.com/'; const calls = [];
  const loc = () => ({ filter: () => loc(), first: () => ({ count: async () => (o.verifyHit ? 1 : 0), isVisible: async () => true, click: async () => { }, scrollIntoViewIfNeeded: async () => { }, innerText: async () => '' }) });
  const page = {
    calls, visited: [], goto: async u => { cur = u; page.visited.push(u); }, url: () => cur,
    locator: loc, getByText: () => loc(), $$: async () => [], keyboard: { type: async () => { }, press: async () => { }, down: async () => { }, up: async () => { } },
    context: () => ({ pages: () => [page] }), screenshot: async () => { }, mouse: { wheel: async () => { } },
    evaluate: async (fn, arg) => {
      const src = String(fn);
      if (src.includes('/api/graphql/')) { calls.push(arg); const m = (o.api || {})[arg.friendlyName] || 'ok';
        if (arg.friendlyName === 'CometUFIFeedbackReactMutation') return m === 'fail' ? { ok: false, hasErr: true, data: null, sample: 'errors' } : { ok: true, hasErr: false, data: { feedback_react: { feedback: { id: 'x', viewer_feedback_reaction_info: { id: '1678524932434102' } } } }, sample: 'ok' };
        if (m === 'fail') return { ok: false, hasErr: true, data: null, sample: '{"errors":[{"message":"x"}]}' };
        if (m === 'amb') return { ok: true, hasErr: false, data: { something: { id: 1 } }, sample: 'amb' };
        return { ok: true, hasErr: false, data: { comment_create: { feedback: { id: 'y' } } }, sample: 'ok' }; }
      if (src.includes('CurrentUserInitialData')) return OWN;
      if (src.includes('cidRe')) return { base: true, cid: true, txt: '' };      // waitForContent: bài đã vẽ
      if (src.includes('data-sl-cid')) return o.marked === undefined ? null : o.marked; // findCommentEl marker
      return null;
    },
    evaluateHandle: async () => ({ asElement: () => null }),
  };
  return page;
}
let pass = 0, total = 0; const check = (n, ok, x) => { total++; if (ok) pass++; console.log(ok ? 'PASS' : 'FAIL', n, x || ''); };
const mkTask = id => ({ taskId: id + '__funnel', leadId: id, pid: 'k1', brandCode: 'hscl-01', brandName: 'HSCL', name: 'Hiền', temp: 'warm', score: 62, action: 'funnel',
  payload: { kind: 'comment', steps: ['react', 'comment'], post_url: POST, comment_url: CURL, comment_id: '1744380153478317', comment_msg: 'Dạ chị hỏi đúng món dễ bán ạ.', reaction: 'LOVE' } });
const logsOf = () => [...store.entries()].filter(([k]) => k.startsWith('outreach_log/')).map(([, v]) => v);
const GQ = { reactDocId: '27646120298312844', commentDocId: '28781864408106143', replyDocId: '28781864408106143' };

// A) API OK cả 2 bước
store.clear(); CFG.graphql = { ...GQ };
store.set('outreach_threads/A1', { pid: 'k1', step: 'funnel', active: true, doneSteps: [] });
let pg = mkPage({}); let err = null; try { await runFunnel(pg, mkTask('A1')); } catch (e) { err = e; }
let th = store.get('outreach_threads/A1'), logs = logsOf();
check('A: thread done + doneSteps react,comment', !err && th.step === 'done' && th.doneSteps.includes('react') && th.doneSteps.includes('comment'), err ? err.message : '');
check('A: đúng 2 lệnh graphql, KHÔNG gọi DOM (không tìm khung comment)', pg.calls.length === 2 && pg.visited.length === 1 && pg.visited[0] === CURL, JSON.stringify({ calls: pg.calls.length, visited: pg.visited }));
const c0 = pg.calls[0] || {}, c1 = pg.calls[1] || {};
check('A: react = CometUFIFeedbackReactMutation doc 27646… feedback_id=feedback:<post>_<cid> source OBJECT', c0.friendlyName === 'CometUFIFeedbackReactMutation' && c0.docId === '27646120298312844' && dec(c0.variables.input.feedback_id) === 'feedback:1735915220991477_1744380153478317' && c0.variables.input.feedback_source === 'OBJECT' && c0.variables.input.feedback_reaction_id === '1678524932434102', JSON.stringify({ n: c0.friendlyName, d: c0.docId, f: dec((c0.variables || { input: {} }).input.feedback_id) }));
check('A: reply = useCometUFICreateCommentMutation doc 28781… + reply_comment_parent_fbid=comment:<post>_<cid> + reply_target_clicked + POST_PERMALINK_DIALOG/2 + groupID', c1.friendlyName === 'useCometUFICreateCommentMutation' && c1.docId === '28781864408106143' && dec(c1.variables.input.reply_comment_parent_fbid) === 'comment:1735915220991477_1744380153478317' && dec(c1.variables.input.feedback_id) === 'feedback:1735915220991477_1744380153478317' && c1.variables.input.reply_target_clicked === true && c1.variables.feedLocation === 'POST_PERMALINK_DIALOG' && c1.variables.feedbackSource === 2 && c1.variables.groupID === '1733640124552320' && c1.variables.input.message.text === 'Dạ chị hỏi đúng món dễ bán ạ.' && c1.variables.translationType === 'ORIGINAL', JSON.stringify({ n: c1.friendlyName, d: c1.docId, p: dec((c1.variables || { input: {} }).input.reply_comment_parent_fbid) }));
check('A: log 2 dòng done, nhãn bình luận, text = comment_msg', logs.filter(l => l.status === 'done').length === 2 && logs.some(l => /vào bình luận/.test(l.action)) && logs.some(l => l.action === 'Trả lời bình luận của Lead' && l.text === 'Dạ chị hỏi đúng món dễ bán ạ.'), logs.map(l => l.action + '|' + l.status).join(' ; '));
check('A: stats react+comment +1', [...store.entries()].some(([k, v]) => k.startsWith('outreach_stats/hscl-01__') && v.react === 1 && v.comment === 1));

// B) reply API MƠ HỒ (200 không comment_create) + chữ đã hiện → KHÔNG gõ lại
store.clear(); CFG.graphql = { ...GQ };
store.set('outreach_threads/B1', { pid: 'k1', step: 'funnel', active: true, doneSteps: ['react'] });
pg = mkPage({ api: { useCometUFICreateCommentMutation: 'amb' }, marked: { ok: true }, verifyHit: true }); err = null; try { await runFunnel(pg, mkTask('B1')); } catch (e) { err = e; }
th = store.get('outreach_threads/B1'); logs = logsOf();
check('B: API mơ hồ + đã thấy hiển thị → done, KHÔNG gõ DOM (log ghi rõ)', !err && th.step === 'done' && logs.length === 1 && logs[0].status === 'done' && /API mơ hồ/.test(logs[0].text), err ? err.message : logs.map(l => l.text).join(' ; '));
check('B: có đi tìm khung comment để kiểm (2 lần mở comment_url)', pg.visited.filter(u => u === CURL).length === 2, JSON.stringify(pg.visited));

// C) reply API LỖI RÕ → rơi xuống DOM; stub không định vị được khung → THROW fail-closed (không double, không done giả)
store.clear(); CFG.graphql = { ...GQ };
store.set('outreach_threads/C1', { pid: 'k1', step: 'funnel', active: true, doneSteps: ['react'] });
pg = mkPage({ api: { useCometUFICreateCommentMutation: 'fail' }, marked: null }); err = null; try { await runFunnel(pg, mkTask('C1')); } catch (e) { err = e; }
logs = logsOf();
check('C: API lỗi → DOM fallback → không thấy khung → dừng phễu (log fail, thread chưa done)', !!err && /dừng phễu/.test(err.message) && logs.length === 1 && logs[0].status === 'fail' && store.get('outreach_threads/C1').step !== 'done', err ? err.message.slice(0, 90) : 'no err');

// D) API tắt (graphql {}) → không gọi graphql, đi DOM như cũ
store.clear(); CFG.graphql = {};
store.set('outreach_threads/D1', { pid: 'k1', step: 'funnel', active: true, doneSteps: [] });
pg = mkPage({ marked: null }); err = null; try { await runFunnel(pg, mkTask('D1')); } catch (e) { err = e; }
check('D: graphql tắt → 0 lệnh API, đi thẳng DOM (findCommentEl)', pg.calls.length === 0 && pg.visited[0] === CURL && !!err, err ? err.message.slice(0, 60) : '');

// E) chỉ có commentDocId (chưa khai replyDocId) → reply dùng commentDocId
store.clear(); CFG.graphql = { reactDocId: GQ.reactDocId, commentDocId: '28980334608233889' };
store.set('outreach_threads/E1', { pid: 'k1', step: 'funnel', active: true, doneSteps: ['react'] });
pg = mkPage({}); err = null; try { await runFunnel(pg, mkTask('E1')); } catch (e) { err = e; }
check('E: thiếu replyDocId → dùng commentDocId', !err && pg.calls.length === 1 && pg.calls[0].docId === '28980334608233889', err ? err.message : JSON.stringify(pg.calls.map(c => c.docId)));

// F) lead-bài (không kind comment) không đổi: react API dùng feedback:<post> (không _cid)
store.clear(); CFG.graphql = { ...GQ };
store.set('outreach_threads/F1', { pid: 'k1', step: 'funnel', active: true, doneSteps: [] });
pg = mkPage({}); const tf = mkTask('F1'); tf.payload = { steps: ['react', 'comment'], post_url: POST, comment_msg: 'Bạn nhắn riêng nhé.', reaction: 'LOVE' };
err = null; try { await runFunnel(pg, tf); } catch (e) { err = e; }
check('F: lead-bài: react feedback:<post>, comment top-level không có reply_comment_parent_fbid', !err && pg.calls.length === 2 && dec(pg.calls[0].variables.input.feedback_id) === 'feedback:1735915220991477' && pg.calls[1].variables.input.reply_comment_parent_fbid === undefined && pg.calls[1].variables.feedLocation === 'GROUP', err ? err.message : JSON.stringify(pg.calls.map(c => c.friendlyName)));

console.log(`\n${pass}/${total} PASS`); if (pass !== total) process.exit(1);
