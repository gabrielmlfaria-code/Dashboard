import { createAnomalia } from "../../types/regras.js";
import { fmtMin, sumPairs } from "../../utils/tempo.js";

export function regraJornadaSemIntervalo(ctx) {
  if (!ctx.isEventoTrabalhado) return null;
  if (ctx.marcacoes.length !== 2) return null;
  const horasMarcacoes = sumPairs(ctx.marcacoes);
  if (horasMarcacoes <= ctx.params.jornadaIntrajornadaMinutos) return null;

  return createAnomalia({
    severity: "critica",
    code: "JORNADA_SEM_INTERVALO",
    message: "Jornada acima do limite parametrizado sem intervalo registrado.",
    categoria: "legal",
    forcaBloqueio: true,
    memoria: [
      `Horas pelas marcacoes: ${fmtMin(horasMarcacoes)}`,
      `Jornada que exige intervalo: ${fmtMin(ctx.params.jornadaIntrajornadaMinutos)}`,
      `Marcacoes: ${ctx.marcacaoTimes.join(" ") || "-"}`,
    ],
  });
}
