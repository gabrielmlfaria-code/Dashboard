import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  toAbsenteeismSummaryDto,
  toBankHoursDto,
  toMonthlyClosingDto,
  toPositionDayDto,
} from "./posicaoLocalAdapters.js";

describe("posicaoLocalAdapters", () => {
  it("maps imported position day rows to the API day shape", () => {
    const dto = toPositionDayDto({
      data: "2026-06-03",
      depto: "AJDA - AJUDANTE 20HS",
      qtdPresentes: 10,
      qtdAusentes: 2,
      atrasos: 1,
    });

    assert.equal(dto.data, "2026-06-03");
    assert.equal(dto.departamento, "AJDA - AJUDANTE 20HS");
    assert.equal(dto.presentes, 10);
    assert.equal(dto.faltas, 2);
    assert.equal(dto.atrasos, 1);
  });

  it("maps absenteeism using categorized absence minutes", () => {
    const dto = toAbsenteeismSummaryDto({
      periodo: { de: "2026-06-01", ate: "2026-06-07" },
      plannedMinutes: 96360,
      workedMinutes: 42067,
      unjustifiedAbsentMinutes: 16065,
      justifiedAbsentMinutes: 0,
      metaPct: 5,
    });

    assert.equal(dto.indicePct, 16.7);
    assert.equal(dto.horasTrabalhadasMin, 42067);
    assert.equal(dto.horasAusentesMin, 16065);
  });

  it("maps bank hours preserving imported previous balance", () => {
    const dto = toBankHoursDto({
      periodo: { de: "2026-04-21", ate: "2026-05-20" },
      summary: {
        saldoAnteriorMin: 2223,
        creditoMin: 1680,
        debitoMin: -244,
        saldoProximoMin: 3659,
      },
      departamentos: [
        {
          departamento: "CTBA - CONTABILIDADE",
          saldoAnteriorMin: 2223,
          creditoMin: 1680,
          debitoMin: -244,
          saldoProximoMin: 3659,
          colaboradores: 1,
        },
      ],
    });

    assert.equal(dto.saldoAnteriorMin, 2223);
    assert.equal(dto.saldoProximoMin, 3659);
    assert.equal(dto.departamentos[0].departamento, "CTBA - CONTABILIDADE");
  });

  it("maps monthly closing with month-to-month variation", () => {
    const dto = toMonthlyClosingDto({
      periodo: { de: "2025-05", ate: "2025-06" },
      monthLabels: ["MAI/25", "JUN/25"],
      eventos: [
        {
          codigo: "21115",
          descricao: "AD NOT 35%",
          months: [
            { label: "MAI/25", horasMin: 600 },
            { label: "JUN/25", horasMin: 900 },
          ],
        },
      ],
    });

    assert.equal(dto.eventos[0].meses[0].variacaoPct, null);
    assert.equal(dto.eventos[0].meses[1].variacaoPct, 50);
  });
});
