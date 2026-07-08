/**
 * Hook que gestiona la generación del PDF a partir de imágenes extraídas.
 *
 * Cada imagen se embebe secuencialmente y su buffer se libera
 * inmediatamente después para minimizar el consumo de memoria.
 */

import { useState, useCallback } from 'react'
import type { ImageFile, ProcessingProgress } from '../types'
import { INITIAL_PROGRESS } from '../types'
import { generatePdf } from '../services/pdfService'

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

export function usePdfGeneration() {
  const [pdfBytes, setPdfBytes] = useState<Uint8Array | null>(null)
  const [progress, setProgress] = useState<ProcessingProgress>(INITIAL_PROGRESS)
  const [error, setError] = useState<string | null>(null)

  const generate = useCallback(async (images: ImageFile[]) => {
    setError(null)
    setProgress({
      step: 'generating',
      message: 'Creando documento PDF...',
      current: 0,
      total: images.length,
    })

    try {
      const bytes = await generatePdf(images, (current, total) => {
        setProgress({
          step: 'generating',
          message: `Añadiendo página ${current} de ${total}...`,
          current,
          total,
        })
      })

      setPdfBytes(bytes)
      setProgress({
        step: 'preview',
        message: `PDF generado: ${images.length} página${images.length !== 1 ? 's' : ''} · ${formatSize(bytes.byteLength)}`,
        current: images.length,
        total: images.length,
      })
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Error al generar el PDF'
      setError(message)
      setProgress({ step: 'error', message, current: 0, total: 0 })
    }
  }, [])

  const reset = useCallback(() => {
    setPdfBytes(null)
    setProgress(INITIAL_PROGRESS)
    setError(null)
  }, [])

  return { pdfBytes, progress, error, generate, reset }
}
