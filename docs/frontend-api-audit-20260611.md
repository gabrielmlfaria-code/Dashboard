# Auditoria frontend: fontes de dados e migração para API

Data: 2026-06-11
Escopo: `src/`, exceto arquivos `*-DESKTOP-*`, `*.test.*`, `node_modules`, `dist` e backups.
Restrição aplicada: autenticação não foi alterada.

## Backup

Backup antes da execução:

`C:\Users\User\OneDrive - Macchips Informática\AbsenteismoV6\_backups\AbsenteismoV6-pre-full-api-audit-20260611-154207.zip`

Tamanho: 204,34 MB.

## Padrão oficial encontrado

O padrão ativo do projeto para API é:

- Rotas centralizadas em `src/api/apiRoutes.js`.
- Chamadas por `src/api/apiService.js`.
- Transporte por `src/api/adapters/remoteApiAdapter.js` e `src/core/httpClient.js`.
- Seleção de fonte por módulo em `src/api/apiMode.js` + `CONFIG.MODULE_SOURCES`.
- Hooks com TanStack Query em `src/hooks/*.js`.
- Validação de contrato com `zod` em `src/api/contracts.js` ou schema local do client.

Não foi criado padrão novo.

## Inventário por tela

| Tela | Rota | Componente principal | Origem antes | Classificação anterior | Origem após execução | Status |
|---|---|---|---|---|---|---|
| Dashboard / Posição do Dia | `/` | `src/panels/posicao/PosicaoDiaPanel.jsx` | `usePosicaoDia`, `usePosicaoHistorico`, mocks se `USE_MOCK=true`, planilha importada como fallback | API real + Mock + Planilha | API real para posição/absenteísmo; módulos adicionais conectados por `useDashboardApiData` | Parcialmente migrado |
| Absenteísmo | `/` | `PosicaoBentoHeader.jsx`, `HistoricoTable.jsx`, `AbsenteismoResumoCard.jsx` | API real + cálculo local de histórico | API real | Mantido API real; sem alteração de auth | OK |
| Histórico / Grid | `/` | `HistoricoTable.jsx`, `HistoricoDayModal.jsx` | Histórico API/importação; preferências em localStorage | API real + Planilha + UI storage | Mantido | OK |
| Banco de Horas | `/` | `BancoHorasCard`, inline em `PosicaoBentoHeader.jsx` | `localStorage`/planilha via `loadKpiBancoHoras` | Planilha + LocalStorage | API via `BancoHorasApi` quando módulo `bancoHoras=api`; fallback local fora de API | Migrado |
| Fechamento Mensal | `/` | `MensalListCard` | `localStorage`/planilha via `loadKpiMensal` | Planilha + LocalStorage | API via `FechamentoMensalApi` quando `mensal=api`; fallback local fora de API | Migrado |
| Turnover | `/` | bloco Turnover em `PosicaoBentoHeader.jsx` | CSV/localStorage via `loadKpiTurnover` | CSV + LocalStorage | API via `TurnoverApi` quando `turnover=api`; fallback local fora de API | Migrado |
| Radar Trabalhista - resumo | `/` | card Radar em `PosicaoBentoHeader.jsx` | `histRows`/planilha/cálculo local | Planilha + cálculo local | API via `RadarTrabalhistaApi` quando `radar=api`; fallback local fora de API | Migrado no resumo |
| Radar Trabalhista - workspace | `/` | `RadarTrabalhistaShell.jsx` | dataset local de `histRows`, CCT local, notas localStorage | Planilha + LocalStorage + IndexedDB | Client criado para notas; resumo API disponível; workspace detalhado ainda exige endpoints adicionais | Parcial |
| Abonos | `/` | `AbonosDeptPanel.jsx` | planilha/localStorage via `loadKpiAbonos` | Planilha + LocalStorage | API via `AbonosApi` quando `abonos=api`; fallback local fora de API | Migrado |
| NR-1 | `/nr-1` | `Nr1Card.jsx` | localStorage + IndexedDB para anexos + backup JSON | LocalStorage + IndexedDB + JSON local | API via `Nr1Api` quando `nr1=api`; cache local espelha API | Migrado para estado principal |
| Saúde Preventiva | `/saude-preventiva` | `SaudePreventivaCard.jsx` | IndexedDB/localStorage + backup JSON | LocalStorage + IndexedDB + JSON local | API via `SaudePreventivaApi` quando `saudePreventiva=api`; cache local espelha API | Migrado para registros |
| CCT/PDF | dentro do Radar | `RadarCctView.jsx`, `posicaoCctStorage.js` | PDF local em IndexedDB/OPFS/memory + índice localStorage/sessionStorage | IndexedDB + LocalStorage + PDF local | Índice/metadados via `CctApi` quando `cct=api`; upload binário pendente | Parcial |
| Assistente NL | `/` | `DashboardNlAskPanel.jsx` | contexto calculado do dashboard, histórico em sessionStorage | Derivado local + UI storage | Sem mudança de fonte; consome contexto atualizado por API quando painel usa API | OK derivado |
| Calculadora de Horas | `/` | `HorasCalculadora.jsx`, `HorasCalcModal.jsx` | localStorage | LocalStorage | Mantido local por ser ferramenta de cálculo do usuário | Requer decisão |
| Configuração de categorias de horas | `/` | `HorasConfigModal.jsx` | localStorage | LocalStorage | Mantido local | Requer endpoint se corporativo |
| Preferências/layout/tema | várias | `WindowManager`, `pbViewStorage`, `HistoricoTable`, `PosicaoExcelGrid` | localStorage/sessionStorage | UI storage | Mantido, não é dado de negócio | OK |

