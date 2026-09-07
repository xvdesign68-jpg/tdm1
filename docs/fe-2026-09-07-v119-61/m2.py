import re, sys, os
sys.path.insert(0, os.path.dirname(__file__))
from lib import *
import lib
lib.ROOT = sys.argv[1]

# ---------- 1. errMsg + slDialog (10-core) ----------
p='src/app/10-core-overview.js'
rep(p,"  const meta = {\n","""  /* v119-61: thông báo lỗi cho người dùng – dịch mã lỗi (Firebase/mạng) sang câu tiếng Việt ngắn, không dán mã kỹ thuật lên toast */
  function errMsg(e, what){
    const c=String((e&&e.code)||'').toLowerCase(), m=String((e&&e.message)||(typeof e==='string'?e:'')||'');
    const cm=c+' '+m.toLowerCase();
    let why;
    if(/permission-denied|insufficient-permission|permission_denied/.test(cm)) why='bạn không có quyền thực hiện thao tác này';
    else if(/unauthenticated|token-expired|id-token-revoked|user-token-expired/.test(cm)) why='phiên đăng nhập đã hết hạn, hãy đăng nhập lại';
    else if(/requires-recent-login/.test(cm)) why='vì bảo mật, hãy đăng xuất rồi đăng nhập lại trước khi thao tác';
    else if(/too-many-requests/.test(cm)) why='thử sai nhiều lần, đợi vài phút rồi thử lại';
    else if(/wrong-password|invalid-credential|invalid-login/.test(cm)) why='mật khẩu không đúng';
    else if(/unavailable|network|deadline|timeout|timed out|failed to fetch|aborted|load failed|err_/.test(cm)) why='mất kết nối máy chủ, hãy thử lại sau ít phút';
    else if(/failed-precondition/.test(cm)) why='máy chủ chưa sẵn sàng cho thao tác này, hãy báo quản trị viên';
    else if(/not-found/.test(cm)) why='không tìm thấy dữ liệu, có thể đã bị xoá';
    else if(/already-exists/.test(cm)) why='dữ liệu đã tồn tại';
    else if(/resource-exhausted|quota/.test(cm)) why='hệ thống đang quá tải, thử lại sau';
    else if(/invalid-argument/.test(cm)) why='dữ liệu gửi lên không hợp lệ';
    else { const s=m.replace(/^firebase(error)?:?\\s*/i,'').replace(/\\s*\\([a-z/_-]+\\)\\.?$/i,'').trim(); why=(s||'lỗi không xác định').slice(0,140); }
    return (what||'Không thực hiện được')+': '+why+'.';
  }
  /* v119-61: hộp thoại xác nhận / nhập của app (thay confirm()/prompt() của trình duyệt) – trả Promise; Esc = huỷ, Enter = đồng ý */
  function slDialog(o){
    o=o||{};
    return new Promise(res=>{
      const old=document.getElementById('slDlg'); if(old) old.remove();
      const isP=o.type==='prompt';
      const w=document.createElement('div'); w.id='slDlg'; w.className='sl-dlg'+(o.danger?' danger':'');
      const txt=o.text?(o.html?o.text:esc(o.text).replace(/\\n/g,'<br>')):'';
      w.innerHTML=`<div class="sl-dlg-back"></div><div class="sl-dlg-box" role="${isP?'dialog':'alertdialog'}" aria-modal="true" aria-labelledby="slDlgT">
        <h4 id="slDlgT">${esc(o.title||(isP?'Nhập thông tin':'Xác nhận'))}</h4>
        ${txt?`<p>${txt}</p>`:''}
        ${isP?`<label class="sl-dlg-lbl">${o.label?`<span>${esc(o.label)}</span>`:''}<input class="acs-in" id="slDlgIn" type="${esc(o.inputType||'text')}" value="${esc(o.value==null?'':String(o.value))}" placeholder="${esc(o.placeholder||'')}"${o.inputMode?` inputmode="${esc(o.inputMode)}"`:''}></label>`:''}
        <div class="sl-dlg-act"><button type="button" class="btn btn-ghost btn-sm" data-dlg="0">${esc(o.cancel||'Huỷ')}</button><button type="button" class="btn ${o.danger?'btn-danger':'btn-primary'} btn-sm" data-dlg="1">${esc(o.ok||(isP?'Lưu':'Đồng ý'))}</button></div></div>`;
      document.body.appendChild(w);
      const inp=w.querySelector('#slDlgIn'); const prevFocus=document.activeElement;
      const fin=v=>{ document.removeEventListener('keydown',onKey,true); w.classList.remove('show'); setTimeout(()=>w.remove(),150); try{ prevFocus&&prevFocus.focus&&prevFocus.focus(); }catch(e){} res(v); };
      const okF=()=>fin(isP?(inp?inp.value:''):true), noF=()=>fin(isP?null:false);
      const onKey=ev=>{ if(ev.key==='Escape'){ ev.stopPropagation(); ev.preventDefault(); noF(); } else if(ev.key==='Enter'&&(!isP||ev.target===inp)){ ev.stopPropagation(); ev.preventDefault(); okF(); } };
      w.querySelector('[data-dlg="0"]').addEventListener('click',noF);
      w.querySelector('[data-dlg="1"]').addEventListener('click',okF);
      w.querySelector('.sl-dlg-back').addEventListener('click',noF);
      document.addEventListener('keydown',onKey,true);
      requestAnimationFrame(()=>{ w.classList.add('show'); const f=inp||w.querySelector('[data-dlg="1"]'); f.focus(); if(inp) inp.select(); });
    });
  }
  const slConfirm=(text,o)=>slDialog(Object.assign({type:'confirm',text},typeof o==='string'?{title:o}:(o||{})));
  const slPrompt=(text,value,o)=>slDialog(Object.assign({type:'prompt',text,value},o||{}));
  window.SLDlg={confirm:slConfirm,prompt:slPrompt,dialog:slDialog}; // smoke/harness có thể stub

  const meta = {
""",tag='1.errMsg+slDialog')

