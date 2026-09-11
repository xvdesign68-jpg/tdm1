# m30.py <cây> — v119-88 / v120-esm-al (11/09/2026): zip FE nhỏ đi cùng worker 2026-09-11 + LỆNH #44 (Đợt 1 rà soát automation 10/09):
#   F-1  nick Facebook (fb_accounts) đi kênh REALTIME cho Super Admin (như brands v119-86): cờ needLogin/checkpoint/safetyPaused/safety/uiLang worker ghi
#        → bảng Tài khoản / thẻ brand / Cảnh báo hệ thống đổi sau ~0,3 s (trước: getDocs trong refreshAdmin throttle 15 s + cần tín hiệu vẽ lại khác).
#        Trường ghi mỗi tick (nextFreeAt/updatedAt/replyCheckAt/okCount…) bị loại khỏi chữ ký quản trị → không vẽ lại vô ích.
#   F-2  van an toàn trong ⚙ cấu hình brand KẸP theo TRẦN CỨNG engine (LỆNH #44 HARD_CAPS44) + worker (config.json hardCaps) = 80/30/20/15
#        (trước ô nhập cho tới 200/100/30/30 — số vượt trần vô nghĩa vì engine dùng min(van brand, trần)); trần đọc từ heartbeat VPS (worker 2026-09-11 báo hardCaps), nhiều VPS → min.
#   R-9  chip Safety Score: tooltip nói rõ VÌ SAO (safetyWhy worker 2026-09-11: checkpoint · đăng nhập lại · lỗi FB · thành công · lỗi giao diện KHÔNG trừ điểm + lỗi gần nhất).
#   F-7  thẻ brand: "BẬT · 0/N nick" (cảnh báo) khi brand bật mà không nick nào chạy được (bật + không cờ) + dòng "k/N chạy được"; dòng trạng thái máy chủ
#        từ system_status/outreach (engine LỆNH #44 sweeper: nick sống/brand, phễu chờ nick, đóng 72h, chuyển nick); Cảnh báo hệ thống thêm dòng brand BẬT 0 nick.
#   F-6  chip máy trên thẻ lead (botChip) ghi TÊN nick từ `outreach.pid` (worker ghi pid, không ghi `nick` → trước không bao giờ hiện).
#   nhãn log status 'dry' → "Chạy thử" (worker dryRun).
# Áp lên cây v119-87 / v120-esm-ak (cùng script, tự nhận ESM). ESM: 50-config-views import thêm oaBrands từ 45 (đã export sẵn).
import sys, os, re
sys.path.insert(0, os.path.dirname(__file__))
from lib import *
import lib
lib.ROOT = sys.argv[1]
LV='assets/js/live.js'; O45='src/app/45-outreach.js'; F20='src/app/20-feed.js'; C50='src/app/50-config-views.js'; CSS='assets/css/app.css'; S='tools/smoke.js'
ESM = "import './" in rd(O45)

# ---------- live.js: F-1 kênh realtime fb_accounts + system_status/outreach ----------
rep(LV, "  let brandsSubbed=false; // v119-86: super đang giữ kênh realtime `brands` → refreshAdmin không đọc lại brands",
"  let brandsSubbed=false; // v119-86: super đang giữ kênh realtime `brands` → refreshAdmin không đọc lại brands\n  let fbSubbed=false; // v119-88 (F-1): super giữ kênh realtime `fb_accounts` → refreshAdmin không đọc lại nick", tag='lv.fbSubbed')

rep(LV, "  const adminSigOf=(u,f,b,s)=>JSON.stringify([u,f,b,s],(k,v)=>(typeof v==='string'&&v.length>2000)?('#'+v.length):v); // logo data URL → chỉ so độ dài",
"""  const FB_VOL=/^(nextFreeAt|updatedAt|createdAt|replyCheckAt|replyFound|safetyAt|safetyDecayAt|lastFailAt|okCount|challengeAt|lockedAt)$/; // v119-88: trường engine/worker ghi mỗi tick/bước nhưng KHÔNG hiển thị → bỏ khỏi chữ ký (kênh nick realtime không vẽ lại vô ích)
  const fbStable=f=>(f||[]).map(a=>{ const o={}; for(const k in a){ if(!FB_VOL.test(k)) o[k]=a[k]; } return o; });
  const adminSigOf=(u,f,b,s)=>JSON.stringify([u,fbStable(f),b,s],(k,v)=>(typeof v==='string'&&v.length>2000)?('#'+v.length):v); // logo data URL → chỉ so độ dài""", tag='lv.sig')

