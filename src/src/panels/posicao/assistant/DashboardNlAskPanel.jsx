import React, { startTransition, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { buildAnswerDisplay, getAnswerIntentTone } from "./dashboardNlAnswerDisplay.js";
import {
  answerDashboardNlQuestion,
  getNlChipGroupIdForIntent,
  getNlChipGroupsForSurface,
  splitNlAnswerMarkdown,
} from "./dashboardNlQuery.js";
import "./dashboard-nl-ask.css";

const SpeechRecognition =
  typeof window !== "undefined" &&
  (window.SpeechRecognition || window.webkitSpeechRecognition);

const DNL_SPEECH_TIMEOUT_MS = 20000;
const DNL_FOCUSABLE_SELECTOR = [
  'a[href]',
  'button:not([disabled])',
  'textarea:not([disabled])',
  'input:not([disabled])',
  'select:not([disabled])',
  '[tabindex]:not([tabindex="-1"])',
].join(",");

const DNL_SIZE_KEY = "dnl-modal-size-v1";
const DNL_HISTORY_KEY = "dnl-history-v1";
const DNL_HISTORY_MAX = 5;
const DNL_DISCLAIMER_KEY = "dnl-disclaimer-seen-v1";
const DNL_SIZE_DEFAULT = { width: 660, height: 580 };
const DNL_SIZE_COMPACT = { width: 660, height: null };
const DNL_SIZE_MIN = { width: 420, height: 360 };
const DNL_SIZE_MAX = { width: 1280, height: 920 };

function clampModalWidth(w) {
  const maxW = Math.min(
    DNL_SIZE_MAX.width,
    typeof window !== "undefined" ? window.innerWidth - 24 : DNL_SIZE_MAX.width,
  );
  return Math.round(Math.min(maxW, Math.max(DNL_SIZE_MIN.width, w)));
}

function clampModalSize(w, h) {
  const maxH = Math.min(DNL_SIZE_MAX.height, typeof window !== "undefined" ?window.innerHeight - 24 : DNL_SIZE_MAX.height);
  return {
    width: clampModalWidth(w),
    height: Math.round(Math.min(maxH, Math.max(DNL_SIZE_MIN.height, h))),
  };
}

function getMaximizedModalSize() {
  if (typeof window === "undefined") return { ...DNL_SIZE_MAX };
  return {
    width: Math.max(DNL_SIZE_MIN.width, Math.round(window.innerWidth - 32)),
    height: Math.max(DNL_SIZE_MIN.height, Math.round(window.innerHeight - 32)),
  };
}

function loadExpandedModalSize() {
  if (typeof window === "undefined") return { ...DNL_SIZE_DEFAULT };
  try {
    const raw = window.sessionStorage.getItem(DNL_SIZE_KEY);
    if (!raw) return { ...DNL_SIZE_DEFAULT };
    const p = JSON.parse(raw);
    return clampModalSize(
      Number(p.width) || DNL_SIZE_DEFAULT.width,
      Number(p.height) || DNL_SIZE_DEFAULT.height,
    );
  } catch {
    return { ...DNL_SIZE_DEFAULT };
  }
}

function saveModalSize(size) {
  try {
    window.sessionStorage.setItem(DNL_SIZE_KEY, JSON.stringify(size));
  } catch {
    /* ignore */
  }
}

function loadHistory() {
  try {
    const raw = window.sessionStorage.getItem(DNL_HISTORY_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function saveHistory(history) {
  try {
    window.sessionStorage.setItem(DNL_HISTORY_KEY, JSON.stringify(history));
  } catch {
    /* ignore */
  }
}

function RichText({ parts }) {
  return (
    <>
      {parts.map((part, pi) =>
        part.bold ?(
          <strong key={pi}>{part.text}</strong>
        ) : (
          <span key={pi}>{part.text}</span>
        ),
      )}
    </>
  );
}

function NlRanking({ title, items, action, onNavigate, answer }) {
  if (!items?.length) return null;
  return (
    <div className="dnl-rank">
      <h3 className="dnl-rank-title">{title}</h3>
      <ol className="dnl-rank-list">
        {items.map((row, i) => {
          const rowAction = actionWithItemFilter(action, row);
          const clickable = Boolean(rowAction && onNavigate);
          return (
          <li key={`${row.name}-${i}`} className={`dnl-rank-row${clickable ? " is-clickable" : ""}`}>
            <button
              type="button"
              className="dnl-rank-hit"
              disabled={!clickable}
              onClick={() => clickable && onNavigate(rowAction, answer)}
              title={
                clickable && rowAction?.filter?.value
                  ? `Usar "${rowAction.filter.value}" como filtro`
                  : clickable
                    ? "Abrir detalhe desta resposta"
                    : undefined
              }
            >
              <div className="dnl-rank-row-head">
                <span className="dnl-rank-pos">{i + 1}</span>
                <span className="dnl-rank-name" title={row.name}>
                  {row.name}
                </span>
                <span className="dnl-rank-pct">{row.sharePct.toFixed(1).replace(".", ",")}%</span>
              </div>
              {row.sub ?<span className="dnl-rank-sub">{row.sub}</span> : null}
              <div className="dnl-rank-bar" aria-hidden>
                <span className="dnl-rank-bar-fill" style={{ width: `${row.barPct}%` }} />
              </div>
              <span className="dnl-rank-meta">
                {row.count} ocorr.
                {row.colaboradores != null ?` · ${row.colaboradores} colab.` : ""}
              </span>
            </button>
          </li>
          );
        })}
      </ol>
    </div>
  );
}

function actionWithItemFilter(action, item) {
  if (!action?.filterFromItem) return action;
  const value = String(item?.filterValue || item?.name || item?.label || "").trim();
  if (!value) return action;
  return {
    ...action,
    filter: {
      ...(action.filter || {}),
      field: action.filterFromItem,
      label: action.filterLabel || action.filterFromItem,
      value,
    },
  };
}

function NlMetrics({ metrics, ariaLabel, action, onNavigate, answer }) {
  if (!metrics?.length) return null;
  const clickable = Boolean(action && onNavigate);
  return (
    <ul className="dnl-insight-metrics" aria-label={ariaLabel}>
      {metrics.map((m, i) => (
        <li key={`${m.label}-${i}`} className={`dnl-insight-metric${clickable ? " is-clickable" : ""}`}>
          <button
            type="button"
            className="dnl-insight-metric-hit"
            disabled={!clickable}
            onClick={() => clickable && onNavigate(action, answer)}
            title={clickable ? "Abrir detalhe deste indicador" : undefined}
          >
            <span className="dnl-insight-metric-value">{m.value}</span>
            <span className="dnl-insight-metric-label">{m.label}</span>
          </button>
        </li>
      ))}
    </ul>
  );
}

const NL_ACTION_LABELS = {
  open_abs_chart: "Abrir evolução",
  open_abs_home: "Ver resumo",
  open_abonos: "Abrir Abonos",
  open_banco_horas: "Abrir Banco de Horas",
  open_chart_day: "Abrir dia",
  open_consec_faltas: "Ver reincidências",
  open_config_horas: "Configurar categorias",
  open_hist_events: "Ver eventos",
  open_hist_table: "Abrir colaboradores",
  open_radar: "Abrir Radar",
  open_radar_eventos: "Ver eventos de risco",
  open_radar_heatmap: "Abrir heatmap",
  open_radar_passivo: "Ver passivo",
  open_saude_preventiva: "Abrir Saúde",
};

const NL_RADAR_ACTIONS = new Set(["open_radar", "open_radar_eventos", "open_radar_heatmap", "open_radar_passivo"]);
const NL_RADAR_INTENTS = new Set([
  "radar_colaboradores",
  "risco_eventos",
  "risco_passivo",
  "risco_top_departamentos",
]);

function getNlActionLabel(action) {
  if (action?.filter?.value) return "Usar esta resposta como filtro";
  if (action?.filterFromItem) return "Usar item como filtro";
  return NL_ACTION_LABELS[action?.type] || "Ver no painel";
}

function getNlAnswerSource(answer, periodLabel) {
  const actionType = answer?.action?.type;
  const intent = answer?.intent;
  const source =
    NL_RADAR_ACTIONS.has(actionType) || NL_RADAR_INTENTS.has(intent)
      ? "Radar Trabalhista"
      : "Dashboard de Absenteísmo";
  return periodLabel ? `Fonte: ${source} · ${periodLabel}` : `Fonte: ${source}`;
}

function getNlAnswerBase(context, periodLabel) {
  const parts = [];
  if (context?.dias) parts.push(`${context.dias} dia(s)`);
  if (context?.colaboradoresComAusencia != null) {
    parts.push(`${context.colaboradoresComAusencia} colaborador(es) com ausência`);
  } else if (context?.radar?.colaboradores != null) {
    parts.push(`${context.radar.colaboradores} colaborador(es)`);
  }
  if (periodLabel) parts.push(periodLabel);
  return parts.length ? `Base: ${parts.join(" · ")}` : "";
}

function findChipById(chipGroups, id) {
  for (const group of chipGroups || []) {
    const chip = group.chips?.find((c) => c.id === id);
    if (chip) return chip;
  }
  return null;
}

function getRecommendedNlChips(context, chipGroups) {
  const ids = [];
  const push = (id) => {
    if (!ids.includes(id) && findChipById(chipGroups, id)) ids.push(id);
  };

  const ausentes = context?.faltasAnalise?.ausentes;
  const totals = context?.totals || {};
  const kpi = context?.kpi || {};

  if ((ausentes?.total ?? 0) > 0) push("faltas_concentracao");
  if ((totals.absPct ?? 0) > 0 || (kpi.absPct ?? 0) > 0) push("abs_indice");
  if ((context?.radar?.total ?? context?.radar?.penalidades ?? 0) > 0) push("risco_top");
  if ((totals.horasAusentes ?? totals.horasPerdidas ?? 0) > 0) push("justificadas_mix");
  if (context?.bancoHoras) push("banco_horas_saldo");
  if (context?.saudePreventiva) push("saude_preventiva");

  const fallbackIds = ["insights_periodo", "ranking_departamentos", "horas_planejadas"];
  fallbackIds.forEach(push);

  return ids.slice(0, 3).map((id) => findChipById(chipGroups, id)).filter(Boolean);
}

function NlAnswerCard({
  answer,
  question,
  periodLabel,
  context,
  onAction,
  onNavigate,
  onCopy,
  copied,
  disclaimerSeen,
}) {
  const display = useMemo(() => buildAnswerDisplay(answer), [answer]);
  const { meta, mode, empty } = display;
  const actionLabel = getNlActionLabel(answer?.action);
  const sourceLabel = getNlAnswerSource(answer, periodLabel);
  const baseLabel = getNlAnswerBase(context, periodLabel);
  const navigableAction = onAction ? answer?.action : null;

  const hasMetrics = (display.metrics?.length ?? 0) > 0;

  return (
    <section
      className={`dnl-insight dnl-insight--${meta.tone}${empty ?" is-empty" : ""}${
        hasMetrics ?" is-has-metrics" : ""
      }`}
      aria-live="polite"
    >
      <div className="dnl-insight-top">
        <div className="dnl-insight-top-main">
          <div className={`dnl-insight-badge dnl-insight-badge--${meta.tone}`}>{meta.label}</div>
          {question ?(
            <p className="dnl-insight-question-inline" title={question}>
              <span className="dnl-insight-question-label">Pergunta</span>
              {question}
            </p>
          ) : null}
        </div>
        {periodLabel ?<span className="dnl-insight-period">{periodLabel}</span> : null}
      </div>

      <div className="dnl-insight-body">
      {mode === "structured" ?(
        <>
          <div className={`dnl-insight-hero${display.variant === "generic_only" ?" is-warn" : ""}`}>
            <h3 className="dnl-insight-headline">{display.headline}</h3>
            {display.subheadline ?(
              <p className="dnl-insight-subheadline">{display.subheadline}</p>
            ) : null}
            <p className="dnl-insight-explanation">{display.explanation}</p>
          </div>

          <NlMetrics
            metrics={display.metrics}
            ariaLabel="Resumo"
            action={navigableAction}
            answer={answer}
            onNavigate={onNavigate}
          />

          <NlRanking
            title={display.rankingTitle}
            items={display.ranking}
            action={navigableAction}
            answer={answer}
            onNavigate={onNavigate}
          />

          {display.tips?.length > 0 ?(
            <ul className="dnl-insight-tips">
              {display.tips.map((tip, i) => (
                <li key={i}>{tip}</li>
              ))}
            </ul>
          ) : null}
        </>
      ) : (
        <>
          <NlMetrics
            metrics={display.metrics}
            ariaLabel="Indicadores"
            action={navigableAction}
            answer={answer}
            onNavigate={onNavigate}
          />
          <div className="dnl-insight-narrative">
            <p className="dnl-insight-lead">
              <RichText parts={display.leadParts} />
            </p>
            {display.details?.map((d) => (
              <p key={d.id} className="dnl-insight-detail">
                <RichText parts={d.parts} />
              </p>
            ))}
          </div>
        </>
      )}
      </div>

      <footer className="dnl-insight-footer">
        {onCopy ? (
          <button type="button" className="dnl-insight-copy" onClick={onCopy} title="Copiar resposta">
            {copied ? "✓ Copiado" : "Copiar"}
          </button>
        ) : null}
        {navigableAction ?(
          <button
            type="button"
            className="dnl-insight-cta"
            onClick={() => onNavigate(navigableAction, answer)}
          >
            <span className="dnl-insight-cta-ico" aria-hidden>
              →
            </span>
            {actionLabel}
          </button>
        ) : null}
        <p className="dnl-insight-source">{sourceLabel}</p>
        {baseLabel ?<p className="dnl-insight-base">{baseLabel}</p> : null}
        {!disclaimerSeen ? (
          <p className="dnl-insight-disclaimer">
            Resposta calculada com os filtros e o período visíveis no dashboard · não substitui auditoria ou parecer jurídico
          </p>
        ) : (
          <button
            type="button"
            className="dnl-insight-disclaimer-icon"
            title="Resposta calculada com os filtros e o período visíveis no dashboard · não substitui auditoria ou parecer jurídico"
            aria-label="Aviso legal"
          >
            ⓘ
          </button>
        )}
      </footer>
    </section>
  );
}

export function DashboardNlAskPanel({
  context,
  surface = "both",
  theme = "dark",
  className = "",
  onAction,
  compact = false,
}) {
  const [modalOpen, setModalOpen] = useState(false);
  const [question, setQuestion] = useState("");
  const [answer, setAnswer] = useState(null);
  const [loading, setLoading] = useState(false);
  const [history, setHistory] = useState(() => loadHistory());
  const [showHistory, setShowHistory] = useState(false);
  const [copied, setCopied] = useState(false);
  const [disclaimerSeen, setDisclaimerSeen] = useState(
    () => typeof window !== "undefined" && !!window.localStorage.getItem(DNL_DISCLAIMER_KEY),
  );
  const [chipSearch, setChipSearch] = useState("");
  const [listening, setListening] = useState(false);
  const [speechError, setSpeechError] = useState("");
  const [dragPos, setDragPos] = useState({ x: 0, y: 0 });
  const [modalSize, setModalSize] = useState(() => ({ ...DNL_SIZE_COMPACT }));
  const [isDragging, setIsDragging] = useState(false);
  const [isResizing, setIsResizing] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);
  const [activeSuggestGroup, setActiveSuggestGroup] = useState(null);
  const toggleButtonRef = useRef(null);
  const lastFocusedRef = useRef(null);
  const speechTimeoutRef = useRef(null);
  const inputRef = useRef(null);
  const recognitionRef = useRef(null);
  const modalRef = useRef(null);
  const answerZoneRef = useRef(null);
  const dragPosRef = useRef({ x: 0, y: 0 });
  const modalSizeRef = useRef({ ...DNL_SIZE_COMPACT });
  const dragState = useRef(null);
  const resizeState = useRef(null);
  const expandedSizeRef = useRef(loadExpandedModalSize());
  const restoreSizeRef = useRef(null);
  const userSizedRef = useRef(false);

  const clearSpeechTimeout = useCallback(() => {
    if (speechTimeoutRef.current && typeof window !== "undefined") {
      window.clearTimeout(speechTimeoutRef.current);
    }
    speechTimeoutRef.current = null;
  }, []);

  const closeModal = useCallback(() => {
    clearSpeechTimeout();
    stopListeningInner(recognitionRef);
    recognitionRef.current = null;
    setListening(false);
    setIsDragging(false);
    setIsResizing(false);
    setIsExpanded(false);
    setShowHistory(false);
    setChipSearch("");
    dragState.current = null;
    resizeState.current = null;
    setModalOpen(false);
  }, [clearSpeechTimeout]);

  const copyAnswer = useCallback(() => {
    if (!answer) return;
    const text = answer.structured?.headline
      ? [answer.structured.headline, answer.structured.subheadline, answer.structured.explanation]
          .filter(Boolean)
          .join(" - ")
      : String(answer.text || "").replace(/\*\*([^*]+)\*\*/g, "$1");
    copyTextToClipboard(text).then((ok) => {
      if (!ok) {
        setSpeechError("Não foi possível copiar automaticamente. Selecione o texto da resposta para copiar.");
        return;
      }
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      });
  }, [answer]);

  const submit = useCallback(
    (q, forceIntent) => {
      const text = String(q || "").trim();
      if (!text || !context) return;
      setLoading(true);
      setAnswer(null);
      startTransition(() => {
        const result = answerDashboardNlQuestion(text, context, { surface, forceIntent });
        setAnswer(result);
        setLoading(false);
        setHistory((prev) => {
          const entry = { question: text, answer: result, ts: Date.now() };
          const next = [entry, ...prev.filter((h) => h.question !== text)].slice(0, DNL_HISTORY_MAX);
          saveHistory(next);
          return next;
        });
      });
    },
    [context, surface],
  );

  const onSubmit = useCallback(
    (e) => {
      e?.preventDefault();
      submit(question);
    },
    [question, submit],
  );

  const stopListening = useCallback(() => {
    clearSpeechTimeout();
    stopListeningInner(recognitionRef);
    setListening(false);
  }, [clearSpeechTimeout]);

  const startListening = useCallback(() => {
    setSpeechError("");
    if (!SpeechRecognition) {
      setSpeechError("Reconhecimento de voz não disponível neste navegador (use Chrome ou Edge).");
      return;
    }
    stopListening();
    const rec = new SpeechRecognition();
    rec.lang = "pt-BR";
    rec.interimResults = false;
    rec.maxAlternatives = 1;
    recognitionRef.current = rec;
    rec.onresult = (event) => {
      clearSpeechTimeout();
      const transcript = event.results?.[0]?.[0]?.transcript || "";
      setQuestion(transcript);
      submit(transcript);
      setListening(false);
    };
    rec.onerror = (event) => {
      clearSpeechTimeout();
      setSpeechError(getSpeechRecognitionErrorMessage(event?.error));
      setListening(false);
    };
    rec.onend = () => {
      clearSpeechTimeout();
      setListening(false);
    };
    try {
      rec.start();
    } catch {
      setSpeechError("Não foi possível iniciar o microfone. Tente novamente ou digite a pergunta.");
      setListening(false);
      return;
    }
    setListening(true);
    if (typeof window !== "undefined") {
      speechTimeoutRef.current = window.setTimeout(() => {
        stopListeningInner(recognitionRef);
        recognitionRef.current = null;
        setListening(false);
        setSpeechError("Tempo de escuta encerrado. Fale novamente ou digite a pergunta.");
      }, DNL_SPEECH_TIMEOUT_MS);
    }
  }, [clearSpeechTimeout, stopListening, submit]);

  useEffect(
    () => () => {
      clearSpeechTimeout();
      stopListeningInner(recognitionRef);
    },
    [clearSpeechTimeout],
  );

  useEffect(() => {
    if (answer && !disclaimerSeen && typeof window !== "undefined") {
      window.localStorage.setItem(DNL_DISCLAIMER_KEY, "1");
      setDisclaimerSeen(true);
    }
  }, [answer, disclaimerSeen]);

  useEffect(() => {
    dragPosRef.current = dragPos;
  }, [dragPos]);

  useEffect(() => {
    modalSizeRef.current = modalSize;
  }, [modalSize]);

  useEffect(() => {
    if (!modalOpen) return undefined;
    const onKey = (e) => {
      if (e.key === "Escape") {
        closeModal();
        return;
      }
      if (e.key !== "Tab") return;
      const focusable = getFocusableElements(modalRef.current);
      if (!focusable.length) {
        e.preventDefault();
        modalRef.current?.focus();
        return;
      }
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    };
    document.addEventListener("keydown", onKey);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const t = window.setTimeout(() => {
      inputRef.current?.focus();
      if (document.activeElement === document.body) {
        modalRef.current?.focus();
      }
    }, 50);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prevOverflow;
      window.clearTimeout(t);
      const restoreTarget = lastFocusedRef.current || toggleButtonRef.current;
      if (restoreTarget && typeof restoreTarget.focus === "function") {
        restoreTarget.focus({ preventScroll: true });
      }
    };
  }, [modalOpen, closeModal]);

  useEffect(() => {
    if (!isDragging) return undefined;

    const onMove = (e) => {
      const d = dragState.current;
      if (!d?.active) return;
      setDragPos({
        x: d.originX + (e.clientX - d.startX),
        y: d.originY + (e.clientY - d.startY),
      });
    };

    const onUp = () => {
      dragState.current = null;
      setIsDragging(false);
    };

    document.addEventListener("mousemove", onMove);
    document.addEventListener("mouseup", onUp);
    return () => {
      document.removeEventListener("mousemove", onMove);
      document.removeEventListener("mouseup", onUp);
    };
  }, [isDragging]);

  useEffect(() => {
    if (!isResizing) return undefined;

    const onMove = (e) => {
      const r = resizeState.current;
      if (!r?.active) return;
      const dx = e.clientX - r.startX;
      const dy = e.clientY - r.startY;
      const nextWidth = clampModalWidth(r.mode === "w" ? r.startW - dx : r.startW + dx);

      if (r.mode === "w") {
        setDragPos({
          x: r.originX + (r.startW - nextWidth),
          y: r.originY,
        });
      }

      if (r.mode === "e" || r.mode === "w") {
        setModalSize({
          width: nextWidth,
          height: r.startAutoHeight ? null : r.startH,
        });
        return;
      }

      setModalSize(clampModalSize(nextWidth, r.startH + dy));
    };

    const onUp = () => {
      const r = resizeState.current;
      const wasActive = r?.active;
      resizeState.current = null;
      setIsResizing(false);
      if (wasActive && modalRef.current) {
        const { width, height } = modalRef.current.getBoundingClientRect();
        const saved = clampModalSize(width, height);
        const next = {
          width: saved.width,
          height: r.startAutoHeight && (r.mode === "e" || r.mode === "w") ? null : saved.height,
        };
        setModalSize(next);
        expandedSizeRef.current = saved;
        saveModalSize(saved);
        userSizedRef.current = true;
      }
    };

    document.addEventListener("mousemove", onMove);
    document.addEventListener("mouseup", onUp);
    return () => {
      document.removeEventListener("mousemove", onMove);
      document.removeEventListener("mouseup", onUp);
    };
  }, [isResizing]);

  useEffect(() => {
    if (!answer || !modalOpen) return undefined;
    if (!userSizedRef.current) {
      setModalSize({ ...expandedSizeRef.current });
    }
    const t = window.setTimeout(() => {
      answerZoneRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    }, 80);
    return () => window.clearTimeout(t);
  }, [answer, modalOpen]);

  useEffect(() => {
    if (!modalOpen || !isExpanded || typeof window === "undefined") return undefined;
    const onResize = () => {
      setModalSize(getMaximizedModalSize());
      setDragPos({ x: 0, y: 0 });
    };
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, [isExpanded, modalOpen]);

  const onDragStart = useCallback((e) => {
    if (e.button !== 0) return;
    if (e.target.closest("button, input, a, label")) return;
    const currentPos = dragPosRef.current;
    dragState.current = {
      active: true,
      startX: e.clientX,
      startY: e.clientY,
      originX: currentPos.x,
      originY: currentPos.y,
    };
    setIsExpanded(false);
    setIsDragging(true);
    e.preventDefault();
  }, []);

  const onResizeStart = useCallback((e, mode = "se") => {
    if (e.button !== 0) return;
    e.preventDefault();
    e.stopPropagation();
    const rect = modalRef.current?.getBoundingClientRect();
    if (!rect) return;
    const currentPos = dragPosRef.current;
    const currentSize = modalSizeRef.current;
    resizeState.current = {
      active: true,
      startX: e.clientX,
      startY: e.clientY,
      startW: rect.width,
      startH: rect.height,
      startAutoHeight: currentSize.height == null,
      mode,
      originX: currentPos.x,
      originY: currentPos.y,
    };
    setIsExpanded(false);
    setIsResizing(true);
  }, []);

  const onResizeReset = useCallback((e) => {
    e.preventDefault();
    e.stopPropagation();
    setIsExpanded(false);
    restoreSizeRef.current = null;
    userSizedRef.current = false;
    if (answer) {
      const next = clampModalSize(DNL_SIZE_DEFAULT.width, DNL_SIZE_DEFAULT.height);
      expandedSizeRef.current = next;
      saveModalSize(next);
      setModalSize(next);
    } else {
      setModalSize({ width: DNL_SIZE_COMPACT.width, height: null });
    }
  }, [answer]);

  const openModal = useCallback(() => {
    if (typeof document !== "undefined") {
      lastFocusedRef.current = document.activeElement;
    }
    setAnswer(null);
    setSpeechError("");
    setDragPos({ x: 0, y: 0 });
    setIsExpanded(false);
    restoreSizeRef.current = null;
    userSizedRef.current = false;
    setModalSize({ width: expandedSizeRef.current.width, height: null });
    setModalOpen(true);
  }, []);

  const toggleExpanded = useCallback((e) => {
    e?.preventDefault();
    e?.stopPropagation();
    if (isExpanded) {
      const restore = restoreSizeRef.current;
      if (restore) {
        setModalSize(restore.size);
        setDragPos(restore.pos);
      }
      setIsExpanded(false);
      return;
    }

    restoreSizeRef.current = {
      size: { ...modalSize },
      pos: { ...dragPos },
    };
    const next = getMaximizedModalSize();
    setModalSize(next);
    setDragPos({ x: 0, y: 0 });
    userSizedRef.current = true;
    setIsExpanded(true);
  }, [dragPos, isExpanded, modalSize]);

  const dismissAnswer = useCallback(() => {
    setAnswer(null);
    setActiveSuggestGroup(null);
    if (!isExpanded) {
      userSizedRef.current = false;
      setModalSize((s) => ({ width: s.width, height: null }));
    }
    inputRef.current?.focus();
  }, [isExpanded]);

  const clearForm = useCallback(() => {
    stopListening();
    setQuestion("");
    setAnswer(null);
    setSpeechError("");
    setActiveSuggestGroup(null);
    if (!isExpanded) {
      userSizedRef.current = false;
      setModalSize((s) => ({ width: s.width, height: null }));
    }
    inputRef.current?.focus();
  }, [isExpanded, stopListening]);

  const canClear = Boolean(question.trim() || answer || speechError);

  const chipGroups = useMemo(
    () => getNlChipGroupsForSurface(surface, context),
    [surface, context],
  );
  const recommendedChips = useMemo(
    () => getRecommendedNlChips(context, chipGroups),
    [context, chipGroups],
  );
  const filteredChipGroups = useMemo(() => {
    if (!chipSearch.trim()) return chipGroups;
    const q = chipSearch.trim().toLowerCase().normalize("NFD").replace(/\p{M}/gu, "");
    return chipGroups
      .map((group) => ({
        ...group,
        chips: group.chips.filter((c) =>
          c.label.toLowerCase().normalize("NFD").replace(/\p{M}/gu, "").includes(q),
        ),
      }))
      .filter((g) => g.chips.length > 0);
  }, [chipGroups, chipSearch]);
  const compactSuggestions = Boolean(answer);
  const activeGroup =
    chipGroups.find((g) => g.id === activeSuggestGroup) || chipGroups[0] || null;

  useEffect(() => {
    if (!answer) {
      setActiveSuggestGroup(null);
      return;
    }
    const fromIntent = getNlChipGroupIdForIntent(answer.intent);
    setActiveSuggestGroup(fromIntent || chipGroups[0]?.id || null);
  }, [answer, chipGroups]);

  const periodLabel = context?.periodLabel || "";
  const answerTone = answer ?getAnswerIntentTone(answer.intent) : null;

  const renderSuggestChips = (group) =>
    group.chips.map((chip) => (
      <button
        key={chip.id}
        type="button"
        className="dnl-chip"
        role="listitem"
        onClick={() => {
          setQuestion(chip.label);
          submit(chip.label, chip.id);
        }}
      >
        {chip.label}
      </button>
    ));

  const handleNavigate = useCallback(
    (action, ans) => {
      onAction?.(action, ans);
      closeModal();
    },
    [onAction, closeModal],
  );

  const modal =
    modalOpen &&
    createPortal(
      <div
        className={`dnl-overlay${isExpanded ? " is-expanded" : ""}`}
        data-theme={theme}
        role="presentation"
        onMouseDown={(e) => {
          if (e.target === e.currentTarget) closeModal();
        }}
      >
        <div
          id="dnl-modal"
          ref={modalRef}
          className={`dnl-modal${isDragging ?" is-dragging" : ""}${isResizing ?" is-resizing" : ""}${
            !isExpanded && (!answer || modalSize.height == null) ?" is-auto-height" : ""
          }${isExpanded ?" is-expanded" : ""}`}
          role="dialog"
          aria-modal="true"
          aria-labelledby="dnl-modal-title"
          tabIndex={-1}
          style={{
            width: modalSize.width,
            height: modalSize.height ?? undefined,
            transform:
              dragPos.x || dragPos.y
                ?`translate(${dragPos.x}px, ${dragPos.y}px)`
                : undefined,
          }}
          onMouseDown={(e) => e.stopPropagation()}
        >
          <header
            className="dnl-modal-head"
            onMouseDown={onDragStart}
            title="Arraste para mover"
          >
            <span className="dnl-drag-grip" aria-hidden>
              ⠿
            </span>
            <div className="dnl-modal-head-text">
              <h2 id="dnl-modal-title" className="dnl-modal-title">
                Assistente de Dados
              </h2>
              <p className="dnl-modal-sub">
                Linguagem natural · texto ou voz · arraste ou redimensione
                {periodLabel ?<em> · {periodLabel}</em> : null}
              </p>
            </div>
            {history.length > 0 ? (
              <button
                type="button"
                className="dnl-head-btn"
                onClick={() => setShowHistory((v) => !v)}
                aria-label={showHistory ? "Fechar histórico" : "Ver perguntas recentes"}
                title={showHistory ? "Fechar histórico" : "Perguntas recentes"}
              >
                <svg
                  viewBox="0 0 20 20"
                  aria-hidden="true"
                  focusable="false"
                  style={{
                    width: 15,
                    height: 15,
                    fill: "none",
                    stroke: "currentColor",
                    strokeWidth: 1.8,
                    strokeLinecap: "round",
                  }}
                >
                  <circle cx="10" cy="10" r="7.5" />
                  <path d="M10 6v4l2.5 2.5" />
                </svg>
              </button>
            ) : null}
            <button
              type="button"
              className="dnl-head-btn dnl-expand"
              onClick={toggleExpanded}
              aria-label={isExpanded ? "Restaurar tamanho" : "Expandir"}
              title={isExpanded ? "Restaurar tamanho" : "Expandir"}
            >
              {isExpanded ? (
                <svg viewBox="0 0 20 20" aria-hidden="true" focusable="false">
                  <path d="M7.5 3.5h-4v4M12.5 16.5h4v-4M3.8 3.8l4.5 4.5M16.2 16.2l-4.5-4.5" />
                </svg>
              ) : (
                <svg viewBox="0 0 20 20" aria-hidden="true" focusable="false">
                  <path d="M7.5 3.5h-4v4M12.5 16.5h4v-4M3.8 7.2l3.4-3.4M12.8 16.2l3.4-3.4" />
                </svg>
              )}
            </button>
            <button
              type="button"
              className="dnl-close"
              onClick={closeModal}
              aria-label="Fechar"
              title="Fechar (Esc)"
            >
              ×
            </button>
          </header>

          {showHistory && history.length > 0 ? (
            <div className="dnl-history-panel" role="region" aria-label="Perguntas recentes">
              <p className="dnl-history-label">Perguntas recentes</p>
              <ul className="dnl-history-list">
                {history.map((h, i) => (
                  <li key={i}>
                    <button
                      type="button"
                      className="dnl-history-item"
                      onClick={() => {
                        setQuestion(h.question);
                        setAnswer(h.answer);
                        setShowHistory(false);
                      }}
                    >
                      <span className="dnl-history-q">{h.question}</span>
                      <span className="dnl-history-hint">reutilizar →</span>
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}

          <div className={`dnl-modal-body${answer ?" is-with-answer" : ""}`}>
          <form className="dnl-form" onSubmit={onSubmit}>
            <label className="dnl-form-label" htmlFor="dnl-input">
              Pergunte ao dashboard
            </label>
            <div className="dnl-input-row">
              <input
                id="dnl-input"
                ref={inputRef}
                type="text"
                className="dnl-input"
                value={question}
                onChange={(e) => setQuestion(e.target.value)}
                placeholder="Ex.: qual o principal motivo de faltas injustificadas?"
                autoComplete="off"
              />
              {SpeechRecognition ?(
                <button
                  type="button"
                  className={`dnl-mic${listening ?" is-listening" : ""}`}
                  onClick={listening ?stopListening : startListening}
                  aria-label={listening ?"Parar gravação" : "Falar pergunta"}
                  title={listening ?"Parar" : "Falar (pt-BR)"}
                >
                  <span aria-hidden="true">{listening ? "■" : "🎙"}</span>
                </button>
              ) : null}
              <button
                type="button"
                className="dnl-clear"
                onClick={clearForm}
                disabled={!canClear}
                aria-label="Limpar pergunta e resposta"
                title="Limpar"
              >
                Limpar
              </button>
              <button type="submit" className="dnl-submit" disabled={!question.trim()}>
                Enviar
              </button>
            </div>
            {speechError ?<p className="dnl-speech-err">{speechError}</p> : null}
          </form>

          {loading ? (
            <div className="dnl-loading" aria-live="polite" aria-label="Calculando resposta">
              <span className="dnl-loading-dot" />
              <span className="dnl-loading-dot" />
              <span className="dnl-loading-dot" />
            </div>
          ) : null}

          {answer ?(
            <div
              ref={answerZoneRef}
              className={`dnl-answer-zone dnl-answer-zone--${answerTone}`}
              aria-label="Resposta aos dados"
            >
              <div className="dnl-answer-zone-head">
                <p className="dnl-answer-zone-kicker">
                  <span className="dnl-answer-zone-dot" aria-hidden />
                  Resposta
                </p>
                <button
                  type="button"
                  className="dnl-answer-close"
                  onClick={dismissAnswer}
                  aria-label="Fechar resposta"
                  title="Fechar resposta"
                >
                  Fechar
                </button>
              </div>
              <NlAnswerCard
                answer={answer}
                question={question}
                periodLabel={periodLabel}
                context={context}
                onAction={onAction}
                onNavigate={handleNavigate}
                onCopy={copyAnswer}
                copied={copied}
                disclaimerSeen={disclaimerSeen}
              />
            </div>
          ) : !question.trim() ?(
            <p className="dnl-hint">Escolha uma sugestão, digite ou use o microfone.</p>
          ) : null}

          <div className={`dnl-chips-wrap${compactSuggestions ?" is-compact" : ""}`}>
            <span className="dnl-chips-label">
              {compactSuggestions ?"Explorar outro tema" : "Sugestões por tema"}
              {surface === "radar" ?" · risco" : surface === "absenteismo" ?" · absenteísmo" : ""}
            </span>
            {!compactSuggestions ? (
              <div className="dnl-chip-search-wrap">
                <input
                  type="search"
                  className="dnl-chip-search"
                  placeholder="Buscar pergunta..."
                  value={chipSearch}
                  onChange={(e) => setChipSearch(e.target.value)}
                  aria-label="Buscar nas sugestões"
                />
                {chipSearch ? (
                  <button
                    type="button"
                    className="dnl-chip-search-clear"
                    onClick={() => setChipSearch("")}
                    aria-label="Limpar busca"
                  >
                    ×
                  </button>
                ) : null}
              </div>
            ) : null}
            {!compactSuggestions && recommendedChips.length > 0 ?(
              <section className="dnl-recommended" aria-label="Perguntas recomendadas">
                <div className="dnl-recommended-head">
                  <span>Recomendadas agora</span>
                  <small>com base nos dados visíveis</small>
                </div>
                <div className="dnl-recommended-list" role="list">
                  {recommendedChips.map((chip) => (
                    <button
                      key={`rec-${chip.id}`}
                      type="button"
                      className="dnl-recommended-chip"
                      role="listitem"
                      onClick={() => {
                        setQuestion(chip.label);
                        submit(chip.label, chip.id);
                      }}
                    >
                      {chip.label}
                    </button>
                  ))}
                </div>
              </section>
            ) : null}
            {compactSuggestions ?(
              <>
                <div className="dnl-suggest-tabs" role="tablist" aria-label="Temas de perguntas">
                  {chipGroups.map((group) => (
                    <button
                      key={group.id}
                      type="button"
                      role="tab"
                      aria-selected={group.id === activeSuggestGroup}
                      className={`dnl-suggest-tab dnl-suggest-tab--${group.id}${
                        group.id === activeSuggestGroup ?" is-active" : ""
                      }`}
                      onClick={() => setActiveSuggestGroup(group.id)}
                    >
                      {group.title}
                      <span className="dnl-suggest-tab-count">{group.chips.length}</span>
                    </button>
                  ))}
                </div>
                {activeGroup ?(
                  <section
                    className={`dnl-suggest-card dnl-suggest-card--${activeGroup.id} is-single`}
                    aria-labelledby={`dnl-grp-${activeGroup.id}`}
                  >
                    <div className="dnl-chips" role="list">
                      {renderSuggestChips(activeGroup)}
                    </div>
                  </section>
                ) : null}
              </>
            ) : filteredChipGroups.length > 0 ? (
              <div
                className={`dnl-suggest-cards${filteredChipGroups.length > 2 ?" is-grid" : ""}`}
              >
                {filteredChipGroups.map((group) => (
                  <section
                    key={group.id}
                    className={`dnl-suggest-card dnl-suggest-card--${group.id}`}
                    aria-labelledby={`dnl-grp-${group.id}`}
                  >
                    <h3 id={`dnl-grp-${group.id}`} className="dnl-suggest-card-title">
                      <span>{group.title}</span>
                      <span className="dnl-suggest-card-count">{group.chips.length}</span>
                    </h3>
                    <div className="dnl-chips" role="list">
                      {renderSuggestChips(group)}
                    </div>
                  </section>
                ))}
              </div>
            ) : (
              <p className="dnl-hint">Nenhuma sugestão corresponde à busca.</p>
            )}
          </div>
          </div>

          <button
            type="button"
            className="dnl-modal-resize"
            aria-label="Redimensionar janela"
            title="Arraste para redimensionar · duplo clique para restaurar"
            onMouseDown={(e) => onResizeStart(e, "se")}
            onDoubleClick={onResizeReset}
          />
          <button
            type="button"
            className="dnl-modal-resize-side dnl-modal-resize-side--left"
            aria-label="Redimensionar largura pela esquerda"
            title="Arraste para ajustar a largura"
            onMouseDown={(e) => onResizeStart(e, "w")}
            onDoubleClick={onResizeReset}
          />
          <button
            type="button"
            className="dnl-modal-resize-side dnl-modal-resize-side--right"
            aria-label="Redimensionar largura pela direita"
            title="Arraste para ajustar a largura"
            onMouseDown={(e) => onResizeStart(e, "e")}
            onDoubleClick={onResizeReset}
          />
        </div>
      </div>,
      document.body,
    );

  return (
    <>
      <div
        className={`dnl-root${compact ?" is-compact" : ""} ${className}`.trim()}
        data-theme={theme}
      >
        <button
          ref={toggleButtonRef}
          type="button"
          className="dnl-toggle"
          onClick={openModal}
          aria-haspopup="dialog"
          aria-expanded={modalOpen}
          aria-controls="dnl-modal"
          aria-label="Abrir Assistente de Dados"
          title="Abrir Assistente de Dados"
        >
          <span className="dnl-toggle-ico" aria-hidden>
            💬
          </span>
          <span className="dnl-toggle-label">Assistente</span>
        </button>
      </div>
      {modal}
    </>
  );
}

function stopListeningInner(recognitionRef) {
  try {
    recognitionRef.current?.stop();
    return true;
  } catch {
    return false;
  }
}

function getSpeechRecognitionErrorMessage(error) {
  switch (error) {
    case "not-allowed":
    case "service-not-allowed":
      return "Permissão do microfone negada. Libere o acesso no navegador ou digite a pergunta.";
    case "no-speech":
      return "Não ouvi nada. Tente falar novamente ou digite a pergunta.";
    case "audio-capture":
      return "Não encontrei um microfone disponível neste dispositivo.";
    case "network":
      return "Falha de rede no reconhecimento de voz. Tente novamente ou digite a pergunta.";
    case "aborted":
      return "Escuta interrompida.";
    default:
      return "Não foi possível captar a voz. Tente novamente ou digite a pergunta.";
  }
}

async function copyTextToClipboard(text) {
  if (!text) return false;
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch {
    // fall through to the legacy fallback
  }
  return fallbackCopyText(text);
}

function fallbackCopyText(text) {
  if (typeof document === "undefined") return false;
  const area = document.createElement("textarea");
  area.value = text;
  area.setAttribute("readonly", "");
  area.style.position = "fixed";
  area.style.left = "-9999px";
  area.style.top = "0";
  document.body.appendChild(area);
  area.focus();
  area.select();
  try {
    return document.execCommand("copy");
  } catch {
    return false;
  } finally {
    document.body.removeChild(area);
  }
}

function getFocusableElements(container) {
  if (!container) return [];
  return Array.from(container.querySelectorAll(DNL_FOCUSABLE_SELECTOR)).filter((el) => {
    if (el.disabled || el.getAttribute("aria-hidden") === "true") return false;
    const style = typeof window !== "undefined" ? window.getComputedStyle(el) : null;
    return style?.display !== "none" && style?.visibility !== "hidden";
  });
}
