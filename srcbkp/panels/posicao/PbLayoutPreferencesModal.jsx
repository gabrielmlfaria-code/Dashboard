import React, { useMemo } from "react";
import {
  buildLayoutEditorItems,
  normalizePosicaoDashboardLayout,
  resetPosicaoDashboardLayout,
  savePosicaoDashboardLayout,
} from "./posicaoDashboardLayout.js";

function renumber(items) {
  return items.reduce((acc, item, index) => {
    acc[item.id] = (index + 1) * 10;
    return acc;
  }, {});
}

export function PbLayoutPreferencesModal({
  theme = "light",
  layout,
  allowedIds = [],
  onChange,
  onClose,
}) {
  const normalized = useMemo(() => normalizePosicaoDashboardLayout(layout), [layout]);
  const items = useMemo(
    () => buildLayoutEditorItems(normalized, allowedIds),
    [allowedIds, normalized],
  );

  const commit = (nextLayout) => {
    const saved = savePosicaoDashboardLayout(nextLayout);
    onChange?.(saved);
  };

  const move = (id, direction) => {
    const index = items.findIndex((item) => item.id === id);
    const nextIndex = index + direction;
    if (index < 0 || nextIndex < 0 || nextIndex >= items.length) return;
    const nextItems = [...items];
    const [item] = nextItems.splice(index, 1);
    nextItems.splice(nextIndex, 0, item);
    commit({ ...normalized, order: { ...normalized.order, ...renumber(nextItems) } });
  };

  const toggle = (id) => {
    const hidden = normalized.hidden.includes(id)
      ? normalized.hidden.filter((item) => item !== id)
      : [...normalized.hidden, id];
    commit({ ...normalized, hidden });
  };

  const reset = () => {
    const saved = resetPosicaoDashboardLayout();
    onChange?.(saved);
  };

  return (
    <div
      className="pb-cfg-overlay"
      data-theme={theme}
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose?.();
      }}
    >
      <div
        className="pb-cfg-modal pb-layout-modal"
        role="dialog"
        aria-label="Painéis do dashboard"
        onMouseDown={(e) => e.stopPropagation()}
      >
        <div className="pb-cfg-head">
          <span className="pb-cfg-title">Paineis</span>
          <button type="button" className="pb-cfg-close" onClick={onClose} aria-label="Fechar">
            x
          </button>
        </div>

        <div className="pb-cfg-body">
          <div className="pb-layout-list">
            {items.map((item, index) => (
              <div key={item.id} className="pb-layout-row">
                <label className="pb-layout-check">
                  <input
                    type="checkbox"
                    checked={item.enabled}
                    onChange={() => toggle(item.id)}
                  />
                  <span>{item.label}</span>
                </label>
                <div className="pb-layout-actions">
                  <button
                    type="button"
                    className="pb-btn pb-btn-compact"
                    disabled={index === 0}
                    onClick={() => move(item.id, -1)}
                    aria-label={`Subir ${item.label}`}
                    title="Subir"
                  >
                    ↑
                  </button>
                  <button
                    type="button"
                    className="pb-btn pb-btn-compact"
                    disabled={index === items.length - 1}
                    onClick={() => move(item.id, 1)}
                    aria-label={`Descer ${item.label}`}
                    title="Descer"
                  >
                    ↓
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="pb-cfg-foot">
          <button type="button" className="pb-btn pb-btn-secondary" onClick={reset}>
            Restaurar padrao
          </button>
          <div style={{ flex: 1 }} />
          <button type="button" className="pb-btn pb-btn-primary" onClick={onClose}>
            Fechar
          </button>
        </div>
      </div>
    </div>
  );
}
