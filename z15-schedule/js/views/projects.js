/* =====================================================================
   Z15 Miracle · Lịch làm việc — views/projects.js
   "Dự án & Chiến dịch": danh sách thẻ/bảng có bộ lọc + trang chi tiết
   (Tổng quan · Mốc & Lịch · Phân bổ · Ghi chú).
   Routes: #/projects?status=&q=&mine=1&client=&sort=   |   #/projects/:id?tab=
   ===================================================================== */
(function (global) {
  'use strict';
  var Z15 = global.Z15; Z15.views = Z15.views || {};
  var U = Z15.utils, UI = Z15.ui, D = Z15.data, h = U.html, raw = U.raw;
  var S = function () { return Z15.store; };
  var E = function () { return Z15.editors; };

  var PREF_KEY = 'z15.ui.projects.prefs';
  var DEFAULT_PREFS = { status: '', mine: false, client: '', sort: 'deadline', mode: 'cards' };
  var TABS = [
    { id: 'overview', label: 'Tổng quan', icon: 'layout' },
    { id: 'timeline', label: 'Mốc & Lịch', icon: 'calendar' },
    { id: 'allocation', label: 'Phân bổ', icon: 'grid' },
    { id: 'notes', label: 'Ghi chú', icon: 'edit' }
  ];
  var SORTS = [{ id: 'deadline', label: 'Deadline gần nhất' }, { id: 'risk', label: 'Rủi ro' }, { id: 'progress', label: 'Tiến độ' }, { id: 'name', label: 'Tên' }];
  var PHASES = [{ label: 'Brief', range: '0–15%' }, { label: 'Ý tưởng', range: '15–40%' }, { label: 'Sản xuất', range: '40–70%' }, { label: 'Media', range: '70–90%' }, { label: 'Báo cáo', range: '90–100%' }];
  var PHASE_CUTS = [15, 40, 70, 90];
  var STATUS_TONE = { planning: '', active: 'type', review: 'warn', done: 'ok' };
  var HEALTH_ICON = { ok: 'check-circle', watch: 'alert-circle', risk: 'alert-triangle', planning: 'clock', done: 'check-circle' };
  var BANNER_TONE = { ok: 'ok', watch: 'warn', risk: 'danger', planning: '', done: 'ok' };
  var LEVEL_ORDER = { risk: 0, watch: 1, ok: 2, planning: 3, done: 4 };
  var HEAT_LABELS = ['0g', '≤ 2g', '≤ 5g', '≤ 8g', '≤ 10g', '> 10g'];
  var LANE_OFF = [0, 9, -9];
  var LABEL_W = 148, WEEK_W = 120, MAX_ALLOC_WEEKS = 10;

  /* ------------------------------------------------------------ helpers */
  function reduceMotion() { return U.prefersReducedMotion() || document.body.classList.contains('reduce-motion'); }
  function icon(name, size) { return raw(UI.icon(name, size)); }
  function fmtH(x) { return Number(x || 0).toLocaleString('vi-VN', { maximumFractionDigits: 1 }); }
  function dmw(iso) { return U.fmtDate(iso, 'shortWeekday'); }
  function statusLabel(id) { return E().projectStatus(id).label; }
  function monogram(client) {
    var s = String(client || '').replace(/['’.]/g, '');
    var words = s.split(/[^\p{L}\p{N}]+/u).filter(Boolean);
    if (!words.length) return '?';
    if (words.length >= 2) return (words[0][0] + words[1][0]).toUpperCase();
    var caps = words[0].match(/\p{Lu}/gu) || [];
    if (caps.length >= 2) return caps[0] + caps[1];
    return words[0].slice(0, 2).toUpperCase();
  }
  function phaseIndex(p) { if (p.status === 'done') return PHASES.length; var pr = +p.progress || 0; for (var i = 0; i < PHASE_CUTS.length; i++) if (pr < PHASE_CUTS[i]) return i; return PHASES.length - 1; }
  function evHours(e) { return e.allDay ? 8 : Math.max(0, (U.timeToMin(e.end) - U.timeToMin(e.start)) / 60); }
  function heatLevel(hrs) { if (hrs <= 0) return 0; if (hrs <= 2) return 1; if (hrs <= 5) return 2; if (hrs <= 8) return 3; if (hrs <= 10) return 4; return 5; }
  function weeksOf(startISO, endISO) {
    var s = U.startOfWeek(U.fromISO(startISO)), e = U.fromISO(endISO), out = [];
    for (var d = s, i = 0; d <= e && i < 60; d = U.addDays(d, 7), i++) out.push({ start: d, iso: U.toISO(d), endISO: U.toISO(U.addDays(d, 6)), num: U.isoWeek(d) });
    if (!out.length) out.push({ start: s, iso: U.toISO(s), endISO: U.toISO(U.addDays(s, 6)), num: U.isoWeek(s) });
    return out;
  }
  function dLabel(n) { return n > 0 ? 'D-' + n : n === 0 ? 'D-0' : 'D+' + (-n); }
  function isPastEvent(e, todayISO) { if (e.date < todayISO) return true; if (e.date > todayISO) return false; return !e.allDay && U.timeToMin(e.end) < U.nowMinutes(); }
  function upcoming(pid, todayISO) { return S().eventsForProject(pid).filter(function (e) { return !isPastEvent(e, todayISO); }); }
  function isMine(p) { var me = S().state.currentUserId; return p.leadId === me || (p.memberIds || []).indexOf(me) >= 0; }
  function members(p) { var st = S(); return U.uniq([p.leadId].concat(p.memberIds || [])).map(st.staff).filter(Boolean); }
  function healthSentence(p, hl, todayISO) {
    var gap = p.progress - hl.expected;
    if (hl.level === 'done') return 'Đã hoàn thành · kết thúc ' + dmw(p.end) + ' — cảm ơn cả đội.';
    if (hl.level === 'planning') { var n = U.daysBetween(todayISO, p.start); return n > 0 ? 'Đang lên kế hoạch — khởi động ' + dmw(p.start) + ' (còn ' + n + ' ngày).' : 'Đang lên kế hoạch — tiến độ ' + p.progress + '%, kỳ vọng ' + hl.expected + '%.'; }
    if (hl.level === 'ok') return 'Tiến độ ' + p.progress + '% so với kỳ vọng ' + hl.expected + '% — ' + (gap >= 5 ? 'vượt ' + gap + ' điểm, đang dẫn trước.' : 'đúng nhịp.');
    if (hl.level === 'watch') return 'Tiến độ ' + p.progress + '% so với kỳ vọng ' + hl.expected + '% — chậm ' + (-gap) + ' điểm, cần theo dõi.';
    return 'Chậm ' + (-gap) + ' điểm so với kỳ vọng ' + hl.expected + '% — cần hành động ngay.';
  }
  function progDelta(p, hl) {
    if (hl.level === 'done') return 'Đã hoàn thành 100%';
    var gap = p.progress - hl.expected;
    return 'Kỳ vọng ' + hl.expected + '% · ' + (gap >= -5 ? (gap >= 5 ? 'vượt ' + gap + ' điểm' : 'đúng nhịp') : 'chậm ' + (-gap) + ' điểm');
  }

  /* ---------------------------------------------------------- fragments */
  function statusChip(p, xs) { return raw(UI.chip(statusLabel(p.status), { tone: STATUS_TONE[p.status] || undefined, cls: xs ? 'chip--xs' : undefined })); }
  function healthTag(hl) { return h`<span class="pj-health" data-level="${hl.level}">${icon(HEALTH_ICON[hl.level] || 'circle', 13)}<span>${hl.label}</span></span>`; }
  function steps(p, lg) {
    var cur = phaseIndex(p);
    return h`<ol class="pj-steps${lg ? ' pj-steps--lg' : ''}" aria-label="Giai đoạn dự án">${PHASES.map(function (ph, i) {
      var cls = i < cur ? ' is-done' : i === cur ? ' is-current' : '';
      return h`<li class="pj-step${cls}"${i === cur ? raw(' aria-current="step"') : ''}><span class="pj-step__dot">${lg && i < cur ? icon('check', 9) : ''}</span><span class="pj-step__lbl">${ph.label}</span>${lg ? h`<small class="pj-step__rng mono-sm">${ph.range}</small>` : ''}</li>`;
    })}</ol>`;
  }
  function progressBar(p, hl) {
    var active = p.status === 'active';
    return h`<div class="pj-prog"><div class="pj-prog__track"><span class="progress progress--xs${active ? ' progress--grad' : ''}" style="--bar:var(--pc)" role="progressbar" aria-valuenow="${p.progress}" aria-valuemin="0" aria-valuemax="100" aria-label="Tiến độ ${p.progress}%"><span class="progress__bar" style="width:${U.clamp(p.progress, 0, 100)}%"></span></span>${hl.level !== 'done' ? h`<i class="pj-prog__tick" style="left:${hl.expected}%" data-tip="Kỳ vọng ${hl.expected}%"></i>` : ''}</div><b class="pj-prog__pct mono">${p.progress}%</b></div>`;
  }
  function card(p, i, opts) {
    var st = S(), hl = st.projectHealth(p), todayISO = opts.todayISO;
    var lead = st.staff(p.leadId), ppl = members(p), mine = isMine(p);
    var days = U.daysBetween(todayISO, p.end), done = p.status === 'done', urgent = !done && days <= 0;
    var next = upcoming(p.id, todayISO)[0];
    return h`<a class="card card--click pj-card${opts.reveal ? ' reveal' : ''}${opts.enter ? ' pj-enter' : ''}" href="#/projects/${p.id}" data-id="${p.id}" style="--pc:${p.color};--i:${Math.min(i, 8)}" aria-label="${p.client} — ${p.name}">
      <div class="pj-card__top">
        <span class="pj-mono" aria-hidden="true">${monogram(p.client)}</span>
        <div class="pj-card__titles"><div class="pj-card__client"><span class="t-h3 truncate">${p.client}</span>${mine ? raw('<span class="chip chip--blue chip--xs">Của tôi</span>') : ''}</div><div class="pj-card__name">${p.name}</div></div>
        <div class="pj-card__badges">${statusChip(p)}${healthTag(hl)}</div>
      </div>
      ${steps(p, false)}
      ${progressBar(p, hl)}
      <div class="pj-card__meta">
        <span class="pj-card__dl">${icon('flag', 13)}<span class="mono-sm">${done ? 'Kết thúc' : 'Deadline'} · ${dmw(p.end)}</span>${done ? '' : h`<b class="pj-dn${urgent ? ' is-urgent' : ''}">${dLabel(days)}</b>`}</span>
        <span class="pj-card__next">${icon('arrow-right', 13)}<span class="truncate">${next ? h`Tiếp theo: <b>${next.title}</b> · ${dmw(next.date)}` : (done ? 'Đã wrap-up' : 'Không còn sự kiện sắp tới')}</span></span>
      </div>
      <div class="pj-card__foot">
        <span class="pj-lead">${raw(UI.avatar(lead, { size: 'xs', title: false }))}<span>Lead: <b>${lead ? U.shortName(lead.name) : '—'}</b></span></span>
        ${raw(UI.avatarStack(ppl, { max: 5, size: 'sm' }))}
        <span class="pj-tags">${(p.tags || []).slice(0, 3).map(function (t) { return h`<span class="tag">${t}</span>`; })}</span>
      </div>
    </a>`;
  }
  function tableRow(p, todayISO) {
    var st = S(), hl = st.projectHealth(p), lead = st.staff(p.leadId), ppl = members(p);
    var days = U.daysBetween(todayISO, p.end), done = p.status === 'done', urgent = !done && days <= 0;
    return h`<tr class="pj-row" data-id="${p.id}" tabindex="0" aria-label="${p.client} — ${p.name}" style="--pc:${p.color}">
      <td><a class="pj-row__id" href="#/projects/${p.id}" tabindex="-1"><span class="pj-mono pj-mono--sm" aria-hidden="true">${monogram(p.client)}</span><span class="pj-row__txt"><b>${p.client}</b><small>${p.name}</small></span></a></td>
      <td>${statusChip(p)}</td>
      <td>${healthTag(hl)}</td>
      <td class="pj-row__prog">${progressBar(p, hl)}</td>
      <td class="num"><span class="pj-row__dl">${dmw(p.end)}${done ? '' : h` <b class="pj-dn${urgent ? ' is-urgent' : ''}">${dLabel(days)}</b>`}</span></td>
      <td><span class="pj-lead">${raw(UI.avatar(lead, { size: 'xs', title: false }))}<span>${lead ? U.shortName(lead.name) : '—'}</span></span></td>
      <td>${raw(UI.avatarStack(ppl, { max: 4, size: 'xs' }))}</td>
    </tr>`;
  }
  function emptyBox(iconName, title, body, actionLabel, act) {
    return h`<div class="empty"><div class="empty__icon">${icon(iconName, 26)}</div><div class="empty__title">${title}</div>${body ? h`<div class="empty__body">${body}</div>` : ''}${actionLabel ? h`<button type="button" class="btn btn--soft btn--sm" data-act="${act}">${actionLabel}</button>` : ''}</div>`;
  }

  /* ------------------------------------------------------------------ view */
  function ProjectsView(container, route) {
    var self = this;
    this.container = container; this.unbinders = []; this.timers = [];
    this.todayISO = U.todayISO();
    this.prefs = Object.assign({}, DEFAULT_PREFS, U.loadJSON(PREF_KEY, null) || {});
    this.mode = null; this.id = null; this.tab = 'overview'; this.F = null; this.route = route;
    this.kpiPrev = {}; this.selfKind = null; this.els = {};
    this.root = U.el('div', { class: 'pj' });
    container.appendChild(this.root);
    this.bind();
    this.apply(route, true);
    this.unsub = S().subscribe(function (state, meta) { self.onStore(meta || {}); });
    this.keys = TABS.map(function (t, i) { return UI.shortcuts.register(String(i + 1), function () { if (self.mode === 'detail') self.goTab(t.id); }, 'Dự án: tab ' + t.label, 'Dự án'); }).concat([
      UI.shortcuts.register('e', function () { if (self.mode === 'detail') self.act('edit'); }, 'Chỉnh sửa dự án đang xem', 'Dự án'),
      UI.shortcuts.register('f', function () { if (self.mode === 'list' && self.els.search) { self.els.search.focus(); self.els.search.select(); } }, 'Tìm dự án', 'Dự án'),
      UI.shortcuts.register('m', function () { if (self.mode === 'list') self.setFilter({ mine: !self.F.mine }); }, 'Bật / tắt "Của tôi"', 'Dự án')
    ]);
    UI.palette.register({ id: 'projects:mine', label: 'Dự án của tôi', icon: 'briefcase', section: 'Dự án', keywords: 'du an cua toi mine', run: function () { Z15.router.go('projects', { mine: 1 }); } });
    this.timers.push(setInterval(function () { self.tick(); }, 60000));
  }

  ProjectsView.prototype.apply = function (route, initial) {
    var id = route.parts && route.parts[0], q = route.query || {};
    if (id) this.showDetail(id, q.tab, initial); else this.showList(q, initial);
  };
  ProjectsView.prototype.update = function (route) { this.flushNotes(); this.route = route; this.apply(route, false); };
  ProjectsView.prototype.rerender = function () { this.mode = null; this.apply(this.route, false); };
  ProjectsView.prototype.tick = function () {
    var t = U.todayISO();
    if (t !== this.todayISO) { this.todayISO = t; this.rerender(); return; }
    if (this.mode === 'detail' && this.tab === 'timeline') { var now = this.root.querySelector('.pj-gantt__now'); if (now && now.dataset.days) { var x = (+now.dataset.idx + U.nowMinutes() / 1440) / +now.dataset.days; now.style.setProperty('--x', U.clamp(x, 0, 1).toFixed(4)); } }
  };

  /* -------------------------------------------------------------- list */
  ProjectsView.prototype.readFilters = function (query) {
    var st = S(), ids = E().PROJECT_STATUS.map(function (s) { return s.id; });
    // Link chia sẻ mang bộ lọc tường minh → không trộn với bộ lọc đã lưu của người xem (sort/mode vẫn lấy từ prefs).
    var explicit = ['status', 'mine', 'client', 'q'].some(function (k) { return k in query; });
    var pr = explicit ? Object.assign({}, DEFAULT_PREFS, { sort: this.prefs.sort, mode: this.prefs.mode }) : this.prefs;
    var status = query.status !== undefined ? query.status : pr.status; if (ids.indexOf(status) < 0) status = '';
    var mine = query.mine !== undefined ? (query.mine === '1' || query.mine === 'true') : !!pr.mine;
    var client = query.client !== undefined ? query.client : pr.client; if (client && !st.state.projects.some(function (p) { return p.client === client; })) client = '';
    var sort = query.sort !== undefined ? query.sort : pr.sort; if (!SORTS.some(function (s) { return s.id === sort; })) sort = 'deadline';
    var mode = query.mode !== undefined ? query.mode : pr.mode; if (mode !== 'table') mode = 'cards';
    var q = query.q !== undefined ? String(query.q).slice(0, 60) : (this.F ? this.F.q : '');
    return { status: status, mine: mine, client: client, sort: sort, mode: mode, q: q || '' };
  };
  ProjectsView.prototype.savePrefs = function () { var F = this.F; this.prefs = { status: F.status, mine: F.mine, client: F.client, sort: F.sort, mode: F.mode }; U.saveJSON(PREF_KEY, this.prefs); };
  ProjectsView.prototype.hasFilters = function () { var F = this.F; return !!(F.status || F.mine || F.client || F.q); };

  ProjectsView.prototype.showList = function (query, initial) {
    var fresh = this.mode !== 'list';
    this.F = this.readFilters(query); this.savePrefs();
    this.mode = 'list'; this.id = null;
    if (fresh) { this.buildList(initial); } else this.syncControls();
    this.renderKpis(fresh);
    this.renderStatusChips();
    this.renderResults(initial ? 'reveal' : fresh ? 'enter' : '');
    this.setListTitle();
  };
  ProjectsView.prototype.buildList = function (initial) {
    var self = this, rv = initial ? ' reveal' : ' pj-enter';
    this.root.className = 'pj pj--list';
    this.root.innerHTML = '<div class="pj-kpis grid grid--4"></div>' +
      '<div class="card pj-bar' + rv + '" style="--i:2">' +
      '<div class="pj-bar__top">' +
      '<div class="input-icon pj-bar__search">' + UI.icon('search', 16) + '<input class="input" type="search" placeholder="Tìm khách hàng, chiến dịch, tag…" aria-label="Tìm dự án" autocomplete="off"></div>' +
      '<div class="select-wrap pj-bar__client"><select class="input select" aria-label="Lọc theo khách hàng"></select>' + UI.icon('chevron-down', 16) + '</div>' +
      '<div class="select-wrap pj-bar__sort"><select class="input select" aria-label="Sắp xếp">' + SORTS.map(function (s) { return '<option value="' + s.id + '">Sắp xếp: ' + U.escapeHtml(s.label) + '</option>'; }).join('') + '</select>' + UI.icon('chevron-down', 16) + '</div>' +
      '<button type="button" class="chip chip--btn pj-mine" aria-pressed="false" data-tip="Chỉ dự án bạn tham gia (M)">' + UI.icon('user', 13) + '<span>Của tôi</span></button>' +
      '<span class="pj-bar__seg"></span>' +
      '<button type="button" class="btn btn--secondary pj-bar__new" data-act="new">' + UI.icon('plus', 16) + '<span>Tạo dự án</span></button>' +
      '</div>' +
      '<div class="pj-bar__status" role="group" aria-label="Lọc theo trạng thái"></div>' +
      '<div class="pj-bar__foot"><span class="pj-bar__count"></span><span class="pj-bar__crumbs muted"></span><button type="button" class="link-btn pj-bar__clear" data-act="clear" hidden>Xoá bộ lọc</button></div>' +
      '</div>' +
      '<div class="pj-results" aria-live="polite"></div>';
    this.els = {
      kpis: this.root.querySelector('.pj-kpis'), bar: this.root.querySelector('.pj-bar'), search: this.root.querySelector('.pj-bar__search input'),
      client: this.root.querySelector('.pj-bar__client select'), sort: this.root.querySelector('.pj-bar__sort select'), mine: this.root.querySelector('.pj-mine'),
      status: this.root.querySelector('.pj-bar__status'), count: this.root.querySelector('.pj-bar__count'), crumbs: this.root.querySelector('.pj-bar__crumbs'), clear: this.root.querySelector('.pj-bar__clear'), results: this.root.querySelector('.pj-results')
    };
    this.seg = UI.segmented([{ value: 'cards', label: 'Thẻ', icon: 'layout' }, { value: 'table', label: 'Bảng', icon: 'list' }], this.F.mode, function (v) { self.F.mode = v; self.savePrefs(); self.renderResults(''); }, { cls: 'segmented--sm' });
    this.root.querySelector('.pj-bar__seg').appendChild(this.seg);
    this.renderClientOptions();
    this.syncControls();
  };
  ProjectsView.prototype.renderClientOptions = function () {
    if (!this.els.client) return;
    var clients = U.uniq(S().state.projects.map(function (p) { return p.client; })).sort(function (a, b) { return a.localeCompare(b, 'vi'); });
    this.els.client.innerHTML = '<option value="">Mọi khách hàng</option>' + clients.map(function (c) { return '<option value="' + U.escapeHtml(c) + '">' + U.escapeHtml(c) + '</option>'; }).join('');
    this.els.client.value = this.F ? this.F.client : '';
  };
  ProjectsView.prototype.syncControls = function () {
    var F = this.F, els = this.els; if (!els.search) return;
    if (els.search.value !== F.q) els.search.value = F.q;
    if (els.client.value !== F.client) els.client.value = F.client;
    if (els.sort.value !== F.sort) els.sort.value = F.sort;
    els.mine.classList.toggle('is-active', F.mine); els.mine.setAttribute('aria-pressed', String(F.mine));
    var active = this.seg.querySelector('.segmented__btn.is-active');
    if (active && active.dataset.value !== F.mode) { var b = this.seg.querySelector('[data-value="' + F.mode + '"]'); if (b) b.click(); }
  };
  ProjectsView.prototype.stats = function () {
    var st = S(), ps = st.state.projects, t = this.todayISO, in7 = U.toISO(U.addDays(U.today(), 7));
    var active = ps.filter(function (p) { return p.status === 'active'; }), review = ps.filter(function (p) { return p.status === 'review'; });
    var dls = st.state.events.filter(function (e) { return e.type === 'deadline' && e.projectId && e.date >= t && e.date <= in7; }).map(function (e) { return { date: e.date, start: e.allDay ? '' : e.start, title: e.title }; });
    ps.forEach(function (p) { if (p.status !== 'done' && p.end >= t && p.end <= in7) dls.push({ date: p.end, start: '', title: 'Kết thúc ' + p.client + ' — ' + p.name }); });
    dls = U.sortBy(dls, function (d) { return d.date + ' ' + d.start; });
    var clients = U.uniq(ps.map(function (p) { return p.client; }));
    var people = U.uniq([].concat.apply([], ps.filter(function (p) { return p.status !== 'done'; }).map(function (p) { return p.memberIds || []; })));
    return { total: ps.length, active: active, review: review, deadlines: dls, clients: clients, people: people, mineActive: active.filter(isMine).length };
  };
  ProjectsView.prototype.renderKpis = function (fresh) {
    var s = this.stats(), self = this, near = s.deadlines[0], F = this.F;
    var tiles = [
      { key: 'active', label: 'Đang chạy', icon: 'activity', value: s.active.length, delta: s.mineActive ? 'Bạn tham gia ' + s.mineActive + '/' + s.active.length : 'Bạn chưa tham gia dự án nào', status: 'active' },
      { key: 'review', label: 'Chờ duyệt KH', icon: 'eye', value: s.review.length, delta: s.review.length ? s.review.map(function (p) { return p.client; }).join(', ') : 'Không có dự án chờ duyệt', status: 'review' },
      { key: 'dl', label: 'Deadline trong 7 ngày', icon: 'flag', value: s.deadlines.length, delta: near ? U.fmtRelativeDay(near.date) + (near.start ? ' ' + near.start : '') + ' · ' + near.title : 'Tuần tới chưa có deadline', lead: near ? U.fmtRelativeDay(near.date) + (near.start ? ' ' + near.start : '') : '', tail: near ? near.title : '', urgent: !!near && near.date === this.todayISO },
      { key: 'all', label: 'Danh mục', icon: 'briefcase', value: s.total, unit: 'dự án', delta: s.clients.length + ' khách hàng · ' + s.people.length + ' nhân sự' }
    ];
    this.els.kpis.innerHTML = tiles.map(function (t, i) {
      var tag = t.status ? 'button' : 'div', pressed = t.status ? ' aria-pressed="' + (F.status === t.status) + '" data-kpi-status="' + t.status + '" type="button"' : '';
      return '<' + tag + ' class="card kpi pj-kpi' + (t.status ? ' pj-kpi--btn' : '') + (fresh ? ' reveal' : '') + '" style="--i:' + i + '"' + pressed + '>' +
        '<div class="kpi__label">' + UI.icon(t.icon, 13) + t.label + '</div>' +
        '<div class="kpi__value"><span class="tnum" data-count="' + t.value + '" data-key="' + t.key + '">' + t.value + '</span>' + (t.unit ? '<small>' + t.unit + '</small>' : '') + '</div>' +
        '<div class="kpi__delta' + (t.urgent ? ' pj-urgent' : '') + '">' + (t.lead
          ? '<span class="pj-kpi__near" title="' + U.escapeHtml(t.delta) + '"><b class="pj-kpi__when">' + U.escapeHtml(t.lead) + '</b><span class="pj-kpi__sep" aria-hidden="true">·</span><span class="truncate">' + U.escapeHtml(t.tail) + '</span></span>'
          : '<span class="truncate" title="' + U.escapeHtml(t.delta) + '">' + U.escapeHtml(t.delta) + '</span>') + '</div></' + tag + '>';
    }).join('');
    var reduce = reduceMotion();
    U.qsa('[data-count]', this.els.kpis).forEach(function (el) {
      var v = +el.dataset.count, from = self.kpiPrev[el.dataset.key];
      if (reduce || from === v) el.textContent = String(v);
      else U.countUp(el, v, { from: from || 0, duration: from == null ? 900 : 500, format: function (x) { return String(Math.round(x)); } });
      self.kpiPrev[el.dataset.key] = v;
    });
  };
  ProjectsView.prototype.filtered = function (ignoreStatus) {
    var F = this.F, q = (F.q || '').trim();
    return S().state.projects.filter(function (p) {
      if (!ignoreStatus && F.status && p.status !== F.status) return false;
      if (F.mine && !isMine(p)) return false;
      if (F.client && p.client !== F.client) return false;
      if (q && !(U.fuzzyMatch(q, p.client + ' ' + p.name) || U.fuzzyMatch(q, (p.tags || []).join(' ')) || U.fuzzyMatch(q, statusLabel(p.status)))) return false;
      return true;
    });
  };
  ProjectsView.prototype.sorted = function (list) {
    var st = S(), key = this.F.sort;
    var health = {}; list.forEach(function (p) { health[p.id] = st.projectHealth(p); });
    return list.slice().sort(function (a, b) {
      if (key === 'name') return a.client.localeCompare(b.client, 'vi') || a.name.localeCompare(b.name, 'vi');
      if (key === 'progress') return (b.progress - a.progress) || a.end.localeCompare(b.end);
      if (key === 'risk') { var la = LEVEL_ORDER[health[a.id].level], lb = LEVEL_ORDER[health[b.id].level]; if (la !== lb) return la - lb; return (a.progress - health[a.id].expected) - (b.progress - health[b.id].expected) || a.end.localeCompare(b.end); }
      var da = a.status === 'done' ? 1 : 0, db = b.status === 'done' ? 1 : 0; if (da !== db) return da - db;
      return a.end.localeCompare(b.end) || a.client.localeCompare(b.client, 'vi');
    });
  };
  ProjectsView.prototype.renderStatusChips = function () {
    var F = this.F, base = this.filtered(true), counts = U.groupBy(base, 'status');
    var all = [{ id: '', label: 'Tất cả', n: base.length }].concat(E().PROJECT_STATUS.map(function (s) { return { id: s.id, label: s.label, n: (counts[s.id] || []).length }; }));
    this.els.status.innerHTML = all.map(function (s) { return '<button type="button" class="chip chip--btn' + (F.status === s.id ? ' is-active' : '') + '" data-status-chip="' + s.id + '" aria-pressed="' + (F.status === s.id) + '"><span>' + U.escapeHtml(s.label) + '</span><span class="badge">' + s.n + '</span></button>'; }).join('');
  };
  ProjectsView.prototype.renderResults = function (anim) {
    var self = this, F = this.F, list = this.sorted(this.filtered(false)), box = this.els.results;
    var crumbs = [];
    if (F.status) crumbs.push(statusLabel(F.status)); if (F.mine) crumbs.push('của tôi'); if (F.client) crumbs.push(F.client); if (F.q) crumbs.push('“' + F.q + '”');
    this.els.count.innerHTML = '<b>' + list.length + '</b> dự án' + (crumbs.length ? ' khớp bộ lọc' : '');
    this.els.crumbs.textContent = crumbs.length ? '· ' + crumbs.join(' · ') : '';
    this.els.clear.hidden = !this.hasFilters();
    if (!list.length) { U.render(box, emptyBox('filter', 'Không có dự án nào khớp bộ lọc', 'Thử bỏ bớt điều kiện, đổi khách hàng hoặc kiểm tra lại từ khoá.', 'Xoá bộ lọc', 'clear')); return; }
    if (F.mode === 'table') {
      U.render(box, h`<div class="table-wrap pj-table-wrap${anim ? ' pj-enter' : ''}"><table class="table pj-table"><thead><tr><th>Dự án</th><th>Trạng thái</th><th>Sức khoẻ</th><th>Tiến độ</th><th class="num">Deadline</th><th>Lead</th><th>Thành viên</th></tr></thead><tbody>${list.map(function (p) { return tableRow(p, self.todayISO); })}</tbody></table></div>`);
    } else {
      U.render(box, h`<div class="pj-grid">${list.map(function (p, i) { return card(p, i + 3, { todayISO: self.todayISO, reveal: anim === 'reveal', enter: anim === 'enter' }); })}</div>`);
    }
  };
  ProjectsView.prototype.setListTitle = function () {
    var s = this.stats();
    Z15.app.setTitle('Dự án & Chiến dịch', s.total + ' dự án · ' + s.active.length + ' đang chạy · ' + s.review.length + ' chờ duyệt · ' + s.clients.length + ' khách hàng');
  };
  ProjectsView.prototype.setFilter = function (patch) {
    Object.assign(this.F, patch); this.savePrefs();
    var F = this.F, q = { status: F.status || '', mine: F.mine ? 1 : '', client: F.client || '', sort: F.sort !== 'deadline' ? F.sort : '', q: F.q || '' };
    var qs = Object.keys(q).filter(function (k) { return q[k] !== '' && q[k] != null; }).map(function (k) { return encodeURIComponent(k) + '=' + encodeURIComponent(q[k]); }).join('&');
    var target = '#/projects' + (qs ? '?' + qs : '');
    if (location.hash === target) this.showList(Z15.router.parse(target).query, false); else Z15.router.go('projects', q);
  };

  /* ------------------------------------------------------------ detail */
  ProjectsView.prototype.showDetail = function (id, tab, initial) {
    var st = S(), p = st.project(id);
    tab = TABS.some(function (t) { return t.id === tab; }) ? tab : 'overview';
    var fresh = this.mode !== 'detail' || this.id !== id || !this.els.head;
    this.mode = 'detail'; this.id = id;
    this.root.className = 'pj pj--detail' + (!initial && fresh ? ' pj-enter' : '');
    if (!p) {
      this.tab = tab; this.els = {};
      this.root.innerHTML = '<a class="pj-back" href="#/projects">' + UI.icon('arrow-left', 15) + '<span>Dự án</span></a><div class="card"><div class="empty"><div class="empty__icon">' + UI.icon('search', 26) + '</div><div class="empty__title">Không tìm thấy dự án</div><div class="empty__body">Dự án “' + U.escapeHtml(id) + '” không tồn tại hoặc đã bị xoá.</div><a class="btn btn--soft btn--sm" href="#/projects">' + UI.icon('arrow-left', 15) + 'Về danh sách dự án</a></div></div>';
      Z15.app.setTitle('Dự án', 'Không tìm thấy dự án');
      return;
    }
    if (fresh) {
      this.tab = tab;
      this.root.innerHTML = '<a class="pj-back' + (initial ? ' reveal' : '') + '" href="#/projects" style="--i:0">' + UI.icon('arrow-left', 15) + '<span>Dự án</span></a>' +
        '<section class="card pj-head' + (initial ? ' reveal' : '') + '" style="--i:1"></section>' +
        '<div class="tabs pj-tabs' + (initial ? ' reveal' : '') + '" role="tablist" style="--i:2"></div>' +
        '<div class="pj-panel' + (initial ? ' reveal' : '') + '" role="tabpanel" style="--i:3"></div>';
      this.els = { head: this.root.querySelector('.pj-head'), tabs: this.root.querySelector('.pj-tabs'), panel: this.root.querySelector('.pj-panel') };
      this.renderHead(); this.renderTabs(); this.renderPanel(false);
    } else if (tab !== this.tab) { this.tab = tab; this.renderTabs(); this.renderPanel(true); }
    this.setDetailTitle(p);
  };
  ProjectsView.prototype.setDetailTitle = function (p) {
    p = p || S().project(this.id); if (!p) return;
    var days = U.daysBetween(this.todayISO, p.end), done = p.status === 'done';
    Z15.app.setTitle(p.client + ' — ' + p.name, statusLabel(p.status) + ' · ' + (done ? 'kết thúc ' : 'deadline ') + dmw(p.end) + (done ? '' : ' · ' + (days > 0 ? 'còn ' + days + ' ngày' : days === 0 ? 'hôm nay' : 'quá hạn ' + (-days) + ' ngày')));
  };
  ProjectsView.prototype.renderHead = function () {
    var st = S(), p = st.project(this.id), head = this.els.head; if (!p || !head) return;
    var hl = st.projectHealth(p), lead = st.staff(p.leadId), ppl = members(p), todayISO = this.todayISO;
    var days = U.daysBetween(todayISO, p.end), done = p.status === 'done', urgent = !done && days <= 0, tone = BANNER_TONE[hl.level];
    this.root.style.setProperty('--pc', p.color);
    U.render(head, h`
      <div class="pj-head__row">
        <span class="pj-mono pj-mono--lg" aria-hidden="true">${monogram(p.client)}</span>
        <div class="pj-head__titles">
          <div class="eyebrow pj-head__eyebrow">Dự án · ${p.id.toUpperCase()}${isMine(p) ? ' · bạn tham gia' : ''}</div>
          <h2 class="t-h1 pj-head__title">${p.client} <span class="pj-head__sep">—</span> <span class="pj-head__name">${p.name}</span></h2>
          <div class="pj-head__chips">${statusChip(p)}${healthTag(hl)}</div>
        </div>
        <div class="pj-head__actions">
          <button type="button" class="btn btn--secondary" data-act="edit" data-tip="Phím E">${icon('edit', 16)}<span>Chỉnh sửa</span></button>
          <button type="button" class="btn btn--soft" data-act="shoot">${icon('video', 16)}<span>Xếp lịch quay</span></button>
          <button type="button" class="btn btn--primary" data-act="add-event">${icon('plus', 16)}<span>Thêm sự kiện</span></button>
          <button type="button" class="icon-btn" data-act="more" aria-label="Thêm hành động" aria-haspopup="menu">${icon('more-horizontal', 18)}</button>
        </div>
      </div>
      <div class="banner${tone ? ' banner--' + tone : ''} pj-head__banner">${icon(HEALTH_ICON[hl.level], 16)}<span>${healthSentence(p, hl, todayISO)}</span></div>
      <div class="pj-head__meta">
        <span class="pj-meta">${icon('calendar', 15)}<span class="mono">${U.fmtDate(p.start, 'dm')} – ${U.fmtDate(p.end, 'dm')}</span><span class="pj-meta__sub${urgent ? ' pj-urgent' : ''}">· ${done ? 'đã kết thúc' : days > 0 ? 'còn ' + days + ' ngày' : days === 0 ? 'kết thúc hôm nay' : 'quá hạn ' + (-days) + ' ngày'}</span></span>
        ${p.budget ? h`<span class="pj-meta">${icon('pie', 15)}<span>Ngân sách <b>${p.budget}</b></span></span>` : ''}
        <span class="pj-meta">${raw(UI.avatar(lead, { size: 'xs', title: false }))}<span>Lead <b>${lead ? U.shortName(lead.name) : '—'}</b></span></span>
        <span class="pj-meta">${raw(UI.avatarStack(ppl, { max: 6, size: 'sm' }))}<span>${ppl.length} thành viên</span></span>
        ${(p.tags || []).length ? h`<span class="pj-meta pj-meta--tags">${p.tags.map(function (t) { return h`<span class="tag">${t}</span>`; })}</span>` : ''}
      </div>`);
  };
  ProjectsView.prototype.tabCounts = function (p) {
    return { timeline: S().eventsForProject(p.id).length, allocation: members(p).length, notes: (p.checklist || []).filter(function (c) { return !c.done; }).length };
  };
  ProjectsView.prototype.renderTabs = function () {
    var p = S().project(this.id), self = this; if (!p || !this.els.tabs) return;
    var counts = this.tabCounts(p);
    this.els.tabs.innerHTML = TABS.map(function (t, i) {
      var on = t.id === self.tab;
      return '<button type="button" class="tab pj-tab' + (on ? ' is-active' : '') + '" role="tab" aria-selected="' + on + '" data-tab="' + t.id + '" id="pj-tab-' + t.id + '">' + UI.icon(t.icon, 15) + '<span>' + t.label + '</span>' + (counts[t.id] ? '<span class="badge' + (on ? ' badge--blue' : '') + '">' + counts[t.id] + '</span>' : '') + '<kbd class="kbd pj-tab__kbd" aria-hidden="true">' + (i + 1) + '</kbd></button>';
    }).join('');
  };
  ProjectsView.prototype.goTab = function (tab) {
    if (tab === this.tab) return;
    Z15.router.go('projects/' + this.id, { tab: tab !== 'overview' ? tab : '' });
  };
  ProjectsView.prototype.renderPanel = function (animate) {
    var p = S().project(this.id), panel = this.els.panel; if (!p || !panel) return;
    if (this.tab === 'notes' && document.activeElement && document.activeElement.classList.contains('pj-notes__ta') && panel.contains(document.activeElement)) { this.renderChecklist(); return; }
    panel.setAttribute('aria-labelledby', 'pj-tab-' + this.tab);
    panel.dataset.tab = this.tab;
    var html = this.tab === 'timeline' ? this.timelineHtml(p) : this.tab === 'allocation' ? this.allocationHtml(p) : this.tab === 'notes' ? this.notesHtml(p) : this.overviewHtml(p);
    U.render(panel, html);
    var reduce = reduceMotion();
    if (animate && !reduce) { panel.classList.remove('pj-enter'); void panel.offsetWidth; panel.classList.add('pj-enter'); }
    if (this.tab === 'notes') this.renderChecklist();
    if (this.tab === 'overview') {
      U.qsa('[data-count]', panel).forEach(function (el) { var v = +el.dataset.count; if (reduce) el.textContent = String(v); else U.countUp(el, v, { duration: 700, format: function (x) { return String(Math.round(x)); } }); });
    }
    if (!reduce) U.qsa('.progress__bar[data-w]', panel).forEach(function (b) { b.style.width = '0%'; requestAnimationFrame(function () { requestAnimationFrame(function () { b.style.width = b.dataset.w + '%'; }); }); });
  };

  /* ---- Tổng quan */
  ProjectsView.prototype.overviewHtml = function (p) {
    var st = S(), todayISO = this.todayISO, hl = st.projectHealth(p), evs = st.eventsForProject(p.id);
    var up = evs.filter(function (e) { return !isPastEvent(e, todayISO); }), past = evs.length - up.length, ppl = members(p), lead = st.staff(p.leadId);
    var teams = U.uniq(ppl.map(function (s) { return s.teamId; })), days = U.daysBetween(todayISO, p.end), done = p.status === 'done', cur = phaseIndex(p);
    var ms = up.filter(function (e) { return e.type === 'deadline' || e.type === 'pitch' || e.type === 'shoot'; }).slice(0, 5);
    return h`
      <div class="grid grid--4 pj-kpis">
        <div class="card kpi pj-kpi pj-kpi--prog"><div class="kpi__label">${icon('trending-up', 13)}Tiến độ</div><div class="kpi__value"><span class="tnum" data-prog-val>${p.progress}</span><small>%</small></div>
          <input type="range" class="range pj-range" min="0" max="100" step="1" value="${p.progress}" aria-label="Cập nhật tiến độ dự án" data-tip="Kéo để cập nhật tiến độ"${done ? raw(' disabled') : ''}>
          <div class="kpi__delta"><span class="truncate" data-prog-delta>${progDelta(p, hl)}</span></div></div>
        <div class="card kpi pj-kpi"><div class="kpi__label">${icon('clock', 13)}Ngày còn lại</div><div class="kpi__value"><span class="tnum" data-count="${Math.max(0, days)}">${Math.max(0, days)}</span><small>ngày</small></div><div class="kpi__delta${!done && days < 0 ? ' pj-urgent' : ''}"><span class="truncate">${done ? 'Đã kết thúc ' + dmw(p.end) : days < 0 ? 'Quá hạn ' + (-days) + ' ngày · ' + dmw(p.end) : 'Kết thúc ' + dmw(p.end)}</span></div></div>
        <div class="card kpi pj-kpi"><div class="kpi__label">${icon('calendar', 13)}Sự kiện</div><div class="kpi__value"><span class="tnum" data-count="${evs.length}">${evs.length}</span></div><div class="kpi__delta"><span class="truncate">${up.length} sắp tới · ${past} đã qua</span></div></div>
        <div class="card kpi pj-kpi"><div class="kpi__label">${icon('users', 13)}Thành viên</div><div class="kpi__value"><span class="tnum" data-count="${ppl.length}">${ppl.length}</span></div><div class="kpi__delta"><span class="truncate">${teams.length} team · lead ${lead ? U.shortName(lead.name) : '—'}</span></div></div>
      </div>
      <section class="card pj-phase"><div class="card__head"><div><div class="card__eyebrow">Giai đoạn</div><div class="card__title" data-phase-title>${done ? 'Đã hoàn thành cả 5 giai đoạn' : 'Đang ở ' + PHASES[Math.min(cur, 4)].label}</div></div><span class="muted t-body-sm">Suy ra từ tiến độ ${U.raw('<b class="tnum" data-phase-pct>' + p.progress + '</b>')}%</span></div><div data-steps>${steps(p, true)}</div></section>
      <div class="pj-two">
        <section class="card pj-up"><div class="card__head"><div><div class="card__eyebrow">Sắp tới</div><div class="card__title">${up.length ? 'Sự kiện tiếp theo' : 'Chưa có lịch sắp tới'}</div></div>${up.length > 5 ? h`<button type="button" class="link-btn" data-act="tab-timeline">Xem tất cả ${up.length}</button>` : ''}</div>
          ${up.length ? h`<div class="pj-up__list">${up.slice(0, 5).map(function (e) { var d = U.fromISO(e.date); return h`<div class="pj-up__row${e.date === todayISO ? ' is-today' : ''}"><span class="pj-up__date"><b class="tnum">${d.getDate()}</b><small>${U.weekdayShort(d)}</small></span>${raw(UI.eventPill(e, { projectColor: false }))}</div>`; })}</div>` : emptyBox('coffee', 'Lịch dự án đang trống', done ? 'Dự án đã wrap-up, không còn sự kiện nào.' : 'Thêm buổi họp, lịch quay hoặc deadline để cả đội cùng thấy.', done ? '' : 'Thêm sự kiện', 'add-event')}
        </section>
        <section class="card pj-mem"><div class="card__head"><div><div class="card__eyebrow">Đội dự án</div><div class="card__title">Thành viên · ${ppl.length}</div></div><span class="muted t-body-sm">${teams.length} team</span></div>
          <div class="pj-mem__grid">${ppl.map(function (s) { var team = st.team(s.teamId); return h`<button type="button" class="pj-member" data-staff="${s.id}" aria-label="Xem hồ sơ ${s.name}">${raw(UI.avatar(s, { size: 'sm', status: true, title: false }))}<span class="pj-member__txt"><b><span class="truncate">${U.shortName(s.name)}</span>${s.id === p.leadId ? raw('<span class="chip chip--blue chip--xs">Lead</span>') : ''}</b><small>${s.role}</small></span>${team ? raw(UI.teamChip(team, { cls: 'chip--xs' })) : ''}</button>`; })}</div>
        </section>
      </div>
      <section class="card pj-ms"><div class="card__head"><div><div class="card__eyebrow">Mốc quan trọng</div><div class="card__title">Deadline, pitch & lịch quay sắp tới</div></div></div>
        ${ms.length || !done ? h`<div class="pj-ms__list">${ms.map(function (e) { var dd = U.daysBetween(todayISO, e.date), type = st.eventType(e.type); return h`<button type="button" class="pj-ms__row${e.date === todayISO ? ' is-today' : ''}" data-event="${e.id}"><span class="pj-ms__date">${dmw(e.date)}</span><span class="pj-ms__time">${e.allDay ? 'Cả ngày' : e.start}</span><span class="pj-ms__title"><b>${e.title}</b>${raw(UI.chip(type.label, { icon: type.icon, cls: 'chip--xs chip--type' }))}</span><b class="pj-dn${dd <= 0 && e.type === 'deadline' ? ' is-urgent' : ''}">${dLabel(dd)}</b></button>`; })}${done ? '' : h`<div class="pj-ms__row is-end"><span class="pj-ms__date">${dmw(p.end)}</span><span class="pj-ms__time">—</span><span class="pj-ms__title"><b>Kết thúc dự án · ${p.client}</b></span><b class="pj-dn${days <= 0 ? ' is-urgent' : ''}">${dLabel(days)}</b></div>`}</div>` : emptyBox('flag', 'Không còn mốc nào', 'Dự án đã hoàn thành.')}
      </section>`;
  };

  /* ---- Mốc & Lịch */
  ProjectsView.prototype.timelineHtml = function (p) {
    var st = S(), todayISO = this.todayISO, evs = st.eventsForProject(p.id), hl = st.projectHealth(p);
    var weeks = weeksOf(p.start, p.end), n = weeks.length, rangeStart = weeks[0].start, totalDays = n * 7;
    var pos = function (iso, min) { return U.clamp((U.daysBetween(rangeStart, U.fromISO(iso)) + (min || 0) / 1440) / totalDays * 100, 0, 100); };
    var types = D.EVENT_TYPES.filter(function (t) { return evs.some(function (e) { return e.type === t.id; }); });
    var todayIdx = U.daysBetween(rangeStart, U.today()), inRange = todayIdx >= 0 && todayIdx < totalDays;
    var nowX = inRange ? (todayIdx + U.nowMinutes() / 1440) / totalDays : null;
    var pStart = pos(p.start, 0), pEnd = pos(p.end, 1440), pW = pEnd - pStart;
    var thisWeekISO = U.toISO(U.startOfWeek(U.today()));
    var cols = LABEL_W + 'px repeat(' + n + ', minmax(' + WEEK_W + 'px, 1fr))';
    var gantt = h`<div class="pj-gantt" style="grid-template-columns:${cols};min-width:${LABEL_W + n * WEEK_W}px;--wk:${(100 / n).toFixed(4)}%">
      <div class="pj-gantt__lbl pj-gantt__lbl--hd"><span class="eyebrow">Tuần</span></div>
      ${weeks.map(function (w) { return h`<div class="pj-gantt__hd${w.iso === thisWeekISO ? ' is-now' : ''}"><b class="mono">T${w.num}</b><small class="mono-sm">${U.fmtDate(w.start, 'dm')}</small></div>`; })}
      <div class="pj-gantt__lbl">${icon('briefcase', 14)}<span>Dự án</span><small class="mono-sm">${p.progress}%</small></div>
      <div class="pj-gantt__track pj-gantt__track--proj"><span class="pj-gantt__span" style="left:${pStart}%;width:${pW}%" data-tip="${U.fmtDate(p.start, 'dm')} – ${U.fmtDate(p.end, 'dm')} · tiến độ ${p.progress}%"><i style="width:${p.progress}%"></i></span>${hl.level !== 'done' ? h`<i class="pj-gantt__exp" style="left:${pStart + pW * hl.expected / 100}%" data-tip="Kỳ vọng ${hl.expected}%"></i>` : ''}</div>
      ${types.map(function (t) {
        var list = evs.filter(function (e) { return e.type === t.id; }), lanes = {};
        return h`<div class="pj-gantt__lbl">${icon(t.icon, 14)}<span>${t.label}</span><small class="mono-sm">${list.length}</small></div><div class="pj-gantt__track">${list.map(function (e) {
          var lane = lanes[e.date] = (lanes[e.date] || 0) + 1; lane = Math.min(lane - 1, 2);
          var s = e.allDay ? 0 : U.timeToMin(e.start), en = e.allDay ? 1440 : Math.max(U.timeToMin(e.end), s + 60);
          var x = pos(e.date, s), w = Math.max(0.2, pos(e.date, en) - x);
          var past = isPastEvent(e, todayISO), urgent = e.type === 'deadline' && !past && U.daysBetween(todayISO, e.date) <= 0;
          var tip = dmw(e.date) + ' · ' + (e.allDay ? 'Cả ngày' : U.fmtTimeRange(e.start, e.end)) + ' · ' + e.title;
          if (e.type === 'deadline') return h`<button type="button" class="pj-gbar pj-gbar--dia${past ? ' is-past' : ''}${urgent ? ' is-urgent' : ''}" style="left:${x}%;--off:${LANE_OFF[lane]}px" data-event="${e.id}" data-tip="${tip}" aria-label="${tip}"></button>`;
          return h`<button type="button" class="pj-gbar${past ? ' is-past' : ''}" style="left:${x}%;width:${w}%;--off:${LANE_OFF[lane]}px;--ev:var(--ev-${e.type})" data-event="${e.id}" data-tip="${tip}" aria-label="${tip}"></button>`;
        })}</div>`;
      })}
      ${nowX != null ? h`<div class="pj-gantt__now" style="--x:${nowX.toFixed(4)}" data-idx="${todayIdx}" data-days="${totalDays}" aria-hidden="true"><span class="mono-sm">Hôm nay</span></div>` : ''}
    </div>`;
    var groups = U.groupBy(evs, function (e) { return U.toISO(U.startOfWeek(U.fromISO(e.date))); });
    var keys = Object.keys(groups).sort();
    var list = keys.length ? keys.map(function (k) {
      var ws = U.fromISO(k), we = U.addDays(ws, 6), isNow = k === thisWeekISO, isPast = k < thisWeekISO;
      return h`<section class="pj-week${isNow ? ' is-now' : ''}${isPast ? ' is-past' : ''}"><header class="pj-week__hd"><b class="mono">T${U.isoWeek(ws)}</b><span class="mono-sm">${U.fmtDate(ws, 'dm')} – ${U.fmtDate(we, 'dm')}</span>${isNow ? raw('<span class="chip chip--blue chip--xs">Tuần này</span>') : isPast ? raw('<span class="chip chip--muted chip--xs">Đã qua</span>') : ''}<small>${groups[k].length} sự kiện</small></header><div class="pj-week__list">${groups[k].map(function (e) { return raw(UI.eventPill(e, { projectColor: false, cls: isPastEvent(e, todayISO) ? 'is-past' : '' })); })}</div></section>`;
    }) : h`<div class="card">${emptyBox('calendar', 'Dự án chưa có sự kiện nào', 'Bắt đầu bằng buổi họp brief hoặc xếp lịch quay đầu tiên.', 'Thêm sự kiện', 'add-event')}</div>`;
    return h`<section class="card card--flush pj-gantt-card">
      <div class="pj-gantt-head"><div><div class="card__eyebrow">Mốc & lịch</div><div class="card__title">Dòng thời gian · ${n} tuần</div>${inRange ? '' : h`<div class="card__sub">Hôm nay nằm ngoài khoảng thời gian dự án.</div>`}</div>
        <div class="pj-legend">${types.map(function (t) { return h`<span class="pj-legend__it">${t.id === 'deadline' ? raw('<i class="pj-legend__dia"></i>') : h`<i class="pj-legend__dot" style="--ev:var(--ev-${t.id})"></i>`}${t.label}</span>`; })}<span class="pj-legend__it"><i class="pj-legend__exp"></i>Kỳ vọng</span>${inRange ? raw('<span class="pj-legend__it"><i class="pj-legend__now"></i>Hôm nay</span>') : ''}</div></div>
      <div class="pj-gantt-wrap">${gantt}</div>
    </section>
    <div class="pj-weeks">${list}</div>`;
  };

  /* ---- Phân bổ */
  ProjectsView.prototype.allocationHtml = function (p) {
    var st = S(), all = weeksOf(p.start, p.end), weeks = all, note = '', thisWeekISO = U.toISO(U.startOfWeek(U.today()));
    if (all.length > MAX_ALLOC_WEEKS) {
      var idx = -1; all.forEach(function (w, i) { if (w.iso === thisWeekISO) idx = i; });
      if (idx < 0) idx = thisWeekISO < all[0].iso ? 0 : all.length - 1;
      var start = U.clamp(idx - 2, 0, all.length - MAX_ALLOC_WEEKS);
      weeks = all.slice(start, start + MAX_ALLOC_WEEKS);
      note = 'Hiển thị ' + MAX_ALLOC_WEEKS + '/' + all.length + ' tuần · T' + weeks[0].num + ' – T' + weeks[weeks.length - 1].num;
    }
    var ppl = members(p), evs = st.eventsForProject(p.id);
    var rows = ppl.map(function (s) {
      var cells = weeks.map(function (w) { var list = evs.filter(function (e) { return e.date >= w.iso && e.date <= w.endISO && e.attendeeIds.indexOf(s.id) >= 0; }); var hrs = U.sum(list, evHours); return { h: hrs, n: list.length, level: heatLevel(hrs) }; });
      return { s: s, cells: cells, total: U.sum(cells, function (c) { return c.h; }), n: U.sum(cells, function (c) { return c.n; }) };
    });
    var colTotals = weeks.map(function (w, i) { return U.sum(rows, function (r) { return r.cells[i].h; }); }), grand = U.sum(colTotals);
    var over = rows.filter(function (r) { return r.cells.some(function (c) { return c.level === 5; }); });
    return h`<section class="card card--flush pj-alloc">
      <div class="pj-alloc__head"><div><div class="card__eyebrow">Phân bổ</div><div class="card__title">Giờ sự kiện theo tuần · ${ppl.length} người</div>${note ? h`<div class="card__sub">${note}</div>` : ''}</div>
        <div class="pj-legend">${HEAT_LABELS.map(function (l, i) { return h`<span class="pj-legend__it"><i class="heat" data-level="${i}"></i>${l}</span>`; })}</div></div>
      ${over.length ? h`<div class="banner banner--danger pj-alloc__warn">${icon('alert-triangle', 16)}<span><b>${over.map(function (r) { return U.shortName(r.s.name); }).join(', ')}</b> có tuần vượt 10 giờ sự kiện cho dự án này — cân nhắc san việc.</span></div>` : ''}
      <div class="table-wrap pj-alloc__wrap"><table class="table pj-alloc__table"><thead><tr><th class="pj-alloc__who">Thành viên</th>${weeks.map(function (w) { return h`<th class="pj-alloc__wk${w.iso === thisWeekISO ? ' is-now' : ''}"><b>T${w.num}</b><small>${U.fmtDate(w.start, 'dm')}</small></th>`; })}<th class="num">Tổng</th></tr></thead>
        <tbody>${rows.map(function (r) {
          return h`<tr><td class="pj-alloc__who"><span class="pj-alloc__person">${raw(UI.avatar(r.s, { size: 'sm', title: false }))}<span><b>${U.shortName(r.s.name)}${r.s.id === p.leadId ? raw(' <span class="chip chip--blue chip--xs">Lead</span>') : ''}</b><small>${r.s.role}</small></span></span></td>${r.cells.map(function (c, i) {
            var w = weeks[i], tip = U.shortName(r.s.name) + ' · T' + w.num + ' (' + U.fmtDate(w.start, 'dm') + ' – ' + U.fmtDate(w.endISO, 'dm') + ') · ' + (c.n ? fmtH(c.h) + 'g · ' + c.n + ' sự kiện' + (c.level === 5 ? ' · vượt 10g' : '') : 'không có sự kiện');
            return h`<td class="pj-alloc__cell"><span class="heat pj-heat" data-level="${c.level}" data-tip="${tip}">${c.n ? h`${fmtH(c.h)}<span class="sr-only">g · ${c.n} sự kiện${c.level === 5 ? ' · vượt 10g' : ''}</span>` : h`<span aria-hidden="true">·</span><span class="sr-only">không có sự kiện</span>`}</span></td>`;
          })}<td class="num pj-alloc__tot">${r.n ? fmtH(r.total) + 'g' : '·'}</td></tr>`;
        })}</tbody>
        <tfoot><tr><td class="pj-alloc__who"><b>Tổng</b></td>${colTotals.map(function (t) { return h`<td class="num">${t ? fmtH(t) + 'g' : '·'}</td>`; })}<td class="num"><b>${fmtH(grand)}g</b></td></tr></tfoot></table></div>
    </section>`;
  };

  /* ---- Ghi chú */
  ProjectsView.prototype.notesHtml = function (p) {
    var list = p.checklist || [], done = list.filter(function (c) { return c.done; }).length;
    return h`<div class="pj-notes-grid">
      <section class="card pj-notes"><div class="card__head"><div><div class="card__eyebrow">Ghi chú</div><div class="card__title">Sổ tay dự án</div></div><span class="pj-saved${p.notes ? ' is-on is-saved' : ''}" role="status" aria-live="polite">${p.notes ? h`${icon('check', 13)}<span>Đã lưu</span>` : ''}</span></div>
        <textarea class="input textarea pj-notes__ta" rows="12" placeholder="Brief tóm tắt, quyết định với khách hàng, link tài liệu, call sheet…" aria-label="Ghi chú dự án">${p.notes || ''}</textarea>
        <div class="pj-notes__foot"><span class="muted">Tự động lưu sau khi bạn ngừng gõ 0,6 giây.</span><span class="muted mono-sm" data-notes-len>${(p.notes || '').length} ký tự</span></div>
      </section>
      <section class="card pj-check"><div class="card__head"><div><div class="card__eyebrow">Việc cần làm</div><div class="card__title">Checklist</div></div><b class="pj-check__count mono">${done}/${list.length}</b></div>
        <span class="progress progress--xs pj-check__prog" style="--bar:var(--pc)" role="progressbar" aria-valuenow="${U.percent(done, list.length)}" aria-valuemin="0" aria-valuemax="100"><span class="progress__bar" style="width:${U.percent(done, list.length)}%"></span></span>
        <ul class="pj-check__list"></ul>
        <form class="pj-check__add"><input class="input" type="text" placeholder="Thêm việc… rồi nhấn Enter" aria-label="Việc mới" maxlength="120" autocomplete="off"><button class="btn btn--soft" type="submit">${icon('plus', 16)}<span>Thêm</span></button></form>
      </section></div>`;
  };
  ProjectsView.prototype.renderChecklist = function () {
    var p = S().project(this.id), panel = this.els.panel; if (!p || !panel) return;
    var ul = panel.querySelector('.pj-check__list'); if (!ul) return;
    var list = p.checklist || [], done = list.filter(function (c) { return c.done; }).length;
    U.render(ul, list.length ? h`${list.map(function (c, i) { return h`<li class="pj-ci${c.done ? ' is-done' : ''}" data-i="${i}"><button type="button" class="pj-ci__box" role="checkbox" aria-checked="${!!c.done}" aria-label="${c.done ? 'Bỏ đánh dấu' : 'Đánh dấu xong'}: ${c.text}">${icon('check', 13)}</button><span class="pj-ci__txt">${c.text}</span><button type="button" class="icon-btn icon-btn--sm pj-ci__rm" aria-label="Xoá việc: ${c.text}">${icon('x', 14)}</button></li>`; })}` : '<li class="pj-check__empty muted">Chưa có việc nào — thêm việc đầu tiên bên dưới.</li>');
    this.updateCheckSummary(done, list.length);
  };
  ProjectsView.prototype.updateCheckSummary = function (done, total) {
    var panel = this.els.panel; if (!panel) return;
    var c = panel.querySelector('.pj-check__count'), pr = panel.querySelector('.pj-check__prog');
    if (c) c.textContent = done + '/' + total;
    if (pr) { pr.setAttribute('aria-valuenow', U.percent(done, total)); pr.querySelector('.progress__bar').style.width = U.percent(done, total) + '%'; }
  };

  /* ---------------------------------------------------------- actions */
  ProjectsView.prototype.act = function (act, el) {
    var st = S(), p = this.id ? st.project(this.id) : null, self = this;
    switch (act) {
      case 'new': E().project(); break;
      case 'clear': this.F.q = ''; this.setFilter({ status: '', mine: false, client: '' }); break;
      case 'edit': if (p) E().project(p); break;
      case 'add-event': if (p) E().event(null, { projectId: p.id, attendeeIds: (p.memberIds || []).slice(0, 4) }); break;
      case 'shoot': if (p) { var prod = st.staffByTeam('production').map(function (s) { return s.id; }); E().event(null, { type: 'shoot', projectId: p.id, start: '06:00', end: '18:00', attendeeIds: U.uniq(prod.concat([p.leadId])), title: 'Quay ' + p.client, location: '' }); } break;
      case 'more': if (p && el) this.openMenu(el, p); break;
      case 'tab-timeline': this.goTab('timeline'); break;
    }
    void self;
  };
  ProjectsView.prototype.openMenu = function (anchor, p) {
    var st = S(), self = this, done = p.status === 'done';
    UI.menu(anchor, [
      { label: 'Đánh dấu hoàn thành', icon: 'check-circle', disabled: done, onClick: function () { self.markDone(p); } },
      { label: 'Mở lại dự án', icon: 'refresh', disabled: !done, onClick: function () { st.updateProject(p.id, { status: 'active', progress: Math.min(p.progress, 90) }); UI.toast('Đã mở lại ' + p.client + ' — ' + p.name, { kind: 'info' }); } },
      { label: 'Nhân bản', icon: 'copy', onClick: function () { self.duplicate(p); } },
      { divider: true },
      { label: 'Xem trên lịch tuần', icon: 'calendar', onClick: function () { Z15.router.go('calendar/week/' + (p.start > self.todayISO ? p.start : self.todayISO)); } }
    ], { placement: 'bottom-end' });
  };
  ProjectsView.prototype.markDone = function (p) {
    var st = S(), me = st.me();
    st.updateProject(p.id, { status: 'done', progress: 100 });
    var head = this.els.head;
    if (head && !reduceMotion()) { head.classList.remove('celebrate'); void head.offsetWidth; head.classList.add('celebrate'); setTimeout(function () { head.classList.remove('celebrate'); }, 720); }
    UI.toast(p.client + ' — ' + p.name + ' đã được đánh dấu hoàn thành.', { kind: 'brand', title: 'Chúc mừng cả đội!' });
    st.notify({ kind: 'success', title: 'Dự án hoàn thành: ' + p.client, body: p.name + ' được ' + U.shortName(me.name) + ' đánh dấu hoàn thành.', link: '#/projects/' + p.id });
  };
  ProjectsView.prototype.duplicate = function (p) {
    var st = S(), len = Math.max(1, U.daysBetween(p.start, p.end));
    var np = st.addProject({ name: p.name + ' (bản sao)', client: p.client, color: p.color, status: 'planning', progress: 0, start: this.todayISO, end: U.toISO(U.addDays(U.today(), len)), leadId: p.leadId, memberIds: (p.memberIds || []).slice(), tags: (p.tags || []).slice(), budget: p.budget || '' });
    UI.toast('Đã nhân bản thành “' + np.name + '”', { kind: 'success' });
    Z15.router.go('projects/' + np.id);
  };

  /* progress slider */
  ProjectsView.prototype.onSlide = function (el) {
    var self = this, st = S(), p = st.project(this.id); if (!p) return;
    var v = U.clamp(+el.value || 0, 0, 100), tmp = Object.assign({}, p, { progress: v }), hl = st.projectHealth(tmp), panel = this.els.panel;
    var val = panel.querySelector('[data-prog-val]'), delta = panel.querySelector('[data-prog-delta]'), stepsBox = panel.querySelector('[data-steps]'), pt = panel.querySelector('[data-phase-title]'), pp = panel.querySelector('[data-phase-pct]');
    if (val) val.textContent = String(v); if (delta) delta.textContent = progDelta(tmp, hl);
    if (stepsBox) U.render(stepsBox, steps(tmp, true));
    if (pt) pt.textContent = 'Đang ở ' + PHASES[Math.min(phaseIndex(tmp), 4)].label; if (pp) pp.textContent = String(v);
    clearTimeout(this.slideTimer);
    this.slideTimer = setTimeout(function () { self.commitSlide(v); }, 300);
  };
  ProjectsView.prototype.commitSlide = function (v) {
    clearTimeout(this.slideTimer);
    var st = S(), p = st.project(this.id); if (!p || p.progress === v) return;
    this.selfKind = 'progress';
    st.updateProject(p.id, { progress: v });
  };

  /* notes */
  ProjectsView.prototype.onNotesInput = function (el) {
    var self = this, panel = this.els.panel, ind = panel && panel.querySelector('.pj-saved'), len = panel && panel.querySelector('[data-notes-len]');
    if (len) len.textContent = el.value.length + ' ký tự';
    if (ind) { ind.className = 'pj-saved is-on'; ind.innerHTML = UI.icon('edit', 13) + '<span>Đang gõ…</span>'; }
    this.pendingNotes = el.value;
    clearTimeout(this.notesTimer);
    this.notesTimer = setTimeout(function () { self.flushNotes(); }, 600);
  };
  ProjectsView.prototype.flushNotes = function () {
    clearTimeout(this.notesTimer);
    if (this.pendingNotes == null || !this.id) return;
    var st = S(), p = st.project(this.id), text = this.pendingNotes; this.pendingNotes = null;
    if (!p || (p.notes || '') === text) return;
    this.selfKind = 'notes';
    st.updateProject(p.id, { notes: text });
    var ind = this.els.panel && this.els.panel.querySelector('.pj-saved');
    if (ind) { var n = new Date(); ind.className = 'pj-saved is-on is-saved'; ind.innerHTML = UI.icon('check', 13) + '<span>Đã lưu ' + U.pad(n.getHours()) + ':' + U.pad(n.getMinutes()) + '</span>'; }
  };

  /* checklist */
  ProjectsView.prototype.saveChecklist = function (list) { this.selfKind = 'checklist'; S().updateProject(this.id, { checklist: list }); };
  ProjectsView.prototype.addCheck = function (form) {
    var st = S(), p = st.project(this.id), input = form.querySelector('input'); if (!p) return;
    var text = input.value.trim();
    if (!text) { form.classList.remove('shake'); void form.offsetWidth; form.classList.add('shake'); input.focus(); return; }
    this.saveChecklist((p.checklist || []).concat([{ text: text, done: false }]));
    input.value = ''; this.renderChecklist(); this.renderTabs(); input.focus();
    var last = this.els.panel.querySelector('.pj-ci:last-child'); if (last && !reduceMotion()) last.classList.add('pj-enter');
  };
  ProjectsView.prototype.toggleCheck = function (i) {
    var st = S(), p = st.project(this.id); if (!p) return;
    var list = (p.checklist || []).map(function (c) { return { text: c.text, done: !!c.done }; }); if (!list[i]) return;
    list[i].done = !list[i].done;
    var li = this.els.panel.querySelector('.pj-ci[data-i="' + i + '"]');
    if (li) { li.classList.toggle('is-done', list[i].done); var box = li.querySelector('.pj-ci__box'); box.setAttribute('aria-checked', String(list[i].done)); }
    this.updateCheckSummary(list.filter(function (c) { return c.done; }).length, list.length);
    this.saveChecklist(list); this.renderTabs();
    if (list.length && list.every(function (c) { return c.done; })) UI.toast('Checklist đã xong toàn bộ — tuyệt vời!', { kind: 'success' });
  };
  ProjectsView.prototype.removeCheck = function (i) {
    var st = S(), p = st.project(this.id); if (!p) return;
    var list = (p.checklist || []).slice(); if (!list[i]) return;
    var removed = list.splice(i, 1)[0], self = this;
    this.saveChecklist(list); this.renderChecklist(); this.renderTabs();
    UI.toast('Đã xoá “' + removed.text + '”', { kind: 'info', action: { label: 'Hoàn tác', onClick: function () { var cur = (S().project(self.id) || {}).checklist || []; var back = cur.slice(); back.splice(Math.min(i, back.length), 0, removed); self.saveChecklist(back); self.renderChecklist(); self.renderTabs(); } } });
  };

  /* ------------------------------------------------------------- store */
  ProjectsView.prototype.onStore = function (meta) {
    var t = meta.type || '';
    if (t === 'reset') { this.todayISO = U.todayISO(); this.kpiPrev = {}; this.rerender(); return; }
    var isProj = t.indexOf('project:') === 0, isEv = t.indexOf('event:') === 0;
    if (!isProj && !isEv) return;
    if (this.selfKind) {
      var k = this.selfKind; this.selfKind = null;
      if (k === 'progress') { this.renderHead(); this.setDetailTitle(); }
      return;
    }
    if (this.mode === 'list') {
      if (t === 'project:add' && meta.id) {
        var np = S().project(meta.id);
        if (np && this.filtered(false).indexOf(np) < 0) { this.F.q = ''; this.setFilter({ status: '', mine: false, client: '' }); UI.toast('Đã bỏ bộ lọc để hiện dự án vừa tạo.', { kind: 'info' }); return; }
      }
      this.renderKpis(false); this.renderClientOptions(); this.renderStatusChips(); this.renderResults(''); this.setListTitle(); return;
    }
    if (this.mode === 'detail') {
      if (isProj && meta.id && meta.id !== this.id) return;
      var p = S().project(this.id);
      if (!p || !this.els.head) { this.mode = null; this.showDetail(this.id, this.tab, false); return; }
      this.renderHead(); this.renderTabs();
      if (!(this.tab === 'notes' && isEv)) this.renderPanel(false);
      this.setDetailTitle(p);
    }
  };

  /* -------------------------------------------------------------- bind */
  ProjectsView.prototype.bind = function () {
    var self = this, r = this.root, go = function (id) { Z15.router.go('projects/' + id); };
    this.unbinders.push(
      U.delegate(r, 'click', '[data-act]', function (e, el) { e.preventDefault(); self.act(el.dataset.act, el); }),
      U.delegate(r, 'click', '.pj-card .avatar[data-staff]', function (e) { e.preventDefault(); }),
      U.delegate(r, 'click', '[data-status-chip]', function (e, el) { self.setFilter({ status: el.dataset.statusChip }); }),
      U.delegate(r, 'click', '[data-kpi-status]', function (e, el) { var s = el.dataset.kpiStatus; self.setFilter({ status: self.F.status === s ? '' : s }); }),
      U.delegate(r, 'click', '.pj-mine', function () { self.setFilter({ mine: !self.F.mine }); }),
      U.delegate(r, 'change', '.pj-bar__client select', function (e, el) { self.setFilter({ client: el.value }); }),
      U.delegate(r, 'change', '.pj-bar__sort select', function (e, el) { self.setFilter({ sort: el.value }); }),
      U.delegate(r, 'input', '.pj-bar__search input', U.debounce(function (e, el) { if (self.mode !== 'list') return; self.F.q = el.value.slice(0, 60); self.renderStatusChips(); self.renderResults(''); }, 160)),
      U.delegate(r, 'keydown', '.pj-bar__search input', function (e, el) { if (e.key === 'Escape' && el.value) { el.value = ''; self.F.q = ''; self.renderStatusChips(); self.renderResults(''); } }),
      U.delegate(r, 'click', '.pj-row', function (e, el) { if (e.target.closest('.avatar[data-staff], a.pj-row__id')) return; go(el.dataset.id); }),
      U.delegate(r, 'keydown', '.pj-row', function (e, el) { if (e.target !== el) return; if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); go(el.dataset.id); } }),
      U.delegate(r, 'click', '.pj-tab', function (e, el) { self.goTab(el.dataset.tab); }),
      U.delegate(r, 'keydown', '.pj-tabs', function (e) { if (e.key !== 'ArrowRight' && e.key !== 'ArrowLeft') return; var i = TABS.findIndex(function (t) { return t.id === self.tab; }); var n = (i + (e.key === 'ArrowRight' ? 1 : -1) + TABS.length) % TABS.length; e.preventDefault(); self.goTab(TABS[n].id); setTimeout(function () { var b = r.querySelector('.pj-tab.is-active'); if (b) b.focus(); }, 30); }),
      U.delegate(r, 'click', '.pj-member', function (e, el) { if (e.target.closest('.avatar[data-staff]')) return; E().staffProfile(el.dataset.staff); }),
      U.delegate(r, 'click', '.pj-gbar, .pj-ms__row[data-event]', function (e, el) { E().eventDetail(el.dataset.event); }),
      U.delegate(r, 'input', '.pj-range', function (e, el) { self.onSlide(el); }),
      U.delegate(r, 'change', '.pj-range', function (e, el) { self.commitSlide(U.clamp(+el.value || 0, 0, 100)); }),
      U.delegate(r, 'input', '.pj-notes__ta', function (e, el) { self.onNotesInput(el); }),
      U.delegate(r, 'blur', '.pj-notes__ta', function () { self.flushNotes(); }),
      U.delegate(r, 'submit', '.pj-check__add', function (e, el) { e.preventDefault(); self.addCheck(el); }),
      U.delegate(r, 'click', '.pj-ci__box', function (e, el) { self.toggleCheck(+el.closest('.pj-ci').dataset.i); }),
      U.delegate(r, 'click', '.pj-ci__rm', function (e, el) { self.removeCheck(+el.closest('.pj-ci').dataset.i); })
    );
  };

  ProjectsView.prototype.destroy = function () {
    this.flushNotes();
    clearTimeout(this.slideTimer); clearTimeout(this.notesTimer);
    if (this.unsub) this.unsub();
    (this.keys || []).forEach(function (f) { f && f(); });
    this.unbinders.forEach(function (f) { f && f(); });
    this.timers.forEach(function (t) { clearInterval(t); });
    UI.palette.unregister('projects:mine');
  };

  Z15.views.projects = {
    title: 'Dự án',
    render: function (container, route) { return new ProjectsView(container, route); }
  };
})(window);
