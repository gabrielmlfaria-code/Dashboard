import React, { useEffect, useRef, useMemo, useState } from "react";
import ReactApexChart from "react-apexcharts";
import { DEFAULT_ABSENTEISMO_META, saveAbsenteismoMeta } from "./posicaoSettings.js";
import { computeAbsenteismoDayMetric, computeAbsenteismoPeriodSummary } from "./radarHoursUtils.js";
import { useChartHostHeight } from "./useChartHostHeight.js";
import { ChartLegendBar, PB_CHART_IDS } from "./ChartLegendBar.jsx";

// ─── Feriados ────────────────────────────────────────────────────────────────
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

function getDateMeta(iso) {
  if (!iso) return null;
  const m = String(iso).match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!m) return null;
  const [, yyyy, mm, dd] = m;
  const date = new Date(Number(yyyy), Number(mm) - 1, Number(dd));
  const dow = date.getDay();
  const mmdd = `${mm}-${dd}`;
  const feriado = FERIADOS_MOVEIS[iso] || FERIADOS_FIXOS[mmdd] || null;
  return {
    dow,
    dowLabel: DOW_PT[dow],
    label: `${dd}/${mm}`,
    feriado,
    isWeekend: dow === 0 || dow === 6,
  };
}

// Média móvel
function rollingMean(arr, w) {
  return arr.map((_, i) => {
    const sl = arr
      .slice(Math.max(0, i - w + 1), i + 1)
      .filter((v) => v != null && !Number.isNaN(v));
    return sl.length ? +(sl.reduce((s, v) => s + v, 0) / sl.length).toFixed(1) : null;
  });
}

function fmtMin(value) {
  const total = Math.round(Number(value) || 0);
  const sign = total < 0 ? "-" : "";
  const abs = Math.abs(total);
  return `${sign}${Math.floor(abs / 60)}:${String(abs % 60).padStart(2, "0")}`;
}

function fmtHoursReadable(value) {
  const total = Math.round(Number(value) || 0);
  const sign = total < 0 ? "-" : "";
  const abs = Math.abs(total);
  const hours = Math.floor(abs / 60).toLocaleString("pt-BR");
  return `${sign}${hours} h ${String(abs % 60).padStart(2, "0")} min`;
}

const COMPARE_METRICS = [
  { key: "plannedMin", label: "Horas planejadas", short: "Planejadas", color: "#64748b", type: "bar" },
  { key: "workedMin", label: "Horas trabalhadas", short: "Trabalhadas", color: "#2563eb", type: "bar" },
  { key: "unjustMin", label: "Aus. injustificadas", short: "Injustificadas", color: "#ef4444", type: "bar" },
  { key: "justifiedMin", label: "Aus. justificadas", short: "Justificadas", color: "#f59e0b", type: "bar" },
  { key: "extraMin", label: "Horas extras", short: "Extras", color: "#16a34a", type: "bar" },
  { key: "absentPeople", label: "Colab. ausentes", short: "Colab. ausentes", color: "#dc2626", type: "line" },
];
const DEFAULT_COMPARE_METRICS = ["plannedMin", "workedMin", "unjustMin"];
const ABS_VIEW_PRESETS = [
  { id: "executivo", label: "Executivo", title: "Índice e meta — visão resumida" },
  { id: "rh", label: "RH", title: "Injust., just., média e índice" },
  { id: "operacional", label: "Operacional", title: "RH + quantidade de ausentes" },
  { id: "card", label: "Como no card", title: "RH + horas do período (como o card Início)" },
  { id: "horas", label: "Horas", title: "Abrir gráfico de horas (Hrs)" },
];

const SERIES_VISUAL = {
  "Inj. %": { color: "#ef4444", stroke: 0, dash: 0, fill: 0.82, marker: 0 },
  "Just. %": { color: "#f59e0b", stroke: 0, dash: 0, fill: 0.68, marker: 0 },
  "Média do período": { color: null, stroke: 2, dash: 5, fill: 1, marker: 0 },
  "Média móvel 7d": { color: null, stroke: 2, dash: 5, fill: 1, marker: 0 },
  Meta: { color: "#22c55e", stroke: 2, dash: 5, fill: 1, marker: 0 },
  "Colab. ausentes": { color: null, stroke: 2, dash: 0, fill: 1, marker: 3 },
  "Índice absenteísmo": { color: "#4f46e5", stroke: 3, dash: 0, fill: 1, marker: 4 },
};

const METRIC_HELP = {
  plannedMin: "Soma das horas previstas na escala do período.",
  workedMin: "Soma somente das horas classificadas na categoria Presentes, limitada ao planejado.",
  unjustMin: "Soma das horas de faltas e atrasos sem justificativa.",
  justifiedMin: "Soma das horas classificadas como justificadas.",
  extraMin: "Soma das horas extras; não compõe horas trabalhadas nem o índice.",
  absentPeople: "Quantidade de colaboradores com ausência injustificada ou justificada.",
};

