import { AuthApi } from "./authApi.js";
import { AUTH_CONFIG } from "./authConfig.js";
import { hasPermission, normalizeAuthz } from "./permissions.js";
import { TokenStore, normalizeAuthPayload } from "./tokenStore.js";

const hasWindow = typeof window !== "undefined";
const DEV_USER_INFO = Object.freeze({
  id: "frontend-test",
  username: "frontend",
  name: "Teste Frontend",
  cliente: "Ambiente local",
});
const DEV_AUTHZ = Object.freeze({
  profile: "frontend-test",
  roles: Object.freeze(["FRONTEND_TEST"]),
  permissions: Object.freeze(["*"]),
  scopes: Object.freeze([]),
});

function normalizeClienteId(clienteId) {
  const parsed = Number(clienteId);
  if (!Number.isInteger(parsed) || parsed <= 0) {
    throw new Error("Cliente ID inválido.");
  }
  return parsed;
}

async function persistSession(tokenResponse) {
  try {
    const tokens = TokenStore.setTokens(tokenResponse);
    const profile = await AuthApi.me(tokens.accessToken);
    const userInfo = TokenStore.setUserInfo(profile);
    return { ...tokens, userInfo };
  } catch (error) {
    TokenStore.clear();
    throw error;
  }
}

export const Auth = {
  getAccessToken() {
    return TokenStore.getAccessToken();
  },

  getRefreshToken() {
    return TokenStore.getRefreshToken();
  },

  setTokens(tokens) {
    return TokenStore.setTokens(tokens);
  },

  getUserInfo() {
    if (AUTH_CONFIG.SKIP_AUTH) return DEV_USER_INFO;
    return TokenStore.getUserInfo();
  },

  getAuthz() {
    if (AUTH_CONFIG.SKIP_AUTH) return DEV_AUTHZ;
    const token = TokenStore.getAccessToken();
    return normalizeAuthz({ accessToken: token }, token);
  },

  can(permission) {
    if (AUTH_CONFIG.SKIP_AUTH) return true;
    return hasPermission(this.getAuthz(), permission, { allowMockFallback: false });
  },

  clearTokens() {
    TokenStore.clear();
  },

  isAuthenticated() {
    if (!hasWindow) return false;
    if (AUTH_CONFIG.SKIP_AUTH) return true;
    if (!TokenStore.hasAccessToken()) return false;
    const expiresAt = TokenStore.getExpiresAt();
    if (expiresAt) {
      const expiresTime = new Date(expiresAt).getTime();
      if (Number.isFinite(expiresTime) && expiresTime <= Date.now()) {
        TokenStore.clear();
        return false;
      }
    }
    return true;
  },

  async login({ username, password, clienteId }) {
    const response = await AuthApi.login({
      username: String(username || "").trim(),
      password: String(password || ""),
      clienteId: normalizeClienteId(clienteId),
    });

    return persistSession(response);
  },

  async refreshAccessToken() {
    const refreshToken = TokenStore.getRefreshToken();
    if (!refreshToken) return null;

    const response = await AuthApi.refresh(refreshToken);
    const normalized = normalizeAuthPayload(response);
    const profile = await AuthApi.me(normalized.accessToken);
    TokenStore.setTokens(normalized);
    TokenStore.setUserInfo(profile);
    return normalized.accessToken;
  },

  async loadUserInfo() {
    if (AUTH_CONFIG.SKIP_AUTH) return DEV_USER_INFO;
    const token = TokenStore.getAccessToken();
    if (!token) return null;
    const profile = await AuthApi.me(token);
    return TokenStore.setUserInfo(profile);
  },

  async exchange(token) {
    const response = await AuthApi.exchange(token);
    return persistSession(response);
  },

  logout() {
    TokenStore.clear();
    if (hasWindow) window.location.href = "/login";
  },

  consumeTokenFromUrl() {
    if (!hasWindow) return;

    const params = new URLSearchParams(window.location.search);
    const token = params.get("token");

    if (!token) return;

    return this.exchange(token)
      .then(() => {
        params.delete("token");
        const nextUrl = `${window.location.pathname}${params.toString() ? `?${params.toString()}` : ""}${window.location.hash}`;
        window.history.replaceState({}, "", nextUrl);
      })
      .catch(() => {
        TokenStore.clear();
      });
  },
};
