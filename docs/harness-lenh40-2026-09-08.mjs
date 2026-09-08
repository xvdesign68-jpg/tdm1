/* harness LỆNH #40 — dựng stats.js = LỆNH #17 (docs/lenh-2026-09-04-nhom3.md) + #36 (docs/lenh-2026-09-06-36-stats-patch.cjs) + #40 (docs/lenh-2026-09-08-40-stats-patch.cjs)
   trong thư mục tạm có firebase-admin/firebase-functions GIẢ → import thật → kiểm slaInc/slaBadOf/statsEvents(opts)/backfill slaAgg/Rules patch. Chạy: node docs/harness-lenh40-2026-09-08.mjs */
import fs from 'fs'; import path from 'path'; import os from 'os'; import { execFileSync } from 'child_process'; import { pathToFileURL } from 'url';
const D = path.dirname(new URL(import.meta.url).pathname);
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'l40-')); const fn = path.join(tmp, 'functions'); fs.mkdirSync(fn);
/* stub SDK */
const nm = path.join(fn, 'node_modules'); fs.mkdirSync(path.join(nm, 'firebase-admin'), { recursive: true }); fs.mkdirSync(path.join(nm, 'firebase-functions', 'v2'), { recursive: true });
fs.writeFileSync(path.join(nm, 'firebase-admin', 'package.json'), JSON.stringify({ name: 'firebase-admin', exports: { './app': './app.js', './firestore': './firestore.js' } }));
fs.writeFileSync(path.join(nm, 'firebase-admin', 'app.js'), "export const initializeApp=()=>({}); export const getApps=()=>[{}]; export const applicationDefault=()=>({});");
fs.writeFileSync(path.join(nm, 'firebase-admin', 'firestore.js'), `globalThis.__docs = globalThis.__docs || {}; globalThis.__reads = 0;
const docRef = p => ({ get: async () => { globalThis.__reads++; const d = globalThis.__docs[p]; return { exists: !!d, data: () => d }; }, set: async () => {} });
export const getFirestore = () => ({ collection: c => ({ doc: id => docRef(c + '/' + id) }), batch: () => ({ set() {}, commit: async () => {} }) });
export const FieldValue = { increment: n => ({ inc: n }) };`);
fs.writeFileSync(path.join(nm, 'firebase-functions', 'package.json'), JSON.stringify({ name: 'firebase-functions', exports: { './v2/firestore': './v2/firestore.js' } }));
fs.writeFileSync(path.join(nm, 'firebase-functions', 'v2', 'firestore.js'), "export const onDocumentWritten=(o,f)=>({o,f}); export const onDocumentCreated=(o,f)=>({o,f});");
/* stats.js gốc LỆNH #17 từ heredoc trong .md */
const md = fs.readFileSync(path.join(D, 'lenh-2026-09-04-nhom3.md'), 'utf8'); const m17 = md.match(/cat > stats\.js <<'EOF_STATS'\n([\s\S]*?)\nEOF_STATS/); if (!m17) throw new Error('không thấy stats.js trong lenh-2026-09-04-nhom3.md');
const S = path.join(fn, 'stats.js'); fs.writeFileSync(S, m17[1] + '\n');
let ok = 0, fail = 0; const t = (name, c) => { if (c) ok++; else { fail++; console.log('FAIL', name); } };
const run = (cjs, arg) => execFileSync('node', [path.join(D, cjs), arg], { encoding: 'utf8' }).trim();
/* (14) #40 áp thẳng lên bản #17 (không có #36) cũng phải qua */
fs.copyFileSync(S, path.join(fn, 'stats17.js')); t('#40 trên bản #17 thuần', /PATCH OK/.test(run('lenh-2026-09-08-40-stats-patch.cjs', path.join(fn, 'stats17.js'))));
/* #36 rồi #40 (đúng thứ tự thật) + idempotent */
t('#36 patch', /PATCH OK/.test(run('lenh-2026-09-06-36-stats-patch.cjs', S)));
t('#40 patch', /PATCH OK/.test(run('lenh-2026-09-08-40-stats-patch.cjs', S)));
t('#40 idempotent', /ĐÃ patch/.test(run('lenh-2026-09-08-40-stats-patch.cjs', S)));
execFileSync('node', ['--check', S]);
const m = await import(pathToFileURL(S).href);
t('export slaInc/slaBadOf/statsEvents', typeof m.slaInc === 'function' && typeof m.slaBadOf === 'function' && typeof m.statsEvents === 'function' && typeof m.contentEvents === 'function');
const det = Date.parse('2026-09-08T01:00:00Z'); // 08:00 VN 08/09
const mk = (fcMin, extra) => Object.assign({ brand: 'x', temp: 'hot', detected_at: det, first_care_at: det + fcMin * 60000, stage: 'new' }, extra || {});
const inc = (evs, day) => Object.assign({}, ...evs.filter(e => e.day === day).map(e => e.inc));
let ev = m.statsEvents({ first_care_at: null, stage: 'new' }, mk(40), Date.now(), { slaBad: 45 }); let i = inc(ev, '2026-09-08');
t('40′ ≤ 45′ → slaN 1 slaOk 1 (cùng ngày với careN)', i.slaN === 1 && i.slaOk === 1 && i.careN === 1 && i.careLe60 === 1 && i.contacted === 1);
ev = m.statsEvents({ first_care_at: null }, mk(300), Date.now(), { slaBad: 60 }); i = inc(ev, '2026-09-08');
t('300′ > 60′ → slaN 1, không slaOk', i.slaN === 1 && i.slaOk == null);
ev = m.statsEvents({ first_care_at: null }, mk(50), Date.now()); i = inc(ev, '2026-09-08');
t('không opts → ngưỡng 60 mặc định', i.slaN === 1 && i.slaOk === 1);
const det2 = Date.parse('2026-09-07T20:00:00Z'); // 03:00 VN 08/09; chăm lúc 08:00Z 08/09 = 15:00 VN
ev = m.statsEvents({ first_care_at: null }, { brand: 'x', temp: 'warm', detected_at: det2, first_care_at: Date.parse('2026-09-08T08:00:00Z') }, Date.now(), { slaBad: 60 });
t('ghi lên NGÀY PHÁT HIỆN (VN)', ev.some(e => e.day === '2026-09-08' && e.inc.slaN === 1 && !e.inc.slaOk));
const det3 = Date.parse('2026-09-07T10:00:00Z'); // 17:00 VN 07/09; chăm 08/09 → careN ngày 08, slaN ngày 07
ev = m.statsEvents({ first_care_at: null }, { brand: 'x', temp: 'warm', detected_at: det3, first_care_at: Date.parse('2026-09-08T02:00:00Z') }, Date.now(), { slaBad: 60 });
t('khác ngày: careN ngày chăm, slaN ngày phát hiện', inc(ev, '2026-09-08').careN === 1 && inc(ev, '2026-09-07').slaN === 1 && inc(ev, '2026-09-08').slaN == null);
t('lead rác không có slaN', inc(m.statsEvents({ first_care_at: null }, mk(10, { temp: 'junk' }), Date.now(), { slaBad: 60 }), '2026-09-08').slaN == null);
t('đã có first_care_at từ trước → không sự kiện sla', m.statsEvents(mk(10), mk(10, { stage: 'inbox' }), Date.now(), { slaBad: 60 }).every(e => !e.inc.slaN));
t('≥30 ngày → bỏ (như careN)', inc(m.statsEvents({ first_care_at: null }, mk(31 * 1440), Date.now(), { slaBad: 60 }), '2026-09-08').slaN == null);
/* slaBadOf: không có sự kiện chăm → 60 không đọc DB; có → brand > config > 60, cache */
globalThis.__docs = { 'brands/x': { slaBadMin: 45 }, 'config/app': { slaBadMin: 30 } }; globalThis.__reads = 0;
t('slaBadOf: không chăm lần đầu → 60, 0 read', (await m.slaBadOf('x', null, { first_care_at: null })) === 60 && (await m.slaBadOf('x', { first_care_at: 5 }, { first_care_at: 5 })) === 60 && globalThis.__reads === 0);
t('slaBadOf: brand 45', (await m.slaBadOf('x', null, { first_care_at: 5 })) === 45);
t('slaBadOf: brand không có → config 30; brand lạ → 60 khi không config', (await m.slaBadOf('y', null, { first_care_at: 5 })) === 30);
const r0 = globalThis.__reads; await m.slaBadOf('x', null, { first_care_at: 5 }); t('slaBadOf: cache (không đọc lại)', globalThis.__reads === r0);
/* backfill thuần */
fs.copyFileSync(path.join(D, 'lenh-2026-09-08-40-backfill.mjs'), path.join(fn, '_l40_backfill.mjs')); const B = await import(pathToFileURL(path.join(fn, '_l40_backfill.mjs')).href);
const badOf = B.badOfFactory([{ code: 'a', slaBadMin: 45 }, { code: 'b' }], { slaBadMin: 30 });
t('badOfFactory: brand 45 · global 30 · mặc định', badOf('a') === 45 && badOf('b') === 30 && badOf('zz') === 30 && B.badOfFactory([], {})('q') === 60);
const agg = B.slaAgg([
  { brand: 'a', temp: 'hot', detected_at: det, first_care_at: det + 40 * 60000 }, { brand: 'a', temp: 'warm', detected_at: det + 3600e3, first_care_at: det + 3 * 3600e3 },
  { brand: 'a', temp: 'cold', detected_at: det }, { brand: 'a', temp: 'junk', detected_at: det, first_care_at: det + 60000 }, { brand: 'b', temp: 'hot', detected_at: det2, first_care_at: det2 + 20 * 60000 },
  { brand: '', temp: 'hot', detected_at: det, first_care_at: det + 1 }, { brand: 'a', temp: 'hot', first_care_at: det }, { brand: 'a', temp: 'hot', detected_at: Date.parse('2026-06-01T00:00:00Z'), first_care_at: Date.parse('2026-06-01T00:10:00Z') }
], badOf, '2026-08-01');
t('slaAgg: a 08/09 slaN 2 slaOk 1 (bỏ rác/chưa chăm) · b theo ngày VN', agg['a__2026-09-08'] && agg['a__2026-09-08'].slaN === 2 && agg['a__2026-09-08'].slaOk === 1 && agg['b__2026-09-08'] && agg['b__2026-09-08'].slaOk === 1 && Object.keys(agg).length === 2);
/* Rules patch */
const R = path.join(tmp, 'firestore.rules'); fs.writeFileSync(R, `rules_version = '2';\nservice cloud.firestore {\n  match /databases/{database}/documents {\n    match /leads/{id} {\n      allow read: if true;\n      allow update: if (isActiveUser())\n        && (isSuperAdmin() || request.resource.data.diff(resource.data).affectedKeys().hasOnly(['stage', 'stage_at', 'first_care_at', 'views'])); // v119-42\n    }\n  }\n}\n`);
t('Rules patch thêm stage_log', /PATCH OK/.test(run('lenh-2026-09-08-40-rules.cjs', R)) && /'views', 'stage_log'\]\)/.test(fs.readFileSync(R, 'utf8')));
t('Rules idempotent', /ĐÃ CÓ/.test(run('lenh-2026-09-08-40-rules.cjs', R)));
fs.rmSync(tmp, { recursive: true, force: true });
console.log(ok + '/' + (ok + fail) + ' PASS'); process.exit(fail ? 1 : 0);
