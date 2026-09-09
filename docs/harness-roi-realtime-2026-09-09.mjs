// Harness REALTIME trang "Giá trị & ROI": chạy app thật (MODE firebase, tài khoản super) với SDK Firebase GIẢ có thể BẮN SNAPSHOT MỚI
// khi trang ROI đang mở → đo từng chỉ số có tự đổi không và đổi sau bao lâu (không F5, không bấm gì).
// Kịch bản: T1 thêm 2 lead nóng · T2 chốt 1 deal có giá trị · T3 đổi config/app.roi (phí gói mặc định) · T4 tắt nguồn quét của 1 brand
//           · T5 đổi tham số riêng brand / tắt brand / thêm brand (brands/…: từ v119-86 super có kênh realtime → đổi ngay; trước: chỉ refreshAdmin throttle 15 s)
//           · T6 đang gõ ô tham số thì lead đổi (deferReload). Cây có v119-86 (live.js chứa 'danh sách brand') → in thêm bảng KỲ VỌNG PASS/FAIL.
// Dùng: node harness-roi-realtime-2026-09-09.mjs <thư mục site>
import fs from 'fs'; import http from 'http'; import path from 'path'; import { createRequire } from 'node:module';
// playwright-core tìm qua require (tôn trọng NODE_PATH) — ESM import không đọc NODE_PATH nên chạy từ docs/ sẽ lỗi ERR_MODULE_NOT_FOUND
const { chromium } = createRequire(import.meta.url)('playwright-core');
const ROOT = path.resolve(process.argv[2]);
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
const FAKE = `
const S = window.__SCN; const T0 = performance.now(); const log=(...a)=>{ (window.__EV=window.__EV||[]).push([Math.round(performance.now()-T0),...a]); };
const snapCol = (docs, fromCache) => ({ size: docs.length, empty: !docs.length, docs: docs.map(d => ({ id: d.id, data: d.data, exists: () => true, metadata: { fromCache } })), forEach(fn) { this.docs.forEach(fn); }, docChanges: () => [], metadata: { fromCache, hasPendingWrites: false } });
const snapDoc = (id, d, fromCache) => ({ id, exists: () => !!d, data: () => d, metadata: { fromCache, hasPendingWrites: false } });
export const initializeApp = x => ({ name: 'stub', options: x });
export const getAuth = () => S.auth;
export const onAuthStateChanged = (a, cb) => { setTimeout(() => cb(a.currentUser), S.authMs); return () => {}; };
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
export const setDoc = (ref, data) => { log('setDoc', ref.path); (window.__WRITES=window.__WRITES||[]).push([ref.path, JSON.stringify(data).slice(0,200)]); return Promise.resolve(); };
export const updateDoc = (ref, data) => { (window.__WRITES=window.__WRITES||[]).push([ref.path, JSON.stringify(data).slice(0,200)]); return Promise.resolve(); };
export const addDoc = () => Promise.resolve({ id: 'n1' }); export const deleteDoc = () => Promise.resolve(); export const runTransaction = () => Promise.resolve();
export const getDoc = (ref) => new Promise(r => setTimeout(() => { r(snapDoc(ref.id, S.docs[ref.path], false)); }, S.getDocMs));
export const getDocs = (t) => new Promise(r => setTimeout(() => { log('getDocs', t.path); r(snapCol((S.lists[t.path] || []).map(d => ({ id: d.id, data: () => d })), false)); }, S.getDocsMs));
window.__SUBS = {};
export const onSnapshot = (t, cb, err) => {
  const p = t.path; const sc = S.snap[p] || S.snapDefault; const cbk = typeof cb === 'function' ? cb : (cb && cb.next);
  const emit = (v, fromCache) => { if (t.type === 'doc') cbk(snapDoc(t.id, typeof v.doc === 'function' ? v.doc() : v.doc, fromCache)); else cbk(snapCol((typeof v.docs === 'function' ? v.docs() : v.docs) || [], fromCache)); };
  (window.__SUBS[p] = window.__SUBS[p] || []).push({ t, emit });
  if (sc.error) { setTimeout(() => { const e = new Error(sc.error.code); e.code = sc.error.code; (typeof err === 'function' ? err : (cb && cb.error) || (() => {}))(e); }, sc.error.ms); return () => {}; }
  if (sc.cache) setTimeout(() => emit(sc.cache, true), sc.cache.ms); if (sc.server) setTimeout(() => emit(sc.server, false), sc.server.ms);
  return () => { const a = window.__SUBS[p] || []; const i = a.findIndex(x => x.t === t); if (i >= 0) a.splice(i, 1); };
};
window.__push = (p, v) => { const a = window.__SUBS[p] || []; log('push', p, a.length); a.forEach(s => s.emit(v, false)); return a.length; };
export const getMessaging = () => ({}); export const getToken = () => Promise.resolve(''); export const onMessage = () => {}; export const isSupported = () => Promise.resolve(false);
`;
const scenario = `
window.__SCN = (function(){
  const user = { uid: 'u1', email: 'xuanvinhsc68.work@gmail.com', displayName: 'Xuân Vinh', providerData: [{ providerId: 'google.com' }], emailVerified: true, getIdToken: async () => 't' };
  const TS = ms => ({ toDate: () => new Date(ms), toMillis: () => ms, seconds: Math.floor(ms/1000), nanoseconds: 0 });
  const now = Date.now();
  // 2 brand: hscl (3 lead) · tts (2 lead) — nguồn quét bật cho cả 2
  window.__LEADS = [
    { id:'L1', brand:'hscl-01', name:'Chị Hương', text:'Cần mua 20kg mực khô', temp:'hot',  score:92, stage:'new',      ageMin:30 },
    { id:'L2', brand:'hscl-01', name:'Anh Tuấn',  text:'Hỏi giá cá lóc khô',  temp:'warm', score:70, stage:'inbox',    ageMin:90 },
    { id:'L3', brand:'hscl-01', name:'Chị Lan',   text:'Ib giá tôm khô',      temp:'cold', score:45, stage:'new',      ageMin:200 },
    { id:'L4', brand:'tts-1',   name:'Anh Nam',   text:'Tìm việc telesales',  temp:'hot',  score:88, stage:'responded',ageMin:60 },
    { id:'L5', brand:'tts-1',   name:'Chị Mai',   text:'Cần việc part-time',  temp:'warm', score:65, stage:'new',      ageMin:400 },
  ];
  window.__mk = arr => arr.map(l => ({ id: l.id, data: () => Object.assign({ brand: l.brand, name: l.name, text: l.text, source: 'Group '+l.brand, group: 'Group '+l.brand, temp: l.temp, score: l.score, stage: l.stage, detected_at: TS(now - l.ageMin*60000), time: l.ageMin+' phút trước', intent: 'mua', need: 'x', service: 'y', industry: 'Hải sản' }, l.extra||{}) }));
  const src = () => window.__SRC.map(s => ({ id: s.id, data: () => s }));
  window.__SRC = [ { id:'g1', name:'Group hscl', url:'https://www.facebook.com/groups/1', brand:'hscl-01', active:true, industry:'Hải sản' }, { id:'g2', name:'Group tts', url:'https://www.facebook.com/groups/2', brand:'tts-1', active:true, industry:'Tuyển dụng' }, { id:'g3', name:'Group agc', url:'https://www.facebook.com/groups/3', brand:'agc-3', active:true, industry:'Khác' } ];
  window.__CFG = { autoScanEnabled: true, scanMethod: 'brightdata', keywords: ['mua','giá'], exclude: [], weights: {}, roi: { fee: 8600000, cplAds: 250000, aov: 25000000 } };
  const scan = (n) => ({ id: 'S'+n, data: () => ({ trigger:'scheduled', at: new Date(now-n*180000), durationMs: 5000, sourcesCount: 3, postsFetched: 20+n, leadsCreated: 2, hotLeads: 1, scanMethod:'brightdata', stats:{ totalPosts: 1000+n } }) });
  const userDoc = { role: 'superadmin', active: true, email: user.email, displayName: user.displayName };
  return {
    auth: { currentUser: user }, authMs: 100, getDocMs: 80, getDocsMs: 150,
    docs: { 'users/u1': userDoc, 'brands/hscl-01': { name: 'Hải sản Cường Linh' } },
    lists: { users: [ { id:'u1', role:'superadmin', active:true, email:user.email, displayName:user.displayName } ], fb_accounts: [],
             brands: [ { id:'hscl-01', name:'Hải sản Cường Linh' }, { id:'tts-1', name:'TD TTS' }, { id:'agc-3', name:'Test Agc 3' } ], brand_sales: [] },
    snap: {
      'users/u1': { cache: { ms: 40, doc: userDoc }, server: { ms: 200, doc: Object.assign({ sessions: {} }, userDoc) } },
      'leads':    { cache: { ms: 80, docs: () => window.__mk(window.__LEADS) }, server: { ms: 300, docs: () => window.__mk(window.__LEADS) } },
      'sources':  { cache: { ms: 60, docs: src }, server: { ms: 250, docs: src } },
      'config/app': { cache: { ms: 50, doc: window.__CFG }, server: { ms: 220, doc: window.__CFG } },
      'scans':    { cache: { ms: 90, docs: [ scan(2) ] }, server: { ms: 320, docs: [ scan(1), scan(2) ] } },
      'brands':   { cache: { ms: 70, docs: () => window.__SCN.lists.brands.map(b => ({ id: b.id, data: () => b })) }, server: { ms: 260, docs: () => window.__SCN.lists.brands.map(b => ({ id: b.id, data: () => b })) } }, // v119-86: kênh realtime brands (cây cũ không đăng ký → không dùng)
    },
    snapDefault: { server: { ms: 400, docs: [], doc: null } },
  };
})();`;
const exe = fs.readdirSync('/opt/pw-browsers').filter(d => /chromium/.test(d)).map(d => ['/opt/pw-browsers/' + d + '/chrome-linux/headless_shell', '/opt/pw-browsers/' + d + '/chrome-linux/chrome']).flat().find(p => fs.existsSync(p));
const browser = await chromium.launch({ executablePath: exe, headless: true });
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
const errors = []; page.on('pageerror', e => errors.push(e.message)); page.on('console', m => { if (m.type() === 'error' && !/ERR_|net::|favicon/.test(m.text())) errors.push('console: ' + m.text().slice(0, 160)); });
await page.addInitScript(scenario);
await page.route(/gstatic\.com\/firebasejs\/.*\/(firebase-[a-z]+)\.js/, r => { const name = r.request().url().match(/(firebase-[a-z]+)\.js/)[1]; const names = mods[name] || []; const have = new Set([...FAKE.matchAll(/export (?:const|class) (\w+)/g)].map(m => m[1])); const extra = names.filter(n => !have.has(n)).map(n => `export const ${n} = () => ({});`).join('\n'); r.fulfill({ status: 200, headers: { 'content-type': 'text/javascript' }, body: FAKE + '\n' + extra }); });
await page.route(/manifest\.webmanifest/, r => r.fulfill({ status: 200, headers: { date: new Date().toUTCString(), 'content-type': 'application/manifest+json' }, body: '{}' }));
await page.goto(`http://127.0.0.1:${port}/app.html`, { waitUntil: 'domcontentloaded' });
await page.waitForFunction(() => window.SL_LIVE_READY === true, null, { timeout: 15000 }); await page.waitForTimeout(400);
await page.evaluate(() => document.querySelector('.nav-item[data-view="roi"]').click()); await page.waitForTimeout(900);
const READ = () => { const v = document.getElementById('view'); const q = s => (v.querySelector(s) || {}).textContent || ''; const stats = [...v.querySelectorAll('.rl-strip .rl-stat, .rl-strip [class*=stat]')];
  const st = {}; v.querySelectorAll('.rl-strip > *').forEach(e => { const lb = (e.querySelector('.rl-lb, .lb, small, .rl-stat-lb') || e.firstElementChild || {}).textContent || ''; const val = (e.querySelector('b, .rl-v, .v') || {}).textContent || ''; if (lb) st[lb.trim().slice(0, 22)] = val.trim(); });
  const rows = {}; v.querySelectorAll('tr[data-roibrand]').forEach(tr => { const tds = [...tr.querySelectorAll('td')].map(td => td.textContent.trim()); rows[tr.dataset.roibrand] = tds.slice(1, 7).join(' | '); });
  const fc = [...v.querySelectorAll('.rl-fc, .roi-fc, [class*=forecast]')].map(e => e.textContent.replace(/\s+/g, ' ').trim()).join(' ‖ ');
  return { kick: q('.rl-kick').trim(), hero: q('.rh-num').trim(), fee: q('.rl-eq').trim(), strip: st, rows, tot: (v.querySelector('tr.roi-tot') || {}).textContent ? [...v.querySelector('tr.roi-tot').querySelectorAll('td')].map(t => t.textContent.trim()).join(' | ') : '', fc: fc.slice(0, 400), title: (document.getElementById('vTitle') || {}).textContent }; };
