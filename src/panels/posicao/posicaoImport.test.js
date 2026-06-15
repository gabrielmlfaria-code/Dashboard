import assert from "node:assert/strict";
import test from "node:test";
import XLSX from "xlsx-js-style";

import { buildPosListModalData, filterEventsForPosListKey } from "./posicaoHdmBridge.js";
import {
  _detectCategoryFromText,
  _fmtDate,
  _fmtTime,
  _inferCatFromEvent,
  _normHeader,
  _parseHorasMin,
  _parseMarcacoesString,
  _pickMainCat,
  applyImportOverrides,
  applyImportOverridesToHistorico,
  buildAbsenceListRows,
  buildAbsenceListRowsFromStats,
  buildDeptTopList,
  buildDiaPayloadFromHistRow,
  colaboradoresFromHistForCat,
  getColaboradoresFromGroup,
  isAtrasoHistEvent,
  mergeHistDayRow,
  syncHistRowAggregates,
  importPosicaoXlsxFile,
  normalizeGenero,
  normalizePosicaoDiaPayload,
  histRowHasEmployeeData,
  pickDefaultHistDate,
  resolveDiaPayload,
} from "./posicaoImport.js";

function makeWorkbookFile(sheets) {
  const wb = XLSX.utils.book_new();
  Object.entries(sheets).forEach(([name, rows]) => {
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(rows), name);
  });
  const bytes = XLSX.write(wb, { type: "array", bookType: "xlsx" });
  return {
    name: "teste.xlsx",
    async arrayBuffer() {
      return bytes;
    },
  };
}

test("normaliza cabecalhos e valores de data/hora", () => {
  assert.equal(_normHeader("Codigo do Departamento"), "codigo_do_departamento");
  assert.equal(_fmtTime("8:05"), "08:05");
  assert.equal(_fmtTime(0.5), "12:00");
  assert.equal(_fmtDate("19/05/2026"), "2026-05-19");
  assert.equal(_fmtDate(45000), "2023-03-15");
});

test("classifica categorias e escolhe prioridade principal", () => {
  assert.equal(_detectCategoryFromText("Ferias"), "ferias");
  assert.equal(_detectCategoryFromText("AT"), "atraso");
  assert.equal(_detectCategoryFromText("Nao controla ponto"), "nao_controla");
  assert.equal(_inferCatFromEvent("001", "Falta injustificada", 0), "falta");
  assert.equal(_inferCatFromEvent("010", "Horas trabalhadas", 480), "presentes");
  assert.equal(_pickMainCat(new Set(["presentes", "falta"])), "falta");
});

test("converte marcacoes e horas em minutos", () => {
  assert.deepEqual(_parseMarcacoesString("08:00 12:00 13:00 17:00"), [
    { time: "08:00", ok: true },
    { time: "12:00", ok: false },
    { time: "13:00", ok: true },
    { time: "17:00", ok: false },
  ]);
  assert.equal(_parseHorasMin("8:30"), 510);
  assert.equal(_parseHorasMin("1,5"), 90);
  assert.equal(_parseHorasMin(0.5), 720);
});

test("aplica overrides no dia e no historico", () => {
  const overrides = {
    data_referencia: "2026-05-19",
    falta: { colaboradores: [{ nome: "Ana" }, { nome: "Bruno" }] },
    presentes: { colaboradores: [{ nome: "Carla" }] },
  };

  assert.deepEqual(applyImportOverrides({}, overrides).falta, {
    total: 2,
    colaboradores: [{ nome: "Ana" }, { nome: "Bruno" }],
  });

  const hist = applyImportOverridesToHistorico([{ date: "2026-05-19" }], overrides);
  assert.equal(hist[0].total, 3);
  assert.equal(hist[0].faltas, 2);
  assert.equal(hist[0].abs_rate, 66.67);
});

