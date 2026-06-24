import React, { Suspense, lazy, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import {
  mergeImportedEvents,
  mergeNewEvents,
  loadEventCategories,
  loadHourCategories,
} from "./HorasConfigModal";
import { Toast } from "../../core/toast.js";
import { Auth } from "../../core/auth.js";
import { PERMISSIONS, canAny } from "../../core/permissions.js";
import { AbonosDeptPanel } from "./abonos/AbonosDeptPanel.jsx";
import {
  buildBancoHorasRowsFromHistEvents,
  diagnoseBancoHorasSheet,
  formatBancoHorasDiagnosis,
  formatBancoHorasImportSummary,
  loadKpiBancoHoras,
  readWorksheetAoa,
  packBancoHorasStorage,
  parseBancoHorasSheet,
  saveKpiBancoHoras,
} from "./banco-horas/bancoHoras.js";
import { loadKpiMensal, parseMensalSheet, saveKpiMensal } from "./mensal.js";
import { buildDeptTopList } from "./posicaoImport.js";
import { EmpFilter } from "./EmpFilter";
import {
  normDateKey,
  extractPeriodoApuracao,
  fmtDateBr,
  getDateMeta,
  getHistDataCutoffIso,
} from "./calendarUtils";
import {
  loadAbsenteismoMeta,
  saveAbsenteismoMeta,
  loadTurnoverMeta,
  saveTurnoverMeta,
  normalizeForcaPrevistaDeptoMap,
  serializeForcaPrevistaDeptoMap,
  getForcaPrevistaQty,
  parseFpdMoney,
  formatFpdMoneyDisplay,
} from "./posicaoSettings.js";
import { RadarKpiModal } from "./RadarKpiModal.jsx";
import { RadarHoursFace } from "./RadarHoursFace.jsx";
import { ConsecFaltasModal } from "./ConsecFaltasModal.jsx";
import { HistoricoDayModal } from "./HistoricoDayModal.jsx";
import "./HistoricoDayModal.css";
import { buildChartDayModalState, fetchChartDayEmployees } from "./chartDayModalUtil.js";
import { CONFIG } from "../../config.js";
import {
  STAT_DAY_TOOLTIPS,
  buildAbsIndexTooltip,
} from "./radarKpiTooltips.js";
import {
  ABSENTEISMO_FORMULA_ID,
  ABSENTEISMO_FORMULA_LABEL,
  capWorkedHours,
} from "./radarHoursUtils.js";
import { buildDashboardNlContext } from "./assistant/dashboardNlContext.js";
import {
  ABONOS_KIND,
  formatAbonosDiagnosis,
  formatAbonosImportSummary,
  loadKpiAbonos,
  parseAbonosFromWorkbook,
  saveKpiAbonos,
} from "./abonos/abonosDept.js";
import { DashboardNlAskPanel } from "./assistant/DashboardNlAskPanel.jsx";
import { OperationalDiagnosisPanel } from "../../features/positionToday/intelligence/OperationalDiagnosisPanel.jsx";
import {
  normalizeSaudeRegistro,
  resolveEmpresaLabel,
} from "./saude-preventiva/saudePreventivaCampanhas.js";
import { buildSaudeCalendarioLembretes } from "./saude-preventiva/saudePreventivaArt473.js";
import { processSaudeCalendarioLembretes } from "./saude-preventiva/saudePreventivaLembretes.js";
import { openNr1InNewTab } from "./nr1/nr1Open.js";
import { openSaudePreventivaInNewTab } from "./saude-preventiva/saudePreventivaOpen.js";
import { loadSaudeRegistrosSync } from "./saude-preventiva/saudePreventivaStorage.js";
import { SearchableSelect } from "./components/SearchableSelect.jsx";
import { AbsenteismoResumoCard } from "./absenteismo/AbsenteismoResumoCard.jsx";
import { buildHistRadarSummary } from "./absenteismo/histRadarSummary.js";
import { BancoHorasCard } from "./banco-horas/BancoHorasCard.jsx";
import { buildBancoHorasStats } from "./banco-horas/bancoHorasStats.js";
import { buildMensalEventColabs } from "./mensal/mensalEventColabs.js";
import { MensalListCard } from "./mensal/MensalListCard.jsx";
import { RadarTrabalhistaResumoCard } from "./radar-trabalhista/RadarTrabalhistaResumoCard.jsx";
import {
  loadKpiTurnover,
  saveKpiTurnover,
  parseTurnoverCsv,
  parseTurnoverAoa,
  buildTurnoverView,
  loadTurnoverPeriod,
  saveTurnoverPeriod,
  ymToMmYyyy,
  mmYyyyToYm,
} from "./turnover/turnoverData.js";
import { fmtHM, fmtHMReadable, fmtHMMilhar } from "./utils/timeFormat.js";
import {
  DATAVIEW_URL,
  PB_FALT_DAYS_ATUAL,
  collectHistEventNames,
  extractHistRowsPeriodo,
  filterHistRowsByPeriod,
  fmt,
  fmtDateInput,
  fmtShortDate,
  normalizeFaltDays,
  parseDateInput,
  pct,
} from "./utils/positionViewUtils.js";
import { loadPbView, savePbView } from "./utils/pbViewStorage.js";
import { buildEventKey, collectDiagnosisCategoryRows } from "./utils/positionDiagnosisRows.js";
import { parseXlsxToHistTabela } from "./importacao/parseXlsxToHistTabela.js";
import { normalizePositionCategory } from "./domain/positionCategories.js";
import { PbLayoutPreferencesModal } from "./PbLayoutPreferencesModal.jsx";
import {
  getPosicaoDashboardCardOrder,
  isPosicaoDashboardCardHidden,
  loadPosicaoDashboardLayout,
} from "./posicaoDashboardLayout.js";
import "./posicao-bento.css";

const BentoHistChart = lazy(() => import("./BentoHistChart"));
const AbsenteismoChart = lazy(() => import("./AbsenteismoChart"));
const HorasChart = lazy(() => import("./HorasChart"));
const HistoricoTable = lazy(() => import("./HistoricoTable"));
const PbConfiguracoesModal = lazy(() =>
  import("./PbConfiguracoesModal.jsx").then((m) => ({ default: m.PbConfiguracoesModal })),
);
function RadarTrabalhistaLoadError({ error }) {
  return (
    <div className="rt-overlay-loading" style={{ flexDirection: "column", gap: 8, padding: 24 }}>
      <strong>Não foi possível abrir o Radar Trabalhista</strong>
      <span style={{ fontSize: 13, opacity: 0.85 }}>
        {error?.message || "Erro ao carregar o módulo."} Recarregue a página (F5) ou verifique o
        console (F12).
      </span>
    </div>
  );
}

const RadarTrabalhistaShell = lazy(() =>
  import("./radar-trabalhista/RadarTrabalhistaShell.jsx")
    .then((m) => ({ default: m.RadarTrabalhistaShell }))
    .catch((error) => {
      console.error("[Radar Trabalhista] falha no import dinâmico", error);
      return { default: () => <RadarTrabalhistaLoadError error={error} /> };
    }),
);
const HorasCalculadora = lazy(() => import("./HorasCalculadora"));

/**
 * Bento header for Posi?o do Dia.
 * Pure presentation: receives metrics + click handlers.
 *
 * Props:
 * ? - metrics: {
 *      prevista, atual, vagas, presentes, faltas, atrasos,
 *      folgas, ferias, afastados, saiu, entrada, semControle,
 *      trend: number[5]  // ultimos 5 dias uteis
 *    }
 * ? - lastUpdText: string
 * ? - loading: boolean
 * ? - onCardClick: (categoryKey) => void
 * ? - onRefresh: () => void
 */

export function PosicaoBentoHeader({
  metrics,
  lastUpdText,
  loading,
  fetching = false,
  onCardClick,
  onRefresh,
  dataRefText = "",
  selectedDate = "",
  onDateChange,
  totalText = "",
  filialOptions = [],
  deptoOptions = [],
  filialValue = "",
  deptoValue = "",
  onFilialChange,
  onDeptoChange,
  theme = "light",
  onToggleTheme,
  onOpenChart,
  deptRows = [],
  deptStats = [],
  dia = null,
  filteredDia = null,
  deptAbsenceList = [],
  onOpenDept,
  forcaPrevistaDeptoMap = null,
  onSaveForcaPrevistaDeptoMap,
  onImportXlsx,
  importBusy = false,
  importOverrides = null,
  onClearImport,
  onImportTabela,
  onClearTabelaImport,
  onExportPosicaoBackup,
  onImportPosicaoBackup,
  tabelaImportCount = 0,
  onOpenTurnoverDesligados,
  onOpenTurnoverAdmitidos,
  onOpenAbonosDeptColaboradores,
  onOpenMensalEventColaboradores,
  onOpenBancoHorasDeptColaboradores,
  onOpenBancoHorasKpiColaboradores,
  histData = [],
  histDeptData = [],
  periodoApuracao: periodoApuracaoProp = null,
  onPeriodoApuracaoChange: onPeriodoApuracaoChangeProp = null,
}) {
  const m = metrics || {};
  const [dateDraft, setDateDraft] = useState(() => fmtDateInput(selectedDate || dataRefText));
  useEffect(() => {
    setDateDraft(fmtDateInput(selectedDate || dataRefText));
  }, [selectedDate, dataRefText]);
  const commitDateDraft = useCallback(
    (value = dateDraft) => {
      const parsed = parseDateInput(value);
      if (parsed) onDateChange?.(parsed);
    },
    [dateDraft, onDateChange],
  );
  const presP = pct(m.presentes, m.atual);
  const faltP = pct(m.faltas, m.atual);
  const atrP = pct(m.atrasos, m.atual);
  const folgP = pct(m.folgas, m.atual);
  const ferP = pct(m.ferias, m.atual);
  const afaP = pct(m.afastados, m.atual);
  const entP = pct(m.entrada, m.atual);
  const semP = pct(m.semControle, m.atual);
  const totalPlan = (m.folgas || 0) + (m.ferias || 0) + (m.afastados || 0);

  // Indicadores de tendencia vs dia anterior
  const deltaDia = (current, prev, maisEhRuim = true) => {
    if (prev == null || current == null || Math.abs(current - prev) < 1) return null;
    const diff = current - prev;
    const ruim = maisEhRuim ? diff > 0 : diff < 0;
    return {
      text: `${diff > 0 ? "\u2191" : "\u2193"} ${diff > 0 ? "+" : ""}${diff} vs ontem`,
      ruim,
    };
  };
  const faltasDelta = deltaDia(m.faltas, m.ontem?.faltas, true);
  const atrasosDelta = deltaDia(m.atrasos, m.ontem?.atrasos, true);

  const presDeg = m.atual > 0 ? Math.round((m.presentes / m.atual) * 360) : 0;
  const folgW = totalPlan > 0 ? Math.round((m.folgas / totalPlan) * 100) : 0;
  const ferW = totalPlan > 0 ? Math.round((m.ferias / totalPlan) * 100) : 0;
  const planBarBg = `linear-gradient(90deg, var(--pb-folgas) ${folgW}%, var(--pb-ferias) ${folgW}% ${folgW + ferW}%, var(--pb-afastados) ${folgW + ferW}%)`;

  const click = (key) => () => {
    if (typeof onCardClick === "function") onCardClick(key);
  };

  const operationalDiagnosisData = useMemo(
    () => ({
      dataRef: selectedDate || dataRefText || filteredDia?.data || dia?.data || "",
      faltasRows: collectDiagnosisCategoryRows(filteredDia || dia, "faltas"),
      atrasosRows: collectDiagnosisCategoryRows(filteredDia || dia, "atrasos"),
      feriasRows: collectDiagnosisCategoryRows(filteredDia || dia, "ferias"),
      resumo: {
        presentes: Number(m.presentes) || 0,
        ausentes: Number(m.faltas) || 0,
        atrasados: Number(m.atrasos) || 0,
        folgas: Number(m.folgas) || 0,
        ferias: Number(m.ferias) || 0,
        afastados: Number(m.afastados) || 0,
        jaSairam: Number(m.saiu) || 0,
        entradaPrevista: Number(m.entrada) || 0,
        semControle: Number(m.semControle) || 0,
        forcaAtual: Number(m.atual) || 0,
        forcaPrevista: Number(m.prevista) || 0,
        vagas: Number(m.vagas) || 0,
      },
      departamentos: (Array.isArray(deptStats) ? deptStats : []).map((dept) => ({
        id: dept.depto || dept.nome,
        nome: dept.depto || dept.nome || "Sem departamento",
        gestor: dept.gestor || dept.responsavel || "",
        presentes: Number(dept.presentes) || 0,
        ausentes: Number(dept.falta) || Number(dept.faltas) || 0,
        atrasados: Number(dept.atraso) || Number(dept.atrasos) || 0,
        forcaAtual: Number(dept.atual) || 0,
        forcaPrevista: Number(dept.prevista) || 0,
      })),
    }),
    [
      m.presentes,
      m.faltas,
      m.atrasos,
      m.folgas,
      m.ferias,
      m.afastados,
      m.saiu,
      m.entrada,
      m.semControle,
      m.atual,
      m.prevista,
      m.vagas,
      deptStats,
      selectedDate,
      dataRefText,
      filteredDia,
      dia,
    ],
  );

  const handleOperationalAction = useCallback(
    (action, payload = {}) => {
      const normalizeCategory = (value) => {
        const normalized = normalizePositionCategory(value, "presentes");
        if (normalized === "falta") return "faltas";
        if (normalized === "atraso") return "atrasos";
        if (normalized === "nao_controla") return "semControle";
        return normalized || "presentes";
      };
      const normalizedPayload = {
        ...payload,
        category: normalizeCategory(payload.category || payload.focus),
      };

      if (action === "OPEN_DEPARTMENT" && typeof onOpenDept === "function") {
        onOpenDept(normalizedPayload);
        return;
      }
      if (action === "OPEN_MANAGER" && typeof onOpenDept === "function") {
        onOpenDept(normalizedPayload);
        return;
      }
      if (action === "OPEN_EMPLOYEES" && typeof onCardClick === "function") {
        onCardClick(normalizedPayload.category || "presentes");
      }
    },
    [onCardClick, onOpenDept],
  );

  // ===== Expandir (fullscreen) =====
  const rootRef = useRef(null);
  const [isFullscreen, setIsFullscreen] = useState(false);
  useEffect(() => {
    const onFsChange = () => {
      setIsFullscreen(!!document.fullscreenElement);
    };
    document.addEventListener("fullscreenchange", onFsChange);
    onFsChange();
    return () => document.removeEventListener("fullscreenchange", onFsChange);
  }, []);

  // ===== Historico (grafico / tabela) =====
  const [faltDays, setFaltDays] = useState(() => normalizeFaltDays(loadPbView()?.faltDays));
  const [bentoView, setBentoView] = useState(() =>
    loadPbView()?.bentoView === "table" ? "table" : "chart",
  );
  const [sidebarCollapsed, setSidebarCollapsed] = useState(
    () => loadPbView()?.sidebarCollapsed === true,
  );
  const toggleSidebarCollapsed = useCallback(() => {
    setSidebarCollapsed((prev) => {
      const next = !prev;
      savePbView({ sidebarCollapsed: next });
      return next;
    });
  }, []);
  const [histChartMode, setHistChartMode] = useState(() => loadPbView()?.histChartMode || "abs");
  const [histDetailOpen, setHistDetailOpen] = useState(false);
  const [consecFaltasOpen, setConsecFaltasOpen] = useState(false);
  const [histDateFrom, setHistDateFrom] = useState("");
  const [histDateTo, setHistDateTo] = useState("");
  const [histCtrlEl, setHistCtrlEl] = useState(null);
  const [selectedEmp, setSelectedEmp] = useState(null);
  const [nlAppliedFilter, setNlAppliedFilter] = useState(null);
  const [histIsFloating, setHistIsFloating] = useState(false);
  const [histOpenDateRequest, setHistOpenDateRequest] = useState(null);
  const [chartDayModal, setChartDayModal] = useState(null);
  const [histHighlightCol, setHistHighlightCol] = useState(null);
  const [histTableViewRequest, setHistTableViewRequest] = useState(null);
  const [radarWorkspaceOpen, setRadarWorkspaceOpen] = useState(false);
  const [periodoApuracaoOverrideLocal, setPeriodoApuracaoOverrideLocal] = useState(null);
  const setPeriodoApuracaoOverride = onPeriodoApuracaoChangeProp || setPeriodoApuracaoOverrideLocal;
  const periodoApuracao = useMemo(() => {
    if (onPeriodoApuracaoChangeProp && periodoApuracaoProp?.de && periodoApuracaoProp?.ate) {
      return periodoApuracaoProp;
    }
    if (periodoApuracaoOverrideLocal?.de && periodoApuracaoOverrideLocal?.ate) {
      return periodoApuracaoOverrideLocal;
    }
    const fromProp =
      periodoApuracaoProp?.de && periodoApuracaoProp?.ate ? periodoApuracaoProp : null;
    if (fromProp) return fromProp;
    const fromDia = extractPeriodoApuracao(dia);
    if (fromDia?.de && fromDia?.ate) return fromDia;
    const fromHist = extractPeriodoApuracao(histData);
    if (fromHist?.de && fromHist?.ate) return fromHist;
    return extractHistRowsPeriodo(histData);
  }, [
    onPeriodoApuracaoChangeProp,
    periodoApuracaoOverrideLocal,
    periodoApuracaoProp,
    dia,
    histData,
  ]);

  const openHistTableModal = useCallback((opts = {}) => {
    setRadarWorkspaceOpen(false);
    setBentoView(opts.view || "table");
    setHistIsFloating(true);
    if (opts.colId != null) setHistHighlightCol(opts.colId);
    else if (opts.clearHighlight) setHistHighlightCol(null);
    if (opts.tableViewRequest) setHistTableViewRequest(opts.tableViewRequest);
    if (opts.openDateRequest) setHistOpenDateRequest(opts.openDateRequest);
  }, []);

  const openHistTableInline = useCallback((opts = {}) => {
    setRadarWorkspaceOpen(false);
    setBentoView(opts.view || "table");
    setHistDetailOpen(true);
    setHistIsFloating(false);
    if (opts.dateFrom !== undefined) setHistDateFrom(normDateKey(opts.dateFrom) || "");
    if (opts.dateTo !== undefined) setHistDateTo(normDateKey(opts.dateTo) || "");
    if (opts.colId != null) setHistHighlightCol(opts.colId);
    else if (opts.clearHighlight) setHistHighlightCol(null);
    if (opts.tableViewRequest) setHistTableViewRequest(opts.tableViewRequest);
    if (opts.openDateRequest) setHistOpenDateRequest(opts.openDateRequest);
  }, []);

  const closeHistTableModal = useCallback(() => {
    setHistIsFloating(false);
    setHistDetailOpen(false);
    setHistHighlightCol(null);
  }, []);

  const dockHistTableModal = useCallback(() => {
    setHistIsFloating(false);
    setHistDetailOpen(true);
    setBentoView("table");
  }, []);

  const openHistTableCol = useCallback(
    (colId) => {
      openHistTableInline({ colId });
    },
    [openHistTableInline],
  );

  const openHistTableRisk = useCallback(() => {
    openHistTableInline({
      clearHighlight: true,
      tableViewRequest: { view: "risk", ts: Date.now() },
    });
  }, [openHistTableInline]);

  const openHistFromRadar = useCallback(() => {
    openHistTableInline({
      clearHighlight: true,
      tableViewRequest: { view: "date", ts: Date.now() },
    });
  }, [openHistTableInline]);

  const openAbsChartView = useCallback(() => {
    setRadarWorkspaceOpen(false);
    setBentoView("chart");
    setHistDetailOpen(true);
    setHistIsFloating(false);
    setHistHighlightCol(null);
    window.requestAnimationFrame(() => {
      document
        .querySelector(".pb-unified-chart")
        ?.scrollIntoView?.({ behavior: "smooth", block: "nearest" });
    });
  }, []);

  const openAbsHomeView = useCallback(() => {
    setRadarWorkspaceOpen(false);
    setHistDetailOpen(false);
    setHistIsFloating(false);
    setHistHighlightCol(null);
    window.requestAnimationFrame(() => {
      document
        .querySelector(".pb-radar-card--abs")
        ?.scrollIntoView?.({ behavior: "smooth", block: "nearest" });
    });
  }, []);

  const openConsecFaltasModal = useCallback(() => {
    setConsecFaltasOpen(true);
  }, []);

  const openRadarWorkspace = useCallback(() => {
    setRadarWorkspaceOpen(true);
    setHistHighlightCol(null);
  }, []);

  const openRadarToCct = useCallback(() => {
    setRadarWorkspaceOpen(true);
    setHistHighlightCol(null);
    window.setTimeout(() => {
      window.dispatchEvent(new CustomEvent("pb-show-cct"));
      window.setTimeout(() => {
        window.dispatchEvent(new CustomEvent("pb-open-cct-import"));
      }, 200);
    }, 100);
  }, []);

  useEffect(() => {
    if (!histDetailOpen) setHistHighlightCol(null);
  }, [histDetailOpen]);

  useEffect(() => {
    if (!histIsFloating) return undefined;
    const onKey = (e) => {
      if (e.key === "Escape") closeHistTableModal();
    };
    document.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [histIsFloating, closeHistTableModal]);

  useEffect(() => {
    if (!radarWorkspaceOpen) return undefined;
    const onKey = (e) => {
      if (e.key === "Escape") setRadarWorkspaceOpen(false);
    };
    document.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [radarWorkspaceOpen]);

  const selectFaltDays = useCallback((d) => {
    setHistDateFrom("");
    setHistDateTo("");
    setFaltDays(d);
  }, []);

  const hasActiveFilters = Boolean(
    filialValue || deptoValue || selectedEmp || histDateFrom || histDateTo || nlAppliedFilter,
  );

  const handleClearFilters = useCallback(() => {
    onFilialChange?.("");
    onDeptoChange?.("");
    setSelectedEmp(null);
    setHistDateFrom("");
    setHistDateTo("");
    setNlAppliedFilter(null);
    setHistTableViewRequest((prev) => ({
      view: prev?.view || "date",
      ts: Date.now(),
      search: "",
      filterField: "",
    }));
  }, [onFilialChange, onDeptoChange]);

  const clearNlAppliedFilter = useCallback(() => {
    if (!nlAppliedFilter) return;
    const field = String(nlAppliedFilter.field || "").toLowerCase();
    if (field === "departamento" || field === "depto") onDeptoChange?.("");
    if (field === "colaborador") setSelectedEmp(null);
    setNlAppliedFilter(null);
    setHistTableViewRequest((prev) => ({
      view: prev?.view || "date",
      ts: Date.now(),
      search: "",
      filterField: "",
    }));
  }, [nlAppliedFilter, onDeptoChange]);
  const didInitFaltDays = useRef(false);
  const didInitBentoView = useRef(false);
  useEffect(() => {
    if (!didInitFaltDays.current) {
      didInitFaltDays.current = true;
      return;
    }
    savePbView({ faltDays });
  }, [faltDays]);
  useEffect(() => {
    if (!didInitBentoView.current) {
      didInitBentoView.current = true;
      return;
    }
    savePbView({ bentoView, histChartMode });
  }, [bentoView, histChartMode]);
  const histRowsAll = useMemo(() => {
    const base = Array.isArray(histData) ? histData : [];
    return base
      .map((r) => {
        const total = Number(r?.total) || 0;
        const faltas = Number(r?.faltas) || 0;
        const atrasos = Number(r?.atrasos) || 0;
        const justificadas = Number(r?.justificadas) || 0;
        const presentes = Math.max(0, total - faltas);
        const denom = Math.max(total, 1);
        return {
          date: normDateKey(r?.date || r?.data_referencia || r?.data),
          departamento:
            r?.departamento ||
            r?.depto ||
            r?.depto_desc ||
            r?.departamentoNome ||
            r?.["departamento.nome"] ||
            "",
          depto:
            r?.depto ||
            r?.departamento ||
            r?.depto_desc ||
            r?.departamentoNome ||
            r?.["departamento.nome"] ||
            "",
          depto_desc:
            r?.depto_desc ||
            r?.departamento ||
            r?.depto ||
            r?.departamentoNome ||
            r?.["departamento.nome"] ||
            "",
          departamentoNome:
            r?.departamentoNome ||
            r?.departamento ||
            r?.depto ||
            r?.depto_desc ||
            r?.["departamento.nome"] ||
            "",
          filial: r?.filial || r?.empresa || "",
          empresa: r?.empresa || r?.filial || "",
          cargo: r?.cargo || r?.cargo_desc || "",
          cargo_desc: r?.cargo_desc || r?.cargo || "",
          total,
          faltas,
          atrasos,
          justificadas,
          presentes,
          presentesPct: +((presentes / denom) * 100).toFixed(1),
          faltasPct: +((faltas / denom) * 100).toFixed(1),
          atrasosPct: +((atrasos / denom) * 100).toFixed(1),
          justificadasPct: +((justificadas / denom) * 100).toFixed(1),
          horas_presentes:
            r?.horas_presentes != null
              ? capWorkedHours(r.horas_presentes, r.horas_planejadas)
              : null,
          horas_planejadas: r?.horas_planejadas != null ? Number(r.horas_planejadas) : null,
          horas_faltas: r?.horas_faltas != null ? Number(r.horas_faltas) : null,
          horas_atrasos: r?.horas_atrasos != null ? Number(r.horas_atrasos) : null,
          horas_justificadas: r?.horas_justificadas != null ? Number(r.horas_justificadas) : null,
          extras: r?.extras != null ? Number(r.extras) : null,
          horas_extras: r?.horas_extras != null ? Number(r.horas_extras) : null,
          _employees: r?._employees || null,
          _events: r?._events || null,
        };
      })
      .filter((r) => r.date);
  }, [histData]);
  const currentTableEventNames = useMemo(() => collectHistEventNames(histRowsAll), [histRowsAll]);
  const histRows = useMemo(
    () =>
      filterHistRowsByPeriod(histRowsAll, { faltDays, histDateFrom, histDateTo, periodoApuracao }),
    [histRowsAll, faltDays, histDateFrom, histDateTo, periodoApuracao],
  );

  const histPeriodEvents = useMemo(
    () => histRows.flatMap((r) => (Array.isArray(r._events) ? r._events : [])),
    [histRows],
  );

  const openChartDayModal = useCallback(
    (date) => {
      const row = histRows.find((r) => r.date === date);
      const initial = buildChartDayModalState(row, histPeriodEvents);
      if (!initial) return;
      setRadarWorkspaceOpen(false);
      setBentoView("chart");
      setHistDetailOpen(true);
      setHistIsFloating(false);
      setChartDayModal(initial);
      if (initial.employees.length === 0 && initial.events.length === 0) {
        fetchChartDayEmployees(date, setChartDayModal);
      }
    },
    [histRows, histPeriodEvents],
  );

  const closeChartDayModal = useCallback(() => {
    setChartDayModal(null);
  }, []);

  const [storedBancoHoras, setStoredBancoHoras] = useState(() => loadKpiBancoHoras());
  const [storedAbonos, setStoredAbonos] = useState(() => loadKpiAbonos());
  const [abonosBusy, setAbonosBusy] = useState(false);
  const cfgAbonosFileRef = useRef(null);
  const cfgAbonosEfetuadosFileRef = useRef(null);
  const [storedMensal, setStoredMensal] = useState(() => loadKpiMensal());
  const [cfgOpen, setCfgOpen] = useState(false);
  const authz = useMemo(() => Auth.getAuthz(), []);
  const can = useCallback((permission) => Auth.can(permission), []);
  const canViewAbsenteismoCard = can(PERMISSIONS.cards.absenteismo);
  const canViewRadarCard = can(PERMISSIONS.cards.radar);
  const canViewTurnoverCard = can(PERMISSIONS.cards.turnover);
  const canViewAbonosCard = can(PERMISSIONS.cards.abonos);
  const canViewBancoHorasCard = can(PERMISSIONS.cards.bancoHoras);
  const canViewMensalCard = can(PERMISSIONS.cards.mensal);
  const canViewSaudePreventivaCard = can(PERMISSIONS.cards.saudePreventiva);
  const canViewNr1Card = can(PERMISSIONS.cards.nr1);
  const canViewAssistant = can(PERMISSIONS.cards.assistant);
  const canEditMetas = can(PERMISSIONS.config.metas);
  const canEditHoras = can(PERMISSIONS.config.horas);
  const canEditForcaPrevista = can(PERMISSIONS.config.forcaPrevista);
  const canUseImportacoes =
    can(PERMISSIONS.config.importacoes) || canAny(authz, Object.values(PERMISSIONS.imports));
  const canUseConfig = canUseImportacoes || canEditMetas || canEditHoras;
  const [layoutOpen, setLayoutOpen] = useState(false);
  const [dashboardLayout, setDashboardLayout] = useState(() => loadPosicaoDashboardLayout());
  const layoutAllowed = useMemo(
    () => ({
      posicao: true,
      historico: canViewAbsenteismoCard,
      horasPeriodo: canViewAbsenteismoCard,
      radarTrabalhista: canViewRadarCard,
      bancoHoras: canViewBancoHorasCard,
      abonos: canViewAbonosCard,
      mensal: canViewMensalCard,
      turnover: canViewTurnoverCard,
      saudePreventiva: canViewSaudePreventivaCard,
      nr1: canViewNr1Card,
    }),
    [
      canViewAbonosCard,
      canViewAbsenteismoCard,
      canViewBancoHorasCard,
      canViewMensalCard,
      canViewNr1Card,
      canViewRadarCard,
      canViewSaudePreventivaCard,
      canViewTurnoverCard,
    ],
  );
  const allowedLayoutIds = useMemo(
    () => Object.entries(layoutAllowed).filter(([, allowed]) => allowed).map(([id]) => id),
    [layoutAllowed],
  );
  const canShowPanel = useCallback(
    (id) => Boolean(layoutAllowed[id]) && !isPosicaoDashboardCardHidden(dashboardLayout, id),
    [dashboardLayout, layoutAllowed],
  );
  const panelOrder = useCallback(
    (id) => getPosicaoDashboardCardOrder(dashboardLayout, id),
    [dashboardLayout],
  );
  const panelStyle = useCallback(
    (id) => (dashboardLayout.mode === "custom" ? { order: panelOrder(id) } : undefined),
    [dashboardLayout.mode, panelOrder],
  );
  const openMensalEventModal = useCallback(
    (row) => {
      if (!row?.event) return;
      onOpenMensalEventColaboradores?.(row);
    },
    [onOpenMensalEventColaboradores],
  );
  const bancoHorasStats = useMemo(
    () => buildBancoHorasStats(histRows, loadEventCategories(), storedBancoHoras),
    [histRows, cfgOpen, storedBancoHoras],
  );
  const histDeptRows = useMemo(() => {
    const base = Array.isArray(histDeptData) && histDeptData.length ? histDeptData : histData;
    const rows = (Array.isArray(base) ? base : [])
      .map((r) => {
        const total = Number(r?.total) || 0;
        const faltas = Number(r?.faltas) || 0;
        const atrasos = Number(r?.atrasos) || 0;
        const justificadas = Number(r?.justificadas) || 0;
        const presentes = Math.max(0, total - faltas);
        const denom = Math.max(total, 1);
        return {
          date: normDateKey(r?.date || r?.data_referencia || r?.data),
          departamento:
            r?.departamento ||
            r?.depto ||
            r?.depto_desc ||
            r?.departamentoNome ||
            r?.["departamento.nome"] ||
            "",
          depto:
            r?.depto ||
            r?.departamento ||
            r?.depto_desc ||
            r?.departamentoNome ||
            r?.["departamento.nome"] ||
            "",
          depto_desc:
            r?.depto_desc ||
            r?.departamento ||
            r?.depto ||
            r?.departamentoNome ||
            r?.["departamento.nome"] ||
            "",
          departamentoNome:
            r?.departamentoNome ||
            r?.departamento ||
            r?.depto ||
            r?.depto_desc ||
            r?.["departamento.nome"] ||
            "",
          filial: r?.filial || r?.empresa || "",
          empresa: r?.empresa || r?.filial || "",
          cargo: r?.cargo || r?.cargo_desc || "",
          cargo_desc: r?.cargo_desc || r?.cargo || "",
          total,
          faltas,
          atrasos,
          justificadas,
          presentes,
          presentesPct: +((presentes / denom) * 100).toFixed(1),
          faltasPct: +((faltas / denom) * 100).toFixed(1),
          atrasosPct: +((atrasos / denom) * 100).toFixed(1),
          justificadasPct: +((justificadas / denom) * 100).toFixed(1),
          horas_presentes:
            r?.horas_presentes != null
              ? capWorkedHours(r.horas_presentes, r.horas_planejadas)
              : null,
          horas_planejadas: r?.horas_planejadas != null ? Number(r.horas_planejadas) : null,
          horas_faltas: r?.horas_faltas != null ? Number(r.horas_faltas) : null,
          horas_atrasos: r?.horas_atrasos != null ? Number(r.horas_atrasos) : null,
          horas_justificadas: r?.horas_justificadas != null ? Number(r.horas_justificadas) : null,
          extras: r?.extras != null ? Number(r.extras) : null,
          horas_extras: r?.horas_extras != null ? Number(r.horas_extras) : null,
          _employees: r?._employees || null,
          _events: r?._events || null,
        };
      })
      .filter((r) => r.date);
    if (!rows.length) return [];
    return filterHistRowsByPeriod(rows, { faltDays, histDateFrom, histDateTo, periodoApuracao });
  }, [histDeptData, histData, faltDays, histDateFrom, histDateTo, periodoApuracao]);
  const empList = useMemo(() => {
    const map = new Map();
    for (const row of histRows || []) {
      for (const emp of row._employees || []) {
        if (emp.mat && !map.has(emp.mat)) map.set(emp.mat, emp.nome || emp.mat);
      }
    }
    return [...map.entries()].sort((a, b) => a[1].localeCompare(b[1]));
  }, [histRows]);
  const histRadar = useMemo(
    () => buildHistRadarSummary(histRows, { fmt, fmtHM, fmtShortDate }),
    [histRows],
  );
  const absCardTooltip = useMemo(
    () =>
      buildAbsIndexTooltip({
        horasAbs: histRadar.horasAbs,
        horasPlan: histRadar.horasPlan,
        absPct: histRadar.absPct,
      }),
    [histRadar.horasAbs, histRadar.horasPlan, histRadar.absPct],
  );
  const histPeriodLabel = useMemo(() => {
    const rows = Array.isArray(histRows) ? histRows : [];
    if (!rows.length) return "";
    if (histDateFrom || histDateTo) {
      return `${fmtShortDate(histDateFrom || rows[0]?.date)} – ${fmtShortDate(histDateTo || rows[rows.length - 1]?.date)}`;
    }
    if (faltDays === PB_FALT_DAYS_ATUAL && periodoApuracao.de && periodoApuracao.ate) {
      return `Período atual (${fmtDateBr(periodoApuracao.de)} – ${fmtDateBr(periodoApuracao.ate)})`;
    }
    return `Últimos ${faltDays} dias`;
  }, [histRows, histDateFrom, histDateTo, faltDays, periodoApuracao]);

  const absBaseInfo = useMemo(() => {
    const rows = [...(Array.isArray(histRows) ? histRows : [])].sort((a, b) =>
      (a?.date || "").localeCompare(b?.date || ""),
    );
    const eventCount = rows.reduce(
      (sum, row) => sum + (Array.isArray(row?._events) ? row._events.length : 0),
      0,
    );
    const from = histDateFrom || rows[0]?.date || periodoApuracao.de || "";
    const to = histDateTo || rows[rows.length - 1]?.date || periodoApuracao.ate || "";
    return {
      source: CONFIG.ABSENTEISMO_API ? "API" : "local",
      formulaId: ABSENTEISMO_FORMULA_ID,
      formulaLabel: ABSENTEISMO_FORMULA_LABEL,
      days: rows.length,
      records: eventCount || rows.length,
      from,
      to,
    };
  }, [histRows, histDateFrom, histDateTo, periodoApuracao]);

  const absCalcWarnings = useMemo(() => {
    const warnings = [];
    if (!absBaseInfo.days) warnings.push("Sem dias carregados para o período selecionado.");
    if ((Number(histRadar.horasPlan) || 0) <= 0)
      warnings.push("Horas planejadas zeradas: o índice não pode ser auditado com segurança.");
    if ((Number(histRadar.absPct) || 0) > 100)
      warnings.push("Índice acima de 100%: revise categorias de horas, importação e período.");
    if (
      (Number(histRadar.horasAbs) || 0) > (Number(histRadar.horasPlan) || 0) &&
      histRadar.horasPlan > 0
    )
      warnings.push("Horas ausentes maiores que planejadas no período.");
    return warnings;
  }, [absBaseInfo.days, histRadar.horasAbs, histRadar.horasPlan, histRadar.absPct]);

  const openSaudePreventivaView = useCallback(() => {
    const opened = openSaudePreventivaInNewTab({
      periodoLabel: histPeriodLabel,
      empresaLabel: resolveEmpresaLabel(histRows, filialValue),
      histRows,
    });
    if (!opened) {
      Toast.show("Permita pop-ups para abrir o módulo em nova guia.", "w", 4000);
    }
  }, [histPeriodLabel, histRows, filialValue]);

  const openNr1View = useCallback(() => {
    const opened = openNr1InNewTab({
      empresaLabel: resolveEmpresaLabel(histRows, filialValue),
      histRows,
    });
    if (!opened) {
      Toast.show("Permita pop-ups para abrir o módulo NR-1 em nova guia.", "w", 4000);
    }
  }, [histRows, filialValue]);

  const dashboardNlContext = useMemo(
    () =>
      buildDashboardNlContext({
        histRows,
        histRadar,
        periodLabel: histPeriodLabel,
        surface: "absenteismo",
        bancoHoras: bancoHorasStats,
        abonosStored: loadKpiAbonos(),
      }),
    [histRows, histRadar, histPeriodLabel, bancoHorasStats],
  );


  const resolveNlDeptoFilter = useCallback(
    (value) => {
      const val = String(value || "").trim();
      if (!val) return "";
      const opts = Array.isArray(deptoOptions) ? deptoOptions : [];
      const exact = opts.find((d) => d === val);
      if (exact) return exact;
      const low = val.toLowerCase();
      return (
        opts.find(
          (d) =>
            d.toLowerCase() === low ||
            d.toLowerCase().includes(low) ||
            low.includes(d.toLowerCase()),
        ) || val
      );
    },
    [deptoOptions],
  );

  const applyNlDashboardFilter = useCallback(
    (action, answer) => {
      const f = action?.filter;
      if (!f?.value) return false;
      const field = String(f.field || "").toLowerCase();
      const raw = String(f.value).trim();
      if (field === "departamento" || field === "depto") {
        const resolved = resolveNlDeptoFilter(raw);
        onDeptoChange?.(resolved);
        setNlAppliedFilter({
          field,
          label: f.label || "Departamento",
          value: resolved,
          question: answer?.question || answer?.title || "",
        });
        Toast.show(`Filtro aplicado: departamento «${resolved}»`, "i", 2800);
        return true;
      }
      if (field === "colaborador") {
        setSelectedEmp(raw);
        setNlAppliedFilter({
          field,
          label: f.label || "Colaborador",
          value: raw,
          question: answer?.question || answer?.title || "",
        });
        Toast.show(`Filtro aplicado: colaborador «${raw}»`, "i", 2800);
        return true;
      }
      if (field === "evento") {
        setNlAppliedFilter({
          field,
          label: f.label || "Evento",
          value: raw,
          question: answer?.question || answer?.title || "",
        });
        Toast.show(`Filtro aplicado: evento «${raw}»`, "i", 2800);
        return true;
      }
      return false;
    },
    [onDeptoChange, resolveNlDeptoFilter],
  );

  const handleDashboardNlAction = useCallback(
    (action, answer) => {
      if (!action?.type) return;
      switch (action.type) {
        case "open_hist_events":
        case "open_hist_table":
          applyNlDashboardFilter(action, answer);
          openHistTableInline({
            clearHighlight: true,
            tableViewRequest: {
              view: "date",
              ts: Date.now(),
              search: action?.filter?.value || "",
              filterField: action?.filter?.field || "",
            },
          });
          window.requestAnimationFrame(() => {
            document
              .querySelector(".pb-unified-chart")
              ?.scrollIntoView?.({ behavior: "smooth", block: "nearest" });
          });
          break;
        case "open_chart_day":
          if (action.date) openChartDayModal(action.date);
          break;
        case "open_consec_faltas":
          applyNlDashboardFilter(action, answer);
          setConsecFaltasOpen(true);
          break;
        case "open_config_horas":
          setCfgOpen(true);
          break;
        case "open_radar":
          applyNlDashboardFilter(action, answer);
          openRadarWorkspace();
          break;
        case "open_radar_heatmap":
          applyNlDashboardFilter(action, answer);
          openRadarWorkspace();
          window.setTimeout(() => {
            window.dispatchEvent(
              new CustomEvent("pb-radar-go-page", {
                detail: { page: "heatmap", filter: action.filter, period: action.period },
              }),
            );
          }, 150);
          break;
        case "open_radar_eventos":
        case "open_radar_passivo":
          openRadarWorkspace();
          if (action.type === "open_radar_eventos") {
            window.setTimeout(() => {
              window.dispatchEvent(
                new CustomEvent("pb-radar-go-page", { detail: { page: "eventos" } }),
              );
            }, 150);
          } else if (action.type === "open_radar_passivo") {
            window.setTimeout(() => {
              window.dispatchEvent(
                new CustomEvent("pb-radar-go-page", { detail: { page: "passivo" } }),
              );
            }, 150);
          }
          break;
        case "focus_abs_card":
        case "open_abs_chart":
          openAbsChartView();
          break;
        case "open_abs_home":
          openAbsHomeView();
          break;
        case "open_saude_preventiva":
          openSaudePreventivaView();
          break;
        case "open_banco_horas":
        case "open_abonos":
          window.requestAnimationFrame(() => {
            const sel = action.type === "open_banco_horas" ? ".pb-banco-horas" : ".pb-abonos";
            document.querySelector(sel)?.scrollIntoView?.({ behavior: "smooth", block: "nearest" });
          });
          break;
        default:
          break;
      }
    },
    [
      applyNlDashboardFilter,
      openHistTableInline,
      openChartDayModal,
      openRadarWorkspace,
      openAbsChartView,
      openAbsHomeView,
      openSaudePreventivaView,
    ],
  );

  const histPeriodShortLabel = useMemo(() => {
    const rows = Array.isArray(histRows) ? histRows : [];
    if (!rows.length) return "Sem período";
    if (histDateFrom || histDateTo) {
      return `${fmtShortDate(histDateFrom || rows[0]?.date)}-${fmtShortDate(histDateTo || rows[rows.length - 1]?.date)}`;
    }
    if (faltDays === PB_FALT_DAYS_ATUAL && periodoApuracao.de && periodoApuracao.ate) {
      return "Período atual";
    }
    return `${rows.length} dias`;
  }, [histRows, histDateFrom, histDateTo, faltDays, periodoApuracao]);
  const histHasHours = useMemo(
    () =>
      (Array.isArray(histRows) ? histRows : []).some(
        (r) =>
          r.horas_planejadas != null ||
          r.horas_faltas != null ||
          r.horas_atrasos != null ||
          r.horas_justificadas != null ||
          r.horas_extras != null,
      ),
    [histRows],
  );
  const histTableInline = histDetailOpen && bentoView === "table" && !histIsFloating;
  const histTableOpen = histTableInline || histIsFloating;
  const showHistChart = histDetailOpen && bentoView === "chart" && !histIsFloating;
  const showRadarHome = !histDetailOpen || histIsFloating;
  const [kpiEvolOpen, setKpiEvolOpen] = useState(null);
  const [absCalcOpen, setAbsCalcOpen] = useState(false);
  const [calcOpen, setCalcOpen] = useState(false);
  const toggleFullscreen = async () => {
    try {
      if (document.fullscreenElement) await document.exitFullscreen();
      else await rootRef.current?.requestFullscreen?.();
    } catch {
      // ignore (e.g. blocked by browser permissions)
    }
  };

  // ===== Presen?a/Aus?ncias por departamento (mini lista) =====
  const [deptMiniMode, setDeptMiniMode] = useState(() => {
    try {
      const v = localStorage.getItem("pb_dept_mini_mode") || "";
      return v === "pres" ? "pres" : "abs";
    } catch {
      return "abs";
    }
  });
  const [deptMiniOrder, setDeptMiniOrder] = useState(() => {
    try {
      const v = localStorage.getItem("pb_dept_mini_order") || "";
      return v === "asc" ? "asc" : "desc";
    } catch {
      return "desc";
    }
  });
  const didInitDeptMiniMode = useRef(false);
  const didInitDeptMiniOrder = useRef(false);
  useEffect(() => {
    if (!didInitDeptMiniMode.current) {
      didInitDeptMiniMode.current = true;
      return;
    }
    try {
      localStorage.setItem("pb_dept_mini_mode", deptMiniMode);
    } catch {}
  }, [deptMiniMode]);
  useEffect(() => {
    if (!didInitDeptMiniOrder.current) {
      didInitDeptMiniOrder.current = true;
      return;
    }
    try {
      localStorage.setItem("pb_dept_mini_order", deptMiniOrder);
    } catch {}
  }, [deptMiniOrder]);

  const deptMiniRows = useMemo(() => {
    const day = filteredDia || dia;
    const mode = deptMiniMode === "pres" ? "presentes" : "ausentes";
    const base = buildDeptTopList(day, mode, 10);
    if (!base.length) return [];
    base.sort((a, b) => (deptMiniOrder === "asc" ? a.v - b.v : b.v - a.v));
    return base;
  }, [filteredDia, dia, deptMiniMode, deptMiniOrder]);

  // ===== Apontamentos =====
  const [aptFrom, setAptFrom] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() - 29);
    return d.toISOString().slice(0, 10);
  });
  const [aptTo, setAptTo] = useState(() => new Date().toISOString().slice(0, 10));
  const filteredApt = useMemo(() => {
    if (!histData || !histData.length) return [];
    return histData
      .filter((r) => r.date >= aptFrom && r.date <= aptTo)
      .map((r) => ({ ...r, presentes: Math.max(0, (r.total || 0) - (r.faltas || 0)) }));
  }, [histData, aptFrom, aptTo]);

  // ===== KPIs (Rotatividade) =====
  const [turnover, setTurnover] = useState(() => loadKpiTurnover());
  const [cfgTurnoverMeta, setCfgTurnoverMeta] = useState(() => String(loadTurnoverMeta()));
  const [turnFrom, setTurnFrom] = useState(() => {
    const saved = loadTurnoverPeriod();
    if (saved?.from) return saved.from;
    const months = loadKpiTurnover()?.months || [];
    const has2026 = months.some((m) => String(m || "").endsWith("/2026"));
    if (has2026) return "2026-01";
    const min = months.length ? months[months.length - 1] : "";
    return mmYyyyToYm(min) || "2026-01";
  });
  const [turnTo, setTurnTo] = useState(() => {
    const saved = loadTurnoverPeriod();
    if (saved?.to) return saved.to;
    const months = loadKpiTurnover()?.months || [];
    const has2026 = months.some((m) => String(m || "").endsWith("/2026"));
    if (has2026) return "2026-12";
    const max = months.length ? months[0] : "";
    return mmYyyyToYm(max) || "2026-12";
  });
  const setConsistentTurnFrom = useCallback(
    (next) => {
      const value = String(next || "");
      setTurnFrom(value);
      if (value && turnTo && value > turnTo) setTurnTo(value);
    },
    [turnTo],
  );
  const setConsistentTurnTo = useCallback(
    (next) => {
      const value = String(next || "");
      setTurnTo(value);
      if (value && turnFrom && turnFrom > value) setTurnFrom(value);
    },
    [turnFrom],
  );

  useEffect(() => {
    saveTurnoverPeriod({ from: turnFrom, to: turnTo });
  }, [turnFrom, turnTo]);

  const importTurnoverCsv = async (file) => {
    if (!file) return;
    try {
      const buf = await file.arrayBuffer();
      const name = String(file.name || "").toLowerCase();
      let parsed = null;
      if (name.endsWith(".xlsx") || name.endsWith(".xls")) {
        const xlsxMod = await import("xlsx-js-style");
        const XLSX = xlsxMod.default || xlsxMod;
        const wb = XLSX.read(buf, { type: "array", cellDates: true });
        const ws = wb.Sheets[wb.SheetNames[0]];
        const aoa = XLSX.utils.sheet_to_json(ws, { header: 1, defval: null, blankrows: false });
        parsed = parseTurnoverAoa(aoa);
      } else {
        const text = new TextDecoder("utf-8").decode(buf);
        parsed = parseTurnoverCsv(text);
      }
      if (!parsed) {
        Toast.show("Colunas do Turnover não encontradas. Use meses MM/AAAA no cabeçalho.", "w", 7000);
        return;
      }
      setTurnover(parsed);
      saveKpiTurnover(parsed);
      setTurnFrom(mmYyyyToYm(parsed.months[parsed.months.length - 1]) || "");
      setTurnTo(mmYyyyToYm(parsed.months[0]) || "");
      Toast.show(
        `Turnover importado: ${parsed.months.length.toLocaleString("pt-BR")} mês${parsed.months.length !== 1 ? "es" : ""}`,
        "s",
        6000,
      );
    } catch (error) {
      console.error("[ImportTurnover]", error);
      Toast.show(error?.message || "Falha ao importar Turnover", "e", 8000);
    }
  };

  const turnoverView = useMemo(
    () => buildTurnoverView(turnover, { from: turnFrom, to: turnTo, meta: cfgTurnoverMeta }),
    [cfgTurnoverMeta, turnover, turnFrom, turnTo],
  );

  const [turnExportOpen, setTurnExportOpen] = useState(false);
  const turnExportRef = useRef(null);
  useEffect(() => {
    if (!turnExportOpen) return;
    const onDown = (e) => {
      const el = turnExportRef.current;
      if (!el) return;
      if (el.contains(e.target)) return;
      setTurnExportOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [turnExportOpen]);

  const exportTurnoverPdf = useCallback(() => {
    if (!turnoverView || !Array.isArray(turnoverView.months) || !Array.isArray(turnoverView.rows))
      return;
    const esc = (v) =>
      String(v ?? "")
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;");
    const head = ["Grupos", ...(turnoverView.months || [])]
      .map((h) => `<th>${esc(h)}</th>`)
      .join("");
    const fmtCell = (rowLabel, v) => {
      if (String(rowLabel || "").startsWith("%"))
        return v == null ? "?" : String(v).replace(".", ",");
      const n = Number(v);
      return Number.isFinite(n) ? String(n) : v == null ? "—" : esc(v);
    };
    const body = (turnoverView.rows || [])
      .map((r) => {
        const tds = [
          `<td style="font-weight:700">${esc(r.label)}</td>`,
          ...(r.values || []).map(
            (v) => `<td style="text-align:right">${esc(fmtCell(r.label, v))}</td>`,
          ),
        ].join("");
        return `<tr>${tds}</tr>`;
      })
      .join("");

    const w = window.open("", "_blank");
    if (!w) return;
    const title = `TURNOVER (${esc(turnFrom)}  ${esc(turnTo)})`;
    w.document.write(`<!doctype html><html><head><meta charset="utf-8"/><title>${title}</title>
<style>
  body{font-family:Arial,Helvetica,sans-serif;padding:24px;color:#111}
  h1{font-size:14px;letter-spacing:.12em;text-transform:uppercase;margin:0 0 12px 0}
  table{border-collapse:collapse;width:100%}
  th,td{border:1px solid #ddd;padding:6px 8px;font-size:11px}
  th{background:#f6f7f9;text-align:left}
</style></head><body>
<h1>${title}</h1>
<table><thead><tr>${head}</tr></thead><tbody>${body}</tbody></table>
</body></html>`);
    w.document.close();
    w.focus();
    setTimeout(() => {
      try {
        w.print();
      } catch {}
    }, 250);
  }, [turnoverView, turnFrom, turnTo]);

  const exportTurnoverExcel = useCallback(async () => {
    if (!turnoverView || !Array.isArray(turnoverView.months) || !Array.isArray(turnoverView.rows))
      return;

    const xlsxMod = await import("xlsx-js-style");
    const XLSX = xlsxMod.default || xlsxMod;

    const aoa = [
      ["Grupos", ...(turnoverView.months || [])],
      ...(turnoverView.rows || []).map((r) => [
        r.label,
        ...(r.values || []).map((v) => (v == null ? "" : v)),
      ]),
    ];
    const ws = XLSX.utils.aoa_to_sheet(aoa);

    // Premium-ish formatting
    const range = XLSX.utils.decode_range(ws["!ref"] || "A1:A1");
    const headerStyle = {
      font: { bold: true, color: { rgb: "FFFFFF" }, sz: 11 },
      fill: { patternType: "solid", fgColor: { rgb: "111827" } },
      alignment: { vertical: "center", horizontal: "center", wrapText: true },
      border: {
        top: { style: "thin", color: { rgb: "374151" } },
        bottom: { style: "thin", color: { rgb: "374151" } },
        left: { style: "thin", color: { rgb: "374151" } },
        right: { style: "thin", color: { rgb: "374151" } },
      },
    };
    const firstColStyle = {
      font: { bold: true, color: { rgb: "111827" }, sz: 11 },
      fill: { patternType: "solid", fgColor: { rgb: "F3F4F6" } },
      alignment: { vertical: "center", horizontal: "left", wrapText: true },
      border: {
        top: { style: "thin", color: { rgb: "E5E7EB" } },
        bottom: { style: "thin", color: { rgb: "E5E7EB" } },
        left: { style: "thin", color: { rgb: "E5E7EB" } },
        right: { style: "thin", color: { rgb: "E5E7EB" } },
      },
    };
    const cellStyle = {
      font: { color: { rgb: "111827" }, sz: 11 },
      alignment: { vertical: "center", horizontal: "right" },
      border: {
        top: { style: "thin", color: { rgb: "E5E7EB" } },
        bottom: { style: "thin", color: { rgb: "E5E7EB" } },
        left: { style: "thin", color: { rgb: "E5E7EB" } },
        right: { style: "thin", color: { rgb: "E5E7EB" } },
      },
    };
    for (let c = range.s.c; c <= range.e.c; c++) {
      const addr = XLSX.utils.encode_cell({ r: 0, c });
      if (ws[addr]) ws[addr].s = headerStyle;
    }
    for (let r = 1; r <= range.e.r; r++) {
      for (let c = range.s.c; c <= range.e.c; c++) {
        const addr = XLSX.utils.encode_cell({ r, c });
        if (!ws[addr]) continue;
        ws[addr].s = c === 0 ? firstColStyle : cellStyle;
      }
    }
    ws["!cols"] = Array.from({ length: range.e.c - range.s.c + 1 }).map((_, i) => ({
      wch: i === 0 ? 26 : 14,
    }));
    ws["!rows"] = Array.from({ length: range.e.r - range.s.r + 1 }).map(() => ({ hpt: 18 }));

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Turnover");
    const file = `turnover_${String(turnFrom || "").replace("-", "")}_${String(turnTo || "").replace("-", "")}.xlsx`;
    try {
      if (typeof XLSX.writeFile === "function") {
        XLSX.writeFile(wb, file);
        return;
      }
    } catch (e) {
      console.error("Falha ao exportar XLSX (writeFile). Tentando fallback Blob...", e);
    }

    try {
      const out = XLSX.write(wb, { bookType: "xlsx", type: "array" });
      const blob = new Blob([out], {
        type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = file;
      a.click();
      setTimeout(() => URL.revokeObjectURL(url), 1500);
    } catch (e) {
      console.error("Falha ao exportar XLSX (Blob fallback).", e);
    }
  }, [turnoverView, turnFrom, turnTo]);

  const handleTurnoverExport = useCallback(
    async (kind) => {
      try {
        if (kind === "pdf") exportTurnoverPdf();
        if (kind === "xlsx") await exportTurnoverExcel();
      } catch (e) {
        console.error("Falha ao exportar Turnover:", e);
      } finally {
        // garante que nada fique aberto/travando clique nos inputs
        setTurnExportOpen(false);
      }
    },
    [exportTurnoverExcel, exportTurnoverPdf],
  );

  const unifiedBadge = useMemo(() => {
    if (histRows.length < 2) return { badge: "flat", text: "estavel" };
    const today = histRows[histRows.length - 1].presentesPct;
    const prevAvg =
      histRows.slice(0, -1).reduce((s, r) => s + r.presentesPct, 0) /
      Math.max(histRows.length - 1, 1);
    if (today > prevAvg * 1.02) return { badge: "up", text: "presenca subindo" };
    if (today < prevAvg * 0.98) return { badge: "down", text: "presenca caindo" };
    return { badge: "flat", text: "estavel" };
  }, [histRows]);

  // ===== Configura?es =====
  const [cfgTab, setCfgTab] = useState("metas");
  const [absMeta, setAbsMeta] = useState(() => loadAbsenteismoMeta());
  const [cfgAbsMeta, setCfgAbsMeta] = useState(() => String(loadAbsenteismoMeta()));

  const openCfg = useCallback(
    (tab = "metas") => {
      const fallbackTab = canEditMetas ? "metas" : "horas";
      const allowed =
        (tab === "importacoes" && canUseImportacoes) ||
        (tab === "metas" && canEditMetas) ||
        (tab === "horas" && canEditHoras);

      if (!allowed && !canUseConfig) return;
      setCfgTab(allowed ? tab : fallbackTab);
      setCfgOpen(true);
    },
    [canEditHoras, canEditMetas, canUseConfig, canUseImportacoes],
  );

  const commitAbsMeta = useCallback(() => {
    const saved = saveAbsenteismoMeta(cfgAbsMeta);
    setAbsMeta(saved);
    setCfgAbsMeta(String(saved));
    return saved;
  }, [cfgAbsMeta]);

  const commitTurnoverMeta = useCallback(() => {
    const saved = saveTurnoverMeta(cfgTurnoverMeta);
    setCfgTurnoverMeta(String(saved));
    return saved;
  }, [cfgTurnoverMeta]);

  const closeCfg = useCallback(() => {
    commitAbsMeta();
    commitTurnoverMeta();
    setCfgOpen(false);
  }, [commitAbsMeta, commitTurnoverMeta]);

  useEffect(() => {
    if (cfgOpen) {
      setCfgAbsMeta(String(absMeta));
      setCfgTurnoverMeta(String(loadTurnoverMeta()));
    }
  }, [cfgOpen, absMeta]);

  useEffect(() => {
    const onMetaChange = (e) => setAbsMeta(e.detail || loadAbsenteismoMeta());
    window.addEventListener("pb-abs-meta-changed", onMetaChange);
    return () => window.removeEventListener("pb-abs-meta-changed", onMetaChange);
  }, []);
  const cfgFileRef = useRef(null);
  const cfgEventosFileRef = useRef(null);
  const [eventosBusy, setEventosBusy] = useState(false);

  const cfgTabelaFileRef = useRef(null);
  const cfgBancoHorasFileRef = useRef(null);
  const cfgMensalFileRef = useRef(null);
  const cfgBackupFileRef = useRef(null);
  const [tabelaBusy, setTabelaBusy] = useState(false);
  const [bancoHorasBusy, setBancoHorasBusy] = useState(false);
  const [mensalBusy, setMensalBusy] = useState(false);
  const [backupBusy, setBackupBusy] = useState(false);
  useEffect(() => {
    const onBancoHorasUpdate = () => setStoredBancoHoras(loadKpiBancoHoras());
    const onMensalUpdate = () => setStoredMensal(loadKpiMensal());
    const onTurnoverUpdate = () => setTurnover(loadKpiTurnover());
    window.addEventListener("pos:banco-horas-updated", onBancoHorasUpdate);
    window.addEventListener("pos:mensal-updated", onMensalUpdate);
    window.addEventListener("pos:turnover-updated", onTurnoverUpdate);
    return () => {
      window.removeEventListener("pos:banco-horas-updated", onBancoHorasUpdate);
      window.removeEventListener("pos:mensal-updated", onMensalUpdate);
      window.removeEventListener("pos:turnover-updated", onTurnoverUpdate);
    };
  }, []);

  useEffect(() => {
    const onRadarCct = () => openRadarToCct();
    window.addEventListener("pb-open-radar-cct", onRadarCct);
    return () => window.removeEventListener("pb-open-radar-cct", onRadarCct);
  }, [openRadarToCct]);

  const parseBancoHorasFromWorkbook = useCallback((wb, XLSX, fileName = "") => {
    if (!wb || !XLSX) return { parsed: null, diagnosis: null };
    let lastDiagnosis = null;
    for (const sheetName of wb.SheetNames || []) {
      const ws = wb.Sheets?.[sheetName];
      if (!ws) continue;
      const aoa = readWorksheetAoa(ws, XLSX);
      const diagnosis = diagnoseBancoHorasSheet(aoa);
      lastDiagnosis = { ...diagnosis, sheetName };
      const parsed = parseBancoHorasSheet(aoa, { fileName, sheetName, diagnosis });
      if (parsed) return { parsed, diagnosis: lastDiagnosis };
    }
    return { parsed: null, diagnosis: lastDiagnosis };
  }, []);

  const handleImportTabela = useCallback(
    async (file) => {
      if (!file) return;
      setTabelaBusy(true);
      try {
        const buf = await file.arrayBuffer();
        const xlsxMod = await import("xlsx-js-style");
        const XLSX = xlsxMod.default || xlsxMod;
        const isCsv = /\.csv$/i.test(String(file.name || ""));
        const wb = isCsv
          ? XLSX.read(new TextDecoder("utf-8").decode(buf), { type: "string", raw: true })
          : XLSX.read(buf, { type: "array", cellDates: true });
        const { parsed: bancoHorasParsed, diagnosis: bancoHorasDiagnosis } =
          parseBancoHorasFromWorkbook(wb, XLSX, file.name);
        if (bancoHorasParsed) {
          saveKpiBancoHoras(bancoHorasParsed);
          setStoredBancoHoras(bancoHorasParsed);
        }
        const rows = parseXlsxToHistTabela(wb, XLSX);
        if (!bancoHorasParsed && Array.isArray(rows) && rows.length) {
          const synthesizedRows = buildBancoHorasRowsFromHistEvents(rows);
          if (synthesizedRows.length) {
            const packed = packBancoHorasStorage(synthesizedRows, {
              fileName: file.name,
              diagnosis: { ok: true, source: "hist_tabela", rowCount: synthesizedRows.length },
            });
            saveKpiBancoHoras(packed);
            setStoredBancoHoras(packed);
          }
        }
        if (rows === null) {
          const storedAfter = loadKpiBancoHoras();
          if (bancoHorasParsed || Number(storedAfter?.count || 0) > 0) {
            const bh = bancoHorasParsed || storedAfter;
            Toast.show(formatBancoHorasImportSummary(bh), "s", 9000);
            setCfgOpen(false);
            return;
          }
          const bhHint = formatBancoHorasDiagnosis(bancoHorasDiagnosis);
          Toast.show(
            bhHint
              ? `Planilha não reconhecida como tabela nem Banco de Horas. ${bhHint}`
              : "Colunas necessárias não encontradas: use Data + Evento/Horas/Marcação/Horário ou layout Folha BH (Saldo Anterior, Crédito, Débito, Saldo Próximo).",
            "w",
            9000,
          );
          return;
        }
        if (!rows.length) {
          Toast.show("Nenhuma linha reconhecida — verifique as categorias de eventos", "w", 4000);
          return;
        }

        // Coleta todos os nomes de evento ?nicos e faz merge autom?tico nas Categorias de Horas
        const allEventNames = new Set();
        rows.forEach((r) => {
          (r._events || []).forEach((ev) => {
            const n = (ev.evento || ev.cod || "").trim();
            if (n) allEventNames.add(n);
          });
        });
        const { added, ignored } = mergeNewEvents([...allEventNames]);

        onImportTabela?.(rows);
        setCfgOpen(false);

        const st = rows._importStats || {};
        const imported = st.importedRows ?? rows._rawRowCount ?? 0;
        const events = st.eventCount ?? 0;
        const sheetRows = st.sheetRows ?? 0;
        const skipped = st.skippedNoDate ?? 0;
        let msg = `${imported.toLocaleString("pt-BR")} linha${imported !== 1 ? "s" : ""} · ${events.toLocaleString("pt-BR")} evento${events !== 1 ? "s" : ""} · ${rows.length} dia${rows.length !== 1 ? "s" : ""}`;
        if (sheetRows > 0 && imported < sheetRows * 0.95) {
          msg += ` (${skipped.toLocaleString("pt-BR")} sem data válida — confira coluna apontamento.data)`;
        }
        const bhStored = loadKpiBancoHoras();
        const bhFinal = bancoHorasParsed || (Number(bhStored?.count || 0) > 0 ? bhStored : null);
        if (bhFinal?.count > 0) {
          msg += ` · ${formatBancoHorasImportSummary(bhFinal).replace(/^Banco de Horas importado[^:]*:\s*/, "BH: ")}`;
        }
        if (ignored > 0) {
          Toast.show(
            `${msg}. ${ignored} tipo${ignored !== 1 ? "s" : ""} de evento novo${ignored !== 1 ? "s" : ""} — configure em Configurações → Categorias de horas`,
            imported < sheetRows * 0.9 ? "w" : "s",
            9000,
          );
        } else {
          Toast.show(
            `${msg}${added > 0 ? ` · ${added} evento${added !== 1 ? "s" : ""} novo${added !== 1 ? "s" : ""}` : ""}`,
            imported < sheetRows * 0.9 ? "w" : "s",
            8000,
          );
        }
      } catch (e) {
        console.error("[ImportTabela]", e);
        Toast.show("Falha ao ler a planilha/CSV", "e");
      } finally {
        setTabelaBusy(false);
      }
    },
    [onImportTabela, parseBancoHorasFromWorkbook],
  );

  const handleImportBancoHoras = useCallback(
    async (file) => {
      if (!file) return;
      setBancoHorasBusy(true);
      try {
        const buf = await file.arrayBuffer();
        const xlsxMod = await import("xlsx-js-style");
        const XLSX = xlsxMod.default || xlsxMod;
        const wb = XLSX.read(buf, { type: "array", cellDates: true });
        const { parsed, diagnosis } = parseBancoHorasFromWorkbook(wb, XLSX, file.name);
        if (!parsed) {
          const hint = formatBancoHorasDiagnosis(diagnosis);
          console.warn("[ImportBancoHoras] diagnóstico", diagnosis);
          Toast.show(
            hint
              ? `Banco de Horas não importado. ${hint}`
              : "Colunas de Banco de Horas não encontradas: Saldo Anterior, Crédito, Débito e Saldo Próximo.",
            "w",
            10000,
          );
          return;
        }
        saveKpiBancoHoras(parsed);
        setStoredBancoHoras(parsed);
        Toast.show(formatBancoHorasImportSummary(parsed), "s", 9000);
      } catch (e) {
        console.error("[ImportBancoHoras]", e);
        Toast.show("Falha ao ler a planilha de Banco de Horas", "e");
      } finally {
        setBancoHorasBusy(false);
      }
    },
    [parseBancoHorasFromWorkbook],
  );

  const importAbonosWorkbook = useCallback(async (file, kind = ABONOS_KIND.pendentes) => {
    if (!file) return;
    setAbonosBusy(true);
    const isEfetuados = kind === ABONOS_KIND.efetuados;
    const label = isEfetuados ? "Abonos efetuados" : "Abonos pendentes";
    try {
      const buf = await file.arrayBuffer();
      const xlsxMod = await import("xlsx-js-style");
      const XLSX = xlsxMod.default || xlsxMod;
      const wb = XLSX.read(buf, { type: "array", cellDates: true });
      const { parsed, diagnosis } = parseAbonosFromWorkbook(wb, XLSX, file.name, kind);
      if (!parsed) {
        const hint = formatAbonosDiagnosis(diagnosis);
        console.warn("[ImportAbonos]", kind, diagnosis);
        Toast.show(
          hint
            ? `${label} não importados. ${hint}`
            : "Colunas obrigatórias não encontradas: Departamento, Matrícula, Nome e Data.",
          "w",
          10000,
        );
        return;
      }
      saveKpiAbonos(parsed);
      setStoredAbonos(parsed);
      Toast.show(formatAbonosImportSummary(parsed, kind), "s", 9000);
    } catch (e) {
      console.error("[ImportAbonos]", kind, e);
      Toast.show(`Falha ao ler a planilha de ${label}`, "e");
    } finally {
      setAbonosBusy(false);
    }
  }, []);

  const handleImportAbonos = useCallback(
    (file) => importAbonosWorkbook(file, ABONOS_KIND.pendentes),
    [importAbonosWorkbook],
  );

  const handleImportAbonosEfetuados = useCallback(
    (file) => importAbonosWorkbook(file, ABONOS_KIND.efetuados),
    [importAbonosWorkbook],
  );

  const handleImportMensal = useCallback(async (file) => {
    if (!file) return;
    setMensalBusy(true);
    try {
      const buf = await file.arrayBuffer();
      const xlsxMod = await import("xlsx-js-style");
      const XLSX = xlsxMod.default || xlsxMod;
      const wb = XLSX.read(buf, { type: "array", cellDates: true });
      const ws = wb.Sheets[wb.SheetNames[0]];
      const aoa = XLSX.utils.sheet_to_json(ws, { header: 1, defval: null, blankrows: false });
      const parsed = parseMensalSheet(aoa, { fileName: file.name });
      if (!parsed) {
        Toast.show(
          "Colunas do Mensal não encontradas: Evento, meses no formato MM/AAAA e Total",
          "w",
          6000,
        );
        return;
      }
      saveKpiMensal(parsed);
      setStoredMensal(parsed);
      Toast.show(
        `Mensal importado: ${parsed.eventCount.toLocaleString("pt-BR")} evento${parsed.eventCount !== 1 ? "s" : ""} · ${parsed.months.length.toLocaleString("pt-BR")} mês${parsed.months.length !== 1 ? "es" : ""}`,
        "s",
        6000,
      );
    } catch (e) {
      console.error("[ImportMensal]", e);
      Toast.show(e?.message || "Falha ao ler a planilha Mensal", "e", 8000);
    } finally {
      setMensalBusy(false);
    }
  }, []);

  const handleImportEventos = useCallback(
    async (file) => {
      if (!file) return;
      setEventosBusy(true);
      try {
        const buf = await file.arrayBuffer();
        const xlsxMod = await import("xlsx-js-style");
        const XLSX = xlsxMod.default || xlsxMod;
        const wb = XLSX.read(buf, { type: "array" });
        const ws = wb.Sheets[wb.SheetNames[0]];
        const aoa = XLSX.utils.sheet_to_json(ws, { header: 1, defval: null, blankrows: false });
        if (!aoa.length) return;

        const headers = (aoa[0] || []).map((h) =>
          String(h || "")
            .trim()
            .toLowerCase(),
        );
        const codigoCol = headers.findIndex((h) => h === "evento.codigo");
        const descCol = headers.findIndex((h) => h === "evento.descricao" || h === "evento");
        if (codigoCol === -1 && descCol === -1) {
          Toast.show('Colunas "evento.codigo" / "evento.descricao" não encontradas', "w", 4000);
          return;
        }

        const names = [
          ...new Set(
            aoa
              .slice(1)
              .map((row) =>
                buildEventKey(
                  codigoCol >= 0 ? row?.[codigoCol] : "",
                  descCol >= 0 ? row?.[descCol] : "",
                ),
              )
              .filter(Boolean),
          ),
        ];

        const added = mergeImportedEvents(names);
        if (added > 0) {
          Toast.show(
            `${added} evento${added !== 1 ? "s" : ""} importado${added !== 1 ? "s" : ""} — lista anterior substituída`,
            "s",
          );
          openCfg("horas");
        } else {
          Toast.show("Nenhum evento novo encontrado", "i");
        }
      } catch (e) {
        console.error("[ImportEventos]", e);
        Toast.show("Falha ao ler a planilha", "e");
      } finally {
        setEventosBusy(false);
      }
    },
    [openCfg],
  );

  // ===== For?a Prevista por Departamento =====
  const [fpdOpen, setFpdOpen] = useState(false);
  const [fpdMap, setFpdMap] = useState(() =>
    normalizeForcaPrevistaDeptoMap(forcaPrevistaDeptoMap || {}),
  );
  const [fpdQuery, setFpdQuery] = useState("");
  const [fpdOnlyEmpty, setFpdOnlyEmpty] = useState(false);
  const [fpdMoneyDraft, setFpdMoneyDraft] = useState({});
  const fpdMoneyKey = (depto, field) => `${depto}|${field}`;
  useEffect(() => {
    if (fpdOpen) {
      setFpdMap(normalizeForcaPrevistaDeptoMap(forcaPrevistaDeptoMap || {}));
      setFpdQuery("");
      setFpdOnlyEmpty(false);
      setFpdMoneyDraft({});
    }
  }, [fpdOpen, forcaPrevistaDeptoMap]);

  // Mapa de ativos por departamento (a partir de deptStats ? todas as categorias)
  const fpdAtivos = useMemo(() => {
    const m = {};
    (deptStats || []).forEach((r) => {
      const k = r?.depto;
      if (!k) return;
      // Total de colaboradores cadastrados no depto (todas as categorias do dia)
      const total = [
        "presentes",
        "falta",
        "atraso",
        "folga",
        "ferias",
        "afastados",
        "ja_saiu",
        "entrada_prev",
        "nao_controla",
      ].reduce((s, key) => s + (Number(r[key]) || 0), 0);
      if (total > 0) m[k] = total;
    });
    return m;
  }, [deptStats]);

  const fpdRows = useMemo(() => {
    const set = new Set(deptoOptions || []);
    Object.keys(fpdMap || {}).forEach((k) => set.add(k));
    Object.keys(fpdAtivos || {}).forEach((k) => set.add(k));
    let rows = Array.from(set).sort((a, b) => a.localeCompare(b, "pt-BR"));
    const q = (fpdQuery || "").toLowerCase().trim();
    if (q) rows = rows.filter((d) => d.toLowerCase().includes(q));
    if (fpdOnlyEmpty) rows = rows.filter((d) => !getForcaPrevistaQty(fpdMap?.[d]));
    return rows;
  }, [deptoOptions, fpdMap, fpdAtivos, fpdQuery, fpdOnlyEmpty]);

  const fpdTotal = useMemo(
    () =>
      Object.values(fpdMap || {}).reduce((s, entry) => s + (getForcaPrevistaQty(entry) || 0), 0),
    [fpdMap],
  );
  const fpdCadastrados = useMemo(
    () => Object.values(fpdMap || {}).filter((entry) => getForcaPrevistaQty(entry) > 0).length,
    [fpdMap],
  );
  const fpdTotalDeptos = useMemo(() => {
    const set = new Set(deptoOptions || []);
    Object.keys(fpdAtivos || {}).forEach((k) => set.add(k));
    return set.size;
  }, [deptoOptions, fpdAtivos]);

  const handleFpdChange = (depto, field, raw) => {
    setFpdMap((prev) => {
      const next = { ...(prev || {}) };
      const cur = { prevista: null, custoHora: null, custoHExtra: null, ...(next[depto] || {}) };
      if (field === "prevista") {
        const n = parseInt(String(raw).replace(/\D+/g, ""), 10);
        cur.prevista = Number.isFinite(n) && n > 0 ? n : null;
      } else if (field === "custoHora" || field === "custoHExtra") {
        const trimmed = String(raw ?? "").trim();
        cur[field] = trimmed === "" ? null : parseFpdMoney(trimmed);
      }
      const hasData = cur.prevista || cur.custoHora != null || cur.custoHExtra != null;
      if (hasData) next[depto] = cur;
      else delete next[depto];
      return next;
    });
  };
  const getFpdMoneyValue = (depto, field, stored) => {
    const key = fpdMoneyKey(depto, field);
    if (Object.prototype.hasOwnProperty.call(fpdMoneyDraft, key)) return fpdMoneyDraft[key];
    return formatFpdMoneyDisplay(stored);
  };
  const handleFpdMoneyChange = (depto, field, raw) => {
    setFpdMoneyDraft((prev) => ({ ...prev, [fpdMoneyKey(depto, field)]: raw }));
  };
  const commitFpdMoney = (depto, field) => {
    const key = fpdMoneyKey(depto, field);
    const raw = Object.prototype.hasOwnProperty.call(fpdMoneyDraft, key)
      ? fpdMoneyDraft[key]
      : formatFpdMoneyDisplay(fpdMap?.[depto]?.[field]);
    setFpdMoneyDraft((prev) => {
      const next = { ...prev };
      delete next[key];
      return next;
    });
    handleFpdChange(depto, field, raw ?? "");
  };
  const applyFpdDrafts = (base) => {
    const next = normalizeForcaPrevistaDeptoMap(base);
    Object.entries(fpdMoneyDraft).forEach(([key, raw]) => {
      const sep = key.lastIndexOf("|");
      if (sep <= 0) return;
      const depto = key.slice(0, sep);
      const field = key.slice(sep + 1);
      if (field !== "custoHora" && field !== "custoHExtra") return;
      const cur = { prevista: null, custoHora: null, custoHExtra: null, ...(next[depto] || {}) };
      const trimmed = String(raw ?? "").trim();
      cur[field] = trimmed === "" ? null : parseFpdMoney(trimmed);
      const hasData = cur.prevista || cur.custoHora != null || cur.custoHExtra != null;
      if (hasData) next[depto] = cur;
      else delete next[depto];
    });
    return next;
  };
  const handleFpdUseAtivos = (depto) => {
    const a = Number(fpdAtivos?.[depto]) || 0;
    if (a > 0)
      setFpdMap((prev) => ({
        ...(prev || {}),
        [depto]: { prevista: a, custoHora: null, custoHExtra: null, ...(prev?.[depto] || {}) },
      }));
  };
  const handleFpdFillAllAtivos = () => {
    setFpdMap((prev) => {
      const next = { ...(prev || {}) };
      Object.entries(fpdAtivos || {}).forEach(([k, v]) => {
        const n = Number(v) || 0;
        if (n > 0 && !getForcaPrevistaQty(next[k])) {
          next[k] = { prevista: n, custoHora: null, custoHExtra: null, ...(next[k] || {}) };
        }
      });
      return next;
    });
  };
  const handleFpdSave = () => {
    const merged = applyFpdDrafts(fpdMap);
    setFpdMap(merged);
    setFpdMoneyDraft({});
    onSaveForcaPrevistaDeptoMap &&
      onSaveForcaPrevistaDeptoMap(serializeForcaPrevistaDeptoMap(merged));
    setFpdOpen(false);
  };
  const handleFpdClearDepto = (depto) => {
    setFpdMap((prev) => {
      const next = { ...(prev || {}) };
      delete next[depto];
      return next;
    });
    setFpdMoneyDraft((prev) => {
      const next = { ...prev };
      Object.keys(next).forEach((k) => {
        if (k.startsWith(`${depto}|`)) delete next[k];
      });
      return next;
    });
  };
  const handleFpdClearAll = () => {
    setFpdMap({});
    setFpdMoneyDraft({});
  };

  return (
    <div
      className="pos-bento"
      data-pb-layout="v2"
      data-card-layout={dashboardLayout.mode === "custom" ? "user" : "default"}
      data-theme={theme}
      data-sidebar-collapsed={sidebarCollapsed ? "true" : "false"}
      ref={rootRef}
    >
      {layoutOpen &&
        typeof document !== "undefined" &&
        createPortal(
          <PbLayoutPreferencesModal
            theme={theme}
            layout={dashboardLayout}
            allowedIds={allowedLayoutIds}
            onChange={setDashboardLayout}
            onClose={() => setLayoutOpen(false)}
          />,
          document.body,
        )}

      {cfgOpen &&
        typeof document !== "undefined" &&
        createPortal(
          <Suspense fallback={<div className="pb-cfg-overlay" data-theme={theme} />}>
            <PbConfiguracoesModal
              theme={theme}
              initialTab={cfgTab}
              onClose={closeCfg}
              allowedTabs={{
                importacoes: canUseImportacoes,
                metas: canEditMetas,
                horas: canEditHoras,
              }}
              metasTabProps={{
                canEditMetas,
                absMeta: cfgAbsMeta,
                onAbsMetaChange: setCfgAbsMeta,
                onAbsMetaBlur: commitAbsMeta,
                turnoverMeta: cfgTurnoverMeta,
                onTurnoverMetaChange: setCfgTurnoverMeta,
                onTurnoverMetaBlur: commitTurnoverMeta,
              }}
              importTabProps={{
                periodoApuracao,
                onPeriodoApuracaoChange: setPeriodoApuracaoOverride,
                importBusy,
                onImportXlsx,
                cfgFileRef,
                eventosBusy,
                handleImportEventos,
                cfgEventosFileRef,
                tabelaBusy,
                handleImportTabela,
                tabelaImportCount,
                onClearTabelaImport,
                cfgTabelaFileRef,
                bancoHorasBusy,
                handleImportBancoHoras,
                storedBancoHoras,
                cfgBancoHorasFileRef,
                abonosBusy,
                handleImportAbonos,
                handleImportAbonosEfetuados,
                storedAbonos,
                cfgAbonosFileRef,
                cfgAbonosEfetuadosFileRef,
                mensalBusy,
                handleImportMensal,
                storedMensal,
                cfgMensalFileRef,
                backupBusy,
                setBackupBusy,
                onExportPosicaoBackup,
                onImportPosicaoBackup,
                cfgBackupFileRef,
                importOverrides,
                onClearImport,
                importTurnoverCsv,
                openRadarToCct,
                permissions: {
                  xlsx: can(PERMISSIONS.imports.xlsx),
                  eventos: can(PERMISSIONS.imports.eventos),
                  tabela: can(PERMISSIONS.imports.tabela),
                  bancoHoras: can(PERMISSIONS.imports.bancoHoras),
                  abonos: can(PERMISSIONS.imports.abonos),
                  mensal: can(PERMISSIONS.imports.mensal),
                  turnover: can(PERMISSIONS.imports.turnover),
                  backup: can(PERMISSIONS.imports.backup),
                  cct: can(PERMISSIONS.imports.cct),
                },
              }}
              horasTabProps={{
                sourceEventNames: currentTableEventNames,
              }}
            />
          </Suspense>,
          document.body,
        )}

      {fpdOpen &&
        typeof document !== "undefined" &&
        createPortal(
          <div
            className="pb-cfg-overlay"
            data-theme={theme}
            onMouseDown={(e) => {
              if (e.target === e.currentTarget) setFpdOpen(false);
            }}
          >
            <div
              className="pb-cfg-modal pb-fpd-modal"
              role="dialog"
              aria-label="Força Prevista por Departamento"
              onMouseDown={(e) => e.stopPropagation()}
            >
              <div className="pb-fpd-head">
                <div className="pb-fpd-head-l">
                  <span className="pb-fpd-icon">🎯</span>
                  <div>
                    <div className="pb-fpd-title">Força Prevista por Departamento</div>
                    <div className="pb-fpd-sub">
                      Defina o quadro ideal de cada departamento. Departamentos sem valor usam os
                      colaboradores ativos como referência.
                    </div>
                  </div>
                </div>
                <button
                  type="button"
                  className="pb-cfg-close"
                  onClick={() => setFpdOpen(false)}
                  aria-label="Fechar"
                >
                  ×
                </button>
              </div>

              <div className="pb-fpd-stats">
                <div className="pb-fpd-stat">
                  <span className="pb-fpd-stat-lbl">Cadastrados</span>
                  <span className="pb-fpd-stat-val">
                    {fpdCadastrados} / {fpdTotalDeptos}
                  </span>
                </div>
                <div className="pb-fpd-stat">
                  <span className="pb-fpd-stat-lbl">Total cadastrado</span>
                  <span className="pb-fpd-stat-val c-blue">{fmt(fpdTotal)}</span>
                </div>
                <div className="pb-fpd-stat">
                  <span className="pb-fpd-stat-lbl">Sem cadastro (estimado)</span>
                  <span className="pb-fpd-stat-val">
                    {Math.max(0, fpdTotalDeptos - fpdCadastrados)}
                  </span>
                </div>
              </div>

              <div className="pb-fpd-toolbar">
                <input
                  className="pb-cfg-input pb-fpd-search"
                  type="search"
                  placeholder="🔍 Buscar departamento..."
                  value={fpdQuery}
                  onChange={(e) => setFpdQuery(e.target.value)}
                />
                <label className="pb-fpd-toggle">
                  <input
                    type="checkbox"
                    checked={fpdOnlyEmpty}
                    onChange={(e) => setFpdOnlyEmpty(e.target.checked)}
                  />
                  <span>Somente sem cadastro</span>
                </label>
                <button
                  type="button"
                  className="pb-btn"
                  onClick={handleFpdFillAllAtivos}
                  title="Preencher os vazios usando os ativos"
                >
                  ⚡ Preencher vazios com ativos
                </button>
              </div>

              <div className="pb-fpd-list">
                <div className="pb-fpd-listhead">
                  <span>Departamento</span>
                  <span style={{ textAlign: "right" }}>Ativos</span>
                  <span style={{ textAlign: "right" }}>Prevista</span>
                  <span style={{ textAlign: "right" }}>Custo/h méd.</span>
                  <span style={{ textAlign: "right" }}>Custo HE méd.</span>
                  <span></span>
                </div>
                {fpdRows.length === 0 ? (
                  <div className="pb-fpd-empty">Nenhum departamento encontrado.</div>
                ) : (
                  fpdRows.map((depto) => {
                    const ativos = Number(fpdAtivos?.[depto]) || 0;
                    const entry = fpdMap?.[depto] || {};
                    const prevista = getForcaPrevistaQty(entry);
                    const has =
                      prevista > 0 || entry.custoHora != null || entry.custoHExtra != null;
                    return (
                      <div className={`pb-fpd-row${has ? " has" : ""}`} key={depto}>
                        <span className="pb-fpd-name" title={depto}>
                          {depto}
                        </span>
                        <span className="pb-fpd-ativos">{ativos > 0 ? fmt(ativos) : "—"}</span>
                        <input
                          className="pb-cfg-input pb-fpd-input"
                          type="number"
                          min="0"
                          inputMode="numeric"
                          placeholder={ativos > 0 ? String(ativos) : "—"}
                          title={ativos > 0 ? `Estimado: ${ativos} ativos no dia` : undefined}
                          value={prevista != null ? String(prevista) : ""}
                          onChange={(e) => handleFpdChange(depto, "prevista", e.target.value)}
                        />
                        <input
                          className="pb-cfg-input pb-fpd-input pb-fpd-input-money"
                          type="text"
                          inputMode="decimal"
                          placeholder="R$ 0,00"
                          value={getFpdMoneyValue(depto, "custoHora", entry.custoHora)}
                          onChange={(e) => handleFpdMoneyChange(depto, "custoHora", e.target.value)}
                          onBlur={() => commitFpdMoney(depto, "custoHora")}
                        />
                        <input
                          className="pb-cfg-input pb-fpd-input pb-fpd-input-money"
                          type="text"
                          inputMode="decimal"
                          placeholder="R$ 0,00"
                          value={getFpdMoneyValue(depto, "custoHExtra", entry.custoHExtra)}
                          onChange={(e) =>
                            handleFpdMoneyChange(depto, "custoHExtra", e.target.value)
                          }
                          onBlur={() => commitFpdMoney(depto, "custoHExtra")}
                        />
                        <div className="pb-fpd-actions">
                          <button
                            type="button"
                            className="pb-fpd-mini"
                            disabled={ativos <= 0}
                            title="Usar ativos"
                            onClick={() => handleFpdUseAtivos(depto)}
                          >
                            usar ativos
                          </button>
                          <button
                            type="button"
                            className="pb-fpd-mini pb-fpd-mini-x"
                            disabled={!has}
                            title="Limpar"
                            onClick={() => handleFpdClearDepto(depto)}
                          >
                            ×
                          </button>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>

              <div className="pb-fpd-foot">
                <button
                  type="button"
                  className="pb-fpd-action pb-fpd-action-ghost"
                  onClick={handleFpdClearAll}
                  title="Remover todos os valores cadastrados"
                >
                  <span className="pb-fpd-action-ico">🗑</span> Limpar tudo
                </button>
                <div style={{ flex: 1 }} />
                <button
                  type="button"
                  className="pb-fpd-action pb-fpd-action-cancel"
                  onClick={() => setFpdOpen(false)}
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  className="pb-fpd-action pb-fpd-action-save"
                  onClick={handleFpdSave}
                >
                  <span className="pb-fpd-action-ico">✓</span> Salvar alterações
                </button>
              </div>
            </div>
          </div>,
          document.body,
        )}
      <div className="pb-topbar">
        <SearchableSelect
          value={filialValue}
          options={filialOptions}
          placeholder="Todas as filiais"
          ariaLabel="Filtrar por filial"
          onChange={(v) => onFilialChange && onFilialChange(v)}
        />

        <SearchableSelect
          value={deptoValue}
          options={deptoOptions}
          placeholder="Todos os departamentos"
          ariaLabel="Filtrar por departamento"
          onChange={(v) => onDeptoChange && onDeptoChange(v)}
        />

        {empList.length > 0 && (
          <EmpFilter empList={empList} value={selectedEmp} onChange={setSelectedEmp} />
        )}

        <div
          className="pb-apuracao-info"
          title="Período de apuração retornado pela API"
          aria-label="Período de apuração"
        >
          <span className="pb-apuracao-label">Período de Apuração</span>
          <span className="pb-apuracao-dates">
            De: {periodoApuracao.de ? fmtDateBr(periodoApuracao.de) : "—"} até:{" "}
            {periodoApuracao.ate ? fmtDateBr(periodoApuracao.ate) : "—"}
          </span>
        </div>

        <button
          type="button"
          className="pb-btn pb-btn-clear-filters"
          onClick={handleClearFilters}
          disabled={!hasActiveFilters}
          title="Limpar filtros de filial, departamento, colaborador e período personalizado"
        >
          Limpar filtros
        </button>

        <div className="pb-topbar-sep" aria-hidden="true" />
        <button
          type="button"
          className="pb-btn pb-btn-theme"
          style={{ marginLeft: 0 }}
          onClick={onToggleTheme}
          aria-label={theme === "dark" ? "Mudar para tema claro" : "Mudar para tema escuro"}
          title={theme === "dark" ? "Tema claro" : "Tema escuro"}
        >
          <span className="pb-btn-ico" aria-hidden="true">
            {theme === "dark" ? "\u2600" : "\u263e"}
          </span>
          {theme === "dark" ? "Claro" : "Escuro"}
        </button>
        {canEditForcaPrevista && (
          <button
            type="button"
            className="pb-btn"
            onClick={() => setFpdOpen(true)}
            aria-label="Força Prevista por Departamento"
            title="Força Prevista por Departamento"
          >
            <span className="pb-btn-ico" aria-hidden="true">
              {"\u25c9"}
            </span>
            Força Prevista
          </button>
        )}
        <button
          type="button"
          className="pb-btn"
          onClick={() => setCalcOpen(true)}
          aria-label="Calculadora de Horas"
          title="Calculadora de Horas"
        >
          <span className="pb-btn-ico" aria-hidden="true">
            {"\u23f1"}
          </span>
          Calculadora
        </button>
        <button
          type="button"
          className="pb-btn"
          onClick={() => setLayoutOpen(true)}
          aria-label="Escolher painéis do dashboard"
          title="Escolher painéis e ordem do dashboard"
        >
          <span className="pb-btn-ico" aria-hidden="true">
            {"\u25a6"}
          </span>
          Painéis
        </button>
        {canUseConfig && (
          <button
            type="button"
            className="pb-btn"
            onClick={() => openCfg("metas")}
            aria-label="Abrir Configurações"
            title="Configurações — Metas e Categorias de horas"
          >
            <span className="pb-btn-ico" aria-hidden="true">
              ⚙
            </span>
            Configurações
          </button>
        )}
        <button
          type="button"
          className="pb-btn"
          onClick={toggleFullscreen}
          aria-label={isFullscreen ? "Sair da tela cheia" : "Expandir dashboard (tela cheia)"}
          title={isFullscreen ? "Restaurar" : "Expandir"}
        >
          <span className="pb-btn-ico" aria-hidden="true">
            {isFullscreen ? "\u2921" : "\u2922"}
          </span>
        </button>
      </div>

      {nlAppliedFilter && (
        <div className="pb-nl-filter-chip" role="status" aria-live="polite">
          <span className="pb-nl-filter-kicker">Filtro vindo da pergunta</span>
          <strong>
            {nlAppliedFilter.label}: {nlAppliedFilter.value}
          </strong>
          {nlAppliedFilter.question ? (
            <span className="pb-nl-filter-question" title={nlAppliedFilter.question}>
              {nlAppliedFilter.question}
            </span>
          ) : null}
          <button
            type="button"
            onClick={clearNlAppliedFilter}
            aria-label="Limpar filtro vindo da pergunta"
            title="Limpar filtro vindo da pergunta"
          >
            x
          </button>
        </div>
      )}

      <div className="pb-grid">
        {/* HERO — layout mock (sidebar-stack) */}
        {canShowPanel("posicao") && (
        <div className="pb-cell pb-hero pb-hero-mock" style={panelStyle("posicao")}>
          <div className="pb-sidebar-shell">
            <div className="pb-sidebar-toolbar">
              <button
                type="button"
                className="pb-sidebar-toggle"
                onClick={toggleSidebarCollapsed}
                aria-expanded={!sidebarCollapsed}
                aria-label={
                  sidebarCollapsed
                    ? "Expandir coluna Posição do dia agora"
                    : "Recolher coluna Posição do dia agora"
                }
                title={
                  sidebarCollapsed
                    ? "Expandir Posição do dia agora"
                    : "Recolher Posição do dia agora"
                }
              >
                {sidebarCollapsed ? "›" : "‹"}
              </button>
              <span className="pb-sidebar-toolbar-title">Posição do dia agora</span>
            </div>
            <div
              className={`pb-sidebar-stack${sidebarCollapsed ? " is-collapsed" : ""}`}
              aria-hidden={sidebarCollapsed}
            >
              <section
                className="pb-side-panel pb-side-panel-posicao"
                aria-label="Posição do dia agora"
              >
                <div className="pb-donut-row">
                  <div
                    className="pb-donut pb-donut-mock"
                    style={{ "--pb-pres-deg": `${presDeg}deg` }}
                    aria-hidden
                  >
                    <div className="pb-donut-core pb-donut-core-mock">
                      <span className="pb-donut-abs">
                        {fmt(m.presentes)}/{fmt(m.atual)}
                      </span>
                      <small>{presP}% presente</small>
                    </div>
                  </div>
                  <div className="pb-donut-meta">
                    {dataRefText ? (
                      <input
                        type="text"
                        className="pb-donut-date-input"
                        value={dateDraft}
                        onChange={(e) => {
                          const v = e.target.value || "";
                          setDateDraft(v);
                          const parsed = parseDateInput(v);
                          if (parsed) onDateChange?.(parsed);
                        }}
                        onFocus={(e) => e.currentTarget.select()}
                        onClick={(e) => e.currentTarget.select()}
                        onBlur={() => commitDateDraft()}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") {
                            e.currentTarget.blur();
                            commitDateDraft(e.currentTarget.value);
                          }
                        }}
                        title={dataRefText}
                        aria-label="Data da posição"
                        inputMode="numeric"
                        placeholder="dd/mm/aaaa"
                      />
                    ) : (
                      <strong className="pb-donut-date-strong">—</strong>
                    )}
                    <div className="pb-donut-status-row">
                      <span className="pb-donut-meta-sub">
                        <span
                          className={`pb-live-dot${fetching ? " pb-live-fetching" : ""}`}
                          title={fetching ? "Atualizando..." : "Dados ao vivo"}
                          aria-hidden
                        />
                        Última atualização: {lastUpdText || "--:--"}
                      </span>
                      <button
                        type="button"
                        className="pb-btn-atualizar"
                        onClick={onRefresh}
                        disabled={!!fetching}
                        title={fetching ? "Atualizando..." : "Atualizar dados"}
                        aria-label="Atualizar dados"
                      >
                        <span
                          className={fetching ? "pb-btn-atualizar-spin" : undefined}
                          aria-hidden
                        >
                          ↻
                        </span>
                      </button>
                    </div>
                  </div>
                </div>
                <div className="pb-stat-grid">
                  <button
                    type="button"
                    className="pb-stat-cell"
                    onClick={click("presentes")}
                    title={STAT_DAY_TOOLTIPS.presentes}
                    aria-label={`Ver presentes — ${fmt(m.presentes)}`}
                  >
                    <span>Presentes</span>
                    <strong className="c-mock-green">{fmt(m.presentes)}</strong>
                  </button>
                  <button
                    type="button"
                    className="pb-stat-cell"
                    onClick={click("falta")}
                    title={STAT_DAY_TOOLTIPS.falta}
                    aria-label={`Ver faltas — ${fmt(m.faltas)}`}
                  >
                    <span>Faltas</span>
                    <strong className="c-mock-red">{fmt(m.faltas)}</strong>
                  </button>
                  <button
                    type="button"
                    className="pb-stat-cell"
                    onClick={click("atraso")}
                    title={STAT_DAY_TOOLTIPS.atraso}
                    aria-label={`Ver atrasos — ${fmt(m.atrasos)}`}
                  >
                    <span>Atrasos</span>
                    <strong className="c-mock-orange">{fmt(m.atrasos)}</strong>
                  </button>
                  <button
                    type="button"
                    className="pb-stat-cell"
                    onClick={click("ja_saiu")}
                    title={STAT_DAY_TOOLTIPS.ja_saiu}
                    aria-label={`Já saiu — ${fmt(m.saiu)}`}
                  >
                    <span>Já saiu</span>
                    <strong className="c-mock-neutral">{fmt(m.saiu)}</strong>
                  </button>
                  <button
                    type="button"
                    className="pb-stat-cell"
                    onClick={click("entrada_prev")}
                    title={STAT_DAY_TOOLTIPS.entrada_prev}
                    aria-label={`Entrada prevista — ${fmt(m.entrada)}`}
                  >
                    <span>Entrada prev.</span>
                    <strong className="c-mock-purple">{fmt(m.entrada)}</strong>
                  </button>
                  <button
                    type="button"
                    className="pb-stat-cell"
                    onClick={click("nao_controla")}
                    title={STAT_DAY_TOOLTIPS.nao_controla}
                    aria-label={`Sem controle — ${fmt(m.semControle)}`}
                  >
                    <span>Sem controle</span>
                    <strong className="c-mock-neutral">{fmt(m.semControle)}</strong>
                  </button>
                </div>
              </section>

              <section className="pb-side-panel">
                <h2 className="pb-side-title">Quadro</h2>
                <table className="pb-side-table">
                  <thead>
                    <tr>
                      <th>Indicador</th>
                      <th className="num">Qtd.</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr>
                      <td>
                        Força atual
                        <span
                          className="pb-tooltip-hint"
                          data-tooltip="Soma de ativos por departamento conforme dados do dia. Inclui presentes, ausentes e em trânsito."
                        >ⓘ</span>
                      </td>
                      <td className="num c-blue">{fmt(m.atual)}</td>
                    </tr>
                    {m.prevista != null && m.prevista > 0 && (
                      <tr>
                        <td>
                          Força prevista
                          <span
                            className="pb-tooltip-hint"
                            data-tooltip="Quadro ideal configurado na tela Força Prevista. Representa a meta de headcount de cada setor."
                          >ⓘ</span>
                        </td>
                        <td className="num">{fmt(m.prevista)}</td>
                      </tr>
                    )}
                    {m.vagas != null && (
                      <tr>
                        <td>
                          Vagas
                          <span
                            className="pb-tooltip-hint"
                            data-tooltip="Força prevista − força atual. Zero indica quadro completo."
                          >ⓘ</span>
                        </td>
                        <td className="num">
                          {m.vagas === 0 ? (
                            <span className="c-green" title="Quadro completo">
                              0 ✓
                            </span>
                          ) : (
                            <span className="c-orange">{fmt(m.vagas)}</span>
                          )}
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </section>

              <section className="pb-side-panel">
                <h2 className="pb-side-title">Planejadas</h2>
                <table className="pb-side-table">
                  <thead>
                    <tr>
                      <th>Tipo</th>
                      <th className="num">Qtd.</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr>
                      <td>Total planejadas</td>
                      <td className="num">{fmt(totalPlan)}</td>
                    </tr>
                    <tr>
                      <td>
                        <button type="button" className="pb-side-rowbtn" onClick={click("folga")}>
                          Folgas
                        </button>
                      </td>
                      <td className="num c-blue">{fmt(m.folgas)}</td>
                    </tr>
                    <tr>
                      <td>
                        <button type="button" className="pb-side-rowbtn" onClick={click("ferias")}>
                          Férias
                        </button>
                      </td>
                      <td className="num c-green">{fmt(m.ferias)}</td>
                    </tr>
                    <tr>
                      <td>
                        <button
                          type="button"
                          className="pb-side-rowbtn"
                          onClick={click("afastados")}
                        >
                          Afastados
                        </button>
                      </td>
                      <td className="num c-red">{fmt(m.afastados)}</td>
                    </tr>
                  </tbody>
                </table>
              </section>

              <OperationalDiagnosisPanel
                data={operationalDiagnosisData}
                onAction={handleOperationalAction}
              />

              <section
                className="pb-side-panel pb-side-panel-dept"
                aria-label="Por departamento agora"
              >
                <div className="pb-side-panel-head pb-side-panel-head--dept">
                  <h2 className="pb-side-title">Por departamento agora</h2>
                  {typeof onOpenDept === "function" && (
                    <button type="button" className="pb-dept-link" onClick={onOpenDept}>
                      Ver todos →
                    </button>
                  )}
                </div>
                <div className="pb-side-dept-toolbar">
                  <div
                    className="pb-trend-tabs pb-side-dept-modes"
                    role="tablist"
                    aria-label="Visão"
                  >
                    <button
                      type="button"
                      className={`pb-trend-tab${deptMiniMode === "abs" ? " is-active" : ""}`}
                      onClick={() => setDeptMiniMode("abs")}
                      aria-selected={deptMiniMode === "abs"}
                      role="tab"
                    >
                      Ausentes
                    </button>
                    <button
                      type="button"
                      className={`pb-trend-tab${deptMiniMode === "pres" ? " is-active" : ""}`}
                      onClick={() => setDeptMiniMode("pres")}
                      aria-selected={deptMiniMode === "pres"}
                      role="tab"
                    >
                      Presentes
                    </button>
                  </div>
                  <div className="pb-trend-tabs" role="tablist" aria-label="Ordem">
                    <button
                      type="button"
                      className={`pb-trend-tab${deptMiniOrder === "desc" ? " is-active" : ""}`}
                      onClick={() => setDeptMiniOrder("desc")}
                      aria-selected={deptMiniOrder === "desc"}
                      role="tab"
                      title="Maior → menor"
                    >
                      ↓
                    </button>
                    <button
                      type="button"
                      className={`pb-trend-tab${deptMiniOrder === "asc" ? " is-active" : ""}`}
                      onClick={() => setDeptMiniOrder("asc")}
                      aria-selected={deptMiniOrder === "asc"}
                      role="tab"
                      title="Menor → maior"
                    >
                      ↑
                    </button>
                  </div>
                </div>
                <div className="pb-side-dept-scroll">
                  <div className="pb-dept-list">
                    {deptMiniRows.length > 0 ? (
                      deptMiniRows.map((r) => (
                        <button
                          key={r.id}
                          type="button"
                          className="pb-dept-row"
                          onClick={
                            deptMiniMode === "pres" ? () => onCardClick?.("presentes") : onOpenDept
                          }
                          aria-label={`${r.name}: ${r.v} colaborador${r.v !== 1 ? "es" : ""}`}
                        >
                          <span className="pb-dept-name" title={r.name}>
                            {r.name}
                          </span>
                          <div className="pb-dept-bar">
                            <div
                              className={`pb-dept-bar-fill ${deptMiniMode === "abs" ? "tone-red" : "tone-green"}`}
                              style={{ width: `${Math.max(2, r.pct)}%` }}
                            />
                          </div>
                          <span
                            className={`pb-dept-pct ${deptMiniMode === "abs" ? "tone-red" : "tone-green"}`}
                          >
                            {r.v}
                          </span>
                        </button>
                      ))
                    ) : (
                      <div className="pb-dept-empty">
                        {deptMiniMode === "pres"
                          ? "Sem presentes no dia (importe a planilha de presentes)"
                          : "Sem ausentes no dia (faltas + atrasos na planilha)"}
                      </div>
                    )}
                  </div>
                </div>
              </section>

              {canShowPanel("saudePreventiva") && (
                <section
                  className="pb-side-panel pb-side-panel-lei"
                  aria-label="Lei de saúde preventiva"
                >
                  <button
                    type="button"
                    className="pb-side-law-card"
                    onClick={openSaudePreventivaView}
                    title="Abrir Gestão de Campanhas de Saúde — arts. 169-A e 473 da CLT"
                  >
                    <span className="pb-side-law-kicker">Saúde preventiva</span>
                    <strong className="pb-side-law-title">Lei nº 15.377/2026</strong>
                    <span className="pb-side-law-desc">Campanhas de saúde e conformidade CLT</span>
                    <span className="pb-side-law-cta">Abrir em nova guia →</span>
                  </button>
                </section>
              )}

              {canShowPanel("nr1") && (
                <section className="pb-side-panel pb-side-panel-lei" aria-label="Conformidade NR-1">
                  <button
                    type="button"
                    className="pb-side-law-card pb-side-law-card--nr1"
                    onClick={openNr1View}
                    title="Abrir Gestão de Conformidade NR-1 — GRO, PGR e riscos psicossociais"
                  >
                    <span className="pb-side-law-kicker">SST · GRO / PGR</span>
                    <strong className="pb-side-law-title">NR-1 · Portaria 1.419/2024</strong>
                    <span className="pb-side-law-desc">Riscos psicossociais e conformidade SST</span>
                    <span className="pb-side-law-cta">Abrir em nova guia →</span>
                  </button>
                </section>
              )}
            </div>
          </div>
        </div>
        )}

        {/* ABSENTEÍSMO — ApexCharts + tabela */}
        {canShowPanel("historico") && (
        <div className="pb-cell pb-unified-chart" style={panelStyle("historico")}>
          <div className="pb-trend-head">
            <div className="pb-trend-head-main">
              <span className="pb-label pb-trend-title">Absenteísmo</span>
              <div className="pb-trend-toolbar">
                <div className="pb-trend-band">
                  <span className="pb-trend-band-label">Período</span>
                  <div className="pb-trend-tabs" role="tablist" aria-label="Período">
                    <button
                      type="button"
                      className={`pb-trend-tab ${faltDays === PB_FALT_DAYS_ATUAL && !histDateFrom && !histDateTo ? "is-active" : ""}`}
                      onClick={() => selectFaltDays(PB_FALT_DAYS_ATUAL)}
                      aria-pressed={faltDays === PB_FALT_DAYS_ATUAL && !histDateFrom && !histDateTo}
                      title="Período de apuração atual (API)"
                    >
                      Período atual
                    </button>
                    <button
                      type="button"
                      className={`pb-trend-tab ${faltDays === 7 && !histDateFrom && !histDateTo ? "is-active" : ""}`}
                      onClick={() => selectFaltDays(7)}
                      aria-pressed={faltDays === 7 && !histDateFrom && !histDateTo}
                    >
                      7d
                    </button>
                    <button
                      type="button"
                      className={`pb-trend-tab ${faltDays === 15 && !histDateFrom && !histDateTo ? "is-active" : ""}`}
                      onClick={() => selectFaltDays(15)}
                      aria-pressed={faltDays === 15 && !histDateFrom && !histDateTo}
                    >
                      15d
                    </button>
                    <button
                      type="button"
                      className={`pb-trend-tab ${faltDays === 30 && !histDateFrom && !histDateTo ? "is-active" : ""}`}
                      onClick={() => selectFaltDays(30)}
                      aria-pressed={faltDays === 30 && !histDateFrom && !histDateTo}
                    >
                      30d
                    </button>
                    <button
                      type="button"
                      className={`pb-trend-tab pb-periodos-tab${histDateFrom || histDateTo ? " is-active" : ""}`}
                      onClick={() => openHistTableModal()}
                      title="Selecionar período personalizado"
                    >
                      Outros períodos
                    </button>
                  </div>
                </div>
                <div className="pb-trend-band pb-trend-band--views">
                  <span className="pb-trend-band-label">Visualização</span>
                  <div className="pb-trend-tabs" role="tablist" aria-label="Visualização">
                    <button
                      type="button"
                      className={`pb-trend-tab pb-trend-tab--home${!histDetailOpen && !radarWorkspaceOpen ? " is-active" : ""}`}
                      onClick={() => {
                        setHistDetailOpen(false);
                        setRadarWorkspaceOpen(false);
                        setHistIsFloating(false);
                      }}
                      aria-pressed={!histDetailOpen && !radarWorkspaceOpen}
                      title="Resumo do período"
                    >
                      <span className="pb-trend-tab-text">Início</span>
                    </button>
                    <button
                      type="button"
                      className={`pb-trend-tab ${histDetailOpen && !radarWorkspaceOpen && bentoView === "chart" ? "is-active" : ""}`}
                      onClick={() => {
                        setRadarWorkspaceOpen(false);
                        setBentoView("chart");
                        setHistDetailOpen(true);
                        setHistIsFloating(false);
                      }}
                      aria-pressed={histDetailOpen && !radarWorkspaceOpen && bentoView === "chart"}
                    >
                      Gráfico
                    </button>
                    <button
                      type="button"
                      className={`pb-trend-tab ${(histDetailOpen && !radarWorkspaceOpen && bentoView === "table") || histIsFloating ? "is-active" : ""}`}
                      onClick={() => openHistTableModal()}
                      aria-pressed={
                        (histDetailOpen && !radarWorkspaceOpen && bentoView === "table") ||
                        histIsFloating
                      }
                    >
                      Tabela
                    </button>
                    <a
                      href={DATAVIEW_URL}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="pb-trend-tab pb-trend-tab--dataview"
                      title="Abrir DataView (Mac Ponto Web)"
                    >
                      DataView
                    </a>
                  </div>
                  {canViewAssistant && (
                    <DashboardNlAskPanel
                      context={dashboardNlContext}
                      surface="absenteismo"
                      theme={theme}
                      onAction={handleDashboardNlAction}
                      compact
                      className="pb-trend-nl-inline"
                    />
                  )}
                </div>
              </div>
            </div>
            <div className="pb-trend-head-actions">
              <div ref={setHistCtrlEl} className="pb-trend-head-ctrl" />
            </div>
          </div>
          <div
            className={
              histTableInline
                ? "pb-unified-chart-body pb-unified-chart-body--table"
                : showHistChart
                  ? "pb-unified-chart-body pb-unified-chart-body--chart"
                  : "pb-unified-chart-body"
            }
          >
            {histRows.length === 0 ? (
              <div className="pb-dept-empty">Sem dados históricos</div>
            ) : histRows.length < 2 &&
              !histTableOpen &&
              (!histDetailOpen || bentoView === "chart") ? (
              <div className="pb-dept-empty">
                Histórico insuficiente para tendência. Abra a tabela para ver o dia disponível.
              </div>
            ) : showRadarHome ? (
              <div className="pb-radar">
                <div className="pb-radar-kpis">
                  <div className="pb-radar-kpis-heroes">
                    {canViewAbsenteismoCard && (
                      <AbsenteismoResumoCard
                        histRadar={histRadar}
                        histRows={histRows}
                        histPeriodShortLabel={histPeriodShortLabel}
                        absCardTooltip={absCardTooltip}
                        absBaseInfo={absBaseInfo}
                        absCalcWarnings={absCalcWarnings}
                        absMeta={absMeta}
                        fmt={fmt}
                        onOpenChart={() => setKpiEvolOpen("abs")}
                        onOpenTable={() => openHistTableInline()}
                        onOpenCalc={() => setAbsCalcOpen(true)}
                      />
                    )}
                  </div>
                </div>
              </div>
            ) : showHistChart ? (
              <div className="pb-hist-chart-panel">
                <div className="pb-hist-chart-panel-head" data-html2canvas-ignore="true">
                  <div
                    className="pb-trend-tabs pb-chart-mode-tabs"
                    role="tablist"
                    aria-label="Modo do gráfico"
                  >
                    <button
                      type="button"
                      className={`pb-trend-tab${histChartMode === "abs" ? " is-active" : ""}`}
                      onClick={() => setHistChartMode("abs")}
                      title="Absenteísmo %"
                      aria-pressed={histChartMode === "abs"}
                    >
                      Abs%
                    </button>
                    <button
                      type="button"
                      className={`pb-trend-tab${histChartMode === "hrs" ? " is-active" : ""}`}
                      onClick={() => setHistChartMode("hrs")}
                      title="Horas planejadas, trabalhadas, perdidas e extras"
                      aria-pressed={histChartMode === "hrs"}
                    >
                      Hrs
                    </button>
                    <button
                      type="button"
                      className={`pb-trend-tab${histChartMode === "legacy" ? " is-active" : ""}`}
                      onClick={() => setHistChartMode("legacy")}
                      title="Gráfico de presença (anterior)"
                      aria-pressed={histChartMode === "legacy"}
                    >
                      Pres%
                    </button>
                  </div>
                </div>
                <div className="pb-hist-chart-panel-body">
                  <Suspense fallback={<div className="pb-dept-empty" style={{ flex: 1 }} />}>
                    {histChartMode === "abs" && (
                      <AbsenteismoChart
                        histRows={histRows}
                        isDark={theme === "dark"}
                        meta={absMeta}
                        onSelectDay={openChartDayModal}
                        onRequestHoursView={() => setHistChartMode("hrs")}
                      />
                    )}
                    {histChartMode === "hrs" && (
                      <HorasChart
                        histRows={histRows}
                        isDark={theme === "dark"}
                        onSelectDay={openChartDayModal}
                      />
                    )}
                    {histChartMode === "legacy" && (
                      <BentoHistChart
                        histRows={histRows}
                        isDark={theme === "dark"}
                        onSelectDay={openChartDayModal}
                        onRequestAbsView={() => setHistChartMode("abs")}
                      />
                    )}
                  </Suspense>
                </div>
              </div>
            ) : histTableInline ? (
              <Suspense
                fallback={<div className="pb-dept-empty" style={{ flex: 1, minHeight: 120 }} />}
              >
                <HistoricoTable
                  histRows={histRows}
                  theme={theme}
                  deptHistRows={histDeptRows}
                  dateFrom={histDateFrom}
                  dateTo={histDateTo}
                  onDateFromChange={setHistDateFrom}
                  onDateToChange={setHistDateTo}
                  ctrlEl={histCtrlEl}
                  selectedEmp={selectedEmp}
                  onEmpChange={setSelectedEmp}
                  empList={empList}
                  isFloating={false}
                  onFloatChange={setHistIsFloating}
                  openDateRequest={histOpenDateRequest}
                  periodoApuracao={periodoApuracao}
                  highlightCol={histHighlightCol}
                  tableViewRequest={histTableViewRequest}
                  embeddedInChart
                  absMeta={absMeta}
                />
              </Suspense>
            ) : null}
          </div>
          {histIsFloating && (
            <Suspense fallback={null}>
              <HistoricoTable
                histRows={histRows}
                theme={theme}
                deptHistRows={histDeptRows}
                dateFrom={histDateFrom}
                dateTo={histDateTo}
                onDateFromChange={setHistDateFrom}
                onDateToChange={setHistDateTo}
                ctrlEl={histCtrlEl}
                selectedEmp={selectedEmp}
                onEmpChange={setSelectedEmp}
                empList={empList}
                isFloating
                onFloatChange={setHistIsFloating}
                onFloatMinimize={dockHistTableModal}
                onFloatClose={closeHistTableModal}
                openDateRequest={histOpenDateRequest}
                periodoApuracao={periodoApuracao}
                highlightCol={histHighlightCol}
                tableViewRequest={histTableViewRequest}
                embeddedInChart
                absMeta={absMeta}
              />
            </Suspense>
          )}
        </div>
        )}

        {/* HORAS NO PERIODO */}
        {canShowPanel("horasPeriodo") && showRadarHome && histHasHours && (
        <div className="pb-cell pb-horas-periodo-panel" style={panelStyle("horasPeriodo")}>
          <RadarHoursFace
            histRadar={histRadar}
            histRows={histRows}
            fmtHMReadable={fmtHMReadable}
            hasHours={histHasHours}
            variant="bar"
            onOpenTableCol={openHistTableCol}
            onOpenConsecFaltas={openConsecFaltasModal}
          />
          <div className="pb-radar-footer pb-radar-footer--hours">
            <span className="pb-radar-footer-meta">
              {histDateFrom || histDateTo
                ? `Período ${fmtShortDate(histDateFrom || histRows[0]?.date)} – ${fmtShortDate(histDateTo || histRows[histRows.length - 1]?.date)}`
                : faltDays === PB_FALT_DAYS_ATUAL && periodoApuracao.de && periodoApuracao.ate
                  ? `Período atual (${fmtDateBr(periodoApuracao.de)} – ${fmtDateBr(periodoApuracao.ate)})`
                  : `Últimos ${faltDays} dias`}
            </span>
            <button type="button" className="pb-btn" onClick={() => openHistTableInline()}>
              Ver tabela detalhada
            </button>
          </div>
        </div>
        )}

        {/* RADAR TRABALHISTA */}
        {canShowPanel("radarTrabalhista") && (
        <div className="pb-cell pb-radar-trabalhista-panel" style={panelStyle("radarTrabalhista")}>
          <div className="pb-radar">
            <div className="pb-radar-kpis">
              <div className="pb-radar-kpis-heroes">
                <RadarTrabalhistaResumoCard
                  histRadar={histRadar}
                  histRows={histRows}
                  onOpenChart={() => setKpiEvolOpen("risk")}
                  onOpenRadar={openRadarWorkspace}
                />
              </div>
            </div>
          </div>
        </div>
        )}

        {/* APONTAMENTOS */}
        {canShowPanel("turnover") && (
        <div className="pb-cell pb-apontamentos" style={panelStyle("turnover")}>
          <div className="pb-kpi-head">
            <div className="pb-trend-head-l">
              <span className="pb-label">TURNOVER</span>
            </div>
            <div className="pb-kpi-actions">
              <input
                type="month"
                className="pb-kpi-month"
                value={turnFrom}
                max={turnTo || undefined}
                onChange={(e) => setConsistentTurnFrom(e.target.value)}
              />
              <input
                type="month"
                className="pb-kpi-month"
                value={turnTo}
                min={turnFrom || undefined}
                onChange={(e) => setConsistentTurnTo(e.target.value)}
              />
              <div className="pb-kpi-export-wrap" ref={turnExportRef}>
                <button
                  type="button"
                  className="pb-kpi-iconbtn"
                  aria-label="Exportar KPI"
                  title="Exportar"
                  onClick={() => setTurnExportOpen((v) => !v)}
                >
                  {"\u2913"}
                </button>
                {turnExportOpen ? (
                  <div className="pb-kpi-export-menu" role="menu">
                    <button
                      type="button"
                      className="pb-kpi-export-item"
                      role="menuitem"
                      onClick={() => {
                        setTurnExportOpen(false);
                        handleTurnoverExport("xlsx");
                      }}
                    >
                      Excel
                    </button>
                    <button
                      type="button"
                      className="pb-kpi-export-item"
                      role="menuitem"
                      onClick={() => {
                        setTurnExportOpen(false);
                        handleTurnoverExport("pdf");
                      }}
                    >
                      PDF
                    </button>
                  </div>
                ) : null}
              </div>
            </div>
          </div>

          <div className="pb-kpi-table-wrap">
            {!turnoverView ? null : (
              <table className="pb-kpi-table">
                <thead>
                  <tr>
                    <th>Grupos</th>
                    {turnoverView.months.map((m) => (
                      <th key={m}>{m}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {turnoverView.rows.map((r) => (
                    <tr key={r.label} className={r.label.startsWith("%") ? "is-pct" : ""}>
                      <td
                        className="pb-kpi-rowlbl"
                        title={
                          r.label.startsWith("%")
                            ? "Índice = ((Admitidos + Desligados) / 2 / Total de Colaboradores) * 100"
                            : undefined
                        }
                      >
                        {(() => {
                          const lbl = String(r.label || "");
                          if (
                            lbl === "Desligados" &&
                            typeof onOpenTurnoverDesligados === "function"
                          ) {
                            return (
                              <button
                                type="button"
                                className="pb-kpi-rowbtn"
                                onClick={() =>
                                  onOpenTurnoverDesligados({ from: turnFrom, to: turnTo })
                                }
                              >
                                {r.label}
                              </button>
                            );
                          }
                          if (
                            lbl === "Admitidos" &&
                            typeof onOpenTurnoverAdmitidos === "function"
                          ) {
                            return (
                              <button
                                type="button"
                                className="pb-kpi-rowbtn"
                                onClick={() =>
                                  onOpenTurnoverAdmitidos({
                                    from: turnFrom,
                                    to: turnTo,
                                    label: r.label,
                                  })
                                }
                              >
                                {r.label}
                              </button>
                            );
                          }
                          if (
                            (lbl === "Horistas" ||
                              lbl === "Mensalistas" ||
                              lbl === "Estagiários" ||
                              lbl === "Total de Colaboradores" ||
                              lbl === "Total De Colaboradores") &&
                            typeof onOpenTurnoverAdmitidos === "function"
                          ) {
                            return (
                              <button
                                type="button"
                                className="pb-kpi-rowbtn"
                                onClick={() =>
                                  onOpenTurnoverAdmitidos({
                                    from: turnFrom,
                                    to: turnTo,
                                    label: r.label,
                                  })
                                }
                              >
                                {r.label}
                              </button>
                            );
                          }
                          return r.label;
                        })()}
                      </td>
                      {r.values.map((v, i) => (
                        <td
                          key={i}
                          className={
                            r.label.startsWith("%") ? "pb-kpi-num pb-kpi-pct" : "pb-kpi-num"
                          }
                        >
                          {r.label.startsWith("%")
                            ? v == null
                              ? "—"
                              : String(v).replace(".", ",")
                            : fmt(v)}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>

          {!turnoverView?.chart?.length ? null : (
            <div className="pb-turnover-mini" aria-label="Mini gráfico de rotatividade">
              <div className="pb-turnover-mini-head">
                <div>
                  <span>Tendência da rotatividade</span>
                  <strong>
                    {turnoverView.current == null
                      ? "—"
                      : `${String(turnoverView.current).replace(".", ",")}%`}
                  </strong>
                  {turnoverView.meta != null ? (
                    <small>Meta {String(turnoverView.meta).replace(".", ",")}%</small>
                  ) : null}
                </div>
                {turnoverView.current != null && turnoverView.previous != null ? (
                  <em
                    className={turnoverView.current <= turnoverView.previous ? "is-good" : "is-bad"}
                  >
                    {turnoverView.current <= turnoverView.previous ? "↓" : "↑"}{" "}
                    {Math.abs(turnoverView.current - turnoverView.previous)
                      .toFixed(3)
                      .replace(".", ",")}{" "}
                    pp
                  </em>
                ) : null}
              </div>
              {(() => {
                const chart = turnoverView.chart || [];
                const width = 320;
                const height = 92;
                const padX = 12;
                const padTop = 10;
                const padBottom = 18;
                const validValues = chart
                  .map((point) => Number(point.value))
                  .filter((value) => Number.isFinite(value));
                const maxValue = Math.max(1, ...validValues);
                const plotHeight = height - padTop - padBottom;
                const points = chart.map((point, index) => {
                  const value = Number(point.value);
                  const x =
                    chart.length <= 1
                      ? width / 2
                      : padX + (index * (width - padX * 2)) / (chart.length - 1);
                  const y = Number.isFinite(value)
                    ? padTop + plotHeight - (Math.max(0, value) / maxValue) * plotHeight
                    : padTop + plotHeight;
                  return { ...point, x, y, value };
                });
                const linePath = points
                  .map(
                    (point, index) =>
                      `${index === 0 ? "M" : "L"} ${point.x.toFixed(2)} ${point.y.toFixed(2)}`,
                  )
                  .join(" ");
                const areaPath = points.length
                  ? `${linePath} L ${points[points.length - 1].x.toFixed(2)} ${height - padBottom} L ${points[0].x.toFixed(2)} ${height - padBottom} Z`
                  : "";
                return (
                  <div
                    className="pb-turnover-line-wrap"
                    role="img"
                    aria-label="Rotatividade por mês"
                  >
                    <svg
                      className="pb-turnover-mini-svg"
                      viewBox={`0 0 ${width} ${height}`}
                      preserveAspectRatio="none"
                    >
                      <line
                        className="pb-turnover-mini-grid"
                        x1="0"
                        y1={height - padBottom}
                        x2={width}
                        y2={height - padBottom}
                      />
                      <line
                        className="pb-turnover-mini-grid"
                        x1="0"
                        y1={padTop + plotHeight * 0.52}
                        x2={width}
                        y2={padTop + plotHeight * 0.52}
                      />
                      {areaPath ? <path className="pb-turnover-mini-area" d={areaPath} /> : null}
                      {linePath ? (
                        <path
                          className="pb-turnover-mini-line"
                          d={linePath}
                          vectorEffect="non-scaling-stroke"
                        />
                      ) : null}
                      {points.map((point) => (
                        <circle
                          key={point.label}
                          className="pb-turnover-mini-dot"
                          cx={point.x}
                          cy={point.y}
                          r="3.5"
                          vectorEffect="non-scaling-stroke"
                        >
                          <title>
                            {point.label}:{" "}
                            {point.value == null || !Number.isFinite(point.value)
                              ? "—"
                              : `${String(point.value).replace(".", ",")}%`}
                          </title>
                        </circle>
                      ))}
                    </svg>
                    <div className="pb-turnover-mini-foot">
                      <span>{points[0]?.label || ""}</span>
                      <span>{points[points.length - 1]?.label || ""}</span>
                    </div>
                  </div>
                );
              })()}
            </div>
          )}
        </div>
        )}

        {canShowPanel("abonos") && (
          <AbonosDeptPanel
            dia={dia}
            filteredDia={filteredDia}
            histRows={histRows}
            onOpenDeptColaboradores={onOpenAbonosDeptColaboradores}
            style={panelStyle("abonos")}
          />
        )}
        {canShowPanel("bancoHoras") && (
          <BancoHorasCard
            stats={bancoHorasStats}
            onOpenDepartamento={onOpenBancoHorasDeptColaboradores}
            onOpenKpi={onOpenBancoHorasKpiColaboradores}
            fmtHMReadable={fmtHMReadable}
            style={panelStyle("bancoHoras")}
          />
        )}
        {canShowPanel("mensal") && (
          <MensalListCard
            data={storedMensal}
            onOpenEvent={openMensalEventModal}
            periodoApuracao={periodoApuracao}
            fmtHMMilhar={fmtHMMilhar}
            style={panelStyle("mensal")}
          />
        )}
      </div>

      <style>{`
        @keyframes pb-spin { to { transform: rotate(360deg); } }
        @keyframes pb-pulse { 0%,100% { opacity: 1; transform: scale(1); } 50% { opacity: .4; transform: scale(.75); } }
        @keyframes pb-pulse-fast { 0%,100% { opacity: 1; } 50% { opacity: .3; } }
        .pos-bento .pb-delta {
          font-size: 10px; font-weight: 700; letter-spacing: .03em;
          opacity: .9; line-height: 1;
        }
        .pos-bento .pb-live-dot {
          display: inline-block; width: 7px; height: 7px; border-radius: 50%;
          background: var(--pb-presentes, #22c55e);
          margin-right: 5px; flex-shrink: 0;
          animation: pb-pulse 2.4s ease-in-out infinite;
        }
        .pos-bento .pb-live-dot.pb-live-fetching {
          background: #f59e0b;
          animation: pb-pulse-fast .7s ease-in-out infinite;
        }
        .pos-bento .pb-topbar-sep {
          width: 1px; align-self: stretch;
          background: var(--pb-border, rgba(0,0,0,.12));
          margin: 4px 6px; margin-left: auto; flex-shrink: 0;
        }
      `}</style>

      {absCalcOpen &&
        createPortal(
          <div
            className="pb-abs-calc-overlay"
            data-theme={theme}
            role="presentation"
            onClick={() => setAbsCalcOpen(false)}
          >
            <section
              className="pb-abs-calc-modal"
              role="dialog"
              aria-modal="true"
              aria-label="Cálculo do absenteísmo"
              onClick={(ev) => ev.stopPropagation()}
            >
              <header className="pb-abs-calc-head">
                <div>
                  <span className="pb-abs-calc-kicker">Auditoria do indicador</span>
                  <h3>Cálculo do absenteísmo</h3>
                  <p>{histPeriodLabel || "Período não informado"}</p>
                </div>
                <button
                  type="button"
                  className="pb-cfg-close"
                  aria-label="Fechar cálculo do absenteísmo"
                  onClick={() => setAbsCalcOpen(false)}
                >
                  ×
                </button>
              </header>

              <div className="pb-abs-calc-formula">
                <b>Fórmula usada</b>
                <strong>{absBaseInfo.formulaLabel}</strong>
                <span>
                  Versão {absBaseInfo.formulaId}. As horas ausentes são a base do índice exibido no
                  card.
                </span>
              </div>

              <div className="pb-abs-calc-grid">
                <span>
                  <b>Hrs. ausentes</b>
                  <strong>{fmtHMReadable(histRadar.horasAbs)}</strong>
                </span>
                <span>
                  <b>Hrs. planejadas</b>
                  <strong>{fmtHMReadable(histRadar.horasPlan)}</strong>
                </span>
                <span>
                  <b>Resultado</b>
                  <strong>{histRadar.absPct.toFixed(1).replace(".", ",")}%</strong>
                </span>
                <span>
                  <b>Meta</b>
                  <strong>{absMeta.toFixed(1).replace(".", ",")}%</strong>
                </span>
              </div>

              <div className="pb-abs-calc-base">
                <b>Base carregada</b>
                <span>
                  {absBaseInfo.source} · {absBaseInfo.days} dias · {fmt(absBaseInfo.records)}{" "}
                  registros
                  {absBaseInfo.from || absBaseInfo.to ? (
                    <>
                      {" "}
                      · {fmtShortDate(absBaseInfo.from)} até {fmtShortDate(absBaseInfo.to)}
                    </>
                  ) : null}
                </span>
              </div>

              {absCalcWarnings.length > 0 ? (
                <div className="pb-abs-calc-warnings">
                  <b>Pontos para revisar</b>
                  {absCalcWarnings.map((warning) => (
                    <span key={warning}>{warning}</span>
                  ))}
                </div>
              ) : (
                <div className="pb-abs-calc-ok">
                  Base consistente para o cálculo: há horas planejadas e índice dentro de faixa
                  auditável.
                </div>
              )}

              <footer className="pb-abs-calc-foot">
                <button type="button" onClick={() => setAbsCalcOpen(false)}>
                  Fechar
                </button>
                <button
                  type="button"
                  className="is-primary"
                  onClick={() => {
                    setAbsCalcOpen(false);
                    openHistTableInline({
                      dateFrom: absBaseInfo.from,
                      dateTo: absBaseInfo.to,
                      clearHighlight: true,
                      tableViewRequest: {
                        view: "date",
                        ts: Date.now(),
                        search: "",
                        source: "absenteismo-card",
                      },
                    });
                  }}
                >
                  Abrir tabela do período
                </button>
              </footer>
            </section>
          </div>,
          document.body,
        )}

      {/* Calculadora premium de horas */}
      {calcOpen &&
        createPortal(
          <Suspense fallback={null}>
            <HorasCalculadora onClose={() => setCalcOpen(false)} theme={theme} />
          </Suspense>,
          document.body,
        )}

      <RadarKpiModal
        open={kpiEvolOpen != null}
        variant={kpiEvolOpen || "abs"}
        onClose={() => setKpiEvolOpen(null)}
        theme={theme}
        histRowsAll={histRowsAll}
        histRadar={histRadar}
        absMeta={absMeta}
        periodLabel={histPeriodLabel}
        fmtHMReadable={fmtHMReadable}
        faltDays={faltDays}
        setFaltDays={selectFaltDays}
        customPeriod={Boolean(histDateFrom || histDateTo)}
        periodoApuracao={periodoApuracao}
        onSelectAbsDay={(date) => {
          setKpiEvolOpen(null);
          openHistTableInline({
            tableViewRequest: { view: "date", ts: Date.now() },
            openDateRequest: { date, nonce: Date.now() },
          });
        }}
      />

      {chartDayModal && (
        <HistoricoDayModal
          key={chartDayModal.date}
          date={chartDayModal.date}
          label={chartDayModal.label}
          employees={chartDayModal.employees}
          events={chartDayModal.events}
          histDayRows={histRows}
          dataSource={CONFIG.ABSENTEISMO_API ? "api" : "local"}
          apiContext={{
            enabled: true,
            de: chartDayModal.eventsDateFrom || histDateFrom,
            ate: chartDayModal.eventsDateTo || histDateTo,
          }}
          eventsDateFrom={chartDayModal.eventsDateFrom}
          eventsDateTo={chartDayModal.eventsDateTo}
          hasHours={histHasHours}
          hasExtras={histRows.some((r) => r.horas_extras != null || r.extras != null)}
          onClose={closeChartDayModal}
          theme={theme}
        />
      )}

      <ConsecFaltasModal
        open={consecFaltasOpen}
        onClose={() => setConsecFaltasOpen(false)}
        theme={theme}
        histRowsAll={histRows}
        periodoApuracao={periodoApuracao}
      />

      {radarWorkspaceOpen &&
        createPortal(
          <div
            className="rt-overlay"
            data-theme={theme}
            role="dialog"
            aria-modal="true"
            aria-label="Radar trabalhista"
            onMouseDown={(e) => {
              if (e.target === e.currentTarget) setRadarWorkspaceOpen(false);
            }}
          >
            <div className="rt-overlay-panel" onMouseDown={(e) => e.stopPropagation()}>
              <Suspense
                fallback={<div className="rt-overlay-loading">Carregando Radar trabalhista?</div>}
              >
                <RadarTrabalhistaShell
                  onClose={() => setRadarWorkspaceOpen(false)}
                  theme={theme}
                  histRows={histRows}
                  periodLabel={histPeriodLabel}
                  faltDays={faltDays}
                  setFaltDays={selectFaltDays}
                  histDateFrom={histDateFrom}
                  histDateTo={histDateTo}
                  onOpenHistorico={openHistFromRadar}
                  onToggleTheme={onToggleTheme}
                  customPeriod={Boolean(histDateFrom || histDateTo)}
                  periodoApuracao={periodoApuracao}
                  fmtHMReadable={fmtHMReadable}
                />
              </Suspense>
            </div>
          </div>,
          document.body,
        )}
    </div>
  );
}

export default PosicaoBentoHeader;
