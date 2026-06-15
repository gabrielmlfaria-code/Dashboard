import React, { useEffect, useMemo, useRef, useState } from "react";

export function EmpFilter({ empList = [], value, onChange }) {
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const wrapRef = useRef(null);

  useEffect(() => {
    if (!open) return undefined;
    const h = (e) => {
      if (!wrapRef.current?.contains(e.target)) setOpen(false);
    };
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, [open]);

  const filtered = useMemo(() => {
    const q = query.toLowerCase().trim();
    if (!q) return empList;
    return empList.filter(
      ([mat, nome]) => nome.toLowerCase().includes(q) || mat.toLowerCase().includes(q),
    );
  }, [empList, query]);

  const selected = value ? empList.find(([mat]) => mat === value) : null;

  return (
    <div className="pb-emp-filter" ref={wrapRef}>
      <span className="pb-emp-ico" aria-hidden="true">
        👤
      </span>
      <input
        className="pb-emp-input"
        placeholder="Colaborador..."
        value={open ? query : selected ? selected[1] : ""}
        onFocus={() => {
          setOpen(true);
          setQuery("");
        }}
        onChange={(e) => {
          setQuery(e.target.value);
          setOpen(true);
        }}
        onKeyDown={(e) => {
          if (e.key === "Escape") setOpen(false);
          if (e.key === "Enter" && filtered.length > 0) {
            onChange(filtered[0][0]);
            setOpen(false);
            setQuery("");
          }
        }}
      />
      {value && (
        <button
          type="button"
          className="pb-emp-clear"
          onMouseDown={(e) => {
            e.preventDefault();
            onChange(null);
          }}
        >
          ×
        </button>
      )}
      {open && (
        <div className="pb-emp-list">
          <button
            type="button"
            className="pb-emp-opt pb-emp-opt-all"
            onMouseDown={(e) => {
              e.preventDefault();
              onChange(null);
              setOpen(false);
            }}
          >
            Todos os colaboradores
          </button>
          {filtered.slice(0, 80).map(([mat, nome]) => (
            <button
              key={mat}
              type="button"
              className={`pb-emp-opt${value === mat ? " selected" : ""}`}
              onMouseDown={(e) => {
                e.preventDefault();
                onChange(mat);
                setOpen(false);
                setQuery("");
              }}
            >
              {nome}
            </button>
          ))}
          {filtered.length > 80 && (
            <div className="pb-emp-more">+{filtered.length - 80} — refine a busca</div>
          )}
        </div>
      )}
    </div>
  );
}