const read = () => page.evaluate(READ);
const waitChange = async (before, ms = 3000) => { const t0 = Date.now(); while (Date.now() - t0 < ms) { const cur = await read(); if (JSON.stringify(cur) !== JSON.stringify(before)) return { changed: true, ms: Date.now() - t0, cur }; await page.waitForTimeout(50); } return { changed: false, ms, cur: await read() }; };
const out = []; const say = (s) => { out.push(s); console.log(s); };
const b0 = await read(); say('== T0 (mở ROI) ==' + '\n  ' + JSON.stringify(b0).slice(0, 900));
// T1: thêm 2 lead nóng hscl
await page.evaluate(() => { window.__LEADS.unshift({ id:'L6', brand:'hscl-01', name:'Anh Dũng', text:'Cần 50kg cá khô', temp:'hot', score:95, stage:'new', ageMin:2 }, { id:'L7', brand:'hscl-01', name:'Chị Yến', text:'Mực một nắng', temp:'hot', score:90, stage:'new', ageMin:3 }); window.__push('leads', { docs: window.__mk(window.__LEADS) }); });
let r1 = await waitChange(b0); say(`== T1 thêm 2 lead nóng hscl → ${r1.changed ? 'ĐỔI sau ' + r1.ms + ' ms' : 'KHÔNG ĐỔI'}\n  strip=${JSON.stringify(r1.cur.strip)} hero=${r1.cur.hero} rows.hscl=${r1.cur.rows['hscl-01']} tot=${r1.cur.tot}`);
// T2: chốt L1 với deal_value 30tr
await page.evaluate(() => { const l = window.__LEADS.find(x => x.id === 'L1'); l.stage = 'closed'; l.extra = { closed_at: Date.now() - 3600e3, deal_value: 30000000, stage_at: Date.now() - 3600e3 }; window.__push('leads', { docs: window.__mk(window.__LEADS) }); });
let r2 = await waitChange(r1.cur); say(`== T2 chốt 1 deal 30 tr → ${r2.changed ? 'ĐỔI sau ' + r2.ms + ' ms' : 'KHÔNG ĐỔI'}\n  strip=${JSON.stringify(r2.cur.strip)} fc=${r2.cur.fc.slice(0, 300)} rows.hscl=${r2.cur.rows['hscl-01']}`);
// T3: config/app.roi.fee mặc định 8,6tr → 12tr
await page.evaluate(() => { window.__CFG = Object.assign({}, window.__CFG, { roi: { fee: 12000000, cplAds: 250000, aov: 25000000 } }); window.__push('config/app', { doc: window.__CFG }); });
let r3 = await waitChange(r2.cur); say(`== T3 đổi phí gói mặc định 8,6 → 12 tr (config/app) → ${r3.changed ? 'ĐỔI sau ' + r3.ms + ' ms' : 'KHÔNG ĐỔI'}\n  hero=${r3.cur.hero} fee=${r3.cur.fee} strip=${JSON.stringify(r3.cur.strip)}`);
// T4: tắt nguồn của agc-3 (brand không lead) → số brand hoạt động giảm
await page.evaluate(() => { window.__SRC.find(s => s.id === 'g3').active = false; window.__push('sources', { docs: window.__SRC.map(s => ({ id: s.id, data: () => s })) }); });
let r4 = await waitChange(r3.cur); say(`== T4 tắt nguồn quét brand agc-3 → ${r4.changed ? 'ĐỔI sau ' + r4.ms + ' ms' : 'KHÔNG ĐỔI'}\n  kick="${r4.cur.kick}" strip=${JSON.stringify(r4.cur.strip)}`);
// T5: đổi tham số riêng brand tts-1 (brands/tts-1.roi.fee = 20tr) → v119-86: kênh realtime brands → đổi ngay; cây cũ: KHÔNG có listener, chỉ refreshAdmin throttle 15 s + khi go() chạy
const HAS86 = /danh sách brand/.test(live);
const pushBrands = () => page.evaluate(() => window.__push('brands', { docs: window.__SCN.lists.brands.map(b => ({ id: b.id, data: () => b })) }));
await page.evaluate(() => { window.__SCN.lists.brands.find(b => b.id === 'tts-1').roi = { fee: 20000000, cplAds: 250000 }; }); await pushBrands();
let r5a = await waitChange(r4.cur, 2500); say(`== T5a đổi tham số riêng tts-1 (brands/…) → ${r5a.changed ? 'ĐỔI sau ' + r5a.ms + ' ms' : 'KHÔNG ĐỔI trong 2,5 s'}\n  rows.tts=${r5a.cur.rows['tts-1']} fee=${r5a.cur.fee}`);
let r5b = r5a;
if (!HAS86) { say('   … cây chưa có v119-86: chờ 15,5 s (throttle refreshAdmin) rồi bắn 1 snapshot lead nữa'); await page.waitForTimeout(15500);
  await page.evaluate(() => { window.__push('leads', { docs: window.__mk(window.__LEADS) }); });
  r5b = await waitChange(r5a.cur, 3000); say(`== T5b sau 15,5 s + snapshot lead → ${r5b.changed ? 'ĐỔI sau ' + r5b.ms + ' ms' : 'KHÔNG ĐỔI'}\n  rows.tts=${r5b.cur.rows['tts-1']} fee=${r5b.cur.fee}`); }
