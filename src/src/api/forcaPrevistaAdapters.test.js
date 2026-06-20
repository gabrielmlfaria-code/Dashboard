import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  forcaPrevistaClearApiItem,
  forcaPrevistaListToMap,
  forcaPrevistaPatchApiList,
} from "./forcaPrevistaAdapters.js";

describe("forcaPrevistaAdapters", () => {
  it("nao usa ativos como prevista quando API retorna prevista nula", () => {
    const { map } = forcaPrevistaListToMap([
      { id: 10, nome: "RH", ativos: 42, prevista: null },
      { id: 11, nome: "TI", ativos: 5, prevista: 8 },
    ]);
    assert.equal(map[10], undefined);
    assert.equal(map[11]?.prevista, 8);
  });

  it("mantem departamento com custos mesmo sem prevista", () => {
    const { map } = forcaPrevistaListToMap([
      { id: 20, nome: "Expedição", ativos: 10, prevista: null, custoHora: 35 },
    ]);
    assert.equal(map[20]?.custoHora, 35);
    assert.equal(map[20]?.prevista, 0);
  });

  it("forcaPrevistaClearApiItem zera prevista sem remover departamento", () => {
    const list = [
      { id: 1, nome: "A", ativos: 3, prevista: 10 },
      { id: 2, nome: "B", ativos: 4, prevista: 6 },
    ];
    const next = forcaPrevistaClearApiItem(list, 1);
    assert.equal(next.length, 2);
    assert.equal(next[0].prevista, null);
    assert.equal(next[1].prevista, 6);
  });

  it("forcaPrevistaPatchApiList zera item quando prevista removida do mapa", () => {
    const list = [{ id: 5, nome: "Comercial", ativos: 7, prevista: 12, custoHora: 20 }];
    const next = forcaPrevistaPatchApiList(list, { 5: { idDepartamento: 5, prevista: 0 } });
    assert.equal(next.length, 1);
    assert.equal(next[0].prevista, null);
    assert.equal(next[0].custoHora, null);
  });
});
