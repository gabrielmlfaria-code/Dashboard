import { createAnomalia } from "../../types/regras.js";

export function regraMarcacaoImpar(ctx) {
  if (ctx.marcacoes.length % 2 !== 1) return null;
  return createAnomalia({
    severity: "critica",
    code: "MARCACAO_IMPAR",
    message: "Marcacao impar; falta entrada ou saida.",
    categoria: "operacional",
    memoria: [
      `Quantidade de marcacoes: ${ctx.marcacoes.length}`,
      `Marcacoes: ${ctx.marcacaoTimes.join(" ") || "-"}`,
      "Entradas e saidas devem formar pares.",
    ],
  });
}
