import { POSITION_CATEGORY_KEYS } from "./positionCategories.js";
import { getPositionGroupItems } from "./positionRows.js";
import { calculateAbsenteeism } from "./indicatorCalculations.js";

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
  const calc = calculateAbsenteeism({
    plannedMinutes,
    unjustifiedAbsentMinutes: absentMinutes,
    justifiedAbsentMinutes: justifiedMinutes,
    metaPct,
    precision: 6,
  });
  const worked = Math.max(0, Number(workedMinutes) || 0);

  return {
    periodLabel,
    source,
    formula: calc.formula,
    plannedMinutes: calc.plannedMinutes,
    workedMinutes: worked,
    absentMinutes: calc.unjustifiedAbsentMinutes,
    justifiedMinutes: calc.justifiedAbsentMinutes,
    numeratorMinutes: calc.baseMinutes,
    absenteismPct: calc.pct,
    metaPct: calc.metaPct,
    deviationPp: calc.deviationPp,
  };
}
