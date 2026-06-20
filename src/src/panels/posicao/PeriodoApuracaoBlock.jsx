import React, { useEffect, useState } from "react";
import { fmtDateBr } from "./calendarUtils.js";

/**
 * Seletor De/Até do período de apuração (compartilhado entre Importações e demais telas).
 */
export function PeriodoApuracaoBlock({
  periodoApuracao = null,
  onPeriodoApuracaoChange = null,
  hint = "Define o intervalo considerado nas importações e nos indicadores do painel.",
}) {
  const [draft, setDraft] = useState({
    de: periodoApuracao?.de || "",
    ate: periodoApuracao?.ate || "",
  });

  useEffect(() => {
    setDraft({
      de: periodoApuracao?.de || "",
      ate: periodoApuracao?.ate || "",
    });
  }, [periodoApuracao?.de, periodoApuracao?.ate]);

  const publish = (next) => {
    onPeriodoApuracaoChange?.({
      de: next.de || "",
      ate: next.ate || "",
      source: "manual",
    });
  };

  const patch = (key, value) => {
    setDraft((prev) => {
      const next = { ...prev, [key]: value };
      publish(next);
      return next;
    });
  };

  return (
    <div className="pb-cfg-apuracao-block">
      <span className="pb-cfg-apuracao-label">Período de Apuração</span>
      <div className="pb-cfg-apuracao-fields">
        <label className="pb-cfg-apuracao-field">
          <span>De</span>
          <input
            type="date"
            value={draft.de}
            onChange={(e) => patch("de", e.target.value)}
            title={draft.de ? fmtDateBr(draft.de) : "Data inicial"}
            aria-label="Data inicial do período de apuração"
          />
        </label>
        <label className="pb-cfg-apuracao-field">
          <span>Até</span>
          <input
            type="date"
            value={draft.ate}
            onChange={(e) => patch("ate", e.target.value)}
            title={draft.ate ? fmtDateBr(draft.ate) : "Data final"}
            aria-label="Data final do período de apuração"
          />
        </label>
      </div>
      {hint ? <span className="pb-cfg-hint">{hint}</span> : null}
    </div>
  );
}
