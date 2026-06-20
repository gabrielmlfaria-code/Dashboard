import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  buildArt473AusenciasStats,
  buildSaudeCalendarioLembretes,
  inferCampanhaFromEvento,
  isArt473PreventivaEvent,
} from "./saudePreventivaArt473.js";

describe("saudePreventivaArt473", () => {
  it("detecta evento preventivo de mamografia", () => {
    assert.equal(isArt473PreventivaEvent({ evento: "Mamografia preventiva" }), true);
    assert.equal(inferCampanhaFromEvento({ evento: "Mamografia preventiva" }), "Outubro Rosa");
  });

  it("vincula comunicação registrada antes da ausência", () => {
    const rows = [
      {
        date: "2026-05-15",
        _events: [{ evento: "Exame HPV", nome: "Ana", matricula: "1" }],
      },
    ];
    const registros = [
      {
        tema: "Campanha HPV 2026",
        status: "Realizado",
        data: "2026-04-01",
        checklist: {},
      },
    ];
    const stats = buildArt473AusenciasStats(rows, registros);
    assert.equal(stats.ocorrencias, 1);
    assert.equal(stats.eventos[0].comunicacaoRegistrada, true);
  });

  it("calendário marca atraso sem registro no ano", () => {
    const ref = new Date("2026-06-15T12:00:00");
    const lembretes = buildSaudeCalendarioLembretes([], ref);
    const hpv = lembretes.find((l) => l.titulo === "Campanha HPV 2026");
    assert.equal(hpv.status, "atrasado");
  });

  it("alerta colaborador acima de 3 dias em 12 meses", () => {
    const rows = [];
    for (let d = 1; d <= 4; d++) {
      rows.push({
        date: `2026-0${d}-10`,
        _events: [{ evento: "Mamografia", nome: "Carlos", matricula: "99" }],
      });
    }
    const stats = buildArt473AusenciasStats(rows, []);
    assert.equal(stats.alertas.length, 1);
    assert.equal(stats.alertas[0].diasUsados, 4);
  });
});