# ---------- 2. toast('Lỗi...: '+expr) → errMsg ----------
MAP={'':None,' lưu':'Không lưu được',' xoá':'Không xoá được',' xoá lead':'Không xoá được lead',' tải thêm':'Không tải thêm được',' thêm nick':'Không thêm được nick',' lưu ảnh':'Không lưu được ảnh',' gán VPS':'Không gán được máy chủ',' giao lead':'Không giao được lead',' cập nhật':'Không cập nhật được',' đổi brand':'Không đổi được brand'}
def fix_err(p):
    s=rd(p); out=[]; i=0; n=0; skipped=[]
    pat=re.compile(r"'Lỗi([^':]*): ?'\s*\+\s*")
    while True:
        m=pat.search(s,i)
        if not m: out.append(s[i:]); break
        out.append(s[i:m.start()]); j=m.end()
        if s[j]!='(': out.append(s[m.start():j]); i=j; continue
        # balanced parens
        depth=0; k=j
        while k<len(s):
            if s[k]=='(': depth+=1
            elif s[k]==')':
                depth-=1
                if depth==0: k+=1; break
            k+=1
        expr=s[j:k]
        var='err' if re.search(r'\berr\b',expr) else 'e'
        if re.fullmatch(r"[()\s]*(?:%s(?:\.code|\.message)?|&&|\|\||'thử lại'|[()\s])*"%var, expr) and re.search(r'\.code|\.message',expr):
            kind=m.group(1)
            if kind not in MAP: skipped.append((kind,expr)); out.append(s[m.start():k]); i=k; continue
            what=MAP[kind]
            out.append('errMsg(%s%s)'%(var, (",'%s'"%what) if what else '')); n+=1; i=k
        else:
            skipped.append((m.group(1),expr)); out.append(s[m.start():k]); i=k
    wr(p,''.join(out)); return n,skipped
tot=0
for p in ['src/app/%s'%f for f in os.listdir(os.path.join(lib.ROOT,'src/app')) if f.endswith('.js')]+['assets/js/live.js']:
    n,sk=fix_err(p); tot+=n
    if sk: print('SKIP',p,sk)
print('errMsg replaced',tot); assert tot>=50
# các ca đặc biệt
p='src/app/70-shell-tools.js'
rep(p,"        :'Lỗi 2FA: '+(c||(e&&e.message)||e);","        :errMsg(e,'Không đổi được 2FA');",tag='2.tfErr')
rep(p,"'Lỗi đổi mật khẩu: '+(c||(e&&e.message)||e)","errMsg(e,'Không đổi được mật khẩu')",tag='2.pw')
rep('src/app/80-rbac-auth.js',"'Lỗi đăng nhập: '+((e&&e.message)||c)","errMsg(e,'Không đăng nhập được')",tag='2.login')
rep('src/app/80-rbac-auth.js',"'Lỗi xác thực: '+(c||(e&&e.message)||e)","errMsg(e,'Không xác thực được')",tag='2.mfa')
rep(p,"toast(c==='sl/no-vapid'?'Chưa cấu hình VAPID_KEY (Super Admin cần thêm vào firebase-config) - báo quản trị.':c==='sl/denied'?'Bạn chưa cho phép thông báo.':(errMsg(e)));","toast(c==='sl/no-vapid'?'Thông báo đẩy chưa được bật cho hệ thống – báo quản trị viên giúp bạn.':c==='sl/denied'?'Bạn chưa cho phép thông báo.':errMsg(e,'Không bật được thông báo'));",tag='2.vapid')
p='src/app/85-users-admin.js'
rep(p,"esc(/permission-denied/.test(c)?'Rules audit_log chưa deploy (LỆNH #8) - nhật ký đang được ghi nhưng chưa đọc được.':/failed-precondition/.test(c)?'Thiếu index audit_log.atMs (LỆNH #8).':(errMsg(e)))","esc(/permission-denied/.test(c)?'Nhật ký đang được ghi nhưng chưa mở để đọc – báo quản trị viên.':/failed-precondition/.test(c)?'Máy chủ chưa sẵn sàng đọc nhật ký – báo quản trị viên.':(errMsg(e)))",tag='2.audit')
p='src/app/65-charts-lead-modal.js'
rep(p,"toast('⚠️ Lỗi nick: ' + j.error + ' - thử thêm/đổi nick hoặc chuyển về Bright Data.');","toast('Nick quét gặp lỗi: ' + j.error + ' – thử thêm/đổi nick hoặc chuyển về Bright Data.');",tag='2.nick')

# ---------- 3. confirm()/prompt() → slConfirm/slPrompt ----------
def asyncify(p, anchor, tag):
    """thêm `async ` cho handler addEventListener gần nhất đứng TRƯỚC anchor"""
    s=rd(p); i=s.find(anchor); assert i>=0, 'asyncify anchor '+tag
    m=None
    for mm in re.finditer(r"addEventListener\('(?:click|change)',\s*", s[:i]): m=mm
    assert m and i-m.end()<900, 'asyncify handler xa: '+tag+' %d'%(i-m.end() if m else -1)
    head=s[m.end():m.end()+6]
    if head.startswith('async'): return
    s=s[:m.end()]+'async '+s[m.end():]; wr(p,s); lib._log.append('asyncify %s %s'%(p,tag))
p='src/app/10-core-overview.js'
rep(p,"document.getElementById('bdSetBudget')?.addEventListener('click',(ev)=>{ ev.preventDefault();\n        const cur=(D&&D.bdBudget)||''; const v=window.prompt('Đặt HẠN MỨC chi tiêu Bright Data mỗi tháng (USD). Để trống = bỏ hạn mức:', cur);",
      "document.getElementById('bdSetBudget')?.addEventListener('click',async (ev)=>{ ev.preventDefault();\n        const cur=(D&&D.bdBudget)||''; const v=await slPrompt('Để trống = bỏ hạn mức. Hệ thống cảnh báo khi chi tiêu sắp vượt.', cur, {title:'Hạn mức chi tiêu Bright Data mỗi tháng (USD)', inputType:'number', ok:'Đặt hạn mức'});",tag='3.bdBudget')
rep(p,"document.getElementById('bdSetFx')?.addEventListener('click',(ev)=>{ ev.preventDefault();\n        const cur=(D&&D.bdFx)||26500; const v=window.prompt('Tỷ giá quy đổi USD → VND dùng cho bảng cân đối (₫/USD):', cur);",
      "document.getElementById('bdSetFx')?.addEventListener('click',async (ev)=>{ ev.preventDefault();\n        const cur=(D&&D.bdFx)||26500; const v=await slPrompt('Dùng cho bảng cân đối chi phí theo brand.', cur, {title:'Tỷ giá quy đổi USD → VND (₫/USD)', inputType:'number', ok:'Đặt tỷ giá'});",tag='3.bdFx')
