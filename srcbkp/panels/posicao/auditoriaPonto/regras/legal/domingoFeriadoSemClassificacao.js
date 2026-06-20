import { createAnomalia } from "../../types/regras.js";
import { isEventoDomingoFeriadoClassificado } from "../classificacaoEventos.js";
import { isEventoSemMarcacaoAceitavel } from "./eventoSemMarcacao.js";

function isSundayIso(dateIso) {
  if (!dateIso) return false;
  const date = new Date(`${dateIso}T00:00:00`);
  return !Number.isNaN(date.getTime()) && date.getDay() === 0;
}

function isDomingoOuFeriado(input) {
  const diaSemana = String(input?.diaSemana || input?.weekday || "").toLowerCase();
  return Boolean(
    input?.isFeriado ||
      input?.feriado ||
      input?.isDomingo ||
      input?.domingo ||
      diaSemana.includes("dom") ||
      isSundayIso(input?.data),
  );
}

export function regraDomingoFeriadoSemClassificacao(ctx) {
  if (!isDomingoOuFeriado(ctx.input)) return null;
  if (isEventoDomingoFeriadoClassificado(ctx.eventText)) return null;
  if (isEventoSemMarcacaoAceitavel(ctx.input, ctx.params)) return null;
  if (ctx.isEventoPresencaPrincipal && ctx.planejados.length) return null;
  if (!ctx.marcacoes.length && Number(ctx.input.horas || 0) <= 0) return null;

  return createAnomalia({
    severity: "alta",
    code: "DOMINGO_FERIADO_SEM_CLASSIFICACAO",
    message: "Trabalho em domingo ou feriado sem evento especifico.",
    details: "Valide se deve ser classificado como extra, folga trabalhada, feriado, DSR ou compensacao.",
    categoria: "legal",
    memoria: [
      `Data: ${ctx.input.data || "-"}`,
      `Dia/feriado informado: ${ctx.input.diaSemana || ctx.input.weekday || (ctx.input.isFeriado ? "feriado" : "-")}`,
      `Evento atual: ${ctx.input.evento || ctx.input.situacaoDesc || "-"}`,
    ],
  });
}
