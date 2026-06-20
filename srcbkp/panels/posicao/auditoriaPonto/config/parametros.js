export const DEFAULT_AUDITORIA_PONTO_PARAMS = {
  toleranciaMinutos: 10,
  toleranciaDuplicidadeMinutos: 2,
  janelaPareamentoMaxMinutos: 180,
  intervaloIntrajornadaMinutos: 60,
  jornadaIntrajornadaMinutos: 6 * 60,
  intervaloInterjornadaMinutos: 11 * 60,
  pontoBritanicoDias: 5,
  minutosResiduaisMinutos: 10,
  limiteHoraExtraDiariaMinutos: 2 * 60,
  intervaloIntrajornadaMaxMinutos: 3 * 60,
  diasConsecutivosLimite: 6,
  limiteBancoHorasPositivoMinutos: 40 * 60,
  limiteBancoHorasNegativoMinutos: 20 * 60,
  recorrenciaRiscoLimite: 3,
};

export const DEFAULT_AUDITORIA_PONTO_EVENTOS_SEM_MARCACAO_OK = [
  "ferias",
  "atestado",
  "auxilio enfermidade",
  "licenca",
  "afastamento",
  "declaracao",
  "falta abonada",
  "falta nao justificada",
  "falta injustificada",
];

export const DEFAULT_AUDITORIA_PONTO_EVENTOS_JORNADA_PRINCIPAL = [
  "horas normais",
  "jornada normal",
  "trabalho normal",
  "presente",
];
