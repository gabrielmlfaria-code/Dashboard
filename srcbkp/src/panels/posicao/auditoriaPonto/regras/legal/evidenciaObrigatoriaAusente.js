import { createAnomalia } from "../../types/regras.js";

function requiresEvidence(ctx) {
  if (ctx.input.evidenciaObrigatoria || ctx.input.requiresEvidence) return true;
  return (
    ctx.eventText.includes("atestado") ||
    ctx.eventText.includes("falta abonada") ||
    ctx.eventText.includes("abono") ||
    ctx.eventText.includes("ajuste folha") ||
    ctx.eventText.includes("ajuste manual") ||
    (ctx.eventText.includes("banco") && ctx.eventText.includes("manual"))
  );
}

function hasEvidence(input) {
  const anexos = input.anexos || input.attachments || input.evidencias || input.documentos || [];
  return Boolean(
    input.evidenciaOk ||
      input.temAnexo ||
      input.documentoId ||
      input.justificativa ||
      (Array.isArray(anexos) && anexos.length),
  );
}

export function regraEvidenciaObrigatoriaAusente(ctx) {
  if (!requiresEvidence(ctx) || hasEvidence(ctx.input)) return null;

  return createAnomalia({
    severity: "media",
    code: "EVIDENCIA_OBRIGATORIA_AUSENTE",
    message: "Evento exige evidencia ou justificativa, mas nada foi informado.",
    details: "Anexe documento ou registre justificativa antes do fechamento.",
    categoria: "legal",
    memoria: [
      `Evento: ${ctx.input.evento || ctx.input.situacaoDesc || "-"}`,
      "Anexos/documentos: ausentes",
      "Justificativa: ausente",
    ],
  });
}
