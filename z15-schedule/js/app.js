/* =====================================================================
   Z15 Miracle · Lịch làm việc — app.js
   Khung ứng dụng: router hash, sidebar, topbar, theme, thông báo,
   command palette, phím tắt, chuyển trang, splash.
   ===================================================================== */
(function (global) {
  'use strict';
  var Z15 = global.Z15 = global.Z15 || {};
  var U = Z15.utils, UI = Z15.ui, S = Z15.store, E = Z15.editors;
  Z15.views = Z15.views || {};

  var NAV = [
    { id: 'dashboard', label: 'Hôm nay', icon: 'home', shortcut: 'g d', desc: 'Hôm nay của bạn & nhịp đội' },
    { id: 'calendar', label: 'Lịch', icon: 'calendar-days', shortcut: 'g c', desc: 'Lịch tuần, tháng, ngày' },
    { id: 'roster', label: 'Bảng ca', icon: 'grid', shortcut: 'g r', desc: 'Bảng ca nhân sự × ngày' },
    { id: 'staff', label: 'Đội ngũ', icon: 'users', shortcut: 'g s', desc: 'Danh bạ & tải công việc' },
    { id: 'projects', label: 'Dự án', icon: 'briefcase', shortcut: 'g p', desc: 'Chiến dịch & tiến độ' },
    { id: 'requests', label: 'Yêu cầu', icon: 'inbox', shortcut: 'g q', desc: 'Nghỉ phép, remote, OT, đổi ca', badge: function () { return S.pendingRequests().length; } }
  ];

  /* --------------------------------------------------------------- router */
  var R = Z15.router = {
    parse: function (hash) {
      var h = (hash || location.hash || '#/dashboard').replace(/^#\/?/, '');
      var qi = h.indexOf('?'), query = {};
      var dec = function (x) { try { return decodeURIComponent(x); } catch (e) { return x; } };
      if (qi >= 0) { h.slice(qi + 1).split('&').forEach(function (kv) { if (!kv) return; var p = kv.split('='); query[dec(p[0])] = dec(p[1] || ''); }); h = h.slice(0, qi); }
      var parts = h.split('/').filter(Boolean);
      var view = parts.shift() || 'dashboard';
      if (!Z15.views[view]) { view = 'dashboard'; parts = []; }
      return { view: view, parts: parts, query: query, path: h };
    },
    go: function (path, query) {
      var q = query ? '?' + Object.keys(query).filter(function (k) { return query[k] != null && query[k] !== ''; }).map(function (k) { return encodeURIComponent(k) + '=' + encodeURIComponent(query[k]); }).join('&') : '';
      location.hash = '#/' + path.replace(/^#?\/?/, '') + (q === '?' ? '' : q);
    },
    current: null
  };

  var els = {};
  var currentView = null, currentName = null, transitioning = false;

  function mountView(route, opts) {
    opts = opts || {};
    var name = route.view, def = Z15.views[name];
    var container = els.view;
    var sameView = currentName === name && currentView && typeof currentView.update === 'function';
    R.current = route;
    setActiveNav(name);
    document.title = def.title + ' · Z15 Miracle';
    if (sameView) { currentView.update(route); return; }
    var reduce = U.prefersReducedMotion();
    function swap() {
      if (currentView && typeof currentView.destroy === 'function') { try { currentView.destroy(); } catch (e) { console.error(e); } }
      container.innerHTML = '';
      els.actions.innerHTML = '';
      container.className = 'view view--' + name;
      container.scrollTop = 0;
      var ctx = { container: container, route: route, app: App };
      try { currentView = def.render(container, route, ctx) || def; currentName = name; }
      catch (e) { console.error(e); container.innerHTML = UI.empty({ icon: 'alert-triangle', title: 'Không thể hiển thị trang này', body: String(e && e.message || e) }); currentView = null; currentName = null; }
      UI.reveal(container);
      requestAnimationFrame(function () { container.classList.add('is-entering'); requestAnimationFrame(function () { container.classList.remove('is-entering'); container.classList.add('is-in'); }); });
      transitioning = false;
    }
    if (currentName && !reduce && !opts.immediate) {
      transitioning = true; container.classList.add('is-leaving');
      setTimeout(swap, 130);
    } else swap();
  }

  var lastHash = null;
  function onRoute() {
    var route = R.parse();
    // Bỏ qua hashchange "rỗng" (vd. location.replace lúc boot) nhưng vẫn cho phép bấm lại menu để về mặc định của view
    var same = location.hash === lastHash && R.current && R.current.path === route.path && JSON.stringify(R.current.query) === JSON.stringify(route.query);
    lastHash = location.hash;
    if (same) return;
    mountView(route); closeMobileNav();
  }

  /* ------------------------------------------------------------ sidebar */
  function renderNav() {
    els.nav.innerHTML = NAV.map(function (n) {
      return '<a class="nav-item" href="#/' + n.id + '" data-view="' + n.id + '" data-label="' + U.escapeHtml(n.label) + '" data-tip-pos="right"><span class="nav-item__icon">' + UI.icon(n.icon, 20) + '</span><span class="nav-item__label">' + n.label + '</span><span class="nav-item__badge" hidden></span><span class="nav-item__kbd" aria-hidden="true">' + UI.kbd(n.shortcut) + '</span></a>';
    }).join('');
    updateBadges();
  }
  function setActiveNav(name) {
    U.qsa('.nav-item', els.nav).forEach(function (a) { var on = a.dataset.view === name; a.classList.toggle('is-active', on); if (on) a.setAttribute('aria-current', 'page'); else a.removeAttribute('aria-current'); });
    var ind = els.navInd, a = els.nav.querySelector('.nav-item.is-active');
    if (ind && a) { ind.style.transform = 'translateY(' + a.offsetTop + 'px)'; ind.style.height = a.offsetHeight + 'px'; ind.classList.add('is-on'); }
  }
  function updateBadges() {
    NAV.forEach(function (n) {
      if (!n.badge) return;
      var b = els.nav.querySelector('[data-view="' + n.id + '"] .nav-item__badge'); if (!b) return;
      var v = n.badge(); b.textContent = v; b.hidden = !v; b.setAttribute('aria-label', v + ' yêu cầu chờ duyệt');
    });
    var unread = S.unreadCount();
    els.bellCount.textContent = unread > 9 ? '9+' : unread; els.bellCount.hidden = !unread;
    els.bell.setAttribute('aria-label', unread ? 'Thông báo, ' + unread + ' chưa đọc' : 'Thông báo');
    els.bell.classList.toggle('has-unread', unread > 0);
  }
  function setCollapsed(v, persist) {
    document.body.classList.toggle('sidebar-collapsed', !!v);
    document.documentElement.classList.remove('pre-collapsed');
    U.qsa('.nav-item', els.nav).forEach(function (a) { if (v) a.dataset.tip = a.dataset.label; else delete a.dataset.tip; });
    els.collapse.setAttribute('aria-expanded', v ? 'false' : 'true');
    els.collapse.dataset.tip = v ? 'Mở rộng menu' : 'Thu gọn menu';
    if (persist) S.setSetting('sidebarCollapsed', !!v);
    setTimeout(function () { setActiveNav(R.current ? R.current.view : 'dashboard'); }, 260);
  }
  function openMobileNav() { document.body.classList.add('nav-open'); els.menuBtn.setAttribute('aria-expanded', 'true'); var a = els.nav.querySelector('.is-active') || els.nav.firstElementChild; if (a) setTimeout(function () { a.focus({ preventScroll: true }); }, 60); }
  function closeMobileNav(refocus) { if (!document.body.classList.contains('nav-open')) return; document.body.classList.remove('nav-open'); els.menuBtn.setAttribute('aria-expanded', 'false'); if (refocus) els.menuBtn.focus(); }
  document.addEventListener('keydown', function (e) { if (e.key === 'Escape' && document.body.classList.contains('nav-open')) { e.preventDefault(); closeMobileNav(true); } });

  /* --------------------------------------------------------------- theme */
  var mq = window.matchMedia ? window.matchMedia('(prefers-color-scheme: dark)') : null;
  function applyTheme() {
    var t = S.state.settings.theme || 'system';
    var dark = t === 'dark' || (t === 'system' && mq && mq.matches);
    document.documentElement.dataset.theme = dark ? 'dark' : 'light';
    document.documentElement.dataset.themePref = t;
    var meta = document.querySelector('meta[name="theme-color"]'); if (meta) meta.setAttribute('content', dark ? '#0E1015' : '#F7F7F5');
    els.themeBtn.innerHTML = '<span class="theme-icon theme-icon--sun">' + UI.icon('sun', 18) + '</span><span class="theme-icon theme-icon--moon">' + UI.icon('moon', 18) + '</span>';
    els.themeBtn.dataset.tip = dark ? 'Chuyển sang giao diện sáng' : 'Chuyển sang giao diện tối';
    document.body.dataset.density = S.state.settings.density || 'comfortable';
    document.body.classList.toggle('reduce-motion', !!S.state.settings.reduceMotion);
  }
  function toggleTheme(e) {
    var dark = document.documentElement.dataset.theme === 'dark';
    var next = dark ? 'light' : 'dark';
    // Hiệu ứng lan toả từ vị trí nút (View Transitions nếu có)
    var x = e && e.clientX ? e.clientX : window.innerWidth - 80, y = e && e.clientY ? e.clientY : 32;
    document.documentElement.style.setProperty('--vt-x', x + 'px'); document.documentElement.style.setProperty('--vt-y', y + 'px');
    if (document.startViewTransition && !U.prefersReducedMotion()) document.startViewTransition(function () { S.setSetting('theme', next); applyTheme(); });
    else { S.setSetting('theme', next); applyTheme(); }
  }
  if (mq && mq.addEventListener) mq.addEventListener('change', function () { if (S.state.settings.theme === 'system') applyTheme(); });

  /* ---------------------------------------------------------------- clock */
  function tickClock() {
    var n = new Date();
    els.clock.textContent = U.pad(n.getHours()) + ':' + U.pad(n.getMinutes());
    els.date.textContent = U.fmtDate(n, 'long');
  }

  /* -------------------------------------------------------- notifications */
  var KIND_ICON = { info: 'info', success: 'check-circle', warning: 'alert-triangle', brand: 'sparkles' };
  function openNotifications() {
    var list = S.state.notifications;
    var html = '<div class="notif"><div class="notif__head"><b>Thông báo</b>' + (S.unreadCount() ? '<button class="link-btn" data-all>Đánh dấu đã đọc tất cả</button>' : '') + '</div><div class="notif__list">' +
      (list.length ? list.slice(0, 12).map(function (n) { return '<button class="notif__item' + (n.read ? '' : ' is-unread') + '" data-id="' + n.id + '" data-kind="' + n.kind + '"><span class="notif__icon">' + UI.icon(KIND_ICON[n.kind] || 'info', 16) + '</span><span class="notif__txt"><b>' + U.escapeHtml(n.title) + '</b><small>' + U.escapeHtml(n.body) + '</small><time>' + U.timeAgo(n.time) + '</time></span><i class="notif__dot"></i></button>'; }).join('') : UI.empty({ icon: 'bell', title: 'Không có thông báo' })) + '</div></div>';
    var pop = UI.popover(els.bell, html, { placement: 'bottom-end', cls: 'popover--notif', width: 380 });
    pop.el.addEventListener('click', function (e) {
      if (e.target.closest('[data-all]')) { S.markAllRead(); pop.close(); UI.toast('Đã đánh dấu tất cả là đã đọc', { kind: 'success' }); return; }
      var it = e.target.closest('.notif__item'); if (!it) return;
      var n = S.state.notifications.find(function (x) { return x.id === it.dataset.id; });
      S.markRead(it.dataset.id); pop.close();
      if (n && n.link) location.hash = n.link;
    });
  }

  /* ------------------------------------------------------------ settings */
  function openSettings() {
    var s = S.state.settings;
    var content = U.el('div', { class: 'settings' });
    content.innerHTML = '<div class="settings__row"><div><b>Giao diện</b><small>Sáng, tối hoặc theo hệ thống</small></div><div class="slot-theme"></div></div>' +
      '<div class="settings__row"><div><b>Mật độ hiển thị</b><small>Thoải mái hay gọn gàng</small></div><div class="slot-density"></div></div>' +
      '<div class="settings__row"><div><b>Giảm chuyển động</b><small>Tắt animation trang trí</small></div><label class="switch"><input type="checkbox" class="rm" aria-label="Giảm chuyển động"' + (s.reduceMotion ? ' checked' : '') + '><span class="switch__track"></span></label></div>' +
      '<div class="settings__row"><div><b>Hiển thị cuối tuần</b><small>Trong lịch tuần & bảng ca</small></div><label class="switch"><input type="checkbox" class="wk" aria-label="Hiển thị cuối tuần"' + (s.showWeekend !== false ? ' checked' : '') + '><span class="switch__track"></span></label></div>' +
      '<div class="settings__row settings__row--danger"><div><b>Dữ liệu mẫu</b><small>Đặt lại toàn bộ dữ liệu về trạng thái ban đầu</small></div><button class="btn btn--ghost-danger btn--sm reset">' + UI.icon('refresh', 15) + 'Đặt lại</button></div>' +
      '<div class="settings__foot muted">Dữ liệu được lưu cục bộ trên trình duyệt này (localStorage). Phiên bản 1.0 · Z15 Miracle Việt Nam</div>';
    content.querySelector('.slot-theme').appendChild(UI.segmented([{ value: 'light', label: 'Sáng', icon: 'sun' }, { value: 'dark', label: 'Tối', icon: 'moon' }, { value: 'system', label: 'Hệ thống', icon: 'monitor' }], s.theme || 'system', function (v) { S.setSetting('theme', v); applyTheme(); }, { label: 'Giao diện' }));
    content.querySelector('.slot-density').appendChild(UI.segmented([{ value: 'comfortable', label: 'Thoải mái' }, { value: 'compact', label: 'Gọn' }], s.density || 'comfortable', function (v) { S.setSetting('density', v); applyTheme(); }, { label: 'Mật độ hiển thị' }));
    content.querySelector('.rm').addEventListener('change', function (e) { S.setSetting('reduceMotion', e.target.checked); applyTheme(); });
    content.querySelector('.wk').addEventListener('change', function (e) { S.setSetting('showWeekend', e.target.checked); });
    content.querySelector('.reset').addEventListener('click', function () {
      UI.confirm({ title: 'Đặt lại dữ liệu mẫu?', message: 'Mọi thay đổi bạn đã tạo (sự kiện, ca, yêu cầu…) sẽ bị xoá và thay bằng dữ liệu mẫu mới.', confirmLabel: 'Đặt lại', danger: true, icon: 'refresh' }).then(function (ok) {
        if (!ok) return; S.reset(); UI.closeAllLayers(); applyTheme(); mountView(R.parse(), { immediate: true }); updateBadges(); UI.toast('Đã đặt lại dữ liệu mẫu', { kind: 'brand' });
      });
    });
    UI.modal({ title: 'Cài đặt', size: 'md', content: content, actions: [{ label: 'Xong', kind: 'primary' }] });
  }

  function openUserMenu() {
    var me = S.me();
    UI.menu(els.user, [
      { heading: me.name + ' · ' + me.role },
      { label: 'Hồ sơ của tôi', icon: 'user', onClick: function () { E.staffProfile(me.id); } },
      { label: 'Lịch của tôi', icon: 'calendar', onClick: function () { R.go('calendar', { staff: me.id }); } },
      { label: 'Gửi yêu cầu nghỉ / remote', icon: 'send', onClick: function () { E.request(); } },
      { divider: true },
      { label: 'Cài đặt', icon: 'settings', onClick: openSettings },
      { label: 'Phím tắt', icon: 'keyboard', hint: '?', onClick: E.shortcutsHelp },
      { divider: true },
      { label: 'Đăng xuất', icon: 'log-out', onClick: function () { UI.toast('Đây là bản demo — không có đăng nhập thật 😉', { kind: 'info' }); } }
    ], { placement: 'bottom-end' });
  }

  /* ------------------------------------------------- palette & shortcuts */
  function registerCommands() {
    NAV.forEach(function (n) {
      UI.palette.register({ id: 'nav:' + n.id, label: 'Đi tới ' + n.label, hint: n.desc, icon: n.icon, section: 'Điều hướng', shortcut: n.shortcut, keywords: n.id, run: function () { location.hash = '#/' + n.id; } });
      UI.shortcuts.register(n.shortcut, function () { location.hash = '#/' + n.id; }, 'Đi tới ' + n.label, 'Điều hướng');
    });
    UI.palette.register({ id: 'act:new-event', label: 'Tạo sự kiện mới', hint: 'Họp, quay, deadline…', icon: 'plus-circle', section: 'Hành động', shortcut: 'n', run: function () { E.event(); } });
    UI.palette.register({ id: 'act:new-request', label: 'Gửi yêu cầu nghỉ phép / remote / OT', icon: 'send', section: 'Hành động', shortcut: 'shift+r', keywords: 'nghi phep remote tang ca doi ca', run: function () { E.request(); } });
    UI.palette.register({ id: 'act:new-project', label: 'Tạo dự án mới', icon: 'briefcase', section: 'Hành động', run: function () { E.project(); } });
    UI.palette.register({ id: 'act:me', label: 'Hồ sơ của tôi', icon: 'user', section: 'Hành động', run: function () { E.staffProfile(S.state.currentUserId); } });
    UI.palette.register({ id: 'act:theme', label: 'Đổi giao diện sáng / tối', icon: 'moon', section: 'Hành động', shortcut: 'shift+d', keywords: 'dark light theme', run: function () { toggleTheme(); } });
    UI.palette.register({ id: 'act:settings', label: 'Mở cài đặt', icon: 'settings', section: 'Hành động', run: openSettings });
    UI.palette.register({ id: 'act:help', label: 'Xem phím tắt', icon: 'keyboard', section: 'Hành động', shortcut: '?', run: E.shortcutsHelp });
    UI.palette.register({ id: 'act:today', label: 'Về hôm nay trong lịch', icon: 'calendar', section: 'Hành động', shortcut: 't', run: function () { R.go('calendar/week/' + U.todayISO()); } });

    UI.shortcuts.register('mod+k', function () { UI.palette.open(); }, 'Tìm kiếm & lệnh nhanh', 'Chung');
    UI.shortcuts.register('/', function () { UI.palette.open(); }, 'Tìm kiếm', 'Chung');
    UI.shortcuts.register('n', function () { E.event(); }, 'Tạo sự kiện mới', 'Hành động');
    UI.shortcuts.register('shift+r', function () { E.request(); }, 'Gửi yêu cầu', 'Hành động');
    UI.shortcuts.register('shift+d', function () { toggleTheme(); }, 'Đổi giao diện sáng / tối', 'Hành động');
    UI.shortcuts.register('?', function () { E.shortcutsHelp(); }, 'Xem phím tắt', 'Chung');
    UI.shortcuts.register('t', function () {
      // View đang mở có thể tự xử lý 'hôm nay' (calendar/roster) bằng cách gọi e.preventDefault()
      var ev = new CustomEvent('z15:today', { cancelable: true }); document.dispatchEvent(ev);
      if (!ev.defaultPrevented && !(R.current && (R.current.view === 'calendar' || R.current.view === 'roster'))) R.go('calendar/week/' + U.todayISO());
    }, 'Về hôm nay', 'Lịch');
    UI.shortcuts.register('[', function () { setCollapsed(!document.body.classList.contains('sidebar-collapsed'), true); }, 'Thu gọn / mở rộng menu', 'Chung');
  }
  /* --------------------------------------------------------------- boot */
  var App = Z15.app = {
    go: R.go, route: function () { return R.current; }, mountView: function () { mountView(R.parse(), { immediate: true }); }, updateBadges: updateBadges, openSettings: openSettings, toggleTheme: toggleTheme, NAV: NAV,
    setTitle: function (title, sub) { els.title.textContent = title || ''; els.sub.textContent = sub || ''; },
    setActions: function (node) { els.actions.innerHTML = ''; if (node) U.append(els.actions, node); }
  };

  function boot() {
    S.init();
    els = {
      view: U.qs('#view'), nav: U.qs('#nav'), navInd: U.qs('#navInd'), collapse: U.qs('#collapseBtn'), menuBtn: U.qs('#menuBtn'), scrim: U.qs('#navScrim'),
      themeBtn: U.qs('#themeBtn'), clock: U.qs('#clock'), date: U.qs('#dateLabel'), bell: U.qs('#bellBtn'), bellCount: U.qs('#bellCount'), user: U.qs('#userBtn'), search: U.qs('#searchBtn'), newBtn: U.qs('#newBtn'),
      title: U.qs('#pageTitle'), sub: U.qs('#pageSub'), actions: U.qs('#pageActions'), splash: U.qs('#splash'), brand: U.qs('#brand')
    };
    var me = S.me();
    els.user.innerHTML = UI.avatar(me, { size: 'sm', status: true, title: false }) + '<span class="user-btn__txt"><b>' + U.escapeHtml(U.shortName(me.name)) + '</b><small>' + U.escapeHtml(me.role) + '</small></span>' + UI.icon('chevron-down', 14);
    els.user.setAttribute('data-no-profile', '');
    els.brand.innerHTML = UI.logoMark(30) + '<span class="brand__txt"><b>Z15 MIRACLE</b><small>Lịch làm việc</small></span>';

    renderNav(); applyTheme(); tickClock(); setInterval(tickClock, 15000);
    if (S.state.settings.sidebarCollapsed || (S.state.settings.sidebarCollapsed == null && window.innerWidth <= 1100 && window.innerWidth > 768)) setCollapsed(true, false); else setCollapsed(false, false);
    if (navigator.platform.indexOf('Mac') < 0) { var kb = els.search.querySelector('.search-btn__kbd'); if (kb) kb.innerHTML = UI.kbd('Ctrl K'); }
    registerCommands();

    els.collapse.addEventListener('click', function () { setCollapsed(!document.body.classList.contains('sidebar-collapsed'), true); });
    els.menuBtn.addEventListener('click', function () { document.body.classList.contains('nav-open') ? closeMobileNav() : openMobileNav(); });
    els.scrim.addEventListener('click', closeMobileNav);
    els.themeBtn.addEventListener('click', toggleTheme);
    els.bell.addEventListener('click', openNotifications);
    els.user.addEventListener('click', openUserMenu);
    els.search.addEventListener('click', function () { UI.palette.open(); });
    els.newBtn.addEventListener('click', function () {
      UI.menu(els.newBtn, [
        { label: 'Sự kiện / cuộc họp', icon: 'calendar', hint: 'N', onClick: function () { E.event(); } },
        { label: 'Lịch quay / chụp', icon: 'video', onClick: function () { E.event(null, { type: 'shoot', start: '06:00', end: '18:00' }); } },
        { label: 'Deadline', icon: 'flag', onClick: function () { E.event(null, { type: 'deadline', start: '18:00', end: '18:00' }); } },
        { divider: true },
        { label: 'Yêu cầu nghỉ / remote / OT', icon: 'send', hint: '⇧R', onClick: function () { E.request(); } },
        { label: 'Dự án mới', icon: 'briefcase', onClick: function () { E.project(); } }
      ], { placement: 'bottom-end' });
    });
    UI.bindEventPills(els.view); UI.bindAvatars(els.view);
    S.subscribe(function (state, meta) {
      updateBadges();
      if (meta.type === 'settings' && meta.key === 'showWeekend' && currentView && currentView.update) currentView.update(R.current);
      if ((meta.type === 'staff:status' || meta.type === 'staff:update' || meta.type === 'reset') && (!meta.id || meta.id === S.state.currentUserId)) { var dot = els.user.querySelector('.avatar__status'); if (dot) dot.dataset.status = S.me().status; }
    });
    window.addEventListener('hashchange', onRoute);
    window.addEventListener('resize', U.debounce(function () { setActiveNav(R.current ? R.current.view : 'dashboard'); }, 120));
    if (!location.hash) location.replace('#/dashboard');
    lastHash = location.hash;
    mountView(R.parse(), { immediate: true });

    // Splash: đợi font (tối đa 900ms) rồi rút màn
    var done = false;
    function hideSplash() { if (done) return; done = true; document.body.classList.add('is-ready'); els.splash.classList.add('is-done'); setTimeout(function () { els.splash.remove(); }, 900); }
    var minWait = new Promise(function (r) { setTimeout(r, U.prefersReducedMotion() ? 0 : 650); });
    var fonts = document.fonts && document.fonts.ready ? document.fonts.ready : Promise.resolve();
    Promise.all([minWait, Promise.race([fonts, new Promise(function (r) { setTimeout(r, 900); })])]).then(hideSplash);
    setTimeout(hideSplash, 2000);
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot); else boot();
})(window);
