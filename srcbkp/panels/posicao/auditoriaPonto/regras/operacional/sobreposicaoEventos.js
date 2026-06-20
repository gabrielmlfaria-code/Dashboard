import { createAnomalia } from "../../types/regras.js";
import { extractTimes, toMinutes } from "../../utils/tempo.js";

function intervalFromEvent(evento) {
  const times = extractTimes(evento?.horario || evento?.escala || evento?.periodo || "");
  if (times.length < 2) return null;
  const start = toMinutes(times[0]);
  const end = toMinutes(times[times.length - 1]);
  if (start == null || end == null) return null;
  return {
    label: evento?.evento || evento?.situacaoDesc || evento?.descricao || "-",
    start,
    end: end <= start ? end + 24 * 60 : end,
    startText: times[0],
    endText: times[times.length - 1],
  };
}

function hasOverlap(a, b) {
  return a.start < b.end && b.start < a.end;
}

export function regraSobreposicaoEventos(ctx) {
  const eventos = Array.isArray(ctx.input.eventosDia || ctx.input.eventosMesmoDia)
    ? (ctx.input.eventosDia || ctx.input.eventosMesmoDia)
    : [];
  const intervals = eventos.map(intervalFromEvent).filter(Boolean);
  if (intervals.length < 2) return null;

  for (let i = 0; i < intervals.length; i += 1) {
    for (let j = i + 1; j < intervals.length; j += 1) {
      if (!hasOverlap(intervals[i], intervals[j])) continue;
      return createAnomalia({
        severity: "alta",
        code: "SOBREPOSICAO_EVENTOS",
        message: "Eventos do mesmo dia possuem horarios sobrepostos.",
        details: `${intervals[i].label} (${intervals[i].startText}-${intervals[i].endText}) x ${intervals[j].label} (${intervals[j].startText}-${intervals[j].endText}).`,
        categoria: "operacional",
        memoria: [
          `Evento 1: ${intervals[i].label} ${intervals[i].startText}-${intervals[i].endText}`,
          `Evento 2: ${intervals[j].label} ${intervals[j].startText}-${intervals[j].endText}`,
        ],
      });
    }
  }

  return null;
}
