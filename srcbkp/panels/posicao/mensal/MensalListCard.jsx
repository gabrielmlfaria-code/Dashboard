import React, { useEffect, useMemo, useState } from "react";
import { fmtDateBr } from "../calendarUtils.js";
import { loadEventCategories, loadHourCategories } from "../HorasConfigModal.jsx";
import { EventsGrid } from "./EventsGrid.jsx";

const defaultFmtHMMilhar = (mins) => {
  const n = Math.round(Number(mins || 0));
  const sign = n < 0 ? "-" : "";
  const abs = Math.abs(n);
  const hours = Math.floor(abs / 60).toLocaleString("pt-BR");
  const minutes = String(abs % 60).padStart(2, "0");
  return `${sign}${hours}:${minutes}`;
};
export function MensalListCard({ data = null, onOpenEvent = null, periodoApuracao = null, fmtHMMilhar = defaultFmtHMMilhar }) {
  const hasData = Number(data?.eventCount || 0) > 0;
  const months = Array.isArray(data?.months) ? data.months : [];
  const [viewMode, setViewMode] = useState("periodo");
  const pickDefaultMonths = (items) => (Array.isArray(items) ? items.slice(-2) : []);
  const [selectedMonths, setSelectedMonths] = useState(() => pickDefaultMonths(months));
  const [periodSelectorOpen, setPeriodSelectorOpen] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const [eventSortDir, setEventSortDir] = useState("asc");

  useEffect(() => {
    setSelectedMonths(pickDefaultMonths(months));
  }, [months.join("|")]);

  useEffect(() => {
    if (viewMode !== "consulta") setPeriodSelectorOpen(false);
  }, [viewMode]);

  useEffect(() => {
    if (!expanded) return undefined;
    const onKeyDown = (event) => {
      if (event.key === "Escape") setExpanded(false);
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [expanded]);

  const mensalPeriod = hasData && months.length ? `${months[0]} até ${months[months.length - 1]}` : "";
  const mensalTitle = hasData ?
     `${data.eventCount.toLocaleString("pt-BR")} evento${data.eventCount !== 1 ? "s" : ""}${mensalPeriod ? ` - ${mensalPeriod}` : ""}`
    : "Totalização do último período encerrado";
  const mensalHeaderTitle = hasData ?
     `${data.eventCount.toLocaleString("pt-BR")} evento${data.eventCount !== 1 ? "s" : ""}`
    : mensalTitle;
  const selectedPeriod = useMemo(() => {
    const selectedInOrder = months.filter((month) => selectedMonths.includes(month));
    if (!selectedInOrder.length) return "";
    return selectedInOrder.length === 1
      ? selectedInOrder[0]
      : `${selectedInOrder[0]} até ${selectedInOrder[selectedInOrder.length - 1]}`;
  }, [months, selectedMonths]);
  const apuracaoPeriod =
    periodoApuracao?.de && periodoApuracao?.ate
      ? `${fmtDateBr(periodoApuracao.de)} até ${fmtDateBr(periodoApuracao.ate)}`
      : "";
  const mensalHeaderPeriod = apuracaoPeriod
    ? `Período de apuração: ${apuracaoPeriod}`
    : mensalPeriod
      ? `Período de apuração: ${mensalPeriod}`
      : "Período de apuração aguardando API";
  const consultaHeaderPeriod = apuracaoPeriod
    ? `Período de apuração: ${apuracaoPeriod}`
    : selectedPeriod
      ? `Período de apuração: ${selectedPeriod}`
      : "Período de apuração: nenhum mês selecionado";
  const mensalCards = [
    { label: "Consulta", value: "Mês a mês", hint: "Marque os períodos a serem consultados." },
    { label: "Eventos", value: "Drill por colaborador", hint: "Ao clicar no evento, lista os colaboradores associados." },
    { label: "Exportação", value: "Excel", hint: "Gera arquivo para análise externa." },
  ];
  const splitEventLabel = (value) => {
    const raw = String(value || "").trim();
    const match = raw.match(/^(\d+[A-Z]?)\s*[-–—]\s*(.+)$/i);
    if (!match) return { code: "", description: raw };
    return { code: match[1].trim(), description: match[2].trim() };
  };
  const normalizeEventForCategory = (value) =>
    String(value || "")
      .trim()
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-z0-9]+/g, " ")
      .replace(/\s+/g, " ")
      .trim();
  const monthlyCategoryConfig = useMemo(() => {
    const labels = {
      presentes: "Presença",
      extras: "H.Extras / B.Horas",
      ausentes: "Ausências",
      justificadas: "Justificadas / Abonadas",
      noturnas: "Horas noturnas",
      risco: "Risco / adicionais",
      ignorar: "Ignorados",
      outros: "Outros eventos",
    };
    const order = {
      presentes: 10,
      extras: 20,
      ausentes: 30,
      justificadas: 40,
      noturnas: 50,
      risco: 60,
      ignorar: 90,
      outros: 99,
    };
    loadHourCategories().forEach((col, idx) => {
      labels[col.value] = col.label;
      if (order[col.value] == null) order[col.value] = 70 + idx;
    });
    const map = new Map();
    (Array.isArray(loadEventCategories?.()) ? loadEventCategories() : []).forEach((item) => {
      const category = item?.category || "outros";
      const name = normalizeEventForCategory(item?.name);
      if (!name) return;
      map.set(name, category);
      const nameWithoutCode = name.replace(/^\d+[a-z]?\s+/, "").trim();
      if (nameWithoutCode) map.set(nameWithoutCode, category);
    });
    return { labels, order, map };
  }, []);
  const getMonthlyRowCategory = (row) => {
    const label = splitEventLabel(row?.event);
    const raw = normalizeEventForCategory(row?.event);
    const description = normalizeEventForCategory(label.description);
    const category =
      monthlyCategoryConfig.map.get(raw) ||
      monthlyCategoryConfig.map.get(description) ||
      (/noturn/.test(description) ? "noturnas" : "") ||
      (/periculos|insalubr|risco/.test(description) ? "risco" : "") ||
      (/extra|banco|plantao|sobreaviso/.test(description) ? "extras" : "") ||
      (/falta|atras|ausenc|saida antecip/.test(description) ? "ausentes" : "") ||
      (/atestado|licenc|ferias|feriado|folga|abono|afast/.test(description) ? "justificadas" : "") ||
      (/presenc|normal|trabalh/.test(description) ? "presentes" : "") ||
      "outros";
    return {
      key: category,
      label: monthlyCategoryConfig.labels[category] || monthlyCategoryConfig.labels.outros,
      order: monthlyCategoryConfig.order[category] ?? monthlyCategoryConfig.order.outros,
    };
  };
  const sortMensalRows = (rows) =>
    [...(rows || [])].sort((a, b) => {
      const catA = getMonthlyRowCategory(a);
      const catB = getMonthlyRowCategory(b);
      if (catA.order !== catB.order) return catA.order - catB.order;
      const labelA = splitEventLabel(a.event);
      const labelB = splitEventLabel(b.event);
      const codeA = Number(String(labelA.code || "").match(/\d+/)?.[0] || 0);
      const codeB = Number(String(labelB.code || "").match(/\d+/)?.[0] || 0);
      const textCompare = String(labelA.description || "").localeCompare(String(labelB.description || ""), "pt-BR", {
        sensitivity: "base",
        numeric: true,
      });
      const dir = eventSortDir === "desc" ? -1 : 1;
      return (textCompare || codeA - codeB) * dir || (Number(b.total) || 0) - (Number(a.total) || 0);
    });
  const mensalRows = hasData ? sortMensalRows(data.rows || []) : [];
  const selectedSet = useMemo(() => new Set(selectedMonths), [selectedMonths]);
  const activeMonths = viewMode === "consulta" ? months.filter((month) => selectedSet.has(month)) : months;
  const matrixColumns = `260px ${activeMonths.map(() => "94px 82px").join(" ")} 124px`;
  const matrixWidth = 260 + (activeMonths.length * 176) + 124;
  const matrixStyle = viewMode === "consulta"
    ? { gridTemplateColumns: matrixColumns, minWidth: `${matrixWidth}px` }
    : undefined;
  const consultaRows = hasData
    ? sortMensalRows(
        [...(data.rows || [])]
        .map((row) => ({
          ...row,
          total: months
            .filter((month) => selectedSet.has(month))
            .reduce((sum, month) => sum + (Number(row.byMonth?.[month]) || 0), 0),
        }))
        .filter((row) => Number(row.total || 0) !== 0),
      )
    : [];
  const visibleRows = viewMode === "consulta" ? consultaRows : mensalRows;
  const consultaTotal = consultaRows.reduce((sum, row) => sum + (Number(row.total) || 0), 0);
  const periodTotal = mensalRows.reduce((sum, row) => sum + (Number(row.total) || 0), 0);
  const visibleTotal = viewMode === "consulta" ? consultaTotal : periodTotal;
  const consultaLabel = selectedMonths.length ?
     `${selectedMonths.length} de ${months.length} mês${months.length !== 1 ? "es" : ""}`
    : "nenhum mês selecionado";
  const toggleMonth = (month) => {
    setSelectedMonths((current) =>
      current.includes(month) ? current.filter((item) => item !== month) : [...current, month],
    );
  };
  const toggleEventSort = () => {
    setEventSortDir((value) => (value === "asc" ? "desc" : "asc"));
  };
  const formatMonthHead = (value) => {
    const raw = String(value || "").trim();
    const match = raw.match(/^(\d{1,2})\/(\d{4})$/);
    if (!match) return raw.toLocaleUpperCase("pt-BR");
    const names = ["JAN", "FEV", "MAR", "ABR", "MAI", "JUN", "JUL", "AGO", "SET", "OUT", "NOV", "DEZ"];
    const monthIndex = Math.max(0, Math.min(11, Number(match[1]) - 1));
    return `${names[monthIndex]}/${match[2].slice(-2)}`;
  };
  const calcMonthVariation = (row, monthIndex) => {
    if (monthIndex <= 0) {
      return { kind: "base", arrow: "", text: "", title: "Primeiro período visível", highlight: false };
    }
    const month = activeMonths[monthIndex];
    const previousMonth = activeMonths[monthIndex - 1];
    const current = Number(row.byMonth?.[month]) || 0;
    const previous = Number(row.byMonth?.[previousMonth]) || 0;
    if (!previous && !current) {
      return { kind: "flat", arrow: "→", text: "0,0%", title: "Sem variação no período", highlight: false };
    }
    if (!previous) {
      return { kind: "lowbase", arrow: "↑", text: "base baixa", title: `Sem horas em ${previousMonth}; variação percentual não é comparável`, highlight: true };
    }
    const pct = ((current - previous) / Math.abs(previous)) * 100;
    if (Math.abs(pct) > 999) {
      return { kind: "lowbase", arrow: "↑", text: "base baixa", title: `${month} vs ${previousMonth}: base anterior muito baixa`, highlight: true };
    }
    const kind = pct > 0.049 ? "up" : pct < -0.049 ? "down" : "flat";
    const arrow = kind === "up" ? "↑" : kind === "down" ? "↓" : "→";
    const text = `${pct > 0 ? "+" : ""}${pct.toLocaleString("pt-BR", {
      minimumFractionDigits: 1,
      maximumFractionDigits: 1,
    })}%`;
    return { kind, arrow, text, title: `${month} vs ${previousMonth}: ${text}`, highlight: Math.abs(pct) >= 20 };
  };
  const eventsGridMonthLabels = activeMonths.map(formatMonthHead);
  let lastGridCategoryKey = "";
  const eventsGridRows = visibleRows.map((row) => {
    const label = splitEventLabel(row.event);
    const category = getMonthlyRowCategory(row);
    const showCategory = category.key !== lastGridCategoryKey;
    lastGridCategoryKey = category.key;
    return {
      source: row,
      name: label.description || String(row.event || ""),
      code: label.code,
      showCategory,
      categoryLabel: category.label,
      months: activeMonths.map((month, monthIndex) => {
        const variation = calcMonthVariation(row, monthIndex);
        return {
          label: formatMonthHead(month),
          hours: fmtHMMilhar(row.byMonth?.[month] || 0),
          sourceMonth: month,
          variation:
            variation.kind === "lowbase"
              ? "base baixa"
              : variation.kind === "up" || variation.kind === "down"
                ? variation.text
                : null,
        };
      }),
    };
  });
  const shouldShowSimpleCategory = (row, index) =>
    index === 0 || getMonthlyRowCategory(row).key !== getMonthlyRowCategory(visibleRows[index - 1]).key;
  return (
    <div className={`pb-cell pb-mensal ${expanded ? "pb-mensal--expanded" : ""}`} aria-label="Fechamento Mensal">
      <div className="pb-mensal-head">
        <div className="pb-mensal-title">
          <span className="pb-label">Fechamento Mensal</span>
          <em>{viewMode === "consulta" ? consultaHeaderPeriod : mensalHeaderPeriod}</em>
        </div>
        {hasData ? (
          <div className="pb-mensal-head-actions">
            <div className="pb-mensal-toolbar">
              <span className="pb-mensal-mode-label">Visualização</span>
              <div className="pb-mensal-tabs" role="tablist" aria-label="Modo de visualização mensal">
                <button
                  type="button"
                  className={viewMode === "periodo" ? "is-active" : ""}
                  onClick={() => setViewMode("periodo")}
                >
                  Período atual
                </button>
                <button
                  type="button"
                  className={viewMode === "consulta" ? "is-active" : ""}
                  onClick={() => setViewMode("consulta")}
                >
                  Períodos fechados
                </button>
              </div>
            </div>
            <button
              type="button"
              className="pb-mensal-expand-btn"
              onClick={() => {
                if (!expanded) setViewMode("consulta");
                setExpanded((value) => !value);
              }}
              aria-pressed={expanded}
              title={expanded ? "Recolher tela" : "Expandir tela"}
            >
              {expanded ? "⤡" : "⤢"}
              </button>
          </div>
        ) : null}
      </div>

      {hasData ? (
        <div className="pb-mensal-panel">
          {viewMode === "consulta" ? (
            <div className="pb-mensal-consulta">
              <div className="pb-mensal-period-selector">
                <button
                  type="button"
                  className="pb-mensal-period-btn"
                  onClick={() => setPeriodSelectorOpen((open) => !open)}
                >
                  <span>Períodos</span>
                  <b>{consultaLabel}</b>
                  <i aria-hidden="true">▾</i>
                </button>
                {periodSelectorOpen ? (
                  <div className="pb-mensal-period-popover">
                    <div className="pb-mensal-period-pop-head">
                      <strong>Selecionar períodos</strong>
                      <span>{fmtHMMilhar(consultaTotal)}</span>
                      <button
                        type="button"
                        className="pb-mensal-period-close"
                        onClick={() => setPeriodSelectorOpen(false)}
                        aria-label="Fechar seleção de períodos"
                      >
                        Fechar
                      </button>
                    </div>
                    <div className="pb-mensal-period-list">
                      {months.map((month) => (
                        <label key={month} className={selectedSet.has(month) ? "is-selected" : ""}>
                          <input
                            type="checkbox"
                            checked={selectedSet.has(month)}
                            onChange={() => toggleMonth(month)}
                          />
                          <span>{month}</span>
                        </label>
                      ))}
                    </div>
                    <div className="pb-mensal-consulta-actions">
                      <button type="button" onClick={() => setSelectedMonths(months)}>
                        Marcar todos
                      </button>
                      <button type="button" onClick={() => setSelectedMonths([])}>
                        Limpar
                      </button>
                    </div>
                  </div>
                ) : null}
              </div>
              <button type="button" className="pb-mensal-consultar-btn" onClick={() => setPeriodSelectorOpen(false)}>
                Aplicar
              </button>
            </div>
          ) : null}

          <div
            className={`pb-mensal-list ${viewMode === "consulta" ? "pb-mensal-matrix" : "pb-mensal-period-list-simple"}`}
            role="table"
            aria-label="Eventos mensais importados"
          >
            {viewMode === "consulta" ? (
              <EventsGrid
                events={eventsGridRows}
                monthLabels={eventsGridMonthLabels}
                onEventClick={(event, month) =>
                  onOpenEvent?.({
                    ...event.source,
                    eventCode: event.code || "",
                    eventDesc: event.name || "",
                    month: month?.sourceMonth || "",
                    monthLabel: month?.label || "",
                  })
                }
                eventSortDir={eventSortDir}
                onToggleEventSort={toggleEventSort}
              />
            ) : (
              <div className="pb-mensal-list-head pb-mensal-simple-row" role="row">
                <button
                  type="button"
                  className="pb-mensal-event-sort"
                  role="columnheader"
                  onClick={toggleEventSort}
                  title="Ordenar eventos"
                >
                  Evento
                  <span aria-hidden="true">{eventSortDir === "asc" ? "▲" : "▼"}</span>
                </button>
                <span role="columnheader">Horas</span>
              </div>
            )}
            {viewMode === "consulta" ? null : <div className="pb-mensal-list-body">
              {visibleRows.map((row, index) => {
                const label = splitEventLabel(row.event);
                const category = getMonthlyRowCategory(row);
                return (
                  <React.Fragment key={`${row.event}-${index}`}>
                    {viewMode !== "consulta" && shouldShowSimpleCategory(row, index) ? (
                      <div className="pb-mensal-category-row" role="row">
                        <span>{category.label}</span>
                      </div>
                    ) : null}
                    <button
                      type="button"
                      className={`pb-mensal-list-row ${viewMode === "consulta" ? "pb-mensal-matrix-row" : "pb-mensal-simple-row"}`}
                      role="row"
                      onClick={() => onOpenEvent?.(row)}
                      title="Abrir colaboradores deste evento"
                      style={matrixStyle}
                    >
                      {viewMode === "consulta" ? (
                        <>
                          <span role="cell" className="pb-mensal-event-cell" title={row.event}>
                            <b>{label.description.toLocaleUpperCase("pt-BR")}</b>
                            {label.code ? <small>{label.code}</small> : null}
                          </span>
                          {activeMonths.flatMap((month, monthIndex) => {
                            const variation = calcMonthVariation(row, monthIndex);
                            return [
                              <span role="cell" className="pb-mensal-month-val" key={`${month}-valor`}>
                                {fmtHMMilhar(row.byMonth?.[month] || 0)}
                              </span>,
                              <span role="cell" className="pb-mensal-delta-val" key={`${month}-var`} title={variation.title}>
                                {variation.text ? (
                                  <span className={`pb-mensal-var is-${variation.kind} ${variation.highlight ? "is-relevant" : "is-quiet"}`}>
                                    <i aria-hidden="true">{variation.arrow}</i>
                                    {variation.text}
                                  </span>
                                ) : "—"}
                              </span>,
                            ];
                          })}
                        </>
                      ) : (
                        <span role="cell" className="pb-mensal-period-event" title={row.event}>
                          <b>{label.description.toLocaleUpperCase("pt-BR")}</b>
                          {label.code ? <small>{label.code}</small> : null}
                        </span>
                      )}
                      <strong role="cell">{fmtHMMilhar(row.total || 0)}</strong>
                    </button>
                  </React.Fragment>
                );
              })}
              {!visibleRows.length ? (
                <div className="pb-mensal-list-empty">Selecione pelo menos um mês com horas para consultar.</div>
              ) : null}
            </div>}
            {viewMode === "consulta" && !visibleRows.length ? (
              <div className="pb-mensal-list-empty">Selecione pelo menos um mês com horas para consultar.</div>
            ) : null}
          </div>
        </div>
      ) : (
        <div className="pb-mensal-main">
          {mensalCards.map((item) => (
            <div className="pb-mensal-item" key={item.label}>
              <span>{item.label}</span>
              <strong>{item.value}</strong>
              <em>{item.hint}</em>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
