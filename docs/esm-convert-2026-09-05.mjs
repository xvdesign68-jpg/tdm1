// esm_convert.mjs — chuyển src/app/*.js (part chung scope IIFE) → ES module thật (v120-esm)
//   node esm_convert.mjs <thư mục site>   (idempotent: đã có index.js → dừng)
// Dùng eslint-scope để lấy CHÍNH XÁC tên dùng chéo part (through refs của scope hàm bọc) → sinh import/export.
import fs from 'fs'; import path from 'path';
import * as espree from 'espree';
import * as eslintScope from 'eslint-scope';
const ROOT = path.resolve(process.argv[2]); const DIR = path.join(ROOT, 'src/app');
if (fs.existsSync(path.join(DIR, 'index.js'))) { console.log('ĐÃ CHUYỂN (có index.js)'); process.exit(0); }
const parts = fs.readdirSync(DIR).filter(f => /^\d{2}-[\w-]+\.js$/.test(f)).sort();
const BROWSER = new Set(['window','document','location','history','navigator','console','localStorage','sessionStorage','setTimeout','setInterval','clearTimeout','clearInterval','requestAnimationFrame','cancelAnimationFrame','fetch','alert','confirm','prompt','atob','btoa','performance','screen','getComputedStyle','matchMedia','Event','CustomEvent','KeyboardEvent','MouseEvent','URL','URLSearchParams','Blob','File','FileReader','FormData','AbortController','Image','Audio','DOMParser','MutationObserver','IntersectionObserver','ResizeObserver','Node','Element','HTMLElement','crypto','structuredClone','queueMicrotask','indexedDB','CSS','Notification',
  'Object','Array','String','Number','Boolean','Math','JSON','Date','RegExp','Error','TypeError','Promise','Map','Set','WeakMap','WeakSet','Symbol','parseInt','parseFloat','isNaN','isFinite','encodeURIComponent','decodeURIComponent','encodeURI','decodeURI','Intl','undefined','NaN','Infinity','Function','Reflect','Proxy','ArrayBuffer','Uint8Array','TextEncoder','TextDecoder','globalThis','arguments','escape','unescape','Chart','QRCode']);
