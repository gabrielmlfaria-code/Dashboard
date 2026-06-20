import test from "node:test";
import assert from "node:assert/strict";
import { calcPassivoLinha, eventKind } from "./radarPassivoUtils.js";

test("eventKind enquadra eventos trabalhistas comuns sem depender de score", () => {
  assert.equal(eventKind("MAIS DE 6 HORAS SEM REFEICAO"), "intrajornada");
  assert.equal(eventKind("INTERVALO MENOR QUE 1H"), "intrajornada");
  assert.equal(eventKind("JORNADA MAIOR QUE 10 HS"), "extra");
  assert.equal(eventKind("MAIS DE 2 HORAS EXCEDENTES"), "extra");
  assert.equal(eventKind("DIFERENCA MENOR QUE 1100"), "interjornada");
  assert.equal(eventKind("FALTA DE MARCACAO"), "ponto");
});

test("calcPassivoLinha usa horas reais quando disponiveis", () => {
  const res = calcPassivoLinha(
    { evento: "JORNADA MAIOR QUE 10 HS", ocorrencias: 10, colaboradores: 3, horas: 180 },
    { sh: 20, adicionalHe: 0.5, regime: "pos" },
  );
  assert.equal(res.kind, "extra");
  assert.equal(res.usesFallbackHours, false);
  assert.equal(res.horasMinutos, 180);
  assert.equal(res.horasBase, 3);
  assert.equal(res.passivo, 90);
});

test("calcPassivoLinha usa fallback rastreavel quando horas nao vierem na tabela", () => {
  const res = calcPassivoLinha(
    { evento: "MAIS DE 2 HORAS EXCEDENTES", ocorrencias: 4, colaboradores: 2, horas: 0 },
    { sh: 10, adicionalHe: 0.5, regime: "pos" },
  );
  assert.equal(res.kind, "extra");
  assert.equal(res.usesFallbackHours, true);
  assert.equal(res.horasBase, 8);
  assert.equal(res.passivo, 120);
});

test("calcPassivoLinha calcula ponto por ocorrencia, nao por colaborador", () => {
  const res = calcPassivoLinha(
    { evento: "FALTA DE MARCACAO", ocorrencias: 10, colaboradores: 2, horas: 0 },
    { multaMin: 50 },
  );
  assert.equal(res.kind, "ponto");
  assert.equal(res.formula, "ocorr x multa configurada");
  assert.equal(res.passivo, 500);
});

test("calcPassivoLinha sinaliza ferias como estimativa preliminar", () => {
  const res = calcPassivoLinha(
    { evento: "FERIAS VENCIDAS", ocorrencias: 1, colaboradores: 1, horas: 0 },
    { sh: 10 },
  );
  assert.equal(res.kind, "ferias");
  assert.match(res.formula, /estimativa preliminar/);
});
