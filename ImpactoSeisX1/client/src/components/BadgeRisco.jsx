import styles from './BadgeRisco.module.css';

const STYLES = {
  Alto: { bg: '#ef444433', text: '#ef4444' },
  Médio: { bg: '#f59e0b33', text: '#f59e0b' },
  Baixo: { bg: '#22c55e33', text: '#22c55e' },
};

/** @param {{ nivel: 'Alto' | 'Médio' | 'Baixo' | string }} */
export default function BadgeRisco({ nivel }) {
  const palette = STYLES[nivel] ?? STYLES.Baixo;

  return (
    <span
      className={styles.badge}
      style={{ background: palette.bg, color: palette.text }}
    >
      {nivel}
    </span>
  );
}
