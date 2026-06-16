import { createAnomalia } from "../../types/regras.js";
import { fmtMin } from "../../utils/tempo.js";

function hasProrrogacaoNoturna(ctx) {
  if (ctx.marcacoes.length < 2) return false;
  const primeira = ctx.marcacoes[0];
  const ultima = ctx.marcacoes[ctx.marcacoes.length - 1];
  const iniciouPeriodoNoturno = primeira.baseMinutes >= 22 * 60 || primeira.baseMinutes < 5 * 60;
  const passouDasCinco = ultima.minutes > (ultima.dayOffset > 0 ? 24 * 60 + 5 * 60 : 5 * 60);
  return iniciouPeriodoNoturno && passouDasCinco;
}

export function regraAdicionalNoturnoProrrogacaoNaoClassificada(ctx) {
  if (!ctx.isEventoTrabalhado) return null;
  if (!ctx.isEventoPresencaPrincipal) return null;
  if (!hasProrrogacaoNoturna(ctx)) return null;
  if (ctx.eventText.includes("noturn") || ctx.eventText.includes("prorrog")) return null;

  const primeira = ctx.marcacoes[0].original || "-";
  const ultima = ctx.marcacoes[ctx.marcacoes.length - 1].original || "-";
  const limiteCinco = ctx.marcacoes[ctx.marcacoes.length - 1].dayOffset > 0 ? 24 * 60 + 5 * 60 : 5 * 60;
  const prorrogacao = Math.max(0, ctx.marcacoes[ctx.marcacoes.length - 1].minutes - limiteCinco);

  return createAnomalia({
    severity: "alta",
    code: "PRORROGACAO_NOTURNA_NAO_CLASSIFICADA",
    message: "Jornada noturna prorrogada sem classificacao especifica.",
    details: `Marcacoes de ${primeira} ate ${ultima}; prorrogacao apos 05:00 de ${fmtMin(prorrogacao)}.`,
    categoria: "legal",
    memoria: [
      `Primeira marcacao: ${primeira}`,
      `Ultima marcacao: ${ultima}`,
      `Tempo apos 05:00: ${fmtMin(prorrogacao)}`,
    ],
  });
}
