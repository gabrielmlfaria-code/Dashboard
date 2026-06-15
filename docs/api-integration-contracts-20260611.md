# Contratos de integração HTTP do frontend

Data: 2026-06-11
Base URL: `CONFIG.API_BASE`, padrão `/api`.
Autenticação: não alterada. O `HttpClient` existente envia `Authorization: Bearer {accessToken}` automaticamente.

## Mapa Tela -> API

| Tela | Endpoint(s) | Tipo principal |
|---|---|---|
| Posição do Dia | `GET /posicao/dia`, `GET /posicao/historico` | `PosicaoDiaResumo`, histórico diário |
| Absenteísmo | `GET /absenteismo/resumo`, `GET /absenteismo/eventos`, `GET /absenteismo/grupos`, `GET /absenteismo/colaboradores` | `AbsenteismoResumo`, eventos paginados |
| Banco de Horas | `GET /banco-horas/resumo`, `GET /banco-horas/departamentos`, `GET /banco-horas/colaboradores` | `BancoHorasResumo`, `BancoHorasDepartamento` |
| Abonos | `GET /abonos/resumo`, `GET /abonos/departamentos`, `GET /abonos/colaboradores` | `AbonosResumo`, `AbonosDepartamento` |
| Fechamento Mensal | `GET /fechamento-mensal/eventos` | `FechamentoMensalEvento[]` |
| Turnover | `GET /turnover/resumo` | `TurnoverResumo` |
| Radar Trabalhista | `GET /radar-trabalhista/resumo` | `RadarTrabalhistaResumo` |
| Saúde Preventiva | `GET/POST /saude-preventiva/registros` | `SaudePreventivaRegistro[]` |
| NR-1 | `GET/POST /nr1/estado` | `Nr1Estado` |
| CCT | `GET/POST /cct/documentos` | `CctDocumento[]` |
| Radar Playbook | `GET/POST /radar-trabalhista/playbook/notas`, `GET /radar-trabalhista/playbook/auditoria` | `RadarPlaybookNotas`, log |

## Endpoints

### GET /posicao/dia

Origem: `src/api/posicaoApi.js`, `src/hooks/usePosicao.js`, `src/panels/posicao/PosicaoDiaPanel.jsx`.

Request:

- Headers: `Authorization: Bearer {accessToken}`.
- Query: `date?: yyyy-MM-dd`.
- Payload: nenhum.

Response:

| Campo | Tipo | Obrigatório | Descrição |
|---|---|---|---|
| data | string | sim | Data ISO do resumo |
| periodoApuracao | object | não | Período ativo `{ de, ate, fonte?, atualizadoEm? }` |
| presentes | number | sim | Quantidade presente |
| ausentes | number | sim | Quantidade ausente |
| atrasos | number | sim | Quantidade em atraso |
| ferias | number | sim | Quantidade em férias |
| afastados | number | sim | Quantidade afastada |
| totalPlanejado | number | sim | Total planejado |

### GET /posicao/historico

Origem: `src/api/posicaoApi.js`, `src/hooks/usePosicao.js`.

Request:

- Query: `days?: number`.

Response: lista/envelope de dias históricos. Campos consumidos: `date`, `total`, `faltas`, `atrasos`, `justificadas`, `horas_planejadas`, `horas_presentes`, `horas_faltas`, `horas_atrasos`, `horas_justificadas`, `horas_extras`, `_events`, `_employees`.

Validação: resposta parcialmente inferida pelo uso da UI; precisa contrato formal do backend.

### GET /absenteismo/resumo

Origem: `src/api/absenteismoApi.js`, `src/hooks/useAbsenteismo.js`.

Request:

- Query: `de`, `ate`, `filialId?`, `deptoId?`.

Response:

| Campo | Tipo | Obrigatório | Descrição |
|---|---|---|---|
| periodo | object | sim | `{ de, ate, fonte?, atualizadoEm? }` |
| horasPlanejadasMinutos | number | sim | Base planejada |
| horasTrabalhadasMinutos | number | sim | Horas trabalhadas |
| horasAusentesMinutos | number | sim | Horas ausentes |
| indicePercentual | number | sim | Índice de absenteísmo |
| metaPercentual | number | sim | Meta |
| calculo | object | não | Fórmula auditável |

### GET /absenteismo/eventos

Origem: `src/api/absenteismoApi.js`, `src/hooks/useAbsenteismo.js`, modais/tabelas.

Request:

- Query: `de`, `ate`, `page?`, `pageSize?`, `sortBy?`, `sortDir?`, `search?`, `categoria?`, `filial?`, `groupBy?`, `groupKey?`.

Response:

| Campo | Tipo | Obrigatório | Descrição |
|---|---|---|---|
| items | array | sim | Eventos paginados |
| total | number | sim | Total de registros |
| page | number | não | Página atual |
| pageSize | number | não | Tamanho da página |

