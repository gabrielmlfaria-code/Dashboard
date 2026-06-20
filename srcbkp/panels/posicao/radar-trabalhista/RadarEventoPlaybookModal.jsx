import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Scale,
  ListChecks,
  DollarSign,
  Info,
  X,
  ExternalLink,
  GripHorizontal,
  ScrollText,
  Save,
  ChevronDown,
  ChevronUp,
  AlertTriangle,
  FileText,
  BookOpen,
} from "lucide-react";
import { fmtBRL } from "./radarPassivoUtils.js";
import { createCctBlobUrl } from "../posicaoCctStorage.js";
import { loadPlaybookCctSections } from "./rtPlaybookCctBridge.js";
import {
  buildPlaybookPenaltyItems,
  findPlaybookForEvent,
} from "./rtEventPlaybooks.js";
import { getLegalSourcesForPlaybook } from "./rtPlaybookLegalLinks.js";
import {
  appendPlaybookAuditLog,
  formatAuditTs,
  getPlaybookEventKey,
  auditAreaLabel,
  loadPlaybookAuditLog,
  loadPlaybookNotes,
  savePlaybookNote,
} from "./rtPlaybookNotesStorage.js";
import { useRtPlaybookPanelLayout } from "./useRtPlaybookPanelLayout.js";

const DISCLAIMER =
  "Ferramenta complementar de apoio à gestão. Não substitui advogados, contadores, consultores de RH ou demais profissionais legalmente habilitados. Decisões contratuais, financeiras e processuais exigem análise humana qualificada e, quando cabível, parecer formal do jurídico da empresa.";

function fmtHours(value) {
  const n = Math.max(0, Number(value) || 0);
  const h = Math.floor(n);
  const m = Math.round((n - h) * 60);
  if (h <= 0 && m <= 0) return "0 h";
  if (m === 60) return `${h + 1} h`;
  return m > 0 ? `${h} h ${String(m).padStart(2, "0")} min` : `${h} h`;
}

/**
 * Painel de boas práticas — arrastável, redimensionável, notas RH/Jurídico e trilha de auditoria.
 */
