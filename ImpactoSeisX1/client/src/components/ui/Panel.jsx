import styles from './Panel.module.css';

/**
 * Painel base do tema escuro (card / seção).
 * @param {{ title?: import('react').ReactNode; action?: import('react').ReactNode; children: import('react').ReactNode; className?: string }}
 */
export default function Panel({ title, action, children, className = '' }) {
  return (
    <section className={`${styles.panel} ${className}`.trim()}>
      {(title || action) && (
        <div className={styles.header}>
          {title && <div className={styles.title}>{title}</div>}
          {action && <div className={styles.action}>{action}</div>}
        </div>
      )}
      {children}
    </section>
  );
}
