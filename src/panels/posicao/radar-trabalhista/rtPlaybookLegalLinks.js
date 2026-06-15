/** Links oficiais / institucionais para consulta (Planalto, TST, gov.br). */

export const CLT_DECRETO_LEI =
  "http://www.planalto.gov.br/ccivil_03/decreto-lei/del5452.htm";

/** @type {Record<string, { label: string, url: string }>} */
export const LEGAL_LINKS = {
  clt71: {
    label: "CLT — Art. 71 (intervalo intrajornada)",
    url: `${CLT_DECRETO_LEI}#art71`,
  },
  clt66: {
    label: "CLT — Art. 66 (interjornada)",
    url: `${CLT_DECRETO_LEI}#art66`,
  },
  clt59: {
    label: "CLT — Art. 59 (horas extras)",
    url: `${CLT_DECRETO_LEI}#art59`,
  },
  clt74: {
    label: "CLT — Arts. 74 a 75 (controle de jornada)",
    url: `${CLT_DECRETO_LEI}#art74`,
  },
  clt129: {
    label: "CLT — Férias (Cap. IV)",
    url: `${CLT_DECRETO_LEI}#capituloiv`,
  },
  clt: {
    label: "CLT — texto consolidado (Planalto)",
    url: CLT_DECRETO_LEI,
  },
  sum437: {
    label: "TST — Súmula 437",
    url: "https://www.tst.jus.br/sumulas-1",
  },
  jurisTst: {
    label: "TST — Súmulas e jurisprudência uniforme",
    url: "https://www.tst.jus.br/jurisprudencia-uniforme-e-sumulas",
  },
  govTrabalho: {
    label: "Ministério do Trabalho e Emprego",
    url: "https://www.gov.br/trabalho-e-emprego/pt-br",
  },
};

const BY_PENALTY_KIND = {
  "intrajornada-6h": [LEGAL_LINKS.clt71, LEGAL_LINKS.sum437, LEGAL_LINKS.clt],
  intrajornada: [LEGAL_LINKS.clt71, LEGAL_LINKS.sum437, LEGAL_LINKS.jurisTst],
  interjornada: [LEGAL_LINKS.clt66, LEGAL_LINKS.jurisTst, LEGAL_LINKS.clt],
  extra: [LEGAL_LINKS.clt59, LEGAL_LINKS.clt],
  ponto: [LEGAL_LINKS.clt74, LEGAL_LINKS.govTrabalho, LEGAL_LINKS.clt],
  ferias: [LEGAL_LINKS.clt129, LEGAL_LINKS.clt],
  generic: [LEGAL_LINKS.clt, LEGAL_LINKS.govTrabalho],
};

/**
 * @param {{ penaltyKind?: string }} playbook
 * @returns {{ label: string, url: string }[]}
 */
export function getLegalSourcesForPlaybook(playbook) {
  const kind = playbook?.penaltyKind || "generic";
  return BY_PENALTY_KIND[kind] || BY_PENALTY_KIND.generic;
}