rep(p,"document.getElementById('aiSetCredit')?.addEventListener('click',(ev)=>{ ev.preventDefault();\n        const cur=(D&&D.openaiCredit)||{};\n        const v=window.prompt('Tổng credit OpenAI đã nạp (USD) - cộng hết các lần nạp thuộc đợt này:', cur.amountUsd||'');",
      "document.getElementById('aiSetCredit')?.addEventListener('click',async (ev)=>{ ev.preventDefault();\n        const cur=(D&&D.openaiCredit)||{};\n        const v=await slPrompt('Cộng hết các lần nạp thuộc đợt này.', cur.amountUsd||'', {title:'Tổng credit OpenAI đã nạp (USD)', inputType:'number', ok:'Tiếp tục'});",tag='3.aiCredit1')
rep(p,"const d0=window.prompt('Tính chi phí AI TỪ NGÀY nào? (YYYY-MM-DD - thường là ngày nạp lần đầu của đợt):', cur.since||new Date().toISOString().slice(0,10));",
      "const d0=await slPrompt('Thường là ngày nạp lần đầu của đợt.', cur.since||new Date().toISOString().slice(0,10), {title:'Tính chi phí AI từ ngày', inputType:'date', ok:'Lưu'});",tag='3.aiCredit2')
rep(p,"if(!dt){ toast('Ngày không hợp lệ - nhập dạng YYYY-MM-DD, ví dụ 2026-08-01.'); return; }","if(!dt){ toast('Ngày không hợp lệ – chọn lại ngày.'); return; }",tag='3.aiCredit3')
p='src/app/30-pipeline.js'
rep(p,"""    if(btnJunk) btnJunk.addEventListener('click',()=>{""","""    if(btnJunk) btnJunk.addEventListener('click',async()=>{""",tag='3.junk-async')
rep(p,"""      if(!confirm('Loại '+elig.length+' lead rác (chưa giao, còn ở "Mới") khỏi pipeline?'+(skip?'\\n'+skip+' lead đã giao/đã chăm sẽ được GIỮ LẠI.':'')+'\\nLead vẫn còn trong kho (chip "Rác · Loại" ở Lead feed) và khôi phục được.')) return;""",
      """      if(!await slConfirm((skip?skip+' lead đã giao/đã chăm sẽ được giữ lại.\\n':'')+'Lead vẫn còn trong kho (chip "Rác · Loại" ở Lead mới) và khôi phục được.',{title:'Loại '+elig.length+' lead rác (chưa giao, còn ở "Mới") khỏi pipeline?',ok:'Loại '+elig.length+' lead',danger:true})) return;""",tag='3.junk')
p='src/app/45-outreach.js'
rep(p,"if (cpAi) cpAi.addEventListener('click', () => { const t = document.getElementById('csIntro'); if (!t) return; if (t.value.trim() && !window.confirm('Ghi đè hồ sơ đang soạn bằng Hồ sơ AI?')) return;",
      "if (cpAi) cpAi.addEventListener('click', async () => { const t = document.getElementById('csIntro'); if (!t) return; if (t.value.trim() && !await slConfirm('Nội dung đang soạn sẽ bị thay bằng Hồ sơ AI của brand.',{title:'Ghi đè hồ sơ đang soạn?',ok:'Ghi đè'})) return;",tag='3.csCopyAi')
rep(p,"""    root.querySelectorAll('button[data-oa-worker-pause]').forEach(btn => btn.addEventListener('click', () => {""","""    root.querySelectorAll('button[data-oa-worker-pause]').forEach(btn => btn.addEventListener('click', async () => {""",tag='3.pause-async')
rep(p,"""      if (on && !confirm('DỪNG TẤT CẢ trên VPS "' + wid + '"?\\nWorker ngừng nhận việc mới; phễu đang chạy dừng ở bước kế và tự hẹn lại khi bỏ dừng.')) return;""",
      """      if (on && !await slConfirm('Máy chủ ngừng nhận việc mới; phễu đang chạy dừng ở bước kế và tự hẹn lại khi bỏ dừng.',{title:'Dừng tất cả trên máy chủ "' + wid + '"?',ok:'Dừng tất cả',danger:true})) return;""",tag='3.pause')
rep(p,"toast(on ? ('⏸ Đã DỪNG TẤT CẢ trên \"' + wid + '\" — worker áp dụng trong ~15 giây.') : ('▶ \"' + wid + '\" chạy lại.'));","toast(on ? ('Đã dừng tất cả trên \"' + wid + '\" – máy chủ áp dụng trong ~15 giây.') : ('\"' + wid + '\" chạy lại.'));",tag='3.pause-toast')
asyncify(p,"const val = prompt('Dán AdsPower Profile ID của nick này (mã cột ID trong AdsPower):', cur);",'3.adsId')
rep(p,"const val = prompt('Dán AdsPower Profile ID của nick này (mã cột ID trong AdsPower):', cur);","const val = await slPrompt('Mã ở cột ID của profile trong AdsPower.', cur, {title:'AdsPower Profile ID của nick', ok:'Gán'});",tag='3.adsId2')
asyncify(p,"if (!confirm('Xoá nick này khỏi hệ thống? Token tương ứng cũng bị xoá.')) return;",'3.delNick')
rep(p,"if (!confirm('Xoá nick này khỏi hệ thống? Token tương ứng cũng bị xoá.')) return;","if (!await slConfirm('Token tương ứng cũng bị xoá, không khôi phục được.',{title:'Xoá nick này khỏi hệ thống?',ok:'Xoá nick',danger:true})) return;",tag='3.delNick2')
p='src/app/50-config-views.js'
rep(p,"      if(!confirm('Xoá nguồn quét này?')) return;","      if(!await slConfirm('Lead đã quét từ nguồn này vẫn được giữ.',{title:'Xoá nguồn quét này?',ok:'Xoá nguồn',danger:true})) return;",tag='3.delSrc')
rep(p,"""      btn.addEventListener('click', ()=>{
        const next = !isAutoScanOn();
        const confirmMsg = next
          ? 'BẬT quét tự động - hệ thống sẽ tự quét mỗi 3 phút, tốn Bright Data + token AI. Xác nhận?'
          : 'TẮT quét tự động - hệ thống sẽ DỪNG quét theo lịch. Bạn chỉ quét được bằng nút "Quét ngay". Xác nhận?';
        if(!confirm(confirmMsg)) return;""","""      btn.addEventListener('click', async ()=>{
        const next = !isAutoScanOn();
        const confirmMsg = next
          ? 'Hệ thống sẽ tự quét mọi nguồn mỗi 3 phút (tốn chi phí Bright Data và AI).'
          : 'Hệ thống dừng quét theo lịch. Bạn chỉ quét được bằng nút "Quét ngay".';
        if(!await slConfirm(confirmMsg,{title:next?'Bật quét tự động?':'Tắt quét tự động?',ok:next?'Bật':'Tắt'})) return;""",tag='3.autoscan')
