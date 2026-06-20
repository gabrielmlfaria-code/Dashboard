import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link } from "@tanstack/react-router";
import { Toast } from "../../../core/toast.js";
import {
  NR1_ALERTA,
  NR1_BADGE_GRO,
  NR1_BADGE_PRAZO,
  NR1_CARDS,
  NR1_CHECKLIST_GRUPOS,
  NR1_CHECKLIST_REQUIRES,
  NR1_DISCLAIMER,
  NR1_FONTES,
  NR1_REG_STATUS_BADGE,
  NR1_RISCO_OPTIONS,
  NR1_STATUS_BADGE,
  NR1_STATUS_OPTIONS,
  NR1_TIPO_OPTIONS,
  computeNr1ChecklistPct,
  computeNr1Stats,
  countNr1ChecklistTotal,
  exportNr1RegistrosCsv,
  formatNr1DataBr,
  nr1ChecklistMetaComplete,
  validateNr1RegistroConcluido,
} from "./nr1Data.js";
import { buildNr1IndicadoresSst } from "./nr1Indicadores.js";
import { downloadNr1MatrizConformidadeReport } from "./nr1Matriz.js";
import { downloadNr1PgrTemplate } from "./nr1PgrTemplate.js";
import { downloadNr1ConformidadeReport } from "./nr1Report.js";
import {
  NR1_MAX_ANEXO_BYTES,
  NR1_MAX_ANEXOS,
  downloadNr1Anexo,
  downloadNr1Backup,
  importNr1BackupData,
  loadNr1Anexo,
  loadNr1EstadoPersisted,
  loadNr1CardsProg,
  loadNr1Checklist,
  loadNr1ChecklistMeta,
  loadNr1Registros,
  removeNr1Anexos,
  saveNr1Anexo,
  saveNr1EstadoPersisted,
} from "./nr1Storage.js";

const TABS = [
  { id: "visao", label: "Visão Geral" },
  { id: "checklist", label: "Checklist GRO" },
  { id: "registrar", label: "Registrar Ação" },
  { id: "historico", label: "Histórico" },
  { id: "fontes", label: "Fontes Oficiais" },
];

const STORAGE_NOTE =
  "Registros, checklist, anexos (IndexedDB) e backup JSON no navegador — exporte para GED corporativo.";

const emptyForm = () => ({
  data: new Date().toISOString().split("T")[0],
  tipo: "",
  setor: "",
  resp: "",
  part: "",
  status: "",
  risco: "",
  prazo: "",
  desc: "",
  pendingAnexos: [],
});

