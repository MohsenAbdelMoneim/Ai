document.addEventListener('DOMContentLoaded', async () => {
  Lang.init();
  Theme.init();
  UI.hydrate();

  const page = document.body.dataset.page;
  if (page === 'chat') {
    Chat.init();
    document.addEventListener('keydown', e => {
      const k = e.key.toLowerCase();
      if ((e.ctrlKey || e.metaKey) && k === 'k') { e.preventDefault(); Chat.searchModal(); }
      else if ((e.ctrlKey || e.metaKey) && e.shiftKey && k === 'n') { e.preventDefault(); Chat.newChat(); }
      else if (e.key === 'Escape' && window.innerWidth < 1024 && document.querySelector('#sidebar.open')) Chat.drawer(false);
    });
  } else {
    initLanding();
  }

  // PWA + connectivity
  if ('serviceWorker' in navigator && (location.protocol === 'https:' || location.hostname === 'localhost'))
    navigator.serviceWorker.register('/sw.js').catch(() => {});
  window.addEventListener('offline', () => UI.toast(Lang.t('offline'), 'warn'));
  window.addEventListener('online', () => UI.toast(Lang.t('back_online'), 'ok'));
});

function initLanding() {
  // ============ Language toggle ============
  document.querySelectorAll('[data-lang]').forEach(b => {
    b.classList.toggle('on', b.dataset.lang === Lang.cur);
    b.setAttribute('aria-pressed', b.dataset.lang === Lang.cur);
    b.addEventListener('click', () => Lang.set(b.dataset.lang));
  });

  // ============ CTA Buttons (كل الأزرار) ============
  const goChat = (e) => {
    if (e) e.preventDefault();
    window.location.href = '/chat.html';
  };

  // زر الهيدر
  const start = document.getElementById('ctaStart');
  if (start) start.addEventListener('click', goChat);

  // زر الهيرو
  const start2 = document.getElementById('ctaStart2');
  if (start2) start2.addEventListener('click', goChat);

  // زر t-account (الجديد)
 // ضيف ده جوه initLanding بعد ctaStart2:
const tAccountBtn = document.querySelector('.t-account .btn-primary');
if (tAccountBtn) tAccountBtn.addEventListener('click', goChat);
  // احتياطي: أي زر btn-primary جوه الـ landing
  document.querySelectorAll('a.btn-primary[href="/chat.html"], button.btn-primary[data-goto-chat]').forEach(btn => {
    btn.addEventListener('click', goChat);
  });

  // ============ Models table ============
  const tbody = document.getElementById('modelsTbody');
  if (tbody) {
    const rows = [
      { name: 'Google Gemini', models: 'Gemini 2.0 Flash · Gemini 2.5 Flash', tier: 'free_tier', ctx: '1M' },
      { name: 'Groq', models: 'Llama 3.3 70B · Llama 3.1 8B Instant', tier: 'free_tier', ctx: '128K' },
      { name: 'Z.ai / GLM', models: 'GLM-4-Flash', tier: 'free', ctx: '128K' },
      { name: 'OpenRouter', models: 'Llama 3.3 · DeepSeek V3 · Gemini 2.0 (:free)', tier: 'free', ctx: '128K' },
      { name: 'Cerebras', models: 'Llama 3.3 70B', tier: 'free_tier', ctx: '128K' },
      { name: 'DeepSeek', models: 'DeepSeek Chat · DeepSeek Reasoner', tier: 'paid', ctx: '64K' },
      { name: 'Mistral AI', models: 'Mistral Nemo · Mistral Small', tier: 'paid', ctx: '128K' }
    ];
    tbody.innerHTML = rows.map(r => `<tr>
      <td><b>${r.name}</b></td><td class="ltr-cell" dir="ltr">${r.models}</td>
      <td><span class="badge tier-${r.tier}">${Lang.t(r.tier === 'free' ? 'tier_free' : r.tier === 'free_tier' ? 'tier_free_tier' : 'tier_paid')}</span></td>
      <td>${r.ctx} ${Lang.t('ctx_tokens')}</td></tr>`).join('');
  }
}