rep(LV, "  let sysStatus=null; // v119-50:", "  let oaStatus=null; // v119-88 (F-7): system_status/outreach — engine LỆNH #44 (sweeper ≤25′/lần) ghi {at, brands:{code:{on,nicksAlive,nicksTotal,threads,orphan}}, orphan, closed, moved} → thẻ brand + Cảnh báo hệ thống (super)\n  let sysStatus=null; // v119-50:", tag='lv.oaStatus')
rep(LV, "d.sysStatus=sysStatus; d.contentStats=contentStats;", "d.sysStatus=sysStatus; d.contentStats=contentStats; d.oaStatus=oaStatus;", tag='lv.D')
rep(LV, "sysStatus=null; contentStats={};", "sysStatus=null; contentStats={}; oaStatus=null;", tag='lv.reset')
rep(LV, "adminLast=0; adminSig=''; brandsSubbed=false;", "adminLast=0; adminSig=''; brandsSubbed=false; fbSubbed=false;", tag='lv.reset2')

rep(LV, "        getDocs(collection(db,'fb_accounts')),", "        fbSubbed ? null : getDocs(collection(db,'fb_accounts')), // v119-88: super có kênh realtime fb_accounts → không đọc lại", tag='lv.ra1')
rep(LV, "      fbAccounts=[]; fS.forEach(d=>fbAccounts.push({...d.data(), id:d.id}));", "      if(fS){ fbAccounts=[]; fS.forEach(d=>fbAccounts.push({...d.data(), id:d.id})); }", tag='lv.ra2')

rep(LV, "      }, snapErr('danh sách brand')));\n      refreshAdmin(true);",
"""      }, snapErr('danh sách brand')));
      /* v119-88 (F-1): NICK FB đi kênh REALTIME cho super. Worker/engine ghi cờ needLogin/checkpoint/safetyPaused/safety/safetyWhy/uiLang liên tục;
         trước chỉ getDocs trong refreshAdmin (throttle 15 s + cần tín hiệu vẽ lại khác) → bảng Tài khoản/thẻ brand/Cảnh báo lệch tới vài phút, có khi tới F5.
         Trường ghi mỗi tick (nextFreeAt/updatedAt/replyCheckAt/okCount…) bị loại khỏi chữ ký (fbStable) → chỉ vẽ lại khi thứ HIỂN THỊ đổi. Collection nhỏ (vài chục nick/agency); Rules super đọc sẵn. */
      fbSubbed=true;
      dataUnsub.push(onSnapshot(collection(db,'fb_accounts'), snap=>{
        chanOk('nick Facebook'); const nf=[]; snap.forEach(d=>nf.push({...d.data(), id:d.id}));
        fbAccounts=nf; const sig=adminSigOf(usersList,fbAccounts,brandsList,salesList);
        if(sig!==adminSig){ adminSig=sig; rebuild(['outreach','agency','alerts','overview','feed','users']); } // nick có mặt ở Tiếp cận / Bảng brand (cờ ⛔ N nick) / Cảnh báo hệ thống / chip máy trên thẻ lead
      }, snapErr('nick Facebook')));
      refreshAdmin(true);""", tag='lv.fbSnap')

rep(LV, "        // v119-31: tình trạng VPS worker (realtime) — chỉ super admin (hạ tầng); collection nhỏ nên listener nhẹ",
"""        // v119-88 (F-7): system_status/outreach — engine LỆNH #44 (sweeper) ghi ≤25′/lần; Rules read=super (block system_status/* LỆNH #23). Rules/LỆNH chưa có → chỉ console.warn, KHÔNG banner kênh.
        if(role==='superadmin'){ dataUnsub.push(onSnapshot(doc(db,'system_status','outreach'), d=>{ oaStatus=d.exists()?d.data():null; oaRepaint(); }, function(e){ console.warn('[SL] system_status/outreach', e&&e.code); })); }
        // v119-31: tình trạng VPS worker (realtime) — chỉ super admin (hạ tầng); collection nhỏ nên listener nhẹ""", tag='lv.osSnap')

