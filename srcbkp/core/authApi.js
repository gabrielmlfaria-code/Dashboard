import { AUTH_CONFIG } from "./authConfig.js";

async function parseResponse(response) {
  if (response.status === 204) return null;

  const contentType = response.headers.get("content-type") || "";
  const bodyText = await response.text();
  if (!bodyText) return null;

  if (contentType.includes("application/json")) {
    try {
      return JSON.parse(bodyText);
    } catch {
      return bodyText;
    }
  }

  return bodyText;
}

function getErrorMessage(payload, fallback) {
  if (!payload) return fallback;
  if (typeof payload === "string") return payload;
  return payload.message || payload.detail || payload.title || fallback;
}

async function post(path, body) {
  const response = await fetch(AUTH_CONFIG.API_BASE + path, {
    method: "POST",
    credentials: AUTH_CONFIG.AUTH_CREDENTIALS,
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body || {}),
  });

  const payload = await parseResponse(response);
  if (!response.ok) {
    throw new Error(getErrorMessage(payload, "Falha de autenticação."));
  }

  return payload;
}

export const AuthApi = {
  login({ username, password, clienteId }) {
    return post(AUTH_CONFIG.AUTH_ENDPOINTS.login, { username, password, clienteId });
  },

  refresh(refreshToken) {
    return post(AUTH_CONFIG.AUTH_ENDPOINTS.refresh, { refreshToken });
  },

  exchange(token) {
    return post(AUTH_CONFIG.AUTH_ENDPOINTS.exchange, { token });
  },

  async me(accessToken) {
    const response = await fetch(AUTH_CONFIG.API_BASE + AUTH_CONFIG.AUTH_ENDPOINTS.me, {
      method: "GET",
      credentials: AUTH_CONFIG.AUTH_CREDENTIALS,
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    });

    const payload = await parseResponse(response);
    if (!response.ok) {
      throw new Error(getErrorMessage(payload, "Falha ao carregar perfil do usuário."));
    }

    return payload;
  },
};
