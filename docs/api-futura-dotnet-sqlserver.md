# API futura .NET 10 + SQL Server

Este documento define a tomada que o React V6 deve consumir enquanto a API real ainda nao
existe. Durante a transicao, mocks e importacoes locais devem produzir o mesmo formato.

## Principios

- A API e a fonte oficial dos calculos em producao.
- O front pode calcular apenas pre-visualizacoes quando a fonte for `mock` ou `importacao`.
- Duracoes sempre trafegam como inteiro em minutos.
- Datas sempre trafegam como `yyyy-MM-dd`.
- Percentuais trafegam como numero decimal, sem `%`.
- Dinheiro deve trafegar como inteiro em centavos quando entrar no contrato.
- `matricula` e a chave externa do colaborador; `nome` e atributo exibivel.

## Configuracao do front

```env
VITE_API_SOURCE=mock
VITE_USE_MOCK=true
VITE_ENABLE_IMPORTS=true
VITE_API_BASE_URL=http://localhost:5000/api

VITE_SOURCE_POSICAO=mock
VITE_SOURCE_ABSENTEISMO=mock
VITE_SOURCE_RADAR=mock
VITE_SOURCE_MENSAL=importacao
VITE_SOURCE_BANCO_HORAS=importacao
```

Quando a API estiver pronta para um modulo, trocar somente a fonte:

```env
VITE_SOURCE_ABSENTEISMO=api
VITE_USE_MOCK=false
```

## Rotas oficiais

As rotas do front ficam centralizadas em `src/api/apiRoutes.js`.

```txt
GET  /api/health
POST /api/auth/login
POST /api/auth/refresh

GET /api/posicao/dia?de=yyyy-MM-dd&ate=yyyy-MM-dd

GET /api/absenteismo/resumo?de=yyyy-MM-dd&ate=yyyy-MM-dd&filialId=&deptoId=
GET /api/absenteismo/eventos?de=&ate=&page=&pageSize=&sort=&dir=&search=&categoria=&filialId=&deptoId=&groupBy=&groupKey=
GET /api/absenteismo/grupos?de=&ate=&groupBy=&search=&categoria=&filialId=&deptoId=
GET /api/absenteismo/colaboradores?de=&ate=&page=&pageSize=&sort=&dir=&search=&filialId=&deptoId=

GET /api/banco-horas/resumo?de=yyyy-MM-dd&ate=yyyy-MM-dd
GET /api/banco-horas/departamentos?de=yyyy-MM-dd&ate=yyyy-MM-dd&top=10
GET /api/banco-horas/colaboradores?de=&ate=&departamento=&page=&pageSize=

GET /api/fechamento-mensal/eventos?de=yyyy-MM-dd&ate=yyyy-MM-dd
GET /api/radar-trabalhista/resumo?de=yyyy-MM-dd&ate=yyyy-MM-dd
```

## Envelope recomendado

O front valida fixtures desse envelope em `src/api/apiContractFixtures.js` e
`src/api/apiContractFixtures.test.js`. Use essas fixtures como exemplos oficiais enquanto a API
real ainda nao existe.

```json
{
  "data": {},
  "warnings": [],
  "generatedAt": "2026-06-09T15:00:00-03:00",
  "traceId": "00-...",
  "fonteDados": "sql-server",
  "versaoRegra": "2026.06"
}
```

Endpoints paginados podem retornar diretamente:

```json
{
  "items": [],
  "total": 0,
  "page": 1,
  "pageSize": 200,
  "totais": {}
}
```

## DTOs principais

### AbsenteismoResumoDto

```json
{
  "periodo": { "de": "2026-06-01", "ate": "2026-06-09" },
  "horasPlanejadasMinutos": 96360,
  "horasTrabalhadasMinutos": 42067,
  "horasAusentesMinutos": 16065,
  "horasJustificadasMinutos": 0,
  "indicePercentual": 16.7,
  "metaPercentual": 5,
  "calculo": {
    "formula": "(horasAusentesMinutos / horasPlanejadasMinutos) * 100",
    "base": "horasPlanejadasMinutos",
    "entradas": {
      "horasAusentesMinutos": 16065,
      "horasPlanejadasMinutos": 96360
    },
    "resultado": 16.7,
    "avisos": [],
    "versaoRegra": "2026.06"
  }
}
```

### AbsenteismoEventoDto

```json
{
  "matricula": "10042",
  "nome": "Ana Costa",
  "filial": "SP - SBC",
  "departamento": "Producao",
  "cargo": "Operador",
  "data": "2026-06-09",
  "horario": "08:00 - 17:00",
  "marcacao": "07:58 12:01 13:00 17:05",
  "codigoEvento": "001",
  "descricaoEvento": "Hora Normal",
  "minutos": 480,
  "categoria": "presentes"
}
```

### BancoHorasResumoDto

```json
{
  "periodo": { "de": "2026-05-21", "ate": "2026-06-20" },
  "saldoAnteriorMinutos": 2223,
  "creditoMinutos": 1680,
  "debitoMinutos": -244,
  "saldoProximoMinutos": 3659,
  "departamentos": []
}
```

## SQL Server sugerido

Views iniciais:

```txt
vw_posicao_dia
vw_absenteismo_eventos
vw_absenteismo_resumo_periodo
vw_banco_horas_periodo
vw_fechamento_mensal_evento
vw_radar_trabalhista_periodo
```

Indice minimo para a fato de apontamentos:

```sql
CREATE NONCLUSTERED INDEX IX_Apontamento_Data_Filial_Matricula
ON dbo.Apontamento (DataReferencia, FilialId, Matricula)
INCLUDE (CodigoEvento, Minutos, DepartamentoId, CargoId);
```

Agregacoes de resumo e grupos devem ser feitas no SQL, nao no React.

## Erros

Usar `ProblemDetails`:

```json
{
  "title": "Periodo invalido",
  "status": 400,
  "detail": "A data inicial deve ser menor ou igual a data final.",
  "traceId": "00-..."
}
```

## Checklist para considerar um modulo pronto

- Endpoint documentado no Swagger.
- DTO validado contra o contrato acima.
- Resposta real compatível com as fixtures de `src/api/apiContractFixtures.js`.
- `generatedAt`, `traceId`, `fonteDados` e `versaoRegra` preenchidos no envelope quando possível.
- Teste backend para periodo invalido, intervalo maximo, filtros e pagina.
- Teste front com `VITE_SOURCE_* = api`.
- Mock/importacao produzindo o mesmo formato do endpoint real.
