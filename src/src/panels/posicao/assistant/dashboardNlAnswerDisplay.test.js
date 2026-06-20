import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { buildAnswerDisplay } from "./dashboardNlAnswerDisplay.js";

describe("buildAnswerDisplay legacy metrics", () => {
  it("usa rótulos semânticos para abs_indice", () => {
    const display = buildAnswerDisplay({
      intent: "abs_indice",
      text: [
        "O índice de absenteísmo do período **Últimos 7 dias** é **10.5%** (7 dia(s) no recorte).",
        "Em horas: **86 h 45 min** injustificadas e **102 h 30 min** justificadas sobre **2.481 h 15 min** planejadas.",
        "Na comparação interna do período (1ª vs 2ª metade), o índice **subiu 9.0%** pontos.",
      ].join("\n\n"),
    });
    assert.equal(display.metrics[0]?.label, "Índice de absenteísmo");
    assert.equal(display.metrics[0]?.value, "10.5%");
    assert.equal(display.metrics[1]?.label, "Horas injustificadas");
    assert.equal(display.metrics[2]?.label, "Horas justificadas");
  });

  it("usa rótulos para justificadas_mix", () => {
    const display = buildAnswerDisplay({
      intent: "justificadas_mix",
      text:
        "Horas no período **Últimos 7 dias**: **86 h 45 min** injustificadas e **102 h 30 min** justificadas (**54.2%** do volume). Planejado: **2.481 h 15 min**.",
    });
    assert.equal(display.metrics[0]?.label, "Horas injustificadas");
    assert.equal(display.metrics[1]?.label, "Horas justificadas");
  });
});