rep(p,"toast(next ? '✅ Đã BẬT quét tự động.' : '🔴 Đã TẮT quét tự động.');","toast(next ? 'Đã bật quét tự động.' : 'Đã tắt quét tự động.');",tag='3.autoscan-toast')
p='src/app/65-charts-lead-modal.js'
rep(p,"""      if(!confirm('Xoá vĩnh viễn lead #'+(leadNo(l.id)||'?')+' - "'+(l.name||'')+'"?\\nHành động này KHÔNG thể hoàn tác.')) return;""","""      if(!await slConfirm('Hành động này không thể hoàn tác.',{title:'Xoá vĩnh viễn lead #'+(leadNo(l.id)||'?')+' – "'+(l.name||'')+'"?',ok:'Xoá vĩnh viễn',danger:true})) return;""",tag='3.delLead')
rep(p,"""  function checkNickAvailable(){
    if(getScanMethod()!=='facebook_nick') return true;
    const nicks = getActiveNicks();
    if(nicks.length > 0) return true;
    // Hỏi user: fallback sang Bright Data hay huỷ?
    const ok = confirm(
      '⚠️ Phương thức quét đang là "Nick Facebook" nhưng KHÔNG CÓ nick nào đang hoạt động.\\n\\n' +
      '• Bấm OK → tạm dùng Bright Data cho lần quét này (không đổi cài đặt).\\n' +
      '• Bấm Cancel → huỷ, bạn thêm nick trước rồi quét.\\n\\n' +
      'Thêm nick ở: Nguồn quét → Tài khoản quét.'
    );
    return ok ? 'fallback_brightdata' : false;
  }""","""  async function checkNickAvailable(){
    if(getScanMethod()!=='facebook_nick') return true;
    const nicks = getActiveNicks();
    if(nicks.length > 0) return true;
    // Hỏi user: tạm dùng Bright Data hay huỷ?
    const ok = await slConfirm('Phương thức quét đang là "Nick Facebook" nhưng chưa có nick nào hoạt động.\\nĐồng ý: tạm dùng Bright Data cho lần quét này (không đổi cài đặt).\\nHuỷ: thêm nick ở Nguồn quét → Tài khoản quét rồi quét sau.',{title:'Chưa có nick quét',ok:'Dùng Bright Data lần này'});
    return ok ? 'fallback_brightdata' : false;
  }""",tag='3.nick')
rep(p,"    const nickCheck = checkNickAvailable();","    const nickCheck = await checkNickAvailable();",tag='3.nick-call')
p='src/app/70-shell-tools.js'
rep(p,"    document.getElementById('bfRun').addEventListener('click',()=>{","    document.getElementById('bfRun').addEventListener('click',async()=>{",tag='3.bfRun-async')
rep(p,"const bfNickCheck = (bfScanMethod==='facebook_nick') ? checkNickAvailable() : true;","const bfNickCheck = (bfScanMethod==='facebook_nick') ? await checkNickAvailable() : true;",tag='3.bfRun-nick')
p='src/app/85-users-admin.js'
rep(p,"""sel.addEventListener('change',()=>{
      const uid=sel.dataset.urole, role=sel.value;
      if(!confirm('Đổi vai trò tài khoản này thành "'+(sel.options[sel.selectedIndex]||{}).text+'"?\\nQuyền có hiệu lực ngay ở lần tải dữ liệu kế tiếp của họ.')){""","""sel.addEventListener('change',async()=>{
      const uid=sel.dataset.urole, role=sel.value;
      if(!await slConfirm('Quyền có hiệu lực ngay ở lần tải dữ liệu kế tiếp của họ.',{title:'Đổi vai trò tài khoản này thành "'+(sel.options[sel.selectedIndex]||{}).text+'"?',ok:'Đổi vai trò'})){""",tag='3.role')
rep(p,"""    view.querySelectorAll('[data-utoggle]').forEach(b=>b.addEventListener('click',()=>{
      const uid=b.dataset.utoggle, on=b.dataset.on==='1';""","""    view.querySelectorAll('[data-utoggle]').forEach(b=>b.addEventListener('click',async()=>{
      const uid=b.dataset.utoggle, on=b.dataset.on==='1';""",tag='3.lock-async')
rep(p,"if(on&&!window.confirm('Khoá tài khoản này? Người dùng sẽ bị đăng xuất và không đăng nhập lại được cho tới khi mở khoá.')) return;","if(on&&!await slConfirm('Người dùng sẽ bị đăng xuất và không đăng nhập lại được cho tới khi mở khoá.',{title:'Khoá tài khoản này?',ok:'Khoá tài khoản',danger:true})) return;",tag='3.lock')
rep(p,"'Đã khoá mềm (chặn dữ liệu). Khoá cứng Auth cần deploy CF setUserLock (LỆNH #10).'","'Đã khoá mềm (chặn dữ liệu); chặn đăng nhập sẽ có khi máy chủ được bật tính năng khoá cứng.'",tag='3.lock-msg')
asyncify(p,"if(!confirm('Từ chối tài khoản này? Họ vẫn ở trạng thái chờ duyệt và không truy cập được.')) return;",'3.reject')
rep(p,"if(!confirm('Từ chối tài khoản này? Họ vẫn ở trạng thái chờ duyệt và không truy cập được.')) return;","if(!await slConfirm('Họ vẫn ở trạng thái chờ duyệt và không truy cập được.',{title:'Từ chối tài khoản này?',ok:'Từ chối',danger:true})) return;",tag='3.reject2')
asyncify(p,"const v=window.prompt('Tên hiển thị mới cho brand ['+code+']:',cur);",'3.rename')
rep(p,"const v=window.prompt('Tên hiển thị mới cho brand ['+code+']:',cur);","const v=await slPrompt('', cur, {title:'Tên hiển thị mới cho brand '+code, ok:'Đổi tên'});",tag='3.rename2')
rep(p,"if(aiLib) aiLib.addEventListener('change',()=>{ const it=INDUSTRY_LIB.find(x=>x.key===aiLib.value); aiLib.value=''; if(!it) return;","if(aiLib) aiLib.addEventListener('change',async()=>{ const it=INDUSTRY_LIB.find(x=>x.key===aiLib.value); aiLib.value=''; if(!it) return;",tag='3.aiLib-async')
rep(p,"if(has&&!window.confirm('Ghi đè Hồ sơ AI đang soạn bằng mẫu ngành \"'+it.label+'\"?')) return;","if(has&&!await slConfirm('Bốn ô hồ sơ đang soạn sẽ được thay bằng mẫu ngành.',{title:'Ghi đè Hồ sơ AI bằng mẫu \"'+it.label+'\"?',ok:'Ghi đè'})) return;",tag='3.aiLib')
asyncify(p,"if(!confirm('Xoá logo của brand '+code+'? Khung tên sẽ quay về hiện chữ cái đầu.')) return;",'3.logo')
rep(p,"if(!confirm('Xoá logo của brand '+code+'? Khung tên sẽ quay về hiện chữ cái đầu.')) return;","if(!await slConfirm('Khung tên sẽ quay về hiện chữ cái đầu.',{title:'Xoá logo của brand '+code+'?',ok:'Xoá logo',danger:true})) return;",tag='3.logo2')
asyncify(p,"if(!confirm('Xoá nhân viên sales này khỏi danh sách nhận thông báo Zalo?')) return;",'3.sales')
rep(p,"if(!confirm('Xoá nhân viên sales này khỏi danh sách nhận thông báo Zalo?')) return;","if(!await slConfirm('Người này sẽ không nhận thông báo lead qua Zalo nữa.',{title:'Xoá khỏi danh sách nhận Zalo?',ok:'Xoá',danger:true})) return;",tag='3.sales2')
# kiểm không còn confirm/prompt native
for f in os.listdir(os.path.join(lib.ROOT,'src/app')):
    if not f.endswith('.js'): continue
    s=rd('src/app/'+f)
    left=[l for l in s.split('\n') if re.search(r"(?<![\w.])(?:window\.)?(?:confirm|prompt)\(",l) and not l.strip().startswith(('//','/*','*'))]
    assert not left, f+' con confirm/prompt: '+str([x[:120] for x in left])