rep(LV, "s+='|cs:'+cc[q]+'='+(ca.sent||0)+','+(ca.rep||0)+','+(ca.tagged||0); } // v119-57\n      return s;",
"""s+='|cs:'+cc[q]+'='+(ca.sent||0)+','+(ca.rep||0)+','+(ca.tagged||0); } // v119-57
      if(oaStatus){ var ob=oaStatus.brands||{}, oc=Object.keys(ob).sort(); s+='|os:'+Math.floor((Number(oaStatus.at)||0)/60000)+','+(oaStatus.orphan||0)+','+(oaStatus.closed||0)+','+(oaStatus.moved||0); for(var r=0;r<oc.length;r++){ var x=ob[oc[r]]||{}; s+=';'+oc[r]+'='+(x.on?1:0)+','+(x.nicksAlive==null?'':x.nicksAlive)+'/'+(x.nicksTotal==null?'':x.nicksTotal)+','+(x.orphan||0)+','+(x.threads||0); } } // v119-88 (F-7): trạng thái máy chủ (đổi ≤ 1 lần/25′)
      return s;""", tag='lv.sigOs')

# ---------- 45-outreach: nhãn dry · trần cứng · nick chạy được · tooltip Safety · dòng máy chủ · demo ----------
rep(O45, "retry: ['oa-s-sched', '↻ Thử lại'] };", "retry: ['oa-s-sched', '↻ Thử lại'], dry: ['oa-s-wait', SLI.flask+' Chạy thử'] }; // v119-88: worker dryRun ghi status 'dry'", tag='45.status')

rep(O45, "  function oaNickCount(code) { return oaAccounts().filter(a => a.brand === code && a.active !== false).length; }",
"""  function oaNickCount(code) { return oaAccounts().filter(a => a.brand === code && a.active !== false).length; }
  /* v119-88 (F-7): nick CHẠY ĐƯỢC = đang bật và không cờ (cần đăng nhập lại / checkpoint / tạm dừng Safety). Brand BẬT mà 0 nick chạy được = automation đứng im
     (engine LỆNH #44 giữ phễu chờ nick tới 72 giờ rồi đóng) — trước web vẫn hiện "BẬT" xanh, anh chỉ biết khi chạy script tay. */
  function oaNickAll(code) { return oaAccounts().filter(a => a.brand === code); }
  function oaNickLive(code) { return oaAccounts().filter(a => a.brand === code && a.active !== false && !a.needLogin && !a.challenge && !a.safetyPaused).length; }
  /* v119-88 (F-2): TRẦN CỨNG/nick/ngày — engine (LỆNH #44 HARD_CAPS44) và worker (config.json hardCaps) đều kẹp van brand = min(van, trần).
     Web đọc trần thật từ heartbeat VPS (worker 2026-09-11 báo hardCaps; nhiều VPS → lấy min); chưa có → mặc định 80/30/20/15. Ô nhập van cũng kẹp theo (số vượt trần vô nghĩa). */
  const OA_HARD_CAP = { react: 80, comment: 30, friend: 20, inbox: 15 };
  function oaHardCaps() {
    const o = Object.assign({}, OA_HARD_CAP);
    oaWorkers().forEach(w => { const h = w && w.hardCaps; if (!h || typeof h !== 'object') return; ['react', 'comment', 'friend', 'inbox'].forEach(k => { const n = Number(h[k]); if (n >= 1 && n < o[k]) o[k] = n; }); });
    return o;
  }""", tag='45.helpers')

rep(O45, "    const o = {}; ['react', 'comment', 'friend', 'inbox'].forEach(k => { o[k] = Number(c[k]) > 0 ? Number(c[k]) : OA_ENGINE_CAP[k]; }); return o;",
"    const o = {}, hard = oaHardCaps(); ['react', 'comment', 'friend', 'inbox'].forEach(k => { o[k] = Math.min(hard[k], Number(c[k]) > 0 ? Number(c[k]) : OA_ENGINE_CAP[k]); }); return o; // v119-88 (F-2): kẹp trần cứng như engine/worker", tag='45.capsOf')

