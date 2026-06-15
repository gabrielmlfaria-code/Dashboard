import React, { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useQueryClient } from "@tanstack/react-query";

import { CONFIG } from "../../configLocal.js";
import { Toast } from "../../core/toast.js";
import { usePosicaoDia, usePosicaoHistorico, POSICAO_KEYS } from "../../hooks/usePosicao.js";
import { PosicaoBentoHeader } from "./PosicaoBentoHeader.jsx";
import { HistoricoDayModal } from "./HistoricoDayModal.jsx";
import "./HistoricoDayModal.css";
import DeptCtrlBar from "./DeptCtrlBar.jsx";
import {
  buildPosListModalData,
  filterEventsForPosListKey,
  flattenHistEvents,
} from "./posicaoHdmBridge.js";
import { loadEventCategories } from "./HorasConfigModal.jsx";
import {
  POSICAO_CATEGORIES,
  POSICAO_IMPORT_OVERRIDES_KEY,
  applyImportOverrides,
  applyImportOverridesToHistorico,
  buildAbsenceListRows,
  buildAbsenceListRowsFromStats,
  colaboradoresFromHistForCat,
  employeesFromDayPayload,
  getColaboradoresFromGroup,
  getHistRowForDate,
  getOverridesForDate,
  importPosicaoXlsxFile,
  loadImportOverrides,
  loadImportOverridesMerged,
  mergeHistDayRow,
  mergeHistTableRows,
  mergeImportFromByCat,
  mergeImportFromHistRow,
  normalizeOverridesStore,
  normalizePosicaoDiaPayload,
  persistImportOverrides,
  pickDefaultHistDate,
  resolveDiaPayload,
} from "./posicaoImport.js";
import { normDateKey, resolvePeriodoApuracao } from "./calendarUtils.js";
import { resolveModalDatesFromApuracao } from "./consecFaltasTimeline.js";
import { getBancoHorasImportRows, parseBancoHorasDate } from "./bancoHoras.js";
import { resetPosEmbeddedBucketSearch } from "./posicaoHdmEmbeddedCols.js";
import { normalizeForcaPrevistaDeptoMap, getForcaPrevistaQty } from "./posicaoSettings.js";
import { importCctPdfFiles } from "./posicaoCctStorage.js";
import { summarizePositionDay } from "./domain/positionMetrics.js";
import { normalizePositionEmployeesFromDay } from "./domain/positionRows.js";
import {
  exportPosicaoBackup,
  importPosicaoBackupFile,
  loadHistTableImportFromLocalStorage,
  loadHistTableImportMerged,
  removeHistTableImport,
  saveHistTableImport,
} from "./posicaoDataBackup.js";
import {
  loadPosicaoStoredValue,
  removePosicaoStoredValue,
  savePosicaoStoredValue,
} from "./posicaoStorage.js";

const INITIAL_DATA_LOAD_TIMEOUT_MS = 3_000;

function buildHistRowFromDia(dia) {
  if (!dia) return null;

  const summary = summarizePositionDay(dia);

  return {
    ...dia,
    date: dia?.date || dia?.data_referencia || dia?.data || "",
    presentes: summary.presentes,
    faltas: summary.falta,
    atrasos: summary.atraso,
    total: summary.total,
    justificadas: Number(
      dia?.faltas_justificadas ?? dia?.faltasJustificadas ?? dia?.justificadas ?? 0,
    ),
    abs_rate: summary.absRate,
  };
}

function buildEmployeesFromDetailRow(row, filterFn = () => true) {
  if (!row) return null;
  const employees = normalizePositionEmployeesFromDay(row, filterFn);
  return employees.length > 0 ? employees : null;
}

const parseBancoHorasModalDate = (value, fallback = "") => {
  const parsed = parseBancoHorasDate(value);
  if (parsed) return parsed;
  if (value instanceof Date && !Number.isNaN(value.getTime())) return normDateKey(value);
  const iso = normDateKey(String(value || "").trim());
  if (iso) return iso;
  return normDateKey(fallback) || fallback || "";
};

const bancoHorasModalLabel = (row, keys) => {
  for (const key of keys) {
    const value = row?.[key];
    if (value != null && String(value).trim()) return String(value).trim();
  }
  return "";
};

const buildBancoHorasModalEvents = (depto, fallbackDate = "") => {
  const items = Array.isArray(depto?.items) ? depto.items : [];
  const deptName = String(depto?.label || depto?.departamento || "").trim();
  return items.map((row, idx) => {
    const credito = Number(row?.credito || 0);
    const debito = Number(row?.debito || 0);
    const movimento = credito || debito ? credito - debito : Number(row?.saldoProximo || 0);
    const data = parseBancoHorasModalDate(row?.periodoInicial || row?.data || row?.date, fallbackDate);
    const inicio = parseBancoHorasModalDate(row?.periodoInicial, data);
    const termino = parseBancoHorasModalDate(row?.periodoFinal, data);
    const evento =
      credito && debito
        ? "BANCO DE HORAS - CRÉDITO / DÉBITO"
        : credito
          ? "BANCO DE HORAS - CRÉDITO"
          : debito
            ? "BANCO DE HORAS - DÉBITO"
            : "BANCO DE HORAS";
    return {
      mat: bancoHorasModalLabel(row, ["matricula", "colaborador.matricula", "codigo", "cod"]) || `${idx + 1}`,
      nome: bancoHorasModalLabel(row, ["nome", "colaborador.nome", "colaborador", "name"]),
      genero: bancoHorasModalLabel(row, ["genero", "sexo"]),
      data,
      depto: bancoHorasModalLabel(row, ["departamento", "departamentoNome", "depto", "depto_desc"]) || deptName,
      filial: bancoHorasModalLabel(row, ["filial", "filialNome", "filial.nome"]),
      cargo: bancoHorasModalLabel(row, ["cargo", "cargo_desc", "cargoDescricao"]),
      inicio,
      termino,
      cod: "BH",
      evento,
      atividade: bancoHorasModalLabel(row, ["atividade", "situacao", "situacaoDesc"]),
      horas: Math.abs(movimento),
      _cat: "extras",
      creditoBH: credito,
      debitoBH: debito,
      horasPagasBH: Math.max(0, Number(row?.horasPagas || 0)),
      saldoAnteriorBH: row?.hasSaldoAnterior === false ? null : Number(row?.saldoAnterior || 0),
      saldoProximoBH: row?.saldoProximo != null ? Number(row.saldoProximo) || 0 : null,
    };
  });
};

const bancoHorasDeptKey = (value) =>
  String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "");

const BANCO_HORAS_KPI_LABELS = {
  saldo_proximo: "Saldo próximo",
  movimento: "Movimento",
  saldo_anterior: "Saldo anterior",
  credito: "Crédito",
  debito: "Débito",
};

const filterBancoHorasEventsByKpi = (events, kpi) => {
  const list = Array.isArray(events) ? events : [];
  switch (kpi) {
    case "credito":
      return list.filter((ev) => Number(ev?.creditoBH || 0) > 0);
    case "debito":
      return list.filter((ev) => Number(ev?.debitoBH || 0) > 0);
    case "movimento":
      return list.filter(
        (ev) => Number(ev?.creditoBH || 0) > 0 || Number(ev?.debitoBH || 0) > 0,
      );
    case "saldo_anterior":
      return list.filter((ev) => ev?.saldoAnteriorBH != null);
    case "saldo_proximo":
    default:
      return list;
  }
};

const filterBancoHorasRowsByKpi = (rows, kpi) => {
  const list = Array.isArray(rows) ? rows : [];
  switch (kpi) {
    case "credito":
      return list.filter((row) => Number(row?.credito || 0) > 0);
    case "debito":
      return list.filter((row) => Number(row?.debito || 0) > 0);
    case "movimento":
      return list.filter(
        (row) => Number(row?.credito || 0) > 0 || Number(row?.debito || 0) > 0,
      );
    case "saldo_anterior":
      return list.filter(
        (row) =>
          row?.hasSaldoAnterior !== false &&
          (row?.hasSaldoAnterior || Number(row?.saldoAnterior || 0) !== 0),
      );
    case "saldo_proximo":
    default:
      return list;
  }
};

