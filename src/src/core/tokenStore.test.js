import assert from "node:assert/strict";
import { afterEach, beforeEach, describe, it } from "node:test";

import { TokenStore } from "./tokenStore.js";

function createLocalStorageMock() {
  const values = new Map();
  return {
    getItem: (key) => (values.has(key) ? values.get(key) : null),
    setItem: (key, value) => values.set(key, String(value)),
    removeItem: (key) => values.delete(key),
    clear: () => values.clear(),
  };
}

describe("TokenStore", () => {
  beforeEach(() => {
    globalThis.window = { localStorage: createLocalStorageMock() };
  });

  afterEach(() => {
    TokenStore.clear();
    delete globalThis.window;
  });

  it("persiste tokens e perfil", () => {
    TokenStore.setTokens({
      accessToken: "token",
      refreshToken: "refresh",
      expiresIn: 3600,
    });
    TokenStore.setUserInfo({
      id: "1",
      username: "ana",
      name: "Ana Silva",
      cliente: "Macchips",
    });

    assert.equal(TokenStore.getAccessToken(), "token");
    assert.equal(TokenStore.getRefreshToken(), "refresh");
    assert.equal(typeof TokenStore.getExpiresAt(), "string");
    assert.deepEqual(TokenStore.getUserInfo(), {
      id: "1",
      username: "ana",
      name: "Ana Silva",
      cliente: "Macchips",
    });
  });

  it("limpa tokens e perfil juntos", () => {
    TokenStore.setTokens({
      accessToken: "token",
      refreshToken: "refresh",
      expiresIn: 3600,
    });
    TokenStore.setUserInfo({
      id: "1",
      username: "ana",
      name: "Ana Silva",
      cliente: "Macchips",
    });

    TokenStore.clear();

    assert.equal(TokenStore.getAccessToken(), null);
    assert.equal(TokenStore.getRefreshToken(), null);
    assert.equal(TokenStore.getExpiresAt(), null);
    assert.equal(TokenStore.getUserInfo(), null);
  });
});
