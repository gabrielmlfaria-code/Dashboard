export const NR1_OPEN_CTX_KEY = "nr1_open_ctx";

export function stashNr1OpenContext(ctx = {}) {
  try {
    sessionStorage.setItem(NR1_OPEN_CTX_KEY, JSON.stringify(ctx));
    return true;
  } catch {
    return false;
  }
}

export function readNr1OpenContext() {
  try {
    const raw = sessionStorage.getItem(NR1_OPEN_CTX_KEY);
    if (!raw) return null;
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

export function openNr1InNewTab(ctx = {}) {
  if (typeof window === "undefined") return false;
  stashNr1OpenContext(ctx);
  const url = `${window.location.origin}/nr-1`;
  const opened = window.open(url, "_blank", "noopener,noreferrer");
  return Boolean(opened);
}
