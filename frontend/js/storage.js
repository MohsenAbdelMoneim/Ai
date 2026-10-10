const Store = {
  CONV_KEY: 'mohsen_ai_conversations_v1',
  SET_KEY: 'mohsen_ai_settings_v1',
  ANON_KEY: 'mohsen_ai_anon_v1',
  _settings: null,
  DEFAULTS: { lang: 'ar', theme: 'system', enterToSend: true, timestamps: false, streaming: true,
    markdown: true, autoFallback: false, defaultProvider: null, defaultModel: null, lastConv: null },
  anonId() {
    let v = localStorage.getItem(this.ANON_KEY);
    if (!v) {
      const a = new Uint8Array(8); crypto.getRandomValues(a);
      v = 'anon_' + Array.from(a, b => b.toString(36).padStart(2, '0')).join('');
      localStorage.setItem(this.ANON_KEY, v);
    }
    return v;
  },
  get settings() {
    if (!this._settings) {
      let s = {}; try { s = JSON.parse(localStorage.getItem(this.SET_KEY) || '{}'); } catch (e) {}
      this._settings = Object.assign({}, this.DEFAULTS, s);
    }
    return this._settings;
  },
  setSetting(k, v) { this.settings[k] = v; localStorage.setItem(this.SET_KEY, JSON.stringify(this.settings)); },
  conversations() { try { return JSON.parse(localStorage.getItem(this.CONV_KEY) || '[]'); } catch (e) { return []; } },
  saveAll(list) {
    // Images are stored without base64 payload to protect LocalStorage quota.
    const slim = list.map(c => ({ ...c, messages: c.messages.map(m => ({ ...m, image: undefined })) }));
    try { localStorage.setItem(this.CONV_KEY, JSON.stringify(slim)); }
    catch (e) { /* quota — keep memory state */ }
  },
  upsert(conv) {
    const list = this.conversations();
    const i = list.findIndex(c => c.id === conv.id);
    if (i >= 0) list[i] = conv; else list.unshift(conv);
    this.saveAll(list);
  },
  get(id) { return this.conversations().find(c => c.id === id) || null; },
  remove(id) { this.saveAll(this.conversations().filter(c => c.id !== id)); },
  clearAll() { localStorage.removeItem(this.CONV_KEY); }
};