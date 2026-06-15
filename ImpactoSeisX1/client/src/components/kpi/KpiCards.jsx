import { AlertTriangle, DollarSign, TrendingUp, UserPlus, Users, UserX } from 'lucide-react';
import { formatBRL, formatFTE, formatPercent } from '../../utils/formatters.js';
import Panel from '../ui/Panel.jsx';
import FaseToggle from './FaseToggle.jsx';
import styles from './KpiCards.module.css';

export default function KpiCards({ kpi, fase, onFaseChange }) {
  const impacto =
    fase === 1 ? kpi.impactoFinanceiroMensalFase1 : kpi.impactoFinanceiroMensalFase2;
  const headcount =
    fase === 1 ? kpi.headcountNecessarioFase1 : kpi.headcountNecessarioFase2;

  const cards = [
    { rotulo: 'Funcionários', valor: String(kpi.totalFuncionarios), icone: Users, accent: 'blue' },
    {
      rotulo: 'Afetados pela PEC',
      valor: String(kpi.afetadosPEC),
      icone: AlertTriangle,
      accent: 'red',
      destaque: true,
    },
    { rotulo: 'Não afetados', valor: String(kpi.naoAfetados), icone: UserX, accent: 'green' },
    {
      rotulo: '% afetados',
      valor: formatPercent(kpi.percentualAfetados),
      icone: TrendingUp,
      accent: 'yellow',
    },
    {
      rotulo: `Impacto mensal (fase ${fase})`,
      valor: formatBRL(impacto),
      icone: DollarSign,
      accent: 'yellow',
      largo: true,
    },
    {
      rotulo: `Headcount necessário (fase ${fase})`,
      valor: formatFTE(headcount),
      icone: UserPlus,
      accent: 'purple',
      largo: true,
    },
  ];

  return (
    <Panel
      title="Indicadores consolidados"
      action={<FaseToggle fase={fase} onChange={onFaseChange} />}
      className={styles.wrapper}
    >
      <div className={styles.grid}>
        {cards.map((card) => {
          const Icone = card.icone;
          return (
            <article
              key={card.rotulo}
              data-accent={card.accent}
              className={`${styles.card} ${card.destaque ? styles.cardDestaque : ''} ${card.largo ? styles.cardLargo : ''}`}
            >
              <div className={styles.iconeWrap}>
                <Icone size={22} className={styles.icone} aria-hidden />
              </div>
              <p className={styles.rotulo}>{card.rotulo}</p>
              <p className={styles.valor}>{card.valor}</p>
            </article>
          );
        })}
      </div>
    </Panel>
  );
}
