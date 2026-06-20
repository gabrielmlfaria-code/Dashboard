import test from "node:test";
import assert from "node:assert/strict";
import { normalizarMarcacoes } from "./normalizador.js";

test("normalizador trata virada de meia-noite", () => {
  const marks = normalizarMarcacoes(["22:30", "01:15", "06:00"], "2026-06-01");
  assert.equal(marks.length, 3);
  assert.equal(marks[0].minutes, 22 * 60 + 30);
  assert.equal(marks[1].minutes, 24 * 60 + 75);
  assert.equal(marks[1].cruzouMeiaNoite, true);
  assert.equal(marks[2].dayOffset, 1);
});

test("normalizador aceita array vazio", () => {
  assert.deepEqual(normalizarMarcacoes([], "2026-06-01"), []);
});
