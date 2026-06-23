import { ApiService } from "./apiService.js";
import { ApiRoutes } from "./apiRoutes.js";

function pickParams(obj) {
  const out = {};
  for (const [key, value] of Object.entries(obj || {})) {
    if (value != null && value !== "") out[key] = value;
  }
  return out;
}

export const TurnoverApi = {
  getResumo({ de, ate, competenciaInicial, competenciaFinal, filialId } = {}) {
    return ApiService.call(
      ApiRoutes.turnover.resumo,
      pickParams({ de, ate, competenciaInicial, competenciaFinal, filialId }),
      { module: "turnover" },
    );
  },
};
