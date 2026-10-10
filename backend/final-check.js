const fs = require('fs');
const path = require('path');
const R = f => { try { return fs.readFileSync(path.join(__dirname, '..', f), 'utf8'); } catch (e) { return ''; } };
let bad = 0;
function chk(label, file, needle) {
  const ok = R(file).includes(needle);
  if (!ok) bad++;
  console.log((ok ? 'OK   ' : 'NAQES ') + label + (ok ? '' : '   <- ' + file));
}
console.log('=== BACKEND ===');
chk('server.js: فحص الرسالة الجديدة فقط', 'backend/server.js', 'lastUser');
chk('server.js: نموذج الصور', 'backend/server.js', 'gemini-2.5-flash-image');
chk('server.js: بحث Tavily', 'backend/server.js', 'tavily');
chk('server.js: GLM-4.5 اولا', 'backend/server.js', "glm-4.5-flash', 'glm-4-flash'");
chk('server.js: بديل البث الذكي', 'backend/server.js', "res.on('close'");
console.log('=== FRONTEND ===');
chk('chat.js: بحث الويب', 'frontend/js/chat.js', 'webSearch');
chk('chat.js: تشغيل الكود', 'frontend/js/chat.js', 'data-code-run');
chk('chat.js: عرض الصور المولدة', 'frontend/js/chat.js', 'msg-images');
chk('chat.html: زرار البحث', 'frontend/chat.html', 'webSearchBtn');
chk('ar.js: رسالة الرصيد والبحث', 'frontend/js/i18n/ar.js', 'err_payment');
chk('styles.css: انماط الصور', 'frontend/css/styles.css', '.msg-images');
chk('sw.js: اصدار v4', 'frontend/sw.js', 'mohsen-ai-v4');
chk('.env: الحد 60000', '.env', 'MAX_MESSAGE_LENGTH=60000');
console.log('\n' + (bad === 0 ? 'ALL OK - المشروع كامل 100%' : 'فيه ' + bad + ' عنصر ناقص - ابعت المخرجات دي كاملة'));