rep(O45, "    const OA_CAP_MAX = { react: 200, comment: 100, friend: 30, inbox: 30 };",
"    const OA_CAP_MAX = oaHardCaps(); // v119-88 (F-2): = trần cứng engine/worker (80/30/20/15 mặc định) — trước 200/100/30/30 vượt trần, số nhập vô nghĩa", tag='45.capmax')
rep(O45, "      const hint = risky ? ` <span class=\"oa-caphint\" title=\"Thao tác nhạy — nên giữ thấp để an toàn nick\">${SLI.warning} ≤${OA_CAP_MAX[k]}</span>` : '';",
"      const hint = ` <span class=\"oa-caphint${risky ? '' : ' soft'}\" title=\"Trần cứng ${OA_CAP_MAX[k]}/nick/ngày của máy chủ + worker VPS (không vượt được — engine dùng min(van brand, trần))${risky ? ' · thao tác nhạy, nên giữ thấp để an toàn nick' : ''}\">${risky ? SLI.warning + ' ' : ''}≤${OA_CAP_MAX[k]}</span>`; // v119-88: hiện trần cho cả 4 loại", tag='45.hint')
rep(O45, "      const capMax = { react: 200, comment: 100, friend: 30, inbox: 30 };", "      const capMax = oaHardCaps(); // v119-88 (F-2)", tag='45.capsave')

rep(O45, "    const safetyChip = sv == null ? '' : `<span class=\"chip oa-safety ${sv >= 75 ? 'ok' : sv >= 50 ? 'warn' : 'bad'}\" title=\"Safety Score ${sv}/100 — checkpoint ${a.challengeTotal || 0} · đăng nhập lại ${a.needLoginTotal || 0} · lỗi ${a.failCount || 0} · thành công ${a.okCount || 0}. Dưới 60: worker tự giãn nhịp; dưới 30: tự tạm dừng nick.\">${SLI.shield} ${sv}</span> `;",
"""    /* v119-88 (R-9): worker 2026-09-11 ghi safetyWhy (checkpoint · đăng nhập lại · lỗi FB · thành công · lỗi giao diện KHÔNG trừ điểm) + lỗi gần nhất → tooltip nói rõ VÌ SAO điểm thấp (trước: nick t7 tụt 28 vì 43 lỗi selector của worker mà web chỉ ghi "lỗi 43") */
    const why = a.safetyWhy ? String(a.safetyWhy) : ('checkpoint ' + (a.challengeTotal || 0) + ' · đăng nhập lại ' + (a.needLoginTotal || 0) + ' · lỗi ' + (a.failCount || 0) + ' · thành công ' + (a.okCount || 0) + (a.uiFailCount ? ' · lỗi giao diện ' + a.uiFailCount + ' (không trừ điểm)' : ''));
    const lastF = a.lastFailKind ? (' Lỗi gần nhất: ' + (a.lastFailKind === 'ui' ? 'giao diện (worker không thấy nút/ô — không trừ điểm)' : a.lastFailKind === 'fb' ? 'Facebook từ chối/chặn' : String(a.lastFailKind)) + (a.lastFailMsg ? ' — ' + String(a.lastFailMsg).slice(0, 90) : '') + '.') : '';
    const safetyChip = sv == null ? '' : `<span class=\"chip oa-safety ${sv >= 75 ? 'ok' : sv >= 50 ? 'warn' : 'bad'}\" title=\"Safety Score ${sv}/100 — ${esc(why)}.${esc(lastF)} Dưới 60: worker tự giãn nhịp; dưới 30: tự tạm dừng nick.\">${SLI.shield} ${sv}</span> `;""", tag='45.safety')