Evento: campos consumidos incluem `matricula`, `nome`, `filial`, `departamento`, `cargo`, `codigoEvento`, `descricaoEvento`, `data`, `horasMinutos`, `categoria`.

### GET /absenteismo/grupos

Request: `de`, `ate`, `groupBy`.
Response: grupos normalizados por `normalizeGrupos`. Contrato final precisa confirmação do backend.

### GET /absenteismo/colaboradores

Request: filtros de período e paginação.
Response: colaboradores/eventos associados. Contrato final precisa confirmação do backend.

### GET /banco-horas/resumo

Origem: `src/api/bancoHorasApi.js`, `src/hooks/useDashboardApiData.js`.

Request: `de`, `ate`.

Response:

| Campo | Tipo | Obrigatório | Descrição |
|---|---|---|---|
| periodo | object | sim | Período |
| saldoAnteriorMinutos | number/null | sim | Saldo anterior |
| creditoMinutos | number | sim | Créditos |
| debitoMinutos | number | sim | Débitos |
| saldoProximoMinutos | number | sim | Saldo próximo |

### GET /banco-horas/departamentos

Request: `de`, `ate`, `top?`.

Response: array de:

| Campo | Tipo | Obrigatório |
|---|---|---|
| departamento | string | sim |
| saldoAnteriorMinutos | number/null | não |
| creditoMinutos | number | sim |
| debitoMinutos | number | sim |
| saldoProximoMinutos | number | sim |
| colaboradores | number | não |

### GET /banco-horas/colaboradores

Request: `de`, `ate`, `departamento?`, `page?`, `pageSize?`, `sortBy?`, `sortDir?`.

Response: `{ items, total, page?, pageSize? }`, item com `matricula`, `nome`, `filial`, `departamento`, `cargo`, `atividade`, `periodoInicial`, `periodoFinal`, `saldoAnteriorMinutos`, `creditoMinutos`, `debitoMinutos`, `saldoProximoMinutos`.

### GET /abonos/resumo

Origem: `src/api/abonosApi.js`, `src/hooks/useDashboardApiData.js`.

Request: `de`, `ate`, `status?`, `filialId?`, `deptoId?`.

Response esperada:

| Campo | Tipo | Obrigatório | Descrição |
|---|---|---|---|
| pendentes | number | sim | Abonos pendentes |
| efetuados | number | sim | Abonos efetuados |
| colaboradores | number | não | Colaboradores afetados |
| departamentos | number | não | Departamentos afetados |

Validação: contrato inferido; confirmar com backend.

### GET /abonos/departamentos

Request: `de`, `ate`, `status?`, `top?`.

Response: array de `{ departamento, pendentes, efetuados, sla? }`.

### GET /abonos/colaboradores

Request: `de`, `ate`, `status?`, `departamento?`, `page?`, `pageSize?`.

Response: página de colaboradores. Contrato ainda inferido.

### GET /fechamento-mensal/eventos

Origem: `src/api/fechamentoMensalApi.js`, `src/hooks/useDashboardApiData.js`.

Request: `de`, `ate`, `competencia?`.

Response: array de:

| Campo | Tipo | Obrigatório |
|---|---|---|
| codigoEvento | string | sim |
| descricaoEvento | string | sim |
| categoria | string/null | não |
| competencia | string yyyy-MM | sim |
| horasMinutos | number | sim |
| variacaoPercentual | number/null | não |

### GET /turnover/resumo

Origem: `src/api/turnoverApi.js`, `src/hooks/useDashboardApiData.js`.

Request: `de`, `ate`, `competenciaInicial?`, `competenciaFinal?`.

Response esperada:

```json
{
  "meses": [
    {
      "competencia": "2026-01",
      "desligados": 10,
      "admitidos": 12,
      "totalColaboradores": 380,
      "horistas": 200,
      "mensalistas": 170,
      "estagiarios": 10
    }
  ]
}
```

Validação: contrato inferido da UI.

### GET /radar-trabalhista/resumo

Origem: `src/api/radarTrabalhistaApi.js`, `src/hooks/useDashboardApiData.js`.

Request: `de`, `ate`, `filialId?`, `deptoId?`.

Response esperada:

```json
{
  "ocorrencias": 336,
  "colaboradores": 76,
  "principalEvento": {
    "label": "MAIS DE 6 HORAS SEM REFEICAO",
    "count": 92
  }
}
```

Validação: resumo migrado; workspace detalhado ainda usa dataset local de eventos.

### GET /saude-preventiva/registros

Origem: `src/api/saudePreventivaApi.js`, `src/panels/posicao/saude-preventiva/saudePreventivaStorage.js`.

Request: nenhum.

Response:

| Campo | Tipo | Obrigatório | Descrição |
|---|---|---|---|
| registros | SaudePreventivaRegistro[] | sim | Registros de comunicação/campanha |
| updatedAt | string | não | Última atualização |

Modelo:

