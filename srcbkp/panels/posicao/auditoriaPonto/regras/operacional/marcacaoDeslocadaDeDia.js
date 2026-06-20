import { createAnomalia } from "../../types/regras.js";

export function regraMarcacaoDeslocadaDeDia(ctx) {
  if (!ctx.isEventoPresencaPrincipal) return null;
  const marcacaoCruzaDia = ctx.marcacoes.some((item) => item.cruzouMeiaNoite || item.dayOffset > 0);
  const horarioCruzaDia = ctx.planejados.some((item) => item.cruzouMeiaNoite || item.dayOffset > 0);
  if (!marcacaoCruzaDia) return null;
  if (horarioCruzaDia) return null;
  const eventText = ctx.eventText;
  if (eventText.includes("noturno") || eventText.includes("nocturno")) return null;
  return createAnomalia({
    severity: "baixa",
    code: "MARCACAO_DESLOCADA_DE_DIA",
    message: "Marcacoes cruzam meia-noite fora do horario planejado; validar data da jornada.",
    categoria: "operacional",
    memoria: [
      `Horario normalizado: ${ctx.planejados.map((m) => `${m.original}+${m.dayOffset}d`).join(" ") || "-"}`,
      `Marcacoes normalizadas: ${ctx.marcacoes.map((m) => `${m.original}+${m.dayOffset}d`).join(" ")}`,
    ],
  });
}
