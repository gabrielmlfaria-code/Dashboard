import React, { useEffect, useMemo, useRef, useState } from "react";
import ReactApexChart from "react-apexcharts";
import AbsenteismoChart from "./AbsenteismoChart.jsx";
import { computeHoursRadar, computeRiscoByDepartment, computeRiscoRadar, dailyAbsTrendSeries, dayExtr, dayInjust, dayJust } from "./radarHoursUtils.js";

const FALT_DAYS_ATUAL = "atual";

const FERIADOS_FIXOS = {
  "01-01": "Ano Novo",
  "21-04": "Tiradentes",
  "01-05": "Dia do Trabalho",
  "07-09": "Independência",
  "12-10": "Aparecida",
  "02-11": "Finados",
  "15-11": "República",
  "20-11": "Consciência Negra",
  "25-12": "Natal",
};
const FERIADOS_MOVEIS = {
  "2025-03-03": "Carnaval",
  "2025-03-04": "Carnaval",
  "2025-04-18": "Paixão",
  "2025-06-19": "Corpus Christi",
  "2026-02-16": "Carnaval",
  "2026-02-17": "Carnaval",
  "2026-04-03": "Paixão",
  "2026-06-04": "Corpus Christi",
  "2027-02-08": "Carnaval",
  "2027-02-09": "Carnaval",
  "2027-03-26": "Paixão",
  "2027-05-27": "Corpus Christi",
};
const DOW_PT = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];

const SERIES_COLORS = {
  injust: "#ef4444",
  just: "#818cf8",
  extr: "#22c55e",
};

function getDateMeta(isoDate) {
  if (!isoDate) return null;
  const m = String(isoDate).match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!m) return null;
  const [, yyyy, mm, dd] = m;
  const date = new Date(Number(yyyy), Number(mm) - 1, Number(dd));
  const dow = date.getDay();
  const mmdd = `${mm}-${dd}`;
  const feriado = FERIADOS_MOVEIS[isoDate] || FERIADOS_FIXOS[mmdd] || null;
  return {
    dow,
    dowLabel: DOW_PT[dow],
    label: `${dd}/${mm}`,
    feriado,
    isWeekend: dow === 0 || dow === 6,
  };
}

function fmtH(min) {
  if (min == null || min === 0) return "0h";
  const v = Math.round(min);
  const h = Math.floor(v / 60);
  const m = v % 60;
  return m ? `${h}h ${String(m).padStart(2, "0")}m` : `${h}h`;
}

function sparseLabels(dateMeta, n) {
  const showAll = n <= 12;
  const step = showAll ? 1 : Math.max(1, Math.ceil(n / 10));
  return dateMeta.map((dm, i) => {
    if (!dm) return "";
    if (!showAll && i !== 0 && i !== n - 1 && i % step !== 0) return "";
    return `${dm.dowLabel} ${dm.label}`;
  });
}

function riskEmployeeKey(ev) {
  const key = String(ev?.mat || ev?.nome || "").trim();
  return key || "—";
}

function riskEventLabel(ev) {
  const label = String(ev?.evento || "").trim();
  return label || "Sem evento";
}

function riskDayFacts(row) {
  const events = (row?._events || []).filter((ev) => ev._cat === "risco");
  const colaboradores = new Set();
  const byEvent = new Map();
  for (const ev of events) {
    colaboradores.add(riskEmployeeKey(ev));
    const label = riskEventLabel(ev);
    byEvent.set(label, (byEvent.get(label) || 0) + 1);
  }
  const topEvento = [...byEvent.entries()]
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0], "pt-BR"))[0];
  return {
    ocorr: events.length,
    colaboradores: colaboradores.size,
    topEvento: topEvento ? { label: topEvento[0], count: topEvento[1] } : null,
  };
}

