/**
 * Perguntas em linguagem natural — respostas determinísticas (números do contexto, texto local).
 */

import { fmtMinutes as fmtMinutesReadable, fmtNum, normNl as normQ } from "./nlFormatters.js";

export { fmtMinutesReadable };

function pct(n, digits = 1) {
  if (n == null || Number.isNaN(n)) return "—";
  return `${Number(n).toFixed(digits)}%`;
}

function sharePct(part, total) {
  if (!total) return null;
  return (part / total) * 100;
}

function openFilterAction(type, field, label, value, extra = {}) {
  const cleanValue = String(value || "").trim();
  if (!cleanValue) return { type, ...extra };
  return {
    type,
    ...extra,
    filter: {
      field,
      label,
      value: cleanValue,
    },
  };
}

function histFilterAction(field, label, value, extra = {}) {
  return openFilterAction("open_hist_table", field, label, value, extra);
}

function histItemFilterAction(field, label, value) {
  return histFilterAction(field, label, value, { filterFromItem: field, filterLabel: label });
}

function resolvePrimaryDeptLabel(ctx) {
  const fromRanking = ctx?.departamentos?.[0]?.dept;
  if (fromRanking) return fromRanking;
  const fromFaltas = ctx?.faltasAnalise?.ausentes?.topDeptos?.[0]?.label;
  if (fromFaltas) return fromFaltas;
  const radarDept = ctx?.radar?.topDept;
  return radarDept?.label || radarDept?.dept || radarDept || "";
}

function primaryDeptHistFilter(ctx) {
  return histFilterAction("departamento", "Departamento", resolvePrimaryDeptLabel(ctx));
}

function entityScore(queryNorm, value) {
  const v = normQ(value);
  if (!v) return 0;
  if (queryNorm.includes(v)) return 1000 + v.length;
  const words = v.split(/\s+/).filter((w) => w.length >= 3);
  const hits = words.filter((w) => queryNorm.includes(w)).length;
  if (!hits) return 0;
  return hits * 100 + words.join("").length;
}

function findEntityInQuestion(question, values) {
  const q = normQ(question);
  return (
    [...(values || [])]
      .map((item) => {
        const label =
          typeof item === "string" ? item : item?.nome || item?.dept || item?.label || "";
        return { label, score: entityScore(q, label) };
      })
      .filter((x) => x.label && x.score > 0)
      .sort((a, b) => b.score - a.score || b.label.length - a.label.length)[0]?.label || ""
  );
}

function parseHeatmapPeriod(question) {
  const q = normQ(question);
  const lastDays = q.match(/ultim[oa]s?\s+(\d{1,4})\s+dias?/);
  if (lastDays) {
    return { mode: "lastDays", days: Math.max(1, Number(lastDays[1]) || 0) };
  }
  const dates = [
    ...String(question || "").matchAll(/(\d{1,2})[\/.-](\d{1,2})[\/.-](\d{2,4})/g),
  ].map((m) => {
    const yyyy = String(m[3]).length === 2 ? `20${m[3]}` : m[3];
    return `${yyyy}-${String(m[2]).padStart(2, "0")}-${String(m[1]).padStart(2, "0")}`;
  });
  if (dates.length >= 2) return { mode: "range", from: dates[0], to: dates[1] };
  return null;
}

