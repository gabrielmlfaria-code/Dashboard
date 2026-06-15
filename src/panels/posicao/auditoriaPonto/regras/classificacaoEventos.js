import {
  getEventoAuditText,
  isEventoAusenciaOuAfastamento,
  isEventoPresenca,
} from "./eventoNatureza.js";

const AUSENCIA_TERMS = [
  "ferias",
  "atestado",
  "auxilio enfermidade",
  "licenca",
  "afastamento",
  "afastado",
  "falta abonada",
  "falta justificada",
  "suspensao",
];

const PRESENCA_TERMS = [
  "horas normais",
  "presente",
  "jornada normal",
  "trabalho normal",
];

const REMUNERADO_TERMS = [
  "horas normais",
  "hora extra",
  "horas extras",
  "adicional",
  "banco credito",
  "credito banco",
  "ferias",
  "falta abonada",
  "auxilio enfermidade",
  "atestado",
];

export function textFromEvent(inputOrText) {
  return getEventoAuditText(inputOrText);
}

export function isEventoAusenciaIntegralText(value) {
  const text = textFromEvent(value);
  return isEventoAusenciaOuAfastamento(value) || AUSENCIA_TERMS.some((term) => text.includes(getEventoAuditText(term)));
}

export function isEventoPresencaText(value) {
  const text = textFromEvent(value);
  return isEventoPresenca(value) || PRESENCA_TERMS.some((term) => text.includes(getEventoAuditText(term)));
}

export function isEventoRemuneradoText(value) {
  const text = textFromEvent(value);
  return REMUNERADO_TERMS.some((term) => text.includes(getEventoAuditText(term)));
}

export function isEventoDomingoFeriadoClassificado(eventText) {
  return (
    eventText.includes("feriado") ||
    eventText.includes("domingo") ||
    eventText.includes("dsr") ||
    eventText.includes("folga") ||
    eventText.includes("extra") ||
    eventText.includes("banco") ||
    eventText.includes("compens")
  );
}