## Mocks encontrados

| Arquivo | Uso | Ação recomendada |
|---|---|---|
| `src/mocks/mockPosicao.js` | Registra mocks para `/posicao/dia` e `/posicao/historico` quando `CONFIG.USE_MOCK=true` | Manter somente desenvolvimento; configurar produção com `VITE_USE_MOCK=false` e `VITE_API_SOURCE=api` |
| `src/mocks/mockAbsenteismo.js` | Registra mocks para `/absenteismo/*` quando `CONFIG.USE_MOCK=true` | Mesma regra acima |
| `src/routes/index.tsx` | Importa mocks condicionalmente por `CONFIG.USE_MOCK` | OK se ambiente estiver correto |
| `mock/absenteismo-dashboard-mock.html` | Protótipo estático | Não usado em runtime |
| CSS com nome `mock` | Tokens/classes visuais legadas | Não é fonte de dados |

## Dados locais/planilhas encontrados

| Área | Arquivos principais | Tipo | Situação |
|---|---|---|---|
| Importação de posição/histórico | `posicaoImport.js`, `posicaoDataBackup.js`, `PosicaoDiaPanel.jsx` | XLSX + IndexedDB/localStorage | Fallback/importação operacional; API principal já existe |
| Banco de Horas | `banco-horas/bancoHoras.js` | XLSX/localStorage | API conectada via `BancoHorasApi` |
| Abonos | `abonos/abonosDept.js` | XLSX/CSV/localStorage | API conectada via `AbonosApi` |
| Fechamento Mensal | `mensal/mensal.js` | planilha/localStorage | API conectada via `FechamentoMensalApi` |
| Turnover | `turnover/turnoverData.js`, inline legado em `PosicaoBentoHeader.jsx` | CSV/localStorage | API conectada via `TurnoverApi` |
| NR-1 | `nr1/nr1Storage.js` | localStorage + anexos IndexedDB | Estado principal conectado via `Nr1Api` |
| Saúde Preventiva | `saude-preventiva/saudePreventivaStorage.js` | IndexedDB/localStorage + backup JSON | Registros conectados via `SaudePreventivaApi` |
| CCT | `posicaoCctStorage.js`, `posicaoCctDb.js` | PDF local + índice local | Índice conectado via `CctApi`; upload PDF pendente |
| Playbook Radar | `rtPlaybookNotesStorage.js` | localStorage | Client criado; UI ainda síncrona/local |

## Dados gerados localmente

| Arquivo | Uso | Observação |
|---|---|---|
| `SaudePreventivaCard.jsx` | `Math.random()` para id temporário de anexo | Não é dado de indicador; ideal migrar para id do backend após upload |
| `Nr1Card.jsx` | `Math.random()` para id temporário de anexo | Mesmo caso |
| `posicaoCctStorage.js` | fallback de id quando `crypto.randomUUID` não existe | Aceitável até backend gerar id |
| `HorasConfigModal.jsx` | id local de categorias/importações | Requer endpoint se configuração for corporativa |
| `rtPlaybookNotesStorage.js` | id de log local | Requer endpoint de auditoria para produção |
| `components/ui/sidebar.tsx` | largura aleatória de skeleton | Apenas UI placeholder, não dado de negócio |

## APIs implementadas nesta execução

| Módulo | Arquivo client | Rotas |
|---|---|---|
| Saúde Preventiva | `src/api/saudePreventivaApi.js` | `GET/POST /saude-preventiva/registros` |
| NR-1 | `src/api/nr1Api.js` | `GET/POST /nr1/estado` |
| CCT | `src/api/cctApi.js` | `GET/POST /cct/documentos` |
| Radar Playbook | `src/api/radarPlaybookApi.js` | `GET/POST /radar-trabalhista/playbook/notas`, `GET /radar-trabalhista/playbook/auditoria` |
| Abonos | `src/api/abonosApi.js` | `GET /abonos/resumo`, `/abonos/departamentos`, `/abonos/colaboradores` |
| Fechamento Mensal | `src/api/fechamentoMensalApi.js` | `GET /fechamento-mensal/eventos` |
| Turnover | `src/api/turnoverApi.js` | `GET /turnover/resumo` |
| Radar Trabalhista | `src/api/radarTrabalhistaApi.js` | `GET /radar-trabalhista/resumo` |

## Pontos que ainda exigem validação manual/backend

1. Confirmar se as URLs propostas para NR-1, Saúde Preventiva, CCT e Radar Playbook serão aceitas no ASP.NET.
2. Definir endpoint de upload/download binário para anexos de NR-1, Saúde Preventiva e PDFs CCT.
3. Decidir se Calculadora de Horas e Configuração de Categorias são dados pessoais locais ou corporativos.
4. Validar se `VITE_API_SOURCE=api` em produção e `VITE_USE_MOCK=false`.
5. Remover arquivos `*-DESKTOP-GURKLA8.*` duplicados em tarefa separada, pois aparecem em build e testes.
6. Revisar contratos antigos da pasta `src/panels/posicao/api`, que têm testes quebrados e duplicam a camada `src/api`.
