import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { apiContractFixtures } from "./apiContractFixtures.js";
import {
  AbsenteismoResumoSchema,
  BancoHorasResumoSchema,
  FechamentoMensalResumoSchema,
  PosicaoDiaResumoSchema,
  RadarTrabalhistaResumoSchema,
  TurnoverResumoSchema,
  apiEnvelopeOf,
} from "./contracts.js";

describe("fixtures do contrato futuro .NET", () => {
  it("valida payloads envelopados dos endpoints principais", () => {
    const cases = [
      [
        "posicao/dia",
        apiEnvelopeOf(PosicaoDiaResumoSchema.array()),
        apiContractFixtures.posicaoDiaEnvelope,
      ],
      [
        "absenteismo/resumo",
        apiEnvelopeOf(AbsenteismoResumoSchema),
        apiContractFixtures.absenteismoResumoEnvelope,
      ],
      [
        "banco-horas/resumo",
        apiEnvelopeOf(BancoHorasResumoSchema),
        apiContractFixtures.bancoHorasResumoEnvelope,
      ],
      [
        "fechamento-mensal/eventos",
        apiEnvelopeOf(FechamentoMensalResumoSchema),
        apiContractFixtures.fechamentoMensalEnvelope,
      ],
      [
        "turnover/resumo",
        apiEnvelopeOf(TurnoverResumoSchema),
        apiContractFixtures.turnoverResumoEnvelope,
      ],
      [
        "radar-trabalhista/resumo",
        apiEnvelopeOf(RadarTrabalhistaResumoSchema),
        apiContractFixtures.radarTrabalhistaEnvelope,
      ],
    ];

    for (const [label, schema, fixture] of cases) {
      assert.doesNotThrow(() => schema.parse(fixture), label);
    }
  });
});
