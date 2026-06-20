import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { dedupeColOrder, resolvePosEmbeddedColOrder, resolveVisibleColSet } from "./posicaoHdmEmbeddedCols.js";
import {
  ABSENTEISMO_FORMULA_ID,
  calculateAbsenteismoPct,
  computeModalPeriodTotals,
  computePeriodTotals,
  computeAbsenteismoDayMetric,
  computeAbsenteismoPeriodSummary,
  computeConsecutiveFaltasStats,
  dailyConsecFaltasSeries,
  filterHistRowsByDateRange,
  isEmpFaltaDay,
} from "./radarHoursUtils.js";

describe("computeModalPeriodTotals", () => {
  const rows = [
    {
      date: "2026-05-25",
      total: 10,
      faltas: 1,
      atrasos: 0,
      justificadas: 0,
      presentes: 9,
      horas_planejadas: 480,
      horas_presentes: 450,
      horas_faltas: 30,
      horas_justificadas: 0,
    },
    {
      date: "2026-05-26",
      total: 10,
      faltas: 0,
      atrasos: 0,
      justificadas: 0,
      presentes: 10,
      horas_planejadas: 500,
      horas_presentes: 520,
      horas_faltas: 0,
      horas_justificadas: 0,
    },
    {
      date: "2026-06-01",
      total: 8,
      faltas: 0,
      atrasos: 0,
      justificadas: 0,
      presentes: 8,
      horas_planejadas: 400,
      horas_presentes: 400,
      horas_faltas: 0,
      horas_justificadas: 0,
    },
  ];

  it("filtra por intervalo de datas", () => {
    const scoped = filterHistRowsByDateRange(rows, "2026-05-25", "2026-05-26");
    assert.equal(scoped.length, 2);
  });

  it("usa a mesma regra de computePeriodTotals (trabalhadas capadas por dia)", () => {
    const scoped = filterHistRowsByDateRange(rows, "2026-05-25", "2026-05-26");
    const period = computePeriodTotals(scoped);
    const modal = computeModalPeriodTotals(rows, "2026-05-25", "2026-05-26");
    assert.equal(modal.horasPlan, period.horasPlan);
    assert.equal(modal.horas, period.horasPres);
    assert.equal(modal.horas, 450 + 500);
  });
});

describe("absenteismo shared metrics", () => {
  it("usa a formula oficial horas ausentes / horas planejadas", () => {
    assert.equal(ABSENTEISMO_FORMULA_ID, "ABS_HORAS_AUSENTES_V1");
    assert.equal(
      calculateAbsenteismoPct({
        horasAbs: 267 * 60 + 45,
        horasPlan: 1606 * 60,
        precision: 1,
      }),
      16.7,
    );
  });

  it("nao transforma deficit trabalhado x planejado em absenteismo", () => {
    const row = {
      date: "2026-06-03",
      total: 381,
      faltas: 0,
      atrasos: 0,
      justificadas: 0,
      horas_planejadas: 96360,
      horas_presentes: 42067,
      horas_faltas: 16065,
      horas_atrasos: 0,
      horas_justificadas: 0,
    };
    const day = computeAbsenteismoDayMetric(row);
    assert.equal(day.indexAbsentMin, 16065);
    assert.equal(day.indexRate, 16.7);
    const period = computeAbsenteismoPeriodSummary([row]);
    assert.equal(period.unjustMin, 16065);
    assert.equal(period.periodRate, 16.7);
  });

  it("soma horas ausentes e justificadas na base do indice", () => {
    const row = {
      date: "2026-06-04",
      total: 100,
      faltas: 10,
      atrasos: 0,
      horas_planejadas: 600,
      horas_presentes: 580,
      horas_faltas: 90,
      horas_atrasos: 0,
      horas_justificadas: 30,
    };
    assert.equal(computeAbsenteismoDayMetric(row).indexAbsentMin, 120);
    assert.equal(computeAbsenteismoPeriodSummary([row]).periodRate, 20);
  });
});

