import React, { useEffect, useMemo, useRef } from "react";
import ReactApexChart from "react-apexcharts";
import { fmtBRL } from "./radarPassivoUtils.js";

/** Paleta categórica — modelo “Volume por tipo de evento”. */
const BAR_COLORS = [
  "#ef4444",
  "#ec4899",
  "#ea580c",
  "#fb923c",
  "#eab308",
  "#a855f7",
  "#14b8a6",
  "#15803d",
  "#4ade80",
  "#6366f1",
  "#f43f5e",
  "#0ea5e9",
];

function truncLabel(s, max = 36) {
  const t = String(s ?? "").trim();
  return t.length > max ? `${t.slice(0, max - 1)}…` : t;
}

export function RadarEventosVolumeChart({ eventTypes = [], isDark = true, maxCategories = 12 }) {
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

  const rows = useMemo(
    () =>
      [...eventTypes]
        .filter((e) => (e.ocorrencias ?? 0) > 0)
        .sort((a, b) => b.ocorrencias - a.ocorrencias)
        .slice(0, maxCategories),
    [eventTypes, maxCategories],
  );

  const categories = useMemo(() => rows.map((e) => e.evento), [rows]);
  const values = useMemo(() => rows.map((e) => e.ocorrencias), [rows]);
  const colors = useMemo(() => rows.map((_, i) => BAR_COLORS[i % BAR_COLORS.length]), [rows]);

  const chartHeight = useMemo(() => Math.max(280, Math.min(720, rows.length * 42 + 56)), [rows.length]);

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
          horizontal: true,
          distributed: true,
          borderRadius: 4,
          borderRadiusApplication: "end",
          barHeight: "72%",
        },
      },
      dataLabels: { enabled: false },
      /* Mesmo padrão do gráfico por departamento (RadarPremiumChart): categorias em xaxis */
      xaxis: {
        categories,
        labels: {
          show: true,
          maxWidth: 280,
          style: { colors: muted, fontSize: "10px", fontWeight: 600 },
          formatter: (val, _ts, opts) => {
            const idx = opts?.dataPointIndex;
            const name = idx != null && rows[idx] ? rows[idx].evento : val;
            return truncLabel(name);
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
        padding: { top: 0, left: 4, right: 20, bottom: 4 },
      },
      tooltip: {
        theme: isDark ? "dark" : "light",
        custom({ dataPointIndex }) {
          const row = rows[dataPointIndex];
          if (!row) return "";
          const color = colors[dataPointIndex] || "#a855f7";
          const passivo =
            row.passivo != null && row.passivo > 0
              ? fmtBRL(row.passivo)
              : "—";
          const base = row.baseLegal || "CLT — verificar";
          return `<div class="apex-custom-tip"><div class="apex-custom-tip-title">${row.evento}</div><div class="apex-custom-tip-row"><span style="background:${color}"></span>Ocorrências: <b>${row.ocorrencias.toLocaleString("pt-BR")}</b></div><div class="apex-custom-tip-row">Passivo: <b>${passivo}</b></div><div class="apex-custom-tip-row">Base: <b>${base}</b></div></div>`;
        },
      },
      legend: { show: false },
    }),
    [isDark, categories, colors, muted, grid, rows],
  );

  const series = useMemo(() => [{ name: "Ocorrências", data: values }], [values]);

  const totalCats = eventTypes.filter((e) => (e.ocorrencias ?? 0) > 0).length;

  if (!rows.length) {
    return (
      <div className="rt-eventos-vol" data-dark={isDark}>
        <div className="rt-eventos-vol-head">
          <h3 className="rt-eventos-vol-title">Volume por tipo de evento</h3>
        </div>
        <div className="rt-empty">Sem eventos de risco no período.</div>
      </div>
    );
  }

  return (
    <div className="rt-eventos-vol" data-dark={isDark}>
      <div className="rt-eventos-vol-head">
        <h3 className="rt-eventos-vol-title">Volume por tipo de evento</h3>
        <span className="rt-eventos-vol-badge">
          {totalCats} {totalCats === 1 ? "categoria" : "categorias"}
        </span>
      </div>
      <div className="rt-eventos-vol-chart" ref={wrapRef}>
        <ReactApexChart options={options} series={series} type="bar" height={chartHeight} width="100%" />
      </div>
    </div>
  );
}