// T5c: tắt brand tts-1 (active:false) → "N brand đang hoạt động" giảm; T5d: thêm brand mới có tham số riêng → thêm dòng
await page.evaluate(() => { window.__SCN.lists.brands.find(b => b.id === 'tts-1').active = false; }); await pushBrands();
let r5c = await waitChange(r5b.cur, 2500); say(`== T5c tắt brand tts-1 (brands/….active=false) → ${r5c.changed ? 'ĐỔI sau ' + r5c.ms + ' ms' : 'KHÔNG ĐỔI trong 2,5 s'}\n  kick="${r5c.cur.kick}" rows=${Object.keys(r5c.cur.rows).join(',')}`);
await page.evaluate(() => { window.__SCN.lists.brands.find(b => b.id === 'tts-1').active = true; window.__SCN.lists.brands.push({ id: 'new-4', name: 'Brand Mới 4', active: true, roi: { fee: 5000000, cplAds: 250000 } }); }); await pushBrands();
let r5d = await waitChange(r5c.cur, 2500); say(`== T5d bật lại tts-1 + thêm brand new-4 có tham số riêng → ${r5d.changed ? 'ĐỔI sau ' + r5d.ms + ' ms' : 'KHÔNG ĐỔI trong 2,5 s'}\n  kick="${r5d.cur.kick}" rows.new4=${r5d.cur.rows['new-4'] || '(không có)'}`);
// T5e: cùng dữ liệu bắn lại (snapshot máy chủ xác nhận sau ước lượng cục bộ) → KHÔNG vẽ lại (chữ ký quản trị)
await page.waitForTimeout(600);
const paintsBefore = await page.evaluate(() => { window.__PAINT = 0; const v = document.getElementById('view'); new MutationObserver(m => { window.__PAINT += m.length; }).observe(v, { childList: true, subtree: true, characterData: true, attributes: true }); return 0; });
await pushBrands(); await page.waitForTimeout(900);
const paintsAfter = await page.evaluate(() => window.__PAINT); say(`== T5e bắn lại snapshot brands y hệt → ${paintsAfter - paintsBefore === 0 ? 'KHÔNG vẽ lại (0 mutation)' : 'CÓ ' + (paintsAfter - paintsBefore) + ' mutation'}`);
const getDocsBrands = await page.evaluate(() => (window.__EV || []).filter(e => e[1] === 'getDocs' && e[2] === 'brands').length); say(`== refreshAdmin đọc getDocs(brands): ${getDocsBrands} lần (v119-86 kỳ vọng 0)`);
// T6: đang gõ ô tham số (mở "Mặc định hệ thống") → lead đổi → hoãn tới khi blur
await page.evaluate(() => { document.querySelector('[data-roisel="__default"]').click(); }); await page.waitForTimeout(400);
const focused = await page.evaluate(() => { const i = document.querySelector('#view input[type=number]'); if (!i) return false; i.focus(); return document.activeElement === i; });
const b6 = await read();
await page.evaluate(() => { window.__LEADS.unshift({ id:'L8', brand:'tts-1', name:'Anh Bình', text:'Cần việc', temp:'hot', score:85, stage:'new', ageMin:1 }); window.__push('leads', { docs: window.__mk(window.__LEADS) }); });
let r6a = await waitChange(b6, 2500); say(`== T6a đang gõ ô tham số (focus=${focused}) + thêm 1 lead → ${r6a.changed ? 'ĐỔI sau ' + r6a.ms + ' ms' : 'KHÔNG ĐỔI trong 2,5 s (hoãn)'}\n  strip=${JSON.stringify(r6a.cur.strip)}`);
await page.evaluate(() => { document.activeElement && document.activeElement.blur(); });
let r6b = await waitChange(r6a.cur, 4000); say(`== T6b rời ô → ${r6b.changed ? 'ĐỔI sau ' + r6b.ms + ' ms' : 'KHÔNG ĐỔI'}\n  strip=${JSON.stringify(r6b.cur.strip)}`);
say('-- lỗi trang: ' + (errors.length ? errors.join(' | ') : 'không'));
if (HAS86) { const exp = [ ['T1 lead → đổi ≤1,5 s', r1.changed && r1.ms < 1500], ['T2 chốt deal → đổi', r2.changed], ['T3 config/app.roi → đổi', r3.changed], ['T4 nguồn quét → đổi', r4.changed],
    ['T5a tham số riêng brand → đổi ≤1,5 s (KHÔNG chờ 15 s)', r5a.changed && r5a.ms < 1500 && /20 tr/.test(r5a.cur.rows['tts-1'] || '')], ['T5c tắt brand → bớt 1 brand hoạt động', r5c.changed && /1 brand/.test(r5c.cur.kick)],
    ['T5d thêm brand → có dòng new-4', !!r5d.cur.rows['new-4']], ['T5e snapshot y hệt → không vẽ lại', paintsAfter - paintsBefore === 0], ['refreshAdmin không getDocs brands', getDocsBrands === 0],
    ['T6a đang gõ → hoãn', !r6a.changed], ['T6b rời ô → đổi', r6b.changed], ['không lỗi JS', errors.length === 0] ];
  const bad = exp.filter(e => !e[1]); exp.forEach(e => say((e[1] ? '  ✓ ' : '  ✗ ') + e[0])); say(bad.length ? `KỲ VỌNG v119-86: FAIL ${bad.length}/${exp.length}` : `KỲ VỌNG v119-86: PASS ${exp.length}/${exp.length}`); if (bad.length) process.exitCode = 1; }
await browser.close(); server.close();
