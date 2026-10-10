/* ============================================================
   Mohsen AI v3.5 — BLOCKED_MODELS مصححة + fallback أولوية
   الإصلاحات:
   - gemini-3.8-flash هو الشغال (جوجل بتوصي بيه) — 2.5 هو المسحوب
   - glm-4.5-flash هو المجاني الشغال عندك (اتأكدنا من اللوج)
   - BLOCKED_MODELS بتتحدث من نفس رسائل الخطأ تلقائيًا
   ============================================================ */
const path = require('path');
const fs = require('fs');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });
const express = require('express');

const PORT     = parseInt(process.env.PORT || '3000', 10);
const PER_HOUR = parseInt(process.env.FREE_MESSAGES_PER_HOUR || '20', 10);
const PER_DAY  = parseInt(process.env.FREE_MESSAGES_PER_DAY || '100', 10);
const MAX_LEN  = parseInt(process.env.MAX_MESSAGE_LENGTH || '60000', 10);
const STREAM_MS = parseInt(process.env.STREAM_TIMEOUT_MS || '15000', 10);

class ApiError extends Error {
  constructor(status, code, detail) { super(detail || code); this.status = status; this.code = code; }
}
function netErr(e) {
  if (e && e.name === 'AbortError') return e;
  const c = e && e.cause ? ' [' + (e.cause.code || e.cause.name || '') + ': ' + (e.cause.message || '') + ']' : '';
  return new ApiError(502, 'PROVIDER_UNAVAILABLE', ((e && e.message) || 'fetch failed') + c);
}

/* ---------- النماذج المحظورة (بيتخطاها تلقائيًا) ----------
   التحديث: gemini-3.8-flash شغال (متجرب) — 2.5 اتسحب للمستخدمين الجدد */
const BLOCKED_MODELS = {
  gemini: [
    'gemini-2.5-flash',        // ❌ اتسحب — جوجل نفسها بترفضه 404
    'gemini-2.0-flash',        // ❌ اتسحب من قبل
    'gemini-2.0-flash-exp'     // ❌ قديم كذلك
  ],
  zai: [
    'glm-4-flash',             // ❌ اتسحب من bigmodel
    'glm-4-flashx',            // ❌
    'glm-4-flash-250414'       // ❌
  ]
};

/* ---------- المزودون ---------- */
const PROVIDERS = {
  gemini: {
    name: 'Google Gemini', color: '#4E7CF6', keyEnv: 'GEMINI_API_KEY', attachments: ['image'],
    models: [
      { id: 'gemini-3.8-flash', label: 'Gemini 3.8 Flash', tier: 'free_tier', context: '1M', speed: 'fast' },
      { id: 'gemini-2.5-flash-image', label: 'Gemini Image — توليد صور', tier: 'free_tier', context: '32K', speed: 'medium', image: true }
    ]
  },
  groq: {
    name: 'Groq', color: '#F0563A', keyEnv: 'GROQ_API_KEY',
    models: [
      { id: 'llama-3.3-70b-versatile', label: 'Llama 3.3 70B', tier: 'free_tier', context: '128K', speed: 'fastest' },
      { id: 'llama-3.1-8b-instant', label: 'Llama 3.1 8B Instant', tier: 'free_tier', context: '128K', speed: 'fastest' }
    ]
  },
  cerebras: {
    name: 'Cerebras', color: '#E88A2D', keyEnv: 'CEREBRAS_API_KEY',
    models: [
      { id: 'llama-3.3-70b', label: 'Llama 3.3 70B', tier: 'free_tier', context: '128K', speed: 'fastest' },
      { id: 'llama3.1-8b', label: 'Llama 3.1 8B', tier: 'free_tier', context: '128K', speed: 'fastest' }
    ]
  },
  deepseek: {
    name: 'DeepSeek', color: '#4D6BFE', keyEnv: 'DEEPSEEK_API_KEY',
    models: [
      { id: 'deepseek-chat', label: 'DeepSeek V3 (Chat)', tier: 'paid', context: '64K', speed: 'balanced' },
      { id: 'deepseek-reasoner', label: 'DeepSeek R1 (Reasoner)', tier: 'paid', context: '64K', speed: 'quality' }
    ]
  },
  zai: {
    name: 'Z.ai / GLM', color: '#C2419B', keyEnv: 'ZAI_API_KEY',
    models: [
      { id: 'glm-4.5-flash', label: 'GLM-4.5 Flash', tier: 'free', context: '128K', speed: 'fast' },
      { id: 'glm-4-plus', label: 'GLM-4-Plus', tier: 'paid', context: '128K', speed: 'quality' }
    ]
  },
  openrouter: {
    name: 'OpenRouter Free', color: '#7C7CF0', keyEnv: 'OPENROUTER_API_KEY',
    models: [
      { id: 'meta-llama/llama-3.3-70b-instruct:free', label: 'Llama 3.3 70B', tier: 'free', context: '128K', speed: 'balanced' },
      { id: 'deepseek/deepseek-chat-v3-0324:free', label: 'DeepSeek V3', tier: 'free', context: '64K', speed: 'balanced' }
    ]
  },
  mistral: {
    name: 'Mistral AI', color: '#FF7000', keyEnv: 'MISTRAL_API_KEY',
    models: [
      { id: 'open-mistral-nemo', label: 'Mistral Nemo', tier: 'free_tier', context: '128K', speed: 'fast' },
      { id: 'mistral-small-latest', label: 'Mistral Small', tier: 'paid', context: '128K', speed: 'balanced' }
    ]
  }
};

