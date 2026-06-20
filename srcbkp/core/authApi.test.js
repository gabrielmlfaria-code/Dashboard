import assert from "node:assert/strict";
import { afterEach, describe, it } from "node:test";

import { AuthApi } from "./authApi.js";

function jsonResponse(payload, init = {}) {
  return new Response(JSON.stringify(payload), {
    status: 200,
    headers: { "content-type": "application/json" },
    ...init,
  });
}

describe("AuthApi ASP.NET contract", () => {
  const originalFetch = globalThis.fetch;

  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  it("envia login com username, password e clienteId", async () => {
    const calls = [];
    globalThis.fetch = async (url, opts) => {
      calls.push({ url, opts });
      return jsonResponse({ accessToken: "a", refreshToken: "r", expiresIn: 3600 });
    };

    await AuthApi.login({ username: "ana", password: "123", clienteId: 1 });

    assert.equal(calls[0].url, "/api/auth/login");
    assert.equal(calls[0].opts.method, "POST");
    assert.deepEqual(JSON.parse(calls[0].opts.body), {
      username: "ana",
      password: "123",
      clienteId: 1,
    });
  });

  it("envia refresh e exchange no contrato novo", async () => {
    const bodies = [];
    globalThis.fetch = async (_url, opts) => {
      bodies.push(JSON.parse(opts.body));
      return jsonResponse({ accessToken: "a", refreshToken: "r", expiresIn: 3600 });
    };

    await AuthApi.refresh("refresh-token");
    await AuthApi.exchange("exchange-token");

    assert.deepEqual(bodies, [{ refreshToken: "refresh-token" }, { token: "exchange-token" }]);
  });

  it("carrega /auth/me com Authorization Bearer", async () => {
    const calls = [];
    globalThis.fetch = async (url, opts) => {
      calls.push({ url, opts });
      return jsonResponse({
        id: "1",
        username: "ana",
        name: "Ana Silva",
        cliente: "Macchips",
      });
    };

    await AuthApi.me("access-token");

    assert.equal(calls[0].url, "/api/auth/me");
    assert.equal(calls[0].opts.method, "GET");
    assert.equal(calls[0].opts.headers.Authorization, "Bearer access-token");
  });
});
