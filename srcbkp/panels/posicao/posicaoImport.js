import { normDateKey } from "./calendarUtils.js";
import { loadPosicaoStoredValue, savePosicaoStoredValue } from "./posicaoStorage.js";
import {
  getPositionGroupItems,
  normalizePositionEmployeesFromDay,
} from "./domain/positionRows.js";

export const POSICAO_IMPORT_OVERRIDES_KEY = "posicao_import_overrides_v1";

export const POSICAO_CATEGORIES = [
  "presentes",
  "falta",
  "atraso",
  "folga",
  "ferias",
  "afastados",
  "ja_saiu",
  "entrada_prev",
  "nao_controla",
];

/** Extrai array de colaboradores de um grupo (vários formatos de API/planilha). */
export function getColaboradoresFromGroup(group) {
  return getPositionGroupItems(group);
}

const DIA_CATEGORY_ALIASES = {
  presentes: ["presentes", "Presentes", "presencas", "presenças"],
  falta: ["falta", "faltas", "Falta", "Faltas"],
  atraso: ["atraso", "atrasos", "Atraso", "Atrasos"],
  folga: ["folga", "folgas", "Folga", "Folgas"],
  ferias: ["ferias", "férias", "Ferias", "Férias"],
  afastados: ["afastados", "Afastados"],
  ja_saiu: ["ja_saiu", "jaSaiu", "JaSaiu"],
  entrada_prev: ["entrada_prev", "entradaPrev", "EntradaPrev"],
  nao_controla: ["nao_controla", "naoControla", "NaoControla"],
};

/** Normaliza payload do dia da API para o formato interno ({ total, colaboradores }). */
export function normalizePosicaoDiaPayload(raw) {
  if (!raw || typeof raw !== "object") return raw;
  const next = { ...raw };

  POSICAO_CATEGORIES.forEach((canonical) => {
    const aliases = DIA_CATEGORY_ALIASES[canonical] || [canonical];
    let colaboradores = [];
    let total = null;

    aliases.forEach((key) => {
      if (!(key in raw)) return;
      const v = raw[key];
      const arr = getColaboradoresFromGroup(v);
      if (arr.length) colaboradores = colaboradores.concat(arr);
      if (typeof v === "number" && !Number.isNaN(v)) total = v;
      else if (v && typeof v === "object" && typeof v.total === "number") {
        total = v.total;
        if (!arr.length) colaboradores = getColaboradoresFromGroup(v);
      }
    });

    if (colaboradores.length || total != null) {
      next[canonical] = {
        total: colaboradores.length > 0 ? colaboradores.length : Number(total) || 0,
        colaboradores,
      };
    }
  });

  return next;
}

/** Lista plana de colaboradores a partir do payload do dia (todas as categorias). */
export function employeesFromDayPayload(day) {
  return normalizePositionEmployeesFromDay(day);
}

/** Lista de ausências (falta + atraso) — uma linha por colaborador. */
export function buildAbsenceListRows(day, order = "desc") {
  if (!day || typeof day !== "object") return [];
  const rows = [];
  const seen = new Set();

  [["falta", "Falta"], ["atraso", "Atraso"]].forEach(([cat, label]) => {
    getColaboradoresFromGroup(day[cat]).forEach((c, idx) => {
      const nome = String(c?.nome || c?.colaborador || c?.name || "").trim();
      const depto =
        String(c?.depto_desc || c?.depto || c?.departamento || "").trim() || "—";
      const id = `${cat}-${String(c?.matricula ?? c?.mat ?? c?.codigo ?? (nome || idx))}`;
      if (!nome || seen.has(id)) return;
      seen.add(id);
      rows.push({
        id,
        name: nome,
        depto,
        cat,
        label,
      });
    });
  });

  rows.sort((a, b) => {
    const cmp = a.name.localeCompare(b.name, "pt-BR", { sensitivity: "base" });
    return order === "asc" ? cmp : -cmp;
  });
  return rows;
}

/** Top departamentos por contagem (planilha/API do dia). mode: `presentes` | `ausentes`. */
export function buildDeptTopList(day, mode = "ausentes", limit = 10) {
  if (!day || typeof day !== "object") return [];
  const deptOf = (c) =>
    String(c?.depto_desc || c?.depto || c?.departamento || "").trim() || "—";
  const counts = new Map();

  if (mode === "presentes") {
    getColaboradoresFromGroup(day.presentes).forEach((c) => {
      const d = deptOf(c);
      counts.set(d, (counts.get(d) || 0) + 1);
    });
  } else {
    const byDept = new Map();
    ["falta", "atraso"].forEach((cat) => {
      getColaboradoresFromGroup(day[cat]).forEach((c, idx) => {
        const d = deptOf(c);
        const id = String(c?.matricula ?? c?.mat ?? c?.codigo ?? `${cat}-${idx}`);
        if (!byDept.has(d)) byDept.set(d, new Set());
        byDept.get(d).add(id);
      });
    });
    byDept.forEach((set, d) => counts.set(d, set.size));
  }

  let rows = Array.from(counts.entries())
    .map(([name, v]) => ({ name, v }))
    .filter((r) => r.v > 0);
  rows.sort((a, b) => b.v - a.v);
  rows = rows.slice(0, Math.max(1, limit));
  const max = rows[0]?.v || 1;
  return rows.map((r) => ({
    id: `dept-${mode}-${r.name}`,
    name: r.name,
    v: r.v,
    pct: Math.round((r.v / max) * 100),
    legacyDept: true,
  }));
}

/** Fallback: departamentos com contagem quando não há nomes na API. */
export function buildAbsenceListRowsFromStats(deptStats, order = "desc") {
  if (!Array.isArray(deptStats)) return [];
  const rows = deptStats
    .map((r) => {
      const abs = (Number(r?.falta) || 0) + (Number(r?.atraso) || 0);
      const depto = String(r?.depto || "—").trim();
      if (!depto || depto === "—" || abs <= 0) return null;
      return {
        id: `dept-${depto}`,
        name: depto,
        depto: `${abs} ausência${abs !== 1 ? "s" : ""}`,
        cat: "falta",
        label: "",
        legacyDept: true,
        v: abs,
      };
    })
    .filter(Boolean);

  const total = rows.reduce((s, r) => s + (r.v || 0), 0);
  const withPct = rows.map((r) => ({
    ...r,
    pct: total > 0 ? Math.round((r.v / total) * 100) : 0,
  }));
  withPct.sort((a, b) => (order === "asc" ? a.v - b.v : b.v - a.v));
  return withPct;
}

/** Linha da tabela histórica (planilha) para uma data ISO. */
function histRowDate(row) {
  return normDateKey(row?.date || row?.data_referencia || row?.data) || "";
}

/** Mescla importação do dia no armazenamento persistente (por data). */
export function mergeImportFromByCat(store, byCat, dataRef) {
  return mergeImportByCat(store, byCat, dataRef);
}

export function mergeImportFromHistRow(store, row, preferredDate = "") {
  const dia = buildDiaPayloadFromHistRow(row);
  if (!dia) return store;
  const ref = normDateKey(preferredDate || dia.data_referencia || dia.date) || histRowDate(row);
  const byCat = {};
  POSICAO_CATEGORIES.forEach((cat) => {
    const colaboradores = getColaboradoresFromGroup(dia[cat]);
    if (colaboradores.length) byCat[cat] = colaboradores;
  });
  return Object.keys(byCat).length ? mergeImportByCat(store, byCat, ref) : store;
}

