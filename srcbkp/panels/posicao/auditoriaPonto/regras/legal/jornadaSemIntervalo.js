import { createAnomalia } from "../../types/regras.js";
import { fmtMin, sumPairs } from "../../utils/tempo.js";

function hasSameDayNoMealIntervalEvent(texts = []) {
  return texts.some((text) => {
    const value = String(text || "");
    return (
      /\b(6hsi|sir)\b/.test(value) ||
      (value.includes("sem") && (value.includes("intervalo") || value.includes("refeicao") || value.includes("refeição"))) ||
      value.includes("mais de 6 horas sem refeicao") ||
      value.includes("mais de 6 horas sem refeição")
    );
  });
}

export function regraJornadaSemIntervalo(ctx) {
  if (!ctx.isEventoTrabalhado) return null;
  if (!ctx.isEventoPresencaPrincipal) return null;
  if (ctx.marcacoes.length !== 2) return null;
  if (hasSameDayNoMealIntervalEvent(ctx.sameDayEventTexts)) return null;
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
