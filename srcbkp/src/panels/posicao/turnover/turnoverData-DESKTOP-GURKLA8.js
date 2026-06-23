const PB_KPI_TURNOVER_KEY = "pos_kpi_turnover_v1";
const TURNOVER_PERIOD_KEY = "pos_kpi_turnover_period_v1";

export const TURNOVER_ROW_KEYS = Object.freeze({
  desligados: "Desligados",
  admitidos: "Admitidos",
  total: "Total de Colaboradores",
  horistas: "Horistas",
  mensalistas: "Mensalistas",
  estagiarios: "Estagiarios",
});

export const loadKpiTurnover = () => {
  try {
    if (typeof window === "undefined") return null;
    const raw = window.localStorage.getItem(PB_KPI_TURNOVER_KEY);
    const parsed = raw ? JSON.parse(raw) : null;
    return parsed && typeof parsed === "object" ? parsed : null;
  } catch {
    return null;
  }
};

export const saveKpiTurnover = (data) => {
  try {
    if (typeof window === "undefined") return;
    window.localStorage.setItem(PB_KPI_TURNOVER_KEY, JSON.stringify(data || null));
    window.dispatchEvent(new CustomEvent("pos:turnover-updated", { detail: data || null }));
  } catch (error) {
    const wrapped = new Error(
      "Nao foi possivel salvar o Turnover no armazenamento local. Reduza o arquivo ou libere espaco do navegador.",
    );
    wrapped.cause = error;
    throw wrapped;
  }
};

export const loadTurnoverPeriod = () => {
  try {
    if (typeof window === "undefined") return null;
    const raw = window.localStorage.getItem(TURNOVER_PERIOD_KEY);
    const parsed = raw ? JSON.parse(raw) : null;
    if (!parsed || typeof parsed !== "object") return null;
    return {
      from: String(parsed.from || ""),
      to: String(parsed.to || ""),
    };
  } catch {
    return null;
  }
};

export const saveTurnoverPeriod = ({ from = "", to = "" } = {}) => {
  try {
    if (typeof window === "undefined") return;
    window.localStorage.setItem(TURNOVER_PERIOD_KEY, JSON.stringify({ from, to }));
  } catch {
    // Period filters are convenience state; ignore storage failures.
  }
};

const parsePtNumber = (v) => {
  if (v == null) return 0;
  const s = String(v).trim();
  if (!s) return 0;
  const norm = s.replace(/\./g, "").replace(",", ".").replace(/\s+/g, "");
  const n = Number(norm);
  return Number.isFinite(n) ? n : 0;
};

function toMonthLabel(value) {
  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    return `${String(value.getMonth() + 1).padStart(2, "0")}/${value.getFullYear()}`;
  }
  const raw = String(value || "").trim();
  const br = raw.match(/^(\d{1,2})\/(\d{4})$/);
  if (br) return `${br[1].padStart(2, "0")}/${br[2]}`;
  const iso = raw.match(/^(\d{4})-(\d{1,2})(?:-\d{1,2})?/);
  if (iso) return `${iso[2].padStart(2, "0")}/${iso[1]}`;
  return "";
}

export const normalizeTurnoverLabel = (value) =>
  String(value || "")
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();

export function canonicalTurnoverLabel(value) {
  const key = normalizeTurnoverLabel(value);
  if (!key) return "";
  if (/^desligad/.test(key) || /demitid/.test(key) || /saida/.test(key)) {
    return TURNOVER_ROW_KEYS.desligados;
  }
  if (/^admitid/.test(key) || /admiss/.test(key) || /entrada/.test(key)) {
    return TURNOVER_ROW_KEYS.admitidos;
  }
  if (/total/.test(key) && /(colaborador|funcionario|empregado)/.test(key)) {
    return TURNOVER_ROW_KEYS.total;
  }
  if (/^horista/.test(key)) return TURNOVER_ROW_KEYS.horistas;
  if (/^mensalista/.test(key)) return TURNOVER_ROW_KEYS.mensalistas;
  if (/^estagiari/.test(key) || /^aprendiz/.test(key)) return TURNOVER_ROW_KEYS.estagiarios;
  return String(value || "").trim();
}

function parseDelimitedLine(line, delim) {
  const out = [];
  let cur = "";
  let quoted = false;
  const text = String(line || "");
  for (let i = 0; i < text.length; i += 1) {
    const ch = text[i];
    if (ch === '"') {
      if (quoted && text[i + 1] === '"') {
        cur += '"';
        i += 1;
      } else {
        quoted = !quoted;
      }
      continue;
    }
    if (ch === delim && !quoted) {
      out.push(cur);
      cur = "";
      continue;
    }
    cur += ch;
  }
  out.push(cur);
  return out.map((value) => String(value || "").trim());
}

export const parseTurnoverCsv = (csvText) => {
  const text = String(csvText || "").replace(/^\uFEFF/, "");
  const lines = text
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);
  if (!lines.length) return null;

  const delim = lines[0].includes(";") ? ";" : ",";
  const header = parseDelimitedLine(lines[0], delim);
  const months = header.slice(1).map(toMonthLabel).filter(Boolean);
  if (!months.length) return null;

  const rows = {};
  for (let i = 1; i < lines.length; i += 1) {
    const parts = parseDelimitedLine(lines[i], delim);
    const rawKey = String(parts[0] || "").trim();
    const key = canonicalTurnoverLabel(rawKey);
    if (!key) continue;
    rows[key] = months.map((_, idx) => parsePtNumber(parts[idx + 1]));
  }

  return {
    months,
    rows,
    importedAt: new Date().toISOString(),
  };
};

