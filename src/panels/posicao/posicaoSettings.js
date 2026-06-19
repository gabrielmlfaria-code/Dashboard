export const ABS_META_LS_KEY = "pb_absenteismo_meta_pct_v1";
export const DEFAULT_ABSENTEISMO_META = 5;

export const TURNOVER_META_LS_KEY = "pb_turnover_meta_pct_v1";
export const DEFAULT_TURNOVER_META = 5;

export function loadAbsenteismoMeta() {
  try {
    const raw = localStorage.getItem(ABS_META_LS_KEY);
    if (raw == null || raw === "") return DEFAULT_ABSENTEISMO_META;
    const v = parseFloat(String(raw).replace(",", "."));
    if (!Number.isFinite(v) || v < 0 || v > 100) return DEFAULT_ABSENTEISMO_META;
    return v;
  } catch {
    return DEFAULT_ABSENTEISMO_META;
  }
}

export function saveAbsenteismoMeta(value) {
  const n = parseFloat(String(value ?? "").replace(",", "."));
  const v = Number.isFinite(n) ? Math.min(100, Math.max(0, n)) : DEFAULT_ABSENTEISMO_META;
  try {
    localStorage.setItem(ABS_META_LS_KEY, String(v));
  } catch {}
  if (typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent("pb-abs-meta-changed", { detail: v }));
  }
  return v;
}

export function loadTurnoverMeta() {
  try {
    const raw = localStorage.getItem(TURNOVER_META_LS_KEY);
    if (raw == null || raw === "") return DEFAULT_TURNOVER_META;
    const v = parseFloat(String(raw).replace(",", "."));
    if (!Number.isFinite(v) || v < 0 || v > 100) return DEFAULT_TURNOVER_META;
    return v;
  } catch {
    return DEFAULT_TURNOVER_META;
  }
}

export function saveTurnoverMeta(value) {
  const n = parseFloat(String(value ?? "").replace(",", "."));
  const v = Number.isFinite(n) ? Math.min(100, Math.max(0, n)) : DEFAULT_TURNOVER_META;
  try {
    localStorage.setItem(TURNOVER_META_LS_KEY, String(v));
  } catch {}
  if (typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent("pb-turnover-meta-changed", { detail: v }));
  }
  return v;
}

/** Normaliza mapa força prevista (legado: número → objeto). */
export function parseFpdMoney(raw) {
  if (raw == null || raw === "") return null;
  let s = String(raw).trim().replace(/[^\d,.-]/g, "");
  if (!s) return null;
  if (s.includes(",")) {
    s = s.replace(/\./g, "").replace(",", ".");
  } else if ((s.match(/\./g) || []).length === 1) {
    // decimal com ponto: 12.50
  } else {
    s = s.replace(/\./g, "");
  }
  const n = parseFloat(s);
  return Number.isFinite(n) && n > 0 ? n : null;
}

export function formatFpdMoneyDisplay(n) {
  if (n == null || !Number.isFinite(n) || n <= 0) return "";
  return `R$ ${n.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export function normalizeForcaPrevistaDeptoMap(raw) {
  if (!raw || typeof raw !== "object") return {};
  const out = {};
  for (const [depto, val] of Object.entries(raw)) {
    if (typeof val === "number" && Number.isFinite(val) && val > 0) {
      out[depto] = { prevista: val, custoHora: null, custoHExtra: null };
      continue;
    }
    if (val && typeof val === "object") {
      const prevista = Number(val.prevista ?? val.qtd);
      const row = {
        prevista: Number.isFinite(prevista) && prevista > 0 ? prevista : null,
        custoHora: parseFpdMoney(val.custoHora ?? val.custo_hora_medio),
        custoHExtra: parseFpdMoney(val.custoHExtra ?? val.custo_h_extra_medio),
      };
      if (row.prevista || row.custoHora != null || row.custoHExtra != null) out[depto] = row;
    }
  }
  return out;
}

export function getForcaPrevistaQty(entry) {
  if (typeof entry === "number") return Number.isFinite(entry) && entry > 0 ? entry : 0;
  const n = Number(entry?.prevista);
  return Number.isFinite(n) && n > 0 ? n : 0;
}

export function serializeForcaPrevistaDeptoMap(map) {
  const out = {};
  for (const [depto, entry] of Object.entries(normalizeForcaPrevistaDeptoMap(map))) {
    const row = {};
    if (entry.prevista > 0) row.prevista = entry.prevista;
    if (entry.custoHora != null) row.custoHora = entry.custoHora;
    if (entry.custoHExtra != null) row.custoHExtra = entry.custoHExtra;
    if (Object.keys(row).length) out[depto] = row;
  }
  return out;
}
