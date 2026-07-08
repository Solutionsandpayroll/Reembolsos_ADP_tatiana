import { useState, useCallback, useMemo } from 'react'
import { Document, Page } from 'react-pdf'
import type { PdfPageInfo } from '../types'
import '../utils/pdfWorker'

const THUMBNAIL_WIDTH = 200

interface PdfViewerProps {
  pdfBytes: Uint8Array
  pages: PdfPageInfo[]
  onToggle: (index: number) => void
  onSelectAll: () => void
  onDeselectAll: () => void
  onGenerate: () => void
  onDownloadFull: () => void
  generating?: boolean
}

function formatSize(bytes: number): string {
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

export default function PdfViewer({
  pdfBytes,
  pages,
  onToggle,
  onSelectAll,
  onDeselectAll,
  onGenerate,
  onDownloadFull,
  generating = false,
}: PdfViewerProps) {
  const [numPages, setNumPages] = useState<number | null>(null)
  const [loadError, setLoadError] = useState<string | null>(null)

  const selectedCount = pages.filter((p) => p.selected).length
  const allSelected = pages.length > 0 && selectedCount === pages.length
  const noneSelected = selectedCount === 0

  const fileData = useMemo(
    () => ({ data: pdfBytes.slice() }),
    [pdfBytes]
  )

  const handleDocumentLoad = useCallback(
    (data: { numPages: number }) => {
      setNumPages(data.numPages)
      setLoadError(null)
    },
    []
  )

  const handleDocumentError = useCallback((error: Error) => {
    console.error('Error al cargar PDF para preview:', error)
    setLoadError('No se pudo cargar la vista previa del PDF')
  }, [])

  return (
    <div className="pdf-viewer">
      <div className="pdf-viewer-header">
        <div className="pdf-viewer-info">
          <h3>Vista previa del PDF</h3>
          <span className="pdf-viewer-meta">
            {numPages !== null ? `${numPages} página${numPages !== 1 ? 's' : ''}` : 'Cargando...'}
            {' · '}
            {formatSize(pdfBytes.byteLength)}
          </span>
        </div>
        <div className="pdf-viewer-actions">
          <button
            className="btn-text"
            onClick={onSelectAll}
            disabled={allSelected}
            type="button"
          >
            Seleccionar todas
          </button>
          <button
            className="btn-text"
            onClick={onDeselectAll}
            disabled={noneSelected}
            type="button"
          >
            Deseleccionar todas
          </button>
        </div>
      </div>

      {loadError ? (
        <div className="pdf-viewer-error">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="12" cy="12" r="10" />
            <line x1="12" y1="8" x2="12" y2="12" />
            <line x1="12" y1="16" x2="12.01" y2="16" />
          </svg>
          <p>{loadError}</p>
        </div>
      ) : (
        <Document
          file={fileData}
          onLoadSuccess={handleDocumentLoad}
          onLoadError={handleDocumentError}
          loading={
            <div className="pdf-viewer-loading">
              <svg className="spinner" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M21 12a9 9 0 1 1-6.219-8.56" />
              </svg>
              <p>Cargando vista previa...</p>
            </div>
          }
        >
          <div className="pdf-viewer-grid">
            {pages.map((page) => (
              <label
                key={page.index}
                className={`pdf-page-card ${page.selected ? 'selected' : ''}`}
              >
                <div className="pdf-page-card-header">
                  <input
                    type="checkbox"
                    checked={page.selected}
                    onChange={() => onToggle(page.index)}
                    className="pdf-page-checkbox"
                  />
                  <span className="pdf-page-number">Pág. {page.index + 1}</span>
                </div>
                <div className="pdf-page-thumbnail">
                  <Page
                    pageNumber={page.index + 1}
                    width={THUMBNAIL_WIDTH}
                    renderTextLayer={false}
                    renderAnnotationLayer={false}
                    loading={
                      <div className="pdf-page-loading">
                        <span>Cargando...</span>
                      </div>
                    }
                    error={
                      <div className="pdf-page-error">
                        <span>Error</span>
                      </div>
                    }
                  />
                </div>
                <span className="pdf-page-filename" title={page.imageFilename}>
                  {page.imageFilename}
                </span>
              </label>
            ))}
          </div>
        </Document>
      )}

      <div className="pdf-viewer-footer">
        <p>
          <strong>{selectedCount}</strong> página{selectedCount !== 1 ? 's' : ''} seleccionada{selectedCount !== 1 ? 's' : ''} para PDF A
          {' · '}
          <strong>{pages.length - selectedCount}</strong> para PDF B
        </p>
        <div className="pdf-viewer-footer-actions">
          <button
            className="btn-secondary"
            onClick={onDownloadFull}
            disabled={generating}
            type="button"
          >
            Descargar PDF completo
          </button>
          <button
            className="btn-primary"
            onClick={onGenerate}
            disabled={generating || noneSelected || allSelected}
            type="button"
          >
            {generating ? (
              <>
                <svg className="spinner" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M21 12a9 9 0 1 1-6.219-8.56" />
                </svg>
                Generando...
              </>
            ) : (
              'Dividir en PDFs'
            )}
          </button>
        </div>
      </div>
    </div>
  )
}
