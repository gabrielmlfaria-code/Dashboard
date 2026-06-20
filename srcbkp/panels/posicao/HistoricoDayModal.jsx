import React, {
  useState,
  useMemo,
  useCallback,
  useEffect,
  useRef,
  useDeferredValue,
  startTransition,
} from "react";
import { createPortal } from "react-dom";
import "./HistoricoDayModal.css";
import HorasCalcModal from "./HorasCalcModal";
import { normDateKey, fmtDateBr } from "./calendarUtils";
import {
  buildEmpSortKeys,
  buildEventSortKeys,
  buildGroupTreeIndexed,
  isIndexLeafNode,
  nodeLeafCount,
  sortRowIndices,
} from "./hdmPerfUtils.js";
import { useHistoricoDayModalApi } from "../../hooks/useHistoricoDayModalApi.js";
import { getGridCellText } from "./posicaoGridUtils.js";
import {
  getPosEmbeddedBucket,
  getPosEmbeddedColLabel,
  getPosEmbeddedPreset,
  persistPosEmbeddedBucket,
  refreshPosEmbeddedBucket,
  dedupeColOrder,
  resolvePosEmbeddedColOrder,
  resolvePosEmbeddedVisibleCols,
  resolveVisibleColSet,
  RISCO_EVT_COL_ORDER,
  RISCO_EVT_VISIBLE_COL_IDS,
} from "./posicaoHdmEmbeddedCols.js";
import {
  computeEventModalTotalsFromEvents,
  computeModalPeriodTotals,
} from "./radarHoursUtils.js";
import {
  DEFAULT_AUDITORIA_PONTO_EVENTOS_IGNORADOS,
  DEFAULT_AUDITORIA_PONTO_EVENTOS_JORNADA_PRINCIPAL,
  DEFAULT_AUDITORIA_PONTO_EVENTOS_SEM_MARCACAO_OK,
  DEFAULT_AUDITORIA_PONTO_PARAMS,
  REGRAS_AUDITORIA_PONTO_META,
  analisarAnomaliasPonto,
} from "./auditoriaPonto/pontoAnomalias.js";
import {
  buildHdmColFilter,
  HDM_FILTER_OPS,
  isHdmColFilterActive,
  normalizeHdmColFilter,
  rowPassesHdmColFilter,
} from "./hdmColFilterUtils.js";
import { isArt473PreventivaEvent } from "./saudePreventivaArt473.js";
import {
  AuditoriaPontoParamsPanel,
  normalizeAuditoriaParamsConfig,
} from "./AuditoriaPontoParamsPanel.jsx";

function horarioTimesKey(s) {
  return String(s || "")
    .replace(/^\d+\s*-\s*/, "")
    .trim()
    .replace(/\s+/g, " ");
}
function stripHorarioCode(s) {
  return String(s || "")
    .replace(/^\d+\s*-\s*/, "")
    .trim();
}

function normalizeFaltaMarcacaoToken(s) {
  return stripHorarioCode(s)
    .replace(/\bF\s+M\b/gi, "FM")
    .replace(/\s+/g, " ")
    .trim();
}

/** Evita repetir horário planejado na linha de marcação quando import veio duplicado. */
function marcacaoDistinctFromHorario(horario, marcacao) {
  const m = String(marcacao || "").trim();
  if (!m) return "";
  const h = String(horario || "").trim();
  if (!h) return m;
  if (m === h || horarioTimesKey(m) === horarioTimesKey(h)) return "";
  return m;
}

const AUDIT_EXPLAIN_QUICK_QUESTIONS = [
  { id: "resumo", label: "Resumo" },
  { id: "limite", label: "Qual limite foi usado?" },
  { id: "motivo", label: "Por que virou auditoria?" },
  { id: "marcacoes", label: "Quais marcacoes foram consideradas?" },
  { id: "corrigir", label: "Como resolver?" },
];

function auditParamLabel(key) {
  const labels = {
    toleranciaMinutos: "Tolerancia geral de desvio",
    toleranciaDuplicidadeMinutos: "Janela para batida duplicada",
    janelaPareamentoMaxMinutos: "Janela maxima de pareamento",
    intervaloIntrajornadaMinutos: "Intervalo intrajornada minimo",
    jornadaIntrajornadaMinutos: "Jornada que exige intervalo",
    intervaloInterjornadaMinutos: "Intervalo interjornada minimo",
    pontoBritanicoDias: "Dias repetidos para ponto britanico",
    minutosResiduaisMinutos: "Minutos residuais tolerados",
    limiteHoraExtraDiariaMinutos: "Limite diario de hora extra",
    intervaloIntrajornadaMaxMinutos: "Intervalo intrajornada maximo",
    diasConsecutivosLimite: "Limite de dias consecutivos trabalhados",
    limiteBancoHorasPositivoMinutos: "Limite positivo de banco de horas",
    limiteBancoHorasNegativoMinutos: "Limite negativo de banco de horas",
    recorrenciaRiscoLimite: "Ocorrencias para risco recorrente",
  };
  return labels[key] || key;
}

function auditParamValue(key, value) {
  if (value == null || value === "") return "-";
  if (/Dias|dias/.test(auditParamLabel(key)) || key === "pontoBritanicoDias" || key === "diasConsecutivosLimite") {
    return `${value} dia${Number(value) === 1 ? "" : "s"}`;
  }
  if (key === "recorrenciaRiscoLimite") return `${value} ocorr.`;
  const minutes = Number(value);
  if (Number.isFinite(minutes) && minutes >= 60 && minutes % 60 === 0) {
    return `${minutes} min (${minutes / 60}:00h)`;
  }
  return `${value} min`;
}

function auditMemoriaLines(memoria) {
  return (memoria?.anomalias || []).flatMap((item) => item?.memoria || []).filter(Boolean);
}

function inferAuditQuestionType(value) {
  const q = String(value || "").toLowerCase();
  if (!q || q === "resumo") return "resumo";
  if (q.includes("limite") || q.includes("param") || q.includes("toler") || q.includes("qual")) return "limite";
  if (q.includes("por que") || q.includes("porque") || q.includes("motivo") || q.includes("crit")) return "motivo";
  if (q.includes("marca") || q.includes("horario") || q.includes("prev") || q.includes("real")) return "marcacoes";
  if (q.includes("corr") || q.includes("resolver") || q.includes("acao") || q.includes("tratar")) return "corrigir";
  return "resumo";
}

function buildAuditExplanation(memoria, question) {
  const type = inferAuditQuestionType(question);
  const first = memoria?.anomalias?.[0] || {};
  const lines = auditMemoriaLines(memoria);
  const lineText = lines.join(" | ");
  const params = memoria?.parametros || {};
  const paramHits = Object.entries(params).filter(([key]) => {
    const label = auditParamLabel(key).toLowerCase();
    const haystack = `${lineText} ${first?.mensagem || ""} ${first?.codigo || ""}`.toLowerCase();
    return haystack.includes(label.toLowerCase()) || haystack.includes(key.toLowerCase());
  });
  const evidenceLines = lines.length ? lines : [first?.detalhe, first?.mensagem].filter(Boolean);

  if (type === "limite") {
    const relevant = paramHits.length ? paramHits : Object.entries(params).filter(([key]) =>
      ["jornadaIntrajornadaMinutos", "intervaloIntrajornadaMinutos", "toleranciaMinutos", "limiteHoraExtraDiariaMinutos"].includes(key),
    );
    return {
      title: "Limite usado",
      answer: relevant.length
        ? "A auditoria usou estes parametros para comparar a linha:"
        : "Nao encontrei um parametro explicito na memoria desta regra.",
      bullets: relevant.map(([key, value]) => `${auditParamLabel(key)}: ${auditParamValue(key, value)}`),
    };
  }

  if (type === "motivo") {
    return {
      title: "Por que a auditoria apareceu",
      answer: first?.mensagem || memoria?.resumo || "A regra encontrou uma divergencia nos dados da linha.",
      bullets: evidenceLines,
    };
  }

  if (type === "marcacoes") {
    return {
      title: "Horarios considerados",
      answer: "A comparacao usou o horario planejado, as marcacoes reais e as horas calculadas nesta linha.",
      bullets: [
        `Horario planejado: ${memoria?.horarioPlanejado?.join(" ") || "-"}`,
        `Marcacoes reais: ${memoria?.marcacoes?.join(" ") || "-"}`,
        `Horas do evento: ${memoria?.horasEvento || "-"}`,
        `Horas pelas marcacoes: ${memoria?.horasMarcacoes || "-"}`,
      ],
    };
  }

  if (type === "corrigir") {
    const code = String(first?.codigo || "").toUpperCase();
    const action =
      code === "JORNADA_SEM_INTERVALO"
        ? "Confira se o colaborador deveria ter intervalo registrado. Se sim, corrija/inclua a marcacao de intervalo. Se o cliente aceita intervalo pre-assinalado ou automatico, ajuste a regra para nao exigir acao nesse caso."
        : "Revise os dados da linha, confira o parametro usado e registre o tratamento em Revisar, Justificar, Corrigir ou Sem acao.";
    return {
      title: "Tratamento sugerido",
      answer: action,
      bullets: [`Regra: ${first?.codigo || "-"}`, `Status atual: ${memoria?.review?.status || "pendente"}`],
    };
  }

  return {
    title: "Resumo explicado",
    answer: memoria?.resumo || first?.mensagem || "Esta memoria mostra a regra aplicada, os dados considerados e os parametros usados.",
    bullets: [
      `Regra aplicada: ${first?.codigo || "-"}`,
      `Evento: ${memoria?.evento || "-"}`,
      `Colaborador: ${memoria?.matricula || ""}${memoria?.colaborador ? ` - ${memoria.colaborador}` : ""}` || "-",
      `Data: ${memoria?.data || "-"}`,
    ],
  };
}

function auditUsedParamKeys(memoria) {
  const codes = new Set((memoria?.anomalias || []).map((item) => String(item?.codigo || "").toUpperCase()));
  const keys = new Set();
  const text = auditMemoriaLines(memoria).join(" | ").toLowerCase();

  if (codes.has("DIVERGENCIA_HORAS_EVENTO")) keys.add("toleranciaMinutos");
  if (codes.has("DIVERGENCIA_PLANEJADO")) keys.add("toleranciaMinutos");
  if (codes.has("SAIDA_APOS_ESCALA_SEM_EXTRA")) keys.add("toleranciaMinutos");
  if (codes.has("ENTRADA_ANTES_ESCALA_SEM_EXTRA")) keys.add("toleranciaMinutos");
  if (codes.has("MINUTOS_RESIDUAIS_EXCEDIDOS")) {
    keys.add("minutosResiduaisMinutos");
    keys.add("toleranciaMinutos");
  }
  if (codes.has("MARCACAO_DUPLICADA")) keys.add("toleranciaDuplicidadeMinutos");
  if (codes.has("JORNADA_SEM_INTERVALO")) keys.add("jornadaIntrajornadaMinutos");
  if (codes.has("INTRAJORNADA_INSUFICIENTE")) {
    keys.add("jornadaIntrajornadaMinutos");
    keys.add("intervaloIntrajornadaMinutos");
  }
  if (codes.has("INTERJORNADA_INSUFICIENTE") || codes.has("TROCA_TURNO_SEM_DESCANSO")) {
    keys.add("intervaloInterjornadaMinutos");
  }
  if (codes.has("HORA_EXTRA_ACIMA_LIMITE_LEGAL")) keys.add("limiteHoraExtraDiariaMinutos");
  if (codes.has("INTERVALO_ATIPICO_MARCACOES")) keys.add("intervaloIntrajornadaMaxMinutos");
  if (codes.has("PONTO_BRITANICO")) keys.add("pontoBritanicoDias");
  if (codes.has("SEQUENCIA_DIAS_SEM_FOLGA")) keys.add("diasConsecutivosLimite");
  if (codes.has("RISCO_RECORRENTE")) keys.add("recorrenciaRiscoLimite");
  if (codes.has("BANCO_HORAS_SALDO_EXCEDIDO")) {
    keys.add("limiteBancoHorasPositivoMinutos");
    keys.add("limiteBancoHorasNegativoMinutos");
  }

  Object.keys(memoria?.parametros || {}).forEach((key) => {
    const label = auditParamLabel(key).toLowerCase();
    if (text.includes(label) || text.includes(key.toLowerCase())) keys.add(key);
  });

  return Array.from(keys).filter((key) => Object.prototype.hasOwnProperty.call(memoria?.parametros || {}, key));
}

const HDM_MAX_RANGE_DAYS = 360;
const HDM_ROW_HEIGHT = 34;
const HDM_STACKED_ROW_HEIGHT = 53;
const HDM_VIRTUAL_MIN_ROWS = 250;
const HDM_MULTI_GROUP_MAX = 80000;
const HDM_COLLAB_GROUP_INITIAL_LIMIT = 80;
const HDM_AUDIT_COLLAB_GROUP_INITIAL_LIMIT = 24;
const HDM_AUDIT_FILTER_SCAN_LIMIT = 1200;
const HDM_AUDIT_FILTER_STABLE_WINDOW = 180;
const HDM_AUDIT_SUMMARY_FULL_LIMIT = 2500;

function addDaysIso(iso, n) {
  const d = new Date(`${iso}T00:00:00`);
  d.setDate(d.getDate() + n);
  return d.toISOString().slice(0, 10);
}

function eventDateKey(ev) {
  return normDateKey(ev?.data || ev?.date || ev?.data_referencia);
}

function buildEventsDateIndex(events) {
  const byDate = new Map();
  const noDateIdx = [];
  events.forEach((ev, idx) => {
    const dk = eventDateKey(ev);
    if (!dk) {
      noDateIdx.push(idx);
      return;
    }
    if (!byDate.has(dk)) byDate.set(dk, []);
    byDate.get(dk).push(idx);
  });
  return { byDate, sortedKeys: [...byDate.keys()].sort(), noDateIdx };
}

function collectEventIndicesInRange(index, fromKey, toKey) {
  const out = [...index.noDateIdx];
  for (const dk of index.sortedKeys) {
    if (fromKey && dk < fromKey) continue;
    if (toKey && dk > toKey) continue;
    out.push(...index.byDate.get(dk));
  }
  return out;
}

const HDM_POS_KEY = "pb_historico_day_modal_pos_v1";
const HDM_AUDIT_PARAMS_POS_KEY = "pb_historico_audit_params_pos_v1";
const HDM_STATE_KEY = "pb_historico_day_modal_state_v1";
const HDM_AUDIT_REVIEW_KEY = "mp_auditoria_ponto_reviews_v1";
const HDM_COLLAB_COL_WIDTH_KEY = "mp_hdm_collab_col_widths_v1";
const HDM_COLLAB_COL_DEFAULT_WIDTHS = {
  data: 150,
  evento: 360,
  horas: 100,
  horario: 340,
  auditoria: 420,
};
const HDM_COLLAB_COL_LIMITS = {
  data: [110, 240],
  evento: [260, 900],
  horas: [76, 160],
  horario: [260, 720],
  auditoria: [280, 760],
};
const AUDIT_REVIEW_STATUS = [
  { id: "pendente", label: "Pendente" },
  { id: "revisado", label: "Revisado" },
  { id: "justificado", label: "Justificado" },
  { id: "ajuste", label: "Corrigir folha" },
  { id: "sem_acao", label: "Sem ação" },
  { id: "ignorado", label: "Ignorado" },
];
const AUDIT_REVIEW_LABELS = Object.fromEntries(AUDIT_REVIEW_STATUS.map((s) => [s.id, s.label]));
const AUDIT_RULE_TREATMENTS = [
  { id: "acao", label: "Exige ação" },
  { id: "informativa", label: "Informativa" },
  { id: "nao_aplicavel", label: "Não aplicável" },
  { id: "revisao_manual", label: "Revisão manual" },
];
const AUDIT_ACTIONABLE_TREATMENTS = new Set(["acao", "revisao_manual"]);
const AUDIT_SEVERITY_LABELS = {
  todos: "Todos",
  critica: "Críticas",
  alta: "Altas",
  media: "Médias",
  baixa: "Baixas",
  ok: "OK",
};

function isAuditActionable(audit) {
  if (!audit?.memoria || audit.severidade === "ok") return false;
  if (audit.passivelAcao != null) return Boolean(audit.passivelAcao);
  return AUDIT_ACTIONABLE_TREATMENTS.has(audit.tratamentoRegra || "acao");
}

function getAuditDisplayReview(audit, review) {
  if (!isAuditActionable(audit) && (review?.status || "pendente") === "pendente") {
    return { ...(review || {}), status: "sem_acao" };
  }
  return review;
}

function readStoredJson(key, fallback) {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch {
    return fallback;
  }
}

function writeStoredJson(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {}
}

function useDebouncedValue(value, delay = 250) {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(timer);
  }, [value, delay]);
  return debounced;
}

const HdmSearchInput = React.memo(function HdmSearchInput({
  value,
  onCommit,
  delay = 260,
  className,
  placeholder,
  autoFocus,
}) {
  const [draft, setDraft] = useState(value || "");
  useEffect(() => {
    setDraft(value || "");
  }, [value]);
  useEffect(() => {
    const timer = setTimeout(() => {
      if (draft !== (value || "")) onCommit(draft);
    }, delay);
    return () => clearTimeout(timer);
  }, [draft, value, delay, onCommit]);
  return (
    <input
      type="search"
      className={className}
      placeholder={placeholder}
      value={draft}
      onChange={(e) => setDraft(e.target.value)}
      onKeyDown={(e) => {
        if (e.key === "Enter") onCommit(draft);
      }}
      autoFocus={autoFocus}
    />
  );
});

