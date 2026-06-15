import axios from 'axios';

export const api = axios.create({
  baseURL: 'http://localhost:5000',
  headers: { Accept: 'application/json' },
});

/**
 * @typedef {Object} KPIImpacto
 * @property {number} totalFuncionarios
 * @property {number} afetadosPEC
 * @property {number} naoAfetados
 * @property {number} percentualAfetados
 * @property {number} impactoFinanceiroMensalFase1
 * @property {number} impactoFinanceiroMensalFase2
 * @property {number} headcountNecessarioFase1
 * @property {number} headcountNecessarioFase2
 * @property {Array} porDepartamento
 */

/**
 * @param {File} file
 * @returns {Promise<KPIImpacto>}
 */
export async function postImportarExcel(file) {
  const form = new FormData();
  form.append('arquivo', file);
  const { data } = await api.post('/api/impacto/importar', form, {
    headers: { 'Content-Type': 'multipart/form-data' },
  });
  return data;
}

/**
 * @param {string} baseUrl
 * @returns {Promise<KPIImpacto>}
 */
export async function getFromApiPonto(baseUrl) {
  const { data } = await api.get('/api/impacto/from-api', {
    params: { baseUrl },
  });
  return data;
}

/** Baixa o modelo .xlsx no navegador */
export async function getTemplate() {
  const { data } = await api.get('/api/impacto/template', {
    responseType: 'blob',
  });
  const url = URL.createObjectURL(data);
  const link = document.createElement('a');
  link.href = url;
  link.download = 'impacto-seis-x1-template.xlsx';
  link.click();
  URL.revokeObjectURL(url);
}
