import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { z } from "zod";
import { parseApiPayload } from "./apiValidators.js";

describe("parseApiPayload", () => {
  it("retorna o payload tipado quando o contrato esta correto", () => {
    const schema = z.object({ nome: z.string(), total: z.number().int() });

    assert.deepEqual(parseApiPayload(schema, { nome: "Banco", total: 3 }), {
      nome: "Banco",
      total: 3,
    });
  });

  it("falha com mensagem rastreavel quando o contrato muda", () => {
    const schema = z.object({ total: z.number().int() });

    assert.throws(
      () => parseApiPayload(schema, { total: "3" }, "Resumo"),
      /Contrato inválido em Resumo/,
    );
  });
});
