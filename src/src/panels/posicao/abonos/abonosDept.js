import { getColaboradoresFromGroup } from "../posicaoImport.js";
import { parseBancoHorasDate, parseBancoHorasMin, readWorksheetAoa } from "../banco-horas/bancoHoras.js";

export const PB_KPI_ABONOS_KEY = "pos_kpi_abonos_v1";
export const ABONOS_LAYOUT_VERSION = 3;

export const ABONOS_KIND = {
  pendentes: "pendentes",
  efetuados: "efetuados",
};

function calcAbonosSla(pendentes, efetuados, explicit = null) {
  if (explicit != null && !Number.isNaN(explicit)) return explicit;
  const total = pendentes + efetuados;
  if (total <= 0) return 100;
  return Math.round((efetuados / total) * 100);
}

function detailRowsStorageKey(kind = ABONOS_KIND.pendentes) {
  return kind === ABONOS_KIND.efetuados ? "detailRowsEfetuados" : "detailRows";
}

const normHeader = (value) =>
  String(value || "")
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "");

const findCol = (headers, patterns) =>
  headers.findIndex((h) => patterns.some((pattern) => pattern.test(h)));

const findColLoose = (headers, hints = []) => {
  for (const hint of hints) {
    const key = normHeader(hint);
    if (!key || key.length < 3) continue;
    const idx = headers.findIndex((h) => {
      if (!h || h.length < 2) return false;
      return h === key || h.includes(key) || key.includes(h);
    });
    if (idx >= 0) return idx;
  }
  return -1;
};

const findColSmart = (headers, patterns, looseHints = []) => {
  const strict = findCol(headers, patterns);
  if (strict >= 0) return strict;
  return findColLoose(headers, looseHints);
};

const ABONOS_REQUIRED_CHECKS = [
  {
    key: "departamento",
    label: "Departamento",
    patterns: [/^departamento$/, /^departamentonome$/, /^depto$/, /^setor$/],
    loose: ["departamento", "depto", "setor"],
  },
  {
    key: "matricula",
    label: "Matrícula",
    patterns: [/^matricula$/, /^mat$/, /^chapa$/, /^cadastro$/],
    loose: ["matricula", "matrícula", "mat", "chapa"],
  },
  {
    key: "nome",
    label: "Nome",
    patterns: [/^nome$/, /^colaborador$/, /^funcionario$/],
    loose: ["nome", "colaborador", "funcionario"],
  },
  {
    key: "data",
    label: "Data",
    patterns: [/^data$/, /^dataevento$/, /^dt$/],
    loose: ["data", "data evento"],
  },
];

function resolveAbonosColumnIndexes(headers) {
  return {
    filial: findColSmart(headers, [/^filial$/, /^empresa$/], ["filial", "empresa"]),
    departamento: findColSmart(
      headers,
      [/^departamento$/, /^departamentonome$/, /^depto$/, /^setor$/],
      ["departamento", "depto", "setor"],
    ),
    matricula: findColSmart(
      headers,
      [/^matricula$/, /^mat$/, /^chapa$/, /^cadastro$/],
      ["matricula", "matrícula", "mat", "chapa"],
    ),
    nome: findColSmart(headers, [/^nome$/, /^colaborador$/, /^funcionario$/], ["nome", "colaborador"]),
    cargo: findColSmart(headers, [/^cargo$/, /^funcao$/], ["cargo", "função", "funcao"]),
    codigoEventoOrigem: findColSmart(
      headers,
      [/^codigodoeventodeorigem$/, /^codigoeventoorigem$/, /^codeventoorigem$/, /^codigoorigem$/],
      ["codigo do evento de origem", "código do evento de origem", "cod evento origem", "codigo origem"],
    ),
    eventoOrigem: findColSmart(
      headers,
      [/^eventodeorigem$/, /^eventoorigem$/, /^descricaoevento$/],
      ["evento de origem", "evento origem", "descricao evento"],
    ),
    data: findColSmart(headers, [/^data$/, /^dataevento$/, /^dt$/], ["data", "data evento"]),
    horas: findColSmart(
      headers,
      [/^horas$/, /^qtdhoras$/, /^tempo$/, /^duracao$/],
      ["horas", "qtd horas", "tempo", "duração"],
    ),
  };
}