// ---- phân tích ----
const info = {}; // part → { declared:Set, through:[{name,write,line}] }
function analyze(src) {
  const code = '(function(){\n' + src + '\n})();';
  const ast = espree.parse(code, { ecmaVersion: 'latest', sourceType: 'script', range: true, loc: true });
  const sm = eslintScope.analyze(ast, { ecmaVersion: 2022, sourceType: 'script' });
  const fn = ast.body[0].expression.callee;
  const scope = sm.acquire(fn);
  const declared = new Set(scope.variables.map(v => v.name).filter(n => n !== 'arguments'));
  const through = scope.through.map(r => ({ name: r.identifier.name, write: r.isWrite(), line: r.identifier.loc.start.line - 1 }));
  return { declared, through };
}
for (const f of parts) info[f] = analyze(fs.readFileSync(path.join(DIR, f), 'utf8'));
const owner = {}; for (const f of parts) for (const n of info[f].declared) { if (owner[n]) { console.error('TRÙNG TÊN top-level', n, owner[n], f); process.exit(2); } owner[n] = f; }
const unknown = new Set(); const writes = [];
for (const f of parts) for (const r of info[f].through) { if (!owner[r.name]) { if (!BROWSER.has(r.name)) unknown.add(r.name); } else if (r.write) writes.push(f + ':' + r.line + ' ' + r.name + ' (' + owner[r.name] + ')'); }
console.log('Tên tham chiếu KHÔNG thuộc part nào và không phải global trình duyệt:', [...unknown].join(' ') || '(không)');
console.log('GÁN chéo part (phải đi qua setter):\n  ' + (writes.join('\n  ') || '(không)'));
// ---- vá gán chéo part bằng setter (mốc chính xác, fail-closed) ----
const SETTERS = {
  '10-core-overview.js': ['\n  /* v120-esm: import là live binding CHỈ ĐỌC → part khác đổi D/SOFT_RELOAD phải qua setter */\n  function setD(v){ D=v; }\n  function setSoftReload(v){ SOFT_RELOAD=v; }\n'],
  '20-feed.js': ['\n  function setFeedQuery(v){ feedQuery=v; } // v120-esm: 70-shell-tools (ô tìm kiếm) đổi feedQuery qua setter\n'],
  '30-pipeline.js': ['\n  function setPipeFilter(v){ pipeFilter=v; } // v120-esm: 20-feed (card Hôm nay) đổi bộ lọc pipeline qua setter\n'],
};
const REPL = {
  '90-boot.js': [['      D = newData; window.SL_DATA = newData;', '      setD(newData); window.SL_DATA = newData; // v120-esm: setter (import chỉ đọc)'],
    ['      SOFT_RELOAD=true;\n      try{ go(meta[cur]?cur:\'overview\'); } finally { SOFT_RELOAD=false; }', '      setSoftReload(true); // v120-esm\n      try{ go(meta[cur]?cur:\'overview\'); } finally { setSoftReload(false); }']],
  '20-feed.js': [['    pipeFilter=map[key]||\'all\'; pvColMore.clear(); go(\'pipeline\');', '    setPipeFilter(map[key]||\'all\'); pvColMore.clear(); go(\'pipeline\'); // v120-esm: setter']],
  '70-shell-tools.js': [['    feedQuery = e.target.value || \'\';', '    setFeedQuery(e.target.value || \'\'); // v120-esm: setter']],
};
const src = {};
for (const f of parts) {
  let s = fs.readFileSync(path.join(DIR, f), 'utf8');
  for (const [a, b] of (REPL[f] || [])) { if (s.split(a).length !== 2) { console.error('MỐC vá không đúng 1 lần:', f, a.slice(0, 50)); process.exit(2); } s = s.replace(a, () => b); }
  if (SETTERS[f]) s = s.replace(/\s*$/, '\n') + SETTERS[f].join('');
  src[f] = s;
}
// phân tích lại sau vá → không còn gán chéo
for (const f of parts) info[f] = analyze(src[f]);
for (const f of parts) for (const n of info[f].declared) owner[n] = f;
for (const f of parts) for (const r of info[f].through) if (owner[r.name] && r.write) { console.error('VẪN CÒN gán chéo part sau vá:', f, r.line, r.name); process.exit(2); }
// ---- sinh import/export ----
const needed = {}; // owner part → Set(tên được part khác dùng)
for (const f of parts) for (const r of info[f].through) if (owner[r.name] && owner[r.name] !== f) (needed[owner[r.name]] = needed[owner[r.name]] || new Set()).add(r.name);
for (let i = 0; i < parts.length; i++) {
  const f = parts[i];
  const byOwner = {};
  for (const r of info[f].through) if (owner[r.name] && owner[r.name] !== f) (byOwner[owner[r.name]] = byOwner[owner[r.name]] || new Set()).add(r.name);
  const lines = [];
  lines.push(`/* v120-esm: ES module thật — sinh import/export bằng tools/esm-convert (eslint-scope). Thân part giữ NGUYÊN (còn thụt 2 khoảng như thời IIFE). */`);
  if (i > 0) lines.push(`import './${parts[i - 1]}'; // GIỮ THỨ TỰ ĐÁNH GIÁ theo tên file (mỗi part import part đứng trước nó ĐẦU TIÊN) = giống bản ghép IIFE cũ`);
  for (const o of parts) if (byOwner[o]) lines.push(`import { ${[...byOwner[o]].sort().join(', ')} } from './${o}';`);
  const exp = [...(needed[f] || [])].sort();
  const out = lines.join('\n') + '\n' + src[f] + (exp.length ? `\nexport { ${exp.join(', ')} };\n` : '');
  fs.writeFileSync(path.join(DIR, f), out);
  console.log(`${f}: import ${Object.values(byOwner).reduce((s, x) => s + x.size, 0)} tên từ ${Object.keys(byOwner).length} part · export ${exp.length}`);
}
fs.writeFileSync(path.join(DIR, 'index.js'), `/* index.js — ĐIỂM VÀO bundle app (v120-esm). tools/build.mjs: esbuild --bundle --format=iife → assets/js/app.js (+ min).
   Chỉ cần import part cuối: chuỗi "import part đứng trước" trong từng part kéo theo tất cả và ép thứ tự đánh giá 10 → 90
   (đúng thứ tự thân IIFE cũ; 90-boot chạy khối Init cuối cùng). */
import './${parts[parts.length - 1]}';
`);
try { fs.unlinkSync(path.join(DIR, '_wrapper.json')); } catch (_) { }
console.log('CHUYỂN XONG', parts.length, 'part + index.js');