# ---------- 4. chữ kỹ thuật → chữ người dùng ----------
p='src/app/25-agency.js'
rep(p,"""${D.dailyStatsErr?'Không đọc được <code>daily_stats</code> ('+esc(D.dailyStatsErr)+') - ':'Chưa có counter <code>daily_stats</code> - '}số liệu đang <b>ước tính từ lead đã nạp</b> (cửa sổ realtime, brand lớn có thể thiếu). Chạy <b>LỆNH #17</b> (CF <code>statsOnLead</code> + backfill 35 ngày + Rules) để có số chính xác mọi quy mô.""",
      """${D.dailyStatsErr?'Chưa đọc được thống kê theo ngày từ máy chủ – ':'Máy chủ chưa có thống kê theo ngày – '}số liệu đang <b>ước tính từ lead đã nạp</b> (brand lớn có thể thiếu). Số chính xác sẽ hiện khi thống kê theo ngày được bật.""",tag='4.agency')
p='src/app/45-outreach.js'
rep(p,"Cần backend LỆNH #34 + worker 2026-09-06c; số liệu tự hiện khi máy gửi inbox.","Số liệu tự hiện sau khi máy gửi inbox.",tag='4.oa214')
rep(p,"""<span class="muted" style="font-weight:400;font-size:11px">(gọi Cloud Function genContent - cần deploy backend)</span>""","""<span class="muted" style="font-weight:400;font-size:11px">(mất khoảng 10–20 giây)</span>""",tag='4.oa260')
rep(p,"'<div class=\"muted\">Bản demo - kết nối Firebase + deploy Cloud Function <b>genContent</b> để sinh thử.</div>'","'<div class=\"muted\">Bản xem thử – cần kết nối máy chủ để sinh nội dung thật.</div>'",tag='4.oa286')
rep(p,"<div>Nick / account_pid</div>","<div>Nick</div>",tag='4.oa427')
rep(p,"Token cất ở <b>Secret Manager</b> qua Cloud Function — không lưu ở trình duyệt, không hiện lại.","Token được cất an toàn ở máy chủ – không lưu trên trình duyệt và không hiện lại.",tag='4.oa525')
rep(p,"Nick chạy bằng <b>AdsPower trên VPS của anh</b>. Dán <b>Profile ID</b> (mã cột ID của profile trong AdsPower). Worker trên VPS sẽ điều khiển nick này.","Nick chạy bằng <b>AdsPower trên máy chủ (VPS) của bạn</b>. Dán <b>Profile ID</b> (mã cột ID của profile trong AdsPower); máy chủ sẽ điều khiển nick này.",tag='4.oa532')
p='src/app/87-brand-wizard.js'
rep(p,"họ đăng nhập Google → xuất hiện ở đây (hoặc mục <b>Chờ duyệt</b>) → anh gán vào brand. Quyền được ép ở Firestore Rules: chỉ thấy lead brand mình.","họ đăng nhập Google → xuất hiện ở đây (hoặc mục <b>Chờ duyệt</b>) → bạn gán vào brand. Mỗi tài khoản chỉ thấy lead của brand mình.",tag='4.wz267')
rep(p,"Thêm cả vào <b>bộ lọc TOÀN CỤC</b> (áp cho <b>TẤT CẢ brand</b>, bỏ trùng) - chỉ tích khi anh muốn mọi brand cùng dùng bộ này","Thêm cả vào <b>bộ lọc toàn cục</b> (áp cho <b>tất cả brand</b>, bỏ trùng) – chỉ tích khi muốn mọi brand cùng dùng bộ này",tag='4.wz175')
rep(p,"Keyword toàn cục sửa ở tab <b>Keyword &amp; bộ lọc</b>.","Từ khoá toàn cục sửa ở mục <b>Từ khoá &amp; bộ lọc</b>.",tag='4.wz177')
p='src/app/85-users-admin.js'
rep(p,"sau khi duyệt vẫn cần <b>gán brand</b> mới xem được dữ liệu (cách ly brand được ép ở Firestore Rules). Tài khoản <b>${esc(SUPER_EMAIL_FE)}</b> luôn là Super Admin · toàn hệ thống.","sau khi duyệt vẫn cần <b>gán brand</b> mới xem được dữ liệu; mỗi tài khoản chỉ thấy dữ liệu brand mình. Tài khoản gốc luôn là Super Admin toàn hệ thống.",tag='4.u128')
rep(p,"<span>Điền nhanh theo thư viện ngành (v119-42) - chọn rồi chỉnh lại cho đúng brand</span>","<span>Điền nhanh theo thư viện ngành – chọn rồi chỉnh lại cho đúng brand</span>",tag='4.u155')
rep(p,"Chưa có thao tác nào được ghi (nhật ký bắt đầu từ bản v119-42).","Chưa có thao tác nào được ghi.",tag='4.u357')
rep(p,"toast('Chế độ demo - chưa nối Firebase.'); return; }","toast('Bản xem thử – chưa kết nối máy chủ.'); return; }",count=2,tag='4.u-demo')
rep(p,"toast('Chỉ hoạt động ở chế độ Firebase.'); return; }","toast('Cần kết nối máy chủ để thực hiện.'); return; }",count=3,tag='4.u-fb')
rep(p,"throw new Error('Chỉ hoạt động ở chế độ Firebase.');","throw new Error('Cần kết nối máy chủ để thực hiện.');",tag='4.u-fb2')
p='src/app/50-config-views.js'
rep(p,"Hệ thống tự quét tất cả nguồn <b>mỗi 3 phút</b> qua Cloud Scheduler. Tắt để dừng hoàn toàn - chỉ quét khi bấm","Hệ thống tự quét tất cả nguồn <b>mỗi 3 phút</b>. Tắt để dừng hoàn toàn – chỉ quét khi bấm",tag='4.c238')
rep(p,"Mỗi nguồn được đặt lệnh lấy bài BrightData tối đa 1 lần mỗi N phút (mặc định ${SCAN_IV_DEF}, tối thiểu ${SCAN_IV_MIN}); lượt quét kế gặt kết quả. Tăng để tiết kiệm record BrightData, giảm để bắt lead nhanh hơn. Áp dụng từ lượt quét kế tiếp.","Mỗi nguồn được lấy bài mới tối đa 1 lần mỗi N phút (mặc định ${SCAN_IV_DEF}, tối thiểu ${SCAN_IV_MIN}); lượt quét kế nhận kết quả. Tăng để tiết kiệm chi phí Bright Data, giảm để bắt lead nhanh hơn. Áp dụng từ lượt quét kế tiếp.",tag='4.c251')
rep(p,"Cần đã cấu hình <b>dataset comment</b> ở backend.","Cần đội Z15 bật quét bình luận cho hệ thống.",tag='4.c327')
rep(p,"<option value=\"\"${!s.authAccountId?' selected':''}>- Không (quét CÔNG KHAI qua Bright Data)</option>","<option value=\"\"${!s.authAccountId?' selected':''}>Không – quét công khai qua Bright Data</option>",tag='4.c99')
p='src/app/65-charts-lead-modal.js'
rep(p,"toast('Đang gửi lệnh quét ('+(sm==='facebook_nick'?'Nick FB':'Bright Data')+') tới backend…');","toast('Đang gửi lệnh quét ('+(sm==='facebook_nick'?'Nick FB':'Bright Data')+')…');",tag='4.m383')
rep(p,"<span class=\"sc-via\">${sm==='facebook_nick'?'NICK FB':'BRIGHT DATA'}</span>","<span class=\"sc-via\">${sm==='facebook_nick'?'Nick FB':'Bright Data'}</span>",tag='4.m430')
p='src/app/70-shell-tools.js'
rep(p,"${fn?'':'<p style=\"font-size:12.5px;color:var(--hot);margin-top:10px\">Chưa cấu hình MANUAL_SCAN_URL - chỉ chạy ở chế độ demo.</p>'}","${fn?'':'<p style=\"font-size:12.5px;color:var(--hot);margin-top:10px\">Bản xem thử – quét thật cần kết nối máy chủ.</p>'}",tag='4.s820')
rep(p,"if(!fn){ toast('Demo - cấu hình MANUAL_SCAN_URL để quét thật.'); closeModal(); return; }","if(!fn){ toast('Bản xem thử – quét thật cần kết nối máy chủ.'); closeModal(); return; }",tag='4.s876')
rep(p,"const STEPS=['Đang gửi yêu cầu tới backend…',","const STEPS=['Đang gửi yêu cầu tới máy chủ…',",tag='4.s869')
p='src/app/10-core-overview.js'
rep(p,"title=\"${exact?'Tỉ trọng record TÍNH TIỀN cả tháng (sổ bd_month)':'Tỉ trọng record quét trong cửa sổ quan sát'}\"","title=\"${exact?'Tỉ trọng lượt lấy bài tính tiền cả tháng':'Tỉ trọng lượt lấy bài trong cửa sổ quan sát'}\"",tag='4.k546')
rep(p,"= chi phí thật tháng này từ BigQuery billing export (Functions, Firestore, BigQuery… - chi phí hệ thống, không phân bổ theo brand nhưng ĐƯỢC tính vào tổng lãi gộp).","= chi phí hạ tầng thật tháng này (máy chủ, cơ sở dữ liệu…) – không phân bổ theo brand nhưng được tính vào tổng lãi gộp.",tag='4.k569')
rep('src/app/20-feed.js',"<b style=\"color:var(--hot)\">Hết credit eKYC Pro - hệ thống không check được liên kết Zalo của SĐT mới.</b><div class=\"sub\" style=\"margin-top:2px\">Anh nạp thêm credit tại api.ekycpro.com.","<b style=\"color:var(--hot)\">Hết credit eKYC Pro – hệ thống không kiểm được liên kết Zalo của SĐT mới.</b><div class=\"sub\" style=\"margin-top:2px\">Nạp thêm credit tại api.ekycpro.com.",tag='4.ekyc')
rep(p,"Chưa lấy được số dư Bright Data${e&&e.message?(' ('+esc(e.message)+')'):''}. Hãy chắc đã deploy function <b>brightdataUsage</b> và cấu hình token.","Chưa lấy được số dư Bright Data${e&&e.message?(' ('+esc(e.message)+')'):''} – thử Làm mới hoặc báo quản trị viên.",tag='4.bdusage')

