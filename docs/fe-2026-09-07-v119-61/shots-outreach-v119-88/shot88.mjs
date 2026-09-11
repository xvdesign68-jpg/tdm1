import { chromium } from 'playwright-core'; import http from 'http'; import fs from 'fs'; import path from 'path';
const ROOT = '/tmp/claude-0/-home-user-tdm1/a3bfa096-63d8-54a0-bde2-ab4d4bbc2672/scratchpad/shots88/site'; const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.png': 'image/png', '.svg': 'image/svg+xml', '.json': 'application/json', '.webmanifest': 'application/manifest+json', '.woff2': 'font/woff2' };
const server = http.createServer((req, res) => { const u = decodeURIComponent(req.url.split('?')[0]); const fp = path.join(ROOT, u === '/' ? 'app.html' : u); if (!fp.startsWith(ROOT) || !fs.existsSync(fp) || fs.statSync(fp).isDirectory()) { res.writeHead(404); return res.end(); } res.writeHead(200, { 'content-type': MIME[path.extname(fp)] || 'application/octet-stream' }); res.end(fs.readFileSync(fp)); });
const port = await new Promise(r => server.listen(0, () => r(server.address().port)));
const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium', args: ['--no-sandbox'] });
const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
await page.goto(`http://127.0.0.1:${port}/app.html#outreach`); await page.waitForTimeout(2500);
await page.evaluate(() => { location.hash = 'outreach'; window.SLApp.reload(window.SL_DATA); }); await page.waitForTimeout(900);
await page.screenshot({ path: '/tmp/claude-0/-home-user-tdm1/a3bfa096-63d8-54a0-bde2-ab4d4bbc2672/scratchpad/shots88/outreach-cards-1440.png', clip: { x: 0, y: 0, width: 1440, height: 1000 } });
const acc = await page.$('.oa-arow'); if (acc) { await acc.scrollIntoViewIfNeeded(); await page.waitForTimeout(300); await page.screenshot({ path: '/tmp/claude-0/-home-user-tdm1/a3bfa096-63d8-54a0-bde2-ab4d4bbc2672/scratchpad/shots88/outreach-accounts-1440.png' }); }
await page.evaluate(() => { document.querySelector('.oa-card [data-oa-cfg]').click(); }); await page.waitForTimeout(500);
await page.screenshot({ path: '/tmp/claude-0/-home-user-tdm1/a3bfa096-63d8-54a0-bde2-ab4d4bbc2672/scratchpad/shots88/outreach-cfg-modal-1440.png' });
await page.evaluate(() => { const c = document.getElementById('oaCfgCancel'); if (c) c.click(); location.hash = 'alerts'; window.SLApp.reload(window.SL_DATA); }); await page.waitForTimeout(700);
await page.screenshot({ path: '/tmp/claude-0/-home-user-tdm1/a3bfa096-63d8-54a0-bde2-ab4d4bbc2672/scratchpad/shots88/alerts-1440.png', clip: { x: 0, y: 0, width: 1440, height: 700 } });
await browser.close(); server.close(); console.log('shots ok');
