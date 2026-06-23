export const TODAY_POSITION_QUESTIONS = [
  {
    id: "operacao_normal",
    label: "O dia está normal agora?",
    category: "operacao",
    intent: "CURRENT_OPERATION_STATUS",
    priority: "high",
  },
  {
    id: "primeiro_foco",
    label: "O que atacar primeiro?",
    category: "acao",
    intent: "FIRST_ACTION",
    priority: "high",
  },
  {
    id: "cobertura_deficit",
    label: "Onde falta cobertura?",
    category: "quadro",
    intent: "COVERAGE_GAP",
    priority: "high",
  },
  {
    id: "departamento_impacto",
    label: "Qual departamento está mais crítico?",
    category: "departamento",
    intent: "TOP_DEPARTMENT_IMPACT",
    priority: "high",
  },
  {
    id: "ausentes_hoje",
    label: "Quem está ausente hoje?",
    category: "ausencias",
    intent: "TODAY_ABSENT_EMPLOYEES",
    priority: "medium",
  },
  {
    id: "atrasados_hoje",
    label: "Quem está atrasado agora?",
    category: "atrasos",
    intent: "TODAY_DELAYED_EMPLOYEES",
    priority: "medium",
  },
  {
    id: "retorno_ferias",
    label: "Quem retorna de férias?",
    category: "ferias",
    intent: "VACATION_RETURNS",
    priority: "medium",
  },
  {
    id: "faltas_impacto",
    label: "Onde estão as faltas?",
    category: "ausencias",
    intent: "ABSENCES_BY_DEPARTMENT",
    priority: "medium",
  },
  {
    id: "atrasos_impacto",
    label: "Onde estão os atrasos?",
    category: "atrasos",
    intent: "DELAYS_BY_DEPARTMENT",
    priority: "medium",
  },
];

export default TODAY_POSITION_QUESTIONS;
