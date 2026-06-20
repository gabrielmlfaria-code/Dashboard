import React, { useId, useMemo } from "react";
import { dailyTrendSeries } from "./radarHoursUtils.js";

function fmtPct(v) {
  return Number(v).toFixed(1).replace(".", ",");
}

function fmtSparkHM(mins) {
  const n = Math.max(0, Math.round(Number(mins) || 0));
  const h = Math.floor(n / 60);
  const m = n % 60;
  if (h > 0 && m > 0) return `${h}h ${m}m`;
  if (h > 0) return `${h}h`;
  return `${m}m`;
}

function fmtScore(v) {
  return String(Math.round(Number(v) || 0));
}

const DEFAULT_FORMATTERS = {
  abs: (v) => `${fmtPct(v)}%`,
  plan: fmtSparkHM,
  work: fmtSparkHM,
  lost: fmtSparkHM,
  risk: (v) => fmtScore(v),
  injust: fmtSparkHM,
  just: fmtSparkHM,
  extr: fmtSparkHM,
  consec: (v) => `${Math.round(Number(v) || 0)} colab.`,
};

function buildPaths(values, width, height, { yMin, yMax } = {}) {
  const padX = 2;
  const padY = 4;
  const innerW = width - padX * 2;
  const innerH = height - padY * 2;
  const min = yMin != null ? yMin : Math.min(...values);
  const max = yMax != null ? yMax : Math.max(...values);
  const range = max - min || 1;
  const baseline = height - padY;

  const pts = values.map((v, i) => {
    const x =
      padX + (values.length === 1 ? innerW / 2 : (i / (values.length - 1)) * innerW);
    const y = padY + innerH - ((v - min) / range) * innerH;
    return { x, y, v };
  });

  let linePath = "";
  if (pts.length === 1) {
    linePath = `M ${pts[0].x.toFixed(2)} ${pts[0].y.toFixed(2)}`;
  } else if (pts.length === 2) {
    linePath = `M ${pts[0].x.toFixed(2)} ${pts[0].y.toFixed(2)} L ${pts[1].x.toFixed(2)} ${pts[1].y.toFixed(2)}`;
  } else {
    linePath = `M ${pts[0].x.toFixed(2)} ${pts[0].y.toFixed(2)}`;
    for (let i = 0; i < pts.length - 1; i += 1) {
      const p0 = pts[i];
      const p1 = pts[i + 1];
      const cx = (p0.x + p1.x) / 2;
      linePath += ` C ${cx.toFixed(2)} ${p0.y.toFixed(2)}, ${cx.toFixed(2)} ${p1.y.toFixed(2)}, ${p1.x.toFixed(2)} ${p1.y.toFixed(2)}`;
    }
  }

  const areaPath = `${linePath} L ${pts[pts.length - 1].x.toFixed(2)} ${baseline} L ${pts[0].x.toFixed(2)} ${baseline} Z`;

  return { pts, linePath, areaPath };
}

function trendLabel(delta, metric) {
  const th = metric === "abs" || metric === "risk" ? 0.5 : 1;
  if (Math.abs(delta) < th) return "estável";
  return delta > 0 ? "alta" : "queda";
}

export function RadarTrendSparkline({
  rows,
  metric = "abs",
  variant = "default",
  formatValue,
  labelMode = "edge",
  className = "",
}) {
  const gradId = useId();
  const series = useMemo(() => dailyTrendSeries(rows, metric), [rows, metric]);
  const fmt = formatValue || DEFAULT_FORMATTERS[metric] || String;

  if (series.length < 2) return null;

  const values = series.map((d) => d.value);
  const hourMetrics = ["plan", "work", "lost", "injust", "just", "extr"];
  if (hourMetrics.includes(metric) && Math.max(...values) <= 0) return null;
  if (metric === "consec" && Math.max(...values) <= 0) return null;
  const compact = variant === "compact";
  const width = 200;
  const height = compact ? 32 : 44;
  const yBounds =
    metric === "abs" ? { yMin: 0, yMax: Math.max(...values, 1) } : {};
  const { pts, linePath, areaPath } = buildPaths(values, width, height, yBounds);
  const first = series[0];
  const last = series[series.length - 1];
  const delta = last.value - first.value;
  const trend = trendLabel(delta, metric);

  return (
    <div
      className={`pb-radar-spark pb-radar-spark--${metric}${compact ? " pb-radar-spark--compact" : ""} ${className}`.trim()}
      title={`${series.length} dias: ${fmt(first.value)} → ${fmt(last.value)} (${trend})`}
    >
      <svg
        className="pb-radar-spark-svg"
        viewBox={`0 0 ${width} ${height}`}
        preserveAspectRatio="none"
        role="img"
        aria-label={`Tendência diária: ${fmt(first.value)} no início a ${fmt(last.value)} no fim`}
      >
        <defs>
          <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="currentColor" stopOpacity="0.35" />
            <stop offset="100%" stopColor="currentColor" stopOpacity="0.02" />
          </linearGradient>
        </defs>
        <path className="pb-radar-spark-area" d={areaPath} fill={`url(#${gradId})`} />
        <path className="pb-radar-spark-line" d={linePath} fill="none" />
        {!compact && (
          <>
            <circle className="pb-radar-spark-dot" cx={pts[0].x} cy={pts[0].y} r="2.5" />
            <circle
              className="pb-radar-spark-dot pb-radar-spark-dot--end"
              cx={pts[pts.length - 1].x}
              cy={pts[pts.length - 1].y}
              r="2.5"
            />
          </>
        )}
      </svg>
      <div className="pb-radar-spark-labels">
        <span className="pb-radar-spark-edge">
          {labelMode === "daily-edge" ? "Início " : ""}
          {fmt(first.value)}
        </span>
        <span className="pb-radar-spark-edge pb-radar-spark-edge--end">
          {labelMode === "daily-edge" ? "Fim " : ""}
          {fmt(last.value)}
        </span>
      </div>
    </div>
  );
}

/** @deprecated use RadarTrendSparkline com metric="abs" */
export function AbsTrendSparkline(props) {
  return <RadarTrendSparkline {...props} metric="abs" />;
}
