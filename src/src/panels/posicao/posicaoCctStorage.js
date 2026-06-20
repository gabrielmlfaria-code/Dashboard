import { buildAnalysisResult } from "./posicaoCctAnalysis.js";
import { ApiSources, getApiSource } from "../../api/apiMode.js";
import { CctApi } from "../../api/cctApi.js";
import { cctLog, cctLogError } from "./posicaoCctDebug.js";
import { cctClearAllPdfs, cctDeletePdf, cctGetPdf, cctPutPdf } from "./posicaoCctDb.js";
import { parseValidityFromFileName } from "./posicaoCctValidity.js";

export const POSICAO_CCT_INDEX_KEY = "posicao_cct_index_v1";
const LS_INDEX_KEY = "posicao_cct_index_ls_v1";
const SS_INDEX_KEY = "posicao_cct_index_ss_v1";
const MAX_PDF_BYTES = 50 * 1024 * 1024;

function newId() {
  return typeof crypto !== "undefined" && crypto.randomUUID
    ? crypto.randomUUID()
    : `cct_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
}

function labelFromFileName(name) {
  return String(name || "CCT")
    .replace(/\.pdf$/i, "")
    .replace(/[_-]+/g, " ")
    .trim()
    .slice(0, 120);
}

function isPdfFile(file) {
  if (!file) return false;
  const name = String(file.name || "").toLowerCase();
  const type = String(file.type || "").toLowerCase();
  return name.endsWith(".pdf") || type === "application/pdf" || type.includes("pdf");
}

function emitCctChanged() {
  if (typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent("pb-cct-changed"));
  }
}

function readIndexAny() {
  const sources = [
    () => localStorage.getItem(LS_INDEX_KEY),
    () => sessionStorage.getItem(SS_INDEX_KEY),
  ];
  for (const read of sources) {
    try {
      const raw = read();
      const parsed = raw ? JSON.parse(raw) : [];
      if (Array.isArray(parsed) && parsed.length) return parsed;
    } catch {
      /* próximo */
    }
  }
  return [];
}

function writeIndexEverywhere(list) {
  const json = JSON.stringify(list);
  let ok = false;
  try {
    sessionStorage.setItem(SS_INDEX_KEY, json);
    ok = true;
  } catch {
    /* ignore */
  }
  try {
    localStorage.setItem(LS_INDEX_KEY, json);
    ok = true;
  } catch (err) {
    console.warn("[CCT] localStorage:", err?.message || err);
  }
  return ok;
}

export async function loadCctIndex() {
  if (getApiSource("cct") === ApiSources.API) {
    const payload = await CctApi.getDocumentos();
    const list = Array.isArray(payload?.documentos) ? payload.documentos : [];
    writeIndexEverywhere(list);
    return list;
  }

  const fromStore = readIndexAny();
  if (fromStore.length) return fromStore;

  try {
    const { loadPosicaoStoredValue } = await import("./posicaoStorage.js");
    const legacy = await loadPosicaoStoredValue(POSICAO_CCT_INDEX_KEY, []);
    const list = Array.isArray(legacy) ? legacy : [];
    if (list.length) writeIndexEverywhere(list);
    return list;
  } catch {
    return [];
  }
}

async function persistCctIndex(list) {
  const ok = writeIndexEverywhere(list);
  if (getApiSource("cct") === ApiSources.API) {
    await CctApi.saveDocumentos(list);
  }
  try {
    const { savePosicaoStoredValue } = await import("./posicaoStorage.js");
    await savePosicaoStoredValue(POSICAO_CCT_INDEX_KEY, list);
  } catch {
    /* opcional */
  }
  const verify = readIndexAny();
  cctLog("persistCctIndex", { gravados: list.length, ok, lidos: verify.length });
  emitCctChanged();
}

export async function getCctById(id) {
  const list = await loadCctIndex();
  return list.find((d) => d.id === id) ?? null;
}

async function patchCctEntry(id, patch) {
  const index = await loadCctIndex();
  const exists = index.some((d) => d.id === id);
  const next = exists
    ? index.map((d) => (d.id === id ? { ...d, ...patch } : d))
    : [...index, { id, ...patch }];
  await persistCctIndex(next);
  return next.find((d) => d.id === id) ?? null;
}

async function persistCctText(id, text) {
  if (!text?.trim()) return;
  try {
    const { savePosicaoStoredValue } = await import("./posicaoStorage.js");
    await savePosicaoStoredValue(`posicao_cct_text_${id}`, text);
  } catch {
    /* opcional */
  }
}

async function runAnalysisJob(entry, blob, { forceOcr = false } = {}) {
  await patchCctEntry(entry.id, { status: "pending", ocrStatus: forceOcr ? "running" : null });

  let text = "";
  let pageCount = null;
  let isScanned = true;
  let ocrApplied = false;
  let ocrStatus = null;

  try {
    const bytes = new Uint8Array(await blob.arrayBuffer());
    const { extractPdfText } = await import("./posicaoCctPdf.js");
    const extracted = await extractPdfText(bytes);
    text = extracted.text || "";
    pageCount = extracted.pageCount;
    isScanned = Boolean(extracted.scanned) || !text.trim();

    const shouldOcr = (isScanned || forceOcr) && pageCount > 0 && !text.trim();
    if (shouldOcr) {
      try {
        const { isOcrSupported, ocrPdfToText } = await import("./posicaoCctOcr.js");
        if (isOcrSupported()) {
          ocrStatus = "running";
          await patchCctEntry(entry.id, { ocrStatus: "running" });
          cctLog("OCR CCT iniciado", { id: entry.id, pages: pageCount });
          const ocr = await ocrPdfToText(bytes, {
            docId: entry.id,
            maxPages: Math.min(pageCount, 22),
            onProgress: (p) => cctLog("OCR progresso", { id: entry.id, ...p }),
          });
          if (ocr.text?.trim()) {
            text = ocr.text;
            ocrApplied = true;
            isScanned = false;
            ocrStatus = "done";
            await persistCctText(entry.id, text);
            cctLog("OCR CCT concluído", { id: entry.id, chars: text.length });
          } else {
            ocrStatus = "empty";
          }
        }
      } catch (ocrErr) {
        ocrStatus = "error";
        cctLogError("OCR CCT falhou", ocrErr);
      }
    } else if (text) {
      await persistCctText(entry.id, text);
    }
  } catch (err) {
    console.warn("[CCT] análise", entry.fileName, err?.message || err);
    if (ocrStatus === "running") ocrStatus = "error";
  }

  const validity = parseValidityFromFileName(entry.fileName);
  const analysisResult = buildAnalysisResult(
    { ...entry, isScanned, pageCount, ocrApplied },
    text,
  );

  if (ocrApplied && analysisResult.alerts) {
    analysisResult.alerts = analysisResult.alerts.filter(
      (a) => !/digitalizado \(sem texto/i.test(a.title || ""),
    );
    if (!analysisResult.alerts.length && text.length > 200) {
      analysisResult.summary = `${entry.label || entry.fileName}: texto extraído por OCR (${text.length.toLocaleString("pt-BR")} caracteres). Revise cláusulas críticas no PDF original.`;
    }
  }

  await patchCctEntry(entry.id, {
    status: "analyzed",
    pageCount,
    isScanned,
    ocrApplied,
    ocrStatus,
    validFrom: validity.validFrom,
    validUntil: validity.validUntil,
    analysisResult,
    textChars: text.length,
  });
}

/** Reprocessa CCT digitalizada com OCR (manual ou reimportação). */
export async function reprocessCctWithOcr(id) {
  const entry = await getCctById(id);
  if (!entry) return { ok: false, error: "CCT não encontrada" };
  const blob = await cctGetPdf(id);
  if (!blob) return { ok: false, error: "PDF não encontrado" };
  await runAnalysisJob(entry, blob, { forceOcr: true });
  const updated = await getCctById(id);
  emitCctChanged();
  return {
    ok: true,
    textChars: updated?.textChars ?? 0,
    ocrApplied: updated?.ocrApplied,
    ocrStatus: updated?.ocrStatus,
  };
}

/**
 * Importa PDF(s) — padrão do módulo de referência: salva arquivo → status pending → analyzed.
 */
export async function importCctPdfFiles(files) {
  cctLog("importCctPdfFiles início", {
    qtd: files?.length,
    nomes: files ? [...files].map((f) => f?.name) : [],
  });
  if (typeof window === "undefined") {
    return { ok: false, error: "Importação de CCT só funciona no navegador." };
  }

  const arr = Array.from(files || []).filter(isPdfFile);
  cctLog("importCctPdfFiles após filtro PDF", { aceitos: arr.length });
  if (!arr.length) {
    return { ok: false, error: "Selecione arquivo(s) PDF." };
  }

  const index = await loadCctIndex();
  const added = [];
  const errors = [];
  const toAnalyze = [];

  for (const file of arr) {
    const displayName = file.name || "convenção.pdf";
    if (file.size > MAX_PDF_BYTES) {
      errors.push(
        `${displayName}: muito grande (máx. ${Math.round(MAX_PDF_BYTES / 1024 / 1024)} MB)`,
      );
      continue;
    }

    let blob;
    try {
      blob = file instanceof Blob ? file : new Blob([await file.arrayBuffer()], { type: "application/pdf" });
    } catch (e) {
      errors.push(`${displayName}: não foi possível ler o arquivo`);
      continue;
    }

    const id = newId();
    const saved = await cctPutPdf(id, blob);
    cctLog("cctPutPdf", { id, fileName: displayName, ok: saved.ok, storage: saved.storage });
    if (!saved.ok) {
      errors.push(`${displayName}: ${saved.error || "falha ao salvar"}`);
      continue;
    }

    const validity = parseValidityFromFileName(displayName);
    const entry = {
      id,
      label: labelFromFileName(displayName),
      fileName: displayName,
      sizeBytes: file.size,
      pageCount: null,
      status: "pending",
      validFrom: validity.validFrom,
      validUntil: validity.validUntil,
      analysisResult: null,
      isScanned: true,
      textChars: 0,
      storage: saved.storage,
      importedAt: new Date().toISOString(),
    };

    index.push(entry);
    added.push(entry);
    toAnalyze.push({ entry, blob });
  }

  if (added.length) {
    try {
      await persistCctIndex(index);
      cctLog("persistCctIndex OK", { total: index.length });
    } catch (err) {
      cctLogError("persistCctIndex falhou", err);
      for (const a of added) await cctDeletePdf(a.id);
      return { ok: false, added: [], errors: [err?.message || "Falha ao salvar índice"], total: 0 };
    }
    for (const { entry, blob: pdfBlob } of toAnalyze) {
      runAnalysisJob(entry, pdfBlob);
    }
  }

  const result = {
    ok: added.length > 0,
    added,
    errors,
    total: index.length,
  };
  cctLog("importCctPdfFiles fim", result);
  return result;
}

export async function removeCctDocument(id) {
  await cctDeletePdf(id);
  try {
    const { removePosicaoStoredValue } = await import("./posicaoStorage.js");
    await removePosicaoStoredValue(`posicao_cct_text_${id}`);
    await removePosicaoStoredValue(`posicao_cct_blob_${id}`);
  } catch {
    /* legado */
  }
  const index = (await loadCctIndex()).filter((d) => d.id !== id);
  await persistCctIndex(index);
  return index;
}

export async function updateCctLabel(id, label) {
  const index = await loadCctIndex();
  const next = index.map((d) =>
    d.id === id ? { ...d, label: String(label || d.label).trim().slice(0, 120) } : d,
  );
  await persistCctIndex(next);
  return next;
}

export async function loadCctText(id) {
  try {
    const { loadPosicaoStoredValue } = await import("./posicaoStorage.js");
    return loadPosicaoStoredValue(`posicao_cct_text_${id}`, "");
  } catch {
    return "";
  }
}

export async function createCctBlobUrl(id) {
  const blob = await cctGetPdf(id);
  if (!blob) return null;
  return URL.createObjectURL(blob);
}

export async function clearAllCctDocuments() {
  const index = await loadCctIndex();
  await cctClearAllPdfs(index.map((d) => d.id));
  try {
    const { removePosicaoStoredValue } = await import("./posicaoStorage.js");
    for (const d of index) {
      await removePosicaoStoredValue(`posicao_cct_text_${d.id}`);
      await removePosicaoStoredValue(`posicao_cct_blob_${d.id}`);
    }
  } catch {
    /* ignore */
  }
  await persistCctIndex([]);
}