# ---------- 5. anh/chị → bạn (ngoài mascot) ----------
p='src/app/70-shell-tools.js'
rep(p,"toast('Định dạng ảnh này trình duyệt không hỗ trợ (vd. HEIC của iPhone) - anh/chị đổi sang JPG/PNG nhé.');","toast('Trình duyệt không đọc được định dạng ảnh này (vd. HEIC của iPhone) – hãy đổi sang JPG/PNG.');",tag='5.heic')
rep(p,"'Vì lý do bảo mật, thao tác 2FA cần phiên đăng nhập mới - anh/chị đăng xuất, đăng nhập lại rồi làm tiếp nhé.'","'Vì lý do bảo mật, thao tác 2FA cần phiên đăng nhập mới – hãy đăng xuất, đăng nhập lại rồi làm tiếp.'",tag='5.2fa1')
rep(p,"Không vẽ được mã QR - anh/chị dùng mã nhập tay bên dưới.","Không vẽ được mã QR – dùng mã nhập tay bên dưới.",tag='5.2fa2')
rep(p,"toast('Anh/chị nhập đủ mã 6 số nhé.');","toast('Nhập đủ mã 6 số.');",tag='5.2fa3')
rep(p,"Tắt 2FA sẽ bỏ bước mã 6 số khi đăng nhập - tài khoản kém an toàn hơn. Anh/chị chắc chứ?","Tắt 2FA sẽ bỏ bước mã 6 số khi đăng nhập – tài khoản kém an toàn hơn. Bạn chắc chứ?",tag='5.2fa4')
rep(p,"toast('Anh/chị nhập mật khẩu hiện tại trước nhé.');","toast('Nhập mật khẩu hiện tại trước.');",tag='5.pw1')
rep(p,"'Thử sai nhiều lần - anh/chị đợi vài phút rồi thử lại nhé.'","'Thử sai nhiều lần – đợi vài phút rồi thử lại.'",tag='5.pw2')
rep(p,"'Phiên đăng nhập đã cũ - anh/chị đăng xuất, đăng nhập lại rồi đổi mật khẩu nhé.'","'Phiên đăng nhập đã cũ – hãy đăng xuất, đăng nhập lại rồi đổi mật khẩu.'",tag='5.pw3')
rep(p,"'Mã 6 số chưa đúng hoặc vừa hết hạn - nhìn mã MỚI NHẤT trong app rồi nhập lại.'","'Mã 6 số chưa đúng hoặc vừa hết hạn – nhìn mã mới nhất trong app rồi nhập lại.'",tag='5.2fa5')
p='src/app/90-boot.js'
rep(p,"Anh/chị cần hỗ trợ gì về quét nhóm, Lead feed, Pipeline hay báo Zalo ạ?","Anh/chị cần hỗ trợ gì về quét nhóm, Lead mới, Pipeline hay báo Zalo ạ?",tag='5.mascot-name')