const OAI_URL = {
  groq: 'https://api.groq.com/openai/v1/chat/completions',
  deepseek: 'https://api.deepseek.com/chat/completions',
  zai: 'https://open.bigmodel.cn/api/paas/v4/chat/completions',
  openrouter: 'https://openrouter.ai/api/v1/chat/completions',
  cerebras: 'https://api.cerebras.ai/v1/chat/completions',
  mistral: 'https://api.mistral.ai/v1/chat/completions'
};

const MODEL_ALIASES = {
  gemini: ['gemini-3.8-flash'],
  groq: ['llama-3.3-70b-versatile', 'llama-3.1-8b-instant'],
  deepseek: ['deepseek-chat', 'deepseek-reasoner'],
  zai: ['glm-4.5-flash'],
  openrouter: ['meta-llama/llama-3.3-70b-instruct:free', 'deepseek/deepseek-chat-v3-0324:free'],
  cerebras: ['llama-3.3-70b', 'llama3.1-8b'],
  mistral: ['open-mistral-nemo', 'mistral-small-latest']
};

/* أولوية البدائل — Groq و Cerebras الأول (أسرع + مجانيين) */
const FALLBACK_PRIORITY = ['groq', 'cerebras', 'openrouter', 'zai', 'gemini', 'mistral', 'deepseek'];

const liveModel = {};
function configuredIds() {
  return Object.keys(PROVIDERS).filter(id => process.env[PROVIDERS[id].keyEnv]);
}
function isModelErr(e) {
  return e && e.status && (e.status === 404 || e.status === 400) &&
    /不存在|not\s?exist|not\s?found|no\s?endpoints|invalid\s?model|unknown\s?model|1211|decommission|no longer available/i.test(e.message || '');
}
function isBlocked(providerId, modelId) {
  return (BLOCKED_MODELS[providerId] || []).includes(modelId);
}

