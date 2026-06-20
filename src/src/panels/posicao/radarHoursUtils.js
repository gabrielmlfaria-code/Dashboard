import { normDateKey } from "./calendarUtils.js";

export const ABSENTEISMO_FORMULA_ID = "ABS_HORAS_AUSENTES_V1";
export const ABSENTEISMO_FORMULA_LABEL = "Horas ausentes / horas planejadas × 100";

export function calculateAbsenteismoPct({ horasAbs = 0, horasPlan = 0, precision = null } = {}) {
  const abs = Number(horasAbs) || 0;
  const plan = Number(horasPlan) || 0;
  if (plan <= 0) return null;
  const pct = (abs / plan) * 100;
  if (precision == null) return pct;
  const factor = 10 ** precision;
  return Math.round(pct * factor) / factor;
}

export function dayInjust(r) {
  return (Number(r?.horas_faltas) || 0) + (Number(r?.horas_atrasos) || 0);
}

export function dayJust(r) {
  return Number(r?.horas_justificadas) || 0;
}

export function dayExtr(r) {
  return Number(r?.horas_extras) || 0;
}

function shiftDateKey(dateKey, deltaDays) {
  const key = normDateKey(dateKey);
  if (!key) return null;
  const m = key.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!m) return null;
  const dt = new Date(+m[1], +m[2] - 1, +m[3]);
  dt.setDate(dt.getDate() + deltaDays);
  return normDateKey(dt);
}

/** Colaborador com falta injustificada no dia (não atraso). */
export function isEmpFaltaDay(emp) {
  if (!emp) return false;
  if (emp.cat === "atraso") return false;
  if (emp.cat === "falta") return true;
  return (Number(emp.hrsAuse) || 0) > 0;
}

function buildEmpFaltaDates(rows) {
  const byMat = new Map();
  for (const row of rows || []) {
    const date = normDateKey(row?.date);
    if (!date) continue;
    for (const emp of row._employees || []) {
      const mat = String(emp?.mat ?? "").trim();
      if (!mat || !isEmpFaltaDay(emp)) continue;
      if (!byMat.has(mat)) byMat.set(mat, new Set());
      byMat.get(mat).add(date);
    }
  }
  return byMat;
}

function longestConsecutiveStreak(sortedDates) {
  if (!sortedDates.length) return null;
  let best = { len: 1, start: sortedDates[0], end: sortedDates[0] };
  let curLen = 1;
  let curStart = sortedDates[0];

  for (let i = 1; i < sortedDates.length; i += 1) {
    if (shiftDateKey(sortedDates[i], -1) === sortedDates[i - 1]) {
      curLen += 1;
    } else {
      if (curLen > best.len) {
        best = { len: curLen, start: curStart, end: sortedDates[i - 1] };
      }
      curLen = 1;
      curStart = sortedDates[i];
    }
  }
  if (curLen > best.len) {
    best = { len: curLen, start: curStart, end: sortedDates[sortedDates.length - 1] };
  }
  return best.len >= 2 ? best : null;
}

function buildEmpMetaMap(rows) {
  const meta = new Map();
  for (const row of rows || []) {
    for (const emp of row._employees || []) {
      const mat = String(emp?.mat ?? "").trim();
      if (!mat || meta.has(mat)) continue;
      meta.set(mat, {
        mat,
        nome: String(emp.nome || emp.mat || mat).trim() || mat,
        depto: String(emp.depto_desc || emp.depto || "").trim() || "—",
      });
    }
  }
  return meta;
}

/** Colaboradores com 2+ faltas em dias de calendário consecutivos no período. */
export function computeConsecutiveFaltasStats(rows) {
  const sorted = [...(Array.isArray(rows) ? rows : [])]
    .filter((r) => r?.date)
    .sort((a, b) => (a.date || "").localeCompare(b.date || ""));
  const byMat = buildEmpFaltaDates(sorted);
  const empMeta = buildEmpMetaMap(sorted);
  const lista = [];

  for (const [mat, dates] of byMat) {
    const streak = longestConsecutiveStreak([...dates].sort());
    if (!streak) continue;
    const meta = empMeta.get(mat) || { mat, nome: mat, depto: "—" };
    lista.push({
      ...meta,
      dias: streak.len,
      inicio: streak.start,
      fim: streak.end,
    });
  }

  lista.sort(
    (a, b) =>
      b.dias - a.dias ||
      a.nome.localeCompare(b.nome, "pt-BR") ||
      a.mat.localeCompare(b.mat, "pt-BR"),
  );

  return { colaboradores: lista.length, lista };
}

