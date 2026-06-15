import { useEffect, useMemo, useRef, useState } from "react";

export function SearchableSelect({ value, options, placeholder, onChange, ariaLabel }) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const wrapRef = useRef(null);
  const inputRef = useRef(null);

  useEffect(() => {
    if (!open) return;
    const onDoc = (ev) => {
      if (wrapRef.current && !wrapRef.current.contains(ev.target)) setOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [open]);

  const displayValue = open ? query : value || "";

  const filtered = useMemo(() => {
    const q = (query || "").toLowerCase().trim();
    if (!q) return options;
    return options.filter((option) => String(option).toLowerCase().includes(q));
  }, [options, query]);

  const select = (val) => {
    onChange && onChange(val);
    setQuery("");
    setOpen(false);
  };

  return (
    <div className="pb-combo" ref={wrapRef}>
      <span className="pb-combo-ico" aria-hidden="true">
        🔎
      </span>
      <input
        ref={inputRef}
        className="pb-combo-input"
        type="text"
        value={displayValue}
        placeholder={placeholder}
        aria-label={ariaLabel}
        onFocus={() => {
          setOpen(true);
          setQuery("");
        }}
        onClick={() => {
          setOpen(true);
        }}
        onChange={(e) => {
          setQuery(e.target.value);
          if (!open) setOpen(true);
        }}
        onKeyDown={(e) => {
          if (e.key === "Escape") {
            setOpen(false);
            inputRef.current?.blur();
          }
          if (e.key === "Enter" && filtered.length > 0) {
            select(filtered[0]);
          }
          if (e.key === "ArrowDown") {
            setOpen(true);
          }
        }}
      />
      {(value || (open && query)) && (
        <button
          type="button"
          className="pb-combo-clear"
          onMouseDown={(e) => {
            e.preventDefault();
            select("");
            inputRef.current?.focus();
          }}
          aria-label="Limpar"
          title="Limpar"
        >
          ×
        </button>
      )}
      {open && (
        <div className="pb-combo-list" role="listbox">
          <button
            type="button"
            className="pb-combo-opt"
            aria-selected={!value}
            onMouseDown={(e) => {
              e.preventDefault();
              select("");
            }}
          >
            {placeholder}
          </button>
          {filtered.length === 0 ? (
            <div className="pb-combo-empty">Sem resultados</div>
          ) : (
            filtered.map((option) => (
              <button
                key={option}
                type="button"
                className="pb-combo-opt"
                aria-selected={value === option}
                onMouseDown={(e) => {
                  e.preventDefault();
                  select(option);
                }}
              >
                {option}
              </button>
            ))
          )}
        </div>
      )}
    </div>
  );
}
