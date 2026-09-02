/* =====================================================================
   Z15 Miracle · Lịch làm việc — views/staff.js
   "Đội ngũ": danh bạ (lưới / bảng) + Nhịp đội (heatmap người × 14 ngày).
   Route: #/staff?view=grid|table|pulse&team=&q=&status=&loc=&skill=
   ===================================================================== */
(function (global) {
  'use strict';
  var Z15 = global.Z15; Z15.views = Z15.views || {};
  var U = Z15.utils, UI = Z15.ui, h = U.html, raw = U.raw;
  var S = function () { return Z15.store; };
  var E = function () { return Z15.editors; };

  var KEYS = { view: 'z15.ui.staff.view', sort: 'z15.ui.staff.sort' };
  var VIEWS = ['grid', 'table', 'pulse'];
  var VIEW_ITEMS = [{ value: 'grid', label: 'Lưới', icon: 'layout' }, { value: 'table', label: 'Bảng', icon: 'list' }, { value: 'pulse', label: 'Nhịp đội', icon: 'activity' }];
  var STATUSES = ['available', 'busy', 'remote', 'onsite', 'off'];
  var LOCS = [{ id: 'HN', label: 'Hà Nội' }, { id: 'HCM', label: 'TP. HCM' }];
  var SORTS = [{ id: 'name', label: 'Tên A–Z', dir: 'asc' }, { id: 'team', label: 'Team', dir: 'asc' }, { id: 'load', label: 'Tải công việc', dir: 'desc' }, { id: 'joined', label: 'Mới gia nhập', dir: 'desc' }];
  var DEFAULT_DIR = { name: 'asc', role: 'asc', team: 'asc', status: 'asc', shift: 'asc', hours: 'desc', load: 'desc', joined: 'desc' };
  var SHIFT_ORDER = ['full', 'morning', 'afternoon', 'ot', 'onsite', 'remote', 'leave', 'off'];
  var MEETING_TYPES = { meeting: 1, review: 1, pitch: 1, training: 1 };
  var OFFICE = { start: 9 * 60, end: 18 * 60 };
  var OVER_WEEK_MIN = 48 * 60;
  var LEVEL_LABELS = ['Nghỉ', '≤ 5g', '≤ 8g', '≤ 9,5g', '≤ 10g', '> 10g'];

  /* ------------------------------------------------------------ helpers */
  function reduceMotion() { return U.prefersReducedMotion() || document.body.classList.contains('reduce-motion'); }
  function icon(name, size) { return raw(UI.icon(name, size)); }
  function isWorkday(iso) { return !U.isWeekend(iso) && !S().holidayName(iso); }
  function nextWorkday(iso) { var d = U.addDays(U.fromISO(iso), 1); for (var i = 0; i < 30 && !isWorkday(U.toISO(d)); i++) d = U.addDays(d, 1); return U.toISO(d); }
  function parseHours(str) { var m = /(\d{2}:\d{2})\s*[–-]\s*(\d{2}:\d{2})/.exec(str || ''); return m ? { start: m[1], end: m[2] } : null; }
  function fmtNum(v, dec) { return Number(v).toLocaleString('vi-VN', { minimumFractionDigits: 0, maximumFractionDigits: dec == null ? 1 : dec }); }
  function fmtH(min) { return fmtNum(Math.round(min / 6) / 10) + 'g'; }
  function dmw(iso) { return U.fmtDate(iso, 'shortWeekday'); }
  function locLabel(loc) { return loc === 'HCM' ? 'TP. HCM' : 'Hà Nội'; }
  function normalizeQ(q) { return String(q || '').replace(/\s+/g, ' ').trim().slice(0, 60); }

  /** Khung giờ làm thực tế của một người trong ngày (on-site lấy theo lịch quay). */
  function shiftWindow(staffId, iso, type, timedEvents) {
    var t = S().shiftType(type), w = parseHours(t.hours);
    if (type === 'onsite') {
      var shoot = (timedEvents || []).filter(function (e) { return e.type === 'shoot'; })[0];
      if (shoot) return { s: U.timeToMin(shoot.start), e: U.timeToMin(shoot.end), shoot: shoot };
      return { s: 8 * 60, e: 17 * 60 };
    }
    if (w) return { s: U.timeToMin(w.start), e: U.timeToMin(w.end) };
    return { s: OFFICE.start, e: OFFICE.end };
  }
  function levelOf(min) { if (min <= 0) return 0; if (min <= 300) return 1; if (min <= 480) return 2; if (min <= 570) return 3; if (min <= 600) return 4; return 5; }
  /** Tải theo ngày: phút ca + phút sự kiện nằm ngoài ca. */
  function dayCell(staffId, iso) {
    var st = S(), type = st.shiftOf(staffId, iso), t = st.shiftType(type), evs = st.eventsFor(staffId, iso);
    var timed = evs.filter(function (e) { return !e.allDay && U.timeToMin(e.end) > U.timeToMin(e.start); });
    var cell = { iso: iso, type: type, t: t, evCount: timed.length, meetings: timed.filter(function (e) { return MEETING_TYPES[e.type]; }).length, shiftMin: 0, outsideMin: 0, totalMin: 0, level: 0, pct: 0, working: false };
    if (type === 'off' || type === 'leave') return cell;
    var w = shiftWindow(staffId, iso, type, timed);
    cell.working = true; cell.shiftMin = w.shoot ? (w.e - w.s) : t.minutes; // ca chuẩn theo loại ca; ngày quay tính theo lịch quay thực tế
    timed.forEach(function (e) {
      if (w.shoot && e.id === w.shoot.id) return;
      var s = U.timeToMin(e.start), en = U.timeToMin(e.end), ov = Math.max(0, Math.min(en, w.e) - Math.max(s, w.s));
      cell.outsideMin += (en - s) - ov;
    });
    cell.totalMin = cell.shiftMin + cell.outsideMin;
    cell.pct = Math.round(cell.totalMin / 480 * 100);
    cell.level = levelOf(cell.totalMin);
    return cell;
  }
  function cellTip(staff, cell) {
    var st = S(), d = U.fromISO(cell.iso), when = U.weekdayShort(d) + ' ' + U.fmtDate(d, 'dm'), who = U.shortName(staff.name);
    if (!cell.working) {
      var hol = st.holidayName(cell.iso);
      var why = cell.type === 'leave' ? 'Nghỉ phép' : hol ? 'Nghỉ lễ ' + hol : U.isWeekend(cell.iso) ? 'Cuối tuần' : 'Không xếp ca';
      return who + ' · ' + when + ' · ' + why + (cell.evCount ? ' · ' + cell.evCount + ' sự kiện' : '');
    }
    var evLabel = cell.evCount ? cell.evCount + ' ' + (cell.meetings === cell.evCount ? 'họp' : 'sự kiện') : '';
    var parts = cell.t.label + ' ' + fmtH(cell.shiftMin);
    if (cell.evCount) parts += cell.outsideMin ? ' + ' + evLabel + ' ' + fmtH(cell.outsideMin) + ' ngoài ca' : ' · ' + evLabel + ' trong ca';
    return who + ' · ' + when + ' · ' + parts + ' = ' + fmtH(cell.totalMin) + ' · ' + cell.pct + '%';
  }
  function birthdayIn(staff, todayISO, within) {
    if (!staff.birthday) return null;
    var y = +todayISO.slice(0, 4), cand = y + '-' + staff.birthday; if (cand < todayISO) cand = (y + 1) + '-' + staff.birthday;
    var diff = U.daysBetween(todayISO, cand);
    return diff >= 0 && diff <= (within || 7) ? { iso: cand, diff: diff } : null;
  }
  function topSkills(staff, n) {
    var c = {}; staff.forEach(function (s) { (s.skills || []).forEach(function (k) { c[k] = (c[k] || 0) + 1; }); });
    return Object.keys(c).sort(function (a, b) { return c[b] - c[a] || a.localeCompare(b, 'vi'); }).slice(0, n || 10);
  }
  function nextUpText(staffId, todayISO) {
    var ev = S().upcomingFor(staffId, 1)[0];
    if (!ev) return { text: 'Không có lịch', empty: true };
    var time = ev.allDay ? 'Cả ngày' : ev.start;
    if (ev.date === todayISO) return { text: 'Tiếp theo: ' + ev.title + ' · ' + time, id: ev.id };
    return { text: 'Tiếp theo: ' + U.fmtRelativeDay(ev.date) + ' · ' + ev.title + ' ' + time, id: ev.id };
  }

  /* ----------------------------------------------------------------- view */
  function StaffView(container, route) {
    var self = this;
    this.container = container;
    this.unbinders = []; this.timers = []; this.pulseIO = null;
    this.todayISO = U.todayISO();
    this.focusISO = isWorkday(this.todayISO) ? this.todayISO : nextWorkday(this.todayISO);
    var sort = U.loadJSON(KEYS.sort, null);
    this.sort = sort && DEFAULT_DIR[sort.key] ? { key: sort.key, dir: sort.dir === 'desc' ? 'desc' : 'asc' } : { key: 'name', dir: 'asc' };
    this.slotTouched = false; this.tableHi = -1;
    this.readRoute(route);
    this.slot = this.defaultSlot();
    this.build();
    this.renderTeams(); this.renderFree(); this.renderFilters(); this.renderResults(true, false);
    this.bind();
    this.setTitle();
    this.unsub = S().subscribe(function (state, meta) { self.onStore(meta); });
    this.unregisterKeys = [
      UI.shortcuts.register('1', function () { self.setView('grid'); }, 'Xem dạng lưới', 'Đội ngũ'),
      UI.shortcuts.register('2', function () { self.setView('table'); }, 'Xem dạng bảng', 'Đội ngũ'),
      UI.shortcuts.register('3', function () { self.setView('pulse'); }, 'Xem Nhịp đội', 'Đội ngũ'),
      UI.shortcuts.register('f', function () { var i = self.els.search; if (i) { i.focus(); i.select(); } }, 'Tìm trong đội ngũ', 'Đội ngũ')
    ];
    UI.palette.register({ id: 'staff:pulse', label: 'Mở Nhịp đội (tải công việc 14 ngày)', icon: 'activity', section: 'Đội ngũ', keywords: 'nhip doi heatmap tai cong viec workload', run: function () { Z15.router.go('staff', { view: 'pulse' }); } });
    this.timers.push(setInterval(function () { self.tick(); }, 60000));
  }

  /* ---------------------------------------------------------- route / state */
  StaffView.prototype.readRoute = function (route) {
    var q = (route && route.query) || {}, st = S();
    // ?date=YYYY-MM-DD: xem "hôm nay" như một ngày khác (dùng để kiểm thử ngày thường / ngày lễ)
    this.dateOverride = /^\d{4}-\d{2}-\d{2}$/.test(q.date || '') ? q.date : '';
    var base = this.dateOverride || U.todayISO();
    if (base !== this.todayISO) { this.todayISO = base; this.focusISO = isWorkday(base) ? base : nextWorkday(base); if (!this.slotTouched) this.slot = this.defaultSlot(); }
    var saved = U.loadJSON(KEYS.view, 'grid');
    var view = VIEWS.indexOf(q.view) >= 0 ? q.view : (VIEWS.indexOf(saved) >= 0 ? saved : 'grid');
    if (q.view && VIEWS.indexOf(q.view) >= 0) U.saveJSON(KEYS.view, view);
    var skills = topSkills(st.state.staff, 10);
    this.F = {
      view: view,
      team: q.team && st.team(q.team) ? q.team : '',
      q: normalizeQ(q.q),
      status: STATUSES.indexOf(q.status) >= 0 ? q.status : '',
      loc: (q.loc === 'HN' || q.loc === 'HCM') ? q.loc : '',
      skill: q.skill && skills.indexOf(q.skill) >= 0 ? q.skill : ''
    };
    this.skills = skills;
  };
  StaffView.prototype.key = function () { return JSON.stringify(this.F) + '|' + this.todayISO; };
  StaffView.prototype.hasFilter = function () { var F = this.F; return !!(F.team || F.q || F.status || F.loc || F.skill); };
  StaffView.prototype.query = function () { var F = this.F, q = { view: F.view }; ['team', 'q', 'status', 'loc', 'skill'].forEach(function (k) { if (F[k]) q[k] = F[k]; }); if (this.dateOverride) q.date = this.dateOverride; return q; };
  StaffView.prototype.syncURL = function (push) {
    var q = this.query(), qs = Object.keys(q).map(function (k) { return encodeURIComponent(k) + '=' + encodeURIComponent(q[k]); }).join('&');
    var hash = '#/staff' + (qs ? '?' + qs : '');
    if (location.hash === hash) return;
    if (push) { location.hash = hash; return; }
    try { history.replaceState(null, '', hash); if (Z15.router && Z15.router.parse) Z15.router.current = Z15.router.parse(hash); }
    catch (e) { location.hash = hash; }
  };
  StaffView.prototype.setTitle = function () {
    var st = S(), staff = st.state.staff, teams = st.state.teams, hol = st.holidayName(this.todayISO), sub;
    if (hol) sub = 'Nghỉ lễ ' + hol + ' · làm lại ' + dmw(this.focusISO);
    else if (U.isWeekend(this.todayISO)) sub = 'Cuối tuần · làm lại ' + dmw(this.focusISO);
    else { var ds = st.dayStats(this.todayISO); sub = staff.length + ' người · ' + teams.length + ' team · hôm nay ' + ds.onDuty + ' đang làm' + (ds.remote ? ', ' + ds.remote + ' remote' : '') + (ds.leave ? ', ' + ds.leave + ' nghỉ phép' : ''); }
    Z15.app.setTitle('Đội ngũ', sub);
  };
  StaffView.prototype.defaultSlot = function () {
    var real = U.todayISO(), now = U.nowMinutes();
    if (this.dateOverride && this.dateOverride !== real) return { iso: isWorkday(this.dateOverride) ? this.dateOverride : nextWorkday(this.dateOverride), time: '09:00' };
    if (isWorkday(real) && now < OFFICE.end - 30) return { iso: real, time: U.minToTime(Math.max(OFFICE.start, Math.ceil(now / 30) * 30)) };
    return { iso: nextWorkday(real), time: '09:00' };
  };

  /* ----------------------------------------------------------------- shell */
  StaffView.prototype.build = function () {
    U.render(this.container, h`
      <div class="st">
        <section class="st-teams reveal" style="--i:0" aria-label="Các team" data-block="teams"></section>
        <section class="card st-free reveal" style="--i:1" aria-label="Ai đang rảnh" data-block="free"></section>
        <section class="card st-bar reveal" style="--i:2" aria-label="Bộ lọc" data-block="bar"></section>
        <section class="st-results" data-block="results" data-view="${this.F.view}"></section>
        <div class="st-tip" role="tooltip" aria-hidden="true"></div>
      </div>`);
    this.els = {
      teams: this.container.querySelector('[data-block="teams"]'), free: this.container.querySelector('[data-block="free"]'),
      bar: this.container.querySelector('[data-block="bar"]'), results: this.container.querySelector('[data-block="results"]'),
      tip: this.container.querySelector('.st-tip')
    };
  };

  /* ---------------------------------------------------------- 1. team strip */
  StaffView.prototype.teamStats = function (teamId, iso) {
    var st = S(), members = st.staffByTeam(teamId), out = { n: members.length, vp: 0, remote: 0, onsite: 0, off: 0, leave: 0, onDuty: 0 };
    members.forEach(function (s) {
      var t = st.shiftOf(s.id, iso);
      if (t === 'leave') out.leave++; else if (t === 'off') out.off++; else { out.onDuty++; if (t === 'remote') out.remote++; else if (t === 'onsite') out.onsite++; else out.vp++; }
    });
    return out;
  };
  StaffView.prototype.renderTeams = function () {
    var st = S(), self = this, iso = this.focusISO, isToday = iso === this.todayISO, hol = st.holidayName(this.todayISO);
    var lead = isToday ? 'hôm nay' : dmw(iso);
    U.render(this.els.teams, h`${st.state.teams.map(function (t) {
      var x = self.teamStats(t.id, iso), parts = [];
      if (x.vp) parts.push(h`<span class="st-team__part"><b>${x.vp}</b> tại VP</span>`); if (x.remote) parts.push(h`<span class="st-team__part"><b>${x.remote}</b> remote</span>`); if (x.onsite) parts.push(h`<span class="st-team__part"><b>${x.onsite}</b> on-site</span>`);
      var rest = x.leave + x.off; if (rest) parts.push(h`<span class="st-team__part"><b>${rest}</b> nghỉ</span>`);
      var today = parts.length ? parts.map(function (p, i) { return i ? h`<span class="st-team__sep"> · </span>${p}` : p; }) : [h`cả team nghỉ`];
      var pct = x.n ? Math.round(x.onDuty / x.n * 100) : 0, on = self.F.team === t.id;
      var label = t.name + ' · ' + x.n + ' người · ' + lead + ': ' + x.onDuty + ' đang làm' + (on ? ' · đang lọc' : '');
      return h`<button type="button" class="st-team${on ? ' is-active' : ''}" data-team-tile="${t.id}" style="--team:${t.color}" aria-pressed="${on ? 'true' : 'false'}" aria-label="${label}" title="${t.desc}">
        <span class="st-team__head"><i class="st-team__dot"></i><span class="st-team__name">${t.name}</span><span class="st-team__n tnum">${x.n}</span></span>
        <span class="st-team__today"><span class="st-team__lead">${lead}:</span> ${today}</span>
        <span class="st-team__bar" aria-hidden="true"><i style="width:${pct}%"></i></span>
      </button>`;
    })}`);
    this.els.teams.classList.toggle('is-holiday', !!hol && !isToday);
  };

  /* --------------------------------------------------------- 2. ai đang rảnh */
  StaffView.prototype.freeAt = function (iso, time) {
    var st = S(), t = U.timeToMin(time), list = [], order = {};
    st.state.teams.forEach(function (x, i) { order[x.id] = i; });
    st.state.staff.forEach(function (s) {
      var type = st.shiftOf(s.id, iso); if (type === 'off' || type === 'leave') return;
      var evs = st.eventsFor(s.id, iso), timed = evs.filter(function (e) { return !e.allDay; });
      var w = shiftWindow(s.id, iso, type, timed);
      if (t < w.s || t >= w.e) return;
      var busy = evs.some(function (e) { return e.allDay || (U.timeToMin(e.start) < t + 60 && U.timeToMin(e.end) > t); });
      if (!busy) list.push({ s: s, type: type });
    });
    return U.sortBy(list, function (x) { return U.pad(order[x.s.teamId]) + U.normalizeVN(U.firstName(x.s.name)); });
  };
  StaffView.prototype.renderFree = function () {
    var slot = this.slot, st = S();
    U.render(this.els.free, h`
      <div class="st-free__row">
        <div class="st-free__title">${icon('sparkles', 16)}<h3 class="t-h3">Ai đang rảnh?</h3></div>
        <div class="st-free__ctl">
          <label class="st-free__lbl" for="stFreeDate">rảnh vào</label>
          <input class="input st-free__date" id="stFreeDate" type="date" value="${slot.iso}" aria-label="Ngày">
          <input class="input st-free__time" id="stFreeTime" type="time" step="1800" value="${slot.time}" aria-label="Giờ">
          <span class="st-free__dur faint">trong 60 phút</span>
        </div>
        <span class="st-free__count" aria-live="polite"></span>
      </div>
      <div class="st-free__list" role="list"></div>`);
    this.renderFreeList();
  };
  StaffView.prototype.renderFreeList = function () {
    var st = S(), slot = this.slot, list = this.els.free.querySelector('.st-free__list'), count = this.els.free.querySelector('.st-free__count');
    if (!/^\d{4}-\d{2}-\d{2}$/.test(slot.iso) || !/^\d{2}:\d{2}$/.test(slot.time)) { list.innerHTML = ''; count.textContent = ''; return; }
    var free = this.freeAt(slot.iso, slot.time), hol = st.holidayName(slot.iso), when = dmw(slot.iso) + ' ' + slot.time;
    var t = U.timeToMin(slot.time), outside = t < OFFICE.start || t >= OFFICE.end;
    count.innerHTML = h`<b class="tnum">${free.length}</b> người rảnh · ${when}${outside ? h` <span class="faint">· ngoài giờ hành chính</span>` : ''}`.s;
    if (!free.length) {
      var why = hol ? 'Nghỉ lễ ' + hol + ' — thử ' + dmw(nextWorkday(slot.iso)) + '.' : U.isWeekend(slot.iso) ? 'Cuối tuần — thử ngày làm việc kế tiếp.' : outside ? 'Ngoài giờ làm — thử trong khung 09:00 – 18:00.' : 'Ai cũng có lịch khung này — thử giờ khác.';
      U.render(list, h`<p class="st-free__empty muted">${why}</p>`);
      return;
    }
    U.render(list, h`${free.map(function (x) {
      var team = st.team(x.s.teamId), sh = st.shiftType(x.type);
      return h`<button type="button" class="st-free__p" role="listitem" data-open="${x.s.id}" data-no-profile aria-label="${x.s.name} · ${x.s.role} · ${sh.label}" style="--team:${team ? team.color : 'transparent'}">${raw(UI.avatar(x.s, { size: 'sm', title: false }))}<span class="st-free__name">${U.shortName(x.s.name)}</span><small class="mono-sm">${team ? team.short : ''}${x.type === 'remote' ? ' · WFH' : x.type === 'onsite' ? ' · Q' : ''}</small></button>`;
    })}`);
  };

  /* -------------------------------------------------------------- 3. filters */
  StaffView.prototype.renderFilters = function () {
    var self = this, st = S(), F = this.F;
    U.render(this.els.bar, h`
      <div class="st-bar__top">
        <div class="input-icon st-bar__search">${icon('search', 16)}<input class="input st-search" type="search" placeholder="Tìm tên, vai trò, kỹ năng, team… (không cần dấu)" value="${F.q}" aria-label="Tìm nhân sự" autocomplete="off" spellcheck="false"></div>
        <label class="st-bar__sort"><span class="sr-only">Sắp xếp</span><span class="select-wrap"><select class="input select st-sort" aria-label="Sắp xếp">${SORTS.map(function (o) { return h`<option value="${o.id}"${o.id === self.sort.key ? raw(' selected') : ''}>${o.label}</option>`; })}<option value="__col" disabled hidden>Theo cột bảng</option></select>${icon('chevron-down', 16)}</span></label>
        <div class="st-bar__seg"></div>
      </div>
      <div class="st-bar__groups">
        <div class="st-group" role="group" aria-label="Team"><span class="eyebrow st-group__lbl">Team</span>
          <button type="button" class="chip chip--btn st-chip" data-f="team" data-v="" aria-pressed="false">Tất cả</button>
          ${st.state.teams.map(function (t) { return h`<button type="button" class="chip chip--btn chip--color st-chip" style="--chip:${t.color}" data-f="team" data-v="${t.id}" aria-pressed="false"><i class="chip__dot"></i><span>${t.name}</span></button>`; })}
        </div>
        <div class="st-group" role="group" aria-label="Trạng thái"><span class="eyebrow st-group__lbl">Trạng thái</span>
          ${STATUSES.map(function (s) { return h`<button type="button" class="chip chip--btn st-chip" data-f="status" data-v="${s}" aria-pressed="false"><i class="status-dot" data-status="${s}"></i><span>${UI.statusLabel(s)}</span></button>`; })}
        </div>
        <div class="st-group" role="group" aria-label="Nơi làm việc"><span class="eyebrow st-group__lbl">Nơi</span>
          ${LOCS.map(function (l) { return h`<button type="button" class="chip chip--btn st-chip" data-f="loc" data-v="${l.id}" aria-pressed="false">${icon('map-pin', 12)}<span>${l.label}</span></button>`; })}
        </div>
        <div class="st-group st-group--skills" role="group" aria-label="Kỹ năng"><span class="eyebrow st-group__lbl">Kỹ năng</span>
          ${this.skills.map(function (k) { return h`<button type="button" class="chip chip--btn st-chip" data-f="skill" data-v="${k}" aria-pressed="false"><span>${k}</span></button>`; })}
        </div>
      </div>
      <div class="st-bar__foot"><span class="st-bar__count" aria-live="polite"></span><span class="st-bar__active"></span></div>`);
    this.els.search = this.els.bar.querySelector('.st-search');
    this.els.sortSel = this.els.bar.querySelector('.st-sort');
    this.seg = UI.segmented(VIEW_ITEMS, F.view, function (v) { self.setView(v, true); }, { cls: 'st-seg' });
    this.els.bar.querySelector('.st-bar__seg').appendChild(this.seg);
    this.renderChips();
  };
  StaffView.prototype.renderChips = function () {
    var F = this.F;
    U.qsa('.st-chip', this.els.bar).forEach(function (b) { var on = F[b.dataset.f] === b.dataset.v; b.classList.toggle('is-active', on); b.setAttribute('aria-pressed', on ? 'true' : 'false'); });
    if (this.els.sortSel) this.els.sortSel.value = SORTS.some(function (o) { return o.id === this.sort.key; }, this) ? this.sort.key : '__col';
  };
  StaffView.prototype.syncSegmented = function () {
    var F = this.F; if (!this.seg) return;
    U.qsa('.segmented__btn', this.seg).forEach(function (b) { var on = b.dataset.value === F.view; b.classList.toggle('is-active', on); b.setAttribute('aria-selected', on ? 'true' : 'false'); });
    if (this.seg.refresh) this.seg.refresh();
  };
  StaffView.prototype.renderCount = function (n, total) {
    var F = this.F, st = S(), count = this.els.bar.querySelector('.st-bar__count'), act = this.els.bar.querySelector('.st-bar__active');
    if (!count) return;
    count.innerHTML = h`<b class="tnum">${n}</b> người${n !== total ? h` <span class="faint">/ ${total}</span>` : ''}`.s;
    if (!this.hasFilter()) { act.innerHTML = ''; return; }
    var team = F.team ? st.team(F.team) : null, bits = [];
    if (team) bits.push(team.name); if (F.status) bits.push(UI.statusLabel(F.status)); if (F.loc) bits.push(locLabel(F.loc)); if (F.skill) bits.push(F.skill); if (F.q) bits.push('“' + F.q + '”');
    act.innerHTML = h`<span class="faint">·</span> <span class="st-bar__crumbs">${bits.join(' · ')}</span> <button type="button" class="link-btn" data-clear>Xoá bộ lọc</button>`.s;
  };

  /* ------------------------------------------------------- filter + sort */
  StaffView.prototype.filtered = function () {
    var st = S(), F = this.F, self = this;
    var list = st.state.staff.filter(function (s) {
      if (F.team && s.teamId !== F.team) return false;
      if (F.status && s.status !== F.status) return false;
      if (F.loc && s.location !== F.loc) return false;
      if (F.skill && (s.skills || []).indexOf(F.skill) < 0) return false;
      if (F.q) { var team = st.team(s.teamId); var hay = s.name + ' ' + s.role + ' ' + (s.skills || []).join(' ') + ' ' + (team ? team.name + ' ' + team.short : '') + ' ' + locLabel(s.location) + ' ' + s.location; if (U.fuzzyMatch(F.q, hay) === 0) return false; }
      return true;
    });
    return list.sort(this.sorter());
  };
  StaffView.prototype.sorter = function () {
    var st = S(), key = this.sort.key, m = this.sort.dir === 'desc' ? -1 : 1, self = this, teamIdx = {};
    st.state.teams.forEach(function (t, i) { teamIdx[t.id] = i; });
    var nameKey = function (s) { return U.normalizeVN(U.firstName(s.name) + ' ' + s.name); };
    var val = {
      name: nameKey, role: function (s) { return U.normalizeVN(s.role); }, team: function (s) { return teamIdx[s.teamId]; },
      status: function (s) { return STATUSES.indexOf(s.status); }, shift: function (s) { return SHIFT_ORDER.indexOf(st.shiftOf(s.id, self.focusISO)); },
      hours: function (s) { return st.weekHours(s.id, self.todayISO); }, load: function (s) { return st.workload(s.id).percent; }, joined: function (s) { return s.joined; }
    }[key] || nameKey;
    return function (a, b) { var A = val(a), B = val(b); if (A === B) { var na = nameKey(a), nb = nameKey(b); return na < nb ? -1 : na > nb ? 1 : 0; } return (A < B ? -1 : 1) * m; };
  };
  StaffView.prototype.setSort = function (key, dir) {
    if (!DEFAULT_DIR[key]) return;
    if (dir) this.sort = { key: key, dir: dir };
    else if (this.sort.key === key) this.sort = { key: key, dir: this.sort.dir === 'asc' ? 'desc' : 'asc' };
    else this.sort = { key: key, dir: DEFAULT_DIR[key] };
    U.saveJSON(KEYS.sort, this.sort);
    this.renderChips();
    this.renderResults(false, false);
  };
  StaffView.prototype.setFilter = function (k, v, push) {
    if (this.F[k] === v) { if (k === 'q') return; v = ''; }
    this.F[k] = v;
    this.renderChips(); this.renderTeams();
    this.renderResults(false, false);
    this.syncURL(!!push);
  };
  StaffView.prototype.clearFilters = function () {
    this.F.team = ''; this.F.q = ''; this.F.status = ''; this.F.loc = ''; this.F.skill = '';
    if (this.els.search) this.els.search.value = '';
    this.renderChips(); this.renderTeams(); this.renderResults(false, false); this.syncURL(false);
  };
  StaffView.prototype.setView = function (v, fromSeg) {
    if (VIEWS.indexOf(v) < 0 || v === this.F.view) return;
    this.F.view = v; U.saveJSON(KEYS.view, v);
    if (!fromSeg) this.syncSegmented();
    this.renderResults(false, true);
    this.syncURL(true);
  };

  /* --------------------------------------------------------------- results */
  StaffView.prototype.renderResults = function (first, swap) {
    var self = this, el = this.els.results, st = S();
    var list = this.filtered(); this.list = list;
    this.renderCount(list.length, st.state.staff.length);
    if (this.pulseIO) { this.pulseIO.disconnect(); this.pulseIO = null; }
    this.hideTip();
    var paint = function () {
      el.dataset.view = self.F.view;
      if (!list.length) { U.render(el, raw(UI.empty({ icon: 'search', title: 'Không tìm thấy — thử bỏ dấu hoặc kiểm tra team', body: self.F.q ? 'Không ai khớp “' + self.F.q + '” với bộ lọc hiện tại.' : 'Không ai khớp bộ lọc hiện tại.', actionLabel: 'Xoá bộ lọc', action: 'clear' }))); return; }
      if (self.F.view === 'grid') self.renderGrid(list, first);
      else if (self.F.view === 'table') self.renderTable(list, first);
      else self.renderPulse(list, first);
    };
    if (swap && !reduceMotion()) {
      el.classList.add('is-swap'); paint();
      requestAnimationFrame(function () { requestAnimationFrame(function () { el.classList.remove('is-swap'); }); });
    } else paint();
  };

  /* ---- grid */
  StaffView.prototype.personCard = function (s, i, first) {
    var st = S(), team = st.team(s.teamId), wl = st.workload(s.id), sh = st.shiftOf(s.id, this.focusISO), isMe = s.id === st.state.currentUserId;
    var bd = birthdayIn(s, this.todayISO, 7), next = nextUpText(s.id, this.todayISO), isToday = this.focusISO === this.todayISO;
    var loadLabel = fmtNum(wl.shiftHours) + 'g/' + (s.capacity || 40) + 'g';
    return h`<article class="card st-person${first ? ' reveal' : ''}${isMe ? ' is-me' : ''}" style="--i:${Math.min(i + 3, 8)};--team:${team ? team.color : 'transparent'}" data-staff-card="${s.id}" data-no-profile>
      <div class="st-person__top">
        ${raw(UI.avatar(s, { size: 'lg', status: true, ring: true, title: false }))}
        <div class="st-person__id">
          <button type="button" class="st-person__name" data-open="${s.id}" aria-label="Mở hồ sơ ${s.name}">${s.name}</button>
          <div class="st-person__role truncate">${s.role}${isMe ? raw(' <span class="chip chip--blue chip--xs">Bạn</span>') : ''}</div>
        </div>
        <div class="st-person__day"><small class="mono-sm">${isToday ? 'Hôm nay' : dmw(this.focusISO)}</small>${raw(UI.shiftBadge(sh, { label: true }))}</div>
      </div>
      <div class="st-person__meta">${raw(UI.teamChip(team))}${raw(UI.chip(locLabel(s.location), { icon: 'map-pin' }))}${bd ? raw(UI.chip('🎂 ' + (bd.diff === 0 ? 'Sinh nhật hôm nay' : bd.diff === 1 ? 'Sinh nhật ngày mai' : 'Sinh nhật ' + dmw(bd.iso)), { cls: 'st-bday' })) : ''}</div>
      <div class="st-person__skills">${(s.skills || []).slice(0, 3).map(function (k) { return h`<span class="tag">${k}</span>`; })}</div>
      <div class="st-person__load"><div class="st-person__loadhead"><span class="eyebrow">Tải tuần</span><span class="mono-sm faint">${wl.percent}%</span></div><div class="workload" data-level="${wl.level}" title="${wl.shiftHours + 'g ca · ' + wl.eventHours + 'g sự kiện · ' + wl.percent + '%'}"><div class="workload__bar"><span style="width:${Math.min(100, wl.percent)}%"></span></div><b class="mono-sm tnum">${loadLabel}</b></div></div>
      <div class="st-person__next${next.empty ? ' is-empty' : ''}">${icon('clock', 14)}<span class="truncate">${next.text}</span></div>
      <div class="st-person__actions"><button type="button" class="btn btn--sm btn--soft" data-act="profile">${icon('user', 14)}Hồ sơ</button><button type="button" class="btn btn--sm btn--ghost" data-act="calendar">${icon('calendar', 14)}Xem lịch</button><button type="button" class="btn btn--sm btn--ghost" data-act="meet">${icon('users', 14)}Đặt họp</button></div>
    </article>`;
  };
  StaffView.prototype.renderGrid = function (list, first) {
    var self = this;
    U.render(this.els.results, h`<div class="st-grid">${list.map(function (s, i) { return self.personCard(s, i, first); })}</div>`);
  };

  /* ---- table */
  StaffView.prototype.renderTable = function (list, first) {
    var self = this, st = S(), isToday = this.focusISO === this.todayISO;
    var th = function (key, label, cls) { var on = self.sort.key === key; return h`<th scope="col" class="${cls || ''}" data-sort="${key}" aria-sort="${on ? (self.sort.dir === 'asc' ? 'ascending' : 'descending') : 'none'}"><span class="st-th">${label}<span class="st-th__caret">${icon('chevron-up', 12)}</span></span></th>`; };
    U.render(this.els.results, h`<div class="table-wrap st-table-wrap${first ? ' reveal' : ''}" style="--i:3" tabindex="0" role="group" aria-label="Danh bạ dạng bảng — dùng mũi tên lên xuống và Enter">
      <table class="table st-table">
        <thead><tr>${th('name', 'Nhân sự · vai trò')}${th('team', 'Team')}${th('status', 'Trạng thái')}${th('shift', isToday ? 'Ca hôm nay' : 'Ca ' + dmw(this.focusISO))}${th('hours', 'Giờ tuần', 'num')}${th('load', 'Tải')}<th scope="col">Liên hệ</th><th scope="col"><span class="sr-only">Thao tác</span></th></tr></thead>
        <tbody>${list.map(function (s, i) {
          var team = st.team(s.teamId), wl = st.workload(s.id), sh = st.shiftOf(s.id, self.focusISO), sht = st.shiftType(sh), wh = st.weekHours(s.id, self.todayISO), isMe = s.id === st.state.currentUserId;
          return h`<tr data-staff-row="${s.id}" data-i="${i}" tabindex="-1" aria-selected="false" class="${isMe ? 'is-me' : ''}" data-no-profile>
            <td><div class="st-row__who">${raw(UI.avatar(s, { size: 'md', status: true, title: false }))}<span class="st-row__id"><span class="st-row__name">${s.name}${isMe ? raw(' <span class="chip chip--blue chip--xs">Bạn</span>') : ''}</span><small class="st-row__role">${s.role}</small></span></div></td>
            <td>${raw(UI.teamChip(team))}</td>
            <td><span class="st-status"><i class="status-dot" data-status="${s.status}"></i>${UI.statusLabel(s.status)}</span></td>
            <td><span class="st-row__shift">${raw(UI.shiftBadge(sh))}<small class="mono-sm faint">${sht.hours === '—' ? '' : sht.hours}</small></span></td>
            <td class="num${wh > 48 ? ' is-over' : ''}" title="${wh > 48 ? 'Trên 48 giờ / tuần' : ''}">${fmtNum(wh)}g</td>
            <td><div class="workload st-row__load" data-level="${wl.level}"><div class="workload__bar"><span style="width:${Math.min(100, wl.percent)}%"></span></div><b class="tnum">${wl.percent}%</b></div></td>
            <td><div class="st-row__contact"><button type="button" class="icon-btn icon-btn--sm" data-copy="${s.email}" data-tip="Sao chép email" aria-label="Sao chép email của ${U.shortName(s.name)}">${icon('mail', 15)}</button><button type="button" class="icon-btn icon-btn--sm" data-copy="${s.phone}" data-tip="Sao chép số điện thoại" aria-label="Sao chép số điện thoại của ${U.shortName(s.name)}">${icon('phone', 15)}</button></div></td>
            <td><div class="row-actions st-row__actions"><button type="button" class="icon-btn icon-btn--sm" data-act="calendar" data-id="${s.id}" data-tip="Xem lịch" aria-label="Xem lịch của ${U.shortName(s.name)}">${icon('calendar', 15)}</button><button type="button" class="icon-btn icon-btn--sm" data-act="meet" data-id="${s.id}" data-tip="Đặt họp" aria-label="Đặt họp với ${U.shortName(s.name)}">${icon('users', 15)}</button><button type="button" class="btn btn--sm btn--soft" data-act="profile" data-id="${s.id}">Hồ sơ</button></div></td>
          </tr>`;
        })}</tbody>
      </table></div>`);
    this.tableHi = -1;
  };
  StaffView.prototype.highlightRow = function (i, scroll) {
    var rows = U.qsa('tr[data-staff-row]', this.els.results); if (!rows.length) return;
    i = U.clamp(i, 0, rows.length - 1); this.tableHi = i;
    rows.forEach(function (r, k) { var on = k === i; r.classList.toggle('is-hi', on); r.setAttribute('aria-selected', on ? 'true' : 'false'); });
    if (scroll) rows[i].scrollIntoView({ block: 'nearest' });
  };

  /* ---- pulse */
  StaffView.prototype.renderPulse = function (list, first) {
    var self = this, st = S(), start = U.startOfWeek(U.today()), days = U.range(14).map(function (i) { return U.toISO(U.addDays(start, i)); });
    var me = st.state.currentUserId, teams = st.state.teams.filter(function (t) { return list.some(function (s) { return s.teamId === t.id; }); });
    var byTeam = U.groupBy(list, 'teamId');
    var rows = [], over = [], under = [], overDays = {}, r = 0;
    teams.forEach(function (t) {
      U.sortBy(byTeam[t.id], function (s) { return U.normalizeVN(U.firstName(s.name) + ' ' + s.name); }).forEach(function (s) {
        var cells = days.map(function (iso) { return dayCell(s.id, iso); });
        var weekMin = U.sum(cells.slice(0, 7), function (c) { return c.totalMin; }), cap = (s.capacity || 40) * 60;
        var row = { s: s, team: t, cells: cells, weekMin: weekMin, r: r++ };
        rows.push(row);
        if (weekMin > OVER_WEEK_MIN) over.push(row); else if (weekMin < cap * 0.6) under.push(row);
        cells.forEach(function (c) { if (c.level === 5) overDays[c.iso] = (overDays[c.iso] || 0) + 1; });
      });
    });
    var maxMin = Math.max(600, Math.max.apply(null, rows.map(function (row) { return Math.max.apply(null, row.cells.slice(0, 7).map(function (c) { return c.totalMin; })); }).concat([0])));
    var w1 = U.isoWeek(start), w2 = U.isoWeek(U.addDays(start, 7));
    var summary = (over.length ? over.length + ' người trên 48g tuần này — cân nhắc san ca' : 'Không ai vượt 48g tuần này') + ' · ' + (under.length ? under.length + ' người dưới định mức' : 'không ai dưới định mức');
    var dayHead = function (iso, i) {
      var d = U.fromISO(iso), hol = st.holidayName(iso), cls = 'st-pulse__d' + (iso === self.todayISO ? ' is-today' : '') + (U.isWeekend(iso) ? ' is-weekend' : '') + (hol ? ' is-holiday hatch' : '');
      return h`<div class="${cls}" role="columnheader" data-c="${i}" title="${U.fmtDate(d, 'long') + (hol ? ' · ' + hol : '')}"><span>${U.weekdayShort(d)}</span><b class="tnum">${d.getDate()}</b></div>`;
    };
    var overDayList = Object.keys(overDays).sort();
    var rosterLink = function (iso, teamId) { return '#/roster/' + iso + (teamId ? '?team=' + teamId : ''); };
    U.render(this.els.results, h`<div class="st-pulse${first ? ' reveal' : ''}" style="--i:3">
      <div class="card card--flush st-pulse__main">
        <div class="st-pulse__scroll">
          <div class="st-pulse__grid" role="table" aria-label="Tải công việc theo người và ngày, 14 ngày từ ${dmw(days[0])}">
            <div class="st-pulse__corner st-pulse__sticky" role="columnheader"><span class="eyebrow">Tuần ${w1} – ${w2}</span><span class="st-pulse__hint faint">Bấm ô để mở bảng ca</span></div>
            ${days.slice(0, 7).map(dayHead)}<div class="st-pulse__gap" aria-hidden="true"></div>${days.slice(7).map(function (iso, i) { return dayHead(iso, i + 7); })}
            <div class="st-pulse__h st-pulse__h--num" role="columnheader"><span class="eyebrow">Tuần ${w1}</span></div>
            <div class="st-pulse__h" role="columnheader"><span class="eyebrow">7 ngày</span></div>
            ${teams.map(function (t) {
              var trs = rows.filter(function (row) { return row.team.id === t.id; });
              return h`<div class="st-pulse__team" role="rowheader" style="--chip:${t.color}"><i class="chip__dot"></i>${t.name}<small class="mono-sm">${trs.length}</small></div>${trs.map(function (row) {
                var s = row.s, isMe = s.id === me;
                return h`<div class="st-pulse__name st-pulse__sticky${isMe ? ' is-me' : ''}" role="rowheader" data-r="${row.r}" title="${s.name} · ${s.role}">${raw(UI.avatar(s, { size: 'xs', title: false }))}<span class="truncate">${U.shortName(s.name)}</span></div>
                  ${row.cells.map(function (c, i) {
                    var tip = cellTip(s, c);
                    var cell = h`<button type="button" class="heat${c.level === 5 ? ' is-overload' : ''}" role="cell" data-level="${c.level}" data-r="${row.r}" data-c="${i}" data-iso="${c.iso}" data-team="${t.id}" data-sid="${s.id}" data-shift="${c.shiftMin}" data-outside="${c.outsideMin}" aria-label="${tip}" style="--i:${i};--j:${row.r}"></button>`;
                    return i === 7 ? h`<div class="st-pulse__gap" aria-hidden="true"></div>${cell}` : cell;
                  })}
                  <div class="st-pulse__hours mono${row.weekMin > OVER_WEEK_MIN ? ' is-over' : ''}" role="cell" data-r="${row.r}" title="${row.weekMin > OVER_WEEK_MIN ? 'Trên 48 giờ tuần này' : 'Giờ làm tuần này'}">${row.weekMin > OVER_WEEK_MIN ? icon('alert-triangle', 11) : ''}${fmtH(row.weekMin)}</div>
                  <div class="st-pulse__spark" role="cell" data-r="${row.r}" aria-label="Tải 7 ngày tuần này">${row.cells.slice(0, 7).map(function (c) { return h`<i data-level="${c.level}" style="--v:${Math.max(0, Math.min(1, c.totalMin / maxMin)).toFixed(2)}"></i>`; })}</div>`;
              })}`;
            })}
          </div>
        </div>
        <div class="st-pulse__foot">
          <div class="st-pulse__legend" aria-label="Chú giải mức tải">${LEVEL_LABELS.map(function (l, i) { return h`<span class="st-pulse__key"><i class="heat" data-level="${i}" aria-hidden="true"></i><span>${i === 5 ? 'Quá tải ' : ''}${l}</span></span>`; })}</div>
          <p class="st-pulse__summary">${summary}</p>
        </div>
      </div>
      <aside class="st-pulse__side" aria-label="Đọc nhanh">
        <section class="card st-side"><div class="card__eyebrow">Tuần ${w1}</div><h3 class="t-h3">Trên 48 giờ</h3>
          ${over.length ? h`<div class="st-side__list">${over.sort(function (a, b) { return b.weekMin - a.weekMin; }).map(function (row) { return h`<div class="st-side__row">${raw(UI.avatar(row.s, { size: 'xs', title: false }))}<span class="truncate">${U.shortName(row.s.name)}</span><span class="mono is-over">${fmtH(row.weekMin)}</span><a class="link-btn" href="${rosterLink(self.todayISO, row.team.id)}">San ca</a></div>`; })}</div>` : h`<p class="st-side__empty muted">Không ai vượt 48 giờ — nhịp đội đang ổn.</p>`}
        </section>
        <section class="card st-side"><div class="card__eyebrow">Tuần ${w1}</div><h3 class="t-h3">Dưới định mức</h3>
          ${under.length ? h`<div class="st-side__list">${under.sort(function (a, b) { return a.weekMin - b.weekMin; }).slice(0, 6).map(function (row) { return h`<div class="st-side__row">${raw(UI.avatar(row.s, { size: 'xs', title: false }))}<span class="truncate">${U.shortName(row.s.name)}</span><span class="mono muted">${fmtH(row.weekMin)}</span><button type="button" class="link-btn" data-open="${row.s.id}">Hồ sơ</button></div>`; })}${under.length > 6 ? h`<p class="st-side__more faint">+ ${under.length - 6} người khác</p>` : ''}</div>` : h`<p class="st-side__empty muted">Mọi người đều đủ ca tuần này.</p>`}
        </section>
        <section class="card st-side"><div class="card__eyebrow">14 ngày</div><h3 class="t-h3">Ngày quá tải</h3>
          ${overDayList.length ? h`<div class="st-side__list">${overDayList.slice(0, 6).map(function (iso) { return h`<div class="st-side__row"><span class="st-side__date mono-sm">${dmw(iso)}</span><span class="truncate">${overDays[iso]} người > 10g</span><a class="link-btn" href="${rosterLink(iso, self.F.team)}">Mở bảng ca</a></div>`; })}</div>` : h`<p class="st-side__empty muted">Không có ngày nào vượt 10 giờ.</p>`}
        </section>
      </aside>
    </div>`);
    this.pulseRows = []; this.pulseCols = []; this.pulseHi = null;
    var grid = this.els.results.querySelector('.st-pulse__grid'); this.pulseGrid = grid;
    U.qsa('[data-r]', grid).forEach(function (n) { var i = +n.dataset.r; (self.pulseRows[i] = self.pulseRows[i] || []).push(n); });
    U.qsa('[data-c]', grid).forEach(function (n) { var i = +n.dataset.c; (self.pulseCols[i] = self.pulseCols[i] || []).push(n); });
    if (reduceMotion() || !('IntersectionObserver' in window)) { grid.classList.add('is-live', 'is-settled'); return; }
    this.pulseIO = new IntersectionObserver(function (entries) {
      if (!entries.some(function (en) { return en.isIntersecting; })) return;
      if (self.pulseIO) { self.pulseIO.disconnect(); self.pulseIO = null; }
      grid.classList.add('is-live');
      self.timers.push(setTimeout(function () { grid.classList.add('is-settled'); }, 800));
    }, { threshold: 0.05 });
    this.pulseIO.observe(grid);
    this.timers.push(setTimeout(function () { if (!grid.classList.contains('is-live')) { grid.classList.add('is-live'); setTimeout(function () { grid.classList.add('is-settled'); }, 800); } }, 4000));
  };
  StaffView.prototype.pulseHighlight = function (r, c) {
    var grid = this.pulseGrid; if (!grid) return;
    var prev = this.pulseHi;
    if (prev && prev.r === r && prev.c === c) return;
    if (prev) { (this.pulseRows[prev.r] || []).forEach(function (n) { n.classList.remove('is-hi'); }); (this.pulseCols[prev.c] || []).forEach(function (n) { n.classList.remove('is-hi'); }); }
    if (r == null) { this.pulseHi = null; grid.classList.remove('has-hi'); return; }
    (this.pulseRows[r] || []).forEach(function (n) { n.classList.add('is-hi'); }); (this.pulseCols[c] || []).forEach(function (n) { n.classList.add('is-hi'); });
    this.pulseHi = { r: r, c: c }; grid.classList.add('has-hi');
  };
  StaffView.prototype.showTip = function (cell) {
    var tip = this.els.tip; if (!tip) return;
    var text = cell.getAttribute('aria-label') || '', shift = +cell.dataset.shift || 0, outside = +cell.dataset.outside || 0, total = shift + outside;
    var i = text.indexOf(' · ');
    tip.innerHTML = h`<b>${i > 0 ? text.slice(0, i) : text}</b>${i > 0 ? h`<span>${text.slice(i)}</span>` : ''}${total ? h`<span class="st-tip__bar" aria-hidden="true"><i class="st-tip__shift" style="width:${Math.round(shift / Math.max(total, 600) * 100)}%"></i><i class="st-tip__out" style="width:${Math.round(outside / Math.max(total, 600) * 100)}%"></i></span>` : ''}`.s;
    var r = cell.getBoundingClientRect(), w = tip.offsetWidth, hgt = tip.offsetHeight, vw = window.innerWidth;
    var x = U.clamp(r.left + r.width / 2 - w / 2, 8, Math.max(8, vw - w - 8)), y = r.top - hgt - 8;
    if (y < 8) y = r.bottom + 8;
    tip.style.transform = 'translate3d(' + Math.round(x) + 'px,' + Math.round(y) + 'px,0)';
    tip.classList.add('is-open'); tip.setAttribute('aria-hidden', 'false');
  };
  StaffView.prototype.hideTip = function () { var tip = this.els.tip; if (tip) { tip.classList.remove('is-open'); tip.setAttribute('aria-hidden', 'true'); } };

  /* ------------------------------------------------------------ actions */
  StaffView.prototype.act = function (act, id) {
    var st = S(), s = st.staff(id); if (!s) return;
    if (act === 'profile') E().staffProfile(id);
    else if (act === 'calendar') Z15.router.go('calendar', { staff: id });
    else if (act === 'meet') E().event(null, { attendeeIds: U.uniq([st.state.currentUserId, id]), title: 'Họp với ' + U.shortName(s.name) });
  };

  /* --------------------------------------------------------------- bind */
  StaffView.prototype.bind = function () {
    var self = this, root = this.container;
    var on = function (evt, sel, fn) { self.unbinders.push(U.delegate(root, evt, sel, fn)); };

    on('click', '[data-team-tile]', function (e, el) { self.setFilter('team', el.dataset.teamTile, true); });
    on('click', '.st-chip', function (e, el) { self.setFilter(el.dataset.f, el.dataset.v, false); });
    on('click', '[data-clear], .empty [data-action="clear"]', function () { self.clearFilters(); if (self.els.search) self.els.search.focus(); });
    on('change', '.st-sort', function (e, el) { if (el.value && el.value !== '__col') { var o = SORTS.filter(function (x) { return x.id === el.value; })[0]; self.setSort(el.value, o ? o.dir : null); } });
    var onSearch = U.debounce(function () { var v = normalizeQ(self.els.search.value); if (v === self.F.q) return; self.F.q = v; self.renderChips(); self.renderResults(false, false); self.syncURL(false); }, 70);
    on('input', '.st-search', onSearch);
    on('keydown', '.st-search', function (e, el) { if (e.key === 'Escape' && el.value) { e.preventDefault(); el.value = ''; onSearch(); } if (e.key === 'Enter') { var first = self.list && self.list[0]; if (first && self.F.view !== 'pulse') E().staffProfile(first.id); } });

    on('input', '.st-free__date, .st-free__time', function () {
      var d = self.els.free.querySelector('.st-free__date'), t = self.els.free.querySelector('.st-free__time');
      self.slot = { iso: d.value, time: t.value || '09:00' }; self.slotTouched = true; self.renderFreeList();
    });
    on('click', '[data-open]', function (e, el) { e.stopPropagation(); E().staffProfile(el.dataset.open); });
    on('click', '[data-act]', function (e, el) {
      e.stopPropagation();
      var host = el.closest('[data-staff-card], [data-staff-row]');
      self.act(el.dataset.act, el.dataset.id || (host && (host.dataset.staffCard || host.dataset.staffRow)));
    });
    on('click', '[data-copy]', function (e, el) {
      e.stopPropagation();
      var p = U.copyToClipboard(el.dataset.copy); if (p && p.catch) p.catch(function () { });
      UI.toast('Đã sao chép ' + el.dataset.copy, { kind: 'info' });
    });
    on('click', '.st-person', function (e, el) {
      if (e.defaultPrevented || e.target.closest('button, a, input')) return;
      E().staffProfile(el.dataset.staffCard);
    });
    on('click', 'tr[data-staff-row]', function (e, el) {
      if (e.target.closest('button, a, input')) return;
      self.highlightRow(+el.dataset.i, false);
      E().staffProfile(el.dataset.staffRow);
    });
    on('click', 'th[data-sort]', function (e, el) { self.setSort(el.dataset.sort); });
    on('keydown', '.st-table-wrap', function (e, el) {
      if (e.target !== el && !e.target.closest('tr[data-staff-row]')) return;
      var k = e.key;
      if (k === 'ArrowDown' || k === 'ArrowUp') { e.preventDefault(); self.highlightRow(self.tableHi < 0 ? 0 : self.tableHi + (k === 'ArrowDown' ? 1 : -1), true); }
      else if (k === 'Home' || k === 'End') { e.preventDefault(); self.highlightRow(k === 'Home' ? 0 : 1e9, true); }
      else if (k === 'Enter' && self.tableHi >= 0) { e.preventDefault(); var row = U.qsa('tr[data-staff-row]', self.els.results)[self.tableHi]; if (row) E().staffProfile(row.dataset.staffRow); }
    });
    on('focusin', '.st-table-wrap', function (e, el) { if (e.target === el && self.tableHi < 0) self.highlightRow(0, false); });

    // Nhịp đội
    var hover = U.rafThrottle(function (cell) { if (!cell || !cell.isConnected) return; self.pulseHighlight(+cell.dataset.r, +cell.dataset.c); self.showTip(cell); });
    on('mouseover', '.st-pulse__grid .heat', function (e, el) { hover(el); });
    on('focusin', '.st-pulse__grid .heat', function (e, el) { hover(el); });
    on('focusout', '.st-pulse__grid .heat', function () { self.pulseHighlight(null); self.hideTip(); });
    var leave = function (e) { var g = self.pulseGrid; if (!g) return; if (!e.relatedTarget || !g.contains(e.relatedTarget) || !e.relatedTarget.closest('.heat')) { self.pulseHighlight(null); self.hideTip(); } };
    on('mouseout', '.st-pulse__grid .heat', leave);
    on('click', '.st-pulse__grid .heat', function (e, el) { location.hash = '#/roster/' + el.dataset.iso + (el.dataset.team ? '?team=' + el.dataset.team : ''); });
    on('keydown', '.st-pulse__grid .heat', function (e, el) {
      var dr = 0, dc = 0;
      if (e.key === 'ArrowRight') dc = 1; else if (e.key === 'ArrowLeft') dc = -1; else if (e.key === 'ArrowDown') dr = 1; else if (e.key === 'ArrowUp') dr = -1; else return;
      e.preventDefault();
      var next = self.pulseGrid && self.pulseGrid.querySelector('.heat[data-r="' + (+el.dataset.r + dr) + '"][data-c="' + (+el.dataset.c + dc) + '"]');
      if (next) next.focus();
    });
    this.onScroll = function () { if (self.els.tip && self.els.tip.classList.contains('is-open')) self.hideTip(); };
    window.addEventListener('scroll', this.onScroll, true);
  };

  /* -------------------------------------------------------- store / tick */
  StaffView.prototype.onStore = function (meta) {
    var t = (meta && meta.type) || '';
    if (!/^(staff|shift|event|reset|request:status)/.test(t)) return;
    if (t === 'reset') { if (!this.dateOverride) { this.todayISO = U.todayISO(); this.focusISO = isWorkday(this.todayISO) ? this.todayISO : nextWorkday(this.todayISO); } this.skills = topSkills(S().state.staff, 10); }
    this.renderTeams();
    if (!this.slotTouched) this.slot = this.defaultSlot();
    this.renderFreeList();
    this.renderResults(false, false);
    this.setTitle();
  };
  StaffView.prototype.tick = function () {
    var real = U.todayISO();
    if (this.dateOverride) return;
    if (real !== this.todayISO) { this.todayISO = real; this.focusISO = isWorkday(real) ? real : nextWorkday(real); this.renderTeams(); this.renderResults(false, false); this.setTitle(); }
    if (!this.slotTouched) { var slot = this.defaultSlot(); if (slot.iso !== this.slot.iso || slot.time !== this.slot.time) { this.slot = slot; this.renderFree(); } }
  };

  /* ----------------------------------------------------------- lifecycle */
  StaffView.prototype.update = function (route) {
    var prevKey = this.key(), prevView = this.F.view;
    this.readRoute(route);
    if (this.key() === prevKey) { this.setTitle(); return; }
    if (this.els.search && this.els.search.value !== this.F.q) this.els.search.value = this.F.q;
    if (prevKey.split('|')[1] !== this.todayISO) this.renderFree();
    this.renderChips(); this.renderTeams(); this.syncSegmented();
    this.renderResults(false, prevView !== this.F.view);
    this.setTitle();
  };
  StaffView.prototype.destroy = function () {
    if (this.unsub) this.unsub();
    (this.unregisterKeys || []).forEach(function (f) { f && f(); });
    this.unbinders.forEach(function (f) { f && f(); });
    this.timers.forEach(function (t) { clearInterval(t); clearTimeout(t); });
    if (this.pulseIO) this.pulseIO.disconnect();
    if (this.onScroll) window.removeEventListener('scroll', this.onScroll, true);
    UI.palette.unregister('staff:pulse');
  };

  Z15.views.staff = {
    title: 'Đội ngũ',
    render: function (container, route) { return new StaffView(container, route); }
  };
})(window);