export function RadarPremiumChart({
  histRows = [],
  isDark = false,
  fmtHMReadable,
  faltDays = 30,
  setFaltDays,
  customPeriod = false,
  periodoApuracao = null,
  onRadarChange,
  variant = "hours",
  absMeta = 5,
  embeddedInShell = false,
  embeddedChartHeight = 360,
  forcedRiskView = null,
  onSelectAbsDay,
}) {
  const chartWrapRef = useRef(null);
  const fmtHM = fmtHMReadable || fmtH;

  const [localDays, setLocalDays] = useState(faltDays);
  const [visible, setVisible] = useState({ injust: true, just: true, extr: true });
  const [riskViewMode, setRiskViewMode] = useState("timeline");

  useEffect(() => {
    setLocalDays(faltDays);
  }, [faltDays]);

  useEffect(() => {
    if (variant !== "risk") setRiskViewMode("timeline");
  }, [variant]);

  const rows = useMemo(() => {
    const sorted = [...(Array.isArray(histRows) ? histRows : [])]
      .filter((r) => r?.date)
      .sort((a, b) => (a.date || "").localeCompare(b.date || ""));
    if (customPeriod) return sorted;
    if (
      localDays === FALT_DAYS_ATUAL &&
      periodoApuracao?.de &&
      periodoApuracao?.ate
    ) {
      return sorted.filter(
        (r) => r.date >= periodoApuracao.de && r.date <= periodoApuracao.ate,
      );
    }
    const n = Math.max(1, Number(localDays) || 30);
    return sorted.slice(-Math.min(n, sorted.length));
  }, [histRows, localDays, customPeriod, periodoApuracao]);

  const radar = useMemo(() => computeHoursRadar(rows), [rows]);
  const riscoRadar = useMemo(
    () => (variant === "risk" ? computeRiscoRadar(rows) : null),
    [rows, variant],
  );

  useEffect(() => {
    if (variant === "risk" && riscoRadar) {
      onRadarChange?.({ ...radar, ...riscoRadar }, rows);
    } else {
      onRadarChange?.(radar, rows);
    }
  }, [radar, riscoRadar, rows, onRadarChange, variant]);

  useEffect(() => {
    const el = chartWrapRef.current;
    if (!el) return;
    const remove = () => el.querySelectorAll(".apexcharts-svg > title").forEach((t) => t.remove());
    remove();
    const mo = new MutationObserver(remove);
    mo.observe(el, { childList: true, subtree: true });
    return () => mo.disconnect();
  }, []);

  const hasHours = rows.some(
    (r) =>
      r.horas_faltas != null ||
      r.horas_atrasos != null ||
      r.horas_justificadas != null ||
      r.horas_extras != null,
  );
  const hasPlannedWorkedHours = rows.some((r) => (Number(r.horas_planejadas) || 0) > 0);

  const n = rows.length;
  const dateMeta = useMemo(() => rows.map((r) => getDateMeta(r.date)), [rows]);
  const xLabels = useMemo(() => sparseLabels(dateMeta, n), [dateMeta, n]);
  const muted = isDark ? "#64748b" : "#94a3b8";
  const grid = isDark ? "rgba(148,163,184,.1)" : "rgba(100,116,139,.12)";

  const isAbs = variant === "abs";
  const isRisk = variant === "risk";
  const absDaily = useMemo(() => (isAbs ? dailyAbsTrendSeries(rows) : []), [rows, isAbs]);
  const absSummary = useMemo(() => {
    if (!absDaily.length) return null;
    const peak = absDaily.reduce(
      (current, day) => (day.absPct > current.absPct ? day : current),
      absDaily[0],
    );
    const businessDays = absDaily.filter((day) => !getDateMeta(day.date)?.isWeekend);
    const businessPeak = businessDays.length
      ? businessDays.reduce(
          (current, day) => (day.absPct > current.absPct ? day : current),
          businessDays[0],
        )
      : null;
    const daysAboveMeta = absDaily.filter((day) => day.absPct > absMeta).length;
    const first = absDaily[0]?.absPct || 0;
    const last = absDaily[absDaily.length - 1]?.absPct || 0;
    return {
      peak,
      peakIsWeekend: Boolean(getDateMeta(peak.date)?.isWeekend),
      businessPeak,
      daysAboveMeta,
      trend: last - first,
    };
  }, [absDaily, absMeta]);

  const riskDaily = useMemo(() => {
    if (!isRisk) return [];
    return rows.map((r) => riskDayFacts(r));
  }, [rows, isRisk]);

  const riskMostOcorrIdx = useMemo(() => {
    if (!riskDaily.length) return -1;
    let wi = 0;
    riskDaily.forEach((d, i) => {
      if (d.ocorr > riskDaily[wi].ocorr) wi = i;
    });
    return riskDaily[wi].ocorr > 0 ? wi : -1;
  }, [riskDaily]);

  const riskMostColabIdx = useMemo(() => {
    if (!riskDaily.length) return -1;
    let wi = 0;
    riskDaily.forEach((d, i) => {
      if (
        d.colaboradores > riskDaily[wi].colaboradores ||
        (d.colaboradores === riskDaily[wi].colaboradores && d.ocorr > riskDaily[wi].ocorr)
      ) {
        wi = i;
      }
    });
    return riskDaily[wi].colaboradores > 0 ? wi : -1;
  }, [riskDaily]);

  const riskOcorrMax = useMemo(() => {
    if (!riskDaily.length) return 1;
    return Math.max(...riskDaily.map((d) => d.ocorr), 1);
  }, [riskDaily]);

  const riskColabMax = useMemo(() => {
    if (!riskDaily.length) return 1;
    return Math.max(...riskDaily.map((d) => d.colaboradores), 1);
  }, [riskDaily]);

  const riskSeries = useMemo(() => {
    if (!isRisk) return [];
    return [
      { name: "Penalidades", type: "column", data: riskDaily.map((d) => d.ocorr) },
      { name: "Colaboradores", type: "line", data: riskDaily.map((d) => d.colaboradores) },
    ];
  }, [isRisk, riskDaily]);

  const riskOptions = useMemo(() => {
    if (!isRisk) return null;
    return {
      chart: {
        type: "line",
        background: "transparent",
        toolbar: embeddedInShell
          ? { show: false }
          : {
              show: true,
              offsetY: -2,
              tools: {
                download: true,
                zoom: true,
                pan: true,
                reset: true,
                zoomin: true,
                zoomout: true,
              },
            },
        zoom: { enabled: !embeddedInShell },
        animations: { enabled: true, speed: 320 },
        fontFamily: "inherit",
      },
      theme: { mode: isDark ? "dark" : "light" },
      colors: ["#ef4444", "#2563eb"],
      stroke: { curve: "smooth", width: [0, 3] },
      fill: {
        type: ["solid", "solid"],
        opacity: [0.72, 1],
      },
      plotOptions: {
        bar: {
          columnWidth: n > 20 ? "65%" : "50%",
          borderRadius: 3,
          borderRadiusApplication: "end",
        },
      },
      dataLabels: { enabled: false },
      markers: { size: [0, 4], strokeWidth: 2, strokeColors: isDark ? "#0f172a" : "#ffffff" },
      xaxis: {
        categories: xLabels,
        tickPlacement: "on",
        labels: {
          rotate: n > 10 ? -35 : -25,
          rotateAlways: n > 10,
          hideOverlappingLabels: true,
          trim: true,
          maxHeight: 52,
          style: {
            colors: dateMeta.map((dm, i) => {
              if (!xLabels[i]) return "transparent";
              if (dm?.feriado) return "#ef4444";
              if (dm?.isWeekend) return isDark ? "#475569" : "#94a3b8";
              return muted;
            }),
            fontSize: "9px",
            fontWeight: 600,
          },
        },
        axisBorder: { show: false },
        axisTicks: { show: false },
        crosshairs: { show: true, stroke: { color: muted, width: 1, dashArray: 3 } },
        tooltip: { enabled: false },
      },
      yaxis: [
        {
          seriesName: "Penalidades",
          min: 0,
          max: Math.ceil(riskOcorrMax * 1.18) || 1,
          tickAmount: Math.min(5, riskOcorrMax + 1),
          title: {
            text: "Penalidades",
            style: { color: "#ef4444", fontWeight: 700, fontSize: "10px" },
          },
          labels: {
            formatter: (v) => Math.round(v),
            style: { colors: muted, fontSize: "9px" },
          },
        },
        {
          seriesName: "Colaboradores",
          opposite: true,
          min: 0,
          max: Math.ceil(riskColabMax * 1.2) || 1,
          tickAmount: Math.min(5, riskColabMax + 1),
          title: {
            text: "Colaboradores",
            style: { color: "#2563eb", fontWeight: 700, fontSize: "10px" },
          },
          labels: {
            formatter: (v) => Math.round(v),
            style: { colors: muted, fontSize: "9px" },
          },
        },
      ],
      tooltip: {
        shared: true,
        intersect: false,
        theme: isDark ? "dark" : "light",
        style: { fontSize: "11px", fontFamily: "inherit" },
        custom({ series: allSeries, dataPointIndex, w }) {
          const dm = dateMeta[dataPointIndex];
          const title = dm
            ? `${dm.dowLabel} ${dm.label}${dm.feriado ? ` · ${dm.feriado}` : ""}`
            : xLabels[dataPointIndex] || "";
          const ocorr = allSeries[0]?.[dataPointIndex] ?? 0;
          const colabs = allSeries[1]?.[dataPointIndex] ?? 0;
          const top = riskDaily[dataPointIndex]?.topEvento;
          const topLine = top
            ? `<div class="apex-custom-tip-row"><span style="background:#f97316"></span>Principal evento: <b>${top.label} (${top.count})</b></div>`
            : "";
          return `<div class="apex-custom-tip"><div class="apex-custom-tip-title">${title}</div><div class="apex-custom-tip-row"><span style="background:#ef4444"></span>Penalidades: <b>${ocorr}</b></div><div class="apex-custom-tip-row"><span style="background:#2563eb"></span>Colaboradores: <b>${Math.round(colabs)}</b></div>${topLine}</div>`;
        },
      },
      legend: {
        show: embeddedInShell,
        position: "top",
        horizontalAlign: "left",
        fontSize: "11px",
        fontWeight: 700,
        labels: { colors: muted },
        markers: { width: 9, height: 9, radius: 9 },
        itemMargin: { horizontal: 10, vertical: 2 },
      },
      grid: {
        borderColor: grid,
        strokeDashArray: 4,
        xaxis: { lines: { show: false } },
        yaxis: { lines: { show: true } },
        padding: { top: 8, left: 8, right: 14, bottom: 4 },
      },
      annotations: {},
    };
  }, [isRisk, isDark, xLabels, dateMeta, n, muted, grid, riskOcorrMax, riskColabMax, riskDaily, embeddedInShell]);

  const riskDeptRows = useMemo(() => {
    if (!isRisk) return [];
    return computeRiscoByDepartment(rows);
  }, [rows, isRisk]);

  const riskDeptDisplay = useMemo(() => riskDeptRows, [riskDeptRows]);

  const riskDeptChartHeight = useMemo(() => {
    const count = riskDeptDisplay.length;
    if (!count) return 280;
    return Math.max(280, Math.min(1200, count * 38 + 72));
  }, [riskDeptDisplay.length]);

  const riskDeptOptions = useMemo(() => {
    if (!isRisk || !riskDeptDisplay.length) return null;
    const categories = riskDeptDisplay.map((d) => d.dept);
    return {
      chart: {
        type: "bar",
        background: "transparent",
        toolbar: embeddedInShell
          ? { show: false }
          : {
              show: true,
              offsetY: -2,
              tools: { download: true, reset: true },
            },
        animations: { enabled: true, speed: 320 },
        fontFamily: "inherit",
      },
      theme: { mode: isDark ? "dark" : "light" },
      colors: ["#ef4444"],
      plotOptions: {
        bar: {
          horizontal: true,
          borderRadius: 4,
          borderRadiusApplication: "end",
          barHeight: "68%",
          dataLabels: { position: "right" },
        },
      },
      dataLabels: {
        enabled: true,
        formatter: (v) => (Number(v) > 0 ? String(Math.round(v)) : ""),
        style: { fontSize: "10px", fontWeight: 700, colors: [isDark ? "#e2e8f0" : "#0f172a"] },
        offsetX: 4,
      },
      /* horizontal: categorias → eixo Y (via xaxis.categories na API Apex) */
      xaxis: {
        categories,
        labels: {
          show: true,
          maxWidth: 220,
          style: { colors: muted, fontSize: "10px", fontWeight: 600 },
          formatter: (val) => {
            const s = String(val ?? "");
            return s.length > 32 ? `${s.slice(0, 30)}…` : s;
          },
        },
        axisBorder: { show: false },
        axisTicks: { show: false },
      },
      grid: {
        borderColor: grid,
        strokeDashArray: 4,
        xaxis: { lines: { show: true } },
        yaxis: { lines: { show: false } },
        padding: { top: 4, left: 4, right: 36, bottom: 8 },
      },
      tooltip: {
        theme: isDark ? "dark" : "light",
        custom({ dataPointIndex }) {
          const d = riskDeptDisplay[dataPointIndex];
          if (!d) return "";
          return `<div class="apex-custom-tip"><div class="apex-custom-tip-title">${d.dept}</div><div class="apex-custom-tip-row"><span style="background:#ef4444"></span>Penalidades: <b>${d.ocorrencias.toLocaleString("pt-BR")}</b></div><div class="apex-custom-tip-row"><span style="background:#2563eb"></span>Colaboradores: <b>${d.colaboradores.toLocaleString("pt-BR")}</b></div></div>`;
        },
      },
      legend: { show: false },
    };
  }, [isRisk, isDark, riskDeptDisplay, muted, grid, embeddedInShell]);

  const riskDeptSeries = useMemo(() => {
    if (!isRisk || !riskDeptDisplay.length) return [];
    return [{ name: "Penalidades", data: riskDeptDisplay.map((d) => d.ocorrencias) }];
  }, [isRisk, riskDeptDisplay]);

  const daily = useMemo(
    () => rows.map((r) => ({ injust: dayInjust(r), just: dayJust(r), extr: dayExtr(r) })),
    [rows],
  );

  const series = useMemo(() => {
    const out = [];
    if (visible.injust) {
      out.push({ name: "Injustificadas", type: "column", data: daily.map((d) => d.injust) });
      out.push({
        name: "Injustificadas · tend.",
        type: "line",
        data: daily.map((d) => (d.injust > 0 ? d.injust : null)),
      });
      out.push({
        name: "Injustificadas · área",
        type: "area",
        data: daily.map((d) => (d.injust > 0 ? d.injust : null)),
      });
    }
    if (visible.just) {
      out.push({ name: "Justificadas", type: "column", data: daily.map((d) => d.just) });
      out.push({
        name: "Justificadas · tend.",
        type: "line",
        data: daily.map((d) => (d.just > 0 ? d.just : null)),
      });
      out.push({
        name: "Justificadas · área",
        type: "area",
        data: daily.map((d) => (d.just > 0 ? d.just : null)),
      });
    }
    if (visible.extr) {
      out.push({ name: "Extras", type: "column", data: daily.map((d) => d.extr) });
      out.push({
        name: "Extras · tend.",
        type: "line",
        data: daily.map((d) => (d.extr > 0 ? d.extr : null)),
      });
      out.push({
        name: "Extras · área",
        type: "area",
        data: daily.map((d) => (d.extr > 0 ? d.extr : null)),
      });
    }
    return out;
  }, [daily, visible]);

  const hoursMax = useMemo(() => {
    const vals = daily.flatMap((d) => [d.injust + d.just + d.extr, d.injust, d.just, d.extr]);
    return Math.ceil(Math.max(...vals, 60) / 60) * 60 + 60;
  }, [daily]);

  const { bestIdx, worstIdx } = useMemo(() => {
    if (!daily.length) return { bestIdx: -1, worstIdx: -1 };
    let bi = 0;
    let wi = 0;
    daily.forEach((d, i) => {
      const score = d.injust + d.just;
      const bestScore = daily[bi].injust + daily[bi].just;
      if (score < bestScore || (score === bestScore && d.injust < daily[bi].injust)) bi = i;
      if (d.injust > daily[wi].injust) wi = i;
    });
    return { bestIdx: bi, worstIdx: wi === bi ? -1 : wi };
  }, [daily]);

  const xAnnotations = useMemo(() => {
    const out = [];
    dateMeta.forEach((dm, i) => {
      if (!dm || !xLabels[i]) return;
      if (dm.feriado) {
        out.push({
          x: xLabels[i],
          fillColor: "rgba(239,68,68,0.06)",
          borderColor: "rgba(239,68,68,0.3)",
          borderWidth: 1,
        });
      }
    });
    if (bestIdx >= 0 && xLabels[bestIdx]) {
      out.push({
        x: xLabels[bestIdx],
        borderColor: "#22c55e",
        borderWidth: 2,
        label: {
          text: "▲ Melhor",
          style: {
            color: "#fff",
            background: "#22c55e",
            fontSize: "9px",
            fontWeight: 700,
            padding: { top: 2, bottom: 2, left: 6, right: 6 },
          },
          position: "top",
          offsetY: -4,
        },
      });
    }
    if (worstIdx >= 0 && xLabels[worstIdx] && worstIdx !== bestIdx) {
      out.push({
        x: xLabels[worstIdx],
        borderColor: "#ef4444",
        borderWidth: 2,
        label: {
          text: "▼ Pior",
          style: {
            color: "#fff",
            background: "#b91c1c",
            fontSize: "9px",
            fontWeight: 700,
            padding: { top: 2, bottom: 2, left: 6, right: 6 },
          },
          position: "top",
          offsetY: -4,
        },
      });
    }
    return out;
  }, [dateMeta, xLabels, bestIdx, worstIdx]);

  const buildPalette = () => {
    const c = [];
    if (visible.injust) c.push(SERIES_COLORS.injust, SERIES_COLORS.injust, SERIES_COLORS.injust);
    if (visible.just) c.push(SERIES_COLORS.just, SERIES_COLORS.just, SERIES_COLORS.just);
    if (visible.extr) c.push(SERIES_COLORS.extr, SERIES_COLORS.extr, SERIES_COLORS.extr);
    return c;
  };

  const buildWidths = () => {
    const w = [];
    if (visible.injust) w.push(0, 2.4, 1.2);
    if (visible.just) w.push(0, 2.4, 1.2);
    if (visible.extr) w.push(0, 2.4, 1.2);
    return w;
  };

  const buildFillTypes = () => {
    const t = [];
    if (visible.injust) t.push("solid", "solid", "gradient");
    if (visible.just) t.push("solid", "solid", "gradient");
    if (visible.extr) t.push("solid", "solid", "gradient");
    return t;
  };

  const buildFillOpacity = () => {
    const o = [];
    if (visible.injust) o.push(0.88, 1, 0.22);
    if (visible.just) o.push(0.88, 1, 0.22);
    if (visible.extr) o.push(0.88, 1, 0.22);
    return o;
  };

  const buildMarkers = () => {
    const s = [];
    if (visible.injust) s.push(0, 4, 0);
    if (visible.just) s.push(0, 4, 0);
    if (visible.extr) s.push(0, 4, 0);
    return s;
  };

  const options = useMemo(
    () => ({
      chart: {
        type: "line",
        stacked: true,
        stackOnlyBar: true,
        background: "transparent",
        toolbar: {
          show: true,
          offsetY: -2,
          tools: {
            download: true,
            zoom: true,
            pan: true,
            reset: true,
            zoomin: true,
            zoomout: true,
          },
        },
        zoom: { enabled: true },
        animations: { enabled: true, speed: 320 },
        fontFamily: "inherit",
      },
      theme: { mode: isDark ? "dark" : "light" },
      colors: buildPalette(),
      stroke: { curve: "smooth", width: buildWidths() },
      fill: {
        type: buildFillTypes(),
        opacity: buildFillOpacity(),
        gradient: {
          shade: isDark ? "dark" : "light",
          type: "vertical",
          opacityFrom: 0.5,
          opacityTo: 0.06,
          stops: [0, 90],
        },
      },
      plotOptions: {
        bar: {
          columnWidth: n > 20 ? "70%" : "55%",
          borderRadius: 3,
          borderRadiusApplication: "end",
          borderRadiusWhenStacked: "last",
        },
      },
      dataLabels: { enabled: false },
      markers: {
        size: buildMarkers(),
        strokeWidth: 2,
        strokeColors: isDark ? "#0f172a" : "#ffffff",
        hover: { size: 6 },
      },
      xaxis: {
        categories: xLabels,
        tickPlacement: "on",
        labels: {
          rotate: n > 10 ? -35 : -25,
          rotateAlways: n > 10,
          hideOverlappingLabels: true,
          trim: true,
          maxHeight: 52,
          style: {
            colors: dateMeta.map((dm, i) => {
              if (!xLabels[i]) return "transparent";
              if (dm?.feriado) return "#ef4444";
              if (dm?.isWeekend) return isDark ? "#475569" : "#94a3b8";
              return muted;
            }),
            fontSize: "9px",
            fontWeight: 600,
          },
        },
        axisBorder: { show: false },
        axisTicks: { show: false },
        crosshairs: { show: true, stroke: { color: muted, width: 1, dashArray: 3 } },
        tooltip: { enabled: false },
      },
      yaxis: {
        min: 0,
        max: hoursMax,
        tickAmount: 5,
        title: {
          text: "Horas",
          style: { color: muted, fontWeight: 700, fontSize: "10px" },
        },
        labels: {
          formatter: (v) => fmtH(v),
          style: { colors: muted, fontSize: "9px" },
        },
      },
      tooltip: {
        shared: true,
        intersect: false,
        theme: isDark ? "dark" : "light",
        style: { fontSize: "11px", fontFamily: "inherit" },
        custom({ series: allSeries, seriesIndex, dataPointIndex, w }) {
          const dm = dateMeta[dataPointIndex];
          const title = dm
            ? `${dm.dowLabel} ${dm.label}${dm.feriado ? ` · ${dm.feriado}` : ""}`
            : xLabels[dataPointIndex] || "";
          const seen = new Set();
          let html = `<div class="apex-custom-tip"><div class="apex-custom-tip-title">${title}</div>`;
          w.config.series.forEach((s, idx) => {
            if (s.type !== "column") return;
            if (seen.has(s.name)) return;
            seen.add(s.name);
            const val = allSeries[idx]?.[dataPointIndex];
            if (val == null || val === 0) return;
            const color = w.config.colors[idx] || "#94a3b8";
            html += `<div class="apex-custom-tip-row"><span style="background:${color}"></span>${s.name}: <b>${fmtH(val)}</b></div>`;
          });
          html += "</div>";
          return html;
        },
      },
      legend: { show: false },
      grid: {
        borderColor: grid,
        strokeDashArray: 4,
        xaxis: { lines: { show: false } },
        yaxis: { lines: { show: true } },
        padding: { top: 8, left: 8, right: 14, bottom: 4 },
      },
      annotations: { xaxis: xAnnotations },
    }),
    [isDark, xLabels, dateMeta, hoursMax, muted, grid, xAnnotations, visible, n],
  );

  const pickDays = (d) => {
    setLocalDays(d);
    setFaltDays?.(d);
  };

  const toggleSerie = (key) => {
    setVisible((prev) => {
      const next = { ...prev, [key]: !prev[key] };
      if (!next.injust && !next.just && !next.extr) return prev;
      return next;
    });
  };

  const totals = [
    { key: "injust", label: "Injustificadas", value: radar.horasAus, color: SERIES_COLORS.injust },
    { key: "just", label: "Justificadas", value: radar.horasJust, color: SERIES_COLORS.just },
    { key: "extr", label: "Extras", value: radar.horasExtras, color: SERIES_COLORS.extr },
  ];

  const hasAbsData = rows.some((r) => (Number(r.total) || 0) > 0);
  const canShowChart = hasHours || (isAbs && hasAbsData);

  if (rows.length < 2) {
    return <div className="pb-radar-evol-chart-empty">Período muito curto para exibir evolução.</div>;
  }

  if (isAbs) {
    if (!hasAbsData) {
      return (
        <div className="pb-radar-evol-chart-empty">
          Sem dados de absenteísmo no período selecionado.
        </div>
      );
    }

    const absPct = Number(radar.absPct) || 0;

    return (
      <div
        className="apex-hist-body pb-radar-premium-chart pb-radar-premium-chart--abs"
        data-dark={isDark}
        data-variant="abs"
      >
        <div className="pb-radar-premium-main-col pb-radar-premium-main-col--abs">
          <div className="pb-radar-premium-abs-strip" aria-label="Índice de absenteísmo do período">
            <div className="pb-radar-premium-abs-strip-main">
              <span className="pb-radar-premium-abs-strip-label">Índice absenteísmo</span>
              <strong className="pb-radar-premium-abs-strip-value">
                {absPct.toFixed(1).replace(".", ",")}%
              </strong>
              <small className="pb-radar-premium-abs-strip-note">
                {hasPlannedWorkedHours ? "Ponderado por horas no período" : "Calculado por colaboradores"}
              </small>
            </div>
            <div className="pb-radar-premium-abs-strip-meta">
              <span>Meta ≤ {Number(absMeta).toFixed(1).replace(".", ",")}%</span>
              <span
                className={
                  absPct <= absMeta
                    ? "pb-radar-premium-abs-strip-meta--ok"
                    : "pb-radar-premium-abs-strip-meta--bad"
                }
              >
                {absPct <= absMeta
                  ? "Dentro da meta"
                  : `+${(absPct - absMeta).toFixed(1).replace(".", ",")} pp acima`}
              </span>
            </div>
          </div>
          <div className="pb-radar-premium-abs-chart">
            <AbsenteismoChart
              histRows={rows}
              isDark={isDark}
              meta={absMeta}
              embedded
              onSelectDay={onSelectAbsDay}
            />
          </div>
        </div>

        {!customPeriod && (
          <div className="apex-hist-sidebar pb-radar-premium-sidebar pb-radar-premium-sidebar--abs">
            <div className="apex-sidebar-section">
              <span className="apex-sidebar-lbl">Período</span>
              <div className="apex-sidebar-period-row">
                <button
                  type="button"
                  className={`apex-sidebar-btn apex-sidebar-period-btn ${localDays === FALT_DAYS_ATUAL ? "is-active" : ""}`}
                  onClick={() => pickDays(FALT_DAYS_ATUAL)}
                >
                  Atual
                </button>
                {[7, 15, 30].map((d) => (
                  <button
                    key={d}
                    type="button"
                    className={`apex-sidebar-btn apex-sidebar-period-btn ${localDays === d ? "is-active" : ""}`}
                    onClick={() => pickDays(d)}
                  >
                    {d}d
                  </button>
                ))}
              </div>
            </div>
            {absSummary && (
              <div className="pb-abs-insights" aria-label="Resumo do período">
                <span className="apex-sidebar-lbl">Leitura do período</span>
                <div className="pb-abs-insight">
                  <small>Pior dia{absSummary.peakIsWeekend ? " · fim de semana" : ""}</small>
                  <strong>
                    {getDateMeta(absSummary.peak.date)?.dowLabel} {getDateMeta(absSummary.peak.date)?.label}
                  </strong>
                  <em>{absSummary.peak.absPct.toFixed(1).replace(".", ",")}%</em>
                </div>
                {absSummary.peakIsWeekend && absSummary.businessPeak && (
                  <div className="pb-abs-insight">
                    <small>Pior dia útil</small>
                    <strong>
                      {getDateMeta(absSummary.businessPeak.date)?.dowLabel}{" "}
                      {getDateMeta(absSummary.businessPeak.date)?.label}
                    </strong>
                    <em>{absSummary.businessPeak.absPct.toFixed(1).replace(".", ",")}%</em>
                  </div>
                )}
                <div className="pb-abs-insight">
                  <small>Dias acima da meta</small>
                  <strong>{absSummary.daysAboveMeta} de {absDaily.length}</strong>
                </div>
                {hasPlannedWorkedHours && (
                  <div className={`pb-abs-insight ${radar.horasPlan - radar.horasPres > 0 ? "is-bad" : "is-good"}`}>
                    <small>Diferença planejadas x trabalhadas</small>
                    <strong>{fmtHM(Math.max(radar.horasPlan - radar.horasPres, 0))}</strong>
                    <em>{radar.horasPlan - radar.horasPres > 0 ? "Abaixo" : "Sem diferença"}</em>
                  </div>
                )}
                {hasHours && (
                  <div className="pb-abs-insight pb-abs-insight--breakdown">
                    <small>Horas ausentes</small>
                    <strong>{fmtHM((Number(radar.horasAus) || 0) + (Number(radar.horasJust) || 0))}</strong>
                    <span>
                      {fmtHM(Number(radar.horasAus) || 0)} injust. +{" "}
                      {fmtHM(Number(radar.horasJust) || 0)} just.
                    </span>
                  </div>
                )}
                {hasHours && Number(radar.horasExtras) > 0 && (
                  <div className="pb-abs-insight pb-abs-insight--context">
                    <small>Horas extras · separadas das trabalhadas</small>
                    <strong>{fmtHM(Number(radar.horasExtras) || 0)}</strong>
                    <span>Não compõem o índice de absenteísmo.</span>
                  </div>
                )}
                <div className={`pb-abs-insight ${absSummary.trend > 0 ? "is-bad" : "is-good"}`}>
                  <small>Tendência no intervalo</small>
                  <strong>
                    {absSummary.trend > 0 ? "Piora" : absSummary.trend < 0 ? "Melhora" : "Estável"}
                  </strong>
                  <em>{absSummary.trend > 0 ? "+" : ""}{absSummary.trend.toFixed(1).replace(".", ",")} pp</em>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    );
  }

  if (isRisk) {
    const hasRiskData = riskDaily.some((d) => d.ocorr > 0);
    if (!hasRiskData) {
      return (
        <div className="pb-radar-evol-chart-empty">
          Sem penalidades de risco trabalhista no período selecionado.
        </div>
      );
    }

    const rr = riscoRadar || computeRiscoRadar(rows);
    const chartHeight = embeddedInShell ? embeddedChartHeight : 420;
    const activeRiskView = forcedRiskView || riskViewMode;

    if (embeddedInShell) {
      if (!hasRiskData) {
        return (
          <div className="pb-radar-evol-chart-empty pb-radar-evol-chart-empty--embedded">
            Sem penalidades de risco trabalhista no período selecionado.
          </div>
        );
      }
      return (
        <div
          className="pb-radar-premium-chart pb-radar-premium-chart--risk pb-radar-premium-chart--embedded-shell"
          data-dark={isDark}
          data-variant="risk"
        >
          <div
            className={`apex-hist-chart pb-radar-premium-risk-chart pb-radar-premium-risk-chart--embedded${activeRiskView === "depto" ? " pb-radar-premium-risk-chart--depto" : ""}`}
            ref={chartWrapRef}
          >
            {activeRiskView === "timeline" ? (
              <ReactApexChart
                key="risk-timeline-embedded"
                options={riskOptions}
                series={riskSeries}
                type="line"
                height={chartHeight}
                width="100%"
              />
            ) : riskDeptRows.length > 0 && riskDeptOptions ? (
              <ReactApexChart
                key="risk-depto-embedded"
                options={riskDeptOptions}
                series={riskDeptSeries}
                type="bar"
                height={riskDeptChartHeight}
                width="100%"
              />
            ) : (
              <div className="pb-radar-evol-chart-empty">
                Sem penalidades por departamento no período.
              </div>
            )}
          </div>
        </div>
      );
    }

    return (
      <div
        className="apex-hist-body pb-radar-premium-chart pb-radar-premium-chart--risk"
        data-dark={isDark}
        data-variant="risk"
      >
        <div className="pb-radar-premium-main-col pb-radar-premium-main-col--risk">
          <div className="pb-radar-premium-risk-strip" aria-label="Penalidades de risco trabalhista no período">
            <div className="pb-radar-premium-risk-strip-main">
              <span className="pb-radar-premium-risk-strip-label">Penalidades</span>
              <strong className="pb-radar-premium-risk-strip-value">
                {rr.riscoOcorrencias.toLocaleString("pt-BR")}
              </strong>
            </div>
            <div className="pb-radar-premium-risk-strip-meta">
              <span>
                {rr.riscoColaboradores.toLocaleString("pt-BR")} colaborador(es) impactado(s)
              </span>
              <span>Eventos classificados como Risco Trab. em Configurações → Horas</span>
            </div>
            <div className="pb-radar-premium-risk-legend" aria-label="Legenda do gráfico">
              <span>
                <i className="pb-radar-premium-risk-legend-dot pb-radar-premium-risk-legend-dot--pen" />
                Penalidades por dia
              </span>
              <span>
                <i className="pb-radar-premium-risk-legend-line" />
                Colaboradores únicos por dia
              </span>
            </div>
          </div>
          <div
            className={`apex-hist-chart pb-radar-premium-risk-chart${riskViewMode === "depto" ? " pb-radar-premium-risk-chart--depto" : ""}`}
            ref={chartWrapRef}
          >
            {riskViewMode === "timeline" ? (
              <ReactApexChart
                key="risk-timeline"
                options={riskOptions}
                series={riskSeries}
                type="line"
                height={chartHeight}
                width="100%"
              />
            ) : riskDeptRows.length > 0 && riskDeptOptions ? (
              <ReactApexChart
                key="risk-depto"
                options={riskDeptOptions}
                series={riskDeptSeries}
                type="bar"
                height={riskDeptChartHeight}
                width="100%"
              />
            ) : (
              <div className="pb-radar-evol-chart-empty">
                Sem penalidades por departamento no período.
              </div>
            )}
          </div>
        </div>

        {!customPeriod && (
          <div className="apex-hist-sidebar pb-radar-premium-sidebar pb-radar-premium-sidebar--risk">
            <div className="apex-sidebar-section">
              <span className="apex-sidebar-lbl">Período</span>
              <div className="apex-sidebar-period-row">
                <button
                  type="button"
                  className={`apex-sidebar-btn apex-sidebar-period-btn ${localDays === FALT_DAYS_ATUAL ? "is-active" : ""}`}
                  onClick={() => pickDays(FALT_DAYS_ATUAL)}
                >
                  Atual
                </button>
                {[7, 15, 30].map((d) => (
                  <button
                    key={d}
                    type="button"
                    className={`apex-sidebar-btn apex-sidebar-period-btn ${localDays === d ? "is-active" : ""}`}
                    onClick={() => pickDays(d)}
                  >
                    {d}d
                  </button>
                ))}
              </div>
            </div>

            <div className="apex-sidebar-section">
              <span className="apex-sidebar-lbl">Visualização</span>
              <div className="pb-radar-premium-risk-view pb-radar-premium-risk-view--sidebar">
                <button
                  type="button"
                  className={`apex-sidebar-btn pb-radar-premium-risk-view-btn ${riskViewMode === "timeline" ? "is-active" : ""}`}
                  onClick={() => setRiskViewMode("timeline")}
                >
                  Por dia
                </button>
                <button
                  type="button"
                  className={`apex-sidebar-btn pb-radar-premium-risk-view-btn ${riskViewMode === "depto" ? "is-active" : ""}`}
                  onClick={() => setRiskViewMode("depto")}
                >
                  Por depto
                </button>
              </div>
            </div>

            {riskViewMode === "depto" && riskDeptRows.length > 0 ? (
              <div className="apex-sidebar-section">
                <span className="apex-sidebar-lbl">Top departamentos</span>
                {riskDeptRows.slice(0, 5).map((d, i) => (
                  <div
                    key={d.dept}
                    className="apex-sidebar-kpi pb-radar-risk-dept-kpi"
                    style={{ "--kpi-color": i === 0 ? "#ef4444" : "#fca5a5" }}
                  >
                    <span className="apex-kpi-ico">{i + 1}º</span>
                    <div className="pb-radar-risk-dept-kpi-body">
                      <span className="pb-radar-risk-dept-kpi-name" title={d.dept}>
                        {d.dept}
                      </span>
                      <span className="pb-radar-risk-dept-kpi-meta">
                        {d.ocorrencias.toLocaleString("pt-BR")} penalidade(s) ·{" "}
                        {d.colaboradores.toLocaleString("pt-BR")} colab.
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            ) : null}

            {riskViewMode === "timeline" && riskMostOcorrIdx >= 0 && (
              <div className="apex-sidebar-section">
                <span className="apex-sidebar-lbl">Destaque</span>
                <div className="apex-sidebar-kpi" style={{ "--kpi-color": "#ef4444" }}>
                  <span className="apex-kpi-ico">▲</span>
                  <span className="apex-kpi-lbl">Mais penalidades</span>
                  <span className="apex-kpi-val">
                    {dateMeta[riskMostOcorrIdx]
                      ? `${dateMeta[riskMostOcorrIdx].dowLabel} ${dateMeta[riskMostOcorrIdx].label}`
                      : "—"}
                    <br />
                    {riskDaily[riskMostOcorrIdx]?.ocorr ?? 0} ocorr.
                  </span>
                </div>
                {riskMostColabIdx >= 0 && riskMostColabIdx !== riskMostOcorrIdx && (
                  <div className="apex-sidebar-kpi" style={{ "--kpi-color": "#2563eb" }}>
                    <span className="apex-kpi-ico">●</span>
                    <span className="apex-kpi-lbl">Mais colaboradores</span>
                    <span className="apex-kpi-val">
                      {dateMeta[riskMostColabIdx]
                        ? `${dateMeta[riskMostColabIdx].dowLabel} ${dateMeta[riskMostColabIdx].label}`
                        : "—"}
                      <br />
                      {riskDaily[riskMostColabIdx]?.colaboradores ?? 0} colab.
                    </span>
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </div>
    );
  }

  if (!canShowChart) {
    return (
      <div className="pb-radar-evol-chart-empty">
        Sem dados de horas no período — importe colunas de horas para ver o gráfico premium.
      </div>
    );
  }

  const chartHeight = 420;

  return (
    <div
      className="apex-hist-body pb-radar-premium-chart"
      data-dark={isDark}
      data-variant={variant}
    >
      <div className="pb-radar-premium-main-col">
        <div className="apex-hist-chart pb-radar-premium-chart-main" ref={chartWrapRef}>
          <ReactApexChart
            options={options}
            series={series}
            type="line"
            height={chartHeight}
            width="100%"
          />
        </div>
      </div>

      <div className="apex-hist-sidebar pb-radar-premium-sidebar">
        {!customPeriod && (
          <div className="apex-sidebar-section">
            <span className="apex-sidebar-lbl">Período</span>
            <div className="apex-sidebar-period-row">
              <button
                type="button"
                className={`apex-sidebar-btn apex-sidebar-period-btn ${localDays === FALT_DAYS_ATUAL ? "is-active" : ""}`}
                onClick={() => pickDays(FALT_DAYS_ATUAL)}
              >
                Atual
              </button>
              {[7, 15, 30].map((d) => (
                <button
                  key={d}
                  type="button"
                  className={`apex-sidebar-btn apex-sidebar-period-btn ${localDays === d ? "is-active" : ""}`}
                  onClick={() => pickDays(d)}
                >
                  {d}d
                </button>
              ))}
            </div>
          </div>
        )}

        {bestIdx >= 0 && (
          <div className="apex-sidebar-section">
            <span className="apex-sidebar-lbl">Destaque</span>
            <div className="apex-sidebar-kpi" style={{ "--kpi-color": "#22c55e" }}>
              <span className="apex-kpi-ico">▲</span>
              <span className="apex-kpi-lbl">Menor ausência</span>
              <span className="apex-kpi-val">
                {dateMeta[bestIdx] ? `${dateMeta[bestIdx].dowLabel} ${dateMeta[bestIdx].label}` : "—"}
                <br />
                {fmtH(daily[bestIdx].injust + daily[bestIdx].just)}
              </span>
            </div>
            {worstIdx >= 0 && (
              <div className="apex-sidebar-kpi" style={{ "--kpi-color": "#ef4444" }}>
                <span className="apex-kpi-ico">▼</span>
                <span className="apex-kpi-lbl">Maior injustificada</span>
                <span className="apex-kpi-val">
                  {dateMeta[worstIdx]
                    ? `${dateMeta[worstIdx].dowLabel} ${dateMeta[worstIdx].label}`
                    : "—"}
                  <br />
                  {fmtH(daily[worstIdx].injust)}
                </span>
              </div>
            )}
          </div>
        )}

        <div className="apex-sidebar-section">
          <span className="apex-sidebar-lbl">Séries</span>
          {totals.map((t) => (
            <button
              key={t.key}
              type="button"
              className={`apex-sidebar-btn apex-sidebar-serie ${visible[t.key] ? "is-active" : ""}`}
              style={{ "--serie-color": t.color }}
              onClick={() => toggleSerie(t.key)}
            >
              <span className="apex-serie-dot" />
              {t.label}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
