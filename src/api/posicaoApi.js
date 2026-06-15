import { ApiService } from "./apiService.js";
import { PosicaoDiaResumoSchema } from "./contracts.js";

export const PosicaoApi = {
  getDia(date) {
    return ApiService.call("/posicao/dia", date ? { date } : {}, {
      module: "posicao",
      schema: PosicaoDiaResumoSchema.passthrough(),
      label: "Posição do dia",
    });
  },

  getHistorico(days = 180) {
    return ApiService.call("/posicao/historico", { days }, { module: "posicao" });
  },
};