function missingAbonosColumns(headers) {
  const idx = resolveAbonosColumnIndexes(headers);
  return ABONOS_REQUIRED_CHECKS.filter((spec) => idx[spec.key] < 0).map((spec) => spec.label);
}

function cellText(row, idx) {
  if (!Array.isArray(row) || idx < 0) return "";
  const v = row[idx];
  if (v == null) return "";
  return String(v).trim();
}

export function normalizeAbonosDetailRows(rows) {
  if (!Array.isArray(rows)) return [];
  return rows
    .map((row) => {
      const matricula = String(row?.matricula || row?.mat || "").trim();
      const nome = String(row?.nome || "").trim();
      const departamento = String(row?.departamento || row?.depto || "").trim();
      const data = parseBancoHorasDate(row?.data) || String(row?.data || "").trim();
      const horasMin = Number.isFinite(row?.horasMin)
        ? Math.round(row.horasMin)
        : parseBancoHorasMin(row?.horas) ?? 0;
      return {
        filial: String(row?.filial || "").trim(),
        departamento,
        depto: departamento,
        matricula,
        mat: matricula,
        nome,
        cargo: String(row?.cargo || "").trim(),
        codigoEventoOrigem: String(row?.codigoEventoOrigem || row?.cod || "").trim(),
        eventoOrigem: String(row?.eventoOrigem || row?.evento || "").trim(),
        data,
        horasMin: Math.max(0, horasMin),
      };
    })
    .filter((row) => row.matricula || row.nome);
}

export function getAbonosDetailRows(stored = null, kind = ABONOS_KIND.pendentes) {
  const data = stored && typeof stored === "object" ? stored : loadKpiAbonos();
  if (!data) return [];
  const key = detailRowsStorageKey(kind);
  const raw = data[key];
  if (!Array.isArray(raw) || !raw.length) return [];
  return normalizeAbonosDetailRows(raw);
}

function aggregateDetailRowsByDept(detailRows, field = "pendentes") {
  const map = new Map();
  for (const row of detailRows) {
    const dept = String(row.departamento || row.depto || "").trim();
    if (!dept) continue;
    if (!map.has(dept)) map.set(dept, { dept, pendentes: 0, efetuados: 0, sla: null, minutos: 0 });
    const acc = map.get(dept);
    acc[field] += 1;
    acc.minutos += Number(row.horasMin) || 0;
  }
  return map;
}

function rebuildAbonosStorageState(pendentesRows, efetuadosRows, meta = {}) {
  const detailRows = normalizeAbonosDetailRows(pendentesRows);
  const detailRowsEfetuados = normalizeAbonosDetailRows(efetuadosRows);
  const pendMap = aggregateDetailRowsByDept(detailRows, "pendentes");
  const efetMap = aggregateDetailRowsByDept(detailRowsEfetuados, "efetuados");
  const depts = new Set([...pendMap.keys(), ...efetMap.keys()]);
  const byDept = {};
  for (const dept of depts) {
    const pendentes = pendMap.get(dept)?.pendentes || 0;
    const efetuados = efetMap.get(dept)?.efetuados || 0;
    byDept[dept] = {
      pendentes,
      efetuados,
      sla: calcAbonosSla(pendentes, efetuados, null),
    };
  }
  const countPendentes = detailRows.length;
  const countEfetuados = detailRowsEfetuados.length;
  const colaboradoresPendentes = new Set(
    detailRows.map((row) => row.matricula || row.nome).filter(Boolean),
  ).size;
  const colaboradoresEfetuados = new Set(
    detailRowsEfetuados.map((row) => row.matricula || row.nome).filter(Boolean),
  ).size;
  const totals = {
    pendentes: countPendentes,
    efetuados: countEfetuados,
    sla: calcAbonosSla(countPendentes, countEfetuados, null),
  };
  return {
    version: ABONOS_LAYOUT_VERSION,
    detailRows,
    detailRowsEfetuados,
    byDept,
    rows: byDept,
    totals,
    count: countPendentes,
    countPendentes,
    countEfetuados,
    colaboradores: colaboradoresPendentes,
    colaboradoresPendentes,
    colaboradoresEfetuados,
    departamentos: depts.size,
    importedAt: new Date().toISOString(),
    fileName: meta.fileName || "",
    fileNamePendentes: meta.kind === ABONOS_KIND.efetuados ? meta.fileNamePendentes || "" : meta.fileName || "",
    fileNameEfetuados: meta.kind === ABONOS_KIND.efetuados ? meta.fileName || "" : meta.fileNameEfetuados || "",
    sheetName: meta.sheetName || "",
    diagnosis: meta.diagnosis || null,
    source: "sheet",
  };
}

