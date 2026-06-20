import {
  ABSENTEISMO_FORMULA_ID,
  ABSENTEISMO_FORMULA_LABEL,
  calculateAbsenteismoPct,
  computeAbsEdgeDelta,
  computeConsecutiveFaltasStats,
  computePeriodTotals,
  computeRiscoStats,
} from "../radarHoursUtils.js";

const DOW_PT = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sab"];

const defaultFmt = (value) => Number(value || 0).toLocaleString("pt-BR");
const defaultFmtHM = (mins) => {
  const total = Math.round(Number(mins) || 0);
  const sign = total < 0 ? "-" : "";
  const abs = Math.abs(total);
  return `${sign}${Math.floor(abs / 60)}:${String(abs % 60).padStart(2, "0")}`;
};
const defaultFmtShortDate = (iso) => {
  if (!iso) return "--";
  const [year, month, day] = String(iso).slice(0, 10).split("-");
  return year && month && day ? `${day}/${month}` : String(iso);
};

function buildDeptMap(rows) {
  const map = new Map();
  (rows || []).forEach((row) => {
    (row._employees || []).forEach((emp) => {
      const dept = (emp.depto_desc || emp.depto || "?").trim() || "?";
      const d = map.get(dept) || {
        dept,
        hrsAuse: 0,
        hrsJust: 0,
        hrsExtr: 0,
        hrsPlan: 0,
        colaboradores: new Set(),
        ocorr: 0,
      };
      const ha = Number(emp.hrsAuse) || 0;
      const hj = Number(emp.hrsJust) || 0;
      d.hrsAuse += ha;
      d.hrsJust += hj;
      d.hrsExtr += Number(emp.hrsExtr) || 0;
      d.hrsPlan += Number(emp.hrsPlan) || 0;
      if (emp.mat) d.colaboradores.add(emp.mat);
      if (ha > 0 || hj > 0) d.ocorr += 1;
      map.set(dept, d);
    });
  });
  return map;
}

function buildCriticalDays(rows) {
  return [...(rows || [])]
    .map((r) => {
      const aus = (Number(r.faltas) || 0) + (Number(r.atrasos) || 0);
      const horas =
        (Number(r.horas_faltas) || 0) +
        (Number(r.horas_atrasos) || 0) +
        (Number(r.horas_justificadas) || 0);
      let dow = null;
      let dowLabel = "";
      const m = String(r.date || "").match(/^(\d{4})-(\d{2})-(\d{2})/);
      if (m) {
        const dt = new Date(+m[1], +m[2] - 1, +m[3]);
        dow = dt.getDay();
        dowLabel = DOW_PT[dow];
      }
      return { date: r.date, aus, horas, dow, dowLabel };
    })
    .sort((a, b) => b.horas + b.aus * 30 - (a.horas + a.aus * 30))
    .slice(0, 4);
}

function buildDeptRanking(deptAll, deptPrv, deptCur) {
  return [...deptAll.values()]
    .map((d) => {
      const dc = deptCur.get(d.dept);
      const dp = deptPrv.get(d.dept);
      const absPctD = d.hrsPlan > 0 ? ((d.hrsAuse + d.hrsJust) / d.hrsPlan) * 100 : null;
      const absPctDCur = dc?.hrsPlan > 0 ? ((dc.hrsAuse + dc.hrsJust) / dc.hrsPlan) * 100 : null;
      const absPctDPrv = dp?.hrsPlan > 0 ? ((dp.hrsAuse + dp.hrsJust) / dp.hrsPlan) * 100 : null;
      const trend = absPctDCur != null && absPctDPrv != null ? absPctDCur - absPctDPrv : null;
      return {
        ...d,
        colaboradoresQtd: d.colaboradores.size,
        absPct: absPctD,
        trend,
        score: d.hrsAuse + d.hrsJust + d.hrsExtr * 0.35 + d.ocorr * 30,
      };
    })
    .sort((a, b) => b.score - a.score)
    .slice(0, 4);
}

function buildSuggestions({
  all,
  criticalDays,
  deptAll,
  deptRanking,
  patternLabel,
  riscoStats,
  fmt,
  fmtHM,
  fmtShortDate,
}) {
  const suggestions = [];
  const top = deptRanking[0];

  if (riscoStats.ocorrencias > 0) {
    suggestions.unshift(
      `${fmt(riscoStats.ocorrencias)} penalidade(s) de risco trabalhista (${fmt(riscoStats.colaboradores)} colab.) - revisar escala e adicional (NR-15/NR-16).`,
    );
  }
  if (top && top.hrsAuse + top.hrsJust > 0) {
    const abs = top.absPct != null ? ` - ${top.absPct.toFixed(1)}% abs.` : "";
    const tr =
      top.trend != null
        ? top.trend > 0.5
          ? ` ↑${top.trend.toFixed(1)}%`
          : top.trend < -0.5
            ? ` ↓${Math.abs(top.trend).toFixed(1)}%`
            : ""
        : "";
    suggestions.push(
      `Acao preventiva em ${top.dept}: ${fmtHM(top.hrsAuse + top.hrsJust)} perdidas${abs}${tr} (NR-1/GRO).`,
    );
  }
  if (all.horasExtras > 0) {
    const topExtr = [...deptAll.values()].sort((a, b) => b.hrsExtr - a.hrsExtr)[0];
    if (topExtr?.hrsExtr > 0) {
      suggestions.push(
        `Sobrecarga em ${topExtr.dept}: ${fmtHM(topExtr.hrsExtr)} h. extras no periodo - revisar escala.`,
      );
    }
  }
  if (patternLabel) {
    suggestions.push(
      `${criticalDays.filter((d) => d.dowLabel === patternLabel).length} dos 4 dias criticos sao ${patternLabel}s - avaliar escala neste dia.`,
    );
  } else if (criticalDays[0]?.aus > 0) {
    suggestions.push(
      `Pico de ${fmt(criticalDays[0].aus)} oc. em ${fmtShortDate(criticalDays[0].date)} - investigar causa.`,
    );
  }
  if (!suggestions.length) suggestions.push("Manter monitoramento preventivo do periodo.");
  return suggestions;
}

