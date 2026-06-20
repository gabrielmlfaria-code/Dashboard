import {
  computeConsecutiveFaltasStats,
  computePeriodTotals,
  computeRiscoStats,
  dayInjust,
} from "../radarHoursUtils.js";
import { analyzeFaltasInjustificadas } from "./dashboardNlFaltasAnalysis.js";
import {
  buildNlAbonosSummary,
  buildNlSaudePreventivaStats,
  normalizeNlBancoHoras,
} from "./dashboardNlCardsStats.js";
import { normalizeSaudeRegistro } from "../saude-preventiva/saudePreventivaCampanhas.js";
import { buildArt473AusenciasStats, buildSaudeCalendarioLembretes } from "../saude-preventiva/saudePreventivaArt473.js";
import { loadSaudeRegistrosSync } from "../saude-preventiva/saudePreventivaStorage.js";

function eventLabel(ev) {
  return String(ev?.evento || "Sem evento").trim() || "Sem evento";
}

function colKey(ev) {
  return String(ev?.mat || ev?.nome || "—").trim() || "—";
}

/** Agrupa eventos por rótulo (contagem + horas + colaboradores únicos). */
export function aggregateEventsByLabel(events) {
  const by = new Map();
  for (const ev of events || []) {
    const label = eventLabel(ev);
    const acc = by.get(label) || { label, count: 0, horas: 0, colaboradores: new Set() };
    acc.count += 1;
    acc.horas += Number(ev.horas) || 0;
    acc.colaboradores.add(colKey(ev));
    by.set(label, acc);
  }
  return [...by.values()]
    .map((x) => ({
      label: x.label,
      count: x.count,
      horas: x.horas,
      colaboradores: x.colaboradores.size,
    }))
    .sort((a, b) => b.count - a.count || b.horas - a.horas || a.label.localeCompare(b.label, "pt-BR"));
}

function collectEvents(rows, predicate) {
  const out = [];
  for (const row of rows || []) {
    for (const ev of row._events || []) {
      if (predicate(ev, row)) out.push(ev);
    }
  }
  return out;
}

/** Faltas/atrasos injustificados: categoria Ausentes (configuração de eventos). */
export function ausentesEventsFromRows(rows) {
  return collectEvents(rows, (ev) => ev._cat === "ausentes");
}

/** Somente faltas (exclui eventos com “atraso” no nome). */
export function faltaInjustEventsFromRows(rows) {
  return ausentesEventsFromRows(rows).filter((ev) => !/\batraso\b/i.test(eventLabel(ev)));
}

/** Eventos Ausentes classificados como atraso no rótulo. */
export function atrasoEventsFromRows(rows) {
  return ausentesEventsFromRows(rows).filter((ev) => /\batraso\b/i.test(eventLabel(ev)));
}

function fmtHm(min) {
  const m = Math.max(0, Math.round(Number(min) || 0));
  if (m < 60) return `${m} min`;
  const h = Math.floor(m / 60);
  const r = m % 60;
  return r ?`${h}h ${r}min` : `${h}h`;
}

/**
 * Contexto compacto para perguntas em linguagem natural (absenteísmo + radar).
 * @param {object} opts
 * @param {Array} opts.histRows — linhas do período filtrado
 * @param {object} [opts.histRadar] — agregado do bento (deptRanking, absPct, etc.)
 * @param {string} [opts.periodLabel]
 * @param {'absenteismo'|'radar'|'both'} [opts.surface]
 * @param {object} [opts.radarSnapshot] — topEvent, topDept, passivoTotal, filtroDepts
 * @param {object} [opts.bancoHoras] — stats do card Banco de Horas (header)
 * @param {object} [opts.abonosStored] — KPI abonos importado (localStorage)
 */
