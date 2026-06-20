import React from "react";
import { RadarTrendSparkline } from "../RadarTrendSparkline.jsx";

export function RadarTrabalhistaResumoCard({
  histRadar,
  histRows,
  onOpenChart,
  onOpenRadar,
}) {
  const ocorrencias = Number(histRadar?.riscoOcorrencias || 0);
  const colaboradores = Number(histRadar?.riscoColaboradores || 0);
  const topEvento = histRadar?.riscoTopEvento;

  return (
    <div className="pb-radar-card-wrap pb-radar-card-wrap--hero pb-radar-card-wrap--risk">
      <button
        type="button"
        className="pb-radar-chart-btn"
        aria-label="Ver evolução do radar trabalhista"
        title="Ver evolução no período"
        onClick={onOpenChart}
      >
        📈
      </button>
      <button
        type="button"
        className="pb-radar-card pb-radar-card--hero pb-radar-card--risk"
        aria-label="Abrir Radar Trabalhista"
        onClick={onOpenRadar}
      >
        <span className="pb-radar-label pb-radar-label--risk">Radar trabalhista</span>
        <span className="pb-radar-risk-note">Resumo do período</span>
        <div className="pb-radar-risk-facts">
          <span>
            <b>{ocorrencias.toLocaleString("pt-BR")}</b>
            <em>ocorrências trabalhistas</em>
          </span>
          <span>
            <b>{colaboradores.toLocaleString("pt-BR")}</b>
            <em>colaboradores</em>
          </span>
        </div>
        <small className="pb-radar-risk-main">
          <b>Principal evento:</b>
          <span>
            {topEvento
              ? `${topEvento.label} · ${Number(topEvento.count || 0).toLocaleString("pt-BR")} ocorrências`
              : "Nenhuma ocorrência no período"}
          </span>
        </small>
        {histRows.length >= 2 && ocorrencias > 0 && (
          <div className="pb-radar-risk-evol" aria-label="Evolução diária das ocorrências trabalhistas">
            <span>Evolução diária</span>
            <RadarTrendSparkline
              rows={histRows}
              metric="risk"
              formatValue={(value) => `${Math.round(Number(value) || 0)} oc.`}
              labelMode="daily-edge"
              className="pb-radar-risk-evol-spark"
            />
          </div>
        )}
        <small className="pb-radar-meta pb-radar-risk-cta">Abrir Radar Trabalhista</small>
      </button>
    </div>
  );
}
