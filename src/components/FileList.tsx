import type { ZipLoadResult, ZipLoadError } from '../services/zipService'

interface FileListProps {
  files: File[]
  onRemove?: (index: number) => void
  onProcess?: () => void
  processing?: boolean
  loadResults?: ZipLoadResult[]
  loadErrors?: ZipLoadError[]
}

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

function getStatusIcon(
  fileName: string,
  loadResults: ZipLoadResult[],
  loadErrors: ZipLoadError[],
  processing: boolean
): { icon: JSX.Element; className: string } | null {
  if (!processing && loadResults.length === 0 && loadErrors.length === 0) return null

  const loaded = loadResults.find((r) => r.fileName === fileName)
  if (loaded) {
    return {
      icon: (
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <polyline points="20 6 9 17 4 12" />
        </svg>
      ),
      className: 'status-success',
    }
  }

  const errored = loadErrors.find((e) => e.fileName === fileName)
  if (errored) {
    return {
      icon: (
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <circle cx="12" cy="12" r="10" />
          <line x1="15" y1="9" x2="9" y2="15" />
          <line x1="9" y1="9" x2="15" y2="15" />
        </svg>
      ),
      className: 'status-error',
    }
  }

  if (processing) {
    return {
      icon: (
        <svg className="spinner" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M21 12a9 9 0 1 1-6.219-8.56" />
        </svg>
      ),
      className: 'status-loading',
    }
  }

  return null
}

export default function FileList({
  files,
  onRemove,
  onProcess,
  processing = false,
  loadResults = [],
  loadErrors = [],
}: FileListProps) {
  if (files.length === 0) return null

  const totalSize = files.reduce((sum, f) => sum + f.size, 0)
  const largeFiles = files.filter((f) => f.size > 100 * 1024 * 1024)

  return (
    <div className="file-list">
      <div className="file-list-header">
        <h3 className="file-list-title">
          {files.length} archivo{files.length !== 1 ? 's' : ''} seleccionado{files.length !== 1 ? 's' : ''}
        </h3>
        <span className="file-list-total-size">{formatSize(totalSize)}</span>
      </div>

      <ul className="file-list-items">
        {files.map((file, index) => {
          const status = getStatusIcon(file.name, loadResults, loadErrors, processing)
          const isLarge = file.size > 100 * 1024 * 1024
          const error = loadErrors.find((e) => e.fileName === file.name)

          return (
            <li
              key={`${file.name}-${index}`}
              className={`file-list-item ${status?.className ?? ''} ${isLarge ? 'file-large' : ''}`}
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                <polyline points="14 2 14 8 20 8" />
              </svg>
              <span className="file-name">{file.name}</span>
              <span className="file-size">
                {isLarge && (
                  <span className="file-large-badge" title="Archivo grande, puede tardar">
                    !
                  </span>
                )}
                {formatSize(file.size)}
              </span>
              {status && (
                <span className={`file-status ${status.className}`}>
                  {status.icon}
                </span>
              )}
              {onRemove && !processing && (
                <button
                  className="file-remove-btn"
                  onClick={() => onRemove(index)}
                  title="Eliminar archivo"
                  type="button"
                >
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <line x1="18" y1="6" x2="6" y2="18" />
                    <line x1="6" y1="6" x2="18" y2="18" />
                  </svg>
                </button>
              )}
            </li>
          )
        })}
      </ul>

      {loadErrors.length > 0 && (
        <div className="file-errors">
          {loadErrors.map((err, i) => (
            <p key={i} className="file-error-item">
              {err.error}
            </p>
          ))}
        </div>
      )}

      {largeFiles.length > 0 && !processing && (
        <p className="file-warning">
          {largeFiles.length} archivo{largeFiles.length !== 1 ? 's' : ''} de más de 100 MB detectado{largeFiles.length !== 1 ? 's' : ''}.
          El procesamiento puede tardar varios segundos.
        </p>
      )}

      {onProcess && files.length > 0 && (
        <button
          className="btn-primary"
          onClick={onProcess}
          disabled={processing}
          type="button"
        >
          {processing ? (
            <>
              <svg className="spinner" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M21 12a9 9 0 1 1-6.219-8.56" />
              </svg>
              Procesando...
            </>
          ) : (
            'Procesar archivos'
          )}
        </button>
      )}
    </div>
  )
}
