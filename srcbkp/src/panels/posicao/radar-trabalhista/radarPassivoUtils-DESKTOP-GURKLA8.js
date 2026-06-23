import { riscoEventKind } from "./riscoEventClassifier.js";

/** Configuracao padrao de passivo trabalhista (editavel na aba Parametros). */
export const DEFAULT_PASSIVO_CFG = {
  sh: 18.5,
  adicionalHe: 0.5,
  multaMin: 40.25,
  regime: "atual",
};

export const PASSIVO_CFG_STORAGE_KEY = "pb_radar_trabalhista_passivo_cfg_v1";

export function eventKind(label) {
  return riscoEventKind(label);
}

export function loadPassivoCfg() {
  if (typeof window === "undefined") return { ...DEFAULT_PASSIVO_CFG };
  try {
    const raw = JSON.parse(window.localStorage.getItem(PASSIVO_CFG_STORAGE_KEY) || "null");
    return { ...DEFAULT_PASSIVO_CFG, ...(raw || {}), regime: "atual" };
  } catch {
    return { ...DEFAULT_PASSIVO_CFG };
  }
}

export function savePassivoCfg(cfg) {
  if (typeof window === "undefined") return;
  const next = { ...DEFAULT_PASSIVO_CFG, ...(cfg || {}), regime: "atual" };
  window.localStorage.setItem(PASSIVO_CFG_STORAGE_KEY, JSON.stringify(next));
}

export function passivoKindLabel(kind) {
  if (kind === "ferias") return "Ferias";
  if (kind === "ponto") return "Ponto/marcacao";
  if (kind === "interjornada") return "Interjornada";
  if (kind === "extra") return "Hora extra/sobrejornada";
  return "Intrajornada/intervalo";
}

export function calcPassivoLinha(
  { evento, ocorrencias = 0, colaboradores = 0, horas = 0 },
  cfg = DEFAULT_PASSIVO_CFG,
) {
  const c = { ...DEFAULT_PASSIVO_CFG, ...cfg };
  const sh = Number(c.sh) || 0;
  const adicional = 1 + (Number(c.adicionalHe) || 0.5);
  const kind = eventKind(evento);
  const horasMinutos = Math.max(0, Number(horas) || 0);
  const horasTotais = horasMinutos / 60;
  let passivo = 0;
  let formula = "";
  let horasBase = 0;
  let usesFallbackHours = false;

  const baseHoras = (horasPadraoPorOcorrencia) => {
    if (horasTotais > 0) {
      usesFallbackHours = false;
      horasBase = horasTotais;
      return horasTotais;
    }
    usesFallbackHours = true;
    horasBase = Math.max(0, Number(ocorrencias) || 0) * horasPadraoPorOcorrencia;
    return horasBase;
  };

  if (kind === "ferias") {
    passivo = colaboradores * (sh * 220) * 2.33;
    formula = "colabs x (SH x 220) x 2,33 (estimativa preliminar)";
  } else if (kind === "ponto") {
    passivo = ocorrencias * (Number(c.multaMin) || 40.25);
    formula = "ocorr x multa configurada";
  } else if (kind === "extra") {
    const h = baseHoras(2);
    passivo = h * sh * adicional;
    formula = `${usesFallbackHours ? "ocorr x horas padrao" : "horas totais"} x SH x 1,5`;
  } else {
    const h = baseHoras(1);
    passivo = h * sh * 1.5;
    formula = `${usesFallbackHours ? "ocorr x horas padrao" : "horas totais"} x SH x 1,5`;
  }

  return {
    passivo: Math.max(0, Math.round(passivo * 100) / 100),
    formula,
    kind,
    horasMinutos,
    horasBase,
    usesFallbackHours,
  };
}

export function fmtBRL(n) {
  return Number(n || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

export function fmtK(n) {
  const v = Number(n) || 0;
  if (Math.abs(v) >= 1_000_000) return `${(v / 1_000_000).toFixed(1).replace(".", ",")}M`;
  if (Math.abs(v) >= 1000) return `${(v / 1000).toFixed(1).replace(".", ",")}K`;
  return fmtBRL(v);
}
