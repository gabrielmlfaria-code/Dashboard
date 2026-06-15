import React, { useCallback, useEffect, useMemo, useState } from "react";

import {
  ABONOS_KIND,
  buildAbonosByDept,
  loadKpiAbonos,
  sortAbonosRows,
} from "./abonosDept.js";

/** Mensagens de integração para o time de backend (.NET). */
export const ABONOS_BACKEND_HINTS = {
  allPendentes:
    "Backend: abrir a tela de Abonos com todos os abonos pendentes (ex.: GET /api/abonos?status=pendente).",
  allEfetuados:
    "Backend: abrir a tela de Abonos com todos os abonos efetuados (ex.: GET /api/abonos?status=efetuado).",
  deptPendentes: (depto) =>
    `Backend: abrir a tela de Abonos com abonos pendentes do departamento "${depto}" (ex.: GET /api/abonos?status=pendente&departamento=${encodeURIComponent(depto)}).`,
  deptEfetuados: (depto) =>
    `Backend: abrir a tela de Abonos com abonos efetuados do departamento "${depto}" (ex.: GET /api/abonos?status=efetuado&departamento=${encodeURIComponent(depto)}).`,
};

function SortBtn({ col, label, sortCol, sortDir, onSort }) {
  const active = sortCol === col;
  return (
    <button
      type="button"
      className={`pb-abonos-th${active ? " is-active" : ""}`}
      onClick={() => onSort(col)}
    >
      <span>{label}</span>
      <span className="pb-abonos-sort" aria-hidden="true">
        {active ? (sortDir === "asc" ? "▲" : "▼") : "⇅"}
      </span>
    </button>
  );
}

export function AbonosDeptPanel({
  dia = null,
  filteredDia = null,
  histRows = [],
  onOpenDeptColaboradores,
}) {
  const [stored, setStored] = useState(() => loadKpiAbonos());
  const [abonosTab, setAbonosTab] = useState(ABONOS_KIND.pendentes);

  useEffect(() => {
    const onUpdate = () => setStored(loadKpiAbonos());
    window.addEventListener("pos:abonos-updated", onUpdate);
    return () => window.removeEventListener("pos:abonos-updated", onUpdate);
  }, []);

  const metricCol = abonosTab === ABONOS_KIND.efetuados ? "efetuados" : "pendentes";
  const [sortCol, setSortCol] = useState(metricCol);
  const [sortDir, setSortDir] = useState("desc");

  useEffect(() => {
    setSortCol(metricCol);
    setSortDir("desc");
  }, [metricCol]);

  const day = filteredDia || dia;
  const built = useMemo(
    () => buildAbonosByDept(day, { limit: 10, histRows, stored }),
    [day, histRows, stored],
  );

  const tabRows = useMemo(
    () => built.rows.filter((r) => Number(r[metricCol] || 0) > 0),
    [built.rows, metricCol],
  );

  const rows = useMemo(
    () => sortAbonosRows(tabRows, sortCol, sortDir),
    [tabRows, sortCol, sortDir],
  );
  const maxMetric = useMemo(
    () => Math.max(1, ...rows.map((r) => Number(r[metricCol] || 0))),
    [rows, metricCol],
  );

  const onSort = useCallback(
    (col) => {
      if (sortCol === col) setSortDir((d) => (d === "asc" ? "desc" : "asc"));
      else {
        setSortCol(col);
        setSortDir(col === "dept" ? "asc" : "desc");
      }
    },
    [sortCol],
  );

  const openDeptGrid = useCallback(
    (depto) => {
      if (typeof onOpenDeptColaboradores === "function") {
        onOpenDeptColaboradores(depto, abonosTab);
      }
    },
    [onOpenDeptColaboradores, abonosTab],
  );

  const hasAnyData = built.totals.pendentes > 0 || built.totals.efetuados > 0;
  const emptyLabel =
    abonosTab === ABONOS_KIND.efetuados ? "Sem abonos efetuados." : "Sem abonos pendentes.";

  return (
    <div className={`pb-cell pb-abonos${hasAnyData ? "" : " is-empty"}`} aria-label="Abonos por departamento">
      <div className="pb-kpi-head">
        <div className="pb-trend-head-l">
          <span className="pb-label">Abonos</span>
        </div>
      </div>

      {hasAnyData ? (
        <div className="pb-abonos-totals" aria-label="Totais de abonos">
          <button
            type="button"
            className={`pb-abonos-total-item pb-abonos-total-item--click${abonosTab === ABONOS_KIND.pendentes ? " is-active" : ""}`}
            onClick={() => setAbonosTab(ABONOS_KIND.pendentes)}
            title={ABONOS_BACKEND_HINTS.allPendentes}
          >
            <span className="pb-abonos-total-lbl">Pendentes</span>
            <strong className="pb-abonos-total-val tone-warn">
              {built.totals.pendentes.toLocaleString("pt-BR")}
            </strong>
          </button>
          <button
            type="button"
            className={`pb-abonos-total-item pb-abonos-total-item--click${abonosTab === ABONOS_KIND.efetuados ? " is-active" : ""}`}
            onClick={() => setAbonosTab(ABONOS_KIND.efetuados)}
            title={ABONOS_BACKEND_HINTS.allEfetuados}
          >
            <span className="pb-abonos-total-lbl">Efetuados</span>
            <strong className="pb-abonos-total-val tone-good">
              {built.totals.efetuados.toLocaleString("pt-BR")}
            </strong>
          </button>
          <div className="pb-abonos-hero-note">
            <strong>{rows.length.toLocaleString("pt-BR")}</strong>
            <span>departamentos no ranking</span>
          </div>
        </div>
      ) : null}

      <div className="pb-abonos-list-wrap">
        <div className="pb-abonos-list-head">
          <SortBtn
            col="dept"
            label="Departamento"
            sortCol={sortCol}
            sortDir={sortDir}
            onSort={onSort}
          />
          <SortBtn
            col={metricCol}
            label="Qtd."
            sortCol={sortCol}
            sortDir={sortDir}
            onSort={onSort}
          />
        </div>
        <div className="pb-abonos-list" role="list">
          {rows.length ? (
            rows.map((r, idx) => {
              const count = Number(r[metricCol] || 0);
              const pct = Math.max(4, Math.round((count / maxMetric) * 100));
              return (
                <button
                  key={`${abonosTab}-${r.dept}`}
                  type="button"
                  className="pb-abonos-row"
                  onClick={() => openDeptGrid(r.dept)}
                  title={`Abrir ${abonosTab === ABONOS_KIND.efetuados ? "efetuados" : "pendentes"} de ${r.dept}`}
                  role="listitem"
                >
                  <span className="pb-abonos-rank">{idx + 1}</span>
                  <span className="pb-abonos-row-main">
                    <span className="pb-abonos-dept-name">{r.dept}</span>
                    <span className="pb-abonos-bar" aria-hidden="true">
                      <span style={{ width: `${pct}%` }} />
                    </span>
                  </span>
                  <span
                    className="pb-abonos-count"
                    aria-label={`${count} ${abonosTab === ABONOS_KIND.efetuados ? "efetuados" : "pendentes"}`}
                  >
                    {count.toLocaleString("pt-BR")}
                  </span>
                </button>
              );
            })
          ) : (
            <div className="pb-abonos-empty">{emptyLabel}</div>
          )}
        </div>
        {rows.length ? (
          <div className="pb-abonos-hint">
            Clique em um departamento para abrir os colaboradores
            {abonosTab === ABONOS_KIND.efetuados ? " (efetuados)" : " (pendentes)"}.
          </div>
        ) : null}
      </div>
    </div>
  );
}
