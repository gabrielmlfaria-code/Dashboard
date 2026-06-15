const brl = new Intl.NumberFormat('pt-BR', {
  style: 'currency',
  currency: 'BRL',
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

const percent = new Intl.NumberFormat('pt-BR', {
  minimumFractionDigits: 1,
  maximumFractionDigits: 1,
});

const fte = new Intl.NumberFormat('pt-BR', {
  minimumFractionDigits: 1,
  maximumFractionDigits: 1,
});

/** @param {number} value */
export function formatBRL(value) {
  return brl.format(Number(value) || 0);
}

/** @param {number} value — escala 0–100 (ex.: 45.3 → "45,3%") */
export function formatPercent(value) {
  return `${percent.format(Number(value) || 0)}%`;
}

/** @param {number} value */
export function formatFTE(value) {
  const n = Number(value) || 0;
  const abs = fte.format(Math.abs(n));
  if (n > 0) return `+${abs} FTEs`;
  if (n < 0) return `-${abs} FTEs`;
  return `${abs} FTEs`;
}

/** Data e hora atuais em pt-BR */
export function formatDate() {
  return new Date().toLocaleString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}
