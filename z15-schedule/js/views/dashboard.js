/* =====================================================================
   Z15 Miracle · Lịch làm việc — views/dashboard.js
   "Hôm nay": ca gì, ở đâu, với ai, deadline nào, ai đang chờ tôi.
   v1.1: lời mời chờ phản hồi (RSVP), sắp diễn ra cần nhắc, thẻ sức khoẻ
   lịch cho Ban điều hành, riêng tư & ưu tiên trên hero/dòng thời gian.
   Route: #/dashboard  (?date=YYYY-MM-DD để xem ngày khác, ?friday=1 test recap)
   ===================================================================== */
(function (global) {
  'use strict';
  var Z15 = global.Z15; Z15.views = Z15.views || {};
  var U = Z15.utils, UI = Z15.ui, h = U.html, raw = U.raw;
  var S = function () { return Z15.store; };
  var E = function () { return Z15.editors; };

  var KEYS = {
    checkin: 'z15.ui.dashboard.checkin',
    reveal: 'z15.ui.dashboard.lastReveal',
    where: 'z15.ui.dashboard.where',
    fun: 'z15.ui.dashboard.fun',
    kudos: 'z15.ui.dashboard.kudos'
  };
  var TL_START = 6 * 60, TL_END = 22 * 60, TL_SPAN = TL_END - TL_START;
  var MEETING_TYPES = { meeting: 1, review: 1, pitch: 1, training: 1 };
  var LEAVE_TOTAL = 12, LEAVE_LEFT = 8.5;
  var INVITES_MAX = 4, ATTENTION_MAX = 5, ATTENTION_HOURS = 48;

  /* ------------------------------------------------------------ helpers */
  function reduceMotion() { return U.prefersReducedMotion() || document.body.classList.contains('reduce-motion'); }
  function icon(name, size) { return raw(UI.icon(name, size)); }
  function isWorkday(iso) { return !U.isWeekend(iso) && !S().holidayName(iso); }
  function nextWorkday(iso) { var d = U.addDays(U.fromISO(iso), 1); for (var i = 0; i < 30 && !isWorkday(U.toISO(d)); i++) d = U.addDays(d, 1); return U.toISO(d); }
  function workdays(from, to) { var n = 0; for (var d = U.fromISO(from); U.toISO(d) <= to; d = U.addDays(d, 1)) if (isWorkday(U.toISO(d))) n++; return n; }
  /** Cùng quy tắc với trang Yêu cầu: đếm ngày làm việc (bỏ cuối tuần/lễ); đổi ca = 1 ca. */
  function dayCount(r) {
    if (r.type === 'swap') return '1 ca';
    var n = workdays(r.from, r.to);
    if (!n) { var allHol = true; for (var d = U.fromISO(r.from); U.toISO(d) <= r.to; d = U.addDays(d, 1)) if (!S().holidayName(U.toISO(d))) allHol = false; return (U.daysBetween(r.from, r.to) + 1) + ' ngày · ' + (allHol ? 'nghỉ lễ' : 'cuối tuần'); }
    return n + ' ngày làm việc';
  }
  function parseHours(str) { var m = /(\d{2}:\d{2})\s*[–-]\s*(\d{2}:\d{2})/.exec(str || ''); return m ? { start: m[1], end: m[2] } : null; }
  function dmw(iso) { return U.fmtDate(iso, 'shortWeekday'); }
  function dayLabel(iso, base) {
    var diff = U.daysBetween(base, iso);
    if (diff === 0) return 'Hôm nay'; if (diff === 1) return 'Ngày mai';
    var d = U.fromISO(iso); return U.weekdayLong(d) + ' ' + U.fmtDate(d, 'dm');
  }
  function whenLabel(iso, base) { var diff = U.daysBetween(base, iso); return diff === 0 || diff === 1 ? dayLabel(iso, base) + ' · ' + dmw(iso) : dayLabel(iso, base); }
  function fmtNum(v, dec) { return Number(v).toLocaleString('vi-VN', { minimumFractionDigits: 0, maximumFractionDigits: dec == null ? 1 : dec }); }
  function fmtHours(v) { return fmtNum(Math.round(v * 10) / 10) + 'g'; }
  function timeRange(a, b) { return a && b ? a + ' – ' + b : (a || ''); }
  function shiftStatus(type) { return ({ full: 'available', morning: 'available', afternoon: 'available', ot: 'busy', remote: 'remote', onsite: 'onsite', leave: 'off', off: 'off' })[type] || 'off'; }
  function isLive(ev, realISO, now) { return ev.date === realISO && !ev.allDay && U.timeToMin(ev.start) <= now && U.timeToMin(ev.end) > now; }
  function withStatus(avatarHtml, status) { return avatarHtml.replace(/<\/span>$/, '<i class="avatar__status" data-status="' + status + '"></i></span>'); }
  function isTypingTarget(t) { return !!t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.tagName === 'SELECT' || t.isContentEditable); }
  /** Số giờ còn lại tới lúc bắt đầu (âm = đã bắt đầu). */
  function hoursLeftOf(ev) { return (U.fromISO(ev.date).getTime() + (ev.allDay ? 8 * 60 : U.timeToMin(ev.start)) * 60000 - Date.now()) / 3600000; }
  /** Nhãn "còn 18g" (mono). Đỏ chỉ khi < 3 giờ. */
  function timeLeft(hrs) {
    if (hrs < 0) return { text: 'đang diễn ra', cls: 'is-live' };
    var m = Math.round(hrs * 60);
    if (m < 60) return { text: 'còn ' + m + "'", cls: 'is-urgent' };
    var hh = Math.floor(m / 60), mm = m % 60;
    return { text: 'còn ' + hh + 'g' + (hh < 10 && mm >= 15 ? U.pad(mm) : ''), cls: hrs < 3 ? 'is-urgent' : '' };
  }
  /** Pill sự kiện có tôn trọng riêng tư + gắn data-prio. */
  function pill(ev, opts) {
    opts = opts || {};
    var st = S(), me = st.state.currentUserId, see = st.canSee(ev, me), html;
    if (see) html = UI.eventPill(ev, opts);
    else html = UI.eventPill(Object.assign({}, ev, { title: st.displayTitle(ev, me), location: '', projectId: null, attendeeIds: [] }), Object.assign({}, opts, { cls: ((opts.cls || '') + ' is-private').trim() }));
    html = html.replace('<div class="ev-pill', '<div data-prio="' + (ev.priority || 2) + '" class="ev-pill');
    if (opts.tab === -1) html = html.replace(' tabindex="0"', ' tabindex="-1"');
    return html;
  }
  function prioTag(ev) { return ev.priority === 1 ? raw('<span class="prio" data-p="1" title="Bắt buộc, cần chuẩn bị">P1</span>') : ''; }
  function travelTag(ev) { return ev.travelMinutes ? h`<span class="travel-tag">${icon('map-pin', 12)}đi sớm ~${ev.travelMinutes}'</span>` : ''; }

  /** Ca của một người trong ngày: loại, giờ, địa điểm (lấy từ lịch quay nếu on-site). */
  function shiftInfo(staffId, iso) {
    var st = S(), type = st.shiftOf(staffId, iso), t = st.shiftType(type), staff = st.staff(staffId);
    var info = { type: type, t: t, start: null, end: null, location: '', event: null, working: !(type === 'off' || type === 'leave') };
    var hrs = parseHours(t.hours); if (hrs) { info.start = hrs.start; info.end = hrs.end; }
    if (type === 'onsite') {
      var shoot = st.eventsFor(staffId, iso).filter(function (e) { return e.type === 'shoot'; })[0];
      if (shoot) { info.start = shoot.start; info.end = shoot.end; info.location = shoot.location || 'On-site'; info.event = shoot; }
      else { info.start = '08:00'; info.end = '17:00'; info.location = 'On-site'; }
    } else if (type === 'remote') info.location = 'Làm từ xa';
    else if (info.working) info.location = staff && staff.location === 'HCM' ? 'Văn phòng TP. HCM' : 'Văn phòng Hà Nội';
    return info;
  }
  function shiftTip(staffId, iso) {
    var info = shiftInfo(staffId, iso);
    if (info.type === 'off') return S().holidayName(iso) ? 'Nghỉ lễ' : U.isWeekend(iso) ? 'Cuối tuần' : 'Không xếp ca';
    if (info.type === 'leave') return 'Nghỉ phép';
    return info.t.label + (info.start ? ' ' + info.start + '–' + info.end : '') + (info.type === 'onsite' && info.location ? ' · ' + info.location : '');
  }
  /** Sự kiện sắp tới của một người tính từ ngày focus (đúng cả khi xem ngày khác). */
  function upcomingFor(staffId, fromISO, limit) {
    var st = S(), real = U.todayISO(), now = U.nowMinutes();
    var list = st.state.events.filter(function (e) {
      if (e.attendeeIds.indexOf(staffId) < 0) return false;
      if (e.date > fromISO) return true;
      if (e.date !== fromISO) return false;
      return fromISO !== real || e.allDay || U.timeToMin(e.end) >= now;
    });
    return U.sortBy(list, function (e) { return e.date + ' ' + e.start; }).slice(0, limit || 6);
  }
  /** Tải theo ngày của một người (%, so với 8g). */
  function dayLoad(staffId, iso) {
    var st = S(), type = st.shiftOf(staffId, iso);
    if (type === 'off' || type === 'leave') return null;
    var shiftMin = st.shiftType(type).minutes;
    var evMin = U.sum(st.eventsFor(staffId, iso), function (e) { return e.allDay ? 0 : Math.max(0, U.timeToMin(e.end) - U.timeToMin(e.start)); });
    return Math.round((shiftMin + Math.max(0, evMin - shiftMin * 0.5) * 0.5) / 480 * 100);
  }
  function heatLevel(pct) { if (pct == null) return 0; if (pct < 60) return 1; if (pct < 85) return 2; if (pct < 100) return 3; if (pct <= 110) return 4; return 5; }

  /** FLIP theo trục Y cho danh sách các node (đo → đổi DOM → đảo → chạy). */
  function flipY(nodes, mutate, dur) {
    nodes = nodes.filter(Boolean);
    if (reduceMotion()) { mutate(); return; }
    var first = nodes.map(function (n) { return n.getBoundingClientRect().top; });
    mutate();
    var last = nodes.map(function (n) { return n.getBoundingClientRect().top; });
    var moved = [];
    nodes.forEach(function (n, i) { var d = first[i] - last[i]; if (Math.abs(d) < 0.5 || !n.isConnected || n.hidden) return; n.style.transition = 'none'; n.style.transform = 'translateY(' + d + 'px)'; moved.push(n); });
    if (!moved.length) return;
    void document.body.offsetHeight;
    requestAnimationFrame(function () {
      moved.forEach(function (n) {
        n.style.transition = 'transform ' + (dur || 240) + 'ms var(--ease-inout)';
        n.style.transform = '';
        U.onceTransitionEnd(n, function () { n.style.transition = ''; n.style.transform = ''; }, (dur || 240) + 80);
      });
    });
  }

  /* --------------------------------------------------------------- view */
  function Dashboard(container, route) {
    var self = this;
    this.container = container;
    this.timers = [];
    this.unbinders = [];
    this.destroyed = false;
    this.inboxBusy = false;
    this.invBusy = false;
    this.attBusy = false;
    this.nudgeBatch = false;
    this.pendingRerender = false;
    this.invFocus = null;
    this.readRoute(route);
    this.kpiAnimated = false;
    this.execAnimated = false;

    var wherePref = U.loadJSON(KEYS.where, 'all');
    this.whereFilter = typeof wherePref === 'string' ? wherePref : 'all';
    this.funOpen = U.loadJSON(KEYS.fun, { open: true }).open !== false;

    this.buildShell();
    this.renderAll(true);
    this.bind();

    this.unsub = S().subscribe(function (state, meta) { self.onStore(meta); });
    this.unregisterKeys = [
      UI.shortcuts.register('i', function () { var b = self.container.querySelector('[data-checkin]'); if (b) b.click(); }, 'Check-in / Check-out', 'Hôm nay'),
      UI.shortcuts.register('a', function () { var c = self.container.querySelector('.db-req'); if (c) { c.focus(); c.scrollIntoView({ block: 'center', behavior: reduceMotion() ? 'auto' : 'smooth' }); } }, 'Tới yêu cầu đang chờ', 'Hôm nay'),
      UI.shortcuts.register('r', function () { var r = self.container.querySelector('.db-inv__row'); if (r) { r.focus(); r.scrollIntoView({ block: 'center', behavior: reduceMotion() ? 'auto' : 'smooth' }); } }, 'Tới lời mời chờ phản hồi', 'Hôm nay')
    ];
    this.timers.push(setInterval(function () { self.tick(); }, 30000));
    this.onVis = function () { if (!document.hidden) self.tick(); };
    document.addEventListener('visibilitychange', this.onVis);
  }

  /** View còn sống? (app tái dùng container nên phải kiểm tra block đã bị gỡ chưa) */
  Dashboard.prototype.alive = function () { return !this.destroyed && !!(this.blocks && this.blocks.head && this.blocks.head.isConnected); };
  Dashboard.prototype.later = function (fn, ms) { var self = this; var id = setTimeout(function () { if (self.alive()) fn(); }, ms); this.timers.push(id); return id; };

  Dashboard.prototype.readRoute = function (route) {
    var q = (route && route.query) || {};
    var real = U.todayISO();
    var iso = /^\d{4}-\d{2}-\d{2}$/.test(q.date || '') ? q.date : real;
    this.realISO = real;
    this.iso = iso;
    this.date = U.fromISO(iso);
    this.isReal = iso === real;
    var hour = new Date().getHours();
    this.friday = q.friday === '1' || (this.isReal && this.date.getDay() === 5 && hour >= 15);
  };

  Dashboard.prototype.setTitle = function () {
    var hol = S().holidayName(this.iso);
    Z15.app.setTitle('Hôm nay', U.fmtDate(this.date, 'long') + ' · Tuần ' + U.isoWeek(this.date) + (hol ? ' · ' + hol : ''));
  };

  Dashboard.prototype.buildShell = function () {
    var c = this.container;
    U.render(c, h`
      <div class="db">
        <header class="db-head reveal" style="--i:0" data-block="head"></header>
        <div class="db-grid">
          <div class="db-main">
            <section class="card card--hero db-hero reveal" style="--i:1" data-block="hero" aria-label="Ca của tôi"></section>
            <section class="card db-tl reveal" style="--i:2" data-block="timeline" aria-label="Dòng thời gian hôm nay"></section>
            <nav class="db-quick reveal" style="--i:3" data-block="quick" aria-label="Thao tác nhanh"></nav>
            <section class="card db-inv reveal" style="--i:4" data-block="invites" aria-label="Lời mời chờ bạn phản hồi" hidden></section>
            <section class="db-kpis reveal" style="--i:5" data-block="kpis" aria-label="KPI tuần"></section>
            <section class="card db-inbox reveal" style="--i:6" data-block="inbox" aria-label="Cần bạn xử lý"></section>
            <section class="card db-att reveal" style="--i:7" data-block="attention" aria-label="Sắp diễn ra · cần nhắc" hidden></section>
            <div class="db-duo">
              <section class="card db-up reveal" style="--i:8" data-block="upcoming" aria-label="Sắp tới của bạn"></section>
              <section class="card db-dl reveal" style="--i:8" data-block="deadlines" aria-label="Deadline 7 ngày"></section>
            </div>
          </div>
          <aside class="db-side">
            <section class="card db-exec reveal" style="--i:2" data-block="exec" aria-label="Sức khoẻ lịch tuần này" hidden></section>
            <section class="card db-where reveal" style="--i:3" data-block="where" aria-label="Ai đang ở đâu"></section>
            <section class="card db-pulse reveal" style="--i:5" data-block="pulse" aria-label="Nhịp đội"></section>
            <section class="card db-fun reveal" style="--i:7" data-block="fun" aria-label="Có gì vui"></section>
          </aside>
        </div>
      </div>`);
    this.blocks = {};
    U.qsa('[data-block]', c).forEach(function (b) { this.blocks[b.dataset.block] = b; }, this);
  };

  Dashboard.prototype.renderAll = function (first) {
    if (!this.alive()) return;
    this.setTitle();
    this.renderHead(); this.renderHero(); this.renderTimeline(); this.renderQuick(); this.renderInvites(); this.renderKpis(first);
    this.renderInbox(); this.renderAttention(); this.renderUpcoming(); this.renderDeadlines(); this.renderExec(); this.renderWhere(); this.renderPulse(); this.renderFun();
  };

  /* ---------------------------------------------------------- 1. header */
  Dashboard.prototype.renderHead = function () {
    var st = S(), me = st.me(), iso = this.iso, d = this.date;
    var hol = st.holidayName(iso), weekend = U.isWeekend(iso), workday = !hol && !weekend;
    var info = shiftInfo(me.id, iso);
    var myEvents = st.eventsFor(me.id, iso);
    var meetings = myEvents.filter(function (e) { return MEETING_TYPES[e.type]; }).length;
    var others = myEvents.length - meetings;
    var pending = st.pendingRequests().filter(function (r) { return r.staffId !== me.id; }).length;
    var invites = st.myPendingInvites ? st.myPendingInvites(me.id).length : 0;
    var eyebrow = U.weekdayLong(d) + ' · ' + U.fmtDate(d, 'dm') + ' · Tuần ' + U.isoWeek(d);
    var sub;
    if (hol) sub = h`Hôm nay nghỉ lễ <b>${hol}</b> 🇻🇳 — ngày làm việc tiếp theo: <b>${U.weekdayLong(U.fromISO(nextWorkday(iso)))} ${U.fmtDate(nextWorkday(iso), 'dm')}</b>.`;
    else if (weekend) sub = h`Cuối tuần rồi — ngày làm việc tiếp theo: <b>${U.weekdayLong(U.fromISO(nextWorkday(iso)))} ${U.fmtDate(nextWorkday(iso), 'dm')}</b>.`;
    else {
      var parts = [];
      parts.push(info.type === 'leave' ? raw('bạn <b>nghỉ phép</b>') : info.working ? h`<b>1 ca</b> ${info.t.label.toLowerCase()}` : raw('<b>chưa xếp ca</b>'));
      parts.push(meetings ? h`<b>${meetings}</b> cuộc họp` : raw('không có cuộc họp'));
      if (others) parts.push(h`<b>${others}</b> việc khác`);
      if (invites) parts.push(h`<a href="#/dashboard" data-jump="invites"><b>${invites}</b> lời mời chờ phản hồi</a>`);
      parts.push(pending ? h`<a href="#/requests"><b>${pending}</b> yêu cầu chờ bạn duyệt</a>` : raw('không có yêu cầu chờ'));
      var joined = parts.map(function (p, i) { return i ? raw(' <span class="db-head__sep">·</span> ' + p.s) : p; });
      sub = h`${this.isReal ? 'Hôm nay' : dmw(iso)}: ${joined}.`;
    }
    U.render(this.blocks.head, h`
      <div class="db-head__eyebrow eyebrow"><span>${eyebrow}</span>${hol ? h`<span class="chip chip--type chip--xs">${icon('star', 11)}<span>${hol}</span></span>` : ''}${!this.isReal ? h`<a class="chip chip--blue chip--xs" href="#/dashboard">${icon('arrow-left', 11)}<span>Về hôm nay</span></a>` : ''}</div>
      <h2 class="t-display db-head__greet">${U.greeting()}, ${U.firstName(me.name)}</h2>
      <p class="db-head__sub">${sub}</p>`);
  };

  /* ------------------------------------------------------------ 2. hero */
  Dashboard.prototype.checkinState = function () {
    var c = U.loadJSON(KEYS.checkin, null);
    return c && c.date === this.iso ? c : null;
  };
  /** Sự kiện tiếp theo của tôi (từ ngày focus): kèm số phút còn lại nếu là hôm nay thật. */
  Dashboard.prototype.nextEvent = function (staffId, fromISO) {
    var st = S(), real = U.todayISO(), now = U.nowMinutes();
    var e = upcomingFor(staffId, fromISO, 1)[0]; if (!e) return null;
    var mins = e.date === real && !e.allDay ? U.timeToMin(e.start) - now : null;
    var live = mins != null && mins <= 0 && U.timeToMin(e.end) > now;
    return { ev: e, mins: mins, live: live, rsvp: st.rsvpOf(e, staffId), mine: e.ownerId === staffId };
  };
  function nextTimeText(nx) {
    if (nx.live) return 'đang diễn ra · còn ' + U.fmtDuration(U.timeToMin(nx.ev.end) - U.nowMinutes());
    if (nx.mins == null) return nx.ev.allDay ? 'Cả ngày' : nx.ev.start;
    var m = Math.max(0, Math.round(nx.mins));
    return m < 60 ? "còn " + m + "'" : 'còn ' + U.fmtDuration(m);
  }
  Dashboard.prototype.nextRow = function (nx, eyebrow) {
    if (!nx) return '';
    var soon = nx.mins != null && nx.mins < 180 && !nx.live;
    return h`<div class="db-hero__next">
      <div class="db-hero__nextrow">
        <span class="eyebrow">${eyebrow}</span>
        <span class="mono db-hero__nexttime tnum${soon ? ' is-soon' : ''}${nx.live ? ' is-live' : ''}" data-next-time="${nx.ev.id}">${nextTimeText(nx)}</span>
        ${prioTag(nx.ev)}${travelTag(nx.ev)}
        ${nx.rsvp === 'pending' && !nx.mine ? h`<span class="chip chip--xs chip--warn" title="Bạn chưa trả lời lời mời này"><i class="rsvp-dot" data-rsvp="pending"></i><span>Chưa phản hồi</span></span>` : ''}
      </div>
      ${raw(pill(nx.ev, { cls: nx.mine ? 'is-mine' : '' }))}
    </div>`;
  };
  Dashboard.prototype.renderHero = function () {
    if (!this.alive()) return;
    var st = S(), me = st.me(), iso = this.iso, block = this.blocks.hero;
    block.classList.remove('db-hero--recap');
    if (this.friday) return this.renderRecap();
    var hol = st.holidayName(iso), weekend = U.isWeekend(iso), info = shiftInfo(me.id, iso);
    var calHref = '#/calendar/week/' + iso;

    if (!info.working) {
      var nx = nextWorkday(iso), nxInfo = shiftInfo(me.id, nx), nxEv = this.nextEvent(me.id, nx);
      var eyebrow = hol ? 'Hôm nay nghỉ lễ' : weekend ? 'Cuối tuần' : info.type === 'leave' ? 'Bạn đang nghỉ phép' : 'Hôm nay không có ca';
      var title = hol ? hol + ' 🇻🇳' : weekend ? 'Nghỉ ngơi thôi' : info.type === 'leave' ? 'Nghỉ phép' : 'Chưa xếp ca';
      var body = hol ? 'Nghỉ ngơi cho khoẻ — mọi thứ vẫn đang đúng nhịp.' : weekend ? 'Việc tuần này đã xong phần của nó. Hẹn gặp lại đầu tuần.' : info.type === 'leave' ? 'Tận hưởng kỳ nghỉ nhé, lịch vẫn được giữ ổn.' : 'Có thể quản lý chưa xếp — bạn có thể nhắc một câu.';
      U.render(block, h`
        <div class="db-hero__grid">
          <div class="db-hero__main">
            <div class="eyebrow db-hero__eyebrow">${eyebrow}</div>
            <div class="db-hero__title t-display">${title}</div>
            <p class="db-hero__body">${body}</p>
            <div class="db-hero__next">
              <div class="eyebrow">Ngày làm việc tiếp theo · ${dmw(nx)}</div>
              <div class="db-hero__nextrow">
                ${raw(UI.shiftBadge(nxInfo.type, { label: true, cls: 'shift--lg' }))}
                ${nxInfo.start ? h`<span class="mono db-hero__nexttime">${nxInfo.start} – ${nxInfo.end}</span>` : ''}
                ${nxInfo.location ? h`<span class="db-hero__loc">${icon('map-pin', 14)}${nxInfo.location}</span>` : ''}
              </div>
              ${nxEv ? h`<div class="db-hero__nextrow db-hero__nextrow--tags">${nxEv.ev.date !== nx ? h`<span class="faint t-body-sm">${dmw(nxEv.ev.date)}</span>` : ''}${prioTag(nxEv.ev)}${travelTag(nxEv.ev)}${nxEv.rsvp === 'pending' && !nxEv.mine ? h`<span class="chip chip--xs chip--warn"><i class="rsvp-dot" data-rsvp="pending"></i><span>Chưa phản hồi</span></span>` : ''}</div>${raw(pill(nxEv.ev, { cls: nxEv.mine ? 'is-mine' : '' }))}` : h`<p class="muted t-body-sm">Chưa có sự kiện nào trong ngày đó.</p>`}
            </div>
          </div>
          <div class="db-hero__cta">
            <a class="btn btn--primary btn--lg" href="${calHref}">${icon('calendar-days', 16)}<span>Xem lịch tuần</span></a>
            ${!hol && !weekend && info.type !== 'leave' ? h`<button class="btn btn--ghost" data-action="remind">${icon('send', 15)}<span>Nhắc quản lý</span></button>` : ''}
          </div>
        </div>`);
      return;
    }

    var mates = st.state.staff.filter(function (s) { return s.id !== me.id && st.shiftOf(s.id, iso) === info.type; });
    mates = U.sortBy(mates, function (s) { return (s.teamId === me.teamId ? '0' : '1') + s.name; });
    var ci = this.checkinState();
    var now = U.nowMinutes(), startM = U.timeToMin(info.start), endM = U.timeToMin(info.end);
    var phase = !this.isReal ? 'other' : now < startM ? 'before' : now < endM ? 'during' : 'after';
    var liveTxt = this.liveText(info, ci);
    var inState = ci ? (ci.out ? 'out' : 'in') : 'none';
    var next = this.nextEvent(me.id, iso);
    var nextEyebrow = next ? (next.ev.date === iso ? 'Tiếp theo' : 'Tiếp theo · ' + dmw(next.ev.date)) : '';
    U.render(block, h`
      <div class="db-hero__grid">
        <div class="db-hero__main">
          <div class="eyebrow db-hero__eyebrow">Ca của tôi · ${dmw(iso)}</div>
          <div class="db-hero__time mono tnum">${info.start} – ${info.end}</div>
          <div class="db-hero__meta">
            ${raw(UI.shiftBadge(info.type, { label: true, cls: 'shift--lg' }))}
            <span class="db-hero__loc">${icon('map-pin', 14)}<span>${info.location}</span></span>
            ${info.event ? h`<button class="chip chip--btn chip--color" style="--chip:${(st.project(info.event.projectId) || {}).color || 'var(--ev-shoot)'}" data-event-open="${info.event.id}"><i class="chip__dot"></i><span>${st.displayTitle(info.event, me.id)}</span></button>` : ''}
          </div>
          <div class="db-hero__mates">
            ${mates.length ? raw(UI.avatarStack(mates, { max: 5, size: 'sm' })) : ''}
            <span class="db-hero__matestxt">${mates.length ? h`Cùng ca với bạn · <b>${mates.length}</b> người` : 'Chỉ mình bạn ở ca này hôm nay'}</span>
          </div>
          ${this.nextRow(next, nextEyebrow)}
        </div>
        <div class="db-hero__cta">
          <div class="db-checkin${inState !== 'none' ? ' is-in is-settled' : ''}" data-phase="${phase}" data-state="${inState}">
            ${inState === 'in' && phase === 'after'
              ? h`<button class="btn btn--primary btn--lg db-checkin__btn" data-checkin="out">${icon('log-out', 16)}<span>Check-out</span></button>`
              : h`<button class="btn btn--primary btn--lg db-checkin__btn" data-checkin="in"${phase === 'other' ? ' disabled aria-disabled="true"' : ''}>${icon('check-circle', 16)}<span>Check-in</span></button>`}
            <span class="db-live" aria-live="polite">
              <span class="db-live__mark"><svg class="db-live__ring" viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="10" pathLength="1"/></svg><i class="db-live__dot${inState === 'in' ? ' is-live-dot' : ''}"></i></span>
              <span class="db-live__txt">${raw(liveTxt)}</span>
            </span>
          </div>
          <a class="btn btn--ghost" href="${calHref}">${icon('calendar-days', 15)}<span>Xem lịch tuần</span></a>
        </div>
      </div>`);
  };
  /** Chữ trạng thái sau check-in. */
  Dashboard.prototype.liveText = function (info, ci) {
    if (!ci) return '';
    if (ci.out) return 'Đã check-out · <b class="tnum">' + U.escapeHtml(ci.out) + '</b>';
    var now = U.nowMinutes(), startM = U.timeToMin(info.start), endM = U.timeToMin(info.end);
    if (!this.isReal) return 'Đã check-in · <b class="tnum">' + U.escapeHtml(ci.time) + '</b>';
    if (now < startM) return 'Đã check-in · ca bắt đầu <b class="tnum">' + U.escapeHtml(info.start) + '</b>';
    if (now < endM) return 'Đang trực · <b class="tnum">còn ' + U.escapeHtml(U.fmtDuration(endM - now)) + '</b>';
    return 'Hết ca lúc <b class="tnum">' + U.escapeHtml(info.end) + '</b> · nhớ check-out';
  };
  Dashboard.prototype.doCheckin = function (btn) {
    var me = S().me(), info = shiftInfo(me.id, this.iso), wrap = btn.closest('.db-checkin');
    var mode = btn.dataset.checkin, nowStr = U.minToTime(U.nowMinutes());
    var ci = this.checkinState() || { date: this.iso, time: nowStr };
    if (mode === 'out') { ci.out = nowStr; U.saveJSON(KEYS.checkin, ci); this.renderHero(); UI.toast('Đã check-out lúc ' + nowStr + ' — nghỉ ngơi thôi!', { kind: 'success' }); return; }
    ci = { date: this.iso, time: nowStr }; U.saveJSON(KEYS.checkin, ci);
    var live = wrap.querySelector('.db-live'), txt = wrap.querySelector('.db-live__txt'), dot = wrap.querySelector('.db-live__dot');
    txt.innerHTML = this.liveText(info, ci);
    wrap.dataset.state = 'in';
    if (reduceMotion()) { wrap.classList.add('is-in', 'is-settled'); dot.classList.add('is-live-dot'); }
    else {
      wrap.classList.add('is-in');
      requestAnimationFrame(function () { live.classList.add('is-sweep'); });
      this.later(function () { dot.classList.add('is-live-dot'); wrap.classList.add('is-settled'); }, 620);
    }
    UI.toast('Check-in lúc ' + nowStr + ' · ' + info.t.label + (info.location ? ' · ' + info.location : ''), { kind: 'brand', title: 'Chúc bạn một ngày hiệu quả' });
  };

  /* ------------------------------------------------------- Friday recap */
  Dashboard.prototype.renderRecap = function () {
    var st = S(), block = this.blocks.hero, days = U.weekDays(this.date);
    var from = U.toISO(days[0]), to = U.toISO(days[6]);
    var shifts = U.sum(days, function (d) { return st.dayStats(U.toISO(d)).onDuty; });
    var events = st.eventsBetween(from, to).length;
    var approved = st.state.requests.filter(function (r) { return r.status === 'approved' && ((r.decidedAt && r.decidedAt.slice(0, 10) >= from && r.decidedAt.slice(0, 10) <= to) || (r.from <= to && r.to >= from)); }).length;
    var me = st.me(), myEv = st.eventsForStaffBetween(me.id, from, to).length;
    var nextMon = U.toISO(U.addDays(days[0], 7));
    block.classList.add('db-hero--recap');
    U.render(block, h`
      <div class="db-hero__grid">
        <div class="db-hero__main">
          <div class="eyebrow db-hero__eyebrow">Friday mode · Tuần ${U.isoWeek(this.date)}</div>
          <div class="db-hero__title t-display">Tuần ${U.isoWeek(this.date)} khép lại</div>
          <p class="db-hero__body">Đội đã phủ <b class="tnum" data-count="${shifts}">0</b> ca, <b class="tnum" data-count="${events}">0</b> sự kiện, <b class="tnum" data-count="${approved}">0</b> yêu cầu được duyệt. Riêng bạn góp mặt ở <b class="tnum" data-count="${myEv}">0</b> sự kiện. Cảm ơn bạn 🙌</p>
          <div class="db-recap__stats">
            <div class="db-recap__stat"><span class="eyebrow">Ca đã phủ</span><b class="mono tnum" data-count="${shifts}">0</b></div>
            <div class="db-recap__stat"><span class="eyebrow">Sự kiện</span><b class="mono tnum" data-count="${events}">0</b></div>
            <div class="db-recap__stat"><span class="eyebrow">Yêu cầu duyệt</span><b class="mono tnum" data-count="${approved}">0</b></div>
          </div>
        </div>
        <div class="db-hero__cta db-hero__cta--recap">
          <div class="db-recap__ring" role="img" aria-label="Tuần hoàn thành 100%">
            <svg viewBox="0 0 64 64" aria-hidden="true"><circle class="db-recap__track" cx="32" cy="32" r="28"/><circle class="db-recap__arc" cx="32" cy="32" r="28" pathLength="100"/></svg>
            <span class="db-recap__pct mono tnum">100%</span>
          </div>
          <a class="btn btn--primary btn--lg" href="#/calendar/week/${nextMon}">${icon('arrow-right', 16)}<span>Xem lịch tuần sau</span></a>
        </div>
      </div>`);
    var reduce = reduceMotion();
    U.qsa('[data-count]', block).forEach(function (el) { var v = +el.dataset.count; if (reduce) el.textContent = fmtNum(v, 0); else U.countUp(el, v, { duration: 900, format: function (x) { return fmtNum(Math.round(x), 0); } }); });
    var arc = block.querySelector('.db-recap__arc');
    if (arc) { if (reduce) arc.classList.add('is-full'); else requestAnimationFrame(function () { requestAnimationFrame(function () { arc.classList.add('is-full'); }); }); }
  };

  /* -------------------------------------------------------- 3. timeline */
  Dashboard.prototype.renderTimeline = function () {
    var st = S(), me = st.me(), block = this.blocks.timeline;
    var iso = this.iso, hol = st.holidayName(iso);
    var evsOn = function (d) { return st.eventsOn(d); };
    var mineOn = function (d) { return st.eventsFor(me.id, d); };
    var showISO = iso, caption = '';
    if (!mineOn(iso).length && !isWorkday(iso)) { showISO = nextWorkday(iso); caption = 'Ngày làm việc tiếp theo · ' + dmw(showISO); }
    else if (!mineOn(iso).length && !evsOn(iso).length) { showISO = nextWorkday(iso); caption = 'Hôm nay trống · xem ' + dmw(showISO); }
    this.tlISO = showISO;
    var team = st.staffByTeam(me.teamId).map(function (s) { return s.id; });
    var list = evsOn(showISO).filter(function (e) { return !e.allDay; }).map(function (e) {
      var mine = e.attendeeIds.indexOf(me.id) >= 0 || e.ownerId === me.id;
      var teamEv = !mine && e.attendeeIds.some(function (id) { return team.indexOf(id) >= 0; });
      return { e: e, mine: mine, team: teamEv };
    }).filter(function (x) { return x.mine || x.team; });
    var allDay = evsOn(showISO).filter(function (e) { return e.allDay && (e.attendeeIds.indexOf(me.id) >= 0 || e.attendeeIds.some(function (id) { return team.indexOf(id) >= 0; })); });
    // lanes
    var lanes = [];
    U.sortBy(list, function (x) { return (x.mine ? '0' : '1') + x.e.start; }).forEach(function (x) {
      var s = Math.max(TL_START, U.timeToMin(x.e.start)), en = Math.min(TL_END, Math.max(U.timeToMin(x.e.end), s + 25));
      var li = lanes.findIndex(function (l) { return l.end <= s; });
      if (li < 0) { if (lanes.length >= 4) li = lanes.length - 1; else { lanes.push({ end: 0, items: [] }); li = lanes.length - 1; } }
      lanes[li].end = Math.max(lanes[li].end, en); x.lane = li; x.s = s; x.en = en;
    });
    var now = U.nowMinutes(), real = U.todayISO(), showNow = showISO === real && now >= TL_START && now <= TL_END;
    var hours = []; for (var m = TL_START; m <= TL_END; m += 60) hours.push(m);
    var laneCount = Math.max(1, lanes.length);
    var hasPending = list.some(function (x) { return x.mine && x.e.ownerId !== me.id && x.e.attendeeIds.indexOf(me.id) >= 0 && st.rsvpOf(x.e, me.id) === 'pending'; });
    var blocks = list.map(function (x) {
      var e = x.e, see = st.canSee(e, me.id), p = see && e.projectId ? st.project(e.projectId) : null, isPoint = U.timeToMin(e.end) <= U.timeToMin(e.start);
      var title = st.displayTitle(e, me.id), loc = see ? e.location : '';
      var left = (x.s - TL_START) / TL_SPAN * 100, width = (x.en - x.s) / TL_SPAN * 100;
      var live = isLive(e, real, now), past = showISO === real && !live && U.timeToMin(e.end) <= now;
      var pending = x.mine && e.ownerId !== me.id && e.attendeeIds.indexOf(me.id) >= 0 && st.rsvpOf(e, me.id) === 'pending';
      var cls = 'db-tl__ev' + (x.mine ? ' is-mine' : ' is-team') + (live ? ' is-live' : '') + (past ? ' is-past' : '') + (isPoint ? ' is-point' : '') + (pending ? ' is-pending' : '') + (see ? '' : ' is-private') + (width < 4.5 ? ' is-narrow' : width < 9 ? ' is-tight' : '');
      var style = 'left:' + left.toFixed(3) + '%;width:' + width.toFixed(3) + '%;--lane:' + x.lane + (p ? ';--ev:' + p.color : '');
      var label = title + ', ' + timeRange(e.start, e.end) + (loc ? ', ' + loc : '') + (x.mine ? ', của bạn' : ', team ' + (st.team(me.teamId) || {}).name) + (pending ? ', bạn chưa phản hồi' : '') + (e.priority === 1 && see ? ', ưu tiên P1' : '');
      return h`<button type="button" class="${cls}" data-type="${e.type}" data-prio="${e.priority || 2}" data-event-open="${e.id}" style="${style}" aria-label="${label}" data-tip="${title + ' · ' + timeRange(e.start, e.end) + (pending ? ' · chưa phản hồi' : '')}"><span class="db-tl__evtitle">${title}</span><span class="db-tl__evmeta mono-sm">${isPoint ? e.start : timeRange(e.start, e.end)}</span></button>`;
    });
    U.render(block, h`
      <div class="card__head db-tl__head">
        <div><div class="card__eyebrow">Dòng thời gian</div><h3 class="card__title">${caption ? caption : (this.isReal ? 'Hôm nay' : dmw(showISO)) + ' · 06:00 – 22:00'}</h3></div>
        <div class="db-tl__legend"><span><i class="db-tl__lg db-tl__lg--mine"></i>Của bạn</span><span><i class="db-tl__lg db-tl__lg--team"></i>Team ${(st.team(me.teamId) || {}).name}</span>${hasPending ? h`<span><i class="db-tl__lg db-tl__lg--pending"></i>Chưa phản hồi</span>` : ''}${showNow ? h`<span><i class="db-tl__lg db-tl__lg--now"></i>Bây giờ</span>` : ''}</div>
      </div>
      ${allDay.length ? h`<div class="db-tl__allday">${allDay.map(function (e) { var see = st.canSee(e, me.id), p = see && e.projectId ? st.project(e.projectId) : null; return h`<button type="button" class="chip chip--btn chip--color" style="--chip:${p ? p.color : 'var(--ev-' + e.type + ')'}" data-event-open="${e.id}"><i class="chip__dot"></i><span>Cả ngày · ${st.displayTitle(e, me.id)}</span></button>`; })}</div>` : ''}
      <div class="db-tl__scroll">
        <div class="db-tl__track" style="--lanes:${laneCount}">
          <div class="db-tl__hours">${hours.map(function (m, i) { return h`<span class="db-tl__hour${m === 12 * 60 ? ' is-noon' : ''}" style="left:${(m - TL_START) / TL_SPAN * 100}%"><i></i><b class="mono-sm">${U.pad(m / 60)}</b></span>`; })}</div>
          <div class="db-tl__lanes">${list.length ? blocks : h`<div class="db-tl__empty muted">Không có sự kiện nào của bạn hoặc team trong khung này.</div>`}</div>
          ${showNow ? h`<div class="now-line db-tl__now" style="left:${(now - TL_START) / TL_SPAN * 100}%" aria-hidden="true"><span class="db-tl__nowlbl mono-sm tnum">${U.minToTime(now)}</span></div>` : ''}
        </div>
      </div>`);
  };

  /* ---------------------------------------------------- 4. quick actions */
  Dashboard.prototype.remoteTarget = function () {
    var me = S().me();
    return (isWorkday(this.iso) || shiftInfo(me.id, this.iso).working) ? this.iso : nextWorkday(this.iso);
  };
  Dashboard.prototype.renderQuick = function () {
    var target = this.remoteTarget();
    var remoteLabel = target === this.iso ? 'Remote hôm nay' : 'Remote ' + dmw(target);
    var already = S().shiftOf(S().me().id, target) === 'remote';
    U.render(this.blocks.quick, h`
      <button type="button" class="btn btn--secondary" data-action="leave">${icon('umbrella', 16)}<span>Xin nghỉ phép</span></button>
      <button type="button" class="btn btn--secondary" data-action="swap">${icon('repeat', 16)}<span>Đổi ca</span></button>
      <button type="button" class="btn btn--secondary" data-action="ot">${icon('hourglass', 16)}<span>Đăng ký OT</span></button>
      <button type="button" class="btn btn--secondary${already ? ' is-on' : ''}" data-action="remote" data-target="${target}" data-tip="${target === this.iso ? 'Đổi ca hôm nay sang làm từ xa (1 chạm)' : 'Hôm nay không có ca — áp dụng cho ' + dmw(target)}">${icon('laptop', 16)}<span>${remoteLabel}</span>${already ? icon('check', 14) : ''}</button>
      <button type="button" class="btn btn--secondary" data-action="event">${icon('plus-circle', 16)}<span>Tạo sự kiện</span></button>`);
  };
  Dashboard.prototype.doRemote = function (btn) {
    var st = S(), me = st.me(), target = btn.dataset.target, prev = st.shiftOf(me.id, target);
    if (prev === 'remote') { UI.toast('Bạn đã làm từ xa ' + (target === this.iso ? 'hôm nay' : dmw(target)) + ' rồi.', { kind: 'info' }); return; }
    if (prev === 'leave') { UI.toast('Bạn đang nghỉ phép ' + dmw(target) + ' — không cần remote.', { kind: 'info' }); return; }
    st.setShift(me.id, target, 'remote');
    UI.toast((target === this.iso ? 'Hôm nay' : dmw(target)) + ' của bạn → Làm từ xa' + (target !== this.iso ? ' (hôm nay không có ca)' : ''), { kind: 'success', action: { label: 'Hoàn tác', onClick: function () { st.setShift(me.id, target, prev); UI.toast('Đã khôi phục ca ' + st.shiftType(prev).label.toLowerCase(), { kind: 'info' }); } } });
  };

  /* --------------------------------------- 4b. Lời mời chờ bạn phản hồi */
  /** Gỡ hàng khỏi danh sách với chuyển động rời (translateX + mờ) rồi FLIP các hàng/khối phía sau. */
  Dashboard.prototype.leaveRows = function (block, rows, rowSel, done) {
    var self = this;
    if (!rows.length || reduceMotion()) { done(); return; }
    var all = U.qsa(rowSel, block), focusIdx = -1;
    rows.forEach(function (r) { if (r.contains(document.activeElement)) focusIdx = all.indexOf(r); });
    rows.forEach(function (r) { r.classList.add('is-leaving'); });
    this.later(function () {
      var remaining = U.qsa(rowSel, block).filter(function (r) { return rows.indexOf(r) < 0; });
      var followers = []; var sib = block.nextElementSibling; while (sib) { followers.push(sib); sib = sib.nextElementSibling; }
      var foot = block.querySelector('.card__foot'), willHide = !remaining.length;
      var nodes = willHide ? followers : remaining.concat(foot ? [foot] : []).concat(followers);
      flipY(nodes, function () {
        rows.forEach(function (r) { r.remove(); });
        if (willHide) block.hidden = true;
        if (focusIdx >= 0) { var nxt = remaining[Math.min(focusIdx, remaining.length - 1)]; if (nxt && nxt.focus) nxt.focus({ preventScroll: true }); }
      }, 240);
      self.later(done, 260);
    }, 200);
  };
  Dashboard.prototype.renderInvites = function () {
    if (!this.alive() || this.invBusy) return;
    var st = S(), me = st.me(), block = this.blocks.invites, self = this;
    var all = st.myPendingInvites ? st.myPendingInvites(me.id) : [];
    var list = all.slice(0, INVITES_MAX);
    if (!list.length) { block.hidden = true; block.innerHTML = ''; this.invFocus = null; return; }
    var focusId = this.invFocus || (document.activeElement && block.contains(document.activeElement) && document.activeElement.closest('.db-inv__row') ? document.activeElement.closest('.db-inv__row').dataset.inv : null);
    this.invFocus = null;
    block.hidden = false;
    U.render(block, h`
      <div class="card__head">
        <div><div class="card__eyebrow">RSVP</div><h3 class="card__title">Lời mời chờ bạn phản hồi <span class="db-count faint">· ${all.length}</span></h3></div>
        <span class="db-inv__hint muted">${raw(UI.kbd('↑'))}${raw(UI.kbd('↓'))} chọn · ${raw(UI.kbd('Y'))} dự · ${raw(UI.kbd('M'))} có thể · ${raw(UI.kbd('N'))} vắng</span>
      </div>
      <div class="db-inv__list" role="list">${list.map(function (ev) { return self.inviteRow(ev); })}</div>
      ${all.length > list.length ? h`<div class="card__foot"><span>Còn ${all.length - list.length} lời mời khác</span><a class="link-btn" href="#/calendar?staff=${me.id}">Lịch của tôi →</a></div>` : ''}`);
    if (focusId) { var again = block.querySelector('.db-inv__row[data-inv="' + focusId + '"]'); if (again) again.focus({ preventScroll: true }); }
  };
  Dashboard.prototype.inviteRow = function (ev) {
    var st = S(), me = st.me(), owner = st.staff(ev.ownerId), Ed = E();
    var when = dmw(ev.date) + ' · ' + (ev.allDay ? 'Cả ngày' : timeRange(ev.start, ev.end));
    var rel = U.daysBetween(this.realISO, ev.date), relTxt = rel === 0 ? 'Hôm nay' : rel === 1 ? 'Ngày mai' : rel > 1 && rel < 7 ? U.weekdayLong(U.fromISO(ev.date)) : dmw(ev.date);
    return h`
      <article class="db-inv__row" role="listitem" tabindex="0" data-inv="${ev.id}" data-prio="${ev.priority || 2}" aria-label="Lời mời: ${ev.title}, ${when}${owner ? ', mời bởi ' + U.shortName(owner.name) : ''}. Nhấn Y để tham dự, M có thể, N vắng.">
        <div class="db-inv__main">
          ${raw(pill(ev, { tab: -1 }))}
          <div class="db-inv__from">
            ${owner ? h`${raw(UI.avatar(owner, { size: 'xs', title: false }))}<span><b>${U.shortName(owner.name)}</b> mời · ${relTxt}</span>` : h`<span>${relTxt}</span>`}
            ${prioTag(ev)}${travelTag(ev)}
          </div>
        </div>
        ${raw(Ed && Ed.rsvpBar ? Ed.rsvpBar(ev, me.id) : '')}
      </article>`;
  };
  /** Sau khi trả lời: hàng rời đi, các hàng còn lại FLIP; hết lời mời thì khối tự ẩn. */
  Dashboard.prototype.onRsvp = function (meta) {
    var me = S().state.currentUserId, block = this.blocks.invites, self = this;
    var row = meta && meta.staffId === me && meta.id ? block.querySelector('.db-inv__row[data-inv="' + meta.id + '"]') : null;
    if (row && !this.invBusy) {
      this.invBusy = true;
      var all = U.qsa('.db-inv__row', block), i = all.indexOf(row), nxt = all[i + 1] || all[i - 1];
      if (row.contains(document.activeElement) && nxt) this.invFocus = nxt.dataset.inv;
      this.leaveRows(block, [row], '.db-inv__row', function () { self.invBusy = false; self.renderInvites(); });
    } else this.renderInvites();
  };

  /* ------------------------------------------------------------- 8. KPI */
  Dashboard.prototype.renderKpis = function (first) {
    var st = S(), me = st.me(), block = this.blocks.kpis;
    var days = U.weekDays(this.date), from = U.toISO(days[0]), to = U.toISO(days[6]);
    var hours = st.weekHours(me.id, this.iso), events = st.eventsForStaffBetween(me.id, from, to).length, pending = st.pendingRequests().length;
    var wl = st.workload(me.id, this.iso);
    var animate = false;
    if (first && !this.kpiAnimated) { var last = U.loadJSON(KEYS.reveal, null); animate = last !== this.realISO && !reduceMotion(); U.saveJSON(KEYS.reveal, this.realISO); this.kpiAnimated = true; }
    var leavePct = LEAVE_LEFT / LEAVE_TOTAL * 100, hoursPct = U.clamp(hours / (me.capacity || 40) * 100, 0, 100);
    var over = hours > 48; // đỏ chỉ khi thật sự vượt trần giờ; tải sự kiện cao dùng tông cảnh báo + banner bên dưới
    var barColor = over ? 'var(--red-ink)' : (hoursPct >= 90 || wl.percent > 100) ? 'var(--warn)' : 'var(--action)';
    U.render(block, h`
      <div class="db-kpis__grid">
        <div class="card kpi db-kpi"><span class="kpi__label">${icon('clock', 13)}Giờ theo ca tuần này</span><span class="kpi__value"><span data-kpi="${hours}" data-dec="1">${animate ? '0' : fmtNum(hours)}</span><small>/ ${me.capacity || 40}g</small></span>${raw(UI.progress(animate ? 0 : hoursPct, { size: 'xs', color: barColor }))}<span class="kpi__delta${over ? ' is-warn' : ''}">${over ? raw(UI.icon('alert-triangle', 13) + ' Vượt trần 48g') : wl.percent > 100 ? 'Ca trong quota · sự kiện dày' : hours >= 36 ? 'Tuần đủ nhịp' : 'Còn dư sức tuần này'}</span></div>
        <div class="card kpi db-kpi"><span class="kpi__label">${icon('calendar', 13)}Sự kiện tuần này</span><span class="kpi__value"><span data-kpi="${events}" data-dec="0">${animate ? '0' : events}</span></span><span class="kpi__delta">${st.eventsFor(me.id, this.iso).length} vào ${this.isReal ? 'hôm nay' : dmw(this.iso)}</span></div>
        <div class="card kpi db-kpi db-kpi--leave"><span class="kpi__label">${icon('umbrella', 13)}Ngày phép còn lại</span><div class="db-kpi__row"><span class="kpi__value"><span data-kpi="${LEAVE_LEFT}" data-dec="1">${animate ? '0' : fmtNum(LEAVE_LEFT)}</span><small>/ ${LEAVE_TOTAL}</small></span><span class="db-arc" role="img" aria-label="Còn ${fmtNum(LEAVE_LEFT)} trên ${LEAVE_TOTAL} ngày phép"><svg viewBox="0 0 40 40" aria-hidden="true"><circle class="db-arc__track" cx="20" cy="20" r="17"/><circle class="db-arc__fill" cx="20" cy="20" r="17" pathLength="100" style="stroke-dashoffset:${animate ? 100 : 100 - leavePct}"/></svg></span></div><span class="kpi__delta">Hết hạn 31/12 · dùng dần nhé</span></div>
        <div class="card kpi db-kpi"><span class="kpi__label">${icon('inbox', 13)}Yêu cầu chờ duyệt</span><span class="kpi__value"><span data-kpi="${pending}" data-dec="0">${animate ? '0' : pending}</span></span><span class="kpi__delta">${pending ? h`<a href="#/requests">Xử lý ngay →</a>` : 'Hộp thư sạch. Tuyệt.'}</span></div>
      </div>
      ${wl.percent > 100
        ? h`<div class="banner banner--warn db-kpis__banner" role="status">${icon('alert-triangle', 16)}<span>Tuần này bạn đang ở mức <b class="tnum">${wl.percent}%</b> — cân nhắc dời 1–2 việc không gấp.</span></div>`
        : h`<p class="db-kpis__note muted">Tải công việc tuần này <b class="tnum">${wl.percent}%</b> · ${wl.percent >= 90 ? 'sát ngưỡng, giữ nhịp nhé' : 'trong ngưỡng, nhịp ổn'} · ${fmtHours(wl.shiftHours)} ca + ${fmtHours(wl.eventHours)} sự kiện</p>`}`);
    if (animate) {
      U.qsa('[data-kpi]', block).forEach(function (el) { var v = +el.dataset.kpi, dec = +el.dataset.dec; U.countUp(el, v, { duration: 900, format: function (x) { return fmtNum(dec ? Math.round(x * 10) / 10 : Math.round(x), dec); } }); });
      requestAnimationFrame(function () { requestAnimationFrame(function () {
        var bar = block.querySelector('.progress__bar'); if (bar) bar.style.width = hoursPct + '%';
        var arc = block.querySelector('.db-arc__fill'); if (arc) { arc.classList.add('is-anim'); arc.style.strokeDashoffset = String(100 - leavePct); }
      }); });
    }
  };

  /* ---------------------------------------------------- 5. Cần bạn xử lý */
  Dashboard.prototype.impactLine = function (r) {
    var st = S(), who = st.staff(r.staffId); if (!who) return { text: '', over: false };
    var team = st.team(who.teamId), members = st.staffByTeam(who.teamId), n = members.length;
    var multi = r.from !== r.to;
    if (r.type === 'leave') {
      var onDuty = members.filter(function (m) { return m.id !== who.id && !/leave|off/.test(st.shiftOf(m.id, r.from)); }).length;
      return { icon: 'users', text: 'Team ' + team.name + ' còn ' + onDuty + '/' + n + ' người ' + (multi ? 'những ngày đó' : 'ngày đó'), over: onDuty <= 1 };
    }
    if (r.type === 'remote') {
      var inOffice = members.filter(function (m) { return m.id !== who.id && /full|morning|afternoon|ot/.test(st.shiftOf(m.id, r.from)); }).length;
      return { icon: 'building', text: 'Team ' + team.name + ' còn ' + inOffice + '/' + n + ' người tại văn phòng', over: false };
    }
    if (r.type === 'ot') {
      var wd = workdays(r.from, r.to);
      var total = st.weekHours(who.id, r.from) + wd * 3;
      return { icon: 'hourglass', text: 'Tuần đó ' + U.firstName(who.name) + ' lên ~' + fmtHours(total) + (total > 48 ? ' · vượt trần 48g' : ' · trong trần 48g'), over: total > 48 };
    }
    if (r.type === 'swap') {
      var other = st.staff(r.swapWithId);
      return { icon: 'repeat', text: other ? 'Đổi với ' + U.shortName(other.name) + ' · ' + st.shiftType(st.shiftOf(other.id, r.from)).label + ' ' + dmw(r.from) : 'Chưa chọn người đổi', over: false };
    }
    return { text: '', over: false };
  };
  Dashboard.prototype.renderInbox = function () {
    if (!this.alive()) return;
    var st = S(), me = st.me(), block = this.blocks.inbox, self = this;
    var all = st.pendingRequests().filter(function (r) { return r.staffId !== me.id; });
    var list = U.sortBy(all, 'from').slice(0, 4);
    var focused = document.activeElement && document.activeElement.closest && document.activeElement.closest('.db-req') ? document.activeElement.dataset.id : null;
    U.render(block, h`
      <div class="card__head">
        <div><div class="card__eyebrow">Quản lý</div><h3 class="card__title">Cần bạn xử lý ${all.length ? h`<span class="badge badge--red">${all.length}</span>` : ''}</h3></div>
        <span class="db-inbox__hint muted">${raw(UI.kbd('E'))} duyệt · ${raw(UI.kbd('X'))} từ chối</span>
      </div>
      ${list.length ? h`<div class="db-req-list">${list.map(function (r) { return self.requestCard(r); })}</div>` : h`<div class="empty empty--sm"><div class="empty__icon">${icon('check-circle', 24)}</div><div class="empty__title">Không có gì chờ bạn. Tuyệt.</div><div class="empty__body">Đội đang tự vận hành ổn — bạn có thể tập trung vào việc của mình.</div></div>`}
      <div class="card__foot"><span>${all.length > list.length ? 'Còn ' + (all.length - list.length) + ' yêu cầu khác' : list.length ? 'Đã xem ' + list.length + '/' + all.length : 'Hộp thư trống'}</span><a class="link-btn" href="#/requests">Xem tất cả yêu cầu →</a></div>`);
    if (focused) { var again = block.querySelector('.db-req[data-id="' + focused + '"]'); if (again) again.focus(); }
  };
  Dashboard.prototype.requestCard = function (r) {
    var st = S(), who = st.staff(r.staffId), team = st.team(who.teamId), type = E().requestType(r.type);
    var multi = r.from !== r.to, count = dayCount(r);
    var impact = this.impactLine(r);
    return h`
      <article class="db-req" tabindex="0" data-id="${r.id}" aria-label="${type.label} của ${who.name}">
        <span class="db-req__icon" data-type="${r.type}">${icon(type.icon, 16)}</span>
        <div class="db-req__body">
          <div class="db-req__top">${raw(UI.avatar(who, { size: 'sm', title: false }))}<span class="db-req__name"><b>${who.name}</b><small>${who.role}${team ? ' · ' + team.name : ''}</small></span><span class="chip chip--xs chip--type">${type.label}</span></div>
          <div class="db-req__when mono tnum">${dmw(r.from)}${multi ? h` <span class="db-req__arrow">→</span> ${dmw(r.to)}` : ''} <span class="faint">· ${count}</span></div>
          <p class="db-req__reason clamp-2">${r.reason}</p>
          ${impact.text ? h`<div class="db-req__impact${impact.over ? ' is-over' : ''}">${icon(impact.over ? 'alert-triangle' : impact.icon || 'info', 13)}<span>${impact.text}</span></div>` : ''}
        </div>
        <div class="db-req__actions">
          <span class="db-stamp"><button type="button" class="btn btn--ok btn--sm" data-approve="${r.id}"><svg class="icon db-tick" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M20 6 9 17l-5-5" pathLength="1"/></svg><span>Duyệt</span></button><span class="chip chip--ok db-stamp__chip">${icon('check', 12)}<span>Đã duyệt</span></span></span>
          <button type="button" class="btn btn--ghost btn--sm" data-reject="${r.id}">Từ chối</button>
        </div>
      </article>`;
  };
  /** Ảnh chụp ca liên quan để "Hoàn tác" khôi phục đúng. */
  Dashboard.prototype.snapshotShifts = function (r) {
    var st = S(), out = {}, ids = [r.staffId].concat(r.swapWithId ? [r.swapWithId] : []);
    ids.forEach(function (sid) { out[sid] = {}; for (var d = U.fromISO(r.from); U.toISO(d) <= r.to; d = U.addDays(d, 1)) { var iso = U.toISO(d); out[sid][iso] = (st.state.shifts[sid] || {})[iso]; } });
    return out;
  };
  Dashboard.prototype.undoRequest = function (id, snap) {
    S().update(function (s) {
      var r = s.requests.find(function (x) { return x.id === id; }); if (!r) return;
      r.status = 'pending'; delete r.approverId; delete r.decidedAt; delete r.note;
      if (snap) Object.keys(snap).forEach(function (sid) { var m = s.shifts[sid] = s.shifts[sid] || {}; Object.keys(snap[sid]).forEach(function (iso) { if (snap[sid][iso] == null) delete m[iso]; else m[iso] = snap[sid][iso]; }); });
      s.notifications = s.notifications.filter(function (n) { return n.requestId !== id; });
    }, { type: 'request:status', id: id, status: 'pending' });
    UI.toast('Đã hoàn tác — yêu cầu quay về trạng thái chờ', { kind: 'info' });
  };
  Dashboard.prototype.removeCard = function (card, exitCls, exitMs, done) {
    var self = this, block = this.blocks.inbox, main = block.parentElement;
    var finish = function () {
      if (!self.alive()) return;
      var remaining = U.qsa('.db-req', block).filter(function (c) { return c !== card; });
      var followers = []; var sib = block.nextElementSibling; while (sib) { followers.push(sib); sib = sib.nextElementSibling; }
      var foot = block.querySelector('.card__foot');
      flipY(remaining.concat([foot]).concat(followers), function () { card.remove(); }, 240);
      self.later(function () { self.inboxBusy = false; self.renderInbox(); if (self.pendingRerender) { self.pendingRerender = false; self.renderAll(false); } if (done) done(); }, 260);
    };
    if (reduceMotion()) { self.inboxBusy = false; self.renderInbox(); if (done) done(); return; }
    card.classList.add(exitCls);
    self.later(finish, exitMs);
  };
  Dashboard.prototype.approve = function (id, btn) {
    var st = S(), r = st.request(id); if (!r || r.status !== 'pending') return;
    var self = this, card = btn.closest('.db-req'), who = st.staff(r.staffId), snap = this.snapshotShifts(r);
    this.inboxBusy = true;
    st.setRequestStatus(id, 'approved');
    UI.toast('Đã duyệt ' + E().requestType(r.type).label.toLowerCase() + ' của ' + U.shortName(who.name), { kind: 'success', action: { label: 'Hoàn tác', onClick: function () { self.undoRequest(id, snap); } } });
    if (reduceMotion()) { this.inboxBusy = false; this.renderInbox(); return; }
    var stamp = btn.closest('.db-stamp'), actions = card.querySelector('.db-req__actions');
    actions.classList.add('is-deciding');
    stamp.classList.add('is-stamping');
    this.later(function () { stamp.classList.add('is-done'); }, 320);
    this.later(function () { self.removeCard(card, 'is-leaving', 220); }, 720);
  };
  Dashboard.prototype.reject = function (id, btn) {
    var st = S(), r = st.request(id); if (!r || r.status !== 'pending') return;
    var self = this, card = btn.closest('.db-req'), who = st.staff(r.staffId);
    var pop = UI.popover(btn, h`
      <div class="db-reject">
        <div class="db-reject__title">Từ chối yêu cầu của ${U.shortName(who.name)}?</div>
        <textarea class="input textarea db-reject__reason" rows="3" placeholder="Lý do ngắn gọn để ${U.firstName(who.name)} hiểu (tuỳ chọn)…" aria-label="Lý do từ chối"></textarea>
        <div class="db-reject__foot"><button type="button" class="btn btn--ghost btn--sm" data-cancel>Huỷ</button><button type="button" class="btn btn--secondary btn--sm" data-confirm>${icon('x', 14)}<span>Từ chối</span></button></div>
      </div>`.s, { placement: 'bottom-end', width: 320, cls: 'popover--reject' });
    pop.el.addEventListener('click', function (e) {
      if (e.target.closest('[data-cancel]')) { pop.close(); return; }
      if (!e.target.closest('[data-confirm]')) return;
      var note = pop.el.querySelector('.db-reject__reason').value.trim();
      pop.close();
      self.inboxBusy = true;
      st.setRequestStatus(id, 'rejected', note);
      UI.toast('Đã từ chối yêu cầu của ' + U.shortName(who.name), { kind: 'info', action: { label: 'Hoàn tác', onClick: function () { self.undoRequest(id, null); } } });
      if (reduceMotion()) { self.inboxBusy = false; self.renderInbox(); return; }
      card.querySelector('.db-req__actions').classList.add('is-deciding');
      self.removeCard(card, 'is-fading', 220, function () { card.focus && card.focus(); });
    });
    pop.el.addEventListener('keydown', function (e) { if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') { e.preventDefault(); pop.el.querySelector('[data-confirm]').click(); } });
  };

  /* --------------------------------------------- 5b. Sắp diễn ra · cần nhắc */
  Dashboard.prototype.attentionItems = function () {
    var st = S(), me = st.me();
    if (!st.needsAttention) return [];
    return st.needsAttention(me.id, ATTENTION_HOURS).filter(function (n) { return n.canNudge || n.event.ownerId === me.id; });
  };
  Dashboard.prototype.renderAttention = function (opts) {
    if (!this.alive() || this.attBusy) return;
    opts = opts || {};
    var st = S(), me = st.me(), block = this.blocks.attention, self = this;
    var all = this.attentionItems(), list = all.slice(0, ATTENTION_MAX);
    // Hàng vừa được xử lý xong (đủ RSVP / chuẩn bị xong) rời đi có chuyển động thay vì biến mất đột ngột
    if (opts.animate && !block.hidden && !reduceMotion()) {
      var ids = list.map(function (n) { return n.event.id; });
      var gone = U.qsa('.db-att__row', block).filter(function (r) { return ids.indexOf(r.dataset.att) < 0; });
      if (gone.length) { this.attBusy = true; this.leaveRows(block, gone, '.db-att__row', function () { self.attBusy = false; self.renderAttention(); }); return; }
    }
    if (!list.length) { block.hidden = true; block.innerHTML = ''; return; }
    var ae = document.activeElement, focusSel = null;
    if (ae && block.contains(ae)) focusSel = ae.dataset.nudge ? '[data-nudge="' + ae.dataset.nudge + '"]' : ae.dataset.prepToggle ? '[data-prep-toggle="' + ae.dataset.prepToggle + '"]' : ae.dataset.eventOpen ? '.db-att__row [data-event-open="' + ae.dataset.eventOpen + '"]' : ae.hasAttribute('data-nudge-all') ? '[data-nudge-all]' : null;
    var nudgeable = all.filter(function (n) { return n.canNudge && n.reasons.some(function (r) { return r.kind === 'rsvp'; }); });
    var totalPending = U.sum(nudgeable, function (n) { var rs = st.rsvpSummary(n.event); return rs.pending + rs.maybe; });
    block.hidden = false;
    U.render(block, h`
      <div class="card__head">
        <div><div class="card__eyebrow">${ATTENTION_HOURS} giờ tới</div><h3 class="card__title">Sắp diễn ra · cần nhắc <span class="db-count faint">· ${all.length}</span></h3></div>
        ${nudgeable.length > 1 ? h`<button type="button" class="btn btn--sm btn--secondary db-att__all" data-nudge-all aria-label="Nhắc tất cả ${totalPending} người chưa xác nhận ở ${nudgeable.length} sự kiện">${icon('bell', 14)}<span>Nhắc tất cả</span><span class="badge tnum">${totalPending}</span></button>` : ''}
      </div>
      <div class="db-att__list">${list.map(function (n) { return self.attentionRow(n); })}</div>
      ${all.length > list.length ? h`<div class="card__foot"><span>Còn ${all.length - list.length} sự kiện khác trong ${ATTENTION_HOURS} giờ tới</span><a class="link-btn" href="#/calendar?staff=${me.id}">Lịch của tôi →</a></div>` : ''}`);
    if (focusSel) { var again = block.querySelector(focusSel); if (again) again.focus({ preventScroll: true }); }
  };
  Dashboard.prototype.attentionRow = function (n) {
    var st = S(), me = st.me(), ev = n.event, tl = timeLeft(n.hoursLeft), see = st.canSee(ev, me.id);
    var p = see && ev.projectId ? st.project(ev.projectId) : null, ps = st.prepStatus(ev), rs = st.rsvpSummary(ev), pendCount = rs.pending + rs.maybe;
    var rsvpR = n.reasons.some(function (r) { return r.kind === 'rsvp'; }), prepR = n.reasons.some(function (r) { return r.kind === 'prep'; });
    var myPrep = (ev.prep || []).filter(function (x) { return x.ownerId === me.id; });
    var lastNudge = ev.nudges && ev.nudges.length ? ev.nudges[ev.nudges.length - 1] : null;
    var title = st.displayTitle(ev, me.id), when = dmw(ev.date) + ' · ' + (ev.allDay ? 'Cả ngày' : timeRange(ev.start, ev.end));
    return h`
      <article class="db-att__row" data-att="${ev.id}" data-prio="${ev.priority || 2}" data-type="${ev.type}"${p ? raw(' style="--ev:' + p.color + '"') : ''} aria-label="${title}, ${when}, ${tl.text}">
        <span class="db-att__left mono-sm tnum${tl.cls ? ' ' + tl.cls : ''}" data-left>${tl.text}</span>
        <div class="db-att__body">
          <div class="db-att__title"><button type="button" class="db-att__name" data-event-open="${ev.id}">${title}</button>${prioTag(ev)}${travelTag(ev)}</div>
          <div class="db-att__meta tnum">${when}${see && ev.location ? h` · ${ev.location}` : ''}${p ? h` · <b>${p.client}</b>` : ''}</div>
          <div class="db-att__reasons">
            ${rsvpR ? h`<span class="db-att__reason" title="${rs.pending} chưa phản hồi${rs.maybe ? ', ' + rs.maybe + ' có thể' : ''}"><i class="rsvp-dot" data-rsvp="pending"></i>${pendCount} chưa xác nhận</span>` : ''}
            ${prepR ? h`<span class="db-att__reason${ps.overdue ? ' is-overdue' : ''}">${icon('check-square', 12)}${ps.open}/${ps.total} việc chuẩn bị</span>` : ''}
            ${rsvpR && rs.yes ? h`<span class="db-att__reason is-quiet"><i class="rsvp-dot" data-rsvp="yes"></i>${rs.yes} tham dự</span>` : ''}
          </div>
          ${myPrep.length ? h`<div class="db-att__prep prep" role="group" aria-label="Việc chuẩn bị của bạn cho ${title}">${myPrep.map(function (x) { return h`<div class="prep__item${x.done ? ' is-done' : ''}"><button type="button" class="prep__check" data-prep-toggle="${x.id}" data-prep-ev="${ev.id}" aria-pressed="${x.done ? 'true' : 'false'}" aria-label="${x.done ? 'Bỏ đánh dấu' : 'Đánh dấu xong'}: ${x.text}">${icon('check', 12)}</button><span class="prep__text">${x.text}</span><span class="prep__owner">bạn</span></div>`; })}</div>` : ''}
        </div>
        <div class="db-att__actions">
          ${rsvpR && n.canNudge ? h`<button type="button" class="btn btn--sm btn--soft" data-nudge="${ev.id}" aria-label="Nhắc ${pendCount} người xác nhận: ${title}">${icon('bell', 14)}<span>Nhắc</span></button>` : ''}
          <button type="button" class="btn btn--sm btn--ghost" data-event-open="${ev.id}" aria-label="Mở chi tiết: ${title}">${icon('external-link', 14)}<span>Mở</span></button>
          ${lastNudge ? h`<small class="db-att__nudged faint">Đã nhắc ${U.timeAgo(lastNudge.at)}</small>` : ''}
        </div>
      </article>`;
  };
  Dashboard.prototype.doNudge = function (evId) {
    var st = S(), me = st.state.currentUserId, ev = st.event(evId); if (!ev) return;
    var n = st.nudge(evId, me);
    UI.toast(n ? 'Đã nhắc ' + n + ' người xác nhận' : 'Mọi người đã xác nhận rồi', { kind: n ? 'brand' : 'info', title: n ? st.displayTitle(ev, me) : undefined, action: n ? { label: 'Mở', onClick: function () { E().eventDetail(evId); } } : undefined });
  };
  Dashboard.prototype.nudgeAll = function () {
    var st = S(), me = st.state.currentUserId;
    var items = this.attentionItems().filter(function (n) { return n.canNudge && n.reasons.some(function (r) { return r.kind === 'rsvp'; }); });
    var total = 0, evs = 0;
    this.nudgeBatch = true;
    try { items.forEach(function (n) { var c = st.nudge(n.event.id, me); if (c) { total += c; evs++; } }); }
    finally { this.nudgeBatch = false; }
    this.renderAttention(); this.renderUpcoming(); this.renderExec();
    UI.toast(total ? 'Đã nhắc ' + total + ' người xác nhận ở ' + evs + ' sự kiện' : 'Mọi người đã xác nhận rồi', { kind: total ? 'brand' : 'info' });
  };

  /* ---------------------------------------------------------- 6. Sắp tới */
  Dashboard.prototype.renderUpcoming = function () {
    var st = S(), me = st.me(), block = this.blocks.upcoming, self = this;
    var list = upcomingFor(me.id, this.iso, 6), real = U.todayISO(), now = U.nowMinutes();
    var groups = U.groupBy(list, 'date');
    U.render(block, h`
      <div class="card__head"><div><div class="card__eyebrow">Lịch của bạn</div><h3 class="card__title">Sắp tới của bạn</h3></div><a class="link-btn" href="#/calendar?staff=${me.id}">Lịch của tôi →</a></div>
      ${list.length ? h`<div class="db-up__list">${Object.keys(groups).map(function (iso) {
        return h`<div class="db-up__group"><div class="db-up__day eyebrow"><span>${dayLabel(iso, self.iso)}</span><span class="db-up__dayline"></span><span class="faint">${dmw(iso)}</span></div>${groups[iso].map(function (e) {
          var cls = [], mine = e.ownerId === me.id;
          if (mine) cls.push('is-mine');
          if (isLive(e, real, now)) cls.push('is-live');
          if (e.type === 'deadline') { var mins = (U.daysBetween(real, e.date) * 1440) + U.timeToMin(e.start) - now; if (mins <= 1440) cls.push('is-urgent'); }
          var rs = st.rsvpSummary(e), pend = rs.pending + rs.maybe, lastNudge = e.nudges && e.nudges.length ? e.nudges[e.nudges.length - 1] : null;
          var line = mine && pend > 0 && e.attendeeIds.length > 1 && e.type !== 'focus'
            ? h`<div class="db-up__rsvp"><i class="rsvp-dot" data-rsvp="pending"></i><span>${pend} chưa xác nhận</span>${lastNudge ? h`<span class="faint">· đã nhắc ${U.timeAgo(lastNudge.at)}</span>` : ''}<span class="faint">·</span><button type="button" class="link-btn" data-nudge="${e.id}" aria-label="Nhắc ${pend} người xác nhận: ${e.title}">Nhắc</button></div>`
            : '';
          return h`<div class="db-up__item">${raw(pill(e, { cls: cls.join(' ') }))}${line}</div>`;
        })}</div>`;
      })}</div>` : h`<div class="empty empty--sm"><div class="empty__icon">${icon('coffee', 22)}</div><div class="empty__title">Lịch phía trước đang trống</div><div class="empty__body">Một khoảng thở hiếm có — hoặc là lúc tạo cuộc họp brief tiếp theo.</div><button type="button" class="btn btn--soft btn--sm" data-action="event">${icon('plus', 14)}Tạo sự kiện</button></div>`}`);
  };

  /* ------------------------------------------------------- 7. Deadline 7d */
  Dashboard.prototype.renderDeadlines = function () {
    var st = S(), block = this.blocks.deadlines, iso = this.iso, to = U.toISO(U.addDays(this.date, 7)), me = st.me();
    var rows = [];
    st.eventsBetween(iso, to).filter(function (e) { return e.type === 'deadline'; }).forEach(function (e) {
      var p = e.projectId ? st.project(e.projectId) : null;
      rows.push({ kind: 'event', id: e.id, title: st.displayTitle(e, me.id), sub: p ? p.client + ' · ' + p.name : (st.eventType(e.type).label), color: p ? p.color : 'var(--ev-deadline)', date: e.date, time: e.allDay ? '' : e.start });
    });
    st.state.projects.forEach(function (p) { if (p.status !== 'done' && p.end >= iso && p.end <= to) rows.push({ kind: 'project', id: p.id, title: 'Kết thúc dự án — ' + p.name, sub: p.client + ' · ' + p.progress + '% hoàn thành', color: p.color, date: p.end, time: '' }); });
    rows = U.sortBy(rows, function (r) { return r.date + ' ' + (r.time || '23:59'); });
    U.render(block, h`
      <div class="card__head"><div><div class="card__eyebrow">Toàn công ty</div><h3 class="card__title">Deadline 7 ngày</h3></div><a class="link-btn" href="#/projects">Dự án →</a></div>
      ${rows.length ? h`<div class="db-dl__list">${rows.map(function (r) {
        var n = U.daysBetween(iso, r.date), red = n <= 0, badge = n < 0 ? 'Quá hạn' : n === 0 ? 'Hôm nay' : 'D-' + n;
        return h`<button type="button" class="db-dl__row${red ? ' is-urgent' : ''}" ${raw(r.kind === 'event' ? 'data-event-open="' + r.id + '"' : 'data-project-open="' + r.id + '"')}><i class="db-dl__dot" style="background:${r.color}"></i><span class="db-dl__txt"><b class="truncate">${r.title}</b><small class="truncate">${r.sub}</small></span><span class="db-dl__date mono tnum"><span>${dmw(r.date)}</span>${r.time ? h`<small>${r.time}</small>` : ''}</span><span class="badge${red ? ' badge--red' : ''} tnum">${badge}</span></button>`;
      })}</div>` : h`<div class="empty empty--sm"><div class="empty__icon">${icon('flag', 22)}</div><div class="empty__title">Không có deadline nào trong 7 ngày tới</div><div class="empty__body">Một tuần dễ thở. Tận dụng để đi trước một bước.</div></div>`}`);
  };

  /* --------------------------------------- 7b. Ban điều hành: sức khoẻ lịch */
  Dashboard.prototype.renderExec = function () {
    if (!this.alive()) return;
    var st = S(), me = st.me(), block = this.blocks.exec;
    if (!me || me.teamId !== 'exec' || !st.weekHealth || !st.issuesFor) { block.hidden = true; block.innerHTML = ''; return; }
    var ceo = st.state.staff.find(function (s) { return s.teamId === 'exec' && /ceo|giám đốc điều hành/i.test(s.role); }) || me;
    var person = me.id === ceo.id ? me : ceo, isSelf = person.id === me.id;
    var wh = st.weekHealth(person.id, this.iso), issues = st.issuesFor(person.id, this.iso).slice(0, 2);
    var level = wh.score >= 80 ? 'ok' : wh.score >= 60 ? 'warn' : 'bad';
    var ring = level === 'ok' ? 'var(--ok)' : level === 'warn' ? 'var(--warn)' : 'var(--red-ink)';
    var animate = !this.execAnimated && !reduceMotion(); this.execAnimated = true;
    var meetH = wh.meetingMin ? U.fmtDuration(wh.meetingMin) : '0g', focusH = wh.focusMin ? U.fmtDuration(wh.focusMin) : '—';
    var tight = wh.backToBack + wh.travelIssues;
    var todayISO = U.todayISO();
    block.hidden = false;
    block.dataset.level = level;
    U.render(block, h`
      <div class="card__head">
        <div><div class="card__eyebrow">Tuần ${U.isoWeek(this.date)} · ${U.fmtDate(wh.from, 'dm')} – ${U.fmtDate(wh.to, 'dm')}</div><h3 class="card__title">${isSelf ? 'Lịch của bạn tuần này' : 'Lịch của sếp tuần này'}</h3></div>
      </div>
      <div class="db-exec__top" style="--ring:${ring}">
        <div class="db-exec__ring" role="img" aria-label="Điểm sức khoẻ lịch ${wh.score} trên 100 · ${wh.label}">
          <svg viewBox="0 0 72 72" aria-hidden="true"><circle class="db-exec__track" cx="36" cy="36" r="31"/><circle class="db-exec__arc" cx="36" cy="36" r="31" pathLength="100" style="stroke-dashoffset:${animate ? 100 : 100 - wh.score}"/></svg>
          <span class="db-exec__score mono tnum">${wh.score}</span>
        </div>
        <div class="db-exec__who">
          <div class="db-exec__person">${raw(UI.avatar(person, { size: 'sm', title: false }))}<span><b>${U.shortName(person.name)}</b><small>${person.role}</small></span></div>
          <span class="db-exec__label" data-level="${level}">${wh.label}</span>
          <small class="db-exec__sub">${wh.meetingPct}% tuần là họp${wh.daysOver6h ? ' · ' + wh.daysOver6h + ' ngày > 6g họp' : ''}</small>
        </div>
      </div>
      <div class="db-exec__stats">
        <div class="db-exec__stat"><span class="eyebrow">Giờ họp</span><b class="mono tnum">${meetH}</b><small>${wh.external} cuộc bên ngoài</small></div>
        <div class="db-exec__stat${wh.focusMin < 240 ? ' is-warn' : ''}"><span class="eyebrow">Tập trung</span><b class="mono tnum">${focusH}</b><small>${wh.focusMin < 240 ? 'dưới 4g / tuần' : 'khối tập trung'}</small></div>
        <div class="db-exec__stat${wh.conflicts ? ' is-bad' : ''}"><span class="eyebrow">Xung đột</span><b class="mono tnum">${wh.conflicts}</b><small>${tight ? '+' + tight + ' sát nhau' : 'không sát nhau'}</small></div>
      </div>
      ${issues.length ? h`<ul class="db-exec__issues" aria-label="Vấn đề cần xử lý">${issues.map(function (it) {
        var ev = it.events && it.events[0], past = it.date < todayISO;
        var inner = h`<i class="db-exec__sev" aria-hidden="true"></i><span class="db-exec__txt"><span class="clamp-2">${it.text}</span><small class="mono-sm">${dmw(it.date)}${it.date === todayISO ? ' · hôm nay' : ''}</small></span>`;
        return ev ? h`<li><button type="button" class="db-exec__issue" data-sev="${it.severity}" data-event-open="${ev.id}" aria-label="${it.severity === 3 ? 'Nghiêm trọng' : it.severity === 2 ? 'Cần chú ý' : 'Gợi ý'}: ${it.text}, ${dmw(it.date)}">${inner}</button></li>` : h`<li><div class="db-exec__issue" data-sev="${it.severity}">${inner}</div></li>`;
      })}</ul>` : h`<p class="db-exec__clear muted">${icon('check-circle', 14)}Không có vấn đề nào trong tuần — lịch đang gọn.</p>`}
      <a class="btn btn--soft db-exec__cta" href="#/assistant?staff=${person.id}">${icon('sliders', 15)}<span>Mở Điều phối →</span></a>`);
    if (animate) {
      var arc = block.querySelector('.db-exec__arc');
      requestAnimationFrame(function () { requestAnimationFrame(function () { if (arc && arc.isConnected) { arc.classList.add('is-anim'); arc.style.strokeDashoffset = String(100 - wh.score); } }); });
    }
  };

  /* --------------------------------------------------- 9. Ai đang ở đâu */
  Dashboard.prototype.renderWhere = function () {
    var st = S(), block = this.blocks.where, iso = this.iso, self = this;
    var stats = st.dayStats(iso), hol = st.holidayName(iso), weekend = U.isWeekend(iso);
    var office = stats.onDuty - stats.remote - stats.onsite;
    var parts = [];
    if (hol && stats.onDuty === 0) parts.push('Nghỉ lễ ' + hol + ' · cả đội nghỉ');
    else if (weekend && stats.onDuty === 0) parts.push('Cuối tuần · cả đội nghỉ');
    else {
      if (office) parts.push(office + ' tại văn phòng'); if (stats.remote) parts.push(stats.remote + ' remote'); if (stats.onsite) parts.push(stats.onsite + ' on-site');
      if (stats.leave) parts.push(stats.leave + ' nghỉ phép'); if (stats.off) parts.push(stats.off + ' nghỉ');
    }
    if (!st.team(this.whereFilter) && this.whereFilter !== 'all') this.whereFilter = 'all';
    U.render(block, h`
      <div class="card__head"><div><div class="card__eyebrow">${this.isReal ? 'Hôm nay' : dmw(iso)}</div><h3 class="card__title">Ai đang ở đâu</h3></div><a class="link-btn" href="#/roster/${iso}">Bảng ca →</a></div>
      <p class="db-where__counts">${parts.join(' · ')}</p>
      <div class="db-where__filters chips" role="group" aria-label="Lọc theo team">
        <button type="button" class="chip chip--btn${this.whereFilter === 'all' ? ' is-active' : ''}" aria-pressed="${this.whereFilter === 'all' ? 'true' : 'false'}" data-where="all">Tất cả</button>
        ${st.state.teams.map(function (t) { return h`<button type="button" class="chip chip--btn chip--color${self.whereFilter === t.id ? ' is-active' : ''}" aria-pressed="${self.whereFilter === t.id ? 'true' : 'false'}" style="--chip:${t.color}" data-where="${t.id}"><i class="chip__dot"></i><span>${t.short}</span></button>`; })}
      </div>
      <div class="db-where__grid"></div>`);
    this.renderWhereGrid();
  };
  Dashboard.prototype.renderWhereGrid = function () {
    var st = S(), grid = this.blocks.where.querySelector('.db-where__grid'); if (!grid) return;
    var iso = this.iso, me = st.me(), filter = this.whereFilter;
    var teams = st.state.teams.filter(function (t) { return filter === 'all' || t.id === filter; });
    U.render(grid, raw(teams.map(function (t) {
      var members = st.staffByTeam(t.id);
      var on = members.filter(function (s) { return !/leave|off/.test(st.shiftOf(s.id, iso)); }).length;
      return h`<div class="db-where__team" style="--chip:${t.color}">
        <div class="db-where__teamhead"><i class="chip__dot"></i><b>${t.name}</b><span class="mono-sm faint tnum">${on}/${members.length}</span></div>
        <div class="db-where__people">${members.map(function (s) {
          var type = st.shiftOf(s.id, iso);
          return h`<button type="button" class="db-who${s.id === me.id ? ' is-me' : ''}" data-no-profile data-open-staff="${s.id}" data-tip="${U.shortName(s.name) + ' · ' + shiftTip(s.id, iso)}" aria-label="${s.name} · ${shiftTip(s.id, iso)}">${raw(withStatus(UI.avatar(s, { size: 'md', title: false }), shiftStatus(type)))}</button>`;
        })}</div>
      </div>`.s;
    }).join('')));
  };

  /* --------------------------------------------------------- 10. Nhịp đội */
  Dashboard.prototype.renderPulse = function () {
    if (!this.alive()) return;
    var st = S(), block = this.blocks.pulse, days = U.weekDays(this.date), real = U.todayISO(), self = this;
    var teams = st.state.teams;
    U.render(block, h`
      <div class="card__head"><div><div class="card__eyebrow">Tuần ${U.isoWeek(this.date)}</div><h3 class="card__title">Nhịp đội</h3></div><a class="link-btn" href="#/staff?view=pulse">Xem Nhịp đội →</a></div>
      <div class="db-pulse__grid" role="table" aria-label="Tải công việc theo team và ngày">
        <span class="db-pulse__corner" aria-hidden="true"></span>
        ${days.map(function (d) { var iso = U.toISO(d); return h`<span class="db-pulse__day mono-sm${iso === self.iso ? ' is-today' : ''}${!isWorkday(iso) ? ' is-off' : ''}" role="columnheader">${U.weekdayShort(d)}</span>`; })}
        ${teams.map(function (t, j) {
          var members = st.staffByTeam(t.id);
          return h`<span class="db-pulse__team" role="rowheader" style="--chip:${t.color}"><i class="chip__dot"></i>${t.short}</span>${days.map(function (d, i) {
            var iso = U.toISO(d), loads = members.map(function (s) { return dayLoad(s.id, iso); }).filter(function (x) { return x != null; });
            var avg = loads.length ? Math.round(U.sum(loads) / loads.length) : null, lvl = heatLevel(avg);
            if (avg != null && loads.length / members.length < 0.5 && lvl > 1) lvl = Math.max(1, lvl - 1);
            var tip = t.name + ' · ' + dmw(iso) + ' · ' + loads.length + '/' + members.length + ' người' + (avg != null ? ' · ' + avg + '%' : ' · nghỉ');
            return h`<span class="heat${lvl === 5 ? ' is-overload' : ''}" role="cell" tabindex="${i === 0 && j === 0 ? '0' : '-1'}" data-i="${i}" data-j="${j}" data-level="${lvl}" data-tip="${tip}" aria-label="${tip}" style="--i:${i};--j:${j}"></span>`;
          })}`;
        })}
      </div>
      <div class="db-pulse__legend"><span class="faint">Nhẹ</span>${[0, 1, 2, 3, 4].map(function (l) { return h`<i class="heat heat--key" data-level="${l}"></i>`; })}<span class="faint">Nặng</span><span class="db-pulse__over"><i class="heat heat--key" data-level="5"></i>Quá tải</span></div>`);
    var grid = block.querySelector('.db-pulse__grid');
    if (this.pulseIO) { this.pulseIO.disconnect(); this.pulseIO = null; }
    if (reduceMotion() || !('IntersectionObserver' in window)) { grid.classList.add('is-live', 'is-settled'); return; }
    this.pulseIO = new IntersectionObserver(function (entries) {
      if (!entries.some(function (en) { return en.isIntersecting; })) return;
      if (self.pulseIO) { self.pulseIO.disconnect(); self.pulseIO = null; }
      if (!self.alive()) return;
      grid.classList.add('is-live');
      self.later(function () { grid.classList.add('is-settled'); }, 800);
    }, { threshold: 0.2 });
    this.pulseIO.observe(grid);
    // Dự phòng: nếu observer không bắn (in ấn, iframe ẩn…) vẫn hiện sau 5s
    this.later(function () { if (!grid.classList.contains('is-live')) { grid.classList.add('is-live'); self.later(function () { grid.classList.add('is-settled'); }, 800); } }, 5000);
  };

  /* --------------------------------------------------------- 11. Có gì vui */
  Dashboard.prototype.funItems = function () {
    var st = S(), iso = this.iso, to = U.toISO(U.addDays(this.date, 14)), from7 = U.toISO(U.addDays(this.date, -7)), items = [];
    st.eventsBetween(iso, to).filter(function (e) { return e.birthdayOf; }).forEach(function (e) {
      var s = st.staff(e.birthdayOf); if (!s) return;
      items.push({ key: 'bday:' + s.id + ':' + e.date, kind: 'birthday', staff: s, date: e.date, title: 'Sinh nhật ' + U.shortName(s.name), sub: whenLabel(e.date, iso), icon: 'cake', eventId: e.id });
    });
    st.state.staff.forEach(function (s) {
      var y = U.fromISO(iso).getFullYear(), md = s.joined.slice(5), cand = y + '-' + md; if (cand < iso) cand = (y + 1) + '-' + md;
      if (cand >= iso && cand <= to) { var yrs = U.fromISO(cand).getFullYear() - +s.joined.slice(0, 4); if (yrs >= 1) items.push({ key: 'anniv:' + s.id + ':' + cand, kind: 'anniv', staff: s, date: cand, title: yrs + ' năm ' + U.shortName(s.name) + ' ở Z15', sub: whenLabel(cand, iso), icon: 'award' }); }
    });
    st.state.projects.forEach(function (p) { if (p.status === 'done' && p.end >= from7 && p.end <= iso) items.push({ key: 'done:' + p.id, kind: 'done', project: p, date: p.end, title: p.client + ' đã về đích', sub: p.name + ' · wrap-up ' + dmw(p.end), icon: 'rocket', lead: st.staff(p.leadId) }); });
    st.eventsBetween(from7, iso).filter(function (e) { return e.type === 'deadline' && /go-?live|on-?air|ra mắt/i.test(e.title); }).forEach(function (e) { var p = e.projectId ? st.project(e.projectId) : null; items.push({ key: 'golive:' + e.id, kind: 'golive', date: e.date, title: e.title, sub: (p ? p.client + ' · ' : '') + dmw(e.date), icon: 'zap', project: p, lead: st.staff(e.ownerId), eventId: e.id }); });
    return U.sortBy(items, 'date').slice(0, 6);
  };
  Dashboard.prototype.renderFun = function () {
    if (!this.alive()) return;
    var block = this.blocks.fun, items = this.funItems(), sent = U.loadJSON(KEYS.kudos, {}), open = this.funOpen;
    block.classList.toggle('is-collapsed', !open);
    U.render(block, h`
      <button type="button" class="card__head db-fun__toggle" data-fun-toggle aria-expanded="${open}" aria-controls="db-fun-body">
        <div><div class="card__eyebrow">Góc ấm áp</div><h3 class="card__title">Có gì vui ${items.length ? h`<span class="badge">${items.length}</span>` : ''}</h3></div>
        <span class="icon-btn icon-btn--sm db-fun__chev" aria-hidden="true">${icon('chevron-down', 16)}</span>
      </button>
      <div class="db-fun__body" id="db-fun-body"${open ? '' : ' hidden'}>
        ${items.length ? h`<div class="db-fun__list">${items.map(function (it) {
          var who = it.staff || it.lead, done = !!sent[it.key];
          var name = it.staff ? U.shortName(it.staff.name) : it.project ? it.project.client : (it.lead ? U.shortName(it.lead.name) : 'cả đội');
          return h`<div class="db-fun__item" data-kind="${it.kind}">
            ${who ? raw(UI.avatar(who, { size: 'md', title: false })) : h`<span class="db-fun__pic" style="--chip:${it.project ? it.project.color : 'var(--action)'}">${icon(it.icon, 16)}</span>`}
            <span class="db-fun__txt"><b>${it.title}</b><small>${it.sub}</small></span>
            ${done ? h`<span class="chip chip--ok chip--xs">${icon('check', 11)}<span>Đã chúc</span></span>` : h`<button type="button" class="btn btn--soft btn--sm" data-kudos="${it.key}" data-kudos-name="${name}">Gửi lời chúc 🎉</button>`}
          </div>`;
        })}</div>` : h`<p class="db-fun__empty muted">Hai tuần tới chưa có dịp gì — nhưng thứ Sáu vẫn là thứ Sáu 🍻.</p>`}
      </div>`);
  };
  Dashboard.prototype.sendKudos = function (btn) {
    var key = btn.dataset.kudos, name = btn.dataset.kudosName, card = this.blocks.fun, self = this;
    var sent = U.loadJSON(KEYS.kudos, {}); sent[key] = new Date().toISOString(); U.saveJSON(KEYS.kudos, sent);
    var chip = U.frag(h`<span class="chip chip--ok chip--xs">${icon('check', 11)}<span>Đã chúc</span></span>`);
    btn.replaceWith(chip);
    if (!reduceMotion()) { card.classList.remove('celebrate'); void card.offsetWidth; card.classList.add('celebrate'); this.later(function () { card.classList.remove('celebrate'); }, 720); }
    UI.toast('Đã gửi lời chúc tới ' + name, { kind: 'brand', title: 'Lời chúc đã bay đi 🎉' });
    this.later(function () { self.renderFun(); }, 800);
  };

  /* --------------------------------------------------------- interactions */
  Dashboard.prototype.bind = function () {
    var c = this.container, self = this;
    var on = function (evt, sel, fn) { self.unbinders.push(U.delegate(c, evt, sel, fn)); };
    on('click', '[data-action]', function (e, el) {
      var a = el.dataset.action, Ed = E();
      if (a === 'leave') Ed.request({ type: 'leave' });
      else if (a === 'swap') Ed.request({ type: 'swap' });
      else if (a === 'ot') Ed.request({ type: 'ot' });
      else if (a === 'remote') self.doRemote(el);
      else if (a === 'event') Ed.event(null, { date: isWorkday(self.iso) ? self.iso : nextWorkday(self.iso) });
      else if (a === 'remind') { S().notify({ kind: 'warning', title: 'Nhắc xếp ca', body: U.shortName(S().me().name) + ' chưa được xếp ca ' + dmw(self.iso) + '.', link: '#/roster/' + self.iso }); UI.toast('Đã nhắc quản lý xếp ca cho bạn', { kind: 'success' }); }
    });
    on('click', '[data-jump]', function (e, el) { e.preventDefault(); var b = self.blocks[el.dataset.jump]; if (!b || b.hidden) return; b.scrollIntoView({ block: 'center', behavior: reduceMotion() ? 'auto' : 'smooth' }); var r = b.querySelector('[tabindex="0"]'); if (r) r.focus({ preventScroll: true }); });
    on('click', '[data-event-open]', function (e, el) { e.preventDefault(); E().eventDetail(el.dataset.eventOpen); });
    on('click', '[data-project-open]', function (e, el) { location.hash = '#/projects/' + el.dataset.projectOpen; });
    on('click', '[data-open-staff]', function (e, el) { E().staffProfile(el.dataset.openStaff); });
    on('click', '[data-checkin]', function (e, el) { if (el.disabled) return; self.doCheckin(el); });
    on('click', '[data-approve]', function (e, el) { self.approve(el.dataset.approve, el); });
    on('click', '[data-reject]', function (e, el) { self.reject(el.dataset.reject, el); });
    on('click', '[data-nudge]', function (e, el) { e.preventDefault(); e.stopPropagation(); self.doNudge(el.dataset.nudge); });
    on('click', '[data-nudge-all]', function (e) { e.preventDefault(); self.nudgeAll(); });
    on('click', '[data-prep-toggle]', function (e, el) {
      e.preventDefault(); e.stopPropagation();
      var item = el.closest('.prep__item'), willDone = !item.classList.contains('is-done');
      item.classList.toggle('is-done', willDone); el.setAttribute('aria-pressed', willDone ? 'true' : 'false'); // phản hồi tức thì, store sẽ vẽ lại
      S().togglePrep(el.dataset.prepEv, el.dataset.prepToggle);
    });
    on('keydown', '.db-req', function (e, el) {
      if (e.target !== el || e.metaKey || e.ctrlKey || e.altKey) return;
      var k = e.key.toLowerCase();
      if (k === 'e') { e.preventDefault(); var a = el.querySelector('[data-approve]'); if (a) self.approve(a.dataset.approve, a); }
      else if (k === 'x') { e.preventDefault(); var x = el.querySelector('[data-reject]'); if (x) self.reject(x.dataset.reject, x); }
      else if (k === 'arrowdown' || k === 'arrowup') { e.preventDefault(); var cards = U.qsa('.db-req', self.blocks.inbox), i = cards.indexOf(el); var n = cards[i + (k === 'arrowdown' ? 1 : -1)]; if (n) n.focus(); }
      else if (k === 'enter') { var w = S().request(el.dataset.id); if (w) E().staffProfile(w.staffId); }
    });
    // Lời mời: ↑/↓ đi giữa các hàng, Y / M / N trả lời, Enter mở chi tiết (chặn phím tắt toàn cục 'n' = tạo sự kiện)
    on('keydown', '.db-inv__row', function (e, row) {
      if (e.metaKey || e.ctrlKey || e.altKey || isTypingTarget(e.target)) return;
      var k = e.key.toLowerCase(), map = { y: 'yes', m: 'maybe', n: 'no' };
      if (k === 'arrowdown' || k === 'arrowup') {
        e.preventDefault(); e.stopPropagation();
        var rows = U.qsa('.db-inv__row', self.blocks.invites), i = rows.indexOf(row), nx = rows[i + (k === 'arrowdown' ? 1 : -1)];
        if (nx) nx.focus();
      } else if (map[k]) {
        e.preventDefault(); e.stopPropagation();
        var btn = row.querySelector('[data-rsvp="' + map[k] + '"]'); if (btn) btn.click();
      } else if (k === 'enter' && e.target === row) { e.preventDefault(); E().eventDetail(row.dataset.inv); }
    });
    on('click', '[data-where]', function (e, el) {
      self.whereFilter = el.dataset.where; U.saveJSON(KEYS.where, self.whereFilter);
      U.qsa('[data-where]', self.blocks.where).forEach(function (b) { var onb = b === el; b.classList.toggle('is-active', onb); b.setAttribute('aria-pressed', onb ? 'true' : 'false'); });
      self.renderWhereGrid();
    });
    on('click', '[data-fun-toggle]', function (e, el) {
      self.funOpen = !self.funOpen; U.saveJSON(KEYS.fun, { open: self.funOpen });
      var body = self.blocks.fun.querySelector('.db-fun__body');
      el.setAttribute('aria-expanded', self.funOpen); body.hidden = !self.funOpen; self.blocks.fun.classList.toggle('is-collapsed', !self.funOpen);
    });
    on('click', '[data-kudos]', function (e, el) { self.sendKudos(el); });
    // Nhịp đội: roving tabindex — 1 tab stop cho cả lưới, mũi tên đi giữa các ô
    on('keydown', '.db-pulse__grid .heat', function (e, el) {
      var k = e.key;
      if (k === 'Enter' || k === ' ') { e.preventDefault(); location.hash = '#/staff?view=pulse'; return; }
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      var grid = el.closest('.db-pulse__grid'), i = +el.dataset.i, j = +el.dataset.j;
      if (k === 'ArrowRight') i++; else if (k === 'ArrowLeft') i--; else if (k === 'ArrowDown') j++; else if (k === 'ArrowUp') j--;
      else if (k === 'Home') i = 0; else if (k === 'End') i = 6;
      else return;
      var next = grid.querySelector('.heat[data-i="' + i + '"][data-j="' + j + '"]');
      e.preventDefault();
      if (!next || next === el) return;
      el.setAttribute('tabindex', '-1'); next.setAttribute('tabindex', '0'); next.focus();
    });
  };

  /* ----------------------------------------------------------- live tick */
  Dashboard.prototype.tick = function () {
    if (!this.alive()) return;
    var now = U.nowMinutes(), real = U.todayISO(), st = S();
    if (real !== this.realISO) { this.readRoute({ query: {} }); this.renderAll(false); return; }
    var line = this.blocks.timeline.querySelector('.db-tl__now');
    if (line) {
      if (now < TL_START || now > TL_END) line.remove();
      else { line.style.left = ((now - TL_START) / TL_SPAN * 100) + '%'; var lbl = line.querySelector('.db-tl__nowlbl'); if (lbl) lbl.textContent = U.minToTime(now); }
    } else if (this.tlISO === real && now >= TL_START && now <= TL_END) this.renderTimeline();
    if (this.tlISO === real) U.qsa('.db-tl__ev[data-event-open]', this.blocks.timeline).forEach(function (b) { var e = st.event(b.dataset.eventOpen); if (!e) return; b.classList.toggle('is-live', isLive(e, real, now)); b.classList.toggle('is-past', !isLive(e, real, now) && U.timeToMin(e.end) <= now); });
    var ci = this.checkinState();
    if (ci && this.isReal) {
      var info = shiftInfo(st.me().id, this.iso), txt = this.blocks.hero.querySelector('.db-live__txt'), wrap = this.blocks.hero.querySelector('.db-checkin');
      if (txt) txt.innerHTML = this.liveText(info, ci);
      if (wrap && !ci.out && now >= U.timeToMin(info.end) && wrap.dataset.phase !== 'after') this.renderHero();
    }
    // "Tiếp theo" trên hero: đếm lùi; đổi sự kiện khi cái cũ đã kết thúc
    var nt = this.blocks.hero.querySelector('[data-next-time]');
    if (nt && this.isReal && !this.friday) {
      var nx = this.nextEvent(st.me().id, this.iso);
      if (!nx || nx.ev.id !== nt.dataset.nextTime) this.renderHero();
      else { nt.textContent = nextTimeText(nx); nt.classList.toggle('is-soon', nx.mins != null && nx.mins < 180 && !nx.live); nt.classList.toggle('is-live', !!nx.live); }
    }
    U.qsa('.ev-pill[data-event]', this.blocks.upcoming).forEach(function (p) { var e = st.event(p.dataset.event); if (e) p.classList.toggle('is-live', isLive(e, real, now)); });
    // "Cần nhắc": cập nhật chip "còn Xg"; vẽ lại khi tập sự kiện thay đổi (đã qua / mới lọt vào cửa sổ 48g)
    if (!this.attBusy) {
      var rows = U.qsa('.db-att__row', this.blocks.attention), ids = this.attentionItems().slice(0, ATTENTION_MAX).map(function (n) { return n.event.id; });
      var same = rows.length === ids.length && rows.every(function (r, i) { return r.dataset.att === ids[i]; });
      if (!same) this.renderAttention();
      else rows.forEach(function (r) { var e = st.event(r.dataset.att); if (!e) return; var tl = timeLeft(hoursLeftOf(e)), el = r.querySelector('[data-left]'); if (el) { el.textContent = tl.text; el.className = 'db-att__left mono-sm tnum' + (tl.cls ? ' ' + tl.cls : ''); } });
    }
  };

  /* -------------------------------------------------------- store events */
  Dashboard.prototype.onStore = function (meta) {
    if (!this.alive()) return;
    var t = (meta && meta.type) || '';
    if (!/^(request|shift|event|staff|project|reset|user)/.test(t)) return;
    if (this.inboxBusy) { this.pendingRerender = true; return; }
    if (t === 'reset' || t === 'user' || t.indexOf('project') === 0) { this.renderAll(false); return; }
    this.renderHead();
    if (t === 'event:rsvp') { this.onRsvp(meta); this.renderHero(); this.renderTimeline(); this.renderUpcoming(); this.renderAttention({ animate: true }); this.renderExec(); return; }
    if (t === 'event:nudge') { if (!this.nudgeBatch) { this.renderAttention(); this.renderUpcoming(); this.renderExec(); } return; }
    if (t === 'event:prep') { this.renderAttention({ animate: true }); this.renderExec(); return; }
    if (t.indexOf('request') === 0) { this.renderInbox(); this.renderKpis(false); if (t === 'request:status') { this.renderWhere(); this.renderPulse(); this.renderHero(); } return; }
    if (t.indexOf('shift') === 0) { this.renderHero(); this.renderQuick(); this.renderKpis(false); this.renderWhere(); this.renderPulse(); this.renderExec(); return; }
    if (t.indexOf('event') === 0) { this.renderHero(); this.renderTimeline(); this.renderInvites(); this.renderUpcoming(); this.renderDeadlines(); this.renderKpis(false); this.renderAttention(); this.renderExec(); this.renderPulse(); this.renderFun(); return; }
    if (t.indexOf('staff') === 0) { this.renderHero(); this.renderWhere(); this.renderFun(); this.renderExec(); }
  };

  /* --------------------------------------------------------- lifecycle */
  Dashboard.prototype.update = function (route) {
    var prevISO = this.iso, prevFri = this.friday;
    this.readRoute(route);
    if (prevISO !== this.iso || prevFri !== this.friday) this.renderAll(false); else this.setTitle();
  };
  Dashboard.prototype.destroy = function () {
    this.destroyed = true;
    if (this.unsub) { this.unsub(); this.unsub = null; }
    (this.unregisterKeys || []).forEach(function (f) { f && f(); });
    this.unregisterKeys = [];
    this.unbinders.forEach(function (f) { f && f(); });
    this.unbinders.length = 0;
    this.timers.forEach(function (t) { clearInterval(t); clearTimeout(t); });
    this.timers.length = 0;
    if (this.pulseIO) { this.pulseIO.disconnect(); this.pulseIO = null; }
    document.removeEventListener('visibilitychange', this.onVis);
    this.invBusy = this.attBusy = this.inboxBusy = false;
  };

  Z15.views.dashboard = {
    title: 'Hôm nay',
    render: function (container, route) { return new Dashboard(container, route); }
  };
})(window);
