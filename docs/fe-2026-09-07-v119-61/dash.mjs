// Đổi " - " → " – " CHỈ trong string/template literal (espree tokenize), bỏ qua chuỗi có calc(/<style>/regex
import fs from 'node:fs'; import path from 'node:path';
import * as espree from 'espree';
const root=process.argv[2]; const files=process.argv.slice(3);
let total=0;
for(const rel of files){
  const p=path.join(root,rel); const src=fs.readFileSync(p,'utf8');
  const toks=espree.tokenize(src,{ecmaVersion:2024,sourceType:rel.includes('live.js')||rel.startsWith('src/')?'module':'script',range:true});
  const edits=[];
  for(const t of toks){
    if(t.type!=='String'&&t.type!=='Template') continue;
    const v=t.value; if(!v.includes(' - ')) continue;
    if(/calc\(|<style|new RegExp|\bpx - |% - /.test(v)) continue;
    // chỉ thay khi 2 bên là chữ/số/dấu câu (không phải toán tử giữa biểu thức ${a} - ${b})
    let nv=v.replace(/(?<=[A-Za-zÀ-ỹ0-9)\]”"'…?!%.>]) - (?=[A-Za-zÀ-ỹ0-9(\[“"'<«])/g,' – ');
    if(t.type==='Template'){ nv=nv.replace(/(?<=\}) - (?=[A-Za-zÀ-ỹ0-9(\[“"'<«])/g,' – ').replace(/(?<=[A-Za-zÀ-ỹ0-9)\]”"'…?!%.>]) - (?=\$\{)/g,' – '); }
    if(nv!==v){ edits.push([t.range[0],t.range[1],nv]); }
  }
  if(!edits.length) continue;
  let out='', last=0; for(const [a,b,nv] of edits){ out+=src.slice(last,a)+nv; last=b; } out+=src.slice(last);
  fs.writeFileSync(p,out); const n=edits.length; total+=n; console.log(rel, n);
}
console.log('DASH OK', total);
