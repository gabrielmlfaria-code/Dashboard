import { analyzeOperationalStatus } from "./operationStatusEngine.js";

function fmtPct(value) {
  if (value == null || !Number.isFinite(Number(value))) return "sem percentual";
  return `${Number(value).toFixed(1).replace(".", ",")}%`;
}

function safeText(value) {
  return String(value ?? "").trim();
}

function deptEvidence(dept) {
  if (!dept) return null;
  return `${dept.nome}: ${dept.deficitCobertura} déficit, ${dept.ausentes} ausência(s), ${dept.atrasados} atraso(s).`;
}

function departmentAction(dept, category = "presentes", label = "Abrir colaboradores") {
  if (!dept?.nome) return null;
  return {
    label,
    action: "OPEN_DEPARTMENT",
    payload: { departamento: dept.nome, category },
  };
}

function compactActions(actions) {
  return actions.filter(Boolean).slice(0, 3);
}

function normalizeAnswer(intent, answer) {
  const evidence = (answer.evidence || answer.evidences || []).filter(Boolean);
  const titleByIntent = {
    CURRENT_OPERATION_STATUS: "Situação operacional agora",
    FIRST_ACTION: "Primeira ação recomendada",
    TOP_DEPARTMENT_IMPACT: "Departamento com maior impacto",
    ABSENCES_BY_DEPARTMENT: "Faltas por departamento",
    DELAYS_BY_DEPARTMENT: "Atrasos por departamento",
    COVERAGE_GAP: "Déficit de cobertura",
    TODAY_ABSENT_EMPLOYEES: "Ausentes hoje",
    TODAY_DELAYED_EMPLOYEES: "Atrasados agora",
    VACATION_RETURNS: "Retorno de férias",
  };

  return {
    id: intent,
    title: answer.title || titleByIntent[intent] || "Resposta",
    summary: answer.summary || answer.interpretation || "",
    evidence,
    evidences: evidence,
    interpretation: answer.interpretation || "",
    recommendedActions: answer.recommendedActions || [],
    actions: answer.actions || [],
    limitations: answer.limitations || [],
  };
}

function parseDate(value) {
  if (!value) return null;
  if (value instanceof Date && Number.isFinite(value.getTime())) {
    return new Date(value.getFullYear(), value.getMonth(), value.getDate());
  }

  const text = safeText(value);
  if (!text) return null;

  const iso = text.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (iso) return new Date(Number(iso[1]), Number(iso[2]) - 1, Number(iso[3]));

  const br = text.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2,4})$/);
  if (br) {
    const year = Number(br[3].length === 2 ? `20${br[3]}` : br[3]);
    return new Date(year, Number(br[2]) - 1, Number(br[1]));
  }

  const parsed = new Date(text);
  if (Number.isFinite(parsed.getTime())) {
    return new Date(parsed.getFullYear(), parsed.getMonth(), parsed.getDate());
  }
  return null;
}

function addDays(date, days) {
  if (!date) return null;
  const copy = new Date(date);
  copy.setDate(copy.getDate() + days);
  return copy;
}

