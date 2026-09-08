// Harness DÒNG THỜI GIAN KHỞI ĐỘNG: chạy app thật (MODE firebase) với SDK Firebase GIẢ có thời gian trễ như thật
// (auth 200ms · getDoc user 150ms · snapshot cache 80–150ms rồi server 450–700ms · getDocs admin 400ms) → ghi lại
// mỗi 50ms: màn chờ còn không, cổng auth, số KPI đang hiện, số thẻ lead → in các mốc ĐỔI TRẠNG THÁI.
// Dùng: node boot-timeline.mjs <thư mục site> [nhãn]
import fs from 'fs'; import http from 'http'; import path from 'path'; import { chromium } from 'playwright-core';
const ROOT = path.resolve(process.argv[2]); const LABEL = process.argv[3] || path.basename(ROOT);
const MIME = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css', '.png': 'image/png', '.svg': 'image/svg+xml', '.json': 'application/json', '.webmanifest': 'application/manifest+json' };
const server = http.createServer((req, res) => {
  const u = decodeURIComponent(req.url.split('?')[0]);
  if (u.endsWith('firebase-config.min.js') || u.endsWith('firebase-config.js')) { res.writeHead(200, { 'content-type': 'text/javascript' }); return res.end('window.SL_CONFIG={MODE:"firebase",firebase:{projectId:"stub",apiKey:"x",appId:"x"},MANUAL_SCAN_URL:"https://x.invalid/manualScan"};'); }
  let fp = path.join(ROOT, u === '/' ? 'app.html' : u);
  if (!fp.startsWith(ROOT) || !fs.existsSync(fp) || fs.statSync(fp).isDirectory()) { res.writeHead(404); return res.end(); }
  let body = fs.readFileSync(fp);
  if (u === '/app.html' || u === '/') body = Buffer.from(body.toString('utf8').replace(/<link[^>]*fonts\.googleapis[^>]*>/g, ''));
  res.writeHead(200, { 'content-type': MIME[path.extname(fp)] || 'application/octet-stream' }); res.end(body);
});
const port = await new Promise(r => server.listen(0, () => r(server.address().port)));
const live = fs.readFileSync(path.join(ROOT, 'assets/js/live.js'), 'utf8');
const mods = {};
for (const m of live.matchAll(/import\s*\{([^}]*)\}\s*from\s*"https:\/\/www\.gstatic\.com\/firebasejs\/[\d.]+\/(firebase-[a-z]+)\.js"/g)) mods[m[2]] = m[1].split(',').map(x => x.trim().split(/\s+as\s+/)[0]).filter(Boolean);
// ---- Firestore giả: kịch bản trong window.__SCN (đặt qua addInitScript) ----
const FAKE = `
const S = window.__SCN; const T0 = performance.now(); const log=(...a)=>{ (window.__EV=window.__EV||[]).push([Math.round(performance.now()-T0),...a]); };
const ts = ms => ({ toDate: () => new Date(ms), toMillis: () => ms, seconds: Math.floor(ms/1000), nanoseconds: 0 });
const mkLeads = (arr) => arr.map(l => ({ id: l.id, data: () => ({ brand: 'hscl-01', name: l.name, text: l.text, source: 'Group Hải sản', group: 'Group Hải sản', temp: l.temp, score: l.score, stage: 'new', detected_at: ts(Date.now() - l.ageMin * 60000), time: l.ageMin + ' phút trước', intent: 'Mua hàng', need: l.text, industry: 'Hải sản', kind: 'post', post_url: 'https://www.facebook.com/groups/1/posts/' + l.id + '/' }) }));
const snapCol = (docs, fromCache) => ({ size: docs.length, empty: !docs.length, docs: docs.map(d => ({ id: d.id, data: d.data, exists: () => true, metadata: { fromCache } })), forEach(fn) { this.docs.forEach(fn); }, docChanges: () => [], metadata: { fromCache, hasPendingWrites: false } });
const snapDoc = (id, d, fromCache) => ({ id, exists: () => !!d, data: () => d, metadata: { fromCache, hasPendingWrites: false } });
export const initializeApp = x => ({ name: 'stub', options: x });
export const getAuth = () => S.auth;
export const onAuthStateChanged = (a, cb) => { setTimeout(() => { log('auth', a.currentUser ? 'user' : 'null'); cb(a.currentUser); }, S.authMs); return () => {}; };
export const getRedirectResult = () => Promise.resolve(null); export const setPersistence = () => Promise.resolve(); export const browserLocalPersistence = {};
export class GoogleAuthProvider {} export class EmailAuthProvider { static credential() { return {}; } } export class TotpMultiFactorGenerator {}
export const multiFactor = () => ({ enrolledFactors: [] }); export const getMultiFactorResolver = () => ({}); export const signOut = () => Promise.resolve();
export const signInWithPopup = () => Promise.resolve(); export const signInWithRedirect = () => Promise.resolve(); export const sendEmailVerification = () => Promise.resolve();
export const signInWithEmailAndPassword = () => Promise.resolve(); export const createUserWithEmailAndPassword = () => Promise.resolve(); export const sendPasswordResetEmail = () => Promise.resolve();
export const updatePassword = () => Promise.resolve(); export const reauthenticateWithCredential = () => Promise.resolve();
export const getFirestore = () => ({ stub: 1 }); export const initializeFirestore = () => ({ stub: 1 }); export const persistentLocalCache = x => x; export const persistentMultipleTabManager = () => ({});
export const collection = (db, name) => ({ type: 'col', path: name }); export const collectionGroup = (db, name) => ({ type: 'cg', path: 'cg:' + name });
export const doc = (db, col, id) => (typeof col === 'object' ? { type: 'doc', path: col.path + '/' + id, id } : { type: 'doc', path: col + '/' + id, col, id });
export const query = (t) => t; export const where = () => ({}); export const orderBy = () => ({}); export const limit = () => ({});
export const serverTimestamp = () => new Date(); export const deleteField = () => ({ df: 1 }); export const increment = n => ({ inc: n }); export const arrayUnion = (...v) => ({ au: v }); export const arrayRemove = (...v) => ({ ar: v });
export const setDoc = () => Promise.resolve(); export const updateDoc = () => Promise.resolve(); export const addDoc = () => Promise.resolve({ id: 'n1' }); export const deleteDoc = () => Promise.resolve(); export const runTransaction = () => Promise.resolve();
export const getDoc = (ref) => new Promise(r => setTimeout(() => { log('getDoc', ref.path); r(snapDoc(ref.id, S.docs[ref.path], false)); }, S.getDocMs));
export const getDocs = (t) => new Promise(r => setTimeout(() => { log('getDocs', t.path); r(snapCol((S.lists[t.path] || []).map(d => ({ id: d.id, data: () => d })), false)); }, S.getDocsMs));
export const onSnapshot = (t, cb, err) => {
  const p = t.path; const sc = S.snap[p] || S.snapDefault; const cbk = typeof cb === 'function' ? cb : (cb && cb.next);
  const fire = (stage, delay) => setTimeout(() => { const v = sc[stage]; if (!v) return; log('snap', p, stage);
    if (t.type === 'doc') cbk(snapDoc(t.id, typeof v.doc === 'function' ? v.doc() : v.doc, stage === 'cache'));
    else cbk(snapCol((typeof v.docs === 'function' ? v.docs() : v.docs) || [], stage === 'cache')); }, delay);
  if (sc.error) { setTimeout(() => { log('snapERR', p); const e = new Error(sc.error.code); e.code = sc.error.code; (typeof err === 'function' ? err : (cb && cb.error) || (() => {}))(e); }, sc.error.ms); return () => {}; }
  if (sc.cache) fire('cache', sc.cache.ms); if (sc.server) fire('server', sc.server.ms);
  return () => {};
};
export const getMessaging = () => ({}); export const getToken = () => Promise.resolve(''); export const onMessage = () => {}; export const isSupported = () => Promise.resolve(false);
window.__mkLeads = mkLeads;
`;
const MODE = process.env.SCN || 'normal';
const scenario = `
window.__SCN_MODE = ${JSON.stringify(MODE)};
window.__SCN = (function(){ const M = window.__SCN_MODE;
  const user = { uid: 'u1', email: 'xuanvinhsc68.work@gmail.com', displayName: 'Xuân Vinh', providerData: [{ providerId: 'google.com' }], emailVerified: true, getIdToken: async () => 't' };
  const OLD = [ {id:'L1',name:'Chị Hương',text:'Cần mua 20kg mực khô giao Q7',temp:'hot',score:92,ageMin:30}, {id:'L2',name:'Anh Tuấn',text:'Hỏi giá cá lóc khô',temp:'warm',score:70,ageMin:90}, {id:'L3',name:'Chị Lan',text:'Ib giá tôm khô',temp:'cold',score:45,ageMin:200} ];
  const NEW = OLD.concat([ {id:'L4',name:'Anh Dũng',text:'Cần 50kg cá khô cho nhà hàng, có Zalo 0909',temp:'hot',score:95,ageMin:3}, {id:'L5',name:'Chị Yến',text:'Bên mình có mực một nắng không?',temp:'warm',score:66,ageMin:8}, {id:'L6',name:'Chị Thảo',text:'Giá sỉ khô bò',temp:'cold',score:42,ageMin:12} ]);
  const mk = (arr) => arr.map(l => ({ id: l.id, data: () => ({ brand: 'hscl-01', name: l.name, text: l.text, source: 'Group Hải sản', group: 'Group Hải sản', temp: l.temp, score: l.score, stage: 'new', detected_at: { toDate: () => new Date(Date.now() - l.ageMin*60000), toMillis: () => Date.now() - l.ageMin*60000 }, time: l.ageMin + ' phút trước', intent: 'Mua hàng', need: l.text, industry: 'Hải sản', kind: 'post', post_url: 'https://www.facebook.com/groups/1/posts/' + l.id + '/' }) }));
  const scan = (n) => ({ id: 'S'+n, data: () => ({ trigger:'scheduled', at: new Date(Date.now()-n*180000), durationMs: 5000, sourcesCount: 23, postsFetched: 20+n, leadsCreated: 2, hotLeads: 1, scanMethod:'brightdata', stats:{ totalPosts: 1000+n } }) });
  const src = [ { id:'g1', data: () => ({ name:'Group Hải sản', url:'https://www.facebook.com/groups/1', brand:'hscl-01', active:true, industry:'Hải sản' }) }, { id:'g2', data: () => ({ name:'Chợ khô', url:'https://www.facebook.com/groups/2', brand:'hscl-01', active:true, industry:'Hải sản' }) } ];
  const cfg = { autoScanEnabled: true, scanMethod: 'brightdata', keywords: ['mua','giá'], exclude: [], weights: {} };
  const leadsSnap = M==='slow' ? { cache: { ms: 120, docs: () => mk(OLD) }, server: { ms: 3000, docs: () => mk(NEW) } }
                  : M==='nocache' ? { server: { ms: 900, docs: () => mk(NEW) } }
                  : M==='leadsErr' ? { error: { ms: 300, code: 'permission-denied' } }
                  : { cache: { ms: 120, docs: () => mk(OLD) }, server: { ms: 700, docs: () => mk(NEW) } };
  const userDoc = M==='pending' ? { role: 'pending', active: false, email: 'x@y.z', displayName: 'Khách' } : { role: 'superadmin', active: true, email: user.email, displayName: user.displayName };
  const authUser = M==='login' ? null : (M==='pending' ? Object.assign({}, user, { email: 'x@y.z', uid: 'u2' }) : user);
  return {
    auth: { currentUser: authUser }, authMs: 200, getDocMs: 150, getDocsMs: 400,
    docs: { 'users/u1': userDoc, 'users/u2': userDoc, 'brands/hscl-01': { name: 'Hải sản Cường Linh' } },
    lists: { users: [ { id:'u1', role:'superadmin', active:true, email:user.email, displayName:user.displayName } ], fb_accounts: [], brands: [ { id:'hscl-01', name:'Hải sản Cường Linh' } ], brand_sales: [] },
    snap: {
      'users/u1': { cache: { ms: 60, doc: { role: 'superadmin', active: true, email: user.email, displayName: user.displayName } }, server: { ms: 400, doc: { role: 'superadmin', active: true, email: user.email, displayName: user.displayName, sessions: {} } } },
      'leads':    leadsSnap,
      'users/u2': { cache: { ms: 60, doc: userDoc }, server: { ms: 400, doc: userDoc } },
      'sources':  { cache: { ms: 100, docs: src }, server: { ms: 500, docs: src } },
      'config/app': { cache: { ms: 80, doc: cfg }, server: { ms: 450, doc: cfg } },
      'scans':    { cache: { ms: 150, docs: [ scan(2) ] }, server: { ms: 650, docs: [ scan(1), scan(2) ] } },
    },
    snapDefault: { server: { ms: 600, docs: [], doc: null } },
  };
})();`;
const exe = fs.readdirSync('/opt/pw-browsers').filter(d => /chromium/.test(d)).map(d => ['/opt/pw-browsers/' + d + '/chrome-linux/headless_shell', '/opt/pw-browsers/' + d + '/chrome-linux/chrome']).flat().find(p => fs.existsSync(p));
const browser = await chromium.launch({ executablePath: exe, headless: true });
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
const errors = []; page.on('pageerror', e => errors.push(e.message)); page.on('console', m => { if (m.type() === 'error' && !/ERR_|net::|favicon/.test(m.text())) errors.push('console: ' + m.text().slice(0, 160)); });
await page.addInitScript(scenario);
await page.route(/gstatic\.com\/firebasejs\/.*\/(firebase-[a-z]+)\.js/, r => { const name = r.request().url().match(/(firebase-[a-z]+)\.js/)[1]; const names = mods[name] || []; const have = new Set([...FAKE.matchAll(/export (?:const|class) (\w+)/g)].map(m => m[1])); const extra = names.filter(n => !have.has(n)).map(n => `export const ${n} = (...a)=>({stub:'${n}'});`).join('\n'); r.fulfill({ status: 200, contentType: 'text/javascript', body: FAKE + '\n' + extra }); });
await page.route(/manifest\.webmanifest/, r => r.fulfill({ status: 200, headers: { date: new Date().toUTCString(), 'content-type': 'application/manifest+json' }, body: '{}' }));
// Ghi dòng thời gian từ trong trang: poll 50ms
await page.addInitScript(() => { window.__TL = []; document.addEventListener('DOMContentLoaded', () => { const t0 = performance.now(); window.__T0 = t0;
  const snap = () => { const ls = document.getElementById('loading-screen'); const g = document.getElementById('authGate'); const view = document.getElementById('view');
    const kpi = [...(view ? view.querySelectorAll('.kpi .val') : [])].slice(0, 2).map(e => e.textContent.trim()).join(' | ');
    const cards = view ? view.querySelectorAll('.lead-card').length : 0; const gateTxt = g && g.classList.contains('show') ? (g.textContent || '').trim().slice(0, 30) : '';
    const bd = view ? view.querySelectorAll('.agy-row, .agency-row').length : 0;
    window.__TL.push({ t: Math.round(performance.now() - t0), loading: !!(ls && getComputedStyle(ls).opacity !== '0'), gate: !!(g && g.classList.contains('show')), gateTxt, kpi, cards, viewKids: view ? view.childElementCount : -1, title: (document.getElementById('vTitle') || {}).textContent || '' }); };
  const iv = setInterval(snap, 50); setTimeout(() => clearInterval(iv), 8500); snap(); }); });
