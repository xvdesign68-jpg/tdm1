/* harness scanEvents/brandMapOf/normUrl — node docs/harness-scanstats-2026-09-08.mjs */
import { scanEvents, brandMapOf, normUrl, vnDay } from './lenh-2026-09-08-39-scanstats.js';
let ok = 0, fail = 0; const t = (name, c) => { if (c) ok++; else { fail++; console.log('FAIL', name); } };
t('normUrl', normUrl('https://www.facebook.com/groups/abc/?ref=1') === 'facebook.com/groups/abc' && normUrl('http://m.facebook.com/groups/ABC/') === 'facebook.com/groups/abc');
const bm = brandMapOf([{ url: 'https://www.facebook.com/groups/a/', brand: 'hscl-01' }, { url: 'https://facebook.com/groups/b', brand: 'z15' }, { url: '', brand: 'x' }, { url: 'https://facebook.com/groups/c' }]);
t('brandMap size', bm.size === 2);
const at = Date.parse('2026-09-08T04:21:00Z'); // 11:21 VN
const ev = scanEvents({ at, postsFetched: 7, bySource: [{ url: 'https://www.facebook.com/groups/a', posts: 5, bdComments: 3, bd: 'ok' }, { url: 'https://facebook.com/groups/b/', posts: 0, bd: 'skip' }, { url: 'https://facebook.com/groups/zz', posts: 9 }, { url: 'https://www.facebook.com/groups/a/', posts: 2, bd: 'ok' }] }, bm);
t('day VN', ev.every(e => e.day === '2026-09-08') && vnDay(at) === '2026-09-08');
const a = ev.find(e => e.brand === 'hscl-01'), b = ev.find(e => e.brand === 'z15');
t('gộp 2 dòng cùng brand', a && a.inc.scanned === 7 && a.inc.scannedComments === 3 && a.inc.scanRuns === 1);
t('brand skip 0 bài → không sự kiện', !b);
t('nguồn không brand bỏ qua', ev.length === 1);
t('bySource object', scanEvents({ at, bySource: { k1: { url: 'https://facebook.com/groups/b', posts: 4 } } }, bm)[0].inc.scanned === 4);
t('bdPosts fallback', scanEvents({ at, bySource: [{ url: 'https://facebook.com/groups/b', bdPosts: 6 }] }, bm)[0].inc.scanned === 6);
t('Timestamp-like at', scanEvents({ at: { toMillis: () => at }, bySource: [{ url: 'https://facebook.com/groups/b', posts: 1 }] }, bm)[0].day === '2026-09-08');
t('lượt rỗng', scanEvents({ at }, bm).length === 0 && scanEvents(null, bm).length === 0);
console.log(ok + '/' + (ok + fail) + ' PASS'); process.exit(fail ? 1 : 0);
