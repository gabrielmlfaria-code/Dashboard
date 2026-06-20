import assert from "node:assert/strict";
import { afterEach, describe, it } from "node:test";

import {
  buildTurnoverView,
  loadTurnoverPeriod,
  parseTurnoverAoa,
  parseTurnoverCsv,
  saveKpiTurnover,
  saveTurnoverPeriod,
} from "./turnoverData.js";

const originalWindow = globalThis.window;
const originalCustomEvent = globalThis.CustomEvent;

afterEach(() => {
  globalThis.window = originalWindow;
  globalThis.CustomEvent = originalCustomEvent;
});

describe("turnoverData", () => {
  it("normaliza nomes de linhas do CSV sem depender de caixa ou acento", () => {
    const parsed = parseTurnoverCsv(
      [
        "Grupos;02/2026;01/2026",
        "desligados;2;1",
        "ADMITIDOS;4;3",
        "Total de colaboradores;100;90",
        "Estagiario;5;4",
      ].join("\n"),
    );

    assert.deepEqual(parsed.rows.Desligados, [2, 1]);
    assert.deepEqual(parsed.rows.Admitidos, [4, 3]);
    assert.deepEqual(parsed.rows["Total de Colaboradores"], [100, 90]);
    assert.deepEqual(parsed.rows.Estagiarios, [5, 4]);
  });

  it("normaliza planilha XLSX lida como AOA", () => {
    const parsed = parseTurnoverAoa([
      ["Grupos", "02/2026", "01/2026"],
      ["Mensalistas", 80, 75],
      ["Estagiárias", 8, 7],
    ]);

    assert.deepEqual(parsed.rows.Mensalistas, [80, 75]);
    assert.deepEqual(parsed.rows.Estagiarios, [8, 7]);
  });

  it("monta view filtrada usando lookup tolerante e meta", () => {
    const parsed = parseTurnoverCsv(
      [
        "Grupos;02/2026;01/2026",
        "desligados;2;1",
        "admitidos;4;3",
        "total de colaboradores;100;80",
      ].join("\n"),
    );

    const view = buildTurnoverView(parsed, { from: "2026-01", to: "2026-02", meta: "5" });

    assert.deepEqual(view.months, ["02/2026", "01/2026"]);
    assert.deepEqual(
      view.rows.find((row) => row.label === "% Rotatividade").values,
      [3, 2.5],
    );
    assert.equal(view.meta, 5);
  });

  it("dispara evento ao salvar e propaga falha de storage", () => {
    const events = [];
    globalThis.CustomEvent = class TestCustomEvent {
      constructor(type, init = {}) {
        this.type = type;
        this.detail = init.detail;
      }
    };
    globalThis.window = {
      localStorage: {
        setItem() {},
      },
      dispatchEvent(event) {
        events.push(event);
      },
    };

    saveKpiTurnover({ months: [], rows: {} });
    assert.equal(events[0].type, "pos:turnover-updated");

    globalThis.window.localStorage.setItem = () => {
      throw new DOMException("quota", "QuotaExceededError");
    };
    assert.throws(() => saveKpiTurnover({ months: [], rows: {} }), /Nao foi possivel salvar/);
  });

  it("persiste periodo selecionado", () => {
    let stored = "";
    globalThis.window = {
      localStorage: {
        setItem(_key, value) {
          stored = value;
        },
        getItem() {
          return stored;
        },
      },
    };

    saveTurnoverPeriod({ from: "2026-01", to: "2026-12" });
    assert.deepEqual(loadTurnoverPeriod(), { from: "2026-01", to: "2026-12" });
  });
});
