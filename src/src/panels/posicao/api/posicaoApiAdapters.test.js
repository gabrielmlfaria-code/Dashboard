import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { apiContractFixtures } from "../../../api/apiContractFixtures.js";
import {
  buildMensalFromApiDto,
  buildTurnoverFromApiDto,
  competenciaToMonthLabel,
} from "./posicaoApiAdapters.js";

describe("posicaoApiAdapters", () => {
  it("converte competencia da API para label mensal usado pelos cards", () => {
    assert.equal(competenciaToMonthLabel("2026-06"), "06/2026");
    assert.equal(competenciaToMonthLabel("6/2026"), "06/2026");
  });

  it("converte fechamento mensal da API para formato do MensalListCard", () => {
    const dto = apiContractFixtures.fechamentoMensalEnvelope.data;
    const built = buildMensalFromApiDto(dto);

    assert.deepEqual(built.months, ["06/2026"]);
    assert.equal(built.eventCount, 1);
    assert.equal(built.rows[0].event, "001 - FALTA INJUSTIFICADA");
    assert.equal(built.rows[0].byMonth["06/2026"], 4200);
    assert.equal(built.total, 4200);
    assert.equal(built.source, "api");
  });

  it("converte turnover da API para formato consumido por buildTurnoverView", () => {
    const dto = apiContractFixtures.turnoverResumoEnvelope.data;
    const built = buildTurnoverFromApiDto(dto);

    assert.deepEqual(built.months, ["06/2026", "05/2026"]);
    assert.deepEqual(built.rows.Desligados, [2, 1]);
    assert.deepEqual(built.rows.Admitidos, [4, 3]);
    assert.deepEqual(built.rows["Total de Colaboradores"], [100, 80]);
    assert.deepEqual(built.rows.Estagiarios, [5, 4]);
    assert.equal(built.source, "api");
  });
});
