export const POSITION_CATEGORY_KEYS = [
  "presentes",
  "falta",
  "atraso",
  "folga",
  "ferias",
  "afastados",
  "ja_saiu",
  "entrada_prev",
  "nao_controla",
];

export const POSITION_CATEGORY_LABELS = {
  presentes: "Presentes",
  falta: "Faltas",
  atraso: "Atrasos",
  folga: "Folgas",
  ferias: "Férias",
  afastados: "Afastados",
  ja_saiu: "Já saíram",
  entrada_prev: "Entrada prevista",
  nao_controla: "Não controla ponto",
};

export const POSITION_CATEGORY_HOURS = {
  presentes: { hrsPlan: 480, hrsPres: 480 },
  atraso: { hrsPlan: 480, hrsPres: 450, hrsAuse: 30 },
  falta: { hrsPlan: 480, hrsAuse: 480 },
  folga: { hrsPlan: 0, hrsJust: 0 },
  ferias: { hrsPlan: 0, hrsJust: 0 },
  afastados: { hrsPlan: 0, hrsJust: 0 },
  ja_saiu: { hrsPlan: 480, hrsPres: 480 },
  entrada_prev: { hrsPlan: 480 },
  nao_controla: { hrsPlan: 0 },
};

export function normalizePositionCategory(raw, fallback = "presentes") {
  const value = String(raw || "")
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .replace(/[\s_-]+/g, "_");

  if (!value) return fallback;
  if (["falta", "faltas", "ausente", "ausentes", "absence"].includes(value)) return "falta";
  if (["atraso", "atrasos", "late"].includes(value)) return "atraso";
  if (["ferias", "ferias_", "vacation"].includes(value)) return "ferias";
  if (["afastado", "afastados", "licenca", "licencas", "leave"].includes(value)) return "afastados";
  if (["folga", "folgas", "day_off"].includes(value)) return "folga";
  if (["nao_controla", "nao_controla_ponto", "sem_controle", "semcontrole"].includes(value))
    return "nao_controla";
  if (["ja_saiu", "saiu", "desligado", "desligados"].includes(value)) return "ja_saiu";
  if (["entrada_prev", "entrada_prevista", "admissao_prevista"].includes(value)) return "entrada_prev";
  if (["presente", "presentes", "trabalhando", "ativo", "ativos"].includes(value)) return "presentes";
  return fallback;
}

export function getPositionCategoryLabel(category) {
  const normalized = normalizePositionCategory(category, category);
  return POSITION_CATEGORY_LABELS[normalized] || String(category || "");
}

export function getPositionCategoryHours(category) {
  const normalized = normalizePositionCategory(category, category);
  return POSITION_CATEGORY_HOURS[normalized] || {};
}
