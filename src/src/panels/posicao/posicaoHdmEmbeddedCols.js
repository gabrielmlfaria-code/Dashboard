export const HDM_POS_EMBEDDED_STATE_KEY = "pb_pos_list_grid_state_v1";

function readStoredJson(key, fallback) {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch {
    return fallback;
  }
}

function writeStoredJson(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {}
}

/** Colunas opcionais no seletor — preset presentes (padrão). */
export const POS_EMBEDDED_DEFAULT_COL_IDS = [
  "genero",
  "filial",
  "depto",
  "mat",
  "cargo",
  "data",
  "marcacao",
  "horario",
];

export const POS_EMBEDDED_DEFAULT_COL_ORDER = [
  "mat",
  "nome",
  "genero",
  "filial",
  "depto",
  "cargo",
  "data",
  "marcacao",
  "horario",
];

export const POS_EMBEDDED_PERIOD_COL_IDS = [
  "genero",
  "filial",
  "depto",
  "mat",
  "cargo",
  "inicio",
  "termino",
  "qtd_dias",
  "marcacao",
  "horario",
];

export const POS_EMBEDDED_PERIOD_COL_ORDER = [
  "mat",
  "nome",
  "genero",
  "filial",
  "depto",
  "cargo",
  "inicio",
  "termino",
  "qtd_dias",
  "horario",
  "marcacao",
];

export const POS_EMBEDDED_AFAST_COL_IDS = [
  "genero",
  "filial",
  "depto",
  "mat",
  "cargo",
  "inicio",
  "termino",
  "qtd_dias",
  "justificativa",
  "marcacao",
  "horario",
];

export const POS_EMBEDDED_AFAST_COL_ORDER = [
  "mat",
  "nome",
  "genero",
  "filial",
  "depto",
  "cargo",
  "inicio",
  "termino",
  "qtd_dias",
  "justificativa",
  "horario",
  "marcacao",
];

export const POS_EMBEDDED_MENSAL_EVENT_COL_IDS = [
  "mat",
  "data",
  "cod",
  "evento",
  "genero",
  "filial",
  "depto",
  "cargo",
  "marcacao",
  "horario",
  "horas",
];

export const POS_EMBEDDED_MENSAL_EVENT_COL_ORDER = [
  "mat",
  "nome",
  "data",
  "cod",
  "evento",
  "genero",
  "filial",
  "depto",
  "cargo",
  "horas",
  "marcacao",
  "horario",
];

export const POS_EMBEDDED_BANCO_HORAS_COL_IDS = [
  "filial",
  "depto",
  "mat",
  "cargo",
  "inicio",
  "termino",
  "saldoAnteriorBH",
  "creditoBH",
  "debitoBH",
  "horasPagasBH",
  "saldoProximoBH",
];

export const POS_EMBEDDED_BANCO_HORAS_COL_ORDER = [
  "filial",
  "depto",
  "mat",
  "nome",
  "cargo",
  "inicio",
  "termino",
  "saldoAnteriorBH",
  "creditoBH",
  "debitoBH",
  "horasPagasBH",
  "saldoProximoBH",
];

/** Rótulos do modal Banco de Horas (card → KPI / departamento). */
export const POS_EMBEDDED_BANCO_HORAS_COL_LABELS = {
  filial: "Filial",
  depto: "Departamento",
  mat: "Matrícula",
  nome: "Nome",
  cargo: "Cargo",
  inicio: "Período Inicial",
  termino: "Período Final",
  saldoAnteriorBH: "Saldo Anterior",
  creditoBH: "Crédito",
  debitoBH: "Débito",
  horasPagasBH: "Horas Pagas",
  saldoProximoBH: "Saldo Próximo",
};

export const POS_EMBEDDED_ABONOS_COL_IDS = [
  "filial",
  "depto",
  "mat",
  "cargo",
  "cod",
  "evento",
  "data",
  "horas",
];

export const POS_EMBEDDED_ABONOS_COL_ORDER = [
  "filial",
  "depto",
  "mat",
  "nome",
  "cargo",
  "cod",
  "evento",
  "data",
  "horas",
];

export const POS_EMBEDDED_ABONOS_COL_LABELS = {
  filial: "Filial",
  depto: "Departamento",
  mat: "Matrícula",
  nome: "Nome",
  cargo: "Cargo",
  cod: "Cód. Evento",
  evento: "Evento de Origem",
  data: "Data",
  horas: "Horas",
};

const BANCO_HORAS_LAYOUT_VERSION = 2;
const ABONOS_LAYOUT_VERSION = 1;

