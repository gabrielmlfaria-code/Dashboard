import { DEFAULT_PASSIVO_CFG, fmtBRL } from "./radarPassivoUtils.js";

function norm(s) {
  return String(s ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
}

function fmtHours(value) {
  const n = Math.max(0, Number(value) || 0);
  const h = Math.floor(n);
  const m = Math.round((n - h) * 60);
  if (h <= 0 && m <= 0) return "0 h";
  if (m === 60) return `${h + 1} h`;
  return m > 0 ? `${h} h ${String(m).padStart(2, "0")} min` : `${h} h`;
}

/** @typedef {{ evento: string, ocorrencias?: number, colaboradores?: number, passivo?: number, baseLegal?: string, formula?: string, kind?: string }} EventRow */

/** @type {Array<{ test: (n: string) => boolean, playbook: object }>} */
const PLAYBOOK_RULES = [
  {
    test: (n) =>
      (n.includes("6") && n.includes("intervalo")) ||
      n.includes("mais de 6") ||
      n.includes("6h sem") ||
      n.includes("6 horas sem"),
    playbook: {
      order: 6,
      title: "Mais de 6h sem Intervalo",
      subtitle:
        "Boas Práticas: Mais de 6 Horas Sem Intervalo — Conduta Recomendada ao Empregador.",
      impact: "alto",
      tag: "Orientação",
      legalBasis:
        "Art. 71 da CLT e Súmula 437 do TST: jornada superior a 6 horas exige intervalo intrajornada mínimo de 1 hora (ou 30 minutos, se previsto em convenção coletiva). Trabalhar mais de 6 horas sem intervalo gera direito à remuneração de 1 hora extra integral (adicional mínimo de 50%) e expõe a empresa a fiscalização do Ministério do Trabalho.",
      conduct: [
        "Registrar o evento normalmente no sistema de ponto.",
        "Gerar alertas para gestores e RH assim que a ocorrência for identificada.",
        "Investigar a causa (demanda operacional, esquecimento, falha de escala etc.).",
        "Efetuar o pagamento de 1 hora extra integral por ocorrência (mínimo 50% sobre a hora normal).",
        "Se habitual, revisar a organização do trabalho e escalas.",
        "Verificar ACT/CCT que eventualmente permita redução do intervalo para 30 minutos.",
        "Envolver saúde ocupacional se houver padrão de privação de descanso.",
        "Treinar gestores para nunca orientar colaboradores a suprimir intervalos.",
      ],
      penaltyKind: "intrajornada-6h",
    },
  },
  {
    test: (n) => n.includes("interjornada") || n.includes("11h") || n.includes("11 horas"),
    playbook: {
      order: 4,
      title: "Interjornada insuficiente",
      subtitle: "Descanso entre jornadas inferior a 11 horas — conduta recomendada.",
      impact: "alto",
      tag: "Orientação",
      legalBasis:
        "Art. 66 da CLT e OJ 355 da SDI-1 do TST: é obrigatório o intervalo mínimo de 11 horas consecutivas entre duas jornadas. A violação gera pagamento das horas suprimidas como extras (mínimo 50%) e risco de autuação.",
      conduct: [
        "Conferir registros de entrada/saída e escalas que geraram a ocorrência.",
        "Alertar gestores sobre risco de horas extras e de saúde do trabalhador.",
        "Ajustar escalas para garantir 11h de descanso antes da nova jornada.",
        "Apurar e pagar horas devidas conforme política interna e base legal.",
        "Documentar medidas corretivas para eventual fiscalização ou processo.",
      ],
      penaltyKind: "interjornada",
    },
  },
  {
    test: (n) => n.includes("extra") || n.includes("hora extra") || n.includes("sobrejornada"),
    playbook: {
      order: 3,
      title: "Horas extras",
      subtitle: "Controle e regularização de jornada extraordinária.",
      impact: "medio",
      tag: "Orientação",
      legalBasis:
        "Art. 59 da CLT: hora extra com adicional mínimo de 50% sobre a hora normal (ou percentual superior em convenção). Limite de 2h diárias salvo acordo. Acúmulo eleva passivo e reflexos salariais.",
      conduct: [
        "Validar autorização prévia ou banco de horas, se aplicável.",
        "Conferir adicional pactuado (CCT) e percentual mínimo legal.",
        "Garantir registro fiel no REP e folha de pagamento.",
        "Monitorar limites diários/semanais e padrão por colaborador.",
      ],
      penaltyKind: "extra",
    },
  },
  {
    test: (n) =>
      n.includes("ponto") || n.includes("marcacao") || n.includes("marcação") || n.includes("rep"),
    playbook: {
      order: 5,
      title: "Irregularidade de ponto / REP",
      subtitle: "Conformidade na marcação e conservação de registros.",
      impact: "medio",
      tag: "Orientação",
      legalBasis:
        "Arts. 74 a 75 da CLT e Portaria MTP 1.151/2025: empregador com mais de 20 empregados deve controlar jornada. Ausência ou falha no registro sujeita a multas administrativas por empregado afetado.",
      conduct: [
        "Corrigir falhas de marcação e orientar colaboradores.",
        "Revisar integração REP → folha e backups de espelho.",
        "Arquivar comprovantes pelo prazo legal.",
        "Tratar ocorrências recorrentes com RH e gestão direta.",
      ],
      penaltyKind: "ponto",
    },
  },
  {
    test: (n) => n.includes("ferias") || n.includes("férias"),
    playbook: {
      order: 7,
      title: "Férias",
      subtitle: "Gestão de períodos aquisitivos e concessivos.",
      impact: "medio",
      tag: "Orientação",
      legalBasis:
        "Arts. 129 a 153 da CLT: férias devem ser concedidas no período legal, com adicional de 1/3. Dobro em caso de concessão fora do prazo após o período concessivo.",
      conduct: [
        "Mapear saldos e vencimentos por colaborador.",
        "Programar concessão antes do fim do período concessivo.",
        "Registrar aviso e pagamento com antecedência mínima de 2 dias.",
      ],
      penaltyKind: "ferias",
    },
  },
  {
    test: (n) =>
      n.includes("intervalo") || n.includes("intrajornada") || n.includes("refeicao") || n.includes("refeição"),
    playbook: {
      order: 6,
      title: "Intervalo intrajornada",
      subtitle: "Supressão ou redução irregular de intervalo para repouso e alimentação.",
      impact: "alto",
      tag: "Orientação",
      legalBasis:
        "Art. 71 da CLT: intervalo intrajornada suprimido ou concedido parcialmente gera pagamento do período correspondente com adicional de 50% (natureza salarial na redação anterior à Reforma, com reflexos).",
      conduct: [
        "Identificar registros sem intervalo ou intervalo inferior ao legal.",
        "Apurar horas devidas e incluir na folha ou acordo de compensação, se cabível.",
        "Revisar CCT para regras específicas do setor.",
        "Reforçar política interna de pausas com gestores.",
      ],
      penaltyKind: "intrajornada",
    },
  },
];

/**
 * @param {string} evento
 * @returns {object}
 */
export function findPlaybookForEvent(evento) {
  const n = norm(evento);
  for (const rule of PLAYBOOK_RULES) {
    if (rule.test(n)) return { ...rule.playbook };
  }
  return {
    order: null,
    title: evento || "Evento de risco",
    subtitle: "Orientação geral — revise base legal e passivo estimado no período.",
    impact: "medio",
    tag: "Orientação",
    legalBasis:
      "Consulte a legislação aplicável (CLT, convenção coletiva e entendimento jurisprudencial). O passivo e a fórmula exibidos na tabela são estimativas para priorização interna.",
    conduct: [
      "Registrar e monitorar ocorrências no período selecionado.",
      "Priorizar eventos de maior volume, colaboradores impactados e estimativa financeira.",
      "Acionar RH e assessoria jurídica para tratativa caso a caso.",
      "Documentar medidas corretivas e comunicação aos gestores.",
    ],
    penaltyKind: "generic",
  };
}

/**
 * @param {EventRow} eventRow
 * @param {typeof DEFAULT_PASSIVO_CFG} cfg
 */
export function buildPlaybookPenaltyItems(eventRow, cfg = DEFAULT_PASSIVO_CFG) {
  const c = { ...DEFAULT_PASSIVO_CFG, ...cfg };
  const sh = Number(c.sh) || 18.5;
  const mult = 1;
  const multaMte = Number(c.multaMin) || 40.25;
  const ocorr = Number(eventRow.ocorrencias) || 0;
  const colabs = Number(eventRow.colaboradores) || 0;
  const passivoPeriodo = Number(eventRow.passivo) || 0;
  const kind = eventRow.kind || "intrajornada";
  const horasBase = Number(eventRow.horasBase) || Math.max(0, Number(eventRow.horas) || 0) / 60;

  const perOccurrence = Math.round(sh * 1.5 * mult * 100) / 100;

  if (kind === "ponto") {
    return [
      {
        text: `Multa administrativa (MTE): ${fmtBRL(multaMte)} por empregado/dia de infração (valores da Portaria 1.151/2025 — faixa pode chegar a milhares conforme gravidade).`,
      },
      {
        text: `No período: ${ocorr.toLocaleString("pt-BR")} ocorrência(s) · ${colabs} colaborador(es) · passivo estimado ${fmtBRL(passivoPeriodo)}.`,
      },
      {
        text: "Regularizar REP, espelhos e política de marcação reduz risco de autuação e passivo trabalhista.",
      },
    ];
  }

  if (kind === "ferias") {
    return [
      {
        text: `Estimativa no período: ${fmtBRL(passivoPeriodo)} (${colabs} colaborador(es) com pendência de férias no modelo configurado).`,
      },
      {
        text: "Concessão em dobro e reflexos elevam passivo quando o período concessivo expira sem gozo.",
      },
      { text: "Planejar concessão e aviso prévio conforme arts. 134 e 145 da CLT." },
    ];
  }

  if (kind === "extra" || kind === "interjornada") {
    const hHint = kind === "extra" ? "horas extras" : "horas de interjornada";
    return [
      {
        text: `${hHint}: ${fmtHours(horasBase)} x ${fmtBRL(sh)} x 1,5 = ${fmtBRL(passivoPeriodo)}.`,
      },
      {
        text: `Valor hora (parametro SH): ${fmtBRL(sh)}. Regra legal atual.`,
      },
      {
        text: "Fiscalização pode gerar auto de infração; valor final depende de enquadramento, auditoria, CCT e histórico da empresa.",
      },
    ];
  }

  const reflexoPct = 0;
  return [
    {
      text: `Horas consideradas: ${fmtHours(horasBase)}. Fórmula: ${eventRow.formula || "horas totais × SH × 1,5"}.`,
    },
    {
      text: `Valor hora configurado: ${fmtBRL(sh)}. Cada hora suprimida equivale a ${fmtBRL(perOccurrence)}.`,
    },
    { text: "Regra legal atual: estimativa do periodo suprimido com adicional; validar enquadramento conforme CCT e parecer juridico." },
    {
      text: `No período analisado: ${ocorr.toLocaleString("pt-BR")} ocorrência(s), ${colabs} colaborador(es), estimativa ${fmtBRL(passivoPeriodo)}.`,
    },
  ];
}


