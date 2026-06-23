import { STAT_DAY_TOOLTIPS } from "../../panels/posicao/radarKpiTooltips.js";

/**
 * Conteúdo do auto-treinamento do painel "Posição do Dia agora".
 * Mantido separado da UI para facilitar edição sem mexer no código das telas.
 */

/** Passos do tour guiado (spotlight). `selector` aponta para o elemento real na tela. */
export const POSICAO_TOUR_STEPS = [
  {
    id: "intro",
    selector: ".pb-side-panel-posicao",
    title: "Posição do Dia agora",
    body: "Este é o coração do painel: um retrato em tempo real de quem está presente, ausente, atrasado e o que estava planejado para hoje.",
    why: "É a primeira tela que você abre no dia a dia para saber, em segundos, como está a operação agora.",
    placement: "right",
  },
  {
    id: "donut",
    selector: ".pb-donut",
    title: "Presença do dia",
    body: "O círculo mostra a proporção de presentes sobre a força esperada. No centro: presentes/total e o percentual de presença.",
    why: "Leitura instantânea da cobertura do dia, sem precisar somar nada na mão.",
    placement: "right",
  },
  {
    id: "data",
    selector: ".pb-donut-date-input",
    title: "Data da posição",
    body: "Esta data é apenas informativa e vem dos dados carregados pela API. Ela indica a referência usada para a posição exibida.",
    why: "Evita alteração manual indevida e garante que todos estejam analisando a mesma data oficial retornada pelo sistema.",
    placement: "bottom",
  },
  {
    id: "atualizar",
    selector: ".pb-btn-atualizar",
    title: "Dados ao vivo",
    body: "O ponto ao lado de \"Última atualização\" pisca enquanto busca dados. Use o botão ↻ para forçar uma atualização imediata.",
    why: "Garante que você está olhando o número mais recente antes de tomar uma decisão.",
    placement: "bottom",
  },
  {
    id: "indicadores",
    selector: ".pb-stat-grid",
    title: "Os 6 indicadores do dia",
    body: "Presentes, Faltas, Atrasos, Já saiu, Entrada prevista e Sem controle. Cada quadro é clicável e abre a lista de colaboradores daquele grupo.",
    why: "Você sai do número agregado para o nome de quem precisa de ação — sem exportar planilha.",
    placement: "right",
  },
  {
    id: "quadro",
    selector: ".pb-side-panel-quadro",
    title: "Quadro",
    body: "Mostra a Força atual, a Força prevista e as Vagas. É o bloco que indica se o quadro do dia está completo ou com déficit.",
    why: "Ajuda a separar problema de cobertura de problema de presença: às vezes há presença boa, mas quadro previsto insuficiente.",
    placement: "right",
  },
  {
    id: "planejadas",
    selector: ".pb-side-panel-planejadas",
    title: "Planejadas",
    body: "Resume ocorrências já previstas para o dia, como folgas, férias e afastados. As linhas clicáveis abrem os colaboradores daquele grupo.",
    why: "Evita tratar como problema algo que já estava planejado na escala ou na rotina de RH.",
    placement: "right",
  },
  {
    id: "diagnostico-operacional",
    selector: ".pb-side-panel-operacional",
    title: "Diagnóstico operacional",
    body: "Faz uma leitura automática da posição do dia e destaca prioridade, cobertura, departamentos em atenção e perguntas rápidas.",
    why: "Transforma números soltos em uma recomendação de ação para o gestor decidir o próximo passo.",
    placement: "right",
  },
  {
    id: "departamentos-agora",
    selector: ".pb-side-panel-dept",
    title: "Por departamento agora",
    body: "Lista os departamentos com ausentes ou presentes, permitindo alternar a visão e ordenar do maior para o menor ou o inverso.",
    why: "Mostra onde o problema está concentrado, facilitando agir primeiro no departamento mais crítico.",
    placement: "right",
  },
  {
    id: "saude-preventiva",
    selector: ".pb-side-panel-saude",
    title: "Saúde preventiva",
    body: "Atalho para o módulo de campanhas de saúde e conformidade CLT relacionado à Lei nº 15.377/2026.",
    why: "Conecta a leitura operacional do dia com obrigações preventivas e gestão de saúde ocupacional.",
    placement: "right",
  },
  {
    id: "nr1",
    selector: ".pb-side-panel-nr1",
    title: "NR-1",
    body: "Atalho para a gestão de conformidade NR-1, GRO/PGR e riscos psicossociais.",
    why: "Ajuda a conectar sinais operacionais recorrentes com possíveis riscos de SST e governança trabalhista.",
    placement: "right",
  },
  {
    id: "apuracao",
    selector: ".pb-apuracao-info",
    title: "Período de apuração",
    body: "Mostra o intervalo (de/até) que está sendo considerado nos cálculos do período, vindo da própria API.",
    why: "Todo número de tendência respeita esse período — é a sua referência de tempo.",
    placement: "bottom",
  },
  {
    id: "periodo",
    selector: ".pb-trend-band--topbar",
    title: "Trocar o período de análise",
    body: "Alterne entre Período atual, 7d, 15d, 30d ou escolha um intervalo personalizado em \"Outros períodos\".",
    why: "Compare o dia de hoje com a tendência recente para identificar padrões.",
    placement: "bottom",
  },
  {
    id: "filial",
    selector: 'select[aria-label="Filtrar por filial"]',
    title: "Filtrar por filial",
    body: "Selecione uma filial para focar a análise só naquela unidade. \"Todas as filiais\" volta à visão completa.",
    why: "Cada gestor enxerga rapidamente apenas a operação sob sua responsabilidade.",
    placement: "bottom",
  },
  {
    id: "forca-prevista",
    selector: '[aria-label="Força Prevista por Departamento"]',
    title: "Força Prevista",
    body: "Cadastre quantas pessoas são esperadas por departamento. O painel usa esse número para calcular vagas e cobertura.",
    why: "Sem a meta cadastrada, o sistema não sabe se a presença de hoje é suficiente.",
    placement: "bottom",
  },
  {
    id: "calculadora",
    selector: '[aria-label="Calculadora de Horas"]',
    title: "Calculadora de Horas",
    body: "Ferramenta de apoio para somar/converter horas rapidamente sem sair do painel.",
    why: "Evita abrir a calculadora do sistema operacional no meio de uma conferência.",
    placement: "bottom",
  },
  {
    id: "config",
    selector: '[aria-label="Abrir Configurações"]',
    title: "Configurações",
    body: "Aqui você define metas, categorias de horas e importações. É onde o painel é calibrado para a sua empresa.",
    why: "A qualidade dos indicadores depende dessas configurações estarem corretas.",
    placement: "bottom",
  },
];

