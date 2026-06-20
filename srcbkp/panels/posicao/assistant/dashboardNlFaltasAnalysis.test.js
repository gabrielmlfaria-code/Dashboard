import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  analyzeFaltasInjustificadas,
  isGenericAusenciaEventLabel,
} from "./dashboardNlFaltasAnalysis.js";
import { buildDashboardNlContext } from "./dashboardNlContext.js";
import { answerDashboardNlQuestion } from "./dashboardNlQuery.js";

describe("isGenericAusenciaEventLabel", () => {
  it("marca falta não justificada como genérica", () => {
    assert.equal(isGenericAusenciaEventLabel("FALTA NAO JUSTIFICADA"), true);
    assert.equal(isGenericAusenciaEventLabel("FALTA DIA SEGUINTE"), false);
  });
});

describe("answerTopMotivoFalta", () => {
  const rows = [
    {
      date: "2026-05-01",
      _events: [
        { evento: "FALTA NAO JUSTIFICADA", _cat: "ausentes", mat: "1", nome: "Ana", depto: "RH" },
        { evento: "FALTA NAO JUSTIFICADA", _cat: "ausentes", mat: "2", nome: "Bob", depto: "TI" },
        { evento: "FALTA NAO JUSTIFICADA", _cat: "ausentes", mat: "3", nome: "Cia", depto: "RH" },
      ],
    },
  ];

  it("concentração por departamento quando só há código genérico", () => {
    const ctx = buildDashboardNlContext({ histRows: rows, periodLabel: "7 dias" });
    const res = answerDashboardNlQuestion("onde se concentram as faltas injustificadas", ctx);
    assert.equal(res.intent, "faltas_concentracao");
    assert.equal(res.structured?.variant, "concentration");
    assert.ok(res.structured?.ranking?.length > 0);
  });

  it("pergunta sobre eventos redireciona para concentração", () => {
    const ctx = buildDashboardNlContext({ histRows: rows, periodLabel: "7 dias" });
    const res = answerDashboardNlQuestion("quais eventos concentram as faltas injustificadas", ctx);
    assert.equal(res.intent, "faltas_concentracao");
    assert.match(res.structured?.explanation, /não há tipos de evento distintos/i);
  });
});