test("mergeHistDayRow import parcial nao zera outras categorias", () => {
  const prev = {
    date: "2026-05-20",
    presentes: {
      total: 2,
      colaboradores: [
        { nome: "Ana", matricula: "1" },
        { nome: "Bea", matricula: "4" },
      ],
    },
    falta: { total: 1, colaboradores: [{ nome: "Bob", matricula: "2" }] },
    faltas: 1,
    total: 3,
  };
  const patch = {
    date: "2026-05-20",
    nao_controla: {
      total: 1,
      colaboradores: [{ nome: "Cia", matricula: "3" }],
    },
    presentes: 0,
    faltas: 0,
    atrasos: 0,
    total: 1,
  };
  const merged = mergeHistDayRow(prev, patch);
  assert.equal(getColaboradoresFromGroup(merged.presentes).length, 2);
  assert.equal(getColaboradoresFromGroup(merged.falta).length, 1);
  assert.equal(getColaboradoresFromGroup(merged.nao_controla).length, 1);
  assert.equal(merged.faltas, 1);
});

test("mergeHistDayRow import nao controla nao zera totais numericos", () => {
  const prev = {
    date: "2026-05-21",
    presentes: 364,
    faltas: 10,
    atrasos: 5,
    total: 379,
  };
  const patch = {
    date: "2026-05-21",
    nao_controla: {
      total: 2,
      colaboradores: [
        { nome: "Sem ponto A", matricula: "1" },
        { nome: "Sem ponto B", matricula: "2" },
      ],
    },
  };
  const merged = mergeHistDayRow(prev, patch);
  assert.equal(merged.presentes, 364);
  assert.equal(merged.faltas, 10);
  assert.equal(merged.atrasos, 5);
  assert.equal(getColaboradoresFromGroup(merged.nao_controla).length, 2);
  assert.equal(merged.total, 381);
});

test("buildDiaPayloadFromHistRow mantem totais numericos ao importar nao_controla", () => {
  const dia = buildDiaPayloadFromHistRow({
    date: "2026-05-21",
    presentes: 364,
    faltas: 10,
    atrasos: 5,
    nao_controla: { colaboradores: [{ nome: "Sem ponto", matricula: "99" }] },
  });
  assert.equal(dia.presentes.total, 364);
  assert.equal(dia.falta.total, 10);
  assert.equal(dia.atraso, undefined);
  assert.equal(getColaboradoresFromGroup(dia.nao_controla).length, 1);
});

test("buildDiaPayloadFromHistRow monta atrasos a partir de eventos", () => {
  const dia = buildDiaPayloadFromHistRow({
    date: "2026-05-21",
    presentes: 10,
    _events: [
      {
        mat: "42",
        nome: "Maria Atraso",
        depto: "RH",
        evento: "Atraso na entrada",
        cod: "ATR",
        horas: 0.25,
      },
    ],
  });
  assert.equal(getColaboradoresFromGroup(dia.atraso).length, 1);
  assert.equal(dia.atraso.colaboradores[0].nome, "Maria Atraso");
  assert.equal(isAtrasoHistEvent({ evento: "Atraso na entrada" }), true);
});

test("buildPosListModalData filtra eventos de atraso", () => {
  const data = buildPosListModalData({
    histRows: [
      {
        date: "2026-05-15",
        _events: [
          { mat: "1", nome: "A", data: "2026-05-15", evento: "Atraso", _cat: "ausentes" },
          { mat: "2", nome: "B", data: "2026-05-15", evento: "Normal", _cat: "presentes" },
        ],
      },
    ],
    dia: null,
    dateIso: "2026-05-15",
    posListKey: "atraso",
  });
  assert.equal(data.events.length, 1);
  assert.equal(data.events[0].nome, "A");
});

test("buildPosListModalData abre faltas por departamento com comparacao normalizada", () => {
  const data = buildPosListModalData({
    histRows: [
      {
        date: "2026-05-15",
        _events: [
          {
            mat: "1",
            nome: "A",
            data: "2026-05-15",
            evento: "Falta",
            _cat: "ausentes",
            depto: "AJDA - AJUDANTE 20HS",
          },
        ],
      },
    ],
    dia: null,
    dateIso: "2026-05-15",
    dateFrom: "2026-05-15",
    dateTo: "2026-05-15",
    posListKey: "falta",
    deptoFilter: "ajda - ajudante 20hs",
  });

  assert.equal(data.events.length, 1);
  assert.equal(data.events[0].nome, "A");
});