/** Colaboradores em sequência de falta (falta hoje e no dia anterior). */
export function dayConsecFaltasColaboradores(row, rowsByDate) {
  const date = normDateKey(row?.date);
  if (!date) return 0;
  const prevDate = shiftDateKey(date, -1);
  const prevRow = prevDate ? rowsByDate.get(prevDate) : null;
  if (!prevRow) return 0;

  const prevByMat = new Map(
    (prevRow._employees || [])
      .filter((emp) => emp?.mat && isEmpFaltaDay(emp))
      .map((emp) => [String(emp.mat).trim(), emp]),
  );

  let count = 0;
  for (const emp of row._employees || []) {
    const mat = String(emp?.mat ?? "").trim();
    if (!mat || !isEmpFaltaDay(emp)) continue;
    if (prevByMat.has(mat)) count += 1;
  }
  return count;
}

export function dailyConsecFaltasSeries(rows) {
  const sorted = [...(Array.isArray(rows) ? rows : [])]
    .filter((r) => r?.date)
    .sort((a, b) => (a.date || "").localeCompare(b.date || ""));
  const rowsByDate = new Map(sorted.map((r) => [normDateKey(r.date), r]));
  return sorted.map((r) => ({
    date: r.date,
    value: dayConsecFaltasColaboradores(r, rowsByDate),
  }));
}

export function dayAbsPct(r) {
  const total = Math.max(Number(r?.total) || 0, 1);
  const injust = (Number(r?.faltas) || 0) + (Number(r?.atrasos) || 0);
  const just = Number(r?.justificadas) || 0;
  return +(((injust + just) / total) * 100).toFixed(1);
}

export function capWorkedHours(worked, planned) {
  const w = Number(worked) || 0;
  const p = Number(planned) || 0;
  return p > 0 ? Math.min(w, p) : w;
}

/** Espelha o enriquecimento por dia da HistoricoTable. */
export function enrichHistDayRow(r) {
  const ausentes = (Number(r?.faltas) || 0) + (Number(r?.atrasos) || 0);
  const horasAusentes =
    r?.horas_faltas != null || r?.horas_atrasos != null
      ? (Number(r?.horas_faltas) || 0) + (Number(r?.horas_atrasos) || 0)
      : null;
  const hp = r?.horas_planejadas;
  const ht = capWorkedHours(r?.horas_presentes, hp);
  const horasPerdidas =
    hp != null && ht != null ? Math.max(0, (Number(hp) || 0) - (Number(ht) || 0)) : null;
  const horasAusentesEventos =
    r?.horas_faltas != null || r?.horas_atrasos != null || r?.horas_justificadas != null
      ? (Number(r?.horas_faltas) || 0) +
        (Number(r?.horas_atrasos) || 0) +
        (Number(r?.horas_justificadas) || 0)
      : null;
  const horasAbsenteismo = horasAusentesEventos;
  const absenteismo = calculateAbsenteismoPct({
    horasAbs: horasAbsenteismo,
    horasPlan: hp,
    precision: null,
  });
  return {
    ausentes,
    horasAusentes,
    horasPerdidas,
    horasAusentesEventos,
    horasAbsenteismo,
    absenteismo,
  };
}

