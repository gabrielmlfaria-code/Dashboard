import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { buildMensalEventColabs } from "./mensalEventColabs.js";

describe("buildMensalEventColabs", () => {
  it("trata _events.horas como minutos, sem multiplicar por 60", () => {
    const rows = [
      {
        date: "2026-06-09",
        _events: [
          {
            evento: "BANCO DE HORAS",
            mat: "10",
            nome: "Ana",
            horas: 90,
          },
        ],
      },
    ];

    assert.deepEqual(buildMensalEventColabs(rows, "Banco de Horas"), [
      {
        mat: "10",
        nome: "Ana",
        depto: "",
        cargo: "",
        filial: "",
        ocorrencias: 1,
        minutos: 90,
        dias: ["2026-06-09"],
      },
    ]);
  });
});
