import { z } from "zod";
import { ApiService } from "./apiService.js";
import { ApiRoutes } from "./apiRoutes.js";

const CctDocumentoSchema = z
  .object({
    id: z.string(),
    fileName: z.string(),
    label: z.string().optional(),
    status: z.string().optional(),
  })
  .passthrough();

export const CctApi = {
  getDocumentos() {
    return ApiService.call(ApiRoutes.cct.documentos, {}, {
      module: "cct",
      schema: z.object({ documentos: z.array(CctDocumentoSchema) }).passthrough(),
      label: "CCT - documentos",
    });
  },

  saveDocumentos(documentos = []) {
    return ApiService.callPost(
      ApiRoutes.cct.documentos,
      { documentos: Array.isArray(documentos) ? documentos : [] },
      {
        module: "cct",
        schema: z.object({ documentos: z.array(CctDocumentoSchema) }).passthrough().optional().or(z.object({ ok: z.boolean() }).passthrough()),
        label: "CCT - salvar indice",
      },
    );
  },
};
