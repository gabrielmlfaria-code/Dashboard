import { formatBRL, formatFTE, formatPercent } from '../utils/formatters.js';
import styles from './KPICards.module.css';

const CARDS = [
  { key: 'total', emoji: '👥', label: 'Total Funcionários', border: 'blue' },
  { key: 'afetados', emoji: '⚠️', label: 'Afetados', border: 'red' },
  { key: 'naoAfetados', emoji: '✅', label: 'Não Afetados', border: 'green' },
  { key: 'fase1', emoji: '💰', label: 'Impacto Mensal Fase 1 (42h)', border: 'yellow' },
  { key: 'fase2', emoji: '💸', label: 'Impacto Mensal Fase 2 (40h)', border: 'redDark' },
  { key: 'headcount', emoji: '🧑‍💼', label: 'Headcount Necessário', border: 'purple' },
];

function getCardValue(key, dados) {
  switch (key) {
    case 'total':
      return String(dados.totalFuncionarios);
    case 'afetados':
      return `${dados.afetadosPEC} (${formatPercent(dados.percentualAfetados)})`;
    case 'naoAfetados':
      return String(dados.naoAfetados);
    case 'fase1':
      return formatBRL(dados.impactoFinanceiroMensalFase1);
    case 'fase2':
      return formatBRL(dados.impactoFinanceiroMensalFase2);
    case 'headcount':
      return formatFTE(dados.headcountNecessarioFase1);
    default:
      return '—';
  }
}

/** @param {{ dados: object }} */
export default function KPICards({ dados }) {
  return (
    <div className={styles.grid}>
      {CARDS.map((card) => (
        <article
          key={card.key}
          className={styles.card}
          data-border={card.border}
        >
          <span className={styles.emoji} aria-hidden>
            {card.emoji}
          </span>
          <p className={styles.label}>{card.label}</p>
          <p className={styles.value}>{getCardValue(card.key, dados)}</p>
        </article>
      ))}
    </div>
  );
}
