# LỆNH #21 — SỬA GỐC `scheduledScan`: gieo snapshot → gặt lượt sau (v-sow) + bdwatch (BrightData ngưng → alert) + timeout 1800 (05/09/2026)

> Từ dump `scan-dump-0905.txt`: `scanAll` (index.js 212–706) Pha 1 `mapPool(sources, 3, …)` → mỗi nguồn `fetchPosts` (lib/scraper.js 147–181): không có pending → `bdTrigger` rồi **`bdWaitSoft(snap, 18, 5000)` = chờ tới 90 s** → chưa chín → ghi `pending_snapshots` + "GIEO … se gat luot sau" → lượt sau `bdStatus` chín → "GAT" → `bdFetch`. Thực tế **KHÔNG nguồn nào chín trong 90 s** (log 814 s: 15/15 trigger đều GIEO) → 90 s/nguồn × ~12–15 nguồn ÷ 3 slot = 400–500 s chờ VÔ ÍCH mỗi lượt; cộng Pha 1b comment `bdWait(snap, 85, 6000)` (tới 510 s) → lượt 4–13'. Quét theo lịch (`every 3 minutes`) không có khoá — Cloud Scheduler tự single-flight (attemptDeadline 540 s) nên lượt kế chỉ bắt đầu sau khi lượt trước trả lời/hết hạn → sau 504 lượt cũ vẫn chạy nền nhưng CPU bị throttle.
> **Sửa (chỉ đường quét theo LỊCH; quét tay/backfill/force giữ nguyên cách chờ)**: (1) `sowMode` → `fetchPosts({sow:true, sowDue})`: không pending → gieo NGAY (không chờ) khi **tới nhịp nguồn** (`group_state.lastTriggerAt` + `config/app.scanIntervalMin` > `.env SCAN_SOURCE_INTERVAL_MIN`, mặc định **10'**) → gặt ở lượt kế (3' sau). Lượt ≈ 30 s; mỗi nguồn 1 trigger/~12' (nay ~1/20') — nếu BrightData tính tiền record trống thì tốn thêm ~+50–70 record/giờ; muốn tiết kiệm đặt `scanIntervalMin: 15` trong `config/app`. (2) Gặt snapshot gieo ở nhịp sweep → giữ đủ 20 bài (không cắt theo bài đã thấy). (3) Leo thang probe→full trong sow mode không làm rơi bài probe (`usePosts = full.length ? full : posts`). (4) **bdwatch**: sau Pha 1, nếu ≥min(3,N) nguồn lỗi BrightData (`trigger 4xx/5xx`, `not active`, `snapshot…`) và 0 nguồn gọi BrightData thành công → log JSON **severity ERROR `[BRIGHTDATA-DOWN]`** (alert policy LỆNH #9 → email anh, không cần policy mới) + `system_status/brightdata {ok:false, since, sample, runs}`; hết ngưng → WARNING `[BRIGHTDATA-UP]` + `ok:true`. (5) `scheduledScan` `timeoutSeconds: 1800, maxInstances: 1` (lưới an toàn). (6) `lib/config.js` thêm `BD_SOW_MODE` (tắt = về cách cũ, không cần sửa code), `SCAN_SOURCE_INTERVAL_MIN`, `PROBE_POSTS`, `FULLSWEEP_HOURS` (mặc định = giá trị đang chạy).
> Đã test: patch idempotent trên bản dựng lại từ dump, `node --check` 3 file, harness `fetchPosts` 7/7 (skip / gieo / chưa chín / gặt+sweep / quét tay / outage / unknown) + harness bdwatch 6/6. Không có secret. Deploy `scheduledScan` + `manualScan` (cùng import scraper/config) — lệnh deploy XÍCH `&&` sau patch (bài học LỆNH #20).

```bash
cd ~/firebase-s13/functions
echo "=== (a) backup 3 file ==="; TS=$(date +%Y%m%d-%H%M%S); cp index.js "index.js.bak-$TS"; cp lib/scraper.js "lib/scraper.js.bak-$TS"; cp lib/config.js "lib/config.js.bak-$TS"; ls -1 *.bak-$TS lib/*.bak-$TS
echo "=== (b) patch v-sow (mốc nội dung, idempotent) ==="
cat > /tmp/ss_fix.cjs <<'EOF_FIX'
/* LỆNH #21 — v-sow 05/09/2026: quét theo lịch GIEO snapshot rồi GẶT lượt sau (không chờ 90 s/nguồn) + bdwatch (BrightData ngưng → log ERROR + system_status) + timeout 1800.
   Patch 3 file bằng mốc NỘI DUNG (không theo số dòng). Tìm ĐỦ mốc trước, thiếu mốc nào → KHÔNG ghi gì (exit 1). Idempotent qua marker 'v-sow'. */
const fs = require('fs');
const files = { idx: 'index.js', scr: 'lib/scraper.js', cfg: 'lib/config.js' };
const src = {}; for (const k in files) src[k] = fs.readFileSync(files[k], 'utf8');
if (src.idx.includes('v-sow') && src.scr.includes('v-sow') && src.cfg.includes('v-sow')) { console.log('DA VA v-sow o ca 3 file — bo qua'); process.exit(0); }
const miss = [];
const need = (name, ok) => { if (!ok) miss.push(name); };
const L = src.idx.split('\n');
const iForce = L.findIndex(l => l.startsWith('  const force = !!opts.force;')); need('idx:force', iForce >= 0);
const iPosts = L.findIndex(l => l.includes('const posts = await fetchPosts(src, {')); need('idx:fetchPosts', iPosts >= 0);
const iFull = L.findIndex(l => l.includes('const full = await fetchPosts(src, {') && l.includes('usePosts = full; }')); need('idx:escalate', iFull >= 0);
const iPh1b = L.findIndex(l => l.startsWith('  /* ---- Pha 1b: QUÉT COMMENT')); need('idx:pha1b', iPh1b >= 0);
const iSched = L.findIndex(l => /^export const scheduledScan\s*=\s*onSchedule\(/.test(l)); need('idx:sched', iSched >= 0 && L[iSched + 1] && L[iSched + 1].includes("timeZone: 'Asia/Ho_Chi_Minh' }"));
const S = src.scr.split('\n');
const sStart = S.findIndex(l => l.includes('// ==== v16 GIEO-GAT 09/08/2026')); need('scr:start', sStart >= 0);
const sRaw = S.findIndex(l => l.trim() === 'const raw = await bdFetch(snap);'); need('scr:raw', sRaw > sStart);
const sRet = S.findIndex(l => l.trim() === 'return _good.map(p => normalizePost(p, source));'); need('scr:return', sRet > sRaw);
const C = src.cfg.split('\n');
const cAfter = C.findIndex(l => l.includes('POSTS_PER_GROUP: num(env.POSTS_PER_GROUP')); need('cfg:anchor', cAfter >= 0);
if (miss.length) { console.log('THIEU MOC:', miss.join(', '), '— KHONG GHI GI'); process.exit(1); }

/* ---------- index.js ---------- */
if (!src.idx.includes('v-sow')) {
  L[iSched + 1] = L[iSched + 1].replace("timeZone: 'Asia/Ho_Chi_Minh' }", "timeZone: 'Asia/Ho_Chi_Minh', timeoutSeconds: 1800, maxInstances: 1 }");
  const bdwatch = [
    "  /* ---- v-sow bdwatch 05/09/2026: BrightData ngưng (vd 'trigger 400: Customer is not active') → log JSON severity ERROR",
    "     (alert policy 'lỗi Cloud Functions/Run' → email Super Admin) + system_status/brightdata {ok,since,sample}. Hết ngưng → WARNING [BRIGHTDATA-UP]. ---- */",
    "  try {",
    "    const isBdErr = r => !!(r.error && /trigger \\d{3}|snapshot|not active|fetch failed|ECONN|ETIMEDOUT|ENOTFOUND/i.test(r.error));",
    "    const bdErrs = bySource.filter(isBdErr), bdOks = bySource.filter(r => r.bd === 'ok');",
    "    const nBd = bySource.filter(r => r.bd || isBdErr(r)).length;",
    "    const stRef = db.collection('system_status').doc('brightdata');",
    "    if (nBd >= 1 && bdErrs.length >= Math.min(3, nBd) && bdOks.length === 0) {",
    "      const sample = String(bdErrs[0].error || '').slice(0, 160);",
    "      const prev = await stRef.get().catch(() => null); const pd = prev && prev.exists ? prev.data() : null;",
    "      const since = (pd && pd.ok === false && pd.since) ? pd.since : Date.now();",
    "      await stRef.set({ ok: false, since, at: Date.now(), runs: FieldValue.increment(1), errors: bdErrs.length, sources: nBd, sample }, { merge: true });",
    "      console.log(JSON.stringify({ severity: 'ERROR', message: `[BRIGHTDATA-DOWN] ${bdErrs.length}/${nBd} nguồn lỗi BrightData, 0 nguồn OK (từ ${new Date(since + 7 * 3600e3).toISOString().slice(0, 16).replace('T', ' ')} VN): ${sample}` }));",
    "    } else if (bdOks.length) {",
    "      const prev = await stRef.get().catch(() => null); const pd = prev && prev.exists ? prev.data() : null;",
    "      if (!pd || pd.ok !== true) { await stRef.set({ ok: true, at: Date.now(), recoveredAt: Date.now(), runs: 0 }, { merge: true }); if (pd && pd.ok === false) console.log(JSON.stringify({ severity: 'WARNING', message: '[BRIGHTDATA-UP] BrightData hoạt động lại' })); }",
    "    }",
    "  } catch (e) { console.warn('[bdwatch]', e && e.message); }",
    ""
  ];
  L.splice(iPh1b, 0, ...bdwatch);
  // escalation (trước khi chèn ở trên vì index không đổi cho các dòng < iPh1b)
  L[iFull] = L[iFull].replace("})() }); bdRecords += full.length; row.bdPosts += full.length; usePosts = full; }", "})(), sow: sowMode, sowDue: true }); bdRecords += full.length; row.bdPosts += full.length; usePosts = full.length ? full : posts; }");
  const old = L[iPosts];
  L.splice(iPosts, 1,
    "      let sowDue = true; // v-sow: gieo khi tới nhịp nguồn (lastTriggerAt trong group_state)",
    "      if (sowMode) { const gs = gsBy.get(src.url); sowDue = (nowMs0 - (Number(gs && gs.lastTriggerAt) || 0)) >= SRC_IV_MS; }",
    old.replace("})() });", "})(), sow: sowMode, sowDue, sweep: didSweep });"),
    "      row.bd = posts.bd || 'ok'; // 'ok' = đã gọi BrightData thành công (bdwatch), 'skip' = chưa tới nhịp",
    "      if (posts.sweep) didSweep = true; // gặt snapshot đã gieo ở nhịp sweep → không cắt theo bài đã thấy"
  );
  L.splice(iForce + 1, 0,
    "  /* v-sow 05/09/2026: quét theo LỊCH gieo snapshot BrightData rồi gặt ở lượt sau (không chờ 90 s/nguồn trong lượt → lượt ≈ 30 s thay vì 7–13').",
    "     Nhịp gieo mỗi nguồn: config/app.scanIntervalMin (Super Admin) > .env SCAN_SOURCE_INTERVAL_MIN (mặc định 10'). Quét tay / backfill / force giữ cách cũ (chờ trong lượt). */",
    "  const sowMode = trigger === 'scheduled' && !force && !(opts.startDate || opts.endDate) && CFG.BD_SOW_MODE !== false;",
    "  const SRC_IV_MS = Math.max(3, Number(config.scanIntervalMin) || CFG.SCAN_SOURCE_INTERVAL_MIN || 10) * 60e3;"
  );
  fs.writeFileSync(files.idx, L.join('\n'));
}
/* ---------- lib/scraper.js ---------- */
if (!src.scr.includes('v-sow')) {
  const block = [
    "  // ==== v16 GIEO-GAT 09/08/2026 + v-sow 05/09/2026: gieo snapshot, gat o luot sau. opts.sow=true (quet theo LICH): KHONG cho trong luot ====",
    "  const pendRef = __pendDb().collection('pending_snapshots').doc('P_' + String(source.url || '').replace(/[^\\w-]/g, '_').slice(0, 470));",
    "  const gsRef = __pendDb().collection('group_state').doc(String(source.url || '').replace(/[^\\w-]/g, '_').slice(0, 480));",
    "  const mark = (arr, bd, extra) => { try { arr.bd = bd; if (extra) Object.assign(arr, extra); } catch (e) {} return arr; }; // arr.bd: 'ok' = da goi BrightData thanh cong, 'skip' = khong goi",
    "  let snap = null, pendSweep = false;",
    "  try {",
    "    const pd = await pendRef.get();",
    "    if (pd.exists) {",
    "      const p = pd.data() || {};",
    "      const st = await bdStatus(p.snapshot_id);",
    "      if (st === 'ready') { snap = p.snapshot_id; pendSweep = !!p.sweep; try { await pendRef.delete(); } catch (e) {} log.info('GAT snapshot ' + p.snapshot_id + ' — ' + source.url); }",
    "      else if (st === 'failed' || (Date.now() - (p.t || 0)) > 2 * 3600e3) { try { await pendRef.delete(); } catch (e) {} }",
    "      else { log.info('snapshot ' + p.snapshot_id + ' chua chin (' + st + ') — cho luot sau: ' + source.url); return mark([], st === 'unknown' ? 'skip' : 'ok'); }",
    "    }",
    "  } catch (e) {}",
    "  if (!snap) {",
    "    if (opts.sow) {",
    "      if (opts.sowDue === false) return mark([], 'skip'); // chua toi nhip gieo cua nguon nay",
    "      snap = await bdTrigger([source.url], trigOpts);",
    "      try { await pendRef.set({ snapshot_id: snap, url: source.url || '', backfill: false, sweep: !!opts.sweep, t: Date.now() }); } catch (e) {}",
    "      try { await gsRef.set({ url: source.url || '', lastTriggerAt: Date.now() }, { merge: true }); } catch (e) {}",
    "      log.info('GIEO snapshot ' + snap + (opts.sweep ? ' (sweep)' : '') + ' — gat luot sau: ' + source.url);",
    "      return mark([], 'ok');",
    "    }",
    "    snap = await bdTrigger([source.url], trigOpts);",
    "    const ok = await bdWaitSoft(snap, backfill ? 40 : 18, backfill ? 6000 : 5000);",
    "    if (!ok) {",
    "      try { await pendRef.set({ snapshot_id: snap, url: source.url || '', backfill: !!backfill, t: Date.now() }); } catch (e) {}",
    "      log.info('GIEO snapshot ' + snap + ' (nguon cham) — se gat luot sau: ' + source.url);",
    "      return mark([], 'ok');",
    "    }",
    "  }"
  ];
  S[sRet] = "  return mark(_good.map(p => normalizePost(p, source)), 'ok', { sweep: pendSweep });";
  S.splice(sStart, sRaw - sStart, ...block);
  fs.writeFileSync(files.scr, S.join('\n'));
}
/* ---------- lib/config.js ---------- */
if (!src.cfg.includes('v-sow')) {
  C.splice(cAfter + 1, 0,
    "  // v-sow 05/09/2026: quét theo lịch GIEO snapshot (không chờ trong lượt); nhịp gieo mỗi nguồn (phút) — config/app.scanIntervalMin ghi đè",
    "  BD_SOW_MODE: bool(env.BD_SOW_MODE, true),",
    "  SCAN_SOURCE_INTERVAL_MIN: num(env.SCAN_SOURCE_INTERVAL_MIN, 10),",
    "  PROBE_POSTS: num(env.PROBE_POSTS, 5),          // số bài dò mỗi nhịp (mặc định cũ trong code = 5)",
    "  FULLSWEEP_HOURS: num(env.FULLSWEEP_HOURS, 2),  // nhịp quét đủ POSTS_PER_GROUP (mặc định cũ = 2h)"
  );
  fs.writeFileSync(files.cfg, C.join('\n'));
}
console.log('PATCH OK: index.js(sowMode+fetchPosts+escalate+bdwatch+timeout1800) · lib/scraper.js(fetchPosts sow) · lib/config.js(BD_SOW_MODE,SCAN_SOURCE_INTERVAL_MIN,PROBE_POSTS,FULLSWEEP_HOURS)');
EOF_FIX
node /tmp/ss_fix.cjs && node --check index.js && node --check lib/scraper.js && node --check lib/config.js && echo "SYNTAX OK (3 file)" \
&& (set -a; . ./.env; set +a; node --input-type=module -e "const m=await import('./index.js'); console.log('IMPORT OK · scheduledScan =', typeof m.scheduledScan, '· manualScan =', typeof m.manualScan)") \
&& grep -n "sowMode\|timeoutSeconds: 1800\|BRIGHTDATA-DOWN" index.js | cut -c1-120 \
&& cd ~/firebase-s13 && firebase deploy --only functions:scheduledScan,functions:manualScan 2>&1 | grep -E "Deploy complete|scheduledScan|manualScan|rror" | head -8 \
&& echo "--- kiểm sau deploy (mong: 1800 · 1 · attemptDeadline 1800s):" \
&& gcloud functions describe scheduledScan --region asia-southeast1 --gen2 --format="value(serviceConfig.timeoutSeconds,serviceConfig.maxInstanceCount,serviceConfig.revision,updateTime)" \
&& gcloud scheduler jobs describe firebase-schedule-scheduledScan-asia-southeast1 --location asia-southeast1 --format="value(schedule,attemptDeadline,state)"
echo "=== XONG LỆNH #21 (nếu dừng giữa chừng: dòng lỗi ở ngay trên; rollback: cp index.js.bak-$TS index.js; cp lib/scraper.js.bak-$TS lib/scraper.js; cp lib/config.js.bak-$TS lib/config.js) ==="
```

**Sau ~10–12 phút** (3–4 lượt quét bản mới) chạy khối kiểm này rồi dán output — mong: `durMs` ≤ 60 000, lượt đầu posts 0 (chỉ gieo), lượt kế có posts/bdRecords, cột `bd ok/skip/err` ≈ `N/M/5`, `pending_snapshots` vài chục, `system_status/brightdata` ok:true:

```bash
cd ~/firebase-s13/functions
cat > _ss_after.mjs <<'EOF_CHK'
import { initializeApp, applicationDefault } from 'firebase-admin/app'; import { getFirestore } from 'firebase-admin/firestore';
initializeApp({ credential: applicationDefault(), projectId: 'smartlead-z15' }); const db=getFirestore();
const vn=ms=>new Date((ms||0)+7*3600e3).toISOString().replace('T',' ').slice(5,19);
const toMs=v=>!v?0:typeof v==='number'?v:typeof v.toMillis==='function'?v.toMillis():(v.seconds?v.seconds*1000:(Date.parse(v)||0));
const sc=await db.collection('scans').orderBy('at','desc').limit(8).get();
console.log('8 lượt gần nhất — giờVN | durMs | src | posts | bdRecords | scrapeErr | leads | bd ok/skip/err (bySource)');
sc.forEach(d=>{const s=d.data(); const bs=Array.isArray(s.bySource)?s.bySource:[]; const ok=bs.filter(r=>r.bd==='ok').length, sk=bs.filter(r=>r.bd==='skip').length, er=bs.filter(r=>r.error).length; console.log(' ',vn(toMs(s.at)),'|',s.durationMs,'|',s.sourcesCount,'|',s.postsFetched,'|',s.bdRecords,'|',s.scrapeErrors,'|',s.leadsCreated,'|',ok+'/'+sk+'/'+er);});
const st=await db.doc('system_status/brightdata').get(); console.log('system_status/brightdata:', st.exists? JSON.stringify(Object.assign({},st.data(),{since:st.data().since?vn(st.data().since):null,at:vn(st.data().at)})).slice(0,300) : '(chưa có — chưa lượt nào chạy bản mới)');
const pend=await db.collection('pending_snapshots').count().get(); console.log('pending_snapshots đang chờ gặt:', pend.data().count);
const gs=await db.collection('group_state').get(); let n=0,recent=0; gs.forEach(d=>{const x=d.data(); if(x.lastTriggerAt){n++; if(Date.now()-x.lastTriggerAt<3600e3) recent++;}}); console.log('group_state có lastTriggerAt:', n, '| gieo trong 1h qua:', recent);
EOF_CHK
node _ss_after.mjs 2>&1 | head -40; rm -f _ss_after.mjs
echo "--- 30 dòng log gần nhất của scheduledscan:"; gcloud logging read 'resource.type="cloud_run_revision" AND resource.labels.service_name="scheduledscan"' --limit 30 --format="value(timestamp,textPayload,jsonPayload.message,httpRequest.status,httpRequest.latency)" 2>/dev/null | sed -E 's/(api[_-]?key|token|secret|bearer)[=:][^ ]+/\1=***/Ig' | cut -c1-170
```

**Việc anh chốt riêng (không nằm trong LỆNH):** (1) 5 nguồn "thiếu cookie nick" (neu1 · bk-1 · nguyên căn 1 · hhqcvain1 · Tm S Con Sen) là nguồn quét bằng nick qua microservice trình duyệt — chưa có cookie VÀ `config.js` không có `BROWSER_SVC_URL` → đường này chết; nên **tắt 5 nguồn này trên web (Cấu hình → Nguồn quét)** cho sạch `scrapeErrors`. (2) `SCANNED_TTL_DAYS` có trong `.env` nhưng `config.js` KHÔNG đọc → TTL "Bài đã quét" luôn 1 ngày; em chưa đổi (đổi = kho scanned_posts phình theo giá trị .env, ảnh hưởng tab Bài đã quét) — anh muốn giữ mấy ngày thì nói em. (3) `config.js` có IP VPS mặc định trong `VPS_URL` — em KHÔNG ghi vào git/doc; nên dời sang `.env`.
