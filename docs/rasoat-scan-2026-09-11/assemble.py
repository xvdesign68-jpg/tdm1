#!/usr/bin/env python3
"""Ghép findings.json từ workflow-result.json + seed-all.json + narrative.json + draft-pipeline.json. Chạy: python3 assemble.py && python3 build.py"""
import json, os, re
here=os.path.dirname(os.path.abspath(__file__)); L=lambda f: json.load(open(os.path.join(here,f),encoding='utf-8'))
R=L('workflow-result.json'); N=L('narrative.json'); P=L('draft-pipeline.json')
seed={s['id']:s for s in L('seed-all.json')}; new={x['id']:x for x in R['newFound']}
ORDER={'Cao':0,'Vừa':1,'Thấp':2}
def cut(s,n):
    s=(s or '').strip()
    if len(s)<=n: return s
    k=s.rfind('. ',0,n); k=k if k>n*0.6 else n
    return s[:k].rstrip()+'…'
def idkey(i):
    m=re.match(r'([A-Z]+\d?)-([A-Z]?)(\d+)',i); return (m.group(1),m.group(2),int(m.group(3))) if m else (i,'',0)
kept=[v for v in R['allVerified'] if v['status']!='refuted']
byid={v['id']:v for v in kept}
gof={}
for g,ids in N['group_of'].items():
    for i in ids: gof[i]=g
missing=[v['id'] for v in kept if v['id'] not in gof]
if missing: print('CHƯA GÁN NHÓM:',missing)
groups=[]
for gkey,gm in N['groups_meta'].items():
    items=[]
    for v in kept:
        if gof.get(v['id'])!=gkey: continue
        src=seed.get(v['id']) or new.get(v['id']) or {}
        big=v['sev'] in ('Cao','Vừa')
        conf=('Xác nhận' if v['status']=='confirmed' else 'Một phần')+(' · Suy luận' if 'Suy luận' in (v.get('reason','')) else '')
        if v['origSev']!=v['sev']: conf+=f" · {v['origSev']}→{v['sev']}"
        desc=cut(src.get('desc',''),900 if big else 420)
        if v['status']=='partial' or big:
            desc+=('\n' if desc else '')+'**Kiểm chứng:** '+cut(v.get('reason',''),750 if big else 260)
        fix=cut(src.get('fix',''),700 if big else 320)
        fn=v.get('fixNote','')
        if fn and (big or not fix): fix+=('\n' if fix else '')+'**Ghi chú:** '+cut(fn,480 if big else 280)
        items.append({'id':v['id'],'sev':v['sev'],'title':v['title'],'where':cut(src.get('where',''),420),'desc':desc,'fix':fix,'conf':conf})
    items.sort(key=lambda f:(ORDER[f['sev']],idkey(f['id'])))
    groups.append({'key':gkey,'title':gm['title'],'short':gm['short'],'intro':gm['intro'],'findings':items})
refuted=[]
title_of={**{k:s['title'] for k,s in seed.items()},**{k:x['title'] for k,x in new.items()}}
for r in R['refuted']: refuted.append({'id':r['id'],'title':title_of.get(r['id'],''),'reason':cut(r['reason'],420)})
# proposals
props={p['id']:p for p in R['proposals']}
judges=R.get('judged') or []
jrank=[{r['id']:r for r in j['ranked']} for j in judges]
tier_of={}
for t,ids in N['tiers'].items():
    for i in ids: tier_of[i]=t
out_props=[]
for t in ['Đợt 1','Đợt 2','Đợt 3']:
    for i in N['tiers'][t]:
        p=dict(props[i]); p['tier']=t
        jt=[]
        for k,jr in enumerate(jrank):
            if i in jr: jt.append(f"GK{k+1}: {jr[i]['tier']} · {jr[i]['score']}")
        p['judge']=' / '.join(jt)
        if i in N['merged']: p['merged']=N['merged'][i]
        out_props.append(p)
crit=R.get('critic')
lenh=N['lenh']
method=N['method']
if crit:
    lc=crit.get('lenhChiDoc') or []
    if lc: lenh=N.get('lenh_intro',N['lenh'])+'\n'+'\n'.join(f"{i+1}. {x}" for i,x in enumerate(lc))
    gaps=crit.get('gaps') or []
    if gaps: lenh+='\n\n**Mảng chưa rà (critic):** '+' · '.join(f"**{g.get('area','')}** — {cut(g.get('what',''),260)}" for g in gaps)
    unv=crit.get('unverified') or []
    if unv: method+='\n\n**Critic — còn dựa Suy luận / verdict yếu ('+str(len(unv))+' nhóm):** '+' · '.join(cut(x,220) for x in unv)
    con=crit.get('contradictions') or []
    if con: method+='\n\n**Critic — '+str(len(con))+' mâu thuẫn đề xuất ↔ verdict, đã xử lý ở mục "Điều chỉnh sau critic":** '+' · '.join(cut(x,200) for x in con)
J={'critic_adjust':N.get('critic_adjust',[]),'meta':N['meta'],'summary':N['summary'],'pipeline_intro':N['pipeline_intro'],'pipeline':P['pipeline'],'verify':{'intro':N['verify']['intro'],'kpis':N['verify']['kpis'],'refuted':refuted},'scorecard':N['scorecard'],'groups':groups,'props_intro':N['props_intro'],'proposals':out_props,'roadmap':N['roadmap'],'questions':N['questions'],'lenh':lenh,'method':method}
json.dump(J,open(os.path.join(here,'findings.json'),'w',encoding='utf-8'),ensure_ascii=False,indent=1)
from collections import Counter
print('findings',sum(len(g['findings']) for g in groups),Counter(f['sev'] for g in groups for f in g['findings']),'props',len(out_props),'judges',len(judges),'critic',bool(crit))
