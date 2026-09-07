// Thay emoji giao dien bang SLI.<icon> theo token (espree): Template -> ${SLI.x}; String -> noi chuoi; attr/option/toast/textContent/label -> go emoji
import fs from 'node:fs'; import path from 'node:path'; import * as espree from 'espree';
const root=process.argv[2]; const files=process.argv.slice(3);
const MAP={'\u{2713}':'check','\u{2714}':'check','\u{2705}':'checkCircle','\u{2715}':'x','\u{274C}':'x','\u{2717}':'x','\u{26A0}':'warning','\u{2699}':'settings','\u{26A1}':'bolt','\u{1F50E}':'search','\u{1F50D}':'search','\u{1F91D}':'handshake','\u{1F590}':'hand','\u{1F464}':'user','\u{2764}':'heart','\u{1F6A8}':'siren','\u{1F512}':'lock','\u{1F4E9}':'inbox','\u{26D4}':'ban','\u{1F916}':'bot','\u{1F4DE}':'phone','\u{1F4C5}':'calendar','\u{1F4B0}':'coins','\u{1F3AF}':'target','\u{270D}':'edit','\u{1F5D1}':'trash','\u{1F5A5}':'monitor','\u{1F514}':'bell','\u{1F310}':'globe','\u{2728}':'sparkle','\u{1F9E0}':'brain','\u{1F6E1}':'shield','\u{1F680}':'rocket','\u{1F525}':'flame','\u{1F504}':'refresh','\u{1F501}':'refresh','\u{1F4F5}':'phoneOff','\u{1F4C8}':'trendUp','\u{1F4B3}':'card','\u{1F4A1}':'lightbulb','\u{1F465}':'users','\u{2709}':'mail','\u{1F9FE}':'fileText','\u{1F9EA}':'flask','\u{1F6E0}':'wrench','\u{1F645}':'userX','\u{1F5A8}':'printer','\u{1F558}':'clock','\u{1F552}':'clock','\u{23F0}':'clock','\u{23F3}':'clock','\u{23F8}':'pause','\u{25B6}':'play','\u{23F1}':'clock','\u{1F53B}':'trendDown','\u{1F517}':'link','\u{1F516}':'bookmark','\u{1F511}':'key','\u{1F4DD}':'edit','\u{1F4DA}':'book','\u{1F4D0}':'ruler','\u{1F4CB}':'clipboard','\u{1F4C4}':'fileText','\u{1F441}':'eye','\u{1F3F7}':'tag','\u{1F3EA}':'store','\u{2B07}':'arrowDown','\u{2601}':'cloud','\u{1F4AC}':'message','\u{1F4E7}':'mail','\u{2708}':'send','\u{1F4CA}':'table','\u{1F389}':'checkCircle','\u{1F534}':'dotHot','\u{1F7E0}':'dotWarm','\u{1F535}':'dotCold','\u{1F7E2}':'dotOk'};
const EMO=/([\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}\u{2B00}-\u{2BFF}\u{1F000}-\u{1F2FF}\u{2300}-\u{23FF}\u{25A0}-\u{25FF}])️?/gu;
const STRIP_FN=new Set(['toast','sysNote','alert','Error','warn','log','addLog','confirm','prompt','slConfirm','slPrompt']);
const STRIP_PROP=new Set(['textContent','title','placeholder','innerText','value']);
const STRIP_KEY=new Set(['label','text','title','placeholder','txt','name','desc','tip']);
const log=[]; let total=0, stripped=0;
for(const rel of files){
  const p=path.join(root,rel); const src=fs.readFileSync(p,'utf8');
  const toks=espree.tokenize(src,{ecmaVersion:2024,sourceType:'module',range:true,loc:true});
  const edits=[];
  toks.forEach((t,ti)=>{
    if(t.type!=='String'&&t.type!=='Template') return;
    const v=t.value; EMO.lastIndex=0; if(!EMO.test(v)) return; EMO.lastIndex=0;
    if(v.includes('asst-')||v.includes('\u{1F44B}')) return; // mascot giu nguyen
    let stripCtx='';
    const prev=toks[ti-1], prev2=toks[ti-2], prev3=toks[ti-3];
    if(prev&&prev.value==='('&&prev2&&STRIP_FN.has(prev2.value)) stripCtx='fn:'+prev2.value;
    if(prev&&prev.value==='='&&prev2&&STRIP_PROP.has(prev2.value)&&prev3&&prev3.value==='.') stripCtx='prop:'+prev2.value;
    if(prev&&prev.value===':'&&prev2&&STRIP_KEY.has(String(prev2.value).replace(/['"]/g,''))) stripCtx='key:'+prev2.value;
    const isTpl=t.type==='Template'; const q=isTpl?'':v[0];
    const inner=isTpl?v:v.slice(1,-1);
    const parts=[]; let last=0, m; const re=new RegExp(EMO.source,'gu'); let changed=false;
    while((m=re.exec(inner))){
      const ch=m[1], name=MAP[ch]; const at=m.index, end=at+m[0].length;
      if(!name){ log.push(`${rel}:${t.loc.start.line} ${ch} (khong map)`); continue; }
      const before=inner.slice(0,at);
      // trong the (<...>) hay trong noi dung? chunk template co the bat dau giua the ("> ...) -> dua vao vi tri < va > gan nhat
      const lt=before.lastIndexOf('<'), gt=before.lastIndexOf('>');
      const inTag=lt>=0&&lt>gt;
      const inAttr=inTag&&((before.slice(lt).split('"').length-1)%2===1);
      const lastOpt=before.lastIndexOf('<option'), lastOptE=before.lastIndexOf('</option');
      const inOpt=lastOpt>=0&&lastOpt>lastOptE;
      let action;
      if(stripCtx||inAttr||inOpt) action='strip';
      else if(isTpl) action='tpl';
      else { const atStart=before.trim()===''; const hasHtml=inner.includes('<'); action=(atStart||hasHtml)?'cat':'strip'; }
      parts.push({kind:'s',v:inner.slice(last,at)});
      if(action==='strip'){ stripped++; if(inner[end]===' ') last=end+1; else { last=end; const pp=parts[parts.length-1]; pp.v=pp.v.replace(/ $/,''); } }
      else if(action==='tpl'){ parts.push({kind:'s',v:'${SLI.'+name+'}'}); last=end; }
      else { parts.push({kind:'i',v:name}); last=end; }
      changed=true; total++;
      log.push(`${rel}:${t.loc.start.line} ${ch} -> ${action==='strip'?'(go'+(stripCtx?' '+stripCtx:inAttr?' attr':inOpt?' option':' giua')+')':'SLI.'+name} | ${inner.slice(Math.max(0,at-40),at+40).replace(/\s+/g,' ')}`);
    }
    if(!changed) return;
    parts.push({kind:'s',v:inner.slice(last)});
    let nv;
    if(isTpl) nv=parts.map(x=>x.v).join('');
    else {
      // dung bieu thuc noi chuoi: 'a'+SLI.x+'b' ; bo doan rong
      const segs=[]; for(const x of parts){ if(x.kind==='s'){ if(x.v!=='') segs.push(q+x.v+q); } else segs.push('SLI.'+x.v); }
      nv=segs.length?segs.join('+'):q+q;
      if(segs.length>1&&!segs.some(s=>s.startsWith('SLI.'))) nv=q+parts.map(x=>x.v).join('')+q;
    }
    edits.push([t.range[0],t.range[1],nv]);
  });
  if(!edits.length) continue;
  let o='', l=0; for(const [a,b,nv] of edits){ o+=src.slice(l,a)+nv; l=b; } o+=src.slice(l);
  fs.writeFileSync(p,o); console.log(rel, edits.length,'token');
}
fs.writeFileSync(path.join(root,'tools/_m3.log'),log.join('\n'));
console.log('M3 OK', total, 'thay/go', stripped,'go');
