import { formatBRL, formatFTE, formatPercent } from '../../utils/formatters.js';
import { corRisco } from '../../utils/riscoColors.js';
import Panel from '../ui/Panel.jsx';
import styles from './DepartamentosTable.module.css';

export default function DepartamentosTable({ porDepartamento, fase }) {
  if (!porDepartamento?.length) return null;

  const colunaCusto =
    fase === 1 ? 'custoAdicionalMensalFase1' : 'custoAdicionalMensalFase2';

  return (
    <Panel title="Detalhamento por departamento">
      <div className={styles.wrapper}>
        <table className={styles.tabela}>
          <thead>
            <tr>
              <th>Departamento</th>
              <th>Funcionários</th>
              <th>Afetados</th>
              <th>% afetados</th>
              <th>Custo mensal (fase {fase})</th>
              <th>Headcount gap</th>
              <th>Risco</th>
            </tr>
          </thead>
          <tbody>
            {porDepartamento.map((d) => {
              const cores = corRisco(d.nivelRisco);
              return (
                <tr key={d.departamento}>
                  <td className={styles.depto}>{d.departamento}</td>
                  <td>{d.funcionarios}</td>
                  <td className={styles.afetados}>{d.afetados}</td>
                  <td>{formatPercent(d.percentualAfetados)}</td>
                  <td className={styles.custo}>{formatBRL(d[colunaCusto])}</td>
                  <td>{formatFTE(d.headcountGap)}</td>
                  <td>
                    <span
                      className={styles.badge}
                      style={{
                        background: cores.bg,
                        color: cores.text,
                        borderColor: cores.border,
                      }}
                    >
                      {d.nivelRisco}
                    </span>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </Panel>
  );
}
