import re, sys, os
sys.path.insert(0, os.path.dirname(__file__))
from lib import *
import lib
lib.ROOT = sys.argv[1]
# 0. bỏ variation selector U+FE0F (chỉ đi kèm emoji; emoji còn lại sau M3 vẫn hiển thị đúng)
for f in sorted(os.listdir(os.path.join(lib.ROOT,'src/app'))):
    if not f.endswith('.js'): continue
    pp='src/app/'+f; s=rd(pp); s2=s.replace('\ufe0f','')
    if s2!=s: wr(pp,s2); lib._log.append('vs16 %s'%pp)

# ---- icons.js: bổ sung icon ----
p='assets/js/icons.js'
NEW = r"""
    /* v119-61: bổ sung để thay toàn bộ emoji giao diện */
    heart: s('<path d="M12 20.5s-7.5-4.6-7.5-10.1A4 4 0 0 1 12 8a4 4 0 0 1 7.5 2.4c0 5.5-7.5 10.1-7.5 10.1Z"/>'),
    settings: s('<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1Z"/>'),
    lock: s('<rect x="4.5" y="10.5" width="15" height="10" rx="2.5"/><path d="M8 10.5V7.5a4 4 0 0 1 8 0v3"/><circle cx="12" cy="15.5" r="1" fill="currentColor" stroke="none"/>'),
    ban: s('<circle cx="12" cy="12" r="8.5"/><path d="m6 6 12 12"/>'),
    monitor: s('<rect x="3" y="4" width="18" height="12" rx="2.5"/><path d="M8 20h8M12 16v4"/>'),
    bot: s('<rect x="4.5" y="8" width="15" height="11" rx="3"/><path d="M12 8V4.5M9 4.5h6"/><circle cx="9.5" cy="13" r="1.1" fill="currentColor" stroke="none"/><circle cx="14.5" cy="13" r="1.1" fill="currentColor" stroke="none"/><path d="M9.5 16.5h5"/>'),
    hand: s('<path d="M8 13V5.5a1.5 1.5 0 0 1 3 0V12M11 11.5V4.5a1.5 1.5 0 0 1 3 0V12M14 12V6a1.5 1.5 0 0 1 3 0v8.5a6 6 0 0 1-12 0v-3a1.5 1.5 0 0 1 3 0"/>'),
    book: s('<path d="M4 5.5A2.5 2.5 0 0 1 6.5 3H20v15H6.5A2.5 2.5 0 0 0 4 20.5V5.5Z"/><path d="M4 20.5A2.5 2.5 0 0 1 6.5 18H20"/>'),
    ruler: s('<path d="m3.5 16.5 13-13 4 4-13 13-4-4Z"/><path d="m8 12 1.6 1.6M11 9l1.6 1.6M14 6l1.6 1.6"/>'),
    card: s('<rect x="3" y="5.5" width="18" height="13" rx="2.5"/><path d="M3 10h18M7 15h4"/>'),
    cloud: s('<path d="M7 18.5a4 4 0 0 1-.6-7.95A5.5 5.5 0 0 1 17 9.5a4.5 4.5 0 0 1 .5 9H7Z"/>'),
    printer: s('<path d="M7 9V4h10v5"/><rect x="4" y="9" width="16" height="8" rx="2"/><path d="M7 14h10v6H7z"/>'),
    flask: s('<path d="M9.5 3.5h5M10 3.5v6L4.8 18.2A1.5 1.5 0 0 0 6.1 20.5h11.8a1.5 1.5 0 0 0 1.3-2.3L14 9.5v-6"/><path d="M7.5 15h9"/>'),
    clipboard: s('<rect x="5.5" y="5" width="13" height="16" rx="2"/><path d="M9 5a3 3 0 0 1 6 0M9 11h6M9 15h4"/>'),
    pause: s('<rect x="6.5" y="5" width="3.5" height="14" rx="1"/><rect x="14" y="5" width="3.5" height="14" rx="1"/>'),
    play: s('<path d="M7 5.5v13l11-6.5-11-6.5Z"/>'),
    phoneOff: s('<path d="M10.7 13.3a16 16 0 0 0 3.4 2.7l1.3-1.3a2 2 0 0 1 2.1-.5c.9.4 1.9.6 2.8.7a2 2 0 0 1 1.7 2.1v3a2 2 0 0 1-2.2 2 19.8 19.8 0 0 1-8.6-3.1M5.2 5.6A19.8 19.8 0 0 1 2.1 4.2 2 2 0 0 1 4.1 2h3a2 2 0 0 1 2 1.7c.1 1 .4 1.9.7 2.8a2 2 0 0 1-.4 2.1L8.1 9.9M3 3l18 18"/>'),
    userX: s('<circle cx="9.5" cy="8" r="3.5"/><path d="M3.5 20a6 6 0 0 1 12 0"/><path d="m17 9 4 4m0-4-4 4"/>'),
    tag: s('<path d="M3.5 12.5v-8a1 1 0 0 1 1-1h8l8 8-9 9-8-8Z"/><circle cx="8" cy="8" r="1.2" fill="currentColor" stroke="none"/>'),
    arrowDown: s('<path d="M12 4v15M5.5 12.5 12 19l6.5-6.5"/>'),
    wrench: s('<path d="M14.5 6.5a4 4 0 0 0 5 5l-9 9a2.1 2.1 0 0 1-3-3l9-9a4 4 0 0 0-2-2Z"/>'),
    coins: s('<ellipse cx="9" cy="7" rx="6" ry="2.5"/><path d="M3 7v5c0 1.4 2.7 2.5 6 2.5s6-1.1 6-2.5V7"/><path d="M3 12v5c0 1.4 2.7 2.5 6 2.5s6-1.1 6-2.5v-5M15 9.5c3 .2 6 1.2 6 2.5v5c0 1.4-2.7 2.5-6 2.5"/>'),
    siren: s('<path d="M12 3.5 3.5 18.5h17L12 3.5Z"/><path d="M12 9.5v4M12 16.5h.01"/>'),
    dotHot: '<i class="dot dot-hot" aria-hidden="true"></i>',
    dotWarm: '<i class="dot dot-warm" aria-hidden="true"></i>',
    dotCold: '<i class="dot dot-cold" aria-hidden="true"></i>',
    dotOk: '<i class="dot dot-ok" aria-hidden="true"></i>',
"""
rrep(p,r"(\n(\s*)mail:\s*s\()",lambda m: NEW+m.group(1),tag='icons.add')
assert 'heart: s(' in rd(p)

