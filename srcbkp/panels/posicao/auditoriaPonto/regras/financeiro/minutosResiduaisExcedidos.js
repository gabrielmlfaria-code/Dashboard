import { createAnomalia } from "../../types/regras.js";

export function regraMinutosResiduaisExcedidos(ctx) {
  if (!ctx.isEventoTrabalhado) return null;
  if (!ctx.isEventoPresencaPrincipal) return null;
  const item = ctx.pareamento.find(
    (p) =>
      p.status === "PAREADO" &&
      Math.abs(Number(p.desvioMinutos || 0)) > ctx.params.minutosResiduaisMinutos &&
      Math.abs(Number(p.desvioMinutos || 0)) <= ctx.params.toleranciaMinutos,
  );
  if (!item) return null;
  return createAnomalia({
    severity: "baixa",
    code: "MINUTOS_RESIDUAIS_EXCEDIDOS",
    message: "Minutos residuais acima do parametro, mas dentro da tolerancia geral.",
    categoria: "financeiro",
    suprimidaPor: ["DESVIO_PLANEJADO"],
    memoria: [
      `Previsto: ${item.horarioPrevisto?.original || "-"}`,
      `Marcado: ${item.marcacaoEncontrada?.original || "-"}`,
      `Desvio: ${Math.round(item.desvioMinutos || 0)} min`,
    ],
  });
}
