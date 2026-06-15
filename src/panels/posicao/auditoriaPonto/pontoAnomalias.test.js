import test from "node:test";
import assert from "node:assert/strict";
import { analisarAnomaliasPonto } from "./pontoAnomalias.js";

function hasCode(result, code) {
  return result.anomalias.some((item) => item.code === code);
}

test("detecta marcacao impar", () => {
  const r = analisarAnomaliasPonto({
    horario: "08:00 12:00 13:00 17:00",
    marcacao: "08:01 12:00 13:00",
    horas: 480,
    evento: "HORAS NORMAIS",
  });
  assert.equal(r.codigo, "MARCACAO_IMPAR");
  assert.equal(r.severidade, "critica");
});

test("permite desativar regras por parametro", () => {
  const input = {
    horario: "08:00 12:00 13:00 17:00",
    marcacao: "08:01 12:00 13:00",
    horas: 480,
    evento: "HORAS NORMAIS",
  };
  const ativo = analisarAnomaliasPonto(input);
  const desativado = analisarAnomaliasPonto(input, { regrasDesativadas: ["MARCACAO_IMPAR"] });
  assert.equal(hasCode(ativo, "MARCACAO_IMPAR"), true);
  assert.equal(hasCode(desativado, "MARCACAO_IMPAR"), false);
  assert.deepEqual(desativado.parametrosSnapshot.regrasDesativadas, ["MARCACAO_IMPAR"]);
  assert.notEqual(ativo.hashRegrasAtivas, desativado.hashRegrasAtivas);
});

test("executa regra customizada da empresa", () => {
  const r = analisarAnomaliasPonto(
    {
      horario: "08:00 12:00 13:00 17:00",
      marcacao: "08:00 12:00 13:00 17:00",
      horas: 480,
      evento: "ACORDO LOCAL ESPECIAL",
    },
    {
      regrasCustomizadas: [
        {
          id: "CUSTOM_ACORDO",
          titulo: "Acordo local exige revisao",
          campo: "evento",
          operador: "contem",
          valor: "acordo local",
          severidade: "alta",
          mensagem: "Evento de acordo local deve ser revisado.",
        },
      ],
    },
  );
  assert.equal(hasCode(r, "CUSTOM_ACORDO"), true);
  assert.equal(r.severidade, "alta");
  assert.equal(r.parametrosSnapshot.regrasCustomizadas[0].id, "CUSTOM_ACORDO");
});

test("ignora evento parametrizado para nao auditar", () => {
  const r = analisarAnomaliasPonto({
    horario: "08:00 12:00 13:00 17:30",
    marcacao: "",
    horas: 510,
    evento: "NCP - NAO CONTROLA PONTO",
  });
  assert.equal(r.status, "ignorado");
  assert.equal(r.severidade, "ok");
  assert.equal(r.ignoradoAuditoria, true);
  assert.equal(hasCode(r, "EVENTO_SEM_MARCACAO"), false);
  assert.equal(r.parametrosSnapshot.eventosIgnoradosAuditoria[0].valor, "NAO CONTROLA PONTO");
});

test("trata regra customizada nao auditado como evento ignorado", () => {
  const r = analisarAnomaliasPonto(
    {
      data: "2026-05-17",
      horario: "18:00 23:00 00:10 06:10",
      marcacao: "",
      horas: 440,
      evento: "32 - FERIAS",
      isDomingoOuFeriado: true,
    },
    {
      regrasCustomizadas: [
        {
          id: "NAO_AUDITAR_FERIAS",
          titulo: "Nao auditado",
          campo: "evento",
          operador: "contem",
          valor: "FERIAS",
          severidade: "media",
          mensagem: "Nao auditado",
        },
      ],
    },
  );
  assert.equal(r.status, "ignorado");
  assert.equal(r.severidade, "ok");
  assert.equal(r.ignoradoAuditoria, true);
  assert.equal(hasCode(r, "NAO_AUDITAR_FERIAS"), false);
  assert.equal(hasCode(r, "DOMINGO_FERIADO_SEM_CLASSIFICACAO"), false);
});

