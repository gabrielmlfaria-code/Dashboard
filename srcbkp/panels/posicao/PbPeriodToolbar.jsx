import React from "react";

export const PB_FALT_DAYS_ATUAL = "atual";

/** Seletor de período padrão do bento (Absenteísmo / Radar). */
export function PbPeriodToolbar({
  faltDays,
  histDateFrom = "",
  histDateTo = "",
  onSelectFaltDays,
  onOpenHistorico,
  showLabel = true,
  className = "",
}) {
  const custom = Boolean(histDateFrom || histDateTo);

  return (
    <div className={`pb-trend-toolbar rt-pb-period${className ? ` ${className}` : ""}`}>
      <div className="pb-trend-band">
        {showLabel ? <span className="pb-trend-band-label">Período</span> : null}
        <div className="pb-trend-tabs" role="tablist" aria-label="Período">
          <button
            type="button"
            className={`pb-trend-tab${faltDays === PB_FALT_DAYS_ATUAL && !custom ? " is-active" : ""}`}
            onClick={() => onSelectFaltDays?.(PB_FALT_DAYS_ATUAL)}
            aria-pressed={faltDays === PB_FALT_DAYS_ATUAL && !custom}
            title="Período de apuração atual (API)"
          >
            Período atual
          </button>
          <button
            type="button"
            className={`pb-trend-tab${faltDays === 7 && !custom ? " is-active" : ""}`}
            onClick={() => onSelectFaltDays?.(7)}
            aria-pressed={faltDays === 7 && !custom}
          >
            7d
          </button>
          <button
            type="button"
            className={`pb-trend-tab${faltDays === 15 && !custom ? " is-active" : ""}`}
            onClick={() => onSelectFaltDays?.(15)}
            aria-pressed={faltDays === 15 && !custom}
          >
            15d
          </button>
          <button
            type="button"
            className={`pb-trend-tab${faltDays === 30 && !custom ? " is-active" : ""}`}
            onClick={() => onSelectFaltDays?.(30)}
            aria-pressed={faltDays === 30 && !custom}
          >
            30d
          </button>
          {onOpenHistorico ? (
            <button
              type="button"
              className="pb-trend-tab pb-tabela-tab"
              onClick={onOpenHistorico}
              title="Abrir histórico do absenteísmo (tabela detalhada)"
            >
              Tabela
            </button>
          ) : null}
        </div>
      </div>
    </div>
  );
}
