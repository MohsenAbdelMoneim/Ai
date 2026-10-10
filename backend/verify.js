/* npm run verify — فحص شامل قبل التشغيل */
const path = require('path');
const fs = require('fs');
const { execSync } = require('child_process');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });
const ROOT = path.join(__dirname, '..');
let fails = 0, warns = 0;
const ok   = m => console.log('  ✓ ' + m);
const bad  = m => { fails++;  console.log('  ✗ ' + m); };
const warn = m => { warns++; console.log('  ⚠ ' + m); };

const FILES = {
  'backend/server.js': 8000, 'backend/setup.js': 1500, 'backend/verify.js': 1500,
  'frontend/index.html': 6000, 'frontend/chat.html': 3500, 'frontend/css/styles.css': 20000,
  'frontend/js/boot.js': 150, 'frontend/js/storage.js': 1000, 'frontend/js/language.js': 700,
  'frontend/js/theme.js': 800, 'frontend/js/ui.js': 6000, 'frontend/js/markdown.js': 4000,
  'frontend/js/models.js': 2000, 'frontend/js/settings.js': 4000, 'frontend/js/chat.js': 15000,
  'frontend/js/app.js': 1500, 'frontend/js/i18n/ar.js': 6000, 'frontend/js/i18n/en.js': 4500,
  'frontend/manifest.json': 200, 'frontend/sw.js': 400
};