export function getHistRowForDate(histRows, date) {
  const ref = normDateKey(date) || String(date || "").trim();
  if (!ref || !Array.isArray(histRows)) return null;
  return histRows.find((r) => histRowDate(r) === ref) || null;
}

/** Indica se a linha da planilha tem nomes (sem montar o payload completo do dia). */
export function histRowHasEmployeeData(row) {
  if (!row || typeof row !== "object") return false;
  if (Array.isArray(row._employees) && row._employees.length > 0) return true;
  return POSICAO_CATEGORIES.some((cat) => getColaboradoresFromGroup(row[cat]).length > 0);
}

/** Data com colaboradores na planilha: preferida, senão a mais recente com nomes. */
export function pickDefaultHistDate(histRows, preferred = "") {
  const pref = String(preferred || "").trim();
  if (!Array.isArray(histRows) || !histRows.length) return pref;
  if (pref && getHistRowForDate(histRows, pref)) return pref;

  let latestAny = "";
  let latestWithNames = "";
  for (const row of histRows) {
    const date = histRowDate(row);
    if (!date) continue;
    if (date > latestAny) latestAny = date;
    if (histRowHasEmployeeData(row) && date > latestWithNames) latestWithNames = date;
  }
  return latestWithNames || latestAny || pref;
}

function empRowToColaborador(e, idx = 0) {
  const mat = String(e?.mat ?? e?.matricula ?? `emp-${idx}`).trim();
  const nome = String(e?.nome || e?.colaborador || "").trim();
  return {
    matricula: mat,
    mat,
    nome,
    depto: e?.depto || e?.depto_desc || e?.departamento || "",
    depto_desc: e?.depto_desc || e?.depto || "",
    filial: e?.filial || "",
    cargo: e?.cargo || e?.cargo_desc || "",
    genero: normalizeGenero(e?.genero ?? e?.sexo),
    gestor: e?.gestor || "",
    horario_dia: e?.horario_dia || "",
    marcacoes: Array.isArray(e?.marcacoes) ? e.marcacoes : [],
    inicio: e?.inicio ?? e?.dt_inicio ?? e?.data_inicio ?? "",
    termino: e?.termino ?? e?.dt_termino ?? e?.data_termino ?? "",
    qtd_dias: e?.qtd_dias ?? "",
    justificativa: e?.justificativa ?? e?.motivo ?? e?.observacao ?? "",
  };
}

function eventRowToColaborador(ev) {
  const mat = String(ev?.mat ?? ev?.matricula ?? "").trim();
  const nome = String(ev?.nome || mat || "").trim();
  return {
    matricula: mat,
    mat,
    nome,
    depto: ev?.depto || ev?.depto_desc || "",
    depto_desc: ev?.depto_desc || ev?.depto || "",
    filial: ev?.filial || "",
    cargo: ev?.cargo || "",
    genero: normalizeGenero(ev?.genero ?? ev?.sexo),
    gestor: ev?.gestor || "",
    horario_dia: ev?.horario || "",
    marcacoes: _parseMarcacoesString(ev?.marcacao),
    inicio: ev?.inicio ?? ev?.dt_inicio ?? ev?.data_inicio ?? "",
    termino: ev?.termino ?? ev?.dt_termino ?? ev?.data_termino ?? "",
    qtd_dias: ev?.qtd_dias ?? "",
    justificativa: ev?.justificativa ?? ev?.motivo ?? ev?.observacao ?? "",
  };
}

/** Evento de ponto classificado como atraso (categoria posição do dia). */
export function isAtrasoHistEvent(ev) {
  if (!ev || typeof ev !== "object") return false;
  const text = `${ev?.cod || ""} ${ev?.evento || ""}`;
  if (_inferCatFromEvent(ev?.cod, ev?.evento, Number(ev?.horas || 0) * 60) === "atraso") return true;
  if (/\batraso\b/i.test(text)) return true;
  return false;
}

/** Monta lista de colaboradores de uma categoria a partir da linha histórica (planilha/eventos). */
export function colaboradoresFromHistForCat(row, cat) {
  if (!row || typeof row !== "object") return [];
  const direct = getColaboradoresFromGroup(row[cat]);
  if (direct.length) return direct;

  const emps = Array.isArray(row._employees) ? row._employees : [];
  const fromEmps = [];
  const seenEmp = new Set();
  emps.forEach((e, idx) => {
    let match = String(e?.cat || "") === cat;
    if (cat === "atraso" && (Number(e?.hrsAtraso) > 0 || match)) match = true;
    if (cat === "falta" && Number(e?.hrsAuse) > 0 && Number(e?.hrsAtraso) <= 0) match = true;
    if (!match) return;
    const c = empRowToColaborador(e, idx);
    const key = `${c.matricula}|${c.nome}`;
    if (!key || seenEmp.has(key)) return;
    seenEmp.add(key);
    fromEmps.push(c);
  });
  if (fromEmps.length) return fromEmps;

  const events = Array.isArray(row._events) ? row._events : [];
  if (!events.length) return [];

  const fromEv = [];
  const seenEv = new Set();
  events.forEach((ev) => {
    let match = _inferCatFromEvent(ev?.cod, ev?.evento, Number(ev?.horas || 0) * 60) === cat;
    if (cat === "atraso" && isAtrasoHistEvent(ev)) match = true;
    if (cat === "falta" && ev?._cat === "ausentes" && !isAtrasoHistEvent(ev)) match = true;
    if (!match) return;
    const c = eventRowToColaborador(ev);
    const key = `${c.matricula}|${c.nome}`;
    if (!key || seenEv.has(key)) return;
    seenEv.add(key);
    fromEv.push(c);
  });
  return fromEv;
}

function finalizeDiaColaboradores(dia, row) {
  POSICAO_CATEGORIES.forEach((cat) => {
    const hydrated = colaboradoresFromHistForCat(row, cat);
    if (hydrated.length) {
      dia[cat] = { total: hydrated.length, colaboradores: hydrated };
      return;
    }
    const existing = getColaboradoresFromGroup(dia[cat]);
    if (existing.length) {
      dia[cat] = { total: existing.length, colaboradores: existing };
      return;
    }
    // Total numérico sem nomes: atraso não aparece no grid — não manter contagem enganosa
    if (cat === "atraso" && dia[cat]) {
      delete dia[cat];
    }
  });
}

/** Mescla payloads do dia; `primary` (planilha) prevalece quando tem colaboradores. */
export function mergeDiaPayloads(primary, secondary) {
  const out = { ...(secondary && typeof secondary === "object" ? secondary : {}) };
  POSICAO_CATEGORIES.forEach((cat) => {
    const fromPrimary = getColaboradoresFromGroup(primary?.[cat]);
    const fromSecondary = getColaboradoresFromGroup(secondary?.[cat]);
    const colaboradores = fromPrimary.length > 0 ? fromPrimary : fromSecondary;
    const total =
      colaboradores.length > 0
        ? colaboradores.length
        : cat === "atraso"
          ? 0
          : Number(primary?.[cat]?.total ?? secondary?.[cat]?.total ?? 0) || 0;
    if (colaboradores.length > 0 || total > 0) {
      out[cat] = { total, colaboradores };
    } else if (out[cat] && typeof out[cat] === "number") {
      delete out[cat];
    }
  });
  if (primary && typeof primary === "object") {
    if (primary.data_referencia) out.data_referencia = primary.data_referencia;
    if (primary.date) out.date = primary.date;
  }
  const ref =
    String(primary?.data_referencia || primary?.date || "").trim() ||
    String(secondary?.data_referencia || secondary?.date || "").trim();
  if (ref) {
    out.data_referencia = ref;
    out.date = ref;
  }
  return out;
}