describe("computeConsecutiveFaltasStats", () => {
  it("conta colaboradores com 2+ faltas em dias consecutivos", () => {
    const rows = [
      {
        date: "2026-06-01",
        _employees: [
          { mat: "1", cat: "falta", hrsAuse: 480 },
          { mat: "2", cat: "falta", hrsAuse: 480 },
        ],
      },
      {
        date: "2026-06-02",
        _employees: [
          { mat: "1", cat: "falta", hrsAuse: 480 },
          { mat: "2", cat: "presentes", hrsPres: 480 },
        ],
      },
      {
        date: "2026-06-04",
        _employees: [{ mat: "2", cat: "falta", hrsAuse: 480 }],
      },
      {
        date: "2026-06-05",
        _employees: [{ mat: "2", cat: "falta", hrsAuse: 480 }],
      },
    ];

    assert.equal(computeConsecutiveFaltasStats(rows).colaboradores, 2);
    const lista = computeConsecutiveFaltasStats(rows).lista;
    assert.equal(lista.length, 2);
    assert.equal(lista.find((r) => r.mat === "1")?.dias, 2);
    assert.equal(lista.find((r) => r.mat === "2")?.dias, 2);
  });

  it("ignora atraso e falta isolada", () => {
    const rows = [
      {
        date: "2026-06-01",
        _employees: [
          { mat: "3", cat: "atraso", hrsAuse: 30 },
          { mat: "4", cat: "falta", hrsAuse: 480 },
        ],
      },
      {
        date: "2026-06-03",
        _employees: [{ mat: "4", cat: "falta", hrsAuse: 480 }],
      },
    ];

    assert.equal(isEmpFaltaDay({ cat: "atraso", hrsAuse: 30 }), false);
    assert.equal(computeConsecutiveFaltasStats(rows).colaboradores, 0);
  });

  it("gera serie diaria de colaboradores em sequencia", () => {
    const rows = [
      {
        date: "2026-06-01",
        _employees: [{ mat: "1", cat: "falta", hrsAuse: 480 }],
      },
      {
        date: "2026-06-02",
        _employees: [{ mat: "1", cat: "falta", hrsAuse: 480 }],
      },
    ];
    const series = dailyConsecFaltasSeries(rows);
    assert.equal(series[0].value, 0);
    assert.equal(series[1].value, 1);
  });
});

describe("resolveVisibleColSet", () => {
  it("nao reexibe colunas ocultas pelo usuario", () => {
    const defaults = ["mat", "nome", "filial", "depto", "evento"];
    const visible = resolveVisibleColSet(["mat", "nome", "depto"], defaults, defaults);
    assert.equal(visible.has("filial"), false);
    assert.equal(visible.has("evento"), false);
    assert.equal(visible.has("mat"), true);
  });

  it("reexibe apenas colunas novas ausentes no catalogo salvo", () => {
    const defaults = ["mat", "nome", "filial", "cid"];
    const visible = resolveVisibleColSet(["mat", "nome"], ["mat", "nome", "filial"], defaults);
    assert.equal(visible.has("filial"), false);
    assert.equal(visible.has("cid"), true);
  });
});

describe("dedupeColOrder", () => {
  it("remove ids duplicados preservando a primeira ocorrencia", () => {
    assert.deepEqual(
      dedupeColOrder(["mat", "nome", "_cat", "hrsPlan", "_cat", "hrsPlan", "nome"]),
      ["mat", "nome", "_cat", "hrsPlan"],
    );
  });
});

describe("resolvePosEmbeddedColOrder", () => {
  it("nao propaga duplicatas do estado salvo", () => {
    const order = resolvePosEmbeddedColOrder(
      {
        colOrder: ["mat", "nome", "filial", "mat", "depto", "filial", "cargo", "nome"],
      },
      "presentes",
    );
    assert.equal(order.filter((id) => id === "mat").length, 1);
    assert.equal(order.filter((id) => id === "nome").length, 1);
    assert.equal(order.filter((id) => id === "filial").length, 1);
  });
});
