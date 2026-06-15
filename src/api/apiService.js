import { ApiSources, getApiSource } from "./apiMode.js";
import { ImportedDataAdapter } from "./adapters/importedDataAdapter.js";
import { createMockApiAdapter } from "./adapters/mockApiAdapter.js";
import { RemoteApiAdapter } from "./adapters/remoteApiAdapter.js";
import { parseApiPayload } from "./apiValidators.js";

function validatePayload(payload, options, route) {
  return options?.schema
    ? parseApiPayload(options.schema, payload, options.label || route)
    : payload;
}

export const ApiService = {
  _mocks: {},

  registerMock(route, handler) {
    this._mocks[route] = handler;
  },

  hasMock(route) {
    return typeof this._mocks[route] === "function";
  },

  getAdapter(options = {}) {
    const source = getApiSource(options.module);

    if (source === ApiSources.MOCK) {
      return createMockApiAdapter({
        getMockHandler: (route) => this._mocks[route],
        validatePayload,
      });
    }

    if (source === ApiSources.IMPORT) return ImportedDataAdapter;
    return RemoteApiAdapter;
  },

  call(route, params, options = {}) {
    return this.getAdapter(options).get(route, params, options).then((payload) =>
      validatePayload(payload, options, route),
    );
  },

  callPost(route, body, options = {}) {
    return this.getAdapter(options)
      .post(route, body, options)
      .then((payload) => validatePayload(payload, options, route));
  },

  callPut(route, body, options = {}) {
    return this.getAdapter(options)
      .put(route, body, options)
      .then((payload) => validatePayload(payload, options, route));
  },
};
