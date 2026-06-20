import { z } from "zod";

export const IsoDateSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);

export const IsoDateTimeSchema = z.string().datetime().or(z.string().datetime({ offset: true }));

export const PeriodoApuracaoSchema = z.object({
  de: IsoDateSchema,
  ate: IsoDateSchema,
  fonte: z.string().optional(),
  atualizadoEm: IsoDateTimeSchema.optional(),
});

export const DurationMinutesSchema = z.number().int().finite();

export const MoneyCentsSchema = z.number().int().finite();

export const PageRequestSchema = z.object({
  page: z.number().int().min(1).optional(),
  pageSize: z.number().int().min(1).max(500).optional(),
  sortBy: z.string().optional(),
  sortDir: z.enum(["asc", "desc"]).optional(),
});

export const ApiProblemSchema = z.object({
  type: z.string().optional(),
  title: z.string(),
  status: z.number().int(),
  detail: z.string().optional(),
  instance: z.string().optional(),
  traceId: z.string().optional(),
  errors: z.record(z.array(z.string())).optional(),
});

export const AbsenteismoResumoSchema = z.object({
  periodo: PeriodoApuracaoSchema,
  horasPlanejadasMinutos: DurationMinutesSchema,
  horasTrabalhadasMinutos: DurationMinutesSchema,
  horasAusentesMinutos: DurationMinutesSchema,
  indicePercentual: z.number().finite(),
  metaPercentual: z.number().finite(),
  calculo: z
    .object({
      formula: z.literal("(horasAusentesMinutos / horasPlanejadasMinutos) * 100"),
      base: z.literal("horasPlanejadasMinutos"),
    })
    .optional(),
});

export const BancoHorasResumoSchema = z.object({
  periodo: PeriodoApuracaoSchema,
  saldoAnteriorMinutos: DurationMinutesSchema.nullable(),
  creditoMinutos: DurationMinutesSchema,
  debitoMinutos: DurationMinutesSchema,
  saldoProximoMinutos: DurationMinutesSchema,
});

export const BancoHorasDepartamentoSchema = z.object({
  departamento: z.string(),
  saldoAnteriorMinutos: DurationMinutesSchema.nullable().optional(),
  creditoMinutos: DurationMinutesSchema,
  debitoMinutos: DurationMinutesSchema,
  saldoProximoMinutos: DurationMinutesSchema,
  colaboradores: z.number().int().nonnegative().optional(),
});

export const BancoHorasColaboradorSchema = z.object({
  matricula: z.string().optional(),
  nome: z.string(),
  filial: z.string().optional(),
  departamento: z.string().optional(),
  cargo: z.string().optional(),
  atividade: z.string().optional(),
  periodoInicial: IsoDateSchema.optional(),
  periodoFinal: IsoDateSchema.optional(),
  saldoAnteriorMinutos: DurationMinutesSchema.nullable().optional(),
  creditoMinutos: DurationMinutesSchema,
  debitoMinutos: DurationMinutesSchema,
  saldoProximoMinutos: DurationMinutesSchema,
});

export const FechamentoMensalEventoSchema = z.object({
  codigoEvento: z.string(),
  descricaoEvento: z.string(),
  categoria: z.string().nullable().optional(),
  competencia: z.string().regex(/^\d{4}-\d{2}$/),
  horasMinutos: DurationMinutesSchema,
  variacaoPercentual: z.number().finite().nullable().optional(),
});

export const PosicaoDiaResumoSchema = z.object({
  data: IsoDateSchema,
  periodoApuracao: PeriodoApuracaoSchema.optional(),
  presentes: z.number().int().nonnegative(),
  ausentes: z.number().int().nonnegative(),
  atrasos: z.number().int().nonnegative(),
  ferias: z.number().int().nonnegative(),
  afastados: z.number().int().nonnegative(),
  totalPlanejado: z.number().int().nonnegative(),
});
