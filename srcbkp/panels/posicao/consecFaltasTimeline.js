import { getDateMeta, normDateKey } from "./calendarUtils.js";
import { _parseMarcacoesString } from "./posicaoImport.js";
import { isEmpFaltaDay } from "./radarHoursUtils.js";

export const TIMELINE_PRESETS = [7, 15, 30];
export const EMP_PRESENCE_PRESET_ATUAL = "atual";
export const EMP_PRESENCE_PRESETS = [7, 15, 30, 60, 90];

/** De/Até do modal alinhados ao período de apuração (sem recorte de 31 dias). */
export function resolveModalDatesFromApuracao(periodoApuracao, histRowsAll) {
  const sorted = [...(Array.isArray(histRowsAll) ? histRowsAll : [])]
    .filter((r) => r?.date)
    .sort((a, b) => String(a.date).localeCompare(String(b.date)));
  const dataMin = sorted[0]?.date || "";
  const dataMax = sorted[sorted.length - 1]?.date || "";

  let de = normDateKey(periodoApuracao?.de);
  let ate = normDateKey(periodoApuracao?.ate);

  if (de && ate) {
    if (dataMin && de < dataMin) de = dataMin;
    if (dataMax && ate > dataMax) ate = dataMax;
    if (de <= ate) return { dateFrom: de, dateTo: ate };
  }

  return resolveDefaultModalDates(periodoApuracao, histRowsAll);
}

function getHistRowsDateBounds(histRows) {
  const sorted = [...(Array.isArray(histRows) ? histRows : [])]
    .filter((r) => r?.date)
    .sort((a, b) => String(a.date).localeCompare(String(b.date)));
  return {
    dataMin: sorted[0]?.date || "",
    dataMax: sorted[sorted.length - 1]?.date || "",
  };
}

export function resolveEmpPresenceRange(
  presetDays,
  periodoApuracao,
  modalDateFrom,
  modalDateTo,
  histRows,
) {
  const { dataMin, dataMax } = getHistRowsDateBounds(histRows);

  if (presetDays === EMP_PRESENCE_PRESET_ATUAL) {
    let dateFrom = normDateKey(periodoApuracao?.de) || normDateKey(modalDateFrom);
    let dateTo = normDateKey(periodoApuracao?.ate) || normDateKey(modalDateTo);
    if (dataMin && dateFrom && dateFrom < dataMin) dateFrom = dataMin;
    if (dataMax && dateTo && dateTo > dataMax) dateTo = dataMax;
    return { dateFrom, dateTo };
  }

  let dateTo = normDateKey(modalDateTo) || dataMax;
  let dateFrom = resolvePresetDateFrom(dateTo, presetDays, modalDateFrom || dataMin);
  if (dataMin && dateFrom && dateFrom < dataMin) dateFrom = dataMin;
  if (dataMax && dateTo && dateTo > dataMax) dateTo = dataMax;
  return { dateFrom, dateTo };
}

export function fmtShortDate(iso) {
  const m = String(iso || "").match(/^(\d{4})-(\d{2})-(\d{2})/);
  return m ? `${m[3]}/${m[2]}/${m[1].slice(-2)}` : String(iso || "—");
}

export function fmtSequencia(inicio, fim) {
  if (!inicio) return "—";
  if (!fim || inicio === fim) return fmtShortDate(inicio);
  return `${fmtShortDate(inicio)} – ${fmtShortDate(fim)}`;
}

export const TIMELINE_LEGEND = [
  { status: "falta", label: "Falta" },
  { status: "atraso", label: "Atraso" },
  { status: "presente", label: "Presente" },
  { status: "just", label: "Justificado" },
  { status: "off", label: "Sem escala" },
  { status: "empty", label: "Sem registro" },
];

/** Legenda exibida no drill (sem dias neutros). */
export const TIMELINE_LEGEND_DRILL = TIMELINE_LEGEND.filter(
  (item) => item.status !== "off" && item.status !== "empty",
);

export const TIMELINE_MAX_DAYS = 42;
export const TIMELINE_FOCUS_MAX_DAYS = 21;
export const TIMELINE_AUTO_FOCUS_AFTER = 14;
export const TIMELINE_STREAK_PAD = 5;
export const DEFAULT_MODAL_RANGE_DAYS = 31;

function shiftDateKey(dateKey, deltaDays) {
  const key = normDateKey(dateKey);
  if (!key) return null;
  const m = key.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!m) return null;
  const dt = new Date(+m[1], +m[2] - 1, +m[3]);
  dt.setDate(dt.getDate() + deltaDays);
  return normDateKey(dt);
}

