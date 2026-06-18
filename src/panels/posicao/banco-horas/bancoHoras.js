export const PB_KPI_BANCO_HORAS_KEY = "pos_kpi_banco_horas_v1";

const normHeader = (value) =>
  String(value || "")
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "");

export const parseBancoHorasMin = (value) => {
  if (value == null || value === "") return null;
  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    return value.getHours() * 60 + value.getMinutes();
  }
  if (typeof value === "number" && Number.isFinite(value)) {
    const abs = Math.abs(value);
    const sign = value < 0 ? -1 : 1;
    if (abs > 0 && abs < 1000) return sign * Math.round(abs * 24 * 60);
    return Math.round(value);
  }
  const raw = String(value).trim();
  if (!raw || raw === "-") return null;
  const sign = raw.includes("-") ? -1 : 1;
  const s = raw.replace(/\s+/g, " ").replace(/[−–—]/g, "-").replace(/^\+/, "").replace(/^-/, "");
  const hm = s.match(/(\d{1,6})\s*:\s*(\d{1,2})/);
  if (hm) return sign * (Number(hm[1]) * 60 + Number(hm[2]));
  const verbose = s.match(/(\d{1,6})\s*h(?:oras?)?\s*(?:(\d{1,2})\s*m(?:in)?)?/i);
  if (verbose) return sign * (Number(verbose[1]) * 60 + Number(verbose[2] || 0));
  const n = Number(s.replace(/\./g, "").replace(",", "."));
  return Number.isFinite(n) ? sign * Math.round(n) : null;
};

