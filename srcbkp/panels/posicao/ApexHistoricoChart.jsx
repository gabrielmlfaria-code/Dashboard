import React, { useEffect, useRef, useMemo, useState } from "react";
import ReactApexChart from "react-apexcharts";

// ─── Feriados nacionais fixos (MM-DD) ───────────────────────────────────────
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

// Feriados móveis (Carnaval, Paixão, Corpus Christi)
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

function getDateMeta(isoDate) {
  // isoDate = "2026-05-15"
  if (!isoDate) return null;
  const m = String(isoDate).match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!m) return null;
  const [, yyyy, mm, dd] = m;
  const date = new Date(Number(yyyy), Number(mm) - 1, Number(dd));
  const dow = date.getDay(); // 0=Dom
  const mmdd = `${mm}-${dd}`;
  const feriado = FERIADOS_MOVEIS[isoDate] || FERIADOS_FIXOS[mmdd] || null;

  // Ponte: dia útil entre feriado na 5ª e fim de semana, ou 2ª e início de semana
  // Detectamos apenas se o dia em si não é feriado mas está cercado
  const isPonte =
    !feriado &&
    (dow === 5 || dow === 1) &&
    (() => {
      const prev = new Date(date);
      prev.setDate(prev.getDate() - 1);
      const next = new Date(date);
      next.setDate(next.getDate() + 1);
      const prevIso = prev.toISOString().slice(0, 10);
      const nextIso = next.toISOString().slice(0, 10);
      const prevMmdd = `${String(prev.getMonth() + 1).padStart(2, "0")}-${String(prev.getDate()).padStart(2, "0")}`;
      const nextMmdd = `${String(next.getMonth() + 1).padStart(2, "0")}-${String(next.getDate()).padStart(2, "0")}`;
      const prevFer = FERIADOS_MOVEIS[prevIso] || FERIADOS_FIXOS[prevMmdd];
      const nextFer = FERIADOS_MOVEIS[nextIso] || FERIADOS_FIXOS[nextMmdd];
      // 6ª entre 5ª feriado e sábado
      if (dow === 5 && prevFer && prev.getDay() === 4) return true;
      // 2ª entre domingo e 3ª feriado
      if (dow === 1 && nextFer && next.getDay() === 2) return true;
      return false;
    })();

  const isWeekend = dow === 0 || dow === 6;
  return { dow, dowLabel: DOW_PT[dow], label: `${dd}/${mm}`, feriado, isPonte, isWeekend };
}

// ─── Componente ─────────────────────────────────────────────────────────────

