/**
 * Shared formatters and normalizers for the NL assistant module.
 */

/** Strip accents, lowercase, collapse punctuation/spaces. */
export function normNl(text) {
  return String(text || "")
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim();
}

/** Format a number with pt-BR locale separators. */
export function fmtNum(n) {
  return Number(n || 0).toLocaleString("pt-BR");
}

/** Format integer minutes as human-readable pt-BR text. */
export function fmtMinutes(min) {
  const m = Math.max(0, Math.round(Number(min) || 0));
  if (m < 60) return `${fmtNum(m)} min`;
  const h = Math.floor(m / 60);
  const r = m % 60;
  if (r === 0) return `${fmtNum(h)} h`;
  return `${fmtNum(h)} h ${fmtNum(r)} min`;
}
