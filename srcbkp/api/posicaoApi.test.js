import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { CONFIG } from "../configLocal.js";
import { ApiService } from "./apiService.js";
import { PosicaoApi } from "./posicaoApi.js";

const originalSource = CONFIG.MODULE_SOURCES.posicao;

function setPosicaoSource(source) {
  CONFIG.MODULE_SOURCES.posicao = source;
}

describe("PosicaoApi", () => {
  it("permite mock sem planilha retornar null sem validar contrato da API", async () => {
    setPosicaoSource("mock");
    ApiService.registerMock("/posicao/dia", () => null);

    try {
      assert.equal(await PosicaoApi.getDia("2026-06-09"), null);
    } finally {
      setPosicaoSource(originalSource);
    }
  });

  it("mantem contrato rigido quando a fonte e API", async () => {
    setPosicaoSource("api");
    const originalFetch = globalThis.fetch;
    globalThis.fetch = async () =>
      new Response("null", {
        status: 200,
        headers: { "content-type": "application/json" },
      });

    try {
      await assert.rejects(() => PosicaoApi.getDia("2026-06-09"), /PosiÃ§Ã£o do dia/);
    } finally {
      globalThis.fetch = originalFetch;
      setPosicaoSource(originalSource);
    }
  });
});

