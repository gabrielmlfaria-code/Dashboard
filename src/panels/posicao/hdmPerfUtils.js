import { parseDateAny } from "./posicaoGridUtils.js";

const COLLATOR_PT = new Intl.Collator("pt-BR");

function dateSortKey(v) {
  const d = parseDateAny(v);
  return d ? d.getTime() : 0;
}

function parseHorarioMin(v) {
  if (!v) return 0;
  const s = String(v)
    .trim()
    .replace(/^[^-]*-\s*/, "");
  const toMin = (t) => {
    const m = String(t || "").match(/^(\d{1,2}):(\d{2})$/);
    return m ? parseInt(m[1], 10) * 60 + parseInt(m[2], 10) : 0;
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

/** Pré-calcula chaves de ordenação (evita localeCompare repetido em 300k+ linhas). */
export function buildEventSortKeys(ev) {
  return {
    nome: String(ev.nome || ev.mat || "").toLowerCase(),
    mat: String(ev.mat || "").toLowerCase(),
    filial: String(ev.filial || "").toLowerCase(),
    depto: String(ev.depto || "").toLowerCase(),
    cargo: String(ev.cargo || "").toLowerCase(),
    genero: String(ev.genero || "").toLowerCase(),
    _cat: String(ev._cat || "").toLowerCase(),
    data: String(ev.data || ""),
    horario: String(ev.horario || "").toLowerCase(),
    hrsPlan: parseHorarioMin(ev.horario),
    marcacao: String(ev.marcacao || "").toLowerCase(),
    cod: String(ev.cod || "").toLowerCase(),
    evento: String(ev.evento || "").toLowerCase(),
    cid: String(ev.cid || "").toLowerCase(),
    cidDescricao: String(ev.cidDescricao || "").toLowerCase(),
    atividade: String(ev.atividade || "").toLowerCase(),
    situacaoDesc: String(ev.situacaoDesc || "").toLowerCase(),
    horas: Number(ev.horas) || 0,
    inicio: dateSortKey(ev.inicio ?? ev.dt_inicio ?? ev.data_inicio),
    termino: dateSortKey(ev.termino ?? ev.dt_termino ?? ev.data_termino),
    qtd_dias: Number(ev.qtd_dias) || 0,
    justificativa: String(ev.justificativa || ev.motivo || "").toLowerCase(),
    saldoAnteriorBH: Number(ev.saldoAnteriorBH) || 0,
    creditoBH: Number(ev.creditoBH) || 0,
    debitoBH: Number(ev.debitoBH) || 0,
    horasPagasBH: Number(ev.horasPagasBH) || 0,
    saldoProximoBH: Number(ev.saldoProximoBH) || 0,
  };
}

export function buildEmpSortKeys(e) {
  const abs = (e.hrsAuse || 0) + (e.hrsJust || 0);
  const absPct = e.hrsPlan > 0 ? (abs / e.hrsPlan) * 100 : 0;
  return {
    nome: String(e.nome || e.mat || "").toLowerCase(),
    mat: String(e.mat || "").toLowerCase(),
    depto: String(e.depto || "").toLowerCase(),
    filial: String(e.filial || "").toLowerCase(),
    genero: String(e.genero || "").toLowerCase(),
    plan: e.hrsPlan || 0,
    pres: e.hrsPres || 0,
    ause: e.hrsAuse || 0,
    just: e.hrsJust || 0,
    extr: e.hrsExtr || 0,
    abs: absPct,
  };
}

function compareSortValues(va, vb, sign) {
  if (typeof va === "number" && typeof vb === "number") {
    if (va === vb) return 0;
    return sign * (va < vb ? -1 : 1);
  }
  const sa = String(va ?? "");
  const sb = String(vb ?? "");
  return sign * COLLATOR_PT.compare(sa, sb);
}

/** Ordena índices in-place logic (retorna novo array de índices). */
export function sortRowIndices(rows, indices, sortKeysByIndex, col, dir) {
  if (!indices.length || !col) return indices;
  const sign = dir === "asc" ? 1 : -1;
  const n = indices.length;
  const decorated = new Array(n);
  for (let j = 0; j < n; j++) {
    const i = indices[j];
    const sk = sortKeysByIndex?.[i];
    const v = sk?.[col] ?? rows[i]?.[col] ?? null;
    decorated[j] = { i, v };
  }
  decorated.sort((a, b) => compareSortValues(a.v, b.v, sign));
  const out = new Array(n);
  for (let j = 0; j < n; j++) out[j] = decorated[j].i;
  return out;
}

function aggregateEvents(rows, indices) {
  let horas = 0;
  let horasPlan = 0;
  let saldoAnteriorBH = 0;
  let creditoBH = 0;
  let debitoBH = 0;
  let horasPagasBH = 0;
  let saldoProximoBH = 0;
  let hasBh = false;
  for (const i of indices) {
    const ev = rows[i];
    horas += ev.horas || 0;
    horasPlan += parseHorarioMin(ev.horario);
    if (
      ev.saldoAnteriorBH != null ||
      ev.creditoBH != null ||
      ev.debitoBH != null ||
      ev.horasPagasBH != null ||
      ev.saldoProximoBH != null
    ) {
      hasBh = true;
      saldoAnteriorBH += Number(ev.saldoAnteriorBH) || 0;
      creditoBH += Number(ev.creditoBH) || 0;
      debitoBH += Number(ev.debitoBH) || 0;
      horasPagasBH += Number(ev.horasPagasBH) || 0;
      saldoProximoBH += Number(ev.saldoProximoBH) || 0;
    }
  }
  const out = { horas, horasPlan };
  if (hasBh) {
    out.saldoAnteriorBH = saldoAnteriorBH;
    out.creditoBH = creditoBH;
    out.debitoBH = debitoBH;
    out.horasPagasBH = horasPagasBH;
    out.saldoProximoBH = saldoProximoBH;
  }
  return out;
}

function aggregateEmps(rows, indices) {
  return {
    hrsPlan: indices.reduce((s, i) => s + (rows[i].hrsPlan || 0), 0),
    hrsPres: indices.reduce((s, i) => s + (rows[i].hrsPres || 0), 0),
    hrsAuse: indices.reduce((s, i) => s + (rows[i].hrsAuse || 0), 0),
    hrsJust: indices.reduce((s, i) => s + (rows[i].hrsJust || 0), 0),
    hrsExtr: indices.reduce((s, i) => s + (rows[i].hrsExtr || 0), 0),
  };
}

/**
 * Árvore de agrupamento por índices (sem duplicar linhas).
 * `scope` = índices das linhas em `rows` a agrupar.
 */
export function buildGroupTreeIndexed(rows, keys, scope, isEventsMode) {
  if (!keys.length) return scope;
  const [key, ...rest] = keys;
  const map = new Map();
  for (const i of scope) {
    const row = rows[i];
    const k = String(row[key] ?? "—");
    if (!map.has(k)) map.set(k, []);
    map.get(k).push(i);
  }
  return [...map.entries()]
    .sort(([a], [b]) => COLLATOR_PT.compare(a, b))
    .map(([lbl, idxs]) => {
      const _agg = isEventsMode ? aggregateEvents(rows, idxs) : aggregateEmps(rows, idxs);
      return {
        _group: true,
        label: lbl,
        colKey: key,
        _count: idxs.length,
        _agg,
        children: rest.length ? buildGroupTreeIndexed(rows, rest, idxs, isEventsMode) : idxs,
      };
    });
}

export function isIndexLeafNode(nodes) {
  return Array.isArray(nodes) && nodes.length > 0 && typeof nodes[0] === "number";
}

export function nodeLeafCount(node) {
  if (Array.isArray(node) && isIndexLeafNode(node)) return node.length;
  if (!node?._group) return 0;
  if (node._count != null) return node._count;
  return nodeLeafCount(node.children);
}
