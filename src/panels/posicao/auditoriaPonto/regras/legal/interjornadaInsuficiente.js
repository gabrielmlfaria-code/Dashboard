import { createAnomalia } from "../../types/regras.js";
import { dayDiff, extractTimes, fmtMin } from "../../utils/tempo.js";
import { normalizarMarcacoes } from "../../core/normalizador.js";

export function regraInterjornadaInsuficiente(ctx) {
  if (!ctx.isEventoTrabalhado) return null;
  if (!ctx.isEventoPresencaPrincipal) return null;
  if (!ctx.input.previousData || !ctx.input.data || ctx.input.previousData === ctx.input.data) return null;
  const previousMarks = normalizarMarcacoes(extractTimes(ctx.input.previousMarcacao), ctx.input.previousData);
  const firstCurrent = ctx.marcacoes[0];
  const lastPrevious = previousMarks[previousMarks.length - 1];
  const diffDays = dayDiff(ctx.input.previousData, ctx.input.data);
  if (!firstCurrent || !lastPrevious || diffDays <= 0) return null;
  const currentAbs = diffDays * 1440 + firstCurrent.baseMinutes;
  const descanso = currentAbs - lastPrevious.minutes;
  if (descanso <= 0 || descanso >= ctx.params.intervaloInterjornadaMinutos) return null;
  return createAnomalia({
    severity: "critica",
    code: "INTERJORNADA_INSUFICIENTE",
    message: "Intervalo interjornada abaixo do parametro.",
    details: `Descanso ${fmtMin(descanso)}; minimo ${fmtMin(ctx.params.intervaloInterjornadaMinutos)}`,
    categoria: "legal",
    forcaBloqueio: true,
    memoria: [
      `Data anterior: ${ctx.input.previousData}`,
      `Ultima saida anterior: ${lastPrevious.original}`,
      `Data atual: ${ctx.input.data}`,
      `Primeira marcacao atual: ${firstCurrent.original}`,
      `Descanso calculado: ${fmtMin(descanso)}`,
      `Minimo configurado: ${fmtMin(ctx.params.intervaloInterjornadaMinutos)}`,
    ],
  });
}
