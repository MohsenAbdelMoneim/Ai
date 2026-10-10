const Theme = {
  mode: 'system',
  mq: window.matchMedia('(prefers-color-scheme: dark)'),
  apply() {
    const dark = this.mode === 'dark' || (this.mode === 'system' && this.mq.matches);
    document.documentElement.classList.toggle('dark', dark);
    const mc = document.querySelector('meta[name="theme-color"]');
    if (mc) mc.setAttribute('content', dark ? '#0A0E1B' : '#F6F7FB');
    this.syncButtons();
  },
  syncButtons() {
    document.querySelectorAll('[data-theme-cycle]').forEach(b => {
      b.innerHTML = UI.icon(this.mode === 'dark' ? 'moon' : this.mode === 'light' ? 'sun' : 'monitor');
      const label = this.t ? '' : '';
      b.setAttribute('aria-label', Lang.t('s_appearance') + ': ' + Lang.t('theme_' + this.mode));
      b.title = Lang.t('theme_' + this.mode);
    });
    document.querySelectorAll('[data-theme-radio]').forEach(r => {
      const on = r.dataset.themeRadio === this.mode;
      r.classList.toggle('on', on); r.setAttribute('aria-checked', on);
    });
  },
  set(m) { this.mode = m; Store.setSetting('theme', m); this.apply(); },
  cycle() { this.set(this.mode === 'dark' ? 'light' : this.mode === 'light' ? 'system' : 'dark'); },
  init() {
    this.mode = Store.settings.theme || 'system';
    this.mq.addEventListener('change', () => { if (this.mode === 'system') this.apply(); });
    this.apply();
    document.querySelectorAll('[data-theme-cycle]').forEach(b => b.addEventListener('click', () => this.cycle()));
  }
};