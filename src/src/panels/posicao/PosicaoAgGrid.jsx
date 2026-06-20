import { useCallback, useMemo, useRef, useState } from "react";
import { AgGridReact } from "ag-grid-react";
import { AllCommunityModule, ModuleRegistry } from "ag-grid-community";
import "ag-grid-community/styles/ag-grid.css";
import "ag-grid-community/styles/ag-theme-quartz.css";

import { getCategoryClass, normalizeGridRow } from "./posicaoGridUtils.js";

ModuleRegistry.registerModules([AllCommunityModule]);

function CategoryRenderer({ value, data }) {
  const label = value || data?._categoryLabel || "";
  const cls = getCategoryClass(data?._category);
  return label ? <span className={`ag-cat-pill ${cls}`}>{label}</span> : "";
}

function MarcacoesRenderer({ data }) {
  const marks = Array.isArray(data?.marcacoes) ? data.marcacoes : [];
  const text = data?.marcacoes_text || "";
  if (!marks.length) return <span title={text}>{text}</span>;
  return (
    <div className="ag-marks" title={text}>
      {marks.slice(0, 4).map((m, i) => {
        const ok = typeof m?.ok === "boolean" ? m.ok : i % 2 === 0;
        return (
          <span key={`${m?.time || "m"}-${i}`} className={`ag-mark ${ok ? "ok" : "fail"}`}>
            {m?.time || "--:--"}
          </span>
        );
      })}
    </div>
  );
}

export function PosicaoAgGrid({
  rows,
  categories,
  activeCategory,
  onChangeCategory,
  height = "100%",
}) {
  const gridRef = useRef(null);
  const [q, setQ] = useState("");
  const [visible, setVisible] = useState(() => ({
    filial: true,
    matricula: true,
    nome: true,
    departamento: true,
    cargo: true,
    gestor: true,
    inicio: false,
    termino: false,
    qtd_dias: false,
    justificativa: false,
    marcacoes: true,
  }));

  const activeLabel = useMemo(() => {
    const found = (Array.isArray(categories) ? categories : []).find(
      (c) => c.key === activeCategory,
    );
    return found?.label || activeCategory || "";
  }, [categories, activeCategory]);

  const rowData = useMemo(() => {
    const qq = q.trim().toLowerCase();
    const src = Array.isArray(rows) ? rows : [];
    const normalized = src.map((r, idx) => ({
      ...normalizeGridRow(r),
      _id: r?.id ?? `${r?.matricula || r?.nome || "row"}-${idx}`,
      _category: r?._category ?? activeCategory,
      _categoryLabel: r?._categoryLabel ?? activeLabel,
    }));
    return qq ? normalized.filter((r) => r._search.includes(qq)) : normalized;
  }, [rows, q, activeCategory, activeLabel]);

  const columnDefs = useMemo(
    () => [
      {
        headerName: "COLABORADOR",
        field: "nome",
        width: 230,
        pinned: "left",
        hide: !visible.nome,
        checkboxSelection: true,
        headerCheckboxSelection: true,
      },
      { headerName: "MATRICULA", field: "matricula", width: 110, hide: !visible.matricula },
      { headerName: "FILIAL", field: "filial", width: 240, hide: !visible.filial },
      {
        headerName: "DEPARTAMENTO",
        field: "departamento",
        width: 280,
        hide: !visible.departamento,
      },
      { headerName: "CARGO", field: "cargo", width: 280, hide: !visible.cargo },
      {
        headerName: "CATEGORIA",
        field: "_categoryLabel",
        width: 150,
        cellRenderer: CategoryRenderer,
      },
      { headerName: "DATA INICIO", field: "inicio", width: 130, hide: !visible.inicio },
      { headerName: "DATA FIM", field: "termino", width: 130, hide: !visible.termino },
      { headerName: "QTD. DIAS", field: "qtd_dias", width: 110, hide: !visible.qtd_dias },
      {
        headerName: "JUSTIFICATIVA",
        field: "justificativa",
        width: 280,
        hide: !visible.justificativa,
      },
      { headerName: "GESTOR", field: "gestor", width: 220, hide: !visible.gestor },
      {
        headerName: "HORARIO",
        field: "marcacoes_text",
        width: 360,
        hide: !visible.marcacoes,
        cellRenderer: MarcacoesRenderer,
      },
    ],
    [visible],
  );

  const defaultColDef = useMemo(
    () => ({
      sortable: true,
      filter: true,
      resizable: true,
      floatingFilter: false,
      suppressHeaderMenuButton: false,
    }),
    [],
  );

  const toggleCol = (key) => {
    setVisible((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const exportCsv = useCallback(() => {
    gridRef.current?.api?.exportDataAsCsv({
      fileName: `posicao_${activeCategory || "dados"}_${new Date().toISOString().slice(0, 10)}.csv`,
      columnSeparator: ";",
    });
  }, [activeCategory]);

  const exportXlsx = useCallback(async () => {
    const xlsxMod = await import("xlsx-js-style");
    const XLSX = xlsxMod.default ?? xlsxMod;
    const fields = columnDefs.filter((c) => !c.hide).map((c) => c.field);
    const headers = columnDefs.filter((c) => !c.hide).map((c) => c.headerName);
    const aoa = [
      headers,
      ...rowData.map((r) =>
        fields.map((f) => {
          if (f === "_categoryLabel") return r._categoryLabel;
          return r[f] ?? "";
        }),
      ),
    ];
    const ws = XLSX.utils.aoa_to_sheet(aoa);
    ws["!cols"] = headers.map((h, i) => ({
      wch: Math.min(
        42,
        Math.max(10, h.length + 2, ...aoa.slice(1, 200).map((r) => String(r[i] ?? "").length + 2)),
      ),
    }));
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Dados");
    XLSX.writeFile(
      wb,
      `posicao_${activeCategory || "dados"}_${new Date().toISOString().slice(0, 10)}.xlsx`,
    );
  }, [activeCategory, columnDefs, rowData]);

  return (
    <div className="pos-ag-shell" style={{ height }}>
      <div className="pos-ag-tabs">
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

      <div className="pos-ag-toolbar">
        <input
          type="search"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Buscar nome, cod, evento, filial..."
          className="pos-ag-search"
        />
        <div className="pos-ag-colbar">
          {[
            ["filial", "Filial"],
            ["matricula", "Matricula"],
            ["nome", "Nome"],
            ["departamento", "Depto"],
            ["cargo", "Cargo"],
            ["gestor", "Gestor"],
            ["marcacoes", "Horario"],
            ["inicio", "Inicio"],
            ["termino", "Fim"],
          ].map(([key, label]) => (
            <label key={key} className="pos-ag-check">
              <input type="checkbox" checked={!!visible[key]} onChange={() => toggleCol(key)} />
              {label}
            </label>
          ))}
        </div>
        <button type="button" className="panel-btn" onClick={exportCsv}>
          CSV
        </button>
        <button type="button" className="panel-btn" onClick={exportXlsx}>
          XLSX
        </button>
        <span className="pos-ag-count">
          {rowData.length.toLocaleString("pt-BR")} /{" "}
          {(Array.isArray(rows) ? rows.length : 0).toLocaleString("pt-BR")}
        </span>
      </div>

      <div className="ag-theme-quartz pos-ag-grid">
        <AgGridReact
          ref={gridRef}
          rowData={rowData}
          columnDefs={columnDefs}
          defaultColDef={defaultColDef}
          rowSelection="multiple"
          animateRows={false}
          suppressDragLeaveHidesColumns
          rowBuffer={30}
          getRowId={(params) => String(params.data?._id)}
        />
      </div>
    </div>
  );
}
