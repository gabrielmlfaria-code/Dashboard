// Utilitários de calendário brasileiro compartilhados entre componentes

/** Abreviações sem ambiguidade (evita "Sex" / "Sex." parecer "Sexo"). */
export const DOW_PT = ["Dom", "Seg", "Ter", "Qua", "Qui", "6ª", "Sáb"];

export const FERIADOS_FIXOS = {
  "01-01": "Ano Novo",
  "21-04": "Tiradentes",
  "01-05": "Dia do Trabalho",
  "07-09": "Independência",
  "12-10": "Aparecida",
  "02-11": "Finados",
  "15-11": "República",
  "20-11": "Consciência Negra",
  "25-12": "Natal",
};

export const FERIADOS_MOVEIS = {
  "2025-03-03": "Carnaval",
  "2025-03-04": "Carnaval",
  "2025-04-18": "Paixão",
  "2025-06-19": "Corpus Christi",
  "2026-02-16": "Carnaval",
  "2026-02-17": "Carnaval",
  "2026-04-03": "Paixão",
  "2026-06-04": "Corpus Christi",
  "2027-02-08": "Carnaval",
  "2027-02-09": "Carnaval",
  "2027-03-26": "Paixão",
  "2027-05-27": "Corpus Christi",
};

const PERIODO_DE_KEYS = [
  "periodo_apuracao_de",
  "apuracao_de",
  "periodo_de",
  "inicio_apuracao",
  "data_inicio_apuracao",
  "de_apuracao",
];
const PERIODO_ATE_KEYS = [
  "periodo_apuracao_ate",
  "apuracao_ate",
  "periodo_ate",
  "fim_apuracao",
  "data_fim_apuracao",
  "ate_apuracao",
];

function pickPeriodoField(obj, keys) {
  if (!obj || typeof obj !== "object") return "";
  for (const k of keys) {
    const v = obj[k];
    if (v != null && String(v).trim()) {
      const iso = normDateKey(v);
      if (iso) return iso;
    }
  }
  return "";
}

/** Intervalo De/Até a partir das datas das linhas do histórico importado. */
export function extractHistRowsPeriodo(rows) {
  const dates = (Array.isArray(rows) ? rows : [])
    .map((r) => normDateKey(r?.date || r?.data_referencia || r?.data))
    .filter(Boolean)
    .sort();
  if (!dates.length) return null;
  return { de: dates[0], ate: dates[dates.length - 1], source: "tabela" };
}

/**
 * Resolve o período de apuração efetivo (override manual → API dia → API hist → datas da tabela).
 */
export function resolvePeriodoApuracao({
  override = null,
  dia = null,
  hist = null,
  histRows = [],
} = {}) {
  if (override?.de && override?.ate) return override;
  const fromDia = extractPeriodoApuracao(dia);
  if (fromDia?.de && fromDia?.ate) return fromDia;
  const fromHist = extractPeriodoApuracao(hist);
  if (fromHist?.de && fromHist?.ate) return fromHist;
  return extractHistRowsPeriodo(histRows) || { de: "", ate: "" };
}

/** Extrai início/fim do período de apuração de payloads da API (dia, histórico, etc.). */
export function extractPeriodoApuracao(...sources) {
  for (const src of sources) {
    if (!src || typeof src !== "object") continue;
    const nested = src.periodo_apuracao || src.apuracao || src.periodoAtual;
    if (nested && typeof nested === "object") {
      const de = pickPeriodoField(nested, ["de", "inicio", "data_inicio", "from", ...PERIODO_DE_KEYS]);
      const ate = pickPeriodoField(nested, ["ate", "fim", "data_fim", "to", ...PERIODO_ATE_KEYS]);
      if (de && ate) return { de, ate };
    }
    const de = pickPeriodoField(src, PERIODO_DE_KEYS);
    const ate = pickPeriodoField(src, PERIODO_ATE_KEYS);
    if (de && ate) return { de, ate };
  }
  return { de: "", ate: "" };
}

/** Formata ISO (YYYY-MM-DD) para DD/MM/AAAA. */
export function fmtDateBr(iso) {
  const m = String(iso || "").match(/^(\d{4})-(\d{2})-(\d{2})/);
  return m ? `${m[3]}/${m[2]}/${m[1]}` : String(iso || "—");
}

export function normDateKey(value) {
  if (!value) return "";
  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    return `${value.getFullYear()}-${String(value.getMonth() + 1).padStart(2, "0")}-${String(value.getDate()).padStart(2, "0")}`;
  }
  const s = String(value).trim();
  let m = s.match(/^(\d{4})-(\d{2})-(\d{2})(?:[tT\s].*)?$/);
  if (m) return `${m[1]}-${m[2]}-${m[3]}`;
  m = s.match(/^(\d{1,2})[\/.-](\d{1,2})[\/.-](\d{2}|\d{4})(?:\s+.*)?$/);
  if (m) {
    const y = m[3].length === 2 ? `20${m[3]}` : m[3];
    return `${y}-${m[2].padStart(2, "0")}-${m[1].padStart(2, "0")}`;
  }
  return "";
}

/** Último dia considerado no histórico operacional: ontem (hoje − 1). */
export function getHistDataCutoffIso(refDate = new Date()) {
  const d = new Date(refDate);
  if (Number.isNaN(d.getTime())) return normDateKey(new Date()) || "";
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() - 1);
  return normDateKey(d);
}

/** Retorna metadados de calendário para uma data ISO (YYYY-MM-DD). */
export function getDateMeta(isoDate) {
  const normalized = normDateKey(isoDate);
  if (!normalized) return null;
  const m = normalized.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!m) return null;
  const [, yyyy, mm, dd] = m;
  const date = new Date(Number(yyyy), Number(mm) - 1, Number(dd));
  const dow = date.getDay();
  const mmdd = `${mm}-${dd}`;
  const feriado = FERIADOS_MOVEIS[normalized] || FERIADOS_FIXOS[mmdd] || null;

  const isPonte =
    !feriado &&
    (dow === 5 || dow === 1) &&
    (() => {
      const prev = new Date(date);
      prev.setDate(prev.getDate() - 1);
      const next = new Date(date);
      next.setDate(next.getDate() + 1);
      const prevIso = prev.toISOString().slice(0, 10);
      const nextIso = next.toISOString().slice(0, 10);
      const prevMmdd = `${String(prev.getMonth() + 1).padStart(2, "0")}-${String(prev.getDate()).padStart(2, "0")}`;
      const nextMmdd = `${String(next.getMonth() + 1).padStart(2, "0")}-${String(next.getDate()).padStart(2, "0")}`;
      const prevFer = FERIADOS_MOVEIS[prevIso] || FERIADOS_FIXOS[prevMmdd];
      const nextFer = FERIADOS_MOVEIS[nextIso] || FERIADOS_FIXOS[nextMmdd];
      if (dow === 5 && prevFer && prev.getDay() === 4) return true;
      if (dow === 1 && nextFer && next.getDay() === 2) return true;
      return false;
    })();

  return {
    dow,
    dowLabel: DOW_PT[dow],
    label: `${dd}/${mm}/${yyyy.slice(2)}`,
    feriado,
    isPonte,
    isWeekend: dow === 0 || dow === 6,
    isDomingo: dow === 0,
  };
}
