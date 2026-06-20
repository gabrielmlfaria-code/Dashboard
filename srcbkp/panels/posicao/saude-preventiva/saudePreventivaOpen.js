export const SAUDE_PREVENTIVA_CTX_KEY = "saude_preventiva_open_ctx";

export function stashSaudePreventivaOpenContext(ctx = {}) {
  try {
    sessionStorage.setItem(SAUDE_PREVENTIVA_CTX_KEY, JSON.stringify(ctx));
    return true;
  } catch {
    return false;
  }
}

export function readSaudePreventivaOpenContext() {
  try {
    const raw = sessionStorage.getItem(SAUDE_PREVENTIVA_CTX_KEY);
    if (!raw) return null;
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

export function openSaudePreventivaInNewTab(ctx = {}) {
  if (typeof window === "undefined") return false;
  if (!stashSaudePreventivaOpenContext(ctx)) {
    const { periodoLabel = "", empresaLabel = "" } = ctx;
    stashSaudePreventivaOpenContext({ periodoLabel, empresaLabel });
  }
  const url = `${window.location.origin}/saude-preventiva`;
  const opened = window.open(url, "_blank", "noopener,noreferrer");
  return Boolean(opened);
}
