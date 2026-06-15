# Planilha de custos — IA no Radar Trabalhista

## Arquivo

- **`planilha-custos-ia-radar.csv`** — abrir no Excel ou Google Planilhas.

## Como abrir no Excel (Brasil)

1. Excel → **Dados** → **De texto/CSV** (ou Arquivo → Abrir).
2. Selecione o arquivo `planilha-custos-ia-radar.csv`.
3. Delimitador: **ponto e vírgula (;)**.
4. Codificação: **UTF-8**.

Se os números não separarem colunas, use **Dados → Texto para colunas** com delimitador `;`.

## O que editar

Na seção **PREMISSAS**:

| Campo | Padrão | Uso |
|-------|--------|-----|
| Câmbio USD → BRL | 5,50 | Multiplicador BRL |
| Dias úteis | 22 | Cenário A |
| Dias calendário | 30 | Cenário B |
| Tokens entrada/saída insight | 1500 / 400 | Recalcula USD por insight |

Depois de alterar premissas, recalcule manualmente ou peça nova versão da planilha com fórmulas Excel (`.xlsx`).

## Cenários de gestores

| Gestores | Insights/mês (22d) | Insights/mês (30d) |
|----------|-------------------|-------------------|
| 10 | 220 | 300 |
| 50 | 1.100 | 1.500 |
| 200 | 4.400 | 6.000 |

## Recomendação resumida

| Uso | Modelo | Custo 200 gestores (22d, só insight) |
|-----|--------|--------------------------------------|
| Produção | Azure OpenAI — GPT-4o mini | ~R$ 11/mês |
| POC barato | Gemini Flash-Lite ou DeepSeek | ~R$ 8–10/mês |
| Relatório mensal RH | Claude Sonnet (poucos/mês) | +R$ 56/mês (200 gestores) |

**Insight + relatório Sonnet (200 gestores, 22d):** ~**R$ 310/mês** (~R$ 3.722/ano) — ainda baixo frente a licenças de RH; validar LGPD antes de DeepSeek em produção.

## Fórmulas (referência)

**USD por insight:**

```
(entrada_tokens / 1_000_000 × preço_entrada) + (saída_tokens / 1_000_000 × preço_saída)
```

**USD/mês:**

```
gestores × dias × insights_por_dia × USD_por_insight
```

**BRL/mês:**

```
USD/mês × câmbio
```
