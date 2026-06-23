import { createAnomalia } from "../../types/regras.js";

export function regraPareamentoAmbiguo(ctx) {
  if (!ctx.isEventoPresencaPrincipal) return null;
  const ambiguos = ctx.pareamento.filter((item) => item.status === "AMBIGUO");
  if (!ambiguos.length) return null;
  return createAnomalia({
    severity: "media",
    code: "PAREAMENTO_AMBIGUO",
    message: "Ha mais de uma marcacao possivel para o mesmo horario previsto.",
    categoria: "operacional",
    memoria: ambiguos.map((item) => `Previsto ${item.horarioPrevisto?.original || "-"}; marcado ${item.marcacaoEncontrada?.original || "-"}`),
  });
}
