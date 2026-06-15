const PB_VIEW_KEY = "pos_bento_view_v1";

export const loadPbView = () => {
  try {
    if (typeof window === "undefined") return {};
    const raw = window.localStorage.getItem(PB_VIEW_KEY);
    const parsed = raw ? JSON.parse(raw) : null;
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
};

export const savePbView = (patch) => {
  try {
    if (typeof window === "undefined") return;
    const prev = loadPbView();
    const next = { ...(prev || {}), ...(patch || {}) };
    window.localStorage.setItem(PB_VIEW_KEY, JSON.stringify(next));
  } catch {
    // ignore
  }
};
