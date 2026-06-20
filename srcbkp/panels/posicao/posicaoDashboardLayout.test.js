import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  buildLayoutEditorItems,
  getPosicaoDashboardCardOrder,
  isPosicaoDashboardCardHidden,
  normalizePosicaoDashboardLayout,
} from "./posicaoDashboardLayout.js";

describe("posicaoDashboardLayout", () => {
  it("usa modo padrao quando nao ha layout salvo", () => {
    const layout = normalizePosicaoDashboardLayout();

    assert.equal(layout.mode, "default");
    assert.deepEqual(layout.hidden, []);
    assert.equal(layout.order.horasPeriodo, 30);
    assert.equal(layout.order.radarTrabalhista, 40);
    assert.equal(layout.order.auditoriaPonto, 45);
  });

  it("normaliza ordem e ignora ids desconhecidos", () => {
    const layout = normalizePosicaoDashboardLayout({
      order: { mensal: "5", desconhecido: 1, turnover: "x" },
      hidden: ["mensal", "desconhecido", "mensal"],
    });

    assert.equal(layout.mode, "custom");
    assert.equal(layout.order.mensal, 5);
    assert.equal(layout.order.turnover, 80);
    assert.deepEqual(layout.hidden, ["mensal"]);
  });

  it("preserva modo customizado explicito mesmo sem cards ocultos", () => {
    const layout = normalizePosicaoDashboardLayout({
      mode: "custom",
      order: { turnover: 1 },
      hidden: [],
    });

    assert.equal(layout.mode, "custom");
    assert.equal(layout.order.turnover, 1);
  });

  it("monta itens do editor apenas com cards permitidos", () => {
    const items = buildLayoutEditorItems(
      { order: { turnover: 1, mensal: 2, radarTrabalhista: 3, horasPeriodo: 4, auditoriaPonto: 2.5 }, hidden: ["mensal"] },
      ["mensal", "turnover", "radarTrabalhista", "horasPeriodo", "auditoriaPonto"],
    );

    assert.deepEqual(
      items.map((item) => [item.id, item.enabled]),
      [
        ["turnover", true],
        ["mensal", false],
        ["auditoriaPonto", true],
        ["radarTrabalhista", true],
        ["horasPeriodo", true],
      ],
    );
  });

  it("expoe helpers de ordem e visibilidade", () => {
    const layout = normalizePosicaoDashboardLayout({
      order: { abonos: 15 },
      hidden: ["abonos"],
    });

    assert.equal(getPosicaoDashboardCardOrder(layout, "abonos"), 15);
    assert.equal(isPosicaoDashboardCardHidden(layout, "abonos"), true);
    assert.equal(isPosicaoDashboardCardHidden(layout, "mensal"), false);
  });
});