export function applyAbonosSheetImport(newRows, meta = {}, kind = ABONOS_KIND.pendentes) {
  const existing = (meta.existingStored && typeof meta.existingStored === "object"
    ? meta.existingStored
    : loadKpiAbonos()) || {};
  const pend =
    kind === ABONOS_KIND.pendentes
      ? newRows
      : getAbonosDetailRows(existing, ABONOS_KIND.pendentes);
  const efet =
    kind === ABONOS_KIND.efetuados
      ? newRows
      : getAbonosDetailRows(existing, ABONOS_KIND.efetuados);
  return rebuildAbonosStorageState(pend, efet, {
    ...meta,
    kind,
    fileNamePendentes:
      kind === ABONOS_KIND.pendentes ? meta.fileName || "" : existing.fileNamePendentes || existing.fileName || "",
    fileNameEfetuados:
      kind === ABONOS_KIND.efetuados ? meta.fileName || "" : existing.fileNameEfetuados || "",
  });
}

export function abonosDetailRowsToEvents(detailRows, opts = {}) {
  const {
    filialFilter = "",
    deptoFilter = "",
    dateFrom = "",
    dateTo = "",
    kind = ABONOS_KIND.pendentes,
  } = opts;
  const defaultEvento = kind === ABONOS_KIND.efetuados ? "Abono efetuado" : "Abono pendente";
  const from = String(dateFrom || "").slice(0, 10);
  const to = String(dateTo || "").slice(0, 10) || from;
  return normalizeAbonosDetailRows(detailRows)
    .filter((row) => {
      if (filialFilter && row.filial !== filialFilter) return false;
      if (deptoFilter && row.departamento !== deptoFilter) return false;
      const dk = String(row.data || "").slice(0, 10);
      if (from && dk && dk < from) return false;
      if (to && dk && dk > to) return false;
      return true;
    })
    .map((row) => ({
      mat: row.matricula,
      nome: row.nome,
      filial: row.filial,
      depto: row.departamento,
      departamento: row.departamento,
      cargo: row.cargo,
      cod: row.codigoEventoOrigem,
      evento: row.eventoOrigem || defaultEvento,
      data: row.data,
      horas: (Number(row.horasMin) || 0) / 60,
      horario: "",
      marcacao: "",
      _cat: kind === ABONOS_KIND.efetuados ? "justificadas" : "ausentes",
      abonoPendente: kind === ABONOS_KIND.pendentes,
      abonoEfetuado: kind === ABONOS_KIND.efetuados,
    }));
}

