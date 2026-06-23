import {
  calculateAbsenteeism,
  calculateBankHours,
  calculateMonthlyVariation,
} from "../domain/indicatorCalculations.js";

function toNumber(value, fallback = 0) {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

function normalizePeriodo(periodo = {}, fallback = {}) {
  const de = periodo.de || periodo.from || periodo.start || fallback.de || fallback.from || "";
  const ate = periodo.ate || periodo.to || periodo.end || fallback.ate || fallback.to || "";
  return {
    de,
    ate,
    label: periodo.label || fallback.label || (de && ate ? `${de} ate ${ate}` : undefined),
  };
}

function pick(row, keys, fallback = undefined) {
  for (const key of keys) {
    if (row?.[key] !== undefined && row?.[key] !== null && row?.[key] !== "") return row[key];
  }
  return fallback;
}

export function toPositionDayDto(row = {}) {
  return {
    data: pick(row, ["data", "date", "dia"], ""),
    filial: pick(row, ["filial", "branch"], undefined),
    departamento: pick(row, ["departamento", "depto", "department"], undefined),
    cargo: pick(row, ["cargo", "role"], undefined),
    genero: pick(row, ["genero", "gender"], undefined),
    presentes: toNumber(pick(row, ["presentes", "qtdPresentes"], 0)),
    faltas: toNumber(pick(row, ["faltas", "ausentes", "qtdAusentes"], 0)),
    atrasos: toNumber(pick(row, ["atrasos", "qtdAtrasos"], 0)),
    folgas: toNumber(pick(row, ["folgas"], 0)),
    ferias: toNumber(pick(row, ["ferias", "férias"], 0)),
    afastados: toNumber(pick(row, ["afastados"], 0)),
    jaSairam: toNumber(pick(row, ["jaSairam", "jáSaíram", "sairam"], 0)),
    entradaPrevista: toNumber(pick(row, ["entradaPrevista"], 0)),
    naoControlaPonto: toNumber(pick(row, ["naoControlaPonto", "nãoControlaPonto"], 0)),
  };
}

export function toAbsenteeismSummaryDto({
  periodo,
  plannedMinutes = 0,
  workedMinutes = 0,
  unjustifiedAbsentMinutes = 0,
  justifiedAbsentMinutes = 0,
  metaPct = 5,
} = {}) {
  const result = calculateAbsenteeism({
    plannedMinutes,
    unjustifiedAbsentMinutes,
    justifiedAbsentMinutes,
    metaPct,
  });

  return {
    periodo: normalizePeriodo(periodo),
    horasPlanejadasMin: result.plannedMinutes,
    horasTrabalhadasMin: toNumber(workedMinutes),
    horasAusentesMin: result.unjustifiedAbsentMinutes,
    horasJustificadasMin: result.justifiedAbsentMinutes,
    indicePct: result.pct,
    metaPct: result.metaPct,
  };
}

export function toBankHoursDto({ periodo, summary = {}, departamentos = [] } = {}) {
  const totals = calculateBankHours({
    previousBalanceMinutes: summary.saldoAnteriorMin ?? summary.previousBalanceMinutes ?? null,
    creditMinutes: summary.creditoMin ?? summary.creditMinutes ?? 0,
    debitMinutes: summary.debitoMin ?? summary.debitMinutes ?? 0,
    nextBalanceMinutes: summary.saldoProximoMin ?? summary.nextBalanceMinutes ?? null,
  });

  return {
    periodo: normalizePeriodo(periodo),
    saldoAnteriorMin: totals.previousBalanceMinutes,
    creditoMin: totals.creditMinutes,
    debitoMin: totals.debitMinutes,
    saldoProximoMin: totals.nextBalanceMinutes,
    departamentos: departamentos.map((dept) => {
      const deptTotals = calculateBankHours({
        previousBalanceMinutes: dept.saldoAnteriorMin ?? dept.previousBalanceMinutes ?? null,
        creditMinutes: dept.creditoMin ?? dept.creditMinutes ?? 0,
        debitMinutes: dept.debitoMin ?? dept.debitMinutes ?? 0,
        nextBalanceMinutes: dept.saldoProximoMin ?? dept.nextBalanceMinutes ?? null,
      });

      return {
        departamento: pick(dept, ["departamento", "depto", "department"], "Sem departamento"),
        saldoAnteriorMin: deptTotals.previousBalanceMinutes,
        creditoMin: deptTotals.creditMinutes,
        debitoMin: deptTotals.debitMinutes,
        saldoProximoMin: deptTotals.nextBalanceMinutes,
        colaboradores: toNumber(pick(dept, ["colaboradores", "employees"], 0)),
      };
    }),
  };
}

export function toMonthlyClosingDto({ periodo, eventos = [], monthLabels = [] } = {}) {
  return {
    periodo: normalizePeriodo(periodo),
    eventos: eventos.map((event) => {
      const rawMonths = event.months || event.meses || [];
      let previousHours = 0;
      const months = monthLabels.map((label, index) => {
        const source =
          rawMonths.find((m) => (m.label || m.mes || m.month) === label) || rawMonths[index] || {};
        const hours = toNumber(source.horasMin ?? source.minutes ?? source.hoursMinutes ?? 0);
        const dto = {
          mes: label,
          horasMin: hours,
          variacaoPct: index === 0 ? null : calculateMonthlyVariation(hours, previousHours),
        };
        previousHours = hours;
        return dto;
      });

      return {
        codigo: String(pick(event, ["codigo", "code"], "")),
        descricao: String(pick(event, ["descricao", "description", "name"], "")),
        categoria: pick(event, ["categoria", "category"], undefined),
        meses: months,
      };
    }),
  };
}

export function toLaborRadarDto({ periodo, ocorrencias = [], principalEvento = null } = {}) {
  const rows = Array.isArray(ocorrencias) ? ocorrencias : [];
  const totalOcorrencias = rows.reduce((sum, row) => sum + toNumber(row.ocorrencias ?? row.count, 0), 0);
  const colaboradores = new Set(
    rows
      .flatMap((row) => row.colaboradores || row.employees || [])
      .map((value) => String(value).trim())
      .filter(Boolean),
  );

  const principal =
    principalEvento ||
    rows
      .slice()
      .sort((a, b) => toNumber(b.ocorrencias ?? b.count, 0) - toNumber(a.ocorrencias ?? a.count, 0))[0];

  return {
    periodo: normalizePeriodo(periodo),
    ocorrencias: totalOcorrencias,
    colaboradoresImpactados: colaboradores.size || toNumber(principal?.colaboradoresImpactados, 0),
    principalEvento: principal
      ? {
          codigo: pick(principal, ["codigo", "code"], undefined),
          descricao: String(pick(principal, ["descricao", "description", "evento", "name"], "")),
          ocorrencias: toNumber(principal.ocorrencias ?? principal.count, 0),
          colaboradores: toNumber(principal.colaboradores ?? principal.employeesCount, 0),
        }
      : undefined,
  };
}
