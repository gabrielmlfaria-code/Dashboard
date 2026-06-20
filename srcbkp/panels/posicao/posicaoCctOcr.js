/**
 * OCR de PDF digitalizado (CCT) — Tesseract no navegador + render via pdf.js.
 * Primeira execução baixa o pacote de idioma português (~15 MB).
 */

import pdfWorkerSrc from "pdfjs-dist/build/pdf.worker.min.mjs?url";

const MAX_OCR_PAGES_DEFAULT = 22;
const OCR_SCALE = 1.75;
const OCR_TIMEOUT_MS = 600_000;
const MAX_TEXT_CHARS = 800_000;

function emitProgress(detail) {
  if (typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent("pb-cct-ocr-progress", { detail }));
  }
}

async function loadPdf(arrayBuffer) {
  const pdfjs = await import("pdfjs-dist");
  pdfjs.GlobalWorkerOptions.workerSrc = pdfWorkerSrc;
  const data =
    arrayBuffer instanceof Uint8Array ? arrayBuffer : new Uint8Array(arrayBuffer);
  const task = pdfjs.getDocument({ data, useSystemFonts: true, stopAtErrors: false });
  return task.promise;
}

/**
 * @param {ArrayBuffer|Uint8Array} arrayBuffer
 * @param {{ maxPages?: number, scale?: number, docId?: string, onProgress?: (p: object) => void }} [options]
 */
export async function ocrPdfToText(arrayBuffer, options = {}) {
  const maxPages = options.maxPages ?? MAX_OCR_PAGES_DEFAULT;
  const scale = options.scale ?? OCR_SCALE;
  const docId = options.docId || "";

  const run = async () => {
    const { createWorker } = await import("tesseract.js");
    const pdf = await loadPdf(arrayBuffer);
    const pageCount = pdf.numPages;
    const limit = Math.min(pageCount, maxPages);

    emitProgress({ docId, phase: "init", progress: 0, page: 0, total: limit });
    options.onProgress?.({ phase: "init", progress: 0, page: 0, total: limit });

    const worker = await createWorker("por", 1, {
      logger: (m) => {
        if (m.status === "recognizing text" && m.progress != null) {
          const p = { docId, phase: "page", progress: m.progress, status: m.status };
          options.onProgress?.(p);
        }
      },
    });

    const parts = [];

    try {
      for (let p = 1; p <= limit; p++) {
        emitProgress({
          docId,
          phase: "page",
          page: p,
          total: limit,
          progress: (p - 1) / limit,
        });
        options.onProgress?.({ phase: "page", page: p, total: limit, progress: (p - 1) / limit });

        const page = await pdf.getPage(p);
        const viewport = page.getViewport({ scale });
        const canvas = document.createElement("canvas");
        const ctx = canvas.getContext("2d", { willReadFrequently: true });
        canvas.width = Math.floor(viewport.width);
        canvas.height = Math.floor(viewport.height);
        await page.render({ canvasContext: ctx, viewport }).promise;

        const {
          data: { text },
        } = await worker.recognize(canvas);
        const chunk = String(text || "").replace(/\s+/g, " ").trim();
        if (chunk) parts.push(chunk);

        if (parts.join("\n").length >= MAX_TEXT_CHARS) break;
      }
    } finally {
      await worker.terminate();
    }

    let text = parts.join("\n");
    const truncated = text.length >= MAX_TEXT_CHARS || pageCount > limit;
    if (text.length > MAX_TEXT_CHARS) text = text.slice(0, MAX_TEXT_CHARS);

    emitProgress({ docId, phase: "done", progress: 1, page: limit, total: limit, chars: text.length });
    options.onProgress?.({ phase: "done", progress: 1, chars: text.length });

    return {
      text,
      pageCount,
      pagesOcred: limit,
      truncated,
      ocrApplied: Boolean(text.trim()),
    };
  };

  return Promise.race([
    run(),
    new Promise((_, reject) => {
      setTimeout(
        () => reject(new Error("OCR excedeu o tempo limite — tente com menos páginas ou use o PDF com texto")),
        OCR_TIMEOUT_MS,
      );
    }),
  ]);
}

export function isOcrSupported() {
  return typeof window !== "undefined" && typeof document !== "undefined";
}