export function PosicaoDiaPanel() {
  const queryClient = useQueryClient();

  const [presentesDate, setPresentesDate] = useState(() => {
    try {
      return normDateKey(localStorage.getItem("pos_presentes_date")) || "";
    } catch {
      return "";
    }
  });
  const didApplyInitialImportDate = useRef(false);

  const diaQuery = usePosicaoDia(presentesDate || undefined);
  const histQuery = usePosicaoHistorico(180);

  const [, setImportVersion] = useState(0);
  const [histTableImport, setHistTableImport] = useState(() =>
    loadHistTableImportFromLocalStorage(),
  );
  const [importOverrides, setImportOverridesState] = useState(() => loadImportOverrides());

  useEffect(() => {
    let alive = true;
    (async () => {
      const [rows, overrides] = await Promise.all([
        loadHistTableImportMerged(),
        loadImportOverridesMerged(),
      ]);
      if (!alive) return;
      if (rows?.length) {
        setHistTableImport((prev) => mergeHistTableRows(prev, rows));
      }
      if (overrides?.byDate && Object.keys(overrides.byDate).length) {
        setImportOverridesState(overrides);
        setImportVersion((v) => v + 1);
      }
    })();
    return () => {
      alive = false;
    };
  }, []);

  const loading = diaQuery.isPending;
  const err = diaQuery.error ?? null;
  const dia = useMemo(
    () =>
      resolveDiaPayload({
        apiData: diaQuery.data,
        histRows: histTableImport,
        importOverrides,
        date: presentesDate,
      }),
    [diaQuery.data, histTableImport, importOverrides, presentesDate],
  );
  const [loadingTimedOut, setLoadingTimedOut] = useState(false);
  useEffect(() => {
    if (!loading) {
      setLoadingTimedOut(false);
      return undefined;
    }
    const t = setTimeout(() => setLoadingTimedOut(true), INITIAL_DATA_LOAD_TIMEOUT_MS);
    return () => clearTimeout(t);
  }, [loading]);

  const showLoading = loading && !dia && !err && !loadingTimedOut;
  const showApiError = !CONFIG.USE_MOCK && !showLoading && !!err && !dia;
  const showEmptyPlanilha = !showLoading && !showApiError && !dia;

  useEffect(() => {
    if (!Array.isArray(histTableImport) || !histTableImport.length) return;
    if (!didApplyInitialImportDate.current) {
      didApplyInitialImportDate.current = true;
      const latest = pickDefaultHistDate(histTableImport, "");
      if (latest && latest !== presentesDate) {
        setPresentesDate(latest);
        return;
      }
    }
    const best = pickDefaultHistDate(histTableImport, presentesDate);
    if (!best) return;
    const cur = String(presentesDate || "").trim();
    if (cur === best && getHistRowForDate(histTableImport, cur)) return;
    if (!cur || !getHistRowForDate(histTableImport, cur)) {
      if (best !== cur) setPresentesDate(best);
    }
  }, [histTableImport, presentesDate]);

  const [periodoApuracaoOverride, setPeriodoApuracaoOverride] = useState(null);

  const hist = useMemo(() => {
    const base = histTableImport || histQuery.data;
    const rows =
      Array.isArray(base) && base.length ? base : dia ? [buildHistRowFromDia(dia)] : null;
    return rows ? applyImportOverridesToHistorico(rows, importOverrides) : null;
  }, [histTableImport, histQuery.data, dia, importOverrides]);

  const histRowsForPeriodo = useMemo(
    () => (Array.isArray(hist) && hist.length ? hist : histTableImport) || [],
    [hist, histTableImport],
  );

  const periodoApuracao = useMemo(
    () =>
      resolvePeriodoApuracao({
        override: periodoApuracaoOverride,
        dia: diaQuery.data,
        hist: histQuery.data,
        histRows: histRowsForPeriodo,
      }),
    [periodoApuracaoOverride, diaQuery.data, histQuery.data, histRowsForPeriodo],
  );

  const resolvePosListModalDates = useCallback(
    (refDate = "") => {
      const ref = String(
        refDate || presentesDate || dia?.data_referencia || new Date().toISOString().slice(0, 10),
      );
      const { dateFrom, dateTo } = resolveModalDatesFromApuracao(periodoApuracao, histRowsForPeriodo);
      return {
        from: dateFrom || periodoApuracao?.de || ref,
        to: dateTo || periodoApuracao?.ate || periodoApuracao?.de || ref,
      };
    },
    [periodoApuracao, histRowsForPeriodo, presentesDate, dia?.data_referencia],
  );

  const [activeCat, setActiveCat] = useState(() => {
    try {
      return localStorage.getItem("pos_last_activeCat") || "presentes";
    } catch {
      return "presentes";
    }
  });

  const [q, setQ] = useState(() => {
    try {
      return localStorage.getItem("pos_last_q") || "";
    } catch {
      return "";
    }
  });
  const [histView, setHistView] = useState(() => {
    try {
      return localStorage.getItem("pos_histView") || "chart";
    } catch {
      return "chart";
    }
  });
  const [consecQ, setConsecQ] = useState("");
  const [histSeries, setHistSeries] = useState(() => {
    try {
      const raw = localStorage.getItem("pos_histSeries");
      const parsed = raw ? JSON.parse(raw) : null;
      if (parsed && typeof parsed === "object")
        return { abs: true, faltas: true, atrasos: true, prev: false, ...parsed };
    } catch {}
    return { abs: true, faltas: true, atrasos: true, prev: false };
  });
  const [comparePrev, setComparePrev] = useState(() => {
    try {
      return localStorage.getItem("pos_comparePrev") === "1";
    } catch {
      return false;
    }
  });
  useEffect(() => {
    try {
      localStorage.setItem("pos_histView", String(histView || "chart"));
    } catch {}
  }, [histView]);
  useEffect(() => {
    try {
      localStorage.setItem("pos_histSeries", JSON.stringify(histSeries || {}));
    } catch {}
  }, [histSeries]);
  useEffect(() => {
    try {
      localStorage.setItem("pos_comparePrev", comparePrev ? "1" : "0");
    } catch {}
  }, [comparePrev]);

  const [showHome, setShowHome] = useState(() => {
    try {
      const v = localStorage.getItem("pos_last_showHome");
      if (v === "0") return false;
      if (v === "1") return true;
      return true;
    } catch {
      return true;
    }
  });

  const [lastUpdText, setLastUpdText] = useState("--:--");

  const [barModalOpen, setBarModalOpen] = useState(() => {
    try {
      return localStorage.getItem("pos_barModalOpen") === "1";
    } catch {
      return false;
    }
  });
  const [deptModalOpen, setDeptModalOpen] = useState(() => {
    try {
      return localStorage.getItem("pos_deptModalOpen") === "1";
    } catch {
      return false;
    }
  });
  const [deptExpanded, setDeptExpanded] = useState(() => {
    try {
      return localStorage.getItem("pos_deptModalExpanded") === "1";
    } catch {
      return false;
    }
  });
  const deptDefaultRectRef = useRef(null);
  useEffect(() => {
    try {
      localStorage.setItem("pos_barModalOpen", barModalOpen ? "1" : "0");
    } catch {}
  }, [barModalOpen]);
  useEffect(() => {
    try {
      localStorage.setItem("pos_deptModalOpen", deptModalOpen ? "1" : "0");
    } catch {}
  }, [deptModalOpen]);
  useEffect(() => {
    try {
      localStorage.setItem("pos_deptModalExpanded", deptExpanded ? "1" : "0");
    } catch {}
  }, [deptExpanded]);

  const posListDefaultRectRef = useRef(null);

  const [posListEmbeddedCount, setPosListEmbeddedCount] = useState(0);
  const [posListModalOpen, setPosListModalOpen] = useState(() => {
    try {
      const v = localStorage.getItem("posListModalOpen");
      return v === "1";
    } catch {
      return false;
    }
  });

  const [posListKey, setPosListKey] = useState(() => {
    try {
      const v = localStorage.getItem("posListModalKey");
      return v || "presentes";
    } catch {
      return "presentes";
    }
  });
  const [posListDateFrom, setPosListDateFrom] = useState(() => presentesDate || "");
  const [posListDateTo, setPosListDateTo] = useState(() => presentesDate || "");
  const [posListFilialFilter, setPosListFilialFilter] = useState("");
  const [posListDeptoFilter, setPosListDeptoFilter] = useState("");
  const [posListInitialSearch, setPosListInitialSearch] = useState("");
  const [posListOverrideEvents, setPosListOverrideEvents] = useState(null);
  const [posListEmbeddedSession, setPosListEmbeddedSession] = useState(0);

  useEffect(() => {
    try {
      localStorage.setItem("posListModalOpen", posListModalOpen ? "1" : "0");
    } catch {}
  }, [posListModalOpen]);

  useEffect(() => {
    try {
      localStorage.removeItem("pos_use_legacy_grid");
    } catch {}
  }, []);

  useEffect(() => {
    try {
      localStorage.setItem("posListModalKey", String(posListKey || "presentes"));
    } catch {}
  }, [posListKey]);

  const [posListExpanded, setPosListExpanded] = useState(() => {
    try {
      return localStorage.getItem("posListModalExpanded") === "1";
    } catch {
      return false;
    }
  });

  useEffect(() => {
    try {
      localStorage.setItem("posListModalExpanded", posListExpanded ? "1" : "0");
    } catch {}
  }, [posListExpanded]);

  useEffect(() => {
    try {
      localStorage.setItem("pos_last_activeCat", String(activeCat || "presentes"));
    } catch {}
  }, [activeCat]);

  useEffect(() => {
    try {
      localStorage.setItem("pos_presentes_date", String(presentesDate || ""));
    } catch {}
  }, [presentesDate]);

  useEffect(() => {
    if (!diaQuery.data) return;
    try {
      const t = new Date();
      setLastUpdText(
        `${String(t.getHours()).padStart(2, "0")}:${String(t.getMinutes()).padStart(2, "0")}`,
      );
    } catch {
      setLastUpdText("--:--");
    }
  }, [diaQuery.data]);

  useEffect(() => {
    try {
      localStorage.setItem("pos_last_showHome", showHome ? "1" : "0");
    } catch {}
  }, [showHome]);

  useEffect(() => {
    try {
      localStorage.setItem("pos_last_q", String(q || ""));
    } catch {}
  }, [q]);

  useEffect(() => {
    if (typeof document === "undefined") return;
    const win = document.getElementById("posListModal");
    if (!win) return;

    if (posListModalOpen) {
      win.classList.add("open");
      try {
        win.classList.remove("minimized");
        win.classList.add("focused");
      } catch {}
    } else {
      win.classList.remove("open");
      try {
        win.classList.remove("minimized");
        win.classList.remove("focused");
      } catch {}
    }
  }, [posListModalOpen]);

  useEffect(() => {
    if (!posListModalOpen) return;
    if (typeof document === "undefined") return;

    const onClick = (ev) => {
      const t = ev.target;
      if (!t || !t.closest) return;
      const clsBtn = t.closest('[data-wm-cls="posListModal"]');
      if (clsBtn) {
        setPosListModalOpen(false);
      }
    };

    document.addEventListener("click", onClick, true);
    return () => document.removeEventListener("click", onClick, true);
  }, [posListModalOpen]);

  const [deptView, setDeptView] = useState("chart");
  const [deptMetrics, setDeptMetrics] = useState(() => {
    try {
      const raw = localStorage.getItem("pos_dept_metrics");
      if (raw) {
        const arr = JSON.parse(raw);
        if (Array.isArray(arr) && arr.length) return arr.map(String);
      }
      const single = localStorage.getItem("pos_dept_metric");
      if (single) return [String(single)];
    } catch {}
    return ["presentes"];
  });
  const [deptOrder, setDeptOrder] = useState(() => {
    try {
      return localStorage.getItem("pos_dept_order") || "desc";
    } catch {
      return "desc";
    }
  });
  const [deptChartFilter, setDeptChartFilter] = useState(() => {
    try {
      const raw = localStorage.getItem("pos_dept_filter");
      if (raw) {
        const arr = JSON.parse(raw);
        if (Array.isArray(arr)) return arr.map(String);
      }
    } catch {}
    return [];
  });

  useEffect(() => {
    try {
      localStorage.setItem("pos_dept_metrics", JSON.stringify(deptMetrics || []));
    } catch {}
  }, [deptMetrics]);

  useEffect(() => {
    try {
      localStorage.setItem("pos_dept_order", String(deptOrder || "desc"));
    } catch {}
  }, [deptOrder]);

  useEffect(() => {
    try {
      localStorage.setItem("pos_dept_filter", JSON.stringify(deptChartFilter || []));
    } catch {}
  }, [deptChartFilter]);

  useLayoutEffect(() => {
    // Garantir restore do tamanho ap?s o DOM do React existir
    try {
      const map = JSON.parse(localStorage.getItem("pp_panel_sizes") || "{}") || {};
      const s = map["pos_panelCat"];
      const panel = document.getElementById("pos_panelCat");
      if (panel && s) {
        if (s.h) panel.style.height = `${Math.max(200, parseInt(s.h, 10) || 0)}px`;
        if (s.w) {
          const nw = Math.max(280, parseInt(s.w, 10) || 0);
          panel.style.flexBasis = `${nw}px`;
          panel.style.flexGrow = "0";
          panel.style.flexShrink = "0";
          panel.style.minWidth = `${nw}px`;
        }
      }
    } catch {
      // ignore
    }
  }, []);

  const virtOuterRef = useRef(null);
  const [scrollTop, setScrollTop] = useState(0);
  const [outerH, setOuterH] = useState(420);

  const histCanvasRef = useRef(null);
  const chartRef = useRef(null);

  const barChartRef = useRef(null);

  const deptWrapRef = useRef(null);

  const deptChartRef = useRef(null);

  const normalizeOperationalListKey = (raw) => {
    const value = String(raw || "")
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase();
    if (["falta", "faltas", "ausente", "ausentes", "absence"].includes(value)) return "falta";
    if (["atraso", "atrasos", "delay"].includes(value)) return "atraso";
    if (["presentes", "presente", "coverage", "cobertura"].includes(value)) return "presentes";
    if (["semcontrole", "sem_controle", "naocontrolaponto", "nao_controla_ponto"].includes(value)) {
      return "nao_controla";
    }
    return raw ? String(raw) : "presentes";
  };

  const openDeptModal = (options = null) => {
    const hasOperationalPayload =
      options &&
      typeof options === "object" &&
      (options.departamento || options.depto || options.category || options.search);

    if (hasOperationalPayload) {
      const ref = String(presentesDate || dia?.data_referencia || new Date().toISOString().slice(0, 10));
      const listKey = normalizeOperationalListKey(options.category || "presentes");
      resetPosEmbeddedBucketSearch(listKey);
      setPosListEmbeddedSession((n) => n + 1);
      setPosListKey(listKey);
      setPosListOverrideEvents(null);
      setPosListInitialSearch(String(options.search || ""));
      setPosListDateFrom(ref);
      setPosListDateTo(ref);
      setPosListFilialFilter(filialFilter || "");
      setPosListDeptoFilter(String(options.departamento || options.depto || "").trim());
      setPosListModalOpen(true);
      return;
    }

    setDeptView("chart");
    setDeptModalOpen(true);
  };

  const openPosListModal = (keyName) => {
    setPosListKey(String(keyName || posListKey || "presentes"));
    setPosListOverrideEvents(null);
    setPosListInitialSearch("");
    const ref = String(presentesDate || dia?.data_referencia || new Date().toISOString().slice(0, 10));
    setPosListDateFrom(ref);
    setPosListDateTo(ref);
    setPosListFilialFilter(filialFilter || "");
    setPosListDeptoFilter(deptoFilter || "");
    setPosListModalOpen(true);
  };

  const openAbonosDeptColaboradores = (depto, kind = "pendentes") => {
    const ref = String(presentesDate || dia?.data_referencia || new Date().toISOString().slice(0, 10));
    const listKey = kind === "efetuados" ? "abonos_efetuados" : "abonos_pendentes";
    const dates = resolvePosListModalDates(ref);
    resetPosEmbeddedBucketSearch(listKey);
    setPosListEmbeddedSession((n) => n + 1);
    setPosListKey(listKey);
    setPosListOverrideEvents(null);
    setPosListInitialSearch("");
    setPosListDateFrom(dates.from);
    setPosListDateTo(dates.to);
    setPosListFilialFilter(filialFilter || "");
    setPosListDeptoFilter(String(depto || "").trim());
    setPosListModalOpen(true);
  };

  const clearPosListDeptFilter = useCallback(() => {
    setPosListDeptoFilter("");
  }, []);

  const openMensalEventColaboradores = (row) => {
    const ref = String(presentesDate || dia?.data_referencia || new Date().toISOString().slice(0, 10));
    const rawEvent = String(row?.event || "").trim();
    const eventMatch = rawEvent.match(/^(\d+[A-Z]?)\s*(?:[-–—]\s*)?(.+)?$/i);
    const eventCode = String(row?.eventCode || row?.code || eventMatch?.[1] || "").trim();
    const eventDesc = String(row?.eventDesc || row?.name || eventMatch?.[2] || "").trim();
    const label = eventDesc || rawEvent.replace(/\s*-\s*/g, " ").trim() || eventCode;
    const monthFrom = row?.month ? ymToIsoStart(String(row.month).replace(/^(\d{2})\/(\d{4})$/, "$2-$1")) : "";
    const monthTo = row?.month ? ymToIsoEnd(String(row.month).replace(/^(\d{2})\/(\d{4})$/, "$2-$1")) : "";
    setPosListKey("mensal_event");
    setPosListOverrideEvents(null);
    setPosListInitialSearch(label);
    const apuracaoDates = resolvePosListModalDates(ref);
    setPosListDateFrom(monthFrom || apuracaoDates.from);
    setPosListDateTo(monthTo || apuracaoDates.to);
    setPosListFilialFilter(filialFilter || "");
    setPosListDeptoFilter(deptoFilter || "");
    setPosListModalOpen(true);
  };

  const [turnoverModalFrom, setTurnoverModalFrom] = useState("");
  const [turnoverModalTo, setTurnoverModalTo] = useState("");
  const [turnoverModalKind, setTurnoverModalKind] = useState("");
  const [turnoverModalLabel, setTurnoverModalLabel] = useState("");

  const ymToIsoStart = (ym) => {
    const m = String(ym || "").match(/^(\d{4})-(\d{2})$/);
    if (!m) return "";
    return `${m[1]}-${m[2]}-01`;
  };
  const ymToIsoEnd = (ym) => {
    const m = String(ym || "").match(/^(\d{4})-(\d{2})$/);
    if (!m) return "";
    const y = +m[1];
    const mm = +m[2];
    const last = new Date(y, mm, 0); // day 0 of next month
    const dd = String(last.getDate()).padStart(2, "0");
    const mo = String(mm).padStart(2, "0");
    return `${y}-${mo}-${dd}`;
  };

  const openTurnoverDesligados = (range) => {
    const fromYm = range && typeof range === "object" ? range.from : "";
    const toYm = range && typeof range === "object" ? range.to : "";
    setTurnoverModalFrom(ymToIsoStart(fromYm) || "");
    setTurnoverModalTo(ymToIsoEnd(toYm) || "");
    setTurnoverModalKind("turnover_desligados");
    setTurnoverModalLabel("Desligados");
    setPosListKey("turnover_desligados");
    setPosListOverrideEvents(null);
    setPosListModalOpen(true);
  };

  const openTurnoverAdmitidos = (range) => {
    const fromYm = range && typeof range === "object" ? range.from : "";
    const toYm = range && typeof range === "object" ? range.to : "";
    const lbl = range && typeof range === "object" ? range.label : "";
    setTurnoverModalFrom(ymToIsoStart(fromYm) || "");
    setTurnoverModalTo(ymToIsoEnd(toYm) || "");
    setTurnoverModalKind("turnover_admitidos");
    setTurnoverModalLabel(String(lbl || "Admitidos"));
    setPosListKey("turnover_admitidos");
    setPosListOverrideEvents(null);
    setPosListModalOpen(true);
  };

  // ---- Filtros globais (Filial / Departamento) ----
  const [filialFilter, setFilialFilter] = useState(() => {
    try {
      return localStorage.getItem("pos_filial_filter") || "";
    } catch {
      return "";
    }
  });
  const [deptoFilter, setDeptoFilter] = useState(() => {
    try {
      return localStorage.getItem("pos_depto_filter") || "";
    } catch {
      return "";
    }
  });
  useEffect(() => {
    try {
      localStorage.setItem("pos_filial_filter", filialFilter || "");
    } catch {}
  }, [filialFilter]);
  useEffect(() => {
    try {
      localStorage.setItem("pos_depto_filter", deptoFilter || "");
    } catch {}
  }, [deptoFilter]);

  // Tema (claro/escuro)
  const [theme, setTheme] = useState(() => {
    try {
      const raw = localStorage.getItem("mp_theme");
      const parsed = raw ? JSON.parse(raw) : "light";
      return parsed === "dark" ? "dark" : "light";
    } catch {
      return "light";
    }
  });
  useEffect(() => {
    try {
      localStorage.setItem("mp_theme", JSON.stringify(theme));
      if (typeof document !== "undefined") {
        document.body.setAttribute("data-theme", theme);
        document.documentElement.setAttribute("data-theme", theme);
        ["posListModal", "deptModal", "posBarModal"].forEach((id) => {
          document.getElementById(id)?.setAttribute("data-theme", theme);
        });
      }
    } catch {}
  }, [theme]);
  const toggleTheme = useCallback(() => setTheme((t) => (t === "dark" ? "light" : "dark")), []);

  // Configuração: força de trabalho prevista por departamento
  const [forcaPrevistaDeptoMap, setForcaPrevistaDeptoMap] = useState(() => {
    try {
      const raw = localStorage.getItem("mp_forca_prevista_depto");
      const parsed = raw ? JSON.parse(raw) : null;
      if (parsed && typeof parsed === "object") return normalizeForcaPrevistaDeptoMap(parsed);
    } catch {}
    return {};
  });
  useEffect(() => {
    try {
      localStorage.setItem("mp_forca_prevista_depto", JSON.stringify(forcaPrevistaDeptoMap || {}));
    } catch {}
  }, [forcaPrevistaDeptoMap]);
  // Migração: descarta a antiga config global (se existir)
  useEffect(() => {
    try {
      localStorage.removeItem("mp_forca_prevista");
    } catch {}
  }, []);

  // Importar XLSX a partir do modal de Configurações (header)
  const [importBusy, setImportBusy] = useState(false);
  const emptyXlsxFileRef = useRef(null);
  const emptyCctFileRef = useRef(null);
  const [emptyCctBusy, setEmptyCctBusy] = useState(false);
  const handleImportXlsx = useCallback(
    async (file) => {
      if (!file) return;
      const name = String(file?.name || "");
      const lower = name.toLowerCase();
      if (!lower.endsWith(".xlsx") && !lower.endsWith(".xls")) {
        try {
          Toast && Toast.show && Toast.show("Selecione um arquivo .xlsx ou .xls", "w");
        } catch {}
        return;
      }
      setImportBusy(true);
      try {
        try {
          Toast && Toast.show && Toast.show("Importando planilha…", "i", 1800);
        } catch {}
        const res = await importPosicaoXlsxFile(file, {
          fallbackCategory: "presentes",
          targetDate:
            normDateKey(presentesDate) || new Date().toISOString().slice(0, 10),
        });
        if (!res) return;

        const applyOverridesToDia = async (store, refDate, histRowsForResolve = null) => {
          const ref = normDateKey(refDate) || refDate;
          if (!ref || !store) return;
          const norm = await persistImportOverrides(store);
          setImportOverridesState(norm);
          setPresentesDate(ref);
          const histForResolve =
            histRowsForResolve ?? (Array.isArray(histTableImport) ? histTableImport : null);
          queryClient.setQueryData(POSICAO_KEYS.dia(ref), () =>
            resolveDiaPayload({
              apiData: null,
              histRows: histForResolve,
              importOverrides: norm,
              date: ref,
            }),
          );
          setImportVersion((v) => v + 1);
        };

        const persistHistRows = async (next) => {
          setHistTableImport(next);
          const saved = await saveHistTableImport(next);
          if (!saved.ok) {
            try {
              Toast?.show?.(
                "Dados em memória — não coube no navegador. Exporte backup JSON ou use sempre a mesma URL.",
                "w",
                6000,
              );
            } catch {}
          }
          return saved;
        };

        // Formato tabela histórica (totais por dia)
        if (res.isTabelaFormat) {
          const mergedTabela = mergeHistTableRows(histTableImport, res.tabelaRows);
          await persistHistRows(mergedTabela);
          const bestDate = pickDefaultHistDate(
            mergedTabela,
            normDateKey(res.dataRefFinal) || presentesDate,
          );
          const histRow = getHistRowForDate(mergedTabela, bestDate);
          if (histRow) {
            const store = mergeImportFromHistRow(importOverrides, histRow, bestDate);
            await applyOverridesToDia(store, bestDate, mergedTabela);
          } else if (bestDate) {
            setPresentesDate(bestDate);
          }
          try {
            Toast &&
              Toast.show &&
              Toast.show(
                histRow
                  ? `Tabela importada (${res.tabelaRows.length} dia(s)) — posição do dia atualizada`
                  : `Tabela histórica importada: ${res.tabelaRows.length} dia(s) (somente totais)`,
                "s",
              );
          } catch {}
          return;
        }

        // Formato lista de colaboradores (categoria pelo arquivo / aba / status)
        const { byCat, dataRefFinal } = res;
        const cats = Object.keys(byCat).filter((k) => POSICAO_CATEGORIES.includes(k));
        if (!cats.length) {
          try {
            Toast &&
              Toast.show &&
              Toast.show(
                "Nenhum dado reconhecido — use colunas Matrícula e Nome (ou aba de eventos)",
                "w",
              );
          } catch {}
          return;
        }

        const refDate = normDateKey(dataRefFinal) || dataRefFinal;
        const store = mergeImportFromByCat(importOverrides, byCat, refDate);
        const firstCat = cats[0];
        setActiveCat(firstCat);

        let nextHist = Array.isArray(histTableImport) ? histTableImport : [];
        if (Array.isArray(res.tabelaRows) && res.tabelaRows.length > 0) {
          nextHist = mergeHistTableRows(nextHist, res.tabelaRows);
        } else {
          const patch = { date: refDate, data_referencia: refDate };
          cats.forEach((cat) => {
            const colabs = byCat[cat];
            if (colabs?.length) {
              patch[cat] = { total: colabs.length, colaboradores: colabs };
            }
          });
          if (cats.length > 1) {
            const empRows = employeesFromDayPayload(
              Object.fromEntries(cats.map((c) => [c, { colaboradores: byCat[c] || [] }])),
            );
            if (empRows.length) patch._employees = empRows;
          }
          const idx = nextHist.findIndex(
            (r) => normDateKey(r.date || r.data_referencia || r.data) === refDate,
          );
          nextHist =
            idx >= 0
              ? nextHist.map((r, i) => (i === idx ? mergeHistDayRow(r, patch) : r))
              : [...nextHist, mergeHistDayRow(null, patch)].sort((a, b) =>
                  String(a.date || "").localeCompare(String(b.date || "")),
                );
        }
        await persistHistRows(nextHist);
        await applyOverridesToDia(store, refDate, nextHist);

        const totalLinhas = cats.reduce((s, c) => s + byCat[c].length, 0);
        const catLabel =
          cats.length > 1 ? `${cats.length} categorias (${cats.join(", ")})` : `"${firstCat}"`;
        try {
          Toast && Toast.show && Toast.show(`Importadas ${totalLinhas} linhas em ${catLabel}`, "s");
        } catch {}
      } catch (e) {
        console.error("[ImportXlsx] failed", e);
        const msg = e && e.message ? String(e.message) : "";
        try {
          Toast &&
            Toast.show &&
            Toast.show(`Falha ao importar XLSX${msg ? `: ${msg}` : ""}`, "e", 4500);
        } catch {}
      } finally {
        setImportBusy(false);
      }
    },
    [importOverrides, histTableImport, presentesDate, queryClient],
  );

  const handleClearImport = useCallback(() => {
    try {
      localStorage.removeItem(POSICAO_IMPORT_OVERRIDES_KEY);
    } catch {}
    void removePosicaoStoredValue(POSICAO_IMPORT_OVERRIDES_KEY);
    setImportOverridesState({ v: 2, byDate: {} });
    // Invalida o cache do dia para voltar aos dados da API; historico é recomputado pelo memo `hist`.
    queryClient.invalidateQueries({ queryKey: ["posicao", "dia"] });
    setImportVersion((v) => v + 1);
    try {
      Toast && Toast.show && Toast.show("Dados importados removidos", "s");
    } catch {}
  }, [queryClient]);

  const handleImportTabela = useCallback(async (rows) => {
    setHistTableImport(rows);
    const { ok, lsOk, split, eventCount } = await saveHistTableImport(rows);
    try {
      if (!ok) {
        Toast?.show?.(
          "Importação em memória apenas: não coube no navegador. Exporte um backup JSON.",
          "w",
        );
        return;
      }
      const ev = eventCount ?? rows.reduce((s, r) => s + (r._events?.length || 0), 0);
      const hint = split
        ? " (gravado em 2 partes no IndexedDB)"
        : lsOk
          ? ""
          : " (IndexedDB — use sempre a mesma URL/porta)";
      Toast?.show?.(
        `Salvo: ${ev.toLocaleString("pt-BR")} eventos em ${rows.length} dia${rows.length !== 1 ? "s" : ""}${hint}`,
        "s",
      );
    } catch {}
  }, []);

  const handleClearTabelaImport = useCallback(() => {
    setHistTableImport(null);
    void removeHistTableImport();
    try {
      Toast && Toast.show && Toast.show("Dados da tabela removidos", "i");
    } catch {}
  }, []);

  const handleExportPosicaoBackup = useCallback(async () => {
    try {
      const { days } = await exportPosicaoBackup();
      Toast?.show?.(
        days > 0
          ? `Backup exportado (${days} dia${days !== 1 ? "s" : ""} na tabela)`
          : "Backup exportado (overrides / preferências)",
        "s",
      );
    } catch {
      Toast?.show?.("Falha ao exportar backup", "e");
    }
  }, []);

  const handleImportPosicaoBackup = useCallback(
    async (file) => {
      try {
        const res = await importPosicaoBackupFile(file);
        if (res.histTable?.length) {
          setHistTableImport(res.histTable);
          await saveHistTableImport(res.histTable);
        }
        if (res.overrides) {
          const norm = await persistImportOverrides(normalizeOverridesStore(res.overrides));
          setImportOverridesState(norm);
          setImportVersion((v) => v + 1);
        }
        Toast?.show?.(
          `Backup restaurado${res.days ? `: ${res.days} dia${res.days !== 1 ? "s" : ""}` : ""}`,
          "s",
        );
      } catch (err) {
        Toast?.show?.(err?.message || "Falha ao importar backup", "e");
      }
    },
    [],
  );

  const filialOptions = useMemo(() => {
    const set = new Set();
    if (dia) {
      POSICAO_CATEGORIES.forEach((k) => {
        const arr = Array.isArray(dia?.[k]?.colaboradores) ? dia[k].colaboradores : [];
        arr.forEach((c) => {
          const v = (c?.filial || "").trim();
          if (v) set.add(v);
        });
      });
    }
    if (Array.isArray(histTableImport)) {
      histTableImport.forEach((row) => {
        (row._employees || []).forEach((emp) => {
          const v = (emp.filial || "").trim();
          if (v) set.add(v);
        });
      });
    }
    return Array.from(set).sort((a, b) => a.localeCompare(b, "pt-BR"));
  }, [dia, histTableImport]);

  const deptoOptions = useMemo(() => {
    const set = new Set();
    if (dia) {
      POSICAO_CATEGORIES.forEach((k) => {
        const arr = Array.isArray(dia?.[k]?.colaboradores) ? dia[k].colaboradores : [];
        arr.forEach((c) => {
          const v = (c?.depto_desc || c?.depto || "").toString().trim();
          if (v) set.add(v);
        });
      });
    }
    if (Array.isArray(histTableImport)) {
      histTableImport.forEach((row) => {
        (row._employees || []).forEach((emp) => {
          const v = (emp.depto || "").trim();
          if (v) set.add(v);
        });
      });
    }
    return Array.from(set).sort((a, b) => a.localeCompare(b, "pt-BR"));
  }, [dia, histTableImport]);

  // Reseta filtro de depto se a filial muda e o depto não existe mais
  useEffect(() => {
    if (deptoFilter && !deptoOptions.includes(deptoFilter)) setDeptoFilter("");
  }, [deptoOptions, deptoFilter]);
  useEffect(() => {
    if (filialFilter && !filialOptions.includes(filialFilter)) setFilialFilter("");
  }, [filialOptions, filialFilter]);

  const matchesFilters = useCallback(
    (c) => {
      if (filialFilter) {
        if ((c?.filial || "").trim() !== filialFilter) return false;
      }
      if (deptoFilter) {
        const d = (c?.depto_desc || c?.depto || "").toString().trim();
        if (d !== deptoFilter) return false;
      }
      return true;
    },
    [filialFilter, deptoFilter],
  );

  const filteredDia = useMemo(() => {
    if (!dia) return dia;
    if (!filialFilter && !deptoFilter) return dia;
    const next = { ...dia };
    POSICAO_CATEGORIES.forEach((k) => {
      const arr = Array.isArray(dia?.[k]?.colaboradores) ? dia[k].colaboradores : [];
      const filtered = arr.filter(matchesFilters);
      next[k] = { ...(dia[k] || {}), total: filtered.length, colaboradores: filtered };
    });
    return next;
  }, [dia, filialFilter, deptoFilter, matchesFilters]);

  const getDiaTotal = useCallback(
    (key) => {
      const k = String(key || "");
      if (k === "turnover_desligados") return 0;
      if (k === "turnover_admitidos") return 0;
      const colabs = getColaboradoresFromGroup(filteredDia?.[k]);
      if (colabs.length) return colabs.length;
      const histRow = getHistRowForDate(histTableImport, presentesDate);
      if (histRow) {
        const fromHist = colaboradoresFromHistForCat(histRow, k);
        if (fromHist.length) return fromHist.length;
      }
      const tot = filteredDia?.[k]?.total;
      if (typeof tot === "number" && !Number.isNaN(tot) && k !== "atraso") return tot;
      return 0;
    },
    [filteredDia, histTableImport, presentesDate],
  );

  const posListHdm = useMemo(() => {
    if (
      String(posListKey || "") === "turnover_desligados" ||
      String(posListKey || "") === "turnover_admitidos"
    ) {
      return { events: [], employees: [], eventsDateFrom: "", eventsDateTo: "", label: "", initialPillFilter: null };
    }
    if (String(posListKey || "") === "banco_horas" && Array.isArray(posListOverrideEvents)) {
      return {
        events: posListOverrideEvents,
        employees: [],
        eventsDateFrom: posListDateFrom || presentesDate || "",
        eventsDateTo: posListDateTo || posListDateFrom || presentesDate || "",
        label: posListDateFrom
          ? new Date(`${posListDateFrom}T12:00:00`).toLocaleDateString("pt-BR", {
              weekday: "short",
              day: "2-digit",
              month: "2-digit",
              year: "2-digit",
            })
          : "Período",
        initialPillFilter: null,
        isEventsMode: true,
      };
    }
    return buildPosListModalData({
      histRows: Array.isArray(hist) && hist.length ? hist : histTableImport,
      dia: filteredDia,
      dateIso: presentesDate,
      dateFrom: posListDateFrom || presentesDate,
      dateTo: posListDateTo || posListDateFrom || presentesDate,
      posListKey,
      filialFilter: posListFilialFilter,
      deptoFilter: posListDeptoFilter,
      eventCategories: loadEventCategories(),
    });
  }, [
    filteredDia,
    hist,
    histTableImport,
    presentesDate,
    posListDateFrom,
    posListDateTo,
    posListKey,
    posListFilialFilter,
    posListDeptoFilter,
    posListOverrideEvents,
  ]);

  const posListTitle = useMemo(() => {
    const labels = {
      presentes: "Presentes",
      falta: "Faltas",
      atraso: "Atrasos",
      folga: "Folgas",
      ferias: "Férias",
      afastados: "Afastados",
      ja_saiu: "Já saíram",
      entrada_prev: "Entrada Prevista",
      nao_controla: "Não Controla",
      turnover_desligados: "Turnover · Desligados",
      turnover_admitidos: "Turnover · Admitidos",
      abonos_pendentes: "Abonos pendentes",
      abonos_efetuados: "Abonos efetuados",
      banco_horas: "Banco de Horas",
      mensal_event: "Mensal",
    };
    const baseLbl = labels[posListKey] || posListKey;
    if (String(posListKey || "") === "mensal_event") {
      const event = posListInitialSearch ? ` · ${posListInitialSearch}` : "";
      return `${baseLbl}${event} (${(posListHdm.events || []).length.toLocaleString("pt-BR")})`;
    }
    if (String(posListKey || "") === "abonos_pendentes" || String(posListKey || "") === "abonos_efetuados") {
      const dept = posListDeptoFilter ? ` · ${posListDeptoFilter}` : "";
      return `${baseLbl}${dept} (${(posListHdm.events || []).length.toLocaleString("pt-BR")})`;
    }
    if (String(posListKey || "") === "banco_horas") {
      const dept = posListDeptoFilter ? ` · ${posListDeptoFilter}` : "";
      return `${baseLbl}${dept} (${(posListHdm.events || []).length.toLocaleString("pt-BR")})`;
    }
    const lbl =
      String(posListKey || "") === "turnover_admitidos" && turnoverModalLabel
        ? `Turnover · ${turnoverModalLabel}`
        : baseLbl;
    const tot = getDiaTotal(posListKey);
    return `${lbl} (${tot})`;
  }, [getDiaTotal, posListHdm.events, posListKey, posListDeptoFilter, posListInitialSearch, turnoverModalLabel]);

  const posListCategories = useMemo(() => {
    const labels = {
      presentes: "Presentes",
      falta: "Faltas",
      atraso: "Atrasos",
      folga: "Folgas",
      ferias: "Férias",
      ja_saiu: "Já saíram",
      entrada_prev: "Entrada Prevista",
      nao_controla: "Não Controla Ponto",
      afastados: "Afastados",
      turnover_desligados: "Turnover · Desligados",
      turnover_admitidos: "Turnover · Admitidos",
      abonos_pendentes: "Abonos pendentes",
      abonos_efetuados: "Abonos efetuados",
      banco_horas: "Banco de Horas",
      mensal_event: "Mensal",
    };
    if (String(posListKey || "") === "mensal_event") {
      return [
        {
          key: "mensal_event",
          label: labels.mensal_event,
          total: (posListHdm.events || []).length,
        },
      ];
    }
    if (String(posListKey || "") === "abonos_pendentes" || String(posListKey || "") === "abonos_efetuados") {
      return [
        {
          key: posListKey,
          label: labels[posListKey] || posListKey,
          total: (posListHdm.events || []).length,
        },
      ];
    }
    if (String(posListKey || "") === "banco_horas") {
      return [
        {
          key: "banco_horas",
          label: labels.banco_horas,
          total: (posListHdm.events || []).length,
        },
      ];
    }
    if (String(posListKey || "") === "turnover_desligados") {
      return [
        {
          key: "turnover_desligados",
          label: labels.turnover_desligados,
          total: getDiaTotal("turnover_desligados"),
        },
      ];
    }
    if (String(posListKey || "") === "turnover_admitidos") {
      const lbl = turnoverModalLabel
        ? `Turnover · ${turnoverModalLabel}`
        : labels.turnover_admitidos;
      return [{ key: "turnover_admitidos", label: lbl, total: getDiaTotal("turnover_admitidos") }];
    }
    const order = [
      "presentes",
      "falta",
      "atraso",
      "folga",
      "ferias",
      "ja_saiu",
      "entrada_prev",
      "nao_controla",
      "afastados",
    ];
    return order.map((k) => ({ key: k, label: labels[k] || k, total: getDiaTotal(k) }));
  }, [getDiaTotal, posListHdm.events, posListKey, turnoverModalLabel]);

  useEffect(() => {
    if (!posListModalOpen) return;
    try {
      const t = document.getElementById("posListTitle");
      if (t) {
        t.textContent = "";
        t.style.display = "none";
      }
      const s = document.getElementById("posListSub");
      if (s) {
        s.textContent = "";
        s.style.display = "none";
      }

      const d = document.getElementById("posListHdrDate");
      if (d) {
        d.textContent = "";
        d.style.display = "none";
      }

      const u = document.getElementById("posListHdrUpd");
      if (u) {
        const upd =
          lastUpdText && lastUpdText !== "--:--" ? String(lastUpdText).toLowerCase() : "";
        if (String(posListKey || "") === "banco_horas") {
          const n = Number(posListEmbeddedCount) || 0;
          u.textContent = upd
            ? `${n.toLocaleString("pt-BR")} colaboradores · atualizado ${upd}`
            : `${n.toLocaleString("pt-BR")} colaboradores`;
          u.style.display = "";
        } else if (
          String(posListKey || "") === "abonos_pendentes" ||
          String(posListKey || "") === "abonos_efetuados"
        ) {
          const n = Number(posListEmbeddedCount) || 0;
          u.textContent = upd
            ? `${n.toLocaleString("pt-BR")} ocorrências · atualizado ${upd}`
            : `${n.toLocaleString("pt-BR")} ocorrências`;
          u.style.display = "";
        } else {
          u.textContent = upd ? `atualizado ${upd}` : "";
          u.style.display = upd ? "" : "none";
        }
      }
    } catch {}
  }, [posListModalOpen, posListKey, posListEmbeddedCount, posListTitle, lastUpdText, dia]);

  useEffect(() => {
    if (typeof document === "undefined") return;
    const win = document.getElementById("posListModal");
    if (!win) return;

    if (!posListDefaultRectRef.current) {
      posListDefaultRectRef.current = {
        left: win.style.left,
        top: win.style.top,
        width: win.style.width,
        height: win.style.height,
      };
    }

    const apply = () => {
      try {
        if (posListExpanded) {
          win.setAttribute("data-expanded", "1");
          win.style.left = "10px";
          win.style.top = "10px";
          win.style.width = `${Math.max(900, window.innerWidth - 20)}px`;
          win.style.height = `${Math.max(520, window.innerHeight - 20)}px`;
        } else {
          win.setAttribute("data-expanded", "0");
          const d = posListDefaultRectRef.current;
          if (d) {
            win.style.left = d.left;
            win.style.top = d.top;
            win.style.width = d.width;
            win.style.height = d.height;
          }
        }
      } catch {
        // ignore
      }
    };

    if (posListModalOpen) apply();
    const onResize = () => {
      if (!posListExpanded) return;
      apply();
    };
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, [posListExpanded, posListModalOpen]);

  useEffect(() => {
    if (!posListModalOpen) return;
    if (typeof document === "undefined") return;
    const btn = document.getElementById("posListExpandBtn");
    if (!btn) return;

    const syncIcon = () => {
      try {
        btn.textContent = posListExpanded ? "⤡" : "⤢";
      } catch {}
    };

    const onClick = (ev) => {
      try {
        ev.preventDefault();
        ev.stopPropagation();
      } catch {}
      setPosListExpanded((v) => !v);
    };

    syncIcon();
    btn.addEventListener("click", onClick);
    return () => btn.removeEventListener("click", onClick);
  }, [posListModalOpen, posListExpanded]);

  useEffect(() => {
    const el = virtOuterRef.current;
    if (!el) return;

    const onScroll = () => setScrollTop(el.scrollTop || 0);
    el.addEventListener("scroll", onScroll, { passive: true });

    const ro = new ResizeObserver(() => {
      setOuterH(el.clientHeight || 420);
    });
    ro.observe(el);

    setOuterH(el.clientHeight || 420);

    return () => {
      el.removeEventListener("scroll", onScroll);
      ro.disconnect();
    };
  }, []);

  useEffect(() => {
    // Desenha gráfico simples no histórico quando houver dados
    const canvas = histCanvasRef.current;
    if (!canvas) return;

    const Chart = window.Chart;
    if (!Chart) return;

    if (!hist || !Array.isArray(hist) || hist.length === 0) return;

    const labels = hist.map((r) => (r.date || r.data_referencia || "").slice(5));
    const faltas = hist.map((r) => r.faltas ?? r.falta ?? 0);
    const atrasos = hist.map((r) => r.atrasos ?? r.atraso ?? 0);
    const abs = hist.map((r) => r.abs_rate ?? 0);
    const prevAbs = comparePrev ? [null, ...abs.slice(0, -1)] : [];

    if (chartRef.current) {
      chartRef.current.destroy();
      chartRef.current = null;
    }

    const ds = [];
    ds.push({
      key: "abs",
      label: "Abs %",
      data: abs,
      borderColor: "#3b82f6",
      backgroundColor: "rgba(59,130,246,.12)",
      pointRadius: 0,
      tension: 0.25,
      yAxisID: "y",
      hidden: !histSeries.abs,
    });

    ds.push({
      key: "faltas",
      label: "Faltas",
      data: faltas,
      borderColor: "#ef4444",
      backgroundColor: "rgba(239,68,68,.10)",
      pointRadius: 0,
      tension: 0.25,
      yAxisID: "y1",
      hidden: !histSeries.faltas,
    });

    ds.push({
      key: "atrasos",
      label: "Atrasos",
      data: atrasos,
      borderColor: "#f59e0b",
      backgroundColor: "rgba(245,158,11,.10)",
      pointRadius: 0,
      tension: 0.25,
      yAxisID: "y1",
      hidden: !histSeries.atrasos,
    });

    if (comparePrev) {
      ds.push({
        key: "prev",
        label: "Abs % (anterior)",
        data: prevAbs,
        borderColor: "rgba(59,130,246,.55)",
        borderDash: [6, 5],
        pointRadius: 0,
        tension: 0.25,
        yAxisID: "y",
        hidden: !histSeries.prev,
      });
    }

    const isDark = theme === "dark";
    const tText = isDark ? "#cbd5e1" : "#64748b";
    const tGrid = isDark ? "rgba(148,163,184,.22)" : "rgba(148,163,184,.18)";
    chartRef.current = new Chart(canvas, {
      type: "line",
      data: {
        labels,
        datasets: ds,
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { display: false },
          tooltip: {
            titleColor: tText,
            bodyColor: tText,
            backgroundColor: isDark ? "rgba(15,23,42,.95)" : "rgba(255,255,255,.95)",
            borderColor: tGrid,
            borderWidth: 1,
          },
        },
        scales: {
          x: { ticks: { color: tText, maxTicksLimit: 10 }, grid: { color: tGrid } },
          y: {
            beginAtZero: true,
            position: "left",
            ticks: { color: tText, callback: (v) => `${v}%` },
            grid: { color: tGrid },
          },
          y1: {
            beginAtZero: true,
            position: "right",
            ticks: { color: tText },
            grid: { drawOnChartArea: false },
          },
        },
      },
    });
  }, [
    hist,
    comparePrev,
    histSeries.abs,
    histSeries.faltas,
    histSeries.atrasos,
    histSeries.prev,
    theme,
  ]);

  useEffect(() => {
    // Limpa Chart quando troca para tabela (evita consumir CPU desnecessariamente)
    if (histView !== "chart") {
      if (chartRef.current) {
        chartRef.current.destroy();
        chartRef.current = null;
      }
    }
  }, [histView]);

  useEffect(() => {
    // Gráfico de barras (modal)
    const canvas = typeof document !== "undefined" ? document.getElementById("pos_barChart") : null;
    if (!canvas) return;
    const Chart = window.Chart;
    if (!Chart) return;
    if (!barModalOpen) return;
    if (!dia) return;

    const src = filteredDia || dia;
    const items = [
      { key: "presentes", label: "Presentes", color: "#10b981", val: src?.presentes?.total ?? 0 },
      { key: "falta", label: "Faltas", color: "#ef4444", val: src?.falta?.total ?? 0 },
      { key: "atraso", label: "Atrasos", color: "#f59e0b", val: src?.atraso?.total ?? 0 },
      { key: "folga", label: "Folga", color: "#06b6d4", val: src?.folga?.total ?? 0 },
      { key: "ferias", label: "Férias", color: "#8b5cf6", val: src?.ferias?.total ?? 0 },
      { key: "afastados", label: "Afastados", color: "#6366f1", val: src?.afastados?.total ?? 0 },
    ];

    if (barChartRef.current) {
      barChartRef.current.destroy();
      barChartRef.current = null;
    }

    barChartRef.current = new Chart(canvas, {
      type: "bar",
      data: {
        labels: items.map((x) => x.label),
        datasets: [
          {
            label: "Total",
            data: items.map((x) => x.val),
            backgroundColor: items.map((x) => `${x.color}33`),
            borderColor: items.map((x) => x.color),
            borderWidth: 1,
          },
        ],
      },
      plugins: [
        {
          id: "valueLabels",
          afterDatasetsDraw(chart) {
            try {
              const { ctx } = chart;
              const meta = chart.getDatasetMeta(0);
              if (!meta || !meta.data) return;
              ctx.save();
              ctx.textAlign = "center";
              ctx.textBaseline = "bottom";
              ctx.fillStyle = theme === "dark" ? "#e2e8f0" : "#0f172a";
              ctx.font = "700 11px system-ui, -apple-system, Segoe UI, Roboto, Arial";
              meta.data.forEach((bar, i) => {
                const v = chart.data?.datasets?.[0]?.data?.[i];
                const txt = v == null ? "" : String(v);
                if (!txt) return;
                const x = bar.x;
                const y = bar.y;
                ctx.fillText(txt, x, y - 4);
              });
              ctx.restore();
            } catch {
              // ignore
            }
          },
        },
      ],
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { display: false },
          tooltip: {
            titleColor: theme === "dark" ? "#cbd5e1" : "#64748b",
            bodyColor: theme === "dark" ? "#cbd5e1" : "#64748b",
            backgroundColor: theme === "dark" ? "rgba(15,23,42,.95)" : "rgba(255,255,255,.95)",
            borderColor: theme === "dark" ? "rgba(148,163,184,.22)" : "rgba(148,163,184,.18)",
            borderWidth: 1,
          },
        },
        scales: {
          x: {
            ticks: { color: theme === "dark" ? "#cbd5e1" : "#64748b" },
            grid: { color: theme === "dark" ? "rgba(148,163,184,.22)" : "rgba(148,163,184,.18)" },
          },
          y: {
            beginAtZero: true,
            ticks: { color: theme === "dark" ? "#cbd5e1" : "#64748b" },
            grid: { color: theme === "dark" ? "rgba(148,163,184,.22)" : "rgba(148,163,184,.18)" },
          },
        },
      },
    });

    return () => {
      if (barChartRef.current) {
        barChartRef.current.destroy();
        barChartRef.current = null;
      }
    };
  }, [barModalOpen, dia, filteredDia, theme]);

  useEffect(() => {
    // Mantém estado React em sync com o botão X do WM (data-wm-cls)
    if (typeof document === "undefined") return;
    const btn = document.querySelector('[data-wm-cls="posBarModal"]');
    if (!btn) return;
    const onClick = () => setBarModalOpen(false);
    btn.addEventListener("click", onClick);
    return () => btn.removeEventListener("click", onClick);
  }, []);

  useEffect(() => {
    const win = typeof document !== "undefined" ? document.getElementById("posBarModal") : null;
    if (!win) return;
    win.classList.toggle("open", !!barModalOpen);
    if (barModalOpen) {
      win.classList.remove("minimized");
      try {
        win.classList.add("focused");
        const els = Array.from(document.querySelectorAll(".fm, .wm-window"));
        let maxZ = 600;
        for (const el of els) {
          if (el === win) continue;
          const z = parseInt(String(window.getComputedStyle(el).zIndex || ""), 10);
          if (!Number.isNaN(z)) maxZ = Math.max(maxZ, z);
        }
        win.style.zIndex = String(maxZ + 1);
      } catch {}
    }
  }, [barModalOpen]);

  useEffect(() => {
    const win = typeof document !== "undefined" ? document.getElementById("deptModal") : null;
    if (!win) return;
    win.classList.toggle("open", !!deptModalOpen);
    if (deptModalOpen) {
      win.classList.remove("minimized");
    }
  }, [deptModalOpen]);

  useEffect(() => {
    const win = typeof document !== "undefined" ? document.getElementById("posListModal") : null;
    if (!win) return;
    win.classList.toggle("open", !!posListModalOpen);
    if (posListModalOpen) {
      win.classList.remove("minimized");
    }
  }, [posListModalOpen]);

  useEffect(() => {
    // Atualiza textos do modal de deptos e meta do gráfico de barras
    const deptSub = typeof document !== "undefined" ? document.getElementById("deptSub") : null;
    if (deptSub) deptSub.textContent = dia?.data_referencia ? `Data ${dia.data_referencia}` : "—";

    const meta =
      typeof document !== "undefined" ? document.getElementById("pos_barModalMeta") : null;
    if (meta) meta.textContent = dia?.data_referencia ? `Data ${dia.data_referencia}` : "—";
  }, [dia]);

  const totals = useMemo(() => {
    if (!dia) return null;
    return {
      presentes: dia?.presentes?.total ?? 0,
      falta: dia?.falta?.total ?? 0,
      atraso: dia?.atraso?.total ?? 0,
    };
  }, [dia]);

  const categories = useMemo(() => {
    if (!dia) return [];
    const order = [
      "presentes",
      "falta",
      "atraso",
      "folga",
      "ferias",
      "afastados",
      "ja_saiu",
      "entrada_prev",
      "nao_controla",
    ];
    const labels = {
      presentes: "Presentes",
      falta: "Faltas",
      atraso: "Atrasos",
      folga: "Folgas",
      ferias: "Férias",
      afastados: "Afastados",
      ja_saiu: "Já saiu",
      entrada_prev: "Entrada Prevista",
      nao_controla: "Não Controla",
    };
    return order
      .filter((k) => !!dia?.[k])
      .map((k) => ({
        key: k,
        label: labels[k] || k,
        total: getDiaTotal(k),
      }));
  }, [dia, getDiaTotal]);

  const activeCatTotal = useMemo(() => {
    if (!dia) return 0;
    return getDiaTotal(activeCat);
  }, [dia, activeCat, getDiaTotal]);

  const baseOperacional = useMemo(() => {
    if (!dia) return 0;
    const p = dia?.presentes?.total ?? 0;
    const f = dia?.falta?.total ?? 0;
    const a = dia?.atraso?.total ?? 0;
    return p + f + a;
  }, [dia]);

  // Estat?sticas por departamento (todas as métricas usadas pelo gráfico/tabela)
  const deptStats = useMemo(() => {
    if (!filteredDia) return [];
    const deptOf = (c) => (c?.depto_desc || c?.depto || "").toString().trim() || "—";
    const cats = [
      "presentes",
      "falta",
      "atraso",
      "folga",
      "ferias",
      "afastados",
      "ja_saiu",
      "entrada_prev",
      "nao_controla",
    ];
    const map = new Map();
    cats.forEach((k) => {
      const arr = getColaboradoresFromGroup(filteredDia?.[k]);
      arr.forEach((c) => {
        const d = deptOf(c);
        const cur = map.get(d) || {
          depto: d,
          presentes: 0,
          falta: 0,
          atraso: 0,
          folga: 0,
          ferias: 0,
          afastados: 0,
          ja_saiu: 0,
          entrada_prev: 0,
          nao_controla: 0,
        };
        cur[k] = (cur[k] || 0) + 1;
        map.set(d, cur);
      });
    });
    const fpd = forcaPrevistaDeptoMap || {};
    return Array.from(map.values()).map((r) => {
      const atual =
        (r.presentes || 0) +
        (r.atraso || 0) +
        (r.ja_saiu || 0) +
        (r.entrada_prev || 0) +
        (r.nao_controla || 0);
      const cadastrada = getForcaPrevistaQty(fpd[r.depto]);
      const prevista_cadastrada = cadastrada != null ? cadastrada : null;
      const prevista = prevista_cadastrada != null ? prevista_cadastrada : atual;
      const vagas = Math.max(0, prevista - atual);
      return { ...r, atual, prevista, prevista_estimada: prevista_cadastrada == null, vagas };
    });
  }, [filteredDia, forcaPrevistaDeptoMap]);

  const bentoMetrics = useMemo(() => {
    const t = (k) => getDiaTotal(k);
    const presentes = t("presentes");
    const faltas = t("falta");
    const atrasos = t("atraso");
    const folgas = t("folga");
    const ferias = t("ferias");
    const afastados = t("afastados");
    const saiu = t("ja_saiu");
    const entrada = t("entrada_prev");
    const semCtrl = t("nao_controla");
    // Força atual = presentes no local + a caminho + já saíram + sem controle + atrasados
    const atual = presentes + atrasos + entrada + saiu + semCtrl;
    // Força prevista = soma do cadastro por depto (com fallback de ativos por depto)
    const prevista = deptStats.reduce((s, r) => s + (r.prevista || 0), 0);
    const vagas = Math.max(0, prevista - atual);

    // últimos 7 dias úteis — presentes (usa dado importado do dia para hoje)
    let trend = [0, 0, 0, 0, 0, 0, 0];
    if (Array.isArray(hist) && hist.length > 0) {
      const last7 = hist
        .slice(-7)
        .map((r) => Math.max(0, Number(r?.total ?? 0) - Number(r?.faltas ?? r?.falta ?? 0)));
      while (last7.length < 7) last7.unshift(0);
      last7[last7.length - 1] = presentes; // substitui hoje pelo dado real importado
      trend = last7;
    }

    // comparação com o dia anterior
    let ontem = null;
    if (Array.isArray(hist) && hist.length >= 2) {
      const y = hist[hist.length - 2];
      ontem = {
        faltas: Number(y?.faltas ?? y?.falta ?? 0),
        atrasos: Number(y?.atrasos ?? y?.atraso ?? 0),
      };
    }

    return {
      prevista: prevista > 0 ? prevista : null,
      atual,
      vagas: prevista > 0 ? vagas : null,
      presentes,
      faltas,
      atrasos,
      folgas,
      ferias,
      afastados,
      saiu,
      entrada,
      semControle: semCtrl,
      trend,
      ontem,
    };
  }, [dia, hist, getDiaTotal, deptStats]);

  const histData = useMemo(() => {
    if (!Array.isArray(hist)) return [];
    const wantFilter = !!(filialFilter || deptoFilter);
    const rows = hist.map((r) => {
      const date = r?.date || r?.data_referencia || r?.data || "";
      const hasDetails = !!(
        (r?.presentes?.colaboradores && Array.isArray(r.presentes.colaboradores)) ||
        (r?.falta?.colaboradores && Array.isArray(r.falta.colaboradores)) ||
        (r?.atraso?.colaboradores && Array.isArray(r.atraso.colaboradores))
      );

      // Import data: filter _employees by filial/depto and recompute aggregates
      if (wantFilter && Array.isArray(r._employees) && r._employees.length > 0 && !hasDetails) {
        const emps = r._employees.filter((emp) => {
          if (filialFilter && (emp.filial || "") !== filialFilter) return false;
          if (deptoFilter && (emp.depto || "") !== deptoFilter) return false;
          return true;
        });
        const hrsPres = emps.reduce((s, e) => s + (e.hrsPres || 0), 0);
        const hrsAuse = emps.reduce((s, e) => s + (e.hrsAuse || 0), 0);
        const hrsJust = emps.reduce((s, e) => s + (e.hrsJust || 0), 0);
        const hrsExtr = emps.reduce((s, e) => s + (e.hrsExtr || 0), 0);
        const hrsPlan = emps.reduce((s, e) => s + (e.hrsPlan || 0), 0);
        const presentes = emps.filter((e) => e.hrsPres > 0).length;
        const faltas = emps.filter((e) => e.hrsAuse > 0).length;
        const justificadas = emps.filter((e) => e.hrsJust > 0).length;
        const extrasCount = emps.filter((e) => e.hrsExtr > 0).length;
        const total = presentes + faltas + justificadas;
        return {
          date,
          presentes,
          faltas,
          atrasos: 0,
          justificadas,
          total,
          abs_rate: total > 0 ? +((faltas / total) * 100).toFixed(2) : 0,
          horas_presentes: hrsPres > 0 ? hrsPres : null,
          horas_planejadas: hrsPlan > 0 ? hrsPlan : null,
          horas_faltas: hrsAuse > 0 ? hrsAuse : null,
          horas_atrasos: null,
          horas_justificadas: hrsJust > 0 ? hrsJust : null,
          extras: extrasCount > 0 ? extrasCount : null,
          horas_extras: hrsExtr > 0 ? hrsExtr : null,
          _employees: emps,
          _events: Array.isArray(r._events)
            ? r._events.filter((ev) => {
                if (filialFilter && (ev.filial || "") !== filialFilter) return false;
                if (deptoFilter && (ev.depto || "") !== deptoFilter) return false;
                return true;
              })
            : null,
        };
      }

      if (wantFilter && hasDetails) {
        const employees = buildEmployeesFromDetailRow(r, matchesFilters);
        const count = (key) => {
          const arr = Array.isArray(r?.[key]?.colaboradores) ? r[key].colaboradores : [];
          return arr.filter(matchesFilters).length;
        };

        const presentes = count("presentes");
        const faltas = count("falta");
        const atrasos = count("atraso");

        const folgas = count("folga");
        const ferias = count("ferias");
        const afastados = count("afastados");
        const saiu = count("ja_saiu");
        const entrada = count("entrada_prev");
        const semControle = count("nao_controla");

        const total =
          presentes + faltas + atrasos + folgas + ferias + afastados + saiu + entrada + semControle;
        const justificadas = Number(
          r?.faltas_justificadas ?? r?.faltasJustificadas ?? r?.justificadas ?? r?.justificada ?? 0,
        );

        return {
          date,
          presentes,
          faltas,
          atrasos,
          justificadas,
          total,
          abs_rate: total > 0 ? +((faltas / total) * 100).toFixed(2) : 0,
          horas_presentes: r?.horas_presentes != null ? Number(r.horas_presentes) : null,
          horas_planejadas: r?.horas_planejadas != null ? Number(r.horas_planejadas) : null,
          horas_faltas: r?.horas_faltas != null ? Number(r.horas_faltas) : null,
          horas_atrasos: r?.horas_atrasos != null ? Number(r.horas_atrasos) : null,
          horas_justificadas: r?.horas_justificadas != null ? Number(r.horas_justificadas) : null,
          extras: r?.extras != null ? Number(r.extras) : null,
          horas_extras: r?.horas_extras != null ? Number(r.horas_extras) : null,
          _employees: employees,
          _events: r?._events ?? null,
        };
      }

      const employees = buildEmployeesFromDetailRow(r);
      return {
        date,
        presentes: Number(r?.presentes ?? r?.presencas ?? r?.["presenças"] ?? 0),
        faltas: Number(r?.faltas ?? r?.falta ?? 0),
        atrasos: Number(r?.atrasos ?? r?.atraso ?? 0),
        justificadas: Number(
          r?.faltas_justificadas ?? r?.faltasJustificadas ?? r?.justificadas ?? r?.justificada ?? 0,
        ),
        total: Number(r?.total ?? 0),
        abs_rate: Number(r?.abs_rate ?? 0),
        horas_presentes: r?.horas_presentes != null ? Number(r.horas_presentes) : null,
        horas_planejadas: r?.horas_planejadas != null ? Number(r.horas_planejadas) : null,
        horas_faltas: r?.horas_faltas != null ? Number(r.horas_faltas) : null,
        horas_atrasos: r?.horas_atrasos != null ? Number(r.horas_atrasos) : null,
        horas_justificadas: r?.horas_justificadas != null ? Number(r.horas_justificadas) : null,
        extras: r?.extras != null ? Number(r.extras) : null,
        horas_extras: r?.horas_extras != null ? Number(r.horas_extras) : null,
        _employees: employees,
        _events: r?._events ?? null,
      };
    });

    return rows.filter((r) => r.date);
  }, [hist, filialFilter, deptoFilter, matchesFilters]);

  const histDeptData = useMemo(() => {
    if (!Array.isArray(hist)) return [];
    return hist
      .map((r) => {
        const date = r?.date || r?.data_referencia || r?.data || "";
        if (Array.isArray(r._employees) && r._employees.length > 0) {
          const emps = r._employees.filter((emp) => {
            if (filialFilter && (emp.filial || "") !== filialFilter) return false;
            return true;
          });
          const hrsPres = emps.reduce((s, e) => s + (e.hrsPres || 0), 0);
          const hrsAuse = emps.reduce((s, e) => s + (e.hrsAuse || 0), 0);
          const hrsJust = emps.reduce((s, e) => s + (e.hrsJust || 0), 0);
          const hrsExtr = emps.reduce((s, e) => s + (e.hrsExtr || 0), 0);
          const hrsPlan = emps.reduce((s, e) => s + (e.hrsPlan || 0), 0);
          const presentes = emps.filter((e) => e.hrsPres > 0).length;
          const faltas = emps.filter((e) => e.hrsAuse > 0).length;
          const justificadas = emps.filter((e) => e.hrsJust > 0).length;
          const extrasCount = emps.filter((e) => e.hrsExtr > 0).length;
          const total = presentes + faltas + justificadas;
          return {
            date,
            presentes,
            faltas,
            atrasos: 0,
            justificadas,
            total,
            abs_rate: total > 0 ? +((faltas / total) * 100).toFixed(2) : 0,
            horas_presentes: hrsPres > 0 ? hrsPres : null,
            horas_planejadas: hrsPlan > 0 ? hrsPlan : null,
            horas_faltas: hrsAuse > 0 ? hrsAuse : null,
            horas_atrasos: null,
            horas_justificadas: hrsJust > 0 ? hrsJust : null,
            extras: extrasCount > 0 ? extrasCount : null,
            horas_extras: hrsExtr > 0 ? hrsExtr : null,
            _employees: emps,
            _events: Array.isArray(r._events)
              ? r._events.filter((ev) => {
                  if (filialFilter && (ev.filial || "") !== filialFilter) return false;
                  return true;
                })
              : null,
          };
        }
        return {
          date,
          presentes: Number(r?.presentes ?? r?.presencas ?? r?.["presenças"] ?? 0),
          faltas: Number(r?.faltas ?? r?.falta ?? 0),
          atrasos: Number(r?.atrasos ?? r?.atraso ?? 0),
          justificadas: Number(
            r?.faltas_justificadas ??
              r?.faltasJustificadas ??
              r?.justificadas ??
              r?.justificada ??
              0,
          ),
          total: Number(r?.total ?? 0),
          abs_rate: Number(r?.abs_rate ?? 0),
          horas_presentes: r?.horas_presentes != null ? Number(r.horas_presentes) : null,
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
  }, [hist, filialFilter]);

  // Presença por departamento (top 7)
  // Fonte: apenas presentes.colaboradores — evita misturar com outras categorias (mock ou API)
  // pres  = quantidade de presentes naquele depto
  // total = total de presentes (global) — barra mostra participação relativa do depto
  // pct   = share do depto no total de presentes (para largura da barra)
  const deptAbsenceList = useMemo(() => {
    let rows = buildAbsenceListRows(filteredDia || dia, "desc");
    if (!rows.length && Array.isArray(deptStats) && deptStats.length > 0) {
      rows = buildAbsenceListRowsFromStats(deptStats, "desc");
    }
    return rows;
  }, [filteredDia, dia, deptStats]);

  const deptRows = useMemo(() => {
    if (!filteredDia) return [];
    const deptOf = (c) => (c?.depto_desc || c?.depto || "").toString().trim() || "—";
    const presentes = getColaboradoresFromGroup(filteredDia?.presentes);

    const counts = new Map(); // dept -> número de presentes
    presentes.forEach((c) => {
      const d = deptOf(c);
      counts.set(d, (counts.get(d) || 0) + 1);
    });

    const totalPresentes = presentes.length;
    const rows = Array.from(counts.entries()).map(([name, pres]) => ({
      name,
      pres,
      total: totalPresentes,
      pct: totalPresentes > 0 ? Math.round((pres / totalPresentes) * 100) : 0,
    }));

    rows.sort((a, b) => b.pres - a.pres); // ordena por maior número de presentes
    return rows.slice(0, 7);
  }, [filteredDia]);

  const cc = (ci) => `var(--c${(ci ?? 0) + 1})`;

  const onHomeOpenKey = (key) => {
    if (!key) return;
    setActiveCat(key);
    setShowHome(false);
    try {
      const el = virtOuterRef.current;
      if (el) el.scrollTop = 0;
    } catch {
      // ignore
    }
  };

  const HomeCard = ({ keyName, label, ci }) => {
    const tot = getDiaTotal(keyName);
    const color = cc(ci);
    const pct = baseOperacional ? Math.round((tot / baseOperacional) * 100) : 0;
    const w = Math.min(100, Math.round((tot / Math.max(1, baseOperacional)) * 100));
    return (
      <div
        data-pos-home-key={keyName}
        onClick={() => openPosListModal(keyName)}
        style={{
          flex: 1,
          minWidth: 160,
          border: `1px solid ${color}`,
          borderRadius: 14,
          padding: "14px 14px 12px 14px",
          background: "rgba(0,0,0,0.02)",
          cursor: "pointer",
          position: "relative",
          overflow: "hidden",
        }}
      >
        <div
          style={{
            fontSize: ".7rem",
            letterSpacing: ".08em",
            fontWeight: 900,
            textTransform: "uppercase",
            color,
          }}
        >
          {label}
        </div>
        <div style={{ marginTop: 2, fontSize: "2.1rem", lineHeight: 1.0, fontWeight: 950, color }}>
          {tot}
        </div>
        {baseOperacional > 0 && (
          <div style={{ marginTop: 2, fontSize: ".68rem", color: "var(--muted)", fontWeight: 700 }}>
            {tot} de {baseOperacional}
          </div>
        )}
        <div
          style={{
            marginTop: 8,
            height: 4,
            borderRadius: 9999,
            background: "rgba(148,163,184,.25)",
            overflow: "hidden",
          }}
        >
          <div
            style={{ height: "100%", width: `${w}%`, background: color, borderRadius: 9999 }}
          ></div>
        </div>
        <div style={{ marginTop: 6, fontSize: ".72rem", color: "var(--muted)", fontWeight: 800 }}>
          {pct}%
        </div>
      </div>
    );
  };

  const HomeChip = ({ keyName, label, ci }) => {
    const tot = getDiaTotal(keyName);
    const color = cc(ci);
    const pct = baseOperacional ? Math.round((tot / baseOperacional) * 100) : 0;
    return (
      <button
        type="button"
        data-pos-home-key={keyName}
        onClick={() => openPosListModal(keyName)}
        style={{
          display: "inline-flex",
          alignItems: "center",
          gap: 8,
          border: `1px solid ${color}`,
          background: "transparent",
          color,
          padding: "6px 10px",
          borderRadius: 9999,
          fontSize: ".75rem",
          fontWeight: 900,
          cursor: "pointer",
        }}
      >
        <span>{label}</span>
        <span
          style={{
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
            minWidth: 26,
            height: 22,
            padding: "0 8px",
            borderRadius: 9999,
            background: `${color}22`,
            border: `1px solid ${color}44`,
            color,
            fontWeight: 950,
          }}
        >
          {tot}
        </span>
        <span
          style={{
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
            minWidth: 38,
            height: 22,
            padding: "0 8px",
            borderRadius: 9999,
            background: "rgba(148,163,184,.14)",
            border: "1px solid var(--border)",
            color: "var(--muted)",
            fontWeight: 950,
          }}
        >
          {pct}%
        </span>
      </button>
    );
  };

  const homeDateText = useMemo(() => {
    const s = dia?.data_referencia;
    if (!s) return "--/--/----";
    const [y, m, d] = s.split("-");
    if (!y || !m || !d) return s;
    return `${d}/${m}/${y}`;
  }, [dia]);

  const bancoHorasHistSource = useMemo(
    () => (Array.isArray(hist) && hist.length ? hist : histTableImport),
    [hist, histTableImport],
  );

  const resolveBancoHorasModalEvents = useCallback(
    (rows = [], kpi = null) => {
      const ref = String(presentesDate || dia?.data_referencia || new Date().toISOString().slice(0, 10));
      const from = periodoApuracao?.de || ref;
      const items =
        Array.isArray(rows) && rows.length
          ? getBancoHorasImportRows({ rows }, bancoHorasHistSource)
          : getBancoHorasImportRows(null, bancoHorasHistSource);
      if (items.length) {
        const filtered = kpi ? filterBancoHorasRowsByKpi(items, kpi) : items;
        const built = buildBancoHorasModalEvents({ items: filtered }, from);
        if (built.length) return built;
      }
      const histRows = bancoHorasHistSource;
      const to = periodoApuracao?.ate || periodoApuracao?.de || ref;
      const categories = loadEventCategories();
      let events = filterEventsForPosListKey(
        flattenHistEvents(histRows, from, to),
        "banco_horas",
        categories,
      );
      if (kpi) events = filterBancoHorasEventsByKpi(events, kpi);
      return events;
    },
    [bancoHorasHistSource, dia?.data_referencia, periodoApuracao, presentesDate],
  );

  const openBancoHorasModalWithRows = useCallback(
    (rows, { filterLabel = "", kpi = null } = {}) => {
      const ref = String(presentesDate || dia?.data_referencia || new Date().toISOString().slice(0, 10));
      const overrideEvents = resolveBancoHorasModalEvents(rows, kpi);
      const dates = resolvePosListModalDates(ref);
      resetPosEmbeddedBucketSearch("banco_horas");
      setPosListEmbeddedSession((n) => n + 1);
      setPosListKey("banco_horas");
      setPosListOverrideEvents(overrideEvents);
      setPosListInitialSearch("");
      setPosListDateFrom(dates.from);
      setPosListDateTo(dates.to || dates.from);
      setPosListFilialFilter("");
      setPosListDeptoFilter(filterLabel);
      setPosListModalOpen(true);
    },
    [dia?.data_referencia, presentesDate, resolveBancoHorasModalEvents, resolvePosListModalDates],
  );

  const openBancoHorasDeptColaboradores = useCallback(
    (depto) => {
      const deptName = String(depto?.label || depto?.departamento || depto || "").trim();
      let items = Array.isArray(depto?.items) ? depto.items : [];
      if (!items.length && deptName) {
        items = getBancoHorasImportRows(null, bancoHorasHistSource).filter((row) => {
          const rowDept = row?.departamento || row?.departamentoNome || row?.depto || row?.depto_desc || "";
          return bancoHorasDeptKey(rowDept) === bancoHorasDeptKey(deptName);
        });
      }
      openBancoHorasModalWithRows(items, { filterLabel: deptName });
    },
    [bancoHorasHistSource, openBancoHorasModalWithRows],
  );

  const openBancoHorasKpiColaboradores = useCallback(
    (kpi) => {
      const importRows = getBancoHorasImportRows(null, bancoHorasHistSource);
      const filterLabel = kpi === "saldo_proximo" ? "" : BANCO_HORAS_KPI_LABELS[kpi] || "";
      openBancoHorasModalWithRows(importRows, { filterLabel, kpi });
    },
    [bancoHorasHistSource, openBancoHorasModalWithRows],
  );

  const clearBancoHorasDeptFilter = useCallback(() => {
    openBancoHorasModalWithRows(getBancoHorasImportRows(null, bancoHorasHistSource), {
      filterLabel: "",
      kpi: null,
    });
  }, [bancoHorasHistSource, openBancoHorasModalWithRows]);

  // Catálogo de métricas suportadas no gráfico/tabela por departamento
  const DEPT_METRIC_META = useMemo(
    () => ({
      prevista: { key: "prevista", label: "Força Prevista", color: "#14b8a6" },
      atual: { key: "atual", label: "Força Atual", color: "#2563eb" },
      vagas: { key: "vagas", label: "Vagas", color: "#f97316" },
      presentes: { key: "presentes", label: "Presentes", color: "#10b981" },
      falta: { key: "falta", label: "Faltas", color: "#ef4444" },
      atraso: { key: "atraso", label: "Atrasos", color: "#f59e0b" },
      folga: { key: "folga", label: "Folgas", color: "#06b6d4" },
      ferias: { key: "ferias", label: "Férias", color: "#8b5cf6" },
      afastados: { key: "afastados", label: "Afastados", color: "#6366f1" },
      entrada_prev: { key: "entrada_prev", label: "Entrada Prevista", color: "#a855f7" },
      ja_saiu: { key: "ja_saiu", label: "Já saíram", color: "#0ea5e9" },
    }),
    [],
  );
  const DEPT_METRIC_ORDER = useMemo(
    () => [
      "prevista",
      "atual",
      "vagas",
      "presentes",
      "falta",
      "atraso",
      "folga",
      "ferias",
      "afastados",
      "entrada_prev",
      "ja_saiu",
    ],
    [],
  );

  // Lista total de departamentos dispon?veis para o filtro do gráfico
  const deptChartOptions = useMemo(() => {
    const set = new Set(deptStats.map((r) => r.depto));
    return Array.from(set).sort((a, b) => a.localeCompare(b, "pt-BR"));
  }, [deptStats]);

  // Saneia o filtro caso departamentos deixem de existir (preserva sentinela __none__)
  useEffect(() => {
    if (!deptChartFilter || deptChartFilter.length === 0) return;
    if (deptChartFilter.length === 1 && deptChartFilter[0] === "__none__") return;
    const valid = new Set(deptChartOptions);
    const cleaned = deptChartFilter.filter((d) => valid.has(d));
    if (cleaned.length !== deptChartFilter.length) setDeptChartFilter(cleaned);
  }, [deptChartOptions, deptChartFilter]);

  // Métricas selecionadas válidas (sempre ≥1)
  const selectedMetrics = useMemo(() => {
    const set = new Set((deptMetrics || []).filter((k) => DEPT_METRIC_META[k]));
    if (set.size === 0) set.add("presentes");
    return DEPT_METRIC_ORDER.filter((k) => set.has(k));
  }, [deptMetrics, DEPT_METRIC_META, DEPT_METRIC_ORDER]);

  const toggleDeptMetric = useCallback((key) => {
    setDeptMetrics((prev) => {
      const cur = new Set(prev || []);
      if (cur.has(key)) cur.delete(key);
      else cur.add(key);
      const next = Array.from(cur);
      return next.length === 0 ? ["presentes"] : next;
    });
  }, []);

  // Linhas do gráfico: respeitam filtro de deptos + ordenação pela soma das métricas selecionadas
  const deptosRank = useMemo(() => {
    const arr = deptChartFilter || [];
    const isNone = arr.length === 1 && arr[0] === "__none__";
    if (isNone) return [];
    const filterSet = new Set(arr);
    const useFilter = filterSet.size > 0;
    const rows = deptStats.filter((r) => !useFilter || filterSet.has(r.depto));
    const sumOf = (r) => selectedMetrics.reduce((s, k) => s + (Number(r[k]) || 0), 0);
    rows.sort((a, b) => (deptOrder === "asc" ? sumOf(a) - sumOf(b) : sumOf(b) - sumOf(a)));
    return rows.slice(0, 60);
  }, [deptStats, deptChartFilter, selectedMetrics, deptOrder]);

  const deptMetricLbl = useMemo(() => {
    return selectedMetrics.map((k) => DEPT_METRIC_META[k]?.label || k).join(" · ");
  }, [selectedMetrics, DEPT_METRIC_META]);

  useEffect(() => {
    if (!deptModalOpen) return;
    const btnPng = document.getElementById("deptPngBtn");
    const onPng = (e) => {
      e?.preventDefault?.();
      try {
        const c = document.getElementById("deptChartCanvas");
        if (!c || !c.toDataURL) return;
        const url = c.toDataURL("image/png");
        const a = document.createElement("a");
        a.href = url;
        a.download = "deptos.png";
        a.click();
      } catch {}
    };
    if (btnPng) btnPng.addEventListener("click", onPng);
    return () => {
      if (btnPng) btnPng.removeEventListener("click", onPng);
    };
  }, [deptModalOpen]);

  useEffect(() => {
    // Fallback: garante toggle do botão Tabela/Gráfico mesmo se handlers do WM interferirem
    if (!deptModalOpen) return;
    if (typeof document === "undefined") return;
    const toggleIfBtn = (ev) => {
      const t = ev.target;
      if (!t || !t.closest) return;
      const btn = t.closest("#deptTableToggle");
      if (!btn) return;
      ev.preventDefault();
      ev.stopPropagation?.();
      ev.stopImmediatePropagation?.();
      setDeptView((v) => (v === "table" ? "chart" : "table"));
    };
    document.addEventListener("click", toggleIfBtn, true);
    return () => {
      document.removeEventListener("click", toggleIfBtn, true);
    };
  }, [deptModalOpen]);

  useEffect(() => {
    if (!deptModalOpen) return;
    const btnToggle = document.getElementById("deptTableToggle");
    if (!btnToggle) return;
    btnToggle.textContent = deptView === "table" ? "📊 Gráfico" : "📋 Tabela";
  }, [deptModalOpen, deptView]);

  useEffect(() => {
    if (!deptModalOpen) return;
    if (deptView !== "table") return;
    if (typeof document === "undefined") return;
    const wrap = document.getElementById("deptCanvasWrap");
    if (!wrap) return;
    try {
      const canvas = wrap.querySelector("#deptChartCanvas");
      if (canvas) canvas.remove();
      wrap.style.overflow = "auto";
    } catch {
      // ignore
    }
  }, [deptModalOpen, deptView]);

  useEffect(() => {
    // Mantém estado React em sync com o botão X do WM (data-wm-cls)
    if (typeof document === "undefined") return;
    const btn = document.querySelector('[data-wm-cls="deptModal"]');
    if (!btn) return;
    const onClick = () => setDeptModalOpen(false);
    btn.addEventListener("click", onClick);
    return () => btn.removeEventListener("click", onClick);
  }, []);

  // Expand/restore deptModal
  useEffect(() => {
    if (typeof document === "undefined") return;
    const win = document.getElementById("deptModal");
    if (!win) return;
    if (!deptDefaultRectRef.current) {
      deptDefaultRectRef.current = {
        left: win.style.left,
        top: win.style.top,
        width: win.style.width,
        height: win.style.height,
      };
    }
    const apply = () => {
      try {
        if (deptExpanded) {
          win.setAttribute("data-expanded", "1");
          win.style.left = "10px";
          win.style.top = "10px";
          win.style.width = `${Math.max(900, window.innerWidth - 20)}px`;
          win.style.height = `${Math.max(520, window.innerHeight - 20)}px`;
        } else {
          win.setAttribute("data-expanded", "0");
          const d = deptDefaultRectRef.current;
          if (d) {
            win.style.left = d.left;
            win.style.top = d.top;
            win.style.width = d.width;
            win.style.height = d.height;
          }
        }
      } catch {}
    };
    if (deptModalOpen) apply();
    const onResize = () => {
      if (deptExpanded) apply();
    };
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, [deptExpanded, deptModalOpen]);

  useEffect(() => {
    if (!deptModalOpen) return;
    if (typeof document === "undefined") return;
    const btn = document.getElementById("deptExpandBtn");
    if (!btn) return;
    const sync = () => {
      try {
        btn.textContent = deptExpanded ? "⤡" : "⤢";
      } catch {}
    };
    const onClick = (ev) => {
      try {
        ev.preventDefault();
        ev.stopPropagation();
      } catch {}
      setDeptExpanded((v) => !v);
    };
    sync();
    btn.addEventListener("click", onClick);
    return () => btn.removeEventListener("click", onClick);
  }, [deptModalOpen, deptExpanded]);

  // Theme toggle buttons inside modals
  useEffect(() => {
    if (typeof document === "undefined") return;
    const ids = ["deptThemeBtn", "posListThemeBtn"];
    const handlers = [];
    ids.forEach((id) => {
      const btn = document.getElementById(id);
      if (!btn) return;
      try {
        btn.textContent = theme === "dark" ? "☀️" : "🌙";
      } catch {}
      const onClick = (ev) => {
        try {
          ev.preventDefault();
          ev.stopPropagation();
        } catch {}
        toggleTheme();
      };
      btn.addEventListener("click", onClick);
      handlers.push([btn, onClick]);
    });
    return () => {
      handlers.forEach(([b, h]) => b.removeEventListener("click", h));
    };
  }, [theme, toggleTheme, deptModalOpen, posListModalOpen]);

  useEffect(() => {
    if (!deptModalOpen) return;
    if (deptView !== "chart") {
      if (deptChartRef.current) {
        try {
          deptChartRef.current.destroy();
        } catch {
          /* ignore */
        }
        deptChartRef.current = null;
      }
      return;
    }

    const wrap = typeof document !== "undefined" ? document.getElementById("deptCanvasWrap") : null;
    if (!wrap) return;

    const Chart = window.Chart;
    if (!Chart) return;

    try {
      wrap.style.overflowY = "auto";
      wrap.style.overflowX = "hidden";
    } catch {
      // ignore
    }

    // No modo gráfico, o portal da tabela já renderiza null; é seguro limpar.
    wrap.innerHTML = "";
    const canvas = document.createElement("canvas");
    canvas.id = "deptChartCanvas";
    canvas.style.width = "100%";

    // Scroll vertical quando houver muitos departamentos
    const rowsCount = deptosRank.length || 0;
    const metricsCount = Math.max(1, selectedMetrics.length);
    // Cada barra ~14px + padding entre grupos
    const rowH = Math.max(32, 14 * metricsCount + 18);
    const desiredH = Math.max(300, Math.min(8000, rowsCount * rowH + 160));
    canvas.height = desiredH;
    canvas.style.height = `${desiredH}px`;

    wrap.appendChild(canvas);

    try {
      const title = document.getElementById("deptTitle");
      if (title) title.textContent = "Análise por Departamento";
      const sub = document.getElementById("deptSub");
      if (sub) sub.textContent = `${deptMetricLbl}`;
    } catch {
      // ignore
    }

    const labels = deptosRank.map((r) => r.depto);
    const datasets = selectedMetrics.map((mk) => {
      const meta = DEPT_METRIC_META[mk];
      return {
        label: meta.label,
        data: deptosRank.map((r) => Number(r[mk]) || 0),
        backgroundColor: `${meta.color}CC`,
        borderColor: meta.color,
        borderWidth: 1,
        borderRadius: 6,
        categoryPercentage: 0.85,
        barPercentage: 0.92,
      };
    });
    const allValues = datasets.flatMap((d) => d.data);
    const max = Math.max(1, ...allValues);

    const niceStep = (() => {
      if (max <= 10) return 2;
      if (max <= 25) return 5;
      if (max <= 60) return 10;
      if (max <= 120) return 20;
      return 25;
    })();

    if (deptChartRef.current) {
      try {
        deptChartRef.current.destroy();
      } catch {
        /* ignore */
      }
      deptChartRef.current = null;
    }

    // Plugin: rótulos numéricos fixos no final de cada barra
    const valueLabelsPlugin = {
      id: "deptValueLabels",
      afterDatasetsDraw(chart) {
        const { ctx } = chart;
        ctx.save();
        ctx.font = "700 11px ui-sans-serif, system-ui, -apple-system";
        ctx.textBaseline = "middle";
        ctx.textAlign = "left";
        ctx.fillStyle = theme === "dark" ? "#e2e8f0" : "#0f172a";
        chart.data.datasets.forEach((ds, di) => {
          const meta = chart.getDatasetMeta(di);
          if (!meta || meta.hidden) return;
          meta.data.forEach((bar, i) => {
            const v = ds.data[i];
            if (v == null || v === 0) return;
            const { x, y } = bar.tooltipPosition();
            ctx.fillText(String(v), x + 4, y);
          });
        });
        ctx.restore();
      },
    };

    deptChartRef.current = new Chart(canvas, {
      type: "bar",
      data: { labels, datasets },
      plugins: [valueLabelsPlugin],
      options: {
        indexAxis: "y",
        responsive: false,
        maintainAspectRatio: false,
        plugins: {
          legend: {
            display: true,
            position: "top",
            labels: { color: theme === "dark" ? "#cbd5e1" : "#475569", font: { weight: "700" } },
          },
          tooltip: {
            enabled: true,
            displayColors: true,
            callbacks: {
              title: () => "",
              label: (ctx) => ` ${ctx.dataset.label}: ${ctx.parsed.x}`,
            },
            titleColor: theme === "dark" ? "#e2e8f0" : "#0f172a",
            bodyColor: theme === "dark" ? "#cbd5e1" : "#334155",
            backgroundColor: theme === "dark" ? "rgba(15,23,42,.95)" : "rgba(255,255,255,.97)",
            borderColor: theme === "dark" ? "rgba(148,163,184,.3)" : "rgba(148,163,184,.25)",
            borderWidth: 1,
          },
        },
        layout: { padding: { left: 10, right: 60, top: 10, bottom: 10 } },
        scales: {
          x: {
            beginAtZero: true,
            suggestedMax: Math.max(max + 1, Math.ceil(max * 1.15)),
            grace: "12%",
            grid: { color: theme === "dark" ? "rgba(148,163,184,.22)" : "rgba(148,163,184,.18)" },
            border: { display: false },
            ticks: {
              color: theme === "dark" ? "#cbd5e1" : "#94a3b8",
              precision: 0,
              stepSize: niceStep,
            },
          },
          y: {
            grid: { display: false },
            afterFit: (scale) => {
              scale.width = Math.max(scale.width, 260);
            },
            ticks: {
              color: theme === "dark" ? "#e2e8f0" : "#334155",
              font: { size: 12, weight: "700" },
              padding: 8,
              autoSkip: false,
              callback: (v, idx) => {
                const s = String(labels[idx] ?? "");
                const max = 32;
                return s.length <= max ? s : s.slice(0, max - 1) + "…";
              },
            },
          },
        },
        animation: false,
      },
    });

    // Overlay invisível sobre cada tick do eixo Y para tooltip nativo com nome completo
    try {
      const old = wrap.querySelector(".dept-y-overlay");
      if (old) old.remove();
      const overlay = document.createElement("div");
      overlay.className = "dept-y-overlay";
      overlay.style.cssText = "position:absolute;left:0;top:0;pointer-events:none;";
      const chart = deptChartRef.current;
      const yScale = chart.scales.y;
      const rect = canvas.getBoundingClientRect();
      const wrapRect = wrap.getBoundingClientRect();
      const offsetTop = rect.top - wrapRect.top;
      labels.forEach((lbl, i) => {
        const py = yScale.getPixelForTick(i);
        const span = document.createElement("div");
        span.title = lbl;
        span.style.cssText = `position:absolute;left:0;top:${offsetTop + py - 12}px;width:${yScale.width}px;height:24px;pointer-events:auto;cursor:help;`;
        overlay.appendChild(span);
      });
      wrap.style.position = wrap.style.position || "relative";
      wrap.appendChild(overlay);
    } catch {
      /* ignore */
    }

    try {
      const leg = document.getElementById("deptLegend");
      if (leg) {
        const totalSum = datasets.reduce(
          (acc, d) => acc + d.data.reduce((a, v) => a + (v || 0), 0),
          0,
        );
        leg.textContent = `Total: ${totalSum} · ${labels.length} deptos · ${deptMetricLbl}`;
      }
    } catch {
      // ignore
    }

    return () => {
      if (deptChartRef.current) {
        try {
          deptChartRef.current.destroy();
        } catch {
          /* ignore */
        }
        deptChartRef.current = null;
      }
    };
  }, [
    deptModalOpen,
    deptView,
    deptosRank,
    selectedMetrics,
    deptMetricLbl,
    DEPT_METRIC_META,
    theme,
  ]);

  const activeColabs = useMemo(() => {
    if (!dia) return [];
    const raw = dia?.[activeCat]?.colaboradores || [];
    const qq = (q || "").trim().toLowerCase();
    if (!qq) return raw;
    return raw.filter((c) => {
      const s =
        `${c?.nome || ""} ${c?.depto_desc || c?.depto || ""} ${c?.cargo_desc || c?.cargo || ""}`.toLowerCase();
      return s.includes(qq);
    });
  }, [dia, activeCat, q]);

  const virt = useMemo(() => {
    const rowH = 42;
    const overscan = 12;
    const total = activeColabs.length;
    const start = Math.max(0, Math.floor(scrollTop / rowH) - overscan);
    const end = Math.min(total, Math.ceil((scrollTop + outerH) / rowH) + overscan);
    return { rowH, total, start, end, items: activeColabs.slice(start, end) };
  }, [activeColabs, scrollTop, outerH]);

  const consecItems = useMemo(() => {
    if (!dia) return [];
    // Mock: gera um ranking determin?stico só para manter a UI viva durante a migração
    const base = [
      ...(dia?.falta?.colaboradores || []),
      ...(dia?.atraso?.colaboradores || []),
      ...(dia?.presentes?.colaboradores || []),
    ];

    const seen = new Set();
    const uniq = [];
    base.forEach((c) => {
      const k = c?.matricula || c?.nome;
      if (!k || seen.has(k)) return;
      seen.add(k);
      uniq.push(c);
    });

    const withDays = uniq.map((c) => {
      const s = String(c?.matricula || c?.nome || "0");
      let h = 0;
      for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0;
      const days = 2 + (h % 8); // 2..9
      return { ...c, _days: days };
    });

    const qq = (consecQ || "").trim().toLowerCase();
    const filtered = !qq
      ? withDays
      : withDays.filter((c) => `${c?.nome || ""} ${c?.depto || ""}`.toLowerCase().includes(qq));

    return filtered.sort((a, b) => b._days - a._days).slice(0, 40);
  }, [dia, consecQ]);

  const onExportHistPNG = () => {
    const canvas = histCanvasRef.current;
    if (!canvas) return;
    const url = canvas.toDataURL("image/png");
    const a = document.createElement("a");
    a.href = url;
    a.download = "posicao_historico.png";
    a.click();
  };

  const onExportHistCSV = () => {
    if (!hist || !Array.isArray(hist)) return;
    const rows = [
      ["date", "total", "faltas", "atrasos", "abs_rate"],
      ...hist.map((r) => [
        r.date || r.data_referencia || "",
        r.total ?? "",
        r.faltas ?? r.falta ?? "",
        r.atrasos ?? r.atraso ?? "",
        r.abs_rate ?? "",
      ]),
    ];
    const csv = rows
      .map((cols) =>
        cols
          .map((v) => {
            const s = String(v ?? "");
            return /[",\n;]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
          })
          .join(";"),
      )
      .join("\n");

    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "posicao_historico.csv";
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  };

  const histChip = (key, label, on) => (
    <button
      type="button"
      className={`hist-chip ${on ? "hc-active" : ""}`}
      onClick={() => {
        if (key === "all") {
          setHistSeries({
            abs: true,
            faltas: true,
            atrasos: true,
            prev: comparePrev ? true : false,
          });
          return;
        }
        setHistSeries((s) => ({ ...s, [key]: !s[key] }));
      }}
    >
      {label}
    </button>
  );

  return (
    <div
      className="chart-panel"
      id="cpPosicao"
      style={{ minHeight: 0, flex: 1, overflow: "auto" }}
    >
      <div className="panel-header" id="phPosicao" style={{ display: "none" }}>
        <div className="panel-dot" style={{ background: "var(--c4)" }}></div>
        <span className="panel-title">Posicao do Dia</span>
        <span
          className={`api-mode-badge ${CONFIG.USE_MOCK ? "mock" : "live"}`}
          id="pos_apiModeBadge"
        >
          {CONFIG.USE_MOCK ? "PLANILHA" : "API"}
        </span>
        <button
          className="pnl-btn"
          id="pos_refreshBtn"
          type="button"
          style={{ marginLeft: "auto" }}
          onClick={() => diaQuery.refetch()}
        >
          Atualizar
        </button>
        <button
          className="pnl-hide-btn"
          data-hide-panel="cpPosicao"
          data-panel-label="Posicao do Dia"
        >
          X
        </button>
      </div>

      <div className="filter-bar" id="pos_filterBar" style={{ display: "none" }}>
        <span className="filter-label">Período:</span>
        <div className="filter-date-wrap">
          <input type="date" className="filter-date-input" id="pos_filterDateStart" />
          <span className="filter-arrow">→</span>
          <input type="date" className="filter-date-input" id="pos_filterDateEnd" />
        </div>
        <button className="filter-apply" id="pos_filterApply">
          Aplicar
        </button>
        <div className="adv-filter-wrap">
          <button className="adv-filter-btn" id="pos_advFilterBtn">
            🔧 Filtros{" "}
            <span
              id="pos_advFilterCount"
              style={{
                display: "none",
                background: "var(--c4)",
                color: "#fff",
                borderRadius: 9999,
                padding: "0 5px",
                fontSize: ".58rem",
              }}
            ></span>
          </button>
          <div className="adv-filter-panel" id="pos_advFilterPanel">
            <div className="afp-title">
              Filtros Avançados
              <button className="afp-clear" id="pos_advFilterClear">
                Limpar
              </button>
            </div>
            <div className="afp-row">
              <div className="afp-lbl">Departamento</div>
              <div className="afp-chips" id="pos_afpDeptos"></div>
            </div>
            <div className="afp-row">
              <div className="afp-lbl">Cargo</div>
              <div className="afp-chips" id="pos_afpCargos"></div>
            </div>
            <div className="afp-row">
              <div className="afp-lbl">Filial</div>
              <div className="afp-chips" id="pos_afpFiliais"></div>
            </div>
          </div>
        </div>
        <div className="active-filters" id="pos_activeFiltersBar"></div>
      </div>

      <div
        className="conn-banner"
        id="pos_connBanner"
        style={{ display: !CONFIG.USE_MOCK && err ? "flex" : "none" }}
      >
        ⚠ <span id="pos_connMsg">Falha na conexão.</span>
        <button className="banner-retry" id="pos_btnRetry">
          Tentar novamente
        </button>
      </div>

      <div className="toolbar" style={{ display: "none" }}>
        <div className="section-label">Detalhamento</div>
      </div>

      <div className="panels-row top" id="pos_rowTop">
        <div className="panel panel-cat" id="pos_panelCat">
          {!showHome && (
            <div className="panel-header">
              <div className="panel-dot" style={{ background: "var(--c4)" }}></div>
              <span className="panel-title">Posição Agora</span>
              <span className="panel-badge pos-pill" id="pos_catBadge">
                {String(activeCatTotal)}
              </span>
              <span className="pos-pill" id="pos_homeDatePill">
                {homeDateText}
              </span>
              <span className="pos-pill upd" id="pos_homeUpdPill">
                Última atualização: {lastUpdText}
              </span>
              <div className="panel-actions">
                <button
                  className="panel-btn"
                  id="pos_btnBarModal"
                  type="button"
                  onClick={() => setBarModalOpen(true)}
                >
                  📊 Gráfico
                </button>
              </div>
            </div>
          )}

          <div
            id="pos_home"
            style={{
              padding: 0,
              display: "flex",
              flexDirection: "column",
              minHeight: 0,
              flex: 1,
              overflow: "auto",
            }}
          >
            {showLoading && (
              <div style={{ fontSize: ".72rem", color: "var(--muted)" }}>⏳ Carregando…</div>
            )}
            {showApiError && (
              <div style={{ fontSize: ".72rem", color: "var(--muted)" }}>
                API indisponível — importe a planilha ou escolha outra data.
              </div>
            )}
            {(showEmptyPlanilha || loadingTimedOut) && (
              <div
                style={{
                  padding: "20px 16px",
                  fontSize: ".85rem",
                  color: "var(--muted)",
                  lineHeight: 1.5,
                  maxWidth: 520,
                }}
              >
                {loadingTimedOut ? (
                  <>
                    O carregamento dos dados demorou demais (armazenamento local ou planilha
                    grande). Você pode <strong>importar a tabela</strong> de novo ou recarregar a
                    página (F5). Feche outras abas deste app se estiverem abertas.
                  </>
                ) : (
                  <>
                    Nenhum dado para exibir nesta data. Importe a planilha de marcações ou uma CCT em
                    PDF (convenção coletiva).
                  </>
                )}
                <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginTop: 12 }}>
                  <input
                    ref={emptyXlsxFileRef}
                    type="file"
                    accept=".xlsx,.xls,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-excel"
                    style={{ position: "absolute", width: 1, height: 1, opacity: 0 }}
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      e.target.value = "";
                      if (file) void handleImportXlsx(file);
                    }}
                  />
                  <button
                    type="button"
                    className="btn"
                    disabled={importBusy}
                    onClick={() => emptyXlsxFileRef.current?.click()}
                  >
                    {importBusy ? "Importando planilha..." : "Importar planilha (XLSX)"}
                  </button>
                  <input
                    ref={emptyCctFileRef}
                    type="file"
                    accept=".pdf,application/pdf"
                    multiple
                    style={{ position: "absolute", width: 1, height: 1, opacity: 0 }}
                    onChange={async (e) => {
                      const list = e.target.files;
                      e.target.value = "";
                      if (!list?.length) return;
                      setEmptyCctBusy(true);
                      try {
                        const res = await importCctPdfFiles(list);
                        if (res.added?.length) {
                          Toast.show(
                            `${res.added.length} PDF salvo(s). Abrindo Radar → CCT…`,
                            "s",
                            6000,
                          );
                          window.dispatchEvent(new CustomEvent("pb-show-cct"));
                        } else if (res.errors?.length) {
                          Toast.show(res.errors[0], "e", 8000);
                        } else {
                          Toast.show(res.error || "Nenhum PDF importado.", "e", 8000);
                        }
                      } catch (err) {
                        Toast?.show?.(err?.message || "Falha ao importar CCT", "e");
                      } finally {
                        setEmptyCctBusy(false);
                      }
                    }}
                  />
                  <button
                    type="button"
                    className="btn"
                    disabled={emptyCctBusy}
                    onClick={() => emptyCctFileRef.current?.click()}
                  >
                    {emptyCctBusy ? "Lendo PDF…" : "Importar CCT (PDF)"}
                  </button>
                  <button
                    type="button"
                    className="btn"
                    onClick={() => window.dispatchEvent(new CustomEvent("pb-open-radar-cct"))}
                  >
                    Abrir CCT no Radar
                  </button>
                </div>
              </div>
            )}

            {!showLoading && dia && totals && showHome && (
              <PosicaoBentoHeader
                metrics={bentoMetrics}
                lastUpdText={lastUpdText}
                dataRefText={homeDateText}
                selectedDate={presentesDate || dia?.data_referencia || ""}
                onDateChange={setPresentesDate}
                totalText={""}
                forcaPrevistaDeptoMap={forcaPrevistaDeptoMap}
                onSaveForcaPrevistaDeptoMap={(map) => setForcaPrevistaDeptoMap(map || {})}
                onImportXlsx={handleImportXlsx}
                importBusy={importBusy}
                importOverrides={importOverrides}
                onClearImport={handleClearImport}
                onImportTabela={handleImportTabela}
                onClearTabelaImport={handleClearTabelaImport}
                onExportPosicaoBackup={handleExportPosicaoBackup}
                onImportPosicaoBackup={handleImportPosicaoBackup}
                tabelaImportCount={histTableImport ? histTableImport.length : 0}
                loading={loading}
                fetching={diaQuery.isFetching}
                onRefresh={() => diaQuery.refetch()}
                onCardClick={(k) => {
                  setActiveCat(k);
                  openPosListModal(k);
                }}
                filialOptions={filialOptions}
                deptoOptions={deptoOptions}
                filialValue={filialFilter}
                deptoValue={deptoFilter}
                onFilialChange={setFilialFilter}
                onDeptoChange={setDeptoFilter}
                theme={theme}
                onToggleTheme={toggleTheme}
                onOpenChart={() => setBarModalOpen(true)}
                deptRows={deptRows}
                deptStats={deptStats}
                dia={dia}
                filteredDia={filteredDia}
                deptAbsenceList={deptAbsenceList}
                onOpenDept={openDeptModal}
                onOpenTurnoverDesligados={openTurnoverDesligados}
                onOpenTurnoverAdmitidos={openTurnoverAdmitidos}
                onOpenAbonosDeptColaboradores={openAbonosDeptColaboradores}
                onOpenMensalEventColaboradores={openMensalEventColaboradores}
                onOpenBancoHorasDeptColaboradores={openBancoHorasDeptColaboradores}
                onOpenBancoHorasKpiColaboradores={openBancoHorasKpiColaboradores}
                histData={histData}
                histDeptData={histDeptData}
                periodoApuracao={periodoApuracao}
                onPeriodoApuracaoChange={setPeriodoApuracaoOverride}
              />
            )}

            {!showLoading && dia && totals && !showHome && (
              <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
                <button type="button" className="panel-btn" onClick={() => setShowHome(true)}>
                  ? Voltar
                </button>
                <span className="panel-badge">Categoria: {activeCat}</span>
              </div>
            )}
          </div>

          <div className="cat-tabs-wrap">
            <div className="cat-tabs" id="pos_catTabs" style={{ display: showHome ? "none" : "" }}>
              {categories.map((cat) => (
                <button
                  key={cat.key}
                  type="button"
                  className={`hist-chip ${activeCat === cat.key ? "hc-active" : ""}`}
                  style={{ "--cc": activeCat === cat.key ? "var(--c4)" : undefined }}
                  onClick={() => {
                    setActiveCat(cat.key);
                    openPosListModal(cat.key);
                  }}
                >
                  {cat.label} ({cat.total})
                </button>
              ))}
            </div>

            {activeCat === "presentes" ? (
              <div
                style={{
                  display: showHome ? "none" : "flex",
                  paddingLeft: 10,
                  alignItems: "center",
                  gap: 8,
                }}
              >
                <input
                  type="date"
                  value={presentesDate || dia?.data_referencia || ""}
                  onChange={(e) => {
                    const v = e.target.value || "";
                    setPresentesDate(v);
                  }}
                />
              </div>
            ) : null}
          </div>

          <div className="panel-search">
            <input
              id="pos_catSearchInput"
              type="search"
              placeholder="Buscar nome, depto, cargo…"
              autoComplete="off"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              style={{ display: showHome ? "none" : undefined }}
            />
          </div>

          <div
            className="virt-outer"
            id="pos_virtOuter"
            ref={virtOuterRef}
            style={{ display: showHome ? "none" : "" }}
          >
            <div
              className="virt-spacer"
              id="pos_virtSpacer"
              style={{ height: `${virt.total * virt.rowH}px` }}
            >
              {virt.items.map((c, idx) => {
                const i = virt.start + idx;
                const top = i * virt.rowH;
                return (
                  <div
                    key={`${c?.matricula || c?.nome || "row"}-${i}`}
                    className="colab-card"
                    style={{ top: `${top}px`, height: `${virt.rowH}px` }}
                    title={c?.nome || ""}
                  >
                    <div className="cc-left">
                      <span className="cc-nome">{c?.nome || "—"}</span>
                      <div className="cc-info">
                        <span className="cc-depto">{c?.depto_desc || c?.depto || "—"}</span>
                        <span className="cc-sep">•</span>
                        <span className="cc-cargo">{c?.cargo_desc || c?.cargo || "—"}</span>
                      </div>
                    </div>
                    <div className="cc-mid">
                      {(c?.marcacoes || []).slice(0, 4).map((m, j) => (
                        <span key={j} className={`marc-badge ${m?.ok ? "ok" : "fail"}`}>
                          {m?.time || "--:--"}
                        </span>
                      ))}
                    </div>
                    <div className="cc-right">
                      <span className="cc-pill">{c?.filial || "—"}</span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
          <div className="panel-footer">arrastar · redimensionar</div>
          <div className="panel-rz" id="pos_rzCat"></div>
        </div>
      </div>

      <div className="panel-footer">arrastar - redimensionar</div>
      <div className="pnl-rz" id="rzPosicao"></div>

      {deptModalOpen && typeof document !== "undefined" && document.getElementById("deptCtrl")
        ? createPortal(
            <DeptCtrlBar
              metricMeta={DEPT_METRIC_META}
              metricOrder={DEPT_METRIC_ORDER}
              selected={selectedMetrics}
              onToggle={toggleDeptMetric}
              order={deptOrder}
              onOrderChange={setDeptOrder}
              deptOptions={deptChartOptions}
              deptFilter={deptChartFilter}
              onDeptFilterChange={setDeptChartFilter}
            />,
            document.getElementById("deptCtrl"),
          )
        : null}

      {deptModalOpen && typeof document !== "undefined" && document.getElementById("deptCanvasWrap")
        ? createPortal(
            deptView === "table" ? (
              <div ref={deptWrapRef} style={{ padding: 0 }}>
                {(() => {
                  const rows = deptosRank;
                  const cols = selectedMetrics;
                  const totalsByCol = cols.map((mk) =>
                    rows.reduce((a, r) => a + (Number(r[mk]) || 0), 0),
                  );
                  return (
                    <table className="hist-table" style={{ width: "100%" }}>
                      <thead>
                        <tr>
                          <th style={{ width: 44 }}>#</th>
                          <th>DEPARTAMENTO</th>
                          {cols.map((mk) => (
                            <th key={mk} style={{ width: 110, textAlign: "right" }}>
                              {(DEPT_METRIC_META[mk]?.label || mk).toUpperCase()}
                            </th>
                          ))}
                          <th style={{ width: 110, textAlign: "right" }}>TOTAL</th>
                        </tr>
                      </thead>
                      <tbody>
                        {rows.map((r, i) => {
                          const rowTotal = cols.reduce((a, mk) => a + (Number(r[mk]) || 0), 0);
                          return (
                            <tr key={i}>
                              <td style={{ color: "var(--muted)", fontWeight: 800 }}>{i + 1}</td>
                              <td
                                style={{
                                  fontWeight: 900,
                                  maxWidth: 280,
                                  overflow: "hidden",
                                  textOverflow: "ellipsis",
                                  whiteSpace: "nowrap",
                                }}
                                title={r?.depto || "—"}
                              >
                                {r?.depto || "—"}
                              </td>
                              {cols.map((mk) => {
                                const v = Number(r[mk]) || 0;
                                const isPrev = mk === "prevista" && r.prevista_estimada;
                                return (
                                  <td
                                    key={mk}
                                    style={{
                                      textAlign: "right",
                                      fontWeight: 900,
                                      color: DEPT_METRIC_META[mk]?.color || "#0f172a",
                                      fontStyle: isPrev ? "italic" : "normal",
                                    }}
                                    title={isPrev ? "estimado pelos colaboradores ativos" : ""}
                                  >
                                    {v}
                                    {isPrev ? "*" : ""}
                                  </td>
                                );
                              })}
                              <td style={{ textAlign: "right", fontWeight: 950 }}>{rowTotal}</td>
                            </tr>
                          );
                        })}
                        <tr
                          style={{
                            position: "sticky",
                            bottom: 0,
                            background: "var(--card, #fff)",
                            boxShadow: "0 -1px 0 var(--border, #e5e7eb)",
                            zIndex: 2,
                          }}
                        >
                          <td
                            colSpan={2}
                            style={{
                              fontWeight: 950,
                              position: "sticky",
                              bottom: 0,
                              background: "var(--card, #fff)",
                            }}
                          >
                            TOTAL
                          </td>
                          {totalsByCol.map((t, idx) => (
                            <td
                              key={idx}
                              style={{
                                textAlign: "right",
                                fontWeight: 950,
                                color: DEPT_METRIC_META[cols[idx]]?.color || "#0f172a",
                                position: "sticky",
                                bottom: 0,
                                background: "var(--card, #fff)",
                              }}
                            >
                              {t}
                            </td>
                          ))}
                          <td
                            style={{
                              textAlign: "right",
                              fontWeight: 950,
                              position: "sticky",
                              bottom: 0,
                              background: "var(--card, #fff)",
                            }}
                          >
                            {totalsByCol.reduce((a, b) => a + b, 0)}
                          </td>
                        </tr>
                      </tbody>
                    </table>
                  );
                })()}
              </div>
            ) : null,
            document.getElementById("deptCanvasWrap"),
          )
        : null}

      {posListModalOpen &&
      typeof document !== "undefined" &&
      document.getElementById("posListCanvasWrap")
        ? createPortal(
            <div className="pos-list-hdm-wrap">
              <div className="pos-list-hdm-tabs">
                {(Array.isArray(posListCategories) ? posListCategories : []).map((cat) => (
                  <button
                    key={cat.key}
                    type="button"
                    className={`hist-chip ${posListKey === cat.key ? "hc-active" : ""}`}
                    onClick={() => {
                      setPosListKey(cat.key);
                      if (cat.key !== "mensal_event") setPosListInitialSearch("");
                    }}
                  >
                    {cat.label} ({cat.total ?? 0})
                  </button>
                ))}
              </div>
              <HistoricoDayModal
                key={
                  String(posListKey || "") === "banco_horas"
                    ? `banco_horas-${posListEmbeddedSession}`
                    : String(posListKey || "") === "abonos_pendentes"
                      ? `abonos_pendentes-${posListEmbeddedSession}`
                      : String(posListKey || "") === "abonos_efetuados"
                        ? `abonos_efetuados-${posListEmbeddedSession}`
                        : posListKey
                }
                embedded
                posListKey={posListKey}
                date={presentesDate}
                label={posListHdm.label || posListTitle}
                employees={posListHdm.employees}
                events={posListHdm.events}
                eventsDateFrom={posListHdm.eventsDateFrom}
                eventsDateTo={posListHdm.eventsDateTo}
                onDateRangeApply={(from, to) => {
                  const ref = String(presentesDate || dia?.data_referencia || new Date().toISOString().slice(0, 10));
                  const nextFrom = from || ref;
                  const nextTo = to || nextFrom || ref;
                  setPosListDateFrom(nextFrom);
                  setPosListDateTo(nextTo);
                }}
                initialPillFilter={posListHdm.initialPillFilter}
                initialSearch={posListInitialSearch}
                deptFilterLabel={
                  ["banco_horas", "abonos_pendentes", "abonos_efetuados"].includes(String(posListKey || ""))
                    ? posListDeptoFilter
                    : ""
                }
                onClearDeptFilter={
                  ["banco_horas", "abonos_pendentes", "abonos_efetuados"].includes(String(posListKey || "")) &&
                  posListDeptoFilter
                    ? String(posListKey || "") === "banco_horas"
                      ? clearBancoHorasDeptFilter
                      : clearPosListDeptFilter
                    : null
                }
                hasHours
                hasExtras
                hideGridTotals={
                  !["banco_horas", "abonos_pendentes", "abonos_efetuados"].includes(String(posListKey || ""))
                }
                onFilteredCountChange={
                  ["banco_horas", "abonos_pendentes", "abonos_efetuados"].includes(String(posListKey || ""))
                    ? setPosListEmbeddedCount
                    : undefined
                }
                onClose={() => setPosListModalOpen(false)}
                theme={theme}
              />
            </div>,
            document.getElementById("posListCanvasWrap"),
          )
        : null}
    </div>
  );
}
