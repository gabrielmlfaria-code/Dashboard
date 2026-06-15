import { createAnomalia } from "../../types/regras.js";

export function regraMarcacaoDeslocadaDeDia(ctx) {
  if (!ctx.marcacoes.some((item) => item.cruzouMeiaNoite || item.dayOffset > 0)) return null;
  const eventText = ctx.eventText;
  if (eventText.includes("noturno") || eventText.includes("nocturno")) return null;
  return createAnomalia({
    severity: "baixa",
    code: "MARCACAO_DESLOCADA_DE_DIA",
    message: "Marcacoes cruzam meia-noite; validar data da jornada.",
    categoria: "operacional",
    memoria: [`Marcacoes normalizadas: ${ctx.marcacoes.map((m) => `${m.original}+${m.dayOffset}d`).join(" ")}`],
  });
}
