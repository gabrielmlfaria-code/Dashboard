function eventLabel(ev) {
  return String(ev?.evento || "Sem evento").trim() || "Sem evento";
}

function colKey(ev) {
  return String(ev?.mat || ev?.nome || "—").trim() || "—";
}

function collectEvents(rows, predicate) {
  const out = [];
  for (const row of rows || []) {
    for (const ev of row._events || []) {
      if (predicate(ev, row)) out.push(ev);
    }
  }
  return out;
}

/** Agrupa eventos por rotulo (contagem + horas + colaboradores unicos). */
export function aggregateEventsByLabel(events) {
  const by = new Map();
  for (const ev of events || []) {
    const label = eventLabel(ev);
    const acc = by.get(label) || { label, count: 0, horas: 0, colaboradores: new Set() };
    acc.count += 1;
    acc.horas += Number(ev.horas) || 0;
    acc.colaboradores.add(colKey(ev));
    by.set(label, acc);
  }
  return [...by.values()]
    .map((x) => ({
      label: x.label,
      count: x.count,
      horas: x.horas,
      colaboradores: x.colaboradores.size,
    }))
    .sort(
      (a, b) => b.count - a.count || b.horas - a.horas || a.label.localeCompare(b.label, "pt-BR"),
    );
}

/** Faltas/atrasos injustificados: categoria Ausentes. */
export function ausentesEventsFromRows(rows) {
  return collectEvents(rows, (ev) => ev._cat === "ausentes");
}

/** Somente faltas, exclui eventos com atraso no nome. */
export function faltaInjustEventsFromRows(rows) {
  return ausentesEventsFromRows(rows).filter((ev) => !/\batraso\b/i.test(eventLabel(ev)));
}

/** Eventos Ausentes classificados como atraso no rotulo. */
export function atrasoEventsFromRows(rows) {
  return ausentesEventsFromRows(rows).filter((ev) => /\batraso\b/i.test(eventLabel(ev)));
}

export function eventColKey(ev) {
  return colKey(ev);
}
