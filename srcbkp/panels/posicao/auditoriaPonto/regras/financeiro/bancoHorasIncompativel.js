import { createAnomalia } from "../../types/regras.js";
import { fmtMin, sumPairs } from "../../utils/tempo.js";

export function regraBancoHorasIncompativel(ctx) {
  const isCredito = ctx.eventText.includes("banco") && ctx.eventText.includes("credito");
  const isDebito = ctx.eventText.includes("banco") && ctx.eventText.includes("debito");
  if (!isCredito && !isDebito) return null;
  if (ctx.planejados.length < 2 || ctx.marcacoes.length < 2) return null;

  const horasPlanejadas = sumPairs(ctx.planejados);
  const horasMarcacoes = sumPairs(ctx.marcacoes);
  const diferenca = Math.round(horasMarcacoes - horasPlanejadas);
  const esperado = isCredito ? "credito" : "debito";
  const compativel = isCredito
    ? diferenca > ctx.params.toleranciaMinutos
    : diferenca < -ctx.params.toleranciaMinutos;
  if (compativel) return null;

  return createAnomalia({
    severity: "alta",
    code: "BANCO_HORAS_INCOMPATIVEL",
    message: `Evento de banco de horas ${esperado} incompativel com a diferenca apurada.`,
    details: `Planejadas ${fmtMin(horasPlanejadas)}; marcacoes ${fmtMin(horasMarcacoes)}; diferenca ${diferenca} min.`,
    categoria: "financeiro",
    memoria: [
      `Tipo esperado: ${esperado}`,
      `Horas planejadas: ${fmtMin(horasPlanejadas)}`,
      `Horas pelas marcacoes: ${fmtMin(horasMarcacoes)}`,
      `Diferenca marcacoes - planejadas: ${diferenca} min`,
      `Tolerancia usada: ${ctx.params.toleranciaMinutos} min`,
    ],
  });
}
