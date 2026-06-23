import { ApiService } from "./apiService.js";
import { ApiSources, getApiSource } from "./apiMode.js";
import { ApiRoutes } from "./apiRoutes.js";
import { PosicaoDiaResumoSchema } from "./contracts.js";

export const PosicaoApi = {
  getDia(date) {
    const source = getApiSource("posicao");
    return ApiService.call(ApiRoutes.posicao.dia, date ? { date } : {}, {
      module: "posicao",
      schema: source === ApiSources.API ? PosicaoDiaResumoSchema.passthrough() : undefined,
      label: "Posição do dia",
    });
  },

  getHistorico(days = 180) {
    return ApiService.call(ApiRoutes.posicao.historico, { days }, { module: "posicao" });
  },
};
