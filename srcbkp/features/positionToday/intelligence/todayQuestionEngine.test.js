import test from "node:test";
import assert from "node:assert/strict";
import { analyzeOperationalStatus } from "./operationStatusEngine.js";
import { answerTodayQuestion } from "./todayQuestionEngine.js";

const sampleData = {
  resumo: { forcaAtual: 381, forcaPrevista: 500 },
  departamentos: [
    { nome: "", forcaAtual: 0, forcaPrevista: 11, ausentes: 1, atrasados: 1 },
    { nome: "AJDA - AJUDANTE 20HS", forcaAtual: 24, forcaPrevista: 32, ausentes: 3 },
    { nome: "MTPA - MANUTENCAO PREDIAL", forcaAtual: 20, forcaPrevista: 27, ausentes: 1 },
  ],
  faltasRows: [
    { nome: "Colaborador A", departamento: "AJDA - AJUDANTE 20HS" },
    { nome: "Colaborador B", departamento: "MTPA - MANUTENCAO PREDIAL" },
  ],
  atrasosRows: [
    { nome: "Colaborador C", departamento: "Sem departamento" },
  ],
};

test("responde a primeira acao com payload acionavel de departamento", () => {
  const analysis = analyzeOperationalStatus(sampleData);
  const answer = answerTodayQuestion("FIRST_ACTION", sampleData, analysis);

  assert.equal(answer.id, "FIRST_ACTION");
  assert.match(answer.summary, /AJDA - AJUDANTE 20HS/);
  assert.equal(answer.actions[0].action, "OPEN_DEPARTMENT");
  assert.equal(answer.actions[0].payload.departamento, "AJDA - AJUDANTE 20HS");
  assert.equal(answer.actions[0].payload.category, "faltas");
});

test("resposta de ausentes usa lista nominal quando disponivel", () => {
  const answer = answerTodayQuestion("TODAY_ABSENT_EMPLOYEES", sampleData);

  assert.equal(answer.id, "TODAY_ABSENT_EMPLOYEES");
  assert.match(answer.summary, /2 colaborador/);
  assert.ok(answer.evidence.some((item) => item.includes("Colaborador A")));
  assert.equal(answer.actions[0].action, "OPEN_EMPLOYEES");
  assert.equal(answer.actions[0].payload.category, "faltas");
});

test("resposta de atrasos abre a categoria correta", () => {
  const answer = answerTodayQuestion("TODAY_DELAYED_EMPLOYEES", sampleData);

  assert.equal(answer.id, "TODAY_DELAYED_EMPLOYEES");
  assert.match(answer.summary, /1 colaborador/);
  assert.equal(answer.actions[0].payload.category, "atrasos");
});
