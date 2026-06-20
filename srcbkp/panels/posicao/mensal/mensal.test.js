import assert from "node:assert/strict";
import { afterEach, describe, it } from "node:test";

import { PB_KPI_MENSAL_KEY, saveKpiMensal } from "./mensal.js";

const originalWindow = globalThis.window;

afterEach(() => {
  globalThis.window = originalWindow;
});

describe("saveKpiMensal", () => {
  it("propaga falha de armazenamento para o importador exibir feedback", () => {
    globalThis.window = {
      localStorage: {
        setItem() {
          throw new DOMException("quota", "QuotaExceededError");
        },
      },
      dispatchEvent() {},
    };

    assert.throws(
      () => saveKpiMensal({ rows: [], months: [] }),
      /Nao foi possivel salvar o Mensal/,
    );
  });

  it("remove dados e dispara evento estruturado ao limpar", () => {
    let removedKey = "";
    let eventDetail = undefined;
    globalThis.window = {
      localStorage: {
        removeItem(key) {
          removedKey = key;
        },
      },
      dispatchEvent(event) {
        eventDetail = event.detail;
      },
    };

    saveKpiMensal(null);

    assert.equal(removedKey, PB_KPI_MENSAL_KEY);
    assert.equal(eventDetail, null);
  });
});