test("ignora risco trabalhista tratado no radar", () => {
  const r = analisarAnomaliasPonto({
    horario: "08:00 12:00 13:00 17:00",
    marcacao: "",
    horas: 480,
    evento: "MAIS DE 6 HORAS SEM REFEICAO",
    _cat: "Risco Trabalhista",
  });
  assert.equal(r.status, "ignorado");
  assert.equal(r.severidade, "ok");
  assert.equal(r.ignoradoAuditoria, true);
  assert.equal(r.regraIgnoradaAuditoria, "RISCO_TRABALHISTA_RADAR");
  assert.equal(hasCode(r, "EVENTO_SEM_MARCACAO"), false);
});

test("detecta divergencia entre horas do evento e marcacoes", () => {
  const r = analisarAnomaliasPonto({
    horario: "08:00 12:00 13:00 17:00",
    marcacao: "08:00 12:00 13:00 16:00",
    horas: 480,
    evento: "HORAS NORMAIS",
  });
  assert.equal(r.codigo, "DIVERGENCIA_HORAS_EVENTO");
  assert.equal(r.severidade, "alta");
});

test("nao acusa ferias sem marcacao", () => {
  const r = analisarAnomaliasPonto({
    horario: "08:00 12:00 13:00 17:00",
    marcacao: "",
    horas: 440,
    evento: "32 - FERIAS",
  });
  assert.equal(r.status, "ok");
});

test("nao acusa falta nao justificada sem marcacao", () => {
  const r = analisarAnomaliasPonto({
    data: "2026-05-29",
    horario: "06:00 11:00 12:00 16:00",
    marcacao: "",
    horas: 540,
    evento: "25 - FALTA NAO JUSTIFICADA",
    _cat: "Ausentes",
  });
  assert.equal(r.status, "ok");
  assert.equal(hasCode(r, "EVENTO_SEM_MARCACAO"), false);
});

test("permite parametrizar evento sem marcacao por cliente", () => {
  const r = analisarAnomaliasPonto(
    {
      data: "2026-05-29",
      horario: "06:00 11:00 12:00 16:00",
      marcacao: "",
      horas: 540,
      evento: "AUSENCIA OPERACIONAL CLIENTE XPTO",
      _cat: "Ausentes",
    },
    {
      eventosSemMarcacaoOk: ["AUSENCIA OPERACIONAL CLIENTE XPTO"],
    },
  );
  assert.equal(r.status, "ok");
  assert.equal(hasCode(r, "EVENTO_SEM_MARCACAO"), false);
});

test("detecta ausencia integral com marcacoes", () => {
  const r = analisarAnomaliasPonto({
    horario: "08:00 12:00 13:00 17:00",
    marcacao: "08:03 12:00 13:00 17:02",
    horas: 440,
    evento: "32 - FERIAS",
  });
  assert.equal(r.codigo, "AUSENCIA_COM_MARCACAO");
  assert.equal(r.severidade, "critica");
  assert.equal(r.statusFechamento, "bloqueado");
  assert.equal(hasCode(r, "AUSENCIA_COM_MARCACAO"), true);
  assert.match(r.memoria.anomalias[0].memoria.join(" "), /ausencia integral/);
});

test("detecta intrajornada insuficiente", () => {
  const r = analisarAnomaliasPonto({
    horario: "08:00 12:00 13:00 17:00",
    marcacao: "08:00 12:00 12:20 17:00",
    horas: 520,
    evento: "HORAS NORMAIS",
  });
  assert.equal(r.codigo, "INTRAJORNADA_INSUFICIENTE");
  assert.equal(r.severidade, "critica");
});

test("detecta interjornada insuficiente", () => {
  const r = analisarAnomaliasPonto({
    data: "2026-06-02",
    horario: "06:00 11:00 12:00 15:00",
    marcacao: "06:00 11:00 12:00 15:00",
    horas: 480,
    evento: "HORAS NORMAIS",
    previousData: "2026-06-01",
    previousMarcacao: "14:00 18:00 19:00 23:30",
  });
  assert.equal(r.codigo, "INTERJORNADA_INSUFICIENTE");
  assert.equal(r.severidade, "critica");
});

test("detecta ponto britanico por repeticao de marcacoes", () => {
  const r = analisarAnomaliasPonto({
    data: "2026-06-02",
    horario: "06:00 11:00 12:00 16:00",
    marcacao: "06:00 11:00 12:00 16:00",
    horas: 540,
    evento: "HORAS NORMAIS",
    pontoBritanicoAssinatura: "06:00 11:00 12:00 16:00",
    pontoBritanicoRepeticoes: 5,
  });
  assert.equal(r.codigo, "PONTO_BRITANICO");
  assert.equal(r.severidade, "alta");
});

