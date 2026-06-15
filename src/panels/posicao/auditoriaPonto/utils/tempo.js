export function normText(value) {
  return String(value || "")
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

export function toMinutes(hhmm) {
  const m = String(hhmm || "").match(/^(\d{1,2}):(\d{2})$/);
  if (!m) return null;
  const h = Number(m[1]);
  const min = Number(m[2]);
  if (!Number.isFinite(h) || !Number.isFinite(min) || h > 47 || min > 59) return null;
  return h * 60 + min;
}

export function fmtMin(min) {
  const v = Math.max(0, Math.round(Number(min) || 0));
  return `${Math.floor(v / 60)}:${String(v % 60).padStart(2, "0")}`;
}

export function stripHorarioCode(value) {
  return String(value || "")
    .replace(/^\d+\s*-\s*/, "")
    .trim();
}

export function extractTimes(value) {
  if (Array.isArray(value)) return value.flatMap((item) => extractTimes(item));
  return stripHorarioCode(value).match(/\b\d{1,2}:\d{2}\b/g) || [];
}

export function sumPairs(marcacoesNormalizadas) {
  let total = 0;
  for (let i = 0; i + 1 < marcacoesNormalizadas.length; i += 2) {
    total += Math.max(0, marcacoesNormalizadas[i + 1].minutes - marcacoesNormalizadas[i].minutes);
  }
  return total;
}

export function dayDiff(fromIso, toIso) {
  if (!fromIso || !toIso || fromIso === toIso) return 0;
  const from = new Date(`${fromIso}T00:00:00`);
  const to = new Date(`${toIso}T00:00:00`);
  if (Number.isNaN(from.getTime()) || Number.isNaN(to.getTime())) return 0;
  return Math.round((to - from) / 86400000);
}
