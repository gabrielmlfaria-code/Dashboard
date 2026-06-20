import React, { useEffect, useRef, useMemo, useState } from "react";
import ReactApexChart from "react-apexcharts";
import { useChartHostHeight } from "./useChartHostHeight.js";
import { ChartLegendBar, PB_CHART_IDS } from "./ChartLegendBar.jsx";
import { capWorkedHours } from "./radarHoursUtils.js";

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

const HRS_COLORS = {
  Planejadas: "#6366f1",
  Trabalhadas: "#22c55e",
  Perdidas: "#ef4444",
  Extras: "#f97316",
  Faltas: "#7f1d1d",
  Justificadas: "#92400e",
  Atrasos: "#0369a1",
  Injustificadas: "#ef4444",
};

function getDateMeta(iso) {
  if (!iso) return null;
  const m = String(iso).match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!m) return null;
  const [, yyyy, mm, dd] = m;
  const dow = new Date(Number(yyyy), Number(mm) - 1, Number(dd)).getDay();
  const mmdd = `${mm}-${dd}`;
  return {
    dow,
    dowLabel: DOW_PT[dow],
    label: `${dd}/${mm}`,
    feriado: FERIADOS_MOVEIS[iso] || FERIADOS_FIXOS[mmdd] || null,
    isWeekend: dow === 0 || dow === 6,
  };
}

function fmtH(min) {
  if (min == null || min === 0) return "0h";
  const v = Math.round(min);
  const h = Math.floor(v / 60);
  const m = v % 60;
  return m ? `${h}h ${m}m` : `${h}h`;
}

function fmtHoursReadable(value) {
  const total = Math.round(Number(value) || 0);
  const sign = total < 0 ? "-" : "";
  const abs = Math.abs(total);
  const hours = Math.floor(abs / 60).toLocaleString("pt-BR");
  return `${sign}${hours} h ${String(abs % 60).padStart(2, "0")} min`;
}

