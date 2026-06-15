import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { formatBRL } from '../utils/formatters.js';
import { THEME } from '../utils/riscoColors.js';
import { chartAxisTick, chartLegendStyle, chartTooltipStyle } from '../utils/chartTheme.js';
import styles from './GraficoBarras.module.css';

function formatAxisK(value) {
  const n = Number(value) || 0;
  if (n >= 1000) {
    const k = n / 1000;
    const formatted = Number.isInteger(k) ? k : k.toFixed(1).replace('.', ',');
    return `R$${formatted}k`;
  }
  return formatBRL(n);
}

/** @param {{ porDepartamento: Array }} */
export default function GraficoBarras({ porDepartamento }) {
  const dados = (porDepartamento ?? [])
    .map((d) => ({
      departamento: d.departamento,
      fase1: d.custoAdicionalMensalFase1,
      fase2: d.custoAdicionalMensalFase2,
    }))
    .filter((d) => d.fase1 > 0 || d.fase2 > 0)
    .sort((a, b) => b.fase2 - a.fase2);

  if (dados.length === 0) return null;

  return (
    <section className={styles.wrapper}>
      <h2 className={styles.title}>Custo adicional por departamento</h2>
      <ResponsiveContainer width="100%" height={300}>
        <BarChart data={dados} margin={{ top: 8, right: 16, left: 8, bottom: 56 }}>
          <CartesianGrid strokeDasharray="3 3" stroke={THEME.border} />
          <XAxis
            dataKey="departamento"
            tick={chartAxisTick}
            angle={-28}
            textAnchor="end"
            height={64}
            axisLine={{ stroke: THEME.border }}
            tickLine={{ stroke: THEME.border }}
          />
          <YAxis
            tickFormatter={formatAxisK}
            tick={chartAxisTick}
            axisLine={{ stroke: THEME.border }}
            tickLine={{ stroke: THEME.border }}
            width={72}
          />
          <Tooltip
            formatter={(value) => formatBRL(value)}
            {...chartTooltipStyle}
          />
          <Legend wrapperStyle={chartLegendStyle} />
          <Bar
            dataKey="fase1"
            name="Fase 1 (42h)"
            fill="#f59e0b"
            radius={[4, 4, 0, 0]}
          />
          <Bar
            dataKey="fase2"
            name="Fase 2 (40h)"
            fill="#ef4444"
            radius={[4, 4, 0, 0]}
          />
        </BarChart>
      </ResponsiveContainer>
    </section>
  );
}
