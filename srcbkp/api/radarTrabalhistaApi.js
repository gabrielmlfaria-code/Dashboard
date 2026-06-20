import { ApiService } from "./apiService.js";
import { ApiRoutes } from "./apiRoutes.js";

function pickParams(obj) {
  const out = {};
  for (const [key, value] of Object.entries(obj || {})) {
    if (value != null && value !== "") out[key] = value;
  }
  return out;
}

export const RadarTrabalhistaApi = {
  getResumo({ de, ate, filialId, deptoId } = {}) {
    return ApiService.call(
      ApiRoutes.radarTrabalhista.resumo,
      pickParams({ de, ate, filialId, deptoId }),
      { module: "radar" },
    );
  },
};
