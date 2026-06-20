import { CONFIG } from "../configLocal.js";

export const PERMISSIONS = Object.freeze({
  cards: Object.freeze({
    absenteismo: "card.absenteismo.view",
    radar: "card.radar.view",
    turnover: "card.turnover.view",
    abonos: "card.abonos.view",
    bancoHoras: "card.bancoHoras.view",
    mensal: "card.mensal.view",
    saudePreventiva: "card.saudePreventiva.view",
    nr1: "card.nr1.view",
    assistant: "assistant.dashboard.view",
  }),
  imports: Object.freeze({
    xlsx: "import.posicao.xlsx",
    eventos: "import.posicao.eventos",
    tabela: "import.posicao.tabela",
    bancoHoras: "import.bancoHoras",
    abonos: "import.abonos",
    mensal: "import.mensal",
    turnover: "import.turnover",
    backup: "import.backup",
    cct: "import.cct",
  }),
  config: Object.freeze({
    importacoes: "config.importacoes.view",
    metas: "config.metas.edit",
    horas: "config.horas.edit",
    forcaPrevista: "config.forcaPrevista.edit",
  }),
});

export const DEFAULT_MOCK_AUTHZ = Object.freeze({
  profile: "dev-admin",
  roles: Object.freeze(["DEV_ADMIN"]),
  permissions: Object.freeze(["*"]),
  scopes: Object.freeze([]),
});

function safeJsonParse(value) {
  if (typeof value !== "string") return value;
  const trimmed = value.trim();
  if (!trimmed) return null;
  try {
    return JSON.parse(trimmed);
  } catch {
    return trimmed;
  }
}

function base64UrlDecode(input) {
  if (typeof atob !== "function") return null;
  const normalized = String(input || "").replace(/-/g, "+").replace(/_/g, "/");
  const padded = normalized.padEnd(normalized.length + ((4 - (normalized.length % 4)) % 4), "=");
  try {
    const binary = atob(padded);
    const bytes = Uint8Array.from(binary, (char) => char.charCodeAt(0));
    return new TextDecoder().decode(bytes);
  } catch {
    return null;
  }
}

export function decodeJwtPayload(token) {
  const parts = String(token || "").split(".");
  if (parts.length < 2) return {};
  const decoded = base64UrlDecode(parts[1]);
  const parsed = safeJsonParse(decoded);
  return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed : {};
}

function normalizeList(value) {
  const parsed = safeJsonParse(value);
  const values = Array.isArray(parsed)
    ? parsed
    : typeof parsed === "string"
      ? parsed.split(/[,\s]+/)
      : parsed && typeof parsed === "object"
        ? Object.keys(parsed).filter((key) => parsed[key])
        : [];

  return Array.from(
    new Set(
      values
        .flatMap((item) => normalizeListItem(item))
        .map((item) => String(item || "").trim())
        .filter(Boolean),
    ),
  );
}

function normalizeListItem(item) {
  if (Array.isArray(item)) return item.flatMap((entry) => normalizeListItem(entry));
  if (item && typeof item === "object") {
    return [
      item.permission,
      item.permissao,
      item.claim,
      item.name,
      item.nome,
      item.role,
      item.perfil,
      item.value,
    ].filter(Boolean);
  }
  if (typeof item === "string") return item.split(/[,\s]+/);
  return [item];
}

function firstString(...values) {
  return values.find((value) => typeof value === "string" && value.trim())?.trim() || null;
}

function extractSource(payload = {}) {
  if (!payload || typeof payload !== "object") return {};
  const data = payload.data && typeof payload.data === "object" ? payload.data : payload;
  const user = data.user && typeof data.user === "object" ? data.user : {};
  const claims = data.claims && typeof data.claims === "object" ? data.claims : {};
  return { data, user, claims };
}

export function normalizeAuthz(payload = {}, token = null) {
  const { data, user, claims } = extractSource(payload);
  const jwt = decodeJwtPayload(token || data.accessToken);

  const permissions = normalizeList([
    data.permissions,
    data.permissoes,
    data.permissoesAcesso,
    data.claims?.permissions,
    data.claims?.permissoes,
    user.permissions,
    user.permissoes,
    claims.permissions,
    claims.permissoes,
    jwt.permissions,
    jwt.permissoes,
    jwt.permission,
  ]);

  const roles = normalizeList([
    data.roles,
    data.role,
    data.perfis,
    user.roles,
    user.role,
    user.perfis,
    claims.roles,
    claims.role,
    jwt.roles,
    jwt.role,
    jwt["http://schemas.microsoft.com/ws/2008/06/identity/claims/role"],
  ]);

  const scopes = normalizeList([
    data.scopes,
    data.scope,
    claims.scopes,
    claims.scope,
    jwt.scopes,
    jwt.scope,
  ]);
  const profile = firstString(
    data.profile,
    data.perfil,
    user.profile,
    user.perfil,
    claims.profile,
    claims.perfil,
    jwt.profile,
    jwt.perfil,
    roles[0],
  );

  return { profile, roles, permissions, scopes };
}

function matchPermission(granted, required) {
  if (granted === "*" || granted === required) return true;
  if (!granted.endsWith(".*")) return false;
  return required.startsWith(granted.slice(0, -1));
}

export function hasPermission(authz, requiredPermission, { allowMockFallback = CONFIG.USE_MOCK } = {}) {
  if (!requiredPermission) return true;

  const permissions = normalizeList(authz?.permissions);
  const scopes = normalizeList(authz?.scopes);
  const grants = [...permissions, ...scopes];

  if (!grants.length && allowMockFallback) return true;
  return grants.some((grant) => matchPermission(grant, requiredPermission));
}

export function canAny(authz, permissions, options) {
  const list = Array.isArray(permissions) ? permissions : [permissions];
  return list.some((permission) => hasPermission(authz, permission, options));
}