const INTENTS = [
  {
    id: "colab_mais_faltas",
    test: (q) =>
      /(colaborador|funcionario|empregado).*(mais falt|mais ausen|maior ausen|mais ocorren)/.test(
        q,
      ) || /(quem|qual colaborador).*(mais falt|mais faltou|mais ausen)/.test(q),
  },
  {
    id: "reincidencia_segunda",
    test: (q) =>
      /(segunda|segunda-feira|monday).*(falta|ausen|critico|concentr)/.test(q) ||
      /(falta|ausen).*(segunda|segunda-feira)/.test(q) ||
      /reincidencia.*(segunda|dia)/.test(q),
  },
  {
    id: "comparar_deptos",
    test: (q) =>
      /(compar|versus|vs|mais que|pior que|melhor que).*(depart|setor|area)/.test(q) ||
      /(depart|setor).*(compar|versus|vs)/.test(q),
  },
  {
    id: "custo_absenteismo",
    test: (q) =>
      /(custo|valor|impacto financeiro|quanto custa|r\$).*(absente|falta|ausen|hora perdida)/.test(
        q,
      ) || /(absente|falta).*(custo|valor|quanto custa|impacto)/.test(q),
  },
  {
    id: "formula_absenteismo",
    test: (q) =>
      /(formula|como.*(calcula|calculado)|metodologia|base de calculo).*(absente|indice)/.test(q) ||
      /(absente|indice).*(como.*(calcula|calculado)|formula)/.test(q),
  },
  {
    id: "heatmap_filtro",
    test: (q) =>
      /(heatmap|mapa de calor|calor)/.test(q) &&
      /(colaborador|funcionario|empregado|depart|setor|area|de |do |da )/.test(q),
  },
  {
    id: "faltas_concentracao",
    test: (q) => {
      if (!/(falta|injust|ausen)/.test(q)) return false;
      if (/(depart|setor|area|onde|concentr|local|plant)/.test(q)) return true;
      if (/evento/.test(q) && /concentr/.test(q)) return true;
      return false;
    },
  },
  {
    id: "faltas_eventos_ranking",
    test: (q) =>
      /(evento|motivo|tipo|codigo)/.test(q) &&
      /(falta|injust|ausen)/.test(q) &&
      !/concentr/.test(q) &&
      !/(depart|setor|area)/.test(q),
  },
  {
    id: "abs_indice",
    test: (q) => /absenteismo|indice de abs|taxa de abs|percentual de abs/.test(q),
  },
  {
    id: "pior_departamento",
    test: (q) =>
      /(pior|maior|top|principal).*(depart|setor|area)/.test(q) ||
      /(depart|setor).*(pior|maior|absenteismo)/.test(q),
  },
  {
    id: "risco_top",
    test: (q) =>
      /(risco|penalidade|trabalhista).*(evento|principal|motivo|top)/.test(q) ||
      /(evento|principal).*(risco|penalidade)/.test(q),
  },
  {
    id: "evolucao_abs",
    test: (q) =>
      /(evolu|tend|subiu|caiu|aument|diminu|compar|versus|vs|periodo anterior)/.test(q) &&
      /absenteismo|abs\b|ausen/.test(q),
  },
  {
    id: "dia_critico",
    test: (q) =>
      /(dia|data).*(crit|pior|pico)/.test(q) ||
      /(pico|critico).*(dia|semana)/.test(q) ||
      /(segunda|terca|quarta|quinta|sexta|sabado|domingo)/.test(q),
  },
  {
    id: "faltas_consecutivas",
    test: (q) => /consecutiv|sequencia|seguidas/.test(q) && /falta/.test(q),
  },
  {
    id: "horas_extras",
    test: (q) => /(hora|h\.?).*(extra|sobrejornada)|sobrecarga|extras/.test(q),
  },
  {
    id: "radar_passivo",
    test: (q) =>
      /passivo|estimativa financeira|risco financeiro/.test(q) ||
      (/custo|valor/.test(q) && /risco|penalidade|trabalhista/.test(q)),
  },
  {
    id: "total_faltas_atrasos",
    test: (q) =>
      /(quantas|total|numero).*(falta|atraso)/.test(q) || /(falta|atraso).*(quantas|total)/.test(q),
  },
  {
    id: "justificadas_mix",
    test: (q) =>
      /justificad|atestado|abono|licenca/.test(q) && /(injust|falta|ausen|horas)/.test(q),
  },
  {
    id: "presenca_pct",
    test: (q) => /(presen|comparec|pontual)/.test(q) && /(percent|indice|taxa|qual)/.test(q),
  },
  {
    id: "colab_ausencia",
    test: (q) =>
      /(quantos|numero).*(colaborador|funcionario|empregado).*(ausen|falta|abs)/.test(q) ||
      /colaborador.*(ausen|falta|abs)/.test(q),
  },
  {
    id: "risco_total",
    test: (q) =>
      /(quantas|total|numero).*(penalidade|risco)/.test(q) ||
      /(penalidade|risco).*(quantas|total|ocorren)/.test(q),
  },
  {
    id: "horas_perdidas",
    test: (q) => /horas perdidas|perda de horas|horas nao trabalh/.test(q),
  },
  {
    id: "abonos_pendentes",
    test: (q) => /abono/.test(q) && /(pendent|sla|depart|quantas|total)/.test(q),
  },
  {
    id: "banco_horas_saldo",
    test: (q) => /banco/.test(q) && /hora/.test(q),
  },
  {
    id: "art_473_ausencias",
    test: (q) =>
      /art\.?\s*473/.test(q) ||
      (/(ausen|afast|falta)/.test(q) && /(exame preventiv|hpv|mamograf|preventiv.*clt)/.test(q)),
  },
  {
    id: "saude_preventiva",
    test: (q) =>
      /(saude prevent|preventiv|lei 15\.?377|hpv|vacina|mamograf|campanha de saude)/.test(q) ||
      (/exame/.test(q) && /prevent/.test(q)),
  },
  {
    id: "atrasos_total",
    test: (q) =>
      /atras/.test(q) &&
      !/falta/.test(q) &&
      (/(quantas|total|numero|somente|so )/.test(q) || /horas.*atras/.test(q)),
  },
  {
    id: "comparacao_faltas_atrasos",
    test: (q) =>
      /falta/.test(q) &&
      /atras/.test(q) &&
      (/(compar|versus|vs|proporc|relacao|faltas e atrasos)/.test(q) ||
        (/(quantas|total)/.test(q) && !/justific/.test(q))),
  },
  {
    id: "top_evento_falta",
    test: (q) =>
      /(principal|top|maior|mais frequente).*(evento|motivo|tipo|codigo)/.test(q) &&
      /(falta|ausen)/.test(q) &&
      !/risco|penalidade/.test(q),
  },
  {
    id: "horas_planejadas",
    test: (q) => /(horas?|h\.?).*(planej|previst)/.test(q) && !/perdida/.test(q),
  },
  {
    id: "horas_trabalhadas",
    test: (q) =>
      /(horas?|h\.?).*(trabalh|realiz|efetiv)/.test(q) ||
      (/horas/.test(q) && /presente/.test(q) && !/planej/.test(q)),
  },
  {
    id: "horas_ausentes_card",
    test: (q) =>
      /horas/.test(q) && /ausen/.test(q) && !/injust|justific|planej|extra|perdida|trabalh/.test(q),
  },
  {
    id: "perda_percentual",
    test: (q) =>
      /(perda|deficit).*(%|percent|planej)/.test(q) ||
      /percentual de perda|perda sobre o planejado/.test(q),
  },
  {
    id: "ranking_departamentos",
    test: (q) =>
      /(ranking|lista|quais|todos).*(depart|setor)/.test(q) &&
      !/(pior|maior|principal|concentr)/.test(q),
  },
  {
    id: "padrao_semana",
    test: (q) =>
      /(padrao|concentracao|pico).*(dia|semana)/.test(q) ||
      /(segunda|terca|quarta|quinta|sexta|sabado|domingo).*(critico|falta|ausen|absenteismo)/.test(
        q,
      ),
  },
  {
    id: "insights_periodo",
    test: (q) =>
      /(sugest|insight|recomend|alerta|o que fazer|acoes|priorid)/.test(q) &&
      /(periodo|absenteismo|dados)/.test(q),
  },
  {
    id: "radar_dept_destaque",
    test: (q) =>
      /(depart|setor).*(risco|passivo|radar)/.test(q) ||
      (/radar/.test(q) && /(depart|setor)/.test(q)),
  },
  {
    id: "horas_atrasos",
    test: (q) => /horas/.test(q) && /atras/.test(q) && !/falta/.test(q),
  },
];

export function matchDashboardNlIntent(question) {
  const q = normQ(question);
  if (!q) return null;
  for (const intent of INTENTS) {
    if (intent.test(q)) return intent.id;
  }
  return null;
}

/** Cards de sugestão no modal (título + perguntas). */
export const NL_CHIP_GROUPS = [
  { id: "visao", title: "Diagnosticar problema", surfaces: ["absenteismo"] },
  { id: "faltas", title: "Investigar ausências", surfaces: ["absenteismo"] },
  { id: "horas", title: "Explicar cálculos", surfaces: ["absenteismo"] },
  { id: "pessoas", title: "Encontrar responsáveis", surfaces: ["absenteismo", "radar"] },
  { id: "cards", title: "Consultar cards", surfaces: ["absenteismo"] },
  { id: "risco", title: "Risco trabalhista", surfaces: ["absenteismo", "radar"] },
];

