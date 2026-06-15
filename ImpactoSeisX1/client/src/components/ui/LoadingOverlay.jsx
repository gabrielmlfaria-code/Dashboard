import { Loader2 } from 'lucide-react';
import styles from './LoadingOverlay.module.css';

export default function LoadingOverlay({ ativo, texto = 'Processando…' }) {
  if (!ativo) return null;
  return (
    <div className={styles.overlay} aria-live="polite" aria-busy="true">
      <Loader2 size={32} className={styles.spinner} aria-hidden />
      <span>{texto}</span>
    </div>
  );
}
