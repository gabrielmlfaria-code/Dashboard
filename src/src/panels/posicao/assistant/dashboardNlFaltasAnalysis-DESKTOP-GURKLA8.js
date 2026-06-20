import {
  aggregateEventsByLabel as aggregateEventsByLabelShared,
  ausentesEventsFromRows as ausentesEventsFromRowsShared,
  faltaInjustEventsFromRows as faltaInjustEventsFromRowsShared,
} from "./nlEventUtils.js";
import { normNl as normLabel } from "./nlFormatters.js";

function colKey(ev) {
  return String(ev?.mat || ev?.nome || "—").trim() || "—";
}

function aggregateEventsByLabel(events) {
  return aggregateEventsByLabelShared(events);
}

export function ausentesEventsFromRows(rows) {
  return ausentesEventsFromRowsShared(rows);
}

export function faltaInjustEventsFromRows(rows) {
  return faltaInjustEventsFromRowsShared(rows);
}

const GENERIC_LABEL_RX = [
  /^falta\s*(nao|não)?\s*just/,
  /^falta\s+injust/,
  /^falta\s*$/,
  /^ausent/,
  /^ausencia/,
  /^nao\s+comparec/,
  /^sem\s+justific/,
  /^injustificad[ao]\s*$/,
];

export function isGenericAusenciaEventLabel(label) {
  const n = normLabel(label);
  if (!n || n.length < 4) return true;
  return GENERIC_LABEL_RX.some((rx) => rx.test(n));
}

function toRanking(items, total, { nameKey = "label" } = {}) {
  const max = items[0]?.count || 1;
  return items.map((item) => ({
    name: item[nameKey] || "—",
    count: item.count,
    colaboradores: item.colaboradores ?? null,
    sub: item.dept || item.sub || null,
    sharePct: total > 0 ? (item.count / total) * 100 : 0,
    barPct: max > 0 ? (item.count / max) * 100 : 0,
  }));
}

/**
 * Análise de faltas injustificadas: eventos específicos, deptos, justificativas (quando existem).
 */
export function analyzeFaltasInjustificadas(rows, { soFalta = false } = {}) {
  const events = soFalta ? faltaInjustEventsFromRows(rows) : ausentesEventsFromRows(rows);
  const total = events.length;
  const colaboradores = new Set(events.map(colKey)).size;

  const allEvents = aggregateEventsByLabel(events);
  const specificEvents = allEvents.filter((e) => !isGenericAusenciaEventLabel(e.label));

  const byJust = new Map();
  const byDept = new Map();
  const byColab = new Map();

  for (const ev of events) {
    const just = String(ev.justificativa || "").trim();
    if (just && just !== "—" && !/^sem\s|n\/a|nao informado/i.test(just)) {
      const j = byJust.get(just) || { label: just, count: 0, colaboradores: new Set() };
      j.count += 1;
      j.colaboradores.add(colKey(ev));
      byJust.set(just, j);
    }

    const dept = String(ev.depto_desc || ev.depto || "").trim() || "Sem departamento";
    const d = byDept.get(dept) || { label: dept, count: 0, colaboradores: new Set() };
    d.count += 1;
    d.colaboradores.add(colKey(ev));
    byDept.set(dept, d);

    const ck = colKey(ev);
    const c = byColab.get(ck) || {
      label: String(ev.nome || ck).trim() || ck,
      count: 0,
      dept: String(ev.depto_desc || ev.depto || "").trim(),
    };
    c.count += 1;
    byColab.set(ck, c);
  }

  const topJustificativas = [...byJust.values()]
    .map((x) => ({ label: x.label, count: x.count, colaboradores: x.colaboradores.size }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 5);

  const topDeptos = [...byDept.values()]
    .map((x) => ({ label: x.label, count: x.count, colaboradores: x.colaboradores.size }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 5);

  const topColabs = [...byColab.values()]
    .sort((a, b) => b.count - a.count || a.label.localeCompare(b.label, "pt-BR"))
    .slice(0, 5);

  const onlyGeneric = specificEvents.length === 0 && allEvents.length > 0;
  const topGeneric = allEvents[0]?.label || null;

  return {
    total,
    colaboradores,
    allEvents,
    specificEvents,
    topJustificativas,
    topDeptos,
    topColabs,
    onlyGeneric,
    topGeneric,
    rankingEventos: toRanking(
      specificEvents.length ? specificEvents : allEvents.slice(0, 5),
      total,
    ),
    rankingDeptos: toRanking(topDeptos, total),
    rankingJustificativas: toRanking(topJustificativas, total),
  };
}
