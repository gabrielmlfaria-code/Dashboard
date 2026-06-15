import { Scale } from 'lucide-react';
import { formatDate } from '../../utils/formatters.js';
import styles from './AppShell.module.css';

export default function AppShell({ children }) {
  return (
    <div className={styles.shell}>
      <header className={styles.header}>
        <div className={styles.brand}>
          <Scale size={28} strokeWidth={2} aria-hidden />
          <div>
            <h1 className={styles.title}>ImpactoSeisX1</h1>
            <p className={styles.subtitle}>
              Impacto financeiro e conformidade — PEC escala 6x1
            </p>
          </div>
        </div>
      </header>
      <main className={styles.main}>{children}</main>
      <footer className={styles.footer}>
        Uso interno RH/DP e Diretoria · Atualizado em {formatDate()}
      </footer>
    </div>
  );
}
