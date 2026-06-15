# Contrato de Integração - Absenteísmo V6

Este documento define a fronteira entre o front React JSX e a API .NET/SQL Server.

Status atual: a API real ainda nao existe. O contrato operacional para preparar o
front sem depender do backend esta em `docs/api-futura-dotnet-sqlserver.md`.
As rotas consumidas pelo front ficam centralizadas em `src/api/apiRoutes.js`.

## Fontes de Dados

Cada módulo pode operar em uma das fontes abaixo:

- `api`: dados oficiais vindos da API .NET.
- `mock`: dados sintéticos usados em desenvolvimento.
- `importacao`: dados importados localmente de planilhas, usados como transição.

Configuração:

```env
VITE_API_SOURCE=mock
VITE_SOURCE_POSICAO=api
VITE_SOURCE_ABSENTEISMO=api
VITE_SOURCE_RADAR=api
VITE_SOURCE_MENSAL=importacao
VITE_SOURCE_BANCO_HORAS=importacao
```

## Convenções Obrigatórias

- Datas: `yyyy-MM-dd`.
- Competências mensais: `yyyy-MM`.
- Horas/durações: inteiro em minutos.
- Dinheiro: inteiro em centavos.
- Percentuais: número decimal, sem o símbolo `%`.
- Colaborador: usar `matricula` como chave externa; nome é atributo exibível.
- Evento: sempre carregar `codigoEvento`, `descricaoEvento` e `categoria`.

## Responsabilidade dos Cálculos

No modelo final, a API deve ser a fonte oficial dos cálculos. O front pode calcular prévias
apenas para dados importados localmente.

Indicadores que devem vir explicáveis da API:

- Absenteísmo: horas ausentes / horas planejadas \* 100.
- Banco de horas: saldo anterior + crédito - débito = saldo próximo.
- Radar trabalhista: ocorrências, colaboradores impactados, evento principal e premissas.
- Fechamento mensal: horas por evento e competência.
- Turnover: admissões, desligamentos, total de colaboradores e rotatividade.

## DTO de Explicação

Cards críticos devem aceitar um bloco opcional `calculo`:

```json
{
  "formula": "(horasAusentesMinutos / horasPlanejadasMinutos) * 100",
  "base": "horasPlanejadasMinutos",
  "entradas": {
    "horasAusentesMinutos": 16065,
    "horasPlanejadasMinutos": 96360
  },
  "avisos": []
}
```

## Erros

A API deve retornar `ProblemDetails`:

```json
{
  "title": "Período inválido",
  "status": 400,
  "detail": "A data inicial deve ser menor ou igual à data final.",
  "traceId": "..."
}
```

## Migração Recomendada

1. Posição do dia.
2. Absenteísmo.
3. Radar trabalhista.
4. Banco de horas.
5. Fechamento mensal.
6. Turnover.

Enquanto um módulo estiver em `importacao`, seus dados não devem ser tratados como fonte
oficial para auditoria ou integração externa.