test("buildPosListModalData herda data da linha historica quando evento nao tem data", () => {
  const data = buildPosListModalData({
    histRows: [
      {
        date: "2026-05-31",
        _events: [
          { mat: "1", nome: "Ana", evento: "Presente", _cat: "presentes" },
          { mat: "2", nome: "Bruno", data: "2026-05-30", evento: "Presente", _cat: "presentes" },
        ],
      },
    ],
    dia: null,
    dateIso: "2026-05-31",
    dateFrom: "2026-05-31",
    dateTo: "2026-05-31",
    posListKey: "presentes",
  });

  assert.equal(data.events.length, 1);
  assert.equal(data.events[0].nome, "Ana");
  assert.equal(data.events[0].data, "2026-05-31");
});

test("buildPosListModalData sintetiza colaboradores sem eventos", () => {
  const data = buildPosListModalData({
    histRows: [],
    dia: {
      presentes: {
        colaboradores: [{ matricula: "9", nome: "Carlos", filial: "F1", depto_desc: "RH" }],
      },
    },
    dateIso: "2026-05-15",
    posListKey: "presentes",
  });
  assert.equal(data.events.length, 1);
  assert.equal(data.events[0].evento, "Presente");
  assert.equal(filterEventsForPosListKey(data.events, "presentes").length, 1);
});

test("buildPosListModalData ferias inclui data inicio e fim", () => {
  const data = buildPosListModalData({
    histRows: [],
    dia: {
      ferias: {
        colaboradores: [
          {
            matricula: "42",
            nome: "Maria",
            filial: "SP",
            depto_desc: "Comercial",
            cargo: "Analista",
            inicio: "2026-05-01",
            termino: "2026-05-15",
          },
        ],
      },
    },
    dateIso: "2026-05-15",
    posListKey: "ferias",
  });
  assert.equal(data.events.length, 1);
  assert.equal(data.events[0].evento, "Férias");
  assert.equal(data.events[0].inicio, "01/05/2026");
  assert.equal(data.events[0].termino, "15/05/2026");
});

test("buildPosListModalData ferias prioriza colaboradores consolidados sobre eventos brutos", () => {
  const data = buildPosListModalData({
    histRows: [
      {
        date: "2026-05-18",
        _events: [
          {
            mat: "1",
            nome: "Evento isolado",
            data: "2026-05-18",
            evento: "Férias",
            _cat: "justificadas",
          },
        ],
      },
    ],
    dia: {
      ferias: {
        colaboradores: [
          { matricula: "10", nome: "Ana", inicio: "2026-05-01", termino: "2026-05-20" },
          { matricula: "11", nome: "Bruno", inicio: "2026-05-10", termino: "2026-05-25" },
        ],
      },
    },
    dateIso: "2026-05-18",
    posListKey: "ferias",
  });
  assert.equal(data.events.length, 2);
  assert.deepEqual(
    data.events.map((ev) => ev.nome),
    ["Ana", "Bruno"],
  );
  assert.equal(data.events[0].evento, "Férias");
});

test("buildPosListModalData ferias hidrata inicio e fim pelo historico importado", () => {
  const data = buildPosListModalData({
    histRows: [
      {
        date: "2026-05-18",
        _employees: [
          {
            mat: "10",
            nome: "Ana",
            cat: "ferias",
            inicio: "2026-05-01",
            termino: "2026-05-20",
          },
        ],
      },
    ],
    dia: {
      ferias: {
        colaboradores: [{ matricula: "10", nome: "Ana" }],
      },
    },
    dateIso: "2026-05-18",
    posListKey: "ferias",
  });
  assert.equal(data.events.length, 1);
  assert.equal(data.events[0].inicio, "01/05/2026");
  assert.equal(data.events[0].termino, "20/05/2026");
});

