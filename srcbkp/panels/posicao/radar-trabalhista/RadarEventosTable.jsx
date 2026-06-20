import React from "react";
import { RtDeptMultiSelect } from "./RtDeptMultiSelect.jsx";
import { fmtBRL } from "./radarPassivoUtils.js";

/** Barra de filtro de departamentos (aba Eventos / tabela na Visao). */
export function RadarEventosToolbar({
  deptOptions,
  filtroDepts,
  onFiltroDeptsChange,
  theme,
  className = "",
}) {
  return (
    <div className={`rt-eventos-toolbar${className ? ` ${className}` : ""}`}>
      <RtDeptMultiSelect
        className="rt-eventos-dept-ms"
        label="Departamentos"
        options={deptOptions}
        value={filtroDepts}
        onChange={onFiltroDeptsChange}
        theme={theme}
      />
    </div>
  );
}

/** Tabela completa de eventos do Radar (base legal, volume e estimativa). */
export function RadarEventosTable({ eventTypes, stats, passivoTotal, onEventSelect }) {
  return (
    <div className="rt-table-wrap">
      {onEventSelect ? (
        <p className="rt-eventos-table-hint">Clique em um evento para ver base legal, conduta e penalidade estimada.</p>
      ) : null}
      <table className="rt-table">
        <thead>
          <tr>
            <th>Evento</th>
            <th>Base legal</th>
            <th>Ocorr.</th>
            <th>Colabs</th>
            <th>Calculo usado</th>
            <th>Estimativa</th>
            <th>%</th>
          </tr>
        </thead>
        <tbody>
          {eventTypes.map((e) => (
            <tr
              key={e.evento}
              className={onEventSelect ? "rt-table-row--click" : undefined}
              onClick={onEventSelect ? () => onEventSelect(e) : undefined}
              onKeyDown={
                onEventSelect
                  ? (ev) => {
                      if (ev.key === "Enter" || ev.key === " ") {
                        ev.preventDefault();
                        onEventSelect(e);
                      }
                    }
                  : undefined
              }
              tabIndex={onEventSelect ? 0 : undefined}
              role={onEventSelect ? "button" : undefined}
            >
              <td>{e.evento}</td>
              <td className="rt-td-muted">{e.baseLegal}</td>
              <td>{e.ocorrencias.toLocaleString("pt-BR")}</td>
              <td>{e.colaboradores}</td>
              <td className="rt-td-muted">{e.formula}</td>
              <td>{fmtBRL(e.passivo)}</td>
              <td>
                <span className="rt-mbar">
                  <span className="rt-mbar-fill" style={{ width: `${e.pct}%` }} />
                  {e.pct.toFixed(0)}%
                </span>
              </td>
            </tr>
          ))}
        </tbody>
        <tfoot>
          <tr>
            <td colSpan={2}>
              <strong>Totais</strong>
            </td>
            <td>{stats.ocorrencias.toLocaleString("pt-BR")}</td>
            <td>{stats.colaboradores}</td>
            <td />
            <td>
              <strong>{fmtBRL(passivoTotal)}</strong>
            </td>
            <td />
          </tr>
        </tfoot>
      </table>
    </div>
  );
}
