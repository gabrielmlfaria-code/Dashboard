import React from "react";
import {
  ABSENT_HOURS_TOOLTIP,
  RADAR_KPI_TOOLTIPS,
  RADAR_HOURS_TOOLTIPS,
  WORK_HOURS_TOOLTIP,
} from "./radarKpiTooltips.js";
import { RadarTrendSparkline } from "./RadarTrendSparkline.jsx";

function pctOfPlan(minutes, planMinutes) {
  if (!planMinutes || planMinutes <= 0) return null;
  return `${((minutes / planMinutes) * 100).toFixed(1).replace(".", ",")}% planejadas`;
}

const HOUR_ITEMS = [
  {
    key: "injust",
    label: "Injustificadas",
    field: "horasAus",
    hint: "Faltas + atrasos",
    metric: "injust",
    tableCol: "ause_hrs",
  },
  {
    key: "just",
    label: "Justificadas",
    field: "horasJust",
    hint: "Com justificativa",
    metric: "just",
    tableCol: "just_hrs",
  },
  {
    key: "extr",
    label: "Extras",
    field: "horasExtras",
    hint: "Além da jornada",
    metric: "extr",
    tableCol: "extr_hrs",
  },
];

const CONSEC_ITEM = {
  key: "consec",
  label: "Faltas consecutivas",
  field: "faltasConsecColaboradores",
  hint: "2+ dias seguidos",
  metric: "consec",
};

export const HOURS_FACE_TABLE_COL = Object.fromEntries(
  HOUR_ITEMS.map((i) => [i.key, i.tableCol]),
);

function fmtColabCount(n) {
  return Number(n || 0).toLocaleString("pt-BR");
}

function renderHourItem(t, { fmtHM, horasPlan, histRows, onOpenTableCol }) {
  const linkCls = `pb-radar-hours-face-item pb-radar-hours-face-item--${t.key}${onOpenTableCol ? " pb-radar-hours-face-item--link" : ""}`;
  const body = (
    <>
      <span className="pb-radar-hours-face-label">{t.label}</span>
      <strong className="pb-radar-hours-face-value">{fmtHM(t.value)}</strong>
      <RadarTrendSparkline rows={histRows} metric={t.metric} variant="compact" />
      <span className="pb-radar-hours-face-sub">
        {horasPlan > 0 ? pctOfPlan(t.value, horasPlan) : t.hint}
      </span>
    </>
  );

  if (onOpenTableCol) {
    return (
      <button
        key={t.key}
        type="button"
        className={linkCls}
        title={`${RADAR_HOURS_TOOLTIPS[t.key]} — ver na tabela`}
        onClick={() => onOpenTableCol(t.tableCol)}
      >
        {body}
      </button>
    );
  }

  return (
    <div key={t.key} className={linkCls} title={RADAR_HOURS_TOOLTIPS[t.key]}>
      {body}
    </div>
  );
}

function renderConsecItem(consec, { histRows, onOpenConsecFaltas }) {
  const count = Number(consec.value) || 0;
  const hint = onOpenConsecFaltas ? "2+ dias seguidos · toque para ver" : consec.hint;
  const linkCls = `pb-radar-hours-face-item pb-radar-hours-face-item--${consec.key}${onOpenConsecFaltas ? " pb-radar-hours-face-item--link" : ""}`;

  const body = (
    <>
      <span className="pb-radar-hours-face-label">{consec.label}</span>
      <strong className="pb-radar-hours-face-value">{fmtColabCount(count)}</strong>
      <RadarTrendSparkline
        rows={histRows}
        metric={consec.metric}
        variant="compact"
        formatValue={(v) => `${Math.round(Number(v) || 0)} colab.`}
      />
      <span className="pb-radar-hours-face-sub">{hint}</span>
    </>
  );

  if (onOpenConsecFaltas) {
    return (
      <button
        key={consec.key}
        type="button"
        className={linkCls}
        title={`${RADAR_HOURS_TOOLTIPS[consec.key]} — ver colaboradores`}
        onClick={onOpenConsecFaltas}
      >
        {body}
      </button>
    );
  }

  return (
    <div key={consec.key} className={linkCls} title={RADAR_HOURS_TOOLTIPS[consec.key]}>
      {body}
    </div>
  );
}

