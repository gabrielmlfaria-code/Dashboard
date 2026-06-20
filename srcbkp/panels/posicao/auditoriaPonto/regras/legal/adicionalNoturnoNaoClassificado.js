import { createAnomalia } from "../../types/regras.js";

export function regraAdicionalNoturnoNaoClassificado(ctx) {
  if (!ctx.isEventoTrabalhado) return null;
  if (!ctx.isEventoPresencaPrincipal) return null;
  const hasNightMark = ctx.marcacoes.some((item) => item.baseMinutes < 5 * 60 || item.baseMinutes > 22 * 60);
  const hasNightEvent = [ctx.eventText, ...(ctx.sameDayEventTexts || [])].some(
    (text) => text.includes("noturn") || text.includes("nocturn"),
  );
  if (!hasNightMark || hasNightEvent) return null;
  return createAnomalia({
    severity: "media",
    code: "ADICIONAL_NOTURNO_NAO_CLASSIFICADO",
    message: "Ha marcacao em horario noturno sem evento noturno evidente.",
    categoria: "legal",
    memoria: [`Marcacoes: ${ctx.marcacaoTimes.join(" ") || "-"}`],
  });
}
