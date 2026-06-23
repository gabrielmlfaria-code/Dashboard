function getLocalStorage() {
  if (typeof window === "undefined" || !window.localStorage) return null;
  return window.localStorage;
}

export const Store = {
  get(key, defaultValue) {
    try {
      const storage = getLocalStorage();
      if (!storage) return defaultValue;
      const value = storage.getItem(key);
      return value != null ? JSON.parse(value) : defaultValue;
    } catch {
      return defaultValue;
    }
  },

  set(key, value) {
    try {
      const storage = getLocalStorage();
      if (!storage) return;
      storage.setItem(key, JSON.stringify(value));
    } catch {
      // Storage indisponivel ou quota excedida: falha silenciosa.
    }
  },

  remove(key) {
    try {
      const storage = getLocalStorage();
      if (!storage) return;
      storage.removeItem(key);
    } catch {
      // Ignora ambientes sem storage.
    }
  },
};
