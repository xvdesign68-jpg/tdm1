/* =====================================================================
   Z15 Miracle · Lịch làm việc — views/calendar.js
   Lịch ngày / tuần / tháng: lưới giờ, kéo-thả, now-line, bộ lọc,
   trượt tuần, morph neo giữa các chế độ, bảng bên trong chế độ ngày.
   Route: #/calendar/{day|week|month}/{yyyy-mm-dd}?staff=&team=&mine=1&types=
   ===================================================================== */
(function (global) {
  'use strict';
  var Z15 = global.Z15 = global.Z15 || {};
  Z15.views = Z15.views || {};
  var U = Z15.utils, UI = Z15.ui, D = Z15.data, C = Z15.config;
  var S = function () { return Z15.store; };
  var E = function () { return Z15.editors; };
  var R = function () { return Z15.router; };

  var PREF_FILTERS = 'z15.ui.calendar.filters', PREF_MODE = 'z15.ui.calendar.mode';
  var MODES = ['day', 'week', 'month'];
  var LAYERS = ['mine', 'team', 'all'];
  var SNAP = 15;
  var MAX_SLOTS = 3, MIN_SLOT_W = 44; // cột chồng giờ: tối đa 3 ô (2 sự kiện + “+N nữa”) khi mỗi ô < 44px
  var NARROW_MQ = '(max-width: 768px)';

  /* ------------------------------------------------------------ helpers */
  function reduceMotion() { return U.prefersReducedMotion() || document.body.classList.contains('reduce-motion'); }
  function isNarrow() { return !!(window.matchMedia && window.matchMedia(NARROW_MQ).matches); }
  function hourH() { var v = parseFloat(getComputedStyle(document.body).getPropertyValue('--hour-h')); return v > 0 ? v : (C.hourHeight || 64); }
  function evStart(e) { return U.timeToMin(e.start); }
  function evEnd(e) { return Math.max(U.timeToMin(e.end), U.timeToMin(e.start)); }
  function snap(m) { return Math.round(m / SNAP) * SNAP; }
  function floorSnap(m) { return Math.floor(m / SNAP) * SNAP; }
  function validISO(s) { return U.validISO(s); }
  function nextWorkday(iso) {
    var d = U.addDays(U.fromISO(iso), 1);
    for (var i = 0; i < 14; i++, d = U.addDays(d, 1)) { var k = U.toISO(d); if (!U.isWeekend(d) && !S().holidayName(k)) return k; }
    return U.toISO(d);
  }
  function isMine(ev, me) { return ev.attendeeIds.indexOf(me.id) >= 0 || ev.ownerId === me.id; }

  /* ------------------------------------------------------------ filters */
  function loadPrefs() {
    var p = U.loadJSON(PREF_FILTERS, null) || {};
    return { layer: LAYERS.indexOf(p.layer) >= 0 ? p.layer : 'all', teams: Array.isArray(p.teams) ? p.teams : [], types: Array.isArray(p.types) ? p.types : [] };
  }
  function savePrefs(F) { U.saveJSON(PREF_FILTERS, { layer: F.layer, teams: F.teams, types: F.types }); }
  function filtersFromRoute(route) {
    var q = route.query || {}, p = loadPrefs(), st = S();
    var teamIds = st.state.teams.map(function (t) { return t.id; }), typeIds = D.EVENT_TYPES.map(function (t) { return t.id; });
    var F = { layer: p.layer, teams: p.teams.filter(function (t) { return teamIds.indexOf(t) >= 0; }), types: p.types.filter(function (t) { return typeIds.indexOf(t) >= 0; }), staff: '' };
    if (q.mine === '1') F.layer = 'mine';
    else if (q.layer && LAYERS.indexOf(q.layer) >= 0) F.layer = q.layer;
    if (q.team != null) F.teams = String(q.team).split(',').filter(function (t) { return teamIds.indexOf(t) >= 0; });
    if (q.types != null) F.types = String(q.types).split(',').filter(function (t) { return typeIds.indexOf(t) >= 0; });
    if (q.staff && st.staff(q.staff)) F.staff = q.staff;
    return F;
  }
  function queryFor(F) {
    var q = {};
    if (F.layer === 'mine') q.mine = '1';
    if (F.teams.length) q.team = F.teams.join(',');
    if (F.types.length) q.types = F.types.join(',');
    if (F.staff) q.staff = F.staff;
    return q;
  }
  function hasFilter(F) { return F.layer !== 'all' || F.teams.length > 0 || F.types.length > 0 || !!F.staff; }
  function passes(ev, F, cx) {
    if (F.staff && ev.attendeeIds.indexOf(F.staff) < 0) return false;
    if (!F.staff) {
      if (F.layer === 'mine' && !isMine(ev, cx.me)) return false;
      if (F.layer === 'team' && !ev.attendeeIds.some(function (id) { return cx.teamOf[id] === cx.me.teamId; })) return false;
    }
    if (F.teams.length && !ev.attendeeIds.some(function (id) { return F.teams.indexOf(cx.teamOf[id]) >= 0; })) return false;
    if (F.types.length && F.types.indexOf(ev.type) < 0) return false;
    return true;
  }

  /* -------------------------------------------------------------- route */
  function parseRoute(route) {
    var parts = route.parts || [];
    var mode = MODES.indexOf(parts[0]) >= 0 ? parts[0] : U.loadJSON(PREF_MODE, 'week');
    if (MODES.indexOf(mode) < 0) mode = 'week';
    var iso = validISO(parts[1]) ? parts[1] : U.todayISO();
    return { mode: mode, iso: iso, F: filtersFromRoute(route) };
  }
  function go(mode, iso, F) { R().go('calendar/' + mode + '/' + iso, queryFor(F)); }
  function daysFor(mode, iso) {
    var d = U.fromISO(iso);
    if (mode === 'day') return [iso];
    if (mode === 'month') return U.monthGrid(d).map(U.toISO);
    if (isNarrow()) return [-1, 0, 1].map(function (n) { return U.toISO(U.addDays(d, n)); });
    var days = U.weekDays(d).map(U.toISO);
    if (S().state.settings.showWeekend === false) days = days.slice(0, 5);
    return days;
  }
  function periodKey(mode, iso) {
    if (mode === 'day') return 'd' + iso;
    if (mode === 'month') return 'm' + iso.slice(0, 7);
    if (isNarrow()) return 'n' + iso;
    return 'w' + U.toISO(U.startOfWeek(U.fromISO(iso)));
  }
  function stepDate(mode, iso, dir) {
    var d = U.fromISO(iso);
    if (mode === 'day' || (mode === 'week' && isNarrow())) return U.toISO(U.addDays(d, dir));
    if (mode === 'week') return U.toISO(U.addDays(d, 7 * dir));
    var m = new Date(d.getFullYear(), d.getMonth() + dir, 1);
    m.setDate(Math.min(d.getDate(), U.endOfMonth(m).getDate()));
    return U.toISO(m);
  }
  function titleFor(mode, iso) {
    var d = U.fromISO(iso);
    if (mode === 'day') return U.weekdayLong(d) + ', ' + U.fmtDate(d);
    if (mode === 'month') return U.fmtDate(d, 'monthYear');
    if (isNarrow()) { var a = U.addDays(d, -1), b = U.addDays(d, 1); return U.fmtDate(a, 'dm') + ' – ' + U.fmtDate(b, 'dm') + '/' + b.getFullYear(); }
    var s = U.startOfWeek(d), e = U.endOfWeek(d);
    return 'Tuần ' + U.isoWeek(s) + ' · ' + U.fmtDate(s, 'dm') + ' – ' + U.fmtDate(e, 'dm') + '/' + e.getFullYear();
  }

  /* --------------------------------------------------------- data views */
  function ctx() {
    var st = S().state, me = S().me(), teamOf = {};
    st.staff.forEach(function (s) { teamOf[s.id] = s.teamId; });
    return { st: st, me: me, teamOf: teamOf, today: U.todayISO(), now: U.nowMinutes() };
  }
  function conflictSet(list) {
    var out = {}, timed = list.filter(function (e) { return !e.allDay && evEnd(e) > evStart(e); });
    for (var i = 0; i < timed.length; i++) for (var j = i + 1; j < timed.length; j++) {
      var a = timed[i], b = timed[j];
      if (!(evStart(a) < evEnd(b) && evStart(b) < evEnd(a))) continue;
      if (a.attendeeIds.some(function (id) { return b.attendeeIds.indexOf(id) >= 0; })) { out[a.id] = true; out[b.id] = true; }
    }
    return out;
  }
  function dayEvents(iso, F, cx) {
    var all = S().eventsOn(iso);
    return { all: all, vis: all.filter(function (e) { return passes(e, F, cx); }), conflicts: conflictSet(all) };
  }
  function conflictsFor(ev, iso, s, e) {
    var out = [];
    S().eventsOn(iso).forEach(function (o) {
      if (o.id === ev.id || o.allDay) return;
      var os = evStart(o), oe = evEnd(o);
      if (!(os < e && s < oe)) return;
      var shared = o.attendeeIds.filter(function (id) { return ev.attendeeIds.indexOf(id) >= 0; });
      if (shared.length) out.push({ ev: o, staff: shared });
    });
    return out;
  }
  function isUrgent(ev, cx) {
    var startMs = U.fromISO(ev.date).getTime() + evStart(ev) * 60000, diff = startMs - Date.now();
    return diff < 864e5 && (diff >= 0 || ev.date === cx.today);
  }
  function pillClasses(ev, cx, conflicts) {
    var cls = ['cal-pill'];
    if (isMine(ev, cx.me)) cls.push('is-mine');
    if (ev.date === cx.today && !ev.allDay) {
      var s = evStart(ev), e = evEnd(ev);
      if (s <= cx.now && cx.now < e) cls.push('is-live'); else if (e <= cx.now) cls.push('is-past');
    }
    if (ev.type === 'deadline' && isUrgent(ev, cx)) cls.push('is-urgent');
    if (conflicts && conflicts[ev.id]) cls.push('is-conflict');
    return cls.join(' ');
  }
  /** Xếp cột cho các sự kiện chồng giờ trong một ngày. */
  function layoutDay(events) {
    var items = events.map(function (e) { var s = evStart(e); return { ev: e, s: s, e: Math.max(evEnd(e), s + SNAP) }; });
    items.sort(function (a, b) { return a.s - b.s || (b.e - b.s) - (a.e - a.s); });
    var clusters = [], cur = null, curEnd = -1;
    items.forEach(function (it) {
      if (!cur || it.s >= curEnd) { cur = []; clusters.push(cur); curEnd = it.e; } else curEnd = Math.max(curEnd, it.e);
      cur.push(it);
    });
    clusters.forEach(function (cl) {
      var ends = [];
      cl.forEach(function (it) {
        var c = -1; for (var i = 0; i < ends.length; i++) if (ends[i] <= it.s) { c = i; break; }
        if (c < 0) { c = ends.length; ends.push(0); }
        ends[c] = it.e; it.col = c; it.cl = cl;
      });
      cl.forEach(function (it) {
        it.cols = ends.length; it.span = 1;
        for (var c = it.col + 1; c < ends.length; c++) {
          var blocked = cl.some(function (o) { return o !== it && o.col === c && o.s < it.e && it.s < o.e; });
          if (blocked) break; it.span++;
        }
      });
    });
    return items;
  }
  function rangeFor(days, F, cx) {
    var start = C.workStart * 60, end = C.workEnd * 60;
    days.forEach(function (iso) {
      S().eventsOn(iso).forEach(function (e) {
        if (e.allDay || !passes(e, F, cx)) return;
        start = Math.min(start, Math.floor(evStart(e) / 60) * 60);
        end = Math.max(end, Math.ceil(Math.max(evEnd(e), evStart(e) + SNAP) / 60) * 60);
      });
    });
    return { start: start, end: Math.min(end, 24 * 60) };
  }
  function monthPill(ev, cls) {
    var st = S(), project = ev.projectId ? st.project(ev.projectId) : null;
    var time = ev.allDay ? 'Cả ngày' : ev.start;
    return '<div class="ev-pill ev-pill--compact cal-mpill ' + cls + '" data-type="' + ev.type + '" data-event="' + ev.id + '"' + (project ? ' style="--ev:' + project.color + '"' : '') + ' tabindex="0" role="button" aria-label="' + U.escapeHtml(ev.title + ', ' + (ev.allDay ? 'cả ngày' : U.fmtTimeRange(ev.start, ev.end))) + '">' +
      '<span class="ev-pill__bar"></span><span class="ev-pill__main"><span class="ev-pill__title"><b class="cal-mpill__t">' + U.escapeHtml(time) + '</b><span class="cal-mpill__ttl">' + U.escapeHtml(ev.title) + '</span></span></span></div>';
  }

  /* -------------------------------------------------------------- state */
  var V = null; // instance duy nhất

  /* ------------------------------------------------------------ builders */
  function emptyOverlay(F) {
    var filtered = hasFilter(F);
    return '<div class="cal-empty"><div class="cal-empty__box">' + UI.icon('coffee', 20) +
      '<p>' + (filtered ? 'Không có sự kiện nào khớp bộ lọc trong khoảng này.' : 'Khoảng thời gian này còn trống — kéo trên lưới để tạo sự kiện.') + '</p>' +
      (filtered ? '<button type="button" class="btn btn--soft btn--sm" data-act="clear">Bỏ lọc</button>' : '<button type="button" class="btn btn--soft btn--sm" data-act="new">' + UI.icon('plus', 14) + 'Tạo sự kiện</button>') +
      '</div></div>';
  }

  /** Dựng phần đầu (ngày + cả ngày) và lớp lưới cho 1 kỳ. */
  function renderPeriod(days, F, cx, opts) {
    opts = opts || {};
    var st = S(), range = rangeFor(days, F, cx), pxm = hourH() / 60;
    var grid = U.el('div', { class: 'cal-layer', style: '--cols:' + days.length });
    var head = U.el('div', { class: 'cal-hd', style: '--cols:' + days.length });
    var total = 0, mine = 0, anyAllDay = false, firstStart = null;
    var daysHtml = '', adHtml = '', colsHtml = '';
    var wide = days.length <= 3;
    var bodyW = V && V.body ? V.body.clientWidth : 0, gutterW = parseFloat(getComputedStyle(document.body).getPropertyValue('--cal-gutter')) || 56;
    var colW = bodyW > 0 ? Math.max(0, bodyW - gutterW - (days.length === 1 ? 336 : 0)) / days.length : 150;
    days.forEach(function (iso) {
      var d = U.fromISO(iso), isToday = iso === cx.today, weekend = U.isWeekend(d), hol = st.holidayName(iso), selected = iso === V.iso;
      var de = dayEvents(iso, F, cx);
      var timed = de.vis.filter(function (e) { return !e.allDay; }), allday = de.vis.filter(function (e) { return e.allDay; });
      total += de.vis.length; mine += de.vis.filter(function (e) { return isMine(e, cx.me); }).length;
      timed.forEach(function (e) { var s = evStart(e); if (firstStart == null || s < firstStart) firstStart = s; });
      var label = U.fmtDate(d, 'long') + (hol ? ' · ' + hol : '') + (isToday ? ' · Hôm nay' : '');
      daysHtml += '<button type="button" class="cal-dh cal-anchor' + (isToday ? ' is-today' : '') + (weekend ? ' is-weekend' : '') + (selected ? ' is-selected' : '') + (hol ? ' is-holiday' : '') + '" data-day="' + iso + '" aria-label="' + U.escapeHtml(label) + '"' + (isToday ? ' aria-current="date"' : '') + '>' +
        '<span class="cal-dh__wd">' + (wide ? U.weekdayLong(d) : U.weekdayShort(d)) + '</span><span class="cal-dh__num tnum">' + d.getDate() + '</span>' + (de.vis.length && !wide ? '<span class="cal-dh__dots" aria-hidden="true">' + de.vis.slice(0, 3).map(function () { return '<i></i>'; }).join('') + '</span>' : '') + '</button>';
      var ad = [];
      if (hol) ad.push('<span class="cal-ad__hol">' + UI.icon('flag', 12) + '<span>' + U.escapeHtml(hol) + '</span></span>');
      if (F.staff) { var sh = st.shiftOf(F.staff, iso); if (sh !== 'off') ad.push(UI.shiftBadge(sh, { label: wide || days.length <= 5, cls: 'cal-ad__shift' })); }
      allday.forEach(function (e) { ad.push(UI.eventPill(e, { compact: true, cls: pillClasses(e, cx, de.conflicts) + ' cal-adpill' })); });
      if (ad.length) anyAllDay = true;
      adHtml += '<div class="cal-ad' + (isToday ? ' is-today' : '') + (weekend ? ' is-weekend' : '') + '" data-day="' + iso + '">' + ad.join('') + '</div>';
      var items = layoutDay(timed), moreHtml = '', capped = [];
      items.forEach(function (it) {
        // Cụm ≥4 cột trong cột hẹp: chỉ hiện 2 cột + nút “+N nữa” (mở chế độ ngày)
        if (it.cols <= MAX_SLOTS || colW / it.cols >= MIN_SLOT_W || capped.indexOf(it.cl) >= 0) return;
        var cl = it.cl, hidden = cl.filter(function (o) { return o.col >= MAX_SLOTS - 1; });
        if (!hidden.length) return;
        capped.push(cl);
        var hs = Infinity, he = -Infinity;
        hidden.forEach(function (o) { o.hidden = true; hs = Math.min(hs, o.s); he = Math.max(he, o.e); });
        cl.forEach(function (o) { if (!o.hidden) { o.cols = MAX_SLOTS; o.span = Math.min(o.span, MAX_SLOTS - 1 - o.col); } });
        var mtop = (hs - range.start) * pxm, mh = Math.max((he - hs) * pxm, 20);
        var mlbl = '+' + hidden.length + ' sự kiện khác, ' + U.minToTime(hs) + ' – ' + U.minToTime(he) + ' — xem theo ngày';
        moreHtml += '<button type="button" class="cal-more" data-go-day="' + iso + '" aria-label="' + U.escapeHtml(mlbl) + '" data-tip="' + U.escapeHtml(mlbl) + '" style="top:' + mtop.toFixed(1) + 'px;height:' + mh.toFixed(1) + 'px;left:calc(' + ((MAX_SLOTS - 1) / MAX_SLOTS * 100).toFixed(3) + '% + 2px);width:calc(' + (1 / MAX_SLOTS * 100).toFixed(3) + '% - 4px)"><span>+' + hidden.length + '</span><span class="cal-more__w">&nbsp;nữa</span></button>';
      });
      var evHtml = items.filter(function (it) { return !it.hidden; }).map(function (it) {
        var top = (it.s - range.start) * pxm, h = Math.max((it.e - it.s) * pxm, 20), dur = evEnd(it.ev) - evStart(it.ev);
        var short = dur < 30, tall = dur >= 90;
        var cls = pillClasses(it.ev, cx, de.conflicts) + (short ? ' cal-pill--short' : tall ? ' cal-pill--tall' : '') + (dur === 0 ? ' cal-pill--point' : '');
        return '<div class="cal-ev" data-event="' + it.ev.id + '" style="top:' + top.toFixed(1) + 'px;height:' + h.toFixed(1) + 'px;left:calc(' + (it.col / it.cols * 100).toFixed(3) + '% + 2px);width:calc(' + (it.span / it.cols * 100).toFixed(3) + '% - 4px)">' + UI.eventPill(it.ev, { compact: short, cls: cls }) + '</div>';
      }).join('');
      var nowHtml = '';
      if (isToday) {
        var show = cx.now >= range.start && cx.now <= range.end;
        nowHtml = '<div class="cal-now" style="transform:translateY(' + ((cx.now - range.start) * pxm).toFixed(1) + 'px)"' + (show ? '' : ' hidden') + '><div class="now-line' + (opts.grow === false ? '' : ' is-grow') + '"></div></div>';
      }
      colsHtml += '<div class="cal-col' + (isToday ? ' is-today' : '') + (weekend ? ' is-weekend' : '') + (hol ? ' is-holiday' : '') + '" data-day="' + iso + '">' + evHtml + moreHtml + nowHtml + '</div>';
    });
    head.innerHTML = '<div class="cal-hd__row cal-hd__days"><div class="cal-hd__gutter"></div>' + daysHtml + '</div>' +
      (anyAllDay ? '<div class="cal-hd__row cal-hd__allday"><div class="cal-hd__gutter"><span class="eyebrow">Cả ngày</span></div>' + adHtml + '</div>' : '');
    grid.innerHTML = colsHtml + (total === 0 ? emptyOverlay(F) : '');
    return { head: head, grid: grid, range: range, total: total, mine: mine, firstStart: firstStart };
  }

  function setRange(view, range) {
    var hours = (range.end - range.start) / 60;
    view.style.setProperty('--cal-hours', String(hours));
    var g = view.querySelector('.cal-gutter'); if (!g) return;
    var key = range.start + '-' + range.end;
    if (g.dataset.range !== key) {
      g.dataset.range = key; var html = '';
      for (var h = 1; h < hours; h++) html += '<span class="cal-hour" style="top:calc(' + h + ' * var(--hour-h))">' + U.minToTime(range.start + h * 60) + '</span>';
      html += '<span class="cal-now-label" hidden></span>';
      g.innerHTML = html;
    }
  }

  function renderMonth(iso, F, cx) {
    var st = S(), d = U.fromISO(iso), m = d.getMonth(), days = U.monthGrid(d);
    var el = U.el('div', { class: 'cal-layer cal-month' });
    var total = 0, mine = 0;
    var html = '<div class="cal-month__wd">' + U.WEEKDAYS_SHORT.map(function (w, i) { return '<span class="eyebrow' + (i >= 5 ? ' is-weekend' : '') + '">' + w + '</span>'; }).join('') + '</div>';
    days.forEach(function (dt) {
      var k = U.toISO(dt), de = dayEvents(k, F, cx), out = dt.getMonth() !== m, hol = st.holidayName(k), isToday = k === cx.today, weekend = U.isWeekend(dt);
      if (!out) { total += de.vis.length; mine += de.vis.filter(function (e) { return isMine(e, cx.me); }).length; }
      var shown = de.vis.slice(0, de.vis.length <= 3 ? 3 : 2), more = de.vis.length - shown.length;
      html += '<div class="cal-mc cal-anchor' + (out ? ' is-out' : '') + (isToday ? ' is-today' : '') + (weekend ? ' is-weekend' : '') + (k === V.iso ? ' is-selected' : '') + (hol ? ' is-holiday' : '') + '" data-day="' + k + '">' +
        '<div class="cal-mc__top"><button type="button" class="cal-mc__num tnum" data-go-week="' + k + '" aria-label="' + U.escapeHtml('Xem tuần của ' + U.fmtDate(dt, 'long')) + '"' + (isToday ? ' aria-current="date"' : '') + '>' + dt.getDate() + '</button>' + (hol ? '<span class="cal-mc__hol truncate">' + U.escapeHtml(hol) + '</span>' : '') + '</div>' +
        '<div class="cal-mc__list">' + shown.map(function (e) { return monthPill(e, pillClasses(e, cx, de.conflicts)); }).join('') + (more > 0 ? '<button type="button" class="cal-mc__more" data-go-day="' + k + '">+' + more + ' nữa</button>' : '') + '</div></div>';
    });
    el.innerHTML = html;
    el._counts = { total: total, mine: mine };
    return el;
  }

  /* ---------------------------------------------------------- side panel */
  function freePeople(iso, from, to) {
    var st = S(), out = [];
    st.state.staff.forEach(function (s) {
      var sh = st.shiftOf(s.id, iso); if (sh === 'off' || sh === 'leave') return;
      var busy = st.eventsFor(s.id, iso).some(function (e) { if (e.allDay) return e.type === 'shoot' || e.type === 'event'; return evStart(e) < to && from < evEnd(e); });
      if (!busy) out.push(s);
    });
    return out;
  }
  function freeListHtml(iso, slot, cx) {
    var st = S(), hol = st.holidayName(iso), from, to;
    if (slot === 'now') { from = cx.now; to = cx.now + 1; } else { from = U.timeToMin(slot); to = from + 60; }
    var list = freePeople(iso, from, to);
    if (!list.length) return '<p class="cal-side__muted">' + (hol ? 'Ngày lễ — không ai trực hôm nay.' : U.isWeekend(iso) ? 'Cuối tuần — không ai được xếp ca.' : 'Không ai rảnh trong khung giờ này.') + '</p>';
    var shown = list.slice(0, 8);
    return '<div class="cal-free">' + shown.map(function (s) {
      var team = st.team(s.teamId), sh = st.shiftType(st.shiftOf(s.id, iso));
      return '<button type="button" class="cal-free__p" data-staff-open="' + s.id + '">' + UI.avatar(s, { size: 'sm', status: true, title: false }) + '<span class="cal-free__txt"><b class="truncate">' + U.escapeHtml(U.shortName(s.name)) + '</b><small class="truncate">' + U.escapeHtml((team ? team.short : '') + ' · ' + sh.label) + '</small></span></button>';
    }).join('') + '</div>' + (list.length > shown.length ? '<div class="cal-side__muted">+' + (list.length - shown.length) + ' người khác cũng rảnh</div>' : '');
  }
  function renderSide(side, iso, F, cx) {
    if (!side) return;
    var st = S(), stats = st.dayStats(iso), hol = st.holidayName(iso), d = U.fromISO(iso), isToday = iso === cx.today;
    var de = dayEvents(iso, F, cx);
    var withMe = {};
    st.eventsFor(cx.me.id, iso).forEach(function (e) { e.attendeeIds.forEach(function (id) { if (id !== cx.me.id) withMe[id] = true; }); });
    var withMeList = Object.keys(withMe).map(st.staff).filter(Boolean);
    var slot = V.freeSlot && (V.freeSlot !== 'now' || isToday) ? V.freeSlot : (isToday ? 'now' : '14:00');
    var statsTxt = stats.onDuty + ' làm việc' + (stats.remote ? ' · ' + stats.remote + ' remote' : '') + (stats.onsite ? ' · ' + stats.onsite + ' quay' : '') + (stats.ot ? ' · ' + stats.ot + ' tăng ca' : '') + (stats.leave ? ' · ' + stats.leave + ' nghỉ' : '');
    var nw = nextWorkday(iso);
    var opts = (isToday ? '<option value="now"' + (slot === 'now' ? ' selected' : '') + '>Bây giờ</option>' : '');
    for (var h = 7; h <= 19; h++) { var v = U.minToTime(h * 60); opts += '<option value="' + v + '"' + (slot === v ? ' selected' : '') + '>' + v + ' – ' + U.minToTime(h * 60 + 60) + '</option>'; }
    var freeTitle = slot === 'now' ? 'Ai đang rảnh' : 'Ai rảnh';
    side.innerHTML =
      '<section class="cal-side__sec cal-side__sec--date"><div class="eyebrow">' + U.escapeHtml(U.fmtRelativeDay(d)) + '</div><h3 class="cal-side__date">' + U.escapeHtml(U.fmtDate(d, 'long')) + '</h3>' +
      (hol ? '<p class="cal-side__hol">' + UI.icon('flag', 14) + '<span>Nghỉ lễ <b>' + U.escapeHtml(hol) + '</b> — cả công ty nghỉ. Ngày làm việc tiếp theo: <button type="button" class="link-btn" data-go-day="' + nw + '">' + U.escapeHtml(U.fmtDate(nw, 'shortWeekday')) + '</button></span></p>' : '<p class="cal-side__stats tnum">' + U.escapeHtml(statsTxt) + '</p>') + '</section>' +
      '<section class="cal-side__sec"><div class="cal-side__h"><span class="eyebrow">Cùng ngày với bạn</span><span class="cal-side__count tnum">' + withMeList.length + '</span></div>' +
      (withMeList.length ? '<div class="cal-side__with">' + UI.avatarStack(withMeList, { max: 7, size: 'sm' }) + '<p class="cal-side__names">' + U.escapeHtml(withMeList.slice(0, 4).map(function (s) { return U.firstName(s.name); }).join(', ') + (withMeList.length > 4 ? ' và ' + (withMeList.length - 4) + ' người khác' : '')) + '</p></div>' : '<p class="cal-side__muted">Bạn không có sự kiện chung với ai trong ngày này.</p>') + '</section>' +
      '<section class="cal-side__sec"><div class="cal-side__h"><span class="eyebrow cal-side__free-title">' + U.escapeHtml(freeTitle) + '</span><select class="cal-side__time" aria-label="Chọn khung giờ">' + opts + '</select></div><div class="cal-side__free">' + freeListHtml(iso, slot, cx) + '</div></section>' +
      '<section class="cal-side__sec cal-side__sec--events"><div class="cal-side__h"><span class="eyebrow">Sự kiện trong ngày</span><span class="cal-side__count tnum">' + de.vis.length + '</span></div>' +
      (de.vis.length ? '<div class="cal-side__list">' + de.vis.map(function (e) { return UI.eventPill(e, { cls: pillClasses(e, cx, de.conflicts) }); }).join('') + '</div>' : '<div class="cal-side__empty"><p>' + (hol ? 'Ngày lễ — lịch trống hoàn toàn.' : hasFilter(F) ? 'Không có sự kiện nào khớp bộ lọc.' : 'Ngày này chưa có sự kiện nào.') + '</p>' + (hasFilter(F) && !hol ? '<button type="button" class="btn btn--soft btn--sm" data-act="clear">Bỏ lọc</button>' : '<button type="button" class="btn btn--soft btn--sm" data-act="new">' + UI.icon('plus', 14) + 'Tạo sự kiện</button>') + '</div>') + '</section>';
  }

  /* --------------------------------------------------------------- view */
  function buildView(mode, iso, F, cx) {
    var view = U.el('section', { class: 'cal-view cal-view--' + mode, dataset: { mode: mode } });
    if (mode === 'month') {
      var scrollM = U.el('div', { class: 'cal-scroll cal-scroll--month' });
      var layersM = U.el('div', { class: 'cal-layers' });
      var monthEl = renderMonth(iso, F, cx);
      layersM.appendChild(monthEl); scrollM.appendChild(layersM); view.appendChild(scrollM);
      view._counts = monthEl._counts;
      return view;
    }
    var scroll = U.el('div', { class: 'cal-scroll' });
    var head = U.el('div', { class: 'cal-head' });
    var headLayers = U.el('div', { class: 'cal-head__layers' });
    head.appendChild(headLayers);
    var stage = U.el('div', { class: 'cal-stage' });
    var gutter = U.el('div', { class: 'cal-gutter', 'aria-hidden': 'true' });
    var layers = U.el('div', { class: 'cal-layers' });
    stage.appendChild(gutter); stage.appendChild(layers);
    scroll.appendChild(head); scroll.appendChild(stage);
    view.appendChild(scroll);
    var r = renderPeriod(daysFor(mode, iso), F, cx, {});
    headLayers.appendChild(r.head); layers.appendChild(r.grid);
    setRange(view, r.range);
    view._range = r.range; view._firstStart = r.firstStart; view._counts = { total: r.total, mine: r.mine };
    if (mode === 'day') { var side = U.el('aside', { class: 'cal-side', 'aria-label': 'Tóm tắt ngày' }); renderSide(side, iso, F, cx); view.appendChild(side); }
    return view;
  }
  function initialScroll(view) {
    var sc = view.querySelector('.cal-scroll'); if (!sc || !view._range) return;
    var target = Math.min(C.workStart * 60, view._firstStart == null ? Infinity : view._firstStart);
    sc.scrollTop = Math.max(0, (target - view._range.start) * (hourH() / 60) - 6);
  }

  /* -------------------------------------------------------- transitions */
  function finishSlide() {
    if (!V || !V.slide) return;
    var sl = V.slide; V.slide = null; clearTimeout(sl.timer);
    sl.old.forEach(function (n) { n.remove(); });
    sl.neu.forEach(function (n) { n.classList.remove('is-anim'); n.style.transform = ''; n.style.opacity = ''; });
  }
  function finishMorph() {
    if (!V || !V.morph) return;
    var m = V.morph; V.morph = null; clearTimeout(m.timer);
    m.old.remove();
    m.neu.classList.remove('is-anim', 'is-entering'); m.neu.style.transform = ''; m.neu.style.opacity = ''; m.neu.style.transformOrigin = '';
  }
  function slideTo(dir, cx) {
    var view = V.view; if (!view) return;
    finishSlide(); finishMorph();
    var reduce = reduceMotion(), sgn = dir > 0 ? 1 : -1;
    var layersEl = view.querySelector('.cal-layers');
    var oldGrid = layersEl.querySelector('.cal-layer'), neuGrid, neuHead = null, oldHead = null;
    if (V.mode === 'month') { neuGrid = renderMonth(V.iso, V.F, cx); view._counts = neuGrid._counts; }
    else {
      var r = renderPeriod(V.days, V.F, cx, {});
      neuGrid = r.grid; neuHead = r.head; setRange(view, r.range); view._range = r.range; view._counts = { total: r.total, mine: r.mine };
      var hl = view.querySelector('.cal-head__layers'); oldHead = hl.querySelector('.cal-hd');
      if (!reduce) neuHead.style.transform = 'translateX(' + (12 * sgn) + 'px)';
      neuHead.style.opacity = '0'; hl.appendChild(neuHead);
      if (V.mode === 'day') renderSide(view.querySelector('.cal-side'), V.iso, V.F, cx);
    }
    if (!reduce) neuGrid.style.transform = 'translateX(' + (24 * sgn) + 'px)';
    neuGrid.style.opacity = '0'; layersEl.appendChild(neuGrid);
    var olds = [oldGrid, oldHead].filter(Boolean), neus = [neuGrid, neuHead].filter(Boolean);
    olds.forEach(function (n) { n.classList.add('is-leaving'); });
    void neuGrid.offsetWidth;
    olds.concat(neus).forEach(function (n) { n.classList.add('is-anim'); });
    requestAnimationFrame(function () {
      neus.forEach(function (n) { n.style.transform = ''; n.style.opacity = ''; });
      olds.forEach(function (n) { n.style.opacity = '0'; if (!reduce) n.style.transform = 'translateX(' + (n === oldHead ? -12 * sgn : -24 * sgn) + 'px)'; });
    });
    V.slide = { old: olds, neu: neus, timer: setTimeout(finishSlide, reduce ? 160 : 360) };
  }
  function morphTo(cx, anchorIso) {
    var body = V.body, oldView = V.view;
    finishSlide(); finishMorph();
    var neu = buildView(V.mode, V.iso, V.F, cx);
    neu.classList.add('is-entering'); body.appendChild(neu); initialScroll(neu);
    var reduce = reduceMotion();
    var a = oldView.querySelector('.cal-anchor[data-day="' + anchorIso + '"]'), b = neu.querySelector('.cal-anchor[data-day="' + anchorIso + '"]');
    if (!reduce && a && b) {
      var ra = a.getBoundingClientRect(), rb = b.getBoundingClientRect(), rBody = body.getBoundingClientRect();
      var s = rb.width ? ra.width / rb.width : 1; if (s < 0.6 || s > 1.6) s = 1;
      var dx = (ra.left - rBody.left) - (rb.left - rBody.left) * s, dy = (ra.top - rBody.top) - (rb.top - rBody.top) * s;
      neu.style.transformOrigin = '0 0';
      neu.style.transform = 'translate(' + dx.toFixed(1) + 'px,' + dy.toFixed(1) + 'px) scale(' + s.toFixed(4) + ')';
    }
    neu.style.opacity = '0';
    void neu.offsetWidth;
    neu.classList.add('is-anim'); oldView.classList.add('is-anim', 'is-leaving');
    requestAnimationFrame(function () {
      neu.style.transform = ''; neu.style.opacity = '';
      oldView.style.opacity = '0'; if (!reduce) oldView.style.transform = 'scale(.985)';
    });
    V.view = neu;
    V.morph = { old: oldView, neu: neu, timer: setTimeout(finishMorph, reduce ? 160 : 420) };
  }
  /** Vẽ lại kỳ hiện tại tại chỗ (không animation). */
  function refresh() {
    if (!V || !V.view) return;
    var cx = ctx(), view = V.view;
    finishSlide();
    var layersEl = view.querySelector('.cal-layers');
    if (V.mode === 'month') { var m = renderMonth(V.iso, V.F, cx); layersEl.replaceChildren(m); view._counts = m._counts; }
    else {
      var r = renderPeriod(V.days, V.F, cx, { grow: false });
      layersEl.replaceChildren(r.grid); view.querySelector('.cal-head__layers').replaceChildren(r.head);
      setRange(view, r.range); view._range = r.range; view._counts = { total: r.total, mine: r.mine };
      if (V.mode === 'day') renderSide(view.querySelector('.cal-side'), V.iso, V.F, cx);
      flipIfPending(r.grid);
    }
    syncBar(cx); updateNow();
  }

  /* ---------------------------------------------------------- now-line */
  function updateNow() {
    if (!V || !V.view || V.mode === 'month') return;
    var view = V.view, range = view._range; if (!range) return;
    var cx = ctx(), pxm = hourH() / 60, y = (cx.now - range.start) * pxm, show = cx.now >= range.start && cx.now <= range.end;
    var col = view.querySelector('.cal-col.is-today');
    U.qsa('.cal-now', view).forEach(function (n) { n.style.transform = 'translateY(' + y.toFixed(1) + 'px)'; n.hidden = !show; });
    var lbl = view.querySelector('.cal-now-label');
    if (lbl) { lbl.hidden = !(show && col); lbl.style.transform = 'translateY(calc(' + y.toFixed(1) + 'px - 50%))'; lbl.textContent = U.minToTime(cx.now); }
    if (!col) return;
    var st = S(), nl = col.querySelector('.now-line');
    U.qsa('.cal-ev', col).forEach(function (w) {
      var ev = st.event(w.dataset.event), pill = w.querySelector('.ev-pill'); if (!ev || !pill) return;
      var s = evStart(ev), e = evEnd(ev);
      pill.classList.toggle('is-live', s <= cx.now && cx.now < e);
      pill.classList.toggle('is-past', e <= cx.now);
      if (nl && isMine(ev, cx.me) && s - cx.now > 0 && s - cx.now <= 15 && !V.pinged[ev.id]) {
        V.pinged[ev.id] = true; nl.classList.add('ping');
        nl.addEventListener('animationend', function () { nl.classList.remove('ping'); }, { once: true });
      }
    });
  }

  /* -------------------------------------------------------------- bar */
  function buildBar() {
    var st = S();
    var bar = U.el('div', { class: 'cal-bar reveal', style: '--i:0' });
    var layerChips = [{ id: 'mine', label: 'Của tôi', icon: 'user' }, { id: 'team', label: 'Team tôi', icon: 'users' }, { id: 'all', label: 'Toàn công ty', icon: 'building' }].map(function (l) {
      return '<button type="button" class="chip chip--btn" data-layer="' + l.id + '" aria-pressed="false">' + UI.icon(l.icon, 13) + '<span>' + l.label + '</span></button>';
    }).join('');
    var teamChips = st.state.teams.map(function (t) {
      return '<button type="button" class="chip chip--btn chip--color" style="--chip:' + t.color + '" data-team="' + t.id + '" aria-pressed="false" data-tip="' + U.escapeHtml(t.desc || t.name) + '"><i class="chip__dot"></i><span>' + U.escapeHtml(t.name) + '</span></button>';
    }).join('');
    var typeChips = D.EVENT_TYPES.map(function (t) {
      return '<button type="button" class="chip chip--btn cal-tchip" data-type="' + t.id + '" aria-pressed="false" aria-label="' + U.escapeHtml(t.label) + '" data-tip="' + U.escapeHtml(t.label) + '">' + UI.icon(t.icon, 13) + '<span class="cal-tchip__lbl">' + U.escapeHtml(t.label) + '</span></button>';
    }).join('');
    bar.innerHTML =
      '<div class="cal-bar__row cal-bar__main">' +
        '<div class="cal-bar__nav">' +
          '<button type="button" class="btn btn--secondary btn--sm cal-todaybtn" data-act="today" data-tip="Về hôm nay (T)">Hôm nay</button>' +
          '<span class="cal-bar__arrows"><button type="button" class="icon-btn icon-btn--sm" data-act="prev" aria-label="Kỳ trước (J)" data-tip="Kỳ trước · J">' + UI.icon('chevron-left', 17) + '</button><button type="button" class="icon-btn icon-btn--sm" data-act="next" aria-label="Kỳ sau (K)" data-tip="Kỳ sau · K">' + UI.icon('chevron-right', 17) + '</button></span>' +
          '<button type="button" class="cal-title" data-act="pick" aria-haspopup="dialog" aria-expanded="false"><span class="cal-title__txt t-h2"></span>' + UI.icon('chevron-down', 16) + '</button>' +
        '</div>' +
        '<div class="cal-bar__seg"></div>' +
      '</div>' +
      '<div class="cal-bar__row cal-bar__filters">' +
        '<div class="cal-fgroup cal-fgroup--layer" role="group" aria-label="Phạm vi">' + layerChips + '</div>' +
        '<div class="cal-fgroup cal-fgroup--staff" hidden></div>' +
        '<i class="cal-sep" aria-hidden="true"></i>' +
        '<div class="cal-fgroup cal-fgroup--teams" role="group" aria-label="Lọc theo team">' + teamChips + '</div>' +
        '<i class="cal-sep" aria-hidden="true"></i>' +
        '<div class="cal-fgroup cal-fgroup--types" role="group" aria-label="Lọc theo loại sự kiện">' + typeChips + '</div>' +
        '<button type="button" class="link-btn cal-clear" data-act="clear" hidden>Bỏ lọc</button>' +
      '</div>' +
      '<div class="cal-bar__note" hidden></div>';
    var seg = UI.segmented([{ value: 'day', label: 'Ngày' }, { value: 'week', label: 'Tuần' }, { value: 'month', label: 'Tháng' }], V.mode, function (v) { go(v, V.iso, V.F); }, { cls: 'cal-seg' });
    U.qsa('.segmented__btn', seg).forEach(function (b, i) { b.setAttribute('data-tip', 'Phím ' + (i + 1)); });
    bar.querySelector('.cal-bar__seg').appendChild(seg);
    V.seg = seg;
    return bar;
  }
  function syncBar(cx) {
    var bar = V.bar, F = V.F, st = S();
    bar.querySelector('.cal-title__txt').textContent = titleFor(V.mode, V.iso);
    U.qsa('[data-layer]', bar).forEach(function (b) { var on = !F.staff && b.dataset.layer === F.layer; b.classList.toggle('is-active', on); b.setAttribute('aria-pressed', on ? 'true' : 'false'); });
    U.qsa('[data-team]', bar).forEach(function (b) { var on = F.teams.indexOf(b.dataset.team) >= 0; b.classList.toggle('is-active', on); b.setAttribute('aria-pressed', on ? 'true' : 'false'); });
    U.qsa('[data-type]', bar).forEach(function (b) { var on = F.types.indexOf(b.dataset.type) >= 0; b.classList.toggle('is-active', on); b.setAttribute('aria-pressed', on ? 'true' : 'false'); });
    var staffWrap = bar.querySelector('.cal-fgroup--staff'), layerWrap = bar.querySelector('.cal-fgroup--layer');
    var person = F.staff ? st.staff(F.staff) : null;
    staffWrap.hidden = !person; layerWrap.hidden = !!person;
    if (person) staffWrap.innerHTML = '<span class="eyebrow cal-fgroup__lbl">Lịch của</span><span class="chip chip--person">' + UI.avatar(person, { size: 'xs', title: false }) + '<span>' + U.escapeHtml(U.shortName(person.name)) + '</span><button type="button" class="chip__x" data-act="clear-staff" aria-label="Bỏ lọc theo nhân sự">' + UI.icon('x', 12) + '</button></span>';
    else staffWrap.innerHTML = '';
    bar.querySelector('.cal-clear').hidden = !hasFilter(F);
    if (V.seg) { U.qsa('.segmented__btn', V.seg).forEach(function (b) { var on = b.dataset.value === V.mode; b.classList.toggle('is-active', on); b.setAttribute('aria-checked', on ? 'true' : 'false'); b.removeAttribute('aria-selected'); }); V.seg.refresh(); }
    var inPeriod = V.days.indexOf(cx.today) >= 0;
    bar.querySelector('.cal-todaybtn').classList.toggle('is-current', inPeriod);
    // Ghi chú ngày lễ hôm nay (tuần / tháng)
    var note = bar.querySelector('.cal-bar__note'), holToday = st.holidayName(cx.today);
    if (holToday && V.mode !== 'day' && inPeriod) {
      var nw = nextWorkday(cx.today);
      note.hidden = false;
      note.innerHTML = '<div class="banner cal-note">' + UI.icon('flag', 15) + '<span>Hôm nay nghỉ lễ <b>' + U.escapeHtml(holToday) + '</b> — cả công ty nghỉ. Ngày làm việc tiếp theo: <b>' + U.escapeHtml(U.weekdayLong(U.fromISO(nw)) + ' ' + U.fmtDate(nw, 'dm')) + '</b>.</span><button type="button" class="link-btn" data-go-day="' + nw + '">Xem ngày đó ' + UI.icon('arrow-right', 13) + '</button></div>';
    } else { note.hidden = true; note.innerHTML = ''; }
    var c = V.view && V.view._counts || { total: 0, mine: 0 };
    var sub = titleFor(V.mode, V.iso) + ' · ' + c.total + ' sự kiện' + (c.mine ? ' · ' + c.mine + ' của bạn' : '') + (person ? ' · lịch của ' + U.shortName(person.name) : '');
    Z15.app.setTitle('Lịch', sub);
  }

  /* -------------------------------------------------------- mini month */
  function openPicker(anchor) {
    var cur = U.fromISO(V.iso), shown = new Date(cur.getFullYear(), cur.getMonth(), 1);
    var pop = UI.popover(anchor, '', { placement: 'bottom-start', cls: 'popover--calpick', width: 292, focus: false });
    function draw() {
      var days = U.monthGrid(shown), today = U.todayISO(), m = shown.getMonth(), st = S();
      pop.el.innerHTML = '<div class="cal-pick"><div class="cal-pick__head"><button type="button" class="icon-btn icon-btn--sm" data-nav="-1" aria-label="Tháng trước">' + UI.icon('chevron-left', 16) + '</button><b>' + U.escapeHtml(U.fmtDate(shown, 'monthYear')) + '</b><button type="button" class="icon-btn icon-btn--sm" data-nav="1" aria-label="Tháng sau">' + UI.icon('chevron-right', 16) + '</button></div>' +
        '<div class="cal-pick__grid">' + U.WEEKDAYS_SHORT.map(function (w) { return '<span class="cal-pick__wd">' + w + '</span>'; }).join('') +
        days.map(function (dt) { var k = U.toISO(dt), hol = st.holidayName(k); return '<button type="button" class="cal-pick__d' + (dt.getMonth() !== m ? ' is-out' : '') + (k === today ? ' is-today' : '') + (k === V.iso ? ' is-selected' : '') + (U.isWeekend(dt) ? ' is-weekend' : '') + (hol ? ' is-holiday' : '') + '" data-iso="' + k + '" aria-label="' + U.escapeHtml(U.fmtDate(dt, 'long') + (hol ? ' · ' + hol : '')) + '">' + dt.getDate() + '</button>'; }).join('') + '</div>' +
        '<div class="cal-pick__foot"><button type="button" class="btn btn--ghost btn--sm" data-iso="' + today + '">Hôm nay</button><span class="cal-pick__hint">Nhấn để nhảy tới ngày</span></div></div>';
      pop.reposition();
    }
    draw();
    pop.el.addEventListener('click', function (e) {
      var n = e.target.closest('[data-nav]'); if (n) { shown = U.addMonths(shown, +n.dataset.nav); draw(); return; }
      var b = e.target.closest('[data-iso]'); if (b) { pop.close(); go(V.mode, b.dataset.iso, V.F); }
    });
    return pop;
  }

  /* --------------------------------------------------------- drag & drop */
  function settleGhost(pf, toEl, done) {
    var r = toEl.getBoundingClientRect(), g = pf.ghost, reduce = reduceMotion();
    var finish = function () { if (pf.layerEl.parentNode) pf.layerEl.remove(); done && done(); };
    if (reduce) { finish(); return; }
    g.classList.add('is-settle');
    g.style.transform = 'translate3d(' + r.left.toFixed(1) + 'px,' + r.top.toFixed(1) + 'px,0) scale(' + (r.width / pf.w).toFixed(4) + ',' + (r.height / pf.h).toFixed(4) + ')';
    U.onceTransitionEnd(g, finish, 320);
  }
  function flipIfPending(grid) {
    if (!V.pendingFlip) return;
    var pf = V.pendingFlip; V.pendingFlip = null;
    var wrap = grid.querySelector('.cal-ev[data-event="' + pf.id + '"]');
    if (!wrap) { pf.layerEl.remove(); return; }
    wrap.classList.add('is-settling');
    settleGhost(pf, wrap, function () {
      wrap.classList.remove('is-settling');
      if (!reduceMotion()) { wrap.classList.add('cell-flash'); setTimeout(function () { wrap.classList.remove('cell-flash'); }, 480); }
    });
  }
  function bindDrag(root) {
    var d = null;
    function colAt(x, cols) {
      for (var i = 0; i < cols.length; i++) if (x >= cols[i].left && x < cols[i].right) return cols[i];
      return x < cols[0].left ? cols[0] : cols[cols.length - 1];
    }
    function autoScroll() {
      var sc = d.scroll; if (!sc) return;
      var r = sc.getBoundingClientRect();
      if (d.y < r.top + 48 && sc.scrollTop > 0) sc.scrollTop -= 8;
      else if (d.y > r.bottom - 48) sc.scrollTop += 8;
    }
    function tick() {
      if (!d || !d.active) return;
      var lr = d.layer.getBoundingClientRect(), reduce = reduceMotion();
      autoScroll();
      if (d.mode === 'move') {
        var col = colAt(d.x, d.cols);
        var start = U.clamp(snap(d.range.start + (d.y - d.grabY - lr.top) / d.pxm), d.range.start, Math.max(d.range.start, d.range.end - d.dur));
        d.target = { iso: col.iso, start: start };
        d.tx = col.left + 2; d.ty = lr.top + (start - d.range.start) * d.pxm;
        if (d.colW !== col.width) { d.colW = col.width; d.ghost.style.width = (col.width - 4) + 'px'; }
        var conf = conflictsFor(d.ev, col.iso, start, start + d.dur);
        if ((conf.length > 0) !== d.hasConflict) { d.hasConflict = conf.length > 0; d.ghostPill.classList.toggle('is-conflict', d.hasConflict); }
        d.conf = conf;
        var t = reduce ? 1 : 0.35;
        d.cx = U.lerp(d.cx, d.tx, t); d.cy = U.lerp(d.cy, d.ty, t);
        d.ghost.style.transform = 'translate3d(' + d.cx.toFixed(1) + 'px,' + d.cy.toFixed(1) + 'px,0)';
        var label = U.minToTime(start) + ' – ' + U.minToTime(start + d.dur);
        if (d.timeEl.textContent !== label) d.timeEl.textContent = label;
      } else {
        var cur = U.clamp(snap(d.range.start + (d.y - lr.top) / d.pxm), d.range.start, d.range.end);
        var a = Math.min(d.anchorMin, cur), b = Math.max(d.anchorMin, cur);
        if (b - a < SNAP) { b = a + SNAP; if (b > d.range.end) { b = d.range.end; a = b - SNAP; } }
        d.selStart = a; d.selEnd = b;
        d.sel.style.transform = 'translateY(' + ((a - d.range.start) * d.pxm).toFixed(1) + 'px)';
        d.sel.style.height = ((b - a) * d.pxm).toFixed(1) + 'px';
        var lbl = U.minToTime(a) + ' – ' + U.minToTime(b);
        if (d.selLbl.textContent !== lbl) d.selLbl.textContent = lbl;
      }
      d.raf = requestAnimationFrame(tick);
    }
    function startDrag() {
      d.active = true;
      try { root.setPointerCapture(d.id); } catch (err) { /* noop */ }
      d.pxm = hourH() / 60; d.range = V.view._range;
      if (!d.range) { d.active = false; return; }
      d.cols = U.qsa('.cal-col', d.layer).map(function (c) { var r = c.getBoundingClientRect(); return { el: c, iso: c.dataset.day, left: r.left, right: r.right, width: r.width }; });
      d.scroll = d.layer.closest('.cal-scroll');
      document.body.classList.add('cal-dragging');
      if (d.mode === 'move') {
        var ev = S().event(d.wrap.dataset.event); if (!ev) { d.active = false; return; }
        d.ev = ev; d.dur = Math.max(evEnd(ev) - evStart(ev), SNAP);
        var r = d.wrap.getBoundingClientRect();
        d.grabY = d.y0 - r.top; d.w = r.width; d.h = r.height;
        d.layerEl = U.el('div', { class: 'drag-layer' });
        d.ghost = d.wrap.cloneNode(true); d.ghost.className = 'cal-ev cal-ghost drag-ghost'; d.ghost.removeAttribute('data-event');
        d.ghost.style.cssText = 'width:' + r.width + 'px;height:' + r.height + 'px;transform:translate3d(' + r.left + 'px,' + r.top + 'px,0)';
        d.ghostPill = d.ghost.querySelector('.ev-pill'); d.ghostPill.classList.remove('is-dragging', 'is-past');
        d.timeEl = U.el('span', { class: 'cal-ghost__time', text: U.fmtTimeRange(ev.start, ev.end) }); d.ghost.appendChild(d.timeEl);
        d.layerEl.appendChild(d.ghost); document.body.appendChild(d.layerEl);
        d.pill = d.wrap.querySelector('.ev-pill'); d.pill.classList.add('is-dragging');
        d.cx = r.left; d.cy = r.top; d.tx = r.left; d.ty = r.top; d.colW = -1; d.hasConflict = false;
        d.origin = { iso: ev.date, start: evStart(ev) }; d.target = { iso: ev.date, start: evStart(ev) };
      } else {
        var lr = d.layer.getBoundingClientRect();
        d.anchorMin = U.clamp(floorSnap(d.range.start + (d.y0 - lr.top) / d.pxm), d.range.start, d.range.end - SNAP);
        d.sel = U.el('div', { class: 'cal-select', 'aria-hidden': 'true' });
        d.selLbl = U.el('span', { class: 'cal-select__time' }); d.sel.appendChild(d.selLbl);
        d.col.appendChild(d.sel); d.selIso = d.col.dataset.day;
      }
      d.raf = requestAnimationFrame(tick);
    }
    function endDrag(cancel) {
      var dd = d; d = null;
      cancelAnimationFrame(dd.raf); document.body.classList.remove('cal-dragging');
      try { root.releasePointerCapture(dd.id); } catch (err) { /* noop */ }
      V.justDragged = true; setTimeout(function () { if (V) V.justDragged = false; }, 0);
      if (dd.mode === 'draw') {
        dd.sel.remove();
        if (!cancel && dd.selEnd > dd.selStart) {
          var me = S().me().id, att = [me]; if (V.F.staff && V.F.staff !== me) att.push(V.F.staff);
          E().event(null, { date: dd.selIso, start: U.minToTime(dd.selStart), end: U.minToTime(dd.selEnd), attendeeIds: att });
        }
        return;
      }
      var same = dd.target.iso === dd.origin.iso && dd.target.start === dd.origin.start;
      if (cancel || same) {
        settleGhost(dd, dd.wrap, function () { dd.pill.classList.remove('is-dragging'); });
        return;
      }
      var ev = dd.ev, target = dd.target, origin = dd.origin, conf = dd.conf || [];
      V.pendingFlip = { id: ev.id, ghost: dd.ghost, layerEl: dd.layerEl, w: dd.w, h: dd.h };
      S().moveEvent(ev.id, target.iso, target.start);
      if (V.pendingFlip) { V.pendingFlip = null; dd.layerEl.remove(); }
      var where = U.fmtDate(target.iso, 'shortWeekday') + ' ' + U.minToTime(target.start);
      var undo = { label: 'Hoàn tác', onClick: function () { S().moveEvent(ev.id, origin.iso, origin.start); UI.toast('Đã đưa “' + ev.title + '” về chỗ cũ', { kind: 'info' }); } };
      if (conf.length) {
        var ids = U.uniq([].concat.apply([], conf.map(function (c) { return c.staff; }))), names = ids.slice(0, 2).map(function (id) { var s = S().staff(id); return s ? U.shortName(s.name) : ''; }).filter(Boolean);
        var who = names.join(', ') + (ids.length > 2 ? ' +' + (ids.length - 2) : '');
        UI.toast('Đã dời “' + ev.title + '” sang ' + where + ' — trùng “' + conf[0].ev.title + '” · vẫn giữ?', { kind: 'warning', title: 'Trùng lịch với ' + who, action: undo, duration: 8000 });
      } else UI.toast('Đã dời “' + ev.title + '” sang ' + where, { kind: 'success', action: undo });
    }
    root.addEventListener('pointerdown', function (e) {
      if (e.button !== 0 || e.pointerType === 'touch' || d) return;
      if (V.slide || V.morph) return;
      var col = e.target.closest('.cal-col'); if (!col) return;
      if (e.target.closest('.cal-empty, .cal-more')) return;
      var wrap = e.target.closest('.cal-ev'), layer = col.closest('.cal-layer');
      if (!layer || layer.classList.contains('is-leaving')) return;
      d = { mode: wrap ? 'move' : 'draw', wrap: wrap, col: col, layer: layer, x0: e.clientX, y0: e.clientY, x: e.clientX, y: e.clientY, id: e.pointerId, active: false };
    });
    root.addEventListener('pointermove', function (e) {
      if (!d || e.pointerId !== d.id) return;
      d.x = e.clientX; d.y = e.clientY;
      if (!d.active) { if (Math.abs(d.x - d.x0) < 4 && Math.abs(d.y - d.y0) < 4) return; startDrag(); }
    });
    root.addEventListener('pointerup', function (e) { if (!d || e.pointerId !== d.id) return; if (d.active) endDrag(false); else d = null; });
    root.addEventListener('pointercancel', function (e) { if (!d || e.pointerId !== d.id) return; if (d.active) endDrag(true); else d = null; });
    root.addEventListener('click', function (e) { if (V && V.justDragged) { e.preventDefault(); e.stopPropagation(); } }, true);
    return { cancel: function () { if (d && d.active) endDrag(true); else d = null; }, isDragging: function () { return !!(d && d.active); } };
  }

  /* --------------------------------------------------------- interactions */
  function openNew(iso, startMin, endMin, extra) {
    var me = S().me().id, att = [me]; if (V.F.staff && V.F.staff !== me) att.push(V.F.staff);
    E().event(null, Object.assign({ date: iso, start: U.minToTime(startMin), end: U.minToTime(endMin), attendeeIds: att }, extra || {}));
  }
  function setFilters(patch) {
    var F = Object.assign({}, V.F, patch);
    savePrefs(F);
    go(V.mode, V.iso, F);
  }
  function toggleMine() { setFilters({ layer: V.F.layer === 'mine' ? 'all' : 'mine', staff: '' }); }
  function nav(dir) { go(V.mode, stepDate(V.mode, V.iso, dir), V.F); }
  function bindEvents(root) {
    root.addEventListener('click', function (e) {
      var t;
      if ((t = e.target.closest('[data-act]'))) {
        var act = t.dataset.act;
        if (act === 'today') return go(V.mode, U.todayISO(), V.F);
        if (act === 'prev') return nav(-1);
        if (act === 'next') return nav(1);
        if (act === 'pick') return void openPicker(t);
        if (act === 'clear') return setFilters({ layer: 'all', teams: [], types: [], staff: '' });
        if (act === 'clear-staff') return setFilters({ staff: '' });
        if (act === 'new') { var iso = V.mode === 'week' && V.days.indexOf(U.todayISO()) >= 0 ? U.todayISO() : V.iso; return openNew(iso, 9 * 60, 10 * 60); }
      }
      if ((t = e.target.closest('[data-layer]'))) return setFilters({ layer: t.dataset.layer, staff: '' });
      if ((t = e.target.closest('[data-team]')) && t.classList.contains('chip--btn')) {
        var teams = V.F.teams.slice(), i = teams.indexOf(t.dataset.team); if (i >= 0) teams.splice(i, 1); else teams.push(t.dataset.team);
        return setFilters({ teams: teams });
      }
      if ((t = e.target.closest('[data-type]')) && t.classList.contains('chip--btn')) {
        var types = V.F.types.slice(), j = types.indexOf(t.dataset.type); if (j >= 0) types.splice(j, 1); else types.push(t.dataset.type);
        return setFilters({ types: types });
      }
      if ((t = e.target.closest('[data-go-week]'))) return go('week', t.dataset.goWeek, V.F);
      if ((t = e.target.closest('[data-go-day]'))) return go('day', t.dataset.goDay, V.F);
      if ((t = e.target.closest('.cal-dh'))) return go('day', t.dataset.day, V.F);
      if ((t = e.target.closest('[data-staff-open]'))) { if (e.target.closest('.avatar[data-staff]')) return; return void E().staffProfile(t.dataset.staffOpen); }
    });
    root.addEventListener('dblclick', function (e) {
      var col = e.target.closest('.cal-col');
      if (col && !e.target.closest('.cal-ev, .cal-empty, .cal-more')) {
        var range = V.view._range; if (!range) return;
        var lr = col.getBoundingClientRect(), min = U.clamp(floorSnap(range.start + (e.clientY - lr.top) / (hourH() / 60)), range.start, range.end - 60);
        openNew(col.dataset.day, min, min + 60); return;
      }
      var mc = e.target.closest('.cal-mc');
      if (mc && !e.target.closest('.ev-pill, button')) openNew(mc.dataset.day, 9 * 60, 10 * 60);
    });
    root.addEventListener('change', function (e) {
      var sel = e.target.closest('.cal-side__time'); if (!sel) return;
      V.freeSlot = sel.value;
      var cx = ctx(), wrap = root.querySelector('.cal-side__free'), ttl = root.querySelector('.cal-side__free-title');
      if (wrap) wrap.innerHTML = freeListHtml(V.iso, sel.value, cx);
      if (ttl) ttl.textContent = sel.value === 'now' ? 'Ai đang rảnh' : 'Ai rảnh';
    });
    root.addEventListener('keydown', function (e) {
      var dh = e.target.closest && e.target.closest('.cal-mc__num, .cal-dh');
      if (!dh) return;
      if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') { e.preventDefault(); var sib = e.key === 'ArrowLeft' ? dh.parentElement.previousElementSibling : dh.parentElement.nextElementSibling; var nx = dh.classList.contains('cal-dh') ? (e.key === 'ArrowLeft' ? dh.previousElementSibling : dh.nextElementSibling) : (sib && sib.querySelector('.cal-mc__num')); if (nx && nx.focus && !nx.classList.contains('cal-hd__gutter')) nx.focus(); }
    });
  }

  /* -------------------------------------------------------------- route */
  function applyRoute(route, first) {
    var p = parseRoute(route), cx = ctx();
    var prevMode = V.mode, prevKey = V.key, prevIso = V.iso;
    V.mode = p.mode; V.iso = p.iso; V.F = p.F; V.narrow = isNarrow();
    V.days = daysFor(p.mode, p.iso); V.key = periodKey(p.mode, p.iso);
    U.saveJSON(PREF_MODE, p.mode);
    if (first || !V.view) { V.view = buildView(p.mode, p.iso, p.F, cx); V.body.appendChild(V.view); initialScroll(V.view); }
    else if (p.mode !== prevMode) morphTo(cx, p.iso);
    else if (V.key !== prevKey) slideTo(p.iso >= prevIso ? 1 : -1, cx);
    else refresh();
    syncBar(cx); updateNow();
  }

  /* ---------------------------------------------------------------- view */
  Z15.views.calendar = {
    title: 'Lịch',
    render: function (container, route) {
      if (V) this.destroy();
      V = { root: null, bar: null, body: null, view: null, mode: null, iso: null, F: null, days: [], key: null, slide: null, morph: null, pinged: {}, unregs: [], timers: [], freeSlot: null, pendingFlip: null, justDragged: false };
      var root = U.el('div', { class: 'cal' });
      V.root = root;
      V.mode = parseRoute(route).mode;
      V.bar = buildBar();
      V.body = U.el('div', { class: 'cal-body reveal', style: '--i:1' });
      root.appendChild(V.bar); root.appendChild(V.body);
      container.appendChild(root);
      bindEvents(root);
      V.drag = bindDrag(root);
      applyRoute(route, true);

      // Phím tắt riêng của Lịch
      V.unregs = [
        UI.shortcuts.register('j', function () { nav(-1); }, 'Kỳ trước', 'Lịch'),
        UI.shortcuts.register('k', function () { nav(1); }, 'Kỳ sau', 'Lịch'),
        UI.shortcuts.register('1', function () { go('day', V.iso, V.F); }, 'Xem theo ngày', 'Lịch'),
        UI.shortcuts.register('2', function () { go('week', V.iso, V.F); }, 'Xem theo tuần', 'Lịch'),
        UI.shortcuts.register('3', function () { go('month', V.iso, V.F); }, 'Xem theo tháng', 'Lịch'),
        UI.shortcuts.register('m', toggleMine, 'Chỉ hiện lịch của tôi', 'Lịch')
      ];
      UI.palette.register({ id: 'cal:mine', label: 'Lịch: chỉ hiện lịch của tôi', icon: 'user', section: 'Lịch', shortcut: 'm', keywords: 'cua toi mine', run: toggleMine });
      UI.palette.register({ id: 'cal:month', label: 'Lịch: xem theo tháng', icon: 'calendar-days', section: 'Lịch', shortcut: '3', keywords: 'thang month', run: function () { go('month', V.iso, V.F); } });
      V.onToday = function () { if (V) go(V.mode, U.todayISO(), V.F); };
      document.addEventListener('z15:today', V.onToday);
      V.onKey = function (e) { if (e.key === 'Escape' && V && V.drag.isDragging()) { e.preventDefault(); e.stopPropagation(); V.drag.cancel(); } };
      document.addEventListener('keydown', V.onKey, true);
      V.onResize = U.debounce(function () {
        if (!V) return;
        var n = isNarrow();
        if (n !== V.narrow) { V.narrow = n; V.days = daysFor(V.mode, V.iso); V.key = periodKey(V.mode, V.iso); refresh(); }
        else if (V.seg) V.seg.refresh();
      }, 150);
      window.addEventListener('resize', V.onResize);
      V.onVis = function () { if (!document.hidden) updateNow(); };
      document.addEventListener('visibilitychange', V.onVis);
      V.nowTimer = setInterval(updateNow, 30000);

      V.unsub = S().subscribe(function (state, meta) {
        if (!V) return;
        var t = meta && meta.type || '';
        if (t === 'settings') { if (meta.key === 'theme' || meta.key === 'sidebarCollapsed' || meta.key === 'showWeekend') return; refresh(); return; }
        if (/^event:|^shift:|^staff:|^reset$/.test(t)) refresh();
      });
    },
    update: function (route) { if (!V) return; applyRoute(route, false); },
    destroy: function () {
      if (!V) return;
      var v = V; V = null;
      finishSlideOf(v);
      if (v.drag) v.drag.cancel();
      if (v.unsub) v.unsub();
      v.unregs.forEach(function (f) { try { f(); } catch (e) { /* noop */ } });
      UI.palette.unregister('cal:mine'); UI.palette.unregister('cal:month');
      document.removeEventListener('z15:today', v.onToday);
      document.removeEventListener('keydown', v.onKey, true);
      document.removeEventListener('visibilitychange', v.onVis);
      window.removeEventListener('resize', v.onResize);
      clearInterval(v.nowTimer);
      if (v.slide) clearTimeout(v.slide.timer);
      if (v.morph) clearTimeout(v.morph.timer);
      U.qsa('.drag-layer').forEach(function (n) { n.remove(); });
      document.body.classList.remove('cal-dragging');
    }
  };
  function finishSlideOf(v) { if (v.slide) { clearTimeout(v.slide.timer); } if (v.morph) { clearTimeout(v.morph.timer); } }
})(window);
