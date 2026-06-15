import React, { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";

function triggerLabel(selected, total) {
  if (!selected.length) return "Todos os departamentos";
  if (selected.length === 1) {
    const d = selected[0];
    return d.length > 36 ? `${d.slice(0, 34)}…` : d;
  }
  return `${selected.length} de ${total} selecionados`;
}

/** Multi-select de departamentos — combobox com busca (padrão profissional). */
export function RtDeptMultiSelect({
  label = "Departamentos",
  options = [],
  value = [],
  onChange,
  className = "",
  theme = "dark",
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [panelPos, setPanelPos] = useState(null);
  const rootRef = useRef(null);
  const btnRef = useRef(null);
  const panelRef = useRef(null);
  const searchRef = useRef(null);

  const selected = useMemo(
    () => (Array.isArray(value) ? value.filter(Boolean) : []),
    [value],
  );
  const allSelected = selected.length === 0;

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return options;
    return options.filter((d) => d.toLowerCase().includes(q));
  }, [options, query]);

  const updatePanelPos = useCallback(() => {
    const btn = btnRef.current;
    if (!btn) return;
    const r = btn.getBoundingClientRect();
    const w = Math.min(Math.max(r.width, 280), window.innerWidth - 24);
    let left = Math.min(r.left, window.innerWidth - w - 12);
    const spaceBelow = window.innerHeight - r.bottom - 16;
    const maxH = Math.min(320, Math.max(160, spaceBelow));
    const openUp = spaceBelow < 180 && r.top > 200;
    const top = openUp ? Math.max(8, r.top - Math.min(maxH, 300)) : r.bottom + 6;
    setPanelPos({ top, left, width: w, maxHeight: maxH, openUp });
  }, []);

  useLayoutEffect(() => {
    if (!open) {
      setPanelPos(null);
      return;
    }
    updatePanelPos();
    const t = window.setTimeout(() => searchRef.current?.focus(), 0);
    return () => window.clearTimeout(t);
  }, [open, updatePanelPos]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e) => {
      if (e.key === "Escape") setOpen(false);
    };
    const onDoc = (e) => {
      const t = e.target;
      if (rootRef.current?.contains(t) || panelRef.current?.contains(t)) return;
      setOpen(false);
    };
    const onReflow = () => updatePanelPos();
    document.addEventListener("keydown", onKey);
    document.addEventListener("mousedown", onDoc);
    window.addEventListener("resize", onReflow);
    window.addEventListener("scroll", onReflow, true);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.removeEventListener("mousedown", onDoc);
      window.removeEventListener("resize", onReflow);
      window.removeEventListener("scroll", onReflow, true);
    };
  }, [open, updatePanelPos]);

  const toggle = (dept) => {
    onChange?.(
      selected.includes(dept) ? selected.filter((d) => d !== dept) : [...selected, dept],
    );
  };

  const close = () => {
    setOpen(false);
    setQuery("");
  };

  if (!options.length) return null;

  const panel =
    open && panelPos
      ? createPortal(
          <div
            ref={panelRef}
            className="rt-dept-ms-panel"
            data-theme={theme}
            role="dialog"
            aria-label={label}
            style={{
              position: "fixed",
              top: panelPos.top,
              left: panelPos.left,
              width: panelPos.width,
              maxHeight: panelPos.maxHeight,
            }}
          >
            <div className="rt-dept-ms-search-wrap">
              <input
                ref={searchRef}
                type="search"
                className="rt-dept-ms-search"
                placeholder="Buscar departamento…"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                aria-label="Buscar departamento"
              />
            </div>
            <button
              type="button"
              className={`rt-dept-ms-row rt-dept-ms-row--all${allSelected ? " is-on" : ""}`}
              onClick={() => onChange?.([])}
            >
              <span className="rt-dept-ms-check" aria-hidden>
                {allSelected ? "✓" : ""}
              </span>
              <span className="rt-dept-ms-row-lbl">Todos os departamentos</span>
            </button>
            <div className="rt-dept-ms-list" role="listbox" aria-multiselectable="true">
              {filtered.map((d) => {
                const on = selected.includes(d);
                return (
                  <button
                    key={d}
                    type="button"
                    role="option"
                    aria-selected={on}
                    className={`rt-dept-ms-row${on ? " is-on" : ""}`}
                    onClick={() => toggle(d)}
                    title={d}
                  >
                    <span className="rt-dept-ms-check" aria-hidden>
                      {on ? "✓" : ""}
                    </span>
                    <span className="rt-dept-ms-row-lbl">{d}</span>
                  </button>
                );
              })}
              {!filtered.length && (
                <p className="rt-dept-ms-empty">Nenhum departamento encontrado.</p>
              )}
            </div>
            <div className="rt-dept-ms-foot">
              {!allSelected ? (
                <button type="button" className="rt-dept-ms-foot-btn" onClick={() => onChange?.([])}>
                  Limpar
                </button>
              ) : (
                <span />
              )}
              <button type="button" className="rt-dept-ms-foot-btn rt-dept-ms-foot-btn--primary" onClick={close}>
                Concluído
              </button>
            </div>
          </div>,
          document.body,
        )
      : null;

  return (
    <div className={`rt-dept-ms${className ? ` ${className}` : ""}`} ref={rootRef}>
      {label ? <span className="rt-dept-ms-label">{label}</span> : null}
      <button
        ref={btnRef}
        type="button"
        className={`rt-dept-ms-trigger${open ? " is-open" : ""}${!allSelected ? " has-value" : ""}`}
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-haspopup="dialog"
        title={allSelected ? "" : selected.join(", ")}
      >
        <span className="rt-dept-ms-trigger-text">{triggerLabel(selected, options.length)}</span>
        {!allSelected ? (
          <span className="rt-dept-ms-badge" aria-hidden>
            {selected.length}
          </span>
        ) : null}
        <span className="rt-dept-ms-chevron" aria-hidden />
      </button>
      {panel}
    </div>
  );
}