test("colaboradoresFromHistForCat le _employees com cat atraso", () => {
  const row = {
    _employees: [
      { mat: "1", nome: "Joao", cat: "atraso", depto: "TI" },
      { mat: "2", nome: "Ana", cat: "presentes", depto: "TI" },
    ],
  };
  assert.equal(colaboradoresFromHistForCat(row, "atraso").length, 1);
  assert.equal(colaboradoresFromHistForCat(row, "atraso")[0].nome, "Joao");
});

test("resolveDiaPayload nao zera ao importar so nao_controla", () => {
  const dia = resolveDiaPayload({
    apiData: null,
    histRows: [{ date: "2026-05-21", presentes: 364, faltas: 10, atrasos: 5 }],
    importOverrides: {
      v: 2,
      byDate: {
        "2026-05-21": {
          data_referencia: "2026-05-21",
          nao_controla: { colaboradores: [{ nome: "Y", matricula: "2" }] },
        },
      },
    },
    date: "2026-05-21",
  });
  assert.equal(dia.presentes.total, 364);
  assert.equal(dia.falta.total, 10);
  assert.equal(dia.nao_controla.total, 1);
});

test("syncHistRowAggregates preserva presentes numericos", () => {
  const row = syncHistRowAggregates({
    date: "2026-05-21",
    presentes: 100,
    faltas: 3,
    nao_controla: { colaboradores: [{ nome: "X", matricula: "9" }] },
  });
  assert.equal(row.presentes, 100);
  assert.equal(row.faltas, 3);
  assert.equal(row.total, 104);
});

test("buildDeptTopList top 10 presentes e ausentes por departamento", () => {
  const day = {
    presentes: {
      colaboradores: [
        { nome: "A", depto_desc: "RH" },
        { nome: "B", depto_desc: "RH" },
        { nome: "C", depto_desc: "TI" },
      ],
    },
    falta: { colaboradores: [{ nome: "D", depto_desc: "TI", matricula: "1" }] },
    atraso: { colaboradores: [{ nome: "E", depto_desc: "TI", matricula: "2" }] },
  };
  const pres = buildDeptTopList(day, "presentes", 10);
  assert.equal(pres.length, 2);
  assert.equal(pres[0].name, "RH");
  assert.equal(pres[0].v, 2);
  const aus = buildDeptTopList(day, "ausentes", 10);
  assert.equal(aus[0].name, "TI");
  assert.equal(aus[0].v, 2);
});

test("monta lista de ausencias por colaborador", () => {
  const day = normalizePosicaoDiaPayload({
    falta: { colaboradores: [{ nome: "Ana Silva", depto_desc: "RH" }] },
    atraso: { colaboradores: [{ nome: "Bruno Costa", depto: "TI" }] },
  });
  const rows = buildAbsenceListRows(day, "asc");
  assert.equal(rows.length, 2);
  assert.equal(rows[0].name, "Ana Silva");
  assert.equal(rows[1].name, "Bruno Costa");
  assert.equal(rows.find((r) => r.name === "Ana Silva")?.label, "Falta");
});

test("histRowHasEmployeeData detecta linha com nomes", () => {
  assert.equal(histRowHasEmployeeData({ presentes: 3 }), false);
  assert.equal(
    histRowHasEmployeeData({ falta: { colaboradores: [{ nome: "A" }] } }),
    true,
  );
});

test("pickDefaultHistDate prioriza dia com nomes na planilha", () => {
  const rows = [
    { date: "2026-05-10", presentes: 5 },
    { date: "2026-05-18", _employees: [{ nome: "Ana", cat: "falta", depto_desc: "RH" }] },
  ];
  assert.equal(pickDefaultHistDate(rows, ""), "2026-05-18");
  assert.equal(pickDefaultHistDate(rows, "2026-05-10"), "2026-05-10");
});

