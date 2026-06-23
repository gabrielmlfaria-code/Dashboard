export const OPERATION_STATUS = {
  NORMAL: "NORMAL",
  ATENCAO: "ATENCAO",
  COMPROMETIDA: "COMPROMETIDA",
  CRITICA: "CRITICA",
};

export const DEFAULT_OPERATION_THRESHOLDS = {
  normal: 95,
  atencao: 90,
  comprometida: 80,
};

const STATUS_LABELS = {
  [OPERATION_STATUS.NORMAL]: "Normal",
  [OPERATION_STATUS.ATENCAO]: "Atenção",
  [OPERATION_STATUS.COMPROMETIDA]: "Comprometida",
  [OPERATION_STATUS.CRITICA]: "Crítica",
};

const STATUS_TONES = {
  [OPERATION_STATUS.NORMAL]: "success",
  [OPERATION_STATUS.ATENCAO]: "warning",
  [OPERATION_STATUS.COMPROMETIDA]: "danger",
  [OPERATION_STATUS.CRITICA]: "danger",
};

function num(value) {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
}

function cleanText(value, fallback = "Não informado") {
  const text = String(value ?? "").trim();
  return text || fallback;
}

function isUnknownDepartmentName(value) {
  const text = String(value ?? "").trim();
  return !text || text === "-" || text === "—" || /^sem departamento$/i.test(text);
}

function pct(part, total) {
  const p = num(part);
  const t = num(total);
  if (t <= 0) return null;
  return (p / t) * 100;
}

function plural(n, sing, plur) {
  return n === 1 ? sing : plur;
}

function resolveStatus(coveragePct, thresholds) {
  if (coveragePct == null) return OPERATION_STATUS.ATENCAO;
  if (coveragePct >= thresholds.normal) return OPERATION_STATUS.NORMAL;
  if (coveragePct >= thresholds.atencao) return OPERATION_STATUS.ATENCAO;
  if (coveragePct >= thresholds.comprometida) return OPERATION_STATUS.COMPROMETIDA;
  return OPERATION_STATUS.CRITICA;
}

function buildDepartmentImpact(row = {}) {
  const rawNome = row.nome ?? row.name ?? row.depto ?? row.departamento;
  const isUnknown = isUnknownDepartmentName(rawNome);
  const nome = isUnknown
    ? "Sem departamento informado"
    : cleanText(rawNome, "Sem departamento informado");
  const gestor = cleanText(row.gestor ?? row.manager ?? row.responsavel, "Sem gestor informado");
  const presentes = num(row.presentes);
  const ausentes = num(row.ausentes ?? row.falta ?? row.faltas);
  const atrasados = num(row.atrasados ?? row.atraso);
  const forcaAtual = num(row.forcaAtual ?? row.atual);
  const forcaPrevista = num(row.forcaPrevista ?? row.prevista);
  const deficitCobertura = Math.max(0, forcaPrevista - forcaAtual);
  const coveragePct = pct(forcaAtual, forcaPrevista);
  const priorityWeight = ausentes * 2 + atrasados + deficitCobertura * 3;

  return {
    id: cleanText(row.id ?? nome, nome),
    nome,
    isUnknown,
    gestor,
    presentes,
    ausentes,
    atrasados,
    forcaAtual,
    forcaPrevista,
    deficitCobertura,
    coveragePct,
    priorityWeight,
  };
}

function compact(list, limit) {
  return list.filter(Boolean).slice(0, limit);
}

function deptLabel(dept) {
  return dept?.isUnknown ? "registros sem departamento informado" : dept?.nome;
}

function buildDiagnosis(status, resumo, coveragePct, topDepartment) {
  if (status === OPERATION_STATUS.NORMAL) {
    if (topDepartment?.priorityWeight > 0) {
      return "Cobertura normal, com pontos de atenção localizados.";
    }
    return "Cobertura normal para a força prevista do dia.";
  }
  const coverageText =
    coveragePct == null
      ? "sem força prevista suficiente para medir cobertura"
      : `${coveragePct.toFixed(1).replace(".", ",")}% da força prevista`;
  const deptText = topDepartment ? ` O maior impacto está em ${deptLabel(topDepartment)}.` : "";
  return `Operação em ${STATUS_LABELS[status].toLowerCase()}: cobertura atual em ${coverageText}.${deptText}`;
}