export function enumerateDateRange(dateFrom, dateTo) {
  const from = normDateKey(dateFrom);
  const to = normDateKey(dateTo);
  if (!from || !to || from > to) return [];
  const out = [];
  let cur = from;
  while (cur && cur <= to) {
    out.push(cur);
    const next = shiftDateKey(cur, 1);
    if (!next || next === cur) break;
    cur = next;
  }
  return out;
}

/** Recorta o intervalo exibido no heatmap quando o filtro De/Até é longo demais. */
export function resolveTimelineRange(
  dateFrom,
  dateTo,
  streakInicio,
  streakFim,
  { maxDays = TIMELINE_MAX_DAYS, focusMaxDays = TIMELINE_FOCUS_MAX_DAYS, showFullPeriod = false } = {},
) {
  const from = normDateKey(dateFrom);
  const to = normDateKey(dateTo);
  const all = enumerateDateRange(from, to);
  if (!all.length) return { viewFrom: from, viewTo: to, focused: false, totalDays: 0 };

  if (showFullPeriod) {
    return { viewFrom: from, viewTo: to, focused: false, totalDays: all.length };
  }

  const streakStart = normDateKey(streakInicio);
  const streakEnd = normDateKey(streakFim);

  const focusOnStreak =
    !showFullPeriod &&
    streakStart &&
    streakEnd &&
    all.length > TIMELINE_AUTO_FOCUS_AFTER;

  if (focusOnStreak || all.length > maxDays) {
    if (streakStart && streakEnd) {
      let viewFrom = shiftDateKey(streakStart, -TIMELINE_STREAK_PAD) || streakStart;
      let viewTo = shiftDateKey(streakEnd, TIMELINE_STREAK_PAD) || streakEnd;
      if (viewFrom < from) viewFrom = from;
      if (viewTo > to) viewTo = to;

      const focusCap = focusOnStreak ? focusMaxDays : maxDays;
      let slice = enumerateDateRange(viewFrom, viewTo);
      if (slice.length > focusCap) {
        const streakLen = enumerateDateRange(streakStart, streakEnd).length;
        const pad = Math.max(TIMELINE_STREAK_PAD, Math.floor((focusCap - streakLen) / 2));
        viewFrom = shiftDateKey(streakStart, -pad) || streakStart;
        viewTo = shiftDateKey(streakEnd, pad) || streakEnd;
        if (viewFrom < from) viewFrom = from;
        if (viewTo > to) viewTo = to;
        slice = enumerateDateRange(viewFrom, viewTo);
        if (slice.length > focusCap) {
          viewTo = viewFrom;
          for (let i = 0; i < focusCap - 1; i += 1) {
            const next = shiftDateKey(viewTo, 1);
            if (!next || next > to) break;
            viewTo = next;
          }
        }
      }

      return {
        viewFrom,
        viewTo,
        focused: true,
        totalDays: all.length,
      };
    }

    const tail = all.slice(-maxDays);
    return {
      viewFrom: tail[0],
      viewTo: tail[tail.length - 1],
      focused: true,
      totalDays: all.length,
    };
  }

  return { viewFrom: from, viewTo: to, focused: false, totalDays: all.length };
}

export function resolveDefaultModalDates(periodoApuracao, histRowsAll, maxDays = DEFAULT_MODAL_RANGE_DAYS) {
  const sorted = [...(Array.isArray(histRowsAll) ? histRowsAll : [])]
    .filter((r) => r?.date)
    .sort((a, b) => String(a.date).localeCompare(String(b.date)));
  const dataMin = sorted[0]?.date || "";
  const dataMax = sorted[sorted.length - 1]?.date || "";

  let de = normDateKey(periodoApuracao?.de);
  let ate = normDateKey(periodoApuracao?.ate);

  if (de && ate) {
    if (dataMin && de < dataMin) de = dataMin;
    if (dataMax && ate > dataMax) ate = dataMax;
    const periodDays = enumerateDateRange(de, ate);
    if (periodDays.length > maxDays) {
      const tail = periodDays.slice(-maxDays);
      return { dateFrom: tail[0], dateTo: tail[tail.length - 1] };
    }
    return { dateFrom: de, dateTo: ate };
  }

  if (!sorted.length) return { dateFrom: "", dateTo: "" };
  const all = sorted.map((r) => r.date);
  if (all.length > maxDays) {
    const tail = all.slice(-maxDays);
    return { dateFrom: tail[0], dateTo: tail[tail.length - 1] };
  }
  return { dateFrom: all[0], dateTo: all[all.length - 1] };
}

export function normalizeMatKey(mat) {
  return String(mat ?? "").trim();
}

export function findEmpInRow(row, { mat, nome } = {}) {
  const emps = row?._employees || [];
  const matKey = normalizeMatKey(mat);
  if (matKey) {
    const byMat = emps.find((e) => normalizeMatKey(e?.mat) === matKey);
    if (byMat) return byMat;
  }
  const nameKey = String(nome ?? "").trim().toLowerCase();
  if (!nameKey) return null;
  return emps.find((e) => String(e?.nome ?? "").trim().toLowerCase() === nameKey) || null;
}

