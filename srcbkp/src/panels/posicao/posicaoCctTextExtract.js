/**
 * Extração heurística de cláusulas CCT a partir do texto do PDF (quando disponível).
 */

const TOPIC_KEYWORDS = {
  "intrajornada-6h": [
    "intervalo intrajornada",
    "intervalo para repouso",
    "intervalo para alimentação",
    "refeição",
    "supressão do intervalo",
    "art. 71",
    "seis horas",
    "6 horas",
  ],
  intrajornada: [
    "intervalo intrajornada",
    "intervalo para repouso",
    "refeição",
    "supressão do intervalo",
    "art. 71",
  ],
  interjornada: ["interjornada", "11 horas", "onze horas", "descanso entre jornadas", "art. 66"],
  extra: [
    "hora extra",
    "horas extras",
    "adicional de",
    "sobrejornada",
    "art. 59",
    "percentual",
  ],
  ponto: [
    "controle de jornada",
    "registro de ponto",
    "ponto eletrônico",
    "marcação",
    "art. 74",
  ],
  ferias: ["férias", "periodo aquisitivo", "período aquisitivo", "gozo de férias"],
  generic: ["jornada", "convenção", "cláusula"],
};

function pickPercent(text, context) {
  const m = context.match(/(\d{1,3})\s*%/);
  return m ? Number(m[1]) : null;
}

function pickMinutes(text, context) {
  const m = context.match(/(\d{1,3})\s*minutos?/i);
  return m ? Number(m[1]) : null;
}

function pickHours(text, context) {
  const m = context.match(/(\d{1,2})\s*horas?/i);
  return m ? Number(m[1]) : null;
}

/**
 * @param {string} text
 * @returns {object}
 */
export function extractStructuredRulesFromText(text) {
  const raw = String(text || "");
  if (!raw.trim()) return {};

  const t = raw.toLowerCase();
  const out = {
    workingHours: {},
    overtime: {},
    breaks: {},
    timeTracking: {},
  };

  const intervaloCtx = sliceAround(t, raw, [
    "intervalo intrajornada",
    "intervalo para repouso",
    "intervalo para alimentação",
    "refeição",
    "repouso e alimentação",
    "intrajornada",
  ], 450);
  if (intervaloCtx) {
    const min = pickMinutes(t, intervaloCtx);
    if (min) out.breaks.mealBreakMinutes = min;
    out.breaks.details = intervaloCtx.slice(0, 280);
  }

  const interCtx = sliceAround(t, raw, ["interjornada", "11 horas", "descanso entre jornadas"], 350);
  if (interCtx) {
    const h = pickHours(t, interCtx);
    if (h) out.breaks.interjourneyHours = h;
    if (!out.breaks.details) out.breaks.details = interCtx.slice(0, 280);
  }

  const heCtx = sliceAround(t, raw, ["hora extra", "horas extras", "adicional"], 350);
  if (heCtx) {
    const pct = pickPercent(t, heCtx);
    if (pct) out.overtime.additionalPercentage = pct;
    out.overtime.details = heCtx.slice(0, 280);
  }

  const bhCtx = sliceAround(t, raw, ["banco de horas", "compensação de jornada"], 300);
  if (bhCtx) {
    out.workingHours.bankOfHours = /banco de horas|compensa/i.test(bhCtx);
    out.workingHours.bankOfHoursDetails = bhCtx.slice(0, 280);
  }

  const pontoCtx = sliceAround(t, raw, ["controle de jornada", "registro de ponto", "ponto eletrônico"], 300);
  if (pontoCtx) {
    out.timeTracking.details = pontoCtx.slice(0, 280);
    out.timeTracking.repRequired = /obrigat|controle|registro/i.test(pontoCtx);
  }

  return out;
}

function sliceAround(lower, raw, keywords, maxLen) {
  for (const kw of keywords) {
    const pos = lower.indexOf(kw.toLowerCase());
    if (pos >= 0) {
      const start = Math.max(0, pos - 120);
      return raw.slice(start, start + maxLen).replace(/\s+/g, " ").trim();
    }
  }
  return null;
}

/**
 * @param {string} text
 * @param {string} penaltyKind
 * @param {number} [max=4]
 */
export function extractTextSnippetsForTopic(text, penaltyKind, max = 4) {
  const keywords = TOPIC_KEYWORDS[penaltyKind] || TOPIC_KEYWORDS.generic;
  const raw = String(text || "");
  const lower = raw.toLowerCase();
  const snippets = [];
  const seen = new Set();

  for (const kw of keywords) {
    let idx = 0;
    while (snippets.length < max) {
      const pos = lower.indexOf(kw.toLowerCase(), idx);
      if (pos < 0) break;
      const start = Math.max(0, pos - 90);
      const end = Math.min(raw.length, pos + 200);
      let snippet = raw.slice(start, end).replace(/\s+/g, " ").trim();
      if (start > 0) snippet = `…${snippet}`;
      if (end < raw.length) snippet = `${snippet}…`;
      const key = snippet.slice(0, 80);
      if (!seen.has(key)) {
        seen.add(key);
        snippets.push({ text: snippet, keyword: kw });
      }
      idx = pos + kw.length;
    }
  }
  return snippets;
}

/**
 * Mescla regras extraídas do texto na análise estruturada.
 * @param {object} analysis
 * @param {string} text
 */
export function enrichAnalysisFromText(analysis, text) {
  if (!text?.trim()) return analysis;
  const extracted = extractStructuredRulesFromText(text);
  const mergeSection = (base, ext) => {
    const out = { ...base };
    for (const [k, v] of Object.entries(ext || {})) {
      if (v != null && v !== "" && (out[k] == null || out[k] === "")) out[k] = v;
    }
    return out;
  };
  return {
    ...analysis,
    workingHours: mergeSection(analysis.workingHours, extracted.workingHours),
    overtime: mergeSection(analysis.overtime, extracted.overtime),
    breaks: mergeSection(analysis.breaks, extracted.breaks),
    timeTracking: mergeSection(analysis.timeTracking, extracted.timeTracking),
  };
}

export function getTopicKeywords(penaltyKind) {
  return TOPIC_KEYWORDS[penaltyKind] || TOPIC_KEYWORDS.generic;
}
