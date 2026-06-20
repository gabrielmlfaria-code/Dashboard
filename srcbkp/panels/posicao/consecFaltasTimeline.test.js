import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  buildEmpCalendarWeeks,
  buildEmpTimeline,
  buildRecentDayRecords,
  computeEmpViewStats,
  enumerateDateRange,
  fmtSequencia,
  resolveDefaultModalDates,
  resolveEmpPresenceRange,
  resolveModalDatesFromApuracao,
  resolvePresetDateFrom,
  resolveTimelineRange,
} from "./consecFaltasTimeline.js";

describe("consecFaltasTimeline", () => {
  it("enumera dias do intervalo inclusive", () => {
    assert.deepEqual(enumerateDateRange("2026-06-01", "2026-06-03"), [
      "2026-06-01",
      "2026-06-02",
      "2026-06-03",
    ]);
  });

  it("limita default do modal aos ultimos 31 dias do periodo de apuracao", () => {
    const defaults = resolveDefaultModalDates(
      { de: "2025-05-01", ate: "2026-06-03" },
      [{ date: "2025-05-01" }, { date: "2026-06-03" }],
    );
    assert.equal(defaults.dateTo, "2026-06-03");
    assert.equal(enumerateDateRange(defaults.dateFrom, defaults.dateTo).length, 31);
  });

  it("foca heatmap na sequencia quando o filtro passa de 14 dias", () => {
    const range = resolveTimelineRange("2026-05-04", "2026-06-03", "2026-05-26", "2026-05-27");
    assert.equal(range.focused, true);
    assert.ok(enumerateDateRange(range.viewFrom, range.viewTo).length <= 21);
    assert.ok(range.viewFrom <= "2026-05-26");
    assert.ok(range.viewTo >= "2026-05-27");
  });

  it("mostra periodo completo quando solicitado", () => {
    const range = resolveTimelineRange(
      "2026-05-04",
      "2026-06-03",
      "2026-05-26",
      "2026-05-27",
      { showFullPeriod: true },
    );
    assert.equal(range.focused, false);
    assert.equal(enumerateDateRange(range.viewFrom, range.viewTo).length, 31);
    assert.equal(range.viewFrom, "2026-05-04");
    assert.equal(range.viewTo, "2026-06-03");
  });

  it("modo tudo no heatmap usa intervalo De/Até sem zoom na sequencia", () => {
    const histRows = [
      {
        date: "2026-05-04",
        _employees: [{ mat: "1", cat: "presentes", hrsPres: 480 }],
      },
      {
        date: "2026-05-26",
        _employees: [{ mat: "1", cat: "falta", hrsAuse: 480 }],
      },
      {
        date: "2026-05-27",
        _employees: [{ mat: "1", cat: "falta", hrsAuse: 480 }],
      },
      {
        date: "2026-06-03",
        _employees: [{ mat: "1", cat: "presentes", hrsPres: 480 }],
      },
    ];
    const { days, focused, viewFrom, viewTo } = buildEmpTimeline({
      mat: "1",
      dateFrom: "2026-05-04",
      dateTo: "2026-06-03",
      histRows,
      streakInicio: "2026-05-26",
      streakFim: "2026-05-27",
      showFullPeriod: true,
    });
    assert.equal(focused, false);
    assert.equal(viewFrom, "2026-05-04");
    assert.equal(viewTo, "2026-06-03");
    assert.equal(days.length, 31);
  });

  it("monta heatmap com falta consecutiva destacada", () => {
    const histRows = [
      {
        date: "2026-06-01",
        _employees: [{ mat: "1", cat: "falta", hrsAuse: 480, nome: "Ana" }],
      },
      {
        date: "2026-06-02",
        _employees: [{ mat: "1", cat: "falta", hrsAuse: 480, nome: "Ana" }],
      },
      {
        date: "2026-06-03",
        _employees: [{ mat: "1", cat: "presentes", hrsPres: 480, nome: "Ana" }],
      },
    ];
    const { days } = buildEmpTimeline({
      mat: "1",
      dateFrom: "2026-06-01",
      dateTo: "2026-06-03",
      histRows,
      streakInicio: "2026-06-01",
      streakFim: "2026-06-02",
    });
    assert.equal(days.length, 3);
    assert.equal(days[0].status, "falta");
    assert.equal(days[1].status, "falta");
    assert.equal(days[2].status, "presente");
    assert.equal(days.filter((d) => d.inStreak).length, 2);
    assert.equal(days.filter((d) => d.isolatedFalta).length, 0);
  });

  it("marca falta fora da sequencia alertada como isolada", () => {
    const histRows = [
      {
        date: "2026-06-01",
        _employees: [{ mat: "1", cat: "falta", hrsAuse: 480, nome: "Ana" }],
      },
      {
        date: "2026-06-02",
        _employees: [{ mat: "1", cat: "falta", hrsAuse: 480, nome: "Ana" }],
      },
      {
        date: "2026-06-05",
        _employees: [{ mat: "1", cat: "falta", hrsAuse: 480, nome: "Ana" }],
      },
    ];
    const { days } = buildEmpTimeline({
      mat: "1",
      dateFrom: "2026-06-01",
      dateTo: "2026-06-05",
      histRows,
      streakInicio: "2026-06-01",
      streakFim: "2026-06-02",
      showFullPeriod: true,
    });
    const jun01 = days.find((d) => d.date === "2026-06-01");
    const jun05 = days.find((d) => d.date === "2026-06-05");
    assert.equal(jun01.inStreak, true);
    assert.equal(jun01.isolatedFalta, false);
    assert.equal(jun05.inStreak, false);
    assert.equal(jun05.isolatedFalta, true);
    assert.match(jun05.title, /Falta isolada/);
  });

  it("usa periodo de apuracao completo no modal sem recorte de 31 dias", () => {
    const defaults = resolveModalDatesFromApuracao(
      { de: "2025-05-01", ate: "2026-06-03" },
      [{ date: "2025-05-01" }, { date: "2026-06-03" }],
    );
    assert.equal(defaults.dateFrom, "2025-05-01");
    assert.equal(defaults.dateTo, "2026-06-03");
    assert.equal(enumerateDateRange(defaults.dateFrom, defaults.dateTo).length, 399);
  });

  it("resolve periodo atual da ficha pelo periodo de apuracao", () => {
    const range = resolveEmpPresenceRange(
      "atual",
      { de: "2026-05-01", ate: "2026-06-03" },
      "2026-05-04",
      "2026-06-03",
    );
    assert.equal(range.dateFrom, "2026-05-01");
    assert.equal(range.dateTo, "2026-06-03");
  });

  it("recorta periodo atual da ficha aos dados carregados no historico", () => {
    const range = resolveEmpPresenceRange(
      "atual",
      { de: "2025-05-01", ate: "2026-06-03" },
      "2025-05-01",
      "2026-06-03",
      [{ date: "2026-05-04" }, { date: "2026-06-03" }],
    );
    assert.equal(range.dateFrom, "2026-05-04");
    assert.equal(range.dateTo, "2026-06-03");
  });

  it("foca mapa da ficha nos ultimos dias quando apuracao e longa", () => {
    const histRows = [
      {
        date: "2026-05-04",
        _employees: [{ mat: "6028", cat: "presentes", hrsPres: 480 }],
      },
      {
        date: "2026-06-03",
        _employees: [{ mat: "6028", cat: "falta", hrsAuse: 480 }],
      },
    ];
    const { days, focused, viewFrom, viewTo } = buildEmpTimeline({
      mat: "6028",
      dateFrom: "2025-05-01",
      dateTo: "2026-06-03",
      histRows,
    });
    assert.equal(focused, true);
    assert.ok(days.length <= 42);
    assert.ok(viewFrom >= "2026-04-22");
    assert.equal(viewTo, "2026-06-03");
    assert.ok(days.some((day) => day.status === "presente"));
    assert.ok(days.some((day) => day.status === "falta"));
  });

  it("foca mapa da ficha nos dias com registro quando o fim do periodo esta vazio", () => {
    const histRows = [
      {
        date: "2026-01-10",
        _employees: [{ mat: "5920", cat: "falta", hrsAuse: 480, hrsPlan: 480, nome: "Valder" }],
      },
      {
        date: "2026-01-15",
        _employees: [{ mat: "5920", cat: "just", hrsJust: 480, hrsPlan: 480, nome: "Valder" }],
      },
    ];
    const { days, activityFocused, viewFrom, viewTo } = buildEmpTimeline({
      mat: "5920",
      nome: "Valder",
      dateFrom: "2025-05-01",
      dateTo: "2026-05-31",
      histRows,
    });
    assert.equal(activityFocused, true);
    assert.equal(viewFrom, "2026-01-10");
    assert.equal(viewTo, "2026-01-15");
    assert.equal(days.find((day) => day.date === "2026-01-10")?.status, "falta");
    assert.equal(days.find((day) => day.date === "2026-01-15")?.status, "just");
  });

  it("formata sequencia de datas", () => {
    assert.equal(fmtSequencia("2026-06-01", "2026-06-02"), "01/06/26 – 02/06/26");
  });

  it("aplica preset de 7 dias respeitando limite do modal", () => {
    assert.equal(resolvePresetDateFrom("2026-06-10", 7, "2026-05-01"), "2026-06-04");
    assert.equal(resolvePresetDateFrom("2026-06-10", 7, "2026-06-08"), "2026-06-08");
  });

  it("calcula KPIs do colaborador no intervalo", () => {
    const histRows = [
      {
        date: "2026-06-01",
        _employees: [{ mat: "1", cat: "falta", hrsAuse: 480 }],
      },
      {
        date: "2026-06-02",
        _employees: [{ mat: "1", cat: "presentes", hrsPres: 480 }],
      },
      {
        date: "2026-06-03",
        _employees: [{ mat: "1", cat: "atraso", hrsAtraso: 120 }],
      },
    ];
    const stats = computeEmpViewStats(histRows, "1", "2026-06-01", "2026-06-03");
    assert.equal(stats.presencas, 1);
    assert.equal(stats.faltas, 1);
    assert.equal(stats.atrasosMin, 2);
    assert.equal(stats.freqPct, 33);
  });

  it("calcula indice de absenteismo por horas planificadas", () => {
    const histRows = [
      {
        date: "2026-06-01",
        _employees: [{ mat: "1", cat: "falta", hrsAuse: 480, hrsPlan: 480 }],
      },
      {
        date: "2026-06-02",
        _employees: [{ mat: "1", cat: "presentes", hrsPres: 480, hrsPlan: 480 }],
      },
    ];
    const stats = computeEmpViewStats(histRows, "1", "2026-06-01", "2026-06-02");
    assert.equal(stats.absPct, 50);
  });

  it("lista dias recentes com registro para mini timeline", () => {
    const days = [
      { date: "2026-06-01", status: "falta", marcacoes: [] },
      { date: "2026-06-02", status: "presente", marcacoes: [{ time: "08:00", ok: true }] },
      { date: "2026-06-03", status: "off", marcacoes: [] },
    ];
    const recent = buildRecentDayRecords(days, { limit: 2 });
    assert.equal(recent.length, 2);
    assert.equal(recent[0].date, "2026-06-02");
    assert.equal(recent[1].date, "2026-06-01");
  });

  it("agrupa dias em semanas para mapa calendario", () => {
    const days = [
      { date: "2026-06-01", status: "presente" },
      { date: "2026-06-02", status: "falta" },
    ];
    const { weeks } = buildEmpCalendarWeeks(days);
    assert.equal(weeks.length, 1);
    assert.equal(weeks[0].filter(Boolean).length, 2);
  });
});