/* ---------- Gemini ---------- */
const GEM = 'https://generativelanguage.googleapis.com/v1beta';
function isImageModel(m) { return /image|imagen/i.test(m || ''); }
function gemParts(content) {
  if (typeof content === 'string') return [{ text: content }];
  return (Array.isArray(content) ? content : []).map(p =>
    p.type === 'text' ? { text: p.text } : { inlineData: { mimeType: p.mime, data: p.data } });
}
function gemText(j) {
  return ((j.candidates && j.candidates[0] && j.candidates[0].content && j.candidates[0].content.parts) || [])
    .map(p => p.text || '').join('');
}
async function geminiListModels() {
  const r = await fetch(GEM + '/models?pageSize=100', { headers: { 'x-goog-api-key': process.env.GEMINI_API_KEY } });
  if (!r.ok) throw new ApiError(502, 'PROVIDER_UNAVAILABLE', 'models list ' + r.status);
  const j = await r.json();
  return (j.models || [])
    .filter(m => (m.supportedGenerationMethods || []).includes('generateContent'))
    .map(m => m.name.replace('models/', ''));
}
function pickGemini(list) {
  const clean = list.filter(n => !/tts|embedding|veo|aqa/i.test(n));
  /* v3.5: 3.8-flash الأول — هو الوحيد المضمون شغال على المفاتيح الجديدة */
  const pref = ['gemini-3.8-flash', 'gemini-flash-latest', 'gemini-2.0-flash'];
  for (const p of pref) if (clean.includes(p)) return p;
  const flash = clean.filter(n => /gemini.*flash/i.test(n));
  const pool = flash.length ? flash : clean;
  return pool[pool.length - 1] || null;
}
function gemErr(status, detail) {
  return new ApiError(status,
    status === 429 ? 'PROVIDER_RATE_LIMIT'
    : status === 402 ? 'PROVIDER_PAYMENT'
    : (status === 401 || status === 403) ? 'PROVIDER_AUTH'
    : status === 404 ? 'MODEL_NOT_FOUND'
    : 'PROVIDER_UNAVAILABLE', detail || ('HTTP ' + status));
}
async function geminiImage({ model, messages, signal }) {
  const sys = messages.find(m => m.role === 'system');
  const contents = messages.filter(m => m.role !== 'system').map(m => ({
    role: m.role === 'assistant' ? 'model' : 'user', parts: gemParts(m.content)
  }));
  const body = { contents, generationConfig: { responseModalities: ['TEXT', 'IMAGE'] } };
  if (sys) body.systemInstruction = { parts: [{ text: String(sys.content) }] };
  let res;
  try {
    res = await fetch(GEM + '/models/' + model + ':generateContent', {
      method: 'POST', signal,
      headers: { 'Content-Type': 'application/json', 'x-goog-api-key': process.env.GEMINI_API_KEY },
      body: JSON.stringify(body)
    });
  } catch (e) { throw netErr(e); }
  if (!res.ok) {
    let detail = ''; try { const j = await res.json(); detail = (j.error && j.error.message) || ''; } catch (e) {}
    throw gemErr(res.status, detail);
  }
  const j = await res.json();
  const parts = (j.candidates && j.candidates[0] && j.candidates[0].content && j.candidates[0].content.parts) || [];
  let text = ''; const images = [];
  for (const pt of parts) {
    if (pt.text) text += pt.text;
    else if (pt.inlineData && pt.inlineData.data) images.push({ mime: pt.inlineData.mimeType || 'image/png', data: pt.inlineData.data });
  }
  return { text: text, images: images };
}
async function geminiSend({ model, messages, stream, signal, onDelta }) {
  const sys = messages.find(m => m.role === 'system');
  const contents = messages.filter(m => m.role !== 'system').map(m => ({
    role: m.role === 'assistant' ? 'model' : 'user', parts: gemParts(m.content)
  }));
  const body = { contents };
  if (sys) body.systemInstruction = { parts: [{ text: String(sys.content) }] };

  let useModel = liveModel.gemini || model;
  if (isBlocked('gemini', useModel)) {
    const alt = MODEL_ALIASES.gemini.find(m => !isBlocked('gemini', m));
    if (alt) { useModel = alt; liveModel.gemini = alt; }
  }

  for (let attempt = 0; attempt < 2; attempt++) {
    const url = stream
      ? GEM + '/models/' + useModel + ':streamGenerateContent?alt=sse'
      : GEM + '/models/' + useModel + ':generateContent';
    let res;
    try {
      res = await fetch(url, {
        method: 'POST', signal,
        headers: { 'Content-Type': 'application/json', 'x-goog-api-key': process.env.GEMINI_API_KEY },
        body: JSON.stringify(body)
      });
    } catch (e) { throw netErr(e); }

    if (!res.ok) {
      let detail = '';
      try { const j = await res.json(); detail = (j.error && j.error.message) || ''; } catch (e) {}
      if (res.status === 404 && attempt === 0) {
        try {
          const alt = pickGemini(await geminiListModels());
          if (alt && !isBlocked('gemini', alt)) {
            console.log('[gemini] "' + useModel + '" غير متاح — تبديل تلقائي إلى: ' + alt);
            useModel = alt; liveModel.gemini = alt;
            continue;
          }
        } catch (e2) { console.error('[gemini] فشل جلب القايمة:', e2.message); }
      }
      throw gemErr(res.status, detail);
    }

    if (!stream) {
      const j = await res.json();
      const text = gemText(j);
      if (!text.trim()) throw new ApiError(502, 'PROVIDER_UNAVAILABLE', 'empty response');
      liveModel.gemini = useModel;
      return text;
    }
    const reader = res.body.getReader(); const dec = new TextDecoder();
    let buf = '', full = '';
    while (true) {
      const { done, value } = await reader.read(); if (done) break;
      buf += dec.decode(value, { stream: true });
      let i;
      while ((i = buf.indexOf('\n')) >= 0) {
        const line = buf.slice(0, i).trim(); buf = buf.slice(i + 1);
        if (!line.startsWith('data:')) continue;
        const p = line.slice(5).trim(); if (!p) continue;
        try {
          const t = gemText(JSON.parse(p));
          if (t) { full += t; if (onDelta) onDelta(t); }
        } catch (e) {}
      }
    }
    if (!full.trim()) throw new ApiError(502, 'PROVIDER_UNAVAILABLE', 'empty stream');
    liveModel.gemini = useModel;
    return full;
  }
  throw new ApiError(502, 'PROVIDER_UNAVAILABLE', 'unreachable');
}

