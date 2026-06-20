import React, { useEffect, useMemo, useRef, useState } from "react";
import { Maximize2, Minimize2 } from "lucide-react";
import { analyzeOperationalStatus } from "./operationStatusEngine.js";
import { answerTodayQuestion } from "./todayQuestionEngine.js";
import { TODAY_POSITION_QUESTIONS } from "./todayPositionQuestions.js";
import "./positionTodayIntelligence.css";

function fmtPct(value) {
  if (value == null || !Number.isFinite(Number(value))) return "--";
  return `${Number(value).toFixed(1).replace(".", ",")}%`;
}

function fmtNumber(value) {
  const numeric = Number(value) || 0;
  return new Intl.NumberFormat("pt-BR").format(numeric);
}

function ActionButton({ children, onClick, disabled = false }) {
  return (
    <button type="button" className="pti-action-btn" onClick={onClick} disabled={disabled}>
      {children}
    </button>
  );
}

function resolveDepartmentPayload(dept) {
  if (!dept) return {};
  if ((Number(dept.ausentes) || 0) > 0) {
    return { departamento: dept.nome, category: "faltas", focus: "absence" };
  }
  if ((Number(dept.atrasados) || 0) > 0) {
    return { departamento: dept.nome, category: "atrasos", focus: "delay" };
  }
  return { departamento: dept.nome, category: "presentes", focus: "coverage" };
}

function actionLabel(action, fallback = "Abrir prioridade") {
  if (action === "OPEN_EMPLOYEES") return "Ver colaboradores";
  if (action === "OPEN_DEPARTMENT") return "Abrir prioridade";
  return fallback;
}

function departmentMetrics(dept) {
  const parts = [];
  if ((Number(dept.deficitCobertura) || 0) > 0) parts.push(`${dept.deficitCobertura} déficit`);
  if ((Number(dept.ausentes) || 0) > 0) parts.push(`${dept.ausentes} aus.`);
  if ((Number(dept.atrasados) || 0) > 0) parts.push(`${dept.atrasados} atr.`);
  return parts.length ? parts.join(" · ") : "sem ocorrência crítica";
}

function aggregateDepartments(departments = []) {
  return departments.reduce(
    (acc, dept) => {
      acc.deficit += Number(dept.deficitCobertura) || 0;
      acc.ausentes += Number(dept.ausentes) || 0;
      acc.atrasados += Number(dept.atrasados) || 0;
      return acc;
    },
    { deficit: 0, ausentes: 0, atrasados: 0 },
  );
}

