import { AlertCircle } from 'lucide-react';
import styles from './AlertBanner.module.css';

export default function AlertBanner({ children }) {
  if (!children) return null;
  return (
    <div className={styles.banner} role="alert">
      <AlertCircle size={20} aria-hidden />
      <span>{children}</span>
    </div>
  );
}