/* ---------- مزودو OpenAI-Compatible ---------- */
async function oaiSend({ url, key, model, messages, stream, signal, onDelta, headers }) {
  const flat = c => typeof c === 'string' ? c
    : (Array.isArray(c) ? c.filter(p => p.type === 'text').map(p => p.text).join('\n') : '');
  const body = { model, stream: !!stream, messages: messages.map(m => ({ role: m.role, content: flat(m.content) })) };
  let res;
  try {
    res = await fetch(url, {
      method: 'POST', signal,
      headers: Object.assign({ 'Content-Type': 'application/json', Authorization: 'Bearer ' + key }, headers || {}),
      body: JSON.stringify(body)
    });
  } catch (e) { throw netErr(e); }
  if (!res.ok) {
    let detail = '';
    try { const j = await res.json(); detail = (j.error && (j.error.message || j.error.code)) || ''; } catch (e) {}
    throw new ApiError(res.status,
      res.status === 429 ? 'PROVIDER_RATE_LIMIT'
      : res.status === 402 ? 'PROVIDER_PAYMENT'
      : (res.status === 401 || res.status === 403) ? 'PROVIDER_AUTH'
      : 'PROVIDER_UNAVAILABLE', detail || res.statusText);
  }
  if (!stream) {
    const j = await res.json();
    const c = j.choices && j.choices[0] && j.choices[0].message && j.choices[0].message.content;
    if (typeof c !== 'string' || !c) throw new ApiError(502, 'PROVIDER_UNAVAILABLE', 'empty response');
    return c;
  }
  const reader = res.body.getReader(); const dec = new TextDecoder();
  let buf = '', full = '';
  while (true) {
    const { done, value } = await reader.read(); if (done) break;
    buf += dec.decode(value, { stream: true });
    let i;
    while ((i = buf.indexOf('\n')) >= 0) {
      const line = buf.slice(0, i).trim(); buf = buf.slice(i + 1);
      if (!line.startsWith('data:')) continue;
      const p = line.slice(5).trim();
      if (!p || p === '[DONE]') continue;
      try {
        const j = JSON.parse(p);
        const d = j.choices && j.choices[0] && j.choices[0].delta && j.choices[0].delta.content;
        if (typeof d === 'string' && d) { full += d; if (onDelta) onDelta(d); }
      } catch (e) {}
    }
  }
  if (!full) throw new ApiError(502, 'PROVIDER_UNAVAILABLE', 'empty stream');
  return full;
}
function sendTo(providerId, opts) {
  if (providerId === 'gemini') {
    if (isImageModel(opts.model)) return geminiImage(opts);
    return geminiSend(opts);
  }
  return oaiSend(Object.assign({ url: OAI_URL[providerId], key: process.env[PROVIDERS[providerId].keyEnv] }, opts));
}
async function sendHeal(id, opts) {
  const first = liveModel[id] || opts.model;
  const safeFirst = isBlocked(id, first)
    ? (MODEL_ALIASES[id].find(m => !isBlocked(id, m)) || first)
    : first;
  const cands = [safeFirst].concat((MODEL_ALIASES[id] || []).filter(m => m !== safeFirst && !isBlocked(id, m)));
  for (let i = 0; i < cands.length; i++) {
    try {
      const r = await sendTo(id, Object.assign({}, opts, { model: cands[i] }));
      liveModel[id] = cands[i];
      return r;
    } catch (e) {
      if ((e && e.name === 'AbortError')) throw e;
      if (isModelErr(e) && i < cands.length - 1) {
        console.log('[heal] ' + id + ' "' + cands[i] + '" غير موجود — تجربة: ' + cands[i + 1]);
        continue;
      }
      throw e;
    }
  }
  throw new ApiError(502, 'PROVIDER_UNAVAILABLE', 'no working model');
}