export const NL_SUGGESTION_CHIPS = [
  {
    id: "faltas_concentracao",
    group: "faltas",
    label: "Onde se concentram as faltas injustificadas?",
    surfaces: ["absenteismo"],
  },
  {
    id: "faltas_eventos_ranking",
    group: "faltas",
    label: "Quais tipos de evento de falta aparecem mais?",
    surfaces: ["absenteismo"],
    requiresSpecificFaltaEvents: true,
  },
  {
    id: "abs_indice",
    group: "visao",
    label: "Qual o índice de absenteísmo do período?",
    surfaces: ["absenteismo"],
  },
  {
    id: "evolucao_abs",
    group: "visao",
    label: "O absenteísmo subiu ou caiu no período?",
    surfaces: ["absenteismo"],
  },
  {
    id: "pior_departamento",
    group: "pessoas",
    label: "Qual departamento concentra mais absenteísmo?",
    surfaces: ["absenteismo", "radar"],
  },
  {
    id: "total_faltas_atrasos",
    group: "faltas",
    label: "Quantas faltas e atrasos no período?",
    surfaces: ["absenteismo"],
  },
  {
    id: "justificadas_mix",
    group: "horas",
    label: "Quanto é justificado vs injustificado em horas?",
    surfaces: ["absenteismo"],
  },
  {
    id: "dia_critico",
    group: "faltas",
    label: "Qual foi o dia mais crítico?",
    surfaces: ["absenteismo"],
  },
  {
    id: "faltas_consecutivas",
    group: "faltas",
    label: "Há faltas consecutivas de colaboradores?",
    surfaces: ["absenteismo"],
  },
  {
    id: "colab_ausencia",
    group: "pessoas",
    label: "Quantos colaboradores tiveram ausência?",
    surfaces: ["absenteismo"],
  },
  {
    id: "presenca_pct",
    group: "visao",
    label: "Qual o percentual de presença?",
    surfaces: ["absenteismo"],
  },
  {
    id: "horas_extras",
    group: "horas",
    label: "Quantas horas extras no período?",
    surfaces: ["absenteismo"],
  },
  {
    id: "horas_perdidas",
    group: "horas",
    label: "Quantas horas perdidas no período?",
    surfaces: ["absenteismo"],
  },
  {
    id: "risco_top",
    group: "risco",
    label: "Qual o principal evento de risco trabalhista?",
    surfaces: ["absenteismo", "radar"],
  },
  {
    id: "risco_total",
    group: "risco",
    label: "Quantas penalidades de risco no período?",
    surfaces: ["absenteismo", "radar"],
  },
  {
    id: "radar_passivo",
    group: "risco",
    label: "Qual a estimativa de passivo trabalhista?",
    surfaces: ["absenteismo", "radar"],
  },
  {
    id: "atrasos_total",
    group: "faltas",
    label: "Quantos atrasos no período?",
    surfaces: ["absenteismo"],
  },
  {
    id: "comparacao_faltas_atrasos",
    group: "faltas",
    label: "Como faltas e atrasos se comparam?",
    surfaces: ["absenteismo"],
  },
  {
    id: "top_evento_falta",
    group: "faltas",
    label: "Qual o evento de ausência mais frequente?",
    surfaces: ["absenteismo"],
  },
  {
    id: "horas_planejadas",
    group: "horas",
    label: "Quantas horas planejadas no período?",
    surfaces: ["absenteismo"],
  },
  {
    id: "horas_trabalhadas",
    group: "horas",
    label: "Quantas horas trabalhadas (presença)?",
    surfaces: ["absenteismo"],
  },
  {
    id: "horas_ausentes_card",
    group: "horas",
    label: "Qual o total de horas ausentes?",
    surfaces: ["absenteismo"],
  },
  {
    id: "perda_percentual",
    group: "horas",
    label: "Qual o percentual de perda sobre o planejado?",
    surfaces: ["absenteismo"],
  },
  {
    id: "horas_atrasos",
    group: "horas",
    label: "Quantas horas de atrasos no período?",
    surfaces: ["absenteismo"],
  },
  {
    id: "ranking_departamentos",
    group: "pessoas",
    label: "Qual o ranking de departamentos no período?",
    surfaces: ["absenteismo", "radar"],
  },
  {
    id: "padrao_semana",
    group: "faltas",
    label: "Há padrão por dia da semana?",
    surfaces: ["absenteismo"],
  },
  {
    id: "insights_periodo",
    group: "visao",
    label: "Quais alertas e sugestões para o período?",
    surfaces: ["absenteismo"],
  },
  {
    id: "banco_horas_saldo",
    group: "cards",
    label: "Qual o saldo do banco de horas?",
    surfaces: ["absenteismo"],
  },
  {
    id: "saude_preventiva",
    group: "cards",
    label: "Como está a saúde preventiva no período?",
    surfaces: ["absenteismo"],
  },
  {
    id: "art_473_ausencias",
    group: "cards",
    label: "Há ausências do art. 473 no período?",
    surfaces: ["absenteismo"],
  },
  {
    id: "abonos_pendentes",
    group: "cards",
    label: "Quantos abonos pendentes por departamento?",
    surfaces: ["absenteismo"],
  },
  {
    id: "radar_dept_destaque",
    group: "risco",
    label: "Qual departamento destaca no radar trabalhista?",
    surfaces: ["radar"],
  },
  {
    id: "colab_mais_faltas",
    group: "pessoas",
    label: "Qual colaborador mais faltou no período?",
    surfaces: ["absenteismo"],
  },
  {
    id: "reincidencia_segunda",
    group: "faltas",
    label: "Há reincidência de faltas nas segundas-feiras?",
    surfaces: ["absenteismo"],
  },
  {
    id: "comparar_deptos",
    group: "pessoas",
    label: "Compare os departamentos entre si",
    surfaces: ["absenteismo", "radar"],
  },
  {
    id: "custo_absenteismo",
    group: "visao",
    label: "Qual o custo estimado do absenteísmo?",
    surfaces: ["absenteismo"],
  },
  {
    id: "formula_absenteismo",
    group: "horas",
    label: "Como a fórmula de absenteísmo é calculada?",
    surfaces: ["absenteismo"],
  },
];

function filterNlChips(surface, context) {
  const key = surface === "absenteismo" || surface === "radar" ? surface : null;
  const onlyGenericFaltas = context?.faltasAnalise?.ausentes?.onlyGeneric;

  return NL_SUGGESTION_CHIPS.filter((c) => {
    if (c.surfaces?.length && key && !c.surfaces.includes(key)) return false;
    if (c.requiresSpecificFaltaEvents && onlyGenericFaltas === true) return false;
    if (c.id === "banco_horas_saldo" && !context?.bancoHoras) return false;
    if (c.id === "saude_preventiva" && !context?.saudePreventiva?.ocorrencias) return false;
    if (c.id === "art_473_ausencias" && !context?.art473?.ocorrencias) return false;
    if (
      c.id === "abonos_pendentes" &&
      context?.abonos?.pendentes === 0 &&
      context?.abonos?.efetuados === 0
    ) {
      return false;
    }
    return true;
  });
}

/** Perguntas sugeridas por superfície (absenteísmo / radar). */
export function getNlChipsForSurface(surface = "both", context = null) {
  return filterNlChips(surface, context);
}

/** Sugestões agrupadas em cards temáticos para o modal. */
export function getNlChipGroupsForSurface(surface = "both", context = null) {
  const key = surface === "absenteismo" || surface === "radar" ? surface : null;
  const chips = filterNlChips(surface, context);
  const byGroup = new Map();
  for (const chip of chips) {
    const list = byGroup.get(chip.group) || [];
    list.push(chip);
    byGroup.set(chip.group, list);
  }

  return NL_CHIP_GROUPS.filter((g) => {
    if (g.surfaces?.length && key && !g.surfaces.includes(key)) return false;
    return (byGroup.get(g.id) || []).length > 0;
  }).map((g) => ({
    id: g.id,
    title: g.title,
    chips: byGroup.get(g.id) || [],
  }));
}

/** Card temático de uma pergunta respondida (intent id). */
export function getNlChipGroupIdForIntent(intentId) {
  if (!intentId) return null;
  return NL_SUGGESTION_CHIPS.find((c) => c.id === intentId)?.group ?? null;
}

function faltaMetrics(analise) {
  return [
    { label: "Ocorrências", value: fmtNum(analise.total) },
    { label: "Colaboradores", value: fmtNum(analise.colaboradores) },
  ];
}

function deptOrColabRanking(analise, total) {
  if (analise.topDeptos.length > 0)
    return { title: "Por departamento", rows: analise.rankingDeptos };
  return {
    title: "Por colaborador",
    rows: analise.topColabs.map((c) => ({
      name: c.label,
      count: c.count,
      sharePct: sharePct(c.count, total),
      barPct: analise.topColabs[0] ? (c.count / analise.topColabs[0].count) * 100 : 0,
      sub: c.dept,
    })),
  };
}

