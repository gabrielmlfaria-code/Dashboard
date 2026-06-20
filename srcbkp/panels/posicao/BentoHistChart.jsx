import React, { useEffect, useRef, useMemo, useState } from "react";
import ReactApexChart from "react-apexcharts";
import { useChartHostHeight } from "./useChartHostHeight.js";
import { ChartLegendBar, PB_CHART_IDS } from "./ChartLegendBar.jsx";

const DOW_PT = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];

const PRES_VIEW_PRESETS = [
  { id: "executivo", label: "Executivo", title: "Só presença (%)" },
  { id: "rh", label: "RH", title: "Presença + ausentes injust." },
  { id: "completo", label: "Completo", title: "Presença, ausentes e justificadas" },
  { id: "abs", label: "Abs%", title: "Abrir gráfico de absenteísmo" },
];

function BentoHistChart({ histRows, isDark, onSelectDay, onRequestAbsView }) {
  const exportCaptureRef = useRef(null);
  const wrapRef = useRef(null);
  const chartHostHeight = useChartHostHeight(wrapRef, {
    minHeight: 120,
    fallbackHeight: 300,
  });
  const [viewPreset, setViewPreset] = useState("completo");
  const [hoverIndex, setHoverIndex] = useState(null);

  useEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    const remove = () => el.querySelectorAll(".apexcharts-svg > title").forEach((t) => t.remove());
    remove();
    const mo = new MutationObserver(remove);
    mo.observe(el, { childList: true, subtree: true });
    return () => mo.disconnect();
  }, []);

  const n = histRows.length;
  const showFixedPresLabels = n <= 7;

  const labels = useMemo(() => {
    const showAll = n <= 15;
    return histRows.map((r, i) => {
      if (!showAll) {
        const step = Math.max(1, Math.ceil(n / 12));
        if (i !== 0 && i !== n - 1 && i % step !== 0) return "";
      }
      const d = String(r.date || "");
      const m = d.match(/^(\d{4})-(\d{2})-(\d{2})/);
      if (!m) return d;
      const dow = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3])).getDay();
      return `${DOW_PT[dow]} ${m[3]}/${m[2]}`;
    });
  }, [histRows, n]);

  const rowsMeta = useMemo(
    () =>
      histRows.map((r) => ({
        presPct: Number(r.presentesPct) || 0,
        ausCount: (r.faltas || 0) + (r.atrasos || 0),
        justCount: r.justificadas || 0,
        date: r.date,
      })),
    [histRows],
  );

  const periodKpis = useMemo(() => {
    if (!rowsMeta.length) return null;
    const presAvg = rowsMeta.reduce((s, r) => s + r.presPct, 0) / rowsMeta.length;
    const ausTotal = rowsMeta.reduce((s, r) => s + r.ausCount, 0);
    const justTotal = rowsMeta.reduce((s, r) => s + r.justCount, 0);
    let bestI = 0;
    let worstI = 0;
    rowsMeta.forEach((r, i) => {
      if (r.presPct > rowsMeta[bestI].presPct) bestI = i;
      if (r.presPct < rowsMeta[worstI].presPct) worstI = i;
    });
    return { presAvg, ausTotal, justTotal, bestI, worstI };
  }, [rowsMeta]);

  const presetFlags = useMemo(() => {
    switch (viewPreset) {
      case "executivo":
        return { showPres: true, showAus: false, showJust: false };
      case "rh":
        return { showPres: true, showAus: true, showJust: false };
      case "completo":
      default:
        return { showPres: true, showAus: true, showJust: true };
    }
  }, [viewPreset]);

  const applyViewPreset = (id) => {
    if (id === "abs") {
      onRequestAbsView?.();
      return;
    }
    setViewPreset(id);
  };

  const series = useMemo(() => {
    const out = [];
    if (presetFlags.showPres) {
      out.push({ name: "Presentes (%)", type: "bar", data: rowsMeta.map((r) => r.presPct) });
    }
    if (presetFlags.showAus) {
      out.push({
        name: "Ausentes injust.",
        type: "line",
        data: rowsMeta.map((r) => r.ausCount),
      });
    }
    if (presetFlags.showJust) {
      out.push({
        name: "Aus. justificadas",
        type: "line",
        data: rowsMeta.map((r) => r.justCount),
      });
    }
    return out;
  }, [rowsMeta, presetFlags]);

  const presSeriesIndex = series.findIndex((s) => s.name === "Presentes (%)");
  const ausSeriesIndex = series.findIndex((s) => s.name === "Ausentes injust.");
  const justSeriesIndex = series.findIndex((s) => s.name === "Aus. justificadas");

  const presMin = useMemo(() => {
    const vals = rowsMeta.map((r) => r.presPct);
    if (!vals.length) return 0;
    return Math.max(0, Math.floor(Math.min(...vals) - 3));
  }, [rowsMeta]);

  const countYMax = useMemo(() => {
    const peak = Math.max(
      0,
      ...rowsMeta.map((r) => Math.max(r.ausCount, r.justCount)),
    );
    return Math.max(5, Math.ceil(peak * 1.12));
  }, [rowsMeta]);

  const muted = isDark ? "#64748b" : "#94a3b8";
  const grid = isDark ? "rgba(148,163,184,.08)" : "rgba(100,116,139,.11)";
  const ausLineColor = "#dc2626";
  const justLineColor = "#9333ea";

  const colors = useMemo(
    () =>
      series.map((s) => {
        if (s.name === "Presentes (%)") return "#22c55e";
        if (s.name === "Ausentes injust.") return ausLineColor;
        return justLineColor;
      }),
    [series, ausLineColor, justLineColor],
  );

  const strokeWidths = useMemo(
    () => series.map((s) => (s.type === "bar" ? 0 : 2.2)),
    [series],
  );

  const markerSizes = useMemo(
    () => series.map((s) => (s.type === "bar" ? 0 : 3)),
    [series],
  );

  const fillTypes = useMemo(
    () =>
      series.map((s) =>
        s.type === "bar" ? "gradient" : "solid",
      ),
    [series],
  );

  const options = useMemo(
    () => ({
      chart: {
        id: PB_CHART_IDS.pres,
        type: "line",
        background: "transparent",
        toolbar: { show: false },
        zoom: { enabled: false },
        redrawOnParentResize: true,
        animations: { enabled: true, speed: 280 },
        fontFamily: "inherit",
        events: {
          dataPointMouseEnter: (_e, _ctx, config) => {
            if (config?.dataPointIndex >= 0) setHoverIndex(config.dataPointIndex);
          },
          dataPointMouseLeave: () => setHoverIndex(null),
          dataPointSelection: (_e, _ctx, config) => {
            const date = histRows[config.dataPointIndex]?.date;
            if (date) onSelectDay?.(date);
          },
        },
      },
      theme: { mode: isDark ? "dark" : "light" },
      colors,
      stroke: { curve: "smooth", width: strokeWidths },
      fill: {
        type: fillTypes,
        gradient: {
          shade: isDark ? "dark" : "light",
          type: "vertical",
          opacityFrom: 0.68,
          opacityTo: 0.1,
          stops: [0, 100],
        },
      },
      plotOptions: {
        bar: { columnWidth: "58%", borderRadius: 2, borderRadiusApplication: "end" },
      },
      dataLabels: {
        enabled: true,
        enabledOnSeries: [presSeriesIndex].filter((i) => i >= 0),
        formatter: (value, opts) => {
          const i = opts.dataPointIndex;
          if (opts.seriesIndex !== presSeriesIndex) return "";
          const show =
            showFixedPresLabels ||
            hoverIndex === i ||
            i === n - 1 ||
            i === periodKpis?.bestI ||
            i === periodKpis?.worstI;
          if (!show) return "";
          return `${Number(value).toFixed(0)}%`;
        },
        style: { fontSize: "9px", fontWeight: 700, colors: ["#15803d"] },
        background: { enabled: true, foreColor: "#fff", borderRadius: 3, padding: 2, opacity: 0.85 },
      },
      markers: {
        size: markerSizes,
        strokeWidth: 1.5,
        strokeColors: isDark ? "#0f172a" : "#ffffff",
        hover: { size: 5 },
      },
      xaxis: {
        categories: labels,
        labels: {
          rotate: -30,
          rotateAlways: false,
          hideOverlappingLabels: true,
          style: { colors: muted, fontSize: "8.5px", fontWeight: 600 },
        },
        axisBorder: { show: false },
        axisTicks: { show: false },
        crosshairs: { show: true, stroke: { color: muted, width: 1, dashArray: 3 } },
        tooltip: { enabled: false },
      },
      yaxis: [
        ...(presSeriesIndex >= 0
          ? [{
            seriesName: "Presentes (%)",
            min: presMin,
            max: 100,
            labels: {
              formatter: (v) => `${Math.round(v)}%`,
              style: { colors: "#22c55e", fontSize: "9px" },
            },
            tickAmount: 4,
          }]
          : []),
        ...(ausSeriesIndex >= 0 || justSeriesIndex >= 0
          ? [{
            seriesName: series
              .filter((s) => s.type === "line")
              .map((s) => s.name),
            opposite: true,
            min: 0,
            max: countYMax,
            title: {
              text: "Qtd.",
              style: { color: muted, fontSize: "10px" },
            },
            labels: {
              formatter: (v) => Math.round(v),
              style: { colors: muted, fontSize: "9px" },
            },
            tickAmount: 4,
          }]
          : []),
      ],
      tooltip: {
        enabled: true,
        shared: true,
        intersect: false,
        theme: isDark ? "dark" : "light",
        style: { fontSize: "11px", fontFamily: "inherit" },
        y: {
          formatter: (val, { seriesIndex }) =>
            seriesIndex === presSeriesIndex ? `${val}%` : Math.round(val),
        },
      },
      legend: { show: false },
      grid: {
        borderColor: grid,
        strokeDashArray: 3,
        padding: { left: 2, right: 8, top: -8, bottom: 0 },
      },
    }),
    [
      isDark,
      labels,
      presMin,
      countYMax,
      muted,
      grid,
      colors,
      strokeWidths,
      markerSizes,
      fillTypes,
      series,
      presSeriesIndex,
      ausSeriesIndex,
      justSeriesIndex,
      hoverIndex,
      showFixedPresLabels,
      n,
      periodKpis,
      histRows,
      onSelectDay,
    ],
  );

  return (
    <div
      style={{
        flex: 1,
        minHeight: 300,
        display: "flex",
        flexDirection: "column",
        minWidth: 0,
      }}
    >
      <div ref={exportCaptureRef} className="pb-chart-export-capture">
        {periodKpis && (
          <div
            className="pb-abs-kpis pb-chart-export-kpis"
            role="group"
            aria-label="Resumo de presença"
          >
            <div className="pb-abs-kpi is-ok">
              <span>Presença média</span>
              <strong>{periodKpis.presAvg.toFixed(1).replace(".", ",")}%</strong>
            </div>
            <div className="pb-abs-kpi">
              <span>Melhor / pior dia</span>
              <strong>
                {rowsMeta[periodKpis.bestI].presPct.toFixed(0)}% ·{" "}
                {rowsMeta[periodKpis.worstI].presPct.toFixed(0)}%
              </strong>
            </div>
            {presetFlags.showAus && (
              <div className="pb-abs-kpi">
                <span>Ausentes injust. (período)</span>
                <strong>{periodKpis.ausTotal.toLocaleString("pt-BR")}</strong>
              </div>
            )}
            {presetFlags.showJust && (
              <div className="pb-abs-kpi">
                <span>Justificadas (período)</span>
                <strong>{periodKpis.justTotal.toLocaleString("pt-BR")}</strong>
              </div>
            )}
          </div>
        )}
        <div className="pb-chart-export-ui-only" data-html2canvas-ignore="true">
          <div className="pb-abs-presets" role="tablist" aria-label="Preset Pres%">
            {PRES_VIEW_PRESETS.map((preset) => (
              <button
                key={preset.id}
                type="button"
                role="tab"
                className={`pb-abs-preset-btn${preset.id === "abs" ? "" : viewPreset === preset.id ? " is-active" : ""}`}
                aria-selected={preset.id !== "abs" && viewPreset === preset.id}
                title={preset.title}
                onClick={() => applyViewPreset(preset.id)}
              >
                {preset.label}
              </button>
            ))}
          </div>
        </div>
        <ChartLegendBar
          chartId={PB_CHART_IDS.pres}
          captureRef={exportCaptureRef}
          exportTheme={isDark ? "dark" : "light"}
          items={series.map((s) => ({
            seriesName: s.name,
            label: s.name,
            color:
              s.name === "Presentes (%)"
                ? "#22c55e"
                : s.name === "Ausentes injust."
                  ? ausLineColor
                  : justLineColor,
          }))}
          exportFilename={`presenca-${n}d`}
          resetKey={`${viewPreset}:${n}`}
          hint={
            onSelectDay
              ? "Clique num dia para ver detalhes · legenda: ativar/desativar série"
              : "Legenda: clique para ativar/desativar série"
          }
        />
        <div
          ref={wrapRef}
          className="pb-pres-chart-surface"
          style={{
            flex: "1 1 auto",
            minHeight: Math.max(chartHostHeight, 220),
            minWidth: 0,
            width: "100%",
            height: chartHostHeight,
            display: "flex",
            flexDirection: "column",
          }}
        >
          <ReactApexChart
            key={`${viewPreset}:${n}`}
            options={options}
            series={series}
            type="line"
            height={chartHostHeight}
            width="100%"
          />
        </div>
      </div>
    </div>
  );
}

export default BentoHistChart;