export function RadarEventoPlaybookModal({ eventRow, passivoCfg, onClose }) {
  const { panelStyle, onDragStart, onResizeStart, resetLayout } = useRtPlaybookPanelLayout();
  const eventKey = useMemo(
    () => (eventRow ? getPlaybookEventKey(eventRow.evento) : ""),
    [eventRow],
  );

  const playbook = useMemo(
    () => (eventRow ? findPlaybookForEvent(eventRow.evento) : null),
    [eventRow],
  );

  const legalSources = useMemo(
    () => (playbook ? getLegalSourcesForPlaybook(playbook) : []),
    [playbook],
  );

  const penalties = useMemo(
    () => (eventRow ? buildPlaybookPenaltyItems(eventRow, passivoCfg) : []),
    [eventRow, passivoCfg],
  );

  const [notes, setNotes] = useState({ juridico: "", rh: "" });
  const [draftJuridico, setDraftJuridico] = useState("");
  const [draftRh, setDraftRh] = useState("");
  const [draftClausulaCct, setDraftClausulaCct] = useState("");
  const [author, setAuthor] = useState("");
  const [auditLog, setAuditLog] = useState([]);
  const [showLog, setShowLog] = useState(false);
  const [saveMsg, setSaveMsg] = useState("");
  const [disclaimerOpen, setDisclaimerOpen] = useState(false);
  const [cctSections, setCctSections] = useState([]);
  const [cctLoading, setCctLoading] = useState(true);
  const openedLoggedRef = useRef(false);

  const penaltyKind = playbook?.penaltyKind || eventRow?.kind || "generic";

  const refreshCct = useCallback(async () => {
    if (!penaltyKind) return;
    setCctLoading(true);
    try {
      const sections = await loadPlaybookCctSections(penaltyKind);
      setCctSections(sections);
    } finally {
      setCctLoading(false);
    }
  }, [penaltyKind]);

  useEffect(() => {
    refreshCct();
    const onCct = () => refreshCct();
    window.addEventListener("pb-cct-changed", onCct);
    return () => window.removeEventListener("pb-cct-changed", onCct);
  }, [refreshCct]);

  const openCctPdf = useCallback(async (id) => {
    const url = await createCctBlobUrl(id);
    if (!url) return;
    window.open(url, "_blank", "noopener,noreferrer");
    setTimeout(() => URL.revokeObjectURL(url), 120_000);
  }, []);

  useEffect(() => {
    if (!eventKey) return;
    const n = loadPlaybookNotes(eventKey);
    setNotes(n);
    setDraftJuridico(n.juridico);
    setDraftRh(n.rh);
    setDraftClausulaCct(n.clausulaCct);
    setAuditLog(loadPlaybookAuditLog(eventKey, 50));
    if (!openedLoggedRef.current) {
      openedLoggedRef.current = true;
      appendPlaybookAuditLog({
        action: "painel_aberto",
        area: "sistema",
        eventKey,
        eventTitle: eventRow?.evento || eventKey,
        author: "Sistema",
        preview: "Visualização do playbook de orientação",
      });
      setAuditLog(loadPlaybookAuditLog(eventKey, 50));
    }
  }, [eventKey, eventRow?.evento]);

  const refreshLog = useCallback(() => {
    setAuditLog(loadPlaybookAuditLog(eventKey, 50));
  }, [eventKey]);

  const handleSaveNote = useCallback(
    (area) => {
      const text =
        area === "juridico"
          ? draftJuridico
          : area === "rh"
            ? draftRh
            : draftClausulaCct;
      const saved = savePlaybookNote(eventKey, area, text, {
        author:
          author ||
          (area === "juridico" ? "Jurídico" : area === "rh" ? "RH" : "Jurídico/RH"),
        eventTitle: eventRow?.evento,
      });
      setNotes(saved);
      setSaveMsg(
        area === "juridico"
          ? "Parecer / orientação jurídica registrada."
          : area === "rh"
            ? "Recomendação de RH registrada."
            : "Cláusula CCT (manual) registrada.",
      );
      refreshLog();
      setTimeout(() => setSaveMsg(""), 4000);
    },
    [author, draftJuridico, draftRh, draftClausulaCct, eventKey, eventRow?.evento, refreshLog],
  );

  if (!eventRow || !playbook) return null;

  const impactClass =
    playbook.impact === "alto"
      ? "rt-pb-impact--high"
      : playbook.impact === "baixo"
        ? "rt-pb-impact--low"
        : "rt-pb-impact--med";
  const ocorrencias = Number(eventRow.ocorrencias) || 0;
  const colaboradores = Number(eventRow.colaboradores) || 0;
  const horasBase = Number(eventRow.horasBase) || Math.max(0, Number(eventRow.horas) || 0) / 60;
  const sh = Number(passivoCfg?.sh) || 0;
  const regimeLabel = "Regra legal atual";
  const actionSteps = playbook.conduct.slice(0, 4);

  return (
    <div className="rt-pb-ov" role="presentation">
      <div
        className="rt-pb-modal rt-pb-modal--floating"
        style={panelStyle}
        role="dialog"
        aria-labelledby="rt-pb-title"
        aria-describedby="rt-pb-disclaimer-main"
      >
        <header
          className="rt-pb-head rt-pb-head--drag"
          onMouseDown={onDragStart}
          title="Arraste para mover o painel"
        >
          <GripHorizontal className="rt-pb-grip" aria-hidden />
          <div className="rt-pb-head-main">
            {playbook.order != null ? (
              <span className="rt-pb-order" aria-hidden>
                {playbook.order}
              </span>
            ) : null}
            <div className="rt-pb-head-text">
              <p className="rt-pb-subtitle">{playbook.subtitle}</p>
              <h2 id="rt-pb-title" className="rt-pb-title">
                {playbook.title}
              </h2>
            </div>
          </div>
          <div className="rt-pb-head-badges">
            <span className={`rt-pb-badge rt-pb-badge--impact ${impactClass}`}>
              {playbook.impact === "alto"
                ? "Alto impacto"
                : playbook.impact === "baixo"
                  ? "Baixo impacto"
                  : "Médio impacto"}
            </span>
            <span className="rt-pb-badge rt-pb-badge--tag">{playbook.tag}</span>
            <button
              type="button"
              className="rt-pb-reset-size"
              onClick={resetLayout}
              title="Restaurar tamanho e posição do painel"
            >
              ↺
            </button>
            <button type="button" className="rt-pb-close" onClick={onClose} aria-label="Fechar">
              <X className="h-5 w-5" />
            </button>
          </div>
        </header>

        <div className="rt-pb-scroll">
          <section className="rt-pb-exec">
            <div>
              <span className="rt-pb-exec-label">Resumo do evento</span>
              <strong>
                {ocorrencias.toLocaleString("pt-BR")} ocorrências · {colaboradores.toLocaleString("pt-BR")} colaboradores · {fmtBRL(eventRow.passivo)}
              </strong>
              <p>
                Prioridade {playbook.impact === "alto" ? "alta" : playbook.impact === "baixo" ? "baixa" : "média"} para revisão de escala, intervalo e tratativa RH/Jurídico.
              </p>
            </div>
            <span className={`rt-pb-exec-chip ${impactClass}`}>
              {playbook.impact === "alto" ? "Ação prioritária" : "Acompanhar"}
            </span>
          </section>

          <div
            id="rt-pb-disclaimer-main"
            className={`rt-pb-disclaimer-banner${disclaimerOpen ? " is-open" : " is-collapsed"}`}
            role="note"
          >
            <button
              type="button"
              className="rt-pb-disclaimer-toggle"
              onClick={() => setDisclaimerOpen((v) => !v)}
              aria-expanded={disclaimerOpen}
            >
              <AlertTriangle className="h-4 w-4 shrink-0" aria-hidden />
              <span>Aviso legal — ferramenta complementar (não substitui profissionais habilitados)</span>
              {disclaimerOpen ? (
                <ChevronUp className="h-4 w-4 shrink-0" aria-hidden />
              ) : (
                <ChevronDown className="h-4 w-4 shrink-0" aria-hidden />
              )}
            </button>
            {disclaimerOpen ? <p className="rt-pb-disclaimer-text">{DISCLAIMER}</p> : null}
          </div>

          <div className="rt-pb-stats">
            <div>
              <span>Ocorrências</span>
              <strong>{(eventRow.ocorrencias ?? 0).toLocaleString("pt-BR")}</strong>
            </div>
            <div>
              <span>Colaboradores</span>
              <strong>{(eventRow.colaboradores ?? 0).toLocaleString("pt-BR")}</strong>
            </div>
            <div>
              <span>Estimativa trabalhista</span>
              <strong>{fmtBRL(eventRow.passivo)}</strong>
            </div>
            <div>
              <span>Cálculo usado</span>
              <strong>{eventRow.formula || "—"}</strong>
            </div>
          </div>

          <div className="rt-pb-body">
            <div className="rt-pb-main">
              <section className="rt-pb-section rt-pb-actions">
                <h3 className="rt-pb-section-title">
                  <ListChecks className="h-4 w-4" />
                  Próximas ações recomendadas
                </h3>
                <ol className="rt-pb-conduct rt-pb-conduct--priority">
                  {actionSteps.map((step, i) => (
                    <li key={i}>{step}</li>
                  ))}
                </ol>
              </section>

              <section className="rt-pb-section">
                <h3 className="rt-pb-section-title">
                  <Scale className="h-4 w-4" />
                  Base legal
                </h3>
                <p className="rt-pb-legal">{playbook.legalBasis}</p>
                {eventRow.baseLegal ? (
                  <p className="rt-pb-legal-ref">
                    <strong>Referência no sistema:</strong> {eventRow.baseLegal}
                  </p>
                ) : null}
                <div className="rt-pb-sources">
                  <span className="rt-pb-sources-lbl">Fontes para consulta:</span>
                  <ul className="rt-pb-sources-list">
                    {legalSources.map((src) => (
                      <li key={src.url}>
                        <a
                          href={src.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="rt-pb-source-link"
                        >
                          {src.label}
                          <ExternalLink className="h-3 w-3" aria-hidden />
                        </a>
                      </li>
                    ))}
                  </ul>
                </div>
              </section>

              <section className="rt-pb-section rt-pb-cct">
                <h3 className="rt-pb-section-title">
                  <FileText className="h-4 w-4" />
                  CCT da empresa
                </h3>
                <p className="rt-pb-section-hint">
                  Cruzamento com convenção(ões) importadas na aba CCT. Cláusulas extraídas do texto
                  do PDF quando disponível; em PDF digitalizado use «Abrir PDF» e registre no
                  Jurídico/RH. Complementa — não substitui leitura da convenção nem parecer
                  profissional.
                </p>
                {notes.clausulaCct ? (
                  <div className="rt-pb-cct-manual-saved">
                    <strong>Cláusula CCT registrada (manual)</strong>
                    <p className="rt-pb-cct-manual-text">{notes.clausulaCct}</p>
                    {notes.clausulaCctUpdatedAt ? (
                      <p className="rt-pb-note-meta">
                        Salvo em {formatAuditTs(notes.clausulaCctUpdatedAt)}
                        {notes.clausulaCctUpdatedBy ? ` · ${notes.clausulaCctUpdatedBy}` : ""}
                      </p>
                    ) : null}
                  </div>
                ) : null}
                {cctLoading ? (
                  <p className="rt-pb-cct-loading">Carregando dados da CCT…</p>
                ) : (
                  <div className="rt-pb-cct-list">
                    {cctSections.map((sec, idx) =>
                      sec.empty ? (
                        <div key={`empty-${idx}`} className="rt-pb-cct-card rt-pb-cct-card--empty">
                          <p>{sec.message}</p>
                          <button
                            type="button"
                            className="rt-btn rt-pb-cct-goto"
                            onClick={() => window.dispatchEvent(new CustomEvent("pb-show-cct"))}
                          >
                            <BookOpen className="h-3.5 w-3.5" />
                            Ir para aba CCT
                          </button>
                        </div>
                      ) : (
                        <div key={sec.id} className="rt-pb-cct-card">
                          <div className="rt-pb-cct-card-head">
                            <strong>{sec.label}</strong>
                            <span className="rt-pb-cct-vig">{sec.vigencia}</span>
                          </div>
                          {sec.validityPeriod ? (
                            <p className="rt-pb-cct-meta">
                              Vigência: {sec.validityPeriod}
                              {sec.parties ? ` · ${sec.parties}` : ""}
                            </p>
                          ) : null}
                          {sec.points.length > 0 ? (
                            <ul className="rt-pb-cct-points">
                              {sec.points.map((pt, i) => (
                                <li key={i}>
                                  <span className="rt-pb-cct-pt-lbl">{pt.label}</span>
                                  <span className="rt-pb-cct-pt-val">{pt.value}</span>
                                </li>
                              ))}
                            </ul>
                          ) : null}
                          {sec.snippets?.length > 0 ? (
                            <div className="rt-pb-cct-snippets">
                              <span className="rt-pb-cct-snippets-lbl">Trechos do texto da convenção</span>
                              {sec.snippets.map((sn, i) => (
                                <blockquote key={i} className="rt-pb-cct-snippet">
                                  {sn.text}
                                </blockquote>
                              ))}
                            </div>
                          ) : null}
                          {sec.message ? <p className="rt-pb-cct-msg">{sec.message}</p> : null}
                          <div className="rt-pb-cct-actions">
                            <button
                              type="button"
                              className="rt-btn rt-pb-cct-goto"
                              onClick={() => openCctPdf(sec.id)}
                            >
                              Abrir PDF
                            </button>
                            <button
                              type="button"
                              className="rt-btn"
                              onClick={() => window.dispatchEvent(new CustomEvent("pb-show-cct"))}
                            >
                              Aba CCT
                            </button>
                          </div>
                        </div>
                      ),
                    )}
                  </div>
                )}
              </section>

              <section className="rt-pb-section rt-pb-notes">
                <h3 className="rt-pb-section-title">Pareceres e recomendações da empresa</h3>
                <p className="rt-pb-section-hint">
                  Textos salvos neste navegador, vinculados ao evento. Registro automático em log de
                  auditoria (data, área e responsável).
                </p>
                <label className="rt-pb-field-lbl" htmlFor="rt-pb-author">
                  Responsável (nome ou área)
                </label>
                <input
                  id="rt-pb-author"
                  type="text"
                  className="rt-pb-inp"
                  placeholder="Ex.: Dr. Silva / Jurídico / RH Campinas"
                  value={author}
                  onChange={(e) => setAuthor(e.target.value)}
                  maxLength={80}
                />

                <div className="rt-pb-note-block rt-pb-note-block--cct">
                  <label className="rt-pb-field-lbl" htmlFor="rt-pb-clausula-cct">
                    Cláusula CCT (manual)
                  </label>
                  <p className="rt-pb-section-hint">
                    Transcreva ou resuma a cláusula da convenção que trata deste evento (número da
                    cláusula, percentuais, exceções). Vinculado a este tipo de ocorrência no
                    navegador.
                  </p>
                  <textarea
                    id="rt-pb-clausula-cct"
                    className="rt-pb-textarea"
                    rows={4}
                    value={draftClausulaCct}
                    onChange={(e) => setDraftClausulaCct(e.target.value)}
                    placeholder="Ex.: Cláusula 12ª — Intervalo intrajornada de 1h; redução para 30 min mediante acordo..."
                  />
                  <button
                    type="button"
                    className="rt-btn rt-btn--primary rt-pb-save-btn"
                    onClick={() => handleSaveNote("cct")}
                  >
                    <Save className="h-3.5 w-3.5" />
                    Salvar cláusula CCT
                  </button>
                </div>

                <div className="rt-pb-notes-grid">
                  <div className="rt-pb-note-block">
                    <label className="rt-pb-field-lbl" htmlFor="rt-pb-juridico">
                      Jurídico — parecer ou orientação
                    </label>
                    <textarea
                      id="rt-pb-juridico"
                      className="rt-pb-textarea"
                      rows={5}
                      value={draftJuridico}
                      onChange={(e) => setDraftJuridico(e.target.value)}
                      placeholder="Inclua parecer, precedentes internos, estratégia processual..."
                    />
                    <button
                      type="button"
                      className="rt-btn rt-btn--primary rt-pb-save-btn"
                      onClick={() => handleSaveNote("juridico")}
                    >
                      <Save className="h-3.5 w-3.5" />
                      Salvar jurídico
                    </button>
                    {notes.juridico && notes.updatedAt ? (
                      <p className="rt-pb-note-meta">
                        Última gravação: {formatAuditTs(notes.updatedAt)}
                        {notes.updatedBy ? ` · ${notes.updatedBy}` : ""}
                      </p>
                    ) : null}
                  </div>
                  <div className="rt-pb-note-block">
                    <label className="rt-pb-field-lbl" htmlFor="rt-pb-rh">
                      RH — recomendações operacionais
                    </label>
                    <textarea
                      id="rt-pb-rh"
                      className="rt-pb-textarea"
                      rows={5}
                      value={draftRh}
                      onChange={(e) => setDraftRh(e.target.value)}
                      placeholder="Inclua fluxo interno, comunicados, prazos, treinamentos..."
                    />
                    <button
                      type="button"
                      className="rt-btn rt-btn--primary rt-pb-save-btn"
                      onClick={() => handleSaveNote("rh")}
                    >
                      <Save className="h-3.5 w-3.5" />
                      Salvar RH
                    </button>
                    {notes.rh ? (
                      <p className="rt-pb-note-meta">Conteúdo de RH salvo localmente.</p>
                    ) : null}
                  </div>
                </div>
                {saveMsg ? <p className="rt-pb-save-msg">{saveMsg}</p> : null}
              </section>

              <section className="rt-pb-section rt-pb-audit">
                <button
                  type="button"
                  className="rt-pb-audit-toggle"
                  onClick={() => setShowLog((v) => !v)}
                  aria-expanded={showLog}
                >
                  <ScrollText className="h-4 w-4" />
                  Log de auditoria ({auditLog.length})
                  {showLog ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                </button>
                {showLog ? (
                  <ul className="rt-pb-audit-list">
                    {auditLog.length === 0 ? (
                      <li className="rt-pb-audit-empty">Nenhum registro ainda.</li>
                    ) : (
                      auditLog.map((row) => (
                        <li key={row.id}>
                          <span className="rt-pb-audit-ts">{formatAuditTs(row.ts)}</span>
                          <span className="rt-pb-audit-action">
                            {row.action === "nota_salva"
                              ? `Nota salva (${auditAreaLabel(row.area)})`
                              : row.action === "nota_limpa"
                                ? `Nota removida (${auditAreaLabel(row.area)})`
                                : row.action === "painel_aberto"
                                  ? "Painel aberto"
                                  : row.action}
                          </span>
                          <span className="rt-pb-audit-who">{row.author || "—"}</span>
                          {row.preview ? (
                            <span className="rt-pb-audit-preview">{row.preview}</span>
                          ) : null}
                        </li>
                      ))
                    )}
                  </ul>
                ) : null}
              </section>
            </div>

            <aside className="rt-pb-side">
              <h3 className="rt-pb-side-title">
                <DollarSign className="h-4 w-4" />
                Como a estimativa foi calculada
              </h3>
              <div className="rt-pb-calc-box">
                <div>
                  <span>Horas consideradas</span>
                  <strong>{fmtHours(horasBase)}</strong>
                </div>
                <div>
                  <span>Salário-hora</span>
                  <strong>{fmtBRL(sh)}</strong>
                </div>
                <div>
                  <span>Adicional</span>
                  <strong>50%</strong>
                </div>
                <div>
                  <span>Regime</span>
                  <strong>{regimeLabel}</strong>
                </div>
              </div>
              <ul className="rt-pb-penalties">
                {penalties.map((item, i) => (
                  <li key={i}>
                    <Info className="h-3.5 w-3.5 shrink-0" aria-hidden />
                    <span>{item.text}</span>
                  </li>
                ))}
              </ul>
              <p className="rt-pb-disclaimer">
                Valor preliminar para priorização interna. Multa em fiscalização e cálculo de folha
                dependem de enquadramento, CCT, auditoria e parecer profissional.
              </p>
            </aside>
          </div>
        </div>

        <div
          className="rt-pb-resize-handle"
          onMouseDown={onResizeStart}
          title="Arraste para redimensionar"
          aria-label="Redimensionar painel"
        />
      </div>
    </div>
  );
}


