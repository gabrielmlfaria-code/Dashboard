import assert from "node:assert/strict";
import test from "node:test";

import { classifyRiscoEvent } from "./riscoEventClassifier.js";

test("classifyRiscoEvent centraliza kind e base legal", () => {
  assert.deepEqual(classifyRiscoEvent("Jornada excedente sem autorizacao"), {
    kind: "extra",
    baseLegal: "CLT Art. 59",
  });
  assert.deepEqual(classifyRiscoEvent("Marcacao de REP invalida"), {
    kind: "ponto",
    baseLegal: "CLT Art. 74",
  });
  assert.deepEqual(classifyRiscoEvent("Ferias vencidas"), {
    kind: "ferias",
    baseLegal: "CLT Arts. 129-153",
  });
});

test("classifyRiscoEvent preserva base legal explicita do evento", () => {
  assert.deepEqual(
    classifyRiscoEvent("Jornada excedente sem autorizacao", "ACT 2026 clausula 12"),
    {
      kind: "extra",
      baseLegal: "ACT 2026 clausula 12",
    },
  );
});
