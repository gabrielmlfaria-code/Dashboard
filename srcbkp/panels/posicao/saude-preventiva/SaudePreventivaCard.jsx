import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link } from "@tanstack/react-router";
import { Toast } from "../../../core/toast.js";
import {
  SAUDE_CANAL_OPTIONS,
  SAUDE_CHECKLIST_ITEMS,
  SAUDE_DISCLAIMER,
  SAUDE_FONTES,
  SAUDE_PUBLICO_OPTIONS,
  SAUDE_STATUS_OPTIONS,
  SAUDE_TEMA_OPTIONS,
  buildDepartamentosFromSelection,
  buildHistColaboradoresList,
  buildHistDepartamentosList,
  buildListaNominalFromColabs,
  buildModeloComunicacao,
  computeSaudeRegistroStats,
  countSaudeAlcance,
  emptySaudeChecklist,
  exportSaudeRegistrosCsv,
  formatSaudeDataBr,
  formatSaudeListaLinha,
  getCampanhasComCompliance,
  isDeptInSelection,
  isLineInListaNominal,
  labelSaudePublicoAlcance,
  parseSaudeDepartamentos,
  normalizeSaudeChecklist,
  normalizeSaudeRegistro,
  parseSaudeListaNominal,
  statusClassFromLabel,
  validateSaudeRegistroRealizado,
} from "./saudePreventivaCampanhas.js";
import {
  SAUDE_MAX_ANEXO_BYTES,
  SAUDE_MAX_ANEXOS,
  downloadSaudeAnexo,
  downloadSaudePreventivaBackup,
  importSaudePreventivaBackupData,
  loadSaudeAnexo,
  loadSaudeRegistrosPersisted,
  removeSaudeAnexos,
  saveSaudeAnexo,
  saveSaudeRegistrosPersisted,
} from "./saudePreventivaStorage.js";
import { buildArt473AusenciasStats, buildSaudeCalendarioLembretes } from "./saudePreventivaArt473.js";
import { downloadSaudeConformidadeReport } from "./saudePreventivaReport.js";
import { downloadSaudeMatrizConformidadeReport } from "./saudePreventivaMatriz.js";
import {
  getCalendarioItensParaLembrete,
  loadSaudeLembretesState,
  processSaudeCalendarioLembretes,
  requestSaudeNotificationPermission,
  setSaudeLembretesAtivos,
} from "./saudePreventivaLembretes.js";

const TABS = [
  { id: "campanhas", label: "Campanhas" },
  { id: "calendario", label: "Calendário" },
  { id: "art473", label: "Art. 473" },
  { id: "registrar", label: "Registrar Comunicação" },
  { id: "historico", label: "Histórico" },
  { id: "fontes", label: "Fontes Oficiais" },
];

const CALENDARIO_STATUS_LABEL = {
  ok: "Concluído",
  ativo: "Ação agora",
  proximo: "Em breve",
  atrasado: "Atrasado",
  pendente: "Pendente",
};

const STORAGE_NOTE = "Registros e anexos persistidos no navegador (IndexedDB), com backup em localStorage.";

const emptyForm = () => ({
  data: new Date().toISOString().split("T")[0],
  tema: "",
  canal: "",
  responsavel: "",
  colaboradores: "",
  status: "",
  obs: "",
  checklist: emptySaudeChecklist(),
  publicoAlcance: "",
  departamentos: "",
  listaNominal: "",
  art473Comunicado: false,
  pendingAnexos: [],
});

