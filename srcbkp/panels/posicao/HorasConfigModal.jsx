import React, { useState, useEffect, useMemo, useCallback } from "react";
import "./HorasConfigModal.css";
import { HorasColumnsEditor } from "./HorasColumnsEditor.jsx";

function HcmSortableTh({ id, label, sortKey, sortDir, onSort, className, style, title }) {
  const active = sortKey === id;
  return (
    <th className={className} style={style}>
      <button
        type="button"
        className={`hcm-th-sort-btn${active ? " is-active" : ""}`}
        onClick={() => onSort(id)}
        title={title || `Ordenar por ${label}`}
        aria-sort={active ? (sortDir === "asc" ? "ascending" : "descending") : "none"}
      >
        <span>{label}</span>
        <span className="hcm-th-sort-ico" aria-hidden>
          {active ? (sortDir === "asc" ? "▲" : "▼") : "⇅"}
        </span>
      </button>
    </th>
  );
}

function compareEvents(a, b, sortKey, sortDir) {
  const dir = sortDir === "asc" ? 1 : -1;
  const tieName = () => a.name.localeCompare(b.name, "pt-BR", { sensitivity: "base" });

  if (sortKey === "name") return dir * tieName();

  if (sortKey === "creditoBH" || sortKey === "debitoBH") {
    const diff = Number(Boolean(a[sortKey])) - Number(Boolean(b[sortKey]));
    return dir * diff || tieName();
  }

  if (sortKey.startsWith("cat_")) {
    const cat = sortKey.slice(4);
    const diff = Number(a.category === cat) - Number(b.category === cat);
    return dir * diff || tieName();
  }

  return tieName();
}

const LS_KEY = "pb_event_categories";
const LS_KEY_COLUMNS = "pb_hour_category_columns";

const CATEGORY_FORMULAS = {
  presentes:
    "Horas Trabalhadas somam apenas eventos classificados como Presentes; colaboradores distintos nessa categoria compõem Quant. Presentes.",
  ausentes:
    "Colaboradores distintos com evento Ausentes — faltas/atrasos injustificados (matrículas únicas).",
  justificadas:
    "Colaboradores distintos com evento Justificadas — atestado, férias, licença etc. (matrículas únicas).",
  extras:
    "Colaboradores distintos com H. Extras — hora extra, banco de horas, plantão (matrículas únicas).",
  risco:
    "Colaboradores distintos com Risco Trabalhista — periculosidade, insalubridade (matrículas únicas).",
  noturnas:
    "Colaboradores distintos com H. Noturnas / adicional noturno (matrículas únicas).",
  ignorar: "Eventos ignorados — não entram nos KPIs nem na soma de Horas Trabalhadas.",
};

export const DEFAULT_HOUR_CATEGORIES = [
  { value: "presentes", label: "Presentes", color: "var(--pb-presentes)", builtin: true },
  { value: "ausentes", label: "Ausentes", color: "var(--pb-faltas)", builtin: true },
  { value: "justificadas", label: "Justificadas", color: "var(--pb-folgas)", builtin: true },
  { value: "extras", label: "H. Extras", color: "var(--pb-atrasos)", builtin: true },
  { value: "risco", label: "Risco Trab.", color: "#f97316", builtin: true },
  { value: "noturnas", label: "H. Noturnas", color: "#8b5cf6", builtin: true },
  { value: "ignorar", label: "Ignorar", color: "var(--pb-text-2, #94a3b8)", builtin: true },
];

/** @deprecated use loadHourCategories() */
export const CATEGORIES = DEFAULT_HOUR_CATEGORIES;

