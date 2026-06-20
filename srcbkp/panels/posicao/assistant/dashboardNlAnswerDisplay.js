import { splitNlAnswerMarkdown } from "./dashboardNlQuery.js";

export const NL_INTENT_META = {
  faltas_concentracao: { label: "Concentração", tone: "warn" },
  faltas_eventos_ranking: { label: "Eventos", tone: "warn" },
  abs_indice: { label: "Índice", tone: "abs" },
  evolucao_abs: { label: "Tendência", tone: "abs" },
  pior_departamento: { label: "Departamentos", tone: "dept" },
  total_faltas_atrasos: { label: "Ocorrências", tone: "warn" },
  justificadas_mix: { label: "Horas", tone: "hours" },
  dia_critico: { label: "Dia crítico", tone: "warn" },
  faltas_consecutivas: { label: "Sequência", tone: "warn" },
  colab_ausencia: { label: "Colaboradores", tone: "dept" },
  presenca_pct: { label: "Presença", tone: "good" },
  horas_extras: { label: "Extras", tone: "hours" },
  horas_perdidas: { label: "Perdas", tone: "hours" },
  risco_top: { label: "Risco", tone: "risk" },
  risco_total: { label: "Risco", tone: "risk" },
  radar_passivo: { label: "Passivo", tone: "risk" },
  atrasos_total: { label: "Atrasos", tone: "warn" },
  comparacao_faltas_atrasos: { label: "Comparativo", tone: "warn" },
  top_evento_falta: { label: "Evento", tone: "warn" },
  horas_planejadas: { label: "Planejado", tone: "hours" },
  horas_trabalhadas: { label: "Trabalhadas", tone: "good" },
  horas_ausentes_card: { label: "Ausentes", tone: "hours" },
  perda_percentual: { label: "Perda", tone: "hours" },
  ranking_departamentos: { label: "Ranking", tone: "dept" },
  padrao_semana: { label: "Padrão", tone: "warn" },
  insights_periodo: { label: "Alertas", tone: "abs" },
  banco_horas_saldo: { label: "Banco de horas", tone: "good" },
  saude_preventiva: { label: "Saúde preventiva", tone: "good" },
  art_473_ausencias: { label: "Art. 473", tone: "warn" },
  abonos_pendentes: { label: "Abonos", tone: "dept" },
  radar_dept_destaque: { label: "Radar · Depto", tone: "risk" },
  horas_atrasos: { label: "Atrasos (h)", tone: "warn" },
  colab_mais_faltas: { label: "Colaborador", tone: "dept" },
  reincidencia_segunda: { label: "Segunda", tone: "warn" },
  comparar_deptos: { label: "Comparativo", tone: "dept" },
  custo_absenteismo: { label: "Custo", tone: "hours" },
  formula_absenteismo: { label: "Fórmula", tone: "abs" },
};

function stripMarkdownBold(text) {
  return String(text || "").replace(/\*\*([^*]+)\*\*/g, "$1");
}

/** Rótulos por ordem dos valores em negrito no texto legado. */
const LEGACY_METRIC_LABELS_BY_INTENT = {
  abs_indice: [
    "Índice de absenteísmo",
    "Horas injustificadas",
    "Horas justificadas",
    "Horas planejadas",
    "Variação do índice",
  ],
  evolucao_abs: ["Variação (p.p.)", "Índice atual"],
  justificadas_mix: ["Horas injustificadas", "Horas justificadas", "Parte justificada", "Horas planejadas"],
  horas_perdidas: ["Horas perdidas", "% do planejado", "Horas planejadas"],
  horas_extras: ["Horas extras"],
  presenca_pct: ["Registros presentes", "Taxa de presença"],
  total_faltas_atrasos: ["Faltas", "Atrasos"],
  pior_departamento: ["Departamento", "Índice / horas"],
  dia_critico: ["Data", "Ocorrências", "Horas relacionadas"],
  faltas_consecutivas: ["Colaboradores"],
  colab_ausencia: ["Colaboradores", "Ocorrências"],
  risco_top: ["Evento", "Ocorrências", "Colaboradores"],
  risco_total: ["Penalidades", "Colaboradores", "Horas vinculadas"],
  radar_passivo: ["Passivo estimado"],
  atrasos_total: ["Atrasos (ocorrências)", "Horas de atraso"],
  comparacao_faltas_atrasos: ["Faltas", "Atrasos"],
  top_evento_falta: ["Evento principal", "Ocorrências"],
  horas_planejadas: ["Horas planejadas"],
  horas_trabalhadas: ["Horas trabalhadas"],
  horas_ausentes_card: ["Horas ausentes"],
  perda_percentual: ["Perda (%)", "Horas perdidas"],
  banco_horas_saldo: ["Saldo BH", "Créditos", "Débitos"],
  saude_preventiva: ["Ocorrências", "Colaboradores"],
  art_473_ausencias: ["Ausências art. 473", "Colaboradores", "Sem comunicação"],
  abonos_pendentes: ["Pendentes", "Efetuados", "SLA"],
  horas_atrasos: ["Horas de atrasos"],
};

function parseLegacyMetrics(text, intentId) {
  const re = /\*\*([^*]+)\*\*/g;
  const metrics = [];
  const labels = LEGACY_METRIC_LABELS_BY_INTENT[intentId];
  let m;
  while ((m = re.exec(text)) !== null) {
    const value = m[1].trim();
    if (!value || value.length > 48) continue;
    if (/%|R\$|h\s|min|pp\.?$|^\d[\d.,]*$/.test(value)) {
      const label = labels?.[metrics.length] || "Indicador";
      metrics.push({ label, value });
    }
  }
  return metrics.slice(0, 5);
}

/** Monta view-model para o cartão de resposta. */
export function buildAnswerDisplay(answer) {
  const meta = NL_INTENT_META[answer?.intent] || { label: "Insight", tone: "neutral" };

  if (answer?.structured) {
    const s = answer.structured;
    return {
      mode: "structured",
      meta,
      empty: Boolean(answer?.empty),
      variant: s.variant,
      headline: s.headline,
      subheadline: s.subheadline || null,
      explanation: stripMarkdownBold(s.explanation),
      metrics: s.metrics || [],
      rankingTitle: s.rankingTitle || null,
      ranking: s.ranking || [],
      tips: (s.tips || []).map(stripMarkdownBold),
    };
  }

  const raw = String(answer?.text || "");
  const blocks = raw.split("\n\n").filter(Boolean);
  const leadBlock = blocks[0] || "";

  return {
    mode: "legacy",
    meta,
    empty: Boolean(answer?.empty),
    leadParts: splitNlAnswerMarkdown(leadBlock),
    details: blocks.slice(1).map((block, i) => ({
      id: i,
      parts: splitNlAnswerMarkdown(block),
    })),
    metrics: parseLegacyMetrics(raw, answer?.intent),
  };
}

export function getAnswerIntentTone(intentId) {
  return NL_INTENT_META[intentId]?.tone || "neutral";
}