function buildReasons(resumo, coveragePct, knownAffectedDepts) {
  const top = knownAffectedDepts[0];
  return compact(
    [
      coveragePct != null && coveragePct < 95
        ? `Força atual abaixo da prevista: ${num(resumo.forcaAtual ?? resumo.atual)} de ${num(resumo.forcaPrevista ?? resumo.prevista)}.`
        : null,
      top && top.deficitCobertura > 0
        ? top.forcaPrevista > 0
          ? `${top.nome} tem déficit de ${top.deficitCobertura} ${plural(top.deficitCobertura, "colaborador", "colaboradores")} (${top.forcaAtual} de ${top.forcaPrevista} previstos).`
          : `${top.nome} tem déficit de ${top.deficitCobertura} ${plural(top.deficitCobertura, "colaborador", "colaboradores")}.`
        : null,
      top && top.ausentes > 0
        ? `${top.nome} concentra ${top.ausentes} ${plural(top.ausentes, "falta operacional", "faltas operacionais")}.`
        : null,
      top && top.atrasados > 0
        ? `${top.nome} concentra ${top.atrasados} ${plural(top.atrasados, "atraso", "atrasos")}.`
        : null,
    ],
    3,
  );
}

function buildDataQualityWarnings(unknownRecords) {
  if (!unknownRecords.length) return [];
  const rec = unknownRecords[0];
  const parts = [];
  if (rec.deficitCobertura > 0) {
    const ctx = rec.forcaPrevista > 0 ? ` (${rec.forcaAtual} de ${rec.forcaPrevista} previstos)` : "";
    parts.push(
      `${rec.deficitCobertura} ${plural(rec.deficitCobertura, "colaborador", "colaboradores")} sem departamento afetam a cobertura${ctx}.`,
    );
  }
  if (rec.ausentes > 0) {
    parts.push(`${rec.ausentes} ${plural(rec.ausentes, "falta", "faltas")} em registros sem departamento informado.`);
  }
  if (rec.atrasados > 0) {
    parts.push(`${rec.atrasados} ${plural(rec.atrasados, "atraso", "atrasos")} em registros sem departamento informado.`);
  }
  return parts;
}

function buildFirstAction(status, topDepartment) {
  if (!topDepartment || status === OPERATION_STATUS.NORMAL) {
    return {
      label:
        topDepartment?.priorityWeight > 0
          ? "Acompanhar departamentos em atenção"
          : "Manter acompanhamento do dia",
      action: "OPEN_EMPLOYEES",
      payload: { category: "presentes" },
    };
  }
  if (topDepartment.deficitCobertura > 0) {
    const category =
      topDepartment.ausentes > 0 ? "faltas" : topDepartment.atrasados > 0 ? "atrasos" : "presentes";
    const focus = category === "faltas" ? "absence" : category === "atrasos" ? "delay" : "coverage";
    return {
      label: `Revisar cobertura em ${topDepartment.nome}`,
      action: "OPEN_DEPARTMENT",
      payload: { departamento: topDepartment.nome, category, focus },
    };
  }
  if (topDepartment.ausentes > 0) {
    return {
      label: `Validar ausências em ${topDepartment.nome}`,
      action: "OPEN_DEPARTMENT",
      payload: { departamento: topDepartment.nome, category: "faltas", focus: "absence" },
    };
  }
  return {
    label: `Ver atrasos em ${topDepartment.nome}`,
    action: "OPEN_DEPARTMENT",
    payload: { departamento: topDepartment.nome, category: "atrasos", focus: "delay" },
  };
}

function buildManagerRanking(departments) {
  const map = new Map();
  departments.forEach((dept) => {
    if (!dept.gestor || dept.gestor === "Sem gestor informado") return;
    const cur = map.get(dept.gestor) || {
      gestor: dept.gestor,
      departamentos: 0,
      ausentes: 0,
      atrasados: 0,
      deficitCobertura: 0,
      priorityWeight: 0,
    };
    cur.departamentos += 1;
    cur.ausentes += dept.ausentes;
    cur.atrasados += dept.atrasados;
    cur.deficitCobertura += dept.deficitCobertura;
    cur.priorityWeight += dept.priorityWeight;
    map.set(dept.gestor, cur);
  });
  return Array.from(map.values())
    .sort((a, b) => b.priorityWeight - a.priorityWeight)
    .slice(0, 3);
}

