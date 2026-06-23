/** Registro de diagnostico CCT mantido em memoria para inspeção pela UI/devtools. */

const MAX_LINES = 80;
const lines = [];

export function cctLog(step, detail) {
  const ts = new Date().toISOString().slice(11, 23);
  lines.push({ step, detail, ts });
  if (lines.length > MAX_LINES) lines.shift();
  if (typeof window !== "undefined") {
    window.__PB_CCT_LOG = lines;
    window.dispatchEvent(new CustomEvent("pb:cct-log", { detail: { step, detail, ts } }));
  }
}

export function cctLogError(step, err) {
  console.error(`[CCT] ${step}`, err);
  cctLog(step, { error: err?.message || String(err), stack: err?.stack?.slice(0, 400) });
}
