const ENV = import.meta.env ?? {};

export const CONFIG = {
  USE_MOCK: ENV.VITE_USE_MOCK ? ENV.VITE_USE_MOCK === "true" : ENV.DEV,
  API_SOURCE: ENV.VITE_API_SOURCE || (ENV.DEV ? "mock" : "api"),
  ABSENTEISMO_API: ENV.VITE_ABSENTEISMO_API === "true",
  API_BASE: ENV.VITE_API_BASE_URL || "/api",
  AUTH_CREDENTIALS: ENV.VITE_AUTH_CREDENTIALS || "same-origin",
  ENABLE_IMPORTS: ENV.VITE_ENABLE_IMPORTS ? ENV.VITE_ENABLE_IMPORTS !== "false" : true,
  MODULE_SOURCES: {
    posicao: ENV.VITE_SOURCE_POSICAO || ENV.VITE_API_SOURCE || null,
    absenteismo: ENV.VITE_SOURCE_ABSENTEISMO || ENV.VITE_API_SOURCE || null,
    radar: ENV.VITE_SOURCE_RADAR || ENV.VITE_API_SOURCE || null,
    mensal: ENV.VITE_SOURCE_MENSAL || ENV.VITE_API_SOURCE || null,
    turnover: ENV.VITE_SOURCE_TURNOVER || ENV.VITE_API_SOURCE || null,
    bancoHoras: ENV.VITE_SOURCE_BANCO_HORAS || ENV.VITE_API_SOURCE || null,
  },
  TOKEN_KEY: "mp_token",
  TOKEN_EXPIRY_KEY: "mp_token_expiry",
  REFRESH_TOKEN_KEY: "mp_refresh_token",
  AUTHZ_PERMISSIONS_KEY: "mp_authz_permissions",
  AUTHZ_ROLES_KEY: "mp_authz_roles",
  AUTHZ_PROFILE_KEY: "mp_authz_profile",
  AUTHZ_SCOPES_KEY: "mp_authz_scopes",
  AUTH_ENDPOINTS: {
    login: "/auth/login",
    refresh: "/auth/refresh",
  },
};
