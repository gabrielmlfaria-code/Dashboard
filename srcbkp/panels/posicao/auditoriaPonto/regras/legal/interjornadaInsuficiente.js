import { createAnomalia } from "../../types/regras.js";
import { dayDiff, extractTimes, fmtDateShort, fmtDiffMin, fmtMin } from "../../utils/tempo.js";
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
  const minimo = ctx.params.intervaloInterjornadaMinutos;
  const deficit = minimo - descanso;
  const prevDate = fmtDateShort(ctx.input.previousData);
  const currDate = fmtDateShort(ctx.input.data);
  return createAnomalia({
    severity: "critica",
    code: "INTERJORNADA_INSUFICIENTE",
    message: `Interjornada de ${fmtDiffMin(descanso)} — faltaram ${fmtDiffMin(deficit)} para o minimo de ${fmtDiffMin(minimo)}.`,
    details: `Saida ${prevDate} ${lastPrevious.original} → entrada ${currDate} ${firstCurrent.original}`,
    categoria: "legal",
    forcaBloqueio: true,
    memoria: [
      `Saida do dia anterior: ${prevDate} às ${lastPrevious.original}`,
      `Entrada do dia atual:  ${currDate} às ${firstCurrent.original}`,
      `Descanso calculado:    ${fmtDiffMin(descanso)} (${descanso} min)`,
      `Minimo configurado:    ${fmtDiffMin(minimo)} (${minimo} min)`,
      `Deficit:               ${fmtDiffMin(deficit)} abaixo do minimo`,
    ],
  });
}
