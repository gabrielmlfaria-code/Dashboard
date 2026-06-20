import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  AlertCircle,
  AlertTriangle,
  BookOpen,
  Building2,
  Calendar,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Clock,
  Info,
  Shield,
  TrendingUp,
  Upload,
  XCircle,
} from "lucide-react";
import { Badge } from "../../../components/ui/badge.tsx";
import { Toast } from "../../../core/toast.js";
import { getValidityStatus } from "../posicaoCctValidity.js";
import {
  clearAllCctDocuments,
  createCctBlobUrl,
  getCctById,
  importCctPdfFiles,
  loadCctIndex,
  removeCctDocument,
  reprocessCctWithOcr,
  updateCctLabel,
} from "../posicaoCctStorage.js";

function notify(msg, type = "i", dur = 5000) {
  Toast.show(msg, type, dur);
}

function VigenciaBadge({ validUntil }) {
  const { status, daysLeft } = getValidityStatus(validUntil);
  if (status === "expirada") {
    const n = Math.abs(daysLeft ?? 0);
    return (
      <Badge className="rt-cct-badge rt-cct-badge--err gap-1">
        <XCircle className="h-3 w-3" />
        Expirada há {n} dia{n !== 1 ? "s" : ""}
      </Badge>
    );
  }
  if (status === "vencendo") {
    return (
      <Badge className="rt-cct-badge rt-cct-badge--warn gap-1">
        <AlertCircle className="h-3 w-3" />
        {daysLeft === 0 ? "Vence hoje" : `Vence em ${daysLeft} dia${daysLeft !== 1 ? "s" : ""}`}
      </Badge>
    );
  }
  if (status === "vigente") {
    return (
      <Badge className="rt-cct-badge rt-cct-badge--ok gap-1">
        <CheckCircle2 className="h-3 w-3" />
        Vigente — {daysLeft} dias
      </Badge>
    );
  }
  return (
    <Badge variant="outline" className="rt-cct-badge rt-cct-badge--muted gap-1">
      <Calendar className="h-3 w-3" />
      Sem data
    </Badge>
  );
}

function StatusBadge({ status }) {
  if (status === "analyzed")
    return (
      <Badge className="rt-cct-badge rt-cct-badge--ok gap-1">
        <CheckCircle2 className="h-3 w-3" />
        Analisado
      </Badge>
    );
  if (status === "pending")
    return (
      <Badge className="rt-cct-badge rt-cct-badge--warn gap-1 rt-cct-badge--pulse">
        <Clock className="h-3 w-3" />
        Analisando…
      </Badge>
    );
  if (status === "error")
    return (
      <Badge className="rt-cct-badge rt-cct-badge--err gap-1">
        <XCircle className="h-3 w-3" />
        Erro
      </Badge>
    );
  return <Badge variant="outline">{status || "—"}</Badge>;
}

function DataRow({ label, value }) {
  if (value == null || value === "") return null;
  return (
    <div className="rt-cct-data-row">
      <span className="rt-cct-data-label">{label}</span>
      <span className="rt-cct-data-value">{value}</span>
    </div>
  );
}

function DataCard({ title, icon, children }) {
  return (
    <div className="rt-card rt-cct-data-card">
      <div className="rt-cct-data-card-title">
        {icon}
        <span>{title}</span>
      </div>
      <div className="rt-cct-data-card-body">{children}</div>
    </div>
  );
}

