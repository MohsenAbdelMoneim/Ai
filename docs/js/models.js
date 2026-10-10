const ModelsAPI = {
  data: { providers: [], limits: {} },
  loaded: false,
  async load(force) {
    if (this.loaded && !force) return this.data;
    try {
      const r = await fetch('/api/models', { headers: { 'X-Anon-Id': Store.anonId() } });
      if (r.ok) { this.data = await r.json(); this.loaded = true; }
    } catch (e) { /* offline or static hosting */ }
    return this.data;
  },
  providers() { return this.data.providers || []; },
  limits() { return this.data.limits || {}; },
  hasModels() { return this.providers().length > 0; },
  find(providerId, modelId) {
    const p = this.providers().find(x => x.id === providerId);
    if (!p) return null;
    return { provider: p, model: p.models.find(m => m.id === modelId) || p.models[0] };
  },
  current() {
    const s = Store.settings;
    return (s.defaultProvider && this.find(s.defaultProvider, s.defaultModel)) || (this.providers()[0] ? this.find(this.providers()[0].id) : null);
  },
  tierLabel(tier) { return Lang.t(tier === 'free' ? 'tier_free' : tier === 'free_tier' ? 'tier_free_tier' : 'tier_paid'); },
  speedLabel(speed) { return Lang.t('speed_' + speed); },
  // Premium selector: anchored popover on desktop, bottom sheet on mobile.
  openSelector(anchor, onPick) {
    document.querySelectorAll('.model-pop').forEach(m => m.remove());
    const provs = this.providers();
    const cur = this.current();
    const pop = document.createElement('div');
    pop.className = 'model-pop'; pop.setAttribute('role', 'dialog');
    pop.innerHTML = `<div class="mp-head">${Lang.t('select_model')}</div><div class="mp-list"></div>`;
    const list = pop.querySelector('.mp-list');
    provs.forEach(p => {
      const g = document.createElement('div'); g.className = 'mp-group';
      g.innerHTML = `<div class="mp-provider"><span class="pdot" style="background:${p.color}"></span><b></b></div>`;
      g.querySelector('b').textContent = p.name;
      p.models.forEach(m => {
        const row = document.createElement('button');
        row.type = 'button'; row.className = 'mp-row';
        if (cur && cur.provider.id === p.id && cur.model.id === m.id) row.classList.add('sel');
        row.innerHTML = `<span class="mp-name"></span>
          <span class="mp-badges">
            <span class="badge tier-${m.tier}">${this.tierLabel(m.tier)}</span>
            <span class="badge ctx">${m.context} ${Lang.t('ctx_tokens')}</span>
            <span class="badge speed">${this.speedLabel(m.speed)}</span>
          </span><span class="mp-check">${UI.icon('check', 16)}</span>`;
        row.querySelector('.mp-name').textContent = m.label;
        row.addEventListener('click', () => { pop.remove(); document.removeEventListener('click', out, true); onPick(p, m); });
        g.appendChild(row);
      });
      list.appendChild(g);
    });
    document.body.appendChild(pop);
    const close = () => { pop.remove(); document.removeEventListener('click', out, true); document.removeEventListener('keydown', esc, true); };
    const out = e => { if (!pop.contains(e.target) && e.target !== anchor && !anchor.contains(e.target)) close(); };
    const esc = e => { if (e.key === 'Escape') { e.stopPropagation(); close(); } };
    setTimeout(() => { document.addEventListener('click', out, true); document.addEventListener('keydown', esc, true); });
    if (window.innerWidth > 640) {
      const r = anchor.getBoundingClientRect();
      const w = pop.offsetWidth, h = pop.offsetHeight;
      let left = Math.max(8, Math.min(r.left, window.innerWidth - w - 8));
      let top = r.top - h - 8; if (top < 8) top = r.bottom + 8;
      pop.style.left = left + 'px'; pop.style.top = top + 'px';
    }
  }
};