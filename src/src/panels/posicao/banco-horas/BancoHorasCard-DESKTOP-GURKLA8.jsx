import { useEffect, useRef, useState } from "react";

const FOCUSABLE_SELECTOR = [
  "a[href]",
  "button:not([disabled])",
  "textarea:not([disabled])",
  "input:not([disabled])",
  "select:not([disabled])",
  '[tabindex]:not([tabindex="-1"])',
].join(",");

const defaultFmtHMReadable = (mins) => {
  const n = Math.abs(Number(mins) || 0);
  const h = Math.floor(n / 60);
  const m = n % 60;
  if (!m) return `${h.toLocaleString("pt-BR")} h`;
  return `${h.toLocaleString("pt-BR")} h ${String(m).padStart(2, "0")} min`;
};

const bancoHorasColabLabel = (row) =>
  String(
    row?.nome ||
      row?.colaborador ||
      row?.colaboradorNome ||
      row?.["colaborador.nome"] ||
      row?.employee ||
      "Sem colaborador",
  ).trim() || "Sem colaborador";

const bancoHorasMatriculaLabel = (row) =>
  String(row?.matricula || row?.["colaborador.matricula"] || row?.codigo || row?.cod || "").trim();

const bancoHorasCargoLabel = (row) =>
  String(
    row?.cargo || row?.cargo_desc || row?.cargoDescricao || row?.["cargo.descricao"] || "",
  ).trim();

const bancoHorasFilialLabel = (row) =>
  String(row?.filial || row?.filialNome || row?.["filial.nome"] || "").trim();

const buildBancoHorasDeptDetails = (items = []) => {
  const map = new Map();
  for (const row of Array.isArray(items) ? items : []) {
    const matricula = bancoHorasMatriculaLabel(row);
    const nome = bancoHorasColabLabel(row);
    const key = matricula || nome;
    const current = map.get(key) || {
      nome,
      matricula,
      cargo: bancoHorasCargoLabel(row),
      filial: bancoHorasFilialLabel(row),
      saldoAnterior: 0,
      credito: 0,
      debito: 0,
      saldoProximo: 0,
      ocorrencias: 0,
      hasSaldoProximo: false,
    };
    if (!current.cargo) current.cargo = bancoHorasCargoLabel(row);
    if (!current.filial) current.filial = bancoHorasFilialLabel(row);
    current.saldoAnterior += Number(row?.saldoAnterior || 0);
    current.credito += Number(row?.credito || 0);
    current.debito += Number(row?.debito || 0);
    if (row?.saldoProximo != null) {
      current.saldoProximo += Number(row.saldoProximo) || 0;
      current.hasSaldoProximo = true;
    }
    current.ocorrencias += 1;
    map.set(key, current);
  }
  return Array.from(map.values())
    .map((item) => ({
      ...item,
      saldoProximo: item.hasSaldoProximo
        ? item.saldoProximo
        : item.saldoAnterior + item.credito - item.debito,
    }))
    .sort(
      (a, b) => Math.abs(b.saldoProximo) - Math.abs(a.saldoProximo) || a.nome.localeCompare(b.nome),
    );
};