# ---- SLI.x||'emoji' fallback → SLI.x ----
for f in sorted(os.listdir(os.path.join(lib.ROOT,'src/app'))):
    if not f.endswith('.js'): continue
    pp='src/app/'+f; s=rd(pp)
    s2=re.sub(r"SLI\.(\w+)\s*\|\|\s*(?:'[^']*'|\"[^\"]*\")",r"SLI.\1",s)
    if s2!=s: wr(pp,s2); lib._log.append('fallback %s'%pp)

# ---- 70: Hộp việc – cờ leo thang thay tiền tố 🚨 ----
p='src/app/70-shell-tools.js'
rep(p,"const push=(kind,pri,l,txt,tone)=>{ if(seen.has(l.id)) return; seen.add(l.id); out.push({kind,pri,l,txt,tone,mine:isMine(l)}); };","const push=(kind,pri,l,txt,tone,escal)=>{ if(seen.has(l.id)) return; seen.add(l.id); out.push({kind,pri,l,txt,tone,escal:!!escal,mine:isMine(l)}); };",tag='tasks.push')
rep(p,"T.overdue.forEach(l=>push('overdue',0,l,(Date.now()-l.fu_at>864e5?'🚨 ':'')+'Quá hẹn '+fuAgo(l.fu_at)+(l.fu_note?' · '+l.fu_note:''),'hot'));","T.overdue.forEach(l=>push('overdue',0,l,'Quá hẹn '+fuAgo(l.fu_at)+(l.fu_note?' · '+l.fu_note:''),'hot',Date.now()-l.fu_at>864e5));",tag='tasks.overdue')
rrep(p,r"push\('hot',3,l,\(mins>=bad\?'🚨 ':''\)\+(.*?),'hot'\); \}\);",r"push('hot',3,l,\1,'hot',mins>=bad); });",tag='tasks.hot')
rep(p,"if(/^🚨/.test(t.txt)) o.esc++;","if(t.escal) o.esc++;",tag='tasks.count')
rep(p,"<span>${o.n} việc${o.esc?` · <i>${o.esc} 🚨</i>`:''}</span>","<span>${o.n} việc${o.esc?` · <i>${o.esc} ${SLI.siren}</i>`:''}</span>",tag='tasks.esc')
s=rd(p); i=s.find('function tkRow(t){'); j=s.find('\n',i); line=s[i:j]; assert 'esc(t.txt)' in line, 'tkRow txt'
line2=line.replace('${esc(t.txt)','${t.escal?SLI.siren+\' \':\'\'}${esc(t.txt)',1); assert line2!=line
wr(p,s[:i]+line2+s[j:]); lib._log.append('tasks.row')
rep(p,"const TK_GROUPS=[['overdue','⏰ Quá hẹn'],['replied','💬 Khách đã phản hồi'],['due','📅 Hẹn hôm nay'],['hot','🔥 Lead nóng chưa ai chăm'],['unassigned','👤 Chưa giao'],['value','💰 Chưa nhập giá trị đơn']];","const TK_GROUPS=[['overdue',SLI.clock+' Quá hẹn'],['replied',SLI.message+' Khách đã phản hồi'],['due',SLI.calendar+' Hẹn hôm nay'],['hot',SLI.flame+' Lead nóng chưa ai chăm'],['unassigned',SLI.user+' Chưa giao'],['value',SLI.coins+' Chưa nhập giá trị đơn']];",tag='tasks.groups')

