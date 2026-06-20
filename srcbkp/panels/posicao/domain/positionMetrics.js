import { POSITION_CATEGORY_KEYS } from "./positionCategories.js";
import { getPositionGroupItems } from "./positionRows.js";

export function getGroupCount(group) {
  if (typeof group?.total === "number" && Number.isFinite(group.total)) return group.total;
  const items = getPositionGroupItems(group);
  if (items.length) return items.length;
  if (Array.isArray(group)) return group.length;
  if (typeof group === "number" && Number.isFinite(group)) return group;
  return 0;
}

export function summarizePositionDay(day) {
  const counts = POSITION_CATEGORY_KEYS.reduce((acc, key) => {
    acc[key] = getGroupCount(day?.[key]);
    return acc;
  }, {});

  const total =
    counts.presentes +
    counts.falta +
    counts.atraso +
    counts.folga +
    counts.ferias +
    counts.afastados +
    counts.ja_saiu +
    counts.entrada_prev +
    counts.nao_controla;

  return {
    ...counts,
    total,
    absRate: total > 0 ? +(((counts.falta + counts.atraso) / total) * 100).toFixed(2) : 0,
  };
}

export function buildPositionCalculationLedger({
  plannedMinutes = 0,
  workedMinutes = 0,
  absentMinutes = 0,
  justifiedMinutes = 0,
  metaPct = 5,
  periodLabel = "",
  source = "",
} = {}) {
  const plan = Math.max(0, Number(plannedMinutes) || 0);
  const worked = Math.max(0, Number(workedMinutes) || 0);
  const absent = Math.max(0, Number(absentMinutes) || 0);
  const justified = Math.max(0, Number(justifiedMinutes) || 0);
  const numerator = absent + justified;
  const absenteismPct = plan > 0 ? (numerator / plan) * 100 : 0;

  return {
    periodLabel,
    source,
    formula: "(horas ausentes + horas justificadas) / horas planejadas * 100",
    plannedMinutes: plan,
    workedMinutes: worked,
    absentMinutes: absent,
    justifiedMinutes: justified,
    numeratorMinutes: numerator,
    absenteismPct,
    metaPct: Number(metaPct) || 0,
    deviationPp: absenteismPct - (Number(metaPct) || 0),
  };
}