export function diagnoseAbonosPendentesSheet(aoa) {
  const rowsAoa = Array.isArray(aoa)
    ? aoa.filter((row) => Array.isArray(row) && row.some((v) => v != null && v !== ""))
    : [];
  if (!rowsAoa.length) {
    return {
      ok: false,
      headerIndex: -1,
      missingCols: ABONOS_REQUIRED_CHECKS.map((c) => c.label),
      rowCount: 0,
      issues: ["Planilha vazia ou sem linhas legíveis."],
      sampleHeaders: [],
    };
  }

  let headerIndex = -1;
  let missingCols = ABONOS_REQUIRED_CHECKS.map((c) => c.label);
  let mergedRow = [];

  for (let i = 0; i < Math.min(rowsAoa.length, 30); i++) {
    const headers = (rowsAoa[i] || []).map(normHeader);
    const missing = missingAbonosColumns(headers);
    if (!missing.length) {
      headerIndex = i;
      missingCols = [];
      mergedRow = rowsAoa[i] || [];
      break;
    }
    if (headerIndex < 0 || missing.length < missingCols.length) {
      headerIndex = i;
      missingCols = missing;
      mergedRow = rowsAoa[i] || [];
    }
  }

  const issues = [];
  if (headerIndex < 0 || missingCols.length) {
    issues.push(
      "Nenhuma linha com as colunas obrigatórias: Departamento, Matrícula, Nome e Data.",
    );
    if (headerIndex >= 0 && missingCols.length) {
      issues.push(`Colunas não encontradas (linha ${headerIndex + 1}): ${missingCols.join(", ")}.`);
    }
  }

  const sampleHeaders = (mergedRow || rowsAoa[0] || [])
    .map((h) => String(h ?? "").trim())
    .filter(Boolean)
    .slice(0, 12);

  let rowCount = 0;
  if (headerIndex >= 0 && !missingCols.length) {
    const idx = resolveAbonosColumnIndexes((mergedRow || []).map(normHeader));
    for (let r = headerIndex + 1; r < rowsAoa.length; r++) {
      const row = rowsAoa[r];
      const matricula = cellText(row, idx.matricula);
      const nome = cellText(row, idx.nome);
      if (!matricula && !nome) continue;
      rowCount += 1;
    }
  }

  return {
    ok: headerIndex >= 0 && !missingCols.length,
    headerIndex,
    missingCols,
    rowCount,
    issues,
    sampleHeaders,
  };
}

export function formatAbonosDiagnosis(diagnosis) {
  if (!diagnosis) return "";
  const parts = [...(diagnosis.issues || [])];
  if (diagnosis.missingCols?.length) {
    parts.push(`Faltando: ${diagnosis.missingCols.join(", ")}`);
  }
  if (diagnosis.sampleHeaders?.length) {
    parts.push(`Cabeçalhos lidos: ${diagnosis.sampleHeaders.join(" · ")}`);
  }
  if (diagnosis.sheetName) parts.unshift(`Aba: ${diagnosis.sheetName}`);
  return parts.filter(Boolean).join(" — ");
}

export function formatAbonosImportSummary(parsed, kind = ABONOS_KIND.pendentes) {
  const isEfetuados = kind === ABONOS_KIND.efetuados;
  const n = isEfetuados ? Number(parsed?.countEfetuados) || 0 : Number(parsed?.countPendentes ?? parsed?.count) || 0;
  if (!n) return isEfetuados ? "Nenhum abono efetuado importado." : "Nenhum abono pendente importado.";
  const colabs = isEfetuados
    ? Number(parsed?.colaboradoresEfetuados) || 0
    : Number(parsed?.colaboradoresPendentes ?? parsed?.colaboradores) || 0;
  const depts = Number(parsed.departamentos) || 0;
  const fileName = isEfetuados ? parsed?.fileNameEfetuados : parsed?.fileNamePendentes || parsed?.fileName;
  const file = fileName ? ` (${fileName})` : "";
  const label = isEfetuados ? "Abonos efetuados" : "Abonos pendentes";
  return `${label} importados${file}: ${n.toLocaleString("pt-BR")} ocorrência${n !== 1 ? "s" : ""} · ${colabs.toLocaleString("pt-BR")} colaborador${colabs !== 1 ? "es" : ""} · ${depts.toLocaleString("pt-BR")} departamento${depts !== 1 ? "s" : ""}.`;
}

