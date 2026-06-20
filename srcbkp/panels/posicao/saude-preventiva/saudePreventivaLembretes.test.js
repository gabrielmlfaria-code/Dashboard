import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  filterLembretesNaoNotificadosHoje,
  getCalendarioItensParaLembrete,
  markLembreteNotificado,
} from "./saudePreventivaLembretes.js";

describe("saudePreventivaLembretes", () => {
  const calendario = [
    { id: 1, titulo: "HPV", status: "ativo", realizadoAno: false, mensagem: "Registrar" },
    { id: 2, titulo: "Rosa", status: "ok", realizadoAno: true, mensagem: "Ok" },
    { id: 3, titulo: "Azul", status: "proximo", realizadoAno: false, mensagem: "Em breve" },
    { id: 4, titulo: "SIPAT", status: "pendente", realizadoAno: false, mensagem: "Pendente" },
  ];

  it("filtra campanhas que exigem lembrete", () => {
    const itens = getCalendarioItensParaLembrete(calendario);
    assert.equal(itens.length, 2);
    assert.deepEqual(
      itens.map((i) => i.id),
      [1, 3],
    );
  });

  it("evita notificar duas vezes no mesmo dia", () => {
    const state = { notified: { 1: "2026-06-04" } };
    const pendentes = filterLembretesNaoNotificadosHoje(
      getCalendarioItensParaLembrete(calendario),
      state,
      "2026-06-04",
    );
    assert.equal(pendentes.length, 1);
    assert.equal(pendentes[0].id, 3);

    const next = markLembreteNotificado(state, 3, "2026-06-04");
    const restantes = filterLembretesNaoNotificadosHoje(
      getCalendarioItensParaLembrete(calendario),
      next,
      "2026-06-04",
    );
    assert.equal(restantes.length, 0);
  });
});
