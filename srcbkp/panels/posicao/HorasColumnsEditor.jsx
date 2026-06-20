import React, { useState } from "react";

const COLOR_PRESETS = [
  "#22c55e",
  "#ef4444",
  "#3b82f6",
  "#f59e0b",
  "#f97316",
  "#8b5cf6",
  "#64748b",
  "#0ea5e9",
  "#ec4899",
  "#14b8a6",
];

function slugFromLabel(label) {
  return String(label || "")
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 36);
}

function makeCustomValue(label, existingValues) {
  const base = slugFromLabel(label) || `col_${Date.now()}`;
  let candidate = `custom_${base}`;
  let n = 2;
  while (existingValues.has(candidate)) {
    candidate = `custom_${base}_${n}`;
    n += 1;
  }
  return candidate;
}

export function HorasColumnsEditor({ categories, onApply, onClose }) {
  const [draft, setDraft] = useState(() => categories.map((c) => ({ ...c })));
  const [newLabel, setNewLabel] = useState("");

  const updateCol = (value, patch) => {
    setDraft((prev) => prev.map((c) => (c.value === value ? { ...c, ...patch } : c)));
  };

  const removeCol = (value) => {
    const col = draft.find((c) => c.value === value);
    if (!col || col.builtin) return;
    setDraft((prev) => prev.filter((c) => c.value !== value));
  };

  const addCol = () => {
    const label = newLabel.trim();
    if (!label) return;
    const existingValues = new Set(draft.map((c) => c.value));
    const value = makeCustomValue(label, existingValues);
    setDraft((prev) => [
      ...prev,
      { value, label, color: "#64748b", builtin: false },
    ]);
    setNewLabel("");
  };

  const buildFinalDraft = () => {
    let list = draft;
    const pending = newLabel.trim();
    if (pending) {
      const existingValues = new Set(list.map((c) => c.value));
      const value = makeCustomValue(pending, existingValues);
      list = [...list, { value, label: pending, color: "#64748b", builtin: false }];
      setNewLabel("");
      setDraft(list);
    }
    return list;
  };

  const apply = () => {
    const finalDraft = buildFinalDraft();
    const cleaned = finalDraft
      .map((c) => ({
        ...c,
        label: String(c.label || c.value).trim() || c.value,
        color: c.color || "#64748b",
        builtin: Boolean(c.builtin),
      }))
      .filter((c) => c.value);
    onApply(cleaned);
    onClose();
  };

  return (
    <div
      className="hcm-cols-overlay"
      role="dialog"
      aria-modal="true"
      aria-label="Editar colunas de categorias"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
      onKeyDown={(e) => {
        if (e.key === "Escape") {
          e.stopPropagation();
          onClose();
        }
      }}
    >
      <div className="hcm-cols-modal" onMouseDown={(e) => e.stopPropagation()}>
        <div className="hcm-cols-header">
          <h3 className="hcm-cols-title">Colunas da tabela</h3>
          <button type="button" className="hcm-close" onClick={onClose} aria-label="Fechar">
            ✕
          </button>
        </div>
        <p className="hcm-cols-desc">
          Renomeie os títulos ou crie colunas novas com <strong>+ Nova coluna</strong> e depois{" "}
          <strong>Aplicar</strong> (o nome digitado no campo também entra ao aplicar). A coluna
          aparece na tabela principal à direita das categorias padrão.
        </p>
        <ul className="hcm-cols-list">
          {draft.map((col) => (
            <li key={col.value} className="hcm-cols-item">
              <div className="hcm-cols-color">
                <span
                  className="hcm-cols-swatch"
                  style={{ background: col.color }}
                  aria-hidden
                />
                <select
                  className="hcm-cols-color-select"
                  value={col.color}
                  onChange={(e) => updateCol(col.value, { color: e.target.value })}
                  aria-label={`Cor da coluna ${col.label}`}
                >
                  {COLOR_PRESETS.map((hex) => (
                    <option key={hex} value={hex}>
                      {hex}
                    </option>
                  ))}
                </select>
              </div>
              <input
                type="text"
                className="hcm-cols-label-input"
                value={col.label}
                onChange={(e) => updateCol(col.value, { label: e.target.value })}
                aria-label={`Nome da coluna ${col.value}`}
              />
              {col.builtin ? (
                <span className="hcm-cols-badge">Padrão</span>
              ) : (
                <button
                  type="button"
                  className="hcm-cols-remove"
                  onClick={() => removeCol(col.value)}
                  title="Remover coluna personalizada"
                >
                  Remover
                </button>
              )}
            </li>
          ))}
        </ul>
        <div className="hcm-cols-add">
          <input
            type="text"
            className="hcm-add-input"
            placeholder="Nome da nova coluna…"
            value={newLabel}
            onChange={(e) => setNewLabel(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") addCol();
            }}
          />
          <button
            type="button"
            className="pb-trend-tab hcm-add-btn"
            onClick={addCol}
            disabled={!newLabel.trim()}
          >
            + Nova coluna
          </button>
        </div>
        <div className="hcm-cols-footer">
          <button type="button" className="pb-trend-tab" onClick={onClose}>
            Cancelar
          </button>
          <div style={{ flex: 1 }} />
          <button type="button" className="pb-trend-tab is-active hcm-save-btn" onClick={apply}>
            Aplicar
          </button>
        </div>
      </div>
    </div>
  );
}
