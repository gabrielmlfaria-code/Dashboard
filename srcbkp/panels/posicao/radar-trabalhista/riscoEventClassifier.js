function normText(value) {
  return String(value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
}

function cleanText(value, fallback = "") {
  const text = String(value ?? "").trim();
  return text || fallback;
}

export function classifyRiscoEvent(label, explicitBase = "") {
  const explicit = cleanText(explicitBase, "");
  const n = normText(label);

  if (n.includes("ferias")) {
    return {
      kind: "ferias",
      baseLegal: explicit || "CLT Arts. 129-153",
    };
  }

  if (
    n.includes("marcacao") ||
    n.includes("ponto") ||
    n.includes("biometria") ||
    n.includes("rep")
  ) {
    return {
      kind: "ponto",
      baseLegal: explicit || "CLT Art. 74",
    };
  }

  if (
    n.includes("interjornada") ||
    n.includes("11h") ||
    n.includes("11 horas") ||
    n.includes("menor que 1100")
  ) {
    return {
      kind: "interjornada",
      baseLegal: explicit || "CLT Art. 66",
    };
  }

  if (
    n.includes("extra") ||
    n.includes("excedente") ||
    n.includes("jornada maior") ||
    n.includes("maior que 10") ||
    n.includes("mais de 2 horas")
  ) {
    return {
      kind: "extra",
      baseLegal: explicit || "CLT Art. 59",
    };
  }

  if (n.includes("intervalo") || n.includes("refeicao")) {
    return {
      kind: "intrajornada",
      baseLegal: explicit || "CLT Art. 71",
    };
  }

  return {
    kind: "intrajornada",
    baseLegal: explicit || "Base legal a validar",
  };
}

export function riscoEventKind(label) {
  return classifyRiscoEvent(label).kind;
}
