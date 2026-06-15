# ImpactoSeisX1 — Frontend

React (JSX) + Vite, sem biblioteca de UI.

## Scripts

| Comando | Ação |
|---------|------|
| `npm run dev` | Dev server (porta 5173) |
| `npm run build` | Build de produção |
| `npm run preview` | Preview do build |

## Dependências

axios · recharts · react-dropzone · lucide-react

## Módulos principais

| Arquivo | Responsabilidade |
|---------|------------------|
| `src/utils/formatters.js` | `formatBRL`, `formatPercent`, `formatFTE`, `formatDate` |
| `src/services/api.js` | `postImportarExcel`, `getFromApiPonto`, `getTemplate` |
| `src/hooks/useImpacto.js` | `dados`, `loading`, `erro`, `importarExcel`, `carregarDaApi`, `resetar` |

## Proxy

`vite.config.js` encaminha `/api` → `http://localhost:5000` (a instância axios usa a URL base direta).

## Executar

```bash
npm install
npm run dev
```

API em http://localhost:5000 · UI em http://localhost:5173
