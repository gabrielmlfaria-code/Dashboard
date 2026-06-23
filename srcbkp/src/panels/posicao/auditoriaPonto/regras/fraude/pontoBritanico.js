import { createAnomalia } from "../../types/regras.js";

export function regraPontoBritanico(ctx) {
  if (!ctx.isEventoTrabalhado) return null;
  if (!ctx.isEventoPresencaPrincipal) return null;
  if (Number(ctx.input.pontoBritanicoRepeticoes || 0) < ctx.params.pontoBritanicoDias || ctx.marcacoes.length < 2) {
    return null;
  }
  return createAnomalia({
    severity: "alta",
    code: "PONTO_BRITANICO",
    message: `Padrao de marcacoes repetido em ${Number(ctx.input.pontoBritanicoRepeticoes || 0)} dias.`,
    details: `Assinatura ${ctx.input.pontoBritanicoAssinatura || "-"}`,
    categoria: "fraude",
    memoria: [
      `Repeticoes: ${Number(ctx.input.pontoBritanicoRepeticoes || 0)} dias`,
      `Minimo configurado: ${ctx.params.pontoBritanicoDias} dias`,
      `Marcacoes avaliadas: ${ctx.input.pontoBritanicoAssinatura || "-"}`,
    ],
  });
}
