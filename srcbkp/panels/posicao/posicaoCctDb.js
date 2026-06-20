/** Armazenamento de PDF: memória (sessão) + OPFS + IndexedDB. */

const DB_NAME = "absenteismo_cct_v1";
const DB_VERSION = 1;
const STORE_PDF = "pdf";
const OPEN_MS = 15_000;
const TX_MS = 180_000;

/** @type {Map<string, Blob>} */
const memoryCache = new Map();

function canUseIdb() {
  return typeof indexedDB !== "undefined";
}

function withTimeout(promise, ms, label) {
  return Promise.race([
    promise,
    new Promise((_, reject) => {
      setTimeout(() => reject(new Error(`${label} (${Math.round(ms / 1000)}s)`)), ms);
    }),
  ]);
}

let dbPromise = null;

function openCctDb() {
  if (!canUseIdb()) return Promise.resolve(null);
  if (!dbPromise) {
    dbPromise = withTimeout(
      new Promise((resolve, reject) => {
        const req = indexedDB.open(DB_NAME, DB_VERSION);
        req.onupgradeneeded = () => {
          const db = req.result;
          if (!db.objectStoreNames.contains(STORE_PDF)) {
            db.createObjectStore(STORE_PDF);
          }
        };
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => reject(req.error);
      }),
      OPEN_MS,
      "IndexedDB CCT.open",
    ).catch((err) => {
      console.warn("[posicaoCctDb]", err?.message || err);
      dbPromise = null;
      return null;
    });
  }
  return dbPromise;
}

async function idbPut(id, blob) {
  const db = await openCctDb();
  if (!db) return false;
  try {
    await withTimeout(
      new Promise((resolve, reject) => {
        const tx = db.transaction(STORE_PDF, "readwrite");
        tx.oncomplete = () => resolve();
        tx.onerror = () => reject(tx.error);
        tx.objectStore(STORE_PDF).put(blob, id);
      }),
      TX_MS,
      `CCT.idb.put(${id})`,
    );
    const got = await idbGet(id);
    return got instanceof Blob && got.size === blob.size;
  } catch (err) {
    console.warn("[posicaoCctDb] idb put", err?.message || err);
    return false;
  }
}

async function idbGet(id) {
  const db = await openCctDb();
  if (!db) return null;
  try {
    const result = await withTimeout(
      new Promise((resolve, reject) => {
        const tx = db.transaction(STORE_PDF, "readonly");
        const req = tx.objectStore(STORE_PDF).get(id);
        req.onsuccess = () => resolve(req.result ?? null);
        req.onerror = () => reject(req.error);
      }),
      TX_MS,
      `CCT.idb.get(${id})`,
    );
    return result instanceof Blob ? result : null;
  } catch {
    return null;
  }
}

async function idbDelete(id) {
  const db = await openCctDb();
  if (!db) return;
  try {
    await new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_PDF, "readwrite");
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
      tx.objectStore(STORE_PDF).delete(id);
    });
  } catch {
    /* ignore */
  }
}

async function opfsPut(id, blob) {
  try {
    if (!navigator.storage?.getDirectory) return false;
    const root = await navigator.storage.getDirectory();
    const fh = await root.getFileHandle(`${id}.pdf`, { create: true });
    const w = await fh.createWritable();
    await w.write(blob);
    await w.close();
    return true;
  } catch (err) {
    console.warn("[posicaoCctDb] opfs put", err?.message || err);
    return false;
  }
}

async function opfsGet(id) {
  try {
    if (!navigator.storage?.getDirectory) return null;
    const root = await navigator.storage.getDirectory();
    const fh = await root.getFileHandle(`${id}.pdf`);
    const file = await fh.getFile();
    return file instanceof Blob ? file : null;
  } catch {
    return null;
  }
}

async function opfsDelete(id) {
  try {
    if (!navigator.storage?.getDirectory) return;
    const root = await navigator.storage.getDirectory();
    await root.removeEntry(`${id}.pdf`);
  } catch {
    /* ignore */
  }
}

/** @returns {Promise<{ ok: boolean, storage?: 'idb'|'opfs'|'memory', error?: string }>} */
export async function cctPutPdf(id, blob) {
  if (!(blob instanceof Blob)) {
    return { ok: false, error: "Arquivo inválido" };
  }

  memoryCache.set(id, blob);

  if (await idbPut(id, blob)) {
    return { ok: true, storage: "idb" };
  }
  if (await opfsPut(id, blob)) {
    return { ok: true, storage: "opfs" };
  }

  return { ok: true, storage: "memory" };
}

export async function cctGetPdf(id) {
  const mem = memoryCache.get(id);
  if (mem instanceof Blob) return mem;

  const fromIdb = await idbGet(id);
  if (fromIdb) {
    memoryCache.set(id, fromIdb);
    return fromIdb;
  }

  const fromOpfs = await opfsGet(id);
  if (fromOpfs) {
    memoryCache.set(id, fromOpfs);
    return fromOpfs;
  }

  return null;
}

export async function cctDeletePdf(id) {
  memoryCache.delete(id);
  await idbDelete(id);
  await opfsDelete(id);
}

export async function cctClearAllPdfs(ids) {
  for (const id of ids) await cctDeletePdf(id);
}
