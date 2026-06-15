import { createAnomalia } from "../../types/regras.js";
import { fmtMin, sumPairs } from "../../utils/tempo.js";

export function regraIntrajornadaInsuficiente(ctx) {
  if (!ctx.isEventoTrabalhado) return null;
  if (ctx.marcacoes.length < 4) return null;
  const worked = sumPairs(ctx.marcacoes);
  const interval = Math.max(0, ctx.marcacoes[2].minutes - ctx.marcacoes[1].minutes);
  if (worked <= ctx.params.jornadaIntrajornadaMinutos || interval >= ctx.params.intervaloIntrajornadaMinutos) return null;
  return createAnomalia({
    severity: "critica",
    code: "INTRAJORNADA_INSUFICIENTE",
    message: "Intervalo intrajornada abaixo do parametro.",
    details: `Intervalo ${fmtMin(interval)}; minimo ${fmtMin(ctx.params.intervaloIntrajornadaMinutos)}`,
    categoria: "legal",
    forcaBloqueio: true,
    memoria: [
      `Saida intervalo: ${ctx.marcacoes[1].original}`,
      `Retorno intervalo: ${ctx.marcacoes[2].original}`,
      `Intervalo calculado: ${fmtMin(interval)}`,
      `Minimo configurado: ${fmtMin(ctx.params.intervaloIntrajornadaMinutos)}`,
    ],
  });
}