/** Converte uma linha da planilha importada (histórico) em payload do dia. */
export function buildDiaPayloadFromHistRow(row) {
  if (!row || typeof row !== "object") return null;
  const date = String(row.date || row.data_referencia || row.data || "").trim();
  const dia = { data_referencia: date, date };

  let hasColabs = false;
  POSICAO_CATEGORIES.forEach((cat) => {
    const colaboradores = getColaboradoresFromGroup(row[cat]);
    if (colaboradores.length > 0) {
      hasColabs = true;
      dia[cat] = { total: colaboradores.length, colaboradores };
      return;
    }
    const n = histCatCount(row, cat);
    if (n > 0) {
      hasColabs = true;
      dia[cat] = { total: n, colaboradores: [] };
    }
  });

  if (Array.isArray(row._employees) && row._employees.length > 0) {
    row._employees.forEach((e, idx) => {
      let cat = e?.cat ? String(e.cat) : "";
      if (!cat) {
        if (Number(e?.hrsAuse) > 0) cat = "falta";
        else if (Number(e?.hrsAtraso) > 0) cat = "atraso";
        else if (Number(e?.hrsPres) > 0) cat = "presentes";
        else if (Number(e?.hrsJust) > 0) cat = "folga";
        else cat = "presentes";
      }
      if (!POSICAO_CATEGORIES.includes(cat)) return;
      const mat = String(e.mat ?? e.matricula ?? `${cat}-${idx}`).trim();
      const nome = String(e.nome || e.colaborador || "").trim();
      const bucket = dia[cat] || { total: 0, colaboradores: [] };
      const dup = bucket.colaboradores.some(
        (c) =>
          String(c.matricula ?? c.mat ?? "").trim() === mat &&
          String(c.nome || "").trim() === nome,
      );
      if (dup) return;
      const c = {
        matricula: mat,
        mat,
        nome,
        depto: e.depto || e.depto_desc || e.departamento || "",
        depto_desc: e.depto_desc || e.depto || "",
        filial: e.filial || "",
        cargo: e.cargo || e.cargo_desc || "",
        genero: normalizeGenero(e.genero ?? e.sexo),
        gestor: e.gestor || "",
        inicio: e.inicio ?? e.dt_inicio ?? e.data_inicio ?? "",
        termino: e.termino ?? e.dt_termino ?? e.data_termino ?? "",
        qtd_dias: e.qtd_dias ?? "",
        justificativa: e.justificativa ?? e.motivo ?? e.observacao ?? "",
      };
      bucket.colaboradores.push(c);
      bucket.total = bucket.colaboradores.length;
      dia[cat] = bucket;
      hasColabs = true;
    });
  }

  if (!hasColabs) return null;
  finalizeDiaColaboradores(dia, row);
  return normalizePosicaoDiaPayload(dia);
}

/** Há dados importados (planilha) para esta data — não misturar com mock da API. */
export function planilhaHasDataForDate(importOverrides, histRow) {
  if (histRow && histRowHasEmployeeData(histRow)) return true;
  const ov = importOverrides && typeof importOverrides === "object" ? importOverrides : null;
  if (!ov) return false;
  return POSICAO_CATEGORIES.some((cat) => getColaboradoresFromGroup(ov[cat]).length > 0);
}

/**
 * Dia efetivo: planilha (hist + overrides) OU API mock/live.
 * Com planilha no dia, categorias não importadas ficam vazias (sem mock).
 */
export function resolveDiaPayload({ apiData = null, histRows = null, importOverrides = null, date = "" }) {
  let ref =
    normDateKey(date || apiData?.data_referencia || apiData?.date || importOverrides?.data_referencia) ||
    "";
  if (!ref && Array.isArray(histRows) && histRows.length) {
    ref = pickDefaultHistDate(histRows, "");
  }

  const ov = getOverridesForDate(importOverrides, ref);
  const histRow = getHistRowForDate(histRows, ref);
  const fromPlanilha = planilhaHasDataForDate(ov, histRow);

  let merged = null;
  if (fromPlanilha) {
    if (ov) {
      merged = normalizePosicaoDiaPayload(
        applyImportOverrides({ data_referencia: ref }, ov),
      );
    }
    if (histRow) {
      const fromHist = buildDiaPayloadFromHistRow(histRow);
      if (fromHist) merged = mergeDiaPayloads(fromHist, merged);
    }
  } else {
    merged = apiData ? normalizePosicaoDiaPayload(apiData) : null;
    if (ov) {
      const fromOv = normalizePosicaoDiaPayload(
        applyImportOverrides({ data_referencia: ref }, ov),
      );
      merged = mergeDiaPayloads(fromOv, merged);
    }
  }

  if (!merged && apiData) merged = normalizePosicaoDiaPayload(apiData);

  if (merged && ref) {
    merged.data_referencia = ref;
    merged.date = ref;
  }
  return merged;
}

/** Armazena overrides por data ISO — importações de vários dias não se apagam. */
export function normalizeOverridesStore(raw) {
  if (!raw || typeof raw !== "object") return { v: 2, byDate: {} };
  if (raw.byDate && typeof raw.byDate === "object") {
    return { v: 2, byDate: { ...raw.byDate } };
  }
  const ref = normDateKey(raw.data_referencia);
  const byDate = {};
  if (ref) {
    const day = { data_referencia: ref };
    let has = false;
    POSICAO_CATEGORIES.forEach((cat) => {
      if (Array.isArray(raw[cat]?.colaboradores) && raw[cat].colaboradores.length) {
        day[cat] = raw[cat];
        has = true;
      }
    });
    if (has) byDate[ref] = day;
  }
  return { v: 2, byDate };
}

export function getOverridesForDate(store, date) {
  const { byDate } = normalizeOverridesStore(store);
  const ref = normDateKey(date);
  if (!ref || !byDate[ref]) return null;
  return { ...byDate[ref], data_referencia: ref };
}

export function mergeImportByCat(store, byCat, dataRef) {
  const norm = normalizeOverridesStore(store);
  const ref = normDateKey(dataRef) || String(dataRef || "").trim();
  if (!ref) return norm;
  const day = { ...(norm.byDate[ref] || {}), data_referencia: ref };
  Object.entries(byCat || {}).forEach(([cat, colabs]) => {
    if (!POSICAO_CATEGORIES.includes(cat) || !Array.isArray(colabs) || !colabs.length) return;
    day[cat] = { total: colabs.length, colaboradores: colabs };
  });
  norm.byDate[ref] = day;
  return norm;
}

/** Mescla colaboradores por matrícula (import parcial não apaga outras categorias). */
export function mergeHistEmployees(prev, incoming) {
  const map = new Map();
  const keyOf = (e, i) =>
    String(e?.mat ?? e?.matricula ?? e?.codigo ?? e?.nome ?? `i-${i}`).trim();
  (Array.isArray(prev) ? prev : []).forEach((e, i) => {
    const k = keyOf(e, i);
    if (k) map.set(k, { ...e });
  });
  (Array.isArray(incoming) ? incoming : []).forEach((e, i) => {
    const k = keyOf(e, i);
    if (!k) return;
    const old = map.get(k);
    map.set(k, old ? { ...old, ...e, cat: e?.cat || old?.cat } : { ...e });
  });
  return [...map.values()];
}

