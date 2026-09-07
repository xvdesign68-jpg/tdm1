import re,io,sys
root=sys.argv[1]
KEEP=('.side-group','.brand-name small','.pb-badge','.sidebar-hotline-label','.floating-hotline-label')
for rel in ['assets/css/app.css','assets/css/pipeline-v2.css']:
    p=root+'/'+rel; s=io.open(p,encoding='utf-8').read()
    out=[]; i=0; n=0
    # duyệt từng rule { ... } (bỏ qua @media lồng: xử lý theo khối nhỏ nhất)
    for m in re.finditer(r'([^{}]+)\{([^{}]*)\}', s):
        sel=m.group(1).strip().split('\n')[-1].strip(); body=m.group(2)
        if 'text-transform' in body and 'uppercase' in body and not any(k in sel for k in KEEP):
            nb=re.sub(r'\s*text-transform:\s*uppercase;?','',body)
            nb=re.sub(r'letter-spacing:\s*[\d.]+(?:em|px);?','letter-spacing: .01em;',nb)
            # cỡ chữ nhãn nhỏ: nâng lên tối thiểu 11px cho dễ đọc khi không còn caps
            def fs(mm):
                v=float(mm.group(1)); return 'font-size: %spx;'%('11' if v<11 else mm.group(1))
            nb=re.sub(r'font-size:\s*([\d.]+)px;?',fs,nb)
            out.append((m.start(2),m.end(2),nb)); n+=1
    last=0; res=''
    for a,b,nb in out: res+=s[last:a]+nb; last=b
    res+=s[last:]
    io.open(p,'w',encoding='utf-8').write(res); print(rel,'rules de-capped:',n)