function DiagnosisDetailsModal({
  analysis,
  op,
  topDepartment,
  onClose,
  runAction,
  hasAction,
  selectedQuestion,
  setSelectedQuestion,
  answer,
  answerTitle,
  answerSummary,
  answerEvidence,
  focusQuestions = false,
}) {
  const departments = analysis.affectedDepartments || [];
  const totals = aggregateDepartments(departments);
  const firstAction = analysis.recommendedFirstAction || analysis.recommendedActions?.[0] || null;
  const totalDeficit = Number(op.deficitCobertura) || 0;
  const questionsRef = useRef(null);
  const modalRef = useRef(null);
  const dragRef = useRef(null);
  const resizeRef = useRef(null);
  const [expanded, setExpanded] = useState(false);
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const [size, setSize] = useState({ width: 980, height: 720 });

  const runModalAction = (action, payload) => {
    runAction(action, payload);
  };

  const startDrag = (event) => {
    if (expanded || event.button !== 0 || event.target.closest("button")) return;
    dragRef.current = {
      startX: event.clientX,
      startY: event.clientY,
      x: position.x,
      y: position.y,
    };
    event.currentTarget.setPointerCapture?.(event.pointerId);
  };

  const startResize = (event) => {
    if (expanded || event.button !== 0) return;
    resizeRef.current = {
      startX: event.clientX,
      startY: event.clientY,
      width: size.width,
      height: size.height,
    };
    event.currentTarget.setPointerCapture?.(event.pointerId);
    event.preventDefault();
  };

  const handlePointerMove = (event) => {
    if (dragRef.current) {
      setPosition({
        x: dragRef.current.x + event.clientX - dragRef.current.startX,
        y: dragRef.current.y + event.clientY - dragRef.current.startY,
      });
    }
    if (resizeRef.current) {
      const maxWidth = Math.max(560, window.innerWidth - 48);
      const maxHeight = Math.max(420, window.innerHeight - 48);
      setSize({
        width: Math.min(maxWidth, Math.max(560, resizeRef.current.width + event.clientX - resizeRef.current.startX)),
        height: Math.min(maxHeight, Math.max(420, resizeRef.current.height + event.clientY - resizeRef.current.startY)),
      });
    }
  };

  const stopPointerAction = () => {
    dragRef.current = null;
    resizeRef.current = null;
  };

  useEffect(() => {
    if (focusQuestions && questionsRef.current) {
      questionsRef.current.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  }, [focusQuestions]);

  useEffect(() => {
    const FOCUSABLE = 'button:not([disabled]), [href], input, select, textarea, [tabindex]:not([tabindex="-1"])';
    const prev = document.activeElement;
    modalRef.current?.querySelector(FOCUSABLE)?.focus();

    const handleKey = (e) => {
      if (e.key === "Escape") { onClose(); return; }
      if (e.key !== "Tab") return;
      const nodes = Array.from(modalRef.current?.querySelectorAll(FOCUSABLE) || []);
      if (!nodes.length) return;
      const first = nodes[0];
      const last = nodes[nodes.length - 1];
      if (e.shiftKey) {
        if (document.activeElement === first) { e.preventDefault(); last.focus(); }
      } else {
        if (document.activeElement === last) { e.preventDefault(); first.focus(); }
      }
    };

    document.addEventListener("keydown", handleKey);
    return () => {
      document.removeEventListener("keydown", handleKey);
      prev?.focus();
    };
  }, [onClose]);

  return (
    <div
      className="pti-modal-backdrop"
      role="presentation"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <section
        ref={modalRef}
        className={`pti-modal${expanded ? " pti-modal-expanded" : ""}`}
        role="dialog"
        aria-modal="true"
        aria-label="Análise operacional"
        style={
          expanded
            ? undefined
            : {
                "--pti-modal-x": `${position.x}px`,
                "--pti-modal-y": `${position.y}px`,
                "--pti-modal-width": `${size.width}px`,
                "--pti-modal-height": `${size.height}px`,
              }
        }
        onPointerMove={handlePointerMove}
        onPointerUp={stopPointerAction}
        onPointerCancel={stopPointerAction}
      >
        <header className="pti-modal-head" onPointerDown={startDrag}>
          <div>
            <p className="pti-eyebrow">Análise operacional</p>
            <small>Leitura automática da posição do dia com evidências e ação sugerida.</small>
          </div>
          <div className="pti-modal-window-tools">
            <button
              type="button"
              className="pti-modal-icon-btn"
              onClick={() => setExpanded((value) => !value)}
              aria-label={expanded ? "Restaurar tamanho" : "Expandir tela"}
              title={expanded ? "Restaurar tamanho" : "Expandir tela"}
            >
              {expanded ? <Minimize2 size={16} /> : <Maximize2 size={16} />}
            </button>
            <button type="button" className="pti-modal-close" onClick={onClose} aria-label="Fechar" title="Fechar">
            ×
            </button>
          </div>
        </header>

        <div className="pti-modal-grid">
          <article className="pti-modal-card pti-modal-card-primary pti-kpi-status">
            <span>Status</span>
            <strong>{op.label || "Sem leitura"}</strong>
            <small>{fmtPct(op.coveragePct)} de cobertura</small>
          </article>
          <button
            type="button"
            className="pti-modal-card pti-modal-card-clickable pti-kpi-deficit"
            onClick={() => {
              const action = firstAction || {
                action: "OPEN_DEPARTMENT",
                payload: resolveDepartmentPayload(topDepartment),
              };
              runModalAction(action.action, action.payload);
            }}
            disabled={!hasAction || !topDepartment || totalDeficit <= 0}
            title="Abrir prioridade de cobertura"
          >
            <span>Déficit total</span>
            <strong>{fmtNumber(totalDeficit)}</strong>
            <small>colaborador(es) na cobertura do dia</small>
          </button>
          <button
            type="button"
            className="pti-modal-card pti-modal-card-clickable pti-kpi-absence"
            onClick={() => runModalAction("OPEN_DEPARTMENT", { departamento: topDepartment?.nome, category: "faltas" })}
            disabled={!hasAction || !topDepartment || totals.ausentes <= 0}
            title="Abrir ausentes"
          >
            <span>Ausências</span>
            <strong>{fmtNumber(totals.ausentes)}</strong>
            <small>nos departamentos em atenção</small>
          </button>
          <button
            type="button"
            className="pti-modal-card pti-modal-card-clickable pti-kpi-delay"
            onClick={() => runModalAction("OPEN_DEPARTMENT", { departamento: topDepartment?.nome, category: "atrasos" })}
            disabled={!hasAction || !topDepartment || totals.atrasados <= 0}
            title="Abrir atrasos"
          >
            <span>Atrasos</span>
            <strong>{fmtNumber(totals.atrasados)}</strong>
            <small>nos departamentos em atenção</small>
          </button>
        </div>

        <div className="pti-modal-actions">
          <div>
            <h3>Próxima ação</h3>
            <p>{firstAction?.label || "Manter acompanhamento do dia."}</p>
          </div>
          <div className="pti-modal-action-buttons">
            {firstAction ? (
              <ActionButton
                onClick={() => runModalAction(firstAction.action, firstAction.payload)}
                disabled={!hasAction}
              >
                {actionLabel(firstAction.action, "Executar")}
              </ActionButton>
            ) : null}
          </div>
        </div>

        <div className="pti-modal-section">
          <h3>Resumo</h3>
          <p>{analysis.diagnosis || "Sem diagnóstico disponível para este recorte."}</p>
          {analysis.reasons?.length ? (
            <ul className="pti-modal-list">
              {analysis.reasons.map((reason) => (
                <li key={reason}>{reason}</li>
              ))}
            </ul>
          ) : null}
        </div>

        <div className="pti-modal-section">
          <h3>Departamentos em atenção</h3>
          {departments.length ? (
            <div className="pti-modal-table">
              {departments.slice(0, 8).map((dept, index) => (
                <div className="pti-modal-row" key={`${dept.nome}-${index}`}>
                  <span className="pti-modal-rank">{index + 1}</span>
                  <strong>{dept.nome}</strong>
                  <small>{departmentMetrics(dept)}</small>
                  <button
                    type="button"
                    onClick={() => runModalAction("OPEN_DEPARTMENT", resolveDepartmentPayload(dept))}
                    disabled={!hasAction}
                  >
                    Abrir
                  </button>
                </div>
              ))}
            </div>
          ) : (
            <p className="pti-muted">Nenhum departamento crítico identificado no momento.</p>
          )}
        </div>

        <div className="pti-modal-section pti-modal-questions" ref={questionsRef}>
          <h3>Perguntas rápidas</h3>
          <div className="pti-question-list">
            {TODAY_POSITION_QUESTIONS.map((question) => (
              <button
                type="button"
                key={question.id}
                className={selectedQuestion?.id === question.id ? "active" : ""}
                onClick={() => setSelectedQuestion(question)}
              >
                {question.label}
              </button>
            ))}
          </div>
          {answer ? (
            <div className="pti-answer">
              <div className="pti-answer-head">
                <strong>{answerTitle}</strong>
                {answer.actions?.length ? (
                  <div className="pti-action-row">
                    {answer.actions.map((item) => (
                      <ActionButton
                        key={`${answer.id}-${item.label}`}
                        onClick={() => runModalAction(item.action, item.payload)}
                        disabled={!hasAction}
                      >
                        {item.label}
                      </ActionButton>
                    ))}
                  </div>
                ) : null}
              </div>
              {answerSummary ? <p>{answerSummary}</p> : null}
              {answerEvidence.length ? (
                <ul>
                  {answerEvidence.map((item) => (
                    <li key={item}>{item}</li>
                  ))}
                </ul>
              ) : null}
            </div>
          ) : null}
        </div>

        {analysis.limitations?.length ? (
          <div className="pti-modal-section pti-modal-limits">
            <h3>Limitações da leitura</h3>
            <ul className="pti-modal-list">
              {analysis.limitations.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          </div>
        ) : null}
        {!expanded ? (
          <button
            type="button"
            className="pti-modal-resize"
            onPointerDown={startResize}
            aria-label="Redimensionar"
            title="Arrastar para redimensionar"
          />
        ) : null}
      </section>
    </div>
  );
}

export function OperationalDiagnosisPanel({
  data,
  analysis: analysisProp = null,
  onAction,
  className = "",
}) {
  const analysis = useMemo(
    () => analysisProp || analyzeOperationalStatus(data || {}),
    [analysisProp, data],
  );
  const [selectedQuestion, setSelectedQuestion] = useState(TODAY_POSITION_QUESTIONS[0] || null);
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [detailsFocus, setDetailsFocus] = useState(null);
  const [panelExpanded, setPanelExpanded] = useState(false);

  const openDetails = () => {
    setDetailsFocus(null);
    setDetailsOpen(true);
  };
  const openQuestions = () => {
    setDetailsFocus("questions");
    setDetailsOpen(true);
  };
  const closeDetails = () => {
    setDetailsOpen(false);
    setDetailsFocus(null);
  };

  const answer = useMemo(() => {
    if (!selectedQuestion) return null;
    return answerTodayQuestion(selectedQuestion, data || {}, analysis);
  }, [analysis, data, selectedQuestion]);
  const answerEvidence = answer?.evidence || answer?.evidences || [];
  const answerTitle = answer?.title || selectedQuestion?.label || "Resposta";
  const answerSummary = answer?.summary || answer?.interpretation || "";

  const hasAction = typeof onAction === "function";
  const topDepartment = analysis.affectedDepartments?.[0] || null;
  const op = analysis.operationStatus || {};
  const firstAction = analysis.recommendedFirstAction || analysis.recommendedActions?.[0] || null;
  const hasAttentionPoints = (analysis.affectedDepartments?.length || 0) > 0;
  const anomalyTitle = op.code === "NORMAL" ? "Pontos de atenção" : "Anomalias detectadas";

  const runAction = (action, payload) => {
    if (hasAction && action) onAction(action, payload || {});
  };

  return (
    <>
      <section
        className={`pti-panel ${panelExpanded ? "pti-panel-expanded" : "pti-panel-collapsed"} ${className}`}
        aria-label="Diagnóstico operacional"
      >
        <header className="pti-panel-head">
          <div className="pti-panel-title">
            <h3>Diagnóstico operacional</h3>
          </div>
          <div className="pti-panel-tools">
            <button
              type="button"
              className="pti-toggle-btn"
              onClick={() => setPanelExpanded((current) => !current)}
              aria-expanded={panelExpanded}
            >
              {panelExpanded ? "Recolher" : "Expandir"}
            </button>
            <button type="button" className="pti-details-btn" onClick={openDetails}>
              Ver análise
            </button>
          </div>
        </header>

        <div className="pti-reading-row">
          <span>Leitura automática da posição do dia</span>
          <div className={`pti-status pti-status-${op.code || "UNKNOWN"}`}>
            <strong>{op.label || "Sem leitura"}</strong>
            <span>{fmtPct(op.coveragePct)}</span>
          </div>
        </div>

        <div className="pti-summary">
          <strong>{analysis.diagnosis}</strong>
          {analysis.reasons?.length ? (
            <ul>
              {analysis.reasons.slice(0, panelExpanded ? 3 : 2).map((reason) => (
                <li key={reason}>{reason}</li>
              ))}
            </ul>
          ) : null}
          {analysis.dataQualityWarnings?.length ? (
            <p className="pti-data-warning">
              {analysis.dataQualityWarnings[0]}
            </p>
          ) : null}
          {!panelExpanded ? (
            <div className="pti-action-row pti-compact-actions">
              <ActionButton onClick={openQuestions}>Perguntar</ActionButton>
            </div>
          ) : null}
        </div>

        {panelExpanded ? (
          <>
            <div className="pti-next-action">
              <span>Prioridade agora</span>
              <strong>{firstAction?.label || "Manter acompanhamento do dia"}</strong>
              <div className="pti-action-row">
                {firstAction ? (
                  <ActionButton
                    onClick={() => runAction(firstAction.action, firstAction.payload)}
                    disabled={!hasAction}
                  >
                    {actionLabel(firstAction.action, "Executar")}
                  </ActionButton>
                ) : null}
                {topDepartment ? (
                  <ActionButton
                    onClick={() => runAction("OPEN_DEPARTMENT", resolveDepartmentPayload(topDepartment))}
                    disabled={!hasAction}
                  >
                    Ver foco
                  </ActionButton>
                ) : null}
                <ActionButton onClick={openQuestions}>Perguntar</ActionButton>
              </div>
            </div>

            {hasAttentionPoints ? (
              <div className="pti-departments">
                <h4>Departamentos em atenção</h4>
                {analysis.affectedDepartments.slice(0, 3).map((dept, index) => (
                  <button
                    type="button"
                    className="pti-dept-row"
                    key={`${dept.nome}-${index}`}
                    onClick={() => runAction("OPEN_DEPARTMENT", resolveDepartmentPayload(dept))}
                    disabled={!hasAction}
                  >
                    <span className="pti-rank">{index + 1}</span>
                    <strong>{dept.nome}</strong>
                    <small>{departmentMetrics(dept)}</small>
                    <em>Ver</em>
                  </button>
                ))}
              </div>
            ) : null}

            <div className="pti-anomalies">
              <h4>{anomalyTitle}</h4>
              {analysis.anomalies?.length ? (
                analysis.anomalies.slice(0, 2).map((item) => (
                  <article key={item.title} className="pti-anomaly">
                    <strong>{item.title}</strong>
                    <span>{item.description}</span>
                  </article>
                ))
              ) : (
                <article>
                  <strong>Sem anomalias relevantes</strong>
                  <span>Continue acompanhando cobertura, faltas e atrasos durante o dia.</span>
                </article>
              )}
            </div>
          </>
        ) : null}
      </section>

      {detailsOpen ? (
        <DiagnosisDetailsModal
          analysis={analysis}
          op={op}
          topDepartment={topDepartment}
          onClose={closeDetails}
          runAction={runAction}
          hasAction={hasAction}
          selectedQuestion={selectedQuestion}
          setSelectedQuestion={setSelectedQuestion}
          answer={answer}
          answerTitle={answerTitle}
          answerSummary={answerSummary}
          answerEvidence={answerEvidence}
          focusQuestions={detailsFocus === "questions"}
        />
      ) : null}
    </>
  );
}

export default OperationalDiagnosisPanel;