(async () => {
  console.log('\n1) ملفات المشروع:');
  for (const f of Object.keys(FILES)) {
    const p = path.join(ROOT, f);
    if (!fs.existsSync(p)) { bad(f + ' — غير موجود'); continue; }
    const size = fs.statSync(p).size;
    if (size < FILES[f]) bad(f + ' — صغير جدًا (' + Math.round(size / 1024) + 'KB) — غالبًا ناقص');
    else ok(f + ' (' + Math.round(size / 1024) + 'KB)');
  }

  console.log('\n2) صحة الأكواد (Syntax):');
  for (const f of Object.keys(FILES).filter(f => f.endsWith('.js'))) {
    const p = path.join(ROOT, f);
    if (!fs.existsSync(p)) continue;
    try { execSync('node --check "' + p + '"', { stdio: 'pipe' }); ok(f); }
    catch (e) { bad(f + ' — ' + String(e.stderr || '').split('\n')[0]); }
  }

  console.log('\n3) فصل الفرونت عن الباك إند:');
  for (const f of Object.keys(FILES).filter(f => f.startsWith('frontend/js') && f.endsWith('.js'))) {
    const p = path.join(ROOT, f);
    if (!fs.existsSync(p)) continue;
    const src = fs.readFileSync(p, 'utf8');
    if (/\brequire\s*\(/.test(src)) bad(f + ' — فيه require (كود باك إند) بالخطأ!');
    else ok(f);
  }
  const chatP = path.join(ROOT, 'frontend/js/chat.js');
  if (fs.existsSync(chatP)) {
    const src = fs.readFileSync(chatP, 'utf8');
    if (/^const Chat\s*=/.test(src) && /logoSvg/.test(src)) ok('chat.js — يبدأ بـ const Chat ✓');
    else bad('chat.js — لا يبدأ بـ const Chat (محتوى غلط)');
  }
  const appP = path.join(ROOT, 'frontend/js/app.js');
  if (fs.existsSync(appP) && fs.readFileSync(appP, 'utf8').includes('Chat.init')) ok('app.js — يستدعي Chat.init ✓');

  console.log('\n4) مفتاح Gemini:');
  if (!process.env.GEMINI_API_KEY) bad('غير موجود في .env — شغّل: npm run setup');
  else {
    const mask = process.env.GEMINI_API_KEY.slice(0, 6) + '•••' + process.env.GEMINI_API_KEY.slice(-4);
    try {
      const r = await fetch('https://generativelanguage.googleapis.com/v1beta/models?pageSize=1',
        { headers: { 'x-goog-api-key': process.env.GEMINI_API_KEY } });
      if (r.ok) ok('متصل وسليم (' + mask + ')');
      else bad('مرفوض — ' + r.status);
    } catch (e) { bad('تعذر الاتصال: ' + e.message); }
  }

  if (process.env.GEMINI_API_KEY) {
    console.log('\n5) اختبار رسالة حقيقية من النموذج:');
    const GEM = 'https://generativelanguage.googleapis.com/v1beta';
    const H = { 'Content-Type': 'application/json', 'x-goog-api-key': process.env.GEMINI_API_KEY };
    const body = t => JSON.stringify({ contents: [{ role: 'user', parts: [{ text: t }] }] });
    const pick = j => ((j.candidates && j.candidates[0] && j.candidates[0].content && j.candidates[0].content.parts) || [])
      .map(p => p.text || '').join('');
    async function call(model, stream) {
      const url = stream ? GEM + '/models/' + model + ':streamGenerateContent?alt=sse'
                         : GEM + '/models/' + model + ':generateContent';
      const r = await fetch(url, { method: 'POST', headers: H, body: body('قل مرحبا') });
      if (!r.ok) throw new Error('HTTP ' + r.status);
      if (!stream) return pick(await r.json());
      const reader = r.body.getReader(); const dec = new TextDecoder();
      let buf = '', full = '';
      while (true) {
        const { done, value } = await reader.read(); if (done) break;
        buf += dec.decode(value, { stream: true });
        let i;
        while ((i = buf.indexOf('\n')) >= 0) {
          const line = buf.slice(0, i).trim(); buf = buf.slice(i + 1);
          if (!line.startsWith('data:')) continue;
          try { const t = pick(JSON.parse(line.slice(5).trim())); if (t) full += t; } catch (e) {}
        }
      }
      return full;
    }
    let model = 'gemini-3.8-flash';
    try {
      const t = await call(model, false);
      ok('رد عادي ✓ — ' + t.slice(0, 50));
    } catch (e) {
      if (String(e.message).includes('404')) {
        try {
          const lr = await fetch(GEM + '/models?pageSize=100', { headers: H });
          const lj = await lr.json();
          const list = (lj.models || []).filter(m => (m.supportedGenerationMethods || []).includes('generateContent'))
            .map(m => m.name.replace('models/', '')).filter(n => !/tts|image|embedding|veo|aqa/i.test(n));
          const flash = list.filter(n => /gemini.*flash/i.test(n));
          model = (flash.length ? flash : list)[0] || model;
          console.log('  ℹ النموذج الافتراضي غير متاح — سيتم اختبار: ' + model);
          const t2 = await call(model, false);
          ok('رد عادي ✓ (بالنموذج ' + model + ') — ' + t2.slice(0, 50));
        } catch (e2) { bad('فشل الرد العادي: ' + e2.message); }
      } else bad('فشل الرد العادي: ' + e.message);
    }
    try {
      const s = await call(model, true);
      if (s.trim()) ok('البث ✓ — وصلت ' + s.length + ' حرف تدريجيًا');
      else warn('البث رجع فاضيًا — السيرفر هيتعامل معه بالوضع البديل تلقائيًا');
    } catch (e) {
      warn('البث المباشر بيفشل على شبكتك (' + e.message + ')');
      console.log('     → عادي جدًا: السيرفر الجديد هيكتشف ده ويستخدم الرد العادي تلقائيًا. المنصة هتشتغل كاملة.');
    }
  }

  console.log('\n─────────────────────────────');
  if (fails) { console.log('❌ فيه ' + fails + ' مشكلة — صحّحها و أعيد npm run verify'); process.exitCode = 1; }
  else {
    console.log('✅ الفحوص الأساسية سليمة' + (warns ? ' (فيه ' + warns + ' تنبيه — مقبول)' : ''));
    console.log('▶ شغّل: npm start   ثم افتح   http://localhost:3000\n');
  }
})();