rep(O45, 'rồi bấm ${SLI.check} Đã xử lý.">${SLI.ban}', 'rồi bấm Đã xử lý.">${SLI.ban}', tag='45.flagTitle')  # v119-88: SVG trong title → thẻ vỡ, lộ chữ 'Đã xử lý.">' (tồn từ M3 v119-61)
rep(O45, "bấm '+'Đã xử lý\">'+SLI.ban+' tạm dừng (Safety)</span> ' : '';", "bấm '+'Đã xử lý'+(a.safetyWhy?' · '+esc(a.safetyWhy):'')+'\">'+SLI.ban+' tạm dừng (Safety)</span> ' : ''; // v119-88: kèm lý do", tag='45.paused')

rep(O45, """    const nicks = oaNickCount(b.code);
    const nickHtml = nicks
      ? `<span class="oa-fbtag">FB</span> ${nicks} nick${nicks > 1 ? ' · xoay vòng' : ''}`
      : `<span class="oa-fbtag none">FB</span> chưa gán nick`;
    const stateBadge = c.on ? '<span class="oa-state on"><span class="oa-dotp"></span>BẬT</span>' : '<span class="oa-state off"><span class="oa-dotp"></span>TẮT</span>';""",
"""    const nicks = oaNickCount(b.code);
    /* v119-88 (F-7): nick chạy được (bật + không cờ). Brand BẬT nhưng 0/N chạy được → chip cảnh báo thay "BẬT" + dòng nick đỏ (automation đứng im; LỆNH #44 giữ phễu chờ nick ≤72 h). */
    const nAll = oaNickAll(b.code).length, nLive = oaNickLive(b.code);
    const os = (!oaIsDemo() && D.oaStatus && D.oaStatus.brands && D.oaStatus.brands[b.code]) || null;
    const liveHtml = (nAll && nLive < nAll) ? ` · <span class="oa-nlive ${nLive ? 'warn' : 'bad'}" title="Nick chạy được = đang bật và không cờ cần đăng nhập lại / checkpoint / tạm dừng Safety${os && os.orphan ? ' · máy chủ: ' + Number(os.orphan) + ' phễu đang chờ nick' : ''}">${nLive}/${nAll} chạy được</span>` : '';
    const nickHtml = nicks
      ? `<span class="oa-fbtag">FB</span> ${nicks} nick${nicks > 1 ? ' · xoay vòng' : ''}${liveHtml}`
      : `<span class="oa-fbtag none">FB</span> ${nAll ? nAll + ' nick đang tắt' : 'chưa gán nick'}${liveHtml}`;
    const stateBadge = c.on
      ? ((nAll && !nLive) ? `<span class="oa-state warn" title="Brand đang BẬT nhưng không nick nào chạy được (${nAll} nick: cần đăng nhập lại / checkpoint / tạm dừng Safety / đã tắt) — automation đứng im, phễu đang mở chờ nick tới 72 giờ rồi đóng. Xử lý nick trên AdsPower rồi bấm Đã xử lý ở bảng Tài khoản Facebook."><span class="oa-dotp"></span>BẬT · 0/${nAll} nick</span>` : '<span class="oa-state on"><span class="oa-dotp"></span>BẬT</span>')
      : '<span class="oa-state off"><span class="oa-dotp"></span>TẮT</span>';""", tag='45.card')
rep(O45, "${SLI.info} Chưa gán nick cho brand – thêm ở bảng Tài khoản Facebook bên dưới; van an toàn sẽ hiện theo số nick.</div>",
"${SLI.info} ${nAll ? nAll + ' nick của brand đều đang tắt – bật lại hoặc bấm Đã xử lý ở bảng Tài khoản Facebook' : 'Chưa gán nick cho brand – thêm ở bảng Tài khoản Facebook bên dưới'}; van an toàn sẽ hiện theo số nick.</div>", tag='45.novalve')

