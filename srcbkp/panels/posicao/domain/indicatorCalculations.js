export function clampMinutes(value) {
  const n = Number(value);
  return Number.isFinite(n) ? Math.max(0, n) : 0;
}

export function calculateAbsenteeism({
  plannedMinutes = 0,
  unjustifiedAbsentMinutes = 0,
  justifiedAbsentMinutes = 0,
  metaPct = 5,
  precision = 1,
} = {}) {
  const planned = clampMinutes(plannedMinutes);
  const unjustified = clampMinutes(unjustifiedAbsentMinutes);
  const justified = clampMinutes(justifiedAbsentMinutes);
  const baseMinutes = unjustified + justified;
  const pct = planned > 0 ? (baseMinutes / planned) * 100 : 0;
  const rounded = Number(pct.toFixed(precision));
  const meta = Number(metaPct) || 0;

  return {
    formula: "(horas ausentes + horas justificadas) / horas planejadas * 100",
    plannedMinutes: planned,
    unjustifiedAbsentMinutes: unjustified,
    justifiedAbsentMinutes: justified,
    baseMinutes,
    pct: rounded,
    metaPct: meta,
    deviationPp: Number((rounded - meta).toFixed(precision)),
  };
}

export function calculateBankHours({
  previousBalanceMinutes = null,
  creditMinutes = 0,
  debitMinutes = 0,
  nextBalanceMinutes = null,
} = {}) {
  const previous =
    previousBalanceMinutes == null || Number.isNaN(Number(previousBalanceMinutes))
      ? null
      : Number(previousBalanceMinutes);
  const credit = Number(creditMinutes) || 0;
  const debit = Number(debitMinutes) || 0;
  const movement = credit + debit;
  const next =
    nextBalanceMinutes == null || Number.isNaN(Number(nextBalanceMinutes))
      ? previous == null
        ? movement
        : previous + movement
      : Number(nextBalanceMinutes);

  return {
    previousBalanceMinutes: previous,
    creditMinutes: credit,
    debitMinutes: debit,
    movementMinutes: movement,
    nextBalanceMinutes: next,
    isPositive: next >= 0,
  };
}

export function calculateMonthlyVariation(currentMinutes, previousMinutes) {
  const current = Number(currentMinutes) || 0;
  const previous = Number(previousMinutes) || 0;
  if (previous <= 0 && current <= 0) return null;
  if (previous <= 0 && current > 0) return "base baixa";
  return ((current - previous) / previous) * 100;
}

export function calculateTurnoverPct({ desligados = 0, admitidos = 0, totalColaboradores = 0 } = {}) {
  const total = Number(totalColaboradores) || 0;
  if (total <= 0) return 0;
  return (((Number(desligados) || 0) + (Number(admitidos) || 0)) / 2 / total) * 100;
}
