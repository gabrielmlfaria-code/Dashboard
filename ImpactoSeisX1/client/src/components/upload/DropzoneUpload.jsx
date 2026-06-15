import { useCallback } from 'react';
import { useDropzone } from 'react-dropzone';
import { FileSpreadsheet, Upload } from 'lucide-react';
import Panel from '../ui/Panel.jsx';
import styles from './DropzoneUpload.module.css';

export default function DropzoneUpload({ onArquivo, carregando, onBaixarTemplate }) {
  const onDrop = useCallback(
    (accepted) => {
      if (accepted[0]) onArquivo(accepted[0]);
    },
    [onArquivo],
  );

  const { getRootProps, getInputProps, isDragActive, isDragReject } = useDropzone({
    onDrop,
    accept: {
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': ['.xlsx'],
    },
    maxFiles: 1,
    disabled: carregando,
  });

  const classeZona = [
    styles.zona,
    isDragActive && styles.zonaAtiva,
    isDragReject && styles.zonaRejeitada,
    carregando && styles.zonaDesabilitada,
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <Panel
      title="Importar planilha"
      action={
        <button type="button" className={styles.btnSecundario} onClick={onBaixarTemplate}>
          <FileSpreadsheet size={18} />
          Baixar modelo .xlsx
        </button>
      }
    >
      <div {...getRootProps({ className: classeZona })}>
        <input {...getInputProps()} />
        <Upload size={36} strokeWidth={1.5} className={styles.icone} />
        {carregando ? (
          <p className={styles.texto}>Processando planilha…</p>
        ) : isDragActive ? (
          <p className={styles.texto}>Solte o arquivo aqui</p>
        ) : (
          <>
            <p className={styles.destaque}>Arraste um .xlsx ou clique para selecionar</p>
            <p className={styles.hint}>
              Colunas: Nome, Departamento, TipoEscala, HorasSemanais, SalarioMensal
            </p>
          </>
        )}
      </div>
    </Panel>
  );
}