rep(O45, "  views.outreach = function () {",
"""  /* v119-88 (F-7): dòng trạng thái từ MÁY CHỦ — engine LỆNH #44 sweeper ghi system_status/outreach mỗi ≤25′ (super đọc). Chỉ hiện khi có gì đáng chú ý ở lượt kiểm gần nhất. */
  function oaStatusStrip() {
    const st = (!oaIsDemo() && D.oaStatus) || null; if (!st || !st.brands) return '';
    const ms = Number(st.at) || 0;
    const rows = [];
    Object.keys(st.brands).forEach(code => { const x = st.brands[code] || {}; if (!x.on) return;
      if (x.nicksTotal && !x.nicksAlive) rows.push(`<b>${esc(oaBrandName(code))}</b>: BẬT nhưng 0/${Number(x.nicksTotal)} nick sống${x.orphan ? ` · ${Number(x.orphan)} phễu chờ nick` : ''}`);
      else if (x.orphan) rows.push(`<b>${esc(oaBrandName(code))}</b>: ${Number(x.orphan)} phễu chờ nick`); });
    if (st.closed) rows.push(`${Number(st.closed)} phễu đóng vì quá 72 giờ`);
    if (st.moved) rows.push(`${Number(st.moved)} phễu chuyển sang nick khác`);
    if (!rows.length) return '';
    return `<div class="oa-banner oa-banner-warn mt-14" id="oaStatusStrip">${SLI.siren}<div><b>Máy chủ kiểm lúc ${ms ? esc(new Date(ms).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })) : '?'}</b> · ${rows.join(' · ')}</div></div>`;
  }
  views.outreach = function () {""", tag='45.strip')
rep(O45, "      ${banner}\n      <div class=\"grid g-4 mt-14\">", "      ${banner}${oaStatusStrip()}\n      <div class=\"grid g-4 mt-14\">", tag='45.stripUse')

# demo: nick An Lành (brand Herbal Nature đang BẬT) tạm dừng Safety với lý do worker mới → thẻ hn "BẬT · 0/1 nick"; VPS báo hardCaps; 1 dòng log Chạy thử
rep(O45, "    { id: 'fbu100066623401992', label: 'An Lành',       brand: 'hn', active: true,  tokenSet: true },",
"    { id: 'fbu100066623401992', label: 'An Lành',       brand: 'hn', active: false, tokenSet: true, safety: 28, safetyPaused: true, safetyWhy: 'checkpoint 0 · đăng nhập lại 0 · lỗi FB 3 · thành công 74 · lỗi giao diện 43 (không trừ điểm)', lastFailKind: 'ui', lastFailMsg: 'không thấy ô Bình luận lẫn nút Bình luận của bài' }, // v119-88: minh hoạ brand BẬT nhưng 0 nick chạy được + lý do Safety", tag='45.demoAcct')
rep(O45, "    { id: 'vps-1', workerId: 'vps-1', isOnline: true,  running: 3, maxConcurrent: 8,  ramUsedPct: 62, ramFreeMB: 6100, ramTotalMB: 16000, version: '2026-08-30', lastWhen: 'vừa xong' },",
"    { id: 'vps-1', workerId: 'vps-1', isOnline: true,  running: 3, maxConcurrent: 8,  ramUsedPct: 62, ramFreeMB: 6100, ramTotalMB: 16000, version: '2026-09-11', lastWhen: 'vừa xong', hardCaps: { react: 80, comment: 30, friend: 20, inbox: 15 }, dryRun: false },", tag='45.demoWorker')
rep(O45, "status: 'sched', when: '31 phút trước' }\n  ];",
"status: 'sched', when: '31 phút trước' },\n    { name: 'Đỗ Minh Hương', brand: 'Herbal Nature', temp: 'warm', score: 71, action: '[DRY] Phễu tự động cho Lead', text: 'mở được bài ✓ · fb_dtsg ✓ · trang cá nhân mở ✓ · nút Nhắn tin ✓ (chạy thử, không thao tác)', status: 'dry', when: '40 phút trước' } // v119-88: worker dryRun\n  ];", tag='45.demoLog')

# ---------- 20-feed: botChip tên nick từ pid ----------
rep(F20, "${o.nick?' · nick '+esc(o.nick):''}", "${o.pid?' · nick '+esc(nickLabel(o.pid)):(o.nick?' · nick '+esc(o.nick):'')}", tag='20.botChip')  # v119-88 (F-6): worker ghi pid

