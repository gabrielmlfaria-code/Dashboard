import React, { useEffect, useMemo, useState } from "react";
import {
  buildEmpTimeline,
  buildRecentDayRecords,
  computeEmpViewStats,
  fmtSequencia,
  fmtShortDate,
  resolvePresetDateFrom,
  TIMELINE_LEGEND,
  TIMELINE_LEGEND_DRILL,
  TIMELINE_PRESETS,
} from "./consecFaltasTimeline.js";

const CELL_PX = 28;

function statusLabel(status) {
  return TIMELINE_LEGEND.find((item) => item.status === status)?.label || status;
}

function TimelineLegend() {
  return (
    <div className="pb-consec-timeline-legend pb-consec-timeline-legend--top" aria-hidden="true">
      {TIMELINE_LEGEND_DRILL.map((item) => (
        <span key={item.status} className="pb-consec-timeline-legend-item">
          <i className={`pb-consec-timeline-swatch pb-consec-timeline-swatch--${item.status}`} />
          {item.label}
        </span>
      ))}
      <span className="pb-consec-timeline-legend-item pb-consec-timeline-legend-streak">
        <i className="pb-consec-timeline-swatch pb-consec-timeline-swatch--streak" />
        Sequência alertada
      </span>
      <span className="pb-consec-timeline-legend-item pb-consec-timeline-legend-isolated">
        <i className="pb-consec-timeline-swatch pb-consec-timeline-swatch--isolated-falta" />
        Falta isolada
      </span>
    </div>
  );
}

function MarcBadges({ marcacoes }) {
  if (!marcacoes?.length) {
    return <span className="pb-consec-timeline-punch-empty">Sem marcações</span>;
  }
  return marcacoes.map((m, idx) => (
    <span key={`${m?.time || idx}`} className={`pb-consec-timeline-punch ${m?.ok ? "is-ok" : "is-fail"}`}>
      {m?.time || "--:--"}
    </span>
  ));
}

