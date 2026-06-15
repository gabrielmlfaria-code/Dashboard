import { ApiService } from "./apiService.js";
import { ApiRoutes } from "./apiRoutes.js";

function pickParams(obj) {
  const out = {};
  for (const [key, value] of Object.entries(obj || {})) {
    if (value != null && value !== "") out[key] = value;
  }
  return out;
}

export const FechamentoMensalApi = {
  getEventos({ de, ate, competencia } = {}) {
    return ApiService.call(
      ApiRoutes.fechamentoMensal.eventos,
      pickParams({ de, ate, competencia }),
      { module: "mensal" },
    );
  },
};