const HIST_CAT_LEGACY_NUM = {
  falta: ["faltas"],
  atraso: ["atrasos"],
};

/** Contagem por categoria: lista de colaboradores ou total numérico legado (import tabela). */
export function histCatCount(row, cat) {
  if (!row || typeof row !== "object") return 0;
  const colabs = getColaboradoresFromGroup(row[cat]);
  if (colabs.length > 0) return colabs.length;
  const v = row[cat];
  if (v && typeof v === "object" && typeof v.total === "number" && !Number.isNaN(v.total)) {
    return Math.max(0, v.total);
  }
  if (typeof v === "number" && !Number.isNaN(v) && v >= 0) return v;
  for (const key of HIST_CAT_LEGACY_NUM[cat] || []) {
    const n = Number(row[key]);
    if (!Number.isNaN(n) && n >= 0) return n;
  }
  return 0;
}

/** Atualiza totais numéricos da linha histórica sem apagar totais de importação agregada. */
export function syncHistRowAggregates(row) {
  if (!row || typeof row !== "object") return row;
  const presentes = histCatCount(row, "presentes");
  const faltas = histCatCount(row, "falta") || Number(row.faltas) || 0;
  const atrasos = histCatCount(row, "atraso") || Number(row.atrasos) || 0;
  const justFromCats =
    histCatCount(row, "folga") + histCatCount(row, "ferias") + histCatCount(row, "afastados");
  const justificadas =
    justFromCats > 0 ? justFromCats : Number(row.justificadas) || 0;
  const totalFromCats = POSICAO_CATEGORIES.reduce((s, cat) => s + histCatCount(row, cat), 0);
  const totalLegacy = Number(row.total);
  const total = totalFromCats > 0 ? totalFromCats : totalLegacy > 0 ? totalLegacy : 0;
  row.faltas = faltas;
  row.atrasos = atrasos;
  row.justificadas = justificadas;
  row.total = total;
  row.abs_rate = total > 0 ? +((faltas / total) * 100).toFixed(2) : 0;
  // Mantém listas { colaboradores }; só grava número quando não há nomes na categoria
  POSICAO_CATEGORIES.forEach((cat) => {
    if (getColaboradoresFromGroup(row[cat]).length) return;
    if (typeof row[cat] === "object" && row[cat] !== null) return;
    const n = histCatCount(row, cat);
    if (n > 0 || row[cat] == null) row[cat] = n;
  });
  return row;
}

/**
 * Mescla importação parcial no dia já salvo — não zera presentes/faltas/etc.
 */
export function mergeHistDayRow(prev, patch) {
  const merged = { ...(prev && typeof prev === "object" ? prev : {}) };
  const ref =
    normDateKey(patch?.date || patch?.data_referencia) ||
    histRowDate(merged) ||
    histRowDate(patch);
  if (ref) {
    merged.date = ref;
    merged.data_referencia = ref;
  }

  POSICAO_CATEGORIES.forEach((cat) => {
    const colabs = getColaboradoresFromGroup(patch?.[cat]);
    if (colabs.length) {
      merged[cat] = { total: colabs.length, colaboradores: colabs };
    }
  });

  const patchHasCats = POSICAO_CATEGORIES.some((cat) => getColaboradoresFromGroup(patch?.[cat]).length);
  if (
    patchHasCats &&
    Array.isArray(patch?._employees) &&
    patch._employees.length
  ) {
    merged._employees = mergeHistEmployees(merged._employees, patch._employees);
  }

  if (Array.isArray(patch?._events)) {
    merged._events = patch._events;
    merged._eventCount = patch._events.length;
  }

  return syncHistRowAggregates(merged);
}

export function mergeHistTableRows(prev, incoming) {
  if (!Array.isArray(incoming) || !incoming.length) return prev;
  if (!Array.isArray(prev) || !prev.length) return incoming;
  const map = new Map();
  const keyOf = (r) => normDateKey(r?.date || r?.data_referencia || r?.data) || "";
  prev.forEach((r) => {
    const k = keyOf(r);
    if (k) map.set(k, r);
  });
  incoming.forEach((r) => {
    const k = keyOf(r);
    if (k) map.set(k, mergeHistDayRow(map.get(k), r));
  });
  return [...map.values()].sort((a, b) => keyOf(a).localeCompare(keyOf(b)));
}

export function loadImportOverrides() {
  try {
    const raw = localStorage.getItem(POSICAO_IMPORT_OVERRIDES_KEY);
    const parsed = raw ? JSON.parse(raw) : null;
    return normalizeOverridesStore(parsed);
  } catch {
    return { v: 2, byDate: {} };
  }
}

export async function loadImportOverridesMerged() {
  const fromLs = loadImportOverrides();
  try {
    const fromIdb = await loadPosicaoStoredValue(POSICAO_IMPORT_OVERRIDES_KEY, null);
    const idbNorm = normalizeOverridesStore(fromIdb);
    const dates = new Set([
      ...Object.keys(fromLs.byDate || {}),
      ...Object.keys(idbNorm.byDate || {}),
    ]);
    if (!dates.size) return fromLs;
    const byDate = { ...fromLs.byDate };
    dates.forEach((d) => {
      const ls = fromLs.byDate[d];
      const idb = idbNorm.byDate[d];
      if (!idb) return;
      if (!ls) {
        byDate[d] = idb;
        return;
      }
      const merged = { ...ls, data_referencia: d };
      POSICAO_CATEGORIES.forEach((cat) => {
        const idbColabs = getColaboradoresFromGroup(idb[cat]);
        if (idbColabs.length) merged[cat] = idb[cat];
      });
      byDate[d] = merged;
    });
    return { v: 2, byDate };
  } catch {
    return fromLs;
  }
}

export function saveImportOverrides(store) {
  const norm = normalizeOverridesStore(store);
  try {
    localStorage.setItem(POSICAO_IMPORT_OVERRIDES_KEY, JSON.stringify(norm));
  } catch {
    // Mantém em memória se localStorage estourar; IndexedDB é o backup principal.
  }
  return norm;
}

export async function persistImportOverrides(store) {
  const norm = saveImportOverrides(store);
  try {
    await savePosicaoStoredValue(POSICAO_IMPORT_OVERRIDES_KEY, norm);
  } catch {
    // ignore
  }
  return norm;
}

export function applyImportOverrides(data, overrides) {
  const next = { ...(data || {}) };
  const src = overrides && typeof overrides === "object" ? overrides : {};
  if (src.data_referencia && !next.data_referencia) next.data_referencia = src.data_referencia;
  POSICAO_CATEGORIES.forEach((cat) => {
    const colabs = src?.[cat]?.colaboradores;
    if (Array.isArray(colabs)) next[cat] = { total: colabs.length, colaboradores: colabs };
  });
  return next;
}

