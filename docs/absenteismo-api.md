# API Absenteísmo / Histórico de eventos

Contrato para integração do dashboard React com API **.NET 10** e **SQL Server**.

Base URL sugerida: `/api/absenteismo`

---

## Convenções

| Item | Valor |
|------|--------|
| Datas | `YYYY-MM-DD` (`date` / `DateOnly`) |
| Paginação | `page` (1-based), `pageSize` (padrão 200, máx. 500) |
| Ordenação | `sort`, `dir` (`asc` \| `desc`) |
| Resposta paginada | `{ items, total, page, pageSize, totais? }` |
| Intervalo máximo | 180 dias (validar na API) |

### Cabeçalhos

- `Authorization: Bearer {token}` (mesmo padrão do restante do sistema de ponto)
- Respostas `application/json; charset=utf-8`

---

## 1. Resumo do período (gráficos / cards / tabela por dia)

```http
GET /api/absenteismo/resumo?de=2025-05-20&ate=2026-05-15&filialId=&deptoId=
```

**Response 200**

```json
{
  "de": "2025-05-20",
  "ate": "2026-05-15",
  "dias": [
    {
      "data": "2025-05-20",
      "total": 420,
      "presentes": 380,
      "faltas": 25,
      "atrasos": 10,
      "justificadas": 5,
      "horasPresentes": 182400,
      "horasPlanejadas": 201600,
      "horasFaltas": 12000,
      "horasExtras": 3200
    }
  ],
  "totais": {
    "eventos": 378245,
    "colaboradores": 1240
  }
}
```

---

## 2. Colaboradores agregados (opcional — visão por matrícula)

```http
GET /api/absenteismo/colaboradores?de=...&ate=...&page=1&pageSize=100&sort=nome&dir=asc&search=&filialId=&deptoId=
```

**Response 200**

```json
{
  "items": [
    {
      "matricula": "10042",
      "nome": "Ana Costa",
      "filial": "SP - SBC",
      "departamento": "Produção",
      "cargo": "Operador",
      "diasPresentes": 220,
      "diasAusentes": 8,
      "horasPresentes": 105600,
      "horasAusentes": 3840,
      "horasExtras": 1200
    }
  ],
  "total": 1240,
  "page": 1,
  "pageSize": 100
}
```

---

## 3. Eventos paginados (grid do modal — principal)

```http
GET /api/absenteismo/eventos?de=2025-05-20&ate=2026-05-15&page=1&pageSize=200&sort=data&dir=desc&search=&categoria=&filialId=&filial=&deptoId=&matricula=&groupBy=&groupKey=
```

| Parâmetro | Descrição |
|-----------|-----------|
| `categoria` | `presentes`, `ausentes`, `justificadas`, `extras`, `noturnas`, `risco`, `ignorar` |
| `search` | Nome, matrícula, código, evento, filial |
| `filial` / `filialId` | Filtro de filial (texto ou id) |
| `groupBy` + `groupKey` | Drill-down ao expandir grupo (ex.: `filial` + `SP - SBC`) |

**Response 200**

```json
{
  "items": [
    {
      "matricula": "10042",
      "nome": "Ana Costa",
      "filial": "SP - SBC",
      "departamento": "Produção",
      "cargo": "Operador",
      "data": "2025-06-10",
      "horario": "08:00 - 17:00",
      "marcacao": "07:58 12:01 13:00 17:05",
      "codigo": "001",
      "evento": "Hora Normal",
      "minutos": 480,
      "categoria": "presentes"
    }
  ],
  "total": 378245,
  "page": 1,
  "pageSize": 200,
  "totais": {
    "horas": 15234000,
    "horasPlanejadas": 16000000,
    "horasPresentes": 14000000,
    "horasAusentes": 800000
  }
}
```

---

## 4. Grupos (agrupamento por coluna)

```http
GET /api/absenteismo/grupos?de=...&ate=...&groupBy=filial&search=&categoria=&filialId=&deptoId=
```

`groupBy`: `filial` | `depto` | `cargo` | `mat` | `_cat` (categoria)

**Response 200**

```json
{
  "groupBy": "filial",
  "items": [
    {
      "key": "SP - SBC",
      "label": "SP - SBC",
      "count": 125000,
      "colaboradores": 420,
      "horas": 5200000,
      "horasPlanejadas": 5400000
    }
  ],
  "total": 4
}
```

Ao expandir um grupo, o front chama `/eventos` com `groupBy=filial&groupKey=SP - SBC&page=1`.

---

## 5. Exportação (futuro)

```http
GET /api/absenteismo/export?de=...&ate=...&format=xlsx
```

Retorno: `application/octet-stream` ou job assíncrono com URL.

---

## Códigos de erro

| HTTP | Corpo |
|------|--------|
| 400 | `{ "message": "Intervalo máximo 180 dias" }` |
| 401 | Não autenticado |
| 403 | Sem permissão para filial |
| 500 | Erro interno |

---

## SQL Server (orientação)

```sql
-- Índice sugerido na fato de apontamentos
CREATE NONCLUSTERED INDEX IX_Apon_Data_Filial_Mat
ON dbo.Apontamento (DataReferencia, FilialId, Matricula)
INCLUDE (CodigoEvento, Minutos, DepartamentoId, Cargo);

-- Paginação
ORDER BY DataReferencia DESC, Matricula
OFFSET @offset ROWS FETCH NEXT @pageSize ROWS ONLY;
```

Agregações (`resumo`, `grupos`) devem usar `GROUP BY` no SQL, não no C# em memória.

---

## Frontend (este repositório)

| Arquivo | Função |
|---------|--------|
| `src/api/absenteismoApi.js` | Cliente HTTP |
| `src/api/absenteismoNormalize.js` | DTO → modelo do grid |
| `src/hooks/useAbsenteismo.js` | React Query |
| `src/hooks/useHistoricoDayModalApi.js` | Estado do modal em modo API |
| `src/mocks/mockAbsenteismo.js` | Mock paginado (dev) |

Ativar modo API no modal: `VITE_ABSENTEISMO_API=true` no `.env` ou `config.js`.
