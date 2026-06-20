import { CONFIG } from "../configLocal.js";

export const ApiSources = Object.freeze({
  API: "api",
  MOCK: "mock",
  IMPORT: "importacao",
});

function normalizeSource(source) {
  const value = String(source || "").trim().toLowerCase();
  if (["api", "remote", "remoto"].includes(value)) return ApiSources.API;
  if (["mock", "mocks"].includes(value)) return ApiSources.MOCK;
  if (["import", "importacao", "importaÃ§Ã£o", "local"].includes(value)) return ApiSources.IMPORT;
  return null;
}

export function getApiSource(moduleName) {
  const moduleSource = moduleName ? CONFIG.MODULE_SOURCES?.[moduleName] : null;
  const source = normalizeSource(moduleSource) || normalizeSource(CONFIG.API_SOURCE);
  if (source) return source;
  return CONFIG.USE_MOCK ? ApiSources.MOCK : ApiSources.API;
}

export function isMockSource(moduleName) {
  return getApiSource(moduleName) === ApiSources.MOCK;
}


