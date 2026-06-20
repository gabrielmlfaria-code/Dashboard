// src/core/utils.js
export const Utils = {
  /** Escapa HTML para prevenir XSS */
  esc(s) {
    return String(s == null ? "" : s)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  },

  /** Debounce */
  deb(fn, ms) {
    let t;
    return function (...args) {
      clearTimeout(t);
      t = setTimeout(() => fn.apply(this, args), ms);
    };
  },

  /** Date → 'YYYY-MM-DD' */
  isoDate(d) {
    return d.toISOString().slice(0, 10);
  },

  /** 'YYYY-MM-DD' → 'DD/MM/YYYY' */
  fmtBR(iso) {
    if (!iso) return "--";
    const [y, m, d] = iso.split("-");
    return `${d}/${m}/${y}`;
  },

  /** 'YYYY-MM-DD' → 'DD/MM' */
  fmtBRShort(iso) {
    if (!iso) return "--";
    const [, m, d] = iso.split("-");
    return `${d}/${m}`;
  },

  /** Adiciona N dias a uma data ISO */
  addDays(iso, n) {
    const d = new Date(`${iso}T12:00:00`);
    d.setDate(d.getDate() + n);
    return this.isoDate(d);
  },

  /** Retorna último dia do mês dado 'YYYY-MM' */
  lastDayOfMonth(ymKey) {
    const [y, m] = ymKey.split("-");
    return new Date(parseInt(y), parseInt(m), 0).getDate();
  },

  /** Lê variável CSS do body */
  cssVar(v) {
    return getComputedStyle(document.body).getPropertyValue(v).trim();
  },

  /** Formata minutos → 'HH:MM' */
  minToHHMM(min, showSign = false) {
    const neg = min < 0;
    const abs = Math.abs(min);
    const h = Math.floor(abs / 60);
    const m = abs % 60;
    const str = String(h).padStart(2, "0") + ":" + String(m).padStart(2, "0");
    if (showSign) return (neg ? "-" : "+") + str;
    return (neg ? "-" : "") + str;
  },
};