/**
 * Tour específico do card "Posição do Dia agora".
 * Para alterar o texto exibido no tour desse card, edite os passos acima
 * com estes ids: intro, donut, data, atualizar, indicadores, quadro,
 * planejadas, diagnostico-operacional, departamentos-agora, saude-preventiva e nr1.
 */
const POSICAO_DIA_AGORA_STEP_IDS = new Set([
  "intro",
  "donut",
  "data",
  "atualizar",
  "indicadores",
  "quadro",
  "planejadas",
  "diagnostico-operacional",
  "departamentos-agora",
  "saude-preventiva",
  "nr1",
]);

export const POSICAO_DIA_AGORA_TOUR_STEPS = POSICAO_TOUR_STEPS.filter((step) =>
  POSICAO_DIA_AGORA_STEP_IDS.has(step.id),
);

/** Glossário de termos do painel. Reaproveita as definições já usadas nos tooltips. */
export const POSICAO_GLOSSARY = [
  { term: "Presentes", def: STAT_DAY_TOOLTIPS.presentes },
  { term: "Faltas", def: STAT_DAY_TOOLTIPS.falta },
  { term: "Atrasos", def: STAT_DAY_TOOLTIPS.atraso },
  { term: "Já saiu", def: STAT_DAY_TOOLTIPS.ja_saiu },
  { term: "Entrada prevista", def: STAT_DAY_TOOLTIPS.entrada_prev },
  { term: "Sem controle", def: STAT_DAY_TOOLTIPS.nao_controla },
  {
    term: "Força atual",
    def: "Número de colaboradores ativos considerados na posição do dia.",
  },
  {
    term: "Força prevista",
    def: "Quantidade de pessoas esperada por departamento, cadastrada em Força Prevista. Base para calcular vagas e cobertura.",
  },
  {
    term: "Vagas",
    def: "Diferença entre a força prevista e a força atual. Zero (✓) significa quadro completo.",
  },
  {
    term: "Folgas",
    def: "Colaboradores com folga planejada no dia.",
  },
  {
    term: "Férias",
    def: "Colaboradores em período de férias no dia.",
  },
  {
    term: "Afastados",
    def: "Colaboradores afastados (licença, atestado prolongado etc.) no dia.",
  },
  {
    term: "Período de apuração",
    def: "Intervalo de datas (de/até) retornado pela API que define a janela de cálculo dos indicadores.",
  },
  {
    term: "Banco de Horas",
    def: "Saldo de horas (positivo ou negativo) acumulado pelo colaborador em relação à jornada contratada.",
  },
  {
    term: "Abono",
    def: "Justificativa que neutraliza uma ausência ou atraso (ex.: atestado, declaração), retirando-o do cálculo de falta injustificada.",
  },
  {
    term: "Absenteísmo",
    def: "Percentual de horas ausentes sobre as horas planejadas no período: (horas ausentes ÷ horas planejadas) × 100.",
  },
];

/**
 * Checklist "Comece por aqui". `event`, quando presente, dispara um CustomEvent
 * para acionar uma ação do painel (ex.: abrir o tour).
 */
export const POSICAO_CHECKLIST = [
  {
    id: "tour",
    label: "Fazer o tour guiado",
    hint: "Conheça cada elemento da tela em ~1 minuto.",
    event: "posicao:open-tour",
  },
  {
    id: "data",
    label: "Conferir a data da posição",
    hint: "Garanta que está olhando o dia certo.",
  },
  {
    id: "periodo",
    label: "Trocar o período (7d / 15d / 30d)",
    hint: "Veja a tendência além do dia de hoje.",
  },
  {
    id: "filial",
    label: "Filtrar por uma filial",
    hint: "Foque na unidade sob sua responsabilidade.",
  },
  {
    id: "indicador",
    label: "Abrir um indicador do dia",
    hint: "Clique em Presentes ou Faltas para ver os nomes.",
  },
  {
    id: "forca-prevista",
    label: "Cadastrar a Força Prevista",
    hint: "É o que habilita o cálculo de vagas e cobertura.",
  },
  {
    id: "glossario",
    label: "Dar uma olhada no glossário",
    hint: "Entenda cada termo do painel.",
    event: "posicao:open-glossary",
  },
];

export const ONBOARDING_STORAGE_KEY = "mp_posicao_onboarding_v1";
