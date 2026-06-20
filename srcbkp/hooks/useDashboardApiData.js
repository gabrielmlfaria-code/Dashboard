import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";

import { AbonosApi } from "../api/abonosApi.js";
import { BancoHorasApi } from "../api/bancoHorasApi.js";
import { FechamentoMensalApi } from "../api/fechamentoMensalApi.js";
import { RadarTrabalhistaApi } from "../api/radarTrabalhistaApi.js";
import { TurnoverApi } from "../api/turnoverApi.js";
import { ApiSources, getApiSource } from "../api/apiMode.js";

const STALE_TIME = 5 * 60_000;

function unwrap(payload) {
  if (payload && typeof payload === "object" && "data" in payload) return payload.data;
  return payload;
}

function rowsFrom(payload, keys = []) {
  const data = unwrap(payload);
  if (Array.isArray(data)) return data;
  if (!data || typeof data !== "object") return [];
  for (const key of ["items", "rows", "departamentos", "eventos", ...keys]) {
    if (Array.isArray(data[key])) return data[key];
  }
  return [];
}

function pick(obj, aliases, fallback = 0) {
  for (const key of aliases) {
    if (obj?.[key] != null && obj[key] !== "") return obj[key];
  }
  return fallback;
}

function num(value) {
  if (typeof value === "number") return Number.isFinite(value) ? value : 0;
  const parsed = Number(String(value ?? "").replace(/\./g, "").replace(",", "."));
  return Number.isFinite(parsed) ? parsed : 0;
}

function min(value) {
  return Math.round(num(value));
}

function enabledFor(moduleName, de, ate) {
  return getApiSource(moduleName) === ApiSources.API && Boolean(de && ate);
}

function monthLabel(value) {
  const text = String(value || "").trim();
  const m = text.match(/^(\d{4})-(\d{2})/);
  if (m) return `${m[2]}/${m[1]}`;
  return text;
}

function monthIndex(label) {
  const m = String(label || "").match(/^(\d{2})\/(\d{4})$/);
  return m ? Number(m[2]) * 12 + Number(m[1]) : 0;
}

function toBancoHorasStats(resumoPayload, departamentosPayload) {
  const resumo = unwrap(resumoPayload) || {};
  const deptRows = rowsFrom(departamentosPayload);
  const saldoAnterior = min(pick(resumo, ["saldoAnteriorMinutos", "saldoAnteriorMin", "saldoAnterior"], 0));
  const credito = min(pick(resumo, ["creditoMinutos", "creditoMin", "credito"], 0));
  const debito = Math.abs(min(pick(resumo, ["debitoMinutos", "debitoMin", "debito"], 0)));
  const saldoProximo = min(
    pick(resumo, ["saldoProximoMinutos", "saldoProximoMin", "saldoProximo", "saldo"], saldoAnterior + credito - debito),
  );

  const topDepartamentosAll = deptRows
    .map((row) => {
      const rowSaldoAnterior = min(pick(row, ["saldoAnteriorMinutos", "saldoAnteriorMin", "saldoAnterior"], 0));
      const rowCredito = min(pick(row, ["creditoMinutos", "creditoMin", "credito"], 0));
      const rowDebito = Math.abs(min(pick(row, ["debitoMinutos", "debitoMin", "debito"], 0)));
      const rowSaldoProximo = min(
        pick(row, ["saldoProximoMinutos", "saldoProximoMin", "saldoProximo", "saldo"], rowSaldoAnterior + rowCredito - rowDebito),
      );
      return {
        label: String(pick(row, ["departamento", "depto", "nome"], "Sem departamento") || "Sem departamento"),
        saldoAnterior: rowSaldoAnterior,
        credito: rowCredito,
        debito: rowDebito,
        saldoProximo: rowSaldoProximo,
        saldoAbs: Math.abs(rowSaldoProximo),
        colaboradores: Math.max(0, Math.round(num(pick(row, ["colaboradores", "qtdColaboradores"], 0)))),
        items: Array.isArray(row.items) ? row.items : [],
      };
    })
    .sort((a, b) => b.saldoAbs - a.saldoAbs || b.credito - a.credito || a.label.localeCompare(b.label, "pt-BR"));

  const positivos = topDepartamentosAll
    .filter((row) => row.saldoProximo > 0)
    .sort((a, b) => b.saldoProximo - a.saldoProximo || a.label.localeCompare(b.label, "pt-BR"))
    .slice(0, 10);
  const negativos = topDepartamentosAll
    .filter((row) => row.saldoProximo < 0)
    .sort((a, b) => a.saldoProximo - b.saldoProximo || a.label.localeCompare(b.label, "pt-BR"))
    .slice(0, 10);

  return {
    saldoAnterior,
    saldoAnteriorKnown: pick(resumo, ["saldoAnteriorMinutos", "saldoAnteriorMin", "saldoAnterior"], null) != null,
    credito,
    debito,
    saldo: saldoProximo,
    saldoProximo,
    ocorrencias: Math.max(0, Math.round(num(pick(resumo, ["ocorrencias", "count", "total"], deptRows.length)))),
    colaboradores: Math.max(0, Math.round(num(pick(resumo, ["colaboradores", "qtdColaboradores"], 0)))),
    source: "api",
    topDepartamentos: positivos.length ? positivos : topDepartamentosAll.slice(0, 10),
    topDepartamentosPositivos: positivos,
    topDepartamentosNegativos: negativos,
  };
}

