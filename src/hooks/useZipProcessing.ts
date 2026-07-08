/**
 * Hook que orquesta el procesamiento completo de ZIPs.
 *
 * Flujo:
 *   idle → loading → extracting → done
 *
 * Etapa 2: Carga de ZIP con validación y detección de estructura.
 * Etapa 3: Extracción recursiva de imágenes con estadísticas y progreso.
 */

import { useState, useCallback } from 'react'
import type { ProcessingProgress, ImageFile, ExtractionStats } from '../types'
import { INITIAL_PROGRESS } from '../types'
import {
  loadZip,
  extractImagesRecursive,
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
  const [images, setImages] = useState<ImageFile[]>([])
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
    setImages([])

    const results: ZipLoadResult[] = []
    const errors: ZipLoadError[] = []
    const allImages: ImageFile[] = []
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
      message: 'Iniciando extracción de imágenes...',
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
      for (let zipIdx = 0; zipIdx < results.length; zipIdx++) {
        const result = results[zipIdx]

        const extracted = await extractImagesRecursive(
          result.zip,
          stats,
          (extProgress) => {
            setProgress({
              step: 'extracting',
              message: `${extProgress.imagesExtracted} imagen${extProgress.imagesExtracted !== 1 ? 'es' : ''} encontrada${extProgress.imagesExtracted !== 1 ? 's' : ''}...`,
              current: extProgress.imagesExtracted,
              total: Math.max(extProgress.imagesExtracted, stats.totalImages),
            })
          }
        )

        allImages.push(...extracted)
        setImages([...allImages])
      }

      // Procesar warnings capturados de la consola
      for (const warn of capturedWarnings) {
        const match = warn.match(/ZIP anidado (corrupto|vacío).*?: (.+)/)
        if (match) {
          warnings.push({
            fileName: match[2].split(' — ')[0],
            warning: match[0],
          })
        }
      }

      setExtractionWarnings(warnings)
      setExtractionStats({ ...stats })
      setImages(allImages)

      const imageWord = allImages.length === 1 ? 'imagen' : 'imágenes'
      setProgress({
        step: 'done',
        message: `${allImages.length} ${imageWord} encontrada${allImages.length !== 1 ? 's' : ''} en ${results.length} ZIP${results.length !== 1 ? 's' : ''}`,
        current: allImages.length,
        total: allImages.length,
      })
    } finally {
      console.warn = originalConsoleWarn
    }
  }, [])

  const reset = useCallback(() => {
    setProgress(INITIAL_PROGRESS)
    setImages([])
    setLoadResults([])
    setLoadErrors([])
    setExtractionWarnings([])
    setExtractionStats(null)
    setError(null)
  }, [])

  return {
    progress,
    images,
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