function parseAbonosSheetRows(aoa, meta = {}) {
  const diagnosis = diagnoseAbonosPendentesSheet(aoa);
  const rowsAoa = Array.isArray(aoa)
    ? aoa.filter((row) => Array.isArray(row) && row.some((v) => v != null && v !== ""))
    : [];
  if (!diagnosis.ok || diagnosis.headerIndex < 0) return null;

  const headers = (rowsAoa[diagnosis.headerIndex] || []).map(normHeader);
  const idx = resolveAbonosColumnIndexes(headers);
  const detailRows = [];

  for (let r = diagnosis.headerIndex + 1; r < rowsAoa.length; r++) {
    const row = rowsAoa[r];
    const matricula = cellText(row, idx.matricula);
    const nome = cellText(row, idx.nome);
    if (!matricula && !nome) continue;

    const horasRaw = idx.horas >= 0 ? row[idx.horas] : null;
    const horasMin = parseBancoHorasMin(horasRaw) ?? 0;

    detailRows.push({
      filial: cellText(row, idx.filial),
      departamento: cellText(row, idx.departamento),
      matricula,
      nome,
      cargo: cellText(row, idx.cargo),
      codigoEventoOrigem: cellText(row, idx.codigoEventoOrigem),
      eventoOrigem: cellText(row, idx.eventoOrigem),
      data: parseBancoHorasDate(idx.data >= 0 ? row[idx.data] : "") || "",
      horasMin: Math.max(0, horasMin),
    });
  }

  if (!detailRows.length) return null;
  return detailRows;
}

export function parseAbonosPendentesSheet(aoa, meta = {}) {
  const detailRows = parseAbonosSheetRows(aoa, meta);
  if (!detailRows) return null;
  return applyAbonosSheetImport(detailRows, { ...meta, fileName: meta.fileName || "" }, ABONOS_KIND.pendentes);
}

export function parseAbonosEfetuadosSheet(aoa, meta = {}) {
  const detailRows = parseAbonosSheetRows(aoa, meta);
  if (!detailRows) return null;
  return applyAbonosSheetImport(detailRows, { ...meta, fileName: meta.fileName || "" }, ABONOS_KIND.efetuados);
}

/** @deprecated use applyAbonosSheetImport — mantido para testes. */
export function packAbonosStorage(detailRows, meta = {}) {
  return applyAbonosSheetImport(detailRows, meta, ABONOS_KIND.pendentes);
}

export function parseAbonosFromWorkbook(wb, XLSX, fileName = "", kind = ABONOS_KIND.pendentes) {
  if (!wb || !XLSX) return { parsed: null, diagnosis: null };
  let lastDiagnosis = null;
  const parseSheet =
    kind === ABONOS_KIND.efetuados ? parseAbonosEfetuadosSheet : parseAbonosPendentesSheet;
  for (const sheetName of wb.SheetNames || []) {
    const ws = wb.Sheets?.[sheetName];
    if (!ws) continue;
    const aoa = readWorksheetAoa(ws, XLSX);
    const diagnosis = diagnoseAbonosPendentesSheet(aoa);
    lastDiagnosis = { ...diagnosis, sheetName };
    const parsed = parseSheet(aoa, { fileName, sheetName, diagnosis });
    if (parsed) return { parsed, diagnosis: lastDiagnosis };
  }
  return { parsed: null, diagnosis: lastDiagnosis };
}

export function loadKpiAbonos() {
  try {
    if (typeof window === "undefined") return null;
    const raw = window.localStorage.getItem(PB_KPI_ABONOS_KEY);
    const parsed = raw ? JSON.parse(raw) : null;
    if (!parsed || typeof parsed !== "object") return null;
    const detailRows = normalizeAbonosDetailRows(parsed.detailRows);
    const detailRowsEfetuados = normalizeAbonosDetailRows(parsed.detailRowsEfetuados);
    if (detailRows.length || detailRowsEfetuados.length) {
      return rebuildAbonosStorageState(detailRows, detailRowsEfetuados, {
        fileName: parsed.fileName || "",
        fileNamePendentes: parsed.fileNamePendentes || parsed.fileName || "",
        fileNameEfetuados: parsed.fileNameEfetuados || "",
        sheetName: parsed.sheetName || "",
        diagnosis: parsed.diagnosis || null,
      });
    }
    return parsed;
  } catch {
    return null;
  }
}