function buildChain(providerId, modelId, fallback) {
  const conf = configuredIds();
  if (!conf.length || !conf.includes(providerId)) return [];
  const prov = PROVIDERS[providerId];
  let model = prov.models.some(m => m.id === modelId) ? modelId : prov.models[0].id;
  if (isBlocked(providerId, model)) {
    const alt = prov.models.find(m => !isBlocked(providerId, m.id));
    if (alt) model = alt.id;
  }
  const chain = [{ id: providerId, model: model }];
  if (fallback) {
    const others = conf.filter(id => id !== providerId)
      .sort((a, b) => FALLBACK_PRIORITY.indexOf(a) - FALLBACK_PRIORITY.indexOf(b));
    for (const id of others) {
      const p = PROVIDERS[id];
      const firstModel = p.models.find(m => !isBlocked(id, m.id));
      if (firstModel) chain.push({ id: id, model: firstModel.id });
    }
  }
  return chain;
}

/* ---------- حدود الاستخدام ---------- */
const hourly = new Map(), daily = new Map(), active = new Map(), globalIp = new Map();
function bucket(map, key, ms) {
  const now = Date.now();
  let b = map.get(key);
  if (!b || now > b.reset) { b = { n: 0, reset: now + ms }; map.set(key, b); }
  return b;
}
function keyOf(req) { return (req.get('x-anon-id') || 'anon') + '|' + (req.ip || 'ip'); }
setInterval(() => {
  const now = Date.now();
  [hourly, daily, globalIp].forEach(m => { for (const [k, b] of m) if (now > b.reset) m.delete(k); });
}, 3600e3).unref();
function countMsg(req) {
  const k = keyOf(req);
  bucket(hourly, k, 3600e3).n++;
  bucket(daily, k, 86400e3).n++;
}
function usageOf(req) {
  const k = keyOf(req);
  const h = bucket(hourly, k, 3600e3), d = bucket(daily, k, 86400e3);
  return {
    hourly: { used: Math.min(h.n, PER_HOUR), limit: PER_HOUR },
    daily: { used: Math.min(d.n, PER_DAY), limit: PER_DAY }
  };
}
function apiLimiter(req, res, next) {
  const b = bucket(globalIp, 'ip|' + (req.ip || 'x'), 60e3);
  if (b.n >= 240) return res.status(429).json({ error: { code: 'RATE_LIMIT' } });
  b.n++; next();
}

/* ---------- تجهيز الطلب ---------- */
function textLen(m) {
  return typeof m.content === 'string'
    ? m.content.length
    : (Array.isArray(m.content) ? m.content.reduce((s, p) => s + ((p && p.text) || '').length, 0) : 0);
}
function prepare(body) {
  const messages = (Array.isArray(body.messages) ? body.messages : [])
    .filter(m => m && ['user', 'assistant', 'system'].includes(m.role) && m.content)
    .map(m => ({ role: m.role, content: m.content }));
  const lastUser = [...messages].reverse().find(m => m.role === 'user');
  const hasImage = messages.some(m => Array.isArray(m.content) && m.content.some(px => px && px.type === 'image'));
  const len = lastUser ? textLen(lastUser) : 0;
  if (!messages.length || (!len && !hasImage)) return { err: 'GENERIC' };
  if (len > MAX_LEN) return { err: 'MESSAGE_TOO_LONG' };
  /* fallback دائم — عشان لو المزود وقع، المستخدم ياخد رد بدل خطأ */
  const chain = buildChain(body.provider, body.model, true);
  if (!chain.length) return { err: 'NO_PROVIDERS' };
  return { messages: messages, chain: chain, webSearch: !!body.webSearch, deep: !!body.deepSearch, hasImage: hasImage };
}
function friendly(e) {
  if (e && e.code === 'PROVIDER_RATE_LIMIT') return 'RATE_LIMIT';
  if (e && e.code === 'PROVIDER_PAYMENT') return 'PAYMENT';
  return 'PROVIDER';
}
function mapStatus(code) {
  return { RATE_LIMIT: 429, PAYMENT: 402, MESSAGE_TOO_LONG: 413, NO_PROVIDERS: 503, PROVIDER: 502, GENERIC: 400 }[code] || 500;
}

