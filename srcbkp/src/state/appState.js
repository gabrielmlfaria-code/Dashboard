// src/state/appState.js
// Estado global centralizado — elimina acesso direto entre módulos
// Notifica via EventBus quando o estado muda

import { EventBus, EVENTS } from "../core/eventBus.js";
import { Store } from "../core/store.js";

const _state = {
  // Dados carregados da API
  posicao: null,
  historico: [],
  absenteismo: [],
  abonos: { pendentes: [], efetuados: [] },
  bancoHoras: [],
  eventos: [],
  kpis: {},

  // Filtros globais
  filters: {
    gestor: "",
    depto: "",
    filial: "",
    colab: "",
  },

  // Período selecionado (absenteísmo)
  period: {
    fromIdx: 0,
    toIdx: 0,
  },

  // UI
  theme: Store.get("mp_theme", "light"),
  palette: Store.get("mp_pal", "default"),
  activeTab: Store.get("pp_topnav", "geral"),
};

export const AppState = {
  get(key) {
    return _state[key];
  },

  set(key, value) {
    _state[key] = value;
  },

  getFilters() {
    return { ..._state.filters };
  },

  setFilter(key, value) {
    _state.filters[key] = value;
    EventBus.emit(EVENTS.FILTER_CHANGED, { key, value, filters: this.getFilters() });
  },

  clearFilters() {
    Object.keys(_state.filters).forEach((k) => {
      _state.filters[k] = "";
    });
    EventBus.emit(EVENTS.FILTER_CHANGED, { filters: this.getFilters() });
  },

  setPeriod(fromIdx, toIdx) {
    _state.period = { fromIdx, toIdx };
    EventBus.emit(EVENTS.PERIOD_CHANGED, { ..._state.period });
  },

  setTheme(theme) {
    _state.theme = theme;
    Store.set("mp_theme", theme);
    document.body.setAttribute("data-theme", theme);
    EventBus.emit(EVENTS.THEME_CHANGED, { theme });
  },
};
