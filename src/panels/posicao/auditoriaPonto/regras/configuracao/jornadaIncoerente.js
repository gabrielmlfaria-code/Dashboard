import { createAnomalia } from "../../types/regras.js";

export function regraJornadaIncoerente(ctx) {
  if (!ctx.planejados.length || ctx.planejados.length % 2 === 0) return null;
  return createAnomalia({
    severity: "media",
    code: "JORNADA_INCOERENTE",
    message: "Horario planejado possui quantidade impar de posicoes.",
    categoria: "configuracao",
    memoria: [`Horario planejado: ${ctx.horarioTimes.join(" ") || "-"}`],
  });
}
