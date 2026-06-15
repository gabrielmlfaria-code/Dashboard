import { createAnomalia } from "../../types/regras.js";

export function regraDivergenciaPlanejado(ctx) {
  if (!ctx.isEventoTrabalhado) return null;
  const item = ctx.pareamento.find(
    (p) => p.status === "PAREADO" && Math.abs(Number(p.desvioMinutos || 0)) > ctx.params.toleranciaMinutos,
  );
  if (!item) return null;
  const pos = Number(item.posicao || 0) % 2 === 0 ? "entrada" : "saida";
  const delta = Math.round(Number(item.desvioMinutos || 0));
  return createAnomalia({
    severity: "media",
    code: "DESVIO_PLANEJADO",
    message: `${pos} com desvio de ${Math.abs(delta)} min do horario previsto.`,
    details: `Previsto ${item.horarioPrevisto?.original || "-"}; marcacao ${item.marcacaoEncontrada?.original || "-"}`,
    categoria: "financeiro",
    memoria: [
      `Posicao avaliada: ${pos}`,
      `Previsto: ${item.horarioPrevisto?.original || "-"}`,
      `Marcado: ${item.marcacaoEncontrada?.original || "-"}`,
      `Desvio: ${delta} min`,
      `Tolerancia: ${ctx.params.toleranciaMinutos} min`,
    ],
  });
}
