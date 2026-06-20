// src/mocks/mockPosicao.js
// Em desenvolvimento (USE_MOCK): rotas /posicao/* leem apenas dados importados (planilha).
// Com backend: CONFIG.USE_MOCK = false → HttpClient chama a API real.

import { ApiService } from "../api/apiService.js";
import { normDateKey } from "../panels/posicao/calendarUtils.js";
import {
  resolveDiaPayload,
  syncHistRowAggregates,
  loadImportOverridesMerged,
} from "../panels/posicao/posicaoImport.js";
import { loadHistTableImportMerged } from "../panels/posicao/posicaoDataBackup.js";

const MOCK_LOAD_MS = 12_000;

function withTimeout(promise, ms, label) {
  return Promise.race([
    promise,
    new Promise((_, reject) => {
      setTimeout(() => reject(new Error(`${label} (${ms}ms)`)), ms);
    }),
  ]);
}

/** GET /posicao/dia — payload do dia só da planilha persistida. */
export async function mockDiaFromPlanilha(date) {
  const ref = normDateKey(date) || new Date().toISOString().slice(0, 10);
  try {
    const [histRows, overrides] = await withTimeout(
      Promise.all([loadHistTableImportMerged(), loadImportOverridesMerged()]),
      MOCK_LOAD_MS,
      "mockDiaFromPlanilha",
    );
    return resolveDiaPayload({
      apiData: null,
      histRows,
      importOverrides: overrides,
      date: ref,
    });
  } catch (err) {
    console.warn("[mockDiaFromPlanilha]", err?.message || err);
    return null;
  }
}

/** GET /posicao/historico — série só dos dias importados. */
export async function mockHistoricoFromPlanilha({ days = 180 } = {}) {
  const rows = await loadHistTableImportMerged();
  if (!Array.isArray(rows) || !rows.length) return [];

  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - Math.max(1, Number(days) || 180));
  const cutoffIso = cutoff.toISOString().slice(0, 10);

  return rows
    .map(syncHistRowAggregates)
    .filter((r) => {
      const d = normDateKey(r?.date || r?.data_referencia);
      return d && d >= cutoffIso;
    })
    .sort((a, b) => {
      const da = normDateKey(a.date || a.data_referencia) || "";
      const db = normDateKey(b.date || b.data_referencia) || "";
      return da.localeCompare(db);
    });
}

export async function mockFiliaisFromPlanilha() {
  const rows = await loadHistTableImportMerged();
  const names = new Set();
  for (const row of Array.isArray(rows) ? rows : []) {
    for (const item of [...(row?._employees || []), ...(row?._events || [])]) {
      const nome = String(item?.filial || item?.filialNome || "").trim();
      if (nome) names.add(nome);
    }
  }
  return [...names]
    .sort((a, b) => a.localeCompare(b, "pt-BR"))
    .map((nome, index) => ({ id: index + 1, codigo: index + 1, nome, label: `${index + 1} - ${nome}` }));
}

export function ensureMockPosicao() {
  ApiService.registerMock("/posicao/filiais", () => mockFiliaisFromPlanilha());
  ApiService.registerMock("/posicao/dia", (p) => mockDiaFromPlanilha(p?.date));
  ApiService.registerMock("/posicao/historico", (p) => mockHistoricoFromPlanilha(p));
}

ensureMockPosicao();
