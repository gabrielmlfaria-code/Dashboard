const ENV = import.meta.env ?? {};

const LOCAL_DEV_HOSTS = new Set(["localhost", "127.0.0.1", "::1"]);

function isLocalDevHost() {
  if (typeof window === "undefined") return false;
  return LOCAL_DEV_HOSTS.has(window.location.hostname);
}

const skipAuthByEnv = String(ENV.VITE_SKIP_AUTH || "").toLowerCase() === "true";
//const skipAuthForLocalDev = Boolean(ENV.DEV && isLocalDevHost());

export const AUTH_CONFIG = {
  SKIP_AUTH: skipAuthByEnv,// || skipAuthForLocalDev,
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
