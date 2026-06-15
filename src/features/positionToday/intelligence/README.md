# Diagnóstico operacional da posição do dia

V1 determinística para responder perguntas objetivas da posição do dia sem IA e sem backend.

## Escopo

- Usa somente dados já calculados na tela de posição do dia.
- Classifica a operação por cobertura: força atual / força prevista.
- Prioriza departamentos por déficit, ausências e atrasos.
- Oferece perguntas guiadas e respostas explicáveis.
- Trata `sem controle`, férias, folgas e afastamentos como contexto operacional, não como problema automático.

## Regra de status

- Normal: cobertura maior ou igual a 95%.
- Atenção: cobertura entre 90% e 94,9%.
- Comprometida: cobertura entre 80% e 89,9%.
- Crítica: cobertura abaixo de 80%.

## Fórmula de prioridade por departamento

```text
prioridade = (ausentes * 2) + atrasados + (déficit de cobertura * 3)
```

Essa regra é simples de auditar e suficiente para V1. A próxima evolução deve permitir pesos configuráveis por empresa.

## Limitações

- Não estima causa raiz profunda.
- Não interpreta regras jurídicas.
- Não cruza gestor quando o dado não existe na base recebida.
- Não usa dados pessoais sensíveis.
