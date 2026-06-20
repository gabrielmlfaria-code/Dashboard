import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  buildSaudeMatrizConformidadeHtml,
  buildSaudeMatrizRows,
} from "./saudePreventivaMatriz.js";
import { buildSaudeConformidadeReportHtml } from "./saudePreventivaReport.js";

describe("saudePreventivaMatriz — conformidade legal", () => {
  const ctx = {
    stats: { total: 2, realizadas: 1 },
    art473: { ocorrencias: 1, semComunicacao: 1, alertas: [{ colaborador: "Ana", diasUsados: 4, limite: 3 }] },
    registros: [
      {
        status: "Realizado",
        art473Comunicado: true,
        anexos: [{ id: "a1" }],
        obs: "",
      },
    ],
  };

  it("monta linhas da matriz com status dinâmico", () => {
    const m = buildSaudeMatrizRows(ctx);
    assert.ok(m.art169a.length >= 5);
    assert.ok(m.art473xii.some((r) => r.id === "3.2"));
    assert.equal(m.resumo.find((r) => r.dim.includes("automático"))?.status, "no");
  });

  it("gera HTML standalone com seções legais", () => {
    const html = buildSaudeMatrizConformidadeHtml({
      empresaLabel: "Matriz SP",
      periodoLabel: "Jan/2026",
      ...ctx,
    });
    assert.match(html, /Matriz de Conformidade/);
    assert.match(html, /Art\. 169-A/);
    assert.match(html, /Art\. 473, XII/);
    assert.match(html, /Art\. 473, § 3º/);
    assert.match(html, /Matriz SP/);
    assert.match(html, /Checklist prático/);
  });

  it("relatório completo inclui matriz embutida", () => {
    const html = buildSaudeConformidadeReportHtml({
      empresaLabel: "Empresa X",
      registros: ctx.registros,
      art473: ctx.art473,
    });
    assert.match(html, /Matriz de Conformidade/);
    assert.match(html, /Lei nº 15\.377\/2026/);
  });
});
