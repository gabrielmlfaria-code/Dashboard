import {
  computeRiscoByDepartment,
  computeRiscoRadar,
  computeRiscoStats,
  dailyTrendSeries,
  riscoDeptLabel,
} from "../radarHoursUtils.js";
import { enrichCollaboratorsDisplay, inferDeptGroup } from "./radarColabsUtils.js";
import { calcPassivoLinha } from "./radarPassivoUtils.js";
import { classifyRiscoEvent } from "./riscoEventClassifier.js";

const DOW_PT = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];
const TURNOS = ["Manhã", "Tarde", "Noite", "Madrugada", "Sem turno"];

function cleanText(v, fallback) {
  const s = String(v ?? "").trim();
  return s || fallback;
}

export function riskEventLabel(ev) {
  return cleanText(ev?.evento, "Sem evento");
}

function inferTurno(ev) {
  const raw = cleanText(ev?.turno || ev?.horario || ev?.hora, "");
  const m = raw.match(/(\d{1,2})/);
  const h = m ? Number(m[1]) : null;
  if (h != null) {
    if (h >= 6 && h < 12) return "Manhã";
    if (h >= 12 && h < 18) return "Tarde";
    if (h >= 18 && h < 24) return "Noite";
    return "Madrugada";
  }
  const t = raw.toLowerCase();
  if (t.includes("manh") || (t.includes("madrug") && t.includes("manh"))) return "Manhã";
  if (t.includes("tarde")) return "Tarde";
  if (t.includes("noite") || t.includes("noturn")) return "Noite";
  if (t.includes("madrug")) return "Madrugada";
  return "Sem turno";
}

function dowIndex(iso) {
  const m = String(iso || "").match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!m) return 0;
  return new Date(+m[1], +m[2] - 1, +m[3]).getDay();
}

function normalizeDeptFilter(filtroDepts) {
  if (Array.isArray(filtroDepts)) return filtroDepts.filter(Boolean);
  if (filtroDepts) return [String(filtroDepts)];
  return [];
}

