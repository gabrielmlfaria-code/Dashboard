export function parseIsoDate(value) {
  if (!value) return null;
  const text = String(value).slice(0, 10);
  const date = new Date(`${text}T00:00:00`);
  return Number.isNaN(date.getTime()) ? null : date;
}

export function fmtIsoDate(value) {
  const date = parseIsoDate(value);
  return date ? date.toISOString().slice(0, 10) : "";
}

export function isBeforeDate(date, limit) {
  const d = parseIsoDate(date);
  const l = parseIsoDate(limit);
  return Boolean(d && l && d < l);
}

export function isAfterDate(date, limit) {
  const d = parseIsoDate(date);
  const l = parseIsoDate(limit);
  return Boolean(d && l && d > l);
}
