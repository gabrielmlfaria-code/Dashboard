const DB_NAME = "absenteismo_posicao";
const DB_VERSION = 1;
const STORE_NAME = "keyval";
/** Evita tela presa em "Carregando…" se o IndexedDB travar (ex.: OneDrive, outra aba). */
const IDB_OPEN_MS = 8000;
const IDB_TX_MS = 12000;
const IDB_TX_LARGE_MS = 120000;

function canUseIndexedDb() {
  return typeof indexedDB !== "undefined";
}

function withTimeout(promise, ms, label) {
  return Promise.race([
    promise,
    new Promise((_, reject) => {
      setTimeout(() => reject(new Error(`${label} (${ms}ms)`)), ms);
    }),
  ]);
}

function openDb() {
  if (!canUseIndexedDb()) return Promise.resolve(null);
  const openPromise = new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) db.createObjectStore(STORE_NAME);
    };
    req.onblocked = () => {
      console.warn(
        "[posicaoStorage] IndexedDB bloqueado — feche outras abas do app ou aguarde a sincronização do navegador.",
      );
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
  return withTimeout(openPromise, IDB_OPEN_MS, "IndexedDB.open").catch((err) => {
    console.warn("[posicaoStorage]", err?.message || err);
    return null;
  });
}

export async function loadPosicaoStoredValue(key, fallback = null) {
  try {
    const db = await openDb();
    if (!db) return fallback;
    const readPromise = new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, "readonly");
      const req = tx.objectStore(STORE_NAME).get(key);
      req.onsuccess = () => resolve(req.result ?? fallback);
      req.onerror = () => reject(req.error);
    });
    return await withTimeout(readPromise, IDB_TX_MS, `IndexedDB.get(${key})`);
  } catch (err) {
    console.warn("[posicaoStorage] leitura falhou:", key, err?.message || err);
    return fallback;
  }
}

function saveTxTimeoutMs(key, value) {
  const isLargeBlob =
    key.startsWith("posicao_cct_blob_") ||
    value instanceof Uint8Array ||
    value instanceof ArrayBuffer ||
    (typeof Blob !== "undefined" && value instanceof Blob);
  return isLargeBlob ? IDB_TX_LARGE_MS : IDB_TX_MS;
}

export async function savePosicaoStoredValue(key, value) {
  try {
    const db = await openDb();
    if (!db) return false;
    const writePromise = new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, "readwrite");
      tx.oncomplete = () => resolve(true);
      tx.onerror = () => reject(tx.error);
      tx.objectStore(STORE_NAME).put(value, key);
    });
    await withTimeout(writePromise, saveTxTimeoutMs(key, value), `IndexedDB.put(${key})`);
    return true;
  } catch (err) {
    console.warn("[posicaoStorage] gravação falhou:", key, err?.message || err);
    return false;
  }
}

export async function removePosicaoStoredValue(key) {
  try {
    const db = await openDb();
    if (!db) return false;
    await new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, "readwrite");
      tx.oncomplete = () => resolve(true);
      tx.onerror = () => reject(tx.error);
      tx.objectStore(STORE_NAME).delete(key);
    });
    return true;
  } catch {
    return false;
  }
}
