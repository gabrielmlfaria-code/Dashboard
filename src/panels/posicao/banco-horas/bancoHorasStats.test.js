import assert from "node:assert/strict";
import test from "node:test";

import { buildBancoHorasStats } from "./bancoHorasStats.js";

test("buildBancoHorasStats nao marca saldo anterior estimado como conhecido", () => {
  const stats = buildBancoHorasStats([
    {
      _events: [
        {
          evento: "Banco de horas credito",
          horas: 60,
          depto: "RH",
          mat: "1",
          nome: "Ana",
        },
      ],
    },
  ]);

  assert.equal(stats.credito, 60);
  assert.equal(stats.saldoAnterior, 0);
  assert.equal(stats.saldoAnteriorKnown, false);
});

test("buildBancoHorasStats preserva saldo anterior conhecido quando informado", () => {
  const stats = buildBancoHorasStats([
    {
      saldoAnterior: "02:00",
      _events: [
        {
          evento: "Banco de horas credito",
          horas: 60,
          depto: "RH",
          mat: "1",
          nome: "Ana",
        },
      ],
    },
  ]);

  assert.equal(stats.saldoAnterior, 120);
  assert.equal(stats.saldoAnteriorKnown, true);
});
