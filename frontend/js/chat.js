const Chat = {
  conv: null, generating: false, ctrl: null, tab: 'convs',
  attachments: [], _imgCache: {}, _paintQueued: false, webSearch: 'off',

  async init() {
    this.$ = sel => document.querySelector(sel);

    // ✅ حماية: لو أي API ناقص، منكملش
    if (typeof Lang === 'undefined') { console.error('Lang missing'); return; }
    if (typeof Theme === 'undefined') { console.error('Theme missing'); return; }
    if (typeof UI === 'undefined') { console.error('UI missing'); return; }
    if (typeof Store === 'undefined') { console.error('Store missing'); return; }
    if (typeof ModelsAPI === 'undefined') { console.error('ModelsAPI missing'); return; }
    if (typeof MD === 'undefined') { console.error('MD missing'); return; }
    if (typeof Settings === 'undefined') { console.error('Settings missing'); return; }

    try {
      this.bindSidebar();
      this.bindComposer();
      this.bindTopbar();
      this.bindMessages();

      await ModelsAPI.load();

      const wsBtn0 = this.$('#webSearchBtn');
      if (wsBtn0) {
        wsBtn0.hidden = !ModelsAPI.data.search;
        if (!wsBtn0.hidden) wsBtn0.querySelector('.ws-label').textContent = Lang.t('web_search');
      }

      const last = Store.settings.lastConv;
      if (last && Store.get(last)) this.open(last); else this.newChat();

      this.renderSidebar();
      this.updateModelBtn();
      this.refreshUsage();

      document.addEventListener('langchange', () => this.renderAll());
    } catch (e) {
      console.error('Chat.init failed:', e);
    }
  },

  renderAll() { this.renderSidebar(); this.renderMessages(); this.updateModelBtn(); this.syncTopbar(); },

  bindSidebar() {
    const safe = (sel, fn) => { const el = this.$(sel); if (el) el.addEventListener('click', fn); };

    safe('#newChatBtn', () => this.newChat());
    safe('#searchBtn', () => this.searchModal());
    safe('#settingsBtn', () => Settings.open('settings'));
    safe('#aboutBtn', () => Settings.open('about'));

    document.querySelectorAll('.sb-tabs [data-tab]').forEach(b =>
      b.addEventListener('click', () => {
        this.tab = b.dataset.tab;
        document.querySelectorAll('.sb-tabs [data-tab]').forEach(x => {
          const on = x === b;
          x.classList.toggle('on', on);
          x.setAttribute('aria-selected', on);
        });
        this.renderSidebar();
      }));

    safe('#menuBtn', () => this.drawer(true));
    safe('#sbClose', () => this.drawer(false));
    safe('#scrim', () => this.drawer(false));
  },

  drawer(open) {
    const sb = this.$('#sidebar'); if (sb) sb.classList.toggle('open', open);
    const sc = this.$('#scrim'); if (sc) sc.hidden = !open;
  },

  renderSidebar() {
    const listEl = this.$('#convList'); if (!listEl) return;
    let items = Store.conversations();
    if (this.tab === 'favs') items = items.filter(c => c.favorite);
    else items = [...items].sort((a, b) => (b.pinned ? 1 : 0) - (a.pinned ? 1 : 0) || b.updatedAt - a.updatedAt);
    listEl.innerHTML = '';
    if (!items.length) {
      const e = document.createElement('div');
      e.className = 'sb-empty';
      e.innerHTML = UI.icon(this.tab === 'favs' ? 'star' : 'message', 22) + '<p></p><span></span>';
      e.querySelector('p').textContent = this.tab === 'favs' ? Lang.t('empty_favs') : Lang.t('empty_convs');
      e.querySelector('span').textContent = this.tab === 'favs' ? Lang.t('empty_favs_hint') : Lang.t('empty_convs_hint');
      listEl.appendChild(e);
      return;
    }
    items.forEach(c => listEl.appendChild(this.convItem(c)));
  },

  convItem(c) {
    const el = document.createElement('div');
    el.className = 'conv-item' + (this.conv && this.conv.id === c.id ? ' active' : '') + (c.pinned ? ' pinned' : '');
    el.dataset.id = c.id;
    el.tabIndex = 0;
    el.setAttribute('role', 'button');
    const last = (c.messages && c.messages.length) ? c.messages[c.messages.length - 1].content.replace(/\s+/g, ' ').slice(0, 70) : '';
    el.innerHTML = '<div class="conv-main"><span class="conv-title"></span><span class="conv-last"></span></div>' +
      '<div class="conv-side"><span class="conv-time">' + UI.time(c.updatedAt) + '</span>' +
      '<button class="icon-btn conv-menu" aria-label="' + Lang.t('settings') + '">' + UI.icon('more', 15) + '</button></div>' +
      '<div class="conv-flags">' + (c.pinned ? UI.icon('pin', 12) : '') + (c.favorite ? UI.icon('star', 12) : '') + '</div>';
    el.querySelector('.conv-title').textContent = c.title;
    el.querySelector('.conv-last').textContent = last;
    el.addEventListener('click', e => { if (e.target.closest('.conv-menu')) return; this.open(c.id); });
    el.addEventListener('keydown', e => { if (e.key === 'Enter') this.open(c.id); });
    el.querySelector('.conv-menu').addEventListener('click', e => {
      e.stopPropagation();
      UI.popover(e.currentTarget, [
        { id: 'rename', icon: 'pencil', label: Lang.t('rename') },
        { id: 'pin', icon: 'pin', label: Lang.t(c.pinned ? 'unpin' : 'pin') },
        { id: 'fav', icon: 'star', label: Lang.t(c.favorite ? 'remove_favorite' : 'add_favorite') },
        { id: 'del', icon: 'trash', label: Lang.t('delete'), danger: true }
      ], act => {
        if (act === 'rename') this.renameInline(el, c);
        if (act === 'pin') { c.pinned = !c.pinned; Store.upsert(c); this.renderSidebar(); UI.toast(Lang.t(c.pinned ? 't_pinned' : 't_unpinned'), 'ok'); }
        if (act === 'fav') { c.favorite = !c.favorite; Store.upsert(c); this.renderSidebar(); this.syncTopbar(); UI.toast(Lang.t(c.favorite ? 't_fav' : 't_unfav'), 'ok'); }
        if (act === 'del') this.deleteConv(c);
      });
    });
    return el;
  },

  renameInline(el, c) {
    const span = el.querySelector('.conv-title');
    const inp = document.createElement('input');
    inp.className = 'conv-rename';
    inp.value = c.title;
    inp.maxLength = 80;
    span.replaceWith(inp);
    inp.focus(); inp.select();
    const done = save => {
      if (save && inp.value.trim()) { c.title = inp.value.trim(); Store.upsert(c); UI.toast(Lang.t('t_renamed'), 'ok'); }
      this.renderSidebar(); this.syncTopbar();
    };
    inp.addEventListener('keydown', e => { if (e.key === 'Enter') done(true); if (e.key === 'Escape') done(false); });
    inp.addEventListener('blur', () => done(true));
    inp.addEventListener('click', e => e.stopPropagation());
  },

  async deleteConv(c) {
    if (await UI.confirm({ title: Lang.t('delete_confirm_title'), message: Lang.t('delete_confirm_msg'), danger: true })) {
      Store.remove(c.id);
      if (this.conv && this.conv.id === c.id) this.newChat();
      this.renderSidebar();
      UI.toast(Lang.t('t_deleted'), 'ok');
    }
  },

  open(id) {
    this.conv = Store.get(id);
    Store.setSetting('lastConv', id);
    this.renderMessages();
    this.renderSidebar();
    this.syncTopbar();
    this.updateModelBtn();
    if (window.innerWidth < 1024) this.drawer(false);
  },

  newChat() {
    this.conv = null;
    Store.setSetting('lastConv', null);
    this.renderMessages();
    this.renderSidebar();
    this.syncTopbar();
    this.updateModelBtn();
    if (window.innerWidth < 1024) this.drawer(false);
    const inp = this.$('#input');
    if (inp) inp.focus();
  },

  bindTopbar() {
    const safe = (sel, fn) => { const el = this.$(sel); if (el) el.addEventListener('click', fn); };

    safe('#topFavBtn', () => {
      if (!this.conv) return;
      this.conv.favorite = !this.conv.favorite;
      Store.upsert(this.conv);
      this.renderSidebar();
      this.syncTopbar();
      UI.toast(Lang.t(this.conv.favorite ? 't_fav' : 't_unfav'), 'ok');
    });

    safe('#exportBtn', e => {
      if (!this.conv || !this.conv.messages.length) return;
      UI.popover(e.currentTarget, [
        { id: 'txt', icon: 'file', label: Lang.t('exp_txt') },
        { id: 'md', icon: 'code', label: Lang.t('exp_md') },
        { id: 'json', icon: 'file', label: Lang.t('exp_json') },
        { id: 'print', icon: 'printer', label: Lang.t('exp_print') }
      ], id => this.doExport(id));
    });
  },

  syncTopbar() {
    const t = this.$('#convTitle'), f = this.$('#topFavBtn');
    if (!t) return;
    t.textContent = this.conv ? this.conv.title : Lang.t('new_chat');
    if (f) f.classList.toggle('active', !!(this.conv && this.conv.favorite));
    const cur = this.currentModel();
    const meta = this.$('#convMeta');
    if (meta) meta.textContent = cur ? cur.provider.name + ' · ' + cur.model.label : '';
  },

  bindMessages() {
    const box = this.$('#messages'); if (!box) return;
    box.addEventListener('click', e => {
      const cc = e.target.closest('[data-code-copy]');
      if (cc) {
        const code = cc.closest('.code-block').querySelector('pre code').textContent;
        UI.copyText(code);
        UI.toast(Lang.t('copied'), 'ok');
        cc.innerHTML = UI.icon('check', 14);
        setTimeout(() => { cc.innerHTML = UI.icon('copy', 14); }, 1500);
        return;
      }
      const cr = e.target.closest('[data-code-run]');
      if (cr) {
        const code = cr.closest('.code-block').querySelector('pre code').textContent;
        const preview = UI.modal({ title: Lang.t('code_preview'), body: document.createElement('div'), wide: true });
        const frame = document.createElement('iframe');
        frame.className = 'code-preview';
        frame.setAttribute('sandbox', 'allow-scripts allow-modals');
        frame.srcdoc = code;
        preview.el.querySelector('.modal-body').appendChild(frame);
        return;
      }
      const qa = e.target.closest('[data-qa]');
      if (qa) {
        const inp = this.$('#input');
        inp.value = Lang.t(qa.dataset.qa);
        this.autosize();
        inp.focus();
        inp.setSelectionRange(inp.value.length, inp.value.length);
        return;
      }
      const btn = e.target.closest('[data-act]');
      if (!btn || !this.conv) return;
      const wrap = e.target.closest('.msg');
      const m = this.conv.messages.find(x => x.id === (wrap && wrap.dataset.id));
      if (!m) return;
      const act = btn.dataset.act;
      if (act === 'copy') { UI.copyText(m.content); UI.toast(Lang.t('copied'), 'ok'); }
      if (act === 'regen' || act === 'retry') this.regenerate();
      if (act === 'like') { m.liked = !m.liked; if (m.liked) m.disliked = false; Store.upsert(this.conv); this.refreshMsg(m); }
      if (act === 'dislike') { m.disliked = !m.disliked; if (m.disliked) m.liked = false; Store.upsert(this.conv); this.refreshMsg(m); }
      if (act === 'edit') this.editMessage(m, wrap);
    });
  },

  renderMessages() {
    const box = this.$('#messagesInner'); if (!box) return;
    box.innerHTML = '';
    if (!this.conv || !this.conv.messages.length) { box.appendChild(this.welcomeEl()); this.syncTopbar(); return; }
    this.conv.messages.forEach(m => box.appendChild(this.msgEl(m)));
    const sc = this.$('#messages');
    if (sc) sc.scrollTop = sc.scrollHeight;
  },

  welcomeEl() {
    const w = document.createElement('div');
    w.className = 'welcome';
    w.innerHTML = '<div class="w-logo">' + logoSvg(52) + '</div>' +
      '<h2>Mohsen AI</h2>' +
      '<p class="w-tag">' + Lang.t('tagline') + '</p>' +
      '<p class="w-sub">' + Lang.t('welcome_sub') + '</p>' +
      '<div class="qa-grid">' +
      [['code', 'qa_code', 'qa_code_p'], ['cap', 'qa_learn', 'qa_learn_p'], ['pen', 'qa_write', 'qa_write_p'],
       ['book', 'qa_summarize', 'qa_summarize_p'], ['chart', 'qa_analyze', 'qa_analyze_p'], ['bulb', 'qa_brainstorm', 'qa_brainstorm_p']]
        .map(p => '<button type="button" class="qa-card" data-qa="' + p[2] + '">' +
          '<span class="qa-ic">' + UI.icon(p[0], 18) + '</span>' +
          '<span class="qa-label">' + Lang.t(p[1]) + '</span>' +
          '<span class="qa-arrow">' + UI.icon('chevron', 14) + '</span></button>').join('') +
      '</div>' +
      (ModelsAPI.hasModels() ? '' : '<div class="no-providers">' + UI.icon('alert', 18) + '<p>' + Lang.t('err_no_providers') + '</p></div>');
    return w;
  },

  msgEl(m) {
    const el = document.createElement('div');
    el.className = 'msg ' + (m.role === 'user' ? 'user' : 'ai');
    el.dataset.id = m.id;
    if (m.role === 'user') {
      el.innerHTML = '<div class="u-col"><div class="u-bubble" dir="auto"><div class="u-text"></div></div>' +
        this.userActions() + this.timeEl(m) + '</div>';
      this.paintUser(el.querySelector('.u-text'), m);
    } else {
      el.innerHTML = '<div class="ai-row"><div class="ai-avatar">' + logoSvg(20) + '</div><div class="ai-body">' +
        '<div class="ai-head"><span class="ai-model"></span><span class="ai-prov"></span></div>' +
        '<div class="ai-bubble" dir="auto"></div>' + this.aiActions(m) + this.timeEl(m) + '</div></div>';
      el.querySelector('.ai-model').textContent = m.model || '';
      el.querySelector('.ai-prov').textContent = m.providerName || '';
      this.paintAI(el, m);
    }
    return el;
  },

  paintUser(t, m) {
    t.textContent = m.content;
    if (m.attachments && m.attachments.length) {
      const a = document.createElement('div');
      a.className = 'u-atts';
      m.attachments.forEach(x => {
        const c = document.createElement('span');
        c.className = 'att-chip';
        c.innerHTML = UI.icon(x.type === 'image' ? 'image' : 'file', 13);
        c.appendChild(document.createTextNode(x.name || x.type));
        a.appendChild(c);
      });
      t.parentNode.insertBefore(a, t.nextSibling);
    }
  },

  userActions() {
    return '<div class="msg-actions">' +
      '<button class="act" data-act="copy" title="' + Lang.t('copy') + '">' + UI.icon('copy', 15) + '</button>' +
      '<button class="act" data-act="edit" title="' + Lang.t('edit_msg') + '">' + UI.icon('pencil', 15) + '</button></div>';
  },

  aiActions(m) {
    return '<div class="msg-actions">' +
      '<button class="act" data-act="copy" title="' + Lang.t('copy') + '">' + UI.icon('copy', 15) + '</button>' +
      '<button class="act" data-act="regen" title="' + Lang.t('regenerate') + '">' + UI.icon('refresh', 15) + '</button>' +
      (m.error ? '<button class="act" data-act="retry" title="' + Lang.t('retry') + '">' + UI.icon('rotate', 15) + '</button>' : '') +
      '<span class="act-sep"></span>' +
      '<button class="act fb ' + (m.liked ? 'on' : '') + '" data-act="like" title="' + Lang.t('like') + '">' + UI.icon('up', 15) + '</button>' +
      '<button class="act fb ' + (m.disliked ? 'on' : '') + '" data-act="dislike" title="' + Lang.t('dislike') + '">' + UI.icon('down', 15) + '</button></div>';
  },

  timeEl(m) { return Store.settings.timestamps ? '<div class="msg-time">' + UI.fmtTime(m.ts) + '</div>' : ''; },

  paintAI(wrap, m) {
    const b = wrap.querySelector('.ai-bubble'); if (!b) return;
    if (m.error) {
      const key = m.error === 'RATE_LIMIT' ? 'err_rate' : m.error === 'NO_PROVIDERS' ? 'err_no_providers'
        : m.error === 'NETWORK' ? 'err_network' : m.error === 'MESSAGE_TOO_LONG' ? 'err_length'
        : m.error === 'PAYMENT' ? 'err_payment' : 'err_provider';
      b.innerHTML = '<div class="msg-error">' + UI.icon('alert', 16) + '<span>' + Lang.t(key) + '</span></div>';
    } else if (m.streaming && !m.content && !(m.images && m.images.length)) {
      b.innerHTML = '<div class="thinking"><span class="tdot"></span><span class="tdot"></span><span class="tdot"></span>' +
        '<span class="t-label">' + Lang.t('thinking') + '</span></div>';
    } else {
      const html = Store.settings.markdown ? MD.render(m.content) : MD.plain(m.content);
      b.innerHTML = html + (m.streaming ? '<span class="stream-caret"></span>' : '');
      if (m.images && m.images.length) {
        b.insertAdjacentHTML('beforeend', '<div class="msg-images">' +
          m.images.map(im => '<img src="data:' + im.mime + ';base64,' + im.data + '" alt="" loading="lazy">').join('') + '</div>');
      }
      if (m.fallback) b.insertAdjacentHTML('afterbegin', '<div class="notice">' + UI.icon('refresh', 13) + Lang.t('fallback_notice') + '</div>');
      if (m.stopped) b.insertAdjacentHTML('beforeend', '<div class="notice">' + UI.icon('square', 13) + Lang.t('stopped_notice') + '</div>');
    }
    const acts = wrap.querySelector('.msg-actions');
    if (acts) acts.outerHTML = this.aiActions(m);
  },

  refreshMsg(m) {
    const el = this.$('#messages .msg[data-id="' + m.id + '"]');
    if (el) el.replaceWith(this.msgEl(m));
  },

  bindComposer() {
    const ta = this.$('#input'), form = this.$('#composer');
    if (!ta || !form) return;
    ta.addEventListener('input', () => { this.autosize(); this.lenCheck(); });
    ta.addEventListener('keydown', e => {
      if (e.key === 'Enter' && !e.shiftKey && !e.isComposing && Store.settings.enterToSend && matchMedia('(pointer:fine)').matches) {
        e.preventDefault();
        form.requestSubmit();
      }
    });
    form.addEventListener('submit', e => { e.preventDefault(); this.submit(); });

    const safe = (sel, fn) => { const el = this.$(sel); if (el) el.addEventListener('click', fn); };
    safe('#stopBtn', () => this.stop());
    safe('#attachBtn', () => this.$('#fileInput').click());
    const fi = this.$('#fileInput');
    if (fi) fi.addEventListener('change', e => this.handleFiles(e.target.files));

    const wsBtn = this.$('#webSearchBtn');
    if (wsBtn) {
      wsBtn.addEventListener('click', () => {
        this.webSearch = this.webSearch === 'web' ? 'deep' : this.webSearch === 'deep' ? 'off' : 'web';
        wsBtn.classList.toggle('on', this.webSearch !== 'off');
        wsBtn.querySelector('.ws-label').textContent = this.webSearch === 'deep' ? Lang.t('deep_search') : Lang.t('web_search');
        UI.toast((this.webSearch === 'deep' ? Lang.t('deep_search') : Lang.t('web_search')) + ': ' + (this.webSearch === 'off' ? 'OFF' : 'ON'), 'info');
      });
    }

    const mb = this.$('#modelBtn');
    if (mb) {
      mb.addEventListener('click', e => {
        if (!ModelsAPI.hasModels()) { UI.toast(Lang.t('err_no_providers'), 'warn'); return; }
        ModelsAPI.openSelector(e.currentTarget, (p, m) => {
          Store.setSetting('defaultProvider', p.id);
          Store.setSetting('defaultModel', m.id);
          if (this.conv && this.conv.messages.length) {
            this.conv.provider = p.id;
            this.conv.model = m.id;
            Store.upsert(this.conv);
          }
          this.updateModelBtn();
          this.syncTopbar();
        });
      });
    }
  },

  autosize() {
    const ta = this.$('#input'); if (!ta) return;
    ta.style.height = 'auto';
    ta.style.height = Math.min(ta.scrollHeight, 180) + 'px';
  },

  lenCheck() {
    const max = ModelsAPI.limits().maxMessageLength || 60000;
    const c = this.$('#lenCounter'), v = this.$('#input').value.length;
    if (!c) return;
    if (v > max * 0.7) { c.hidden = false; c.textContent = v + ' / ' + max; c.classList.toggle('over', v > max); }
    else c.hidden = true;
  },

  currentModel() {
    if (this.conv && this.conv.provider) return ModelsAPI.find(this.conv.provider, this.conv.model);
    return ModelsAPI.current();
  },

  updateModelBtn() {
    const btn = this.$('#modelBtn'); if (!btn) return;
    btn.disabled = !ModelsAPI.hasModels();
    const cur = this.currentModel();
    btn.innerHTML = cur
      ? '<span class="pdot" style="background:' + cur.provider.color + '"></span><span class="mb-label"></span>' + UI.icon('chevron', 14)
      : '<span class="mb-label">' + Lang.t('select_model') + '</span>' + UI.icon('chevron', 14);
    if (cur) btn.querySelector('.mb-label').textContent = cur.model.label;
  },

  async handleFiles(files) {
    for (const f of files) {
      const ext = (f.name.split('.').pop() || '').toLowerCase();
      if (f.type.startsWith('image/')) {
        if (!['image/png', 'image/jpeg', 'image/webp'].includes(f.type)) { UI.toast(Lang.t('err_attach_type'), 'warn'); continue; }
        if (f.size > 3.5 * 1024 * 1024) { UI.toast(Lang.t('err_attach_size'), 'warn'); continue; }
        const data = await new Promise(res => { const r = new FileReader(); r.onload = () => res(r.result.split(',')[1]); r.readAsDataURL(f); });
        this.attachments.push({ type: 'image', mime: f.type, name: f.name, data });
      } else if (['txt', 'md', 'csv', 'log', 'json'].includes(ext)) {
        if (f.size > 200 * 1024) { UI.toast(Lang.t('err_attach_size'), 'warn'); continue; }
        this.attachments.push({ type: 'text', name: f.name, text: await f.text() });
      } else {
        UI.toast(Lang.t('err_attach_type'), 'warn');
      }
    }
    this.renderAttachBar();
    const fi = this.$('#fileInput'); if (fi) fi.value = '';
  },

  renderAttachBar() {
    const bar = this.$('#attachBar'); if (!bar) return;
    bar.hidden = !this.attachments.length;
    bar.innerHTML = this.attachments.map((a, i) =>
      '<span class="att-chip">' + UI.icon(a.type === 'image' ? 'image' : 'file', 13) + UI.esc(a.name) +
      '<button type="button" data-rm="' + i + '" aria-label="' + Lang.t('delete') + '">' + UI.icon('x', 12) + '</button></span>').join('');
    bar.querySelectorAll('[data-rm]').forEach(b => b.addEventListener('click', () => {
      this.attachments.splice(+b.dataset.rm, 1);
      this.renderAttachBar();
    }));
  },

  async submit() {
    if (this.generating) return;
    const ta = this.$('#input');
    let text = ta.value.trim();
    const atts = this.attachments.slice();
    if (!text && !atts.length) return;
    const cur = this.currentModel();
    if (!cur) { UI.toast(Lang.t('err_no_providers'), 'warn'); return; }
    const images = atts.filter(a => a.type === 'image');
    if (images.length && !(cur.provider.attachments || []).includes('image')) { UI.toast(Lang.t('err_attach_type'), 'warn'); return; }
    const textAtts = atts.filter(a => a.type === 'text');
    if (textAtts.length) text += textAtts.map(a => '\n\n[' + a.name + ']\n```\n' + a.text + '\n```').join('');
    const max = ModelsAPI.limits().maxMessageLength || 60000;
    if (text.length > max) { UI.toast(Lang.t('err_length'), 'warn'); return; }

    const um = {
      id: UI.uid(), role: 'user', content: text, ts: Date.now(),
      attachments: atts.map(a => ({ type: a.type, name: a.name }))
    };
    if (images.length) this._imgCache[um.id] = images;
    if (!this.conv) {
      this.conv = {
        id: 'c_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
        title: this.titleFrom(text),
        createdAt: Date.now(), updatedAt: Date.now(),
        pinned: false, favorite: false,
        provider: cur.provider.id, model: cur.model.id, messages: []
      };
    }
    this.conv.provider = cur.provider.id;
    this.conv.model = cur.model.id;
    this.conv.messages.push(um);
    this.conv.updatedAt = Date.now();
    ta.value = '';
    this.autosize();
    this.lenCheck();
    this.attachments = [];
    this.renderAttachBar();
    Store.upsert(this.conv);
    Store.setSetting('lastConv', this.conv.id);
    this.renderSidebar();
    this.renderMessages();
    await this.generate(images);
  },

  async generate(images) {
    images = images || [];
    if (!this.conv || this.generating) return;
    const cur = this.currentModel();
    if (!cur) { UI.toast(Lang.t('err_no_providers'), 'warn'); return; }
    const lastUser = [...this.conv.messages].reverse().find(m => m.role === 'user');
    const imgs = images.length ? images : ((lastUser && this._imgCache[lastUser.id]) || []);
    const am = {
      id: UI.uid(), role: 'assistant', content: '', ts: Date.now(),
      provider: cur.provider.id, providerName: cur.provider.name, model: cur.model.label, streaming: true
    };
    this.conv.messages.push(am);
    Store.upsert(this.conv);
    const inner = this.$('#messagesInner');
    const el = this.msgEl(am);
    inner.appendChild(el);
    const sc = this.$('#messages');
    sc.scrollTop = sc.scrollHeight;
    this.setGenerating(true);
    const ctrl = new AbortController();
    this.ctrl = ctrl;
    try {
      const res = await fetch('/api/chat/stream', {
        method: 'POST', signal: ctrl.signal,
        headers: { 'Content-Type': 'application/json', 'X-Anon-Id': Store.anonId() },
        body: JSON.stringify({
          provider: cur.provider.id, model: cur.model.id,
          fallback: Store.settings.autoFallback,
          webSearch: this.webSearch === 'web' || this.webSearch === 'deep',
          deepSearch: this.webSearch === 'deep',
          messages: this.apiMessages(imgs, lastUser)
        })
      });
      if (!res.ok) { let code = 'GENERIC'; try { code = (await res.json()).error.code; } catch (e2) {} throw { code: code }; }
      const reader = res.body.getReader(), dec = new TextDecoder();
      let buf = '';
      while (true) {
        const r = await reader.read();
        if (r.done) break;
        buf += dec.decode(r.value, { stream: true });
        let i;
        while ((i = buf.indexOf('\n\n')) >= 0) {
          const part = buf.slice(0, i).trim();
          buf = buf.slice(i + 2);
          if (!part.startsWith('data:')) continue;
          const evt = JSON.parse(part.slice(5));
          if (evt.type === 'meta') {
            const f = ModelsAPI.find(evt.provider, evt.model);
            am.provider = evt.provider;
            if (f) { am.model = f.model.label; am.providerName = f.provider.name; }
            if (evt.fallback) { am.fallback = true; }
            const mh = el.querySelector('.ai-model'); if (mh) mh.textContent = am.model;
            const ph = el.querySelector('.ai-prov'); if (ph) ph.textContent = am.providerName;
          } else if (evt.type === 'image') {
            (am.images = am.images || []).push({ mime: evt.mime, data: evt.data });
            this.queuePaint(el, am);
          } else if (evt.type === 'delta') {
            am.content += evt.content;
            this.queuePaint(el, am);
          } else if (evt.type === 'error') {
            throw { code: evt.code };
          } else if (evt.type === 'done') {
            buf = '';
            break;
          }
        }
      }
      am.streaming = false;
      if (!am.content.trim() && !(am.images && am.images.length)) am.error = 'GENERIC';
    } catch (e) {
      am.streaming = false;
      if (e.name === 'AbortError' || (ctrl.signal && ctrl.signal.aborted)) am.stopped = true;
      else if (e instanceof TypeError || e.code === 'NETWORK') am.error = 'NETWORK';
      else am.error = e.code || 'GENERIC';
    }
    this.setGenerating(false);
    this.ctrl = null;
    this.conv.updatedAt = Date.now();
    Store.upsert(this.conv);
    this.paintAI(el, am);
    this.renderSidebar();
    this.refreshUsage();
  },

  queuePaint(el, m) {
    if (this._paintQueued) return;
    this._paintQueued = true;
    setTimeout(() => {
      this._paintQueued = false;
      const sc = this.$('#messages');
      const nearBottom = sc.scrollHeight - sc.scrollTop - sc.clientHeight < 140;
      this.paintAI(el, m);
      if (nearBottom) sc.scrollTop = sc.scrollHeight;
    }, 90);
  },

  apiMessages(images, lastUser) {
    const msgs = this.conv.messages
      .filter(m => !m.error && !m.streaming && (m.content || m.role === 'user'))
      .map(m => ({ role: m.role, content: m.content || ' ' }));
    if (msgs.length && images.length && lastUser) {
      const last = msgs[msgs.length - 1];
      last.content = [
        { type: 'text', text: last.content || '' },
        ...images.map(a => ({ type: 'image', mime: a.mime, data: a.data }))
      ];
    }
    msgs.unshift({ role: 'system', content: 'You are Mohsen AI, a multi-model AI workspace created by Mohsen Tarek. Always respond in the same language the user writes in. Use Markdown for structure and fenced code blocks with a language tag.' });
    return msgs;
  },

  setGenerating(on) {
    this.generating = on;
    const sb = this.$('#sendBtn'), st = this.$('#stopBtn'), ms = this.$('#messages');
    if (sb) sb.hidden = on;
    if (st) st.hidden = !on;
    if (ms) ms.setAttribute('aria-busy', on);
  },

  stop() { if (this.ctrl) this.ctrl.abort(); },

  regenerate() {
    if (!this.conv || this.generating) return;
    const msgs = this.conv.messages;
    while (msgs.length && msgs[msgs.length - 1].role === 'assistant') msgs.pop();
    if (!msgs.length) return;
    Store.upsert(this.conv);
    this.renderMessages();
    this.generate();
  },

  editMessage(m, wrap) {
    const bubble = wrap.querySelector('.u-bubble');
    const ed = document.createElement('div');
    ed.className = 'edit-box';
    ed.innerHTML = '<textarea dir="auto"></textarea><div class="edit-actions">' +
      '<button class="btn-ghost e-cancel"></button><button class="btn-primary e-save"></button></div>';
    const ta = ed.querySelector('textarea');
    ta.value = m.content;
    ed.querySelector('.e-cancel').textContent = Lang.t('cancel');
    ed.querySelector('.e-save').textContent = Lang.t('save');
    bubble.replaceWith(ed);
    ta.focus();
    ed.querySelector('.e-cancel').addEventListener('click', () => this.renderMessages());
    ed.querySelector('.e-save').addEventListener('click', () => {
      const v = ta.value.trim();
      if (!v) return;
      m.content = v;
      const idx = this.conv.messages.findIndex(x => x.id === m.id);
      this.conv.messages = this.conv.messages.slice(0, idx + 1);
      Store.upsert(this.conv);
      this.renderMessages();
      this.generate();
    });
  },

  searchModal() {
    const body = document.createElement('div');
    body.innerHTML = '<input class="search-input" dir="auto"><div class="search-results"></div>';
    const inp = body.querySelector('.search-input');
    const out = body.querySelector('.search-results');
    inp.placeholder = Lang.t('search_ph');
    const run = UI.debounce(() => {
      const q = inp.value.trim().toLowerCase();
      out.innerHTML = '';
      if (q.length < 2) return;
      let n = 0;
      for (const c of Store.conversations()) {
        const hits = [];
        if (c.title.toLowerCase().includes(q)) hits.push({ id: null, text: c.title, isTitle: true });
        (c.messages || []).forEach(m => {
          const i = m.content.toLowerCase().indexOf(q);
          if (i >= 0) hits.push({ id: m.id, text: m.content, i: i });
        });
        if (!hits.length) continue;
        n++;
        const item = document.createElement('button');
        item.className = 'search-hit';
        const first = hits.find(h => !h.isTitle) || hits[0];
        item.innerHTML = '<div class="sh-title">' + UI.icon('message', 14) + '<b>' + this.hl(c.title, q) + '</b></div>' +
          '<div class="sh-snip">' + (first.isTitle ? UI.esc(Lang.t('conversations')) : this.snip(first.text, first.i, q)) + '</div>';
        item.addEventListener('click', () => { m.close(); this.open(c.id); if (first.id) this.jumpTo(first.id); });
        out.appendChild(item);
      }
      if (!n) out.innerHTML = '<div class="sb-empty" style="padding:24px 0"><p>' + Lang.t('search_no_results') + '</p></div>';
    }, 180);
    inp.addEventListener('input', run);
    setTimeout(() => inp.focus(), 100);
    const m = UI.modal({ title: Lang.t('search') + ' — ' + Lang.t('search_shortcut'), body, wide: true });
  },

  hl(text, q) {
    const i = text.toLowerCase().indexOf(q.toLowerCase());
    if (i < 0) return UI.esc(text);
    return UI.esc(text.slice(0, i)) + '<mark>' + UI.esc(text.slice(i, i + q.length)) + '</mark>' + UI.esc(text.slice(i + q.length));
  },

  snip(text, i, q) {
    const s = Math.max(0, i - 50);
    return UI.esc(text.slice(s, i)) + '<mark>' + UI.esc(text.slice(i, i + q.length)) + '</mark>' + UI.esc(text.slice(i + q.length, i + q.length + 90));
  },

  jumpTo(msgId) {
    setTimeout(() => {
      const el = this.$('#messages .msg[data-id="' + msgId + '"]');
      if (el) {
        el.scrollIntoView({ block: 'center' });
        el.classList.add('flash');
        setTimeout(() => el.classList.remove('flash'), 2000);
      }
    }, 150);
  },

  doExport(kind) {
    if (!this.conv) return;
    const c = this.conv;
    const name = 'mohsen-ai-' + c.title.replace(/[\\/:*?"<>|]/g, '').slice(0, 40);
    if (kind === 'print') {
      const prev = document.title;
      document.body.classList.add('printing');
      this.$('#messages').setAttribute('data-print', c.title);
      document.title = c.title + ' — Mohsen AI';
      const cleanup = () => {
        document.body.classList.remove('printing');
        document.title = prev;
        this.$('#messages').removeAttribute('data-print');
        window.removeEventListener('afterprint', cleanup);
      };
      window.addEventListener('afterprint', cleanup);
      window.print();
      setTimeout(cleanup, 3000);
      return;
    }
    let content, mime;
    if (kind === 'json') { content = JSON.stringify(c, null, 2); mime = 'application/json'; }
    else if (kind === 'md') {
      content = '# ' + c.title + '\n\n_' + new Date(c.createdAt).toLocaleString() + ' — Mohsen AI_\n\n' +
        c.messages.map(m => m.role === 'user'
          ? '**' + Lang.t('user_label') + ':**\n\n' + m.content
          : '**Mohsen AI' + (m.model ? ' (' + m.model + ')' : '') + ':**\n\n' + m.content).join('\n\n---\n\n');
      mime = 'text/markdown';
    } else {
      content = c.title + '\n' + '='.repeat(c.title.length) + '\n\n' +
        c.messages.map(m => '[' + new Date(m.ts).toLocaleString() + '] ' +
          (m.role === 'user' ? Lang.t('user_label') : 'Mohsen AI') + ':\n' + m.content + '\n').join('\n');
      mime = 'text/plain';
    }
    download(name + (kind === 'json' ? '.json' : kind === 'md' ? '.md' : '.txt'), mime, content);
    UI.toast(Lang.t('t_exported'), 'ok');
  },

  async refreshUsage() {
    const mini = this.$('#usageMini'); if (!mini) return;
    try {
      const r = await fetch('/api/usage', { headers: { 'X-Anon-Id': Store.anonId() } });
      if (!r.ok) { mini.hidden = true; return; }
      const u = await r.json();
      mini.hidden = false;
      mini.innerHTML = '<div class="um-row"><span>' + Lang.t('s_per_hour') + '</span><span>' +
        u.hourly.used + '/' + u.hourly.limit + '</span></div>' +
        '<div class="usage-track"><div class="usage-fill" style="width:' +
        Math.min(100, u.hourly.used / u.hourly.limit * 100) + '%"></div></div>';
    } catch (e) { mini.hidden = true; }
  },

  titleFrom(text) {
    const map = {
      'اشرح': 'شرح', 'اشرحلي': 'شرح', 'اكتب': 'كتابة', 'لخص': 'تلخيص', 'حلل': 'تحليل', 'ترجم': 'ترجمة',
      'صمم': 'تصميم', 'ابحث': 'بحث', 'فسر': 'تفسير', 'قارن': 'مقارنة', 'عدد': 'عد',
      'explain': 'Explaining', 'write': 'Writing', 'summarize': 'Summarizing', 'analyze': 'Analyzing'
    };
    let t = text.replace(/\s+/g, ' ').trim();
    const sp = t.indexOf(' ');
    const first = (sp > 0 ? t.slice(0, sp) : t).toLowerCase();
    if (map[first] !== undefined) t = (sp > 0 ? map[first] + ' ' + t.slice(sp + 1) : map[first]);
    if (t.length > 42) t = t.slice(0, 42).replace(/\s\S*$/, '') + '…';
    return t || Lang.t('new_chat');
  }
};

function logoSvg(size) {
  return '<svg viewBox="0 0 32 32" width="' + size + '" height="' + size + '" aria-hidden="true">' +
    '<rect x="1" y="1" width="30" height="30" rx="9" fill="var(--accent)"/>' +
    '<path d="M8.5 22.5v-13l7.5 7 7.5-7v13" fill="none" stroke="var(--accent-text)" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"/></svg>';
}