// ─── HorasChart ──────────────────────────────────────────────────────────────
function HorasChart({ histRows, isDark, compact = false, focus = "all", onSelectDay }) {
  const exportCaptureRef = useRef(null);
  const chartAreaRef = useRef(null);
  const wrapRef = useRef(null);
  const chartHostHeight = useChartHostHeight(chartAreaRef, {
    enabled: !compact,
    minHeight: 120,
    fallbackHeight: 300,
  });
  const [hoverIndex, setHoverIndex] = useState(null);

  useEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    const rm = () => el.querySelectorAll(".apexcharts-svg > title").forEach((t) => t.remove());
    rm();
    const mo = new MutationObserver(rm);
    mo.observe(el, { childList: true, subtree: true });
    return () => mo.disconnect();
  }, []);

  const hasHours = histRows.some((r) => r.horas_planejadas != null || r.horas_presentes != null);

  const n = histRows.length;
  const dateMeta = useMemo(() => histRows.map((r) => getDateMeta(r.date)), [histRows]);
  const axisKeys = useMemo(
    () => histRows.map((r, i) => r.date || `dia-${i + 1}`),
    [histRows],
  );

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

  const axisLabelByKey = useMemo(
    () => new Map(axisKeys.map((key, i) => [key, labels[i]])),
    [axisKeys, labels],
  );

  const periodTotals = useMemo(
    () =>
      histRows.reduce(
        (acc, r) => {
          const planned = Number(r.horas_planejadas) || 0;
          const worked = capWorkedHours(r.horas_presentes, planned);
          return {
            planned: acc.planned + planned,
            worked: acc.worked + worked,
            lost:
              acc.lost +
              (Number(r.horas_faltas) || 0) +
              (Number(r.horas_atrasos) || 0) +
              (Number(r.horas_justificadas) || 0),
            extras: acc.extras + (Number(r.horas_extras) || 0),
          };
        },
        { planned: 0, worked: 0, lost: 0, extras: 0 },
      ),
    [histRows],
  );

  const horasMax = useMemo(() => {
    const dayVals =
      focus === "work"
        ? histRows.flatMap((r) => [r.horas_planejadas || 0, r.horas_presentes || 0, r.horas_extras || 0])
        : focus === "lost"
          ? histRows.flatMap((r) => [
              r.horas_planejadas || 0,
              (r.horas_faltas || 0) + (r.horas_atrasos || 0),
              r.horas_justificadas || 0,
            ])
          : histRows.flatMap((r) => [
              r.horas_planejadas || 0,
              r.horas_presentes || 0,
              (r.horas_faltas || 0) + (r.horas_justificadas || 0),
              r.horas_extras || 0,
            ]);
    const max = Math.max(...dayVals, 60);
    return Math.ceil(max / 60) * 60 + 120;
  }, [histRows, focus]);

  const countMax = useMemo(() => {
    if (focus !== "all") return 5;
    const vals = histRows.flatMap((r) => [r.faltas || 0, r.justificadas || 0, r.atrasos || 0]);
    return Math.max(5, Math.ceil(Math.max(...vals, 1) * 1.12));
  }, [histRows, focus]);

  const muted = isDark ? "#64748b" : "#94a3b8";
  const grid = isDark ? "rgba(148,163,184,.08)" : "rgba(100,116,139,.11)";

  const series = useMemo(() => {
    const point = (r, i, y) => ({ x: axisKeys[i], y: y ?? 0 });
    if (focus === "work") {
      return [
        {
          name: "Planejadas",
          type: "area",
          data: histRows.map((r, i) => point(r, i, r.horas_planejadas)),
        },
        {
          name: "Trabalhadas",
          type: "area",
          data: histRows.map((r, i) =>
            point(r, i, capWorkedHours(r.horas_presentes, r.horas_planejadas)),
          ),
        },
        {
          name: "Extras",
          type: "area",
          data: histRows.map((r, i) => point(r, i, r.horas_extras)),
        },
      ];
    }
    if (focus === "lost") {
      return [
        {
          name: "Planejadas",
          type: "area",
          data: histRows.map((r, i) => point(r, i, r.horas_planejadas)),
        },
        {
          name: "Injustificadas",
          type: "area",
          data: histRows.map((r, i) =>
            point(r, i, (r.horas_faltas || 0) + (r.horas_atrasos || 0)),
          ),
        },
        {
          name: "Justificadas",
          type: "area",
          data: histRows.map((r, i) => point(r, i, r.horas_justificadas)),
        },
      ];
    }
    return [
      {
        name: "Planejadas",
        type: "area",
        data: histRows.map((r, i) => point(r, i, r.horas_planejadas)),
      },
      {
        name: "Trabalhadas",
        type: "area",
        data: histRows.map((r, i) =>
          point(r, i, capWorkedHours(r.horas_presentes, r.horas_planejadas)),
        ),
      },
      {
        name: "Perdidas",
        type: "area",
        data: histRows.map((r, i) =>
          point(r, i, (r.horas_faltas || 0) + (r.horas_justificadas || 0)),
        ),
      },
      {
        name: "Extras",
        type: "area",
        data: histRows.map((r, i) => point(r, i, r.horas_extras)),
      },
      {
        name: "Faltas",
        type: "bar",
        data: histRows.map((r, i) => point(r, i, r.faltas || 0)),
      },
      {
        name: "Justificadas",
        type: "bar",
        data: histRows.map((r, i) => point(r, i, r.justificadas || 0)),
      },
      {
        name: "Atrasos",
        type: "bar",
        data: histRows.map((r, i) => point(r, i, r.atrasos || 0)),
      },
    ];
  }, [histRows, axisKeys, focus]);

  const chartColors = useMemo(
    () => series.map((s) => HRS_COLORS[s.name] || "#64748b"),
    [series],
  );

  const xAnnotations = useMemo(
    () =>
      dateMeta
        .map((dm, i) => {
          if (!dm?.feriado) return null;
          return {
            x: axisKeys[i],
            fillColor: "rgba(239,68,68,0.06)",
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
          };
        })
        .filter(Boolean),
    [dateMeta, axisKeys],
  );

  const isFocused = focus === "work" || focus === "lost";

  const options = useMemo(
    () => ({
      chart: {
        id: PB_CHART_IDS.hrs,
        type: "area",
        background: "transparent",
        toolbar: { show: false },
        zoom: { enabled: false },
        redrawOnParentResize: true,
        animations: { enabled: !compact, speed: 350, easing: "easeinout" },
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
      colors: chartColors,
      stroke: {
        curve: "smooth",
        width: isFocused
          ? [2.5, 2.5, 2]
          : [2.5, 2.5, 2, 2, 0, 0, 0],
        dashArray: isFocused ? [6, 0, 0] : [6, 0, 0, 0, 0, 0, 0],
      },
      fill: {
        type: isFocused
          ? ["gradient", "gradient", "gradient"]
          : ["gradient", "gradient", "gradient", "gradient", "solid", "solid", "solid"],
        opacity: isFocused ? [1, 1, 1] : [1, 1, 1, 1, 0.7, 0.6, 0.55],
        gradient: {
          shade: isDark ? "dark" : "light",
          type: "vertical",
          opacityFrom: isDark ? 0.55 : 0.45,
          opacityTo: isDark ? 0.08 : 0.05,
          stops: [0, 90],
        },
      },
      plotOptions: {
        bar: {
          columnWidth: "50%",
          borderRadius: 2,
          borderRadiusApplication: "end",
        },
      },
      dataLabels: { enabled: false },
      markers: {
        size: isFocused ? [3, 3, 3] : [3, 3, 3, 3, 0, 0, 0],
        strokeWidth: 1.5,
        strokeColors: isDark ? "#0f172a" : "#ffffff",
        hover: { size: 5 },
      },
      xaxis: {
        type: "category",
        categories: axisKeys,
        labels: {
          formatter: (value) => axisLabelByKey.get(value) || "",
          rotate: compact ? -25 : -30,
          rotateAlways: false,
          hideOverlappingLabels: true,
          style: {
            colors: dateMeta.map((dm) =>
              dm?.feriado ? "#ef4444" : dm?.isWeekend ? (isDark ? "#475569" : "#cbd5e1") : muted,
            ),
            fontSize: compact ? "8px" : "8.5px",
            fontWeight: 600,
          },
        },
        axisBorder: { show: false },
        axisTicks: { show: false },
        crosshairs: { show: true, stroke: { color: muted, width: 1, dashArray: 3 } },
        tooltip: { enabled: false },
      },
      yaxis: isFocused
        ? [
            {
              min: 0,
              max: horasMax,
              tickAmount: compact ? 4 : 5,
              title: compact
                ? undefined
                : { text: "Horas", style: { color: "#6366f1", fontWeight: 700, fontSize: "10px" } },
              labels: {
                formatter: (v) => `${Math.round(v / 60)}h`,
                style: { colors: muted, fontSize: "9px" },
              },
            },
          ]
        : [
            {
              seriesName: ["Planejadas", "Trabalhadas", "Perdidas", "Extras"],
              min: 0,
              max: horasMax,
              tickAmount: 5,
              title: { text: "Horas", style: { color: "#6366f1", fontWeight: 700, fontSize: "10px" } },
              labels: {
                formatter: (v) => `${Math.round(v / 60)}h`,
                style: { colors: "#6366f1", fontSize: "9px" },
              },
            },
            {
              seriesName: ["Faltas", "Justificadas", "Atrasos"],
              opposite: true,
              min: 0,
              max: countMax,
              tickAmount: 5,
              title: {
                text: "Colaboradores",
                style: { color: muted, fontWeight: 700, fontSize: "10px" },
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
        y: {
          formatter: (val, { seriesIndex }) => {
            if (val == null) return "—";
            if (isFocused) return fmtH(val);
            return seriesIndex < 4 ? fmtH(val) : `${Math.round(val)} colab.`;
          },
        },
        x: {
          formatter: (_val, { dataPointIndex }) => {
            const dm = dateMeta[dataPointIndex];
            const lbl = labels[dataPointIndex];
            if (!lbl) return axisKeys[dataPointIndex] || "";
            return `${lbl}${dm?.feriado ? ` · ${dm.feriado}` : dm?.isWeekend ? " · Fim de semana" : ""}`;
          },
        },
      },
      legend: { show: false },
      annotations: { xaxis: compact ? [] : xAnnotations },
      grid: {
        borderColor: grid,
        strokeDashArray: 3,
        padding: { left: 2, right: 8, top: -4, bottom: 0 },
      },
    }),
    [
      isDark,
      axisKeys,
      axisLabelByKey,
      dateMeta,
      labels,
      horasMax,
      countMax,
      muted,
      grid,
      xAnnotations,
      focus,
      compact,
      isFocused,
      chartColors,
      histRows,
      onSelectDay,
    ],
  );

  if (!hasHours) {
    return (
      <div
        style={{
          flex: 1,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          color: muted,
          fontSize: 13,
        }}
      >
        Sem dados de horas no período importado
      </div>
    );
  }

  return (
    <div
      style={{
        flex: 1,
        minHeight: compact ? undefined : 300,
        display: "flex",
        flexDirection: "column",
        minWidth: 0,
      }}
    >
      {!compact ? (
        <div ref={exportCaptureRef} className="pb-chart-export-capture">
          <div
            className="pb-abs-kpis pb-chart-export-kpis"
            role="group"
            aria-label="Resumo de horas"
          >
            <div className="pb-abs-kpi">
              <span>Planejadas</span>
              <strong>{fmtHoursReadable(periodTotals.planned)}</strong>
            </div>
            <div className="pb-abs-kpi is-ok">
              <span>Trabalhadas</span>
              <strong>{fmtHoursReadable(periodTotals.worked)}</strong>
            </div>
            <div className="pb-abs-kpi">
              <span>Perdidas / ausentes</span>
              <strong>{fmtHoursReadable(periodTotals.lost)}</strong>
            </div>
            <div className="pb-abs-kpi">
              <span>Extras</span>
              <strong>{fmtHoursReadable(periodTotals.extras)}</strong>
            </div>
          </div>
          <ChartLegendBar
            chartId={PB_CHART_IDS.hrs}
            captureRef={exportCaptureRef}
            exportTheme={isDark ? "dark" : "light"}
            items={series.map((s) => ({
              seriesName: s.name,
              label: s.name,
              color: HRS_COLORS[s.name] || "#64748b",
            }))}
            exportFilename={`horas-${n}d-${focus}`}
            resetKey={`${focus}:${n}`}
            hint={
              onSelectDay
                ? "Clique num dia para ver detalhes · legenda: ativar/desativar série"
                : "Legenda: clique para ativar/desativar série"
            }
          />
          <div
            ref={chartAreaRef}
            className="pb-pres-chart-surface"
            style={{
              flex: "1 1 auto",
              minHeight: Math.max(chartHostHeight, 220),
              minWidth: 0,
              width: "100%",
              height: chartHostHeight,
            }}
          >
            <div ref={wrapRef} style={{ width: "100%", height: "100%" }}>
              <ReactApexChart
                key={`${focus}:${n}`}
                options={options}
                series={series}
                type="area"
                height={chartHostHeight}
                width="100%"
              />
            </div>
          </div>
        </div>
      ) : (
        <div
          ref={chartAreaRef}
          className="pb-pres-chart-surface"
          style={{
            flex: "1 1 auto",
            minHeight: 220,
            minWidth: 0,
            width: "100%",
            height: 220,
          }}
        >
          <div ref={wrapRef} style={{ width: "100%", height: "100%" }}>
            <ReactApexChart
              key={`${focus}:${n}`}
              options={options}
              series={series}
              type="area"
              height={220}
              width="100%"
            />
          </div>
        </div>
      )}
    </div>
  );
}

export default HorasChart;