# ---------- 6. ALL-CAPS → sentence case (JS) ----------
p='src/app/20-feed.js'
rep(p,"ĐANG RẢNH NHẤT</span>","Đang rảnh nhất</span>",tag='6.feed361')
rep(p,'<span class="rk">NHIỆT ĐỘ FEED</span>','<span class="rk">Nhiệt độ feed</span>',tag='6.feed594')
rep(p,'<div class="rk">NGUỒN RA LEAD NHIỀU NHẤT</div>','<div class="rk">Nguồn ra lead nhiều nhất</div>',tag='6.feed608')
rep(p,'<div class="rk">CHỜ GIAO XỬ LÝ · ${unassigned.length}</div>','<div class="rk">Chờ giao xử lý · ${unassigned.length}</div>',tag='6.feed612')
rep(p,"<div class=\"rk\">LEAD CÓ GHI CHÚ · ${notedLeads.length}${todayN?` · ${todayN} HÔM NAY`:''}</div>","<div class=\"rk\">Lead có ghi chú · ${notedLeads.length}${todayN?` · ${todayN} hôm nay`:''}</div>",tag='6.feed617')
rep(p,"<span class=\"chip-fresh\">VỪA QUÉT</span>","<span class=\"chip-fresh\">Vừa quét</span>",tag='6.feed836')
rep(p,"AI · ĐỌC VỊ NHU CẦU</span>","AI · đọc vị nhu cầu</span>",tag='6.feed841')
p='src/app/60-scan-views.js'
rep(p,'<span class="k">LÚC QUÉT</span>','<span class="k">Lúc quét</span>',tag='6.s231')
rep(p,'<span class="k">LƯU TRỮ</span>','<span class="k">Lưu trữ</span>',tag='6.s232')
rep(p,"<i class=\"sb-dot\"></i>QUÉT TỰ ĐỘNG ĐANG TẠM DỪNG</span>","<i class=\"sb-dot\"></i>Quét tự động đang tạm dừng</span>",tag='6.s324')
rep(p,"<i class=\"sb-dot\"></i>BRIGHTDATA NGƯNG - KHÔNG LẤY ĐƯỢC BÀI</span>","<i class=\"sb-dot\"></i>Bright Data ngưng – không lấy được bài</span>",tag='6.s325')
rep(p,"<i class=\"sb-dot\"></i>ĐANG TRỰC 24/7</span>","<i class=\"sb-dot\"></i>Đang trực 24/7</span>",tag='6.s326')
p='src/app/50-config-views.js'
rep(p,"<b style=\"color:${color}\">${on?'ĐANG BẬT - hệ thống tự quét':'ĐÃ TẮT - chỉ quét thủ công'}</b>","<b style=\"color:${color}\">${on?'Đang bật – hệ thống tự quét':'Đã tắt – chỉ quét khi bấm'}</b>",tag='6.c228')
rep(p,"${on?(SLI.check||'✓')+' Đang BẬT':'Đang TẮT'}","${on?(SLI.check||'✓')+' Đang bật':'Đang tắt'}",count=2,tag='6.c-btn')
s=rd(p); print('c355:', [l for l in s.split('\n') if 'Đã BẬT' in l][:1])
rrep(p,r"Đã BẬT",'Đã bật',count=None,tag='6.c-dabat'); rrep(p,r"Đã TẮT",'Đã tắt',count=None,tag='6.c-datat')
rrep(p,r"'🟢 Đang quét tự động':'🔴 Đã tắt'","'Đang quét tự động':'Đã tắt'",tag='6.c-mini')
p='src/app/45-outreach.js'
s=rd(p); print('oa693:', [l[:200] for l in s.split('\n') if 'Đã BẬT' in l][:1]); print('oa450:', [l[:200] for l in s.split('\n') if 'DỪNG TẤT CẢ' in l][:2])
rrep(p,r"Đã BẬT",'Đã bật',count=None,tag='6.oa-dabat'); rrep(p,r"Đã TẮT",'Đã tắt',count=None,tag='6.oa-datat'); rrep(p,r"DỪNG TẤT CẢ",'Dừng tất cả',count=None,tag='6.oa-dung')
p='src/app/40-roi.js'
for a,b in [("KẾT QUẢ THÁNG NÀY${simple?' · CHẾ ĐỘ ĐƠN GIẢN':''}","Kết quả tháng này${simple?' · chế độ đơn giản':''}"),("'CHI PHÍ MỖI LEAD SMARTLEAD':'GIÁ TRỊ PIPELINE ƯỚC TÍNH'","'Chi phí mỗi lead SmartLead':'Giá trị pipeline ước tính'"),("${rt.auto?'TỰ HỌC':'CẤU HÌNH'}","${rt.auto?'Tự học':'Cấu hình'}"),('<span class="roi-mode-lb">CHẾ ĐỘ TÍNH</span>','<span class="roi-mode-lb">Chế độ tính</span>'),("GIÁ TRỊ HỢP ĐỒNG/ĐƠN THEO NGÀNH - để trống","Giá trị hợp đồng/đơn theo ngành – để trống"),('>THAM SỐ RIÊNG CỦA BRAND</span>','>Tham số riêng của brand</span>'),('>MẶC ĐỊNH HỆ THỐNG</span>','>Mặc định hệ thống</span>'),("TOÀN HỆ THỐNG · ${fmt(active.length)} BRAND ĐANG HOẠT ĐỘNG","Toàn hệ thống · ${fmt(active.length)} brand đang hoạt động"),('>RIÊNG</span>','>Riêng</span>'),('>ĐƠN GIẢN</span>','>Đơn giản</span>'),('<span class="roi-mode-lb">CHI TIẾT &amp; THAM SỐ</span>','<span class="roi-mode-lb">Chi tiết &amp; tham số</span>'),('>THAM SỐ RIÊNG</span>','>Tham số riêng</span>'),('>ĐANG DÙNG MẶC ĐỊNH</span>','>Đang dùng mặc định</span>'),('>CHẾ ĐỘ ĐƠN GIẢN</span>','>Chế độ đơn giản</span>')]:
    rep(p,a,b,count=None,tag='6.roi')
