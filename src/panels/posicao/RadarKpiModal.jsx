import React, { Suspense, lazy, useCallback, useEffect, useRef, useState, Component } from "react";
import { createPortal } from "react-dom";
import { RADAR_HOURS_TOOLTIPS, RADAR_KPI_TOOLTIPS, buildAbsIndexTooltip } from "./radarKpiTooltips.js";

const RadarPremiumChart = lazy(() =>
  import("./RadarPremiumChart.jsx").then((m) => ({ default: m.RadarPremiumChart })),
);

const RADAR_MODAL_SIZE_KEY = "pb_radar_modal_size_v1";

function loadModalFrame(variant) {
  if (typeof window === "undefined") return null;
  try {
    const sizes = JSON.parse(window.localStorage.getItem(RADAR_MODAL_SIZE_KEY) || "{}");
    const saved = sizes?.[variant];
    if (!saved) return null;
    const maxWidth = window.innerWidth - 16;
    const maxHeight = window.innerHeight - 16;
    const minWidth = Math.min(720, maxWidth);
    const minHeight = Math.min(460, maxHeight);
    const width = Math.max(minWidth, Math.min(maxWidth, Number(saved.width) || maxWidth));
    const height = Math.max(minHeight, Math.min(maxHeight, Number(saved.height) || maxHeight));
    return {
      x: Math.max(8, (window.innerWidth - width) / 2),
      y: Math.max(8, (window.innerHeight - height) / 2),
      width,
      height,
    };
  } catch {
    return null;
  }
}

function saveModalSize(variant, frame) {
  if (typeof window === "undefined" || !frame) return;
  try {
    const sizes = JSON.parse(window.localStorage.getItem(RADAR_MODAL_SIZE_KEY) || "{}");
    sizes[variant] = { width: frame.width, height: frame.height };
    window.localStorage.setItem(RADAR_MODAL_SIZE_KEY, JSON.stringify(sizes));
  } catch {}
}

class RadarChartBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { error: null };
  }

  static getDerivedStateFromError(error) {
    return { error };
  }

  render() {
    if (this.state.error) {
      return (
        <div className="pb-radar-evol-chart-empty">
          Não foi possível exibir o gráfico. Tente fechar e abrir novamente.
        </div>
      );
    }
    return this.props.children;
  }
}

function fmtPctOfPlan(minutes, planMinutes) {
  if (!planMinutes || planMinutes <= 0) return null;
  return `${((minutes / planMinutes) * 100).toFixed(1).replace(".", ",")}% planejadas`;
}

function fmtPctShare(minutes, totalMinutes) {
  if (!totalMinutes || totalMinutes <= 0) return null;
  return `${((minutes / totalMinutes) * 100).toFixed(0)}%`;
}

const VARIANT_META = {
  abs: {
    kicker: "Absenteísmo",
    title: "Evolução no período",
    ariaLabel: "Evolução do absenteísmo",
  },
  work: {
    kicker: "Horas trabalhadas",
    title: "Evolução no período",
    ariaLabel: "Evolução das horas trabalhadas",
  },
  lost: {
    kicker: "Horas perdidas",
    title: "Evolução no período",
    ariaLabel: "Evolução das horas perdidas",
  },
  risk: {
    kicker: "Radar trabalhista",
    title: "Evolução no período",
    ariaLabel: "Evolução das penalidades de risco trabalhista",
  },
};

