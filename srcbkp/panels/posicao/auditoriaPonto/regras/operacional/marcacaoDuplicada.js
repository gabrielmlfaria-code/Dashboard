import { createAnomalia } from "../../types/regras.js";

export function regraMarcacaoDuplicada(ctx) {
  if (!ctx.isEventoPresencaPrincipal) return null;
  for (let i = 1; i < ctx.marcacoes.length; i += 1) {
    const diff = ctx.marcacoes[i].minutes - ctx.marcacoes[i - 1].minutes;
    if (diff >= 0 && diff <= ctx.params.toleranciaDuplicidadeMinutos) {
      return createAnomalia({
        severity: "alta",
        code: "MARCACAO_DUPLICADA",
        message: "Possivel batida duplicada.",
        details: `${ctx.marcacoes[i - 1].original} e ${ctx.marcacoes[i].original}`,
        categoria: "operacional",
        memoria: [
          `Marcacao anterior: ${ctx.marcacoes[i - 1].original}`,
          `Marcacao atual: ${ctx.marcacoes[i].original}`,
          `Diferenca: ${diff} min`,
          `Tolerancia duplicidade: ${ctx.params.toleranciaDuplicidadeMinutos} min`,
        ],
      });
    }
  }
  return null;
}
