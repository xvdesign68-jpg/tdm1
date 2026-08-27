#!/usr/bin/env node
'use strict';
/* worker.js — CHẾ ĐỘ TỰ ĐỘNG: đọc hàng đợi Firestore rồi thực thi bằng AdsPower.
   SmartLead (Cloud Function) chỉ việc TẠO task vào collection `outreach_tasks`; worker này (trên VPS anh)
   nhặt task, chạy react/comment/inbox, rồi ghi kết quả về → UI SmartLead realtime.

   Schema 1 task (collection `outreach_tasks`):
     { channel:'fb', action:'react'|'comment'|'inbox',
       profile_id:'<adspower user_id>',        // nick nào hành động
       target:'<post url | uid | profile url>',
       text:'...', reaction:'love',
       status:'pending', lead_id:'...(tuỳ)',
       createdAt: <serverTimestamp> }
   Worker cập nhật: status → processing → done|failed|skipped, kèm result{} và processedAt.

   Chạy: đặt GOOGLE_APPLICATION_CREDENTIALS trong .env trỏ tới file service account, rồi: node worker.js
*/
const cfg = require('./src/config');
const { executeAction } = require('./src/runner');

let admin;
try { admin = require('firebase-admin'); }
catch {
  console.error('❌ Thiếu firebase-admin. Cài: npm i firebase-admin  (chỉ cần cho chế độ worker).');
  process.exit(1);
}
if (!cfg.worker.credsPath) {
  console.error('❌ Chưa đặt GOOGLE_APPLICATION_CREDENTIALS trong .env (đường dẫn file service account Firebase).');
  process.exit(1);
}

admin.initializeApp({ credential: admin.credential.cert(require(require('path').resolve(cfg.worker.credsPath))) });
const db = admin.firestore();
const COL = cfg.worker.collection;

const log = {
  info: (...a) => console.log(new Date().toISOString(), ...a),
  ok: (...a) => console.log(new Date().toISOString(), '✅', ...a),
  err: (...a) => console.log(new Date().toISOString(), '❌', ...a),
};

let stopping = false;
process.on('SIGINT', () => { console.log('\nĐang dừng…'); stopping = true; });

/** Nhặt & "chiếm" 1 task (chuyển pending→processing) an toàn với nhiều worker. */
async function claim(docRef) {
  return db.runTransaction(async tx => {
    const snap = await tx.get(docRef);
    if (!snap.exists) return null;
    const d = snap.data();
    if (d.status !== 'pending') return null;
    tx.update(docRef, { status: 'processing', claimedAt: admin.firestore.FieldValue.serverTimestamp() });
    return { id: snap.id, ...d };
  });
}

async function loop() {
  log.info(`Worker FB khởi động. Đọc "${COL}" (channel=fb, status=pending), mỗi vòng ${cfg.worker.batch} task / ${cfg.worker.pollMs}ms.`);
  while (!stopping) {
    let processedAny = false;
    try {
      const q = await db.collection(COL)
        .where('channel', '==', 'fb')
        .where('status', '==', 'pending')
        .orderBy('createdAt', 'asc')
        .limit(cfg.worker.batch)
        .get();

      for (const doc of q.docs) {
        if (stopping) break;
        const task = await claim(doc.ref);
        if (!task) continue; // ai đó chiếm rồi
        processedAny = true;
        log.info(`▶ task ${task.id}: ${task.action} bằng nick ${task.profile_id}`);
        let res;
        try {
          res = await executeAction({
            profileId: task.profile_id,
            action: task.action,
            target: task.target,
            text: task.text,
            reaction: task.reaction,
          }, log);
        } catch (e) {
          res = { ok: false, detail: 'lỗi runtime: ' + e.message };
        }
        const status = res.ok ? 'done' : (res.skipped ? 'skipped' : 'failed');
        await doc.ref.update({
          status, result: res,
          processedAt: admin.firestore.FieldValue.serverTimestamp(),
        });
        (res.ok ? log.ok : log.err)(`task ${task.id} → ${status}: ${res.detail}`);
      }
    } catch (e) {
      // lỗi index thường gặp: cần composite index (channel, status, createdAt) — link nằm trong message
      log.err('vòng lặp lỗi: ' + e.message);
    }
    if (!processedAny) await new Promise(r => setTimeout(r, cfg.worker.pollMs));
  }
  log.info('Đã dừng worker.');
  process.exit(0);
}

loop();
