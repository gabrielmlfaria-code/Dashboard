import { normDateKey } from "./calendarUtils.js";
import { getGridCellText, getInicioTermino } from "./posicaoGridUtils.js";
import { posListUsesPeriodoCols } from "./posicaoHdmEmbeddedCols.js";
import { _inferCatFromEvent, _normText, colaboradoresFromHistForCat, getColaboradoresFromGroup, isAtrasoHistEvent } from "./posicaoImport.js";
import { ABONOS_KIND, abonosDetailRowsToEvents, getAbonosDetailRows } from "./abonosDept.js";
import { matchesDeptoFilter } from "./domain/positionRows.js";

const ABONOS_SHEET_POS_KEYS = new Set(["abonos_pendentes", "abonos_efetuados"]);

function abonosKindFromPosListKey(posListKey) {
  return String(posListKey || "") === "abonos_efetuados"
    ? ABONOS_KIND.efetuados
    : ABONOS_KIND.pendentes;
}

function colabDateIso(c, fallback = "") {
  return (
    normDateKey(
      c?.data ??
        c?.Data ??
        c?.date ??
        c?.Date ??
        c?.data_referencia ??
        c?.dataReferencia ??
        c?.DataReferencia,
    ) || fallback
  );
}

function periodFieldsFromColab(c) {
  if (!c || typeof c !== "object") return {};
  const { iniRaw, fimRaw } = getInicioTermino(c);
  return {
    inicio: normDateKey(iniRaw) || "",
    termino: normDateKey(fimRaw) || "",
    qtd_dias: getGridCellText(c, "qtd_dias"),
    justificativa: getGridCellText(c, "justificativa"),
  };
}

function colabKey(c) {
  if (!c || typeof c !== "object") return "";
  const mat = String(c?.matricula ?? c?.mat ?? "").trim();
  if (mat) return `mat:${mat}`;
  const nome = String(c?.nome || c?.colaborador || "").trim().toLowerCase();
  return nome ? `nome:${nome}` : "";
}

function hasPeriodFields(c) {
  const p = periodFieldsFromColab(c);
  return Boolean(p.inicio || p.termino || p.qtd_dias || p.justificativa);
}

function collectPeriodSources(histRows, cat) {
  const byKey = new Map();
  const rows = Array.isArray(histRows) ? histRows : [];
  rows.forEach((row) => {
    colaboradoresFromHistForCat(row, cat).forEach((c) => {
      if (!hasPeriodFields(c)) return;
      const key = colabKey(c);
      if (key && !byKey.has(key)) byKey.set(key, c);
    });
  });
  return byKey;
}

function hydratePeriodColabs(colabs, histRows, cat) {
  const list = Array.isArray(colabs) ? colabs : [];
  if (!list.length) return list;
  const sources = collectPeriodSources(histRows, cat);
  if (!sources.size) return list;
  return list.map((c) => {
    if (hasPeriodFields(c)) return c;
    const src = sources.get(colabKey(c));
    if (!src) return c;
    const p = periodFieldsFromColab(src);
    return {
      ...c,
      inicio: c.inicio || p.inicio,
      termino: c.termino || p.termino,
      qtd_dias: c.qtd_dias ?? p.qtd_dias,
      justificativa: c.justificativa || p.justificativa,
    };
  });
}

function enrichEventsWithColabPeriod(events, colabs) {
  if (!Array.isArray(events) || !events.length || !Array.isArray(colabs) || !colabs.length) {
    return events;
  }
  const byMat = new Map();
  colabs.forEach((c) => {
    const mat = String(c?.matricula ?? c?.mat ?? "").trim();
    if (mat) byMat.set(mat, c);
  });
  return events.map((ev) => {
    const c = byMat.get(String(ev?.mat ?? ev?.matricula ?? "").trim());
    if (!c) return ev;
    const p = periodFieldsFromColab(c);
    return {
      ...ev,
      inicio: ev.inicio || p.inicio,
      termino: ev.termino || p.termino,
      qtd_dias: ev.qtd_dias ?? p.qtd_dias,
      justificativa: ev.justificativa || p.justificativa,
    };
  });
}

