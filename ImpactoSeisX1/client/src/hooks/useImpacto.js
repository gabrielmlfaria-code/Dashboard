import { useCallback, useState } from 'react';
import { getFromApiPonto, postImportarExcel } from '../services/api.js';

function mensagemErroPortugues(erro) {
  if (!erro.response) {
    if (erro.code === 'ERR_NETWORK' || erro.message === 'Network Error') {
      return 'Falha de rede: não foi possível conectar à API em http://localhost:5000. Verifique se o backend está em execução.';
    }
    return 'Erro de rede. Verifique sua conexão e tente novamente.';
  }

  const corpo = erro.response.data;
  if (typeof corpo === 'string' && corpo.trim()) return corpo;
  if (corpo?.erro) return corpo.erro;
  if (erro.response.status === 400) return 'Requisição inválida. Verifique os dados enviados.';
  if (erro.response.status >= 500) return 'Erro no servidor. Tente novamente em instantes.';

  return erro.message || 'Ocorreu um erro inesperado.';
}

export function useImpacto() {
  const [dados, setDados] = useState(null);
  const [loading, setLoading] = useState(false);
  const [erro, setErro] = useState(null);

  const importarExcel = useCallback(async (file) => {
    setLoading(true);
    setErro(null);
    try {
      const resultado = await postImportarExcel(file);
      setDados(resultado);
      return resultado;
    } catch (e) {
      const msg = mensagemErroPortugues(e);
      setErro(msg);
      setDados(null);
      throw e;
    } finally {
      setLoading(false);
    }
  }, []);

  const carregarDaApi = useCallback(async (baseUrl) => {
    setLoading(true);
    setErro(null);
    try {
      const resultado = await getFromApiPonto(baseUrl);
      setDados(resultado);
      return resultado;
    } catch (e) {
      const msg = mensagemErroPortugues(e);
      setErro(msg);
      setDados(null);
      throw e;
    } finally {
      setLoading(false);
    }
  }, []);

  const resetar = useCallback(() => {
    setDados(null);
    setErro(null);
    setLoading(false);
  }, []);

  return {
    dados,
    loading,
    erro,
    importarExcel,
    carregarDaApi,
    resetar,
  };
}
