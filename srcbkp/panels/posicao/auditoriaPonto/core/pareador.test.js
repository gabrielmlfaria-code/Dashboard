import test from "node:test";
import assert from "node:assert/strict";
import { normalizarMarcacoes } from "./normalizador.js";
import { parearHorarios } from "./pareador.js";

test("pareador identifica ausente e excedente", () => {
  const planejados = normalizarMarcacoes(["08:00", "12:00", "13:00", "17:00"]);
  const marcacoes = normalizarMarcacoes(["08:03", "12:00", "18:10"]);
  const result = parearHorarios(planejados, marcacoes, { janelaPareamentoMaxMinutos: 30 });
  assert.equal(result.filter((item) => item.status === "PAREADO").length, 2);
  assert.equal(result.filter((item) => item.status === "AUSENTE").length, 2);
  assert.equal(result.filter((item) => item.status === "EXCEDENTE").length, 1);
});
