import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { createPosicaoDataProvider, normalizePeriodo } from "./posicaoDataProvider.js";
import { normalizeBooleanFlag } from "./posicaoDataPolicy.js";

describe("posicaoDataProvider", () => {
  it("normaliza periodo para contrato da API", () => {
    assert.deepEqual(normalizePeriodo({ from: "2026-06-01", to: "2026-06-09" }), {
      de: "2026-06-01",
      ate: "2026-06-09",
    });
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
});