// ─── Componente ──────────────────────────────────────────────────────────────
function AbsenteismoChart({
  histRows,
  isDark,
  meta: metaProp,
  compact = false,
  embedded = false,
  onSelectDay,
  onRequestHoursView,
}) {
  const wrapRef = useRef(null);
  const chartAreaRef = useRef(null);
  const exportCaptureRef = useRef(null);
  const chartHostHeight = useChartHostHeight(chartAreaRef, {
    enabled: !compact && !embedded,
    minHeight: 120,
    fallbackHeight: 300,
  });
  const [meta, setMeta] = useState(metaProp ?? 5);
  const [chartMode, setChartMode] = useState("index");
  const [selectedMetrics, setSelectedMetrics] = useState(
    () => new Set(DEFAULT_COMPARE_METRICS),
  );
  const [hoverIndex, setHoverIndex] = useState(null);
  const [showPeopleCount, setShowPeopleCount] = useState(false);
  const [viewPreset, setViewPreset] = useState("rh");

  const indexPresetFlags = useMemo(() => {
    if (chartMode === "compare") return null;
    switch (viewPreset) {
      case "executivo":
        return { showBars: false, showMean: false, showPeople: false };
      case "operacional":
        return { showBars: true, showMean: true, showPeople: true };
      case "card":
      case "rh":
      default:
        return { showBars: true, showMean: true, showPeople: showPeopleCount };
    }
  }, [chartMode, viewPreset, showPeopleCount]);

  const applyViewPreset = (id) => {
    if (id === "horas") {
      onRequestHoursView?.();
      return;
    }
    setViewPreset(id);
    setChartMode("index");
    setShowPeopleCount(id === "operacional");
  };

  const handlePeopleToggle = (checked) => {
    setShowPeopleCount(checked);
    if (checked && viewPreset !== "operacional" && viewPreset !== "horas") {
      setViewPreset("operacional");
    }
    if (!checked && viewPreset === "operacional") setViewPreset("rh");
  };

  useEffect(() => {
    if (metaProp != null && Number.isFinite(metaProp)) setMeta(metaProp);
  }, [metaProp]);

  const handleMetaChange = (value) => {
    const v = Number(value);
    setMeta(v);
    saveAbsenteismoMeta(v);
  };

  // Remove <title> SVG automático do ApexCharts
  useEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    const rm = () => el.querySelectorAll(".apexcharts-svg > title").forEach((t) => t.remove());
    rm();
    const mo = new MutationObserver(rm);
    mo.observe(el, { childList: true, subtree: true });
    return () => mo.disconnect();
  }, []);

  const n = histRows.length;
  const dateMeta = useMemo(() => histRows.map((r) => getDateMeta(r.date)), [histRows]);

  const labels = useMemo(() => {
    const showAll = n <= 15;
    return dateMeta.map((dm, i) => {
      if (!showAll) {
        const step = Math.max(1, Math.ceil(n / 12));
        if (i !== 0 && i !== n - 1 && i % step !== 0) return "";
      }
      return dm ? `${dm.dowLabel} ${dm.label}` : "";
    });
  }, [dateMeta, n]);
  const axisKeys = useMemo(
    () => histRows.map((r, i) => r.date || `dia-${i + 1}`),
    [histRows],
  );
  const axisLabelByKey = useMemo(
    () => new Map(axisKeys.map((key, i) => [key, labels[i]])),
    [axisKeys, labels],
  );

  const computed = useMemo(
    () => histRows.map((r) => computeAbsenteismoDayMetric(r)),
    [histRows],
  );

  const periodSummary = useMemo(
    () => computeAbsenteismoPeriodSummary(histRows),
    [histRows],
  );
  const periodRate = periodSummary.periodRate;
  const comparisonTotals = useMemo(
    () => ({
      plannedMin: periodSummary.plannedMin,
      workedMin: periodSummary.workedMin,
      unjustMin: periodSummary.unjustMin,
      justifiedMin: periodSummary.justifiedMin,
      extraMin: periodSummary.extraMin,
      absentPeople: periodSummary.absentPeople,
      balanceMin: periodSummary.balanceMin,
    }),
    [periodSummary],
  );
  const hasHourData = periodSummary.hasHourData;
  const hasWeightedIndex = periodSummary.hasWeightedIndex;
  const activeCompareMetrics = useMemo(
    () =>
      COMPARE_METRICS.filter(
        (metric) => metric.key !== "absentPeople" && selectedMetrics.has(metric.key) && hasHourData,
      ),
    [selectedMetrics, hasHourData],
  );
  const activeHourMetrics = activeCompareMetrics;
  const hasPeopleSeries = true;
  const compareIndexAxisIndex = activeHourMetrics.length > 0 ? 2 : 1;
  const chartRenderKey = `${chartMode}:${activeCompareMetrics.map((metric) => metric.key).join("|")}:${hasHourData ? "hours" : "people"}`;
  const peakRate = useMemo(
    () => computed.reduce((max, c) => Math.max(max, c.indexRate), 0),
    [computed],
  );
  const hoverDay = hoverIndex != null ? computed[hoverIndex] : null;
  const hoverMeta = hoverIndex != null ? dateMeta[hoverIndex] : null;

  const toggleMetric = (key) => {
    const enteringCompare = chartMode !== "compare";
    setChartMode("compare");
    setSelectedMetrics((current) => {
      if (enteringCompare) {
        return new Set([key]);
      }
      const next = new Set(current);
      if (next.has(key) && next.size > 1) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  const resetChart = () => {
    setChartMode("index");
    setSelectedMetrics(new Set(DEFAULT_COMPARE_METRICS));
    setMeta(DEFAULT_ABSENTEISMO_META);
    saveAbsenteismoMeta(DEFAULT_ABSENTEISMO_META);
  };

  useEffect(() => {
    setHoverIndex(null);
  }, [chartRenderKey, showPeopleCount, viewPreset]);

  const WINDOW = Math.min(7, n);
  const usePeriodMean = n <= 7;
  /** Período curto (7d): rótulo do índice em todos os pontos, não só no hover. */
  const showFixedIndexLabels = n <= 7;
  const rolling = useMemo(
    () =>
      usePeriodMean
        ? computed.map(() => periodRate)
        : rollingMean(
            computed.map((c) => c.indexRate),
            WINDOW,
          ),
    [computed, WINDOW, usePeriodMean, periodRate],
  );

  // Melhor e pior dia (menor e maior taxa total)
  // Escala eixo Y
  const yMax = useMemo(() => {
    const max = Math.max(...computed.map((c) => c.indexRate), meta + 2, 10);
    return Math.ceil(max / 5) * 5 + 5;
  }, [computed, meta]);

  const peopleYMax = useMemo(() => {
    const peak = Math.max(0, ...computed.map((c) => c.ausCount + c.justCount));
    return Math.max(5, Math.ceil(peak * 1.12));
  }, [computed]);

  const periodKpis = useMemo(() => {
    if (!computed.length) return null;
    let bestI = 0;
    let worstI = 0;
    computed.forEach((c, i) => {
      if (c.indexRate < computed[bestI].indexRate) bestI = i;
      if (c.indexRate > computed[worstI].indexRate) worstI = i;
    });
    const avgInj =
      computed.reduce((s, c) => s + c.ausRate, 0) / computed.length;
    const avgJust =
      computed.reduce((s, c) => s + c.justRate, 0) / computed.length;
    const daysAboveMeta = computed.filter((c) => c.indexRate > meta).length;
    return {
      bestI,
      worstI,
      avgInj,
      avgJust,
      daysAboveMeta,
      deltaMeta: +(periodRate - meta).toFixed(1),
    };
  }, [computed, meta, periodRate]);

  const peopleLineColor = "#9333ea";

  const muted = isDark ? "#64748b" : "#94a3b8";
  const grid = isDark ? "rgba(148,163,184,.08)" : "rgba(100,116,139,.11)";

  // Séries: 2 barras empilhadas + 1 linha de média móvel
  const series = useMemo(() => {
    const indexLine = {
      name: "Índice absenteísmo",
      type: "line",
      data: computed.map((c, i) => ({ x: axisKeys[i], y: c.indexRate })),
    };
    const absentLine = {
      name: "Colab. ausentes",
      type: "line",
      data: computed.map((c, i) => ({ x: axisKeys[i], y: c.ausCount + c.justCount })),
    };
    if (chartMode === "compare") {
      const out = [
        ...activeHourMetrics.map((metric) => ({
          name: metric.label,
          type: metric.type,
          data: computed.map((c, i) => ({
            x: axisKeys[i],
            y: c[metric.key],
          })),
        })),
        indexLine,
      ];
      if (showPeopleCount) out.splice(out.length - 1, 0, absentLine);
      return out;
    }
    const meanName = usePeriodMean ? "Média do período" : `Média móvel ${WINDOW}d`;
    const flags = indexPresetFlags ?? {
      showBars: true,
      showMean: true,
      showPeople: showPeopleCount,
    };
    const indexSeries = [];
    if (flags.showBars) {
      indexSeries.push(
        {
          name: "Inj. %",
          type: "bar",
          data: computed.map((c, i) => ({
            x: axisKeys[i],
            y: c.ausRate,
            fillColor: c.indexRate > meta ? "#ef4444" : "#f87171",
          })),
        },
        {
          name: "Just. %",
          type: "bar",
          data: computed.map((c, i) => ({
            x: axisKeys[i],
            y: c.justRate,
            fillColor: c.indexRate > meta ? "#f59e0b" : "#fbbf24",
          })),
        },
      );
    }
    if (flags.showMean) {
      indexSeries.push({
        name: meanName,
        type: "line",
        data: rolling.map((v, i) => ({ x: axisKeys[i], y: v })),
      });
    }
    indexSeries.push({
      name: "Meta",
      type: "line",
      data: axisKeys.map((key) => ({ x: key, y: meta })),
    });
    if (flags.showPeople) indexSeries.push(absentLine);
    indexSeries.push(indexLine);
    return indexSeries;
  }, [
    chartMode,
    activeHourMetrics,
    computed,
    rolling,
    axisKeys,
    WINDOW,
    meta,
    usePeriodMean,
    showPeopleCount,
    indexPresetFlags,
  ]);
  const absentSeriesIndex = series.findIndex((serie) => serie.name === "Colab. ausentes");
  const indexSeriesIndex = series.findIndex((serie) => serie.name === "Índice absenteísmo");

  const meanMuted = isDark ? "#94a3b8" : "#64748b";

  const buildSeriesVisual = useMemo(() => {
    const mapStyle = (name) => {
      const base = SERIES_VISUAL[name] || SERIES_VISUAL["Índice absenteísmo"];
      let color = base.color;
      if (color == null) {
        if (name.startsWith("Média")) color = meanMuted;
        else if (name === "Colab. ausentes") color = peopleLineColor;
      }
      return {
        color,
        stroke: base.stroke,
        dash: base.dash,
        fill: base.fill,
        marker: base.marker,
      };
    };
    return (names) => {
      const styles = names.map(mapStyle);
      return {
        colors: styles.map((s) => s.color),
        strokeWidths: styles.map((s) => s.stroke),
        dash: styles.map((s) => s.dash),
        fill: styles.map((s) => s.fill),
        markers: styles.map((s) => s.marker),
      };
    };
  }, [meanMuted, peopleLineColor]);

  const indexVisual = useMemo(() => {
    if (chartMode === "compare") {
      const names = [
        ...activeHourMetrics.map((m) => m.label),
        ...(showPeopleCount ? ["Colab. ausentes"] : []),
        "Índice absenteísmo",
      ];
      const colors = [
        ...activeHourMetrics.map((m) => m.color),
        ...(showPeopleCount ? [peopleLineColor] : []),
        "#4f46e5",
      ];
      const strokeWidths = [
        ...activeHourMetrics.map((m) => (m.type === "bar" ? 0 : 2)),
        ...(showPeopleCount ? [2] : []),
        3,
      ];
      return {
        colors,
        strokeWidths,
        dash: 0,
        fill: 0.84,
        markers: series.map((_s, i) =>
          i === indexSeriesIndex ? 4 : i === absentSeriesIndex ? 3 : 0,
        ),
      };
    }
    return buildSeriesVisual(series.map((s) => s.name));
  }, [
    chartMode,
    series,
    activeHourMetrics,
    showPeopleCount,
    peopleLineColor,
    buildSeriesVisual,
    indexSeriesIndex,
    absentSeriesIndex,
  ]);

  const indexPalette = indexVisual.colors;
  const indexStrokeWidths = indexVisual.strokeWidths;
  const indexStrokeDash = indexVisual.dash;
  const indexFillOpacity = indexVisual.fill;
  const indexMarkerSizes = indexVisual.markers;

  const labelSeriesIndexes = useMemo(
    () =>
      [indexSeriesIndex, absentSeriesIndex].filter(
        (i) => i >= 0 && (i !== absentSeriesIndex || showPeopleCount),
      ),
    [indexSeriesIndex, absentSeriesIndex, showPeopleCount],
  );

  // Annotations: melhor/pior + feriados
  const xAnnotations = useMemo(() => {
    const out = [];
    dateMeta.forEach((dm, i) => {
      if (dm?.feriado) {
        out.push({
          x: axisKeys[i],
          fillColor: "rgba(239,68,68,0.07)",
          borderColor: "#ef4444",
          borderWidth: 1,
          label: {
            text: dm.feriado,
            style: {
              color: "#fff",
              background: "#ef4444",
              fontSize: "8px",
              fontWeight: 700,
              padding: { top: 2, bottom: 2, left: 4, right: 4 },
            },
            position: "top",
            offsetY: -2,
          },
        });
      }
      if (
        computed[i]?.indexRate > meta &&
        (computed[i].indexRate === peakRate || i === periodKpis?.worstI || n <= 10)
      ) {
        out.push({
          x: axisKeys[i],
          fillColor: "rgba(239,68,68,0.06)",
          borderColor: "rgba(239,68,68,0.28)",
          borderWidth: 1,
          label:
            computed[i].indexRate === peakRate || i === periodKpis?.worstI
              ? {
                  text: "Acima da meta",
                  style: {
                    color: "#fff",
                    background: "#dc2626",
                    fontSize: "8px",
                    fontWeight: 700,
                  },
                  position: "top",
                }
              : undefined,
        });
      }
    });
    return out;
  }, [dateMeta, axisKeys, chartMode, computed, meta, peakRate, periodKpis, n]);

  const options = useMemo(
    () => ({
      chart: {
        id: PB_CHART_IDS.abs,
        type: "bar",
        stacked: chartMode === "index" && series.some((s) => s.type === "bar"),
        background: "transparent",
        toolbar: { show: false },
        zoom: { enabled: false },
        redrawOnParentResize: true,
        animations: { enabled: true, speed: 280 },
        fontFamily: "inherit",
        events: {
          dataPointMouseEnter: (_event, _chartContext, config) => {
            if (config?.dataPointIndex >= 0) setHoverIndex(config.dataPointIndex);
          },
          dataPointMouseLeave: () => setHoverIndex(null),
          dataPointSelection: (_event, _chartContext, config) => {
            const selected = computed[config.dataPointIndex];
            if (selected?.date) onSelectDay?.(selected.date);
          },
        },
      },
      theme: { mode: isDark ? "dark" : "light" },
      colors: indexPalette,
      stroke: {
        curve: "smooth",
        width: indexStrokeWidths,
        dashArray: indexStrokeDash,
      },
      fill: {
        opacity: indexFillOpacity,
      },
      plotOptions: {
        bar: {
          columnWidth: chartMode === "compare" ? "72%" : "62%",
          borderRadius: 2,
          borderRadiusApplication: "end",
          borderRadiusWhenStacked: "last",
        },
      },
      dataLabels: {
        enabled: true,
        enabledOnSeries: labelSeriesIndexes,
        offsetY: -8,
        formatter: (value, opts) => {
          const index = opts.dataPointIndex;
          if (value == null) return "";
          if (opts.seriesIndex === indexSeriesIndex) {
            const show =
              showFixedIndexLabels ||
              hoverIndex === index ||
              index === n - 1 ||
              index === periodKpis?.worstI ||
              index === periodKpis?.bestI;
            if (!show) return "";
            return `${Number(value).toFixed(1).replace(".", ",")}%`;
          }
          if (opts.seriesIndex === absentSeriesIndex && showPeopleCount) {
            if (hoverIndex !== index) return "";
            return `${Math.round(Number(value))}`;
          }
          return "";
        },
        style: { fontSize: "9px", fontWeight: 700, colors: ["#4f46e5", peopleLineColor] },
        background: { enabled: true, foreColor: "#fff", borderRadius: 3, padding: 3, opacity: 0.85 },
      },
      markers: {
        size: indexMarkerSizes,
        strokeWidth: 1.5,
        strokeColors: isDark ? "#0f172a" : "#ffffff",
        hover: { size: 5 },
      },
      xaxis: {
        type: "category",
        categories: axisKeys,
        labels: {
          formatter: (value) => axisLabelByKey.get(value) || "",
          rotate: -30,
          rotateAlways: false,
          hideOverlappingLabels: true,
          style: {
            colors: dateMeta.map((dm) =>
              dm?.feriado ? "#ef4444" : dm?.isWeekend ? (isDark ? "#475569" : "#cbd5e1") : muted,
            ),
            fontSize: "8.5px",
            fontWeight: 600,
          },
        },
        axisBorder: { show: false },
        axisTicks: { show: false },
        crosshairs: { show: true, stroke: { color: muted, width: 1, dashArray: 3 } },
        tooltip: { enabled: false },
      },
      yaxis:
        chartMode === "compare"
          ? [
              ...(activeHourMetrics.length
                ? [{
                seriesName: activeHourMetrics.map((metric) => metric.label),
                min: 0,
                title: { text: "Horas", style: { color: muted, fontSize: "10px" } },
                labels: {
                  formatter: (v) => fmtMin(v),
                  style: { colors: muted, fontSize: "9px" },
                },
              }] : []),
              ...(showPeopleCount && absentSeriesIndex >= 0
                ? [{
                  seriesName: "Colab. ausentes",
                  min: 0,
                  max: peopleYMax,
                  tickAmount: 4,
                  opposite: true,
                  title: { text: "Ausentes (qtd.)", style: { color: peopleLineColor, fontSize: "10px" } },
                  labels: {
                    formatter: (v) => `${Math.round(v)}`,
                    style: { colors: peopleLineColor, fontSize: "9px" },
                  },
                }] : []),
              {
                seriesName: "Índice absenteísmo",
                min: 0,
                max: yMax,
                opposite: true,
                offsetX: showPeopleCount && absentSeriesIndex >= 0 ? 54 : 0,
                title: { text: "%", style: { color: "#4f46e5", fontSize: "10px" } },
                labels: {
                  formatter: (v) => `${Math.round(v)}%`,
                  style: { colors: "#4f46e5", fontSize: "9px" },
                },
              },
            ]
          : [
              {
                seriesName: series
                  .filter((s) => s.name !== "Colab. ausentes")
                  .map((s) => s.name),
                min: 0,
                max: yMax,
                tickAmount: 4,
                labels: {
                  formatter: (v) => `${Math.round(v)}%`,
                  style: { colors: muted, fontSize: "9px" },
                },
              },
              ...(showPeopleCount && absentSeriesIndex >= 0
                ? [{
                  seriesName: "Colab. ausentes",
                  min: 0,
                  max: peopleYMax,
                  tickAmount: 4,
                  opposite: true,
                  title: { text: "Ausentes (qtd.)", style: { color: peopleLineColor, fontSize: "10px" } },
                  labels: {
                    formatter: (v) => `${Math.round(v)}`,
                    style: { colors: peopleLineColor, fontSize: "9px" },
                  },
                }]
                : []),
            ],
      // Apex keeps emitting hover events; its visual tooltip is hidden in CSS in favor of the controlled card below.
      tooltip: {
        enabled: true,
        shared: false,
        intersect: true,
        followCursor: false,
      },
      annotations: {
        xaxis: xAnnotations,
        yaxis:
          chartMode === "compare"
            ? [
                {
                  y: meta,
                  yAxisIndex: compareIndexAxisIndex,
                  borderColor: "#22c55e",
                  borderWidth: 1.5,
                  strokeDashArray: 5,
                  label: {
                    text: `Meta ≤ ${meta}%`,
                    style: {
                      color: "#fff",
                      background: "#16a34a",
                      fontSize: "9px",
                      fontWeight: 700,
                      padding: { top: 2, bottom: 2, left: 5, right: 5 },
                    },
                    position: "right",
                    offsetX: -8,
                  },
                },
              ]
            : [],
      },
      legend: { show: chartMode === "compare" },
      grid: {
        borderColor: grid,
        strokeDashArray: 3,
        padding: { left: 2, right: 8, top: -4, bottom: 0 },
      },
    }),
    [
      isDark,
      labels,
      axisKeys,
      axisLabelByKey,
      dateMeta,
      yMax,
      muted,
      grid,
      xAnnotations,
      meta,
      computed,
      onSelectDay,
      chartMode,
      selectedMetrics,
      hasHourData,
      activeCompareMetrics,
      activeHourMetrics,
      hasPeopleSeries,
      compareIndexAxisIndex,
      absentSeriesIndex,
      indexSeriesIndex,
      peakRate,
      n,
      series,
      showPeopleCount,
      peopleYMax,
      peopleLineColor,
      indexPalette,
      indexStrokeWidths,
      indexStrokeDash,
      indexFillOpacity,
      indexMarkerSizes,
      labelSeriesIndexes,
      hoverIndex,
      periodKpis,
      showFixedIndexLabels,
      WINDOW,
      usePeriodMean,
      viewPreset,
      indexPresetFlags,
      indexVisual,
    ],
  );

  const chartRenderKeyWithPeople = `${chartRenderKey}:p${showPeopleCount ? 1 : 0}:v${viewPreset}`;
  const periodAbsentMin = useMemo(
    () => computed.reduce((sum, c) => sum + c.unjustMin + c.justifiedMin, 0),
    [computed],
  );

  const chartHeight = embedded ? 400 : compact ? 220 : chartHostHeight;

  const legendItems = useMemo(() => {
    const labelFor = (name) => {
      if (name === "Meta") return `Meta ≤ ${meta}%`;
      if (name === "Inj. %") return "Abs. injust.";
      if (name === "Just. %") return "Abs. justif.";
      return name;
    };
    return series.map((s, i) => ({
      seriesName: s.name,
      label: labelFor(s.name),
      color: indexPalette[i] ?? meanMuted,
      dashed: s.name === "Meta" || String(s.name).startsWith("Média"),
    }));
  }, [series, indexPalette, meta, meanMuted]);

  return (
    <div
      style={{
        flex: 1,
        minHeight: compact ? undefined : 300,
        display: "flex",
        flexDirection: "column",
        minWidth: 0,
        ...(compact && !embedded ? { height: 240 } : {}),
        ...(embedded ? { height: "100%", minHeight: 400 } : {}),
      }}
    >
      {embedded && (
        <div className="pb-abs-compare-toolbar">
          <div className="pb-abs-toolbar-head">
            <div className="pb-abs-mode-toggle" role="tablist" aria-label="Modo do gráfico">
              <button
                type="button"
                className={chartMode === "index" ? "is-active" : ""}
                onClick={() => setChartMode("index")}
              >
                Índice
              </button>
              <button
                type="button"
                className={chartMode === "compare" ? "is-active" : ""}
                onClick={() => {
                  if (chartMode === "compare") return;
                  setChartMode("compare");
                  setSelectedMetrics(
                    new Set(hasHourData ? DEFAULT_COMPARE_METRICS : ["absentPeople"]),
                  );
                }}
              >
                Comparar variáveis
              </button>
            </div>
            <button type="button" className="pb-abs-reset" onClick={resetChart}>
              Limpar
            </button>
            <label className="pb-abs-meta-control">
              <span>Meta</span>
              <input
                type="range"
                min={1}
                max={30}
                step={0.5}
                value={meta}
                onChange={(event) => handleMetaChange(event.target.value)}
              />
              <strong>{meta.toFixed(1).replace(".", ",")}%</strong>
            </label>
            <details className="pb-abs-method">
              <summary>Como é calculado?</summary>
              <div>
                <p><strong>Índice:</strong> horas planejadas não trabalhadas ÷ horas planejadas × 100.</p>
                <p><strong>Trabalhadas:</strong> considera apenas eventos configurados na categoria Presentes.</p>
                <p><strong>Diferença:</strong> planejadas - trabalhadas; trabalhadas nunca deve passar de planejadas.</p>
                <p><strong>Horas extras:</strong> ficam separadas; não compõem trabalhadas nem o índice de absenteísmo.</p>
                <p><strong>Sem horas importadas:</strong> o índice utiliza colaboradores ausentes injustificados ÷ total de colaboradores.</p>
              </div>
            </details>
          </div>
          <div
            className={`pb-abs-metric-chips${chartMode === "index" ? " is-index" : ""}`}
            aria-label="Variáveis para comparar"
          >
            {COMPARE_METRICS.map((metric) => {
              const fixed = metric.key === "absentPeople";
              const active =
                fixed ||
                (chartMode === "compare" && selectedMetrics.has(metric.key) && hasHourData);
              return (
                <button
                  key={metric.key}
                  type="button"
                  aria-pressed={active}
                  className={`${active ? "is-active" : ""}${fixed ? " is-fixed" : ""}`}
                  style={{ "--metric-color": metric.color }}
                  onClick={() => toggleMetric(metric.key)}
                  disabled={fixed || !hasHourData}
                  title={
                    metric.key !== "absentPeople" && !hasHourData
                      ? `${metric.label}: horas indisponíveis neste período`
                      : fixed
                        ? `${METRIC_HELP[metric.key]} Sempre exibido no gráfico.`
                        : `${METRIC_HELP[metric.key]} Clique para exibir no gráfico.`
                  }
                >
                  <span>{metric.short}</span>
                  <strong>
                    {metric.key === "absentPeople"
                      ? comparisonTotals[metric.key].toLocaleString("pt-BR")
                      : hasHourData
                        ? fmtHoursReadable(comparisonTotals[metric.key])
                        : "Sem dados"}
                  </strong>
                  <i aria-hidden="true">{fixed ? "Sempre visível" : active ? "Selecionada" : "Selecionar"}</i>
                </button>
              );
            })}
            {hasHourData && (
              <span
                className={`pb-abs-balance-chip ${comparisonTotals.balanceMin > 0 ? "is-negative" : "is-positive"}`}
                title="Diferença = horas planejadas - horas trabalhadas."
              >
                <span>Diferença</span>
                <strong>{fmtHoursReadable(comparisonTotals.balanceMin)}</strong>
                <small>{comparisonTotals.balanceMin > 0 ? "Abaixo do planejado" : "Sem diferença"}</small>
              </span>
            )}
            <span
              className="pb-abs-index-chip"
              title={
                hasWeightedIndex
                  ? "Índice = horas planejadas não trabalhadas dividido pelas horas planejadas."
                  : "Índice por colaboradores = ausentes injustificados dividido pelo total de colaboradores."
              }
            >
              <span>{hasWeightedIndex ? "Índice" : "Índice por colaboradores"}</span>
              <strong>{periodRate.toFixed(1).replace(".", ",")}%</strong>
              <small>{hasWeightedIndex ? "Ponderado por horas" : "Base: colaboradores"}</small>
            </span>
          </div>
          <small className="pb-abs-hover-hint">Passe o mouse sobre uma barra ou ponto para ver o cálculo do dia.</small>
        </div>
      )}

      {!compact ? (
        <div ref={exportCaptureRef} className="pb-chart-export-capture">
          {!embedded && periodKpis && (
            <div
              className="pb-abs-kpis pb-chart-export-kpis"
              role="group"
              aria-label="Resumo do período"
            >
              <div className={`pb-abs-kpi ${periodRate <= meta ? "is-ok" : "is-bad"}`}>
                <span>Índice período</span>
                <strong>{periodRate.toFixed(1).replace(".", ",")}%</strong>
                <em>
                  {periodRate <= meta
                    ? "Dentro da meta"
                    : `+${periodKpis.deltaMeta.toFixed(1).replace(".", ",")} pp acima`}
                </em>
              </div>
              <div className="pb-abs-kpi">
                <span>Médias diárias</span>
                <strong>
                  {periodKpis.avgInj.toFixed(1).replace(".", ",")}% inj. ·{" "}
                  {periodKpis.avgJust.toFixed(1).replace(".", ",")}% just.
                </strong>
              </div>
              <div className="pb-abs-kpi">
                <span>Melhor / pior dia</span>
                <strong>
                  {computed[periodKpis.bestI].indexRate.toFixed(1).replace(".", ",")}% ·{" "}
                  {computed[periodKpis.worstI].indexRate.toFixed(1).replace(".", ",")}%
                </strong>
                <em>
                  {dateMeta[periodKpis.worstI]
                    ? `${dateMeta[periodKpis.worstI].dowLabel} ${dateMeta[periodKpis.worstI].label} (pior)`
                    : ""}
                </em>
              </div>
              {periodKpis.daysAboveMeta > 0 && (
                <div className="pb-abs-kpi is-warn">
                  <span>Acima da meta</span>
                  <strong>
                    {periodKpis.daysAboveMeta} dia{periodKpis.daysAboveMeta === 1 ? "" : "s"}
                  </strong>
                </div>
              )}
              {viewPreset === "card" && hasHourData && (
                <div className="pb-abs-kpi pb-abs-kpi--hours">
                  <span>Horas no período</span>
                  <strong>
                    Plan. {fmtHoursReadable(comparisonTotals.plannedMin)} · Trab.{" "}
                    {fmtHoursReadable(comparisonTotals.workedMin)} · Aus.{" "}
                    {fmtHoursReadable(periodAbsentMin)}
                  </strong>
                  <em>Alinhado ao card Início</em>
                </div>
              )}
            </div>
          )}
          {!embedded && (
            <div className="pb-chart-export-ui-only" data-html2canvas-ignore="true">
              <div className="pb-abs-presets" role="tablist" aria-label="Preset de visualização">
                {ABS_VIEW_PRESETS.map((preset) => (
                  <button
                    key={preset.id}
                    type="button"
                    role="tab"
                    className={`pb-abs-preset-btn${preset.id === "horas" ? "" : viewPreset === preset.id ? " is-active" : ""}`}
                    aria-selected={preset.id !== "horas" && viewPreset === preset.id}
                    title={preset.title}
                    onClick={() => applyViewPreset(preset.id)}
                  >
                    {preset.label}
                  </button>
                ))}
              </div>
              <div className="pb-abs-chart-toolbar">
                <span className="pb-abs-chart-toolbar-label">Meta abs. ≤</span>
                <input
                  type="range"
                  min={1}
                  max={30}
                  step={0.5}
                  value={meta}
                  onChange={(e) => handleMetaChange(e.target.value)}
                  className="pb-abs-meta-slider"
                  aria-label="Meta de absenteísmo"
                />
                <span className="pb-abs-meta-val">{meta}%</span>
                <label className="pb-abs-toggle-people">
                  <input
                    type="checkbox"
                    checked={showPeopleCount}
                    onChange={(e) => handlePeopleToggle(e.target.checked)}
                    disabled={viewPreset === "executivo"}
                  />
                  Qtd. ausentes
                </label>
              </div>
            </div>
          )}
          {!compact && legendItems.length > 0 && (
            <ChartLegendBar
              chartId={PB_CHART_IDS.abs}
              captureRef={exportCaptureRef}
              exportTheme={isDark ? "dark" : "light"}
              items={legendItems}
              exportFilename={`absenteismo-${n}d`}
              resetKey={chartRenderKeyWithPeople}
              hint={
                !embedded && onSelectDay
                  ? "Clique num dia para ver detalhes · legenda: ativar/desativar série"
                  : "Legenda: clique para ativar/desativar série"
              }
            />
          )}
          <div
            ref={chartAreaRef}
            className="pb-abs-chart-surface"
            onMouseLeave={() => setHoverIndex(null)}
            style={{
              flex: "1 1 auto",
              minHeight: embedded ? 400 : Math.max(chartHeight, 220),
              minWidth: 0,
              width: "100%",
              height: embedded ? 400 : chartHeight,
            }}
          >
            <div ref={wrapRef} style={{ width: "100%", minHeight: chartHeight }}>
              <ReactApexChart
                key={chartRenderKeyWithPeople}
                options={options}
                series={series}
                type="bar"
                height={chartHeight}
                width="100%"
              />
            </div>
            {hoverDay && (
              <div className="pb-abs-hover-tooltip" role="tooltip">
                <strong>
                  {hoverMeta ? `${hoverMeta.dowLabel} ${hoverMeta.label}` : hoverDay.date}
                  {hoverMeta?.isWeekend ? " · Fim de semana" : ""}
                </strong>
                {hoverDay.usesHours ? (
                  <>
                    <span><em>Planejadas</em><b>{fmtHoursReadable(hoverDay.plannedMin)}</b></span>
                    <span><em>Trabalhadas</em><b>{fmtHoursReadable(hoverDay.workedMin)}</b></span>
                    <span><em>Diferença</em><b>{fmtHoursReadable(Math.max(hoverDay.plannedMin - hoverDay.workedMin, 0))}</b></span>
                    <span><em>Injustificadas</em><b>{fmtHoursReadable(hoverDay.unjustMin)}</b></span>
                    <span><em>Justificadas</em><b>{fmtHoursReadable(hoverDay.justifiedMin)}</b></span>
                    <span><em>Extras</em><b>{fmtHoursReadable(hoverDay.extraMin)}</b></span>
                    <span><em>Colab. ausentes</em><b>{hoverDay.ausCount + hoverDay.justCount}</b></span>
                  </>
                ) : (
                  <>
                    <span><em>Colaboradores</em><b>{hoverDay.total}</b></span>
                    <span><em>Ausentes injust.</em><b>{hoverDay.ausCount}</b></span>
                    <span><em>Ausentes just.</em><b>{hoverDay.justCount}</b></span>
                  </>
                )}
                <span className="is-total">
                  <em>Índice</em><b>{hoverDay.indexRate.toFixed(1).replace(".", ",")}%</b>
                </span>
                <small>
                  {hoverDay.usesHours
                    ? "(planejadas - trabalhadas) ÷ planejadas"
                    : "ausentes injustificados ÷ colaboradores"}
                </small>
              </div>
            )}
          </div>
        </div>
      ) : (
        <div
          ref={chartAreaRef}
          className="pb-abs-chart-surface"
          onMouseLeave={() => setHoverIndex(null)}
          style={{
            flex: "1 1 auto",
            minHeight: 220,
            minWidth: 0,
            width: "100%",
            height: chartHeight,
          }}
        >
          <div ref={wrapRef} style={{ width: "100%", minHeight: chartHeight }}>
            <ReactApexChart
              key={chartRenderKeyWithPeople}
              options={options}
              series={series}
              type="bar"
              height={chartHeight}
              width="100%"
            />
          </div>
        </div>
      )}
    </div>
  );
}

export default AbsenteismoChart;