export function ConsecFaltasTimeline({
  row,
  scopedRows,
  dateFrom,
  dateTo,
  onClose,
}) {
  const [presetDays, setPresetDays] = useState(null);
  const [selectedDate, setSelectedDate] = useState(null);

  const effectiveFrom = useMemo(
    () => resolvePresetDateFrom(dateTo, presetDays, dateFrom),
    [dateFrom, dateTo, presetDays],
  );

  useEffect(() => {
    setPresetDays(null);
  }, [row.mat, dateFrom, dateTo]);

  const stats = useMemo(
    () => computeEmpViewStats(scopedRows, row.mat, effectiveFrom, dateTo),
    [scopedRows, row.mat, effectiveFrom, dateTo],
  );

  const timeline = useMemo(
    () =>
      buildEmpTimeline({
        mat: row.mat,
        dateFrom: effectiveFrom,
        dateTo,
        histRows: scopedRows,
        streakInicio: row.inicio,
        streakFim: row.fim,
        showFullPeriod: presetDays == null,
      }),
    [row.mat, row.inicio, row.fim, scopedRows, effectiveFrom, dateTo, presetDays],
  );

  const { days, viewFrom, viewTo } = timeline;

  const recentDays = useMemo(() => buildRecentDayRecords(days, { limit: 5 }), [days]);

  const selectedDay = useMemo(
    () => days.find((d) => d.date === selectedDate) || null,
    [days, selectedDate],
  );

  useEffect(() => {
    if (selectedDate && days.some((d) => d.date === selectedDate)) return;
    const firstStreak = days.find((d) => d.inStreak);
    setSelectedDate(firstStreak?.date ?? days[days.length - 1]?.date ?? null);
  }, [days, selectedDate, row.mat]);

  if (!days.length) {
    return (
      <div className="pb-consec-timeline pb-consec-timeline--empty">
        Selecione um intervalo De/Até válido para exibir a linha do tempo.
      </div>
    );
  }

  const presetLabel = presetDays ? `${presetDays}d` : "Tudo";

  const mapFrom = presetDays == null ? dateFrom : viewFrom;
  const mapTo = presetDays == null ? dateTo : viewTo;

  return (
    <div className="pb-consec-timeline pb-consec-timeline--hybrid">
      <div className="pb-consec-timeline-topbar">
        <div className="pb-consec-timeline-profile">
          <div className="pb-consec-timeline-profile-main">
            <span className="pb-consec-timeline-profile-dot" aria-hidden="true" />
            <div>
              <strong>{row.nome}</strong>
              <span>{row.depto || "—"}</span>
            </div>
          </div>
          <div className="pb-consec-timeline-profile-meta">
            Sequência: {fmtSequencia(row.inicio, row.fim)} · {row.dias} dia{row.dias === 1 ? "" : "s"}
          </div>
        </div>
        {onClose ? (
          <button
            type="button"
            className="pb-consec-timeline-close"
            onClick={onClose}
            aria-label="Fechar detalhe do colaborador"
          >
            ×
          </button>
        ) : null}
      </div>

      <TimelineLegend />

      <div className="pb-consec-timeline-kpis" aria-label="Indicadores do período">
        <div className="pb-consec-timeline-kpi pb-consec-timeline-kpi--pres">
          <span className="pb-consec-timeline-kpi-lbl">Presenças</span>
          <strong>{stats.presencas}</strong>
        </div>
        <div className="pb-consec-timeline-kpi pb-consec-timeline-kpi--falt">
          <span className="pb-consec-timeline-kpi-lbl">Faltas</span>
          <strong>{stats.faltas}</strong>
        </div>
        <div className="pb-consec-timeline-kpi pb-consec-timeline-kpi--atr">
          <span className="pb-consec-timeline-kpi-lbl">Atrasos</span>
          <strong>{stats.atrasosMin > 0 ? `${stats.atrasosMin}min` : "0"}</strong>
        </div>
        <div className="pb-consec-timeline-kpi pb-consec-timeline-kpi--freq">
          <span className="pb-consec-timeline-kpi-lbl">Freq.</span>
          <strong>{stats.freqPct != null ? `${stats.freqPct}%` : "—"}</strong>
        </div>
      </div>

      <div className="pb-consec-timeline-toolbar">
        <div className="pb-consec-timeline-presets" role="group" aria-label="Período rápido">
          {TIMELINE_PRESETS.map((daysOpt) => (
            <button
              key={daysOpt}
              type="button"
              className={`pb-consec-timeline-preset${presetDays === daysOpt ? " is-active" : ""}`}
              onClick={() => setPresetDays((cur) => (cur === daysOpt ? null : daysOpt))}
            >
              {daysOpt}d
            </button>
          ))}
          <button
            type="button"
            className={`pb-consec-timeline-preset${presetDays == null ? " is-active" : ""}`}
            onClick={() => setPresetDays(null)}
          >
            Tudo
          </button>
        </div>
      </div>

      <div className="pb-consec-timeline-map-head">
        <span>
          Mapa de presença ({presetLabel}) · {fmtShortDate(mapFrom)} – {fmtShortDate(mapTo)}
        </span>
      </div>

      <div className="pb-consec-timeline-scroll" role="img" aria-label={`Linha do tempo de ${row.nome}`}>
        <div
          className="pb-consec-timeline-grid"
          style={{
            gridTemplateColumns: `repeat(${days.length}, ${CELL_PX}px)`,
            width: `${days.length * CELL_PX}px`,
          }}
        >
          {days.map((day) => (
            <div key={day.date} className="pb-consec-timeline-col">
              <span className="pb-consec-timeline-dow">{day.dowLabel}</span>
              <button
                type="button"
                className={`pb-consec-timeline-cell pb-consec-timeline-cell--${day.status}${day.inStreak ? " is-streak" : ""}${day.isolatedFalta ? " is-isolated-falta" : ""}${selectedDate === day.date ? " is-selected" : ""}`}
                title={day.title}
                aria-label={day.title}
                aria-pressed={selectedDate === day.date}
                onClick={() => setSelectedDate(day.date)}
              />
              <span className="pb-consec-timeline-day">{day.dayLabel}</span>
            </div>
          ))}
        </div>
      </div>

      {selectedDay ? (
        <div className="pb-consec-timeline-day-detail">
          <div className="pb-consec-timeline-day-detail-head">
            <strong>{fmtShortDate(selectedDay.date)}</strong>
            <span className={`pb-consec-timeline-day-status pb-consec-timeline-day-status--${selectedDay.status}`}>
              {statusLabel(selectedDay.status)}
              {selectedDay.inStreak ? " · sequência alertada" : ""}
              {selectedDay.isolatedFalta ? " · falta isolada" : ""}
            </span>
          </div>
          <div className="pb-consec-timeline-day-detail-punches">
            <MarcBadges marcacoes={selectedDay.marcacoes} />
          </div>
        </div>
      ) : null}

      {recentDays.length ? (
        <div className="pb-consec-timeline-records">
          <div className="pb-consec-timeline-records-head">Últimos registros</div>
          <ul className="pb-consec-timeline-records-list">
            {recentDays.map((day) => (
              <li key={day.date}>
                <button
                  type="button"
                  className={`pb-consec-timeline-records-item${selectedDate === day.date ? " is-active" : ""}`}
                  onClick={() => setSelectedDate(day.date)}
                >
                  <span className="pb-consec-timeline-records-date">{fmtShortDate(day.date)}</span>
                  <span className={`pb-consec-timeline-records-status pb-consec-timeline-day-status--${day.status}`}>
                    {statusLabel(day.status)}
                  </span>
                  <span className="pb-consec-timeline-records-punches">
                    <MarcBadges marcacoes={day.marcacoes} />
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </div>
  );
}