/* ---------- بحث الويب ---------- */
async function tavilySearch(query, deep) {
  const r = await fetch('https://api.tavily.com/search', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + process.env.SEARCH_API_KEY },
    body: JSON.stringify({ query: query, max_results: 5, search_depth: deep ? 'advanced' : 'basic' })
  });
  if (!r.ok) throw new ApiError(502, 'PROVIDER_UNAVAILABLE', 'search ' + r.status);
  const j = await r.json();
  return (j.results || []).map(x => ({ title: x.title || '', url: x.url || '', content: (x.content || '').slice(0, 700) }));
}

/* ---------- التطبيق ---------- */
const app = express();
app.disable('x-powered-by');
app.set('trust proxy', 1);
app.use((req, res, next) => {
  res.set({
    'X-Content-Type-Options': 'nosniff',
    'X-Frame-Options': 'DENY',
    'Referrer-Policy': 'strict-origin-when-cross-origin',
    'Permissions-Policy': 'camera=(), microphone=(), geolocation=()',
  'Content-Security-Policy':
  "default-src 'self'; script-src 'self' 'unsafe-inline' https://cdn.tailwindcss.com; " +
  "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src https://fonts.gstatic.com; " +
  "img-src 'self' data: blob:; connect-src 'self'; base-uri 'self'; frame-ancestors 'none'"
  });
  next();
});
app.use((req, res, next) => {
  const allow = process.env.CORS_ORIGIN;
  if (!allow || allow === '*') res.set('Access-Control-Allow-Origin', '*');
  else if (req.headers.origin === allow) res.set('Access-Control-Allow-Origin', allow);
  res.set('Access-Control-Allow-Headers', 'Content-Type, X-Anon-Id');
  res.set('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  if (req.method === 'OPTIONS') return res.sendStatus(204);
  next();
});
app.use(express.json({ limit: '10mb' }));
app.use('/api', apiLimiter);

app.get('/api/health', (req, res) =>
  res.json({ ok: true, providers: configuredIds().length, search: !!process.env.SEARCH_API_KEY, time: new Date().toISOString() }));
app.get('/api/providers', (req, res) =>
  res.json(configuredIds().map(id => ({ id: id, name: PROVIDERS[id].name, color: PROVIDERS[id].color, configured: true, models: PROVIDERS[id].models.length }))));
app.get('/api/models', (req, res) =>
  res.json({
    providers: configuredIds().map(id => ({ id: id, name: PROVIDERS[id].name, color: PROVIDERS[id].color, models: PROVIDERS[id].models, attachments: PROVIDERS[id].attachments || [] })),
    limits: { maxMessageLength: MAX_LEN, perHour: PER_HOUR, perDay: PER_DAY },
    search: !!process.env.SEARCH_API_KEY
  }));
app.get('/api/usage', (req, res) => res.json(usageOf(req)));

app.post('/api/chat', async (req, res) => {
  const p = prepare(req.body || {});
  if (p.err) return res.status(mapStatus(p.err)).json({ error: { code: p.err } });
  let lastErr = null;
  for (const step of p.chain) {
    try {
      const out = await sendHeal(step.id, { model: step.model, messages: p.messages, stream: false });
      countMsg(req);
      return res.json({
        content: typeof out === 'string' ? out : (out.text || ''),
        images: typeof out === 'string' ? [] : (out.images || []),
        provider: step.id, model: step.model, fallback: step !== p.chain[0]
      });
    } catch (e) {
      lastErr = e;
      console.error('[chat]', step.id, e.status || '', e.message);
      if (e.name === 'AbortError') break;
    }
  }
  const code = friendly(lastErr);
  res.status(mapStatus(code)).json({ error: { code: code } });
});

/* البث مع fallback دائم */
app.post('/api/chat/stream', async (req, res) => {
  res.writeHead(200, {
    'Content-Type': 'text/event-stream; charset=utf-8',
    'Cache-Control': 'no-cache, no-transform',
    'Connection': 'keep-alive',
    'X-Accel-Buffering': 'no'
  });
  const send = o => { try { res.write('data: ' + JSON.stringify(o) + '\n\n'); } catch (e) {} };
  const p = prepare(req.body || {});
  if (p.err) { send({ type: 'error', code: p.err }); return res.end(); }

  let clientGone = false, currentUp = new AbortController();
  res.on('close', () => { if (!res.writableEnded) { clientGone = true; currentUp.abort(); } });
  const k = keyOf(req);
  active.set(k, (active.get(k) || 0) + 1);
  let counted = false;
  const emitMeta = (step, fallback) => {
    if (!counted) { countMsg(req); counted = true; }
    send({ type: 'meta', provider: step.id, model: step.model, fallback: !!fallback });
  };

  let webResults = null;
  if (p.webSearch && process.env.SEARCH_API_KEY) {
    try {
      const lastUser = [...p.messages].reverse().find(m => m.role === 'user');
      const q = (typeof lastUser.content === 'string' ? lastUser.content : '').replace(/\s+/g, ' ').slice(0, 280);
      let results = await tavilySearch(q, p.deep);
      const seen = new Set();
      webResults = results.filter(r => r.url && !seen.has(r.url) && seen.add(r.url)).slice(0, 8);
      if (webResults.length) {
        p.messages = p.messages.slice();
        p.messages.splice(1, 0, { role: 'system', content:
          'Web search results (' + new Date().toISOString().slice(0, 10) + '):\n' +
          webResults.map((r, i) => '[' + (i + 1) + '] ' + r.title + '\n' + r.url + '\n' + r.content).join('\n\n') +
          '\n\nUse these results as the primary source, cite them as [1], [2], and answer in the user\'s language.' });
      }
    } catch (e) { console.error('[search]', e.message); }
  }
  const sendSources = () => {
    if (webResults && webResults.length)
      send({ type: 'delta', content: '\n\n---\n**Sources / المصادر:**\n' +
        webResults.map((r, i) => (i + 1) + '. [' + r.title.replace(/\[|\]/g, '') + '](' + r.url + ')').join('\n') });
  };

  try {
    for (let i = 0; i < p.chain.length; i++) {
      const step = p.chain[i];
      const isFallback = i > 0;
      let started = false, got = '', timedOut = false, timer = null;
      currentUp = new AbortController();
      const clearT = () => { if (timer) { clearTimeout(timer); timer = null; } };

      if (!isImageModel(step.model)) {
        timer = setTimeout(() => { timedOut = true; currentUp.abort(); }, STREAM_MS);
        try {
          await sendTo(step.id, {
            model: step.model, messages: p.messages, stream: true, signal: currentUp.signal,
            onDelta: d => {
              got += d;
              if (!started) { started = true; clearT(); emitMeta(step, isFallback); }
              send({ type: 'delta', content: d });
            }
          });
          clearT();
          if (!started) throw new ApiError(502, 'PROVIDER_UNAVAILABLE', 'empty stream');
          sendSources();
          send({ type: 'done' });
          return res.end();
        } catch (e) {
          clearT();
          console.error('[chat:stream]', isFallback ? 'fallback' : '', step.id, e.status || '', timedOut ? 'بث متأخر → الوضع البديل' : e.message);
          if (clientGone || (e && e.name === 'AbortError' && !timedOut)) {
            send({ type: 'done', aborted: true });
            return res.end();
          }
          if (got.length) { sendSources(); send({ type: 'done' }); return res.end(); }
        }
      }

      try {
        const out = await sendHeal(step.id, { model: step.model, messages: p.messages, stream: false, signal: currentUp.signal });
        const text = typeof out === 'string' ? out : (out.text || '');
        const images = typeof out === 'string' ? [] : (out.images || []);
        if (!text.trim() && !images.length) throw new ApiError(502, 'PROVIDER_UNAVAILABLE', 'empty response');
        emitMeta(step, isFallback);
        if (text.trim()) send({ type: 'delta', content: text });
        for (const im of images) send({ type: 'image', mime: im.mime, data: im.data });
        sendSources();
        send({ type: 'done' });
        if (!started) console.log('[chat:stream] ' + step.id + ' — تم الرد ✓' + (isFallback ? ' (fallback)' : ''));
        return res.end();
      } catch (e2) {
        console.error('[chat:stream]', isFallback ? 'fallback' : '', step.id, e2.status || '', e2.message);
        if (clientGone) { send({ type: 'done', aborted: true }); return res.end(); }
        if (i === p.chain.length - 1) { send({ type: 'error', code: friendly(e2) }); return res.end(); }
      }
    }
    send({ type: 'error', code: 'PROVIDER' });
    res.end();
  } finally {
    active.set(k, Math.max(0, (active.get(k) || 0) - 1));
  }
});

const FRONTEND = path.join(__dirname, '..', 'frontend');
app.use(express.static(FRONTEND, { extensions: ['html'] }));

(function () {
  const required = ['index.html', 'chat.html', 'manifest.json', 'sw.js', 'css/styles.css',
    'js/boot.js', 'js/storage.js', 'js/language.js', 'js/theme.js', 'js/ui.js', 'js/markdown.js',
    'js/models.js', 'js/settings.js', 'js/chat.js', 'js/app.js', 'js/i18n/ar.js', 'js/i18n/en.js'];
  const missing = required.filter(f => !fs.existsSync(path.join(FRONTEND, f)));
  if (missing.length) {
    console.warn('\n⚠ ملفات ناقصة في frontend');
    missing.forEach(f => console.warn('   ✗ ' + f));
  } else console.log('✓ كل ملفات الـ frontend موجودة');
})();

app.use((req, res) => {
  if (req.method === 'GET' && !req.path.startsWith('/api')) {
    const p = req.path.replace(/</g, '&lt;');
    res.status(404).type('html').send('<!DOCTYPE html><html lang="ar" dir="rtl"><head><meta charset="UTF-8"><title>غير موجود — Mohsen AI</title><style>body{font-family:system-ui,sans-serif;background:#F6F7FB;color:#131A2E;display:flex;align-items:center;justify-content:center;min-height:100vh;margin:0}.c{background:#fff;border:1px solid #E4E7F1;border-radius:16px;padding:34px;max-width:540px}h1{font-size:19px;margin:0 0 10px}p{color:#565E76;font-size:14px;line-height:1.9;margin:6px 0}code{background:#F1F3FA;border-radius:6px;padding:2px 8px;font-size:13px;direction:ltr;display:inline-block}a{color:#4F5BE8;font-weight:600}</style></head><body><div class="c"><h1>الصفحة مش موجودة على السيرفر</h1><p>المسار: <code>' + p + '</code></p><p><a href="/">← رجوع للرئيسية</a></p></div></body></html>');
  } else res.status(404).json({ error: { code: 'NOT_FOUND' } });
});
app.use((err, req, res, next) => {
  if (err.type === 'entity.parse.failed') return res.status(400).json({ error: { code: 'GENERIC' } });
  console.error('[server]', err.status || '', err.message, err.cause ? '[' + (err.cause.code || '') + ']' : '');
  if (res.headersSent) return next(err);
  res.status(err.status || 500).json({ error: { code: 'GENERIC' } });
});

const ready = configuredIds();
console.log(ready.length ? '🔑 مزودون جاهزون: ' + ready.join(', ') + (process.env.SEARCH_API_KEY ? ' + بحث ويب ✓' : '')
  : '⚠ لا توجد مفاتيح — شغّل: npm run setup');
const server = app.listen(PORT, () => console.log('Mohsen AI v3.5 → http://localhost:' + PORT));
server.on('error', e => {
  if (e.code === 'EADDRINUSE') {
    console.error('\n✗ البورت ' + PORT + ' مشغول. الحل: taskkill /F /IM node.exe ثم npm start\n');
    process.exit(1);
  }
  throw e;
});