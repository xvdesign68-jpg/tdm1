# m28.py <cây> — v119-86 / v120-esm-aj (09/09/2026 chiều, anh hỏi "các chỉ số ROI có update real-time không" → đo bằng harness
# docs/harness-roi-realtime-2026-09-09.mjs: số từ lead/config/sources đổi sau ~270 ms, NHƯNG danh sách brand (tham số ROI riêng, cờ active,
# tên brand) chỉ đọc lại qua refreshAdmin (getDocs, throttle 15 s, gọi khi vẽ lại view) → sửa ở tab/máy khác phải ≥15 s + có tín hiệu vẽ lại khác.
# Anh chốt HƯỚNG 1: Super Admin đăng ký `brands` bằng onSnapshot như các kênh khác (collection nhỏ, chỉ người sửa tay ghi; engine/worker không ghi).
#   (1) live.js startData(super): onSnapshot(collection 'brands') → brandsList + chữ ký quản trị (adminSigOf) → rebuild() khi đổi; snapErr('danh sách brand') → banner + tự đăng ký lại như kênh khác.
#   (2) refreshAdmin: khi kênh brands đang sống thì KHÔNG getDocs brands nữa (bớt 1 truy vấn mỗi 15 s) — vẫn đọc users/fb_accounts/brand_sales.
#   (3) coreReady: lần vẽ đầu của super chờ mềm thêm kênh brands (≤500 ms như scans/admin) → không vẽ "0 brand" rồi mới có.
#   (4) stopData reset cờ brandsSubbed. (5) smoke: bản min live.js có kênh 'danh sách brand' + refreshAdmin không còn đọc brands vô điều kiện.
# Brand user không đổi (đã có kênh `brand doc` realtime từ v16.6). Không cần Rules/LỆNH: super đã đọc được brands qua getDocs.
import sys, os, re
sys.path.insert(0, os.path.dirname(__file__))
from lib import *
import lib
lib.ROOT = sys.argv[1]
L='assets/js/live.js'; S='tools/smoke.js'

# (4) state + reset
rep(L, "  let adminSig=''; // v119-58: chữ ký dữ liệu quản trị — không đổi thì KHÔNG rebuild (trước: mỗi repaint mềm kéo thêm 1 repaint nữa sau 15s dù không có gì mới)",
"""  let adminSig=''; // v119-58: chữ ký dữ liệu quản trị — không đổi thì KHÔNG rebuild (trước: mỗi repaint mềm kéo thêm 1 repaint nữa sau 15s dù không có gì mới)
  let brandsSubbed=false; // v119-86: super đang giữ kênh realtime `brands` → refreshAdmin không đọc lại brands
  const adminSigOf=(u,f,b,s)=>JSON.stringify([u,f,b,s],(k,v)=>(typeof v==='string'&&v.length>2000)?('#'+v.length):v); // logo data URL → chỉ so độ dài""", tag='state')
rep(L, "    clearExtra(); leadsCtx=null; pendingList=[]; adminLast=0; autoFillKey=null; autoFillBusy=false; leadsCapped=false; autoFillQuiet=false; // v145 + v45 auto-fill + v166 + v119-40 clearExtra",
       "    clearExtra(); leadsCtx=null; pendingList=[]; adminLast=0; adminSig=''; brandsSubbed=false; autoFillKey=null; autoFillBusy=false; leadsCapped=false; autoFillQuiet=false; // v145 + v45 auto-fill + v166 + v119-40 clearExtra + v119-86 brands", tag='stop.reset')

# (2) refreshAdmin bỏ đọc brands khi kênh sống
rep(L, """      const [uS,fS,bS,sS]=await Promise.all([
        getDocs(collection(db,'users')),
        getDocs(collection(db,'fb_accounts')),
        getDocs(collection(db,'brands')),
        getDocs(collection(db,'brand_sales'))
      ]);
      usersList=[]; uS.forEach(d=>usersList.push({...d.data(), uid:d.id}));
      fbAccounts=[]; fS.forEach(d=>fbAccounts.push({...d.data(), id:d.id}));
      brandsList=[]; bS.forEach(d=>brandsList.push({code:d.id,...d.data()}));
      salesList=[]; sS.forEach(d=>salesList.push({...d.data(), id:d.id}));
      mergePending();
      adminLast=Date.now();
      const sig=JSON.stringify([usersList,fbAccounts,brandsList,salesList],(k,v)=>(typeof v==='string'&&v.length>2000)?('#'+v.length):v); // logo data URL → chỉ so độ dài
      if(force || sig!==adminSig){ adminSig=sig; rebuild(['users','roi','overview','agency']); } // v119-49: Bảng brand đọc users/brands/fb_accounts · v119-58: chỉ khi đổi""",
"""      const [uS,fS,bS,sS]=await Promise.all([
        getDocs(collection(db,'users')),
        getDocs(collection(db,'fb_accounts')),
        brandsSubbed ? null : getDocs(collection(db,'brands')), // v119-86: super có kênh realtime brands → không đọc lại
        getDocs(collection(db,'brand_sales'))
      ]);
      usersList=[]; uS.forEach(d=>usersList.push({...d.data(), uid:d.id}));
      fbAccounts=[]; fS.forEach(d=>fbAccounts.push({...d.data(), id:d.id}));
      if(bS){ brandsList=[]; bS.forEach(d=>brandsList.push({code:d.id,...d.data()})); }
      salesList=[]; sS.forEach(d=>salesList.push({...d.data(), id:d.id}));
      mergePending();
      adminLast=Date.now();
      const sig=adminSigOf(usersList,fbAccounts,brandsList,salesList);
      if(force || sig!==adminSig){ adminSig=sig; rebuild(['users','roi','overview','agency']); } // v119-49: Bảng brand đọc users/brands/fb_accounts · v119-58: chỉ khi đổi""", tag='refreshAdmin')

