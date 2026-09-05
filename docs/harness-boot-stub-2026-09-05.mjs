// Harness boot() live.js trong Chromium thật: chặn SDK Firebase CDN bằng stub ES module → boot chạy tới onAuthStateChanged(null)
// Dùng: node t_boot.mjs <thư mục site>  → in: lỗi trang, số method SL_FB, tên method, audit wrap, SL_NOW
import fs from 'fs'; import http from 'http'; import path from 'path';
import { chromium } from 'playwright-core';
const ROOT = path.resolve(process.argv[2] || '../sl');
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.png': 'image/png', '.svg': 'image/svg+xml', '.json': 'application/json', '.webmanifest': 'application/manifest+json' };
const server = http.createServer((req, res) => {
  const u = req.url.split('?')[0];
  if (u.endsWith('firebase-config.min.js') || u.endsWith('firebase-config.js')) { res.writeHead(200, { 'content-type': 'text/javascript' }); return res.end('window.SL_CONFIG={MODE:"firebase",firebase:{projectId:"stub-proj",apiKey:"x"},MANUAL_SCAN_URL:"https://example.invalid/manualScan"};'); }
  const fp = path.join(ROOT, u === '/' ? 'app.html' : u);
  if (!fp.startsWith(ROOT) || !fs.existsSync(fp) || fs.statSync(fp).isDirectory()) { res.writeHead(404); return res.end(); }
  res.writeHead(200, { 'content-type': MIME[path.extname(fp)] || 'application/octet-stream' }); res.end(fs.readFileSync(fp));
});
const port = await new Promise(r => server.listen(0, () => r(server.address().port)));
// stub ES module theo tên import trong live.js (nguồn, không phải min)
const live = fs.readFileSync(path.join(ROOT, 'assets/js/live.js'), 'utf8');
const mods = {};
for (const m of live.matchAll(/import\s*\{([^}]*)\}\s*from\s*"https:\/\/www\.gstatic\.com\/firebasejs\/[\d.]+\/(firebase-[a-z]+)\.js"/g)) {
  const names = m[1].split(',').map(x => x.trim().split(/\s+as\s+/)[0]).filter(Boolean);
  mods[m[2]] = names;
}
const special = {
  initializeApp: 'x=>({name:"stub",options:x})', getAuth: '()=>({currentUser:null})', onAuthStateChanged: '(a,cb)=>{ setTimeout(()=>cb(null),50); return ()=>{}; }',
  getRedirectResult: '()=>Promise.resolve(null)', setPersistence: '()=>Promise.resolve()', getFirestore: '()=>({stub:1})', initializeFirestore: '()=>({stub:1,cache:1})',
  onSnapshot: '()=>()=>{}', getDoc: '()=>Promise.resolve({exists:()=>false,data:()=>null})', getDocs: '()=>Promise.resolve({forEach(){},size:0,empty:true,docs:[]})',
  isSupported: '()=>Promise.resolve(false)', serverTimestamp: '()=>({st:1})', deleteField: '()=>({df:1})', increment: 'n=>({inc:n})', arrayUnion: '(...v)=>({au:v})', arrayRemove: '(...v)=>({ar:v})',
  persistentLocalCache: 'x=>x', persistentMultipleTabManager: '()=>({})', GoogleAuthProvider: 'class{}', EmailAuthProvider: 'class{ static credential(){ return {}; } }', TotpMultiFactorGenerator: 'class{}', browserLocalPersistence: '{}'
};
const stubSrc = names => names.map(n => `export const ${n} = ${special[n] || '(...a)=>({stubCall:"' + n + '",a})'};`).join('\n');
const browser = await chromium.launch({ executablePath: fs.readdirSync('/opt/pw-browsers').filter(d => /chromium/.test(d)).map(d => ['/opt/pw-browsers/' + d + '/chrome-linux/headless_shell', '/opt/pw-browsers/' + d + '/chrome-linux/chrome']).flat().find(fs.existsSync), headless: true });
const page = await browser.newPage();
const errors = [], warns = [];
page.on('pageerror', e => errors.push('PAGEERROR: ' + e.message));
page.on('console', m => { if (m.type() === 'error') errors.push('CONSOLE: ' + m.text()); if (m.type() === 'warning') warns.push(m.text()); });
await page.route(/gstatic\.com\/firebasejs\/.*\/(firebase-[a-z]+)\.js/, r => { const name = r.request().url().match(/(firebase-[a-z]+)\.js/)[1]; r.fulfill({ status: 200, contentType: 'text/javascript', body: stubSrc(mods[name] || []) }); });
await page.route(/manifest\.webmanifest/, r => r.fulfill({ status: 200, headers: { date: new Date(Date.now() + 90000).toUTCString(), 'content-type': 'application/manifest+json' }, body: '{}' })); // server "nhanh" 90 s
await page.goto(`http://127.0.0.1:${port}/app.html`, { waitUntil: 'load' });
await page.waitForTimeout(1500);
const r = await page.evaluate(() => {
  const fb = window.SL_FB || null;
  const keys = fb ? Object.keys(fb).sort() : [];
  const wrapped = fb ? ['setUserRole', 'setConfig', 'setOutreach', 'deleteLead'].filter(k => typeof fb[k] === 'function' && /audit_log/.test(String(fb[k]))) : [];
  return { hasFb: !!fb, n: keys.length, keys, wrapped, down: window.SL_FB_DOWN, now: typeof window.SL_NOW === 'function' ? Math.round((window.SL_NOW() - Date.now()) / 1000) : null,
    login: !!document.querySelector('#authGate, .ag, #agBox, .auth-gate') || document.body.innerText.includes('Đăng nhập') };
});
await browser.close(); server.close();
console.log(JSON.stringify({ errors, hasFb: r.hasFb, n: r.n, wrapped: r.wrapped, down: r.down, clockOffSec: r.now, loginShown: r.login }, null, 1));
fs.writeFileSync(path.join(path.dirname(new URL(import.meta.url).pathname), 'keys.' + path.basename(ROOT) + '.json'), JSON.stringify(r.keys));
process.exit(errors.length ? 1 : 0);
