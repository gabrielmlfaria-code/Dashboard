import { CONFIG } from "../../configLocal.js";
import { PosicaoApi } from "../../api/posicaoApi.js";
import { getDateMeta } from "./calendarUtils.js";
import { employeesFromDayPayload } from "./posicaoImport.js";
import { normalizePositionEmployeesFromDay } from "./domain/positionRows.js";

/** Estado inicial do HistoricoDayModal a partir de uma linha do histÃ³rico. */
export function buildChartDayModalState(row, periodEvents = []) {
  if (!row?.date) return null;
  const meta = getDateMeta(row.date);
  const dayLabel = row._label || (meta ? `${meta.dowLabel} ${meta.label}` : row.date);
  const initialEmployees = normalizePositionEmployeesFromDay(row).map((employee) => ({
    ...employee,
    data: employee.data || row.date,
  }));
  const initialEvents = Array.isArray(row._events) ? row._events : [];
  const eventsForModal = periodEvents.length > 0 ? periodEvents : initialEvents;
  return {
    date: row.date,
    label: dayLabel,
    employees: initialEmployees,
    events: eventsForModal,
    initialDateFrom: row.date,
    initialDateTo: row.date,
    eventsDateFrom: row.date,
    eventsDateTo: row.date,
  };
}

/** Carrega colaboradores do dia via API quando o row ainda nÃ£o traz _employees. */
export function fetchChartDayEmployees(date, setChartDayModal) {
  if (!date || !CONFIG.ABSENTEISMO_API) return;
  PosicaoApi.getDia(date)
    .then((payload) => {
      const employees = employeesFromDayPayload(payload).map((employee) => ({
        ...employee,
        data: date,
      }));
      setChartDayModal((current) =>
        current?.date === date ? { ...current, employees } : current,
      );
    })
    .catch(() => {
      setChartDayModal((current) =>
        current?.date === date ? { ...current, employees: [] } : current,
      );
    });
}