/** Onde / como as faltas injustificadas se distribuem (depto, colab). */
function answerFaltasConcentracao(ctx, q) {
  const analise = ctx.faltasAnalise?.ausentes;
  const total = analise?.total ?? 0;
  const askedEventos = /evento/.test(normQ(q));

  if (!total) {
    return {
      intent: "faltas_concentracao",
      text: "Não há eventos classificados como Ausentes no período filtrado. Verifique a importação ou categorize os eventos em Configurações › Horas.",
      action: { type: "open_config_horas" },
      empty: true,
    };
  }

  const { title: rankingTitle, rows: ranking } = deptOrColabRanking(analise, total);
  const top = ranking[0];
  const filterField = rankingTitle === "Por departamento" ? "departamento" : "colaborador";
  const filterLabel = rankingTitle === "Por departamento" ? "Departamento" : "Colaborador";

  return {
    intent: "faltas_concentracao",
    text: "",
    structured: {
      variant: "concentration",
      headline: top ? top.name : "Sem concentração clara",
      subheadline: top
        ? `${top.sharePct.toFixed(1).replace(".", ",")}% das faltas injustificadas (${fmtNum(top.count)} ocorr.)`
        : null,
      explanation: askedEventos
        ? `No período **${ctx.periodLabel}**, não há tipos de evento distintos — só o código **${analise.topGeneric || "falta genérica"}**. A concentração abaixo usa departamento/colaborador, que é o que os dados permitem hoje.`
        : `Distribuição das **${fmtNum(total)}** falta(s) injustificada(s) (categoria Ausentes) no período **${ctx.periodLabel}**.`,
      metrics: faltaMetrics(analise),
      rankingTitle,
      ranking: ranking.slice(0, 5),
      tips: analise.onlyGeneric
        ? [
            "Para ranquear “motivos”, cadastre eventos específicos na importação ou use justificativa no ponto.",
            "Abra a tabela histórica e filtre Ausentes para validar casos.",
          ]
        : [],
    },
    action: histItemFilterAction(filterField, filterLabel, top?.name),
  };
}

/** Ranking de códigos/descrições de evento (quando não são só genéricos). */
function answerFaltasEventosRanking(ctx) {
  const analise = ctx.faltasAnalise?.ausentes;
  const total = analise?.total ?? 0;

  if (!total) {
    return {
      intent: "faltas_eventos_ranking",
      text: "Não há faltas injustificadas (Ausentes) no período.",
      empty: true,
      action: { type: "open_hist_table" },
    };
  }

  if (analise.onlyGeneric) {
    const reframed = answerFaltasConcentracao(ctx, "eventos");
    return { ...reframed, intent: "faltas_eventos_ranking" };
  }

  const top = analise.specificEvents[0];
  const share = sharePct(top.count, total);

  return {
    intent: "faltas_eventos_ranking",
    text: "",
    structured: {
      variant: "specific_events",
      headline: top.label,
      subheadline: `${pct(share)} das ocorrências · ${fmtNum(top.colaboradores)} colaborador(es)`,
      explanation: `Tipos de evento de falta injustificada mais frequentes em **${ctx.periodLabel}** (excluídos códigos genéricos como “falta não justificada”).`,
      metrics: faltaMetrics(analise),
      rankingTitle: "Ranking por evento",
      ranking: analise.rankingEventos.slice(0, 5),
      tips:
        analise.topJustificativas.length > 0
          ? [
              `Justificativas no ponto: ${analise.topJustificativas[0].label} (${fmtNum(analise.topJustificativas[0].count)}×).`,
            ]
          : [],
    },
    action: histItemFilterAction("evento", "Evento", top.label),
  };
}

function answerAbsIndice(ctx) {
  const t = ctx.totals;
  const lines = [
    `O índice de absenteísmo do período **${ctx.periodLabel}** é **${pct(t.absPct)}** (${ctx.dias} dia(s) no recorte).`,
  ];
  if (t.horasPlan > 0) {
    lines.push(
      `Em horas: **${fmtMinutesReadable(t.horasInjustMin)}** injustificadas e **${fmtMinutesReadable(t.horasJustMin)}** justificadas sobre **${fmtMinutesReadable(t.horasPlan)}** planejadas.`,
    );
  }
  if (t.absDelta != null && Math.abs(t.absDelta) >= 0.1) {
    const dir = t.absDelta > 0 ? "subiu" : "caiu";
    lines.push(
      `Na comparação interna do período (1ª vs 2ª metade), o índice **${dir} ${pct(Math.abs(t.absDelta))}** pontos.`,
    );
  }
  return { intent: "abs_indice", text: lines.join("\n\n"), action: { type: "open_abs_chart" } };
}

function answerPiorDept(ctx) {
  const top = ctx.departamentos[0];
  if (!top) {
    return {
      intent: "pior_departamento",
      text: "Não há dados por departamento no período (importe posição com depto nos colaboradores).",
      empty: true,
    };
  }
  const tr =
    top.trend != null && Math.abs(top.trend) >= 0.5
      ? ` Tendência na 2ª metade do período: **${top.trend > 0 ? "+" : ""}${pct(top.trend)}** p.p.`
      : "";
  return {
    intent: "pior_departamento",
    text: `O departamento com maior impacto de absenteísmo no período **${ctx.periodLabel}** é **${top.dept}** (${top.horasPerdidasFmt} perdidas${top.absPct != null ? `, índice **${pct(top.absPct)}**` : ""}).${tr}`,
    action: histFilterAction("departamento", "Departamento", top.dept),
  };
}

function answerRiscoTop(ctx, surface) {
  const rt = ctx.radar?.topEvento;
  const rs = ctx.risco?.topEvento;
  const top = surface === "radar" && (rt?.evento || rt?.label) ? rt : rs;
  const label = top?.label || top?.evento;
  if (!label) {
    return {
      intent: "risco_top",
      text: "Não há penalidades classificadas como Risco Trabalhista no período. Ajuste categorias em Configurações › Horas.",
      empty: true,
      action: { type: "open_config_horas" },
    };
  }
  const count = top.count ?? top.ocorrencias;
  const cols = top.colaboradores;
  const share = top.sharePct ?? sharePct(count, ctx.risco.ocorrencias);
  return {
    intent: "risco_top",
    text: `O principal evento de **risco trabalhista** é **${label}**: **${fmtNum(count)}** ocorrência(s) (${share != null ? pct(share) : "—"}), **${fmtNum(cols)}** colaborador(es).`,
    action: { type: "open_radar_eventos" },
  };
}

function answerEvolucao(ctx) {
  const d = ctx.totals.absDelta;
  if (d == null) {
    return {
      intent: "evolucao_abs",
      text: "Há poucos dias no período para comparar evolução (é necessário dividir o intervalo em duas metades).",
      empty: true,
    };
  }
  const dir = d > 0.5 ? "piorou" : d < -0.5 ? "melhorou" : "permaneceu estável";
  return {
    intent: "evolucao_abs",
    text: `Comparando a 2ª metade com a 1ª do período **${ctx.periodLabel}**, o absenteísmo **${dir}** (${d > 0 ? "+" : ""}${pct(d)} p.p.). Índice atual: **${pct(ctx.totals.absPct)}**.`,
    action: { type: "open_abs_chart" },
  };
}

function answerDiaCritico(ctx) {
  const d = ctx.diasCriticos[0];
  if (!d) {
    return {
      intent: "dia_critico",
      text: "Não identifiquei dias críticos neste recorte.",
      empty: true,
    };
  }
  const pat = ctx.patternDow ? ` Há concentração em **${ctx.patternDow}s**.` : "";
  return {
    intent: "dia_critico",
    text: `O dia mais crítico é **${d.date}** (${d.dowLabel || "—"}): **${fmtNum(d.aus)}** ocorrências de ausência e **${fmtMinutesReadable(d.horasMin)}** relacionadas.${pat}`,
    action: { type: "open_chart_day", date: d.date },
  };
}

function answerConsec(ctx) {
  const n = ctx.faltasConsecutivas.colaboradores;
  if (!n) {
    return {
      intent: "faltas_consecutivas",
      text: "Nenhum colaborador com 2+ faltas em dias de calendário consecutivos neste período.",
      empty: true,
    };
  }
  const top = ctx.faltasConsecutivas.top[0];
  const extra = top
    ? ` Exemplo: **${top.nome}** (${top.dept}), **${top.dias}** dias seguidos (${top.inicio} a ${top.fim}).`
    : "";
  return {
    intent: "faltas_consecutivas",
    text: `**${fmtNum(n)}** colaborador(es) com faltas injustificadas em dias consecutivos.${extra}`,
    action: top
      ? openFilterAction("open_consec_faltas", "colaborador", "Colaborador", top.nome)
      : { type: "open_consec_faltas" },
  };
}

