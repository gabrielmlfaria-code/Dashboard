/**
 * Agregações dos cards do bento (banco de horas, saúde preventiva, abonos) para NL.
 */
import { buildAbonosByDept, loadKpiAbonos } from "../abonos/abonosDept.js";

const normalizeSaudeText = (value) =>
  String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toUpperCase();

const SAUDE_KEYWORDS = [
  "HPV",
  "VACINA",
  "VACINACAO",
  "CANCER",
  "MAMA",
  "MAMOGRAF",
  "COLO",
  "UTERO",
  "UTERINO",
  "PAPANIC",
  "PREVENT",
  "PROSTATA",
  "EXAME",
  "CAMPANHA",
  "SAUDE",
];

function isSaudePreventivaEvent(ev) {
  const text = normalizeSaudeText(
    [ev?.evento, ev?.desc, ev?.descricao, ev?.eventoDescricao, ev?.cod, ev?.codigo, ev?.categoria, ev?.tipo].join(
      " ",
    ),
  );
  return SAUDE_KEYWORDS.some((kw) => text.includes(kw));
}

function eventDept(ev, row) {
  return (
    String(
      ev?.departamento ||
        ev?.depto ||
        ev?.depto_desc ||
        ev?.departamentoNome ||
        row?.depto_desc ||
        row?.departamento ||
        row?.depto ||
        "Sem departamento",
    ).trim() || "Sem departamento"
  );
}

function eventColabKey(ev, row) {
  return String(ev?.mat || ev?.matricula || ev?.nome || row?.matricula || "").trim();
}

/** Espelha o card Saúde Preventiva. */
export function buildNlSaudePreventivaStats(rows) {
  const eventMap = new Map();
  const deptMap = new Map();
  const colaboradores = new Set();
  let ocorrencias = 0;

  for (const row of Array.isArray(rows) ?rows : []) {
    for (const ev of row?._events || []) {
      if (!isSaudePreventivaEvent(ev)) continue;
      ocorrencias += 1;
      const label =
        String(ev?.evento || ev?.desc || ev?.descricao || "").trim() || "Evento preventivo";
      const dept = eventDept(ev, row);
      const ck = eventColabKey(ev, row);
      if (ck) colaboradores.add(ck);
      const e = eventMap.get(label) || { label, count: 0 };
      e.count += 1;
      eventMap.set(label, e);
      const d = deptMap.get(dept) || { label: dept, count: 0 };
      d.count += 1;
      deptMap.set(dept, d);
    }
  }

  const byCount = (a, b) => b.count - a.count || a.label.localeCompare(b.label, "pt-BR");
  return {
    ocorrencias,
    colaboradores: colaboradores.size,
    topEvento: [...eventMap.values()].sort(byCount)[0] || null,
    topDepartamento: [...deptMap.values()].sort(byCount)[0] || null,
  };
}

/** Resumo do card Abonos por departamento. */
export function buildNlAbonosSummary(rows, stored = null) {
  const abonosStored = stored ?? (typeof window !== "undefined" ? loadKpiAbonos() : null);
  const built = buildAbonosByDept(null, {
    limit: 10,
    histRows: rows,
    stored: abonosStored,
    useStoredFallback: true,
  });
  return {
    pendentes: built.totals?.pendentes ?? 0,
    efetuados: built.totals?.efetuados ?? 0,
    sla: built.totals?.sla ?? null,
    topDeptos: (built.rows || []).slice(0, 5).map((r) => ({
      dept: r.dept,
      pendentes: r.pendentes,
      sla: r.sla,
    })),
  };
}

/** Normaliza stats do card Banco de Horas vindos do header. */
export function normalizeNlBancoHoras(stats) {
  if (!stats || Number(stats.ocorrencias) <= 0) return null;
  const top = (stats.topDepartamentosPositivos || stats.topDepartamentos || [])[0];
  const topNeg = (stats.topDepartamentosNegativos || [])[0];
  return {
    saldo: Number(stats.saldoProximo ?? stats.saldo) || 0,
    saldoAnterior: Number(stats.saldoAnterior) || 0,
    credito: Number(stats.credito) || 0,
    debito: Number(stats.debito) || 0,
    ocorrencias: Number(stats.ocorrencias) || 0,
    colaboradores: Number(stats.colaboradores) || 0,
    source: stats.source || "events",
    topPositivo: top ?{ label: top.label, saldo: top.saldoProximo } : null,
    topNegativo: topNeg ?{ label: topNeg.label, saldo: topNeg.saldoProximo } : null,
  };
}
