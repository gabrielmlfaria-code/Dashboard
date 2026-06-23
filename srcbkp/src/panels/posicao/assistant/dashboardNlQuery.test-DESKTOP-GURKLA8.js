import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { buildDashboardNlContext, faltaInjustEventsFromRows } from "./dashboardNlContext.js";
import {
  answerDashboardNlQuestion,
  fmtMinutesReadable,
  getNlChipGroupIdForIntent,
  getNlChipGroupsForSurface,
  getNlChipsForSurface,
  matchDashboardNlIntent,
} from "./dashboardNlQuery.js";

describe("getNlChipsForSurface", () => {
  it("absenteísmo inclui chips de cards e risco do painel", () => {
    const ids = getNlChipsForSurface("absenteismo", {
      bancoHoras: { saldoMin: 120 },
      saudePreventiva: { ocorrencias: 1 },
      art473: { ocorrencias: 1 },
      abonos: { pendentes: 1, efetuados: 0 },
    }).map((c) => c.id);
    assert.equal(ids.includes("risco_total"), true);
    assert.equal(ids.includes("banco_horas_saldo"), true);
    assert.equal(ids.includes("abs_indice"), true);
    assert.equal(ids.includes("faltas_concentracao"), true);
    assert.equal(ids.includes("radar_dept_destaque"), false);
  });

  it("oculta chip de eventos quando só há falta genérica", () => {
    const ctx = {
      faltasAnalise: { ausentes: { onlyGeneric: true } },
    };
    const ids = getNlChipsForSurface("absenteismo", ctx).map((c) => c.id);
    assert.equal(ids.includes("faltas_eventos_ranking"), false);
    assert.equal(ids.includes("faltas_concentracao"), true);
  });

  it("oculta chips opcionais quando o contexto não tem dados", () => {
    const ids = getNlChipsForSurface("absenteismo", {
      bancoHoras: null,
      saudePreventiva: { ocorrencias: 0 },
      art473: { ocorrencias: 0 },
      abonos: { pendentes: 0, efetuados: 0 },
    }).map((c) => c.id);
    assert.equal(ids.includes("banco_horas_saldo"), false);
    assert.equal(ids.includes("saude_preventiva"), false);
    assert.equal(ids.includes("art_473_ausencias"), false);
    assert.equal(ids.includes("abonos_pendentes"), false);
    assert.equal(ids.includes("abs_indice"), true);
  });

  it("radar não inclui chips só de absenteísmo", () => {
    const ids = getNlChipsForSurface("radar").map((c) => c.id);
    assert.equal(ids.includes("risco_total"), true);
    assert.equal(ids.includes("abs_indice"), false);
  });
});

describe("linguagem natural para heatmap", () => {
  it("abre heatmap filtrado por colaborador e periodo", () => {
    const ctx = buildDashboardNlContext({
      histRows: [
        {
          date: "2026-05-20",
          _events: [
            {
              evento: "MAIS DE 6 HORAS SEM REFEICAO",
              _cat: "risco",
              mat: "10",
              nome: "JOSE FERNANDES DA SILVA",
              depto: "PRODUCAO",
            },
          ],
        },
      ],
      histRadar: { deptRanking: [{ dept: "PRODUCAO", ocorrencias: 1 }] },
      periodLabel: "30 dias",
    });

    assert.equal(
      matchDashboardNlIntent("criar heatmap do jose fernandes da silva nos ultimos 60 dias"),
      "heatmap_filtro",
    );

    const ans = answerDashboardNlQuestion(
      "criar heatmap do jose fernandes da silva nos ultimos 60 dias",
      ctx,
    );
    assert.equal(ans.intent, "heatmap_filtro");
    assert.equal(ans.action?.type, "open_radar_heatmap");
    assert.equal(ans.action?.filter?.field, "colaborador");
    assert.equal(ans.action?.filter?.value, "JOSE FERNANDES DA SILVA");
    assert.equal(ans.action?.period?.mode, "lastDays");
    assert.equal(ans.action?.period?.days, 60);
  });

  it("abre heatmap filtrado por departamento", () => {
    const ctx = buildDashboardNlContext({
      histRows: [
        {
          date: "2026-05-20",
          _events: [
            {
              evento: "MAIS DE 6 HORAS SEM REFEICAO",
              _cat: "risco",
              nome: "MARIA TESTE",
              depto: "PRODUCAO",
            },
          ],
        },
      ],
      histRadar: { deptRanking: [{ dept: "PRODUCAO", ocorrencias: 1 }] },
      periodLabel: "30 dias",
    });

    assert.equal(
      matchDashboardNlIntent("mapa de calor do departamento producao"),
      "heatmap_filtro",
    );

    const ans = answerDashboardNlQuestion("criar mapa de calor do departamento producao", ctx);
    assert.equal(ans.intent, "heatmap_filtro");
    assert.equal(ans.action?.type, "open_radar_heatmap");
    assert.equal(ans.action?.filter?.field, "departamento");
    assert.equal(ans.action?.filter?.value, "PRODUCAO");
  });
});

describe("getNlChipGroupIdForIntent", () => {
  it("mapeia intent de horas para card Horas", () => {
    assert.equal(getNlChipGroupIdForIntent("justificadas_mix"), "horas");
    assert.equal(getNlChipGroupIdForIntent("faltas_concentracao"), "faltas");
  });
});