rrep(p,r">MẶC ĐỊNH</span>",'>Mặc định</span>',count=None,tag='6.roi-macdinh')
p='src/app/30-pipeline.js'
rep(p,'<span class="k">PIPELINE HIỆN TẠI</span>','<span class="k">Pipeline hiện tại</span>',tag='6.pv256')
p='src/app/10-core-overview.js'
rep(p,'<td class="nm" style="font-weight:800">TOÀN HỆ THỐNG</td>','<td class="nm" style="font-weight:800">Toàn hệ thống</td>',tag='6.k560')
rep(p,"t:'ƯỚC TÍNH ĐÃ HẾT credit OpenAI - kiểm tra và nạp thêm ngay kẻo AI chấm điểm bị dừng'","t:'Ước tính đã hết credit OpenAI – kiểm tra và nạp thêm ngay kẻo AI chấm điểm bị dừng'",tag='6.k639')
rep(p,"t:'ĐÃ VƯỢT hạn mức tháng - nên tạm dừng/giảm quét hoặc nâng hạn mức'","t:'Đã vượt hạn mức tháng – nên tạm dừng/giảm quét hoặc nâng hạn mức'",tag='6.k665')

# ---------- 7. tên mục cũ trong copy ----------
for p,a,b in [
 ('src/app/20-feed.js',"['Lead sẽ tự hiện ở Lead feed ngay khi phát hiện','feed',false]","['Lead sẽ tự hiện ở mục Lead mới ngay khi phát hiện','feed',false]"),
 ('src/app/50-config-views.js',"dùng chế độ toàn cục ở mục Cấu hình AI Scoring.","dùng chế độ toàn cục ở mục Chấm điểm AI."),
 ('src/app/50-config-views.js',"<b>SmartLead · Báo cáo &amp; tối ưu</b>","<b>SmartLead · Báo cáo</b>"),
 ('src/app/50-config-views.js',"Chưa có keyword nào khớp lead - thêm keyword ở mục Keyword &amp; bộ lọc.","Chưa có từ khoá nào khớp lead – thêm ở mục Từ khoá &amp; bộ lọc."),
 ('src/app/60-scan-views.js',"số liệu brand của bạn xem tại <b>Bảng điều khiển</b>, <b>Lead feed</b> và","số liệu brand của bạn xem tại <b>Bảng điều khiển</b>, <b>Lead mới</b> và"),
 ('src/app/65-charts-lead-modal.js','(vẫn trong kho - chip "Rác · Loại" ở Lead feed)','(vẫn trong kho – chip "Rác · Loại" ở Lead mới)'),
 ('src/app/65-charts-lead-modal.js',"hiện 5 mới nhất - xem đủ ở Lead feed","hiện 5 mới nhất – xem đủ ở Lead mới"),
 ('src/app/65-charts-lead-modal.js',"toast('+'+take.length+' lead mới vừa vào Lead feed.');","toast('+'+take.length+' lead mới vừa vào mục Lead mới.');"),
 ('src/app/70-shell-tools.js','<button class="btn btn-soft btn-sm" data-go="feed">Lead feed →</button>','<button class="btn btn-soft btn-sm" data-go="feed">Lead mới →</button>'),
 ('src/app/70-shell-tools.js',"lead nóng bỏ ngỏ - vào Lead feed săn lead mới nhé.","lead nóng bỏ ngỏ – xem thêm ở mục Lead mới."),
 ('src/app/70-shell-tools.js',"kết quả vẫn tự cập nhật vào <b>Lead feed</b> và <b>Lịch sử quét</b>.","kết quả vẫn tự cập nhật vào <b>Lead mới</b> và <b>Lịch sử quét</b>."),
 ('src/app/70-shell-tools.js',"<h3>${tasks.length?fmt(tasks.length)+' việc cần làm':'Sạch việc 🎉'}</h3><div class=\"sub\">Tính từ lead ${roleCanEditConfig()?'của brand':'bạn phụ trách & lead chờ'} · bấm dòng để mở lead · cập nhật realtime · 🚨 = leo thang (quá hẹn >24h / lead nóng bỏ quá ngưỡng đỏ SLA)</div>","<h3>${tasks.length?fmt(tasks.length)+' việc cần làm':'Sạch việc'}</h3><div class=\"sub\">Tính từ lead ${roleCanEditConfig()?'của brand':'bạn phụ trách và lead chờ'} · bấm dòng để mở lead · cập nhật realtime</div>"),
]:
    rep(p,a,b,tag='7.name')
s=rd('tools/smoke.js')
s=s.replace("/BRIGHTDATA NGƯNG/.test(bd2.txt)","/Bright Data ngưng/.test(bd2.txt)").replace("/ĐANG TRỰC 24\\/7/.test(bd4)","/Đang trực 24\\/7/.test(bd4)")
s=s.replace("""  let dlg = 0; const onDlg = d => { dlg++; d.accept(); }; page.on('dialog', onDlg);""","""  let dlg = 0; await page.evaluate(() => { window.__dlg = 0; window.SLDlg.confirm = () => { window.__dlg++; return Promise.resolve(true); }; }); // v119-61: hộp thoại app thay confirm()""")
s=s.replace("""  page.off('dialog', onDlg);
  const as2""","""  dlg = await page.evaluate(() => window.__dlg);
  const as2""")
assert "window.__dlg" in s and "Bright Data ngưng" in s and "Đang trực 24" in s
wr('tools/smoke.js',s); lib._log.append('smoke dialog stub')
done()