export function Nr1Card({
  empresaLabel = "",
  histRows = [],
  showBackLink = false,
  theme = "light",
  onToggleTheme = null,
}) {
  const [activeTab, setActiveTab] = useState("visao");
  const [registros, setRegistros] = useState(() => loadNr1Registros());
  const [checkState, setCheckState] = useState(() => loadNr1Checklist());
  const [checklistMeta, setChecklistMeta] = useState(() => loadNr1ChecklistMeta());
  const [cardsProg, setCardsProg] = useState(() => loadNr1CardsProg());
  const [search, setSearch] = useState("");
  const [form, setForm] = useState(emptyForm);
  const [modalRegistro, setModalRegistro] = useState(null);
  const [backupBusy, setBackupBusy] = useState(false);
  const backupInputRef = useRef(null);
  const hydratedRef = useRef(false);

  const empresaDisplay = empresaLabel || "Empresa";
  const indicadores = useMemo(() => buildNr1IndicadoresSst(histRows), [histRows]);

  useEffect(() => {
    let alive = true;
    loadNr1EstadoPersisted()
      .then((estado) => {
        if (!alive) return;
        setRegistros(Array.isArray(estado.registros) ? estado.registros : []);
        setCheckState(estado.checkState || {});
        setChecklistMeta(estado.checklistMeta || {});
        setCardsProg(estado.cardsProg || {});
        hydratedRef.current = true;
      })
      .catch(() => {
        hydratedRef.current = true;
      });
    return () => {
      alive = false;
    };
  }, []);

  useEffect(() => {
    if (!hydratedRef.current) return;
    saveNr1EstadoPersisted({ registros, checkState, checklistMeta, cardsProg }).catch(() => {
      Toast.show("NÃ£o foi possÃ­vel salvar os dados do NR-1.", "e", 3000);
    });
  }, [registros, checkState, checklistMeta, cardsProg]);

  const stats = useMemo(() => computeNr1Stats(registros), [registros]);
  const checklistPct = useMemo(() => computeNr1ChecklistPct(checkState), [checkState]);
  const checklistDone = useMemo(() => Object.values(checkState).filter(Boolean).length, [checkState]);
  const checklistTotal = countNr1ChecklistTotal();

  const registrosFiltrados = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) return registros;
    return registros.filter(
      (r) =>
        r.tipo?.toLowerCase().includes(term) ||
        (r.setor || "").toLowerCase().includes(term) ||
        r.resp?.toLowerCase().includes(term) ||
        r.status?.toLowerCase().includes(term) ||
        (r.risco || "").toLowerCase().includes(term),
    );
  }, [registros, search]);

  const switchTab = useCallback((tabId) => setActiveTab(tabId), []);

  const updateForm = useCallback((field, value) => {
    setForm((prev) => ({ ...prev, [field]: value }));
  }, []);

  const limparForm = useCallback(() => setForm(emptyForm()), []);

  const atualizarProg = useCallback((cardId, value) => {
    const n = Math.max(0, Math.min(100, Number(value) || 0));
    setCardsProg((prev) => ({ ...prev, [cardId]: n }));
  }, []);

  const updateChecklistMetaField = useCallback((itemId, fieldKey, value) => {
    setChecklistMeta((prev) => ({
      ...prev,
      [itemId]: { ...(prev[itemId] || {}), [fieldKey]: value },
    }));
  }, []);

  const toggleCheck = useCallback(
    (id) => {
      const turningOn = !checkState[id];
      if (turningOn && NR1_CHECKLIST_REQUIRES[id]) {
        const meta = checklistMeta[id] || {};
        if (!nr1ChecklistMetaComplete(id, meta)) {
          Toast.show("Preencha os campos obrigatórios abaixo antes de marcar este item.", "w", 4000);
          return;
        }
      }
      setCheckState((prev) => ({ ...prev, [id]: !prev[id] }));
    },
    [checkState, checklistMeta],
  );

  const salvarChecklist = useCallback(() => {
    Toast.show("Progresso do checklist salvo!", "s", 3000);
  }, []);

  const resetChecklist = useCallback(() => {
    if (!window.confirm("Resetar todo o checklist e metadados?")) return;
    setCheckState({});
    setChecklistMeta({});
    Toast.show("Checklist resetado.", "i", 3000);
  }, []);

  const irParaRegistrar = useCallback((tipo) => {
    setForm({ ...emptyForm(), tipo: tipo || "" });
    setActiveTab("registrar");
  }, []);

  const adicionarAnexos = useCallback((fileList) => {
    const files = Array.from(fileList || []);
    if (!files.length) return;
    setForm((prev) => {
      const slots = NR1_MAX_ANEXOS - prev.pendingAnexos.length;
      if (slots <= 0) {
        Toast.show(`Máximo de ${NR1_MAX_ANEXOS} anexos por registro.`, "w", 3000);
        return prev;
      }
      const novos = [];
      for (const file of files.slice(0, slots)) {
        if (file.size > NR1_MAX_ANEXO_BYTES) {
          Toast.show(`"${file.name}" excede 5 MB.`, "e", 3500);
          continue;
        }
        novos.push({
          id: `${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
          file,
          nome: file.name,
          tipo: file.type || "application/octet-stream",
          tamanho: file.size,
        });
      }
      if (!novos.length) return prev;
      return { ...prev, pendingAnexos: [...prev.pendingAnexos, ...novos] };
    });
  }, []);

  const removerAnexoPendente = useCallback((anexoId) => {
    setForm((prev) => ({
      ...prev,
      pendingAnexos: prev.pendingAnexos.filter((a) => a.id !== anexoId),
    }));
  }, []);

  const registrarAcao = useCallback(async () => {
    const { data, tipo, setor, resp, part, status, risco, prazo, desc, pendingAnexos } = form;
    if (!data || !tipo || !resp || !status) {
      Toast.show("Preencha os campos obrigatórios (*).", "e", 3500);
      return;
    }
    const draft = {
      status,
      desc: desc.trim(),
      anexos: pendingAnexos,
    };
    const errosConcluido = validateNr1RegistroConcluido(draft);
    if (errosConcluido.length) {
      Toast.show(errosConcluido[0], "w", 4500);
      return;
    }
    const id = Date.now();
    const novo = {
      id,
      data,
      tipo,
      setor: setor.trim(),
      resp: resp.trim(),
      part: part ? Number(part) : null,
      status,
      risco,
      prazo,
      desc: desc.trim(),
      anexos: pendingAnexos.map((a) => ({
        id: a.id,
        nome: a.nome,
        tipo: a.tipo,
        tamanho: a.tamanho,
      })),
    };
    try {
      for (const anexo of pendingAnexos) {
        const ok = await saveNr1Anexo(id, anexo.id, anexo.file);
        if (!ok) throw new Error("Falha ao gravar anexo");
      }
      setRegistros((prev) => [novo, ...prev]);
      limparForm();
      Toast.show("Ação registrada com sucesso!", "s", 3500);
      setActiveTab("historico");
    } catch {
      await removeNr1Anexos(id, pendingAnexos);
      Toast.show("Erro ao salvar anexos. Tente novamente.", "e", 4000);
    }
  }, [form, limparForm]);

  const excluirRegistro = useCallback(async (id) => {
    if (!window.confirm("Excluir este registro e os anexos?")) return;
    const alvo = registros.find((r) => r.id === id);
    if (alvo?.anexos?.length) await removeNr1Anexos(id, alvo.anexos);
    setRegistros((prev) => prev.filter((r) => r.id !== id));
    Toast.show("Registro excluído.", "i", 3000);
  }, [registros]);

  const baixarAnexo = useCallback(async (registroId, anexo) => {
    const blob = await loadNr1Anexo(registroId, anexo.id);
    if (!blob) {
      Toast.show("Anexo não encontrado no navegador.", "e", 3000);
      return;
    }
    downloadNr1Anexo(blob, anexo.nome || "anexo");
  }, []);

  const exportarCsv = useCallback(() => {
    if (!registros.length) {
      Toast.show("Nenhum registro para exportar.", "e", 3000);
      return;
    }
    exportNr1RegistrosCsv(registros);
    Toast.show("CSV exportado!", "s", 3000);
  }, [registros]);

  const exportarRelatorio = useCallback(() => {
    downloadNr1ConformidadeReport({
      empresaLabel: empresaDisplay,
      stats,
      checkState,
      checklistPct,
      checklistDone,
      cardsProg,
      registros,
      histRows,
      indicadores,
    });
    Toast.show("Relatório completo exportado (dados + matriz)!", "s", 3500);
  }, [
    empresaDisplay,
    stats,
    checkState,
    checklistPct,
    checklistDone,
    cardsProg,
    registros,
    histRows,
    indicadores,
  ]);

  const exportarMatriz = useCallback(() => {
    downloadNr1MatrizConformidadeReport({
      empresaLabel: empresaDisplay,
      stats,
      checkState,
      checklistPct,
      checklistDone,
      cardsProg,
      registros,
      histRows,
    });
    Toast.show("Matriz de conformidade NR-1 exportada!", "s", 3000);
  }, [
    empresaDisplay,
    stats,
    checkState,
    checklistPct,
    checklistDone,
    cardsProg,
    registros,
    histRows,
  ]);

  const exportarPgr = useCallback(() => {
    downloadNr1PgrTemplate({ empresaLabel: empresaDisplay, checklistMeta });
    Toast.show("Modelo estrutural de PGR exportado!", "s", 3000);
  }, [empresaDisplay, checklistMeta]);

  const exportarBackup = useCallback(async () => {
    setBackupBusy(true);
    try {
      const payload = await downloadNr1Backup({
        registros,
        checkState,
        checklistMeta,
        cardsProg,
      });
      Toast.show(`Backup exportado (${payload.anexos.length} anexo(s)).`, "s", 3500);
    } catch {
      Toast.show("Falha ao exportar backup.", "e", 3500);
    } finally {
      setBackupBusy(false);
    }
  }, [registros, checkState, checklistMeta, cardsProg]);

  const restaurarBackup = useCallback(async (file) => {
    if (!file) return;
    if (!window.confirm("Substituir todos os dados locais do NR-1 pelo backup?")) return;
    setBackupBusy(true);
    try {
      const text = await file.text();
      const payload = JSON.parse(text);
      const restored = await importNr1BackupData(payload);
      setRegistros(restored.registros);
      setCheckState(restored.checkState);
      setChecklistMeta(restored.checklistMeta);
      setCardsProg(restored.cardsProg);
      Toast.show(
        `Backup restaurado: ${restored.registros.length} registro(s), ${restored.anexosRestored} anexo(s).`,
        "s",
        4000,
      );
    } catch (err) {
      Toast.show(err?.message || "Backup inválido.", "e", 4500);
    } finally {
      setBackupBusy(false);
      if (backupInputRef.current) backupInputRef.current.value = "";
    }
  }, []);

  const renderChecklistMeta = (itemId) => {
    const reqs = NR1_CHECKLIST_REQUIRES[itemId];
    if (!reqs?.length) return null;
    const meta = checklistMeta[itemId] || {};
    return (
      <div className="pb-nr1-check-meta">
        {reqs.map((f) => (
          <label key={f.key} className="pb-nr1-check-meta-field">
            <span>{f.label}</span>
            <input
              type={f.type || "text"}
              value={meta[f.key] || ""}
              onChange={(e) => updateChecklistMetaField(itemId, f.key, e.target.value)}
            />
          </label>
        ))}
      </div>
    );
  };

  return (
    <section className="pb-cell pb-nr1" aria-label="Gestão de Conformidade NR-1">
      <header className="pb-nr1-hero">
        <div className="pb-nr1-hero-copy">
          <h2 className="pb-nr1-hero-title">Gestão de Conformidade — NR-1</h2>
          <p className="pb-nr1-hero-sub">
            GRO · PGR · Riscos Psicossociais — {empresaDisplay} | SST
          </p>
        </div>
        <div className="pb-nr1-hero-actions">
          {showBackLink ? (
            <Link to="/" className="pb-nr1-back">
              ← Voltar ao dashboard
            </Link>
          ) : null}
          {typeof onToggleTheme === "function" ? (
            <button
              type="button"
              className="pb-nr1-theme"
              onClick={onToggleTheme}
              aria-label={theme === "dark" ? "Ativar tema claro" : "Ativar tema escuro"}
            >
              {theme === "dark" ? "Tema claro" : "Tema escuro"}
            </button>
          ) : null}
          <button
            type="button"
            className="pb-nr1-btn pb-nr1-btn--outline pb-nr1-btn--sm"
            onClick={exportarRelatorio}
            title="Relatório com registros, indicadores e matriz legal"
          >
            Exportar relatório
          </button>
          <button
            type="button"
            className="pb-nr1-btn pb-nr1-btn--outline pb-nr1-btn--sm"
            onClick={exportarMatriz}
            title="Matriz de conformidade legal NR-1"
          >
            Matriz legal
          </button>
          <button
            type="button"
            className="pb-nr1-btn pb-nr1-btn--outline pb-nr1-btn--sm"
            onClick={exportarPgr}
            title="Modelo estrutural de PGR para preenchimento"
          >
            Modelo PGR
          </button>
          <button
            type="button"
            className="pb-nr1-btn pb-nr1-btn--outline pb-nr1-btn--sm"
            onClick={exportarBackup}
            disabled={backupBusy}
            title="Backup JSON com registros, checklist e anexos"
          >
            {backupBusy ? "Aguarde…" : "Backup JSON"}
          </button>
          <button
            type="button"
            className="pb-nr1-btn pb-nr1-btn--outline pb-nr1-btn--sm"
            onClick={() => backupInputRef.current?.click()}
            disabled={backupBusy}
            title="Restaurar backup JSON"
          >
            Restaurar
          </button>
          <input
            ref={backupInputRef}
            type="file"
            accept="application/json,.json"
            className="pb-nr1-backup-input"
            onChange={(e) => restaurarBackup(e.target.files?.[0])}
          />
          <span className="pb-nr1-badge">{NR1_BADGE_GRO}</span>
          <span className="pb-nr1-badge pb-nr1-badge--prazo">{NR1_BADGE_PRAZO}</span>
        </div>
      </header>

      <div className="pb-nr1-body">
        <div className="pb-nr1-alert" role="alert">
          <span className="pb-nr1-alert-ico" aria-hidden="true">
            🚨
          </span>
          <div>
            <strong>Vigência obrigatória: 25 de maio de 2026</strong>
            <p>{NR1_ALERTA}</p>
          </div>
        </div>

        {indicadores.hasHist ? (
          <div className="pb-nr1-indicadores" role="region" aria-label="Indicadores SST do histórico">
            <div className="pb-nr1-indicadores-kpis">
              <div>
                <strong>{indicadores.diasHist}</strong>
                <span>Dias no recorte</span>
              </div>
              <div>
                <strong>{indicadores.colaboradores}</strong>
                <span>Colaboradores</span>
              </div>
              <div>
                <strong>{indicadores.eventosAusencia}</strong>
                <span>Ausências detectadas</span>
              </div>
              <div>
                <strong>{indicadores.eventosAfastamento}</strong>
                <span>Afastamentos detectados</span>
              </div>
            </div>
            {indicadores.alertas.length ? (
              <ul className="pb-nr1-indicadores-alertas">
                {indicadores.alertas.map((msg) => (
                  <li key={msg}>{msg}</li>
                ))}
              </ul>
            ) : null}
          </div>
        ) : null}

        <div className="pb-nr1-summary" role="group" aria-label="Resumo de ações NR-1">
          <div className="pb-nr1-stat pb-nr1-stat--red">
            <strong>{stats.total.toLocaleString("pt-BR")}</strong>
            <span>Ações cadastradas</span>
          </div>
          <div className="pb-nr1-stat pb-nr1-stat--green">
            <strong>{stats.concluidas.toLocaleString("pt-BR")}</strong>
            <span>Concluídas</span>
          </div>
          <div className="pb-nr1-stat pb-nr1-stat--yellow">
            <strong>{stats.andamento.toLocaleString("pt-BR")}</strong>
            <span>Em andamento</span>
          </div>
          <div className="pb-nr1-stat pb-nr1-stat--blue">
            <strong>{stats.agendadas.toLocaleString("pt-BR")}</strong>
            <span>Agendadas</span>
          </div>
          <div className="pb-nr1-stat pb-nr1-stat--purple">
            <strong>{checklistPct}%</strong>
            <span>Checklist GRO</span>
          </div>
        </div>

        <p className="pb-nr1-disclaimer">
          {NR1_DISCLAIMER} {STORAGE_NOTE}
        </p>

        <div className="pb-nr1-actions" role="tablist" aria-label="Seções NR-1">
          {TABS.map((tab) => (
            <button
              key={tab.id}
              type="button"
              role="tab"
              aria-selected={activeTab === tab.id}
              className={activeTab === tab.id ? "is-active" : ""}
              onClick={() => switchTab(tab.id)}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {activeTab === "visao" && (
          <div className="pb-nr1-tab-panel" role="tabpanel" aria-label="Visão geral">
            <div className="pb-nr1-campaigns">
              {NR1_CARDS.map((card) => {
                const prog = cardsProg[card.id] ?? card.prog;
                const badge = NR1_STATUS_BADGE[card.status] || NR1_STATUS_BADGE.alerta;
                return (
                  <article key={card.id} className="pb-nr1-campaign">
                    <div className="pb-nr1-campaign-top" style={{ background: card.cor }}>
                      <span className="pb-nr1-campaign-icon" aria-hidden="true">
                        {card.icon}
                      </span>
                      <div>
                        <strong>{card.titulo}</strong>
                        <em>{card.sub}</em>
                      </div>
                    </div>
                    <div className="pb-nr1-campaign-body">
                      <p>{card.desc}</p>
                      {card.id === "psicossocial" && indicadores.hasHist && indicadores.eventosAfastamento > 0 ? (
                        <p className="pb-nr1-campaign-hint">
                          Histórico: {indicadores.eventosAfastamento} afastamento(s) — revise plano psicossocial.
                        </p>
                      ) : null}
                      <span className={`pb-nr1-status pb-nr1-status--${badge.className}`}>{badge.label}</span>
                      <div className="pb-nr1-campaign-meta">
                        <em>
                          {prog}% · {card.progLabel}
                        </em>
                      </div>
                      <div
                        className="pb-nr1-progress"
                        role="progressbar"
                        aria-valuenow={prog}
                        aria-valuemin={0}
                        aria-valuemax={100}
                        aria-label={`Progresso ${card.titulo}`}
                      >
                        <i style={{ width: `${prog}%`, background: card.cor }} />
                      </div>
                      <input
                        type="range"
                        min={0}
                        max={100}
                        value={prog}
                        className="pb-nr1-range"
                        aria-label={`Ajustar progresso ${card.titulo}`}
                        onChange={(e) => atualizarProg(card.id, e.target.value)}
                      />
                      <div className="pb-nr1-campaign-buttons">
                        <a
                          className="pb-nr1-btn pb-nr1-btn--primary"
                          href={card.link}
                          target="_blank"
                          rel="noopener noreferrer"
                        >
                          Referência oficial
                        </a>
                        <button
                          type="button"
                          className="pb-nr1-btn pb-nr1-btn--success"
                          onClick={() => irParaRegistrar(card.tipoRegistrar)}
                        >
                          Registrar ação
                        </button>
                      </div>
                    </div>
                  </article>
                );
              })}
            </div>
          </div>
        )}

        {activeTab === "checklist" && (
          <div className="pb-nr1-tab-panel" role="tabpanel" aria-label="Checklist GRO">
            <div className="pb-nr1-check-progress">
              <h3>Progresso do Checklist GRO/PGR</h3>
              <div className="pb-nr1-prog-label">
                <span>
                  {checklistDone} de {checklistTotal} itens concluídos
                </span>
                <span>{checklistPct}%</span>
              </div>
              <div className="pb-nr1-progress pb-nr1-progress--lg">
                <i style={{ width: `${checklistPct}%` }} />
              </div>
            </div>
            {NR1_CHECKLIST_GRUPOS.map((grupo) => (
              <div key={grupo.grupo} className="pb-nr1-check-section">
                <h3>{grupo.grupo}</h3>
                <div className="pb-nr1-check-grid">
                  {grupo.itens.map((item) => {
                    const done = Boolean(checkState[item.id]);
                    const hasReq = Boolean(NR1_CHECKLIST_REQUIRES[item.id]);
                    return (
                      <div key={item.id} className={`pb-nr1-check-wrap${done ? " is-done" : ""}`}>
                        <label className={`pb-nr1-check-item${done ? " is-done" : ""}`}>
                          <input type="checkbox" checked={done} onChange={() => toggleCheck(item.id)} />
                          <span className="pb-nr1-check-text">
                            <strong>{item.txt}</strong>
                            <em>{item.desc}</em>
                          </span>
                        </label>
                        {hasReq ? renderChecklistMeta(item.id) : null}
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
            <div className="pb-nr1-form-actions">
              <button type="button" className="pb-nr1-btn pb-nr1-btn--success" onClick={salvarChecklist}>
                Salvar progresso
              </button>
              <button type="button" className="pb-nr1-btn pb-nr1-btn--outline" onClick={resetChecklist}>
                Resetar
              </button>
              <button type="button" className="pb-nr1-btn pb-nr1-btn--outline" onClick={exportarPgr}>
                Exportar modelo PGR
              </button>
            </div>
          </div>
        )}

        {activeTab === "registrar" && (
          <div className="pb-nr1-tab-panel" role="tabpanel" aria-label="Registrar ação">
            <div className="pb-nr1-form-card">
              <h3>Registrar ação de conformidade NR-1</h3>
              <div className="pb-nr1-form-grid">
                <label className="pb-nr1-field">
                  <span>Data *</span>
                  <input type="date" value={form.data} onChange={(e) => updateForm("data", e.target.value)} />
                </label>
                <label className="pb-nr1-field">
                  <span>Tipo de ação *</span>
                  <select value={form.tipo} onChange={(e) => updateForm("tipo", e.target.value)}>
                    <option value="">Selecione...</option>
                    {NR1_TIPO_OPTIONS.map((opt) => (
                      <option key={opt} value={opt}>
                        {opt}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="pb-nr1-field">
                  <span>Setor / área</span>
                  <input
                    type="text"
                    value={form.setor}
                    placeholder="Ex: Produção, TI"
                    onChange={(e) => updateForm("setor", e.target.value)}
                  />
                </label>
                <label className="pb-nr1-field">
                  <span>Responsável *</span>
                  <input
                    type="text"
                    value={form.resp}
                    placeholder="Nome do responsável"
                    onChange={(e) => updateForm("resp", e.target.value)}
                  />
                </label>
                <label className="pb-nr1-field">
                  <span>Nº de participantes</span>
                  <input
                    type="number"
                    min="0"
                    value={form.part}
                    placeholder="Ex: 45"
                    onChange={(e) => updateForm("part", e.target.value)}
                  />
                </label>
                <label className="pb-nr1-field">
                  <span>Status *</span>
                  <select value={form.status} onChange={(e) => updateForm("status", e.target.value)}>
                    <option value="">Selecione...</option>
                    {NR1_STATUS_OPTIONS.map((opt) => (
                      <option key={opt} value={opt}>
                        {opt}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="pb-nr1-field">
                  <span>Categoria de risco</span>
                  <select value={form.risco} onChange={(e) => updateForm("risco", e.target.value)}>
                    <option value="">Selecione...</option>
                    {NR1_RISCO_OPTIONS.map((opt) => (
                      <option key={opt} value={opt}>
                        {opt}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="pb-nr1-field">
                  <span>Prazo de revisão</span>
                  <input type="date" value={form.prazo} onChange={(e) => updateForm("prazo", e.target.value)} />
                </label>
                <label className="pb-nr1-field pb-nr1-field--full">
                  <span>Descrição / evidência</span>
                  <textarea
                    value={form.desc}
                    placeholder="Descreva a ação, evidências, documentos gerados, link do PGR..."
                    onChange={(e) => updateForm("desc", e.target.value)}
                  />
                </label>
                <p className="pb-nr1-check-hint">
                  Status &quot;Concluído&quot; exige ao menos um anexo ou descrição da evidência no campo acima.
                </p>
                <div className="pb-nr1-field pb-nr1-field--full pb-nr1-anexos">
                  <span>Anexos (ata, laudo, foto — máx. 5 MB cada)</span>
                  <input
                    type="file"
                    multiple
                    onChange={(e) => {
                      adicionarAnexos(e.target.files);
                      e.target.value = "";
                    }}
                  />
                  {form.pendingAnexos.length ? (
                    <ul className="pb-nr1-anexos-list">
                      {form.pendingAnexos.map((a) => (
                        <li key={a.id}>
                          <span>{a.nome}</span>
                          <button
                            type="button"
                            className="pb-nr1-btn pb-nr1-btn--danger pb-nr1-btn--sm"
                            onClick={() => removerAnexoPendente(a.id)}
                          >
                            Remover
                          </button>
                        </li>
                      ))}
                    </ul>
                  ) : null}
                </div>
              </div>
              <div className="pb-nr1-form-actions">
                <button type="button" className="pb-nr1-btn pb-nr1-btn--primary" onClick={registrarAcao}>
                  Salvar
                </button>
                <button type="button" className="pb-nr1-btn pb-nr1-btn--outline" onClick={limparForm}>
                  Limpar
                </button>
              </div>
            </div>
          </div>
        )}

        {activeTab === "historico" && (
          <div className="pb-nr1-tab-panel" role="tabpanel" aria-label="Histórico">
            <div className="pb-nr1-table-card">
              <div className="pb-nr1-table-head">
                <h3>Histórico de ações NR-1</h3>
                <div className="pb-nr1-table-tools">
                  <input
                    className="pb-nr1-search"
                    type="search"
                    placeholder="Buscar..."
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                  />
                  <button type="button" className="pb-nr1-btn pb-nr1-btn--success pb-nr1-btn--sm" onClick={exportarCsv}>
                    Exportar CSV
                  </button>
                </div>
              </div>
              <div className="pb-nr1-table-wrap">
                <table className="pb-nr1-table">
                  <thead>
                    <tr>
                      <th>#</th>
                      <th>Data</th>
                      <th>Tipo</th>
                      <th>Setor</th>
                      <th>Responsável</th>
                      <th>Risco</th>
                      <th>Status</th>
                      <th>Anexos</th>
                      <th>Ações</th>
                    </tr>
                  </thead>
                  <tbody>
                    {!registrosFiltrados.length ? (
                      <tr>
                        <td colSpan={9} className="pb-nr1-table-empty">
                          Nenhuma ação registrada. Use a aba &quot;Registrar Ação&quot;.
                        </td>
                      </tr>
                    ) : (
                      registrosFiltrados.map((r) => (
                        <tr key={r.id}>
                          <td>
                            <strong>{r.id}</strong>
                          </td>
                          <td>{formatNr1DataBr(r.data)}</td>
                          <td>{r.tipo}</td>
                          <td>{r.setor || "—"}</td>
                          <td>{r.resp}</td>
                          <td>{r.risco || "—"}</td>
                          <td>
                            <span
                              className={`pb-nr1-status pb-nr1-status--${NR1_REG_STATUS_BADGE[r.status] || "alerta"}`}
                            >
                              {r.status}
                            </span>
                          </td>
                          <td>{(r.anexos || []).length || "—"}</td>
                          <td className="pb-nr1-table-actions">
                            <button
                              type="button"
                              className="pb-nr1-btn pb-nr1-btn--outline pb-nr1-btn--sm"
                              onClick={() => setModalRegistro(r)}
                            >
                              Ver
                            </button>
                            <button
                              type="button"
                              className="pb-nr1-btn pb-nr1-btn--danger pb-nr1-btn--sm"
                              onClick={() => excluirRegistro(r.id)}
                            >
                              Excluir
                            </button>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {activeTab === "fontes" && (
          <div className="pb-nr1-tab-panel" role="tabpanel" aria-label="Fontes oficiais">
            <div className="pb-nr1-alert pb-nr1-alert--green">
              <span className="pb-nr1-alert-ico" aria-hidden="true">
                ✅
              </span>
              <div>
                <strong>Documentação oficial disponível</strong>
                <p>
                  O MTE disponibilizou o Manual de Interpretação do Cap. 1.5 da NR-1 e o Guia de Riscos
                  Psicossociais. Use como base do seu PGR.
                </p>
              </div>
            </div>
            <div className="pb-nr1-sources">
              {NR1_FONTES.map((fonte) => (
                <article key={fonte.url} className="pb-nr1-source" style={{ borderLeftColor: fonte.cor }}>
                  <span className="pb-nr1-source-tag">{fonte.tag}</span>
                  <h4>{fonte.titulo}</h4>
                  <p>{fonte.desc}</p>
                  <a href={fonte.url} target="_blank" rel="noopener noreferrer">
                    {fonte.url}
                  </a>
                </article>
              ))}
            </div>
          </div>
        )}
      </div>

      {modalRegistro ? (
        <div
          className="pb-nr1-modal-overlay"
          role="presentation"
          onClick={(e) => {
            if (e.target === e.currentTarget) setModalRegistro(null);
          }}
        >
          <div className="pb-nr1-modal" role="dialog" aria-modal="true" aria-labelledby="pb-nr1-modal-title">
            <h3 id="pb-nr1-modal-title">{modalRegistro.tipo}</h3>
            <p>
              <strong>Data:</strong> {formatNr1DataBr(modalRegistro.data)}
            </p>
            <p>
              <strong>Setor:</strong> {modalRegistro.setor || "Não informado"}
            </p>
            <p>
              <strong>Responsável:</strong> {modalRegistro.resp}
            </p>
            <p>
              <strong>Risco:</strong> {modalRegistro.risco || "Não informado"}
            </p>
            <p>
              <strong>Participantes:</strong> {modalRegistro.part ?? "Não informado"}
            </p>
            <p>
              <strong>Prazo de revisão:</strong>{" "}
              {modalRegistro.prazo ? formatNr1DataBr(modalRegistro.prazo) : "Não definido"}
            </p>
            <p>
              <strong>Status:</strong>{" "}
              <span
                className={`pb-nr1-status pb-nr1-status--${NR1_REG_STATUS_BADGE[modalRegistro.status] || "alerta"}`}
              >
                {modalRegistro.status}
              </span>
            </p>
            {modalRegistro.desc ? (
              <p>
                <strong>Descrição:</strong> {modalRegistro.desc}
              </p>
            ) : null}
            {modalRegistro.anexos?.length ? (
              <div className="pb-nr1-modal-anexos">
                <strong>Anexos</strong>
                <ul>
                  {modalRegistro.anexos.map((anexo) => (
                    <li key={anexo.id}>
                      <span>{anexo.nome}</span>
                      <button
                        type="button"
                        className="pb-nr1-btn pb-nr1-btn--outline pb-nr1-btn--sm"
                        onClick={() => baixarAnexo(modalRegistro.id, anexo)}
                      >
                        Baixar
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}
            <div className="pb-nr1-modal-actions">
              <button type="button" className="pb-nr1-btn pb-nr1-btn--outline" onClick={() => setModalRegistro(null)}>
                Fechar
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </section>
  );
}