function AnalysisPanel({ id, refreshKey }) {
  const [doc, setDoc] = useState(null);
  const [expanded, setExpanded] = useState({});
  const [ocrBusy, setOcrBusy] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const row = await getCctById(id);
      if (!cancelled) setDoc(row);
    })();
    return () => {
      cancelled = true;
    };
  }, [id, refreshKey]);

  useEffect(() => {
    if (doc?.status !== "pending" && doc?.ocrStatus !== "running") return undefined;
    const t = setInterval(async () => {
      const row = await getCctById(id);
      setDoc(row);
    }, 2500);
    return () => clearInterval(t);
  }, [id, doc?.status, doc?.ocrStatus]);

  const runOcr = async () => {
    setOcrBusy(true);
    try {
      const res = await reprocessCctWithOcr(id);
      if (res.ok && res.textChars > 0) {
        notify(`OCR concluído — ${res.textChars.toLocaleString("pt-BR")} caracteres extraídos.`, "s", 8000);
      } else if (res.ok) {
        notify("OCR concluído, mas pouco texto foi reconhecido. Revise o PDF ou preencha a cláusula manual no playbook.", "w", 8000);
      } else {
        notify(res.error || "Falha no OCR", "e");
      }
      const row = await getCctById(id);
      setDoc(row);
    } finally {
      setOcrBusy(false);
    }
  };

  if (!doc) {
    return <div className="rt-cct-analysis-empty">Carregando…</div>;
  }

  if (doc.status === "pending") {
    const ocrMsg =
      doc.ocrStatus === "running"
        ? "Extraindo texto por OCR (PDF digitalizado). Pode levar vários minutos na primeira vez — não feche a aba."
        : "Análise em andamento. Aguarde alguns instantes.";
    return <div className="rt-cct-analysis-empty">{ocrMsg}</div>;
  }

  const a = doc.analysisResult;
  if (!a) {
    return <div className="rt-cct-analysis-empty">Análise não disponível.</div>;
  }

  const toggle = (key) => setExpanded((p) => ({ ...p, [key]: !p[key] }));

  return (
    <div className="rt-cct-analysis">
      <div className="rt-card rt-cct-summary">
        <p className="rt-cct-summary-text">{a.summary}</p>
        <div className="rt-cct-summary-meta">
          {a.validityPeriod ? (
            <span>
              <Calendar className="h-3 w-3" />
              {a.validityPeriod}
            </span>
          ) : null}
          {a.parties ? (
            <span>
              <Building2 className="h-3 w-3" />
              {a.parties}
            </span>
          ) : null}
        </div>
      </div>

      {doc.isScanned && !doc.ocrApplied ? (
        <div className="rt-cct-ocr-prompt rt-card">
          <p>
            PDF sem camada de texto. Use <strong>Extrair com OCR</strong> para preencher intervalos,
            horas extras e demais cláusulas automaticamente (português, no navegador).
          </p>
          <button
            type="button"
            className="rt-btn rt-btn--primary"
            disabled={ocrBusy}
            onClick={runOcr}
          >
            {ocrBusy ? "OCR em andamento…" : "Extrair com OCR"}
          </button>
        </div>
      ) : null}
      {doc.ocrApplied ? (
        <p className="rt-cct-ocr-ok">
          Texto extraído por OCR ({doc.textChars?.toLocaleString("pt-BR") || 0} caracteres). Confira
          no playbook do evento e valide no PDF.
        </p>
      ) : null}

      {a.alerts?.length > 0 ? (
        <div className="rt-cct-alerts">
          <h4 className="rt-cct-alerts-title">Pontos de atenção para o sistema de ponto</h4>
          {a.alerts.map((al, i) => (
            <div
              key={i}
              className={`rt-cct-alert rt-cct-alert--${al.severity === "alto" ? "high" : al.severity === "medio" ? "med" : "low"}`}
            >
              <AlertTriangle className="h-4 w-4 shrink-0" />
              <div>
                <p className="rt-cct-alert-title">{al.title}</p>
                <p className="rt-cct-alert-desc">{al.description}</p>
              </div>
            </div>
          ))}
        </div>
      ) : null}

      <div className="rt-cct-grid">
        <DataCard title="Jornada de Trabalho" icon={<Clock className="h-4 w-4" />}>
          <DataRow
            label="Horas diárias"
            value={a.workingHours?.dailyHours != null ? `${a.workingHours.dailyHours}h` : null}
          />
          <DataRow
            label="Horas semanais"
            value={a.workingHours?.weeklyHours != null ? `${a.workingHours.weeklyHours}h` : null}
          />
          <DataRow
            label="Banco de horas"
            value={
              a.workingHours?.bankOfHours != null
                ? a.workingHours.bankOfHours
                  ? "Sim"
                  : "Não"
                : null
            }
          />
          {a.workingHours?.bankOfHoursDetails ? (
            <p className="rt-cct-hint">{a.workingHours.bankOfHoursDetails}</p>
          ) : null}
        </DataCard>

        <DataCard title="Horas Extras" icon={<TrendingUp className="h-4 w-4" />}>
          <DataRow
            label="Adicional"
            value={
              a.overtime?.additionalPercentage != null
                ? `${a.overtime.additionalPercentage}%`
                : null
            }
          />
          <DataRow
            label="Domingos/feriados"
            value={
              a.overtime?.sundayPercentage != null ? `${a.overtime.sundayPercentage}%` : null
            }
          />
          <DataRow
            label="Limite diário"
            value={a.overtime?.dailyLimit != null ? `${a.overtime.dailyLimit}h` : null}
          />
        </DataCard>

        <DataCard title="Intervalos" icon={<Info className="h-4 w-4" />}>
          <DataRow
            label="Refeição"
            value={
              a.breaks?.mealBreakMinutes != null ? `${a.breaks.mealBreakMinutes} min` : null
            }
          />
          <DataRow
            label="Interjornada"
            value={
              a.breaks?.interjourneyHours != null ? `${a.breaks.interjourneyHours}h` : null
            }
          />
        </DataCard>

        <DataCard title="Controle de Ponto" icon={<Shield className="h-4 w-4" />}>
          <DataRow label="Método" value={a.timeTracking?.method} />
          <DataRow
            label="REP obrigatório"
            value={
              a.timeTracking?.repRequired != null
                ? a.timeTracking.repRequired
                  ? "Sim"
                  : "Não"
                : null
            }
          />
        </DataCard>
      </div>

      <button type="button" className="rt-cct-derived-toggle" onClick={() => toggle("legal")}>
        {expanded.legal ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
        <BookOpen className="h-4 w-4" />
        Validar cláusulas no PDF original
      </button>
      {expanded.legal ? (
        <p className="rt-cct-hint">
          Valores numéricos só são preenchidos quando extraídos do texto. Para CCT digitalizada,
          use o botão <strong>Abrir PDF</strong> na lista.
        </p>
      ) : null}
    </div>
  );
}

