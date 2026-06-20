export const fmtHM = (mins) => {
  const n = Math.max(0, Math.round(Number(mins) || 0));
  const h = Math.floor(n / 60);
  const m = n % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
};

/** Formato legivel para KPIs do radar (so exibicao; minutos inalterados). */
export const fmtHMReadable = (mins) => {
  const n = Math.round(Number(mins) || 0);
  const sign = n < 0 ? "-" : "";
  const abs = Math.abs(n);
  const h = Math.floor(abs / 60);
  const m = abs % 60;
  if (h >= 100) {
    return m > 0
      ? `${sign}${h.toLocaleString("pt-BR")} h ${String(m).padStart(2, "0")} min`
      : `${sign}${h.toLocaleString("pt-BR")} h`;
  }
  if (h > 0 || m > 0) {
    return `${sign}${String(h).padStart(2, "0")} h ${String(m).padStart(2, "0")} min`;
  }
  return "0 h";
};

export const fmtHMMilhar = (mins) => {
  const n = Math.round(Number(mins) || 0);
  const sign = n < 0 ? "-" : "";
  const abs = Math.abs(n);
  const h = Math.floor(abs / 60).toLocaleString("pt-BR");
  const m = String(abs % 60).padStart(2, "0");
  return `${sign}${h}:${m}`;
};