/** Categoria de evento (Horas) usada no HistoricoDayModal. */
export function posCatToEventCat(posKey) {
  const k = String(posKey || "");
  if (k === "presentes") return "presentes";
  if (k === "abonos_pendentes") return "ausentes";
  if (k === "abonos_efetuados") return "justificadas";
  if (k === "falta") return "ausentes";
  if (k === "atraso") return "ausentes";
  if (k === "folga" || k === "ferias" || k === "afastados") return "justificadas";
  return "presentes";
}

/** Pill inicial do HistoricoDayModal ao abrir pela posição do dia. */
export function mapPosListKeyToEvtPill(posKey) {
  const k = String(posKey || "");
  if (k === "presentes") return "presentes";
  if (k === "abonos_pendentes") return "ausentes";
  if (k === "abonos_efetuados") return "justificadas";
  if (k === "falta") return "ausentes";
  if (k === "folga" || k === "ferias" || k === "afastados") return "justificadas";
  return null;
}

const normEventConfigKey = (value) =>
  String(value || "")
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .replace(/[^a-z0-9]+/g, "");

const histEventNameKey = (ev) =>
  normEventConfigKey(
    ev?.evento ||
      ev?.evento_desc ||
      ev?.eventoDescricao ||
      ev?.descricao ||
      ev?.desc_evento ||
      ev?.["evento.descricao"] ||
      ev?.name ||
      "",
  );

const histEventCodeKey = (ev) =>
  normEventConfigKey(
    ev?.cod ||
      ev?.codigo ||
      ev?.codigo_evento ||
      ev?.evento_codigo ||
      ev?.cod_evento ||
      ev?.["evento.codigo"] ||
      "",
  );

const buildBancoHorasConfigSet = (eventCategories = []) => {
  const set = new Set();
  for (const ev of Array.isArray(eventCategories) ? eventCategories : []) {
    if (!ev?.creditoBH && !ev?.debitoBH) continue;
    const name = normEventConfigKey(ev?.name || ev?.label || ev?.evento || "");
    const code = normEventConfigKey(ev?.code || ev?.codigo || ev?.cod || "");
    if (name) set.add(name);
    if (code) set.add(code);
  }
  return set;
};

const isBancoHorasHistEvent = (ev, bancoHorasConfigSet) => {
  if (ev?.creditoBH || ev?.debitoBH) return true;
  const name = histEventNameKey(ev);
  const code = histEventCodeKey(ev);
  if (name && bancoHorasConfigSet?.has(name)) return true;
  if (code && bancoHorasConfigSet?.has(code)) return true;
  return /bancodehoras|creditobh|debitobh/.test(name);
};

const POS_EVENT_LABELS = {
  presentes: "Presente",
  falta: "Falta",
  atraso: "Atraso",
  folga: "Folga",
  ferias: "Férias",
  afastados: "Afastamento",
  ja_saiu: "Já saiu",
  entrada_prev: "Entrada prevista",
  nao_controla: "Não controla ponto",
};

/** Uma linha por colaborador quando não há planilha de eventos. */
export function colaboradoresToSyntheticEvents(colabs, dateIso, posKey) {
  const ref = normDateKey(dateIso) || dateIso || "";
  const cat = posCatToEventCat(posKey);
  const label = POS_EVENT_LABELS[posKey] || "Registro";
  return (Array.isArray(colabs) ? colabs : []).map((c, idx) => ({
    mat: String(c?.matricula ?? c?.mat ?? `${idx}`).trim(),
    nome: String(c?.nome || c?.colaborador || "").trim(),
    filialId: c?.filialId ?? c?.filial_id ?? c?.filial?.id ?? undefined,
    filial: c?.filial || "",
    depto: c?.depto_desc || c?.depto || c?.departamento || "",
    cargo: c?.cargo_desc || c?.cargo || "",
    genero: c?.genero || c?.sexo || "",
    data: colabDateIso(c, ref),
    horario: c?.horario_dia || "",
    marcacao: (c?.marcacoes || []).map((m) => m?.time).filter(Boolean).join(" "),
    cod: "",
    evento: label,
    _cat: cat,
    ...periodFieldsFromColab(c),
  }));
}

