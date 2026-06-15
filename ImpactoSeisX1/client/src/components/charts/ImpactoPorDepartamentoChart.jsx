import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { formatBRL } from '../../utils/formatters.js';
import { THEME } from '../../utils/riscoColors.js';
import { chartAxisTick, chartTooltipStyle } from '../../utils/chartTheme.js';
import styles from './Charts.module.css';

export default function ImpactoPorDepartamentoChart({ porDepartamento, fase }) {
  const campo =
    fase === 1 ? 'custoAdicionalMensalFase1' : 'custoAdicionalMensalFase2';

  const dados = (porDepartamento ?? [])
    .map((d) => ({
      departamento: d.departamento,
      custo: d[campo],
    }))
    .filter((d) => d.custo > 0)
    .sort((a, b) => b.custo - a.custo);

  if (dados.length === 0) return null;

  return (
    <article className={styles.card}>
      <h3 className={styles.titulo}>
        Custo adicional mensal por departamento — fase {fase}
      </h3>
      <ResponsiveContainer width="100%" height={280}>
        <BarChart data={dados} margin={{ top: 8, right: 8, left: 8, bottom: 48 }}>
          <CartesianGrid strokeDasharray="3 3" stroke={THEME.border} />
          <XAxis
            dataKey="departamento"
            tick={chartAxisTick}
            angle={-25}
            textAnchor="end"
            height={60}
            axisLine={{ stroke: THEME.border }}
            tickLine={{ stroke: THEME.border }}
          />
          <YAxis
            tickFormatter={(v) => formatBRL(v)}
            tick={chartAxisTick}
            axisLine={{ stroke: THEME.border }}
            tickLine={{ stroke: THEME.border }}
          />
          <Tooltip formatter={(v) => formatBRL(v)} {...chartTooltipStyle} />
          <Bar
            dataKey="custo"
            name="Custo mensal"
            fill={THEME.blue}
            radius={[4, 4, 0, 0]}
          />
        </BarChart>
      </ResponsiveContainer>
    </article>
  );
}
