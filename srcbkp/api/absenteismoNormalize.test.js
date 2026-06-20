import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  mapSortColToApi,
  mapGroupByToApi,
  normalizeEventoDto,
  normalizeEventosPage,
  normalizeGrupoDto,
} from "./absenteismoNormalize.js";

describe("absenteismoNormalize API futura", () => {
  it("aceita nomes oficiais do contrato .NET futuro", () => {
    const row = normalizeEventoDto({
      matricula: "10042",
      nome: "Ana Costa",
      departamento: "Producao",
      data: "2026-06-09T00:00:00",
      codigoEvento: "001",
      descricaoEvento: "Hora Normal",
      minutos: 480,
      categoria: "presentes",
    });

    assert.equal(row.mat, "10042");
    assert.equal(row.depto, "Producao");
    assert.equal(row.data, "2026-06-09");
    assert.equal(row.cod, "001");
    assert.equal(row.evento, "Hora Normal");
    assert.equal(row.horas, 480);
  });

  it("normaliza totais em minutos com aliases antigos", () => {
    const page = normalizeEventosPage({
      items: [],
      total: 10,
      page: 2,
      pageSize: 50,
      totais: {
        horasMinutos: 100,
        horasPlanejadasMinutos: 200,
        horasPresentesMinutos: 150,
        horasAusentesMinutos: 50,
      },
    });

    assert.deepEqual(page.totais, {
      horas: 100,
      horasPlan: 200,
      horasPres: 150,
      horasAuse: 50,
    });
  });

  it("usa nomes oficiais para sort e grupos", () => {
    assert.equal(mapSortColToApi("cod"), "codigoEvento");
    assert.equal(mapSortColToApi("evento"), "descricaoEvento");
    assert.equal(mapGroupByToApi("cod"), "codigoEvento");
    assert.equal(mapGroupByToApi("evento"), "descricaoEvento");
    assert.equal(normalizeGrupoDto({ key: "SP", horasPlanejadasMinutos: 60 }).horasPlan, 60);
  });
});
