import { Auth } from "./auth.js";
import { AUTH_CONFIG } from "./authConfig.js";
import { TokenStore } from "./tokenStore.js";

let refreshPromise = null;

function normalizeHeaders(headers) {
  if (!headers) return {};
  if (headers instanceof Headers) return Object.fromEntries(headers.entries());
  if (Array.isArray(headers)) return Object.fromEntries(headers);
  return { ...headers };
}

function isAuthEndpoint(url) {
  const path = String(url).replace(AUTH_CONFIG.API_BASE, "");
  return Object.values(AUTH_CONFIG.AUTH_ENDPOINTS).some((endpoint) => path.startsWith(endpoint));
}

function hasContentType(headers) {
  return Object.keys(headers).some((key) => key.toLowerCase() === "content-type");
}

function buildHeaders(opts = {}) {
  const headers = normalizeHeaders(opts.headers);
  const body = opts.body;
  const isFormData = typeof FormData !== "undefined" && body instanceof FormData;
  const shouldAddJsonType = body != null && !isFormData && !hasContentType(headers);

  if (shouldAddJsonType) {
    headers["Content-Type"] = "application/json";
  }

  if (opts.auth !== false && !isAuthEndpoint(opts.url)) {
    const token = TokenStore.getAccessToken();
    if (token) headers.Authorization = `Bearer ${token}`;
  }

  return headers;
}

async function parseResponse(response, responseType) {
  if (response.status === 204) return null;

  if (responseType === "blob") return response.blob();
  if (responseType === "arrayBuffer") return response.arrayBuffer();
  if (responseType === "text") return response.text();

  const contentType = response.headers.get("content-type") || "";
  const text = await response.text();
  if (!text) return null;

  if (contentType.includes("application/json")) {
    try {
      return JSON.parse(text);
    } catch {
      return text;
    }
  }

  return text;
}

function getErrorMessage(payload, fallback) {
  if (!payload) return fallback;
  if (typeof payload === "string") return payload;
  return payload.message || payload.detail || payload.title || fallback;
}

function redirectToLogin() {
  if (typeof window !== "undefined" && window.location.pathname !== "/login") {
    window.location.replace("/login");
  }
}

async function getRefreshPromise() {
  const refreshToken = TokenStore.getRefreshToken();
  if (!refreshToken) return null;

  if (!refreshPromise) {
    refreshPromise = Auth.refreshAccessToken()
      .finally(() => {
        refreshPromise = null;
      });
  }

  return refreshPromise;
}

export const HttpClient = {
  async request(url, opts = {}) {
    const { responseType, _retried, ...fetchOpts } = opts;
    const requestUrl = AUTH_CONFIG.API_BASE + url;
    const headers = buildHeaders({ ...fetchOpts, url });

    const response = await fetch(requestUrl, {
      ...fetchOpts,
      credentials: fetchOpts.credentials || AUTH_CONFIG.AUTH_CREDENTIALS,
      headers,
    });

    if (response.status === 401 && opts.auth !== false && !isAuthEndpoint(url)) {
      if (!_retried) {
        try {
          const newToken = await getRefreshPromise();
          if (newToken) {
            return this.request(url, { ...opts, _retried: true });
          }
        } catch {
          TokenStore.clear();
          redirectToLogin();
          throw new Error("Sessão expirada. Faça login novamente.");
        }
      }

      TokenStore.clear();
      redirectToLogin();
      throw new Error("Sessão expirada. Faça login novamente.");
    }

    const payload = await parseResponse(response, responseType);
    if (!response.ok) {
      throw new Error(getErrorMessage(payload, `Erro ${response.status}`));
    }

    return payload;
  },

  get(url, opts) {
    return this.request(url, { ...opts, method: "GET" });
  },

  post(url, body, opts) {
    const isFormData = typeof FormData !== "undefined" && body instanceof FormData;
    return this.request(url, {
      ...opts,
      method: "POST",
      body: isFormData ? body : JSON.stringify(body ?? {}),
    });
  },

  put(url, body, opts) {
    return this.request(url, {
      ...opts,
      method: "PUT",
      body: JSON.stringify(body ?? {}),
    });
  },

  delete(url, opts) {
    return this.request(url, { ...opts, method: "DELETE" });
  },
};
