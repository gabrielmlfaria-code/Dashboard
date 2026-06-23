import { calculateAbsenteeism, calculateBankHours } from "../domain/indicatorCalculations.js";

function toNumber(value, fallback = 0) {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

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
    horasPlanejadasMinutos: calc.plannedMinutes,
    horasTrabalhadasMinutos: Math.max(0, Number(summary.horasPres || summary.workedMinutes) || 0),
    horasAusentesMinutos: calc.unjustifiedAbsentMinutes,
    horasJustificadasMinutos: calc.justifiedAbsentMinutes,
    indicePercentual: calc.pct,
    metaPercentual: calc.metaPct,
    calculo: {
      formula: "(horasAusentesMinutos / horasPlanejadasMinutos) * 100",
      base: "horasPlanejadasMinutos",
      entradas: {
        horasAusentesMinutos: calc.unjustifiedAbsentMinutes + calc.justifiedAbsentMinutes,
        horasPlanejadasMinutos: calc.plannedMinutes,
      },
      resultado: calc.pct,
    },
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
    saldoAnteriorMinutos: calc.previousBalanceMinutes,
    creditoMinutos: calc.creditMinutes,
    debitoMinutos: calc.debitMinutes,
    saldoProximoMinutos: calc.nextBalanceMinutes,
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

export function competenciaToMonthLabel(value) {
  const raw = String(value || "").trim();
  const iso = raw.match(/^(\d{4})-(\d{2})$/);
  if (iso) return `${iso[2]}/${iso[1]}`;
  const br = raw.match(/^(\d{1,2})\/(\d{4})$/);
  if (br) return `${br[1].padStart(2, "0")}/${br[2]}`;
  return raw;
}

function monthLabelToIndex(value) {
  const match = String(value || "").match(/^(\d{2})\/(\d{4})$/);
  if (!match) return Number.POSITIVE_INFINITY;
  return Number(match[2]) * 12 + Number(match[1]);
}

function monthlyEventLabel(event = {}) {
  const code = String(event.codigoEvento || event.codigo || "").trim();
  const desc = String(event.descricaoEvento || event.descricao || "").trim();
  if (code && desc) return `${code} - ${desc}`;
  return desc || code || "Evento sem descricao";
}

export function buildMensalFromApiDto(dto = {}) {
  const eventos = Array.isArray(dto?.eventos) ? dto.eventos : [];
  const months = [];
  const monthsSeen = new Set();
  const byEvent = new Map();

  for (const event of eventos) {
    const month = competenciaToMonthLabel(event.competencia || event.mes || event.month);
    if (!month) continue;
    if (!monthsSeen.has(month)) {
      monthsSeen.add(month);
      months.push(month);
    }

    const label = monthlyEventLabel(event);
    const current = byEvent.get(label) || {
      event: label,
      byMonth: {},
      total: 0,
      categoria: event.categoria ?? null,
    };
    const minutes = toNumber(event.horasMinutos ?? event.horasMin ?? event.minutes, 0);
    current.byMonth[month] = (current.byMonth[month] || 0) + minutes;
    current.total += minutes;
    byEvent.set(label, current);
  }

  months.sort((a, b) => monthLabelToIndex(a) - monthLabelToIndex(b));
  const rows = Array.from(byEvent.values());

  return {
    rows,
    months,
    total: rows.reduce((sum, row) => sum + (Number(row.total) || 0), 0),
    eventCount: rows.length,
    importedAt: dto?.periodo?.atualizadoEm || new Date().toISOString(),
    source: "api",
    periodo: dto?.periodo || null,
  };
}

export function buildTurnoverFromApiDto(dto = {}) {
  const meses = Array.isArray(dto?.meses) ? dto.meses : [];
  const months = meses.map((item) => competenciaToMonthLabel(item.competencia)).filter(Boolean);

  const rows = {
    Desligados: meses.map((item) => toNumber(item.desligados, 0)),
    Admitidos: meses.map((item) => toNumber(item.admitidos, 0)),
    "Total de Colaboradores": meses.map((item) => toNumber(item.totalColaboradores, 0)),
    Horistas: meses.map((item) => toNumber(item.horistas, 0)),
    Mensalistas: meses.map((item) => toNumber(item.mensalistas, 0)),
    Estagiarios: meses.map((item) => toNumber(item.estagiarios, 0)),
  };

  return {
    months,
    rows,
    importedAt: dto?.periodo?.atualizadoEm || new Date().toISOString(),
    source: "api",
    periodo: dto?.periodo || null,
  };
}
