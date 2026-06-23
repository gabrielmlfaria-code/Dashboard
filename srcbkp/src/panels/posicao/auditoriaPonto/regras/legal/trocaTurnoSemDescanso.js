import { createAnomalia } from "../../types/regras.js";
import { fmtMin } from "../../utils/tempo.js";

export function regraTrocaTurnoSemDescanso(ctx) {
  if (!ctx.isEventoTrabalhado) return null;
  const turnoAtual = ctx.input.turno || ctx.input.escalaTurno;
  const turnoAnterior = ctx.input.previousTurno || ctx.input.turnoAnterior;
  const descanso = Number(ctx.input.descansoEntreTurnosMinutos ?? ctx.input.interjornadaMinutos ?? NaN);
  if (!turnoAtual || !turnoAnterior || turnoAtual === turnoAnterior || !Number.isFinite(descanso)) return null;
  if (descanso >= ctx.params.intervaloInterjornadaMinutos) return null;

  return createAnomalia({
    severity: "critica",
    code: "TROCA_TURNO_SEM_DESCANSO",
    message: "Troca de turno sem descanso minimo parametrizado.",
    details: `Turno anterior ${turnoAnterior}; turno atual ${turnoAtual}; descanso ${fmtMin(descanso)}.`,
    categoria: "legal",
    forcaBloqueio: true,
    memoria: [
      `Turno anterior: ${turnoAnterior}`,
      `Turno atual: ${turnoAtual}`,
      `Descanso entre turnos: ${fmtMin(descanso)}`,
      `Minimo parametrizado: ${fmtMin(ctx.params.intervaloInterjornadaMinutos)}`,
    ],
  });
}
