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
  const absPct = Number(histRadar?.absPct || 0);
  const edgeDelta = histRadar?.absEdgeDelta;
  const meta = Number(absMeta || 0);

  return (
    <div className="pb-radar-card-wrap pb-radar-card-wrap--hero">
      <button
        type="button"
        className="pb-radar-chart-btn"
        aria-label="Ver evolução do absenteísmo"
        title="Ver evolução no período"
        onClick={onOpenChart}
      >
        📈
      </button>
      <button
        type="button"
        className="pb-radar-card pb-radar-card--hero pb-radar-card--abs"
        onClick={onOpenTable}
      >
        <span className="pb-radar-label">Absenteísmo</span>
        <strong className="pb-radar-value-hero" title={absCardTooltip}>
          {absPct.toFixed(1).replace(".", ",")}%
        </strong>
        <span className="pb-radar-value-note" title={absCardTooltip}>
          Índice do Período · {histPeriodShortLabel}
        </span>
        <RadarTrendSparkline rows={histRows} metric="abs" labelMode="daily-edge" />
        <span
          role="button"
          tabIndex={0}
          className={`pb-radar-calc-link${absCalcWarnings.length ? " has-warning" : ""}`}
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
          {absCalcWarnings.length ? " · revisar base" : ""}
        </span>
        <small className="pb-radar-meta">
          <span className="pb-radar-meta-target">
            Meta ≤ {meta.toFixed(1).replace(".", ",")}%
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
