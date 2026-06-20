import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import {
  buildEmpCalendarWeeks,
  buildEmpTimeline,
  buildRecentDayRecords,
  computeEmpViewStats,
  EMP_PRESENCE_PRESET_ATUAL,
  EMP_PRESENCE_PRESETS,
  fmtShortDate,
  resolveEmpPresenceRange,
  TIMELINE_LEGEND,
  TIMELINE_LEGEND_DRILL,
} from "./consecFaltasTimeline.js";

const FRAME_LS_KEY = "pb_emp_presence_modal_v1";

function statusLabel(status) {
  return TIMELINE_LEGEND.find((item) => item.status === status)?.label || status;
}

function defaultFrame() {
  if (typeof window === "undefined") return null;
  const width = Math.min(540, window.innerWidth - 32);
  const height = Math.min(680, window.innerHeight - 32);
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
    const minWidth = Math.min(420, maxWidth);
    const minHeight = Math.min(420, maxHeight);
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

function fileSlug(mat, dateFrom, dateTo) {
  const from = String(dateFrom || "").replace(/-/g, "");
  const to = String(dateTo || "").replace(/-/g, "");
  return `${String(mat || "emp").replace(/\W+/g, "")}_${from}_${to}`;
}

function MarcBadges({ marcacoes }) {
  if (!marcacoes?.length) {
    return <span className="pb-emp-presence-punch-empty">Sem marcações</span>;
  }
  return marcacoes.map((m, idx) => (
    <span key={`${m?.time || idx}`} className={`pb-emp-presence-punch ${m?.ok ? "is-ok" : "is-fail"}`}>
      {m?.time || "--:--"}
    </span>
  ));
}

function PresenceLegend() {
  return (
    <div className="pb-emp-presence-legend" aria-hidden="true">
      {TIMELINE_LEGEND_DRILL.map((item) => (
        <span key={item.status} className="pb-emp-presence-legend-item">
          <i className={`pb-emp-presence-swatch pb-emp-presence-swatch--${item.status}`} />
          {item.label}
        </span>
      ))}
      <span className="pb-emp-presence-legend-item">
        <i className="pb-emp-presence-swatch pb-emp-presence-swatch--streak" />
        Sequência alertada
      </span>
    </div>
  );
}

export function EmpPresenceModal({
  open,
  onClose,
  theme = "dark",
  row,
  histRows = [],
  dateFrom = "",
  dateTo = "",
  periodoApuracao = null,
}) {
  const modalRef = useRef(null);
  const interactionRef = useRef(null);
  const wasOpenRef = useRef(false);
  const [frame, setFrame] = useState(null);
  const [presetDays, setPresetDays] = useState(EMP_PRESENCE_PRESET_ATUAL);
  const [exportBusy, setExportBusy] = useState(false);

  useEffect(() => {
    if (open && !wasOpenRef.current) setFrame(loadFrame());
    if (open) setPresetDays(EMP_PRESENCE_PRESET_ATUAL);
    wasOpenRef.current = open;
  }, [open, row?.mat]);

  useEffect(() => {
    if (!open) return undefined;
    const onKey = (e) => {
      if (e.key === "Escape") {
        e.stopPropagation();
        onClose?.();
      }
    };
    document.addEventListener("keydown", onKey, true);
    return () => document.removeEventListener("keydown", onKey, true);
  }, [open, onClose]);

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
        const minWidth = Math.min(420, viewportWidth - 16);
        const minHeight = Math.min(420, viewportHeight - 16);
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
    if (kind === "move" && event.target.closest("button, a, input, .pb-emp-presence-close")) return;
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

  const { dateFrom: effectiveFrom, dateTo: effectiveTo } = useMemo(
    () => resolveEmpPresenceRange(presetDays, periodoApuracao, dateFrom, dateTo, histRows),
    [presetDays, periodoApuracao, dateFrom, dateTo, histRows],
  );

  const stats = useMemo(
    () =>
      row ? computeEmpViewStats(histRows, row.mat, effectiveFrom, effectiveTo, row.nome) : null,
    [histRows, row, effectiveFrom, effectiveTo],
  );

  const timeline = useMemo(() => {
    if (!row) return { days: [] };
    return buildEmpTimeline({
      mat: row.mat,
      nome: row.nome,
      dateFrom: effectiveFrom,
      dateTo: effectiveTo,
      histRows,
      streakInicio: row.inicio,
      streakFim: row.fim,
    });
  }, [row, effectiveFrom, effectiveTo, histRows]);

  const { weeks, dowHeaders } = useMemo(
    () => buildEmpCalendarWeeks(timeline.days),
    [timeline.days],
  );

  const recentDays = useMemo(
    () => buildRecentDayRecords(timeline.days, { limit: 8 }),
    [timeline.days],
  );

  const periodLabel = `${fmtShortDate(effectiveFrom)} – ${fmtShortDate(effectiveTo)}`;
  const mapRangeLabel =
    timeline.focused && timeline.totalDays > timeline.days.length
      ? `${fmtShortDate(timeline.viewFrom)} – ${fmtShortDate(timeline.viewTo)}`
      : periodLabel;
  const mapRangeHint =
    timeline.focused && timeline.totalDays > timeline.days.length
      ? timeline.activityFocused
        ? ` · zoom nos dias com registro (${timeline.totalDays} no período)`
        : ` · zoom nos últimos ${timeline.days.length} dias (${timeline.totalDays} no período)`
      : "";
  const presetLabel =
    presetDays === EMP_PRESENCE_PRESET_ATUAL ? "Período atual" : `${presetDays}d`;

  const exportPdf = useCallback(async () => {
    if (!row || !stats) return;
    try {
      setExportBusy(true);
      const { jsPDF } = await import("jspdf");
      const { default: autoTable } = await import("jspdf-autotable");
      const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
      doc.setFontSize(14);
      doc.text("Ficha de presença", 14, 16);
      doc.setFontSize(10);
      doc.setTextColor(80, 80, 100);
      doc.text(String(row.nome || "—"), 14, 23);
      doc.text(`Matrícula: ${row.mat || "—"} · ${row.depto || "—"}`, 14, 28);
      doc.text(`Período (${presetLabel}): ${periodLabel}`, 14, 33);
      doc.setTextColor(0, 0, 0);

      autoTable(doc, {
        head: [["Indicador", "Valor"]],
        body: [
          ["Presenças", String(stats.presencas)],
          ["Faltas", String(stats.faltas)],
          ["Atrasos", stats.atrasosMin ? `${stats.atrasosMin} min` : "0"],
          ["Frequência", stats.freqPct != null ? `${stats.freqPct}%` : "—"],
          ["Índice de absenteísmo", stats.absPct != null ? `${stats.absPct.toFixed(1).replace(".", ",")}%` : "—"],
        ],
        startY: 38,
        styles: { fontSize: 9, cellPadding: 2.5 },
        headStyles: { fillColor: [59, 130, 246], textColor: 255, fontStyle: "bold" },
        margin: { left: 14, right: 14 },
      });

      const startRecordsY = (doc.lastAutoTable?.finalY || 80) + 8;
      doc.setFontSize(10);
      doc.text("Últimos registros", 14, startRecordsY);

      autoTable(doc, {
        head: [["Data", "Status", "Marcações"]],
        body: recentDays.length
          ? recentDays.map((day) => [
              fmtShortDate(day.date),
              statusLabel(day.status),
              day.marcacoes?.length
                ? day.marcacoes.map((m) => m?.time).filter(Boolean).join(" · ")
                : "—",
            ])
          : [["—", "Sem registros no período", "—"]],
        startY: startRecordsY + 4,
        styles: { fontSize: 8, cellPadding: 2, overflow: "linebreak" },
        headStyles: { fillColor: [100, 116, 139], textColor: 255, fontStyle: "bold" },
        margin: { left: 14, right: 14 },
      });

      doc.save(`ficha-presenca_${fileSlug(row.mat, effectiveFrom, effectiveTo)}_${Date.now()}.pdf`);
    } catch (err) {
      console.error("[EmpPresenceModal] export PDF", err);
    } finally {
      setExportBusy(false);
    }
  }, [row, stats, presetLabel, periodLabel, recentDays, effectiveFrom, effectiveTo]);

  if (!open || !row || typeof document === "undefined") return null;

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

  return createPortal(
    <div
      className="pb-cfg-overlay pb-emp-presence-overlay"
      data-theme={theme}
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose?.();
      }}
    >
      <div
        ref={modalRef}
        className="pb-emp-presence-modal"
        style={modalStyle}
        role="dialog"
        aria-modal="true"
        aria-label={`Ficha de presença — ${row.nome}`}
        onMouseDown={(e) => e.stopPropagation()}
      >
        <div
          className="pb-emp-presence-head pb-emp-presence-drag-handle"
          onPointerDown={(event) => startInteraction(event, "move")}
        >
          <div className="pb-emp-presence-head-main">
            <span className="pb-emp-presence-status-dot" aria-hidden="true" />
            <div>
              <h3>{row.nome}</h3>
              <span>
                {row.mat} · {row.depto || "—"}
              </span>
            </div>
          </div>
          <div className="pb-emp-presence-head-actions">
            <button
              type="button"
              className="pb-btn pb-emp-presence-export-btn"
              disabled={exportBusy}
              onClick={exportPdf}
            >
              PDF
            </button>
            <button type="button" className="pb-emp-presence-close" onClick={onClose} aria-label="Fechar">
              ×
            </button>
          </div>
        </div>

        <div className="pb-emp-presence-body">
          <div className="pb-emp-presence-presets" role="group" aria-label="Período de análise">
            <button
              type="button"
              className={`pb-emp-presence-preset${presetDays === EMP_PRESENCE_PRESET_ATUAL ? " is-active" : ""}`}
              onClick={() => setPresetDays(EMP_PRESENCE_PRESET_ATUAL)}
              title="Período de apuração"
            >
              Período atual
            </button>
            {EMP_PRESENCE_PRESETS.map((daysOpt) => (
              <button
                key={daysOpt}
                type="button"
                className={`pb-emp-presence-preset${presetDays === daysOpt ? " is-active" : ""}`}
                onClick={() => setPresetDays(daysOpt)}
              >
                {daysOpt}d
              </button>
            ))}
          </div>

          <div className="pb-emp-presence-kpis" aria-label="Indicadores do período">
            <div className="pb-emp-presence-kpi pb-emp-presence-kpi--pres">
              <span>Presenças</span>
              <strong>{stats?.presencas ?? 0}</strong>
            </div>
            <div className="pb-emp-presence-kpi pb-emp-presence-kpi--falt">
              <span>Faltas</span>
              <strong>{stats?.faltas ?? 0}</strong>
            </div>
            <div className="pb-emp-presence-kpi pb-emp-presence-kpi--atr">
              <span>Atrasos</span>
              <strong>{stats?.atrasosMin ? `${stats.atrasosMin}min` : "0"}</strong>
            </div>
            <div className="pb-emp-presence-kpi pb-emp-presence-kpi--freq">
              <span>Freq.</span>
              <strong>{stats?.freqPct != null ? `${stats.freqPct}%` : "—"}</strong>
            </div>
            <div className="pb-emp-presence-kpi pb-emp-presence-kpi--abs">
              <span>Absenteísmo</span>
              <strong>
                {stats?.absPct != null ? `${stats.absPct.toFixed(1).replace(".", ",")}%` : "—"}
              </strong>
            </div>
          </div>

          <div className="pb-emp-presence-map-section">
            <div className="pb-emp-presence-map-head">
              Mapa de presença ({presetLabel}) · {mapRangeLabel}
              {mapRangeHint}
            </div>
            <PresenceLegend />
            <div className="pb-emp-presence-calendar" role="img" aria-label={`Mapa de presença de ${row.nome}`}>
              <div className="pb-emp-presence-calendar-dow">
                {dowHeaders.map((label) => (
                  <span key={label}>{label}</span>
                ))}
              </div>
              {weeks.map((week, wi) => (
                <div key={wi} className="pb-emp-presence-calendar-week">
                  {week.map((day, di) =>
                    day ? (
                      <span
                        key={day.date}
                        className={`pb-emp-presence-cell pb-emp-presence-cell--${day.status}${day.inStreak ? " is-streak" : ""}${day.isolatedFalta ? " is-isolated-falta" : ""}`}
                        title={day.title}
                      />
                    ) : (
                      <span key={`empty-${wi}-${di}`} className="pb-emp-presence-cell pb-emp-presence-cell--pad" />
                    ),
                  )}
                </div>
              ))}
            </div>
          </div>

          <div className="pb-emp-presence-records">
            <div className="pb-emp-presence-records-head">Últimos registros</div>
            {recentDays.length ? (
              <ul className="pb-emp-presence-records-list">
                {recentDays.map((day) => (
                  <li key={day.date} className="pb-emp-presence-records-item">
                    <span className="pb-emp-presence-records-dot" aria-hidden="true" />
                    <div className="pb-emp-presence-records-body">
                      <div className="pb-emp-presence-records-meta">
                        <strong>{fmtShortDate(day.date)}</strong>
                        <span>{statusLabel(day.status)}</span>
                      </div>
                      <div className="pb-emp-presence-records-punches">
                        <MarcBadges marcacoes={day.marcacoes} />
                      </div>
                    </div>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="pb-emp-presence-records-empty">Nenhum registro no período selecionado.</p>
            )}
          </div>
        </div>

        <div
          className="pb-radar-evol-resize-handle pb-emp-presence-resize"
          role="separator"
          aria-label="Redimensionar modal"
          onPointerDown={(event) => startInteraction(event, "resize")}
        />
      </div>
    </div>,
    document.body,
  );
}
