import { calculateAbsenteeism, calculateBankHours } from "../domain/indicatorCalculations.js";

export function toPeriodoDto(periodo = {}) {
  return {
    de: periodo.de || periodo.from || "",
    ate: periodo.ate || periodo.to || "",
    label: periodo.label || "",
  };
}

export function histSummaryToAbsenteeismDto(summary = {}, periodo = {}, metaPct = 5) {
  const calc = calculateAbsenteeism({
    plannedMinutes: summary.horasPlan || summary.plannedMinutes || 0,
    unjustifiedAbsentMinutes: summary.horasAbs || summary.unjustifiedAbsentMinutes || 0,
    justifiedAbsentMinutes: summary.horasJust || summary.justifiedAbsentMinutes || 0,
    metaPct,
  });

  return {
    periodo: toPeriodoDto(periodo),
    horasPlanejadasMin: calc.plannedMinutes,
    horasTrabalhadasMin: Math.max(0, Number(summary.horasPres || summary.workedMinutes) || 0),
    horasAusentesMin: calc.unjustifiedAbsentMinutes,
    horasJustificadasMin: calc.justifiedAbsentMinutes,
    indicePct: calc.pct,
    metaPct: calc.metaPct,
  };
}

export function bancoHorasStatsToDto(stats = {}, periodo = {}) {
  const calc = calculateBankHours({
    previousBalanceMinutes: stats.previousBalanceMin ?? stats.saldoAnteriorMin ?? null,
    creditMinutes: stats.creditMin ?? stats.creditoMin ?? 0,
    debitMinutes: stats.debitMin ?? stats.debitoMin ?? 0,
    nextBalanceMinutes: stats.nextBalanceMin ?? stats.saldoProximoMin ?? null,
  });

  return {
    periodo: toPeriodoDto(periodo),
    saldoAnteriorMin: calc.previousBalanceMinutes,
    creditoMin: calc.creditMinutes,
    debitoMin: calc.debitMinutes,
    saldoProximoMin: calc.nextBalanceMinutes,
    departamentos: Array.isArray(stats.departamentos) ? stats.departamentos : [],
  };
}

export function radarSummaryToDto(radar = {}, periodo = {}) {
  return {
    periodo: toPeriodoDto(periodo),
    ocorrencias: Number(radar.ocorrencias || radar.total || 0),
    colaboradoresImpactados: Number(radar.colaboradores || radar.colaboradoresImpactados || 0),
    principalEvento: radar.principalEvento
      ? {
          codigo: radar.principalEvento.codigo || radar.principalEvento.cod || "",
          descricao: radar.principalEvento.descricao || radar.principalEvento.evento || "",
          ocorrencias: Number(radar.principalEvento.ocorrencias || 0),
          colaboradores: Number(radar.principalEvento.colaboradores || 0),
        }
      : undefined,
  };
}