test("retorna metadados auditaveis do motor modular", () => {
  const r = analisarAnomaliasPonto({
    horario: "08:00 12:00 13:00 17:00",
    marcacao: "08:00 12:00 13:00 17:00",
    horas: 480,
    evento: "HORAS NORMAIS",
  });
  assert.equal(typeof r.versaoMotor, "string");
  assert.match(r.hashRegrasAtivas, /^fnv1a-/);
  assert.equal(r.statusJornada, "confiavel");
  assert.equal(r.parametrosSnapshot.toleranciaMinutos, 10);
});

test("detecta marcacao duplicada", () => {
  const r = analisarAnomaliasPonto({
    horario: "08:00 12:00 13:00 17:00",
    marcacao: "08:00 08:01 12:00 13:00 17:00",
    horas: 480,
    evento: "HORAS NORMAIS",
  });
  assert.equal(hasCode(r, "MARCACAO_DUPLICADA"), true);
});

test("detecta marcacao fora de ordem", () => {
  const r = analisarAnomaliasPonto({
    horario: "22:00 02:00 03:00 06:00",
    marcacao: "22:00 02:00 01:00 06:00",
    horas: 420,
    evento: "HORAS NORMAIS",
  });
  assert.equal(hasCode(r, "MARCACAO_FORA_DE_ORDEM"), true);
});

test("detecta marcacao deslocada de dia", () => {
  const r = analisarAnomaliasPonto({
    horario: "22:00 02:00 03:00 06:00",
    marcacao: "22:00 02:00 03:00 06:00",
    horas: 420,
    evento: "HORAS NORMAIS",
  });
  assert.equal(hasCode(r, "MARCACAO_DESLOCADA_DE_DIA"), true);
});

test("detecta marcacao excedente", () => {
  const r = analisarAnomaliasPonto({
    horario: "08:00 12:00",
    marcacao: "08:00 12:00 17:30",
    horas: 240,
    evento: "HORAS NORMAIS",
  });
  assert.equal(hasCode(r, "MARCACAO_EXCEDENTE"), true);
});

test("detecta pareamento ambiguo", () => {
  const r = analisarAnomaliasPonto(
    {
      horario: "08:00",
      marcacao: "07:55 08:05",
      horas: 0,
      evento: "HORAS NORMAIS",
    },
    { janelaPareamentoMaxMinutos: 10 },
  );
  assert.equal(hasCode(r, "PAREAMENTO_AMBIGUO"), true);
});

test("detecta adicional noturno nao classificado", () => {
  const r = analisarAnomaliasPonto({
    horario: "18:00 23:00",
    marcacao: "18:00 23:00",
    horas: 300,
    evento: "HORAS NORMAIS",
  });
  assert.equal(hasCode(r, "ADICIONAL_NOTURNO_NAO_CLASSIFICADO"), true);
});

test("detecta hora extra acima do limite", () => {
  const r = analisarAnomaliasPonto({
    horario: "18:00 21:00",
    marcacao: "18:00 21:00",
    horas: 180,
    evento: "HORAS EXTRAS 50%",
  });
  assert.equal(hasCode(r, "HORA_EXTRA_ACIMA_LIMITE"), true);
});

test("detecta extra sem marcacao", () => {
  const r = analisarAnomaliasPonto({
    horario: "",
    marcacao: "",
    horas: 60,
    evento: "HORAS EXTRAS 70%",
  });
  assert.equal(hasCode(r, "EXTRA_SEM_MARCACAO"), true);
});

test("detecta saida apos escala sem evento de extra", () => {
  const r = analisarAnomaliasPonto({
    horario: "08:00 12:00 13:00 17:00",
    marcacao: "08:00 12:00 13:00 18:20",
    horas: 560,
    evento: "HORAS NORMAIS",
  });
  assert.equal(r.codigo, "SAIDA_APOS_ESCALA_SEM_EXTRA");
  assert.equal(r.severidade, "alta");
  assert.equal(r.statusFechamento, "revisar");
  assert.equal(hasCode(r, "SAIDA_APOS_ESCALA_SEM_EXTRA"), true);
});

