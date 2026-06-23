import { extractTimes, toMinutes } from "../utils/tempo.js";

export function normalizarMarcacoes(value, data = "") {
  const times = extractTimes(value);
  const out = [];
  let dayOffset = 0;
  let prev = null;
  for (const original of times) {
    const base = toMinutes(original);
    if (base == null) continue;
    let minutes = base + dayOffset;
    let cruzouMeiaNoite = false;
    if (prev != null && minutes < prev) {
      dayOffset += 1440;
      minutes = base + dayOffset;
      cruzouMeiaNoite = true;
    }
    out.push({
      original,
      minutes,
      baseMinutes: base,
      dayOffset: Math.floor(minutes / 1440),
      cruzouMeiaNoite,
      data,
    });
    prev = minutes;
  }
  return out;
}
