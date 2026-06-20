export function createMockApiAdapter({ getMockHandler, validatePayload }) {
  function runMock(route, payload, options = {}) {
    const handler = getMockHandler(route);
    if (!handler) {
      return Promise.reject(new Error(`Mock não registrado para rota: ${route}`));
    }

    return new Promise((resolve, reject) => {
      setTimeout(() => {
        try {
          Promise.resolve(handler(payload))
            .then((response) =>
              options?.validateMock ? validatePayload(response, options, route) : response,
            )
            .then(resolve)
            .catch(reject);
        } catch (error) {
          reject(error);
        }
      }, 120);
    });
  }

  return {
    get(route, params, options) {
      return runMock(route, params, options);
    },

    post(route, body, options) {
      return runMock(`${route}:POST`, body, options);
    },

    put(route, body, options) {
      return runMock(`${route}:PUT`, body, options);
    },
  };
}