export function BancoHorasDeptModal({ depto, onClose, fmtHMReadable = defaultFmtHMReadable }) {
  const panelRef = useRef(null);
  const rows = buildBancoHorasDeptDetails(depto?.items);
  const totalSaldo = Number(depto?.saldoProximo || 0);
  const totalCredito = Number(depto?.credito || 0);
  const totalDebito = Number(depto?.debito || 0);
  const totalAnterior = Number(depto?.saldoAnterior || 0);

  useEffect(() => {
    const previousActive = typeof document !== "undefined" ? document.activeElement : null;
    const panel = panelRef.current;
    if (!panel || typeof document === "undefined") return undefined;

    const focusables = () =>
      Array.from(panel.querySelectorAll(FOCUSABLE_SELECTOR)).filter(
        (el) => !el.hasAttribute("disabled") && el.getAttribute("aria-hidden") !== "true",
      );

    const handleKeyDown = (event) => {
      if (event.key === "Escape") {
        event.preventDefault();
        onClose?.();
        return;
      }
      if (event.key !== "Tab") return;
      const items = focusables();
      if (!items.length) {
        event.preventDefault();
        panel.focus();
        return;
      }
      const first = items[0];
      const last = items[items.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };

    window.setTimeout(() => {
      (focusables()[0] || panel).focus();
    }, 0);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      if (previousActive && typeof previousActive.focus === "function") previousActive.focus();
    };
  }, [onClose]);

  return (
    <div
      className="pb-bh-modal"
      role="dialog"
      aria-modal="true"
      aria-label="Detalhe de banco de horas"
    >
      <div className="pb-bh-modal__backdrop" onMouseDown={onClose} />
      <div
        ref={panelRef}
        className="pb-bh-modal__panel"
        tabIndex={-1}
        onMouseDown={(e) => e.stopPropagation()}
      >
        <div className="pb-bh-modal__head">
          <div>
            <span>Banco de Horas</span>
            <strong>{depto?.label || "Departamento"}</strong>
            <em>
              {rows.length.toLocaleString("pt-BR")} colaborador(es) ·{" "}
              {Number(depto?.ocorrencias || 0).toLocaleString("pt-BR")} lançamento(s)
            </em>
          </div>
          <button
            type="button"
            className="pb-bh-modal__close"
            onClick={onClose}
            aria-label="Fechar"
          >
            ×
          </button>
        </div>

        <div className="pb-bh-modal__cards">
          <div>
            <span>Saldo anterior</span>
            <strong>{fmtHMReadable(totalAnterior)}</strong>
          </div>
          <div>
            <span>Crédito</span>
            <strong>{fmtHMReadable(totalCredito)}</strong>
          </div>
          <div>
            <span>Débito</span>
            <strong>{fmtHMReadable(totalDebito)}</strong>
          </div>
          <div className={totalSaldo >= 0 ? "is-positive" : "is-negative"}>
            <span>Saldo próximo</span>
            <strong>
              {totalSaldo < 0 ? "−" : ""}
              {fmtHMReadable(Math.abs(totalSaldo))}
            </strong>
          </div>
        </div>

        <div className="pb-bh-modal__table-wrap">
          <table className="pb-bh-modal__table">
            <thead>
              <tr>
                <th>Colaborador</th>
                <th>Matrícula</th>
                <th>Cargo</th>
                <th>Ocorr.</th>
                <th>Saldo ant.</th>
                <th>Crédito</th>
                <th>Débito</th>
                <th>Saldo próx.</th>
              </tr>
            </thead>
            <tbody>
              {rows.length ? (
                rows.map((row, idx) => {
                  const saldoRowTone =
                    Number(row.saldoProximo || 0) >= 0 ? "is-positive" : "is-negative";
                  return (
                    <tr key={`${row.matricula || row.nome}-${idx}`}>
                      <td>
                        <strong>{row.nome}</strong>
                        {row.filial ? <em>{row.filial}</em> : null}
                      </td>
                      <td>{row.matricula || "—"}</td>
                      <td>{row.cargo || "—"}</td>
                      <td>{row.ocorrencias}</td>
                      <td>{fmtHMReadable(row.saldoAnterior)}</td>
                      <td>{fmtHMReadable(row.credito)}</td>
                      <td>{fmtHMReadable(row.debito)}</td>
                      <td className={saldoRowTone}>
                        {Number(row.saldoProximo || 0) < 0 ? "−" : ""}
                        {fmtHMReadable(Math.abs(Number(row.saldoProximo || 0)))}
                      </td>
                    </tr>
                  );
                })
              ) : (
                <tr>
                  <td colSpan={8} className="pb-bh-modal__empty">
                    Nenhum colaborador encontrado para este departamento.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

export function BancoHorasCard({
  stats,
  onOpenDepartamento,
  onOpenKpi,
  fmtHMReadable = defaultFmtHMReadable,
  style,
}) {
  const [topMode, setTopMode] = useState("positive");
  const saldo = Number(stats?.saldoProximo ?? stats?.saldo) || 0;
  const hasData = Number(stats?.ocorrencias) > 0;
  const saldoTone = saldo > 0 ? "positive" : saldo < 0 ? "negative" : "neutral";
  const saldoLabel = saldo > 0 ? "saldo positivo" : saldo < 0 ? "saldo negativo" : "sem saldo";
  const saldoAnterior = Number(stats?.saldoAnterior || 0);
  const saldoAnteriorKnown = stats?.saldoAnteriorKnown !== false;
  const credito = Number(stats?.credito || 0);
  const debito = Number(stats?.debito || 0);
  const movimento = credito - debito;
  const movimentoTone = movimento > 0 ? "positive" : movimento < 0 ? "negative" : "neutral";
  const canOpenKpi = hasData && typeof onOpenKpi === "function";
  const openKpi = (kpi) => {
    if (!canOpenKpi) return;
    onOpenKpi(kpi);
  };
  const topPositivos = Array.isArray(stats?.topDepartamentosPositivos)
    ? stats.topDepartamentosPositivos
    : (Array.isArray(stats?.topDepartamentos) ? stats.topDepartamentos : []).filter(
        (item) => Number(item?.saldoProximo || 0) > 0,
      );
  const topNegativos = Array.isArray(stats?.topDepartamentosNegativos)
    ? stats.topDepartamentosNegativos
    : (Array.isArray(stats?.topDepartamentos) ? stats.topDepartamentos : []).filter(
        (item) => Number(item?.saldoProximo || 0) < 0,
      );
  const topDepartamentos = (topMode === "negative" ? topNegativos : topPositivos).slice(0, 10);
  const maxTopSaldo = Math.max(1, ...topDepartamentos.map((item) => Number(item.saldoAbs || 0)));
  const canOpenDepartamento = typeof onOpenDepartamento === "function";

  return (
    <div
      className={`pb-cell pb-banco-horas pb-banco-horas--${saldoTone}`}
      style={style}
      aria-label="Banco de horas"
    >
      <div className="pb-kpi-head">
        <div className="pb-trend-head-l">
          <strong>Banco de Horas</strong>
        </div>
      </div>

      <div className="pb-banco-hero">
        <button
          type="button"
          className={`pb-banco-kpi${canOpenKpi ? " is-clickable" : ""}`}
          onClick={() => openKpi("saldo_proximo")}
          title={canOpenKpi ? "Ver colaboradores com saldo próximo" : undefined}
          disabled={!canOpenKpi}
        >
          <span>Saldo próximo</span>
          <strong>{hasData ? fmtHMReadable(Math.abs(saldo)) : "0 h"}</strong>
          <em>{hasData ? saldoLabel : "aguardando lançamentos"}</em>
        </button>
        <button
          type="button"
          className={`pb-banco-kpi pb-banco-mov pb-banco-mov--${movimentoTone}${canOpenKpi ? " is-clickable" : ""}`}
          onClick={() => openKpi("movimento")}
          title={canOpenKpi ? "Ver colaboradores com movimento no período" : undefined}
          disabled={!canOpenKpi}
        >
          <span>Movimento</span>
          <strong>
            {movimento > 0 ? "+" : movimento < 0 ? "-" : ""}
            {fmtHMReadable(Math.abs(movimento))}
          </strong>
          <em>créditos - débitos</em>
        </button>
      </div>

      <div className="pb-banco-main">
        <button
          type="button"
          className={`pb-banco-kpi pb-banco-metric${canOpenKpi ? " is-clickable" : ""}`}
          onClick={() => openKpi("saldo_anterior")}
          title={canOpenKpi ? "Ver colaboradores com saldo anterior" : undefined}
          disabled={!canOpenKpi}
        >
          <span>Saldo anterior</span>
          <strong>
            {hasData && saldoAnteriorKnown ? fmtHMReadable(saldoAnterior) : "Não informado"}
          </strong>
          <em>
            {hasData
              ? saldoAnteriorKnown
                ? "saldo antes do período"
                : "importe a planilha de banco de horas"
              : "não foram identificados eventos de banco de horas"}
          </em>
        </button>
        <div className="pb-banco-op" aria-hidden="true">
          +
        </div>
        <button
          type="button"
          className={`pb-banco-kpi pb-banco-metric${canOpenKpi ? " is-clickable" : ""}`}
          onClick={() => openKpi("credito")}
          title={canOpenKpi ? "Ver colaboradores com crédito" : undefined}
          disabled={!canOpenKpi}
        >
          <span>Crédito</span>
          <strong>{fmtHMReadable(credito)}</strong>
        </button>
        <div className="pb-banco-op" aria-hidden="true">
          -
        </div>
        <button
          type="button"
          className={`pb-banco-kpi pb-banco-metric${canOpenKpi ? " is-clickable" : ""}`}
          onClick={() => openKpi("debito")}
          title={canOpenKpi ? "Ver colaboradores com débito" : undefined}
          disabled={!canOpenKpi}
        >
          <span>Débito</span>
          <strong>{fmtHMReadable(debito)}</strong>
        </button>
      </div>

      <div className="pb-banco-top">
        <div className="pb-banco-top-head">
          <span>Top 10 saldos</span>
          <div className="pb-banco-top-tabs" role="tablist" aria-label="Tipo de saldo">
            <button
              type="button"
              className={topMode === "positive" ? "is-active" : ""}
              onClick={() => setTopMode("positive")}
              role="tab"
              aria-selected={topMode === "positive"}
            >
              Positivos
            </button>
            <button
              type="button"
              className={topMode === "negative" ? "is-active" : ""}
              onClick={() => setTopMode("negative")}
              role="tab"
              aria-selected={topMode === "negative"}
            >
              Negativos
            </button>
          </div>
        </div>
        <div className="pb-banco-top-list" role="list">
          {topDepartamentos.length ? (
            topDepartamentos.map((item, idx) => {
              const itemSaldo = Number(item.saldoProximo || 0);
              const rowTone = itemSaldo >= 0 ? "positive" : "negative";
              const pct = Math.max(4, Math.round((Number(item.saldoAbs || 0) / maxTopSaldo) * 100));
              return (
                <button
                  type="button"
                  key={`${item.label}-${idx}`}
                  className={`pb-banco-top-row pb-banco-top-row--${rowTone}${canOpenDepartamento ? " is-clickable" : ""}`}
                  role="listitem"
                  onClick={() => canOpenDepartamento && onOpenDepartamento(item)}
                  title={canOpenDepartamento ? `Abrir colaboradores de ${item.label}` : undefined}
                >
                  <span className="pb-banco-top-rank">{idx + 1}</span>
                  <span className="pb-banco-top-main">
                    <span className="pb-banco-top-name">{item.label}</span>
                    <span className="pb-banco-top-bar" aria-hidden="true">
                      <span style={{ width: `${pct}%` }} />
                    </span>
                  </span>
                  <span className="pb-banco-top-val">
                    {itemSaldo < 0 ? "-" : ""}
                    {fmtHMReadable(Math.abs(itemSaldo))}
                  </span>
                </button>
              );
            })
          ) : (
            <div className="pb-banco-top-empty">
              {topMode === "negative"
                ? "Sem saldos negativos no período."
                : "Sem saldos positivos no período."}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
