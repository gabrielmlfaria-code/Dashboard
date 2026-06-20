const PB_KPI_TURNOVER_KEY = "pos_kpi_turnover_v1";
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
  } catch {
    // ignore
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

export const parseTurnoverCsv = (csvText) => {
  const text = String(csvText || "").replace(/^\uFEFF/, "");
  const lines = text
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);
  if (!lines.length) return null;

  const delim = lines[0].includes(";") ? ";" : ",";
  const header = lines[0].split(delim).map((s) => String(s || "").trim());
  const months = header.slice(1).filter(Boolean);
  if (!months.length) return null;

  const rows = {};
  for (let i = 1; i < lines.length; i++) {
    const parts = lines[i].split(delim);
    const key = String(parts[0] || "").trim();
    if (!key) continue;
    rows[key] = months.map((_, idx) => parsePtNumber(parts[idx + 1]));
  }

  return {
    months,
    rows,
    importedAt: new Date().toISOString(),
  };
};

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

