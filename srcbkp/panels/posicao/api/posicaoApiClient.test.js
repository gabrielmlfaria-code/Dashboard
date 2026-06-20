import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { createPosicaoApiClient, PosicaoApiError } from "./posicaoApiClient.js";
import { createPosicaoDataProvider } from "./posicaoDataProvider.js";

function jsonResponse(payload, { ok = true, status = 200 } = {}) {
  return {
    ok,
    status,
    async json() {
      return payload;
    },
  };
}

describe("posicaoApiClient JS", () => {
  it("monta URLs oficiais com de/ate usando fetch injetado", async () => {
    const calls = [];
    const client = createPosicaoApiClient({
      baseUrl: "https://api.example.com/api",
      fetchImpl: async (url, options) => {
        calls.push({ url, options });
        return jsonResponse({ data: [{ data: "2026-06-09" }], traceId: "trace-1" });
      },
    });

    const payload = await client.getPositionDay({ de: "2026-06-01", ate: "2026-06-09" });

    assert.deepEqual(payload.data, [{ data: "2026-06-09" }]);
    assert.equal(
      calls[0].url,
      "https://api.example.com/api/posicao/dia?de=2026-06-01&ate=2026-06-09",
    );
    assert.equal(calls[0].options.headers.Accept, "application/json");
  });

  it("propaga erro tipado quando a API responde status nao OK", async () => {
    const client = createPosicaoApiClient({
      baseUrl: "https://api.example.com/api",
      fetchImpl: async () => jsonResponse({ title: "Erro" }, { ok: false, status: 503 }),
    });

    await assert.rejects(
      client.getAbsenteeism({ de: "2026-06-01", ate: "2026-06-09" }),
      (err) => err instanceof PosicaoApiError && err.status === 503,
    );
  });
});

describe("posicaoDataProvider em modo API", () => {
  it("falha periodo invalido antes de chamar fetch", async () => {
    let fetchCalls = 0;
    const provider = createPosicaoDataProvider({
      policy: {
        source: "api",
        isApi: true,
        apiBaseUrl: "https://api.example.com/api",
      },
      fetchImpl: async () => {
        fetchCalls += 1;
        return jsonResponse({ data: [] });
      },
    });

    await assert.rejects(
      provider.getPositionDay({ de: "2026-06-10", ate: "2026-06-01" }),
      /de menor ou igual/,
    );
    assert.equal(fetchCalls, 0);
  });

  it("preserva meta do envelope no metodo Result usando client real", async () => {
    const provider = createPosicaoDataProvider({
      policy: {
        source: "api",
        isApi: true,
        apiBaseUrl: "https://api.example.com/api",
      },
      fetchImpl: async () =>
        jsonResponse({
          data: [{ data: "2026-06-09" }],
          warnings: ["amostra"],
          generatedAt: "2026-06-09T12:00:00.000Z",
          traceId: "trace-2",
          fonteDados: "sqlserver",
          versaoRegra: "posicao-v1",
        }),
    });

    const result = await provider.getPositionDayResult({
      de: "2026-06-01",
      ate: "2026-06-09",
    });

    assert.deepEqual(result.data, [{ data: "2026-06-09" }]);
    assert.equal(result.meta.traceId, "trace-2");
    assert.equal(result.meta.fonteDados, "sqlserver");
    assert.deepEqual(result.meta.warnings, ["amostra"]);
  });
});