test("nao acusa saida apos escala quando evento ja e extra", () => {
  const r = analisarAnomaliasPonto({
    horario: "17:00 18:20",
    marcacao: "17:00 18:20",
    horas: 80,
    evento: "HORAS EXTRAS 50%",
  });
  assert.equal(hasCode(r, "SAIDA_APOS_ESCALA_SEM_EXTRA"), false);
});

test("detecta entrada antes da escala sem evento de extra", () => {
  const r = analisarAnomaliasPonto({
    horario: "08:00 12:00 13:00 17:00",
    marcacao: "07:20 12:00 13:00 17:00",
    horas: 520,
    evento: "HORAS NORMAIS",
  });
  assert.equal(hasCode(r, "ENTRADA_ANTES_ESCALA_SEM_EXTRA"), true);
  assert.equal(r.severidade, "media");
  assert.equal(r.statusFechamento, "revisar");
});

test("nao acusa entrada antes da escala quando evento ja e extra", () => {
  const r = analisarAnomaliasPonto({
    horario: "07:20 08:00",
    marcacao: "07:20 08:00",
    horas: 40,
    evento: "BANCO CREDITO 50%",
  });
  assert.equal(hasCode(r, "ENTRADA_ANTES_ESCALA_SEM_EXTRA"), false);
});

test("detecta banco de horas incompativel com diferenca apurada", () => {
  const r = analisarAnomaliasPonto({
    horario: "08:00 12:00 13:00 17:00",
    marcacao: "08:00 12:00 13:00 17:00",
    horas: 60,
    evento: "BC50 - BANCO CREDITO 50%",
  });
  assert.equal(hasCode(r, "BANCO_HORAS_INCOMPATIVEL"), true);
});

test("detecta domingo ou feriado sem classificacao especifica", () => {
  const r = analisarAnomaliasPonto({
    data: "2026-06-07",
    horario: "08:00 12:00 13:00 17:00",
    marcacao: "08:00 12:00 13:00 17:00",
    horas: 480,
    evento: "HORAS NORMAIS",
  });
  assert.equal(hasCode(r, "DOMINGO_FERIADO_SEM_CLASSIFICACAO"), true);
});

test("nao acusa domingo para evento de ausencia aceito", () => {
  const r = analisarAnomaliasPonto({
    data: "2026-05-17",
    horario: "07:00 11:00 12:00 16:00",
    marcacao: "",
    horas: 440,
    evento: "49M - AUXILIO ENFERMIDADE",
    _cat: "Justificadas",
  });
  assert.equal(hasCode(r, "DOMINGO_FERIADO_SEM_CLASSIFICACAO"), false);
  assert.equal(r.status, "ok");
});

test("detecta jornada sem intervalo registrado", () => {
  const r = analisarAnomaliasPonto({
    horario: "08:00 17:00",
    marcacao: "08:00 17:00",
    horas: 540,
    evento: "HORAS NORMAIS",
  });
  assert.equal(r.codigo, "JORNADA_SEM_INTERVALO");
  assert.equal(r.severidade, "critica");
});

test("detecta intervalo intrajornada atipicamente longo", () => {
  const r = analisarAnomaliasPonto({
    horario: "08:00 12:00 13:00 17:00",
    marcacao: "08:00 10:00 15:00 17:00",
    horas: 240,
    evento: "HORAS NORMAIS",
  });
  assert.equal(hasCode(r, "INTERVALO_ATIPICO_MARCACOES"), true);
});

test("detecta sequencia excessiva de dias sem folga", () => {
  const r = analisarAnomaliasPonto({
    horario: "08:00 12:00 13:00 17:00",
    marcacao: "08:00 12:00 13:00 17:00",
    horas: 480,
    evento: "HORAS NORMAIS",
    diasConsecutivosTrabalhados: 8,
  });
  assert.equal(hasCode(r, "SEQUENCIA_DIAS_SEM_FOLGA"), true);
});

test("detecta presenca sem jornada util", () => {
  const r = analisarAnomaliasPonto({
    horario: "",
    marcacao: "",
    horas: 0,
    evento: "HORAS NORMAIS",
  });
  assert.equal(hasCode(r, "PRESENCA_SEM_JORNADA_UTIL"), true);
});

test("detecta duplicidade de evento remunerado no mesmo dia", () => {
  const r = analisarAnomaliasPonto({
    horario: "",
    marcacao: "",
    horas: 0,
    evento: "FERIAS",
    eventosDia: [
      { evento: "32 - FERIAS" },
      { evento: "1 - HORAS NORMAIS" },
    ],
  });
  assert.equal(hasCode(r, "DUPLICIDADE_EVENTO_REMUNERADO"), true);
});