export function saveKpiAbonos(data) {
  try {
    if (typeof window === "undefined") return;
    window.localStorage.setItem(PB_KPI_ABONOS_KEY, JSON.stringify(data || null));
    window.dispatchEvent(new CustomEvent("pos:abonos-updated", { detail: data }));
  } catch {
    // ignore
  }
}

const parsePtInt = (v) => {
  if (v == null) return 0;
  const s = String(v).trim();
  if (!s) return 0;
  const norm = s.replace(/\./g, "").replace(",", ".").replace(/%/g, "").replace(/\s+/g, "");
  const n = Number(norm);
  return Number.isFinite(n) ? Math.round(n) : 0;
};

/** CSV: Departamento;Pendentes;Efetuados;SLA */
export function parseAbonosCsv(csvText) {
  const text = String(csvText || "").replace(/^\uFEFF/, "");
  const lines = text
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);
  if (!lines.length) return null;

  const delim = lines[0].includes(";") ? ";" : ",";
  const header = lines[0].split(delim).map((s) => String(s || "").trim().toLowerCase());
  const idxDept = header.findIndex((h) => /depart|depto|grupo/.test(h));
  const idxPend = header.findIndex((h) => /pend/.test(h));
  const idxEfet = header.findIndex((h) => /efet|realiz|aprov/.test(h));
  const idxSla = header.findIndex((h) => /sla/.test(h));
  if (idxDept < 0) return null;

  const rows = {};
  for (let i = 1; i < lines.length; i++) {
    const parts = lines[i].split(delim);
    const dept = String(parts[idxDept] || "").trim();
    if (!dept) continue;
    rows[dept] = {
      pendentes: idxPend >= 0 ? parsePtInt(parts[idxPend]) : 0,
      efetuados: idxEfet >= 0 ? parsePtInt(parts[idxEfet]) : 0,
      sla: idxSla >= 0 ? parsePtInt(parts[idxSla]) : null,
    };
  }

  return { rows, importedAt: new Date().toISOString() };
}

/**
 * Top departamentos com abonos pendentes.
 * Regra atual: cada evento classificado como Ausentes conta como 1 abono pendente.
 */
function buildAbonosFromImportedDetails(pendentesRows, efetuadosRows, limit = 10) {
  const pendMap = aggregateDetailRowsByDept(pendentesRows, "pendentes");
  const efetMap = aggregateDetailRowsByDept(efetuadosRows, "efetuados");
  const depts = new Set([...pendMap.keys(), ...efetMap.keys()]);
  const allRows = [...depts]
    .map((dept) => {
      const pendentes = pendMap.get(dept)?.pendentes || 0;
      const efetuados = efetMap.get(dept)?.efetuados || 0;
      return {
        dept,
        pendentes,
        efetuados,
        sla: calcAbonosSla(pendentes, efetuados, null),
      };
    })
    .filter((r) => r.pendentes > 0 || r.efetuados > 0);

  const totals = allRows.reduce(
    (acc, r) => {
      acc.pendentes += r.pendentes || 0;
      acc.efetuados += r.efetuados || 0;
      return acc;
    },
    { pendentes: 0, efetuados: 0 },
  );
  totals.sla = calcAbonosSla(totals.pendentes, totals.efetuados, null);

  const rows = allRows
    .sort(
      (a, b) =>
        b.pendentes + b.efetuados - (a.pendentes + a.efetuados) ||
        String(a.dept || "").localeCompare(String(b.dept || ""), "pt-BR"),
    )
    .slice(0, Math.max(1, limit));

  return { rows, totals, source: "import" };
}

