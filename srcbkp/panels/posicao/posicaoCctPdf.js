/** Extração de texto de PDF (CCT) via pdf.js — import dinâmico + fallback legacy. */

import pdfWorkerSrc from "pdfjs-dist/build/pdf.worker.min.mjs?url";
import pdfLegacyWorkerSrc from "pdfjs-dist/legacy/build/pdf.worker.min.mjs?url";

const MAX_PAGES = 400;
const MAX_TEXT_CHARS = 1_000_000;
const EXTRACT_MS = 90_000;

const workerByModule = new WeakMap();

function ensurePdfWorker(pdfjs, workerSrc) {
  const prev = workerByModule.get(pdfjs);
  if (prev === workerSrc) return;
  pdfjs.GlobalWorkerOptions.workerSrc = workerSrc;
  workerByModule.set(pdfjs, workerSrc);
}

function withTimeout(promise, ms, label) {
  return Promise.race([
    promise,
    new Promise((_, reject) => {
      setTimeout(() => reject(new Error(`${label} (${Math.round(ms / 1000)}s)`)), ms);
    }),
  ]);
}

async function extractWithModule(pdfjs, workerSrc, arrayBuffer) {
  ensurePdfWorker(pdfjs, workerSrc);

  const data =
    arrayBuffer instanceof Uint8Array ? arrayBuffer : new Uint8Array(arrayBuffer);

  const loadingTask = pdfjs.getDocument({
    data,
    useSystemFonts: true,
    stopAtErrors: false,
    isEvalSupported: false,
  });
  const pdf = await loadingTask.promise;
  const pageCount = pdf.numPages;
  const limit = Math.min(pageCount, MAX_PAGES);
  const scanProbe = Math.min(3, limit);
  const parts = [];

  for (let p = 1; p <= limit; p++) {
    const page = await pdf.getPage(p);
    const content = await page.getTextContent();
    const line = content.items
      .map((it) => (typeof it.str === "string" ? it.str : ""))
      .join(" ")
      .replace(/\s+/g, " ")
      .trim();
    if (line) parts.push(line);
    if (parts.join("\n").length >= MAX_TEXT_CHARS) break;
    if (p === scanProbe && parts.length === 0) {
      return {
        text: "",
        pageCount,
        pagesRead: p,
        truncated: false,
        scanned: true,
      };
    }
  }

  let text = parts.join("\n");
  if (text.length > MAX_TEXT_CHARS) text = text.slice(0, MAX_TEXT_CHARS);
  const truncated = pageCount > limit || text.length >= MAX_TEXT_CHARS;

  return {
    text,
    pageCount,
    pagesRead: limit,
    truncated,
    scanned: !text.length,
  };
}

export async function extractPdfText(arrayBuffer) {
  const data =
    arrayBuffer instanceof Uint8Array
      ? arrayBuffer
      : arrayBuffer instanceof ArrayBuffer
        ? arrayBuffer
        : new Uint8Array(arrayBuffer);

  const run = async (pdfjs, workerSrc) =>
    withTimeout(extractWithModule(pdfjs, workerSrc, data), EXTRACT_MS, "Leitura do PDF demorou demais");

  try {
    const pdfjs = await import("pdfjs-dist");
    return await run(pdfjs, pdfWorkerSrc);
  } catch (primaryErr) {
    console.warn("[CCT] pdf.js padrão falhou, tentando legacy:", primaryErr?.message || primaryErr);
    try {
      const legacy = await import("pdfjs-dist/legacy/build/pdf.mjs");
      return await run(legacy, pdfLegacyWorkerSrc);
    } catch (legacyErr) {
      const msg = legacyErr?.message || primaryErr?.message || "falha ao ler PDF";
      if (/password|senha|encrypted/i.test(msg)) {
        throw new Error("PDF protegido por senha — remova a senha e importe de novo");
      }
      throw new Error(msg);
    }
  }
}
