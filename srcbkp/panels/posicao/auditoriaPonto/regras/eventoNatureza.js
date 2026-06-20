import {
  DEFAULT_AUDITORIA_PONTO_EVENTOS_JORNADA_PRINCIPAL,
  DEFAULT_AUDITORIA_PONTO_EVENTOS_SEM_MARCACAO_OK,
} from "../config/parametros.js";
import { normText } from "../utils/tempo.js";

const AUSENCIA_CATEGORIA_TERMS = [
  "ausent",
  "justific",
  "ferias",
  "folga",
  "afast",
  "licenca",
  "atestado",
];

const AUSENCIA_EVENTO_TERMS = [
  "ferias",
  "falta nao justificada",
  "falta injustificada",
  "falta abonada",
  "falta justificada",
  "auxilio enfermidade",
  "atestado",
  "licenca",
  "afastamento",
  "declaracao",
  "suspensao",
];

const PRESENCA_EVENTO_TERMS = [
  "horas normais",
  "presente",
  "jornada normal",
  "trabalho normal",
];

export function getEventoAuditText(input = {}) {
  if (typeof input === "string") return normText(input);
  return normText(
    [
      input?.evento,
      input?.situacaoDesc,
      input?.justificativa,
      input?._cat,
      input?.categoria,
      input?.observacao,
      input?.obs,
    ]
      .filter(Boolean)
      .join(" "),
  );
}

export function getCategoriaAuditText(input = {}) {
  return normText([input?._cat, input?.categoria].filter(Boolean).join(" "));
}

export function isEventoRiscoTrabalhista(input = {}) {
  const categoryText = getCategoriaAuditText(input);
  if (
    categoryText === "risco" ||
    categoryText.includes("risco trab") ||
    categoryText.includes("risco trabalhista")
  ) {
    return true;
  }
  const eventText = getEventoAuditText(input);
  return eventText.includes("risco trab") || eventText.includes("risco trabalhista");
}

export function isEventoSemMarcacaoAceitavel(input = {}, params = {}) {
  const text = getEventoAuditText(input);
  const termos = Array.isArray(params.eventosSemMarcacaoOk)
    ? params.eventosSemMarcacaoOk
    : DEFAULT_AUDITORIA_PONTO_EVENTOS_SEM_MARCACAO_OK;
  return termos.some((term) => {
    const normalized = normText(term);
    return normalized && text.includes(normalized);
  });
}

export function isCategoriaAusencia(input = {}) {
  const categoryText = getCategoriaAuditText(input);
  return AUSENCIA_CATEGORIA_TERMS.some((term) => categoryText.includes(term));
}

export function isEventoAusenciaOuAfastamento(input = {}, params = {}) {
  const text = getEventoAuditText(input);
  return (
    isEventoSemMarcacaoAceitavel(input, params) ||
    isCategoriaAusencia(input) ||
    AUSENCIA_EVENTO_TERMS.some((term) => text.includes(normText(term)))
  );
}

export function isEventoPresenca(input = {}, params = {}) {
  const text = getEventoAuditText(input);
  if (!text) {
    return Boolean(input?.horario || input?.marcacao || Number(input?.horas || 0) > 0);
  }
  const termos = Array.isArray(params.eventosJornadaPrincipal)
    ? params.eventosJornadaPrincipal
    : DEFAULT_AUDITORIA_PONTO_EVENTOS_JORNADA_PRINCIPAL;
  return [...PRESENCA_EVENTO_TERMS, ...termos].some((term) => {
    const normalized = normText(term);
    return normalized && text.includes(normalized);
  });
}

export function isEventoIgnoradoPorNatureza(input = {}, params = {}) {
  const text = getEventoAuditText(input);
  return (
    isEventoRiscoTrabalhista(input) ||
    isEventoAusenciaOuAfastamento(input, params) ||
    text.includes("nao controla ponto") ||
    text.includes("ncp")
  );
}

export function isEventoTrabalhado(input = {}, params = {}) {
  return !isEventoIgnoradoPorNatureza(input, params);
}
