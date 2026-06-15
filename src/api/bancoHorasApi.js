import { z } from "zod";
import { ApiService } from "./apiService.js";
import {
  BancoHorasColaboradorSchema,
  BancoHorasDepartamentoSchema,
  BancoHorasResumoSchema,
  PageRequestSchema,
} from "./contracts.js";

const BancoHorasDepartamentoListSchema = z.array(BancoHorasDepartamentoSchema);

const BancoHorasColaboradorPageSchema = z.object({
  items: z.array(BancoHorasColaboradorSchema),
  total: z.number().int().nonnegative(),
  page: z.number().int().min(1).optional(),
  pageSize: z.number().int().min(1).optional(),
});

function periodParams(periodo = {}) {
  return {
    de: periodo.de,
    ate: periodo.ate,
  };
}

export const BancoHorasApi = {
  getResumo(periodo = {}) {
    return ApiService.call("/banco-horas/resumo", periodParams(periodo), {
      module: "bancoHoras",
      schema: BancoHorasResumoSchema.passthrough(),
      label: "Banco de Horas - resumo",
    });
  },

  getDepartamentos({ de, ate, top = 10 } = {}) {
    return ApiService.call("/banco-horas/departamentos", { de, ate, top }, {
      module: "bancoHoras",
      schema: BancoHorasDepartamentoListSchema,
      label: "Banco de Horas - departamentos",
    });
  },

  getColaboradores({ de, ate, departamento, ...pageRequest } = {}) {
    const page = PageRequestSchema.parse(pageRequest);
    return ApiService.call(
      "/banco-horas/colaboradores",
      { de, ate, departamento, ...page },
      {
        module: "bancoHoras",
        schema: BancoHorasColaboradorPageSchema,
        label: "Banco de Horas - colaboradores",
      },
    );
  },
};

