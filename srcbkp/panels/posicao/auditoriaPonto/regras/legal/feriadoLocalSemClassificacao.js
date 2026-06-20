import { createAnomalia } from "../../types/regras.js";
import { isEventoDomingoFeriadoClassificado } from "../classificacaoEventos.js";
import { isEventoSemMarcacaoAceitavel } from "./eventoSemMarcacao.js";

export function regraFeriadoLocalSemClassificacao(ctx) {
  const nome = ctx.input.feriadoNome || ctx.input.nomeFeriado || ctx.input.holidayName;
  const tipo = ctx.input.feriadoTipo || ctx.input.tipoFeriado || ctx.input.holidayType;
  const isLocal = Boolean(nome || ["municipal", "estadual", "local"].includes(String(tipo || "").toLowerCase()));
  if (!isLocal || isEventoDomingoFeriadoClassificado(ctx.eventText)) return null;
  if (isEventoSemMarcacaoAceitavel(ctx.input, ctx.params)) return null;
  if (!ctx.marcacoes.length && Number(ctx.input.horas || 0) <= 0) return null;

  return createAnomalia({
    severity: "alta",
    code: "FERIADO_LOCAL_SEM_CLASSIFICACAO",
    message: "Trabalho em feriado local sem evento especifico.",
    details: `${nome || "Feriado local"} ${tipo ? `(${tipo})` : ""}.`,
    categoria: "legal",
    memoria: [
      `Feriado: ${nome || "-"}`,
      `Tipo: ${tipo || "-"}`,
      `Evento atual: ${ctx.input.evento || ctx.input.situacaoDesc || "-"}`,
    ],
  });
}
