// LENH #35 (06/09/2026) — CHỈ ĐỌC: so Rules ĐANG CHẠY trên Firestore với file firestore.rules của ~/firebase-s13; liệt kê ruleset gần đây (ai deploy lúc nào);
// in block outreach_stats/outreach_log/workers/daily_stats + helper isSuperAdmin/isActiveUser/myBrand của bản ĐANG CHẠY. Không ghi gì.
import fs from 'fs'; import { execSync } from 'child_process';
const P = 'smartlead-z15';
const tok = execSync('gcloud auth print-access-token', { encoding: 'utf8' }).trim();
const get = async (path) => { const r = await fetch('https://firebaserules.googleapis.com/v1/' + path, { headers: { Authorization: 'Bearer ' + tok } }); const j = await r.json(); if (!r.ok) throw new Error(path + ' → HTTP ' + r.status + ' ' + JSON.stringify(j).slice(0, 200)); return j; };
const vn = s => s ? new Date(s).toLocaleString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh' }) : '-';
const rel = await get('projects/' + P + '/releases');
const fsRel = (rel.releases || []).find(r => r.name.endsWith('/cloud.firestore'));
console.log('== RELEASE cloud.firestore ==');
console.log(' ruleset đang chạy:', fsRel ? fsRel.rulesetName.split('/').pop() : '(không thấy)', '| tạo', vn(fsRel && fsRel.createTime), '| cập nhật (lần release gần nhất)', vn(fsRel && fsRel.updateTime));
(rel.releases || []).filter(r => !r.name.endsWith('/cloud.firestore')).forEach(r => console.log(' release khác:', r.name.split('/').pop(), '→', r.rulesetName.split('/').pop(), vn(r.updateTime)));
const rs = await get('projects/' + P + '/rulesets?pageSize=8');
console.log('== 8 RULESET mới nhất (mỗi lần deploy rules = 1 ruleset) ==');
(rs.rulesets || []).forEach(r => console.log(' -', r.name.split('/').pop(), vn(r.createTime), r.name === (fsRel && fsRel.rulesetName) ? '← ĐANG CHẠY' : ''));
if (!fsRel) process.exit(1);
const full = await get(fsRel.rulesetName);
const src = ((full.source || {}).files || []).map(f => f.content).join('\n');
fs.writeFileSync(process.env.HOME + '/rules-deployed.txt', src);
const local = fs.existsSync(process.env.HOME + '/firebase-s13/firestore.rules') ? fs.readFileSync(process.env.HOME + '/firebase-s13/firestore.rules', 'utf8') : '';
console.log('== SO SÁNH == đang chạy:', src.length, 'ký tự,', src.split('\n').length, 'dòng | file local ~/firebase-s13/firestore.rules:', local.length, 'ký tự,', local.split('\n').length, 'dòng →', local && local.trim() === src.trim() ? 'GIỐNG NHAU' : 'KHÁC NHAU (xem diff bên dưới)');
const blocks = ['outreach_stats', 'outreach_log', 'workers', 'worker_config', 'daily_stats', 'system_status', 'audit_log', 'fb_accounts', 'brands', 'leads', 'config', 'notes'];
console.log('== BLOCK có trong bản ĐANG CHẠY ==');
blocks.forEach(b => { const re = new RegExp('match\\s+/' + b + '/'); console.log(' ', re.test(src) ? '✓' : '✗ THIẾU', b, '| local:', re.test(local) ? '✓' : '✗'); });
const blk = (s, name) => { const one = s.match(new RegExp('^[ \\t]*match\\s+/' + name + '/\\{[^}]*\\}\\s*\\{[^\\n]*\\}[ \\t]*$', 'm')); if (one) return one[0]; const m = s.match(new RegExp('([ \\t]*)match\\s+/' + name + '/\\{[^}]*\\}\\s*\\{[\\s\\S]*?\\n\\1\\}')); return m ? m[0] : '(không thấy)'; };
console.log('== BLOCK outreach_stats (ĐANG CHẠY) ==\n' + blk(src, 'outreach_stats'));
console.log('== BLOCK outreach_log (ĐANG CHẠY) ==\n' + blk(src, 'outreach_log'));
console.log('== BLOCK workers (ĐANG CHẠY) ==\n' + blk(src, 'workers'));
const fn = (s, name) => { const m = s.match(new RegExp('function\\s+' + name + '\\s*\\([^)]*\\)\\s*\\{[\\s\\S]*?\\n\\s*\\}')); return m ? m[0] : '(không thấy)'; };
console.log('== HELPER (ĐANG CHẠY) ==');
['isSuperAdmin', 'isActiveUser', 'myBrand', 'userExists', 'me'].forEach(n => console.log(fn(src, n)));
if (local && local.trim() !== src.trim()) {
  const a = local.split('\n'), b = src.split('\n'); const onlyLocal = a.filter(l => l.trim() && !b.includes(l)), onlyDep = b.filter(l => l.trim() && !a.includes(l));
  console.log('== DÒNG CHỈ CÓ Ở LOCAL (' + onlyLocal.length + ') ==\n' + onlyLocal.slice(0, 40).join('\n'));
  console.log('== DÒNG CHỈ CÓ Ở BẢN ĐANG CHẠY (' + onlyDep.length + ') ==\n' + onlyDep.slice(0, 40).join('\n'));
}
