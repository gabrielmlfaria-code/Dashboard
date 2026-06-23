import { createAnomalia } from "../../types/regras.js";
import { fmtMin, sumPairs } from "../../utils/tempo.js";

function hasSameDayShortMealIntervalEvent(texts = []) {
  return texts.some((text) => {
    const value = String(text || "");
    return (
      /\b(1h|sir|6hsi)\b/.test(value) && (value.includes("intervalo") || value.includes("refeicao") || value.includes("refeição")) ||
      value.includes("intervalo menor que 1h") ||
      value.includes("intervalo menor que 1 h") ||
      value.includes("intervalo de refeicao menor") ||
      value.includes("intervalo de refeição menor") ||
      value.includes("mais de 6 horas sem refeicao") ||
      value.includes("mais de 6 horas sem refeição")
    );
  });
}

export function regraIntrajornadaInsuficiente(ctx) {
  if (!ctx.isEventoTrabalhado) return null;
  if (!ctx.isEventoPresencaPrincipal) return null;
  if (ctx.marcacoes.length < 4) return null;
  if (hasSameDayShortMealIntervalEvent(ctx.sameDayEventTexts)) return null;
  const worked = sumPairs(ctx.marcacoes);
  const interval = Math.max(0, ctx.marcacoes[2].minutes - ctx.marcacoes[1].minutes);
  if (worked <= ctx.params.jornadaIntrajornadaMinutos || interval >= ctx.params.intervaloIntrajornadaMinutos) return null;
  return createAnomalia({
    severity: "critica",
    code: "INTRAJORNADA_INSUFICIENTE",
    message: "Intervalo de refeicao abaixo do parametro.",
    details: `Intervalo de refeicao ${fmtMin(interval)}; minimo ${fmtMin(ctx.params.intervaloIntrajornadaMinutos)}`,
    categoria: "legal",
    forcaBloqueio: true,
    memoria: [
      `Saida para refeicao: ${ctx.marcacoes[1].original}`,
      `Retorno da refeicao: ${ctx.marcacoes[2].original}`,
      `Intervalo de refeicao calculado: ${fmtMin(interval)}`,
      `Minimo de refeicao configurado: ${fmtMin(ctx.params.intervaloIntrajornadaMinutos)}`,
    ],
  });
}
