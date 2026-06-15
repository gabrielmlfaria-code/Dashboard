import React from "react";
import { RadarTrendSparkline } from "../RadarTrendSparkline.jsx";

export function AbsenteismoResumoCard({
  histRadar,
  histRows,
  histPeriodShortLabel,
  absCardTooltip,
  absBaseInfo,
  absCalcWarnings,
  absMeta,
  fmt,
  onOpenChart,
  onOpenTable,
  onOpenCalc,
}) {
  const rows = Array.isArray(histRows) ? histRows : [];
  const baseInfo = absBaseInfo || { source: "local", days: 0, records: 0 };
  const warnings = Array.isArray(absCalcWarnings) ? absCalcWarnings : [];
  const absPct = Number(histRadar?.absPct || 0);
  const edgeDelta = histRadar?.absEdgeDelta;
  const meta = Number(absMeta || 0);
  const formatNumber = typeof fmt === "function" ? fmt : (value) => Number(value || 0).toLocaleString("pt-BR");

  return (
    <div className="pb-radar-card-wrap pb-radar-card-wrap--hero">
      <button
        type="button"
        className="pb-radar-chart-btn"
        aria-label="Ver evolucao do absenteismo"
        title="Ver evolucao no periodo"
        onClick={onOpenChart}
      >
        📈
      </button>
      <button
        type="button"
        className="pb-radar-card pb-radar-card--hero pb-radar-card--abs"
        onClick={onOpenTable}
      >
        <span className="pb-radar-label">Absenteismo</span>
        <strong className="pb-radar-value-hero" title={absCardTooltip}>
          {absPct.toFixed(1).replace(".", ",")}%
        </strong>
        <span className="pb-radar-value-note" title={absCardTooltip}>
          Indice do Periodo · {histPeriodShortLabel}
        </span>
        <RadarTrendSparkline rows={rows} metric="abs" labelMode="daily-edge" />
        <span
          role="button"
          tabIndex={0}
          className={`pb-radar-calc-link${warnings.length ? " has-warning" : ""}`}
          onClick={(ev) => {
            ev.preventDefault();
            ev.stopPropagation();
            onOpenCalc?.();
          }}
          onKeyDown={(ev) => {
            if (ev.key !== "Enter" && ev.key !== " ") return;
            ev.preventDefault();
            ev.stopPropagation();
            onOpenCalc?.();
          }}
        >
          Como foi calculado
          {warnings.length ? " · revisar base" : ""}
        </span>
        <small className="pb-radar-meta">
          <span className="pb-radar-meta-target">
            {`Meta <= ${meta.toFixed(1).replace(".", ",")}%`}
          </span>
          <span className={absPct <= meta ? "pb-radar-meta--ok" : "pb-radar-meta--bad"}>
            {absPct <= meta
              ? " · dentro da meta"
              : ` · +${(absPct - meta).toFixed(1).replace(".", ",")} pp acima`}
          </span>
        </small>
      </button>
    </div>
  );
}
