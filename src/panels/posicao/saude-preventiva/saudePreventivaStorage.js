import {
  loadPosicaoStoredValue,
  removePosicaoStoredValue,
  savePosicaoStoredValue,
} from "../posicaoStorage.js";
import { ApiSources, getApiSource } from "../../../api/apiMode.js";
import { SaudePreventivaApi } from "../../../api/saudePreventivaApi.js";
import { SAUDE_PREVENTIVA_LS_KEY } from "./saudePreventivaCampanhas.js";

export const SAUDE_REGISTROS_IDB_KEY = "saude_preventiva_registros_v1";
export const SAUDE_ANEXO_PREFIX = "saude_preventiva_anexo_";
export const SAUDE_MAX_ANEXO_BYTES = 5 * 1024 * 1024;
export const SAUDE_MAX_ANEXOS = 5;

const anexoKey = (registroId, anexoId) => `${SAUDE_ANEXO_PREFIX}${registroId}_${anexoId}`;

/** Leitura síncrona (localStorage) — usada pelo NL e relatório. */
export function loadSaudeRegistrosSync() {
  try {
    if (typeof window === "undefined") return [];
    const raw = window.localStorage.getItem(SAUDE_PREVENTIVA_LS_KEY);
    const parsed = JSON.parse(raw || "[]");
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export async function loadSaudeRegistrosPersisted() {
  if (getApiSource("saudePreventiva") === ApiSources.API) {
    const payload = await SaudePreventivaApi.getRegistros();
    const rows = Array.isArray(payload?.registros) ? payload.registros : [];
    await saveSaudeRegistrosLocal(rows);
    return rows;
  }

  const fromIdb = await loadPosicaoStoredValue(SAUDE_REGISTROS_IDB_KEY, null);
  if (Array.isArray(fromIdb)) return fromIdb;

  const legacy = loadSaudeRegistrosSync();
  if (legacy.length) {
    await saveSaudeRegistrosPersisted(legacy);
  }
  return legacy;
}

async function saveSaudeRegistrosLocal(registros) {
  const list = Array.isArray(registros) ? registros : [];
  const idbOk = await savePosicaoStoredValue(SAUDE_REGISTROS_IDB_KEY, list);
  try {
    if (typeof window !== "undefined") {
      window.localStorage.setItem(SAUDE_PREVENTIVA_LS_KEY, JSON.stringify(list));
    }
  } catch {
    // IndexedDB é a fonte principal para anexos + registros.
  }
  return idbOk;
}

export async function saveSaudeRegistrosPersisted(registros) {
  const list = Array.isArray(registros) ? registros : [];
  if (getApiSource("saudePreventiva") === ApiSources.API) {
    await SaudePreventivaApi.saveRegistros(list);
    await saveSaudeRegistrosLocal(list);
    return true;
  }
  return saveSaudeRegistrosLocal(list);
}

export async function saveSaudeAnexo(registroId, anexoId, blob) {
  if (!registroId || !anexoId || !blob) return false;
  return savePosicaoStoredValue(anexoKey(registroId, anexoId), blob);
}

export async function loadSaudeAnexo(registroId, anexoId) {
  if (!registroId || !anexoId) return null;
  const value = await loadPosicaoStoredValue(anexoKey(registroId, anexoId), null);
  return value instanceof Blob ? value : null;
}

export async function removeSaudeAnexos(registroId, anexos = []) {
  if (!registroId || !Array.isArray(anexos)) return;
  await Promise.all(
    anexos.map((anexo) => removePosicaoStoredValue(anexoKey(registroId, anexo.id)).catch(() => false)),
  );
}

export function downloadSaudeAnexo(blob, nome = "anexo") {
  if (!blob) return;
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = nome;
  a.click();
  URL.revokeObjectURL(url);
}

export const SAUDE_BACKUP_VERSION = 1;

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

/** Monta payload completo (registros + anexos em base64). */
export async function buildSaudePreventivaBackupData(registros = []) {
  const list = Array.isArray(registros) ? registros : [];
  const anexos = [];
  for (const reg of list) {
    for (const anexo of reg.anexos || []) {
      const blob = await loadSaudeAnexo(reg.id, anexo.id);
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
    version: SAUDE_BACKUP_VERSION,
    module: "saude_preventiva",
    exportedAt: new Date().toISOString(),
    registros: list,
    anexos,
  };
}

export async function downloadSaudePreventivaBackup(registros = []) {
  const payload = await buildSaudePreventivaBackupData(registros);
  const json = JSON.stringify(payload);
  const blob = new Blob([json], { type: "application/json;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  const stamp = new Date().toISOString().slice(0, 10);
  a.href = url;
  a.download = `saude_preventiva_backup_${stamp}.json`;
  a.click();
  URL.revokeObjectURL(url);
  return payload;
}

/** Restaura registros e anexos a partir de backup JSON. */
export async function importSaudePreventivaBackupData(payload) {
  const data = payload && typeof payload === "object" ? payload : {};
  if (data.module !== "saude_preventiva") {
    throw new Error("Arquivo não é um backup de Saúde Preventiva.");
  }
  if (!Array.isArray(data.registros)) {
    throw new Error("Backup inválido: registros ausentes.");
  }
  const registros = data.registros;
  let anexosRestored = 0;
  for (const item of Array.isArray(data.anexos) ? data.anexos : []) {
    if (!item?.registroId || !item?.anexoId || !item?.dataBase64) continue;
    const blob = base64ToBlob(item.dataBase64, item.tipo || "application/octet-stream");
    const ok = await saveSaudeAnexo(item.registroId, item.anexoId, blob);
    if (ok) anexosRestored += 1;
  }
  await saveSaudeRegistrosPersisted(registros);
  return { registros, anexosRestored };
}
