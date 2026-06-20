import { createAnomalia } from "../../types/regras.js";

export function regraHoraExtraSemMarcacao(ctx) {
  if (!ctx.isEventoTrabalhado) return null;
  if (!ctx.eventText.includes("extra") || ctx.marcacoes.length >= 2) return null;
  return createAnomalia({
    severity: "alta",
    code: "EXTRA_SEM_MARCACAO",
    message: "Evento de extra sem marcacao compativel.",
    categoria: "financeiro",
    memoria: [
      `Evento: ${ctx.input.evento || ctx.input.situacaoDesc || "-"}`,
      `Marcacoes encontradas: ${ctx.marcacoes.length}`,
    ],
  });
}