# (3) coreReady chờ mềm kênh brands
rep(L, "    const soft = !!chanSeen.scans && (curRole!=='superadmin' || !!adminLast);",
       "    const soft = !!chanSeen.scans && (curRole!=='superadmin' || (!!adminLast && !!chanSeen['danh sách brand'])); // v119-86: super chờ mềm thêm kênh brands", tag='coreReady')

# (1) kênh realtime brands cho super
rep(L, """      refreshAdmin(true);
      pendingUnsub=onSnapshot(query(collection(db,'users'),where('role','==','pending')), snap=>{""",
"""      /* v119-86: DANH SÁCH BRAND đi kênh REALTIME cho super (collection nhỏ, chỉ người sửa tay trên web ghi — engine/worker không ghi vào đây).
         Tham số Giá trị & ROI riêng từng brand, cờ tắt brand, tên brand, Hồ sơ AI/CRM/automation… sửa ở tab hay máy khác → tab này đổi sau ~0,3 s.
         Trước: chỉ getDocs trong refreshAdmin (throttle 15 s, gọi khi vẽ lại view) → tab khác sửa phải chờ ≥15 s VÀ có tín hiệu vẽ lại khác (lead/scan…).
         Chữ ký quản trị dùng chung với refreshAdmin → snapshot bắn 2 lần (ước lượng cục bộ + máy chủ xác nhận) chỉ vẽ 1 lần; Rules: super đọc brands sẵn có. */
      brandsSubbed=true;
      dataUnsub.push(onSnapshot(collection(db,'brands'), snap=>{
        chanOk('danh sách brand'); const nb=[]; snap.forEach(d=>nb.push({code:d.id,...d.data()}));
        brandsList=nb; const sig=adminSigOf(usersList,fbAccounts,brandsList,salesList);
        if(sig!==adminSig){ adminSig=sig; rebuild(); } // brand có mặt ở nhiều view (ROI/Bảng brand/Tổng quan/Tiếp cận/Người dùng/thẻ lead) → vẽ lại mọi view đang mở (morph, hiếm khi đổi)
      }, snapErr('danh sách brand')));
      refreshAdmin(true);
      pendingUnsub=onSnapshot(query(collection(db,'users'),where('role','==','pending')), snap=>{""", tag='brands.sub')

# (5) smoke: kiểm bản min
rep(S, """  errors.length ? fail('Lỗi JS: ' + errors.slice(0, 4).join(' | ')) : ok('Không có lỗi JS');
  await browser.close(); server.close();""", """  /* v119-86: super giữ kênh realtime `brands` (tham số ROI riêng brand đổi ở tab khác → đổi ngay); refreshAdmin không còn đọc brands vô điều kiện. Smoke chạy demo nên chỉ kiểm bản min live.js. */
  const k86 = fs.readFileSync(path.join(ROOT, 'assets/min/js/live.min.js'), 'utf8');
  (/danh sách brand/.test(k86) && /\\?null:[a-zA-Z$_]+\\([a-zA-Z$_]+\\([a-zA-Z$_]+,"brands"\\)\\)/.test(k86) && (k86.match(/"brands"\\)/g) || []).length >= 2)
    ? ok('v119-86: live.min.js có kênh realtime "danh sách brand" cho super + refreshAdmin chỉ đọc brands khi kênh chưa sống') : fail('v119-86 live.min.js thiếu kênh brands/điều kiện refreshAdmin');
  errors.length ? fail('Lỗi JS: ' + errors.slice(0, 4).join(' | ')) : ok('Không có lỗi JS');
  await browser.close(); server.close();""", tag='smoke.k86')
done()