export function loadHourCategories() {
  const defaults = DEFAULT_HOUR_CATEGORIES.map((c) => ({ ...c }));
  try {
    const raw = JSON.parse(localStorage.getItem(LS_KEY_COLUMNS) || "null");
    if (!Array.isArray(raw) || !raw.length) return defaults;

    const byValue = new Map(defaults.map((c) => [c.value, { ...c }]));
    const ordered = [];

    for (const item of raw) {
      const value = String(item?.value || "").trim();
      if (!value) continue;
      const base = byValue.get(value);
      if (base) {
        ordered.push({
          ...base,
          label: String(item.label || base.label).trim() || base.label,
          color: item.color || base.color,
        });
        byValue.delete(value);
      } else {
        ordered.push({
          value,
          label: String(item.label || value).trim() || value,
          color: item.color || "#64748b",
          builtin: false,
        });
      }
    }

    for (const rest of byValue.values()) ordered.push(rest);
    return ordered.length ? ordered : defaults;
  } catch {
    return defaults;
  }
}

export function saveHourCategories(categories) {
  try {
    const payload = (Array.isArray(categories) ? categories : []).map(({ value, label, color }) => ({
      value,
      label,
      color,
    }));
    localStorage.setItem(LS_KEY_COLUMNS, JSON.stringify(payload));
  } catch {}
}

export function hourCategoryLabel(value, categories = loadHourCategories()) {
  const hit = categories.find((c) => c.value === value);
  return hit?.label || value || "—";
}

export const BH_FLAGS = [
  {
    key: "creditoBH",
    label: "Crédito BH",
    color: "#0ea5e9",
    title: "Marca o evento como crédito de Banco de Horas sem alterar a categoria principal.",
  },
  {
    key: "debitoBH",
    label: "Débito BH",
    color: "#f97316",
    title: "Marca o evento como débito de Banco de Horas sem alterar a categoria principal.",
  },
];

export const DEFAULT_EVENTS = [
  { id: "pres_normal", name: "Presença normal", category: "presentes" },
  { id: "he_50", name: "Hora extra 50%", category: "extras" },
  { id: "he_100", name: "Hora extra 100%", category: "extras" },
  { id: "banco_horas", name: "Banco de horas", category: "extras" },
  { id: "banco_horas_credito", name: "Banco de horas crédito", category: "extras", creditoBH: true },
  { id: "banco_horas_debito", name: "Banco de horas débito", category: "justificadas", debitoBH: true },
  { id: "plantao", name: "Plantão", category: "extras" },
  { id: "falta_inj", name: "Falta injustificada", category: "ausentes" },
  { id: "atraso", name: "Atraso", category: "ausentes" },
  { id: "falta_just", name: "Falta justificada", category: "justificadas" },
  { id: "atestado", name: "Atestado médico", category: "justificadas" },
  { id: "licenca", name: "Licença", category: "justificadas" },
  { id: "feriado", name: "Feriado", category: "justificadas" },
  { id: "folga_comp", name: "Folga compensatória", category: "justificadas" },
  { id: "afastamento", name: "Afastamento INSS", category: "justificadas" },
  { id: "ferias", name: "Férias", category: "justificadas" },
  { id: "ad_noturno", name: "Adicional Noturno", category: "noturnas" },
  { id: "noturno", name: "Horas Noturnas", category: "noturnas" },
  { id: "periculosidade", name: "Periculosidade", category: "risco" },
  { id: "insalubridade", name: "Insalubridade", category: "risco" },
];

const normalizeEventConfig = (ev) => ({
  ...ev,
  creditoBH: Boolean(ev?.creditoBH),
  debitoBH: Boolean(ev?.debitoBH),
});

export function loadEventCategories() {
  try {
    const saved = JSON.parse(localStorage.getItem(LS_KEY) || "null");
    if (!Array.isArray(saved)) return DEFAULT_EVENTS.map(normalizeEventConfig);
    const normalizedSaved = saved.map(normalizeEventConfig);
    const byKey = new Set(normalizedSaved.map((e) => _norm(e.name)));
    const missingDefaults = DEFAULT_EVENTS.filter((e) => !byKey.has(_norm(e.name))).map(normalizeEventConfig);
    return missingDefaults.length ? [...normalizedSaved, ...missingDefaults] : normalizedSaved;
  } catch {
    return DEFAULT_EVENTS.map(normalizeEventConfig);
  }
}

function saveEventCategories(events) {
  try {
    localStorage.setItem(LS_KEY, JSON.stringify(events));
  } catch {}
}