# ---------- 50-config-views: Cảnh báo hệ thống — brand BẬT nhưng 0 nick chạy được ----------
rep(C50, "    (oaWorkers()||[]).filter(w=>!w.isOnline).forEach(w=>add(SLI.monitor,'VPS '+(w.workerId||w.id||'?')+' offline','lần cuối báo về '+(w.lastWhen||'?'),'outreach','bad'));",
"""    /* v119-88 (F-7): brand BẬT tự động nhưng 0 nick chạy được (bật + không cờ) → automation đứng im; kèm số phễu chờ nick từ máy chủ (system_status/outreach, LỆNH #44) */
    (oaBrands()||[]).forEach(b=>{ const o=b.outreach||{}; if(!o.on) return; const all=(oaAccounts()||[]).filter(a=>a.brand===b.code); if(!all.length) return;
      const live=all.filter(a=>a.active!==false&&!a.needLogin&&!a.challenge&&!a.safetyPaused).length; if(live) return;
      const os=(D.oaStatus&&D.oaStatus.brands&&D.oaStatus.brands[b.code])||{};
      add(SLI.bot,'Brand '+(b.name||b.code)+' đang BẬT tự động nhưng 0/'+all.length+' nick chạy được','automation đứng im'+(os.orphan?' · máy chủ: '+Number(os.orphan)+' phễu đang chờ nick':'')+' · xử lý nick rồi bấm Đã xử lý ở Tiếp cận','outreach','bad'); });
    (oaWorkers()||[]).filter(w=>!w.isOnline).forEach(w=>add(SLI.monitor,'VPS '+(w.workerId||w.id||'?')+' offline','lần cuối báo về '+(w.lastWhen||'?'),'outreach','bad'));""", tag='50.alert')
if ESM:
    rep(C50, "import { OA_CHALLENGE_VI, oaAccounts, oaWorkers } from './45-outreach.js';", "import { OA_CHALLENGE_VI, oaAccounts, oaBrands, oaWorkers } from './45-outreach.js';", tag='50.esmImport')

# ---------- CSS ----------
rep(CSS, ".oa-state.off { background: var(--danger-bg); color: var(--danger); }",
""".oa-state.off { background: var(--danger-bg); color: var(--danger); }
/* v119-88: brand BẬT nhưng 0 nick chạy được · nick chạy được k/N · trần van (mọi loại) · dòng trạng thái máy chủ */
.oa-state.warn { background: var(--warning-bg); color: var(--warning); }
.oa-nlive { font-weight: 700; } .oa-nlive.bad { color: var(--danger); } .oa-nlive.warn { color: var(--warning); }
.oa-caphint.soft { color: var(--ink-500); font-weight: 600; }
.oa-banner.oa-banner-warn { background: var(--warning-bg); border-color: #F3D9A4; color: #7C3E00; }
.oa-banner.oa-banner-warn > svg, .oa-banner.oa-banner-warn > .i { color: var(--warning); }""", tag='css')

