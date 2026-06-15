export function isEventoExtraOuCompensado(eventText) {
  return (
    eventText.includes("extra") ||
    eventText.includes("banco credito") ||
    eventText.includes("credito banco") ||
    eventText.includes("compens") ||
    eventText.includes("sobreaviso")
  );
}
