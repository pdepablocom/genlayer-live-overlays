// A tiny key-value store in IndexedDB (logos make configs too big for localStorage).
// Keys: 'current' (the last config) and 'presets' ([{ name, config, saved }]).

const store = {
  db: null,
  open() {
    return new Promise((resolve) => {
      const req = indexedDB.open('gl-live-overlays', 1);
      req.onupgradeneeded = () => req.result.createObjectStore('kv');
      req.onsuccess = () => {
        store.db = req.result;
        resolve();
      };
      // Private windows can refuse IndexedDB; the editor still works, it just won't remember.
      req.onerror = () => resolve();
    });
  },
  get(key) {
    return new Promise((resolve) => {
      if (!store.db) return resolve(null);
      const req = store.db.transaction('kv').objectStore('kv').get(key);
      req.onsuccess = () => resolve(req.result || null);
      req.onerror = () => resolve(null);
    });
  },
  set(key, value) {
    if (!store.db) return;
    store.db.transaction('kv', 'readwrite').objectStore('kv').put(value, key);
  },
};
