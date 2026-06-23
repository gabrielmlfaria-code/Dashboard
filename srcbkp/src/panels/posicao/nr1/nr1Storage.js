import {
  loadPosicaoStoredValue,
  removePosicaoStoredValue,
  savePosicaoStoredValue,
} from "../posicaoStorage.js";
import { ApiSources, getApiSource } from "../../../api/apiMode.js";
import { Nr1Api } from "../../../api/nr1Api.js";
import {
  NR1_LS_CARDS_PROG,
  NR1_LS_CHECKLIST,
  NR1_LS_CHECKLIST_META,
  NR1_LS_REGISTROS,
} from "./nr1Data.js";

export const NR1_ANEXO_PREFIX = "nr1_anexo_";
export const NR1_MAX_ANEXO_BYTES = 5 * 1024 * 1024;
export const NR1_MAX_ANEXOS = 5;
export const NR1_BACKUP_VERSION = 1;

const anexoKey = (registroId, anexoId) => `${NR1_ANEXO_PREFIX}${registroId}_${anexoId}`;

function readJson(key, fallback) {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return fallback;
    return JSON.parse(raw);
  } catch {
    return fallback;
  }
}

function writeJson(key, value) {
  localStorage.setItem(key, JSON.stringify(value));
}

function isNr1ApiSource() {
  return getApiSource("nr1") === ApiSources.API;
}

export function loadNr1Registros() {
  return readJson(NR1_LS_REGISTROS, []);
}

export function saveNr1Registros(registros) {
  writeJson(NR1_LS_REGISTROS, registros);
}

export function loadNr1Checklist() {
  return readJson(NR1_LS_CHECKLIST, {});
}

export function saveNr1Checklist(state) {
  writeJson(NR1_LS_CHECKLIST, state);
}

export function loadNr1ChecklistMeta() {
  return readJson(NR1_LS_CHECKLIST_META, {});
}

export function saveNr1ChecklistMeta(state) {
  writeJson(NR1_LS_CHECKLIST_META, state);
}

export function loadNr1CardsProg() {
  return readJson(NR1_LS_CARDS_PROG, {});
}

export function saveNr1CardsProg(state) {
  writeJson(NR1_LS_CARDS_PROG, state);
}

export async function loadNr1EstadoPersisted() {
  if (isNr1ApiSource()) {
    const estado = await Nr1Api.getEstado();
    writeJson(NR1_LS_REGISTROS, estado.registros || []);
    writeJson(NR1_LS_CHECKLIST, estado.checkState || {});
    writeJson(NR1_LS_CHECKLIST_META, estado.checklistMeta || {});
    writeJson(NR1_LS_CARDS_PROG, estado.cardsProg || {});
    return {
      registros: estado.registros || [],
      checkState: estado.checkState || {},
      checklistMeta: estado.checklistMeta || {},
      cardsProg: estado.cardsProg || {},
    };
  }
  return {
    registros: loadNr1Registros(),
    checkState: loadNr1Checklist(),
    checklistMeta: loadNr1ChecklistMeta(),
    cardsProg: loadNr1CardsProg(),
  };
}

export async function saveNr1EstadoPersisted({
  registros = loadNr1Registros(),
  checkState = loadNr1Checklist(),
  checklistMeta = loadNr1ChecklistMeta(),
  cardsProg = loadNr1CardsProg(),
} = {}) {
  if (isNr1ApiSource()) {
    await Nr1Api.saveEstado({ registros, checkState, checklistMeta, cardsProg });
  }
  saveNr1Registros(registros);
  saveNr1Checklist(checkState);
  saveNr1ChecklistMeta(checklistMeta);
  saveNr1CardsProg(cardsProg);
}

export async function saveNr1Anexo(registroId, anexoId, blob) {
  if (!registroId || !anexoId || !blob) return false;
  return savePosicaoStoredValue(anexoKey(registroId, anexoId), blob);
}

export async function loadNr1Anexo(registroId, anexoId) {
  if (!registroId || !anexoId) return null;
  const value = await loadPosicaoStoredValue(anexoKey(registroId, anexoId), null);
  return value instanceof Blob ? value : null;
}

export async function removeNr1Anexos(registroId, anexos = []) {
  if (!registroId || !Array.isArray(anexos)) return;
  await Promise.all(
    anexos.map((anexo) => removePosicaoStoredValue(anexoKey(registroId, anexo.id)).catch(() => false)),
  );
}

export function downloadNr1Anexo(blob, nome = "anexo") {
  if (!blob) return;
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = nome;
  a.click();
  URL.revokeObjectURL(url);
}

function blobToBase64(blob) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = String(reader.result || "");
      const base64 = result.includes(",") ? result.split(",")[1] : result;
      resolve(base64);
    };
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(blob);
  });
}

function base64ToBlob(base64, tipo = "application/octet-stream") {
  const binary = atob(String(base64 || ""));
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
  return new Blob([bytes], { type: tipo });
}

export async function buildNr1BackupData({
  registros = [],
  checkState = {},
  checklistMeta = {},
  cardsProg = {},
} = {}) {
  const list = Array.isArray(registros) ? registros : [];
  const anexos = [];
  for (const reg of list) {
    for (const anexo of reg.anexos || []) {
      const blob = await loadNr1Anexo(reg.id, anexo.id);
      if (!blob) continue;
      anexos.push({
        registroId: reg.id,
        anexoId: anexo.id,
        nome: anexo.nome,
        tipo: anexo.tipo,
        tamanho: anexo.tamanho,
        dataBase64: await blobToBase64(blob),
      });
    }
  }
  return {
    version: NR1_BACKUP_VERSION,
    module: "nr1",
    exportedAt: new Date().toISOString(),
    registros: list,
    checkState,
    checklistMeta,
    cardsProg,
    anexos,
  };
}

export async function downloadNr1Backup({
  registros = [],
  checkState = {},
  checklistMeta = {},
  cardsProg = {},
} = {}) {
  const payload = await buildNr1BackupData({ registros, checkState, checklistMeta, cardsProg });
  const json = JSON.stringify(payload);
  const blob = new Blob([json], { type: "application/json;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  const stamp = new Date().toISOString().slice(0, 10);
  a.href = url;
  a.download = `nr1_backup_${stamp}.json`;
  a.click();
  URL.revokeObjectURL(url);
  return payload;
}

export async function importNr1BackupData(payload) {
  const data = payload && typeof payload === "object" ? payload : {};
  if (data.module !== "nr1") {
    throw new Error("Arquivo não é um backup do módulo NR-1.");
  }
  if (!Array.isArray(data.registros)) {
    throw new Error("Backup inválido: registros ausentes.");
  }
  let anexosRestored = 0;
  for (const item of Array.isArray(data.anexos) ? data.anexos : []) {
    if (!item?.registroId || !item?.anexoId || !item?.dataBase64) continue;
    const blob = base64ToBlob(item.dataBase64, item.tipo || "application/octet-stream");
    const ok = await saveNr1Anexo(item.registroId, item.anexoId, blob);
    if (ok) anexosRestored += 1;
  }
  saveNr1Registros(data.registros);
  if (data.checkState && typeof data.checkState === "object") saveNr1Checklist(data.checkState);
  if (data.checklistMeta && typeof data.checklistMeta === "object") saveNr1ChecklistMeta(data.checklistMeta);
  if (data.cardsProg && typeof data.cardsProg === "object") saveNr1CardsProg(data.cardsProg);
  return {
    registros: data.registros,
    checkState: data.checkState || {},
    checklistMeta: data.checklistMeta || {},
    cardsProg: data.cardsProg || {},
    anexosRestored,
  };
}