/** Totais do período — mesma lógica de computeTotals na HistoricoTable. */
export function computePeriodTotals(rows) {
  const list = [...(Array.isArray(rows) ? rows : [])].filter((r) => r?.date);
  const hasHours = list.some(
    (r) => r.horas_presentes != null || r.horas_planejadas != null,
  );

  const acc = {
    total: 0,
    faltas: 0,
    atrasos: 0,
    justificadas: 0,
    presentes: 0,
    horasPlan: 0,
    horasPres: 0,
    horasAus: 0,
    horasJust: 0,
    horasExtras: 0,
    horasAbs: 0,
  };

  for (const r of list) {
    const e = enrichHistDayRow(r);
    acc.total += Number(r.total) || 0;
    acc.faltas += Number(r.faltas) || 0;
    acc.atrasos += Number(r.atrasos) || 0;
    acc.justificadas += Number(r.justificadas) || 0;
    acc.presentes += Number(r.presentes) || 0;
    if (hasHours) {
      const planned = Number(r.horas_planejadas) || 0;
      acc.horasPlan += planned;
      acc.horasPres += capWorkedHours(r.horas_presentes, planned);
      acc.horasAus += e.horasAusentes || 0;
      acc.horasJust += Number(r.horas_justificadas) || 0;
      acc.horasExtras += Number(r.horas_extras) || 0;
      acc.horasAbs += e.horasAbsenteismo || 0;
    }
  }

  const horasPerdidas =
    hasHours && acc.horasPlan != null && acc.horasPres != null
      ? Math.max(0, acc.horasPlan - acc.horasPres)
      : null;
  const absPct = hasHours
    ? calculateAbsenteismoPct({ horasAbs: acc.horasAbs, horasPlan: acc.horasPlan, precision: null })
    : null;
  const perdaPct =
    hasHours && acc.horasPlan > 0 && horasPerdidas != null
      ? (horasPerdidas / acc.horasPlan) * 100
      : null;

  return {
    ...acc,
    hasHours,
    horasPerdidas,
    absPct,
    perdaPct,
  };
}

export function computeAbsenteismoDayMetric(r) {
  const total = Math.max(Number(r?.total) || 0, 1);
  const ausCount = (Number(r?.faltas) || 0) + (Number(r?.atrasos) || 0);
  const justCount = Number(r?.justificadas) || 0;
  const plannedMin = Number(r?.horas_planejadas) || 0;
  const workedMin = capWorkedHours(r?.horas_presentes, plannedMin);
  const enriched = enrichHistDayRow(r);
  const unjustMin = (Number(r?.horas_faltas) || 0) + (Number(r?.horas_atrasos) || 0);
  const justifiedMin = Number(r?.horas_justificadas) || 0;
  const indexAbsentMin = Number(enriched.horasAbsenteismo) || 0;
  const extraMin = Number(r?.horas_extras) || 0;
  const usesHours = plannedMin > 0;
  const ausRate = +(
    usesHours
      ? calculateAbsenteismoPct({ horasAbs: indexAbsentMin, horasPlan: plannedMin, precision: null }) || 0
      : (ausCount / total) * 100
  ).toFixed(1);
  const justRate = +(usesHours ? 0 : (justCount / total) * 100).toFixed(1);

  return {
    total: Number(r?.total) || 0,
    ausCount,
    justCount,
    date: r?.date,
    plannedMin,
    workedMin,
    unjustMin,
    justifiedMin,
    indexAbsentMin,
    extraMin,
    usesHours,
    ausRate,
    justRate,
    totalRate: +(ausRate + justRate).toFixed(1),
    indexRate: usesHours ? +(ausRate + justRate).toFixed(1) : ausRate,
  };
}

export function computeAbsenteismoPeriodSummary(rows) {
  const totals = computePeriodTotals(rows);
  const hasWeightedIndex = totals.hasHours && totals.horasPlan > 0;
  const periodRate = hasWeightedIndex
    ? calculateAbsenteismoPct({ horasAbs: totals.horasAbs, horasPlan: totals.horasPlan, precision: 1 })
    : totals.total > 0
      ? +(((totals.faltas + totals.atrasos) / totals.total) * 100).toFixed(1)
      : 0;

  return {
    plannedMin: totals.horasPlan || 0,
    workedMin: totals.horasPres || 0,
    unjustMin: totals.horasAbs || 0,
    justifiedMin: hasWeightedIndex ? 0 : totals.justificadas || 0,
    extraMin: totals.horasExtras || 0,
    absentPeople: (totals.faltas || 0) + (totals.atrasos || 0) + (totals.justificadas || 0),
    balanceMin: totals.horasPerdidas || 0,
    hasHourData: Boolean(totals.hasHours),
    hasWeightedIndex,
    periodRate,
    totals,
  };
}

