import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  buildBancoHorasRowsFromHistEvents,
  diagnoseBancoHorasSheet,
  formatBancoHorasImportSummary,
  filterBancoHorasRowsByPeriod,
  getBancoHorasImportRows,
  normalizeBancoHorasRows,
  parseBancoHorasDate,
  parseBancoHorasMin,
  parseBancoHorasSheet,
} from "./bancoHoras.js";

describe("parseBancoHorasSheet — layout Folha BH", () => {
  const aoa = [
    [
      "Matrícula",
      "Nome",
      "Atividade",
      "Cargo",
      "Período Inicial",
      "Período",
      "Saldo Anterior",
      "Crédito",
      "Débito",
      "Horas Pagas",
      "Horas Pagas Original",
      "Saldo Próximo",
    ],
    ["Filial: Filial 1", null, null, null, null, null, "728:56", "32:47", "-59:28", "0:00", "0:00", "899:27"],
    [
      "533",
      "ALINE DIAS RODRIGUES",
      "Ativo",
      "ANALISTA CONTABIL",
      "21/04/2026",
      "20/05/2026",
      "37:03",
      "28:00",
      "-04:04",
      "0:00",
      "0:00",
      "60:59",
    ],
    [
      "603",
      "CAROLINE PEREIRA HORA GUEDES",
      "Ativo",
      "ANALISTA FINANCEIRO",
      "21/04/2026",
      "20/05/2026",
      "06:17",
      "00:41",
      "-04:26",
      "0:00",
      "0:00",
      "02:32",
    ],
  ];

  it("importa colaboradores e ignora linha de filial", () => {
    const parsed = parseBancoHorasSheet(aoa, { fileName: "bh.xlsx" });
    assert.ok(parsed);
    assert.equal(parsed.count, 2);
    assert.equal(parsed.colaboradores, 2);
    assert.equal(parsed.rows[0].nome, "ALINE DIAS RODRIGUES");
    assert.equal(parsed.rows[0].filial, "Filial 1");
    assert.equal(parsed.rows[0].periodoInicial, "2026-04-21");
    assert.equal(parsed.rows[0].periodoFinal, "2026-05-20");
    assert.equal(parsed.rows[0].credito, 28 * 60);
    assert.equal(parsed.rows[0].debito, 4 * 60 + 4);
  });
});

describe("parseBancoHorasDate", () => {
  it("aceita serial Excel", () => {
    assert.match(parseBancoHorasDate(45472), /^\d{4}-\d{2}-\d{2}$/);
  });

  it("aceita texto BR", () => {
    assert.equal(parseBancoHorasDate("20/05/2026"), "2026-05-20");
  });
});

describe("parseBancoHorasMin", () => {
  it("aceita débito negativo HH:MM", () => {
    assert.equal(parseBancoHorasMin("-04:04"), -(4 * 60 + 4));
  });
});

describe("normalizeBancoHorasRows", () => {
  it("ignora linha de filial e normaliza datas antigas em texto BR", () => {
    const rows = normalizeBancoHorasRows([
      { matricula: "Filial: Filial 1", nome: "", saldoProximo: 100 },
      { matricula: "1", nome: "JOAO", periodoInicial: "21/04/2026", periodoFinal: "20/05/2026", credito: 60, debito: 0, saldoProximo: 120 },
    ]);
    assert.equal(rows.length, 1);
    assert.equal(rows[0].periodoInicial, "2026-04-21");
    assert.equal(rows[0].periodoFinal, "2026-05-20");
  });

  it("getBancoHorasImportRows usa rows do objeto informado", () => {
    const parsed = parseBancoHorasSheet([
      ["Matrícula", "Nome", "Atividade", "Cargo", "Período Inicial", "Período", "Saldo Anterior", "Crédito", "Débito", "Horas Pagas", "Horas Pagas Original", "Saldo Próximo"],
      ["533", "ALINE", "Ativo", "ANALISTA", "21/04/2026", "20/05/2026", "37:03", "28:00", "-04:04", "0:00", "0:00", "60:59"],
    ]);
    const rows = getBancoHorasImportRows(parsed);
    assert.equal(rows.length, 1);
    assert.equal(rows[0].nome, "ALINE");
  });
});

