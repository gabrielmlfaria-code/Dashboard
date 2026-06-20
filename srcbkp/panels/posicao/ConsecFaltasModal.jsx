import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { normDateKey } from "./calendarUtils.js";
import { RADAR_HOURS_TOOLTIPS } from "./radarKpiTooltips.js";
import {
  computeConsecutiveFaltasStats,
  filterHistRowsByDateRange,
} from "./radarHoursUtils.js";
import { fmtSequencia, resolveModalDatesFromApuracao } from "./consecFaltasTimeline.js";
import { EmpPresenceModal } from "./EmpPresenceModal.jsx";

const FRAME_LS_KEY = "pb_consec_faltas_modal_v1";

const COLS = [
  { id: "nome", label: "Colaborador", numeric: false },
  { id: "mat", label: "Matrícula", numeric: false },
  { id: "depto", label: "Departamento", numeric: false },
  { id: "sequencia", label: "Sequência", numeric: false },
  { id: "dias", label: "Dias", numeric: true },
];

function fmtShortDate(iso) {
  const m = String(iso || "").match(/^(\d{4})-(\d{2})-(\d{2})/);
  return m ? `${m[3]}/${m[2]}/${m[1].slice(-2)}` : String(iso || "—");
}

function defaultFrame() {
  if (typeof window === "undefined") return null;
  const width = Math.min(760, window.innerWidth - 32);
  const height = Math.min(620, window.innerHeight - 32);
  return {
    x: Math.max(8, (window.innerWidth - width) / 2),
    y: Math.max(8, (window.innerHeight - height) / 2),
    width,
    height,
  };
}

function loadFrame() {
  if (typeof window === "undefined") return null;
  try {
    const saved = JSON.parse(window.localStorage.getItem(FRAME_LS_KEY) || "null");
    if (!saved) return defaultFrame();
    const maxWidth = window.innerWidth - 16;
    const maxHeight = window.innerHeight - 16;
    const minWidth = Math.min(520, maxWidth);
    const minHeight = Math.min(360, maxHeight);
    const width = Math.max(minWidth, Math.min(maxWidth, Number(saved.width) || minWidth));
    const height = Math.max(minHeight, Math.min(maxHeight, Number(saved.height) || minHeight));
    const x = Math.max(8, Math.min(maxWidth - width, Number(saved.x) ?? (window.innerWidth - width) / 2));
    const y = Math.max(8, Math.min(maxHeight - height, Number(saved.y) ?? (window.innerHeight - height) / 2));
    return { x, y, width, height };
  } catch {
    return defaultFrame();
  }
}

function saveFrame(frame) {
  if (typeof window === "undefined" || !frame) return;
  try {
    window.localStorage.setItem(
      FRAME_LS_KEY,
      JSON.stringify({ x: frame.x, y: frame.y, width: frame.width, height: frame.height }),
    );
  } catch {}
}

function colValue(row, colId) {
  if (colId === "sequencia") return fmtSequencia(row.inicio, row.fim);
  if (colId === "dias") return Number(row.dias) || 0;
  return String(row[colId] ?? "").trim();
}

function sortRows(rows, sortCol, sortDir) {
  const col = COLS.find((c) => c.id === sortCol);
  if (!col) return rows;
  const dir = sortDir === "asc" ? 1 : -1;
  return [...rows].sort((a, b) => {
    if (col.numeric) {
      return (colValue(a, col.id) - colValue(b, col.id)) * dir;
    }
    return colValue(a, col.id).localeCompare(colValue(b, col.id), "pt-BR") * dir;
  });
}

function filterRows(rows, query) {
  const q = String(query || "")
    .trim()
    .toLowerCase();
  if (!q) return rows;
  return rows.filter((row) =>
    [row.nome, row.mat, row.depto, fmtSequencia(row.inicio, row.fim)]
      .some((v) => String(v ?? "").toLowerCase().includes(q)),
  );
}

function fileSlug(dateFrom, dateTo) {
  const from = String(dateFrom || "").replace(/-/g, "");
  const to = String(dateTo || "").replace(/-/g, "");
  if (from && to) return `${from}_${to}`;
  return "periodo";
}

function resolveDefaultDates(periodoApuracao, histRowsAll) {
  return resolveModalDatesFromApuracao(periodoApuracao, histRowsAll);
}

function histDateBounds(histRowsAll) {
  const sorted = [...(Array.isArray(histRowsAll) ? histRowsAll : [])]
    .filter((r) => r?.date)
    .sort((a, b) => String(a.date).localeCompare(String(b.date)));
  return {
    min: sorted[0]?.date || "",
    max: sorted[sorted.length - 1]?.date || "",
  };
}

