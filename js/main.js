(function () {
  'use strict';
  App.start();

  // Service worker: permite instalar la app en la pantalla de inicio y usarla sin internet.
  // Solo funciona con https (o localhost), por eso se comprueba antes.
  const secure = location.protocol === 'https:' || location.hostname === 'localhost' || location.hostname === '127.0.0.1';
  if ('serviceWorker' in navigator && secure) {
    window.addEventListener('load', () => navigator.serviceWorker.register('sw.js').catch(() => {}));
  }
})();