export function buildAbonosByDept(dia, opts = {}) {
  const { limit = 10, histRows = [], stored = null, useStoredFallback = false, periodo = null } = opts;

  const data = stored && typeof stored === "object" ? stored : loadKpiAbonos();
  const de = parseBancoHorasDate(periodo?.de);
  const ate = parseBancoHorasDate(periodo?.ate);
  const inPeriod = (row) => {
    const dataRow = parseBancoHorasDate(row?.data);
    if (!dataRow) return true;
    if (de && dataRow < de) return false;
    if (ate && dataRow > ate) return false;
    return true;
  };
  const allPendRows = getAbonosDetailRows(data, ABONOS_KIND.pendentes);
  const allEfetRows = getAbonosDetailRows(data, ABONOS_KIND.efetuados);
  const pendRows = allPendRows.filter(inPeriod);
  const efetRows = allEfetRows.filter(inPeriod);
  if (allPendRows.length || allEfetRows.length) {
    return buildAbonosFromImportedDetails(pendRows, efetRows, limit);
  }

  const deptOf = (c) =>
    String(c?.depto_desc || c?.depto || c?.departamento || c?.departamento_desc || "").trim() ||
    "—";
  const map = new Map();

  const ensure = (dept) => {
    if (!dept || dept === "—") return null;
    if (!map.has(dept)) map.set(dept, { dept, pendentes: 0, efetuados: 0, sla: null });
    return map.get(dept);
  };

  let countedFromEvents = 0;
  (Array.isArray(histRows) ? histRows : []).forEach((histRow) => {
    (Array.isArray(histRow?._events) ? histRow._events : []).forEach((ev) => {
      if (String(ev?._cat || "").toLowerCase() !== "ausentes") return;
      const row = ensure(deptOf(ev));
      if (!row) return;
      row.pendentes += 1;
      countedFromEvents += 1;
    });
  });

  if (!countedFromEvents) {
    ["falta", "atraso"].forEach((cat) => {
      getColaboradoresFromGroup(dia?.[cat]).forEach((c) => {
        const row = ensure(deptOf(c));
        if (row) row.pendentes += 1;
      });
    });
  }

  if (useStoredFallback && !map.size) {
    const storedRows =
      stored?.byDept && typeof stored.byDept === "object"
        ? stored.byDept
        : stored?.rows && typeof stored.rows === "object"
          ? stored.rows
          : {};
    Object.entries(storedRows).forEach(([dept, v]) => {
      const row = ensure(dept);
      if (!row || !v || typeof v !== "object") return;
      if (v.pendentes != null) row.pendentes = parsePtInt(v.pendentes);
      if (v.efetuados != null) row.efetuados = parsePtInt(v.efetuados);
      if (v.sla != null && v.sla !== "") row.sla = parsePtInt(v.sla);
    });
  }

  const calcSla = (pendentes, efetuados, explicit) => {
    if (explicit != null && !Number.isNaN(explicit)) return explicit;
    const total = pendentes + efetuados;
    if (total <= 0) return 100;
    return Math.round((efetuados / total) * 100);
  };

  const allRows = Array.from(map.values())
    .map((r) => ({
      ...r,
      sla: calcSla(r.pendentes, r.efetuados, r.sla),
    }))
    .filter((r) => r.pendentes > 0);

  const totals = allRows.reduce(
    (acc, r) => {
      acc.pendentes += r.pendentes || 0;
      acc.efetuados += r.efetuados || 0;
      return acc;
    },
    { pendentes: 0, efetuados: 0 },
  );
  totals.sla = calcSla(totals.pendentes, totals.efetuados, null);

  const rows = allRows
    .sort(
      (a, b) =>
        b.pendentes - a.pendentes ||
        String(a.dept || "").localeCompare(String(b.dept || ""), "pt-BR"),
    )
    .slice(0, Math.max(1, limit));

  return { rows, totals };
}

