const Settings = {
  open(section) {
    const s = Store.settings;
    const el = document.createElement('div');
    el.className = 'settings';
    el.innerHTML = `
      <section>
        <h3>${Lang.t('s_general')}</h3>
        <div class="set-row"><label>${Lang.t('s_language')}</label>
          <div class="seg">
            <button data-setlang="ar" class="${s.lang === 'ar' ? 'on' : ''}">العربية</button>
            <button data-setlang="en" class="${s.lang === 'en' ? 'on' : ''}">English</button>
          </div></div>
        <div class="set-row"><label>${Lang.t('s_appearance')}</label>
          <div class="theme-radios">
            ${['dark', 'light', 'system'].map(m => `<button role="radio" aria-checked="false" data-theme-radio="${m}" class="theme-radio">${UI.icon(m === 'dark' ? 'moon' : m === 'light' ? 'sun' : 'monitor', 16)}<span>${Lang.t('theme_' + m)}</span></button>`).join('')}
          </div></div>
      </section>
      <section>
        <h3>${Lang.t('s_chat')}</h3>
        ${this.toggle('enterToSend', Lang.t('s_enter_send'))}
        ${this.toggle('timestamps', Lang.t('s_timestamps'))}
        ${this.toggle('streaming', Lang.t('s_streaming'))}
        ${this.toggle('markdown', Lang.t('s_markdown'))}
        ${this.toggle('autoFallback', Lang.t('s_fallback'), Lang.t('s_fallback_desc'))}
      </section>
      <section>
        <h3>${Lang.t('s_ai')}</h3>
        <div class="set-row"><label>${Lang.t('s_default_model')}</label>
          <select id="defModelSel" class="select">
            <option value="">${Lang.t('s_default_auto')}</option>
            ${ModelsAPI.providers().map(p => `<optgroup label="${UI.esc(p.name)}">` +
              p.models.map(m => `<option value="${p.id}|${m.id}" ${s.defaultProvider === p.id && s.defaultModel === m.id ? 'selected' : ''}>${UI.esc(m.label)}</option>`).join('') + '</optgroup>').join('')}
          </select></div>
      </section>
      <section>
        <h3>${Lang.t('s_usage')}</h3>
        <div id="usageBox" class="usage-box"><span class="spin-dot"></span></div>
        <p class="set-note">${Lang.t('feat_free_note')}</p>
      </section>
      <section>
        <h3>${Lang.t('s_data')}</h3>
        <div class="set-row btns">
          <button class="btn-ghost" id="exportAllBtn">${UI.icon('download', 16)}<span>${Lang.t('s_export_all')}</span></button>
          <button class="btn-danger-ghost" id="clearAllBtn">${UI.icon('trash', 16)}<span>${Lang.t('s_clear_all')}</span></button>
        </div>
      </section>
      <section>
        <h3>${Lang.t('s_shortcuts')}</h3>
        <div class="shortcuts">
          <div><span>${Lang.t('sc_search')}</span><kbd>Ctrl</kbd><kbd>K</kbd></div>
          <div><span>${Lang.t('sc_new')}</span><kbd>Ctrl</kbd><kbd>Shift</kbd><kbd>N</kbd></div>
          <div><span>${Lang.t('sc_send')}</span><kbd>Enter</kbd></div>
          <div><span>${Lang.t('sc_newline')}</span><kbd>Shift</kbd><kbd>Enter</kbd></div>
          <div><span>${Lang.t('sc_close')}</span><kbd>Esc</kbd></div>
        </div>
      </section>
      <section>
        <h3>${Lang.t('about_platform')}</h3>
        <p class="set-note">${Lang.t('about_p1')}</p>
        <p class="set-note dev">${UI.esc(Lang.t('developed_by'))}</p>
      </section>`;
    el.querySelectorAll('[data-setlang]').forEach(b => b.addEventListener('click', () => {
      Lang.set(b.dataset.setlang);
      el.querySelectorAll('[data-setlang]').forEach(x => x.classList.toggle('on', x === b));
    }));
    el.querySelectorAll('[data-theme-radio]').forEach(b => b.addEventListener('click', () => Theme.set(b.dataset.themeRadio)));
    el.querySelectorAll('[data-switch]').forEach(b => b.addEventListener('click', () => {
      const k = b.dataset.switch, on = b.getAttribute('aria-checked') !== 'true';
      b.setAttribute('aria-checked', on); Store.setSetting(k, on);
      if (k === 'timestamps' || k === 'markdown') Chat.renderMessages();
    }));
    el.querySelector('#defModelSel').addEventListener('change', e => {
      const v = e.target.value;
      if (!v) { Store.setSetting('defaultProvider', null); Store.setSetting('defaultModel', null); }
      else { const [p, m] = v.split('|'); Store.setSetting('defaultProvider', p); Store.setSetting('defaultModel', m); }
      Chat.updateModelBtn();
    });
    el.querySelector('#exportAllBtn').addEventListener('click', () => {
      download('mohsen-ai-chats.json', 'application/json', JSON.stringify(Store.conversations(), null, 2));
      UI.toast(Lang.t('t_exported'), 'ok');
    });
    el.querySelector('#clearAllBtn').addEventListener('click', async () => {
      if (await UI.confirm({ title: Lang.t('s_clear_all'), message: Lang.t('s_clear_confirm'), danger: true })) {
        Store.clearAll(); Chat.conv = null; Chat.renderSidebar(); Chat.renderMessages();
        UI.toast(Lang.t('t_cleared'), 'ok');
      }
    });
    const m = UI.modal({ title: Lang.t('settings'), body: el, wide: true });
    this.loadUsage(el.querySelector('#usageBox'));
    Theme.syncButtons();
    if (section) {
      const sec = [...el.querySelectorAll('section')].find(x => x.dataset.sec === section);
      if (sec) sec.scrollIntoView();
    }
    return m;
  },
  toggle(key, label, desc) {
    const on = Store.settings[key];
    return `<div class="set-row"><div><label>${label}</label>${desc ? `<p class="set-desc">${desc}</p>` : ''}</div>
      <button class="switch" role="switch" aria-checked="${on}" data-switch="${key}"><span class="knob"></span></button></div>`;
  },
  async loadUsage(box) {
    try {
      const r = await fetch('/api/usage', { headers: { 'X-Anon-Id': Store.anonId() } });
      if (!r.ok) throw 0;
      const u = await r.json();
      const bar = (used, limit, label) => `
        <div class="usage-row"><div class="usage-label"><span>${label}</span><span>${used} / ${limit}</span></div>
        <div class="usage-track"><div class="usage-fill" style="width:${Math.min(100, used / limit * 100)}%"></div></div></div>`;
      box.innerHTML = bar(u.hourly.used, u.hourly.limit, Lang.t('s_per_hour')) + bar(u.daily.used, u.daily.limit, Lang.t('s_per_day'));
    } catch { box.innerHTML = `<p class="set-note">${Lang.t('feat_free_note')}</p>`; }
  }
};
function download(name, mime, content) {
  const blob = new Blob([content], { type: mime });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob); a.download = name;
  document.body.appendChild(a); a.click();
  setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 500);
}