test("detecta sobreposicao de eventos no mesmo dia", () => {
  const r = analisarAnomaliasPonto({
    horario: "08:00 12:00",
    marcacao: "08:00 12:00",
    horas: 240,
    evento: "HORAS NORMAIS",
    eventosDia: [
      { evento: "HORAS NORMAIS", horario: "08:00 12:00" },
      { evento: "TREINAMENTO", horario: "10:00 14:00" },
    ],
  });
  assert.equal(hasCode(r, "SOBREPOSICAO_EVENTOS"), true);
});

test("detecta evento fora do periodo ativo do colaborador", () => {
  const r = analisarAnomaliasPonto({
    data: "2026-06-10",
    dataDemissao: "2026-06-01",
    horario: "08:00 12:00",
    marcacao: "08:00 12:00",
    horas: 240,
    evento: "HORAS NORMAIS",
  });
  assert.equal(r.codigo, "COLABORADOR_FORA_PERIODO_ATIVO");
  assert.equal(r.statusFechamento, "bloqueado");
});

test("detecta parametrizacao incompleta quando escopo exige CCT", () => {
  const r = analisarAnomaliasPonto({
    horario: "08:00 12:00",
    marcacao: "08:00 12:00",
    horas: 240,
    evento: "HORAS NORMAIS",
    requerCct: true,
  });
  assert.equal(hasCode(r, "PARAMETRIZACAO_INCOMPLETA"), true);
});

test("detecta saldo de banco de horas fora do limite", () => {
  const r = analisarAnomaliasPonto({
    horario: "08:00 12:00",
    marcacao: "08:00 12:00",
    horas: 240,
    evento: "HORAS NORMAIS",
    saldoBancoMinutosDepois: 2500,
  });
  assert.equal(hasCode(r, "BANCO_HORAS_SALDO_EXCEDIDO"), true);
});

test("detecta troca de turno sem descanso minimo", () => {
  const r = analisarAnomaliasPonto({
    horario: "06:00 14:00",
    marcacao: "06:00 14:00",
    horas: 480,
    evento: "HORAS NORMAIS",
    turnoAnterior: "noite",
    turno: "manha",
    descansoEntreTurnosMinutos: 420,
  });
  assert.equal(hasCode(r, "TROCA_TURNO_SEM_DESCANSO"), true);
});

test("detecta feriado local sem classificacao", () => {
  const r = analisarAnomaliasPonto({
    data: "2026-06-10",
    horario: "08:00 12:00",
    marcacao: "08:00 12:00",
    horas: 240,
    evento: "HORAS NORMAIS",
    feriadoNome: "Aniversario da cidade",
    feriadoTipo: "municipal",
  });
  assert.equal(hasCode(r, "FERIADO_LOCAL_SEM_CLASSIFICACAO"), true);
});

test("detecta prorrogacao noturna nao classificada", () => {
  const r = analisarAnomaliasPonto({
    horario: "22:00 06:00",
    marcacao: "22:00 06:00",
    horas: 480,
    evento: "HORAS NORMAIS",
  });
  assert.equal(hasCode(r, "PRORROGACAO_NOTURNA_NAO_CLASSIFICADA"), true);
});

test("detecta risco recorrente no periodo", () => {
  const r = analisarAnomaliasPonto({
    horario: "08:00 12:00",
    marcacao: "08:00 12:00",
    horas: 240,
    evento: "HORAS NORMAIS",
    recorrenciaRegraDias: 4,
  });
  assert.equal(hasCode(r, "RISCO_RECORRENTE"), true);
});

test("detecta fechamento com pendencia critica", () => {
  const r = analisarAnomaliasPonto({
    horario: "08:00 12:00",
    marcacao: "08:00 12:00",
    horas: 240,
    evento: "HORAS NORMAIS",
    fechamentoSolicitado: true,
    criticasPendentes: 2,
  });
  assert.equal(hasCode(r, "FECHAMENTO_COM_PENDENCIA_CRITICA"), true);
});

