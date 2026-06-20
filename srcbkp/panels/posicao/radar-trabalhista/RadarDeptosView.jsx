import React, { useMemo, useState } from "react";
import { fmtBRL, fmtK } from "./radarPassivoUtils.js";
import { computeDeptSummaries } from "./radarDeptosUtils.js";

function normSearch(s) {
  return String(s ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
}

/**
 * Ranking de departamentos reais (cadastro) com drill-down nos eventos de risco.
 */
export function RadarDeptosView({
  histRows = [],
  passivoCfg,
  filtroDept = "",
  onDeptChange,
  eventTypes = [],
  passivoTotal = 0,
  onEventSelect,
}) {
  const [query, setQuery] = useState("");

  const allDepts = useMemo(
    () => computeDeptSummaries(histRows, passivoCfg),
    [histRows, passivoCfg],
  );

  const totals = useMemo(() => {
    const ocorrencias = allDepts.reduce((s, d) => s + d.ocorrencias, 0);
    const passivo = allDepts.reduce((s, d) => s + d.passivo, 0);
    return { ocorrencias, passivo, count: allDepts.length };
  }, [allDepts]);

  const maxDeptOcorr = useMemo(
    () => Math.max(1, ...allDepts.map((d) => d.ocorrencias)),
    [allDepts],
  );

  const depts = useMemo(() => {
    const q = normSearch(query);
    if (!q) return allDepts;
    return allDepts.filter((d) => normSearch(d.dept).includes(q));
  }, [allDepts, query]);

  const selectDept = (dept) => {
    onDeptChange?.(filtroDept === dept ? "" : dept);
  };

  return (
    <div className="rt-deptos-pro">
      <div className="rt-deptos-kpis">
        <div className="rt-deptos-kpi">
          <span className="rt-deptos-kpi-lbl">Departamentos</span>
          <strong>{totals.count}</strong>
        </div>
        <div className="rt-deptos-kpi">
          <span className="rt-deptos-kpi-lbl">Ocorrências</span>
          <strong>{totals.ocorrencias.toLocaleString("pt-BR")}</strong>
        </div>
        <div className="rt-deptos-kpi rt-deptos-kpi--passivo">
          <span className="rt-deptos-kpi-lbl">Passivo estimado</span>
          <strong>{fmtK(totals.passivo)}</strong>
        </div>
        {filtroDept && (
          <div className="rt-deptos-kpi rt-deptos-kpi--filter">
            <span className="rt-deptos-kpi-lbl">Selecionado</span>
            <strong title={filtroDept}>{filtroDept}</strong>
          </div>
        )}
      </div>

      <section className="rt-card rt-card--deptos-ranking">
        <div className="rt-deptos-rank-head">
          <h3 className="rt-card-title rt-card-title--upper">
            Ranking de departamentos
            <span className="rt-deptos-count">{depts.length} no período</span>
          </h3>
          <input
            type="search"
            className="rt-deptos-search"
            placeholder="Buscar departamento…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            aria-label="Buscar departamento"
          />
        </div>
        <div className="rt-deptos-rank-wrap">
          <table className="rt-deptos-rank-table">
            <thead>
              <tr>
                <th className="rt-deptos-rank-th--num">#</th>
                <th>Departamento</th>
                <th className="rt-deptos-rank-th--num">Ocorr.</th>
                <th className="rt-deptos-rank-th--num">Colab.</th>
                <th className="rt-deptos-rank-th--num">Passivo</th>
                <th className="rt-deptos-rank-th--bar">Participação</th>
              </tr>
            </thead>
            <tbody>
              {depts.map((d, i) => {
                const active = filtroDept === d.dept;
                const barPct = (d.ocorrencias / maxDeptOcorr) * 100;
                return (
                  <tr
                    key={d.dept}
                    className={active ? "is-active" : ""}
                    onClick={() => selectDept(d.dept)}
                    title={d.dept}
                  >
                    <td className="rt-deptos-rank-num">{i + 1}</td>
                    <td className="rt-deptos-rank-dept">{d.dept}</td>
                    <td className="rt-deptos-rank-num">{d.ocorrencias.toLocaleString("pt-BR")}</td>
                    <td className="rt-deptos-rank-num">{d.colaboradores}</td>
                    <td className="rt-deptos-rank-num">{fmtBRL(d.passivo)}</td>
                    <td className="rt-deptos-rank-barcell">
                      <span className="rt-deptos-rank-bar">
                        <span
                          className="rt-deptos-rank-bar-fill"
                          style={{ width: `${barPct}%` }}
                        />
                      </span>
                      <span className="rt-deptos-rank-pct">{d.pct.toFixed(1)}%</span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          {!depts.length && (
            <p className="rt-empty rt-empty--inline">Nenhum departamento encontrado.</p>
          )}
        </div>
      </section>

      {filtroDept ? (
        <div className="rt-card rt-card--deptos-eventos">
          <div className="rt-deptos-ev-head">
            <h3 className="rt-deptos-ev-title">
              Eventos — <strong>{filtroDept}</strong>
            </h3>
            <div className="rt-deptos-ev-actions">
              <span className="rt-deptos-ev-total">{fmtK(passivoTotal)}</span>
              <button type="button" className="rt-deptos-ev-clear" onClick={() => onDeptChange?.("")}>
                Limpar filtro
              </button>
            </div>
          </div>
          <div className="rt-deptos-ev-table-wrap">
            <table className="rt-deptos-ev-table">
              <thead>
                <tr>
                  <th>Evento</th>
                  <th>Ocorr.</th>
                  <th>Passivo</th>
                </tr>
              </thead>
              <tbody>
                {eventTypes.map((e) => (
                  <tr
                    key={e.evento}
                    className={onEventSelect ? "rt-table-row--click" : undefined}
                    onClick={onEventSelect ? () => onEventSelect(e) : undefined}
                    tabIndex={onEventSelect ? 0 : undefined}
                    role={onEventSelect ? "button" : undefined}
                  >
                    <td>{e.evento}</td>
                    <td className="rt-deptos-ev-num">{e.ocorrencias.toLocaleString("pt-BR")}</td>
                    <td className="rt-deptos-ev-num">{fmtBRL(e.passivo)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {!eventTypes.length && (
              <p className="rt-empty rt-empty--inline">Nenhum evento neste departamento.</p>
            )}
          </div>
        </div>
      ) : (
        <p className="rt-deptos-hint">
          Clique em um departamento na tabela para ver quais eventos de risco concentram ocorrências e passivo.
        </p>
      )}
    </div>
  );
}
