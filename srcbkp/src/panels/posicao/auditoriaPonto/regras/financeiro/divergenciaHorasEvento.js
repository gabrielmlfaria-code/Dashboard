import { createAnomalia } from "../../types/regras.js";
import { fmtDiffMin, fmtMin, sumPairs } from "../../utils/tempo.js";
import { isEventoPresencaText } from "../classificacaoEventos.js";
import {
  getSameDayEventTexts,
  hasSameDayPointAdjustmentEvent,
  isEventoExtraOuCompensado,
} from "./classificacaoFinanceira.js";

export function regraDivergenciaHorasEvento(ctx) {
  if (!ctx.isEventoTrabalhado) return null;
  if (!isEventoPresencaText(ctx.input, ctx.params)) return null;
  const sameDayEventTexts = getSameDayEventTexts(ctx);
  if (sameDayEventTexts.some((text) => isEventoExtraOuCompensado(text))) return null;
  if (hasSameDayPointAdjustmentEvent(ctx)) return null;
  if (ctx.marcacoes.length < 2 || Number(ctx.input.horas || 0) <= 0) return null;
  const calc = sumPairs(ctx.marcacoes);
  const diff = Math.abs(calc - Number(ctx.input.horas || 0));
  if (diff <= ctx.params.toleranciaMinutos) return null;
  const limiteAlta = Number(ctx.params.limiarsRegras?.["DIVERGENCIA_HORAS_EVENTO"] ?? 30);
  return createAnomalia({
    severity: diff >= limiteAlta ? "alta" : "media",
    code: "DIVERGENCIA_HORAS_EVENTO",
    message: `Horas do evento diferem das marcacoes em ${fmtDiffMin(diff)}.`,
    details: `Evento ${fmtMin(ctx.input.horas)}; marcacoes ${fmtMin(calc)}`,
    categoria: "financeiro",
    memoria: [
      `Horas do evento: ${fmtMin(ctx.input.horas)}`,
      `Horas calculadas pelas marcacoes: ${fmtMin(calc)}`,
      `Diferenca: ${fmtDiffMin(diff)}`,
      `Tolerancia: ${ctx.params.toleranciaMinutos} min`,
    ],
  });
}
