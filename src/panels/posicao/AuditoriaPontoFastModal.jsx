import React, { startTransition, useCallback, useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { normDateKey, fmtDateBr } from "./calendarUtils";
import {
  analisarAnomaliasPonto,
  DEFAULT_AUDITORIA_PONTO_PARAMS,
} from "./auditoriaPonto/pontoAnomalias.js";

const REVIEW_KEY = "mp_auditoria_ponto_reviews_v1";
const ACTIONABLE_TREATMENTS = new Set(["acao", "revisao_manual"]);
const PAGE_SIZE = 10;

const SEVERITY_BADGE_LABEL = {
  critica: "Crítica",
  alta: "Alta",
  media: "Média",
  baixa: "Baixa",
  ok: "OK",
};

const SEVERITY_LABEL = {
  todos: "Todos",
  critica: "Críticas",
  alta: "Altas",
  media: "Médias",
  baixa: "Baixas",
  ok: "OK",
};

const CATEGORY_LABEL = {
  pres: "Presentes",
  presentes: "Presentes",
  ause: "Ausentes",
  ausentes: "Ausentes",
  just: "Justificados",
  justificadas: "Justificados",
  justificados: "Justificados",
  extr: "Extras",
  extras: "Extras",
  trab: "Risco Trab.",
  risco: "Risco Trab.",
  risco_trab: "Risco Trab.",
  notu: "H. Noturnas",
  noturnas: "H. Noturnas",
  igno: "Ignorar",
  ignorar: "Ignorar",
};
const CATEGORY_ORDER = ["pres", "presentes", "ause", "ausentes", "just", "justificadas", "extr", "extras", "trab", "risco", "notu", "noturnas", "igno", "ignorar"];

const formatCategoryLabel = (key) => {
  const raw = String(key || "").trim();
  const normalized = normalizeText(raw).replace(/\s+/g, "_");
  if (CATEGORY_LABEL[raw]) return CATEGORY_LABEL[raw];
  if (CATEGORY_LABEL[normalized]) return CATEGORY_LABEL[normalized];
  return raw
    .replace(/[_-]+/g, " ")
    .replace(/\b\w/g, (char) => char.toUpperCase());
};

const prettifyAuditText = (value) =>
  String(value || "")
    .replace(/_/g, " ")
    .replace(/Ha marcacao em horario noturno sem evento noturno evidente\.?/gi, "Marcação noturna sem evento noturno.")
    .replace(/\bnao\b/gi, "não")
    .replace(/\bmarcacao\b/gi, "marcação")
    .replace(/\bmarcacoes\b/gi, "marcações")
    .replace(/\bhorario\b/gi, "horário")
    .replace(/\bparametro\b/gi, "parâmetro")
    .replace(/\bparametros\b/gi, "parâmetros")
    .replace(/\bperiodo\b/gi, "período")
    .replace(/\bcritica\b/gi, "crítica")
    .replace(/\bmedia\b/gi, "média")
    .replace(/\bausencia\b/gi, "ausência")
    .replace(/\bsequencia\b/gi, "sequência")
    .replace(/\bevidencia\b/gi, "evidência")
    .replace(/\bcompativel\b/gi, "compatível")
    .replace(/\bincompativel\b/gi, "incompatível")
    .replace(/\bprorrogacao\b/gi, "prorrogação")
    .replace(/\bclassificacao\b/gi, "classificação")
    .replace(/\bsaida\b/gi, "saída")
    .replace(/\bHa\b/g, "Há")
    .replace(/\bha\b/g, "há")
    .replace(/\s+/g, " ")
    .trim();

const formatRuleLabel = (code, fallback = "") => {
  const text = fallback && fallback !== code ? fallback : code;
  return prettifyAuditText(text)
    .toLowerCase()
    .replace(/(^|[.!?]\s+|\/\s*)\p{L}/gu, (match) => match.toUpperCase());
};

const normalizeText = (value) =>
  String(value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();

const stripHorarioCode = (value) =>
  String(value || "")
    .replace(/^\d+\s*-\s*/, "")
    .replace(/\bF\s+M\b/gi, "FM")
    .replace(/\s+/g, " ")
    .trim();

const splitTimeTokens = (value) =>
  stripHorarioCode(value)
    .split(/\s+/)
    .filter((token) => /^\d{1,2}:\d{2}$/.test(token));

const splitMarkTokens = (value) =>
  stripHorarioCode(value)
    .split(/\s+/)
    .filter((token) => token === "FM" || /^\d{1,2}:\d{2}$/.test(token));

const timeToMinutes = (token) => {
  const m = String(token || "").match(/^(\d{1,2}):(\d{2})$/);
  return m ? Number(m[1]) * 60 + Number(m[2]) : null;
};

const buildSequence = (parts) => {
  let last = null;
  return parts.map((token) => {
    const base = timeToMinutes(token);
    if (base == null) return { token, minutes: null };
    let minutes = base;
    while (last != null && minutes < last) minutes += 1440;
    last = minutes;
    return { token, minutes };
  });
};

const formatDiff = (diff) => {
  if (diff === 0) return "";
  const sign = diff > 0 ? "+" : "-";
  const abs = Math.abs(diff);
  if (abs >= 60) {
    const h = Math.floor(abs / 60);
    const m = abs % 60;
    return m > 0 ? `${sign}${h}h${String(m).padStart(2, "0")}m` : `${sign}${h}h`;
  }
  return `${sign}${abs}m`;
};

const buildMarkSlots = (horario, marcacao, tolerance = 0) => {
  const prev = buildSequence(splitTimeTokens(horario));
  const real = buildSequence(splitMarkTokens(marcacao));
  const slots = prev.map((item) => ({
    prev: item.token || "",
    prevMinutes: item.minutes,
    real: "",
    diffText: "",
    sign: "neutral",
    severe: false,
  }));
  const comparable = real.filter((item) => item.minutes != null);
  if (prev.length && comparable.length === prev.length && real.every((item) => item.minutes != null)) {
    real.forEach((item, idx) => {
      const diff = item.minutes - slots[idx].prevMinutes;
      slots[idx] = {
        ...slots[idx],
        real: item.token || "",
        diffText: formatDiff(diff),
        sign: diff < 0 ? "neg" : diff > 0 ? "pos" : "neutral",
        severe: Math.abs(diff) > tolerance,
      };
    });
    return slots;
  }
  const usedPrev = new Set();
  real.forEach((item) => {
    if (item.minutes == null) {
      slots.push({ prev: "", prevMinutes: null, real: item.token || "", diffText: "", sign: "neutral", severe: false });
      return;
    }
    let bestIdx = -1;
    let bestDistance = Infinity;
    prev.forEach((prevItem, idx) => {
      if (usedPrev.has(idx) || prevItem.minutes == null) return;
      const distance = Math.abs(item.minutes - prevItem.minutes);
      if (distance < bestDistance) {
        bestDistance = distance;
        bestIdx = idx;
      }
    });
    if (bestIdx >= 0) {
      usedPrev.add(bestIdx);
      const diff = item.minutes - slots[bestIdx].prevMinutes;
      slots[bestIdx] = {
        ...slots[bestIdx],
        real: item.token || "",
        diffText: formatDiff(diff),
        sign: diff < 0 ? "neg" : diff > 0 ? "pos" : "neutral",
        severe: Math.abs(diff) > tolerance,
      };
      return;
    }
    slots.push({ prev: "", prevMinutes: null, real: item.token || "", diffText: "", sign: "neutral", severe: false });
  });
  return slots.length ? slots : [{ prev: "", real: "", diffText: "", sign: "neutral", severe: false }];
};

const fmtMinutes = (minutes) => {
  const value = Math.max(0, Math.round(Number(minutes) || 0));
  return `${Math.floor(value / 60)}:${String(value % 60).padStart(2, "0")}`;
};

const fmtDateShort = (iso) => {
  const d = normDateKey(iso);
  if (!d) return "";
  const [y, m, day] = d.split("-");
  return `${day}/${m}/${String(y).slice(2)}`;
};

const fmtWeekdayShort = (iso) => {
  const d = normDateKey(iso);
  if (!d) return "";
  const date = new Date(`${d}T00:00:00`);
  return Number.isNaN(date.getTime())
    ? ""
    : date.toLocaleDateString("pt-BR", { weekday: "short" }).replace(".", "").toLowerCase();
};

const readReviews = () => {
  try {
    return JSON.parse(localStorage.getItem(REVIEW_KEY) || "{}") || {};
  } catch {
    return {};
  }
};

const writeReviews = (value) => {
  try {
    localStorage.setItem(REVIEW_KEY, JSON.stringify(value || {}));
  } catch {
    // Local storage indisponivel nao deve quebrar a auditoria.
  }
};

const isActionable = (audit) => {
  if (!audit?.memoria || audit.severidade === "ok") return false;
  if (audit.passivelAcao != null) return Boolean(audit.passivelAcao);
  return ACTIONABLE_TREATMENTS.has(audit.tratamentoRegra || "acao");
};

const displayReview = (audit, review) => {
  const next = review || {};
  if (!isActionable(audit) && (next.status || "pendente") === "pendente") {
    return { ...next, status: "sem_acao" };
  }
  return next;
};

const summarizeItems = (items) =>
  (Array.isArray(items) ? items : []).reduce(
    (acc, item) => {
      acc[item.severity] = (acc[item.severity] || 0) + 1;
      if ((item.review.status || "pendente") === "pendente" && isActionable(item.audit)) acc.pendente += 1;
      if ((item.review.status || "pendente") === "sem_acao") acc.semAcao += 1;
      return acc;
    },
    { critica: 0, alta: 0, media: 0, baixa: 0, ok: 0, pendente: 0, semAcao: 0 },
  );

const sameDayKey = (ev) => {
  const date = normDateKey(ev?.data || ev?.date || ev?.data_referencia);
  const person = String(ev?.mat || "").trim() || normalizeText(ev?.nome || "");
  return date && person ? `${person}|${date}` : "";
};

const makeReviewKey = (ev, audit) =>
  [
    ev?.mat || ev?.nome || "sem-colaborador",
    normDateKey(ev?.data || ev?.date || ev?.data_referencia) || "sem-data",
    ev?.cod || ev?.codigo || "",
    ev?.evento || ev?.situacaoDesc || "sem-evento",
    fmtMinutes(Number(ev?.horas) || 0),
    audit?.codigo || audit?.severidade || "auditoria",
  ]
    .map((part) => String(part || "").replace(/\s+/g, " ").trim())
    .join("|");

const inferRadarEvent = (ev, audit = null) => {
  const text = normalizeText(
    [ev?.evento, ev?.situacaoDesc, ev?._cat, audit?.observacao, audit?.regraAplicada, audit?.codigo].filter(Boolean).join(" "),
  );
  if (text.includes("interjornada") || text.includes("11h") || text.includes("11 horas")) return "Interjornada insuficiente";
  if (text.includes("intervalo") || text.includes("refeicao") || /\b(1h|sir|6hsi)\b/.test(text)) return "Intervalo intrajornada";
  if (text.includes("extra") || text.includes("sobrejornada") || text.includes("excedente")) return "Horas extras";
  if (text.includes("ferias")) return "Ferias";
  if (text.includes("marcacao") || text.includes("ponto")) return "Irregularidade de ponto / REP";
  return ev?.evento || ev?.situacaoDesc || "";
};

function buildAuditModel(events, params, reviews) {
  const normalizedEvents = (Array.isArray(events) ? events : [])
    .map((ev) => ({ ...ev, data: normDateKey(ev?.data || ev?.date || ev?.data_referencia) }))
    .filter((ev) => ev.data);
  const sameDay = new Map();
  normalizedEvents.forEach((ev) => {
    const key = sameDayKey(ev);
    if (!key) return;
    if (!sameDay.has(key)) sameDay.set(key, []);
    sameDay.get(key).push({
      cod: ev?.cod || ev?.codigo || "",
      evento: ev?.evento || ev?.situacaoDesc || "",
      _cat: ev?._cat || ev?.categoria || "",
    });
  });

  const byPerson = new Map();
  normalizedEvents.forEach((ev) => {
    const key = String(ev?.mat || "").trim() || normalizeText(ev?.nome || "") || "__sem_colaborador__";
    if (!byPerson.has(key)) byPerson.set(key, []);
    byPerson.get(key).push(ev);
  });

  const groups = [];
  const summary = { total: 0, critica: 0, alta: 0, media: 0, baixa: 0, ok: 0, pendente: 0, semAcao: 0 };
  const categoryCounts = new Map();
  const ruleCounts = new Map();

  for (const rows of byPerson.values()) {
    const ordered = [...rows].sort((a, b) => {
      const da = normDateKey(a?.data) || "";
      const db = normDateKey(b?.data) || "";
      if (da !== db) return da.localeCompare(db);
      return String(a?.horario || "").localeCompare(String(b?.horario || ""));
    });
    const britanicoMap = new Map();
    ordered.forEach((ev) => {
      const signature = splitTimeTokens(ev?.marcacao || "").join(" ");
      if (!signature || !ev.data) return;
      if (!britanicoMap.has(signature)) britanicoMap.set(signature, new Set());
      britanicoMap.get(signature).add(ev.data);
    });

    const items = ordered.map((ev, idx) => {
      const assinatura = splitTimeTokens(ev?.marcacao || "").join(" ");
      const input = {
        ...ev,
        sameDayEvents: sameDay.get(sameDayKey(ev)) || [],
        previousData: ordered[idx - 1] ? normDateKey(ordered[idx - 1]?.data) : "",
        previousMarcacao: ordered[idx - 1]?.marcacao || "",
        pontoBritanicoAssinatura: assinatura,
        pontoBritanicoRepeticoes: assinatura && britanicoMap.has(assinatura) ? britanicoMap.get(assinatura).size : 0,
      };
      const audit = analisarAnomaliasPonto(input, params);
      const reviewKey = makeReviewKey(ev, audit);
      const review = displayReview(audit, reviews[reviewKey] || {});
      const severity = audit?.severidade || "ok";
      summary[severity] = (summary[severity] || 0) + 1;
      summary.total += 1;
      if ((review.status || "pendente") === "pendente" && isActionable(audit)) summary.pendente += 1;
      if ((review.status || "pendente") === "sem_acao") summary.semAcao += 1;
      const cat = ev?._cat || ev?.categoria || "";
      if (cat) categoryCounts.set(cat, (categoryCounts.get(cat) || 0) + 1);
      if (audit?.codigo && audit.severidade !== "ok") {
        const label = formatRuleLabel(audit.codigo, audit.regraAplicada || audit.codigo);
        ruleCounts.set(audit.codigo, { codigo: audit.codigo, label, count: (ruleCounts.get(audit.codigo)?.count || 0) + 1 });
      }
      return { ev, audit, reviewKey, review, severity, search: normalizeText([ev?.mat, ev?.nome, ev?.cod, ev?.evento, ev?.situacaoDesc, ev?.depto, audit?.observacao, audit?.codigo].join(" ")) };
    });

    const first = items[0]?.ev || {};
    groups.push({
      key: String(first?.mat || "").trim() || normalizeText(first?.nome || "") || `grupo-${groups.length}`,
      mat: first?.mat || "",
      nome: first?.nome || "",
      depto: first?.depto || first?.departamento || "",
      search: normalizeText([first?.mat, first?.nome, first?.depto, first?.departamento, items.map((item) => item.search).join(" ")].join(" ")),
      items,
      summary: summarizeItems(items),
    });
  }

  groups.sort((a, b) => b.summary.pendente - a.summary.pendente || b.summary.critica - a.summary.critica || b.summary.alta - a.summary.alta || String(a.nome).localeCompare(String(b.nome), "pt-BR"));
  return {
    groups,
    summary,
    categoryCounts,
    ruleOptions: Array.from(ruleCounts.values()).sort((a, b) => b.count - a.count || a.label.localeCompare(b.label, "pt-BR")),
  };
}

function MarkStack({ ev, tolerance }) {
  const marks = stripHorarioCode(ev?.marcacao || "");
  const slots = buildMarkSlots(ev?.horario || "", marks, tolerance);
  const hasReal = splitMarkTokens(marks).length > 0;
  return (
    <div className="pb-audit-fast-marks" style={{ "--mark-slots": slots.length }}>
      <div>
        <span>Prev:</span>
        <b>{slots.map((slot, idx) => <i key={`p-${idx}`}>{slot.prev}</i>)}</b>
      </div>
      {hasReal ? (
        <>
          <div>
            <span>Real:</span>
            <b>{slots.map((slot, idx) => <i className={idx % 2 === 0 ? "is-in" : "is-out"} key={`r-${idx}`}>{slot.real}</i>)}</b>
          </div>
          <div>
            <span>Dif:</span>
            <b>{slots.map((slot, idx) => <i className={`is-diff is-${slot.sign}${slot.severe ? " is-severe" : ""}`} key={`d-${idx}`}>{slot.diffText}</i>)}</b>
          </div>
        </>
      ) : null}
    </div>
  );
}

const COLUMN_DEFS = [
  { key: "data", label: "Data" },
  { key: "evento", label: "Evento" },
  { key: "horas", label: "Horas" },
  { key: "marcacao", label: "Horário / Marcação" },
  { key: "auditoria", label: "Auditoria" },
];

const emptyColumnFilters = () => ({
  data: "",
  evento: "",
  horas: "",
  horasOp: "=",
  horasFim: "",
  marcacao: "",
  auditoria: "",
});

const parseHoursFilterMinutes = (value) => {
  const raw = String(value || "").trim().toLowerCase();
  if (!raw) return null;
  const colon = raw.match(/^(\d{1,3}):(\d{1,2})$/);
  if (colon) return Number(colon[1]) * 60 + Number(colon[2]);
  const hourMinute = raw.match(/^(?:(\d+(?:[.,]\d+)?)\s*h)?\s*(?:(\d+)\s*m(?:in)?)?$/);
  if (hourMinute && (hourMinute[1] || hourMinute[2])) {
    return Math.round(Number(String(hourMinute[1] || "0").replace(",", ".")) * 60) + Number(hourMinute[2] || 0);
  }
  const numeric = Number(raw.replace(",", "."));
  if (!Number.isFinite(numeric)) return null;
  return Math.round(numeric * 60);
};

const matchesHoursFilter = (item, filters) => {
  const first = parseHoursFilterMinutes(filters.horas);
  const op = filters.horasOp || "=";
  if (first == null) return true;
  const current = Number(item?.ev?.horas) || 0;
  if (op === "entre") {
    const second = parseHoursFilterMinutes(filters.horasFim);
    if (second == null) return current >= first;
    return current >= Math.min(first, second) && current <= Math.max(first, second);
  }
  if (op === "<") return current < first;
  if (op === ">") return current > first;
  if (op === "<=") return current <= first;
  if (op === ">=") return current >= first;
  return current === first;
};

const hasActiveColumnFilters = (filters) =>
  Boolean(
    filters?.data ||
      filters?.evento ||
      filters?.horas ||
      filters?.horasFim ||
      filters?.marcacao ||
      filters?.auditoria,
  );

const hasActiveColumnFilter = (filters, key) => {
  if (key === "horas") return Boolean(filters?.horas || filters?.horasFim);
  return Boolean(filters?.[key]);
};

const itemInDateRange = (item, from, to) => {
  const itemDate = normDateKey(item?.ev?.data);
  if (from && itemDate && itemDate < from) return false;
  if (to && itemDate && itemDate > to) return false;
  return true;
};

const summarizePeriodItems = (items) => {
  const summary = { total: 0, critica: 0, alta: 0, media: 0, baixa: 0, ok: 0, pendente: 0, semAcao: 0 };
  const categoryCounts = new Map();
  const ruleCounts = new Map();
  for (const item of Array.isArray(items) ? items : []) {
    const severity = item?.severity || "ok";
    summary[severity] = (summary[severity] || 0) + 1;
    summary.total += 1;
    if ((item.review?.status || "pendente") === "pendente" && isActionable(item.audit)) summary.pendente += 1;
    if ((item.review?.status || "pendente") === "sem_acao") summary.semAcao += 1;
    const cat = item.ev?._cat || item.ev?.categoria || "";
    if (cat) categoryCounts.set(cat, (categoryCounts.get(cat) || 0) + 1);
    if (item.audit?.codigo && item.audit.severidade !== "ok") {
      const label = formatRuleLabel(item.audit.codigo, item.audit.regraAplicada || item.audit.codigo);
      ruleCounts.set(item.audit.codigo, {
        codigo: item.audit.codigo,
        label,
        count: (ruleCounts.get(item.audit.codigo)?.count || 0) + 1,
      });
    }
  }
  return {
    summary,
    categoryCounts,
    ruleOptions: Array.from(ruleCounts.values()).sort((a, b) => b.count - a.count || a.label.localeCompare(b.label, "pt-BR")),
  };
};

const auditMessageText = (item) =>
  prettifyAuditText(String(item?.audit?.observacao || "").replace(/^(Critica|Critica|Alta|Media|Baixa|OK):\s*/i, ""));

const itemColumnText = (item, key) => {
  const ev = item?.ev || {};
  if (key === "data") return `${fmtDateShort(ev.data)} ${fmtWeekdayShort(ev.data)}`;
  if (key === "evento") return `${ev?.cod ? `${ev.cod} - ` : ""}${ev?.evento || ev?.situacaoDesc || ""}`;
  if (key === "horas") return fmtMinutes(ev?.horas);
  if (key === "marcacao") return `${ev?.horario || ""} ${ev?.marcacao || ""}`;
  if (key === "auditoria") {
    return [
      SEVERITY_BADGE_LABEL[item?.severity] || SEVERITY_LABEL[item?.severity] || item?.severity || "",
      item?.review?.status || "",
      item?.audit?.codigo || "",
      item?.audit?.regraAplicada || "",
      auditMessageText(item),
      item?.audit?.radarTrabalhista ? "radar risco trabalhista" : "",
    ].join(" ");
  }
  return "";
};

const itemSortValue = (item, key) => {
  const ev = item?.ev || {};
  if (key === "data") return normDateKey(ev?.data) || "";
  if (key === "horas") return Number(ev?.horas) || 0;
  return normalizeText(itemColumnText(item, key));
};

const getEventsDateRange = (rows) => {
  const dates = (Array.isArray(rows) ? rows : [])
    .map((ev) => normDateKey(ev?.data || ev?.date || ev?.data_referencia))
    .filter(Boolean)
    .sort();
  return {
    from: dates[0] || "",
    to: dates[dates.length - 1] || "",
  };
};

const cleanAuditTitle = (value) =>
  String(value || "Auditoria de ponto")
    .replace(/\s*-\s*\d{2}\/\d{2}\/\d{4}\s+(?:ate|até)\s+\d{2}\/\d{2}\/\d{4}\s*$/i, "")
    .trim() || "Auditoria de ponto";

export function AuditoriaPontoFastModal({
  open,
  label = "Auditoria de ponto",
  events = [],
  params = DEFAULT_AUDITORIA_PONTO_PARAMS,
  eventsDateFrom = "",
  eventsDateTo = "",
  onClose,
  onOpenParams,
  onOpenRadar,
  theme = "light",
}) {
  const [reviews, setReviews] = useState(() => readReviews());
  const [search, setSearch] = useState("");
  const [deferredSearch, setDeferredSearch] = useState("");
  const initialDateRange = getEventsDateRange(events);
  const [dateFrom, setDateFrom] = useState(() => normDateKey(eventsDateFrom) || initialDateRange.from || "");
  const [dateTo, setDateTo] = useState(() => normDateKey(eventsDateTo) || initialDateRange.to || "");
  const [appliedDateFrom, setAppliedDateFrom] = useState(() => normDateKey(eventsDateFrom) || initialDateRange.from || "");
  const [appliedDateTo, setAppliedDateTo] = useState(() => normDateKey(eventsDateTo) || initialDateRange.to || "");
  const [severity, setSeverity] = useState("todos");
  const [status, setStatus] = useState("todos");
  const [category, setCategory] = useState("");
  const [rule, setRule] = useState("");
  const [columnFilters, setColumnFilters] = useState(() => emptyColumnFilters());
  const [activeColumnFilter, setActiveColumnFilter] = useState("");
  const [showColumnFilters, setShowColumnFilters] = useState(false);
  const [sortConfig, setSortConfig] = useState({ key: "data", dir: "asc" });
  const [page, setPage] = useState(1);
  const [busy, setBusy] = useState(false);
  const [memory, setMemory] = useState(null);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      startTransition(() => setDeferredSearch(search));
    }, 160);
    return () => window.clearTimeout(timer);
  }, [search]);

  useEffect(() => {
    const range = getEventsDateRange(events);
    const nextFrom = normDateKey(eventsDateFrom) || range.from || "";
    const nextTo = normDateKey(eventsDateTo) || range.to || "";
    setDateFrom(nextFrom);
    setDateTo(nextTo);
    setAppliedDateFrom(nextFrom);
    setAppliedDateTo(nextTo);
  }, [events, eventsDateFrom, eventsDateTo]);

  const model = useMemo(() => buildAuditModel(events, params, reviews), [events, params, reviews]);
  const periodStats = useMemo(() => {
    const items = model.groups.flatMap((group) => group.items).filter((item) => itemInDateRange(item, appliedDateFrom, appliedDateTo));
    return summarizePeriodItems(items);
  }, [model.groups, appliedDateFrom, appliedDateTo]);
  const q = normalizeText(deferredSearch);
  const filteredGroups = useMemo(() => {
    const activeColumnFilters = Object.entries(columnFilters)
      .filter(([key]) => !["horas", "horasOp", "horasFim"].includes(key))
      .map(([key, value]) => [key, normalizeText(value)])
      .filter(([, value]) => value);
    const matchesItem = (item) => {
      if (!itemInDateRange(item, appliedDateFrom, appliedDateTo)) return false;
      const reviewStatus = item.review.status || "pendente";
      if (status !== "todos") {
        if (status === "pendente_acao" && !(reviewStatus === "pendente" && isActionable(item.audit))) return false;
        if (status !== "pendente_acao" && reviewStatus !== status) return false;
      }
      if (category === "__auditoria__") { if (item.severity === "ok") return false; }
      else if (category && (item.ev?._cat || item.ev?.categoria || "") !== category) return false;
      if (rule && item.audit?.codigo !== rule) return false;
      if (!matchesHoursFilter(item, columnFilters)) return false;
      for (const [key, value] of activeColumnFilters) {
        if (!normalizeText(itemColumnText(item, key)).includes(value)) return false;
      }
      return true;
    };
    const dir = sortConfig.dir === "desc" ? -1 : 1;
    const sortItems = (items) => {
      if (!sortConfig.key) return items;
      return [...items].sort((a, b) => {
        const av = itemSortValue(a, sortConfig.key);
        const bv = itemSortValue(b, sortConfig.key);
        if (typeof av === "number" || typeof bv === "number") return ((Number(av) || 0) - (Number(bv) || 0)) * dir;
        return String(av).localeCompare(String(bv), "pt-BR") * dir;
      });
    };
    return model.groups
      .map((group) => {
        if (q && !group.search.includes(q)) return null;
        const items = sortItems(group.items.filter(matchesItem));
        return items.length ? { ...group, items, summary: summarizeItems(items) } : null;
      })
      .filter(Boolean)
      .sort((a, b) => {
        if (!sortConfig.key) return 0;
        const av = itemSortValue(a.items[0], sortConfig.key);
        const bv = itemSortValue(b.items[0], sortConfig.key);
        if (typeof av === "number" || typeof bv === "number") return ((Number(av) || 0) - (Number(bv) || 0)) * dir;
        return String(av).localeCompare(String(bv), "pt-BR") * dir;
      });
  }, [model.groups, q, appliedDateFrom, appliedDateTo, status, category, rule, columnFilters, sortConfig]);

  useEffect(() => {
    setPage(1);
    setBusy(true);
    const timer = window.setTimeout(() => setBusy(false), Math.min(450, 80 + filteredGroups.length));
    return () => window.clearTimeout(timer);
  }, [deferredSearch, appliedDateFrom, appliedDateTo, status, category, rule, columnFilters, sortConfig, filteredGroups.length]);

  const totalPages = Math.max(1, Math.ceil(filteredGroups.length / PAGE_SIZE));
  const currentPage = Math.min(page, totalPages);
  const pageGroups = filteredGroups.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);
  const shownEvents = filteredGroups.reduce((sum, group) => sum + group.items.length, 0);
  const title = cleanAuditTitle(label);
  const categoryEntries = useMemo(
    () =>
      Array.from(periodStats.categoryCounts.entries()).sort(([a], [b]) => {
        const ia = CATEGORY_ORDER.indexOf(String(a || ""));
        const ib = CATEGORY_ORDER.indexOf(String(b || ""));
        if (ia !== -1 || ib !== -1) return (ia === -1 ? 999 : ia) - (ib === -1 ? 999 : ib);
        return formatCategoryLabel(a).localeCompare(formatCategoryLabel(b), "pt-BR");
      }),
    [periodStats.categoryCounts],
  );

  useEffect(() => {
    if (rule && !periodStats.ruleOptions.some((item) => item.codigo === rule)) {
      setRule("");
    }
  }, [periodStats.ruleOptions, rule]);

  const updateReview = useCallback((key, patch) => {
    setReviews((prev) => {
      const next = { ...prev, [key]: { ...(prev[key] || {}), ...patch, updatedAt: new Date().toISOString() } };
      writeReviews(next);
      return next;
    });
  }, []);

  const openRadar = useCallback((ev, audit) => {
    const detail = {
      page: "eventos",
      openPlaybook: true,
      embeddedPlaybookOnly: true,
      evento: inferRadarEvent(ev, audit),
      eventoOriginal: ev?.evento || ev?.situacaoDesc || "",
      codigo: ev?.cod || ev?.codigo || "",
      colaborador: ev?.nome || "",
      matricula: ev?.mat || "",
      data: normDateKey(ev?.data || ev?.date || ev?.data_referencia),
    };
    if (typeof onOpenRadar === "function") onOpenRadar(detail);
  }, [onOpenRadar]);

  const toggleSort = useCallback((key) => {
    setSortConfig((prev) => {
      if (prev.key !== key) return { key, dir: "asc" };
      return { key, dir: prev.dir === "asc" ? "desc" : "asc" };
    });
  }, []);

  const handleRuleChange = useCallback((value) => {
    setRule(value);
    if (value) {
      setSeverity("todos");
      setCategory("");
    }
  }, []);

  if (!open) return null;

  return createPortal(
    <div className="pb-audit-fast-overlay" data-theme={theme} role="dialog" aria-modal="true" aria-label="Auditoria de ponto">
      <section className="pb-audit-fast-modal">
        <header className="pb-audit-fast-head">
          <div>
            <h2>{title}</h2>
            <p>{shownEvents.toLocaleString("pt-BR")} de {periodStats.summary.total.toLocaleString("pt-BR")} eventos</p>
          </div>
          <div className="pb-audit-fast-head-actions">
            <button type="button" onClick={onOpenParams}>Parâmetros</button>
            <button type="button" onClick={onClose} aria-label="Fechar">×</button>
          </div>
        </header>

        <div className="pb-audit-fast-pills">
          <button type="button" className={!category ? "active" : ""} onClick={() => setCategory("")}>Todos <b>{periodStats.summary.total.toLocaleString("pt-BR")}</b></button>
          <button type="button" className={`is-auditoria${category === "__auditoria__" ? " active" : ""}`} onClick={() => setCategory("__auditoria__")}>
            <span>Auditoria</span>
            <b>{(periodStats.summary.total - (periodStats.summary.ok || 0)).toLocaleString("pt-BR")}</b>
          </button>
          {categoryEntries.map(([key, count]) => (
            <button type="button" key={key} className={category === key ? "active" : ""} onClick={() => setCategory(key)}>
              <span>{formatCategoryLabel(key)}</span>
              <b>{count.toLocaleString("pt-BR")}</b>
            </button>
          ))}
        </div>

        <div className="pb-audit-fast-toolbar">
          <div className="pb-audit-fast-period">
            <label>
              <span>DE</span>
              <input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} />
            </label>
            <label>
              <span>ATE</span>
              <input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} />
            </label>
            <button
              type="button"
              onClick={() => {
                setAppliedDateFrom(normDateKey(dateFrom) || "");
                setAppliedDateTo(normDateKey(dateTo) || "");
              }}
            >
              OK
            </button>
          </div>
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar colaborador, matrícula, evento, regra..."
          />
          <select value={status} onChange={(e) => setStatus(e.target.value)}>
            <option value="todos">Status: todos</option>
            <option value="pendente_acao">Pendentes de decisão</option>
            <option value="pendente">Pendentes</option>
            <option value="sem_acao">Sem ação</option>
            <option value="revisado">Revisado</option>
            <option value="justificado">Justificado</option>
            <option value="ajuste">Corrigir folha</option>
          </select>
          <select value={rule} onChange={(e) => handleRuleChange(e.target.value)}>
            <option value="">Regra acionada: todas do resultado</option>
            {periodStats.ruleOptions.map((item) => (
              <option key={item.codigo} value={item.codigo}>
                {item.label} ({item.count})
              </option>
            ))}
          </select>
          <button
            type="button"
            className={`pb-audit-fast-column-filter-toggle${hasActiveColumnFilters(columnFilters) ? " active" : ""}`}
            onClick={() => setShowColumnFilters((value) => !value)}
          >
            Filtros de colunas
          </button>
        </div>

        {showColumnFilters ? (
          <div className="pb-audit-fast-column-filter-panel">
            {COLUMN_DEFS.map((col) => (
              col.key === "horas" ? (
                <label key={col.key} className="pb-audit-fast-hours-filter">
                  <span>{col.label}</span>
                  <div>
                    <select
                      value={columnFilters.horasOp || "="}
                      onChange={(e) => setColumnFilters((prev) => ({ ...prev, horasOp: e.target.value }))}
                    >
                      <option value="=">=</option>
                      <option value="<">&lt;</option>
                      <option value=">">&gt;</option>
                      <option value="<=">&lt;=</option>
                      <option value=">=">&gt;=</option>
                      <option value="entre">Entre</option>
                    </select>
                    <input
                      value={columnFilters.horas || ""}
                      onChange={(e) => setColumnFilters((prev) => ({ ...prev, horas: e.target.value }))}
                      placeholder="Ex. 8:00"
                    />
                    {columnFilters.horasOp === "entre" ? (
                      <input
                        value={columnFilters.horasFim || ""}
                        onChange={(e) => setColumnFilters((prev) => ({ ...prev, horasFim: e.target.value }))}
                        placeholder="Ate"
                      />
                    ) : null}
                  </div>
                </label>
              ) : (
                <label key={col.key}>
                  <span>{col.label}</span>
                  <input
                    value={columnFilters[col.key] || ""}
                    onChange={(e) => setColumnFilters((prev) => ({ ...prev, [col.key]: e.target.value }))}
                    placeholder="Contém..."
                  />
                </label>
              )
            ))}
            <button type="button" onClick={() => setColumnFilters(emptyColumnFilters())}>Limpar</button>
          </div>
        ) : null}

        <div className="pb-audit-fast-table-wrap" aria-busy={busy ? "true" : undefined}>
          {busy ? <div className="pb-audit-fast-busy">Processando...</div> : null}
          <table className="pb-audit-fast-table">
            <colgroup>
              <col style={{ width: 150 }} />
              <col />
              <col style={{ width: 115 }} />
              <col style={{ width: 520 }} />
              <col style={{ width: 420 }} />
            </colgroup>
            <thead>
              <tr>
                <th>
                  <button type="button" className={`pb-audit-fast-th-sort${hasActiveColumnFilter(columnFilters, "data") ? " is-filtered" : ""}`} onClick={() => toggleSort("data")}>
                    <span>Data</span>
                    <i>{sortConfig.key === "data" ? (sortConfig.dir === "asc" ? "▲" : "▼") : "↕"}</i>
                  </button>
                </th>
                <th>
                  <button type="button" className={`pb-audit-fast-th-sort${hasActiveColumnFilter(columnFilters, "evento") ? " is-filtered" : ""}`} onClick={() => toggleSort("evento")}>
                    <span>Evento</span>
                    <i>{sortConfig.key === "evento" ? (sortConfig.dir === "asc" ? "▲" : "▼") : "↕"}</i>
                  </button>
                </th>
                <th>
                  <button type="button" className={`pb-audit-fast-th-sort${hasActiveColumnFilter(columnFilters, "horas") ? " is-filtered" : ""}`} onClick={() => toggleSort("horas")}>
                    <span>Horas</span>
                    <i>{sortConfig.key === "horas" ? (sortConfig.dir === "asc" ? "▲" : "▼") : "↕"}</i>
                  </button>
                </th>
                <th>
                  <button type="button" className={`pb-audit-fast-th-sort${hasActiveColumnFilter(columnFilters, "marcacao") ? " is-filtered" : ""}`} onClick={() => toggleSort("marcacao")}>
                    <span>Horário / Marcação</span>
                    <i>{sortConfig.key === "marcacao" ? (sortConfig.dir === "asc" ? "▲" : "▼") : "↕"}</i>
                  </button>
                </th>
                <th>
                  <button type="button" className={`pb-audit-fast-th-sort${hasActiveColumnFilter(columnFilters, "auditoria") ? " is-filtered" : ""}`} onClick={() => toggleSort("auditoria")}>
                    <span>Auditoria</span>
                    <i>{sortConfig.key === "auditoria" ? (sortConfig.dir === "asc" ? "▲" : "▼") : "↕"}</i>
                  </button>
                </th>
              </tr>
              <tr className="pb-audit-fast-filter-row">
                {COLUMN_DEFS.map((col) => (
                  <th key={`${col.key}-filter`}>
                    <input
                      value={columnFilters[col.key] || ""}
                      onChange={(e) => setColumnFilters((prev) => ({ ...prev, [col.key]: e.target.value }))}
                      placeholder={`Filtrar ${col.label.toLowerCase()}`}
                    />
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {pageGroups.map((group) => {
                const dayCounts = group.items.reduce((acc, item) => {
                  const date = normDateKey(item.ev?.data);
                  acc.set(date, (acc.get(date) || 0) + 1);
                  return acc;
                }, new Map());
                return (
                  <React.Fragment key={group.key}>
                    <tr className="pb-audit-fast-group-row">
                      <td colSpan={5}>
                        <strong>{group.mat}{group.nome ? ` - ${group.nome}` : ""}</strong>
                        {group.depto ? <span>Depto: {group.depto}</span> : null}
                        <em>{group.items.length.toLocaleString("pt-BR")} eventos exibidos</em>
                        {group.summary.pendente ? <b className="is-pendente">Pend. {group.summary.pendente}</b> : null}
                        {group.summary.pendente ? null : group.summary.semAcao ? <b className="is-sem-acao">Sem ação {group.summary.semAcao}</b> : null}
                        {group.summary.pendente || group.summary.semAcao ? null : group.summary.ok ? <b className="is-ok">OK {group.summary.ok}</b> : null}
                      </td>
                    </tr>
                    {group.items.map((item, idx) => {
                      const ev = item.ev;
                      const date = normDateKey(ev?.data);
                      const prev = idx > 0 ? group.items[idx - 1]?.ev : null;
                      const startsDay = idx === 0 || normDateKey(prev?.data) !== date;
                      const multiDay = startsDay && (dayCounts.get(date) || 0) > 1;
                      const obs = prettifyAuditText(String(item.audit?.observacao || "").replace(/^(Critica|Critica|Alta|Media|Baixa|OK):\s*/i, ""));
                      const reviewStatus = item.review.status || "pendente";
                      return (
                        <tr key={`${group.key}-${date}-${idx}-${ev?.cod || ""}`} className={multiDay ? "pb-audit-fast-day-start" : ""}>
                          <td>
                            {startsDay ? (
                              <span className="pb-audit-fast-date">
                                <strong>{fmtDateShort(date)}</strong>
                                <small>{fmtWeekdayShort(date)}</small>
                              </span>
                            ) : null}
                          </td>
                          <td className="pb-audit-fast-event-text">{ev?.cod ? `${ev.cod} - ` : ""}{ev?.evento || ev?.situacaoDesc || "Evento sem descrição"}</td>
                          <td className="pb-audit-fast-hours">{fmtMinutes(ev?.horas)}</td>
                          <td>{startsDay ? <MarkStack ev={ev} tolerance={params?.toleranciaMinutos || 0} /> : null}</td>
                          <td className={`pb-audit-fast-audit is-${item.severity || "ok"}`}>
                            {item.audit?.memoria ? (
                              <div>
                                <button type="button" className="pb-audit-fast-message" onClick={() => setMemory({ item, group })}>
                                  {item.audit?.tratamentoRegra !== "informativa" && (
                                    <span>{SEVERITY_BADGE_LABEL[item.severity] || SEVERITY_LABEL[item.severity] || item.severity}</span>
                                  )}
                                  {item.audit?.tratamentoRegra !== "informativa" && <i>{reviewStatus.replace("_", " ")}</i>}
                                  <b>{obs}</b>
                                </button>
                                {item.audit?.tratamentoRegra !== "informativa" && (
                                <details>
                                  <summary>Ações</summary>
                                  <div>
                                    <button type="button" onClick={() => setMemory({ item, group })}>Memória</button>
                                    {(item.audit?.tratamentoRegra === "acao" || item.audit?.tratamentoRegra === "revisao_manual" || !item.audit?.tratamentoRegra) && (
                                      <button type="button" onClick={() => updateReview(item.reviewKey, { status: "revisado" })}>Revisar</button>
                                    )}
                                    {(!item.audit?.tratamentoRegra || item.audit?.tratamentoRegra === "acao") && (
                                      <>
                                        <button type="button" onClick={() => updateReview(item.reviewKey, { status: "justificado" })}>Justificar</button>
                                        <button type="button" onClick={() => updateReview(item.reviewKey, { status: "ajuste" })}>Corrigir</button>
                                      </>
                                    )}
                                    {item.audit?.tratamentoRegra !== "informativa" && (
                                      <button type="button" onClick={() => updateReview(item.reviewKey, { status: "sem_acao" })}>Sem ação</button>
                                    )}
                                  </div>
                                </details>
                                )}
                              </div>
                            ) : item.audit?.radarTrabalhista ? (
                              <button type="button" className="pb-audit-fast-radar" onClick={() => openRadar(ev, item.audit)}>
                                <span>RADAR</span> Risco trabalhista. Consulte o Radar.
                              </button>
                            ) : (
                              <span className="pb-audit-fast-ok">-</span>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </React.Fragment>
                );
              })}
              {!pageGroups.length ? (
                <tr>
                  <td colSpan={5} className="pb-audit-fast-empty">
                    Nenhum evento encontrado para os filtros atuais.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>

        <footer className="pb-audit-fast-footer">
          <span>
            Colaboradores {filteredGroups.length ? ((currentPage - 1) * PAGE_SIZE + 1).toLocaleString("pt-BR") : 0}
            -{Math.min(currentPage * PAGE_SIZE, filteredGroups.length).toLocaleString("pt-BR")} de {filteredGroups.length.toLocaleString("pt-BR")}
          </span>
          <div>
            <button type="button" disabled={currentPage <= 1} onClick={() => setPage(1)}>Primeira</button>
            <button type="button" disabled={currentPage <= 1} onClick={() => setPage((p) => Math.max(1, p - 1))}>Anterior</button>
            <strong>{currentPage.toLocaleString("pt-BR")} / {totalPages.toLocaleString("pt-BR")}</strong>
            <button type="button" disabled={currentPage >= totalPages} onClick={() => setPage((p) => Math.min(totalPages, p + 1))}>Próxima</button>
          </div>
        </footer>

        {memory ? (
          <div className="pb-audit-fast-memory" role="dialog" aria-modal="true">
            <section>
              <header>
                <div>
                  <strong>Memória de cálculo</strong>
                  <span>{memory.item.audit?.regraAplicada || memory.item.audit?.codigo || memory.item.audit?.observacao}</span>
                </div>
                <button type="button" onClick={() => setMemory(null)}>×</button>
              </header>
              <div className="pb-audit-fast-memory-grid">
                <span><b>Colaborador</b>{memory.group.mat} - {memory.group.nome}</span>
                <span><b>Data</b>{fmtDateBr(normDateKey(memory.item.ev?.data))}</span>
                <span><b>Evento</b>{memory.item.ev?.cod ? `${memory.item.ev.cod} - ` : ""}{memory.item.ev?.evento}</span>
                <span><b>Horas</b>{fmtMinutes(memory.item.ev?.horas)}</span>
              </div>
              <MarkStack ev={memory.item.ev} tolerance={params?.toleranciaMinutos || 0} />
              {Array.isArray(memory.item.audit?.anomalias) && memory.item.audit.anomalias.map((anomalia, idx) => (
                <div key={idx} className="pb-audit-fast-anomalia">
                  <div className="pb-audit-fast-anomalia-head">
                    <span className={`pb-audit-fast-sev is-${anomalia.severity}`}>
                      {SEVERITY_LABEL[anomalia.severity] || anomalia.severity}
                    </span>
                    <strong>{anomalia.message}</strong>
                  </div>
                  {anomalia.details ? (
                    <p className="pb-audit-fast-anomalia-details">{anomalia.details}</p>
                  ) : null}
                  {Array.isArray(anomalia.memoria) && anomalia.memoria.length > 0 ? (
                    <ul className="pb-audit-fast-anomalia-memoria">
                      {anomalia.memoria.map((step, i) => <li key={i}>{step}</li>)}
                    </ul>
                  ) : null}
                </div>
              ))}
            </section>
          </div>
        ) : null}
      </section>
    </div>,
    document.body,
  );
}

export default AuditoriaPontoFastModal;