/** Gestão de CCT — UI alinhada ao módulo de referência (upload + análise + vigência). */
export function RadarCctView({ onCountChange, fileInputId = "pb-cct-file-input" }) {
  const dropRef = useRef(null);
  const [busy, setBusy] = useState(false);
  const [list, setList] = useState([]);
  const [selectedId, setSelectedId] = useState(null);
  const [refreshKey, setRefreshKey] = useState(0);

  const refresh = useCallback(async () => {
    const docs = await loadCctIndex();
    setList(docs);
    onCountChange?.(docs.length);
    setSelectedId((cur) => {
      if (!docs.length) return null;
      if (cur && docs.some((d) => d.id === cur)) return cur;
      return docs[docs.length - 1].id;
    });
    setRefreshKey((k) => k + 1);
    return docs;
  }, [onCountChange]);

  useEffect(() => {
    refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- mount
  }, []);

  useEffect(() => {
    const onChanged = () => refresh();
    window.addEventListener("pb-cct-changed", onChanged);
    return () => window.removeEventListener("pb-cct-changed", onChanged);
  }, [refresh]);

  const handleImportDone = useCallback(
    async (res) => {
      setBusy(false);
      if (!res || res.cancelled) return;
      if (res.added?.length) {
        setList((prev) => {
          const ids = new Set(prev.map((d) => d.id));
          const merged = [...prev];
          for (const a of res.added) {
            if (!ids.has(a.id)) merged.push(a);
          }
          onCountChange?.(merged.length);
          return merged;
        });
        setSelectedId(res.added[res.added.length - 1].id);
        notify(
          `${res.added.length} CCT importada(s). Total: ${res.total}. Análise em andamento.`,
          "s",
          6000,
        );
        await refresh();
        return;
      }
      if (res.errors?.length) {
        notify(res.errors.join(" · "), res.added?.length ? "w" : "e", 8000);
      }
      if (!res.ok && !res.added?.length) {
        notify(res.error || res.errors?.[0] || "Nenhum PDF importado.", "e", 8000);
      }
      await refresh();
    },
    [refresh, onCountChange],
  );

  useEffect(() => {
    const onImportDone = (e) => handleImportDone(e.detail);
    const onImportStart = () => setBusy(true);
    window.addEventListener("pb-cct-import-done", onImportDone);
    window.addEventListener("pb-cct-import-start", onImportStart);
    return () => {
      window.removeEventListener("pb-cct-import-done", onImportDone);
      window.removeEventListener("pb-cct-import-start", onImportStart);
    };
  }, [handleImportDone]);

  const runImportDrop = useCallback(
    async (fileList) => {
      if (!fileList?.length) return;
      setBusy(true);
      window.dispatchEvent(new CustomEvent("pb-cct-import-start"));
      try {
        const res = await importCctPdfFiles(fileList);
        window.dispatchEvent(new CustomEvent("pb-cct-import-done", { detail: res }));
      } catch (err) {
        window.dispatchEvent(
          new CustomEvent("pb-cct-import-done", {
            detail: { ok: false, error: err?.message },
          }),
        );
      }
    },
    [],
  );

  useEffect(() => {
    const el = dropRef.current;
    if (!el) return undefined;
    const stop = (e) => {
      e.preventDefault();
      e.stopPropagation();
    };
    const onDrop = (e) => {
      stop(e);
      if (!busy && e.dataTransfer?.files?.length) runImportDrop(e.dataTransfer.files);
    };
    el.addEventListener("dragenter", stop, { passive: false });
    el.addEventListener("dragover", stop, { passive: false });
    el.addEventListener("drop", onDrop);
    return () => {
      el.removeEventListener("dragenter", stop);
      el.removeEventListener("dragover", stop);
      el.removeEventListener("drop", onDrop);
    };
  }, [busy, runImportDrop]);

  const openPdf = useCallback(async (id) => {
    const url = await createCctBlobUrl(id);
    if (!url) {
      notify("PDF não encontrado. Importe novamente.", "e");
      return;
    }
    window.open(url, "_blank", "noopener,noreferrer");
    setTimeout(() => URL.revokeObjectURL(url), 120_000);
  }, []);

  return (
    <div className="rt-cct" ref={dropRef}>
      <div className="rt-card rt-cct-toolbar">
        <div className="rt-cct-toolbar-head">
          <div>
            <h3 className="rt-card-title">Convenções coletivas (CCT)</h3>
            <p className="rt-cct-lead">
              Envie PDFs das convenções. O arquivo é salvo neste navegador; a análise estruturada
              aparece ao lado (como no módulo de referência). PDFs digitalizados funcionam via{" "}
              <strong>Abrir PDF</strong>.
            </p>
          </div>
          <div className="rt-cct-toolbar-actions">
            <button
              type="button"
              className="rt-btn rt-btn--primary rt-cct-import-label"
              disabled={busy}
              onClick={() => window.__pbCctRunImport?.()}
            >
              <Upload className="h-4 w-4" />
              {busy ? "Enviando…" : "Importar PDF"}
            </button>
            {list.length > 0 ? (
              <button
                type="button"
                className="rt-btn"
                disabled={busy}
                onClick={async () => {
                  if (!window.confirm(`Remover todas as ${list.length} CCT?`)) return;
                  setBusy(true);
                  try {
                    await clearAllCctDocuments();
                    setSelectedId(null);
                    await refresh();
                    notify("Todas as CCT removidas.", "s");
                  } finally {
                    setBusy(false);
                  }
                }}
              >
                Limpar todas
              </button>
            ) : null}
          </div>
        </div>
      </div>

      <div className="rt-cct-layout">
        <div className="rt-cct-list-pane">
          <p className="rt-cct-count-hint">
            {list.length > 0
              ? `${list.length} convenção(ões) no acervo`
              : "Acervo vazio — selecione o PDF e confirme Abrir (não Cancelar)"}
          </p>
          {list.length === 0 ? (
            <div className="rt-card rt-cct-empty">
              <p>Nenhuma CCT importada.</p>
              <p className="rt-cct-empty-hint">
                Arraste <code>cct-sindpd-sp-2026-2027.pdf</code> ou clique em Importar PDF.
              </p>
            </div>
          ) : (
            <ul className="rt-cct-list">
              {list.map((doc) => (
                <li key={doc.id}>
                  <button
                    type="button"
                    className={`rt-card rt-cct-list-item${selectedId === doc.id ? " is-selected" : ""}`}
                    onClick={() => setSelectedId(doc.id)}
                  >
                    <div className="rt-cct-list-item-top">
                      <strong className="rt-cct-list-label">{doc.label}</strong>
                      <div className="rt-cct-badges">
                        <StatusBadge status={doc.status} />
                        <VigenciaBadge validUntil={doc.validUntil} />
                      </div>
                    </div>
                    <span className="rt-cct-meta">
                      {doc.fileName} · {(doc.sizeBytes / 1024).toFixed(0)} KB
                      {doc.pageCount != null ? ` · ${doc.pageCount} pág.` : ""}
                    </span>
                    <div className="rt-cct-list-actions">
                      <span
                        role="button"
                        tabIndex={0}
                        className="rt-cct-link"
                        onClick={(e) => {
                          e.stopPropagation();
                          openPdf(doc.id);
                        }}
                        onKeyDown={(e) => e.key === "Enter" && openPdf(doc.id)}
                      >
                        Abrir PDF
                      </span>
                      <span
                        role="button"
                        tabIndex={0}
                        className="rt-cct-link rt-cct-link--danger"
                        onClick={async (e) => {
                          e.stopPropagation();
                          await removeCctDocument(doc.id);
                          if (selectedId === doc.id) setSelectedId(null);
                          await refresh();
                        }}
                      >
                        Remover
                      </span>
                    </div>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="rt-cct-detail-pane">
          {selectedId ? (
            <>
              <div className="rt-card rt-cct-detail-head">
                <input
                  type="text"
                  className="rt-cct-label-inp"
                  value={list.find((d) => d.id === selectedId)?.label ?? ""}
                  onChange={(e) => {
                    const v = e.target.value;
                    setList((prev) =>
                      prev.map((d) => (d.id === selectedId ? { ...d, label: v } : d)),
                    );
                  }}
                  onBlur={(e) => updateCctLabel(selectedId, e.target.value)}
                />
                <div className="rt-cct-badges">
                  <StatusBadge status={list.find((d) => d.id === selectedId)?.status} />
                  <VigenciaBadge
                    validUntil={list.find((d) => d.id === selectedId)?.validUntil}
                  />
                </div>
              </div>
              <AnalysisPanel id={selectedId} refreshKey={refreshKey} />
            </>
          ) : (
            <div className="rt-card rt-cct-analysis-empty">
              Selecione uma CCT na lista ou importe um PDF.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