function HoursComposition({ radar, rows, fmtHM, horasPlan, hoursTotal, compact = false }) {
  const hasHours = rows.some(
    (r) =>
      r.horas_planejadas != null ||
      r.horas_faltas != null ||
      r.horas_atrasos != null ||
      r.horas_justificadas != null ||
      r.horas_extras != null,
  );

  if (!hasHours) {
    return (
      <p className="pb-radar-evol-no-hours">
        Totais em horas indisponíveis para este período — exibindo evolução disponível abaixo.
      </p>
    );
  }

  const totals = [
    { key: "plan", label: "Horas planejadas", value: horasPlan, hint: "Carga prevista", tooltip: RADAR_KPI_TOOLTIPS.plan },
    { key: "injust", label: "Injustificadas", value: Number(radar.horasAus) || 0, hint: "Faltas + atrasos", tooltip: RADAR_HOURS_TOOLTIPS.injust },
    { key: "just", label: "Justificadas", value: Number(radar.horasJust) || 0, hint: "Com justificativa", tooltip: RADAR_HOURS_TOOLTIPS.just },
    { key: "extr", label: "Extras", value: Number(radar.horasExtras) || 0, hint: "Além da jornada", tooltip: RADAR_HOURS_TOOLTIPS.extr },
  ];

  return (
    <div className={compact ? "pb-radar-evol-composition pb-radar-evol-composition--compact" : "pb-radar-evol-composition"}>
      <div className="pb-radar-evol-section-label">Composição do período (horas)</div>
      {hoursTotal > 0 && (
        <div className="pb-radar-evol-stack" aria-hidden="true">
          {totals
            .filter((t) => t.key !== "plan")
            .map((t) =>
            t.value > 0 ? (
              <div
                key={t.key}
                className={`pb-radar-evol-stack-seg pb-radar-evol-stack-seg--${t.key}`}
                style={{ flex: t.value }}
                title={`${t.label}: ${fmtHM(t.value)}`}
              />
            ) : null,
          )}
        </div>
      )}
      <div className="pb-radar-evol-totals">
        {totals.map((t) => (
          <div key={t.key} className={`pb-radar-evol-total pb-radar-evol-total--${t.key}`} title={t.tooltip}>
            <span className="pb-radar-evol-total-label">{t.label}</span>
            <strong>{fmtHM(t.value)}</strong>
            <small>
              {t.key === "plan"
                ? "Referência do período"
                : horasPlan > 0
                  ? fmtPctOfPlan(t.value, horasPlan)
                  : hoursTotal > 0
                    ? `${fmtPctShare(t.value, hoursTotal)} do total`
                    : t.hint}
            </small>
          </div>
        ))}
      </div>
    </div>
  );
}

function KpiHero({ variant, radar, absMeta, fmtHM }) {
  if (variant === "abs") {
    const absPct = Number(radar.absPct) || 0;
    const absDelta = radar.absDelta;
    return (
      <div
        className="pb-radar-evol-kpi"
        title={buildAbsIndexTooltip({
          horasAbs: radar.horasAbs,
          horasPlan: radar.horasPlan,
          absPct,
        })}
      >
        <strong>{absPct.toFixed(1).replace(".", ",")}%</strong>
        {absDelta != null && (
          <span
            className={`pb-radar-delta ${absDelta > 0.5 ? "bad" : absDelta < -0.5 ? "good" : "flat"}`}
          >
            {absDelta > 0 ? "+" : ""}
            {absDelta.toFixed(1).replace(".", ",")}% vs. metade anterior
          </span>
        )}
        <span className="pb-radar-evol-meta-ref">
          Meta ≤ {Number(absMeta).toFixed(1).replace(".", ",")}%
        </span>
      </div>
    );
  }

  if (variant === "work") {
    const horasPres = Number(radar.horasPres) || 0;
    const horasPlan = Number(radar.horasPlan) || 0;
    const trabDelta = radar.trabDelta;
    const utilPct = horasPlan > 0 ? (horasPres / horasPlan) * 100 : null;
    return (
      <div className="pb-radar-evol-kpi pb-radar-evol-kpi--hours" title={RADAR_KPI_TOOLTIPS.work}>
        <strong>{fmtHM(horasPres)}</strong>
        {trabDelta != null && (
          <span
            className={`pb-radar-delta ${trabDelta > 0.5 ? "good" : trabDelta < -0.5 ? "bad" : "flat"}`}
          >
            {trabDelta > 0 ? "+" : ""}
            {trabDelta.toFixed(1).replace(".", ",")}% vs. metade anterior
          </span>
        )}
        {utilPct != null && (
          <span className="pb-radar-evol-meta-ref">
            {utilPct.toFixed(1).replace(".", ",")}% planejadas
          </span>
        )}
      </div>
    );
  }

  const horasPerdidas = Number(radar.horasPerdidas) || 0;
  const perdaPct = Number(radar.perdaPct) || 0;
  const perdaDelta = radar.perdaDelta;
  return (
    <div className="pb-radar-evol-kpi pb-radar-evol-kpi--hours" title={RADAR_KPI_TOOLTIPS.lost}>
      <strong>{fmtHM(horasPerdidas)}</strong>
      {perdaDelta != null && (
        <span
          className={`pb-radar-delta ${perdaDelta > 0.5 ? "bad" : perdaDelta < -0.5 ? "good" : "flat"}`}
        >
          {perdaDelta > 0 ? "+" : ""}
          {perdaDelta.toFixed(1).replace(".", ",")}% vs. metade anterior
        </span>
      )}
      <span className="pb-radar-evol-meta-ref">{perdaPct.toFixed(1).replace(".", ",")}% planejadas</span>
    </div>
  );
}