export function buildDashboardNlContext({
  histRows = [],
  histRadar = null,
  periodLabel = "",
  surface = "both",
  radarSnapshot = null,
  bancoHoras = null,
  abonosStored = null,
} = {}) {
  const rows = [...(Array.isArray(histRows) ?histRows : [])].sort((a, b) =>
    (a.date || "").localeCompare(b.date || ""),
  );
  const totals = computePeriodTotals(rows);
  const ausentesEv = ausentesEventsFromRows(rows);
  const faltaEv = faltaInjustEventsFromRows(rows);
  const topAusentes = aggregateEventsByLabel(ausentesEv);
  const topFaltas = aggregateEventsByLabel(faltaEv);
  const risco = computeRiscoStats(rows);
  const consec = computeConsecutiveFaltasStats(rows);

  const injustHoras = rows.reduce((s, r) => s + dayInjust(r), 0);
  const justHoras = rows.reduce((s, r) => s + (Number(r.horas_justificadas) || 0), 0);
  const horasAtrasosMin = rows.reduce((s, r) => s + (Number(r.horas_atrasos) || 0), 0);
  const horasFaltasMin = rows.reduce((s, r) => s + (Number(r.horas_faltas) || 0), 0);
  const colaboradoresMap = new Map();
  const departamentosSet = new Set();
  for (const row of rows) {
    for (const ev of row?._events || []) {
      const nome = String(ev?.nome || ev?.colaborador || "").trim();
      const mat = String(ev?.mat || ev?.matricula || "").trim();
      if (nome) colaboradoresMap.set(nome, { nome, mat });
      const dept = String(ev?.depto || ev?.departamento || ev?.departamentoNome || "").trim();
      if (dept) departamentosSet.add(dept);
    }
  }

  const radar = radarSnapshot || {};
  const deptRanking = histRadar?.deptRanking || [];
  const criticalDays = histRadar?.criticalDays || [];
  const saudeRegistros =
    typeof window !== "undefined"
      ? loadSaudeRegistrosSync().map(normalizeSaudeRegistro)
      : [];
  const art473 = buildArt473AusenciasStats(rows, saudeRegistros);
  const saudeCalendario = buildSaudeCalendarioLembretes(saudeRegistros).map((c) => ({
    titulo: c.titulo,
    status: c.status,
    realizadoAno: c.realizadoAno,
  }));

  return {
    surface,
    periodLabel: periodLabel || (rows.length ?`${rows[0]?.date} — ${rows[rows.length - 1]?.date}` : "Sem período"),
    dias: rows.length,
    totals: {
      faltas: totals.faltas,
      atrasos: totals.atrasos,
      justificadas: totals.justificadas,
      presentes: totals.presentes,
      absPct: histRadar?.absPct ?? totals.absPct,
      absDelta: histRadar?.absDelta ?? null,
      horasPlan: totals.horasPlan,
      horasPres: totals.horasPres,
      horasAus: totals.horasAus,
      horasJust: totals.horasJust,
      horasExtras: totals.horasExtras,
      horasInjustMin: injustHoras,
      horasJustMin: justHoras,
      horasAtrasosMin,
      horasFaltasMin,
    },
    faltasInjustificadas: {
      ocorrencias: ausentesEv.length,
      ocorrenciasSoFalta: faltaEv.length,
      topPorOcorrencia: topAusentes.slice(0, 5),
      topSoFalta: topFaltas.slice(0, 5),
    },
    faltasAnalise: {
      ausentes: analyzeFaltasInjustificadas(rows, { soFalta: false }),
      soFalta: analyzeFaltasInjustificadas(rows, { soFalta: true }),
    },
    risco: {
      ocorrencias: risco.ocorrencias,
      colaboradores: risco.colaboradores,
      horas: risco.horas,
      topEvento: risco.topEvento,
    },
    departamentos: deptRanking.map((d) => ({
      dept: d.dept,
      absPct: d.absPct,
      trend: d.trend,
      horasPerdidasMin: (Number(d.hrsAuse) || 0) + (Number(d.hrsJust) || 0),
      horasPerdidasFmt: fmtHm((Number(d.hrsAuse) || 0) + (Number(d.hrsJust) || 0)),
    })),
    entidades: {
      colaboradores: [...colaboradoresMap.values()].sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR")),
      departamentos: [
        ...new Set([
          ...deptRanking.map((d) => d.dept).filter(Boolean),
          ...departamentosSet,
        ]),
      ].sort((a, b) => a.localeCompare(b, "pt-BR")),
    },
    diasCriticos: criticalDays.map((d) => ({
      date: d.date,
      aus: d.aus,
      horasMin: d.horas,
      dowLabel: d.dowLabel,
    })),
    patternDow: histRadar?.patternLabel || null,
    faltasConsecutivas: {
      colaboradores: consec.colaboradores,
      top: (consec.lista || []).slice(0, 3).map((c) => ({
        nome: c.nome,
        dept: c.depto,
        dias: c.dias,
        inicio: c.inicio,
        fim: c.fim,
      })),
    },
    colaboradoresComAusencia: histRadar?.absColaboradores ?? null,
    ocorrenciasAusencia: histRadar?.absColaboradoresOcorrencias ?? null,
    radar: {
      topEvento: radar.topEvent ?? radar.topEvento ?? null,
      topDept: radar.topDept ?? null,
      passivoTotal: radar.passivoTotal ?? null,
      filtroDepts: radar.filtroDepts || [],
    },
    kpi: histRadar
      ?{
          faltas: histRadar.faltas,
          atrasos: histRadar.atrasos,
          justificadas: histRadar.justificadas,
          presentes: histRadar.presentes,
          horasPlan: histRadar.horasPlan,
          horasPres: histRadar.horasPres,
          horasAus: histRadar.horasAus,
          horasJust: histRadar.horasJust,
          horasExtras: histRadar.horasExtras,
          horasPerdidas: histRadar.horasPerdidas,
          perdaPct: histRadar.perdaPct,
          perdaDelta: histRadar.perdaDelta,
          absEdgeDelta: histRadar.absEdgeDelta,
          planDelta: histRadar.planDelta,
          trabDelta: histRadar.trabDelta,
          patternLabel: histRadar.patternLabel,
          mainDept: histRadar.mainDept,
          suggestions: histRadar.suggestions || [],
          riscoOcorrencias: histRadar.riscoOcorrencias,
          riscoColaboradores: histRadar.riscoColaboradores,
          riscoTopEvento: histRadar.riscoTopEvento,
        }
      : null,
    bancoHoras: normalizeNlBancoHoras(bancoHoras),
    saudePreventiva: buildNlSaudePreventivaStats(rows),
    art473: {
      ocorrencias: art473.ocorrencias,
      colaboradores: art473.colaboradores,
      semComunicacao: art473.semComunicacao,
      alertas: art473.alertas.length,
      calendarioAtrasado: saudeCalendario.filter((c) => c.status === "atrasado").length,
      calendarioOk: saudeCalendario.filter((c) => c.status === "ok").length,
      comunicacoesRegistradas: saudeRegistros.length,
    },
    abonos: buildNlAbonosSummary(rows, abonosStored),
  };
}
