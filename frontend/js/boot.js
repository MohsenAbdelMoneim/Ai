// Runs before paint: restores language direction + theme with no flash.
(function () {
  try {
    var s = JSON.parse(localStorage.getItem('mohsen_ai_settings_v1') || '{}');
    var lang = s.lang || 'ar', th = s.theme || 'system';
    var d = document.documentElement;
    d.lang = lang; d.dir = lang === 'ar' ? 'rtl' : 'ltr';
    var dark = th === 'dark' || (th === 'system' && matchMedia('(prefers-color-scheme: dark)').matches);
    d.classList.toggle('dark', dark);
  } catch (e) {}
})();