function buildAnomalies(status, affectedDepartments, resumo) {
  const top = affectedDepartments[0];
  return compact(
    [
      status !== OPERATION_STATUS.NORMAL
        ? {
            type: "coverage_gap",
            title: "Cobertura abaixo do previsto",
            description: `${num(resumo.forcaAtual ?? resumo.atual)} de ${num(resumo.forcaPrevista ?? resumo.prevista)} previstos.`,
            severity: status,
          }
        : null,
      top && top.ausentes > 0
        ? {
            type: "department_absence",
            title: "Ausências concentradas",
            description: `${top.nome}: ${top.ausentes} ${plural(top.ausentes, "ocorrência", "ocorrências")}.`,
            severity: top.ausentes >= 3 ? OPERATION_STATUS.COMPROMETIDA : OPERATION_STATUS.ATENCAO,
          }
        : null,
      top && top.atrasados > 0
        ? {
            type: "department_delay",
            title: "Atrasos concentrados",
            description: `${top.nome}: ${top.atrasados} ${plural(top.atrasados, "ocorrência", "ocorrências")}.`,
            severity: OPERATION_STATUS.ATENCAO,
          }
        : null,
    ],
    5,
  );
}

export function analyzeOperationalStatus(data = {}, config = {}) {
  const thresholds = { ...DEFAULT_OPERATION_THRESHOLDS, ...(config.thresholds || {}) };
  const resumo = data.resumo || {};
  const forcaAtual = num(resumo.forcaAtual ?? resumo.atual);
  const forcaPrevista = num(resumo.forcaPrevista ?? resumo.prevista);
  const coveragePct = pct(forcaAtual, forcaPrevista);
  const status = resolveStatus(coveragePct, thresholds);

  const departments = Array.isArray(data.departamentos)
    ? data.departamentos.map(buildDepartmentImpact)
    : [];
  const affectedDepartments = departments
    .filter((dept) => dept.priorityWeight > 0)
    .sort((a, b) => {
      if (a.isUnknown !== b.isUnknown) return a.isUnknown ? 1 : -1;
      return b.priorityWeight - a.priorityWeight;
    })
    .slice(0, 3);

  const knownAffectedDepts = affectedDepartments.filter((d) => !d.isUnknown);
  const unknownRecords = affectedDepartments.filter((d) => d.isUnknown);
  const topKnown = knownAffectedDepts[0] ?? null;

  const affectedManagers = buildManagerRanking(departments);
  const diagnosis = buildDiagnosis(status, resumo, coveragePct, topKnown);
  const reasons = buildReasons(resumo, coveragePct, knownAffectedDepts);
  const dataQualityWarnings = buildDataQualityWarnings(unknownRecords);
  const recommendedFirstAction = buildFirstAction(status, topKnown);
  const anomalies = buildAnomalies(status, knownAffectedDepts, resumo);

  const limitations = compact(
    [
      forcaPrevista <= 0 ? "Força prevista não informada; status pode ficar conservador." : null,
      departments.length === 0 ? "Sem detalhamento por departamento para localizar a causa." : null,
      affectedManagers.length === 0 ? "Gestores não informados nos dados recebidos." : null,
      "Sem controle, férias, folgas e afastamentos entram como contexto, não como problema automático.",
    ],
    4,
  );

  return {
    operationStatus: {
      code: status,
      label: STATUS_LABELS[status],
      tone: STATUS_TONES[status],
      coveragePct,
      forcaAtual,
      forcaPrevista,
      deficitCobertura: Math.max(0, forcaPrevista - forcaAtual),
    },
    diagnosis,
    reasons,
    dataQualityWarnings,
    recommendedFirstAction,
    affectedDepartments,
    affectedManagers,
    anomalies,
    limitations,
  };
}

export default analyzeOperationalStatus;
