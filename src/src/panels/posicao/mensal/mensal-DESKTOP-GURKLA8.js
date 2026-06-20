export const PB_KPI_MENSAL_KEY = "pos_kpi_mensal_v1";

const normHeader = (value) =>
  String(value || "")
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "");

const parseTimeMin = (value) => {
  if (value == null || value === "") return 0;
  if (typeof value === "number" && Number.isFinite(value)) {
    if (Math.abs(value) > 0 && Math.abs(value) < 1) return Math.round(value * 24 * 60);
    return Math.round(value);
  }
  const raw = String(value).trim();
  if (!raw || raw === "-") return 0;
  const sign = raw.includes("-") ? -1 : 1;
  const s = raw.replace(/\s+/g, " ").replace(/[−–—]/g, "-").replace(/^\+/, "").replace(/^-/, "");
  const hm = s.match(/(\d{1,7})\s*:\s*(\d{1,2})/);
  if (hm) return sign * (Number(hm[1]) * 60 + Number(hm[2]));
  const verbose = s.match(/(\d{1,7})\s*h(?:oras?)?\s*(?:(\d{1,2})\s*m(?:in)?)?/i);
  if (verbose) return sign * (Number(verbose[1]) * 60 + Number(verbose[2] || 0));
  const n = Number(s.replace(/\./g, "").replace(",", "."));
  return Number.isFinite(n) ? sign * Math.round(n) : 0;
};

const isMonthHeader = (value) => /^\d{2}\/\d{4}$/.test(String(value || "").trim());

export function loadKpiMensal() {
  try {
    if (typeof window === "undefined") return null;
    const raw = window.localStorage.getItem(PB_KPI_MENSAL_KEY);
    const parsed = raw ? JSON.parse(raw) : null;
    return parsed && typeof parsed === "object" ? parsed : null;
  } catch {
    return null;
  }
}

export function saveKpiMensal(data) {
  try {
    if (typeof window === "undefined") return;
    if (!data) window.localStorage.removeItem(PB_KPI_MENSAL_KEY);
    else window.localStorage.setItem(PB_KPI_MENSAL_KEY, JSON.stringify(data));
    window.dispatchEvent(new CustomEvent("pos:mensal-updated", { detail: data || null }));
  } catch (error) {
    const wrapped = new Error(
      "Nao foi possivel salvar o Mensal no armazenamento local. Reduza o arquivo ou libere espaco do navegador.",
    );
    wrapped.cause = error;
    throw wrapped;
  }
}

export function parseMensalSheet(aoa, meta = {}) {
  const rowsAoa = Array.isArray(aoa) ? aoa.filter((row) => Array.isArray(row) && row.some((v) => v != null && v !== "")) : [];
  if (!rowsAoa.length) return null;

  const headerIndex = rowsAoa.findIndex((row) => {
    const headers = row.map((v) => String(v || "").trim());
    return headers.some((h) => normHeader(h) === "evento") && headers.some(isMonthHeader);
  });
  if (headerIndex < 0) return null;

  const headers = rowsAoa[headerIndex].map((v) => String(v || "").trim());
  const norm = headers.map(normHeader);
  const eventCol = norm.findIndex((h) => h === "evento");
  const totalCol = norm.findIndex((h) => h === "total");
  const monthCols = headers
    .map((label, index) => ({ label, index }))
    .filter((col) => isMonthHeader(col.label));
  if (eventCol < 0 || !monthCols.length) return null;

  const rows = [];
  for (const rawRow of rowsAoa.slice(headerIndex + 1)) {
    const event = String(rawRow[eventCol] || "").trim();
    if (!event) continue;
    const byMonth = {};
    monthCols.forEach((col) => {
      byMonth[col.label] = parseTimeMin(rawRow[col.index]);
    });
    const monthTotal = Object.values(byMonth).reduce((sum, value) => sum + (Number(value) || 0), 0);
    const total = totalCol >= 0 ? parseTimeMin(rawRow[totalCol]) : monthTotal;
    rows.push({ event, byMonth, total });
  }
  if (!rows.length) return null;

  const total = rows.reduce((sum, row) => sum + (Number(row.total) || 0), 0);
  return {
    rows,
    months: monthCols.map((col) => col.label),
    total,
    eventCount: rows.length,
    importedAt: new Date().toISOString(),
    fileName: meta.fileName || "",
  };
}
