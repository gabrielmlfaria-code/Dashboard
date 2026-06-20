import { z } from "zod";
import { ApiService } from "./apiService.js";
import { ApiRoutes } from "./apiRoutes.js";

const Nr1EstadoSchema = z
  .object({
    registros: z.array(z.object({ id: z.union([z.string(), z.number()]) }).passthrough()).default([]),
    checkState: z.record(z.boolean()).default({}),
    checklistMeta: z.record(z.unknown()).default({}),
    cardsProg: z.record(z.unknown()).default({}),
    updatedAt: z.string().optional(),
  })
  .passthrough();

export const Nr1Api = {
  getEstado() {
    return ApiService.call(ApiRoutes.nr1.estado, {}, {
      module: "nr1",
      schema: Nr1EstadoSchema,
      label: "NR-1 - estado",
    });
  },

  saveEstado({ registros = [], checkState = {}, checklistMeta = {}, cardsProg = {} } = {}) {
    return ApiService.callPost(
      ApiRoutes.nr1.estado,
      { registros, checkState, checklistMeta, cardsProg },
      {
        module: "nr1",
        schema: Nr1EstadoSchema.optional().or(z.object({ ok: z.boolean() }).passthrough()),
        label: "NR-1 - salvar estado",
      },
    );
  },
};