test("resolve dia com planilha nao mistura categorias do mock API", () => {
  const mockApi = {
    data_referencia: "2026-05-20",
    presentes: { total: 200, colaboradores: [{ nome: "Mock Presente", matricula: "m1" }] },
    falta: { total: 50, colaboradores: [{ nome: "Mock Falta", matricula: "m2" }] },
  };
  const histRow = {
    date: "2026-05-20",
    presentes: { total: 1, colaboradores: [{ nome: "Planilha", matricula: "p1" }] },
  };
  const resolved = resolveDiaPayload({
    apiData: mockApi,
    histRows: [histRow],
    date: "2026-05-20",
  });
  assert.equal(getColaboradoresFromGroup(resolved?.presentes).length, 1);
  assert.equal(getColaboradoresFromGroup(resolved?.presentes)[0].nome, "Planilha");
  assert.equal(getColaboradoresFromGroup(resolved?.falta).length, 0);
});

test("resolve dia a partir da linha da planilha importada", () => {
  const histRow = {
    date: "2026-05-18",
    falta: { colaboradores: [{ nome: "Maria", depto_desc: "RH" }] },
    atraso: { colaboradores: [{ nome: "Joao", depto_desc: "TI" }] },
  };
  const dia = buildDiaPayloadFromHistRow(histRow);
  const rows = buildAbsenceListRows(dia, "asc");
  assert.equal(rows.length, 2);
  const resolved = resolveDiaPayload({
    apiData: { presentes: { total: 0, colaboradores: [] } },
    histRows: [histRow],
    date: "2026-05-18",
  });
  assert.equal(getColaboradoresFromGroup(resolved?.falta).length, 1);
});

test("fallback por departamento quando API so tem totais", () => {
  const rows = buildAbsenceListRowsFromStats([
    { depto: "Expedição", falta: 3, atraso: 1 },
    { depto: "RH", falta: 0, atraso: 0 },
  ]);
  assert.equal(rows.length, 1);
  assert.equal(rows[0].legacyDept, true);
  assert.equal(rows[0].v, 4);
});

test("_inferCatFromEvent classifica atraso e nao presentes", () => {
  assert.equal(_inferCatFromEvent("", "Atraso na entrada", 0), "atraso");
  assert.equal(_inferCatFromEvent("ATR", "Atrasados", 0), "atraso");
  assert.equal(_inferCatFromEvent("", "Hora normal trabalhada", 60), "presentes");
});

test("importa atrasados pelo nome do arquivo mesmo com status normal", async () => {
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(
    wb,
    XLSX.utils.aoa_to_sheet([
      ["Matricula", "Nome", "Departamento", "Status"],
      ["1", "Maria", "RH", "Normal"],
    ]),
    "Plan1",
  );
  const bytes = XLSX.write(wb, { type: "array", bookType: "xlsx" });
  const file = {
    name: "atrasados_20-05-2026.xlsx",
    async arrayBuffer() {
      return bytes;
    },
  };
  const result = await importPosicaoXlsxFile(file, { targetDate: "2026-05-20" });
  assert.equal(result.byCat.atraso?.length, 1);
  assert.equal(result.byCat.atraso[0].nome, "Maria");
  assert.equal(result.byCat.presentes, undefined);
});

test("importa lista so com coluna nome e categoria pelo arquivo", async () => {
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(
    wb,
    XLSX.utils.aoa_to_sheet([
      ["Nome", "Departamento"],
      ["Carlos", "TI"],
    ]),
    "Dados",
  );
  const bytes = XLSX.write(wb, { type: "array", bookType: "xlsx" });
  const file = {
    name: "relatorio_faltas_19-05-2026.xlsx",
    async arrayBuffer() {
      return bytes;
    },
  };
  const result = await importPosicaoXlsxFile(file, { targetDate: "2026-05-19" });
  assert.equal(result.byCat.falta?.length, 1);
  assert.equal(result.byCat.falta[0].nome, "Carlos");
});

