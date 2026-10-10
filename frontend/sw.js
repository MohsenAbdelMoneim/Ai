/* v3: يتعامل مع نفس الأصل فقط — الخطوط وCDN كروم يتكفل بيها */
const VERSION = 'mohsen-ai-v4';
const CORE = ['/', '/chat.html', '/css/styles.css', '/manifest.json',
  '/js/boot.js', '/js/storage.js', '/js/language.js', '/js/theme.js', '/js/ui.js',
  '/js/markdown.js', '/js/models.js', '/js/settings.js', '/js/chat.js', '/js/app.js',
  '/js/i18n/ar.js', '/js/i18n/en.js'];
self.addEventListener('install', e => {
  e.waitUntil(caches.open(VERSION).then(c => c.addAll(CORE)).then(() => self.skipWaiting()));
});
self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(keys =>
    Promise.all(keys.filter(k => k !== VERSION).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener('fetch', e => {
  if (e.request.method !== 'GET') return;
  const url = new URL(e.request.url);
  if (url.origin !== location.origin) return;
  if (url.pathname.startsWith('/api/')) return;
  if (e.request.mode === 'navigate') {
    e.respondWith(fetch(e.request).catch(() => caches.match('/chat.html')));
    return;
  }
  e.respondWith(
    caches.match(e.request).then(cached => cached ||
      fetch(e.request).then(res => {
        if (res.ok) { const clone = res.clone(); caches.open(VERSION).then(c => c.put(e.request, clone)); }
        return res;
      }))
  );
});