function toMensalData(payload) {
  const data = unwrap(payload) || {};
  const eventos = rowsFrom(data);
  if (!eventos.length) return null;
  const months = [...new Set(eventos.map((row) => monthLabel(pick(row, ["competencia", "mes", "month"], ""))).filter(Boolean))]
    .sort((a, b) => monthIndex(b) - monthIndex(a));
  const map = new Map();
  for (const row of eventos) {
    const code = String(pick(row, ["codigoEvento", "codigo", "cod"], "") || "").trim();
    const desc = String(pick(row, ["descricaoEvento", "descricao", "evento", "nome"], "") || "").trim();
    const event = code && desc ? `${code} - ${desc}` : desc || code || "Evento";
    const month = monthLabel(pick(row, ["competencia", "mes", "month"], ""));
    const horas = min(pick(row, ["horasMinutos", "minutos", "horas"], 0));
    if (!map.has(event)) map.set(event, { event, byMonth: {}, total: 0 });
    const acc = map.get(event);
    acc.byMonth[month] = (acc.byMonth[month] || 0) + horas;
    acc.total += horas;
  }
  return {
    rows: [...map.values()].sort((a, b) => b.total - a.total || a.event.localeCompare(b.event, "pt-BR")),
    months,
    total: [...map.values()].reduce((sum, row) => sum + row.total, 0),
    eventCount: map.size,
    source: "api",
    importedAt: data.generatedAt || data.importedAt || new Date().toISOString(),
    fileName: "API",
  };
}

function toTurnoverData(payload) {
  const data = unwrap(payload) || {};
  const meses = rowsFrom(data, ["meses", "months"]);
  if (!meses.length) return null;
  const normalized = meses
    .map((row) => ({
      label: monthLabel(pick(row, ["competencia", "mes", "month", "label"], "")),
      desligados: num(pick(row, ["desligados", "demissoes", "terminations"], 0)),
      admitidos: num(pick(row, ["admitidos", "admissoes", "hires"], 0)),
      totalColaboradores: num(pick(row, ["totalColaboradores", "total", "colaboradores"], 0)),
      horistas: num(pick(row, ["horistas"], 0)),
      mensalistas: num(pick(row, ["mensalistas"], 0)),
      estagiarios: num(pick(row, ["estagiarios", "estagiarios"], 0)),
    }))
    .filter((row) => row.label)
    .sort((a, b) => monthIndex(b.label) - monthIndex(a.label));

  const months = normalized.map((row) => row.label);
  const values = (key) => normalized.map((row) => row[key] || 0);
  return {
    months,
    rows: {
      Desligados: values("desligados"),
      Admitidos: values("admitidos"),
      "Total De Colaboradores": values("totalColaboradores"),
      Horistas: values("horistas"),
      Mensalistas: values("mensalistas"),
      Estagiarios: values("estagiarios"),
      "Estagiarios": values("estagiarios"),
    },
    source: "api",
    importedAt: data.generatedAt || data.importedAt || new Date().toISOString(),
  };
}

function toRadarSummary(payload) {
  const data = unwrap(payload) || {};
  const top = data.principalEvento || data.topEvento || {};
  const label = String(pick(top, ["label", "descricao", "evento", "nome"], "") || "").trim();
  const count = Math.max(0, Math.round(num(pick(top, ["count", "ocorrencias", "total"], 0))));
  return {
    ocorrencias: Math.max(0, Math.round(num(pick(data, ["ocorrencias", "totalOcorrencias", "total"], 0)))),
    colaboradores: Math.max(0, Math.round(num(pick(data, ["colaboradores", "colaboradoresImpactados"], 0)))),
    topEvento: label || count ? { label: label || "Evento", count } : null,
    source: "api",
  };
}