export function collectEmpActiveDates(histRows, identity, dateFrom, dateTo) {
  const rowsByDate = new Map(
    (histRows || []).filter((r) => r?.date).map((r) => [normDateKey(r.date), r]),
  );
  const out = [];
  for (const date of enumerateDateRange(dateFrom, dateTo)) {
    const meta = getDateMeta(date);
    const row = rowsByDate.get(date);
    const emp = findEmpInRow(row, identity);
    const status = classifyEmpDay(emp, meta);
    if (status !== "off" && status !== "empty") out.push(date);
  }
  return out;
}

export function resolveEmpTimelineView(
  dateFrom,
  dateTo,
  streakInicio,
  streakFim,
  activeDates,
  { maxDays = TIMELINE_MAX_DAYS, focusMaxDays = TIMELINE_FOCUS_MAX_DAYS, showFullPeriod = false } = {},
) {
  const range = resolveTimelineRange(dateFrom, dateTo, streakInicio, streakFim, {
    maxDays,
    focusMaxDays,
    showFullPeriod,
  });
  if (showFullPeriod || !range.focused || !activeDates?.length) return range;

  const hasActivityInView = activeDates.some(
    (date) => date >= range.viewFrom && date <= range.viewTo,
  );
  if (hasActivityInView) return range;

  const tail = activeDates.slice(-maxDays);
  if (!tail.length) return range;

  let viewFrom = tail[0];
  let viewTo = tail[tail.length - 1];
  if (enumerateDateRange(viewFrom, viewTo).length > maxDays) {
    viewFrom = shiftDateKey(viewTo, -(maxDays - 1)) || viewFrom;
  }

  return {
    ...range,
    viewFrom,
    viewTo,
    activityFocused: true,
  };
}

function classifyEmpDay(emp, meta) {
  if (!emp) {
    if (meta?.isWeekend || meta?.feriado || meta?.isPonte) return "off";
    return "empty";
  }
  if (emp.cat === "atraso" || ((Number(emp.hrsAtraso) || 0) > 0 && !isEmpFaltaDay(emp))) {
    return "atraso";
  }
  if (isEmpFaltaDay(emp)) return "falta";
  if ((Number(emp.hrsJust) || 0) > 0) return "just";
  if (["folga", "ferias", "afastados"].includes(emp.cat)) return "just";
  if ((Number(emp.hrsPres) || 0) > 0 || ["presentes", "ja_saiu"].includes(emp.cat)) {
    return "presente";
  }
  if (meta?.isWeekend || meta?.feriado) return "off";
  return "empty";
}

function statusLabel(status) {
  return TIMELINE_LEGEND.find((item) => item.status === status)?.label || status;
}

export function resolvePresetDateFrom(dateTo, presetDays, modalDateFrom) {
  if (!presetDays || !dateTo) return normDateKey(modalDateFrom);
  const to = normDateKey(dateTo);
  const fromBound = normDateKey(modalDateFrom);
  if (!to) return fromBound;
  let from = shiftDateKey(to, -(presetDays - 1)) || to;
  if (fromBound && from < fromBound) from = fromBound;
  return from;
}

export function getEmpMarcacoes(emp, row, matKey) {
  if (Array.isArray(emp?.marcacoes) && emp.marcacoes.length) return emp.marcacoes;
  const events = Array.isArray(row?._events) ? row._events : [];
  for (const ev of events) {
    const m = String(ev?.mat ?? ev?.matricula ?? "").trim();
    if (m !== matKey) continue;
    if (ev?.marcacao) return _parseMarcacoesString(ev.marcacao);
  }
  return [];
}

