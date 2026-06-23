import { PosicaoApi } from "./posicaoApi.js";
import { isMockSource } from "./apiMode.js";
import { DEFAULT_HOUR_CATEGORIES } from "../panels/posicao/HorasConfigModal.jsx";

const LS_KEY = "pb_event_categories";
const LS_KEY_COLUMNS = "pb_hour_category_columns";
const LS_FILIAL_FILTER = "pos_filial_filter";

export function normalizeIdFilial(idFilial) {
  const n = Number(idFilial);
  return Number.isFinite(n) && n > 0 ? n : 0;
}

export function resolveActiveFilialId() {
  try {
    return normalizeIdFilial(localStorage.getItem(LS_FILIAL_FILTER));
  } catch {
    return 0;
  }
}

function eventCategoriesCacheKeys(idFilial = 0) {
  const suffix = idFilial > 0 ? `_f${idFilial}` : "";
  return {
    events: `${LS_KEY}${suffix}`,
    columns: `${LS_KEY_COLUMNS}${suffix}`,
  };
}

export function normEventNameKey(value) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .replace(/[^a-z0-9]+/g, "");
}

export function apiColunaToUi(col) {
  return {
    value: String(col?.value || "").trim(),
    label: String(col?.label || col?.value || "").trim(),
    color: col?.color || "#64748b",
    builtin: Boolean(col?.builtin),
  };
}

export function apiEventoToUi(item) {
  const creditoBH = Boolean(item?.creditoBH);
  let debitoBH = Boolean(item?.debitoBH);
  if (creditoBH && debitoBH) debitoBH = false;
  const idEvento = item?.idEvento ?? null;
  return {
    idRegistro: item?.idRegistro ?? null,
    id: String(item?.id || (idEvento != null ? `evt_${idEvento}` : `reg_${item?.idRegistro || "0"}`)),
    idEvento,
    codigo: item?.codigo ?? null,
    name: String(item?.name || "").trim(),
    category: String(item?.category || "ignorar").trim() || "ignorar",
    creditoBH,
    debitoBH,
  };
}

export function uiEventoToApi(ev) {
  const creditoBH = Boolean(ev?.creditoBH);
  let debitoBH = Boolean(ev?.debitoBH);
  if (creditoBH && debitoBH) debitoBH = false;
  return {
    idRegistro: ev?.idRegistro ?? null,
    id: ev?.id,
    idEvento: ev?.idEvento ?? null,
    codigo: ev?.codigo ?? null,
    name: String(ev?.name || "").trim(),
    category: String(ev?.category || "ignorar").trim() || "ignorar",
    creditoBH,
    debitoBH,
  };
}

export function validateEventCategoriesPayload(colunas = [], eventos = []) {
  const categoryValues = new Set(
    (Array.isArray(colunas) && colunas.length ? colunas : DEFAULT_HOUR_CATEGORIES)
      .map((c) => String(c?.value || "").trim())
      .filter(Boolean),
  );

  for (const ev of Array.isArray(eventos) ? eventos : []) {
    const name = String(ev?.name || "").trim();
    if (!name) continue;
    const category = String(ev?.category || "").trim();
    if (!categoryValues.has(category)) {
      return { ok: false, error: `Categoria inválida para o evento «${name}».` };
    }
    if (ev?.creditoBH && ev?.debitoBH) {
      return {
        ok: false,
        error: `Crédito e débito de BH não podem estar marcados juntos em «${name}».`,
      };
    }
    if (ev?.idEvento == null || Number(ev.idEvento) <= 0) {
      return {
        ok: false,
        error: `Evento «${name}» sem vínculo com EVENTO_PTO (idEvento).`,
      };
    }
  }

  return { ok: true };
}

export function mapApiConfigToUi(config) {
  const colunas = (Array.isArray(config?.colunas) && config.colunas.length
    ? config.colunas
    : DEFAULT_HOUR_CATEGORIES
  ).map(apiColunaToUi);
  const eventos = (Array.isArray(config?.eventos) ? config.eventos : []).map(apiEventoToUi);
  return { colunas, eventos };
}

export function persistEventCategoriesCache({ colunas = [], eventos = [], idFilial } = {}) {
  const filialId = normalizeIdFilial(idFilial ?? resolveActiveFilialId());
  const keys = eventCategoriesCacheKeys(filialId);
  try {
    localStorage.setItem(
      keys.columns,
      JSON.stringify(
        colunas.map(({ value, label, color }) => ({
          value,
          label,
          color,
        })),
      ),
    );
    localStorage.setItem(
      keys.events,
      JSON.stringify(
        eventos.map((ev) => ({
          idRegistro: ev.idRegistro ?? undefined,
          id: ev.id,
          idEvento: ev.idEvento ?? undefined,
          codigo: ev.codigo ?? undefined,
          name: ev.name,
          category: ev.category,
          creditoBH: Boolean(ev.creditoBH),
          debitoBH: Boolean(ev.debitoBH),
        })),
      ),
    );
  } catch {
    // ignore persistence failures
  }
}

export function readEventCategoriesCache(idFilial) {
  const filialId = normalizeIdFilial(idFilial ?? resolveActiveFilialId());
  const keys = eventCategoriesCacheKeys(filialId);
  try {
    const colunas = JSON.parse(localStorage.getItem(keys.columns) || "null");
    const eventos = JSON.parse(localStorage.getItem(keys.events) || "null");
    return {
      colunas: Array.isArray(colunas) ? colunas : [],
      eventos: Array.isArray(eventos) ? eventos : [],
    };
  } catch {
    return { colunas: [], eventos: [] };
  }
}

export async function fetchEventCategoriesFromApi({ idFilial } = {}) {
  const filialId = normalizeIdFilial(idFilial);
  const query = filialId > 0 ? { idFilial: filialId } : {};

  if (isMockSource("posicao")) {
    const cached = readEventCategoriesCache(filialId);
    if (cached.eventos.length) {
      return mapApiConfigToUi({
        colunas: cached.colunas.length ? cached.colunas : DEFAULT_HOUR_CATEGORIES,
        eventos: cached.eventos,
      });
    }
    const config = await PosicaoApi.getCategoriasHorasConfig(query);
    const mapped = mapApiConfigToUi(config);
    persistEventCategoriesCache({ ...mapped, idFilial: filialId });
    return mapped;
  }

  const config = await PosicaoApi.getCategoriasHorasConfig(query);
  const mapped = mapApiConfigToUi(config);
  persistEventCategoriesCache({ ...mapped, idFilial: filialId });
  return mapped;
}

/** @deprecated use fetchEventCategoriesFromApi */
export async function fetchAndCacheEventCategories() {
  return fetchEventCategoriesFromApi();
}

export async function saveEventCategoriesToApi({ colunas = [], eventos = [], idFilial } = {}) {
  const validation = validateEventCategoriesPayload(colunas, eventos);
  if (!validation.ok) throw new Error(validation.error);

  const filialId = normalizeIdFilial(idFilial);
  const payload = {
    ...(filialId > 0 ? { idFilial: filialId } : {}),
    eventos: eventos.map(uiEventoToApi),
  };

  if (!isMockSource("posicao")) {
    await PosicaoApi.salvarCategoriasHoras(payload);
  } else {
    await PosicaoApi.salvarCategoriasHoras(payload);
  }

  const refreshed = await fetchEventCategoriesFromApi({ idFilial: filialId });
  persistEventCategoriesCache({
    colunas: colunas.length ? colunas : refreshed.colunas,
    eventos: refreshed.eventos,
    idFilial: filialId,
  });
  return refreshed;
}
