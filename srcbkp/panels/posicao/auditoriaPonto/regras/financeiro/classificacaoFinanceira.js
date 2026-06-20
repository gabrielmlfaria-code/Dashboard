export function normalizeFinanceiroText(value) {
  if (value && typeof value === "object") {
    return normalizeFinanceiroText(
      value.evento || value.descricao || value.desc || value.nome || value.codigo || value.cod || "",
    );
  }
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
}

export function getSameDayEventTexts(ctx) {
  return [
    ...(Array.isArray(ctx?.sameDayEventTexts) ? ctx.sameDayEventTexts : []),
    ...(Array.isArray(ctx?.input?.sameDayEvents) ? ctx.input.sameDayEvents : []),
    ...(Array.isArray(ctx?.input?.eventosDia) ? ctx.input.eventosDia : []),
    ...(Array.isArray(ctx?.input?.eventosMesmoDia) ? ctx.input.eventosMesmoDia : []),
  ];
}

export function isEventoExtraOuCompensado(eventText) {
  const text = normalizeFinanceiroText(eventText);
  return (
    text.includes("extra") ||
    /\bbhc\b/.test(text) ||
    /\bbhd\b/.test(text) ||
    text.includes("banco de horas") ||
    text.includes("banco credito") ||
    text.includes("credito banco") ||
    text.includes("compens") ||
    text.includes("sobreaviso")
  );
}

export function isEventoFaltaMarcacao(eventText) {
  const text = normalizeFinanceiroText(eventText);
  return (
    /\bfm\b/.test(text) ||
    text.includes("falta de marcacao") ||
    text.includes("falta marcacao") ||
    text.includes("sem marcacao")
  );
}

export function isEventoAjustePonto(eventText) {
  const text = normalizeFinanceiroText(eventText);
  return (
    isEventoFaltaMarcacao(text) ||
    text.includes("atrasos") ||
    text.includes("atraso") ||
    text.includes("falta de marcacao") ||
    text.includes("falta marcacao")
  );
}

export function hasSameDayMissingPunchEvent(ctx) {
  return getSameDayEventTexts(ctx).some((text) => isEventoFaltaMarcacao(text));
}

export function hasSameDayPointAdjustmentEvent(ctx) {
  return getSameDayEventTexts(ctx).some((text) => isEventoAjustePonto(text));
}