export function buildAbonosDeptColaboradores(histRows = [], dept = "", stored = null) {
  const targetDept = String(dept || "").trim();
  if (!targetDept) return [];

  const kind = stored?.abonosKind || ABONOS_KIND.pendentes;
  const imported = getAbonosDetailRows(stored, kind).filter(
    (row) => String(row.departamento || "").trim() === targetDept,
  );
  if (imported.length) {
    const map = new Map();
    for (const row of imported) {
      const mat = String(row.matricula || "").trim();
      const nome = String(row.nome || mat || "").trim();
      const key = `${mat}|${nome}`;
      const acc = map.get(key) || {
        mat,
        nome,
        cargo: row.cargo || "",
        filial: row.filial || "",
        ocorrencias: 0,
        minutos: 0,
        eventos: new Map(),
        dias: new Set(),
      };
      acc.ocorrencias += 1;
      acc.minutos += Number(row.horasMin) || 0;
      if (row.data) acc.dias.add(row.data);
      const eventName =
        String(row.eventoOrigem || (kind === ABONOS_KIND.efetuados ? "Abono efetuado" : "Abono pendente")).trim() ||
        (kind === ABONOS_KIND.efetuados ? "Abono efetuado" : "Abono pendente");
      acc.eventos.set(eventName, (acc.eventos.get(eventName) || 0) + 1);
      map.set(key, acc);
    }
    return Array.from(map.values())
      .map((row) => ({
        ...row,
        dias: Array.from(row.dias).sort(),
        eventos: Array.from(row.eventos.entries())
          .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0], "pt-BR"))
          .map(([name, count]) => `${name} (${count})`)
          .join(", "),
      }))
      .sort((a, b) => b.ocorrencias - a.ocorrencias || a.nome.localeCompare(b.nome, "pt-BR"));
  }

  const map = new Map();

  (Array.isArray(histRows) ? histRows : []).forEach((histRow) => {
    const date = histRow?.date || histRow?.data || histRow?.data_referencia || "";
    (Array.isArray(histRow?._events) ? histRow._events : []).forEach((ev) => {
      if (String(ev?._cat || "").toLowerCase() !== "ausentes") return;
      const evDept = String(ev?.depto_desc || ev?.depto || ev?.departamento || ev?.departamento_desc || "").trim();
      if (evDept !== targetDept) return;

      const mat = String(ev?.mat ?? ev?.matricula ?? "").trim();
      const nome = String(ev?.nome || ev?.colaborador || mat || "").trim();
      const key = `${mat}|${nome}`;
      if (!key.trim()) return;
      const row = map.get(key) || {
        mat,
        nome,
        cargo: ev?.cargo || ev?.cargo_desc || "",
        filial: ev?.filial || "",
        ocorrencias: 0,
        minutos: 0,
        eventos: new Map(),
        dias: new Set(),
      };
      row.ocorrencias += 1;
      row.minutos += Math.round((Number(ev?.horas) || 0) * 60);
      if (date) row.dias.add(date);
      const eventName = String(ev?.evento || ev?.descricao || "Ausente").trim() || "Ausente";
      row.eventos.set(eventName, (row.eventos.get(eventName) || 0) + 1);
      map.set(key, row);
    });
  });

  return Array.from(map.values())
    .map((row) => ({
      ...row,
      dias: Array.from(row.dias).sort(),
      eventos: Array.from(row.eventos.entries())
        .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0], "pt-BR"))
        .map(([name, count]) => `${name} (${count})`)
        .join(", "),
    }))
    .sort((a, b) => b.ocorrencias - a.ocorrencias || a.nome.localeCompare(b.nome, "pt-BR"));
}

export function sortAbonosRows(rows, col = "pendentes", dir = "desc") {
  const sign = dir === "asc" ? 1 : -1;
  const list = Array.isArray(rows) ? [...rows] : [];
  list.sort((a, b) => {
    if (col === "dept") {
      return sign * String(a.dept || "").localeCompare(String(b.dept || ""), "pt-BR");
    }
    const va = Number(a[col]) || 0;
    const vb = Number(b[col]) || 0;
    if (va !== vb) return sign * (va - vb);
    return String(a.dept || "").localeCompare(String(b.dept || ""), "pt-BR");
  });
  return list;
}