# ---------- smoke: +4 check ----------
rep(S, "  errors.length ? fail('Lỗi JS: ' + errors.slice(0, 4).join(' | ')) : ok('Không có lỗi JS');\n  await browser.close(); server.close();",
"""  // ===== v119-88: kênh nick realtime + system_status/outreach (live.min.js) · thẻ brand "BẬT · 0/N nick" + lý do Safety + nhãn Chạy thử · van kẹp trần cứng · botChip tên nick =====
  { const lv = fs.readFileSync(path.join(ROOT, 'assets/min/js/live.min.js'), 'utf8'); const okLv = /"nick Facebook"/.test(lv) && /"system_status","outreach"/.test(lv) && /nextFreeAt\\|updatedAt/.test(lv);
    okLv ? ok('v119-88: live.min.js có kênh realtime fb_accounts ("nick Facebook") + system_status/outreach + chữ ký bỏ trường ghi mỗi tick') : fail('v119-88 live.min.js thiếu kênh nick/outreach status'); }
  await page.evaluate(() => { location.hash = 'outreach'; window.SLApp.reload(window.SL_DATA); }); await page.waitForTimeout(500);
  const k88a = await page.evaluate(() => { const v = document.getElementById('view'); const warn = [...v.querySelectorAll('.oa-card .oa-state.warn')]; const card = warn.length ? warn[0].closest('.oa-card') : null;
    return { warn: warn.length, txt: warn.length ? warn[0].textContent.trim() : '', live: card ? ((card.querySelector('.oa-nlive') || {}).textContent || '') : '', dry: [...v.querySelectorAll('.oa-frow')].some(r => /Chạy thử/.test(r.textContent)), why: [...v.querySelectorAll('.oa-safety')].some(e => /lỗi giao diện 43 \\(không trừ điểm\\)/.test(e.title) && /Lỗi gần nhất: giao diện/.test(e.title)), on: v.querySelectorAll('.oa-card .oa-state.on').length }; });
  (k88a.warn === 1 && /BẬT · 0\\/1 nick/.test(k88a.txt) && /0\\/1 chạy được/.test(k88a.live) && k88a.dry && k88a.why && k88a.on >= 1) ? ok('v119-88: thẻ brand "BẬT · 0/1 nick" + "0/1 chạy được" (nick tạm dừng Safety) · log "Chạy thử" · tooltip Safety nói rõ lý do (lỗi giao diện không trừ điểm)') : fail('v119-88 brand/nick: ' + JSON.stringify(k88a));
  await page.evaluate(() => { document.querySelector('.oa-card [data-oa-cfg]').click(); }); await page.waitForTimeout(300);
  const k88b = await page.evaluate(() => { const m = document.getElementById('modal'); const mx = {}; m.querySelectorAll('input[data-cap]').forEach(i => { mx[i.dataset.cap] = i.max; }); const hints = m.querySelectorAll('.oa-caphint').length; const r = m.querySelector('input[data-cap="react"]'); r.value = '200'; m.querySelector('#oaCfgSave').click(); return { mx, hints }; });
  await page.waitForTimeout(300);
  await page.evaluate(() => { document.querySelector('.oa-card [data-oa-cfg]').click(); }); await page.waitForTimeout(300);
  const k88c = await page.evaluate(() => { const m = document.getElementById('modal'); const r = m.querySelector('input[data-cap="react"]'); const val = r ? r.value : ''; const c = m.querySelector('#oaCfgCancel'); if (c) c.click(); return { val }; });
  (k88b.mx.react === '80' && k88b.mx.comment === '30' && k88b.mx.friend === '20' && k88b.mx.inbox === '15' && k88b.hints === 4 && k88c.val === '80') ? ok('v119-88: van ⚙ kẹp trần cứng 80/30/20/15 (4 ô đều hiện ≤trần) · nhập 200 → lưu → 80') : fail('v119-88 van: ' + JSON.stringify({ k88b, k88c }));
  await page.evaluate(() => { const D = window.SL_DATA; D.__fbBak = D.fbAccounts; D.fbAccounts = [{ id: 'apk88', adspower_id: 'k88', label: 'Nick Test 88', brand: 'x' }]; const l = D.leads.find(x => !x.dropped && !x.lost && x.temp === 'hot'); l.__ob = l.outreach; l.__k88 = 1; l.outreach = { steps: ['react', 'comment'], last: 'comment', at: Date.now(), pid: 'apk88' }; location.hash = 'feed'; window.SLApp.reload(D); }); await page.waitForTimeout(500);
  const k88d = await page.evaluate(() => ({ tips: [...document.querySelectorAll('#view .chip-bot')].map(c => c.getAttribute('data-tip') || '') }));
  await page.evaluate(() => { const D = window.SL_DATA; D.fbAccounts = D.__fbBak; delete D.__fbBak; const l = D.leads.find(x => x.__k88); if (l) { if (l.__ob === undefined) delete l.outreach; else l.outreach = l.__ob; delete l.__ob; delete l.__k88; } window.SLApp.reload(D); }); await page.waitForTimeout(200);
  k88d.tips.some(t => /nick Nick Test 88/.test(t)) ? ok('v119-88: chip máy trên thẻ lead ghi TÊN nick (outreach.pid → nhãn)') : fail('v119-88 botChip: ' + JSON.stringify(k88d.tips.slice(0, 3)));
  errors.length ? fail('Lỗi JS: ' + errors.slice(0, 4).join(' | ')) : ok('Không có lỗi JS');
  await browser.close(); server.close();""", tag='smoke.k88')
done()