/** Substitui toda a lista de eventos pelos nomes importados (todos com categoria 'ignorar'). Retorna a quantidade. */
export function mergeImportedEvents(names) {
  const unique = [...new Set(names.map((n) => String(n).trim()).filter(Boolean))];
  if (!unique.length) return 0;
  const events = unique.map((name) => ({
    id: `imp_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
    name,
    category: "ignorar",
    ..._inferBhFlagsByName(name),
  }));
  saveEventCategories(events);
  return unique.length;
}

const _norm = (s) =>
  String(s || "")
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .replace(/[^a-z0-9]+/g, "");

function _inferCatByName(name) {
  const t = _norm(name);
  if (/falta|ausencia|ausente/.test(t)) return "ausentes";
  if (/noturno|noturna|adicionalnoturno/.test(t)) return "noturnas";
  if (/risco|periculosidade|insalubridade/.test(t)) return "risco";
  if (/bancohoras.*(debito|descont|compens|utiliz|saida|negat)/.test(t)) return "justificadas";
  if (/bancohoras.*credito/.test(t)) return "extras";
  if (/extra|horaextra|bancohoras|plantao|adicional(?!not)/.test(t)) return "extras";
  if (/atestado|licenca|ferias|folga|abono|justific|afastamento/.test(t)) return "justificadas";
  if (/presenca|normal|trabalhad|atraso|antecipada|jornada/.test(t)) return "presentes";
  return "ignorar";
}

function _inferBhFlagsByName(name) {
  const t = _norm(name);
  if (!/bancohoras/.test(t)) return {};
  if (/(debito|descont|compens|utiliz|saida|negat)/.test(t)) return { debitoBH: true };
  if (/credito/.test(t)) return { creditoBH: true };
  return {};
}

/**
 * Adiciona eventos novos (detectados numa importação) à lista existente sem sobrescrever.
 * Eventos já presentes (por nome normalizado) são mantidos com sua categoria atual.
 * Retorna { added, ignored } onde ignored = novos eventos sem categoria conhecida.
 */
export function mergeNewEvents(rawNames) {
  const existing = loadEventCategories();
  const existingKeys = new Set(existing.map((e) => _norm(e.name)));
  const added = [];
  const ignoredNames = [];
  const seen = new Set(existingKeys);
  [...new Set(rawNames.map((n) => String(n).trim()).filter(Boolean))].forEach((name) => {
    const key = _norm(name);
    if (seen.has(key)) return;
    seen.add(key);
    const cat = _inferCatByName(name);
    added.push({
      id: `det_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
      name,
      category: cat,
      ..._inferBhFlagsByName(name),
    });
    if (cat === "ignorar") ignoredNames.push(name);
  });
  if (added.length) saveEventCategories([...existing, ...added]);
  return { added: added.length, ignored: ignoredNames.length, ignoredNames };
}

