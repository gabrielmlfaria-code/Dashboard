import { normDateKey, extractPeriodoApuracao, getHistDataCutoffIso } from "../calendarUtils.js";

export const fmt = (n) => {
  if (n == null || Number.isNaN(n)) return "—";
  return Number(n).toLocaleString("pt-BR");
};

export const fmtShortDate = (iso) => {
  const m = String(iso || "").match(/^(\d{4})-(\d{2})-(\d{2})/);
  return m ? `${m[3]}/${m[2]}/${m[1].slice(-2)}` : String(iso || "—");
};

export const fmtDateInput = (iso) => {
  const m = String(iso || "").match(/^(\d{4})-(\d{2})-(\d{2})$/);
  return m ? `${m[3]}/${m[2]}/${m[1]}` : String(iso || "");
};

export const parseDateInput = (value) => {
  const s = String(value || "").trim();
  let m = s.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (m) return `${m[1]}-${m[2]}-${m[3]}`;
  m = s.match(/^(\d{1,2})[\/.-](\d{1,2})[\/.-](\d{2}|\d{4})$/);
  if (!m) return "";
  const y = m[3].length === 2 ? `20${m[3]}` : m[3];
  return `${y}-${m[2].padStart(2, "0")}-${m[1].padStart(2, "0")}`;
};

export const pct = (a, b) => (b > 0 ? Math.round((a / b) * 100) : 0);

export const PB_FALT_DAYS_ATUAL = "atual";
export const DATAVIEW_URL = "https://dataview.macpontoweb.com.br/";

export const normalizeFaltDays = (v) => {
  if (v === PB_FALT_DAYS_ATUAL || v === "current") return PB_FALT_DAYS_ATUAL;
  const n = Number(v);
  return n === 7 || n === 15 || n === 30 ? n : PB_FALT_DAYS_ATUAL;
};

const addDaysIso = (iso, days) => {
  const d = normDateKey(iso);
  const m = d.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!m) return "";
  const date = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  date.setDate(date.getDate() + days);
  return normDateKey(date);
};

const buildEmptyHistDay = (date) => ({
  date,
  data_referencia: date,
  total: 0,
  presentes: 0,
  faltas: 0,
  atrasos: 0,
  justificadas: 0,
  presentesPct: 0,
  abs_rate: 0,
  _missingPeriodDay: true,
});

const fillCalendarDays = (rows, days) => {
  const n = Math.max(1, Number(days) || 0);
  if (!rows.length || !n) return rows;
  const lastDate = normDateKey(rows[rows.length - 1]?.date);
  if (!lastDate) return rows;
  const firstDate = addDaysIso(lastDate, -(n - 1));
  const byDate = new Map(rows.map((r) => [normDateKey(r.date), r]));
  const out = [];
  for (let d = firstDate; d && d <= lastDate; d = addDaysIso(d, 1)) {
    out.push(byDate.get(d) || buildEmptyHistDay(d));
  }
  return out;
};

export const filterHistRowsByPeriod = (allRows, { faltDays, histDateFrom, histDateTo, periodoApuracao }) => {
  if (!allRows.length) return [];
  const cutoff = getHistDataCutoffIso();
  const rows = [...allRows]
    .filter((r) => {
      const d = normDateKey(r.date);
      return d && d <= cutoff;
    })
    .sort((a, b) => String(a.date).localeCompare(String(b.date)));
  if (!rows.length) return [];

  if (histDateFrom || histDateTo) {
    const effectiveTo = histDateTo && histDateTo <= cutoff ? histDateTo : cutoff;
    return rows.filter((r) => {
      const d = normDateKey(r.date);
      if (histDateFrom && d < normDateKey(histDateFrom)) return false;
      if (d > normDateKey(effectiveTo)) return false;
      return true;
    });
  }

  if (faltDays === PB_FALT_DAYS_ATUAL) {
    let de = normDateKey(periodoApuracao?.de);
    let ate = normDateKey(periodoApuracao?.ate);
    if (!de || !ate) {
      const extracted = extractPeriodoApuracao(...rows);
      de = normDateKey(extracted.de);
      ate = normDateKey(extracted.ate);
    }
    if (de && ate) {
      const ateCapped = ate <= cutoff ? ate : cutoff;
      return rows.filter((r) => {
        const d = normDateKey(r.date);
        return d && d >= de && d <= ateCapped;
      });
    }
    return rows;
  }

  const n = Number(faltDays);
  if (n > 0) return fillCalendarDays(rows, n);
  return rows;
};

export const extractHistRowsPeriodo = (rows) => {
  const dates = (Array.isArray(rows) ? rows : [])
    .map((r) => normDateKey(r?.date || r?.data_referencia || r?.data))
    .filter(Boolean)
    .sort();
  if (!dates.length) return null;
  return { de: dates[0], ate: dates[dates.length - 1], source: "tabela" };
};

export const collectHistEventNames = (rows) => {
  const names = new Set();
  (Array.isArray(rows) ? rows : []).forEach((r) => {
    (Array.isArray(r?._events) ? r._events : []).forEach((ev) => {
      const name = String(ev?.evento || ev?.desc || ev?.cod || "").trim();
      if (name) names.add(name);
    });
  });
  return [...names].sort((a, b) => a.localeCompare(b, "pt-BR", { sensitivity: "base" }));
};
