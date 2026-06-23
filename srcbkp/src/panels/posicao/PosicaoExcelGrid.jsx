import { useCallback, useEffect, useMemo, useRef, useState } from "react";

export function PosicaoExcelGrid({
  rows,
  categories,
  activeCategory,
  onChangeCategory,
  turnoverInitialFrom = "",
  turnoverInitialTo = "",
}) {
  const isTurnover =
    String(activeCategory || "") === "turnover_desligados" ||
    String(activeCategory || "") === "turnover_admitidos";
  const colsDefault = [
    { key: "filial", label: "Filial", width: 160 },
    { key: "matricula", label: "Matrícula", width: 100 },
    { key: "nome", label: "Nome", width: 220 },
    { key: "departamento", label: "Departamento", width: 180 },
    { key: "cargo", label: "Cargo", width: 180 },
    { key: "gestor", label: "Gestor", width: 200 },
    { key: "inicio", label: isTurnover ? "Admissão" : "Data Início", width: 140 },
    { key: "termino", label: isTurnover ? "Desligamento" : "Data Fim", width: 140 },
    { key: "qtd_dias", label: "Qtd. dias", width: 100 },
    { key: "justificativa", label: "Justificativa", width: 260 },
    { key: "marcacoes", label: "Horários / Marcações", width: 360 },
  ];

  const displayColLabel = useCallback((c) => {
    const key = String(c?.key || "");
    const lbl = String(c?.label || c?.key || "");
    const norm = lbl
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-z0-9]+/g, " ")
      .trim();
    if (key === "cargo" || key === "carga" || norm === "carga") return "Cargo";
    return lbl;
  }, []);

  const sanitizeCols = useCallback((arr) => {
    const a = Array.isArray(arr) ? arr : [];
    return a.map((c) => {
      const key = String(c?.key || "");
      const nextKey = key === "carga" ? "cargo" : key;
      const next = { ...(c || {}), key: nextKey };
      if (nextKey === "cargo") next.label = "Cargo";
      return next;
    });
  }, []);

  const safeRows = Array.isArray(rows) ? rows : [];

  const [q, setQ] = useState("");
  const filtersStorageKey = `pos_excel_filters_${String(activeCategory || "default")}`;
  const readSession = (k, fb) => {
    try {
      const raw = sessionStorage.getItem(k);
      return raw ? JSON.parse(raw) : fb;
    } catch {
      return fb;
    }
  };
  const [colFilters, setColFilters] = useState(() => {
    const v = readSession(filtersStorageKey, null);
    return v && typeof v === "object" && v.colFilters && typeof v.colFilters === "object"
      ? v.colFilters
      : {};
  });
  const [colFilterValues, setColFilterValues] = useState(() => {
    const v = readSession(filtersStorageKey, null);
    return v && typeof v === "object" && v.colFilterValues && typeof v.colFilterValues === "object"
      ? v.colFilterValues
      : {};
  });
  const [filterOpenKey, setFilterOpenKey] = useState("");
  const [filterValueSearch, setFilterValueSearch] = useState("");
  const [filterMenuOpen, setFilterMenuOpen] = useState(false);
  const filterMenuRef = useRef(null);
  const [exportMenuOpen, setExportMenuOpen] = useState(false);
  const exportMenuRef = useRef(null);
  const [busy, setBusy] = useState(null); // { kind, label } | null
  const [colPickerOpen, setColPickerOpen] = useState(false);
  const colPickerRef = useRef(null);

  const runWithBusy = useCallback((kind, label, fn) => {
    setBusy({ kind, label });
    requestAnimationFrame(() => {
      setTimeout(async () => {
        try {
          await fn();
        } catch (e) {
          console.error(e);
        } finally {
          setBusy(null);
        }
      }, 30);
    });
  }, []);

  // Recarrega filtros ao trocar de categoria (sessionStorage por categoria)
  useEffect(() => {
    const v = readSession(filtersStorageKey, null);
    setColFilters(
      v && typeof v === "object" && v.colFilters && typeof v.colFilters === "object"
        ? v.colFilters
        : {},
    );
    setColFilterValues(
      v && typeof v === "object" && v.colFilterValues && typeof v.colFilterValues === "object"
        ? v.colFilterValues
        : {},
    );
    setFilterOpenKey("");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeCategory]);

  // Persiste filtros da categoria atual em sessionStorage
  useEffect(() => {
    try {
      sessionStorage.setItem(filtersStorageKey, JSON.stringify({ colFilters, colFilterValues }));
    } catch {}
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filtersStorageKey, colFilters, colFilterValues]);

  // Fecha o menu unico de filtros ao clicar fora
  useEffect(() => {
    if (!filterMenuOpen) return;
    const onDown = (e) => {
      const el = filterMenuRef.current;
      if (!el) return;
      if (el.contains(e.target)) return;
      setFilterMenuOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [filterMenuOpen]);

  // Fecha menu de exportação ao clicar fora
  useEffect(() => {
    if (!exportMenuOpen) return;
    const onDown = (e) => {
      const el = exportMenuRef.current;
      if (!el) return;
      if (el.contains(e.target)) return;
      setExportMenuOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [exportMenuOpen]);
  const [sort, setSort] = useState({ key: "nome", asc: true });
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [selected, setSelected] = useState({ r: 0, c: 0 });
  const [dragColKey, setDragColKey] = useState("");
  const groupStorageKey = `pos_excel_groupby_${String(activeCategory || "default")}`;
  const [groupByKeys, setGroupByKeys] = useState(() => {
    try {
      const raw = localStorage.getItem(`pos_excel_groupby_${String(activeCategory || "default")}`);
      const arr = raw ? JSON.parse(raw) : [];
      return Array.isArray(arr) ? arr : [];
    } catch {
      return [];
    }
  });
  const [collapsedGroups, setCollapsedGroups] = useState(new Set());
  useEffect(() => {
    try {
      const raw = localStorage.getItem(groupStorageKey);
      const arr = raw ? JSON.parse(raw) : [];
      setGroupByKeys(Array.isArray(arr) ? arr : []);
    } catch {
      setGroupByKeys([]);
    }
  }, [groupStorageKey]);

  useEffect(() => {
    try {
      localStorage.setItem(groupStorageKey, JSON.stringify(groupByKeys));
    } catch {}
  }, [groupByKeys, groupStorageKey]);

  const [drillStack, setDrillStack] = useState([]);
  const [turnoverFrom, setTurnoverFrom] = useState(() => String(turnoverInitialFrom || ""));
  const [turnoverTo, setTurnoverTo] = useState(() => String(turnoverInitialTo || ""));

  const setConsistentTurnoverFrom = useCallback(
    (value) => {
      const next = String(value || "");
      setTurnoverFrom(next);
      if (next && turnoverTo && next > turnoverTo) setTurnoverTo(next);
    },
    [turnoverTo],
  );

  const setConsistentTurnoverTo = useCallback(
    (value) => {
      const next = String(value || "");
      setTurnoverTo(next);
      if (next && turnoverFrom && turnoverFrom > next) setTurnoverFrom(next);
    },
    [turnoverFrom],
  );

  useEffect(() => {
    if (!isTurnover) return;
    setTurnoverFrom(String(turnoverInitialFrom || ""));
    setTurnoverTo(String(turnoverInitialTo || ""));
  }, [isTurnover, turnoverInitialFrom, turnoverInitialTo]);

  const mergeCols = (prev) => {
    const byKey = new Map((Array.isArray(prev) ? prev : []).map((c) => [c.key, c]));
    return colsDefault.map((c) => {
      const persisted = byKey.get(c.key) || {};
      const merged = { ...persisted, ...c };
      // Sempre usar o label padrão (evita "CARGA" vindo do localStorage)
      merged.label = c.label;
      if (isTurnover && merged.key === "inicio") merged.label = "Admissão";
      if (isTurnover && merged.key === "termino") merged.label = "Desligamento";
      return merged;
    });
  };

  useEffect(() => {
    setColState((prev) => {
      const arr = Array.isArray(prev) ? prev : [];
      let changed = false;
      const next = arr.map((c) => {
        const key = String(c?.key || "");
        if (key === "carga") {
          changed = true;
          return { ...(c || {}), key: "cargo", label: "Cargo" };
        }
        if (key === "cargo" && String(c?.label || "") !== "Cargo") {
          changed = true;
          return { ...(c || {}), label: "Cargo" };
        }
        return c;
      });
      return changed ? mergeCols(next) : prev;
    });
    setVisibleKeys((prev) => {
      const arr = Array.isArray(prev) ? prev : [];
      if (!arr.includes("carga")) return prev;
      const next = arr.map((k) => (String(k) === "carga" ? "cargo" : k));
      return Array.from(new Set(next));
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeCategory]);

  useEffect(() => {
    const cat = String(activeCategory || "");
    if (cat !== "turnover_desligados") return;
    setColState((prev) => {
      const base = mergeCols(Array.isArray(prev) ? prev : []);
      return base.map((c) => {
        if (c.key === "inicio")
          return { ...c, label: "Admissão", width: Math.max(120, c.width || 0) };
        if (c.key === "termino")
          return { ...c, label: "Desligamento", width: Math.max(140, c.width || 0) };
        return c;
      });
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeCategory]);

  const colsStorageKey = `pos_excel_cols_${String(activeCategory || "default")}`;
  const visibleStorageKey = `pos_excel_visible_${String(activeCategory || "default")}`;

  const [visibleKeys, setVisibleKeys] = useState(() => {
    try {
      const raw = localStorage.getItem(visibleStorageKey);
      const v = raw ? JSON.parse(raw) : null;
      if (Array.isArray(v) && v.length) return v;
    } catch {}
    return colsDefault.map((c) => c.key);
  });

  const [colState, setColState] = useState(() => {
    try {
      const raw = localStorage.getItem(colsStorageKey);
      const v = raw ? JSON.parse(raw) : null;
      if (Array.isArray(v) && v.length) return mergeCols(sanitizeCols(v));
    } catch {}
    return mergeCols(colsDefault);
  });

  // Recarrega estado ao trocar de categoria (persistência por opção)
  useEffect(() => {
    try {
      const rawC = localStorage.getItem(colsStorageKey);
      const vc = rawC ? JSON.parse(rawC) : null;
      setColState(
        Array.isArray(vc) && vc.length ? mergeCols(sanitizeCols(vc)) : mergeCols(colsDefault),
      );
    } catch {
      setColState(mergeCols(colsDefault));
    }
    try {
      const rawV = localStorage.getItem(visibleStorageKey);
      const vv = rawV ? JSON.parse(rawV) : null;
      const all = new Set(colsDefault.map((c) => c.key));
      if (Array.isArray(vv) && vv.length) {
        const kept = vv.filter((k) => all.has(k));
        setVisibleKeys(kept.length ? kept : colsDefault.map((c) => c.key));
      } else {
        setVisibleKeys(colsDefault.map((c) => c.key));
      }
    } catch {
      setVisibleKeys(colsDefault.map((c) => c.key));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeCategory]);

  useEffect(() => {
    const cat = String(activeCategory || "");
    if (
      cat !== "ferias" &&
      cat !== "afastados" &&
      cat !== "turnover_desligados" &&
      cat !== "turnover_admitidos"
    )
      return;

    setVisibleKeys((prev) => {
      const set = new Set(Array.isArray(prev) ? prev : []);
      set.add("inicio");
      set.add("termino");
      if (cat === "afastados") {
        set.add("qtd_dias");
        set.add("justificativa");
      }
      if (cat === "turnover_desligados") {
        set.delete("qtd_dias");
        set.delete("justificativa");
        set.delete("marcacoes");
      }
      if (cat === "turnover_admitidos") {
        set.delete("qtd_dias");
        set.delete("justificativa");
      }
      const ordered = colState.map((c) => c.key).filter((k) => set.has(k));
      return ordered.length ? ordered : prev;
    });
  }, [activeCategory, colState]);

  useEffect(() => {
    try {
      localStorage.setItem(visibleStorageKey, JSON.stringify(visibleKeys));
    } catch {}
  }, [visibleKeys]);

  useEffect(() => {
    if (!colPickerOpen) return;
    const onDown = (e) => {
      const el = colPickerRef.current;
      if (!el) return;
      if (el.contains(e.target)) return;
      setColPickerOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [colPickerOpen]);

  useEffect(() => {
    if (!filterOpenKey) return;
    const onDown = (e) => {
      const t = e?.target;
      if (!t || !t.closest) return;
      if (t.closest(`[data-col-filter-pop="${filterOpenKey}"]`)) return;
      setFilterOpenKey("");
      setFilterValueSearch("");
    };
    document.addEventListener("mousedown", onDown, true);
    return () => document.removeEventListener("mousedown", onDown, true);
  }, [filterOpenKey]);

  const visibleCols = useMemo(() => {
    const set = new Set(visibleKeys);
    const allow = new Set(colState.map((c) => c.key));

    // Base: sempre disponiveis
    const base = new Set([
      "filial",
      "matricula",
      "nome",
      "departamento",
      "cargo",
      "gestor",
      "marcacoes",
    ]);
    const cat = String(activeCategory || "");
    if (
      cat === "ferias" ||
      cat === "afastados" ||
      cat === "turnover_desligados" ||
      cat === "turnover_admitidos"
    ) {
      base.add("inicio");
      base.add("termino");
    }
    if (cat === "afastados") {
      base.add("qtd_dias");
      base.add("justificativa");
    }
    if (cat === "turnover_desligados") {
      base.delete("marcacoes");
      base.delete("qtd_dias");
      base.delete("justificativa");
    }
    if (cat === "turnover_admitidos") {
      base.delete("qtd_dias");
      base.delete("justificativa");
    }

    const allowed = new Set([...base].filter((k) => allow.has(k)));
    return colState.filter((c) => set.has(c.key) && allowed.has(c.key));
  }, [colState, visibleKeys, activeCategory]);

  const pickableCols = useMemo(() => {
    const allow = new Set(colState.map((c) => c.key));
    const base = new Set([
      "filial",
      "matricula",
      "nome",
      "departamento",
      "cargo",
      "gestor",
      "marcacoes",
    ]);
    const cat = String(activeCategory || "");
    if (
      cat === "ferias" ||
      cat === "afastados" ||
      cat === "turnover_desligados" ||
      cat === "turnover_admitidos"
    ) {
      base.add("inicio");
      base.add("termino");
    }
    if (cat === "afastados") {
      base.add("qtd_dias");
      base.add("justificativa");
    }
    if (cat === "turnover_desligados") {
      base.delete("marcacoes");
      base.delete("qtd_dias");
      base.delete("justificativa");
    }
    if (cat === "turnover_admitidos") {
      base.delete("qtd_dias");
      base.delete("justificativa");
    }
    const allowed = new Set([...base].filter((k) => allow.has(k)));
    return colState.filter((c) => allowed.has(c.key));
  }, [colState, activeCategory]);

  const colIndexByKey = useMemo(() => {
    const m = new Map();
    colState.forEach((c, i) => m.set(c.key, i));
    return m;
  }, [colState]);

  const fmtDate = (v) => {
    if (!v) return "";
    const s = String(v);
    // ISO yyyy-mm-dd
    const m = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (m) return `${m[3]}/${m[2]}/${m[1]}`;
    // already dd/mm
    if (/^\d{2}\/\d{2}\/\d{4}/.test(s)) return s.slice(0, 10);
    try {
      const d = new Date(s);
      if (!Number.isNaN(d.getTime())) {
        const dd = String(d.getDate()).padStart(2, "0");
        const mm = String(d.getMonth() + 1).padStart(2, "0");
        const yy = String(d.getFullYear());
        return `${dd}/${mm}/${yy}`;
      }
    } catch {}
    return s;
  };

  const getInicioTermino = (r) => {
    const ini = r?.inicio ?? r?.dt_inicio ?? r?.data_inicio ?? r?.inicio_data ?? r?.ini;
    const fim = r?.termino ?? r?.dt_termino ?? r?.data_termino ?? r?.termino_data ?? r?.fim;
    return { ini: fmtDate(ini), fim: fmtDate(fim), iniRaw: ini, fimRaw: fim };
  };

  const parseDateAny = (v) => {
    if (!v) return null;
    const s = String(v).trim();
    let m = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (m) return new Date(+m[1], +m[2] - 1, +m[3]);
    m = s.match(/^(\d{2})\/(\d{2})\/(\d{4})/);
    if (m) return new Date(+m[3], +m[2] - 1, +m[1]);
    const d = new Date(s);
    return Number.isNaN(d.getTime()) ? null : d;
  };

  const getQtdDias = (r) => {
    const { iniRaw, fimRaw } = getInicioTermino(r);
    const di = parseDateAny(iniRaw);
    if (!di) return "";
    const df = parseDateAny(fimRaw) || new Date();
    const a = new Date(di.getFullYear(), di.getMonth(), di.getDate());
    const b = new Date(df.getFullYear(), df.getMonth(), df.getDate());
    const diff = Math.floor((b - a) / 86400000) + 1;
    return diff < 0 ? 0 : diff;
  };

  const getCellText = (r, key) => {
    if (key === "departamento") return r?.depto_desc || r?.depto || "";
    if (key === "cargo") return r?.cargo_desc || r?.cargo || "";
    if (key === "gestor") return r?.gestor || "";
    if (key === "inicio") return getInicioTermino(r).ini;
    if (key === "termino") return getInicioTermino(r).fim;
    if (key === "qtd_dias") {
      const v = getQtdDias(r);
      return v === "" ? "" : String(v);
    }
    if (key === "justificativa")
      return r?.justificativa ?? r?.motivo ?? r?.observacao ?? r?.obs ?? "";
    if (key === "marcacoes") return (r?.marcacoes || []).map((m) => m?.time || "").join(" | ");
    return r?.[key] ?? "";
  };

  const filtered = useMemo(() => {
    const qq = (q || "").trim().toLowerCase();
    const filters = colFilters && typeof colFilters === "object" ? colFilters : {};
    const sel = colFilterValues && typeof colFilterValues === "object" ? colFilterValues : {};
    const hasAnyColFilter = Object.keys(filters).some(
      (k) => String(filters[k] || "").trim().length,
    );
    const hasAnyValueFilter = Object.keys(sel).some((k) => Array.isArray(sel[k]) && sel[k].length);
    if (!qq && !hasAnyColFilter && !hasAnyValueFilter) return safeRows;

    return safeRows.filter((r) => {
      if (qq) {
        const txt =
          `${r?.filial || ""} ${r?.matricula || ""} ${r?.nome || ""} ${r?.depto_desc || r?.depto || ""} ${r?.cargo_desc || r?.cargo || ""} ${r?.gestor || ""}`.toLowerCase();
        if (!txt.includes(qq)) return false;
      }

      if (hasAnyValueFilter) {
        for (const [k, v] of Object.entries(sel)) {
          if (!Array.isArray(v) || !v.length) continue;
          const cell = String(getCellText(r, k) ?? "");
          if (!v.includes(cell)) return false;
        }
      }

      if (hasAnyColFilter) {
        for (const [k, v] of Object.entries(filters)) {
          const fv = String(v || "")
            .trim()
            .toLowerCase();
          if (!fv) continue;
          const cell = String(getCellText(r, k) ?? "").toLowerCase();
          if (!cell.includes(fv)) return false;
        }
      }

      return true;
    });
  }, [rows, q, colFilters, colFilterValues]);

  const getUniqueValues = useCallback(
    (key) => {
      const k = String(key || "");
      const seen = new Set();
      const out = [];
      const src = Array.isArray(rows) ? rows : [];
      for (let i = 0; i < src.length; i++) {
        const r = src[i];
        const v = String(getCellText(r, k) ?? "");
        if (seen.has(v)) continue;
        seen.add(v);
        out.push(v);
        if (out.length >= 2000) break;
      }
      out.sort((a, b) =>
        String(a).localeCompare(String(b), "pt-BR", { numeric: true, sensitivity: "base" }),
      );
      return out;
    },
    [rows],
  );

  const sorted = useMemo(() => {
    const key = sort.key;
    const dir = sort.asc ? 1 : -1;
    const get = (r) => {
      if (key === "departamento") return r?.depto_desc || r?.depto || "";
      if (key === "cargo") return r?.cargo_desc || r?.cargo || "";
      if (key === "gestor") return r?.gestor || "";
      if (key === "marcacoes") return (r?.marcacoes || []).length;
      return r?.[key] ?? "";
    };
    return filtered.slice().sort((a, b) => {
      const av = get(a);
      const bv = get(b);
      if (typeof av === "number" && typeof bv === "number") return (av - bv) * dir;
      return (
        String(av).localeCompare(String(bv), "pt-BR", { numeric: true, sensitivity: "base" }) * dir
      );
    });
  }, [filtered, sort]);

  const formatGroupVal = (v) => {
    if (v == null) return "—";
    if (typeof v === "string") {
      const m = v.match(/\d{1,2}:\d{2}/g);
      return m && m.length ? m.join(" ") : v.trim() || "—";
    }
    if (typeof v === "number" || typeof v === "boolean") return String(v);
    if (Array.isArray(v)) {
      const parts = v
        .map((it) => {
          if (it == null) return "";
          if (typeof it === "string") return it;
          if (typeof it === "object") return String(it.time ?? it.hora ?? it.value ?? "").trim();
          return String(it);
        })
        .filter(Boolean);
      return parts.length ? parts.join(" ") : "—";
    }
    if (typeof v === "object") {
      if (v.time) return String(v.time);
      try {
        return JSON.stringify(v);
      } catch {
        return "—";
      }
    }
    return String(v);
  };

  const getGroupValue = (r, key) => {
    if (!key) return "";
    if (key === "departamento") return r?.depto_desc || r?.depto || "—";
    if (key === "cargo") return r?.cargo_desc || r?.cargo || "—";
    if (key === "gestor") return r?.gestor || "—";
    if (key === "filial") return r?.filial || "—";
    // Agrupar pela coluna "Horários / Marcações" deve usar o horário previsto, não as marcações reais
    if (key === "marcacoes") {
      const hor = r?.horario_dia;
      const parts = String(hor || "").match(/\d{1,2}:\d{2}/g);
      return parts && parts.length ? parts.join(" ") : "—";
    }
    const raw = r?.[key];
    if (raw == null || raw === "") return "—";
    if (typeof raw === "string" || typeof raw === "number" || typeof raw === "boolean") return raw;
    return formatGroupVal(raw);
  };

  const colLabelByKey = useMemo(() => {
    const m = new Map();
    (Array.isArray(colState) ? colState : []).forEach((c) =>
      m.set(String(c.key), String(c.label || c.key)),
    );
    return m;
  }, [colState]);

  const groupKeyLabel = useCallback(
    (k) => {
      const key = String(k || "");
      return colLabelByKey.get(key) || key;
    },
    [colLabelByKey],
  );

  const isGrouped = useCallback(
    (key) => {
      const k = String(key || "");
      return (Array.isArray(groupByKeys) ? groupByKeys : []).includes(k);
    },
    [groupByKeys],
  );

  const toggleGroupKey = useCallback((key) => {
    const k = String(key || "");
    if (!k) return;
    setBusy({ kind: "group", label: "Agrupando dados, aguarde…" });
    requestAnimationFrame(() => {
      setTimeout(() => {
        setGroupByKeys((prev) => {
          const cur = Array.isArray(prev) ? prev.filter(Boolean).map(String) : [];
          const has = cur.includes(k);
          return has ? cur.filter((x) => x !== k) : [...cur, k];
        });
        setCollapsedGroups(new Set());
        setDrillStack([]);
        setPage(1);
        setBusy(null);
      }, 30);
    });
  }, []);

  const moveCol = useCallback((fromKey, toKey) => {
    const from = String(fromKey || "");
    const to = String(toKey || "");
    if (!from || !to || from === to) return;
    setColState((prev) => {
      const arr = Array.isArray(prev) ? prev.slice() : [];
      const fromIdx = arr.findIndex((c) => String(c.key) === from);
      const toIdx = arr.findIndex((c) => String(c.key) === to);
      if (fromIdx < 0 || toIdx < 0) return prev;
      const [item] = arr.splice(fromIdx, 1);
      const insertAt = fromIdx < toIdx ? toIdx - 1 : toIdx;
      arr.splice(insertAt, 0, item);
      return arr;
    });
  }, []);

  const groupedFlat = useMemo(() => {
    const keys = (Array.isArray(groupByKeys) ? groupByKeys : [])
      .map((k) => String(k || ""))
      .filter(Boolean);
    if (keys.length === 0) {
      return {
        total: sorted.length,
        groupIds: [],
        rows: sorted.map((r) => ({ type: "row", row: r })),
      };
    }

    const filters = new Map();
    (Array.isArray(drillStack) ? drillStack : []).forEach((d) => {
      if (d && d.key) filters.set(String(d.key), String(d.value ?? "—"));
    });

    const filteredForDrill = sorted.filter((r) => {
      for (const [k, v] of filters.entries()) {
        const rv = String(getGroupValue(r, k) ?? "—");
        if (rv !== v) return false;
      }
      return true;
    });

    const groupIds = [];
    const flat = [];

    const groupRec = (items, level, pathParts) => {
      const gk = keys[level];
      if (!gk) {
        items.forEach((r) => flat.push({ type: "row", row: r, groupPath: pathParts.join(" > ") }));
        return;
      }

      const map = new Map();
      items.forEach((r) => {
        const g = String(getGroupValue(r, gk) ?? "—");
        if (!map.has(g)) map.set(g, []);
        map.get(g).push(r);
      });

      const gvals = Array.from(map.keys()).sort((a, b) =>
        String(a).localeCompare(String(b), "pt-BR", { numeric: true, sensitivity: "base" }),
      );
      gvals.forEach((gv) => {
        const nextPath = [...pathParts, `${gk}:${gv}`];
        const id = nextPath.join("|");
        groupIds.push(id);
        const sub = map.get(gv) || [];
        flat.push({ type: "group", id, level, key: gk, value: gv, count: sub.length });
        const isCollapsed = collapsedGroups && collapsedGroups.has(id);
        if (!isCollapsed) {
          groupRec(sub, level + 1, nextPath);
        }
      });
    };

    groupRec(filteredForDrill, 0, []);
    return { total: filteredForDrill.length, groupIds, rows: flat };
  }, [sorted, groupByKeys, collapsedGroups, drillStack]);

  const paged = useMemo(() => {
    const size = pageSize === 9999 ? 999999 : pageSize;
    const total = groupedFlat.total;
    const pages = Math.max(1, Math.ceil(groupedFlat.rows.length / Math.max(1, size)));
    const p = Math.min(Math.max(1, page), pages);
    const start = (p - 1) * size;
    const end = start + size;
    return {
      page: p,
      pages,
      total,
      start: total ? start + 1 : 0,
      end: Math.min(groupedFlat.rows.length, end),
      rows: groupedFlat.rows.slice(start, end),
    };
  }, [groupedFlat, page, pageSize]);

  useEffect(() => {
    setPage(1);
  }, [
    q,
    pageSize,
    sort.key,
    sort.asc,
    Array.isArray(groupByKeys) ? groupByKeys.join("|") : "",
    drillStack,
  ]);

  useEffect(() => {
    setCollapsedGroups(new Set());
    setDrillStack([]);
  }, [activeCategory]);

  useEffect(() => {
    setSelected((s) => ({
      r: Math.max(0, Math.min((paged.rows.length || 1) - 1, s.r || 0)),
      c: Math.max(0, Math.min((visibleCols.length || 1) - 1, s.c || 0)),
    }));
  }, [activeCategory, visibleCols.length, paged.rows.length]);

  const mockHorarios = useMemo(() => ["08:00", "12:00", "13:00", "17:00"], []);

  const parseHor = (s) => String(s || "").match(/\d{1,2}:\d{2}/g) || [];
  const renderMarcacoes = (r) => {
    const marks = Array.isArray(r?.marcacoes) ? r.marcacoes : [];
    const fromRow = parseHor(r?.horario_dia);
    const horSlots = (fromRow.length ? fromRow : mockHorarios).slice(0, 4);
    const marcSlots = marks.slice(0, 4);
    const cat = String(activeCategory || "");
    const onlyHor =
      cat === "falta" ||
      cat === "folga" ||
      cat === "ferias" ||
      cat === "entrada_prev" ||
      cat === "afastados";

    return (
      <div className="excel-marc">
        <div className="excel-marc-grid">
          <span className="excel-marc-lbl">HOR:</span>
          {horSlots.map((t) => (
            <span key={t} className="excel-marc-hor">
              {t}
            </span>
          ))}
        </div>
        {onlyHor ? null : (
          <div className="excel-marc-grid">
            <span className="excel-marc-lbl">MARC:</span>
            {marcSlots.length ? (
              marcSlots.map((m, i) => {
                const ok = typeof m?.ok === "boolean" ? m.ok : i % 2 === 0;
                const cls = ok ? "in" : "out";
                return (
                  <span key={`${m?.time || "t"}-${i}`} className={`cell-mark ${cls}`}>
                    {m?.time || "--:--"}
                  </span>
                );
              })
            ) : (
              <span className="cell-mark none">sem</span>
            )}
          </div>
        )}
      </div>
    );
  };

  const toggleVisible = (key) => {
    setVisibleKeys((prev) => {
      const set = new Set(prev);
      if (set.has(key)) {
        if (set.size <= 1) return prev;
        set.delete(key);
      } else {
        set.add(key);
      }
      const ordered = colState.map((c) => c.key).filter((k) => set.has(k));
      return ordered.length ? ordered : prev;
    });
  };

  const resetColumns = () => {
    setColState(colsDefault);
    setVisibleKeys(colsDefault.map((c) => c.key));
  };

  const onCopy = () => {
    const item = paged.rows[selected.r];
    if (!item || item.type !== "row") return;
    const r = item.row;
    const c = visibleCols[selected.c];
    if (!r || !c) return;
    const txt = String(getCellText(r, c.key) ?? "");
    try {
      navigator.clipboard.writeText(txt);
    } catch {}
  };

  // Constrói lista plana espelhando exatamente a visão atual:
  // respeita drill ativo, agrupamentos e estado de colapso de cada grupo
  const buildExportFlat = () => {
    const keys = (Array.isArray(groupByKeys) ? groupByKeys : [])
      .map((k) => String(k || ""))
      .filter(Boolean);

    // Filtro do drill-down ativo (mesma logica do groupedFlat)
    const filters = new Map();
    (Array.isArray(drillStack) ? drillStack : []).forEach((d) => {
      if (d && d.key) filters.set(String(d.key), String(d.value ?? "—"));
    });
    const base =
      filters.size > 0
        ? sorted.filter((r) => {
            for (const [k, v] of filters.entries()) {
              if (String(getGroupValue(r, k) ?? "—") !== v) return false;
            }
            return true;
          })
        : sorted;

    if (!keys.length) return { keys: [], items: base.map((r) => ({ type: "row", row: r })) };

    const items = [];
    const rec = (rows, level, pathParts) => {
      const gk = keys[level];
      if (!gk) {
        rows.forEach((r) => items.push({ type: "row", row: r }));
        return;
      }
      const map = new Map();
      rows.forEach((r) => {
        const g = String(getGroupValue(r, gk) ?? "—");
        if (!map.has(g)) map.set(g, []);
        map.get(g).push(r);
      });
      const gvals = Array.from(map.keys()).sort((a, b) =>
        String(a).localeCompare(String(b), "pt-BR", { numeric: true, sensitivity: "base" }),
      );
      gvals.forEach((gv) => {
        const nextPath = [...pathParts, `${gk}:${gv}`];
        const id = nextPath.join("|");
        const sub = map.get(gv) || [];
        const isCollapsed = collapsedGroups && collapsedGroups.has(id);
        items.push({
          type: "group",
          level,
          key: gk,
          label: groupKeyLabel(gk),
          value: gv,
          count: sub.length,
          collapsed: isCollapsed,
        });
        if (!isCollapsed) rec(sub, level + 1, nextPath);
      });
    };
    rec(base, 0, []);
    return { keys, items };
  };

  const onExportCsv = () => {
    const header = visibleCols.map((c) => c.label);
    const esc = (v) => {
      const s = String(v ?? "");
      if (/\n|\r|"|,|;/.test(s)) return '"' + s.replace(/"/g, '""') + '"';
      return s;
    };
    const { items } = buildExportFlat();
    const lines = [header.join(";")];
    items.forEach((it) => {
      if (it.type === "group") {
        const indent = "  ".repeat(it.level);
        const collapsed = it.collapsed ? " [recolhido]" : "";
        const label = `${indent}? ${it.label}: ${it.value} (${it.count} eventos${collapsed})`;
        const row = [esc(label)].concat(visibleCols.slice(1).map(() => "")).join(";");
        lines.push(row);
      } else {
        lines.push(visibleCols.map((c) => esc(getCellText(it.row, c.key))).join(";"));
      }
    });
    const csv = lines.join("\n");
    // BOM UTF-8 para Excel abrir acentos corretamente
    const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    const dt = new Date().toISOString().slice(0, 10);
    a.download = `posicao_${posListKey}_${dt}.csv`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1500);
  };

  const onExportXlsx = async () => {
    const xlsxMod = await import("xlsx-js-style");
    const XLSX = xlsxMod.default ?? xlsxMod;
    const cat = String(activeCategory || posListKey || "");
    const onlyHor =
      cat === "falta" ||
      cat === "folga" ||
      cat === "ferias" ||
      cat === "entrada_prev" ||
      cat === "afastados";
    const horSlots = ["08:00", "12:00", "13:00", "17:00"];

    // Expandir colunas: marcacoes -> HOR 1..4 (+ MARC 1..4)
    const expandedCols = [];
    visibleCols.forEach((c) => {
      if (c.key === "marcacoes") {
        for (let i = 1; i <= 4; i++) expandedCols.push({ key: `__hor${i}`, label: `HOR ${i}` });
        if (!onlyHor)
          for (let i = 1; i <= 4; i++)
            expandedCols.push({
              key: `__marc${i}`,
              label: `MARC ${i}`,
              isMarc: true,
              idx: i - 1,
            });
      } else {
        expandedCols.push({ key: c.key, label: c.label });
      }
    });

    // Header row
    const aoa = [expandedCols.map((c) => c.label)];

    // Data rows + cell metadata for coloring
    const cellMeta = []; // [{r,c,ok}]
    const groupRowIdxs = []; // indices (1-based) de linhas de grupo para estilizar
    const { items: exportItems } = buildExportFlat();
    let dataCount = 0;
    exportItems.forEach((it) => {
      if (it.type === "group") {
        const indent = "    ".repeat(it.level);
        const label = `${indent}? ${it.label}: ${it.value} (${it.count})`;
        const row = expandedCols.map((_, ci) => (ci === 0 ? label : ""));
        aoa.push(row);
        groupRowIdxs.push(aoa.length - 1);
        return;
      }
      const r = it.row;
      const ri = dataCount;
      const row = expandedCols.map((c, ci) => {
        if (c.key.startsWith("__hor")) {
          const i = Number(c.key.slice(5)) - 1;
          return horSlots[i] || "";
        }
        if (c.isMarc) {
          const m = (r?.marcacoes || [])[c.idx];
          if (!m) return "";
          const ok = typeof m?.ok === "boolean" ? m.ok : c.idx % 2 === 0;
          cellMeta.push({ r: aoa.length, c: ci, ok });
          return m?.time || "";
        }
        if (c.key === "matricula") return String(r?.matricula ?? "");
        return getCellText(r, c.key);
      });
      aoa.push(row);
      dataCount++;
    });

    const ws = XLSX.utils.aoa_to_sheet(aoa);
    const totalRows = aoa.length - 1; // exclui header

    // Forçar matricula como texto
    const matriculaIdx = expandedCols.findIndex((c) => c.key === "matricula");
    if (matriculaIdx >= 0) {
      for (let r = 1; r <= totalRows; r++) {
        if (groupRowIdxs.includes(r)) continue;
        const ref = XLSX.utils.encode_cell({ r, c: matriculaIdx });
        if (ws[ref]) {
          ws[ref].t = "s";
          ws[ref].z = "@";
        }
      }
    }

    // Estilo do header
    const headerStyle = {
      font: { bold: true, color: { rgb: "FFFFFF" } },
      fill: { patternType: "solid", fgColor: { rgb: "334155" } },
      alignment: { horizontal: "center", vertical: "center" },
      border: {
        top: { style: "thin", color: { rgb: "CBD5E1" } },
        bottom: { style: "thin", color: { rgb: "CBD5E1" } },
        left: { style: "thin", color: { rgb: "CBD5E1" } },
        right: { style: "thin", color: { rgb: "CBD5E1" } },
      },
    };
    for (let c = 0; c < expandedCols.length; c++) {
      const ref = XLSX.utils.encode_cell({ r: 0, c });
      if (ws[ref]) ws[ref].s = headerStyle;
    }

    // Estilo das linhas de grupo (faixa cinza, negrito) + merge
    groupRowIdxs.forEach((r) => {
      const ref = XLSX.utils.encode_cell({ r, c: 0 });
      if (ws[ref]) {
        ws[ref].s = {
          font: { bold: true, color: { rgb: "0F172A" } },
          fill: { patternType: "solid", fgColor: { rgb: "E2E8F0" } },
          alignment: { horizontal: "left", vertical: "center" },
        };
      }
      if (expandedCols.length > 1) {
        ws["!merges"] = ws["!merges"] || [];
        ws["!merges"].push({ s: { r, c: 0 }, e: { r, c: expandedCols.length - 1 } });
      }
    });

    // Cores condicionais nas marcações
    cellMeta.forEach(({ r, c, ok }) => {
      const ref = XLSX.utils.encode_cell({ r, c });
      if (!ws[ref]) return;
      ws[ref].s = {
        font: { bold: true, color: { rgb: ok ? "166534" : "991B1B" } },
        fill: { patternType: "solid", fgColor: { rgb: ok ? "DCFCE7" : "FEE2E2" } },
        alignment: { horizontal: "center" },
      };
    });

    // Larguras automáticas
    const cols = expandedCols.map((c, ci) => {
      let w = String(c.label).length;
      for (let r = 1; r <= totalRows; r++) {
        const ref = XLSX.utils.encode_cell({ r, c: ci });
        const v = ws[ref]?.v;
        if (v != null) w = Math.max(w, String(v).length);
      }
      return { wch: Math.min(Math.max(w + 2, 8), 40) };
    });
    ws["!cols"] = cols;

    // Freeze primeira linha + autofiltro (apenas sem agrupamento)
    ws["!freeze"] = { xSplit: 0, ySplit: 1 };
    ws["!views"] = [{ state: "frozen", ySplit: 1 }];
    const lastRef = XLSX.utils.encode_cell({ r: totalRows, c: expandedCols.length - 1 });
    if (!groupRowIdxs.length) ws["!autofilter"] = { ref: `A1:${lastRef}` };
    ws["!ref"] = `A1:${lastRef}`;

    // Aba Resumo
    const labels = {
      presentes: "Presentes",
      falta: "Faltas",
      atraso: "Atrasos",
      folga: "Folgas",
      ferias: "Férias",
      ja_sairam: "Já saíram",
      entrada_prev: "Entrada Prevista",
      nao_controla: "Não controla",
      afastados: "Afastados",
    };
    const filtrosAtivos =
      Object.entries(colFilters || {})
        .filter(([, v]) => String(v || "").trim().length)
        .map(([k, v]) => `${k}: ${v}`)
        .join("; ") || "(nenhum)";
    const resumoData = [
      ["Posição do Dia - Exportação"],
      [],
      ["Categoria", labels[cat] || cat],
      ["Total de registros", sorted.length],
      ["Filtros aplicados", filtrosAtivos],
      ["Busca", q || "(nenhuma)"],
      ["Exportado em", new Date().toLocaleString("pt-BR")],
    ];
    const wsResumo = XLSX.utils.aoa_to_sheet(resumoData);
    wsResumo["!cols"] = [{ wch: 22 }, { wch: 50 }];
    if (wsResumo["A1"]) wsResumo["A1"].s = { font: { bold: true, sz: 14 } };
    for (let r = 2; r <= 6; r++) {
      const ref = `A${r + 1}`;
      if (wsResumo[ref]) wsResumo[ref].s = { font: { bold: true } };
    }

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, wsResumo, "Resumo");
    XLSX.utils.book_append_sheet(wb, ws, labels[cat] || "Posicao");
    const dt = new Date().toISOString().slice(0, 10);
    XLSX.writeFile(wb, `posicao_${cat || posListKey}_${dt}.xlsx`);
  };

  const onExportPdf = () => {
    const esc = (v) =>
      String(v ?? "")
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;");
    const labelsCat = {
      presentes: "Presentes",
      falta: "Faltas",
      atraso: "Atrasos",
      folga: "Folgas",
      ferias: "Férias",
      ja_sairam: "Já saíram",
      entrada_prev: "Entrada Prevista",
      nao_controla: "Não controla",
      afastados: "Afastados",
    };
    const cat = String(activeCategory || "");
    const catLabel = labelsCat[cat] || String(posListKey || "");
    const title = `Posição do Dia — ${catLabel}`;
    const dataRef = dia?.data_referencia
      ? new Date(`${dia.data_referencia}T12:00:00`).toLocaleDateString("pt-BR")
      : "";
    const filtrosAtivos =
      Object.entries(colFilters || {})
        .filter(([, v]) => String(v || "").trim().length)
        .map(([k, v]) => `${k}=${v}`)
        .join(" • ") || "nenhum";
    const cols = visibleCols;
    const onlyHor =
      cat === "falta" ||
      cat === "folga" ||
      cat === "ferias" ||
      cat === "entrada_prev" ||
      cat === "afastados";
    const defHorSlots = mockHorarios.slice(0, 4);
    const head = cols.map((c) => `<th>${esc(c.label)}</th>`).join("");
    const renderMarcCell = (r) => {
      const marks = Array.isArray(r?.marcacoes) ? r.marcacoes.slice(0, 4) : [];
      const fromRow = String(r?.horario_dia || "").match(/\d{1,2}:\d{2}/g) || [];
      const horSlots = (fromRow.length ? fromRow : defHorSlots).slice(0, 4);
      const horLine = `<div class="mc-row"><span class="mc-lbl">HOR:</span>${horSlots.map((t) => `<span class="mc-h">${esc(t)}</span>`).join("")}</div>`;
      if (onlyHor) return horLine;
      const marcLine = marks.length
        ? `<div class="mc-row"><span class="mc-lbl">MARC:</span>${marks
            .map((m, i) => {
              const ok = typeof m?.ok === "boolean" ? m.ok : i % 2 === 0;
              return `<span class="mc-m ${ok ? "in" : "out"}">${esc(m?.time || "--:--")}</span>`;
            })
            .join("")}</div>`
        : `<div class="mc-row"><span class="mc-lbl">MARC:</span><span class="mc-m none">sem</span></div>`;
      return horLine + marcLine;
    };
    const { items: pdfItems } = buildExportFlat();
    const colCount = cols.length;
    const body = pdfItems
      .map((it) => {
        if (it.type === "group") {
          const indent = "&nbsp;&nbsp;".repeat(it.level * 2);
          return `<tr class="grp grp-l${it.level}"><td colspan="${colCount}">${indent}? <b>${esc(it.label)}:</b> ${esc(it.value)} <span class="grp-c">(${it.count})</span></td></tr>`;
        }
        const r = it.row;
        const tds = cols
          .map((c) => {
            if (c.key === "marcacoes") return `<td>${renderMarcCell(r)}</td>`;
            return `<td>${esc(getCellText(r, c.key))}</td>`;
          })
          .join("");
        return `<tr>${tds}</tr>`;
      })
      .join("");

    const html = `<!doctype html>
<html>
<head>
  <meta charset="utf-8" />
  <title>${esc(title)}</title>
  <style>
    @page { size: A4 landscape; margin: 14mm 10mm 14mm 10mm; }
    * { box-sizing: border-box; }
    body { font-family: system-ui, -apple-system, Segoe UI, Roboto, Arial; color: #0f172a; margin: 0; }
    .doc-header { border-bottom: 2px solid #0f172a; padding-bottom: 6px; margin-bottom: 8px; }
    .doc-header .row1 { display: flex; align-items: baseline; justify-content: space-between; gap: 12px; }
    .doc-header h1 { font-size: 14px; margin: 0; }
    .doc-header .meta { font-size: 9px; color: #475569; }
    .doc-header .row2 { display: flex; flex-wrap: wrap; gap: 10px; font-size: 9px; color: #334155; margin-top: 4px; }
    .doc-header .row2 b { color: #0f172a; }
    table { width: 100%; border-collapse: collapse; font-size: 10px; }
    thead { display: table-header-group; }
    tfoot { display: table-footer-group; }
    tr { page-break-inside: avoid; break-inside: avoid; }
    th, td { border: 1px solid #cbd5e1; padding: 4px 6px; text-align: left; vertical-align: top; }
    th { background: #f1f5f9; font-weight: 700; }
    tr:nth-child(even) td { background: #fafafa; }
    tr.grp td { background: #e2e8f0 !important; font-weight: 700; color: #0f172a; padding: 5px 6px; }
    tr.grp-l1 td { background: #eef2f7 !important; }
    tr.grp-l2 td { background: #f1f5f9 !important; }
    tr.grp .grp-c { color: #475569; font-weight: 600; }
    .mc-row { display: flex; flex-wrap: wrap; gap: 3px; align-items: center; line-height: 1.3; }
    .mc-lbl { font-weight: 700; font-size: 9px; color: #475569; min-width: 32px; }
    .mc-h { display: inline-block; padding: 1px 4px; border: 1px solid #cbd5e1; border-radius: 3px; background: #f8fafc; font-size: 9px; }
    .mc-m { display: inline-block; padding: 1px 4px; border-radius: 3px; font-size: 9px; font-weight: 600; }
    .mc-m.in { background: #dcfce7; color: #166534; border: 1px solid #86efac; }
    .mc-m.out { background: #fee2e2; color: #991b1b; border: 1px solid #fca5a5; }
    .mc-m.none { background: #f1f5f9; color: #64748b; border: 1px solid #cbd5e1; }
    .doc-footer { font-size: 9px; color: #475569; text-align: center; margin-top: 6px; }
    @media print { .doc-header { position: running(header); } }
  </style>
</head>
<body>
  <div class="doc-header">
    <div class="row1">
      <h1>${esc(title)}</h1>
      <div class="meta">Gerado em ${esc(new Date().toLocaleString("pt-BR"))}</div>
    </div>
    <div class="row2">
      ${dataRef ? `<span><b>Data:</b> ${esc(dataRef)}</span>` : ""}
      <span><b>Registros:</b> ${sorted.length}</span>
      <span><b>Busca:</b> ${esc(q || "nenhuma")}</span>
      <span><b>Filtros:</b> ${esc(filtrosAtivos)}</span>
    </div>
  </div>
  <table>
    <thead><tr>${head}</tr></thead>
    <tbody>${body}</tbody>
  </table>
  <div class="doc-footer">Macponto Dashboard — ${esc(catLabel)}</div>
</body>
</html>`;

    try {
      const blob = new Blob([html], { type: "text/html;charset=utf-8" });
      const url = URL.createObjectURL(blob);
      const w = window.open(url, "_blank", "noopener,noreferrer");
      if (!w) {
        URL.revokeObjectURL(url);
        return;
      }
      const cleanup = () => {
        try {
          URL.revokeObjectURL(url);
        } catch {}
      };
      w.addEventListener("beforeunload", cleanup);
      w.addEventListener("load", () => {
        try {
          w.focus();
          w.print();
        } catch {
          // ignore
        }
        setTimeout(cleanup, 1500);
      });
    } catch {
      // ignore
    }
  };

  const startResize = (idx, ev) => {
    ev.preventDefault();
    ev.stopPropagation();
    const startX = ev.clientX;
    const key = visibleCols[idx]?.key;
    const colIdx = key ? (colIndexByKey.get(key) ?? -1) : -1;
    if (colIdx < 0) return;
    const startW = colState[colIdx]?.width || 120;
    const move = (e) => {
      const dx = e.clientX - startX;
      setColState((prev) => {
        const next = prev.slice();
        next[colIdx] = { ...next[colIdx], width: Math.max(60, startW + dx) };
        return next;
      });
    };
    const up = () => {
      document.removeEventListener("mousemove", move);
      document.removeEventListener("mouseup", up);
    };
    document.addEventListener("mousemove", move);
    document.addEventListener("mouseup", up);
  };

  const onKeyDown = (e) => {
    if (e.ctrlKey && (e.key === "c" || e.key === "C")) {
      e.preventDefault();
      onCopy();
      return;
    }
    if (e.key === "ArrowDown")
      setSelected((s) => ({ ...s, r: Math.min(paged.rows.length - 1, s.r + 1) }));
    if (e.key === "ArrowUp") setSelected((s) => ({ ...s, r: Math.max(0, s.r - 1) }));
    if (e.key === "ArrowRight")
      setSelected((s) => ({ ...s, c: Math.min(visibleCols.length - 1, s.c + 1) }));
    if (e.key === "ArrowLeft") setSelected((s) => ({ ...s, c: Math.max(0, s.c - 1) }));
  };

  return (
    <div
      style={{ display: "flex", flexDirection: "column", height: "100%" }}
      tabIndex={0}
      onKeyDown={onKeyDown}
    >
      <div
        style={{
          padding: "6px 10px",
          borderBottom: "1px solid var(--border)",
          display: "flex",
          gap: 6,
          alignItems: "center",
          flexWrap: "wrap",
          position: "relative",
        }}
      >
        <input
          type="search"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Buscar…"
          style={{
            flex: 1,
            minWidth: 220,
            padding: "4px 8px",
            borderRadius: 6,
            border: "1px solid var(--border)",
            background: "var(--surface2)",
            color: "var(--text)",
          }}
        />

        {activeCategory === "presentes" ? (
          <input
            type="date"
            value={presentesDate || dia?.data_referencia || ""}
            onChange={(e) => {
              const v = e.target.value || "";
              setPresentesDate(v);
            }}
            style={{
              padding: "4px 8px",
              borderRadius: 6,
              border: "1px solid var(--border)",
              background: "var(--surface2)",
              color: "var(--text)",
            }}
          />
        ) : null}

        <button type="button" className="mh-btn" onClick={() => setColPickerOpen((v) => !v)}>
          Colunas
        </button>
        <div style={{ position: "relative", display: "inline-flex" }} ref={exportMenuRef}>
          <button
            type="button"
            className="mh-btn"
            onClick={() => setExportMenuOpen((v) => !v)}
            aria-haspopup="menu"
            aria-expanded={exportMenuOpen}
            disabled={!!busy}
            title={busy ? busy.label : "Exportar"}
          >
            {busy && (busy.kind || "").startsWith("export-")
              ? `⏳ ${busy.label}`
              : "Exportar ?"}
          </button>
          {exportMenuOpen ? (
            <div
              role="menu"
              style={{
                position: "absolute",
                top: "calc(100% + 4px)",
                right: 0,
                minWidth: 160,
                background: "var(--card)",
                border: "1px solid var(--border)",
                borderRadius: 8,
                boxShadow: "var(--sh-lg)",
                padding: 4,
                zIndex: 60,
                display: "flex",
                flexDirection: "column",
              }}
            >
              <button
                type="button"
                className="mh-btn"
                disabled={!!busy}
                style={{ justifyContent: "flex-start", textAlign: "left" }}
                onClick={() => {
                  setExportMenuOpen(false);
                  runWithBusy("export-csv", "Gerando CSV…", onExportCsv);
                }}
              >
                CSV
              </button>
              <button
                type="button"
                className="mh-btn"
                disabled={!!busy}
                style={{ justifyContent: "flex-start", textAlign: "left" }}
                onClick={() => {
                  setExportMenuOpen(false);
                  runWithBusy("export-xlsx", "Gerando XLSX…", onExportXlsx);
                }}
              >
                XLSX
              </button>
              <button
                type="button"
                className="mh-btn"
                disabled={!!busy}
                style={{ justifyContent: "flex-start", textAlign: "left" }}
                onClick={() => {
                  setExportMenuOpen(false);
                  runWithBusy("export-pdf", "Gerando PDF…", onExportPdf);
                }}
              >
                PDF
              </button>
            </div>
          ) : null}
        </div>
        {isTurnover ? null : (
          <button type="button" className="mh-btn" onClick={() => setBarModalOpen(true)}>
            📊 Gráfico
          </button>
        )}

        {colPickerOpen ? (
          <div
            ref={colPickerRef}
            style={{
              position: "absolute",
              top: "calc(100% + 6px)",
              right: 10,
              width: 260,
              background: "var(--card)",
              border: "1px solid var(--border)",
              borderRadius: 10,
              boxShadow: "var(--sh-lg)",
              padding: 10,
              zIndex: 50,
            }}
          >
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                marginBottom: 8,
              }}
            >
              <div style={{ fontWeight: 900, fontSize: ".72rem", color: "var(--text2)" }}>
                Colunas
              </div>
              <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
                <button
                  type="button"
                  className="mh-btn"
                  onClick={resetColumns}
                  style={{ fontSize: ".62rem", padding: "2px 8px" }}
                >
                  Padrão
                </button>
                <button
                  type="button"
                  className="wm-btn cls"
                  onClick={() => setColPickerOpen(false)}
                  style={{ width: 22, height: 22 }}
                >
                  X
                </button>
              </div>
            </div>
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                gap: 6,
                maxHeight: 280,
                overflow: "auto",
              }}
            >
              {pickableCols.map((c) => (
                <label
                  key={c.key}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 8,
                    cursor: "pointer",
                    fontSize: ".72rem",
                    color: "var(--text2)",
                  }}
                >
                  <input
                    type="checkbox"
                    checked={visibleKeys.includes(c.key)}
                    onChange={() => toggleVisible(c.key)}
                  />
                  <span>{displayColLabel(c)}</span>
                </label>
              ))}
            </div>
          </div>
        ) : null}
      </div>

      <div
        style={{
          padding: "6px 10px",
          borderBottom: "1px solid var(--border)",
          display: "flex",
          gap: 8,
          flexWrap: "wrap",
          alignItems: "center",
          background: "var(--card)",
        }}
      >
        <div style={{ fontSize: ".7rem", fontWeight: 900, color: "var(--muted)" }}>
          Agrupar por:
        </div>
        {groupByKeys && groupByKeys.length ? (
          <>
            <div style={{ display: "flex", gap: 6, flexWrap: "wrap", alignItems: "center" }}>
              {groupByKeys.map((k) => (
                <span
                  key={k}
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: 6,
                    padding: "3px 10px",
                    borderRadius: 999,
                    border: "1px solid var(--border)",
                    background: "var(--surface2)",
                    color: "var(--text2)",
                    fontSize: ".72rem",
                    fontWeight: 900,
                  }}
                >
                  <span>{groupKeyLabel(k)}</span>
                  <button
                    type="button"
                    className="wm-btn cls"
                    onClick={() => toggleGroupKey(k)}
                    style={{ width: 18, height: 18, borderRadius: 999 }}
                  >
                    ×
                  </button>
                </span>
              ))}
            </div>

            <div
              style={{ display: "inline-flex", alignItems: "center", gap: 6, marginLeft: "auto" }}
            >
              <button
                type="button"
                className="mh-btn"
                onClick={() => setCollapsedGroups(new Set(groupedFlat.groupIds || []))}
              >
                Recolher
              </button>
              <button
                type="button"
                className="mh-btn"
                onClick={() => setCollapsedGroups(new Set())}
              >
                Expandir
              </button>
              <button
                type="button"
                className="mh-btn"
                onClick={() => {
                  setGroupByKeys([]);
                  setCollapsedGroups(new Set());
                  setDrillStack([]);
                }}
              >
                Limpar
              </button>
              {drillStack && drillStack.length ? (
                <button
                  type="button"
                  className="mh-btn"
                  onClick={() => setDrillStack((s) => (Array.isArray(s) ? s.slice(0, -1) : []))}
                >
                  ? Voltar
                </button>
              ) : null}
            </div>
          </>
        ) : (
          <div style={{ fontSize: ".72rem", color: "var(--muted)" }}>
            Clique no ícone da coluna para agrupar
          </div>
        )}
      </div>

      {String(activeCategory || "") === "turnover_desligados" ||
      String(activeCategory || "") === "turnover_admitidos" ? (
        <div
          style={{
            padding: "6px 10px",
            borderBottom: "1px solid var(--border)",
            display: "flex",
            gap: 10,
            flexWrap: "wrap",
            alignItems: "center",
            background: "var(--card)",
          }}
        >
          <div style={{ fontSize: ".7rem", fontWeight: 900, color: "var(--muted)" }}>Período:</div>
          <label
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 6,
              fontSize: ".72rem",
              color: "var(--text2)",
              fontWeight: 900,
            }}
          >
            <span>De</span>
            <input
              type="date"
              value={turnoverFrom}
              max={turnoverTo || undefined}
              onChange={(e) => setConsistentTurnoverFrom(e.target.value)}
              style={{
                height: 28,
                padding: "0 10px",
                borderRadius: 10,
                border: "1px solid var(--border)",
                background: "var(--surface2)",
                color: "var(--text)",
              }}
            />
          </label>
          <label
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 6,
              fontSize: ".72rem",
              color: "var(--text2)",
              fontWeight: 900,
            }}
          >
            <span>Até</span>
            <input
              type="date"
              value={turnoverTo}
              min={turnoverFrom || undefined}
              onChange={(e) => setConsistentTurnoverTo(e.target.value)}
              style={{
                height: 28,
                padding: "0 10px",
                borderRadius: 10,
                border: "1px solid var(--border)",
                background: "var(--surface2)",
                color: "var(--text)",
              }}
            />
          </label>
          <button type="button" className="mh-btn" onClick={() => setPage(1)}>
            Consultar
          </button>
        </div>
      ) : (
        <div
          style={{
            padding: "6px 10px",
            borderBottom: "1px solid var(--border)",
            display: "flex",
            gap: 6,
            flexWrap: "wrap",
            alignItems: "center",
            background: "var(--card)",
          }}
        >
          {(categories || []).map((c) => (
            <button
              key={c.key}
              type="button"
              className={`hist-chip ${activeCategory === c.key ? "hc-active" : ""}`}
              onClick={() => onChangeCategory && onChangeCategory(c.key)}
            >
              {c.label} ({c.total})
            </button>
          ))}
          {(() => {
            const n =
              Object.keys(colFilters || {}).filter((k) => String(colFilters[k] || "").trim().length)
                .length +
              Object.keys(colFilterValues || {}).filter(
                (k) => Array.isArray(colFilterValues[k]) && colFilterValues[k].length,
              ).length;
            return n > 0 ? (
              <button
                type="button"
                className="mh-btn"
                onClick={() => {
                  setColFilters({});
                  setColFilterValues({});
                }}
                title="Limpar filtros das colunas"
                style={{ marginLeft: "auto" }}
              >
                🧹 Limpar filtros
                <span
                  style={{
                    marginLeft: 4,
                    padding: "0 6px",
                    borderRadius: 999,
                    background: "var(--primary, #2563eb)",
                    color: "#fff",
                    fontSize: ".6rem",
                    fontWeight: 800,
                  }}
                >
                  {n}
                </span>
              </button>
            ) : null;
          })()}
        </div>
      )}

      <div style={{ flex: 1, overflow: "auto", minHeight: 0, position: "relative" }}>
        {busy ? (
          <div
            role="status"
            aria-live="polite"
            style={{
              position: "sticky",
              top: 0,
              left: 0,
              right: 0,
              zIndex: 50,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              padding: "14px 16px",
              margin: "8px auto",
              maxWidth: 360,
              background: "var(--card, #fff)",
              border: "1px solid var(--border)",
              borderRadius: 10,
              boxShadow: "var(--sh-lg, 0 6px 24px rgba(0,0,0,.18))",
              gap: 10,
              fontSize: ".85rem",
              fontWeight: 700,
              color: "var(--text)",
            }}
          >
            <span
              aria-hidden
              style={{
                width: 16,
                height: 16,
                borderRadius: "50%",
                border: "2px solid var(--border)",
                borderTopColor: "var(--primary, #2563eb)",
                display: "inline-block",
                animation: "pos-spin 0.8s linear infinite",
              }}
            />
            <span>Aguarde, {busy.label}</span>
            <style>{`@keyframes pos-spin { to { transform: rotate(360deg); } }`}</style>
          </div>
        ) : null}
        <table
          style={{
            borderCollapse: "collapse",
            minWidth: "100%",
            width: "max-content",
            tableLayout: "fixed",
          }}
        >
          <thead>
            <tr style={{ position: "sticky", top: 0, background: "var(--thead)", zIndex: 5 }}>
              {visibleCols.map((c, idx) => {
                const sortedOn = sort.key === c.key;
                const canGroup = true;
                const groupedOn = isGrouped(c.key);
                const open = filterOpenKey === c.key;
                const hasTextFilter = String(colFilters?.[c.key] ?? "").trim().length > 0;
                const hasValueFilter =
                  Array.isArray(colFilterValues?.[c.key]) && colFilterValues[c.key].length > 0;
                const hasAnyFilter = hasTextFilter || hasValueFilter;
                return (
                  <th
                    key={c.key}
                    style={{
                      position: "relative",
                      borderBottom: hasAnyFilter
                        ? "2px solid var(--primary, #2563eb)"
                        : "2px solid var(--border)",
                      borderRight: "1px solid var(--border)",
                      padding: "6px 8px",
                      textAlign: "left",
                      fontSize: ".62rem",
                      textTransform: "uppercase",
                      color: hasAnyFilter ? "var(--primary, #2563eb)" : "var(--muted)",
                      fontWeight: 800,
                      width: c.width,
                      minWidth: c.width,
                      userSelect: "none",
                      cursor: "pointer",
                      whiteSpace: "nowrap",
                      background: hasAnyFilter
                        ? "color-mix(in oklab, var(--primary, #2563eb) 12%, transparent)"
                        : undefined,
                    }}
                    onClick={() =>
                      setSort((s) => ({ key: c.key, asc: s.key === c.key ? !s.asc : true }))
                    }
                    onDragOver={(ev) => {
                      if (!dragColKey) return;
                      ev.preventDefault();
                    }}
                    onDrop={(ev) => {
                      if (!dragColKey) return;
                      ev.preventDefault();
                      moveCol(dragColKey, c.key);
                      setDragColKey("");
                    }}
                  >
                    <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
                      <span>{displayColLabel(c)}</span>
                      {canGroup ? (
                        <button
                          type="button"
                          className="mh-btn"
                          draggable
                          onClick={(ev) => {
                            ev.preventDefault();
                            ev.stopPropagation();
                            toggleGroupKey(c.key);
                          }}
                          onDragStart={(ev) => {
                            ev.dataTransfer.effectAllowed = "move";
                            try {
                              ev.dataTransfer.setData("text/plain", String(c.key));
                            } catch {}
                            setDragColKey(String(c.key));
                          }}
                          onDragEnd={() => setDragColKey("")}
                          title={
                            groupedOn
                              ? "Remover agrupamento"
                              : "Agrupar por esta coluna / Arrastar para mover"
                          }
                          style={{
                            fontSize: ".58rem",
                            padding: "1px 6px",
                            borderRadius: 999,
                            opacity: groupedOn ? 1 : 0.65,
                          }}
                        >
                          ?
                        </button>
                      ) : null}

                      <button
                        type="button"
                        className="mh-btn"
                        onClick={(ev) => {
                          ev.preventDefault();
                          ev.stopPropagation();
                          setFilterOpenKey((cur) => {
                            const next = cur === c.key ? "" : c.key;
                            return next;
                          });
                          setFilterValueSearch("");
                        }}
                        title="Filtro"
                        style={{
                          fontSize: ".58rem",
                          padding: "1px 6px",
                          borderRadius: 999,
                          opacity: hasTextFilter || hasValueFilter ? 1 : 0.65,
                        }}
                      >
                        ?
                      </button>
                    </span>
                    <span
                      style={{ marginLeft: 6, opacity: sortedOn ? 1 : 0.4, fontSize: ".58rem" }}
                    >
                      {sortedOn ? (sort.asc ? "?" : "?") : "?"}
                    </span>

                    {open ? (
                      <div
                        data-col-filter-pop={c.key}
                        style={{
                          position: "absolute",
                          top: "calc(100% + 6px)",
                          left: 6,
                          width: 280,
                          background: "var(--card)",
                          border: "1px solid var(--border)",
                          borderRadius: 10,
                          boxShadow: "var(--sh-lg)",
                          padding: 10,
                          zIndex: 60,
                        }}
                        onClick={(ev) => {
                          ev.preventDefault();
                          ev.stopPropagation();
                        }}
                      >
                        <div
                          style={{
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "space-between",
                            marginBottom: 8,
                          }}
                        >
                          <div
                            style={{ fontWeight: 900, fontSize: ".72rem", color: "var(--text2)" }}
                          >
                            Filtro: {displayColLabel(c)}
                          </div>
                          <button
                            type="button"
                            className="wm-btn cls"
                            onClick={() => setFilterOpenKey("")}
                            style={{ width: 22, height: 22 }}
                          >
                            X
                          </button>
                        </div>

                        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                          <input
                            value={String(colFilters?.[c.key] ?? "")}
                            onChange={(e) => {
                              const v = e.target.value;
                              setColFilters((prev) => ({
                                ...(prev && typeof prev === "object" ? prev : {}),
                                [c.key]: v,
                              }));
                            }}
                            placeholder="Contém..."
                            style={{
                              width: "100%",
                              padding: "6px 8px",
                              borderRadius: 8,
                              border: "1px solid var(--border)",
                              background: "var(--surface2)",
                              color: "var(--text)",
                              fontSize: ".75rem",
                              outline: "none",
                            }}
                          />

                          <input
                            value={filterValueSearch}
                            onChange={(e) => setFilterValueSearch(e.target.value)}
                            placeholder="Buscar valores..."
                            style={{
                              width: "100%",
                              padding: "6px 8px",
                              borderRadius: 8,
                              border: "1px solid var(--border)",
                              background: "var(--surface2)",
                              color: "var(--text)",
                              fontSize: ".75rem",
                              outline: "none",
                            }}
                          />

                          <div
                            style={{
                              maxHeight: 220,
                              overflow: "auto",
                              border: "1px solid var(--border)",
                              borderRadius: 8,
                              padding: 6,
                              background: "var(--surface)",
                            }}
                          >
                            {getUniqueValues(c.key)
                              .filter((v) => {
                                const s = String(filterValueSearch || "")
                                  .trim()
                                  .toLowerCase();
                                if (!s) return true;
                                return String(v || "")
                                  .toLowerCase()
                                  .includes(s);
                              })
                              .map((v) => {
                                const arr = Array.isArray(colFilterValues?.[c.key])
                                  ? colFilterValues[c.key]
                                  : [];
                                const checked = arr.includes(v);
                                return (
                                  <label
                                    key={v || "—"}
                                    style={{
                                      display: "flex",
                                      alignItems: "center",
                                      gap: 8,
                                      padding: "3px 4px",
                                      cursor: "pointer",
                                      fontSize: ".72rem",
                                      color: "var(--text2)",
                                    }}
                                  >
                                    <input
                                      type="checkbox"
                                      checked={checked}
                                      onChange={() => {
                                        setColFilterValues((prev) => {
                                          const base = prev && typeof prev === "object" ? prev : {};
                                          const cur = Array.isArray(base[c.key]) ? base[c.key] : [];
                                          const set = new Set(cur);
                                          if (set.has(v)) set.delete(v);
                                          else set.add(v);
                                          const nextArr = Array.from(set);
                                          return { ...base, [c.key]: nextArr };
                                        });
                                      }}
                                    />
                                    <span
                                      style={{
                                        whiteSpace: "nowrap",
                                        overflow: "hidden",
                                        textOverflow: "ellipsis",
                                      }}
                                    >
                                      {v || "—"}
                                    </span>
                                  </label>
                                );
                              })}
                          </div>

                          <div style={{ display: "flex", gap: 6, justifyContent: "flex-end" }}>
                            <button
                              type="button"
                              className="mh-btn"
                              onClick={() => {
                                setColFilters((prev) => {
                                  const base = prev && typeof prev === "object" ? { ...prev } : {};
                                  delete base[c.key];
                                  return base;
                                });
                                setColFilterValues((prev) => {
                                  const base = prev && typeof prev === "object" ? { ...prev } : {};
                                  delete base[c.key];
                                  return base;
                                });
                              }}
                            >
                              Limpar
                            </button>
                          </div>
                        </div>
                      </div>
                    ) : null}

                    <span
                      style={{
                        position: "absolute",
                        right: 0,
                        top: 0,
                        bottom: 0,
                        width: 6,
                        cursor: "col-resize",
                      }}
                      onMouseDown={(ev) => startResize(idx, ev)}
                    />
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody>
            {paged.rows.map((it, ri) => {
              if (it && it.type === "group") {
                const k = String(it.value || "—");
                const id = String(it.id || "");
                const isCollapsed = collapsedGroups && collapsedGroups.has(id);
                return (
                  <tr key={`g-${id || k}-${ri}`}>
                    <td
                      colSpan={Math.max(1, visibleCols.length)}
                      style={{
                        padding: "8px 10px",
                        borderBottom: "1px solid var(--border)",
                        background: "rgba(148,163,184,.10)",
                        fontWeight: 950,
                        color: "var(--text2)",
                        userSelect: "none",
                      }}
                    >
                      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                        <button
                          type="button"
                          className="mh-btn"
                          style={{ fontSize: ".62rem", padding: "2px 8px" }}
                          onClick={() => {
                            setCollapsedGroups((prev) => {
                              const next = new Set(prev || []);
                              if (next.has(id)) next.delete(id);
                              else next.add(id);
                              return next;
                            });
                          }}
                          title={isCollapsed ? "Expandir grupo" : "Recolher grupo"}
                        >
                          {isCollapsed ? "?" : "?"}
                        </button>
                        <div style={{ fontWeight: 950 }}>
                          {k} <span style={{ opacity: 0.7, fontWeight: 800 }}>({it.count})</span>
                        </div>
                        <div style={{ marginLeft: "auto" }}>
                          <button
                            type="button"
                            className="mh-btn"
                            style={{ fontSize: ".62rem", padding: "2px 8px" }}
                            onClick={() => {
                              setDrillStack((prev) => {
                                const cur = Array.isArray(prev) ? prev : [];
                                const next = cur.slice(0, it.level);
                                next.push({ key: it.key, value: it.value });
                                return next;
                              });
                              setPage(1);
                            }}
                            title="Drilldown"
                          >
                            Ver
                          </button>
                        </div>
                      </div>
                    </td>
                  </tr>
                );
              }

              const r = it && it.type === "row" ? it.row : null;
              if (!r) return null;
              return (
                <tr
                  key={`${r?.matricula || r?.nome || "r"}-${ri}`}
                  style={{ background: ri % 2 ? "var(--row-even)" : "transparent" }}
                >
                  {visibleCols.map((c, ci) => {
                    const isSel = selected.r === ri && selected.c === ci;
                    const val = getCellText(r, c.key);
                    return (
                      <td
                        key={c.key}
                        style={{
                          borderBottom: "1px solid var(--border)",
                          borderRight: "1px solid var(--border)",
                          padding: "6px 8px",
                          fontSize: ".72rem",
                          color: "var(--text2)",
                          width: c.width,
                          minWidth: c.width,
                          outline: isSel ? "2px solid var(--c4)" : "none",
                          outlineOffset: -2,
                          background: isSel ? "rgba(59,130,246,.08)" : "transparent",
                          cursor: "default",
                          whiteSpace: "nowrap",
                          overflow: "hidden",
                          textOverflow: "ellipsis",
                        }}
                        onClick={() => setSelected({ r: ri, c: ci })}
                        title={String(val ?? "")}
                      >
                        {c.key === "marcacoes" ? renderMarcacoes(r) : String(val ?? "—")}
                      </td>
                    );
                  })}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <div className="pagination" style={{ borderTop: "1px solid var(--border)" }}>
        <span className="pag-info">
          {paged.total ? `${paged.start}-${paged.end} de ${paged.total}` : "0"}
        </span>
        <div className="pag-btns">
          <button
            className="pag-btn"
            type="button"
            onClick={() => setPage(1)}
            disabled={paged.page <= 1}
          >
            ?
          </button>
          <button
            className="pag-btn"
            type="button"
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            disabled={paged.page <= 1}
          >
            ‹
          </button>
          <span className="pag-pages">
            {paged.page}/{paged.pages}
          </span>
          <button
            className="pag-btn"
            type="button"
            onClick={() => setPage((p) => Math.min(paged.pages, p + 1))}
            disabled={paged.page >= paged.pages}
          >
            ›
          </button>
          <button
            className="pag-btn"
            type="button"
            onClick={() => setPage(paged.pages)}
            disabled={paged.page >= paged.pages}
          >
            ?
          </button>
          <select
            className="pag-size"
            value={pageSize}
            onChange={(e) => setPageSize(parseInt(e.target.value, 10) || 20)}
          >
            <option value={10}>10</option>
            <option value={20}>20</option>
            <option value={50}>50</option>
            <option value={100}>100</option>
            <option value={9999}>Todos</option>
          </select>
        </div>
      </div>
    </div>
  );
}
