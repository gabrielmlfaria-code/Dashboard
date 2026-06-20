import { Store } from "../../core/store.js";

export const POSICAO_LAYOUT_CARDS = Object.freeze([
  { id: "posicao", label: "Posicao do dia", defaultOrder: 10 },
  { id: "historico", label: "Absenteismo", defaultOrder: 20 },
  { id: "horasPeriodo", label: "Horas no periodo", defaultOrder: 30 },
  { id: "radarTrabalhista", label: "Radar Trabalhista", defaultOrder: 40 },
  { id: "auditoriaPonto", label: "Auditoria de Ponto", defaultOrder: 45 },
  { id: "bancoHoras", label: "Banco de Horas", defaultOrder: 50 },
  { id: "abonos", label: "Abonos", defaultOrder: 60 },
  { id: "mensal", label: "Mensal", defaultOrder: 70 },
  { id: "turnover", label: "Turnover", defaultOrder: 80 },
  { id: "saudePreventiva", label: "Saude preventiva", defaultOrder: 90 },
  { id: "nr1", label: "NR-1", defaultOrder: 100 },
]);

export const POSICAO_DASHBOARD_LAYOUT_KEY = "posicao_dashboard_layout_v1";

const DEFAULT_ORDER = Object.freeze(
  POSICAO_LAYOUT_CARDS.reduce((acc, card) => {
    acc[card.id] = card.defaultOrder;
    return acc;
  }, {}),
);

function uniqueIds(ids) {
  return Array.from(new Set((Array.isArray(ids) ? ids : []).map(String).filter(Boolean)));
}

export function normalizePosicaoDashboardLayout(value = {}) {
  const rawOrder = value && typeof value === "object" ? value.order : null;
  const order = { ...DEFAULT_ORDER };
  if (rawOrder && typeof rawOrder === "object") {
    for (const card of POSICAO_LAYOUT_CARDS) {
      const parsed = Number(rawOrder[card.id]);
      if (Number.isFinite(parsed)) order[card.id] = parsed;
    }
  }

  const knownIds = new Set(POSICAO_LAYOUT_CARDS.map((card) => card.id));
  const hidden = uniqueIds(value?.hidden).filter((id) => knownIds.has(id));
  const hasLegacyCustomValue = Boolean(
    value && typeof value === "object" && (value.order || hidden.length),
  );
  const mode = value?.mode === "custom" || (!value?.mode && hasLegacyCustomValue) ? "custom" : "default";

  return {
    version: 1,
    mode,
    order,
    hidden,
  };
}

export function loadPosicaoDashboardLayout() {
  return normalizePosicaoDashboardLayout(Store.get(POSICAO_DASHBOARD_LAYOUT_KEY, null));
}

export function savePosicaoDashboardLayout(layout) {
  const normalized = normalizePosicaoDashboardLayout({ ...layout, mode: layout?.mode || "custom" });
  Store.set(POSICAO_DASHBOARD_LAYOUT_KEY, normalized);
  return normalized;
}

export function resetPosicaoDashboardLayout() {
  Store.remove(POSICAO_DASHBOARD_LAYOUT_KEY);
  return normalizePosicaoDashboardLayout();
}

export function getPosicaoDashboardCardOrder(layout, id) {
  const normalized = normalizePosicaoDashboardLayout(layout);
  return normalized.order[id] ?? DEFAULT_ORDER[id] ?? 999;
}

export function isPosicaoDashboardCardHidden(layout, id) {
  return normalizePosicaoDashboardLayout(layout).hidden.includes(id);
}

export function buildLayoutEditorItems(layout, allowedIds = []) {
  const normalized = normalizePosicaoDashboardLayout(layout);
  const allowed = new Set(allowedIds);
  return POSICAO_LAYOUT_CARDS.filter((card) => allowed.has(card.id))
    .map((card) => ({
      ...card,
      order: normalized.order[card.id] ?? card.defaultOrder,
      enabled: !normalized.hidden.includes(card.id),
    }))
    .sort((a, b) => a.order - b.order || a.defaultOrder - b.defaultOrder);
}
