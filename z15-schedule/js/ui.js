/* =====================================================================
   Z15 Miracle · Lịch làm việc — ui.js
   Primitives dùng chung: icon, avatar, chip, toast, modal, drawer,
   popover, menu, tooltip, command palette, phím tắt, reveal.
   ===================================================================== */
(function (global) {
  'use strict';
  var Z15 = global.Z15 = global.Z15 || {};
  var U = Z15.utils;
  var UI = Z15.ui = {};

  /* ---------------------------------------------------------------- icons */
  var ICONS = {
    'calendar': '<rect x="3" y="4" width="18" height="18" rx="2"/><path d="M16 2v4M8 2v4M3 10h18"/>',
    'calendar-days': '<rect x="3" y="4" width="18" height="18" rx="2"/><path d="M16 2v4M8 2v4M3 10h18M8 14h.01M12 14h.01M16 14h.01M8 18h.01M12 18h.01M16 18h.01"/>',
    'users': '<path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75"/>',
    'user': '<path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/>',
    'user-plus': '<path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M19 8v6M22 11h-6"/>',
    'video': '<path d="m22 8-6 4 6 4V8Z"/><rect x="2" y="6" width="14" height="12" rx="2"/>',
    'camera': '<path d="M14.5 4h-5L7 7H4a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2h-3l-2.5-3z"/><circle cx="12" cy="13" r="3"/>',
    'film': '<rect x="2" y="2" width="20" height="20" rx="2.18"/><path d="M7 2v20M17 2v20M2 12h20M2 7h5M2 17h5M17 17h5M17 7h5"/>',
    'flag': '<path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z"/><path d="M4 22v-7"/>',
    'presentation': '<path d="M2 3h20M21 3v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V3M7 21l5-5 5 5"/>',
    'eye': '<path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z"/><circle cx="12" cy="12" r="3"/>',
    'check': '<path d="M20 6 9 17l-5-5"/>',
    'check-circle': '<path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><path d="m9 11 3 3L22 4"/>',
    'check-square': '<path d="m9 11 3 3L22 4"/><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/>',
    'x': '<path d="M18 6 6 18M6 6l12 12"/>',
    'x-circle': '<circle cx="12" cy="12" r="10"/><path d="m15 9-6 6M9 9l6 6"/>',
    'book': '<path d="M4 19.5v-15A2.5 2.5 0 0 1 6.5 2H20v20H6.5a2.5 2.5 0 0 1 0-5H20"/>',
    'sparkles': '<path d="m12 3-1.9 5.8a2 2 0 0 1-1.3 1.3L3 12l5.8 1.9a2 2 0 0 1 1.3 1.3L12 21l1.9-5.8a2 2 0 0 1 1.3-1.3L21 12l-5.8-1.9a2 2 0 0 1-1.3-1.3Z"/><path d="M5 3v4M19 17v4M3 5h4M17 19h4"/>',
    'bell': '<path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9"/><path d="M10.3 21a1.94 1.94 0 0 0 3.4 0"/>',
    'search': '<circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/>',
    'sun': '<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M6.34 17.66l-1.41 1.41M19.07 4.93l-1.41 1.41"/>',
    'moon': '<path d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9Z"/>',
    'sunrise': '<path d="M12 2v8M4.93 10.93l1.41 1.41M2 18h2M20 18h2M19.07 10.93l-1.41 1.41M22 22H2M8 6l4-4 4 4M16 18a4 4 0 0 0-8 0"/>',
    'sunset': '<path d="M12 10V2M4.93 10.93l1.41 1.41M2 18h2M20 18h2M19.07 10.93l-1.41 1.41M22 22H2M16 6l-4 4-4-4M16 18a4 4 0 0 0-8 0"/>',
    'plus': '<path d="M5 12h14M12 5v14"/>',
    'plus-circle': '<circle cx="12" cy="12" r="10"/><path d="M8 12h8M12 8v8"/>',
    'minus': '<path d="M5 12h14"/>',
    'chevron-left': '<path d="m15 18-6-6 6-6"/>',
    'chevron-right': '<path d="m9 18 6-6-6-6"/>',
    'chevron-down': '<path d="m6 9 6 6 6-6"/>',
    'chevron-up': '<path d="m18 15-6-6-6 6"/>',
    'chevrons-left': '<path d="m11 17-5-5 5-5M18 17l-5-5 5-5"/>',
    'chevrons-right': '<path d="m6 17 5-5-5-5M13 17l5-5-5-5"/>',
    'more-horizontal': '<circle cx="12" cy="12" r="1"/><circle cx="19" cy="12" r="1"/><circle cx="5" cy="12" r="1"/>',
    'clock': '<circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/>',
    'history': '<path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/><path d="M3 3v5h5M12 7v5l4 2"/>',
    'map-pin': '<path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z"/><circle cx="12" cy="10" r="3"/>',
    'briefcase': '<rect x="2" y="7" width="20" height="14" rx="2"/><path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16"/>',
    'home': '<path d="m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><path d="M9 22V12h6v10"/>',
    'layout': '<rect x="3" y="3" width="7" height="9" rx="1"/><rect x="14" y="3" width="7" height="5" rx="1"/><rect x="14" y="12" width="7" height="9" rx="1"/><rect x="3" y="16" width="7" height="5" rx="1"/>',
    'grid': '<rect x="3" y="3" width="18" height="18" rx="2"/><path d="M3 9h18M3 15h18M9 3v18M15 3v18"/>',
    'columns': '<rect x="3" y="3" width="18" height="18" rx="2"/><path d="M12 3v18"/>',
    'panel-left': '<rect x="3" y="3" width="18" height="18" rx="2"/><path d="M9 3v18"/>',
    'list': '<path d="M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01"/>',
    'settings': '<path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z"/><circle cx="12" cy="12" r="3"/>',
    'sliders': '<path d="M4 21v-7M4 10V3M12 21v-9M12 8V3M20 21v-5M20 12V3M1 14h6M9 8h6M17 16h6"/>',
    'log-out': '<path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9"/>',
    'filter': '<path d="M22 3H2l8 9.46V19l4 2v-8.54L22 3z"/>',
    'arrow-right': '<path d="M5 12h14M12 5l7 7-7 7"/>',
    'arrow-left': '<path d="m12 19-7-7 7-7M19 12H5"/>',
    'arrow-up-right': '<path d="M7 7h10v10M7 17 17 7"/>',
    'arrow-down': '<path d="M12 5v14M19 12l-7 7-7-7"/>',
    'arrow-up': '<path d="M12 19V5M5 12l7-7 7 7"/>',
    'corner-down-left': '<path d="m9 10-5 5 5 5"/><path d="M20 4v7a4 4 0 0 1-4 4H4"/>',
    'edit': '<path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z"/>',
    'trash': '<path d="M3 6h18M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>',
    'copy': '<rect x="8" y="8" width="14" height="14" rx="2"/><path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2"/>',
    'download': '<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M7 10l5 5 5-5M12 15V3"/>',
    'mail': '<rect x="2" y="4" width="20" height="16" rx="2"/><path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7"/>',
    'phone': '<path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72c.127.96.361 1.903.7 2.81a2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0 1 22 16.92z"/>',
    'message': '<path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>',
    'alert-triangle': '<path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z"/><path d="M12 9v4M12 17h.01"/>',
    'alert-circle': '<circle cx="12" cy="12" r="10"/><path d="M12 8v4M12 16h.01"/>',
    'info': '<circle cx="12" cy="12" r="10"/><path d="M12 16v-4M12 8h.01"/>',
    'zap': '<path d="M13 2 3 14h9l-1 8 10-12h-9l1-8z"/>',
    'star': '<path d="m12 2 3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/>',
    'trending-up': '<path d="m22 7-8.5 8.5-5-5L2 17"/><path d="M16 7h6v6"/>',
    'activity': '<path d="M22 12h-4l-3 9L9 3l-3 9H2"/>',
    'bar-chart': '<path d="M3 3v18h18"/><path d="M18 17V9M13 17V5M8 17v-3"/>',
    'target': '<circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="6"/><circle cx="12" cy="12" r="2"/>',
    'layers': '<path d="m12.83 2.18a2 2 0 0 0-1.66 0L2.6 6.08a1 1 0 0 0 0 1.83l8.58 3.91a2 2 0 0 0 1.66 0l8.58-3.9a1 1 0 0 0 0-1.83Z"/><path d="m22 17.65-9.17 4.16a2 2 0 0 1-1.66 0L2 17.65M22 12.65l-9.17 4.16a2 2 0 0 1-1.66 0L2 12.65"/>',
    'inbox': '<path d="M22 12h-6l-2 3h-4l-2-3H2"/><path d="M5.45 5.11 2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.45-6.89A2 2 0 0 0 16.76 4H7.24a2 2 0 0 0-1.79 1.11z"/>',
    'send': '<path d="m22 2-7 20-4-9-9-4Z"/><path d="M22 2 11 13"/>',
    'command': '<path d="M18 3a3 3 0 0 0-3 3v12a3 3 0 0 0 3 3 3 3 0 0 0 3-3 3 3 0 0 0-3-3H6a3 3 0 0 0-3 3 3 3 0 0 0 3 3 3 3 0 0 0 3-3V6a3 3 0 0 0-3-3 3 3 0 0 0-3 3 3 3 0 0 0 3 3h12a3 3 0 0 0 3-3 3 3 0 0 0-3-3z"/>',
    'keyboard': '<rect x="2" y="4" width="20" height="16" rx="2"/><path d="M6 8h.01M10 8h.01M14 8h.01M18 8h.01M8 12h.01M12 12h.01M16 12h.01M7 16h10"/>',
    'refresh': '<path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/><path d="M3 3v5h5"/>',
    'menu': '<path d="M4 12h16M4 6h16M4 18h16"/>',
    'external-link': '<path d="M15 3h6v6M10 14 21 3M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/>',
    'coffee': '<path d="M17 8h1a4 4 0 1 1 0 8h-1M3 8h14v9a4 4 0 0 1-4 4H7a4 4 0 0 1-4-4Z"/><path d="M6 2v2M10 2v2M14 2v2"/>',
    'gift': '<rect x="3" y="8" width="18" height="4" rx="1"/><path d="M12 8v13M19 12v7a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2v-7M7.5 8a2.5 2.5 0 0 1 0-5A4.8 8 0 0 1 12 8a4.8 8 0 0 1 4.5-5 2.5 2.5 0 0 1 0 5"/>',
    'cake': '<path d="M20 21v-8a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v8M4 16s.5-1 2-1 2.5 2 4 2 2.5-2 4-2 2.5 2 4 2 2-1 2-1M2 21h20M7 8v3M12 8v3M17 8v3M7 4h.01M12 4h.01M17 4h.01"/>',
    'palette': '<circle cx="13.5" cy="6.5" r=".5"/><circle cx="17.5" cy="10.5" r=".5"/><circle cx="8.5" cy="7.5" r=".5"/><circle cx="6.5" cy="12.5" r=".5"/><path d="M12 2C6.5 2 2 6.5 2 12s4.5 10 10 10c.926 0 1.648-.746 1.648-1.688 0-.437-.18-.835-.437-1.125-.29-.289-.438-.652-.438-1.125a1.64 1.64 0 0 1 1.668-1.668h1.996c3.051 0 5.555-2.503 5.555-5.554C21.965 6.012 17.461 2 12 2z"/>',
    'laptop': '<path d="M20 16V7a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v9m16 0H4m16 0 1.28 2.55a1 1 0 0 1-.9 1.45H3.62a1 1 0 0 1-.9-1.45L4 16"/>',
    'building': '<rect x="4" y="2" width="16" height="20" rx="2"/><path d="M9 22v-4h6v4M8 6h.01M16 6h.01M12 6h.01M12 10h.01M12 14h.01M16 10h.01M16 14h.01M8 10h.01M8 14h.01"/>',
    'umbrella': '<path d="M22 12a10.06 10.06 1 0 0-20 0Z"/><path d="M12 12v8a2 2 0 0 0 4 0M12 2v1"/>',
    'hourglass': '<path d="M5 22h14M5 2h14M17 22v-4.172a2 2 0 0 0-.586-1.414L12 12l-4.414 4.414A2 2 0 0 0 7 17.828V22M7 2v4.172a2 2 0 0 0 .586 1.414L12 12l4.414-4.414A2 2 0 0 0 17 6.172V2"/>',
    'repeat': '<path d="m17 2 4 4-4 4"/><path d="M3 11v-1a4 4 0 0 1 4-4h14"/><path d="m7 22-4-4 4-4"/><path d="M21 13v1a4 4 0 0 1-4 4H3"/>',
    'grip': '<circle cx="9" cy="12" r="1"/><circle cx="9" cy="5" r="1"/><circle cx="9" cy="19" r="1"/><circle cx="15" cy="12" r="1"/><circle cx="15" cy="5" r="1"/><circle cx="15" cy="19" r="1"/>',
    'circle': '<circle cx="12" cy="12" r="10"/>',
    'circle-dot': '<circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="1.5" fill="currentColor"/>',
    'maximize': '<path d="M8 3H5a2 2 0 0 0-2 2v3M21 8V5a2 2 0 0 0-2-2h-3M3 16v3a2 2 0 0 0 2 2h3M16 21h3a2 2 0 0 0 2-2v-3"/>',
    'tag': '<path d="M12 2H2v10l9.29 9.29c.94.94 2.48.94 3.42 0l6.58-6.58c.94-.94.94-2.48 0-3.42L12 2Z"/><path d="M7 7h.01"/>',
    'award': '<circle cx="12" cy="8" r="6"/><path d="M15.477 12.89 17 22l-5-3-5 3 1.523-9.11"/>',
    'heart': '<path d="M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4.05 3 5.5l7 7Z"/>',
    'rocket': '<path d="M4.5 16.5c-1.5 1.26-2 5-2 5s3.74-.5 5-2c.71-.84.7-2.13-.09-2.91a2.18 2.18 0 0 0-2.91-.09z"/><path d="m12 15-3-3a22 22 0 0 1 2-3.95A12.88 12.88 0 0 1 22 2c0 2.72-.78 7.5-6 11a22.35 22.35 0 0 1-4 2z"/><path d="M9 12H4s.55-3.03 2-4c1.62-1.08 5 0 5 0"/><path d="M12 15v5s3.03-.55 4-2c1.08-1.62 0-5 0-5"/>',
    'wifi': '<path d="M12 20h.01M2 8.82a15 15 0 0 1 20 0M5 12.859a10 10 0 0 1 14 0M8.5 16.429a5 5 0 0 1 7 0"/>',
    'monitor': '<rect x="2" y="3" width="20" height="14" rx="2"/><path d="M8 21h8M12 17v4"/>',
    'smile': '<circle cx="12" cy="12" r="10"/><path d="M8 14s1.5 2 4 2 4-2 4-2M9 9h.01M15 9h.01"/>',
    'thumbs-up': '<path d="M7 10v12M15 5.88 14 10h5.83a2 2 0 0 1 1.92 2.56l-2.33 8A2 2 0 0 1 17.5 22H4a2 2 0 0 1-2-2v-8a2 2 0 0 1 2-2h2.76a2 2 0 0 0 1.79-1.11L12 2a3.13 3.13 0 0 1 3 3.88Z"/>',
    'shield': '<path d="M20 13c0 5-3.5 7.5-7.66 8.95a1 1 0 0 1-.67-.01C7.5 20.5 4 18 4 13V6a1 1 0 0 1 1-1c2 0 4.5-1.2 6.24-2.72a1.17 1.17 0 0 1 1.52 0C14.51 3.81 17 5 19 5a1 1 0 0 1 1 1z"/>',
    'megaphone': '<path d="m3 11 18-5v12L3 14v-3z"/><path d="M11.6 16.8a3 3 0 1 1-5.8-1.6"/>',
    'pie': '<path d="M21.21 15.89A10 10 0 1 1 8 2.83"/><path d="M22 12A10 10 0 0 0 12 2v10z"/>',
    'sparkle': '<path d="m12 3-1.9 5.8a2 2 0 0 1-1.3 1.3L3 12l5.8 1.9a2 2 0 0 1 1.3 1.3L12 21l1.9-5.8a2 2 0 0 1 1.3-1.3L21 12l-5.8-1.9a2 2 0 0 1-1.3-1.3Z"/>',
    'moon-stars': '<path d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9Z"/><path d="M19 3v4M21 5h-4"/>',
    'link': '<path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/>',
    'printer': '<path d="M6 9V2h12v7M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"/><rect x="6" y="14" width="12" height="8"/>',
    'plane': '<path d="M17.8 19.2 16 11l3.5-3.5C21 6 21.5 4 21 3c-1-.5-3 0-4.5 1.5L13 8 4.8 6.2c-.5-.1-.9.1-1.1.5l-.3.5c-.2.5-.1 1 .3 1.3L9 12l-2 3H4l-1 1 3 2 2 3 1-1v-3l3-2 3.5 5.3c.3.4.8.5 1.3.3l.5-.2c.4-.3.6-.7.5-1.2z"/>'
  };
  UI.icon = function (name, opts) {
    opts = typeof opts === 'number' ? { size: opts } : (opts || {});
    var size = opts.size || 18, body = ICONS[name] || ICONS['circle'];
    return '<svg class="icon' + (opts.cls ? ' ' + opts.cls : '') + '" width="' + size + '" height="' + size + '" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="' + (opts.stroke || 2) + '" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + body + '</svg>';
  };
  UI.hasIcon = function (name) { return !!ICONS[name]; };
  UI.logoMark = function (size) {
    size = size || 28;
    return '<svg class="logo-mark" width="' + size + '" height="' + size + '" viewBox="0 0 120 120" aria-hidden="true">' +
      '<g fill="var(--brand-red)" stroke="var(--brand-red)" stroke-width="5" stroke-linejoin="round"><polygon points="13,9 13,30 54,57 54,36"/><polygon points="107,9 107,30 66,57 66,36"/></g>' +
      '<polygon points="14,40 60,70 106,40 92,96 60,113 28,96" fill="var(--brand-blue)" stroke="var(--brand-blue)" stroke-width="5" stroke-linejoin="round"/>' +
      '<path d="M60 77 V97 M47 84 L60 97 L73 84" fill="none" stroke="#fff" stroke-width="7" stroke-linecap="round" stroke-linejoin="round"/></svg>';
  };

  /* ---------------------------------------------------------------- atoms */
  var STATUS_LABEL = { available: 'Sẵn sàng', busy: 'Đang bận', remote: 'Remote', onsite: 'On-site', off: 'Nghỉ' };
  UI.statusLabel = function (s) { return STATUS_LABEL[s] || s; };

  /** avatar(staff, {size:'xs|sm|md|lg|xl', status:bool, ring:bool, cls}) -> html string */
  UI.avatar = function (staff, opts) {
    opts = opts || {};
    if (!staff) return '<span class="avatar avatar--' + (opts.size || 'md') + ' avatar--empty">?</span>';
    var hue = U.avatarHue(staff.id + staff.name);
    var title = opts.title === false ? '' : ' title="' + U.escapeHtml(staff.name + ' · ' + staff.role) + '"';
    return '<span class="avatar avatar--' + (opts.size || 'md') + (opts.ring ? ' avatar--ring' : '') + (opts.cls ? ' ' + opts.cls : '') + '" style="--h:' + hue + '"' + title + ' data-staff="' + staff.id + '">' +
      '<span class="avatar__txt">' + U.escapeHtml(U.initials(staff.name)) + '</span>' +
      (opts.status ? '<i class="avatar__status" data-status="' + staff.status + '"></i>' : '') + '</span>';
  };
  /** Chồng avatar: avatarStack(staffArray, {max:4,size:'sm'}) */
  UI.avatarStack = function (list, opts) {
    opts = opts || {}; var max = opts.max || 4, size = opts.size || 'sm';
    var shown = list.slice(0, max), rest = list.length - shown.length;
    return '<span class="avatar-stack">' + shown.map(function (s) { return UI.avatar(s, { size: size }); }).join('') + (rest > 0 ? '<span class="avatar avatar--' + size + ' avatar--more">+' + rest + '</span>' : '') + '</span>';
  };
  UI.chip = function (label, opts) {
    opts = opts || {};
    var style = opts.color ? ' style="--chip:' + opts.color + '"' : '';
    return '<span class="chip' + (opts.tone ? ' chip--' + opts.tone : '') + (opts.color ? ' chip--color' : '') + (opts.cls ? ' ' + opts.cls : '') + '"' + style + '>' + (opts.icon ? UI.icon(opts.icon, 13) : '') + (opts.dot ? '<i class="chip__dot"></i>' : '') + '<span>' + U.escapeHtml(label) + '</span></span>';
  };
  UI.teamChip = function (team, opts) { return team ? UI.chip(team.name, Object.assign({ color: team.color, dot: true }, opts || {})) : ''; };
  UI.shiftBadge = function (typeId, opts) {
    opts = opts || {};
    var t = Z15.store.shiftType(typeId);
    return '<span class="shift' + (opts.cls ? ' ' + opts.cls : '') + '" data-shift="' + t.id + '" title="' + U.escapeHtml(t.label + ' · ' + t.hours) + '"><span class="shift__short">' + t.short + '</span>' + (opts.label ? '<span class="shift__label">' + U.escapeHtml(t.label) + '</span>' : '') + '</span>';
  };
  UI.progress = function (pct, opts) {
    opts = opts || {};
    var st = opts.color ? ' style="--bar:' + opts.color + '"' : '';
    return '<span class="progress' + (opts.size ? ' progress--' + opts.size : '') + (opts.cls ? ' ' + opts.cls : '') + '"' + st + ' role="progressbar" aria-valuenow="' + Math.round(pct) + '" aria-valuemin="0" aria-valuemax="100"><span class="progress__bar" style="width:' + U.clamp(pct, 0, 100) + '%"></span></span>';
  };
  UI.kbd = function (keys) { return String(keys).split(' ').map(function (k) { return '<kbd class="kbd">' + U.escapeHtml(k) + '</kbd>'; }).join('<span class="kbd-sep">+</span>'); };
  UI.empty = function (opts) {
    opts = opts || {};
    return '<div class="empty' + (opts.cls ? ' ' + opts.cls : '') + '"><div class="empty__icon">' + UI.icon(opts.icon || 'inbox', 28) + '</div><div class="empty__title">' + U.escapeHtml(opts.title || 'Chưa có gì ở đây') + '</div>' + (opts.body ? '<div class="empty__body">' + U.escapeHtml(opts.body) + '</div>' : '') + (opts.actionLabel ? '<button class="btn btn--soft btn--sm" data-action="' + U.escapeHtml(opts.action || '') + '">' + UI.icon('plus', 16) + U.escapeHtml(opts.actionLabel) + '</button>' : '') + '</div>';
  };
  UI.skeleton = function (n, cls) { var out = ''; for (var i = 0; i < (n || 3); i++) out += '<div class="skeleton ' + (cls || '') + '" style="width:' + (60 + ((i * 37) % 40)) + '%"></div>'; return out; };

  /** Pill sự kiện — dùng chung giữa dashboard / lịch / dự án. */
  UI.eventPill = function (ev, opts) {
    opts = opts || {};
    var S = Z15.store, type = S.eventType(ev.type), project = ev.projectId ? S.project(ev.projectId) : null;
    var me = S.state ? S.state.currentUserId : null, see = S.canSee ? S.canSee(ev, me) : true;
    var title = see ? ev.title : (S.displayTitle ? S.displayTitle(ev, me) : 'Bận');
    var time = ev.allDay ? 'Cả ngày' : U.fmtTimeRange(ev.start, ev.end);
    var meta = see ? [time, ev.location].filter(Boolean).join(' · ') : time;
    var attendees = see ? (ev.attendeeIds || []).map(S.staff).filter(Boolean) : [];
    var style = see && project && opts.projectColor !== false ? ' style="--ev:' + project.color + '"' : '';
    var prio = ev.priority || 2;
    return '<div class="ev-pill' + (opts.compact ? ' ev-pill--compact' : '') + (see ? '' : ' is-private') + (opts.cls ? ' ' + opts.cls : '') + '" data-type="' + ev.type + '" data-event="' + ev.id + '" data-prio="' + prio + '"' + style + ' tabindex="' + (opts.tabindex == null ? 0 : opts.tabindex) + '" role="button" aria-label="' + U.escapeHtml(title + ', ' + meta + (prio === 1 ? ', ưu tiên P1' : '')) + '">' +
      '<span class="ev-pill__bar"></span>' +
      '<span class="ev-pill__main"><span class="ev-pill__title">' + (see ? '' : UI.icon('shield', 11) + ' ') + U.escapeHtml(title) + '</span>' +
      (opts.compact ? '' : '<span class="ev-pill__meta">' + U.escapeHtml(meta) + (see && project ? ' · <b>' + U.escapeHtml(project.client) + '</b>' : '') + (see && ev.travelMinutes && !opts.compact ? ' · ~' + ev.travelMinutes + "' di chuyển" : '') + '</span>') + '</span>' +
      (opts.compact || !attendees.length ? '' : '<span class="ev-pill__people">' + UI.avatarStack(attendees, { max: 3, size: 'xs' }) + '</span>') +
      '</div>';
  };

  /* ---------------------------------------------------------------- toast */
  var toastRoot;
  function ensureToastRoot() { if (!toastRoot) { toastRoot = U.el('div', { class: 'toasts', 'aria-live': 'polite', 'aria-atomic': 'false' }); document.body.appendChild(toastRoot); } return toastRoot; }
  /** toast('Đã lưu', {kind:'success'|'error'|'info'|'brand', title, action:{label,onClick}, duration}) */
  UI.toast = function (message, opts) {
    opts = opts || {}; var root = ensureToastRoot();
    var kind = opts.kind || 'info';
    var iconName = { success: 'check-circle', error: 'alert-circle', info: 'info', brand: 'sparkles', warning: 'alert-triangle' }[kind] || 'info';
    var t = U.el('div', { class: 'toast toast--' + kind, role: 'status' });
    t.innerHTML = '<span class="toast__icon">' + UI.icon(iconName, 18) + '</span><span class="toast__body">' + (opts.title ? '<strong>' + U.escapeHtml(opts.title) + '</strong>' : '') + '<span>' + U.escapeHtml(message) + '</span></span>' + (opts.action ? '<button class="toast__action">' + U.escapeHtml(opts.action.label) + '</button>' : '') + '<button class="toast__close" aria-label="Đóng">' + UI.icon('x', 14) + '</button><span class="toast__bar"></span>';
    root.appendChild(t);
    var dur = opts.duration || (opts.action ? 6000 : 3600);
    t.style.setProperty('--dur', dur + 'ms');
    var closed = false, timer;
    function close() { if (closed) return; closed = true; clearTimeout(timer); t.classList.add('is-leaving'); U.onceTransitionEnd(t, function () { t.remove(); }, 400); }
    t.querySelector('.toast__close').addEventListener('click', close);
    if (opts.action) t.querySelector('.toast__action').addEventListener('click', function () { opts.action.onClick(); close(); });
    t.addEventListener('mouseenter', function () { clearTimeout(timer); t.classList.add('is-paused'); });
    t.addEventListener('mouseleave', function () { if (t.contains(document.activeElement)) return; t.classList.remove('is-paused'); timer = setTimeout(close, 1500); });
    t.addEventListener('focusin', function () { clearTimeout(timer); t.classList.add('is-paused'); });
    t.addEventListener('focusout', function (e) { if (t.contains(e.relatedTarget)) return; t.classList.remove('is-paused'); timer = setTimeout(close, 1500); });
    requestAnimationFrame(function () { t.classList.add('is-in'); });
    timer = setTimeout(close, dur);
    while (root.children.length > 4) root.firstChild.remove();
    return { close: close, el: t };
  };

  /* ------------------------------------------------------- layers / esc */
  var layerStack = []; // {close}
  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape' && layerStack.length) { e.preventDefault(); layerStack[layerStack.length - 1].close(); }
  });
  function pushLayer(l) { layerStack.push(l); document.body.classList.toggle('has-layer', layerStack.some(function (x) { return x.lock; })); }
  function popLayer(l) { layerStack = layerStack.filter(function (x) { return x !== l; }); document.body.classList.toggle('has-layer', layerStack.some(function (x) { return x.lock; })); }
  UI.closeTopLayer = function () { if (layerStack.length) layerStack[layerStack.length - 1].close(); };
  // Đổi trang: đóng popover/menu (lớp không khoá) để không bị 'mồ côi'
  window.addEventListener('hashchange', function () { layerStack.filter(function (l) { return !l.lock; }).forEach(function (l) { l.close(); }); });
  UI.closeAllLayers = function () { layerStack.slice().reverse().forEach(function (l) { l.close(); }); };

  /* ---------------------------------------------------------------- modal */
  /**
   * modal({ title, subtitle, content: html|Raw|Node, size:'sm|md|lg|xl', actions:[{label, kind, icon, onClick(close, modal), keep}], onClose, dismissible, cls })
   * -> { el, body, close, setBusy }
   */
  UI.modal = function (opts) {
    opts = opts || {};
    var prevFocus = document.activeElement;
    var overlay = U.el('div', { class: 'modal-overlay', role: 'presentation' });
    var dlg = U.el('div', { class: 'modal modal--' + (opts.size || 'md') + (opts.cls ? ' ' + opts.cls : ''), role: 'dialog', 'aria-modal': 'true', tabindex: '-1', 'aria-label': opts.ariaLabel || (typeof opts.title === 'string' && opts.title ? opts.title : 'Hộp thoại') });
    var head = opts.title === false ? null : U.el('div', { class: 'modal__head' },
      U.el('div', { class: 'modal__titles' }, U.el('h2', { class: 'modal__title', text: opts.title || '' }), opts.subtitle ? U.el('p', { class: 'modal__sub', text: opts.subtitle }) : null),
      U.el('button', { class: 'icon-btn modal__close', 'aria-label': 'Đóng', html: UI.icon('x', 18), onclick: function () { api.close(); } }));
    var body = U.el('div', { class: 'modal__body' });
    if (opts.content instanceof Node) body.appendChild(opts.content); else U.render(body, opts.content || '');
    var foot = null;
    if (opts.actions && opts.actions.length) {
      foot = U.el('div', { class: 'modal__foot' });
      opts.actions.forEach(function (a) {
        var b = U.el('button', { class: 'btn btn--' + (a.kind || 'ghost') + (a.cls ? ' ' + a.cls : ''), type: 'button', html: (a.icon ? UI.icon(a.icon, 16) : '') + '<span>' + U.escapeHtml(a.label) + '</span>' });
        if (a.align === 'left') b.classList.add('mr-auto');
        b.addEventListener('click', function () { var r = a.onClick ? a.onClick(api.close, api) : undefined; if (r !== false && !a.keep) api.close(); });
        foot.appendChild(b);
      });
    }
    U.append(dlg, [head, body, foot]);
    overlay.appendChild(dlg);
    document.body.appendChild(overlay);
    var openedAt = Date.now(); // nuốt click 'thừa' của double-click mở hộp thoại
    dlg.addEventListener('click', function (e) { if (Date.now() - openedAt < 250) { e.stopPropagation(); e.preventDefault(); } }, true);
    var release = U.focusTrap(dlg);
    var closed = false;
    var api = {
      el: dlg, overlay: overlay, body: body,
      close: function (result) {
        if (closed) return; closed = true; popLayer(layer); release();
        overlay.classList.add('is-leaving'); overlay.classList.remove('is-open');
        U.onceTransitionEnd(dlg, function () { overlay.remove(); if (opts.onClose) opts.onClose(result); if (prevFocus && prevFocus.focus) prevFocus.focus(); }, 320);
      },
      setBusy: function (b) { dlg.classList.toggle('is-busy', !!b); }
    };
    var layer = { close: function () { api.close(); }, lock: true };
    pushLayer(layer);
    if (opts.dismissible !== false) overlay.addEventListener('mousedown', function (e) { if (e.target === overlay) api.close(); });
    requestAnimationFrame(function () { requestAnimationFrame(function () { overlay.classList.add('is-open'); var order = [opts.initialFocus, '[autofocus]', '.modal__body input:not([type=hidden]), .modal__body select, .modal__body textarea', '.modal__foot .btn--primary', '.modal__foot .btn', 'button:not(.modal__close)'], f = null; for (var i = 0; i < order.length && !f; i++) if (order[i]) f = dlg.querySelector(order[i]); (f || dlg).focus({ preventScroll: true }); }); });
    return api;
  };
  UI.confirm = function (opts) {
    opts = opts || {};
    return new Promise(function (resolve) {
      var done = false;
      UI.modal({
        size: 'sm', title: opts.title || 'Xác nhận', initialFocus: opts.danger ? '.modal__foot .btn--ghost' : null, content: '<p class="modal__text">' + U.escapeHtml(opts.message || 'Bạn có chắc không?') + '</p>',
        actions: [{ label: opts.cancelLabel || 'Huỷ', kind: 'ghost' }, { label: opts.confirmLabel || 'Đồng ý', kind: opts.danger ? 'danger' : 'primary', icon: opts.icon, onClick: function () { done = true; resolve(true); } }],
        onClose: function () { if (!done) resolve(false); }
      });
    });
  };

  /* --------------------------------------------------------------- drawer */
  UI.drawer = function (opts) {
    opts = opts || {};
    var prevFocus = document.activeElement;
    var overlay = U.el('div', { class: 'drawer-overlay' });
    var panel = U.el('aside', { class: 'drawer drawer--' + (opts.side || 'right') + (opts.size ? ' drawer--' + opts.size : '') + (opts.cls ? ' ' + opts.cls : ''), role: 'dialog', 'aria-modal': 'true', tabindex: '-1', 'aria-label': opts.ariaLabel || (typeof opts.title === 'string' && opts.title ? opts.title : 'Bảng chi tiết') });
    var head = opts.title === false ? null : U.el('div', { class: 'drawer__head' }, U.el('h2', { class: 'drawer__title', text: opts.title || '' }), U.el('button', { class: 'icon-btn', 'aria-label': 'Đóng', html: UI.icon('x', 18), onclick: function () { api.close(); } }));
    var body = U.el('div', { class: 'drawer__body' });
    if (opts.content instanceof Node) body.appendChild(opts.content); else U.render(body, opts.content || '');
    U.append(panel, [head, body]);
    overlay.appendChild(panel); document.body.appendChild(overlay);
    var openedAt = Date.now();
    panel.addEventListener('click', function (e) { if (Date.now() - openedAt < 250) { e.stopPropagation(); e.preventDefault(); } }, true);
    var release = U.focusTrap(panel), closed = false;
    var api = {
      el: panel, body: body, overlay: overlay,
      close: function () { if (closed) return; closed = true; popLayer(layer); release(); overlay.classList.remove('is-open'); overlay.classList.add('is-leaving'); U.onceTransitionEnd(panel, function () { overlay.remove(); if (opts.onClose) opts.onClose(); if (prevFocus && prevFocus.focus) prevFocus.focus(); }, 420); },
      setTitle: function (t) { var h = panel.querySelector('.drawer__title'); if (h) h.textContent = t; }
    };
    var layer = { close: function () { api.close(); }, lock: true }; pushLayer(layer);
    overlay.addEventListener('mousedown', function (e) { if (e.target === overlay) api.close(); });
    requestAnimationFrame(function () { requestAnimationFrame(function () { overlay.classList.add('is-open'); var f = panel.querySelector('[autofocus], input, button, [tabindex]:not([tabindex="-1"])'); (f || panel).focus({ preventScroll: true }); }); });
    return api;
  };

  /* -------------------------------------------------------------- popover */
  function place(anchor, node, placement, offset) {
    var r = anchor.getBoundingClientRect(), vw = window.innerWidth, vh = window.innerHeight;
    node.style.visibility = 'hidden'; node.style.display = 'block';
    var w = node.offsetWidth, h = node.offsetHeight; offset = offset == null ? 8 : offset;
    var top, left, p = placement || 'bottom-start';
    if (p.indexOf('bottom') === 0) top = r.bottom + offset; else if (p.indexOf('top') === 0) top = r.top - h - offset; else top = r.top;
    if (p === 'right') { left = r.right + offset; } else if (p === 'left') { left = r.left - w - offset; }
    else if (p.indexOf('end') > 0) left = r.right - w; else if (p.indexOf('center') > 0) left = r.left + r.width / 2 - w / 2; else left = r.left;
    if (top + h > vh - 8 && p.indexOf('bottom') === 0) { top = r.top - h - offset; node.dataset.flip = 'top'; } else node.dataset.flip = '';
    if (top < 8 && p.indexOf('top') === 0) { top = r.bottom + offset; node.dataset.flip = 'bottom'; }
    if (top < 8) top = 8;
    left = U.clamp(left, 8, Math.max(8, vw - w - 8));
    node.style.top = Math.round(top) + 'px'; node.style.left = Math.round(left) + 'px'; node.style.visibility = '';
  }
  /** popover(anchorEl, content, {placement, cls, onClose, width}) -> {el, close, reposition} */
  UI.popover = function (anchor, content, opts) {
    opts = opts || {};
    if (anchor.__pop) { var prev = anchor.__pop; prev.close(); return prev; } // bấm lại anchor = đóng
    var prevFocus = document.activeElement;
    var node = U.el('div', { class: 'popover' + (opts.cls ? ' ' + opts.cls : ''), role: 'dialog', tabindex: '-1', 'aria-label': opts.ariaLabel || anchor.getAttribute('aria-label') || anchor.getAttribute('data-tip') || (anchor.textContent || '').trim().slice(0, 60) || 'Bảng chọn' });
    if (opts.width) node.style.width = typeof opts.width === 'number' ? opts.width + 'px' : opts.width;
    if (content instanceof Node) node.appendChild(content); else U.render(node, content || '');
    document.body.appendChild(node);
    place(anchor, node, opts.placement, opts.offset);
    var closed = false;
    function onDoc(e) { if (!node.contains(e.target) && !anchor.contains(e.target)) api.close(); }
    function onScroll() { api.reposition(); }
    var api = {
      el: node,
      close: function () {
        if (closed) return; closed = true; popLayer(layer); anchor.__pop = null; anchor.setAttribute('aria-expanded', 'false');
        document.removeEventListener('mousedown', onDoc, true); window.removeEventListener('resize', onScroll); window.removeEventListener('scroll', onScroll, true);
        node.classList.remove('is-open'); node.classList.add('is-leaving');
        var inside = node.contains(document.activeElement);
        U.onceTransitionEnd(node, function () { node.remove(); if (opts.onClose) opts.onClose(); }, 220);
        if (inside || document.activeElement === document.body) { var back = prevFocus && prevFocus.focus && document.contains(prevFocus) ? prevFocus : anchor; if (back && back.focus) back.focus({ preventScroll: true }); }
      },
      reposition: function () { if (!closed) place(anchor, node, opts.placement, opts.offset); }
    };
    var layer = { close: function () { api.close(); }, lock: false }; pushLayer(layer);
    setTimeout(function () { if (!closed) { document.addEventListener('mousedown', onDoc, true); window.addEventListener('resize', onScroll); window.addEventListener('scroll', onScroll, true); } }, 0);
    requestAnimationFrame(function () { node.classList.add('is-open'); if (opts.focus !== false) { var f = node.querySelector('input,button,[tabindex]'); if (f) f.focus({ preventScroll: true }); } });
    anchor.setAttribute('aria-expanded', 'true'); anchor.__pop = api;
    return api;
  };
  /** menu(anchor, [{label, icon, onClick, danger, disabled, divider, hint, checked}], {placement}) */
  UI.menu = function (anchor, items, opts) {
    opts = opts || {};
    var mlabel = opts.ariaLabel || anchor.getAttribute('aria-label') || (anchor.textContent || '').trim().slice(0, 60) || 'Menu';
    var html = '<div class="menu" role="menu" aria-label="' + U.escapeHtml(mlabel) + '">' + items.map(function (it, i) {
      if (it.divider) return '<div class="menu__divider" role="separator"></div>';
      if (it.heading) return '<div class="menu__heading">' + U.escapeHtml(it.heading) + '</div>';
      return '<button class="menu__item' + (it.danger ? ' is-danger' : '') + (it.checked ? ' is-checked' : '') + '" role="menuitem" data-i="' + i + '"' + (it.disabled ? ' disabled' : '') + '>' + (it.icon ? UI.icon(it.icon, 16) : '<span class="menu__spacer"></span>') + '<span class="menu__label">' + U.escapeHtml(it.label) + '</span>' + (it.hint ? '<span class="menu__hint">' + U.escapeHtml(it.hint) + '</span>' : '') + (it.checked ? UI.icon('check', 14) : '') + '</button>';
    }).join('') + '</div>';
    var pop = UI.popover(anchor, html, { placement: opts.placement || 'bottom-end', cls: 'popover--menu', ariaLabel: mlabel });
    pop.el.addEventListener('click', function (e) { var b = e.target.closest('.menu__item'); if (!b) return; var it = items[+b.dataset.i]; pop.close(); if (it && it.onClick) it.onClick(); });
    pop.el.addEventListener('keydown', function (e) {
      var btns = U.qsa('.menu__item:not([disabled])', pop.el), i = btns.indexOf(document.activeElement);
      if (e.key === 'ArrowDown') { e.preventDefault(); (btns[i + 1] || btns[0]).focus(); }
      if (e.key === 'ArrowUp') { e.preventDefault(); (btns[i - 1] || btns[btns.length - 1]).focus(); }
    });
    return pop;
  };

  /* -------------------------------------------------------------- tooltip */
  (function () {
    var tip, timer, current;
    function show(target) {
      if (!target.isConnected) return;
      var text = target.getAttribute('data-tip'); if (!text) return;
      if (!tip) { tip = U.el('div', { class: 'tooltip', role: 'tooltip' }); document.body.appendChild(tip); }
      tip.textContent = text; current = target;
      place(target, tip, target.getAttribute('data-tip-pos') || 'top-center', 8);
      tip.classList.add('is-open');
    }
    function hide() { clearTimeout(timer); if (tip) tip.classList.remove('is-open'); current = null; }
    document.addEventListener('mouseover', function (e) {
      var t = e.target.closest && e.target.closest('[data-tip]'); if (!t || t === current) return;
      clearTimeout(timer); timer = setTimeout(function () { if (t.isConnected) show(t); else hide(); }, 350);
    });
    document.addEventListener('mouseout', function (e) { var t = e.target.closest && e.target.closest('[data-tip]'); if (t && (!e.relatedTarget || !t.contains(e.relatedTarget))) hide(); });
    document.addEventListener('focusin', function (e) { var t = e.target.closest && e.target.closest('[data-tip]'); if (t) show(t); });
    document.addEventListener('focusout', hide);
    document.addEventListener('mousedown', hide, true);
    window.addEventListener('scroll', hide, true);
    UI.hideTooltip = hide;
  })();

  /* ----------------------------------------------------------- shortcuts */
  var shortcuts = [], seq = '', seqTimer;
  function isTyping(e) { var t = e.target; return t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.tagName === 'SELECT' || t.isContentEditable); }
  /** shortcuts.register('g d', fn, 'Mô tả') ; hỗ trợ 'mod+k', '?', 'n', chuỗi 2 phím 'g d' */
  UI.shortcuts = {
    register: function (combo, fn, desc, group) { shortcuts.push({ combo: combo, fn: fn, desc: desc, group: group || 'Chung' }); return function () { shortcuts = shortcuts.filter(function (s) { return s.fn !== fn; }); }; },
    list: function () { return shortcuts.slice(); }
  };
  document.addEventListener('keydown', function (e) {
    var mod = e.metaKey || e.ctrlKey;
    var key = e.key.length === 1 ? e.key.toLowerCase() : e.key;
    if (mod) {
      var combo = 'mod+' + key;
      var s = shortcuts.find(function (x) { return x.combo === combo; });
      if (s) { e.preventDefault(); s.fn(e); }
      return;
    }
    if (isTyping(e) || layerStack.length) return;
    if (e.altKey) return;
    if (Z15.store && Z15.store.state && Z15.store.state.settings && Z15.store.state.settings.keyShortcuts === false) return;
    var single = e.key === '?' ? '?' : ((e.shiftKey && e.key.length === 1) ? 'shift+' : '') + key;
    clearTimeout(seqTimer);
    if (seq) {
      var two = seq + ' ' + single, m = shortcuts.find(function (x) { return x.combo === two; });
      seq = '';
      if (m) { e.preventDefault(); m.fn(e); return; }
    }
    var prefix = shortcuts.some(function (x) { return x.combo.indexOf(single + ' ') === 0; });
    if (prefix) { seq = single; seqTimer = setTimeout(function () { seq = ''; }, 900); return; }
    var one = shortcuts.find(function (x) { return x.combo === single; });
    if (one) { e.preventDefault(); one.fn(e); }
  });

  /* ------------------------------------------------------ command palette */
  var commands = [];
  /** palette.register({id, label, hint, icon, section, keywords, run, shortcut}) */
  UI.palette = {
    register: function (cmd) { commands = commands.filter(function (c) { return c.id !== cmd.id; }); commands.push(cmd); },
    unregister: function (id) { commands = commands.filter(function (c) { return c.id !== id; }); },
    open: openPalette,
    isOpen: function () { return !!paletteApi; }
  };
  var paletteApi = null;
  function openPalette(initial) {
    if (paletteApi) return;
    var S = Z15.store, prevFocus = document.activeElement;
    var overlay = U.el('div', { class: 'palette-overlay' });
    var box = U.el('div', { class: 'palette', role: 'dialog', 'aria-label': 'Tìm kiếm & lệnh nhanh' });
    box.innerHTML = '<div class="palette__input-wrap">' + UI.icon('search', 18) + '<input class="palette__input" type="text" placeholder="Tìm người, dự án, sự kiện hoặc gõ lệnh…" aria-label="Tìm kiếm" autocomplete="off" spellcheck="false" role="combobox" aria-expanded="true" aria-controls="palList" aria-autocomplete="list" aria-haspopup="listbox"><span class="palette__esc">' + UI.kbd('Esc') + '</span></div><div class="palette__list" id="palList" role="listbox" aria-label="Kết quả"></div><div class="palette__foot"><span>' + UI.kbd('↑') + UI.kbd('↓') + ' di chuyển</span><span>' + UI.kbd('↵') + ' chọn</span><span>' + UI.kbd('?') + ' phím tắt</span></div>';
    overlay.appendChild(box); document.body.appendChild(overlay);
    var input = box.querySelector('.palette__input'), list = box.querySelector('.palette__list');
    var rows = [], active = 0;
    function build(q) {
      rows = [];
      var query = (q || '').trim();
      var cmds = commands.filter(function (c) { return !query || U.fuzzyMatch(query, c.label + ' ' + (c.keywords || '')) > 0; });
      if (query) cmds = U.sortBy(cmds, function (c) { return -U.fuzzyMatch(query, c.label); });
      var groups = U.groupBy(cmds.slice(0, query ? 6 : 40), function (c) { return c.section || 'Lệnh'; });
      Object.keys(groups).forEach(function (g) { rows.push({ heading: g }); groups[g].forEach(function (c) { rows.push({ cmd: c }); }); });
      if (query) {
        var res = S.search(query);
        var byKind = U.groupBy(res, 'kind');
        var kindLabel = { staff: 'Nhân sự', project: 'Dự án', event: 'Sự kiện' };
        ['staff', 'project', 'event'].forEach(function (k) {
          if (!byKind[k]) return; rows.push({ heading: kindLabel[k] });
          byKind[k].slice(0, 5).forEach(function (r) { rows.push({ result: r }); });
        });
      }
      if (!rows.length) rows.push({ empty: true });
      active = rows.findIndex(function (r) { return r.cmd || r.result; });
      render();
    }
    function render() {
      list.innerHTML = rows.map(function (r, i) {
        if (r.heading) return '<div class="palette__heading" role="presentation">' + U.escapeHtml(r.heading) + '</div>';
        if (r.empty) return '<div class="palette__empty" role="presentation">Không tìm thấy kết quả phù hợp</div>';
        var cls = 'palette__row' + (i === active ? ' is-active' : '');
        if (r.cmd) return '<button class="' + cls + '" data-i="' + i + '" id="pal-opt-' + i + '" role="option" aria-selected="' + (i === active) + '">' + UI.icon(r.cmd.icon || 'command', 16) + '<span class="palette__label">' + U.escapeHtml(r.cmd.label) + '</span>' + (r.cmd.hint ? '<span class="palette__hint">' + U.escapeHtml(r.cmd.hint) + '</span>' : '') + (r.cmd.shortcut ? '<span class="palette__kbd">' + UI.kbd(r.cmd.shortcut) + '</span>' : '') + '</button>';
        var x = r.result, lead = x.kind === 'staff' ? UI.avatar(x.item, { size: 'xs', title: false }) : x.kind === 'project' ? '<span class="palette__swatch" style="background:' + x.item.color + '"></span>' : UI.icon('calendar', 16);
        return '<button class="' + cls + '" data-i="' + i + '" id="pal-opt-' + i + '" role="option" aria-selected="' + (i === active) + '">' + lead + '<span class="palette__label">' + U.escapeHtml(x.title) + '</span><span class="palette__hint">' + U.escapeHtml(x.sub) + '</span></button>';
      }).join('');
      var a = list.querySelector('.is-active'); if (a) a.scrollIntoView({ block: 'nearest' });
      input.setAttribute('aria-activedescendant', active >= 0 ? 'pal-opt-' + active : '');
    }
    function move(d) { var n = rows.length, i = active; for (var k = 0; k < n; k++) { i = (i + d + n) % n; if (rows[i].cmd || rows[i].result) { active = i; break; } } render(); }
    function run(i) {
      var r = rows[i]; if (!r) return;
      close();
      if (r.cmd) r.cmd.run();
      else if (r.result) {
        var x = r.result;
        if (x.kind === 'staff') Z15.editors && Z15.editors.staffProfile(x.id);
        else if (x.kind === 'project') location.hash = '#/projects/' + x.id;
        else if (x.kind === 'event') Z15.editors && Z15.editors.eventDetail(x.id);
      }
    }
    input.addEventListener('input', function () { build(input.value); });
    input.addEventListener('keydown', function (e) {
      if (e.key === 'ArrowDown') { e.preventDefault(); move(1); }
      else if (e.key === 'ArrowUp') { e.preventDefault(); move(-1); }
      else if (e.key === 'Enter') { e.preventDefault(); run(active); }
    });
    list.addEventListener('click', function (e) { var b = e.target.closest('.palette__row'); if (b) run(+b.dataset.i); });
    list.addEventListener('mousemove', function (e) {
      var b = e.target.closest('.palette__row'); if (!b || +b.dataset.i === active) return;
      var prev = list.querySelector('.is-active'); if (prev) { prev.classList.remove('is-active'); prev.setAttribute('aria-selected', 'false'); }
      b.classList.add('is-active'); b.setAttribute('aria-selected', 'true'); active = +b.dataset.i; input.setAttribute('aria-activedescendant', 'pal-opt-' + active);
    });
    overlay.addEventListener('mousedown', function (e) { if (e.target === overlay) close(); });
    var closed = false;
    function close() { if (closed) return; closed = true; popLayer(layer); paletteApi = null; overlay.classList.remove('is-open'); overlay.classList.add('is-leaving'); U.onceTransitionEnd(box, function () { overlay.remove(); }, 260); if (prevFocus && prevFocus.focus && document.contains(prevFocus)) prevFocus.focus({ preventScroll: true }); }
    var layer = { close: close, lock: true }; pushLayer(layer);
    paletteApi = { close: close };
    build(initial || ''); if (initial) input.value = initial;
    requestAnimationFrame(function () { requestAnimationFrame(function () { overlay.classList.add('is-open'); input.focus(); }); });
  }

  /* ---------------------------------------------------------------- reveal */
  var io = ('IntersectionObserver' in window) ? new IntersectionObserver(function (entries) {
    entries.forEach(function (en) { if (en.isIntersecting) { en.target.classList.add('is-in'); io.unobserve(en.target); } });
  }, { threshold: 0.08, rootMargin: '0px 0px -40px 0px' }) : null;
  /** Đánh dấu .reveal trong container để tự hiện khi cuộn tới (kèm stagger theo thứ tự). */
  UI.reveal = function (root, selector) {
    var items = U.qsa(selector || '.reveal', root || document);
    if (U.prefersReducedMotion() || !io) { items.forEach(function (i) { i.classList.add('is-in'); }); return; }
    items.forEach(function (it, i) { if (!it.style.getPropertyValue('--i')) it.style.setProperty('--i', String(Math.min(i, 12))); io.observe(it); });
  };

  /* ------------------------------------------------------ small helpers */
  UI.bindEventPills = function (root) {
    return U.delegate(root, 'click', '.ev-pill', function (e, el) { if (e.defaultPrevented) return; if (Z15.editors) Z15.editors.eventDetail(el.dataset.event); })
      && U.delegate(root, 'keydown', '.ev-pill', function (e, el) { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); if (Z15.editors) Z15.editors.eventDetail(el.dataset.event); } });
  };
  UI.bindAvatars = function (root) {
    return U.delegate(root, 'click', '.avatar[data-staff]', function (e, el) {
      if (el.closest('.ev-pill') || el.closest('[data-no-profile]')) return;
      e.stopPropagation(); if (Z15.editors) Z15.editors.staffProfile(el.dataset.staff);
    });
  };
  /** Segmented control: segmented(items:[{value,label,icon}], value, onChange) -> element */
  UI.segmented = function (items, value, onChange, opts) {
    opts = opts || {};
    var wrap = U.el('div', { class: 'segmented' + (opts.cls ? ' ' + opts.cls : ''), role: 'radiogroup', 'aria-label': opts.label || null });
    var ind = U.el('span', { class: 'segmented__ind', 'aria-hidden': 'true' }); wrap.appendChild(ind);
    items.forEach(function (it) {
      var b = U.el('button', { class: 'segmented__btn' + (it.value === value ? ' is-active' : ''), type: 'button', role: 'radio', 'aria-checked': it.value === value ? 'true' : 'false', dataset: { value: it.value }, html: (it.icon ? UI.icon(it.icon, 15) : '') + '<span>' + U.escapeHtml(it.label) + '</span>' });
      b.addEventListener('click', function () { if (b.classList.contains('is-active')) return; U.qsa('.segmented__btn', wrap).forEach(function (x) { x.classList.remove('is-active'); x.setAttribute('aria-checked', 'false'); }); b.classList.add('is-active'); b.setAttribute('aria-checked', 'true'); moveInd(); onChange(it.value); });
      wrap.appendChild(b);
    });
    wrap.addEventListener('keydown', function (e) {
      if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return;
      var btns = U.qsa('.segmented__btn', wrap), i = btns.indexOf(document.activeElement); if (i < 0) return;
      e.preventDefault(); var n = btns[(i + (e.key === 'ArrowRight' ? 1 : btns.length - 1)) % btns.length]; n.focus(); n.click();
    });
    function moveInd() { var a = wrap.querySelector('.segmented__btn.is-active'); U.qsa('.segmented__btn', wrap).forEach(function (x) { x.setAttribute('aria-checked', x === a ? 'true' : 'false'); }); if (!a) return; ind.style.width = a.offsetWidth + 'px'; ind.style.transform = 'translateX(' + (a.offsetLeft) + 'px)'; }
    wrap.refresh = moveInd;
    wrap.setValue = function (v) { U.qsa('.segmented__btn', wrap).forEach(function (x) { x.classList.toggle('is-active', x.dataset.value === String(v)); }); moveInd(); };
    requestAnimationFrame(moveInd); setTimeout(moveInd, 60);
    return wrap;
  };
})(window);
