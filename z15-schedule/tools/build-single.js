#!/usr/bin/env node
/* Đóng gói toàn bộ app thành MỘT file HTML (inline CSS/JS/logo) để gửi nhanh hoặc mở offline.
   Dùng: node tools/build-single.js [out.html]   (mặc định: dist/z15-lich-lam-viec.html) */
const fs = require('fs'), path = require('path');
const root = path.resolve(__dirname, '..');
const out = process.argv[2] ? path.resolve(process.argv[2]) : path.join(root, 'dist', 'z15-lich-lam-viec.html');
let html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
const read = p => fs.readFileSync(path.join(root, p), 'utf8');
html = html.replace(/<link rel="stylesheet" href="([^"]+)">/g, (m, href) => `<style data-src="${href}">\n${read(href).replace(/<\/style/gi, '<\\/style')}\n</style>`);
html = html.replace(/<script src="([^"]+)"><\/script>/g, (m, src) => `<script data-src="${src}">\n${read(src).replace(/<\/script/gi, '<\\/script')}\n</script>`);
html = html.replace(/<link rel="icon" href="assets\/logo-mark.svg" type="image\/svg\+xml">/, () => `<link rel="icon" href="data:image/svg+xml;base64,${Buffer.from(read('assets/logo-mark.svg')).toString('base64')}">`);
fs.mkdirSync(path.dirname(out), { recursive: true });
fs.writeFileSync(out, html);
console.log('✓ ' + path.relative(process.cwd(), out) + ' · ' + (fs.statSync(out).size / 1024).toFixed(0) + ' KB');
