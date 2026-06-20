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
  horasPlanejadasMin: number;
  horasTrabalhadasMin: number;
  horasAusentesMin: number;
  horasJustificadasMin: number;
  indicePct: number;
  metaPct: number;
}

export interface BankHoursDto {
  periodo: PeriodoDto;
  saldoAnteriorMin: number | null;
  creditoMin: number;
  debitoMin: number;
  saldoProximoMin: number;
  departamentos: BankHoursDepartmentDto[];
}

export interface BankHoursDepartmentDto {
  departamento: string;
  saldoAnteriorMin: number | null;
  creditoMin: number;
  debitoMin: number;
  saldoProximoMin: number;
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
}
