const Lang = {
  cur: 'ar',
  t(key, vars) {
    let s = (window.I18N[this.cur] && window.I18N[this.cur][key]) ?? window.I18N.ar[key] ?? key;
    if (vars) for (const k in vars) s = s.split('{' + k + '}').join(vars[k]);
    return s;
  },
  applyStatic(root = document) {
    root.querySelectorAll('[data-i18n]').forEach(el => { el.textContent = this.t(el.dataset.i18n); });
    root.querySelectorAll('[data-i18n-ph]').forEach(el => { el.placeholder = this.t(el.dataset.i18nPh); });
    root.querySelectorAll('[data-i18n-aria]').forEach(el => { el.setAttribute('aria-label', this.t(el.dataset.i18nAria)); });
  },
  apply() {
    const d = document.documentElement;
    d.lang = this.cur; d.dir = this.cur === 'ar' ? 'rtl' : 'ltr';
    document.title = document.body.dataset.page === 'chat' ? this.t('title_chat') : this.t('title_landing');
    this.applyStatic();
  },
  set(l) {
    this.cur = l; Store.setSetting('lang', l);
    this.apply();
    document.querySelectorAll('[data-lang]').forEach(b => {
      const on = b.dataset.lang === l;
      b.classList.toggle('on', on); b.setAttribute('aria-pressed', on);
    });
    document.dispatchEvent(new CustomEvent('langchange'));
  },
  init() { this.cur = Store.settings.lang || 'ar'; this.apply(); }
};