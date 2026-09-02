/* =====================================================================
   Z15 Miracle · Lịch làm việc — data.js
   Dữ liệu mẫu (mock) được sinh có tính quyết định quanh ngày hiện tại,
   để demo luôn "sống" bất kể mở vào ngày nào.
   ===================================================================== */
(function (global) {
  'use strict';
  var Z15 = global.Z15 = global.Z15 || {};
  var U = Z15.utils;

  Z15.config = {
    appName: 'Z15 Miracle',
    appSub: 'Lịch làm việc',
    storageKey: 'z15.schedule.v1',
    workStart: 8,   // giờ bắt đầu hiển thị trong lịch
    workEnd: 20,    // giờ kết thúc hiển thị trong lịch
    hourHeight: 64, // px / giờ trong lịch tuần & ngày
    officeHours: '09:00 – 18:00'
  };

  /* ---------------------------------------------------------------- teams */
  var TEAMS = [
    { id: 'account', name: 'Account', short: 'ACC', color: '#3B6EA8', desc: 'Quản lý khách hàng & dự án' },
    { id: 'creative', name: 'Creative', short: 'CRE', color: '#7C5BD1', desc: 'Ý tưởng, concept & copy' },
    { id: 'design', name: 'Design', short: 'DES', color: '#0F9B8E', desc: 'Thiết kế, motion & 3D' },
    { id: 'media', name: 'Media', short: 'MED', color: '#C2782A', desc: 'Planning & performance' },
    { id: 'production', name: 'Production', short: 'PRO', color: '#B8497B', desc: 'Quay dựng & sản xuất' },
    { id: 'content', name: 'Content', short: 'CON', color: '#5E8C3A', desc: 'Content & social' },
    { id: 'ops', name: 'Vận hành', short: 'OPS', color: '#6B7280', desc: 'HR, admin & tài chính' },
    { id: 'exec', name: 'Ban điều hành', short: 'EXE', color: '#3F4A7A', desc: 'CEO & trợ lý điều hành' }
  ];

  /* ---------------------------------------------------------------- staff */
  // status: available | busy | remote | onsite | off
  var STAFF = [
    { id: 's01', name: 'Nguyễn Minh Anh', role: 'Account Director', teamId: 'account', location: 'HN', status: 'available', birthday: '03-14', joined: '2019-03-01', skills: ['Client service', 'Strategy', 'Pitching'], phone: '0901 234 501' },
    { id: 's02', name: 'Trần Quốc Bảo', role: 'Account Manager', teamId: 'account', location: 'HN', status: 'busy', birthday: '09-05', joined: '2021-06-14', skills: ['Project mgmt', 'Client service'], phone: '0901 234 502' },
    { id: 's03', name: 'Lê Thu Hà', role: 'Account Executive', teamId: 'account', location: 'HCM', status: 'remote', birthday: '11-22', joined: '2023-02-20', skills: ['Coordination', 'Reporting'], phone: '0901 234 503' },
    { id: 's21', name: 'Đinh Lan Hương', role: 'Strategic Planner', teamId: 'account', location: 'HN', status: 'available', birthday: '05-02', joined: '2020-09-07', skills: ['Research', 'Brand strategy'], phone: '0901 234 521' },
    { id: 's04', name: 'Phạm Hoàng Long', role: 'Creative Director', teamId: 'creative', location: 'HN', status: 'busy', birthday: '01-19', joined: '2018-08-01', skills: ['Concept', 'Art direction', 'Film'], phone: '0901 234 504' },
    { id: 's05', name: 'Đỗ Khánh Linh', role: 'Senior Copywriter', teamId: 'creative', location: 'HN', status: 'available', birthday: '09-09', joined: '2020-04-13', skills: ['Copywriting', 'Script', 'Naming'], phone: '0901 234 505' },
    { id: 's06', name: 'Vũ Đức Thịnh', role: 'Art Director', teamId: 'creative', location: 'HCM', status: 'onsite', birthday: '07-30', joined: '2021-11-08', skills: ['Art direction', 'KV', 'Storyboard'], phone: '0901 234 506' },
    { id: 's07', name: 'Hoàng Thị Mai', role: 'Senior Designer', teamId: 'design', location: 'HN', status: 'available', birthday: '12-01', joined: '2020-01-06', skills: ['Branding', 'Layout', 'Figma'], phone: '0901 234 507' },
    { id: 's08', name: 'Bùi Anh Tuấn', role: 'Motion Designer', teamId: 'design', location: 'HN', status: 'remote', birthday: '04-08', joined: '2022-03-21', skills: ['After Effects', 'C4D', 'Motion'], phone: '0901 234 508' },
    { id: 's09', name: 'Ngô Phương Thảo', role: 'UI/UX Designer', teamId: 'design', location: 'HCM', status: 'available', birthday: '08-25', joined: '2022-09-12', skills: ['UI', 'Prototype', 'Design system'], phone: '0901 234 509' },
    { id: 's22', name: 'Kiều Minh Đức', role: '3D Artist', teamId: 'design', location: 'HN', status: 'busy', birthday: '02-14', joined: '2023-07-03', skills: ['Blender', '3D', 'Rendering'], phone: '0901 234 522' },
    { id: 's10', name: 'Đặng Văn Hùng', role: 'Head of Media', teamId: 'media', location: 'HN', status: 'available', birthday: '06-17', joined: '2019-10-14', skills: ['Media planning', 'Budgeting', 'TikTok Ads'], phone: '0901 234 510' },
    { id: 's11', name: 'Trịnh Ngọc Diệp', role: 'Performance Executive', teamId: 'media', location: 'HN', status: 'busy', birthday: '10-03', joined: '2022-05-09', skills: ['Meta Ads', 'Google Ads', 'Analytics'], phone: '0901 234 511' },
    { id: 's12', name: 'Lý Gia Huy', role: 'Media Planner', teamId: 'media', location: 'HCM', status: 'remote', birthday: '03-28', joined: '2021-02-01', skills: ['Planning', 'OOH', 'Negotiation'], phone: '0901 234 512' },
    { id: 's13', name: 'Phan Thanh Sơn', role: 'Producer', teamId: 'production', location: 'HN', status: 'onsite', birthday: '09-12', joined: '2019-05-20', skills: ['Producing', 'Budget', 'Casting'], phone: '0901 234 513' },
    { id: 's14', name: 'Võ Hải Đăng', role: 'DOP / Cameraman', teamId: 'production', location: 'HN', status: 'onsite', birthday: '11-11', joined: '2020-07-27', skills: ['Cinematography', 'Lighting', 'Drone'], phone: '0901 234 514' },
    { id: 's15', name: 'Dương Bảo Ngọc', role: 'Video Editor', teamId: 'production', location: 'HN', status: 'busy', birthday: '01-05', joined: '2022-01-10', skills: ['Premiere', 'DaVinci', 'Color'], phone: '0901 234 515' },
    { id: 's16', name: 'Tạ Quang Minh', role: 'Content Lead', teamId: 'content', location: 'HN', status: 'available', birthday: '08-19', joined: '2020-11-02', skills: ['Content strategy', 'SEO', 'Editorial'], phone: '0901 234 516' },
    { id: 's17', name: 'Cao Thùy Dương', role: 'Content Creator', teamId: 'content', location: 'HCM', status: 'available', birthday: '09-03', joined: '2023-04-17', skills: ['Short video', 'Hosting', 'TikTok'], phone: '0901 234 517' },
    { id: 's18', name: 'Mai Tuấn Kiệt', role: 'Social Media Executive', teamId: 'content', location: 'HN', status: 'off', birthday: '12-24', joined: '2023-10-09', skills: ['Community', 'Social listening'], phone: '0901 234 518' },
    { id: 's19', name: 'Lương Kim Chi', role: 'HR & Admin', teamId: 'ops', location: 'HN', status: 'available', birthday: '02-28', joined: '2019-01-14', skills: ['HR', 'Admin', 'Culture'], phone: '0901 234 519' },
    { id: 's20', name: 'Hồ Nhật Nam', role: 'Finance & Ops', teamId: 'ops', location: 'HN', status: 'available', birthday: '07-07', joined: '2020-03-02', skills: ['Finance', 'Contracts'], phone: '0901 234 520' },
    { id: 's23', name: 'Trần Hoàng Việt', role: 'CEO · Giám đốc điều hành', teamId: 'exec', location: 'HN', status: 'busy', birthday: '10-20', joined: '2016-01-04', skills: ['Leadership', 'Client relations', 'Strategy'], phone: '0901 234 523' },
    { id: 's24', name: 'Lê Ngọc Ánh', role: 'Trợ lý Giám đốc (EA)', teamId: 'exec', location: 'HN', status: 'available', birthday: '04-12', joined: '2021-08-16', skills: ['Calendar', 'Coordination', 'Travel'], phone: '0901 234 524' }
  ];
  STAFF.forEach(function (s) {
    s.email = U.normalizeVN(U.shortName(s.name)).replace(/\s+/g, '.') + '@z15miracle.vn';
    s.capacity = 40;
  });

  var CURRENT_USER_ID = 's01';

  /* ---------------------------------------------------------- shift types */
  var SHIFT_TYPES = [
    { id: 'full', label: 'Hành chính', short: 'F', hours: '09:00 – 18:00', minutes: 480, cssVar: '--shift-full' },
    { id: 'morning', label: 'Ca sáng', short: 'S', hours: '08:30 – 12:30', minutes: 240, cssVar: '--shift-morning' },
    { id: 'afternoon', label: 'Ca chiều', short: 'C', hours: '13:30 – 18:00', minutes: 270, cssVar: '--shift-afternoon' },
    { id: 'remote', label: 'Remote', short: 'WFH', hours: '09:00 – 18:00', minutes: 480, cssVar: '--shift-remote' },
    { id: 'onsite', label: 'Quay / On-site', short: 'Q', hours: 'Theo lịch quay', minutes: 540, cssVar: '--shift-onsite' },
    { id: 'ot', label: 'Tăng ca', short: 'OT', hours: '09:00 – 21:00', minutes: 600, cssVar: '--shift-ot' },
    { id: 'leave', label: 'Nghỉ phép', short: 'N', hours: '—', minutes: 0, cssVar: '--shift-leave' },
    { id: 'off', label: 'Không xếp ca', short: '—', hours: '—', minutes: 0, cssVar: '--shift-off' }
  ];

  /* ---------------------------------------------------------- event types */
  var EVENT_TYPES = [
    { id: 'meeting', label: 'Họp', icon: 'users', cssVar: '--ev-meeting' },
    { id: 'shoot', label: 'Quay / Chụp', icon: 'video', cssVar: '--ev-shoot' },
    { id: 'deadline', label: 'Deadline', icon: 'flag', cssVar: '--ev-deadline' },
    { id: 'pitch', label: 'Pitch', icon: 'presentation', cssVar: '--ev-pitch' },
    { id: 'review', label: 'Review', icon: 'eye', cssVar: '--ev-review' },
    { id: 'task', label: 'Công việc', icon: 'check', cssVar: '--ev-task' },
    { id: 'training', label: 'Đào tạo', icon: 'book', cssVar: '--ev-training' },
    { id: 'event', label: 'Sự kiện', icon: 'sparkles', cssVar: '--ev-event' },
    { id: 'focus', label: 'Tập trung', icon: 'target', cssVar: '--ev-focus' },
    { id: 'travel', label: 'Di chuyển', icon: 'map-pin', cssVar: '--ev-travel' }
  ];

  /* --------------------------------------------------- ưu tiên & phản hồi */
  var PRIORITIES = [
    { id: 1, label: 'Bắt buộc', short: 'P1', desc: 'Không thể vắng, cần chuẩn bị' },
    { id: 2, label: 'Quan trọng', short: 'P2', desc: 'Nên tham dự' },
    { id: 3, label: 'Có thể uỷ quyền', short: 'P3', desc: 'Tuỳ chọn, người khác có thể thay' }
  ];
  var RSVP = [
    { id: 'yes', label: 'Tham dự' }, { id: 'maybe', label: 'Có thể' }, { id: 'no', label: 'Vắng' }, { id: 'pending', label: 'Chưa phản hồi' }
  ];

  /* ------------------------------------------------------------- holidays */
  var HOLIDAYS = [
    { md: '01-01', name: 'Tết Dương lịch' },
    { md: '04-30', name: 'Giải phóng miền Nam' },
    { md: '05-01', name: 'Quốc tế Lao động' },
    { md: '09-02', name: 'Quốc khánh' },
    { date: '2026-09-01', name: 'Quốc khánh (nghỉ bù)' }, { date: '2027-09-03', name: 'Quốc khánh (nghỉ bù)' },
    { date: '2026-04-27', name: 'Giỗ Tổ Hùng Vương (nghỉ bù)' },
    { date: '2026-02-16', name: 'Tết Nguyên Đán' }, { date: '2026-02-17', name: 'Tết Nguyên Đán' }, { date: '2026-02-18', name: 'Tết Nguyên Đán' }, { date: '2026-02-19', name: 'Tết Nguyên Đán' }, { date: '2026-02-20', name: 'Tết Nguyên Đán' },
    { date: '2026-04-26', name: 'Giỗ Tổ Hùng Vương' },
    { date: '2027-02-05', name: 'Tết Nguyên Đán' }, { date: '2027-02-06', name: 'Tết Nguyên Đán' }, { date: '2027-02-08', name: 'Tết Nguyên Đán' }, { date: '2027-02-09', name: 'Tết Nguyên Đán' }, { date: '2027-02-10', name: 'Tết Nguyên Đán' },
    { date: '2027-04-16', name: 'Giỗ Tổ Hùng Vương' }
  ];
  function holidayName(iso) {
    var md = iso.slice(5);
    for (var i = 0; i < HOLIDAYS.length; i++) {
      var h = HOLIDAYS[i];
      if ((h.date && h.date === iso) || (h.md && h.md === md)) return h.name;
    }
    return null;
  }

  /* ------------------------------------------------------------ projects */
  function buildProjects(today) {
    var d = function (n) { return U.toISO(U.addDays(today, n)); };
    return [
      { id: 'p01', name: 'Tết Đoàn Viên 2027', client: 'Vinamilk', color: '#4A3FB8', status: 'active', progress: 62, start: d(-24), end: d(38), leadId: 's01', memberIds: ['s01', 's02', 's04', 's05', 's07', 's13', 's14', 's15', 's10'], tags: ['TVC', 'Digital', 'OOH'], budget: '4.8 tỷ' },
      { id: 'p02', name: '9.9 Siêu Sale', client: 'Shopee', color: '#D97706', status: 'active', progress: 86, start: d(-30), end: d(6), leadId: 's02', memberIds: ['s02', 's03', 's08', 's10', 's11', 's16', 's17', 's18'], tags: ['Performance', 'Social', 'KOL'], budget: '2.1 tỷ' },
      { id: 'p03', name: 'VF 3 — Launch Film', client: 'VinFast', color: '#0EA5E9', status: 'active', progress: 41, start: d(-12), end: d(30), leadId: 's04', memberIds: ['s04', 's06', 's13', 's14', 's15', 's22', 's01'], tags: ['Film', '3D', 'Launch'], budget: '6.5 tỷ' },
      { id: 'p04', name: 'Thu Về — Seasonal', client: 'Highlands Coffee', color: '#B45309', status: 'review', progress: 92, start: d(-40), end: d(3), leadId: 's03', memberIds: ['s03', 's05', 's07', 's09', 's17'], tags: ['KV', 'Social', 'In-store'], budget: '850 triệu' },
      { id: 'p05', name: 'Visa Debit Gen Z', client: 'Techcombank', color: '#0F766E', status: 'planning', progress: 18, start: d(-3), end: d(52), leadId: 's21', memberIds: ['s21', 's01', 's04', 's09', 's12', 's16'], tags: ['Strategy', 'Digital', 'Fintech'], budget: '3.2 tỷ' },
      { id: 'p06', name: 'Hunter Street Series', client: "Biti's", color: '#7C3AED', status: 'active', progress: 55, start: d(-18), end: d(21), leadId: 's06', memberIds: ['s06', 's08', 's14', 's15', 's17', 's18', 's02'], tags: ['Short video', 'TikTok', 'Street'], budget: '1.4 tỷ' },
      { id: 'p07', name: 'Lì Xì Tết — Mini game', client: 'MoMo', color: '#A21CAF', status: 'planning', progress: 9, start: d(10), end: d(75), leadId: 's16', memberIds: ['s16', 's09', 's11', 's22', 's03'], tags: ['Gamification', 'App', 'Tết'], budget: '1.9 tỷ' },
      { id: 'p08', name: 'Đối tác Tài xế 2026', client: 'Grab', color: '#059669', status: 'done', progress: 100, start: d(-70), end: d(-6), leadId: 's02', memberIds: ['s02', 's05', 's07', 's11', 's16'], tags: ['Recruitment', 'OOH', 'Radio'], budget: '1.1 tỷ' }
    ];
  }

  /* -------------------------------------------------------------- events */
  function buildEvents(today, projects, rng) {
    var events = [];
    var byTeam = U.groupBy(STAFF, 'teamId');
    var teamIds = function (t) { return (byTeam[t] || []).map(function (s) { return s.id; }); };
    var d = function (n) { return U.toISO(U.addDays(today, n)); };
    var push = function (e) { e.id = e.id || ('e' + (events.length + 1).toString().padStart(3, '0')); events.push(e); return e; };
    var P = U.by(projects);

    for (var off = -28; off <= 42; off++) {
      var date = U.addDays(today, off), iso = U.toISO(date), wd = U.weekdayIndex(date);
      var weekend = wd >= 5, holiday = !!holidayName(iso);
      if (holiday) continue;

      if (!weekend) {
        // Nhịp cố định của công ty
        if (wd === 0) push({ title: 'Stand-up toàn công ty', type: 'meeting', date: iso, start: '09:00', end: '09:20', location: 'Sảnh tầng 3', attendeeIds: STAFF.map(function (s) { return s.id; }), ownerId: 's19', notes: 'Cập nhật ưu tiên tuần & tin vui của các team.' });
        if (wd === 4) push({ title: 'Happy Friday 🍻', type: 'event', date: iso, start: '17:30', end: '19:00', location: 'Pantry', attendeeIds: STAFF.map(function (s) { return s.id; }), ownerId: 's19' });
        if (wd === 1 || wd === 3) push({ title: 'Daily sync Account', type: 'meeting', date: iso, start: '09:30', end: '09:50', location: 'Phòng Sài Gòn', attendeeIds: teamIds('account'), ownerId: 's01' });
        if (wd === 2) push({ title: 'Creative review nội bộ', type: 'review', date: iso, start: '14:00', end: '15:30', location: 'Phòng Hà Nội', attendeeIds: teamIds('creative').concat(teamIds('design')), ownerId: 's04' });
        if (wd === 1) push({ title: 'Media weekly — số liệu & tối ưu', type: 'meeting', date: iso, start: '10:00', end: '11:00', location: 'Online · Google Meet', attendeeIds: teamIds('media').concat(['s02']), ownerId: 's10' });

        // Các sự kiện gắn với dự án đang chạy
        projects.forEach(function (p) {
          if (p.status === 'done' && iso > p.end) return;
          if (iso < p.start || iso > p.end) return;
          if (rng.chance(0.28)) {
            var kinds = ['meeting', 'task', 'review', 'task'];
            var kind = rng.pick(kinds), startH = rng.pick([9, 10, 11, 13, 14, 15, 16]);
            var dur = kind === 'meeting' ? rng.pick([30, 45, 60]) : kind === 'review' ? 60 : rng.pick([90, 120, 180]);
            var titles = {
              meeting: ['Họp brief', 'Weekly sync', 'Họp tiến độ', 'Align với khách'],
              task: ['Viết script', 'Dựng bản nháp', 'Tối ưu quảng cáo', 'Hoàn thiện KV', 'Làm storyboard', 'Lên media plan'],
              review: ['Internal review', 'Client feedback round 2', 'Review concept']
            };
            var members = rng.shuffle(p.memberIds).slice(0, rng.int(2, Math.min(5, p.memberIds.length)));
            push({ title: rng.pick(titles[kind]) + ' · ' + p.client, type: kind, projectId: p.id, date: iso, start: U.minToTime(startH * 60), end: U.minToTime(startH * 60 + dur), location: kind === 'task' ? '' : rng.pick(['Phòng Sài Gòn', 'Phòng Hà Nội', 'Online · Google Meet', 'Văn phòng khách hàng']), attendeeIds: members, ownerId: members[0] });
          }
        });
      }
    }

    // Mốc quan trọng (đặt tay để câu chuyện demo mạch lạc)
    push({ title: 'Quay TVC Tết — Ngày 1', type: 'shoot', projectId: 'p01', date: d(2), start: '06:00', end: '19:00', location: 'Studio Cổ Loa, Đông Anh', attendeeIds: ['s04', 's13', 's14', 's15', 's06', 's01'], ownerId: 's13', notes: 'Call time 05:30 tại văn phòng. Xe đưa đón 2 chuyến.' });
    push({ title: 'Quay TVC Tết — Ngày 2', type: 'shoot', projectId: 'p01', date: d(3), start: '06:00', end: '19:00', location: 'Studio Cổ Loa, Đông Anh', attendeeIds: ['s04', 's13', 's14', 's15', 's06'], ownerId: 's13' });
    push({ title: 'Chụp KV Hunter — Phố cổ', type: 'shoot', projectId: 'p06', date: d(6), start: '05:30', end: '11:00', location: 'Phố Hàng Mã & cầu Long Biên', attendeeIds: ['s06', 's14', 's17', 's08'], ownerId: 's06' });
    push({ title: 'Deadline final cut 9.9', type: 'deadline', projectId: 'p02', date: d(4), start: '18:00', end: '18:00', attendeeIds: ['s02', 's08', 's15'], ownerId: 's02' });
    push({ title: 'Go-live chiến dịch 9.9', type: 'deadline', projectId: 'p02', date: d(6), start: '00:00', end: '00:00', allDay: true, attendeeIds: ['s02', 's10', 's11', 's18'], ownerId: 's10' });
    push({ title: 'Nộp KV cuối — Thu Về', type: 'deadline', projectId: 'p04', date: d(1), start: '17:00', end: '17:00', attendeeIds: ['s03', 's07'], ownerId: 's03' });
    push({ title: 'Pitch Techcombank — vòng 2', type: 'pitch', projectId: 'p05', date: d(8), start: '14:00', end: '16:00', location: 'Techcombank Tower, 6 Quang Trung', attendeeIds: ['s01', 's21', 's04', 's09', 's12', 's23', 's24'], ownerId: 's01', priority: 1, notes: 'In 6 bộ deck. Demo prototype trên iPad.', prep: [{ text: 'In 6 bộ deck', ownerId: 's21', done: true }, { text: 'Demo prototype trên iPad', ownerId: 's09', done: false }, { text: 'Xác nhận phòng họp & chỗ đỗ xe với khách', ownerId: 's24', done: false }], rsvp: { s12: 'pending' } });
    push({ title: 'Rehearsal pitch Techcombank', type: 'pitch', projectId: 'p05', date: d(7), start: '15:00', end: '17:00', location: 'Phòng Hà Nội', attendeeIds: ['s01', 's21', 's04', 's09', 's23'], ownerId: 's21', priority: 1 });
    push({ title: 'Kick-off VF 3 với khách', type: 'meeting', projectId: 'p03', date: d(-11), start: '10:00', end: '11:30', location: 'VinFast HQ, Long Biên', attendeeIds: ['s04', 's13', 's01'], ownerId: 's04' });
    push({ title: 'Duyệt storyboard VF 3', type: 'review', projectId: 'p03', date: d(5), start: '10:00', end: '11:30', location: 'Online · Google Meet', attendeeIds: ['s04', 's06', 's22', 's01'], ownerId: 's04' });
    push({ title: 'Workshop: AI trong quy trình sáng tạo', type: 'training', date: d(9), start: '14:00', end: '17:00', location: 'Sảnh tầng 3', attendeeIds: teamIds('creative').concat(teamIds('design'), teamIds('content')), ownerId: 's19', notes: 'Diễn giả khách mời. Mang laptop.' });
    push({ title: 'Đào tạo Meta Advantage+ mới', type: 'training', date: d(12), start: '09:30', end: '11:30', location: 'Online · Zoom', attendeeIds: teamIds('media'), ownerId: 's10' });
    push({ title: 'Town hall quý III', type: 'event', date: d(15), start: '16:00', end: '18:00', location: 'Sảnh tầng 3', attendeeIds: STAFF.map(function (s) { return s.id; }), ownerId: 's19', priority: 2, prep: [{ text: 'Slide kết quả quý III cho CEO', ownerId: 's24', done: false }, { text: 'Âm thanh & màn hình sảnh', ownerId: 's19', done: false }] });
    push({ title: 'Team building Ba Vì', type: 'event', date: d(26), start: '07:00', end: '20:00', allDay: true, location: 'Ba Vì, Hà Nội', attendeeIds: STAFF.map(function (s) { return s.id; }), ownerId: 's19' });
    push({ title: 'Wrap-up & báo cáo Grab', type: 'meeting', projectId: 'p08', date: d(-6), start: '15:00', end: '16:00', location: 'Phòng Sài Gòn', attendeeIds: ['s02', 's05', 's11'], ownerId: 's02' });
    push({ title: 'Tổng duyệt TVC Tết (offline)', type: 'review', projectId: 'p01', date: d(20), start: '14:00', end: '16:00', location: 'Phòng Hà Nội', attendeeIds: ['s01', 's04', 's13', 's15', 's02'], ownerId: 's04' });
    push({ title: 'Deadline proposal MoMo', type: 'deadline', projectId: 'p07', date: d(18), start: '12:00', end: '12:00', attendeeIds: ['s16', 's09', 's03'], ownerId: 's16' });

    // Sinh nhật trong cửa sổ hiển thị
    STAFF.forEach(function (s) {
      for (var y = today.getFullYear() - 1; y <= today.getFullYear() + 1; y++) {
        var iso = y + '-' + s.birthday;
        var off = U.daysBetween(today, iso);
        if (off >= -28 && off <= 42) push({ title: 'Sinh nhật ' + U.shortName(s.name) + ' 🎂', type: 'event', date: iso, start: '16:30', end: '17:00', allDay: false, location: 'Pantry', attendeeIds: teamIds(s.teamId), ownerId: 's19', birthdayOf: s.id });
      }
    });


    /* ------------------------------------------------ lịch của CEO & trợ lý */
    // Lịch dày, có chủ đích chứa vài "lỗi" để trợ lý xử lý: trùng lịch, họp sát nhau, thiếu giờ di chuyển, thiếu chuẩn bị.
    var HEADS = ['s01', 's04', 's10', 's13', 's16', 's19', 's20'];
    var pushExec = function (e) { e.exec = true; e.attendeeIds = U.uniq(['s23'].concat(e.attendeeIds || [])); if (!e.ownerId) e.ownerId = 's24'; return push(e); };
    var pushExecRec = function (e) { e.recurring = true; return pushExec(e); };
    var weekIdx = 0;
    for (var eo = -21; eo <= 28; eo++) {
      var ed = U.addDays(today, eo), eiso = U.toISO(ed), ewd = U.weekdayIndex(ed);
      if (ewd >= 5 || holidayName(eiso)) continue;
      if (ewd === 0) weekIdx++;
      pushExecRec({ title: 'Điểm tin & ưu tiên ngày', type: 'meeting', date: eiso, start: '08:15', end: '08:30', location: 'Phòng CEO', attendeeIds: ['s24'], ownerId: 's24', priority: 2, notes: 'Trợ lý điểm lại lịch, rủi ro trong ngày và việc cần quyết.' });
      if (ewd === 0) pushExecRec({ title: 'Họp Ban điều hành', type: 'meeting', date: eiso, start: '10:00', end: '11:30', location: 'Phòng Hà Nội', attendeeIds: HEADS.concat(['s24']), ownerId: 's23', priority: 1, notes: 'Agenda: số liệu tuần · pipeline · nhân sự · rủi ro dự án.' });
      if (ewd === 1) pushExecRec({ title: '1:1 với ' + U.shortName(U.by(STAFF)[HEADS[weekIdx % 5]].name), type: 'meeting', date: eiso, start: '09:30', end: '10:15', location: 'Phòng CEO', attendeeIds: [HEADS[weekIdx % 5]], ownerId: 's23', priority: 2 });
      if (ewd === 2) pushExecRec({ title: 'Tập trung: Chiến lược 2027 & kế hoạch nhân sự', type: 'focus', date: eiso, start: '14:00', end: '16:00', location: 'Phòng CEO', attendeeIds: [], ownerId: 's23', priority: 1, notes: 'Không xếp họp. Trợ lý chỉ ngắt khi khẩn.' });
      if (ewd === 3) pushExecRec({ title: 'Review pipeline khách hàng', type: 'review', date: eiso, start: '15:00', end: '16:00', location: 'Phòng Sài Gòn', attendeeIds: ['s01', 's02', 's21'], ownerId: 's01', priority: 2 });
      if (ewd === 4) pushExecRec({ title: 'Review tuần & duyệt lịch tuần sau', type: 'meeting', date: eiso, start: '15:30', end: '16:15', location: 'Phòng CEO', attendeeIds: ['s24'], ownerId: 's24', priority: 1 });
    }
    // Thứ Năm dày đặc (D+1): trùng lịch + chuỗi họp sát nhau + họp ngoài không có giờ di chuyển
    pushExec({ title: 'Họp Techcombank — chốt phạm vi hợp tác', type: 'meeting', projectId: 'p05', date: d(1), start: '10:00', end: '11:00', location: 'Techcombank Tower, 6 Quang Trung', attendeeIds: ['s01', 's21'], ownerId: 's01', priority: 1, travelMinutes: 30, prep: [{ text: 'Đọc lại brief & KPI khách hàng', ownerId: 's23', done: true }, { text: 'Chuẩn bị 3 phương án ngân sách', ownerId: 's21', done: false }], rsvp: { s21: 'pending' } });
    pushExec({ title: 'Phỏng vấn ứng viên Creative Director (HCM)', type: 'meeting', date: d(1), start: '10:30', end: '11:30', location: 'Online · Google Meet', attendeeIds: ['s19'], ownerId: 's19', priority: 2 });
    pushExec({ title: 'Ăn trưa với CMO Vinamilk', type: 'meeting', projectId: 'p01', date: d(1), start: '12:00', end: '13:30', location: 'Sofitel Legend Metropole', attendeeIds: ['s01'], ownerId: 's24', priority: 1, travelMinutes: 30, notes: 'Chủ đề: hướng sáng tạo Tết & ngân sách quý IV.' });
    pushExec({ title: 'Duyệt KV Thu Về — vòng cuối', type: 'review', projectId: 'p04', date: d(1), start: '14:00', end: '14:45', location: 'Phòng Hà Nội', attendeeIds: ['s03', 's07'], ownerId: 's03', priority: 3, rsvp: { s07: 'pending' } });
    pushExec({ title: 'Họp ngân hàng — hạn mức tín dụng', type: 'meeting', date: d(1), start: '14:45', end: '15:30', location: 'Phòng Sài Gòn', attendeeIds: ['s20'], ownerId: 's20', priority: 2 });
    pushExec({ title: 'Call nhà đầu tư quý III', type: 'meeting', date: d(1), start: '15:30', end: '16:30', location: 'Online · Zoom', attendeeIds: ['s20', 's24'], ownerId: 's24', priority: 1, prep: [{ text: 'Cập nhật số liệu doanh thu Q3', ownerId: 's20', done: false }, { text: 'Gửi trước deck cho nhà đầu tư', ownerId: 's24', done: false }], rsvp: { s20: 'pending' } });
    pushExec({ title: 'Ký hợp đồng MoMo — Lì Xì Tết', type: 'meeting', projectId: 'p07', date: d(1), start: '16:30', end: '17:00', location: 'Phòng Hà Nội', attendeeIds: ['s16', 's20'], ownerId: 's16', priority: 1 });
    pushExec({ title: 'Đón con', type: 'event', date: d(5), start: '17:30', end: '18:15', location: '', attendeeIds: [], ownerId: 's23', priority: 1, visibility: 'private', calendarId: 'personal:s23' });
    // Thứ Sáu (D+2): thăm set quay ở Đông Anh rồi về nội thành ăn trưa
    pushExec({ title: 'Thăm set quay TVC Tết', type: 'shoot', projectId: 'p01', date: d(2), start: '10:00', end: '11:30', location: 'Studio Cổ Loa, Đông Anh', attendeeIds: ['s13', 's04'], ownerId: 's13', priority: 2, travelMinutes: 45 });
    pushExec({ title: "Ăn trưa đối tác Biti's", type: 'meeting', projectId: 'p06', date: d(2), start: '12:15', end: '13:30', location: 'Nhà hàng Ngon Garden, Tây Hồ', attendeeIds: ['s06', 's02'], ownerId: 's24', priority: 2, travelMinutes: 45 });
    pushExec({ title: 'Phỏng vấn Account Manager', type: 'meeting', date: d(2), start: '14:00', end: '14:45', location: 'Phòng Sài Gòn', attendeeIds: ['s19', 's01'], ownerId: 's19', priority: 3 });
    // Tuần sau
    pushExec({ title: 'Cà phê với founder agency đối tác', type: 'meeting', date: d(5), start: '13:30', end: '14:30', location: 'The Coffee House, Lý Thường Kiệt', attendeeIds: [], ownerId: 's23', priority: 3, travelMinutes: 20 });
    pushExec({ title: 'Duyệt kế hoạch media Q4', type: 'review', date: d(5), start: '16:00', end: '17:00', location: 'Phòng Hà Nội', attendeeIds: ['s10', 's12'], ownerId: 's10', priority: 2, rsvp: { s12: 'pending' } });
    pushExec({ title: 'Workshop tầm nhìn 2027 với Ban điều hành', type: 'training', date: d(6), start: '09:00', end: '12:00', location: 'Sảnh tầng 3', attendeeIds: HEADS.concat(['s24']), ownerId: 's23', priority: 1, prep: [{ text: 'Chốt khung thảo luận 3 phần', ownerId: 's23', done: true }, { text: 'Đặt tiệc trà & in tài liệu', ownerId: 's24', done: false }] });
    pushExec({ title: 'Gặp luật sư — hợp đồng lao động mẫu', type: 'meeting', date: d(6), start: '14:00', end: '15:00', location: 'Văn phòng luật ABC, Hoàn Kiếm', attendeeIds: ['s19'], ownerId: 's24', priority: 2, travelMinutes: 30 });
    pushExec({ title: 'Họp brief Techcombank nội bộ', type: 'meeting', projectId: 'p05', date: d(6), start: '15:00', end: '16:00', location: 'Phòng Hà Nội', attendeeIds: ['s21', 's01', 's04'], ownerId: 's21', priority: 2 });
    pushExec({ title: 'Phỏng vấn Head of Content', type: 'meeting', date: d(7), start: '10:00', end: '11:00', location: 'Online · Google Meet', attendeeIds: ['s19', 's16'], ownerId: 's19', priority: 2 });
    pushExec({ title: 'Lớp tiếng Anh', type: 'event', date: d(7), start: '19:00', end: '20:30', location: '', attendeeIds: [], ownerId: 's23', priority: 2, visibility: 'private', calendarId: 'personal:s23' });
    pushExec({ title: 'Công tác TP.HCM', type: 'travel', date: d(12), start: '00:00', end: '00:00', allDay: true, location: 'TP. Hồ Chí Minh', attendeeIds: ['s24'], ownerId: 's24', priority: 1 });
    pushExec({ title: 'Bay HAN → SGN · VN213', type: 'travel', date: d(12), start: '07:00', end: '09:15', location: 'Sân bay Nội Bài', attendeeIds: [], ownerId: 's24', priority: 1 });
    pushExec({ title: 'Gặp Grab — kế hoạch đối tác 2027', type: 'meeting', projectId: 'p08', date: d(12), start: '10:30', end: '12:00', location: 'Grab HQ, Quận 7', attendeeIds: ['s02'], ownerId: 's24', priority: 1, travelMinutes: 40, prep: [{ text: 'Tổng kết chiến dịch 2026 (1 trang)', ownerId: 's02', done: false }] });
    pushExec({ title: 'Thăm văn phòng HCM & ăn trưa với team', type: 'event', date: d(12), start: '14:00', end: '15:30', location: 'Văn phòng HCM, Quận 1', attendeeIds: ['s03', 's06', 's09', 's12', 's17'], ownerId: 's24', priority: 2 });
    pushExec({ title: 'Pitch mini — Shopee Q4 retention', type: 'pitch', projectId: 'p02', date: d(13), start: '09:00', end: '10:30', location: 'Shopee Tower, Quận 1', attendeeIds: ['s02', 's10'], ownerId: 's02', priority: 1, travelMinutes: 30 });
    pushExec({ title: 'Bay SGN → HAN · VN250', type: 'travel', date: d(13), start: '16:00', end: '18:15', location: 'Sân bay Tân Sơn Nhất', attendeeIds: [], ownerId: 's24', priority: 1 });
    pushExec({ title: 'Khám sức khoẻ định kỳ', type: 'event', date: d(14), start: '08:30', end: '10:30', location: '', attendeeIds: [], ownerId: 's23', priority: 1, visibility: 'private', calendarId: 'personal:s23' });
    pushExec({ title: 'Họp Hội đồng quản trị', type: 'meeting', date: d(16), start: '10:00', end: '12:00', location: 'Phòng Hà Nội', attendeeIds: ['s20', 's24'], ownerId: 's24', priority: 1, prep: [{ text: 'Báo cáo tài chính 9 tháng', ownerId: 's20', done: false }, { text: 'Đề xuất ngân sách 2027', ownerId: 's23', done: false }] });
    pushExec({ title: 'Gặp khách hàng Highlands — hợp đồng năm', type: 'meeting', projectId: 'p04', date: d(-3), start: '10:00', end: '11:30', location: 'Highlands Coffee HQ', attendeeIds: ['s03', 's01'], ownerId: 's01', priority: 1, travelMinutes: 30 });
    pushExec({ title: 'Ăn tối đối tác truyền thông', type: 'meeting', date: d(-7), start: '18:30', end: '20:30', location: 'Nhà hàng Sen Tây Hồ', attendeeIds: ['s10'], ownerId: 's24', priority: 2, travelMinutes: 30 });
    pushExec({ title: 'Họp nhà đầu tư — kết quả Q2', type: 'meeting', date: d(-10), start: '09:00', end: '10:30', location: 'Online · Zoom', attendeeIds: ['s20', 's24'], ownerId: 's24', priority: 1 });

    // Lịch lặp của CEO nhường chỗ cho lịch cố định cùng ngày (trừ khối tập trung, để còn ví dụ 'họp đè khối tập trung')
    var fixedExec = events.filter(function (e) { return e.exec && !e.recurring; });
    events = events.filter(function (e) {
      if (!e.recurring || e.type === 'focus') return true;
      var s = U.timeToMin(e.start), en = U.timeToMin(e.end);
      return !fixedExec.some(function (f) { return f.date === e.date && !f.allDay && U.timeToMin(f.start) < en && U.timeToMin(f.end) > s; });
    });
    events.forEach(function (e) { delete e.recurring; });
    /* ------------------------------------------------ làm giàu mọi sự kiện */
    var byId = U.by(STAFF);
    var isExternal = function (loc) { return !!loc && !/phòng|sảnh|pantry|online|zoom|meet|văn phòng|văn phòng hcm/i.test(loc); };
    var farAway = function (loc) { return /đông anh|cổ loa|long biên|ba vì|sân bay/i.test(loc || ''); };
    events.forEach(function (e) {
      e.attendeeIds = U.uniq(e.attendeeIds || []);
      if (!e.ownerId) e.ownerId = e.attendeeIds[0] || 's19';
      if (e.attendeeIds.indexOf(e.ownerId) < 0 && e.type !== 'focus') e.attendeeIds.unshift(e.ownerId);
      if (!e.calendarId) {
        if (e.projectId) e.calendarId = 'project:' + e.projectId;
        else if (e.exec) e.calendarId = 'exec';
        else if (e.attendeeIds.length >= STAFF.length - 2) e.calendarId = 'company';
        else {
          var teams = U.uniq(e.attendeeIds.map(function (id) { return byId[id] ? byId[id].teamId : null; }).filter(Boolean));
          e.calendarId = teams.length === 1 ? 'team:' + teams[0] : 'company';
        }
      }
      delete e.exec;
      if (e.priority == null) e.priority = (e.type === 'pitch' || e.type === 'deadline' || e.type === 'shoot') ? 1 : (e.type === 'task' || e.type === 'event') ? 3 : 2;
      if (!e.visibility) e.visibility = 'public';
      if (!e.reminders) e.reminders = e.priority === 1 ? [1440, 60, 15] : e.priority === 2 ? [60, 15] : [15];
      if (e.travelMinutes == null && isExternal(e.location)) e.travelMinutes = farAway(e.location) ? 45 : 30;
      var roles = e.roles || {}; roles[e.ownerId] = 'organizer';
      e.attendeeIds.forEach(function (id) { if (!roles[id]) roles[id] = (e.calendarId === 'company' && id !== e.ownerId) ? 'optional' : 'required'; });
      e.roles = roles;
      var rsvp = e.rsvp || {}; var past = e.date < U.toISO(today);
      e.attendeeIds.forEach(function (id) { if (rsvp[id]) return; rsvp[id] = (past || id === e.ownerId) ? 'yes' : (rng.chance(0.8) ? 'yes' : rng.chance(0.4) ? 'maybe' : 'pending'); });
      e.rsvp = rsvp;
      e.prep = (e.prep || []).map(function (p, i) { return Object.assign({ id: e.id + '_p' + i, done: false, ownerId: e.ownerId }, p); });
      if (!e.prep.length && e.priority === 1 && (e.type === 'pitch' || e.type === 'shoot') && !past) {
        e.prep = e.type === 'pitch' ? [{ id: e.id + '_p0', text: 'Chốt deck & người trình bày', ownerId: e.ownerId, done: rng.chance(0.5) }, { id: e.id + '_p1', text: 'Xác nhận phòng họp với khách', ownerId: 's24', done: false }]
          : [{ id: e.id + '_p0', text: 'Chốt call sheet & xe đưa đón', ownerId: e.ownerId, done: true }, { id: e.id + '_p1', text: 'Kiểm tra thiết bị & giấy phép quay', ownerId: 's14', done: rng.chance(0.5) }];
      }
      e.nudges = e.nudges || [];
    });
    return U.sortBy(events, function (e) { return e.date + ' ' + e.start; });
  }


  /* -------------------------------------------------------------- shifts */
  function buildShifts(today, events, rng) {
    var shifts = {};
    var shootDays = {};
    events.forEach(function (e) { if (e.type === 'shoot') e.attendeeIds.forEach(function (id) { shootDays[id + '|' + e.date] = true; }); });
    var remotePref = {}; // ngày remote ưa thích của từng người
    STAFF.forEach(function (s) { remotePref[s.id] = rng.chance(0.55) ? rng.int(0, 4) : -1; });
    var leaveBlocks = [ // nghỉ phép đã duyệt
      { id: 's03', from: 1, to: 2 }, { id: 's08', from: 8, to: 12 }, { id: 's12', from: -9, to: -8 }, { id: 's20', from: 16, to: 17 }, { id: 's17', from: 22, to: 22 }
    ];
    var inLeave = function (id, off) { return leaveBlocks.some(function (b) { return b.id === id && off >= b.from && off <= b.to; }); };

    STAFF.forEach(function (s) {
      shifts[s.id] = {};
      for (var off = -35; off <= 49; off++) {
        var date = U.addDays(today, off), iso = U.toISO(date), wd = U.weekdayIndex(date);
        var t;
        if (shootDays[s.id + '|' + iso]) t = 'onsite';
        else if (holidayName(iso)) t = 'off';
        else if (wd >= 5) t = (s.teamId === 'content' && wd === 5 && rng.chance(0.2)) ? 'morning' : 'off';
        else if (inLeave(s.id, off)) t = 'leave';
        else if (s.id === 's18' && wd !== 0) t = 'afternoon';                       // part-time buổi chiều
        else if (s.id === 's17') t = wd === 4 ? 'remote' : 'full';
        else if (s.teamId === 'media' && off >= 1 && off <= 6) t = wd === 4 ? 'full' : 'ot'; // cao điểm 9.9
        else if (s.location === 'HCM' && wd !== 0 && wd !== 3) t = 'remote';
        else if (remotePref[s.id] === wd) t = 'remote';
        else if (rng.chance(0.04)) t = 'morning';
        else if (rng.chance(0.03)) t = 'afternoon';
        else t = 'full';
        shifts[s.id][iso] = t;
      }
    });
    return shifts;
  }

  /* ------------------------------------------------------------ requests */
  function buildRequests(today) {
    var d = function (n) { return U.toISO(U.addDays(today, n)); };
    var ts = function (n, h) { var x = U.addDays(today, n); x.setHours(h || 9, 12, 0, 0); return x.toISOString(); };
    return [
      { id: 'r01', staffId: 's05', type: 'leave', from: d(9), to: d(10), reason: 'Về quê có việc gia đình.', status: 'pending', createdAt: ts(-1, 16) },
      { id: 'r02', staffId: 's14', type: 'swap', from: d(4), to: d(4), reason: 'Đổi ca với Bảo Ngọc để đi khám sức khoẻ định kỳ buổi sáng.', status: 'pending', createdAt: ts(-1, 10), swapWithId: 's15' },
      { id: 'r03', staffId: 's11', type: 'ot', from: d(1), to: d(5), reason: 'Chạy tối ưu chiến dịch 9.9 giờ cao điểm 20h–23h.', status: 'pending', createdAt: ts(0, 8) },
      { id: 'r04', staffId: 's09', type: 'remote', from: d(3), to: d(3), reason: 'Thợ đến sửa điện nhà, xin làm remote một ngày.', status: 'pending', createdAt: ts(0, 9) },
      { id: 'r05', staffId: 's03', type: 'leave', from: d(1), to: d(2), reason: 'Nghỉ phép năm — du lịch Đà Lạt.', status: 'approved', createdAt: ts(-7, 11), approverId: 's01', decidedAt: ts(-6, 9) },
      { id: 'r06', staffId: 's08', type: 'leave', from: d(8), to: d(12), reason: 'Kết hôn 💍', status: 'approved', createdAt: ts(-14, 15), approverId: 's01', decidedAt: ts(-13, 10) },
      { id: 'r07', staffId: 's20', type: 'leave', from: d(16), to: d(17), reason: 'Khám sức khoẻ tổng quát.', status: 'approved', createdAt: ts(-4, 14), approverId: 's19', decidedAt: ts(-4, 16) },
      { id: 'r08', staffId: 's18', type: 'remote', from: d(-2), to: d(-2), reason: 'Xin remote để trông em.', status: 'rejected', createdAt: ts(-3, 9), approverId: 's16', decidedAt: ts(-3, 11), note: 'Hôm đó có buổi chụp cần hỗ trợ tại văn phòng.' },
      { id: 'r09', staffId: 's12', type: 'leave', from: d(-9), to: d(-8), reason: 'Việc cá nhân.', status: 'approved', createdAt: ts(-15, 9), approverId: 's10', decidedAt: ts(-15, 12) }
    ];
  }

  /* ------------------------------------------------------- notifications */
  function buildNotifications(today) {
    var ts = function (n, h, m) { var x = U.addDays(today, n); x.setHours(h, m || 0, 0, 0); return x.toISOString(); };
    return [
      { id: 'n01', kind: 'brand', title: 'Lịch quay TVC Tết đã chốt', body: 'Ngày 1 & 2 tại Studio Cổ Loa. Call time 05:30, xe đón tại văn phòng.', time: ts(0, 8, 5), read: false, link: '#/calendar' },
      { id: 'n02', kind: 'warning', title: '4 yêu cầu đang chờ bạn duyệt', body: 'Nghỉ phép, đổi ca, tăng ca và remote — hãy xử lý trước 17:00.', time: ts(0, 8, 30), read: false, link: '#/requests' },
      { id: 'n03', kind: 'info', title: 'Deadline final cut 9.9 còn 4 ngày', body: 'Bùi Anh Tuấn và Dương Bảo Ngọc đang ở bước dựng cuối.', time: ts(0, 9, 0), read: false, link: '#/projects' },
      { id: 'n04', kind: 'success', title: 'Khách duyệt KV "Thu Về"', body: 'Highlands Coffee đã duyệt bộ KV vòng cuối. Chuẩn bị bàn giao file in.', time: ts(-1, 17, 40), read: true, link: '#/projects' },
      { id: 'n05', kind: 'info', title: 'Workshop AI trong sáng tạo', body: 'Đăng ký tham gia trước thứ Sáu. Đã có 14/18 chỗ.', time: ts(-1, 11, 15), read: true, link: '#/calendar' },
      { id: 'n06', kind: 'success', title: 'Grab — Đối tác Tài xế 2026 đã wrap-up', body: 'Cảm ơn team Account & Content. Báo cáo cuối đã gửi khách.', time: ts(-6, 16, 30), read: true, link: '#/projects' }
    ];
  }

  /* ---------------------------------------------------------------- seed */
  Z15.data = {
    TEAMS: TEAMS, STAFF: STAFF, SHIFT_TYPES: SHIFT_TYPES, EVENT_TYPES: EVENT_TYPES, HOLIDAYS: HOLIDAYS, PRIORITIES: PRIORITIES, RSVP: RSVP,
    CURRENT_USER_ID: CURRENT_USER_ID,
    holidayName: holidayName,
    /** Sinh toàn bộ state mẫu quanh ngày `today` (Date). */
    seed: function (today) {
      today = today || U.today();
      var rng = U.rng(20260902);
      var projects = buildProjects(today);
      var events = buildEvents(today, projects, rng);
      var shifts = buildShifts(today, events, rng);
      return {
        meta: { version: 2, seedDate: U.toISO(today), dirty: false, createdAt: new Date().toISOString() },
        currentUserId: CURRENT_USER_ID,
        teams: TEAMS.map(function (t) { return Object.assign({}, t); }),
        staff: STAFF.map(function (s) { return Object.assign({}, s, { skills: s.skills.slice() }); }),
        projects: projects,
        events: events,
        shifts: shifts,
        requests: buildRequests(today),
        notifications: buildNotifications(today),
        settings: { theme: 'system', density: 'comfortable', weekStartsMonday: true, showWeekend: true, reduceMotion: false }
      };
    }
  };
})(window);