export function filterEventsForPosListKey(events, posKey, eventCategories = []) {
  const list = Array.isArray(events) ? events : [];
  const k = String(posKey || "");
  if (k === "banco_horas") {
    const configSet = buildBancoHorasConfigSet(eventCategories);
    return list.filter((ev) => isBancoHorasHistEvent(ev, configSet));
  }
  if (k === "abonos_pendentes") return list.filter((ev) => ev?._cat === "ausentes" || ev?.abonoPendente);
  if (k === "abonos_efetuados") return list.filter((ev) => ev?.abonoEfetuado);
  if (k === "atraso") return list.filter((ev) => isAtrasoHistEvent(ev));
  if (k === "presentes") return list.filter((ev) => ev?._cat === "presentes");
  if (k === "falta") return list.filter((ev) => ev?._cat === "ausentes" && !isAtrasoHistEvent(ev));
  if (k === "folga" || k === "ferias" || k === "afastados") {
    return list.filter((ev) => {
      if (ev?._cat !== "justificadas") return false;
      const inferred = _inferCatFromEvent(
        ev?.cod || ev?.codigo || "",
        ev?.evento || ev?.evento_desc || "",
        Number(ev?.horas || 0) * 60,
      );
      if (inferred === k) return true;
      const label = String(ev?.evento || "").toLowerCase();
      if (k === "ferias" && /f[eé]rias/.test(label)) return true;
      if (k === "afastados" && /afast|licen|atestado|medic|matern|patern/.test(label)) return true;
      if (k === "folga" && /folga/.test(label)) return true;
      return false;
    });
  }
  if (k === "ja_saiu" || k === "entrada_prev" || k === "nao_controla") return list;
  return list;
}

export function flattenHistEvents(histRows, dateFrom = "", dateTo = "") {
  const from = normDateKey(dateFrom) || "";
  const to = normDateKey(dateTo) || from || "";
  const rows = Array.isArray(histRows) ? histRows : [];
  const out = [];
  for (const row of rows) {
    const evs = row?._events;
    if (!Array.isArray(evs) || !evs.length) continue;
    const rowDate = normDateKey(row?.date || row?.data_referencia || row?.data);
    for (const ev of evs) {
      const dk = normDateKey(ev?.data || ev?.date || ev?.data_referencia) || rowDate;
      if (from && dk && dk < from) continue;
      if (to && dk && dk > to) continue;
      out.push(dk && normDateKey(ev?.data) !== dk ? { ...ev, data: dk } : ev);
    }
  }
  return out;
}

/**
 * Eventos + colaboradores para o modal da posição do dia (grid HistoricoDayModal).
 */