function ApexHistoricoChart({ histRows, faltDays, setFaltDays, onClose, isDark, onToggleTheme }) {
  const [meta, setMeta] = useState(95);
  const chartWrapRef = useRef(null);

  // Remove o <title> SVG que o ApexCharts injeta (causa tooltip nativo do browser)
  useEffect(() => {
    const el = chartWrapRef.current;
    if (!el) return;
    const remove = () => el.querySelectorAll(".apexcharts-svg > title").forEach((t) => t.remove());
    remove();
    const mo = new MutationObserver(remove);
    mo.observe(el, { childList: true, subtree: true });
    return () => mo.disconnect();
  }, []);

  // Metadados de cada data
  const dateMeta = useMemo(() => histRows.map((r) => getDateMeta(r.date)), [histRows]);

  // Labels do eixo X: array [dowLabel, dd/mm] para multi-linha
  const xLabels = useMemo(
    () => dateMeta.map((m) => (m ? `${m.dowLabel} ${m.label}` : "")),
    [dateMeta],
  );

  // Séries: Presentes(bar), Ausentes(faltas+atrasos)(line), Justificadas(line), Meta(line)
  const series = useMemo(
    () => [
      { name: "Presentes (%)", type: "bar", data: histRows.map((r) => r.presentesPct) },
      {
        name: "Ausentes",
        type: "line",
        data: histRows.map((r) => (r.faltas || 0) + (r.atrasos || 0)),
      },
      { name: "Aus. Justificadas", type: "line", data: histRows.map((r) => r.justificadas || 0) },
      { name: "Meta", type: "line", data: histRows.map(() => meta) },
    ],
    [histRows, meta],
  );

  // Escala eixo esquerdo (%) — apertada
  const presMin = useMemo(() => {
    const vals = histRows.map((r) => r.presentesPct);
    return Math.max(0, Math.floor(Math.min(...vals) - 3));
  }, [histRows]);

  // Escala eixo direito (ocorrências)
  const occMax = useMemo(() => {
    const vals = [
      ...histRows.map((r) => (r.faltas || 0) + (r.atrasos || 0)),
      ...histRows.map((r) => r.justificadas || 0),
      1,
    ];
    return Math.ceil(Math.max(...vals) / 5) * 5 + 5;
  }, [histRows]);

  // Melhor e pior dia (por Presentes %)
  const { bestIdx, worstIdx } = useMemo(() => {
    const vals = histRows.map((r) => r.presentesPct);
    if (!vals.length) return { bestIdx: -1, worstIdx: -1 };
    let bi = 0,
      wi = 0;
    vals.forEach((v, i) => {
      if (v > vals[bi]) bi = i;
      if (v < vals[wi]) wi = i;
    });
    return { bestIdx: bi, worstIdx: bi === wi ? -1 : wi };
  }, [histRows]);

  // Cores por tipo de série
  const seriesColors = useMemo(() => {
    const map = {
      "Presentes (%)": "#22c55e",
      Ausentes: "#ef4444",
      "Aus. Justificadas": "#818cf8",
      Meta: "#a855f7",
    };
    return series.map((s) => map[s.name] || "#94a3b8");
  }, [series]);

  const muted = isDark ? "#64748b" : "#94a3b8";
  const grid = isDark ? "rgba(148,163,184,.1)" : "rgba(100,116,139,.14)";

  // Annotations: feriados/pontes + melhor/pior
  const xAnnotations = useMemo(() => {
    const out = [];
    dateMeta.forEach((dm, i) => {
      if (!dm) return;
      if (dm.feriado) {
        out.push({
          x: xLabels[i],
          fillColor: "rgba(239,68,68,0.08)",
          borderColor: "#ef4444",
          borderWidth: 1,
          label: {
            text: dm.feriado,
            style: {
              color: "#fff",
              background: "#ef4444",
              fontSize: "8px",
              fontWeight: 700,
              padding: { top: 2, bottom: 2, left: 5, right: 5 },
            },
            position: "top",
            offsetY: -2,
          },
        });
      } else if (dm.isPonte) {
        out.push({
          x: xLabels[i],
          fillColor: "rgba(245,158,11,0.08)",
          borderColor: "#f59e0b",
          borderWidth: 1,
          label: {
            text: "Ponte",
            style: {
              color: "#fff",
              background: "#f59e0b",
              fontSize: "8px",
              fontWeight: 700,
              padding: { top: 2, bottom: 2, left: 5, right: 5 },
            },
            position: "top",
            offsetY: -2,
          },
        });
      }
    });
    if (bestIdx >= 0 && xLabels[bestIdx]) {
      out.push({
        x: xLabels[bestIdx],
        fillColor: "rgba(34,197,94,0.10)",
        borderColor: "#22c55e",
        borderWidth: 1.5,
        label: {
          text: "▲ Melhor",
          style: {
            color: "#fff",
            background: "#22c55e",
            fontSize: "8px",
            fontWeight: 700,
            padding: { top: 2, bottom: 2, left: 5, right: 5 },
          },
          position: "top",
          offsetY: -2,
        },
      });
    }
    if (worstIdx >= 0 && xLabels[worstIdx]) {
      out.push({
        x: xLabels[worstIdx],
        fillColor: "rgba(239,68,68,0.10)",
        borderColor: "#ef4444",
        borderWidth: 1.5,
        label: {
          text: "▼ Pior",
          style: {
            color: "#fff",
            background: "#b91c1c",
            fontSize: "8px",
            fontWeight: 700,
            padding: { top: 2, bottom: 2, left: 5, right: 5 },
          },
          position: "top",
          offsetY: -2,
        },
      });
    }
    return out;
  }, [dateMeta, xLabels, bestIdx, worstIdx]);

  const options = useMemo(
    () => ({
      chart: {
        type: "line",
        background: "transparent",
        toolbar: {
          show: true,
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
        animations: { enabled: true, speed: 350 },
        fontFamily: "inherit",
      },
      theme: { mode: isDark ? "dark" : "light" },
      colors: seriesColors,
      stroke: {
        curve: "smooth",
        width: series.map((s) => (s.type === "bar" ? 0 : s.name === "Meta" ? 1.8 : 2.4)),
        dashArray: series.map((s) => (s.name === "Meta" ? 6 : 0)),
      },
      fill: {
        type: series.map((s) => (s.type === "bar" ? "gradient" : "solid")),
        gradient: {
          shade: isDark ? "dark" : "light",
          type: "vertical",
          opacityFrom: 0.75,
          opacityTo: 0.18,
          stops: [0, 100],
        },
      },
      plotOptions: {
        bar: { columnWidth: "58%", borderRadius: 3, borderRadiusApplication: "end" },
      },
      dataLabels: { enabled: false },
      markers: {
        size: series.map((s) => (s.type === "bar" || s.name === "Meta" ? 0 : 4)),
        strokeWidth: 2,
        strokeColors: isDark ? "#0f172a" : "#ffffff",
        hover: { size: 6 },
      },
      xaxis: {
        categories: xLabels,
        labels: {
          rotate: -30,
          rotateAlways: false,
          style: {
            colors: dateMeta.map((dm) =>
              dm?.feriado ? "#ef4444" : dm?.isPonte ? "#f59e0b" : dm?.isWeekend ? "#94a3b8" : muted,
            ),
            fontSize: "9.5px",
            fontWeight: 600,
          },
        },
        axisBorder: { color: grid },
        axisTicks: { color: grid },
        crosshairs: { show: true, stroke: { color: muted, width: 1, dashArray: 3 } },
        tooltip: { enabled: false },
      },
      yaxis: [
        {
          seriesName: "Presentes (%)",
          min: presMin,
          max: 100,
          show: true,
          title: {
            text: "% Presença",
            style: { color: "#22c55e", fontWeight: 700, fontSize: "11px" },
          },
          labels: { formatter: (v) => `${v}%`, style: { colors: "#22c55e", fontSize: "10px" } },
          tickAmount: 5,
        },
        {
          opposite: true,
          min: 0,
          max: occMax,
          show: true,
          title: {
            text: "Ocorrências",
            style: { color: muted, fontWeight: 700, fontSize: "11px" },
          },
          labels: { formatter: (v) => Math.round(v), style: { colors: muted, fontSize: "10px" } },
          tickAmount: 5,
        },
      ],
      tooltip: {
        shared: true,
        intersect: false,
        theme: isDark ? "dark" : "light",
        style: { fontSize: "12px", fontFamily: "inherit" },
        y: {
          formatter: (val, { seriesIndex, w }) => {
            const name = w.config.series[seriesIndex]?.name || "";
            if (name === "Presentes (%)" || name === "Meta") return `${val}%`;
            return val;
          },
        },
        x: {
          formatter: (val, { dataPointIndex }) => {
            const dm = dateMeta[dataPointIndex];
            if (!dm) return val;
            const tag = dm.feriado ? ` 🔴 ${dm.feriado}` : dm.isPonte ? " 🟡 Ponte" : "";
            return `${val}${tag}`;
          },
        },
      },
      legend: {
        show: true,
        position: "top",
        horizontalAlign: "left",
        labels: { useSeriesColors: true },
        markers: { size: 8, shape: "circle" },
        itemMargin: { horizontal: 14 },
        onItemClick: { toggleDataSeries: true },
        onItemHover: { highlightDataSeries: true },
      },
      grid: {
        borderColor: grid,
        strokeDashArray: 4,
        xaxis: { lines: { show: false } },
        yaxis: { lines: { show: true } },
        padding: { left: 4, right: 16 },
      },
      annotations: {
        xaxis: xAnnotations,
        yaxis: [
          {
            y: meta,
            yAxisIndex: 0,
            borderColor: "#a855f7",
            borderWidth: 1.5,
            strokeDashArray: 5,
            label: {
              text: `Meta ${meta}%`,
              style: {
                color: "#fff",
                background: "#a855f7",
                fontSize: "10px",
                fontWeight: 700,
                padding: { top: 3, bottom: 3, left: 6, right: 6 },
              },
              position: "right",
              offsetX: -8,
            },
          },
        ],
      },
    }),
    [
      isDark,
      xLabels,
      dateMeta,
      presMin,
      occMax,
      series,
      seriesColors,
      muted,
      grid,
      meta,
      xAnnotations,
    ],
  );

  return (
    <div className="apex-hist-overlay" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="apex-hist-modal" data-dark={isDark}>
        <div className="apex-hist-body">
          <div className="apex-hist-chart" ref={chartWrapRef}>
            <ReactApexChart
              options={options}
              series={series}
              type="line"
              height="100%"
              width="100%"
            />
          </div>

          <div className="apex-hist-sidebar">
            <button className="apex-hist-close" onClick={onClose} aria-label="Fechar">
              ✕
            </button>

            {/* Tema */}
            <div className="apex-sidebar-section">
              <span className="apex-sidebar-lbl">Tema</span>
              <button className="apex-sidebar-btn" onClick={onToggleTheme}>
                {isDark ? "☀️  Claro" : "🌙  Escuro"}
              </button>
            </div>

            {/* Período */}
            <div className="apex-sidebar-section">
              <span className="apex-sidebar-lbl">Período</span>
              {[7, 15, 30].map((d) => (
                <button
                  key={d}
                  className={`apex-sidebar-btn ${faltDays === d ? "is-active" : ""}`}
                  onClick={() => setFaltDays(d)}
                >
                  {d} dias
                </button>
              ))}
            </div>

            {/* Destaque melhor / pior */}
            {bestIdx >= 0 && (
              <div className="apex-sidebar-section">
                <span className="apex-sidebar-lbl">Destaque</span>
                <div className="apex-sidebar-kpi" style={{ "--kpi-color": "#22c55e" }}>
                  <span className="apex-kpi-ico">▲</span>
                  <span className="apex-kpi-lbl">Melhor</span>
                  <span className="apex-kpi-val">
                    {xLabels[bestIdx]}
                    <br />
                    {histRows[bestIdx]?.presentesPct}%
                  </span>
                </div>
                {worstIdx >= 0 && (
                  <div className="apex-sidebar-kpi" style={{ "--kpi-color": "#ef4444" }}>
                    <span className="apex-kpi-ico">▼</span>
                    <span className="apex-kpi-lbl">Pior</span>
                    <span className="apex-kpi-val">
                      {xLabels[worstIdx]}
                      <br />
                      {histRows[worstIdx]?.presentesPct}%
                    </span>
                  </div>
                )}
              </div>
            )}

            {/* Meta */}
            <div className="apex-sidebar-section">
              <span className="apex-sidebar-lbl">Meta: {meta}%</span>
              <input
                type="range"
                min={70}
                max={100}
                value={meta}
                onChange={(e) => setMeta(Number(e.target.value))}
                className="apex-sidebar-slider"
              />
            </div>

            {/* Legenda de marcações */}
            <div className="apex-sidebar-section">
              <span className="apex-sidebar-lbl">Legenda</span>
              <div className="apex-legend-item" style={{ "--leg-color": "#ef4444" }}>
                <span className="apex-leg-dot" /> Feriado
              </div>
              <div className="apex-legend-item" style={{ "--leg-color": "#f59e0b" }}>
                <span className="apex-leg-dot" /> Ponte
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default ApexHistoricoChart;