# ---- 65: timeline – icon riêng, nhãn nick thay mã ----
p='src/app/65-charts-lead-modal.js'
rep(p,"const push=(t,txt,cls)=>{ const m=ms(t); if(m) ev.push({ms:m,txt,cls:cls||''}); };","const push=(t,txt,cls,ic)=>{ const m=ms(t); if(m) ev.push({ms:m,txt,cls:cls||'',ic:ic||''}); };",tag='tl.push')
for a,b in [
 ("push(m0,'🔎 Phát hiện lead từ '+(l.source||'nguồn')+(l.kind==='comment'?' (bình luận)':''),'sys');","push(m0,'Phát hiện lead từ '+(l.source||'nguồn')+(l.kind==='comment'?' (bình luận)':''),'sys',SLI.search);"),
 ("ev.push({ms:0,label:String(l.time||''),txt:'🔎 Phát hiện lead từ '+(l.source||'nguồn'),cls:'sys'});","ev.push({ms:0,label:String(l.time||''),txt:'Phát hiện lead từ '+(l.source||'nguồn'),cls:'sys',ic:SLI.search});"),
 ("push(l.assigned_at,'👤 Giao cho '+(l.assignee||'sales')+(l.assigned_by?' · '+l.assigned_by:''));","push(l.assigned_at,'Giao cho '+(l.assignee||'sales')+(l.assigned_by?' · '+l.assigned_by:''),'',SLI.user);"),
 ("push(l.first_care_at,'🖐 Chăm sóc lần đầu'+(l.first_care_by?' · '+l.first_care_by:''));","push(l.first_care_at,'Chăm sóc lần đầu'+(l.first_care_by?' · '+l.first_care_by:''),'',SLI.hand);"),
 ("push(l.last_touch_at,(TL_TOUCH[l.last_touch_kind]||'📞 Liên hệ')+(l.last_touch_by?' · '+l.last_touch_by:''));","push(l.last_touch_at,(TL_TOUCH[l.last_touch_kind]||'Liên hệ')+(l.last_touch_by?' · '+l.last_touch_by:''),'',TL_ICON[l.last_touch_kind]||SLI.phone);"),
 ("push(l.stage_at,'🔖 Chuyển sang '+(stageLabel[l.stage]||l.stage));","push(l.stage_at,'Chuyển sang '+(stageLabel[l.stage]||l.stage),'',SLI.bookmark);"),
 ("push(l.fu_at,'⏰ Hẹn chăm'+(l.fu_note?': '+l.fu_note:'')+(l.fu_at>Date.now()?' (sắp tới)':' (đã qua)'),'fu');","push(l.fu_at,'Hẹn chăm'+(l.fu_note?': '+l.fu_note:'')+(l.fu_at>Date.now()?' (sắp tới)':' (đã qua)'),'fu',SLI.clock);"),
 ("push(l.closed_at,'✅ Chốt deal'+(Number(l.deal_value)>0?' · '+fmtVnd(Number(l.deal_value)):(l.deal_value_pending?' · chưa nhập giá trị':''))+(l.closed_by?' · '+l.closed_by:''),'win');","push(l.closed_at,'Chốt deal'+(Number(l.deal_value)>0?' · '+fmtVnd(Number(l.deal_value)):(l.deal_value_pending?' · chưa nhập giá trị':''))+(l.closed_by?' · '+l.closed_by:''),'win',SLI.checkCircle);"),
 ("push(l.lost_at,'✕ Không thành · '+(l.lost_reason||'')+(l.lost_by?' · '+l.lost_by:''),'lost');","push(l.lost_at,'Không thành · '+(l.lost_reason||'')+(l.lost_by?' · '+l.lost_by:''),'lost',SLI.x);"),
 ("push(l.dropped_at,'🗑 Loại khỏi pipeline'+(l.dropped_by?' · '+l.dropped_by:''),'lost');","push(l.dropped_at,'Loại khỏi pipeline'+(l.dropped_by?' · '+l.dropped_by:''),'lost',SLI.trash);"),
 ("push(l.restored_at,'↩ Khôi phục về pipeline'+(l.restored_by?' · '+l.restored_by:''));","push(l.restored_at,'Khôi phục về pipeline'+(l.restored_by?' · '+l.restored_by:''),'',SLI.refresh);"),
 ("push(o.at,'🤖 Máy đã '+st.map(s=>OA_STEP_VI[s]||s).join(' → ')+(o.pid?' · nick '+o.pid:''),'bot');","push(o.at,'Máy đã '+st.map(s=>OA_STEP_VI[s]||s).join(' → ')+(o.pid?' · nick '+nickLabel(o.pid):''),'bot',SLI.bot);"),
 ("push(o.replied_at,'💬 Khách phản hồi qua inbox (máy phát hiện)','reply');","push(o.replied_at,'Khách phản hồi qua inbox (máy phát hiện)','reply',SLI.message);"),
 ("leadNotes(l.id).forEach(n=>{ if(n.at) push(n.at,'📝 '+(n.a||'')+': '+String(n.t||'').slice(0,140),'note'); });","leadNotes(l.id).forEach(n=>{ if(n.at) push(n.at,(n.a||'')+': '+String(n.t||'').slice(0,140),'note',SLI.edit); });"),
 ("<summary>🕘 Dòng thời gian 360° <span class=\"cnt\">${ev.length}</span></summary>","<summary>${SLI.clock} Dòng thời gian 360° <span class=\"cnt\">${ev.length}</span></summary>"),
 ("<span class=\"ld-tl-x\">${esc(e.txt)}</span>","<span class=\"ld-tl-x\">${e.ic?'<i class=\"ld-tl-ic\">'+e.ic+'</i>':''}${esc(e.txt)}</span>"),
 ("const TL_TOUCH={call:'📞 Đã bấm Gọi',zalo:'💬 Đã mở Zalo',sms:'✉ Đã bấm SMS',wrong:'❌ Không liên hệ được'};","const TL_TOUCH={call:'Đã bấm Gọi',zalo:'Đã mở Zalo',sms:'Đã bấm SMS',wrong:'Không liên hệ được'}; const TL_ICON={call:SLI.phone,zalo:SLI.message,sms:SLI.mail,wrong:SLI.x};"),
 ("<div class=\"cf-k\">✕ Đánh dấu KHÔNG THÀNH</div>","<div class=\"cf-k\">${SLI.x} Đánh dấu không thành</div>"),
]:
    rep(p,a,b,tag='tl')
