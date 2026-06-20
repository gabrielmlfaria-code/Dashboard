import React from "react";

export function EventsGrid({ events, monthLabels, onEventClick, eventSortDir = "asc", onToggleEventSort }) {
  const openEvent = (event, month) => {
    if (!event || typeof onEventClick !== "function") return;
    onEventClick(event, month);
  };

  const renderVariation = (variation) => {
    const value = String(variation || "").trim();
    if (!value || value === "—") return <span className="events-grid-var-empty">—</span>;
    if (value.toLowerCase() === "base baixa") {
      return <span className="events-grid-var-badge is-neutral">· base baixa</span>;
    }
    if (value.startsWith("+")) {
      return <span className="events-grid-var-badge is-up">↑ {value}</span>;
    }
    if (value.startsWith("-")) {
      return <span className="events-grid-var-badge is-down">↓ {value}</span>;
    }
    return <span className="events-grid-var-empty">—</span>;
  };

  const isMutedHours = (hours) => {
    const value = String(hours || "").trim();
    return !value || value === "—" || value === "0:00";
  };

  return (
    <div className="events-grid-card">
      <div className="events-grid-scroll">
        <table className="events-grid-table">
          <thead>
            <tr>
              <th className="events-grid-event-head" rowSpan={2}>
                <button
                  type="button"
                  className="events-grid-event-sort"
                  onClick={onToggleEventSort}
                  title="Ordenar eventos"
                >
                  Evento
                  <span aria-hidden="true">{eventSortDir === "asc" ? "▲" : "▼"}</span>
                </button>
              </th>
              {monthLabels.map((label) => (
                <th className="events-grid-month-head" colSpan={2} key={label}>
                  {label}
                </th>
              ))}
            </tr>
            <tr>
              {monthLabels.map((label) => (
                <React.Fragment key={`${label}-sub`}>
                  <th className="events-grid-sub-head is-group-start">Horas</th>
                  <th className="events-grid-sub-head">Var.</th>
                </React.Fragment>
              ))}
            </tr>
          </thead>
          <tbody>
            {events.map((event, index) => (
              <React.Fragment key={`${event.name}-${event.code}-${index}`}>
                {event.showCategory ? (
                  <tr className="events-grid-category-row">
                    <td className="events-grid-category-cell">{event.categoryLabel}</td>
                    <td className="events-grid-category-fill" colSpan={monthLabels.length * 2} aria-hidden="true" />
                  </tr>
                ) : null}
                <tr onClick={() => openEvent(event)} title="Abrir colaboradores deste evento">
                  <td className="events-grid-event-cell">
                    <strong>{String(event.name || "").toLocaleUpperCase("pt-BR")}</strong>
                    {event.code ? <span>{event.code}</span> : null}
                  </td>
                  {monthLabels.map((label, monthIndex) => {
                    const month = event.months.find((item) => item.label === label) || {};
                    const hours = month.hours || "—";
                    return (
                      <React.Fragment key={`${event.code || event.name}-${label}-${monthIndex}`}>
                        <td className={`events-grid-hours-cell ${isMutedHours(hours) ? "is-muted" : ""}`}>
                          <button
                            type="button"
                            className="events-grid-hours-btn"
                            onClick={(e) => {
                              e.stopPropagation();
                              openEvent(event, month);
                            }}
                            title="Abrir colaboradores deste evento no mês"
                            disabled={isMutedHours(hours)}
                          >
                            {hours}
                          </button>
                        </td>
                        <td className="events-grid-var-cell">{renderVariation(month.variation)}</td>
                      </React.Fragment>
                    );
                  })}
                </tr>
              </React.Fragment>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