export function getPosEmbeddedColLabel(posListKey, colId, defaultLabel = "") {
  const pk = posEmbeddedPresetKey(posListKey);
  if (pk === "banco_horas" && POS_EMBEDDED_BANCO_HORAS_COL_LABELS[colId]) {
    return POS_EMBEDDED_BANCO_HORAS_COL_LABELS[colId];
  }
  if (
    (pk === "abonos_pendentes" || pk === "abonos_efetuados") &&
    POS_EMBEDDED_ABONOS_COL_LABELS[colId]
  ) {
    return POS_EMBEDDED_ABONOS_COL_LABELS[colId];
  }
  return defaultLabel || colId;
}

const PRESETS = {
  presentes: {
    colIds: POS_EMBEDDED_DEFAULT_COL_IDS,
    colOrder: POS_EMBEDDED_DEFAULT_COL_ORDER,
    defaultStackHrsMrc: false,
  },
  ferias: {
    colIds: POS_EMBEDDED_PERIOD_COL_IDS,
    colOrder: POS_EMBEDDED_PERIOD_COL_ORDER,
    defaultStackHrsMrc: true,
  },
  afastados: {
    colIds: POS_EMBEDDED_AFAST_COL_IDS,
    colOrder: POS_EMBEDDED_AFAST_COL_ORDER,
    defaultStackHrsMrc: true,
  },
  mensal_event: {
    colIds: POS_EMBEDDED_MENSAL_EVENT_COL_IDS,
    colOrder: POS_EMBEDDED_MENSAL_EVENT_COL_ORDER,
    defaultStackHrsMrc: false,
  },
  banco_horas: {
    colIds: POS_EMBEDDED_BANCO_HORAS_COL_IDS,
    colOrder: POS_EMBEDDED_BANCO_HORAS_COL_ORDER,
    defaultStackHrsMrc: false,
  },
  abonos_pendentes: {
    colIds: POS_EMBEDDED_ABONOS_COL_IDS,
    colOrder: POS_EMBEDDED_ABONOS_COL_ORDER,
    defaultStackHrsMrc: false,
  },
  abonos_efetuados: {
    colIds: POS_EMBEDDED_ABONOS_COL_IDS,
    colOrder: POS_EMBEDDED_ABONOS_COL_ORDER,
    defaultStackHrsMrc: false,
  },
};

/** Chave de preset / persistência por categoria do modal. */
export function posEmbeddedPresetKey(posListKey) {
  const k = String(posListKey || "presentes");
  if (k === "ferias") return "ferias";
  if (k === "afastados") return "afastados";
  if (k === "mensal_event") return "mensal_event";
  if (k === "banco_horas") return "banco_horas";
  if (k === "abonos_pendentes") return "abonos_pendentes";
  if (k === "abonos_efetuados") return "abonos_efetuados";
  return "presentes";
}

export function getPosEmbeddedPreset(posListKey) {
  return PRESETS[posEmbeddedPresetKey(posListKey)] || PRESETS.presentes;
}

function defaultBucket(preset, pk = "") {
  const bucket = {
    sortCol: "nome",
    sortDir: "asc",
    search: "",
    colOrder: [...preset.colOrder],
    visibleCols: [...preset.colIds],
    colCatalog: [...preset.colIds],
    colWidths: {},
    stackHrsMrc: preset.defaultStackHrsMrc,
    groupBy: [],
  };
  if (pk === "banco_horas") bucket.layoutVersion = BANCO_HORAS_LAYOUT_VERSION;
  if (pk === "abonos_pendentes" || pk === "abonos_efetuados") bucket.layoutVersion = ABONOS_LAYOUT_VERSION;
  return bucket;
}

/** Mantém a primeira ocorrência de cada id (ordem salva corrompida no localStorage). */
export function dedupeColOrder(order) {
  if (!Array.isArray(order)) return [];
  const seen = new Set();
  const out = [];
  for (const id of order) {
    if (!id || seen.has(id)) continue;
    seen.add(id);
    out.push(id);
  }
  return out;
}

/**
 * Restaura visibilidade salva. Só reexibe colunas novas (ausentes no catálogo salvo),
 * sem desfazer colunas que o usuário ocultou.
 */
export function resolveVisibleColSet(savedVisible, savedCatalog, defaultIds) {
  const defaults = [...defaultIds];
  if (!Array.isArray(savedVisible)) return new Set(defaults);
  const visible = new Set(savedVisible.filter((id) => defaults.includes(id)));
  const catalog = Array.isArray(savedCatalog) ? savedCatalog : savedVisible;
  const catalogSet = new Set(catalog);
  for (const id of defaults) {
    if (!catalogSet.has(id)) visible.add(id);
  }
  return visible;
}

