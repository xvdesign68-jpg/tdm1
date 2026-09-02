/* =====================================================================
   Z15 Miracle · Lịch làm việc — views/assistant.js
   "Điều phối": trợ lý lịch cho CEO & quản lý — điểm lịch, việc cần xử lý,
   brief ngày, tìm giờ họp chung, bảo vệ thời gian tập trung, cơ cấu tuần.
   Route: #/assistant?staff=<id>&date=<iso>&tab=<issues|brief|find|focus>
   Cơ sở: HBR "How CEOs Manage Time" (Porter & Nohria) · thực hành EA
   (đệm 5–15', chuẩn bị 15–30', khối di chuyển, brief tối) · nghiên cứu
   focus-time (Microsoft/Clockwise: ~27% giờ làm là khối 2g+; 1 khối 2g/ngày
   giúp việc phức tạp nhanh hơn ~47%).
   ===================================================================== */
(function (global) {
  'use strict';
  var Z15 = global.Z15; Z15.views = Z15.views || {};
  var U = Z15.utils, UI = Z15.ui, h = U.html, raw = U.raw;
  var S = function () { return Z15.store; };
  var E = function () { return Z15.editors; };
  var R = function () { return Z15.router; };

  var KEYS = { staff: 'z15.ui.assistant.staff', brief: 'z15.ui.assistant.brief', find: 'z15.ui.assistant.find' };
  var TABS = ['issues', 'brief', 'find', 'focus'];
  var FOCUS_TARGET = 8 * 60;          // 8g tập trung / tuần (mục tiêu)
  var GROUP_LIMIT = 5;                // mỗi nhóm mức độ hiện tối đa 5 dòng, còn lại sau "Xem thêm"
  var MEETING_CAP = 5 * 9 * 60;       // 45g "giờ làm" tuần dùng cho % họp (đồng bộ store.weekHealth)
  var SEV = { 3: { label: 'Khẩn', icon: 'alert-triangle' }, 2: { label: 'Nên xử lý', icon: 'alert-circle' }, 1: { label: 'Gợi ý', icon: 'info' } };
  var KIND_LABEL = { conflict: 'Xung đột', 'focus-conflict': 'Đè khối tập trung', travel: 'Thiếu di chuyển', chain: 'Chuỗi họp sát nhau', b2b: 'Họp sát nhau', prep: 'Chuẩn bị', overload: 'Quá tải', agenda: 'Thiếu agenda', delegate: 'Uỷ quyền', rsvp: 'Chưa xác nhận' };
  var KPI_FILTERS = { score: null, meeting: ['overload', 'delegate', 'agenda'], focus: ['focus-conflict'], b2b: ['chain', 'b2b', 'travel'], conflict: ['conflict'] };
  var CAL_KIND = [
    { id: 'project', label: 'Khách hàng / Dự án', color: 'var(--as-proj)' },
    { id: 'exec', label: 'Ban điều hành', color: 'var(--ev-meeting)' },
    { id: 'team', label: 'Team', color: 'var(--ev-review)' },
    { id: 'company', label: 'Toàn công ty', color: 'var(--ev-event)' },
    { id: 'personal', label: 'Cá nhân', color: 'var(--fg-tertiary)' },
    { id: 'other', label: 'Khác', color: 'var(--fg-disabled)' }
  ];

  /* ------------------------------------------------------------ helpers */
  function reduceMotion() { return U.prefersReducedMotion() || document.body.classList.contains('reduce-motion'); }
  function icon(name, size) { return raw(UI.icon(name, size)); }
  function dmw(iso) { return U.fmtDate(iso, 'shortWeekday'); }
  function validISO(s) { return U.validISO(s); }
  function isWorkday(iso) { return !U.isWeekend(iso) && !S().holidayName(iso); }
  function nextWorkday(iso) { var d = U.addDays(U.fromISO(iso), 1); for (var i = 0; i < 30 && !isWorkday(U.toISO(d)); i++) d = U.addDays(d, 1); return U.toISO(d); }
  function fmtNum(v, dec) { return Number(v).toLocaleString('vi-VN', { minimumFractionDigits: 0, maximumFractionDigits: dec == null ? 1 : dec }); }
  /** phút → "24g" / "5g30" / "45'" */
  function fmtH(min) { min = Math.round(min || 0); if (!min) return '0g'; if (min < 60) return min + "'"; var hh = Math.floor(min / 60), m = min % 60; return m ? hh + 'g' + U.pad(m) : hh + 'g'; }
  function fmtHours(min) { return fmtNum(Math.round((min || 0) / 60 * 10) / 10) + 'g'; }
  function mins(t) { return U.timeToMin(t); }
  function issueKey(i) { return i.kind + '|' + i.date + '|' + (i.events || []).map(function (e) { return e.id; }).join(',') + (i.to ? '|' + i.to.id : ''); }
  function weekOf(iso) { return U.toISO(U.startOfWeek(U.fromISO(iso))); }
  function weekLabel(iso) { var s = U.startOfWeek(U.fromISO(iso)), e = U.addDays(s, 6); return 'Tuần ' + U.isoWeek(s) + ' · ' + U.fmtDate(s, 'dm') + ' – ' + U.fmtDate(e, 'dm'); }
  /** FLIP dọc: đo → đổi DOM → đo lại → dịch ngược → trượt về 0. */
  function flipY(nodes, mutate, dur) {
    nodes = (nodes || []).filter(Boolean);
    if (reduceMotion() || !nodes.length) { mutate(); return; }
    var before = nodes.map(function (n) { return n.getBoundingClientRect().top; });
    mutate();
    var moving = [];
    nodes.forEach(function (n, i) { if (!n.isConnected) return; var d = before[i] - n.getBoundingClientRect().top; if (Math.abs(d) < .5) return; n.style.transition = 'none'; n.style.transform = 'translateY(' + d + 'px)'; moving.push(n); });
    if (!moving.length) return;
    void document.body.offsetHeight;
    requestAnimationFrame(function () { moving.forEach(function (n) { n.style.transition = 'transform ' + dur + 'ms var(--ease-inout)'; n.style.transform = ''; }); setTimeout(function () { moving.forEach(function (n) { n.style.transition = ''; }); }, dur + 40); });
  }
  function compactPill(ev) { var st = S(), me = st.state.currentUserId; var copy = Object.assign({}, ev, { title: st.displayTitle(ev, me) }); return raw(UI.eventPill(copy, { compact: true })); }

  /* ----------------------------------------------------------------- view */
  function AssistantView(container, route) {
    var self = this;
    this.container = container; this.unbinders = []; this.timers = []; this.destroyed = false;
    this.handled = {}; this.resolved = 0; this.busy = false; this.pendingRerender = false; this.issueFilter = null; this.kpiAnimated = false; this.expanded = {};
    this.readRoute(route);
    this.initBrief(); this.initFind();
    this.build(); this.renderAll(true); this.bind();
    this.unsub = S().subscribe(function (state, meta) { self.onStore(meta); });
    this.unregisterKeys = [
      UI.shortcuts.register('j', function () { self.shiftWeek(-1); }, 'Tuần trước', 'Điều phối'),
      UI.shortcuts.register('k', function () { self.shiftWeek(1); }, 'Tuần sau', 'Điều phối'),
      UI.shortcuts.register('e', function () { var r = self.focusedIssue(); if (r) { var b = r.querySelector('[data-act]'); if (b) b.click(); } }, 'Thực hiện hành động đầu của dòng đang chọn', 'Điều phối'),
      UI.shortcuts.register('b', function () { var b = self.container.querySelector('[data-copy-brief]'); if (b) b.click(); }, 'Sao chép brief ngày mai', 'Điều phối')
    ];
    this.onToday = function (e) { e.preventDefault(); self.goTo({ date: U.todayISO() }); };
    document.addEventListener('z15:today', this.onToday);
    UI.palette.register({ id: 'assistant:brief', label: 'Sao chép brief ngày mai (Điều phối)', icon: 'copy', section: 'Điều phối', keywords: 'brief zalo sep', run: function () { var b = self.container.querySelector('[data-copy-brief]'); if (b) b.click(); } });
  }
  AssistantView.prototype.alive = function () { return !this.destroyed && !!(this.blocks && this.blocks.head && this.blocks.head.isConnected); };
  AssistantView.prototype.later = function (fn, ms) { var self = this; var id = setTimeout(function () { if (self.alive()) fn(); }, ms); this.timers.push(id); return id; };

  /* ------------------------------------------------------------ route */
  AssistantView.prototype.defaultStaff = function () {
    var st = S(), me = st.state.currentUserId, saved = U.loadJSON(KEYS.staff, {}) || {};
    if (saved[me] && st.staff(saved[me])) return saved[me];
    return me === 's24' && st.staff('s23') ? 's23' : me;
  };
  AssistantView.prototype.readRoute = function (route) {
    var q = (route && route.query) || {}, st = S();
    this.today = U.todayISO();
    this.staffId = q.staff && st.staff(q.staff) ? q.staff : this.defaultStaff();
    var saved = U.loadJSON(KEYS.staff, {}) || {}; saved[st.state.currentUserId] = this.staffId; U.saveJSON(KEYS.staff, saved);
    this.iso = validISO(q.date) ? q.date : this.today;
    this.weekISO = weekOf(this.iso);
    this.days = U.weekDays(U.fromISO(this.iso)).slice(0, 5).map(U.toISO);
    this.tab = TABS.indexOf(q.tab) >= 0 ? q.tab : 'issues';
  };
  AssistantView.prototype.key = function () { return this.staffId + '|' + this.weekISO + '|' + this.tab; };
  AssistantView.prototype.query = function (patch) { var q = { staff: this.staffId, date: this.iso }; if (this.tab !== 'issues') q.tab = this.tab; return Object.assign(q, patch || {}); };
  AssistantView.prototype.goTo = function (patch) { R().go('assistant', this.query(patch)); };
  AssistantView.prototype.shiftWeek = function (dir) { this.goTo({ date: U.toISO(U.addDays(U.fromISO(this.weekISO), 7 * dir)) }); };
  AssistantView.prototype.staff = function () { return S().staff(this.staffId); };
  AssistantView.prototype.isExec = function () { var s = this.staff(); return !!(s && s.teamId === 'exec'); };
  AssistantView.prototype.isSelf = function () { return this.staffId === S().state.currentUserId; };
  /** Ngôi xưng: "bạn" khi xem chính mình · "sếp" khi trợ lý xem CEO · tên gọi khi xem người khác. */
  AssistantView.prototype.subj = function () {
    if (this.isSelf()) return 'bạn';
    var me = S().state.currentUserId;
    if (this.staffId === 's23' && me === 's24') return 'sếp';
    var s = this.staff(); return s ? U.firstName(s.name) : 'bạn';
  };
  AssistantView.prototype.Subj = function () { var s = this.subj(); return s.charAt(0).toUpperCase() + s.slice(1); };
  /** Ngày "brief ngày mai" của nút chính: ngày làm việc kế tiếp sau hôm nay. */
  AssistantView.prototype.tomorrowISO = function () { return nextWorkday(this.today); };

  AssistantView.prototype.initBrief = function () {
    var saved = U.loadJSON(KEYS.brief, null) || {};
    var tab = ['today', 'tomorrow', 'pick'].indexOf(saved.tab) >= 0 ? saved.tab : (isWorkday(this.today) ? 'today' : (this.tomorrowISO() === U.toISO(U.addDays(U.today(), 1)) ? 'tomorrow' : 'pick'));
    this.brief = { tab: tab, pick: validISO(saved.pick) ? saved.pick : this.tomorrowISO() };
    if (tab === 'pick' && !validISO(saved.pick)) this.brief.pick = this.tomorrowISO();
  };
  AssistantView.prototype.briefDate = function () { var b = this.brief; return b.tab === 'today' ? this.today : b.tab === 'tomorrow' ? U.toISO(U.addDays(U.today(), 1)) : b.pick; };
  AssistantView.prototype.initFind = function () {
    var saved = U.loadJSON(KEYS.find, null) || {};
    this.find = {
      people: U.uniq([this.staffId, S().state.currentUserId]),
      dur: [30, 45, 60, 90].indexOf(+saved.dur) >= 0 ? +saved.dur : 45,
      range: ['week', 'next', '10d'].indexOf(saved.range) >= 0 ? saved.range : 'week',
      avoidFocus: saved.avoidFocus !== false, buffer: saved.buffer !== false
    };
  };
  AssistantView.prototype.saveFind = function () { var f = this.find; U.saveJSON(KEYS.find, { dur: f.dur, range: f.range, avoidFocus: f.avoidFocus, buffer: f.buffer }); };

  /* ------------------------------------------------------------- shell */
  AssistantView.prototype.build = function () {
    U.render(this.container, h`
      <div class="as">
        <header class="as-head reveal" style="--i:0" data-block="head" aria-label="Điều phối lịch"></header>
        <section class="as-kpis reveal" style="--i:1" data-block="kpis" aria-label="Sức khoẻ lịch tuần"></section>
        <div class="as-grid">
          <div class="as-main">
            <section class="card as-issues reveal" style="--i:2" data-block="issues" aria-label="Cần xử lý"></section>
            <section class="card as-focus reveal" style="--i:4" data-block="focus" aria-label="Bảo vệ thời gian tập trung"></section>
            <section class="card as-struct reveal" style="--i:6" data-block="struct" aria-label="Cơ cấu tuần"></section>
          </div>
          <aside class="as-side">
            <section class="card as-brief reveal" style="--i:3" data-block="brief" aria-label="Brief ngày"></section>
            <section class="card as-find reveal" style="--i:5" data-block="find" aria-label="Tìm giờ họp"></section>
          </aside>
        </div>
      </div>`);
    this.blocks = {}; U.qsa('[data-block]', this.container).forEach(function (b) { this.blocks[b.dataset.block] = b; }, this);
  };
  AssistantView.prototype.renderAll = function (first) {
    if (!this.alive()) return;
    this.health = S().weekHealth(this.staffId, this.weekISO);
    this.setTitle(); this.renderHead(); this.renderKpis(first); this.renderIssues(); this.renderBrief(); this.renderFind(); this.renderFocus(); this.renderStruct(first);
    if (first && this.tab !== 'issues') { var b = this.blocks[this.tab]; var self = this; if (b) this.later(function () { b.scrollIntoView({ block: 'start', behavior: reduceMotion() ? 'auto' : 'smooth' }); }, 350); }
  };
  AssistantView.prototype.setTitle = function () {
    var s = this.staff(), hol = S().holidayName(this.today);
    Z15.app.setTitle('Điều phối', weekLabel(this.weekISO) + ' · ' + (s ? U.shortName(s.name) : '') + (hol && this.weekISO === weekOf(this.today) ? ' · ' + hol : ''));
  };

  /* -------------------------------------------------------------- head */
  AssistantView.prototype.renderHead = function () {
    var st = S(), s = this.staff(), team = st.team(s.teamId), me = st.state.currentUserId;
    var tomorrow = this.tomorrowISO(), isTmr = U.daysBetween(this.today, tomorrow) === 1;
    var isThisWeek = this.weekISO === weekOf(this.today);
    U.render(this.blocks.head, h`
      <div class="as-head__top">
        <div class="eyebrow as-head__eyebrow">Điều phối lịch · ${weekLabel(this.weekISO)}${!isThisWeek ? h` <button type="button" class="chip chip--blue chip--xs as-head__back" data-nav="today">${icon('arrow-left', 11)}<span>Về tuần này</span></button>` : ''}</div>
        <nav class="as-weeknav" aria-label="Chuyển tuần">
          <button type="button" class="icon-btn" data-nav="prev" aria-label="Tuần trước (J)" data-tip="Tuần trước · J">${icon('chevron-left', 18)}</button>
          <button type="button" class="btn btn--ghost btn--sm" data-nav="today" aria-label="Về tuần hiện tại (T)">Hôm nay</button>
          <button type="button" class="icon-btn" data-nav="next" aria-label="Tuần sau (K)" data-tip="Tuần sau · K">${icon('chevron-right', 18)}</button>
        </nav>
      </div>
      <div class="as-head__row">
        <button type="button" class="as-person" data-person aria-haspopup="dialog" aria-expanded="false" aria-label="Đổi người đang điều phối: ${s.name}">
          ${raw(UI.avatar(s, { size: 'lg', status: true, title: false }))}
          <span class="as-person__txt"><b class="t-h1 as-person__name">${s.name}${this.isSelf() ? h` <span class="chip chip--muted chip--xs">Bạn</span>` : ''}</b><small>${s.role}${team ? ' · ' + team.name : ''}${me !== s.id && this.isExec() ? ' · bạn đang điều phối cho ' + this.subj() : ''}</small></span>
          ${icon('chevron-down', 16)}
        </button>
        <div class="as-head__cta">
          <a class="btn btn--ghost" href="#/calendar/week/${this.iso}?staff=${s.id}">${icon('calendar-days', 16)}<span>Xem lịch</span></a>
          <button type="button" class="btn btn--primary" data-copy-brief="${tomorrow}" data-tip="Brief tối cho ${this.subj()} · phím B">${icon('copy', 16)}<span>Sao chép brief ${isTmr ? 'ngày mai' : dmw(tomorrow)}</span></button>
        </div>
      </div>`);
  };
  /** Popover đổi người: Ban điều hành · Trưởng nhóm · Tôi · tìm mọi nhân sự. */
  AssistantView.prototype.openPerson = function (anchor) {
    var st = S(), self = this, me = st.me();
    var exec = st.staffByTeam('exec'), leads = st.state.staff.filter(function (x) { return x.teamId !== 'exec' && st.isLead(x.id); });
    function row(x, tag) { return '<button type="button" class="staff-opt' + (x.id === self.staffId ? ' is-on' : '') + '" role="option" aria-selected="' + (x.id === self.staffId) + '" data-pick="' + x.id + '">' + UI.avatar(x, { size: 'sm', title: false }) + '<span class="staff-opt__txt"><b>' + U.escapeHtml(x.name) + (tag ? ' <span class="chip chip--muted chip--xs">' + tag + '</span>' : '') + '</b><small>' + U.escapeHtml(x.role) + '</small></span><span class="staff-opt__check">' + UI.icon('check', 14) + '</span></button>'; }
    function group(title, list) { return list.length ? '<div class="staff-picker__group"><div class="staff-picker__gtitle">' + title + '</div>' + list.map(function (x) { return row(x, x.id === me.id ? 'Bạn' : ''); }).join('') + '</div>' : ''; }
    var html = '<div class="as-pick"><div class="staff-picker__top"><div class="input-icon">' + UI.icon('search', 16) + '<input class="input as-pick__search" type="search" placeholder="Tìm nhân sự (không cần dấu)…" aria-label="Tìm nhân sự" autocomplete="off"></div></div><div class="staff-picker__list as-pick__list" role="listbox" aria-label="Chọn người"></div></div>';
    var pop = UI.popover(anchor, html, { placement: 'bottom-start', width: 340, cls: 'popover--as-pick', ariaLabel: 'Chọn người để điều phối' });
    var list = pop.el.querySelector('.as-pick__list'), input = pop.el.querySelector('.as-pick__search');
    function render(q) {
      if (q) { var rows = st.state.staff.filter(function (x) { return U.fuzzyMatch(q, x.name + ' ' + x.role + ' ' + (st.team(x.teamId) || {}).name) > 0; }); list.innerHTML = rows.length ? group('Kết quả · ' + rows.length, rows) : '<div class="muted pad">Không tìm thấy nhân sự phù hợp</div>'; return; }
      list.innerHTML = group('Ban điều hành', exec) + group('Tôi', me.teamId === 'exec' ? [] : [me]) + group('Trưởng nhóm', leads.filter(function (x) { return x.id !== me.id; }));
    }
    render('');
    input.addEventListener('input', U.debounce(function () { render(input.value.trim()); }, 80));
    input.addEventListener('keydown', function (e) { if (e.key === 'ArrowDown') { var f = list.querySelector('.staff-opt'); if (f) { e.preventDefault(); f.focus(); } } });
    pop.el.addEventListener('keydown', function (e) { var os = U.qsa('.staff-opt', pop.el), i = os.indexOf(document.activeElement); if (i < 0) return; if (e.key === 'ArrowDown') { e.preventDefault(); (os[i + 1] || os[0]).focus(); } if (e.key === 'ArrowUp') { e.preventDefault(); (os[i - 1] || input).focus(); } });
    pop.el.addEventListener('click', function (e) { var b = e.target.closest('[data-pick]'); if (!b) return; pop.close(); if (b.dataset.pick !== self.staffId) self.goTo({ staff: b.dataset.pick }); });
  };

  /* --------------------------------------------------------------- KPI */
  AssistantView.prototype.insight = function (hw) {
    var subj = this.subj(), parts = [];
    var meetH = fmtH(hw.meetingMin), pct = hw.meetingPct;
    parts.push('Tuần này ' + subj + ' họp ' + meetH + ' (' + pct + '%)' + (pct > 50 ? ' — cao hơn ngưỡng 50%' : pct >= 40 ? ' — sát ngưỡng 50%' : ' — trong ngưỡng') + '.');
    var need = Math.max(0, Math.ceil((FOCUS_TARGET - hw.focusMin) / 120));
    parts.push((hw.focusMin ? 'Có ' + fmtH(hw.focusMin) + ' tập trung' : 'Còn 0g tập trung') + (need ? '; nên chặn ' + need + ' khối 2g.' : ' — đủ mục tiêu 8g.'));
    if (hw.conflicts) parts.push(hw.conflicts + ' xung đột cần dời.');
    if (hw.travelIssues) parts.push(hw.travelIssues + ' lần thiếu giờ di chuyển.');
    if (hw.daysOver6h) parts.push(hw.daysOver6h + ' ngày họp trên 6g.');
    return parts.join(' ');
  };
  AssistantView.prototype.renderKpis = function (first) {
    var hw = this.health, block = this.blocks.kpis, self = this;
    var animate = first && !this.kpiAnimated && !reduceMotion(); this.kpiAnimated = true;
    var tone = hw.score >= 80 ? 'ok' : hw.score >= 60 ? 'warn' : 'red';
    var focusPct = U.clamp(hw.focusMin / FOCUS_TARGET * 100, 0, 100);
    var meetH = Math.round(hw.meetingMin / 60 * 10) / 10, focusH = Math.round(hw.focusMin / 60 * 10) / 10;
    var b2b = hw.backToBack, cf = hw.conflicts, filt = this.issueFilter;
    function tile(key, label, body, extra) { var on = filt && filt.key === key; return h`<button type="button" class="card kpi as-kpi${on ? ' is-on' : ''}" data-kpi="${key}" aria-pressed="${on ? 'true' : 'false'}" data-tip="${extra || 'Bấm để lọc danh sách cần xử lý'}"><span class="kpi__label">${label}</span>${body}</button>`; }
    U.render(block, h`
      <div class="as-kpis__grid" role="group" aria-label="Chỉ số tuần">
        ${tile('score', h`${icon('activity', 13)}Điểm lịch`, h`
          <span class="as-score" data-tone="${tone}">
            <span class="as-ring" role="img" aria-label="Điểm lịch ${hw.score} trên 100 · ${hw.label}"><svg viewBox="0 0 48 48" aria-hidden="true"><circle class="as-ring__track" cx="24" cy="24" r="20"/><circle class="as-ring__arc" cx="24" cy="24" r="20" pathLength="100" style="stroke-dashoffset:${animate ? 100 : 100 - hw.score}"/></svg><b class="mono tnum as-ring__val" data-kpi-num="${hw.score}" data-dec="0">${animate ? 0 : hw.score}</b></span>
            <span class="as-score__txt"><b>${hw.label}</b><small>${hw.score >= 80 ? 'Giữ nhịp này' : hw.score >= 60 ? 'Vài việc cần chỉnh' : 'Cần dời & chặn giờ'}</small></span>
          </span>`, 'Điểm 0–100: trừ khi trùng lịch, họp sát nhau, thiếu di chuyển, ngày họp >6g, thiếu chuẩn bị · Bấm để xem tất cả')}
        ${tile('meeting', h`${icon('users', 13)}Giờ họp tuần`, h`<span class="kpi__value"><span data-kpi-num="${meetH}" data-dec="1">${animate ? 0 : fmtNum(meetH)}</span><small>g</small></span><span class="kpi__delta${hw.meetingPct > 50 ? ' is-warn' : ''}"><b class="tnum">${hw.meetingPct}%</b> giờ làm · ngưỡng 50%</span>`, 'HBR (Porter & Nohria): CEO dành phần lớn giờ làm cho họp; giữ họp mặc định 30 phút, ít người, có agenda')}
        ${tile('focus', h`${icon('target', 13)}Tập trung`, h`<span class="kpi__value"><span data-kpi-num="${focusH}" data-dec="1">${animate ? 0 : fmtNum(focusH)}</span><small>g</small></span>${raw(UI.progress(animate ? 0 : focusPct, { size: 'xs', cls: 'progress--grad' }))}<span class="kpi__delta">mục tiêu 8g · trống dài nhất <b class="tnum">${fmtH(hw.longestFreeGap)}</b></span>`, 'Chỉ ~27% giờ làm là khối 2g+ không bị ngắt (Microsoft/Clockwise) · Bấm để lọc họp đè khối tập trung')}
        ${tile('b2b', h`${icon('link', 13)}Họp sát nhau`, h`<span class="kpi__value"><span data-kpi-num="${b2b}" data-dec="0">${animate ? 0 : b2b}</span></span><span class="kpi__delta${hw.travelIssues ? ' as-kpi__delta--red' : ''}">${hw.travelIssues ? h`${icon('map-pin', 12)} <b class="tnum">${hw.travelIssues}</b> thiếu di chuyển` : 'đủ giờ di chuyển'}</span>`, "Thực hành EA: đệm 5–15' giữa các cuộc họp, chặn giờ di chuyển cho họp ngoài")}
        ${tile('conflict', h`${icon('alert-triangle', 13)}Xung đột`, h`<span class="kpi__value${cf ? ' as-kpi__value--red' : ''}"><span data-kpi-num="${cf}" data-dec="0">${animate ? 0 : cf}</span></span><span class="kpi__delta">${cf ? 'trùng giờ · cần dời' : 'không trùng lịch'}${hw.focusConflicts ? h` · <b class="tnum">${hw.focusConflicts}</b> đè tập trung` : ''}</span>`, 'Trùng giờ giữa hai sự kiện của cùng một người')}
      </div>
      <p class="as-insight muted" aria-live="polite">${icon('sparkles', 14)}<span>${this.insight(hw)}</span></p>`);
    if (animate) {
      U.qsa('[data-kpi-num]', block).forEach(function (el, i) { var v = +el.dataset.kpiNum, dec = +el.dataset.dec; self.later(function () { U.countUp(el, v, { duration: 800, format: function (x) { return fmtNum(dec ? Math.round(x * 10) / 10 : Math.round(x), dec); } }); }, 120 + i * 60); });
      requestAnimationFrame(function () { requestAnimationFrame(function () { var arc = block.querySelector('.as-ring__arc'); if (arc) { arc.classList.add('is-anim'); arc.style.strokeDashoffset = String(100 - hw.score); } var bar = block.querySelector('.progress__bar'); if (bar) bar.style.width = focusPct + '%'; }); });
    }
  };
  AssistantView.prototype.setKpiFilter = function (key) {
    var kinds = KPI_FILTERS[key];
    if (!kinds || (this.issueFilter && this.issueFilter.key === key)) this.issueFilter = null; else this.issueFilter = { key: key, kinds: kinds, label: { meeting: 'Giờ họp', focus: 'Tập trung', b2b: 'Họp sát nhau', conflict: 'Xung đột' }[key] };
    U.qsa('.as-kpi', this.blocks.kpis).forEach(function (t) { var on = !!(this.issueFilter && t.dataset.kpi === this.issueFilter.key); t.classList.toggle('is-on', on); t.setAttribute('aria-pressed', on ? 'true' : 'false'); }, this);
    this.renderIssues();
    if (key === 'focus' && !this.issueFilter) this.blocks.focus.scrollIntoView({ block: 'start', behavior: reduceMotion() ? 'auto' : 'smooth' });
    else this.blocks.issues.scrollIntoView({ block: 'start', behavior: reduceMotion() ? 'auto' : 'smooth' });
  };

  /* ------------------------------------------------------------ issues */
  AssistantView.prototype.issueList = function () {
    var self = this, all = S().issuesFor(this.staffId, this.weekISO);
    all.forEach(function (i) { i.key = issueKey(i); });
    this.allIssues = all.filter(function (i) { return !self.handled[i.key]; });
    var f = this.issueFilter;
    return this.allIssues.filter(function (i) { return !f || f.kinds.indexOf(i.kind) >= 0 && (!f.date || i.date === f.date); });
  };
  /** Hành động chính + phụ theo loại vấn đề. */
  AssistantView.prototype.issueActions = function (i) {
    var ev = i.events || [], to = i.to;
    switch (i.kind) {
      case 'conflict': return { main: { act: 'resolve', label: 'Dời sang giờ trống', icon: 'repeat' }, alt: null };
      case 'focus-conflict': return { main: { act: 'resolve-focus', label: 'Dời họp, giữ tập trung', icon: 'target' }, alt: { act: 'drop-focus', label: 'Bỏ khối tập trung' } };
      case 'travel': return { main: { act: 'travel', label: 'Chặn ' + i.need + "' di chuyển", icon: 'map-pin' }, alt: { act: 'push', label: 'Dời họp sau ' + Math.max(5, i.need - i.gap) + "'" } };
      case 'chain': case 'b2b': return { main: { act: 'buffer', label: "Chèn đệm 10'", icon: 'plus' }, alt: null };
      case 'prep': return { main: { act: 'nudge-all', label: 'Nhắc người phụ trách', icon: 'bell' }, alt: { act: 'open', label: 'Mở checklist' } };
      case 'overload': return { main: { act: 'delegate-day', label: 'Gợi ý uỷ quyền', icon: 'user-plus' }, alt: null };
      case 'agenda': return { main: { act: 'ask-agenda', label: 'Yêu cầu agenda', icon: 'message' }, alt: null };
      case 'delegate': return { main: { act: 'delegate', label: 'Uỷ quyền cho ' + (to ? U.shortName(to.name) : '…'), icon: 'user-plus' }, alt: null };
      case 'rsvp': return { main: { act: 'nudge', label: 'Nhắc', icon: 'bell' }, alt: null };
    }
    return { main: null, alt: null };
  };
  AssistantView.prototype.issueRow = function (i, idx) {
    var a = this.issueActions(i), sev = SEV[i.severity] || SEV[1], evs = i.events || [];
    var hasOpen = evs.length > 0 && !(a.alt && a.alt.act === 'open');
    return h`<li class="as-issue" data-key="${i.key}" data-kind="${i.kind}" data-sev="${i.severity}" tabindex="0" aria-label="${sev.label}: ${i.text}">
      <span class="as-issue__sev" data-sev="${i.severity}">${icon(sev.icon, 15)}<span class="as-issue__sevlbl">${sev.label}</span></span>
      <div class="as-issue__body">
        <div class="as-issue__top"><span class="chip chip--xs chip--type as-issue__date mono">${dmw(i.date)}</span><span class="as-issue__kind faint">${KIND_LABEL[i.kind] || i.kind}</span></div>
        <p class="as-issue__text">${i.text}</p>
        ${evs.length ? h`<div class="as-issue__evs">${evs.slice(0, 4).map(function (e) { return compactPill(e); })}</div>` : ''}
      </div>
      <div class="as-issue__actions">
        <span class="as-stamp">${a.main ? h`<button type="button" class="btn btn--sm btn--soft" data-act="${a.main.act}">${icon(a.main.icon, 14)}<span>${a.main.label}</span></button>` : ''}<span class="as-stamp__done" aria-hidden="true"><svg class="icon as-tick" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6 9 17l-5-5" pathLength="1"/></svg><span>Đã xử lý</span></span></span>
        ${a.alt ? h`<button type="button" class="btn btn--sm btn--ghost" data-act="${a.alt.act}">${a.alt.label}</button>` : ''}
        ${hasOpen ? h`<button type="button" class="btn btn--sm btn--ghost" data-act="open" aria-label="Mở chi tiết sự kiện">Mở</button>` : ''}
      </div>
    </li>`;
  };
  AssistantView.prototype.renderIssues = function () {
    if (!this.alive() || this.busy) { if (this.busy) this.pendingRerender = true; return; }
    var self = this, block = this.blocks.issues, list = this.issueList(), f = this.issueFilter;
    var focused = this.focusedIssue(), focusKey = focused ? focused.dataset.key : null;
    var groups = [3, 2, 1].map(function (s) { return { sev: s, items: list.filter(function (i) { return i.severity === s; }) }; }).filter(function (g) { return g.items.length; });
    var total = this.allIssues.length, done = this.resolved, pct = total + done ? Math.round(done / (total + done) * 100) : 100;
    U.render(block, h`
      <div class="card__head as-issues__head">
        <div><div class="card__eyebrow">Trợ lý lịch · ${weekLabel(this.weekISO)}</div><h3 class="card__title">Cần xử lý <span class="badge${list.some(function (i) { return i.severity === 3; }) ? ' badge--red' : ''} tnum">${list.length}</span>${f ? h` <button type="button" class="chip chip--blue chip--xs as-issues__filter" data-kpi-clear aria-label="Bỏ lọc ${f.label}"><span>Lọc: ${f.label}${f.date ? ' · ' + dmw(f.date) : ''}</span>${icon('x', 11)}</button>` : ''}</h3></div>
        <div class="as-issues__done" aria-label="Đã xử lý ${done} trong phiên này"><span class="faint">Đã xử lý <b class="tnum">${done}</b> trong phiên này</span>${raw(UI.progress(pct, { size: 'xs', color: 'var(--ok)' }))}</div>
      </div>
      ${groups.length ? h`<div class="as-issues__groups">${groups.map(function (g) {
        var open = !!self.expanded[g.sev], shown = open ? g.items : g.items.slice(0, GROUP_LIMIT), hiddenN = g.items.length - shown.length;
        var rsvpRows = g.items.filter(function (i) { return i.kind === 'rsvp'; }), pend = U.sum(rsvpRows, function (i) { var rs = S().rsvpSummary(i.events[0]); return rs.pending + rs.maybe; });
        return h`<section class="as-issues__group" data-sev="${g.sev}" aria-label="${SEV[g.sev].label}">
          <div class="as-issues__ghead"><h4 class="eyebrow as-issues__gtitle"><i></i>${SEV[g.sev].label} · ${g.items.length}</h4>${rsvpRows.length > 1 ? h`<button type="button" class="btn btn--sm btn--secondary as-issues__gact" data-nudge-group="${g.sev}" aria-label="Nhắc tất cả ${pend} người chưa xác nhận ở ${rsvpRows.length} sự kiện">${icon('bell', 13)}<span>Nhắc tất cả</span><span class="badge tnum">${pend}</span></button>` : ''}</div>
          <ul class="as-issues__list" role="list">${shown.map(function (i, k) { return self.issueRow(i, k); })}</ul>
          ${g.items.length > GROUP_LIMIT ? h`<button type="button" class="link-btn as-issues__more" data-more="${g.sev}" aria-expanded="${open ? 'true' : 'false'}">${icon(open ? 'chevron-up' : 'chevron-down', 13)}<span>${open ? 'Thu gọn' : 'Xem thêm ' + hiddenN + ' mục'}</span></button>` : ''}
        </section>`; })}</div>`
        : h`<div class="empty as-empty"><span class="as-empty__mark">${raw(UI.logoMark(56))}</span><p class="empty__title">${f ? 'Không có mục nào thuộc bộ lọc này.' : total ? 'Đã xử lý hết các mục hiển thị.' : 'Lịch tuần này sạch — không có gì cần xử lý.'}</p><p class="empty__body">${f ? 'Bỏ lọc để xem toàn bộ danh sách.' : 'Trợ lý sẽ báo ngay khi có trùng lịch, họp sát nhau hay thiếu chuẩn bị.'}</p>${f ? h`<button type="button" class="btn btn--soft btn--sm" data-kpi-clear>${icon('x', 14)}<span>Bỏ lọc</span></button>` : ''}</div>`}
      <div class="card__foot as-issues__foot"><span>${raw(UI.kbd('↑'))}${raw(UI.kbd('↓'))} chọn dòng · ${raw(UI.kbd('E'))} hành động đầu · ${raw(UI.kbd('J'))}${raw(UI.kbd('K'))} đổi tuần</span><span class="faint">${total} mục · ${this.allIssues.filter(function (i) { return i.severity === 3; }).length} khẩn</span></div>`);
    if (focusKey) { var again = block.querySelector('.as-issue[data-key="' + focusKey + '"]') || block.querySelector('.as-issue'); if (again) again.focus({ preventScroll: true }); }
  };
  AssistantView.prototype.focusedIssue = function () { var a = document.activeElement; return a && this.blocks && this.blocks.issues.contains(a) ? a.closest('.as-issue') : null; };

  /* ------------------------------------------------------ issue actions */
  /** Chọn sự kiện nên dời trong cặp trùng: ưu tiên thấp hơn (P3 > P2 > P1), nếu bằng thì cái bắt đầu muộn hơn. */
  function pickMovable(a, b) {
    var pa = a.priority || 2, pb = b.priority || 2;
    if (pa !== pb) return pa > pb ? a : b;
    return mins(a.start) >= mins(b.start) ? a : b;
  }
  AssistantView.prototype.moveWithUndo = function (ev, verb) {
    var st = S(), old = { date: ev.date, start: mins(ev.start) }, pick = st.resolveConflict(ev.id);
    if (!pick) { UI.toast('Không tìm được giờ trống cho mọi người trong 3 ngày tới — thử dời tay trong Lịch', { kind: 'warning' }); return false; }
    UI.toast((verb || 'Đã dời') + ' “' + ev.title + '” sang ' + dmw(pick.date) + ' ' + pick.startLabel, { kind: 'success', duration: 6000, action: { label: 'Hoàn tác', onClick: function () { st.moveEvent(ev.id, old.date, old.start); UI.toast('Đã đưa “' + ev.title + '” về giờ cũ', { kind: 'info' }); } } });
    return true;
  };
  /** Thực hiện hành động trên một dòng; trả về true nếu dòng được coi là đã xử lý (chạy choreography). */
  AssistantView.prototype.doAction = function (row, act, btn) {
    var st = S(), me = st.state.currentUserId, key = row.dataset.key, self = this;
    var i = (this.allIssues || []).filter(function (x) { return x.key === key; })[0]; if (!i) return;
    var evs = (i.events || []).map(function (e) { return st.event(e.id) || e; }), ok = false;
    this.busy = true; // khoá vẽ lại trong lúc store phát sự kiện, giữ node dòng cho choreography
    switch (act) {
      case 'open': { this.busy = false; var target = evs[0]; if (target) E().eventDetail(target.id); return; }
      case 'resolve': { var mv = pickMovable(evs[0], evs[1]); ok = this.moveWithUndo(mv); break; }
      case 'resolve-focus': { var nf = evs.filter(function (e) { return e.type !== 'focus'; })[0] || evs[0]; ok = this.moveWithUndo(nf); break; }
      case 'drop-focus': {
        var fc = evs.filter(function (e) { return e.type === 'focus'; })[0]; if (!fc) return;
        var copy = JSON.parse(JSON.stringify(fc)); st.deleteEvent(fc.id); ok = true;
        UI.toast('Đã bỏ khối “' + fc.title + '” — cuộc họp được giữ nguyên', { kind: 'info', duration: 6000, action: { label: 'Hoàn tác', onClick: function () { st.addEvent(copy); } } });
        break;
      }
      case 'travel': {
        var tb = st.addTravelBlock(evs[1].id, this.staffId, i.need); ok = !!tb;
        if (tb) UI.toast('Đã chặn di chuyển ' + tb.start + ' – ' + tb.end + ' → ' + (evs[1].location || evs[1].title), { kind: 'success', duration: 6000, action: { label: 'Hoàn tác', onClick: function () { st.deleteEvent(tb.id); } } });
        break;
      }
      case 'push': {
        var ev2 = evs[1], old2 = { date: ev2.date, start: mins(ev2.start) }, by = Math.max(5, i.need - i.gap);
        ok = st.insertBuffer(ev2.id, by);
        if (ok) UI.toast('Đã dời “' + ev2.title + '” sau ' + by + "' → " + st.event(ev2.id).start, { kind: 'success', duration: 6000, action: { label: 'Hoàn tác', onClick: function () { st.moveEvent(ev2.id, old2.date, old2.start); } } });
        else UI.toast('Khung sau đó đã kín cho người tham gia — hãy chặn giờ di chuyển hoặc dời tay', { kind: 'warning' });
        break;
      }
      case 'buffer': {
        var r = this.bufferChain(i.kind === 'chain' ? evs : evs.slice(1)), olds = r.olds; ok = r.done > 0;
        UI.toast(ok ? 'Đã chèn đệm cho ' + r.done + '/' + r.total + ' cuộc họp' + (r.done < r.total ? ' — phần còn lại kín lịch người tham gia' : '') : 'Không chèn được đệm — khung sau đã kín cho người tham gia', { kind: ok ? 'success' : 'warning', duration: 6000, action: ok ? { label: 'Hoàn tác', onClick: function () { olds.forEach(function (o) { st.moveEvent(o.id, o.date, o.start); }); } } : undefined });
        break;
      }
      case 'nudge-all': case 'nudge': {
        var n = st.nudge(evs[0].id, me, act === 'nudge-all' ? { all: true } : {}); ok = true;
        UI.toast(n ? 'Đã nhắc ' + n + ' người về “' + evs[0].title + '”' : 'Không còn ai cần nhắc', { kind: n ? 'brand' : 'info' });
        break;
      }
      case 'delegate-day': {
        var has = this.allIssues.some(function (x) { return x.kind === 'delegate' && x.date === i.date; });
        this.busy = false;
        if (!has) { UI.toast('Không có cuộc họp nào uỷ quyền được ' + dmw(i.date) + ' — thử dời họp P3 hoặc rút ngắn còn 30 phút', { kind: 'info' }); return; }
        this.issueFilter = { key: 'meeting', kinds: ['delegate'], date: i.date, label: 'Uỷ quyền' };
        U.qsa('.as-kpi', this.blocks.kpis).forEach(function (t) { var on = t.dataset.kpi === 'meeting'; t.classList.toggle('is-on', on); t.setAttribute('aria-pressed', on ? 'true' : 'false'); });
        this.renderIssues(); return;
      }
      case 'ask-agenda': {
        var ev4 = evs[0], ow = st.staff(ev4.ownerId);
        st.notify({ kind: 'warning', title: 'Yêu cầu agenda: ' + ev4.title, body: U.shortName(st.me().name) + ' đề nghị ' + (ow ? U.shortName(ow.name) : 'chủ trì') + ' bổ sung agenda trước giờ họp.', link: '#/calendar/team/' + ev4.date, eventId: ev4.id });
        UI.toast('Đã gửi yêu cầu agenda tới ' + (ow ? U.shortName(ow.name) : 'chủ trì'), { kind: 'success' }); ok = true; break;
      }
      case 'delegate': {
        if (!i.to) return; var ev5 = evs[0], from = this.staffId, oldIds = ev5.attendeeIds.slice();
        st.delegate(ev5.id, from, i.to.id); ok = true;
        UI.toast('Đã uỷ quyền “' + ev5.title + '” cho ' + U.shortName(i.to.name), { kind: 'success', duration: 6000, action: { label: 'Hoàn tác', onClick: function () { st.updateEvent(ev5.id, { attendeeIds: oldIds, delegatedFrom: undefined }); } } });
        break;
      }
    }
    if (!ok) { this.busy = false; this.flushPending(); return; }
    this.handled[key] = true; this.resolved++;
    this.resolveRow(row);
  };
  /** Chèn đệm 10' cho chuỗi họp: đi từ cuộc cuối về trước; mỗi cuộc dịch tối đa 10'×vị trí nhưng
   *  không quá khoảng còn lại tới sự kiện kế tiếp của người này (tránh tạo cặp sát nhau mới). */
  AssistantView.prototype.bufferChain = function (chain) {
    var st = S(), staff = this.staffId, sorted = U.sortBy(chain, function (e) { return e.start; }), done = 0, olds = [];
    for (var k = sorted.length - 1; k >= 0; k--) {
      var e = st.event(sorted[k].id); if (!e) continue;
      var endM = mins(e.end), want = 10 * (k + 1);
      var nextStart = st.dayAgenda(staff, e.date).filter(function (o) { return o.id !== e.id && o.type !== 'focus' && mins(o.start) >= endM; }).map(function (o) { return mins(o.start); }).sort(function (a, b) { return a - b; })[0];
      var shift = nextStart == null ? want : Math.min(want, nextStart - 10 - endM);
      if (shift < 5) continue;
      var old = { id: e.id, date: e.date, start: mins(e.start) };
      if (st.insertBuffer(e.id, shift)) { done++; olds.push(old); }
    }
    return { done: done, total: sorted.length, olds: olds };
  };
  /** Choreography: tick vẽ → dòng rời (translateX + mờ) → FLIP các dòng còn lại → vẽ lại từ dữ liệu mới. */
  AssistantView.prototype.resolveRow = function (row) {
    var self = this, block = this.blocks.issues;
    if (reduceMotion()) { this.busy = false; this.renderIssues(); this.flushPending(); return; }
    this.busy = true;
    row.classList.add('is-resolving');
    var next = (function () { var rows = U.qsa('.as-issue', block), i = rows.indexOf(row); return rows[i + 1] || rows[i - 1] || null; })();
    var nextKey = next ? next.dataset.key : null;
    this.later(function () { row.classList.add('is-leaving'); }, 420);
    this.later(function () {
      var remaining = U.qsa('.as-issue, .as-issues__ghead, .as-issues__more, .as-issues__foot', block).filter(function (n) { return n !== row; });
      var followers = []; var sib = block.nextElementSibling; while (sib) { followers.push(sib); sib = sib.nextElementSibling; }
      flipY(remaining.concat(followers), function () { var grp = row.closest('.as-issues__group'); row.remove(); if (grp && !grp.querySelector('.as-issue')) grp.remove(); }, 240);
      self.later(function () { self.busy = false; self.renderIssues(); if (nextKey) { var n2 = block.querySelector('.as-issue[data-key="' + nextKey + '"]'); if (n2 && self.focusedIssue() == null) n2.focus({ preventScroll: true }); } self.flushPending(); }, 270);
    }, 640);
  };
  AssistantView.prototype.flushPending = function () { if (this.pendingRerender) { this.pendingRerender = false; this.renderAll(false); } };
  /** "Nhắc tất cả" trên đầu nhóm: nhắc mọi dòng RSVP của nhóm trong một lần, một toast tổng. */
  AssistantView.prototype.nudgeGroup = function (sev) {
    var st = S(), me = st.state.currentUserId, self = this;
    var rows = (this.allIssues || []).filter(function (i) { return i.kind === 'rsvp' && i.severity === sev && !self.handled[i.key]; });
    if (!rows.length) { UI.toast('Không còn ai cần nhắc', { kind: 'info' }); return; }
    var total = 0, evs = 0;
    this.busy = true; // gom các lần store phát sự kiện thành một lần vẽ lại
    try { rows.forEach(function (i) { var n = st.nudge(i.events[0].id, me); if (n) { total += n; evs++; } self.handled[i.key] = true; self.resolved++; }); }
    finally { this.busy = false; this.pendingRerender = false; }
    this.renderAll(false);
    UI.toast(total ? 'Đã nhắc ' + total + ' người xác nhận ở ' + evs + ' sự kiện' : 'Mọi người đã xác nhận rồi', { kind: total ? 'brand' : 'info' });
  };

  /* -------------------------------------------------------------- brief */
  AssistantView.prototype.gapRow = function (gap, need, prev, next) {
    var tone, label, ic = null;
    if (gap < 0) { tone = 'red'; label = 'trùng ' + (-gap) + "'"; ic = 'alert-triangle'; }
    else if (need > 0 && gap < need && prev.type !== 'travel' && next.type !== 'travel') { tone = 'red'; label = 'thiếu ' + need + "' di chuyển"; ic = 'map-pin'; }
    else if (prev.type === 'focus' || next.type === 'focus' || prev.type === 'travel' || next.type === 'travel') { tone = 'neutral'; label = gap ? gap + "' trống" : 'liền kề'; }
    else if (gap < 10) { tone = 'warn'; label = gap ? 'sát nhau · ' + gap + "'" : 'sát nhau'; }
    else if (gap < 30) { tone = 'ok'; label = 'đệm ' + gap + "'"; }
    else { tone = 'neutral'; label = fmtH(gap) + ' trống'; }
    return h`<li class="as-gap" data-tone="${tone}" aria-label="Khoảng cách: ${label}"><i></i><span>${ic ? icon(ic, 11) : ''}${label}</span><i></i></li>`;
  };
  AssistantView.prototype.agendaItem = function (e) {
    var st = S(), me = st.state.currentUserId, canSee = st.canSee(e, me), title = st.displayTitle(e, me), rs = st.rsvpSummary(e), ps = st.prepStatus(e), p = e.projectId ? st.project(e.projectId) : null;
    var prepTone = !ps.total ? '' : ps.open ? (ps.overdue ? 'warn' : 'muted') : 'ok';
    return h`<li class="as-ag${e.type === 'focus' ? ' as-ag--focus' : ''}${e.type === 'travel' ? ' as-ag--travel' : ''}" data-type="${e.type}"${p ? raw(' style="--ev:' + p.color + '"') : ''}>
      <span class="as-ag__time mono tnum">${e.allDay ? 'Cả ngày' : h`${e.start}<small>${e.end}</small>`}</span>
      <div class="as-ag__body">
        <button type="button" class="as-ag__title" data-event-open="${e.id}"><i class="as-ag__bar"></i><span class="truncate">${title}</span>${canSee && e.priority === 1 ? h`<span class="prio" data-p="1">P1</span>` : ''}${canSee && e.priority === 3 ? h`<span class="prio" data-p="3">P3</span>` : ''}</button>
        ${canSee ? h`<div class="as-ag__meta">${e.location ? h`<span class="truncate">${icon('map-pin', 11)}${e.location}</span>` : ''}${e.travelMinutes ? h`<span class="travel-tag">${icon('arrow-right', 11)}~${e.travelMinutes}' đi</span>` : ''}${e.attendeeIds.length > 1 ? h`<span class="rsvp-summary" title="${rs.yes} tham dự · ${rs.pending} chưa phản hồi"><span><i class="rsvp-dot" data-rsvp="yes"></i>${rs.yes}</span>${rs.pending ? h`<span><i class="rsvp-dot" data-rsvp="pending"></i>${rs.pending}</span>` : ''}</span>` : ''}${ps.total ? h`<span class="chip chip--xs${prepTone ? ' chip--' + prepTone : ''}">${icon(ps.open ? 'check-square' : 'check', 11)}<span>Chuẩn bị ${ps.done}/${ps.total}</span></span>` : ''}</div>` : h`<div class="as-ag__meta"><span class="faint">${icon('shield', 11)}Riêng tư</span></div>`}
      </div>
    </li>`;
  };
  AssistantView.prototype.renderBrief = function () {
    if (!this.alive()) return;
    var st = S(), iso = this.briefDate(), block = this.blocks.brief, self = this, s = this.staff();
    var timed = U.sortBy(st.dayAgenda(this.staffId, iso), function (e) { return e.start; }), allDay = st.eventsFor(this.staffId, iso).filter(function (e) { return e.allDay; });
    var hol = st.holidayName(iso), weekend = U.isWeekend(iso), dl = st.dayLoad(this.staffId, iso);
    var meetings = timed.filter(function (e) { return e.type !== 'focus' && e.type !== 'travel'; }).length;
    var rows = [];
    timed.forEach(function (e, k) { if (k) { var prev = timed[k - 1]; rows.push(self.gapRow(mins(e.start) - mins(prev.end), st.travelBetween(prev, e), prev, e)); } rows.push(self.agendaItem(e)); });
    var rel = U.daysBetween(this.today, iso), relLbl = rel === 0 ? 'Hôm nay' : rel === 1 ? 'Ngày mai' : U.weekdayLong(U.fromISO(iso));
    U.render(block, h`
      <div class="card__head as-brief__head"><div><div class="card__eyebrow">Brief · ${this.isExec() ? 'gửi ' + this.subj() + ' tối hôm trước' : 'lịch ngày'}</div><h3 class="card__title">${relLbl} <span class="muted">· ${dmw(iso)}</span></h3></div></div>
      <div class="as-brief__ctl"><span class="as-brief__seg"></span><input type="date" class="input as-brief__date" value="${this.brief.pick}" aria-label="Chọn ngày brief"${this.brief.tab === 'pick' ? '' : raw(' hidden')}></div>
      ${hol || weekend ? h`<p class="as-brief__note faint">${icon('info', 12)}${hol ? 'Nghỉ lễ ' + hol : 'Cuối tuần'} — ${timed.length || allDay.length ? 'vẫn có ' + (timed.length + allDay.length) + ' mục trên lịch' : 'không có lịch'}.</p>` : ''}
      ${allDay.length ? h`<div class="as-brief__allday">${allDay.map(function (e) { var p = e.projectId ? st.project(e.projectId) : null; return h`<button type="button" class="chip chip--btn chip--color" style="--chip:${p ? p.color : 'var(--ev-' + e.type + ')'}" data-event-open="${e.id}"><i class="chip__dot"></i><span>Cả ngày · ${st.displayTitle(e)}</span></button>`; })}</div>` : ''}
      ${rows.length ? h`<ol class="as-agenda" role="list">${rows}</ol>` : h`<div class="empty empty--sm as-brief__empty"><div class="empty__icon">${icon('coffee', 22)}</div><p class="empty__title">Ngày trống${allDay.length ? ' (chỉ có mục cả ngày)' : ''}</p><p class="empty__body">${this.Subj()} có cả ngày cho việc sâu — hoặc là chỗ để xếp cuộc họp quan trọng.</p></div>`}
      <div class="card__foot as-brief__foot">
        <span class="as-brief__sum tnum">${meetings ? h`<b>${meetings}</b> cuộc họp · ${fmtH(dl.meetingMin)} họp` : 'Không có cuộc họp'}${dl.focusMin ? h` · ${fmtH(dl.focusMin)} tập trung` : ''}${dl.lastEnd != null ? h` · kết thúc <b class="mono">${U.minToTime(dl.lastEnd)}</b>` : ''}</span>
        <span class="as-brief__btns"><button type="button" class="btn btn--sm btn--secondary" data-copy-brief="${iso}">${icon('copy', 14)}<span>Sao chép</span></button>${this.isExec() ? h`<button type="button" class="btn btn--sm btn--soft" data-send-brief="${iso}">${icon('send', 14)}<span>Gửi brief</span></button>` : ''}</span>
      </div>`);
    var seg = UI.segmented([{ value: 'today', label: 'Hôm nay' }, { value: 'tomorrow', label: 'Ngày mai' }, { value: 'pick', label: 'Chọn ngày' }], this.brief.tab, function (v) { self.brief.tab = v; U.saveJSON(KEYS.brief, self.brief); self.renderBrief(); if (v === 'pick') { var d = self.blocks.brief.querySelector('.as-brief__date'); if (d) d.focus(); } }, { cls: 'segmented--sm', label: 'Ngày brief' });
    block.querySelector('.as-brief__seg').replaceWith(seg);
  };
  AssistantView.prototype.copyBrief = function (iso) {
    var text = S().briefText(this.staffId, iso), self = this;
    U.copyToClipboard(text).then(function () { UI.toast('Dán vào Zalo cho ' + self.subj() + ' · ' + dmw(iso), { kind: 'success', title: 'Đã sao chép brief' }); }, function () { UI.toast('Trình duyệt chặn sao chép — hãy chọn và copy thủ công', { kind: 'warning' }); });
  };
  AssistantView.prototype.sendBrief = function (iso) {
    var st = S(), text = st.briefText(this.staffId, iso), lines = text.split('\n'), self = this;
    st.notify({ kind: 'brand', title: 'Brief ' + dmw(iso) + ' — ' + U.shortName(this.staff().name), body: lines.slice(1, 4).join(' · ') + (lines.length > 4 ? ' · +' + (lines.length - 4) + ' mục' : ''), link: '#/assistant?staff=' + this.staffId + '&date=' + iso + '&tab=brief' });
    UI.toast('Bản mô phỏng: brief nằm trong Thông báo · thực tế sẽ gửi Zalo/email lúc 19:00', { kind: 'brand', title: 'Đã gửi brief cho ' + self.subj() });
  };

  /* --------------------------------------------------------------- find */
  AssistantView.prototype.findRange = function () {
    var f = this.find, monday = this.weekISO, from = this.today > monday ? this.today : monday;
    var mon = U.fromISO(monday);
    if (f.range === 'next') return { from: U.toISO(U.addDays(mon, 7)), days: 5 };
    if (f.range === '10d') return { from: from, days: 10 };
    var n = 0; for (var d = U.fromISO(from); U.toISO(d) <= U.toISO(U.addDays(mon, 4)); d = U.addDays(d, 1)) if (isWorkday(U.toISO(d))) n++;
    if (!n) return { from: U.toISO(U.addDays(mon, 7)), days: 5, rolled: true };
    return { from: from, days: n };
  };
  AssistantView.prototype.slotTags = function (sl) {
    var st = S(), tags = [], people = this.find.people;
    if (sl.start < 12 * 60) tags.push('Buổi sáng'); else if (sl.start >= 13 * 60 + 30 && sl.start < 15 * 60) tags.push('Đầu chiều');
    var adjacent = people.some(function (id) { return st.dayAgenda(id, sl.date).some(function (e) { return Math.abs(mins(e.end) - sl.start) <= 15 || Math.abs(mins(e.start) - sl.end) <= 15; }); });
    if (!adjacent) tags.push('Không sát họp');
    var remote = people.filter(function (id) { return st.shiftOf(id, sl.date) === 'remote'; }).length;
    tags.push(remote ? remote + ' remote' : 'Mọi người ở VP');
    return tags;
  };
  AssistantView.prototype.renderFind = function () {
    if (!this.alive()) return;
    var st = S(), f = this.find, block = this.blocks.find, self = this;
    var people = f.people.map(st.staff).filter(Boolean);
    U.render(block, h`
      <div class="card__head"><div><div class="card__eyebrow">Tìm giờ họp chung</div><h3 class="card__title">Khung giờ trống</h3></div><span class="faint as-find__hint" data-tip="HBR: họp mặc định 30 phút, ít người, có agenda — kéo dài chỉ khi thật cần">${icon('info', 14)}</span></div>
      <div class="as-find__people" role="group" aria-label="Người tham gia">
        ${people.map(function (p) { return h`<span class="chip chip--person">${raw(UI.avatar(p, { size: 'xs', title: false }))}<span>${U.shortName(p.name)}</span>${people.length > 1 ? h`<button type="button" class="chip__x" data-remove-person="${p.id}" aria-label="Bỏ ${p.name}">${icon('x', 12)}</button>` : ''}</span>`; })}
        <button type="button" class="chip chip--btn" data-add-person aria-haspopup="dialog">${icon('user-plus', 13)}<span>Thêm người</span></button>
      </div>
      <div class="as-find__ctl">
        <label class="as-find__lbl"><span class="eyebrow">Thời lượng</span><span class="as-find__seg" data-seg="dur"></span></label>
        <label class="as-find__lbl"><span class="eyebrow">Khoảng</span><span class="as-find__seg" data-seg="range"></span></label>
      </div>
      <div class="as-find__opts">
        <label class="checkbox"><input type="checkbox" data-opt="avoidFocus"${f.avoidFocus ? raw(' checked') : ''}><span>Tránh khối tập trung</span></label>
        <label class="checkbox"><input type="checkbox" data-opt="buffer"${f.buffer ? raw(' checked') : ''}><span>Đệm 10'</span></label>
      </div>
      <ol class="as-find__results" role="list" aria-live="polite"></ol>`);
    var segDur = UI.segmented([30, 45, 60, 90].map(function (m) { return { value: String(m), label: m + "'" }; }), String(f.dur), function (v) { f.dur = +v; self.saveFind(); self.findDebounced(); }, { cls: 'segmented--sm', label: 'Thời lượng' });
    var segRange = UI.segmented([{ value: 'week', label: 'Tuần này' }, { value: 'next', label: 'Tuần sau' }, { value: '10d', label: '10 ngày' }], f.range, function (v) { f.range = v; self.saveFind(); self.findDebounced(); }, { cls: 'segmented--sm', label: 'Khoảng tìm' });
    block.querySelector('[data-seg="dur"]').replaceWith(segDur); block.querySelector('[data-seg="range"]').replaceWith(segRange);
    this.renderFindResults();
  };
  AssistantView.prototype.renderFindResults = function () {
    if (!this.alive()) return;
    var st = S(), f = this.find, list = this.blocks.find.querySelector('.as-find__results'); if (!list) return;
    var rg = this.findRange(), self = this;
    var slots = st.suggestSlots(f.people, rg.from, rg.days, f.dur, { avoidFocus: f.avoidFocus, buffer: f.buffer ? 10 : 0, limit: 6 });
    this.slots = slots;
    var lo = 55, hi = 115;
    U.render(list, slots.length ? h`${rg.rolled ? h`<li class="as-find__note faint">${icon('info', 12)}Tuần này đã hết ngày làm việc — đang xem tuần sau.</li>` : ''}${slots.map(function (sl, i) {
      var pct = U.clamp((sl.score - lo) / (hi - lo) * 100, 6, 100), tags = self.slotTags(sl);
      return h`<li class="as-slot${i === 0 ? ' is-best' : ''}" data-slot="${i}">
        <div class="as-slot__main">
          <div class="as-slot__top"><span class="chip chip--xs chip--type mono">${dmw(sl.date)}</span><b class="mono tnum as-slot__time">${sl.startLabel} – ${sl.endLabel}</b>${i === 0 ? h`<span class="chip chip--xs chip--blue">Tốt nhất</span>` : ''}</div>
          <span class="as-slot__score" role="img" aria-label="Điểm phù hợp ${Math.round(pct)}%"><i style="width:${pct}%"></i></span>
          <div class="as-slot__tags">${tags.map(function (t) { return h`<span class="tag">${t}</span>`; })}</div>
        </div>
        <div class="as-slot__btns"><button type="button" class="btn btn--sm btn--soft" data-slot-create="${i}">${icon('plus', 14)}<span>Tạo họp</span></button><a class="btn btn--sm btn--ghost" href="#/calendar/team/${sl.date}?people=${f.people.join(',')}">Xem ngày</a></div>
      </li>`;
    })}` : h`<li class="empty empty--sm as-find__empty"><div class="empty__icon">${icon('search', 22)}</div><p class="empty__title">Không có khung ${f.dur}' chung nào</p><p class="empty__body">Thử rút còn 30', bỏ "Tránh khối tập trung" hoặc mở rộng sang 10 ngày.</p></li>`);
  };
  AssistantView.prototype.createFromSlot = function (i) {
    var sl = (this.slots || [])[i]; if (!sl) return;
    var people = this.find.people.slice();
    E().event(null, { date: sl.date, start: sl.startLabel, end: sl.endLabel, attendeeIds: people, priority: 2, title: '', type: 'meeting', notes: 'Agenda:\n1. \n2. \n3. ' });
  };
  /** Popover thêm/bớt người cho phần tìm giờ (tìm không dấu, bấm để bật/tắt). */
  AssistantView.prototype.openAddPerson = function (anchor) {
    var st = S(), self = this;
    var pop = UI.popover(anchor, '<div class="as-pick"><div class="staff-picker__top"><div class="input-icon">' + UI.icon('search', 16) + '<input class="input as-pick__search" type="search" placeholder="Tìm người thêm vào cuộc họp…" aria-label="Tìm nhân sự" autocomplete="off"></div></div><div class="staff-picker__list as-pick__list" role="listbox" aria-multiselectable="true" aria-label="Người tham gia"></div></div>', { placement: 'bottom-start', width: 340, cls: 'popover--as-pick', ariaLabel: 'Thêm người tham gia' });
    var list = pop.el.querySelector('.as-pick__list'), input = pop.el.querySelector('.as-pick__search');
    function render() {
      var q = input.value.trim(), rows = st.state.staff.filter(function (x) { return !q || U.fuzzyMatch(q, x.name + ' ' + x.role + ' ' + (st.team(x.teamId) || {}).name) > 0; });
      var groups = U.groupBy(rows, 'teamId');
      list.innerHTML = st.state.teams.filter(function (t) { return groups[t.id]; }).map(function (t) { return '<div class="staff-picker__group"><div class="staff-picker__gtitle" style="--chip:' + t.color + '"><i class="chip__dot"></i>' + U.escapeHtml(t.name) + '</div>' + groups[t.id].map(function (x) { var on = self.find.people.indexOf(x.id) >= 0; return '<button type="button" class="staff-opt' + (on ? ' is-on' : '') + '" role="option" aria-selected="' + on + '" data-toggle="' + x.id + '">' + UI.avatar(x, { size: 'sm', title: false }) + '<span class="staff-opt__txt"><b>' + U.escapeHtml(x.name) + '</b><small>' + U.escapeHtml(x.role) + '</small></span><span class="staff-opt__check">' + UI.icon('check', 14) + '</span></button>'; }).join('') + '</div>'; }).join('') || '<div class="muted pad">Không tìm thấy nhân sự phù hợp</div>';
    }
    render();
    input.addEventListener('input', U.debounce(render, 80));
    pop.el.addEventListener('click', function (e) {
      var b = e.target.closest('[data-toggle]'); if (!b) return;
      var id = b.dataset.toggle, i = self.find.people.indexOf(id);
      if (i >= 0) { if (self.find.people.length === 1) { UI.toast('Cần ít nhất một người', { kind: 'info' }); return; } self.find.people.splice(i, 1); } else self.find.people.push(id);
      render(); self.renderFind(); self.findDebounced();
    });
    pop.el.addEventListener('keydown', function (e) { var os = U.qsa('.staff-opt', pop.el), i = os.indexOf(document.activeElement); if (e.key === 'ArrowDown') { e.preventDefault(); (os[i + 1] || os[0]).focus(); } if (e.key === 'ArrowUp') { e.preventDefault(); (i > 0 ? os[i - 1] : input).focus(); } });
  };

  /* -------------------------------------------------------------- focus */
  AssistantView.prototype.renderFocus = function () {
    if (!this.alive()) return;
    var st = S(), hw = this.health, block = this.blocks.focus, self = this;
    var pct = U.clamp(hw.focusMin / FOCUS_TARGET * 100, 0, 100);
    var sugg = st.suggestFocusBlocks(this.staffId, this.weekISO, 120); this.focusSugg = sugg;
    var need = Math.max(0, Math.ceil((FOCUS_TARGET - hw.focusMin) / 120));
    U.render(block, h`
      <div class="card__head"><div><div class="card__eyebrow">Việc sâu · mục tiêu 8g / tuần</div><h3 class="card__title">Bảo vệ thời gian tập trung</h3></div><span class="faint" data-tip="Microsoft/Clockwise: chỉ ~27% giờ làm là khối 2g+ không bị ngắt; giữ 1 khối 2g/ngày giúp việc phức tạp nhanh hơn ~47%">${icon('info', 14)}</span></div>
      <div class="as-focus__top">
        <div class="as-focus__meter">
          <div class="as-focus__nums"><b class="tnum">${fmtH(hw.focusMin)}</b><small>/ 8g đã chặn · trống dài nhất ${fmtH(hw.longestFreeGap)}</small></div>
          ${raw(UI.progress(pct, { size: 'lg' }).replace('class="progress', 'class="progress progress--grad'))}
          <p class="as-focus__fact">Chỉ ~<b>27%</b> giờ làm là khối 2g+ không bị ngắt. Giữ <b>1 khối 2g mỗi ngày</b> giúp việc phức tạp xong nhanh hơn ~47% — ${this.subj()} ${need ? h`còn thiếu <b>${need} khối</b> tuần này.` : 'đã đủ mục tiêu tuần này.'}</p>
        </div>
        <div>
          <div class="as-days" role="img" aria-label="Phút họp và tập trung theo ngày trong tuần">
            ${hw.days.map(function (d) {
              var m = d.load.meetingMin, f = d.load.focusMin, lvl = m > 8 * 60 ? 'over' : m > 6 * 60 ? 'warn' : 'ok', off = !isWorkday(d.iso);
              return h`<div class="as-day${d.iso === self.today ? ' is-today' : ''}${off ? ' is-off' : ''}" data-level="${lvl}" data-tip="${dmw(d.iso)} · họp ${fmtH(m)} · tập trung ${fmtH(f)}${off ? ' · nghỉ' : ''}"><span class="as-day__val">${m || f ? fmtH(m) : '—'}</span><div class="as-day__bars"><i class="as-day__bar as-day__bar--meet" style="height:${U.clamp(m / 540 * 100, m ? 3 : 0, 100)}%"></i><i class="as-day__bar as-day__bar--focus" style="height:${U.clamp(f / 540 * 100, f ? 3 : 0, 100)}%"></i></div><span class="as-day__lbl"><b>${U.weekdayShort(U.fromISO(d.iso))}</b><span>${U.fmtDate(d.iso, 'dm')}</span></span></div>`;
            })}
          </div>
          <div class="as-days__legend"><span><i></i>Họp</span><span><i class="is-focus"></i>Tập trung</span><span><i class="is-line"></i>Ngưỡng 6g/ngày</span></div>
        </div>
      </div>
      <div class="as-focus__sugg">
        <div class="between"><div class="sec-title" style="margin:0">Khối 2g còn trống <span class="muted">· gợi ý theo khoảng trống lớn nhất</span></div></div>
        ${sugg.length ? h`<div class="as-focus__list" role="list">${sugg.map(function (s, i) { return h`<div class="as-fb" role="listitem" data-fb="${i}"><span class="as-fb__when">${icon('target', 14)}<span class="chip chip--xs chip--type mono">${dmw(s.date)}</span><b>${s.startLabel} – ${s.endLabel}</b>${s.start < 12 * 60 ? h`<span class="tag">Buổi sáng</span>` : ''}</span><span class="as-fb__len">${fmtH(s.minutes)}</span><button type="button" class="btn btn--sm btn--soft" data-fb-add="${i}">${icon('shield', 14)}<span>Chặn</span></button></div>`; })}</div>`
          : h`<p class="muted t-body-sm" style="margin-top:8px">${this.weekISO < weekOf(this.today) ? 'Tuần đã qua — không gợi ý thêm.' : 'Không còn khoảng trống 2g nào trong tuần — cân nhắc dời họp P3 hoặc gộp họp.'}</p>`}
      </div>`);
  };
  AssistantView.prototype.addFocus = function (i, btn) {
    var st = S(), sl = (this.focusSugg || [])[i], self = this; if (!sl) return;
    var row = btn.closest('.as-fb');
    var commit = function () { var ev = st.addFocusBlock(self.staffId, sl.date, sl.start, 120, 'Tập trung — việc quan trọng'); UI.toast('Đã chặn ' + dmw(sl.date) + ' ' + sl.startLabel + ' – ' + sl.endLabel + ' cho việc quan trọng', { kind: 'success', duration: 6000, action: { label: 'Hoàn tác', onClick: function () { st.deleteEvent(ev.id); } } }); };
    if (reduceMotion() || !row) { commit(); return; }
    row.classList.add('is-leaving'); btn.disabled = true;
    this.later(commit, 200);
  };

  /* ------------------------------------------------------------- struct */
  AssistantView.prototype.renderStruct = function (first) {
    if (!this.alive()) return;
    var st = S(), hw = this.health, block = this.blocks.struct, self = this;
    var byP = hw.byPriority, totP = (byP[1] || 0) + (byP[2] || 0) + (byP[3] || 0);
    var P = [{ id: 1, label: 'P1 Bắt buộc', c: 'var(--fg-primary)' }, { id: 2, label: 'P2 Quan trọng', c: 'var(--fg-secondary)' }, { id: 3, label: 'P3 Có thể uỷ quyền', c: 'var(--fg-disabled)' }];
    var cal = CAL_KIND.map(function (k) { return Object.assign({ min: hw.byCalendar[k.id] || 0 }, k); }).filter(function (k) { return k.min > 0; });
    var totC = U.sum(cal, function (k) { return k.min; });
    var weeks = [-3, -2, -1, 0].map(function (n) { var w = U.toISO(U.addDays(U.fromISO(self.weekISO), 7 * n)); return { iso: w, h: Math.round(st.weekHealth(self.staffId, w).meetingMin / 60 * 10) / 10 }; });
    var max = Math.max(1, Math.max.apply(null, weeks.map(function (w) { return w.h; })));
    var W = 320, H = 80, x0 = 28, x1 = W - 28, yTop = 18, yBot = 56;
    var pts = weeks.map(function (w, i) { return { x: x0 + i * (x1 - x0) / 3, y: yBot - (w.h / max) * (yBot - yTop), w: w }; });
    var line = pts.map(function (p) { return p.x.toFixed(1) + ',' + p.y.toFixed(1); }).join(' ');
    var area = 'M' + pts[0].x + ',' + yBot + ' L' + line.split(' ').map(function (s) { return s; }).join(' L') + ' L' + pts[3].x + ',' + yBot + ' Z';
    var diff = Math.round((weeks[3].h - weeks[2].h) * 10) / 10, sign = diff > 0 ? '+' : diff < 0 ? '−' : '', dIcon = diff > 0 ? 'trending-up' : diff < 0 ? 'arrow-down' : 'minus';
    function bar(title, sub, segs, tot) { return h`<div class="as-bar"><div class="as-bar__head"><b>${title}</b><small>${sub}</small></div><div class="as-bar__track" role="img" aria-label="${title}: ${segs.map(function (s) { return s.label + ' ' + fmtH(s.min); }).join(', ')}">${segs.map(function (s) { return h`<i style="--c:${s.c};width:${tot ? (s.min / tot * 100).toFixed(1) : 0}%" title="${s.label} · ${fmtH(s.min)}"></i>`; })}</div><div class="as-legend">${segs.map(function (s) { return h`<span><i style="--c:${s.c}"></i>${s.label} <b>${fmtH(s.min)}</b></span>`; })}</div></div>`; }
    U.render(block, h`
      <div class="card__head"><div><div class="card__eyebrow">Cơ cấu tuần · ${weekLabel(this.weekISO)}</div><h3 class="card__title">Thời gian đi đâu</h3></div><span class="faint" data-tip="Phân bổ giờ họp theo mức ưu tiên và lớp lịch · Mã màu theo hạng mục là thực hành EA phổ biến">${icon('pie', 14)}</span></div>
      <div class="as-struct__grid">
        <div class="as-bars">
          ${bar('Theo mức ưu tiên', fmtH(totP) + ' họp', P.map(function (p) { return { label: p.label, min: byP[p.id] || 0, c: p.c }; }).filter(function (s) { return s.min > 0; }), totP)}
          ${bar('Theo lớp lịch', cal.length + ' lớp', cal.map(function (k) { return { label: k.label, min: k.min, c: k.color }; }), totC)}
          ${!totP ? h`<p class="muted t-body-sm">Tuần này chưa có cuộc họp nào.</p>` : ''}
        </div>
        <div class="as-spark">
          <div class="as-bar__head"><b>4 tuần gần đây</b><small>giờ họp / tuần</small></div>
          <svg class="as-spark__svg" viewBox="0 0 ${W} ${H}" preserveAspectRatio="xMidYMid meet" role="img" aria-label="Giờ họp 4 tuần: ${weeks.map(function (w) { return 'Tuần ' + U.isoWeek(U.fromISO(w.iso)) + ' ' + fmtNum(w.h) + 'g'; }).join(', ')}">
            <path class="as-spark__area" d="${area}"/>
            <polyline class="as-spark__line" points="${line}"/>
            ${pts.map(function (p, i) { return h`<circle class="as-spark__dot${i === 3 ? ' is-now' : ''}" cx="${p.x.toFixed(1)}" cy="${p.y.toFixed(1)}" r="3.5"/><text class="as-spark__val${i === 3 ? ' is-now' : ''}" x="${p.x.toFixed(1)}" y="${(p.y - 9).toFixed(1)}" text-anchor="middle">${fmtNum(p.w.h)}g</text><text class="as-spark__lbl" x="${p.x.toFixed(1)}" y="${H - 6}" text-anchor="middle">T${U.isoWeek(U.fromISO(p.w.iso))}${i === 3 ? ' ·' : ''}</text>`; })}
          </svg>
          <p class="as-spark__cap">${icon(dIcon, 14)}<span>${diff ? h`<b>${sign}${fmtNum(Math.abs(diff))}g</b> so với tuần trước` : 'Bằng tuần trước'} · ${hw.external ? h`<b>${hw.external}</b> họp ngoài văn phòng` : 'không có họp ngoài'}</span></p>
        </div>
      </div>`);
  };

  /* --------------------------------------------------------- interactions */
  AssistantView.prototype.bind = function () {
    var self = this, c = this.container;
    var on = function (evt, sel, fn) { self.unbinders.push(U.delegate(c, evt, sel, fn)); };
    on('click', '[data-nav]', function (e, el) { var n = el.dataset.nav; if (n === 'prev') self.shiftWeek(-1); else if (n === 'next') self.shiftWeek(1); else self.goTo({ date: self.today }); });
    on('click', '[data-person]', function (e, el) { self.openPerson(el); });
    on('click', '[data-copy-brief]', function (e, el) { self.copyBrief(el.dataset.copyBrief); });
    on('click', '[data-send-brief]', function (e, el) { self.sendBrief(el.dataset.sendBrief); });
    on('click', '[data-kpi]', function (e, el) { self.setKpiFilter(el.dataset.kpi); });
    on('click', '[data-kpi-clear]', function () { self.issueFilter = null; U.qsa('.as-kpi', self.blocks.kpis).forEach(function (t) { t.classList.remove('is-on'); t.setAttribute('aria-pressed', 'false'); }); self.renderIssues(); });
    on('click', '.as-issue [data-act]', function (e, el) { var row = el.closest('.as-issue'); if (!row || row.classList.contains('is-resolving')) return; self.doAction(row, el.dataset.act, el); });
    on('click', '[data-more]', function (e, el) { var sev = el.dataset.more; self.expanded[sev] = !self.expanded[sev]; self.renderIssues(); var again = self.blocks.issues.querySelector('[data-more="' + sev + '"]'); if (again) again.focus({ preventScroll: true }); });
    on('click', '[data-nudge-group]', function (e, el) { self.nudgeGroup(+el.dataset.nudgeGroup); });
    on('keydown', '.as-issue', function (e, el) {
      if (e.target !== el || e.metaKey || e.ctrlKey || e.altKey) return;
      if (e.key === 'ArrowDown' || e.key === 'ArrowUp') { e.preventDefault(); var rows = U.qsa('.as-issue', self.blocks.issues), i = rows.indexOf(el), n = rows[i + (e.key === 'ArrowDown' ? 1 : -1)]; if (n) { n.focus(); n.scrollIntoView({ block: 'nearest' }); } }
      else if (e.key === 'Enter') { e.preventDefault(); var b = el.querySelector('[data-act="open"]') || el.querySelector('.ev-pill'); if (b) b.click(); }
    });
    on('click', '[data-event-open]', function (e, el) { e.preventDefault(); E().eventDetail(el.dataset.eventOpen); });
    on('change', '.as-brief__date', function (e, el) { if (!validISO(el.value)) return; self.brief.pick = el.value; self.brief.tab = 'pick'; U.saveJSON(KEYS.brief, self.brief); self.renderBrief(); });
    on('click', '[data-remove-person]', function (e, el) { var i = self.find.people.indexOf(el.dataset.removePerson); if (i >= 0 && self.find.people.length > 1) { self.find.people.splice(i, 1); self.renderFind(); } });
    on('click', '[data-add-person]', function (e, el) { self.openAddPerson(el); });
    on('change', '[data-opt]', function (e, el) { self.find[el.dataset.opt] = el.checked; self.saveFind(); self.findDebounced(); });
    on('click', '[data-slot-create]', function (e, el) { self.createFromSlot(+el.dataset.slotCreate); });
    on('click', '[data-fb-add]', function (e, el) { self.addFocus(+el.dataset.fbAdd, el); });
    this.findDebounced = U.debounce(function () { self.renderFindResults(); }, 120);
  };

  /* -------------------------------------------------------- store events */
  AssistantView.prototype.onStore = function (meta) {
    if (!this.alive()) return;
    var t = (meta && meta.type) || '';
    if (!/^(event|shift|user|reset|staff)/.test(t)) return;
    if (t === 'user' || t === 'reset') { this.handled = {}; this.readRoute(R().current || { query: {} }); this.find.people = U.uniq([this.staffId, S().state.currentUserId]); }
    if (this.busy) { this.pendingRerender = true; return; }
    this.renderAll(false);
  };

  /* ------------------------------------------------------------ lifecycle */
  AssistantView.prototype.update = function (route) {
    var prevKey = this.key(), prevStaff = this.staffId, prevTab = this.tab;
    this.readRoute(route);
    if (this.key() === prevKey) { this.setTitle(); return; }
    if (this.staffId !== prevStaff) { this.handled = {}; this.resolved = 0; this.issueFilter = null; this.expanded = {}; this.find.people = U.uniq([this.staffId, S().state.currentUserId]); }
    this.renderAll(false);
    if (this.tab !== prevTab && this.tab !== 'issues') { var b = this.blocks[this.tab]; if (b) b.scrollIntoView({ block: 'start', behavior: reduceMotion() ? 'auto' : 'smooth' }); }
  };
  AssistantView.prototype.destroy = function () {
    this.destroyed = true;
    if (this.unsub) this.unsub();
    (this.unregisterKeys || []).forEach(function (f) { f && f(); });
    this.unbinders.forEach(function (f) { f && f(); });
    this.timers.forEach(function (t) { clearTimeout(t); });
    document.removeEventListener('z15:today', this.onToday);
    UI.palette.unregister('assistant:brief');
  };

  Z15.views.assistant = {
    title: 'Điều phối',
    render: function (container, route) { return new AssistantView(container, route); }
  };
})(window);
