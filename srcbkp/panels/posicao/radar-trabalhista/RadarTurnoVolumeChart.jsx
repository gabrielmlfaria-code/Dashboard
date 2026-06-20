import React, { useEffect, useMemo, useRef } from "react";
import ReactApexChart from "react-apexcharts";

const TURNO_COLORS = {
  Manhã: "#6366f1",
  Tarde: "#ea580c",
  Noite: "#ef4444",
  Madrugada: "#a855f7",
};

export function RadarTurnoVolumeChart({ turnoTotals = [], isDark = true, chartHeight = 260 }) {
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

  const rows = useMemo(() => turnoTotals.filter((t) => t.turno), [turnoTotals]);
  const categories = useMemo(() => rows.map((r) => r.turno), [rows]);
  const values = useMemo(() => rows.map((r) => r.total), [rows]);
  const colors = useMemo(
    () => rows.map((r) => TURNO_COLORS[r.turno] || "#818cf8"),
    [rows],
  );

  const yMax = useMemo(() => {
    const peak = values.length ? Math.max(...values) : 0;
    if (peak <= 0) return 100;
    const step = peak <= 200 ? 50 : 100;
    return Math.max(step, Math.ceil(peak / step) * step);
  }, [values]);

  const muted = isDark ? "#94a3b8" : "#64748b";
  const grid = isDark ? "rgba(148,163,184,.1)" : "rgba(100,116,139,.12)";

  const options = useMemo(
    () => ({
      chart: {
        type: "bar",
        background: "transparent",
        toolbar: { show: false },
        animations: { enabled: true, speed: 360 },
        fontFamily: "inherit",
      },
      theme: { mode: isDark ? "dark" : "light" },
      colors,
      plotOptions: {
        bar: {
          distributed: true,
          borderRadius: 6,
          borderRadiusApplication: "end",
          columnWidth: "52%",
          dataLabels: { position: "top" },
        },
      },
      dataLabels: {
        enabled: true,
        offsetY: -22,
        formatter: (val) => {
          const n = Math.round(Number(val));
          return n > 0 ? n.toLocaleString("pt-BR") : "";
        },
        style: {
          fontSize: "11px",
          fontWeight: 800,
          colors: values.map(() => (isDark ? "#e2e8f0" : "#0f172a")),
        },
        background: {
          enabled: true,
          foreColor: isDark ? "#0f172a" : "#fff",
          borderRadius: 4,
          padding: 4,
          borderWidth: 0,
          opacity: isDark ? 0.92 : 0.95,
          dropShadow: { enabled: false },
        },
      },
      states: {
        hover: { filter: { type: "lighten", value: 0.08 } },
        active: { filter: { type: "none" } },
      },
      xaxis: {
        categories,
        labels: {
          style: { colors: muted, fontSize: "11px", fontWeight: 700 },
        },
        axisBorder: { show: false },
        axisTicks: { show: false },
      },
      yaxis: {
        min: 0,
        max: yMax,
        tickAmount: Math.min(5, Math.max(2, Math.ceil(yMax / 100))),
        labels: {
          formatter: (v) => Math.round(Number(v)),
          style: { colors: muted, fontSize: "10px" },
        },
      },
      grid: {
        borderColor: grid,
        strokeDashArray: 4,
        xaxis: { lines: { show: false } },
        yaxis: { lines: { show: true } },
        padding: { top: 28, left: 8, right: 8, bottom: 0 },
      },
      tooltip: { enabled: false },
      legend: { show: false },
    }),
    [isDark, categories, colors, yMax, muted, grid, values],
  );

  const series = useMemo(() => [{ name: "Ocorrências", data: values }], [values]);

  if (!rows.length || !values.some((v) => v > 0)) {
    return (
      <div className="rt-turno-vol rt-turno-vol--empty" data-dark={isDark}>
        <div className="rt-empty">Sem ocorrências por turno no período.</div>
      </div>
    );
  }

  return (
    <div className="rt-turno-vol" data-dark={isDark}>
      <div className="rt-turno-vol-chart" ref={wrapRef}>
        <ReactApexChart options={options} series={series} type="bar" height={chartHeight} width="100%" />
      </div>
    </div>
  );
}