function buildPeriodLabel(dateFrom, dateTo) {
  if (dateFrom && dateTo) return `${fmtShortDate(dateFrom)} – ${fmtShortDate(dateTo)}`;
  if (dateFrom) return `A partir de ${fmtShortDate(dateFrom)}`;
  if (dateTo) return `Até ${fmtShortDate(dateTo)}`;
  return "Período selecionado";
}

export function ConsecFaltasModal({
  open,
  onClose,
  theme = "dark",
  histRowsAll = [],
  periodoApuracao = null,
}) {
  const modalRef = useRef(null);
  const interactionRef = useRef(null);
  const wasOpenRef = useRef(false);
  const [frame, setFrame] = useState(null);
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [search, setSearch] = useState("");
  const [sortCol, setSortCol] = useState("dias");
  const [sortDir, setSortDir] = useState("desc");
  const [exportBusy, setExportBusy] = useState(false);
  const [profileRow, setProfileRow] = useState(null);

  const dateBounds = useMemo(() => histDateBounds(histRowsAll), [histRowsAll]);

  useEffect(() => {
    if (open && !wasOpenRef.current) setFrame(loadFrame());
    if (open) {
      const defaults = resolveDefaultDates(periodoApuracao, histRowsAll);
      setDateFrom(defaults.dateFrom);
      setDateTo(defaults.dateTo);
      setSearch("");
      setSortCol("dias");
      setSortDir("desc");
      setProfileRow(null);
    }
    wasOpenRef.current = open;
  }, [open, periodoApuracao, histRowsAll]);

  const scopedRows = useMemo(
    () => filterHistRowsByDateRange(histRowsAll, dateFrom, dateTo),
    [histRowsAll, dateFrom, dateTo],
  );

  const lista = useMemo(
    () => computeConsecutiveFaltasStats(scopedRows).lista,
    [scopedRows],
  );

  const periodLabel = useMemo(
    () => buildPeriodLabel(dateFrom, dateTo),
    [dateFrom, dateTo],
  );

  useEffect(() => {
    if (!open) return undefined;
    const onKey = (e) => {
      if (e.key === "Escape") {
        if (profileRow) {
          setProfileRow(null);
          return;
        }
        onClose?.();
      }
    };
    document.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [open, onClose, profileRow]);

  useEffect(() => {
    const move = (event) => {
      const action = interactionRef.current;
      if (!action) return;
      const viewportWidth = window.innerWidth;
      const viewportHeight = window.innerHeight;
      const dx = event.clientX - action.startX;
      const dy = event.clientY - action.startY;
      if (action.kind === "move") {
        setFrame({
          ...action.frame,
          x: Math.max(8, Math.min(viewportWidth - action.frame.width - 8, action.frame.x + dx)),
          y: Math.max(8, Math.min(viewportHeight - action.frame.height - 8, action.frame.y + dy)),
        });
      } else {
        const minWidth = Math.min(520, viewportWidth - 16);
        const minHeight = Math.min(360, viewportHeight - 16);
        const nextFrame = {
          ...action.frame,
          width: Math.max(minWidth, Math.min(viewportWidth - action.frame.x - 8, action.frame.width + dx)),
          height: Math.max(minHeight, Math.min(viewportHeight - action.frame.y - 8, action.frame.height + dy)),
        };
        interactionRef.current.latestFrame = nextFrame;
        setFrame(nextFrame);
      }
    };
    const stop = () => {
      const action = interactionRef.current;
      if (action) {
        const rect = modalRef.current?.getBoundingClientRect();
        if (rect) {
          saveFrame({
            x: rect.left,
            y: rect.top,
            width: rect.width,
            height: rect.height,
          });
        } else {
          saveFrame(action.latestFrame || action.frame);
        }
      }
      interactionRef.current = null;
      document.body.classList.remove("pb-radar-evol-interacting");
    };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", stop);
    return () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", stop);
      document.body.classList.remove("pb-radar-evol-interacting");
    };
  }, []);

  const startInteraction = useCallback((event, kind) => {
    if (event.button !== 0) return;
    if (kind === "move" && event.target.closest("button, a, input, .pb-consec-faltas-close")) return;
    const rect = modalRef.current?.getBoundingClientRect();
    if (!rect) return;
    const currentFrame = {
      x: rect.left,
      y: rect.top,
      width: rect.width,
      height: rect.height,
    };
    setFrame(currentFrame);
    interactionRef.current = {
      kind,
      startX: event.clientX,
      startY: event.clientY,
      frame: currentFrame,
    };
    document.body.classList.add("pb-radar-evol-interacting");
    event.preventDefault();
  }, []);

  const toggleSort = useCallback((colId) => {
    setSortCol((prevCol) => {
      if (prevCol === colId) {
        setSortDir((prevDir) => (prevDir === "asc" ? "desc" : "asc"));
        return prevCol;
      }
      const col = COLS.find((c) => c.id === colId);
      setSortDir(col?.numeric ? "desc" : "asc");
      return colId;
    });
  }, []);

  const filteredRows = useMemo(
    () => sortRows(filterRows(lista, search), sortCol, sortDir),
    [lista, search, sortCol, sortDir],
  );

  const exportRows = useMemo(
    () =>
      filteredRows.map((row) => ({
        nome: row.nome || "",
        mat: row.mat || "",
        depto: row.depto || "",
        sequencia: fmtSequencia(row.inicio, row.fim),
        dias: Number(row.dias) || 0,
      })),
    [filteredRows],
  );

  const exportXlsx = useCallback(async () => {
    try {
      setExportBusy(true);
      const xlsxMod = await import("xlsx-js-style");
      const XLSX = xlsxMod.default ?? xlsxMod;
      const headers = COLS.map((c) => c.label);
      const body = exportRows.map((row) => COLS.map((c) => row[c.id]));
      const ws = XLSX.utils.aoa_to_sheet([headers, ...body]);
      ws["!cols"] = [{ wch: 28 }, { wch: 12 }, { wch: 24 }, { wch: 18 }, { wch: 8 }];
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, "Faltas consecutivas");
      const fname = `faltas-consecutivas_${fileSlug(dateFrom, dateTo)}_${Date.now()}.xlsx`;
      XLSX.writeFile(wb, fname);
    } catch (err) {
      console.error("[ConsecFaltasModal] export XLSX", err);
    } finally {
      setExportBusy(false);
    }
  }, [exportRows, dateFrom, dateTo]);

  const exportPdf = useCallback(async () => {
    try {
      setExportBusy(true);
      const { jsPDF } = await import("jspdf");
      const { default: autoTable } = await import("jspdf-autotable");
      const doc = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" });
      doc.setFontSize(13);
      doc.text("Faltas consecutivas", 14, 14);
      doc.setFontSize(9);
      doc.setTextColor(100, 100, 120);
      doc.text(periodLabel || "Período selecionado", 14, 20);
      doc.text(`${exportRows.length} colaborador(es) · ${RADAR_HOURS_TOOLTIPS.consec}`, 14, 25);
      doc.setTextColor(0, 0, 0);
      autoTable(doc, {
        head: [COLS.map((c) => c.label)],
        body: exportRows.map((row) => COLS.map((c) => row[c.id])),
        startY: 30,
        styles: { fontSize: 8, cellPadding: 2, overflow: "linebreak" },
        headStyles: { fillColor: [139, 92, 246], textColor: 255, fontStyle: "bold" },
        alternateRowStyles: { fillColor: [248, 245, 255] },
        margin: { left: 14, right: 14 },
      });
      doc.save(`faltas-consecutivas_${fileSlug(dateFrom, dateTo)}_${Date.now()}.pdf`);
    } catch (err) {
      console.error("[ConsecFaltasModal] export PDF", err);
    } finally {
      setExportBusy(false);
    }
  }, [exportRows, periodLabel, dateFrom, dateTo]);

  if (!open || typeof document === "undefined") return null;

  const count = lista.length;
  const countLabel = count === 1 ? "colaborador" : "colaboradores";
  const modalStyle = frame
    ? {
        position: "fixed",
        left: frame.x,
        top: frame.y,
        width: frame.width,
        height: frame.height,
        maxHeight: "none",
      }
    : undefined;

  return (
    <>
      {createPortal(
    <div
      className="pb-cfg-overlay pb-radar-evol-overlay pb-consec-faltas-overlay"
      data-theme={theme}
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose?.();
      }}
    >
      <div
        ref={modalRef}
        className="pb-radar-evol-modal pb-consec-faltas-modal"
        style={modalStyle}
        role="dialog"
        aria-modal="true"
        aria-label="Faltas consecutivas"
        onMouseDown={(e) => e.stopPropagation()}
      >
        <div
          className="pb-radar-evol-head pb-radar-evol-drag-handle pb-consec-faltas-head"
          onPointerDown={(event) => startInteraction(event, "move")}
        >
          <div>
            <span className="pb-radar-evol-kicker">Horas no período</span>
            <h3 className="pb-radar-evol-title">Faltas consecutivas</h3>
            {periodLabel ? <span className="pb-radar-evol-period">{periodLabel}</span> : null}
          </div>
          <button type="button" className="pb-consec-faltas-close" onClick={onClose} aria-label="Fechar">
            ×
          </button>
        </div>

        <div className="pb-radar-evol-kpi pb-consec-faltas-kpi">
          <strong>{count.toLocaleString("pt-BR")}</strong>
          <span className="pb-radar-evol-meta-ref">
            {countLabel} com 2+ faltas injustificadas em dias seguidos
          </span>
        </div>

        <p className="pb-consec-faltas-hint">{RADAR_HOURS_TOOLTIPS.consec}</p>

        <div className="pb-consec-faltas-dates">
          <label className="pb-consec-faltas-date-field">
            <span className="pb-consec-faltas-date-label">De</span>
            <input
              type="date"
              className="pb-consec-faltas-date-inp"
              value={dateFrom}
              min={dateBounds.min || undefined}
              max={dateTo || dateBounds.max || undefined}
              onChange={(e) => setDateFrom(e.target.value)}
              aria-label="Data inicial"
            />
          </label>
          <label className="pb-consec-faltas-date-field">
            <span className="pb-consec-faltas-date-label">Até</span>
            <input
              type="date"
              className="pb-consec-faltas-date-inp"
              value={dateTo}
              min={dateFrom || dateBounds.min || undefined}
              max={dateBounds.max || undefined}
              onChange={(e) => setDateTo(e.target.value)}
              aria-label="Data final"
            />
          </label>
        </div>

        <div className="pb-consec-faltas-toolbar">
          <input
            type="search"
            className="pb-consec-faltas-search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Pesquisar colaborador, matrícula ou departamento…"
            aria-label="Pesquisar colaboradores"
          />
          <div className="pb-consec-faltas-export">
            <button
              type="button"
              className="pb-btn pb-consec-faltas-export-btn"
              disabled={exportBusy || !exportRows.length}
              onClick={exportPdf}
            >
              PDF
            </button>
            <button
              type="button"
              className="pb-btn pb-consec-faltas-export-btn"
              disabled={exportBusy || !exportRows.length}
              onClick={exportXlsx}
            >
              XLSX
            </button>
          </div>
        </div>

        {count > 0 ? (
          <div className="pb-consec-faltas-table-wrap">
            {filteredRows.length > 0 ? (
              <table className="pb-consec-faltas-table">
                <thead>
                  <tr>
                    {COLS.map((col) => {
                      const active = sortCol === col.id;
                      const arrow = active ? (sortDir === "asc" ? " ▲" : " ▼") : "";
                      return (
                        <th key={col.id} className={col.numeric ? "num" : ""}>
                          <button
                            type="button"
                            className={`pb-consec-faltas-th-sort${active ? " is-active" : ""}`}
                            onClick={() => toggleSort(col.id)}
                          >
                            {col.label}
                            {arrow}
                          </button>
                        </th>
                      );
                    })}
                  </tr>
                </thead>
                <tbody>
                  {filteredRows.map((row) => {
                    const isProfileOpen = profileRow?.mat === row.mat;
                    return (
                      <tr key={row.mat} className={isProfileOpen ? "pb-consec-faltas-row--active" : undefined}>
                        <td>
                          <button
                            type="button"
                            className={`pb-consec-faltas-emp-link${isProfileOpen ? " is-active" : ""}`}
                            onClick={() => setProfileRow(row)}
                            title="Ver ficha de presença"
                          >
                            {row.nome}
                          </button>
                        </td>
                        <td>{row.mat}</td>
                        <td>{row.depto}</td>
                        <td>{fmtSequencia(row.inicio, row.fim)}</td>
                        <td className="num">{row.dias}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            ) : (
              <div className="pb-consec-faltas-empty pb-consec-faltas-empty--inline">
                Nenhum resultado para &quot;{search.trim()}&quot;.
              </div>
            )}
          </div>
        ) : (
          <div className="pb-consec-faltas-empty">
            Nenhum colaborador com 2 ou mais faltas consecutivas no período selecionado.
          </div>
        )}

        <div className="pb-consec-faltas-foot">
          <button type="button" className="pb-btn pb-consec-faltas-foot-secondary" onClick={onClose}>
            Fechar
          </button>
        </div>

        <div
          className="pb-radar-evol-resize-handle pb-consec-faltas-resize"
          role="separator"
          aria-label="Redimensionar modal"
          onPointerDown={(event) => startInteraction(event, "resize")}
        />
      </div>
    </div>,
    document.body,
      )}

      <EmpPresenceModal
        open={!!profileRow}
        onClose={() => setProfileRow(null)}
        theme={theme}
        row={profileRow}
        histRows={scopedRows}
        dateFrom={dateFrom}
        dateTo={dateTo}
        periodoApuracao={periodoApuracao}
      />
    </>
  );
}
