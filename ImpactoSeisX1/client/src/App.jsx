import { useState } from 'react';
import UploadZone from './components/UploadZone.jsx';
import KPICards from './components/KPICards.jsx';
import GraficoBarras from './components/GraficoBarras.jsx';
import TabelaDepartamentos from './components/TabelaDepartamentos.jsx';
import { useImpacto } from './hooks/useImpacto.js';
import { formatDate } from './utils/formatters.js';
import styles from './App.module.css';

export default function App() {
  const { dados, loading, erro, importarExcel, carregarDaApi, resetar } = useImpacto();
  const [analysisDate] = useState(() => formatDate());

  const handleReset = () => {
    resetar();
  };

  if (!dados) {
    return (
      <div className={styles.app}>
        <UploadZone
          onFileSelect={importarExcel}
          onApiUrl={carregarDaApi}
          loading={loading}
          erro={erro}
        />
      </div>
    );
  }

  return (
    <div className={styles.app}>
      <div className={styles.dashboard}>
        <header className={styles.header}>
          <div>
            <h1 className={styles.title}>📊 Impacto PEC 6x1</h1>
            <p className={styles.meta}>Análise realizada em {analysisDate}</p>
          </div>
          <button
            type="button"
            className={styles.btnBack}
            onClick={handleReset}
            disabled={loading}
          >
            ← Nova análise
          </button>
        </header>

        {erro && (
          <p className={styles.erro} role="alert">
            {erro}
          </p>
        )}

        <KPICards dados={dados} />
        <GraficoBarras porDepartamento={dados.porDepartamento} />
        <TabelaDepartamentos porDepartamento={dados.porDepartamento} />
      </div>
    </div>
  );
}
