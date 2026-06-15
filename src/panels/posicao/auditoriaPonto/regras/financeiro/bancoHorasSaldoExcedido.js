import { createAnomalia } from "../../types/regras.js";
import { fmtMin } from "../../utils/tempo.js";

export function regraBancoHorasSaldoExcedido(ctx) {
  const saldo = Number(
    ctx.input.saldoBancoMinutosDepois ??
      ctx.input.saldoBancoMinutos ??
      ctx.input.bancoHorasSaldoMinutos ??
      NaN,
  );
  if (!Number.isFinite(saldo)) return null;

  const limitePositivo = Number(ctx.params.limiteBancoHorasPositivoMinutos || 0);
  const limiteNegativo = Number(ctx.params.limiteBancoHorasNegativoMinutos || 0);
  const positivoExcedido = limitePositivo > 0 && saldo > limitePositivo;
  const negativoExcedido = limiteNegativo > 0 && saldo < -limiteNegativo;
  if (!positivoExcedido && !negativoExcedido) return null;

  return createAnomalia({
    severity: "alta",
    code: "BANCO_HORAS_SALDO_EXCEDIDO",
    message: "Saldo de banco de horas fora do limite parametrizado.",
    details: `Saldo ${saldo} min; limite positivo ${limitePositivo} min; limite negativo ${limiteNegativo} min.`,
    categoria: "financeiro",
    memoria: [
      `Saldo apurado: ${saldo < 0 ? "-" : ""}${fmtMin(Math.abs(saldo))}`,
      `Limite positivo: ${fmtMin(limitePositivo)}`,
      `Limite negativo: -${fmtMin(limiteNegativo)}`,
    ],
  });
}
