import { inferDeptGroup } from "./radarColabsUtils.js";
import { calcPassivoLinha } from "./radarPassivoUtils.js";
import { riscoDeptLabel } from "../radarHoursUtils.js";
import { riskEventLabel } from "./radarTrabalhistaData.js";

function aggregateDeptEvents(rows) {
  const deptMaps = new Map();
  for (const row of rows || []) {
    for (const ev of row._events || []) {
      if (ev._cat !== "risco") continue;
      const dept = riscoDeptLabel(ev);
      const label = riskEventLabel(ev);
      if (!deptMaps.has(dept)) {
        deptMaps.set(dept, { events: new Map(), colaboradores: new Set() });
      }
      const bucket = deptMaps.get(dept);
      const em = bucket.events;
      if (!em.has(label)) {
        em.set(label, {
          evento: label,
          ocorrencias: 0,
          colaboradores: new Set(),
          horas: 0,
          baseLegal: cleanText(ev?.base_legal || ev?.artigo, "CLT — verificar"),
        });
      }
      const b = em.get(label);
      b.ocorrencias += 1;
      if (ev.mat) {
        b.colaboradores.add(ev.mat);
        bucket.colaboradores.add(ev.mat);
      }
      b.horas += Number(ev.horas) || 0;
    }
  }
  return deptMaps;
}

function summarizeEventMap(em, passivoCfg) {
  let ocorrencias = 0;
  let passivo = 0;
  for (const e of em.values()) {
    ocorrencias += e.ocorrencias;
    const linha = calcPassivoLinha(
      {
        evento: e.evento,
        ocorrencias: e.ocorrencias,
        colaboradores: e.colaboradores.size,
        horas: e.horas,
      },
      passivoCfg,
    );
    passivo += linha.passivo || 0;
  }
  return { ocorrencias, passivo };
}

export const DEPTO_GRUPO_ORDER = [
  "Operações",
  "Logística",
  "Comercial",
  "Administrativo",
  "TI",
];

export const DEPTO_GRUPO_COLORS = {
  Operações: "#ef4444",
  Logística: "#f97316",
  Comercial: "#a855f7",
  Administrativo: "#eab308",
  TI: "#22c55e",
};

function cleanText(v, fallback) {
  const s = String(v ?? "").trim();
  return s || fallback;
}

/** Agrega ocorrências e passivo por departamento (nome completo). */
export function computeDeptSummaries(rows, passivoCfg) {
  const deptMaps = aggregateDeptEvents(rows);
  const list = [...deptMaps.entries()].map(([dept, bucket]) => {
    const { ocorrencias, passivo } = summarizeEventMap(bucket.events, passivoCfg);
      return {
        dept,
        ocorrencias,
        passivo,
        colaboradores: bucket.colaboradores.size,
      };
  });
  const totalOcorr = list.reduce((s, d) => s + d.ocorrencias, 0) || 1;
  return list
    .filter((d) => d.ocorrencias > 0)
    .map((d) => ({ ...d, pct: (d.ocorrencias / totalOcorr) * 100 }))
    .sort(
      (a, b) =>
        b.ocorrencias - a.ocorrencias ||
        b.passivo - a.passivo ||
        a.dept.localeCompare(b.dept, "pt-BR"),
    );
}

/** Agrega ocorrências e passivo por macro-setor. */
export function computeGrupoSummaries(rows, passivoCfg) {
  const eventMaps = new Map(DEPTO_GRUPO_ORDER.map((g) => [g, new Map()]));

  for (const [dept, bucket] of aggregateDeptEvents(rows)) {
    const grupo = inferDeptGroup(dept);
    if (!eventMaps.has(grupo)) continue;
    const target = eventMaps.get(grupo);
    for (const [label, e] of bucket.events) {
      if (!target.has(label)) {
        target.set(label, {
          evento: label,
          ocorrencias: 0,
          colaboradores: new Set(),
          horas: 0,
          baseLegal: e.baseLegal,
        });
      }
      const b = target.get(label);
      b.ocorrencias += e.ocorrencias;
      for (const m of e.colaboradores) b.colaboradores.add(m);
      b.horas += e.horas;
    }
  }

  return DEPTO_GRUPO_ORDER.map((grupo) => {
    const em = eventMaps.get(grupo);
    const { ocorrencias, passivo } = summarizeEventMap(em, passivoCfg);
    return {
      grupo,
      ocorrencias,
      passivo,
      color: DEPTO_GRUPO_COLORS[grupo] || "#818cf8",
    };
  })
    .filter((g) => g.ocorrencias > 0)
    .sort((a, b) => b.ocorrencias - a.ocorrencias);
}
