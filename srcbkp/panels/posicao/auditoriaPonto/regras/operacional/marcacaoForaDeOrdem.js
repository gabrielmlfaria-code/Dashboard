import { createAnomalia } from "../../types/regras.js";
import { toMinutes } from "../../utils/tempo.js";

export function regraMarcacaoForaDeOrdem(ctx) {
  if (!ctx.isEventoPresencaPrincipal) return null;
  const bases = ctx.marcacaoTimes.map(toMinutes).filter((v) => v != null);
  if (bases.length < 3) return null;
  const inversoes = [];
  for (let i = 1; i < bases.length; i += 1) {
    if (bases[i] < bases[i - 1] && bases[i - 1] - bases[i] < 12 * 60) {
      inversoes.push(`${ctx.marcacaoTimes[i - 1]} -> ${ctx.marcacaoTimes[i]}`);
    }
  }
  if (!inversoes.length) return null;
  return createAnomalia({
    severity: "media",
    code: "MARCACAO_FORA_DE_ORDEM",
    message: "Marcacoes aparentam estar fora da ordem esperada.",
    details: inversoes[0],
    categoria: "operacional",
    memoria: [`Inversoes encontradas: ${inversoes.join(" | ")}`],
  });
}
