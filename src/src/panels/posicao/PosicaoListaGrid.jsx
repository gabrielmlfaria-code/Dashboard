import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { getCategoryClass, normalizeGridRow } from "./posicaoGridUtils.js";

const COLS = [
  { key: "nome", label: "Colaborador", width: 220, sort: "text", sticky: true },
  { key: "matricula", label: "Matrícula", width: 88, sort: "num" },
  { key: "filial", label: "Filial", width: 200, sort: "text" },
  { key: "departamento", label: "Departamento", width: 200, sort: "text" },
  { key: "cargo", label: "Cargo", width: 180, sort: "text" },
  { key: "_categoryLabel", label: "Categoria", width: 120, sort: "text", pill: true },
  { key: "gestor", label: "Gestor", width: 160, sort: "text" },
  { key: "marcacoes", label: "Horário", width: 260, sort: false },
  { key: "inicio", label: "Início", width: 100, sort: "text", cats: ["ferias", "afastados"] },
  { key: "termino", label: "Fim", width: 100, sort: "text", cats: ["ferias", "afastados"] },
  { key: "qtd_dias", label: "Dias", width: 72, sort: "num", cats: ["ferias", "afastados"] },
  { key: "justificativa", label: "Justificativa", width: 200, sort: "text", cats: ["afastados"] },
];

const DEFAULT_VISIBLE = [
  "nome",
  "matricula",
  "filial",
  "departamento",
  "cargo",
  "_categoryLabel",
  "gestor",
  "marcacoes",
];

const PAGE_SIZES = [25, 50, 100];

function SortTh({ col, label, sortKey, sortDir, onSort }) {
  const active = sortKey === col;
  return (
    <button
      type="button"
      className={`pos-lista-th${active ? " is-active" : ""}`}
      onClick={() => onSort(col)}
    >
      <span>{label}</span>
      <span className="pos-lista-sort" aria-hidden="true">
        {active ? (sortDir === "asc" ? "▲" : "▼") : "⇅"}
      </span>
    </button>
  );
}

function MarcacoesCell({ row, activeCategory }) {
  const marks = Array.isArray(row?.marcacoes) ? row.marcacoes : [];
  const horSlots = String(row?.horario_dia || "")
    .match(/\d{1,2}:\d{2}/g)
    ?.slice(0, 4) || ["08:00", "12:00", "13:00", "17:00"];
  const onlyHor = ["falta", "folga", "ferias", "entrada_prev", "afastados"].includes(
    String(activeCategory || ""),
  );

  return (
    <div className="excel-marc">
      <div className="excel-marc-grid">
        <span className="excel-marc-lbl">HOR:</span>
        {horSlots.map((t) => (
          <span key={t} className="excel-marc-hor">
            {t}
          </span>
        ))}
      </div>
      {onlyHor ? null : (
        <div className="excel-marc-grid">
          <span className="excel-marc-lbl">MARC:</span>
          {marks.length ? (
            marks.slice(0, 4).map((m, i) => {
              const ok = typeof m?.ok === "boolean" ? m.ok : i % 2 === 0;
              return (
                <span key={`${m?.time || "t"}-${i}`} className={`cell-mark ${ok ? "in" : "out"}`}>
                  {m?.time || "--:--"}
                </span>
              );
            })
          ) : (
            <span className="cell-mark none">sem</span>
          )}
        </div>
      )}
    </div>
  );
}

function compareRows(a, b, key, dir, sortType) {
  const mul = dir === "asc" ? 1 : -1;
  let va = key === "_categoryLabel" ? a._categoryLabel : a[key];
  let vb = key === "_categoryLabel" ? b._categoryLabel : b[key];
  va = va == null ? "" : String(va);
  vb = vb == null ? "" : String(vb);
  if (sortType === "num") {
    const na = Number(va.replace(/\D/g, "")) || 0;
    const nb = Number(vb.replace(/\D/g, "")) || 0;
    return (na - nb) * mul;
  }
  return va.localeCompare(vb, "pt-BR", { sensitivity: "base" }) * mul;
}

