/**
 * Hook que orquesta el procesamiento completo de ZIPs.
 *
 * Flujo: idle → loading → extracting → done
 */

import { useState, useCallback } from 'react'
import type { ProcessingProgress, PageSource, ExtractionStats } from '../types'
import { INITIAL_PROGRESS } from '../types'
import {
  loadZip,
  extractSourcesRecursive,
  createExtractionStats,
  type ZipLoadResult,
  type ZipLoadError,
} from '../services/zipService'

interface ExtractionWarning {
  fileName: string
  warning: string
}

export function useZipProcessing() {
  const [progress, setProgress] = useState<ProcessingProgress>(INITIAL_PROGRESS)
  const [sources, setSources] = useState<PageSource[]>([])
  const [loadResults, setLoadResults] = useState<ZipLoadResult[]>([])
  const [loadErrors, setLoadErrors] = useState<ZipLoadError[]>([])
  const [extractionWarnings, setExtractionWarnings] = useState<ExtractionWarning[]>([])
  const [extractionStats, setExtractionStats] = useState<ExtractionStats | null>(null)
  const [error, setError] = useState<string | null>(null)

  const processFiles = useCallback(async (files: File[]) => {
    setError(null)
    setLoadResults([])
    setLoadErrors([])
    setExtractionWarnings([])
    setExtractionStats(null)
    setSources([])

    const results: ZipLoadResult[] = []
    const errors: ZipLoadError[] = []
    const allSources: PageSource[] = []
    const warnings: ExtractionWarning[] = []

    // ── Fase 1: Carga ──────────────────────────────────────────────
    setProgress({
      step: 'loading',
      message: 'Cargando archivos...',
      current: 0,
      total: files.length,
    })

    for (let i = 0; i < files.length; i++) {
      const file = files[i]
      setProgress({
        step: 'loading',
        message: `Leyendo ${file.name} (${formatSize(file.size)})...`,
        current: i,
        total: files.length,
      })

      try {
        const result = await loadZip(file)
        results.push(result)
        setLoadResults([...results])
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Error desconocido'
        errors.push({ fileName: file.name, fileSize: file.size, error: message })
        setLoadErrors([...errors])
      }
    }

    if (results.length === 0) {
      setError('Ningún archivo pudo ser procesado. Verificá que los ZIPs sean válidos.')
      setProgress({ step: 'error', message: 'Error en la carga', current: 0, total: 0 })
      return
    }

    // ── Fase 2: Extracción ─────────────────────────────────────────
    const stats = createExtractionStats()

    setProgress({
      step: 'extracting',
      message: 'Iniciando extracción...',
      current: 0,
      total: results.length,
    })

    const originalConsoleWarn = console.warn
    const capturedWarnings: string[] = []

    console.warn = (...args: unknown[]) => {
      capturedWarnings.push(args.join(' '))
      originalConsoleWarn(...args)
    }

    try {
      for (const result of results) {
        const extracted = await extractSourcesRecursive(
          result.zip,
          stats,
          (extProgress) => {
            const total = extProgress.imagesExtracted + extProgress.pdfsExtracted
            setProgress({
              step: 'extracting',
              message: `${total} archivo${total !== 1 ? 's' : ''} encontrado${total !== 1 ? 's' : ''}...`,
              current: total,
              total: Math.max(total, 1),
            })
          }
        )

        allSources.push(...extracted)
        setSources([...allSources])
      }

      for (const warn of capturedWarnings) {
        const match = warn.match(/ZIP anidado (corrupto|vacío).*?: (.+)/)
        if (match) {
          warnings.push({ fileName: match[2].split(' — ')[0], warning: match[0] })
        }
      }

      setExtractionWarnings(warnings)
      setExtractionStats({ ...stats })
      setSources(allSources)

      const totalPages = stats.totalImages + stats.totalPdfPages
      const sourceCount = allSources.length
      setProgress({
        step: 'done',
        message: `${sourceCount} archivo${sourceCount !== 1 ? 's' : ''} · ${totalPages} página${totalPages !== 1 ? 's' : ''} total${totalPages !== 1 ? 'es' : ''}`,
        current: sourceCount,
        total: sourceCount,
      })
    } finally {
      console.warn = originalConsoleWarn
    }
  }, [])

  const reset = useCallback(() => {
    setProgress(INITIAL_PROGRESS)
    setSources([])
    setLoadResults([])
    setLoadErrors([])
    setExtractionWarnings([])
    setExtractionStats(null)
    setError(null)
  }, [])

  return {
    progress,
    sources,
    loadResults,
    loadErrors,
    extractionStats,
    extractionWarnings,
    error,
    processFiles,
    reset,
  }
}

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}
