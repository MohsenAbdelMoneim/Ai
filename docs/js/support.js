/* ============================================================
   Mohsen AI — Support Modal (v5.0)
   ============================================================ */
(function(){
  'use strict';

  const PHONE       = '01096295395';
  const PHONE_INTL  = '+201096295395';   // للواتساب والاتصال الدولي
  const VF_CASH     = '01096295395';
  const DEV_NAME    = 'محسن عبدالمنعم إبراهيم';
  const DEV_ROLE    = 'Frontend Engineer · UI/UX';
  const DEV_QUOTE   = '"I don\'t just build websites — I design experiences that feel alive."';

  // ============ HTML template ============
  function buildModal(){
    return `
<div class="support-overlay" id="supportOverlay" role="dialog" aria-modal="true" aria-labelledby="supportTitle">
  <div class="support-modal" role="document">
    <div class="sm-head">
      <h2 id="supportTitle">الدعم الفني 💚</h2>
      <button class="sm-close" id="supportClose" aria-label="إغلاق">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round">
          <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
        </svg>
      </button>
    </div>
    <div class="sm-body">

      <!-- بروفايل -->
      <div class="sm-profile">
        <div class="m-logo lg" aria-hidden="true">M</div>
        <div class="sm-profile-info">
          <p class="sm-name">${DEV_NAME}</p>
          <p class="sm-role">${DEV_ROLE}</p>
          <p class="sm-quote">${DEV_QUOTE}</p>
        </div>
      </div>

      <!-- رقم التواصل -->
      <div class="sm-phone-card">
        <div class="sm-phone-label">للتواصل والدعم الفني</div>
        <span class="sm-phone-num">${PHONE}</span>
        <div class="sm-phone-actions">
          <a class="sup-action call" href="tel:${PHONE}">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round">
              <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"/>
            </svg>
            اتصال الآن
          </a>
          <a class="sup-action whatsapp" href="https://wa.me/${PHONE_INTL.replace('+','')}" target="_blank" rel="noopener">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor">
              <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 0 1-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 0 1-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 0 1 2.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0 0 12.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 0 0 5.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 0 0-3.48-8.413"/>
            </svg>
            واتساب
          </a>
          <button class="sup-action copy" id="copyPhoneBtn" type="button">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
              <rect x="9" y="9" width="13" height="13" rx="2" ry="2"/>
              <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>
            </svg>
            نسخ الرقم
          </button>
        </div>
      </div>

      <!-- فودافون كاش -->
      <div class="vf-section">
        <div class="vf-head">
          <span class="vf-badge">Vodafone Cash</span>
          <span class="vf-title">الدعم عبر فودافون كاش</span>
        </div>
        <div class="vf-steps">
          <div class="vf-step">
            <span class="vf-step-num">1</span>
            <span>افتح تطبيق <b>فودافون كاش</b> من موبايلك</span>
          </div>
          <div class="vf-step">
            <span class="vf-step-num">2</span>
            <span>اختار <b>تحويل أموال</b> → ثم <b>تحويل لرقم</b></span>
          </div>
          <div class="vf-step">
            <span class="vf-step-num">3</span>
            <span>اكتب الرقم التالي: <b style="font-family:var(--font-mono);direction:ltr;display:inline-block">${VF_CASH}</b></span>
          </div>
          <div class="vf-step">
            <span class="vf-step-num">4</span>
            <span>اكتب المبلغ → أكد التحويل ✅</span>
          </div>
        </div>

        <!-- QR Code -->
        <div class="qr-wrap">
          <div class="qr-box" id="qrBox"></div>
          <div class="qr-label">
            امسح الكود بـ <b>كاميرا فودافون كاش</b> أو أي تطبيق QR
          </div>
        </div>
      </div>

    </div>
  </div>
</div>
<div class="copy-toast" id="copyToast">
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round">
    <polyline points="20 6 9 17 4 12"/>
  </svg>
  <span>تم نسخ الرقم بنجاح!</span>
</div>
`;
  }

  // ============ QR Code Generator (simple, no libs) ============
  // ملاحظة: بيستخدم QR Server API المجاني عشان يبقى سهل
  // لو عايز offline، استخدم مكتبة زي qrcode.js
  function buildQR(text){
    const size = 200;
    const url = `https://api.qrserver.com/v1/create-qr-code/?size=${size}x${size}&data=${encodeURIComponent(text)}&bgcolor=FFFFFF&color=000000&margin=0`;
    return `<img src="${url}" alt="QR Code" width="${size}" height="${size}" loading="lazy">`;
  }

  // ============ Render + Init ============
  function init(){
    // Injection
    const root = document.createElement('div');
    root.id = 'supportRoot';
    root.innerHTML = buildModal();
    document.body.appendChild(root);

    // Cache
    const overlay  = document.getElementById('supportOverlay');
    const closeBtn = document.getElementById('supportClose');
    const copyBtn  = document.getElementById('copyPhoneBtn');
    const qrBox    = document.getElementById('qrBox');
    const toast    = document.getElementById('copyToast');

    // QR
    if (qrBox) qrBox.innerHTML = buildQR(VF_CASH);

    // ============ Open / Close ============
    function open(){
      overlay.classList.add('show');
      document.body.style.overflow = 'hidden';
    }
    function close(){
      overlay.classList.remove('show');
      document.body.style.overflow = '';
    }

    // Global hooks (بيتنادى من أي مكان)
    window.openSupport = open;
    window.closeSupport = close;

    closeBtn.addEventListener('click', close);
    overlay.addEventListener('click', (e) => { if (e.target === overlay) close(); });
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && overlay.classList.contains('show')) close();
    });

    // ============ Copy Phone ============
    copyBtn.addEventListener('click', async () => {
      try{
        await navigator.clipboard.writeText(PHONE);
        showToast();
      }catch(err){
        // fallback
        const ta = document.createElement('textarea');
        ta.value = PHONE;
        ta.style.position = 'fixed';
        ta.style.opacity = '0';
        document.body.appendChild(ta);
        ta.select();
        try{ document.execCommand('copy'); showToast(); }catch(e){}
        document.body.removeChild(ta);
      }
    });

    function showToast(){
      toast.classList.add('show');
      clearTimeout(showToast._t);
      showToast._t = setTimeout(() => toast.classList.remove('show'), 2200);
    }

    // ============ Auto-attach to any [data-support-open] ============
    document.querySelectorAll('[data-support-open]').forEach(btn => {
      btn.addEventListener('click', (e) => { e.preventDefault(); open(); });
    });
  }

  // ============ Boot ============
  if (document.readyState === 'loading'){
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();