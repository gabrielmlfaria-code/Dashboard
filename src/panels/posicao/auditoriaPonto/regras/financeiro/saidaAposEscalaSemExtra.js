import { createAnomalia } from "../../types/regras.js";
import { fmtMin } from "../../utils/tempo.js";
import { isEventoExtraOuCompensado } from "./classificacaoFinanceira.js";

export function regraSaidaAposEscalaSemExtra(ctx) {
  if (!ctx.isEventoTrabalhado) return null;
  if (isEventoExtraOuCompensado(ctx.eventText)) return null;
  if (ctx.planejados.length < 2 || ctx.marcacoes.length < 2) return null;

  const saidaPrevista = [...ctx.planejados].reverse().find((item, reverseIndex) => {
    const originalIndex = ctx.planejados.length - 1 - reverseIndex;
    return originalIndex % 2 === 1;
  });
  const ultimaMarcacao = ctx.marcacoes[ctx.marcacoes.length - 1];
  if (!saidaPrevista || !ultimaMarcacao) return null;

  const excedente = Math.round(ultimaMarcacao.minutes - saidaPrevista.minutes);
  if (excedente <= ctx.params.toleranciaMinutos) return null;

  return createAnomalia({
    severity: "alta",
    code: "SAIDA_APOS_ESCALA_SEM_EXTRA",
    message: `Saida ${excedente} min apos a escala sem evento de extra ou compensacao.`,
    details: `Saida prevista ${saidaPrevista.original || "-"}; ultima marcacao ${ultimaMarcacao.original || "-"}.`,
    categoria: "financeiro",
    memoria: [
      "Ultima marcacao excede a saida planejada e o evento nao esta classificado como extra, banco ou compensacao.",
      `Saida prevista: ${saidaPrevista.original || "-"}`,
      `Ultima marcacao: ${ultimaMarcacao.original || "-"}`,
      `Excedente: ${excedente} min (${fmtMin(excedente)})`,
      `Tolerancia usada: ${ctx.params.toleranciaMinutos} min`,
    ],
    evidencia: {
      saidaPrevista: saidaPrevista.original || "",
      ultimaMarcacao: ultimaMarcacao.original || "",
      excedenteMinutos: excedente,
    },
  });
}
