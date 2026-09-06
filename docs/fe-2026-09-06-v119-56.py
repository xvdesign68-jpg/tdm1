# FE v119-56 / v120-esm-f (06/09/2026): banner "Kênh dữ liệu … lỗi permission-denied" TREO sau lỗi thoáng qua — v119-47 tự đăng ký lại TOÀN BỘ listener nhưng chỉ 4 kênh
# (config/sources/notes/leads) gọi chanOk() để gỡ cờ → kênh khác (outreach_stats/outreach_log/workers/scans/bd_month/system_alerts/scanned_posts/brand doc/users chờ duyệt)
# đăng ký lại THÀNH CÔNG mà cờ vẫn còn → banner đỏ treo tới khi F5. Sửa: (1) mọi handler snapshot gọi chanOk(<kênh>) khi nhận dữ liệu; (2) lúc đăng ký lại → xoá hết cờ
# + đặt restartPending → kênh đầu tiên OK sau đó gỡ banner (kênh lazy như outreach_* chỉ đăng ký khi mở tab nên không thể tự gỡ cờ); lỗi THẬT → kênh lỗi lại → banner hiện lại.
# Dùng: python3 fe56.py <root> iife|esm
import sys, os
root, mode = sys.argv[1], sys.argv[2]
p = os.path.join(root, 'assets/js/live.js'); s = open(p, encoding='utf-8').read()
def rep(a, b):
    global s
    assert s.count(a) == 1, (a[:80], s.count(a)); s = s.replace(a, b)
rep("  let lastStart=null; const chanRetry={}, chanFailed={};\n  function chanOk(name){ if(chanFailed[name]){ delete chanFailed[name]; if(!Object.keys(chanFailed).length){ try{ document.dispatchEvent(new CustomEvent('sl-fb-channel-ok')); }catch(_){} } } }",
    "  let lastStart=null, restartPending=false; const chanRetry={}, chanFailed={};\n  /* v119-56: MỌI kênh gọi chanOk khi nhận dữ liệu (trước chỉ 4 kênh → kênh khác đăng ký lại OK mà cờ còn → banner treo). restartPending: lúc đăng ký lại đã xoá hết cờ\n     (kênh lazy như outreach_* chỉ đăng ký khi mở tab, không thể tự gỡ) → kênh đầu tiên OK sau đó gỡ banner; lỗi thật → kênh lỗi lại → banner hiện lại (chanRetry chặn lặp vô hạn). */\n  function chanOk(name){ const had=!!chanFailed[name]; delete chanFailed[name]; if((had||restartPending) && !Object.keys(chanFailed).length){ restartPending=false; try{ document.dispatchEvent(new CustomEvent('sl-fb-channel-ok')); }catch(_){} } }")
rep("console.warn('[SmartLead] đăng ký lại listener sau lỗi kênh \"'+name+'\"'); try{ startData(lastStart.role,lastStart.brand,lastStart.userWin); }",
    "console.warn('[SmartLead] đăng ký lại listener sau lỗi kênh \"'+name+'\"'); Object.keys(chanFailed).forEach(k=>delete chanFailed[k]); restartPending=true; /* v119-56 */ try{ startData(lastStart.role,lastStart.brand,lastStart.userWin); }")
rep("dataUnsub.push(onSnapshot(q, snap=>{ outreachLog=[];", "dataUnsub.push(onSnapshot(q, snap=>{ chanOk('outreach_log'); outreachLog=[];")
rep("dataUnsub.push(onSnapshot(collection(db,'workers'), snap=>{ workersList=[];", "dataUnsub.push(onSnapshot(collection(db,'workers'), snap=>{ chanOk('workers'); workersList=[];")
rep("dataUnsub.push(onSnapshot(statsQ, snap=>{ outreachStats={};", "dataUnsub.push(onSnapshot(statsQ, snap=>{ chanOk('outreach_stats'); outreachStats={};")
rep("snap=>{ scans=[]; snap.forEach(d=>scans.push(", "snap=>{ chanOk('scans'); scans=[]; snap.forEach(d=>scans.push(")
rep("d=>{ bdMonth=d.exists()?d.data():null;", "d=>{ chanOk('bd_month'); bdMonth=d.exists()?d.data():null;")
rep("d=>{ sysAlert=d.exists()?d.data():null;", "d=>{ chanOk('system_alerts'); sysAlert=d.exists()?d.data():null;")
rep("dataUnsub.push(onSnapshot(qy, snap=>{ scanned=[];", "dataUnsub.push(onSnapshot(qy, snap=>{ chanOk('scanned_posts'); scanned=[];")
rep("d=>{ myBrandInfo=d.exists()?{code:d.id,...d.data()}:{code:byBrand};", "d=>{ chanOk('brand doc'); myBrandInfo=d.exists()?{code:d.id,...d.data()}:{code:byBrand};")
rep("pendingList=[]; snap.forEach(d=>pendingList.push({...d.data(), uid:d.id}));", "chanOk('users chờ duyệt'); pendingList=[]; snap.forEach(d=>pendingList.push({...d.data(), uid:d.id}));")
open(p, 'w', encoding='utf-8').write(s)
# smoke: bản min phải có marker + chanOk cho outreach_stats (string literal giữ nguyên sau minify)
p = os.path.join(root, 'tools/smoke.js'); s = open(p, encoding='utf-8').read()
a = "  (!/bỏ qua tin này nhé/.test(fs.readFileSync(path.join(ROOT, 'assets/min/js/app.min.js'), 'utf8'))) ? ok('v119-54: Content Studio không còn opt-out mặc định') : fail('v119-54: vẫn còn câu opt-out mặc định trong app.min.js');\n"
assert s.count(a) == 1
s = s.replace(a, a + "  { const lv = fs.readFileSync(path.join(ROOT, 'assets/min/js/live.min.js'), 'utf8'); const n = (lv.match(/\"(outreach_stats|outreach_log|workers|scans|bd_month|system_alerts|scanned_posts|brand doc|users chờ duyệt)\"\\)/g) || []).length; (n >= 9) ? ok('v119-56: live.min.js gọi chanOk cho ' + n + ' kênh (banner kênh tự gỡ sau đăng ký lại)') : fail('v119-56: thiếu chanOk kênh trong live.min.js (đếm ' + n + ')'); }\n")
open(p, 'w', encoding='utf-8').write(s)
print('FE56 OK', mode)
