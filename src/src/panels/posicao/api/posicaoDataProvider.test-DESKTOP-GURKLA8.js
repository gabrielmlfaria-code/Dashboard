import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  createPosicaoDataProvider,
  normalizePeriodo,
  validatePeriodo,
} from "./posicaoDataProvider.js";
import { normalizeBooleanFlag } from "./posicaoDataPolicy.js";

describe("posicaoDataProvider", () => {
  it("normaliza periodo para contrato da API", () => {
    assert.deepEqual(normalizePeriodo({ from: "2026-06-01", to: "2026-06-09" }), {
      de: "2026-06-01",
      ate: "2026-06-09",
    });
  });

  it("valida datas obrigatorias antes da chamada remota", async () => {
    assert.deepEqual(validatePeriodo({ de: "2026-06-01", ate: "2026-06-09" }), {
      de: "2026-06-01",
      ate: "2026-06-09",
    });
    assert.throws(() => validatePeriodo({ de: "09/06/2026", ate: "2026-06-01" }), /yyyy-MM-dd/);
    assert.throws(() => validatePeriodo({ de: "2026-06-09", ate: "2026-06-01" }), /menor ou igual/);
  });

  it("normaliza flags booleanas de importacao", () => {
    assert.equal(normalizeBooleanFlag("false"), false);
    assert.equal(normalizeBooleanFlag("nao"), false);
    assert.equal(normalizeBooleanFlag("true"), true);
    assert.equal(normalizeBooleanFlag(undefined, false), false);
  });

  it("bloqueia chamadas remotas quando a fonte nao e api", async () => {
    const provider = createPosicaoDataProvider({
      policy: {
        source: "importacao",
        isApi: false,
        apiBaseUrl: "/api",
      },
      apiClient: {
        getPositionDay: async () => ({ data: [] }),
      },
    });

    await assert.rejects(
      provider.getPositionDay({ de: "2026-06-01", ate: "2026-06-01" }),
      /VITE_SOURCE_POSICAO=api/,
    );
  });

  it("desembrulha envelope data da API", async () => {
    const provider = createPosicaoDataProvider({
      policy: {
        source: "api",
        isApi: true,
        apiBaseUrl: "/api",
      },
      apiClient: {
        getPositionDay: async () => ({ data: [{ colaborador: "Ana" }] }),
      },
    });

    assert.deepEqual(await provider.getPositionDay({ de: "2026-06-01", ate: "2026-06-01" }), [
      { colaborador: "Ana" },
    ]);
  });

  it("expoe resultado com metadados da API sem quebrar metodo legado", async () => {
    const provider = createPosicaoDataProvider({
      policy: {
        source: "api",
        isApi: true,
        apiBaseUrl: "/api",
      },
      apiClient: {
        getPositionDay: async () => ({
          data: [{ colaborador: "Ana" }],
          warnings: ["linha ignorada"],
          generatedAt: "2026-06-09T12:00:00.000Z",
          traceId: "trace-1",
          fonteDados: "sqlserver",
          versaoRegra: "abs-v1",
        }),
      },
    });

    const result = await provider.getPositionDayResult({ de: "2026-06-01", ate: "2026-06-01" });
    assert.deepEqual(result.data, [{ colaborador: "Ana" }]);
    assert.deepEqual(result.meta, {
      warnings: ["linha ignorada"],
      generatedAt: "2026-06-09T12:00:00.000Z",
      traceId: "trace-1",
      fonteDados: "sqlserver",
      versaoRegra: "abs-v1",
    });
  });
});
