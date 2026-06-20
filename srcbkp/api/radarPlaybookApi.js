import { z } from "zod";
import { ApiService } from "./apiService.js";
import { ApiRoutes } from "./apiRoutes.js";

const PlaybookNotasSchema = z
  .object({
    eventKey: z.string(),
    juridico: z.string().optional(),
    rh: z.string().optional(),
    clausulaCct: z.string().optional(),
    updatedAt: z.string().nullable().optional(),
    updatedBy: z.string().nullable().optional(),
  })
  .passthrough();

export const RadarPlaybookApi = {
  getNotas(eventKey) {
    return ApiService.call(ApiRoutes.radarPlaybook.notas, { eventKey }, {
      module: "radarPlaybook",
      schema: PlaybookNotasSchema,
      label: "Radar Playbook - notas",
    });
  },

  saveNota({ eventKey, area, text, author, eventTitle } = {}) {
    return ApiService.callPost(
      ApiRoutes.radarPlaybook.notas,
      { eventKey, area, text, author, eventTitle },
      {
        module: "radarPlaybook",
        schema: PlaybookNotasSchema.optional().or(z.object({ ok: z.boolean() }).passthrough()),
        label: "Radar Playbook - salvar nota",
      },
    );
  },

  getAuditoria({ eventKey, limit = 40 } = {}) {
    return ApiService.call(ApiRoutes.radarPlaybook.auditoria, { eventKey, limit }, {
      module: "radarPlaybook",
      schema: z.object({ items: z.array(z.object({ id: z.string() }).passthrough()) }).passthrough(),
      label: "Radar Playbook - auditoria",
    });
  },
};