describe("diagnoseBancoHorasSheet", () => {
  it("detecta colunas faltantes", () => {
    const diag = diagnoseBancoHorasSheet([["Matrícula", "Nome", "Crédito", "Débito"]]);
    assert.equal(diag.ok, false);
    assert.ok(diag.missingCols.includes("Saldo Anterior"));
    assert.ok(diag.missingCols.includes("Saldo Próximo"));
  });

  it("aceita cabeçalho BH dividido em duas linhas (colunas G+ na linha 2)", () => {
    const aoa = [
      ["Matrícula", "Nome", "Atividade", null, null, null, null, null, null, null, null, null],
      [
        null,
        null,
        null,
        "Cargo",
        "Período Inicial",
        "Período",
        "Saldo Anterior",
        "Crédito",
        "Débito",
        "Horas Pagas",
        "Horas Pagas Original",
        "Saldo Próximo",
      ],
      ["533", "ALINE", "Ativo", "ANALISTA", "21/04/2026", "20/05/2026", "37:03", "28:00", "-04:04", "0:00", "0:00", "60:59"],
    ];
    const parsed = parseBancoHorasSheet(aoa);
    assert.ok(parsed);
    assert.equal(parsed.count, 1);
    assert.equal(parsed.rows[0].nome, "ALINE");
  });

  it("aceita cabeçalho em duas linhas mescladas", () => {
    const aoa = [
      ["Matrícula", "Nome", null, null, "Período Inicial", "Período", "Saldo Anterior", "Crédito", "Débito", null, null, "Saldo Próximo"],
      [null, null, "Atividade", "Cargo", null, null, null, null, null, "Horas Pagas", "Horas Pagas Original", null],
      ["533", "ALINE", "Ativo", "ANALISTA", "21/04/2026", "20/05/2026", "37:03", "28:00", "-04:04", "0:00", "0:00", "60:59"],
    ];
    const parsed = parseBancoHorasSheet(aoa);
    assert.ok(parsed);
    assert.equal(parsed.count, 1);
  });
});

describe("formatBancoHorasImportSummary", () => {
  it("resume importação da Folha BH do usuário", () => {
    const parsed = parseBancoHorasSheet([
      [
        "Matrícula",
        "Nome",
        "Atividade",
        "Cargo",
        "Período Inicial",
        "Período",
        "Saldo Anterior",
        "Crédito",
        "Débito",
        "Horas Pagas",
        "Horas Pagas Original",
        "Saldo Próximo",
      ],
      ["Filial: Filial 1", null, null, null, null, null, "728:56", "32:47", "-59:28", "0:00", "0:00", "899:27"],
      ["533", "ALINE", "Ativo", "ANALISTA", "21/04/2026", "20/05/2026", "37:03", "28:00", "-04:04", "0:00", "0:00", "60:59"],
      ["603", "CAROLINE", "Ativo", "ANALISTA", "21/04/2026", "20/05/2026", "06:17", "00:41", "-04:26", "0:00", "0:00", "02:32"],
    ]);
    const msg = formatBancoHorasImportSummary(parsed);
    assert.match(msg, /2 colaboradores/);
    assert.match(msg, /Filial Filial 1/);
    assert.match(msg, /21\/04\/2026 a 20\/05\/2026/);
    assert.match(msg, /saldo próximo/);
  });
});

describe("buildBancoHorasRowsFromHistEvents", () => {
  it("agrega colaboradores do histórico com campos BH", () => {
    const hist = [
      {
        date: "2026-05-20",
        _events: [
          {
            mat: "533",
            nome: "ALINE",
            creditoBH: 1680,
            debitoBH: 244,
            saldoProximoBH: 3659,
            saldoAnteriorBH: 2223,
            depto: "CONTABIL",
          },
        ],
      },
    ];
    const rows = buildBancoHorasRowsFromHistEvents(hist);
    assert.equal(rows.length, 1);
    assert.equal(rows[0].matricula, "533");
    assert.equal(getBancoHorasImportRows(null, hist).length, 1);
  });
});

describe("filterBancoHorasRowsByPeriod", () => {
  it("mantem apenas competencias que cruzam o periodo selecionado", () => {
    const rows = [
      { matricula: "1", periodoInicial: "2026-04-21", periodoFinal: "2026-05-20" },
      { matricula: "2", periodoInicial: "2026-05-21", periodoFinal: "2026-06-20" },
      { matricula: "3", periodoInicial: "2026-07-01", periodoFinal: "2026-07-31" },
    ];
    const filtered = filterBancoHorasRowsByPeriod(rows, { de: "2026-05-05", ate: "2026-05-31" });
    assert.deepEqual(filtered.map((row) => row.matricula), ["1", "2"]);
  });
});