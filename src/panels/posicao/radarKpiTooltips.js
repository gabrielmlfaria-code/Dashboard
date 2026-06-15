/** Tooltips dos cards do radar histórico */
export const RADAR_KPI_TOOLTIPS = {
  abs: "Fórmula: (horas ausentes ÷ horas planejadas) × 100.",
  plan: "Total da jornada diária a cumprir × número de dias úteis do período selecionado.",
  work: "Total de horas apuradas no evento de Horas Normais.",
  lost: "Soma das horas justificadas + injustificadas.",
  risk:
    "Resumo de eventos classificados como Risco Trabalhista em Configurações › Horas.",
};

export function buildPlanHoursTooltip(workDays = 0) {
  const n = Math.max(0, Number(workDays) || 0);
  const daysLabel = n === 1 ? "1 dia útil" : `${n.toLocaleString("pt-BR")} dias úteis`;
  return `${RADAR_KPI_TOOLTIPS.plan} (${daysLabel}).`;
}

export const WORK_HOURS_TOOLTIP = RADAR_KPI_TOOLTIPS.work;
export const ABSENT_HOURS_TOOLTIP = RADAR_KPI_TOOLTIPS.lost;

function fmtHmTooltip(mins) {
  const n = Math.round(Number(mins) || 0);
  const h = Math.floor(n / 60);
  const m = n % 60;
  if (h >= 100) {
    return m > 0 ?
        `${h.toLocaleString("pt-BR")} h ${String(m).padStart(2, "0")} min`
      : `${h.toLocaleString("pt-BR")} h`;
  }
  if (h > 0 || m > 0) {
    return `${String(h).padStart(2, "0")} h ${String(m).padStart(2, "0")} min`;
  }
  return "0 h";
}

/** Tooltip do card de absenteísmo com fórmula e valores do período. */
export function buildAbsIndexTooltip({ horasAbs = 0, horasPlan = 0, absPct = 0 } = {}) {
  const plan = Number(horasPlan) || 0;
  const formula = "Fórmula: (horas ausentes ÷ horas planejadas) × 100";
  if (plan <= 0) return `${formula}.`;
  const abs = Number(horasAbs) || 0;
  const pct = Number(absPct) || 0;
  return `${formula} · ${fmtHmTooltip(abs)} ÷ ${fmtHmTooltip(plan)} × 100 = ${pct.toFixed(1).replace(".", ",")}%`;
}

/** Composição de horas (bloco abaixo dos KPIs) */
export const RADAR_HOURS_TOOLTIPS = {
  injust: "Horas de faltas e atrasos injustificados no período.",
  just: "Horas justificadas no período (atestado, férias, licença etc.).",
  extr: "Horas extras no período (hora extra, banco de horas, plantão etc.).",
  consec:
    "Colaboradores com 2 ou mais faltas injustificadas em dias de calendário consecutivos no período.",
};

/** Cards da posicao do dia (grade lateral) */
export const STAT_DAY_TOOLTIPS = {
  presentes:
    "Colaboradores classificados como Presentes na posicao do dia, conforme categorias de eventos em Configuracoes.",
  falta:
    "Colaboradores com falta injustificada no dia (eventos da categoria Ausentes).",
  atraso:
    "Colaboradores com atraso no dia (eventos da categoria Ausentes).",
  ja_saiu: "Colaboradores que ja encerraram a jornada no dia.",
  entrada_prev: "Colaboradores com entrada prevista ainda nao registrada no ponto.",
  nao_controla: "Colaboradores sem controle de ponto no dia.",
};
