import { ApiService } from "./apiService.js";
import { PosicaoDiaResumoSchema } from "./contracts.js";

export const PosicaoApi = {
  getFiliais() {
    return ApiService.call("/posicao/filiais", {}, { module: "posicao" });
  },

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

  getForcaPrevistaDepartamentos({ idFilial, date, idSelecao = 0 } = {}) {
    return ApiService.call(
      "/posicao/forca-prevista/departamentos",
      { idFilial, date, idSelecao },
      { module: "posicao" },
    );
  },

  salvarForcaPrevista({ idFilial, itens }) {
    return ApiService.callPost(
      "/posicao/forca-prevista/salvar",
      { idFilial, itens },
      { module: "posicao" },
    );
  },

  excluirForcaPrevistaDepto(idDepartamento) {
    return ApiService.callPost(
      `/posicao/forca-prevista/excluir/${idDepartamento}`,
      {},
      { module: "posicao" },
    );
  },

  limparForcaPrevista(idFilial) {
    return ApiService.callPost(
      `/posicao/forca-prevista/limpar?idFilial=${encodeURIComponent(idFilial ?? 0)}`,
      {},
      { module: "posicao" },
    );
  },

  getCategoriasHorasConfig({ idFilial } = {}) {
    const filialId = Number(idFilial);
    const params = Number.isFinite(filialId) && filialId > 0 ? { idFilial: filialId } : {};
    return ApiService.call("/posicao/categorias-horas", params, { module: "posicao" });
  },

  salvarCategoriasHoras({ idFilial, eventos }) {
    const filialId = Number(idFilial);
    const body = {
      eventos,
      ...(Number.isFinite(filialId) && filialId > 0 ? { idFilial: filialId } : {}),
    };
    return ApiService.callPost(
      "/posicao/categorias-horas/salvar",
      body,
      { module: "posicao" },
    );
  },
};