/** KPIs do colaborador no intervalo efetivo (preset ou filtro do modal). */
export function computeEmpViewStats(histRows, mat, dateFrom, dateTo, nome = "") {
  const identity = { mat, nome };
  const rowsByDate = new Map(
    (histRows || []).filter((r) => r?.date).map((r) => [normDateKey(r.date), r]),
  );
  let presencas = 0;
  let faltas = 0;
  let diasAtraso = 0;
  let atrasosMin = 0;
  let hrsPlan = 0;
  let hrsAuse = 0;
  let hrsJust = 0;

  for (const date of enumerateDateRange(dateFrom, dateTo)) {
    const meta = getDateMeta(date);
    const row = rowsByDate.get(date);
    const emp = findEmpInRow(row, identity);
    const status = classifyEmpDay(emp, meta);
    if (status === "off" || status === "empty") continue;
    if (emp) {
      hrsPlan += Number(emp.hrsPlan) || 0;
      hrsAuse += Number(emp.hrsAuse) || 0;
      hrsJust += Number(emp.hrsJust) || 0;
    }
    if (status === "presente") presencas += 1;
    if (status === "falta") faltas += 1;
    if (status === "atraso") {
      diasAtraso += 1;
      atrasosMin += Math.round((Number(emp?.hrsAtraso) || 0) / 60);
    }
  }

  const freqDenom = presencas + faltas + diasAtraso;
  const freqPct = freqDenom > 0 ? Math.round((presencas / freqDenom) * 100) : null;

  const absTotal = hrsAuse + hrsJust;
  let absPct = null;
  if (hrsPlan > 0) {
    absPct = +((absTotal / hrsPlan) * 100).toFixed(1);
  } else if (freqDenom > 0) {
    absPct = +(((faltas + diasAtraso) / freqDenom) * 100).toFixed(1);
  }

  return {
    presencas,
    faltas,
    atrasosMin,
    freqPct,
    absPct,
    hrsPlan,
    dias: enumerateDateRange(dateFrom, dateTo).length,
  };
}

function buildCellTitle(date, meta, status, emp, { inStreak = false, isolatedFalta = false } = {}) {
  const parts = [meta?.label || date, meta?.dowLabel, statusLabel(status)];
  if (isolatedFalta) parts.push("Falta isolada (fora da sequência alertada)");
  else if (inStreak) parts.push("Sequência alertada");
  if (meta?.feriado) parts.push(meta.feriado);
  if (emp?.evento) parts.push(emp.evento);
  return parts.filter(Boolean).join(" · ");
}

/** Timeline diária do colaborador no intervalo De/Até (com foco na sequência se necessário). */
export function buildEmpTimeline({
  mat,
  nome = "",
  dateFrom,
  dateTo,
  histRows,
  streakInicio,
  streakFim,
  showFullPeriod = false,
}) {
  const identity = { mat, nome };
  const matKey = normalizeMatKey(mat);
  const rowsByDate = new Map(
    (histRows || []).filter((r) => r?.date).map((r) => [normDateKey(r.date), r]),
  );
  const streakStart = normDateKey(streakInicio);
  const streakEnd = normDateKey(streakFim);
  const activeDates = collectEmpActiveDates(histRows, identity, dateFrom, dateTo);
  const { viewFrom, viewTo, focused, totalDays, activityFocused } = resolveEmpTimelineView(
    dateFrom,
    dateTo,
    streakInicio,
    streakFim,
    activeDates,
    { showFullPeriod },
  );

  const days = enumerateDateRange(viewFrom, viewTo).map((date) => {
    const meta = getDateMeta(date);
    const row = rowsByDate.get(date);
    const emp = findEmpInRow(row, identity);
    const status = classifyEmpDay(emp, meta);
    const inStreak =
      status === "falta" && streakStart && streakEnd && date >= streakStart && date <= streakEnd;
    const isolatedFalta = status === "falta" && !inStreak;

    const marcacoes = getEmpMarcacoes(emp, row, matKey);

    return {
      date,
      dowLabel: meta?.dowLabel?.slice(0, 3) || "—",
      dayLabel: meta?.label?.slice(0, 5) || date.slice(8, 10),
      status,
      inStreak,
      isolatedFalta,
      marcacoes,
      hrsAtraso: Number(emp?.hrsAtraso) || 0,
      title: buildCellTitle(date, meta, status, emp, { inStreak, isolatedFalta }),
    };
  });

  return { days, focused, totalDays, viewFrom, viewTo, activityFocused };
}

/** Agrupa dias do heatmap em semanas (Dom–Sáb) para o mapa calendário. */
export function buildEmpCalendarWeeks(days) {
  if (!days?.length) return { weeks: [], dowHeaders: ["Dom", "Seg", "Ter", "Qua", "Qui", "6ª", "Sáb"] };
  const firstDow = getDateMeta(days[0].date)?.dow ?? 0;
  const cells = [];
  for (let i = 0; i < firstDow; i += 1) cells.push(null);
  days.forEach((day) => cells.push(day));
  while (cells.length % 7 !== 0) cells.push(null);
  const weeks = [];
  for (let i = 0; i < cells.length; i += 7) weeks.push(cells.slice(i, i + 7));
  return {
    weeks,
    dowHeaders: ["Dom", "Seg", "Ter", "Qua", "Qui", "6ª", "Sáb"],
  };
}

/** Dias recentes com registro ou marcações, para mini-timeline (mais recentes primeiro). */
export function buildRecentDayRecords(days, { limit = 5 } = {}) {
  return [...(days || [])]
    .filter((d) => d.status !== "off" && (d.marcacoes?.length || d.status !== "empty"))
    .sort((a, b) => b.date.localeCompare(a.date))
    .slice(0, limit);
}
