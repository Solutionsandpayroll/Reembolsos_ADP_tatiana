import { useState, useCallback, useEffect } from 'react'
import FileUploader from './components/FileUploader'
import FileList from './components/FileList'
import ProcessingProgress from './components/ProcessingProgress'
import PdfViewer from './components/PdfViewer'
import { useZipProcessing } from './hooks/useZipProcessing'
import { usePdfGeneration } from './hooks/usePdfGeneration'
import { usePdfSplit } from './hooks/usePdfSplit'
import { getStructureDescription } from './services/zipService'
import { downloadPdf } from './services/pdfService'
import './components/App.css'

export default function App() {
  const [files, setFiles] = useState<File[]>([])
  const [activeStep, setActiveStep] = useState<'upload' | 'pages' | 'result'>('upload')

  const {
    progress: zipProgress,
    images,
    loadResults,
    loadErrors,
    extractionStats,
    extractionWarnings,
    error: zipError,
    processFiles,
    reset: resetZip,
  } = useZipProcessing()

  const {
    pdfBytes,
    progress: pdfProgress,
    error: pdfError,
    generate,
    reset: resetPdf,
  } = usePdfGeneration()

  const {
    pages,
    progress: splitProgress,
    splitResult,
    error: splitError,
    initPages,
    togglePage,
    selectAll,
    deselectAll,
    executeSplit,
    reset: resetSplit,
  } = usePdfSplit()

  const handleFilesSelected = useCallback(
    (newFiles: File[]) => {
      setFiles((prev) => [...prev, ...newFiles])
    },
    []
  )

  const handleRemoveFile = useCallback((index: number) => {
    setFiles((prev) => prev.filter((_, i) => i !== index))
  }, [])

  const handleProcess = useCallback(() => {
    if (files.length === 0) return
    processFiles(files)
  }, [files, processFiles])

  useEffect(() => {
    if (zipProgress.step === 'done' && images.length > 0) {
      generate(images)
    }
  }, [zipProgress.step, images, generate])

  useEffect(() => {
    if (pdfProgress.step === 'preview' && pdfBytes) {
      initPages(images)
      setActiveStep('pages')
    }
  }, [pdfProgress.step, pdfBytes, images, initPages])

  const handleGenerateSplit = useCallback(() => {
    if (!pdfBytes) return
    executeSplit(pdfBytes)
  }, [pdfBytes, executeSplit])

  const handleDownloadFull = useCallback(() => {
    if (!pdfBytes) return
    downloadPdf(pdfBytes, `reembolsos-completo-${pages.length}-pag.pdf`)
  }, [pdfBytes, pages.length])

  useEffect(() => {
    if (splitProgress.step === 'done') {
      setActiveStep('result')
    }
  }, [splitProgress.step])

  const handleReset = useCallback(() => {
    setFiles([])
    setActiveStep('upload')
    resetZip()
    resetPdf()
    resetSplit()
  }, [resetZip, resetPdf, resetSplit])

  const isProcessing =
    zipProgress.step === 'loading' ||
    zipProgress.step === 'extracting' ||
    pdfProgress.step === 'generating' ||
    splitProgress.step === 'splitting'

  const displayError = zipError || pdfError || splitError
  const showUploadSection = activeStep === 'upload' && !isProcessing
  const showProcessingSection = activeStep === 'upload' && isProcessing

  return (
    <div className="app">
      <header className="header">
        <div className="container">
          <div className="header-content">
            <div className="logo-container">
              <div className="logo">
                <img
                  src="/Logo syp.png"
                  alt="Solutions & Payroll Logo"
                  width="60"
                  height="60"
                />
              </div>
              <div className="header-text">
                <h1>Solutions & Payroll</h1>
                <p className="subtitle">Conversor de ZIP a PDF - Reembolsos</p>
              </div>
            </div>
            <div className="welcome-box">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="12" cy="12" r="10" />
                <line x1="12" y1="8" x2="12" y2="12" />
                <line x1="12" y1="16" x2="12.01" y2="16" />
              </svg>
              <span>Conversor de Reembolsos</span>
            </div>
          </div>
        </div>
      </header>

      <main className="main-content">
        <div className="container">
          {displayError && (
            <div className="error-banner">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="12" cy="12" r="10" />
                <line x1="15" y1="9" x2="9" y2="15" />
                <line x1="9" y1="9" x2="15" y2="15" />
              </svg>
              <span>{displayError}</span>
              <button className="btn-text" onClick={handleReset} type="button">
                Reiniciar
              </button>
            </div>
          )}

          {/* Paso 1: Carga de archivos (antes de procesar) */}
          {showUploadSection && (
            <>
              <FileUploader
                onFilesSelected={handleFilesSelected}
                disabled={isProcessing}
              />
              <FileList
                files={files}
                onRemove={handleRemoveFile}
                onProcess={handleProcess}
                processing={isProcessing}
              />
            </>
          )}

          {/* Procesamiento en curso */}
          {showProcessingSection && (
            <div className="processing-section">
              <FileList
                files={files}
                processing={true}
                loadResults={loadResults}
                loadErrors={loadErrors}
              />

              <ProcessingProgress
                progress={
                  zipProgress.step !== 'idle' && zipProgress.step !== 'done'
                    ? zipProgress
                    : pdfProgress
                }
              />

              {loadResults.length > 0 && (
                <div className="structure-info">
                  {loadResults.map((result) => (
                    <div key={result.fileName} className="structure-card">
                      <div className="structure-card-header">
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                          <polyline points="14 2 14 8 20 8" />
                        </svg>
                        <span className="structure-card-name">{result.fileName}</span>
                      </div>
                      <p className="structure-card-desc">
                        {getStructureDescription(result.detection, result.structure)}
                      </p>
                    </div>
                  ))}
                </div>
              )}

              {extractionStats && extractionStats.totalImages > 0 && (
                <div className="extraction-stats">
                  <div className="extraction-stat">
                    <span className="extraction-stat-value">{extractionStats.totalImages}</span>
                    <span className="extraction-stat-label">imágenes</span>
                  </div>
                  <div className="extraction-stat">
                    <span className="extraction-stat-value">{extractionStats.totalNestedZips}</span>
                    <span className="extraction-stat-label">ZIPs anidados</span>
                  </div>
                  <div className="extraction-stat">
                    <span className="extraction-stat-value">{extractionStats.totalFolders}</span>
                    <span className="extraction-stat-label">carpetas</span>
                  </div>
                  <div className="extraction-stat">
                    <span className="extraction-stat-value">{extractionStats.maxDepth}</span>
                    <span className="extraction-stat-label">niveles máx.</span>
                  </div>
                </div>
              )}

              {extractionWarnings.length > 0 && (
                <div className="extraction-warnings">
                  {extractionWarnings.map((w, i) => (
                    <p key={i} className="extraction-warning">
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
                        <line x1="12" y1="9" x2="12" y2="13" />
                        <line x1="12" y1="17" x2="12.01" y2="17" />
                      </svg>
                      {w.warning}
                    </p>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Paso 2: Selección de páginas */}
          {activeStep === 'pages' && pdfBytes && (
            <PdfViewer
              pdfBytes={pdfBytes}
              pages={pages}
              onToggle={togglePage}
              onSelectAll={selectAll}
              onDeselectAll={deselectAll}
              onGenerate={handleGenerateSplit}
              onDownloadFull={handleDownloadFull}
              generating={splitProgress.step === 'splitting'}
            />
          )}

          {/* Paso 3: Resultado */}
          {activeStep === 'result' && (
            <div className="result-section">
              <div className="card">
                <div className="card-header">
                  <h2>PDFs generados correctamente</h2>
                  <p className="description">
                    Los archivos se descargaron automáticamente. Revisá tu carpeta de descargas.
                  </p>
                </div>
                <div className="card-body">
                  {splitResult && (
                    <div className="result-files">
                      {splitResult.pageCountA > 0 && (
                        <div className="result-file">
                          <div className="result-file-icon">
                            <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                              <polyline points="14 2 14 8 20 8" />
                            </svg>
                          </div>
                          <div className="result-file-info">
                            <strong>PDF A — Seleccionadas</strong>
                            <span>
                              {splitResult.pageCountA} página{splitResult.pageCountA !== 1 ? 's' : ''}
                              {' · '}
                              {formatSize(splitResult.pdfA.byteLength)}
                            </span>
                          </div>
                        </div>
                      )}
                      {splitResult.pageCountB > 0 && (
                        <div className="result-file">
                          <div className="result-file-icon">
                            <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                              <polyline points="14 2 14 8 20 8" />
                            </svg>
                          </div>
                          <div className="result-file-info">
                            <strong>PDF B — Restantes</strong>
                            <span>
                              {splitResult.pageCountB} página{splitResult.pageCountB !== 1 ? 's' : ''}
                              {' · '}
                              {formatSize(splitResult.pdfB.byteLength)}
                            </span>
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                  <button className="btn-primary" onClick={handleReset} type="button">
                    Procesar nuevos archivos
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      </main>

      <footer className="footer">
        <div className="container">
          <p>
            &copy; {new Date().getFullYear()} Solutions & Payroll. Todos los derechos reservados.
          </p>
        </div>
      </footer>
    </div>
  )
}

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}
