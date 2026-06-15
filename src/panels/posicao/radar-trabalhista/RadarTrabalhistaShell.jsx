import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { PbPeriodToolbar } from "../PbPeriodToolbar.jsx";
import { RadarEventosTable, RadarEventosToolbar } from "./RadarEventosTable.jsx";
import { buildRadarTrabalhistaDataset, downloadCsv } from "./radarTrabalhistaData.js";
import { RtDeptMultiSelect } from "./RtDeptMultiSelect.jsx";
import { RadarDeptosView } from "./RadarDeptosView.jsx";
import {
  DEFAULT_PASSIVO_CFG,
  fmtBRL,
  fmtK,
  loadPassivoCfg,
  savePassivoCfg,
} from "./radarPassivoUtils.js";
import { RadarTendenciaChart } from "./RadarTendenciaChart.jsx";
import { RadarEventosVolumeChart } from "./RadarEventosVolumeChart.jsx";
import { RadarTurnoVolumeChart } from "./RadarTurnoVolumeChart.jsx";
import { inferDeptGroup, occurrenceDistribution } from "./radarColabsUtils.js";
import { findPlaybookForEvent } from "./rtEventPlaybooks.js";
import { cctLog, cctLogError } from "../posicaoCctDebug.js";
import { handleCctNativeInputChange, pickCctPdfFiles } from "../posicaoCctPickFiles.js";
import { importCctPdfFiles, loadCctIndex } from "../posicaoCctStorage.js";
import { RadarCctView } from "./RadarCctView.jsx";
import { RadarEventoPlaybookModal } from "./RadarEventoPlaybookModal.jsx";
import { Toast } from "../../../core/toast.js";
import { buildDashboardNlContext } from "../assistant/dashboardNlContext.js";
import { DashboardNlAskPanel } from "../assistant/DashboardNlAskPanel.jsx";
import "./radar-trabalhista.css";

const CCT_FILE_INPUT_ID = "pb-cct-file-input";

const NAV = [
  { id: "visao", icon: "📊", label: "Visão Geral", badge: null },
  { id: "eventos", icon: "⚠️", label: "Eventos", badgeKey: "eventos" },
  { id: "colabs", icon: "👥", label: "Colaboradores", badgeKey: "colabs" },
  { id: "heatmap", icon: "🔥", label: "Mapa de calor", badge: null },
  { id: "deptos", icon: "🏢", label: "Departamentos", badgeKey: "deptos" },
  { id: "passivo", icon: "💰", label: "Passivo", badge: null },
  { id: "params", icon: "⚙️", label: "Parâmetros", badge: null },
  { id: "cct", icon: "📄", label: "CCT", badgeKey: "cct" },
];

const HM_ORDER = [1, 2, 3, 4, 5, 6, 0];
const HM_LABELS = ["Seg", "Ter", "Qua", "Qui", "Sex", "Sáb", "Dom"];
const PAGE_IDS = NAV.map((item) => item.id);
const REC_FILTERS = [
  { id: "todos", label: "Todos" },
  { id: "criticos", label: "4+ penalidades" },
  { id: "recorrentes", label: "2-3 penalidades" },
  { id: "pontuais", label: "1 penalidade" },
];

function fmtShortDate(iso) {
  const m = String(iso || "").match(/^(\d{4})-(\d{2})-(\d{2})/);
  return m ? `${m[3]}/${m[2]}` : String(iso || "—");
}

function dayLabelFromIso(iso) {
  const m = String(iso || "").match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!m) return "";
  const date = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  return ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"][date.getDay()] || "";
}

function heatColor(p, isDark) {
  const t = Math.max(0, Math.min(1, p));
  if (t < 0.33) return isDark ? `rgba(34,197,94,${0.25 + t})` : `rgba(34,197,94,${0.35 + t * 0.4})`;
  if (t < 0.66) return isDark ? `rgba(234,179,8,${0.35 + t * 0.3})` : `rgba(234,179,8,${0.45})`;
  if (t < 0.85) return isDark ? `rgba(249,115,22,${0.5})` : `rgba(249,115,22,${0.55})`;
  return isDark ? `rgba(239,68,68,${0.55 + t * 0.25})` : `rgba(239,68,68,${0.6})`;
}

function legalShortRef(topEvent, playbook) {
  const raw = String(topEvent?.baseLegal || "").trim();
  if (raw && !/^clt\s*[—-]\s*verificar$/i.test(raw)) {
    return raw.split(":")[0].replace(/\s+/g, " ").trim();
  }
  const basis = String(playbook?.legalBasis || "").trim();
  return basis ? basis.split(":")[0].replace(/\s+/g, " ").trim() : "Base legal/CCT a verificar";
}

function passivoFormulaLabel(kind) {
  if (kind === "ferias") return "colabs x (SH x 220) x 2,33";
  if (kind === "ponto") return "colabs x multa configurada";
  if (kind === "extra") return "horas totais x SH x 1,5";
  return "horas totais x SH x 1,5";
}

function passivoFormulaHelp(kind) {
  if (kind === "ferias")
    return "Estimativa para férias vencidas/dobro, usando salário mensal aproximado por SH × 220.";
  if (kind === "ponto")
    return "Estimativa administrativa simplificada; fiscalização real depende do enquadramento.";
  if (kind === "extra") return "Estimativa de horas excedentes com adicional mínimo configurado.";
  return "Estimativa de intervalo/jornada suprimida com adicional de 50%.";
}

function topHistoricoValue(historico, key) {
  const map = new Map();
  for (const item of historico || []) {
    const value = String(item?.[key] || "").trim();
    if (!value) continue;
    map.set(value, (map.get(value) || 0) + 1);
  }
  return [...map.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))[0]?.[0] || "";
}

function recurrenceBucket(ocorrencias) {
  const n = Number(ocorrencias) || 0;
  if (n >= 4) return "criticos";
  if (n >= 2) return "recorrentes";
  if (n === 1) return "pontuais";
  return "todos";
}