test("detecta evidencia obrigatoria ausente", () => {
  const r = analisarAnomaliasPonto({
    horario: "",
    marcacao: "",
    horas: 240,
    evento: "ATESTADO MEDICO",
  });
  assert.equal(hasCode(r, "EVIDENCIA_OBRIGATORIA_AUSENTE"), true);
});

test("detecta minutos residuais excedidos", () => {
  const r = analisarAnomaliasPonto(
    {
      horario: "08:00 12:00",
      marcacao: "08:07 12:00",
      horas: 233,
      evento: "HORAS NORMAIS",
    },
    { toleranciaMinutos: 10, minutosResiduaisMinutos: 5 },
  );
  assert.equal(hasCode(r, "MINUTOS_RESIDUAIS_EXCEDIDOS"), true);
});

test("detecta tratamento manual recorrente", () => {
  const r = analisarAnomaliasPonto({
    horario: "08:00 12:00",
    marcacao: "08:00 12:00",
    horas: 240,
    evento: "HORAS NORMAIS",
    tratamentoManualRecorrente: 3,
  });
  assert.equal(hasCode(r, "TRATAMENTO_MANUAL_RECORRENTE"), true);
});

test("detecta marcacao sem escala", () => {
  const r = analisarAnomaliasPonto({
    horario: "",
    marcacao: "08:00 12:00",
    horas: 240,
    evento: "HORAS NORMAIS",
  });
  assert.equal(hasCode(r, "MARCACAO_SEM_ESCALA"), true);
});

test("detecta jornada incoerente", () => {
  const r = analisarAnomaliasPonto({
    horario: "08:00 12:00 13:00",
    marcacao: "08:00 12:00 13:00",
    horas: 240,
    evento: "HORAS NORMAIS",
  });
  assert.equal(hasCode(r, "JORNADA_INCOERENTE"), true);
});

test("nao aplica regras de trabalho em auxilio enfermidade no domingo", () => {
  const r = analisarAnomaliasPonto({
    data: "2026-05-17",
    diaSemana: "dom",
    horario: "07:00 11:00 12:00 16:00",
    marcacao: "",
    horas: 440,
    evento: "49M - AUXILIO ENFERMIDADE",
    categoria: "Justificadas",
    diasConsecutivosTrabalhados: 9,
  });
  assert.equal(r.status, "ok");
  assert.equal(hasCode(r, "DOMINGO_FERIADO_SEM_CLASSIFICACAO"), false);
  assert.equal(hasCode(r, "EVENTO_SEM_MARCACAO"), false);
  assert.equal(hasCode(r, "SEQUENCIA_DIAS_SEM_FOLGA"), false);
});

test("nao aplica divergencia e desvios em evento de ausencia parametrizado", () => {
  const r = analisarAnomaliasPonto({
    data: "2026-05-29",
    horario: "06:00 11:00 12:00 16:00",
    marcacao: "05:12 11:00 12:00 18:21",
    horas: 540,
    evento: "25 - FALTA NAO JUSTIFICADA",
    _cat: "Ausentes",
  });
  assert.equal(hasCode(r, "AUSENCIA_COM_MARCACAO"), true);
  assert.equal(hasCode(r, "DIVERGENCIA_HORAS_EVENTO"), false);
  assert.equal(hasCode(r, "DESVIO_PLANEJADO"), false);
  assert.equal(hasCode(r, "SAIDA_APOS_ESCALA_SEM_EXTRA"), false);
  assert.equal(hasCode(r, "ENTRADA_ANTES_ESCALA_SEM_EXTRA"), false);
});

test("usa categoria do evento para evitar falso positivo de trabalho", () => {
  const r = analisarAnomaliasPonto({
    data: "2026-05-14",
    diaSemana: "qui",
    horario: "18:00 23:00 00:10 06:10",
    marcacao: "18:00 23:00 00:10 06:10",
    horas: 440,
    evento: "32 - FERIAS",
    categoria: "Justificadas",
    pontoBritanicoAssinatura: "18:00 23:00 00:10 06:10",
    pontoBritanicoRepeticoes: 9,
  });
  assert.equal(hasCode(r, "AUSENCIA_COM_MARCACAO"), true);
  assert.equal(hasCode(r, "PONTO_BRITANICO"), false);
  assert.equal(hasCode(r, "ADICIONAL_NOTURNO_NAO_CLASSIFICADO"), false);
  assert.equal(hasCode(r, "PRORROGACAO_NOTURNA_NAO_CLASSIFICADA"), false);
});
