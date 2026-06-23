import { ApiService } from "../api/apiService.js";
import {
  readEventCategoriesCache,
  mapApiConfigToUi,
} from "../api/eventoCategoriaHoraAdapters.js";
import { DEFAULT_EVENTS, DEFAULT_HOUR_CATEGORIES } from "../panels/posicao/HorasConfigModal.jsx";
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

function mockCategoriasHorasFromDefaults() {
  const cached = readEventCategoriesCache();
  if (cached.eventos.length) {
    return mapApiConfigToUi({
      colunas: cached.colunas.length ? cached.colunas : DEFAULT_HOUR_CATEGORIES,
      eventos: cached.eventos,
    });
  }
  const eventos = DEFAULT_EVENTS.map((ev, index) => ({
    idRegistro: index + 1,
    id: `evt_${index + 1}`,
    idEvento: index + 1,
    codigo: ev.id,
    name: ev.name,
    category: ev.category,
    creditoBH: Boolean(ev.creditoBH),
    debitoBH: Boolean(ev.debitoBH),
  }));
  return mapApiConfigToUi({
    colunas: DEFAULT_HOUR_CATEGORIES,
    eventos,
  });
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
  ApiService.registerMock("/posicao/categorias-horas", () =>
    Promise.resolve(mockCategoriasHorasFromDefaults()),
  );
  ApiService.registerMock("/posicao/categorias-horas/salvar:POST", async (body) => {
    const current = mockCategoriasHorasFromDefaults();
    const byId = new Map(current.eventos.map((ev) => [ev.idEvento, { ...ev }]));
    for (const item of body?.eventos || []) {
      const idEvento = Number(item?.idEvento);
      if (!Number.isFinite(idEvento) || idEvento <= 0) continue;
      const prev = byId.get(idEvento) || {
        idRegistro: idEvento,
        id: `evt_${idEvento}`,
        idEvento,
        name: item.name,
      };
      byId.set(idEvento, {
        ...prev,
        name: item.name || prev.name,
        category: item.category || prev.category,
        creditoBH: Boolean(item.creditoBH),
        debitoBH: Boolean(item.debitoBH),
      });
    }
    const next = mapApiConfigToUi({
      colunas: current.colunas,
      eventos: [...byId.values()],
    });
    const { persistEventCategoriesCache } = await import("../api/eventoCategoriaHoraAdapters.js");
    persistEventCategoriesCache(next);
    return null;
  });
}

ensureMockPosicao();