/** Filtra linhas do histórico radar por intervalo de datas (inclusive). */
export function filterHistRowsByDateRange(rows, dateFrom = "", dateTo = "") {
  const fromKey = normDateKey(dateFrom);
  const toKey = normDateKey(dateTo);
  return (Array.isArray(rows) ? rows : []).filter((r) => {
    const d = normDateKey(r?.date);
    if (!d) return false;
    if (fromKey && d < fromKey) return false;
    if (toKey && d > toKey) return false;
    return true;
  });
}

/**
 * Totais do rodapé do modal Colaboradores — mesma regra do card Absenteísmo
 * e da linha TOTAIS da HistoricoTable (computePeriodTotals / computeTotals).
 */
export function computeModalPeriodTotals(histDayRows, dateFrom = "", dateTo = "") {
  const rows = filterHistRowsByDateRange(histDayRows, dateFrom, dateTo);
  const t = computePeriodTotals(rows);
  return {
    horasPlan: t.horasPlan,
    horas: t.horasPres,
    horasPres: t.horasPres,
  };
}

function parseHorarioMin(v) {
  if (!v) return 0;
  const s = String(v)
    .trim()
    .replace(/^[^-]*-\s*/, "");
  const toMin = (t) => {
    const m = String(t || "").match(/^(\d{1,2}):(\d{2})$/);
    return m ? parseInt(m[1], 10) * 60 + parseInt(m[2], 10) : 0;
  };
  const ts = s.split(/\s+/).filter(Boolean);
  const mins = ts.map(toMin);
  for (let i = 1; i < mins.length; i++) {
    if (mins[i] < mins[i - 1]) {
      for (let j = i; j < mins.length; j++) mins[j] += 1440;
    }
  }
  if (mins.length >= 4) return Math.max(0, mins[1] - mins[0]) + Math.max(0, mins[3] - mins[2]);
  if (mins.length >= 2) return Math.max(0, mins[1] - mins[0]);
  return 0;
}

/** Fallback quando não há histDayRows — agrega por colaborador+dia (espelha import). */
export function computeEventModalTotalsFromEvents(events) {
  const empDay = new Map();
  for (const ev of events || []) {
    const mat = String(ev?.mat ?? ev?.matricula ?? ev?.nome ?? "").trim();
    const date = normDateKey(ev?.data);
    if (!mat || !date) continue;
    const key = `${mat}|${date}`;
    let d = empDay.get(key);
    if (!d) {
      d = { hrsPlan: 0, hrsPres: 0, hrsAuse: 0, hrsAtraso: 0, hrsJust: 0, hrsExtr: 0 };
      empDay.set(key, d);
    }
    const plan = parseHorarioMin(ev.horario);
    if (plan > d.hrsPlan) d.hrsPlan = plan;
    const mins = Number(ev.horas) || 0;
    const cat = String(ev._cat || "");
    if (cat === "presentes") d.hrsPres += mins;
    else if (cat === "ausentes") d.hrsAuse += mins;
    else if (cat === "justificadas") d.hrsJust += mins;
    else if (cat === "extras") d.hrsExtr += mins;
    else if (mins > 0) d.hrsPres += mins;
  }

  const byDate = new Map();
  for (const [key, d] of empDay) {
    const date = key.split("|")[1];
    if (!byDate.has(date)) {
      byDate.set(date, { hrsPlan: 0, hrsPres: 0 });
    }
    const day = byDate.get(date);
    const active =
      d.hrsPres > 0 || d.hrsAuse > 0 || d.hrsAtraso > 0 || d.hrsJust > 0 || d.hrsExtr > 0;
    day.hrsPres += d.hrsPres;
    if (active) day.hrsPlan += d.hrsPlan;
  }

  let horasPlan = 0;
  let horas = 0;
  for (const day of byDate.values()) {
    horasPlan += day.hrsPlan;
    horas += capWorkedHours(day.hrsPres, day.hrsPlan);
  }
  return { horasPlan, horas, horasPres: horas };
}

/** % absenteísmo injustificado do dia — fallback quando não há horas. */
export function dayAbsInjustPct(r) {
  const total = Number(r?.total) || 0;
  if (total <= 0) return 0;
  const injust = (Number(r?.faltas) || 0) + (Number(r?.atrasos) || 0);
  return +((injust / total) * 100).toFixed(1);
}