function toAbonosStored(resumoPayload, departamentosPayload) {
  const resumo = unwrap(resumoPayload) || {};
  const deptRows = rowsFrom(departamentosPayload);
  const byDept = {};
  for (const row of deptRows) {
    const dept = String(pick(row, ["departamento", "depto", "nome"], "") || "").trim();
    if (!dept) continue;
    const pendentes = Math.max(0, Math.round(num(pick(row, ["pendentes", "abonosPendentes"], 0))));
    const efetuados = Math.max(0, Math.round(num(pick(row, ["efetuados", "abonosEfetuados"], 0))));
    const total = pendentes + efetuados;
    byDept[dept] = {
      pendentes,
      efetuados,
      sla: Math.round(num(pick(row, ["sla", "percentualSla"], total ? (efetuados / total) * 100 : 100))),
    };
  }
  const countPendentes = Math.max(0, Math.round(num(pick(resumo, ["pendentes", "countPendentes"], 0))));
  const countEfetuados = Math.max(0, Math.round(num(pick(resumo, ["efetuados", "countEfetuados"], 0))));
  return {
    source: "api",
    totals: {
      pendentes: countPendentes || Object.values(byDept).reduce((sum, row) => sum + row.pendentes, 0),
      efetuados: countEfetuados || Object.values(byDept).reduce((sum, row) => sum + row.efetuados, 0),
    },
    byDept,
    rows: byDept,
    count: countPendentes,
    importedAt: resumo.generatedAt || resumo.importedAt || new Date().toISOString(),
    fileName: "API",
  };
}

export function useDashboardApiData({ periodo, filialId = "" } = {}) {
  const de = periodo?.de || "";
  const ate = periodo?.ate || "";

  const bancoHorasResumo = useQuery({
    queryKey: ["dashboard-api", "bancoHoras", "resumo", de, ate, filialId],
    queryFn: () => BancoHorasApi.getResumo({ de, ate, filialId }),
    enabled: enabledFor("bancoHoras", de, ate),
    retry: 1,
    staleTime: STALE_TIME,
  });
  const bancoHorasDepartamentos = useQuery({
    queryKey: ["dashboard-api", "bancoHoras", "departamentos", de, ate, filialId],
    queryFn: () => BancoHorasApi.getDepartamentos({ de, ate, filialId, top: 20 }),
    enabled: enabledFor("bancoHoras", de, ate),
    retry: 1,
    staleTime: STALE_TIME,
  });
  const fechamentoMensal = useQuery({
    queryKey: ["dashboard-api", "mensal", de, ate, filialId],
    queryFn: () => FechamentoMensalApi.getEventos({ de, ate, filialId }),
    enabled: enabledFor("mensal", de, ate),
    retry: 1,
    staleTime: STALE_TIME,
  });
  const turnover = useQuery({
    queryKey: ["dashboard-api", "turnover", de, ate, filialId],
    queryFn: () => TurnoverApi.getResumo({ de, ate, filialId }),
    enabled: enabledFor("turnover", de, ate),
    retry: 1,
    staleTime: STALE_TIME,
  });
  const radar = useQuery({
    queryKey: ["dashboard-api", "radar", de, ate, filialId],
    queryFn: () => RadarTrabalhistaApi.getResumo({ de, ate, filialId }),
    enabled: enabledFor("radar", de, ate),
    retry: 1,
    staleTime: STALE_TIME,
  });
  const abonosResumo = useQuery({
    queryKey: ["dashboard-api", "abonos", "resumo", de, ate, filialId],
    queryFn: () => AbonosApi.getResumo({ de, ate, filialId }),
    enabled: enabledFor("abonos", de, ate),
    retry: 1,
    staleTime: STALE_TIME,
  });
  const abonosDepartamentos = useQuery({
    queryKey: ["dashboard-api", "abonos", "departamentos", de, ate, filialId],
    queryFn: () => AbonosApi.getDepartamentos({ de, ate, filialId, top: 20 }),
    enabled: enabledFor("abonos", de, ate),
    retry: 1,
    staleTime: STALE_TIME,
  });

  return useMemo(
    () => ({
      bancoHorasStats:
        bancoHorasResumo.data && bancoHorasDepartamentos.data
          ? toBancoHorasStats(bancoHorasResumo.data, bancoHorasDepartamentos.data)
          : null,
      mensalData: fechamentoMensal.data ? toMensalData(fechamentoMensal.data) : null,
      turnoverData: turnover.data ? toTurnoverData(turnover.data) : null,
      radarSummary: radar.data ? toRadarSummary(radar.data) : null,
      abonosStored:
        abonosResumo.data && abonosDepartamentos.data
          ? toAbonosStored(abonosResumo.data, abonosDepartamentos.data)
          : null,
      isFetching: [
        bancoHorasResumo,
        bancoHorasDepartamentos,
        fechamentoMensal,
        turnover,
        radar,
        abonosResumo,
        abonosDepartamentos,
      ].some((query) => query.isFetching),
      errors: [
        bancoHorasResumo,
        bancoHorasDepartamentos,
        fechamentoMensal,
        turnover,
        radar,
        abonosResumo,
        abonosDepartamentos,
      ]
        .map((query) => query.error)
        .filter(Boolean),
    }),
    [
      abonosDepartamentos,
      abonosResumo,
      bancoHorasDepartamentos,
      bancoHorasResumo,
      fechamentoMensal,
      radar,
      turnover,
    ],
  );
}
