import { useMemo } from 'react';
import { formatBRL, formatFTE } from '../utils/formatters.js';
import BadgeRisco from './BadgeRisco.jsx';
import styles from './TabelaDepartamentos.module.css';

/** @param {{ porDepartamento: Array }} */
export default function TabelaDepartamentos({ porDepartamento }) {
  const rows = useMemo(
    () =>
      [...(porDepartamento ?? [])].sort(
        (a, b) => b.custoAdicionalMensalFase2 - a.custoAdicionalMensalFase2,
      ),
    [porDepartamento],
  );

  if (rows.length === 0) return null;

  return (
    <section className={styles.wrapper}>
      <h2 className={styles.title}>Detalhamento por departamento</h2>
      <div className={styles.scroll}>
        <table className={styles.table}>
          <thead>
            <tr>
              <th>Departamento</th>
              <th>Funcionários</th>
              <th>Afetados</th>
              <th>F1 (R$)</th>
              <th>F2 (R$)</th>
              <th>FTEs</th>
              <th>Risco</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.departamento}>
                <td className={styles.depto}>{row.departamento}</td>
                <td>{row.funcionarios}</td>
                <td>{row.afetados}</td>
                <td className={styles.fase1}>{formatBRL(row.custoAdicionalMensalFase1)}</td>
                <td className={styles.fase2}>{formatBRL(row.custoAdicionalMensalFase2)}</td>
                <td>{formatFTE(row.headcountGap)}</td>
                <td>
                  <BadgeRisco nivel={row.nivelRisco} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
