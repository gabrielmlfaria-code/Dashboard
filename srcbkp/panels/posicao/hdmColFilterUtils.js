export const HDM_FILTER_OPS = [
  { id: "contains", label: "Contém" },
  { id: "eq", label: "=" },
  { id: "gt", label: ">" },
  { id: "lt", label: "<" },
  { id: "gte", label: ">=" },
  { id: "lte", label: "<=" },
];

export const HDM_NUMERIC_FILTER_COLS = new Set([
  "plan",
  "pres",
  "ause",
  "just",
  "extr",
  "abs",
  "horas",
  "hrsPlan",
  "qtd_dias",
  "saldoAnteriorBH",
  "creditoBH",
  "debitoBH",
  "horasPagasBH",
  "saldoProximoBH",
]);

/** Aceita legado (Set) e formato { values, cond }. */
export function normalizeHdmColFilter(entry) {
  if (!entry) return { values: null, cond: null };
  if (entry instanceof Set) return { values: entry, cond: null };
  if (typeof entry === "object") {
    const values =
      entry.values instanceof Set ? entry.values : entry.values === undefined ? null : entry.values;
    const cond =
      entry.cond && String(entry.cond.value ?? "").trim()
        ? { op: entry.cond.op || "contains", value: String(entry.cond.value).trim() }
        : null;
    return { values: values instanceof Set ? values : null, cond };
  }
  return { values: null, cond: null };
}

export function isHdmColFilterActive(entry) {
  const { values, cond } = normalizeHdmColFilter(entry);
  return values instanceof Set || Boolean(cond?.value);
}

export function buildHdmColFilter(valuesDraft, condDraft) {
  const values = valuesDraft instanceof Set ? valuesDraft : null;
  const condVal = String(condDraft?.value ?? "").trim();
  const cond = condVal
    ? { op: condDraft?.op || "contains", value: condVal }
    : null;
  if (!values && !cond) return null;
  return { values, cond };
}

export function parseHdmFilterCompareValue(raw) {
  const s = String(raw ?? "").trim();
  if (!s) return { kind: "empty" };

  const hm = s.match(/^(\d{1,2}):(\d{2})$/);
  if (hm) return { kind: "number", n: parseInt(hm[1], 10) * 60 + parseInt(hm[2], 10) };

  const normalized = s.replace(/\./g, "").replace(",", ".");
  if (/^-?\d+(\.\d+)?$/.test(normalized)) {
    const n = Number(normalized);
    if (!Number.isNaN(n)) return { kind: "number", n };
  }

  return { kind: "text", t: s.toLowerCase() };
}

export function cellValueToCompareNumber(cellValue) {
  const parsed = parseHdmFilterCompareValue(cellValue);
  if (parsed.kind === "number") return parsed.n;
  const n = Number(String(cellValue ?? "").replace(",", "."));
  return Number.isNaN(n) ? null : n;
}

/**
 * @param {string} cellValue valor bruto da célula (getColFilterValue)
 * @param {string} col id da coluna
 * @param {string} op operador
 * @param {string} filterInput texto digitado pelo usuário
 * @param {(val: string, col: string) => string} getDisplay
 */
export function matchHdmFilterCondition(cellValue, col, op, filterInput, getDisplay) {
  const q = String(filterInput ?? "").trim();
  if (!q) return true;

  const display = typeof getDisplay === "function" ? getDisplay(cellValue, col) : String(cellValue ?? "");
  const rawText = String(cellValue ?? "");
  const haystack = `${display} ${rawText}`.toLowerCase();

  if (op === "contains") {
    return haystack.includes(q.toLowerCase());
  }

  const filterParsed = parseHdmFilterCompareValue(q);
  const cellNum = cellValueToCompareNumber(cellValue);
  const filterNum = filterParsed.kind === "number" ? filterParsed.n : cellValueToCompareNumber(q);
  const preferNumeric =
    HDM_NUMERIC_FILTER_COLS.has(col) ||
    (cellNum != null && filterNum != null && (filterParsed.kind === "number" || HDM_NUMERIC_FILTER_COLS.has(col)));

  if (preferNumeric && cellNum != null && filterNum != null) {
    switch (op) {
      case "eq":
        return cellNum === filterNum;
      case "gt":
        return cellNum > filterNum;
      case "lt":
        return cellNum < filterNum;
      case "gte":
        return cellNum >= filterNum;
      case "lte":
        return cellNum <= filterNum;
      default:
        return true;
    }
  }

  const left = rawText.toLowerCase();
  const right = q.toLowerCase();
  const cmp = left.localeCompare(right, "pt-BR", { numeric: true, sensitivity: "base" });
  switch (op) {
    case "eq":
      return left === right;
    case "gt":
      return cmp > 0;
    case "lt":
      return cmp < 0;
    case "gte":
      return cmp >= 0;
    case "lte":
      return cmp <= 0;
    default:
      return true;
  }
}

export function rowPassesHdmColFilter(cellValue, filterEntry, col, getDisplay) {
  const { values, cond } = normalizeHdmColFilter(filterEntry);
  if (values instanceof Set && !values.has(cellValue)) return false;
  if (cond && !matchHdmFilterCondition(cellValue, col, cond.op, cond.value, getDisplay)) {
    return false;
  }
  return true;
}