export function dailyAbsTrendSeries(rows) {
  return dailyTrendSeries(rows, "abs").map(({ date, value }) => ({
    date,
    absPct: value,
  }));
}

function dayAbsTrendPct(r) {
  const e = enrichHistDayRow(r);
  if (e.absenteismo != null) return +Number(e.absenteismo).toFixed(1);
  return dayAbsInjustPct(r);
}

function dayHorasPerdidas(r) {
  const e = enrichHistDayRow(r);
  return e.horasPerdidas != null ? Math.max(0, e.horasPerdidas) : 0;
}

export function riscoEventsFromRows(rows) {
  const out = [];
  for (const row of rows || []) {
    for (const ev of row._events || []) {
      if (ev._cat === "risco") out.push(ev);
    }
  }
  return out;
}

function riscoEventLabel(ev) {
  return String(ev?.evento || "Sem evento").trim() || "Sem evento";
}

function riscoColaboradorKey(ev) {
  return String(ev?.mat || ev?.nome || "—").trim() || "—";
}

export function computeRiscoStats(rows) {
  const events = riscoEventsFromRows(rows);
  const colaboradores = new Set();
  const byEvent = new Map();
  let horas = 0;
  for (const ev of events) {
    const colKey = riscoColaboradorKey(ev);
    colaboradores.add(colKey);
    const label = riscoEventLabel(ev);
    const acc = byEvent.get(label) || { label, count: 0, horas: 0, colaboradores: new Set() };
    acc.count += 1;
    acc.horas += Number(ev.horas) || 0;
    acc.colaboradores.add(colKey);
    byEvent.set(label, acc);
    horas += Number(ev.horas) || 0;
  }
  const topEvent = [...byEvent.values()]
    .sort((a, b) => b.count - a.count || b.horas - a.horas || a.label.localeCompare(b.label, "pt-BR"))[0];
  return {
    ocorrencias: events.length,
    colaboradores: colaboradores.size,
    horas,
    eventosDistintos: byEvent.size,
    topEvento: topEvent
      ? {
          label: topEvent.label,
          count: topEvent.count,
          horas: topEvent.horas,
          colaboradores: topEvent.colaboradores.size,
          sharePct: events.length > 0 ? (topEvent.count / events.length) * 100 : 0,
        }
      : null,
  };
}

export function riscoDeptLabel(ev) {
  const d = String(ev?.depto_desc || ev?.depto || "").trim();
  return d || "Sem departamento";
}

/** Penalidades de risco agrupadas por departamento (período). */
export function computeRiscoByDepartment(rows) {
  const map = new Map();
  for (const row of rows || []) {
    for (const ev of row._events || []) {
      if (ev._cat !== "risco") continue;
      const dept = riscoDeptLabel(ev);
      let bucket = map.get(dept);
      if (!bucket) {
        bucket = { dept, ocorrencias: 0, colaboradores: new Set(), horas: 0 };
        map.set(dept, bucket);
      }
      bucket.ocorrencias += 1;
      bucket.colaboradores.add(riscoColaboradorKey(ev));
      bucket.horas += Number(ev.horas) || 0;
    }
  }
  return [...map.values()]
    .map((d) => ({
      dept: d.dept,
      ocorrencias: d.ocorrencias,
      colaboradores: d.colaboradores.size,
      horas: d.horas,
    }))
    .sort(
      (a, b) =>
        b.ocorrencias - a.ocorrencias ||
        b.colaboradores - a.colaboradores ||
        a.dept.localeCompare(b.dept, "pt-BR"),
    );
}

export function dayRiscoOcorrencias(r) {
  return (r?._events || []).filter((ev) => ev._cat === "risco").length;
}

const TREND_EXTRACTORS = {
  abs: dayAbsTrendPct,
  plan: (r) => Number(r?.horas_planejadas) || 0,
  work: (r) => capWorkedHours(r?.horas_presentes, r?.horas_planejadas),
  lost: dayHorasPerdidas,
  risk: dayRiscoOcorrencias,
  injust: dayInjust,
  just: dayJust,
  extr: dayExtr,
};

