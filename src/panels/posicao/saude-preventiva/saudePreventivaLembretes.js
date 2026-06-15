export const SAUDE_LEMBRETES_LS_KEY = "saude_preventiva_lembretes_v1";

const NOTIFY_STATUSES = new Set(["ativo", "atrasado", "proximo"]);

export function loadSaudeLembretesState() {
  try {
    if (typeof window === "undefined") return { notified: {}, lembretesAtivos: true };
    const raw = window.localStorage.getItem(SAUDE_LEMBRETES_LS_KEY);
    const parsed = raw ? JSON.parse(raw) : {};
    return {
      notified: parsed.notified && typeof parsed.notified === "object" ? parsed.notified : {},
      lembretesAtivos: parsed.lembretesAtivos !== false,
      permissionAsked: Boolean(parsed.permissionAsked),
    };
  } catch {
    return { notified: {}, lembretesAtivos: true, permissionAsked: false };
  }
}

export function saveSaudeLembretesState(state) {
  try {
    if (typeof window === "undefined") return;
    window.localStorage.setItem(
      SAUDE_LEMBRETES_LS_KEY,
      JSON.stringify({
        notified: state.notified || {},
        lembretesAtivos: state.lembretesAtivos !== false,
        permissionAsked: Boolean(state.permissionAsked),
      }),
    );
  } catch {
    // ignore quota
  }
}

export function getCalendarioItensParaLembrete(calendario = []) {
  return (Array.isArray(calendario) ? calendario : []).filter(
    (item) => NOTIFY_STATUSES.has(item.status) && !item.realizadoAno,
  );
}

export function filterLembretesNaoNotificadosHoje(itens, state, todayIso = new Date().toISOString().slice(0, 10)) {
  const notified = state?.notified || {};
  return itens.filter((item) => notified[String(item.id)] !== todayIso);
}

export function markLembreteNotificado(state, itemId, todayIso = new Date().toISOString().slice(0, 10)) {
  return {
    ...state,
    notified: { ...(state?.notified || {}), [String(itemId)]: todayIso },
  };
}

export async function requestSaudeNotificationPermission() {
  if (typeof Notification === "undefined") return "unsupported";
  if (Notification.permission === "granted") return "granted";
  if (Notification.permission === "denied") return "denied";
  try {
    return await Notification.requestPermission();
  } catch {
    return "denied";
  }
}

export function showSaudeBrowserNotification(item) {
  if (typeof Notification === "undefined" || Notification.permission !== "granted") return false;
  try {
    const statusLabel =
      item.status === "atrasado" ? "Atrasado" : item.status === "ativo" ? "Ação agora" : "Em breve";
    new Notification(`Saúde preventiva — ${item.titulo}`, {
      body: `${statusLabel}: ${item.mensagem}`,
      tag: `saude-preventiva-${item.id}`,
    });
    return true;
  } catch {
    return false;
  }
}

/** Dispara toast e/ou notificação do navegador para lembretes pendentes do dia. */
export async function processSaudeCalendarioLembretes(calendario = [], handlers = {}) {
  const { showToast, onOpenCard, force = false } = handlers;
  let state = loadSaudeLembretesState();
  if (!state.lembretesAtivos && !force) return { state, notified: 0 };

  const pendentes = filterLembretesNaoNotificadosHoje(getCalendarioItensParaLembrete(calendario), state);
  if (!pendentes.length) return { state, notified: 0 };

  const prioridade = { atrasado: 0, ativo: 1, proximo: 2 };
  pendentes.sort((a, b) => (prioridade[a.status] ?? 9) - (prioridade[b.status] ?? 9));

  let notified = 0;
  for (const item of pendentes) {
    const browserOk = showSaudeBrowserNotification(item);
    if (showToast) {
      const prefix =
        item.status === "atrasado" ? "Campanha atrasada" : item.status === "ativo" ? "Campanha ativa" : "Lembrete";
      showToast(`${prefix}: ${item.titulo} — ${item.mensagem}`, item.status === "atrasado" ? "w" : "i", 6000);
    }
    state = markLembreteNotificado(state, item.id);
    notified += 1;
    if (browserOk) break;
  }

  saveSaudeLembretesState(state);
  if (notified > 0 && onOpenCard && typeof onOpenCard === "function") onOpenCard(pendentes[0]);
  return { state, notified };
}

export function setSaudeLembretesAtivos(ativo) {
  const state = { ...loadSaudeLembretesState(), lembretesAtivos: Boolean(ativo) };
  saveSaudeLembretesState(state);
  return state;
}