export function buildPosListModalData({
  histRows,
  dia,
  dateIso,
  dateFrom = "",
  dateTo = "",
  posListKey,
  filialFilter = "",
  filialFilterLabel = "",
  deptoFilter = "",
  eventCategories = [],
  fpdNomeToId = {},
}) {
  const ref = normDateKey(dateIso) || "";
  const from = normDateKey(dateFrom) || ref;
  const to = normDateKey(dateTo) || from || ref;
  const rows = Array.isArray(histRows) ? histRows : [];

  let events = flattenHistEvents(histRows, from, to);
  if (!events.length && ref) {
    const row = (Array.isArray(histRows) ? histRows : []).find(
      (r) => normDateKey(r?.date || r?.data_referencia) === ref,
    );
    if (row && Array.isArray(row._events)) events = row._events;
  }

  events = filterEventsForPosListKey(events, posListKey, eventCategories);

  const matches = (c) => {
    if (filialFilter) {
      const rowFilialId = c?.filialId ?? c?.filial_id ?? c?.filial?.id ?? c?._raw?.filialId;
      const sameId = rowFilialId != null && String(rowFilialId) === String(filialFilter);
      const sameLegacyLabel =
        rowFilialId == null &&
        filialFilterLabel &&
        _normText(c?.filial || c?.filialNome || "") === _normText(filialFilterLabel);
      if (!sameId && !sameLegacyLabel) return false;
    }
    if (!matchesDeptoFilter(c, deptoFilter, { nomeToId: fpdNomeToId })) return false;
    return true;
  };

  if (filialFilter || deptoFilter) {
    events = events.filter((ev) => matches(ev));
  }

  let employees = [];
  const histRow = (Array.isArray(histRows) ? histRows : []).find(
    (r) => normDateKey(r?.date || r?.data_referencia) === ref,
  );
  if (histRow && Array.isArray(histRow._employees)) {
    employees = histRow._employees;
  }

  if (ABONOS_SHEET_POS_KEYS.has(String(posListKey || ""))) {
    const kind = abonosKindFromPosListKey(posListKey);
    const importedEvents = abonosDetailRowsToEvents(getAbonosDetailRows(null, kind), {
      filialFilter,
      deptoFilter,
      dateFrom: from,
      dateTo: to,
      kind,
    });
    if (importedEvents.length) {
      return {
        events: importedEvents,
        employees: [],
        eventsDateFrom: from,
        eventsDateTo: to,
        label: ref
          ? new Date(`${ref}T12:00:00`).toLocaleDateString("pt-BR", {
              weekday: "short",
              day: "2-digit",
              month: "2-digit",
              year: "2-digit",
            })
          : "Período",
        initialPillFilter: mapPosListKeyToEvtPill(posListKey),
        isEventsMode: true,
      };
    }

    if (kind === ABONOS_KIND.pendentes && !events.length) {
      const synthetic = [];
      for (const row of rows) {
        const rowDate = normDateKey(row?.date || row?.data_referencia || row?.data) || ref;
        if (from && rowDate && rowDate < from) continue;
        if (to && rowDate && rowDate > to) continue;
        ["falta", "atraso"].forEach((cat) => {
          const colabs = colaboradoresFromHistForCat(row, cat).filter(matches);
          synthetic.push(...colaboradoresToSyntheticEvents(colabs, rowDate, cat));
        });
      }
      if (!synthetic.length) {
        ["falta", "atraso"].forEach((cat) => {
          const colabs = getColaboradoresFromGroup(dia?.[cat]).filter(matches);
          synthetic.push(...colaboradoresToSyntheticEvents(colabs, ref, cat));
        });
      }
      events = synthetic;
    }

    return {
      events,
      employees: [],
      eventsDateFrom: from,
      eventsDateTo: to,
      label: ref
        ? new Date(`${ref}T12:00:00`).toLocaleDateString("pt-BR", {
            weekday: "short",
            day: "2-digit",
            month: "2-digit",
            year: "2-digit",
          })
        : "Dia",
      initialPillFilter: mapPosListKeyToEvtPill(posListKey),
      isEventsMode: true,
    };
  }

  if (posListKey === "banco_horas") {
    return {
      events,
      employees: [],
      eventsDateFrom: from,
      eventsDateTo: to,
      label: ref
        ? new Date(`${ref}T12:00:00`).toLocaleDateString("pt-BR", {
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

  let periodColabs = [];
  if (posListUsesPeriodoCols(posListKey)) {
    periodColabs = getColaboradoresFromGroup(dia?.[posListKey]);
    if (!periodColabs.length && histRow) {
      periodColabs = colaboradoresFromHistForCat(histRow, posListKey);
    }
    if (filialFilter || deptoFilter) periodColabs = periodColabs.filter(matches);
    periodColabs = hydratePeriodColabs(periodColabs, histRows, posListKey);
    if (periodColabs.length) {
      events = colaboradoresToSyntheticEvents(periodColabs, ref, posListKey);
    } else if (events.length) {
      events = enrichEventsWithColabPeriod(events, periodColabs);
    }
  }

  if (!events.length) {
    let colabs = periodColabs.length ? periodColabs : getColaboradoresFromGroup(dia?.[posListKey]);
    if (!colabs.length && histRow) colabs = colaboradoresFromHistForCat(histRow, posListKey);
    if (filialFilter || deptoFilter) colabs = colabs.filter(matches);
    events = colaboradoresToSyntheticEvents(colabs, ref, posListKey);
  }

  const label = ref
    ? new Date(`${ref}T12:00:00`).toLocaleDateString("pt-BR", {
        weekday: "short",
        day: "2-digit",
        month: "2-digit",
        year: "2-digit",
      })
    : "Dia";

  return {
    events,
    employees,
    eventsDateFrom: from,
    eventsDateTo: to,
    label,
    initialPillFilter: mapPosListKeyToEvtPill(posListKey),
    isEventsMode: events.length > 0 || posListUsesPeriodoCols(posListKey),
  };
}