export function dailyTrendSeries(rows, metric) {
  if (metric === "consec") return dailyConsecFaltasSeries(rows);
  const extract = TREND_EXTRACTORS[metric];
  if (!extract) return [];
  return [...(Array.isArray(rows) ? rows : [])]
    .filter((r) => r?.date)
    .sort((a, b) => (a.date || "").localeCompare(b.date || ""))
    .map((r) => ({
      date: r.date,
      value: extract(r),
    }));
}

/** Variação do índice diário: último dia − primeiro dia (alinhado ao mini gráfico). */
export function computeAbsEdgeDelta(rows) {
  const series = dailyTrendSeries(rows, "abs");
  if (series.length < 2) return null;
  return +(series[series.length - 1].value - series[0].value).toFixed(1);
}

export function computeAbsHalves(rows) {
  const sorted = [...(Array.isArray(rows) ? rows : [])]
    .filter((r) => r?.date)
    .sort((a, b) => (a.date || "").localeCompare(b.date || ""));
  const half = Math.floor(sorted.length / 2);
  if (half < 1) return null;

  const sliceStats = (arr) => {
    const totals = computePeriodTotals(arr);
    const absPct = totals.horasPlan > 0
      ? calculateAbsenteismoPct({ horasAbs: totals.horasAbs, horasPlan: totals.horasPlan, precision: 1 })
      : 0;
    return {
      absPct,
      injustPct: absPct,
      justPct: 0,
    };
  };

  return {
    first: sliceStats(sorted.slice(0, half)),
    second: sliceStats(sorted.slice(half)),
    halfDays: half,
  };
}

export function computeRiscoRadar(rows) {
  const sorted = [...(Array.isArray(rows) ? rows : [])]
    .filter((r) => r?.date)
    .sort((a, b) => (a.date || "").localeCompare(b.date || ""));
  const half = Math.floor(sorted.length / 2);
  const stats = computeRiscoStats(sorted);
  let riskDelta = null;
  if (half > 0) {
    const prv = computeRiscoStats(sorted.slice(0, half)).ocorrencias;
    const cur = computeRiscoStats(sorted.slice(half)).ocorrencias;
    riskDelta = cur - prv;
  }

  return {
    riscoOcorrencias: stats.ocorrencias,
    riscoColaboradores: stats.colaboradores,
    riscoHoras: stats.horas,
    riskDelta,
  };
}

export function computeHoursRadar(rows) {
  const sorted = [...(Array.isArray(rows) ? rows : [])]
    .filter((r) => r?.date)
    .sort((a, b) => (a.date || "").localeCompare(b.date || ""));
  const half = Math.floor(sorted.length / 2);
  const prvRows = sorted.slice(0, half);
  const curRows = sorted.slice(half);

  const all = computePeriodTotals(sorted);
  const prv = half > 0 ? computePeriodTotals(prvRows) : null;
  const cur = half > 0 ? computePeriodTotals(curRows) : null;

  const absPct = all.absPct ?? 0;
  const absDelta =
    half > 0 && all.absPct != null && prv?.absPct != null && cur?.absPct != null
      ? cur.absPct - prv.absPct
      : null;
  const horasPerdidas = all.horasPerdidas ?? 0;
  const perdaPct = all.perdaPct ?? 0;
  const perdaDelta =
    half > 0 && all.perdaPct != null && prv?.perdaPct != null && cur?.perdaPct != null
      ? cur.perdaPct - prv.perdaPct
      : null;
  const trabDelta =
    half > 0 && prv && prv.horasPres > 0
      ? ((cur.horasPres - prv.horasPres) / prv.horasPres) * 100
      : null;

  return {
    total: all.total,
    faltas: all.faltas,
    atrasos: all.atrasos,
    horasPlan: all.horasPlan,
    horasPres: all.horasPres,
    horasAus: all.horasAus,
    horasJust: all.horasJust,
    horasExtras: all.horasExtras,
    absPct,
    absDelta,
    perdaPct,
    perdaDelta,
    trabDelta,
    horasPerdidas,
  };
}

export function sliceHistRowsByDays(rows, days) {
  const sorted = [...(Array.isArray(rows) ? rows : [])]
    .filter((r) => r?.date)
    .sort((a, b) => (a.date || "").localeCompare(b.date || ""));
  const n = Math.max(1, Number(days) || 30);
  return sorted.slice(-Math.min(n, sorted.length));
}
