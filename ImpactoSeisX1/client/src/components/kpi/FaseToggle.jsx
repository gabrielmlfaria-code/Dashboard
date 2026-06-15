import styles from './FaseToggle.module.css';

export default function FaseToggle({ fase, onChange }) {
  return (
    <div className={styles.grupo} role="group" aria-label="Fase da PEC">
      <button
        type="button"
        className={fase === 1 ? styles.ativo : styles.btn}
        onClick={() => onChange(1)}
      >
        Fase 1 — 42h
      </button>
      <button
        type="button"
        className={fase === 2 ? styles.ativo : styles.btn}
        onClick={() => onChange(2)}
      >
        Fase 2 — 40h
      </button>
    </div>
  );
}
