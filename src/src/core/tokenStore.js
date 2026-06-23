import { AUTH_CONFIG } from "./authConfig.js";
import { Store } from "./store.js";

const USER_INFO_KEY = AUTH_CONFIG.USER_INFO_KEY;

function secondsFromNow(seconds) {
  const parsed = Number(seconds);
  if (!Number.isFinite(parsed) || parsed <= 0) return null;
  return new Date(Date.now() + parsed * 1000).toISOString();
}

function assertString(value, field) {
  if (typeof value !== "string" || !value.trim()) {
    throw new Error(`Resposta de autenticação inválida: ${field} não foi retornado.`);
  }
  return value;
}

export function normalizeAuthPayload(payload = {}) {
  const data = payload && typeof payload === "object" ? payload : {};
  const expiresIn = Number(data.expiresIn);

  if (!Number.isFinite(expiresIn) || expiresIn <= 0) {
    throw new Error("Resposta de autenticação inválida: expiresIn não foi retornado.");
  }
  return {
    accessToken: assertString(data.accessToken, "accessToken"),
    refreshToken: assertString(data.refreshToken, "refreshToken"),
    expiresIn,
    expiresAt: secondsFromNow(expiresIn),
  };
}

export function normalizeUserInfo(payload = {}) {
  const data = payload && typeof payload === "object" ? payload : {};
  const filial =
    typeof data.filial === "string" && data.filial.trim() ? data.filial.trim()
    : typeof data.filialNome === "string" && data.filialNome.trim() ? data.filialNome.trim()
    : "";
  return {
    id: assertString(data.id, "id"),
    username: assertString(data.username, "username"),
    name: assertString(data.name, "name"),
    cliente: assertString(data.cliente, "cliente"),
    // Campo opcional: só incluído quando o backend retorna a filial do usuário.
    ...(filial ? { filial } : {}),
  };
}

export const TokenStore = {
  getAccessToken() {
    return Store.get(AUTH_CONFIG.TOKEN_KEY, null);
  },

  getRefreshToken() {
    return Store.get(AUTH_CONFIG.REFRESH_TOKEN_KEY, null);
  },

  getExpiresAt() {
    return Store.get(AUTH_CONFIG.TOKEN_EXPIRY_KEY, null);
  },

  getUserInfo() {
    return Store.get(USER_INFO_KEY, null);
  },

  setTokens(payload = {}) {
    const normalized = normalizeAuthPayload(payload);

    Store.set(AUTH_CONFIG.TOKEN_KEY, normalized.accessToken);
    Store.set(AUTH_CONFIG.REFRESH_TOKEN_KEY, normalized.refreshToken);
    Store.set(AUTH_CONFIG.TOKEN_EXPIRY_KEY, normalized.expiresAt);

    return normalized;
  },

  setUserInfo(payload = {}) {
    const normalized = normalizeUserInfo(payload);
    Store.set(USER_INFO_KEY, normalized);
    return normalized;
  },

  clear() {
    Store.remove(AUTH_CONFIG.TOKEN_KEY);
    Store.remove(AUTH_CONFIG.REFRESH_TOKEN_KEY);
    Store.remove(AUTH_CONFIG.TOKEN_EXPIRY_KEY);
    Store.remove(USER_INFO_KEY);
  },

  hasAccessToken() {
    return Boolean(this.getAccessToken());
  },

  isAccessTokenExpiring(windowMs = 60_000) {
    const expiresAt = this.getExpiresAt();
    if (!expiresAt) return false;
    const expiresTime = new Date(expiresAt).getTime();
    return Number.isFinite(expiresTime) && expiresTime - Date.now() <= windowMs;
  },
};
