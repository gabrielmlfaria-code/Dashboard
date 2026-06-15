import { useCallback, useState } from 'react';
import { useDropzone } from 'react-dropzone';
import { getTemplate } from '../services/api.js';
import styles from './UploadZone.module.css';

/**
 * @param {{
 *   onFileSelect: (file: File) => void,
 *   onApiUrl: (url: string) => void,
 *   loading: boolean,
 *   erro: string | null,
 * }} props
 */
export default function UploadZone({ onFileSelect, onApiUrl, loading, erro }) {
  const [selectedFile, setSelectedFile] = useState(null);
  const [showApiInput, setShowApiInput] = useState(false);
  const [apiUrl, setApiUrl] = useState('http://localhost:5000');

  const onDrop = useCallback(
    (accepted) => {
      const file = accepted[0];
      if (!file) return;
      setSelectedFile(file);
      onFileSelect(file);
    },
    [onFileSelect],
  );

  const { getRootProps, getInputProps, isDragActive, isDragReject } = useDropzone({
    onDrop,
    accept: {
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': ['.xlsx'],
    },
    maxFiles: 1,
    disabled: loading,
  });

  const handleTemplate = async () => {
    if (loading) return;
    try {
      await getTemplate();
    } catch {
      /* erro tratado pelo hook pai se necessário */
    }
  };

  const handleApiSubmit = (e) => {
    e.preventDefault();
    if (loading || !apiUrl.trim()) return;
    onApiUrl(apiUrl.trim());
  };

  const zoneClass = [
    styles.dropzone,
    isDragActive && styles.dropzoneActive,
    isDragReject && styles.dropzoneReject,
    loading && styles.dropzoneDisabled,
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <div className={styles.wrapper}>
      <h1 className={styles.pageTitle}>ImpactoSeisX1</h1>
      <p className={styles.pageSubtitle}>
        Simule o impacto financeiro e de conformidade da PEC que extingue a escala 6x1
      </p>

      <div {...getRootProps({ className: zoneClass })}>
        <input {...getInputProps()} />
        {loading ? (
          <p className={styles.dropText}>Processando…</p>
        ) : isDragActive ? (
          <p className={styles.dropText}>Solte o arquivo .xlsx aqui</p>
        ) : (
          <>
            <p className={styles.dropHighlight}>Arraste uma planilha .xlsx ou clique para selecionar</p>
            <p className={styles.dropHint}>
              Nome · Departamento · TipoEscala · HorasSemanais · SalarioMensal
            </p>
          </>
        )}
      </div>

      {selectedFile && (
        <p className={styles.fileName}>
          Arquivo selecionado: <strong>{selectedFile.name}</strong>
        </p>
      )}

      {erro && (
        <p className={styles.erro} role="alert">
          {erro}
        </p>
      )}

      <div className={styles.actions}>
        <button
          type="button"
          className={styles.btnSecondary}
          onClick={handleTemplate}
          disabled={loading}
        >
          📥 Baixar template
        </button>
        <button
          type="button"
          className={styles.btnSecondary}
          onClick={() => setShowApiInput((v) => !v)}
          disabled={loading}
        >
          🔗 Carregar da API de Ponto
        </button>
      </div>

      {showApiInput && (
        <form className={styles.apiForm} onSubmit={handleApiSubmit}>
          <label className={styles.apiLabel} htmlFor="apiUrl">
            URL base da API de jornadas
          </label>
          <div className={styles.apiRow}>
            <input
              id="apiUrl"
              type="url"
              className={styles.apiInput}
              value={apiUrl}
              onChange={(e) => setApiUrl(e.target.value)}
              placeholder="http://localhost:5000"
              required
              disabled={loading}
            />
            <button type="submit" className={styles.btnPrimary} disabled={loading}>
              Consultar
            </button>
          </div>
        </form>
      )}
    </div>
  );
}
