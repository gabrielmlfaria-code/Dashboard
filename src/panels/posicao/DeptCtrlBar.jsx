import { useEffect, useMemo, useRef, useState } from "react";

export default function DeptCtrlBar({
  metricMeta,
  metricOrder,
  selected,
  onToggle,
  order,
  onOrderChange,
  deptOptions,
  deptFilter,
  onDeptFilterChange,
}) {
  const [popOpen, setPopOpen] = useState(false);
  const [search, setSearch] = useState("");
  const popRef = useRef(null);

  const selectedSet = useMemo(() => new Set(selected || []), [selected]);
  const isNone =
    Array.isArray(deptFilter) && deptFilter.length === 1 && deptFilter[0] === "__none__";
  const filterSet = useMemo(() => new Set(isNone ? [] : deptFilter || []), [deptFilter, isNone]);
  const allCount = deptOptions?.length || 0;
  const selCount = isNone ? 0 : filterSet.size === 0 ? allCount : filterSet.size;

  useEffect(() => {
    if (!popOpen) return;
    const onDoc = (e) => {
      if (!popRef.current) return;
      if (!popRef.current.contains(e.target)) setPopOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [popOpen]);

  const filteredOpts = useMemo(() => {
    const q = (search || "").trim().toLowerCase();
    if (!q) return deptOptions || [];
    return (deptOptions || []).filter((d) => d.toLowerCase().includes(q));
  }, [deptOptions, search]);

  const toggleDept = (d) => {
    let base;
    if (isNone) base = new Set();
    else if (filterSet.size === 0) base = new Set(deptOptions || []);
    else base = new Set(filterSet);
    if (base.has(d)) base.delete(d);
    else base.add(d);
    if (base.size === 0) onDeptFilterChange(["__none__"]);
    else if (base.size === (deptOptions || []).length) onDeptFilterChange([]);
    else onDeptFilterChange(Array.from(base));
  };

  return (
    <>
      <span className="bm-lbl">Variáveis:</span>
      {(metricOrder || []).map((k) => {
        const m = metricMeta?.[k];
        if (!m) return null;
        const on = selectedSet.has(k);
        return (
          <button
            key={k}
            type="button"
            className={`bm-btn${on ? " bm-on" : ""}`}
            onClick={() => onToggle(k)}
            style={
              on
                ? { background: m.color, borderColor: m.color, color: "#fff" }
                : { borderLeft: `3px solid ${m.color}` }
            }
            title={m.label}
          >
            {m.label}
          </button>
        );
      })}
      <button
        type="button"
        className="bm-btn"
        onClick={() => {
          (metricOrder || []).forEach((k) => {
            if (selectedSet.has(k)) onToggle(k);
          });
        }}
        title="Limpar variáveis selecionadas"
      >
        ✕ Limpar variáveis
      </button>

      <span className="bm-sep" />
      <span className="bm-lbl">Ordem:</span>
      <select
        className="bm-sel"
        value={order}
        onChange={(e) => onOrderChange(e.target.value)}
        style={{ minWidth: 110 }}
      >
        <option value="desc">Maior → menor</option>
        <option value="asc">Menor → maior</option>
      </select>

      <span className="bm-sep" />
      <div ref={popRef} style={{ position: "relative" }}>
        <button
          type="button"
          className="bm-btn"
          onClick={() => setPopOpen((v) => !v)}
          title="Filtrar departamentos"
        >
          Filtrar departamentos: <strong>{selCount}</strong> / {allCount}
        </button>
        {popOpen && (
          <div
            style={{
              position: "absolute",
              top: "calc(100% + 4px)",
              left: 0,
              zIndex: 50,
              width: 280,
              maxHeight: 340,
              display: "flex",
              flexDirection: "column",
              background: "var(--card)",
              border: "1px solid var(--border)",
              borderRadius: 8,
              boxShadow: "var(--sh-lg)",
              padding: 6,
            }}
          >
            <input
              type="text"
              placeholder="Buscar..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              style={{
                padding: "4px 8px",
                fontSize: ".7rem",
                border: "1px solid var(--border)",
                borderRadius: 5,
                background: "var(--surface2)",
                color: "var(--text)",
                outline: "none",
                marginBottom: 4,
              }}
            />
            <div style={{ display: "flex", gap: 4, marginBottom: 4 }}>
              <button
                type="button"
                className="bm-btn"
                style={{ flex: 1 }}
                onClick={() => onDeptFilterChange([])}
              >
                Selecionar todos
              </button>
              <button
                type="button"
                className="bm-btn"
                style={{ flex: 1 }}
                onClick={() => onDeptFilterChange(["__none__"])}
              >
                Limpar todos
              </button>
            </div>
            <div style={{ overflow: "auto", flex: 1, fontSize: ".7rem" }}>
              {filteredOpts.length === 0 && (
                <div style={{ padding: 8, color: "var(--muted)", textAlign: "center" }}>
                  Nenhum depto.
                </div>
              )}
              {filteredOpts.map((d) => {
                const checked = isNone ? false : filterSet.size === 0 ? true : filterSet.has(d);
                return (
                  <label
                    key={d}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 6,
                      padding: "3px 5px",
                      borderRadius: 4,
                      cursor: "pointer",
                      color: "var(--text)",
                    }}
                  >
                    <input type="checkbox" checked={checked} onChange={() => toggleDept(d)} />
                    <span
                      style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}
                      title={d}
                    >
                      {d}
                    </span>
                  </label>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </>
  );
}