export function parseTurnoverAoa(aoa) {
  const rowsAoa = Array.isArray(aoa)
    ? aoa.filter((row) => Array.isArray(row) && row.some((value) => value != null && value !== ""))
    : [];
  if (!rowsAoa.length) return null;

  const headerIndex = rowsAoa.findIndex((row) => row.slice(1).some((value) => toMonthLabel(value)));
  if (headerIndex < 0) return null;

  const header = rowsAoa[headerIndex];
  const months = header.slice(1).map(toMonthLabel).filter(Boolean);
  if (!months.length) return null;

  const rows = {};
  rowsAoa.slice(headerIndex + 1).forEach((rawRow) => {
    const rawKey = String(rawRow[0] || "").trim();
    const key = canonicalTurnoverLabel(rawKey);
    if (!key) return;
    rows[key] = months.map((_, idx) => parsePtNumber(rawRow[idx + 1]));
  });

  return {
    months,
    rows,
    importedAt: new Date().toISOString(),
  };
}

export const ymToMmYyyy = (ym) => {
  const s = String(ym || "").trim();
  const m = s.match(/^(\d{4})-(\d{2})$/);
  if (!m) return "";
  return `${m[2]}/${m[1]}`;
};

export const mmYyyyToYm = (mmYyyy) => {
  const s = String(mmYyyy || "").trim();
  const m = s.match(/^(\d{2})\/(\d{4})$/);
  if (!m) return "";
  return `${m[2]}-${m[1]}`;
};

export const monthKeyToIndex = (k) => {
  const s = String(k || "").trim();
  const m = s.match(/^(\d{2})\/(\d{4})$/);
  if (!m) return -1;
  const mm = parseInt(m[1], 10);
  const yy = parseInt(m[2], 10);
  if (!Number.isFinite(mm) || !Number.isFinite(yy)) return -1;
  return yy * 12 + (mm - 1);
};

export function getTurnoverSeries(turnover, label) {
  const rows = turnover?.rows;
  if (!rows || typeof rows !== "object") return [];
  const direct = rows[label];
  if (Array.isArray(direct)) return direct;
  const target = normalizeTurnoverLabel(canonicalTurnoverLabel(label));
  const match = Object.entries(rows).find(([key]) => normalizeTurnoverLabel(key) === target);
  return Array.isArray(match?.[1]) ? match[1] : [];
}

export function buildTurnoverView(turnover, { from = "", to = "", meta = null } = {}) {
  const t = turnover;
  if (!t || !Array.isArray(t.months) || !t.rows) return null;
  const months = t.months;
  const fromKey = ymToMmYyyy(from);
  const toKey = ymToMmYyyy(to);
  const fromIdx = fromKey ? monthKeyToIndex(fromKey) : -1;
  const toIdx = toKey ? monthKeyToIndex(toKey) : -1;

  const filteredMonths = months.filter((m) => {
    const mi = monthKeyToIndex(m);
    if (fromIdx >= 0 && mi < fromIdx) return false;
    if (toIdx >= 0 && mi > toIdx) return false;
    return true;
  });

  const deslig = getTurnoverSeries(t, TURNOVER_ROW_KEYS.desligados);
  const admit = getTurnoverSeries(t, TURNOVER_ROW_KEYS.admitidos);
  const total = getTurnoverSeries(t, TURNOVER_ROW_KEYS.total);
  const hor = getTurnoverSeries(t, TURNOVER_ROW_KEYS.horistas);
  const men = getTurnoverSeries(t, TURNOVER_ROW_KEYS.mensalistas);
  const est = getTurnoverSeries(t, TURNOVER_ROW_KEYS.estagiarios);

  const idxMap = new Map(months.map((m, i) => [m, i]));
  const at = (arr, m) => {
    const idx = idxMap.get(m);
    if (idx == null) return 0;
    return Number(arr?.[idx]) || 0;
  };

  const calcPct = (m) => {
    const d = at(deslig, m);
    const a = at(admit, m);
    const t0 = at(total, m);
    if (!t0) return null;
    const pct = ((d + a) / 2 / t0) * 100;
    return +pct.toFixed(3);
  };

  const rows = [
    { label: "Desligados", values: filteredMonths.map((m) => at(deslig, m)) },
    { label: "Admitidos", values: filteredMonths.map((m) => at(admit, m)) },
    { label: "Horistas", values: filteredMonths.map((m) => at(hor, m)) },
    { label: "Mensalistas", values: filteredMonths.map((m) => at(men, m)) },
    { label: "Estagiários", values: filteredMonths.map((m) => at(est, m)) },
    { label: "% Rotatividade", values: filteredMonths.map((m) => calcPct(m)) },
    { label: "Total de Colaboradores", values: filteredMonths.map((m) => at(total, m)) },
  ];

  const rotatividade = filteredMonths.map((m) => calcPct(m));
  const validRotatividade = rotatividade.filter((v) => Number.isFinite(Number(v)));
  const current = validRotatividade.length ? validRotatividade[validRotatividade.length - 1] : null;
  const previous = validRotatividade.length > 1 ? validRotatividade[validRotatividade.length - 2] : null;
  const metaPct = Number(meta);
  const hasMeta = Number.isFinite(metaPct) && metaPct >= 0;
  const maxRot = Math.max(
    1,
    hasMeta ? metaPct : 0,
    ...validRotatividade.map((v) => Math.abs(Number(v) || 0)),
  );
  const chart = filteredMonths.map((m, index) => ({
    label: m,
    value: rotatividade[index],
    height:
      rotatividade[index] == null
        ? 0
        : Math.max(8, Math.min(100, (Math.abs(Number(rotatividade[index]) || 0) / maxRot) * 100)),
  }));

  return {
    months: filteredMonths,
    rows,
    chart,
    current,
    previous,
    meta: hasMeta ? metaPct : null,
  };
}