function sameDay(a, b) {
  return (
    a &&
    b &&
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

function fmtDate(date) {
  if (!date) return "";
  return new Intl.DateTimeFormat("pt-BR").format(date);
}

function rowName(row) {
  return (
    safeText(row?.nome) ||
    safeText(row?.colaborador) ||
    safeText(row?.colaboradorNome) ||
    safeText(row?.name) ||
    safeText(row?.matricula) ||
    "Colaborador sem nome"
  );
}

function rowDept(row) {
  return safeText(row?.departamento) || safeText(row?.depto) || safeText(row?.departamentoNome) || "Sem departamento";
}

function rowDateEnd(row) {
  return (
    row?.termino ||
    row?.fim ||
    row?.dataFim ||
    row?.data_fim ||
    row?.feriasFim ||
    row?.afastamentoFim ||
    row?.dtFim
  );
}

function listRows(rows, limit = 6) {
  return (Array.isArray(rows) ? rows : [])
    .slice(0, limit)
    .map((row) => `${rowName(row)} — ${rowDept(row)}.`);
}

function answerCurrentStatus(analysis) {
  const op = analysis.operationStatus || {};
  const top = analysis.affectedDepartments?.[0];
  return {
    summary: `Status atual: ${op.label || "sem leitura"}.`,
    evidence: [
      `Cobertura: ${fmtPct(op.coveragePct)}.`,
      `Força atual: ${op.forcaAtual}.`,
      `Força prevista: ${op.forcaPrevista || "não informada"}.`,
    ],
    interpretation: analysis.diagnosis,
    recommendedActions: [analysis.recommendedFirstAction?.label].filter(Boolean),
    actions: compactActions([
      top &&
        departmentAction(
          top,
          analysis.recommendedFirstAction?.payload?.category || "presentes",
          "Abrir foco do dia",
        ),
      { label: "Ver presentes", action: "OPEN_EMPLOYEES", payload: { category: "presentes" } },
    ]),
    limitations: analysis.limitations || [],
  };
}

function answerTopDepartment(analysis) {
  const top = analysis.affectedDepartments?.[0];
  if (!top) {
    return {
      summary: "Nenhum departamento aparece como foco crítico neste momento.",
      evidence: [],
      interpretation: "Sem concentração relevante a partir dos dados atuais.",
      recommendedActions: [analysis.recommendedFirstAction?.label].filter(Boolean),
      limitations: analysis.limitations || [],
    };
  }
  return {
    summary: `Departamento com maior impacto: ${top.nome}.`,
    evidence: analysis.affectedDepartments.map(deptEvidence).filter(Boolean),
    interpretation: "A priorização considera ausência, atraso e déficit de cobertura.",
    recommendedActions: [analysis.recommendedFirstAction?.label].filter(Boolean),
    actions: compactActions([
      departmentAction(top, "presentes", "Abrir departamento"),
      top.ausentes > 0 && departmentAction(top, "faltas", "Ver faltas"),
      top.atrasados > 0 && departmentAction(top, "atrasos", "Ver atrasos"),
    ]),
    limitations: analysis.limitations || [],
  };
}

function answerFirstAction(analysis) {
  return {
    summary: analysis.recommendedFirstAction?.label || "Manter acompanhamento do dia.",
    evidence: analysis.reasons || [],
    interpretation:
      "A primeira ação é escolhida pelo maior peso operacional entre déficit, ausências e atrasos.",
    recommendedActions: [analysis.recommendedFirstAction?.label].filter(Boolean),
    actions: compactActions([
      analysis.recommendedFirstAction && {
        label: "Executar ação",
        action: analysis.recommendedFirstAction.action,
        payload: analysis.recommendedFirstAction.payload,
      },
    ]),
    limitations: analysis.limitations || [],
  };
}

function answerAbsences(analysis) {
  const withAbsences = (analysis.affectedDepartments || []).filter((dept) => dept.ausentes > 0);
  return {
    summary: withAbsences[0]
      ? `Faltas mais concentradas em ${withAbsences[0].nome}.`
      : "Não há concentração de faltas no ranking atual.",
    evidence: withAbsences.map(deptEvidence).filter(Boolean),
    interpretation: "A resposta considera somente ausências operacionais; sem controle não entra como falta.",
    recommendedActions: withAbsences[0] ? [`Validar ausências em ${withAbsences[0].nome}.`] : [],
    actions: compactActions([
      withAbsences[0] && departmentAction(withAbsences[0], "faltas", "Abrir faltas"),
      withAbsences[1] && departmentAction(withAbsences[1], "faltas", `Abrir ${withAbsences[1].nome}`),
    ]),
    limitations: analysis.limitations || [],
  };
}

function answerDelays(analysis) {
  const withDelays = (analysis.affectedDepartments || []).filter((dept) => dept.atrasados > 0);
  return {
    summary: withDelays[0]
      ? `Atrasos mais concentrados em ${withDelays[0].nome}.`
      : "Não há concentração de atrasos no ranking atual.",
    evidence: withDelays.map(deptEvidence).filter(Boolean),
    interpretation: "A resposta considera atrasos como sinal de execução do dia, não como ausência.",
    recommendedActions: withDelays[0] ? [`Ver atrasos em ${withDelays[0].nome}.`] : [],
    actions: compactActions([
      withDelays[0] && departmentAction(withDelays[0], "atrasos", "Abrir atrasos"),
      withDelays[1] && departmentAction(withDelays[1], "atrasos", `Abrir ${withDelays[1].nome}`),
    ]),
    limitations: analysis.limitations || [],
  };
}

function answerCoverageGap(analysis) {
  const withGap = (analysis.affectedDepartments || []).filter((dept) => dept.deficitCobertura > 0);
  return {
    summary: withGap[0]
      ? `Maior déficit de cobertura em ${withGap[0].nome}.`
      : "Não há déficit de cobertura identificado.",
    evidence: withGap.map(deptEvidence).filter(Boolean),
    interpretation: "Déficit é calculado por força prevista menos força atual.",
    recommendedActions: withGap[0] ? [`Revisar cobertura em ${withGap[0].nome}.`] : [],
    actions: compactActions([
      withGap[0] && departmentAction(withGap[0], "presentes", "Abrir cobertura"),
      withGap[1] && departmentAction(withGap[1], "presentes", `Abrir ${withGap[1].nome}`),
    ]),
    limitations: analysis.limitations || [],
  };
}

function answerTodayAbsents(data, analysis) {
  const rows = Array.isArray(data?.faltasRows) ? data.faltasRows : [];
  const evidence = rows.length ? listRows(rows) : answerAbsences(analysis).evidence;
  return {
    summary: rows.length ? `${rows.length} colaborador(es) ausente(s) na posição do dia.` : "Não encontrei lista nominal de ausentes para este recorte.",
    evidence,
    interpretation: rows.length
      ? "A lista vem das ocorrências classificadas como faltas/ausências na posição do dia."
      : "Ainda assim, o ranking por departamento indica onde investigar as ausências.",
    actions: compactActions([{ label: "Abrir ausentes", action: "OPEN_EMPLOYEES", payload: { category: "faltas" } }]),
    limitations: rows.length ? [] : ["A posição do dia não trouxe linhas nominais de ausências para o diagnóstico."],
  };
}

function answerTodayDelayed(data, analysis) {
  const rows = Array.isArray(data?.atrasosRows) ? data.atrasosRows : [];
  const evidence = rows.length ? listRows(rows) : answerDelays(analysis).evidence;
  return {
    summary: rows.length ? `${rows.length} colaborador(es) com atraso na posição do dia.` : "Não encontrei lista nominal de atrasados para este recorte.",
    evidence,
    interpretation: rows.length
      ? "A lista vem das ocorrências classificadas como atraso na posição do dia."
      : "O ranking por departamento continua útil para localizar o foco.",
    actions: compactActions([{ label: "Abrir atrasos", action: "OPEN_EMPLOYEES", payload: { category: "atrasos" } }]),
    limitations: rows.length ? [] : ["A posição do dia não trouxe linhas nominais de atrasos para o diagnóstico."],
  };
}

function answerVacationReturns(data) {
  const rows = Array.isArray(data?.feriasRows) ? data.feriasRows : [];
  const referenceDate = parseDate(data?.dataRef);
  const withReturn = rows
    .map((row) => {
      const endDate = parseDate(rowDateEnd(row));
      return {
        row,
        endDate,
        returnDate: endDate ? addDays(endDate, 1) : null,
      };
    })
    .filter(({ endDate, returnDate }) => {
      if (!referenceDate) return Boolean(endDate);
      return sameDay(returnDate, referenceDate) || sameDay(endDate, referenceDate);
    });

  const evidence = withReturn.slice(0, 8).map(({ row, endDate, returnDate }) => {
    const dateLabel = returnDate ? fmtDate(returnDate) : fmtDate(endDate);
    return `${rowName(row)} — ${rowDept(row)} — retorno previsto: ${dateLabel || "sem data"}.`;
  });

  return {
    summary: evidence.length
      ? `${withReturn.length} colaborador(es) com retorno de férias no recorte atual.`
      : "Não encontrei retorno de férias para a posição do dia.",
    evidence,
    interpretation:
      "O retorno é estimado pela data fim das férias: quando há data fim, o sistema considera o dia seguinte como retorno previsto.",
    actions: compactActions([{ label: "Abrir férias", action: "OPEN_EMPLOYEES", payload: { category: "ferias" } }]),
    limitations: rows.length
      ? []
      : ["A posição do dia não trouxe linhas nominais de férias com data de início/fim para o diagnóstico."],
  };
}

export function answerTodayQuestion(questionOrIntent, data = {}, precomputed = null) {
  const intent = typeof questionOrIntent === "string" ? questionOrIntent : questionOrIntent?.intent;
  const resolvedIntent = intent || "CURRENT_OPERATION_STATUS";
  const analysis = precomputed || analyzeOperationalStatus(data);

  let answer;
  switch (resolvedIntent) {
    case "CURRENT_OPERATION_STATUS":
      answer = answerCurrentStatus(analysis);
      break;
    case "FIRST_ACTION":
      answer = answerFirstAction(analysis);
      break;
    case "TOP_DEPARTMENT_IMPACT":
      answer = answerTopDepartment(analysis);
      break;
    case "ABSENCES_BY_DEPARTMENT":
      answer = answerAbsences(analysis);
      break;
    case "DELAYS_BY_DEPARTMENT":
      answer = answerDelays(analysis);
      break;
    case "COVERAGE_GAP":
      answer = answerCoverageGap(analysis);
      break;
    case "TODAY_ABSENT_EMPLOYEES":
      answer = answerTodayAbsents(data, analysis);
      break;
    case "TODAY_DELAYED_EMPLOYEES":
      answer = answerTodayDelayed(data, analysis);
      break;
    case "VACATION_RETURNS":
      answer = answerVacationReturns(data);
      break;
    default:
      answer = answerCurrentStatus(analysis);
      break;
  }

  return normalizeAnswer(resolvedIntent, answer);
}

export default answerTodayQuestion;