test("importa planilha simples de colaboradores por categoria", async () => {
  const file = makeWorkbookFile({
    Presentes: [
      ["Data", "Matricula", "Nome", "Departamento", "Cargo", "Horario", "Marcacoes"],
      ["19/05/2026", "1", "Ana", "RH", "Analista", "08:00 12:00 13:00 17:00", "08:00 12:00"],
    ],
    Falta: [
      ["Data", "Matricula", "Nome", "Departamento", "Cargo"],
      ["19/05/2026", "2", "Bruno", "TI", "Dev"],
    ],
  });

  const result = await importPosicaoXlsxFile(file, { targetDate: "2026-05-19" });

  assert.equal(result.dataRefFinal, "2026-05-19");
  assert.equal(result.byCat.presentes.length, 1);
  assert.equal(result.byCat.falta.length, 1);
  assert.equal(result.byCat.presentes[0].nome, "Ana");
});

test("importa colaborador.genero e normaliza para M ou F", async () => {
  const file = makeWorkbookFile({
    Presentes: [
      ["Data", "Matricula", "Nome", "colaborador.genero"],
      ["19/05/2026", "1", "Ana", "Feminino"],
      ["19/05/2026", "2", "Bruno", "masculino"],
    ],
  });

  const result = await importPosicaoXlsxFile(file, { targetDate: "2026-05-19" });

  assert.equal(result.byCat.presentes[0].genero, "F");
  assert.equal(result.byCat.presentes[1].genero, "M");
  assert.equal(normalizeGenero("F"), "F");
  assert.equal(normalizeGenero("M"), "M");
});

test("importa periodo de ferias e afastamento com nomes alternativos de coluna", async () => {
  const file = makeWorkbookFile({
    Férias: [
      ["Matricula", "Nome", "Departamento", "Data Inicial", "Data Final"],
      ["10", "Maria", "RH", "01/05/2026", "15/05/2026"],
    ],
    Afastados: [
      ["Matricula", "Nome", "Departamento", "Início Afastamento", "Fim Afastamento", "Justificativa"],
      ["20", "Joao", "TI", "10/05/2026", "20/05/2026", "Atestado"],
    ],
  });

  const result = await importPosicaoXlsxFile(file, { targetDate: "2026-05-19" });

  assert.equal(result.byCat.ferias[0].inicio, "2026-05-01");
  assert.equal(result.byCat.ferias[0].termino, "2026-05-15");
  assert.equal(result.byCat.afastados[0].inicio, "2026-05-10");
  assert.equal(result.byCat.afastados[0].termino, "2026-05-20");
  assert.equal(result.byCat.afastados[0].justificativa, "Atestado");
});

test("importa periodo de ferias com colunas numeradas", async () => {
  const file = makeWorkbookFile({
    Férias: [
      ["Matricula", "Nome", "Data Início 1", "Data Fim 1"],
      ["10", "Ana", "01/05/2026", "15/05/2026"],
    ],
  });

  const result = await importPosicaoXlsxFile(file, { targetDate: "2026-05-19" });

  assert.equal(result.byCat.ferias[0].inicio, "2026-05-01");
  assert.equal(result.byCat.ferias[0].termino, "2026-05-15");
});

test("formato de eventos preserva periodo em _employees para ferias e afastados", async () => {
  const file = makeWorkbookFile({
    Eventos: [
      [
        "Data",
        "Matricula",
        "Nome",
        "evento.codigo",
        "evento.descricao",
        "Data Inicial",
        "Data Final",
      ],
      ["19/05/2026", "10", "Maria", "FER", "Férias", "01/05/2026", "15/05/2026"],
      ["19/05/2026", "20", "Joao", "LIC", "Licença médica", "10/05/2026", "20/05/2026"],
    ],
  });

  const result = await importPosicaoXlsxFile(file, { targetDate: "2026-05-19" });
  const hist = result.tabelaRows.find((r) => r.date === "2026-05-19");
  const ferias = colaboradoresFromHistForCat(hist, "ferias");
  const afastados = colaboradoresFromHistForCat(hist, "afastados");

  assert.equal(ferias[0].inicio, "2026-05-01");
  assert.equal(ferias[0].termino, "2026-05-15");
  assert.equal(afastados[0].inicio, "2026-05-10");
  assert.equal(afastados[0].termino, "2026-05-20");
});
