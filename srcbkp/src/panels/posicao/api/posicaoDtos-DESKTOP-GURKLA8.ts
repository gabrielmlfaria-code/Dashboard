export interface PeriodoDto {
  de: string;
  ate: string;
  label?: string;
}

export interface PositionDayDto {
  data: string;
  filial?: string;
  departamento?: string;
  cargo?: string;
  genero?: string;
  presentes: number;
  faltas: number;
  atrasos: number;
  folgas: number;
  ferias: number;
  afastados: number;
  jaSairam: number;
  entradaPrevista: number;
  naoControlaPonto: number;
}

export interface AbsenteeismSummaryDto {
  periodo: PeriodoDto;
  horasPlanejadasMinutos: number;
  horasTrabalhadasMinutos: number;
  horasAusentesMinutos: number;
  horasJustificadasMinutos: number;
  indicePercentual: number;
  metaPercentual: number;
  calculo?: CalculationLedgerDto;
  /** @deprecated Compatibilidade temporaria com adapters locais anteriores. */
  horasPlanejadasMin?: number;
  /** @deprecated Compatibilidade temporaria com adapters locais anteriores. */
  horasTrabalhadasMin?: number;
  /** @deprecated Compatibilidade temporaria com adapters locais anteriores. */
  horasAusentesMin?: number;
  /** @deprecated Compatibilidade temporaria com adapters locais anteriores. */
  horasJustificadasMin?: number;
  /** @deprecated Compatibilidade temporaria com adapters locais anteriores. */
  indicePct?: number;
  /** @deprecated Compatibilidade temporaria com adapters locais anteriores. */
  metaPct?: number;
}

export interface BankHoursDto {
  periodo: PeriodoDto;
  saldoAnteriorMinutos: number | null;
  creditoMinutos: number;
  debitoMinutos: number;
  saldoProximoMinutos: number;
  /** @deprecated Compatibilidade temporaria com adapters locais anteriores. */
  saldoAnteriorMin?: number | null;
  /** @deprecated Compatibilidade temporaria com adapters locais anteriores. */
  creditoMin?: number;
  /** @deprecated Compatibilidade temporaria com adapters locais anteriores. */
  debitoMin?: number;
  /** @deprecated Compatibilidade temporaria com adapters locais anteriores. */
  saldoProximoMin?: number;
  departamentos: BankHoursDepartmentDto[];
}

export interface BankHoursDepartmentDto {
  departamento: string;
  saldoAnteriorMinutos: number | null;
  creditoMinutos: number;
  debitoMinutos: number;
  saldoProximoMinutos: number;
  /** @deprecated Compatibilidade temporaria com adapters locais anteriores. */
  saldoAnteriorMin?: number | null;
  /** @deprecated Compatibilidade temporaria com adapters locais anteriores. */
  creditoMin?: number;
  /** @deprecated Compatibilidade temporaria com adapters locais anteriores. */
  debitoMin?: number;
  /** @deprecated Compatibilidade temporaria com adapters locais anteriores. */
  saldoProximoMin?: number;
  colaboradores: number;
}

export interface MonthlyClosingDto {
  periodo: PeriodoDto;
  eventos: MonthlyClosingEventDto[];
}

export interface MonthlyClosingEventDto {
  codigo: string;
  descricao: string;
  categoria?: string;
  meses: MonthlyClosingMonthDto[];
}

export interface MonthlyClosingMonthDto {
  mes: string;
  horasMin: number;
  variacaoPct: number | null;
}

export interface LaborRadarDto {
  periodo: PeriodoDto;
  ocorrencias: number;
  colaboradoresImpactados: number;
  principalEvento?: {
    codigo?: string;
    descricao: string;
    ocorrencias: number;
    colaboradores: number;
  };
}

export interface ApiEnvelope<T> {
  data: T;
  warnings?: string[];
  generatedAt?: string;
  traceId?: string;
  fonteDados?: string;
  versaoRegra?: string;
}

export interface CalculationLedgerDto {
  formula: string;
  base: string;
  entradas?: Record<string, number | string | null>;
  resultado?: number;
  avisos?: string[];
  versaoRegra?: string;
}