function answerExtras(ctx) {
  const he = ctx.totals.horasExtras;
  if (!he) {
    return {
      intent: "horas_extras",
      text: "Não há horas extras registradas no período filtrado.",
      empty: true,
    };
  }
  const topDept = [...ctx.departamentos].sort(
    (a, b) => (b.horasPerdidasMin || 0) - (a.horasPerdidasMin || 0),
  )[0];
  return {
    intent: "horas_extras",
    text: `O período registra **${fmtMinutesReadable(he)}** de horas extras. Revise escala nos departamentos com maior carga.${topDept ? ` Maior pressão observada em **${topDept.dept}**.` : ""}`,
    action: histFilterAction("departamento", "Departamento", topDept?.dept),
  };
}

function answerRadarPassivo(ctx) {
  const p = ctx.radar.passivoTotal;
  if (p == null) {
    return {
      intent: "radar_passivo",
      text: "Abra o Radar Trabalhista para ver a estimativa de passivo no período.",
      action: { type: "open_radar" },
    };
  }
  const brl = Number(p).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
  return {
    intent: "radar_passivo",
    text: `Estimativa de passivo trabalhista no recorte: **${brl}** (premissas em Radar › Parâmetros).`,
    action: { type: "open_radar_passivo" },
  };
}

function answerTotalFaltas(ctx) {
  const t = ctx.totals;
  return {
    intent: "total_faltas_atrasos",
    text: `No período **${ctx.periodLabel}**: **${fmtNum(t.faltas)}** falta(s) e **${fmtNum(t.atrasos)}** atraso(s) registrados nos totais diários (${ctx.dias} dia(s)).`,
    action: { type: "open_abs_chart" },
  };
}

function answerJustificadasMix(ctx) {
  const t = ctx.totals;
  const totalH = t.horasInjustMin + t.horasJustMin;
  const shareJ = sharePct(t.horasJustMin, totalH);
  return {
    intent: "justificadas_mix",
    text: `Horas no período **${ctx.periodLabel}**: **${fmtMinutesReadable(t.horasInjustMin)}** injustificadas (faltas/atrasos) e **${fmtMinutesReadable(t.horasJustMin)}** justificadas${shareJ != null ? ` (**${pct(shareJ)}** do volume de ausência em horas)` : ""}. Planejado: **${fmtMinutesReadable(t.horasPlan)}**.`,
    action: { type: "open_abs_chart" },
  };
}

function answerPresenca(ctx) {
  const t = ctx.totals;
  const denom = t.presentes + t.faltas + t.atrasos;
  const presPct = denom > 0 ? (t.presentes / denom) * 100 : null;
  return {
    intent: "presenca_pct",
    text: `Presença no período **${ctx.periodLabel}**: **${fmtNum(t.presentes)}** registro(s) de presentes${presPct != null ? ` (**${pct(presPct)}** sobre presentes+faltas+atrasos)` : ""}.`,
    action: primaryDeptHistFilter(ctx),
  };
}

function answerColabAusencia(ctx) {
  const n = ctx.colaboradoresComAusencia;
  const occ = ctx.ocorrenciasAusencia;
  if (n == null) {
    return {
      intent: "colab_ausencia",
      text: "Não há detalhamento por colaborador neste recorte (importe posição com colaboradores por dia).",
      empty: true,
    };
  }
  const topColab = ctx.faltasAnalise?.ausentes?.topColabs?.[0];
  const colabAction = topColab?.label
    ? histFilterAction("colaborador", "Colaborador", topColab.label)
    : primaryDeptHistFilter(ctx);
  return {
    intent: "colab_ausencia",
    text: `**${fmtNum(n)}** colaborador(es) distinto(s) com ausência (falta ou justificada) no período **${ctx.periodLabel}**${occ != null ? `, em **${fmtNum(occ)}** ocorrência(s) no total` : ""}.`,
    action: colabAction,
  };
}

function answerRiscoTotal(ctx) {
  const r = ctx.risco;
  if (!r.ocorrencias) {
    return {
      intent: "risco_total",
      text: "Não há penalidades de risco trabalhista no período filtrado.",
      empty: true,
    };
  }
  return {
    intent: "risco_total",
    text: `**${fmtNum(r.ocorrencias)}** penalidade(s) de risco, **${fmtNum(r.colaboradores)}** colaborador(es), **${fmtMinutesReadable(r.horas)}** vinculadas — período **${ctx.periodLabel}**.`,
    action: { type: "open_radar_eventos" },
  };
}

function answerHorasPerdidas(ctx) {
  const t = ctx.totals;
  if (!t.horasPlan) {
    return {
      intent: "horas_perdidas",
      text: "Não há horas planejadas no período para calcular perda.",
      empty: true,
    };
  }
  const perdidas = Math.max(0, t.horasPlan - (t.horasPres ?? 0));
  const pctPerda = t.horasPlan > 0 ? (perdidas / t.horasPlan) * 100 : null;
  return {
    intent: "horas_perdidas",
    text: `Horas perdidas estimadas: **${fmtMinutesReadable(perdidas)}** (${pctPerda != null ? pct(pctPerda) : "—"} do planejado de **${fmtMinutesReadable(t.horasPlan)}**) — **${ctx.periodLabel}**.`,
    action: primaryDeptHistFilter(ctx),
  };
}

function answerAtrasosTotal(ctx) {
  const t = ctx.totals;
  const k = ctx.kpi;
  const horasAtras = t.horasAtrasosMin;
  return {
    intent: "atrasos_total",
    text: `No período **${ctx.periodLabel}**: **${fmtNum(t.atrasos)}** atraso(s) nos totais diários${horasAtras > 0 ? ` e **${fmtMinutesReadable(horasAtras)}** em horas de atraso` : ""}.${k?.faltas != null ? ` Para comparar: **${fmtNum(k.faltas)}** falta(s) no mesmo recorte.` : ""}`,
    action: { type: "open_abs_chart" },
  };
}

function answerComparacaoFaltasAtrasos(ctx) {
  const t = ctx.totals;
  const total = (t.faltas || 0) + (t.atrasos || 0);
  const shareF = sharePct(t.faltas, total);
  const shareA = sharePct(t.atrasos, total);
  const dominante =
    (t.faltas || 0) >= (t.atrasos || 0)
      ? histFilterAction("evento", "Evento", "FALTA")
      : histFilterAction("evento", "Evento", "ATRASO");
  return {
    intent: "comparacao_faltas_atrasos",
    text: `No período **${ctx.periodLabel}**: **${fmtNum(t.faltas)}** falta(s) e **${fmtNum(t.atrasos)}** atraso(s) — ${shareF != null ? `**${pct(shareF)}** faltas` : ""}${shareA != null ? ` e **${pct(shareA)}** atrasos` : ""} sobre o volume de ocorrências (presentes+faltas+atrasos+justificadas).`,
    action: dominante,
  };
}

