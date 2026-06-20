const normalizeText = (value) =>
  String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toUpperCase();

const AFAST_KEYWORDS = [
  "AFAST",
  "INSS",
  "AUXILIO",
  "AUXÍLIO",
  "DOENCA",
  "DOENÇA",
  "ACIDENTE TRABALHO",
  "LICENCA",
  "LICENÇA",
  "CAT",
  "PREVIDEN",
];

const AUSENCIA_KEYWORDS = ["FALTA", "AUSENT", "ABSENT", "INJUST"];

function* iterEvents(histRows) {
  const rows = Array.isArray(histRows) ? histRows : [];
  for (const row of rows) {
    const events = Array.isArray(row?.events) ? row.events : Array.isArray(row?.eventos) ? row.eventos : [];
    for (const ev of events) {
      yield { row, ev };
    }
  }
}

function eventLabel(ev, row) {
  return [ev?.evento, ev?.desc, ev?.descricao, ev?.categoria, ev?.cod, ev?.codigo, row?.departamento, row?.depto]
    .filter(Boolean)
    .join(" ");
}

function matchesKeywords(text, keywords) {
  const t = normalizeText(text);
  return keywords.some((kw) => t.includes(normalizeText(kw)));
}

/** Indicadores SST cruzados com histórico importado (apoio psicossocial / monitoramento). */
export function buildNr1IndicadoresSst(histRows = []) {
  const rows = Array.isArray(histRows) ? histRows : [];
  if (!rows.length) {
    return {
      hasHist: false,
      diasHist: 0,
      colaboradores: 0,
      eventosAusencia: 0,
      eventosAfastamento: 0,
      deptosAfetados: 0,
      alertas: [],
    };
  }

  const colabs = new Set();
  const deptos = new Set();
  let eventosAusencia = 0;
  let eventosAfastamento = 0;

  for (const row of rows) {
    const mat = row?.mat || row?.matricula || row?.colaborador;
    if (mat) colabs.add(String(mat));
    const depto = row?.departamento || row?.depto;
    if (depto) deptos.add(String(depto));
  }

  for (const { row, ev } of iterEvents(rows)) {
    const label = eventLabel(ev, row);
    if (matchesKeywords(label, AFAST_KEYWORDS)) {
      eventosAfastamento += 1;
      const d = row?.departamento || row?.depto;
      if (d) deptos.add(String(d));
    } else if (matchesKeywords(label, AUSENCIA_KEYWORDS)) {
      eventosAusencia += 1;
    }
  }

  const alertas = [];
  if (eventosAfastamento >= 5) {
    alertas.push(
      `${eventosAfastamento} evento(s) de afastamento/doença detectados — revise fatores psicossociais e ergonomia no PGR.`,
    );
  }
  if (eventosAusencia >= 20) {
    alertas.push(
      `${eventosAusencia} ocorrência(s) de ausência/falta no período — monitore indicadores c27 do checklist GRO.`,
    );
  }
  if (eventosAfastamento === 0 && eventosAusencia === 0) {
    alertas.push(
      "Nenhum evento de ausência/afastamento classificado no histórico — valide categorias em Configurações › Horas.",
    );
  }

  return {
    hasHist: true,
    diasHist: rows.length,
    colaboradores: colabs.size,
    eventosAusencia,
    eventosAfastamento,
    deptosAfetados: deptos.size,
    alertas,
  };
}
