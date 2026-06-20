import { createAnomalia } from "../../types/regras.js";
import {
  getSameDayEventTexts,
  isEventoExtraOuCompensado,
  normalizeFinanceiroText,
} from "./classificacaoFinanceira.js";

function normalizeText(value) {
  return normalizeFinanceiroText(value);
}

function hasSameDayMealDelayEvent(eventTexts = []) {
  return eventTexts.some((text) => {
    const value = normalizeText(text);
    return (
      value.includes("atraso refeicao") ||
      value.includes("atraso de refeicao") ||
      value.includes("refeicao atras") ||
      value.includes("refeicao tardia") ||
      value.includes("intervalo menor") ||
      value.includes("intervalo de refeicao menor") ||
      value.includes("sem intervalo") ||
      value.includes("mais de 6 horas sem refeicao") ||
      (/\b(1h|sir|6hsi)\b/.test(value) && (value.includes("intervalo") || value.includes("refeicao")))
    );
  });
}

function hasSameDayGeneralPointAdjustmentEvent(eventTexts = []) {
  return eventTexts.some((text) => {
    const value = normalizeText(text);
    return (
      /\bfm\b/.test(value) ||
      value.includes("falta de marcacao") ||
      value.includes("falta marcacao") ||
      value.includes("atrasos")
    );
  });
}

export function regraDivergenciaPlanejado(ctx) {
  if (!ctx.isEventoTrabalhado) return null;
  if (!ctx.isEventoPresencaPrincipal) return null;
  const sameDayEventTexts = getSameDayEventTexts(ctx);
  if (sameDayEventTexts.some((text) => isEventoExtraOuCompensado(text))) return null;
  if (hasSameDayGeneralPointAdjustmentEvent(sameDayEventTexts)) return null;
  const hasMealDelayEvent = hasSameDayMealDelayEvent(sameDayEventTexts);
  const item = ctx.pareamento.find((p) => {
    if (p.status !== "PAREADO") return false;
    if (hasMealDelayEvent && [1, 2].includes(Number(p.posicao))) return false;
    return Math.abs(Number(p.desvioMinutos || 0)) > ctx.params.toleranciaMinutos;
  });
  if (!item) return null;
  const pos = Number(item.posicao || 0) % 2 === 0 ? "entrada" : "saida";
  const delta = Math.round(Number(item.desvioMinutos || 0));
  return createAnomalia({
    severity: "media",
    code: "DESVIO_PLANEJADO",
    message: `${pos} com desvio de ${Math.abs(delta)} min do horario previsto.`,
    details: `Previsto ${item.horarioPrevisto?.original || "-"}; marcacao ${item.marcacaoEncontrada?.original || "-"}`,
    categoria: "financeiro",
    memoria: [
      `Posicao avaliada: ${pos}`,
      `Previsto: ${item.horarioPrevisto?.original || "-"}`,
      `Marcado: ${item.marcacaoEncontrada?.original || "-"}`,
      `Desvio: ${delta} min`,
      `Tolerancia: ${ctx.params.toleranciaMinutos} min`,
    ],
  });
}
