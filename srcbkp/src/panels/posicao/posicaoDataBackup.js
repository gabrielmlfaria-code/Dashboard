import {
  POSICAO_IMPORT_OVERRIDES_KEY,
  loadImportOverrides,
  saveImportOverrides,
} from "./posicaoImport.js";
import {
  loadPosicaoStoredValue,
  removePosicaoStoredValue,
  savePosicaoStoredValue,
} from "./posicaoStorage.js";

export const POSICAO_HIST_TABLE_IMPORT_KEY = "posicao_hist_table_import_v1";
export const POSICAO_HIST_EVENTS_IMPORT_KEY = "posicao_hist_events_flat_v1";
export const POSICAO_BACKUP_VERSION = 1;
/** Acima disso, dias e eventos são gravados separados no IndexedDB (planilhas grandes). */
export const POSICAO_HIST_SPLIT_EVENT_THRESHOLD = 5000;

/** localStorage costuma falhar acima de ~2–4 MB; histórico grande fica só no IndexedDB. */
export const POSICAO_LS_MAX_JSON_CHARS = 2_000_000;

export function loadHistTableImportFromLocalStorage() {
  try {
    const raw = localStorage.getItem(POSICAO_HIST_TABLE_IMPORT_KEY);
    const parsed = raw ? JSON.parse(raw) : null;
    return Array.isArray(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

export function saveHistTableImportToLocalStorage(rows) {
  try {
    const json = JSON.stringify(rows ?? null);
    if (json.length > POSICAO_LS_MAX_JSON_CHARS) {
      localStorage.removeItem(POSICAO_HIST_TABLE_IMPORT_KEY);
      return false;
    }
    localStorage.setItem(POSICAO_HIST_TABLE_IMPORT_KEY, json);
    return true;
  } catch {
    try {
      localStorage.removeItem(POSICAO_HIST_TABLE_IMPORT_KEY);
    } catch {}
    return false;
  }
}

function countHistEvents(rows) {
  if (!Array.isArray(rows)) return 0;
  return rows.reduce((s, r) => s + (Array.isArray(r._events) ? r._events.length : 0), 0);
}

function isSlimHistDayRow(row) {
  return row && !Array.isArray(row._events) && Number(row._eventCount) >= 0;
}

export function attachEventsToHistDays(days, flatEvents) {
  if (!Array.isArray(days) || !days.length) return null;
  if (!Array.isArray(flatEvents) || !flatEvents.length) {
    return days.map((d) => ({
      ...d,
      _events: Number(d._eventCount) > 0 ? [] : (d._events ?? null),
    }));
  }
  const byDate = new Map();
  for (const ev of flatEvents) {
    const date = String(ev?.data || "").trim();
    if (!date) continue;
    if (!byDate.has(date)) byDate.set(date, []);
    byDate.get(date).push(ev);
  }
  return days.map((d) => ({
    ...d,
    _events: byDate.get(d.date) ?? (Number(d._eventCount) > 0 ? [] : null),
  }));
}

export async function loadHistTableImportMerged() {
  const fromLs = loadHistTableImportFromLocalStorage();
  if (fromLs?.length && fromLs.some((d) => Array.isArray(d._events))) {
    return fromLs;
  }

  const fromIdbDays = await loadPosicaoStoredValue(POSICAO_HIST_TABLE_IMPORT_KEY, null);
  const fromIdbEvents = await loadPosicaoStoredValue(POSICAO_HIST_EVENTS_IMPORT_KEY, null);
  const days = Array.isArray(fromIdbDays) ? fromIdbDays : null;
  const flatEvents = Array.isArray(fromIdbEvents) ? fromIdbEvents : null;

  if (days?.length) {
    if (flatEvents?.length || days.some(isSlimHistDayRow)) {
      return attachEventsToHistDays(days, flatEvents);
    }
    return days;
  }

  if (fromLs?.length) {
    if (flatEvents?.length) return attachEventsToHistDays(fromLs, flatEvents);
    return fromLs;
  }
  return null;
}

export async function saveHistTableImport(rows) {
  const eventCount = countHistEvents(rows);
  const useSplit = eventCount >= POSICAO_HIST_SPLIT_EVENT_THRESHOLD;

  if (useSplit) {
    const flatEvents = [];
    for (const r of rows) {
      if (Array.isArray(r._events)) flatEvents.push(...r._events);
    }
    const slimDays = rows.map(({ _events, ...rest }) => ({
      ...rest,
      _eventCount: _events?.length ?? 0,
    }));
    try {
      localStorage.removeItem(POSICAO_HIST_TABLE_IMPORT_KEY);
    } catch {}
    const idbEvents = await savePosicaoStoredValue(POSICAO_HIST_EVENTS_IMPORT_KEY, flatEvents);
    const idbDays = await savePosicaoStoredValue(POSICAO_HIST_TABLE_IMPORT_KEY, slimDays);
    return {
      lsOk: false,
      idbOk: Boolean(idbEvents && idbDays),
      ok: Boolean(idbEvents && idbDays),
      eventCount,
      split: true,
    };
  }

  await removePosicaoStoredValue(POSICAO_HIST_EVENTS_IMPORT_KEY);
  const lsOk = saveHistTableImportToLocalStorage(rows);
  const idbOk = await savePosicaoStoredValue(POSICAO_HIST_TABLE_IMPORT_KEY, rows ?? null);
  return { lsOk, idbOk, ok: lsOk || idbOk, eventCount, split: false };
}

export async function removeHistTableImport() {
  try {
    localStorage.removeItem(POSICAO_HIST_TABLE_IMPORT_KEY);
  } catch {}
  await removePosicaoStoredValue(POSICAO_HIST_TABLE_IMPORT_KEY);
  await removePosicaoStoredValue(POSICAO_HIST_EVENTS_IMPORT_KEY);
}

export async function buildPosicaoBackupPayload() {
  const histTable = await loadHistTableImportMerged();
  const overrides = loadImportOverrides();
  const idbOverrides = await loadPosicaoStoredValue(POSICAO_IMPORT_OVERRIDES_KEY, null);
  const mergedOverrides =
    idbOverrides && typeof idbOverrides === "object" && Object.keys(idbOverrides).length
      ? idbOverrides
      : overrides;

  return {
    version: POSICAO_BACKUP_VERSION,
    exportedAt: new Date().toISOString(),
    origin: typeof window !== "undefined" ? window.location.origin : "",
    histTable,
    overrides: mergedOverrides,
  };
}

export function downloadPosicaoBackup(payload) {
  const blob = new Blob([JSON.stringify(payload, null, 2)], {
    type: "application/json",
  });
  const stamp = new Date().toISOString().slice(0, 19).replace(/[:T]/g, "-");
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = `absenteismo-posicao-backup-${stamp}.json`;
  a.click();
  URL.revokeObjectURL(a.href);
}

export async function exportPosicaoBackup() {
  const payload = await buildPosicaoBackupPayload();
  downloadPosicaoBackup(payload);
  const days = Array.isArray(payload.histTable) ? payload.histTable.length : 0;
  return { days, hasOverrides: Boolean(payload.overrides && Object.keys(payload.overrides).length) };
}

export async function importPosicaoBackupFile(file) {
  const text = await file.text();
  const parsed = JSON.parse(text);
  if (!parsed || typeof parsed !== "object") throw new Error("Arquivo inválido");

  const histTable = Array.isArray(parsed.histTable) ? parsed.histTable : null;
  const overrides =
    parsed.overrides && typeof parsed.overrides === "object" ? parsed.overrides : null;

  if (!histTable?.length && !overrides) {
    throw new Error("Backup vazio (sem tabela nem overrides)");
  }

  if (histTable?.length) {
    const { ok } = await saveHistTableImport(histTable);
    if (!ok) throw new Error("Não foi possível gravar a tabela importada no navegador");
  }

  if (overrides) {
    saveImportOverrides(overrides);
    await savePosicaoStoredValue(POSICAO_IMPORT_OVERRIDES_KEY, overrides);
  }

  return {
    histTable,
    overrides,
    days: histTable?.length ?? 0,
  };
}
