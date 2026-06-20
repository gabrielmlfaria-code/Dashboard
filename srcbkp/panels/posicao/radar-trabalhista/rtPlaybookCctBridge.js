import { getValidityStatus } from "../posicaoCctValidity.js";
import {
  enrichAnalysisFromText,
  extractTextSnippetsForTopic,
} from "../posicaoCctTextExtract.js";
import { getCctById, loadCctIndex, loadCctText } from "../posicaoCctStorage.js";

/** Campos da análise CCT relevantes por tipo de evento no playbook. */
const TOPIC_FIELDS = {
  "intrajornada-6h": [
    { section: "breaks", key: "mealBreakMinutes", label: "Intervalo refeição (minutos)" },
    { section: "breaks", key: "details", label: "Intervalos / intrajornada" },
    { section: "workingHours", key: "dailyHours", label: "Jornada diária" },
    { section: "workingHours", key: "weeklyHours", label: "Jornada semanal" },
    { section: "workingHours", key: "bankOfHours", label: "Banco de horas", bool: true },
    { section: "workingHours", key: "bankOfHoursDetails", label: "Banco de horas (detalhe)" },
  ],
  intrajornada: [
    { section: "breaks", key: "mealBreakMinutes", label: "Intervalo refeição (minutos)" },
    { section: "breaks", key: "details", label: "Regras de intervalo" },
    { section: "workingHours", key: "bankOfHoursDetails", label: "Compensação / banco" },
  ],
  interjornada: [
    { section: "breaks", key: "interjourneyHours", label: "Interjornada (horas)" },
    { section: "breaks", key: "details", label: "Descanso entre jornadas" },
  ],
  extra: [
    { section: "overtime", key: "additionalPercentage", label: "Adicional hora extra (%)" },
    { section: "overtime", key: "sundayPercentage", label: "Domingos/feriados (%)" },
    { section: "overtime", key: "dailyLimit", label: "Limite diário (horas)" },
    { section: "overtime", key: "details", label: "Horas extras (detalhe)" },
    { section: "workingHours", key: "bankOfHours", label: "Banco de horas", bool: true },
  ],
  ponto: [
    { section: "timeTracking", key: "method", label: "Método de controle" },
    { section: "timeTracking", key: "repRequired", label: "REP obrigatório", bool: true },
    { section: "timeTracking", key: "details", label: "Registro de ponto" },
  ],
  ferias: [{ section: "_summary", key: "summary", label: "Resumo da convenção" }],
  generic: [
    { section: "_summary", key: "summary", label: "Resumo" },
    { section: "workingHours", key: "bankOfHoursDetails", label: "Jornada" },
  ],
};

function formatValue(val, bool) {
  if (val == null || val === "") return null;
  if (bool) return val ? "Sim" : "Não";
  if (typeof val === "number") return String(val);
  return String(val).trim();
}

function collectPoints(analysis, penaltyKind) {
  const defs = TOPIC_FIELDS[penaltyKind] || TOPIC_FIELDS.generic;
  const points = [];
  for (const def of defs) {
    let val = null;
    if (def.section === "_summary") {
      val = analysis.summary;
    } else {
      val = analysis[def.section]?.[def.key];
    }
    const formatted = formatValue(val, def.bool);
    if (formatted) points.push({ label: def.label, value: formatted });
  }
  return points;
}

function vigenciaLabel(validUntil) {
  const { status, daysLeft } = getValidityStatus(validUntil);
  if (status === "vigente") return `Vigente — ${daysLeft} dias`;
  if (status === "vencendo") return `Vence em ${daysLeft} dias`;
  if (status === "expirada") return `Expirada há ${Math.abs(daysLeft ?? 0)} dias`;
  return "Sem data de vigência";
}

/**
 * @param {string} penaltyKind
 * @returns {Promise<Array<object>>}
 */
export async function loadPlaybookCctSections(penaltyKind) {
  const index = await loadCctIndex();
  if (!index.length) {
    return [
      {
        empty: true,
        message:
          "Nenhuma CCT importada. Importe a convenção na aba CCT do Radar para cruzar cláusulas com este evento.",
      },
    ];
  }

  const sorted = [...index].sort((a, b) => {
    const sa = getValidityStatus(a.validUntil).status;
    const sb = getValidityStatus(b.validUntil).status;
    const rank = { vigente: 0, vencendo: 1, sem_data: 2, expirada: 3 };
    return (rank[sa] ?? 9) - (rank[sb] ?? 9);
  });

  const sections = [];

  for (const row of sorted) {
    const full = (await getCctById(row.id)) || row;
    if (full.status === "pending") {
      sections.push({
        id: full.id,
        label: full.label || full.fileName,
        pending: true,
        message: "Análise da CCT em andamento. Reabra o playbook em instantes ou consulte o PDF.",
        empty: false,
        points: [],
        snippets: [],
      });
      continue;
    }
    if (full.status !== "analyzed") continue;

    let analysis = full.analysisResult;
    const text = await loadCctText(full.id);
    if (text?.trim() && analysis) {
      analysis = enrichAnalysisFromText(analysis, text);
    }

    const snippets = text?.trim()
      ? extractTextSnippetsForTopic(text, penaltyKind, 4)
      : [];

    const points = analysis ? collectPoints(analysis, penaltyKind) : [];
    const scanned = full.isScanned !== false && !text?.trim() && !full.ocrApplied;

    let message = null;
    if (scanned && !points.length && !snippets.length) {
      message =
        full.ocrStatus === "error"
          ? "OCR não concluiu — na aba CCT use «Extrair com OCR» ou preencha a cláusula manual abaixo."
          : "PDF digitalizado — na aba CCT clique em «Extrair com OCR» para tentar ler as cláusulas automaticamente, ou registre manualmente abaixo.";
    } else if (!points.length && !snippets.length) {
      message =
        "Não foram encontradas cláusulas automáticas sobre este tema nesta CCT. Consulte o PDF ou inclua parecer do Jurídico.";
    }

    sections.push({
      id: full.id,
      label: full.label || full.fileName,
      fileName: full.fileName,
      vigencia: vigenciaLabel(full.validUntil),
      validityPeriod: analysis?.validityPeriod || null,
      parties: analysis?.parties || null,
      points,
      snippets,
      message,
      scanned,
      empty: false,
    });
  }

  if (!sections.length) {
    return [
      {
        empty: true,
        message: "CCT em importação ou sem análise. Aguarde ou reimporte o PDF na aba CCT.",
      },
    ];
  }

  return sections;
}