const t0 = Date.now();
await page.goto(`http://127.0.0.1:${port}/app.html`, { waitUntil: 'domcontentloaded' });
await page.waitForTimeout(MODE==='normal'?4200:8800);
const r = await page.evaluate(() => ({ tl: window.__TL, ev: window.__EV || [], liveFlags: { ready: window.SL_LIVE_READY, fb: !!window.SL_FB } }));
await browser.close(); server.close();
// In các mốc đổi trạng thái (gộp các bước count-up thành 1 dòng)
let last = null; const rows = [];
for (const s of r.tl) { const key = [s.loading, s.gate, s.gateTxt, s.cards, s.viewKids, s.title].join('|'); const kk = key + '|' + s.kpi; if (!last || last.key !== key || (last.kpi !== s.kpi && !/đếm/.test(last.note || ''))) { rows.push({ ...s, key }); last = { key, kpi: s.kpi, note: '' }; } else if (last.kpi !== s.kpi) { rows[rows.length - 1].note = 'đếm/đổi số…→' + s.kpi; last.kpi = s.kpi; last.note = 'đếm'; } }
console.log(`== ${LABEL} [${MODE}]: mốc từ DOMContentLoaded (ms) — màn chờ · cổng auth · KPI đầu · số thẻ lead · view`);
for (const s of rows) console.log(String(s.t).padStart(5) + 'ms  chờ=' + (s.loading ? 'CÓ ' : 'không') + '  gate=' + (s.gate ? ('CÓ "' + s.gateTxt + '"') : 'không') + '  KPI=' + (s.kpi || '-') + (s.note ? ' (' + s.note + ')' : '') + '  thẻ=' + s.cards + '  view=' + s.viewKids + '  [' + s.title + ']');
console.log('-- sự kiện SDK giả (ms từ khi module chạy):', r.ev.map(e => e.join(':')).join('  '));
console.log('-- lỗi trang:', errors.length ? errors.join(' | ') : 'không');
