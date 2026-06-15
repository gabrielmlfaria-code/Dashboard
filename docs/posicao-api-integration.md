# Integracao da Posicao com API .NET

Este documento define a trilha de integracao para tirar a tela de Posicao do Dia do modelo
local/importado e prepara-la para uma API .NET 10 + SQL Server.

## Principios

- A API deve devolver dados ja agregados para os cards principais.
- O frontend nao deve recalcular regra de negocio critica quando a API estiver ativa.
- Durante a transicao, adapters locais mantem compatibilidade com planilhas/importacoes.
- Todo calculo sensivel deve ter ledger: entradas, formula, resultado e versao da regra.
- Importacao manual deve ser fallback de desenvolvimento, nao fluxo de producao.

## Politica de Fonte de Dados

Arquivos criados para centralizar a decisao:

- `src/panels/posicao/api/posicaoDataPolicy.js`
- `src/panels/posicao/api/posicaoDataProvider.js`

O provider valida `de/ate` no formato `yyyy-MM-dd` antes da chamada remota. Os metodos legados
continuam retornando apenas `data`; os metodos `getPositionDayResult`, `getAbsenteeismResult`,
`getBankHoursResult`, `getMonthlyClosingResult` e `getLaborRadarResult` retornam `{ data, meta }`
com `warnings`, `generatedAt`, `traceId`, `fonteDados` e `versaoRegra`.

Flags:

```env
VITE_SOURCE_POSICAO=api
VITE_ENABLE_IMPORTS=false
VITE_API_BASE_URL=https://sua-api/api
```

Com `VITE_SOURCE_POSICAO=api`, o provider so aceita chamadas de API. Com
`VITE_ENABLE_IMPORTS=false`, a aba de importacoes manuais fica bloqueada.

## Contratos Criados

Arquivos:

- `src/panels/posicao/api/posicaoDtos.ts`
- `src/panels/posicao/api/posicaoApiClient.js` (runtime usado pelo provider)
- `src/panels/posicao/api/posicaoApiClient.ts` (referencia tipada temporaria)
- `src/panels/posicao/api/posicaoLocalAdapters.js`

Endpoints previstos:

- `GET /api/posicao/dia?de=YYYY-MM-DD&ate=YYYY-MM-DD`
- `GET /api/absenteismo/resumo?de=YYYY-MM-DD&ate=YYYY-MM-DD`
- `GET /api/banco-horas/resumo?de=YYYY-MM-DD&ate=YYYY-MM-DD`
- `GET /api/fechamento-mensal/eventos?de=YYYY-MM-DD&ate=YYYY-MM-DD`
- `GET /api/radar-trabalhista/resumo?de=YYYY-MM-DD&ate=YYYY-MM-DD`

As fixtures de contrato ficam em `src/api/apiContractFixtures.js`.

## Calculos Centralizados

Arquivo:

- `src/panels/posicao/domain/indicatorCalculations.js`

Funcoes:

- `calculateAbsenteeism`
- `calculateBankHours`
- `calculateMonthlyVariation`
- `calculateTurnoverPct`

Regra atual do absenteismo:

```text
(horas ausentes injustificadas + horas ausentes justificadas) / horas planejadas * 100
```

Importante: horas trabalhadas menores que planejadas nao devem ser usadas como base automatica do
indice. O indice usa ausencias categorizadas.

## Migracao Recomendada para SQL Server

Tabelas ou views minimas:

- `vw_posicao_dia`
- `vw_absenteismo_periodo`
- `vw_banco_horas_periodo`
- `vw_fechamento_mensal_evento`
- `vw_radar_trabalhista_periodo`

Campos obrigatorios:

- periodo de apuracao (`de`, `ate`)
- filial
- departamento
- matricula
- colaborador
- cargo
- genero
- codigo do evento
- descricao do evento
- categoria de hora
- minutos planejados
- minutos trabalhados
- minutos ausentes
- minutos justificados
- minutos extras
- saldo anterior, credito, debito e saldo proximo do banco de horas

## Proximas Etapas Tecnicas

1. Fazer a API devolver os DTOs documentados.
2. Substituir gradualmente adapters locais por `posicaoDataProvider`.
3. Manter testes deterministicos para cada indicador.
4. Extrair mais partes do `PosicaoBentoHeader.jsx`, comecando por modais e secoes de dashboard.
5. Migrar contratos e dominio para TypeScript antes de migrar componentes visuais.
