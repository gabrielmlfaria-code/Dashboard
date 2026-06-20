import assert from "node:assert/strict";
import test from "node:test";

import { buildRadarTrabalhistaDataset } from "./radarTrabalhistaData.js";

test("buildRadarTrabalhistaDataset usa classificador centralizado e preserva eventos sem turno", () => {
  const data = buildRadarTrabalhistaDataset(
    [
      {
        date: "2026-06-08",
        _events: [
          {
            _cat: "risco",
            evento: "Jornada excedente sem autorizacao",
            mat: "1",
            nome: "Ana",
            depto: "Producao",
            horas: 120,
          },
        ],
      },
    ],
    { passivoCfg: { sh: 10, adicionalHe: 0.5 } },
  );

  assert.equal(data.eventTypes[0].kind, "extra");
  assert.equal(data.eventTypes[0].baseLegal, "CLT Art. 59");
  assert.equal(data.eventTypes[0].horasMinutos, 120);
  assert.equal(data.eventTypes[0].passivo, 30);

  const semTurno = data.heatmap.rows.find((row) => row.turno === "Sem turno");
  assert.equal(
    semTurno.values.reduce((sum, value) => sum + value, 0),
    1,
  );
});
