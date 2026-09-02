/* =====================================================================
   Z15 Miracle · Lịch làm việc — views/requests.js
   "Đơn & Yêu cầu": nghỉ phép / remote / tăng ca / đổi ca.
   Route: #/requests?tab=pending|mine|all|history&type=&team=&q=&date=
   ===================================================================== */
(function (global) {
  'use strict';
  var Z15 = global.Z15; Z15.views = Z15.views || {};
  var U = Z15.utils, UI = Z15.ui, h = U.html, raw = U.raw;
  var S = function () { return Z15.store; };
  var E = function () { return Z15.editors; };

  var KEYS = { filters: 'z15.ui.requests.filters' };
  var TABS = [
    { id: 'pending', label: 'Chờ tôi duyệt', icon: 'inbox' },
    { id: 'mine', label: 'Của tôi', icon: 'user' },
    { id: 'all', label: 'Toàn bộ', icon: 'layers' },
    { id: 'history', label: 'Lịch sử', icon: 'history' }
  ];
  var TAB_IDS = TABS.map(function (t) { return t.id; });
  var TYPE_IDS = ['leave', 'remote', 'ot', 'swap'];
  var LEAVE_TOTAL = 12, LEAVE_USED_BASE = 3.5; // phép đã dùng đầu năm (mock) + phép duyệt trong hệ thống
  var OT_CAP_H = 12, OT_EXTRA_H = 2;              // trần OT 12g/tuần · mỗi ngày OT thêm 2g so với ca chuẩn
  var STATUS_LABEL = { pending: 'Chờ duyệt', approved: 'Đã duyệt', rejected: 'Từ chối' };

  /* ------------------------------------------------------------ helpers */
  function reduceMotion() { return U.prefersReducedMotion() || document.body.classList.contains('reduce-motion'); }
  function icon(name, size) { return raw(UI.icon(name, size)); }
  function dmw(iso) { return U.fmtDate(iso, 'shortWeekday'); }
  function dm(iso) { return U.fmtDate(iso, 'dm'); }
  function fmtNum(v) { return Number(v).toLocaleString('vi-VN', { minimumFractionDigits: 0, maximumFractionDigits: 1 }); }
  function isWorkday(iso) { return !U.isWeekend(iso) && !S().holidayName(iso); }
  function workdays(from, to) { var n = 0; for (var d = U.fromISO(from); U.toISO(d) <= to; d = U.addDays(d, 1)) if (isWorkday(U.toISO(d))) n++; return n; }
  function firstWorkday(from, to) { for (var d = U.fromISO(from); U.toISO(d) <= to; d = U.addDays(d, 1)) if (isWorkday(U.toISO(d))) return U.toISO(d); return from; }
  function eachDay(from, to, fn) { for (var d = U.fromISO(from); U.toISO(d) <= to; d = U.addDays(d, 1)) fn(U.toISO(d), d); }
  function typeOf(id) { return E().requestType(id); }
  function normalizeQ(q) { return String(q || '').replace(/\s+/g, ' ').trim().slice(0, 60); }
  function validISO(s) { return /^\d{4}-\d{2}-\d{2}$/.test(s || ''); }
  function monthOf(iso) { return String(iso || '').slice(0, 7); }
  function names(list) { return list.map(function (s) { return U.firstName(s.name); }).join(', '); }
  function rangeText(r) { return r.from === r.to ? dmw(r.from) : dmw(r.from) + ' – ' + dmw(r.to); }
  function dayCount(r) {
    var n = workdays(r.from, r.to);
    if (r.type === 'swap') return '1 ca';
    if (!n) { var allHol = true; eachDay(r.from, r.to, function (iso) { if (!S().holidayName(iso)) allHol = false; }); return (U.daysBetween(r.from, r.to) + 1) + ' ngày · ' + (allHol ? 'nghỉ lễ' : 'cuối tuần'); }
    return n + ' ngày làm việc';
  }

  /** FLIP theo trục Y: đo → biến đổi DOM → đo lại → dịch ngược → trượt về 0. */
  function flipY(nodes, mutate, dur) {
    nodes = (nodes || []).filter(Boolean);
    if (reduceMotion() || !nodes.length) { mutate(); return; }
    var before = nodes.map(function (n) { return n.getBoundingClientRect().top; });
    mutate();
    var moving = [];
    nodes.forEach(function (n, i) {
      if (!n.isConnected) return;
      var d = before[i] - n.getBoundingClientRect().top;
      if (Math.abs(d) < .5) return;
      n.style.transition = 'none'; n.style.transform = 'translateY(' + d + 'px)'; moving.push(n);
    });
    if (!moving.length) return;
    void document.body.offsetHeight;
    requestAnimationFrame(function () {
      moving.forEach(function (n) { n.style.transition = 'transform ' + dur + 'ms var(--ease-inout)'; n.style.transform = ''; });
      setTimeout(function () { moving.forEach(function (n) { n.style.transition = ''; }); }, dur + 40);
    });
  }
  /** Lật số trên badge: số cũ đi lên, số mới từ dưới lên (180ms). */
  function flipBadge(badge, val) {
    if (!badge) return;
    U.qsa('.rq-badge__n.is-above', badge).forEach(function (n) { n.remove(); }); // dọn số cũ nếu lật liên tiếp
    var cur = badge.querySelector('.rq-badge__n:not(.is-above)'), txt = String(val);
    if (!cur) { badge.innerHTML = '<span class="rq-badge__n">' + txt + '</span>'; return; }
    if (cur.textContent === txt) return;
    if (reduceMotion()) { cur.textContent = txt; return; }
    var next = document.createElement('span'); next.className = 'rq-badge__n is-below'; next.textContent = txt;
    badge.appendChild(next); void next.offsetWidth;
    cur.classList.add('is-above'); next.classList.remove('is-below');
    setTimeout(function () { if (cur.parentNode) cur.remove(); }, 220);
  }

  /* ----------------------------------------------------------------- view */
  function RequestsView(container, route) {
    var self = this;
    this.container = container;
    this.unbinders = []; this.timers = [];
    this.selected = {}; this.busy = 0; this.dirty = false; this.suppress = false; this.firstPaint = true; this.justRestored = {};
    this.readRoute(route);
    this.build();
    this.renderTabs(); this.renderFilters(); this.renderList({ first: true }); this.renderSide(true);
    this.bind(); this.setTitle();
    this.unsub = S().subscribe(function (state, meta) { self.onStore(meta); });
    this.unregisterKeys = [
      UI.shortcuts.register('e', function () { var c = self.focusedCard(); if (c) self.approveFromCard(c); }, 'Duyệt đơn đang chọn', 'Yêu cầu'),
      UI.shortcuts.register('x', function () { var c = self.focusedCard(); if (c) self.rejectFromCard(c); }, 'Từ chối đơn đang chọn', 'Yêu cầu'),
      UI.shortcuts.register('f', function () { var i = self.els.search; if (i) { i.focus(); i.select(); } }, 'Tìm trong yêu cầu', 'Yêu cầu')
    ];
    UI.palette.register({ id: 'requests:pending', label: 'Mở đơn chờ tôi duyệt', icon: 'inbox', section: 'Yêu cầu', keywords: 'don cho duyet approve', run: function () { Z15.router.go('requests', { tab: 'pending' }); } });
    this.timers.push(setInterval(function () { self.tick(); }, 60000));
  }

  /* ---------------------------------------------------------- route / state */
  RequestsView.prototype.readRoute = function (route) {
    var q = (route && route.query) || {}, st = S(), saved = U.loadJSON(KEYS.filters, {}) || {};
    this.dateOverride = validISO(q.date) ? q.date : '';
    this.todayISO = this.dateOverride || U.todayISO();
    var type = TYPE_IDS.indexOf(q.type) >= 0 ? q.type : (q.type === '' && 'type' in q ? '' : (TYPE_IDS.indexOf(saved.type) >= 0 ? saved.type : ''));
    var team = q.team && st.team(q.team) ? q.team : ('team' in q ? '' : (saved.team && st.team(saved.team) ? saved.team : ''));
    this.F = { tab: TAB_IDS.indexOf(q.tab) >= 0 ? q.tab : 'pending', type: type, team: team, q: normalizeQ(q.q) };
    U.saveJSON(KEYS.filters, { type: this.F.type, team: this.F.team });
  };
  RequestsView.prototype.key = function () { return JSON.stringify(this.F) + '|' + this.todayISO; };
  RequestsView.prototype.hasFilter = function () { var F = this.F; return !!(F.type || F.team || F.q); };
  RequestsView.prototype.query = function () { var F = this.F, q = { tab: F.tab }; ['type', 'team', 'q'].forEach(function (k) { if (F[k]) q[k] = F[k]; }); if (this.dateOverride) q.date = this.dateOverride; return q; };
  RequestsView.prototype.syncURL = function (push) {
    var q = this.query(), qs = Object.keys(q).map(function (k) { return encodeURIComponent(k) + '=' + encodeURIComponent(q[k]); }).join('&');
    var hash = '#/requests' + (qs ? '?' + qs : '');
    if (location.hash === hash) return;
    if (push) { location.hash = hash; return; }
    try { history.replaceState(null, '', hash); if (Z15.router && Z15.router.parse) Z15.router.current = Z15.router.parse(hash); }
    catch (e) { location.hash = hash; }
  };
  RequestsView.prototype.me = function () { return S().me(); };
  RequestsView.prototype.isMine = function (r) { return r.staffId === S().state.currentUserId; };
  RequestsView.prototype.canDecide = function (r) { return r.status === 'pending' && !this.isMine(r); };
  RequestsView.prototype.canCancel = function (r) { return r.status === 'pending' && this.isMine(r); };
  RequestsView.prototype.inTab = function (r, tab) {
    tab = tab || this.F.tab;
    if (tab === 'pending') return this.canDecide(r);
    if (tab === 'mine') return this.isMine(r);
    if (tab === 'history') return r.status !== 'pending';
    return true;
  };
  RequestsView.prototype.counts = function () {
    var self = this, out = { pending: 0, mine: 0, all: 0, history: 0 };
    S().state.requests.forEach(function (r) { TAB_IDS.forEach(function (t) { if (self.inTab(r, t)) out[t]++; }); });
    return out;
  };
  RequestsView.prototype.filtered = function () {
    var self = this, st = S(), F = this.F;
    var list = st.state.requests.filter(function (r) {
      if (!self.inTab(r)) return false;
      if (F.type && r.type !== F.type) return false;
      var who = st.staff(r.staffId); if (!who) return false;
      if (F.team && who.teamId !== F.team) return false;
      if (F.q) {
        var other = r.swapWithId ? st.staff(r.swapWithId) : null, team = st.team(who.teamId);
        var hay = who.name + ' ' + who.role + ' ' + (team ? team.name : '') + ' ' + r.reason + ' ' + typeOf(r.type).label + ' ' + (other ? other.name : '') + ' ' + (r.note || '');
        if (!U.fuzzyMatch(F.q, hay)) return false;
      }
      return true;
    });
    if (F.tab === 'pending') return U.sortBy(list, function (r) { return r.from + ' ' + r.createdAt; });
    if (F.tab === 'history') return U.sortBy(list, function (r) { return r.decidedAt || r.createdAt; }, true);
    return U.sortBy(list, function (r) { return (r.status === 'pending' ? '1' : '0') + r.createdAt; }, true);
  };

  /* --------------------------------------------------------------- impact */
  RequestsView.prototype.impact = function (r) {
    var st = S(), who = st.staff(r.staffId); if (!who) return null;
    var team = st.team(who.teamId), members = st.staffByTeam(who.teamId), pending = r.status === 'pending';
    if (r.type === 'leave' || r.type === 'remote') {
      var day = firstWorkday(r.from, r.to), away = r.type === 'leave' ? 'leave' : 'remote';
      var present = members.filter(function (m) { var t = st.shiftOf(m.id, day); if (t === 'leave' || t === 'off') return false; if (r.type === 'remote' && t === 'remote') return false; return !(pending && m.id === r.staffId); });
      var others = members.filter(function (m) { return m.id !== r.staffId && st.shiftOf(m.id, day) === away; });
      var hol = st.holidayName(day), weekend = U.isWeekend(day);
      var text = 'Team ' + team.name + ' còn ' + present.length + '/' + members.length + (r.type === 'leave' ? ' người có mặt' : ' người tại văn phòng') + ' ngày ' + dm(day);
      if (others.length) text += ' · ' + names(others) + ' cũng ' + (r.type === 'leave' ? 'nghỉ' : 'remote');
      if (hol) text = 'Ngày ' + dm(day) + ' là lễ ' + hol + (r.type === 'leave' ? ' — không trừ phép' : ' — cả team đã nghỉ'); else if (weekend) text = r.type === 'leave' ? 'Rơi vào cuối tuần — không trừ phép' : 'Rơi vào cuối tuần — ngày không xếp ca';
      var ratio = members.length ? present.length / members.length : 1;
      return { text: text, level: (!hol && !weekend && ratio < .5) ? 'warn' : 'info', icon: ratio < .5 ? 'alert-triangle' : 'users' };
    }
    if (r.type === 'ot') {
      var week = U.weekDays(U.fromISO(r.from)), n = 0;
      week.forEach(function (d) { var iso = U.toISO(d); if (st.shiftOf(r.staffId, iso) === 'ot' || (pending && iso >= r.from && iso <= r.to && isWorkday(iso))) n++; });
      var extra = n * OT_EXTRA_H, over = extra > OT_CAP_H;
      return { text: 'Tổng OT tuần: ' + n + ' ngày · +' + extra + 'g' + (over ? ' · vượt trần ' + OT_CAP_H + 'g/tuần' : ' · trần ' + OT_CAP_H + 'g/tuần'), level: over ? 'over' : 'info', icon: over ? 'alert-triangle' : 'hourglass' };
    }
    if (r.type === 'swap') {
      var other = r.swapWithId ? st.staff(r.swapWithId) : null;
      if (!other) return { text: 'Chưa chọn người đổi ca', level: 'warn', icon: 'alert-triangle' };
      var a = st.shiftOf(r.staffId, r.from), b = st.shiftOf(other.id, r.from);
      return { text: 'Đổi ca với ' + U.shortName(other.name) + ' · ' + dmw(r.from) + ': ', level: 'info', icon: 'repeat', swap: { a: a, b: b, who: U.firstName(who.name), other: U.firstName(other.name) }, same: a === b };
    }
    return null;
  };
  RequestsView.prototype.leaveBalance = function () {
    var st = S(), me = st.state.currentUserId, year = this.todayISO.slice(0, 4), used = LEAVE_USED_BASE, pending = 0;
    st.state.requests.forEach(function (r) {
      if (r.staffId !== me || r.type !== 'leave' || r.from.slice(0, 4) !== year) return;
      if (r.status === 'approved') used += workdays(r.from, r.to); else if (r.status === 'pending') pending += workdays(r.from, r.to);
    });
    return { total: LEAVE_TOTAL, used: used, pending: pending, remaining: Math.max(0, LEAVE_TOTAL - used) };
  };

  /* ------------------------------------------------------------------ shell */
  RequestsView.prototype.build = function () {
    U.render(this.container, h`
      <div class="rq">
        <div class="rq-main">
          <section class="card card--flush rq-head reveal" style="--i:0" aria-label="Bộ lọc yêu cầu">
            <div class="rq-tabs-wrap"><div class="tabs rq-tabs" role="tablist" aria-label="Nhóm yêu cầu"></div></div>
            <div class="rq-filters"></div>
          </section>
          <div class="rq-listbar reveal" style="--i:1" data-block="listbar"></div>
          <div class="rq-list" role="list" aria-live="polite" aria-busy="false" data-block="list"></div>
        </div>
        <aside class="rq-side" aria-label="Tổng quan phép & lịch nghỉ">
          <section class="card rq-balance reveal" style="--i:2" data-block="balance"></section>
          <section class="card rq-stats reveal" style="--i:3" data-block="stats"></section>
          <section class="card rq-cal reveal" style="--i:4" data-block="cal"></section>
          <section class="card rq-policy reveal" style="--i:5" data-block="policy"></section>
        </aside>
      </div>`);
    this.els = {
      root: this.container.querySelector('.rq'), tabs: this.container.querySelector('.rq-tabs'), filters: this.container.querySelector('.rq-filters'),
      listbar: this.container.querySelector('[data-block="listbar"]'), list: this.container.querySelector('[data-block="list"]'),
      balance: this.container.querySelector('[data-block="balance"]'), stats: this.container.querySelector('[data-block="stats"]'), cal: this.container.querySelector('[data-block="cal"]'), policy: this.container.querySelector('[data-block="policy"]')
    };
  };

  /* ------------------------------------------------------------------- tabs */
  RequestsView.prototype.renderTabs = function () {
    var self = this, c = this.counts();
    U.render(this.els.tabs, h`${TABS.map(function (t) {
      var on = t.id === self.F.tab, n = c[t.id];
      return h`<button type="button" class="tab${on ? ' is-active' : ''}" role="tab" data-tab="${t.id}" aria-selected="${on ? 'true' : 'false'}" aria-label="${t.label}, ${n} đơn">${icon(t.icon, 15)}<span>${t.label}</span><span class="badge rq-badge${t.id === 'pending' && n ? ' badge--red' : ''}" aria-hidden="true"><span class="rq-badge__n">${n}</span></span></button>`;
    })}<span class="rq-tabs__ind" aria-hidden="true"></span>`);
    this.moveTabInd();
  };
  RequestsView.prototype.syncTabs = function () {
    var self = this, c = this.counts();
    U.qsa('.tab', this.els.tabs).forEach(function (b) {
      var on = b.dataset.tab === self.F.tab, n = c[b.dataset.tab];
      b.classList.toggle('is-active', on); b.setAttribute('aria-selected', on ? 'true' : 'false');
      b.setAttribute('aria-label', TABS.filter(function (t) { return t.id === b.dataset.tab; })[0].label + ', ' + n + ' đơn');
      var badge = b.querySelector('.rq-badge'); flipBadge(badge, n);
      badge.classList.toggle('badge--red', b.dataset.tab === 'pending' && n > 0);
    });
    this.moveTabInd();
  };
  RequestsView.prototype.moveTabInd = function () {
    var ind = this.els.tabs.querySelector('.rq-tabs__ind'), a = this.els.tabs.querySelector('.tab.is-active');
    if (!ind || !a) return;
    var w = a.offsetWidth - 16, x = a.offsetLeft + 8;
    requestAnimationFrame(function () { ind.style.width = w + 'px'; ind.style.transform = 'translateX(' + x + 'px)'; ind.classList.add('is-on'); });
  };
  RequestsView.prototype.setTab = function (tab) {
    if (tab === this.F.tab || TAB_IDS.indexOf(tab) < 0) return;
    Z15.router.go('requests', Object.assign(this.query(), { tab: tab })); // hashchange → app gọi update(route)
  };

  /* ---------------------------------------------------------------- filters */
  RequestsView.prototype.renderFilters = function () {
    var st = S(), F = this.F;
    U.render(this.els.filters, h`
      <div class="rq-filters__types" role="group" aria-label="Loại yêu cầu">
        <button type="button" class="chip chip--btn rq-fchip" data-type="" aria-pressed="${!F.type}">Tất cả</button>
        ${E().REQUEST_TYPES.map(function (t) { return h`<button type="button" class="chip chip--btn rq-fchip" data-type="${t.id}" aria-pressed="${F.type === t.id}">${icon(t.icon, 13)}<span>${t.label}</span></button>`; })}
      </div>
      <label class="rq-filters__team"><span class="sr-only">Team</span><span class="select-wrap"><select class="input select rq-team" aria-label="Lọc theo team"><option value="">Mọi team</option>${st.state.teams.map(function (t) { return h`<option value="${t.id}"${t.id === F.team ? raw(' selected') : ''}>${t.name}</option>`; })}</select>${icon('chevron-down', 16)}</span></label>
      <div class="input-icon rq-filters__search">${icon('search', 16)}<input class="input rq-search" type="search" placeholder="Tìm tên, lý do… (không cần dấu)" value="${F.q}" aria-label="Tìm yêu cầu" autocomplete="off" spellcheck="false"></div>
      <button type="button" class="btn btn--secondary rq-new" data-act="new">${icon('send', 16)}<span>Gửi yêu cầu</span></button>`);
    this.els.search = this.els.filters.querySelector('.rq-search');
    this.els.team = this.els.filters.querySelector('.rq-team');
    this.syncFilters();
  };
  RequestsView.prototype.syncFilters = function () {
    var F = this.F;
    U.qsa('.rq-fchip', this.els.filters).forEach(function (b) { var on = b.dataset.type === F.type; b.classList.toggle('is-active', on); b.setAttribute('aria-pressed', on ? 'true' : 'false'); });
    if (this.els.team && this.els.team.value !== F.team) this.els.team.value = F.team;
    if (this.els.search && this.els.search.value !== F.q) this.els.search.value = F.q;
  };
  RequestsView.prototype.setFilter = function (patch) {
    var changed = false, F = this.F;
    Object.keys(patch).forEach(function (k) { if (F[k] !== patch[k]) { F[k] = patch[k]; changed = true; } });
    if (!changed) return;
    U.saveJSON(KEYS.filters, { type: F.type, team: F.team });
    this.syncURL(false); this.syncFilters(); this.renderList({ keepScroll: true });
  };

  /* ------------------------------------------------------------------ list */
  RequestsView.prototype.statusChip = function (r) {
    if (r.status === 'approved') return h`<span class="chip chip--ok rq-status">${icon('check', 12)}<span>Đã duyệt</span></span>`;
    if (r.status === 'rejected') return h`<span class="chip rq-status rq-status--rejected">${icon('x', 12)}<span>Từ chối</span></span>`;
    return h`<span class="chip chip--warn rq-status">${icon('clock', 12)}<span>Chờ duyệt</span></span>`;
  };
  RequestsView.prototype.cardHtml = function (r, i, first) {
    var st = S(), who = st.staff(r.staffId), team = st.team(who.teamId), t = typeOf(r.type), me = st.state.currentUserId;
    var mine = r.staffId === me, decide = this.canDecide(r), cancel = this.canCancel(r), im = this.impact(r);
    var approver = r.approverId ? st.staff(r.approverId) : null, other = r.swapWithId ? st.staff(r.swapWithId) : null;
    var diff = U.daysBetween(this.todayISO, r.from), urgent = r.status === 'pending' && diff <= 1 && diff >= -30;
    var soon = r.status === 'pending' && diff >= 0 && diff <= 6 ? U.fmtRelativeDay(r.from) : '';
    var cls = ['card', 'rq-item'];
    if (mine) cls.push('is-mine'); if (this.selected[r.id]) cls.push('is-selected'); if (first) cls.push('reveal'); if (this.justRestored[r.id]) cls.push('is-new');
    var label = t.label + ' của ' + who.name + ', ' + rangeText(r) + ', ' + STATUS_LABEL[r.status];
    return h`<article class="${cls.join(' ')}" role="listitem" tabindex="0" data-id="${r.id}" data-type="${r.type}" data-status="${r.status}" aria-label="${label}"${first ? raw(' style="--i:' + Math.min(i + 1, 8) + '"') : ''}>
      <span class="rq-item__check">${decide ? h`<input type="checkbox" class="rq-check" aria-label="Chọn đơn của ${U.shortName(who.name)}"${this.selected[r.id] ? raw(' checked') : ''}>` : ''}</span>
      <span class="rq-item__type" data-type="${r.type}" title="${t.label}">${icon(t.icon, 18)}</span>
      <div class="rq-item__body">
        <div class="rq-item__top">
          <div class="rq-item__who">${raw(UI.avatar(who, { size: 'sm', title: false }))}<span class="rq-item__id"><span class="rq-item__name">${who.name}${mine ? h` <span class="chip chip--muted chip--xs">Bạn</span>` : ''}</span><span class="rq-item__role">${who.role}</span></span>${raw(UI.teamChip(team, { cls: 'rq-item__team' }))}</div>
          <div class="rq-item__status">${urgent ? h`<span class="rq-item__urgent">${icon('clock', 12)}<span>${diff < 0 ? 'Đã qua ngày bắt đầu' : diff === 0 ? 'Bắt đầu hôm nay' : 'Cần duyệt hôm nay'}</span></span>` : ''}${this.statusChip(r)}</div>
        </div>
        <div class="rq-item__when mono tnum"><span class="rq-item__type-lbl">${t.label}</span><span class="rq-item__dates">${rangeText(r)}</span><span class="faint">· ${dayCount(r)}</span>${soon && !urgent ? h`<span class="faint">· ${soon}</span>` : ''}</div>
        <p class="rq-item__reason clamp-2">${r.reason}</p>
        ${im ? h`<div class="rq-item__impact is-${im.level}">${icon(im.icon, 13)}<span>${im.text}${im.swap ? h`<span class="rq-item__swap">${im.swap.who} ${raw(UI.shiftBadge(im.swap.a))}<i>↔</i>${im.swap.other} ${raw(UI.shiftBadge(im.swap.b))}</span>${im.same ? h` <span class="faint">· cùng loại ca</span>` : ''}` : ''}</span></div>` : ''}
        <div class="rq-item__meta">
          <span>${icon('send', 11)} Gửi ${U.timeAgo(r.createdAt)}</span>
          ${r.status !== 'pending' && approver ? h`<span>${icon(r.status === 'approved' ? 'check-circle' : 'x-circle', 11)} ${r.status === 'approved' ? 'Duyệt' : 'Từ chối'} bởi ${U.shortName(approver.name)} · ${U.timeAgo(r.decidedAt)}</span>` : ''}
          ${r.askedAt && r.status === 'pending' ? h`<span>${icon('message', 11)} Đã hỏi lại · ${U.timeAgo(r.askedAt)}</span>` : ''}
          ${r.type === 'swap' && other && r.status !== 'pending' ? h`<span>${icon('repeat', 11)} với ${U.shortName(other.name)}</span>` : ''}
        </div>
        ${r.note && r.status === 'rejected' ? h`<div class="rq-item__note"><span class="eyebrow">Lý do từ chối</span>${r.note}</div>` : ''}
        ${decide ? h`<div class="rq-item__foot">
          <button type="button" class="btn btn--ghost btn--sm" data-act="ask" aria-label="Hỏi lại ${U.shortName(who.name)}">${icon('message', 14)}<span>Hỏi lại</span></button>
          <span class="grow"></span>
          <button type="button" class="btn btn--ghost btn--sm" data-act="reject" aria-label="Từ chối yêu cầu của ${U.shortName(who.name)}" aria-haspopup="dialog">${icon('x', 14)}<span>Từ chối</span></button>
          <span class="rq-stamp"><button type="button" class="btn btn--ok btn--sm" data-act="approve" aria-label="Duyệt yêu cầu của ${U.shortName(who.name)}"><svg class="icon rq-tick" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M20 6 9 17l-5-5" pathLength="1"/></svg><span>Duyệt</span></button><span class="chip chip--ok rq-stamp__chip" aria-hidden="true">${icon('check', 12)}<span>Đã duyệt</span></span></span>
        </div>` : cancel ? h`<div class="rq-item__foot"><span class="rq-item__hint faint">${icon('info', 12)} Quản lý sẽ duyệt trong mục này</span><span class="grow"></span><button type="button" class="btn btn--ghost-danger btn--sm" data-act="cancel">${icon('trash', 14)}<span>Huỷ yêu cầu</span></button></div>` : ''}
      </div>
    </article>`;
  };
  RequestsView.prototype.emptyHtml = function () {
    var F = this.F;
    if (this.hasFilter()) return h`<div class="card rq-empty"><p class="rq-empty__title">Không có đơn nào khớp bộ lọc.</p><p class="rq-empty__body">Thử bỏ dấu, đổi team hoặc chọn loại khác.</p><button type="button" class="btn btn--soft btn--sm" data-act="clear">${icon('x', 14)}<span>Xoá bộ lọc</span></button></div>`;
    if (F.tab === 'pending') return h`<div class="card rq-empty rq-empty--calm"><span class="rq-empty__mark">${raw(UI.logoMark(64))}</span><p class="rq-empty__title">Không có đơn nào chờ. Đội đang ổn.</p><p class="rq-empty__body">Đơn mới sẽ xuất hiện ở đây kèm tác động tới team để bạn duyệt trong 5 giây.</p><button type="button" class="link-btn" data-tab="history">Xem lịch sử quyết định →</button></div>`;
    if (F.tab === 'mine') return h`<div class="card rq-empty"><p class="rq-empty__title">Bạn chưa gửi yêu cầu nào.</p><p class="rq-empty__body">Nghỉ phép, remote, tăng ca hay đổi ca — gửi trong 20 giây, quản lý duyệt trong 5 giây.</p><button type="button" class="btn btn--soft btn--sm" data-act="new">${icon('send', 14)}<span>Gửi yêu cầu</span></button></div>`;
    if (F.tab === 'history') return h`<div class="card rq-empty"><p class="rq-empty__title">Chưa có quyết định nào được ghi lại.</p><p class="rq-empty__body">Đơn đã duyệt hoặc từ chối sẽ nằm ở đây, mới nhất lên đầu.</p></div>`;
    return h`<div class="card rq-empty"><p class="rq-empty__title">Chưa có yêu cầu nào.</p><button type="button" class="btn btn--soft btn--sm" data-act="new">${icon('send', 14)}<span>Gửi yêu cầu</span></button></div>`;
  };
  /** Vẽ lại danh sách tại chỗ (giữ cuộn, giữ focus theo id). */
  RequestsView.prototype.renderList = function (opts) {
    opts = opts || {};
    var self = this, list = this.els.list, items = this.filtered(), first = !!opts.first;
    var focused = this.focusedCard(), focusId = opts.focusId || (focused ? focused.dataset.id : null);
    var visible = {}; items.forEach(function (r) { visible[r.id] = true; });
    Object.keys(this.selected).forEach(function (id) { var r = S().request(id); if (!r || !visible[id] || !self.canDecide(r)) delete self.selected[id]; });
    if (opts.swap && !reduceMotion()) list.classList.add('is-swap');
    list.classList.toggle('has-check', items.some(function (r) { return self.canDecide(r); }));
    U.render(list, items.length ? h`${items.map(function (r, i) { return self.cardHtml(r, i, first); })}` : this.emptyHtml());
    this.justRestored = {};
    this.renderListbar(items);
    if (focusId) { var c = list.querySelector('.rq-item[data-id="' + focusId + '"]'); if (c) c.focus({ preventScroll: true }); else if (focused) { var alt = list.querySelector('.rq-item'); if (alt) alt.focus({ preventScroll: true }); } }
    requestAnimationFrame(function () {
      U.qsa('.rq-item__reason', list).forEach(function (p) { if (p.scrollHeight > p.clientHeight + 1) { p.classList.add('is-clamped'); p.setAttribute('role', 'button'); p.setAttribute('tabindex', '0'); p.setAttribute('aria-expanded', 'false'); p.title = 'Xem đầy đủ lý do'; } });
      if (opts.swap) requestAnimationFrame(function () { list.classList.remove('is-swap'); });
    });
    this.firstPaint = false;
  };
  RequestsView.prototype.renderListbar = function (items) {
    var self = this, bar = this.els.listbar, F = this.F;
    var decidable = items.filter(function (r) { return self.canDecide(r); }), sel = Object.keys(this.selected).length;
    var sortLbl = F.tab === 'pending' ? 'theo ngày bắt đầu' : F.tab === 'history' ? 'theo ngày quyết định' : 'mới nhất trước';
    bar.classList.toggle('is-bulk', sel > 0);
    bar.hidden = !items.length;
    if (sel > 0) {
      U.render(bar, h`<label class="checkbox rq-listbar__all"><input type="checkbox" class="rq-check-all"${sel === decidable.length ? raw(' checked') : ''} aria-label="Chọn tất cả"><span><b class="tnum">${sel}</b> đã chọn</span></label><span class="grow"></span><button type="button" class="btn btn--ghost btn--sm" data-act="unselect">Bỏ chọn</button><span class="rq-stamp rq-stamp--bulk"><button type="button" class="btn btn--ok btn--sm" data-act="approve-selected">${icon('check', 14)}<span>Duyệt tất cả đã chọn (${sel})</span></button><span class="chip chip--ok rq-stamp__chip" aria-hidden="true">${icon('check', 12)}<span>Đã duyệt ${sel}</span></span></span>`);
      return;
    }
    U.render(bar, h`<span class="rq-listbar__count"><b class="tnum">${items.length}</b> đơn <span class="faint">· sắp xếp ${sortLbl}</span></span><span class="grow"></span>${decidable.length > 1 ? h`<label class="checkbox rq-listbar__all"><input type="checkbox" class="rq-check-all" aria-label="Chọn tất cả đơn chờ duyệt"><span>Chọn tất cả</span></label>` : ''}`);
  };
  RequestsView.prototype.focusedCard = function () { var a = document.activeElement; return a && this.els.list.contains(a) ? a.closest('.rq-item') : null; };

  /* ------------------------------------------------------------- decisions */
  RequestsView.prototype.snapshot = function (r) {
    var st = S(), out = { id: r.id, shifts: {} }, ids = [r.staffId]; if (r.type === 'swap' && r.swapWithId) ids.push(r.swapWithId);
    ids.forEach(function (sid) { var m = st.state.shifts[sid] || {}, o = out.shifts[sid] = {}; eachDay(r.from, r.to, function (iso) { o[iso] = m[iso]; }); });
    return out;
  };
  RequestsView.prototype.swapShifts = function (r) {
    var st = S(); if (!r.swapWithId) return;
    st.update(function (s) {
      var A = s.shifts[r.staffId] = s.shifts[r.staffId] || {}, B = s.shifts[r.swapWithId] = s.shifts[r.swapWithId] || {};
      eachDay(r.from, r.to, function (iso) { if (U.isWeekend(iso)) return; var a = st.shiftOf(r.staffId, iso), b = st.shiftOf(r.swapWithId, iso); A[iso] = b; B[iso] = a; });
    }, { type: 'shift:swap', id: r.id });
  };
  RequestsView.prototype.undo = function (snaps) {
    var ids = snaps.map(function (x) { return x.id; });
    ids.forEach(function (id) { this.justRestored[id] = true; }, this);
    S().update(function (s) {
      snaps.forEach(function (snap) {
        var r = s.requests.find(function (x) { return x.id === snap.id; }); if (!r) return;
        r.status = 'pending'; delete r.approverId; delete r.decidedAt; delete r.note;
        Object.keys(snap.shifts).forEach(function (sid) { var m = s.shifts[sid] = s.shifts[sid] || {}, o = snap.shifts[sid]; Object.keys(o).forEach(function (iso) { if (o[iso] == null) delete m[iso]; else m[iso] = o[iso]; }); });
      });
    }, { type: 'request:status', id: ids[0], status: 'pending', ids: ids });
    UI.toast(ids.length > 1 ? 'Đã hoàn tác ' + ids.length + ' quyết định' : 'Đã hoàn tác — đơn quay về trạng thái chờ', { kind: 'info' });
  };
  /** Duyệt / từ chối một hoặc nhiều đơn: ghi store lạc quan, toast có Hoàn tác, rồi chạy choreography. */
  RequestsView.prototype.decide = function (ids, status, note) {
    var st = S(), self = this;
    var items = ids.map(function (id) { return st.request(id); }).filter(function (r) { return r && r.status === 'pending'; });
    if (!items.length) return;
    var snaps = items.map(function (r) { return self.snapshot(r); });
    this.suppress = true;
    try { items.forEach(function (r) { st.setRequestStatus(r.id, status, note); if (status === 'approved' && r.type === 'swap') self.swapShifts(r); }); }
    finally { this.suppress = false; }
    ids.forEach(function (id) { delete self.selected[id]; });
    this.refreshChrome();
    var who = st.staff(items[0].staffId), what = typeOf(items[0].type).label.toLowerCase();
    var msg = items.length > 1 ? (status === 'approved' ? 'Đã duyệt ' + items.length + ' đơn' : 'Đã từ chối ' + items.length + ' đơn') : (status === 'approved' ? 'Đã duyệt ' + what + ' của ' + U.shortName(who.name) : 'Đã từ chối ' + what + ' của ' + U.shortName(who.name));
    UI.toast(msg, { kind: status === 'approved' ? 'success' : 'info', duration: 6000, action: { label: 'Hoàn tác', onClick: function () { self.undo(snaps); } } });
    if (status === 'approved') items.forEach(function (r) { if (r.type === 'leave') self.pulseCal(r.from, r.to); });
    this.animateDecision(items, status);
  };
  RequestsView.prototype.animateDecision = function (items, status) {
    var self = this, list = this.els.list;
    var cards = items.map(function (r) { return list.querySelector('.rq-item[data-id="' + r.id + '"]'); }).filter(Boolean);
    var stays = this.F.tab === 'all' || this.F.tab === 'mine';
    var focused = this.focusedCard(), nextId = null;
    if (focused && cards.indexOf(focused) >= 0 && !stays) { var all = U.qsa('.rq-item', list), rest = all.filter(function (c) { return cards.indexOf(c) < 0; }), i = all.indexOf(focused); var nxt = rest.filter(function (c) { return all.indexOf(c) > i; })[0] || rest[rest.length - 1]; nextId = nxt ? nxt.dataset.id : null; }
    if (!cards.length) { this.renderList({ keepScroll: true }); return; }
    if (reduceMotion()) { cards.forEach(function (c) { c.classList.add('is-deciding'); if (!stays) c.classList.add('is-fading'); }); setTimeout(function () { self.renderList({ keepScroll: true, focusId: nextId }); }, 130); return; }
    this.busy++; list.setAttribute('aria-busy', 'true');
    var bulk = this.els.listbar.querySelector('.rq-stamp--bulk'); if (bulk && cards.length > 1) { bulk.classList.add('is-done'); }
    cards.forEach(function (c, i) {
      c.classList.add('is-deciding');
      if (status === 'approved') { var stamp = c.querySelector('.rq-stamp'); if (stamp) setTimeout(function () { stamp.classList.add('is-stamping'); setTimeout(function () { stamp.classList.add('is-done'); }, 320); }, i * 60); }
    });
    var stampMs = status === 'approved' ? 320 + 400 + (cards.length - 1) * 60 : 80;
    var finish = function () { self.busy--; list.setAttribute('aria-busy', 'false'); self.dirty = false; self.renderList({ keepScroll: true, focusId: nextId }); };
    if (stays) { setTimeout(finish, stampMs + 120); return; }
    setTimeout(function () {
      cards.forEach(function (c, i) { setTimeout(function () { c.classList.add(status === 'approved' ? 'is-leaving' : 'is-fading'); }, i * 50); });
      setTimeout(function () {
        var remaining = U.qsa('.rq-item', list).filter(function (c) { return cards.indexOf(c) < 0; });
        var followers = []; var sib = self.els.root.nextElementSibling; while (sib) { followers.push(sib); sib = sib.nextElementSibling; }
        flipY(remaining.concat(followers), function () { cards.forEach(function (c) { c.remove(); }); }, 240);
        if (!remaining.length) { finish(); return; }
        setTimeout(finish, 270);
      }, 220 + (cards.length - 1) * 50);
    }, stampMs);
  };
  RequestsView.prototype.approveFromCard = function (card) { if (!card || card.classList.contains('is-deciding')) return; var r = S().request(card.dataset.id); if (r && this.canDecide(r)) this.decide([r.id], 'approved'); };
  RequestsView.prototype.rejectFromCard = function (card) { if (!card || card.classList.contains('is-deciding')) return; var btn = card.querySelector('[data-act="reject"]'); if (btn) this.openReject(btn, card.dataset.id); };
  RequestsView.prototype.openReject = function (anchor, id) {
    var st = S(), r = st.request(id), self = this; if (!r || !this.canDecide(r)) return;
    var who = st.staff(r.staffId);
    var pop = UI.popover(anchor, h`
      <div class="rq-pop" role="group" aria-label="Từ chối yêu cầu">
        <div class="rq-pop__title">Từ chối ${typeOf(r.type).label.toLowerCase()} của ${U.shortName(who.name)}?</div>
        <p class="rq-pop__sub">${U.firstName(who.name)} sẽ thấy lý do này trong đơn. Viết ngắn và rõ để bạn ấy điều chỉnh.</p>
        <textarea class="input textarea rq-pop__reason" rows="3" placeholder="VD: Hôm đó team thiếu người vì có buổi quay…" aria-label="Lý do từ chối" required></textarea>
        <div class="rq-pop__err" hidden>Vui lòng nhập lý do trước khi từ chối.</div>
        <div class="rq-pop__foot"><span class="faint rq-pop__kbd">${raw(UI.kbd('Ctrl'))}<span class="kbd-sep">+</span>${raw(UI.kbd('↵'))} để gửi</span><span class="grow"></span><button type="button" class="btn btn--ghost btn--sm" data-cancel>Huỷ</button><button type="button" class="btn btn--danger btn--sm" data-confirm>${icon('x', 14)}<span>Xác nhận từ chối</span></button></div>
      </div>`.s, { placement: 'bottom-end', width: 340, cls: 'popover--rq' });
    var ta = pop.el.querySelector('.rq-pop__reason'), err = pop.el.querySelector('.rq-pop__err');
    function confirm() {
      var note = ta.value.trim();
      if (!note) { ta.classList.add('is-invalid'); err.hidden = false; ta.focus(); pop.el.classList.remove('shake'); void pop.el.offsetWidth; pop.el.classList.add('shake'); return; }
      pop.close(); self.decide([id], 'rejected', note);
    }
    pop.el.addEventListener('click', function (e) { if (e.target.closest('[data-cancel]')) pop.close(); else if (e.target.closest('[data-confirm]')) confirm(); });
    pop.el.addEventListener('keydown', function (e) { if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') { e.preventDefault(); confirm(); } });
    ta.addEventListener('input', function () { if (ta.value.trim()) { ta.classList.remove('is-invalid'); err.hidden = true; } });
    setTimeout(function () { ta.focus(); }, 30);
  };
  RequestsView.prototype.openAsk = function (anchor, id) {
    var st = S(), r = st.request(id); if (!r) return;
    var who = st.staff(r.staffId);
    var pop = UI.popover(anchor, h`
      <div class="rq-pop" role="group" aria-label="Hỏi lại">
        <div class="rq-pop__title">Hỏi lại ${U.shortName(who.name)}</div>
        <textarea class="input textarea rq-pop__reason" rows="3" placeholder="VD: Bạn có thể bàn giao cho ai trong lúc nghỉ?" aria-label="Câu hỏi"></textarea>
        <div class="rq-pop__foot"><span class="grow"></span><button type="button" class="btn btn--ghost btn--sm" data-cancel>Huỷ</button><button type="button" class="btn btn--soft btn--sm" data-confirm>${icon('send', 14)}<span>Gửi câu hỏi</span></button></div>
      </div>`.s, { placement: 'bottom-start', width: 320, cls: 'popover--rq' });
    function send() {
      pop.close();
      st.update(function (s) { var x = s.requests.find(function (q) { return q.id === id; }); if (x) x.askedAt = new Date().toISOString(); }, { type: 'request:ask', id: id });
      UI.toast('Đã gửi câu hỏi tới ' + U.shortName(who.name), { kind: 'info' });
    }
    pop.el.addEventListener('click', function (e) { if (e.target.closest('[data-cancel]')) pop.close(); else if (e.target.closest('[data-confirm]')) send(); });
    pop.el.addEventListener('keydown', function (e) { if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') { e.preventDefault(); send(); } });
  };
  RequestsView.prototype.cancelRequest = function (id) {
    var st = S(), r = st.request(id), self = this; if (!r || !this.canCancel(r)) return;
    UI.confirm({ title: 'Huỷ yêu cầu?', message: typeOf(r.type).label + ' ' + rangeText(r) + ' sẽ bị gỡ khỏi hàng chờ duyệt.', confirmLabel: 'Huỷ yêu cầu', cancelLabel: 'Giữ lại', danger: true, icon: 'trash' }).then(function (ok) {
      if (!ok) return;
      var idx = st.state.requests.indexOf(r);
      st.update(function (s) { s.requests = s.requests.filter(function (x) { return x.id !== id; }); }, { type: 'request:delete', id: id });
      UI.toast('Đã huỷ yêu cầu ' + typeOf(r.type).label.toLowerCase(), { kind: 'info', duration: 6000, action: { label: 'Hoàn tác', onClick: function () { self.justRestored[id] = true; st.update(function (s) { s.requests.splice(Math.min(idx, s.requests.length), 0, r); }, { type: 'request:add', id: id }); } } });
    });
  };

  /* -------------------------------------------------------------- side */
  RequestsView.prototype.renderSide = function (first) { this.renderBalance(first); this.renderStats(first); this.renderCal(); if (first) this.renderPolicy(); };
  RequestsView.prototype.renderBalance = function (first) {
    var b = this.leaveBalance(), R = 34, C = 2 * Math.PI * R;
    var segUsed = C * (b.used / b.total), segPend = C * (Math.min(b.pending, b.remaining) / b.total), segRem = C * (b.remaining / b.total);
    var el = this.els.balance;
    U.render(el, h`
      <div class="card__eyebrow">Phép năm của bạn · ${this.todayISO.slice(0, 4)}</div>
      <div class="rq-balance__row">
        <div class="rq-ring" role="img" aria-label="Còn ${fmtNum(b.remaining)} trên ${b.total} ngày phép">
          <svg viewBox="0 0 80 80" width="88" height="88" aria-hidden="true">
            <circle class="rq-ring__track" cx="40" cy="40" r="${R}"/>
            <circle class="rq-ring__seg rq-ring__seg--used" cx="40" cy="40" r="${R}" stroke-dasharray="${segUsed} ${C}" style="stroke-dashoffset:${first ? segUsed : 0}"/>
            <circle class="rq-ring__seg rq-ring__seg--pending" cx="40" cy="40" r="${R}" stroke-dasharray="${segPend} ${C}" style="transform:rotate(${(b.used / b.total) * 360}deg);stroke-dashoffset:${first ? segPend : 0}"/>
            <circle class="rq-ring__seg rq-ring__seg--left" cx="40" cy="40" r="${R}" stroke-dasharray="${segRem} ${C}" style="transform:rotate(${((b.total - b.remaining) / b.total) * 360}deg);stroke-dashoffset:${first ? segRem : 0}"/>
          </svg>
          <span class="rq-ring__val mono tnum"><b>${fmtNum(b.remaining)}</b><small>/ ${b.total}</small></span>
        </div>
        <div class="rq-balance__txt">
          <div class="rq-balance__big">còn <b class="tnum">${fmtNum(b.remaining)}</b> / ${b.total} ngày</div>
          <ul class="rq-legend">
            <li><i class="rq-legend__dot rq-legend__dot--used"></i><span>Đã dùng</span><b class="mono tnum">${fmtNum(b.used)}</b></li>
            <li><i class="rq-legend__dot rq-legend__dot--pending"></i><span>Đang chờ</span><b class="mono tnum">${fmtNum(b.pending)}</b></li>
            <li><i class="rq-legend__dot rq-legend__dot--left"></i><span>Còn lại</span><b class="mono tnum">${fmtNum(b.remaining)}</b></li>
          </ul>
        </div>
      </div>
      <button type="button" class="btn btn--soft btn--sm btn--block rq-balance__cta" data-act="new-leave">${icon('umbrella', 14)}<span>Xin nghỉ phép</span></button>`);
    if (first && !reduceMotion()) requestAnimationFrame(function () { requestAnimationFrame(function () { U.qsa('.rq-ring__seg', el).forEach(function (c) { c.style.strokeDashoffset = '0'; }); }); });
    else U.qsa('.rq-ring__seg', el).forEach(function (c) { c.style.strokeDashoffset = '0'; });
  };
  RequestsView.prototype.stats = function () {
    var st = S(), m = monthOf(this.todayISO), out = { pending: 0, approvedMonth: 0, rejected: 0 };
    st.state.requests.forEach(function (r) { if (r.status === 'pending') out.pending++; else if (r.status === 'approved' && monthOf(r.decidedAt) === m) out.approvedMonth++; else if (r.status === 'rejected') out.rejected++; });
    return out;
  };
  RequestsView.prototype.renderStats = function (first) {
    var s = this.stats(), el = this.els.stats;
    var mon = 'Th' + (+this.todayISO.slice(5, 7));
    var items = [{ k: 'pending', label: 'Chờ duyệt', v: s.pending, tip: 'Đơn đang chờ quyết định' }, { k: 'approvedMonth', label: 'Duyệt ' + mon, v: s.approvedMonth, tip: 'Đã duyệt trong tháng này' }, { k: 'rejected', label: 'Từ chối', v: s.rejected, tip: 'Tổng đơn bị từ chối' }];
    U.render(el, h`<div class="card__eyebrow">Tổng quan</div><div class="rq-stats__grid">${items.map(function (it) { return h`<div class="kpi rq-kpi" data-k="${it.k}" data-tip="${it.tip}"><span class="kpi__label">${it.label}</span><span class="kpi__value rq-kpi__v tnum" data-v="${it.v}">${first ? 0 : it.v}</span></div>`; })}</div>`);
    if (first) { var reduce = reduceMotion(); U.qsa('.rq-kpi__v', el).forEach(function (n, i) { var to = +n.dataset.v; if (reduce) n.textContent = to; else setTimeout(function () { U.countUp(n, to, { duration: 700 }); }, 200 + i * 60); }); }
  };
  RequestsView.prototype.renderCal = function () {
    var st = S(), self = this, start = U.fromISO(this.todayISO), teams = U.by(st.state.teams);
    var days = U.range(14).map(function (i) { return U.addDays(start, i); });
    var total = 0;
    var cells = days.map(function (d) {
      var iso = U.toISO(d), hol = st.holidayName(iso), wk = U.isWeekend(iso);
      var off = st.state.staff.filter(function (s) { return st.shiftOf(s.id, iso) === 'leave'; });
      total += off.length;
      var tip = hol ? 'Nghỉ lễ ' + hol : off.length ? off.map(function (s) { return U.shortName(s.name); }).join(', ') + ' nghỉ phép' : wk ? 'Cuối tuần' : 'Đủ quân số';
      return h`<button type="button" class="rq-cal__d${iso === self.todayISO ? ' is-today' : ''}${wk ? ' is-weekend' : ''}${hol ? ' is-holiday' : ''}${off.length ? ' has-off' : ''}" data-iso="${iso}" data-tip="${dmw(iso) + ' · ' + tip}" aria-label="${dmw(iso) + ': ' + tip}">
        <small>${U.weekdayShort(d)}</small><b class="tnum">${d.getDate()}</b>
        <span class="rq-cal__dots">${off.slice(0, 4).map(function (s) { var t = teams[s.teamId]; return h`<i style="--team:${t ? t.color : 'currentColor'}" title="${U.shortName(s.name)}"></i>`; })}${off.length > 4 ? h`<em>+${off.length - 4}</em>` : ''}</span>
      </button>`;
    });
    U.render(this.els.cal, h`<div class="card__head rq-cal__head"><div><div class="card__eyebrow">Ai nghỉ 14 ngày tới</div><div class="rq-cal__sum">${total ? h`<b class="tnum">${total}</b> lượt nghỉ phép · từ ${dmw(this.todayISO)}` : 'Không ai nghỉ phép — đội đủ quân số'}</div></div><a class="link-btn" href="#/roster/${this.todayISO}">Bảng ca →</a></div><div class="rq-cal__grid" role="group" aria-label="14 ngày tới">${cells}</div>`);
  };
  RequestsView.prototype.pulseCal = function (from, to) {
    var el = this.els.cal; if (reduceMotion()) return;
    eachDay(from, to, function (iso) { var c = el.querySelector('.rq-cal__d[data-iso="' + iso + '"]'); if (!c) return; c.classList.remove('is-pulse'); void c.offsetWidth; c.classList.add('is-pulse'); setTimeout(function () { c.classList.remove('is-pulse'); }, 400); });
  };
  RequestsView.prototype.renderPolicy = function () {
    U.render(this.els.policy, h`<div class="card__eyebrow">Chính sách</div><ul class="rq-policy__list">
      <li>${icon('umbrella', 14)}<span>Nghỉ phép báo trước <b>3 ngày</b>; lễ & cuối tuần không trừ phép.</span></li>
      <li>${icon('hourglass', 14)}<span>Tăng ca tối đa <b>${OT_CAP_H}g / tuần</b>; quá trần cần Head duyệt.</span></li>
      <li>${icon('repeat', 14)}<span>Đổi ca cần <b>quản lý xác nhận</b> sau khi đồng nghiệp đồng ý.</span></li>
      <li>${icon('laptop', 14)}<span>Remote không quá <b>2 ngày / tuần</b>, trừ ngày quay.</span></li>
    </ul><p class="rq-policy__foot faint">Phím tắt: <kbd class="kbd">↑</kbd><kbd class="kbd">↓</kbd> chọn đơn · <kbd class="kbd">E</kbd> duyệt · <kbd class="kbd">X</kbd> từ chối · <kbd class="kbd">↵</kbd> hồ sơ</p>`);
  };

  /* ---------------------------------------------------------------- title */
  RequestsView.prototype.setTitle = function () {
    var st = S(), self = this, hol = st.holidayName(this.todayISO), b = this.leaveBalance();
    var pend = st.state.requests.filter(function (r) { return self.canDecide(r); });
    var soonest = U.sortBy(pend, 'from')[0];
    var sub = (hol ? 'Nghỉ lễ ' + hol + ' · ' : '') + (pend.length ? pend.length + ' đơn chờ bạn duyệt' + (soonest ? ' · sớm nhất ' + dmw(soonest.from) : '') : 'Không có đơn chờ duyệt · phép năm còn ' + fmtNum(b.remaining) + ' ngày');
    Z15.app.setTitle('Đơn & Yêu cầu', sub);
  };

  /* ------------------------------------------------------------------ bind */
  RequestsView.prototype.bind = function () {
    var self = this, root = this.container;
    this.unbinders.push(U.delegate(root, 'click', '.rq-tabs .tab', function (e, el) { self.setTab(el.dataset.tab); }));
    this.unbinders.push(U.delegate(root, 'click', '.rq-fchip', function (e, el) { self.setFilter({ type: el.dataset.type }); }));
    this.unbinders.push(U.delegate(root, 'change', '.rq-team', function (e, el) { self.setFilter({ team: el.value }); }));
    this.unbinders.push(U.delegate(root, 'input', '.rq-search', U.debounce(function (e, el) { self.setFilter({ q: normalizeQ(el.value) }); }, 120)));
    this.unbinders.push(U.delegate(root, 'keydown', '.rq-search', function (e, el) { if (e.key === 'Escape' && el.value) { el.value = ''; self.setFilter({ q: '' }); e.stopPropagation(); } if (e.key === 'ArrowDown') { var c = self.els.list.querySelector('.rq-item'); if (c) { e.preventDefault(); c.focus(); } } }));
    this.unbinders.push(U.delegate(root, 'click', '[data-tab]:not(.tab)', function (e, el) { self.setTab(el.dataset.tab); }));
    this.unbinders.push(U.delegate(root, 'click', '[data-act]', function (e, el) {
      var act = el.dataset.act, card = el.closest('.rq-item'), id = card ? card.dataset.id : null;
      if (act === 'new') { E().request(); return; }
      if (act === 'new-leave') { E().request({ type: 'leave' }); return; }
      if (act === 'clear') { self.setFilter({ type: '', team: '', q: '' }); return; }
      if (act === 'unselect') { self.selected = {}; self.renderList({ keepScroll: true }); return; }
      if (act === 'approve-selected') { var ids = Object.keys(self.selected); if (ids.length) self.decide(ids, 'approved'); return; }
      if (!id) return;
      if (act === 'approve') { self.approveFromCard(card); }
      else if (act === 'reject') { self.openReject(el, id); }
      else if (act === 'ask') { self.openAsk(el, id); }
      else if (act === 'cancel') { self.cancelRequest(id); }
    }));
    this.unbinders.push(U.delegate(root, 'change', '.rq-check', function (e, el) {
      var card = el.closest('.rq-item'), id = card.dataset.id;
      if (el.checked) self.selected[id] = true; else delete self.selected[id];
      card.classList.toggle('is-selected', el.checked);
      self.renderListbar(self.filtered());
    }));
    this.unbinders.push(U.delegate(root, 'change', '.rq-check-all', function (e, el) {
      self.selected = {};
      if (el.checked) self.filtered().forEach(function (r) { if (self.canDecide(r)) self.selected[r.id] = true; });
      self.renderList({ keepScroll: true });
    }));
    this.unbinders.push(U.delegate(root, 'click', '.rq-item__reason.is-clamped', function (e, el) { var open = el.classList.toggle('is-open'); el.classList.toggle('clamp-2', !open); el.setAttribute('aria-expanded', open ? 'true' : 'false'); }));
    this.unbinders.push(U.delegate(root, 'keydown', '.rq-item__reason.is-clamped', function (e, el) { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); e.stopPropagation(); el.click(); } }));
    this.unbinders.push(U.delegate(root, 'click', '.rq-item__name', function (e, el) { var card = el.closest('.rq-item'), r = S().request(card.dataset.id); if (r) E().staffProfile(r.staffId); }));
    this.unbinders.push(U.delegate(root, 'click', '.rq-cal__d', function (e, el) { Z15.router.go('roster/' + el.dataset.iso); }));
    // Bàn phím trên thẻ: ↑/↓ di chuyển, Enter mở hồ sơ, Space chọn (E/X đăng ký qua UI.shortcuts)
    this.unbinders.push(U.delegate(root, 'keydown', '.rq-item', function (e, card) {
      var t = e.target; if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.tagName === 'SELECT')) return;
      if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
        e.preventDefault();
        var cards = U.qsa('.rq-item', self.els.list), i = cards.indexOf(card), n = cards[i + (e.key === 'ArrowDown' ? 1 : -1)];
        if (n) { n.focus(); n.scrollIntoView({ block: 'nearest' }); } else if (e.key === 'ArrowUp' && self.els.search) self.els.search.focus();
        return;
      }
      if (t !== card) return;
      if (e.key === 'Enter') { e.preventDefault(); var r = S().request(card.dataset.id); if (r) E().staffProfile(r.staffId); }
      if (e.key === ' ') { var cb = card.querySelector('.rq-check'); if (cb) { e.preventDefault(); cb.checked = !cb.checked; cb.dispatchEvent(new Event('change', { bubbles: true })); } }
    }));
    this.onResize = U.debounce(function () { self.moveTabInd(); }, 120);
    window.addEventListener('resize', this.onResize);
  };

  /* ----------------------------------------------------------- store / tick */
  RequestsView.prototype.refreshChrome = function () { this.syncTabs(); this.renderBalance(false); this.renderStats(false); this.renderCal(); this.setTitle(); };
  RequestsView.prototype.onStore = function (meta) {
    var t = (meta && meta.type) || '';
    if (!/^(request|reset|shift|staff)/.test(t)) return;
    if (this.suppress) return;
    if (t === 'reset') { this.selected = {}; if (!this.dateOverride) this.todayISO = U.todayISO(); }
    this.refreshChrome();
    if (this.busy) { this.dirty = true; return; }
    this.renderList({ keepScroll: true });
  };
  RequestsView.prototype.tick = function () {
    if (this.dateOverride) return;
    var real = U.todayISO();
    if (real !== this.todayISO) { this.todayISO = real; this.refreshChrome(); this.renderList({ keepScroll: true }); return; }
    // cập nhật nhãn "x phút trước"
    U.qsa('.rq-item__meta', this.els.list).length && this.renderList({ keepScroll: true });
  };

  /* ------------------------------------------------------------- lifecycle */
  RequestsView.prototype.update = function (route) {
    var prevKey = this.key(), prevTab = this.F.tab;
    this.readRoute(route);
    if (this.key() === prevKey) { this.setTitle(); return; }
    if (prevTab !== this.F.tab) { this.selected = {}; this.syncTabs(); }
    this.syncFilters();
    this.renderList({ keepScroll: true, swap: prevTab !== this.F.tab });
    if (prevKey.split('|')[1] !== this.todayISO) this.renderSide(false);
    this.setTitle();
  };
  RequestsView.prototype.destroy = function () {
    if (this.unsub) this.unsub();
    (this.unregisterKeys || []).forEach(function (f) { f && f(); });
    this.unbinders.forEach(function (f) { f && f(); });
    this.timers.forEach(function (t) { clearInterval(t); clearTimeout(t); });
    if (this.onResize) window.removeEventListener('resize', this.onResize);
    UI.palette.unregister('requests:pending');
  };

  Z15.views.requests = {
    title: 'Đơn & Yêu cầu',
    render: function (container, route) { return new RequestsView(container, route); }
  };
})(window);
