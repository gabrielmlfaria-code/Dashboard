import { createAnomalia } from "../../types/regras.js";
import { isEventoAusenciaIntegralText, isEventoRemuneradoText, textFromEvent } from "../classificacaoEventos.js";

function getEventosDia(input) {
  const value = input?.eventosDia || input?.eventosMesmoDia || input?.sameDayEvents || [];
  return Array.isArray(value) ? value : [];
}

export function regraDuplicidadeEventoRemunerado(ctx) {
  const eventos = getEventosDia(ctx.input);
  if (eventos.length < 2) return null;

  const remunerados = eventos.filter((item) => isEventoRemuneradoText(item));
  const ausencia = eventos.find((item) => isEventoAusenciaIntegralText(item));
  const presencaOuExtra = eventos.find((item) => {
    const text = textFromEvent(item);
    return text.includes("horas normais") || text.includes("extra") || text.includes("banco");
  });
  if (remunerados.length < 2 && !(ausencia && presencaOuExtra)) return null;

  return createAnomalia({
    severity: "alta",
    code: "DUPLICIDADE_EVENTO_REMUNERADO",
    message: "Possivel duplicidade ou conflito de eventos remunerados no mesmo dia.",
    details: "Revise se os eventos coexistem corretamente ou se ha pagamento/abono duplicado.",
    categoria: "financeiro",
    memoria: [
      `Eventos avaliados: ${eventos.map((item) => item?.evento || item?.situacaoDesc || item).join(" | ")}`,
      `Eventos remunerados/conflitantes: ${remunerados.length}`,
    ],
  });
}