export function PosicaoListaGrid({
  rows,
  categories,
  activeCategory,
  onChangeCategory,
  height = "100%",
}) {
  const [q, setQ] = useState("");
  const [sortKey, setSortKey] = useState("nome");
  const [sortDir, setSortDir] = useState("asc");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(50);
  const [visibleKeys, setVisibleKeys] = useState(DEFAULT_VISIBLE);
  const [colsOpen, setColsOpen] = useState(false);
  const colsRef = useRef(null);

  const activeLabel = useMemo(() => {
    const found = (Array.isArray(categories) ? categories : []).find(
      (c) => c.key === activeCategory,
    );
    return found?.label || activeCategory || "";
  }, [categories, activeCategory]);

  const allowedCols = useMemo(() => {
    const cat = String(activeCategory || "");
    return COLS.filter((c) => {
      if (!c.cats) return true;
      return c.cats.includes(cat);
    });
  }, [activeCategory]);

  const visibleCols = useMemo(
    () => allowedCols.filter((c) => visibleKeys.includes(c.key)),
    [allowedCols, visibleKeys],
  );

  useEffect(() => {
    setPage(1);
  }, [activeCategory, q, pageSize, visibleKeys]);

  useEffect(() => {
    if (!colsOpen) return;
    const onDown = (e) => {
      if (colsRef.current?.contains(e.target)) return;
      setColsOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [colsOpen]);

  const normalized = useMemo(() => {
    const qq = q.trim().toLowerCase();
    const src = Array.isArray(rows) ? rows : [];
    const list = src.map((r, idx) => ({
      ...normalizeGridRow(r),
      _id: r?.id ?? `${r?.matricula || r?.nome || "row"}-${idx}`,
      _category: r?._category ?? activeCategory,
      _categoryLabel: r?._categoryLabel ?? activeLabel,
    }));
    const filtered = qq ? list.filter((r) => r._search.includes(qq)) : list;
    const sorted = [...filtered].sort((a, b) => {
      const col = allowedCols.find((c) => c.key === sortKey);
      if (!col?.sort) return 0;
      return compareRows(a, b, sortKey, sortDir, col.sort);
    });
    return sorted;
  }, [rows, q, activeCategory, activeLabel, sortKey, sortDir, allowedCols]);

  const totalPages = Math.max(1, Math.ceil(normalized.length / pageSize) || 1);
  const safePage = Math.min(page, totalPages);

  const paged = useMemo(() => {
    const start = (safePage - 1) * pageSize;
    return normalized.slice(start, start + pageSize);
  }, [normalized, safePage, pageSize]);

  const onSort = useCallback(
    (key) => {
      const col = allowedCols.find((c) => c.key === key);
      if (!col?.sort) return;
      if (sortKey === key) setSortDir((d) => (d === "asc" ? "desc" : "asc"));
      else {
        setSortKey(key);
        setSortDir(col.sort === "num" ? "desc" : "asc");
      }
    },
    [allowedCols, sortKey],
  );

  const toggleCol = (key) => {
    setVisibleKeys((prev) => {
      const set = new Set(prev);
      if (set.has(key)) {
        if (set.size <= 2) return prev;
        set.delete(key);
      } else set.add(key);
      return allowedCols.map((c) => c.key).filter((k) => set.has(k));
    });
  };

  const exportCsv = useCallback(() => {
    const headers = visibleCols.map((c) => c.label);
    const lines = [
      headers.join(";"),
      ...normalized.map((r) =>
        visibleCols
          .map((c) => {
            const v =
              c.key === "_categoryLabel"
                ? r._categoryLabel
                : c.key === "marcacoes"
                  ? r.marcacoes_text
                  : r[c.key];
            return `"${String(v ?? "").replace(/"/g, '""')}"`;
          })
          .join(";"),
      ),
    ];
    const blob = new Blob(["\uFEFF" + lines.join("\n")], { type: "text/csv;charset=utf-8" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `posicao_${activeCategory || "dados"}_${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(a.href);
  }, [visibleCols, normalized, activeCategory]);

  const exportXlsx = useCallback(async () => {
    const xlsxMod = await import("xlsx-js-style");
    const XLSX = xlsxMod.default ?? xlsxMod;
    const headers = visibleCols.map((c) => c.label);
    const aoa = [
      headers,
      ...normalized.map((r) =>
        visibleCols.map((c) => {
          if (c.key === "_categoryLabel") return r._categoryLabel;
          if (c.key === "marcacoes") return r.marcacoes_text;
          return r[c.key] ?? "";
        }),
      ),
    ];
    const ws = XLSX.utils.aoa_to_sheet(aoa);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Dados");
    XLSX.writeFile(
      wb,
      `posicao_${activeCategory || "dados"}_${new Date().toISOString().slice(0, 10)}.xlsx`,
    );
  }, [visibleCols, normalized, activeCategory]);

  const start = normalized.length ? (safePage - 1) * pageSize + 1 : 0;
  const end = Math.min(safePage * pageSize, normalized.length);

  return (
    <div className="pos-lista-shell" style={{ height }}>
      <div className="pos-lista-tabs">
        {(Array.isArray(categories) ? categories : []).map((cat) => (
          <button
            key={cat.key}
            type="button"
            className={`hist-chip ${activeCategory === cat.key ? "hc-active" : ""}`}
            onClick={() => onChangeCategory?.(cat.key)}
          >
            {cat.label} ({cat.total ?? 0})
          </button>
        ))}
      </div>

      <div className="pos-lista-toolbar">
        <input
          type="search"
          className="pos-lista-search"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Buscar nome, matrícula, filial, depto..."
        />
        <div className="pos-lista-toolbar-actions">
          <div className="pos-lista-cols-wrap" ref={colsRef}>
            <button
              type="button"
              className="pos-lista-btn"
              onClick={() => setColsOpen((o) => !o)}
              aria-expanded={colsOpen}
            >
              Colunas ▾
            </button>
            {colsOpen ? (
              <div className="pos-lista-cols-pop">
                {allowedCols.map((c) => (
                  <label key={c.key} className="pos-lista-cols-item">
                    <input
                      type="checkbox"
                      checked={visibleKeys.includes(c.key)}
                      onChange={() => toggleCol(c.key)}
                    />
                    {c.label}
                  </label>
                ))}
              </div>
            ) : null}
          </div>
          <button type="button" className="pos-lista-btn" onClick={exportCsv}>
            CSV
          </button>
          <button type="button" className="pos-lista-btn" onClick={exportXlsx}>
            XLSX
          </button>
          <span className="pos-lista-count">
            {normalized.length.toLocaleString("pt-BR")} reg.
          </span>
        </div>
      </div>

      <div className="pos-lista-table-wrap">
        <table className="pos-lista-table">
          <thead>
            <tr>
              {visibleCols.map((c) => (
                <th
                  key={c.key}
                  className={c.sticky ? "pos-lista-th-sticky" : ""}
                  style={{ width: c.width, minWidth: c.width }}
                >
                  {c.sort ? (
                    <SortTh
                      col={c.key}
                      label={c.label}
                      sortKey={sortKey}
                      sortDir={sortDir}
                      onSort={onSort}
                    />
                  ) : (
                    <span className="pos-lista-th-static">{c.label}</span>
                  )}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {paged.length ? (
              paged.map((r) => (
                <tr key={r._id}>
                  {visibleCols.map((c) => {
                    if (c.key === "marcacoes") {
                      return (
                        <td key={c.key} className="pos-lista-td-marc">
                          <MarcacoesCell row={r} activeCategory={activeCategory} />
                        </td>
                      );
                    }
                    if (c.pill) {
                      const cls = getCategoryClass(r._category);
                      return (
                        <td key={c.key}>
                          <span className={`pos-lista-pill ${cls}`}>{r._categoryLabel || "—"}</span>
                        </td>
                      );
                    }
                    const val = c.key === "_categoryLabel" ? r._categoryLabel : r[c.key];
                    const sticky = c.sticky ? " pos-lista-td-nome" : "";
                    return (
                      <td key={c.key} className={sticky} title={String(val ?? "")}>
                        {String(val ?? "—")}
                      </td>
                    );
                  })}
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan={visibleCols.length} className="pos-lista-empty">
                  Nenhum registro nesta categoria.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <div className="pos-lista-footer">
        <span className="pos-lista-range">
          {normalized.length ? `${start}–${end} de ${normalized.length}` : "0 registros"}
        </span>
        <label className="pos-lista-pagesize">
          Por página
          <select
            value={pageSize}
            onChange={(e) => setPageSize(Number(e.target.value) || 50)}
          >
            {PAGE_SIZES.map((n) => (
              <option key={n} value={n}>
                {n}
              </option>
            ))}
          </select>
        </label>
        <div className="pos-lista-pag">
          <button
            type="button"
            className="pos-lista-pag-btn"
            disabled={safePage <= 1}
            onClick={() => setPage(1)}
          >
            «
          </button>
          <button
            type="button"
            className="pos-lista-pag-btn"
            disabled={safePage <= 1}
            onClick={() => setPage((p) => Math.max(1, p - 1))}
          >
            ‹
          </button>
          <span className="pos-lista-pag-info">
            {safePage} / {totalPages}
          </span>
          <button
            type="button"
            className="pos-lista-pag-btn"
            disabled={safePage >= totalPages}
            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
          >
            ›
          </button>
          <button
            type="button"
            className="pos-lista-pag-btn"
            disabled={safePage >= totalPages}
            onClick={() => setPage(totalPages)}
          >
            »
          </button>
        </div>
      </div>
    </div>
  );
}
