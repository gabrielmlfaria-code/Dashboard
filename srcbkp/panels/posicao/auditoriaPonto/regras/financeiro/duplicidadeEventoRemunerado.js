import { createAnomalia } from "../../types/regras.js";
import {
  isEventoAusenciaIntegralText,
  isEventoPresencaText,
  textFromEvent,
} from "../classificacaoEventos.js";
import { isEventoAjustePonto } from "./classificacaoFinanceira.js";

function getEventosDia(input) {
  const value = input?.eventosDia || input?.eventosMesmoDia || input?.sameDayEvents || [];
  return Array.isArray(value) ? value : [];
}

function isEventoComplementarOuRisco(text) {
  return (
    isEventoAjustePonto(text) ||
    text.includes("total de jornada") ||
    text.includes("jornada maior que") ||
    text.includes("risco trab") ||
    text.includes("risco trabalhista") ||
    text.includes("atraso refeicao") ||
    text.includes("atraso refeição") ||
    text.includes("intervalo menor") ||
    text.includes("sem intervalo") ||
    text.includes("mais de 6 horas sem refeicao") ||
    text.includes("mais de 6 horas sem refeição") ||
    /\b(1h|sir|6hsi)\b/.test(text)
  );
}

function uniqueEventKey(item) {
  return [
    item?.cod || item?.codigo || "",
    item?.evento || item?.situacaoDesc || item || "",
    item?.horas || "",
  ]
    .map((part) => String(part ?? "").replace(/\s+/g, " ").trim())
    .join("|");
}

export function regraDuplicidadeEventoRemunerado(ctx) {
  const eventos = getEventosDia(ctx.input);
  if (eventos.length < 2) return null;

  const unique = new Map();
  for (const item of eventos) {
    unique.set(uniqueEventKey(item), item);
  }

  const eventosAuditaveis = [...unique.values()].filter((item) => {
    const text = textFromEvent(item);
    return !isEventoComplementarOuRisco(text);
  });
  const ausencia = eventos.find((item) => isEventoAusenciaIntegralText(item));
  const presencaOuExtra = eventos.find((item) => {
    const text = textFromEvent(item);
    return text.includes("horas normais") || text.includes("extra") || text.includes("banco");
  });
  const jornadasPrincipais = eventosAuditaveis.filter((item) => isEventoPresencaText(item, ctx.params));
  const conflitoAusenciaComTrabalho = Boolean(ausencia && presencaOuExtra);
  const duplicidadeJornadaPrincipal = jornadasPrincipais.length > 1;
  if (!conflitoAusenciaComTrabalho && !duplicidadeJornadaPrincipal) return null;

  return createAnomalia({
    severity: "alta",
    code: "DUPLICIDADE_EVENTO_REMUNERADO",
    message: "Possivel duplicidade ou conflito de eventos remunerados no mesmo dia.",
    details: "Revise se os eventos coexistem corretamente ou se ha pagamento/abono duplicado.",
    categoria: "financeiro",
    memoria: [
      `Eventos avaliados: ${eventos.map((item) => item?.evento || item?.situacaoDesc || item).join(" | ")}`,
      `Jornadas principais conflitantes: ${jornadasPrincipais.length}`,
    ],
  });
}
