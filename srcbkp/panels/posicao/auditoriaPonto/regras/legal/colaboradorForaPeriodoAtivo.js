import { createAnomalia } from "../../types/regras.js";
import { fmtIsoDate, isAfterDate, isBeforeDate } from "../utilsDatas.js";

export function regraColaboradorForaPeriodoAtivo(ctx) {
  const data = ctx.input.data;
  const admissao = ctx.input.dataAdmissao || ctx.input.admissao || ctx.input.admissionDate;
  const demissao = ctx.input.dataDemissao || ctx.input.demissao || ctx.input.dismissalDate;
  if (!data || (!admissao && !demissao)) return null;

  const antesAdmissao = admissao && isBeforeDate(data, admissao);
  const depoisDemissao = demissao && isAfterDate(data, demissao);
  if (!antesAdmissao && !depoisDemissao) return null;

  return createAnomalia({
    severity: "critica",
    code: "COLABORADOR_FORA_PERIODO_ATIVO",
    message: antesAdmissao
      ? "Evento antes da data de admissao do colaborador."
      : "Evento apos a data de demissao do colaborador.",
    details: `Data ${fmtIsoDate(data)}; admissao ${fmtIsoDate(admissao) || "-"}; demissao ${fmtIsoDate(demissao) || "-"}.`,
    categoria: "legal",
    forcaBloqueio: true,
    memoria: [
      `Data do evento: ${fmtIsoDate(data) || "-"}`,
      `Data de admissao: ${fmtIsoDate(admissao) || "-"}`,
      `Data de demissao: ${fmtIsoDate(demissao) || "-"}`,
    ],
  });
}
