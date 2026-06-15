import { useState } from 'react';
import AppShell from '../components/layout/AppShell.jsx';
import DropzoneUpload from '../components/upload/DropzoneUpload.jsx';
import ApiIntegracaoForm from '../components/integracao/ApiIntegracaoForm.jsx';
import KpiCards from '../components/kpi/KpiCards.jsx';
import AfetadosPieChart from '../components/charts/AfetadosPieChart.jsx';
import ImpactoPorDepartamentoChart from '../components/charts/ImpactoPorDepartamentoChart.jsx';
import DepartamentosTable from '../components/tabela/DepartamentosTable.jsx';
import AlertBanner from '../components/ui/AlertBanner.jsx';
import LoadingOverlay from '../components/ui/LoadingOverlay.jsx';
import { useImpacto } from '../hooks/useImpacto.js';
import { getTemplate } from '../services/api.js';
import styles from './DashboardPage.module.css';

export default function DashboardPage() {
  const [fase, setFase] = useState(1);
  const { dados, loading, erro, importarExcel, carregarDaApi } = useImpacto();

  const handleTemplate = async () => {
    try {
      await getTemplate();
    } catch {
      /* silencioso — usuário pode tentar novamente */
    }
  };

  return (
    <AppShell>
      <DropzoneUpload
        onArquivo={importarExcel}
        carregando={loading}
        onBaixarTemplate={handleTemplate}
      />

      <ApiIntegracaoForm onConsultar={carregarDaApi} carregando={loading} />

      <LoadingOverlay ativo={loading} />

      <AlertBanner>{erro}</AlertBanner>

      {dados && (
        <>
          <KpiCards kpi={dados} fase={fase} onFaseChange={setFase} />

          <div className={styles.charts}>
            <AfetadosPieChart kpi={dados} />
            <ImpactoPorDepartamentoChart
              porDepartamento={dados.porDepartamento}
              fase={fase}
            />
          </div>

          <DepartamentosTable porDepartamento={dados.porDepartamento} fase={fase} />
        </>
      )}

      {!dados && !erro && !loading && (
        <p className={styles.vazio}>
          Importe uma planilha ou consulte a API de jornadas para visualizar o impacto da
          PEC 6x1.
        </p>
      )}
    </AppShell>
  );
}
