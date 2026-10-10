/* npm run setup — يكتب .env بالمكان والترميز الصحيح ويتحقق من المفتاح قبل الحفظ */
const fs = require('fs');
const path = require('path');
const readline = require('readline');
const ROOT = path.join(__dirname, '..');
const ENV_PATH = path.join(ROOT, '.env');
const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
const ask = q => new Promise(res => rl.question(q, res));

(async () => {
  console.log('\n🧰 إعداد Mohsen AI — ملف .env\n');
  const existing = {};
  if (fs.existsSync(ENV_PATH)) {
    for (const line of fs.readFileSync(ENV_PATH, 'utf8').split(/\r?\n/)) {
      const m = line.match(/^\s*([A-Z_]+)\s*=\s*(.*)\s*$/);
      if (m) existing[m[1]] = m[2];
    }
    console.log('ℹ يوجد .env حالي — اضغط Enter للتخطي وسيبقى المفتاح الحالي كما هو.\n');
  }
  const gem = (process.argv[2] || await ask('مفتاح Gemini (Enter للإبقاء على الحالي): ')).trim();
  let gemVal = gem || existing.GEMINI_API_KEY || '';
  if (gem) {
    process.stdout.write('🔎 التحقق من المفتاح... ');
    try {
      const r = await fetch('https://generativelanguage.googleapis.com/v1beta/models?pageSize=1', { headers: { 'x-goog-api-key': gem } });
      console.log(r.ok ? 'سليم ✓' : 'مرفوض ✗ — ' + r.status);
    } catch (e) { console.log('تعذر الاتصال: ' + e.message); }
  }
  const lines = [
    'PORT=' + (existing.PORT || '3000'),
    'FREE_MESSAGES_PER_HOUR=' + (existing.FREE_MESSAGES_PER_HOUR || '20'),
    'FREE_MESSAGES_PER_DAY=' + (existing.FREE_MESSAGES_PER_DAY || '100'),
    'MAX_MESSAGE_LENGTH=' + (existing.MAX_MESSAGE_LENGTH || '12000'),
    'MAX_CONCURRENT=' + (existing.MAX_CONCURRENT || '2'),
    'GEMINI_API_KEY=' + gemVal,
    'GROQ_API_KEY=' + (existing.GROQ_API_KEY || ''),
    'DEEPSEEK_API_KEY=' + (existing.DEEPSEEK_API_KEY || ''),
    'ZAI_API_KEY=' + (existing.ZAI_API_KEY || ''),
    'OPENROUTER_API_KEY=' + (existing.OPENROUTER_API_KEY || ''),
    'CEREBRAS_API_KEY=' + (existing.CEREBRAS_API_KEY || ''),
    'MISTRAL_API_KEY=' + (existing.MISTRAL_API_KEY || '')
  ];
  fs.writeFileSync(ENV_PATH, lines.join('\n') + '\n', 'utf8');
  console.log('\n✅ تم الحفظ: ' + ENV_PATH);
  console.log('▶ التشغيل:  npm start\n');
  rl.close();
})();