export function SaudePreventivaCard({
  periodoLabel,
  empresaLabel = "",
  histRows = [],
  theme = "light",
  onToggleTheme = null,
  showBackLink = false,
}) {
  const [activeTab, setActiveTab] = useState("campanhas");
  const [registros, setRegistros] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [backupBusy, setBackupBusy] = useState(false);
  const [search, setSearch] = useState("");
  const [listaPickerSearch, setListaPickerSearch] = useState("");
  const [deptPickerSearch, setDeptPickerSearch] = useState("");
  const [lembretesAtivos, setLembretesAtivos] = useState(() => loadSaudeLembretesState().lembretesAtivos);
  const [notifPermission, setNotifPermission] = useState(
    () => (typeof Notification !== "undefined" ? Notification.permission : "unsupported"),
  );
  const [form, setForm] = useState(emptyForm);
  const [modalRegistro, setModalRegistro] = useState(null);
  const hydratedRef = useRef(false);
  const backupInputRef = useRef(null);

  useEffect(() => {
    let alive = true;
    loadSaudeRegistrosPersisted()
      .then((rows) => {
        if (!alive) return;
        setRegistros((Array.isArray(rows) ? rows : []).map(normalizeSaudeRegistro));
        hydratedRef.current = true;
        setLoading(false);
      })
      .catch(() => {
        if (alive) setLoading(false);
      });
    return () => {
      alive = false;
    };
  }, []);

  useEffect(() => {
    if (!hydratedRef.current) return;
    setSaving(true);
    saveSaudeRegistrosPersisted(registros)
      .catch(() => Toast.show("Não foi possível salvar os registros.", "e", 3000))
      .finally(() => setSaving(false));
  }, [registros]);

  const stats = useMemo(() => computeSaudeRegistroStats(registros), [registros]);
  const campanhas = useMemo(() => getCampanhasComCompliance(registros), [registros]);
  const calendario = useMemo(() => buildSaudeCalendarioLembretes(registros), [registros]);
  const art473 = useMemo(
    () => buildArt473AusenciasStats(histRows, registros),
    [histRows, registros],
  );
  const colaboradoresHist = useMemo(() => buildHistColaboradoresList(histRows), [histRows]);
  const departamentosHist = useMemo(() => buildHistDepartamentosList(histRows), [histRows]);
  const lembretesPendentes = useMemo(() => getCalendarioItensParaLembrete(calendario), [calendario]);
  const lembretesAtrasados = useMemo(
    () => lembretesPendentes.filter((item) => item.status === "atrasado").length,
    [lembretesPendentes],
  );
  const colaboradoresFiltrados = useMemo(() => {
    const term = listaPickerSearch.trim().toLowerCase();
    if (!term) return colaboradoresHist;
    return colaboradoresHist.filter(
      (c) =>
        c.nome.toLowerCase().includes(term) ||
        c.matricula.toLowerCase().includes(term) ||
        c.departamento.toLowerCase().includes(term),
    );
  }, [colaboradoresHist, listaPickerSearch]);
  const listaSelectedIds = useMemo(() => {
    const lines = parseSaudeListaNominal(form.listaNominal);
    const ids = new Set();
    for (const colab of colaboradoresHist) {
      if (lines.some((line) => isLineInListaNominal(line, colab))) ids.add(colab.id);
    }
    return ids;
  }, [form.listaNominal, colaboradoresHist]);
  const listaManualLines = useMemo(() => {
    const lines = parseSaudeListaNominal(form.listaNominal);
    return lines.filter((line) => !colaboradoresHist.some((c) => isLineInListaNominal(line, c)));
  }, [form.listaNominal, colaboradoresHist]);
  const departamentosFiltrados = useMemo(() => {
    const term = deptPickerSearch.trim().toLowerCase();
    if (!term) return departamentosHist;
    return departamentosHist.filter((d) => d.nome.toLowerCase().includes(term));
  }, [departamentosHist, deptPickerSearch]);
  const deptSelectedIds = useMemo(() => {
    const selected = parseSaudeDepartamentos(form.departamentos);
    const ids = new Set();
    for (const dept of departamentosHist) {
      if (isDeptInSelection(dept.nome, selected)) ids.add(dept.id);
    }
    return ids;
  }, [form.departamentos, departamentosHist]);
  const deptManualEntries = useMemo(() => {
    const selected = parseSaudeDepartamentos(form.departamentos);
    return selected.filter((nome) => !departamentosHist.some((d) => isDeptInSelection(d.nome, [nome])));
  }, [form.departamentos, departamentosHist]);
  const empresaDisplay = empresaLabel || "Empresa";

  useEffect(() => {
    if (loading) return;
    processSaudeCalendarioLembretes(calendario, {
      showToast: lembretesAtivos ? Toast.show : null,
    });
    const timer = window.setInterval(() => {
      processSaudeCalendarioLembretes(calendario, {
        showToast: lembretesAtivos ? Toast.show : null,
      });
    }, 60 * 60 * 1000);
    return () => window.clearInterval(timer);
  }, [loading, calendario, lembretesAtivos]);

  const registrosFiltrados = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) return registros;
    return registros.filter((r) => {
      const norm = normalizeSaudeRegistro(r);
      return (
        String(norm.tema || "").toLowerCase().includes(term) ||
        String(norm.canal || "").toLowerCase().includes(term) ||
        String(norm.responsavel || "").toLowerCase().includes(term) ||
        String(norm.status || "").toLowerCase().includes(term) ||
        labelSaudePublicoAlcance(norm).toLowerCase().includes(term)
      );
    });
  }, [registros, search]);

  const switchTab = useCallback((tabId) => {
    setActiveTab(tabId);
  }, []);

  const irParaRegistrar = useCallback((tema) => {
    setForm({
      ...emptyForm(),
      tema: tema || "",
      data: new Date().toISOString().split("T")[0],
      obs: tema ? buildModeloComunicacao(tema) : "",
    });
    setActiveTab("registrar");
  }, []);

  const limparForm = useCallback(() => {
    setForm(emptyForm());
  }, []);

  const updateForm = useCallback((field, value) => {
    setForm((prev) => ({ ...prev, [field]: value }));
  }, []);

  const inserirModeloLegal = useCallback(() => {
    if (!form.tema) {
      Toast.show("Selecione o tema/campanha antes de inserir o modelo.", "w", 3000);
      return;
    }
    updateForm("obs", buildModeloComunicacao(form.tema));
  }, [form.tema, updateForm]);

  const toggleChecklistItem = useCallback((itemId) => {
    setForm((prev) => ({
      ...prev,
      checklist: {
        ...normalizeSaudeChecklist(prev.checklist),
        [itemId]: !normalizeSaudeChecklist(prev.checklist)[itemId],
      },
    }));
  }, []);

  const toggleArt473Comunicado = useCallback(() => {
    setForm((prev) => {
      const next = !prev.art473Comunicado;
      const checklist = { ...normalizeSaudeChecklist(prev.checklist) };
      if (next) checklist.informar_ausencia = true;
      return { ...prev, art473Comunicado: next, checklist };
    });
  }, []);

  const adicionarAnexos = useCallback((fileList) => {
    const files = Array.from(fileList || []);
    if (!files.length) return;
    setForm((prev) => {
      const slots = SAUDE_MAX_ANEXOS - prev.pendingAnexos.length;
      if (slots <= 0) {
        Toast.show(`Máximo de ${SAUDE_MAX_ANEXOS} anexos por registro.`, "w", 3000);
        return prev;
      }
      const novos = [];
      for (const file of files.slice(0, slots)) {
        if (file.size > SAUDE_MAX_ANEXO_BYTES) {
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

  const registrarComunicacao = useCallback(async () => {
    const {
      data,
      tema,
      canal,
      responsavel,
      colaboradores,
      status,
      obs,
      checklist,
      publicoAlcance,
      departamentos,
      listaNominal,
      art473Comunicado,
      pendingAnexos,
    } = form;

    if (!data || !tema || !canal || !responsavel.trim() || !status) {
      Toast.show("Preencha todos os campos obrigatórios (*).", "e", 3500);
      return;
    }

    const id = Date.now();
    const draft = normalizeSaudeRegistro({
      id,
      data,
      tema,
      canal,
      responsavel: responsavel.trim(),
      colaboradores: colaboradores ? Number(colaboradores) : null,
      status,
      checklist,
      publicoAlcance,
      departamentos,
      listaNominal,
      art473Comunicado,
      obs: obs.trim(),
      anexos: pendingAnexos.map((a) => ({
        id: a.id,
        nome: a.nome,
        tipo: a.tipo,
        tamanho: a.tamanho,
      })),
    });

    if (status === "Realizado") {
      const erros = validateSaudeRegistroRealizado(draft);
      if (erros.length) {
        Toast.show(erros[0], "e", 4500);
        return;
      }
    }

    try {
      for (const anexo of pendingAnexos) {
        const ok = await saveSaudeAnexo(id, anexo.id, anexo.file);
        if (!ok) throw new Error("Falha ao gravar anexo");
      }
      setRegistros((prev) => [draft, ...prev]);
      limparForm();
      Toast.show("Comunicação registrada com sucesso!", "s", 3500);
      setActiveTab("historico");
    } catch {
      await removeSaudeAnexos(id, pendingAnexos);
      Toast.show("Erro ao salvar anexos. Tente novamente.", "e", 4000);
    }
  }, [form, limparForm]);

  const excluirRegistro = useCallback(async (id) => {
    if (!window.confirm("Deseja excluir este registro e os anexos?")) return;
    const alvo = registros.find((r) => r.id === id);
    if (alvo?.anexos?.length) await removeSaudeAnexos(id, alvo.anexos);
    setRegistros((prev) => prev.filter((r) => r.id !== id));
    if (modalRegistro?.id === id) setModalRegistro(null);
    Toast.show("Registro excluído.", "i", 3000);
  }, [registros, modalRegistro]);

  const baixarAnexo = useCallback(async (registro, anexo) => {
    const blob = await loadSaudeAnexo(registro.id, anexo.id);
    if (!blob) {
      Toast.show("Anexo não encontrado no armazenamento local.", "e", 3000);
      return;
    }
    downloadSaudeAnexo(blob, anexo.nome);
  }, []);

  const exportarCsv = useCallback(() => {
    if (!registros.length) {
      Toast.show("Nenhum registro para exportar.", "e", 3000);
      return;
    }
    exportSaudeRegistrosCsv(registros);
    Toast.show("CSV exportado!", "s", 3000);
  }, [registros]);

  const exportarRelatorio = useCallback(() => {
    downloadSaudeConformidadeReport({
      periodoLabel,
      empresaLabel: empresaDisplay,
      registros,
      art473,
      calendario,
    });
    Toast.show("Relatório completo exportado (dados + matriz legal)!", "s", 3500);
  }, [periodoLabel, empresaDisplay, registros, art473, calendario]);

  const exportarMatriz = useCallback(() => {
    downloadSaudeMatrizConformidadeReport({
      periodoLabel,
      empresaLabel: empresaDisplay,
      registros,
      art473,
      stats,
    });
    Toast.show("Matriz de conformidade exportada!", "s", 3000);
  }, [periodoLabel, empresaDisplay, registros, art473, stats]);

  const exportarBackup = useCallback(async () => {
    setBackupBusy(true);
    try {
      const payload = await downloadSaudePreventivaBackup(registros);
      Toast.show(
        `Backup exportado (${payload.anexos.length} anexo(s)).`,
        "s",
        3500,
      );
    } catch {
      Toast.show("Falha ao exportar backup.", "e", 3500);
    } finally {
      setBackupBusy(false);
    }
  }, [registros]);

  const restaurarBackup = useCallback(async (file) => {
    if (!file) return;
    if (!window.confirm("Substituir todos os registros e anexos locais pelo backup?")) return;
    setBackupBusy(true);
    try {
      const text = await file.text();
      const payload = JSON.parse(text);
      const { registros: restored, anexosRestored } = await importSaudePreventivaBackupData(payload);
      setRegistros(restored.map(normalizeSaudeRegistro));
      hydratedRef.current = true;
      Toast.show(
        `Backup restaurado: ${restored.length} registro(s), ${anexosRestored} anexo(s).`,
        "s",
        4000,
      );
    } catch (err) {
      Toast.show(err?.message || "Falha ao restaurar backup.", "e", 4000);
    } finally {
      setBackupBusy(false);
      if (backupInputRef.current) backupInputRef.current.value = "";
    }
  }, []);

  const syncListaNominal = useCallback(
    (nextIds) => {
      const fromHist = buildListaNominalFromColabs(colaboradoresHist, nextIds);
      const manual = listaManualLines.join("\n");
      const merged = [fromHist, manual].filter(Boolean).join("\n");
      updateForm("listaNominal", merged);
    },
    [colaboradoresHist, listaManualLines, updateForm],
  );

  const toggleListaColab = useCallback(
    (colabId) => {
      const next = new Set(listaSelectedIds);
      if (next.has(colabId)) next.delete(colabId);
      else next.add(colabId);
      syncListaNominal(next);
    },
    [listaSelectedIds, syncListaNominal],
  );

  const selecionarListaVisiveis = useCallback(() => {
    const next = new Set(listaSelectedIds);
    for (const c of colaboradoresFiltrados) next.add(c.id);
    syncListaNominal(next);
  }, [listaSelectedIds, colaboradoresFiltrados, syncListaNominal]);

  const limparListaHist = useCallback(() => {
    syncListaNominal(new Set());
  }, [syncListaNominal]);

  const syncDepartamentos = useCallback(
    (nextIds) => {
      const fromHist = buildDepartamentosFromSelection(departamentosHist, nextIds);
      const manual = deptManualEntries.join(", ");
      updateForm("departamentos", [fromHist, manual].filter(Boolean).join(", "));
    },
    [departamentosHist, deptManualEntries, updateForm],
  );

  const toggleDept = useCallback(
    (deptId) => {
      const next = new Set(deptSelectedIds);
      if (next.has(deptId)) next.delete(deptId);
      else next.add(deptId);
      syncDepartamentos(next);
    },
    [deptSelectedIds, syncDepartamentos],
  );

  const selecionarDeptVisiveis = useCallback(() => {
    const next = new Set(deptSelectedIds);
    for (const d of departamentosFiltrados) next.add(d.id);
    syncDepartamentos(next);
  }, [deptSelectedIds, departamentosFiltrados, syncDepartamentos]);

  const limparDeptHist = useCallback(() => {
    syncDepartamentos(new Set());
  }, [syncDepartamentos]);

  const ativarLembretes = useCallback(async () => {
    const perm = await requestSaudeNotificationPermission();
    setNotifPermission(typeof Notification !== "undefined" ? Notification.permission : "unsupported");
    const state = setSaudeLembretesAtivos(true);
    setLembretesAtivos(state.lembretesAtivos);
    if (perm === "granted") {
      Toast.show("Lembretes ativos (toast + notificações do navegador).", "s", 3500);
    } else if (perm === "denied") {
      Toast.show("Permissão negada — lembretes apenas via toast no app.", "w", 4000);
    } else {
      Toast.show("Lembretes ativos via toast no app.", "i", 3500);
    }
    processSaudeCalendarioLembretes(calendario, { showToast: Toast.show, force: true });
  }, [calendario]);

  const desativarLembretes = useCallback(() => {
    const state = setSaudeLembretesAtivos(false);
    setLembretesAtivos(state.lembretesAtivos);
    Toast.show("Lembretes de calendário desativados.", "i", 3000);
  }, []);

  const periodoMeta = periodoLabel ? ` · ${periodoLabel}` : "";

  if (loading) {
    return (
      <section className="pb-cell pb-saude-preventiva pb-saude-preventiva--loading" aria-label="Gestão de Campanhas de Saúde">
        <p className="pb-saude-loading">Carregando registros de conformidade…</p>
      </section>
    );
  }

  return (
    <section className="pb-cell pb-saude-preventiva" aria-label="Gestão de Campanhas de Saúde">
      <header className="pb-saude-hero">
        <div className="pb-saude-hero-copy">
          <h2 className="pb-saude-hero-title">Gestão de Campanhas de Saúde</h2>
          <p className="pb-saude-hero-sub">
            Controle de conformidade — {empresaDisplay} | RH{periodoMeta}
            {saving ? " · salvando…" : ""}
          </p>
        </div>
        <div className="pb-saude-hero-actions">
          {showBackLink ? (
            <Link to="/" className="pb-saude-back">
              ← Voltar ao dashboard
            </Link>
          ) : null}
          {typeof onToggleTheme === "function" ? (
            <button
              type="button"
              className="pb-saude-theme"
              onClick={onToggleTheme}
              aria-label={theme === "dark" ? "Ativar tema claro" : "Ativar tema escuro"}
            >
              {theme === "dark" ? "Tema claro" : "Tema escuro"}
            </button>
          ) : null}
          <button
            type="button"
            className="pb-saude-btn pb-saude-btn--outline pb-saude-btn--sm"
            onClick={exportarRelatorio}
            title="Relatório auditável com registros, calendário e art. 473"
          >
            Exportar relatório
          </button>
          <button
            type="button"
            className="pb-saude-btn pb-saude-btn--outline pb-saude-btn--sm"
            onClick={exportarMatriz}
            title="Matriz de conformidade legal por campanha"
          >
            Matriz legal
          </button>
          <button
            type="button"
            className="pb-saude-btn pb-saude-btn--outline pb-saude-btn--sm"
            onClick={exportarBackup}
            disabled={backupBusy}
            title="Backup JSON com registros e anexos"
          >
            {backupBusy ? "Aguarde…" : "Backup JSON"}
          </button>
          <button
            type="button"
            className="pb-saude-btn pb-saude-btn--outline pb-saude-btn--sm"
            onClick={() => backupInputRef.current?.click()}
            disabled={backupBusy}
            title="Restaurar backup JSON neste navegador"
          >
            Restaurar
          </button>
          <input
            ref={backupInputRef}
            type="file"
            accept="application/json,.json"
            className="pb-saude-backup-input"
            onChange={(e) => restaurarBackup(e.target.files?.[0])}
          />
        </div>
      </header>

      <div className="pb-saude-body">
        <div className="pb-saude-summary" role="group" aria-label="Resumo de comunicações">
          <div className="pb-saude-stat pb-saude-stat--blue">
            <strong>{stats.total.toLocaleString("pt-BR")}</strong>
            <span>Comunicações registradas</span>
          </div>
          <div className="pb-saude-stat pb-saude-stat--green">
            <strong>{stats.realizadas.toLocaleString("pt-BR")}</strong>
            <span>Realizadas</span>
          </div>
          <div className="pb-saude-stat pb-saude-stat--orange">
            <strong>{stats.pendentes.toLocaleString("pt-BR")}</strong>
            <span>Pendentes</span>
          </div>
          <div className="pb-saude-stat pb-saude-stat--violet">
            <strong>{stats.agendadas.toLocaleString("pt-BR")}</strong>
            <span>Agendadas</span>
          </div>
        </div>

        <p className="pb-saude-disclaimer">
          {SAUDE_DISCLAIMER} {STORAGE_NOTE}
        </p>

        <div className="pb-saude-actions" role="tablist" aria-label="Seções de campanhas">
          {TABS.map((tab) => {
            const lembreteCount = tab.id === "calendario" ? lembretesPendentes.length : 0;
            const tabLabel =
              lembreteCount > 0
                ? `${tab.label}, ${lembreteCount} lembrete${lembreteCount !== 1 ? "s" : ""} pendente${lembreteCount !== 1 ? "s" : ""}`
                : tab.label;
            return (
              <button
                key={tab.id}
                type="button"
                role="tab"
                aria-selected={activeTab === tab.id}
                aria-label={tabLabel}
                className={activeTab === tab.id ? "is-active" : ""}
                onClick={() => switchTab(tab.id)}
              >
                <span className="pb-saude-tab-label">{tab.label}</span>
                {lembreteCount > 0 ? (
                  <span
                    className={`pb-saude-tab-badge${lembretesAtrasados > 0 ? " pb-saude-tab-badge--warn" : ""}`}
                    title={`${lembreteCount} campanha(s) requerem atenção${lembretesAtrasados > 0 ? ` (${lembretesAtrasados} atrasada(s))` : ""}`}
                  >
                    {lembreteCount}
                  </span>
                ) : null}
              </button>
            );
          })}
        </div>

        {activeTab === "campanhas" && (
          <div className="pb-saude-tab-panel" role="tabpanel" aria-label="Campanhas">
            <div className="pb-saude-campaigns">
              {campanhas.map((campanha) => (
                <article key={campanha.id} className="pb-saude-campaign">
                  <div className="pb-saude-campaign-top" style={{ background: campanha.cor }}>
                    <span className="pb-saude-campaign-icon" aria-hidden="true">
                      {campanha.icon}
                    </span>
                    <div>
                      <strong>{campanha.titulo}</strong>
                      <em>{campanha.mes}</em>
                    </div>
                  </div>
                  <div className="pb-saude-campaign-body">
                    <p>{campanha.desc}</p>
                    <ul className="pb-saude-checklist" aria-label={`Checklist legal — ${campanha.titulo}`}>
                      {SAUDE_CHECKLIST_ITEMS.map((item) => {
                        const done = Boolean(campanha.checklist?.[item.id]);
                        return (
                          <li key={item.id} className={done ? "is-done" : ""}>
                            <span aria-hidden="true">{done ? "✓" : "○"}</span>
                            {item.label}
                          </li>
                        );
                      })}
                    </ul>
                    <div className="pb-saude-campaign-meta">
                      <span className={`pb-saude-status pb-saude-status--${campanha.status}`}>
                        {campanha.status}
                      </span>
                      <em>
                        {campanha.progresso}% conformidade ({campanha.realizados} registro
                        {campanha.realizados === 1 ? "" : "s"})
                      </em>
                    </div>
                    <div
                      className="pb-saude-progress"
                      role="progressbar"
                      aria-valuenow={campanha.progresso}
                      aria-valuemin={0}
                      aria-valuemax={100}
                      aria-label={`Conformidade ${campanha.titulo}`}
                    >
                      <i style={{ width: `${campanha.progresso}%` }} />
                    </div>
                    <div className="pb-saude-campaign-buttons">
                      <a
                        className="pb-saude-btn pb-saude-btn--primary"
                        href={campanha.link}
                        target="_blank"
                        rel="noopener noreferrer"
                      >
                        Site oficial
                      </a>
                      <button
                        type="button"
                        className="pb-saude-btn pb-saude-btn--success"
                        onClick={() => irParaRegistrar(campanha.titulo)}
                      >
                        Registrar comunicação
                      </button>
                    </div>
                  </div>
                </article>
              ))}
            </div>
          </div>
        )}

        {activeTab === "calendario" && (
          <div className="pb-saude-tab-panel" role="tabpanel" aria-label="Calendário de campanhas">
            <div className="pb-saude-lembretes-bar">
              <div className="pb-saude-lembretes-copy">
                <strong>Lembretes</strong>
                <span>
                  {lembretesPendentes.length
                    ? `${lembretesPendentes.length} campanha(s) requerem atenção`
                    : "Nenhum lembrete pendente no calendário"}
                  {lembretesAtivos ? " · ativos" : " · pausados"}
                </span>
              </div>
              <div className="pb-saude-lembretes-actions">
                {lembretesAtivos ? (
                  <button type="button" className="pb-saude-btn pb-saude-btn--outline pb-saude-btn--sm" onClick={desativarLembretes}>
                    Pausar lembretes
                  </button>
                ) : (
                  <button type="button" className="pb-saude-btn pb-saude-btn--success pb-saude-btn--sm" onClick={ativarLembretes}>
                    Ativar lembretes
                  </button>
                )}
                {notifPermission !== "granted" && lembretesAtivos ? (
                  <button type="button" className="pb-saude-btn pb-saude-btn--outline pb-saude-btn--sm" onClick={ativarLembretes}>
                    Permitir notificações
                  </button>
                ) : null}
              </div>
            </div>
            <div className="pb-saude-calendario">
              {calendario.map((item) => (
                <article key={item.id} className={`pb-saude-cal-item pb-saude-cal-item--${item.status}`}>
                  <div className="pb-saude-cal-head">
                    <span className="pb-saude-cal-icon" aria-hidden="true">
                      {item.icon}
                    </span>
                    <div>
                      <strong>{item.titulo}</strong>
                      <em>{item.mes}</em>
                    </div>
                    <span className={`pb-saude-cal-badge pb-saude-cal-badge--${item.status}`}>
                      {CALENDARIO_STATUS_LABEL[item.status] || item.status}
                    </span>
                  </div>
                  <p>{item.mensagem}</p>
                  <div className="pb-saude-cal-actions">
                    <button
                      type="button"
                      className="pb-saude-btn pb-saude-btn--success pb-saude-btn--sm"
                      onClick={() => irParaRegistrar(item.titulo)}
                    >
                      Registrar comunicação
                    </button>
                    <a
                      className="pb-saude-btn pb-saude-btn--outline pb-saude-btn--sm"
                      href={item.link}
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      Material oficial
                    </a>
                  </div>
                </article>
              ))}
            </div>
          </div>
        )}

        {activeTab === "art473" && (
          <div className="pb-saude-tab-panel" role="tabpanel" aria-label="Ausências art. 473 no período">
            <div className="pb-saude-art473-summary">
              <div>
                <span>Ocorrências no período</span>
                <strong>{art473.ocorrencias.toLocaleString("pt-BR")}</strong>
              </div>
              <div>
                <span>Colaboradores</span>
                <strong>{art473.colaboradores.toLocaleString("pt-BR")}</strong>
              </div>
              <div>
                <span>Sem comunicação prévia</span>
                <strong>{art473.semComunicacao.toLocaleString("pt-BR")}</strong>
              </div>
              <div>
                <span>Limite CLT (12 meses)</span>
                <strong>
                  {art473.diasLimiteClt} dia(s) / {art473.janelaMesesClt} meses
                </strong>
              </div>
            </div>
            {art473.alertas.length ? (
              <div className="pb-saude-art473-alertas" role="alert">
                <strong>Alerta — uso do art. 473, XII</strong>
                <ul>
                  {art473.alertas.map((a) => (
                    <li key={a.colabKey}>
                      {a.colaborador}: {a.diasUsados} dia(s) distintos nos {a.periodo} (limite {a.limite}).
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}
            <div className="pb-saude-table-card">
              <div className="pb-saude-table-head">
                <h3>Exames preventivos detectados no histórico</h3>
                <p className="pb-saude-art473-hint">
                  Eventos com palavras-chave de HPV/câncer preventivo no histórico importado
                  {periodoLabel ? ` (${periodoLabel})` : ""}. Vincula comunicações registradas até 120 dias antes
                  da ausência.
                </p>
              </div>
              <div className="pb-saude-table-wrap">
                <table className="pb-saude-table">
                  <thead>
                    <tr>
                      <th>Data</th>
                      <th>Colaborador</th>
                      <th>Evento</th>
                      <th>Campanha</th>
                      <th>Comunicação</th>
                      <th>Ação</th>
                    </tr>
                  </thead>
                  <tbody>
                    {!art473.eventos.length ? (
                      <tr>
                        <td colSpan={6} className="pb-saude-table-empty">
                          Nenhuma ausência preventiva detectada no período filtrado.
                        </td>
                      </tr>
                    ) : (
                      art473.eventos.map((ev, idx) => (
                        <tr key={`${ev.date}-${ev.colabKey}-${idx}`}>
                          <td>{formatSaudeDataBr(ev.date)}</td>
                          <td>{ev.colaborador}</td>
                          <td>{ev.evento}</td>
                          <td>{ev.campanha}</td>
                          <td>
                            {ev.comunicacaoRegistrada ? (
                              <span className="pb-saude-status pb-saude-status--realizado">
                                Sim {ev.comunicacaoData ? `(${formatSaudeDataBr(ev.comunicacaoData)})` : ""}
                              </span>
                            ) : (
                              <span className="pb-saude-status pb-saude-status--pendente">Não</span>
                            )}
                          </td>
                          <td>
                            {!ev.comunicacaoRegistrada ? (
                              <button
                                type="button"
                                className="pb-saude-btn pb-saude-btn--outline pb-saude-btn--sm"
                                onClick={() => irParaRegistrar(ev.campanha)}
                              >
                                Registrar
                              </button>
                            ) : (
                              "—"
                            )}
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

        {activeTab === "registrar" && (
          <div className="pb-saude-tab-panel" role="tabpanel" aria-label="Registrar comunicação">
            <div className="pb-saude-form-card">
              <h3>Registrar nova comunicação</h3>
              <div className="pb-saude-form-grid">
                <label className="pb-saude-field">
                  <span>Data da comunicação *</span>
                  <input type="date" value={form.data} onChange={(e) => updateForm("data", e.target.value)} />
                </label>
                <label className="pb-saude-field">
                  <span>Tema / campanha *</span>
                  <select value={form.tema} onChange={(e) => updateForm("tema", e.target.value)}>
                    <option value="">Selecione...</option>
                    {SAUDE_TEMA_OPTIONS.map((opt) => (
                      <option key={opt} value={opt}>
                        {opt}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="pb-saude-field">
                  <span>Canal utilizado *</span>
                  <select value={form.canal} onChange={(e) => updateForm("canal", e.target.value)}>
                    <option value="">Selecione...</option>
                    {SAUDE_CANAL_OPTIONS.map((opt) => (
                      <option key={opt} value={opt}>
                        {opt}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="pb-saude-field">
                  <span>Responsável *</span>
                  <input
                    type="text"
                    value={form.responsavel}
                    placeholder="Nome do responsável"
                    onChange={(e) => updateForm("responsavel", e.target.value)}
                  />
                </label>
                <label className="pb-saude-field">
                  <span>Público-alvo *</span>
                  <select value={form.publicoAlcance} onChange={(e) => updateForm("publicoAlcance", e.target.value)}>
                    <option value="">Selecione...</option>
                    {SAUDE_PUBLICO_OPTIONS.map((opt) => (
                      <option key={opt.id} value={opt.id}>
                        {opt.label}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="pb-saude-field">
                  <span>Nº de colaboradores atingidos{form.publicoAlcance === "todos" ? " *" : ""}</span>
                  <input
                    type="number"
                    min="0"
                    value={form.colaboradores}
                    placeholder="Ex: 120"
                    onChange={(e) => updateForm("colaboradores", e.target.value)}
                  />
                </label>
                {form.publicoAlcance === "departamentos" ? (
                  <div className="pb-saude-field pb-saude-field--full pb-saude-lista-picker">
                    <span>Departamentos atingidos *</span>
                    {departamentosHist.length ? (
                      <>
                        <div className="pb-saude-lista-tools">
                          <input
                            type="search"
                            className="pb-saude-search"
                            placeholder="Buscar departamento no histórico…"
                            value={deptPickerSearch}
                            onChange={(e) => setDeptPickerSearch(e.target.value)}
                          />
                          <button
                            type="button"
                            className="pb-saude-btn pb-saude-btn--outline pb-saude-btn--sm"
                            onClick={selecionarDeptVisiveis}
                          >
                            Marcar visíveis
                          </button>
                          <button
                            type="button"
                            className="pb-saude-btn pb-saude-btn--outline pb-saude-btn--sm"
                            onClick={limparDeptHist}
                          >
                            Limpar seleção
                          </button>
                        </div>
                        <div className="pb-saude-lista-scroll" role="listbox" aria-label="Departamentos do histórico">
                          {departamentosFiltrados.map((dept) => (
                            <label key={dept.id} className="pb-saude-lista-item pb-saude-lista-item--dept">
                              <input
                                type="checkbox"
                                checked={deptSelectedIds.has(dept.id)}
                                onChange={() => toggleDept(dept.id)}
                              />
                              <span className="pb-saude-lista-item-main">
                                <strong>{dept.nome}</strong>
                              </span>
                            </label>
                          ))}
                          {!departamentosFiltrados.length ? (
                            <p className="pb-saude-lista-empty">Nenhum departamento encontrado na busca.</p>
                          ) : null}
                        </div>
                      </>
                    ) : (
                      <p className="pb-saude-lista-hint">
                        Importe o histórico para selecionar departamentos ou digite manualmente abaixo.
                      </p>
                    )}
                    <label className="pb-saude-lista-manual">
                      <span>
                        {departamentosHist.length
                          ? "Departamentos adicionais (separados por vírgula)"
                          : "Departamentos (separados por vírgula)"}
                      </span>
                      <input
                        type="text"
                        value={departamentosHist.length ? deptManualEntries.join(", ") : form.departamentos}
                        placeholder="Ex: RH, Produção, Administrativo"
                        onChange={(e) => {
                          const manual = e.target.value;
                          if (!departamentosHist.length) {
                            updateForm("departamentos", manual);
                            return;
                          }
                          const fromHist = buildDepartamentosFromSelection(departamentosHist, deptSelectedIds);
                          updateForm("departamentos", [fromHist, manual].filter(Boolean).join(", "));
                        }}
                      />
                    </label>
                    <small>{parseSaudeDepartamentos(form.departamentos).length} departamento(s) selecionado(s)</small>
                  </div>
                ) : null}
                {form.publicoAlcance === "lista" ? (
                  <div className="pb-saude-field pb-saude-field--full pb-saude-lista-picker">
                    <span>Lista nominal *</span>
                    {colaboradoresHist.length ? (
                      <>
                        <div className="pb-saude-lista-tools">
                          <input
                            type="search"
                            className="pb-saude-search"
                            placeholder="Buscar no histórico importado…"
                            value={listaPickerSearch}
                            onChange={(e) => setListaPickerSearch(e.target.value)}
                          />
                          <button
                            type="button"
                            className="pb-saude-btn pb-saude-btn--outline pb-saude-btn--sm"
                            onClick={selecionarListaVisiveis}
                          >
                            Marcar visíveis
                          </button>
                          <button
                            type="button"
                            className="pb-saude-btn pb-saude-btn--outline pb-saude-btn--sm"
                            onClick={limparListaHist}
                          >
                            Limpar seleção
                          </button>
                        </div>
                        <div className="pb-saude-lista-scroll" role="listbox" aria-label="Colaboradores do histórico">
                          {colaboradoresFiltrados.map((colab) => (
                            <label key={colab.id} className="pb-saude-lista-item">
                              <input
                                type="checkbox"
                                checked={listaSelectedIds.has(colab.id)}
                                onChange={() => toggleListaColab(colab.id)}
                              />
                              <span className="pb-saude-lista-item-main">
                                <strong>{colab.nome}</strong>
                                {colab.matricula ? <em>{colab.matricula}</em> : null}
                              </span>
                              {colab.departamento ? (
                                <span className="pb-saude-lista-item-dept">{colab.departamento}</span>
                              ) : null}
                            </label>
                          ))}
                          {!colaboradoresFiltrados.length ? (
                            <p className="pb-saude-lista-empty">Nenhum colaborador encontrado na busca.</p>
                          ) : null}
                        </div>
                      </>
                    ) : (
                      <p className="pb-saude-lista-hint">
                        Importe o histórico de ponto para selecionar colaboradores. Você também pode digitar manualmente abaixo.
                      </p>
                    )}
                    <label className="pb-saude-lista-manual">
                      <span>{colaboradoresHist.length ? "Entradas manuais adicionais (um por linha)" : "Lista nominal (um por linha)"}</span>
                      <textarea
                        value={colaboradoresHist.length ? listaManualLines.join("\n") : form.listaNominal}
                        placeholder={formatSaudeListaLinha("Maria Silva", "12345")}
                        onChange={(e) => {
                          const manual = e.target.value;
                          if (!colaboradoresHist.length) {
                            updateForm("listaNominal", manual);
                            return;
                          }
                          const fromHist = buildListaNominalFromColabs(colaboradoresHist, listaSelectedIds);
                          updateForm("listaNominal", [fromHist, manual].filter(Boolean).join("\n"));
                        }}
                      />
                    </label>
                    <small>{parseSaudeListaNominal(form.listaNominal).length} colaborador(es) na lista</small>
                  </div>
                ) : null}
                <label className="pb-saude-field">
                  <span>Status *</span>
                  <select value={form.status} onChange={(e) => updateForm("status", e.target.value)}>
                    <option value="">Selecione...</option>
                    {SAUDE_STATUS_OPTIONS.map((opt) => (
                      <option key={opt} value={opt}>
                        {opt}
                      </option>
                    ))}
                  </select>
                </label>
                <fieldset className="pb-saude-field pb-saude-field--full pb-saude-checklist-form">
                  <legend>Checklist de conformidade (art. 169-A, CLT) *</legend>
                  {SAUDE_CHECKLIST_ITEMS.map((item) => (
                    <label key={item.id} className="pb-saude-check-item">
                      <input
                        type="checkbox"
                        checked={Boolean(normalizeSaudeChecklist(form.checklist)[item.id])}
                        onChange={() => toggleChecklistItem(item.id)}
                      />
                      <span>{item.label}</span>
                    </label>
                  ))}
                  <label className="pb-saude-check-item pb-saude-check-item--law">
                    <input type="checkbox" checked={form.art473Comunicado} onChange={toggleArt473Comunicado} />
                    <span>
                      Comuniquei o direito de ausência remunerada para exames preventivos (art. 473, § 3º, CLT)
                    </span>
                  </label>
                  <p className="pb-saude-check-hint">
                    Status &quot;Realizado&quot; exige checklist completo, público-alvo, evidência (anexo ou texto) e
                    confirmação do art. 473, § 3º.
                  </p>
                </fieldset>
                <div className="pb-saude-field pb-saude-field--full pb-saude-anexos">
                  <span>Evidências anexas (PDF, imagem — máx. 5 arquivos de 5 MB)</span>
                  <input
                    type="file"
                    multiple
                    accept="image/*,application/pdf,.doc,.docx"
                    onChange={(e) => {
                      adicionarAnexos(e.target.files);
                      e.target.value = "";
                    }}
                  />
                  {form.pendingAnexos.length ? (
                    <ul className="pb-saude-anexos-list">
                      {form.pendingAnexos.map((anexo) => (
                        <li key={anexo.id}>
                          <span>
                            {anexo.nome} ({Math.ceil(anexo.tamanho / 1024)} KB)
                          </span>
                          <button
                            type="button"
                            className="pb-saude-btn pb-saude-btn--danger pb-saude-btn--sm"
                            onClick={() => removerAnexoPendente(anexo.id)}
                          >
                            Remover
                          </button>
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="pb-saude-check-hint">Anexe print de e-mail, foto do mural, ata SIPAT ou PDF oficial.</p>
                  )}
                </div>
                <label className="pb-saude-field pb-saude-field--full">
                  <span>Texto / evidência da comunicação</span>
                  <textarea
                    value={form.obs}
                    placeholder="Use o modelo legal com o texto do art. 473, XII e descreva a evidência enviada."
                    onChange={(e) => updateForm("obs", e.target.value)}
                  />
                </label>
              </div>
              <div className="pb-saude-form-actions">
                <button type="button" className="pb-saude-btn pb-saude-btn--outline" onClick={inserirModeloLegal}>
                  Inserir modelo legal
                </button>
                <button type="button" className="pb-saude-btn pb-saude-btn--primary" onClick={registrarComunicacao}>
                  Salvar registro
                </button>
                <button type="button" className="pb-saude-btn pb-saude-btn--outline" onClick={limparForm}>
                  Limpar
                </button>
              </div>
            </div>
          </div>
        )}

        {activeTab === "historico" && (
          <div className="pb-saude-tab-panel" role="tabpanel" aria-label="Histórico de comunicações">
            <div className="pb-saude-table-card">
              <div className="pb-saude-table-head">
                <h3>Histórico de comunicações</h3>
                <div className="pb-saude-table-tools">
                  <input
                    className="pb-saude-search"
                    type="search"
                    placeholder="Buscar..."
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                  />
                  <button type="button" className="pb-saude-btn pb-saude-btn--success pb-saude-btn--sm" onClick={exportarCsv}>
                    Exportar CSV
                  </button>
                </div>
              </div>
              <div className="pb-saude-table-wrap">
                <table className="pb-saude-table">
                  <thead>
                    <tr>
                      <th>#</th>
                      <th>Data</th>
                      <th>Tema</th>
                      <th>Alcance</th>
                      <th>Anexos</th>
                      <th>Status</th>
                      <th>Ações</th>
                    </tr>
                  </thead>
                  <tbody>
                    {!registrosFiltrados.length ? (
                      <tr>
                        <td colSpan={7} className="pb-saude-table-empty">
                          Nenhum registro encontrado. Cadastre uma comunicação na aba &quot;Registrar&quot;.
                        </td>
                      </tr>
                    ) : (
                      registrosFiltrados.map((r) => {
                        const norm = normalizeSaudeRegistro(r);
                        return (
                          <tr key={norm.id}>
                            <td>
                              <strong>{norm.id}</strong>
                            </td>
                            <td>{formatSaudeDataBr(norm.data)}</td>
                            <td>{norm.tema}</td>
                            <td>{labelSaudePublicoAlcance(norm)}</td>
                            <td>{norm.anexos.length || "—"}</td>
                            <td>
                              <span className={`pb-saude-status pb-saude-status--${statusClassFromLabel(norm.status)}`}>
                                {norm.status}
                              </span>
                            </td>
                            <td className="pb-saude-table-actions">
                              <button
                                type="button"
                                className="pb-saude-btn pb-saude-btn--outline pb-saude-btn--sm"
                                onClick={() => setModalRegistro(norm)}
                                aria-label={`Ver detalhes de ${norm.tema}`}
                              >
                                Ver
                              </button>
                              <button
                                type="button"
                                className="pb-saude-btn pb-saude-btn--danger pb-saude-btn--sm"
                                onClick={() => excluirRegistro(norm.id)}
                                aria-label={`Excluir registro ${norm.id}`}
                              >
                                Excluir
                              </button>
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {activeTab === "fontes" && (
          <div className="pb-saude-tab-panel" role="tabpanel" aria-label="Fontes oficiais">
            <div className="pb-saude-sources">
              {SAUDE_FONTES.map((fonte) => (
                <article key={fonte.url} className="pb-saude-source" style={{ borderLeftColor: fonte.cor }}>
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
          className="pb-saude-modal-overlay"
          role="presentation"
          onClick={(e) => {
            if (e.target === e.currentTarget) setModalRegistro(null);
          }}
        >
          <div className="pb-saude-modal" role="dialog" aria-modal="true" aria-labelledby="pb-saude-modal-title">
            <h3 id="pb-saude-modal-title">{modalRegistro.tema}</h3>
            <p>
              <strong>Data:</strong> {formatSaudeDataBr(modalRegistro.data)}
            </p>
            <p>
              <strong>Canal:</strong> {modalRegistro.canal}
            </p>
            <p>
              <strong>Responsável:</strong> {modalRegistro.responsavel}
            </p>
            <p>
              <strong>Alcance:</strong> {labelSaudePublicoAlcance(modalRegistro)}
            </p>
            <p>
              <strong>Colaboradores:</strong>{" "}
              {countSaudeAlcance(modalRegistro) || modalRegistro.colaboradores || "Não informado"}
            </p>
            <p>
              <strong>Art. 473, § 3º comunicado:</strong> {modalRegistro.art473Comunicado ? "Sim" : "Não"}
            </p>
            <p>
              <strong>Status:</strong>{" "}
              <span className={`pb-saude-status pb-saude-status--${statusClassFromLabel(modalRegistro.status)}`}>
                {modalRegistro.status}
              </span>
            </p>
            <div className="pb-saude-modal-checklist">
              <strong>Checklist legal:</strong>
              <ul>
                {SAUDE_CHECKLIST_ITEMS.map((item) => {
                  const done = Boolean(normalizeSaudeChecklist(modalRegistro.checklist)[item.id]);
                  return (
                    <li key={item.id} className={done ? "is-done" : ""}>
                      {done ? "✓" : "○"} {item.label}
                    </li>
                  );
                })}
              </ul>
            </div>
            {modalRegistro.anexos?.length ? (
              <div className="pb-saude-modal-anexos">
                <strong>Anexos:</strong>
                <ul>
                  {modalRegistro.anexos.map((anexo) => (
                    <li key={anexo.id}>
                      <button
                        type="button"
                        className="pb-saude-btn pb-saude-btn--outline pb-saude-btn--sm"
                        onClick={() => baixarAnexo(modalRegistro, anexo)}
                      >
                        Baixar {anexo.nome}
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}
            {modalRegistro.obs ? (
              <p className="pb-saude-modal-obs">
                <strong>Texto / evidência:</strong> {modalRegistro.obs}
              </p>
            ) : null}
            <div className="pb-saude-modal-actions">
              <button type="button" className="pb-saude-btn pb-saude-btn--outline" onClick={() => setModalRegistro(null)}>
                Fechar
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </section>
  );
}
