import React, { useEffect, useMemo, useRef } from "react";
import ReactApexChart from "react-apexcharts";
import { fmtBRL } from "./radarPassivoUtils.js";

export function RadarDeptosPassivoChart({ grupos = [], isDark = true, chartHeight = 220 }) {
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

  const rows = useMemo(() => grupos.filter((g) => g.passivo > 0 || g.ocorrencias > 0), [grupos]);
  const categories = useMemo(() => rows.map((r) => r.grupo), [rows]);
  const values = useMemo(() => rows.map((r) => Math.round(r.passivo * 100) / 100), [rows]);
  const colors = useMemo(() => rows.map((r) => r.color), [rows]);

  const yMax = useMemo(() => {
    const peak = values.length ? Math.max(...values) : 0;
    if (peak <= 0) return 1000;
    const step = peak <= 5000 ? 1000 : peak <= 20000 ? 2000 : 5000;
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
          columnWidth: "48%",
        },
      },
      dataLabels: { enabled: false },
      xaxis: {
        categories,
        labels: {
          style: { colors: muted, fontSize: "10px", fontWeight: 700 },
        },
        axisBorder: { show: false },
        axisTicks: { show: false },
      },
      yaxis: {
        min: 0,
        max: yMax,
        tickAmount: 4,
        labels: {
          formatter: (v) => {
            const n = Number(v);
            if (n >= 1000) return `R$ ${(n / 1000).toFixed(1).replace(".", ",")} K`;
            return fmtBRL(n);
          },
          style: { colors: muted, fontSize: "10px" },
        },
      },
      grid: {
        borderColor: grid,
        strokeDashArray: 4,
        xaxis: { lines: { show: false } },
        yaxis: { lines: { show: true } },
        padding: { top: 8, left: 8, right: 8, bottom: 0 },
      },
      tooltip: {
        enabled: true,
        theme: isDark ? "dark" : "light",
        y: { formatter: (v) => fmtBRL(v) },
      },
      legend: { show: false },
    }),
    [isDark, categories, colors, yMax, muted, grid],
  );

  const series = useMemo(() => [{ name: "Passivo", data: values }], [values]);

  if (!rows.length) {
    return <div className="rt-empty">Sem passivo por setor no período.</div>;
  }

  return (
    <div className="rt-deptos-passivo-chart" data-dark={isDark}>
      <div ref={wrapRef}>
        <ReactApexChart options={options} series={series} type="bar" height={chartHeight} width="100%" />
      </div>
    </div>
  );
}
