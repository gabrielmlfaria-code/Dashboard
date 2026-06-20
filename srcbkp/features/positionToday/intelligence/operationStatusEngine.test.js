import test from "node:test";
import assert from "node:assert/strict";
import { OPERATION_STATUS, analyzeOperationalStatus } from "./operationStatusEngine.js";

test("classifica como crítica quando a cobertura fica abaixo de 80%", () => {
  const result = analyzeOperationalStatus({
    resumo: { forcaAtual: 70, forcaPrevista: 100 },
    departamentos: [],
  });

  assert.equal(result.operationStatus.code, OPERATION_STATUS.CRITICA);
  assert.equal(result.operationStatus.coveragePct, 70);
});

test("prioriza departamento por déficit, ausências e atrasos", () => {
  const result = analyzeOperationalStatus({
    resumo: { forcaAtual: 90, forcaPrevista: 100 },
    departamentos: [
      { nome: "A", forcaAtual: 10, forcaPrevista: 10, ausentes: 1, atrasados: 0 },
      { nome: "B", forcaAtual: 5, forcaPrevista: 10, ausentes: 0, atrasados: 0 },
      { nome: "C", forcaAtual: 10, forcaPrevista: 10, ausentes: 0, atrasados: 8 },
    ],
  });

  assert.equal(result.affectedDepartments[0].nome, "B");
});

test("sem controle aparece apenas como limitação/contexto, não como anomalia", () => {
  const result = analyzeOperationalStatus({
    resumo: { forcaAtual: 10, forcaPrevista: 10, semControle: 8 },
    departamentos: [{ nome: "Operacao", forcaAtual: 10, forcaPrevista: 10 }],
  });

  assert.equal(result.operationStatus.code, OPERATION_STATUS.NORMAL);
  assert.ok(result.limitations.some((item) => item.includes("Sem controle")));
  assert.ok(result.anomalies.every((item) => !String(item.title).includes("Sem controle")));
});

test("mantem departamentos identificados antes de registros sem departamento", () => {
  const result = analyzeOperationalStatus({
    resumo: { forcaAtual: 381, forcaPrevista: 500 },
    departamentos: [
      { nome: "", forcaAtual: 0, forcaPrevista: 11, ausentes: 1, atrasados: 1 },
      { nome: "AJDA - AJUDANTE 20HS", forcaAtual: 24, forcaPrevista: 32, ausentes: 3 },
      { nome: "MTPA - MANUTENCAO PREDIAL", forcaAtual: 20, forcaPrevista: 27, ausentes: 1 },
    ],
  });

  assert.equal(result.affectedDepartments[0].nome, "AJDA - AJUDANTE 20HS");
  assert.equal(result.affectedDepartments[1].nome, "MTPA - MANUTENCAO PREDIAL");
  assert.equal(result.affectedDepartments[2].nome, "Sem departamento informado");
  assert.equal(result.recommendedFirstAction.payload.category, "faltas");
  assert.ok(result.dataQualityWarnings.some((item) => item.includes("sem departamento")));
  assert.ok(result.diagnosis.includes("AJDA - AJUDANTE 20HS"));
});
