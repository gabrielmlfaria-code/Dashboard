import { createAnomalia } from "../../types/regras.js";

export function regraRiscoRecorrente(ctx) {
  const ocorrencias = Number(
    ctx.input.recorrenciaRegraDias ??
      ctx.input.regraRecorrenciasPeriodo ??
      ctx.input.auditRecurrenceCount ??
      0,
  );
  if (!ocorrencias || ocorrencias < ctx.params.recorrenciaRiscoLimite) return null;

  return createAnomalia({
    severity: "alta",
    code: "RISCO_RECORRENTE",
    message: `${ocorrencias} ocorrencias similares no periodo.`,
    details: "Padrao repetido exige revisao de escala, parametrizacao ou processo operacional.",
    categoria: "fraude",
    memoria: [
      `Ocorrencias no periodo: ${ocorrencias}`,
      `Limite parametrizado: ${ctx.params.recorrenciaRiscoLimite}`,
    ],
  });
}
