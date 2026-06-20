import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { buildSaudeConformidadeReportHtml } from "./saudePreventivaReport.js";

describe("saudePreventivaReport — exportação", () => {
  it("gera HTML com KPIs e seções obrigatórias", () => {
    const html = buildSaudeConformidadeReportHtml({
      periodoLabel: "Jan–Mar/2026",
      empresaLabel: "Matriz SP",
      registros: [
        {
          id: "r1",
          data: "2026-05-10",
          tema: "Campanha HPV 2026",
          status: "Realizado",
          publicoAlcance: "todos",
          checklist: { divulgar_oficial: true, conscientizar: true, orientar_diagnostico: true, informar_ausencia: true },
          art473Comunicado: true,
          anexos: [{ id: "a1" }],
        },
      ],
      art473: {
        ocorrencias: 2,
        colaboradores: 1,
        semComunicacao: 1,
        alertas: [{ colaborador: "Maria", diasUsados: 4, limite: 3 }],
        eventos: [{ date: "2026-03-01", colaborador: "Maria", evento: "Exame preventivo", comunicacaoRegistrada: false }],
      },
      calendario: [{ titulo: "HPV", mes: "Maio", status: "ativo", mensagem: "Divulgar campanha" }],
    });

    assert.match(html, /Relatório de Conformidade/);
    assert.match(html, /Jan–Mar\/2026/);
    assert.match(html, /Matriz SP/);
    assert.match(html, /Art\. 473/);
    assert.match(html, /Campanha HPV 2026/);
    assert.match(html, /Maria/);
    assert.match(html, /Lei nº 15\.377\/2026/);
  });

  it("aceita dados vazios sem erro", () => {
    const html = buildSaudeConformidadeReportHtml();
    assert.match(html, /Nenhum registro/);
    assert.match(html, /Nenhuma ocorrência detectada/);
  });
});
