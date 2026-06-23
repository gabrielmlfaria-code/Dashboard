import { describe, expect, it } from "vitest";
import {
  mapApiConfigToUi,
  validateEventCategoriesPayload,
  apiEventoToUi,
  uiEventoToApi,
} from "./eventoCategoriaHoraAdapters.js";

describe("eventoCategoriaHoraAdapters", () => {
  it("mapApiConfigToUi preserva eventos da tabela com idEvento", () => {
    const mapped = mapApiConfigToUi({
      colunas: [{ value: "presentes", label: "Presentes", color: "#0f0" }],
      eventos: [{ idRegistro: 1, idEvento: 10, name: "Hora Normal", category: "presentes" }],
    });
    expect(mapped.eventos).toHaveLength(1);
    expect(mapped.eventos[0].idEvento).toBe(10);
    expect(mapped.eventos[0].id).toBe("evt_10");
  });

  it("validateEventCategoriesPayload rejeita categoria inexistente", () => {
    const result = validateEventCategoriesPayload(
      [{ value: "presentes", label: "Presentes" }],
      [{ idEvento: 1, name: "Falta", category: "ausentes" }],
    );
    expect(result.ok).toBe(false);
  });

  it("validateEventCategoriesPayload rejeita evento sem idEvento", () => {
    const result = validateEventCategoriesPayload(
      [{ value: "extras", label: "Extras" }],
      [{ name: "BH", category: "extras" }],
    );
    expect(result.ok).toBe(false);
  });

  it("apiEventoToUi e uiEventoToApi preservam flags BH", () => {
    const ui = apiEventoToUi({
      idRegistro: 2,
      idEvento: 1,
      name: "Banco de horas crédito",
      category: "extras",
      creditoBH: true,
      debitoBH: false,
    });
    const api = uiEventoToApi(ui);
    expect(api.creditoBH).toBe(true);
    expect(api.debitoBH).toBe(false);
    expect(api.idEvento).toBe(1);
  });
});
