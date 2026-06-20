import { parseValidityFromFileName } from "./posicaoCctValidity.js";
import { enrichAnalysisFromText } from "./posicaoCctTextExtract.js";

const emptySection = () => ({
  details: null,
});

/** @returns {import('./posicaoCctTypes.js').AnalysisResult} */
export function buildAnalysisResult(entry, extractedText = "") {
  const validity = parseValidityFromFileName(entry.fileName);
  const scanned = entry.isScanned !== false && !extractedText?.trim() && !entry.ocrApplied;
  const label = entry.label || entry.fileName || "CCT";

  const alerts = [];
  if (scanned) {
    alerts.push({
      severity: "medio",
      title: "PDF digitalizado (sem texto automático)",
      description:
        "A convenção foi salva e pode ser aberta no navegador. Regras detalhadas exigem revisão no PDF ou análise jurídica — não foram extraídas automaticamente.",
    });
  }

  const base = {
    summary: scanned
      ? `${label} importada com sucesso. Documento digitalizado — use «Abrir PDF» para consultar cláusulas de jornada, intervalos e banco de horas.`
      : `${label} importada. Texto parcial disponível para consulta na aba.`,
    validityPeriod: validity.validityPeriod,
    parties: inferParties(entry.fileName),
    validFrom: validity.validFrom,
    validUntil: validity.validUntil,
    alerts,
    workingHours: {
      dailyHours: null,
      weeklyHours: null,
      bankOfHours: null,
      bankOfHoursDetails: scanned
        ? "Consultar cláusulas no PDF da convenção."
        : null,
    },
    overtime: {
      additionalPercentage: null,
      sundayPercentage: null,
      dailyLimit: null,
      details: scanned ? "Consultar cláusulas no PDF." : null,
    },
    breaks: {
      mealBreakMinutes: null,
      interjourneyHours: null,
      details: scanned ? "Consultar cláusulas sobre intervalo no PDF." : null,
    },
    timeTracking: {
      method: null,
      repRequired: null,
      details: scanned ? "Consultar cláusulas de ponto no PDF." : null,
    },
    remoteWork: {
      allowed: null,
      timeTrackingRequired: null,
      details: null,
    },
    nightShift: {
      additionalPercentage: null,
      details: null,
    },
  };

  return extractedText?.trim() ? enrichAnalysisFromText(base, extractedText) : base;
}

function inferParties(fileName) {
  const n = String(fileName || "").toLowerCase();
  if (n.includes("sindpd")) return "SindPD-SP (inferido pelo nome do arquivo)";
  if (n.includes("sind")) return "Sindicato (inferido pelo nome do arquivo)";
  return null;
}