function answerTopEventoFalta(ctx) {
  const top = ctx.faltasInjustificadas?.topPorOcorrencia?.[0];
  if (!top) {
    return {
      intent: "top_evento_falta",
      text: "Não há eventos Ausentes no período para ranquear.",
      empty: true,
      action: { type: "open_config_horas" },
    };
  }
  const total = ctx.faltasInjustificadas?.ocorrencias || 0;
  const share = sharePct(top.count, total);
  return {
    intent: "top_evento_falta",
    text: `O evento de ausência mais frequente é **${top.label}**: **${fmtNum(top.count)}** ocorrência(s)${share != null ? ` (**${pct(share)}** do total Ausentes)` : ""}, **${fmtNum(top.colaboradores)}** colaborador(es).`,
    action: openFilterAction("open_hist_events", "evento", "Evento", top.label),
  };
}

function answerHorasPlanejadas(ctx) {
  const hp = ctx.kpi?.horasPlan ?? ctx.totals.horasPlan;
  if (!hp) {
    return {
      intent: "horas_planejadas",
      text: "Não há horas planejadas no recorte filtrado.",
      empty: true,
    };
  }
  const delta = ctx.kpi?.planDelta;
  const deltaTxt =
    delta != null && Math.abs(delta) >= 0.5
      ? ` Variação 2ª vs 1ª metade do planejado: **${delta > 0 ? "+" : ""}${pct(delta)}**.`
      : "";
  return {
    intent: "horas_planejadas",
    text: `Horas planejadas no período **${ctx.periodLabel}**: **${fmtMinutesReadable(hp)}**.${deltaTxt}`,
    action: { type: "open_abs_chart" },
  };
}

function answerHorasTrabalhadas(ctx) {
  const ht = ctx.kpi?.horasPres ?? ctx.totals.horasPres;
  if (!ht) {
    return {
      intent: "horas_trabalhadas",
      text: "Não há horas de presença/trabalho registradas no período.",
      empty: true,
    };
  }
  const delta = ctx.kpi?.trabDelta;
  const deltaTxt =
    delta != null && Math.abs(delta) >= 0.5
      ? ` Variação 2ª vs 1ª metade: **${delta > 0 ? "+" : ""}${pct(delta)}**.`
      : "";
  return {
    intent: "horas_trabalhadas",
    text: `Horas trabalhadas (presença) em **${ctx.periodLabel}**: **${fmtMinutesReadable(ht)}**.${deltaTxt}`,
    action: { type: "open_abs_chart" },
  };
}

function answerHorasAusentesCard(ctx) {
  const ha = ctx.kpi?.horasAus;
  if (ha == null) {
    return {
      intent: "horas_ausentes_card",
      text: "Horas ausentes não disponíveis neste recorte.",
      empty: true,
    };
  }
  return {
    intent: "horas_ausentes_card",
    text: `Total de horas ausentes (card Horas Ausentes) em **${ctx.periodLabel}**: **${fmtMinutesReadable(ha)}** — soma de faltas, atrasos e justificadas em horas.`,
    action: { type: "open_abs_chart" },
  };
}

function answerPerdaPercentual(ctx) {
  const k = ctx.kpi;
  const perda = k?.perdaPct;
  const hp = k?.horasPerdidas;
  if (perda == null && !hp) {
    return {
      intent: "perda_percentual",
      text: "Não foi possível calcular perda sobre o planejado neste recorte.",
      empty: true,
    };
  }
  const delta = k?.perdaDelta;
  const deltaTxt =
    delta != null && Math.abs(delta) >= 0.1
      ? ` Tendência 2ª metade: **${delta > 0 ? "+" : ""}${pct(delta)}** p.p.`
      : "";
  return {
    intent: "perda_percentual",
    text: `Perda estimada sobre o planejado: **${perda != null ? pct(perda) : "—"}** (**${fmtMinutesReadable(hp)}** horas) em **${ctx.periodLabel}**.${deltaTxt}`,
    action: { type: "open_abs_chart" },
  };
}

function answerRankingDepartamentos(ctx) {
  const depts = ctx.departamentos || [];
  if (!depts.length) {
    return {
      intent: "ranking_departamentos",
      text: "Sem ranking por departamento (importe posição com depto nos colaboradores).",
      empty: true,
    };
  }
  const top = depts[0];
  const maxAbs = top?.absPct ?? 0;
  const ranking = depts.slice(0, 5).map((d) => ({
    name: d.dept,
    filterValue: d.dept,
    sharePct: d.absPct ?? 0,
    barPct: maxAbs > 0 ? ((d.absPct ?? 0) / maxAbs) * 100 : 0,
    count: Math.max(1, Math.round((d.horasPerdidasMin || 0) / 60)),
    sub: `${d.horasPerdidasFmt} perdidas`,
  }));
  return {
    intent: "ranking_departamentos",
    text: "",
    structured: {
      variant: "concentration",
      headline: top.dept,
      subheadline:
        top.absPct != null
          ? `${top.absPct.toFixed(1).replace(".", ",")}% índice · ${top.horasPerdidasFmt} perdidas`
          : top.horasPerdidasFmt,
      explanation: `Ranking de departamentos por absenteísmo no período **${ctx.periodLabel}**. Use o botão ou um item da lista para filtrar o dashboard.`,
      metrics: [],
      rankingTitle: "Por departamento",
      ranking,
      tips: [
        "O filtro aplica o departamento selecionado na barra superior e abre a tabela histórica.",
      ],
    },
    action: histItemFilterAction("departamento", "Departamento", top.dept),
  };
}

function answerPadraoSemana(ctx) {
  const pat = ctx.patternDow || ctx.kpi?.patternLabel;
  const crit = ctx.diasCriticos?.[0];
  if (!pat && !crit) {
    return {
      intent: "padrao_semana",
      text: "Não há padrão claro de dia da semana nos dias críticos deste recorte.",
      empty: true,
    };
  }
  const patTxt = pat ? `Há concentração em **${pat}s** entre os dias mais críticos.` : "";
  const critTxt = crit
    ? ` Dia de pico: **${crit.date}** (${crit.dowLabel || "—"}) com **${fmtNum(crit.aus)}** ocorrências.`
    : "";
  return {
    intent: "padrao_semana",
    text: `${patTxt}${critTxt}`.trim() || "Sem padrão identificado.",
    action: { type: "open_abs_chart" },
  };
}

function answerInsightsPeriodo(ctx) {
  const tips = ctx.kpi?.suggestions || [];
  if (!tips.length) {
    return {
      intent: "insights_periodo",
      text: "Nenhum alerta automático para este recorte — mantenha monitoramento preventivo.",
      empty: true,
    };
  }
  return {
    intent: "insights_periodo",
    text: `Sugestões do painel para **${ctx.periodLabel}**:\n\n${tips.map((t) => `• ${t}`).join("\n")}`,
    action: { type: "open_abs_home" },
  };
}

function answerBancoHoras(ctx) {
  const b = ctx.bancoHoras;
  if (!b) {
    return {
      intent: "banco_horas_saldo",
      text: "Não há movimentação de banco de horas no período (importe planilha ou categorize eventos BH em Configurações › Horas).",
      empty: true,
      action: { type: "open_config_horas" },
    };
  }
  const saldo = b.saldo;
  const sign = saldo >= 0 ? "positivo" : "negativo";
  const top = saldo >= 0 ? b.topPositivo : b.topNegativo;
  const topTxt = top ? ` Maior saldo em **${top.label}**.` : "";
  return {
    intent: "banco_horas_saldo",
    text: `Banco de horas (**${ctx.periodLabel}**): saldo **${fmtMinutesReadable(Math.abs(saldo))}** (${sign}). Créditos **${fmtMinutesReadable(b.credito)}**, débitos **${fmtMinutesReadable(b.debito)}**, **${fmtNum(b.ocorrencias)}** lançamento(s).${topTxt}`,
    action: { type: "open_banco_horas" },
  };
}

