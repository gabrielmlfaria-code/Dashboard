import assert from "node:assert/strict";
import test from "node:test";

import {
  getPositionCategoryHours,
  getPositionCategoryLabel,
  normalizePositionCategory,
} from "../src/panels/posicao/domain/positionCategories.js";
import {
  buildPositionCalculationLedger,
  summarizePositionDay,
} from "../src/panels/posicao/domain/positionMetrics.js";
import {
  normalizePositionEmployee,
  normalizePositionEmployeesFromDay,
} from "../src/panels/posicao/domain/positionRows.js";

test("normaliza sinonimos de categoria da posicao", () => {
  assert.equal(normalizePositionCategory("ausentes"), "falta");
  assert.equal(normalizePositionCategory("FALTAS"), "falta");
  assert.equal(normalizePositionCategory("atrasos"), "atraso");
  assert.equal(normalizePositionCategory("Férias"), "ferias");
  assert.equal(normalizePositionCategory("Não controla ponto"), "nao_controla");
});

test("expoe rotulos legiveis das categorias da posicao", () => {
  assert.equal(getPositionCategoryLabel("ferias"), "Férias");
  assert.equal(getPositionCategoryLabel("ja_saiu"), "Já saíram");
  assert.equal(getPositionCategoryLabel("nao_controla"), "Não controla ponto");
});

test("normaliza colaborador da posicao com contrato estavel", () => {
  const row = normalizePositionEmployee(
    {
      colaborador_nome: "MARIA TESTE",
      matricula: 123,
      departamentoNome: "RH",
      cargoDescricao: "Analista",
      sexo: "Feminino",
      evento_codigo: "21400",
      evento_descricao: "FALTA",
      data_inicio: "2026-06-01",
      data_fim: "2026-06-03",
      qtd_dias: 3,
    },
    { category: "faltas", date: "2026-06-02" },
  );

  assert.equal(row.matricula, "123");
  assert.equal(row.nome, "MARIA TESTE");
  assert.equal(row.departamento, "RH");
  assert.equal(row.cargo, "Analista");
  assert.equal(row.genero, "F");
  assert.equal(row.cat, "falta");
  assert.equal(row.eventoCodigo, "21400");
  assert.equal(row.eventoDescricao, "FALTA");
  assert.equal(row.inicio, "2026-06-01");
  assert.equal(row.fim, "2026-06-03");
  assert.equal(row.dias, 3);
  assert.equal(row.hrsAuse, 480);
});

test("normaliza todos os colaboradores de um dia por categoria", () => {
  const rows = normalizePositionEmployeesFromDay({
    date: "2026-06-07",
    presentes: { colaboradores: [{ nome: "A", matricula: "1" }] },
    ferias: { colaboradores: [{ nome: "B", matricula: "2", inicio: "2026-06-01" }] },
  });

  assert.equal(rows.length, 2);
  assert.equal(rows[0].cat, "presentes");
  assert.equal(rows[0].hrsPres, 480);
  assert.equal(rows[1].cat, "ferias");
  assert.equal(rows[1].data, "2026-06-07");
});

test("normaliza _employees com datas e campos de contrato do modal", () => {
  const rows = normalizePositionEmployeesFromDay({
    date: "2026-06-03",
    _employees: [
      {
        colaborador: "JOAO TESTE",
        mat: 77,
        departamento_nome: "OPERACAO",
        cargo_descricao: "Operador",
        categoria: "afastados",
        data_inicio: "2026-06-01",
        data_fim: "2026-06-10",
        qtdDias: 10,
      },
    ],
  });

  assert.equal(rows.length, 1);
  assert.equal(rows[0].nome, "JOAO TESTE");
  assert.equal(rows[0].matricula, "77");
  assert.equal(rows[0].departamento, "OPERACAO");
  assert.equal(rows[0].cargo, "Operador");
  assert.equal(rows[0].cat, "afastados");
  assert.equal(rows[0].inicio, "2026-06-01");
  assert.equal(rows[0].fim, "2026-06-10");
  assert.equal(rows[0].dias, 10);
  assert.equal(rows[0].data, "2026-06-03");
});

test("normaliza grupos alternativos e respeita filtro do modal", () => {
  const rows = normalizePositionEmployeesFromDay(
    {
      data_referencia: "2026-06-04",
      falta: { items: [{ nome: "ANA", matricula: "1", departamento: "RH" }] },
      atraso: { lista: [{ nome: "BRUNO", matricula: "2", departamento: "OPERACAO" }] },
    },
    (employee) => employee.departamento === "OPERACAO",
  );

  assert.equal(rows.length, 1);
  assert.equal(rows[0].nome, "BRUNO");
  assert.equal(rows[0].cat, "atraso");
  assert.equal(rows[0].data, "2026-06-04");
});

test("resume contagens do dia com grupos e totais numericos", () => {
  const summary = summarizePositionDay({
    presentes: { total: 10 },
    falta: { colaboradores: [{}, {}] },
    atraso: 3,
    ferias: { total: 1 },
  });

  assert.equal(summary.presentes, 10);
  assert.equal(summary.falta, 2);
  assert.equal(summary.atraso, 3);
  assert.equal(summary.total, 16);
  assert.equal(summary.absRate, 31.25);
});

test("resume contagens do dia com formatos alternativos de grupo", () => {
  const summary = summarizePositionDay({
    folga: { items: [{}, {}, {}] },
    afastados: { lista: [{}, {}] },
    ja_saiu: { Colaboradores: [{}] },
  });

  assert.equal(summary.folga, 3);
  assert.equal(summary.afastados, 2);
  assert.equal(summary.ja_saiu, 1);
  assert.equal(summary.total, 6);
});

test("mantem horas padrao por categoria centralizadas", () => {
  assert.deepEqual(getPositionCategoryHours("falta"), { hrsPlan: 480, hrsAuse: 480 });
  assert.deepEqual(getPositionCategoryHours("presentes"), { hrsPlan: 480, hrsPres: 480 });
});

test("gera memoria de calculo auditavel do absenteismo", () => {
  const ledger = buildPositionCalculationLedger({
    plannedMinutes: 1000,
    workedMinutes: 700,
    absentMinutes: 250,
    justifiedMinutes: 50,
    metaPct: 5,
  });

  assert.equal(ledger.formula, "(horas ausentes + horas justificadas) / horas planejadas * 100");
  assert.equal(ledger.numeratorMinutes, 300);
  assert.equal(ledger.absenteismPct, 30);
  assert.equal(ledger.deviationPp, 25);
});
