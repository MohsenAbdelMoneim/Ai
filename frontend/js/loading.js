// loading.js — Auto-redirect to index after loading
(function(){
  function go(){
    try {
      sessionStorage.setItem('mohsen_loading_shown', '1');
    } catch(e){}
    window.location.replace('/index.html');
  }

  // لو الصفحة لسه بتحمّل، استنى load
  if (document.readyState === 'complete') {
    setTimeout(go, 2500);
  } else {
    window.addEventListener('load', function(){
      setTimeout(go, 2500);
    });
  }

  // ⏱️ حماية إضافية: لو حصل أي مشكلة، حوّل بعد 5 ثواني على الأكثر
  setTimeout(function(){
    if (location.pathname.indexOf('loading') !== -1) {
      go();
    }
  }, 5000);
})();