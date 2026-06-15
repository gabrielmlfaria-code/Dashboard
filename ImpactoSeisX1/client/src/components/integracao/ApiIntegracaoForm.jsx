import { useState } from 'react';
import { Link2 } from 'lucide-react';
import Panel from '../ui/Panel.jsx';
import styles from './ApiIntegracaoForm.module.css';

export default function ApiIntegracaoForm({ onConsultar, carregando }) {
  const [baseUrl, setBaseUrl] = useState('http://localhost:5000');

  const handleSubmit = (e) => {
    e.preventDefault();
    onConsultar(baseUrl.trim());
  };

  return (
    <Panel
      title={
        <span className={styles.tituloLinha}>
          <Link2 size={20} />
          Integração via API
        </span>
      }
    >
      <form className={styles.form} onSubmit={handleSubmit}>
        <label className={styles.label} htmlFor="baseUrl">
          URL base do sistema de jornadas
        </label>
        <div className={styles.linha}>
          <input
            id="baseUrl"
            type="url"
            className={styles.input}
            value={baseUrl}
            onChange={(e) => setBaseUrl(e.target.value)}
            placeholder="https://sua-empresa.com.br"
            required
          />
          <button type="submit" className={styles.btn} disabled={carregando}>
            {carregando ? 'Consultando…' : 'Calcular impacto'}
          </button>
        </div>
        <p className={styles.hint}>
          Consulta <code>{'{baseUrl}'}/api/funcionarios/jornadas</code>
        </p>
      </form>
    </Panel>
  );
}