export function RadarKpiModal({
  open,
  variant = "abs",
  onClose,
  theme = "dark",
  histRowsAll = [],
  histRadar: histRadarProp,
  absMeta = 5,
  periodLabel = "",
  fmtHMReadable,
  faltDays = 30,
  setFaltDays,
  customPeriod = false,
  periodoApuracao = null,
  onSelectAbsDay,
  contextLabel = "",
}) {
  const [modalRadar, setModalRadar] = useState(histRadarProp || {});
  const [modalRows, setModalRows] = useState([]);
  const [frame, setFrame] = useState(null);
  const [exportOpen, setExportOpen] = useState(false);
  const [exportBusy, setExportBusy] = useState(false);
  const [exportResult, setExportResult] = useState(null);
  const [exportError, setExportError] = useState("");
  const [exportPreviewOpen, setExportPreviewOpen] = useState(false);
  const modalRef = useRef(null);
  const interactionRef = useRef(null);
  const wasOpenRef = useRef(false);
  const exportRef = useRef(null);

  useEffect(() => {
    if (open) {
      setModalRadar(histRadarProp || {});
      setModalRows(Array.isArray(histRowsAll) ? histRowsAll : []);
      setExportOpen(false);
      setExportResult(null);
      setExportError("");
      setExportPreviewOpen(false);
    }
  }, [open, histRadarProp, histRowsAll]);

  useEffect(() => {
    if (open && !wasOpenRef.current) setFrame(loadModalFrame(variant));
    wasOpenRef.current = open;
  }, [open, variant]);

  useEffect(() => {
    if (!exportOpen) return undefined;
    const closeExport = (event) => {
      if (exportRef.current && !exportRef.current.contains(event.target)) setExportOpen(false);
    };
    document.addEventListener("mousedown", closeExport);
    return () => document.removeEventListener("mousedown", closeExport);
  }, [exportOpen]);

  useEffect(
    () => () => {
      if (exportResult?.url) URL.revokeObjectURL(exportResult.url);
    },
    [exportResult],
  );

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
        const minWidth = Math.min(720, viewportWidth - 16);
        const minHeight = Math.min(460, viewportHeight - 16);
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
      if (action?.kind === "resize") saveModalSize(action.variant, action.latestFrame || action.frame);
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
      variant,
    };
    document.body.classList.add("pb-radar-evol-interacting");
    event.preventDefault();
  }, [variant]);

  const onRadarChange = useCallback((radar, rows) => {
    setModalRadar(radar);
    setModalRows(rows);
  }, []);

  const captureModal = async () => {
    const element = modalRef.current;
    if (!element) return null;
    setExportOpen(false);
    const expandedDetails = Array.from(element.querySelectorAll("details[open]"));
    expandedDetails.forEach((details) => {
      details.open = false;
    });
    element.classList.add("pb-radar-evol-export-capture");
    try {
      await new Promise((resolve) => window.requestAnimationFrame(resolve));
      const { default: html2canvas } = await import("html2canvas");
      return await html2canvas(element, {
        backgroundColor: theme === "dark" ? "#0f172a" : "#ffffff",
        scale: Math.min(2, window.devicePixelRatio || 1.5),
        useCORS: true,
        logging: false,
        onclone: (clonedDocument) => {
          clonedDocument.querySelectorAll(".pb-abs-method, .pb-abs-hover-tooltip").forEach((node) => {
            node.style.setProperty("display", "none", "important");
          });
        },
      });
    } finally {
      element.classList.remove("pb-radar-evol-export-capture");
      expandedDetails.forEach((details) => {
        details.open = true;
      });
    }
  };

  const publishExport = (blob, filename, mimeType) => {
    const url = URL.createObjectURL(blob);
    setExportResult({ url, filename, mimeType });
    setExportPreviewOpen(true);
    const link = document.createElement("a");
    link.download = filename;
    link.href = url;
    document.body.appendChild(link);
    link.click();
    link.remove();
  };

  const exportImage = async () => {
    try {
      setExportBusy(true);
      setExportError("");
      const canvas = await captureModal();
      if (!canvas) return;
      const blob = await new Promise((resolve) => canvas.toBlob(resolve, "image/png"));
      if (!blob) throw new Error("Não foi possível gerar a imagem.");
      publishExport(blob, `absenteismo-evolucao-${Date.now()}.png`, "image/png");
    } catch {
      setExportError("Falha ao gerar imagem.");
    } finally {
      setExportBusy(false);
    }
  };

  const exportPdf = async () => {
    try {
      setExportBusy(true);
      setExportError("");
      const canvas = await captureModal();
      if (!canvas) return;
      const { jsPDF } = await import("jspdf");
      const orientation = canvas.width > canvas.height ? "landscape" : "portrait";
      const doc = new jsPDF({ orientation, unit: "pt", format: "a4" });
      const pageWidth = doc.internal.pageSize.getWidth();
      const pageHeight = doc.internal.pageSize.getHeight();
      const scale = Math.min(pageWidth / canvas.width, pageHeight / canvas.height);
      const width = canvas.width * scale;
      const height = canvas.height * scale;
      doc.addImage(canvas.toDataURL("image/png"), "PNG", (pageWidth - width) / 2, (pageHeight - height) / 2, width, height);
      publishExport(doc.output("blob"), `absenteismo-evolucao-${Date.now()}.pdf`, "application/pdf");
    } catch {
      setExportError("Falha ao gerar PDF.");
    } finally {
      setExportBusy(false);
    }
  };

  if (!open || typeof document === "undefined") return null;

  const meta = VARIANT_META[variant] || VARIANT_META.abs;
  const radar = modalRadar || {};
  const rows = modalRows.length ? modalRows : histRowsAll;
  const horasPlan = Number(radar.horasPlan) || 0;
  const hoursTotal =
    (Number(radar.horasAus) || 0) +
    (Number(radar.horasJust) || 0) +
    (Number(radar.horasExtras) || 0);
  const fmtHM = fmtHMReadable || ((m) => String(m));
  const isDark = theme === "dark";
  const isAbs = variant === "abs";
  const isRisk = variant === "risk";
  const compactHead = isAbs || isRisk;

  return createPortal(
    <div
      className="pb-cfg-overlay pb-radar-evol-overlay pb-radar-evol-overlay--premium"
      data-theme={theme}
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose?.();
      }}
    >
      <div
        ref={modalRef}
        className={`pb-radar-evol-modal pb-radar-evol-modal--premium${isAbs ? " pb-radar-evol-modal--abs" : ""}${isRisk ? " pb-radar-evol-modal--risk" : ""}`}
        style={
          frame
            ? {
                position: "fixed",
                left: frame.x,
                top: frame.y,
                width: frame.width,
                height: frame.height,
                maxHeight: "none",
              }
            : undefined
        }
        data-dark={isDark}
        role="dialog"
        aria-label={meta.ariaLabel}
        onMouseDown={(e) => e.stopPropagation()}
      >
        <div
          className={`pb-radar-evol-head pb-radar-evol-drag-handle${compactHead ? " pb-radar-evol-head--compact" : ""}`}
          onPointerDown={(event) => startInteraction(event, "move")}
        >
          <div>
            {compactHead ? (
              <h3 className="pb-radar-evol-title pb-radar-evol-title--inline">
                {meta.kicker} · {meta.title}
              </h3>
            ) : (
              <>
                <span className="pb-radar-evol-kicker">{meta.kicker}</span>
                <h3 className="pb-radar-evol-title">{meta.title}</h3>
              </>
            )}
            {periodLabel ? <span className="pb-radar-evol-period">{periodLabel}</span> : null}
            {contextLabel ? <span className="pb-radar-evol-context">{contextLabel}</span> : null}
          </div>
          <div className="pb-radar-evol-head-actions" onPointerDown={(e) => e.stopPropagation()} data-html2canvas-ignore="true">
            <div className="pb-radar-evol-export" ref={exportRef}>
              <button
                type="button"
                className={`pb-radar-evol-export-btn${exportOpen ? " is-active" : ""}`}
                onClick={() => {
                  setExportResult(null);
                  setExportError("");
                  setExportPreviewOpen(false);
                  setExportOpen((current) => !current);
                }}
                aria-label="Exportar"
                title="Exportar"
                disabled={exportBusy}
              >
                <svg viewBox="0 0 24 24" aria-hidden="true">
                  <path d="M12 3v11m0 0 4-4m-4 4-4-4M4 16v4h16v-4" />
                </svg>
              </button>
              {exportOpen && (
                <div className="pb-radar-evol-export-pop">
                  <button type="button" onClick={exportPdf}>PDF</button>
                  <button type="button" onClick={exportImage}>Imagem</button>
                </div>
              )}
              {!exportOpen && (exportResult || exportError) && (
                <div className={`pb-radar-evol-export-result${exportError ? " is-error" : ""}`} data-html2canvas-ignore="true">
                  {exportError ? (
                    <span>{exportError}</span>
                  ) : (
                    <>
                      <span>Arquivo pronto</span>
                      <button type="button" className="pb-radar-evol-preview-btn" onClick={() => setExportPreviewOpen(true)}>Visualizar</button>
                      <a href={exportResult.url} download={exportResult.filename}>Baixar</a>
                    </>
                  )}
                  <button
                    type="button"
                    aria-label="Fechar retorno da exportação"
                    onClick={() => {
                      setExportResult(null);
                      setExportError("");
                      setExportPreviewOpen(false);
                    }}
                  >
                    ×
                  </button>
                </div>
              )}
            </div>
            <button type="button" className="pb-cfg-close" onPointerDown={(e) => e.stopPropagation()} onClick={onClose} aria-label="Fechar">
              ×
            </button>
          </div>
        </div>

        {exportPreviewOpen && exportResult && (
          <div className="pb-radar-evol-export-preview" data-html2canvas-ignore="true">
            <div className="pb-radar-evol-export-preview-head">
              <strong>{exportResult.filename}</strong>
              <button type="button" onClick={() => setExportPreviewOpen(false)} aria-label="Fechar visualização">×</button>
            </div>
            {exportResult.mimeType === "application/pdf" ? (
              <iframe title="Pré-visualização do PDF exportado" src={exportResult.url} />
            ) : (
              <img src={exportResult.url} alt="Pré-visualização da imagem exportada" />
            )}
          </div>
        )}

        {!isAbs && !isRisk && <KpiHero variant={variant} radar={radar} absMeta={absMeta} fmtHM={fmtHM} />}

        {!isAbs && !isRisk && (
        <HoursComposition
          radar={radar}
          rows={rows}
          fmtHM={fmtHM}
          horasPlan={horasPlan}
          hoursTotal={hoursTotal}
          compact={isAbs}
        />
        )}

        <div className="pb-radar-evol-premium-slot">
          <RadarChartBoundary>
            <Suspense fallback={<div className="pb-radar-evol-chart-empty">Carregando gráfico…</div>}>
              <RadarPremiumChart
                histRows={histRowsAll}
                isDark={isDark}
                fmtHMReadable={fmtHM}
                faltDays={faltDays}
                setFaltDays={setFaltDays}
                customPeriod={customPeriod}
                periodoApuracao={periodoApuracao}
                onRadarChange={onRadarChange}
                variant={variant}
                absMeta={absMeta}
                onSelectAbsDay={onSelectAbsDay}
              />
            </Suspense>
          </RadarChartBoundary>
        </div>
        <div
          className="pb-radar-evol-resize-handle"
          data-html2canvas-ignore="true"
          role="separator"
          aria-label="Redimensionar gráfico"
          onPointerDown={(event) => startInteraction(event, "resize")}
        />
      </div>
    </div>,
    document.body,
  );
}

export const RadarAbsModal = RadarKpiModal;
