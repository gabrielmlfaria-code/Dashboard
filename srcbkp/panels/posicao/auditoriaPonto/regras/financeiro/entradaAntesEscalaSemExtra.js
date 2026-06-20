import { createAnomalia } from "../../types/regras.js";
import { fmtMin } from "../../utils/tempo.js";
import { isEventoExtraOuCompensado } from "./classificacaoFinanceira.js";

export function regraEntradaAntesEscalaSemExtra(ctx) {
  if (!ctx.isEventoTrabalhado) return null;
  if (!ctx.isEventoPresencaPrincipal) return null;
  if (isEventoExtraOuCompensado(ctx.eventText)) return null;
  if ((ctx.sameDayEventTexts || []).some((text) => isEventoExtraOuCompensado(text))) return null;
  if (ctx.planejados.length < 2 || ctx.marcacoes.length < 2) return null;

  const entradaPrevista = ctx.planejados.find((item, index) => index % 2 === 0);
  const primeiraMarcacao = ctx.marcacoes[0];
  if (!entradaPrevista || !primeiraMarcacao) return null;

  const antecipacao = Math.round(entradaPrevista.minutes - primeiraMarcacao.minutes);
  if (antecipacao <= ctx.params.toleranciaMinutos) return null;

  return createAnomalia({
    severity: "media",
    code: "ENTRADA_ANTES_ESCALA_SEM_EXTRA",
    message: `Entrada ${antecipacao} min antes da escala sem evento de extra ou compensacao.`,
    details: `Entrada prevista ${entradaPrevista.original || "-"}; primeira marcacao ${primeiraMarcacao.original || "-"}.`,
    categoria: "financeiro",
    memoria: [
      "Primeira marcacao antecede a entrada planejada e o evento nao esta classificado como extra, banco ou compensacao.",
      `Entrada prevista: ${entradaPrevista.original || "-"}`,
      `Primeira marcacao: ${primeiraMarcacao.original || "-"}`,
      `Antecipacao: ${antecipacao} min (${fmtMin(antecipacao)})`,
      `Tolerancia usada: ${ctx.params.toleranciaMinutos} min`,
    ],
    evidencia: {
      entradaPrevista: entradaPrevista.original || "",
      primeiraMarcacao: primeiraMarcacao.original || "",
      antecipacaoMinutos: antecipacao,
    },
  });
}
