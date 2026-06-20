import { cctLog, cctLogError } from "./posicaoCctDebug.js";

let pickerOpenedAt = 0;
/** @type {((files: File[] | null) => void) | null} */
let inputPickResolve = null;

const GHOST_MS = 1200;

/**
 * Abre seletor nativo (File System Access API) ou fallback input[type=file].
 * @returns {Promise<File[]|null>} null = cancelou
 */
export async function pickCctPdfFiles(inputEl) {
  if (typeof window !== "undefined" && typeof window.showOpenFilePicker === "function") {
    try {
      cctLog("showOpenFilePicker");
      const handles = await window.showOpenFilePicker({
        multiple: true,
        types: [
          {
            description: "PDF",
            accept: { "application/pdf": [".pdf"] },
          },
        ],
      });
      const files = await Promise.all(handles.map((h) => h.getFile()));
      cctLog("showOpenFilePicker OK", { qtd: files.length, nomes: files.map((f) => f.name) });
      return files;
    } catch (err) {
      if (err?.name === "AbortError") {
        cctLog("showOpenFilePicker cancelado pelo usuário");
        return null;
      }
      cctLog("showOpenFilePicker falhou, usa input", { msg: err?.message });
    }
  }

  if (!inputEl) {
    cctLog("ERRO pickCctPdfFiles: sem input");
    return null;
  }

  return new Promise((resolve) => {
    inputPickResolve = resolve;
    pickerOpenedAt = Date.now();
    cctLog("input.click() fallback");
    try {
      inputEl.click();
    } catch (err) {
      cctLogError("input.click falhou", err);
      inputPickResolve = null;
      resolve(null);
    }
    setTimeout(() => {
      if (!inputPickResolve) return;
      cctLog("timeout aguardando seleção no input");
      inputPickResolve(null);
      inputPickResolve = null;
    }, 120_000);
  });
}

/**
 * Handler do <input type="file"> — não limpar value antes de copiar arquivos.
 */
export function handleCctNativeInputChange(e) {
  const elapsed = Date.now() - pickerOpenedAt;
  const captured = e.target?.files?.length ? Array.from(e.target.files) : [];

  cctLog("input onChange", {
    qtd: captured.length,
    nomes: captured.map((f) => f.name),
    msDesdeAbertura: elapsed,
  });

  if (!captured.length && elapsed < GHOST_MS) {
    cctLog("onChange vazio ignorado (evento fantasma do navegador)");
    return;
  }

  if (inputPickResolve) {
    const resolve = inputPickResolve;
    inputPickResolve = null;
    resolve(captured.length ? captured : null);
    if (captured.length) e.target.value = "";
    return;
  }

  if (!captured.length) {
    cctLog("onChange sem arquivos (cancelou)");
    window.dispatchEvent(
      new CustomEvent("pb-cct-import-done", { detail: { ok: false, cancelled: true } }),
    );
    return;
  }

  window.dispatchEvent(new CustomEvent("pb-cct-import-start"));
  import("./posicaoCctStorage.js")
    .then(({ importCctPdfFiles }) => importCctPdfFiles(captured))
    .then((res) => {
      cctLog("import via onChange direto", res);
      e.target.value = "";
      window.dispatchEvent(new CustomEvent("pb-cct-import-done", { detail: res }));
    })
    .catch((err) => {
      cctLogError("import via onChange", err);
      window.dispatchEvent(
        new CustomEvent("pb-cct-import-done", { detail: { ok: false, error: err?.message } }),
      );
    });
}