function answerSaudePreventiva(ctx) {
  const s = ctx.saudePreventiva;
  if (!s?.ocorrencias) {
    return {
      intent: "saude_preventiva",
      text: "Nenhum evento de saúde preventiva mapeado no período (HPV, vacina, mamografia, etc.).",
      empty: true,
      action: { type: "open_config_horas" },
    };
  }
  const ev = s.topEvento?.label || "—";
  const dept = s.topDepartamento?.label || "—";
  return {
    intent: "saude_preventiva",
    text: `Saúde preventiva: **${fmtNum(s.ocorrencias)}** ocorrência(s), **${fmtNum(s.colaboradores)}** colaborador(es). Principal evento: **${ev}**. Maior concentração: **${dept}**.`,
    action: { type: "open_saude_preventiva" },
  };
}

function answerArt473Ausencias(ctx) {
  const a = ctx.art473;
  const registros = a?.comunicacoesRegistradas ?? 0;
  if (!a?.ocorrencias) {
    const calTxt =
      a?.calendarioAtrasado > 0
        ? ` Há **${fmtNum(a.calendarioAtrasado)}** campanha(s) atrasada(s) no calendário.`
        : "";
    return {
      intent: "art_473_ausencias",
      text: `Nenhuma ausência do art. 473, XII, detectada no histórico do período. **${fmtNum(registros)}** comunicação(ões) de campanha registrada(s).${calTxt}`,
      empty: true,
      action: { type: "open_saude_preventiva" },
    };
  }
  const alertaTxt =
    a.alertas > 0
      ? ` **${fmtNum(a.alertas)}** colaborador(es) acima do limite de 3 dias/12 meses.`
      : "";
  const semComTxt =
    a.semComunicacao > 0
      ? ` **${fmtNum(a.semComunicacao)}** ocorrência(s) sem comunicação prévia registrada.`
      : " Todas com comunicação prévia registrada.";
  const calOk =
    a.calendarioOk > 0
      ? ` Calendário: **${fmtNum(a.calendarioOk)}** campanha(s) concluída(s).`
      : "";
  return {
    intent: "art_473_ausencias",
    text: `Art. 473, XII (**${ctx.periodLabel}**): **${fmtNum(a.ocorrencias)}** ausência(s) preventiva(s), **${fmtNum(a.colaboradores)}** colaborador(es).${semComTxt}${alertaTxt}${calOk} Use o card Saúde Preventiva para relatório de conformidade.`,
    action: { type: "open_saude_preventiva" },
  };
}

function answerAbonosPendentes(ctx) {
  const a = ctx.abonos;
  if (!a?.pendentes) {
    return {
      intent: "abonos_pendentes",
      text: "Não há abonos pendentes por departamento neste recorte (eventos Ausentes ou importação de abonos).",
      empty: true,
    };
  }
  const top = a.topDeptos?.[0];
  const topTxt = top
    ? ` Maior fila: **${top.dept}** (**${fmtNum(top.pendentes)}** pendentes).`
    : "";
  return {
    intent: "abonos_pendentes",
    text: `Abonos: **${fmtNum(a.pendentes)}** pendente(s), **${fmtNum(a.efetuados)}** efetuado(s)${a.sla != null ? `, SLA **${pct(a.sla)}**` : ""}.${topTxt}`,
    action: { type: "open_abonos" },
  };
}

function answerRadarDeptDestaque(ctx) {
  const dept = ctx.radar?.topDept;
  const label = dept?.label || dept?.dept || dept;
  if (!label) {
    return {
      intent: "radar_dept_destaque",
      text: "Abra o Radar Trabalhista para ver departamentos com maior exposição.",
      action: { type: "open_radar" },
      empty: true,
    };
  }
  return {
    intent: "radar_dept_destaque",
    text: `No radar trabalhista, o departamento em destaque é **${label}** no recorte **${ctx.periodLabel}**.`,
    action: openFilterAction("open_radar", "departamento", "Departamento", label),
  };
}

function answerHeatmapFiltro(question, ctx) {
  const wantsDept = /(depart|setor|area)/.test(normQ(question));
  const dept = findEntityInQuestion(question, ctx?.entidades?.departamentos || []);
  const colab = findEntityInQuestion(question, ctx?.entidades?.colaboradores || []);
  const field = wantsDept || (!colab && dept) ? "departamento" : "colaborador";
  const value = field === "departamento" ? dept : colab;
  const period = parseHeatmapPeriod(question);
  if (!value) {
    return {
      intent: "heatmap_filtro",
      text: "Consigo criar o heatmap, mas não localizei esse colaborador/departamento no histórico do período atual. Tente informar o nome como está na planilha ou filtre o período antes.",
      empty: true,
      action: { type: "open_radar_heatmap" },
    };
  }
  const periodTxt =
    period?.mode === "lastDays"
      ? `nos últimos **${period.days} dias**`
      : period?.mode === "range"
        ? `de **${period.from}** até **${period.to}**`
        : `no recorte atual (**${ctx.periodLabel}**)`;
  return {
    intent: "heatmap_filtro",
    text: `Vou abrir o **mapa de calor** ${field === "departamento" ? "do departamento" : "do colaborador"} **${value}** ${periodTxt}.`,
    action: openFilterAction(
      "open_radar_heatmap",
      field,
      field === "departamento" ? "Departamento" : "Colaborador",
      value,
      {
        period,
      },
    ),
  };
}

function answerHorasAtrasos(ctx) {
  const ha = ctx.totals?.horasAtrasosMin;
  if (!ha) {
    return {
      intent: "horas_atrasos",
      text: "Não há horas de atraso registradas no período filtrado.",
      empty: true,
    };
  }
  return {
    intent: "horas_atrasos",
    text: `Horas de atrasos em **${ctx.periodLabel}**: **${fmtMinutesReadable(ha)}** (${fmtNum(ctx.totals.atrasos)} ocorrência(s) de atraso nos totais).`,
    action: histFilterAction("evento", "Evento", "ATRASO"),
  };
}

function answerColabMaisFaltas(ctx) {
  const top = ctx.faltasAnalise?.ausentes?.topColabs?.[0];
  if (!top) {
    return {
      intent: "colab_mais_faltas",
      text: "Não há detalhamento por colaborador neste recorte. Importe a posição com colaboradores por dia.",
      empty: true,
      action: { type: "open_hist_table" },
    };
  }
  const share = sharePct(top.count, ctx.faltasAnalise.ausentes.total);
  return {
    intent: "colab_mais_faltas",
    text: `O colaborador com mais ausências no período **${ctx.periodLabel}** é **${top.label}** (${top.dept || "—"}): **${fmtNum(top.count)}** ocorrência(s)${share != null ? ` — **${pct(share)}** do total de ausências` : ""}.`,
    action: histFilterAction("colaborador", "Colaborador", top.label),
  };
}

function answerReincidenciaSegunda(ctx) {
  const pat = ctx.patternDow || ctx.kpi?.patternLabel;
  const isMonday = pat && /segunda/i.test(pat);
  const crit = ctx.diasCriticos?.find((d) => /segunda/i.test(d.dowLabel || ""));
  if (!isMonday && !crit) {
    return {
      intent: "reincidencia_segunda",
      text: `Não há concentração evidente de faltas nas segundas-feiras neste período${pat ? `. O dia com mais ocorrências é **${pat}**.` : "."}`,
      action: { type: "open_abs_chart" },
      empty: true,
    };
  }
  const critTxt = crit
    ? ` Pico identificado em **${crit.date}** com **${fmtNum(crit.aus)}** ocorrências.`
    : "";
  return {
    intent: "reincidencia_segunda",
    text: `Sim — há concentração de faltas nas **segundas-feiras** no período **${ctx.periodLabel}**.${critTxt} Verifique o padrão na aba Histórico filtrada por dia da semana.`,
    action: { type: "open_abs_chart" },
  };
}