describe("getNlChipGroupsForSurface", () => {
  it("agrupa chips de absenteísmo em cards temáticos", () => {
    const groups = getNlChipGroupsForSurface("absenteismo", {
      bancoHoras: { saldoMin: 120 },
      saudePreventiva: { ocorrencias: 1 },
      art473: { ocorrencias: 1 },
      abonos: { pendentes: 1, efetuados: 0 },
    });
    const ids = groups.map((g) => g.id);
    assert.equal(ids.includes("visao"), true);
    assert.equal(ids.includes("faltas"), true);
    assert.equal(ids.includes("horas"), true);
    assert.equal(ids.includes("pessoas"), true);
    assert.equal(ids.includes("cards"), true);
    const faltas = groups.find((g) => g.id === "faltas");
    assert.equal(
      faltas.chips.some((c) => c.id === "faltas_concentracao"),
      true,
    );
    const cards = groups.find((g) => g.id === "cards");
    assert.equal(
      cards.chips.some((c) => c.id === "banco_horas_saldo"),
      true,
    );
  });

  it("radar expõe risco e pessoas", () => {
    const groups = getNlChipGroupsForSurface("radar");
    assert.equal(
      groups.some((g) => g.id === "risco"),
      true,
    );
    assert.equal(
      groups.some((g) => g.id === "pessoas"),
      true,
    );
    assert.equal(
      groups.some((g) => g.id === "faltas"),
      false,
    );
  });
});

describe("fmtMinutesReadable", () => {
  it("formata horas e minutos", () => {
    assert.equal(fmtMinutesReadable(335379), "5.589 h 39 min");
    assert.equal(fmtMinutesReadable(45), "45 min");
  });
});

describe("matchDashboardNlIntent — novos cards", () => {
  it("detecta banco de horas e saúde preventiva", () => {
    assert.equal(matchDashboardNlIntent("Qual o saldo do banco de horas?"), "banco_horas_saldo");
    assert.equal(matchDashboardNlIntent("Como está a saúde preventiva?"), "saude_preventiva");
    assert.equal(matchDashboardNlIntent("Quantos abonos pendentes?"), "abonos_pendentes");
  });

  it("detecta art. 473 antes de saúde preventiva genérica", () => {
    assert.equal(
      matchDashboardNlIntent("Há ausências do art. 473 no período?"),
      "art_473_ausencias",
    );
    assert.equal(matchDashboardNlIntent("Faltas por exame preventivo CLT"), "art_473_ausencias");
  });

  it("detecta horas planejadas e ranking", () => {
    assert.equal(
      matchDashboardNlIntent("Quantas horas planejadas no período?"),
      "horas_planejadas",
    );
    assert.equal(
      matchDashboardNlIntent("Qual o ranking de departamentos?"),
      "ranking_departamentos",
    );
  });
});

describe("matchDashboardNlIntent", () => {
  it("detecta concentração de faltas", () => {
    assert.equal(
      matchDashboardNlIntent("Onde se concentram as faltas injustificadas?"),
      "faltas_concentracao",
    );
  });

  it("detecta absenteísmo", () => {
    assert.equal(matchDashboardNlIntent("qual o indice de absenteismo?"), "abs_indice");
  });
});

describe("answerDashboardNlQuestion — cards", () => {
  it("responde insights do período", () => {
    const ctx = buildDashboardNlContext({
      histRows: [],
      histRadar: { suggestions: ["Revisar escala no setor X."] },
      periodLabel: "7 dias",
    });
    const ans = answerDashboardNlQuestion("Quais alertas para o período?", ctx);
    assert.equal(ans.intent, "insights_periodo");
    assert.match(ans.text, /Revisar escala/);
  });
});

describe("answerDashboardNlQuestion", () => {
  const rows = [
    {
      date: "2026-05-01",
      total: 10,
      faltas: 2,
      atrasos: 0,
      justificadas: 0,
      presentes: 8,
      horas_planejadas: 480,
      horas_faltas: 60,
      horas_atrasos: 120,
      horas_justificadas: 0,
      _events: [
        { evento: "FALTA INJUSTIFICADA", _cat: "ausentes", mat: "1", nome: "A" },
        { evento: "FALTA INJUSTIFICADA", _cat: "ausentes", mat: "2", nome: "B" },
        { evento: "ATRASO", _cat: "ausentes", mat: "3", nome: "C" },
      ],
    },
  ];

  it("responde com evento específico quando existir", () => {
    const ctx = buildDashboardNlContext({
      histRows: [
        {
          date: "2026-05-01",
          _events: [
            { evento: "FALTA DIA SEGUINTE", _cat: "ausentes", mat: "1" },
            { evento: "FALTA NAO JUSTIFICADA", _cat: "ausentes", mat: "2" },
          ],
        },
      ],
      periodLabel: "mai/2026",
    });
    const res = answerDashboardNlQuestion("quais tipos de evento de falta aparecem mais", ctx);
    assert.equal(res.intent, "faltas_eventos_ranking");
    assert.equal(res.structured?.variant, "specific_events");
    assert.match(res.structured?.headline, /FALTA DIA SEGUINTE/);
  });

  it("filtra só falta quando pergunta menciona falta sem atraso", () => {
    assert.equal(faltaInjustEventsFromRows(rows).length, 2);
  });

  it("inclui filtro NL em respostas que abrem a tabela histórica", () => {
    const ctx = buildDashboardNlContext({
      histRows: rows,
      periodLabel: "mai/2026",
      histRadar: {
        deptRanking: [{ dept: "Produção", absPct: 12, hrsAuse: 300, hrsJust: 0 }],
      },
    });
    const presenca = answerDashboardNlQuestion("qual o percentual de presença", ctx);
    assert.equal(presenca.action?.filter?.field, "departamento");
    assert.equal(presenca.action?.filter?.value, "Produção");

    const comparacao = answerDashboardNlQuestion("faltas e atrasos no período", ctx);
    assert.equal(comparacao.action?.filter?.field, "evento");
    assert.equal(comparacao.action?.filter?.value, "FALTA");
  });
});
