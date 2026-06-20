import assert from "node:assert/strict";
import test from "node:test";

import {
  ABONOS_KIND,
  applyAbonosSheetImport,
  buildAbonosByDept,
  diagnoseAbonosPendentesSheet,
  formatAbonosImportSummary,
  getAbonosDetailRows,
  packAbonosStorage,
  parseAbonosCsv,
  parseAbonosEfetuadosSheet,
  parseAbonosPendentesSheet,
  sortAbonosRows,
} from "./abonosDept.js";

test("parseAbonosCsv ainda le CSV de backup", () => {
  const csv = `Departamento;Pendentes;Efetuados;SLA
RH;5;10;80
TI;2;8;90`;
  const stored = parseAbonosCsv(csv);
  assert.ok(stored?.rows?.RH);
  assert.equal(stored.rows.RH.pendentes, 5);
});

test("buildAbonosByDept conta cada evento ausente por departamento", () => {
  const histRows = [
    {
      _events: [
        { _cat: "ausentes", depto: "RH", evento: "Falta" },
        { _cat: "ausentes", depto: "RH", evento: "Atraso" },
        { _cat: "presentes", depto: "RH", evento: "Presenca" },
        { _cat: "ausentes", depto: "TI", evento: "Falta" },
      ],
    },
    {
      _events: [
        { _cat: "ausentes", depto: "RH", evento: "Falta" },
        { _cat: "ausentes", depto: "Logistica", evento: "Atraso" },
      ],
    },
  ];
  const { rows, totals } = buildAbonosByDept(null, { limit: 10, histRows });
  assert.equal(rows[0].dept, "RH");
  assert.equal(rows[0].pendentes, 3);
  assert.equal(totals.pendentes, 5);
  assert.equal(totals.efetuados, 0);
});

test("parseAbonosPendentesSheet importa layout da planilha do usuário", () => {
  const aoa = [
    [
      "Filial",
      "Departamento",
      "Matricula",
      "Nome",
      "Cargo",
      "Código do Evento de Origem",
      "Evento de Origem",
      "Data",
      "Horas",
    ],
    [
      "GIASSI CONFECCOES",
      "LAVANDERIA",
      "8617",
      "CRISTIANE MAXIMO CORREA",
      "TEC. DE PLANEJAMENTO DE PRODUCAO",
      "8069",
      "HORAS FALTA PARCIAL",
      "01/06/2026",
      "01:02",
    ],
    [
      "GIASSI CONFECCOES",
      "LASER",
      "8180",
      "ERICA OLIVEIRA DA COSTA",
      "OP LASER NIVEL 02",
      "40",
      "FALTA",
      "01/06/2026",
      "09:00",
    ],
  ];
  const parsed = parseAbonosPendentesSheet(aoa, { fileName: "abonos.xlsx" });
  assert.equal(parsed?.count, 2);
  assert.equal(parsed.colaboradores, 2);
  assert.equal(parsed.detailRows[0].departamento, "LAVANDERIA");
  assert.equal(parsed.detailRows[0].horasMin, 62);
  assert.equal(parsed.detailRows[1].horasMin, 540);
  assert.equal(parsed.detailRows[1].data, "2026-06-01");
});

test("buildAbonosByDept usa planilha importada por departamento", () => {
  const stored = packAbonosStorage(
    [
      { departamento: "LAVANDERIA", matricula: "1", nome: "A", data: "2026-06-01", horasMin: 60 },
      { departamento: "LAVANDERIA", matricula: "2", nome: "B", data: "2026-06-02", horasMin: 30 },
      { departamento: "LASER", matricula: "3", nome: "C", data: "2026-06-01", horasMin: 540 },
    ],
    { fileName: "abonos.xlsx" },
  );
  const { rows, totals } = buildAbonosByDept(null, { stored });
  assert.equal(totals.pendentes, 3);
  assert.equal(rows[0].dept, "LAVANDERIA");
  assert.equal(rows[0].pendentes, 2);
  assert.equal(rows[1].dept, "LASER");
});

test("diagnoseAbonosPendentesSheet detecta colunas faltantes", () => {
  const diagnosis = diagnoseAbonosPendentesSheet([["Matricula", "Nome"]]);
  assert.equal(diagnosis.ok, false);
  assert.ok(diagnosis.missingCols.includes("Departamento"));
});

test("formatAbonosImportSummary resume importação", () => {
  const msg = formatAbonosImportSummary(
    packAbonosStorage([{ departamento: "RH", matricula: "1", nome: "A", data: "2026-06-01", horasMin: 10 }]),
  );
  assert.match(msg, /1 ocorrência/);
});