export function RadarHoursFace({
  histRadar,
  histRows,
  fmtHMReadable,
  hasHours,
  variant = "bar",
  onOpenTableCol,
  onOpenConsecFaltas,
}) {
  if (!hasHours || !histRadar) return null;

  const fmtHM = fmtHMReadable || ((m) => String(m));
  const horasPlan = Number(histRadar.horasPlan) || 0;
  const horasPres = Number(histRadar.horasPres) || 0;
  const horasAbs = Number(histRadar.horasAbs) || 0;
  const hoursTotal =
    (Number(histRadar.horasAus) || 0) +
    (Number(histRadar.horasJust) || 0) +
    (Number(histRadar.horasExtras) || 0);

  const items = HOUR_ITEMS.map((def) => ({
    ...def,
    value: Number(histRadar[def.field]) || 0,
  }));

  const consecItem = {
    ...CONSEC_ITEM,
    value: Number(histRadar[CONSEC_ITEM.field]) || 0,
  };

  if (variant === "inline") {
    return (
      <div className="pb-radar-hours-inline" aria-label="Horas injustificadas, justificadas e extras">
        {items.map((t) => {
          const linkCls = `pb-radar-hours-inline-item pb-radar-hours-inline-item--${t.key}${onOpenTableCol ? " pb-radar-hours-face-item--link" : ""}`;
          if (onOpenTableCol) {
            return (
              <button
                key={t.key}
                type="button"
                className={linkCls}
                title={`${RADAR_HOURS_TOOLTIPS[t.key]} — ver na tabela`}
                onClick={() => onOpenTableCol(t.tableCol)}
              >
                <span className="pb-radar-hours-inline-label">{t.label}</span>
                <strong>{fmtHM(t.value)}</strong>
                {horasPlan > 0 && <small>{pctOfPlan(t.value, horasPlan)}</small>}
              </button>
            );
          }
          return (
            <div key={t.key} className={linkCls} title={RADAR_HOURS_TOOLTIPS[t.key]}>
              <span className="pb-radar-hours-inline-label">{t.label}</span>
              <strong>{fmtHM(t.value)}</strong>
              {horasPlan > 0 && <small>{pctOfPlan(t.value, horasPlan)}</small>}
            </div>
          );
        })}
        {onOpenConsecFaltas ? (
          <button
            type="button"
            className={`pb-radar-hours-inline-item pb-radar-hours-inline-item--${consecItem.key} pb-radar-hours-face-item--link`}
            title={`${RADAR_HOURS_TOOLTIPS[consecItem.key]} — ver colaboradores`}
            onClick={onOpenConsecFaltas}
          >
            <span className="pb-radar-hours-inline-label">{consecItem.label}</span>
            <strong>{fmtColabCount(consecItem.value)}</strong>
            <small>toque para ver</small>
          </button>
        ) : (
          <div
            className={`pb-radar-hours-inline-item pb-radar-hours-inline-item--${consecItem.key}`}
            title={RADAR_HOURS_TOOLTIPS[consecItem.key]}
          >
            <span className="pb-radar-hours-inline-label">{consecItem.label}</span>
            <strong>{fmtColabCount(consecItem.value)}</strong>
            <small>{consecItem.hint}</small>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="pb-radar-hours-face" aria-label="Horas injustificadas, justificadas e extras no período">
      <div className="pb-radar-hours-face-head">
        <span className="pb-radar-hours-face-title">Horas no período</span>
        <span className="pb-radar-hours-face-hint">
          Injustificadas · Justificadas · Extras · Faltas consecutivas
        </span>
      </div>
      <div className="pb-radar-hours-summary" aria-label="Totais de horas do período">
        <span title={RADAR_KPI_TOOLTIPS.plan}>
          <b>Planejadas</b>
          <strong>{fmtHM(horasPlan)}</strong>
        </span>
        <span title={WORK_HOURS_TOOLTIP}>
          <b>Trabalhadas</b>
          <strong>{fmtHM(horasPres)}</strong>
        </span>
        <span title={ABSENT_HOURS_TOOLTIP}>
          <b>Ausentes</b>
          <strong>{fmtHM(horasAbs)}</strong>
          <em>base do índice</em>
        </span>
      </div>
      {hoursTotal > 0 && (
        <div className="pb-radar-hours-face-stack" aria-hidden="true">
          {items.map((t) =>
            t.value > 0 ? (
              <div
                key={t.key}
                className={`pb-radar-hours-face-stack-seg pb-radar-hours-face-stack-seg--${t.key}`}
                style={{ flex: t.value }}
              />
            ) : null,
          )}
        </div>
      )}
      <div className="pb-radar-hours-face-grid">
        {items.map((t) => renderHourItem(t, { fmtHM, horasPlan, histRows, onOpenTableCol }))}
        {renderConsecItem(consecItem, { histRows, onOpenConsecFaltas })}
      </div>
    </div>
  );
}
