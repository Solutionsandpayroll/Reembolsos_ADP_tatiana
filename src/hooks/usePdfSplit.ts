/**
 * Hook que gestiona la selección de páginas y división del PDF.
 *
 * Flujo de división:
 *   idle → splitting → done
 *
 * Los PDFs se descargan secuencialmente con una pausa entre cada uno
 * para evitar que el navegador bloquee la segunda descarga.
 */

import { useState, useCallback } from 'react'
import type { PdfPageInfo, ProcessingProgress, ImageFile, SplitResult } from '../types'
import { INITIAL_PROGRESS } from '../types'
import { splitPdf, downloadPdfsSequential } from '../services/pdfService'

function formatSize(bytes: number): string {
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

export function usePdfSplit() {
  const [pages, setPages] = useState<PdfPageInfo[]>([])
  const [progress, setProgress] = useState<ProcessingProgress>(INITIAL_PROGRESS)
  const [splitResult, setSplitResult] = useState<SplitResult | null>(null)
  const [error, setError] = useState<string | null>(null)

  const initPages = useCallback((images: ImageFile[]) => {
    const pageInfos: PdfPageInfo[] = images.map((img, index) => ({
      index,
      imagePath: img.path,
      imageFilename: img.filename,
      selected: true,
    }))
    setPages(pageInfos)
  }, [])

  const togglePage = useCallback((index: number) => {
    setPages((prev) =>
      prev.map((p) => (p.index === index ? { ...p, selected: !p.selected } : p))
    )
  }, [])

  const selectAll = useCallback(() => {
    setPages((prev) => prev.map((p) => ({ ...p, selected: true })))
  }, [])

  const deselectAll = useCallback(() => {
    setPages((prev) => prev.map((p) => ({ ...p, selected: false })))
  }, [])

  const executeSplit = useCallback(async (pdfBytes: Uint8Array) => {
    setError(null)
    setSplitResult(null)

    const selectedIndices = new Set(
      pages.filter((p) => p.selected).map((p) => p.index)
    )

    const selectedCount = selectedIndices.size
    const remainingCount = pages.length - selectedCount

    setProgress({
      step: 'splitting',
      message: 'Preparando división...',
      current: 0,
      total: pages.length,
    })

    try {
      const result = await splitPdf(pdfBytes, selectedIndices, (current, total) => {
        setProgress({
          step: 'splitting',
          message: `Copiando página ${current} de ${total}...`,
          current,
          total,
        })
      })

      setSplitResult(result)

      setProgress({
        step: 'splitting',
        message: 'Descargando PDFs...',
        current: pages.length,
        total: pages.length,
      })

      const downloads: { bytes: Uint8Array; filename: string }[] = []

      if (result.pageCountA > 0) {
        downloads.push({
          bytes: result.pdfA,
          filename: `reembolsos-seleccionados-${result.pageCountA}-pag.pdf`,
        })
      }

      if (result.pageCountB > 0) {
        downloads.push({
          bytes: result.pdfB,
          filename: `reembolsos-restantes-${result.pageCountB}-pag.pdf`,
        })
      }

      await downloadPdfsSequential(downloads)

      setProgress({
        step: 'done',
        message: `${downloads.length} PDF${downloads.length !== 1 ? 's' : ''} descargado${downloads.length !== 1 ? 's' : ''}`,
        current: downloads.length,
        total: downloads.length,
      })
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Error al dividir el PDF'
      setError(message)
      setProgress({ step: 'error', message, current: 0, total: 0 })
    }
  }, [pages])

  const reset = useCallback(() => {
    setPages([])
    setProgress(INITIAL_PROGRESS)
    setSplitResult(null)
    setError(null)
  }, [])

  return {
    pages,
    progress,
    splitResult,
    error,
    initPages,
    togglePage,
    selectAll,
    deselectAll,
    executeSplit,
    reset,
  }
}
