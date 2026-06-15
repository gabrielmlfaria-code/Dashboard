# ImpactoSeisX1

Sistema para medir o **impacto financeiro** e de **conformidade** da PEC que extingue a escala 6x1 no Brasil.

**Público:** RH/DP e Diretoria.

## Stack

| Camada | Tecnologia |
|--------|------------|
| API | .NET 10, C#, Minimal APIs |
| Planilhas | ClosedXML |
| Front (dev) | `http://localhost:5173` (CORS habilitado) |

## Estrutura de pastas

```
ImpactoSeisX1/
├── client/                        # React + Vite (porta 5173)
├── docs/                          # Documentação de negócio e API
├── src/
│   └── ImpactoSeisX1.Api/
│       ├── Endpoints/             # Mapas de rotas (Minimal API)
│       ├── Application/           # Casos de uso, DTOs, interfaces
│       │   ├── Dtos/
│       │   ├── Interfaces/
│       │   └── Services/
│       ├── Domain/                # Regras PEC 6x1, entidades, cálculos
│       │   ├── Calculo/
│       │   ├── Entities/
│       │   ├── Enums/
│       │   └── ValueObjects/
│       ├── Infrastructure/        # Excel, persistência, integrações
│       │   └── Excel/
│       ├── App_Data/              # Templates e uploads (dev)
│       │   ├── templates/
│       │   └── uploads/
│       └── Properties/
└── tests/
    └── ImpactoSeisX1.Tests/       # Testes unitários
```

## Executar (após instalar .NET 10 SDK)

```bash
cd ImpactoSeisX1
dotnet restore
dotnet run --project src/ImpactoSeisX1.Api
```

Swagger: `http://localhost:5000/swagger`

### Endpoints

| Método | Rota | Descrição |
|--------|------|-----------|
| POST | `/api/impacto/importar` | Upload `.xlsx` (`multipart/form-data`, campo `arquivo`) |
| GET | `/api/impacto/template` | Download do modelo Excel |
| GET | `/api/impacto/from-api?baseUrl={url}` | Integração `{baseUrl}/api/funcionarios/jornadas` |

### Regras de negócio (resumo)

- Afetados: escala `6x1` | Não afetados: `12x36`, `5x2`
- `CustoHora = SalarioMensal / 220`
- `ImpactoMensal = (44 - novoLimite) × CustoHora × 4.33`
- Fase 1: 42h | Fase 2: 40h (após 12 meses)
- Risco por departamento: ≥70% Alto | ≥40% Médio | &lt;40% Baixo

### Frontend

```bash
cd client && npm install && npm run dev
```

Ver `client/README.md` para a árvore de componentes.
