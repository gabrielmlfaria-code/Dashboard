import { createAnomalia } from "../../types/regras.js";
import { fmtMin } from "../../utils/tempo.js";

export function regraIntervaloAtipicoMarcacoes(ctx) {
  if (!ctx.isEventoPresencaPrincipal) return null;
  if (ctx.marcacoes.length < 4) return null;
  const pausas = [];
  for (let i = 1; i + 1 < ctx.marcacoes.length; i += 2) {
    const pausa = Math.max(0, ctx.marcacoes[i + 1].minutes - ctx.marcacoes[i].minutes);
    pausas.push({
      inicio: ctx.marcacoes[i],
      fim: ctx.marcacoes[i + 1],
      pausa,
    });
  }
  const longa = pausas.find((item) => item.pausa > ctx.params.intervaloIntrajornadaMaxMinutos);
  if (!longa) return null;

  return createAnomalia({
    severity: "media",
    code: "INTERVALO_ATIPICO_MARCACOES",
    message: `Intervalo intrajornada atipico de ${fmtMin(longa.pausa)}.`,
    details: `Saida ${longa.inicio.original || "-"}; retorno ${longa.fim.original || "-"}.`,
    categoria: "operacional",
    memoria: [
      `Intervalo apurado: ${fmtMin(longa.pausa)}`,
      `Limite parametrizado: ${fmtMin(ctx.params.intervaloIntrajornadaMaxMinutos)}`,
      `Saida para intervalo: ${longa.inicio.original || "-"}`,
      `Retorno do intervalo: ${longa.fim.original || "-"}`,
    ],
  });
}
