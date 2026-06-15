import { createAnomalia } from "../../types/regras.js";
import { isEventoSemMarcacaoAceitavel } from "../eventoNatureza.js";

export function regraEventoSemMarcacao(ctx) {
  if (ctx.marcacoes.length || !ctx.planejados.length || isEventoSemMarcacaoAceitavel(ctx.input, ctx.params)) return null;
  return createAnomalia({
    severity: "critica",
    code: "EVENTO_SEM_MARCACAO",
    message: "Evento de jornada sem marcacoes.",
    categoria: "legal",
    forcaBloqueio: true,
    memoria: [
      "Ha horario planejado, mas nenhuma marcacao foi encontrada.",
      `Horario planejado: ${ctx.horarioTimes.join(" ") || "-"}`,
    ],
  });
}

export { isEventoSemMarcacaoAceitavel };