p='src/app/20-feed.js'
rep(p,"  function botChip(l){","  /* v119-61: tên nick tự động (label) thay mã kỹ thuật; không có trong danh sách (sales) → 'tự động' */\n  function nickLabel(pid){ const a=(D.fbAccounts||[]).find(x=>x&&((x.id||x.pid)===pid||x.adspower_id===pid)); return a?(a.label||a.name||'tự động'):'tự động'; }\n  function botChip(l){",tag='nickLabel')
s=rd(p); seg=s[s.find('function botChip(l){'):s.find('function botChip(l){')+800]; print('BOTCHIP:',seg.replace('\n',' | ')[:760])
rep(p,"${l.dropped?'<span class=\"chip chip-junk\">🗑 ĐÃ LOẠI</span>':''}","${l.dropped?'<span class=\"chip chip-junk\">'+SLI.trash+' Đã loại</span>':''}",tag='feed.dropped')
rep(p,"<span class=\"chip chip-lost\">✕ KHÔNG THÀNH","<span class=\"chip chip-lost\">${SLI.x} Không thành",tag='feed.lost')
rep(p,"${x.l.phone?' <i class=\"tk-as\">📞</i>':''}","${x.l.phone?' <i class=\"tk-as\">'+SLI.phone+'</i>':''}",tag='feed.phone')
rep(p,"<div class=\"rk\" style=\"color:#b45309\">⚠ ĐANG HIỂN THỊ","<div class=\"rk\" style=\"color:#b45309\">${SLI.warning} Đang hiển thị",tag='feed.rk-warn')
s=rd(p); print('RK-WARN:', [l[:300] for l in s.split('\n') if 'Đang hiển thị' in l][:1])
p='src/app/80-rbac-auth.js'
rep(p,'<div style="font-size:42px;line-height:1">🕒</div>','<div class="ag-ic">${SLI.clock}</div>',tag='ag.clock')
rep(p,'<div style="font-size:42px;line-height:1">🏷</div>','<div class="ag-ic">${SLI.tag}</div>',tag='ag.tag')
rep('src/app/60-scan-views.js',"const scanMethodLabel = m => m==='facebook_nick' ? '👤 Nick FB' : '🌐 BrightData';","const scanMethodLabel = m => m==='facebook_nick' ? SLI.user+' Nick FB' : SLI.globe+' Bright Data';",tag='scan.label')
rep('src/app/45-outreach.js',"action: 'Thả cảm xúc ❤ vào bài viết của Lead'","action: 'Thả cảm xúc vào bài viết của Lead'",tag='oa.demo')
rep('src/app/45-outreach.js',"<h3>🖥 Máy chủ (VPS worker)</h3>","<h3>${SLI.monitor} Máy chủ (VPS)</h3>",tag='oa.vps')
rep('src/app/50-config-views.js',"<h3>📚 Bộ keyword theo ngành</h3>","<h3>${SLI.book} Bộ từ khoá theo ngành</h3>",tag='kw.lib')
rep('src/app/50-config-views.js',"chuông 🔔 và Hộp việc dùng cùng nguồn này","chuông và Hộp việc dùng cùng nguồn này",tag='al.bell')
rep('src/app/85-users-admin.js',"✨ Wizard brand mới</button>","${SLI.sparkle} Thêm brand mới</button>",tag='u.wiz')
rep('src/app/85-users-admin.js','placeholder="🔍 Gõ để tìm brand…"','placeholder="Gõ để tìm brand…"',tag='u.search')
done()
