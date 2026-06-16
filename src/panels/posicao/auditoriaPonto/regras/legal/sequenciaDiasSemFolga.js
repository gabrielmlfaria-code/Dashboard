import { createAnomalia } from "../../types/regras.js";

export function regraSequenciaDiasSemFolga(ctx) {
  if (!ctx.isEventoTrabalhado) return null;
  if (!ctx.isEventoPresencaPrincipal) return null;
  const dias = Number(ctx.input.diasConsecutivosTrabalhados || ctx.input.workDaysInSequence || 0);
  if (!dias || dias <= ctx.params.diasConsecutivosLimite) return null;

  return createAnomalia({
    severity: "alta",
    code: "SEQUENCIA_DIAS_SEM_FOLGA",
    message: `${dias} dias consecutivos trabalhados sem folga identificada.`,
    details: "Valide descanso semanal, escala e eventuais acordos coletivos aplicaveis.",
    categoria: "legal",
    memoria: [
      `Dias consecutivos informados: ${dias}`,
      `Limite parametrizado: ${ctx.params.diasConsecutivosLimite}`,
    ],
  });
}
