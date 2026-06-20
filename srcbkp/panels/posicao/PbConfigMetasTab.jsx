import React from "react";

export function PbConfigMetasTab({
  absMeta,
  onAbsMetaChange,
  onAbsMetaBlur,
  turnoverMeta,
  onTurnoverMetaChange,
  onTurnoverMetaBlur,
}) {
  return (
    <div className="pb-cfg-tab-panel">
      <p className="pb-cfg-section-title">Metas de indicadores</p>
      <span className="pb-cfg-hint">
        Valores de referência exibidos nos cards e gráficos do painel.
      </span>

      <div className="pb-cfg-field">
        <span className="pb-cfg-label">Meta de absenteísmo</span>
        <div className="pb-cfg-meta-row">
          <input
            type="number"
            className="pb-cfg-input pb-cfg-meta-input"
            min={0}
            max={100}
            step={0.1}
            value={absMeta}
            onChange={(e) => onAbsMetaChange(e.target.value)}
            onBlur={onAbsMetaBlur}
            aria-label="Meta de absenteísmo em percentual"
          />
          <span className="pb-cfg-meta-suffix">%</span>
        </div>
        <span className="pb-cfg-hint">
          Exibida no card Início e como linha de referência no gráfico de absenteísmo.
        </span>
      </div>

      <div className="pb-cfg-field">
        <span className="pb-cfg-label">Meta de turnover (rotatividade)</span>
        <div className="pb-cfg-meta-row">
          <input
            type="number"
            className="pb-cfg-input pb-cfg-meta-input"
            min={0}
            max={100}
            step={0.1}
            value={turnoverMeta}
            onChange={(e) => onTurnoverMetaChange(e.target.value)}
            onBlur={onTurnoverMetaBlur}
            aria-label="Meta de turnover em percentual"
          />
          <span className="pb-cfg-meta-suffix">%</span>
        </div>
        <span className="pb-cfg-hint">
          Referência para comparar a rotatividade mensal no card e mini gráfico de turnover.
        </span>
      </div>
    </div>
  );
}