let _store = null;

function ensureStore() {
  if (_store) return _store;
  const raw = readStoredJson(HDM_POS_EMBEDDED_STATE_KEY, {});
  _store = raw && typeof raw === "object" && !Array.isArray(raw) ? raw : {};
  if (_store.periodo && !_store.ferias) _store.ferias = _store.periodo;
  return _store;
}

export function getPosEmbeddedBucket(posListKey) {
  const pk = posEmbeddedPresetKey(posListKey);
  const preset = getPosEmbeddedPreset(posListKey);
  const store = ensureStore();
  if (!store[pk] || typeof store[pk] !== "object") {
    store[pk] = defaultBucket(preset, pk);
  } else if (pk === "banco_horas" && (store[pk].layoutVersion || 0) < BANCO_HORAS_LAYOUT_VERSION) {
    store[pk] = defaultBucket(preset, pk);
    writeStoredJson(HDM_POS_EMBEDDED_STATE_KEY, store);
  } else if (
    (pk === "abonos_pendentes" || pk === "abonos_efetuados") &&
    (store[pk].layoutVersion || 0) < ABONOS_LAYOUT_VERSION
  ) {
    store[pk] = defaultBucket(preset, pk);
    writeStoredJson(HDM_POS_EMBEDDED_STATE_KEY, store);
  }
  return store[pk];
}

export function persistPosEmbeddedBucket(posListKey, patch) {
  const pk = posEmbeddedPresetKey(posListKey);
  const store = ensureStore();
  store[pk] = { ...getPosEmbeddedBucket(posListKey), ...patch };
  writeStoredJson(HDM_POS_EMBEDDED_STATE_KEY, store);
}

/** Recarrega bucket do localStorage (evita cache stale após remount). */
export function refreshPosEmbeddedBucket(posListKey) {
  _store = null;
  return getPosEmbeddedBucket(posListKey);
}

/** Limpa busca persistida ao reabrir modal (ex.: KPIs do banco de horas). */
export function resetPosEmbeddedBucketSearch(posListKey) {
  const pk = posEmbeddedPresetKey(posListKey);
  const store = ensureStore();
  if (store[pk] && typeof store[pk] === "object") {
    store[pk] = { ...store[pk], search: "" };
    writeStoredJson(HDM_POS_EMBEDDED_STATE_KEY, store);
  }
  _store = null;
}

export function resolvePosEmbeddedVisibleCols(saved, posListKey) {
  const preset = getPosEmbeddedPreset(posListKey);
  return resolveVisibleColSet(saved?.visibleCols, saved?.colCatalog, preset.colIds);
}

export function resolvePosEmbeddedColOrder(saved, posListKey) {
  const defaults = getPosEmbeddedPreset(posListKey).colOrder;
  const list = saved?.colOrder;
  if (!Array.isArray(list)) return defaults;
  const allIds = new Set(defaults);
  const valid = dedupeColOrder(list.filter((id) => allIds.has(id) || id === "nome"));
  const validSet = new Set(valid);
  const added = defaults.filter((id) => !validSet.has(id));
  let merged = dedupeColOrder([...valid, ...added]);
  const nomeIdx = merged.indexOf("nome");
  const matIdx = merged.indexOf("mat");
  if (nomeIdx >= 0 && matIdx >= 0 && nomeIdx < matIdx) {
    merged = merged.filter((id) => id !== "nome");
    const nextMatIdx = merged.indexOf("mat");
    merged.splice(nextMatIdx + 1, 0, "nome");
  }
  return merged;
}

export function posListUsesPeriodoCols(posListKey) {
  const k = String(posListKey || "");
  return k === "ferias" || k === "afastados";
}

/** Colunas visíveis no modal aberto pela aba Radar trabalhista. */
export const RISCO_EVT_VISIBLE_COL_IDS = [
  "genero",
  "filial",
  "mat",
  "depto",
  "cargo",
  "_cat",
  "data",
  "horario",
  "hrsPlan",
  "marcacao",
  "cod",
  "evento",
  "horas",
];

/** Ordem das colunas no modal Radar trabalhista (filial primeiro; nome após matrícula). */
export const RISCO_EVT_COL_ORDER = [
  "filial",
  "mat",
  "nome",
  "genero",
  "depto",
  "cargo",
  "_cat",
  "data",
  "horario",
  "hrsPlan",
  "marcacao",
  "cod",
  "evento",
  "horas",
];