function buildEventsForSource(sourceNames) {
  const names = [
    ...new Set((Array.isArray(sourceNames) ? sourceNames : []).map((n) => String(n).trim()).filter(Boolean)),
  ];
  if (!names.length) return loadEventCategories();
  const saved = loadEventCategories();
  const savedByName = new Map(saved.map((ev) => [_norm(ev.name), ev]));
  return names.map((name) => {
    const savedEvent = savedByName.get(_norm(name));
    return {
      id:
        savedEvent?.id ||
        `src_${_norm(name) || Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
      name,
      category: savedEvent?.category || _inferCatByName(name),
      creditoBH: Boolean(savedEvent?.creditoBH) || Boolean(_inferBhFlagsByName(name).creditoBH),
      debitoBH: Boolean(savedEvent?.debitoBH) || Boolean(_inferBhFlagsByName(name).debitoBH),
    };
  });
}

export function HorasConfigPanel({
  onClose,
  sourceEventNames = [],
  embedded = false,
}) {
  const [events, setEvents] = useState(() => buildEventsForSource(sourceEventNames));
  const [categories, setCategories] = useState(() => loadHourCategories());
  const [colsEditorOpen, setColsEditorOpen] = useState(false);
  const [newName, setNewName] = useState("");
  const [editingId, setEditingId] = useState(null);
  const [editingName, setEditingName] = useState("");
  const [confirmReset, setConfirmReset] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [sortKey, setSortKey] = useState("name");
  const [sortDir, setSortDir] = useState("asc");
  const categoryValues = useMemo(() => new Set(categories.map((c) => c.value)), [categories]);
  const hasSourceEvents = Array.isArray(sourceEventNames) && sourceEventNames.length > 0;

  const toggleSort = useCallback((key) => {
    setSortDir((prevDir) => (sortKey === key ? (prevDir === "asc" ? "desc" : "asc") : "asc"));
    setSortKey(key);
  }, [sortKey]);

  const visibleEvents = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    let list = events;
    if (q) {
      list = list.filter((e) => String(e.name || "").toLowerCase().includes(q));
    }
    return [...list].sort((a, b) => compareEvents(a, b, sortKey, sortDir));
  }, [events, searchQuery, sortKey, sortDir]);

  // Fecha com Escape
  useEffect(() => {
    const onKey = (e) => {
      if (e.key !== "Escape") return;
      if (colsEditorOpen) return;
      onClose();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose, colsEditorOpen]);

  const updateCategory = (id, cat) => {
    if (!categoryValues.has(cat)) return;
    setEvents((prev) => prev.map((e) => (e.id === id ? { ...e, category: cat } : e)));
  };

  const applyCategories = (nextCategories) => {
    const merged = nextCategories.map((c) => {
      const base = DEFAULT_HOUR_CATEGORIES.find((d) => d.value === c.value);
      return base ? { ...base, label: c.label, color: c.color } : { ...c, builtin: false };
    });
    const nextValues = new Set(merged.map((c) => c.value));
    const removed = categories.filter((c) => !nextValues.has(c.value)).map((c) => c.value);
    setCategories(merged);
    saveHourCategories(merged);
    if (removed.length) {
      const fallback = nextValues.has("ignorar") ? "ignorar" : merged[0]?.value || "ignorar";
      setEvents((prev) =>
        prev.map((e) => (removed.includes(e.category) ? { ...e, category: fallback } : e)),
      );
    }
  };

  const toggleBhFlag = (id, key) =>
    setEvents((prev) =>
      prev.map((e) => {
        if (e.id !== id) return e;
        const checked = !e[key];
        return {
          ...e,
          [key]: checked,
          ...(checked && key === "creditoBH" ? { debitoBH: false } : null),
          ...(checked && key === "debitoBH" ? { creditoBH: false } : null),
        };
      }),
    );

  const deleteEvent = (id) => setEvents((prev) => prev.filter((e) => e.id !== id));

  const addEvent = () => {
    const name = newName.trim();
    if (!name) return;
    setEvents((prev) => [
      ...prev,
      { id: `custom_${Date.now()}`, name, category: "ausentes", ..._inferBhFlagsByName(name) },
    ]);
    setNewName("");
  };

  const startEdit = (ev) => {
    setEditingId(ev.id);
    setEditingName(ev.name);
  };
  const commitEdit = () => {
    const name = editingName.trim();
    if (name) setEvents((prev) => prev.map((e) => (e.id === editingId ? { ...e, name } : e)));
    setEditingId(null);
  };

  const handleSave = () => {
    saveEventCategories(events);
    saveHourCategories(categories);
    onClose?.();
  };
  const handleReset = () => {
    if (confirmReset) {
      setEvents(DEFAULT_EVENTS.map(normalizeEventConfig));
      setCategories(DEFAULT_HOUR_CATEGORIES.map((c) => ({ ...c })));
      try {
        localStorage.removeItem(LS_KEY_COLUMNS);
      } catch {}
      setConfirmReset(false);
    } else setConfirmReset(true);
  };

  const catByValue = Object.fromEntries(categories.map((c) => [c.value, c]));
  const dataColCount = categories.length + BH_FLAGS.length;
  const eventColPct = 24;
  const delColPx = 40;
  const dataColPct = dataColCount > 0 ? (100 - eventColPct) / dataColCount : 0;
  const dataColWidth = `max(44px, ${dataColPct.toFixed(4)}%)`;

  const panel = (
    <>
        <div className="hcm-body">
          <p className="hcm-desc">
            Defina quais eventos pertencem a cada categoria. Isso determina como as horas são
            contabilizadas nas colunas Presentes, Ausentes, Justificadas e H. Extras.
          </p>

          <p className="hcm-source-note">
            {hasSourceEvents
              ? `${events.length.toLocaleString("pt-BR")} tipo(s) de evento na base · exibindo ${visibleEvents.length.toLocaleString("pt-BR")}`
              : "Sem tabela atual com eventos detectados; exibindo lista salva/padrão."}
          </p>

          <div className="hcm-table-shell">
            <div className="hcm-table-toolbar">
              <button
                type="button"
                className="pb-trend-tab hcm-cols-btn"
                onClick={() => setColsEditorOpen(true)}
                title="Renomear ou criar colunas da tabela"
              >
                Colunas
              </button>
              <label className="hcm-search-field">
                <span className="hcm-search-label">Pesquisar</span>
                <input
                  type="search"
                  className="hcm-search-input"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Filtrar por nome do evento…"
                  aria-label="Pesquisar evento"
                />
              </label>
              {searchQuery.trim() ? (
                <button
                  type="button"
                  className="hcm-search-clear"
                  onClick={() => setSearchQuery("")}
                >
                  Limpar
                </button>
              ) : null}
              <span className="hcm-search-meta">
                {visibleEvents.length.toLocaleString("pt-BR")} de{" "}
                {events.length.toLocaleString("pt-BR")} eventos
              </span>
            </div>

            <div className="hcm-table-wrap">
            <table
              className="hcm-table"
              style={{
                "--hcm-cat-count": dataColCount,
                "--hcm-data-col-width": dataColWidth,
                "--hcm-event-col-pct": `${eventColPct}%`,
                "--hcm-del-col-px": `${delColPx}px`,
              }}
            >
              <colgroup>
                <col style={{ width: `${eventColPct}%` }} />
                {categories.map((c) => (
                  <col key={c.value} style={{ width: dataColWidth }} />
                ))}
                {BH_FLAGS.map((flag) => (
                  <col key={flag.key} style={{ width: dataColWidth }} />
                ))}
                <col style={{ width: delColPx }} />
              </colgroup>
              <thead>
                <tr>
                  <HcmSortableTh
                    id="name"
                    label="Evento"
                    sortKey={sortKey}
                    sortDir={sortDir}
                    onSort={toggleSort}
                    className="hcm-th-name"
                    title="Ordenar por nome do evento"
                  />
                  {categories.map((c) => (
                    <HcmSortableTh
                      key={c.value}
                      id={`cat_${c.value}`}
                      label={c.label}
                      sortKey={sortKey}
                      sortDir={sortDir}
                      onSort={toggleSort}
                      className="hcm-th-cat"
                      style={{ color: c.color }}
                      title={`Ordenar por «${c.label}» marcado · ${CATEGORY_FORMULAS[c.value] || c.label}`}
                    />
                  ))}
                  {BH_FLAGS.map((flag) => (
                    <HcmSortableTh
                      key={flag.key}
                      id={flag.key}
                      label={flag.label}
                      sortKey={sortKey}
                      sortDir={sortDir}
                      onSort={toggleSort}
                      className="hcm-th-cat hcm-th-bh"
                      style={{ color: flag.color }}
                      title={flag.title}
                    />
                  ))}
                  <th className="hcm-th-del" aria-label="Ações" />
                </tr>
              </thead>
              <tbody>
                {visibleEvents.length === 0 ? (
                  <tr>
                    <td className="hcm-empty" colSpan={categories.length + BH_FLAGS.length + 2}>
                      Nenhum evento encontrado para esta pesquisa.
                    </td>
                  </tr>
                ) : (
                  visibleEvents.map((ev) => (
                    <tr key={ev.id} className={`hcm-cfg-row cat-${ev.category}`}>
                      <td className="hcm-td-name">
                        {editingId === ev.id ? (
                          <input
                            className="hcm-name-input"
                            value={editingName}
                            autoFocus
                            onChange={(e) => setEditingName(e.target.value)}
                            onBlur={commitEdit}
                            onKeyDown={(e) => {
                              if (e.key === "Enter") commitEdit();
                              if (e.key === "Escape") setEditingId(null);
                            }}
                          />
                        ) : (
                          <span
                            className="hcm-ev-name"
                            onDoubleClick={() => startEdit(ev)}
                            title="Duplo clique para editar"
                          >
                            <span
                              className="hcm-cat-dot"
                              style={{ background: catByValue[ev.category]?.color }}
                              aria-hidden="true"
                            />
                            {ev.name}
                          </span>
                        )}
                      </td>
                      {categories.map((c) => (
                        <td key={c.value} className="hcm-td-radio">
                          <label className="hcm-radio-label" title={c.label}>
                            <input
                              type="radio"
                              name={`cat_${ev.id}`}
                              value={c.value}
                              checked={ev.category === c.value}
                              onChange={() => updateCategory(ev.id, c.value)}
                            />
                            <span className="hcm-radio-pip" style={{ "--cat-color": c.color }} />
                          </label>
                        </td>
                      ))}
                      {BH_FLAGS.map((flag) => (
                        <td key={flag.key} className="hcm-td-radio hcm-td-bh">
                          <label className="hcm-radio-label" title={flag.title}>
                            <input
                              type="checkbox"
                              checked={Boolean(ev[flag.key])}
                              onChange={() => toggleBhFlag(ev.id, flag.key)}
                            />
                            <span
                              className="hcm-radio-pip hcm-check-pip"
                              style={{ "--cat-color": flag.color }}
                            />
                          </label>
                        </td>
                      ))}
                      <td className="hcm-td-del">
                        <button
                          type="button"
                          className="hcm-del-btn"
                          onClick={() => deleteEvent(ev.id)}
                          aria-label={`Remover ${ev.name}`}
                          title="Remover"
                        >
                          ✕
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
            </div>
          </div>

          {/* Adicionar novo evento */}
          <div className="hcm-add-row">
            <input
              type="text"
              className="hcm-add-input"
              placeholder="Nome do novo evento…"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") addEvent();
              }}
            />
            <button
              type="button"
              className="pb-trend-tab hcm-add-btn"
              onClick={addEvent}
              disabled={!newName.trim()}
            >
              + Adicionar
            </button>
          </div>
        </div>

        <div className="hcm-footer">
          <button
            type="button"
            className={`pb-trend-tab hcm-reset-btn${confirmReset ? " is-confirm" : ""}`}
            onClick={handleReset}
            onBlur={() => setConfirmReset(false)}
          >
            {confirmReset ? "Confirmar?" : "Restaurar padrão"}
          </button>
          <div style={{ flex: 1 }} />
          <button type="button" className="pb-trend-tab" onClick={onClose}>
            Cancelar
          </button>
          <button
            type="button"
            className="pb-trend-tab is-active hcm-save-btn"
            onClick={handleSave}
          >
            Salvar
          </button>
        </div>
    </>
  );

  const colsEditor =
    colsEditorOpen ?
      <HorasColumnsEditor
        key={`cols-${categories.length}-${categories.map((c) => c.value).join("|")}`}
        categories={categories}
        onApply={applyCategories}
        onClose={() => setColsEditorOpen(false)}
      />
    : null;

  if (embedded) {
    return (
      <div className="hcm-embedded">
        {panel}
        {colsEditor}
      </div>
    );
  }

  return (
    <div
      className="hcm-overlay"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose?.();
      }}
    >
      <div
        className="hcm-modal"
        role="dialog"
        aria-modal="true"
        aria-label="Configuração de categorias de horas"
      >
        <div className="hcm-header">
          <span className="hcm-title">Categorias de Horas</span>
          <button type="button" className="hcm-close" onClick={onClose} aria-label="Fechar">
            ✕
          </button>
        </div>
        {panel}
        {colsEditor}
      </div>
    </div>
  );
}

export function HorasConfigModal(props) {
  return <HorasConfigPanel {...props} />;
}

export default HorasConfigModal;
