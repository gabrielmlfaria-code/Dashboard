import { createAnomalia } from "../../types/regras.js";

export function regraTratamentoManualRecorrente(ctx) {
  if (Number(ctx.input.tratamentoManualRecorrente || 0) < 3) return null;
  return createAnomalia({
    severity: "media",
    code: "TRATAMENTO_MANUAL_RECORRENTE",
    message: "Tratamento manual recorrente para o colaborador ou evento.",
    categoria: "fraude",
    memoria: [`Ocorrencias informadas: ${Number(ctx.input.tratamentoManualRecorrente || 0)}`],
  });
}
