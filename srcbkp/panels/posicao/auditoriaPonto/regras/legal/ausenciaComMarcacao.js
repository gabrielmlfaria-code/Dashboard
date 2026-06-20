import { createAnomalia } from "../../types/regras.js";
import { fmtMin, sumPairs } from "../../utils/tempo.js";
import { isEventoAusenciaIntegralText } from "../classificacaoEventos.js";

export function isEventoAusenciaIntegral(input) {
  return isEventoAusenciaIntegralText(input);
}

export function regraAusenciaComMarcacao(ctx) {
  if (!isEventoAusenciaIntegral(ctx.input) || ctx.marcacoes.length < 2) return null;

  const horasMarcacoes = sumPairs(ctx.marcacoes);
  return createAnomalia({
    severity: "critica",
    code: "AUSENCIA_COM_MARCACAO",
    message: "Evento de ausencia possui marcacoes de trabalho.",
    details: "Verifique se houve erro de evento, pagamento em duplicidade ou registro indevido de ausencia.",
    categoria: "legal",
    forcaBloqueio: true,
    memoria: [
      "Evento classificado como ausencia integral, mas existem marcacoes no dia.",
      `Evento: ${ctx.input.evento || ctx.input.situacaoDesc || "-"}`,
      `Marcacoes encontradas: ${ctx.marcacaoTimes.join(" ") || "-"}`,
      `Horas calculadas pelas marcacoes: ${horasMarcacoes > 0 ? fmtMin(horasMarcacoes) : "0:00"}`,
    ],
    evidencia: {
      tipoEvento: "ausencia_integral",
      marcacoesEncontradas: [...ctx.marcacaoTimes],
      horasMarcacoes: horasMarcacoes > 0 ? fmtMin(horasMarcacoes) : "0:00",
    },
  });
}
