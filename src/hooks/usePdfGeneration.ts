/**
 * Hook que gestiona la generación del PDF a partir de archivos extraídos.
 *
 * Soporta imágenes y PDFs como fuentes. Cada página de PDF se copia
 * directamente al PDF de salida (sin pérdida de calidad).
 */

import { useState, useCallback } from 'react'
import type { PageSource, PageMetadata, ProcessingProgress } from '../types'
import { INITIAL_PROGRESS } from '../types'
import { generatePdf, type GeneratePdfResult } from '../services/pdfService'

function formatSize(bytes: number): string {
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

export function usePdfGeneration() {
  const [pdfBytes, setPdfBytes] = useState<Uint8Array | null>(null)
  const [pagesMetadata, setPagesMetadata] = useState<PageMetadata[]>([])
  const [progress, setProgress] = useState<ProcessingProgress>(INITIAL_PROGRESS)
  const [generationErrors, setGenerationErrors] = useState<{ filename: string; error: string }[]>([])
  const [error, setError] = useState<string | null>(null)

  const generate = useCallback(async (sources: PageSource[]) => {
    setError(null)
    setGenerationErrors([])
    setProgress({
      step: 'generating',
      message: 'Creando documento PDF...',
      current: 0,
      total: sources.length,
    })

    try {
      const result = await generatePdf(sources, (current, total) => {
        setProgress({
          step: 'generating',
          message: `Procesando ${current} de ${total}...`,
          current,
          total,
        })
      })

      setPdfBytes(result.pdfBytes)
      setPagesMetadata(result.pagesMetadata)
      setGenerationErrors(result.errors)

      const totalPages = result.pagesMetadata.length
      setProgress({
        step: 'preview',
        message: `PDF generado: ${totalPages} página${totalPages !== 1 ? 's' : ''} · ${formatSize(result.pdfBytes.byteLength)}`,
        current: totalPages,
        total: totalPages,
      })
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Error al generar el PDF'
      setError(message)
      setProgress({ step: 'error', message, current: 0, total: 0 })
    }
  }, [])

  const reset = useCallback(() => {
    setPdfBytes(null)
    setPagesMetadata([])
    setGenerationErrors([])
    setProgress(INITIAL_PROGRESS)
    setError(null)
  }, [])

  return { pdfBytes, pagesMetadata, progress, generationErrors, error, generate, reset }
}
