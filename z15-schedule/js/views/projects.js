/* placeholder — sẽ được thay bằng view thật */
(function (global) {
  'use strict';
  var Z15 = global.Z15; Z15.views = Z15.views || {};
  Z15.views.projects = {
    title: 'Dự án',
    render: function (container, route) {
      Z15.app.setTitle('Dự án', 'Đang xây dựng');
      container.innerHTML = '<div class="card reveal"><div class="card__title">Dự án</div><p class="muted">View giữ chỗ.</p></div>';
    }
  };
})(window);