function addIsoDays(iso, delta) {
  const m = String(iso || "").match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!m) return "";
  const d = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]) + delta);
  return d.toISOString().slice(0, 10);
}

function maxHistDate(rows, fallback = "") {
  return (
    (rows || [])
      .map((row) => String(row?.date || "").slice(0, 10))
      .filter(Boolean)
      .sort((a, b) => b.localeCompare(a))[0] || String(fallback || "").slice(0, 10)
  );
}

function resolveNlHeatmapRange(period, rows, fallbackFrom = "", fallbackTo = "") {
  if (!period) return { dateFrom: "", dateTo: "" };
  if (period.mode === "range") return { dateFrom: period.from || "", dateTo: period.to || "" };
  if (period.mode === "lastDays") {
    const days = Math.max(1, Number(period.days) || 1);
    const dateTo = maxHistDate(rows, fallbackTo || fallbackFrom);
    return { dateFrom: addIsoDays(dateTo, -(days - 1)), dateTo };
  }
  return { dateFrom: "", dateTo: "" };
}

function comparableText(value) {
  return String(value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}

function eventCollaboratorName(ev) {
  return String(ev?.nome || ev?.colaborador || ev?.colaboradorNome || "").trim();
}

function collectRadarCollaborators(rows) {
  const map = new Map();
  for (const row of rows || []) {
    for (const ev of row?._events || []) {
      const nome = eventCollaboratorName(ev);
      if (!nome) continue;
      map.set(nome, { nome });
    }
  }
  return [...map.values()];
}

function bestTextMatch(raw, options, getLabel = (v) => v) {
  const needle = comparableText(raw);
  if (!needle) return "";
  return (
    options.find((item) => {
      const label = comparableText(getLabel(item));
      return label && (label === needle || label.includes(needle) || needle.includes(label));
    }) || null
  );
}

export function RadarTrabalhistaShell({
  onClose,
  theme = "dark",
  histRows = [],
  periodLabel = "",
  faltDays = 30,
  setFaltDays,
  histDateFrom = "",
  histDateTo = "",
  onOpenHistorico,
  onToggleTheme,
  customPeriod = false,
  periodoApuracao = null,
  fmtHMReadable,
}) {
  const isDark = theme === "dark";
  const [page, setPage] = useState("visao");
  const [navCollapsed, setNavCollapsed] = useState(false);
  const [filtroDepts, setFiltroDepts] = useState([]);
  const [filtroDept, setFiltroDept] = useState("");
  const [filtroColab, setFiltroColab] = useState("");
  const [nlHeatmapPeriod, setNlHeatmapPeriod] = useState(null);
  const [recFilter, setRecFilter] = useState("todos");
  const initialPassivoCfg = useMemo(() => loadPassivoCfg(), []);
  const [cfg, setCfg] = useState(initialPassivoCfg);
  const [colabModal, setColabModal] = useState(null);
  const [eventPlaybook, setEventPlaybook] = useState(null);
  const [cctCount, setCctCount] = useState(0);
  const pageBodyRef = useRef(null);
  const cctFileInputRef = useRef(null);

  const goToPage = useCallback((id) => {
    if (!PAGE_IDS.includes(id)) return;
    setPage(id);
  }, []);

  useEffect(() => {
    pageBodyRef.current?.scrollTo({ top: 0, behavior: "instant" });
  }, [page]);

  useEffect(() => {
    cctLog("RadarTrabalhistaShell montado");
    return () => cctLog("RadarTrabalhistaShell desmontado");
  }, []);

  const runCctImport = useCallback(async () => {
    const el = cctFileInputRef.current;
    cctLog("runCctImport", { temInput: Boolean(el), page });
    const files = await pickCctPdfFiles(el);
    if (!files?.length) {
      cctLog("runCctImport: nenhum arquivo");
      window.dispatchEvent(
        new CustomEvent("pb-cct-import-done", { detail: { ok: false, cancelled: true } }),
      );
      return;
    }
    window.dispatchEvent(new CustomEvent("pb-cct-import-start"));
    try {
      const res = await importCctPdfFiles(files);
      cctLog("importCctPdfFiles resultado", res);
      window.dispatchEvent(new CustomEvent("pb-cct-import-done", { detail: res }));
    } catch (err) {
      cctLogError("importCctPdfFiles exceção", err);
      window.dispatchEvent(
        new CustomEvent("pb-cct-import-done", {
          detail: { ok: false, error: err?.message },
        }),
      );
    }
  }, [page]);

  useEffect(() => {
    const onShowCct = () => {
      cctLog("evento pb-show-cct");
      goToPage("cct");
    };
    const onOpenImport = () => {
      cctLog("evento pb-open-cct-import");
      goToPage("cct");
      requestAnimationFrame(() => runCctImport());
    };
    const onGoPage = (e) => {
      const id = e?.detail?.page;
      const filter = e?.detail?.filter;
      if (filter?.field && filter?.value) {
        const field = String(filter.field).toLowerCase();
        const value = String(filter.value).trim();
        if (field === "colaborador") {
          setFiltroColab(value);
          setFiltroDepts([]);
          setFiltroDept("");
        } else if (field === "departamento" || field === "depto") {
          setFiltroColab("");
          setFiltroDepts([value]);
          setFiltroDept(value);
        }
      }
      if (e?.detail?.period) setNlHeatmapPeriod(e.detail.period);
      if (id && PAGE_IDS.includes(id)) goToPage(id);
    };
    window.addEventListener("pb-show-cct", onShowCct);
    window.addEventListener("pb-open-cct-import", onOpenImport);
    window.addEventListener("pb-radar-go-page", onGoPage);
    window.__pbCctRunImport = runCctImport;
    return () => {
      window.removeEventListener("pb-show-cct", onShowCct);
      window.removeEventListener("pb-open-cct-import", onOpenImport);
      window.removeEventListener("pb-radar-go-page", onGoPage);
      delete window.__pbCctRunImport;
    };
  }, [goToPage, runCctImport]);

  useEffect(() => {
    loadCctIndex().then((list) => setCctCount(list.length));
  }, []);

  const passivoCfg = useMemo(() => ({ ...cfg, regime: "atual" }), [cfg]);
  const nlHeatmapRange = useMemo(
    () => resolveNlHeatmapRange(nlHeatmapPeriod, histRows, histDateFrom, histDateTo),
    [nlHeatmapPeriod, histRows, histDateFrom, histDateTo],
  );

  const data = useMemo(
    () =>
      buildRadarTrabalhistaDataset(histRows, {
        filtroDepts: page === "deptos" ? [] : filtroDepts,
        filtroDept: page === "deptos" ? filtroDept : "",
        filtroColab,
        dateFrom: nlHeatmapRange.dateFrom,
        dateTo: nlHeatmapRange.dateTo,
        passivoCfg,
      }),
    [
      histRows,
      filtroDepts,
      filtroDept,
      filtroColab,
      nlHeatmapRange.dateFrom,
      nlHeatmapRange.dateTo,
      page,
      passivoCfg,
    ],
  );

  const dashboardNlContext = useMemo(
    () =>
      buildDashboardNlContext({
        histRows,
        periodLabel,
        surface: "radar",
        radarSnapshot: {
          topEvent: data.topEvent,
          topDept: data.topDept,
          passivoTotal: data.passivoTotal,
          filtroDepts,
          filtroColab,
        },
      }),
    [
      histRows,
      periodLabel,
      data.topEvent,
      data.topDept,
      data.passivoTotal,
      filtroDepts,
      filtroColab,
    ],
  );

  const applyNlRadarFilter = useCallback(
    (action) => {
      const f = action?.filter;
      if (!f?.value) return false;
      const field = String(f.field || "").toLowerCase();
      const raw = String(f.value).trim();
      if (action?.period) setNlHeatmapPeriod(action.period);
      if (field === "departamento" || field === "depto") {
        const options = data.deptNames || [];
        const match =
          options.find(
            (d) =>
              d.toLowerCase() === raw.toLowerCase() ||
              d.toLowerCase().includes(raw.toLowerCase()) ||
              raw.toLowerCase().includes(d.toLowerCase()),
          ) || raw;
        setFiltroDepts([match]);
        setFiltroDept(match);
        setFiltroColab("");
        Toast.show(`Filtro aplicado: departamento «${match}»`, "i", 2800);
        return true;
      }
      if (field === "colaborador") {
        const match = bestTextMatch(raw, collectRadarCollaborators(histRows), (item) => item.nome);
        const value = match?.nome || raw;
        setFiltroColab(value);
        setFiltroDepts([]);
        setFiltroDept("");
        Toast.show(`Filtro aplicado: colaborador ${value}`, "i", 2800);
        return true;
      }
      return false;
    },
    [data.deptNames, histRows],
  );

  const handleDashboardNlAction = useCallback(
    (action) => {
      if (!action?.type) return;
      switch (action.type) {
        case "open_radar":
          applyNlRadarFilter(action);
          goToPage("deptos");
          break;
        case "open_radar_eventos":
          goToPage("eventos");
          break;
        case "open_radar_heatmap":
          applyNlRadarFilter(action);
          setNlHeatmapPeriod(action?.period || null);
          goToPage("heatmap");
          break;
        case "open_radar_passivo":
          goToPage("passivo");
          break;
        case "open_hist_table":
        case "open_hist_events":
          applyNlRadarFilter(action);
          onOpenHistorico?.();
          break;
        case "open_config_horas":
          goToPage("params");
          break;
        case "focus_abs_card":
        case "open_abs_chart":
        case "open_abs_home":
          onOpenHistorico?.();
          break;
        case "open_banco_horas":
        case "open_saude_preventiva":
        case "open_abonos":
          onOpenHistorico?.();
          break;
        default:
          break;
      }
    },
    [applyNlRadarFilter, goToPage, onOpenHistorico],
  );

  const deptOptions = useMemo(
    () => buildRadarTrabalhistaDataset(histRows, { filtroDepts: [], passivoCfg }).deptNames,
    [histRows, passivoCfg],
  );

  const toggleDept = useCallback((dept) => {
    setFiltroDepts((prev) =>
      prev.includes(dept) ? prev.filter((d) => d !== dept) : [...prev, dept],
    );
  }, []);

  useEffect(() => {
    savePassivoCfg({ ...cfg, regime: "atual" });
  }, [cfg]);

  const navBadges = useMemo(
    () => ({
      eventos: data.eventTypes.length,
      colabs: data.collaborators.length,
      deptos: data.departments.length,
      cct: cctCount,
    }),
    [data, cctCount],
  );

  const exportEventosCsv = useCallback(() => {
    downloadCsv(
      `radar-eventos-${Date.now()}.csv`,
      data.eventTypes.map((e) => [
        e.evento,
        e.baseLegal,
        e.ocorrencias,
        e.colaboradores,
        e.formula,
        e.passivo,
        `${e.pct.toFixed(1)}%`,
      ]),
      ["Evento", "Base Legal", "Ocorrências", "Colabs", "Cálculo usado", "Estimativa", "%"],
    );
  }, [data.eventTypes]);

  const hmMax = useMemo(() => {
    let m = 0;
    for (const row of data.heatmap.rows) {
      for (const v of row.values) if (v > m) m = v;
    }
    return m || 1;
  }, [data.heatmap.rows]);

  const principalFator = useMemo(() => {
    if (!data.topEvent?.evento) return null;
    const playbook = findPlaybookForEvent(data.topEvent.evento);
    return {
      evento: data.topEvent.evento,
      baseLegal: legalShortRef(data.topEvent, playbook),
      volume: `${data.topEvent.ocorrencias.toLocaleString("pt-BR")} penalidade(s) · ${data.topEvent.colaboradores.toLocaleString("pt-BR")} colab.`,
    };
  }, [data.topEvent]);

  const regimeSub = "estimativa pela regra legal atual";

  const colabsFiltered = useMemo(() => {
    if (recFilter === "todos") return data.collaborators;
    return data.collaborators.filter((c) => recurrenceBucket(c.ocorrencias) === recFilter);
  }, [data.collaborators, recFilter]);

  const colabFocus = useMemo(() => {
    const dist = occurrenceDistribution(data.collaborators);
    const criticos = data.collaborators.filter((c) => Number(c.ocorrencias) >= 4);
    const source = criticos.length ? criticos : data.collaborators;
    const eventos = new Map();
    const deptos = new Map();
    for (const c of source) {
      for (const h of c.historico || []) {
        if (h.evento) eventos.set(h.evento, (eventos.get(h.evento) || 0) + 1);
      }
      if (c.dept) deptos.set(c.dept, (deptos.get(c.dept) || 0) + Number(c.ocorrencias || 0));
    }
    const topEvento = [...eventos.entries()].sort(
      (a, b) => b[1] - a[1] || a[0].localeCompare(b[0]),
    )[0];
    const topDepto = [...deptos.entries()].sort(
      (a, b) => b[1] - a[1] || a[0].localeCompare(b[0]),
    )[0];
    return {
      dist,
      criticos: dist.quatroMais,
      recorrentes: dist.duasTres,
      pontuais: dist.uma,
      topEvento: topEvento?.[0] || data.topEvent?.evento || "Sem evento",
      topDepto: topDepto?.[0] || data.topDept?.dept || "Sem departamento",
    };
  }, [data.collaborators, data.topDept, data.topEvent]);

  const radarCriticalDays = useMemo(
    () =>
      data.ocorrTimeline
        .filter((d) => Number(d.value) > 0)
        .slice()
        .sort(
          (a, b) =>
            Number(b.value) - Number(a.value) || String(b.date).localeCompare(String(a.date)),
        )
        .slice(0, 5),
    [data.ocorrTimeline],
  );

  const radarActions = useMemo(() => {
    const actions = [];
    if (data.topEvent?.evento) {
      actions.push(
        `Revisar o evento "${data.topEvent.evento}" com ${data.topEvent.ocorrencias.toLocaleString("pt-BR")} ocorrência(s).`,
      );
    }
    if (data.topDept?.dept) {
      actions.push(
        `Priorizar ${data.topDept.dept}: ${data.topDept.ocorrencias.toLocaleString("pt-BR")} ocorrência(s) e ${data.topDept.colaboradores.toLocaleString("pt-BR")} colaborador(es).`,
      );
    }
    const peak = radarCriticalDays[0];
    if (peak) {
      actions.push(
        `Investigar o pico de ${Number(peak.value).toLocaleString("pt-BR")} ocorrência(s) em ${fmtShortDate(peak.date)}.`,
      );
    }
    return actions.length ? actions : ["Sem concentração crítica no período selecionado."];
  }, [data.topDept, data.topEvent, radarCriticalDays]);

  const pageTitle =
    page === "heatmap" ? "Mapa de Calor" : NAV.find((n) => n.id === page)?.label || "Radar";

  const pageSubtitle =
    page === "colabs"
      ? "Ranking de reincidência por penalidades trabalhistas"
      : page === "heatmap"
        ? "Concentração de penalidades por turno × dia da semana"
        : page === "deptos"
          ? "Onde concentram penalidades — clique no departamento para detalhar eventos"
          : page === "params"
            ? "Premissas de estimativa e parâmetros de cálculo"
            : page === "cct"
              ? "Convenções coletivas de trabalho em PDF — acervo local do navegador"
              : periodLabel || "Período selecionado";

  const hmPeakLabel = useMemo(() => {
    const p = data.heatmap.peak;
    if (!p?.value) return null;
    return `Pico: ${p.value} (${p.turno} ${p.dow})`;
  }, [data.heatmap.peak]);

  return (
    <div
      className="rt-shell"
      data-theme={theme}
      data-dark={isDark}
      data-nav-collapsed={navCollapsed ? "true" : "false"}
    >
      {/* Input fora de containers hidden — evita bloqueio do seletor de arquivos */}
      <input
        ref={cctFileInputRef}
        id={CCT_FILE_INPUT_ID}
        type="file"
        accept=".pdf,application/pdf"
        multiple
        tabIndex={-1}
        aria-hidden
        className="pb-cct-file-input-native"
        onChange={handleCctNativeInputChange}
      />
      <aside className="rt-nav">
        <div className="rt-nav-brand">
          <button
            type="button"
            className="rt-nav-toggle"
            onClick={() => setNavCollapsed((v) => !v)}
            aria-label={navCollapsed ? "Expandir menu" : "Recolher menu"}
            title={navCollapsed ? "Expandir menu" : "Recolher menu"}
          >
            {navCollapsed ? "☰" : "‹"}
          </button>
          <span className="rt-nav-logo">⚖️</span>
          <div className="rt-nav-brand-text">
            <strong>Radar Trabalhista</strong>
            <small>v2 · integrado</small>
          </div>
        </div>
        <nav className="rt-nav-menu">
          {NAV.map((item) => (
            <button
              key={item.id}
              type="button"
              className={`rt-nav-item${page === item.id ? " is-active" : ""}`}
              onClick={() => goToPage(item.id)}
            >
              <span className="rt-nav-ico">{item.icon}</span>
              <span className="rt-nav-lbl">{item.label}</span>
              {item.badgeKey != null && navBadges[item.badgeKey] > 0 ? (
                <span className="rt-nav-badge">{navBadges[item.badgeKey]}</span>
              ) : null}
            </button>
          ))}
        </nav>
        {!navCollapsed ? (
          <p className="rt-nav-scroll-hint" title="Role até o fim da página ou use a roda do mouse">
            Role ↓↑ para trocar de aba
          </p>
        ) : null}
      </aside>

      <main className="rt-main">
        <header className={`rt-page-head${page === "colabs" ? " rt-page-head--colabs" : ""}`}>
          {page === "colabs" ? (
            <div className="rt-colabs-head">
              <div className="rt-colabs-head-top">
                <h2 className="rt-page-title">{pageTitle}</h2>
                <div className="rt-page-head-actions">
                  {onToggleTheme ? (
                    <button
                      type="button"
                      className="rt-btn rt-btn-theme"
                      onClick={onToggleTheme}
                      aria-label={isDark ? "Mudar para tema claro" : "Mudar para tema escuro"}
                      title={isDark ? "Tema claro" : "Tema escuro"}
                    >
                      {isDark ? "☀️ Claro" : "🌙 Escuro"}
                    </button>
                  ) : null}
                  <button
                    type="button"
                    className="rt-head-close"
                    onClick={onClose}
                    aria-label="Fechar"
                  >
                    ×
                  </button>
                </div>
              </div>
              <p className="rt-page-sub rt-colabs-head-sub">{pageSubtitle}</p>
              <div className="rt-colabs-head-controls">
                <PbPeriodToolbar
                  faltDays={faltDays}
                  histDateFrom={histDateFrom}
                  histDateTo={histDateTo}
                  onSelectFaltDays={setFaltDays}
                  onOpenHistorico={onOpenHistorico}
                />
                <RtDeptMultiSelect
                  className="rt-colabs-dept-ms"
                  label="Departamentos"
                  options={deptOptions}
                  value={filtroDepts}
                  onChange={setFiltroDepts}
                  theme={theme}
                />
              </div>
            </div>
          ) : (
            <>
              <div className="rt-page-head-row">
                <div className="rt-page-head-titles">
                  <h2 className="rt-page-title">{pageTitle}</h2>
                  <p className="rt-page-sub">{pageSubtitle}</p>
                  <DashboardNlAskPanel
                    context={dashboardNlContext}
                    surface="radar"
                    theme={theme}
                    onAction={handleDashboardNlAction}
                    compact
                  />
                </div>
                <div className="rt-page-actions rt-page-actions--compact">
                  <PbPeriodToolbar
                    faltDays={faltDays}
                    histDateFrom={histDateFrom}
                    histDateTo={histDateTo}
                    onSelectFaltDays={setFaltDays}
                    onOpenHistorico={onOpenHistorico}
                  />
                  {page === "eventos" && (
                    <button type="button" className="rt-btn" onClick={exportEventosCsv}>
                      Exportar CSV
                    </button>
                  )}
                  {onToggleTheme ? (
                    <button
                      type="button"
                      className="rt-btn rt-btn-theme"
                      onClick={onToggleTheme}
                      aria-label={isDark ? "Mudar para tema claro" : "Mudar para tema escuro"}
                      title={isDark ? "Tema claro" : "Tema escuro"}
                    >
                      {isDark ? "☀️ Claro" : "🌙 Escuro"}
                    </button>
                  ) : null}
                  <button
                    type="button"
                    className="rt-head-close"
                    onClick={onClose}
                    aria-label="Fechar"
                  >
                    ×
                  </button>
                </div>
              </div>
            </>
          )}
        </header>

        <div
          ref={pageBodyRef}
          className={`rt-page-body${page === "heatmap" ? " rt-page-body--heatmap" : ""}${page === "colabs" ? " rt-page-body--colabs" : ""}${page === "eventos" ? " rt-page-body--eventos" : ""}${page === "deptos" ? " rt-page-body--deptos" : ""}${page === "cct" ? " rt-page-body--cct" : ""}`}
        >
          {page === "visao" && (
            <>
              <div className="rt-kpi-row">
                <div className="rt-kpi rt-kpi--purple">
                  <span className="rt-kpi-lbl">Penalidades</span>
                  <strong>{data.stats.ocorrencias.toLocaleString("pt-BR")}</strong>
                  <small>
                    {data.stats.eventosDistintos.toLocaleString("pt-BR")} tipo(s) de evento
                  </small>
                </div>
                <div className="rt-kpi rt-kpi--blue">
                  <span className="rt-kpi-lbl">Colaboradores impactados</span>
                  <strong>{data.stats.colaboradores.toLocaleString("pt-BR")}</strong>
                  <small>únicos no período</small>
                </div>
                <div className="rt-kpi rt-kpi--red">
                  <span className="rt-kpi-lbl">Principal fator</span>
                  {principalFator ? (
                    <div className="rt-factor-kpi">
                      <strong className="rt-factor-title">{principalFator.evento}</strong>
                      <span className="rt-factor-legal">{principalFator.baseLegal}</span>
                      <em>{principalFator.volume}</em>
                    </div>
                  ) : (
                    <small>sem penalidades</small>
                  )}
                </div>
                <div className="rt-kpi rt-kpi--orange">
                  <span className="rt-kpi-lbl">Passivo preliminar</span>
                  <strong>{fmtK(data.passivoTotal)}</strong>
                  <small>{regimeSub}</small>
                  <button type="button" className="rt-kpi-link" onClick={() => setPage("params")}>
                    Ver cálculo e editar premissas
                  </button>
                </div>
              </div>
              <div className="rt-grid-2 rt-grid-2--visao">
                <div className="rt-card rt-card--tendencia">
                  <RadarTendenciaChart
                    timeline={data.ocorrTimeline}
                    miniStats={data.miniStats}
                    isDark={isDark}
                    height={240}
                  />
                </div>
                <div className="rt-card">
                  <h3 className="rt-card-title">Top departamentos</h3>
                  <div className="rt-dept-list">
                    {data.departments.slice(0, 8).map((d) => (
                      <button
                        key={d.dept}
                        type="button"
                        className={`rt-dbar${filtroDepts.includes(d.dept) ? " is-active" : ""}`}
                        onClick={() => toggleDept(d.dept)}
                      >
                        <span className="rt-dbar-lbl" title={d.dept}>
                          {d.dept}
                        </span>
                        <span className="rt-dbar-track">
                          <span
                            className="rt-dbar-fill"
                            style={{
                              width: `${Math.min(100, (d.ocorrencias / (data.departments[0]?.ocorrencias || 1)) * 100)}%`,
                            }}
                          />
                        </span>
                        <span className="rt-dbar-val">{d.ocorrencias}</span>
                        <span className="rt-dbar-sub">{d.colaboradores} colab.</span>
                      </button>
                    ))}
                  </div>
                </div>
              </div>
              <div className="rt-operational-grid">
                <div className="rt-card rt-work-card">
                  <div className="rt-work-card-head">
                    <h3 className="rt-card-title">Departamentos com maior exposição</h3>
                    <span>Risco trabalhista</span>
                  </div>
                  <div className="rt-work-list">
                    {data.departments.slice(0, 5).map((d) => (
                      <button
                        key={d.dept}
                        type="button"
                        className="rt-work-row rt-work-row--button"
                        onClick={() => {
                          setFiltroDept(d.dept);
                          setPage("deptos");
                        }}
                      >
                        <span className="rt-work-row-main" title={d.dept}>
                          {d.dept}
                        </span>
                        <span className="rt-work-meta">
                          {d.colaboradores.toLocaleString("pt-BR")} colab.
                        </span>
                        <strong className="rt-work-value">
                          {d.ocorrencias.toLocaleString("pt-BR")}
                        </strong>
                      </button>
                    ))}
                    {!data.departments.length && (
                      <div className="rt-work-empty">Sem departamentos com risco no período.</div>
                    )}
                  </div>
                </div>
                <div className="rt-card rt-work-card">
                  <div className="rt-work-card-head">
                    <h3 className="rt-card-title">Dias com mais ocorrências</h3>
                    <span>Picos do período</span>
                  </div>
                  <div className="rt-work-list">
                    {radarCriticalDays.map((d) => (
                      <button
                        key={d.date}
                        type="button"
                        className="rt-work-row rt-work-row--button"
                        onClick={() => setPage("eventos")}
                      >
                        <span>
                          <span className="rt-work-dow">{dayLabelFromIso(d.date)}</span>
                          {fmtShortDate(d.date)}
                        </span>
                        <strong className="rt-work-value rt-work-value--warn">
                          {Number(d.value).toLocaleString("pt-BR")} ocorr.
                        </strong>
                      </button>
                    ))}
                    {!radarCriticalDays.length && (
                      <div className="rt-work-empty">Sem picos no período.</div>
                    )}
                  </div>
                </div>
                <div className="rt-card rt-work-card">
                  <div className="rt-work-card-head">
                    <h3 className="rt-card-title">Ações sugeridas ao RH</h3>
                    <span>Prioridade operacional</span>
                  </div>
                  <div className="rt-work-actions">
                    {radarActions.map((action, index) => (
                      <div key={`${action}-${index}`} className="rt-work-action">
                        {action}
                      </div>
                    ))}
                  </div>
                  <button
                    type="button"
                    className="rt-action-primary rt-work-primary"
                    onClick={() => setPage("eventos")}
                  >
                    Abrir eventos
                  </button>
                </div>
              </div>
              <div className="rt-card rt-card--eventos-vol">
                <RadarEventosVolumeChart eventTypes={data.eventTypes} isDark={isDark} />
              </div>
            </>
          )}

          {page === "eventos" && (
            <div className="rt-card rt-card--eventos">
              <RadarEventosToolbar
                deptOptions={deptOptions}
                filtroDepts={filtroDepts}
                onFiltroDeptsChange={setFiltroDepts}
                theme={theme}
              />
              <RadarEventosTable
                eventTypes={data.eventTypes}
                stats={data.stats}
                passivoTotal={data.passivoTotal}
                onEventSelect={setEventPlaybook}
              />
            </div>
          )}

          {page === "colabs" && (
            <>
              <div className="rt-grid-2 rt-grid-2--colabs">
                <div className="rt-card rt-card--colabs-rank">
                  <div className="rt-card-head-row">
                    <h3 className="rt-card-title">Colaboradores com mais penalidades</h3>
                    <span className="rt-card-hint">Ver detalhes na linha</span>
                  </div>
                  <div className="rt-rec-filter" role="group" aria-label="Filtro de reincidencia">
                    {REC_FILTERS.map((item) => (
                      <button
                        key={item.id}
                        type="button"
                        className={`rt-rec-chip${recFilter === item.id ? " is-active" : ""}`}
                        onClick={() => setRecFilter(item.id)}
                      >
                        {item.label}
                      </button>
                    ))}
                  </div>
                  <div className="rt-rank-list">
                    {colabsFiltered.slice(0, 20).map((c, i) => {
                      const principalEvento =
                        topHistoricoValue(c.historico, "evento") || "Sem evento";
                      return (
                        <button
                          key={`${c.mat || c.nome}-${i}`}
                          type="button"
                          className="rt-rank-row"
                          onClick={() => setColabModal(c)}
                        >
                          <span className="rt-rank-pos">{i + 1}</span>
                          <span className="rt-rank-info">
                            <strong>{c.nome}</strong>
                            <small title={c.dept}>
                              {c.dept || inferDeptGroup(c.dept)} · Principal: {principalEvento}
                            </small>
                          </span>
                          <span className="rt-rank-score-wrap">
                            <strong className="rt-rank-score">{c.ocorrencias}</strong>
                            <span className="rt-sc-badge rt-sc-badge--alto">penalidades</span>
                          </span>
                        </button>
                      );
                    })}
                    {!colabsFiltered.length && (
                      <p className="rt-empty rt-empty--inline">Nenhum colaborador neste filtro.</p>
                    )}
                  </div>
                </div>
                <div className="rt-card rt-card--colabs-action">
                  <h3 className="rt-card-title">Foco de acao</h3>
                  <div className="rt-action-hero">
                    <span>Reincidentes criticos</span>
                    <strong>{colabFocus.criticos}</strong>
                    <small>colaboradores com 4+ penalidades</small>
                  </div>
                  <div className="rt-action-metrics">
                    <button type="button" onClick={() => setRecFilter("criticos")}>
                      <strong>{colabFocus.criticos}</strong>
                      <span>4+ penalidades</span>
                    </button>
                    <button type="button" onClick={() => setRecFilter("recorrentes")}>
                      <strong>{colabFocus.recorrentes}</strong>
                      <span>2-3 penalidades</span>
                    </button>
                    <button type="button" onClick={() => setRecFilter("pontuais")}>
                      <strong>{colabFocus.pontuais}</strong>
                      <span>1 penalidade</span>
                    </button>
                  </div>
                  <div className="rt-action-readout">
                    <span>Principal evento</span>
                    <strong>{colabFocus.topEvento}</strong>
                  </div>
                  <div className="rt-action-readout">
                    <span>Departamento mais exposto</span>
                    <strong>{colabFocus.topDepto}</strong>
                  </div>
                  <button
                    type="button"
                    className="rt-action-primary"
                    onClick={() => setRecFilter("criticos")}
                  >
                    Ver reincidentes criticos
                  </button>
                </div>
              </div>
            </>
          )}

          {page === "heatmap" && (
            <div className="rt-heatmap-stack">
              <div className="rt-card rt-card--heatmap">
                <div className="rt-hm-head">
                  <h3 className="rt-card-title">Turno × dia</h3>
                  {hmPeakLabel ? <span className="rt-hm-peak">{hmPeakLabel}</span> : null}
                </div>
                <div className="rt-hm-grid">
                  <div className="rt-hm-corner" />
                  {HM_LABELS.map((l) => (
                    <div key={l} className="rt-hm-col-h">
                      {l}
                    </div>
                  ))}
                  {data.heatmap.rows.map((row) => (
                    <React.Fragment key={row.turno}>
                      <div className="rt-hm-row-h">{row.turno}</div>
                      {HM_ORDER.map((di, colIdx) => {
                        const v = row.values[di] || 0;
                        const p = v / hmMax;
                        const day = HM_LABELS[colIdx];
                        return (
                          <div
                            key={`${row.turno}-${di}`}
                            className="rt-hm-cell"
                            style={{ background: heatColor(p, isDark) }}
                            title={
                              v > 0
                                ? `${row.turno}-${day}: ${v} ocorrência${v === 1 ? "" : "s"}`
                                : `${row.turno}-${day}: sem ocorrências`
                            }
                          >
                            {v > 0 ? v : ""}
                          </div>
                        );
                      })}
                    </React.Fragment>
                  ))}
                </div>
                <div className="rt-hm-legend">
                  <span>Baixo</span>
                  <span className="rt-hm-grad" />
                  <span>Alto</span>
                </div>
              </div>
              <div className="rt-card rt-card--turno-vol">
                <h3 className="rt-card-title">Volume por turno</h3>
                <RadarTurnoVolumeChart
                  turnoTotals={data.heatmap.turnoTotals}
                  isDark={isDark}
                  chartHeight={190}
                />
              </div>
            </div>
          )}

          {page === "deptos" && (
            <RadarDeptosView
              histRows={histRows}
              passivoCfg={passivoCfg}
              filtroDept={filtroDept}
              onDeptChange={setFiltroDept}
              eventTypes={data.eventTypes}
              passivoTotal={data.passivoTotal}
              onEventSelect={setEventPlaybook}
            />
          )}

          {page === "passivo" && (
            <>
              <div className="rt-kpi-row">
                <div className="rt-kpi rt-kpi--orange">
                  <span className="rt-kpi-lbl">Passivo total</span>
                  <strong>{fmtBRL(data.passivoTotal)}</strong>
                </div>
                <div className="rt-kpi rt-kpi--purple">
                  <span className="rt-kpi-lbl">Maior vetor</span>
                  <strong className="rt-kpi-sm">
                    {data.topEvent?.evento?.slice(0, 28) || "—"}
                  </strong>
                </div>
                <div className="rt-kpi">
                  <span className="rt-kpi-lbl">Multa adm. (ponto)</span>
                  <strong>
                    {fmtBRL((cfg.multaMin || 40.25) * (data.stats.colaboradores || 0))}
                  </strong>
                </div>
              </div>
              <div className="rt-card">
                <h3 className="rt-card-title">Passivo por evento</h3>
                <div className="rt-dept-list">
                  {data.eventTypes.slice(0, 12).map((e) => (
                    <button
                      key={e.evento}
                      type="button"
                      className="rt-dbar rt-dbar--static rt-dbar--click"
                      onClick={() => setEventPlaybook(e)}
                    >
                      <span className="rt-dbar-lbl">{e.evento}</span>
                      <span className="rt-dbar-track">
                        <span
                          className="rt-dbar-fill rt-dbar-fill--ora"
                          style={{
                            width: `${Math.min(100, (e.passivo / (data.eventTypes[0]?.passivo || 1)) * 100)}%`,
                          }}
                        />
                      </span>
                      <span className="rt-dbar-val">{fmtK(e.passivo)}</span>
                    </button>
                  ))}
                </div>
              </div>
            </>
          )}

          {page === "params" && (
            <div className="rt-params-layout">
              <div className="rt-card rt-passivo-explain">
                <div>
                  <h3 className="rt-card-title">Como o passivo preliminar é calculado</h3>
                  <p>
                    Este valor é uma estimativa operacional para priorização. Ele soma o passivo
                    calculado por tipo de evento usando as premissas abaixo. Não é multa fiscal
                    definitiva nem parecer jurídico.
                  </p>
                </div>
                <div className="rt-passivo-total">
                  <span>Estimativa atual</span>
                  <strong>{fmtBRL(data.passivoTotal)}</strong>
                  <small>{regimeSub}</small>
                </div>
              </div>

              <div className="rt-grid-2">
                <div className="rt-card">
                  <h3 className="rt-card-title">Premissas editáveis</h3>
                  <label className="rt-field">
                    Salário/hora base (SH)
                    <input
                      type="number"
                      step="0.01"
                      value={cfg.sh}
                      onChange={(e) => setCfg((c) => ({ ...c, sh: Number(e.target.value) }))}
                    />
                  </label>
                  <label className="rt-field">
                    Adicional de hora extra
                    <input
                      type="number"
                      step="0.01"
                      value={cfg.adicionalHe}
                      onChange={(e) =>
                        setCfg((c) => ({ ...c, adicionalHe: Number(e.target.value) }))
                      }
                    />
                    <small>0,50 = adicional de 50%</small>
                  </label>
                  <label className="rt-field">
                    Multa configurada para ponto/marcação (R$)
                    <input
                      type="number"
                      step="0.01"
                      value={cfg.multaMin}
                      onChange={(e) => setCfg((c) => ({ ...c, multaMin: Number(e.target.value) }))}
                    />
                  </label>
                  <p className="rt-score-docs-note">
                    Cenario antigo com reflexos pre-2017 foi removido. O modulo usa somente a regra
                    legal atual.
                  </p>
                </div>
                <div className="rt-card rt-formulas">
                  <h3 className="rt-card-title">Fórmulas usadas</h3>
                  <pre>Intrajornada/intervalo: horas totais x SH x 1,5</pre>
                  <pre>Hora extra/sobrejornada: horas totais x SH x 1,5</pre>
                  <pre>Ferias: colabs x (SH x 220) x 2,33</pre>
                  <pre>Ponto/marcacao: colabs x multa configurada</pre>
                  <p className="rt-score-docs-note">
                    Fórmulas por evento poderão ser refinadas por empresa/CCT. Hoje os parâmetros
                    acima já alteram o recálculo.
                  </p>
                </div>
              </div>

              <div className="rt-card rt-passivo-breakdown">
                <h3 className="rt-card-title">Rastreabilidade por evento</h3>
                <div className="rt-passivo-breakdown-list">
                  {data.eventTypes.slice(0, 10).map((e) => (
                    <button
                      key={e.evento}
                      type="button"
                      className="rt-passivo-row"
                      onClick={() => setEventPlaybook(e)}
                    >
                      <span className="rt-passivo-row-main">
                        <strong>{e.evento}</strong>
                        <small>{passivoFormulaHelp(e.kind)}</small>
                      </span>
                      <span className="rt-passivo-row-formula">{passivoFormulaLabel(e.kind)}</span>
                      <span className="rt-passivo-row-meta">
                        {e.ocorrencias.toLocaleString("pt-BR")} ocorr. ·{" "}
                        {e.colaboradores.toLocaleString("pt-BR")} colab.
                      </span>
                      <span className="rt-passivo-row-value">{fmtBRL(e.passivo)}</span>
                    </button>
                  ))}
                </div>
              </div>

              <div className="rt-card rt-score-docs">
                <h3 className="rt-card-title">Observações importantes</h3>
                <p className="rt-score-docs-lead">
                  A estimativa usa dados de eventos classificados como risco trabalhista no período
                  e filtros ativos. Em fiscalização, eventual multa depende de enquadramento,
                  alcance, reincidência e interpretação da autoridade.
                </p>
                <ul className="rt-passivo-notes">
                  <li>Use salário-hora real ou médio da empresa para aproximar melhor o valor.</li>
                  <li>Regras de CCT podem alterar adicionais, intervalos e reflexos.</li>
                  <li>
                    O valor serve para priorização e simulação, não para lançamento automático em
                    folha.
                  </li>
                </ul>
              </div>
            </div>
          )}

          <div
            className={`rt-cct-mount${page !== "cct" ? " rt-cct-mount--hidden" : ""}`}
            aria-hidden={page !== "cct"}
          >
            <RadarCctView onCountChange={setCctCount} fileInputId={CCT_FILE_INPUT_ID} />
          </div>
        </div>
      </main>

      {eventPlaybook ? (
        <RadarEventoPlaybookModal
          eventRow={eventPlaybook}
          passivoCfg={passivoCfg}
          onClose={() => setEventPlaybook(null)}
        />
      ) : null}

      {colabModal && (
        <div
          className="rt-modal-ov"
          onMouseDown={(e) => e.target === e.currentTarget && setColabModal(null)}
        >
          <div className="rt-modal" role="dialog">
            <header className="rt-modal-head">
              <div>
                <h3>{colabModal.nome}</h3>
                <p>{colabModal.dept}</p>
              </div>
              <button type="button" className="rt-modal-x" onClick={() => setColabModal(null)}>
                ×
              </button>
            </header>
            <div className="rt-modal-stats">
              <div>
                <span>Ocorrências</span>
                <strong>{colabModal.ocorrencias}</strong>
              </div>
              <div>
                <span>Horas associadas</span>
                <strong>
                  {fmtHMReadable ? fmtHMReadable(colabModal.horas || 0) : colabModal.horas || 0}
                </strong>
              </div>
              <div>
                <span>Depto</span>
                <strong className="rt-ctx-sm">{colabModal.dept}</strong>
              </div>
            </div>
            <h4>Histórico</h4>
            <ul className="rt-timeline">
              {colabModal.historico.slice(0, 15).map((h, i) => (
                <li key={i} className="rt-tl-item">
                  <span className="rt-tl-date">{h.date}</span>
                  <span>{h.evento}</span>
                  <small>{h.turno}</small>
                </li>
              ))}
            </ul>
          </div>
        </div>
      )}
    </div>
  );
}
