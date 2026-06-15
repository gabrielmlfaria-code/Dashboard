import { createAnomalia } from "../../types/regras.js";

export function regraMarcacaoSemEscala(ctx) {
  if (!ctx.isEventoTrabalhado) return null;
  if (!ctx.marcacoes.length || ctx.planejados.length) return null;
  return createAnomalia({
    severity: "media",
    code: "MARCACAO_SEM_ESCALA",
    message: "Ha marcacoes sem horario planejado associado.",
    categoria: "configuracao",
    memoria: [`Marcacoes: ${ctx.marcacaoTimes.join(" ") || "-"}`],
  });
}