test("sortAbonosRows ordena por pendentes", () => {
  const sorted = sortAbonosRows(
    [
      { dept: "A", pendentes: 1, efetuados: 0, sla: 50 },
      { dept: "B", pendentes: 9, efetuados: 0, sla: 50 },
    ],
    "pendentes",
    "desc",
  );
  assert.equal(sorted[0].dept, "B");
});

test("parseAbonosEfetuadosSheet grava em detailRowsEfetuados sem apagar pendentes", () => {
  const pend = parseAbonosPendentesSheet(
    [
      ["Departamento", "Matricula", "Nome", "Data", "Horas"],
      ["TI", "20", "Bob", "01/06/2026", "01:00"],
    ],
    { fileName: "pend.xlsx" },
  );
  assert.equal(pend?.countPendentes, 1);
  const merged = applyAbonosSheetImport(
    [{ departamento: "RH", matricula: "10", nome: "Ana", data: "2026-06-01", horasMin: 120 }],
    { fileName: "efet.xlsx", existingStored: pend },
    ABONOS_KIND.efetuados,
  );
  assert.equal(merged.countPendentes, 1);
  assert.equal(merged.countEfetuados, 1);
  assert.equal(getAbonosDetailRows(merged, ABONOS_KIND.efetuados)[0].departamento, "RH");
});

test("parseAbonosEfetuadosSheet importa layout da planilha", () => {
  const parsed = parseAbonosEfetuadosSheet(
    [
      ["Departamento", "Matricula", "Nome", "Data", "Horas"],
      ["LASER", "8180", "ERICA", "01/06/2026", "09:00"],
    ],
    { fileName: "efet.xlsx" },
  );
  assert.equal(parsed?.countEfetuados, 1);
  assert.equal(parsed.detailRowsEfetuados[0].departamento, "LASER");
});

test("buildAbonosByDept agrega pendentes e efetuados importados", () => {
  const stored = applyAbonosSheetImport(
    [{ departamento: "RH", matricula: "1", nome: "A", data: "2026-06-01", horasMin: 60 }],
    { fileName: "pend.xlsx" },
    ABONOS_KIND.pendentes,
  );
  const withEfet = applyAbonosSheetImport(
    [
      { departamento: "RH", matricula: "2", nome: "B", data: "2026-06-02", horasMin: 30 },
      { departamento: "TI", matricula: "3", nome: "C", data: "2026-06-01", horasMin: 540 },
    ],
    { fileName: "efet.xlsx", existingStored: stored },
    ABONOS_KIND.efetuados,
  );
  const { rows, totals } = buildAbonosByDept(null, { stored: withEfet });
  assert.equal(totals.pendentes, 1);
  assert.equal(totals.efetuados, 2);
  const rh = rows.find((r) => r.dept === "RH");
  assert.equal(rh.pendentes, 1);
  assert.equal(rh.efetuados, 1);
});

test("formatAbonosImportSummary resume efetuados", () => {
  const stored = applyAbonosSheetImport(
    [{ departamento: "RH", matricula: "1", nome: "A", data: "2026-06-01", horasMin: 10 }],
    { fileName: "efet.xlsx" },
    ABONOS_KIND.efetuados,
  );
  const msg = formatAbonosImportSummary(stored, ABONOS_KIND.efetuados);
  assert.match(msg, /Abonos efetuados importados/);
  assert.match(msg, /1 ocorrência/);
});

test("buildAbonosByDept respeita o periodo da planilha importada", () => {
  const stored = packAbonosStorage([
    { departamento: "RH", matricula: "1", nome: "A", data: "2026-06-01", horasMin: 60 },
    { departamento: "TI", matricula: "2", nome: "B", data: "2026-06-15", horasMin: 30 },
  ]);
  const histRows = [{ _events: [{ _cat: "ausentes", depto: "Fiscal", evento: "Falta" }] }];
  const juneFirst = buildAbonosByDept(null, {
    stored,
    histRows,
    periodo: { de: "2026-06-01", ate: "2026-06-01" },
  });
  assert.equal(juneFirst.totals.pendentes, 1);
  assert.equal(juneFirst.rows[0].dept, "RH");
  const may = buildAbonosByDept(null, {
    stored,
    histRows,
    periodo: { de: "2026-05-01", ate: "2026-05-31" },
  });
  assert.equal(may.totals.pendentes, 0);
  assert.equal(may.rows.length, 0);
});