function normComparable(v) {
  return String(v ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}

function eventColabLabel(ev) {
  return cleanText(ev?.nome || ev?.colaborador || ev?.colaboradorNome, "");
}

function dateInRange(iso, dateFrom, dateTo) {
  const d = String(iso || "").slice(0, 10);
  if (!d) return true;
  if (dateFrom && d < dateFrom) return false;
  if (dateTo && d > dateTo) return false;
  return true;
}

function filterRows(
  rows,
  {
    filtroDepts = [],
    filtroDept = "",
    filtroGrupo = "",
    filtroColab = "",
    dateFrom = "",
    dateTo = "",
  } = {},
) {
  const depts = normalizeDeptFilter(filtroDepts);
  const byDept = Boolean(filtroDept);
  const byGrupo = !byDept && filtroGrupo && filtroGrupo !== "Todos";
  const colabNeedle = normComparable(filtroColab);
  if (!depts.length && !byDept && !byGrupo && !colabNeedle && !dateFrom && !dateTo) return rows;
  return (rows || [])
    .map((row) => {
      if (!dateInRange(row?.date, dateFrom, dateTo)) return null;
      let events = (row._events || []).filter((ev) => ev._cat === "risco");
      if (depts.length) events = events.filter((ev) => depts.includes(riscoDeptLabel(ev)));
      if (byDept) events = events.filter((ev) => riscoDeptLabel(ev) === filtroDept);
      else if (byGrupo) {
        events = events.filter((ev) => inferDeptGroup(riscoDeptLabel(ev)) === filtroGrupo);
      }
      if (colabNeedle) {
        events = events.filter((ev) => {
          const label = normComparable(eventColabLabel(ev));
          const mat = normComparable(ev?.mat || ev?.matricula);
          return (
            (label && (label.includes(colabNeedle) || colabNeedle.includes(label))) ||
            (mat && mat === colabNeedle)
          );
        });
      }
      if (!events.length) return null;
      return { ...row, _events: events };
    })
    .filter(Boolean);
}

export function deptFilterPrefix(filtroDepts) {
  const depts = normalizeDeptFilter(filtroDepts);
  if (!depts.length) return "";
  if (depts.length === 1) return `[${depts[0]}] `;
  return `[${depts.length} deptos] `;
}

export function buildRadarTrabalhistaDataset(
  rows,
  {
    filtroDepts = [],
    filtroDept = "",
    filtroGrupo = "",
    filtroColab = "",
    dateFrom = "",
    dateTo = "",
    passivoCfg,
  } = {},
) {
  const filtered = filterRows(rows, {
    filtroDepts,
    filtroDept,
    filtroGrupo,
    filtroColab,
    dateFrom,
    dateTo,
  });
  const stats = computeRiscoStats(filtered);
  const radar = computeRiscoRadar(filtered);
  const departments = computeRiscoByDepartment(filtered);
  const timeline = dailyTrendSeries(filtered, "risk");
  const ocorrTimeline = filtered
    .filter((r) => r?.date)
    .sort((a, b) => (a.date || "").localeCompare(b.date || ""))
    .map((r) => ({
      date: r.date,
      value: (r._events || []).filter((e) => e._cat === "risco").length,
    }));

  const eventMap = new Map();
  const colMap = new Map();
  const heat = TURNOS.map((t) => ({ turno: t, values: Array(7).fill(0) }));

  for (const row of filtered) {
    for (const ev of row._events || []) {
      if (ev._cat !== "risco") continue;
      const label = riskEventLabel(ev);
      const dept = riscoDeptLabel(ev);
      const horas = Number(ev.horas) || 0;
      const dk = ev.data || row.date;
      const colKey = ev.mat || ev.nome || "—";
      const dow = dowIndex(dk);
      const turno = inferTurno(ev);
      const ti = TURNOS.indexOf(turno);
      if (ti >= 0) heat[ti].values[dow] += 1;
      const classification = classifyRiscoEvent(label, ev?.base_legal || ev?.artigo);

      if (!eventMap.has(label)) {
        eventMap.set(label, {
          evento: label,
          ocorrencias: 0,
          colaboradores: new Set(),
          horas: 0,
          kind: classification.kind,
          baseLegal: classification.baseLegal,
        });
      }
      const eb = eventMap.get(label);
      eb.ocorrencias += 1;
      eb.horas += horas;
      eb.colaboradores.add(colKey);

      if (!colMap.has(colKey)) {
        colMap.set(colKey, {
          mat: ev.mat,
          nome: cleanText(ev.nome, colKey),
          dept,
          ocorrencias: 0,
          horas: 0,
          historico: [],
        });
      }
      const cb = colMap.get(colKey);
      cb.ocorrencias += 1;
      cb.horas += horas;
      cb.historico.push({
        date: dk,
        evento: label,
        turno,
        dept,
      });
    }
  }

  const eventTypes = [...eventMap.values()]
    .map((e) => {
      const colaboradores = e.colaboradores.size;
      const passivo = calcPassivoLinha(
        {
          evento: e.evento,
          ocorrencias: e.ocorrencias,
          colaboradores,
          horas: e.horas,
        },
        passivoCfg,
      );
      const totalOcorr = stats.ocorrencias || 1;
      return {
        evento: e.evento,
        ocorrencias: e.ocorrencias,
        colaboradores,
        horas: e.horas,
        baseLegal: e.baseLegal,
        pct: (e.ocorrencias / totalOcorr) * 100,
        ...passivo,
      };
    })
    .sort((a, b) => b.ocorrencias - a.ocorrencias || b.passivo - a.passivo);

  const collaborators = enrichCollaboratorsDisplay(
    [...colMap.values()].map((c) => ({
      ...c,
      historico: c.historico.sort((a, b) => (b.date || "").localeCompare(a.date || "")),
    })),
  ).sort((a, b) => b.ocorrencias - a.ocorrencias || b.horas - a.horas);

  let peak = { turno: "—", dow: "—", value: 0 };
  for (const row of heat) {
    row.values.forEach((v, di) => {
      if (v > peak.value) peak = { turno: row.turno, dow: DOW_PT[di], value: v };
    });
  }

  const passivoTotal = eventTypes.reduce((s, e) => s + (e.passivo || 0), 0);
  const topEvent = eventTypes[0];
  const topDept = departments[0];

  let insight = "Manter monitoramento preventivo do período.";
  if (stats.ocorrencias > 0 && topEvent) {
    insight = `${topEvent.evento} concentra ${topEvent.ocorrencias.toLocaleString("pt-BR")} ocorrência(s) — priorizar ação corretiva.`;
  }
  if (topDept && topDept.ocorrencias > 0) {
    insight += ` Depto com mais ocorrências: ${topDept.dept}.`;
  }
  const deptPrefix = deptFilterPrefix(filtroDepts);
  if (deptPrefix && insight) {
    insight = deptPrefix + insight;
  }

  let miniStats = null;
  if (ocorrTimeline.length >= 2) {
    const vals = ocorrTimeline.map((d) => d.value);
    const peakVal = Math.max(...vals);
    const peakEntry = ocorrTimeline.find((d) => d.value === peakVal);
    const avg = vals.reduce((a, b) => a + b, 0) / vals.length;
    const half = Math.floor(vals.length / 2) || 1;
    const first = vals.slice(0, half).reduce((a, b) => a + b, 0);
    const second = vals.slice(half).reduce((a, b) => a + b, 0);
    const trendPct = first > 0 ? ((second - first) / first) * 100 : 0;
    miniStats = {
      peakVal,
      peakDate: peakEntry?.date || "",
      avgPerDay: avg,
      trendPct,
    };
  }

  return {
    stats,
    radar,
    departments,
    eventTypes,
    collaborators,
    heatmap: {
      rows: heat,
      peak,
      dowLabels: DOW_PT.slice(1).concat(DOW_PT[0]),
      turnoTotals: heat.map((row) => ({
        turno: row.turno,
        total: row.values.reduce((s, v) => s + v, 0),
      })),
    },
    timeline,
    ocorrTimeline,
    passivoTotal,
    topEvent,
    topDept,
    miniStats,
    insight,
    deptNames: departments.map((d) => d.dept),
  };
}

export function downloadCsv(filename, rows, headers) {
  const esc = (v) => `"${String(v ?? "").replace(/"/g, '""')}"`;
  const lines = [headers.map(esc).join(";"), ...rows.map((r) => r.map(esc).join(";"))];
  const blob = new Blob(["\uFEFF" + lines.join("\n")], { type: "text/csv;charset=utf-8" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = filename;
  a.click();
  URL.revokeObjectURL(a.href);
}
