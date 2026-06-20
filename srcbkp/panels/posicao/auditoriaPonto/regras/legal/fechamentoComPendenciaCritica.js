import { createAnomalia } from "../../types/regras.js";

export function regraFechamentoComPendenciaCritica(ctx) {
  const fechado = Boolean(ctx.input.fechamentoSolicitado || ctx.input.periodoFechado || ctx.input.closingRequested);
  const criticas = Number(ctx.input.criticasPendentes || ctx.input.auditCriticasPendentes || 0);
  const paramsAlterados = Boolean(ctx.input.parametrosAlteradosSemReprocessar);
  if (!fechado && !paramsAlterados) return null;
  if (!criticas && !paramsAlterados) return null;

  return createAnomalia({
    severity: "critica",
    code: "FECHAMENTO_COM_PENDENCIA_CRITICA",
    message: paramsAlterados
      ? "Parametros alterados sem reprocessamento antes do fechamento."
      : "Fechamento com pendencias criticas de auditoria.",
    details: `Criticas pendentes: ${criticas}.`,
    categoria: "legal",
    forcaBloqueio: true,
    memoria: [
      `Fechamento solicitado/periodo fechado: ${fechado ? "sim" : "nao"}`,
      `Criticas pendentes: ${criticas}`,
      `Parametros alterados sem reprocessar: ${paramsAlterados ? "sim" : "nao"}`,
    ],
  });
}
