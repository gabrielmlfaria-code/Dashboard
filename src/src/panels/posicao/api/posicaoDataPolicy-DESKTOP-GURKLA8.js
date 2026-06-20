import { CONFIG } from "../../../config.js";
import { ApiSources, getApiSource } from "../../../api/apiMode.js";

const FALSE_VALUES = new Set(["0", "false", "no", "nao", "não", "off", "disabled"]);
const TRUE_VALUES = new Set(["1", "true", "yes", "sim", "on", "enabled"]);

function readEnv(name, fallback = undefined) {
  return import.meta?.env?.[name] ?? fallback;
}

export function normalizeBooleanFlag(value, fallback = true) {
  if (value == null || value === "") return fallback;
  const normalized = String(value).trim().toLowerCase();
  if (FALSE_VALUES.has(normalized)) return false;
  if (TRUE_VALUES.has(normalized)) return true;
  return fallback;
}

export function getPosicaoDataPolicy() {
  const source = getApiSource("posicao");
  const importsEnabled = normalizeBooleanFlag(readEnv("VITE_ENABLE_IMPORTS"), CONFIG.ENABLE_IMPORTS);
  const apiBaseUrl = readEnv("VITE_API_BASE_URL", CONFIG.API_BASE || "/api");

  return Object.freeze({
    module: "posicao",
    source,
    apiBaseUrl,
    importsEnabled,
    isApi: source === ApiSources.API,
    isMock: source === ApiSources.MOCK,
    isImportacao: source === ApiSources.IMPORT,
    shouldShowManualImports: importsEnabled && source !== ApiSources.API,
  });
}

export function areManualImportsEnabled() {
  return getPosicaoDataPolicy().shouldShowManualImports;
}
