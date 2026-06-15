## Objetivo

1. Cadastrar **Força Prevista por departamento** (única fonte da verdade).
2. **Remover** o campo de Força Prevista global do modal de Configurações.
3. Multi-select de **variáveis** no gráfico por depto (Força Prevista, Força Atual, Vagas, Faltas, Atrasos, Folgas, Férias, Afastados, Entrada Prevista, Já Saíram, Presentes).
4. Multi-select de **departamentos** exibidos no gráfico.
5. **Aumentar o espaço dos nomes** dos deptos no gráfico + **tooltip com a descrição completa**.
6. Quando a Força Prevista de um depto **estiver vazia**, considerar a quantidade de **colaboradores ativos** desse depto para efeito de visualização (fallback por linha).

---

## Parte 1 — Tela "Força Prevista por Departamento"

- Novo botão no header (`PosicaoBentoHeader.jsx`) ao lado de Configurações: 🎯 **Força Prevista por Depto**.
- Modal (mesmo padrão `createPortal`) com tabela: **Departamento** | **Prevista** | limpar linha. Busca, "Importar XLSX" (depto/prevista), Cancelar/Limpar tudo/Salvar; rodapé mostra a soma.
- Persistência: `localStorage.mp_forca_prevista_depto` = `{ [deptoKey]: number }`.

### Regras de cálculo (NOVO / atualizado)

- **Por depto** (`deptRows[i].prevista`):
  - Se `mapa[depto] > 0` → usar esse valor.
  - Senão → usar `ativos_dept` (colaboradores ativos do depto). Marcar a célula como "estimado" (estilo discreto, ex.: itálico + tooltip "estimado por ativos").
- `vagas_dept = max(0, prevista_dept_efetiva - ativos_dept)` → quando o valor cai no fallback, vagas = 0 naturalmente.
- **Total** (`metrics.prevista`):
  - Soma das `prevista_dept_efetiva` (mistura valores cadastrados + fallback de ativos).
  - O hero "Força Prevista" passa a refletir essa soma.

---

## Parte 2 — Remover Força Prevista global das Configurações

- Em `PosicaoBentoHeader.jsx`: remover do modal de Configurações o campo "Força de trabalho prevista" e os handlers `onSaveForcaPrevista` / `onClearForcaPrevista` ligados a esse campo.
- Em `PosicaoDiaPanel.jsx`: remover state `forcaPrevistaConfig` e a chave `localStorage.mp_forca_prevista` (com migração: se existir e o mapa por depto estiver vazio, **descartar** silenciosamente — não tentar distribuir).
- O cálculo de `metrics.prevista` e `metrics.vagas` passa a depender exclusivamente do mapa por depto (com o fallback descrito na Parte 1).

---

## Parte 3 — Multi-select de variáveis no gráfico

- `deptMetric` (string) → `deptMetrics` (array). Default `['presentes']`. Migração de `pos_dept_metric` → `pos_dept_metrics`.
- Chart.js com **barras agrupadas**, um dataset por variável (paleta existente estendida); tooltip com soma.
- `deptOrder` ordena pela soma das variáveis selecionadas.
- Tabela do modal: uma coluna por variável + **Total**.

---

## Parte 4 — Filtro multi de departamentos no gráfico

- Multi-select acima do seletor de variáveis: busca, "Selecionar todos", "Limpar", resumo "X de N".
- Default: todos. Vazio = todos.
- Persistência: `pos_dept_filter` (array). Independente do `deptoFilter` global do header.

---

## Parte 5 — Espaço maior + tooltip nos nomes dos deptos

- Eixo Y do gráfico horizontal: `scales.y.ticks.padding`, `afterFit` reservando ~220px, `font.size` maior, callback de label permitindo até 2 linhas com "…" no overflow.
- Tooltip:
  - Barras: `tooltip.callbacks.title` retorna a descrição completa (`depto_desc`).
  - Eixo: overlay absoluto sobre cada tick (`chart.scales.y.getPixelForTick(i)`) com `title=` nativo + tooltip estilizado no `mouseenter`.
  - Tabela: `title=` + `text-overflow: ellipsis` controlado.
- Acessibilidade: `aria-label` nas barras com a descrição completa.
- Ajustes em `posicao-bento.css` (largura/altura/padding do wrapper e overlay).

---

## Arquivos alterados

- `src/panels/posicao/PosicaoBentoHeader.jsx`
  - Novo botão e modal "Força Prevista por Depto".
  - Remoção do campo global de Força Prevista do modal de Configurações.
- `src/panels/posicao/PosicaoDiaPanel.jsx`
  - Novo state `forcaPrevistaDeptoMap` + persistência.
  - Remoção de `forcaPrevistaConfig` e da chave `mp_forca_prevista`.
  - `metrics.prevista` e `deptRows.prevista` com fallback para ativos por depto; flag `prevista_estimada` por linha.
  - `deptMetric` → `deptMetrics` (array) + migração.
  - Novo state `deptChartFilter` + persistência.
  - Refator do `useEffect` do `barChartRef`: múltiplos datasets, filtro de deptos, eixo Y maior com quebra/elipse, tooltips com nome completo.
  - Tabela do modal com colunas dinâmicas e tooltip/ellipsis nos nomes; estilo "estimado" para previsões em fallback.
- `src/panels/posicao/posicao-bento.css`
  - Estilos do novo modal, chips do multi-select, wrapper do gráfico e overlay de tooltip dos rótulos, indicador de valor "estimado".

## Compatibilidade

- Migrações: `mp_forca_prevista` é descartada; `pos_dept_metric` migra para `pos_dept_metrics`.
- Sem mudanças de backend (apenas localStorage).

---

## Resumo visual

```text
Hero
└── Força Atual: 1.842   Força Prevista: 2.140  (soma cadastrada + fallback)
                                              ↑ valores em fallback marcados na tabela

Modal Gráfico por Depto
┌────────────────────────────────────────────────────────────────┐
│ Departamentos: [▼ 18/20]   Variáveis: ☑ Presentes ☑ F.Prevista │
├────────────────────────────────────────────────────────────────┤
│ Administrativo Geral…│████████ 120  ░░ 120(est.)              │
│ Produção - Linha A   │██████   95   ████ 140                  │
│ ...                  │                                          │
└────────────────────────────────────────────────────────────────┘
   ↑ nomes maiores, até 2 linhas, hover mostra descrição completa
```
