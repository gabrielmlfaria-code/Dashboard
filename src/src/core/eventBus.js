// src/core/eventBus.js
// Pub/Sub simples — elimina acesso direto entre módulos
const _handlers = {};

export const EventBus = {
  on(event, fn) {
    if (!_handlers[event]) _handlers[event] = [];
    _handlers[event].push(fn);
    // retorna função de cleanup
    return () => this.off(event, fn);
  },

  off(event, fn) {
    if (!_handlers[event]) return;
    _handlers[event] = _handlers[event].filter((h) => h !== fn);
  },

  emit(event, payload) {
    (_handlers[event] || []).forEach((fn) => {
      try {
        fn(payload);
      } catch (e) {
        console.error(`[EventBus] erro no handler de "${event}":`, e);
      }
    });
  },
};

// Eventos do sistema — use estas constantes, nunca strings soltas
export const EVENTS = {
  // Dados carregados
  POSICAO_LOADED: "posicao:loaded",
  POSICAO_ERROR: "posicao:error",
  ABSENTEISMO_LOADED: "absenteismo:loaded",
  ABONOS_PEND_LOADED: "abonos:pendentes:loaded",
  ABONOS_EFET_LOADED: "abonos:efetuados:loaded",
  BH_LOADED: "bancoHoras:loaded",
  EVENTOS_LOADED: "eventos:loaded",
  KPIS_LOADED: "kpis:loaded",

  // Ações do usuário
  FILTER_CHANGED: "filter:changed",
  PERIOD_CHANGED: "period:changed",
  PANEL_VISIBILITY: "panel:visibility",
  THEME_CHANGED: "theme:changed",

  // Abonos
  ABONO_APROVADO: "abono:aprovado",
  ABONO_REJEITADO: "abono:rejeitado",
  ABONO_ESTORNADO: "abono:estornado",
};
