function unsupported(route) {
  throw new Error(`Fonte de importacao local ainda nao possui adapter remoto para a rota: ${route}`);
}

export const ImportedDataAdapter = {
  async get(route) {
    unsupported(route);
  },

  async post(route) {
    unsupported(route);
  },

  async put(route) {
    unsupported(route);
  },
};
