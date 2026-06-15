import { createAnomalia } from "../../types/regras.js";
import { isEventoPresencaText } from "../classificacaoEventos.js";

export function regraPresencaSemJornadaUtil(ctx) {
  if (!isEventoPresencaText(ctx.input)) return null;
  if (Number(ctx.input.horas || 0) > 0 || ctx.marcacoes.length || ctx.planejados.length) return null;

  return createAnomalia({
    severity: "critica",
    code: "PRESENCA_SEM_JORNADA_UTIL",
    message: "Evento de presenca sem horas, escala ou marcacoes.",
    details: "Pode indicar evento importado incorretamente ou colaborador marcado como presente sem base de jornada.",
    categoria: "configuracao",
    forcaBloqueio: true,
    memoria: [
      `Evento: ${ctx.input.evento || ctx.input.situacaoDesc || "-"}`,
      "Horas do evento: 0",
      "Horario planejado: -",
      "Marcacoes: -",
    ],
  });
}