function applyOneDateOverridesToHistorico(histArr, date, src) {
  const base = Array.isArray(histArr) ? histArr : [];
  let found = false;
  const result = base.map((row) => {
    const rowDate = histRowDate(row);
    if (!rowDate || rowDate !== date) return row;
    found = true;

    let next = { ...(row || {}) };
    POSICAO_CATEGORIES.forEach((cat) => {
      const colabs = src?.[cat]?.colaboradores;
      if (Array.isArray(colabs)) next[cat] = { total: colabs.length, colaboradores: colabs };
    });

    const total = POSICAO_CATEGORIES.reduce((s, k) => s + histCatCount(next, k), 0);
    if (total > 0) {
      const faltas = histCatCount(next, "falta") || Number(next.faltas) || 0;
      const atrasos = histCatCount(next, "atraso") || Number(next.atrasos) || 0;
      next = {
        ...next,
        date: next.date || rowDate,
        data_referencia: next.data_referencia || rowDate,
        total,
        faltas,
        atrasos,
        abs_rate: +((faltas / total) * 100).toFixed(2),
      };
    }
    return next;
  });

  if (!found) {
    const newRow = { date, data_referencia: date, total: 0, faltas: 0, atrasos: 0, abs_rate: 0 };
    POSICAO_CATEGORIES.forEach((cat) => {
      const catData = src[cat];
      if (catData && Array.isArray(catData.colaboradores))
        newRow[cat] = { total: catData.colaboradores.length, colaboradores: catData.colaboradores };
    });
    const newTotal = POSICAO_CATEGORIES.reduce((s, k) => s + histCatCount(newRow, k), 0);
    if (newTotal > 0) {
      newRow.total = newTotal;
      newRow.faltas = histCatCount(newRow, "falta");
      newRow.atrasos = histCatCount(newRow, "atraso");
      newRow.abs_rate = +((newRow.faltas / newTotal) * 100).toFixed(2);
    }
    const insertIdx = result.findIndex((r) => histRowDate(r) > date);
    if (insertIdx === -1) result.push(newRow);
    else result.splice(insertIdx, 0, newRow);
  }

  return result;
}

export function applyImportOverridesToHistorico(histArr, overridesStore) {
  const { byDate } = normalizeOverridesStore(overridesStore);
  const dates = Object.keys(byDate || {});
  if (!dates.length) return Array.isArray(histArr) ? histArr : [];
  return dates.reduce(
    (acc, date) => applyOneDateOverridesToHistorico(acc, date, byDate[date]),
    Array.isArray(histArr) ? histArr : [],
  );
}

// ===== Helpers de importação XLSX (escopo do m?dulo) =====
export function _normHeader(h) {
  return String(h || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_|_$/g, "");
}
// Colunas que identificam uma tabela hist?rica agregada (sem matricula/nome)
const _TABELA_COLS = new Set([
  "presentes",
  "presencas",
  "presenca",
  "total_presentes",
  "qt_presentes",
  "ausentes",
  "faltas",
  "falta",
  "total_faltas",
  "qt_faltas",
  "atrasos",
  "atraso",
  "total_atrasos",
  "qt_atrasos",
  "justificadas",
  "justificada",
  "faltas_justificadas",
  "extras",
  "horas_extras",
  "total",
  "total_geral",
  "forca",
  "headcount",
]);

