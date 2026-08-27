#!/usr/bin/env node
'use strict';
/* test.js — CHẠY TAY để test ngay trên VPS (không cần Firebase).
   Ví dụ:
     node test.js list                                             # liệt kê profile AdsPower
     node test.js open    --profile <ID>                           # mở FB kiểm tra nick khoẻ/đăng nhập chưa
     node test.js usage   --profile <ID>                           # xem đã dùng bao nhiêu hôm nay
     node test.js react   --profile <ID> --url <POST_URL> --reaction love
     node test.js comment --profile <ID> --url <POST_URL> --text "Bài hữu ích quá ạ"
     node test.js inbox   --profile <ID> --uid <UID|PROFILE_URL> --text "Chào anh/chị, em..."
   Thêm --dry để chạy thử KHÔNG gửi thật. */
const adspower = require('./src/adspower');
const safety = require('./src/safety');
const { executeAction } = require('./src/runner');

function parseArgs(argv) {
  const args = { _: [] };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--dry') args.dry = true;
    else if (a.startsWith('--')) { args[a.slice(2)] = argv[i + 1]; i++; }
    else args._.push(a);
  }
  return args;
}

const log = {
  info: (...a) => console.log('  ', ...a),
  ok: (...a) => console.log('✅', ...a),
  err: (...a) => console.log('❌', ...a),
};

(async () => {
  const args = parseArgs(process.argv.slice(2));
  const cmd = args._[0];

  try {
    if (!cmd || cmd === 'help') {
      console.log(require('fs').readFileSync(__filename, 'utf8').split('*/')[0].replace('#!/usr/bin/env node', '').replace("'use strict';", '').trim());
      return;
    }

    if (cmd === 'list') {
      const list = await adspower.listProfiles();
      if (!list.length) return log.err('AdsPower không trả profile nào (kiểm tra Local API đã bật + đã tạo profile).');
      console.log(`\nCó ${list.length} profile:\n`);
      for (const p of list) console.log(`  user_id=${p.user_id}  |  ${p.name || '(no name)'}  |  group=${p.group_name || '-'}`);
      console.log('\n→ Dùng user_id ở cột đầu làm --profile.\n');
      return;
    }

    if (cmd === 'usage') {
      if (!args.profile) return log.err('cần --profile <ID>');
      const u = safety.usage(args.profile);
      console.log(`\nHôm nay nick ${args.profile} đã dùng:`);
      console.log(`  react  : ${u.react}/${u.caps.react}`);
      console.log(`  comment: ${u.comment}/${u.caps.comment}`);
      console.log(`  inbox  : ${u.inbox}/${u.caps.inbox}\n`);
      return;
    }

    if (!['open', 'react', 'comment', 'inbox'].includes(cmd)) return log.err(`lệnh không hiểu: ${cmd} (chạy: node test.js help)`);
    if (!args.profile) return log.err('cần --profile <ID>  (lấy từ: node test.js list)');

    const task = {
      profileId: args.profile,
      action: cmd,
      target: args.url || args.uid || args.target,
      text: args.text,
      reaction: args.reaction,
      dryRun: !!args.dry,
    };
    if ((cmd === 'react' || cmd === 'comment') && !task.target) return log.err('cần --url <POST_URL>');
    if (cmd === 'inbox' && !task.target) return log.err('cần --uid <UID hoặc PROFILE_URL>');
    if ((cmd === 'comment' || cmd === 'inbox') && !task.text && !args.dry) return log.err('cần --text "nội dung"');

    console.log(`\n▶ ${cmd.toUpperCase()} bằng nick ${args.profile}${args.dry ? ' [DRY-RUN]' : ''}…`);
    const res = await executeAction(task, log);
    if (res.ok) log.ok(res.detail);
    else log.err((res.skipped ? '[bỏ qua] ' : '') + res.detail);
    console.log('');
  } catch (e) {
    log.err(e.message);
    process.exitCode = 1;
  }
})();
