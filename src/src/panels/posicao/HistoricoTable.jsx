import React, { useState, useMemo, useCallback, useEffect, useLayoutEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { PosicaoApi } from "../../api/posicaoApi.js";
import { CONFIG } from "../../config.js";
import { getDateMeta, normDateKey } from "./calendarUtils";
import { EmpFilter } from "./EmpFilter";
import { HistoricoDayModal } from "./HistoricoDayModal.jsx";
import { EmpPresenceModal } from "./EmpPresenceModal.jsx";
import { RadarKpiModal } from "./RadarKpiModal.jsx";
import {
  calculateAbsenteismoPct,
  capWorkedHours,
  enrichHistDayRow,
  computePeriodTotals,
} from "./radarHoursUtils.js";
import { isArt473PreventivaEvent } from "./saudePreventivaArt473.js";
import { resolveVisibleColSet } from "./posicaoHdmEmbeddedCols.js";
import { normalizePositionEmployeesFromDay } from "./domain/positionRows.js";
import "./HistoricoDayModal.css";

const HIST_TABLE_COLS_KEY = "pb_historico_table_cols_v1";
const HIST_FLOAT_LAYOUT_KEY = "pb_historico_float_layout_v1";

function readHistTableColState() {
  try {
    const raw = localStorage.getItem(HIST_TABLE_COLS_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function writeHistTableColState(state) {
  try {
    localStorage.setItem(HIST_TABLE_COLS_KEY, JSON.stringify(state));
  } catch {
    // ignore quota / private mode
  }
}

function readHistFloatLayout() {
  try {
    const raw = localStorage.getItem(HIST_FLOAT_LAYOUT_KEY);
    const parsed = raw ? JSON.parse(raw) : null;
    if (!parsed || typeof parsed !== "object") return null;
    return parsed;
  } catch {
    return null;
  }
}

function writeHistFloatLayout(layout) {
  try {
    localStorage.setItem(HIST_FLOAT_LAYOUT_KEY, JSON.stringify(layout));
  } catch {
    // ignore quota / private mode
  }
}

function fmtPct(pct) {
  if (pct == null || isNaN(pct)) return "—";
  return Number(pct).toFixed(1) + "%";
}
function fmtMin(min) {
  if (min == null || isNaN(min)) return "—";
  const v = Math.round(Number(min));
  if (v < 0) return "—";
  return Math.floor(v / 60).toLocaleString("pt-BR") + ":" + String(v % 60).padStart(2, "0");
}

/* ── Column definitions ── */
const COL_DEFS = [
  { id: "date", label: "Data", sortKey: "date", group: null, numeric: false, always: true },
  {
    id: "hrs_plan",
    label: "Planejadas",
    sortKey: "hrs_plan",
    group: "horas",
    numeric: true,
    needsHours: true,
  },
  {
    id: "hrs_trab",
    label: "Trabalhadas",
    sortKey: "hrs_trab",
    group: "horas",
    numeric: true,
    needsHours: true,
  },
  {
    id: "hrs_perd",
    label: "Perdidas",
    sortKey: "hrs_perd",
    group: "horas",
    numeric: true,
    needsHours: true,
  },
  {
    id: "hrs_pct",
    label: "% Perda",
    sortKey: "hrs_pct",
    group: "horas",
    numeric: true,
    needsHours: true,
  },
  {
    id: "abs_idx",
    label: "Absenteísmo",
    sortKey: "abs_idx",
    group: "horas",
    numeric: true,
    needsHours: true,
  },
  {
    id: "pres",
    label: "Presentes",
    prefix: "Quant.",
    sortKey: "presentes",
    group: "presenca",
    numeric: true,
  },
  {
    id: "ause_qtd",
    label: "Ausentes",
    prefix: "Quant.",
    sortKey: "ausentes",
    group: "ausentes",
    numeric: true,
  },
  {
    id: "ause_hrs",
    label: "Ausentes",
    prefix: "Horas",
    sortKey: "ausentes",
    group: "ausentes",
    numeric: true,
    needsHours: true,
  },
  {
    id: "just_qtd",
    label: "Justificadas",
    prefix: "Quant.",
    sortKey: "justificadas",
    group: "just",
    numeric: true,
  },
  {
    id: "just_hrs",
    label: "Justificadas",
    prefix: "Horas",
    sortKey: "justificadas",
    group: "just",
    numeric: true,
    needsHours: true,
  },
  {
    id: "extr_qtd",
    label: "Extras",
    prefix: "Quant.",
    sortKey: "extras",
    group: "extras",
    numeric: true,
    needsExtras: true,
  },
  {
    id: "extr_hrs",
    label: "Extras",
    prefix: "Horas",
    sortKey: "extras",
    group: "extras",
    numeric: true,
    needsHours: true,
    needsExtras: true,
  },
];

const HIST_COL_DEFAULT_WIDTHS = {
  date: 148,
  hrs_plan: 86,
  hrs_trab: 86,
  hrs_perd: 78,
  hrs_pct: 72,
  abs_idx: 92,
  pres: 78,
  ause_qtd: 78,
  ause_hrs: 86,
  just_qtd: 88,
  just_hrs: 86,
  extr_qtd: 72,
  extr_hrs: 78,
};

function histColMinWidth(colId) {
  return colId === "date" ? 100 : 64;
}

function employeesFromDayPayload(day) {
  return normalizePositionEmployeesFromDay(day);
}

/* dir:'bad' → high value = red | dir:'good' → high value = green | dir:'warn' → high = yellow */
const HEATMAP_CFG = {
  hrs_pct: { dir: "bad", get: (r) => r._pctPerdidas },
  abs_idx: { dir: "bad", get: (r) => r._absenteismo },
  pres: { dir: "good", get: (r) => r.presentesPct },
  ause_qtd: { dir: "bad", get: (r) => r._ausentes },
  ause_hrs: { dir: "bad", get: (r) => r._horasAusentes },
  just_qtd: { dir: "warn", get: (r) => r.justificadas },
  just_hrs: { dir: "warn", get: (r) => r.horas_justificadas },
};

const GRP_CLS = {
  horas: "col-hrs",
  presenca: "col-pres",
  ausentes: "col-ause",
  just: "col-just",
  extras: "col-extr",
};

const GROUP_BY_OPTIONS = [
  { value: "none", label: "Sem agrupamento" },
  { value: "mes", label: "Por mês" },
  { value: "semana", label: "Por semana" },
  { value: "diasemana", label: "Dia da semana" },
];

function getGroupKey(date, groupBy) {
  if (groupBy === "mes") return date.slice(0, 7);
  if (groupBy === "semana") {
    const d = new Date(date + "T00:00:00");
    const thu = new Date(d);
    thu.setDate(d.getDate() - ((d.getDay() + 6) % 7) + 3);
    const jan4 = new Date(thu.getFullYear(), 0, 4);
    const wk = 1 + Math.round((thu - jan4) / 604800000);
    return `${thu.getFullYear()}-W${String(wk).padStart(2, "0")}`;
  }
  if (groupBy === "diasemana") {
    return String(new Date(date + "T00:00:00").getDay());
  }
  return null;
}

function formatGroupLabel(key, groupBy) {
  if (groupBy === "mes") {
    const [y, m] = key.split("-");
    return (
      ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"][
        parseInt(m) - 1
      ] +
      " " +
      y
    );
  }
  if (groupBy === "semana") {
    const [year, wPart] = key.split("-W");
    const wNum = parseInt(wPart, 10);
    // ISO week start (Monday): find Jan 4 of the year, get its Thursday week
    const jan4 = new Date(parseInt(year, 10), 0, 4);
    const thu = new Date(jan4);
    thu.setDate(jan4.getDate() - ((jan4.getDay() + 6) % 7) + 3);
    const weekStart = new Date(thu);
    weekStart.setDate(thu.getDate() - 3 + (wNum - 1) * 7);
    const weekEnd = new Date(weekStart);
    weekEnd.setDate(weekStart.getDate() + 6);
    const fmt2 = (d) =>
      `${String(d.getDate()).padStart(2, "0")}/${String(d.getMonth() + 1).padStart(2, "0")}`;
    return `Semana ${wNum} · ${fmt2(weekStart)}–${fmt2(weekEnd)}`;
  }
  if (groupBy === "diasemana") {
    return ["Domingo", "Segunda", "Terça", "Quarta", "Quinta", "Sexta", "Sábado"][parseInt(key)];
  }
  return key;
}

function cleanGroupText(value, fallback) {
  const s = String(value ?? "").trim();
  if (!s) return fallback;
  if (/^[.\-–—_\s]+$/.test(s)) return fallback;
  if (/^(null|undefined|nan|n\/a|na)$/i.test(s)) return fallback;
  return s;
}

/** Agrupa evento importado por descrição do CID (fallback: código CID). */
function cidEventGroupLabel(ev) {
  const desc = cleanGroupText(ev?.cidDescricao, "");
  const cod = cleanGroupText(ev?.cid, "");
  if (desc) return desc;
  if (cod) return `CID ${cod}`;
  return "Sem CID";
}

/** Agrupa eventos da categoria Risco Trab. pelo nome do evento. */
function riskEventGroupLabel(ev) {
  return cleanGroupText(ev?.evento, "Sem evento");
}

function riskDeptLabel(ev) {
  return cleanGroupText(ev?.depto_desc || ev?.depto, "Sem departamento");
}

function riskColaboradorKey(ev) {
  return cleanGroupText(ev?.mat || ev?.nome, "—");
}

function eventGroupLabel(ev) {
  return cleanGroupText(ev?.evento || ev?.situacaoDesc || ev?.cod, "Sem evento");
}

function eventGroupCode(ev) {
  return cleanGroupText(ev?.cod || ev?.codigo || "", "");
}

function eventCategoryLabel(cat) {
  const key = String(cat || "").toLowerCase();
  if (key === "presentes") return "Presentes";
  if (key === "ausentes") return "Ausentes";
  if (key === "justificadas") return "Justificadas";
  if (key === "extras") return "Extras";
  if (key === "risco") return "Risco Trab.";
  return "Outros";
}

function eventRowKey(ev) {
  return [eventGroupLabel(ev), eventGroupCode(ev), eventCategoryLabel(ev?._cat)].join("|||");
}

function collaboratorKey(record) {
  return cleanGroupText(record?.mat || record?.matricula || record?.nome, "Sem identificacao");
}

function eventsDateRange(events) {
  let from = "";
  let to = "";
  for (const ev of events || []) {
    const dk = normDateKey(ev?.data);
    if (!dk) continue;
    if (!from || dk < from) from = dk;
    if (!to || dk > to) to = dk;
  }
  return { from, to };
}

function computeAggregateHourMetrics(r) {
  const hp = Number(r?.horas_planejadas) || 0;
  const ht = capWorkedHours(r?.horas_presentes, hp);
  const horasPerdidas = hp > 0 ? Math.max(0, hp - ht) : 0;
  const horasEventos =
    (Number(r?.horas_ausentes) || 0) + (Number(r?.horas_justificadas) || 0);
  const horasAbsenteismo = horasEventos;
  return {
    horas_perdidas: hp > 0 ? horasPerdidas : null,
    pct_perdidas: hp > 0 ? (horasPerdidas / hp) * 100 : null,
    absenteismo: calculateAbsenteismoPct({
      horasAbs: horasAbsenteismo,
      horasPlan: hp,
      precision: null,
    }),
    _horasAbsenteismo: horasAbsenteismo,
  };
}

function computeGroupedTotals(rows) {
  const hp = rows.reduce((s, r) => s + (Number(r.horas_planejadas) || 0), 0);
  const ht = rows.reduce((s, r) => s + capWorkedHours(r.horas_presentes, r.horas_planejadas), 0);
  const ha = rows.reduce((s, r) => s + (Number(r.horas_ausentes) || 0), 0);
  const hj = rows.reduce((s, r) => s + (Number(r.horas_justificadas) || 0), 0);
  const he = rows.reduce((s, r) => s + (Number(r.horas_extras) || 0), 0);
  const base = computeAggregateHourMetrics({
    horas_planejadas: hp,
    horas_presentes: ht,
    horas_ausentes: ha,
    horas_justificadas: hj,
  });
  return { hp, ht, ha, hj, he, base };
}

function computeTotals(rows, hasHours, hasExtras) {
  const period = hasHours ? computePeriodTotals(rows) : null;
  const hp = hasHours ? period.horasPlan : null;
  const ht = hasHours ? period.horasPres : null;
  const pres = rows.reduce((s, r) => s + (r.presentes || 0), 0);
  const presPct = rows.length
    ? +(rows.reduce((s, r) => s + r.presentesPct, 0) / rows.length).toFixed(1)
    : 0;
  return {
    presentes: pres,
    presentesPctAvg: presPct,
    horas_planejadas: hp,
    horas_presentes: ht,
    horas_perdidas: hasHours ? period.horasPerdidas : null,
    pct_perdidas: hasHours ? period.perdaPct : null,
    absenteismo: hasHours ? period.absPct : null,
    ausentes: rows.reduce((s, r) => s + r._ausentes, 0),
    horas_ausentes: hasHours ? period.horasAus : null,
    justificadas: rows.reduce((s, r) => s + (r.justificadas || 0), 0),
    horas_justificadas: hasHours ? period.horasJust : null,
    extras: hasExtras ? rows.reduce((s, r) => s + (r.extras || 0), 0) : null,
    horas_extras: hasExtras ? period?.horasExtras ?? rows.reduce((s, r) => s + (r.horas_extras || 0), 0) : null,
  };
}

function metricValue(row, metricFilter) {
  if (metricFilter === "injustificadas") {
    return (
      (Number(row?._ausentes ?? row?.ausentes ?? row?.qtd_ausentes) || 0) +
      (Number(row?.horas_ausentes ?? row?.hrs_ausentes) || 0)
    );
  }
  if (metricFilter === "justificadas") {
    return (
      (Number(row?.justificadas ?? row?.qtd_justificadas) || 0) +
      (Number(row?.horas_justificadas ?? row?.hrs_justificadas) || 0)
    );
  }
  if (metricFilter === "extras") {
    return (
      (Number(row?.extras ?? row?.qtd_extras) || 0) +
      (Number(row?.horas_extras ?? row?.hrs_extras) || 0)
    );
  }
  return 1;
}

function matchesMetricFilter(row, metricFilter) {
  return !metricFilter || metricValue(row, metricFilter) > 0;
}

function filterMetricRows(rows, metricFilter) {
  return metricFilter ? rows.filter((row) => matchesMetricFilter(row, metricFilter)) : rows;
}

export function HistoricoTable({
  histRows,
  theme = "dark",
  dateFrom = "",
  dateTo = "",
  deptHistRows = null,
  onDateFromChange,
  onDateToChange,
  ctrlEl = null,
  selectedEmp: selectedEmpProp = null,
  onEmpChange = null,
  empList: empListProp = null,
  isFloating: isFloatingProp = null,
  onFloatChange = null,
  onFloatMinimize = null,
  onFloatClose = null,
  openDateRequest = null,
  periodoApuracao = null,
  highlightCol = null,
  metricFilter = null,
  tableViewRequest = null,
  embeddedInChart = false,
  absMeta = 5,
}) {
  /* ── export loading ── */
  const [exportBusy, setExportBusy] = useState(null); // { label } | null

  const runExport = useCallback((label, fn) => {
    setExportBusy({ label });
    requestAnimationFrame(() => {
      setTimeout(async () => {
        try {
          await fn();
        } catch (e) {
          console.error(e);
        } finally {
          setExportBusy(null);
        }
      }, 30);
    });
  }, []);

  /* ── sort ── */
  const [sortCol, setSortCol] = useState("date");
  const [sortDir, setSortDir] = useState("asc");
  const [deptSortCol, setDeptSortCol] = useState("absenteismo");
  const [deptSortDir, setDeptSortDir] = useState("desc");
  const [cargoSortCol, setCargoSortCol] = useState("absenteismo");
  const [cargoSortDir, setCargoSortDir] = useState("desc");
  const [generoSortCol, setGeneroSortCol] = useState("absenteismo");
  const [generoSortDir, setGeneroSortDir] = useState("desc");
  const [cidSortCol, setCidSortCol] = useState("eventos");
  const [cidSortDir, setCidSortDir] = useState("desc");
  const [riskSortCol, setRiskSortCol] = useState("eventos");
  const [riskSortDir, setRiskSortDir] = useState("desc");
  const [eventSortCol, setEventSortCol] = useState("eventos");
  const [eventSortDir, setEventSortDir] = useState("desc");
  const [colabSortCol, setColabSortCol] = useState("absenteismo");
  const [colabSortDir, setColabSortDir] = useState("desc");
  const MAX_DAYS = 360;
  const [dateDraftFrom, setDateDraftFrom] = useState(dateFrom || "");
  const [dateDraftTo, setDateDraftTo] = useState(dateTo || "");
  const dateFromRef = useRef(null);
  const dateToRef = useRef(null);
  const effectiveDateFrom = normDateKey(dateDraftFrom || dateFrom);
  const effectiveDateTo = normDateKey(dateDraftTo || dateTo);

  useEffect(() => {
    setDateDraftFrom(dateFrom || "");
  }, [dateFrom]);

  useEffect(() => {
    setDateDraftTo(dateTo || "");
  }, [dateTo]);

  const applyDateRange = useCallback(() => {
    const from = normDateKey(dateFromRef.current?.value || dateDraftFrom);
    const to = normDateKey(dateToRef.current?.value || dateDraftTo);
    setDateDraftFrom(from);
    setDateDraftTo(to);
    onDateFromChange?.(from);
    onDateToChange?.(to);
  }, [dateDraftFrom, dateDraftTo, onDateFromChange, onDateToChange]);

  const updateDateFrom = useCallback(
    (value) => {
      const v = value || "";
      setDateDraftFrom(v);
      if (
        dateDraftTo &&
        v &&
        (new Date(dateDraftTo) - new Date(v)) / 86400000 > MAX_DAYS
      ) {
        setDateDraftTo(addDays(v, MAX_DAYS));
      }
    },
    [dateDraftTo],
  );

  const updateDateTo = useCallback(
    (value) => {
      const v = value || "";
      setDateDraftTo(v);
      if (
        dateDraftFrom &&
        v &&
        (new Date(v) - new Date(dateDraftFrom)) / 86400000 > MAX_DAYS
      ) {
        setDateDraftFrom(addDays(v, -MAX_DAYS));
      }
    },
    [dateDraftFrom],
  );

  /* ── drilldown + day modal ── */
  const [expandedDates, setExpandedDates] = useState(() => new Set());
  const [expandedDepts, setExpandedDepts] = useState(() => new Set());
  const [expandedCargos, setExpandedCargos] = useState(() => new Set());
  const [expandedGeneros, setExpandedGeneros] = useState(() => new Set());
  const [expandedCids, setExpandedCids] = useState(() => new Set());
  const [expandedRisk, setExpandedRisk] = useState(() => new Set());
  const [expandedEvents, setExpandedEvents] = useState(() => new Set());
  const [expandedColabs, setExpandedColabs] = useState(() => new Set());
  const [dayModal, setDayModal] = useState(null);
  const [absTrendModal, setAbsTrendModal] = useState(null);
  const [presenceProfileRow, setPresenceProfileRow] = useState(null);

  /* ── grouping ── */
  const [groupBy, setGroupBy] = useState("none");
  const [collapsedGrp, setCollapsedGrp] = useState(() => new Set());

  /* ── column visibility + order ── */
  const [colOrder, setColOrder] = useState(() => COL_DEFS.map((c) => c.id));
  const [visibleCols, setVisibleCols] = useState(() => {
    const saved = readHistTableColState();
    const ids = COL_DEFS.map((c) => c.id);
    return resolveVisibleColSet(saved?.visible, saved?.catalog, ids);
  });
  const [colSelOpen, setColSelOpen] = useState(false);
  const colSelRef = useRef(null);
  const colBtnRef = useRef(null);
  const histThRefs = useRef({});
  const [colWidths, setColWidths] = useState(() => {
    const saved = readHistTableColState();
    const widths = saved?.widths;
    return widths && typeof widths === "object" && !Array.isArray(widths) ? widths : {};
  });

  /* ── floating / fullscreen (controlled or internal) ── */
  const [_isFloating, _setIsFloating] = useState(false);
  const isFloating = isFloatingProp !== null ? isFloatingProp : _isFloating;
  const setIsFloating = onFloatChange ?? _setIsFloating;

  const closeFloating = useCallback(() => {
    if (onFloatClose) onFloatClose();
    else setIsFloating(false);
  }, [onFloatClose, setIsFloating]);

  const minimizeFloating = useCallback(() => {
    closeFloating();
  }, [closeFloating]);
  const [floatPos, setFloatPos] = useState(() => {
    const saved = readHistFloatLayout();
    return saved?.pos && Number.isFinite(saved.pos.x) && Number.isFinite(saved.pos.y)
      ? saved.pos
      : { x: 60, y: 30 };
  });
  const [floatSize, setFloatSize] = useState(() => {
    const saved = readHistFloatLayout();
    return saved?.size && (Number.isFinite(saved.size.w) || Number.isFinite(saved.size.h))
      ? saved.size
      : { w: null, h: null };
  });
  const [floatMaximized, setFloatMaximized] = useState(() => readHistFloatLayout()?.maximized === true);
  const floatPanelRef = useRef(null);
  const dragRef = useRef(null); // { type:'drag'|'resize', startMX, startMY, startX, startY, startW, startH, dir }

  useEffect(() => {
    if (!isFloating) return;
    const move = (e) => {
      if (!dragRef.current) return;
      const { type, startMX, startMY, startX, startY, startW, startH, dir } = dragRef.current;
      if (type === "drag") {
        setFloatMaximized(false);
        setFloatPos({
          x: Math.max(0, startX + (e.clientX - startMX)),
          y: Math.max(0, startY + (e.clientY - startMY)),
        });
      } else {
        setFloatMaximized(false);
        const dx = e.clientX - startMX,
          dy = e.clientY - startMY;
        setFloatSize({
          w: Math.max(520, startW + (dir.includes("e") ? dx : dir.includes("w") ? -dx : 0)),
          h: Math.max(320, startH + (dir.includes("s") ? dy : dir.includes("n") ? -dy : 0)),
        });
      }
    };
    const up = () => {
      dragRef.current = null;
    };
    document.addEventListener("mousemove", move);
    document.addEventListener("mouseup", up);
    return () => {
      document.removeEventListener("mousemove", move);
      document.removeEventListener("mouseup", up);
    };
  }, [isFloating]);

  useEffect(() => {
    if (!isFloating) return;
    writeHistFloatLayout({
      pos: floatPos,
      size: floatSize,
      maximized: floatMaximized,
    });
  }, [floatMaximized, floatPos, floatSize, isFloating]);

  useEffect(() => {
    writeHistTableColState({
      visible: [...visibleCols],
      catalog: COL_DEFS.map((c) => c.id),
      widths: colWidths,
    });
  }, [visibleCols, colWidths]);

  /* ── employee filter (controlled via props or internal state) ── */
  const [_selectedEmp, _setSelectedEmp] = useState(null);
  const selectedEmp = onEmpChange ? selectedEmpProp : _selectedEmp;
  const setSelectedEmp = onEmpChange ?? _setSelectedEmp;

  /* ── date search ── */
  const [dateSearch, setDateSearch] = useState("");
  const [tableView, setTableView] = useState("date");
  const tableScrollRef = useRef(null);

  useEffect(() => {
    if (!highlightCol) return;
    setTableView("date");
    setVisibleCols((prev) => {
      const next = new Set(prev);
      next.add(highlightCol);
      return next;
    });
    const colDef = COL_DEFS.find((c) => c.id === highlightCol);
    if (colDef?.sortKey) {
      setSortCol(colDef.sortKey);
      setSortDir("desc");
    }
    const t = window.setTimeout(() => {
      const scrollEl = tableScrollRef.current;
      const target = scrollEl?.querySelector(`[data-col-id="${highlightCol}"]`);
      target?.scrollIntoView({ behavior: "smooth", block: "nearest", inline: "center" });
    }, 80);
    return () => window.clearTimeout(t);
  }, [highlightCol]);

  /* ── loading (date/filter transitions) ── */
  const [isPending, startTransition] = React.useTransition
    ? React.useTransition()
    : [false, (fn) => fn()];

  useEffect(() => {
    if (!colSelOpen) return;
    const h = (e) => {
      if (
        colSelRef.current &&
        !colSelRef.current.contains(e.target) &&
        colBtnRef.current &&
        !colBtnRef.current.contains(e.target)
      ) {
        setColSelOpen(false);
      }
    };
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, [colSelOpen]);

  const hasHours = histRows.some((r) => r.horas_presentes != null || r.horas_planejadas != null);
  const hasExtras = histRows.some((r) => r.horas_extras != null || r.extras != null);

  /*
   * Preserve the table layout after imports that contain only quantities.
   * Missing hour/extra values render as dashes instead of removing columns.
   */
  const availCols = COL_DEFS;

  /* visible + ordered columns */
  const visibleOrdered = useMemo(
    () =>
      colOrder
        .map((id) => COL_DEFS.find((c) => c.id === id))
        .filter((c) => c && (c.always || visibleCols.has(c.id))),
    [colOrder, visibleCols],
  );

  const histColWidth = useCallback(
    (colId) =>
      Math.max(
        histColMinWidth(colId),
        Number(colWidths[colId]) || HIST_COL_DEFAULT_WIDTHS[colId] || 80,
      ),
    [colWidths],
  );

  const histColWidthStyle = useCallback(
    (colId) => {
      const w = histColWidth(colId);
      return { width: w, minWidth: w, maxWidth: w, boxSizing: "border-box" };
    },
    [histColWidth],
  );

  const syncHistTotalsColumnWidths = useCallback(() => {
    const scrollEl = tableScrollRef.current;
    const table = scrollEl?.querySelector("table.pb-hist-table");
    if (!table) return;
    const headerCells = table.querySelectorAll("thead tr th");
    const footerCells = table.querySelectorAll("tfoot tr.totals-row td");
    if (!headerCells.length || headerCells.length !== footerCells.length) return;
    footerCells.forEach((td, index) => {
      const width = Math.round(headerCells[index].getBoundingClientRect().width);
      if (!width) return;
      td.style.width = `${width}px`;
      td.style.minWidth = `${width}px`;
      td.style.maxWidth = `${width}px`;
    });
  }, []);

  const syncHistTheadHeight = useCallback(() => {
    const scrollEl = tableScrollRef.current;
    const thead = scrollEl?.querySelector("table.pb-hist-table thead");
    if (!scrollEl || !thead) return;
    const height = Math.ceil(thead.getBoundingClientRect().height);
    if (height > 0) {
      scrollEl.style.setProperty("--pb-hist-thead-h", `${height}px`);
    }
  }, []);

  const histTableWidth = useMemo(
    () => visibleOrdered.reduce((sum, col) => sum + histColWidth(col.id), 0),
    [visibleOrdered, histColWidth],
  );

  const startHistColResize = useCallback(
    (colId, e) => {
      e.preventDefault();
      e.stopPropagation();
      const th = histThRefs.current[colId];
      const startX = e.clientX;
      const startW = th ? th.offsetWidth : histColWidth(colId);
      const minW = histColMinWidth(colId);
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
        syncHistTotalsColumnWidths();
        syncHistTheadHeight();
      };
      document.addEventListener("mousemove", move);
      document.addEventListener("mouseup", up);
      document.body.style.cursor = "col-resize";
      document.body.style.userSelect = "none";
    },
    [histColWidth, syncHistTotalsColumnWidths, syncHistTheadHeight],
  );

  const groupColDefaultWidth = useCallback((key) => {
    if (["dept", "cargo", "evento", "nome", "cidDescricao"].includes(key)) return 260;
    if (["categoria", "filial"].includes(key)) return 150;
    if (["codigo", "cidCodigo", "mat", "genero"].includes(key)) return 96;
    if (String(key || "").includes("horas")) return 116;
    if (["absenteismo", "pct_perdidas"].includes(key)) return 112;
    return 104;
  }, []);

  const groupColMinWidth = useCallback((key) => {
    if (["dept", "cargo", "evento", "nome", "cidDescricao"].includes(key)) return 150;
    if (["categoria", "filial"].includes(key)) return 100;
    return 72;
  }, []);

  const groupColId = useCallback((view, key) => `grp:${view}:${key}`, []);

  const groupColWidth = useCallback(
    (view, key) => {
      const id = groupColId(view, key);
      return Math.max(
        groupColMinWidth(key),
        Number(colWidths[id]) || groupColDefaultWidth(key),
      );
    },
    [colWidths, groupColDefaultWidth, groupColId, groupColMinWidth],
  );

  const groupColWidthStyle = useCallback(
    (view, key) => {
      const w = groupColWidth(view, key);
      return { width: w, minWidth: w, maxWidth: w, boxSizing: "border-box" };
    },
    [groupColWidth],
  );

  const startGroupColResize = useCallback(
    (view, key, e) => {
      e.preventDefault();
      e.stopPropagation();
      const colId = groupColId(view, key);
      const th = e.currentTarget.closest("th");
      const startX = e.clientX;
      const startW = th ? th.offsetWidth : groupColWidth(view, key);
      const minW = groupColMinWidth(key);
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
    [groupColId, groupColMinWidth, groupColWidth],
  );

  function groupSortHeader(view, label, key, className, active, dir, toggle) {
    return (
      <th
        className={`pb-th-resizable ${className || ""}`}
        style={groupColWidthStyle(view, key)}
      >
        <button
          type="button"
          className={`pb-th-sort${active ? " active" : ""}`}
          onClick={() => toggle(key)}
        >
          <span className="pb-th-label notranslate" translate="no">
            {label}
          </span>
          <span className="pb-th-arrow" aria-hidden="true">
            {active ? (dir === "asc" ? "▲" : "▼") : "⇅"}
          </span>
        </button>
        <span
          className="pb-col-resizer"
          role="separator"
          aria-orientation="vertical"
          onMouseDown={(e) => startGroupColResize(view, key, e)}
        />
      </th>
    );
  }

  /* which column IDs are the first of their group (for col-start border) */
  const firstOfGroup = useMemo(() => {
    const seen = new Set();
    const result = new Set();
    for (const col of visibleOrdered) {
      if (col.group && !seen.has(col.group)) {
        seen.add(col.group);
        result.add(col.id);
      }
    }
    return result;
  }, [visibleOrdered]);

  const bestIdx = useMemo(
    () => histRows.reduce((bi, r, i) => (r.presentesPct > histRows[bi].presentesPct ? i : bi), 0),
    [histRows],
  );
  const worstIdx = useMemo(
    () => histRows.reduce((wi, r, i) => (r.presentesPct < histRows[wi].presentesPct ? i : wi), 0),
    [histRows],
  );

  /* enrich rows */
  const enriched = useMemo(
    () =>
      histRows.map((r, origIdx) => {
        const e = enrichHistDayRow(r);
        const ausentes = e.ausentes;
        const hp = r.horas_planejadas;
        const horasAusentes = e.horasAusentes;
        const horasPerdidas = e.horasPerdidas;
        const pctPerdidas =
          horasPerdidas != null && hp != null && hp > 0 ? (horasPerdidas / hp) * 100 : null;
        const horasAbsenteismo = e.horasAbsenteismo;
        const absenteismo = e.absenteismo;
        const normalizedDate = normDateKey(r.date || r.data_referencia || r.data);
        const meta = getDateMeta(normalizedDate);
        return {
          ...r,
          date: normalizedDate,
          _label: meta ? `${meta.dowLabel} ${meta.label}` : r.date,
          _meta: meta,
          _ausentes: ausentes,
          _horasAusentes: horasAusentes,
          _horasPerdidas: horasPerdidas,
          _pctPerdidas: pctPerdidas,
          _horasAbsenteismo: horasAbsenteismo,
          _absenteismo: absenteismo,
          _isBest: histRows.length > 2 && origIdx === bestIdx,
          _isWorst: histRows.length > 2 && origIdx === worstIdx,
        };
      }),
    [histRows, bestIdx, worstIdx],
  );

  /* date range filter */
  const filtered = useMemo(
    () =>
      filterMetricRows(
        enriched.filter(
        (r) =>
          !(effectiveDateFrom && r.date < effectiveDateFrom) &&
          !(effectiveDateTo && r.date > effectiveDateTo),
        ),
        metricFilter,
      ),
    [enriched, effectiveDateFrom, effectiveDateTo, metricFilter],
  );

  /* sort */
  const sorted = useMemo(() => {
    const arr = [...filtered];
    const sign = sortDir === "asc" ? 1 : -1;
    arr.sort((a, b) => {
      switch (sortCol) {
        case "date":
          return sign * a.date.localeCompare(b.date);
        case "hrs_plan":
          return sign * ((a.horas_planejadas || 0) - (b.horas_planejadas || 0));
        case "hrs_trab":
          return sign * ((a.horas_presentes || 0) - (b.horas_presentes || 0));
        case "hrs_pct":
          return sign * ((a._pctPerdidas || 0) - (b._pctPerdidas || 0));
        case "abs_idx":
          return sign * ((a._absenteismo || 0) - (b._absenteismo || 0));
        case "hrs_perd":
          return sign * ((a._horasPerdidas || 0) - (b._horasPerdidas || 0));
        case "presentes":
          return sign * (a.presentesPct - b.presentesPct);
        case "ausentes":
          return sign * (a._ausentes - b._ausentes);
        case "justificadas":
          return sign * ((a.justificadas || 0) - (b.justificadas || 0));
        case "extras":
          return sign * ((a.horas_extras || 0) - (b.horas_extras || 0));
        default:
          return 0;
      }
    });
    return arr;
  }, [filtered, sortCol, sortDir]);

  /* group rows */
  const grouped = useMemo(() => {
    if (groupBy === "none") return null;
    const map = new Map();
    for (const r of sorted) {
      const key = getGroupKey(r.date, groupBy);
      if (!map.has(key)) map.set(key, []);
      map.get(key).push(r);
    }
    return [...map.entries()].sort(([a], [b]) => a.localeCompare(b));
  }, [sorted, groupBy]);

  /* grand totals */
  const totals = useMemo(
    () => computeTotals(filtered, hasHours, hasExtras),
    [filtered, hasHours, hasExtras],
  );

  /* ── employee view ── */
  const empListInternal = useMemo(() => {
    if (empListProp) return empListProp;
    const map = new Map();
    for (const row of histRows) {
      for (const emp of row._employees || []) {
        if (emp.mat && !map.has(emp.mat)) map.set(emp.mat, emp.nome || emp.mat);
      }
    }
    return [...map.entries()].sort((a, b) => a[1].localeCompare(b[1]));
  }, [histRows, empListProp]);
  const empList = empListProp ?? empListInternal;

  const periodEvents = useMemo(
    () =>
      sorted.flatMap((r) =>
        Array.isArray(r._events)
          ? r._events.map((ev) => ({
              ...ev,
              data: normDateKey(ev?.data || ev?.date || ev?.data_referencia) || r.date,
            }))
          : [],
      ),
    [sorted],
  );

  const openDayModal = useCallback((row) => {
    const meta = getDateMeta(row?.date);
    const dayLabel = row?._label || (meta ? `${meta.dowLabel} ${meta.label}` : row?.date);
    const initialEmployees = Array.isArray(row?._employees)
      ? row._employees.map((employee) => ({ ...employee, data: employee.data || row.date }))
      : [];
    const initialEvents = Array.isArray(row?._events)
      ? row._events.map((ev) => ({
          ...ev,
          data: normDateKey(ev?.data || ev?.date || ev?.data_referencia) || row.date,
        }))
      : [];
    const eventsForModal = periodEvents.length > 0 ? periodEvents : initialEvents;
    setDayModal({
      date: row.date,
      label: dayLabel,
      employees: initialEmployees,
      events: eventsForModal,
      initialDateFrom: row.date,
      initialDateTo: row.date,
    });

    if (initialEmployees.length > 0 || eventsForModal.length > 0) return;

    PosicaoApi.getDia(row.date)
      .then((payload) => {
        const employees = employeesFromDayPayload(payload).map((employee) => ({
          ...employee,
          data: row.date,
        }));
        setDayModal((current) =>
          current?.date === row.date ? { ...current, employees } : current,
        );
      })
      .catch(() => {
        setDayModal((current) => (current?.date === row.date ? { ...current, employees: [] } : current));
      });
  }, [periodEvents]);

  useEffect(() => {
    if (!openDateRequest?.date) return;
    const requestedRow = histRows.find((row) => row.date === openDateRequest.date);
    if (requestedRow) openDayModal(requestedRow);
  }, [histRows, openDateRequest, openDayModal]);

  useEffect(() => {
    if (
      !tableViewRequest?.view &&
      tableViewRequest?.search == null &&
      tableViewRequest?.groupBy === undefined
    )
      return;
    if (!tableViewRequest?.preserveSelectedEmp) setSelectedEmp(null);
    if (tableViewRequest?.view) setTableView(tableViewRequest.view);
    if (tableViewRequest?.groupBy !== undefined) setGroupBy(tableViewRequest.groupBy || "none");
    if (tableViewRequest?.search != null) {
      setDateSearch(String(tableViewRequest.search || ""));
    }
  }, [tableViewRequest]);

  const empRows = useMemo(() => {
    if (!selectedEmp) return null;
    return [...filtered]
      .sort((a, b) => b.date.localeCompare(a.date))
      .map((row) => {
        const e = (row._employees || []).find((x) => x.mat === selectedEmp);
        return {
          date: row.date,
          _label: row._label,
          _meta: row._meta,
          present: !!e,
          hrsPlan: e?.hrsPlan ?? null,
          hrsPres: e?.hrsPres ?? null,
          hrsAuse: e?.hrsAuse ?? null,
          hrsJust: e?.hrsJust ?? null,
          hrsExtr: e?.hrsExtr ?? null,
        };
      });
  }, [selectedEmp, filtered]);

  const empSummary = useMemo(() => {
    if (!empRows) return null;
    const workDays = empRows.filter((r) => !r._meta?.isWeekend && !r._meta?.feriado);
    const present = empRows.filter((r) => r.present);
    const hrsPlan = empRows.reduce((s, r) => s + (r.hrsPlan || 0), 0);
    const hrsAuse = empRows.reduce((s, r) => s + (r.hrsAuse || 0), 0);
    const hrsJust = empRows.reduce((s, r) => s + (r.hrsJust || 0), 0);
    const absTotal = hrsAuse + hrsJust;
    const absPct =
      hrsPlan > 0
        ? (absTotal / hrsPlan) * 100
        : workDays.length > 0
          ? ((workDays.length - present.length) / workDays.length) * 100
          : null;
    return {
      total: workDays.length,
      present: present.length,
      absent: workDays.length - present.length,
      pct: workDays.length ? Math.round((present.length / workDays.length) * 100) : 0,
      absPct: absPct != null ? +absPct.toFixed(1) : null,
      hrsPlan,
      hrsPres: empRows.reduce((s, r) => s + capWorkedHours(r.hrsPres, r.hrsPlan), 0),
      hrsAuse,
      hrsJust,
      hrsExtr: empRows.reduce((s, r) => s + (r.hrsExtr || 0), 0),
    };
  }, [empRows]);

  /* ── date search filter ── */
  const displayRows = useMemo(() => {
    if (!dateSearch.trim()) return sorted;
    const q = dateSearch.trim().toLowerCase();
    return sorted.filter((r) => r._label.toLowerCase().includes(q));
  }, [sorted, dateSearch]);

  const modalEvents = useMemo(() => {
    const rows = displayRows.length ? displayRows : sorted;
    return rows.flatMap((r) =>
      Array.isArray(r._events)
        ? r._events.map((ev) => ({
            ...ev,
            data: normDateKey(ev?.data || ev?.date || ev?.data_referencia) || r.date,
          }))
        : [],
    );
  }, [displayRows, sorted]);

  /* date range of all displayed rows — used by modal to show full period, not just clicked day */
  const modalDateRange = useMemo(() => {
    const rows = displayRows.length ? displayRows : sorted;
    let from = "",
      to = "";
    for (const r of rows) {
      if (!r.date) continue;
      if (!from || r.date < from) from = r.date;
      if (!to || r.date > to) to = r.date;
    }
    return { from, to };
  }, [displayRows, sorted]);

  const activeDayModal = useMemo(() => {
    if (!dayModal) return null;
    const hasCustomEvents =
      Array.isArray(dayModal.events) &&
      (dayModal.events.length > 0 ||
        dayModal.initialPillFilter != null ||
        dayModal.scopedEvents === true);
    const events = CONFIG.ABSENTEISMO_API
      ? []
      : hasCustomEvents
        ? dayModal.events
        : modalEvents;
    let { from, to } = modalDateRange;
    if (dayModal.initialDateFrom || dayModal.initialDateTo) {
      from = dayModal.initialDateFrom || dayModal.date || from;
      to = dayModal.initialDateTo || dayModal.date || to;
    }
    if (dayModal.initialPillFilter && events.length) {
      const scoped = eventsDateRange(events);
      if (scoped.from) {
        from = scoped.from;
        to = scoped.to;
      }
    }
    return {
      ...dayModal,
      events,
      eventsDateFrom: from,
      eventsDateTo: to,
    };
  }, [dayModal, modalEvents, modalDateRange]);

  const handleModalDateRangeApply = useCallback(
    (from, to) => {
      onDateFromChange?.(from || "");
      onDateToChange?.(to || "");
    },
    [onDateFromChange, onDateToChange],
  );

  const displayGrouped = useMemo(() => {
    if (!grouped) return null;
    if (!dateSearch.trim()) return grouped;
    const q = dateSearch.trim().toLowerCase();
    return grouped
      .map(([key, rows]) => [key, rows.filter((r) => r._label.toLowerCase().includes(q))])
      .filter(([, rows]) => rows.length > 0);
  }, [grouped, dateSearch]);

  const displayTotals = useMemo(() => {
    if (!dateSearch.trim()) return totals;
    const rows = displayGrouped ? displayGrouped.flatMap(([, r]) => r) : displayRows;
    return computeTotals(rows, hasHours, hasExtras);
  }, [dateSearch, displayGrouped, displayRows, totals, hasHours, hasExtras]);

  const deptSourceRows = useMemo(() => {
    const deptBase = Array.isArray(deptHistRows) && deptHistRows.length ? deptHistRows : filtered;
    return filterMetricRows(
      (
      dateSearch.trim()
        ? deptBase.filter((r) =>
            (r._label || "").toLowerCase().includes(dateSearch.trim().toLowerCase()),
          )
        : deptBase
      ).filter((r) => !(dateFrom && r.date < dateFrom) && !(dateTo && r.date > dateTo)),
      metricFilter,
    );
  }, [deptHistRows, filtered, dateSearch, dateFrom, dateTo, metricFilter]);

  const presenceHistRows = useMemo(
    () =>
      deptSourceRows.filter(
        (r) =>
          !(effectiveDateFrom && r.date < effectiveDateFrom) &&
          !(effectiveDateTo && r.date > effectiveDateTo),
      ),
    [deptSourceRows, effectiveDateFrom, effectiveDateTo],
  );

  const openRiscoModal = useCallback(
    ({ eventLabel, date, mat, emp, dept } = {}) => {
      const hasSpecificFilter = Boolean(eventLabel || date || mat || emp || dept);
      let events = periodEvents.filter((ev) => ev._cat === "risco");
      if (eventLabel) {
        events = events.filter((ev) => riskEventGroupLabel(ev) === eventLabel);
      }
      if (dept) {
        events = events.filter((ev) => riskDeptLabel(ev) === dept);
      }
      if (date) {
        const dk = normDateKey(date);
        events = events.filter((ev) => normDateKey(ev.data) === dk);
      }
      if (mat) {
        events = events.filter((ev) => ev.mat === mat);
      }
      if (emp) {
        events = events.filter((ev) => ev.mat === emp || ev.nome === emp);
      }
      const filteredEvents = events;
      const mats = new Set(filteredEvents.map((ev) => ev.mat).filter(Boolean));
      const employees = mats.size
        ? deptSourceRows.flatMap((row) =>
            (row._employees || [])
              .filter((employee) => mats.has(employee.mat))
              .map((employee) => ({ ...employee, data: employee.data || row.date })),
          )
        : [];
      const fallbackRow =
        (date && histRows.find((row) => row.date === date)) ||
        sorted.find((row) =>
          (row._events || []).some(
            (ev) =>
              ev._cat === "risco" &&
              (!eventLabel || riskEventGroupLabel(ev) === eventLabel) &&
              (!dept || riskDeptLabel(ev) === dept) &&
              (!mat || ev.mat === mat) &&
              (!emp || ev.mat === emp || ev.nome === emp),
          ),
        ) ||
        sorted[0];
      const targetDate = date || fallbackRow?.date;
      const meta = targetDate ? getDateMeta(targetDate) : null;
      const dayLbl = meta ? `${meta.dowLabel} ${meta.label}` : targetDate;
      let label = "Risco trabalhista";
      if (eventLabel) label = eventLabel;
      if (dept) label += ` — ${dept}`;
      if (emp) label += ` — ${emp}`;
      if (date) label += ` — ${dayLbl}`;
      else if (eventLabel && !dept) label += " — período";

      setDayModal({
        date: targetDate,
        label,
        employees,
        events:
          filteredEvents.length || hasSpecificFilter
            ? filteredEvents
            : periodEvents.filter((ev) => ev._cat === "risco"),
        scopedEvents: hasSpecificFilter,
        initialPillFilter: "risco",
        columnPreset: "risco",
      });
    },
    [deptSourceRows, periodEvents, sorted, histRows],
  );

  const openCidModal = useCallback(
    (cidLabel) => {
      const events = periodEvents.filter((ev) => cidEventGroupLabel(ev) === cidLabel);
      const mats = new Set(events.map((ev) => ev.mat).filter(Boolean));
      const employees = deptSourceRows.flatMap((row) =>
        (row._employees || [])
          .filter((employee) => mats.has(employee.mat))
          .map((employee) => ({ ...employee, data: employee.data || row.date })),
      );
      const fallbackRow =
        sorted.find((row) =>
          (row._events || []).some((ev) => cidEventGroupLabel(ev) === cidLabel),
        ) || sorted[0];

      setDayModal({
        date: fallbackRow?.date || "",
        label: `CID - ${cidLabel}`,
        employees,
        events,
        scopedEvents: true,
      });
    },
    [deptSourceRows, periodEvents, sorted],
  );

  const openEventModal = useCallback(
    (eventKey) => {
      const events = periodEvents.filter((ev) => eventRowKey(ev) === eventKey);
      const mats = new Set(events.map((ev) => collaboratorKey(ev)).filter(Boolean));
      const employees = deptSourceRows.flatMap((row) =>
        (row._employees || [])
          .filter((employee) => mats.has(collaboratorKey(employee)))
          .map((employee) => ({ ...employee, data: employee.data || row.date })),
      );
      const fallbackRow =
        sorted.find((row) => (row._events || []).some((ev) => eventRowKey(ev) === eventKey)) ||
        sorted[0];
      const sample = events[0];
      setDayModal({
        date: fallbackRow?.date || "",
        label: `Evento - ${sample ? eventGroupLabel(sample) : eventKey}`,
        employees,
        events,
        scopedEvents: true,
        initialPillFilter: sample?._cat || null,
      });
    },
    [deptSourceRows, periodEvents, sorted],
  );

  const openColabModal = useCallback(
    (colabKey) => {
      const employees = deptSourceRows.flatMap((row) =>
        (row._employees || [])
          .filter((employee) => collaboratorKey(employee) === colabKey)
          .map((employee) => ({ ...employee, data: employee.data || row.date })),
      );
      const events = periodEvents.filter((ev) => collaboratorKey(ev) === colabKey);
      const fallbackRow =
        sorted.find(
          (row) =>
            (row._employees || []).some((employee) => collaboratorKey(employee) === colabKey) ||
            (row._events || []).some((ev) => collaboratorKey(ev) === colabKey),
        ) || sorted[0];
      const sample = employees[0] || events[0];
      setDayModal({
        date: fallbackRow?.date || "",
        label: `Colaborador - ${sample?.nome || sample?.mat || colabKey}`,
        employees,
        events,
        scopedEvents: true,
      });
    },
    [deptSourceRows, periodEvents, sorted],
  );

  const openGroupModal = useCallback(
    (groupType, groupValue) => {
      const isDept = groupType === "dept";
      const isGenero = groupType === "genero";
      const matchesGroup = (record) =>
        cleanGroupText(
          isDept
            ? record?.depto_desc || record?.depto
            : isGenero
              ? record?.genero
              : record?.cargo,
          isDept ? "Sem departamento" : isGenero ? "Nao informado" : "Sem cargo",
        ) === groupValue;
      const groupEvents = periodEvents.filter(matchesGroup);
      const groupEmployees = deptSourceRows.flatMap((row) =>
        (row._employees || [])
          .filter(matchesGroup)
          .map((employee) => ({ ...employee, data: employee.data || row.date })),
      );
      const lastRow = deptSourceRows[deptSourceRows.length - 1] || sorted[0];

      setDayModal({
        date: lastRow?.date || "",
        label: `${isDept ? "Departamento" : isGenero ? "Genero" : "Cargo"} - ${groupValue}`,
        employees: groupEmployees,
        events: groupEvents,
        scopedEvents: true,
        groupType,
        groupValue,
        canOpenAbsTrend: isDept || isGenero || groupType === "cargo",
      });
    },
    [deptSourceRows, periodEvents, sorted],
  );

  const openGroupAbsTrend = useCallback(
    (groupType, groupValue) => {
      const isDept = groupType === "dept";
      const isGenero = groupType === "genero";
      const matchesGroup = (record) =>
        cleanGroupText(
          isDept
            ? record?.depto_desc || record?.depto
            : isGenero
              ? record?.genero
              : record?.cargo,
          isDept ? "Sem departamento" : isGenero ? "Nao informado" : "Sem cargo",
        ) === groupValue;
      const rows = deptSourceRows
        .map((row) => {
          const employees = (row._employees || []).filter(matchesGroup);
          if (!employees.length) return null;
          const total = employees.length;
          const presentes = employees.filter((employee) => (Number(employee.hrsPres) || 0) > 0).length;
          const faltas = employees.filter((employee) => (Number(employee.hrsAuse) || 0) > 0).length;
          const justificadas = employees.filter((employee) => (Number(employee.hrsJust) || 0) > 0).length;
          const horasPlanejadas = employees.reduce((sum, employee) => sum + (Number(employee.hrsPlan) || 0), 0);
          const horasPresentes = employees.reduce(
            (sum, employee) => sum + capWorkedHours(employee.hrsPres, employee.hrsPlan),
            0,
          );
          const horasAusentes = employees.reduce((sum, employee) => sum + (Number(employee.hrsAuse) || 0), 0);
          const horasJustificadas = employees.reduce((sum, employee) => sum + (Number(employee.hrsJust) || 0), 0);
          const horasExtras = employees.reduce((sum, employee) => sum + (Number(employee.hrsExtr) || 0), 0);
          return {
            date: row.date,
            total,
            presentes,
            presentesPct: total > 0 ? +((presentes / total) * 100).toFixed(1) : 0,
            faltas,
            atrasos: 0,
            justificadas,
            horas_planejadas: horasPlanejadas,
            horas_presentes: horasPresentes,
            horas_faltas: horasAusentes,
            horas_atrasos: 0,
            horas_justificadas: horasJustificadas,
            horas_extras: horasExtras,
            extras: employees.filter((employee) => (Number(employee.hrsExtr) || 0) > 0).length,
            _employees: employees,
            _events: (row._events || []).filter(matchesGroup),
          };
        })
        .filter(Boolean)
        .sort((a, b) => a.date.localeCompare(b.date));
      if (!rows.length) return;
      setAbsTrendModal({
        groupType: isDept ? "Departamento" : isGenero ? "Genero" : "Cargo",
        groupValue,
        rows,
      });
    },
    [deptSourceRows],
  );

  const deptRows = useMemo(() => {
    const map = new Map();
    for (const row of deptSourceRows) {
      for (const emp of row._employees || []) {
        const dept = cleanGroupText(emp.depto_desc || emp.depto, "Sem departamento");
        if (!map.has(dept)) {
          map.set(dept, {
            dept,
            colaboradores: new Set(),
            presentes: 0,
            ausentes: 0,
            justificadas: 0,
            extras: 0,
            horas_planejadas: 0,
            horas_presentes: 0,
            horas_ausentes: 0,
            horas_justificadas: 0,
            horas_extras: 0,
          });
        }
        const acc = map.get(dept);
        if (emp.mat) acc.colaboradores.add(emp.mat);
        acc.horas_planejadas += emp.hrsPlan || 0;
        acc.horas_presentes += capWorkedHours(emp.hrsPres, emp.hrsPlan);
        acc.horas_ausentes += emp.hrsAuse || 0;
        acc.horas_justificadas += emp.hrsJust || 0;
        acc.horas_extras += emp.hrsExtr || 0;
        if ((emp.hrsPres || 0) > 0) acc.presentes += 1;
        if ((emp.hrsAuse || 0) > 0) acc.ausentes += 1;
        if ((emp.hrsJust || 0) > 0) acc.justificadas += 1;
        if ((emp.hrsExtr || 0) > 0) acc.extras += 1;
      }
    }
    return filterMetricRows([...map.values()].map((r) => {
      const metrics = computeAggregateHourMetrics(r);
      return {
        ...r,
        colaboradoresQtd: r.colaboradores.size,
        horas_perdidas: metrics.horas_perdidas,
        pct_perdidas: metrics.pct_perdidas,
        absenteismo: metrics.absenteismo,
      };
    }), metricFilter);
  }, [deptSourceRows, metricFilter]);

  const cargoRows = useMemo(() => {
    const map = new Map();
    for (const row of deptSourceRows) {
      for (const emp of row._employees || []) {
        const cargo = cleanGroupText(emp.cargo, "Sem cargo");
        if (!map.has(cargo)) {
          map.set(cargo, {
            cargo,
            colaboradores: new Set(),
            presentes: 0,
            ausentes: 0,
            justificadas: 0,
            extras: 0,
            horas_planejadas: 0,
            horas_presentes: 0,
            horas_ausentes: 0,
            horas_justificadas: 0,
            horas_extras: 0,
          });
        }
        const acc = map.get(cargo);
        if (emp.mat) acc.colaboradores.add(emp.mat);
        acc.horas_planejadas += emp.hrsPlan || 0;
        acc.horas_presentes += capWorkedHours(emp.hrsPres, emp.hrsPlan);
        acc.horas_ausentes += emp.hrsAuse || 0;
        acc.horas_justificadas += emp.hrsJust || 0;
        acc.horas_extras += emp.hrsExtr || 0;
        if ((emp.hrsPres || 0) > 0) acc.presentes += 1;
        if ((emp.hrsAuse || 0) > 0) acc.ausentes += 1;
        if ((emp.hrsJust || 0) > 0) acc.justificadas += 1;
        if ((emp.hrsExtr || 0) > 0) acc.extras += 1;
      }
    }
    return filterMetricRows([...map.values()].map((r) => {
      const metrics = computeAggregateHourMetrics(r);
      return {
        ...r,
        colaboradoresQtd: r.colaboradores.size,
        horas_perdidas: metrics.horas_perdidas,
        pct_perdidas: metrics.pct_perdidas,
        absenteismo: metrics.absenteismo,
      };
    }), metricFilter);
  }, [deptSourceRows, metricFilter]);

  const generoRows = useMemo(() => {
    const map = new Map();
    for (const row of deptSourceRows) {
      for (const emp of row._employees || []) {
        const genero = cleanGroupText(emp.genero, "Nao informado");
        if (!map.has(genero)) {
          map.set(genero, {
            genero,
            colaboradores: new Set(),
            presentes: 0,
            ausentes: 0,
            justificadas: 0,
            extras: 0,
            horas_planejadas: 0,
            horas_presentes: 0,
            horas_ausentes: 0,
            horas_justificadas: 0,
            horas_extras: 0,
          });
        }
        const acc = map.get(genero);
        if (emp.mat) acc.colaboradores.add(emp.mat);
        acc.horas_planejadas += emp.hrsPlan || 0;
        acc.horas_presentes += capWorkedHours(emp.hrsPres, emp.hrsPlan);
        acc.horas_ausentes += emp.hrsAuse || 0;
        acc.horas_justificadas += emp.hrsJust || 0;
        acc.horas_extras += emp.hrsExtr || 0;
        if ((emp.hrsPres || 0) > 0) acc.presentes += 1;
        if ((emp.hrsAuse || 0) > 0) acc.ausentes += 1;
        if ((emp.hrsJust || 0) > 0) acc.justificadas += 1;
        if ((emp.hrsExtr || 0) > 0) acc.extras += 1;
      }
    }
    return filterMetricRows([...map.values()].map((r) => {
      const metrics = computeAggregateHourMetrics(r);
      return {
        ...r,
        colaboradoresQtd: r.colaboradores.size,
        horas_perdidas: metrics.horas_perdidas,
        pct_perdidas: metrics.pct_perdidas,
        absenteismo: metrics.absenteismo,
      };
    }), metricFilter);
  }, [deptSourceRows, metricFilter]);


  const deptDrillMap = useMemo(() => {
    const map = new Map();
    const ensureDept = (dept) => {
      if (!map.has(dept)) map.set(dept, { days: new Map(), employees: new Map() });
      return map.get(dept);
    };
    for (const row of deptSourceRows) {
      const meta = getDateMeta(row.date);
      const label = meta ? `${meta.dowLabel} ${meta.label}` : row.date;
      for (const emp of row._employees || []) {
        const dept = cleanGroupText(emp.depto_desc || emp.depto, "Sem departamento");
        const bucket = ensureDept(dept);
        if (!bucket.days.has(row.date)) {
          bucket.days.set(row.date, {
            date: row.date,
            label,
            ausentes: 0,
            justificadas: 0,
            extras: 0,
            hrsAuse: 0,
            hrsJust: 0,
            hrsExtr: 0,
          });
        }
        const day = bucket.days.get(row.date);
        day.hrsAuse += emp.hrsAuse || 0;
        day.hrsJust += emp.hrsJust || 0;
        day.hrsExtr += emp.hrsExtr || 0;
        if ((emp.hrsAuse || 0) > 0) day.ausentes += 1;
        if ((emp.hrsJust || 0) > 0) day.justificadas += 1;
        if ((emp.hrsExtr || 0) > 0) day.extras += 1;

        if ((emp.hrsAuse || 0) > 0 || (emp.hrsJust || 0) > 0 || (emp.hrsExtr || 0) > 0) {
          const key = emp.mat || emp.nome || `${dept}-${bucket.employees.size}`;
          if (!bucket.employees.has(key)) {
            bucket.employees.set(key, {
              mat: emp.mat,
              nome: emp.nome || emp.mat || "—",
              hrsPlan: 0,
              hrsPres: 0,
              hrsAuse: 0,
              hrsJust: 0,
              hrsExtr: 0,
              diasAuse: 0,
              diasJust: 0,
              diasExtr: 0,
            });
          }
          const acc = bucket.employees.get(key);
          acc.hrsPlan += emp.hrsPlan || 0;
          acc.hrsPres += capWorkedHours(emp.hrsPres, emp.hrsPlan);
          acc.hrsAuse += emp.hrsAuse || 0;
          acc.hrsJust += emp.hrsJust || 0;
          acc.hrsExtr += emp.hrsExtr || 0;
          if ((emp.hrsAuse || 0) > 0) acc.diasAuse += 1;
          if ((emp.hrsJust || 0) > 0) acc.diasJust += 1;
          if ((emp.hrsExtr || 0) > 0) acc.diasExtr += 1;
        }
      }
    }
    const out = new Map();
    for (const [dept, bucket] of map) {
      const criticalDays = [...bucket.days.values()]
        .filter((d) => d.hrsAuse > 0 || d.hrsJust > 0 || d.hrsExtr > 0)
        .sort(
          (a, b) =>
            b.hrsAuse + b.hrsJust - (a.hrsAuse + a.hrsJust) ||
            b.hrsExtr - a.hrsExtr ||
            b.date.localeCompare(a.date),
        )
        .slice(0, 5);
      const employees = [...bucket.employees.values()]
        .sort(
          (a, b) =>
            b.hrsAuse + b.hrsJust - (a.hrsAuse + a.hrsJust) ||
            b.hrsExtr - a.hrsExtr ||
            a.nome.localeCompare(b.nome, "pt-BR"),
        );
      out.set(dept, { criticalDays, employees });
    }
    return out;
  }, [deptSourceRows]);

  const cargoDrillMap = useMemo(() => {
    const map = new Map();
    const ensureCargo = (cargo) => {
      if (!map.has(cargo)) map.set(cargo, { days: new Map(), employees: new Map() });
      return map.get(cargo);
    };
    for (const row of deptSourceRows) {
      const meta = getDateMeta(row.date);
      const label = meta ? `${meta.dowLabel} ${meta.label}` : row.date;
      for (const emp of row._employees || []) {
        const cargo = cleanGroupText(emp.cargo, "Sem cargo");
        const bucket = ensureCargo(cargo);
        if (!bucket.days.has(row.date)) {
          bucket.days.set(row.date, {
            date: row.date,
            label,
            ausentes: 0,
            justificadas: 0,
            extras: 0,
            hrsAuse: 0,
            hrsJust: 0,
            hrsExtr: 0,
          });
        }
        const day = bucket.days.get(row.date);
        day.hrsAuse += emp.hrsAuse || 0;
        day.hrsJust += emp.hrsJust || 0;
        day.hrsExtr += emp.hrsExtr || 0;
        if ((emp.hrsAuse || 0) > 0) day.ausentes += 1;
        if ((emp.hrsJust || 0) > 0) day.justificadas += 1;
        if ((emp.hrsExtr || 0) > 0) day.extras += 1;
        if ((emp.hrsAuse || 0) > 0 || (emp.hrsJust || 0) > 0 || (emp.hrsExtr || 0) > 0) {
          const key = emp.mat || emp.nome || `${cargo}-${bucket.employees.size}`;
          if (!bucket.employees.has(key)) {
            bucket.employees.set(key, {
              mat: emp.mat,
              nome: emp.nome || emp.mat || "—",
              hrsPlan: 0,
              hrsPres: 0,
              hrsAuse: 0,
              hrsJust: 0,
              hrsExtr: 0,
              diasAuse: 0,
              diasJust: 0,
              diasExtr: 0,
            });
          }
          const acc = bucket.employees.get(key);
          acc.hrsPlan += emp.hrsPlan || 0;
          acc.hrsPres += capWorkedHours(emp.hrsPres, emp.hrsPlan);
          acc.hrsAuse += emp.hrsAuse || 0;
          acc.hrsJust += emp.hrsJust || 0;
          acc.hrsExtr += emp.hrsExtr || 0;
          if ((emp.hrsAuse || 0) > 0) acc.diasAuse += 1;
          if ((emp.hrsJust || 0) > 0) acc.diasJust += 1;
          if ((emp.hrsExtr || 0) > 0) acc.diasExtr += 1;
        }
      }
    }
    const out = new Map();
    for (const [cargo, bucket] of map) {
      const criticalDays = [...bucket.days.values()]
        .filter((d) => d.hrsAuse > 0 || d.hrsJust > 0 || d.hrsExtr > 0)
        .sort(
          (a, b) =>
            b.hrsAuse + b.hrsJust - (a.hrsAuse + a.hrsJust) ||
            b.hrsExtr - a.hrsExtr ||
            b.date.localeCompare(a.date),
        )
        .slice(0, 5);
      const employees = [...bucket.employees.values()]
        .sort(
          (a, b) =>
            b.hrsAuse + b.hrsJust - (a.hrsAuse + a.hrsJust) ||
            b.hrsExtr - a.hrsExtr ||
            a.nome.localeCompare(b.nome, "pt-BR"),
        );
      out.set(cargo, { criticalDays, employees });
    }
    return out;
  }, [deptSourceRows]);

  const generoDrillMap = useMemo(() => {
    const map = new Map();
    const ensureGenero = (genero) => {
      if (!map.has(genero)) map.set(genero, { days: new Map(), employees: new Map() });
      return map.get(genero);
    };
    for (const row of deptSourceRows) {
      const meta = getDateMeta(row.date);
      const label = meta ? `${meta.dowLabel} ${meta.label}` : row.date;
      for (const emp of row._employees || []) {
        const genero = cleanGroupText(emp.genero, "Nao informado");
        const bucket = ensureGenero(genero);
        if (!bucket.days.has(row.date)) {
          bucket.days.set(row.date, {
            date: row.date,
            label,
            ausentes: 0,
            justificadas: 0,
            extras: 0,
            hrsAuse: 0,
            hrsJust: 0,
            hrsExtr: 0,
          });
        }
        const day = bucket.days.get(row.date);
        day.hrsAuse += emp.hrsAuse || 0;
        day.hrsJust += emp.hrsJust || 0;
        day.hrsExtr += emp.hrsExtr || 0;
        if ((emp.hrsAuse || 0) > 0) day.ausentes += 1;
        if ((emp.hrsJust || 0) > 0) day.justificadas += 1;
        if ((emp.hrsExtr || 0) > 0) day.extras += 1;
        if ((emp.hrsAuse || 0) > 0 || (emp.hrsJust || 0) > 0 || (emp.hrsExtr || 0) > 0) {
          const key = emp.mat || emp.nome || `${genero}-${bucket.employees.size}`;
          if (!bucket.employees.has(key)) {
            bucket.employees.set(key, {
              mat: emp.mat,
              nome: emp.nome || emp.mat || "—",
              hrsPlan: 0,
              hrsPres: 0,
              hrsAuse: 0,
              hrsJust: 0,
              hrsExtr: 0,
              diasAuse: 0,
              diasJust: 0,
              diasExtr: 0,
            });
          }
          const acc = bucket.employees.get(key);
          acc.hrsPlan += emp.hrsPlan || 0;
          acc.hrsPres += capWorkedHours(emp.hrsPres, emp.hrsPlan);
          acc.hrsAuse += emp.hrsAuse || 0;
          acc.hrsJust += emp.hrsJust || 0;
          acc.hrsExtr += emp.hrsExtr || 0;
          if ((emp.hrsAuse || 0) > 0) acc.diasAuse += 1;
          if ((emp.hrsJust || 0) > 0) acc.diasJust += 1;
          if ((emp.hrsExtr || 0) > 0) acc.diasExtr += 1;
        }
      }
    }
    const out = new Map();
    for (const [genero, bucket] of map) {
      const criticalDays = [...bucket.days.values()]
        .filter((d) => d.hrsAuse > 0 || d.hrsJust > 0 || d.hrsExtr > 0)
        .sort(
          (a, b) =>
            b.hrsAuse + b.hrsJust - (a.hrsAuse + a.hrsJust) ||
            b.hrsExtr - a.hrsExtr ||
            b.date.localeCompare(a.date),
        )
        .slice(0, 5);
      const employees = [...bucket.employees.values()]
        .sort(
          (a, b) =>
            b.hrsAuse + b.hrsJust - (a.hrsAuse + a.hrsJust) ||
            b.hrsExtr - a.hrsExtr ||
            a.nome.localeCompare(b.nome, "pt-BR"),
        );
      out.set(genero, { criticalDays, employees });
    }
    return out;
  }, [deptSourceRows]);


  const hasCidView = useMemo(() => {
    for (const row of deptSourceRows) {
      for (const ev of row._events || []) {
        if (String(ev.cidDescricao || ev.cid || "").trim()) return true;
      }
    }
    return false;
  }, [deptSourceRows]);

  const cidRows = useMemo(() => {
    const map = new Map();
    for (const row of deptSourceRows) {
      for (const ev of row._events || []) {
        const label = cidEventGroupLabel(ev);
        const cod = cleanGroupText(ev.cid, "");
        if (!map.has(label)) {
          map.set(label, {
            cidDescricao: label,
            cidCodigos: new Set(),
            eventos: 0,
            colaboradores: new Set(),
            horas: 0,
            presentes: 0,
            ausentes: 0,
            justificadas: 0,
            extras: 0,
            horas_ausentes: 0,
            horas_justificadas: 0,
            horas_extras: 0,
          });
        }
        const acc = map.get(label);
        if (cod) acc.cidCodigos.add(cod);
        acc.eventos += 1;
        if (ev.mat) acc.colaboradores.add(ev.mat);
        const hrs = Number(ev.horas) || 0;
        acc.horas += hrs;
        const cat = ev._cat || "";
        if (cat === "presentes") acc.presentes += 1;
        else if (cat === "ausentes") {
          acc.ausentes += 1;
          acc.horas_ausentes += hrs;
        } else if (cat === "justificadas") {
          acc.justificadas += 1;
          acc.horas_justificadas += hrs;
        } else if (cat === "extras") {
          acc.extras += 1;
          acc.horas_extras += hrs;
        }
      }
    }
    return filterMetricRows([...map.values()].map((r) => ({
      ...r,
      colaboradoresQtd: r.colaboradores.size,
      cidCodigo: [...r.cidCodigos].sort((a, b) => a.localeCompare(b, "pt-BR")).join(", ") || "—",
    })), metricFilter);
  }, [deptSourceRows, metricFilter]);

  const cidDrillMap = useMemo(() => {
    const map = new Map();
    const ensure = (label) => {
      if (!map.has(label)) map.set(label, { days: new Map(), employees: new Map() });
      return map.get(label);
    };
    for (const row of deptSourceRows) {
      const meta = getDateMeta(row.date);
      const dayLabel = meta ? `${meta.dowLabel} ${meta.label}` : row.date;
      for (const ev of row._events || []) {
        const label = cidEventGroupLabel(ev);
        const bucket = ensure(label);
        if (!bucket.days.has(row.date)) {
          bucket.days.set(row.date, {
            date: row.date,
            label: dayLabel,
            eventos: 0,
            horas: 0,
            colaboradores: new Set(),
          });
        }
        const day = bucket.days.get(row.date);
        day.eventos += 1;
        day.horas += Number(ev.horas) || 0;
        if (ev.mat) day.colaboradores.add(ev.mat);

        const empKey = ev.mat || ev.nome || `${label}-${bucket.employees.size}`;
        if (!bucket.employees.has(empKey)) {
          bucket.employees.set(empKey, {
            mat: ev.mat,
            nome: ev.nome || ev.mat || "—",
            eventos: 0,
            horas: 0,
          });
        }
        const emp = bucket.employees.get(empKey);
        emp.eventos += 1;
        emp.horas += Number(ev.horas) || 0;
      }
    }
    const out = new Map();
    for (const [label, bucket] of map) {
      const topDays = [...bucket.days.values()]
        .sort((a, b) => b.eventos - a.eventos || b.horas - a.horas || b.date.localeCompare(a.date))
        .slice(0, 8)
        .map((d) => ({
          ...d,
          colaboradoresQtd: d.colaboradores.size,
        }));
      const topEmployees = [...bucket.employees.values()]
        .sort((a, b) => b.eventos - a.eventos || b.horas - a.horas || a.nome.localeCompare(b.nome, "pt-BR"))
        .slice(0, 12);
      out.set(label, { topDays, topEmployees });
    }
    return out;
  }, [deptSourceRows]);

  const riskRows = useMemo(() => {
    const map = new Map();
    for (const row of sorted) {
      for (const ev of row._events || []) {
        if (ev._cat !== "risco") continue;
        const label = riskEventGroupLabel(ev);
        if (!map.has(label)) {
          map.set(label, {
            evento: label,
            eventos: 0,
            colaboradores: new Set(),
          });
        }
        const acc = map.get(label);
        acc.eventos += 1;
        acc.colaboradores.add(riskColaboradorKey(ev));
      }
    }
    return [...map.values()].map((r) => ({
      ...r,
      colaboradoresQtd: r.colaboradores.size,
    }));
  }, [sorted]);

  const riskDrillMap = useMemo(() => {
    const map = new Map();
    const ensure = (label) => {
      if (!map.has(label)) map.set(label, { departments: new Map(), employees: new Map() });
      return map.get(label);
    };
    for (const row of sorted) {
      for (const ev of row._events || []) {
        if (ev._cat !== "risco") continue;
        const label = riskEventGroupLabel(ev);
        const bucket = ensure(label);
        const deptKey = riskDeptLabel(ev);
        if (!bucket.departments.has(deptKey)) {
          bucket.departments.set(deptKey, { dept: deptKey, eventos: 0 });
        }
        bucket.departments.get(deptKey).eventos += 1;
        const empKey = riskColaboradorKey(ev);
        if (!bucket.employees.has(empKey)) {
          bucket.employees.set(empKey, {
            key: empKey,
            mat: ev.mat || "",
            nome: ev.nome || ev.mat || "—",
            dept: deptKey,
            eventos: 0,
            horas: 0,
          });
        }
        const emp = bucket.employees.get(empKey);
        emp.eventos += 1;
        emp.horas += Number(ev.horas) || 0;
      }
    }
    const out = new Map();
    for (const [label, bucket] of map) {
      const topDepartments = [...bucket.departments.values()].sort(
        (a, b) => b.eventos - a.eventos || a.dept.localeCompare(b.dept, "pt-BR"),
      );
      const topEmployees = [...bucket.employees.values()].sort(
        (a, b) =>
          b.eventos - a.eventos ||
          b.horas - a.horas ||
          a.nome.localeCompare(b.nome, "pt-BR"),
      );
      out.set(label, { topDepartments, topEmployees });
    }
    return out;
  }, [sorted]);

  const eventRows = useMemo(() => {
    const map = new Map();
    for (const row of deptSourceRows) {
      for (const ev of row._events || []) {
        const key = eventRowKey(ev);
        if (!map.has(key)) {
          map.set(key, {
            key,
            evento: eventGroupLabel(ev),
            codigo: eventGroupCode(ev),
            categoria: eventCategoryLabel(ev?._cat),
            cat: ev?._cat || "",
            eventos: 0,
            colaboradores: new Set(),
            horas: 0,
            presentes: 0,
            ausentes: 0,
            justificadas: 0,
            extras: 0,
            risco: 0,
            horas_ausentes: 0,
            horas_justificadas: 0,
            horas_extras: 0,
          });
        }
        const acc = map.get(key);
        const hrs = Number(ev.horas) || 0;
        acc.eventos += 1;
        acc.horas += hrs;
        const colKey = collaboratorKey(ev);
        if (colKey) acc.colaboradores.add(colKey);
        const cat = ev._cat || "";
        if (cat === "presentes") acc.presentes += 1;
        else if (cat === "ausentes") {
          acc.ausentes += 1;
          acc.horas_ausentes += hrs;
        } else if (cat === "justificadas") {
          acc.justificadas += 1;
          acc.horas_justificadas += hrs;
        } else if (cat === "extras") {
          acc.extras += 1;
          acc.horas_extras += hrs;
        } else if (cat === "risco") {
          acc.risco += 1;
        }
      }
    }
    return filterMetricRows([...map.values()].map((r) => ({
      ...r,
      colaboradoresQtd: r.colaboradores.size,
      codigo: r.codigo || "-",
    })), metricFilter);
  }, [deptSourceRows, metricFilter]);

  const eventDrillMap = useMemo(() => {
    const map = new Map();
    const ensure = (key) => {
      if (!map.has(key)) map.set(key, { days: new Map(), employees: new Map() });
      return map.get(key);
    };
    for (const row of deptSourceRows) {
      const meta = getDateMeta(row.date);
      const dayLabel = meta ? `${meta.dowLabel} ${meta.label}` : row.date;
      for (const ev of row._events || []) {
        const key = eventRowKey(ev);
        const bucket = ensure(key);
        if (!bucket.days.has(row.date)) {
          bucket.days.set(row.date, {
            date: row.date,
            label: dayLabel,
            eventos: 0,
            horas: 0,
            colaboradores: new Set(),
          });
        }
        const day = bucket.days.get(row.date);
        const hrs = Number(ev.horas) || 0;
        day.eventos += 1;
        day.horas += hrs;
        day.colaboradores.add(collaboratorKey(ev));

        const empKey = collaboratorKey(ev);
        if (!bucket.employees.has(empKey)) {
          bucket.employees.set(empKey, {
            key: empKey,
            mat: ev.mat || "",
            nome: ev.nome || ev.mat || "Sem identificacao",
            dept: riskDeptLabel(ev),
            eventos: 0,
            horas: 0,
          });
        }
        const emp = bucket.employees.get(empKey);
        emp.eventos += 1;
        emp.horas += hrs;
      }
    }
    const out = new Map();
    for (const [key, bucket] of map) {
      const topDays = [...bucket.days.values()]
        .sort((a, b) => b.eventos - a.eventos || b.horas - a.horas || b.date.localeCompare(a.date))
        .map((d) => ({ ...d, colaboradoresQtd: d.colaboradores.size }));
      const topEmployees = [...bucket.employees.values()].sort(
        (a, b) => b.eventos - a.eventos || b.horas - a.horas || a.nome.localeCompare(b.nome, "pt-BR"),
      );
      out.set(key, { topDays, topEmployees });
    }
    return out;
  }, [deptSourceRows]);

  const colabRows = useMemo(() => {
    const map = new Map();
    const ensure = (record) => {
      const key = collaboratorKey(record);
      if (!map.has(key)) {
        map.set(key, {
          key,
          mat: record?.mat || record?.matricula || "",
          nome: record?.nome || record?.mat || record?.matricula || "Sem identificacao",
          filial: cleanGroupText(record?.filial_desc || record?.filial, "-"),
          dept: cleanGroupText(record?.depto_desc || record?.depto, "Sem departamento"),
          cargo: cleanGroupText(record?.cargo, "Sem cargo"),
          dias: new Set(),
          eventos: 0,
          presentes: 0,
          ausentes: 0,
          justificadas: 0,
          extras: 0,
          risco: 0,
          horas_planejadas: 0,
          horas_presentes: 0,
          horas_ausentes: 0,
          horas_justificadas: 0,
          horas_extras: 0,
        });
      }
      return map.get(key);
    };
    for (const row of deptSourceRows) {
      for (const emp of row._employees || []) {
        const acc = ensure(emp);
        acc.dias.add(row.date);
        acc.horas_planejadas += Number(emp.hrsPlan) || 0;
        acc.horas_presentes += capWorkedHours(emp.hrsPres, emp.hrsPlan);
        acc.horas_ausentes += Number(emp.hrsAuse) || 0;
        acc.horas_justificadas += Number(emp.hrsJust) || 0;
        acc.horas_extras += Number(emp.hrsExtr) || 0;
        if ((Number(emp.hrsPres) || 0) > 0) acc.presentes += 1;
        if ((Number(emp.hrsAuse) || 0) > 0) acc.ausentes += 1;
        if ((Number(emp.hrsJust) || 0) > 0) acc.justificadas += 1;
        if ((Number(emp.hrsExtr) || 0) > 0) acc.extras += 1;
      }
      for (const ev of row._events || []) {
        const acc = ensure(ev);
        acc.eventos += 1;
        const hrs = Number(ev.horas) || 0;
        const cat = ev._cat || "";
        if (cat === "ausentes") acc.horas_ausentes += hrs;
        else if (cat === "justificadas") acc.horas_justificadas += hrs;
        else if (cat === "extras") acc.horas_extras += hrs;
        else if (cat === "risco") acc.risco += 1;
      }
    }
    return filterMetricRows([...map.values()].map((r) => {
      const metrics = computeAggregateHourMetrics(r);
      return {
        ...r,
        diasQtd: r.dias.size,
        horas_perdidas: metrics.horas_perdidas,
        pct_perdidas: metrics.pct_perdidas,
        absenteismo: metrics.absenteismo,
      };
    }), metricFilter);
  }, [deptSourceRows, metricFilter]);

  const colabDrillMap = useMemo(() => {
    const map = new Map();
    const ensure = (record) => {
      const key = collaboratorKey(record);
      if (!map.has(key)) map.set(key, { days: new Map(), events: [] });
      return map.get(key);
    };
    for (const row of deptSourceRows) {
      const meta = getDateMeta(row.date);
      const dayLabel = meta ? `${meta.dowLabel} ${meta.label}` : row.date;
      for (const emp of row._employees || []) {
        const bucket = ensure(emp);
        if (!bucket.days.has(row.date)) {
          bucket.days.set(row.date, {
            date: row.date,
            label: dayLabel,
            hrsPlan: 0,
            hrsPres: 0,
            hrsAuse: 0,
            hrsJust: 0,
            hrsExtr: 0,
          });
        }
        const day = bucket.days.get(row.date);
        day.hrsPlan += Number(emp.hrsPlan) || 0;
        day.hrsPres += capWorkedHours(emp.hrsPres, emp.hrsPlan);
        day.hrsAuse += Number(emp.hrsAuse) || 0;
        day.hrsJust += Number(emp.hrsJust) || 0;
        day.hrsExtr += Number(emp.hrsExtr) || 0;
      }
      for (const ev of row._events || []) {
        const bucket = ensure(ev);
        bucket.events.push({
          date: row.date,
          label: dayLabel,
          evento: eventGroupLabel(ev),
          categoria: eventCategoryLabel(ev?._cat),
          horas: Number(ev.horas) || 0,
        });
      }
    }
    const out = new Map();
    for (const [key, bucket] of map) {
      out.set(key, {
        days: [...bucket.days.values()].sort((a, b) => b.date.localeCompare(a.date)),
        events: bucket.events.sort((a, b) => b.date.localeCompare(a.date) || a.evento.localeCompare(b.evento, "pt-BR")),
      });
    }
    return out;
  }, [deptSourceRows]);

  useEffect(() => {
    if (tableView === "cid" && !hasCidView) setTableView("date");
  }, [tableView, hasCidView]);

  const sortedDeptRows = useMemo(() => {
    const arr = [...deptRows];
    const sign = deptSortDir === "asc" ? 1 : -1;
    arr.sort((a, b) => {
      switch (deptSortCol) {
        case "dept":
          return sign * a.dept.localeCompare(b.dept, "pt-BR");
        case "colaboradoresQtd":
          return sign * ((a.colaboradoresQtd || 0) - (b.colaboradoresQtd || 0));
        case "horas_planejadas":
          return sign * ((a.horas_planejadas || 0) - (b.horas_planejadas || 0));
        case "horas_presentes":
          return sign * ((a.horas_presentes || 0) - (b.horas_presentes || 0));
        case "horas_perdidas":
          return sign * ((a.horas_perdidas || 0) - (b.horas_perdidas || 0));
        case "pct_perdidas":
          return sign * ((a.pct_perdidas || 0) - (b.pct_perdidas || 0));
        case "presentes":
          return sign * ((a.presentes || 0) - (b.presentes || 0));
        case "horas_ausentes":
          return sign * ((a.horas_ausentes || 0) - (b.horas_ausentes || 0));
        case "ausentes":
          return sign * ((a.ausentes || 0) - (b.ausentes || 0));
        case "justificadas":
          return sign * ((a.justificadas || 0) - (b.justificadas || 0));
        case "horas_justificadas":
          return sign * ((a.horas_justificadas || 0) - (b.horas_justificadas || 0));
        case "extras":
          return sign * ((a.extras || 0) - (b.extras || 0));
        case "horas_extras":
          return sign * ((a.horas_extras || 0) - (b.horas_extras || 0));
        case "absenteismo":
        default:
          return sign * ((a.absenteismo || 0) - (b.absenteismo || 0));
      }
    });
    return arr;
  }, [deptRows, deptSortCol, deptSortDir]);

  const deptTotals = useMemo(() => {
    const { hp, ht, ha, hj, he, base } = computeGroupedTotals(deptRows);
    return {
      colaboradores: deptRows.reduce((s, r) => s + r.colaboradoresQtd, 0),
      presentes: deptRows.reduce((s, r) => s + r.presentes, 0),
      ausentes: deptRows.reduce((s, r) => s + r.ausentes, 0),
      justificadas: deptRows.reduce((s, r) => s + r.justificadas, 0),
      extras: deptRows.reduce((s, r) => s + r.extras, 0),
      horas_planejadas: hp,
      horas_presentes: ht,
      horas_perdidas: base.horas_perdidas,
      pct_perdidas: base.pct_perdidas,
      horas_ausentes: ha,
      horas_justificadas: hj,
      horas_extras: he,
      absenteismo: base.absenteismo,
    };
  }, [deptRows]);

  const sortedCargoRows = useMemo(() => {
    const arr = [...cargoRows];
    const sign = cargoSortDir === "asc" ? 1 : -1;
    arr.sort((a, b) => {
      switch (cargoSortCol) {
        case "cargo":
          return sign * a.cargo.localeCompare(b.cargo, "pt-BR");
        case "colaboradoresQtd":
          return sign * ((a.colaboradoresQtd || 0) - (b.colaboradoresQtd || 0));
        case "horas_planejadas":
          return sign * ((a.horas_planejadas || 0) - (b.horas_planejadas || 0));
        case "horas_presentes":
          return sign * ((a.horas_presentes || 0) - (b.horas_presentes || 0));
        case "horas_perdidas":
          return sign * ((a.horas_perdidas || 0) - (b.horas_perdidas || 0));
        case "pct_perdidas":
          return sign * ((a.pct_perdidas || 0) - (b.pct_perdidas || 0));
        case "presentes":
          return sign * ((a.presentes || 0) - (b.presentes || 0));
        case "horas_ausentes":
          return sign * ((a.horas_ausentes || 0) - (b.horas_ausentes || 0));
        case "ausentes":
          return sign * ((a.ausentes || 0) - (b.ausentes || 0));
        case "justificadas":
          return sign * ((a.justificadas || 0) - (b.justificadas || 0));
        case "horas_justificadas":
          return sign * ((a.horas_justificadas || 0) - (b.horas_justificadas || 0));
        case "extras":
          return sign * ((a.extras || 0) - (b.extras || 0));
        case "horas_extras":
          return sign * ((a.horas_extras || 0) - (b.horas_extras || 0));
        case "absenteismo":
        default:
          return sign * ((a.absenteismo || 0) - (b.absenteismo || 0));
      }
    });
    return arr;
  }, [cargoRows, cargoSortCol, cargoSortDir]);

  const cargoTotals = useMemo(() => {
    const { hp, ht, ha, hj, he, base } = computeGroupedTotals(cargoRows);
    return {
      colaboradores: cargoRows.reduce((s, r) => s + r.colaboradoresQtd, 0),
      presentes: cargoRows.reduce((s, r) => s + r.presentes, 0),
      ausentes: cargoRows.reduce((s, r) => s + r.ausentes, 0),
      justificadas: cargoRows.reduce((s, r) => s + r.justificadas, 0),
      extras: cargoRows.reduce((s, r) => s + r.extras, 0),
      horas_planejadas: hp,
      horas_presentes: ht,
      horas_perdidas: base.horas_perdidas,
      pct_perdidas: base.pct_perdidas,
      horas_ausentes: ha,
      horas_justificadas: hj,
      horas_extras: he,
      absenteismo: base.absenteismo,
    };
  }, [cargoRows]);

  const sortedGeneroRows = useMemo(() => {
    const arr = [...generoRows];
    const sign = generoSortDir === "asc" ? 1 : -1;
    arr.sort((a, b) => {
      switch (generoSortCol) {
        case "genero":
          return sign * a.genero.localeCompare(b.genero, "pt-BR");
        case "colaboradoresQtd":
          return sign * ((a.colaboradoresQtd || 0) - (b.colaboradoresQtd || 0));
        case "horas_planejadas":
          return sign * ((a.horas_planejadas || 0) - (b.horas_planejadas || 0));
        case "horas_presentes":
          return sign * ((a.horas_presentes || 0) - (b.horas_presentes || 0));
        case "horas_perdidas":
          return sign * ((a.horas_perdidas || 0) - (b.horas_perdidas || 0));
        case "pct_perdidas":
          return sign * ((a.pct_perdidas || 0) - (b.pct_perdidas || 0));
        case "presentes":
          return sign * ((a.presentes || 0) - (b.presentes || 0));
        case "horas_ausentes":
          return sign * ((a.horas_ausentes || 0) - (b.horas_ausentes || 0));
        case "ausentes":
          return sign * ((a.ausentes || 0) - (b.ausentes || 0));
        case "justificadas":
          return sign * ((a.justificadas || 0) - (b.justificadas || 0));
        case "horas_justificadas":
          return sign * ((a.horas_justificadas || 0) - (b.horas_justificadas || 0));
        case "extras":
          return sign * ((a.extras || 0) - (b.extras || 0));
        case "horas_extras":
          return sign * ((a.horas_extras || 0) - (b.horas_extras || 0));
        case "absenteismo":
        default:
          return sign * ((a.absenteismo || 0) - (b.absenteismo || 0));
      }
    });
    return arr;
  }, [generoRows, generoSortCol, generoSortDir]);

  const generoTotals = useMemo(() => {
    const { hp, ht, ha, hj, he, base } = computeGroupedTotals(generoRows);
    return {
      colaboradores: generoRows.reduce((s, r) => s + r.colaboradoresQtd, 0),
      presentes: generoRows.reduce((s, r) => s + r.presentes, 0),
      ausentes: generoRows.reduce((s, r) => s + r.ausentes, 0),
      justificadas: generoRows.reduce((s, r) => s + r.justificadas, 0),
      extras: generoRows.reduce((s, r) => s + r.extras, 0),
      horas_planejadas: hp,
      horas_presentes: ht,
      horas_perdidas: base.horas_perdidas,
      pct_perdidas: base.pct_perdidas,
      horas_ausentes: ha,
      horas_justificadas: hj,
      horas_extras: he,
      absenteismo: base.absenteismo,
    };
  }, [generoRows]);


  const sortedCidRows = useMemo(() => {
    const arr = [...cidRows];
    const sign = cidSortDir === "asc" ? 1 : -1;
    arr.sort((a, b) => {
      switch (cidSortCol) {
        case "cidDescricao":
          return sign * a.cidDescricao.localeCompare(b.cidDescricao, "pt-BR");
        case "cidCodigo":
          return sign * a.cidCodigo.localeCompare(b.cidCodigo, "pt-BR");
        case "colaboradoresQtd":
          return sign * ((a.colaboradoresQtd || 0) - (b.colaboradoresQtd || 0));
        case "horas":
          return sign * ((a.horas || 0) - (b.horas || 0));
        case "presentes":
          return sign * ((a.presentes || 0) - (b.presentes || 0));
        case "ausentes":
          return sign * ((a.ausentes || 0) - (b.ausentes || 0));
        case "horas_ausentes":
          return sign * ((a.horas_ausentes || 0) - (b.horas_ausentes || 0));
        case "justificadas":
          return sign * ((a.justificadas || 0) - (b.justificadas || 0));
        case "horas_justificadas":
          return sign * ((a.horas_justificadas || 0) - (b.horas_justificadas || 0));
        case "extras":
          return sign * ((a.extras || 0) - (b.extras || 0));
        case "horas_extras":
          return sign * ((a.horas_extras || 0) - (b.horas_extras || 0));
        case "eventos":
        default:
          return sign * ((a.eventos || 0) - (b.eventos || 0));
      }
    });
    return arr;
  }, [cidRows, cidSortCol, cidSortDir]);

  const cidTotals = useMemo(
    () => ({
      eventos: cidRows.reduce((s, r) => s + r.eventos, 0),
      colaboradores: cidRows.reduce((s, r) => s + r.colaboradoresQtd, 0),
      horas: cidRows.reduce((s, r) => s + r.horas, 0),
      presentes: cidRows.reduce((s, r) => s + r.presentes, 0),
      ausentes: cidRows.reduce((s, r) => s + r.ausentes, 0),
      justificadas: cidRows.reduce((s, r) => s + r.justificadas, 0),
      extras: cidRows.reduce((s, r) => s + r.extras, 0),
      horas_ausentes: cidRows.reduce((s, r) => s + r.horas_ausentes, 0),
      horas_justificadas: cidRows.reduce((s, r) => s + r.horas_justificadas, 0),
      horas_extras: cidRows.reduce((s, r) => s + r.horas_extras, 0),
    }),
    [cidRows],
  );

  const sortedRiskRows = useMemo(() => {
    const arr = [...riskRows];
    const sign = riskSortDir === "asc" ? 1 : -1;
    arr.sort((a, b) => {
      switch (riskSortCol) {
        case "evento":
          return sign * a.evento.localeCompare(b.evento, "pt-BR");
        case "colaboradoresQtd":
          return sign * ((a.colaboradoresQtd || 0) - (b.colaboradoresQtd || 0));
        case "eventos":
        default:
          return sign * ((a.eventos || 0) - (b.eventos || 0));
      }
    });
    return arr;
  }, [riskRows, riskSortCol, riskSortDir]);

  const riskTotals = useMemo(() => {
    const colaboradores = new Set();
    for (const row of riskRows) {
      for (const col of row.colaboradores || []) colaboradores.add(col);
    }
    return {
      eventos: riskRows.reduce((s, r) => s + r.eventos, 0),
      colaboradores: colaboradores.size,
    };
  }, [riskRows]);

  const sortedEventRows = useMemo(() => {
    const arr = [...eventRows];
    const sign = eventSortDir === "asc" ? 1 : -1;
    arr.sort((a, b) => {
      switch (eventSortCol) {
        case "evento":
          return sign * a.evento.localeCompare(b.evento, "pt-BR");
        case "codigo":
          return sign * a.codigo.localeCompare(b.codigo, "pt-BR");
        case "categoria":
          return sign * a.categoria.localeCompare(b.categoria, "pt-BR");
        case "colaboradoresQtd":
          return sign * ((a.colaboradoresQtd || 0) - (b.colaboradoresQtd || 0));
        case "horas":
          return sign * ((a.horas || 0) - (b.horas || 0));
        case "ausentes":
          return sign * ((a.ausentes || 0) - (b.ausentes || 0));
        case "justificadas":
          return sign * ((a.justificadas || 0) - (b.justificadas || 0));
        case "extras":
          return sign * ((a.extras || 0) - (b.extras || 0));
        case "risco":
          return sign * ((a.risco || 0) - (b.risco || 0));
        case "eventos":
        default:
          return sign * ((a.eventos || 0) - (b.eventos || 0));
      }
    });
    return arr;
  }, [eventRows, eventSortCol, eventSortDir]);

  const eventTotals = useMemo(() => {
    const colaboradores = new Set();
    for (const row of eventRows) {
      for (const col of row.colaboradores || []) colaboradores.add(col);
    }
    return {
      eventos: eventRows.reduce((s, r) => s + r.eventos, 0),
      colaboradores: colaboradores.size,
      horas: eventRows.reduce((s, r) => s + r.horas, 0),
      ausentes: eventRows.reduce((s, r) => s + r.ausentes, 0),
      justificadas: eventRows.reduce((s, r) => s + r.justificadas, 0),
      extras: eventRows.reduce((s, r) => s + r.extras, 0),
      risco: eventRows.reduce((s, r) => s + r.risco, 0),
    };
  }, [eventRows]);

  const sortedColabRows = useMemo(() => {
    const arr = [...colabRows];
    const sign = colabSortDir === "asc" ? 1 : -1;
    arr.sort((a, b) => {
      switch (colabSortCol) {
        case "nome":
          return sign * a.nome.localeCompare(b.nome, "pt-BR");
        case "mat":
          return sign * a.mat.localeCompare(b.mat, "pt-BR");
        case "filial":
          return sign * a.filial.localeCompare(b.filial, "pt-BR");
        case "dept":
          return sign * a.dept.localeCompare(b.dept, "pt-BR");
        case "cargo":
          return sign * a.cargo.localeCompare(b.cargo, "pt-BR");
        case "diasQtd":
          return sign * ((a.diasQtd || 0) - (b.diasQtd || 0));
        case "eventos":
          return sign * ((a.eventos || 0) - (b.eventos || 0));
        case "horas_planejadas":
          return sign * ((a.horas_planejadas || 0) - (b.horas_planejadas || 0));
        case "horas_presentes":
          return sign * ((a.horas_presentes || 0) - (b.horas_presentes || 0));
        case "horas_ausentes":
          return sign * ((a.horas_ausentes || 0) - (b.horas_ausentes || 0));
        case "horas_justificadas":
          return sign * ((a.horas_justificadas || 0) - (b.horas_justificadas || 0));
        case "horas_extras":
          return sign * ((a.horas_extras || 0) - (b.horas_extras || 0));
        case "absenteismo":
        default:
          return sign * ((a.absenteismo || 0) - (b.absenteismo || 0));
      }
    });
    return arr;
  }, [colabRows, colabSortCol, colabSortDir]);

  const colabTotals = useMemo(() => {
    const { hp, ht, ha, hj, he, base } = computeGroupedTotals(colabRows);
    return {
      colaboradores: colabRows.length,
      dias: colabRows.reduce((s, r) => s + r.diasQtd, 0),
      eventos: colabRows.reduce((s, r) => s + r.eventos, 0),
      horas_planejadas: hp,
      horas_presentes: ht,
      horas_ausentes: ha,
      horas_justificadas: hj,
      horas_extras: he,
      absenteismo: base.absenteismo,
    };
  }, [colabRows]);

  useLayoutEffect(() => {
    if (!embeddedInChart || isFloating) return;
    const scrollEl = tableScrollRef.current;
    const wrapEl = scrollEl?.closest(".pb-hist-table-wrap");
    if (!scrollEl || !wrapEl) return;
    const syncScrollHeight = () => {
      const summaryEl = wrapEl.querySelector(".pb-hist-risk-summary");
      const summaryH = summaryEl?.offsetHeight ?? 0;
      const avail = wrapEl.clientHeight - summaryH;
      scrollEl.style.maxHeight = avail > 0 ? `${avail}px` : "";
    };
    syncScrollHeight();
    const ro = new ResizeObserver(syncScrollHeight);
    ro.observe(wrapEl);
    return () => {
      ro.disconnect();
      scrollEl.style.maxHeight = "";
    };
  }, [
    embeddedInChart,
    isFloating,
    tableView,
    riskRows.length,
    eventRows.length,
    colabRows.length,
    sortedRiskRows.length,
    sortedEventRows.length,
    sortedColabRows.length,
    expandedRisk.size,
    expandedEvents.size,
    expandedColabs.size,
  ]);

  /* available date range for empty state hint */
  const availableRange = useMemo(() => {
    if (!enriched.length) return null;
    const dates = enriched
      .map((r) => r.date)
      .filter(Boolean)
      .sort();
    const fmt = (iso) =>
      iso ? iso.slice(8, 10) + "/" + iso.slice(5, 7) + "/" + iso.slice(2, 4) : "";
    return `${fmt(dates[0])} – ${fmt(dates[dates.length - 1])}`;
  }, [enriched]);

  /* ── heatmap ranges ── */
  const heatmapRanges = useMemo(() => {
    const allRows = displayGrouped ? displayGrouped.flatMap(([, r]) => r) : displayRows;
    if (allRows.length < 4) return {};
    const ranges = {};
    for (const [id, cfg] of Object.entries(HEATMAP_CFG)) {
      const vals = allRows.map((r) => cfg.get(r)).filter((v) => v != null && !isNaN(v) && v >= 0);
      if (vals.length < 4) continue;
      const min = Math.min(...vals),
        max = Math.max(...vals);
      if (max - min < 0.001) continue;
      ranges[id] = { min, max, dir: cfg.dir };
    }
    return ranges;
  }, [displayGrouped, displayRows]);

  useLayoutEffect(() => {
    const syncLayout = () => {
      syncHistTotalsColumnWidths();
      syncHistTheadHeight();
    };
    syncLayout();
    const scrollEl = tableScrollRef.current;
    if (!scrollEl) return undefined;
    const ro = new ResizeObserver(syncLayout);
    ro.observe(scrollEl);
    const table = scrollEl.querySelector("table.pb-hist-table");
    if (table) ro.observe(table);
    const thead = scrollEl.querySelector("table.pb-hist-table thead");
    if (thead) ro.observe(thead);
    window.addEventListener("resize", syncLayout);
    return () => {
      ro.disconnect();
      window.removeEventListener("resize", syncLayout);
    };
  }, [
    syncHistTotalsColumnWidths,
    syncHistTheadHeight,
    tableView,
    visibleOrdered,
    colWidths,
    histTableWidth,
    displayRows.length,
    sorted.length,
    deptRows.length,
    cargoRows.length,
    generoRows.length,
    cidRows.length,
    riskRows.length,
    eventRows.length,
    colabRows.length,
    empRows?.length,
    hasHours,
    hasExtras,
    groupBy,
    collapsedGrp,
    expandedDates.size,
    expandedEvents.size,
    expandedColabs.size,
    dateSearch,
    isFloating,
    embeddedInChart,
  ]);

  function heatmapBg(colId, row) {
    const range = heatmapRanges[colId];
    if (!range) return undefined;
    const val = HEATMAP_CFG[colId]?.get(row);
    if (val == null || isNaN(val) || val < 0) return undefined;
    let t = (val - range.min) / (range.max - range.min);
    if (range.dir === "good") t = 1 - t;
    if (t < 0.08) return undefined;
    const alpha = (t * 0.22).toFixed(3);
    if (range.dir === "bad") return `rgba(239,68,68,${alpha})`;
    if (range.dir === "good") return `rgba(34,197,94,${alpha})`;
    if (range.dir === "warn") return `rgba(234,179,8,${alpha})`;
  }

  /* ── callbacks ── */
  const toggleSort = useCallback(
    (key) => {
      if (sortCol === key) {
        setSortDir((d) => (d === "asc" ? "desc" : "asc"));
      } else {
        setSortCol(key);
        setSortDir("desc");
      }
    },
    [sortCol],
  );

  const toggleDeptSort = useCallback(
    (key) => {
      if (deptSortCol === key) {
        setDeptSortDir((d) => (d === "asc" ? "desc" : "asc"));
      } else {
        setDeptSortCol(key);
        setDeptSortDir(key === "dept" ? "asc" : "desc");
      }
    },
    [deptSortCol],
  );

  const toggleExpand = useCallback((date) => {
    setExpandedDates((prev) => {
      const n = new Set(prev);
      n.has(date) ? n.delete(date) : n.add(date);
      return n;
    });
  }, []);

  const closeAllDrills = useCallback(() => {
    setExpandedDates(new Set());
    setExpandedDepts(new Set());
    setExpandedCargos(new Set());
    setExpandedGeneros(new Set());
    setExpandedCids(new Set());
    setExpandedRisk(new Set());
    setExpandedEvents(new Set());
    setExpandedColabs(new Set());
  }, []);

  useEffect(() => {
    const hasAnyDrillOpen =
      expandedDates.size +
        expandedDepts.size +
        expandedCargos.size +
        expandedGeneros.size +
        expandedCids.size +
        expandedRisk.size +
        expandedEvents.size +
        expandedColabs.size >
      0;
    if (!hasAnyDrillOpen) return undefined;
    const onKeyDown = (e) => {
      if (e.key !== "Escape") return;
      if (dayModal || absTrendModal || presenceProfileRow) return;
      closeAllDrills();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [
    expandedDates.size,
    expandedDepts.size,
    expandedCargos.size,
    expandedGeneros.size,
    expandedCids.size,
    expandedRisk.size,
    expandedEvents.size,
    expandedColabs.size,
    dayModal,
    absTrendModal,
    presenceProfileRow,
    closeAllDrills,
  ]);

  const toggleDeptExpand = useCallback((dept) => {
    setExpandedDepts((prev) => {
      const n = new Set(prev);
      n.has(dept) ? n.delete(dept) : n.add(dept);
      return n;
    });
  }, []);

  const toggleCargoSort = useCallback(
    (key) => {
      if (cargoSortCol === key) {
        setCargoSortDir((d) => (d === "asc" ? "desc" : "asc"));
      } else {
        setCargoSortCol(key);
        setCargoSortDir(key === "cargo" ? "asc" : "desc");
      }
    },
    [cargoSortCol],
  );

  const toggleCargoExpand = useCallback((cargo) => {
    setExpandedCargos((prev) => {
      const n = new Set(prev);
      n.has(cargo) ? n.delete(cargo) : n.add(cargo);
      return n;
    });
  }, []);

  const toggleGeneroSort = useCallback(
    (key) => {
      if (generoSortCol === key) {
        setGeneroSortDir((d) => (d === "asc" ? "desc" : "asc"));
      } else {
        setGeneroSortCol(key);
        setGeneroSortDir(key === "genero" ? "asc" : "desc");
      }
    },
    [generoSortCol],
  );

  const toggleGeneroExpand = useCallback((genero) => {
    setExpandedGeneros((prev) => {
      const n = new Set(prev);
      n.has(genero) ? n.delete(genero) : n.add(genero);
      return n;
    });
  }, []);


  const toggleCidSort = useCallback(
    (key) => {
      if (cidSortCol === key) {
        setCidSortDir((d) => (d === "asc" ? "desc" : "asc"));
      } else {
        setCidSortCol(key);
        setCidSortDir(key === "cidDescricao" || key === "cidCodigo" ? "asc" : "desc");
      }
    },
    [cidSortCol],
  );

  const toggleCidExpand = useCallback((label) => {
    setExpandedCids((prev) => {
      const n = new Set(prev);
      n.has(label) ? n.delete(label) : n.add(label);
      return n;
    });
  }, []);

  const toggleRiskSort = useCallback(
    (key) => {
      if (riskSortCol === key) {
        setRiskSortDir((d) => (d === "asc" ? "desc" : "asc"));
      } else {
        setRiskSortCol(key);
        setRiskSortDir(key === "evento" ? "asc" : "desc");
      }
    },
    [riskSortCol],
  );

  const toggleRiskExpand = useCallback((label) => {
    setExpandedRisk((prev) => {
      const n = new Set(prev);
      n.has(label) ? n.delete(label) : n.add(label);
      return n;
    });
  }, []);

  const toggleEventSort = useCallback(
    (key) => {
      if (eventSortCol === key) {
        setEventSortDir((d) => (d === "asc" ? "desc" : "asc"));
      } else {
        setEventSortCol(key);
        setEventSortDir(key === "evento" || key === "codigo" || key === "categoria" ? "asc" : "desc");
      }
    },
    [eventSortCol],
  );

  const toggleEventExpand = useCallback((key) => {
    setExpandedEvents((prev) => {
      const n = new Set(prev);
      n.has(key) ? n.delete(key) : n.add(key);
      return n;
    });
  }, []);

  const toggleColabSort = useCallback(
    (key) => {
      if (colabSortCol === key) {
        setColabSortDir((d) => (d === "asc" ? "desc" : "asc"));
      } else {
        setColabSortCol(key);
        setColabSortDir(key === "nome" || key === "mat" || key === "filial" || key === "dept" || key === "cargo" ? "asc" : "desc");
      }
    },
    [colabSortCol],
  );

  const toggleColabExpand = useCallback((key) => {
    setExpandedColabs((prev) => {
      const n = new Set(prev);
      n.has(key) ? n.delete(key) : n.add(key);
      return n;
    });
  }, []);

  const toggleGrp = useCallback((key) => {
    setCollapsedGrp((prev) => {
      const n = new Set(prev);
      n.has(key) ? n.delete(key) : n.add(key);
      return n;
    });
  }, []);

  const toggleColVis = useCallback((id) => {
    setVisibleCols((prev) => {
      const n = new Set(prev);
      n.has(id) ? n.delete(id) : n.add(id);
      return n;
    });
  }, []);

  /* ── cell value renderers ── */
  function cellVal(id, r) {
    switch (id) {
      case "hrs_plan":
        return fmtMin(r.horas_planejadas);
      case "hrs_trab":
        return fmtMin(r.horas_presentes);
      case "hrs_perd":
        return fmtMin(r._horasPerdidas);
      case "hrs_pct":
        return fmtPct(r._pctPerdidas);
      case "abs_idx":
        return fmtPct(r._absenteismo);
      case "pres":
        return (
          <>
            {(r.presentes || 0).toLocaleString("pt-BR")}
            <span className="pct"> ({r.presentesPct}%)</span>
          </>
        );
      case "ause_qtd":
        return r._ausentes.toLocaleString("pt-BR");
      case "ause_hrs":
        return fmtMin(r._horasAusentes);
      case "just_qtd":
        return (r.justificadas || 0).toLocaleString("pt-BR");
      case "just_hrs":
        return fmtMin(r.horas_justificadas);
      case "extr_qtd":
        return r.extras != null ? r.extras.toLocaleString("pt-BR") : "—";
      case "extr_hrs":
        return fmtMin(r.horas_extras);
      default:
        return "—";
    }
  }

  function totalCellVal(id, t) {
    switch (id) {
      case "hrs_plan":
        return fmtMin(t.horas_planejadas);
      case "hrs_trab":
        return fmtMin(t.horas_presentes);
      case "hrs_perd":
        return fmtMin(t.horas_perdidas);
      case "hrs_pct":
        return fmtPct(t.pct_perdidas);
      case "abs_idx":
        return fmtPct(t.absenteismo);
      case "pres":
        return (
          <>
            {t.presentes.toLocaleString("pt-BR")}
            <span className="pct"> ({t.presentesPctAvg}%)</span>
          </>
        );
      case "ause_qtd":
        return t.ausentes.toLocaleString("pt-BR");
      case "ause_hrs":
        return fmtMin(t.horas_ausentes);
      case "just_qtd":
        return t.justificadas.toLocaleString("pt-BR");
      case "just_hrs":
        return fmtMin(t.horas_justificadas);
      case "extr_qtd":
        return t.extras != null ? t.extras.toLocaleString("pt-BR") : "—";
      case "extr_hrs":
        return fmtMin(t.horas_extras);
      default:
        return "—";
    }
  }

  /* ── CSV export ── */
  function cellValStr(id, r) {
    switch (id) {
      case "hrs_plan":
        return fmtMin(r.horas_planejadas);
      case "hrs_trab":
        return fmtMin(r.horas_presentes);
      case "hrs_perd":
        return fmtMin(r._horasPerdidas);
      case "hrs_pct":
        return fmtPct(r._pctPerdidas);
      case "abs_idx":
        return fmtPct(r._absenteismo);
      case "pres":
        return `${r.presentes || 0} (${r.presentesPct}%)`;
      case "ause_qtd":
        return String(r._ausentes);
      case "ause_hrs":
        return fmtMin(r._horasAusentes);
      case "just_qtd":
        return String(r.justificadas || 0);
      case "just_hrs":
        return fmtMin(r.horas_justificadas);
      case "extr_qtd":
        return r.extras != null ? String(r.extras) : "—";
      case "extr_hrs":
        return fmtMin(r.horas_extras);
      default:
        return "—";
    }
  }
  function totalCellStr(id, t) {
    switch (id) {
      case "hrs_plan":
        return fmtMin(t.horas_planejadas);
      case "hrs_trab":
        return fmtMin(t.horas_presentes);
      case "hrs_perd":
        return fmtMin(t.horas_perdidas);
      case "hrs_pct":
        return fmtPct(t.pct_perdidas);
      case "abs_idx":
        return fmtPct(t.absenteismo);
      case "pres":
        return `${t.presentes} (${t.presentesPctAvg}%)`;
      case "ause_qtd":
        return String(t.ausentes);
      case "ause_hrs":
        return fmtMin(t.horas_ausentes);
      case "just_qtd":
        return String(t.justificadas);
      case "just_hrs":
        return fmtMin(t.horas_justificadas);
      case "extr_qtd":
        return t.extras != null ? String(t.extras) : "—";
      case "extr_hrs":
        return fmtMin(t.horas_extras);
      default:
        return "—";
    }
  }
  function exportCSV() {
    const sep = ";";
    const esc = (v) => `"${String(v ?? "").replace(/"/g, '""')}"`;
    const lines = [];
    if (empRows) {
      const name = empList.find(([m]) => m === selectedEmp)?.[1] ?? selectedEmp;
      lines.push(esc(`Colaborador: ${name}`));
      lines.push(
        [
          esc("Data"),
          esc("Status"),
          ...(hasHours
            ? [esc("Hrs.Plan."), esc("Hrs.Trab."), esc("Hrs.Aus."), esc("Hrs.Just.")]
            : []),
          ...(hasExtras ? [esc("Hrs.Extra")] : []),
        ].join(sep),
      );
      for (const r of empRows) {
        const isHol = !!r._meta?.feriado;
        const isWknd = !!r._meta?.isWeekend;
        const st = r.present ? "Presente" : isHol ? r._meta.feriado : isWknd ? "Folga" : "Ausente";
        lines.push(
          [
            esc(r._label),
            esc(st),
            ...(hasHours
              ? [
                  esc(fmtMin(r.hrsPlan)),
                  esc(fmtMin(r.hrsPres)),
                  esc(r.hrsAuse ? fmtMin(r.hrsAuse) : "—"),
                  esc(r.hrsJust ? fmtMin(r.hrsJust) : "—"),
                ]
              : []),
            ...(hasExtras ? [esc(r.hrsExtr ? fmtMin(r.hrsExtr) : "—")] : []),
          ].join(sep),
        );
      }
    } else {
      lines.push(
        visibleOrdered.map((c) => esc(c.prefix ? `${c.prefix} ${c.label}` : c.label)).join(sep),
      );
      const grp = displayGrouped;
      if (grp) {
        for (const [key, rows] of grp) {
          const lbl = formatGroupLabel(key, groupBy);
          lines.push(esc(lbl));
          for (const r of rows)
            lines.push(
              visibleOrdered
                .map((c) => esc(c.id === "date" ? r._label : cellValStr(c.id, r)))
                .join(sep),
            );
          if (rows.length > 1) {
            const st = computeTotals(rows, hasHours, hasExtras);
            lines.push(
              visibleOrdered
                .map((c) => esc(c.id === "date" ? `Subtotal — ${lbl}` : totalCellStr(c.id, st)))
                .join(sep),
            );
          }
        }
      } else {
        for (const r of displayRows)
          lines.push(
            visibleOrdered
              .map((c) => esc(c.id === "date" ? r._label : cellValStr(c.id, r)))
              .join(sep),
          );
      }
      const allRows = grp ? grp.flatMap(([, r]) => r) : displayRows;
      const tot = computeTotals(allRows, hasHours, hasExtras);
      lines.push(
        visibleOrdered
          .map((c) =>
            esc(c.id === "date" ? `Totais (${allRows.length}d)` : totalCellStr(c.id, tot)),
          )
          .join(sep),
      );
    }
    const blob = new Blob(["﻿" + lines.join("\r\n")], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `historico${dateFrom ? "-" + dateFrom : ""}${dateTo ? "-a-" + dateTo : ""}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  async function exportXLSX() {
    const xlsxMod = await import("xlsx-js-style");
    const XLSX = xlsxMod.default ?? xlsxMod;
    const fname = `historico${dateFrom ? "-" + dateFrom : ""}${dateTo ? "-a-" + dateTo : ""}.xlsx`;
    const buildRows = () => {
      const aoa = []; // array of arrays
      if (empRows) {
        const name = empList.find(([m]) => m === selectedEmp)?.[1] ?? selectedEmp;
        aoa.push([`Colaborador: ${name}`]);
        aoa.push([
          "Data",
          "Status",
          ...(hasHours ? ["Hrs.Plan.", "Hrs.Trab.", "Hrs.Aus.", "Hrs.Just."] : []),
          ...(hasExtras ? ["Hrs.Extra"] : []),
        ]);
        for (const r of empRows) {
          const isHol = !!r._meta?.feriado,
            isWknd = !!r._meta?.isWeekend;
          const st = r.present
            ? "Presente"
            : isHol
              ? r._meta.feriado
              : isWknd
                ? "Folga"
                : "Ausente";
          aoa.push([
            r._label,
            st,
            ...(hasHours
              ? [
                  fmtMin(r.hrsPlan),
                  fmtMin(r.hrsPres),
                  r.hrsAuse ? fmtMin(r.hrsAuse) : "—",
                  r.hrsJust ? fmtMin(r.hrsJust) : "—",
                ]
              : []),
            ...(hasExtras ? [r.hrsExtr ? fmtMin(r.hrsExtr) : "—"] : []),
          ]);
        }
      } else {
        const headers = visibleOrdered.map((c) => (c.prefix ? `${c.prefix} ${c.label}` : c.label));
        aoa.push(headers);
        const grp = displayGrouped;
        if (grp) {
          for (const [key, rows] of grp) {
            const lbl = formatGroupLabel(key, groupBy);
            aoa.push([lbl]);
            for (const r of rows)
              aoa.push(
                visibleOrdered.map((c) => (c.id === "date" ? r._label : cellValStr(c.id, r))),
              );
            if (rows.length > 1) {
              const st = computeTotals(rows, hasHours, hasExtras);
              aoa.push(
                visibleOrdered.map((c) =>
                  c.id === "date" ? `Subtotal — ${lbl}` : totalCellStr(c.id, st),
                ),
              );
            }
          }
        } else {
          for (const r of displayRows)
            aoa.push(visibleOrdered.map((c) => (c.id === "date" ? r._label : cellValStr(c.id, r))));
        }
        const allRows = grp ? grp.flatMap(([, r]) => r) : displayRows;
        const tot = computeTotals(allRows, hasHours, hasExtras);
        aoa.push(
          visibleOrdered.map((c) =>
            c.id === "date" ? `Totais (${allRows.length}d)` : totalCellStr(c.id, tot),
          ),
        );
      }
      return aoa;
    };
    const aoa = buildRows();
    const ws = XLSX.utils.aoa_to_sheet(aoa);
    /* bold header row */
    const hRowIdx = empRows ? 1 : 0;
    const ncols = aoa[hRowIdx]?.length ?? 1;
    for (let c = 0; c < ncols; c++) {
      const addr = XLSX.utils.encode_cell({ r: hRowIdx, c });
      if (ws[addr]) ws[addr].s = { font: { bold: true } };
    }
    /* bold totals row */
    const lastR = aoa.length - 1;
    for (let c = 0; c < ncols; c++) {
      const addr = XLSX.utils.encode_cell({ r: lastR, c });
      if (ws[addr]) ws[addr].s = { font: { bold: true } };
    }
    /* column widths */
    ws["!cols"] = aoa[hRowIdx]?.map((h, i) => ({
      wch: Math.min(30, Math.max(10, ...aoa.map((row) => String(row[i] ?? "").length))),
    }));
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Histórico");
    XLSX.writeFile(wb, fname);
  }

  async function exportPDF() {
    try {
      const [{ jsPDF }, { default: autoTable }] = await Promise.all([
        import("jspdf"),
        import("jspdf-autotable"),
      ]);
      const fname = `historico${dateFrom ? "-" + dateFrom : ""}${dateTo ? "-a-" + dateTo : ""}.pdf`;
      const doc = new jsPDF({ orientation: "landscape", unit: "pt", format: "a4" });

      let headers, body;
      if (empRows) {
        const name = empList.find(([m]) => m === selectedEmp)?.[1] ?? selectedEmp;
        doc.setFontSize(11);
        doc.text(`Colaborador: ${name}`, 40, 36);
        headers = [
          [
            "Data",
            "Status",
            ...(hasHours ? ["Hrs.Plan.", "Hrs.Trab.", "Hrs.Aus.", "Hrs.Just."] : []),
            ...(hasExtras ? ["Hrs.Extra"] : []),
          ],
        ];
        body = empRows.map((r) => {
          const isHol = !!r._meta?.feriado,
            isWknd = !!r._meta?.isWeekend;
          const st = r.present
            ? "Presente"
            : isHol
              ? r._meta.feriado
              : isWknd
                ? "Folga"
                : "Ausente";
          return [
            r._label,
            st,
            ...(hasHours
              ? [
                  fmtMin(r.hrsPlan),
                  fmtMin(r.hrsPres),
                  r.hrsAuse ? fmtMin(r.hrsAuse) : "—",
                  r.hrsJust ? fmtMin(r.hrsJust) : "—",
                ]
              : []),
            ...(hasExtras ? [r.hrsExtr ? fmtMin(r.hrsExtr) : "—"] : []),
          ];
        });
      } else {
        headers = [visibleOrdered.map((c) => (c.prefix ? `${c.prefix} ${c.label}` : c.label))];
        body = [];
        const grp = displayGrouped;
        if (grp) {
          for (const [key, rows] of grp) {
            const lbl = formatGroupLabel(key, groupBy);
            body.push([
              {
                content: lbl,
                colSpan: visibleOrdered.length,
                styles: { fontStyle: "bold", fillColor: [30, 41, 59] },
              },
            ]);
            for (const r of rows)
              body.push(
                visibleOrdered.map((c) => (c.id === "date" ? r._label : cellValStr(c.id, r))),
              );
            if (rows.length > 1) {
              const st = computeTotals(rows, hasHours, hasExtras);
              body.push(
                visibleOrdered.map((c) => ({
                  content: c.id === "date" ? `Subtotal — ${lbl}` : totalCellStr(c.id, st),
                  styles: { fontStyle: "bold" },
                })),
              );
            }
          }
        } else {
          for (const r of displayRows)
            body.push(
              visibleOrdered.map((c) => (c.id === "date" ? r._label : cellValStr(c.id, r))),
            );
        }
        const allRows = grp ? grp.flatMap(([, r]) => r) : displayRows;
        const tot = computeTotals(allRows, hasHours, hasExtras);
        body.push(
          visibleOrdered.map((c) => ({
            content: c.id === "date" ? `Totais (${allRows.length}d)` : totalCellStr(c.id, tot),
            styles: { fontStyle: "bold" },
          })),
        );
      }

      autoTable(doc, {
        head: headers,
        body,
        startY: empRows ? 50 : 30,
        styles: { fontSize: 8, cellPadding: 3 },
        headStyles: { fillColor: [30, 41, 59], textColor: [226, 232, 240], fontStyle: "bold" },
        alternateRowStyles: { fillColor: [248, 250, 252] },
        margin: { left: 30, right: 30 },
      });
      doc.save(fname);
    } catch (err) {
      console.error("exportPDF:", err);
      alert("Erro ao gerar PDF: " + err.message);
    }
  }

  /* ── render helpers ── */
  function tdCls(col) {
    const gc = col.group ? GRP_CLS[col.group] : "";
    return [
      "num",
      gc,
      firstOfGroup.has(col.id) ? "col-start" : "",
      highlightCol === col.id ? "col-highlight" : "",
    ]
      .filter(Boolean)
      .join(" ");
  }

  function renderDrillCloseButton(onClose, ariaLabel) {
    return (
      <button
        type="button"
        className="pb-drill-close"
        onClick={onClose}
        aria-label={ariaLabel}
        title={ariaLabel}
      >
        <span className="pb-drill-close-label">Fechar</span>
        <span className="pb-drill-close-icon" aria-hidden="true">
          ×
        </span>
      </button>
    );
  }

  function renderDataRow(r, i) {
    const isExpanded = expandedDates.has(r.date);
    const drillEmployees = Array.isArray(r._employees) ? r._employees : [];
    const hasEmps = drillEmployees.length > 0;
    const hasArt473 = (r._events || []).some((ev) => isArt473PreventivaEvent(ev, r));
    const drillEventsByEmployee = new Map();
    for (const event of r._events || []) {
      const key = String(event.mat || event.nome || "").trim();
      if (!key) continue;
      if (!drillEventsByEmployee.has(key)) {
        drillEventsByEmployee.set(key, { horarios: [], marcacoes: [] });
      }
      const values = drillEventsByEmployee.get(key);
      const horario = String(event.horario || "")
        .trim()
        .replace(/^\d+\s*-\s*(?=\d{1,2}:\d{2}\b)/, "");
      const marcacao = String(event.marcacao || "").trim();
      if (horario && !values.horarios.includes(horario)) values.horarios.push(horario);
      if (marcacao && marcacao !== horario && !values.marcacoes.includes(marcacao)) {
        values.marcacoes.push(marcacao);
      }
    }
    const drillTotals = hasHours && hasEmps
      ? drillEmployees.reduce(
          (totals, emp) => {
            totals.plan += emp.hrsPlan || 0;
            totals.trab += capWorkedHours(emp.hrsPres, emp.hrsPlan);
            totals.ause += emp.hrsAuse || 0;
            totals.just += emp.hrsJust || 0;
            totals.extr += emp.hrsExtr || 0;
            return totals;
          },
          { plan: 0, trab: 0, acima: 0, ause: 0, just: 0, extr: 0 },
        )
      : { plan: 0, trab: 0, acima: 0, ause: 0, just: 0, extr: 0 };
    const acimaPlanejado = 0;
    const colaboradoresAcimaPlanejado = 0;
    return (
      <React.Fragment key={r.date || i}>
        <tr className={r._isBest ? "row-best" : r._isWorst ? "row-worst" : ""}>
          {visibleOrdered.map((col) => {
            if (col.id === "date")
              return (
                <td
                  key="date"
                  className={`date-cell${r._meta?.feriado ? " is-feriado" : r._meta?.isPonte ? " is-ponte" : r._meta?.isDomingo ? " is-domingo" : ""}`}
                >
                  <button
                    type="button"
                    className={`pb-drill-toggle${isExpanded ? " open" : ""}`}
                    onClick={() => toggleExpand(r.date)}
                    aria-expanded={isExpanded}
                    title="Abrir detalhes do dia"
                  >
                    &gt;
                  </button>
                  <button
                    type="button"
                    className="pb-date-link"
                    onClick={() => openDayModal(r)}
                    title="Abrir planilha do dia"
                  >
                    {r._label}
                  </button>
                  {r._meta?.feriado && (
                    <span className="pb-hist-badge feriado">{r._meta.feriado}</span>
                  )}
                  {!r._meta?.feriado && r._meta?.isPonte && (
                    <span className="pb-hist-badge ponte">ponte</span>
                  )}
                  {r._isBest && (
                    <span className="pb-hist-badge best" title="Melhor dia">
                      ▲
                    </span>
                  )}
                  {r._isWorst && (
                    <span className="pb-hist-badge worst" title="Pior dia">
                      ▼
                    </span>
                  )}
                  {hasArt473 && (
                    <span className="pb-hist-badge art473" title="Ausência preventiva (art. 473, XII, CLT)">
                      473
                    </span>
                  )}
                </td>
              );
            const bg = heatmapBg(col.id, r);
            return (
              <td
                key={col.id}
                className={tdCls(col)}
                data-col-id={col.id}
                style={bg ? { background: bg } : undefined}
              >
                {cellVal(col.id, r)}
              </td>
            );
          })}
        </tr>
        {isExpanded && (
          <tr className="pb-drill-row">
            <td colSpan={visibleOrdered.length} className="pb-drill-cell">
              <div className="pb-drill-inner pb-drill-inner--day">
                <div
                  className={[
                    "pb-drill-day-toolbar",
                    !hasHours && "pb-drill-day-toolbar--no-hours",
                    hasHours && !hasExtras && "pb-drill-day-toolbar--no-extras-col",
                  ]
                    .filter(Boolean)
                    .join(" ")}
                >
                  <div className="pb-drill-day-toolbar-start">
                    <span className="pb-drill-header-title">{r._label}</span>
                    {renderDrillCloseButton(
                      () => toggleExpand(r.date),
                      `Fechar colaboradores do dia ${r._label}`,
                    )}
                  </div>
                </div>
                {acimaPlanejado > 0 && (
                  <div className="pb-drill-over-summary">
                    <strong>Acima do planejado: {fmtMin(acimaPlanejado)}</strong>
                    <span>
                      {colaboradoresAcimaPlanejado.toLocaleString("pt-BR")} colaborador(es) com
                      Hrs.Trab. maior que Hrs.Plan. Este valor pode diferir de Extras.
                    </span>
                  </div>
                )}
                <div className="pb-drill-table-scroll pb-drill-table-scroll--employee">
                <table
                  className={[
                    "pb-drill-table",
                    "pb-drill-table--day-emp",
                    !hasHours && "pb-drill-table--no-hours",
                    hasHours && !hasExtras && "pb-drill-table--no-extras-col",
                  ]
                    .filter(Boolean)
                    .join(" ")}
                >
                  <colgroup>
                    <col className="pb-drill-col-name" />
                    <col className="pb-drill-col-schedule" />
                    <col className="pb-drill-col-punches" />
                    {hasHours && (
                      <>
                        <col className="pb-drill-col-num" />
                        <col className="pb-drill-col-num" />
                        <col className="pb-drill-col-num" />
                        <col className="pb-drill-col-num" />
                        <col className="pb-drill-col-num" />
                        {hasExtras && <col className="pb-drill-col-num" />}
                      </>
                    )}
                  </colgroup>
                  <thead>
                    <tr>
                      <th className="pb-drill-th-name">Colaborador</th>
                      <th className="pb-drill-th-text pb-drill-th-schedule">Horário</th>
                      <th className="pb-drill-th-text pb-drill-th-punches">Marcações</th>
                      {hasHours && <th className="pb-drill-th-num">Hrs.Plan.</th>}
                      {hasHours && <th className="pb-drill-th-num">Hrs.Trab.</th>}
                      {hasHours && <th className="pb-drill-th-num pb-drill-th-over">Acima plan.</th>}
                      {hasHours && <th className="pb-drill-th-num">Ausentes</th>}
                      {hasHours && <th className="pb-drill-th-num">Justif.</th>}
                      {hasHours && hasExtras && <th className="pb-drill-th-num">Extras</th>}
                    </tr>
                  </thead>
                  <tbody>
                    {!hasEmps && (
                      <tr>
                        <td className="pb-drill-empty" colSpan={hasHours ? (hasExtras ? 9 : 8) : 3}>
                          Sem colaboradores ou eventos importados para este dia.
                        </td>
                      </tr>
                    )}
                    {drillEmployees.map((emp) => {
                      const horasAcimaPlanejado = 0;
                      const detailKey = String(emp.mat || emp.nome || "").trim();
                      const detail = drillEventsByEmployee.get(detailKey) || { horarios: [], marcacoes: [] };
                      const horario = detail.horarios.join(" / ") || "—";
                      const marcacoes = detail.marcacoes.join(" / ") || "—";
                      return (
                        <tr
                          key={emp.mat}
                          className={`pb-drill-emp-row${isPresenceProfileActive(emp) ? " pb-drill-emp-row--active" : ""}`}
                        >
                          {renderDrillEmpName(emp)}
                          <td className="pb-drill-td-text pb-drill-td-schedule" title={horario}>{horario}</td>
                          <td className="pb-drill-td-text pb-drill-td-punches" title={marcacoes}>{marcacoes}</td>
                          {hasHours && <td className="pb-drill-td-num">{fmtMin(emp.hrsPlan)}</td>}
                          {hasHours && <td className="pb-drill-td-num">{fmtMin(emp.hrsPres)}</td>}
                          {hasHours && (
                            <td className={`pb-drill-td-num pb-drill-td-over${horasAcimaPlanejado > 0 ? " has-over" : ""}`}>
                              {horasAcimaPlanejado > 0 ? `+${fmtMin(horasAcimaPlanejado)}` : "—"}
                            </td>
                          )}
                          {hasHours && <td className="pb-drill-td-num">{fmtMin(emp.hrsAuse)}</td>}
                          {hasHours && <td className="pb-drill-td-num">{fmtMin(emp.hrsJust)}</td>}
                          {hasHours && hasExtras && (
                            <td className="pb-drill-td-num">{fmtMin(emp.hrsExtr)}</td>
                          )}
                        </tr>
                      );
                    })}
                  </tbody>
                  {hasHours && (
                    <tfoot>
                      <tr className="pb-drill-totals-row">
                        <td className="pb-drill-td-name pb-drill-td-totals-label" colSpan={3}>
                          Totais
                        </td>
                        <td className="pb-drill-td-num">{fmtMin(drillTotals.plan)}</td>
                        <td className="pb-drill-td-num">{fmtMin(drillTotals.trab)}</td>
                        <td className={`pb-drill-td-num pb-drill-td-over${acimaPlanejado > 0 ? " has-over" : ""}`}>
                          {acimaPlanejado > 0 ? `+${fmtMin(acimaPlanejado)}` : "—"}
                        </td>
                        <td className="pb-drill-td-num">{fmtMin(drillTotals.ause)}</td>
                        <td className="pb-drill-td-num">{fmtMin(drillTotals.just)}</td>
                        {hasExtras && <td className="pb-drill-td-num">{fmtMin(drillTotals.extr)}</td>}
                      </tr>
                    </tfoot>
                  )}
                </table>
                </div>
              </div>
            </td>
          </tr>
        )}
      </React.Fragment>
    );
  }

  function renderGroupSubtotal(rows, label) {
    const st = computeTotals(rows, hasHours, hasExtras);
    return (
      <tr key={`sub-${label}`} className="pb-grp-subtotal">
        {visibleOrdered.map((col) => {
          if (col.id === "date")
            return (
              <td key="date" className="pb-grp-sub-lbl">
                Subtotal — {label} <span className="pct">({rows.length}d)</span>
              </td>
            );
          return (
            <td key={col.id} className={tdCls(col)}>
              {totalCellVal(col.id, st)}
            </td>
          );
        })}
      </tr>
    );
  }

  function deptSortHeader(label, key, className = "") {
    const active = deptSortCol === key;
    return groupSortHeader("dept", label, key, className, active, deptSortDir, toggleDeptSort);
  }

  const deptColSpan =
    2 + (hasHours ? 5 : 0) + 2 + (hasHours ? 1 : 0) + 1 + (hasHours ? 1 : 0) + (hasExtras ? 2 : 0);

  const resolveEmpDepto = useCallback(
    (mat, nome = "") => {
      const matKey = String(mat ?? "").trim();
      const nameKey = String(nome ?? "").trim().toLowerCase();
      for (const row of presenceHistRows) {
        const match = (row._employees || []).find((e) => {
          if (matKey && String(e?.mat ?? "").trim() === matKey) return true;
          return nameKey && String(e?.nome ?? "").trim().toLowerCase() === nameKey;
        });
        if (match) return cleanGroupText(match.depto_desc || match.depto, "Sem departamento");
      }
      return "—";
    },
    [presenceHistRows],
  );

  const resolveEmpIdentity = useCallback(
    (emp) => {
      const matKey = String(emp?.mat ?? "").trim();
      const nome = emp?.nome || emp?.mat || "—";
      if (matKey) return { mat: emp.mat, nome };
      const nameKey = String(nome).trim().toLowerCase();
      for (const row of presenceHistRows) {
        const match = (row._employees || []).find(
          (e) =>
            String(e?.nome ?? "").trim().toLowerCase() === nameKey &&
            String(e?.mat ?? "").trim(),
        );
        if (match) return { mat: match.mat, nome: match.nome || nome };
      }
      return { mat: emp?.mat, nome };
    },
    [presenceHistRows],
  );

  const openPresenceProfile = useCallback(
    (emp, context = {}) => {
      const identity = resolveEmpIdentity(emp);
      setPresenceProfileRow({
        mat: identity.mat,
        nome: identity.nome,
        depto:
          context.depto ||
          cleanGroupText(emp.depto_desc || emp.depto, resolveEmpDepto(identity.mat, identity.nome)),
      });
    },
    [resolveEmpDepto, resolveEmpIdentity],
  );

  const isPresenceProfileActive = useCallback(
    (emp) => {
      if (!presenceProfileRow) return false;
      const openMat = String(presenceProfileRow.mat ?? "").trim();
      const empMat = String(emp?.mat ?? "").trim();
      if (openMat && empMat) return openMat === empMat;
      return (
        String(presenceProfileRow.nome ?? "").trim().toLowerCase() ===
        String(emp?.nome ?? "").trim().toLowerCase()
      );
    },
    [presenceProfileRow],
  );

  function renderDrillEmpName(emp, context = {}) {
    const label = emp.nome || emp.mat || "—";
    const isActive = isPresenceProfileActive(emp);
    return (
      <td className="pb-drill-td-name" title={label}>
        <button
          type="button"
          className={`pb-drill-emp-link${isActive ? " is-active" : ""}`}
          onClick={() => openPresenceProfile(emp, context)}
          title="Ver ficha de presença"
        >
          {label}
        </button>
      </td>
    );
  }

  function renderDeptDrill(r) {
    const detail = deptDrillMap.get(r.dept) || { criticalDays: [], employees: [] };
    const acimaPlanejado = 0;
    const dayColumnCount = hasExtras ? 7 : 5;
    const employeeColumnCount = 4 + (hasHours ? 2 : 0) + (hasExtras ? 1 : 0);
    const criticalTotals = detail.criticalDays.reduce(
      (totals, day) => ({
        ausentes: totals.ausentes + day.ausentes,
        hrsAuse: totals.hrsAuse + day.hrsAuse,
        justificadas: totals.justificadas + day.justificadas,
        hrsJust: totals.hrsJust + day.hrsJust,
        extras: totals.extras + day.extras,
        hrsExtr: totals.hrsExtr + day.hrsExtr,
      }),
      { ausentes: 0, hrsAuse: 0, justificadas: 0, hrsJust: 0, extras: 0, hrsExtr: 0 },
    );
    const employeeTotals = detail.employees.reduce(
      (totals, emp) => ({
        hrsPlan: totals.hrsPlan + emp.hrsPlan,
        hrsPres: totals.hrsPres + emp.hrsPres,
        hrsAuse: totals.hrsAuse + emp.hrsAuse,
        hrsJust: totals.hrsJust + emp.hrsJust,
        hrsExtr: totals.hrsExtr + emp.hrsExtr,
      }),
      { hrsPlan: 0, hrsPres: 0, hrsAuse: 0, hrsJust: 0, hrsExtr: 0 },
    );
    return (
      <tr className="pb-drill-row pb-drill-row--sticky-group">
        <td colSpan={deptColSpan} className="pb-drill-cell">
          <div className="pb-drill-inner pb-dept-drill">
            <div className="pb-drill-header pb-drill-header--start">
              {renderDrillCloseButton(
                () => toggleDeptExpand(r.dept),
                `Fechar detalhe do departamento ${r.dept}`,
              )}
            </div>
            <div className="pb-dept-drill-summary">
              <span><strong>{r.colaboradoresQtd.toLocaleString("pt-BR")}</strong> colaboradores</span>
              <span className="is-absence"><strong>{r.ausentes.toLocaleString("pt-BR")}</strong> ausentes / {fmtMin(r.horas_ausentes)}</span>
              <span className="is-justified"><strong>{r.justificadas.toLocaleString("pt-BR")}</strong> justificadas / {fmtMin(r.horas_justificadas)}</span>
              {hasExtras && (
                <span className="is-extra"><strong>{r.extras.toLocaleString("pt-BR")}</strong> extras / {fmtMin(r.horas_extras)}</span>
              )}
              {hasHours && acimaPlanejado > 0 && (
                <span className="is-over"><strong>+{fmtMin(acimaPlanejado)}</strong> acima do planejado</span>
              )}
            </div>
            <div className="pb-dept-drill-grid">
            <section className="pb-dept-drill-panel">
              <div className="pb-emp-sum-name" style={{ marginBottom: 6 }}>
                Dias críticos
              </div>
              <div className="pb-dept-drill-scroll-outer">
              <div className="pb-dept-drill-table-shell">
              <table className="pb-drill-table pb-dept-drill-days">
                <thead>
                  <tr>
                    <th className="pb-drill-th-name">Data</th>
                    <th className="pb-drill-th-num">Qtd. Aus.</th>
                    <th className="pb-drill-th-num">Hrs. Aus.</th>
                    <th className="pb-drill-th-num">Qtd. Just.</th>
                    <th className="pb-drill-th-num">Hrs. Just.</th>
                    {hasExtras && <th className="pb-drill-th-num">Qtd. Extras</th>}
                    {hasExtras && <th className="pb-drill-th-num">Hrs. Extras</th>}
                  </tr>
                </thead>
                <tbody>
                  {detail.criticalDays.length === 0 ? (
                    <tr>
                      <td colSpan={dayColumnCount} className="pb-drill-td-name">
                        Sem dias críticos no período.
                      </td>
                    </tr>
                  ) : (
                    detail.criticalDays.map((d) => (
                      <tr key={d.date} className="pb-drill-emp-row">
                        <td className="pb-drill-td-name">{d.label}</td>
                        <td className="pb-drill-td-num">{d.ausentes.toLocaleString("pt-BR")}</td>
                        <td className="pb-drill-td-num">{fmtMin(d.hrsAuse)}</td>
                        <td className="pb-drill-td-num">{d.justificadas.toLocaleString("pt-BR")}</td>
                        <td className="pb-drill-td-num">{fmtMin(d.hrsJust)}</td>
                        {hasExtras && <td className="pb-drill-td-num">{d.extras.toLocaleString("pt-BR")}</td>}
                        {hasExtras && <td className="pb-drill-td-num">{fmtMin(d.hrsExtr)}</td>}
                      </tr>
                    ))
                  )}
                </tbody>
                {detail.criticalDays.length > 0 && (
                  <tfoot>
                    <tr className="pb-drill-totals-row">
                      <td className="pb-drill-td-name">Totais exibidos</td>
                      <td className="pb-drill-td-num">{criticalTotals.ausentes.toLocaleString("pt-BR")}</td>
                      <td className="pb-drill-td-num">{fmtMin(criticalTotals.hrsAuse)}</td>
                      <td className="pb-drill-td-num">{criticalTotals.justificadas.toLocaleString("pt-BR")}</td>
                      <td className="pb-drill-td-num">{fmtMin(criticalTotals.hrsJust)}</td>
                      {hasExtras && <td className="pb-drill-td-num">{criticalTotals.extras.toLocaleString("pt-BR")}</td>}
                      {hasExtras && <td className="pb-drill-td-num">{fmtMin(criticalTotals.hrsExtr)}</td>}
                    </tr>
                  </tfoot>
                )}
              </table>
              </div>
              </div>
            </section>
            <section className="pb-dept-drill-panel">
              <div className="pb-emp-sum-name" style={{ marginBottom: 6 }}>
                Colaboradores impactados
              </div>
              <div className="pb-dept-drill-scroll-outer">
              <div className="pb-dept-drill-table-shell">
              <table className="pb-drill-table pb-dept-drill-employees">
                <thead>
                  <tr>
                    <th className="pb-drill-th-name">Colaborador</th>
                    <th className="pb-drill-th-name">Status</th>
                    {hasHours && <th className="pb-drill-th-num">Hrs.Plan.</th>}
                    {hasHours && <th className="pb-drill-th-num">Hrs.Trab.</th>}
                    <th className="pb-drill-th-num">Hrs. Aus.</th>
                    <th className="pb-drill-th-num">Hrs. Just.</th>
                    {hasExtras && <th className="pb-drill-th-num">Hrs. Extras</th>}
                  </tr>
                </thead>
                <tbody>
                  {detail.employees.length === 0 ? (
                    <tr>
                      <td colSpan={employeeColumnCount} className="pb-drill-td-name">
                        Sem colaboradores com ocorrências no período.
                      </td>
                    </tr>
                  ) : (
                    detail.employees.map((emp) => (
                      <tr
                        key={emp.mat || emp.nome}
                        className={`pb-drill-emp-row${isPresenceProfileActive(emp) ? " pb-drill-emp-row--active" : ""}`}
                      >
                        {renderDrillEmpName(emp, { depto: r.dept })}
                        <td className="pb-drill-status-cell">
                          {(emp.hrsAuse || 0) > 0 && <span className="pb-drill-status is-absence">Ausência</span>}
                          {(emp.hrsJust || 0) > 0 && <span className="pb-drill-status is-justified">Justificada</span>}
                          {(emp.hrsExtr || 0) > 0 && <span className="pb-drill-status is-extra">Extra</span>}
                        </td>
                        {hasHours && <td className="pb-drill-td-num">{fmtMin(emp.hrsPlan)}</td>}
                        {hasHours && <td className="pb-drill-td-num">{fmtMin(emp.hrsPres)}</td>}
                        <td className="pb-drill-td-num">{fmtMin(emp.hrsAuse)}</td>
                        <td className="pb-drill-td-num">{fmtMin(emp.hrsJust)}</td>
                        {hasExtras && <td className="pb-drill-td-num">{fmtMin(emp.hrsExtr)}</td>}
                      </tr>
                    ))
                  )}
                </tbody>
                {detail.employees.length > 0 && (
                  <tfoot>
                    <tr className="pb-drill-totals-row">
                      <td className="pb-drill-td-name">Totais</td>
                      <td className="pb-drill-status-cell" />
                      {hasHours && <td className="pb-drill-td-num">{fmtMin(employeeTotals.hrsPlan)}</td>}
                      {hasHours && <td className="pb-drill-td-num">{fmtMin(employeeTotals.hrsPres)}</td>}
                      <td className="pb-drill-td-num">{fmtMin(employeeTotals.hrsAuse)}</td>
                      <td className="pb-drill-td-num">{fmtMin(employeeTotals.hrsJust)}</td>
                      {hasExtras && <td className="pb-drill-td-num">{fmtMin(employeeTotals.hrsExtr)}</td>}
                    </tr>
                  </tfoot>
                )}
              </table>
              </div>
              </div>
            </section>
            </div>
          </div>
        </td>
      </tr>
    );
  }

  function cargoSortHeader(label, key, className = "") {
    const active = cargoSortCol === key;
    return groupSortHeader("cargo", label, key, className, active, cargoSortDir, toggleCargoSort);
  }

  const cargoColSpan =
    2 + (hasHours ? 5 : 0) + 2 + (hasHours ? 1 : 0) + 1 + (hasHours ? 1 : 0) + (hasExtras ? 2 : 0);

  function renderCargoDrill(r) {
    const detail = cargoDrillMap.get(r.cargo) || { criticalDays: [], employees: [] };
    const acimaPlanejado = 0;
    const dayColumnCount = hasExtras ? 7 : 5;
    const employeeColumnCount = 4 + (hasHours ? 2 : 0) + (hasExtras ? 1 : 0);
    const criticalTotals = detail.criticalDays.reduce(
      (totals, day) => ({
        ausentes: totals.ausentes + day.ausentes,
        hrsAuse: totals.hrsAuse + day.hrsAuse,
        justificadas: totals.justificadas + day.justificadas,
        hrsJust: totals.hrsJust + day.hrsJust,
        extras: totals.extras + day.extras,
        hrsExtr: totals.hrsExtr + day.hrsExtr,
      }),
      { ausentes: 0, hrsAuse: 0, justificadas: 0, hrsJust: 0, extras: 0, hrsExtr: 0 },
    );
    const employeeTotals = detail.employees.reduce(
      (totals, emp) => ({
        hrsPlan: totals.hrsPlan + emp.hrsPlan,
        hrsPres: totals.hrsPres + emp.hrsPres,
        hrsAuse: totals.hrsAuse + emp.hrsAuse,
        hrsJust: totals.hrsJust + emp.hrsJust,
        hrsExtr: totals.hrsExtr + emp.hrsExtr,
      }),
      { hrsPlan: 0, hrsPres: 0, hrsAuse: 0, hrsJust: 0, hrsExtr: 0 },
    );
    return (
      <tr className="pb-drill-row pb-drill-row--sticky-group">
        <td colSpan={cargoColSpan} className="pb-drill-cell">
          <div className="pb-drill-inner pb-dept-drill">
            <div className="pb-drill-header pb-drill-header--start">
              {renderDrillCloseButton(
                () => toggleCargoExpand(r.cargo),
                `Fechar detalhe do cargo ${r.cargo}`,
              )}
            </div>
            <div className="pb-dept-drill-summary">
              <span><strong>{r.colaboradoresQtd.toLocaleString("pt-BR")}</strong> colaboradores</span>
              <span className="is-absence"><strong>{r.ausentes.toLocaleString("pt-BR")}</strong> ausentes / {fmtMin(r.horas_ausentes)}</span>
              <span className="is-justified"><strong>{r.justificadas.toLocaleString("pt-BR")}</strong> justificadas / {fmtMin(r.horas_justificadas)}</span>
              {hasExtras && (
                <span className="is-extra"><strong>{r.extras.toLocaleString("pt-BR")}</strong> extras / {fmtMin(r.horas_extras)}</span>
              )}
              {hasHours && acimaPlanejado > 0 && (
                <span className="is-over"><strong>+{fmtMin(acimaPlanejado)}</strong> acima do planejado</span>
              )}
            </div>
            <div className="pb-dept-drill-grid">
            <section className="pb-dept-drill-panel">
              <div className="pb-emp-sum-name" style={{ marginBottom: 6 }}>
                Dias críticos
              </div>
              <div className="pb-dept-drill-scroll-outer">
              <div className="pb-dept-drill-table-shell">
              <table className="pb-drill-table pb-dept-drill-days">
                <thead>
                  <tr>
                    <th className="pb-drill-th-name">Data</th>
                    <th className="pb-drill-th-num">Qtd. Aus.</th>
                    <th className="pb-drill-th-num">Hrs. Aus.</th>
                    <th className="pb-drill-th-num">Qtd. Just.</th>
                    <th className="pb-drill-th-num">Hrs. Just.</th>
                    {hasExtras && <th className="pb-drill-th-num">Qtd. Extras</th>}
                    {hasExtras && <th className="pb-drill-th-num">Hrs. Extras</th>}
                  </tr>
                </thead>
                <tbody>
                  {detail.criticalDays.length === 0 ? (
                    <tr>
                      <td colSpan={dayColumnCount} className="pb-drill-td-name">
                        Sem dias críticos no período.
                      </td>
                    </tr>
                  ) : (
                    detail.criticalDays.map((d) => (
                      <tr key={d.date} className="pb-drill-emp-row">
                        <td className="pb-drill-td-name">{d.label}</td>
                        <td className="pb-drill-td-num">{d.ausentes.toLocaleString("pt-BR")}</td>
                        <td className="pb-drill-td-num">{fmtMin(d.hrsAuse)}</td>
                        <td className="pb-drill-td-num">{d.justificadas.toLocaleString("pt-BR")}</td>
                        <td className="pb-drill-td-num">{fmtMin(d.hrsJust)}</td>
                        {hasExtras && <td className="pb-drill-td-num">{d.extras.toLocaleString("pt-BR")}</td>}
                        {hasExtras && <td className="pb-drill-td-num">{fmtMin(d.hrsExtr)}</td>}
                      </tr>
                    ))
                  )}
                </tbody>
                {detail.criticalDays.length > 0 && (
                  <tfoot>
                    <tr className="pb-drill-totals-row">
                      <td className="pb-drill-td-name">Totais exibidos</td>
                      <td className="pb-drill-td-num">{criticalTotals.ausentes.toLocaleString("pt-BR")}</td>
                      <td className="pb-drill-td-num">{fmtMin(criticalTotals.hrsAuse)}</td>
                      <td className="pb-drill-td-num">{criticalTotals.justificadas.toLocaleString("pt-BR")}</td>
                      <td className="pb-drill-td-num">{fmtMin(criticalTotals.hrsJust)}</td>
                      {hasExtras && <td className="pb-drill-td-num">{criticalTotals.extras.toLocaleString("pt-BR")}</td>}
                      {hasExtras && <td className="pb-drill-td-num">{fmtMin(criticalTotals.hrsExtr)}</td>}
                    </tr>
                  </tfoot>
                )}
              </table>
              </div>
              </div>
            </section>
            <section className="pb-dept-drill-panel">
              <div className="pb-emp-sum-name" style={{ marginBottom: 6 }}>
                Colaboradores impactados
              </div>
              <div className="pb-dept-drill-scroll-outer">
              <div className="pb-dept-drill-table-shell">
              <table className="pb-drill-table pb-dept-drill-employees">
                <thead>
                  <tr>
                    <th className="pb-drill-th-name">Colaborador</th>
                    <th className="pb-drill-th-name">Status</th>
                    {hasHours && <th className="pb-drill-th-num">Hrs.Plan.</th>}
                    {hasHours && <th className="pb-drill-th-num">Hrs.Trab.</th>}
                    <th className="pb-drill-th-num">Hrs. Aus.</th>
                    <th className="pb-drill-th-num">Hrs. Just.</th>
                    {hasExtras && <th className="pb-drill-th-num">Hrs. Extras</th>}
                  </tr>
                </thead>
                <tbody>
                  {detail.employees.length === 0 ? (
                    <tr>
                      <td colSpan={employeeColumnCount} className="pb-drill-td-name">
                        Sem colaboradores com ocorrências no período.
                      </td>
                    </tr>
                  ) : (
                    detail.employees.map((emp) => (
                      <tr
                        key={emp.mat || emp.nome}
                        className={`pb-drill-emp-row${isPresenceProfileActive(emp) ? " pb-drill-emp-row--active" : ""}`}
                      >
                        {renderDrillEmpName(emp)}
                        <td className="pb-drill-status-cell">
                          {(emp.hrsAuse || 0) > 0 && <span className="pb-drill-status is-absence">Ausência</span>}
                          {(emp.hrsJust || 0) > 0 && <span className="pb-drill-status is-justified">Justificada</span>}
                          {(emp.hrsExtr || 0) > 0 && <span className="pb-drill-status is-extra">Extra</span>}
                        </td>
                        {hasHours && <td className="pb-drill-td-num">{fmtMin(emp.hrsPlan)}</td>}
                        {hasHours && <td className="pb-drill-td-num">{fmtMin(emp.hrsPres)}</td>}
                        <td className="pb-drill-td-num">{fmtMin(emp.hrsAuse)}</td>
                        <td className="pb-drill-td-num">{fmtMin(emp.hrsJust)}</td>
                        {hasExtras && <td className="pb-drill-td-num">{fmtMin(emp.hrsExtr)}</td>}
                      </tr>
                    ))
                  )}
                </tbody>
                {detail.employees.length > 0 && (
                  <tfoot>
                    <tr className="pb-drill-totals-row">
                      <td className="pb-drill-td-name">Totais</td>
                      <td className="pb-drill-status-cell" />
                      {hasHours && <td className="pb-drill-td-num">{fmtMin(employeeTotals.hrsPlan)}</td>}
                      {hasHours && <td className="pb-drill-td-num">{fmtMin(employeeTotals.hrsPres)}</td>}
                      <td className="pb-drill-td-num">{fmtMin(employeeTotals.hrsAuse)}</td>
                      <td className="pb-drill-td-num">{fmtMin(employeeTotals.hrsJust)}</td>
                      {hasExtras && <td className="pb-drill-td-num">{fmtMin(employeeTotals.hrsExtr)}</td>}
                    </tr>
                  </tfoot>
                )}
              </table>
              </div>
              </div>
            </section>
            </div>
          </div>
        </td>
      </tr>
    );
  }

  function generoSortHeader(label, key, className = "") {
    const active = generoSortCol === key;
    return groupSortHeader("genero", label, key, className, active, generoSortDir, toggleGeneroSort);
  }

  const generoColSpan =
    2 + (hasHours ? 5 : 0) + 2 + (hasHours ? 1 : 0) + 1 + (hasHours ? 1 : 0) + (hasExtras ? 2 : 0);

  function renderGeneroDrill(r) {
    const detail = generoDrillMap.get(r.genero) || { criticalDays: [], employees: [] };
    const acimaPlanejado = 0;
    const dayColumnCount = hasExtras ? 7 : 5;
    const employeeColumnCount = 4 + (hasHours ? 2 : 0) + (hasExtras ? 1 : 0);
    const criticalTotals = detail.criticalDays.reduce(
      (totals, day) => ({
        ausentes: totals.ausentes + day.ausentes,
        hrsAuse: totals.hrsAuse + day.hrsAuse,
        justificadas: totals.justificadas + day.justificadas,
        hrsJust: totals.hrsJust + day.hrsJust,
        extras: totals.extras + day.extras,
        hrsExtr: totals.hrsExtr + day.hrsExtr,
      }),
      { ausentes: 0, hrsAuse: 0, justificadas: 0, hrsJust: 0, extras: 0, hrsExtr: 0 },
    );
    const employeeTotals = detail.employees.reduce(
      (totals, emp) => ({
        hrsPlan: totals.hrsPlan + emp.hrsPlan,
        hrsPres: totals.hrsPres + emp.hrsPres,
        hrsAuse: totals.hrsAuse + emp.hrsAuse,
        hrsJust: totals.hrsJust + emp.hrsJust,
        hrsExtr: totals.hrsExtr + emp.hrsExtr,
      }),
      { hrsPlan: 0, hrsPres: 0, hrsAuse: 0, hrsJust: 0, hrsExtr: 0 },
    );
    return (
      <tr className="pb-drill-row pb-drill-row--sticky-group">
        <td colSpan={generoColSpan} className="pb-drill-cell">
          <div className="pb-drill-inner pb-dept-drill">
            <div className="pb-drill-header pb-drill-header--start">
              {renderDrillCloseButton(
                () => toggleGeneroExpand(r.genero),
                `Fechar detalhe de ${r.genero}`,
              )}
            </div>
            <div className="pb-dept-drill-summary">
              <span><strong>{r.colaboradoresQtd.toLocaleString("pt-BR")}</strong> colaboradores</span>
              <span className="is-absence"><strong>{r.ausentes.toLocaleString("pt-BR")}</strong> ausentes / {fmtMin(r.horas_ausentes)}</span>
              <span className="is-justified"><strong>{r.justificadas.toLocaleString("pt-BR")}</strong> justificadas / {fmtMin(r.horas_justificadas)}</span>
              {hasExtras && (
                <span className="is-extra"><strong>{r.extras.toLocaleString("pt-BR")}</strong> extras / {fmtMin(r.horas_extras)}</span>
              )}
              {hasHours && acimaPlanejado > 0 && (
                <span className="is-over"><strong>+{fmtMin(acimaPlanejado)}</strong> acima do planejado</span>
              )}
            </div>
            <div className="pb-dept-drill-grid">
            <section className="pb-dept-drill-panel">
              <div className="pb-emp-sum-name" style={{ marginBottom: 6 }}>
                Dias críticos
              </div>
              <div className="pb-dept-drill-scroll-outer">
              <div className="pb-dept-drill-table-shell">
              <table className="pb-drill-table pb-dept-drill-days">
                <thead>
                  <tr>
                    <th className="pb-drill-th-name">Data</th>
                    <th className="pb-drill-th-num">Qtd. Aus.</th>
                    <th className="pb-drill-th-num">Hrs. Aus.</th>
                    <th className="pb-drill-th-num">Qtd. Just.</th>
                    <th className="pb-drill-th-num">Hrs. Just.</th>
                    {hasExtras && <th className="pb-drill-th-num">Qtd. Extras</th>}
                    {hasExtras && <th className="pb-drill-th-num">Hrs. Extras</th>}
                  </tr>
                </thead>
                <tbody>
                  {detail.criticalDays.length === 0 ? (
                    <tr>
                      <td colSpan={dayColumnCount} className="pb-drill-td-name">
                        Sem dias críticos no período.
                      </td>
                    </tr>
                  ) : (
                    detail.criticalDays.map((d) => (
                      <tr key={d.date} className="pb-drill-emp-row">
                        <td className="pb-drill-td-name">{d.label}</td>
                        <td className="pb-drill-td-num">{d.ausentes.toLocaleString("pt-BR")}</td>
                        <td className="pb-drill-td-num">{fmtMin(d.hrsAuse)}</td>
                        <td className="pb-drill-td-num">{d.justificadas.toLocaleString("pt-BR")}</td>
                        <td className="pb-drill-td-num">{fmtMin(d.hrsJust)}</td>
                        {hasExtras && <td className="pb-drill-td-num">{d.extras.toLocaleString("pt-BR")}</td>}
                        {hasExtras && <td className="pb-drill-td-num">{fmtMin(d.hrsExtr)}</td>}
                      </tr>
                    ))
                  )}
                </tbody>
                {detail.criticalDays.length > 0 && (
                  <tfoot>
                    <tr className="pb-drill-totals-row">
                      <td className="pb-drill-td-name">Totais exibidos</td>
                      <td className="pb-drill-td-num">{criticalTotals.ausentes.toLocaleString("pt-BR")}</td>
                      <td className="pb-drill-td-num">{fmtMin(criticalTotals.hrsAuse)}</td>
                      <td className="pb-drill-td-num">{criticalTotals.justificadas.toLocaleString("pt-BR")}</td>
                      <td className="pb-drill-td-num">{fmtMin(criticalTotals.hrsJust)}</td>
                      {hasExtras && <td className="pb-drill-td-num">{criticalTotals.extras.toLocaleString("pt-BR")}</td>}
                      {hasExtras && <td className="pb-drill-td-num">{fmtMin(criticalTotals.hrsExtr)}</td>}
                    </tr>
                  </tfoot>
                )}
              </table>
              </div>
              </div>
            </section>
            <section className="pb-dept-drill-panel">
              <div className="pb-emp-sum-name" style={{ marginBottom: 6 }}>
                Colaboradores impactados
              </div>
              <div className="pb-dept-drill-scroll-outer">
              <div className="pb-dept-drill-table-shell">
              <table className="pb-drill-table pb-dept-drill-employees">
                <thead>
                  <tr>
                    <th className="pb-drill-th-name">Colaborador</th>
                    <th className="pb-drill-th-name">Status</th>
                    {hasHours && <th className="pb-drill-th-num">Hrs.Plan.</th>}
                    {hasHours && <th className="pb-drill-th-num">Hrs.Trab.</th>}
                    <th className="pb-drill-th-num">Hrs. Aus.</th>
                    <th className="pb-drill-th-num">Hrs. Just.</th>
                    {hasExtras && <th className="pb-drill-th-num">Hrs. Extras</th>}
                  </tr>
                </thead>
                <tbody>
                  {detail.employees.length === 0 ? (
                    <tr>
                      <td colSpan={employeeColumnCount} className="pb-drill-td-name">
                        Sem colaboradores com ocorrências no período.
                      </td>
                    </tr>
                  ) : (
                    detail.employees.map((emp) => (
                      <tr
                        key={emp.mat || emp.nome}
                        className={`pb-drill-emp-row${isPresenceProfileActive(emp) ? " pb-drill-emp-row--active" : ""}`}
                      >
                        {renderDrillEmpName(emp)}
                        <td className="pb-drill-status-cell">
                          {(emp.hrsAuse || 0) > 0 && <span className="pb-drill-status is-absence">Ausência</span>}
                          {(emp.hrsJust || 0) > 0 && <span className="pb-drill-status is-justified">Justificada</span>}
                          {(emp.hrsExtr || 0) > 0 && <span className="pb-drill-status is-extra">Extra</span>}
                        </td>
                        {hasHours && <td className="pb-drill-td-num">{fmtMin(emp.hrsPlan)}</td>}
                        {hasHours && <td className="pb-drill-td-num">{fmtMin(emp.hrsPres)}</td>}
                        <td className="pb-drill-td-num">{fmtMin(emp.hrsAuse)}</td>
                        <td className="pb-drill-td-num">{fmtMin(emp.hrsJust)}</td>
                        {hasExtras && <td className="pb-drill-td-num">{fmtMin(emp.hrsExtr)}</td>}
                      </tr>
                    ))
                  )}
                </tbody>
                {detail.employees.length > 0 && (
                  <tfoot>
                    <tr className="pb-drill-totals-row">
                      <td className="pb-drill-td-name">Totais</td>
                      <td className="pb-drill-status-cell" />
                      {hasHours && <td className="pb-drill-td-num">{fmtMin(employeeTotals.hrsPlan)}</td>}
                      {hasHours && <td className="pb-drill-td-num">{fmtMin(employeeTotals.hrsPres)}</td>}
                      <td className="pb-drill-td-num">{fmtMin(employeeTotals.hrsAuse)}</td>
                      <td className="pb-drill-td-num">{fmtMin(employeeTotals.hrsJust)}</td>
                      {hasExtras && <td className="pb-drill-td-num">{fmtMin(employeeTotals.hrsExtr)}</td>}
                    </tr>
                  </tfoot>
                )}
              </table>
              </div>
              </div>
            </section>
            </div>
          </div>
        </td>
      </tr>
    );
  }


  function cidSortHeader(label, key, className = "") {
    const active = cidSortCol === key;
    return groupSortHeader("cid", label, key, className, active, cidSortDir, toggleCidSort);
  }

  const cidColSpan = 10;

  function renderCidDrill(r) {
    const detail = cidDrillMap.get(r.cidDescricao) || { topDays: [], topEmployees: [] };
    return (
      <tr className="pb-drill-row pb-drill-row--sticky-group">
        <td colSpan={cidColSpan} className="pb-drill-cell">
          <div className="pb-drill-inner pb-drill-inner--cid">
            <div className="pb-drill-header pb-drill-header--start">
              {renderDrillCloseButton(
                () => toggleCidExpand(r.cidDescricao),
                `Fechar detalhe do CID ${r.cidDescricao}`,
              )}
            </div>
            <div className="pb-drill-cid-grid">
            <div>
              <div className="pb-emp-sum-name" style={{ marginBottom: 6 }}>
                Dias com mais registros
              </div>
              <table className="pb-drill-table">
                <thead>
                  <tr>
                    <th>Data</th>
                    <th className="pb-drill-th-num">Registros</th>
                    <th className="pb-drill-th-num">Colab.</th>
                    <th className="pb-drill-th-num">Horas</th>
                  </tr>
                </thead>
                <tbody>
                  {detail.topDays.length === 0 ? (
                    <tr>
                      <td colSpan={4} className="pb-drill-td-name">
                        Sem registros no período.
                      </td>
                    </tr>
                  ) : (
                    detail.topDays.map((d) => (
                      <tr key={d.date}>
                        <td className="pb-drill-td-name">{d.label}</td>
                        <td className="pb-drill-td-num">{d.eventos.toLocaleString("pt-BR")}</td>
                        <td className="pb-drill-td-num">
                          {d.colaboradoresQtd.toLocaleString("pt-BR")}
                        </td>
                        <td className="pb-drill-td-num">{fmtMin(d.horas)}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
            <div>
              <div className="pb-emp-sum-name" style={{ marginBottom: 6 }}>
                Colaboradores com mais registros
              </div>
              <table className="pb-drill-table">
                <thead>
                  <tr>
                    <th className="pb-drill-th-name">Colaborador</th>
                    <th className="pb-drill-th-num">Registros</th>
                    <th className="pb-drill-th-num">Horas</th>
                  </tr>
                </thead>
                <tbody>
                  {detail.topEmployees.length === 0 ? (
                    <tr>
                      <td colSpan={3} className="pb-drill-td-name">
                        Sem colaboradores no período.
                      </td>
                    </tr>
                  ) : (
                    detail.topEmployees.map((emp) => (
                      <tr key={emp.mat || emp.nome}>
                        <td className="pb-drill-td-name">{emp.nome}</td>
                        <td className="pb-drill-td-num">{emp.eventos.toLocaleString("pt-BR")}</td>
                        <td className="pb-drill-td-num">{fmtMin(emp.horas)}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
            </div>
          </div>
        </td>
      </tr>
    );
  }

  function riskSortHeader(label, key, className = "") {
    const active = riskSortCol === key;
    return groupSortHeader("risk", label, key, className, active, riskSortDir, toggleRiskSort);
  }

  const riskColSpan = 3;

  function renderRiskDrill(r) {
    const detail = riskDrillMap.get(r.evento) || { topDepartments: [], topEmployees: [] };
    const totalDepartments = detail.topDepartments.reduce((total, dept) => total + dept.eventos, 0);
    const totalEmployees = detail.topEmployees.reduce((total, emp) => total + emp.eventos, 0);
    return (
      <tr className="pb-drill-row pb-drill-row--sticky-group">
        <td colSpan={riskColSpan} className="pb-drill-cell">
          <div className="pb-drill-inner pb-drill-inner--risk">
            <div className="pb-drill-header pb-drill-header--start">
              {renderDrillCloseButton(
                () => toggleRiskExpand(r.evento),
                `Fechar detalhe de ${r.evento}`,
              )}
            </div>
            <div className="pb-risk-drill-grid">
              <section>
                <div className="pb-emp-sum-name" style={{ marginBottom: 6 }}>
                  Departamentos com mais ocorrências
                </div>
                <div className="pb-dept-drill-scroll">
                  <table className="pb-drill-table pb-drill-table--risk-dept">
                    <thead>
                      <tr>
                        <th className="pb-drill-th-name">Departamento</th>
                        <th className="pb-drill-th-num">Ocorrências</th>
                      </tr>
                    </thead>
                    <tbody>
                      {detail.topDepartments.length === 0 ? (
                        <tr>
                          <td colSpan={2} className="pb-drill-td-name">
                            Sem registros no período.
                          </td>
                        </tr>
                      ) : (
                        detail.topDepartments.map((d) => (
                          <tr key={d.dept}>
                            <td className="pb-drill-td-name">
                              <button
                                type="button"
                                className="pb-date-link"
                                onClick={() => openRiscoModal({ eventLabel: r.evento, dept: d.dept })}
                                title={d.dept}
                              >
                                {d.dept}
                              </button>
                            </td>
                            <td className="pb-drill-td-num">{d.eventos.toLocaleString("pt-BR")}</td>
                          </tr>
                        ))
                      )}
                    </tbody>
                    {detail.topDepartments.length > 0 && (
                      <tfoot>
                        <tr className="pb-drill-totals-row">
                          <td className="pb-drill-td-name">Totais</td>
                          <td className="pb-drill-td-num">{totalDepartments.toLocaleString("pt-BR")}</td>
                        </tr>
                      </tfoot>
                    )}
                  </table>
                </div>
              </section>
              <section>
                <div className="pb-emp-sum-name" style={{ marginBottom: 6 }}>
                  Colaboradores com mais ocorrências
                </div>
                <div className="pb-dept-drill-scroll">
                  <table className="pb-drill-table pb-drill-table--risk-emp">
                    <thead>
                      <tr>
                        <th className="pb-drill-th-name">Colaborador</th>
                        <th className="pb-drill-th-text">Departamento</th>
                        <th className="pb-drill-th-num">Ocorr.</th>
                        <th className="pb-drill-th-num">Horas</th>
                      </tr>
                    </thead>
                    <tbody>
                      {detail.topEmployees.length === 0 ? (
                        <tr>
                          <td colSpan={4} className="pb-drill-td-name">
                            Sem colaboradores no período.
                          </td>
                        </tr>
                      ) : (
                        detail.topEmployees.map((emp) => (
                          <tr key={emp.key}>
                            <td className="pb-drill-td-name">
                              <button
                                type="button"
                                className="pb-date-link"
                                onClick={() => openRiscoModal({ eventLabel: r.evento, emp: emp.mat || emp.nome })}
                                title={emp.nome}
                              >
                                {emp.nome}
                              </button>
                            </td>
                            <td className="pb-drill-td-text" title={emp.dept}>{emp.dept}</td>
                            <td className="pb-drill-td-num">{emp.eventos.toLocaleString("pt-BR")}</td>
                            <td className="pb-drill-td-num">{fmtMin(emp.horas)}</td>
                          </tr>
                        ))
                      )}
                    </tbody>
                    {detail.topEmployees.length > 0 && (
                      <tfoot>
                        <tr className="pb-drill-totals-row">
                          <td className="pb-drill-td-name">Totais</td>
                          <td />
                          <td className="pb-drill-td-num">{totalEmployees.toLocaleString("pt-BR")}</td>
                          <td className="pb-drill-td-num">{fmtMin(detail.topEmployees.reduce((s, emp) => s + emp.horas, 0))}</td>
                        </tr>
                      </tfoot>
                    )}
                  </table>
                </div>
              </section>
            </div>
          </div>
        </td>
      </tr>
    );
  }

  function eventSortHeader(label, key, className = "") {
    const active = eventSortCol === key;
    return groupSortHeader("event", label, key, className, active, eventSortDir, toggleEventSort);
    return (
      <th className={className}>
        <button
          type="button"
          className={`pb-th-sort${active ? " active" : ""}`}
          onClick={() => toggleEventSort(key)}
        >
          <span className="pb-th-label">{label}</span>
          <span className="pb-th-arrow" aria-hidden="true">
            {active ? (eventSortDir === "asc" ? "â–²" : "â–¼") : "â‡…"}
          </span>
        </button>
      </th>
    );
  }

  const eventJustificadasMode = metricFilter === "justificadas";
  const eventColSpan = eventJustificadasMode ? 7 : 10;

  function renderEventDrill(r) {
    const detail = eventDrillMap.get(r.key) || { topDays: [], topEmployees: [] };
    return (
      <tr className="pb-drill-row pb-drill-row--sticky-group">
        <td colSpan={eventColSpan} className="pb-drill-cell">
          <div className="pb-drill-inner pb-drill-inner--cid">
            <div className="pb-drill-header pb-drill-header--start">
              {renderDrillCloseButton(
                () => toggleEventExpand(r.key),
                `Fechar detalhe de ${r.evento}`,
              )}
            </div>
            <div className="pb-drill-cid-grid">
              <div>
                <div className="pb-emp-sum-name" style={{ marginBottom: 6 }}>
                  Dias do evento
                </div>
                <table className="pb-drill-table">
                  <thead>
                    <tr>
                      <th>Data</th>
                      <th className="pb-drill-th-num">Ocorr.</th>
                      <th className="pb-drill-th-num">Colab.</th>
                      <th className="pb-drill-th-num">Horas</th>
                    </tr>
                  </thead>
                  <tbody>
                    {detail.topDays.length === 0 ? (
                      <tr>
                        <td colSpan={4} className="pb-drill-td-name">
                          Sem registros no periodo.
                        </td>
                      </tr>
                    ) : (
                      detail.topDays.map((d) => (
                        <tr key={d.date}>
                          <td className="pb-drill-td-name">{d.label}</td>
                          <td className="pb-drill-td-num">{d.eventos.toLocaleString("pt-BR")}</td>
                          <td className="pb-drill-td-num">{d.colaboradoresQtd.toLocaleString("pt-BR")}</td>
                          <td className="pb-drill-td-num">{fmtMin(d.horas)}</td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
              <div>
                <div className="pb-emp-sum-name" style={{ marginBottom: 6 }}>
                  Colaboradores do evento
                </div>
                <table className="pb-drill-table">
                  <thead>
                    <tr>
                      <th className="pb-drill-th-name">Colaborador</th>
                      <th className="pb-drill-th-text">Departamento</th>
                      <th className="pb-drill-th-num">Ocorr.</th>
                      <th className="pb-drill-th-num">Horas</th>
                    </tr>
                  </thead>
                  <tbody>
                    {detail.topEmployees.length === 0 ? (
                      <tr>
                        <td colSpan={4} className="pb-drill-td-name">
                          Sem colaboradores no periodo.
                        </td>
                      </tr>
                    ) : (
                      detail.topEmployees.map((emp) => (
                        <tr key={emp.key}>
                          <td className="pb-drill-td-name">
                            <button
                              type="button"
                              className="pb-date-link"
                              onClick={() => openColabModal(emp.key)}
                              title={emp.nome}
                            >
                              {emp.nome}
                            </button>
                          </td>
                          <td className="pb-drill-td-text" title={emp.dept}>{emp.dept}</td>
                          <td className="pb-drill-td-num">{emp.eventos.toLocaleString("pt-BR")}</td>
                          <td className="pb-drill-td-num">{fmtMin(emp.horas)}</td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </td>
      </tr>
    );
  }

  function colabSortHeader(label, key, className = "") {
    const active = colabSortCol === key;
    return groupSortHeader("colab", label, key, className, active, colabSortDir, toggleColabSort);
    return (
      <th className={className}>
        <button
          type="button"
          className={`pb-th-sort${active ? " active" : ""}`}
          onClick={() => toggleColabSort(key)}
        >
          <span className="pb-th-label">{label}</span>
          <span className="pb-th-arrow" aria-hidden="true">
            {active ? (colabSortDir === "asc" ? "â–²" : "â–¼") : "â‡…"}
          </span>
        </button>
      </th>
    );
  }

  const colabColSpan = 14;

  function renderColabDrill(r) {
    const detail = colabDrillMap.get(r.key) || { days: [], events: [] };
    return (
      <tr className="pb-drill-row pb-drill-row--sticky-group">
        <td colSpan={colabColSpan} className="pb-drill-cell">
          <div className="pb-drill-inner pb-drill-inner--cid">
            <div className="pb-drill-header pb-drill-header--start">
              {renderDrillCloseButton(
                () => toggleColabExpand(r.key),
                `Fechar detalhe de ${r.nome}`,
              )}
            </div>
            <div className="pb-drill-cid-grid">
              <div>
                <div className="pb-emp-sum-name" style={{ marginBottom: 6 }}>
                  Dias do colaborador
                </div>
                <table className="pb-drill-table">
                  <thead>
                    <tr>
                      <th>Data</th>
                      <th className="pb-drill-th-num">Plan.</th>
                      <th className="pb-drill-th-num">Trab.</th>
                      <th className="pb-drill-th-num">Aus.</th>
                      <th className="pb-drill-th-num">Just.</th>
                      <th className="pb-drill-th-num">Extras</th>
                    </tr>
                  </thead>
                  <tbody>
                    {detail.days.length === 0 ? (
                      <tr>
                        <td colSpan={6} className="pb-drill-td-name">
                          Sem dias no periodo.
                        </td>
                      </tr>
                    ) : (
                      detail.days.map((d) => (
                        <tr key={d.date}>
                          <td className="pb-drill-td-name">{d.label}</td>
                          <td className="pb-drill-td-num">{fmtMin(d.hrsPlan)}</td>
                          <td className="pb-drill-td-num">{fmtMin(d.hrsPres)}</td>
                          <td className="pb-drill-td-num">{fmtMin(d.hrsAuse)}</td>
                          <td className="pb-drill-td-num">{fmtMin(d.hrsJust)}</td>
                          <td className="pb-drill-td-num">{fmtMin(d.hrsExtr)}</td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
              <div>
                <div className="pb-emp-sum-name" style={{ marginBottom: 6 }}>
                  Eventos do colaborador
                </div>
                <table className="pb-drill-table">
                  <thead>
                    <tr>
                      <th>Data</th>
                      <th className="pb-drill-th-name">Evento</th>
                      <th className="pb-drill-th-text">Categoria</th>
                      <th className="pb-drill-th-num">Horas</th>
                    </tr>
                  </thead>
                  <tbody>
                    {detail.events.length === 0 ? (
                      <tr>
                        <td colSpan={4} className="pb-drill-td-name">
                          Sem eventos no periodo.
                        </td>
                      </tr>
                    ) : (
                      detail.events.map((ev, idx) => (
                        <tr key={`${ev.date}-${ev.evento}-${idx}`}>
                          <td className="pb-drill-td-name">{ev.label}</td>
                          <td className="pb-drill-td-name">{ev.evento}</td>
                          <td className="pb-drill-td-text">{ev.categoria}</td>
                          <td className="pb-drill-td-num">{fmtMin(ev.horas)}</td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </td>
      </tr>
    );
  }

  const handleFloatToggle = useCallback(() => {
    if (isFloating) {
      setFloatMaximized((prev) => !prev);
      return;
    }
    const snapshot = {
      view: tableView,
      groupBy,
      search: dateSearch,
      preserveSelectedEmp: true,
      ts: Date.now(),
    };
    if (onFloatChange) onFloatChange(true, snapshot);
    else setIsFloating(true);
  }, [
    dateSearch,
    groupBy,
    isFloating,
    onFloatChange,
    setIsFloating,
    tableView,
  ]);

  const colsAndFloat = (
    <>
      <div style={{ position: "relative" }}>
        <button
          ref={colBtnRef}
          type="button"
          className={`pb-hist-cfg-btn${colSelOpen ? " active" : ""}`}
          onClick={() => setColSelOpen((v) => !v)}
        >
          Colunas ▾
        </button>
        {colSelOpen && (
          <div ref={colSelRef} className="pb-hist-col-pop">
            {availCols
              .filter((c) => !c.always)
              .map((c) => (
                <label key={c.id} className="pb-hist-col-item notranslate" translate="no">
                  <input
                    type="checkbox"
                    checked={visibleCols.has(c.id)}
                    onChange={() => toggleColVis(c.id)}
                  />
                  <span className={`pb-hist-col-dot pb-col-${c.group}`} />
                  {c.prefix ? `${c.prefix} ${c.label}` : c.label}
                </label>
              ))}
          </div>
        )}
      </div>
      <div style={{ position: "relative" }} className="pb-export-wrap">
        <button type="button" className="pb-hist-cfg-btn pb-export-btn" title="Exportar">
          <svg
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
            <polyline points="7 10 12 15 17 10" />
            <line x1="12" y1="15" x2="12" y2="3" />
          </svg>
          <svg
            width="10"
            height="10"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
            style={{ marginLeft: 2 }}
          >
            <polyline points="6 9 12 15 18 9" />
          </svg>
        </button>
        <div className="pb-export-pop">
          <button
            type="button"
            className="pb-export-opt"
            disabled={!!exportBusy}
            onClick={() => runExport("Gerando CSV…", exportCSV)}
          >
            CSV (.csv)
          </button>
          <button
            type="button"
            className="pb-export-opt"
            disabled={!!exportBusy}
            onClick={() => runExport("Gerando Excel…", exportXLSX)}
          >
            Excel (.xlsx)
          </button>
          <button
            type="button"
            className="pb-export-opt"
            disabled={!!exportBusy}
            onClick={() => runExport("Gerando PDF…", exportPDF)}
          >
            PDF (.pdf)
          </button>
        </div>
      </div>
      <button
        type="button"
        className="pb-hist-float-btn"
        title={isFloating ? (floatMaximized ? "Restaurar tamanho" : "Expandir tela") : "Expandir tabela atual"}
        aria-label={isFloating ? (floatMaximized ? "Restaurar tamanho" : "Expandir tela") : "Expandir tabela atual"}
        onClick={handleFloatToggle}
      >
        <svg
          width="15"
          height="15"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.2"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          {isFloating && floatMaximized ? (
            <>
              <path d="M9 3v6H3" />
              <path d="M3 9l7-7" />
              <path d="M15 21v-6h6" />
              <path d="M21 15l-7 7" />
            </>
          ) : (
            <>
              <path d="M9 15h6V9" />
              <path d="M4 20 15 9" />
            </>
          )}
        </svg>
      </button>
      {onFloatClose && !isFloating && (
        <button
          type="button"
          className="pb-hist-float-btn pb-hist-float-btn--close"
          title="Fechar e voltar aos cards"
          aria-label="Fechar e voltar aos cards"
          onClick={closeFloating}
        >
          <svg
            width="15"
            height="15"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.4"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <path d="M18 6 6 18" />
            <path d="M6 6l12 12" />
          </svg>
        </button>
      )}
    </>
  );

  const searchEl = (
    <div className="pb-hist-search-wrap">
      <span className="pb-hist-search-ico">🔍</span>
      <input
        type="text"
        className="pb-hist-search-inp"
        placeholder="Buscar data…"
        value={dateSearch}
        onChange={(e) => startTransition(() => setDateSearch(e.target.value))}
      />
      {dateSearch && (
        <button type="button" className="pb-emp-clear" onClick={() => setDateSearch("")}>
          ✕
        </button>
      )}
    </div>
  );

  const viewToggleEl = (
    <div className="pb-trend-tabs" role="tablist" aria-label="Visão da tabela">
      <button
        type="button"
        className={`pb-trend-tab${tableView === "date" ? " is-active" : ""}`}
        onClick={() => setTableView("date")}
        aria-selected={tableView === "date"}
        role="tab"
      >
        Data
      </button>
      <button
        type="button"
        className={`pb-trend-tab${tableView === "dept" ? " is-active" : ""}`}
        onClick={() => {
          setSelectedEmp(null);
          setTableView("dept");
        }}
        aria-selected={tableView === "dept"}
        role="tab"
      >
        Departamento
      </button>
      <button
        type="button"
        className={`pb-trend-tab${tableView === "event" ? " is-active" : ""}`}
        onClick={() => {
          setSelectedEmp(null);
          setTableView("event");
        }}
        aria-selected={tableView === "event"}
        role="tab"
      >
        Evento
      </button>
      <button
        type="button"
        className={`pb-trend-tab${tableView === "colab" ? " is-active" : ""}`}
        onClick={() => {
          setSelectedEmp(null);
          setTableView("colab");
        }}
        aria-selected={tableView === "colab"}
        role="tab"
      >
        Colaborador
      </button>
      <button
        type="button"
        className={`pb-trend-tab${tableView === "cargo" ? " is-active" : ""}`}
        onClick={() => {
          setSelectedEmp(null);
          setTableView("cargo");
        }}
        aria-selected={tableView === "cargo"}
        role="tab"
      >
        Cargo
      </button>
      <button
        type="button"
        className={`pb-trend-tab${tableView === "genero" ? " is-active" : ""}`}
        onClick={() => {
          setSelectedEmp(null);
          setTableView("genero");
        }}
        aria-selected={tableView === "genero"}
        role="tab"
      >
        Genero
      </button>
      {hasCidView && (
        <button
          type="button"
          className={`pb-trend-tab${tableView === "cid" ? " is-active" : ""}`}
          onClick={() => {
            setSelectedEmp(null);
            setTableView("cid");
          }}
          aria-selected={tableView === "cid"}
          role="tab"
        >
          CID
        </button>
      )}
      <button
        type="button"
        className={`pb-trend-tab${tableView === "risk" ? " is-active" : ""}`}
        onClick={() => {
          setSelectedEmp(null);
          setTableView("risk");
        }}
        aria-selected={tableView === "risk"}
        role="tab"
      >
        Radar trabalhista
      </button>
    </div>
  );

  const addDays = (iso, n) => {
    const d = new Date(iso + "T00:00:00");
    d.setDate(d.getDate() + n);
    return d.toISOString().slice(0, 10);
  };
  const maxTo = dateFrom ? addDays(dateFrom, MAX_DAYS) : undefined;
  const minFrom = dateTo ? addDays(dateTo, -MAX_DAYS) : undefined;

  const empName = selectedEmp
    ? (empList.find(([m]) => m === selectedEmp)?.[1] ?? selectedEmp)
    : null;

  const empFilterEl = empList.length > 0 && (
    <EmpFilter
      empList={empList}
      value={selectedEmp}
      onChange={(v) => startTransition(() => setSelectedEmp(v))}
    />
  );

  const floatToolbar = (
    <>
      {/* drag handle bar */}
      <div
        className="pb-hist-drag-handle"
        onMouseDown={(e) => {
          if (e.button !== 0) return;
          e.preventDefault();
          const panel = floatPanelRef.current;
          if (!panel) return;
          const rect = panel.getBoundingClientRect();
          dragRef.current = {
            type: "drag",
            startMX: e.clientX,
            startMY: e.clientY,
            startX: rect.left,
            startY: rect.top,
          };
        }}
      >
        <span className="pb-hist-drag-title">Historico</span>
        <div className="pb-hist-float-actions">
          <button
            type="button"
            className="pb-hist-float-minimize pb-hist-float-minimize--close"
            title="Fechar e voltar aos cards"
            aria-label="Fechar e voltar aos cards"
            onMouseDown={(e) => e.stopPropagation()}
            onClick={closeFloating}
          >
            <svg
              width="15"
              height="15"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.2"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <path d="M18 6 6 18" />
              <path d="M6 6l12 12" />
            </svg>
          </button>
        </div>
      </div>
      {/* toolbar */}
      <div className="pb-hist-toolbar pb-hist-float-toolbar">
        {viewToggleEl}
        {empFilterEl}
        {searchEl}
        {onDateFromChange && (
          <>
            <span className="pb-hist-date-label">De</span>
            <input
              ref={dateFromRef}
              type="date"
              className="pb-hist-date-inp"
              value={dateDraftFrom}
              min={minFrom}
              max={dateDraftTo || maxTo}
              onInput={(e) => updateDateFrom(e.currentTarget.value)}
              onChange={(e) => updateDateFrom(e.currentTarget.value)}
              onBlur={applyDateRange}
            />
            <span className="pb-hist-date-label">Até</span>
            <input
              ref={dateToRef}
              type="date"
              className="pb-hist-date-inp"
              value={dateDraftTo}
              min={dateDraftFrom || minFrom}
              max={maxTo}
              onInput={(e) => updateDateTo(e.currentTarget.value)}
              onChange={(e) => updateDateTo(e.currentTarget.value)}
              onBlur={applyDateRange}
            />
            <button type="button" className="pb-hist-clear-btn" onClick={applyDateRange}>
              OK
            </button>
            {(effectiveDateFrom || effectiveDateTo) && (
              <button
                type="button"
                className="pb-hist-clear-btn"
                onClick={() => {
                  setDateDraftFrom("");
                  setDateDraftTo("");
                  onDateFromChange("");
                  onDateToChange("");
                }}
              >
                ✕
              </button>
            )}
          </>
        )}
        <div style={{ flex: 1 }} />
        {isPending && <span className="pb-hist-loading">Aguarde...</span>}
        {colsAndFloat}
      </div>
    </>
  );

  /* ── Per-employee table ── */
  const empTableInner = empRows && empSummary && (
    <div className="pb-hist-table-wrap">
      <div className="pb-emp-summary">
        <span className="pb-emp-sum-name">{empName}</span>
        <span className="pb-emp-sum-sep" />
        <span className="pb-emp-sum-item">
          <span className="pb-emp-sum-lbl">Presença</span>
          <span
            className={`pb-emp-sum-val ${empSummary.pct >= 90 ? "c-green" : empSummary.pct >= 75 ? "c-yellow" : "c-red"}`}
          >
            {empSummary.pct}%
          </span>
        </span>
        <span className="pb-emp-sum-sep" />
        <span className="pb-emp-sum-item">
          <span className="pb-emp-sum-lbl">Dias presentes</span>
          <span className="pb-emp-sum-val">
            {empSummary.present}/{empSummary.total}
          </span>
        </span>
        <span className="pb-emp-sum-sep" />
        <span className="pb-emp-sum-item">
          <span className="pb-emp-sum-lbl">Ausências</span>
          <span className={`pb-emp-sum-val ${empSummary.absent > 0 ? "c-red" : "c-green"}`}>
            {empSummary.absent}
          </span>
        </span>
        {empSummary.absPct != null && (
          <>
            <span className="pb-emp-sum-sep" />
            <span className="pb-emp-sum-item">
              <span className="pb-emp-sum-lbl">Absenteísmo</span>
              <span
                className={`pb-emp-sum-val ${empSummary.absPct >= 10 ? "c-red" : empSummary.absPct >= 5 ? "c-yellow" : "c-green"}`}
              >
                {empSummary.absPct}%
              </span>
            </span>
          </>
        )}
        {empSummary.hrsPlan > 0 && (
          <>
            <span className="pb-emp-sum-sep" />
            <span className="pb-emp-sum-item">
              <span className="pb-emp-sum-lbl">Hrs. Trabalhadas</span>
              <span className="pb-emp-sum-val">{fmtMin(empSummary.hrsPres)}</span>
            </span>
            <span className="pb-emp-sum-sep" />
            <span className="pb-emp-sum-item">
              <span className="pb-emp-sum-lbl">Hrs. planeadas</span>
              <span className="pb-emp-sum-val">{fmtMin(empSummary.hrsPlan)}</span>
            </span>
          </>
        )}
        {empSummary.hrsExtr > 0 && (
          <>
            <span className="pb-emp-sum-sep" />
            <span className="pb-emp-sum-item">
              <span className="pb-emp-sum-lbl">Extras</span>
              <span className="pb-emp-sum-val c-orange">{fmtMin(empSummary.hrsExtr)}</span>
            </span>
          </>
        )}
      </div>
      <div className="pb-hist-table-scroll">
        <table className="pb-hist-table">
          <thead>
            <tr>
              <th>Data</th>
              <th>Status</th>
              {hasHours && <th className="num">Hrs. Plan.</th>}
              {hasHours && <th className="num">Hrs. Trab.</th>}
              {hasHours && <th className="num">Hrs. Aus.</th>}
              {hasHours && <th className="num">Hrs. Just.</th>}
              {hasExtras && <th className="num">Hrs. Extra</th>}
            </tr>
          </thead>
          <tbody>
            {empRows.map((r) => {
              const isHoliday = !!r._meta?.feriado;
              const isWeekend = !!r._meta?.isWeekend;
              const kind = r.present
                ? "presente"
                : isHoliday
                  ? "feriado"
                  : isWeekend
                    ? "folga"
                    : "ausente";
              const label = r.present
                ? "Presente"
                : isHoliday
                  ? r._meta.feriado
                  : isWeekend
                    ? "Folga"
                    : "Ausente";
              return (
                <tr key={r.date}>
                  <td className="date-cell">{r._label}</td>
                  <td>
                    <span className={`pb-emp-badge pb-emp-badge-${kind}`}>{label}</span>
                  </td>
                  {hasHours && <td className="num">{fmtMin(r.hrsPlan)}</td>}
                  {hasHours && <td className="num">{fmtMin(r.hrsPres)}</td>}
                  {hasHours && <td className="num">{r.hrsAuse ? fmtMin(r.hrsAuse) : "—"}</td>}
                  {hasHours && <td className="num">{r.hrsJust ? fmtMin(r.hrsJust) : "—"}</td>}
                  {hasExtras && <td className="num">{r.hrsExtr ? fmtMin(r.hrsExtr) : "—"}</td>}
                </tr>
              );
            })}
          </tbody>
          <tfoot>
            <tr className="totals-row">
              <td className="totals-label">
                Totais <span className="pct">({empRows.length}d)</span>
              </td>
              <td />
              {hasHours && <td className="num">{fmtMin(empSummary.hrsPlan)}</td>}
              {hasHours && <td className="num">{fmtMin(empSummary.hrsPres)}</td>}
              {hasHours && (
                <td className="num">{empSummary.hrsAuse ? fmtMin(empSummary.hrsAuse) : "—"}</td>
              )}
              {hasHours && (
                <td className="num">{empSummary.hrsJust ? fmtMin(empSummary.hrsJust) : "—"}</td>
              )}
              {hasExtras && (
                <td className="num">{empSummary.hrsExtr ? fmtMin(empSummary.hrsExtr) : "—"}</td>
              )}
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  );

  const tableInner = (
    <div className="pb-hist-table-wrap">
      {/* ── Table ── */}
      <div className="pb-hist-table-scroll" ref={tableScrollRef}>
        <table className="pb-hist-table" style={{ width: histTableWidth, minWidth: "100%" }}>
          <colgroup>
            {visibleOrdered.map((col) => (
              <col key={col.id} style={{ width: histColWidth(col.id) }} />
            ))}
          </colgroup>
          <thead>
            <tr>
              {visibleOrdered.map((col) => {
                const gc = col.group ? GRP_CLS[col.group] : "";
                const fst = firstOfGroup.has(col.id);
                const thCls = [
                  col.numeric ? "num" : "",
                  gc,
                  fst ? "col-start" : "",
                  highlightCol === col.id ? "col-highlight" : "",
                  "pb-th-resizable",
                ]
                  .filter(Boolean)
                  .join(" ");
                const active = sortCol === col.sortKey;
                const thW = histColWidth(col.id);
                return (
                  <th
                    key={col.id}
                    className={thCls}
                    data-col-id={col.id}
                    style={{ width: thW, minWidth: thW }}
                    ref={(el) => {
                      histThRefs.current[col.id] = el;
                    }}
                  >
                    <div className="pb-th-inner">
                      <button
                        type="button"
                        className={`pb-th-sort${active ? " active" : ""}`}
                        onClick={() => toggleSort(col.sortKey)}
                        title={col.prefix ? `${col.prefix} ${col.label}` : col.label}
                      >
                        <span
                          key={`pt-br-label-${col.id}`}
                          className="pb-th-label notranslate"
                          translate="no"
                        >
                          {col.prefix && <span className="pb-th-prefix">{col.prefix}</span>}
                          {col.label}
                        </span>
                        <span className="pb-th-arrow" aria-hidden="true">
                          {active ? (sortDir === "asc" ? "▲" : "▼") : "⇅"}
                        </span>
                      </button>
                      {col.id === "date" && (
                        <div className="pb-date-grp-row">
                          <select
                            className="pb-hist-grp-sel pb-date-grp-sel"
                            value={groupBy}
                            onClick={(e) => e.stopPropagation()}
                            onChange={(e) => {
                              setGroupBy(e.target.value);
                              setCollapsedGrp(new Set());
                            }}
                          >
                            {GROUP_BY_OPTIONS.map((o) => (
                              <option key={o.value} value={o.value}>
                                {o.label}
                              </option>
                            ))}
                          </select>
                          {grouped && (
                            <button
                              type="button"
                              className="pb-grp-toggle-all"
                              onClick={(e) => {
                                e.stopPropagation();
                                const keys = grouped.map(([k]) => k);
                                const allCollapsed = keys.every((k) => collapsedGrp.has(k));
                                setCollapsedGrp(allCollapsed ? new Set() : new Set(keys));
                              }}
                              title={
                                grouped.every(([k]) => collapsedGrp.has(k))
                                  ? "Expandir tudo"
                                  : "Recolher tudo"
                              }
                            >
                              {grouped.every(([k]) => collapsedGrp.has(k)) ? "＋" : "－"}
                            </button>
                          )}
                        </div>
                      )}
                    </div>
                    <div
                      className="pb-col-resizer"
                      title="Arraste para redimensionar"
                      onMouseDown={(e) => startHistColResize(col.id, e)}
                    />
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody>
            {displayGrouped ? (
              displayGrouped.map(([key, rows]) => {
                const isCol = collapsedGrp.has(key);
                const label = formatGroupLabel(key, groupBy);
                return (
                  <React.Fragment key={key}>
                    {isCol ? (
                      (() => {
                        const st = computeTotals(rows, hasHours, hasExtras);
                        return (
                          <tr className="pb-grp-row pb-grp-row-collapsed">
                            {visibleOrdered.map((col) => {
                              if (col.id === "date")
                                return (
                                  <td key="date">
                                    <button
                                      type="button"
                                      className="pb-grp-btn"
                                      onClick={() => toggleGrp(key)}
                                    >
                                      <span className="pb-grp-chevron">▶</span>
                                      <strong>{label}</strong>
                                      <span className="pb-grp-meta">{rows.length}d</span>
                                    </button>
                                  </td>
                                );
                              return (
                                <td key={col.id} className={`${tdCls(col)} pb-grp-total-cell`}>
                                  {totalCellVal(col.id, st)}
                                </td>
                              );
                            })}
                          </tr>
                        );
                      })()
                    ) : (
                      <tr className="pb-grp-row">
                        <td colSpan={visibleOrdered.length}>
                          <button
                            type="button"
                            className="pb-grp-btn"
                            onClick={() => toggleGrp(key)}
                          >
                            <span className="pb-grp-chevron open">▶</span>
                            <strong>{label}</strong>
                            <span className="pb-grp-meta">
                              {rows.length} dia{rows.length !== 1 ? "s" : ""}
                            </span>
                          </button>
                        </td>
                      </tr>
                    )}
                    {!isCol && rows.map((r, i) => renderDataRow(r, i))}
                    {!isCol && rows.length > 1 && renderGroupSubtotal(rows, label)}
                  </React.Fragment>
                );
              })
            ) : displayRows.length === 0 ? (
              <tr>
                <td
                  colSpan={visibleOrdered.length}
                  style={{
                    textAlign: "center",
                    padding: "32px 16px",
                    color: "var(--pb-text-2,#94a3b8)",
                    fontSize: 13,
                  }}
                >
                  {enriched.length === 0
                    ? "Nenhum dado disponível — importe uma planilha ou aguarde o carregamento."
                    : `Sem registros no período selecionado.${availableRange ? ` Dados disponíveis: ${availableRange}` : ""}`}
                </td>
              </tr>
            ) : (
              displayRows.map((r, i) => renderDataRow(r, i))
            )}
          </tbody>
          <tfoot>
            <tr className="totals-row">
              {visibleOrdered.map((col) => {
                if (col.id === "date")
                  return (
                    <td
                      key="date"
                      className="date-cell totals-label"
                      style={histColWidthStyle("date")}
                    >
                      Totais{" "}
                      <span className="pct">
                        ({dateSearch ? `${displayRows.length}/` : ""}
                        {sorted.length}d)
                      </span>
                    </td>
                  );
                return (
                  <td
                    key={col.id}
                    className={tdCls(col)}
                    data-col-id={col.id}
                    style={histColWidthStyle(col.id)}
                  >
                    {totalCellVal(col.id, displayTotals)}
                  </td>
                );
              })}
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  );

  const deptTableInner = tableView === "dept" && !empRows && (
    <div className="pb-hist-table-wrap">
      <div className="pb-hist-table-scroll">
        <table className="pb-hist-table pb-hist-table--group">
          <thead>
            <tr>
              {deptSortHeader("Departamento", "dept")}
              {deptSortHeader("Colab.", "colaboradoresQtd", "num")}
              {hasHours &&
                deptSortHeader("Planejadas", "horas_planejadas", "num col-hrs col-start")}
              {hasHours && deptSortHeader("Trabalhadas", "horas_presentes", "num col-hrs")}
              {hasHours && deptSortHeader("Perdidas", "horas_perdidas", "num col-hrs")}
              {hasHours && deptSortHeader("% Perda", "pct_perdidas", "num col-hrs")}
              {hasHours && deptSortHeader("Absenteísmo", "absenteismo", "num col-hrs")}
              {deptSortHeader("Qtd. Presentes", "presentes", "num col-pres col-start")}
              {deptSortHeader("Qtd. Ausentes", "ausentes", "num col-ause col-start")}
              {hasHours && deptSortHeader("Hrs. Ausentes", "horas_ausentes", "num col-ause")}
              {deptSortHeader("Qtd. Justificadas", "justificadas", "num col-just col-start")}
              {hasHours &&
                deptSortHeader("Hrs. Justificadas", "horas_justificadas", "num col-just")}
              {hasExtras && deptSortHeader("Qtd. Extras", "extras", "num col-extr col-start")}
              {hasExtras && deptSortHeader("Hrs. Extras", "horas_extras", "num col-extr")}
            </tr>
          </thead>
          <tbody>
            {deptRows.length === 0 ? (
              <tr>
                <td
                  colSpan={hasHours ? 14 : 5}
                  style={{
                    textAlign: "center",
                    padding: "32px 16px",
                    color: "var(--pb-text-2,#94a3b8)",
                    fontSize: 13,
                  }}
                >
                  Nenhum departamento encontrado no período selecionado.
                </td>
              </tr>
            ) : (
              sortedDeptRows.map((r) => {
                const isExpanded = expandedDepts.has(r.dept);
                return (
                  <React.Fragment key={r.dept}>
                    <tr>
                      <td className="date-cell">
                        <button
                          type="button"
                          className={`pb-drill-toggle${isExpanded ? " open" : ""}`}
                          onClick={() => toggleDeptExpand(r.dept)}
                          aria-expanded={isExpanded}
                        >
                          ▶
                        </button>
                        <button
                          type="button"
                          className="pb-date-link"
                          onClick={() => openGroupModal("dept", r.dept)}
                          title={r.dept}
                        >
                          {r.dept}
                        </button>
                      </td>
                      <td className="num">{r.colaboradoresQtd.toLocaleString("pt-BR")}</td>
                      {hasHours && (
                        <td className="num col-hrs col-start">{fmtMin(r.horas_planejadas)}</td>
                      )}
                      {hasHours && <td className="num col-hrs">{fmtMin(r.horas_presentes)}</td>}
                      {hasHours && <td className="num col-hrs">{fmtMin(r.horas_perdidas)}</td>}
                      {hasHours && <td className="num col-hrs">{fmtPct(r.pct_perdidas)}</td>}
                      {hasHours && <td className="num col-hrs">{fmtPct(r.absenteismo)}</td>}
                      <td className="num col-pres col-start">
                        {r.presentes.toLocaleString("pt-BR")}
                      </td>
                      <td className="num col-ause col-start">
                        {r.ausentes.toLocaleString("pt-BR")}
                      </td>
                      {hasHours && <td className="num col-ause">{fmtMin(r.horas_ausentes)}</td>}
                      <td className="num col-just col-start">
                        {r.justificadas.toLocaleString("pt-BR")}
                      </td>
                      {hasHours && <td className="num col-just">{fmtMin(r.horas_justificadas)}</td>}
                      {hasExtras && (
                        <td className="num col-extr col-start">
                          {r.extras.toLocaleString("pt-BR")}
                        </td>
                      )}
                      {hasExtras && <td className="num col-extr">{fmtMin(r.horas_extras)}</td>}
                    </tr>
                    {isExpanded && renderDeptDrill(r)}
                  </React.Fragment>
                );
              })
            )}
          </tbody>
          <tfoot>
            <tr className="totals-row">
              <td className="date-cell totals-label">
                Totais <span className="pct">({deptRows.length} dep.)</span>
              </td>
              <td className="num">{deptTotals.colaboradores.toLocaleString("pt-BR")}</td>
              {hasHours && (
                <td className="num col-hrs col-start">{fmtMin(deptTotals.horas_planejadas)}</td>
              )}
              {hasHours && <td className="num col-hrs">{fmtMin(deptTotals.horas_presentes)}</td>}
              {hasHours && <td className="num col-hrs">{fmtMin(deptTotals.horas_perdidas)}</td>}
              {hasHours && <td className="num col-hrs">{fmtPct(deptTotals.pct_perdidas)}</td>}
              {hasHours && <td className="num col-hrs">{fmtPct(deptTotals.absenteismo)}</td>}
              <td className="num col-pres col-start">
                {deptTotals.presentes.toLocaleString("pt-BR")}
              </td>
              <td className="num col-ause col-start">
                {deptTotals.ausentes.toLocaleString("pt-BR")}
              </td>
              {hasHours && <td className="num col-ause">{fmtMin(deptTotals.horas_ausentes)}</td>}
              <td className="num col-just col-start">
                {deptTotals.justificadas.toLocaleString("pt-BR")}
              </td>
              {hasHours && (
                <td className="num col-just">{fmtMin(deptTotals.horas_justificadas)}</td>
              )}
              {hasExtras && (
                <td className="num col-extr col-start">
                  {deptTotals.extras.toLocaleString("pt-BR")}
                </td>
              )}
              {hasExtras && <td className="num col-extr">{fmtMin(deptTotals.horas_extras)}</td>}
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  );

  const cargoTableInner = tableView === "cargo" && !empRows && (
    <div className="pb-hist-table-wrap">
      <div className="pb-hist-table-scroll">
        <table className="pb-hist-table pb-hist-table--group">
          <colgroup>
            <col style={{ minWidth: 210 }} />
          </colgroup>
          <thead>
            <tr>
              {cargoSortHeader("Cargo", "cargo")}
              {cargoSortHeader("Colab.", "colaboradoresQtd", "num")}
              {hasHours &&
                cargoSortHeader("Planejadas", "horas_planejadas", "num col-hrs col-start")}
              {hasHours && cargoSortHeader("Trabalhadas", "horas_presentes", "num col-hrs")}
              {hasHours && cargoSortHeader("Perdidas", "horas_perdidas", "num col-hrs")}
              {hasHours && cargoSortHeader("% Perda", "pct_perdidas", "num col-hrs")}
              {hasHours && cargoSortHeader("Absenteísmo", "absenteismo", "num col-hrs")}
              {cargoSortHeader("Qtd. Presentes", "presentes", "num col-pres col-start")}
              {cargoSortHeader("Qtd. Ausentes", "ausentes", "num col-ause col-start")}
              {hasHours && cargoSortHeader("Hrs. Ausentes", "horas_ausentes", "num col-ause")}
              {cargoSortHeader("Qtd. Justificadas", "justificadas", "num col-just col-start")}
              {hasHours &&
                cargoSortHeader("Hrs. Justificadas", "horas_justificadas", "num col-just")}
              {hasExtras && cargoSortHeader("Qtd. Extras", "extras", "num col-extr col-start")}
              {hasExtras && cargoSortHeader("Hrs. Extras", "horas_extras", "num col-extr")}
            </tr>
          </thead>
          <tbody>
            {cargoRows.length === 0 ? (
              <tr>
                <td
                  colSpan={hasHours ? 14 : 5}
                  style={{
                    textAlign: "center",
                    padding: "32px 16px",
                    color: "var(--pb-text-2,#94a3b8)",
                    fontSize: 13,
                  }}
                >
                  Nenhum cargo encontrado no período selecionado.
                </td>
              </tr>
            ) : (
              sortedCargoRows.map((r) => {
                const isExpanded = expandedCargos.has(r.cargo);
                return (
                  <React.Fragment key={r.cargo}>
                    <tr>
                      <td className="date-cell">
                        <button
                          type="button"
                          className={`pb-drill-toggle${isExpanded ? " open" : ""}`}
                          onClick={() => toggleCargoExpand(r.cargo)}
                          aria-expanded={isExpanded}
                        >
                          ▶
                        </button>
                        <button
                          type="button"
                          className="pb-date-link"
                          onClick={() => openGroupModal("cargo", r.cargo)}
                          title={r.cargo}
                        >
                          {r.cargo}
                        </button>
                      </td>
                      <td className="num">{r.colaboradoresQtd.toLocaleString("pt-BR")}</td>
                      {hasHours && (
                        <td className="num col-hrs col-start">{fmtMin(r.horas_planejadas)}</td>
                      )}
                      {hasHours && <td className="num col-hrs">{fmtMin(r.horas_presentes)}</td>}
                      {hasHours && <td className="num col-hrs">{fmtMin(r.horas_perdidas)}</td>}
                      {hasHours && <td className="num col-hrs">{fmtPct(r.pct_perdidas)}</td>}
                      {hasHours && <td className="num col-hrs">{fmtPct(r.absenteismo)}</td>}
                      <td className="num col-pres col-start">
                        {r.presentes.toLocaleString("pt-BR")}
                      </td>
                      <td className="num col-ause col-start">
                        {r.ausentes.toLocaleString("pt-BR")}
                      </td>
                      {hasHours && <td className="num col-ause">{fmtMin(r.horas_ausentes)}</td>}
                      <td className="num col-just col-start">
                        {r.justificadas.toLocaleString("pt-BR")}
                      </td>
                      {hasHours && <td className="num col-just">{fmtMin(r.horas_justificadas)}</td>}
                      {hasExtras && (
                        <td className="num col-extr col-start">
                          {r.extras.toLocaleString("pt-BR")}
                        </td>
                      )}
                      {hasExtras && <td className="num col-extr">{fmtMin(r.horas_extras)}</td>}
                    </tr>
                    {isExpanded && renderCargoDrill(r)}
                  </React.Fragment>
                );
              })
            )}
          </tbody>
          <tfoot>
            <tr className="totals-row">
              <td className="date-cell totals-label">
                Totais <span className="pct">({cargoRows.length} cargos)</span>
              </td>
              <td className="num">{cargoTotals.colaboradores.toLocaleString("pt-BR")}</td>
              {hasHours && (
                <td className="num col-hrs col-start">{fmtMin(cargoTotals.horas_planejadas)}</td>
              )}
              {hasHours && <td className="num col-hrs">{fmtMin(cargoTotals.horas_presentes)}</td>}
              {hasHours && <td className="num col-hrs">{fmtMin(cargoTotals.horas_perdidas)}</td>}
              {hasHours && <td className="num col-hrs">{fmtPct(cargoTotals.pct_perdidas)}</td>}
              {hasHours && <td className="num col-hrs">{fmtPct(cargoTotals.absenteismo)}</td>}
              <td className="num col-pres col-start">
                {cargoTotals.presentes.toLocaleString("pt-BR")}
              </td>
              <td className="num col-ause col-start">
                {cargoTotals.ausentes.toLocaleString("pt-BR")}
              </td>
              {hasHours && <td className="num col-ause">{fmtMin(cargoTotals.horas_ausentes)}</td>}
              <td className="num col-just col-start">
                {cargoTotals.justificadas.toLocaleString("pt-BR")}
              </td>
              {hasHours && (
                <td className="num col-just">{fmtMin(cargoTotals.horas_justificadas)}</td>
              )}
              {hasExtras && (
                <td className="num col-extr col-start">
                  {cargoTotals.extras.toLocaleString("pt-BR")}
                </td>
              )}
              {hasExtras && <td className="num col-extr">{fmtMin(cargoTotals.horas_extras)}</td>}
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  );

  const generoTableInner = tableView === "genero" && !empRows && (
    <div className="pb-hist-table-wrap">
      <div className="pb-hist-table-scroll">
        <table className="pb-hist-table pb-hist-table--group">
          <colgroup>
            <col style={{ minWidth: 210 }} />
          </colgroup>
          <thead>
            <tr>
              {generoSortHeader("Genero", "genero")}
              {generoSortHeader("Colab.", "colaboradoresQtd", "num")}
              {hasHours &&
                generoSortHeader("Planejadas", "horas_planejadas", "num col-hrs col-start")}
              {hasHours && generoSortHeader("Trabalhadas", "horas_presentes", "num col-hrs")}
              {hasHours && generoSortHeader("Perdidas", "horas_perdidas", "num col-hrs")}
              {hasHours && generoSortHeader("% Perda", "pct_perdidas", "num col-hrs")}
              {hasHours && generoSortHeader("Absenteísmo", "absenteismo", "num col-hrs")}
              {generoSortHeader("Qtd. Presentes", "presentes", "num col-pres col-start")}
              {generoSortHeader("Qtd. Ausentes", "ausentes", "num col-ause col-start")}
              {hasHours && generoSortHeader("Hrs. Ausentes", "horas_ausentes", "num col-ause")}
              {generoSortHeader("Qtd. Justificadas", "justificadas", "num col-just col-start")}
              {hasHours &&
                generoSortHeader("Hrs. Justificadas", "horas_justificadas", "num col-just")}
              {hasExtras && generoSortHeader("Qtd. Extras", "extras", "num col-extr col-start")}
              {hasExtras && generoSortHeader("Hrs. Extras", "horas_extras", "num col-extr")}
            </tr>
          </thead>
          <tbody>
            {generoRows.length === 0 ? (
              <tr>
                <td
                  colSpan={hasHours ? 14 : 5}
                  style={{
                    textAlign: "center",
                    padding: "32px 16px",
                    color: "var(--pb-text-2,#94a3b8)",
                    fontSize: 13,
                  }}
                >
                  Nenhum genero encontrado no período selecionado.
                </td>
              </tr>
            ) : (
              sortedGeneroRows.map((r) => {
                const isExpanded = expandedGeneros.has(r.genero);
                return (
                  <React.Fragment key={r.genero}>
                    <tr>
                      <td className="date-cell">
                        <button
                          type="button"
                          className={`pb-drill-toggle${isExpanded ? " open" : ""}`}
                          onClick={() => toggleGeneroExpand(r.genero)}
                          aria-expanded={isExpanded}
                        >
                          ▶
                        </button>
                        <button
                          type="button"
                          className="pb-date-link"
                          onClick={() => openGroupModal("genero", r.genero)}
                          title={r.genero}
                        >
                          {r.genero}
                        </button>
                      </td>
                      <td className="num">{r.colaboradoresQtd.toLocaleString("pt-BR")}</td>
                      {hasHours && (
                        <td className="num col-hrs col-start">{fmtMin(r.horas_planejadas)}</td>
                      )}
                      {hasHours && <td className="num col-hrs">{fmtMin(r.horas_presentes)}</td>}
                      {hasHours && <td className="num col-hrs">{fmtMin(r.horas_perdidas)}</td>}
                      {hasHours && <td className="num col-hrs">{fmtPct(r.pct_perdidas)}</td>}
                      {hasHours && <td className="num col-hrs">{fmtPct(r.absenteismo)}</td>}
                      <td className="num col-pres col-start">
                        {r.presentes.toLocaleString("pt-BR")}
                      </td>
                      <td className="num col-ause col-start">
                        {r.ausentes.toLocaleString("pt-BR")}
                      </td>
                      {hasHours && <td className="num col-ause">{fmtMin(r.horas_ausentes)}</td>}
                      <td className="num col-just col-start">
                        {r.justificadas.toLocaleString("pt-BR")}
                      </td>
                      {hasHours && <td className="num col-just">{fmtMin(r.horas_justificadas)}</td>}
                      {hasExtras && (
                        <td className="num col-extr col-start">
                          {r.extras.toLocaleString("pt-BR")}
                        </td>
                      )}
                      {hasExtras && <td className="num col-extr">{fmtMin(r.horas_extras)}</td>}
                    </tr>
                    {isExpanded && renderGeneroDrill(r)}
                  </React.Fragment>
                );
              })
            )}
          </tbody>
          <tfoot>
            <tr className="totals-row">
              <td className="date-cell totals-label">
                Totais <span className="pct">({generoRows.length} generos)</span>
              </td>
              <td className="num">{generoTotals.colaboradores.toLocaleString("pt-BR")}</td>
              {hasHours && (
                <td className="num col-hrs col-start">{fmtMin(generoTotals.horas_planejadas)}</td>
              )}
              {hasHours && <td className="num col-hrs">{fmtMin(generoTotals.horas_presentes)}</td>}
              {hasHours && <td className="num col-hrs">{fmtMin(generoTotals.horas_perdidas)}</td>}
              {hasHours && <td className="num col-hrs">{fmtPct(generoTotals.pct_perdidas)}</td>}
              {hasHours && <td className="num col-hrs">{fmtPct(generoTotals.absenteismo)}</td>}
              <td className="num col-pres col-start">
                {generoTotals.presentes.toLocaleString("pt-BR")}
              </td>
              <td className="num col-ause col-start">
                {generoTotals.ausentes.toLocaleString("pt-BR")}
              </td>
              {hasHours && <td className="num col-ause">{fmtMin(generoTotals.horas_ausentes)}</td>}
              <td className="num col-just col-start">
                {generoTotals.justificadas.toLocaleString("pt-BR")}
              </td>
              {hasHours && (
                <td className="num col-just">{fmtMin(generoTotals.horas_justificadas)}</td>
              )}
              {hasExtras && (
                <td className="num col-extr col-start">
                  {generoTotals.extras.toLocaleString("pt-BR")}
                </td>
              )}
              {hasExtras && <td className="num col-extr">{fmtMin(generoTotals.horas_extras)}</td>}
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  );


  const cidTableInner = tableView === "cid" && !empRows && (
    <div className="pb-hist-table-wrap">
      <div className="pb-hist-table-scroll">
        <table className="pb-hist-table pb-hist-table--group">
          <thead>
            <tr>
              {cidSortHeader("CID — Descrição", "cidDescricao")}
              {cidSortHeader("Código CID", "cidCodigo")}
              {cidSortHeader("Registros", "eventos", "num col-start")}
              {cidSortHeader("Colab.", "colaboradoresQtd", "num")}
              {cidSortHeader("Horas", "horas", "num col-hrs")}
              {cidSortHeader("Presentes", "presentes", "num col-pres")}
              {cidSortHeader("Ausentes", "ausentes", "num col-ause")}
              {cidSortHeader("Hrs. Aus.", "horas_ausentes", "num col-ause")}
              {cidSortHeader("Justif.", "justificadas", "num col-just")}
              {cidSortHeader("Extras", "extras", "num col-extr")}
            </tr>
          </thead>
          <tbody>
            {cidRows.length === 0 ? (
              <tr>
                <td
                  colSpan={cidColSpan}
                  style={{
                    textAlign: "center",
                    padding: "32px 16px",
                    color: "var(--pb-text-2,#94a3b8)",
                    fontSize: 13,
                  }}
                >
                  Nenhum CID encontrado no período — importe a planilha com colunas CID e
                  CID.DESCRIÇÃO.
                </td>
              </tr>
            ) : (
              sortedCidRows.map((r) => {
                const isExpanded = expandedCids.has(r.cidDescricao);
                return (
                  <React.Fragment key={r.cidDescricao}>
                    <tr>
                      <td className="date-cell">
                        <button
                          type="button"
                          className={`pb-drill-toggle${isExpanded ? " open" : ""}`}
                          onClick={() => toggleCidExpand(r.cidDescricao)}
                          aria-expanded={isExpanded}
                        >
                          ▶
                        </button>
                        <button
                          type="button"
                          className="pb-date-link"
                          onClick={() => openCidModal(r.cidDescricao)}
                          title={r.cidDescricao}
                        >
                          {r.cidDescricao}
                        </button>
                      </td>
                      <td className="pb-td-text" title={r.cidCodigo}>
                        {r.cidCodigo}
                      </td>
                      <td className="num col-start">{r.eventos.toLocaleString("pt-BR")}</td>
                      <td className="num">{r.colaboradoresQtd.toLocaleString("pt-BR")}</td>
                      <td className="num col-hrs">{fmtMin(r.horas)}</td>
                      <td className="num col-pres">{r.presentes.toLocaleString("pt-BR")}</td>
                      <td className="num col-ause">{r.ausentes.toLocaleString("pt-BR")}</td>
                      <td className="num col-ause">{fmtMin(r.horas_ausentes)}</td>
                      <td className="num col-just">{r.justificadas.toLocaleString("pt-BR")}</td>
                      <td className="num col-extr">{r.extras.toLocaleString("pt-BR")}</td>
                    </tr>
                    {isExpanded && renderCidDrill(r)}
                  </React.Fragment>
                );
              })
            )}
          </tbody>
          <tfoot>
            <tr className="totals-row">
              <td className="date-cell totals-label" colSpan={2}>
                Totais <span className="pct">({cidRows.length} CID)</span>
              </td>
              <td className="num col-start">{cidTotals.eventos.toLocaleString("pt-BR")}</td>
              <td className="num">{cidTotals.colaboradores.toLocaleString("pt-BR")}</td>
              <td className="num col-hrs">{fmtMin(cidTotals.horas)}</td>
              <td className="num col-pres">{cidTotals.presentes.toLocaleString("pt-BR")}</td>
              <td className="num col-ause">{cidTotals.ausentes.toLocaleString("pt-BR")}</td>
              <td className="num col-ause">{fmtMin(cidTotals.horas_ausentes)}</td>
              <td className="num col-just">{cidTotals.justificadas.toLocaleString("pt-BR")}</td>
              <td className="num col-extr">{cidTotals.extras.toLocaleString("pt-BR")}</td>
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  );

  const riskTableInner = tableView === "risk" && !empRows && (
    <div className="pb-hist-table-wrap pb-hist-table-wrap--risk">
      {riskTotals.eventos > 0 && (
        <div className="pb-hist-risk-summary">
          <span>
            {riskRows.length.toLocaleString("pt-BR")} tipo(s) de evento ·{" "}
            {riskTotals.eventos.toLocaleString("pt-BR")} ocorrência(s) ·{" "}
            {riskTotals.colaboradores.toLocaleString("pt-BR")} colaborador(es)
          </span>
          <button type="button" className="pb-date-link" onClick={() => openRiscoModal()}>
            Ver todas as ocorrências
          </button>
        </div>
      )}
      <div className="pb-hist-table-scroll" ref={tableScrollRef}>
        <table className="pb-hist-table pb-hist-table--group pb-hist-table--risk">
          <colgroup>
            <col className="pb-risk-col-evento" />
            <col className="pb-risk-col-ocorr" />
            <col className="pb-risk-col-colab" />
          </colgroup>
          <thead>
            <tr>
              {riskSortHeader("Evento — Risco Trab.", "evento")}
              {riskSortHeader("Ocorrências", "eventos", "num col-start")}
              {riskSortHeader("Colab.", "colaboradoresQtd", "num")}
            </tr>
          </thead>
          <tbody>
            {riskRows.length === 0 ? (
              <tr>
                <td
                  colSpan={riskColSpan}
                  style={{
                    textAlign: "center",
                    padding: "32px 16px",
                    color: "var(--pb-text-2,#94a3b8)",
                    fontSize: 13,
                  }}
                >
                  Nenhuma penalidade de risco trabalhista no período — classifique eventos como
                  Risco Trab. em Configurações → Horas.
                </td>
              </tr>
            ) : (
              sortedRiskRows.map((r) => {
                const isExpanded = expandedRisk.has(r.evento);
                return (
                  <React.Fragment key={r.evento}>
                    <tr>
                      <td className="date-cell">
                        <button
                          type="button"
                          className={`pb-drill-toggle${isExpanded ? " open" : ""}`}
                          onClick={() => toggleRiskExpand(r.evento)}
                          aria-expanded={isExpanded}
                        >
                          ▶
                        </button>
                        <button
                          type="button"
                          className="pb-date-link"
                          onClick={() => openRiscoModal({ eventLabel: r.evento })}
                          title={r.evento}
                        >
                          {r.evento}
                        </button>
                      </td>
                      <td className="num col-start">
                        <button
                          type="button"
                          className="pb-date-link"
                          onClick={() => openRiscoModal({ eventLabel: r.evento })}
                        >
                          {r.eventos.toLocaleString("pt-BR")}
                        </button>
                      </td>
                      <td className="num">{r.colaboradoresQtd.toLocaleString("pt-BR")}</td>
                    </tr>
                    {isExpanded && renderRiskDrill(r)}
                  </React.Fragment>
                );
              })
            )}
          </tbody>
          <tfoot>
            <tr className="totals-row">
              <td className="date-cell totals-label">
                Totais{" "}
                <span className="pct">
                  ({riskRows.length} tipo{riskRows.length !== 1 ? "s" : ""} ·{" "}
                  {riskTotals.eventos.toLocaleString("pt-BR")} ocorr.)
                </span>
              </td>
              <td className="num col-start">{riskTotals.eventos.toLocaleString("pt-BR")}</td>
              <td
                className="num"
                title="Colaboradores únicos no período, sem duplicar quem aparece em mais de um tipo de evento"
              >
                {riskTotals.colaboradores.toLocaleString("pt-BR")}
              </td>
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  );

  const eventTableInner = tableView === "event" && !empRows && (
    <div className="pb-hist-table-wrap">
      <div className="pb-hist-table-scroll">
        <table className="pb-hist-table pb-hist-table--group">
          <thead>
            <tr>
              {eventSortHeader("Evento", "evento")}
              {eventSortHeader("Codigo", "codigo")}
              {eventSortHeader("Categoria", "categoria")}
              {eventSortHeader("Ocorr.", "eventos", "num col-start")}
              {eventSortHeader("Colab.", "colaboradoresQtd", "num")}
              {eventSortHeader(eventJustificadasMode ? "Hrs. justificadas" : "Horas", "horas", "num col-hrs")}
              {!eventJustificadasMode && eventSortHeader("Ausentes", "ausentes", "num col-ause")}
              {eventSortHeader("Justif.", "justificadas", "num col-just")}
              {!eventJustificadasMode && eventSortHeader("Extras", "extras", "num col-extr")}
              {!eventJustificadasMode && eventSortHeader("Risco", "risco", "num")}
            </tr>
          </thead>
          <tbody>
            {eventRows.length === 0 ? (
              <tr>
                <td
                  colSpan={eventColSpan}
                  style={{
                    textAlign: "center",
                    padding: "32px 16px",
                    color: "var(--pb-text-2,#94a3b8)",
                    fontSize: 13,
                  }}
                >
                  Nenhum evento encontrado no periodo.
                </td>
              </tr>
            ) : (
              sortedEventRows.map((r) => {
                const isExpanded = expandedEvents.has(r.key);
                return (
                  <React.Fragment key={r.key}>
                    <tr>
                      <td className="date-cell">
                        <button
                          type="button"
                          className={`pb-drill-toggle${isExpanded ? " open" : ""}`}
                          onClick={() => toggleEventExpand(r.key)}
                          aria-expanded={isExpanded}
                        >
                          â–¶
                        </button>
                        <button
                          type="button"
                          className="pb-date-link"
                          onClick={() => openEventModal(r.key)}
                          title={r.evento}
                        >
                          {r.evento}
                        </button>
                      </td>
                      <td className="pb-td-text" title={r.codigo}>{r.codigo}</td>
                      <td className="pb-td-text" title={r.categoria}>{r.categoria}</td>
                      <td className="num col-start">{r.eventos.toLocaleString("pt-BR")}</td>
                      <td className="num">{r.colaboradoresQtd.toLocaleString("pt-BR")}</td>
                      <td className="num col-hrs">{fmtMin(r.horas)}</td>
                      {!eventJustificadasMode && <td className="num col-ause">{r.ausentes.toLocaleString("pt-BR")}</td>}
                      <td className="num col-just">{r.justificadas.toLocaleString("pt-BR")}</td>
                      {!eventJustificadasMode && <td className="num col-extr">{r.extras.toLocaleString("pt-BR")}</td>}
                      {!eventJustificadasMode && <td className="num">{r.risco.toLocaleString("pt-BR")}</td>}
                    </tr>
                    {isExpanded && renderEventDrill(r)}
                  </React.Fragment>
                );
              })
            )}
          </tbody>
          <tfoot>
            <tr className="totals-row">
              <td className="date-cell totals-label" colSpan={3}>
                Totais <span className="pct">({eventRows.length} eventos)</span>
              </td>
              <td className="num col-start">{eventTotals.eventos.toLocaleString("pt-BR")}</td>
              <td className="num">{eventTotals.colaboradores.toLocaleString("pt-BR")}</td>
              <td className="num col-hrs">{fmtMin(eventTotals.horas)}</td>
              {!eventJustificadasMode && <td className="num col-ause">{eventTotals.ausentes.toLocaleString("pt-BR")}</td>}
              <td className="num col-just">{eventTotals.justificadas.toLocaleString("pt-BR")}</td>
              {!eventJustificadasMode && <td className="num col-extr">{eventTotals.extras.toLocaleString("pt-BR")}</td>}
              {!eventJustificadasMode && <td className="num">{eventTotals.risco.toLocaleString("pt-BR")}</td>}
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  );

  const colabTableInner = tableView === "colab" && !empRows && (
    <div className="pb-hist-table-wrap">
      <div className="pb-hist-table-scroll">
        <table className="pb-hist-table pb-hist-table--group">
          <thead>
            <tr>
              {colabSortHeader("Colaborador", "nome")}
              {colabSortHeader("Mat.", "mat")}
              {colabSortHeader("Filial", "filial")}
              {colabSortHeader("Departamento", "dept")}
              {colabSortHeader("Cargo", "cargo")}
              {colabSortHeader("Dias", "diasQtd", "num col-start")}
              {colabSortHeader("Eventos", "eventos", "num")}
              {colabSortHeader("Plan.", "horas_planejadas", "num col-hrs")}
              {colabSortHeader("Trab.", "horas_presentes", "num col-hrs")}
              {colabSortHeader("Aus.", "horas_ausentes", "num col-ause")}
              {colabSortHeader("Just.", "horas_justificadas", "num col-just")}
              {colabSortHeader("Extras", "horas_extras", "num col-extr")}
              {colabSortHeader("Risco", "risco", "num")}
              {colabSortHeader("Abs.", "absenteismo", "num col-hrs")}
            </tr>
          </thead>
          <tbody>
            {colabRows.length === 0 ? (
              <tr>
                <td
                  colSpan={colabColSpan}
                  style={{
                    textAlign: "center",
                    padding: "32px 16px",
                    color: "var(--pb-text-2,#94a3b8)",
                    fontSize: 13,
                  }}
                >
                  Nenhum colaborador encontrado no periodo.
                </td>
              </tr>
            ) : (
              sortedColabRows.map((r) => {
                const isExpanded = expandedColabs.has(r.key);
                return (
                  <React.Fragment key={r.key}>
                    <tr>
                      <td className="date-cell">
                        <button
                          type="button"
                          className={`pb-drill-toggle${isExpanded ? " open" : ""}`}
                          onClick={() => toggleColabExpand(r.key)}
                          aria-expanded={isExpanded}
                        >
                          â–¶
                        </button>
                        <button
                          type="button"
                          className="pb-date-link"
                          onClick={() => openColabModal(r.key)}
                          title={r.nome}
                        >
                          {r.nome}
                        </button>
                      </td>
                      <td className="pb-td-text" title={r.mat}>{r.mat || "-"}</td>
                      <td className="pb-td-text" title={r.filial}>{r.filial}</td>
                      <td className="pb-td-text" title={r.dept}>{r.dept}</td>
                      <td className="pb-td-text" title={r.cargo}>{r.cargo}</td>
                      <td className="num col-start">{r.diasQtd.toLocaleString("pt-BR")}</td>
                      <td className="num">{r.eventos.toLocaleString("pt-BR")}</td>
                      <td className="num col-hrs">{fmtMin(r.horas_planejadas)}</td>
                      <td className="num col-hrs">{fmtMin(r.horas_presentes)}</td>
                      <td className="num col-ause">{fmtMin(r.horas_ausentes)}</td>
                      <td className="num col-just">{fmtMin(r.horas_justificadas)}</td>
                      <td className="num col-extr">{fmtMin(r.horas_extras)}</td>
                      <td className="num">{r.risco.toLocaleString("pt-BR")}</td>
                      <td className="num col-hrs">{fmtPct(r.absenteismo)}</td>
                    </tr>
                    {isExpanded && renderColabDrill(r)}
                  </React.Fragment>
                );
              })
            )}
          </tbody>
          <tfoot>
            <tr className="totals-row">
              <td className="date-cell totals-label" colSpan={5}>
                Totais <span className="pct">({colabTotals.colaboradores} colab.)</span>
              </td>
              <td className="num col-start">{colabTotals.dias.toLocaleString("pt-BR")}</td>
              <td className="num">{colabTotals.eventos.toLocaleString("pt-BR")}</td>
              <td className="num col-hrs">{fmtMin(colabTotals.horas_planejadas)}</td>
              <td className="num col-hrs">{fmtMin(colabTotals.horas_presentes)}</td>
              <td className="num col-ause">{fmtMin(colabTotals.horas_ausentes)}</td>
              <td className="num col-just">{fmtMin(colabTotals.horas_justificadas)}</td>
              <td className="num col-extr">{fmtMin(colabTotals.horas_extras)}</td>
              <td className="num" />
              <td className="num col-hrs">{fmtPct(colabTotals.absenteismo)}</td>
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  );

  const activeTable =
    empTableInner ||
    colabTableInner ||
    eventTableInner ||
    riskTableInner ||
    cidTableInner ||
    deptTableInner ||
    cargoTableInner ||
    generoTableInner ||
    tableInner;

  return (
    <>
      {ctrlEl &&
        !isFloating &&
        createPortal(
          <>
            {viewToggleEl}
            {searchEl}
            {colsAndFloat}
          </>,
          ctrlEl,
        )}
      {isFloating
        ? createPortal(
            <div
              className="pb-hist-float-overlay"
              data-theme={theme}
            >
              <div
                className={`pos-bento pb-hist-float-panel${floatMaximized ? " is-maximized" : ""}`}
                data-theme={theme}
                ref={floatPanelRef}
                style={{
                  ...(floatMaximized
                    ? {
                        left: 12,
                        top: 12,
                        width: "calc(100vw - 24px)",
                        height: "calc(100vh - 24px)",
                      }
                    : {
                        left: floatPos.x,
                        top: floatPos.y,
                        ...(floatSize.w ? { width: floatSize.w } : {}),
                        ...(floatSize.h ? { height: floatSize.h } : {}),
                      }),
                }}
              >
                {floatToolbar}
                {activeTable}
                {/* resize handles */}
                {!floatMaximized && ["e", "s", "se"].map((dir) => (
                  <div
                    key={dir}
                    className={`pb-resize-handle pb-resize-${dir}`}
                    onMouseDown={(e) => {
                      if (e.button !== 0) return;
                      e.preventDefault();
                      const panel = floatPanelRef.current;
                      if (!panel) return;
                      const rect = panel.getBoundingClientRect();
                      dragRef.current = {
                        type: "resize",
                        startMX: e.clientX,
                        startMY: e.clientY,
                        startW: rect.width,
                        startH: rect.height,
                        dir,
                      };
                    }}
                  />
                ))}
              </div>
            </div>,
            document.body,
          )
        : (
            <div
              className={[
                "pb-hist-table-host",
                embeddedInChart && "pb-hist-table-host--embedded",
                tableView === "risk" && "pb-hist-table-host--risk",
              ]
                .filter(Boolean)
                .join(" ")}
            >
              {activeTable}
            </div>
          )}
      {exportBusy &&
        createPortal(
          <div
            role="status"
            aria-live="polite"
            style={{
              position: "fixed",
              inset: 0,
              zIndex: 9999,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              background: "rgba(0,0,0,0.35)",
            }}
          >
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 12,
                padding: "16px 24px",
                borderRadius: 12,
                background: "var(--pb-surface-2, #1e293b)",
                border: "1px solid var(--pb-border, rgba(255,255,255,.12))",
                boxShadow: "0 8px 32px rgba(0,0,0,.4)",
                color: "var(--pb-text, #f1f5f9)",
                fontWeight: 700,
                fontSize: 14,
              }}
            >
              <span
                aria-hidden
                style={{
                  width: 18,
                  height: 18,
                  borderRadius: "50%",
                  border: "2.5px solid rgba(255,255,255,.25)",
                  borderTopColor: "#60a5fa",
                  display: "inline-block",
                  animation: "pos-spin 0.8s linear infinite",
                }}
              />
              <style>{`@keyframes pos-spin { to { transform: rotate(360deg); } }`}</style>
              Aguarde, {exportBusy.label}
            </div>
          </div>,
          document.body,
        )}
      {activeDayModal && (
        <HistoricoDayModal
          key={`${activeDayModal.date ?? ""}|${activeDayModal.label ?? ""}|${activeDayModal.initialPillFilter ?? ""}|${activeDayModal.columnPreset ?? ""}`}
          date={activeDayModal.date}
          label={activeDayModal.label}
          employees={activeDayModal.employees}
          events={activeDayModal.events}
          histDayRows={filtered}
          dataSource={CONFIG.ABSENTEISMO_API ? "api" : "local"}
          apiContext={{
            enabled: true,
            de: dateDraftFrom || dateFrom || activeDayModal.eventsDateFrom,
            ate: dateDraftTo || dateTo || activeDayModal.eventsDateTo,
          }}
          eventsDateFrom={activeDayModal.eventsDateFrom}
          eventsDateTo={activeDayModal.eventsDateTo}
          onDateRangeApply={handleModalDateRangeApply}
          hasHours={hasHours}
          hasExtras={hasExtras}
          initialPillFilter={activeDayModal.initialPillFilter ?? null}
          columnPreset={activeDayModal.columnPreset ?? null}
          onClose={() => setDayModal(null)}
          theme={theme}
          onOpenAbsTrend={
            activeDayModal.canOpenAbsTrend
              ? () => {
                  const groupType = activeDayModal.groupType;
                  const groupValue = activeDayModal.groupValue;
                  setDayModal(null);
                  openGroupAbsTrend(groupType, groupValue);
                }
              : null
          }
        />
      )}
      <RadarKpiModal
        open={absTrendModal != null}
        variant="abs"
        onClose={() => setAbsTrendModal(null)}
        theme={theme}
        histRowsAll={absTrendModal?.rows || []}
        absMeta={absMeta}
        contextLabel={
          absTrendModal ? `${absTrendModal.groupType}: ${absTrendModal.groupValue}` : ""
        }
        periodLabel={
          absTrendModal?.rows?.length
            ? `${absTrendModal.rows[0].date.slice(8, 10)}/${absTrendModal.rows[0].date.slice(5, 7)}/${absTrendModal.rows[0].date.slice(2, 4)} - ${absTrendModal.rows[absTrendModal.rows.length - 1].date.slice(8, 10)}/${absTrendModal.rows[absTrendModal.rows.length - 1].date.slice(5, 7)}/${absTrendModal.rows[absTrendModal.rows.length - 1].date.slice(2, 4)}`
            : ""
        }
        customPeriod
        periodoApuracao={periodoApuracao}
      />
      <EmpPresenceModal
        open={!!presenceProfileRow}
        onClose={() => setPresenceProfileRow(null)}
        theme={theme}
        row={presenceProfileRow}
        histRows={presenceHistRows}
        dateFrom={effectiveDateFrom}
        dateTo={effectiveDateTo}
        periodoApuracao={periodoApuracao}
      />
    </>
  );
}

export default HistoricoTable;
