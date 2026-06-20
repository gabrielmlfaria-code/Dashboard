import { createAnomalia } from "../../types/regras.js";
import { fmtMin } from "../../utils/tempo.js";

export function regraHoraExtraAcimaLimiteLegal(ctx) {
  if (!ctx.isEventoTrabalhado) return null;
  if (!ctx.eventText.includes("extra")) return null;
  const horas = Number(ctx.input.horas || 0);
  if (horas <= ctx.params.limiteHoraExtraDiariaMinutos) return null;
  return createAnomalia({
    severity: "alta",
    code: "HORA_EXTRA_ACIMA_LIMITE",
    message: "Hora extra acima do limite diario parametrizado.",
    categoria: "legal",
    memoria: [
      `Horas extras no evento: ${fmtMin(horas)}`,
      `Limite parametrizado: ${fmtMin(ctx.params.limiteHoraExtraDiariaMinutos)}`,
    ],
  });
}
