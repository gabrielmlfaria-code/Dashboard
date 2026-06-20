import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { canAny, decodeJwtPayload, hasPermission, normalizeAuthz } from "./permissions.js";

function jwtWithPayload(payload) {
  const encoded = Buffer.from(JSON.stringify(payload), "utf8")
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
  return `header.${encoded}.signature`;
}

describe("permissions", () => {
  it("normaliza permissoes e roles vindas do payload de login", () => {
    const authz = normalizeAuthz({
      data: {
        user: { perfil: "RH" },
        permissions: ["card.absenteismo.view", { permission: "import.turnover" }],
        roles: "RH_GESTOR ADMIN",
        scope: "card.radar.view",
      },
    });

    assert.equal(authz.profile, "RH");
    assert.deepEqual(authz.roles, ["RH_GESTOR", "ADMIN"]);
    assert.deepEqual(authz.permissions, ["card.absenteismo.view", "import.turnover"]);
    assert.deepEqual(authz.scopes, ["card.radar.view"]);
  });

  it("le claims de um JWT sem exigir que o backend duplique campos no corpo", () => {
    const token = jwtWithPayload({
      permissoes: ["card.turnover.view"],
      role: "GESTOR",
      scope: "import.mensal import.abonos",
    });

    assert.equal(decodeJwtPayload(token).role, "GESTOR");

    const authz = normalizeAuthz({}, token);
    assert.deepEqual(authz.permissions, ["card.turnover.view"]);
    assert.deepEqual(authz.roles, ["GESTOR"]);
    assert.deepEqual(authz.scopes, ["import.mensal", "import.abonos"]);
  });

  it("aceita wildcard total e por prefixo", () => {
    assert.equal(hasPermission({ permissions: ["*"] }, "card.mensal.view"), true);
    assert.equal(hasPermission({ permissions: ["card.*"] }, "card.bancoHoras.view"), true);
    assert.equal(hasPermission({ permissions: ["card.*"] }, "import.turnover"), false);
  });

  it("nega quando nao ha permissao e fallback mock esta desligado", () => {
    assert.equal(
      hasPermission({ permissions: [] }, "card.absenteismo.view", { allowMockFallback: false }),
      false,
    );
    assert.equal(
      canAny({ permissions: ["import.turnover"] }, ["import.mensal", "import.turnover"]),
      true,
    );
  });
});
