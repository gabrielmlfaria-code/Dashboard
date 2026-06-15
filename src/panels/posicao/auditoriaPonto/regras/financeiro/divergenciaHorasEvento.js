import { createAnomalia } from "../../types/regras.js";
import { fmtMin, sumPairs } from "../../utils/tempo.js";

export function regraDivergenciaHorasEvento(ctx) {
  if (!ctx.isEventoTrabalhado) return null;
  if (ctx.marcacoes.length < 2 || Number(ctx.input.horas || 0) <= 0) return null;
  const calc = sumPairs(ctx.marcacoes);
  const diff = Math.abs(calc - Number(ctx.input.horas || 0));
  if (diff <= ctx.params.toleranciaMinutos) return null;
  return createAnomalia({
    severity: "alta",
    code: "DIVERGENCIA_HORAS_EVENTO",
    message: `Horas do evento diferem das marcacoes em ${Math.round(diff)} min.`,
    details: `Evento ${fmtMin(ctx.input.horas)}; marcacoes ${fmtMin(calc)}`,
    categoria: "financeiro",
    memoria: [
      `Horas do evento: ${fmtMin(ctx.input.horas)}`,
      `Horas calculadas pelas marcacoes: ${fmtMin(calc)}`,
      `Diferenca: ${Math.round(diff)} min`,
      `Tolerancia: ${ctx.params.toleranciaMinutos} min`,
    ],
  });
}
