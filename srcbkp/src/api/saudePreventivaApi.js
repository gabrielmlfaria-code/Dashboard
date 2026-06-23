import { z } from "zod";
import { ApiService } from "./apiService.js";
import { ApiRoutes } from "./apiRoutes.js";

const SaudeRegistroSchema = z.object({ id: z.union([z.string(), z.number()]) }).passthrough();
const SaudeRegistrosPayloadSchema = z
  .object({
    registros: z.array(SaudeRegistroSchema),
    updatedAt: z.string().optional(),
  })
  .passthrough();

export const SaudePreventivaApi = {
  getRegistros() {
    return ApiService.call(ApiRoutes.saudePreventiva.registros, {}, {
      module: "saudePreventiva",
      schema: SaudeRegistrosPayloadSchema,
      label: "Saude Preventiva - registros",
    });
  },

  saveRegistros(registros = []) {
    return ApiService.callPost(
      ApiRoutes.saudePreventiva.registros,
      { registros: Array.isArray(registros) ? registros : [] },
      {
        module: "saudePreventiva",
        schema: SaudeRegistrosPayloadSchema.optional().or(z.object({ ok: z.boolean() }).passthrough()),
        label: "Saude Preventiva - salvar registros",
      },
    );
  },
};
