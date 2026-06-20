/** Vigência da CCT — espelha getValidityStatus do módulo de referência. */

export function parseValidityFromFileName(fileName) {
  const base = String(fileName || "").replace(/\.pdf$/i, "");
  const range = base.match(/(\d{4})\s*[-–]\s*(\d{4})/);
  if (range) {
    return {
      validFrom: `${range[1]}-01-01`,
      validUntil: `${range[2]}-12-31`,
      validityPeriod: `${range[1]} – ${range[2]}`,
    };
  }
  const years = [...base.matchAll(/(20\d{2})/g)].map((m) => m[1]);
  if (years.length >= 2) {
    const a = years[years.length - 2];
    const b = years[years.length - 1];
    return {
      validFrom: `${a}-01-01`,
      validUntil: `${b}-12-31`,
      validityPeriod: `${a} – ${b}`,
    };
  }
  if (years.length === 1) {
    return {
      validFrom: `${years[0]}-01-01`,
      validUntil: `${years[0]}-12-31`,
      validityPeriod: years[0],
    };
  }
  return { validFrom: null, validUntil: null, validityPeriod: null };
}

/**
 * @returns {{ status: 'sem_data'|'vigente'|'vencendo'|'expirada', daysLeft: number | null }}
 */
export function getValidityStatus(validUntil) {
  if (!validUntil) return { status: "sem_data", daysLeft: null };

  const end = new Date(`${String(validUntil).slice(0, 10)}T23:59:59`);
  if (Number.isNaN(end.getTime())) return { status: "sem_data", daysLeft: null };

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const endDay = new Date(end);
  endDay.setHours(0, 0, 0, 0);
  const daysLeft = Math.round((endDay.getTime() - today.getTime()) / 86_400_000);

  if (daysLeft < 0) return { status: "expirada", daysLeft };
  if (daysLeft <= 45) return { status: "vencendo", daysLeft };
  return { status: "vigente", daysLeft };
}