export function buildHistRadarSummary(
  rows,
  { fmt = defaultFmt, fmtHM = defaultFmtHM, fmtShortDate = defaultFmtShortDate } = {},
) {
  const sorted = [...(Array.isArray(rows) ? rows : [])].sort((a, b) =>
    (a.date || "").localeCompare(b.date || ""),
  );
  const half = Math.floor(sorted.length / 2);
  const prvRows = sorted.slice(0, half);
  const curRows = sorted.slice(half);

  const all = computePeriodTotals(sorted);
  const prv = half > 0 ? computePeriodTotals(prvRows) : null;
  const cur = half > 0 ? computePeriodTotals(curRows) : null;
  const absColaboradores = new Set();
  let absColaboradoresOcorrencias = 0;
  sorted.forEach((row) => {
    (row._employees || []).forEach((emp) => {
      const hasAbsence = (Number(emp.hrsAuse) || 0) > 0 || (Number(emp.hrsJust) || 0) > 0;
      if (!hasAbsence) return;
      absColaboradoresOcorrencias += 1;
      if (emp.mat) absColaboradores.add(emp.mat);
    });
  });

  const absPct =
    calculateAbsenteismoPct({
      horasAbs: all.horasAbs,
      horasPlan: all.horasPlan,
      precision: null,
    }) ?? 0;
  const absDelta =
    half > 0 && all.absPct != null && prv?.absPct != null && cur?.absPct != null
      ? cur.absPct - prv.absPct
      : null;
  const absEdgeDelta = computeAbsEdgeDelta(sorted);
  const horasPerdidas = all.horasPerdidas ?? 0;
  const horasDeficit = Math.max(0, horasPerdidas);
  const horasSaldo = 0;
  const perdaPct = all.perdaPct ?? 0;
  const perdaDelta =
    half > 0 && all.perdaPct != null && prv?.perdaPct != null && cur?.perdaPct != null
      ? cur.perdaPct - prv.perdaPct
      : null;
  const planDelta =
    half > 0 && prv && prv.horasPlan > 0 ? ((cur.horasPlan - prv.horasPlan) / prv.horasPlan) * 100 : null;
  const trabDelta =
    half > 0 && prv && prv.horasPres > 0 ? ((cur.horasPres - prv.horasPres) / prv.horasPres) * 100 : null;

  const deptAll = buildDeptMap(sorted);
  const deptPrv = buildDeptMap(prvRows);
  const deptCur = buildDeptMap(curRows);
  const deptRanking = buildDeptRanking(deptAll, deptPrv, deptCur);
  const criticalDays = buildCriticalDays(sorted);

  const dowCounts = {};
  criticalDays.forEach((d) => {
    if (d.dow != null) dowCounts[d.dow] = (dowCounts[d.dow] || 0) + 1;
  });
  const patternEntry = Object.entries(dowCounts).find(([, c]) => c >= 3);
  const patternLabel = patternEntry ? DOW_PT[Number(patternEntry[0])] : null;

  const riscoStats = computeRiscoStats(sorted);
  const mainDept = deptRanking[0]?.dept || "?";
  const faltasConsecColaboradores = computeConsecutiveFaltasStats(sorted).colaboradores;
  const suggestions = buildSuggestions({
    all,
    criticalDays,
    deptAll,
    deptRanking,
    patternLabel,
    riscoStats,
    fmt,
    fmtHM,
    fmtShortDate,
  });

  return {
    total: all.total,
    faltas: all.faltas,
    atrasos: all.atrasos,
    justificadas: all.justificadas,
    presentes: all.presentes,
    horasPlan: all.horasPlan,
    horasPres: all.horasPres,
    horasAus: all.horasAus,
    horasJust: all.horasJust,
    horasAbs: all.horasAbs,
    horasExtras: all.horasExtras,
    horasPerdidas,
    horasDeficit,
    horasSaldo,
    faltasConsecColaboradores,
    absPct,
    absDelta,
    absEdgeDelta,
    absColaboradores: absColaboradores.size,
    absColaboradoresOcorrencias,
    perdaPct,
    perdaDelta,
    planDelta,
    trabDelta,
    riscoOcorrencias: riscoStats.ocorrencias,
    riscoColaboradores: riscoStats.colaboradores,
    riscoHoras: riscoStats.horas,
    riscoTopEvento: riscoStats.topEvento,
    mainDept,
    deptRanking,
    criticalDays,
    patternLabel,
    suggestions,
    absFormulaId: ABSENTEISMO_FORMULA_ID,
    absFormulaLabel: ABSENTEISMO_FORMULA_LABEL,
  };
}