```ts
interface SaudePreventivaRegistro {
  id: string | number;
  data: string;
  tema: string;
  canal: string;
  responsavel: string;
  colaboradores?: number | null;
  status: string;
  checklist?: Record<string, boolean>;
  publicoAlcance?: string;
  departamentos?: string;
  listaNominal?: string;
  art473Comunicado?: boolean;
  obs?: string;
  anexos?: Array<{ id: string; nome: string; tipo: string; tamanho: number }>;
}
```

### POST /saude-preventiva/registros

Request:

```json
{
  "registros": []
}
```

Response: mesmo formato do GET ou `{ "ok": true }`.

Validação: confirmar persistência transacional e endpoint de anexos.

### GET /nr1/estado

Origem: `src/api/nr1Api.js`, `src/panels/posicao/nr1/nr1Storage.js`, `Nr1Card.jsx`.

Response:

```ts
interface Nr1Estado {
  registros: Nr1Registro[];
  checkState: Record<string, boolean>;
  checklistMeta: Record<string, unknown>;
  cardsProg: Record<string, unknown>;
  updatedAt?: string;
}
```

`Nr1Registro`:

```ts
interface Nr1Registro {
  id: string | number;
  data: string;
  tipo: string;
  setor?: string;
  resp: string;
  part?: number | null;
  status: string;
  risco?: string;
  prazo?: string;
  desc?: string;
  anexos?: Array<{ id: string; nome: string; tipo: string; tamanho: number }>;
}
```

### POST /nr1/estado

Request:

```json
{
  "registros": [],
  "checkState": {},
  "checklistMeta": {},
  "cardsProg": {}
}
```

Response: mesmo formato do GET ou `{ "ok": true }`.

Validação: confirmar política de concorrência e versionamento.

### GET /cct/documentos

Origem: `src/api/cctApi.js`, `src/panels/posicao/posicaoCctStorage.js`.

Response:

```ts
interface CctDocumento {
  id: string;
  fileName: string;
  label?: string;
  status?: string;
  validFrom?: string | null;
  validUntil?: string | null;
  pageCount?: number | null;
  textChars?: number;
  analysisResult?: unknown;
}
```

### POST /cct/documentos

Request:

```json
{
  "documentos": []
}
```

Response: `{ "documentos": [] }` ou `{ "ok": true }`.

Validação: upload/download de PDF ainda requer endpoint multipart/binário.

### GET /radar-trabalhista/playbook/notas

Origem: `src/api/radarPlaybookApi.js`.

Request: `eventKey`.

Response:

```ts
interface RadarPlaybookNotas {
  eventKey: string;
  juridico?: string;
  rh?: string;
  clausulaCct?: string;
  updatedAt?: string | null;
  updatedBy?: string | null;
}
```

### POST /radar-trabalhista/playbook/notas

Request:

```json
{
  "eventKey": "mais-de-6-horas-sem-refeicao",
  "area": "juridico",
  "text": "Orientação revisada",
  "author": "Jurídico",
  "eventTitle": "MAIS DE 6 HORAS SEM REFEICAO"
}
```

Response: `RadarPlaybookNotas` ou `{ "ok": true }`.

### GET /radar-trabalhista/playbook/auditoria

Request: `eventKey?`, `limit?`.

Response:

```ts
interface RadarPlaybookAuditPage {
  items: Array<{
    id: string;
    ts: string;
    action: string;
    area: string;
    eventKey: string;
    eventTitle?: string;
    author?: string;
    preview?: string;
  }>;
}
```

## Variáveis de ambiente por módulo

Para usar API real por módulo:

```env
VITE_USE_MOCK=false
VITE_API_SOURCE=api
VITE_SOURCE_POSICAO=api
VITE_SOURCE_ABSENTEISMO=api
VITE_SOURCE_BANCO_HORAS=api
VITE_SOURCE_ABONOS=api
VITE_SOURCE_MENSAL=api
VITE_SOURCE_TURNOVER=api
VITE_SOURCE_RADAR=api
VITE_SOURCE_SAUDE_PREVENTIVA=api
VITE_SOURCE_NR1=api
VITE_SOURCE_CCT=api
VITE_SOURCE_RADAR_PLAYBOOK=api
```

## Inconsistências encontradas

1. `src/panels/posicao/api/*` duplica parte da camada oficial `src/api/*` e possui testes quebrados.
2. `src/api/apiContractFixtures.test.js` espera exports ainda inexistentes em `contracts.js`.
3. Alguns contratos ainda são inferidos pelo consumo de UI, principalmente `turnover`, `abonos`, `radar`, `cct` e grids detalhados.
4. Upload de anexos/PDF não está padronizado no `ApiService`; precisa decisão de `multipart/form-data` ou URLs pré-assinadas.
5. Arquivos `*-DESKTOP-GURKLA8.*` continuam no projeto e aparecem no build; devem ser removidos/arquivados em tarefa específica.
