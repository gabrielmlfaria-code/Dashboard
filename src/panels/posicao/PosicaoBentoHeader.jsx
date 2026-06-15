import React, { Suspense, lazy, startTransition, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import {
  mergeImportedEvents,
  mergeNewEvents,
  loadEventCategories,
  loadHourCategories,
} from "./HorasConfigModal";
import { PbConfiguracoesModal } from "./PbConfiguracoesModal.jsx";
import { Toast } from "../../core/toast.js";
import { AbonosDeptPanel } from "./AbonosDeptPanel.jsx";
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
} from "./bancoHoras.js";
import { loadKpiMensal, parseMensalSheet, saveKpiMensal } from "./mensal.js";
import { buildDeptTopList, fixPosicaoSheetRef, normalizeGenero, _fmtTime } from "./posicaoImport.js";
import { EmpFilter } from "./EmpFilter";
import { normDateKey, extractPeriodoApuracao, fmtDateBr, getDateMeta, getHistDataCutoffIso } from "./calendarUtils";
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
import { CONFIG } from "../../configLocal.js";
import { RadarTrendSparkline } from "./RadarTrendSparkline.jsx";
import {
  RADAR_KPI_TOOLTIPS,
  STAT_DAY_TOOLTIPS,
  buildAbsIndexTooltip,
  buildPlanHoursTooltip,
  WORK_HOURS_TOOLTIP,
} from "./radarKpiTooltips.js";
import {
  ABSENTEISMO_FORMULA_ID,
  ABSENTEISMO_FORMULA_LABEL,
  calculateAbsenteismoPct,
  capWorkedHours,
  computeAbsEdgeDelta,
  computeConsecutiveFaltasStats,
  computePeriodTotals,
  computeRiscoStats,
} from "./radarHoursUtils.js";
import {
  DEFAULT_AUDITORIA_PONTO_PARAMS,
  REGRAS_AUDITORIA_PONTO_META,
  analisarAnomaliasPonto,
} from "./auditoriaPonto/pontoAnomalias.js";
import { buildDashboardNlContext } from "./dashboardNlContext.js";
import {
  ABONOS_KIND,
  formatAbonosDiagnosis,
  formatAbonosImportSummary,
  loadKpiAbonos,
  parseAbonosFromWorkbook,
  saveKpiAbonos,
} from "./abonosDept.js";
import { DashboardNlAskPanel } from "./DashboardNlAskPanel.jsx";
import { OperationalDiagnosisPanel } from "../../features/positionToday/intelligence/OperationalDiagnosisPanel.jsx";
import { useDashboardApiData } from "../../hooks/useDashboardApiData.js";
import { normalizeSaudeRegistro, resolveEmpresaLabel } from "./saudePreventivaCampanhas.js";
import { buildSaudeCalendarioLembretes } from "./saudePreventivaArt473.js";
import { processSaudeCalendarioLembretes } from "./saudePreventivaLembretes.js";
import { openNr1InNewTab } from "./nr1Open.js";
import { openSaudePreventivaInNewTab } from "./saudePreventivaOpen.js";
import { loadSaudeRegistrosSync } from "./saudePreventivaStorage.js";
import { normalizePositionCategory } from "./domain/positionCategories.js";
import "./posicao-bento.css";

const BentoHistChart = lazy(() => import("./BentoHistChart.jsx"));
const AbsenteismoChart = lazy(() => import("./AbsenteismoChart.jsx"));
const HorasChart = lazy(() => import("./HorasChart.jsx"));
const HistoricoTable = lazy(() => import("./HistoricoTable.jsx"));
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

function SearchableSelect({ value, options, placeholder, onChange, ariaLabel }) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const wrapRef = useRef(null);
  const inputRef = useRef(null);

  useEffect(() => {
    if (!open) return;
    const onDoc = (ev) => {
      if (wrapRef.current && !wrapRef.current.contains(ev.target)) setOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [open]);

  // When closed, the input shows the selected value
  const displayValue = open ? query : value || "";

  const filtered = useMemo(() => {
    const q = (query || "").toLowerCase().trim();
    if (!q) return options;
    return options.filter((o) => String(o).toLowerCase().includes(q));
  }, [options, query]);

  const select = (val) => {
    onChange && onChange(val);
    setQuery("");
    setOpen(false);
  };

  return (
    <div className="pb-combo" ref={wrapRef}>
      <span className="pb-combo-ico" aria-hidden="true">
        🔎
      </span>
      <input
        ref={inputRef}
        className="pb-combo-input"
        type="text"
        value={displayValue}
        placeholder={placeholder}
        aria-label={ariaLabel}
        onFocus={() => {
          setOpen(true);
          setQuery("");
        }}
        onClick={() => {
          setOpen(true);
        }}
        onChange={(e) => {
          setQuery(e.target.value);
          if (!open) setOpen(true);
        }}
        onKeyDown={(e) => {
          if (e.key === "Escape") {
            setOpen(false);
            inputRef.current?.blur();
          }
          if (e.key === "Enter" && filtered.length > 0) {
            select(filtered[0]);
          }
          if (e.key === "ArrowDown") {
            setOpen(true);
          }
        }}
      />
      {(value || (open && query)) && (
        <button
          type="button"
          className="pb-combo-clear"
          onMouseDown={(e) => {
            e.preventDefault();
            select("");
            inputRef.current?.focus();
          }}
          aria-label="Limpar"
          title="Limpar"
        >
          ×
        </button>
      )}
      {open && (
        <div className="pb-combo-list" role="listbox">
          <button
            type="button"
            className="pb-combo-opt"
            aria-selected={!value}
            onMouseDown={(e) => {
              e.preventDefault();
              select("");
            }}
          >
            {placeholder}
          </button>
          {filtered.length === 0 ? (
            <div className="pb-combo-empty">Sem resultados</div>
          ) : (
            filtered.map((opt) => (
              <button
                key={opt}
                type="button"
                className="pb-combo-opt"
                aria-selected={value === opt}
                onMouseDown={(e) => {
                  e.preventDefault();
                  select(opt);
                }}
              >
                {opt}
              </button>
            ))
          )}
        </div>
      )}
    </div>
  );
}

const fmt = (n) => {
  if (n == null || Number.isNaN(n)) return "—";
  return Number(n).toLocaleString("pt-BR");
};
const fmtMoney = (n) => {
  if (n == null || Number.isNaN(Number(n))) return "R$ 0";
  return Number(n).toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
    maximumFractionDigits: 0,
  });
};
const fmtHM = (mins) => {
  const n = Math.max(0, Math.round(Number(mins) || 0));
  const h = Math.floor(n / 60);
  const m = n % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
};
/** Formato legivel para KPIs do radar (so exibicao; minutos inalterados). */
const fmtHMReadable = (mins) => {
  const n = Math.round(Number(mins) || 0);
  const sign = n < 0 ? "-" : "";
  const abs = Math.abs(n);
  const h = Math.floor(abs / 60);
  const m = abs % 60;
  if (h >= 100) {
    return m > 0 ?
       `${sign}${h.toLocaleString("pt-BR")} h ${String(m).padStart(2, "0")} min`
      : `${sign}${h.toLocaleString("pt-BR")} h`;
  }
  if (h > 0 || m > 0) {
    return `${sign}${String(h).padStart(2, "0")} h ${String(m).padStart(2, "0")} min`;
  }
  return "0 h";
};
const fmtHMMilhar = (mins) => {
  const n = Math.round(Number(mins) || 0);
  const sign = n < 0 ? "-" : "";
  const abs = Math.abs(n);
  const h = Math.floor(abs / 60).toLocaleString("pt-BR");
  const m = String(abs % 60).padStart(2, "0");
  return `${sign}${h}:${m}`;
};

const PB_AUDITORIA_PARAMS_KEY = "mp_auditoria_ponto_params";
const PB_AUDITORIA_REVIEWS_KEY = "mp_auditoria_ponto_reviews_v1";
const PB_AUDIT_SEVERITY_ORDER = { critica: 4, alta: 3, media: 2, baixa: 1, ok: 0 };

const AUDITORIA_PARAM_FIELDS = [
  { key: "toleranciaMinutos", label: "Tolerancia geral de desvio", suffix: "min", desc: "Margem aceita entre horario planejado e marcacao antes de abrir anomalia de desvio." },
  { key: "toleranciaDuplicidadeMinutos", label: "Janela para batida duplicada", suffix: "min", desc: "Marcacoes muito proximas dentro desta janela podem ser tratadas como batida repetida." },
  { key: "janelaPareamentoMaxMinutos", label: "Janela maxima de pareamento", suffix: "min", desc: "Distancia maxima para relacionar uma marcacao a um horario previsto." },
  { key: "intervaloIntrajornadaMinutos", label: "Intervalo intrajornada minimo", suffix: "min", desc: "Pausa minima esperada dentro da jornada quando a carga diaria exige intervalo." },
  { key: "jornadaIntrajornadaMinutos", label: "Jornada que exige intervalo", suffix: "min", desc: "A partir desta jornada planejada, a auditoria exige intervalo intrajornada." },
  { key: "intervaloInterjornadaMinutos", label: "Intervalo interjornada minimo", suffix: "min", desc: "Descanso minimo entre a saida de um dia e a primeira entrada do proximo dia." },
  { key: "pontoBritanicoDias", label: "Dias para ponto britanico", suffix: "dias", desc: "Quantidade de dias com marcacoes iguais para sinalizar possivel ponto britanico." },
  { key: "minutosResiduaisMinutos", label: "Minutos residuais tolerados", suffix: "min", desc: "Limite de diferencas pequenas acumuladas antes de sugerir ajuste financeiro." },
  { key: "limiteHoraExtraDiariaMinutos", label: "Limite diario de hora extra", suffix: "min", desc: "Total diario de hora extra acima do qual a regra passa a destacar risco." },
  { key: "intervaloIntrajornadaMaxMinutos", label: "Intervalo intrajornada maximo", suffix: "min", desc: "Intervalos maiores que este limite aparecem como atipicos para revisao." },
  { key: "diasConsecutivosLimite", label: "Dias consecutivos sem folga", suffix: "dias", desc: "Sequencia maxima de dias trabalhados antes de apontar risco de descanso semanal." },
  { key: "limiteBancoHorasPositivoMinutos", label: "Limite banco positivo", suffix: "min", desc: "Saldo positivo acima deste limite sinaliza risco de banco de horas." },
  { key: "limiteBancoHorasNegativoMinutos", label: "Limite banco negativo", suffix: "min", desc: "Saldo negativo abaixo deste limite sinaliza risco de banco de horas." },
  { key: "recorrenciaRiscoLimite", label: "Recorrencia para risco", suffix: "vezes", desc: "Quantidade de repeticoes para marcar risco recorrente no mesmo contexto." },
];

const AUDITORIA_CUSTOM_RULE_FIELDS = [
  { value: "evento", label: "Evento" },
  { value: "horas", label: "Horas" },
  { value: "marcacao", label: "Marcacao" },
  { value: "horario", label: "Horario planejado" },
  { value: "departamento", label: "Departamento" },
  { value: "cargo", label: "Cargo" },
  { value: "categoria", label: "Categoria" },
];

const AUDITORIA_CUSTOM_RULE_OPERATORS = [
  { value: "contem", label: "Contem" },
  { value: "nao_contem", label: "Nao contem" },
  { value: "igual", label: "Igual" },
  { value: "diferente", label: "Diferente" },
  { value: "maior_que", label: "Maior que" },
  { value: "maior_igual", label: "Maior ou igual" },
  { value: "menor_que", label: "Menor que" },
  { value: "menor_igual", label: "Menor ou igual" },
];

const AUDITORIA_RULE_HELP = {
  legal: "Regras que protegem descanso, intervalo, classificacao de ausencia, feriado e fechamento. Quando acionadas, normalmente exigem revisao de folha ou evidencia.",
  financeiro: "Regras que comparam evento, horas, marcacoes e banco de horas para evitar pagamento errado ou desconto indevido.",
  fraude: "Regras de padrao suspeito ou recorrencia, como ponto britanico e tratamentos manuais repetidos.",
  configuracao: "Regras que indicam escala, cadastro ou parametro insuficiente para auditar com seguranca.",
  operacional: "Regras de consistencia tecnica entre horario planejado, marcacoes e eventos do dia.",
};

const normalizeAuditoriaParamsConfig = (value = {}) => {
  const source = value && typeof value === "object" ? value : {};
  const regrasDesativadas = Array.isArray(source.regrasDesativadas)
    ? source.regrasDesativadas.map(String).filter(Boolean)
    : [];
  const regrasCustomizadas = Array.isArray(source.regrasCustomizadas)
    ? source.regrasCustomizadas
        .filter((rule) => rule && typeof rule === "object")
        .map((rule, index) => ({
          id: String(rule.id || `CUSTOM_${Date.now()}_${index}`),
          titulo: String(rule.titulo || rule.nome || "Regra especifica da empresa"),
          campo: String(rule.campo || "evento"),
          operador: String(rule.operador || "contem"),
          valor: String(rule.valor || ""),
          severidade: ["critica", "alta", "media", "baixa"].includes(rule.severidade) ? rule.severidade : "media",
          mensagem: String(rule.mensagem || ""),
          ativo: rule.ativo !== false,
        }))
    : [];
  return {
    ...DEFAULT_AUDITORIA_PONTO_PARAMS,
    ...source,
    regrasDesativadas,
    regrasCustomizadas,
  };
};

const readJsonStorage = (key, fallback) => {
  try {
    if (typeof localStorage === "undefined") return fallback;
    const parsed = JSON.parse(localStorage.getItem(key) || "null");
    return parsed && typeof parsed === "object" ? parsed : fallback;
  } catch {
    return fallback;
  }
};

const stripAuditHorarioCode = (value) =>
  String(value || "")
    .replace(/^\d+\s*-\s*/, "")
    .trim();

const splitAuditTimeTokens = (value) => stripAuditHorarioCode(value).split(/\s+/).filter(Boolean);

const auditEventDateKey = (ev) => normDateKey(ev?.data || ev?.date || ev?.data_referencia);

const fmtAuditMinutes = (min) => {
  const v = Math.max(0, Math.round(Number(min) || 0));
  return `${Math.floor(v / 60)}:${String(v % 60).padStart(2, "0")}`;
};

const makeDashboardAuditReviewKey = (ev, audit) =>
  [
    ev?.mat || ev?.nome || "sem-colaborador",
    auditEventDateKey(ev) || "sem-data",
    ev?.cod || "",
    ev?.evento || ev?.situacaoDesc || "sem-evento",
    fmtAuditMinutes(Number(ev?.horas) || 0),
    audit?.codigo || audit?.severidade || "auditoria",
  ]
    .map((part) => String(part || "").replace(/\s+/g, " ").trim())
    .join("|");

function buildDashboardAuditoriaPontoSummary(histRows, params, reviews = {}) {
  const events = [];
  for (const row of Array.isArray(histRows) ? histRows : []) {
    for (const ev of Array.isArray(row?._events) ? row._events : []) {
      events.push({ ...ev, data: ev?.data || ev?.date || row?.date });
    }
  }

  const byColab = new Map();
  for (const ev of events) {
    const key = String(ev?.mat || ev?.nome || "__sem_colaborador__");
    if (!byColab.has(key)) byColab.set(key, []);
    byColab.get(key).push(ev);
  }

  const summary = {
    totalEventos: events.length,
    total: 0,
    critica: 0,
    alta: 0,
    media: 0,
    baixa: 0,
    ok: 0,
    pendente: 0,
    tratado: 0,
    ajuste: 0,
    tratadoPct: 0,
    topDeptos: [],
    principal: null,
  };
  const deptos = new Map();

  for (const rows of byColab.values()) {
    const ordered = [...rows].sort((a, b) => {
      const da = auditEventDateKey(a) || "";
      const db = auditEventDateKey(b) || "";
      if (da !== db) return da.localeCompare(db);
      return String(a.horario || "").localeCompare(String(b.horario || ""));
    });
    const britanicoMap = new Map();
    for (const ev of ordered) {
      const signature = splitAuditTimeTokens(ev?.marcacao || "").join(" ");
      const dateKey = auditEventDateKey(ev);
      if (!signature || !dateKey) continue;
      if (!britanicoMap.has(signature)) britanicoMap.set(signature, new Set());
      britanicoMap.get(signature).add(dateKey);
    }
    ordered.forEach((ev, idx) => {
      const assinatura = splitAuditTimeTokens(ev?.marcacao || "").join(" ");
      const audit = analisarAnomaliasPonto(
        {
          ...ev,
          previousData: ordered[idx - 1] ? auditEventDateKey(ordered[idx - 1]) : "",
          previousMarcacao: ordered[idx - 1]?.marcacao || "",
          pontoBritanicoAssinatura: assinatura,
          pontoBritanicoRepeticoes: assinatura && britanicoMap.has(assinatura) ? britanicoMap.get(assinatura).size : 0,
        },
        params,
      );
      const sev = audit?.severidade || "ok";
      summary[sev] = (summary[sev] || 0) + 1;
      if (!audit?.memoria || sev === "ok") return;
      const review = reviews[makeDashboardAuditReviewKey(ev, audit)] || {};
      const status = review.status || "pendente";
      const depto = String(ev?.depto || ev?.departamento || ev?.depto_desc || "Sem departamento").trim() || "Sem departamento";
      const current = deptos.get(depto) || { label: depto, total: 0, critica: 0, alta: 0, pendente: 0 };
      current.total += 1;
      current[sev] = (current[sev] || 0) + 1;
      if (status === "pendente") current.pendente += 1;
      deptos.set(depto, current);
      summary.total += 1;
      if (status === "pendente") summary.pendente += 1;
      else summary.tratado += 1;
      if (status === "ajuste") summary.ajuste += 1;
      const ranked = {
        severidade: sev,
        observacao: audit.observacao || "",
        departamento: depto,
        colaborador: ev?.nome || "",
        matricula: ev?.mat || "",
      };
      if (
        !summary.principal ||
        PB_AUDIT_SEVERITY_ORDER[ranked.severidade] > PB_AUDIT_SEVERITY_ORDER[summary.principal.severidade]
      ) {
        summary.principal = ranked;
      }
    });
  }

  summary.tratadoPct = summary.total ? Math.round((summary.tratado / summary.total) * 100) : 0;
  summary.topDeptos = Array.from(deptos.values())
    .sort((a, b) => b.pendente - a.pendente || b.critica - a.critica || b.alta - a.alta || b.total - a.total)
    .slice(0, 4);
  return summary;
}