const _HEADER_MAP = {
  // Identificação do colaborador
  filial: "filial",
  empresa: "filial",
  unidade: "filial",
  codigo_do_departamento: "depto",
  cod_departamento: "depto",
  centro_custo: "depto",
  cc: "depto",
  departamento: "depto_desc",
  setor: "depto_desc",
  nome_gestor: "gestor",
  gestor: "gestor",
  matricula: "matricula",
  mat: "matricula",
  chapa: "matricula",
  codigo: "matricula",
  registro: "matricula",
  reg: "matricula",
  nome: "nome",
  nome_colaborador: "nome",
  colaborador: "nome",
  funcionario: "nome",
  nome_completo: "nome",
  cargo: "cargo",
  funcao: "cargo",
  carga: "cargo",
  genero: "genero",
  sexo: "genero",
  data_inicio: "inicio",
  data_inicio_1: "inicio",
  data_inicio_2: "inicio",
  data_inicio_ferias: "inicio",
  data_inicial: "inicio",
  data_inicial_1: "inicio",
  data_ini: "inicio",
  periodo_inicio: "inicio",
  periodo_de: "inicio",
  periodo_apuracao_de: "inicio",
  afastamento_inicio: "inicio",
  inicio_afastamento: "inicio",
  data_inicio_afastamento: "inicio",
  data_inicial_afastamento: "inicio",
  afastamento_datainicio: "inicio",
  afastamento_data_inicio: "inicio",
  inicio: "inicio",
  inicio_ferias: "inicio",
  dt_inicio: "inicio",
  data_fim: "termino",
  data_fim_1: "termino",
  data_fim_2: "termino",
  data_final: "termino",
  data_final_1: "termino",
  data_final_ferias: "termino",
  data_final_afastamento: "termino",
  data_termino: "termino",
  data_termino_1: "termino",
  data_termino_ferias: "termino",
  data_termino_afastamento: "termino",
  afastamento_final: "termino",
  afastamento_datafinal: "termino",
  afastamento_data_final: "termino",
  periodo_fim: "termino",
  periodo_ate: "termino",
  periodo_apuracao_ate: "termino",
  afastamento_fim: "termino",
  fim: "termino",
  fim_ferias: "termino",
  fim_afastamento: "termino",
  termino: "termino",
  termino_ferias: "termino",
  termino_afastamento: "termino",
  dt_termino: "termino",
  dt_fim: "termino",
  qtd_dias: "qtd_dias",
  quantidade_dias: "qtd_dias",
  dias: "qtd_dias",
  justificativa: "justificativa",
  motivo: "justificativa",
  observacao: "justificativa",
  obs: "justificativa",
  // Datas / horários
  data: "_data",
  data_referencia: "_data",
  data_lancamento: "_data",
  marcacoes: "_marcacoes",
  marcacao: "_marcacoes",
  horario_do_dia: "horario_dia",
  horario: "horario_dia",
  horarios: "horario_dia",
  horarios_do_dia: "horario_dia",
  horario_a_cumprir: "horario_dia",
  horario_previsto: "horario_dia",
  horario_prevista: "horario_dia",
  horario_prev: "horario_dia",
  jornada: "horario_dia",
  turno: "horario_dia",
  hor_1: "_hor_1",
  hor_2: "_hor_2",
  hor_3: "_hor_3",
  hor_4: "_hor_4",
  marc_1: "_marc_1",
  marc_2: "_marc_2",
  marc_3: "_marc_3",
  marc_4: "_marc_4",
  // Status / ocorrência → classificação automática de categoria por linha
  ocorrencia: "_status",
  ocorrencias: "_status",
  situacao: "_status",
  situacoes: "_status",
  status: "_status",
  tipo: "_status",
  evento: "_status",
  eventos: "_status",
  motivo: "_status",
  descricao: "_status",
  abreviatura: "_status",
  abrev: "_status",
  // Formato apontamentos/eventos (colunas com ponto → underscore via _normHeader)
  colaborador_matricula: "matricula",
  colaborador_chapa: "matricula",
  colaborador_nome: "nome",
  colaborador_nome_completo: "nome",
  colaborador_genero: "genero",
  colaborador_sexo: "genero",
  filial_nomefantasia: "filial",
  filial_nome_fantasia: "filial",
  filial_nome: "filial",
  departamento_nome: "depto_desc",
  departamento_descricao: "depto_desc",
  cargo_descricao: "cargo",
  cargo_nome: "cargo",
  apontamento_data: "_data",
  apontamento_dt: "_data",
  apontamento_atividade: "_atividade",
  codigo_evento: "_evt_cod",
  cod_evento: "_evt_cod",
  evento_codigo: "_evt_cod",
  evento_cod: "_evt_cod",
  cod_ocorrencia: "_evt_cod",
  codigo_ocorrencia: "_evt_cod",
  evento_atrb: "_evt_desc",
  evento_atrib: "_evt_desc",
  evento_atributo: "_evt_desc",
  evento_descricao: "_evt_desc",
  evento_nome: "_evt_desc",
  situacao_descricao: "_status",
  situacao_desc: "_status",
  apontamento_situacao: "_status",
  apontamento_horas: "_horas",
  apontamento_qtd_horas: "_horas",
  marcacao_horario: "horario_dia",
  marcacao_horario_dia: "horario_dia",
  marcacao_marcacao: "_marcacoes",
  marcacao_batidas: "_marcacoes",
};
export function _fmtTime(v) {
  if (v == null || v === "") return "";
  if (v instanceof Date) {
    const hh = String(v.getHours()).padStart(2, "0");
    const mm = String(v.getMinutes()).padStart(2, "0");
    return `${hh}:${mm}`;
  }
  const s = String(v).trim();
  const m = s.match(/^(\d{1,2}):(\d{2})/);
  if (m) return `${String(parseInt(m[1], 10)).padStart(2, "0")}:${m[2]}`;
  const num = Number(s);
  if (!isNaN(num) && num > 0 && num < 1) {
    const totalMin = Math.round(num * 24 * 60);
    const hh = String(Math.floor(totalMin / 60)).padStart(2, "0");
    const mm = String(totalMin % 60).padStart(2, "0");
    return `${hh}:${mm}`;
  }
  return "";
}
export function _fmtDate(v) {
  if (v == null || v === "") return "";
  if (v instanceof Date && !isNaN(v)) return v.toISOString().slice(0, 10);
  if (typeof v === "number" && isFinite(v) && v > 20000 && v < 80000) {
    const d = new Date(Date.UTC(1899, 11, 30) + Math.round(v) * 86400000);
    return d.toISOString().slice(0, 10);
  }
  const s = String(v).trim();
  const br = s.match(/^(\d{1,2})[\/.-](\d{1,2})[\/.-](\d{2,4})$/);
  if (br) {
    const yyyy = br[3].length === 2 ? `20${br[3]}` : br[3];
    return `${yyyy}-${String(br[2]).padStart(2, "0")}-${String(br[1]).padStart(2, "0")}`;
  }
  const d = new Date(s);
  return d && !isNaN(d) ? d.toISOString().slice(0, 10) : "";
}
export function _parseMarcacoesString(s) {
  if (!s) return [];
  const tokens = String(s).split(/\s+/).filter(Boolean);
  const out = [];
  let idx = 0;
  for (const t of tokens) {
    const m = t.match(/^(\d{1,2}):(\d{2})$/);
    if (!m) continue;
    const hh = String(parseInt(m[1], 10)).padStart(2, "0");
    out.push({ time: `${hh}:${m[2]}`, ok: idx % 2 === 0 });
    idx += 1;
  }
  return out;
}
export function _normText(s) {
  return String(s || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{Diacritic}+/gu, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}
export function normalizeGenero(value) {
  const n = _normText(value);
  if (!n) return "";
  if (n === "m" || n === "masc" || n === "masculino" || n === "homem") return "M";
  if (n === "f" || n === "fem" || n === "feminino" || n === "mulher") return "F";
  return "";
}
// Determina categoria da posição do dia a partir de c?digo/descrição de evento
export function _inferCatFromEvent(cod, desc, horasMin) {
  const text = _normText(`${cod} ${desc}`).replace(/\s+/g, " ").trim();
  if (/\b(falta|ausencia)\b/.test(text)) return "falta";
  if (/\b(atrasad|atrasou|atraso|atrasados|tard|chegada)\b/.test(text)) return "atraso";
  if (/\b(afastamento|afastado|atestado|licenca|auxilio|inss|enfermidade|maternidade|acidente)\b/.test(text))
    return "afastados";
  if (/\b(ferias)\b/.test(text)) return "ferias";
  if (/\b(folga|dsr|fds|descanso)\b/.test(text)) return "folga";
  if (/\b(sem.?controle|nao.?controla|desconhec)\b/.test(text)) return "nao_controla";
  if (
    /\b(normal|trabalhad|antecipada|presenca|hora|extra|adicional|noturno|banco)\b/.test(text)
  )
    return "presentes";
  if (horasMin > 0) return "presentes";
  return null;
}
// Categoria principal quando um funcionário tem m?ltiplos eventos no dia
export function _pickMainCat(catsSet) {
  if (catsSet.has("falta")) return "falta";
  if (catsSet.has("atraso")) return "atraso";
  if (catsSet.has("afastados")) return "afastados";
  if (catsSet.has("ferias")) return "ferias";
  if (catsSet.has("folga")) return "folga";
  if (catsSet.has("nao_controla")) return "nao_controla";
  if (catsSet.has("ja_saiu")) return "ja_saiu";
  if (catsSet.has("entrada_prev")) return "entrada_prev";
  if (catsSet.has("presentes")) return "presentes";
  return null;
}
// Converte valor de horas (string "8:00", número decimal, fração do dia) em minutos
export function _parseHorasMin(v) {
  if (v == null || v === "") return 0;
  if (typeof v === "number") {
    if (v > 0 && v < 1) return Math.round(v * 24 * 60);
    if (v >= 1) return Math.round(v * 60);
    return 0;
  }
  const s = String(v).trim();
  const m = s.match(/^(\d+):(\d{2})/);
  if (m) return parseInt(m[1]) * 60 + parseInt(m[2]);
  const n = parseFloat(s.replace(",", "."));
  return !isNaN(n) && n > 0 ? Math.round(n * 60) : 0;
}

// Abreviações exatas usadas por sistemas brasileiros (Ponto Secullum, Dimep, REX, THR…)
const _CAT_ABBREV = {
  p: "presentes",
  pr: "presentes",
  pre: "presentes",
  pres: "presentes",
  f: "falta",
  fa: "falta",
  fal: "falta",
  aus: "falta",
  a: "atraso",
  at: "atraso",
  atr: "atraso",
  atrasados: "atraso",
  atrasado: "atraso",
  fo: "folga",
  fol: "folga",
  ds: "folga",
  dsr: "folga",
  fe: "ferias",
  fer: "ferias",
  vac: "ferias",
  af: "afastados",
  afe: "afastados",
  lp: "afastados",
  lic: "afastados",
  med: "afastados",
  ate: "afastados",
  sa: "ja_saiu",
  js: "ja_saiu",
  ep: "entrada_prev",
  sc: "nao_controla",
  nc: "nao_controla",
};

const _CAT_PATTERNS = [
  [/pres[ea]n|trabalh|present|normal|pontual|comparec/, "presentes"],
  [/falt|ausent|nao.?compar|nao.?trab/, "falta"],
  [/atrasad|atrasou|atraso|tard|chegada/, "atraso"],
  [/folg|day.?off|dsr|banco.?hora/, "folga"],
  [/feri|vacat/, "ferias"],
  [/afastad|licen|atestado|medic|acid|matern|paterni/, "afastados"],
  [/ja.?sa|saiu|saida.?antec|saiu.?cedo/, "ja_saiu"],
  [/entrada.?prev|a.?caminho|em.?transito|prevista/, "entrada_prev"],
  [/sem.?contr|nao.?contr|desconhec/, "nao_controla"],
];

export function _detectCategoryFromText(text) {
  const n = _normText(text);
  if (!n) return null;
  if (_CAT_ABBREV[n]) return _CAT_ABBREV[n]; // "PR", "FA", "AT" etc.
  for (const [rx, cat] of _CAT_PATTERNS) if (rx.test(n)) return cat;
  return null;
}
const _detectCategoryFromFilename = _detectCategoryFromText;

export function fixPosicaoSheetRef(ws, XLSX) {
  let maxR = 0,
    maxC = 0;
  for (const k of Object.keys(ws)) {
    if (k[0] === "!") continue;
    const addr = XLSX.utils.decode_cell(k);
    if (addr.r > maxR) maxR = addr.r;
    if (addr.c > maxC) maxC = addr.c;
  }
  ws["!ref"] = XLSX.utils.encode_range({ s: { r: 0, c: 0 }, e: { r: maxR, c: maxC } });
}

function _fixSheetRef(ws, XLSX) {
  fixPosicaoSheetRef(ws, XLSX);
}

export async function importPosicaoXlsxFile(file, opts = {}) {
  const { fallbackCategory = "presentes", targetDate = null } = opts;
  const targetDateIso = normDateKey(targetDate) || targetDate || null;
  if (!file) return null;
  const xlsxMod = await import("xlsx-js-style");
  const XLSX = xlsxMod.default ?? xlsxMod;
  const buf = await file.arrayBuffer();
  const wb = XLSX.read(buf, { type: "array", cellDates: true });

  // byCat acumula listas de colaboradores por categoria
  const byCat = {};
  const addColab = (cat, c) => {
    (byCat[cat] = byCat[cat] || []).push(c);
  };

  // tabelaRows acumula linhas de totais históricos
  const tabelaRows = [];
  let dataRef = null;
  let hasEmployees = false;
  let hasTabela = false;

  for (const sheetName of wb.SheetNames) {
    const ws = wb.Sheets[sheetName];
    _fixSheetRef(ws, XLSX);
    const aoa = XLSX.utils.sheet_to_json(ws, {
      header: 1,
      raw: true,
      defval: null,
      blankrows: false,
    });
    if (!aoa.length) continue;

    // Encontra linha de cabeçalho
    const headerRow = aoa.findIndex((line) => {
      const hs = (line || []).map(_normHeader);
      const hasMat = hs.some((h) => _HEADER_MAP[h] === "matricula");
      const hasNome = hs.some((h) => _HEADER_MAP[h] === "nome");
      const hasTabelaHdr = hs.some((h) => _TABELA_COLS.has(h));
      if (hasNome && (hasMat || !hasTabelaHdr)) return true; // lista de colaboradores
      // Tabela hist?rica: tem coluna de data + pelo menos uma coluna de total
      const hasData = hs.some((h) => _HEADER_MAP[h] === "_data");
      return hasData && hs.some((h) => _TABELA_COLS.has(h));
    });
    if (headerRow === -1) continue;

    const headers = (aoa[headerRow] || []).map(_normHeader);
    const hasMat = headers.some((h) => _HEADER_MAP[h] === "matricula");
    const hasNome = headers.some((h) => _HEADER_MAP[h] === "nome");
    const hasTabelaCols = headers.some((h) => _TABELA_COLS.has(h));
    const hasEvt = headers.some(
      (h) => _HEADER_MAP[h] === "_evt_cod" || _HEADER_MAP[h] === "_evt_desc",
    );
    // Lista de colaboradores: nome + (matrícula ou aba sem colunas de totais agregados)
    const isEmployeeSheet = hasNome && (hasMat || !hasTabelaCols);
    const isEventsSheet = hasMat && hasNome && hasEvt; // formato apontamentos

    // ?? Formato apontamentos/eventos (múltiplas linhas por funcionário/dia) ??
    if (isEventsSheet) {
      const byDateEmp = new Map(); // date → Map<empKey, {colab, cats}>

      for (let r = headerRow + 1; r < aoa.length; r++) {
        const row = aoa[r] || [];
        if (row.every((v) => v == null || v === "")) continue;
        const o = {};
        headers.forEach((h, i) => {
          const t = _HEADER_MAP[h] || h;
          o[t] = row[i];
        });

        const dateStr = o._data ? _fmtDate(o._data) : "";
        if (!dateStr) continue;

        const mat = o.matricula != null ? String(o.matricula).trim() : "";
        const nome = String(o.nome || "").trim();
        if (!mat && !nome) continue;
        const empKey = mat || nome;

        if (!byDateEmp.has(dateStr)) byDateEmp.set(dateStr, new Map());
        const dateMap = byDateEmp.get(dateStr);

        if (!dateMap.has(empKey)) {
          dateMap.set(empKey, {
            colab: {
              matricula: mat,
              nome,
              depto: "",
              depto_desc: "",
              cargo: "",
              genero: "",
              filial: "",
              gestor: "",
              horario_dia: "",
              marcacoes: [],
              inicio: "",
              termino: "",
              qtd_dias: "",
              justificativa: "",
            },
            cats: new Set(),
            events: [],
          });
        }
        const emp = dateMap.get(empKey);
        if (o.depto_desc && !emp.colab.depto_desc) emp.colab.depto_desc = String(o.depto_desc);
        if (o.cargo && !emp.colab.cargo) emp.colab.cargo = String(o.cargo);
        if (o.genero && !emp.colab.genero) emp.colab.genero = normalizeGenero(o.genero);
        if (o.filial && !emp.colab.filial) emp.colab.filial = String(o.filial);
        if (o.gestor && !emp.colab.gestor) emp.colab.gestor = String(o.gestor);
        if (o.horario_dia && !emp.colab.horario_dia) emp.colab.horario_dia = String(o.horario_dia);
        if (o.inicio && !emp.colab.inicio) emp.colab.inicio = _fmtDate(o.inicio) || String(o.inicio);
        if (o.termino && !emp.colab.termino) emp.colab.termino = _fmtDate(o.termino) || String(o.termino);
        if (o.qtd_dias && !emp.colab.qtd_dias) emp.colab.qtd_dias = String(o.qtd_dias);
        if (o.justificativa && !emp.colab.justificativa) emp.colab.justificativa = String(o.justificativa);

        const cod = String(o._evt_cod || "").trim();
        const desc = String(o._evt_desc || "").trim();
        const horas = _parseHorasMin(o._horas);
        const atividade = String(o._atividade || "").trim();
        const status = String(o._status || "").trim();
        const cat = _inferCatFromEvent(cod, `${desc} ${atividade} ${status}`, horas);
        if (cat) emp.cats.add(cat);

        const marc = _parseMarcacoesString(o._marcacoes);
        if (marc.length && !emp.colab.marcacoes.length) emp.colab.marcacoes = marc;

        emp.events.push({
          mat,
          nome,
          filial: emp.colab.filial,
          depto: emp.colab.depto_desc,
          cargo: emp.colab.cargo,
          genero: emp.colab.genero,
          data: dateStr,
          horario: o.horario_dia != null ? String(o.horario_dia).trim() : "",
          marcacao: o._marcacoes != null ? String(o._marcacoes).trim() : "",
          cod,
          evento: desc,
          atividade,
          situacaoDesc: status,
          inicio: o.inicio != null ? _fmtDate(o.inicio) || String(o.inicio) : "",
          termino: o.termino != null ? _fmtDate(o.termino) || String(o.termino) : "",
          horas: horas / 60,
          _cat: cat,
        });
      }

      if (!byDateEmp.size) continue;

      // Escolhe a data alvo: exata se existe, senão a mais recente ≤ targetDate
      const sortedDates = [...byDateEmp.keys()].sort();
      let useDate =
        targetDateIso && byDateEmp.has(targetDateIso) ? targetDateIso : null;
      if (!useDate) {
        for (const d of sortedDates) {
          if (!targetDateIso || d <= targetDateIso) useDate = d;
        }
        if (!useDate) useDate = sortedDates[sortedDates.length - 1];
      }
      if (!dataRef) dataRef = useDate;
      hasEmployees = true;
      hasTabela = true;

      // byCat para a data alvo → alimenta "Posição do dia"
      const targetDateMap = byDateEmp.get(useDate);
      if (targetDateMap) {
        for (const [, emp] of targetDateMap) {
          const cat = _pickMainCat(emp.cats);
          if (cat) addColab(cat, emp.colab);
        }
      }

      // tabelaRows para todos os dias → alimenta tabela 15d
      for (const [dateStr, dateMap] of byDateEmp) {
        let pres = 0,
          falt = 0,
          atr = 0,
          fold = 0,
          fer = 0,
          afa = 0,
          nc = 0;
        const _employees = [];
        const _events = [];
        for (const [, emp] of dateMap) {
          const cat = _pickMainCat(emp.cats);
          if (!cat) continue;
          if (cat === "presentes") pres++;
          else if (cat === "falta") falt++;
          else if (cat === "atraso") atr++;
          else if (cat === "folga") fold++;
          else if (cat === "ferias") fer++;
          else if (cat === "afastados") afa++;
          else if (cat === "nao_controla") nc++;
          _employees.push({
            mat: emp.colab.matricula,
            nome: emp.colab.nome,
            filial: emp.colab.filial,
            depto: emp.colab.depto_desc,
            depto_desc: emp.colab.depto_desc,
            cargo: emp.colab.cargo,
            genero: emp.colab.genero,
            gestor: emp.colab.gestor,
            inicio: emp.colab.inicio,
            termino: emp.colab.termino,
            qtd_dias: emp.colab.qtd_dias,
            justificativa: emp.colab.justificativa,
            cat,
            hrsPres: cat === "presentes" ? 1 : 0,
            hrsAuse: cat === "falta" ? 1 : 0,
            hrsAtraso: cat === "atraso" ? 1 : 0,
            hrsJust: cat === "folga" || cat === "ferias" || cat === "afastados" ? 1 : 0,
            hrsExtr: 0,
            hrsPlan: 0,
          });
          if (Array.isArray(emp.events)) _events.push(...emp.events);
        }
        const just = fold + fer + afa;
        const total = pres + falt + atr + just + nc;
        tabelaRows.push({
          date: dateStr,
          presentes: pres,
          faltas: falt,
          atrasos: atr,
          justificadas: just,
          nao_controla: nc,
          extras: null,
          total,
          abs_rate: total > 0 ? +((falt / total) * 100).toFixed(2) : 0,
          _employees: _employees.length > 0 ? _employees : null,
          _events: _events.length > 0 ? _events : null,
        });
      }
      continue; // esta aba foi processada como eventos; pula para a pr?xima
    }

    // Categoria para toda a aba (pelo nome da aba) e do arquivo (prioridade do arquivo)
    const sheetCat = _detectCategoryFromText(sheetName);
    const fileCatHint = _detectCategoryFromText(file.name);

    for (let r = headerRow + 1; r < aoa.length; r++) {
      const row = aoa[r] || [];
      if (row.every((v) => v == null || v === "")) continue;

      const o = {};
      headers.forEach((h, i) => {
        const target = _HEADER_MAP[h] || h;
        o[target] = row[i];
      });

      // Captura data de refer?ncia
      if (o._data) {
        const d = _fmtDate(o._data);
        if (d && !dataRef) dataRef = d;
      }

      if (!isEmployeeSheet) {
        // ?? Formato tabela hist?rica agregada ?????????????????????????
        const date = o._data ? _fmtDate(o._data) : "";
        if (!date) continue;
        hasTabela = true;
        const n = (k) => {
          const v = Number(o[k] ?? 0);
          return isNaN(v) ? 0 : v;
        };
        tabelaRows.push({
          date,
          presentes:
            n("presentes") ||
            n("presencas") ||
            n("presenca") ||
            n("total_presentes") ||
            n("qt_presentes"),
          faltas: n("faltas") || n("falta") || n("ausentes") || n("total_faltas") || n("qt_faltas"),
          atrasos: n("atrasos") || n("atraso") || n("total_atrasos") || n("qt_atrasos"),
          justificadas: n("justificadas") || n("justificada") || n("faltas_justificadas"),
          extras: n("extras") || n("horas_extras"),
          total: n("total") || n("total_geral") || n("forca") || n("headcount"),
        });
        continue;
      }

      // ?? Formato lista de colaboradores ???????????????????????????????
      hasEmployees = true;
      const horParts = ["_hor_1", "_hor_2", "_hor_3", "_hor_4"]
        .map((k) => _fmtTime(o[k]))
        .filter(Boolean);
      const marcParts = ["_marc_1", "_marc_2", "_marc_3", "_marc_4"]
        .map((k) => _fmtTime(o[k]))
        .filter(Boolean);
      let marcacoes = _parseMarcacoesString(o._marcacoes);
      if (!marcacoes.length && marcParts.length) {
        marcacoes = marcParts.map((time, idx) => ({ time, ok: idx % 2 === 0 }));
      }

      const colab = {
        matricula: o.matricula != null ? String(o.matricula) : "",
        nome: o.nome || "",
        depto: o.depto != null ? String(o.depto) : "",
        depto_desc: o.depto_desc || (o.depto != null ? String(o.depto) : ""),
        cargo: o.cargo || "",
        cargo_desc: o.cargo || "",
        genero: normalizeGenero(o.genero),
        filial: o.filial || "",
        gestor: o.gestor || "",
        horario_dia: o.horario_dia || (horParts.length ? horParts.join(" ") : ""),
        marcacoes,
        inicio: o.inicio != null ? _fmtDate(o.inicio) || String(o.inicio) : "",
        termino: o.termino != null ? _fmtDate(o.termino) || String(o.termino) : "",
        qtd_dias: o.qtd_dias != null && o.qtd_dias !== "" ? String(o.qtd_dias) : "",
        justificativa: o.justificativa != null ? String(o.justificativa) : "",
      };
      if (!colab.matricula && !colab.nome) continue;

      // Categoria: nome do arquivo (regra do botão) → status → aba → fallback
      const cat =
        fileCatHint ||
        _detectCategoryFromText(String(o._status || "")) ||
        sheetCat ||
        fallbackCategory;
      addColab(cat, colab);
    }
  }

  const dataRefFinal = dataRef || new Date().toISOString().slice(0, 10);

  if (hasTabela && !hasEmployees) {
    return { isTabelaFormat: true, tabelaRows, dataRefFinal };
  }

  // Se só uma categoria e não veio de status/aba, usa detecção do nome do arquivo
  if (hasEmployees && Object.keys(byCat).length === 1) {
    const fileCat = _detectCategoryFromText(file.name);
    const existingKey = Object.keys(byCat)[0];
    if (fileCat && existingKey !== fileCat) {
      byCat[fileCat] = byCat[existingKey];
      delete byCat[existingKey];
    }
  }

  if (!hasTabela && !hasEmployees)
    console.warn("NADA RECONHECIDO — verifique os cabeçalhos da planilha");

  // tabelaRows é preenchido tanto pelo formato de eventos quanto pelo formato tabela puro
  return {
    isTabelaFormat: false,
    byCat,
    dataRefFinal,
    tabelaRows: tabelaRows.length > 0 ? tabelaRows : null,
  };
}