/** Converte data de célula Excel (serial, Date ou texto BR) para ISO YYYY-MM-DD. */
export const parseBancoHorasDate = (value) => {
  if (value == null || value === "") return "";
  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    return `${value.getFullYear()}-${String(value.getMonth() + 1).padStart(2, "0")}-${String(value.getDate()).padStart(2, "0")}`;
  }
  if (typeof value === "number" && Number.isFinite(value) && value >= 1 && value < 100000) {
    const utc = Math.round((value - 25569) * 86400 * 1000);
    const d = new Date(utc);
    if (!Number.isNaN(d.getTime())) {
      return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}-${String(d.getUTCDate()).padStart(2, "0")}`;
    }
  }
  const s = String(value).trim();
  let m = s.match(/^(\d{4})-(\d{2})-(\d{2})(?:[tT\s].*)?$/);
  if (m) return `${m[1]}-${m[2]}-${m[3]}`;
  m = s.match(/^(\d{1,2})[\/.-](\d{1,2})[\/.-](\d{2}|\d{4})(?:\s+.*)?$/);
  if (m) {
    const y = m[3].length === 2 ? `20${m[3]}` : m[3];
    return `${y}-${m[2].padStart(2, "0")}-${m[1].padStart(2, "0")}`;
  }
  return "";
};

export const filterBancoHorasRowsByPeriod = (rows, periodo = null) => {
  const list = Array.isArray(rows) ? rows : [];
  const de = parseBancoHorasDate(periodo?.de);
  const ate = parseBancoHorasDate(periodo?.ate);
  if (!de && !ate) return list;

  return list.filter((row) => {
    const inicio = parseBancoHorasDate(row?.periodoInicial || row?.inicio || row?.data);
    const fim = parseBancoHorasDate(row?.periodoFinal || row?.termino || row?.data) || inicio;
    if (!inicio && !fim) return true;
    if (ate && inicio && inicio > ate) return false;
    if (de && fim && fim < de) return false;
    return true;
  });
};

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

const findPeriodoFinalCol = (headers) => {
  const explicit = findColSmart(
    headers,
    [/^periodofinal$/, /^perodofinal$/, /^fim$/, /^datafim$/, /^periodofim$/],
    ["periodo final", "período final", "data fim", "fim periodo"],
  );
  if (explicit >= 0) return explicit;
  const periodoIdx = findColSmart(headers, [/^periodo$/], ["periodo", "período"]);
  const inicioIdx = findColSmart(
    headers,
    [/^periodoinicial$/, /^perodoinicial$/, /^inicio$/, /^datainicio$/, /^periodoinicio$/],
    ["periodo inicial", "período inicial", "data inicio", "inicio"],
  );
  if (periodoIdx >= 0 && periodoIdx !== inicioIdx) return periodoIdx;
  return -1;
};

const BH_COLUMN_CHECKS = [
  {
    key: "saldoAnterior",
    label: "Saldo Anterior",
    patterns: [/^saldoanterior$/, /^saldoantes$/, /^saldoant$/, /^saldoinicial$/, /^anterior$/],
    loose: ["saldo anterior", "saldo inicial", "saldo ant"],
  },
  {
    key: "credito",
    label: "Crédito",
    patterns: [/^credito$/, /^creditos$/, /^crdito$/, /^crditos$/, /^creditobh$/, /^bancohorascredito$/, /^horascredito$/],
    loose: ["credito", "crédito", "creditos", "horas credito", "credito bh"],
  },
  {
    key: "debito",
    label: "Débito",
    patterns: [/^debito$/, /^debitos$/, /^dbito$/, /^dbitos$/, /^debitobh$/, /^bancohorasdebito$/, /^horasdebito$/],
    loose: ["debito", "débito", "debitos", "horas debito", "debito bh"],
  },
  {
    key: "saldoProximo",
    label: "Saldo Próximo",
    patterns: [
      /^saldoproximo$/,
      /^saldoprximo$/,
      /^saldoprox$/,
      /^saldofinal$/,
      /^saldoatual$/,
      /^proximosaldo$/,
      /^saldoseguinte$/,
    ],
    loose: ["saldo proximo", "saldo próximo", "saldo final", "saldo atual", "proximo saldo"],
  },
];

const isFilialSummaryRow = (matricula, nome) =>
  /^filial\s*:/i.test(matricula) || /^filial\s*:/i.test(nome);

const extractFilialLabel = (matricula, nome) => {
  const raw = String(matricula || nome || "").trim();
  const m = raw.match(/^filial\s*:\s*(.+)$/i);
  return m ? m[1].trim() : "";
};

const rowMatricula = (row) =>
  String(row?.matricula || row?.mat || row?.Matricula || row?.codigo || row?.cod || "").trim();

const rowNome = (row) =>
  String(row?.nome || row?.name || row?.colaborador || row?.funcionario || "").trim();

function resolveBhColumnIndexes(headers) {
  const idx = {
    filial: findColSmart(headers, [/^filial$/, /^empresa$/], ["filial", "empresa"]),
    departamento: findColSmart(
      headers,
      [/^departamento$/, /^departamentonome$/, /^depto$/, /^setor$/, /^lotacao$/, /^centrodecusto$/],
      ["departamento", "depto", "setor", "lotacao", "centro de custo"],
    ),
    matricula: findColSmart(
      headers,
      [/^matricula$/, /^mat$/, /^chapa$/, /^cadastro$/, /^codigo$/, /^colaboradormatricula$/],
      ["matricula", "matrícula", "mat", "chapa", "cadastro"],
    ),
    nome: findColSmart(
      headers,
      [/^nome$/, /^colaborador$/, /^funcionario$/, /^colaboradornome$/],
      ["nome", "colaborador", "funcionario", "empregado"],
    ),
    cargo: findColSmart(headers, [/^cargo$/, /^funcao$/], ["cargo", "função", "funcao"]),
    atividade: findColSmart(headers, [/^atividade$/, /^situacao$/], ["atividade", "situacao", "situação"]),
    periodoInicial: findColSmart(
      headers,
      [/^periodoinicial$/, /^perodoinicial$/, /^inicio$/, /^datainicio$/, /^periodoinicio$/],
      ["periodo inicial", "período inicial", "data inicio", "inicio"],
    ),
    periodoFinal: findPeriodoFinalCol(headers),
    saldoAnterior: -1,
    credito: -1,
    debito: -1,
    saldoProximo: -1,
    horasPagas: findColSmart(
      headers,
      [/^horaspagas$/, /^horaspaga$/, /^hrspagas$/],
      ["horas pagas", "horas paga", "hrs pagas"],
    ),
  };
  for (const spec of BH_COLUMN_CHECKS) {
    idx[spec.key] = findColSmart(headers, spec.patterns, spec.loose);
  }
  if (idx.periodoInicial < 0) {
    const periodoOnly = findColSmart(headers, [/^periodo$/, /^competencia$/], ["periodo", "período", "competencia"]);
    if (periodoOnly >= 0 && idx.periodoFinal < 0) idx.periodoInicial = periodoOnly;
  }
  return idx;
}

function missingBhColumns(headers) {
  const idx = resolveBhColumnIndexes(headers);
  return BH_COLUMN_CHECKS.filter((spec) => idx[spec.key] < 0).map((spec) => spec.label);
}

function headersHaveBhColumns(headers) {
  return missingBhColumns(headers).length === 0;
}

function mergeHeaderRows(rowA, rowB) {
  return mergeHeaderBlock([rowA, rowB], 0, 2);
}

/** Une até N linhas de cabeçalho (células mescladas / layout em duas linhas no Excel). */
function mergeHeaderBlock(rows, start = 0, span = 1) {
  const slice = (Array.isArray(rows) ? rows : []).slice(start, start + span);
  const maxLen = Math.max(0, ...slice.map((row) => (Array.isArray(row) ? row.length : 0)));
  const out = [];
  for (let c = 0; c < maxLen; c++) {
    let val = null;
    for (const row of slice) {
      const v = row?.[c];
      if (v != null && String(v).trim() !== "") {
        val = v;
        break;
      }
    }
    out.push(val);
  }
  return out;
}

function fixWorksheetRef(ws, XLSX) {
  let maxR = 0;
  let maxC = 0;
  for (const key of Object.keys(ws || {})) {
    if (key[0] === "!") continue;
    const addr = XLSX.utils.decode_cell(key);
    if (addr.r > maxR) maxR = addr.r;
    if (addr.c > maxC) maxC = addr.c;
  }
  ws["!ref"] = XLSX.utils.encode_range({ s: { r: 0, c: 0 }, e: { r: maxR, c: maxC } });
}

/** Lê a planilha pela faixa completa (!ref), preservando colunas vazias no meio da linha. */
export function readWorksheetAoa(ws, XLSX) {
  if (!ws || !XLSX) return [];
  fixWorksheetRef(ws, XLSX);
  const range = XLSX.utils.decode_range(ws["!ref"] || "A1:A1");
  const out = [];
  for (let r = range.s.r; r <= range.e.r; r++) {
    const row = [];
    let hasValue = false;
    for (let c = range.s.c; c <= range.e.c; c++) {
      const cell = ws[XLSX.utils.encode_cell({ r, c })];
      const v = cell != null && Object.prototype.hasOwnProperty.call(cell, "v") ? cell.v : null;
      row.push(v);
      if (v != null && v !== "") hasValue = true;
    }
    if (hasValue) out.push(row);
  }
  return out;
}

function findBhHeaderBlock(rowsAoa) {
  let bestPartial = { headerIndex: -1, missingCols: BH_COLUMN_CHECKS.map((c) => c.label), mergedRow: [] };
  for (let i = 0; i < Math.min(rowsAoa.length, 40); i++) {
    for (let span = 1; span <= 4; span++) {
      if (i + span > rowsAoa.length) break;
      const mergedRow = mergeHeaderBlock(rowsAoa, i, span);
      const headers = mergedRow.map(normHeader);
      const missing = missingBhColumns(headers);
      if (!missing.length) {
        return { headerIndex: i, headerSpan: span, mergedRow, headers, missingCols: [] };
      }
      if (bestPartial.headerIndex < 0 || missing.length < bestPartial.missingCols.length) {
        bestPartial = { headerIndex: i, headerSpan: span, mergedRow, missingCols: missing };
      }
    }
  }
  return { ...bestPartial, headers: (bestPartial.mergedRow || []).map(normHeader) };
}

/** Diagnóstico de importação — útil para toast e debug. */
export function diagnoseBancoHorasSheet(aoa) {
  const rowsAoa = Array.isArray(aoa) ? aoa.filter((row) => Array.isArray(row) && row.some((v) => v != null && v !== "")) : [];
  if (!rowsAoa.length) {
    return {
      ok: false,
      headerIndex: -1,
      missingCols: BH_COLUMN_CHECKS.map((c) => c.label),
      rowCount: 0,
      issues: ["Planilha vazia ou sem linhas legíveis."],
      sampleHeaders: [],
    };
  }

  const found = findBhHeaderBlock(rowsAoa);
  const headerIndex = found.headerIndex;
  const missingCols = found.missingCols || [];
  const issues = [];

  if (headerIndex < 0 || missingCols.length) {
    issues.push("Nenhuma linha com as 4 colunas obrigatórias: Saldo Anterior, Crédito, Débito e Saldo Próximo.");
    if (headerIndex >= 0 && missingCols.length) {
      issues.push(`Colunas não encontradas (linha ${headerIndex + 1}${found.headerSpan > 1 ? `–${headerIndex + found.headerSpan}` : ""}): ${missingCols.join(", ")}.`);
    }
  } else if (found.headerSpan > 1) {
    issues.push(`Cabeçalho reconhecido em ${found.headerSpan} linhas (layout Excel mesclado).`);
  }

  const sampleHeaders = (found.mergedRow || rowsAoa[0] || [])
    .map((h) => String(h ?? "").trim())
    .filter(Boolean)
    .slice(0, 20);

  return {
    ok: headerIndex >= 0 && !missingCols.length,
    headerIndex,
    headerSpan: found.headerSpan || 1,
    mergedHeaderRow: found.mergedRow || [],
    missingCols,
    rowCount: rowsAoa.length,
    issues,
    sampleHeaders,
  };
}

function computeBhTotals(rows) {
  const totals = rows.reduce(
    (acc, row) => {
      acc.saldoAnterior += row.saldoAnterior || 0;
      if (row.hasSaldoAnterior) acc.hasSaldoAnterior = true;
      acc.credito += row.credito || 0;
      acc.debito += row.debito || 0;
      if (row.saldoProximo != null) {
        acc.saldoProximo += row.saldoProximo;
        acc.hasSaldoProximo = true;
      }
      return acc;
    },
    { saldoAnterior: 0, credito: 0, debito: 0, saldoProximo: 0, hasSaldoAnterior: false, hasSaldoProximo: false },
  );
  if (!totals.hasSaldoAnterior && totals.hasSaldoProximo) {
    totals.saldoAnterior = totals.saldoProximo - totals.credito + totals.debito;
    totals.hasSaldoAnterior = true;
  }
  if (!totals.hasSaldoProximo) totals.saldoProximo = totals.saldoAnterior + totals.credito - totals.debito;
  return totals;
}

/** Monta linhas de colaborador a partir de eventos do histórico (importação de tabela). */
export function buildBancoHorasRowsFromHistEvents(histRows) {
  const map = new Map();
  for (const day of Array.isArray(histRows) ? histRows : []) {
    for (const ev of day?._events || []) {
      const credito = ev?.creditoBH ?? ev?.credito;
      const debito = ev?.debitoBH ?? ev?.debito;
      const saldoProximo = ev?.saldoProximoBH ?? ev?.saldoProximo;
      const saldoAnterior = ev?.saldoAnteriorBH ?? ev?.saldoAnterior;
      const hasBh =
        credito != null || debito != null || saldoProximo != null || saldoAnterior != null;
      if (!hasBh) continue;

      const matricula = String(ev?.mat || ev?.matricula || "").trim();
      const nome = String(ev?.nome || "").trim();
      const key = matricula || nome;
      if (!key) continue;

      map.set(key, {
        filial: ev?.filial || "",
        departamento: ev?.depto || ev?.departamento || "",
        depto: ev?.depto || "",
        departamentoNome: ev?.depto || "",
        matricula: matricula || key,
        nome: nome || matricula,
        cargo: ev?.cargo || "",
        atividade: ev?.atividade || ev?.situacaoDesc || "",
        periodoInicial: ev?.inicio || ev?.data || "",
        periodoFinal: ev?.termino || ev?.data || "",
        saldoAnterior: saldoAnterior != null ? Number(saldoAnterior) || 0 : 0,
        hasSaldoAnterior: saldoAnterior != null || ev?.hasSaldoAnterior === true,
        credito: Math.max(0, Number(credito || 0)),
        debito: Math.abs(Number(debito || 0)),
        horasPagas: Math.max(0, Number(ev?.horasPagasBH ?? ev?.horasPagas ?? 0)),
        saldoProximo: saldoProximo != null ? Number(saldoProximo) : null,
      });
    }
  }
  return [...map.values()];
}

export function packBancoHorasStorage(rows, meta = {}) {
  const list = Array.isArray(rows) ? rows : [];
  const colaboradores = new Set(list.map((row) => row.matricula || row.nome).filter(Boolean)).size;
  return {
    rows: list,
    totals: computeBhTotals(list),
    count: list.length,
    colaboradores,
    importedAt: new Date().toISOString(),
    fileName: meta.fileName || "",
    sheetName: meta.sheetName || "",
    diagnosis: meta.diagnosis || null,
  };
}

/** Reaplica parser de datas e remove linhas de resumo ao ler dados antigos do storage. */
export function normalizeBancoHorasRows(rows) {
  if (!Array.isArray(rows)) return [];
  return rows
    .filter((row) => {
      const mat = rowMatricula(row);
      const nome = rowNome(row);
      if (!mat && !nome) return false;
      return !isFilialSummaryRow(mat, nome);
    })
    .map((row) => ({
      ...row,
      matricula: rowMatricula(row),
      nome: rowNome(row),
      periodoInicial: parseBancoHorasDate(row?.periodoInicial) || row?.periodoInicial || "",
      periodoFinal: parseBancoHorasDate(row?.periodoFinal) || row?.periodoFinal || "",
      credito: Math.max(0, Number(row?.credito || 0)),
      debito: Math.abs(Number(row?.debito || 0)),
      horasPagas: Math.max(0, Number(row?.horasPagas || 0)),
      saldoAnterior: row?.saldoAnterior != null ? Number(row.saldoAnterior) || 0 : 0,
      saldoProximo: row?.saldoProximo != null ? Number(row.saldoProximo) : null,
      hasSaldoAnterior: row?.hasSaldoAnterior !== false,
    }));
}

/** Linhas de colaboradores: storage → histórico (fallback). */
export function getBancoHorasImportRows(stored = null, histRows = null) {
  if (stored && typeof stored === "object" && Array.isArray(stored.rows)) {
    const direct = normalizeBancoHorasRows(stored.rows);
    if (direct.length) return direct;
  }
  const loaded = loadKpiBancoHoras();
  const fromStorage = normalizeBancoHorasRows(loaded?.rows);
  if (fromStorage.length) return fromStorage;
  return buildBancoHorasRowsFromHistEvents(histRows);
}

export function loadKpiBancoHoras() {
  try {
    if (typeof window === "undefined") return null;
    const raw = window.localStorage.getItem(PB_KPI_BANCO_HORAS_KEY);
    const parsed = raw ? JSON.parse(raw) : null;
    if (!parsed || typeof parsed !== "object") return null;
    const rows = normalizeBancoHorasRows(parsed.rows);
    if (!rows.length) return { ...parsed, rows: [], count: 0, colaboradores: 0 };
    const colaboradores = new Set(rows.map((row) => row.matricula || row.nome).filter(Boolean)).size;
    return { ...parsed, rows, count: rows.length, colaboradores };
  } catch {
    return null;
  }
}

export function saveKpiBancoHoras(data) {
  try {
    if (typeof window === "undefined") return;
    if (!data) window.localStorage.removeItem(PB_KPI_BANCO_HORAS_KEY);
    else window.localStorage.setItem(PB_KPI_BANCO_HORAS_KEY, JSON.stringify(data));
    window.dispatchEvent(new CustomEvent("pos:banco-horas-updated", { detail: data || null }));
  } catch {
    // ignore
  }
}

export function parseBancoHorasSheet(aoa, meta = {}) {
  const diagnosis = diagnoseBancoHorasSheet(aoa);
  const rowsAoa = Array.isArray(aoa) ? aoa.filter((row) => Array.isArray(row) && row.some((v) => v != null && v !== "")) : [];
  if (!diagnosis.ok || diagnosis.headerIndex < 0) return null;

  const headerSpan = Math.max(1, Number(diagnosis.headerSpan) || 1);
  const headerRowValues =
    Array.isArray(diagnosis.mergedHeaderRow) && diagnosis.mergedHeaderRow.length
      ? diagnosis.mergedHeaderRow
      : mergeHeaderBlock(rowsAoa, diagnosis.headerIndex, headerSpan);
  const headers = headerRowValues.map(normHeader);
  if (!headersHaveBhColumns(headers)) return null;

  const idx = resolveBhColumnIndexes(headers);
  const dataStart = diagnosis.headerIndex + headerSpan;

  const rows = [];
  let currentFilial = "";
  for (const rawRow of rowsAoa.slice(dataStart)) {
    const matricula = idx.matricula >= 0 ? String(rawRow[idx.matricula] ?? "").trim() : "";
    const nome = idx.nome >= 0 ? String(rawRow[idx.nome] ?? "").trim() : "";

    if (isFilialSummaryRow(matricula, nome)) {
      const filialFromRow = extractFilialLabel(matricula, nome);
      if (filialFromRow) currentFilial = filialFromRow;
      continue;
    }

    const saldoAnteriorRaw = parseBancoHorasMin(rawRow[idx.saldoAnterior]);
    const credito = parseBancoHorasMin(rawRow[idx.credito]);
    const debito = parseBancoHorasMin(rawRow[idx.debito]);
    const saldoProximo = parseBancoHorasMin(rawRow[idx.saldoProximo]);
    const saldoAnterior =
      saldoAnteriorRaw != null
        ? saldoAnteriorRaw
        : saldoProximo != null && (credito != null || debito != null)
          ? saldoProximo - Math.max(0, credito || 0) + Math.abs(debito || 0)
          : null;
    const hasNumbers = [saldoAnterior, credito, debito, saldoProximo].some((v) => v != null);
    if (!hasNumbers) continue;
    if (!matricula && !nome) continue;

    const departamento = idx.departamento >= 0 ? String(rawRow[idx.departamento] || "").trim() : "";
    const filialCol = idx.filial >= 0 ? String(rawRow[idx.filial] || "").trim() : "";
    const periodoInicialRaw = idx.periodoInicial >= 0 ? rawRow[idx.periodoInicial] : "";
    const periodoFinalRaw = idx.periodoFinal >= 0 ? rawRow[idx.periodoFinal] : "";
    const horasPagasRaw = idx.horasPagas >= 0 ? rawRow[idx.horasPagas] : null;
    rows.push({
      filial: filialCol || currentFilial,
      departamento,
      depto: departamento,
      departamentoNome: departamento,
      matricula,
      nome,
      cargo: idx.cargo >= 0 ? String(rawRow[idx.cargo] || "").trim() : "",
      atividade: idx.atividade >= 0 ? String(rawRow[idx.atividade] || "").trim() : "",
      periodoInicial: parseBancoHorasDate(periodoInicialRaw) || periodoInicialRaw,
      periodoFinal: parseBancoHorasDate(periodoFinalRaw) || periodoFinalRaw,
      saldoAnterior: saldoAnterior || 0,
      hasSaldoAnterior: saldoAnterior != null,
      credito: Math.max(0, credito || 0),
      debito: Math.abs(debito || 0),
      horasPagas: Math.max(0, parseBancoHorasMin(horasPagasRaw) || 0),
      saldoProximo: saldoProximo ?? null,
    });
  }

  if (!rows.length) return null;
  return packBancoHorasStorage(rows, { ...meta, diagnosis });
}

export function formatBancoHorasDiagnosis(diagnosis) {
  if (!diagnosis) return "";
  if (diagnosis.ok) return "";
  const parts = [...(diagnosis.issues || [])];
  if (diagnosis.missingCols?.length) {
    parts.push(`Faltando: ${diagnosis.missingCols.join(", ")}`);
  }
  if (diagnosis.sampleHeaders?.length) {
    parts.push(`Cabeçalhos lidos: ${diagnosis.sampleHeaders.slice(0, 8).join(" · ")}`);
  }
  parts.push(
    "Use o botão «Importar Banco de Horas» com colunas Matrícula, Nome, Período Inicial, Período, Saldo Anterior, Crédito, Débito e Saldo Próximo.",
  );
  return parts.filter(Boolean).join(" — ");
}

const brDateLabel = (iso) => {
  const s = String(iso || "").trim();
  const m = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!m) return s;
  return `${m[3]}/${m[2]}/${m[1]}`;
};

/** Formata minutos como H:MM ou H h (totais grandes, ex. 728:56). */
export function fmtBancoHorasMinLabel(min) {
  const n = Math.round(Number(min) || 0);
  const sign = n < 0 ? "-" : "";
  const abs = Math.abs(n);
  const h = Math.floor(abs / 60);
  const m = abs % 60;
  if (h >= 100) {
    return m > 0 ? `${sign}${h} h ${String(m).padStart(2, "0")} min` : `${sign}${h} h`;
  }
  return `${sign}${h}:${String(m).padStart(2, "0")}`;
}

/** Resumo legível para toast após importação da Folha BH. */
export function formatBancoHorasImportSummary(parsed) {
  if (!parsed?.count) return "Nenhum colaborador reconhecido na planilha.";
  const rows = Array.isArray(parsed.rows) ? parsed.rows : [];
  const t = parsed.totals || {};
  const filiais = [...new Set(rows.map((r) => r.filial).filter(Boolean))];
  const first = rows[0] || {};
  let periodo = "";
  if (first.periodoInicial && first.periodoFinal) {
    periodo = `${brDateLabel(first.periodoInicial)} a ${brDateLabel(first.periodoFinal)}`;
  } else if (first.periodoInicial) {
    periodo = `início ${brDateLabel(first.periodoInicial)}`;
  }

  const head = [
    `${parsed.count.toLocaleString("pt-BR")} colaborador${parsed.count !== 1 ? "es" : ""}`,
    filiais.length === 1 ? `Filial ${filiais[0]}` : filiais.length > 1 ? `${filiais.length} filiais` : null,
    periodo ? `Período ${periodo}` : null,
  ].filter(Boolean);

  const foot = [
    t.hasSaldoProximo !== false && t.saldoProximo != null
      ? `saldo próximo ${fmtBancoHorasMinLabel(t.saldoProximo)}`
      : null,
    t.credito ? `crédito ${fmtBancoHorasMinLabel(t.credito)}` : null,
    t.debito ? `débito ${fmtBancoHorasMinLabel(t.debito)}` : null,
    t.hasSaldoAnterior && t.saldoAnterior ? `saldo anterior ${fmtBancoHorasMinLabel(t.saldoAnterior)}` : null,
  ].filter(Boolean);

  const file = parsed.fileName ? ` (${parsed.fileName})` : "";
  return `Banco de Horas importado${file}: ${head.join(" · ")}${foot.length ? ` — ${foot.join(" · ")}` : ""}`;
}
