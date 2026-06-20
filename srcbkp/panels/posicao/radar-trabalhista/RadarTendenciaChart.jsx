import React, { useEffect, useMemo, useRef } from "react";
import ReactApexChart from "react-apexcharts";

function chartDateLabel(iso) {
  const m = String(iso || "").match(/^(\d{4})-(\d{2})-(\d{2})/);
  return m ? `${+m[3]}/${+m[2]}` : "";
}

export function RadarTendenciaChart({ timeline = [], miniStats, isDark = true, height = 220 }) {
  const wrapRef = useRef(null);

  useEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    const rm = () => el.querySelectorAll(".apexcharts-svg > title").forEach((t) => t.remove());
    rm();
    const mo = new MutationObserver(rm);
    mo.observe(el, { childList: true, subtree: true });
    return () => mo.disconnect();
  }, []);

  const values = useMemo(() => timeline.map((d) => d.value ?? 0), [timeline]);
  const labels = useMemo(() => timeline.map((d) => chartDateLabel(d.date)), [timeline]);
  const n = values.length;

  const yBounds = useMemo(() => {
    if (!values.length) return { min: 0, max: 10 };
    const minV = Math.min(...values);
    const maxV = Math.max(...values);
    const pad = Math.max(2, Math.ceil((maxV - minV) * 0.08) || 2);
    const min = Math.max(0, Math.floor(minV - pad));
    const max = Math.ceil(maxV + pad);
    return { min, max };
  }, [values]);

  const peakDayNum = useMemo(() => {
    if (!miniStats?.peakDate || !timeline.length) return null;
    const idx = timeline.findIndex((d) => d.date === miniStats.peakDate);
    return idx >= 0 ? idx + 1 : null;
  }, [miniStats?.peakDate, timeline]);

  const accent = isDark ? "#818cf8" : "#6366f1";
  const muted = isDark ? "#64748b" : "#94a3b8";
  const grid = isDark ? "rgba(148,163,184,.12)" : "rgba(100,116,139,.14)";
  const tipBg = isDark ? "#1e293b" : "#fff";
  const tipBorder = isDark ? "rgba(255,255,255,.08)" : "rgba(0,0,0,.08)";

  const options = useMemo(
    () => ({
      chart: {
        type: "area",
        background: "transparent",
        toolbar: { show: false },
        zoom: { enabled: false },
        animations: { enabled: true, speed: 400 },
        fontFamily: "inherit",
        sparkline: { enabled: false },
      },
      theme: { mode: isDark ? "dark" : "light" },
      colors: [accent],
      stroke: { curve: "smooth", width: 2.5 },
      fill: {
        type: "gradient",
        gradient: {
          shade: isDark ? "dark" : "light",
          type: "vertical",
          shadeIntensity: 0.35,
          opacityFrom: isDark ? 0.45 : 0.35,
          opacityTo: 0.02,
          stops: [0, 92],
        },
      },
      dataLabels: { enabled: false },
      markers: {
        size: n <= 14 ? 4 : 0,
        strokeWidth: 2,
        strokeColors: isDark ? "#0f172a" : "#fff",
        hover: { size: 6 },
      },
      xaxis: {
        categories: labels,
        tickPlacement: "on",
        labels: {
          rotate: n > 12 ? -35 : 0,
          hideOverlappingLabels: true,
          style: { colors: muted, fontSize: "10px", fontWeight: 600 },
        },
        axisBorder: { show: false },
        axisTicks: { show: false },
        crosshairs: { show: true, stroke: { color: muted, width: 1, dashArray: 3 } },
      },
      yaxis: {
        min: yBounds.min,
        max: yBounds.max,
        tickAmount: 5,
        labels: {
          formatter: (v) => Math.round(v),
          style: { colors: muted, fontSize: "10px" },
        },
      },
      grid: {
        borderColor: grid,
        strokeDashArray: 4,
        xaxis: { lines: { show: true } },
        yaxis: { lines: { show: true } },
        padding: { top: 4, left: 8, right: 12, bottom: 0 },
      },
      tooltip: {
        theme: isDark ? "dark" : "light",
        custom({ series, seriesIndex, dataPointIndex }) {
          const val = series[seriesIndex]?.[dataPointIndex] ?? 0;
          const lbl = labels[dataPointIndex] || "";
          return `<div class="rt-tend-tip" style="background:${tipBg};border:1px solid ${tipBorder}"><div class="rt-tend-tip-title">${lbl}</div><div class="rt-tend-tip-row"><span style="background:${accent}"></span>Penalidades: <b>${val}</b></div></div>`;
        },
      },
      legend: { show: false },
    }),
    [isDark, labels, n, accent, muted, grid, yBounds, tipBg, tipBorder],
  );

  const series = useMemo(() => [{ name: "Penalidades", data: values }], [values]);

  const trendUp = (miniStats?.trendPct ?? 0) > 0.5;
  const trendDown = (miniStats?.trendPct ?? 0) < -0.5;

  if (!timeline.length) {
    return (
      <div className="rt-tendencia" data-dark={isDark}>
        <div className="rt-tendencia-head">
          <h3 className="rt-tendencia-title">Tendência de penalidades</h3>
        </div>
        <div className="rt-empty">Sem penalidades de risco no período.</div>
      </div>
    );
  }

  return (
    <div className="rt-tendencia" data-dark={isDark}>
      <div className="rt-tendencia-head">
        <h3 className="rt-tendencia-title">Tendência de penalidades</h3>
      </div>

      {miniStats ? (
        <div className="rt-tend-stats">
          <div className="rt-tend-stat">
            <span className="rt-tend-stat-lbl">Pico diário</span>
            <strong>{miniStats.peakVal}</strong>
            <small>{peakDayNum ? `dia ${peakDayNum}` : fmtPeakDate(miniStats.peakDate)} · penalidades</small>
          </div>
          <div className="rt-tend-stat">
            <span className="rt-tend-stat-lbl">Penalidades/dia</span>
            <strong>{miniStats.avgPerDay.toFixed(1).replace(".", ",")}</strong>
            <small>média no período</small>
          </div>
          <div className={`rt-tend-stat${trendUp ? " rt-tend-stat--up" : trendDown ? " rt-tend-stat--down" : ""}`}>
            <span className="rt-tend-stat-lbl">Variação</span>
            <strong>
              {trendUp ? "↑ " : trendDown ? "↓ " : ""}
              {Math.abs(miniStats.trendPct).toFixed(1).replace(".", ",")}%
            </strong>
            <small>no período</small>
          </div>
        </div>
      ) : null}

      <div className="rt-tend-chart" ref={wrapRef}>
        <ReactApexChart options={options} series={series} type="area" height={height} width="100%" />
      </div>
    </div>
  );
}

function fmtPeakDate(iso) {
  const m = String(iso || "").match(/^(\d{4})-(\d{2})-(\d{2})/);
  return m ? `${m[3]}/${m[2]}` : "—";
}