function EventsGrid({ events, monthLabels, onEventClick, eventSortDir = "asc", onToggleEventSort }) {
  const openEvent = (event, month) => {
    if (!event || typeof onEventClick !== "function") return;
    onEventClick(event, month);
  };

  const renderVariation = (variation) => {
    const value = String(variation || "").trim();
    if (!value || value === "—") return <span className="events-grid-var-empty">—</span>;
    if (value.toLowerCase() === "base baixa") {
      return <span className="events-grid-var-badge is-neutral">· base baixa</span>;
    }
    if (value.startsWith("+")) {
      return <span className="events-grid-var-badge is-up">↑ {value}</span>;
    }
    if (value.startsWith("-")) {
      return <span className="events-grid-var-badge is-down">↓ {value}</span>;
    }
    return <span className="events-grid-var-empty">—</span>;
  };

  const isMutedHours = (hours) => {
    const value = String(hours || "").trim();
    return !value || value === "—" || value === "0:00";
  };

  return (
    <div className="events-grid-card">
      <div className="events-grid-scroll">
        <table className="events-grid-table">
          <thead>
            <tr>
              <th className="events-grid-event-head" rowSpan={2}>
                <button
                  type="button"
                  className="events-grid-event-sort"
                  onClick={onToggleEventSort}
                  title="Ordenar eventos"
                >
                  Evento
                  <span aria-hidden="true">{eventSortDir === "asc" ? "▲" : "▼"}</span>
                </button>
              </th>
              {monthLabels.map((label) => (
                <th className="events-grid-month-head" colSpan={2} key={label}>
                  {label}
                </th>
              ))}
            </tr>
            <tr>
              {monthLabels.map((label) => (
                <React.Fragment key={`${label}-sub`}>
                  <th className="events-grid-sub-head is-group-start">Horas</th>
                  <th className="events-grid-sub-head">Var.</th>
                </React.Fragment>
              ))}
            </tr>
          </thead>
          <tbody>
            {events.map((event, index) => (
              <React.Fragment key={`${event.name}-${event.code}-${index}`}>
                {event.showCategory ? (
                  <tr className="events-grid-category-row">
                    <td className="events-grid-category-cell">
                      {event.categoryLabel}
                    </td>
                    <td className="events-grid-category-fill" colSpan={monthLabels.length * 2} aria-hidden="true" />
                  </tr>
                ) : null}
                <tr
                  onClick={() => openEvent(event)}
                  title="Abrir colaboradores deste evento"
                >
                  <td className="events-grid-event-cell">
                    <strong>{String(event.name || "").toLocaleUpperCase("pt-BR")}</strong>
                    {event.code ? <span>{event.code}</span> : null}
                  </td>
                  {monthLabels.map((label) => {
                    const month = event.months.find((item) => item.label === label) || {};
                    const hours = month.hours || "—";
                    return (
                      <React.Fragment key={`${event.code}-${label}`}>
                        <td
                          className={`events-grid-hours-cell ${isMutedHours(hours) ? "is-muted" : ""}`}
                          onClick={(e) => {
                            e.stopPropagation();
                            if (!isMutedHours(hours)) openEvent(event, month);
                          }}
                        >
                          <button
                            type="button"
                            className="events-grid-hours-btn"
                            onClick={(e) => {
                              e.stopPropagation();
                              openEvent(event, month);
                            }}
                            title="Abrir colaboradores deste evento no mês"
                            disabled={isMutedHours(hours)}
                          >
                            {hours}
                          </button>
                        </td>
                        <td className="events-grid-var-cell">{renderVariation(month.variation)}</td>
                      </React.Fragment>
                    );
                  })}
                </tr>
              </React.Fragment>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

const fmtShortDate = (iso) => {
  const m = String(iso || "").match(/^(\d{4})-(\d{2})-(\d{2})/);
  return m ? `${m[3]}/${m[2]}/${m[1].slice(-2)}` : String(iso || "—");
};
const fmtDateInput = (iso) => {
  const m = String(iso || "").match(/^(\d{4})-(\d{2})-(\d{2})$/);
  return m ? `${m[3]}/${m[2]}/${m[1]}` : String(iso || "");
};
const parseDateInput = (value) => {
  const s = String(value || "").trim();
  let m = s.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (m) return `${m[1]}-${m[2]}-${m[3]}`;
  m = s.match(/^(\d{1,2})[\/.-](\d{1,2})[\/.-](\d{2}|\d{4})$/);
  if (!m) return "";
  const y = m[3].length === 2 ? `20${m[3]}` : m[3];
  return `${y}-${m[2].padStart(2, "0")}-${m[1].padStart(2, "0")}`;
};
const pct = (a, b) => (b > 0 ? Math.round((a / b) * 100) : 0);

const PB_FALT_DAYS_ATUAL = "atual";
const DATAVIEW_URL = "https://dataview.macpontoweb.com.br/";
const normalizeFaltDays = (v) => {
  if (v === PB_FALT_DAYS_ATUAL || v === "current") return PB_FALT_DAYS_ATUAL;
  const n = Number(v);
  return n === 7 || n === 15 || n === 30 ? n : PB_FALT_DAYS_ATUAL;
};

const addDaysIso = (iso, days) => {
  const d = normDateKey(iso);
  const m = d.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!m) return "";
  const date = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  date.setDate(date.getDate() + days);
  return normDateKey(date);
};

const buildEmptyHistDay = (date) => ({
  date,
  data_referencia: date,
  total: 0,
  presentes: 0,
  faltas: 0,
  atrasos: 0,
  justificadas: 0,
  presentesPct: 0,
  abs_rate: 0,
  _missingPeriodDay: true,
});

const fillCalendarDays = (rows, days) => {
  const n = Math.max(1, Number(days) || 0);
  if (!rows.length || !n) return rows;
  const lastDate = normDateKey(rows[rows.length - 1]?.date);
  if (!lastDate) return rows;
  const firstDate = addDaysIso(lastDate, -(n - 1));
  const byDate = new Map(rows.map((r) => [normDateKey(r.date), r]));
  const out = [];
  for (let d = firstDate; d && d <= lastDate; d = addDaysIso(d, 1)) {
    out.push(byDate.get(d) || buildEmptyHistDay(d));
  }
  return out;
};

const filterHistRowsByPeriod = (allRows, { faltDays, histDateFrom, histDateTo, periodoApuracao }) => {
  if (!allRows.length) return [];
  const cutoff = getHistDataCutoffIso();
  const rows = [...allRows]
    .filter((r) => {
      const d = normDateKey(r.date);
      return d && d <= cutoff;
    })
    .sort((a, b) => String(a.date).localeCompare(String(b.date)));
  if (!rows.length) return [];

  if (histDateFrom || histDateTo) {
    const effectiveTo = histDateTo && histDateTo <= cutoff ? histDateTo : cutoff;
    return rows.filter((r) => {
      const d = normDateKey(r.date);
      if (histDateFrom && d < normDateKey(histDateFrom)) return false;
      if (d > normDateKey(effectiveTo)) return false;
      return true;
    });
  }

  if (faltDays === PB_FALT_DAYS_ATUAL) {
    let de = normDateKey(periodoApuracao?.de);
    let ate = normDateKey(periodoApuracao?.ate);
    if (!de || !ate) {
      const extracted = extractPeriodoApuracao(...rows);
      de = normDateKey(extracted.de);
      ate = normDateKey(extracted.ate);
    }
    if (de && ate) {
      const ateCapped = ate <= cutoff ? ate : cutoff;
      return rows.filter((r) => {
        const d = normDateKey(r.date);
        return d && d >= de && d <= ateCapped;
      });
    }
    return rows;
  }

  const n = Number(faltDays);
  if (n > 0) return fillCalendarDays(rows, n);
  return rows;
};

const extractHistRowsPeriodo = (rows) => {
  const dates = (Array.isArray(rows) ? rows : [])
    .map((r) => normDateKey(r?.date || r?.data_referencia || r?.data))
    .filter(Boolean)
    .sort();
  if (!dates.length) return null;
  return { de: dates[0], ate: dates[dates.length - 1], source: "tabela" };
};

const collectHistEventNames = (rows) => {
  const names = new Set();
  (Array.isArray(rows) ? rows : []).forEach((r) => {
    (Array.isArray(r?._events) ? r._events : []).forEach((ev) => {
      const name = String(ev?.evento || ev?.desc || ev?.cod || "").trim();
      if (name) names.add(name);
    });
  });
  return [...names].sort((a, b) => a.localeCompare(b, "pt-BR", { sensitivity: "base" }));
};

const eventConfigKey = (value) =>
  String(value || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]/g, "");

const getEventConfigForBancoHoras = (ev, configByName) => {
  if (!configByName || typeof configByName.get !== "function") return null;
  const keys = [ev?.evento, ev?.desc, ev?.descricao, ev?.cod, ev?.codigo]
    .map(eventConfigKey)
    .filter(Boolean);
  for (const key of keys) {
    const cfg = configByName.get(key);
    if (cfg) return cfg;
  }
  return null;
};

const isBancoHorasEvent = (ev, configByName = null) => {
  const cfg = getEventConfigForBancoHoras(ev, configByName);
  if (cfg?.creditoBH || cfg?.debitoBH) return true;
  const text = [ev?.evento, ev?.desc, ev?.descricao, ev?.cod, ev?.codigo]
    .map((v) => String(v || ""))
    .join(" ")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
  return /\bbanco\b/.test(text) && /\bhoras?\b/.test(text);
};

const bancoHorasSign = (ev, configByName = null) => {
  const cfg = getEventConfigForBancoHoras(ev, configByName);
  if (cfg?.debitoBH) return -1;
  if (cfg?.creditoBH) return 1;
  const text = [ev?.evento, ev?.desc, ev?.descricao, ev?.cod, ev?.codigo]
    .map((v) => String(v || ""))
    .join(" ")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
  if (/deb|descont|compens|saida|negat|utiliz/.test(text)) return -1;
  return 1;
};

const normBancoHorasKey = (value) =>
  String(value || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]/g, "");

const parseBancoHorasMin = (value) => {
  if (value == null || value === "") return null;
  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    return value.getHours() * 60 + value.getMinutes();
  }
  if (typeof value === "number" && Number.isFinite(value)) {
    const abs = Math.abs(value);
    const sign = value < 0 ? -1 : 1;
    if (abs > 0 && abs < 1000) return sign * Math.round(abs * 24 * 60);
    return Math.round(value);
  }
  const raw = String(value).trim();
  if (!raw || raw === "-") return null;
  const sign = raw.includes("-") ? -1 : 1;
  const s = raw.replace(/\s+/g, " ").replace(/[−–—]/g, "-").replace(/^\+/, "").replace(/^-/, "");
  const hm = s.match(/(\d{1,6})\s*:\s*(\d{1,2})/);
  if (hm) return sign * (Number(hm[1]) * 60 + Number(hm[2]));
  const verbose = s.match(/(\d{1,6})\s*h(?:oras?)?\s*(?:(\d{1,2})\s*m(?:in)?)?/i);
  if (verbose) return sign * (Number(verbose[1]) * 60 + Number(verbose[2] || 0));
  const n = parsePtNumber(s);
  return Number.isFinite(n) ? sign * Math.round(n) : null;
};

const pickBancoHorasMin = (obj, keys) => {
  if (!obj || typeof obj !== "object") return null;
  const wanted = new Set(keys.map(normBancoHorasKey));
  for (const [key, value] of Object.entries(obj)) {
    if (!wanted.has(normBancoHorasKey(key))) continue;
    const parsed = parseBancoHorasMin(value);
    if (parsed != null) return parsed;
  }
  return null;
};

const bancoHorasGroupLabel = (...items) => {
  for (const row of items) {
    const direct =
      row?.departamento ||
      row?.depto ||
      row?.depto_desc ||
      row?.setor ||
      row?.departamentoNome ||
      row?.["departamento.nome"] ||
      row?.departamento_nome;
    const value = String(direct || "").trim();
    if (value) return value;
  }
  for (const row of items) {
    const fallback = row?.filial || row?.empresa;
    const value = String(fallback || "").trim();
    if (value) return value;
  }
  return "Sem departamento";
};

const bancoHorasPersonKeys = (row) => {
  const keys = [];
  const matricula =
    row?.matricula ||
    row?.matrícula ||
    row?.colaboradorMatricula ||
    row?.["colaborador.matricula"];
  const nome =
    row?.nome ||
    row?.colaborador ||
    row?.colaboradorNome ||
    row?.["colaborador.nome"];
  if (matricula) keys.push(`m:${normBancoHorasKey(matricula)}`);
  if (nome) keys.push(`n:${normBancoHorasKey(nome)}`);
  return keys.filter((key) => key.length > 2);
};

const buildBancoHorasDeptLookup = (rows) => {
  const lookup = new Map();
  for (const row of Array.isArray(rows) ? rows : []) {
    const depto = bancoHorasGroupLabel(row);
    if (!depto || depto === "Sem departamento") continue;
    for (const key of bancoHorasPersonKeys(row)) {
      if (!lookup.has(key)) lookup.set(key, depto);
    }
  }
  return lookup;
};

const enrichBancoHorasDept = (row, lookup) => {
  if (bancoHorasGroupLabel(row) !== "Sem departamento") return row;
  for (const key of bancoHorasPersonKeys(row)) {
    const depto = lookup?.get(key);
    if (depto) return { ...row, departamento: depto, depto };
  }
  return row;
};

const mergeBancoHorasEventRow = (row, ev, patch = {}) => ({
  ...row,
  ...ev,
  departamento:
    ev?.departamento ||
    ev?.depto ||
    ev?.depto_desc ||
    ev?.departamentoNome ||
    ev?.["departamento.nome"] ||
    row?.departamento ||
    row?.depto ||
    row?.depto_desc ||
    "",
  depto:
    ev?.depto ||
    ev?.departamento ||
    ev?.depto_desc ||
    ev?.departamentoNome ||
    ev?.["departamento.nome"] ||
    row?.depto ||
    row?.departamento ||
    row?.depto_desc ||
    "",
  depto_desc:
    ev?.depto_desc ||
    ev?.departamento ||
    ev?.depto ||
    ev?.departamentoNome ||
    ev?.["departamento.nome"] ||
    row?.depto_desc ||
    row?.departamento ||
    row?.depto ||
    "",
  ...patch,
});

const addBancoHorasTopRow = (map, label, row) => {
  const key = String(label || "Sem departamento").trim() || "Sem departamento";
  const current = map.get(key) || {
    label: key,
    saldoAnterior: 0,
    credito: 0,
    debito: 0,
    saldoProximo: 0,
    ocorrencias: 0,
    colaboradores: new Set(),
    items: [],
    hasSaldoProximo: false,
  };
  const credito = Number(row?.credito || 0);
  const debito = Number(row?.debito || 0);
  const saldoProximo = row?.saldoProximo != null ? Number(row.saldoProximo) || 0 : null;
  const saldoAnterior =
    row?.hasSaldoAnterior !== false
      ? Number(row?.saldoAnterior || 0)
      : saldoProximo != null
        ? saldoProximo - credito + debito
        : Number(row?.saldoAnterior || 0);
  current.saldoAnterior += saldoAnterior;
  current.credito += credito;
  current.debito += debito;
  if (saldoProximo != null) {
    current.saldoProximo += saldoProximo;
    current.hasSaldoProximo = true;
  }
  current.ocorrencias += 1;
  current.items.push(row || {});
  const colab = row?.matricula || row?.nome || row?.colaborador || row?.colaboradorNome;
  if (colab) current.colaboradores.add(String(colab).trim());
  map.set(key, current);
};

const finishBancoHorasTop = (map, limit = 10) =>
  Array.from(map.values())
    .map((item) => {
      const saldoProximo = item.hasSaldoProximo ? item.saldoProximo : item.saldoAnterior + item.credito - item.debito;
      return {
        ...item,
        saldoProximo,
        saldoAbs: Math.abs(saldoProximo),
        colaboradores: item.colaboradores.size,
        items: Array.isArray(item.items) ? item.items : [],
      };
    })
    .sort((a, b) => b.saldoAbs - a.saldoAbs || b.credito - a.credito || a.label.localeCompare(b.label))
    .slice(0, limit);

const splitBancoHorasTop = (items) => {
  const rows = Array.isArray(items) ? items : [];
  return {
    positivos: rows
      .filter((item) => Number(item?.saldoProximo || 0) > 0)
      .sort((a, b) => Number(b.saldoProximo || 0) - Number(a.saldoProximo || 0) || a.label.localeCompare(b.label))
      .slice(0, 10),
    negativos: rows
      .filter((item) => Number(item?.saldoProximo || 0) < 0)
      .sort((a, b) => Number(a.saldoProximo || 0) - Number(b.saldoProximo || 0) || a.label.localeCompare(b.label))
      .slice(0, 10),
  };
};

const buildBancoHorasStats = (rows, eventCategories = [], storedBancoHoras = null) => {
  if (storedBancoHoras?.totals && Number(storedBancoHoras?.count || 0) > 0) {
    const totals = storedBancoHoras.totals;
    const importedRows = Array.isArray(storedBancoHoras.rows) ? storedBancoHoras.rows : [];
    const saldoAnteriorAliases = [
      "saldoAnterior",
      "saldoAnteriorBH",
      "saldo_anterior",
      "saldo_anterior_bh",
      "saldo anterior",
      "Saldo Anterior",
      "saldo inicial",
    ];
    const saldoProximoAliases = [
      "saldoProximo",
      "saldoProximoBH",
      "saldo_proximo",
      "saldo_proximo_bh",
      "saldo próximo",
      "saldo proximo",
      "Saldo Próximo",
      "saldo final",
      "saldo atual",
    ];
    const creditoAliases = ["credito", "creditoBH", "crédito", "Credito", "Crédito"];
    const debitoAliases = ["debito", "debitoBH", "débito", "Debito", "Débito"];
    const totalsCredito = pickBancoHorasMin(totals, creditoAliases) ?? 0;
    const totalsDebito = Math.abs(pickBancoHorasMin(totals, debitoAliases) ?? 0);
    const totalsSaldoAnterior = pickBancoHorasMin(totals, saldoAnteriorAliases);
    const totalsSaldoProximo = pickBancoHorasMin(totals, saldoProximoAliases);
    const rowSaldoAnterior = importedRows.reduce((sum, row) => {
      const creditoRow = pickBancoHorasMin(row, creditoAliases) ?? 0;
      const debitoRow = Math.abs(pickBancoHorasMin(row, debitoAliases) ?? 0);
      const anteriorRow = pickBancoHorasMin(row, saldoAnteriorAliases);
      const proximoRow = pickBancoHorasMin(row, saldoProximoAliases);
      if (anteriorRow != null) return sum + anteriorRow;
      if (proximoRow != null) return sum + (proximoRow - creditoRow + debitoRow);
      return sum;
    }, 0);
    const saldoAnteriorFromTotals =
      totalsSaldoAnterior != null
        ? totalsSaldoAnterior
        : totalsSaldoProximo != null
          ? totalsSaldoProximo - totalsCredito + totalsDebito
          : 0;
    const rowsHaveSaldoAnterior = importedRows.some(
      (row) => pickBancoHorasMin(row, saldoAnteriorAliases) != null || pickBancoHorasMin(row, saldoProximoAliases) != null,
    );
    const saldoAnteriorTotal = saldoAnteriorFromTotals || rowSaldoAnterior || 0;
    const saldoProximo =
      totalsSaldoProximo != null
        ? totalsSaldoProximo
        : saldoAnteriorTotal + totalsCredito - totalsDebito;
    const topMap = new Map();
    const deptLookup = buildBancoHorasDeptLookup(rows);
    for (const row of importedRows) {
      const enriched = enrichBancoHorasDept(row, deptLookup);
      addBancoHorasTopRow(topMap, bancoHorasGroupLabel(enriched), enriched);
    }
    const topDepartamentosAll = finishBancoHorasTop(topMap, Number.POSITIVE_INFINITY);
    const topSplit = splitBancoHorasTop(topDepartamentosAll);
    return {
      saldoAnterior: saldoAnteriorTotal,
      saldoAnteriorKnown: totalsSaldoAnterior != null || totalsSaldoProximo != null || rowsHaveSaldoAnterior,
      credito: totalsCredito,
      debito: totalsDebito,
      saldo: saldoProximo,
      saldoProximo,
      ocorrencias: Number(storedBancoHoras.count) || 0,
      colaboradores: Number(storedBancoHoras.colaboradores) || 0,
      source: "import",
      topDepartamentos: topSplit.positivos.length ? topSplit.positivos : topDepartamentosAll.slice(0, 10),
      topDepartamentosPositivos: topSplit.positivos,
      topDepartamentosNegativos: topSplit.negativos,
    };
  }
  const configByName = new Map(
    (Array.isArray(eventCategories) ? eventCategories : [])
      .filter((ev) => ev?.creditoBH || ev?.debitoBH)
      .map((ev) => [eventConfigKey(ev.name), ev]),
  );
  let saldoAnterior = 0;
  let saldoProximoInformado = 0;
  let hasSaldoAnterior = false;
  let hasSaldoProximo = false;
  let credito = 0;
  let debito = 0;
  let ocorrencias = 0;
  const topMap = new Map();

  for (const row of Array.isArray(rows) ? rows : []) {
    const rowSaldoAnterior = pickBancoHorasMin(row, [
      "saldo_anterior",
      "saldoAnterior",
      "saldoAnteriorBH",
      "saldo anterior",
      "saldo inicial",
      "anterior",
    ]);
    const rowSaldoProximo = pickBancoHorasMin(row, [
      "saldo_proximo",
      "saldoProximo",
      "saldoProximoBH",
      "saldo próximo",
      "saldo proximo",
      "saldo final",
      "saldo atual",
      "próximo saldo",
      "proximo saldo",
    ]);
    if (rowSaldoAnterior != null) {
      saldoAnterior += rowSaldoAnterior;
      hasSaldoAnterior = true;
    }
    if (rowSaldoProximo != null) {
      saldoProximoInformado += rowSaldoProximo;
      hasSaldoProximo = true;
    }

    for (const ev of Array.isArray(row?._events) ? row._events : []) {
      if (!isBancoHorasEvent(ev, configByName)) continue;
      const explicitCredito = pickBancoHorasMin(ev, ["credito", "creditoBH", "crédito", "creditos", "créditos"]);
      const explicitDebito = pickBancoHorasMin(ev, ["debito", "debitoBH", "débito", "debitos", "débitos"]);
      const evSaldoAnterior = pickBancoHorasMin(ev, [
        "saldo_anterior",
        "saldoAnterior",
        "saldoAnteriorBH",
        "saldo anterior",
        "saldo inicial",
        "anterior",
      ]);
      const evSaldoProximo = pickBancoHorasMin(ev, [
        "saldo_proximo",
        "saldoProximo",
        "saldoProximoBH",
        "saldo próximo",
        "saldo proximo",
        "saldo final",
        "saldo atual",
        "próximo saldo",
        "proximo saldo",
      ]);
      const mins = Math.max(0, Math.round(Number(ev?.horas) || 0));
      ocorrencias += 1;
      if (evSaldoAnterior != null) {
        saldoAnterior += evSaldoAnterior;
        hasSaldoAnterior = true;
      }
      if (evSaldoProximo != null) {
        saldoProximoInformado += evSaldoProximo;
        hasSaldoProximo = true;
      }
      if (explicitCredito != null || explicitDebito != null) {
        credito += Math.max(0, explicitCredito || 0);
        debito += Math.max(0, explicitDebito || 0);
        addBancoHorasTopRow(topMap, bancoHorasGroupLabel(ev, row), mergeBancoHorasEventRow(row, ev, {
          credito: Math.max(0, explicitCredito || 0),
          debito: Math.max(0, explicitDebito || 0),
          saldoProximo: evSaldoProximo,
          saldoAnterior: evSaldoAnterior || 0,
        }));
      } else if (bancoHorasSign(ev, configByName) < 0) {
        debito += mins;
        addBancoHorasTopRow(topMap, bancoHorasGroupLabel(ev, row), mergeBancoHorasEventRow(row, ev, { credito: 0, debito: mins }));
      } else {
        credito += mins;
        addBancoHorasTopRow(topMap, bancoHorasGroupLabel(ev, row), mergeBancoHorasEventRow(row, ev, { credito: mins, debito: 0 }));
      }
    }
  }

  if (!hasSaldoAnterior && hasSaldoProximo) {
    saldoAnterior = saldoProximoInformado - credito + debito;
    hasSaldoAnterior = true;
  }
  if (!hasSaldoAnterior) {
    saldoAnterior = 0;
    if (credito || debito || ocorrencias) hasSaldoAnterior = true;
  }
  const saldoProximo = hasSaldoProximo ? saldoProximoInformado : saldoAnterior + credito - debito;
  const topDepartamentosAll = finishBancoHorasTop(topMap, Number.POSITIVE_INFINITY);
  const topSplit = splitBancoHorasTop(topDepartamentosAll);
  return {
    saldoAnterior,
    saldoAnteriorKnown: hasSaldoAnterior,
    credito,
    debito,
    saldo: saldoProximo,
    saldoProximo,
    ocorrencias,
    topDepartamentos: topSplit.positivos.length ? topSplit.positivos : topDepartamentosAll.slice(0, 10),
    topDepartamentosPositivos: topSplit.positivos,
    topDepartamentosNegativos: topSplit.negativos,
  };
};

const PB_VIEW_KEY = "pos_bento_view_v1";
const loadPbView = () => {
  try {
    if (typeof window === "undefined") return {};
    const raw = window.localStorage.getItem(PB_VIEW_KEY);
    const parsed = raw ? JSON.parse(raw) : null;
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
};
const savePbView = (patch) => {
  try {
    if (typeof window === "undefined") return;
    const prev = loadPbView();
    const next = { ...(prev || {}), ...(patch || {}) };
    window.localStorage.setItem(PB_VIEW_KEY, JSON.stringify(next));
  } catch {
    // ignore
  }
};

const PB_KPI_TURNOVER_KEY = "pos_kpi_turnover_v1";
const loadKpiTurnover = () => {
  try {
    if (typeof window === "undefined") return null;
    const raw = window.localStorage.getItem(PB_KPI_TURNOVER_KEY);
    const parsed = raw ? JSON.parse(raw) : null;
    return parsed && typeof parsed === "object" ? parsed : null;
  } catch {
    return null;
  }
};
const saveKpiTurnover = (data) => {
  try {
    if (typeof window === "undefined") return;
    window.localStorage.setItem(PB_KPI_TURNOVER_KEY, JSON.stringify(data || null));
  } catch {
    // ignore
  }
};

const bancoHorasColabLabel = (row) =>
  String(
    row?.nome ||
      row?.colaborador ||
      row?.colaboradorNome ||
      row?.["colaborador.nome"] ||
      row?.employee ||
      "Sem colaborador",
  ).trim() || "Sem colaborador";

const bancoHorasMatriculaLabel = (row) =>
  String(row?.matricula || row?.["colaborador.matricula"] || row?.codigo || row?.cod || "").trim();

const bancoHorasCargoLabel = (row) =>
  String(row?.cargo || row?.cargo_desc || row?.cargoDescricao || row?.["cargo.descricao"] || "").trim();

const bancoHorasFilialLabel = (row) =>
  String(row?.filial || row?.filialNome || row?.["filial.nome"] || "").trim();

const buildBancoHorasDeptDetails = (items = []) => {
  const map = new Map();
  for (const row of Array.isArray(items) ? items : []) {
    const matricula = bancoHorasMatriculaLabel(row);
    const nome = bancoHorasColabLabel(row);
    const key = matricula || nome;
    const current = map.get(key) || {
      nome,
      matricula,
      cargo: bancoHorasCargoLabel(row),
      filial: bancoHorasFilialLabel(row),
      saldoAnterior: 0,
      credito: 0,
      debito: 0,
      saldoProximo: 0,
      ocorrencias: 0,
      hasSaldoProximo: false,
    };
    if (!current.cargo) current.cargo = bancoHorasCargoLabel(row);
    if (!current.filial) current.filial = bancoHorasFilialLabel(row);
    current.saldoAnterior += Number(row?.saldoAnterior || 0);
    current.credito += Number(row?.credito || 0);
    current.debito += Number(row?.debito || 0);
    if (row?.saldoProximo != null) {
      current.saldoProximo += Number(row.saldoProximo) || 0;
      current.hasSaldoProximo = true;
    }
    current.ocorrencias += 1;
    map.set(key, current);
  }
  return Array.from(map.values())
    .map((item) => ({
      ...item,
      saldoProximo: item.hasSaldoProximo ? item.saldoProximo : item.saldoAnterior + item.credito - item.debito,
    }))
    .sort((a, b) => Math.abs(b.saldoProximo) - Math.abs(a.saldoProximo) || a.nome.localeCompare(b.nome));
};

function BancoHorasDeptModal({ depto, onClose }) {
  const rows = buildBancoHorasDeptDetails(depto?.items);
  const totalSaldo = Number(depto?.saldoProximo || 0);
  const totalCredito = Number(depto?.credito || 0);
  const totalDebito = Number(depto?.debito || 0);
  const totalAnterior = Number(depto?.saldoAnterior || 0);

  return (
    <div className="pb-bh-modal" role="dialog" aria-modal="true" aria-label="Detalhe de banco de horas">
      <div className="pb-bh-modal__backdrop" onMouseDown={onClose} />
      <div className="pb-bh-modal__panel" onMouseDown={(e) => e.stopPropagation()}>
        <div className="pb-bh-modal__head">
          <div>
            <span>Banco de Horas</span>
            <strong>{depto?.label || "Departamento"}</strong>
            <em>
              {rows.length.toLocaleString("pt-BR")} colaborador(es) · {Number(depto?.ocorrencias || 0).toLocaleString("pt-BR")} lançamento(s)
            </em>
          </div>
          <button type="button" className="pb-bh-modal__close" onClick={onClose} aria-label="Fechar">×</button>
        </div>

        <div className="pb-bh-modal__cards">
          <div>
            <span>Saldo anterior</span>
            <strong>{fmtHMReadable(totalAnterior)}</strong>
          </div>
          <div>
            <span>Crédito</span>
            <strong>{fmtHMReadable(totalCredito)}</strong>
          </div>
          <div>
            <span>Débito</span>
            <strong>{fmtHMReadable(totalDebito)}</strong>
          </div>
          <div className={totalSaldo >= 0 ? "is-positive" : "is-negative"}>
            <span>Saldo próximo</span>
            <strong>{fmtHMReadable(Math.abs(totalSaldo))}</strong>
          </div>
        </div>

        <div className="pb-bh-modal__table-wrap">
          <table className="pb-bh-modal__table">
            <thead>
              <tr>
                <th>Colaborador</th>
                <th>Matrícula</th>
                <th>Cargo</th>
                <th>Ocorr.</th>
                <th>Saldo ant.</th>
                <th>Crédito</th>
                <th>Débito</th>
                <th>Saldo próx.</th>
              </tr>
            </thead>
            <tbody>
              {rows.length ? (
                rows.map((row, idx) => {
                  const saldoRowTone = Number(row.saldoProximo || 0) >= 0 ? "is-positive" : "is-negative";
                  return (
                    <tr key={`${row.matricula || row.nome}-${idx}`}>
                      <td>
                        <strong>{row.nome}</strong>
                        {row.filial ? <em>{row.filial}</em> : null}
                      </td>
                      <td>{row.matricula || "—"}</td>
                      <td>{row.cargo || "—"}</td>
                      <td>{row.ocorrencias}</td>
                      <td>{fmtHMReadable(row.saldoAnterior)}</td>
                      <td>{fmtHMReadable(row.credito)}</td>
                      <td>{fmtHMReadable(row.debito)}</td>
                      <td className={saldoRowTone}>{fmtHMReadable(Math.abs(Number(row.saldoProximo || 0)))}</td>
                    </tr>
                  );
                })
              ) : (
                <tr>
                  <td colSpan={8} className="pb-bh-modal__empty">Nenhum colaborador encontrado para este departamento.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function BancoHorasCard({ stats, onOpenDepartamento, onOpenKpi }) {
  const [topMode, setTopMode] = useState("positive");
  const saldo = Number(stats?.saldoProximo ?? stats?.saldo) || 0;
  const hasData = Number(stats?.ocorrencias) > 0;
  const saldoTone = saldo > 0 ? "positive" : saldo < 0 ? "negative" : "neutral";
  const saldoLabel = saldo > 0 ? "saldo positivo" : saldo < 0 ? "saldo negativo" : "sem saldo";
  const saldoAnterior = Number(stats?.saldoAnterior || 0);
  const saldoAnteriorKnown = stats?.saldoAnteriorKnown !== false;
  const credito = Number(stats?.credito || 0);
  const debito = Number(stats?.debito || 0);
  const movimento = credito - debito;
  const movimentoTone = movimento > 0 ? "positive" : movimento < 0 ? "negative" : "neutral";
  const canOpenKpi = hasData && typeof onOpenKpi === "function";
  const openKpi = (kpi) => {
    if (!canOpenKpi) return;
    onOpenKpi(kpi);
  };
  const topPositivos = Array.isArray(stats?.topDepartamentosPositivos)
    ? stats.topDepartamentosPositivos
    : (Array.isArray(stats?.topDepartamentos) ? stats.topDepartamentos : []).filter((item) => Number(item?.saldoProximo || 0) > 0);
  const topNegativos = Array.isArray(stats?.topDepartamentosNegativos)
    ? stats.topDepartamentosNegativos
    : (Array.isArray(stats?.topDepartamentos) ? stats.topDepartamentos : []).filter((item) => Number(item?.saldoProximo || 0) < 0);
  const topDepartamentos = (topMode === "negative" ? topNegativos : topPositivos).slice(0, 10);
  const maxTopSaldo = Math.max(1, ...topDepartamentos.map((item) => Number(item.saldoAbs || 0)));
  const canOpenDepartamento = typeof onOpenDepartamento === "function";

  return (
    <div className={`pb-cell pb-banco-horas pb-banco-horas--${saldoTone}`} aria-label="Banco de horas">
      <div className="pb-kpi-head">
        <div className="pb-trend-head-l">
          <strong>Banco de Horas</strong>
        </div>
      </div>

      <div className="pb-banco-hero">
        <button
          type="button"
          className={`pb-banco-kpi${canOpenKpi ? " is-clickable" : ""}`}
          onClick={() => openKpi("saldo_proximo")}
          title={canOpenKpi ? "Ver colaboradores com saldo próximo" : undefined}
          disabled={!canOpenKpi}
        >
          <span>Saldo próximo</span>
          <strong>{hasData ? fmtHMReadable(Math.abs(saldo)) : "0 h"}</strong>
          <em>{hasData ? saldoLabel : "aguardando lançamentos"}</em>
        </button>
        <button
          type="button"
          className={`pb-banco-kpi pb-banco-mov pb-banco-mov--${movimentoTone}${canOpenKpi ? " is-clickable" : ""}`}
          onClick={() => openKpi("movimento")}
          title={canOpenKpi ? "Ver colaboradores com movimento no período" : undefined}
          disabled={!canOpenKpi}
        >
          <span>Movimento</span>
          <strong>
            {movimento > 0 ? "+" : movimento < 0 ? "-" : ""}
            {fmtHMReadable(Math.abs(movimento))}
          </strong>
          <em>créditos - débitos</em>
        </button>
      </div>

      <div className="pb-banco-main">
        <button
          type="button"
          className={`pb-banco-kpi pb-banco-metric${canOpenKpi ? " is-clickable" : ""}`}
          onClick={() => openKpi("saldo_anterior")}
          title={canOpenKpi ? "Ver colaboradores com saldo anterior" : undefined}
          disabled={!canOpenKpi}
        >
          <span>Saldo anterior</span>
          <strong>{hasData && saldoAnteriorKnown ? fmtHMReadable(saldoAnterior) : "Não informado"}</strong>
          <em>
            {hasData
              ? saldoAnteriorKnown
                ? "saldo antes do período"
                : "importe a planilha de banco de horas"
              : "não foram identificados eventos de banco de horas"}
          </em>
        </button>
        <div className="pb-banco-op" aria-hidden="true">+</div>
        <button
          type="button"
          className={`pb-banco-kpi pb-banco-metric${canOpenKpi ? " is-clickable" : ""}`}
          onClick={() => openKpi("credito")}
          title={canOpenKpi ? "Ver colaboradores com crédito" : undefined}
          disabled={!canOpenKpi}
        >
          <span>Crédito</span>
          <strong>{fmtHMReadable(credito)}</strong>
        </button>
        <div className="pb-banco-op" aria-hidden="true">-</div>
        <button
          type="button"
          className={`pb-banco-kpi pb-banco-metric${canOpenKpi ? " is-clickable" : ""}`}
          onClick={() => openKpi("debito")}
          title={canOpenKpi ? "Ver colaboradores com débito" : undefined}
          disabled={!canOpenKpi}
        >
          <span>Débito</span>
          <strong>{fmtHMReadable(debito)}</strong>
        </button>
      </div>

      <div className="pb-banco-top">
        <div className="pb-banco-top-head">
          <span>Top 10 saldos</span>
          <div className="pb-banco-top-tabs" role="tablist" aria-label="Tipo de saldo">
            <button
              type="button"
              className={topMode === "positive" ? "is-active" : ""}
              onClick={() => setTopMode("positive")}
              role="tab"
              aria-selected={topMode === "positive"}
            >
              Positivos
            </button>
            <button
              type="button"
              className={topMode === "negative" ? "is-active" : ""}
              onClick={() => setTopMode("negative")}
              role="tab"
              aria-selected={topMode === "negative"}
            >
              Negativos
            </button>
          </div>
        </div>
        <div className="pb-banco-top-list" role="list">
          {topDepartamentos.length ? (
            topDepartamentos.map((item, idx) => {
              const itemSaldo = Number(item.saldoProximo || 0);
              const rowTone = itemSaldo >= 0 ? "positive" : "negative";
              const pct = Math.max(4, Math.round((Number(item.saldoAbs || 0) / maxTopSaldo) * 100));
              return (
                <button
                  type="button"
                  key={`${item.label}-${idx}`}
                  className={`pb-banco-top-row pb-banco-top-row--${rowTone}${canOpenDepartamento ? " is-clickable" : ""}`}
                  role="listitem"
                  onClick={() => canOpenDepartamento && onOpenDepartamento(item)}
                  title={canOpenDepartamento ? `Abrir colaboradores de ${item.label}` : undefined}
                >
                  <span className="pb-banco-top-rank">{idx + 1}</span>
                  <span className="pb-banco-top-main">
                    <span className="pb-banco-top-name">{item.label}</span>
                    <span className="pb-banco-top-bar" aria-hidden="true">
                      <span style={{ width: `${pct}%` }} />
                    </span>
                  </span>
                  <span className="pb-banco-top-val">
                    {itemSaldo < 0 ? "-" : ""}
                    {fmtHMReadable(Math.abs(itemSaldo))}
                  </span>
                </button>
              );
            })
          ) : (
            <div className="pb-banco-top-empty">
              {topMode === "negative" ? "Sem saldos negativos no período." : "Sem saldos positivos no período."}
            </div>
          )}
        </div>
      </div>

    </div>
  );
}

function MensalCard({ data = null }) {
  const hasData = Number(data?.eventCount || 0) > 0;
  const mensalTitle = hasData ? "Totalização importada por mês" : "Totalização do último período encerrado";
  const mensalCards = hasData
    ? [
        {
          label: "Eventos",
          value: data.eventCount.toLocaleString("pt-BR"),
          hint: "eventos importados",
        },
        {
          label: "Meses",
          value: data.months.length.toLocaleString("pt-BR"),
          hint: `${data.months[0]} até ${data.months[data.months.length - 1]}`,
        },
        {
          label: "Total",
          value: fmtHMReadable(data.total || 0),
          hint: "soma geral da planilha",
        },
      ]
    : [
        { label: "Consulta", value: "Mês a mês", hint: "Marque os períodos a serem consultados." },
        { label: "Eventos", value: "Drill por colaborador", hint: "Ao clicar no evento, lista os colaboradores associados." },
        { label: "Exportação", value: "Excel", hint: "Gera arquivo para análise externa." },
      ];
  return (
    <div className="pb-cell pb-mensal" aria-label="Fechamento Mensal">
      <div className="pb-mensal-head">
        <div className="pb-mensal-title">
          <span className="pb-label">Fechamento Mensal</span>
          <strong>{mensalHeaderTitle}</strong>
        </div>
      </div>

      <div className="pb-mensal-main">
        {mensalCards.map((item) => (
          <div className="pb-mensal-item" key={item.label}>
            <span>{item.label}</span>
            <strong>{item.value}</strong>
            <em>{item.hint}</em>
          </div>
        ))}
      </div>
    </div>
  );
}

function AuditoriaPontoPanel({ summary, onOpen, onOpenParams, opening = false, inline = false }) {
  const data = summary || {};
  const total = Number(data.total || 0);
  const pendente = Number(data.pendente || 0);
  const critica = Number(data.critica || 0);
  const alta = Number(data.alta || 0);
  const tratadoPct = Number(data.tratadoPct || 0);
  const topDeptos = Array.isArray(data.topDeptos) ? data.topDeptos : [];
  const riskTone = critica > 0 ? "critica" : alta > 0 ? "alta" : pendente > 0 ? "media" : "ok";

  return (
    <section
      className={`${inline ? "pb-audit-inline" : "pb-cell pb-auditoria-ponto"} pb-auditoria-ponto--${riskTone}`}
      aria-label="Auditoria de ponto"
    >
      <div className="pb-audit-panel-head">
        <div>
          <span className="pb-label">Auditoria de ponto</span>
          <strong>{pendente > 0 ? `${pendente.toLocaleString("pt-BR")} pendencia${pendente === 1 ? "" : "s"}` : "Sem pendencias"}</strong>
          <em>
            {total > 0
              ? `${total.toLocaleString("pt-BR")} evento${total === 1 ? "" : "s"} com regra acionada`
              : "Nenhuma anomalia no periodo filtrado"}
          </em>
        </div>
        <div className="pb-audit-panel-actions">
          <button type="button" className="pb-btn" onClick={onOpenParams}>
            Parametros
          </button>
          <button
            type="button"
            className="pb-btn pb-btn-primary"
            onClick={onOpen}
            disabled={!data.totalEventos || opening}
            aria-busy={opening ? "true" : undefined}
          >
            {opening ? "Processando..." : "Abrir auditoria"}
          </button>
        </div>
      </div>

      <div className="pb-audit-kpis">
        <span className="is-critica">
          <b>Criticas</b>
          <strong>{critica.toLocaleString("pt-BR")}</strong>
        </span>
        <span className="is-alta">
          <b>Altas</b>
          <strong>{alta.toLocaleString("pt-BR")}</strong>
        </span>
        <span>
          <b>Ajustes folha</b>
          <strong>{Number(data.ajuste || 0).toLocaleString("pt-BR")}</strong>
        </span>
        <span>
          <b>Tratado</b>
          <strong>{tratadoPct}%</strong>
        </span>
      </div>

      <div className="pb-audit-progress" aria-label={`Tratado ${tratadoPct}%`}>
        <span style={{ width: `${Math.max(0, Math.min(100, tratadoPct))}%` }} />
      </div>

      <div className="pb-audit-panel-body">
        <div className="pb-audit-main-risk">
          <b>Maior risco</b>
          {data.principal ? (
            <>
              <strong>{data.principal.observacao || data.principal.severidade}</strong>
              <span>
                {data.principal.departamento}
                {data.principal.colaborador ? ` - ${data.principal.colaborador}` : ""}
              </span>
            </>
          ) : (
            <span>Sem risco pendente no filtro atual.</span>
          )}
        </div>

        <div className="pb-audit-dept-list">
          <b>Departamentos em atencao</b>
          {topDeptos.length ? (
            topDeptos.slice(0, inline ? 3 : topDeptos.length).map((row) => (
              <button
                type="button"
                key={row.label}
                onClick={onOpen}
                title={`Abrir auditoria de ${row.label}`}
                disabled={opening}
                aria-busy={opening ? "true" : undefined}
              >
                <span>{row.label}</span>
                <strong>{opening ? "..." : Number(row.pendente || row.total || 0).toLocaleString("pt-BR")}</strong>
              </button>
            ))
          ) : (
            <span className="pb-audit-empty">Sem departamentos com pendencias.</span>
          )}
        </div>
      </div>
    </section>
  );
}

function AuditoriaPontoParamsPanel({ open, value, onChange, onClose, onSave, onReset }) {
  const config = normalizeAuditoriaParamsConfig(value);
  const disabledSet = new Set(config.regrasDesativadas || []);
  const totalRules = REGRAS_AUDITORIA_PONTO_META.length;
  const customRules = Array.isArray(config.regrasCustomizadas) ? config.regrasCustomizadas : [];
  const activeRules = totalRules - disabledSet.size + customRules.filter((rule) => rule.ativo !== false).length;
  const [rect, setRect] = useState(() => ({
    width: Math.min(1240, Math.max(860, (typeof window !== "undefined" ? window.innerWidth : 1280) - 96)),
    height: Math.min(820, Math.max(620, (typeof window !== "undefined" ? window.innerHeight : 900) - 96)),
    left: 32,
    top: 72,
  }));
  const dragRef = useRef(null);

  useEffect(() => {
    if (!open || typeof window === "undefined") return;
    setRect((current) => {
      const width = Math.min(current.width, window.innerWidth - 32);
      const height = Math.min(current.height, window.innerHeight - 32);
      return {
        width,
        height,
        left: Math.max(16, Math.min(current.left, window.innerWidth - width - 16)),
        top: Math.max(24, Math.min(current.top, window.innerHeight - height - 16)),
      };
    });
  }, [open]);

  useEffect(() => {
    if (!open) return undefined;
    const onMove = (ev) => {
      const action = dragRef.current;
      if (!action || typeof window === "undefined") return;
      ev.preventDefault();
      const dx = ev.clientX - action.x;
      const dy = ev.clientY - action.y;
      if (action.type === "drag") {
        setRect((current) => ({
          ...current,
          left: Math.max(8, Math.min(window.innerWidth - current.width - 8, action.left + dx)),
          top: Math.max(16, Math.min(window.innerHeight - current.height - 8, action.top + dy)),
        }));
      } else {
        setRect((current) => ({
          ...current,
          width: Math.max(760, Math.min(window.innerWidth - current.left - 8, action.width + dx)),
          height: Math.max(520, Math.min(window.innerHeight - current.top - 8, action.height + dy)),
        }));
      }
    };
    const onUp = () => {
      dragRef.current = null;
    };
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
    return () => {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
    };
  }, [open]);

  const updateNumber = (key, rawValue) => {
    const next = Math.max(0, Math.round(Number(rawValue) || 0));
    onChange({ ...config, [key]: next });
  };
  const toggleRule = (ruleId) => {
    const next = new Set(disabledSet);
    if (next.has(ruleId)) next.delete(ruleId);
    else next.add(ruleId);
    onChange({ ...config, regrasDesativadas: [...next] });
  };
  const activateAll = () => onChange({ ...config, regrasDesativadas: [] });
  const deactivateAll = () =>
    onChange({
      ...config,
      regrasDesativadas: REGRAS_AUDITORIA_PONTO_META.map((rule) => rule.id),
    });
  const updateCustomRule = (ruleId, patch) => {
    onChange({
      ...config,
      regrasCustomizadas: customRules.map((rule) => (rule.id === ruleId ? { ...rule, ...patch } : rule)),
    });
  };
  const addCustomRule = () => {
    onChange({
      ...config,
      regrasCustomizadas: [
        ...customRules,
        {
          id: `CUSTOM_${Date.now()}`,
          titulo: "Nova regra da empresa",
          campo: "evento",
          operador: "contem",
          valor: "",
          severidade: "media",
          mensagem: "",
          ativo: true,
        },
      ],
    });
  };
  const removeCustomRule = (ruleId) => {
    onChange({ ...config, regrasCustomizadas: customRules.filter((rule) => rule.id !== ruleId) });
  };
  const startDrag = (ev) => {
    if (ev.button !== 0) return;
    dragRef.current = { type: "drag", x: ev.clientX, y: ev.clientY, left: rect.left, top: rect.top };
  };
  const startResize = (ev) => {
    if (ev.button !== 0) return;
    ev.preventDefault();
    dragRef.current = { type: "resize", x: ev.clientX, y: ev.clientY, width: rect.width, height: rect.height };
  };

  if (!open || typeof document === "undefined") return null;

  return createPortal(
    <div className="pb-audit-params-backdrop" role="dialog" aria-modal="true" aria-label="Parametros de auditoria">
      <section
        className="pb-audit-params-modal"
        style={{ width: `${rect.width}px`, height: `${rect.height}px`, left: `${rect.left}px`, top: `${rect.top}px` }}
      >
        <header className="pb-audit-params-head" onMouseDown={startDrag}>
          <div>
            <h3>Parametros da auditoria de ponto</h3>
            <p>
              {activeRules.toLocaleString("pt-BR")} regra(s) ativa(s): {totalRules.toLocaleString("pt-BR")} nativas e{" "}
              {customRules.length.toLocaleString("pt-BR")} da empresa.
            </p>
          </div>
          <button type="button" className="pb-icon-btn" onClick={onClose} onMouseDown={(ev) => ev.stopPropagation()} aria-label="Fechar parametros">
            X
          </button>
        </header>

        <div className="pb-audit-params-body">
          <section className="pb-audit-params-help">
            <strong>Como a auditoria e feita</strong>
            <p>
              Para cada evento, o motor normaliza horario planejado e marcacoes, pareia os horarios, aplica os
              parametros abaixo e executa somente as regras ativas. Cada anomalia guarda regra, parametros vigentes,
              evidencias e memoria de calculo para justificar a conclusao.
            </p>
          </section>

          <section className="pb-audit-params-section">
            <div className="pb-audit-params-section-head">
              <strong>Parametros numericos</strong>
              <span>Usados no calculo das anomalias.</span>
            </div>
            <div className="pb-audit-params-grid">
              {AUDITORIA_PARAM_FIELDS.map((field) => (
                <label key={field.key} className="pb-audit-param-field">
                  <span>{field.label}</span>
                  <div>
                    <input
                      type="number"
                      min="0"
                      value={Number(config[field.key] || 0)}
                      onChange={(ev) => updateNumber(field.key, ev.target.value)}
                    />
                    <em>{field.suffix}</em>
                  </div>
                  <small>{field.desc}</small>
                </label>
              ))}
            </div>
          </section>

          <section className="pb-audit-params-section">
            <div className="pb-audit-params-section-head pb-audit-params-section-head--rules">
              <div>
                <strong>Regras da auditoria</strong>
                <span>Desative apenas regras que nao se aplicam ao acordo, CCT ou politica interna.</span>
              </div>
              <div className="pb-audit-rule-actions">
                <button type="button" className="pb-audit-action-btn" onClick={activateAll}>
                  Ativar todas
                </button>
                <button type="button" className="pb-audit-action-btn pb-audit-action-btn--danger" onClick={deactivateAll}>
                  Desativar todas
                </button>
              </div>
            </div>
            <div className="pb-audit-rules-list">
              {REGRAS_AUDITORIA_PONTO_META.map((rule) => {
                const disabled = disabledSet.has(rule.id);
                return (
                  <article
                    key={rule.id}
                    className={`pb-audit-rule-row pb-audit-rule-row--${rule.severidadePadrao}${disabled ? " is-disabled" : ""}`}
                  >
                    <label className="pb-audit-rule-switch">
                      <input
                        type="checkbox"
                        checked={!disabled}
                        onChange={() => toggleRule(rule.id)}
                        aria-label={`Ativar regra ${rule.titulo}`}
                      />
                    </label>
                    <span>
                      <strong>{rule.titulo}</strong>
                      <small>{AUDITORIA_RULE_HELP[rule.categoria] || AUDITORIA_RULE_HELP.operacional}</small>
                      <em>
                        {rule.categoria} · {rule.severidadePadrao} · {rule.id}
                      </em>
                    </span>
                    <b>{disabled ? "Inativa" : "Ativa"}</b>
                  </article>
                );
              })}
            </div>
          </section>

          <section className="pb-audit-params-section">
            <div className="pb-audit-params-section-head pb-audit-params-section-head--rules">
              <div>
                <strong>Regras especificas da empresa</strong>
                <span>Crie regras simples para sua realidade, CCT ou politica interna. Elas entram na mesma auditoria.</span>
              </div>
              <button type="button" className="pb-audit-action-btn pb-audit-action-btn--primary" onClick={addCustomRule}>
                Nova regra
              </button>
            </div>
            <div className="pb-audit-custom-rules">
              {customRules.length ? (
                customRules.map((rule) => (
                  <article key={rule.id} className="pb-audit-custom-rule">
                    <div className="pb-audit-custom-rule-head">
                      <label>
                        <input
                          type="checkbox"
                          checked={rule.ativo !== false}
                          onChange={(ev) => updateCustomRule(rule.id, { ativo: ev.target.checked })}
                        />
                        Ativa
                      </label>
                      <select value={rule.severidade} onChange={(ev) => updateCustomRule(rule.id, { severidade: ev.target.value })}>
                        <option value="critica">Critica</option>
                        <option value="alta">Alta</option>
                        <option value="media">Media</option>
                        <option value="baixa">Baixa</option>
                      </select>
                      <button type="button" className="pb-audit-action-btn pb-audit-action-btn--danger" onClick={() => removeCustomRule(rule.id)}>
                        Remover
                      </button>
                    </div>
                    <label>
                      <span>Nome da regra</span>
                      <input
                        value={rule.titulo}
                        onChange={(ev) => updateCustomRule(rule.id, { titulo: ev.target.value })}
                        placeholder="Ex.: Extra acima do acordo local"
                      />
                    </label>
                    <div className="pb-audit-custom-rule-grid">
                      <label>
                        <span>Campo avaliado</span>
                        <select value={rule.campo} onChange={(ev) => updateCustomRule(rule.id, { campo: ev.target.value })}>
                          {AUDITORIA_CUSTOM_RULE_FIELDS.map((field) => (
                            <option key={field.value} value={field.value}>
                              {field.label}
                            </option>
                          ))}
                        </select>
                      </label>
                      <label>
                        <span>Operador</span>
                        <select value={rule.operador} onChange={(ev) => updateCustomRule(rule.id, { operador: ev.target.value })}>
                          {AUDITORIA_CUSTOM_RULE_OPERATORS.map((operator) => (
                            <option key={operator.value} value={operator.value}>
                              {operator.label}
                            </option>
                          ))}
                        </select>
                      </label>
                      <label>
                        <span>Valor de comparacao</span>
                        <input
                          value={rule.valor}
                          onChange={(ev) => updateCustomRule(rule.id, { valor: ev.target.value })}
                          placeholder={rule.campo === "horas" ? "480" : "texto a localizar"}
                        />
                      </label>
                    </div>
                    <label>
                      <span>Mensagem exibida quando acionar</span>
                      <input
                        value={rule.mensagem}
                        onChange={(ev) => updateCustomRule(rule.id, { mensagem: ev.target.value })}
                        placeholder="Explique a pendencia para quem vai revisar."
                      />
                    </label>
                    <small>
                      Como usa: se o campo escolhido atender ao operador e ao valor, a auditoria cria uma anomalia com a severidade configurada.
                    </small>
                  </article>
                ))
              ) : (
                <p className="pb-audit-custom-empty">Nenhuma regra especifica criada.</p>
              )}
            </div>
          </section>
        </div>

        <footer className="pb-audit-params-foot">
          <button type="button" className="pb-audit-action-btn pb-audit-action-btn--ghost" onClick={onReset}>
            Restaurar padrao
          </button>
          <span>{disabledSet.size ? `${disabledSet.size} regra(s) nativa(s) desativada(s)` : "Todas as regras nativas ativas"}</span>
          <button type="button" className="pb-audit-action-btn" onClick={onClose}>
            Cancelar
          </button>
          <button type="button" className="pb-audit-action-btn pb-audit-action-btn--save" onClick={onSave}>
            Salvar parametros
          </button>
        </footer>
        <span className="pb-audit-params-resize" onMouseDown={startResize} aria-hidden="true" />
      </section>
    </div>,
    document.body,
  );
}

function AuditoriaPontoWorkspace({ summary, periodLabel, onOpenDetails, onOpenParams, onClose, opening = false }) {
  const data = summary || {};
  const total = Number(data.total || 0);
  const pendente = Number(data.pendente || 0);
  const critica = Number(data.critica || 0);
  const alta = Number(data.alta || 0);
  const ajuste = Number(data.ajuste || 0);
  const tratadoPct = Number(data.tratadoPct || 0);
  const totalEventos = Number(data.totalEventos || 0);
  const topDeptos = Array.isArray(data.topDeptos) ? data.topDeptos : [];
  const riskItems = [
    { label: "Criticas", value: critica, tone: "critica", hint: "exigem revisao imediata" },
    { label: "Altas", value: alta, tone: "alta", hint: "risco operacional/folha" },
    { label: "Pendentes", value: pendente, tone: "pendente", hint: "sem tratamento registrado" },
    { label: "Ajustes folha", value: ajuste, tone: "ajuste", hint: "marcados para correcao" },
  ];

  return (
    <section className="pb-audit-workspace" aria-label="Painel executivo de auditoria de ponto">
      <div className="pb-audit-workspace-head">
        <div>
          <span className="pb-label">Auditoria de ponto</span>
          <h3>Painel executivo</h3>
          <p>
            {periodLabel || "Periodo atual"} · {totalEventos.toLocaleString("pt-BR")} evento
            {totalEventos === 1 ? "" : "s"} analisado{totalEventos === 1 ? "" : "s"}
          </p>
        </div>
        <div className="pb-audit-workspace-actions">
          <button type="button" className="pb-btn" onClick={onOpenParams}>
            Parametros
          </button>
          <button
            type="button"
            className="pb-btn pb-btn-primary"
            onClick={onOpenDetails}
            disabled={!totalEventos || opening}
            aria-busy={opening ? "true" : undefined}
          >
            {opening ? "Processando..." : "Abrir grade"}
          </button>
          <button type="button" className="pb-btn" onClick={onClose}>
            Voltar
          </button>
        </div>
      </div>

      <div className="pb-audit-workspace-hero">
        <div className="pb-audit-workspace-score">
          <span>Fila de risco</span>
          <strong>{pendente.toLocaleString("pt-BR")}</strong>
          <em>{total ? `${total.toLocaleString("pt-BR")} anomalias detectadas` : "sem anomalias no filtro"}</em>
          <div className="pb-audit-workspace-progress" aria-label={`Tratado ${tratadoPct}%`}>
            <span style={{ width: `${Math.max(0, Math.min(100, tratadoPct))}%` }} />
          </div>
          <small>{tratadoPct}% tratado</small>
        </div>
        <div className="pb-audit-workspace-kpis">
          {riskItems.map((item) => (
            <button
              type="button"
              key={item.label}
              className={`pb-audit-workspace-kpi is-${item.tone}`}
              onClick={onOpenDetails}
              disabled={!totalEventos || opening}
            >
              <span>{item.label}</span>
              <strong>{item.value.toLocaleString("pt-BR")}</strong>
              <em>{item.hint}</em>
            </button>
          ))}
        </div>
      </div>

      <div className="pb-audit-workspace-grid">
        <div className="pb-audit-workspace-card pb-audit-workspace-main-risk">
          <span className="pb-label">Maior risco</span>
          {data.principal ? (
            <>
              <strong>{data.principal.observacao || data.principal.severidade}</strong>
              <p>
                {data.principal.departamento || "Sem departamento"}
                {data.principal.colaborador ? ` · ${data.principal.colaborador}` : ""}
              </p>
              <button type="button" className="pb-btn pb-btn-primary" onClick={onOpenDetails} disabled={opening}>
                Ver evidencias
              </button>
            </>
          ) : (
            <p>Sem risco pendente no periodo filtrado.</p>
          )}
        </div>

        <div className="pb-audit-workspace-card">
          <span className="pb-label">Departamentos criticos</span>
          <div className="pb-audit-workspace-ranking">
            {topDeptos.length ? (
              topDeptos.slice(0, 8).map((row, idx) => (
                <button type="button" key={row.label} onClick={onOpenDetails} disabled={opening}>
                  <span className="pb-audit-rank">{idx + 1}</span>
                  <span className="pb-audit-rank-name">{row.label}</span>
                  <strong>{Number(row.pendente || row.total || 0).toLocaleString("pt-BR")}</strong>
                </button>
              ))
            ) : (
              <p>Sem departamentos com pendencias.</p>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}

function MensalListCard({ data = null, onOpenEvent = null, periodoApuracao = null }) {
  const hasData = Number(data?.eventCount || 0) > 0;
  const months = Array.isArray(data?.months) ? data.months : [];
  const [viewMode, setViewMode] = useState("periodo");
  const pickDefaultMonths = (items) => (Array.isArray(items) ? items.slice(-2) : []);
  const [selectedMonths, setSelectedMonths] = useState(() => pickDefaultMonths(months));
  const [periodSelectorOpen, setPeriodSelectorOpen] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const [eventSortDir, setEventSortDir] = useState("asc");

  useEffect(() => {
    setSelectedMonths(pickDefaultMonths(months));
  }, [months.join("|")]);

  useEffect(() => {
    if (viewMode !== "consulta") setPeriodSelectorOpen(false);
  }, [viewMode]);

  useEffect(() => {
    if (!expanded) return undefined;
    const onKeyDown = (event) => {
      if (event.key === "Escape") setExpanded(false);
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [expanded]);

  const mensalPeriod = hasData && months.length ? `${months[0]} até ${months[months.length - 1]}` : "";
  const mensalTitle = hasData ?
     `${data.eventCount.toLocaleString("pt-BR")} evento${data.eventCount !== 1 ? "s" : ""}${mensalPeriod ? ` - ${mensalPeriod}` : ""}`
    : "Totalização do último período encerrado";
  const mensalHeaderTitle = hasData ?
     `${data.eventCount.toLocaleString("pt-BR")} evento${data.eventCount !== 1 ? "s" : ""}`
    : mensalTitle;
  const selectedPeriod = useMemo(() => {
    const selectedInOrder = months.filter((month) => selectedMonths.includes(month));
    if (!selectedInOrder.length) return "";
    return selectedInOrder.length === 1
      ? selectedInOrder[0]
      : `${selectedInOrder[0]} até ${selectedInOrder[selectedInOrder.length - 1]}`;
  }, [months, selectedMonths]);
  const apuracaoPeriod =
    periodoApuracao?.de && periodoApuracao?.ate
      ? `${fmtDateBr(periodoApuracao.de)} até ${fmtDateBr(periodoApuracao.ate)}`
      : "";
  const mensalHeaderPeriod = apuracaoPeriod
    ? `Período de apuração: ${apuracaoPeriod}`
    : mensalPeriod
      ? `Período de apuração: ${mensalPeriod}`
      : "Período de apuração aguardando API";
  const consultaHeaderPeriod = apuracaoPeriod
    ? `Período de apuração: ${apuracaoPeriod}`
    : selectedPeriod
      ? `Período de apuração: ${selectedPeriod}`
      : "Período de apuração: nenhum mês selecionado";
  const mensalCards = [
    { label: "Consulta", value: "Mês a mês", hint: "Marque os períodos a serem consultados." },
    { label: "Eventos", value: "Drill por colaborador", hint: "Ao clicar no evento, lista os colaboradores associados." },
    { label: "Exportação", value: "Excel", hint: "Gera arquivo para análise externa." },
  ];
  const splitEventLabel = (value) => {
    const raw = String(value || "").trim();
    const match = raw.match(/^(\d+[A-Z]?)\s*[-–—]\s*(.+)$/i);
    if (!match) return { code: "", description: raw };
    return { code: match[1].trim(), description: match[2].trim() };
  };
  const normalizeEventForCategory = (value) =>
    String(value || "")
      .trim()
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-z0-9]+/g, " ")
      .replace(/\s+/g, " ")
      .trim();
  const monthlyCategoryConfig = useMemo(() => {
    const labels = {
      presentes: "Presença",
      extras: "H.Extras / B.Horas",
      ausentes: "Ausências",
      justificadas: "Justificadas / Abonadas",
      noturnas: "Horas noturnas",
      risco: "Risco / adicionais",
      ignorar: "Ignorados",
      outros: "Outros eventos",
    };
    const order = {
      presentes: 10,
      extras: 20,
      ausentes: 30,
      justificadas: 40,
      noturnas: 50,
      risco: 60,
      ignorar: 90,
      outros: 99,
    };
    loadHourCategories().forEach((col, idx) => {
      labels[col.value] = col.label;
      if (order[col.value] == null) order[col.value] = 70 + idx;
    });
    const map = new Map();
    (Array.isArray(loadEventCategories?.()) ? loadEventCategories() : []).forEach((item) => {
      const category = item?.category || "outros";
      const name = normalizeEventForCategory(item?.name);
      if (!name) return;
      map.set(name, category);
      const nameWithoutCode = name.replace(/^\d+[a-z]?\s+/, "").trim();
      if (nameWithoutCode) map.set(nameWithoutCode, category);
    });
    return { labels, order, map };
  }, []);
  const getMonthlyRowCategory = (row) => {
    const label = splitEventLabel(row?.event);
    const raw = normalizeEventForCategory(row?.event);
    const description = normalizeEventForCategory(label.description);
    const category =
      monthlyCategoryConfig.map.get(raw) ||
      monthlyCategoryConfig.map.get(description) ||
      (/noturn/.test(description) ? "noturnas" : "") ||
      (/periculos|insalubr|risco/.test(description) ? "risco" : "") ||
      (/extra|banco|plantao|sobreaviso/.test(description) ? "extras" : "") ||
      (/falta|atras|ausenc|saida antecip/.test(description) ? "ausentes" : "") ||
      (/atestado|licenc|ferias|feriado|folga|abono|afast/.test(description) ? "justificadas" : "") ||
      (/presenc|normal|trabalh/.test(description) ? "presentes" : "") ||
      "outros";
    return {
      key: category,
      label: monthlyCategoryConfig.labels[category] || monthlyCategoryConfig.labels.outros,
      order: monthlyCategoryConfig.order[category] ?? monthlyCategoryConfig.order.outros,
    };
  };
  const sortMensalRows = (rows) =>
    [...(rows || [])].sort((a, b) => {
      const catA = getMonthlyRowCategory(a);
      const catB = getMonthlyRowCategory(b);
      if (catA.order !== catB.order) return catA.order - catB.order;
      const labelA = splitEventLabel(a.event);
      const labelB = splitEventLabel(b.event);
      const codeA = Number(String(labelA.code || "").match(/\d+/)?.[0] || 0);
      const codeB = Number(String(labelB.code || "").match(/\d+/)?.[0] || 0);
      const textCompare = String(labelA.description || "").localeCompare(String(labelB.description || ""), "pt-BR", {
        sensitivity: "base",
        numeric: true,
      });
      const dir = eventSortDir === "desc" ? -1 : 1;
      return (textCompare || codeA - codeB) * dir || (Number(b.total) || 0) - (Number(a.total) || 0);
    });
  const mensalRows = hasData ? sortMensalRows(data.rows || []) : [];
  const selectedSet = useMemo(() => new Set(selectedMonths), [selectedMonths]);
  const activeMonths = viewMode === "consulta" ? months.filter((month) => selectedSet.has(month)) : months;
  const matrixColumns = `260px ${activeMonths.map(() => "94px 82px").join(" ")} 124px`;
  const matrixWidth = 260 + (activeMonths.length * 176) + 124;
  const matrixStyle = viewMode === "consulta"
    ? { gridTemplateColumns: matrixColumns, minWidth: `${matrixWidth}px` }
    : undefined;
  const consultaRows = hasData
    ? sortMensalRows(
        [...(data.rows || [])]
        .map((row) => ({
          ...row,
          total: months
            .filter((month) => selectedSet.has(month))
            .reduce((sum, month) => sum + (Number(row.byMonth?.[month]) || 0), 0),
        }))
        .filter((row) => Number(row.total || 0) !== 0),
      )
    : [];
  const visibleRows = viewMode === "consulta" ? consultaRows : mensalRows;
  const consultaTotal = consultaRows.reduce((sum, row) => sum + (Number(row.total) || 0), 0);
  const periodTotal = mensalRows.reduce((sum, row) => sum + (Number(row.total) || 0), 0);
  const visibleTotal = viewMode === "consulta" ? consultaTotal : periodTotal;
  const consultaLabel = selectedMonths.length ?
     `${selectedMonths.length} de ${months.length} mês${months.length !== 1 ? "es" : ""}`
    : "nenhum mês selecionado";
  const toggleMonth = (month) => {
    setSelectedMonths((current) =>
      current.includes(month) ? current.filter((item) => item !== month) : [...current, month],
    );
  };
  const toggleEventSort = () => {
    setEventSortDir((value) => (value === "asc" ? "desc" : "asc"));
  };
  const formatMonthHead = (value) => {
    const raw = String(value || "").trim();
    const match = raw.match(/^(\d{1,2})\/(\d{4})$/);
    if (!match) return raw.toLocaleUpperCase("pt-BR");
    const names = ["JAN", "FEV", "MAR", "ABR", "MAI", "JUN", "JUL", "AGO", "SET", "OUT", "NOV", "DEZ"];
    const monthIndex = Math.max(0, Math.min(11, Number(match[1]) - 1));
    return `${names[monthIndex]}/${match[2].slice(-2)}`;
  };
  const calcMonthVariation = (row, monthIndex) => {
    if (monthIndex <= 0) {
      return { kind: "base", arrow: "", text: "", title: "Primeiro período visível", highlight: false };
    }
    const month = activeMonths[monthIndex];
    const previousMonth = activeMonths[monthIndex - 1];
    const current = Number(row.byMonth?.[month]) || 0;
    const previous = Number(row.byMonth?.[previousMonth]) || 0;
    if (!previous && !current) {
      return { kind: "flat", arrow: "→", text: "0,0%", title: "Sem variação no período", highlight: false };
    }
    if (!previous) {
      return { kind: "lowbase", arrow: "↑", text: "base baixa", title: `Sem horas em ${previousMonth}; variação percentual não é comparável`, highlight: true };
    }
    const pct = ((current - previous) / Math.abs(previous)) * 100;
    if (Math.abs(pct) > 999) {
      return { kind: "lowbase", arrow: "↑", text: "base baixa", title: `${month} vs ${previousMonth}: base anterior muito baixa`, highlight: true };
    }
    const kind = pct > 0.049 ? "up" : pct < -0.049 ? "down" : "flat";
    const arrow = kind === "up" ? "↑" : kind === "down" ? "↓" : "→";
    const text = `${pct > 0 ? "+" : ""}${pct.toLocaleString("pt-BR", {
      minimumFractionDigits: 1,
      maximumFractionDigits: 1,
    })}%`;
    return { kind, arrow, text, title: `${month} vs ${previousMonth}: ${text}`, highlight: Math.abs(pct) >= 20 };
  };
  const eventsGridMonthLabels = activeMonths.map(formatMonthHead);
  let lastGridCategoryKey = "";
  const eventsGridRows = visibleRows.map((row) => {
    const label = splitEventLabel(row.event);
    const category = getMonthlyRowCategory(row);
    const showCategory = category.key !== lastGridCategoryKey;
    lastGridCategoryKey = category.key;
    return {
      source: row,
      name: label.description || String(row.event || ""),
      code: label.code,
      showCategory,
      categoryLabel: category.label,
      months: activeMonths.map((month, monthIndex) => {
        const variation = calcMonthVariation(row, monthIndex);
        return {
          label: formatMonthHead(month),
          hours: fmtHMMilhar(row.byMonth?.[month] || 0),
          sourceMonth: month,
          variation:
            variation.kind === "lowbase"
              ? "base baixa"
              : variation.kind === "up" || variation.kind === "down"
                ? variation.text
                : null,
        };
      }),
    };
  });
  const shouldShowSimpleCategory = (row, index) =>
    index === 0 || getMonthlyRowCategory(row).key !== getMonthlyRowCategory(visibleRows[index - 1]).key;
  return (
    <div className={`pb-cell pb-mensal ${expanded ? "pb-mensal--expanded" : ""}`} aria-label="Fechamento Mensal">
      <div className="pb-mensal-head">
        <div className="pb-mensal-title">
          <span className="pb-label">Fechamento Mensal</span>
          <em>{viewMode === "consulta" ? consultaHeaderPeriod : mensalHeaderPeriod}</em>
        </div>
        {hasData ? (
          <div className="pb-mensal-head-actions">
            <div className="pb-mensal-toolbar">
              <span className="pb-mensal-mode-label">Visualização</span>
              <div className="pb-mensal-tabs" role="tablist" aria-label="Modo de visualização mensal">
                <button
                  type="button"
                  className={viewMode === "periodo" ? "is-active" : ""}
                  onClick={() => setViewMode("periodo")}
                >
                  Período atual
                </button>
                <button
                  type="button"
                  className={viewMode === "consulta" ? "is-active" : ""}
                  onClick={() => setViewMode("consulta")}
                >
                  Períodos fechados
                </button>
              </div>
            </div>
            <button
              type="button"
              className="pb-mensal-expand-btn"
              onClick={() => {
                if (!expanded) setViewMode("consulta");
                setExpanded((value) => !value);
              }}
              aria-pressed={expanded}
              title={expanded ? "Recolher tela" : "Expandir tela"}
            >
              {expanded ? "⤡" : "⤢"}
              </button>
          </div>
        ) : null}
      </div>

      {hasData ? (
        <div className="pb-mensal-panel">
          {viewMode === "consulta" ? (
            <div className="pb-mensal-consulta">
              <div className="pb-mensal-period-selector">
                <button
                  type="button"
                  className="pb-mensal-period-btn"
                  onClick={() => setPeriodSelectorOpen((open) => !open)}
                >
                  <span>Períodos</span>
                  <b>{consultaLabel}</b>
                  <i aria-hidden="true">▾</i>
                </button>
                {periodSelectorOpen ? (
                  <div className="pb-mensal-period-popover">
                    <div className="pb-mensal-period-pop-head">
                      <strong>Selecionar períodos</strong>
                      <span>{fmtHMMilhar(consultaTotal)}</span>
                      <button
                        type="button"
                        className="pb-mensal-period-close"
                        onClick={() => setPeriodSelectorOpen(false)}
                        aria-label="Fechar seleção de períodos"
                      >
                        Fechar
                      </button>
                    </div>
                    <div className="pb-mensal-period-list">
                      {months.map((month) => (
                        <label key={month} className={selectedSet.has(month) ? "is-selected" : ""}>
                          <input
                            type="checkbox"
                            checked={selectedSet.has(month)}
                            onChange={() => toggleMonth(month)}
                          />
                          <span>{month}</span>
                        </label>
                      ))}
                    </div>
                    <div className="pb-mensal-consulta-actions">
                      <button type="button" onClick={() => setSelectedMonths(months)}>
                        Marcar todos
                      </button>
                      <button type="button" onClick={() => setSelectedMonths([])}>
                        Limpar
                      </button>
                    </div>
                  </div>
                ) : null}
              </div>
              <button type="button" className="pb-mensal-consultar-btn" onClick={() => setPeriodSelectorOpen(false)}>
                Aplicar
              </button>
            </div>
          ) : null}

          <div
            className={`pb-mensal-list ${viewMode === "consulta" ? "pb-mensal-matrix" : "pb-mensal-period-list-simple"}`}
            role="table"
            aria-label="Eventos mensais importados"
          >
            {viewMode === "consulta" ? (
              <EventsGrid
                events={eventsGridRows}
                monthLabels={eventsGridMonthLabels}
                onEventClick={(event, month) =>
                  onOpenEvent?.({
                    ...event.source,
                    eventCode: event.code || "",
                    eventDesc: event.name || "",
                    month: month?.sourceMonth || "",
                    monthLabel: month?.label || "",
                  })
                }
                eventSortDir={eventSortDir}
                onToggleEventSort={toggleEventSort}
              />
            ) : (
              <div className="pb-mensal-list-head pb-mensal-simple-row" role="row">
                <button
                  type="button"
                  className="pb-mensal-event-sort"
                  role="columnheader"
                  onClick={toggleEventSort}
                  title="Ordenar eventos"
                >
                  Evento
                  <span aria-hidden="true">{eventSortDir === "asc" ? "▲" : "▼"}</span>
                </button>
                <span role="columnheader">Horas</span>
              </div>
            )}
            {viewMode === "consulta" ? null : <div className="pb-mensal-list-body">
              {visibleRows.map((row, index) => {
                const label = splitEventLabel(row.event);
                const category = getMonthlyRowCategory(row);
                return (
                  <React.Fragment key={`${row.event}-${index}`}>
                    {viewMode !== "consulta" && shouldShowSimpleCategory(row, index) ? (
                      <div className="pb-mensal-category-row" role="row">
                        <span>{category.label}</span>
                      </div>
                    ) : null}
                    <button
                      type="button"
                      className={`pb-mensal-list-row ${viewMode === "consulta" ? "pb-mensal-matrix-row" : "pb-mensal-simple-row"}`}
                      role="row"
                      onClick={() => onOpenEvent?.(row)}
                      title="Abrir colaboradores deste evento"
                      style={matrixStyle}
                    >
                      {viewMode === "consulta" ? (
                        <>
                          <span role="cell" className="pb-mensal-event-cell" title={row.event}>
                            <b>{label.description.toLocaleUpperCase("pt-BR")}</b>
                            {label.code ? <small>{label.code}</small> : null}
                          </span>
                          {activeMonths.flatMap((month, monthIndex) => {
                            const variation = calcMonthVariation(row, monthIndex);
                            return [
                              <span role="cell" className="pb-mensal-month-val" key={`${month}-valor`}>
                                {fmtHMMilhar(row.byMonth?.[month] || 0)}
                              </span>,
                              <span role="cell" className="pb-mensal-delta-val" key={`${month}-var`} title={variation.title}>
                                {variation.text ? (
                                  <span className={`pb-mensal-var is-${variation.kind} ${variation.highlight ? "is-relevant" : "is-quiet"}`}>
                                    <i aria-hidden="true">{variation.arrow}</i>
                                    {variation.text}
                                  </span>
                                ) : "—"}
                              </span>,
                            ];
                          })}
                        </>
                      ) : (
                        <span role="cell" className="pb-mensal-period-event" title={row.event}>
                          <b>{label.description.toLocaleUpperCase("pt-BR")}</b>
                          {label.code ? <small>{label.code}</small> : null}
                        </span>
                      )}
                      <strong role="cell">{fmtHMMilhar(row.total || 0)}</strong>
                    </button>
                  </React.Fragment>
                );
              })}
              {!visibleRows.length ? (
                <div className="pb-mensal-list-empty">Selecione pelo menos um mês com horas para consultar.</div>
              ) : null}
            </div>}
            {viewMode === "consulta" && !visibleRows.length ? (
              <div className="pb-mensal-list-empty">Selecione pelo menos um mês com horas para consultar.</div>
            ) : null}
          </div>
        </div>
      ) : (
        <div className="pb-mensal-main">
          {mensalCards.map((item) => (
            <div className="pb-mensal-item" key={item.label}>
              <span>{item.label}</span>
              <strong>{item.value}</strong>
              <em>{item.hint}</em>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

const mensalEventKey = (value) =>
  String(value || "")
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();

function buildMensalEventColabs(histRows, eventName) {
  const target = mensalEventKey(eventName);
  if (!target) return [];
  const map = new Map();

  (Array.isArray(histRows) ? histRows : []).forEach((row) => {
    const date = row?.date || row?.data || row?.data_referencia || "";
    const events = Array.isArray(row?._events) ? row._events : [];
    events.forEach((ev) => {
      const label = ev?.evento || ev?.descricao || ev?.event || "";
      if (mensalEventKey(label) !== target) return;
      const mat = String(ev?.mat ?? ev?.matricula ?? "").trim();
      const nome = String(ev?.nome || ev?.colaborador || mat || "").trim();
      if (!nome && !mat) return;
      const key = `${mat}|${nome}`;
      const current = map.get(key) || {
        mat,
        nome,
        depto: ev?.depto || ev?.depto_desc || ev?.departamento || "",
        cargo: ev?.cargo || ev?.cargo_desc || "",
        filial: ev?.filial || "",
        ocorrencias: 0,
        minutos: 0,
        dias: new Set(),
      };
      current.ocorrencias += 1;
      current.minutos += Math.round((Number(ev?.horas) || 0) * 60);
      if (date) current.dias.add(date);
      map.set(key, current);
    });
  });

  return Array.from(map.values())
    .map((row) => ({ ...row, dias: Array.from(row.dias).sort() }))
    .sort((a, b) => b.ocorrencias - a.ocorrencias || a.nome.localeCompare(b.nome, "pt-BR"));
}

const parsePtNumber = (v) => {
  if (v == null) return 0;
  const s = String(v).trim();
  if (!s) return 0;
  const norm = s.replace(/\./g, "").replace(",", ".").replace(/\s+/g, "");
  const n = Number(norm);
  return Number.isFinite(n) ? n : 0;
};

const parseTurnoverCsv = (csvText) => {
  const text = String(csvText || "").replace(/^\uFEFF/, "");
  const lines = text
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);
  if (!lines.length) return null;

  const delim = lines[0].includes(";") ? ";" : ",";
  const header = lines[0].split(delim).map((s) => String(s || "").trim());
  const months = header.slice(1).filter(Boolean);
  if (!months.length) return null;

  const rows = {};
  for (let i = 1; i < lines.length; i++) {
    const parts = lines[i].split(delim);
    const key = String(parts[0] || "").trim();
    if (!key) continue;
    rows[key] = months.map((_, idx) => parsePtNumber(parts[idx + 1]));
  }

  return {
    months,
    rows,
    importedAt: new Date().toISOString(),
  };
};

const ymToMmYyyy = (ym) => {
  const s = String(ym || "").trim();
  const m = s.match(/^(\d{4})-(\d{2})$/);
  if (!m) return "";
  return `${m[2]}/${m[1]}`;
};
const mmYyyyToYm = (mmYyyy) => {
  const s = String(mmYyyy || "").trim();
  const m = s.match(/^(\d{2})\/(\d{4})$/);
  if (!m) return "";
  return `${m[2]}-${m[1]}`;
};
const monthKeyToIndex = (k) => {
  const s = String(k || "").trim();
  const m = s.match(/^(\d{2})\/(\d{4})$/);
  if (!m) return -1;
  const mm = parseInt(m[1], 10);
  const yy = parseInt(m[2], 10);
  if (!Number.isFinite(mm) || !Number.isFinite(yy)) return -1;
  return yy * 12 + (mm - 1);
};

/**
 * Bento header for Posi??o do Dia.
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

function buildEventKey(codigo, descricao) {
  const c = String(codigo ?? "").trim();
  const d = String(descricao ?? "").trim();
  if (c && d) return `${c} - ${d}`;
  return c || d;
}

function inferPeriodoCategoryFromEventText(value) {
  const s = String(value || "")
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{M}/gu, "");
  if (!s) return "";
  if (/\bferias\b|vacat/.test(s)) return "ferias";
  if (/afast|licenca|licenca medica|auxilio|inss|atestado|enfermidade|maternidade|acidente/.test(s))
    return "afastados";
  return "";
}

function normalizeDiagPositionCategory(value) {
  const normalized = normalizePositionCategory(value, "");
  if (normalized === "falta") return "faltas";
  if (normalized === "atraso") return "atrasos";
  if (normalized === "ferias") return "ferias";
  if (normalized) return normalized;
  const inferred = inferPeriodoCategoryFromEventText(value);
  if (inferred === "ferias") return "ferias";
  return "";
}

function compactDiagnosisRow(row = {}) {
  return {
    nome:
      row.nome ??
      row.colaborador ??
      row.colaboradorNome ??
      row.colaborador_nome ??
      row.name ??
      "",
    matricula: row.matricula ?? row.mat ?? row.codigo ?? row.cod ?? "",
    departamento:
      row.departamento ??
      row.depto ??
      row.departamentoNome ??
      row.departamento_nome ??
      row.department ??
      "",
    cargo: row.cargo ?? row.cargoNome ?? row.cargo_nome ?? "",
    inicio:
      row.inicio ??
      row.dataInicio ??
      row.data_inicio ??
      row.dtInicio ??
      row.feriasInicio ??
      row.afastamentoInicio ??
      "",
    termino:
      row.termino ??
      row.fim ??
      row.dataFim ??
      row.data_fim ??
      row.dtFim ??
      row.feriasFim ??
      row.afastamentoFim ??
      "",
    data: row.data ?? row.date ?? row.dia ?? "",
    categoria: row.categoria ?? row.cat ?? row.category ?? row.tipo ?? row.status ?? "",
    evento: row.evento ?? row.eventoDescricao ?? row.evento_descricao ?? row.descricao ?? "",
  };
}

function collectDiagnosisCategoryRows(source, category) {
  if (!source) return [];
  const directBuckets = [
    source?.[category],
    source?.byCat?.[category],
    source?.categorias?.[category],
    source?.categories?.[category],
  ];
  const directRows = directBuckets.flatMap((bucket) => {
    if (Array.isArray(bucket)) return bucket;
    if (!bucket || typeof bucket !== "object") return [];
    return [
      ...(Array.isArray(bucket.rows) ? bucket.rows : []),
      ...(Array.isArray(bucket.eventos) ? bucket.eventos : []),
      ...(Array.isArray(bucket.events) ? bucket.events : []),
      ...(Array.isArray(bucket.employees) ? bucket.employees : []),
      ...(Array.isArray(bucket._employees) ? bucket._employees : []),
    ];
  });

  const broadRows = [
    ...(Array.isArray(source.rows) ? source.rows : []),
    ...(Array.isArray(source.eventos) ? source.eventos : []),
    ...(Array.isArray(source.events) ? source.events : []),
    ...(Array.isArray(source.items) ? source.items : []),
  ].filter((row) => {
    const rowCategory = normalizeDiagPositionCategory(
      row?.categoria ?? row?.cat ?? row?.category ?? row?.tipo ?? row?.status ?? row?.posListKey,
    );
    if (rowCategory === category) return true;
    const textCategory = normalizeDiagPositionCategory(
      `${row?.evento ?? ""} ${row?.eventoDescricao ?? ""} ${row?.descricao ?? ""} ${row?.situacao ?? ""}`,
    );
    return textCategory === category;
  });

  const seen = new Set();
  return [...directRows, ...broadRows]
    .map(compactDiagnosisRow)
    .filter((row) => {
      const key = `${row.matricula}|${row.nome}|${row.departamento}|${row.data}|${row.inicio}|${row.termino}|${row.evento}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return row.nome || row.matricula || row.departamento || row.inicio || row.termino;
    });
}

function parseXlsxToHistTabela(wb, XLSX) {
  const ws = wb.Sheets[wb.SheetNames[0]];
  fixPosicaoSheetRef(ws, XLSX);
  const aoa = XLSX.utils.sheet_to_json(ws, {
    header: 1,
    defval: null,
    blankrows: false,
    raw: true,
  });
  if (aoa.length < 2) {
    return [];
  }

  const norm = (s) =>
    String(s || "")
      .trim()
      .toLowerCase()
      .normalize("NFD")
      .replace(/\p{M}/gu, "");
  const normLoose = (s) => norm(s).replace(/[^a-z0-9]+/g, "");
  const hasHeader = (h, list) => {
    const loose = normLoose(h);
    return list.some((item) => {
      const target = normLoose(item);
      return (
        loose === target ||
        (loose.length > 3 &&
          target.length > 3 &&
          (loose.includes(target) || target.includes(loose)))
      );
    });
  };
  const formatLocalDate = (d) =>
    `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  const parseDate = (v) => {
    if (v == null || v === "") return null;
    if (v instanceof Date && !Number.isNaN(v.getTime())) return formatLocalDate(v);
    if (typeof v === "number" && v > 0) {
      if (v > 1000) {
        const whole = Math.floor(v);
        const ms = Math.round((v - whole) * 86400000);
        const base = new Date(Date.UTC(1899, 11, 30 + whole));
        base.setUTCDate(base.getUTCDate());
        const d = new Date(base.getTime() + ms);
        if (!Number.isNaN(d.getTime())) return formatLocalDate(d);
      }
    }
    const s = String(v).trim();
    if (!s || s === "-" || s === "—") return null;
    const mWeek = s.match(
      /^(?:seg|ter|qua|qui|sex|sab|sáb|dom)\s+(\d{1,2})[\/.-](\d{1,2})(?:[\/.-](\d{2,4}))?$/i,
    );
    if (mWeek) {
      const y = mWeek[3]
        ? mWeek[3].length === 2
          ? `20${mWeek[3]}`
          : mWeek[3]
        : String(new Date().getFullYear());
      return `${y}-${mWeek[2].padStart(2, "0")}-${mWeek[1].padStart(2, "0")}`;
    }
    const br = s.match(/^(\d{1,2})[\/.-](\d{1,2})[\/.-](\d{2,4})(?:\s+\d{1,2}:\d{2}(?::\d{2})?)?/);
    if (br) {
      const y = br[3].length === 2 ? `20${br[3]}` : br[3];
      return `${y}-${br[2].padStart(2, "0")}-${br[1].padStart(2, "0")}`;
    }
    const iso = s.match(/^(\d{4})-(\d{2})-(\d{2})(?:[tT\s].*)?/);
    if (iso) return `${iso[1]}-${iso[2]}-${iso[3]}`;
    return null;
  };
  const parseTimeMin = (v) => {
    if (v == null || v === "") return 0;
    if (typeof v === "number") {
      if (v > 0 && v < 1) return Math.round(v * 24 * 60);
      if (v >= 1) return Math.round(v * 60);
      return 0;
    }
    const s = String(v).trim();
    if (!s || s === "ï¿½" || s === "-") return 0;
    const m = s.match(/^(\d+):(\d{2})/);
    if (m) return parseInt(m[1]) * 60 + parseInt(m[2]);
    const n = Number(s.replace(/\./g, "").replace(",", ".").replace("%", ""));
    if (Number.isFinite(n) && n > 0) return Math.round(n * 60);
    return 0;
  };
  const parseCount = (v) => {
    if (v == null || v === "") return 0;
    const m = String(v).trim().match(/-?\d+/);
    return m ? Math.max(0, parseInt(m[0], 10) || 0) : 0;
  };
  let headerRow = aoa.findIndex((line) => {
    const hs = (line || []).map((h) => norm(h));
    const hasDate = hs.some((h) =>
      hasHeader(h, [
        "apontamento.data",
        "data",
        "dt",
        "dia",
        "data apontamento",
        "data do apontamento",
        "data ponto",
        "data da marcacao",
        "data da marca??o",
        "data evento",
        "competencia",
      ]),
    );
    const hasSignal = hs.some((h) =>
      hasHeader(h, [
        "evento.codigo",
        "codigo",
        "cod",
        "c?digo",
        "evento.descricao",
        "evento",
        "descricao",
        "descri??o",
        "ocorrencia",
        "ocorr?ncia",
        "situacao",
        "situa??o",
        "tipo",
        "tipo evento",
        "apontamento.horas",
        "total",
        "horas",
        "hora",
        "qtd",
        "quantidade",
        "marcacao.horario",
        "horario",
        "hor?rio",
        "jornada",
        "turno",
        "marcacao",
        "marca??es",
        "marcacoes",
        "batidas",
        "registro",
        "ponto",
      ]),
    );
    return hasDate && hasSignal;
  });
  if (headerRow === -1) {
    const looksDate = (v) => {
      if (v instanceof Date && !Number.isNaN(v.getTime())) return true;
      if (typeof v === "number" && v > 1000) return true;
      return (
        /^\d{1,2}[\/.-]\d{1,2}[\/.-]\d{2,4}(?:\s+.*)?$/.test(String(v || "").trim()) ||
        /^\d{4}-\d{2}-\d{2}/.test(String(v || "").trim())
      );
    };
    const dataRow = aoa.findIndex((line) => (line || []).some(looksDate));
    if (dataRow > 0) {
      const prev = aoa[dataRow - 1] || [];
      const prevTextCount = prev.filter((v) => String(v ?? "").trim() && !looksDate(v)).length;
      if (prevTextCount >= 2) headerRow = dataRow - 1;
    }
    if (headerRow === -1) {
      const first = (aoa[0] || []).map((h) => norm(h));
      const looksSummary =
        first.some((h) => hasHeader(h, ["data"])) &&
        first.some((h) =>
          hasHeader(h, [
            "planejadas",
            "trabalhadas",
            "perdidas",
            "qtd presentes",
            "qtd ausentes",
            "hrs ausentes",
          ]),
        );
      if (looksSummary) headerRow = 0;
    }
  }
  if (headerRow === -1) {
    return null;
  }
  const headers = (aoa[headerRow] || []).map((h) => norm(h));
  const findCol = (aliases, opts = {}) => {
    const { reject = [] } = opts;
    return headers.findIndex((h) => {
      const loose = normLoose(h);
      if (reject.some((r) => loose.includes(normLoose(r)))) return false;
      return hasHeader(h, aliases);
    });
  };
  const exactCol = (...names) => {
    const wanted = names.map(normLoose);
    return headers.findIndex((h) => wanted.includes(normLoose(h)));
  };
  const exactOrFind = (exactNames, aliases, opts) => {
    const exact = exactCol(...exactNames);
    return exact >= 0 ? exact : findCol(aliases, opts);
  };
  /** CID e CID.DESCRI??O: evita que o alias "cid" capture a coluna de descri??o. */
  const findCidColumns = () => {
    const isCidDescLoose = (loose) =>
      loose.includes("ciddesc") ||
      (loose.includes("cid") && (loose.includes("descricao") || loose.includes("desc")));
    const isCidOnlyLoose = (loose) =>
      (loose === "cid" || loose === "apontamentocid") && !isCidDescLoose(loose);

    let cid = exactCol("apontamento.cid", "cid");
    if (cid < 0) {
      cid = headers.findIndex((h) => {
        const loose = normLoose(h);
        return isCidOnlyLoose(loose);
      });
    }

    let cidDesc = exactCol(
      "apontamento.ciddescricao",
      "apontamento.cid.descricao",
      "cid.descricao",
      "ciddescricao",
      "cid.descricao",
    );
    if (cidDesc < 0) {
      cidDesc = headers.findIndex((h) => {
        const loose = normLoose(h);
        if (!isCidDescLoose(loose)) return false;
        return (
          hasHeader(h, [
            "cid.descricao",
            "cid.descricao",
            "cid descricao",
            "descricao cid",
            "descri??o cid",
            "cid descricao",
            "ciddescricao",
            "apontamento.cid descricao",
          ]) || isCidDescLoose(loose)
        );
      });
    }

    if (cid >= 0 && cidDesc === cid) cidDesc = -1;
    return { cid, cidDesc };
  };
  const dateCol = exactOrFind(
    ["apontamento.data"],
    [
      "data",
      "dt",
      "dia",
      "data apontamento",
      "data do apontamento",
      "data ponto",
      "data da marcacao",
      "data da marca??o",
      "data evento",
      "competencia",
    ],
  );
  const totalCol = exactOrFind(
    ["apontamento.horas"],
    [
      "total",
      "horas",
      "hora",
      "qtd horas",
      "quantidade horas",
      "horas apontamento",
      "horas trabalhadas",
      "horas abonadas",
      "horas falta",
      "horas extras",
    ],
  );
  const codigoCol = exactOrFind(
    ["evento.codigo"],
    ["codigo evento", "c?digo evento", "cod evento", "cod ocorrencia", "codigo ocorrencia"],
    { reject: ["colaborador"] },
  );
  const descCol = exactOrFind(
    ["evento.descricao"],
    [
      "descricao evento",
      "descri??o evento",
      "nome evento",
      "evento",
      "ocorrencia",
      "ocorr?ncia",
      "tipo evento",
      "motivo",
    ],
    { reject: ["cargo", "colaborador", "departamento", "filial", "situacao", "situa??o"] },
  );
  const situacaoDescCol = exactOrFind(
    ["situacao.descricao"],
    ["situacao descricao", "descri??o situa??o", "descricao situacao", "situa??o", "situacao"],
    { reject: ["evento", "cargo", "colaborador"] },
  );
  const { cid: cidCol, cidDesc: cidDescCol } = findCidColumns();
  const atividadeCol = exactOrFind(
    ["apontamento.atividade"],
    ["atividade", "atividade apontamento", "tipo atividade"],
  );
  const matCol = exactOrFind(
    ["colaborador.matricula"],
    [
      "matricula",
      "matr?cula",
      "mat",
      "chapa",
      "cadastro",
      "registro",
      "codigo colaborador",
      "cod colaborador",
      "id colaborador",
    ],
  );
  const nomeCol = exactOrFind(
    ["colaborador.nome"],
    ["nome colaborador", "funcionario", "funcion?rio", "empregado", "trabalhador", "colaborador"],
  );
  const filialCol = exactOrFind(
    ["filial.nomefantasia"],
    ["nome fantasia", "filial", "empresa", "unidade", "loja", "estabelecimento"],
  );
  const deptoCol = exactOrFind(
    ["departamento.nome"],
    [
      "departamento",
      "depto",
      "setor",
      "centro custo",
      "centro de custo",
      "ccusto",
      "lotacao",
      "lota??o",
      "area",
      "?rea",
    ],
  );
  const cargoCol = exactOrFind(
    ["cargo.descricao", "cargo.nome"],
    ["cargo", "fun??o", "funcao", "ocupacao", "ocupa??o", "job", "posto"],
  );
  const generoCol = exactOrFind(
    ["colaborador.genero", "colaborador.sexo"],
    ["genero", "sexo"],
  );
  const periodoInicioCol = exactOrFind(
    [
      "afastamento.inicio",
      "afastamento.dataInicio",
      "ferias.inicio",
      "ferias.dataInicio",
      "dataInicio",
    ],
    [
      "afastamento inicio",
      "inicio afastamento",
      "data inicio afastamento",
      "data inicial afastamento",
      "ferias inicio",
      "inicio ferias",
      "data inicio ferias",
      "data inicial ferias",
      "periodo inicio",
      "data inicio",
      "data inicial",
    ],
  );
  const periodoFimCol = exactOrFind(
    [
      "afastamento.final",
      "afastamento.fim",
      "afastamento.dataFinal",
      "ferias.final",
      "ferias.fim",
      "ferias.dataFinal",
      "dataFinal",
    ],
    [
      "afastamento final",
      "afastamento fim",
      "fim afastamento",
      "data fim afastamento",
      "data final afastamento",
      "ferias final",
      "ferias fim",
      "fim ferias",
      "data fim ferias",
      "data final ferias",
      "periodo fim",
      "periodo ate",
      "data fim",
      "data final",
    ],
  );
  const saldoAnteriorBHCol = exactOrFind(
    ["saldoAnteriorBH", "saldo_anterior_bh", "saldo anterior", "Saldo Anterior"],
    ["saldo anterior", "saldo inicial", "saldo antes", "saldo ant"],
  );
  const creditoBHCol = exactOrFind(
    ["creditoBH", "credito_bh", "crédito", "credito", "Crédito"],
    ["credito", "crédito", "creditos", "créditos", "credito bh", "crédito bh"],
  );
  const debitoBHCol = exactOrFind(
    ["debitoBH", "debito_bh", "débito", "debito", "Débito"],
    ["debito", "débito", "debitos", "débitos", "debito bh", "débito bh"],
  );
  const saldoProximoBHCol = exactOrFind(
    ["saldoProximoBH", "saldo_proximo_bh", "saldo próximo", "saldo proximo", "Saldo Próximo"],
    ["saldo próximo", "saldo proximo", "saldo final", "saldo atual", "saldo seguinte", "proximo saldo"],
  );
  const horarioCol = exactOrFind(
    ["marcacao.horario", "apontamento.horario"],
    [
      "horario",
      "hor?rio",
      "jornada",
      "turno",
      "horario do dia",
      "escala",
      "horario trabalho",
    ],
  );

  const isHorarioScheduleHeader = (h) => {
    const loose = normLoose(h);
    if (loose === "marcacaohorario" || loose === "apontamentohorario") return true;
    if (
      loose.includes("horariododia") ||
      loose === "horario" ||
      loose === "jornada" ||
      loose === "turno" ||
      loose === "escala"
    ) {
      return !loose.includes("marcacaoponto") && loose !== "marcacao";
    }
    return (
      hasHeader(h, ["marcacao.horario", "horario", "jornada", "turno", "escala"]) &&
      !hasHeader(h, ["marcacao.marcacao", "marcacao.batidas", "batidas", "ponto"])
    );
  };

  const findMarcacaoColumn = () => {
    const exactMarcacao = exactCol(
      "apontamento.marcacao",
      "marcacao.marcacao",
      "marcacao.batidas",
      "marcacao.ponto",
      "marcacao.entrada",
    );
    if (exactMarcacao >= 0 && exactMarcacao !== horarioCol) return exactMarcacao;

    const idx = headers.findIndex((h, i) => {
      if (i === horarioCol) return false;
      if (isHorarioScheduleHeader(h)) return false;
      const loose = normLoose(h);
      if (loose.includes("marcacao") || loose.includes("marcacoes")) {
        if (loose.includes("horario")) return false;
        return true;
      }
      return hasHeader(h, [
        "marca??es",
        "marcacoes",
        "apontamento.marcacao",
        "marcacao.marcacao",
        "marcacao.batidas",
        "marcacao.ponto",
        "marcacao.entrada",
        "batidas",
        "ponto",
        "entrada",
        "marcacoes do ponto",
        "marca??es do ponto",
        "batidas ponto",
        "batidas do ponto",
        "registro ponto",
        "registros ponto",
        "registros do ponto",
      ]);
    });
    if (idx >= 0 && idx !== horarioCol) return idx;
    return -1;
  };

  const marcacaoCol = findMarcacaoColumn();

  const marcPartCols = [];
  for (let n = 1; n <= 4; n++) {
    for (const alias of [`marc${n}`, `marc_${n}`, `marcacao${n}`, `batida${n}`, `entrada${n}`, `saida${n}`]) {
      const i = headers.findIndex((h) => normLoose(h) === normLoose(alias));
      if (i >= 0 && i !== horarioCol && i !== marcacaoCol && !marcPartCols.includes(i)) {
        marcPartCols.push(i);
      }
    }
  }
  const planejadasCol = headers.findIndex((h) =>
    hasHeader(h, ["planejadas", "horas planejadas", "hrs planejadas"]),
  );
  const trabalhadasCol = headers.findIndex((h) =>
    hasHeader(h, ["trabalhadas", "horas trabalhadas", "hrs trabalhadas"]),
  );
  const perdidasCol = headers.findIndex((h) =>
    hasHeader(h, ["perdidas", "horas perdidas", "hrs perdidas"]),
  );
  const qtdPresentesCol = headers.findIndex((h) =>
    hasHeader(h, ["qtd presentes", "qtd. presentes", "presentes"]),
  );
  const qtdAusentesCol = headers.findIndex((h) =>
    hasHeader(h, ["qtd ausentes", "qtd. ausentes", "ausentes", "faltas"]),
  );
  const hrsAusentesCol = headers.findIndex((h) =>
    hasHeader(h, ["hrs ausentes", "hrs. ausentes", "horas ausentes", "horas faltas"]),
  );
  const qtdJustCol = headers.findIndex((h) =>
    hasHeader(h, ["qtd justificadas", "qtd. justificadas", "justificadas"]),
  );
  const hrsJustCol = headers.findIndex((h) =>
    hasHeader(h, ["hrs justificadas", "hrs. justificadas", "horas justificadas"]),
  );
  const qtdExtrasCol = headers.findIndex((h) =>
    hasHeader(h, ["qtd extras", "qtd. extras", "extras"]),
  );
  const hrsExtrasCol = headers.findIndex((h) =>
    hasHeader(h, ["hrs extras", "hrs. extras", "horas extras"]),
  );
  const isSummaryLayout =
    planejadasCol >= 0 ||
    trabalhadasCol >= 0 ||
    perdidasCol >= 0 ||
    qtdPresentesCol >= 0 ||
    qtdAusentesCol >= 0;

  if (isSummaryLayout) {
    const byDateSummary = new Map();
    for (let i = headerRow + 1; i < aoa.length; i++) {
      const row = aoa[i] || [];
      const date = parseDate(row[dateCol]);
      if (!date) continue;
      const presentes = qtdPresentesCol >= 0 ? parseCount(row[qtdPresentesCol]) : 0;
      const faltas = qtdAusentesCol >= 0 ? parseCount(row[qtdAusentesCol]) : 0;
      const justificadas = qtdJustCol >= 0 ? parseCount(row[qtdJustCol]) : 0;
      const extras = qtdExtrasCol >= 0 ? parseCount(row[qtdExtrasCol]) : 0;
      const hrsPlan = planejadasCol >= 0 ? parseTimeMin(row[planejadasCol]) : 0;
      const hrsPresRaw = trabalhadasCol >= 0 ? parseTimeMin(row[trabalhadasCol]) : 0;
      const hrsPres = capWorkedHours(hrsPresRaw, hrsPlan);
      const hrsAuse = hrsAusentesCol >= 0 ? parseTimeMin(row[hrsAusentesCol]) : 0;
      const hrsJust = hrsJustCol >= 0 ? parseTimeMin(row[hrsJustCol]) : 0;
      const hrsExtr = hrsExtrasCol >= 0 ? parseTimeMin(row[hrsExtrasCol]) : 0;
      const filial = filialCol >= 0 ? String(row[filialCol] ?? "").trim() : "";
      const depto = deptoCol >= 0 ? String(row[deptoCol] ?? "").trim() : "";
      const cargo = cargoCol >= 0 ? String(row[cargoCol] ?? "").trim() : "";
      const cur = byDateSummary.get(date) || {
        date,
        total: 0,
        presentes: 0,
        faltas: 0,
        atrasos: 0,
        justificadas: 0,
        extras: 0,
        horas_presentes: 0,
        horas_planejadas: 0,
        horas_faltas: 0,
        horas_atrasos: null,
        horas_justificadas: 0,
        horas_extras: 0,
        _employees: [],
        _events: null,
      };
      cur.presentes += presentes;
      cur.faltas += faltas;
      cur.justificadas += justificadas;
      cur.extras += extras;
      cur.horas_presentes += hrsPres;
      cur.horas_planejadas += hrsPlan;
      cur.horas_faltas += hrsAuse;
      cur.horas_justificadas += hrsJust;
      cur.horas_extras += hrsExtr;
      cur.total = cur.presentes + cur.faltas + cur.justificadas;
      if (filial || depto || cargo) {
        cur._employees.push({
          mat: `resumo-${i}`,
          nome: depto || cargo || filial || "Resumo",
          filial,
          depto,
          depto_desc: depto,
          cargo,
          hrsPlan,
          hrsPres,
          hrsAuse,
          hrsJust,
          hrsExtr,
        });
      }
      byDateSummary.set(date, cur);
    }
    const rows = [...byDateSummary.values()].map((r) => ({
      ...r,
      extras: r.extras > 0 ? r.extras : null,
      abs_rate: r.total > 0 ? +((r.faltas / r.total) * 100).toFixed(2) : 0,
      horas_presentes: r.horas_presentes > 0 ? r.horas_presentes : null,
      horas_planejadas: r.horas_planejadas > 0 ? r.horas_planejadas : null,
      horas_faltas: r.horas_faltas > 0 ? r.horas_faltas : null,
      horas_justificadas: r.horas_justificadas > 0 ? r.horas_justificadas : null,
      horas_extras: r.horas_extras > 0 ? r.horas_extras : null,
      _employees: r._employees.length ? r._employees : null,
    }));
    rows.sort((a, b) => a.date.localeCompare(b.date));
    return rows;
  }

  if (dateCol === -1) {
    return null;
  }
  if (
    codigoCol === -1 &&
    descCol === -1 &&
    totalCol === -1 &&
    marcacaoCol === -1 &&
    horarioCol === -1
  ) {
    return null;
  }
  if (cidCol < 0 && cidDescCol < 0) {
    console.warn(
      "[ImportTabela] Colunas CID nao detectadas. Cabecalhos:",
      (aoa[headerRow] || []).filter(Boolean).slice(0, 40),
    );
  }

  const cats = loadEventCategories();
  const eventKeyNorm = (v) => norm(v).replace(/\s+/g, " ").trim();
  const eventKeyLoose = (v) => eventKeyNorm(v).replace(/[^a-z0-9]+/g, "");
  const catByName = {};
  cats.forEach((c) => {
    const key = eventKeyNorm(c.name);
    if (key) catByName[key] = c.category;
    if (key) catByName[eventKeyLoose(key)] = c.category;
    const parts = key.match(/^\s*[^-??]+[-??]\s*(.+)$/);
    if (parts?.[1]) {
      catByName[eventKeyNorm(parts[1])] = c.category;
      catByName[eventKeyLoose(parts[1])] = c.category;
    }
  });

  // Parse "6 - 14:47 18:00 19:00 23:00" ? (saida1-entrada1) + (saida2-entrada2)
  const parseHorarioMin = (v) => {
    if (!v) return 0;
    const s = String(v)
      .trim()
      .replace(/^[^-]*-\s*/, "");
    const toMin = (t) => {
      const m = String(t).match(/^(\d+):(\d{2})$/);
      return m ? parseInt(m[1]) * 60 + parseInt(m[2]) : 0;
    };
    const ts = s.split(/\s+/).filter(Boolean);
    const mins = ts.map(toMin);
    for (let i = 1; i < mins.length; i++) {
      if (mins[i] < mins[i - 1]) {
        for (let j = i; j < mins.length; j++) mins[j] += 1440;
      }
    }
    if (mins.length >= 4) return Math.max(0, mins[1] - mins[0]) + Math.max(0, mins[3] - mins[2]);
    if (mins.length >= 2) return Math.max(0, mins[1] - mins[0]);
    return 0;
  };

  const byDate = new Map();
  const planSeen = new Set(); // `${date}|${mat}` ? count each employee's planned hours once
  const presentDerivedSeen = new Set(); // marca??es/jornada derivadas representam o dia do colaborador
  let rawRowCount = 0;
  let skippedNoDate = 0;
  const sheetDataRows = Math.max(0, aoa.length - headerRow - 1);

  for (let i = headerRow + 1; i < aoa.length; i++) {
    const raw = aoa[i] || [];
    const row =
      raw.length >= headers.length ?
         raw
        : headers.map((_, ci) => (ci < raw.length ? raw[ci] : null));
    const date = parseDate(row[dateCol]);
    if (!date) {
      skippedNoDate++;
      continue;
    }
    rawRowCount++;

    const mat = matCol >= 0 ? String(row[matCol] ?? `_${i}`).trim() : `_${i}`;
    const codRaw = codigoCol >= 0 ? row[codigoCol] : "";
    const descRaw = descCol >= 0 ? row[descCol] : "";
    const situacaoRaw = situacaoDescCol >= 0 ? String(row[situacaoDescCol] ?? "").trim() : "";
    const periodoInicio = periodoInicioCol >= 0 ? parseDate(row[periodoInicioCol]) || "" : "";
    const periodoFim = periodoFimCol >= 0 ? parseDate(row[periodoFimCol]) || "" : "";
    const saldoAnteriorBH = saldoAnteriorBHCol >= 0 ? parseBancoHorasMin(row[saldoAnteriorBHCol]) : null;
    const creditoBH = creditoBHCol >= 0 ? parseBancoHorasMin(row[creditoBHCol]) : null;
    const debitoBH = debitoBHCol >= 0 ? parseBancoHorasMin(row[debitoBHCol]) : null;
    const saldoProximoBH = saldoProximoBHCol >= 0 ? parseBancoHorasMin(row[saldoProximoBHCol]) : null;
    const eventKey = buildEventKey(codRaw, descRaw);
    const mins = totalCol >= 0 ? parseTimeMin(row[totalCol]) : 0;
    let marcacaoRaw = "";
    if (marcacaoCol >= 0 && marcacaoCol !== horarioCol) {
      marcacaoRaw = String(row[marcacaoCol] ?? "").trim();
    }
    if (!marcacaoRaw && marcPartCols.length) {
      marcacaoRaw = marcPartCols
        .map((colIdx) => _fmtTime(row[colIdx]))
        .filter(Boolean)
        .join(" ");
    }
    const horarioStr = horarioCol >= 0 ? String(row[horarioCol] ?? "").trim() : "";
    if (marcacaoRaw && horarioStr && marcacaoRaw === horarioStr) marcacaoRaw = "";
    const planMins = horarioCol >= 0 ? parseHorarioMin(row[horarioCol]) : 0;
    const eventPeriodoCat = inferPeriodoCategoryFromEventText(
      `${eventKey || ""} ${descRaw || ""} ${codRaw || ""} ${situacaoRaw || ""}`,
    );
    let category =
      catByName[eventKeyNorm(eventKey)] ||
      catByName[eventKeyLoose(eventKey)] ||
      catByName[eventKeyNorm(descRaw)] ||
      catByName[eventKeyLoose(descRaw)] ||
      catByName[eventKeyNorm(codRaw)] ||
      catByName[eventKeyLoose(codRaw)] ||
      "ignorar";
    if (category === "ignorar" && eventPeriodoCat) category = "justificadas";

    if (!byDate.has(date))
      byDate.set(date, {
        pres: new Set(),
        ause: new Set(),
        atr: new Set(),
        just: new Set(),
        extr: new Set(),
        hrsPres: 0,
        hrsAuse: 0,
        hrsAtraso: 0,
        hrsJust: 0,
        hrsExtr: 0,
        hrsPlan: 0,
        empMap: new Map(),
        events: [],
      });
    const d = byDate.get(date);

    // Per-employee tracking
    if (!d.empMap.has(mat))
      d.empMap.set(mat, {
        nome: "",
        filial: "",
        depto: "",
        cargo: "",
        genero: "",
        periodoCat: "",
        inicio: "",
        termino: "",
        hrsPlan: 0,
        hrsPres: 0,
        hrsAuse: 0,
        hrsAtraso: 0,
        hrsJust: 0,
        hrsExtr: 0,
      });
    const emp = d.empMap.get(mat);
    if (nomeCol >= 0 && !emp.nome) {
      const v = String(row[nomeCol] ?? "").trim();
      if (v) emp.nome = v;
    }
    if (filialCol >= 0 && !emp.filial) {
      const v = String(row[filialCol] ?? "").trim();
      if (v) emp.filial = v;
    }
    if (deptoCol >= 0 && !emp.depto) {
      const v = String(row[deptoCol] ?? "").trim();
      if (v) emp.depto = v;
    }
    if (cargoCol >= 0 && !emp.cargo) {
      const v = String(row[cargoCol] ?? "").trim();
      if (v) emp.cargo = v;
    }
    if (generoCol >= 0 && !emp.genero) {
      emp.genero = normalizeGenero(row[generoCol]);
    }
    const periodoCat = eventPeriodoCat;
    if (periodoCat && !emp.periodoCat) emp.periodoCat = periodoCat;
    if (periodoInicio && !emp.inicio) emp.inicio = periodoInicio;
    if (periodoFim && !emp.termino) emp.termino = periodoFim;

    // Store planned hours per employee; total is computed later (only for active employees)
    const planKey = `${date}|${mat}`;
    if (!planSeen.has(planKey) && horarioCol >= 0) {
      if (planMins > 0) {
        emp.hrsPlan += planMins;
        planSeen.add(planKey);
      }
    }

    d.events.push({
      mat,
      nome: nomeCol >= 0 ? String(row[nomeCol] ?? "").trim() || mat : mat,
      filial: filialCol >= 0 ? String(row[filialCol] ?? "").trim() : "",
      depto: deptoCol >= 0 ? String(row[deptoCol] ?? "").trim() : "",
      cargo: cargoCol >= 0 ? String(row[cargoCol] ?? "").trim() : "",
      genero: generoCol >= 0 ? normalizeGenero(row[generoCol]) : "",
      data: date,
      horario: horarioStr,
      marcacao: marcacaoRaw,
      cod: codigoCol >= 0 ? String(row[codigoCol] ?? "").trim() : "",
      evento: descCol >= 0 ? String(row[descCol] ?? "").trim() : "",
      cid: cidCol >= 0 ? String(row[cidCol] ?? "").trim() : "",
      cidDescricao: cidDescCol >= 0 ? String(row[cidDescCol] ?? "").trim() : "",
      atividade: atividadeCol >= 0 ? String(row[atividadeCol] ?? "").trim() : "",
      situacaoDesc: situacaoRaw,
      inicio: periodoInicio,
      termino: periodoFim,
      horas: mins,
      creditoBH: creditoBH != null ? Math.max(0, creditoBH) : null,
      debitoBH: debitoBH != null ? Math.abs(debitoBH) : null,
      saldoAnteriorBH,
      saldoProximoBH,
      credito: creditoBH != null ? Math.max(0, creditoBH) : null,
      debito: debitoBH != null ? Math.abs(debitoBH) : null,
      saldoAnterior: saldoAnteriorBH,
      saldoProximo: saldoProximoBH,
      hasSaldoAnterior: saldoAnteriorBH != null,
      hasSaldoProximo: saldoProximoBH != null,
      _cat: category,
    });

    if (category === "ignorar") continue;
    const evText = `${codRaw} ${descRaw}`;
    const isAtrasoEv = /\batraso\b/i.test(evText);
    if (category === "presentes") {
      const derivedKey = `${date}|${mat}`;
      let workedMins = mins;
      if (!(workedMins > 0) && !presentDerivedSeen.has(derivedKey)) {
        workedMins = parseHorarioMin(marcacaoRaw) || planMins;
        if (workedMins > 0) presentDerivedSeen.add(derivedKey);
      }
      const remainingPlan = Math.max(0, (Number(emp.hrsPlan) || planMins || 0) - (Number(emp.hrsPres) || 0));
      if (remainingPlan > 0) workedMins = Math.min(workedMins, remainingPlan);
      d.pres.add(mat);
      d.hrsPres += workedMins;
      emp.hrsPres += workedMins;
    } else if (category === "ausentes" && isAtrasoEv) {
      d.atr.add(mat);
      d.hrsAtraso += mins;
      emp.hrsAtraso = (emp.hrsAtraso || 0) + mins;
    } else if (category === "ausentes") {
      d.ause.add(mat);
      d.hrsAuse += mins;
      emp.hrsAuse += mins;
    } else if (category === "justificadas") {
      d.just.add(mat);
      d.hrsJust += mins;
      emp.hrsJust += mins;
    } else if (category === "extras") {
      d.extr.add(mat);
      d.hrsExtr += mins;
      emp.hrsExtr += mins;
    } else if (category === "risco") {
      d.hrsRisco = (d.hrsRisco || 0) + mins;
      emp.hrsRisco = (emp.hrsRisco || 0) + mins;
    } else if (category === "noturnas") {
      d.hrsNoturnas = (d.hrsNoturnas || 0) + mins;
      emp.hrsNoturnas = (emp.hrsNoturnas || 0) + mins;
    }
  }

  const rows = [];
  for (const [date, d] of byDate) {
    const presentes = d.pres.size;
    const faltas = d.ause.size;
    const atrasos = d.atr.size;
    const justificadas = d.just.size;
    const extras = d.extr.size;
    const total = presentes + faltas + atrasos + justificadas;

    // Only count planned hours for employees who have some worked or absent hours
    let hrsPlan = 0,
      hrsPres = 0,
      hrsAuse = 0,
      hrsAtraso = 0,
      hrsJust = 0,
      hrsExtr = 0;
    const _employees = [];
    for (const [mat, e] of d.empMap) {
      const active =
        e.hrsPres > 0 || e.hrsAuse > 0 || e.hrsAtraso > 0 || e.hrsJust > 0 || e.hrsExtr > 0;
      hrsPres += e.hrsPres;
      hrsAuse += e.hrsAuse;
      hrsAtraso += e.hrsAtraso || 0;
      hrsJust += e.hrsJust;
      hrsExtr += e.hrsExtr;
      if (active) hrsPlan += e.hrsPlan;
      let cat = "presentes";
      if (d.atr.has(mat)) cat = "atraso";
      else if (d.ause.has(mat)) cat = "falta";
      else if (d.just.has(mat)) cat = e.periodoCat || "folga";
      _employees.push({
        mat,
        nome: e.nome || mat,
        filial: e.filial,
        depto: e.depto,
        depto_desc: e.depto,
        cargo: e.cargo,
        genero: e.genero,
        inicio: e.inicio || "",
        termino: e.termino || "",
        cat,
        hrsPlan: active ? e.hrsPlan : 0,
        hrsPres: e.hrsPres,
        hrsAuse: e.hrsAuse,
        hrsAtraso: e.hrsAtraso || 0,
        hrsJust: e.hrsJust,
        hrsExtr: e.hrsExtr,
        hrsRisco: e.hrsRisco || 0,
        hrsNoturnas: e.hrsNoturnas || 0,
      });
    }
    _employees.sort((a, b) => (a.nome || a.mat).localeCompare(b.nome || b.mat, "pt-BR"));

    rows.push({
      date,
      total,
      presentes,
      faltas,
      atrasos,
      justificadas,
      extras: extras > 0 ? extras : null,
      abs_rate: total > 0 ? +((faltas / total) * 100).toFixed(2) : 0,
      horas_presentes: hrsPres > 0 ? hrsPres : null,
      horas_planejadas: hrsPlan > 0 ? hrsPlan : null,
      horas_faltas: hrsAuse > 0 ? hrsAuse : null,
      horas_atrasos: hrsAtraso > 0 ? hrsAtraso : null,
      horas_justificadas: hrsJust > 0 ? hrsJust : null,
      horas_extras: hrsExtr > 0 ? hrsExtr : null,
      _employees: _employees.length > 0 ? _employees : null,
      _events: d.events.length > 0 ? d.events : null,
    });
  }
  rows.sort((a, b) => a.date.localeCompare(b.date));
  const eventCount = rows.reduce((s, r) => s + (r._events?.length || 0), 0);
  rows._rawRowCount = rawRowCount;
  rows._importStats = {
    sheetRows: sheetDataRows,
    importedRows: rawRowCount,
    skippedNoDate,
    eventCount,
    dayCount: rows.length,
  };
  return rows;
}

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
    return { text: `${diff > 0 ? "?" : "?"} ${diff > 0 ? "+" : ""}${diff} vs ontem`, ruim };
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
  const [histChartMode, setHistChartMode] = useState(() => loadPbView()?.histChartMode ?? "abs");
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
  const [histMetricFilter, setHistMetricFilter] = useState(null);
  const [histTableViewRequest, setHistTableViewRequest] = useState(null);
  const [radarWorkspaceOpen, setRadarWorkspaceOpen] = useState(false);
  const [auditoriaWorkspaceOpen, setAuditoriaWorkspaceOpen] = useState(false);
  const [histPeriodLoading, setHistPeriodLoading] = useState(false);
  const histPeriodLoadingFrameRef = useRef(null);
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
  const dashboardApiData = useDashboardApiData({ periodo: periodoApuracao });

  const openHistTableModal = useCallback((opts = {}) => {
    setRadarWorkspaceOpen(false);
    setAuditoriaWorkspaceOpen(false);
    setBentoView(opts.view ?? "table");
    setHistIsFloating(true);
    if (opts.dateFrom !== undefined) setHistDateFrom(normDateKey(opts.dateFrom) || "");
    if (opts.dateTo !== undefined) setHistDateTo(normDateKey(opts.dateTo) || "");
    if (opts.colId != null) setHistHighlightCol(opts.colId);
    else if (opts.clearHighlight) setHistHighlightCol(null);
    if (opts.tableViewRequest) setHistTableViewRequest(opts.tableViewRequest);
    if (opts.openDateRequest) setHistOpenDateRequest(opts.openDateRequest);
  }, []);

  const openHistTableInline = useCallback((opts = {}) => {
    setRadarWorkspaceOpen(false);
    setAuditoriaWorkspaceOpen(false);
    setBentoView(opts.view ?? "table");
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
    setAuditoriaWorkspaceOpen(false);
    setHistIsFloating(false);
    setHistDetailOpen(false);
    setHistHighlightCol(null);
    setHistMetricFilter(null);
  }, []);

  const dockHistTableModal = useCallback(() => {
    setHistIsFloating(false);
    setHistDetailOpen(true);
    setBentoView("table");
  }, []);

  const openHistTableCol = useCallback(
    (colId) => {
      const metricByCol = {
        ause_hrs: "injustificadas",
        ause_qtd: "injustificadas",
        just_hrs: "justificadas",
        just_qtd: "justificadas",
        extr_hrs: "extras",
        extr_qtd: "extras",
      };
      setHistMetricFilter(metricByCol[colId] || null);
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
    setAuditoriaWorkspaceOpen(false);
    setBentoView("chart");
    setHistDetailOpen(true);
    setHistIsFloating(false);
    setHistHighlightCol(null);
    window.requestAnimationFrame(() => {
      document.querySelector(".pb-unified-chart")?.scrollIntoView?.({ behavior: "smooth", block: "nearest" });
    });
  }, []);

  const openAbsHomeView = useCallback(() => {
    setRadarWorkspaceOpen(false);
    setAuditoriaWorkspaceOpen(false);
    setHistDetailOpen(false);
    setHistIsFloating(false);
    setHistHighlightCol(null);
    window.requestAnimationFrame(() => {
      document.querySelector(".pb-radar-card--abs")?.scrollIntoView?.({ behavior: "smooth", block: "nearest" });
    });
  }, []);

  const openConsecFaltasModal = useCallback(() => {
    setConsecFaltasOpen(true);
  }, []);

  const openRadarWorkspace = useCallback(() => {
    setAuditoriaWorkspaceOpen(false);
    setRadarWorkspaceOpen(true);
    setHistHighlightCol(null);
    setHistMetricFilter(null);
  }, []);

  const openAuditoriaWorkspace = useCallback(() => {
    setRadarWorkspaceOpen(false);
    setAuditoriaWorkspaceOpen(true);
    setHistDetailOpen(false);
    setHistIsFloating(false);
    setHistHighlightCol(null);
    setHistMetricFilter(null);
  }, []);

  const closeAuditoriaWorkspace = useCallback(() => {
    setAuditoriaWorkspaceOpen(false);
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

  const selectFaltDays = useCallback(
    (d) => {
      if (histPeriodLoadingFrameRef.current) {
        window.cancelAnimationFrame(histPeriodLoadingFrameRef.current);
        histPeriodLoadingFrameRef.current = null;
      }
      if (d === faltDays && !histDateFrom && !histDateTo) {
        setHistPeriodLoading(false);
        return;
      }
      setHistPeriodLoading(true);
      histPeriodLoadingFrameRef.current = window.requestAnimationFrame(() => {
        histPeriodLoadingFrameRef.current = null;
        startTransition(() => {
          setHistDateFrom("");
          setHistDateTo("");
          setFaltDays(d);
          setHistPeriodLoading(false);
        });
      });
    },
    [faltDays, histDateFrom, histDateTo],
  );

  useEffect(
    () => () => {
      if (histPeriodLoadingFrameRef.current) {
        window.cancelAnimationFrame(histPeriodLoadingFrameRef.current);
      }
    },
    [],
  );

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
          departamento: r?.departamento || r?.depto || r?.depto_desc || r?.departamentoNome || r?.["departamento.nome"] || "",
          depto: r?.depto || r?.departamento || r?.depto_desc || r?.departamentoNome || r?.["departamento.nome"] || "",
          depto_desc: r?.depto_desc || r?.departamento || r?.depto || r?.departamentoNome || r?.["departamento.nome"] || "",
          departamentoNome: r?.departamentoNome || r?.departamento || r?.depto || r?.depto_desc || r?.["departamento.nome"] || "",
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
            r?.horas_presentes != null ? capWorkedHours(r.horas_presentes, r.horas_planejadas) : null,
          horas_planejadas: r?.horas_planejadas != null ? Number(r.horas_planejadas) : null,
          horas_faltas: r?.horas_faltas != null ? Number(r.horas_faltas) : null,
          horas_atrasos: r?.horas_atrasos != null ? Number(r.horas_atrasos) : null,
          horas_justificadas: r?.horas_justificadas != null ? Number(r.horas_justificadas) : null,
          extras: r?.extras != null ? Number(r.extras) : null,
          horas_extras: r?.horas_extras != null ? Number(r.horas_extras) : null,
          _employees: r?._employees ?? null,
          _events: r?._events ?? null,
        };
      })
      .filter((r) => r.date);
  }, [histData]);
  const currentTableEventNames = useMemo(
    () => collectHistEventNames(histRowsAll),
    [histRowsAll],
  );
  const histRows = useMemo(
    () => filterHistRowsByPeriod(histRowsAll, { faltDays, histDateFrom, histDateTo, periodoApuracao }),
    [histRowsAll, faltDays, histDateFrom, histDateTo, periodoApuracao],
  );
  const activeHistDateRange = useMemo(() => {
    const dates = histRows
      .map((r) => normDateKey(r?.date))
      .filter(Boolean)
      .sort();
    return {
      from: dates[0] || "",
      to: dates[dates.length - 1] || "",
    };
  }, [histRows]);
  const openHistTableModalForActivePeriod = useCallback(
    (opts = {}) => {
      openHistTableModal({
        ...opts,
        dateFrom: opts.dateFrom ?? activeHistDateRange.from,
        dateTo: opts.dateTo ?? activeHistDateRange.to,
      });
    },
    [activeHistDateRange.from, activeHistDateRange.to, openHistTableModal],
  );
  const openHistTableModalForActivePeriodWithLoading = useCallback(
    (opts = {}) => {
      if (histPeriodLoadingFrameRef.current) {
        window.cancelAnimationFrame(histPeriodLoadingFrameRef.current);
        histPeriodLoadingFrameRef.current = null;
      }
      setHistPeriodLoading(true);
      histPeriodLoadingFrameRef.current = window.requestAnimationFrame(() => {
        histPeriodLoadingFrameRef.current = null;
        startTransition(() => {
          openHistTableModalForActivePeriod(opts);
          setHistPeriodLoading(false);
        });
      });
    },
    [openHistTableModalForActivePeriod],
  );

  const openHistTableMetricModal = useCallback(
    (metricFilter, colId) => {
      setHistMetricFilter(metricFilter || null);
      openHistTableModalForActivePeriodWithLoading({
        colId,
        tableViewRequest: { view: "date", ts: Date.now() },
      });
    },
    [openHistTableModalForActivePeriodWithLoading],
  );

  const histPeriodEvents = useMemo(
    () =>
      histRows.flatMap((r) => (Array.isArray(r._events) ? r._events : [])),
    [histRows],
  );
  const histPeriodAuditEvents = useMemo(
    () =>
      histRows.flatMap((row) =>
        (Array.isArray(row?._events) ? row._events : []).map((ev) => ({
          ...ev,
          data: ev?.data || ev?.date || ev?.data_referencia || row?.date,
        })),
      ),
    [histRows],
  );

  const openChartDayModal = useCallback(
    (date) => {
      const row = histRows.find((r) => r.date === date);
      const initial = buildChartDayModalState(row, histPeriodEvents);
      if (!initial) return;
      setRadarWorkspaceOpen(false);
      setAuditoriaWorkspaceOpen(false);
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
    setAuditReviewTick((tick) => tick + 1);
  }, []);

  const [storedBancoHoras, setStoredBancoHoras] = useState(() => loadKpiBancoHoras());
  const [storedAbonos, setStoredAbonos] = useState(() => loadKpiAbonos());
  const [abonosBusy, setAbonosBusy] = useState(false);
  const cfgAbonosFileRef = useRef(null);
  const cfgAbonosEfetuadosFileRef = useRef(null);
  const [storedMensal, setStoredMensal] = useState(() => loadKpiMensal());
  const [cfgOpen, setCfgOpen] = useState(false);
  const [auditReviewTick, setAuditReviewTick] = useState(0);
  const [auditoriaPontoOpening, setAuditoriaPontoOpening] = useState(false);
  const [auditoriaParamsPanelOpen, setAuditoriaParamsPanelOpen] = useState(false);
  const [auditoriaParamsDraft, setAuditoriaParamsDraft] = useState(() =>
    normalizeAuditoriaParamsConfig(readJsonStorage(PB_AUDITORIA_PARAMS_KEY, {})),
  );
  const auditoriaPontoParams = useMemo(
    () => normalizeAuditoriaParamsConfig(readJsonStorage(PB_AUDITORIA_PARAMS_KEY, {})),
    [auditReviewTick],
  );
  const auditoriaPontoReviews = useMemo(
    () => readJsonStorage(PB_AUDITORIA_REVIEWS_KEY, {}),
    [auditReviewTick, chartDayModal],
  );
  const auditoriaPontoSummary = useMemo(
    () => buildDashboardAuditoriaPontoSummary(histRows, auditoriaPontoParams, auditoriaPontoReviews),
    [histRows, auditoriaPontoParams, auditoriaPontoReviews],
  );
  const openAuditoriaPontoModal = useCallback((options = {}) => {
    const from = activeHistDateRange.from || "";
    const to = activeHistDateRange.to || from || "";
    const fallbackDate = to || from || new Date().toISOString().slice(0, 10);
    setAuditoriaPontoOpening(true);
    window.setTimeout(() => {
      setRadarWorkspaceOpen(false);
      setAuditoriaWorkspaceOpen(false);
      setHistDetailOpen(false);
      setHistIsFloating(false);
      setChartDayModal({
        date: `${fallbackDate}-${options.params ? "params" : "audit"}`,
        modalDate: fallbackDate,
        label: `Auditoria de ponto${from || to ? ` - ${fmtDateBr(from || fallbackDate)} ate ${fmtDateBr(to || fallbackDate)}` : ""}`,
        employees: [],
        events: histPeriodAuditEvents,
        eventsDateFrom: from,
        eventsDateTo: to,
        initialGroupBy: ["mat"],
        initialAuditOnly: true,
        initialAuditParamsOpen: Boolean(options.params),
      });
      setAuditoriaPontoOpening(false);
    }, 30);
  }, [activeHistDateRange.from, activeHistDateRange.to, histPeriodAuditEvents]);
  const openAuditoriaPontoParams = useCallback(() => {
    setAuditoriaParamsDraft(normalizeAuditoriaParamsConfig(readJsonStorage(PB_AUDITORIA_PARAMS_KEY, {})));
    setAuditoriaParamsPanelOpen(true);
  }, []);
  const saveAuditoriaPontoParams = useCallback(() => {
    const next = normalizeAuditoriaParamsConfig(auditoriaParamsDraft);
    try {
      if (typeof localStorage !== "undefined") {
        localStorage.setItem(PB_AUDITORIA_PARAMS_KEY, JSON.stringify(next));
      }
    } catch {
      // Persistencia local indisponivel nao deve quebrar a tela.
    }
    setAuditoriaParamsDraft(next);
    setAuditoriaParamsPanelOpen(false);
    setAuditReviewTick((tick) => tick + 1);
  }, [auditoriaParamsDraft]);
  const resetAuditoriaPontoParams = useCallback(() => {
    setAuditoriaParamsDraft(normalizeAuditoriaParamsConfig(DEFAULT_AUDITORIA_PONTO_PARAMS));
  }, []);
  const openMensalEventModal = useCallback(
    (row) => {
      if (!row?.event) return;
      onOpenMensalEventColaboradores?.(row);
    },
    [onOpenMensalEventColaboradores],
  );
  const bancoHorasStats = useMemo(
    () => dashboardApiData.bancoHorasStats || buildBancoHorasStats(histRows, loadEventCategories(), storedBancoHoras),
    [dashboardApiData.bancoHorasStats, histRows, cfgOpen, storedBancoHoras],
  );
  const abonosStoredEffective = dashboardApiData.abonosStored || storedAbonos;
  const mensalData = dashboardApiData.mensalData || storedMensal;
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
          departamento: r?.departamento || r?.depto || r?.depto_desc || r?.departamentoNome || r?.["departamento.nome"] || "",
          depto: r?.depto || r?.departamento || r?.depto_desc || r?.departamentoNome || r?.["departamento.nome"] || "",
          depto_desc: r?.depto_desc || r?.departamento || r?.depto || r?.departamentoNome || r?.["departamento.nome"] || "",
          departamentoNome: r?.departamentoNome || r?.departamento || r?.depto || r?.depto_desc || r?.["departamento.nome"] || "",
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
            r?.horas_presentes != null ? capWorkedHours(r.horas_presentes, r.horas_planejadas) : null,
          horas_planejadas: r?.horas_planejadas != null ? Number(r.horas_planejadas) : null,
          horas_faltas: r?.horas_faltas != null ? Number(r.horas_faltas) : null,
          horas_atrasos: r?.horas_atrasos != null ? Number(r.horas_atrasos) : null,
          horas_justificadas: r?.horas_justificadas != null ? Number(r.horas_justificadas) : null,
          extras: r?.extras != null ? Number(r.extras) : null,
          horas_extras: r?.horas_extras != null ? Number(r.horas_extras) : null,
          _employees: r?._employees ?? null,
          _events: r?._events ?? null,
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
  const histRadar = useMemo(() => {
    const sorted = [...(Array.isArray(histRows) ? histRows : [])].sort((a, b) =>
      (a.date || "").localeCompare(b.date || ""),
    );
    const half = Math.floor(sorted.length / 2);
    const prvRows = sorted.slice(0, half);
    const curRows = sorted.slice(half);

    const all = computePeriodTotals(sorted);
    const prv = half > 0 ? computePeriodTotals(prvRows) : null;
    const cur = half > 0 ? computePeriodTotals(curRows) : null;
    const absColaboradores = new Set();
    let absColaboradoresOcorrencias = 0;
    sorted.forEach((row) => {
      (row._employees || []).forEach((emp) => {
        const hasAbsence = (Number(emp.hrsAuse) || 0) > 0 || (Number(emp.hrsJust) || 0) > 0;
        if (!hasAbsence) return;
        absColaboradoresOcorrencias += 1;
        if (emp.mat) absColaboradores.add(emp.mat);
      });
    });

    const absPct =
      calculateAbsenteismoPct({
        horasAbs: all.horasAbs,
        horasPlan: all.horasPlan,
        precision: null,
      }) ?? 0;
    const absDelta =
      half > 0 && all.absPct != null && prv?.absPct != null && cur?.absPct != null
        ? cur.absPct - prv.absPct
        : null;
    const absEdgeDelta = computeAbsEdgeDelta(sorted);
    const horasPerdidas = all.horasPerdidas ?? 0;
    const horasDeficit = Math.max(0, horasPerdidas);
    const horasSaldo = 0;
    const perdaPct = all.perdaPct ?? 0;
    const perdaDelta =
      half > 0 && all.perdaPct != null && prv?.perdaPct != null && cur?.perdaPct != null
        ? cur.perdaPct - prv.perdaPct
        : null;
    const planDelta =
      half > 0 && prv && prv.horasPlan > 0 ?
         ((cur.horasPlan - prv.horasPlan) / prv.horasPlan) * 100
        : null;
    const trabDelta =
      half > 0 && prv && prv.horasPres > 0 ?
         ((cur.horasPres - prv.horasPres) / prv.horasPres) * 100
        : null;

    // Department aggregation with trend
    const buildDeptMap = (arr) => {
      const map = new Map();
      arr.forEach((row) => {
        (row._employees || []).forEach((emp) => {
          const dept = (emp.depto_desc || emp.depto || "?").trim() || "?";
          const d = map.get(dept) || {
            dept,
            hrsAuse: 0,
            hrsJust: 0,
            hrsExtr: 0,
            hrsPlan: 0,
            colaboradores: new Set(),
            ocorr: 0,
          };
          const ha = Number(emp.hrsAuse) || 0;
          const hj = Number(emp.hrsJust) || 0;
          d.hrsAuse += ha;
          d.hrsJust += hj;
          d.hrsExtr += Number(emp.hrsExtr) || 0;
          d.hrsPlan += Number(emp.hrsPlan) || 0;
          if (emp.mat) d.colaboradores.add(emp.mat);
          if (ha > 0 || hj > 0) d.ocorr += 1;
          map.set(dept, d);
        });
      });
      return map;
    };

    const deptAll = buildDeptMap(sorted);
    const deptPrv = buildDeptMap(prvRows);
    const deptCur = buildDeptMap(curRows);

    const deptRanking = [...deptAll.values()]
      .map((d) => {
        const dc = deptCur.get(d.dept);
        const dp = deptPrv.get(d.dept);
        const absPctD = d.hrsPlan > 0 ? ((d.hrsAuse + d.hrsJust) / d.hrsPlan) * 100 : null;
        const absPctDCur = dc?.hrsPlan > 0 ? ((dc.hrsAuse + dc.hrsJust) / dc.hrsPlan) * 100 : null;
        const absPctDPrv = dp?.hrsPlan > 0 ? ((dp.hrsAuse + dp.hrsJust) / dp.hrsPlan) * 100 : null;
        const trend = absPctDCur != null && absPctDPrv != null ? absPctDCur - absPctDPrv : null;
        return {
          ...d,
          colaboradoresQtd: d.colaboradores.size,
          absPct: absPctD,
          trend,
          score: d.hrsAuse + d.hrsJust + d.hrsExtr * 0.35 + d.ocorr * 30,
        };
      })
      .sort((a, b) => b.score - a.score)
      .slice(0, 4);

    // Critical days with day-of-week
    const DOW_PT = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "S?b"];
    const criticalDays = [...sorted]
      .map((r) => {
        const aus = (Number(r.faltas) || 0) + (Number(r.atrasos) || 0);
        const horas =
          (Number(r.horas_faltas) || 0) +
          (Number(r.horas_atrasos) || 0) +
          (Number(r.horas_justificadas) || 0);
        let dow = null,
          dowLabel = "";
        const m = String(r.date || "").match(/^(\d{4})-(\d{2})-(\d{2})/);
        if (m) {
          const dt = new Date(+m[1], +m[2] - 1, +m[3]);
          dow = dt.getDay();
          dowLabel = DOW_PT[dow];
        }
        return { date: r.date, aus, horas, dow, dowLabel };
      })
      .sort((a, b) => b.horas + b.aus * 30 - (a.horas + a.aus * 30))
      .slice(0, 4);

    // Detect repeating weekday pattern in critical days
    const dowCounts = {};
    criticalDays.forEach((d) => {
      if (d.dow != null) dowCounts[d.dow] = (dowCounts[d.dow] || 0) + 1;
    });
    const patternEntry = Object.entries(dowCounts).find(([, c]) => c >= 3);
    const patternLabel = patternEntry ? DOW_PT[Number(patternEntry[0])] : null;

    // Penalidades de Risco Trab. (categoria risco nas configuracoes)
    const riscoStats = computeRiscoStats(sorted);
    const mainDept = deptRanking[0]?.dept || "?";
    const faltasConsecColaboradores = computeConsecutiveFaltasStats(sorted).colaboradores;

    // Data-driven specific suggestions
    const suggestions = [];
    const top = deptRanking[0];
    if (riscoStats.ocorrencias > 0) {
      suggestions.unshift(
        `${fmt(riscoStats.ocorrencias)} penalidade(s) de risco trabalhista (${fmt(riscoStats.colaboradores)} colab.) ? revisar escala e adicional (NR-15/NR-16).`,
      );
    }
    if (top && top.hrsAuse + top.hrsJust > 0) {
      const abs = top.absPct != null ? ` · ${top.absPct.toFixed(1)}% abs.` : "";
      const tr =
        top.trend != null
          ? top.trend > 0.5
            ? `↑${top.trend.toFixed(1)}%`
            : top.trend < -0.5
              ? `↓${Math.abs(top.trend).toFixed(1)}%`
              : ""
          : "";
      suggestions.push(
        `A??o preventiva em ${top.dept}: ${fmtHM(top.hrsAuse + top.hrsJust)} perdidas${abs}${tr} (NR-1/GRO).`,
      );
    }
    if (all.horasExtras > 0) {
      const topExtr = [...deptAll.values()].sort((a, b) => b.hrsExtr - a.hrsExtr)[0];
      if (topExtr?.hrsExtr > 0)
        suggestions.push(
          `Sobrecarga em ${topExtr.dept}: ${fmtHM(topExtr.hrsExtr)} h. extras no per?odo ? revisar escala.`,
        );
    }
    if (patternLabel)
      suggestions.push(
        `${criticalDays.filter((d) => d.dowLabel === patternLabel).length} dos 4 dias cr?ticos s?o ${patternLabel}s ? avaliar escala neste dia.`,
      );
    else if (criticalDays[0]?.aus > 0)
      suggestions.push(
        `Pico de ${fmt(criticalDays[0].aus)} oc. em ${fmtShortDate(criticalDays[0].date)} ? investigar causa.`,
      );
    if (!suggestions.length) suggestions.push("Manter monitoramento preventivo do per?odo.");

    return {
      total: all.total,
      faltas: all.faltas,
      atrasos: all.atrasos,
      justificadas: all.justificadas,
      presentes: all.presentes,
      horasPlan: all.horasPlan,
      horasPres: all.horasPres,
      horasAus: all.horasAus,
      horasJust: all.horasJust,
      horasAbs: all.horasAbs,
      horasExtras: all.horasExtras,
      horasPerdidas,
      horasDeficit,
      horasSaldo,
      faltasConsecColaboradores,
      absPct,
      absDelta,
      absEdgeDelta,
      absColaboradores: absColaboradores.size,
      absColaboradoresOcorrencias,
      perdaPct,
      perdaDelta,
      planDelta,
      trabDelta,
      riscoOcorrencias: riscoStats.ocorrencias,
      riscoColaboradores: riscoStats.colaboradores,
      riscoHoras: riscoStats.horas,
      riscoTopEvento: riscoStats.topEvento,
      mainDept,
      deptRanking,
      criticalDays,
      patternLabel,
      suggestions,
      absFormulaId: ABSENTEISMO_FORMULA_ID,
      absFormulaLabel: ABSENTEISMO_FORMULA_LABEL,
    };
  }, [histRows]);
  const radarResumo = dashboardApiData.radarSummary;
  const radarRiscoOcorrencias = radarResumo?.ocorrencias ?? histRadar.riscoOcorrencias;
  const radarRiscoColaboradores = radarResumo?.colaboradores ?? histRadar.riscoColaboradores;
  const radarRiscoTopEvento = radarResumo?.topEvento ?? histRadar.riscoTopEvento;
  if (radarResumo) {
    Object.assign(histRadar, {
      riscoOcorrencias: radarRiscoOcorrencias,
      riscoColaboradores: radarRiscoColaboradores,
      riscoTopEvento: radarRiscoTopEvento,
      source: "api",
    });
  }
  const histRadarForContext = useMemo(
    () => ({
      ...histRadar,
      riscoOcorrencias: radarRiscoOcorrencias,
      riscoColaboradores: radarRiscoColaboradores,
      riscoTopEvento: radarRiscoTopEvento,
      source: radarResumo ? "api" : histRadar.source,
    }),
    [histRadar, radarResumo, radarRiscoColaboradores, radarRiscoOcorrencias, radarRiscoTopEvento],
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
  const histWorkDaysCount = useMemo(
    () =>
      histRows.filter((r) => {
        const meta = getDateMeta(r?.date);
        return meta && !meta.isWeekend && !meta.feriado;
      }).length,
    [histRows],
  );
  const planHoursTooltip = useMemo(
    () => buildPlanHoursTooltip(histWorkDaysCount),
    [histWorkDaysCount],
  );
  const histHorasNaoTrabalhadas = useMemo(
    () => Math.max(0, (Number(histRadar.horasPlan) || 0) - (Number(histRadar.horasPres) || 0)),
    [histRadar.horasPlan, histRadar.horasPres],
  );
  const financialImpact = useMemo(() => {
    const map = normalizeForcaPrevistaDeptoMap(forcaPrevistaDeptoMap || {});
    const entries = Object.values(map || {});
    const values = (field) =>
      entries
        .map((entry) => Number(entry?.[field]))
        .filter((value) => Number.isFinite(value) && value > 0);
    const avg = (field) => {
      const vals = values(field);
      if (!vals.length) return null;
      return vals.reduce((sum, value) => sum + value, 0) / vals.length;
    };
    const custoHora = avg("custoHora");
    const custoHoraDeptos = values("custoHora").length;
    const custoHExtraDeptos = values("custoHExtra").length;
    const custoHExtra = avg("custoHExtra") ?? custoHora;
    const horasAusentes = Math.max(0, Number(histHorasNaoTrabalhadas) || 0) / 60;
    const horasExtras = Math.max(0, Number(histRadar.horasExtras) || 0) / 60;
    const custoAbsenteismo = custoHora != null ? horasAusentes * custoHora : 0;
    const custoExtras = custoHExtra != null ? horasExtras * custoHExtra : 0;
    return {
      hasCost: custoHora != null || custoHExtra != null,
      custoHora,
      custoHExtra,
      horasAusentes,
      horasExtras,
      custoAbsenteismo,
      custoExtras,
      total: custoAbsenteismo + custoExtras,
      custoHoraDeptos,
      custoHExtraDeptos,
      usesExtraFallback: custoHExtraDeptos === 0 && custoHora != null,
      configuredDeptos: entries.filter(
        (entry) => Number(entry?.custoHora) > 0 || Number(entry?.custoHExtra) > 0,
      ).length,
    };
  }, [forcaPrevistaDeptoMap, histHorasNaoTrabalhadas, histRadar.horasExtras]);
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
    if ((Number(histRadar.horasAbs) || 0) > (Number(histRadar.horasPlan) || 0) && histRadar.horasPlan > 0)
      warnings.push("Horas ausentes maiores que planejadas no período.");
    return warnings;
  }, [absBaseInfo.days, histRadar.horasAbs, histRadar.horasPlan, histRadar.absPct]);

  const absBenchmarkRows = useMemo(() => {
    const current = Number(histRadar.absPct) || 0;
    const benchmarks = [
      {
        id: "geral",
        label: "Referência geral",
        value: "até 4,0%",
        limit: 4,
        source: "Exame / GPTW / Robert Half",
      },
      {
        id: "servicos",
        label: "Setor de serviços",
        value: "cerca de 5,0%",
        limit: 5,
        source: "Exame / GPTW",
      },
      {
        id: "varejo",
        label: "Setor varejista",
        value: "7,0% a 10,0%",
        limit: 10,
        source: "Exame / GPTW",
      },
    ];
    return benchmarks.map((item) => {
      const delta = current - item.limit;
      return {
        ...item,
        delta,
        status: delta <= 0 ? "Dentro" : "Acima",
        deltaLabel:
          delta <= 0
            ? `${Math.abs(delta).toFixed(1).replace(".", ",")} pp abaixo`
            : `+${delta.toFixed(1).replace(".", ",")} pp acima`,
      };
    });
  }, [histRadar.absPct]);

  const calcMemoryRows = useMemo(() => {
    return [
      {
        id: "absenteismo",
        card: "Absenteismo",
        value: `${histRadar.absPct.toFixed(1).replace(".", ",")}%`,
        formula: "horas ausentes / horas planejadas x 100",
        inputs: [
          `Horas ausentes: ${fmtHMReadable(histRadar.horasAbs)}`,
          `Horas planejadas: ${fmtHMReadable(histRadar.horasPlan)}`,
          `Base: ${absBaseInfo.days} dias / ${fmt(absBaseInfo.records)} registros`,
        ],
        source: absBaseInfo.source,
      },
      {
        id: "horas_periodo",
        card: "Horas no periodo",
        value: fmtHMReadable(Number(histRadar.horasPerdidas) || 0),
        formula: "injustificadas + justificadas + extras + faltas consecutivas quando aplicavel",
        inputs: [
          `Injustificadas: ${fmtHMReadable(Number(histRadar.horasAus) || 0)}`,
          `Justificadas: ${fmtHMReadable(Number(histRadar.horasJust) || 0)}`,
          `Extras: ${fmtHMReadable(Number(histRadar.horasExtras) || 0)}`,
        ],
        source: absBaseInfo.source,
      },
      {
        id: "ausentes",
        card: "Hrs. ausentes",
        value: fmtHMReadable(histHorasNaoTrabalhadas),
        formula: "horas planejadas - horas trabalhadas",
        inputs: [
          `Horas planejadas: ${fmtHMReadable(histRadar.horasPlan)}`,
          `Horas trabalhadas: ${fmtHMReadable(histRadar.horasPres)}`,
        ],
        source: absBaseInfo.source,
      },
    ];
  }, [
    absBaseInfo,
    histHorasNaoTrabalhadas,
    histRadar,
  ]);

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
        histRadar: histRadarForContext,
        periodLabel: histPeriodLabel,
        surface: "absenteismo",
        bancoHoras: bancoHorasStats,
        abonosStored: abonosStoredEffective,
      }),
    [histRows, histRadarForContext, histPeriodLabel, bancoHorasStats, abonosStoredEffective],
  );

  useEffect(() => {
    const registros = loadSaudeRegistrosSync().map(normalizeSaudeRegistro);
    const cal = buildSaudeCalendarioLembretes(registros);
    processSaudeCalendarioLembretes(cal, { showToast: Toast.show });
  }, []);

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
            document.querySelector(".pb-unified-chart")?.scrollIntoView?.({ behavior: "smooth", block: "nearest" });
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
              window.dispatchEvent(new CustomEvent("pb-radar-go-page", { detail: { page: "eventos" } }));
            }, 150);
          } else if (action.type === "open_radar_passivo") {
            window.setTimeout(() => {
              window.dispatchEvent(new CustomEvent("pb-radar-go-page", { detail: { page: "passivo" } }));
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
  const [absCalcDrag, setAbsCalcDrag] = useState({ x: 0, y: 0 });
  const [financeMemoryOpen, setFinanceMemoryOpen] = useState(false);
  const [calcOpen, setCalcOpen] = useState(false);
  const openAbsCalcModal = useCallback(() => {
    setAbsCalcDrag({ x: 0, y: 0 });
    setAbsCalcOpen(true);
  }, []);
  const closeAbsCalcModal = useCallback(() => {
    setAbsCalcOpen(false);
    setAbsCalcDrag({ x: 0, y: 0 });
  }, []);
  const startAbsCalcDrag = useCallback(
    (ev) => {
      if (ev.button != null && ev.button !== 0) return;
      if (ev.target?.closest?.("button,a,input,select,textarea")) return;
      ev.preventDefault();
      const startX = ev.clientX;
      const startY = ev.clientY;
      const startPos = absCalcDrag;
      const onMove = (moveEv) => {
        setAbsCalcDrag({
          x: startPos.x + moveEv.clientX - startX,
          y: startPos.y + moveEv.clientY - startY,
        });
      };
      const onUp = () => {
        window.removeEventListener("pointermove", onMove);
        window.removeEventListener("pointerup", onUp);
      };
      window.addEventListener("pointermove", onMove);
      window.addEventListener("pointerup", onUp, { once: true });
    },
    [absCalcDrag],
  );
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
  const [turnFrom, setTurnFrom] = useState(() => {
    const months = loadKpiTurnover()?.months || [];
    const has2026 = months.some((m) => String(m || "").endsWith("/2026"));
    if (has2026) return "2026-01";
    const min = months.length ? months[months.length - 1] : "";
    return mmYyyyToYm(min) || "2026-01";
  });
  const [turnTo, setTurnTo] = useState(() => {
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

  const importTurnoverCsv = async (file) => {
    if (!file) return;
    try {
      const buf = await file.arrayBuffer();
      const text = new TextDecoder("utf-8").decode(buf);
      const parsed = parseTurnoverCsv(text);
      if (!parsed) return;
      setTurnover(parsed);
      saveKpiTurnover(parsed);
      setTurnFrom(mmYyyyToYm(parsed.months[parsed.months.length - 1]) || "");
      setTurnTo(mmYyyyToYm(parsed.months[0]) || "");
    } catch {
      // ignore
    }
  };
  const effectiveTurnover = dashboardApiData.turnoverData || turnover;

  const turnoverView = useMemo(() => {
    const t = effectiveTurnover;
    if (!t || !Array.isArray(t.months) || !t.rows) return null;
    const months = t.months;
    const fromKey = ymToMmYyyy(turnFrom);
    const toKey = ymToMmYyyy(turnTo);
    const fromIdx = fromKey ? monthKeyToIndex(fromKey) : -1;
    const toIdx = toKey ? monthKeyToIndex(toKey) : -1;

    const filteredMonths = months.filter((m) => {
      const mi = monthKeyToIndex(m);
      if (fromIdx >= 0 && mi < fromIdx) return false;
      if (toIdx >= 0 && mi > toIdx) return false;
      return true;
    });

    const pick = (label) => (Array.isArray(t.rows?.[label]) ? t.rows[label] : []);
    const deslig = pick("Desligados");
    const admit = pick("Admitidos");
    const total = pick("Total De Colaboradores");
    const hor = pick("Horistas");
    const men = pick("Mensalistas");
    const est = pick("Estagiários").length ? pick("Estagiários") : pick("Estagiarios");

    const idxMap = new Map(months.map((m, i) => [m, i]));
    const at = (arr, m) => {
      const idx = idxMap.get(m);
      if (idx == null) return 0;
      return Number(arr?.[idx]) || 0;
    };

    const calcPct = (m) => {
      const d = at(deslig, m);
      const a = at(admit, m);
      const t0 = at(total, m);
      if (!t0) return null;
      const pct = ((d + a) / 2 / t0) * 100;
      return +pct.toFixed(3);
    };

    const rows = [
      { label: "Desligados", values: filteredMonths.map((m) => at(deslig, m)) },
      { label: "Admitidos", values: filteredMonths.map((m) => at(admit, m)) },
      { label: "Horistas", values: filteredMonths.map((m) => at(hor, m)) },
      { label: "Mensalistas", values: filteredMonths.map((m) => at(men, m)) },
      { label: "Estagiários", values: filteredMonths.map((m) => at(est, m)) },
      { label: "% Rotatividade", values: filteredMonths.map((m) => calcPct(m)) },
      { label: "Total de Colaboradores", values: filteredMonths.map((m) => at(total, m)) },
    ];

    const rotatividade = filteredMonths.map((m) => calcPct(m));
    const validRotatividade = rotatividade.filter((v) => Number.isFinite(Number(v)));
    const current = validRotatividade.length ? validRotatividade[validRotatividade.length - 1] : null;
    const previous = validRotatividade.length > 1 ? validRotatividade[validRotatividade.length - 2] : null;
    const maxRot = Math.max(1, ...validRotatividade.map((v) => Math.abs(Number(v) || 0)));
    const chart = filteredMonths.map((m, index) => ({
      label: m,
      value: rotatividade[index],
      height:
        rotatividade[index] == null
          ? 0
          : Math.max(8, Math.min(100, (Math.abs(Number(rotatividade[index]) || 0) / maxRot) * 100)),
    }));

    return { months: filteredMonths, rows, chart, current, previous };
  }, [effectiveTurnover, turnFrom, turnTo]);

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
    const XLSX = xlsxMod.default ?? xlsxMod;

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

  // ===== Configura??es =====
  const [cfgTab, setCfgTab] = useState("importacoes");
  const [absMeta, setAbsMeta] = useState(() => loadAbsenteismoMeta());
  const [cfgAbsMeta, setCfgAbsMeta] = useState(() => String(loadAbsenteismoMeta()));
  const [cfgTurnoverMeta, setCfgTurnoverMeta] = useState(() => String(loadTurnoverMeta()));

  const openCfg = useCallback((tab = "importacoes") => {
    setCfgTab(tab);
    setCfgOpen(true);
  }, []);

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
    const onMetaChange = (e) => setAbsMeta(e.detail ?? loadAbsenteismoMeta());
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
    window.addEventListener("pos:banco-horas-updated", onBancoHorasUpdate);
    window.addEventListener("pos:mensal-updated", onMensalUpdate);
    return () => {
      window.removeEventListener("pos:banco-horas-updated", onBancoHorasUpdate);
      window.removeEventListener("pos:mensal-updated", onMensalUpdate);
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
        const XLSX = xlsxMod.default ?? xlsxMod;
        const isCsv = /\.csv$/i.test(String(file.name || ""));
        const wb = isCsv ?
           XLSX.read(new TextDecoder("utf-8").decode(buf), { type: "string", raw: true })
          : XLSX.read(buf, { type: "array", cellDates: true });
        const { parsed: bancoHorasParsed, diagnosis: bancoHorasDiagnosis } = parseBancoHorasFromWorkbook(
          wb,
          XLSX,
          file.name,
        );
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

  const handleImportBancoHoras = useCallback(async (file) => {
    if (!file) return;
    setBancoHorasBusy(true);
    try {
      const buf = await file.arrayBuffer();
      const xlsxMod = await import("xlsx-js-style");
      const XLSX = xlsxMod.default ?? xlsxMod;
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
  }, [parseBancoHorasFromWorkbook]);

  const importAbonosWorkbook = useCallback(async (file, kind = ABONOS_KIND.pendentes) => {
    if (!file) return;
    setAbonosBusy(true);
    const isEfetuados = kind === ABONOS_KIND.efetuados;
    const label = isEfetuados ? "Abonos efetuados" : "Abonos pendentes";
    try {
      const buf = await file.arrayBuffer();
      const xlsxMod = await import("xlsx-js-style");
      const XLSX = xlsxMod.default ?? xlsxMod;
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
      const XLSX = xlsxMod.default ?? xlsxMod;
      const wb = XLSX.read(buf, { type: "array", cellDates: true });
      const ws = wb.Sheets[wb.SheetNames[0]];
      const aoa = XLSX.utils.sheet_to_json(ws, { header: 1, defval: null, blankrows: false });
      const parsed = parseMensalSheet(aoa, { fileName: file.name });
      if (!parsed) {
        Toast.show("Colunas do Mensal não encontradas: Evento, meses no formato MM/AAAA e Total", "w", 6000);
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
      Toast.show("Falha ao ler a planilha Mensal", "e");
    } finally {
      setMensalBusy(false);
    }
  }, []);

  const handleImportEventos = useCallback(async (file) => {
    if (!file) return;
    setEventosBusy(true);
    try {
      const buf = await file.arrayBuffer();
      const xlsxMod = await import("xlsx-js-style");
      const XLSX = xlsxMod.default ?? xlsxMod;
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
  }, [openCfg]);

  // ===== For?a Prevista por Departamento =====
  const [fpdOpen, setFpdOpen] = useState(false);
  const [fpdMap, setFpdMap] = useState(() => normalizeForcaPrevistaDeptoMap(forcaPrevistaDeptoMap || {}));
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
      Object.values(fpdMap || {}).reduce(
        (s, entry) => s + (getForcaPrevistaQty(entry) || 0),
        0,
      ),
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
    const raw = Object.prototype.hasOwnProperty.call(fpdMoneyDraft, key) ?
       fpdMoneyDraft[key]
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
      data-theme={theme}
      data-sidebar-collapsed={sidebarCollapsed ? "true" : "false"}
      ref={rootRef}
    >
      {cfgOpen &&
        typeof document !== "undefined" &&
        createPortal(
          <PbConfiguracoesModal
            theme={theme}
            initialTab={cfgTab}
            onClose={closeCfg}
            metasTabProps={{
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
            }}
            horasTabProps={{
              sourceEventNames: currentTableEventNames,
            }}
          />,
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
                          onChange={(e) => handleFpdMoneyChange(depto, "custoHExtra", e.target.value)}
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
          <span className="pb-btn-ico" aria-hidden="true">{theme === "dark" ? "☀" : "☾"}</span>
          {theme === "dark" ? "Claro" : "Escuro"}
        </button>
        <button
          type="button"
          className="pb-btn"
          onClick={() => setFpdOpen(true)}
          aria-label="Força Prevista por Departamento"
          title="Força Prevista por Departamento"
        >
          <span className="pb-btn-ico" aria-hidden="true">◉</span>
          Força Prevista
        </button>
        <button
          type="button"
          className="pb-btn"
          onClick={() => setCalcOpen(true)}
          aria-label="Calculadora de Horas"
          title="Calculadora de Horas"
        >
          <span className="pb-btn-ico" aria-hidden="true">⏱</span>
          Calculadora
        </button>
        <button
          type="button"
          className="pb-btn"
          onClick={() => openCfg("importacoes")}
          aria-label="Abrir Configurações"
          title="Configurações — aba Importações (provisória até API), Metas e Categorias de horas"
        >
          <span className="pb-btn-ico" aria-hidden="true">⚙</span>
          Configurações
        </button>
        <button
          type="button"
          className="pb-btn"
          onClick={toggleFullscreen}
          aria-label={isFullscreen ? "Sair da tela cheia" : "Expandir dashboard (tela cheia)"}
          title={isFullscreen ? "Restaurar" : "Expandir"}
        >
          <span className="pb-btn-ico" aria-hidden="true">
            {isFullscreen ? "⤡" : "⤢"}
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
        <div className="pb-cell pb-hero pb-hero-mock">
          <div className="pb-sidebar-shell">
            <div className="pb-sidebar-toolbar">
              <button
                type="button"
                className="pb-sidebar-toggle"
                onClick={toggleSidebarCollapsed}
                aria-expanded={!sidebarCollapsed}
                aria-label={
                  sidebarCollapsed ?
                     "Expandir coluna Posição do dia agora"
                    : "Recolher coluna Posição do dia agora"
                }
                title={
                  sidebarCollapsed ?
                     "Expandir Posição do dia agora"
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
            <section className="pb-side-panel pb-side-panel-posicao" aria-label="Posição do dia agora">
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
                    <td>Força atual</td>
                    <td className="num c-blue">{fmt(m.atual)}</td>
                  </tr>
                  {m.prevista != null && m.prevista > 0 && (
                    <tr>
                      <td>Força prevista</td>
                      <td className="num">{fmt(m.prevista)}</td>
                    </tr>
                  )}
                  {m.vagas != null && (
                    <tr>
                      <td>Vagas</td>
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
                      <button type="button" className="pb-side-rowbtn" onClick={click("afastados")}>
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

            <section className="pb-side-panel pb-side-panel-dept" aria-label="Por departamento agora">
              <div className="pb-side-panel-head pb-side-panel-head--dept">
                <h2 className="pb-side-title">Por departamento agora</h2>
                {typeof onOpenDept === "function" && (
                  <button type="button" className="pb-dept-link" onClick={onOpenDept}>
                    Ver todos →
                  </button>
                )}
              </div>
              <div className="pb-side-dept-toolbar">
                <div className="pb-trend-tabs pb-side-dept-modes" role="tablist" aria-label="Visão">
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
                          deptMiniMode === "pres" ?
                             () => onCardClick?.("presentes")
                            : onOpenDept
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
                      {deptMiniMode === "pres" ?
                         "Sem presentes no dia (importe a planilha de presentes)"
                        : "Sem ausentes no dia (faltas + atrasos na planilha)"}
                    </div>
                  )}
                </div>
              </div>
            </section>

            <section className="pb-side-panel pb-side-panel-lei" aria-label="Lei de saúde preventiva">
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
            </div>
          </div>
        </div>

        {/* ABSENTEÍSMO — ApexCharts + tabela */}
        <div className="pb-cell pb-unified-chart">
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
                  onClick={() => openHistTableModalForActivePeriod()}
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
                  className={`pb-trend-tab pb-trend-tab--home${!histDetailOpen && !radarWorkspaceOpen && !auditoriaWorkspaceOpen ? " is-active" : ""}`}
                  onClick={() => {
                    setHistDetailOpen(false);
                    setRadarWorkspaceOpen(false);
                    setAuditoriaWorkspaceOpen(false);
                    setHistIsFloating(false);
                  }}
                  aria-pressed={!histDetailOpen && !radarWorkspaceOpen && !auditoriaWorkspaceOpen}
                  title="Resumo do período"
                >
                  <span className="pb-trend-tab-text">Início</span>
                </button>
                <button
                  type="button"
                  className={`pb-trend-tab ${radarWorkspaceOpen ? "is-active" : ""}`}
                  onClick={openRadarWorkspace}
                  aria-pressed={radarWorkspaceOpen}
                  title="Radar trabalhista — análise completa"
                >
                  Radar
                </button>
                <button
                  type="button"
                  className={`pb-trend-tab ${histDetailOpen && !radarWorkspaceOpen && bentoView === "chart" ? "is-active" : ""}`}
                  onClick={() => {
                    setRadarWorkspaceOpen(false);
                    setAuditoriaWorkspaceOpen(false);
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
                      onClick={() => openHistTableModalForActivePeriodWithLoading()}
                      aria-pressed={(histDetailOpen && !radarWorkspaceOpen && bentoView === "table") || histIsFloating}
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
                    <button
                      type="button"
                      className={`pb-trend-tab pb-trend-tab--audit${auditoriaWorkspaceOpen ? " is-active" : ""}`}
                      onClick={openAuditoriaWorkspace}
                      title="Abrir painel executivo de auditoria"
                      aria-pressed={auditoriaWorkspaceOpen}
                    >
                      Painel auditoria
                    </button>
                  </div>
                  <DashboardNlAskPanel
                    context={dashboardNlContext}
                    surface="absenteismo"
                    theme={theme}
                    onAction={handleDashboardNlAction}
                    compact
                    className="pb-trend-nl-inline"
                  />
                </div>
              </div>
            </div>
            <div className="pb-trend-head-actions">
              <div ref={setHistCtrlEl} className="pb-trend-head-ctrl" />
            </div>
          </div>
          <div
            className={
              histTableInline ?
                 "pb-unified-chart-body pb-unified-chart-body--table"
              : showHistChart ?
                 "pb-unified-chart-body pb-unified-chart-body--chart"
                : "pb-unified-chart-body"
            }
            aria-busy={histPeriodLoading ? "true" : undefined}
          >
          {histPeriodLoading && (
            <div className="pb-period-loading" role="status" aria-live="polite">
              <span className="pb-period-loading-spinner" aria-hidden="true" />
              <span>Carregando período...</span>
            </div>
          )}
          {histRows.length === 0 ? (
            <div className="pb-dept-empty">Sem dados históricos</div>
          ) : histRows.length < 2 && !histTableOpen && (!histDetailOpen || bentoView === "chart") ? (
            <div className="pb-dept-empty">
              Histórico insuficiente para tendência. Abra a tabela para ver o dia disponível.
            </div>
          ) : auditoriaWorkspaceOpen ? (
            <AuditoriaPontoWorkspace
              summary={auditoriaPontoSummary}
              periodLabel={histPeriodLabel}
              onOpenDetails={() => openAuditoriaPontoModal()}
              onOpenParams={openAuditoriaPontoParams}
              onClose={closeAuditoriaWorkspace}
              opening={auditoriaPontoOpening}
            />
          ) : showRadarHome ? (
            <div className="pb-radar">
              <div className="pb-executive-row" aria-label="Resumo executivo de auditoria e impacto financeiro">
                <AuditoriaPontoPanel
                  summary={auditoriaPontoSummary}
                  onOpen={() => openAuditoriaPontoModal()}
                  onOpenParams={openAuditoriaPontoParams}
                  opening={auditoriaPontoOpening}
                  inline
                />
                <div className="pb-finance-view" aria-label="Visao financeira executiva">
                  <div className="pb-finance-head">
                    <div>
                      <span>Impacto financeiro estimado</span>
                      <strong>{financialImpact.hasCost ? fmtMoney(financialImpact.total) : "Configurar custo/hora"}</strong>
                    </div>
                    <div className="pb-finance-actions">
                      <button
                        type="button"
                        aria-expanded={financeMemoryOpen}
                        onClick={() => setFinanceMemoryOpen((open) => !open)}
                      >
                        Memoria de calculo
                      </button>
                      <button type="button" onClick={() => setFpdOpen(true)}>
                        Configurar custos
                      </button>
                    </div>
                  </div>
                  <div className="pb-finance-grid">
                    <span>
                      <b>Absenteismo</b>
                      <strong>{financialImpact.hasCost ? fmtMoney(financialImpact.custoAbsenteismo) : "R$ 0"}</strong>
                      <em>{fmtHMReadable(histHorasNaoTrabalhadas)} x {financialImpact.custoHora ? fmtMoney(financialImpact.custoHora) : "sem custo/h"}</em>
                    </span>
                    <span>
                      <b>Horas extras</b>
                      <strong>{financialImpact.hasCost ? fmtMoney(financialImpact.custoExtras) : "R$ 0"}</strong>
                      <em>{fmtHMReadable(histRadar.horasExtras)} x {financialImpact.custoHExtra ? fmtMoney(financialImpact.custoHExtra) : "sem custo/h"}</em>
                    </span>
                    <span>
                      <b>Base financeira</b>
                      <strong>{financialImpact.configuredDeptos}</strong>
                      <em>departamentos com custo configurado</em>
                    </span>
                  </div>
                  <small>
                    Estimativa executiva: horas ausentes e extras multiplicadas pelo custo medio configurado por departamento.
                  </small>
                  {financeMemoryOpen && (
                    <div className="pb-finance-memory" aria-label="Memoria de calculo do impacto financeiro">
                      <b>Memoria de calculo</b>
                      <div className="pb-finance-memory-grid">
                        <span>
                          <strong>Absenteismo</strong>
                          <em>
                            {fmtHMReadable(histHorasNaoTrabalhadas)} / 60 x{" "}
                            {financialImpact.custoHora ? fmtMoney(financialImpact.custoHora) : "R$ 0"}
                          </em>
                          <small>Resultado: {fmtMoney(financialImpact.custoAbsenteismo)}</small>
                        </span>
                        <span>
                          <strong>Horas extras</strong>
                          <em>
                            {fmtHMReadable(histRadar.horasExtras)} / 60 x{" "}
                            {financialImpact.custoHExtra ? fmtMoney(financialImpact.custoHExtra) : "R$ 0"}
                          </em>
                          <small>Resultado: {fmtMoney(financialImpact.custoExtras)}</small>
                        </span>
                        <span>
                          <strong>Total</strong>
                          <em>{fmtMoney(financialImpact.custoAbsenteismo)} + {fmtMoney(financialImpact.custoExtras)}</em>
                          <small>Resultado: {fmtMoney(financialImpact.total)}</small>
                        </span>
                      </div>
                      <p>
                        Custo/hora medio: {financialImpact.custoHoraDeptos} deptos. Custo extra medio:{" "}
                        {financialImpact.custoHExtraDeptos} deptos
                        {financialImpact.usesExtraFallback ? " (usando custo/hora como referencia para extras)" : ""}.
                      </p>
                    </div>
                  )}
                </div>
              </div>
              <div className="pb-radar-kpis">
                <div className="pb-radar-kpis-heroes">
                  <div className="pb-radar-card-wrap pb-radar-card-wrap--hero">
                    <button
                      type="button"
                      className="pb-radar-chart-btn"
                      aria-label="Ver evolução do absenteísmo"
                      title="Ver evolução no período"
                      onClick={() => setKpiEvolOpen("abs")}
                    >
                      📈
                    </button>
                    <button
                      type="button"
                      className="pb-radar-card pb-radar-card--hero pb-radar-card--abs"
                      onClick={() => openHistTableInline()}
                    >
                      <span className="pb-radar-label">Absenteísmo</span>
                      <strong className="pb-radar-value-hero" title={absCardTooltip}>
                        {histRadar.absPct.toFixed(1).replace(".", ",")}%
                      </strong>
                      <span className="pb-radar-value-note" title={absCardTooltip}>
                        Índice do Período · {histPeriodShortLabel}
                      </span>
                      <RadarTrendSparkline rows={histRows} metric="abs" labelMode="daily-edge" />
                      <div className="pb-radar-abs-hours" aria-label="Horas usadas no resumo do período">
                        <span
                          className="pb-radar-abs-hours-link"
                          role="presentation"
                          title={`${planHoursTooltip} Clique para destacar a coluna na tabela.`}
                          onClick={(ev) => {
                            ev.preventDefault();
                            ev.stopPropagation();
                            openHistTableCol("hrs_plan");
                          }}
                        >
                          <b>Hrs. Planejadas</b>
                          <strong>{fmtHMReadable(histRadar.horasPlan)}</strong>
                        </span>
                        <span
                          className="pb-radar-abs-hours-link"
                          role="presentation"
                          title={`${WORK_HOURS_TOOLTIP} Clique para destacar a coluna na tabela.`}
                          onClick={(ev) => {
                            ev.preventDefault();
                            ev.stopPropagation();
                            openHistTableCol("hrs_trab");
                          }}
                        >
                          <b>Hrs. Trabalhadas</b>
                          <strong>{fmtHMReadable(histRadar.horasPres)}</strong>
                        </span>
                        <span
                          className="pb-radar-abs-hours-link"
                          role="presentation"
                          title="Horas planejadas menos horas trabalhadas no período. Clique para destacar a coluna na tabela."
                          onClick={(ev) => {
                            ev.preventDefault();
                            ev.stopPropagation();
                            openHistTableCol("hrs_perd");
                          }}
                        >
                          <b>Hrs. Ausentes</b>
                          <strong>{fmtHMReadable(histHorasNaoTrabalhadas)}</strong>
                          <em className="pb-radar-abs-hours-note">planejadas - trabalhadas</em>
                        </span>
                      </div>
                      <span
                        role="button"
                        tabIndex={0}
                        className={`pb-radar-calc-link${absCalcWarnings.length ? " has-warning" : ""}`}
                        onClick={(ev) => {
                          ev.preventDefault();
                          ev.stopPropagation();
                          openAbsCalcModal();
                        }}
                        onKeyDown={(ev) => {
                          if (ev.key !== "Enter" && ev.key !== " ") return;
                          ev.preventDefault();
                          ev.stopPropagation();
                          openAbsCalcModal();
                        }}
                      >
                        Como foi calculado
                        {absCalcWarnings.length ? " · revisar base" : ""}
                      </span>
                      <small className="pb-radar-meta">
                        <span className="pb-radar-meta-target">
                          Meta ≤ {absMeta.toFixed(1).replace(".", ",")}%
                        </span>
                        <span
                          className={
                            histRadar.absPct <= absMeta ? "pb-radar-meta--ok" : "pb-radar-meta--bad"
                          }
                        >
                          {histRadar.absPct <= absMeta ?
                             " · dentro da meta"
                            : ` · +${(histRadar.absPct - absMeta).toFixed(1).replace(".", ",")} pp acima`}
                        </span>
                      </small>
                    </button>
                  </div>
                  <div className="pb-radar-card-wrap pb-radar-card-wrap--hero pb-radar-card-wrap--risk">
                    <button
                      type="button"
                      className="pb-radar-chart-btn"
                      aria-label="Ver evolução do radar trabalhista"
                      title="Ver evolução no período"
                      onClick={() => setKpiEvolOpen("risk")}
                    >
                      📈
                    </button>
                    <button
                      type="button"
                      className="pb-radar-card pb-radar-card--hero pb-radar-card--risk"
                      title={RADAR_KPI_TOOLTIPS.risk}
                      onClick={openRadarWorkspace}
                    >
                      <span className="pb-radar-label pb-radar-label--risk">Radar trabalhista</span>
                      <span className="pb-radar-risk-note">Resumo do período</span>
                      <div className="pb-radar-risk-facts">
                        <span>
                          <b>{radarRiscoOcorrencias.toLocaleString("pt-BR")}</b>
                          <em>ocorrências trabalhistas</em>
                        </span>
                        <span>
                          <b>{radarRiscoColaboradores.toLocaleString("pt-BR")}</b>
                          <em>colaboradores</em>
                        </span>
                      </div>
                      <small className="pb-radar-risk-main">
                        <b>Principal evento:</b>
                        <span>
                          {radarRiscoTopEvento ?
                             `${histRadar.riscoTopEvento.label} · ${histRadar.riscoTopEvento.count.toLocaleString("pt-BR")} ocorrências`
                            : "Nenhuma ocorrência no período"}
                        </span>
                      </small>
                      {histRows.length >= 2 && radarRiscoOcorrencias > 0 && (
                        <div className="pb-radar-risk-evol" aria-label="Evolução diária das ocorrências trabalhistas">
                          <span>Evolução diária</span>
                          <RadarTrendSparkline
                            rows={histRows}
                            metric="risk"
                            formatValue={(value) => `${Math.round(Number(value) || 0)} oc.`}
                            labelMode="daily-edge"
                            className="pb-radar-risk-evol-spark"
                          />
                        </div>
                      )}
                      <small className="pb-radar-meta pb-radar-risk-cta">Abrir Radar Trabalhista</small>
                    </button>
                  </div>
                </div>
              </div>
              <RadarHoursFace
                histRadar={histRadar}
                histRows={histRows}
                fmtHMReadable={fmtHMReadable}
                hasHours={histHasHours}
                variant="bar"
                onOpenMetricTable={openHistTableMetricModal}
                onOpenTableCol={openHistTableCol}
                onOpenConsecFaltas={openConsecFaltasModal}
              />
              <div className="pb-radar-footer">
                <span className="pb-radar-footer-meta">
                  {histDateFrom || histDateTo ?
                     `Período ${fmtShortDate(histDateFrom || histRows[0]?.date)} – ${fmtShortDate(histDateTo || histRows[histRows.length - 1]?.date)}`
                    : faltDays === PB_FALT_DAYS_ATUAL && periodoApuracao.de && periodoApuracao.ate ?
                       `Período atual (${fmtDateBr(periodoApuracao.de)} – ${fmtDateBr(periodoApuracao.ate)})`
                      : `Últimos ${faltDays} dias`}
                </span>
                <button type="button" className="pb-btn" onClick={() => openHistTableInline()}>
                  Ver tabela detalhada
                </button>
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
            <Suspense fallback={<div className="pb-dept-empty" style={{ flex: 1, minHeight: 120 }} />}>
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
                onFloatChange={(next, tableSnapshot) => {
                  if (next && tableSnapshot) {
                    setHistTableViewRequest({
                      ...tableSnapshot,
                      ts: Date.now(),
                    });
                  }
                  setHistIsFloating(next);
                }}
                onFloatClose={closeHistTableModal}
                openDateRequest={histOpenDateRequest}
                periodoApuracao={periodoApuracao}
                highlightCol={histHighlightCol}
                metricFilter={histMetricFilter}
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
                metricFilter={histMetricFilter}
                tableViewRequest={histTableViewRequest}
                embeddedInChart
                absMeta={absMeta}
              />
            </Suspense>
          )}
        </div>

        {/* APONTAMENTOS */}
        <div className="pb-cell pb-apontamentos">
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
                  ⤓
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
                          r.label.startsWith("%") ?
                             "Índice = ((Admitidos + Desligados) / 2 / Total de Colaboradores) * 100"
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
                </div>
                {turnoverView.current != null && turnoverView.previous != null ? (
                  <em className={turnoverView.current <= turnoverView.previous ? "is-good" : "is-bad"}>
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
                  .map((point, index) => `${index === 0 ? "M" : "L"} ${point.x.toFixed(2)} ${point.y.toFixed(2)}`)
                  .join(" ");
                const areaPath = points.length
                  ? `${linePath} L ${points[points.length - 1].x.toFixed(2)} ${height - padBottom} L ${points[0].x.toFixed(2)} ${height - padBottom} Z`
                  : "";
                return (
                  <div className="pb-turnover-line-wrap" role="img" aria-label="Rotatividade por mês">
                    <svg className="pb-turnover-mini-svg" viewBox={`0 0 ${width} ${height}`} preserveAspectRatio="none">
                      <line className="pb-turnover-mini-grid" x1="0" y1={height - padBottom} x2={width} y2={height - padBottom} />
                      <line className="pb-turnover-mini-grid" x1="0" y1={padTop + plotHeight * 0.52} x2={width} y2={padTop + plotHeight * 0.52} />
                      {areaPath ? <path className="pb-turnover-mini-area" d={areaPath} /> : null}
                      {linePath ? <path className="pb-turnover-mini-line" d={linePath} vectorEffect="non-scaling-stroke" /> : null}
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
                            {point.label}: {point.value == null || !Number.isFinite(point.value)
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

        <AbonosDeptPanel
          dia={dia}
          filteredDia={filteredDia}
          histRows={histRows}
          storedOverride={abonosStoredEffective}
          onOpenDeptColaboradores={onOpenAbonosDeptColaboradores}
        />
        <BancoHorasCard
          stats={bancoHorasStats}
          onOpenDepartamento={onOpenBancoHorasDeptColaboradores}
          onOpenKpi={onOpenBancoHorasKpiColaboradores}
        />
        <MensalListCard
          data={mensalData}
          onOpenEvent={openMensalEventModal}
          periodoApuracao={periodoApuracao}
        />
      </div>

      <style>{`
        @keyframes pb-spin ? { to { transform: rotate(360deg); } }
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
            onClick={closeAbsCalcModal}
          >
            <section
              className="pb-abs-calc-modal"
              role="dialog"
              aria-modal="true"
              aria-label="Cálculo do absenteísmo"
              style={{
                "--pb-calc-drag-x": `${absCalcDrag.x}px`,
                "--pb-calc-drag-y": `${absCalcDrag.y}px`,
              }}
              onClick={(ev) => ev.stopPropagation()}
            >
              <header
                className="pb-abs-calc-head"
                title="Arraste para mover"
                onPointerDown={startAbsCalcDrag}
              >
                <div>
                  <span className="pb-abs-calc-kicker">Auditoria do indicador</span>
                  <h3>Cálculo do absenteísmo</h3>
                  <p>{histPeriodLabel || "Período não informado"}</p>
                </div>
                <button
                  type="button"
                  className="pb-cfg-close"
                  aria-label="Fechar cálculo do absenteísmo"
                  onClick={closeAbsCalcModal}
                >
                  ×
                </button>
              </header>

              <div className="pb-abs-calc-formula">
                <b>Fórmula usada</b>
                <strong>{absBaseInfo.formulaLabel}</strong>
                <span>Versão {absBaseInfo.formulaId}. As horas ausentes são a base do índice exibido no card.</span>
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

              <div className="pb-calc-benchmark">
                <div className="pb-calc-benchmark-head">
                  <b>Comparativo Brasil</b>
                  <span>Índice atual: {histRadar.absPct.toFixed(1).replace(".", ",")}%</span>
                </div>
                <div className="pb-calc-benchmark-grid">
                  {absBenchmarkRows.map((item) => (
                    <span className={item.delta <= 0 ? "is-ok" : "is-alert"} key={item.id}>
                      <b>{item.label}</b>
                      <strong>{item.value}</strong>
                      <em>{item.status} · {item.deltaLabel}</em>
                      <small>{item.source}</small>
                    </span>
                  ))}
                </div>
                <p>
                  Benchmark externo para leitura executiva. A comparação deve ser validada por segmento,
                  porte, jornada e política interna de faltas.
                </p>
                <div className="pb-calc-benchmark-links">
                  <a
                    href="https://exame.com/carreira/guia-de-carreira/absenteismo-o-que-e-quais-os-tipos-causas-e-como-calcular/"
                    target="_blank"
                    rel="noreferrer"
                  >
                    Referencia do indice
                  </a>
                  <a href="https://gptw.com.br/conteudo/artigos/absenteismo/" target="_blank" rel="noreferrer">
                    Benchmark GPTW
                  </a>
                  <a
                    href="https://www.roberthalf.com/br/pt/insights/carreira/absenteismo-no-trabalho-tudo-que-voce-precisa-saber-sobre-o-assunto-rc"
                    target="_blank"
                    rel="noreferrer"
                  >
                    Formula por horas
                  </a>
                </div>
              </div>

              <div className="pb-abs-calc-base">
                <b>Base carregada</b>
                <span>
                  {absBaseInfo.source} · {absBaseInfo.days} dias · {fmt(absBaseInfo.records)} registros
                  {absBaseInfo.from || absBaseInfo.to ? (
                    <>
                      {" "}
                      · {fmtShortDate(absBaseInfo.from)} até {fmtShortDate(absBaseInfo.to)}
                    </>
                  ) : null}
                </span>
              </div>

              <div className="pb-calc-memory">
                <div className="pb-calc-memory-head">
                  <b>Memoria dos cards</b>
                  <span>Formula, entradas e origem usadas nos indicadores principais.</span>
                </div>
                <div className="pb-calc-memory-grid">
                  {calcMemoryRows.map((item) => (
                    <article className="pb-calc-memory-card" key={item.id}>
                      <div className="pb-calc-memory-card-head">
                        <span>{item.card}</span>
                        <strong>{item.value}</strong>
                      </div>
                      <p>{item.formula}</p>
                      <ul>
                        {item.inputs.map((input) => (
                          <li key={input}>{input}</li>
                        ))}
                      </ul>
                      <small>Fonte: {item.source}</small>
                    </article>
                  ))}
                </div>
              </div>

              <div className="pb-calc-reference">
                <b>Referencia metodologica</b>
                <p>
                  O indice segue a logica usual de taxa de absenteismo: tempo ausente dividido pelo
                  tempo planejado/disponivel no periodo. Nesta tela a regra foi adaptada para horas,
                  porque a base de ponto trabalha com horas planejadas e horas ausentes.
                </p>
                <div className="pb-calc-reference-links">
                  <a
                    href="https://www.shrm.org/topics-tools/tools/forms/absenteeism-rate-spreadsheet"
                    target="_blank"
                    rel="noreferrer"
                  >
                    SHRM
                  </a>
                  <a href="https://www.aihr.com/blog/absenteeism-rate/" target="_blank" rel="noreferrer">
                    AIHR
                  </a>
                </div>
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
                  Base consistente para o cálculo: há horas planejadas e índice dentro de faixa auditável.
                </div>
              )}

              <footer className="pb-abs-calc-foot">
                <button type="button" onClick={closeAbsCalcModal}>
                  Fechar
                </button>
                <button
                  type="button"
                  className="is-primary"
                  onClick={() => {
                    closeAbsCalcModal();
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

      <AuditoriaPontoParamsPanel
        open={auditoriaParamsPanelOpen}
        value={auditoriaParamsDraft}
        onChange={setAuditoriaParamsDraft}
        onClose={() => setAuditoriaParamsPanelOpen(false)}
        onSave={saveAuditoriaPontoParams}
        onReset={resetAuditoriaPontoParams}
      />

      {chartDayModal && (
        <HistoricoDayModal
          key={chartDayModal.date}
          date={chartDayModal.modalDate || chartDayModal.date}
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
          initialGroupBy={chartDayModal.initialGroupBy}
          initialAuditOnly={chartDayModal.initialAuditOnly}
          initialAuditParamsOpen={chartDayModal.initialAuditParamsOpen}
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
              <Suspense fallback={<div className="rt-overlay-loading">Carregando Radar trabalhista?</div>}>
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
