(function () {
  'use strict';
  const DB = 'nfcstudio';
  const ST = 'kv';

  function open() {
    return new Promise((res, rej) => {
      const r = indexedDB.open(DB, 1);
      r.onupgradeneeded = () => r.result.createObjectStore(ST);
      r.onsuccess = () => res(r.result);
      r.onerror = () => rej(r.error);
    });
  }

  function fromLocalStorage() {
    try {
      return JSON.parse(localStorage.getItem(DB) || 'null');
    } catch (_) {
      return null;
    }
  }

  async function load() {
    try {
      const db = await open();
      const v = await new Promise((res, rej) => {
        const q = db.transaction(ST).objectStore(ST).get('state');
        q.onsuccess = () => res(q.result || null);
        q.onerror = () => rej(q.error);
      });
      // Si IndexedDB está vacío pero hubo un guardado de respaldo en localStorage, usarlo
      return v || fromLocalStorage();
    } catch (e) {
      return fromLocalStorage();
    }
  }

  async function save(state) {
    try {
      const db = await open();
      await new Promise((res, rej) => {
        const tx = db.transaction(ST, 'readwrite');
        tx.objectStore(ST).put(state, 'state');
        tx.oncomplete = res;
        tx.onerror = () => rej(tx.error);
      });
      return true;
    } catch (e) {
      try {
        localStorage.setItem(DB, JSON.stringify(state));
        return true;
      } catch (_) {
        return false;
      }
    }
  }

  window.Store = { load, save };
})();
