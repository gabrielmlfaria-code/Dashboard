import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  SAUDE_CHECKLIST_ITEMS,
  buildHistColaboradoresList,
  buildHistDepartamentosList,
  buildModeloComunicacao,
  parseSaudeDepartamentos,
  computeCampanhaCompliance,
  emptySaudeChecklist,
  formatSaudeListaLinha,
  isLineInListaNominal,
  normalizeSaudeRegistro,
  resolveEmpresaLabel,
  validateSaudeRegistroRealizado,
} from "./saudePreventivaCampanhas.js";

describe("saudePreventivaCampanhas — conformidade Lei 15.377", () => {
  it("modelo HPV inclui art. 473, XII", () => {
    const texto = buildModeloComunicacao("Campanha HPV 2026");
    assert.match(texto, /art\. 473, XII/i);
    assert.match(texto, /HPV/i);
    assert.match(texto, /Lei nº 15\.377\/2026/i);
  });

  it("progresso 100% quando checklist completo em registro realizado", () => {
    const checklist = Object.fromEntries(SAUDE_CHECKLIST_ITEMS.map((i) => [i.id, true]));
    const registros = [
      {
        tema: "Outubro Rosa",
        status: "Realizado",
        checklist,
      },
    ];
    const result = computeCampanhaCompliance("Outubro Rosa", registros);
    assert.equal(result.progresso, 100);
    assert.equal(result.status, "realizado");
  });

  it("progresso parcial com checklist incompleto", () => {
    const registros = [
      {
        tema: "Novembro Azul",
        status: "Realizado",
        checklist: { ...emptySaudeChecklist(), divulgar_oficial: true, conscientizar: true },
      },
    ];
    const result = computeCampanhaCompliance("Novembro Azul", registros);
    assert.equal(result.progresso, 50);
    assert.equal(result.status, "agendado");
  });

  it("validação P1 exige art. 473, público-alvo e evidência", () => {
    const checklist = Object.fromEntries(SAUDE_CHECKLIST_ITEMS.map((i) => [i.id, true]));
    const incompleto = normalizeSaudeRegistro({
      status: "Realizado",
      checklist,
      art473Comunicado: false,
      publicoAlcance: "todos",
      colaboradores: 10,
      obs: "texto",
    });
    assert.ok(validateSaudeRegistroRealizado(incompleto).some((e) => /473/.test(e)));

    const completo = normalizeSaudeRegistro({
      status: "Realizado",
      checklist,
      art473Comunicado: true,
      publicoAlcance: "todos",
      colaboradores: 10,
      anexos: [{ id: "1", nome: "ata.pdf", tipo: "application/pdf", tamanho: 100 }],
      obs: "",
    });
    assert.deepEqual(validateSaudeRegistroRealizado(completo), []);
  });

  it("extrai colaboradores únicos do histórico", () => {
    const list = buildHistColaboradoresList([
      {
        _employees: [{ nome: "Ana Costa", mat: "100" }],
        _events: [{ nome: "Ana Costa", mat: "100" }, { colaborador: "Bruno Lima", matricula: "200" }],
      },
    ]);
    assert.equal(list.length, 2);
    assert.equal(formatSaudeListaLinha(list[0].nome, list[0].matricula), "Ana Costa — 100");
    assert.ok(isLineInListaNominal("Bruno Lima — 200", list[1]));
  });

  it("extrai departamentos únicos do histórico", () => {
    const depts = buildHistDepartamentosList([
      { departamento: "RH", _employees: [{ depto: "Produção" }] },
      { depto_desc: "RH" },
    ]);
    assert.equal(depts.length, 2);
    assert.deepEqual(parseSaudeDepartamentos("RH, Produção, TI"), ["RH", "Produção", "TI"]);
  });

  it("resolve rótulo de empresa a partir das filiais", () => {
    const rows = [{ filial: "Matriz SP" }, { empresa: "Matriz SP" }];
    assert.equal(resolveEmpresaLabel(rows), "Matriz SP");
    assert.equal(resolveEmpresaLabel(rows, "Filial RJ"), "Filial RJ");
    assert.equal(resolveEmpresaLabel([{ filial: "A" }, { filial: "B" }]), "Várias filiais");
  });
});
