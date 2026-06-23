const ENV = import.meta.env ?? {};

export const AUTH_CONFIG = {
  SKIP_AUTH: String(ENV.VITE_SKIP_AUTH || "").toLowerCase() === "true",
  API_BASE: ENV.VITE_API_BASE_URL || "/api",
  AUTH_CREDENTIALS: ENV.VITE_AUTH_CREDENTIALS || "same-origin",
  TOKEN_KEY: "mp_token",
  TOKEN_EXPIRY_KEY: "mp_token_expiry",
  REFRESH_TOKEN_KEY: "mp_refresh_token",
  USER_INFO_KEY: "mp_user_info",
  AUTH_ENDPOINTS: {
    login: "/auth/login",
    refresh: "/auth/refresh",
    me: "/auth/me",
    exchange: "/auth/exchange",
  },
};
