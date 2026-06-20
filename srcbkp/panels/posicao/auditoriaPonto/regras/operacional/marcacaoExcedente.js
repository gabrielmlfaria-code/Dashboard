import { createAnomalia } from "../../types/regras.js";
import { isEventoExtraOuCompensado } from "../financeiro/classificacaoFinanceira.js";

export function regraMarcacaoExcedente(ctx) {
  if (!ctx.isEventoPresencaPrincipal) return null;
  if ((ctx.sameDayEventTexts || []).some((text) => isEventoExtraOuCompensado(text))) return null;
  const excedentes = ctx.pareamento.filter((item) => item.status === "EXCEDENTE");
  if (!excedentes.length) return null;
  return createAnomalia({
    severity: "media",
    code: "MARCACAO_EXCEDENTE",
    message: "Ha marcacoes sem horario planejado correspondente.",
    categoria: "operacional",
    memoria: excedentes.map((item) => `Excedente: ${item.marcacaoEncontrada?.original || "-"}`),
  });
}
