import { createAnomalia } from "../../types/regras.js";

export function regraParametrizacaoIncompleta(ctx) {
  const faltantes = [];
  if (ctx.input.requerCct && !ctx.input.cctId && !ctx.input.cct) faltantes.push("CCT");
  if (ctx.input.requerEscala && !ctx.input.escalaId && !ctx.input.horario) faltantes.push("escala");
  if (ctx.input.requerCusto && !Number(ctx.input.custoHora || ctx.input.custoMedioHora || 0)) faltantes.push("custo hora");
  if (ctx.input.requerPolitica && !ctx.input.politicaId) faltantes.push("politica");
  if (!faltantes.length) return null;

  return createAnomalia({
    severity: "media",
    code: "PARAMETRIZACAO_INCOMPLETA",
    message: "Parametrizacao incompleta para auditoria da jornada.",
    details: `Campos pendentes: ${faltantes.join(", ")}.`,
    categoria: "configuracao",
    memoria: [
      `Pendencias: ${faltantes.join(", ")}`,
      `Departamento: ${ctx.input.departamento || "-"}`,
      `Cargo: ${ctx.input.cargo || "-"}`,
    ],
  });
}
