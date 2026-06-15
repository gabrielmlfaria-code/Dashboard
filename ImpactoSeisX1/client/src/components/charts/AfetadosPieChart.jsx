import { Cell, Legend, Pie, PieChart, ResponsiveContainer, Tooltip } from 'recharts';
import { THEME } from '../../utils/riscoColors.js';
import { chartLegendStyle, chartTooltipStyle } from '../../utils/chartTheme.js';
import styles from './Charts.module.css';

const CORES = [THEME.red, THEME.blue];

export default function AfetadosPieChart({ kpi }) {
  const dados = [
    { nome: 'Afetados PEC', valor: kpi.afetadosPEC },
    { nome: 'Não afetados', valor: kpi.naoAfetados },
  ].filter((d) => d.valor > 0);

  if (dados.length === 0) return null;

  return (
    <article className={styles.card}>
      <h3 className={styles.titulo}>Distribuição — impacto PEC</h3>
      <ResponsiveContainer width="100%" height={260}>
        <PieChart>
          <Pie
            data={dados}
            dataKey="valor"
            nameKey="nome"
            cx="50%"
            cy="50%"
            innerRadius={55}
            outerRadius={90}
            paddingAngle={2}
            stroke={THEME.panel}
          >
            {dados.map((entry, i) => (
              <Cell key={entry.nome} fill={CORES[i % CORES.length]} />
            ))}
          </Pie>
          <Tooltip {...chartTooltipStyle} />
          <Legend wrapperStyle={chartLegendStyle} />
        </PieChart>
      </ResponsiveContainer>
    </article>
  );
}