function normalizeSearchText(value) {
  return String(value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function monthlySearchVariants(value) {
  const base = normalizeSearchText(value);
  if (!base) return [];
  const variants = new Set([base]);
  const expanded = base
    .replace(/\bad\b/g, "adicional")
    .replace(/\bnot\b/g, "noturno")
    .replace(/\bhe\b/g, "hora extra")
    .replace(/\bh extras?\b/g, "hora extra")
    .replace(/\bdsr\b/g, "descanso semanal remunerado");
  variants.add(expanded);
  for (const item of Array.from(variants)) {
    const withoutNumbers = item.replace(/\b\d{1,3}\b/g, " ").replace(/\s+/g, " ").trim();
    if (withoutNumbers) variants.add(withoutNumbers);
  }
  if (/\bnoturno\b/.test(expanded)) variants.add("adicional noturno");
  if (/\batras/.test(expanded)) variants.add("atraso");
  if (/\bfalta/.test(expanded)) variants.add("falta");
  if (/\bhora extra\b/.test(expanded)) variants.add("hora extra");
  return Array.from(variants).filter(Boolean);
}

function searchTextMatches(haystack, query) {
  const text = String(haystack || "");
  const q = normalizeSearchText(query);
  if (!q) return true;
  const variants = monthlySearchVariants(q);
  return variants.some((variant) => {
    if (!variant) return false;
    if (text.includes(variant)) return true;
    const tokens = variant.split(/\s+/).filter((token) => token.length >= 3);
    return tokens.length > 0 && tokens.every((token) => text.includes(token));
  });
}

/* ── formatters ── */
function fmtMin(min) {
  if (min == null || isNaN(min) || min < 0) return "—";
  const v = Math.round(min);
  return Math.floor(v / 60).toLocaleString("pt-BR") + ":" + String(v % 60).padStart(2, "0");
}
function fmtPct(pct) {
  if (pct == null || isNaN(pct)) return "—";
  return Number(pct).toFixed(1) + "%";
}
function parseHorarioMin(v) {
  if (!v) return 0;
  const s = String(v)
    .trim()
    .replace(/^[^-]*-\s*/, "");
  const toMin = (t) => {
    const m = String(t || "").match(/^(\d{1,2}):(\d{2})$/);
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
}
function fmtDate(iso) {
  if (!iso) return "—";
  const [y, m, d] = iso.split("-");
  return `${d}/${m}/${String(y).slice(2)}`;
}
function fmtWeekday(iso) {
  if (!iso) return "";
  const d = new Date(`${iso}T00:00:00`);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleDateString("pt-BR", { weekday: "long" }).replace(/^\w/, (c) => c.toUpperCase());
}
function fmtWeekdayShort(iso) {
  if (!iso) return "";
  const d = new Date(`${iso}T00:00:00`);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleDateString("pt-BR", { weekday: "short" }).replace(".", "").toLowerCase();
}

/** Valor usado no filtro tipo Excel (checkbox por valor distinto). */
function getColFilterValue(row, col, { stackHrsMrc = false, isEventsMode = false } = {}) {
  if (!row) return "";
  if (col === "horario" && stackHrsMrc && isEventsMode) {
    const mrc = marcacaoDistinctFromHorario(row.horario, row.marcacao);
    if (mrc) return `${row.horario || ""} / ${mrc}`.trim();
    return String(row.horario || "");
  }
  if (col === "situacaoDesc") {
    const raw = row.situacaoDesc ?? row.situacao ?? row.situacao_desc ?? "";
    if (raw == null || raw === "") return "";
    return String(raw);
  }
  if (col === "evento") {
    const raw = row.evento ?? row.situacaoDesc ?? row.situacao ?? row.situacao_desc ?? "";
    if (raw == null || raw === "") return "";
    return String(raw);
  }
  const raw = row[col];
  if (raw == null || raw === "") return "";
  return String(raw);
}

const AUDIT_RULE_LABELS = new Map(
  REGRAS_AUDITORIA_PONTO_META.map((item) => [item.id, item.titulo || item.id]),
);

function getAuditRuleLabel(code) {
  const id = String(code || "");
  return AUDIT_RULE_LABELS.get(id) || id || "(sem regra)";
}

function getAuditRuleCodes(audit) {
  if (!audit) return [];
  const codes = [];
  if (audit.codigo && audit.severidade !== "ok") codes.push(String(audit.codigo));
  if (Array.isArray(audit.memoria?.anomalias)) {
    audit.memoria.anomalias.forEach((item) => {
      if (item?.codigo) codes.push(String(item.codigo));
    });
  }
  return [...new Set(codes.filter(Boolean))];
}

function auditPassesRuleFilter(audit, filterEntry) {
  if (!isHdmColFilterActive(filterEntry)) return true;
  const codes = getAuditRuleCodes(audit);
  const { values, cond } = normalizeHdmColFilter(filterEntry);
  if (values instanceof Set && !codes.some((code) => values.has(code))) return false;
  if (cond) {
    const haystack = codes.map((code) => `${code} ${getAuditRuleLabel(code)}`).join(" | ");
    if (!rowPassesHdmColFilter(haystack, { cond }, "auditoria", (value) => String(value || ""))) {
      return false;
    }
  }
  return true;
}

function getColFilterDisplay(val, col) {
  if (val === "" || val == null) return "(vazio)";
  if (col === "auditoria") return getAuditRuleLabel(val);
  if (col === "_cat" && EVENT_CAT_LABELS[val]) return EVENT_CAT_LABELS[val];
  if (col === "data" || col === "inicio" || col === "termino") return fmtDate(val);
  if (col === "abs") return fmtPct(Number(val));
  if (
    [
      "plan",
      "pres",
      "ause",
      "just",
      "extr",
      "horas",
      "hrsPlan",
      "saldoAnteriorBH",
      "creditoBH",
      "debitoBH",
      "horasPagasBH",
      "saldoProximoBH",
    ].includes(col)
  ) {
    const n = Number(val);
    if (!Number.isNaN(n)) return fmtMin(n);
  }
  return String(val);
}

function summarizeHdmFilter(entry, col) {
  const { values, cond } = normalizeHdmColFilter(entry);
  const parts = [];
  if (values instanceof Set) {
    const list = [...values].map((value) => getColFilterDisplay(value, col));
    parts.push(list.length <= 2 ? list.join(", ") : `${list.length} valores`);
  }
  if (cond?.value) {
    const op = HDM_FILTER_OPS.find((item) => item.id === cond.op)?.label || "Contém";
    parts.push(`${op} ${cond.value}`);
  }
  return parts.join(" · ");
}
function absIdx(e) {
  const abs = (e.hrsAuse || 0) + (e.hrsJust || 0);
  return e.hrsPlan > 0 ? (abs / e.hrsPlan) * 100 : 0;
}
function grpTotals(emps) {
  return {
    hrsPlan: emps.reduce((s, e) => s + (e.hrsPlan || 0), 0),
    hrsPres: emps.reduce((s, e) => s + (e.hrsPres || 0), 0),
    hrsAuse: emps.reduce((s, e) => s + (e.hrsAuse || 0), 0),
    hrsJust: emps.reduce((s, e) => s + (e.hrsJust || 0), 0),
    hrsExtr: emps.reduce((s, e) => s + (e.hrsExtr || 0), 0),
  };
}
function evtTotals(evts) {
  return {
    horasPlan: evts.reduce((s, e) => s + parseHorarioMin(e.horario), 0),
    horas: evts.reduce((s, e) => s + (e.horas || 0), 0),
  };
}

function evtTotalsBancoHoras(evts) {
  return (Array.isArray(evts) ? evts : []).reduce(
    (acc, ev) => ({
      saldoAnteriorBH: acc.saldoAnteriorBH + (Number(ev?.saldoAnteriorBH) || 0),
      creditoBH: acc.creditoBH + (Number(ev?.creditoBH) || 0),
      debitoBH: acc.debitoBH + (Number(ev?.debitoBH) || 0),
      horasPagasBH: acc.horasPagasBH + (Number(ev?.horasPagasBH) || 0),
      saldoProximoBH: acc.saldoProximoBH + (Number(ev?.saldoProximoBH) || 0),
    }),
    { saldoAnteriorBH: 0, creditoBH: 0, debitoBH: 0, horasPagasBH: 0, saldoProximoBH: 0 },
  );
}

const EVENT_CAT_LABELS = {
  presentes: "Presentes",
  ausentes: "Ausentes",
  justificadas: "Justificadas",
  extras: "Extras",
  risco: "Risco Trab.",
  noturnas: "H. Noturnas",
  ignorar: "Ignorar",
};
const EVENT_CAT_CLASSES = {
  presentes: "hdm-cat-pres",
  ausentes: "hdm-cat-ause",
  justificadas: "hdm-cat-just",
  extras: "hdm-cat-extr",
  risco: "hdm-cat-risk",
  noturnas: "hdm-cat-night",
};
const EVENT_PILLS = [
  ["presentes", "hdm-pill-pres", "✓ Presentes"],
  ["ausentes", "hdm-pill-ause", "✗ Ausentes"],
  ["justificadas", "hdm-pill-just", "⚠ Justificados"],
  ["extras", "hdm-pill-extr", "+ Extras"],
  ["risco", "hdm-pill-risk", "▴ Risco Trab."],
  ["noturnas", "hdm-pill-night", "☾ H. Noturnas"],
  ["ignorar", "hdm-pill-ign", "— Ignorar"],
];

const PILL_TOOLTIPS = {
  presentes:
    "Colaboradores distintos com ao menos 1 evento classificado como Presentes no período. Contagem = matrículas únicas com categoria Presentes (configuração de eventos).",
  ausentes:
    "Colaboradores distintos com evento classificado como Ausentes (faltas, atrasos injustificados). Contagem = matrículas únicas com categoria Ausentes.",
  justificadas:
    "Colaboradores distintos com evento Justificadas (atestado, férias, licença, folga etc.). Contagem = matrículas únicas com categoria Justificadas.",
  extras:
    "Colaboradores distintos com H. Extras (hora extra, banco de horas, plantão etc.). Contagem = matrículas únicas com categoria Extras.",
  risco:
    "Colaboradores distintos com evento de Risco Trabalhista (periculosidade, insalubridade). Contagem = matrículas únicas com categoria Risco Trab.",
  noturnas:
    "Colaboradores distintos com H. Noturnas / adicional noturno. Contagem = matrículas únicas com categoria H. Noturnas.",
  ignorar:
    "Eventos marcados como Ignorar nas configurações de categorias — não entram nos KPIs de presença/ausência.",
};

const COLLATOR_PT = new Intl.Collator("pt-BR");

function allGroupKeys(nodes, pathPrefix = "") {
  if (!nodes || !nodes.length || !nodes[0]?._group) return [];
  return nodes.flatMap(({ label, colKey, children }) => {
    const pk = `${pathPrefix}${colKey}:${label}`;
    return [pk, ...allGroupKeys(children, `${pk}>`)];
  });
}

/* ── drag + resize hook ── */
function useDragResize(initW, initH, storageKey = HDM_POS_KEY, minW = 580, minH = 340) {
  const posRef = useRef(null);
  const sizeRef = useRef(null);
  const [pos, setPos] = useState(() => {
    const s = readStoredJson(storageKey, null);
    const v = s?.pos ?? { x: 0, y: 0 };
    posRef.current = v;
    return v;
  });
  const [size, setSize] = useState(() => {
    const s = readStoredJson(storageKey, null);
    const v = s?.size ?? { w: initW, h: initH };
    sizeRef.current = v;
    return v;
  });
  posRef.current = pos;
  sizeRef.current = size;

  const onDragStart = useCallback((e) => {
    if (e.button !== 0) return;
    if (e.target.closest("button,input,select,a")) return;
    e.preventDefault();
    const ox = e.clientX - posRef.current.x;
    const oy = e.clientY - posRef.current.y;
    const move = (mv) => {
      posRef.current = { x: mv.clientX - ox, y: mv.clientY - oy };
      writeStoredJson(storageKey, { pos: posRef.current, size: sizeRef.current });
      setPos({ ...posRef.current });
    };
    const up = () => {
      document.removeEventListener("mousemove", move);
      document.removeEventListener("mouseup", up);
      document.body.style.userSelect = "";
    };
    document.addEventListener("mousemove", move);
    document.addEventListener("mouseup", up);
    document.body.style.userSelect = "none";
  }, [storageKey]);

  const onResizeStart = useCallback((e) => {
    e.preventDefault();
    e.stopPropagation();
    const sx = e.clientX,
      sy = e.clientY,
      sw = sizeRef.current.w,
      sh = sizeRef.current.h;
    const move = (mv) => {
      sizeRef.current = {
        w: Math.max(minW, sw + mv.clientX - sx),
        h: Math.max(minH, sh + mv.clientY - sy),
      };
      writeStoredJson(storageKey, { pos: posRef.current, size: sizeRef.current });
      setSize({ ...sizeRef.current });
    };
    const up = () => {
      document.removeEventListener("mousemove", move);
      document.removeEventListener("mouseup", up);
      document.body.style.userSelect = "";
    };
    document.addEventListener("mousemove", move);
    document.addEventListener("mouseup", up);
    document.body.style.userSelect = "none";
  }, [minH, minW, storageKey]);

  return { pos, size, onDragStart, onResizeStart };
}

/* ── persist state across modal opens (separate per mode) ── */
const _hdmSaved = {
  empSortCol: "nome",
  empSortDir: "asc",
  empSearch: "",
  empGroupBy: [],
  empColOrder: null,
  empVisibleCols: null,
  empColWidths: null,
  evtSortCol: "nome",
  evtSortDir: "asc",
  evtSearch: "",
  evtGroupBy: [],
  evtPillFilter: null,
  evtColOrder: null,
  evtVisibleCols: null,
  evtColWidths: null,
  evtStackHrsMrc: false,
  ...readStoredJson(HDM_STATE_KEY, {}),
};

/* ── column definitions ── */
const EMP_COLS = [
  { id: "genero", label: "Genero", filterable: true, numeric: false },
  { id: "mat", label: "Matrícula", filterable: true, numeric: false },
  { id: "data", label: "Data", filterable: true, numeric: false },
  { id: "depto", label: "Departamento", filterable: true, numeric: false },
  { id: "filial", label: "Filial", filterable: true, numeric: false },
  { id: "plan", label: "Hrs.Plan.", filterable: true, numeric: true },
  { id: "pres", label: "Hrs.Trab.", filterable: true, numeric: true },
  { id: "ause", label: "Ausentes", filterable: true, numeric: true },
  { id: "just", label: "Justif.", filterable: true, numeric: true },
  { id: "extr", label: "H.Extras", filterable: true, numeric: true },
  { id: "abs", label: "Abs.%", filterable: true, numeric: true },
];

const EVENT_COLS = [
  { id: "genero", label: "Genero", filterable: true, numeric: false },
  { id: "mat", label: "Matrícula", filterable: true, numeric: false },
  { id: "filial", label: "Filial", filterable: true, numeric: false },
  { id: "depto", label: "Departamento", filterable: true, numeric: false },
  { id: "cargo", label: "Cargo", filterable: true, numeric: false },
  { id: "_cat", label: "Categoria", filterable: true, numeric: false },
  { id: "data", label: "Data", filterable: true, numeric: false },
  { id: "inicio", label: "Data Início", filterable: true, numeric: false },
  { id: "termino", label: "Data Fim", filterable: true, numeric: false },
  { id: "qtd_dias", label: "Dias", filterable: true, numeric: true },
  { id: "justificativa", label: "Justificativa", filterable: true, numeric: false },
  { id: "horario", label: "Horário", filterable: true, numeric: false },
  { id: "hrsPlan", label: "Hrs Planejadas", filterable: true, numeric: true },
  { id: "marcacao", label: "Marcação", filterable: true, numeric: false },
  { id: "cod", label: "Cód. Evento", filterable: true, numeric: false },
  { id: "evento", label: "Desc. Evento", filterable: true, numeric: false },
  { id: "cid", label: "CID", filterable: true, numeric: false },
  { id: "cidDescricao", label: "CID Descrição", filterable: true, numeric: false },
  { id: "atividade", label: "Atividade", filterable: true, numeric: false },
  { id: "situacaoDesc", label: "Situação", filterable: true, numeric: false },
  { id: "horas", label: "Horas", filterable: true, numeric: true },
  { id: "saldoAnteriorBH", label: "Saldo Anterior", filterable: true, numeric: true },
  { id: "creditoBH", label: "Crédito BH", filterable: true, numeric: true },
  { id: "debitoBH", label: "Débito BH", filterable: true, numeric: true },
  { id: "horasPagasBH", label: "Horas Pagas", filterable: true, numeric: true },
  { id: "saldoProximoBH", label: "Saldo Próximo", filterable: true, numeric: true },
];

function buildDefaultColOrder(cols) {
  const ids = cols.map((c) => c.id);
  if (ids.includes("mat")) {
    return ["mat", "nome", ...ids.filter((id) => id !== "mat" && id !== "nome")];
  }
  return ["nome", ...ids];
}

function migrateColOrder(order, cols) {
  const defaults = buildDefaultColOrder(cols);
  if (!Array.isArray(order) || !order.length) return defaults;
  const validIds = new Set(["nome", ...cols.map((c) => c.id)]);
  const valid = dedupeColOrder(order.filter((id) => validIds.has(id)));
  const validSet = new Set(valid);
  const added = defaults.filter((id) => !validSet.has(id));
  let merged = dedupeColOrder([...valid, ...added]);
  if (!merged.includes("nome")) {
    const matIdx = merged.indexOf("mat");
    if (matIdx >= 0) merged.splice(matIdx + 1, 0, "nome");
    else merged.unshift("nome");
  }
  const nomeIdx = merged.indexOf("nome");
  const matIdx = merged.indexOf("mat");
  if (nomeIdx >= 0 && matIdx >= 0 && nomeIdx < matIdx) {
    merged = merged.filter((id) => id !== "nome");
    const nextMatIdx = merged.indexOf("mat");
    merged.splice(nextMatIdx + 1, 0, "nome");
  }
  return merged;
}

/* ── Ranking helpers ── */
function shortName(nome, mat) {
  if (!nome) return mat || "—";
  const parts = nome.trim().split(/\s+/);
  if (parts.length === 1) return parts[0];
  return `${parts[0]} ${parts[parts.length - 1]}`;
}

function RankCol({ title, icon, accent, items, valFn, maxVal, barVal, empty }) {
  return (
    <div className={`hdm-rank-col hdm-rank-col--${accent}`}>
      <div className="hdm-rank-head">
        <span className={`hdm-rank-icon hdm-rank-icon--${accent}`}>{icon}</span>
        <span className="hdm-rank-title">{title}</span>
      </div>
      {items.length === 0 ? (
        <p className="hdm-rank-empty">{empty}</p>
      ) : (
        items.map((r, i) => {
          const pct = maxVal > 0 ? (barVal(r) / maxVal) * 100 : 0;
          return (
            <div key={r.mat || r.nome || i} className="hdm-rank-item">
              <span className="hdm-rank-pos">{i + 1}</span>
              <div className="hdm-rank-info">
                <span className="hdm-rank-name" title={r.nome}>
                  {shortName(r.nome, r.mat)}
                </span>
                <div className="hdm-rank-bar-wrap">
                  <div
                    className={`hdm-rank-bar hdm-rank-bar--${accent}`}
                    style={{ width: `${pct}%` }}
                  />
                </div>
              </div>
              <span className={`hdm-rank-val hdm-rank-val--${accent}`}>{valFn(r)}</span>
            </div>
          );
        })
      )}
    </div>
  );
}

export function HistoricoDayModal({
  date,
  label,
  employees,
  events,
  histDayRows = null,
  eventsDateFrom = "",
  eventsDateTo = "",
  onDateRangeApply = null,
  dataSource = "local",
  apiContext = null,
  hasHours,
  hasExtras,
  onClose,
  theme = "dark",
  embedded = false,
  initialPillFilter = null,
  initialSearch = "",
  columnPreset = null,
  posListKey = "presentes",
  onOpenAbsTrend = null,
  hideGridTotals = false,
  deptFilterLabel = "",
  onClearDeptFilter = null,
  onFilteredCountChange = null,
  initialGroupBy = null,
  initialAuditOnly = false,
  initialAuditParamsOpen = false,
  onOpenRadar = null,
}) {
  const lockColumnLayout = columnPreset === "risco";
  const isApiMode = dataSource === "api";
  const embeddedPosListKey = embedded ? String(posListKey || "") : "";
  const isEventsMode =
    isApiMode ||
    (Array.isArray(events) && events.length > 0) ||
    (embedded &&
      (embeddedPosListKey === "banco_horas" ||
        embeddedPosListKey === "abonos_pendentes" ||
        embeddedPosListKey === "abonos_efetuados"));
  const isPosEmbedded = embedded && isEventsMode && !isApiMode;
  const showDateRange = isEventsMode && (!isPosEmbedded || typeof onDateRangeApply === "function");
  const posEmbeddedPreset = isPosEmbedded ? getPosEmbeddedPreset(posListKey) : null;
  const posEmbeddedSaved = isPosEmbedded ? refreshPosEmbeddedBucket(posListKey) : null;
  const COLS = isPosEmbedded
    ? EVENT_COLS.filter((c) => posEmbeddedPreset.colIds.includes(c.id))
    : isEventsMode
      ? EVENT_COLS
      : EMP_COLS;
  const defaultColIds = COLS.map((c) => c.id);

  const { pos, size, onDragStart, onResizeStart } = useDragResize(
    embedded ? 1200 : isEventsMode ? 1060 : 980,
    embedded ? 720 : 590,
  );
  const {
    pos: auditParamsPos,
    size: auditParamsSize,
    onDragStart: onAuditParamsDragStart,
    onResizeStart: onAuditParamsResizeStart,
  } = useDragResize(920, 720, HDM_AUDIT_PARAMS_POS_KEY, 560, 420);

  /* sort */
  const [sortCol, setSortCol] = useState(() =>
    isPosEmbedded
      ? posEmbeddedSaved.sortCol || "nome"
      : isEventsMode
        ? _hdmSaved.evtSortCol
        : _hdmSaved.empSortCol,
  );
  const [sortDir, setSortDir] = useState(() =>
    isPosEmbedded
      ? posEmbeddedSaved.sortDir || "asc"
      : isEventsMode
        ? _hdmSaved.evtSortDir
        : _hdmSaved.empSortDir,
  );
  const sortColRef = useRef(
    isPosEmbedded
      ? posEmbeddedSaved.sortCol || "nome"
      : isEventsMode
        ? _hdmSaved.evtSortCol
        : _hdmSaved.empSortCol,
  );
  const sortDirRef = useRef(
    isPosEmbedded
      ? posEmbeddedSaved.sortDir || "asc"
      : isEventsMode
        ? _hdmSaved.evtSortDir
        : _hdmSaved.empSortDir,
  );
  sortColRef.current = sortCol;
  sortDirRef.current = sortDir;
  const [sortBusy, setSortBusy] = useState(false);
  const toggleSort = useCallback((col) => {
    setSortBusy(true);
    if (sortColRef.current === col) {
      const nextDir = sortDirRef.current === "asc" ? "desc" : "asc";
      sortDirRef.current = nextDir;
      startTransition(() => setSortDir(nextDir));
      return;
    }
    sortColRef.current = col;
    sortDirRef.current = "asc";
    startTransition(() => {
      setSortCol(col);
      setSortDir("asc");
    });
  }, []);
  const sortSpec = `${sortCol}\0${sortDir}`;
  const deferredSortSpec = useDeferredValue(sortSpec);
  const deferredSortCol = deferredSortSpec.split("\0")[0] || sortCol;
  const deferredSortDir = deferredSortSpec.split("\0")[1] || sortDir;
  const isSortPending = sortSpec !== deferredSortSpec;

  /* search */
  const isBancoHorasEmbedded = isPosEmbedded && embeddedPosListKey === "banco_horas";
  const isAbonosEmbedded =
    isPosEmbedded &&
    (embeddedPosListKey === "abonos_pendentes" || embeddedPosListKey === "abonos_efetuados");
  const isSheetImportEmbedded = isBancoHorasEmbedded || isAbonosEmbedded;
  const [search, setSearch] = useState(() => {
    if (initialSearch) return String(initialSearch);
    if (isSheetImportEmbedded) return "";
    if (isPosEmbedded) return posEmbeddedSaved.search || "";
    return isEventsMode ? _hdmSaved.evtSearch : _hdmSaved.empSearch;
  });
  const debouncedSearch = search;
  const commitSearch = useCallback((value) => {
    startTransition(() => setSearch(value));
  }, []);

  /* date range (events mode) — use table range if available, else show all dates (no filter) */
  const todayIso = new Date().toISOString().slice(0, 10);
  const initFrom = isPosEmbedded
    ? eventsDateFrom || eventsDateTo || (isSheetImportEmbedded ? "" : todayIso)
    : eventsDateFrom || "";
  const initTo = isPosEmbedded
    ? eventsDateTo || eventsDateFrom || (isSheetImportEmbedded ? "" : todayIso)
    : eventsDateTo || "";
  const [dateFrom, setDateFrom] = useState(initFrom);
  const [dateTo, setDateTo] = useState(initTo);
  const [appliedDateFrom, setAppliedDateFrom] = useState(initFrom);
  const [appliedDateTo, setAppliedDateTo] = useState(initTo);
  const dateFromRef = useRef(null);
  const dateToRef = useRef(null);
  const [dateFilterBusy, setDateFilterBusy] = useState(false);
  const applyDateRange = useCallback(() => {
    const from = normDateKey(dateFromRef.current?.value || dateFrom);
    const to = normDateKey(dateToRef.current?.value || dateTo);
    setDateFrom(from);
    setDateTo(to);
    setDateFilterBusy(true);
    startTransition(() => {
      setAppliedDateFrom(from);
      setAppliedDateTo(to);
    });
    onDateRangeApply?.(from, to);
  }, [dateFrom, dateTo, onDateRangeApply]);

  useEffect(() => {
    const from = isPosEmbedded
      ? eventsDateFrom || eventsDateTo || (isSheetImportEmbedded ? "" : todayIso)
      : eventsDateFrom || "";
    const to = isPosEmbedded
      ? eventsDateTo || eventsDateFrom || (isSheetImportEmbedded ? "" : todayIso)
      : eventsDateTo || "";
    setDateFrom(from);
    setDateTo(to);
    setAppliedDateFrom(from);
    setAppliedDateTo(to);
  }, [eventsDateFrom, eventsDateTo, isPosEmbedded, isSheetImportEmbedded, todayIso]);

  /* column filters */
  const [colFilters, setColFilters] = useState({});
  const [filterPop, setFilterPop] = useState(null);
  const [filterPopSearch, setFilterPopSearch] = useState("");
  const [filterDraft, setFilterDraft] = useState(null);
  const [filterCondDraft, setFilterCondDraft] = useState({ op: "contains", value: "" });
  const filterPopRef = useRef(null);
  const filterBtnRefs = useRef({});
  const closeFilterPop = useCallback(() => {
    setFilterPop(null);
    setFilterDraft(null);
    setFilterCondDraft({ op: "contains", value: "" });
  }, []);

  /* grouping — ordered array of colIds for cascading */
  const [groupBy, setGroupBy] = useState(() => {
    if (Array.isArray(initialGroupBy)) return initialGroupBy;
    if (isSheetImportEmbedded) {
      const saved = posEmbeddedSaved?.groupBy;
      return Array.isArray(saved) ? saved : [];
    }
    if (isPosEmbedded) return [];
    const saved = isEventsMode ? _hdmSaved.evtGroupBy : _hdmSaved.empGroupBy;
    return Array.isArray(saved) ? saved : [];
  });
  const [apiExpandedGroupKey, setApiExpandedGroupKey] = useState(null);
  const [collapsed, setCollapsed] = useState(new Set());
  const [groupBusy, setGroupBusy] = useState(false);
  const applyGroupBy = useCallback((updater) => {
    setGroupBusy(true);
    requestAnimationFrame(() => {
      startTransition(() => {
        setGroupBy(updater);
        setCollapsed(new Set());
      });
    });
  }, []);

  /* maximize — default true (open expanded) */
  const [isMaximized, setIsMaximized] = useState(true);
  const [calcEv, setCalcEv] = useState(null);
  const [auditMemoria, setAuditMemoria] = useState(null);
  const [auditQuestion, setAuditQuestion] = useState("resumo");
  const [auditParamsOpen, setAuditParamsOpen] = useState(Boolean(initialAuditParamsOpen));
  const [auditSeverityFilter, setAuditSeverityFilter] = useState("todos");
  const [auditSummaryProcessing, setAuditSummaryProcessing] = useState("");
  const [auditOnly, setAuditOnly] = useState(Boolean(initialAuditOnly));
  const [auditReviewStatusFilter, setAuditReviewStatusFilter] = useState("todos");
  const [auditCriticalPendingOnly, setAuditCriticalPendingOnly] = useState(false);
  const [auditGridFocus, setAuditGridFocus] = useState(false);
  const [collabColWidths, setCollabColWidths] = useState(() => {
    try {
      if (typeof localStorage === "undefined") return HDM_COLLAB_COL_DEFAULT_WIDTHS;
      const saved = JSON.parse(localStorage.getItem(HDM_COLLAB_COL_WIDTH_KEY) || "null") || {};
      return { ...HDM_COLLAB_COL_DEFAULT_WIDTHS, ...saved };
    } catch {
      return HDM_COLLAB_COL_DEFAULT_WIDTHS;
    }
  });
  const [collabGroupLimit, setCollabGroupLimit] = useState(HDM_COLLAB_GROUP_INITIAL_LIMIT);
  const [collabGroupPage, setCollabGroupPage] = useState(1);
  const auditResultCacheRef = useRef(new Map());
  const [auditReviews, setAuditReviews] = useState(() => {
    try {
      if (typeof localStorage === "undefined") return {};
      return JSON.parse(localStorage.getItem(HDM_AUDIT_REVIEW_KEY) || "{}") || {};
    } catch {
      return {};
    }
  });
  const [auditParams, setAuditParams] = useState(() => {
    try {
      const defaults = {
        ...DEFAULT_AUDITORIA_PONTO_PARAMS,
        tratamentoRegras: {},
        eventosIgnoradosAuditoria: DEFAULT_AUDITORIA_PONTO_EVENTOS_IGNORADOS,
        eventosSemMarcacaoOk: DEFAULT_AUDITORIA_PONTO_EVENTOS_SEM_MARCACAO_OK,
        eventosJornadaPrincipal: DEFAULT_AUDITORIA_PONTO_EVENTOS_JORNADA_PRINCIPAL,
      };
      if (typeof localStorage === "undefined") return defaults;
      const saved = JSON.parse(localStorage.getItem("mp_auditoria_ponto_params") || "null");
      return { ...defaults, ...(saved || {}) };
    } catch {
      return {
        ...DEFAULT_AUDITORIA_PONTO_PARAMS,
        tratamentoRegras: {},
        eventosIgnoradosAuditoria: DEFAULT_AUDITORIA_PONTO_EVENTOS_IGNORADOS,
        eventosSemMarcacaoOk: DEFAULT_AUDITORIA_PONTO_EVENTOS_SEM_MARCACAO_OK,
        eventosJornadaPrincipal: DEFAULT_AUDITORIA_PONTO_EVENTOS_JORNADA_PRINCIPAL,
      };
    }
  });
  useEffect(() => {
    try {
      if (typeof localStorage !== "undefined") {
        localStorage.setItem(HDM_COLLAB_COL_WIDTH_KEY, JSON.stringify(collabColWidths));
      }
    } catch {}
  }, [collabColWidths]);
  const collabTableMinWidth = useMemo(
    () => Object.values(collabColWidths).reduce((sum, value) => sum + (Number(value) || 0), 0),
    [collabColWidths],
  );
  const resetCollabColumnWidth = useCallback((colId) => {
    setCollabColWidths((prev) => ({
      ...prev,
      [colId]: HDM_COLLAB_COL_DEFAULT_WIDTHS[colId] || prev[colId],
    }));
  }, []);
  const startCollabColumnResize = useCallback((colId, event) => {
    event.preventDefault();
    event.stopPropagation();
    const startX = event.clientX;
    const startWidth = Number(collabColWidths[colId]) || HDM_COLLAB_COL_DEFAULT_WIDTHS[colId] || 160;
    const [minWidth, maxWidth] = HDM_COLLAB_COL_LIMITS[colId] || [80, 900];
    const onMove = (moveEvent) => {
      const nextWidth = Math.max(minWidth, Math.min(maxWidth, Math.round(startWidth + moveEvent.clientX - startX)));
      setCollabColWidths((prev) => ({ ...prev, [colId]: nextWidth }));
    };
    const onUp = () => {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
      document.body.classList.remove("hdm-col-resizing");
    };
    document.body.classList.add("hdm-col-resizing");
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp, { once: true });
  }, [collabColWidths]);
  const auditParamsCacheKey = useMemo(() => JSON.stringify(auditParams), [auditParams]);
  const [rankOpen, setRankOpen] = useState(false);

  /* stack horário + marcação in one cell */
  const [stackHrsMrc, setStackHrsMrc] = useState(() => {
    if (initialAuditOnly) return true;
    if (lockColumnLayout) return true;
    if (isPosEmbedded)
      return posEmbeddedSaved.stackHrsMrc ?? posEmbeddedPreset.defaultStackHrsMrc;
    if (isEventsMode) return _hdmSaved.evtStackHrsMrc ?? false;
    return false;
  });

  useEffect(() => {
    if (initialAuditOnly) setStackHrsMrc(true);
  }, [initialAuditOnly]);

  /* pill quick-filter — null | 'presentes' | 'ausentes' | 'justificadas' | 'extras' | 'ignorar' */
  const [pillFilter, setPillFilter] = useState(() => {
    if (isPosEmbedded) return null;
    return initialPillFilter ?? _hdmSaved.evtPillFilter ?? null;
  });
  const [pillBusy, setPillBusy] = useState("");
  const applyPillFilter = useCallback((nextFilter) => {
    const busyKey = nextFilter || "todos";
    setPillBusy(busyKey);
    window.requestAnimationFrame(() => {
      startTransition(() => {
        setPillFilter((current) => (current === nextFilter ? null : nextFilter));
      });
    });
  }, []);

  useEffect(() => {
    if (isPosEmbedded) return;
    if (initialPillFilter != null) setPillFilter(initialPillFilter);
  }, [initialPillFilter, isPosEmbedded]);

  useEffect(() => {
    if (!isPosEmbedded) return;
    setGroupBy([]);
    setCollapsed(new Set());
    setPillFilter(null);
    setPillBusy("");
  }, [isPosEmbedded]);

  useEffect(() => {
    try {
      if (typeof localStorage === "undefined") return;
      localStorage.setItem("mp_auditoria_ponto_params", JSON.stringify(auditParams));
    } catch {
      // localStorage may be unavailable in restricted browser contexts.
    }
    auditResultCacheRef.current.clear();
  }, [auditParams]);

  useEffect(() => {
    try {
      if (typeof localStorage === "undefined") return;
      localStorage.setItem(HDM_AUDIT_REVIEW_KEY, JSON.stringify(auditReviews));
    } catch {
      // localStorage may be unavailable in restricted browser contexts.
    }
  }, [auditReviews]);

  const apiData = useHistoricoDayModalApi({
    enabled: isApiMode && apiContext?.enabled !== false,
    de: appliedDateFrom || eventsDateFrom || apiContext?.de || "",
    ate: appliedDateTo || eventsDateTo || apiContext?.ate || "",
    filialId: apiContext?.filialId ?? "",
    deptoId: apiContext?.deptoId ?? "",
    sortCol,
    sortDir,
    search: debouncedSearch,
    pillFilter,
    groupBy,
    expandedGroupKey: apiExpandedGroupKey,
  });

  useEffect(() => {
    setApiExpandedGroupKey(null);
  }, [groupBy]);

  /* column visibility */
  const [visibleCols, setVisibleCols] = useState(() => {
    if (lockColumnLayout) {
      const ids = RISCO_EVT_VISIBLE_COL_IDS.filter((id) => COLS.some((c) => c.id === id));
      return new Set(ids);
    }
    if (isPosEmbedded) return resolvePosEmbeddedVisibleCols(posEmbeddedSaved, posListKey);
    const disk = readStoredJson(HDM_STATE_KEY, {});
    const saved = isEventsMode ? disk.evtVisibleCols ?? _hdmSaved.evtVisibleCols : disk.empVisibleCols ?? _hdmSaved.empVisibleCols;
    const catalog = isEventsMode ? disk.evtColCatalog ?? _hdmSaved.evtColCatalog : disk.empColCatalog ?? _hdmSaved.empColCatalog;
    return resolveVisibleColSet(saved, catalog, COLS.map((c) => c.id));
  });
  const [colSelOpen, setColSelOpen] = useState(false);
  const colSelRef = useRef(null);

  /* column order + drag-to-reorder */
  const [colOrder, setColOrder] = useState(() => {
    if (lockColumnLayout) {
      return RISCO_EVT_COL_ORDER.filter(
        (id) => id === "nome" || COLS.some((c) => c.id === id),
      );
    }
    if (isPosEmbedded) return resolvePosEmbeddedColOrder(posEmbeddedSaved, posListKey);
    const disk = readStoredJson(HDM_STATE_KEY, {});
    const saved = isEventsMode ? disk.evtColOrder ?? _hdmSaved.evtColOrder : disk.empColOrder ?? _hdmSaved.empColOrder;
    return migrateColOrder(saved, COLS);
  });
  const [dragOverId, setDragOverId] = useState(null);
  const [colPopDragId, setColPopDragId] = useState(null);
  const [colPopDragOverId, setColPopDragOverId] = useState(null);
  const [colWidths, setColWidths] = useState(() => {
    if (isPosEmbedded) return posEmbeddedSaved?.colWidths || {};
    const disk = readStoredJson(HDM_STATE_KEY, {});
    return (
      (isEventsMode ? disk.evtColWidths ?? _hdmSaved.evtColWidths : disk.empColWidths ?? _hdmSaved.empColWidths) ||
      {}
    );
  });
  const thRefs = useRef({});
  const [exportOpen, setExportOpen] = useState(false);
  const exportRef = useRef(null);
  const GROUPABLE = new Set(COLS.filter((c) => !c.numeric).map((c) => c.id));

  const isColPopAvail = useCallback(
    (colId) => {
      if (!COLS.some((c) => c.id === colId)) return false;
      if (isPosEmbedded) return true;
      if (isEventsMode) return true;
      if (colId === "extr") return hasHours && hasExtras;
      if (["plan", "pres", "ause", "just", "abs"].includes(colId)) return hasHours;
      return true;
    },
    [COLS, isEventsMode, isPosEmbedded, hasHours, hasExtras],
  );

  const colPopItems = useMemo(() => {
    const seen = new Set();
    const items = [];
    for (const id of colOrder) {
      if (id === "nome" || seen.has(id) || !isColPopAvail(id)) continue;
      const col = COLS.find((c) => c.id === id);
      if (col) {
        items.push(col);
        seen.add(id);
      }
    }
    for (const col of COLS) {
      if (col.id === "nome" || seen.has(col.id) || !isColPopAvail(col.id)) continue;
      items.push(col);
      seen.add(col.id);
    }
    return items;
  }, [colOrder, COLS, isColPopAvail]);

  const reorderColOrder = useCallback((fromId, toId) => {
    if (!fromId || !toId || fromId === toId) return;
    setColOrder((prev) => {
      const arr = [...prev];
      const fi = arr.indexOf(fromId);
      const ti = arr.indexOf(toId);
      if (fi === -1 || ti === -1) return prev;
      arr.splice(fi, 1);
      arr.splice(ti > fi ? ti - 1 : ti, 0, fromId);
      return dedupeColOrder(arr);
    });
  }, []);

  /* close on Escape */
  useEffect(() => {
    const h = (e) => {
      if (e.key === "Escape") {
        if (filterPop) {
          closeFilterPop();
        }
        else onClose();
      }
    };
    document.addEventListener("keydown", h);
    return () => document.removeEventListener("keydown", h);
  }, [onClose, filterPop, closeFilterPop]);

  /* close filter pop on outside click */
  useEffect(() => {
    if (!filterPop) return;
    const h = (e) => {
      if (filterPopRef.current?.contains(e.target)) return;
      if (e.target.closest?.(".hdm-filt-btn")) return;
      closeFilterPop();
    };
    document.addEventListener("click", h, true);
    return () => document.removeEventListener("click", h, true);
  }, [filterPop, closeFilterPop]);

  /* close col selector on outside click */
  useEffect(() => {
    if (!colSelOpen) return;
    const h = (e) => {
      if (colSelRef.current && !colSelRef.current.contains(e.target)) setColSelOpen(false);
    };
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, [colSelOpen]);

  /* persist state for next modal open */
  useEffect(() => {
    if (isPosEmbedded) {
      persistPosEmbeddedBucket(posListKey, {
        sortCol,
        sortDir,
        search: debouncedSearch,
        colOrder,
        visibleCols: [...visibleCols],
        colCatalog: defaultColIds,
        colWidths,
        stackHrsMrc,
        ...(isSheetImportEmbedded ? { groupBy } : {}),
      });
      return;
    }
    if (embedded) return;
    if (isEventsMode) {
      _hdmSaved.evtSortCol = sortCol;
      _hdmSaved.evtSortDir = sortDir;
      _hdmSaved.evtSearch = debouncedSearch;
      _hdmSaved.evtGroupBy = groupBy;
      if (!lockColumnLayout) {
        _hdmSaved.evtColOrder = colOrder;
        _hdmSaved.evtVisibleCols = [...visibleCols];
        _hdmSaved.evtColCatalog = defaultColIds;
        _hdmSaved.evtColWidths = colWidths;
        _hdmSaved.evtStackHrsMrc = stackHrsMrc;
      }
      _hdmSaved.evtPillFilter = pillFilter;
    } else {
      _hdmSaved.empSortCol = sortCol;
      _hdmSaved.empSortDir = sortDir;
      _hdmSaved.empSearch = debouncedSearch;
      _hdmSaved.empGroupBy = groupBy;
      _hdmSaved.empColOrder = colOrder;
      _hdmSaved.empVisibleCols = [...visibleCols];
      _hdmSaved.empColCatalog = defaultColIds;
      _hdmSaved.empColWidths = colWidths;
      _hdmSaved.empPillFilter = pillFilter;
    }
    writeStoredJson(HDM_STATE_KEY, _hdmSaved);
  }, [
    sortCol,
    sortDir,
    debouncedSearch,
    groupBy,
    colOrder,
    visibleCols,
    colWidths,
    pillFilter,
    stackHrsMrc,
    isEventsMode,
    embedded,
    isPosEmbedded,
    posListKey,
    lockColumnLayout,
    defaultColIds,
  ]);

  /* close export dropdown on outside click */
  useEffect(() => {
    if (!exportOpen) return;
    const h = (e) => {
      if (exportRef.current && !exportRef.current.contains(e.target)) setExportOpen(false);
    };
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, [exportOpen]);

  const emps0 = employees || [];
  const events0 = isApiMode ? apiData.events : events || [];

  const eventsDateIndex = useMemo(
    () => (isEventsMode && events0.length ? buildEventsDateIndex(events0) : null),
    [isEventsMode, events0],
  );

  /* pre-compute searchable strings + normalized dates for perf */
  const eventMeta = useMemo(
    () =>
      events0.map((ev) => ({
        personSearch: normalizeSearchText([ev.nome, ev.mat].filter(Boolean).join(" ")),
        search: normalizeSearchText([
          ev.nome,
          ev.mat,
          ev.cod,
          ev.evento,
          ev.filial,
          ev.depto,
          ev.cargo,
          ev.genero,
          ev.horario,
          ev.marcacao,
          ev.cid,
          ev.cidDescricao,
          ev.atividade,
          ev.situacaoDesc,
          ev.saldoAnteriorBH,
          ev.creditoBH,
          ev.debitoBH,
          ev.horasPagasBH,
          ev.saldoProximoBH,
          ev.inicio,
          ev.termino,
          ev.justificativa,
        ]
          .filter(Boolean)
          .join(" ")),
        normDate: eventDateKey(ev),
        sk: buildEventSortKeys(ev),
      })),
    [events0],
  );

  const eventPersonSearchIndex = useMemo(() => {
    if (!isEventsMode || !events0.length) return [];
    const byPerson = new Map();
    events0.forEach((ev, idx) => {
      const personKey = String(ev?.mat || "").trim() || normalizeSearchText(ev?.nome || "");
      const key = personKey || `__row_${idx}`;
      let entry = byPerson.get(key);
      if (!entry) {
        entry = { search: eventMeta[idx]?.personSearch || "", indices: [] };
        byPerson.set(key, entry);
      } else if (!entry.search && eventMeta[idx]?.personSearch) {
        entry.search = eventMeta[idx].personSearch;
      }
      entry.indices.push(idx);
    });
    return [...byPerson.values()];
  }, [isEventsMode, events0, eventMeta]);

  const eventCategoryIndex = useMemo(() => {
    if (!isEventsMode || !events0.length) return new Map();
    const index = new Map();
    events0.forEach((ev, idx) => {
      const cat = ev?._cat || "";
      if (!cat) return;
      if (!index.has(cat)) index.set(cat, []);
      index.get(cat).push(idx);
    });
    return index;
  }, [isEventsMode, events0]);

  const getPersonSearchCandidateIndices = useCallback(
    (query) => {
      const q = normalizeSearchText(query);
      if (!q || q.length < 2 || !eventPersonSearchIndex.length) return null;
      const matches = [];
      for (const entry of eventPersonSearchIndex) {
        if (searchTextMatches(entry.search, q)) matches.push(...entry.indices);
      }
      return matches.length ? matches : null;
    },
    [eventPersonSearchIndex],
  );


  /* unique values for filter popover */
  const uniqueValsCacheRef = useRef(new Map());
  useEffect(() => {
    uniqueValsCacheRef.current = new Map();
  }, [isEventsMode, events0, emps0, appliedDateFrom, appliedDateTo, pillFilter, groupBy, auditOnly, auditParamsCacheKey]);

  const uniqueVals = useCallback(
    (col) => {
      const auditFilterScope = isEventsMode && !isApiMode && !isPosEmbedded && groupBy[0] === "mat" && auditOnly;
      if (col === "auditoria") {
        const activeColFiltersKey = Object.entries(colFilters)
          .filter(([filterCol, filterEntry]) => filterCol !== "auditoria" && isHdmColFilterActive(filterEntry))
          .map(([filterCol, filterEntry]) => {
            const { values, cond } = normalizeHdmColFilter(filterEntry);
            const valueKey = values instanceof Set ? [...values].sort().join("\u001f") : "*";
            const condKey = cond ? `${cond.op}:${cond.value}` : "";
            return `${filterCol}=${valueKey}|${condKey}`;
          })
          .sort()
          .join("\u001e");
        const cacheKey = `audit-rules:${appliedDateFrom}:${appliedDateTo}:${auditFilterScope ? "audit-all-cats" : pillFilter || ""}:${debouncedSearch || ""}:${posListKey || ""}:${activeColFiltersKey}:${auditParamsCacheKey}`;
        if (uniqueValsCacheRef.current.has(cacheKey)) return uniqueValsCacheRef.current.get(cacheKey);
        const q = normalizeSearchText(debouncedSearch);
        const isMensalEventMode = String(posListKey || "") === "mensal_event";
        const isSheetImportMode =
          String(posListKey || "") === "banco_horas" ||
          String(posListKey || "") === "abonos_pendentes" ||
          String(posListKey || "") === "abonos_efetuados";
        const fromKey = normDateKey(appliedDateFrom);
        const toKey = normDateKey(appliedDateTo);
        const indices = eventsDateIndex && !isSheetImportMode
          ? collectEventIndicesInRange(eventsDateIndex, fromKey, toKey)
          : null;
        const personCandidateIndices = q ? getPersonSearchCandidateIndices(q) : null;
        const collectAuditCandidates = (ignoreTextSearch = false) => {
          const out = [];
          const scan = (idx) => {
            const ev = events0[idx];
            if (!ev) return;
            const { search: evSearch, normDate: evDate } = eventMeta[idx] || {};
            if (!auditFilterScope && pillFilter && ev._cat !== pillFilter) return;
            if (!indices && !isSheetImportMode) {
              if (fromKey && evDate && evDate < fromKey) return;
              if (toKey && evDate && evDate > toKey) return;
            }
            if (q && !ignoreTextSearch && !searchTextMatches(evSearch, q)) return;
            for (const [filterCol, filterEntry] of Object.entries(colFilters)) {
              if (!isHdmColFilterActive(filterEntry)) continue;
              if (filterCol === "auditoria") continue;
              const cellVal = getColFilterValue(ev, filterCol, { stackHrsMrc, isEventsMode: true });
              if (!rowPassesHdmColFilter(cellVal, filterEntry, filterCol, getColFilterDisplay)) return;
            }
            out.push(idx);
          };
          if (indices) {
            for (const idx of indices) scan(idx);
          } else if (personCandidateIndices && !ignoreTextSearch) {
            for (const idx of personCandidateIndices) scan(idx);
          } else {
            for (let idx = 0; idx < events0.length; idx++) scan(idx);
          }
          return out;
        };
        let auditCandidateIndices = collectAuditCandidates(false);
        if (isMensalEventMode && q && auditCandidateIndices.length === 0) {
          auditCandidateIndices = collectAuditCandidates(true);
        }
        if (auditCandidateIndices.length > HDM_AUDIT_FILTER_SCAN_LIMIT) {
          auditCandidateIndices = auditCandidateIndices.slice(0, HDM_AUDIT_FILTER_SCAN_LIMIT);
        }
        const values = new Set();
        let rowsSinceLastNewRule = 0;
        for (let pos = 0; pos < auditCandidateIndices.length; pos++) {
          const idx = auditCandidateIndices[pos];
          const ev = events0[idx];
          if (!ev) continue;
          const previousEv = pos > 0 ? events0[auditCandidateIndices[pos - 1]] : null;
          const audit = getEventAudit(ev, previousEv);
          let foundNewRule = false;
          getAuditRuleCodes(audit).forEach((code) => {
            if (!values.has(code)) foundNewRule = true;
            values.add(code);
          });
          rowsSinceLastNewRule = foundNewRule ? 0 : rowsSinceLastNewRule + 1;
          if (values.size >= 4 && rowsSinceLastNewRule >= HDM_AUDIT_FILTER_STABLE_WINDOW) break;
        }
        const result = [...values].sort((a, b) =>
          COLLATOR_PT.compare(getAuditRuleLabel(a), getAuditRuleLabel(b)),
        );
        uniqueValsCacheRef.current.set(cacheKey, result);
        return result;
      }
      const cacheKey = `${isEventsMode ? "events" : "emps"}:${col}:${stackHrsMrc ? "stack" : ""}:${appliedDateFrom}:${appliedDateTo}:${auditFilterScope ? "audit-all-cats" : pillFilter || ""}`;
      if (uniqueValsCacheRef.current.has(cacheKey)) return uniqueValsCacheRef.current.get(cacheKey);
      const ctx = { stackHrsMrc, isEventsMode };
      let rows;
      if (isEventsMode) {
        const fromKey = normDateKey(appliedDateFrom);
        const toKey = normDateKey(appliedDateTo);
        const indices = eventsDateIndex
          ? collectEventIndicesInRange(eventsDateIndex, fromKey, toKey)
          : null;
        rows = [];
        const pushIdx = (idx) => {
          const ev = events0[idx];
          if (!auditFilterScope && pillFilter && ev?._cat !== pillFilter) return;
          rows.push(ev);
        };
        if (indices) {
          for (const idx of indices) pushIdx(idx);
        } else {
          for (let idx = 0; idx < events0.length; idx++) {
            const evDate = eventMeta[idx]?.normDate;
            if (fromKey && evDate && evDate < fromKey) continue;
            if (toKey && evDate && evDate > toKey) continue;
            pushIdx(idx);
          }
        }
      } else {
        rows = emps0;
      }
      const vals = [...new Set(rows.map((e) => getColFilterValue(e, col, ctx)))].sort((a, b) =>
        COLLATOR_PT.compare(getColFilterDisplay(a, col), getColFilterDisplay(b, col)),
      );
      const capped = vals.length > 3000 ? vals.slice(0, 3000) : vals;
      uniqueValsCacheRef.current.set(cacheKey, capped);
      return capped;
    },
    [
      isEventsMode,
      isApiMode,
      isPosEmbedded,
      events0,
      eventMeta,
      eventsDateIndex,
      appliedDateFrom,
      appliedDateTo,
      pillFilter,
      emps0,
      stackHrsMrc,
      groupBy,
      auditOnly,
      colFilters,
      debouncedSearch,
      posListKey,
      auditParamsCacheKey,
      getPersonSearchCandidateIndices,
    ],
  );

  const filterPopColDeferred = useDeferredValue(filterPop?.col ?? "");
  const filterPopUniqueVals = useMemo(() => {
    if (!filterPopColDeferred) return [];
    return uniqueVals(filterPopColDeferred);
  }, [filterPopColDeferred, uniqueVals]);
  const filterPopValuesPending = Boolean(filterPop?.col) && filterPopColDeferred !== filterPop.col;

  /* filter helpers */
  const isFiltered = (col) => isHdmColFilterActive(colFilters[col]);
  const hasAnyFilter = Object.values(colFilters).some(isHdmColFilterActive);
  const largeDataset = (isEventsMode ? events0.length : emps0.length) > 50000;

  const openFilter = (col, btnEl) => {
    const btn = btnEl || filterBtnRefs.current[col];
    if (!btn) return;
    if (filterPop?.col === col) {
      setFilterPop(null);
      setFilterDraft(null);
      setFilterCondDraft({ op: "contains", value: "" });
      return;
    }
    const rect = btn.getBoundingClientRect();
    const normalized = normalizeHdmColFilter(colFilters[col]);
    setFilterPopSearch("");
    setFilterDraft(normalized.values instanceof Set ? new Set(normalized.values) : null);
    setFilterCondDraft(
      normalized.cond ? { ...normalized.cond } : { op: "contains", value: "" },
    );
    setFilterPop({ col, rect });
  };

  const getFilterPortalRoot = useCallback(() => {
    if (typeof document === "undefined") return null;
    return document.body;
  }, []);

  const toggleFilterDraftVal = (col, val) => {
    const all = uniqueVals(col);
    setFilterDraft((prev) => {
      const cur = prev instanceof Set ? new Set(prev) : new Set(all);
      cur.has(val) ? cur.delete(val) : cur.add(val);
      return cur.size === all.length ? null : cur;
    });
  };

  const clearFilter = (col) => {
    setColFilters((prev) => ({ ...prev, [col]: null }));
    setFilterDraft(null);
    setFilterCondDraft({ op: "contains", value: "" });
    setFilterPop(null);
  };

  const applyFilterDraft = (col) => {
    setColFilters((prev) => ({
      ...prev,
      [col]: buildHdmColFilter(filterDraft, filterCondDraft),
    }));
    setFilterDraft(null);
    setFilterCondDraft({ op: "contains", value: "" });
    setFilterPop(null);
  };

  /* column visibility helper */
  const colVisible = useCallback(
    (col) => {
      if (!visibleCols.has(col)) return false;
      if (!isEventsMode && ["plan", "pres", "ause", "just", "abs"].includes(col) && !hasHours)
        return false;
      if (!isEventsMode && col === "extr" && (!hasHours || !hasExtras)) return false;
      return true;
    },
    [visibleCols, hasHours, hasExtras, isEventsMode],
  );

  /* ── EVENTS MODE filtering / sorting / grouping ── */
  const eventSortKeys = useMemo(() => eventMeta.map((m) => m.sk), [eventMeta]);

  const filteredEventIndices = useMemo(() => {
    if (!isEventsMode) return [];
    const q = normalizeSearchText(debouncedSearch);
    const isMensalEventMode = String(posListKey || "") === "mensal_event";
    const isSheetImportMode =
      String(posListKey || "") === "banco_horas" ||
      String(posListKey || "") === "abonos_pendentes" ||
      String(posListKey || "") === "abonos_efetuados";
    const fromKey = normDateKey(appliedDateFrom);
    const toKey = normDateKey(appliedDateTo);
    const hasColFilters = Object.values(colFilters).some(isHdmColFilterActive);
    const useDateIndex = eventsDateIndex && !isSheetImportMode && !pillFilter && !q && !hasColFilters;
    const indices = useDateIndex
      ? collectEventIndicesInRange(eventsDateIndex, fromKey, toKey)
      : null;
    const personCandidateIndices = q ? getPersonSearchCandidateIndices(q) : null;
    const categoryCandidateIndices = pillFilter ? eventCategoryIndex.get(pillFilter) || [] : null;
    const collect = (ignoreTextSearch = false) => {
      const out = [];
      const scan = (idx) => {
        const ev = events0[idx];
        const { search: evSearch, normDate: evDate } = eventMeta[idx] || {};
        if (pillFilter && ev._cat !== pillFilter) return;
        if (!indices && !isSheetImportMode) {
          if (fromKey && evDate && evDate < fromKey) return;
          if (toKey && evDate && evDate > toKey) return;
        }
        if (q && !ignoreTextSearch && !searchTextMatches(evSearch, q)) return;
        for (const [col, filterEntry] of Object.entries(colFilters)) {
          if (!isHdmColFilterActive(filterEntry)) continue;
          if (col === "auditoria") continue;
          const cellVal = getColFilterValue(ev, col, { stackHrsMrc, isEventsMode: true });
          if (!rowPassesHdmColFilter(cellVal, filterEntry, col, getColFilterDisplay)) return;
        }
        out.push(idx);
      };
      if (categoryCandidateIndices) {
        for (const idx of categoryCandidateIndices) scan(idx);
      } else if (indices) {
        for (const idx of indices) scan(idx);
      } else if (personCandidateIndices && !ignoreTextSearch) {
        for (const idx of personCandidateIndices) scan(idx);
      } else {
        for (let idx = 0; idx < events0.length; idx++) scan(idx);
      }
      return out;
    };
    const result = collect(false);
    if (isMensalEventMode && q && result.length === 0) return collect(true);
    return result;
  }, [
    isEventsMode,
    events0,
    eventsDateIndex,
    eventCategoryIndex,
    eventMeta,
    debouncedSearch,
    appliedDateFrom,
    appliedDateTo,
    colFilters,
    pillFilter,
    posListKey,
    stackHrsMrc,
    getPersonSearchCandidateIndices,
  ]);

  const filteredEvents = useMemo(
    () => filteredEventIndices.map((i) => events0[i]),
    [filteredEventIndices, events0],
  );

  const allEventFilterCount = useMemo(() => {
    if (!isEventsMode) return 0;
    const q = normalizeSearchText(debouncedSearch);
    const isSheetImportMode =
      String(posListKey || "") === "banco_horas" ||
      String(posListKey || "") === "abonos_pendentes" ||
      String(posListKey || "") === "abonos_efetuados";
    const fromKey = normDateKey(appliedDateFrom);
    const toKey = normDateKey(appliedDateTo);
    const personCandidateIndices = q ? getPersonSearchCandidateIndices(q) : null;
    let total = 0;
    const scan = (idx) => {
      const ev = events0[idx];
      const { search: evSearch, normDate: evDate } = eventMeta[idx] || {};
      if (!isSheetImportMode) {
        if (fromKey && evDate && evDate < fromKey) return;
        if (toKey && evDate && evDate > toKey) return;
      }
      if (q && !searchTextMatches(evSearch, q)) return;
      let pass = true;
      for (const [col, filterEntry] of Object.entries(colFilters)) {
        if (!isHdmColFilterActive(filterEntry)) continue;
        if (col === "auditoria") continue;
        const cellVal = getColFilterValue(ev, col, { stackHrsMrc, isEventsMode: true });
        if (!rowPassesHdmColFilter(cellVal, filterEntry, col, getColFilterDisplay)) {
          pass = false;
          break;
        }
      }
      if (pass) total++;
    };
    if (personCandidateIndices) {
      for (const idx of personCandidateIndices) scan(idx);
    } else {
      for (let idx = 0; idx < events0.length; idx++) scan(idx);
    }
    return total;
  }, [
    isEventsMode,
    events0,
    eventMeta,
    debouncedSearch,
    appliedDateFrom,
    appliedDateTo,
    colFilters,
    posListKey,
    stackHrsMrc,
    getPersonSearchCandidateIndices,
  ]);

  const sortedEventIndices = useMemo(() => {
    if (isApiMode) return filteredEventIndices;
    if (!isEventsMode) return filteredEventIndices;
    return sortRowIndices(events0, filteredEventIndices, eventSortKeys, deferredSortCol, deferredSortDir);
  }, [
    isApiMode,
    isEventsMode,
    events0,
    filteredEventIndices,
    eventSortKeys,
    deferredSortCol,
    deferredSortDir,
  ]);
  const deferredFilteredEventIndices = useDeferredValue(filteredEventIndices);
  const deferredSortedEventIndices = useDeferredValue(sortedEventIndices);

  const evtTotalsAll = useMemo(() => {
    if (isApiMode) {
      if (apiData.useGroupList) {
        const items = apiData.grupos || [];
        return {
          horasPlan: items.reduce((s, g) => s + (g.horasPlan || 0), 0),
          horas: items.reduce((s, g) => s + (g.horas || 0), 0),
        };
      }
      const t = apiData.totais;
      return { horasPlan: t.horasPlan ?? 0, horas: t.horas ?? 0 };
    }
    if (!isEventsMode) return evtTotals(filteredEvents);
    if (Array.isArray(histDayRows) && histDayRows.length) {
      return computeModalPeriodTotals(histDayRows, appliedDateFrom, appliedDateTo);
    }
    const scopedEvents = filteredEventIndices.map((i) => events0[i]);
    if (String(posListKey || "") === "banco_horas") return evtTotalsBancoHoras(scopedEvents);
    if (
      String(posListKey || "") === "abonos_pendentes" ||
      String(posListKey || "") === "abonos_efetuados"
    ) {
      return evtTotals(scopedEvents);
    }
    return computeEventModalTotalsFromEvents(scopedEvents);
  }, [
    isApiMode,
    apiData.totais,
    apiData.useGroupList,
    apiData.grupos,
    isEventsMode,
    histDayRows,
    appliedDateFrom,
    appliedDateTo,
    filteredEvents,
    filteredEventIndices,
    events0,
    posListKey,
  ]);

  const evtTotalsFootnote =
    isEventsMode && Array.isArray(histDayRows) && histDayRows.length
      ? "Horas planejadas/trabalhadas do período — mesma regra do card Absenteísmo e da tabela histórico."
      : null;

  const rankings = useMemo(() => {
    if (!isEventsMode || !rankOpen || !filteredEvents.length) return null;
    const atrasoMap = {},
      extrasMap = {},
      faltasMap = {};
    for (const ev of filteredEvents) {
      const key = ev.mat || ev.nome || "_";
      const nome = ev.nome || ev.mat || "—";
      if (ev.evento?.toUpperCase().includes("ATRASO")) {
        if (!atrasoMap[key]) atrasoMap[key] = { nome, mat: ev.mat, count: 0 };
        atrasoMap[key].count++;
      }
      if (
        ev._cat === "extras" ||
        ev.evento?.toUpperCase().includes("BANCO DE HORAS CREDITO") ||
        ev.evento?.toUpperCase().includes("HORA EXTRA")
      ) {
        if (ev.horas > 0) {
          if (!extrasMap[key]) extrasMap[key] = { nome, mat: ev.mat, horas: 0 };
          extrasMap[key].horas += ev.horas;
        }
      }
      if (ev._cat === "ausentes") {
        if (!faltasMap[key]) faltasMap[key] = { nome, mat: ev.mat, count: 0 };
        faltasMap[key].count++;
      }
    }
    return {
      topAtrasos: Object.values(atrasoMap)
        .sort((a, b) => b.count - a.count)
        .slice(0, 5),
      topExtras: Object.values(extrasMap)
        .sort((a, b) => b.horas - a.horas)
        .slice(0, 5),
      topFaltas: Object.values(faltasMap)
        .sort((a, b) => b.count - a.count)
        .slice(0, 5),
    };
  }, [isEventsMode, rankOpen, filteredEvents]);

  /* ── EMPLOYEES MODE filtering / sorting / grouping ── */
  const filteredEmps = useMemo(() => {
    if (isEventsMode) return [];
    const q = normalizeSearchText(debouncedSearch);
    return emps0.filter((e) => {
      if (pillFilter === "pres" && !(e.hrsPres > 0)) return false;
      if (pillFilter === "ause" && !(e.hrsAuse > 0)) return false;
      if (pillFilter === "just" && !(e.hrsJust > 0 && e.hrsAuse === 0)) return false;
      if (pillFilter === "extr" && !(e.hrsExtr > 0)) return false;
      if (q) {
        const fields = [e.nome || e.mat, e.mat || "", e.depto || "", e.filial || "", e.genero || ""];
        if (!searchTextMatches(fields.join(" "), q)) return false;
      }
      for (const [col, filterEntry] of Object.entries(colFilters)) {
        if (!isHdmColFilterActive(filterEntry)) continue;
        const cellVal = getColFilterValue(e, col);
        if (!rowPassesHdmColFilter(cellVal, filterEntry, col, getColFilterDisplay)) return false;
      }
      return true;
    });
  }, [isEventsMode, emps0, debouncedSearch, colFilters, pillFilter]);

  const empSortKeys = useMemo(
    () => filteredEmps.map((e) => buildEmpSortKeys(e)),
    [filteredEmps],
  );

  const filteredEmpIndices = useMemo(
    () => (isEventsMode ? [] : filteredEmps.map((_, i) => i)),
    [isEventsMode, filteredEmps],
  );

  const sortedEmpIndices = useMemo(() => {
    if (isEventsMode) return filteredEmpIndices;
    return sortRowIndices(filteredEmps, filteredEmpIndices, empSortKeys, deferredSortCol, deferredSortDir);
  }, [
    isEventsMode,
    filteredEmps,
    filteredEmpIndices,
    empSortKeys,
    deferredSortCol,
    deferredSortDir,
  ]);

  const sortedEmps = useMemo(
    () => sortedEmpIndices.map((i) => filteredEmps[i]),
    [sortedEmpIndices, filteredEmps],
  );

  const auditSameDayEventsMap = useMemo(() => {
    const map = new Map();
    for (const ev of events0) {
      const key = auditSameDayKey(ev);
      if (!key) continue;
      const hasContent = Boolean(
        eventDateKey(ev) ||
          String(ev?.cod || ev?.codigo || ev?.evento || ev?.situacaoDesc || "").trim() ||
          Number(ev?.horas || 0) > 0 ||
          String(ev?.horario || "").trim() ||
          String(ev?.marcacao || "").trim(),
      );
      if (!hasContent) continue;
      if (!map.has(key)) map.set(key, []);
      map.get(key).push({
        cod: ev?.cod || ev?.codigo || "",
        evento: ev?.evento || ev?.situacaoDesc || "",
        _cat: ev?._cat || ev?.categoria || "",
      });
    }
    return map;
  }, [events0]);

  const collaboratorAuditSummary = useMemo(() => {
    if (!isEventsMode || isApiMode || isPosEmbedded || groupBy[0] !== "mat") return null;
    const byColab = new Map();
    const summaryIndices = deferredFilteredEventIndices;
    for (const idx of summaryIndices) {
      const ev = events0[idx];
      if (!ev) continue;
      const key = String(ev.mat || ev.nome || "__sem_colaborador__");
      if (!byColab.has(key)) byColab.set(key, []);
      byColab.get(key).push(ev);
    }
    const counts = { total: 0, ok: 0, critica: 0, alta: 0, media: 0, baixa: 0 };
    for (const rows of byColab.values()) {
      const ordered = [...rows].sort((a, b) => {
        const da = eventDateKey(a) || "";
        const db = eventDateKey(b) || "";
        if (da !== db) return da.localeCompare(db);
        return String(a.horario || "").localeCompare(String(b.horario || ""));
      });
      const britanicoMap = new Map();
      for (const ev of ordered) {
        const signature = stripHorarioCode(ev?.marcacao || "").split(/\s+/).filter(Boolean).join(" ");
        const dateKey = eventDateKey(ev);
        if (!signature || !dateKey) continue;
        if (!britanicoMap.has(signature)) britanicoMap.set(signature, new Set());
        britanicoMap.get(signature).add(dateKey);
      }
      ordered.forEach((ev, idx) => {
        const previousEv = ordered[idx - 1];
        const audit = getEventAudit(ev, previousEv, britanicoMap);
        const sev = audit.severidade || "ok";
        counts.total += 1;
        counts[sev] = (counts[sev] || 0) + 1;
      });
    }
    return counts;
  }, [isEventsMode, isApiMode, isPosEmbedded, groupBy, deferredFilteredEventIndices, events0, auditParams]);

  const empTotalsAll = useMemo(() => grpTotals(filteredEmps), [filteredEmps]);

  /* aggregated values for display */
  const totalRows = isApiMode ? apiData.total : isEventsMode ? events0.length : emps0.length;
  const filteredCount = isApiMode
    ? apiData.useGroupList
      ? (apiData.grupos || []).reduce((s, g) => s + (g.count || 0), 0)
      : apiData.total
    : isEventsMode
      ? filteredEventIndices.length
      : filteredEmps.length;

  const collaboratorDetailMode = isEventsMode && !isApiMode && !isPosEmbedded && groupBy[0] === "mat";
  const collabSubheadRef = useRef(null);
  const [collabSubheadHeight, setCollabSubheadHeight] = useState(38);
  useEffect(() => {
    if (!collaboratorDetailMode || !collabSubheadRef.current) return;
    const ro = new ResizeObserver((entries) => {
      for (const entry of entries) {
        setCollabSubheadHeight(Math.round(entry.borderBoxSize?.[0]?.blockSize ?? entry.contentRect.height));
      }
    });
    ro.observe(collabSubheadRef.current);
    return () => ro.disconnect();
  }, [collaboratorDetailMode]);
  const auditWorkspaceMode = collaboratorDetailMode && Boolean(initialAuditOnly);
  const showCollabAuditDetails = auditWorkspaceMode;

  const COLLAB_OPTIONAL_COL_IDS = ["justificativa", "cidDescricao"];
  const collabExtraCols = collaboratorDetailMode
    ? COLLAB_OPTIONAL_COL_IDS
        .filter((id) => visibleCols.has(id))
        .map((id) => EVENT_COLS.find((c) => c.id === id))
        .filter(Boolean)
    : [];
  const collabDetailColSpan = (showCollabAuditDetails ? 5 : 4) + collabExtraCols.length;
  const collabGroupInitialLimit = auditWorkspaceMode
    ? HDM_AUDIT_COLLAB_GROUP_INITIAL_LIMIT
    : HDM_COLLAB_GROUP_INITIAL_LIMIT;
  useEffect(() => {
    setCollabGroupLimit(collabGroupInitialLimit);
    setCollabGroupPage(1);
  }, [
    auditSeverityFilter,
    auditOnly,
    auditReviewStatusFilter,
    auditCriticalPendingOnly,
    auditReviews,
    colFilters,
    groupBy,
    filteredCount,
    collabGroupInitialLimit,
  ]);

  useEffect(() => {
    if (isSheetImportEmbedded && typeof onFilteredCountChange === "function") {
      onFilteredCountChange(filteredCount);
    }
  }, [isSheetImportEmbedded, filteredCount, onFilteredCountChange]);

  const flatRowIndices = isEventsMode
    ? groupBy.length > 0
      ? filteredEventIndices
      : sortedEventIndices
    : sortedEmpIndices;
  const tableDataRows = isEventsMode ? events0 : filteredEmps;

  const groupingTooLarge =
    filteredCount > HDM_MULTI_GROUP_MAX &&
    groupBy.length > 1 &&
    !debouncedSearch.trim() &&
    !hasAnyFilter;
  const tableBusy =
    dateFilterBusy || groupBusy || sortBusy || Boolean(pillBusy) || (isApiMode && apiData.isFetching);
  const tableBusyLabel = dateFilterBusy
    ? "Aguarde, aplicando período…"
    : pillBusy
      ? "Aguarde, filtrando eventos..."
      : sortBusy || isSortPending
      ? "Aguarde, ordenando…"
      : isApiMode && apiData.isFetching
        ? "Aguarde, carregando…"
        : "Aguarde, atualizando agrupamento…";

  useEffect(() => {
    if (sortBusy) setSortBusy(false);
  }, [sortBusy, sortedEventIndices, sortedEmpIndices, deferredSortSpec]);

  useEffect(() => {
    if (!dateFilterBusy) return;
    const delay = events0.length > 100000 ? 450 : events0.length > 30000 ? 280 : 120;
    const t = window.setTimeout(() => setDateFilterBusy(false), delay);
    return () => clearTimeout(t);
  }, [
    dateFilterBusy,
    appliedDateFrom,
    appliedDateTo,
    events0.length,
    filteredCount,
    flatRowIndices.length,
  ]);

  /* cat counts for pills — events in the current search/filter scope, excluding the category pill itself */
  useEffect(() => {
    if (!pillBusy) return;
    const delay = events0.length > 100000 ? 450 : events0.length > 30000 ? 300 : 160;
    const t = window.setTimeout(() => setPillBusy(""), delay);
    return () => window.clearTimeout(t);
  }, [pillBusy, pillFilter, filteredCount, flatRowIndices.length, events0.length]);

  const catCounts = useMemo(() => {
    if (!isEventsMode) return {};
    const q = normalizeSearchText(debouncedSearch);
    const isSheetImportMode =
      String(posListKey || "") === "banco_horas" ||
      String(posListKey || "") === "abonos_pendentes" ||
      String(posListKey || "") === "abonos_efetuados";
    const fromKey = normDateKey(appliedDateFrom);
    const toKey = normDateKey(appliedDateTo);
    const personCandidateIndices = q ? getPersonSearchCandidateIndices(q) : null;
    const dateIndices = !q && eventsDateIndex && !isSheetImportMode
      ? collectEventIndicesInRange(eventsDateIndex, fromKey, toKey)
      : null;
    const counts = {};
    const loop = (idx) => {
      const ev = events0[idx];
      if (!ev?._cat) return;
      const { search: evSearch, normDate: evDate } = eventMeta[idx] || {};
      if (!isSheetImportMode && !dateIndices) {
        if (fromKey && evDate && evDate < fromKey) return;
        if (toKey && evDate && evDate > toKey) return;
      }
      if (q && !searchTextMatches(evSearch, q)) return;
      for (const [col, filterEntry] of Object.entries(colFilters)) {
        if (!isHdmColFilterActive(filterEntry)) continue;
        if (col === "auditoria") continue;
        const cellVal = getColFilterValue(ev, col, { stackHrsMrc, isEventsMode: true });
        if (!rowPassesHdmColFilter(cellVal, filterEntry, col, getColFilterDisplay)) return;
      }
      counts[ev._cat] = (counts[ev._cat] || 0) + 1;
    };
    if (dateIndices) {
      for (const idx of dateIndices) loop(idx);
    } else if (personCandidateIndices) {
      for (const idx of personCandidateIndices) loop(idx);
    } else {
      for (let idx = 0; idx < events0.length; idx++) {
        loop(idx);
      }
    }
    return counts;
  }, [
    isEventsMode,
    events0,
    eventMeta,
    eventsDateIndex,
    debouncedSearch,
    appliedDateFrom,
    appliedDateTo,
    colFilters,
    posListKey,
    stackHrsMrc,
    getPersonSearchCandidateIndices,
  ]);

  /* memoized group tree — índices + totais pré-calculados (sem duplicar linhas) */
  const groupTree = useMemo(() => {
    if (isApiMode || !groupBy.length || groupingTooLarge) return null;
    const scope = isEventsMode ? deferredSortedEventIndices : sortedEmpIndices;
    return buildGroupTreeIndexed(tableDataRows, groupBy, scope, isEventsMode);
  }, [
    groupBy,
    groupingTooLarge,
    isEventsMode,
    deferredSortedEventIndices,
    sortedEmpIndices,
    tableDataRows,
  ]);
  useEffect(() => {
    setGroupBusy(false);
  }, [groupTree]);

  /* auto-collapse groups with many leaves to avoid rendering thousands of rows at once */
  const GRP_AUTO_COLLAPSE = 40;
  const GRP_LEAF_LIMIT = 80;
  useEffect(() => {
    if (groupingTooLarge) {
      setGroupBusy(false);
      return;
    }
    if (!groupTree) {
      setCollapsed(new Set());
      return;
    }
    if (isEventsMode && groupBy[0] === "mat") {
      setCollapsed(new Set());
      return;
    }
    const keys = new Set();
    const visit = (nodes, prefix) => {
      if (!nodes?.length || !nodes[0]?._group) return;
      for (const node of nodes) {
        const pk = `${prefix}${node.colKey}:${node.label}`;
        const ch = node.children;
        if (!Array.isArray(ch) || !ch.length) continue;
        if (ch[0]?._group) {
          visit(ch, `${pk}>`);
        } else if ((node._count ?? ch.length) > GRP_AUTO_COLLAPSE) {
          keys.add(pk);
        }
      }
    };
    visit(groupTree, "");
    if (keys.size > 0) setCollapsed(keys);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [groupTree, groupingTooLarge]);

  /* virtual scroll (flat list) */
  const tableWrapRef = useRef(null);
  const scrollRafRef = useRef(0);
  const scrollTopRef = useRef(0);
  const [scrollTop, setScrollTop] = useState(0);
  const [viewHeight, setViewHeight] = useState(480);
  useEffect(() => {
    const el = tableWrapRef.current;
    if (!el) return;
    const update = () => setViewHeight(el.clientHeight || 480);
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, [isMaximized, size.h]);
  useEffect(() => {
    scrollTopRef.current = 0;
    setScrollTop(0);
    if (tableWrapRef.current) tableWrapRef.current.scrollTop = 0;
  }, [filteredCount, groupBy.length, sortCol, sortDir]);
  useEffect(
    () => () => {
      if (scrollRafRef.current) cancelAnimationFrame(scrollRafRef.current);
    },
    [],
  );

  const virtualRowHeight = isEventsMode && stackHrsMrc ? HDM_STACKED_ROW_HEIGHT : HDM_ROW_HEIGHT;

  const virtualWindow = useMemo(() => {
    if (isApiMode || groupBy.length > 0 || groupingTooLarge) return null;
    const total = flatRowIndices.length;
    if (total < HDM_VIRTUAL_MIN_ROWS) return null;
    const overscan = 10;
    const start = Math.max(0, Math.floor(scrollTop / virtualRowHeight) - overscan);
    const visibleCount = Math.ceil(viewHeight / virtualRowHeight) + overscan * 2;
    const end = Math.min(total, start + visibleCount);
    return {
      start,
      end,
      topPad: start * virtualRowHeight,
      bottomPad: (total - end) * virtualRowHeight,
    };
  }, [flatRowIndices.length, scrollTop, viewHeight, groupBy.length, groupingTooLarge, virtualRowHeight]);
  const shouldTrackTableScroll = Boolean(virtualWindow);

  const modalDefaultColWidths = useMemo(
    () => ({
      nome: isEventsMode ? 280 : 260,
      mat: 110,
      genero: 78,
      data: 92,
      filial: 220,
      depto: 270,
      cargo: 190,
      _cat: 140,
      qtd_dias: 90,
      justificativa: 180,
      horario: stackHrsMrc ? 330 : 250,
      hrsPlan: 95,
      marcacao: 230,
      cod: 80,
      evento: 320,
      cid: 90,
      cidDescricao: 240,
      atividade: 180,
      situacaoDesc: 180,
      horas: 90,
      plan: 95,
      pres: 95,
      ause: 95,
      just: 95,
      extr: 95,
      abs: 90,
      inicio: 110,
      termino: 110,
      saldoAnteriorBH: 120,
      creditoBH: 105,
      debitoBH: 105,
      horasPagasBH: 105,
      saldoProximoBH: 120,
    }),
    [isEventsMode, stackHrsMrc],
  );

  const renderedColIds = useMemo(
    () =>
      colOrder.filter((colId) => {
        if (stackHrsMrc && colId === "marcacao") return false;
        if (groupBy.length > 0 && groupBy.includes(colId)) return false;
        return colId === "nome" || colVisible(colId);
      }),
    [colOrder, stackHrsMrc, visibleCols, groupBy],
  );

  const modalMinColWidth = useCallback(
    (colId) => {
      if (colId === "nome") return 140;
      const def = COLS.find((c) => c.id === colId);
      if (!def) return 80;
      if (def.numeric) return 72;
      if (def.filterable) return 118;
      return 80;
    },
    [COLS],
  );

  const modalColumnWidth = (colId) =>
    Math.max(
      modalMinColWidth(colId),
      Number(colWidths[colId]) || modalDefaultColWidths[colId] || 120,
    );

  const modalTableWidth = useMemo(
    () => renderedColIds.reduce((sum, colId) => sum + modalColumnWidth(colId), 0),
    [renderedColIds, colWidths, modalDefaultColWidths],
  );

  const startColResize = useCallback(
    (colId, e) => {
      e.preventDefault();
      e.stopPropagation();
      const th = thRefs.current[colId];
      const startX = e.clientX;
      const startW = th ? th.offsetWidth : modalColumnWidth(colId);
      const minW = modalMinColWidth(colId);
      const move = (mv) =>
        setColWidths((prev) => ({
          ...prev,
          [colId]: Math.max(minW, startW + mv.clientX - startX),
        }));
      const up = () => {
        document.removeEventListener("mousemove", move);
        document.removeEventListener("mouseup", up);
        document.body.style.cursor = "";
        document.body.style.userSelect = "";
      };
      document.addEventListener("mousemove", move);
      document.addEventListener("mouseup", up);
      document.body.style.cursor = "col-resize";
      document.body.style.userSelect = "none";
    },
    [colWidths, modalDefaultColWidths, modalMinColWidth],
  );

  const handleTableScroll = useCallback((e) => {
    if (!shouldTrackTableScroll) return;
    const nextTop = e.currentTarget.scrollTop || 0;
    const minDelta = Math.max(1, Math.floor(virtualRowHeight / 2));
    if (Math.abs(nextTop - scrollTopRef.current) < minDelta) return;
    scrollTopRef.current = nextTop;
    if (scrollRafRef.current) return;
    scrollRafRef.current = requestAnimationFrame(() => {
      setScrollTop(scrollTopRef.current);
      scrollRafRef.current = 0;
    });
  }, [shouldTrackTableScroll, virtualRowHeight]);

  /* display row limit for performance (small lists / fallback) */
  const ROW_LIMIT = largeDataset ? 80 : 150;
  const [displayLimit, setDisplayLimit] = useState(ROW_LIMIT);
  useEffect(() => {
    if (!virtualWindow) setDisplayLimit(ROW_LIMIT);
  }, [filteredCount, virtualWindow, ROW_LIMIT]);

  /* per-group leaf limits for grouped view */
  const [groupLeafLimits, setGroupLeafLimits] = useState(new Map());
  useEffect(() => setGroupLeafLimits(new Map()), [filteredCount]);

  const renderLeafRow = (row, idx, prefix) =>
    isEventsMode ? (
      <tr
        key={`${prefix}${idx}`}
        className={`hdm-row ${evtRowClass(row)}${virtualWindow ? " hdm-row-virtual" : ""}`}
        style={virtualWindow ? { height: virtualRowHeight } : undefined}
      >
        {renderEvtCells(row)}
      </tr>
    ) : (
      <tr
        key={`${prefix}${row.mat || idx}`}
        className={`hdm-row ${rowClass(row)}${virtualWindow ? " hdm-row-virtual" : ""}`}
        style={virtualWindow ? { height: virtualRowHeight } : undefined}
      >
        {renderEmpCells(row)}
      </tr>
    );

  const renderGroupTree = (nodes, depth = 0, pathPrefix = "") => {
    if (!nodes || !nodes.length) return null;
    if (isIndexLeafNode(nodes)) {
      const limit = groupLeafLimits.get(pathPrefix) ?? GRP_LEAF_LIMIT;
      const limited = nodes.length > limit;
      const remaining = nodes.length - limit;
      return (
        <>
          {nodes.slice(0, limit).map((rowIdx, i) => renderLeafRow(tableDataRows[rowIdx], rowIdx, `${pathPrefix}${rowIdx}-`))}
          {limited && (
            <tr>
              <td colSpan={99} className="hdm-load-more">
                <button
                  type="button"
                  onClick={() =>
                    setGroupLeafLimits((prev) => {
                      const m = new Map(prev);
                      m.set(pathPrefix, limit + GRP_LEAF_LIMIT);
                      return m;
                    })
                  }
                >
                  Ver mais {Math.min(GRP_LEAF_LIMIT, remaining).toLocaleString("pt-BR")} de{" "}
                  {remaining.toLocaleString("pt-BR")} restantes
                </button>
              </td>
            </tr>
          )}
        </>
      );
    }
    return nodes.map((node) => {
      const { label, colKey, children, _agg, _count } = node;
      const pathKey = `${pathPrefix}${colKey}:${label}`;
      const isCol = collapsed.has(pathKey);
      const leafCount = _count ?? nodeLeafCount(node);
      const gt = _agg;
      const toggle = () =>
        setCollapsed((prev) => {
          const n = new Set(prev);
          n.has(pathKey) ? n.delete(pathKey) : n.add(pathKey);
          return n;
        });
      const firstLeafIdx = isIndexLeafNode(children) ? children[0] : null;
      const firstRow = firstLeafIdx != null ? tableDataRows[firstLeafIdx] : null;
      const grpLabel =
        isEventsMode && colKey === "mat" && firstRow?.nome
          ? `${label} - ${firstRow.nome}`
          : colKey === "_cat" && EVENT_CAT_LABELS[label]
            ? EVENT_CAT_LABELS[label]
            : label;
      const leafUnit = isAbonosEmbedded
        ? "ocorrência"
        : isBancoHorasEmbedded
          ? "colaborador"
          : isEventsMode
            ? "evento"
            : "colaborador";
      return (
        <React.Fragment key={pathKey}>
          <tr className={`hdm-grp-row hdm-grp-d${Math.min(depth, 3)}`}>
            {renderGroupHeaderCells(
              grpLabel,
              gt || (isEventsMode ? { horasPlan: 0, horas: 0 } : grpTotals([])),
              `${leafCount.toLocaleString("pt-BR")} ${leafUnit}${leafCount !== 1 ? "s" : ""}`,
              depth,
              isCol,
              toggle,
            )}
          </tr>
          {!isCol && renderGroupTree(children, depth + 1, `${pathKey}>`)}
        </React.Fragment>
      );
    });
  };

  const collectGroupLeafIndices = (nodes) => {
    if (!Array.isArray(nodes) || !nodes.length) return [];
    if (isIndexLeafNode(nodes)) return nodes;
    return nodes.flatMap((node) => collectGroupLeafIndices(node.children));
  };

  const sortEventIndicesByDateTime = useCallback(
    (indices = []) =>
      [...indices].sort((a, b) => {
        const ea = tableDataRows[a];
        const eb = tableDataRows[b];
        const da = eventDateKey(ea) || "";
        const db = eventDateKey(eb) || "";
        if (da !== db) return da.localeCompare(db);
        const ha = String(ea?.horario || "").localeCompare(String(eb?.horario || ""), "pt-BR", { numeric: true });
        if (ha) return ha;
        return String(ea?.evento || ea?.cod || "").localeCompare(String(eb?.evento || eb?.cod || ""), "pt-BR", { numeric: true });
      }),
    [tableDataRows],
  );

  const eventObservationText = (ev) =>
    String(
      ev?.observacao ||
        ev?.obs ||
        ev?.justificativa ||
        ev?.situacaoDesc ||
        ev?.cidDescricao ||
        "",
    ).trim();

  const hasCollaboratorEventContent = (ev) => {
    if (!ev) return false;
    const mrc = marcacaoDistinctFromHorario(ev.horario, ev.marcacao) || ev.marcacao || "";
    return Boolean(
      eventDateKey(ev) ||
        String(ev.cod || ev.evento || ev.situacaoDesc || "").trim() ||
        Number(ev.horas || 0) > 0 ||
        String(ev.horario || "").trim() ||
        String(mrc || "").trim() ||
        eventObservationText(ev),
    );
  };

  const auditCollaboratorIndex = useMemo(() => {
    if (!collaboratorDetailMode || !tableDataRows.length) return new Map();
    const index = new Map();
    tableDataRows.forEach((ev, idx) => {
      if (!hasCollaboratorEventContent(ev)) return;
      const matKey = String(ev?.mat || "").trim();
      const key = matKey ? `mat:${matKey}` : `nome:${normalizeSearchText(ev?.nome || "")}`;
      if (!key || key === "nome:") return;
      if (!index.has(key)) index.set(key, []);
      index.get(key).push(idx);
    });
    return index;
  }, [collaboratorDetailMode, tableDataRows]);

  const collectAuditDetailLeafIndices = useCallback((node) => {
    const baseIndices = collectGroupLeafIndices(node.children);
    if (!auditWorkspaceMode || !baseIndices.length) return sortEventIndicesByDateTime(baseIndices);

    const first = tableDataRows[baseIndices[0]];
    const matKey = String(first?.mat || "").trim();
    const nameKey = normalizeSearchText(first?.nome || "");
    const collaboratorKey = matKey ? `mat:${matKey}` : `nome:${nameKey}`;
    const fromKey = normDateKey(appliedDateFrom);
    const toKey = normDateKey(appliedDateTo);
    const allIndices = [];
    const candidateIndices = auditCollaboratorIndex.get(collaboratorKey) || baseIndices;

    for (const idx of candidateIndices) {
      const ev = tableDataRows[idx];
      if (!hasCollaboratorEventContent(ev)) continue;
      const evDate = eventDateKey(ev);
      if (fromKey && evDate && evDate < fromKey) continue;
      if (toKey && evDate && evDate > toKey) continue;
      allIndices.push(idx);
    }

    return sortEventIndicesByDateTime(allIndices.length ? allIndices : baseIndices);
  }, [
    auditWorkspaceMode,
    tableDataRows,
    auditCollaboratorIndex,
    appliedDateFrom,
    appliedDateTo,
    sortEventIndicesByDateTime,
  ]);

  function splitTimeTokens(value) {
    return normalizeFaltaMarcacaoToken(value)
      .split(/\s+/)
      .filter((token) => /^\d{1,2}:\d{2}$/.test(token));
  }
  function splitMarkDisplayTokens(value) {
    return normalizeFaltaMarcacaoToken(value)
      .split(/\s+/)
      .filter((token) => token === "FM" || /^\d{1,2}:\d{2}$/.test(token));
  }
  function timeTokenToMinutes(token) {
    const m = String(token || "").match(/^(\d{1,2}):(\d{2})$/);
    if (!m) return null;
    return Number(m[1]) * 60 + Number(m[2]);
  }
  function buildTimeSequence(parts) {
    let last = null;
    return parts.map((token) => {
      const base = timeTokenToMinutes(token);
      if (base == null) return { token, minutes: null };
      let minutes = base;
      while (last != null && minutes < last) minutes += 1440;
      last = minutes;
      return { token, minutes };
    });
  }
  function formatMarkDiff(diff) {
    if (diff === 0) return "";
    const sign = diff > 0 ? "+" : "-";
    const abs = Math.abs(diff);
    if (abs >= 60) {
      const h = Math.floor(abs / 60);
      const m = abs % 60;
      return m > 0 ? `${sign}${h}h${String(m).padStart(2, "0")}m` : `${sign}${h}`;
    }
    return `${sign}${abs}m`;
  }
  function buildMarkDisplaySlots(prevParts, realParts) {
    const tolerance = Math.max(0, Number(auditParams?.toleranciaMinutos) || 0);
    const prevSeq = buildTimeSequence(prevParts);
    const realSeq = buildTimeSequence(realParts);
    const slots = prevSeq.map((item) => ({
      prev: item.token || "",
      prevMinutes: item.minutes,
      real: "",
      diffText: "",
      severe: false,
      sign: "neutral",
    }));
    const comparableRealSeq = realSeq.filter((item) => item.minutes != null);
    if (prevSeq.length && comparableRealSeq.length === prevSeq.length && realSeq.every((item) => item.minutes != null)) {
      return slots.map((slot, idx) => {
        const realItem = realSeq[idx];
        const diff = realItem.minutes - slot.prevMinutes;
        return {
          ...slot,
          real: realItem.token || "",
          diffText: formatMarkDiff(diff),
          severe: Math.abs(diff) > tolerance,
          sign: diff < 0 ? "neg" : diff > 0 ? "pos" : "neutral",
        };
      });
    }
    const usedPrev = new Set();

    realSeq.forEach((realItem) => {
      if (realItem.minutes == null) {
        const emptyIdx = slots.findIndex((slot, idx) => !usedPrev.has(idx) && !slot.real);
        if (emptyIdx >= 0) {
          usedPrev.add(emptyIdx);
          slots[emptyIdx] = { ...slots[emptyIdx], real: realItem.token || "" };
          return;
        }
        slots.push({
          prev: "",
          prevMinutes: null,
          real: realItem.token || "",
          diffText: "",
          severe: false,
          sign: "neutral",
        });
        return;
      }
      let bestIdx = -1;
      let bestDistance = Infinity;
      prevSeq.forEach((prevItem, idx) => {
        if (usedPrev.has(idx) || prevItem.minutes == null) return;
        const distance = Math.abs(realItem.minutes - prevItem.minutes);
        if (distance < bestDistance) {
          bestDistance = distance;
          bestIdx = idx;
        }
      });

      if (bestIdx >= 0) {
        usedPrev.add(bestIdx);
        const diff = realItem.minutes - slots[bestIdx].prevMinutes;
        slots[bestIdx] = {
          ...slots[bestIdx],
          real: realItem.token || "",
          diffText: formatMarkDiff(diff),
          severe: Math.abs(diff) > tolerance,
          sign: diff < 0 ? "neg" : diff > 0 ? "pos" : "neutral",
        };
        return;
      }

      slots.push({
        prev: "",
        prevMinutes: null,
        real: realItem.token || "",
        diffText: "",
        severe: false,
        sign: "neutral",
      });
    });

    return slots.length ? slots : [{ prev: "", real: "", diffText: "", severe: false, sign: "neutral" }];
  }
  const buildPontoBritanicoMap = (indices) => {
    const map = new Map();
    for (const idx of indices) {
      const ev = tableDataRows[idx];
      const signature = splitTimeTokens(ev?.marcacao || "").join(" ");
      const dateKey = eventDateKey(ev);
      if (!signature || !dateKey) continue;
      if (!map.has(signature)) map.set(signature, new Set());
      map.get(signature).add(dateKey);
    }
    return map;
  };
  function auditSameDayKey(ev) {
    const dateKey = eventDateKey(ev);
    if (!dateKey) return "";
    const personKey = String(ev?.mat || "").trim() || normalizeSearchText(ev?.nome || "");
    return personKey ? `${personKey}|${dateKey}` : "";
  }
  function eventWithPreviousJourney(ev, previousEv, britanicoMap = null) {
    const assinatura = splitTimeTokens(ev?.marcacao || "").join(" ");
    const repeticoes = assinatura && britanicoMap?.has(assinatura) ? britanicoMap.get(assinatura).size : 0;
    return {
      ...ev,
      sameDayEvents: auditSameDayEventsMap.get(auditSameDayKey(ev)) || [],
      previousData: previousEv ? eventDateKey(previousEv) : "",
      previousMarcacao: previousEv?.marcacao || "",
      pontoBritanicoAssinatura: assinatura,
      pontoBritanicoRepeticoes: repeticoes,
    };
  }
  function makeAuditCacheKey(input) {
    return [
      eventDateKey(input) || "",
      input?.mat || input?.nome || "",
      input?.cod || "",
      input?.evento || input?.situacaoDesc || "",
      input?.horario || "",
      input?.marcacao || "",
      Number(input?.horas || 0),
      input?.previousData || "",
      input?.previousMarcacao || "",
      input?.pontoBritanicoAssinatura || "",
      input?.pontoBritanicoRepeticoes || 0,
      (Array.isArray(input?.sameDayEvents) ? input.sameDayEvents : [])
        .map((item) => `${item?.cod || ""}:${item?.evento || ""}:${item?._cat || ""}`)
        .join("~"),
      auditParamsCacheKey,
    ]
      .map((part) => String(part ?? "").replace(/\s+/g, " ").trim())
      .join("|");
  }
  function getCachedAudit(input) {
    const key = makeAuditCacheKey(input);
    const cache = auditResultCacheRef.current;
    if (cache.has(key)) return cache.get(key);
    const result = analisarAnomaliasPonto(input, auditParams);
    if (cache.size > 12000) cache.clear();
    cache.set(key, result);
    return result;
  }
  function getEventAudit(ev, previousEv, britanicoMap = null) {
    return getCachedAudit(eventWithPreviousJourney(ev, previousEv, britanicoMap));
  }

  const inferRadarEventoFromAudit = (ev, auditoria = null) => {
    const text = normalizeSearchText(
      [
        ev?.evento,
        ev?.situacaoDesc,
        ev?._cat,
        auditoria?.observacao,
        auditoria?.regraAplicada,
        auditoria?.codigo,
      ]
        .filter(Boolean)
        .join(" "),
    );
    if (text.includes("interjornada") || text.includes("11h") || text.includes("11 horas")) {
      return "Interjornada insuficiente";
    }
    if (
      text.includes("intervalo") ||
      text.includes("refeicao") ||
      text.includes("refeição") ||
      /\b(1h|sir|6hsi)\b/.test(text)
    ) {
      return "Intervalo intrajornada";
    }
    if (text.includes("extra") || text.includes("sobrejornada") || text.includes("excedente")) {
      return "Horas extras";
    }
    if (text.includes("ferias") || text.includes("férias")) return "Ferias";
    if (text.includes("marcacao") || text.includes("marcação") || text.includes("ponto")) {
      return "Irregularidade de ponto / REP";
    }
    return ev?.evento || ev?.situacaoDesc || "";
  };

  const openRadarFromAudit = (ev, auditoria = null) => {
    const radarEvento = inferRadarEventoFromAudit(ev, auditoria);
    const detail = {
      page: "eventos",
      openPlaybook: true,
      evento: radarEvento || ev?.evento || ev?.situacaoDesc || "",
      eventoOriginal: ev?.evento || ev?.situacaoDesc || "",
      codigo: ev?.cod || ev?.codigo || "",
      colaborador: ev?.nome || "",
      matricula: ev?.mat || "",
      data: eventDateKey(ev) || "",
    };
    if (typeof onOpenRadar === "function") {
      onOpenRadar(detail);
      return;
    }
    try {
      window.__pbLastRadarOpenRequest = { ...detail, at: new Date().toISOString() };
      if (typeof window.__pbOpenRadarWorkspace === "function") {
        window.__pbOpenRadarWorkspace(detail);
        return;
      }
    } catch {}
    try {
      window.dispatchEvent(
        new CustomEvent("pb-open-radar", {
          detail,
        }),
      );
    } catch {}
  };

  const makeAuditReviewKey = (ev, audit) =>
    [
      ev?.mat || ev?.nome || "sem-colaborador",
      eventDateKey(ev) || "sem-data",
      ev?.cod || "",
      ev?.evento || ev?.situacaoDesc || "sem-evento",
      fmtMin(Number(ev?.horas) || 0),
      audit?.codigo || audit?.severidade || "auditoria",
    ]
      .map((part) => String(part || "").replace(/\s+/g, " ").trim())
      .join("|");

  const getAuditReview = (key) =>
    auditReviews[key] || {
      status: "pendente",
      justificativa: "",
      updatedAt: "",
      updatedBy: "local",
      history: [],
    };

  const updateAuditReview = (key, patch) => {
    if (!key) return;
    setAuditReviews((prev) => {
      const current = prev[key] || {
        status: "pendente",
        justificativa: "",
        updatedAt: "",
        updatedBy: "local",
        history: [],
      };
      const now = new Date().toISOString();
      const next = {
        ...current,
        ...patch,
        updatedAt: now,
        updatedBy: "local",
      };
      const changed = current.status !== next.status;
      const historyEntry = changed
        ? {
            at: now,
            by: "local",
            fromStatus: current.status || "pendente",
            toStatus: next.status || "pendente",
            justificativa: next.justificativa || "",
          }
        : null;
      return {
        ...prev,
        [key]: {
          ...next,
          history: historyEntry
            ? [...(Array.isArray(current.history) ? current.history : []), historyEntry]
            : Array.isArray(current.history)
              ? current.history
              : [],
        },
      };
    });
  };

  const auditReviewSummary = useMemo(() => {
    const summary = {
      total: 0,
      pendente: 0,
      revisado: 0,
      justificado: 0,
      ajuste: 0,
      ignorado: 0,
      criticaPendente: 0,
      altaPendente: 0,
      tratado: 0,
      tratadoPct: 0,
    };
    if (!showCollabAuditDetails) return summary;

    const byColab = new Map();
    const summaryIndices = deferredFilteredEventIndices;
    for (const idx of summaryIndices) {
      const ev = tableDataRows[idx];
      if (!ev || !hasCollaboratorEventContent(ev)) continue;
      const key = String(ev.mat || ev.nome || "__sem_colaborador__");
      if (!byColab.has(key)) byColab.set(key, []);
      byColab.get(key).push(ev);
    }

    for (const rows of byColab.values()) {
      const ordered = [...rows].sort((a, b) => {
        const da = eventDateKey(a) || "";
        const db = eventDateKey(b) || "";
        if (da !== db) return da.localeCompare(db);
        return String(a.horario || "").localeCompare(String(b.horario || ""));
      });
      const britanicoMap = new Map();
      for (const ev of ordered) {
        const signature = splitTimeTokens(ev?.marcacao || "").join(" ");
        const dateKey = eventDateKey(ev);
        if (!signature || !dateKey) continue;
        if (!britanicoMap.has(signature)) britanicoMap.set(signature, new Set());
        britanicoMap.get(signature).add(dateKey);
      }
      ordered.forEach((ev, idx) => {
        const audit = getEventAudit(ev, ordered[idx - 1], britanicoMap);
        if (!audit.memoria || audit.severidade === "ok") return;
        const review = getAuditDisplayReview(audit, getAuditReview(makeAuditReviewKey(ev, audit)));
        const status = review?.status || "pendente";
        summary.total += 1;
        summary[status] = (summary[status] || 0) + 1;
        if (status !== "pendente") summary.tratado += 1;
        if (status === "pendente" && isAuditActionable(audit) && audit.severidade === "critica") summary.criticaPendente += 1;
        if (status === "pendente" && isAuditActionable(audit) && audit.severidade === "alta") summary.altaPendente += 1;
      });
    }

    summary.tratadoPct = summary.total ? Math.round((summary.tratado / summary.total) * 100) : 0;
    return summary;
  }, [
    showCollabAuditDetails,
    deferredFilteredEventIndices,
    tableDataRows,
    auditParams,
    auditReviews,
  ]);

  const renderCollabResizeHandle = (colId) => (
    <span
      role="separator"
      aria-orientation="vertical"
      aria-label={`Redimensionar coluna ${colId}`}
      title="Arraste para redimensionar. Duplo clique restaura."
      className="hdm-col-resize-handle"
      onMouseDown={(e) => startCollabColumnResize(colId, e)}
      onDoubleClick={(e) => {
        e.preventDefault();
        e.stopPropagation();
        resetCollabColumnWidth(colId);
      }}
    />
  );

  const renderCollaboratorDetailHeader = () => (
    <tr ref={collabSubheadRef} className="hdm-collab-subhead-row">
      <th className="hdm-resizable-th">
        <span>Data</span>
        {renderCollabResizeHandle("data")}
      </th>
      <th className="hdm-resizable-th">
        <div className="hdm-collab-filter-head">
          <span>Evento</span>
          <button
            type="button"
            ref={(el) => {
              filterBtnRefs.current.evento = el;
            }}
            className={`hdm-filt-btn${isFiltered("evento") ? " active" : ""}`}
            onClick={(e) => {
              filterBtnRefs.current.evento = e.currentTarget;
              openFilter("evento");
            }}
            title="Filtrar Evento"
          >
            ▼
          </button>
        </div>
        {renderCollabResizeHandle("evento")}
      </th>
      {collabExtraCols.map((col) => (
        <th key={col.id} className={`hdm-collab-extra-th${col.numeric ? " hdm-th-num" : ""}`}>
          <div className="hdm-collab-filter-head">
            <span>{col.label}</span>
            <button
              type="button"
              ref={(el) => { filterBtnRefs.current[col.id] = el; }}
              className={`hdm-filt-btn${isFiltered(col.id) ? " active" : ""}`}
              onClick={(e) => {
                filterBtnRefs.current[col.id] = e.currentTarget;
                openFilter(col.id);
              }}
              title={`Filtrar ${col.label}`}
            >
              ▼
            </button>
            <button
              type="button"
              className="hdm-collab-col-hide-btn"
              onClick={() => setVisibleCols((prev) => { const n = new Set(prev); n.delete(col.id); return n; })}
              title={`Ocultar ${col.label}`}
            >
              ×
            </button>
          </div>
        </th>
      ))}
      <th className="hdm-resizable-th">
        <div className="hdm-collab-filter-head">
          <span>Horas</span>
          <button
            type="button"
            ref={(el) => {
              filterBtnRefs.current.horas = el;
            }}
            className={`hdm-filt-btn${isFiltered("horas") ? " active" : ""}`}
            onClick={(e) => {
              filterBtnRefs.current.horas = e.currentTarget;
              openFilter("horas");
            }}
            title="Filtrar Horas"
          >
            ▼
          </button>
        </div>
        {renderCollabResizeHandle("horas")}
      </th>
      <th className="hdm-resizable-th">
        <span>Horário / Marcação</span>
        {renderCollabResizeHandle("horario")}
      </th>
      {showCollabAuditDetails ? (
      <th className="hdm-audit-th hdm-resizable-th">
        <div className="hdm-collab-filter-head">
          <span>Auditoria</span>
          <button
            type="button"
            ref={(el) => {
              filterBtnRefs.current.auditoria = el;
            }}
            className={`hdm-filt-btn${isFiltered("auditoria") ? " active" : ""}`}
            onClick={(e) => {
              filterBtnRefs.current.auditoria = e.currentTarget;
              openFilter("auditoria");
            }}
            title="Filtrar por regra acionada"
          >
            â–¼
          </button>
        </div>
        {renderCollabResizeHandle("auditoria")}
      </th>
      ) : null}
    </tr>
  );

  const renderCollaboratorDetailRows = (nodes) => {
    if (!nodes || !nodes.length) return null;
    const pageSize = Math.max(1, Number(collabGroupLimit) || collabGroupInitialLimit || 24);
    const currentPage = Math.max(1, Number(collabGroupPage) || 1);
    const pageStart = (currentPage - 1) * pageSize;
    const pageEnd = pageStart + pageSize;
    const needsAuditDuringFilter = showCollabAuditDetails && (
      auditSeverityFilter !== "todos" ||
      auditReviewStatusFilter !== "todos" ||
      (auditCriticalPendingOnly && auditSeverityFilter !== "todos") ||
      isFiltered("auditoria")
    );
    const shouldScanAllGroups = auditWorkspaceMode && needsAuditDuringFilter;
    const candidateNodes = shouldScanAllGroups ? nodes : nodes.slice(pageStart, pageEnd);
    const filteredIndexSet = new Set(filteredEventIndices);
    const preparedNodes = candidateNodes.map((node) => {
      const sourceLeafIndices = collectAuditDetailLeafIndices(node);
      const britanicoMap = buildPontoBritanicoMap(sourceLeafIndices);
      const leafEntries = [];
      const sourceEntries = [];
      const matchedEntries = [];
      const hasDisplayColFilters = Object.values(colFilters).some(isHdmColFilterActive);
      sourceLeafIndices.forEach((idx, sourcePos) => {
        const ev = tableDataRows[idx];
        if (!hasCollaboratorEventContent(ev)) return;
        let audit = null;
        let reviewKey = "";
        let review = null;
        if (needsAuditDuringFilter || auditWorkspaceMode) {
          audit = getEventAudit(ev, tableDataRows[sourceLeafIndices[sourcePos - 1]], britanicoMap);
          reviewKey = makeAuditReviewKey(ev, audit);
          review = getAuditDisplayReview(audit, getAuditReview(reviewKey));
        }
        const entry = { idx, sourcePos, audit, reviewKey, review };
        sourceEntries.push(entry);
        let passesDisplayFilters = true;
        if (hasDisplayColFilters) {
          for (const [col, filterEntry] of Object.entries(colFilters)) {
            if (!isHdmColFilterActive(filterEntry)) continue;
            if (col === "auditoria") continue;
            const cellVal = getColFilterValue(ev, col, { stackHrsMrc, isEventsMode: true });
            if (!rowPassesHdmColFilter(cellVal, filterEntry, col, getColFilterDisplay)) {
              passesDisplayFilters = false;
              break;
            }
          }
        }
        let passesAuditFilter = true;
        if (needsAuditDuringFilter) {
          passesAuditFilter = filteredIndexSet.has(idx);
          if (passesAuditFilter && !auditPassesRuleFilter(audit, colFilters.auditoria)) {
            passesAuditFilter = false;
          }
          if (passesAuditFilter && auditOnly && audit.severidade === "ok") {
            passesAuditFilter = false;
          }
          if (passesAuditFilter && auditSeverityFilter !== "todos") {
            const severityOk = auditSeverityFilter === "ok"
              ? audit.severidade === "ok"
              : audit.severidade === auditSeverityFilter;
            if (!severityOk) passesAuditFilter = false;
          }
          if (passesAuditFilter && auditReviewStatusFilter !== "todos" && review.status !== auditReviewStatusFilter) {
            passesAuditFilter = false;
          }
          if (
            passesAuditFilter &&
            auditCriticalPendingOnly &&
            !(review.status === "pendente" && isAuditActionable(audit) && (audit.severidade === "critica" || audit.severidade === "alta"))
          ) {
            passesAuditFilter = false;
          }
        }
        const shouldDisplayEntry = passesDisplayFilters && passesAuditFilter;
        if (passesAuditFilter && passesDisplayFilters) matchedEntries.push(entry);
        if (shouldDisplayEntry) leafEntries.push(entry);
      });
      const groupKey = `${node.colKey}:${node.label}`;
      const visibleEntries = leafEntries;
      if (needsAuditDuringFilter && !matchedEntries.length) return null;
      const firstRow =
        (leafEntries.length ? tableDataRows[leafEntries[0].idx] : null) ||
        (sourceEntries.length ? tableDataRows[sourceEntries[0].idx] : null);
      if (!firstRow) return null;
      const summaryEntries = auditWorkspaceMode ? sourceEntries : leafEntries;
      const emptySeveritySummary = { critica: 0, alta: 0, media: 0, baixa: 0, ok: 0, pendente: 0, criticaPendente: 0, altaPendente: 0, semAcao: 0 };
      const severitySummary = showCollabAuditDetails
        ? summaryEntries.reduce(
            (acc, entry) => {
              const ev = tableDataRows[entry.idx];
              const audit = entry.audit || getEventAudit(ev, tableDataRows[sourceLeafIndices[entry.sourcePos - 1]], britanicoMap);
              const reviewKey = entry.reviewKey || makeAuditReviewKey(ev, audit);
              const review = entry.review || getAuditDisplayReview(audit, getAuditReview(reviewKey));
              const severity = audit.severidade || "ok";
              acc[severity] = (acc[severity] || 0) + 1;
              if (review.status === "pendente" && isAuditActionable(audit)) {
                acc.pendente += 1;
                if (severity === "critica") acc.criticaPendente += 1;
                if (severity === "alta") acc.altaPendente += 1;
              }
              if (review.status === "sem_acao") acc.semAcao += 1;
              return acc;
            },
            { ...emptySeveritySummary },
          )
        : emptySeveritySummary;
      return { node, sourceLeafIndices, sourceEntries, britanicoMap, leafEntries, groupKey, visibleEntries, firstRow, severitySummary, hasDisplayColFilters };
    }).filter(Boolean);
    const totalGroupCount = shouldScanAllGroups ? preparedNodes.length : nodes.length;
    const totalPages = Math.max(1, Math.ceil(totalGroupCount / pageSize));
    const boundedPage = Math.min(currentPage, totalPages);
    const boundedStart = (boundedPage - 1) * pageSize;
    const boundedEnd = boundedStart + pageSize;
    const visiblePreparedNodes = shouldScanAllGroups
      ? preparedNodes.slice(boundedStart, boundedEnd)
      : preparedNodes;
    const firstVisibleGroup = totalGroupCount ? boundedStart + 1 : 0;
    const lastVisibleGroup = Math.min(totalGroupCount, boundedStart + visiblePreparedNodes.length);
    const rendered = visiblePreparedNodes.flatMap((prepared) => {
      const { node, sourceLeafIndices, sourceEntries, britanicoMap, leafEntries, groupKey, visibleEntries, firstRow, severitySummary, hasDisplayColFilters } = prepared;
      const mat = firstRow?.mat || node.label || "";
      const nome = firstRow?.nome || "";
      const depto = firstRow?.depto || firstRow?.departamento || "";
      const groupLabel = `${mat}${nome ? ` - ${nome}` : ""}`;
      const visibleDayCounts = visibleEntries.reduce((acc, entry) => {
        const key = eventDateKey(tableDataRows[entry.idx]) || "sem-data";
        acc.set(key, (acc.get(key) || 0) + 1);
        return acc;
      }, new Map());
      const showFullTitleBadges =
        !auditWorkspaceMode ||
        (!needsAuditDuringFilter && !hasDisplayColFilters && leafEntries.length === sourceEntries.length);
      return [
        <tr key={`${node.colKey}:${node.label}:title`} className="hdm-collab-title-row">
          <td colSpan={collabDetailColSpan}>
            <button
              type="button"
              className="hdm-grp-btn-inline hdm-collab-title-btn"
              onClick={() =>
                setCollapsed((prev) => {
                  const n = new Set(prev);
                  n.has(groupKey) ? n.delete(groupKey) : n.add(groupKey);
                  return n;
                })
              }
            >
              <span className={`hdm-grp-arrow${collapsed.has(groupKey) ? "" : " open"}`}>
                ▶
              </span>
              <strong>{groupLabel}</strong>
              {depto ? <span className="hdm-collab-dept">Depto: {depto}</span> : null}
              {firstRow?.filial && visibleCols.has("filial") ? <span className="hdm-collab-dept">Filial: {firstRow.filial}</span> : null}
              {firstRow?.cargo && visibleCols.has("cargo") ? <span className="hdm-collab-dept">Cargo: {firstRow.cargo}</span> : null}
              <span className="hdm-grp-meta">
                {" · "}
                {sourceEntries.length.toLocaleString("pt-BR")} evento{sourceEntries.length !== 1 ? "s" : ""}
                {leafEntries.length !== sourceEntries.length
                  ? ` · ${leafEntries.length.toLocaleString("pt-BR")} exibidos`
                  : ""}
              </span>
              {showCollabAuditDetails ? (
              <span
                className={`hdm-collab-title-badges${showFullTitleBadges ? "" : " is-compact"}`}
                aria-label="Resumo da auditoria do colaborador"
              >
                {severitySummary.criticaPendente > 0 ? <span className="is-critica">Crit. pend. {severitySummary.criticaPendente.toLocaleString("pt-BR")}</span> : null}
                {severitySummary.altaPendente > 0 ? <span className="is-alta">Altas pend. {severitySummary.altaPendente.toLocaleString("pt-BR")}</span> : null}
                {severitySummary.media > 0 ? <span className="is-media">Med. {severitySummary.media.toLocaleString("pt-BR")}</span> : null}
                {severitySummary.semAcao > 0 ? <span className="is-sem-acao">Sem ação {severitySummary.semAcao.toLocaleString("pt-BR")}</span> : null}
                {severitySummary.ok > 0 ? <span className="is-ok">OK {severitySummary.ok.toLocaleString("pt-BR")}</span> : null}
              </span>
              ) : null}
            </button>
          </td>
        </tr>,
        !collapsed.has(groupKey) ? (
          <React.Fragment key={`${node.colKey}:${node.label}:rows`}>
            {visibleEntries.map(({ idx, sourcePos, audit, reviewKey: preReviewKey, review: preReview }, visiblePos) => {
              const ev = tableDataRows[idx];
              const dk = eventDateKey(ev);
              const prevVisible = visiblePos > 0 ? tableDataRows[visibleEntries[visiblePos - 1].idx] : null;
              const startsDay = visiblePos === 0 || eventDateKey(prevVisible) !== dk;
              const dayEventCount = visibleDayCounts.get(dk || "sem-data") || 1;
              const isMultiEventDay = dayEventCount > 1;
              const startsMultiEventDay = startsDay && isMultiEventDay;
              const mrc = marcacaoDistinctFromHorario(ev.horario, ev.marcacao) || ev.marcacao || "";
              const horarioParts = splitTimeTokens(ev.horario);
              const marcacaoParts = splitMarkDisplayTokens(mrc);
              const hasRealMarks = marcacaoParts.length > 0;
              const markDisplaySlots = buildMarkDisplaySlots(horarioParts, marcacaoParts);
              const markSlots = markDisplaySlots.length;
              const previousEv = tableDataRows[sourceLeafIndices[sourcePos - 1]];
              const auditoria = showCollabAuditDetails ? (audit || getEventAudit(ev, previousEv, britanicoMap)) : null;
              const obs = String(auditoria?.observacao || "")
                .replace(/^(Critica|Crítica|Alta|Media|Média|Baixa|OK):\s*/i, "");
              const reviewKey = showCollabAuditDetails ? (preReviewKey || makeAuditReviewKey(ev, auditoria)) : "";
              const review = showCollabAuditDetails
                ? (preReview || getAuditDisplayReview(auditoria, getAuditReview(reviewKey)))
                : null;
              const openAuditMemoria = () => {
                setAuditQuestion("resumo");
                setAuditMemoria({
                  ...auditoria.memoria,
                  reviewKey,
                  review,
                  colaborador: ev.nome || "",
                  matricula: ev.mat || "",
                  departamento: ev.depto || ev.departamento || "",
                  data: fmtDate(eventDateKey(ev)),
                });
              };
              return (
                <tr
                  key={`${node.colKey}:${node.label}:${idx}`}
                  className={`hdm-collab-event-row ${evtRowClass(ev)}${startsDay && visiblePos > 0 ? " hdm-day-sep" : ""}${startsMultiEventDay ? " hdm-day-start" : ""}`}
                >
                  <td className={`hdm-collab-date${startsDay ? "" : " hdm-collab-date-repeat"}`}>
                    {startsDay ? (
                      <>
                        <strong>{fmtDate(dk)}</strong>
                        {fmtWeekdayShort(dk) ? <span>{fmtWeekdayShort(dk)}</span> : null}
                      </>
                    ) : null}
                  </td>
                  <td className="hdm-collab-event">
                    <div className="hdm-collab-event-inner">
                      {ev.cod ? <span className="hdm-collab-ev-cod">{ev.cod}</span> : null}
                      <span>{ev.evento || ev.situacaoDesc || "Evento sem descrição"}</span>
                    </div>
                  </td>
                  {collabExtraCols.map((col) => {
                    let val;
                    if (col.id === "_cat") val = EVENT_CAT_LABELS[ev._cat] || ev._cat || "—";
                    else if (col.id === "hrsPlan") val = ev.hrsPlan > 0 ? fmtMin(Number(ev.hrsPlan)) : "—";
                    else val = ev[col.id] || "—";
                    return (
                      <td key={col.id} className={`hdm-td-text hdm-collab-extra-td${col.numeric ? " hdm-td-num" : ""}`}>
                        {val}
                      </td>
                    );
                  })}
                  <td className="hdm-collab-hours">{fmtMin(Number(ev.horas) || 0)}</td>
                  {isMultiEventDay && !startsDay ? null : (
                  <td
                    className={`hdm-collab-marks hdm-td-calc${isMultiEventDay ? " hdm-collab-marks--shared" : ""}`}
                    rowSpan={isMultiEventDay && startsDay ? dayEventCount : undefined}
                    title="Abrir calculadora de horas"
                    onClick={() => setCalcEv(ev)}
                  >
                    <div className="hdm-collab-mark-line" style={{ "--mark-slots": markSlots }}>
                      <span className="hdm-collab-mark-label">Hor:</span>
                      <span className="hdm-collab-mark-values">
                        {markDisplaySlots.map((slot, partIdx) => (
                          <span key={`${idx}-hor-${partIdx}`} className="hdm-collab-time-slot">
                            {slot.prev || ""}
                          </span>
                        ))}
                      </span>
                    </div>
                    {hasRealMarks ? (
                      <>
                        <div className="hdm-collab-mark-line hdm-collab-marcacao" style={{ "--mark-slots": markSlots }}>
                          <span className="hdm-collab-mark-label">Mar:</span>
                          <span className="hdm-collab-mark-values">
                            {markDisplaySlots.map((slot, partIdx) => {
                              const isSpecialToken = slot.real && !/^\d{1,2}:\d{2}$/.test(slot.real);
                              const cls = !slot.real
                                ? "hdm-marc-missing"
                                : isSpecialToken
                                  ? "hdm-marc-token"
                                  : partIdx % 2 === 0 ? "hdm-marc-in" : "hdm-marc-out";
                              return (
                                <span key={`${idx}-mrc-${partIdx}`} className={`hdm-collab-time-slot ${cls}`}>
                                  {slot.real || (slot.prev ? "—" : "")}
                                </span>
                              );
                            })}
                          </span>
                        </div>
                        <div className="hdm-collab-mark-line hdm-collab-diff" style={{ "--mark-slots": markSlots }}>
                          <span className="hdm-collab-mark-label">Dif:</span>
                          <span className="hdm-collab-mark-values">
                            {markDisplaySlots.map((slot, partIdx) => (
                              <span
                                key={`${idx}-dif-${partIdx}`}
                                className={`hdm-collab-time-slot hdm-diff-slot hdm-diff-${slot.sign}${slot.severe ? " is-severe" : ""}`}
                              >
                                {slot.diffText}
                              </span>
                            ))}
                          </span>
                        </div>
                      </>
                    ) : null}
                  </td>
                  )}
                  {showCollabAuditDetails ? (
                  <td
                    className={`hdm-collab-obs ${auditoria.severidade && auditoria.severidade !== "ok" ? `hdm-audit-${auditoria.severidade}` : ""}`}
                    data-severity={auditoria.severidade || "ok"}
                    title={auditoria.detalhes?.length ? auditoria.detalhes.join("\n") : undefined}
                  >
                    {auditoria.memoria ? (
                      <div className="hdm-audit-chip">
                        <button
                          type="button"
                          className="hdm-audit-chip-main"
                          onClick={openAuditMemoria}
                        >
                          {(auditoria.tratamentoRegra || auditParams?.tratamentoRegras?.[auditoria?.codigo] || "acao") !== "informativa" && (
                            <span className={`hdm-audit-severity-badge hdm-audit-severity-${auditoria.severidade || "ok"}`}>
                              {auditoria.severidade === "critica"
                                ? "Critica"
                                : auditoria.severidade === "alta"
                                  ? "Alta"
                                  : auditoria.severidade === "media"
                                    ? "Media"
                                    : auditoria.severidade === "baixa"
                                      ? "Baixa"
                                      : "OK"}
                            </span>
                          )}
                          {(auditoria.tratamentoRegra || auditParams?.tratamentoRegras?.[auditoria?.codigo] || "acao") !== "informativa" && (
                            <span className={`hdm-audit-review-badge hdm-audit-review-${review.status}`}>
                              {AUDIT_REVIEW_LABELS[review.status] || review.status}
                            </span>
                          )}
                          <span className="hdm-audit-message">{obs}</span>
                        </button>
                        {(auditoria.tratamentoRegra || auditParams?.tratamentoRegras?.[auditoria?.codigo] || "acao") !== "informativa" && (
                        <details className="hdm-audit-actions-menu" onClick={(e) => e.stopPropagation()}>
                          <summary>Ações</summary>
                          {(() => {
                            const trat = auditoria.tratamentoRegra || auditParams?.tratamentoRegras?.[auditoria?.codigo] || "acao";
                            const isAcao = trat === "acao";
                            const isRevisao = trat === "revisao_manual";
                            const isNaoAplicavel = trat === "nao_aplicavel";
                            return (
                              <div className="hdm-audit-actions-pop">
                                <button type="button" onClick={openAuditMemoria}>
                                  Memoria / explicacao
                                </button>
                                {(isAcao || isRevisao) && (
                                  <button
                                    type="button"
                                    onClick={() => updateAuditReview(reviewKey, { status: "revisado" })}
                                  >
                                    Revisar
                                  </button>
                                )}
                                {isAcao && (
                                  <button
                                    type="button"
                                    onClick={() => updateAuditReview(reviewKey, { status: "justificado" })}
                                  >
                                    Justificar
                                  </button>
                                )}
                                {isAcao && (
                                  <button
                                    type="button"
                                    onClick={() => updateAuditReview(reviewKey, { status: "ajuste" })}
                                  >
                                    Corrigir
                                  </button>
                                )}
                                {(isAcao || isRevisao || isNaoAplicavel) && (
                                  <button
                                    type="button"
                                    onClick={() =>
                                      updateAuditReview(reviewKey, {
                                        status: "sem_acao",
                                        justificativa: getAuditReview(reviewKey).justificativa || "Evento marcado como sem ação.",
                                      })
                                    }
                                  >
                                    Sem ação
                                  </button>
                                )}
                              </div>
                            );
                          })()}
                        </details>
                        )}
                      </div>
                    ) : auditoria.radarTrabalhista ? (
                      <button
                        type="button"
                        className="hdm-audit-radar-link"
                        onClick={() => openRadarFromAudit(ev, auditoria)}
                        title="Abrir Radar Trabalhista"
                      >
                        <span className="hdm-audit-review-badge hdm-audit-review-sem_acao">RADAR</span>
                        <span>Risco trabalhista. Consulte o Radar.</span>
                      </button>
                    ) : (
                      obs || null
                    )}
                  </td>
                  ) : null}
                </tr>
              );
            })}
          </React.Fragment>
        ) : null,
      ];
    });
    if (totalPages > 1) {
      rendered.push(
        <tr key="__collab-groups-pagination" className="hdm-collab-more-row hdm-collab-group-more-row">
          <td colSpan={collabDetailColSpan}>
            <div className="hdm-collab-pagination">
              <span>
                Colaboradores {firstVisibleGroup.toLocaleString("pt-BR")}-{lastVisibleGroup.toLocaleString("pt-BR")} de{" "}
                {totalGroupCount.toLocaleString("pt-BR")}
              </span>
              <button type="button" disabled={boundedPage <= 1} onClick={() => setCollabGroupPage(1)}>
                Primeiro
              </button>
              <button
                type="button"
                disabled={boundedPage <= 1}
                onClick={() => setCollabGroupPage((page) => Math.max(1, page - 1))}
              >
                Anterior
              </button>
              <strong>
                Pagina {boundedPage.toLocaleString("pt-BR")} / {totalPages.toLocaleString("pt-BR")}
              </strong>
              <button
                type="button"
                disabled={boundedPage >= totalPages}
                onClick={() => setCollabGroupPage((page) => Math.min(totalPages, page + 1))}
              >
                Proxima
              </button>
              <button type="button" disabled={boundedPage >= totalPages} onClick={() => setCollabGroupPage(totalPages)}>
                Ultima
              </button>
            </div>
          </td>
        </tr>,
      );
    }
    if (!rendered.length) {
      return [
        <tr key="__collab-empty-after-filter">
          <td colSpan={collabDetailColSpan} className="hdm-empty">
            Nenhum evento encontrado para os filtros atuais.
          </td>
        </tr>,
      ];
    }
    return rendered;
  };

  /* pills (employees mode only) */
  const presCount = emps0.filter((e) => e.hrsPres > 0).length;
  const auseCount = emps0.filter((e) => e.hrsAuse > 0).length;
  const justCount = emps0.filter((e) => e.hrsJust > 0 && e.hrsAuse === 0).length;
  const extrCount = emps0.filter((e) => e.hrsExtr > 0).length;

  /* row class — employees */
  const rowClass = (e) => {
    if (e.hrsAuse > 0 && e.hrsPres === 0) return "hdm-row-ause";
    if (e.hrsAuse > 0) return "hdm-row-ause-p";
    if (e.hrsJust > 0) return "hdm-row-just";
    if (e.hrsExtr > 0) return "hdm-row-extr";
    if (e.hrsPres > 0) return "hdm-row-pres";
    return "";
  };

  /* row class — events */
  const evtRowClass = (ev) => {
    switch (ev._cat) {
      case "presentes":
        return "hdm-row-pres";
      case "ausentes":
        return "hdm-row-ause";
      case "justificadas":
        return "hdm-row-just";
      case "extras":
        return "hdm-row-extr";
      case "risco":
        return "hdm-row-risk";
      case "noturnas":
        return "hdm-row-night";
      default:
        return "";
    }
  };

  /* render helpers — employees (colOrder-aware) */
  const empCellFor = (colId, e) => {
    if (colId === "nome")
      return (
        <td key="nome" className="hdm-td-name">
          <span className="hdm-emp-name">{e.nome || e.mat}</span>
        </td>
      );
    if (!colVisible(colId)) return null;
    switch (colId) {
      case "mat":
        return (
          <td key={colId} className="hdm-td-mono">
            {e.mat || "—"}
          </td>
        );
      case "genero":
        return (
          <td key={colId} className="hdm-td-text">
            {e.genero || "-"}
          </td>
        );
      case "data":
        return (
          <td key={colId} className="hdm-td-text">
            {fmtDate(e.data)}
          </td>
        );
      case "depto":
        return (
          <td key={colId} className="hdm-td-text">
            {e.depto || "—"}
          </td>
        );
      case "filial":
        return (
          <td key={colId} className="hdm-td-text">
            {e.filial || "—"}
          </td>
        );
      case "plan":
        return (
          <td key={colId} className="hdm-td-num">
            {fmtMin(e.hrsPlan)}
          </td>
        );
      case "pres":
        return (
          <td key={colId} className="hdm-td-num hdm-c-pres">
            {fmtMin(e.hrsPres)}
          </td>
        );
      case "ause":
        return (
          <td key={colId} className="hdm-td-num hdm-c-ause">
            {e.hrsAuse > 0 ? fmtMin(e.hrsAuse) : "—"}
          </td>
        );
      case "just":
        return (
          <td key={colId} className="hdm-td-num hdm-c-just">
            {e.hrsJust > 0 ? fmtMin(e.hrsJust) : "—"}
          </td>
        );
      case "extr":
        return (
          <td key={colId} className="hdm-td-num hdm-c-extr">
            {e.hrsExtr > 0 ? fmtMin(e.hrsExtr) : "—"}
          </td>
        );
      case "abs":
        return (
          <td key={colId} className="hdm-td-num">
            {absIdx(e) > 0 ? (
              <span
                className={`hdm-abs${absIdx(e) >= 20 ? " high" : absIdx(e) >= 10 ? " mid" : ""}`}
              >
                {fmtPct(absIdx(e))}
              </span>
            ) : (
              "—"
            )}
          </td>
        );
      default:
        return null;
    }
  };
  const empTotalFor = (colId, t, labelText = null, labelStyle = null) => {
    if (colId === "nome")
      return (
        <td key="nome" className="hdm-totals-lbl" style={labelStyle ?? undefined}>
          {labelText ?? `Total geral (${filteredCount})`}
        </td>
      );
    if (!colVisible(colId)) return null;
    switch (colId) {
      case "mat":
      case "genero":
      case "data":
      case "depto":
      case "filial":
        return <td key={colId} />;
      case "plan":
        return (
          <td key={colId} className="hdm-td-num">
            {fmtMin(t.hrsPlan)}
          </td>
        );
      case "pres":
        return (
          <td key={colId} className="hdm-td-num hdm-c-pres">
            {fmtMin(t.hrsPres)}
          </td>
        );
      case "ause":
        return (
          <td key={colId} className="hdm-td-num hdm-c-ause">
            {fmtMin(t.hrsAuse)}
          </td>
        );
      case "just":
        return (
          <td key={colId} className="hdm-td-num hdm-c-just">
            {fmtMin(t.hrsJust)}
          </td>
        );
      case "extr":
        return (
          <td key={colId} className="hdm-td-num hdm-c-extr">
            {fmtMin(t.hrsExtr)}
          </td>
        );
      case "abs":
        return (
          <td key={colId} className="hdm-td-num">
            {fmtPct(t.hrsPlan > 0 ? ((t.hrsAuse + t.hrsJust) / t.hrsPlan) * 100 : null)}
          </td>
        );
      default:
        return null;
    }
  };
  const renderEmpCells = (e) => renderedColIds.map((colId) => empCellFor(colId, e));
  const renderTotalCells = (t, labelText = null, labelStyle = null) =>
    renderedColIds.map((colId) => empTotalFor(colId, t, labelText, labelStyle));

  /* render helpers — events (colOrder-aware) */
  const evtCellFor = (colId, ev) => {
    if (colId === "nome")
      return (
        <td key="nome" className="hdm-td-name">
          <span className="hdm-emp-name">{ev.nome || ev.mat}</span>
        </td>
      );
    if (!colVisible(colId)) return null;
    switch (colId) {
      case "mat":
        return (
          <td key={colId} className="hdm-td-mono">
            {ev.mat || "—"}
          </td>
        );
      case "filial":
        return (
          <td key={colId} className="hdm-td-text">
            {ev.filial || "—"}
          </td>
        );
      case "depto":
        return (
          <td key={colId} className="hdm-td-text">
            {ev.depto || "—"}
          </td>
        );
      case "cargo":
        return (
          <td key={colId} className="hdm-td-text">
            {ev.cargo || "—"}
          </td>
        );
      case "genero":
        return (
          <td key={colId} className="hdm-td-text">
            {ev.genero || "-"}
          </td>
        );
      case "_cat": {
        const lbl = ev._cat ? EVENT_CAT_LABELS[ev._cat] || ev._cat : "—";
        return (
          <td key={colId} className="hdm-td-text">
            <span className={`hdm-cat-badge ${EVENT_CAT_CLASSES[ev._cat] || ""}`}>{lbl}</span>
          </td>
        );
      }
      case "data":
        return (
          <td key={colId} className="hdm-td-mono">
            {fmtDate(eventDateKey(ev))}
          </td>
        );
      case "inicio":
        return (
          <td key={colId} className="hdm-td-mono">
            {getGridCellText(ev, "inicio") || "—"}
          </td>
        );
      case "termino":
        return (
          <td key={colId} className="hdm-td-mono">
            {getGridCellText(ev, "termino") || "—"}
          </td>
        );
      case "qtd_dias":
        return (
          <td key={colId} className="hdm-td-num">
            {getGridCellText(ev, "qtd_dias") || "—"}
          </td>
        );
      case "justificativa":
        return (
          <td key={colId} className="hdm-td-text">
            {getGridCellText(ev, "justificativa") || "—"}
          </td>
        );
      case "horario": {
        if (stackHrsMrc) {
          const horStr = ev.horario || "";
          const mrcStr = marcacaoDistinctFromHorario(horStr, ev.marcacao);
          const horPfxM = horStr.match(/^(\d+)\s*-\s*(.*)/);
          const horNum = horPfxM ? horPfxM[1] : "";
          const horTimes = (horPfxM ? horPfxM[2] : horStr).trim().split(/\s+/).filter(Boolean);
          const mrcPfxM = mrcStr.match(/^(\d+)\s*-\s*(.*)/);
          const mrcTimes = (mrcPfxM ? mrcPfxM[2] : mrcStr).trim().split(/\s+/).filter(Boolean);
          const hasPrefix = !!(horNum || mrcPfxM);
          return (
            <td
              key="horario"
              className="hdm-td-stacked-hrs hdm-td-calc"
              title="Abrir calculadora de horas"
              onClick={() => setCalcEv(ev)}
            >
              <div className="hdm-stacked-row hdm-stacked-hor-row">
                {hasPrefix && (
                  <span className="hdm-hor-pfx">
                    <span className="hdm-hor-pfx-num">{horNum}</span>
                    <span className="hdm-hor-pfx-sep"> - </span>
                  </span>
                )}
                {horTimes.length ? (
                  horTimes.map((t, i) => (
                    <span key={i} className="hdm-tslot hdm-tslot-hor">
                      {t}
                    </span>
                  ))
                ) : (
                  <span className="hdm-tslot-empty">—</span>
                )}
              </div>
              <div className="hdm-stacked-row hdm-stacked-mrc-row">
                {hasPrefix && (
                  <span className="hdm-hor-pfx" aria-hidden="true" style={{ visibility: "hidden" }}>
                    <span className="hdm-hor-pfx-num">{horNum}</span>
                    <span className="hdm-hor-pfx-sep"> - </span>
                  </span>
                )}
                {mrcTimes.length ? (
                  mrcTimes.map((t, i) => (
                    <span
                      key={i}
                      className={`hdm-tslot ${i % 2 === 0 ? "hdm-tslot-entrada" : "hdm-tslot-saida"}`}
                    >
                      {t}
                    </span>
                  ))
                ) : (
                  <span className="hdm-tslot-empty">—</span>
                )}
              </div>
            </td>
          );
        }
        return (
          <td
            key={colId}
            className="hdm-td-mono hdm-td-calc"
            title="Abrir calculadora de horas"
            onClick={() => setCalcEv(ev)}
          >
            {ev.horario || "—"}
          </td>
        );
      }
      case "hrsPlan":
        return (
          <td key={colId} className="hdm-td-num">
            {parseHorarioMin(ev.horario) > 0 ? fmtMin(parseHorarioMin(ev.horario)) : "—"}
          </td>
        );
      case "marcacao":
        if (stackHrsMrc) return null;
        return (
          <td
            key={colId}
            className="hdm-td-mono hdm-td-calc"
            title="Abrir calculadora de horas"
            onClick={() => setCalcEv(ev)}
          >
            {marcacaoDistinctFromHorario(ev.horario, ev.marcacao) || "—"}
          </td>
        );
      case "cod":
        return (
          <td key={colId} className="hdm-td-text">
            {ev.cod || "—"}
          </td>
        );
      case "evento":
        return (
          <td key={colId} className="hdm-td-text">
            <span className="hdm-evento-cell">
              {ev.evento || "—"}
              {isArt473PreventivaEvent(ev) ? (
                <span className="hdm-art473-badge" title="Ausência preventiva — art. 473, XII, CLT">
                  473
                </span>
              ) : null}
            </span>
          </td>
        );
      case "cid":
        return (
          <td key={colId} className="hdm-td-mono">
            {ev.cid || "—"}
          </td>
        );
      case "cidDescricao":
        return (
          <td key={colId} className="hdm-td-text">
            {ev.cidDescricao || "—"}
          </td>
        );
      case "atividade":
        return (
          <td key={colId} className="hdm-td-text">
            {ev.atividade || "—"}
          </td>
        );
      case "situacaoDesc":
        return (
          <td key={colId} className="hdm-td-text">
            {ev.situacaoDesc || "—"}
          </td>
        );
      case "horas":
        return (
          <td key={colId} className="hdm-td-num">
            {ev.horas > 0 ? fmtMin(ev.horas) : "—"}
          </td>
        );
      case "saldoAnteriorBH":
        return (
          <td key={colId} className="hdm-td-num">
            {ev.saldoAnteriorBH != null ? fmtMin(Math.abs(Number(ev.saldoAnteriorBH) || 0)) : "-"}
          </td>
        );
      case "creditoBH":
        return (
          <td key={colId} className="hdm-td-num hdm-c-extr">
            {Number(ev.creditoBH || 0) ? fmtMin(Math.abs(Number(ev.creditoBH) || 0)) : "-"}
          </td>
        );
      case "debitoBH":
        return (
          <td key={colId} className="hdm-td-num hdm-c-ause">
            {Number(ev.debitoBH || 0) ? fmtMin(Math.abs(Number(ev.debitoBH) || 0)) : "-"}
          </td>
        );
      case "horasPagasBH":
        return (
          <td key={colId} className="hdm-td-num">
            {Number(ev.horasPagasBH || 0) ? fmtMin(Math.abs(Number(ev.horasPagasBH) || 0)) : "-"}
          </td>
        );
      case "saldoProximoBH": {
        const v = ev.saldoProximoBH != null ? Number(ev.saldoProximoBH) || 0 : null;
        return (
          <td key={colId} className={`hdm-td-num ${v != null && v < 0 ? "hdm-c-ause" : "hdm-c-pres"}`}>
            {v != null ? fmtMin(Math.abs(v)) : "-"}
          </td>
        );
      }
      default:
        return null;
    }
  };
  const totalsRowLabel = isSheetImportEmbedded ? "Totais" : `Total geral (${filteredCount})`;
  const evtTotalFor = (colId, t, labelText = null, labelStyle = null) => {
    if (colId === "nome")
      return (
        <td key="nome" className="hdm-totals-lbl" style={labelStyle ?? undefined}>
          {labelText ?? totalsRowLabel}
        </td>
      );
    if (!colVisible(colId)) return null;
    switch (colId) {
      case "marcacao":
        if (stackHrsMrc) return null;
        return <td key={colId} />;
      case "mat":
      case "filial":
      case "depto":
      case "cargo":
      case "genero":
      case "_cat":
      case "data":
      case "inicio":
      case "termino":
      case "qtd_dias":
      case "justificativa":
      case "horario":
      case "cod":
      case "evento":
      case "cid":
      case "cidDescricao":
      case "atividade":
      case "situacaoDesc":
        return <td key={colId} />;
      case "saldoAnteriorBH":
        return (
          <td key={colId} className="hdm-td-num">
            {fmtMin(Math.abs(Number(t.saldoAnteriorBH) || 0))}
          </td>
        );
      case "creditoBH":
        return (
          <td key={colId} className="hdm-td-num hdm-c-extr">
            {fmtMin(Math.abs(Number(t.creditoBH) || 0))}
          </td>
        );
      case "debitoBH":
        return (
          <td key={colId} className="hdm-td-num hdm-c-ause">
            {fmtMin(Math.abs(Number(t.debitoBH) || 0))}
          </td>
        );
      case "horasPagasBH":
        return (
          <td key={colId} className="hdm-td-num">
            {fmtMin(Math.abs(Number(t.horasPagasBH) || 0))}
          </td>
        );
      case "saldoProximoBH": {
        const totalSaldo = Number(t.saldoProximoBH) || 0;
        return (
          <td
            key={colId}
            className={`hdm-td-num ${totalSaldo < 0 ? "hdm-c-ause" : totalSaldo > 0 ? "hdm-c-pres" : ""}`}
          >
            {fmtMin(Math.abs(totalSaldo))}
          </td>
        );
      }
      case "hrsPlan":
        return (
          <td
            key={colId}
            className="hdm-td-num"
            title={evtTotalsFootnote || undefined}
          >
            {t.horasPlan > 0 ? fmtMin(t.horasPlan) : "—"}
          </td>
        );
      case "horas":
        return (
          <td
            key={colId}
            className="hdm-td-num"
            title={evtTotalsFootnote || undefined}
          >
            {t.horas > 0 ? fmtMin(t.horas) : "—"}
          </td>
        );
      default:
        return null;
    }
  };
  const renderEvtCells = (ev) => renderedColIds.map((colId) => evtCellFor(colId, ev));
  const renderEvtTotalCells = (t, labelText = null, labelStyle = null) =>
    renderedColIds.map((colId) => evtTotalFor(colId, t, labelText, labelStyle));

  const renderGroupHeaderCells = (grpLabel, gt, meta, depth, isCollapsed, onToggle) => {
    const pad = 10 + depth * 18;
    return renderedColIds.map((colId) => {
      if (colId === "nome") {
        return (
          <td key="nome" className="hdm-totals-lbl hdm-grp-lbl-cell" style={{ paddingLeft: pad }}>
            <button type="button" className="hdm-grp-btn-inline" onClick={onToggle}>
              <span className={`hdm-grp-arrow${isCollapsed ? "" : " open"}`}>▶</span>
              <strong>{grpLabel}</strong>
              {meta ? <span className="hdm-grp-meta"> · {meta}</span> : null}
            </button>
          </td>
        );
      }
      if (isEventsMode) {
        const cell = evtTotalFor(colId, gt);
        if (!cell) return null;
        return React.cloneElement(cell, {
          key: colId,
          className: [cell.props.className, "hdm-grp-tot-cell"].filter(Boolean).join(" "),
        });
      }
      const cell = empTotalFor(colId, gt);
      if (!cell) return null;
      return React.cloneElement(cell, {
        key: colId,
        className: [cell.props.className, "hdm-grp-tot-cell"].filter(Boolean).join(" "),
      });
    });
  };

  const renderColHeader = (colId) => {
    if (colId === "nome") {
      return (
        <th
          key="nome"
          className={`hdm-th hdm-th-name${dragOverId === "nome" ? " drag-over" : ""}`}
          ref={(el) => {
            thRefs.current["nome"] = el;
          }}
          title="Colaborador"
          style={
            colWidths["nome"]
              ? { width: colWidths["nome"], minWidth: colWidths["nome"] }
              : undefined
          }
          onDragOver={(e) => {
            e.preventDefault();
            e.dataTransfer.dropEffect = "move";
            setDragOverId("nome");
          }}
          onDragLeave={(e) => {
            if (!e.currentTarget.contains(e.relatedTarget)) setDragOverId(null);
          }}
          onDrop={(e) => {
            e.preventDefault();
            const fromId = e.dataTransfer.getData("text/plain");
            if (!fromId || fromId === "nome") {
              setDragOverId(null);
              return;
            }
            reorderColOrder(fromId, "nome");
            setDragOverId(null);
          }}
        >
          <div className="hdm-th-inner">
            <span
              className="hdm-col-handle no-group"
              draggable
              title="Arraste para reordenar"
              onDragStart={(e) => {
                e.dataTransfer.effectAllowed = "move";
                e.dataTransfer.setData("text/plain", "nome");
              }}
              onDragEnd={() => setDragOverId(null)}
            >
              ⠿
            </span>
            <button
              type="button"
              className={`hdm-sort${sortCol === "nome" ? " active" : ""}`}
              onClick={(e) => {
                e.stopPropagation();
                toggleSort("nome");
              }}
            >
              <span className="hdm-sort-label">Colaborador</span>
              <span className="hdm-arrow">
                {sortCol === "nome" ? (sortDir === "asc" ? "▲" : "▼") : "⇅"}
              </span>
            </button>
            <button
              type="button"
              ref={(el) => {
                filterBtnRefs.current.nome = el;
              }}
              className={`hdm-filt-btn${isFiltered("nome") ? " active" : ""}`}
              onPointerDown={(e) => {
                e.preventDefault();
                e.stopPropagation();
                openFilter("nome", e.currentTarget);
              }}
              title="Filtrar colaborador"
            >
              ▼
            </button>
          </div>
          <div
            className="hdm-col-resizer"
            title="Arraste para redimensionar"
            onMouseDown={(e) => startColResize("nome", e)}
          />
        </th>
      );
    }
    if (stackHrsMrc && colId === "marcacao") return null;
    const def = COLS.find((c) => c.id === colId);
    if (!def || !colVisible(colId)) return null;
    const active = sortCol === colId;
    const grpIdx = groupBy.indexOf(colId);
    const isGrouped = grpIdx !== -1;
    const canGroup = (isSheetImportEmbedded || !isPosEmbedded) && GROUPABLE.has(colId);
    const thW = colWidths[colId];
    const colLabel =
      stackHrsMrc && colId === "horario"
        ? "Horário / Marcação"
        : getPosEmbeddedColLabel(posListKey, colId, def.label);
    return (
      <th
        key={colId}
        ref={(el) => {
          thRefs.current[colId] = el;
        }}
        className={`hdm-th${def.numeric ? " hdm-th-num" : ""}${dragOverId === colId ? " drag-over" : ""}`}
        style={thW ? { width: thW, minWidth: thW } : undefined}
        title={colLabel}
        onDragOver={(e) => {
          e.preventDefault();
          e.dataTransfer.dropEffect = "move";
          setDragOverId(colId);
        }}
        onDragLeave={(e) => {
          if (!e.currentTarget.contains(e.relatedTarget)) setDragOverId(null);
        }}
        onDrop={(e) => {
          e.preventDefault();
          const fromId = e.dataTransfer.getData("text/plain");
          if (!fromId || fromId === colId) {
            setDragOverId(null);
            return;
          }
          reorderColOrder(fromId, colId);
          setDragOverId(null);
        }}
      >
        <div className="hdm-th-inner">
          <span
            className={`hdm-col-handle${isGrouped ? " is-grouped" : ""}${!canGroup ? " no-group" : ""}`}
            draggable
            title={
              canGroup
                ? isGrouped
                  ? "Clique para remover do agrupamento · Arraste para reordenar"
                  : "Clique para agrupar · Arraste para reordenar"
                : "Arraste para reordenar"
            }
            onClick={() => {
              if (!canGroup || groupBusy) return;
              applyGroupBy((prev) =>
                prev.includes(colId) ? prev.filter((k) => k !== colId) : [...prev, colId],
              );
            }}
            onDragStart={(e) => {
              e.dataTransfer.effectAllowed = "move";
              e.dataTransfer.setData("text/plain", colId);
            }}
            onDragEnd={() => setDragOverId(null)}
          >
            {isGrouped ? grpIdx + 1 : "⠿"}
          </span>
          <button
            type="button"
            className={`hdm-sort${active ? " active" : ""}`}
            onClick={(e) => {
              e.stopPropagation();
              toggleSort(colId);
            }}
          >
            <span className="hdm-sort-label">{colLabel}</span>
            <span className="hdm-arrow">{active ? (sortDir === "asc" ? "▲" : "▼") : "⇅"}</span>
          </button>
          {def.filterable && (
            <button
              type="button"
              ref={(el) => {
                filterBtnRefs.current[colId] = el;
              }}
              className={`hdm-filt-btn${isFiltered(colId) ? " active" : ""}`}
              data-col-filter-btn={colId}
              onPointerDown={(e) => {
                e.preventDefault();
                e.stopPropagation();
                openFilter(colId, e.currentTarget);
              }}
              title="Filtrar"
            >
              ▼
            </button>
          )}
        </div>
        <div
          className="hdm-col-resizer"
          title="Arraste para redimensionar"
          onMouseDown={(e) => startColResize(colId, e)}
        />
      </th>
    );
  };

  /* ── export helpers ── */
  const getExportRows = () => {
    if (isApiMode) return apiData.events;
    return isEventsMode ? sortedEventIndices.map((i) => events0[i]) : sortedEmps;
  };

  const getExportHeaders = () => {
    const colLabels = colOrder
      .filter((id) => colVisible(id))
      .map((id) => {
        if (stackHrsMrc && id === "horario") return "Horário / Marcação";
        return COLS.find((c) => c.id === id)?.label || id;
      });
    return ["Colaborador", ...colLabels];
  };

  const getCellVal = (row, colId) => {
    if (isEventsMode) {
      switch (colId) {
        case "mat":
          return row.mat || "";
        case "genero":
          return row.genero || "";
        case "filial":
          return row.filial || "";
        case "depto":
          return row.depto || "";
        case "cargo":
          return row.cargo || "";
        case "_cat":
          return row._cat ? EVENT_CAT_LABELS[row._cat] || row._cat : "";
        case "data":
          return fmtDate(row.data);
        case "horario":
          if (stackHrsMrc) {
            const mrc = marcacaoDistinctFromHorario(row.horario, row.marcacao);
            return mrc ? `${row.horario || ""}\n${mrc}` : row.horario || "";
          }
          return row.horario || "";
        case "hrsPlan":
          return parseHorarioMin(row.horario) > 0 ? fmtMin(parseHorarioMin(row.horario)) : "";
        case "marcacao":
          return marcacaoDistinctFromHorario(row.horario, row.marcacao) || "";
        case "cod":
          return row.cod || "";
        case "evento":
          return row.evento || "";
        case "cid":
          return row.cid || "";
        case "cidDescricao":
          return row.cidDescricao || "";
        case "atividade":
          return row.atividade || "";
        case "situacaoDesc":
          return row.situacaoDesc || "";
        case "horas":
          return row.horas > 0 ? fmtMin(row.horas) : "";
        default:
          return "";
      }
    } else {
      switch (colId) {
        case "mat":
          return row.mat || "";
        case "genero":
          return row.genero || "";
        case "data":
          return fmtDate(row.data);
        case "depto":
          return row.depto || "";
        case "filial":
          return row.filial || "";
        case "plan":
          return fmtMin(row.hrsPlan);
        case "pres":
          return fmtMin(row.hrsPres);
        case "ause":
          return row.hrsAuse > 0 ? fmtMin(row.hrsAuse) : "";
        case "just":
          return row.hrsJust > 0 ? fmtMin(row.hrsJust) : "";
        case "extr":
          return row.hrsExtr > 0 ? fmtMin(row.hrsExtr) : "";
        case "abs":
          return absIdx(row) > 0 ? fmtPct(absIdx(row)) : "";
        default:
          return "";
      }
    }
  };

  const exportCSV = () => {
    const headers = getExportHeaders();
    const rows = getExportRows();
    const visibleOrder = colOrder.filter((id) => colVisible(id));
    const esc = (v) => {
      const s = String(v ?? "");
      return s.includes(",") || s.includes('"') || s.includes("\n")
        ? `"${s.replace(/"/g, '""')}"`
        : s;
    };
    const lines = [
      headers.map(esc).join(","),
      ...rows.map((row) =>
        [
          esc(row.nome || row.mat || ""),
          ...visibleOrder.map((id) => esc(getCellVal(row, id))),
        ].join(","),
      ),
    ];
    const blob = new Blob(["﻿" + lines.join("\n")], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${label || "dados"}_${date || ""}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    setExportOpen(false);
  };

  const buildAuditExportRows = () => {
    if (!isEventsMode) return [];
    const byColab = new Map();
    for (const idx of filteredEventIndices) {
      const ev = events0[idx];
      if (!ev) continue;
      const key = String(ev.mat || ev.nome || "__sem_colaborador__");
      if (!byColab.has(key)) byColab.set(key, []);
      byColab.get(key).push(ev);
    }
    const out = [];
    for (const rows of byColab.values()) {
      const ordered = [...rows].sort((a, b) => {
        const da = eventDateKey(a) || "";
        const db = eventDateKey(b) || "";
        if (da !== db) return da.localeCompare(db);
        return String(a.horario || "").localeCompare(String(b.horario || ""));
      });
      const britanicoMap = new Map();
      for (const ev of ordered) {
        const signature = splitTimeTokens(ev?.marcacao || "").join(" ");
        const dateKey = eventDateKey(ev);
        if (!signature || !dateKey) continue;
        if (!britanicoMap.has(signature)) britanicoMap.set(signature, new Set());
        britanicoMap.get(signature).add(dateKey);
      }
      ordered.forEach((ev, idx) => {
        const audit = getEventAudit(ev, ordered[idx - 1], britanicoMap);
        if (!audit.memoria || audit.severidade === "ok") return;
        const reviewKey = makeAuditReviewKey(ev, audit);
        const review = getAuditDisplayReview(audit, getAuditReview(reviewKey));
        const historyText = (Array.isArray(review.history) ? review.history : [])
          .map((h) => {
            const when = h?.at ? new Date(h.at).toLocaleString("pt-BR") : "";
            const from = AUDIT_REVIEW_LABELS[h?.fromStatus] || h?.fromStatus || "";
            const to = AUDIT_REVIEW_LABELS[h?.toStatus] || h?.toStatus || "";
            const note = h?.justificativa ? ` - ${h.justificativa}` : "";
            return `${when} ${from} -> ${to}${note}`.trim();
          })
          .filter(Boolean)
          .join(" | ");
        out.push({
          colaborador: ev.nome || "",
          matricula: ev.mat || "",
          departamento: ev.depto || ev.departamento || "",
          data: fmtDate(eventDateKey(ev)),
          evento: ev.evento || ev.situacaoDesc || "",
          horas: fmtMin(Number(ev.horas) || 0),
          horario: stripHorarioCode(ev.horario),
          marcacao: stripHorarioCode(ev.marcacao),
          severidade: audit.severidade,
          regra: audit.codigo || "",
          auditoria: audit.observacao || "",
          memoria: audit.detalhes?.join(" | ") || "",
          status: AUDIT_REVIEW_LABELS[review.status] || review.status || "Pendente",
          justificativa: review.justificativa || "",
          revisadoEm: review.updatedAt || "",
          historico: historyText,
        });
      });
    }
    return out;
  };

  const exportAuditCSV = () => {
    const rows = buildAuditExportRows();
    const headers = [
      "Colaborador",
      "Matricula",
      "Departamento",
      "Data",
      "Evento",
      "Horas",
      "Horario",
      "Marcacao",
      "Severidade",
      "Regra",
      "Auditoria",
      "Memoria de calculo",
      "Status",
      "Justificativa",
      "Revisado em",
      "Historico",
    ];
    const esc = (v) => {
      const s = String(v ?? "");
      return s.includes(",") || s.includes('"') || s.includes("\n")
        ? `"${s.replace(/"/g, '""')}"`
        : s;
    };
    const lines = [
      headers.map(esc).join(","),
      ...rows.map((row) =>
        [
          row.colaborador,
          row.matricula,
          row.departamento,
          row.data,
          row.evento,
          row.horas,
          row.horario,
          row.marcacao,
          row.severidade,
          row.regra,
          row.auditoria,
          row.memoria,
          row.status,
          row.justificativa,
          row.revisadoEm,
          row.historico,
        ].map(esc).join(","),
      ),
    ];
    const blob = new Blob(["\uFEFF" + lines.join("\n")], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `auditoria_ponto_${date || ""}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    setExportOpen(false);
  };

  const exportAuditXLSX = async () => {
    try {
      const mod = await import("xlsx-js-style");
      const XLSX = mod.default || mod;
      const rows = buildAuditExportRows();
      const headers = [
        "Colaborador",
        "Matricula",
        "Departamento",
        "Data",
        "Evento",
        "Horas",
        "Horario",
        "Marcacao",
        "Severidade",
        "Regra",
        "Auditoria",
        "Memoria de calculo",
        "Status",
        "Justificativa",
        "Revisado em",
        "Historico",
      ];
      const aoa = [
        headers,
        ...rows.map((row) => [
          row.colaborador,
          row.matricula,
          row.departamento,
          row.data,
          row.evento,
          row.horas,
          row.horario,
          row.marcacao,
          row.severidade,
          row.regra,
          row.auditoria,
          row.memoria,
          row.status,
          row.justificativa,
          row.revisadoEm,
          row.historico,
        ]),
      ];
      const ws = XLSX.utils.aoa_to_sheet(aoa);
      ws["!cols"] = [
        { wch: 30 },
        { wch: 12 },
        { wch: 26 },
        { wch: 12 },
        { wch: 34 },
        { wch: 10 },
        { wch: 28 },
        { wch: 28 },
        { wch: 12 },
        { wch: 20 },
        { wch: 42 },
        { wch: 60 },
        { wch: 14 },
        { wch: 38 },
        { wch: 22 },
        { wch: 60 },
      ];
      ws["!rows"] = [{ hpt: 22 }, ...rows.map(() => ({ hpt: 34 }))];

      const range = XLSX.utils.decode_range(ws["!ref"] || "A1:A1");
      const headerStyle = {
        fill: { fgColor: { rgb: "1E293B" } },
        font: { color: { rgb: "FFFFFF" }, bold: true },
        alignment: { horizontal: "center", vertical: "center", wrapText: true },
        border: {
          top: { style: "thin", color: { rgb: "CBD5E1" } },
          bottom: { style: "thin", color: { rgb: "CBD5E1" } },
        },
      };
      for (let c = range.s.c; c <= range.e.c; c += 1) {
        const ref = XLSX.utils.encode_cell({ r: 0, c });
        if (ws[ref]) ws[ref].s = headerStyle;
      }
      const severityFill = {
        critica: "FEE2E2",
        alta: "FFEDD5",
        media: "FEF3C7",
        baixa: "E2E8F0",
      };
      rows.forEach((row, idx) => {
        const r = idx + 1;
        const sev = String(row.severidade || "").toLowerCase();
        const fill = severityFill[sev] || (idx % 2 ? "FFFFFF" : "F8FAFC");
        for (let c = range.s.c; c <= range.e.c; c += 1) {
          const ref = XLSX.utils.encode_cell({ r, c });
          if (!ws[ref]) continue;
          ws[ref].s = {
            fill: { fgColor: { rgb: fill } },
            font: { color: { rgb: sev === "critica" ? "991B1B" : "0F172A" }, bold: c === 8 || c === 12 },
            alignment: { vertical: "top", wrapText: true },
            border: {
              bottom: { style: "thin", color: { rgb: "E2E8F0" } },
            },
          };
        }
      });

      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, "Auditoria");
      XLSX.writeFile(wb, `auditoria_ponto_${date || ""}.xlsx`);
    } catch (err) {
      console.error("Erro ao exportar auditoria XLSX:", err);
    }
    setExportOpen(false);
  };

  const exportXLSX = async () => {
    try {
      const mod = await import("xlsx-js-style");
      const XLSX = mod.default || mod;
      const headers = getExportHeaders();
      const rows = getExportRows();
      const visibleOrder = colOrder.filter((id) => colVisible(id));

      // Build AOA
      const aoa = [
        headers,
        ...rows.map((row) => [
          row.nome || row.mat || "",
          ...visibleOrder.map((id) => getCellVal(row, id)),
        ]),
      ];

      const ws = XLSX.utils.aoa_to_sheet(aoa);

      // ── Column widths ──────────────────────────────────────────
      const wideIds = new Set([
        "evento",
        "depto",
        "cargo",
        "nome",
        "cidDescricao",
        "atividade",
        "situacaoDesc",
      ]);
      const medIds = new Set(["filial", "horario", "marcacao", "data", "cod", "cid"]);
      const numIds = new Set(["plan", "pres", "ause", "just", "extr", "abs", "horas", "hrsPlan"]);
      ws["!cols"] = [
        { wch: 28 }, // Colaborador
        ...visibleOrder.map((id) => {
          if (wideIds.has(id)) return { wch: 32 };
          if (medIds.has(id)) return { wch: 24 };
          if (numIds.has(id)) return { wch: 11 };
          if (id === "_cat") return { wch: 14 };
          return { wch: 14 };
        }),
      ];

      // ── Row heights ────────────────────────────────────────────
      const stacked = stackHrsMrc && isEventsMode;
      ws["!rows"] = [{ hpt: 20 }, ...rows.map(() => ({ hpt: stacked ? 28 : 16 }))];

      // ── Styles ────────────────────────────────────────────────
      const HEADER_FILL = { fgColor: { rgb: "6366F1" } };
      const HEADER_FONT = { bold: true, color: { rgb: "FFFFFF" }, sz: 10, name: "Calibri" };
      const HEADER_ALIGN = { horizontal: "center", vertical: "center", wrapText: true };
      const EVEN_FILL = { fgColor: { rgb: "FFFFFF" } };
      const ODD_FILL = { fgColor: { rgb: "F0F0F5" } };
      const CAT_COLORS = {
        presentes: { bg: "DCFCE7", fg: "15803D" },
        ausentes: { bg: "FEE2E2", fg: "B91C1C" },
        justificadas: { bg: "FEF9C3", fg: "92400E" },
        extras: { bg: "FFEDD5", fg: "C2410C" },
        ignorar: { bg: "F1F5F9", fg: "64748B" },
        risco: { bg: "FFEDD5", fg: "C2410C" },
        noturnas: { bg: "EDE9FE", fg: "6D28D9" },
      };

      const numColIdxs = new Set(
        visibleOrder.map((id, ci) => (numIds.has(id) ? ci + 1 : -1)).filter((x) => x >= 0),
      );

      // Header row
      headers.forEach((_, ci) => {
        const ref = XLSX.utils.encode_cell({ r: 0, c: ci });
        if (!ws[ref]) return;
        ws[ref].s = { fill: HEADER_FILL, font: HEADER_FONT, alignment: HEADER_ALIGN };
      });

      // Data rows
      rows.forEach((row, ri) => {
        const r = ri + 1;
        const fill = ri % 2 === 0 ? EVEN_FILL : ODD_FILL;

        // Colaborador column
        const nomeRef = XLSX.utils.encode_cell({ r, c: 0 });
        if (ws[nomeRef])
          ws[nomeRef].s = {
            fill,
            font: { sz: 9.5, name: "Calibri", bold: true },
            alignment: { vertical: "top", wrapText: false },
          };

        visibleOrder.forEach((colId, ci) => {
          const c = ci + 1;
          const ref = XLSX.utils.encode_cell({ r, c });
          if (!ws[ref]) return;
          const isNum = numColIdxs.has(c);
          const isWrap = stacked && colId === "horario";
          const isCat = colId === "_cat";
          const catKey = isCat ? row._cat || "" : "";
          const catClr = CAT_COLORS[catKey];
          ws[ref].s = {
            fill: catClr ? { fgColor: { rgb: catClr.bg } } : fill,
            font: {
              sz: 9.5,
              name: "Calibri",
              bold: isCat,
              color: catClr ? { rgb: catClr.fg } : undefined,
            },
            alignment: { horizontal: isNum ? "right" : "left", vertical: "top", wrapText: isWrap },
          };
        });
      });

      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, "Dados");
      XLSX.writeFile(wb, `${label || "dados"}_${date || ""}.xlsx`);
    } catch (err) {
      console.error("Erro ao exportar XLSX:", err);
    }
    setExportOpen(false);
  };

  const exportPDF = async () => {
    try {
      const { jsPDF } = await import("jspdf");
      const { default: autoTable } = await import("jspdf-autotable");
      const headers = getExportHeaders();
      const rows = getExportRows();
      const visibleOrder = colOrder.filter((id) => colVisible(id));
      const body = rows.map((row) => [
        row.nome || row.mat || "",
        ...visibleOrder.map((id) => getCellVal(row, id)),
      ]);
      const doc = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" });
      doc.setFontSize(13);
      doc.text(label || "Relatório", 14, 16);
      if (date) {
        doc.setFontSize(9);
        doc.setTextColor(120, 120, 140);
        doc.text(fmtDate(date), 14, 23);
        doc.setTextColor(0, 0, 0);
      }
      autoTable(doc, {
        head: [headers],
        body,
        startY: date ? 28 : 22,
        styles: { fontSize: 7.5, cellPadding: 2, overflow: "linebreak" },
        headStyles: { fillColor: [99, 102, 241], textColor: 255, fontStyle: "bold" },
        alternateRowStyles: { fillColor: [245, 245, 250] },
        margin: { left: 14, right: 14 },
      });
      doc.save(`${label || "dados"}_${date || ""}.pdf`);
    } catch (err) {
      console.error("Erro ao exportar PDF:", err);
    }
    setExportOpen(false);
  };

  const modalStyle = embedded
    ? { position: "relative", width: "100%", height: "100%", maxWidth: "none", maxHeight: "none" }
    : isMaximized
      ? { position: "fixed", top: 10, left: 10, right: 10, bottom: 10, width: "auto", height: "auto" }
      : {
          position: "fixed",
          top: "50%",
          left: "50%",
          transform: `translate(calc(-50% + ${pos.x}px), calc(-50% + ${pos.y}px))`,
          width: size.w,
          height: size.h,
        };

  const applyAuditSummaryFilter = useCallback((severity) => {
    setAuditSummaryProcessing(severity);
    window.requestAnimationFrame(() => {
      startTransition(() => {
        setAuditSeverityFilter(severity);
      });
    });
  }, []);

  useEffect(() => {
    if (!auditSummaryProcessing) return undefined;
    const t = window.setTimeout(() => setAuditSummaryProcessing(""), 240);
    return () => window.clearTimeout(t);
  }, [auditSummaryProcessing, auditSeverityFilter, filteredCount, collaboratorAuditSummary]);

  const auditSummaryBar = showCollabAuditDetails && collaboratorAuditSummary ? (
    <div className="hdm-audit-summary-bar" aria-label="Resumo de severidade da auditoria">
      <button
        type="button"
        className={`hdm-audit-summary-item hdm-audit-summary-item--total${auditSeverityFilter === "todos" ? " active" : ""}${auditSummaryProcessing === "todos" ? " is-processing" : ""}`}
        onClick={() => applyAuditSummaryFilter("todos")}
      >
        <span>Total</span>
        <strong>{auditSummaryProcessing === "todos" ? "Processando..." : collaboratorAuditSummary.total.toLocaleString("pt-BR")}</strong>
      </button>
      <button
        type="button"
        className={`hdm-audit-summary-item hdm-audit-summary-item--critica${auditSeverityFilter === "critica" ? " active" : ""}${auditSummaryProcessing === "critica" ? " is-processing" : ""}`}
        onClick={() => applyAuditSummaryFilter("critica")}
      >
        <span>Criticas</span>
        <strong>{auditSummaryProcessing === "critica" ? "Processando..." : collaboratorAuditSummary.critica.toLocaleString("pt-BR")}</strong>
      </button>
      <button
        type="button"
        className={`hdm-audit-summary-item hdm-audit-summary-item--alta${auditSeverityFilter === "alta" ? " active" : ""}${auditSummaryProcessing === "alta" ? " is-processing" : ""}`}
        onClick={() => applyAuditSummaryFilter("alta")}
      >
        <span>Altas</span>
        <strong>{auditSummaryProcessing === "alta" ? "Processando..." : collaboratorAuditSummary.alta.toLocaleString("pt-BR")}</strong>
      </button>
      <button
        type="button"
        className={`hdm-audit-summary-item hdm-audit-summary-item--media${auditSeverityFilter === "media" ? " active" : ""}${auditSummaryProcessing === "media" ? " is-processing" : ""}`}
        onClick={() => applyAuditSummaryFilter("media")}
      >
        <span>Medias</span>
        <strong>{auditSummaryProcessing === "media" ? "Processando..." : collaboratorAuditSummary.media.toLocaleString("pt-BR")}</strong>
      </button>
      <button
        type="button"
        className={`hdm-audit-summary-item hdm-audit-summary-item--baixa${auditSeverityFilter === "baixa" ? " active" : ""}${auditSummaryProcessing === "baixa" ? " is-processing" : ""}`}
        onClick={() => applyAuditSummaryFilter("baixa")}
      >
        <span>Baixas</span>
        <strong>{auditSummaryProcessing === "baixa" ? "Processando..." : collaboratorAuditSummary.baixa.toLocaleString("pt-BR")}</strong>
      </button>
      <button
        type="button"
        className={`hdm-audit-summary-item hdm-audit-summary-item--ok${auditSeverityFilter === "ok" ? " active" : ""}${auditSummaryProcessing === "ok" ? " is-processing" : ""}`}
        onClick={() => applyAuditSummaryFilter("ok")}
      >
        <span>OK</span>
        <strong>{auditSummaryProcessing === "ok" ? "Processando..." : collaboratorAuditSummary.ok.toLocaleString("pt-BR")}</strong>
      </button>
    </div>
  ) : null;

  const auditExplanation = auditMemoria
    ? buildAuditExplanation(auditMemoria, auditQuestion)
    : null;
  const auditMemoryPrevParts = auditMemoria ? auditMemoria.horarioPlanejado || [] : [];
  const auditMemoryRealParts = auditMemoria ? auditMemoria.marcacoes || [] : [];
  const auditMemoryMarkSlots = auditMemoria
    ? buildMarkDisplaySlots(auditMemoryPrevParts, auditMemoryRealParts)
    : [];
  const auditMemoryHasRealMarks = auditMemoryRealParts.length > 0;
  const auditMemoryUsedParamKeys = auditMemoria ? auditUsedParamKeys(auditMemoria) : [];

  const shell = (
    <>
      <div
        className={`${embedded ? "hdm-embedded" : "hdm-overlay"}${auditWorkspaceMode ? " hdm-audit-workspace-mode" : ""}${auditGridFocus ? " hdm-audit-grid-focus" : ""}`}
        data-theme={theme}
        data-pos-list={embedded ? String(posListKey || "") : undefined}
        translate="no"
        onClick={(e) => e.stopPropagation()}
        onMouseDown={(e) => e.stopPropagation()}
      >
        <div
          className={`hdm-modal${auditWorkspaceMode ? " hdm-modal--audit-workspace" : ""}`}
          style={modalStyle}
          role="dialog"
          aria-modal={!embedded}
        >
          {!embedded ? (
            <div className={`hdm-header${auditWorkspaceMode ? " hdm-header--audit" : ""}`} onMouseDown={onDragStart}>
              <span className="hdm-icon">{isEventsMode ? "📋" : "📅"}</span>
              <div className="hdm-title-block">
                <span className="hdm-title">{auditWorkspaceMode ? "Auditoria de ponto" : "Colaboradores"}</span>
                <span className="hdm-sub">
                  {auditWorkspaceMode
                    ? `${label} - central de tratamento de pendencias - ${filteredCount.toLocaleString("pt-BR")} de ${events0.length.toLocaleString("pt-BR")} eventos`
                    : isEventsMode
                    ? isApiMode
                      ? `${label} · ${filteredCount.toLocaleString("pt-BR")} evento${filteredCount !== 1 ? "s" : ""} no período (API)`
                      : filteredCount !== events0.length
                        ? `${label} · ${filteredCount.toLocaleString("pt-BR")} de ${events0.length.toLocaleString("pt-BR")} eventos (filtro de data)`
                        : `${label} · ${events0.length.toLocaleString("pt-BR")} evento${events0.length !== 1 ? "s" : ""} no período`
                    : `${label} · ${emps0.length} colaborador${emps0.length !== 1 ? "es" : ""}`}
                </span>
              </div>
              <div style={{ flex: 1 }} />
              <button
                type="button"
                className="hdm-close"
                title={isMaximized ? "Restaurar" : "Expandir"}
                onClick={() => setIsMaximized((v) => !v)}
              >
                {isMaximized ? "⊡" : "⊞"}
              </button>
              <button type="button" className="hdm-close" onClick={onClose}>
                ×
              </button>
            </div>
          ) : null}

          {/* Pills — eventos mode: filtro rápido por categoria (oculto no modal posição do dia) */}
          {auditWorkspaceMode ? auditSummaryBar : null}

          {isEventsMode && !isPosEmbedded && (
            <div className={`hdm-pills-row${auditWorkspaceMode ? " hdm-pills-row--audit" : ""}`}>
              <button
                type="button"
                className={`hdm-pill hdm-pill-all${pillFilter ? "" : " active"}${pillBusy === "todos" ? " is-processing" : ""}`}
                onClick={() => applyPillFilter(null)}
                title="Mostrar todos os eventos do periodo"
              >
                {pillBusy === "todos" ? "Processando..." : `Todos (${allEventFilterCount.toLocaleString("pt-BR")})`}
              </button>
              {EVENT_PILLS.map(([cat, cls, lbl]) =>
                catCounts[cat] ? (
                  <button
                    key={cat}
                    type="button"
                    className={`hdm-pill ${cls}${pillFilter === cat ? " active" : ""}${pillBusy === cat ? " is-processing" : ""}`}
                    onClick={() => applyPillFilter(cat)}
                    title={PILL_TOOLTIPS[cat] || lbl}
                  >
                    {pillBusy === cat ? "Processando..." : `${lbl} (${catCounts[cat]})`}
                  </button>
                ) : null,
              )}
            </div>
          )}

          {/* Pills — employees mode only */}
          {!isEventsMode && (
            <div className="hdm-pills-row">
              {presCount > 0 && (
                <span className="hdm-pill hdm-pill-pres">✓ {presCount} presentes</span>
              )}
              {auseCount > 0 && (
                <span className="hdm-pill hdm-pill-ause">✗ {auseCount} ausentes</span>
              )}
              {justCount > 0 && (
                <span className="hdm-pill hdm-pill-just">⚠ {justCount} justificados</span>
              )}
              {extrCount > 0 && (
                <span className="hdm-pill hdm-pill-extr">+ {extrCount} com extras</span>
              )}
              {hasHours && (
                <span className="hdm-pill hdm-pill-hrs">
                  ⏱ Plan: {fmtMin(empTotalsAll.hrsPlan)} · Trab: {fmtMin(empTotalsAll.hrsPres)}
                </span>
              )}
            </div>
          )}

          {/* Toolbar — date inputs (events) + search on same row */}
          <div
            className={`hdm-toolbar${auditWorkspaceMode ? " hdm-toolbar--audit" : ""}${collaboratorDetailMode && !auditWorkspaceMode ? " hdm-toolbar--collab-detail" : ""}`}
          >
            {showDateRange && (
              <>
                <span className="hdm-dr-label">De</span>
                <input
                  ref={dateFromRef}
                  type="date"
                  className="hdm-dr-inp"
                  value={dateFrom}
                  max={dateTo || undefined}
                  onChange={(e) => {
                    const v = e.target.value;
                    setDateFrom(v);
                    if (v && dateTo) {
                      const diff =
                        (new Date(`${dateTo}T00:00:00`) - new Date(`${v}T00:00:00`)) / 86400000;
                      if (diff > HDM_MAX_RANGE_DAYS) setDateTo(addDaysIso(v, HDM_MAX_RANGE_DAYS));
                    }
                  }}
                />
                <span className="hdm-dr-label">Até</span>
                <input
                  ref={dateToRef}
                  type="date"
                  className="hdm-dr-inp"
                  value={dateTo}
                  min={dateFrom || undefined}
                  onChange={(e) => {
                    const v = e.target.value;
                    setDateTo(v);
                    if (v && dateFrom) {
                      const diff =
                        (new Date(`${v}T00:00:00`) - new Date(`${dateFrom}T00:00:00`)) / 86400000;
                      if (diff > HDM_MAX_RANGE_DAYS)
                        setDateFrom(addDaysIso(v, -HDM_MAX_RANGE_DAYS));
                    }
                  }}
                />
                <button
                  type="button"
                  className="hdm-dr-reset"
                  disabled={dateFilterBusy}
                  onMouseDown={(e) => {
                    e.preventDefault();
                    if (!dateFilterBusy) applyDateRange();
                  }}
                  onClick={() => {
                    if (!dateFilterBusy) applyDateRange();
                  }}
                >
                  {dateFilterBusy ? "Aguarde…" : "OK"}
                </button>
              </>
            )}
            <HdmSearchInput
              className="hdm-search"
              placeholder={
                isEventsMode
                  ? "Buscar nome, cód, evento, CID, situação, filial…"
                  : "Buscar nome, matrícula, depto, filial…"
              }
              value={search}
              onCommit={commitSearch}
              delay={isEventsMode ? 300 : 180}
              autoFocus
            />

            {deptFilterLabel && typeof onClearDeptFilter === "function" ? (
              <button
                type="button"
                className="hdm-dept-filter-clear"
                onClick={onClearDeptFilter}
                title={`Remover filtro de departamento: ${deptFilterLabel}`}
              >
                <span className="hdm-dept-filter-clear__label">{deptFilterLabel}</span>
                <span className="hdm-dept-filter-clear__action">Limpar filtro</span>
              </button>
            ) : null}

            {typeof onOpenAbsTrend === "function" && (
              <button
                type="button"
                className="hdm-tool-btn hdm-trend-btn"
                onClick={onOpenAbsTrend}
                title="Abrir evolução do absenteísmo para este filtro"
              >
                📈 Ver evolução
              </button>
            )}

            {showCollabAuditDetails && !auditWorkspaceMode && (
              <button
                type="button"
                className="hdm-tool-btn"
                onClick={() => setAuditParamsOpen(true)}
                title="Editar parametros usados na auditoria de ponto"
              >
                  Parâmetros auditoria
              </button>
            )}

            {showCollabAuditDetails && (
              <select
                className={`hdm-audit-status-filter${auditReviewStatusFilter !== "todos" ? " active" : ""}`}
                value={auditReviewStatusFilter}
                onChange={(e) => setAuditReviewStatusFilter(e.target.value)}
                title="Filtrar por status do tratamento da auditoria"
              >
                <option value="todos">Status: todos</option>
                {AUDIT_REVIEW_STATUS.map((status) => (
                  <option key={status.id} value={status.id}>
                    {status.label}
                  </option>
                ))}
              </select>
            )}

            {showCollabAuditDetails && (
              <button
                type="button"
                className={`hdm-tool-btn hdm-audit-actionable-toggle${auditCriticalPendingOnly ? " active" : ""}`}
                onClick={() => setAuditCriticalPendingOnly((value) => !value)}
                title="Mostrar somente críticas e altas ainda pendentes de decisão"
              >
                Pendentes de decisão
              </button>
            )}

            {showCollabAuditDetails && auditReviewSummary.total > 0 && (
              <div className="hdm-audit-review-summary" title="Resumo operacional da auditoria no filtro atual">
                <span>Crit. pend. {auditReviewSummary.criticaPendente || 0}</span>
                <span>Altas pend. {auditReviewSummary.altaPendente || 0}</span>
                <span>Ajuste {auditReviewSummary.ajuste || 0}</span>
                <span>Tratado {auditReviewSummary.tratadoPct || 0}%</span>
              </div>
            )}

            <div className={`hdm-col-wrap${auditWorkspaceMode ? " hdm-audit-secondary-control" : ""}`} ref={colSelRef}>
              <button
                type="button"
                className={`hdm-tool-btn${colSelOpen ? " active" : ""}`}
                onClick={() => setColSelOpen((v) => !v)}
              >
                Colunas ▾
              </button>
              {colSelOpen && (
                <div className="hdm-col-pop">
                  <div className="hdm-col-pop-head">
                    <span className="hdm-col-pop-title">Colunas</span>
                    <button
                      type="button"
                      className="hdm-col-pop-close"
                      onClick={() => setColSelOpen(false)}
                    >
                      ×
                    </button>
                  </div>
                  <p className="hdm-col-pop-hint">Arraste ⋮⋮ para reordenar</p>
                  <div className="hdm-col-pop-list">
                    {colPopItems.map((c) => (
                      <div
                        key={c.id}
                        className={`hdm-col-item${colPopDragOverId === c.id ? " drag-over" : ""}${colPopDragId === c.id ? " dragging" : ""}`}
                        onDragOver={(e) => {
                          e.preventDefault();
                          e.dataTransfer.dropEffect = "move";
                          setColPopDragOverId(c.id);
                        }}
                        onDragLeave={(e) => {
                          if (!e.currentTarget.contains(e.relatedTarget)) {
                            setColPopDragOverId((cur) => (cur === c.id ? null : cur));
                          }
                        }}
                        onDrop={(e) => {
                          e.preventDefault();
                          const fromId = e.dataTransfer.getData("text/plain") || colPopDragId;
                          reorderColOrder(fromId, c.id);
                          setColPopDragId(null);
                          setColPopDragOverId(null);
                        }}
                      >
                        <span
                          className="hdm-col-pop-handle"
                          draggable
                          title="Arraste para reordenar"
                          aria-label={`Reordenar coluna ${c.label}`}
                          onDragStart={(e) => {
                            setColPopDragId(c.id);
                            e.dataTransfer.effectAllowed = "move";
                            e.dataTransfer.setData("text/plain", c.id);
                          }}
                          onDragEnd={() => {
                            setColPopDragId(null);
                            setColPopDragOverId(null);
                          }}
                        >
                          ⋮⋮
                        </span>
                        <label className="hdm-col-item-label">
                          <input
                            type="checkbox"
                            checked={visibleCols.has(c.id)}
                            onChange={() =>
                              setVisibleCols((prev) => {
                                const n = new Set(prev);
                                n.has(c.id) ? n.delete(c.id) : n.add(c.id);
                                return n;
                              })
                            }
                          />
                          <span>{getPosEmbeddedColLabel(posListKey, c.id, c.label)}</span>
                        </label>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            <div className="hdm-toolbar-secondary">
            {isEventsMode && !auditWorkspaceMode && (
              <button
                type="button"
                className={`hdm-tool-btn${stackHrsMrc ? " active" : ""}`}
                onClick={() => setStackHrsMrc((v) => !v)}
                title="Empilhar Horário e Marcação numa coluna só"
              >
                ⇕ Empilhar
              </button>
            )}

            {isEventsMode && !isPosEmbedded && (
              <button
                type="button"
                className={`hdm-tool-btn${groupBy.includes("mat") ? " active" : ""}`}
                onClick={() =>
                  applyGroupBy((prev) =>
                    prev.includes("mat") ? prev.filter((k) => k !== "mat") : ["mat", ...prev],
                  )
                }
                title="Agrupar eventos por colaborador"
              >
                👤 Agrupar
              </button>
            )}

            {auditWorkspaceMode && (
              <details className="hdm-audit-adjustments">
                <summary>Ajustes</summary>
                <div className="hdm-audit-adjustments-pop">
                  <button
                    type="button"
                    className="hdm-tool-btn"
                    onClick={() => setAuditParamsOpen(true)}
                    title="Editar parâmetros usados na auditoria de ponto"
                  >
                    Parâmetros auditoria
                  </button>
                </div>
              </details>
            )}

            {auditWorkspaceMode && (
              <button
                type="button"
                className={`hdm-tool-btn hdm-audit-focus-btn${auditGridFocus ? " active" : ""}`}
                onClick={() => setAuditGridFocus((value) => !value)}
                title="Alternar modo foco: amplia a area dos colaboradores"
              >
                Foco
              </button>
            )}

            {isEventsMode && !isPosEmbedded && rankings && (
              <button
                type="button"
                className={`hdm-tool-btn${rankOpen ? " active" : ""}`}
                onClick={() => setRankOpen((v) => !v)}
                title="Ranking de ocorrências"
              >
                🏆 Ranking
              </button>
            )}

            {hasAnyFilter && (
              <button
                type="button"
                className="hdm-tool-btn hdm-clear-f"
                onClick={() => setColFilters({})}
              >
                ✕ Filtros
              </button>
            )}

            <div className="hdm-export-wrap" ref={exportRef}>
              <button
                type="button"
                className={`hdm-tool-btn${exportOpen ? " active" : ""}`}
                onClick={() => setExportOpen((v) => !v)}
              >
                Exportar ▾
              </button>
              {exportOpen && (
                <div className="hdm-export-pop">
                  <button type="button" className="hdm-export-item" onClick={exportCSV}>
                    📄 CSV
                  </button>
                  {showCollabAuditDetails && (
                    <button type="button" className="hdm-export-item" onClick={exportAuditCSV}>
                      Auditoria CSV
                    </button>
                  )}
                  {showCollabAuditDetails && (
                    <button type="button" className="hdm-export-item" onClick={exportAuditXLSX}>
                      Auditoria Excel
                    </button>
                  )}
                  <button type="button" className="hdm-export-item" onClick={exportXLSX}>
                    📊 Excel (.xlsx)
                  </button>
                  <button type="button" className="hdm-export-item" onClick={exportPDF}>
                    🖨️ PDF
                  </button>
                </div>
              )}
            </div>

            </div>

            {!isSheetImportEmbedded && hasAnyFilter ? (
              <span className="hdm-count hdm-count--audit">
                {hasAnyFilter ? (
                  <span className="hdm-filter-inline-note">
                    Filtros ativos · {Math.max(0, totalRows - filteredCount).toLocaleString("pt-BR")} ocultos
                  </span>
                ) : null}
              </span>
            ) : null}
          </div>

          {/* Group indicator — cascade chips + expand/collapse all */}
          {(!isPosEmbedded || isSheetImportEmbedded) && groupBy.length > 0 && (
            <div className="hdm-group-bar">
              <span className="hdm-group-label">Agrupado</span>
              {groupBy.map((colId, idx) => (
                <React.Fragment key={colId}>
                  {idx > 0 && <span className="hdm-group-sep">›</span>}
                  <span className="hdm-group-chip">
                    <span className="hdm-group-chip-idx">{idx + 1}</span>
                    {isSheetImportEmbedded
                      ? getPosEmbeddedColLabel(
                          posListKey,
                          colId,
                          COLS.find((c) => c.id === colId)?.label || colId,
                        )
                      : auditWorkspaceMode && colId === "mat"
                        ? "Matricula e nome"
                        : isEventsMode && colId === "mat"
                          ? "Colaborador"
                          : COLS.find((c) => c.id === colId)?.label || colId}
                    <button
                      type="button"
                      className="hdm-group-chip-x"
                      disabled={groupBusy}
                      onClick={() =>
                        applyGroupBy((prev) => prev.filter((k) => k !== colId))
                      }
                    >
                      ×
                    </button>
                  </span>
                </React.Fragment>
              ))}
              {groupBy.length > 1 && (
                <button
                  type="button"
                  className="hdm-tool-btn hdm-clear-f"
                  style={{ marginLeft: 4, padding: "2px 8px", fontSize: 11 }}
                  disabled={groupBusy}
                  onClick={() => applyGroupBy(() => [])}
                >
                  ✕ Limpar
                </button>
              )}
              <div style={{ flex: 1 }} />
              <button
                type="button"
                className="hdm-grp-toggle-btn"
                title="Expandir todos os grupos"
                onClick={() => setCollapsed(new Set())}
              >
                ▼ Expandir
              </button>
              <button
                type="button"
                className="hdm-grp-toggle-btn"
                title="Recolher todos os grupos"
                onClick={() => setCollapsed(new Set(allGroupKeys(groupTree || [])))}
              >
                ▶ Recolher
              </button>
            </div>
          )}

          {/* Ranking panel */}
          {isEventsMode && rankOpen && rankings && (
            <div className="hdm-ranking">
              <RankCol
                title="Atrasos"
                icon="⚠"
                accent="atraso"
                items={rankings.topAtrasos}
                valFn={(r) => `${r.count}×`}
                maxVal={rankings.topAtrasos[0]?.count || 1}
                barVal={(r) => r.count}
                empty="Nenhum atraso no período"
              />
              <RankCol
                title="Faltas"
                icon="✕"
                accent="falta"
                items={rankings.topFaltas}
                valFn={(r) => `${r.count}×`}
                maxVal={rankings.topFaltas[0]?.count || 1}
                barVal={(r) => r.count}
                empty="Nenhuma falta no período"
              />
              <RankCol
                title="Horas extras"
                icon="+"
                accent="extra"
                items={rankings.topExtras}
                valFn={(r) => fmtMin(r.horas)}
                maxVal={rankings.topExtras[0]?.horas || 1}
                barVal={(r) => r.horas}
                empty="Nenhuma hora extra no período"
              />
            </div>
          )}

          {/* Table */}
          <div
            ref={tableWrapRef}
            className={`hdm-table-wrap${auditWorkspaceMode ? " hdm-table-wrap--audit-workspace" : ""}`}
            style={{ position: "relative" }}
            onScroll={shouldTrackTableScroll ? handleTableScroll : undefined}
          >
            {tableBusy && (
              <div
                className="hdm-table-busy"
                style={{
                  position: "absolute",
                  inset: 0,
                  zIndex: 10,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  flexDirection: "column",
                  gap: 10,
                  background: "rgba(0,0,0,.4)",
                  borderRadius: 8,
                  pointerEvents: "none",
                }}
              >
                <span
                  className="hdm-table-busy-spin"
                  aria-hidden
                  style={{
                    width: 22,
                    height: 22,
                    borderRadius: "50%",
                    border: "2.5px solid rgba(255,255,255,.25)",
                    borderTopColor: "#60a5fa",
                    display: "inline-block",
                    animation: "hdm-spin 0.8s linear infinite",
                  }}
                />
                <span
                  style={{
                    background: "var(--hdm-modal-bg,#0f172a)",
                    color: "var(--hdm-text,#e2e8f0)",
                    padding: "10px 20px",
                    borderRadius: 8,
                    fontSize: 13,
                    fontWeight: 600,
                    border: "1px solid var(--hdm-border,rgba(255,255,255,.12))",
                  }}
                >
                  {tableBusyLabel}
                </span>
              </div>
            )}
            <table
              className={`hdm-table${collaboratorDetailMode ? " hdm-collab-detail-table" : ""}${auditWorkspaceMode ? " hdm-audit-workspace-table" : ""}`}
              style={collaboratorDetailMode ? {
                minWidth: Math.max(auditWorkspaceMode ? 1500 : 980, showCollabAuditDetails ? collabTableMinWidth : 980),
                "--hdm-col-data": `${collabColWidths.data}px`,
                "--hdm-col-evento": `${collabColWidths.evento}px`,
                "--hdm-col-horas": `${collabColWidths.horas}px`,
                "--hdm-col-horario": `${collabColWidths.horario}px`,
                "--hdm-collab-sticky-title-top": `${collabSubheadHeight}px`,
                ...(showCollabAuditDetails ? { "--hdm-col-auditoria": `${collabColWidths.auditoria}px` } : {}),
              } : { width: modalTableWidth, minWidth: "100%" }}
            >
              {collaboratorDetailMode ? (
                <colgroup>
                  <col style={{ width: collabColWidths.data }} />
                  <col style={{ width: collabColWidths.evento }} />
                  {collabExtraCols.map((col) => <col key={col.id} style={{ width: 180 }} />)}
                  <col style={{ width: collabColWidths.horas }} />
                  <col style={{ width: collabColWidths.horario }} />
                  {showCollabAuditDetails ? <col style={{ width: collabColWidths.auditoria }} /> : null}
                </colgroup>
              ) : (
                <colgroup>
                  {renderedColIds.map((colId) => (
                    <col key={colId} style={{ width: modalColumnWidth(colId) }} />
                  ))}
                </colgroup>
              )}
              <thead>
                {collaboratorDetailMode ? (
                  renderCollaboratorDetailHeader()
                ) : (
                  <tr>{renderedColIds.map((colId) => renderColHeader(colId))}</tr>
                )}
              </thead>
              <tbody>
                {isApiMode && apiData.useGroupList && !apiData.isLoading ? (
                  apiData.grupos.length === 0 ? (
                    <tr>
                      <td colSpan={99} className="hdm-empty">
                        Nenhum grupo encontrado.
                      </td>
                    </tr>
                  ) : (
                    apiData.grupos.map((g) => (
                      <tr key={g.key} className="hdm-grp-row hdm-grp-d0">
                        {renderGroupHeaderCells(
                          g.label,
                          { horasPlan: g.horasPlan || 0, horas: g.horas || 0 },
                          `${g.count.toLocaleString("pt-BR")} eventos · ${g.colaboradores.toLocaleString("pt-BR")} colaboradores`,
                          0,
                          false,
                          () => {
                            setApiExpandedGroupKey(g.key);
                            apiData.setPage(1);
                          },
                        )}
                      </tr>
                    ))
                  )
                ) : isApiMode && apiExpandedGroupKey ? (
                  <>
                    <tr className="hdm-grp-row">
                      <td colSpan={99}>
                        <button
                          type="button"
                          className="hdm-tool-btn"
                          style={{ margin: "4px 0" }}
                          onClick={() => {
                            setApiExpandedGroupKey(null);
                            apiData.setPage(1);
                          }}
                        >
                          ← Voltar aos grupos
                        </button>
                        <span className="hdm-grp-meta" style={{ marginLeft: 8 }}>
                          {apiExpandedGroupKey}
                        </span>
                      </td>
                    </tr>
                    {events0.length === 0 && !apiData.isLoading ? (
                      <tr>
                        <td colSpan={99} className="hdm-empty">
                          Nenhum evento neste grupo.
                        </td>
                      </tr>
                    ) : (
                      events0.map((r, i) => renderLeafRow(r, i, `api-${i}-`))
                    )}
                  </>
                ) : groupingTooLarge ? (
                  <tr>
                    <td colSpan={99} className="hdm-empty">
                      Muitos registros para agrupar em mais de um nível. Use a busca, reduza o
                      período ou agrupe só por uma coluna (ex.: Filial).
                    </td>
                  </tr>
                ) : collaboratorDetailMode ? (
                  groupTree ? (
                    renderCollaboratorDetailRows(groupTree)
                  ) : (
                    <tr>
                      <td colSpan={collabDetailColSpan} className="hdm-empty">
                        Preparando agrupamento...
                      </td>
                    </tr>
                  )
                ) : groupBy.length > 0 ? (
                  groupTree ? (
                    renderGroupTree(groupTree)
                  ) : (
                    <tr>
                      <td colSpan={99} className="hdm-empty">
                        Preparando agrupamento…
                      </td>
                    </tr>
                  )
                ) : flatRowIndices.length === 0 ? (
                  <tr>
                    <td colSpan={99} className="hdm-empty">
                      Nenhum {isEventsMode ? "evento" : "colaborador"} encontrado.
                    </td>
                  </tr>
                ) : virtualWindow ? (
                  <>
                    {virtualWindow.topPad > 0 && (
                      <tr aria-hidden="true">
                        <td
                          colSpan={99}
                          style={{ height: virtualWindow.topPad, padding: 0, border: 0 }}
                        />
                      </tr>
                    )}
                    {flatRowIndices
                      .slice(virtualWindow.start, virtualWindow.end)
                      .map((rowIdx, i) =>
                        renderLeafRow(tableDataRows[rowIdx], rowIdx, `${virtualWindow.start + i}-`),
                      )}
                    {virtualWindow.bottomPad > 0 && (
                      <tr aria-hidden="true">
                        <td
                          colSpan={99}
                          style={{ height: virtualWindow.bottomPad, padding: 0, border: 0 }}
                        />
                      </tr>
                    )}
                  </>
                ) : (
                  <>
                    {flatRowIndices.slice(0, displayLimit).map((rowIdx, i) => renderLeafRow(tableDataRows[rowIdx], rowIdx, `${i}-`))}
                    {flatRowIndices.length > displayLimit && (
                      <tr>
                        <td colSpan={99} className="hdm-load-more">
                          <button
                            type="button"
                            onClick={() => setDisplayLimit((n) => n + ROW_LIMIT)}
                          >
                            Ver mais {Math.min(ROW_LIMIT, flatRowIndices.length - displayLimit)} de{" "}
                            {flatRowIndices.length - displayLimit} restantes
                          </button>
                        </td>
                      </tr>
                    )}
                  </>
                )}
              </tbody>
              {filteredCount > 0 && !hideGridTotals && !collaboratorDetailMode && (
                <tfoot>
                  <tr className="hdm-totals">
                    {isEventsMode
                      ? renderEvtTotalCells(evtTotalsAll)
                      : renderTotalCells(empTotalsAll)}
                  </tr>
                </tfoot>
              )}
            </table>
          </div>

          {/* Footer */}
          {!isSheetImportEmbedded ? (
          <div className="hdm-footer">
            {hasAnyFilter && !auditWorkspaceMode && (
              <span className="hdm-filter-badge">
                Filtros ativos · {totalRows - filteredCount} oculto
                {totalRows - filteredCount !== 1 ? "s" : ""}
              </span>
            )}
            <div style={{ flex: 1 }} />
            {isApiMode && !apiData.useGroupList && (
              <div className="hdm-pager">
                <button
                  type="button"
                  className="hdm-tool-btn"
                  disabled={apiData.page <= 1 || apiData.isFetching}
                  onClick={() => apiData.setPage((p) => Math.max(1, p - 1))}
                >
                  ← Anterior
                </button>
                <span className="hdm-count">
                  Página {apiData.page} de {apiData.totalPages} ·{" "}
                  {filteredCount.toLocaleString("pt-BR")} registro
                  {filteredCount !== 1 ? "s" : ""}
                </span>
                <button
                  type="button"
                  className="hdm-tool-btn"
                  disabled={apiData.page >= apiData.totalPages || apiData.isFetching}
                  onClick={() => apiData.setPage((p) => p + 1)}
                >
                  Próxima →
                </button>
              </div>
            )}
          </div>
          ) : null}

          {!embedded ? (
            <div className="hdm-resize-handle" onMouseDown={onResizeStart} />
          ) : null}
        </div>
      </div>
      {calcEv && (
        <HorasCalcModal
          key={`${calcEv.mat}_${calcEv.data}_${calcEv.evento}`}
          ev={calcEv}
          onClose={() => setCalcEv(null)}
        />
      )}
      {auditMemoria && (
        <div className="hdm-audit-modal" data-theme={theme} role="dialog" aria-modal="true">
          <div className="hdm-audit-card hdm-audit-explain-card">
            <div className="hdm-audit-head">
              <div>
                <strong>Memória de cálculo</strong>
                <span>{auditMemoria.titulo}</span>
              </div>
              <button
                type="button"
                className="hdm-close"
                onClick={() => {
                  setAuditMemoria(null);
                  setAuditQuestion("resumo");
                }}
              >
                ×
              </button>
            </div>
            <div className="hdm-audit-body">
              <section className="hdm-audit-explain-hero">
                <span className="hdm-audit-explain-kicker">Resposta da memoria</span>
                <h4>{auditExplanation?.title || "Resumo explicado"}</h4>
                <p>{auditExplanation?.answer}</p>
                {auditExplanation?.bullets?.length ? (
                  <ul>
                    {auditExplanation.bullets.map((item, index) => (
                      <li key={`${item}-${index}`}>{item}</li>
                    ))}
                  </ul>
                ) : null}
              </section>

              <section className="hdm-audit-ask-box">
                <h4>Perguntar sobre esta auditoria</h4>
                <div className="hdm-audit-question-pills">
                  {AUDIT_EXPLAIN_QUICK_QUESTIONS.map((item) => (
                    <button
                      key={item.id}
                      type="button"
                      className={inferAuditQuestionType(auditQuestion) === item.id ? "active" : ""}
                      onClick={() => setAuditQuestion(item.id)}
                    >
                      {item.label}
                    </button>
                  ))}
                </div>
                <input
                  type="text"
                  value={AUDIT_EXPLAIN_QUICK_QUESTIONS.some((item) => item.id === auditQuestion) ? "" : auditQuestion}
                  onChange={(e) => setAuditQuestion(e.target.value)}
                  placeholder="Ex.: qual limite foi usado? por que virou critica?"
                />
              </section>

              <p className="hdm-audit-summary">{auditMemoria.resumo}</p>
              <section className="hdm-audit-marks-card">
                <div className="hdm-audit-marks-head">
                  <div>
                    <span>Evento</span>
                    <strong>{auditMemoria.evento || "-"}</strong>
                  </div>
                  <div>
                    <span>Horas evento</span>
                    <strong>{auditMemoria.horasEvento || "-"}</strong>
                  </div>
                  <div>
                    <span>Horas marcacoes</span>
                    <strong>{auditMemoria.horasMarcacoes || "-"}</strong>
                  </div>
                </div>
                <div className="hdm-audit-marks-stack" style={{ "--mark-slots": Math.max(1, auditMemoryMarkSlots.length) }}>
                  <div className="hdm-collab-mark-line">
                    <span className="hdm-collab-mark-label">Prev:</span>
                    <span className="hdm-collab-mark-values">
                      {auditMemoryMarkSlots.map((slot, partIdx) => (
                        <span key={`audit-prev-${partIdx}`} className="hdm-collab-time-slot">
                          {slot.prev || ""}
                        </span>
                      ))}
                    </span>
                  </div>
                  {auditMemoryHasRealMarks ? (
                    <>
                      <div className="hdm-collab-mark-line hdm-collab-marcacao">
                        <span className="hdm-collab-mark-label">Real:</span>
                        <span className="hdm-collab-mark-values">
                          {auditMemoryMarkSlots.map((slot, partIdx) => (
                            <span key={`audit-real-${partIdx}`} className={`hdm-collab-time-slot ${slot.real ? "is-real" : ""}`}>
                              {slot.real || ""}
                            </span>
                          ))}
                        </span>
                      </div>
                      <div className="hdm-collab-mark-line hdm-collab-diff">
                        <span className="hdm-collab-mark-label">Dif:</span>
                        <span className="hdm-collab-mark-values">
                          {auditMemoryMarkSlots.map((slot, partIdx) => (
                            <span
                              key={`audit-dif-${partIdx}`}
                              className={`hdm-collab-time-slot hdm-diff-slot hdm-diff-${slot.sign}${slot.severe ? " is-severe" : ""}`}
                            >
                              {slot.diffText}
                            </span>
                          ))}
                        </span>
                      </div>
                    </>
                  ) : null}
                </div>
              </section>
              <h4>Regras acionadas</h4>
              <ul className="hdm-audit-list">
                {auditMemoria.anomalias?.map((item) => (
                  <li key={item.codigo}>
                    <strong>{item.codigo}</strong>
                    <span>{item.mensagem}</span>
                    {item.detalhe ? <em>{item.detalhe}</em> : null}
                    {item.evidencia?.regraAplicada ? (
                      <small>Regra aplicada: {item.evidencia.regraAplicada}</small>
                    ) : null}
                    {item.memoria?.length ? (
                      <small>{item.memoria.join(" | ")}</small>
                    ) : null}
                  </li>
                ))}
              </ul>
              <h4>Motor da auditoria</h4>
              <dl className="hdm-audit-dl">
                <div><dt>Versao</dt><dd>{auditMemoria.versaoMotor || "-"}</dd></div>
                <div><dt>Hash regras</dt><dd>{auditMemoria.hashRegrasAtivas || "-"}</dd></div>
                <div><dt>Fechamento</dt><dd>{auditMemoria.statusFechamento || "-"}</dd></div>
                <div><dt>Jornada</dt><dd>{auditMemoria.statusJornada || "-"}</dd></div>
                <div>
                  <dt>Processado em</dt>
                  <dd>
                    {auditMemoria.processadoEm
                      ? new Date(auditMemoria.processadoEm).toLocaleString("pt-BR")
                      : "-"}
                  </dd>
                </div>
              </dl>
              <h4>Parametros usados</h4>
              <dl className="hdm-audit-dl">
                {auditMemoryUsedParamKeys.length ? (
                  auditMemoryUsedParamKeys.map((key) => (
                    <div key={key}>
                      <dt>{auditParamLabel(key)}</dt>
                      <dd>{auditParamValue(key, auditMemoria.parametros?.[key])}</dd>
                    </div>
                  ))
                ) : (
                  <div>
                    <dt>Parametro</dt>
                    <dd>Esta regra nao registrou parametro especifico na memoria.</dd>
                  </div>
                )}
              </dl>
              {auditMemoria.reviewKey ? (
                <section className="hdm-audit-review-box">
                  <h4>Tratamento</h4>
                  <div className="hdm-audit-review-grid">
                    <label>
                      <span>Status</span>
                      <select
                        value={getAuditReview(auditMemoria.reviewKey).status}
                        onChange={(e) => updateAuditReview(auditMemoria.reviewKey, { status: e.target.value })}
                      >
                        {AUDIT_REVIEW_STATUS.map((status) => (
                          <option key={status.id} value={status.id}>
                            {status.label}
                          </option>
                        ))}
                      </select>
                    </label>
                    <label>
                      <span>Justificativa / acao tomada</span>
                      <textarea
                        rows={4}
                        value={getAuditReview(auditMemoria.reviewKey).justificativa || ""}
                        onChange={(e) =>
                          updateAuditReview(auditMemoria.reviewKey, { justificativa: e.target.value })
                        }
                        placeholder="Ex.: Conferido com gestor, ajustar folha, evento correto por CCT..."
                      />
                    </label>
                  </div>
                  <div className="hdm-audit-review-actions">
                    <span>
                      Ultima revisao:{" "}
                      {getAuditReview(auditMemoria.reviewKey).updatedAt
                        ? new Date(getAuditReview(auditMemoria.reviewKey).updatedAt).toLocaleString("pt-BR")
                        : "nao revisado"}
                    </span>
                    <button
                      type="button"
                      className="hdm-audit-secondary"
                      onClick={() =>
                        updateAuditReview(auditMemoria.reviewKey, {
                          status: "revisado",
                          justificativa: getAuditReview(auditMemoria.reviewKey).justificativa || "Conferido.",
                        })
                      }
                    >
                      Marcar revisado
                    </button>
                  </div>
                  <div className="hdm-audit-history">
                    <h4>Historico de tratamento</h4>
                    {getAuditReview(auditMemoria.reviewKey).history?.length ? (
                      <ol>
                        {[...getAuditReview(auditMemoria.reviewKey).history]
                          .reverse()
                          .map((item, index) => (
                            <li key={`${item.at || "sem-data"}-${index}`}>
                              <strong>
                                {item.at ? new Date(item.at).toLocaleString("pt-BR") : "sem data"}
                              </strong>
                              <span>
                                {(AUDIT_REVIEW_LABELS[item.fromStatus] || item.fromStatus || "Pendente") +
                                  " -> " +
                                  (AUDIT_REVIEW_LABELS[item.toStatus] || item.toStatus || "Pendente")}
                              </span>
                              {item.justificativa ? <em>{item.justificativa}</em> : null}
                            </li>
                          ))}
                      </ol>
                    ) : (
                      <p>Sem historico de tratamento.</p>
                    )}
                  </div>
                </section>
              ) : null}
            </div>
          </div>
        </div>
      )}
      <AuditoriaPontoParamsPanel
        open={auditParamsOpen}
        value={auditParams}
        onChange={(next) => setAuditParams(normalizeAuditoriaParamsConfig(next))}
        onClose={() => setAuditParamsOpen(false)}
        onSave={() => setAuditParamsOpen(false)}
        onReset={() => setAuditParams(normalizeAuditoriaParamsConfig(DEFAULT_AUDITORIA_PONTO_PARAMS))}
      />
      {false && auditParamsOpen && (
        <div className="hdm-audit-modal" data-theme={theme} role="dialog" aria-modal="true">
          <div
            className="hdm-audit-card hdm-audit-param-card hdm-audit-param-card--floating"
            style={{
              left: `calc(50% + ${auditParamsPos.x}px)`,
              top: `calc(50% + ${auditParamsPos.y}px)`,
              width: auditParamsSize.w,
              height: auditParamsSize.h,
              transform: "translate(-50%, -50%)",
            }}
          >
            <div className="hdm-audit-head hdm-audit-head--draggable" onMouseDown={onAuditParamsDragStart}>
              <div>
                <strong>Parâmetros de auditoria</strong>
                <span>Ajuste conforme CCT, escala ou politica interna.</span>
              </div>
              <button type="button" className="hdm-close" onClick={() => setAuditParamsOpen(false)}>
                ×
              </button>
            </div>
            <div className="hdm-audit-form">
              {[
                ["toleranciaMinutos", "Tolerancia geral de desvio (min)"],
                ["toleranciaDuplicidadeMinutos", "Janela para batida duplicada (min)"],
                ["janelaPareamentoMaxMinutos", "Janela maxima de pareamento (min)"],
                ["intervaloIntrajornadaMinutos", "Intervalo intrajornada minimo (min)"],
                ["jornadaIntrajornadaMinutos", "Jornada que exige intervalo (min)"],
                ["intervaloInterjornadaMinutos", "Intervalo interjornada minimo (min)"],
                ["pontoBritanicoDias", "Dias repetidos para ponto britanico"],
                ["minutosResiduaisMinutos", "Minutos residuais tolerados (min)"],
                ["limiteHoraExtraDiariaMinutos", "Limite diario de hora extra (min)"],
                ["intervaloIntrajornadaMaxMinutos", "Intervalo intrajornada maximo esperado (min)"],
                ["diasConsecutivosLimite", "Limite de dias consecutivos trabalhados"],
                ["limiteBancoHorasPositivoMinutos", "Limite positivo de banco de horas (min)"],
                ["limiteBancoHorasNegativoMinutos", "Limite negativo de banco de horas (min)"],
                ["recorrenciaRiscoLimite", "Ocorrencias para risco recorrente"],
              ].map(([key, label]) => (
                <label key={key}>
                  <span>{label}</span>
                  <input
                    type="number"
                    min="0"
                    value={auditParams[key] ?? 0}
                    onChange={(e) =>
                      setAuditParams((prev) => ({
                        ...prev,
                        [key]: Math.max(0, Number(e.target.value) || 0),
                      }))
                    }
                  />
                </label>
              ))}
              <section className="hdm-audit-ignore-section">
                <div className="hdm-audit-ignore-head">
                  <div>
                    <strong>Eventos aceitos sem marcação</strong>
                    <span>
                      Use um termo por linha. Quando o evento contiver um desses termos, a auditoria nao acusa
                      "jornada sem marcacoes".
                    </span>
                  </div>
                </div>
                <label className="hdm-audit-textarea-label">
                  <span>Termos do cliente</span>
                  <textarea
                    value={(Array.isArray(auditParams.eventosSemMarcacaoOk)
                      ? auditParams.eventosSemMarcacaoOk
                      : DEFAULT_AUDITORIA_PONTO_EVENTOS_SEM_MARCACAO_OK
                    ).join("\n")}
                    placeholder={"Ex.:\nFERIAS\nFALTA NAO JUSTIFICADA\nAFASTAMENTO"}
                    onChange={(e) =>
                      setAuditParams((prev) => ({
                        ...prev,
                        eventosSemMarcacaoOk: e.target.value
                          .split(/\r?\n/)
                          .map((item) => item.trim())
                          .filter(Boolean),
                      }))
                    }
                  />
                </label>
              </section>
              <section className="hdm-audit-ignore-section hdm-audit-rule-treatment-section">
                <div className="hdm-audit-ignore-head">
                  <div>
                    <strong>Tratamento das regras</strong>
                    <span>
                      Defina se a regra gera pendencia de decisao ou se aparece apenas como informacao auditavel.
                    </span>
                  </div>
                  <button
                    type="button"
                    className="hdm-audit-secondary"
                    onClick={() =>
                      setAuditParams((prev) => ({
                        ...prev,
                        tratamentoRegras: {},
                      }))
                    }
                  >
                    Restaurar regras
                  </button>
                </div>
                <div className="hdm-audit-rule-treatment-list">
                  {REGRAS_AUDITORIA_PONTO_META.map((rule) => {
                    const value = auditParams.tratamentoRegras?.[rule.id] || "acao";
                    return (
                      <div className="hdm-audit-rule-treatment-row" key={rule.id}>
                        <div>
                          <strong>{rule.titulo}</strong>
                          <span>{rule.categoria} · {rule.id}</span>
                        </div>
                        <select
                          value={value}
                          onChange={(e) =>
                            setAuditParams((prev) => ({
                              ...prev,
                              tratamentoRegras: {
                                ...(prev.tratamentoRegras || {}),
                                [rule.id]: e.target.value,
                              },
                            }))
                          }
                        >
                          {AUDIT_RULE_TREATMENTS.map((item) => (
                            <option key={item.id} value={item.id}>
                              {item.label}
                            </option>
                          ))}
                        </select>
                      </div>
                    );
                  })}
                </div>
              </section>
              <section className="hdm-audit-ignore-section">
                <div className="hdm-audit-ignore-head">
                  <div>
                    <strong>Eventos de jornada principal</strong>
                    <span>
                      Use um termo por linha. As regras de marcacao e jornada rodam somente quando o evento
                      contiver um desses termos.
                    </span>
                  </div>
                </div>
                <label className="hdm-audit-textarea-label">
                  <span>Termos do cliente</span>
                  <textarea
                    value={(Array.isArray(auditParams.eventosJornadaPrincipal)
                      ? auditParams.eventosJornadaPrincipal
                      : DEFAULT_AUDITORIA_PONTO_EVENTOS_JORNADA_PRINCIPAL
                    ).join("\n")}
                    placeholder={"Ex.:\nHORAS NORMAIS\nJORNADA NORMAL\nPRESENCA"}
                    onChange={(e) =>
                      setAuditParams((prev) => ({
                        ...prev,
                        eventosJornadaPrincipal: e.target.value
                          .split(/\r?\n/)
                          .map((item) => item.trim())
                          .filter(Boolean),
                      }))
                    }
                  />
                </label>
              </section>
              <section className="hdm-audit-ignore-section">
                <div className="hdm-audit-ignore-head">
                  <div>
                    <strong>Eventos ignorados na auditoria</strong>
                    <span>
                      Use para eventos que nao exigem marcacao, como NCP - NAO CONTROLA PONTO.
                    </span>
                  </div>
                  <button
                    type="button"
                    className="hdm-audit-secondary"
                    onClick={() =>
                      setAuditParams((prev) => ({
                        ...prev,
                        eventosIgnoradosAuditoria: [
                          ...(Array.isArray(prev.eventosIgnoradosAuditoria)
                            ? prev.eventosIgnoradosAuditoria
                            : []),
                          {
                            id: `IGNORAR_EVENTO_${Date.now()}`,
                            ativo: true,
                            campo: "evento",
                            operador: "contem",
                            valor: "",
                            regras: ["todas"],
                            motivo: "Evento nao deve gerar pendencia de auditoria.",
                          },
                        ],
                      }))
                    }
                  >
                    Adicionar evento
                  </button>
                </div>
                <div className="hdm-audit-ignore-list">
                  {(Array.isArray(auditParams.eventosIgnoradosAuditoria)
                    ? auditParams.eventosIgnoradosAuditoria
                    : DEFAULT_AUDITORIA_PONTO_EVENTOS_IGNORADOS
                  ).map((item, index) => (
                    <div className="hdm-audit-ignore-row" key={item.id || index}>
                      <label className="hdm-audit-ignore-active">
                        <input
                          type="checkbox"
                          checked={item.ativo !== false}
                          onChange={(e) =>
                            setAuditParams((prev) => {
                              const list = Array.isArray(prev.eventosIgnoradosAuditoria)
                                ? [...prev.eventosIgnoradosAuditoria]
                                : [...DEFAULT_AUDITORIA_PONTO_EVENTOS_IGNORADOS];
                              list[index] = { ...list[index], ativo: e.target.checked };
                              return { ...prev, eventosIgnoradosAuditoria: list };
                            })
                          }
                        />
                        Ativo
                      </label>
                      <label>
                        <span>Evento contem</span>
                        <input
                          type="text"
                          value={item.valor || ""}
                          placeholder="Ex.: NAO CONTROLA PONTO"
                          onChange={(e) =>
                            setAuditParams((prev) => {
                              const list = Array.isArray(prev.eventosIgnoradosAuditoria)
                                ? [...prev.eventosIgnoradosAuditoria]
                                : [...DEFAULT_AUDITORIA_PONTO_EVENTOS_IGNORADOS];
                              list[index] = { ...list[index], valor: e.target.value };
                              return { ...prev, eventosIgnoradosAuditoria: list };
                            })
                          }
                        />
                      </label>
                      <label>
                        <span>Motivo</span>
                        <input
                          type="text"
                          value={item.motivo || ""}
                          placeholder="Por que esse evento nao deve auditar?"
                          onChange={(e) =>
                            setAuditParams((prev) => {
                              const list = Array.isArray(prev.eventosIgnoradosAuditoria)
                                ? [...prev.eventosIgnoradosAuditoria]
                                : [...DEFAULT_AUDITORIA_PONTO_EVENTOS_IGNORADOS];
                              list[index] = { ...list[index], motivo: e.target.value };
                              return { ...prev, eventosIgnoradosAuditoria: list };
                            })
                          }
                        />
                      </label>
                      <button
                        type="button"
                        className="hdm-audit-secondary hdm-audit-ignore-remove"
                        onClick={() =>
                          setAuditParams((prev) => ({
                            ...prev,
                            eventosIgnoradosAuditoria: (Array.isArray(prev.eventosIgnoradosAuditoria)
                              ? prev.eventosIgnoradosAuditoria
                              : DEFAULT_AUDITORIA_PONTO_EVENTOS_IGNORADOS
                            ).filter((_, itemIndex) => itemIndex !== index),
                          }))
                        }
                      >
                        Remover
                      </button>
                    </div>
                  ))}
                </div>
              </section>
              <div className="hdm-audit-actions">
                <button
                  type="button"
                  className="hdm-audit-secondary"
                  onClick={() =>
                    setAuditParams({
                      ...DEFAULT_AUDITORIA_PONTO_PARAMS,
                      tratamentoRegras: {},
                      eventosIgnoradosAuditoria: DEFAULT_AUDITORIA_PONTO_EVENTOS_IGNORADOS,
                      eventosSemMarcacaoOk: DEFAULT_AUDITORIA_PONTO_EVENTOS_SEM_MARCACAO_OK,
                      eventosJornadaPrincipal: DEFAULT_AUDITORIA_PONTO_EVENTOS_JORNADA_PRINCIPAL,
                    })
                  }
                >
                  Restaurar padrao
                </button>
                <button type="button" className="hdm-audit-primary" onClick={() => setAuditParamsOpen(false)}>
                  Aplicar
                </button>
              </div>
            </div>
            <div className="hdm-audit-param-resize" onMouseDown={onAuditParamsResizeStart} />
          </div>
        </div>
      )}
    </>
  );

  const filterPortalRoot = getFilterPortalRoot();
  const filterPortal =
    filterPop && filterPortalRoot
      ? createPortal(
          <div
            ref={filterPopRef}
            className="hdm-filter-pop"
            data-theme={theme}
            style={{
              position: "fixed",
              top: Math.max(8, Math.min(filterPop.rect.bottom + 4, window.innerHeight - 420)),
              left: Math.max(8, Math.min(filterPop.rect.left, window.innerWidth - 260)),
              zIndex: 2147483002,
            }}
            onMouseDown={(e) => e.stopPropagation()}
          >
            <div className="hdm-fp-head">
              <span className="hdm-fp-title">
                {filterPop.col === "nome"
                  ? "Colaborador"
                  : filterPop.col === "auditoria"
                    ? "Regra acionada"
                  : COLS.find((c) => c.id === filterPop.col)?.label}
              </span>
              <button
                type="button"
                className="hdm-fp-close"
                onClick={closeFilterPop}
                aria-label="Fechar filtro"
                title="Fechar"
              >
                ×
              </button>
            </div>
            <div className="hdm-fp-cond-row">
              <select
                className="hdm-fp-cond-op"
                value={filterCondDraft.op}
                onChange={(e) =>
                  setFilterCondDraft((prev) => ({ ...prev, op: e.target.value }))
                }
                aria-label="Operador do filtro"
              >
                {HDM_FILTER_OPS.map((op) => (
                  <option key={op.id} value={op.id}>
                    {op.label}
                  </option>
                ))}
              </select>
              <input
                type="text"
                className="hdm-fp-cond-val"
                placeholder="Valor…"
                value={filterCondDraft.value}
                onChange={(e) =>
                  setFilterCondDraft((prev) => ({ ...prev, value: e.target.value }))
                }
              />
            </div>
            <div className="hdm-fp-search-row">
              <input
                type="search"
                className="hdm-fp-search"
                placeholder="Pesquisar valores…"
                value={filterPopSearch}
                onChange={(e) => setFilterPopSearch(e.target.value)}
                autoFocus
              />
            </div>
            <div className="hdm-fp-list">
              {(() => {
                const all = filterPopUniqueVals;
                const q = filterPopSearch.trim().toLowerCase();
                const visible = q
                  ? all.filter((v) =>
                      getColFilterDisplay(v, filterPop.col).toLowerCase().includes(q),
                    )
                  : all;
                const rendered = visible.slice(0, 500);
                const activeSet = filterDraft;
                const allChecked = !(activeSet instanceof Set);
                const someChecked = activeSet instanceof Set && activeSet.size > 0;
                return (
                  <>
                    {filterPopValuesPending ? (
                      <div className="hdm-fp-item hdm-fp-note">Carregando valores…</div>
                    ) : null}
                    {!filterPopValuesPending && !q && all.length > 0 && (
                      <label className="hdm-fp-item hdm-fp-selall-row">
                        <input
                          type="checkbox"
                          checked={allChecked}
                          ref={(el) => {
                            if (el) el.indeterminate = someChecked && !allChecked;
                          }}
                          onChange={() => setFilterDraft(allChecked ? new Set() : null)}
                        />
                        <span>(Selecionar Tudo)</span>
                      </label>
                    )}
                    {!filterPopValuesPending && all.length === 0 ? (
                      <div className="hdm-fp-item hdm-fp-note">Nenhum valor distinto nesta coluna.</div>
                    ) : null}
                    {rendered.map((val, idx) => {
                      const displayVal = getColFilterDisplay(val, filterPop.col);
                      return (
                        <label key={`${idx}:${val}`} className="hdm-fp-item">
                          <input
                            type="checkbox"
                            checked={!activeSet || activeSet.has(val)}
                            onChange={() => toggleFilterDraftVal(filterPop.col, val)}
                          />
                          <span>{displayVal}</span>
                        </label>
                      );
                    })}
                    {visible.length > rendered.length && (
                      <div className="hdm-fp-item hdm-fp-note">
                        Mostrando 500 de {visible.length.toLocaleString("pt-BR")}. Refine a busca.
                      </div>
                    )}
                  </>
                );
              })()}
            </div>
            <div className="hdm-fp-foot">
              <button
                type="button"
                className="hdm-fp-btn hdm-fp-btn-ghost"
                onClick={() => clearFilter(filterPop.col)}
              >
                Limpar filtro
              </button>
              <button
                type="button"
                className="hdm-fp-btn hdm-fp-btn-primary"
                onClick={() => applyFilterDraft(filterPop.col)}
              >
                OK
              </button>
            </div>
          </div>,
          filterPortalRoot,
        )
      : null;

  return (
    <>
      {embedded ? shell : createPortal(shell, document.body)}
      {filterPortal}
    </>
  );
}

export default HistoricoDayModal;