function answerCompararDeptos(ctx, question) {
  const depts = ctx.departamentos || [];
  if (depts.length < 2) {
    return {
      intent: "comparar_deptos",
      text: "Não há dados suficientes por departamento para comparar (importe posição com depto nos colaboradores).",
      empty: true,
    };
  }
  const queryNorm = normQ(question);
  const found = depts.filter((d) => entityScore(queryNorm, d.dept) > 0);
  const list = (found.length >= 2 ? found : depts).slice(0, 3);
  const lines = list.map(
    (d) =>
      `**${d.dept}**: índice ${d.absPct != null ? pct(d.absPct) : "—"}, ${d.horasPerdidasFmt} perdidas`,
  );
  return {
    intent: "comparar_deptos",
    text: `Comparativo de departamentos no período **${ctx.periodLabel}**:\n\n${lines.join("\n")}`,
    action: { type: "open_hist_table" },
  };
}

function answerCustoAbsenteismo(ctx) {
  const t = ctx.totals;
  const horasMin = t.horasInjustMin + t.horasJustMin;
  if (!horasMin || !t.horasPlan) {
    return {
      intent: "custo_absenteismo",
      text: "Não há horas suficientes para estimar custo. Importe planilha com horas planejadas.",
      empty: true,
      action: { type: "open_abs_chart" },
    };
  }
  const horas = horasMin / 60;
  const perdaPct = t.horasPlan > 0 ? (horasMin / t.horasPlan) * 100 : null;
  return {
    intent: "custo_absenteismo",
    text: `Horas de ausência no período **${ctx.periodLabel}**: **${fmtMinutesReadable(horasMin)}** (${perdaPct != null ? pct(perdaPct) + " do planejado" : "—"}). Para converter em R$: multiplique pelo custo/hora médio da sua folha. Exemplo: a R$ 50/h → **${Number(horas * 50).toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}** estimados.`,
    action: { type: "open_abs_chart" },
  };
}

function answerFormulaAbsenteismo(ctx) {
  const t = ctx.totals;
  return {
    intent: "formula_absenteismo",
    text: `O índice de absenteísmo é calculado como: **horas ausentes ÷ horas planejadas × 100**.\n\nNo período **${ctx.periodLabel}**: **${fmtMinutesReadable(t.horasInjustMin + t.horasJustMin)}** ausentes ÷ **${fmtMinutesReadable(t.horasPlan)}** planejadas = **${pct(t.absPct)}**.\n\nAusentes = faltas injustificadas + justificadas + atrasos convertidos em horas. A fórmula pode ser ajustada em Configurações › Horas.`,
    action: { type: "open_abs_chart" },
  };
}

function answerFallback(ctx, surface) {
  const chips = getNlChipsForSurface(surface, ctx).slice(0, 6);
  const hints = chips.map((c) => `- ${c.label}`).join("\n");
  return {
    intent: "fallback",
    text: `Não reconheci essa pergunta no catálogo atual. Posso ajudar melhor se você perguntar sobre absenteísmo, faltas, atrasos, radar trabalhista, banco de horas, abonos ou saúde preventiva.\n\n${hints}`,
    empty: true,
    structured: {
      variant: "generic_only",
      headline: "Pergunta fora do catálogo",
      subheadline:
        "Use uma das sugestões ou pergunte sobre os indicadores disponíveis no dashboard.",
      tips: [
        "As respostas usam os filtros e o período visíveis no dashboard.",
        "Para investigação nominal, abra o detalhe do card ou da tabela correspondente.",
      ],
    },
  };
}
export function answerDashboardNlQuestion(question, context, opts = {}) {
  const surface = opts.surface || context.surface || "both";
  const q = normQ(question);
  const intentId = matchDashboardNlIntent(q) || opts.forceIntent || null;

  switch (intentId) {
    case "heatmap_filtro":
      return answerHeatmapFiltro(question, context);
    case "faltas_concentracao":
      return answerFaltasConcentracao(context, q);
    case "faltas_eventos_ranking":
      return answerFaltasEventosRanking(context);
    case "abs_indice":
      return answerAbsIndice(context);
    case "pior_departamento":
      return answerPiorDept(context);
    case "risco_top":
      return answerRiscoTop(context, surface);
    case "evolucao_abs":
      return answerEvolucao(context);
    case "dia_critico":
      return answerDiaCritico(context);
    case "faltas_consecutivas":
      return answerConsec(context);
    case "horas_extras":
      return answerExtras(context);
    case "radar_passivo":
      return answerRadarPassivo(context);
    case "total_faltas_atrasos":
      return answerTotalFaltas(context);
    case "justificadas_mix":
      return answerJustificadasMix(context);
    case "presenca_pct":
      return answerPresenca(context);
    case "colab_ausencia":
      return answerColabAusencia(context);
    case "risco_total":
      return answerRiscoTotal(context);
    case "horas_perdidas":
      return answerHorasPerdidas(context);
    case "abonos_pendentes":
      return answerAbonosPendentes(context);
    case "banco_horas_saldo":
      return answerBancoHoras(context);
    case "saude_preventiva":
      return answerSaudePreventiva(context);
    case "art_473_ausencias":
      return answerArt473Ausencias(context);
    case "atrasos_total":
      return answerAtrasosTotal(context);
    case "comparacao_faltas_atrasos":
      return answerComparacaoFaltasAtrasos(context);
    case "top_evento_falta":
      return answerTopEventoFalta(context);
    case "horas_planejadas":
      return answerHorasPlanejadas(context);
    case "horas_trabalhadas":
      return answerHorasTrabalhadas(context);
    case "horas_ausentes_card":
      return answerHorasAusentesCard(context);
    case "perda_percentual":
      return answerPerdaPercentual(context);
    case "ranking_departamentos":
      return answerRankingDepartamentos(context);
    case "padrao_semana":
      return answerPadraoSemana(context);
    case "insights_periodo":
      return answerInsightsPeriodo(context);
    case "radar_dept_destaque":
      return answerRadarDeptDestaque(context);
    case "horas_atrasos":
      return answerHorasAtrasos(context);
    case "colab_mais_faltas":
      return answerColabMaisFaltas(context);
    case "reincidencia_segunda":
      return answerReincidenciaSegunda(context);
    case "comparar_deptos":
      return answerCompararDeptos(context, question);
    case "custo_absenteismo":
      return answerCustoAbsenteismo(context);
    case "formula_absenteismo":
      return answerFormulaAbsenteismo(context);
    default:
      return answerFallback(context, surface);
  }
}

/** Converte markdown leve (**bold**) para texto simples (UI usa HTML seguro via split). */
export function splitNlAnswerMarkdown(text) {
  const parts = [];
  const re = /\*\*([^*]+)\*\*/g;
  let last = 0;
  let m;
  while ((m = re.exec(text)) !== null) {
    if (m.index > last) parts.push({ bold: false, text: text.slice(last, m.index) });
    parts.push({ bold: true, text: m[1] });
    last = m.index + m[0].length;
  }
  if (last < text.length) parts.push({ bold: false, text: text.slice(last) });
  return parts.length ? parts : [{ bold: false, text: text || "" }];
}
