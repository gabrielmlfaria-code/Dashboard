import React, { useEffect, useMemo, useRef } from "react";
import ReactApexChart from "react-apexcharts";
import { occurrenceDistribution } from "./radarColabsUtils.js";

const LEVELS = [
  { key: "uma", label: "1 penalidade", color: "#60a5fa" },
  { key: "duasTres", label: "2-3 penalidades", color: "#f97316" },
  { key: "quatroMais", label: "4+ penalidades", color: "#ef4444" },
];

export function RadarColabsScoreDonut({ collaborators = [], isDark = true, chartHeight = 260 }) {
  const wrapRef = useRef(null);
  const dist = useMemo(() => occurrenceDistribution(collaborators), [collaborators]);
  const total = collaborators.length;

  useEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    const rm = () => el.querySelectorAll(".apexcharts-svg > title").forEach((t) => t.remove());
    rm();
    const mo = new MutationObserver(rm);
    mo.observe(el, { childList: true, subtree: true });
    return () => mo.disconnect();
  }, []);

  const activeLevels = useMemo(
    () => LEVELS.filter((l) => (dist[l.key] ?? 0) > 0),
    [dist],
  );

  const series = useMemo(() => activeLevels.map((l) => dist[l.key]), [activeLevels, dist]);
  const labels = useMemo(() => activeLevels.map((l) => l.label), [activeLevels]);
  const colors = useMemo(() => activeLevels.map((l) => l.color), [activeLevels]);
  const centerMuted = isDark ? "#94a3b8" : "#64748b";

  const options = useMemo(
    () => ({
      chart: {
        type: "donut",
        background: "transparent",
        toolbar: { show: false },
        animations: { enabled: true, speed: 400 },
        fontFamily: "inherit",
      },
      theme: { mode: isDark ? "dark" : "light" },
      colors,
      labels,
      stroke: { width: 2, colors: isDark ? ["#161b2e"] : ["#fff"] },
      plotOptions: {
        pie: {
          donut: {
            size: "72%",
            labels: {
              show: true,
              name: { show: false },
              value: { show: false },
              total: {
                show: total > 0,
                label: "Colabs",
                fontSize: "10px",
                fontWeight: 600,
                color: centerMuted,
                formatter: () => String(total),
              },
            },
          },
        },
      },
      dataLabels: { enabled: false },
      legend: { show: false },
      tooltip: {
        enabled: true,
        theme: isDark ? "dark" : "light",
        y: { formatter: (v) => `${Math.round(v)} colab.` },
      },
    }),
    [isDark, colors, labels, centerMuted, total],
  );

  if (!total) {
    return (
      <div className="rt-colabs-donut rt-colabs-donut--empty" data-theme={isDark ? "dark" : "light"}>
        <div className="rt-empty">Sem colaboradores no filtro.</div>
      </div>
    );
  }

  return (
    <div className="rt-colabs-donut" data-theme={isDark ? "dark" : "light"}>
      <div className="rt-colabs-donut-chart" ref={wrapRef}>
        {series.length > 0 ? (
          <ReactApexChart options={options} series={series} type="donut" height={chartHeight} width="100%" />
        ) : (
          <div className="rt-colabs-donut-fallback" aria-hidden>
            <span className="rt-colabs-donut-fallback-n">{total}</span>
            <span className="rt-colabs-donut-fallback-lbl">Colabs</span>
          </div>
        )}
      </div>
      <div className="rt-colabs-donut-legend" role="list" aria-label="Legenda por recorrencia">
        {LEVELS.map((l) => {
          const n = dist[l.key] ?? 0;
          return (
            <div
              key={l.key}
              className={`rt-colabs-donut-leg rt-colabs-donut-leg--${l.key}${n === 0 ? " is-zero" : ""}`}
              role="listitem"
            >
              <span className="rt-colabs-donut-swatch" style={{ background: l.color }} aria-hidden />
              <span className="rt-colabs-donut-leg-lbl">{l.label}</span>
              {n > 0 ? <span className="rt-colabs-donut-leg-val">{n}</span> : null}
            </div>
          );
        })}
      </div>
    </div>
  );
}
