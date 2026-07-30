/**
 * Servicio de procesamiento de archivos ZIP.
 *
 * Responsabilidades:
 *  - Cargar archivos ZIP con JSZip
 *  - Analizar la estructura (Caso 1: ZIPs anidados, Caso 2: carpetas planas)
 *  - Extraer recursivamente imágenes y PDFs a cualquier profundidad
 *  - Reportar progreso detallado durante la extracción
 */

import JSZip from 'jszip'
import { PDFDocument } from 'pdf-lib'
import type { ImageFile, PdfSourceFile, PageSource, ExtractionStats, ZipStructure, ZipDetectionResult } from '../types'
import { isImage } from '../utils/imageDetection'

const PDF_EXTENSIONS = new Set(['.pdf'])

function isPdf(filename: string): boolean {
  const ext = filename.toLowerCase().slice(filename.lastIndexOf('.'))
  return PDF_EXTENSIONS.has(ext)
}

export interface ZipLoadResult {
  zip: JSZip
  fileName: string
  fileSize: number
  structure: ZipStructure
  detection: ZipDetectionResult
  entryCount: number
}

export interface ZipLoadError {
  fileName: string
  fileSize: number
  error: string
}

export interface ExtractionProgress {
  imagesExtracted: number
  pdfsExtracted: number
  zipsProcessed: number
  totalNestedZipsFound: number
  currentPath: string
  depth: number
}

export function createExtractionStats(): ExtractionStats {
  return {
    totalFiles: 0,
    totalFolders: 0,
    totalNestedZips: 0,
    totalImages: 0,
    totalPdfs: 0,
    totalPdfPages: 0,
    maxDepth: 0,
  }
}

export function analyzeStructure(zip: JSZip): ZipStructure {
  const files: string[] = []
  const folders: string[] = []
  const nestedZips: string[] = []
  const images: string[] = []

  zip.forEach((relativePath, zipEntry) => {
    if (zipEntry.dir) {
      folders.push(relativePath)
    } else {
      files.push(relativePath)
      if (relativePath.toLowerCase().endsWith('.zip')) {
        nestedZips.push(relativePath)
      } else if (isImage(relativePath)) {
        images.push(relativePath)
      }
    }
  })

  return { files, folders, nestedZips, images }
}

export function detectZipType(zip: JSZip): ZipDetectionResult {
  const structure = analyzeStructure(zip)
  const hasNestedZips = structure.nestedZips.length > 0
  const hasImages = structure.images.length > 0

  if (hasNestedZips && hasImages) return 'mixed'
  if (hasNestedZips) return 'case1'
  if (hasImages) return 'case2'
  return 'empty'
}

export function getStructureDescription(detection: ZipDetectionResult, structure: ZipStructure): string {
  switch (detection) {
    case 'case1':
      return `ZIPs anidados (${structure.nestedZips.length} ZIP${structure.nestedZips.length !== 1 ? 's' : ''})`
    case 'case2':
      return `Carpetas con archivos (${structure.folders.length} carpeta${structure.folders.length !== 1 ? 's' : ''})`
    case 'mixed':
      return `Mixta: ${structure.nestedZips.length} ZIP${structure.nestedZips.length !== 1 ? 's' : ''} + ${structure.images.length} archivos`
    case 'empty':
      return 'ZIP vacío'
  }
}

export async function loadZip(file: File): Promise<ZipLoadResult> {
  if (!file.name.toLowerCase().endsWith('.zip') && file.type !== 'application/zip') {
    throw new Error(`"${file.name}" no es un archivo ZIP válido`)
  }

  let buffer: ArrayBuffer
  try {
    buffer = await file.arrayBuffer()
  } catch {
    throw new Error(`No se pudo leer el archivo "${file.name}"`)
  }

  if (buffer.byteLength === 0) {
    throw new Error(`El archivo "${file.name}" está vacío`)
  }

  let zip: JSZip
  try {
    zip = await JSZip.loadAsync(buffer)
  } catch {
    throw new Error(`"${file.name}" no es un ZIP válido o está corrupto`)
  }

  const structure = analyzeStructure(zip)
  const detection = detectZipType(zip)

  let entryCount = 0
  let hasContent = false
  zip.forEach((p, e) => {
    entryCount++
    if (!e.dir) hasContent = true
  })

  if (!hasContent) {
    throw new Error(`"${file.name}" no contiene archivos`)
  }

  return {
    zip,
    fileName: file.name,
    fileSize: file.size,
    structure,
    detection,
    entryCount,
  }
}

export async function extractSourcesRecursive(
  zip: JSZip,
  stats: ExtractionStats,
  onProgress?: (progress: ExtractionProgress) => void,
  depth = 0,
  pathPrefix = ''
): Promise<PageSource[]> {
  const sources: PageSource[] = []

  // Recolectar entradas ordenadas
  const entries: { path: string; isDir: boolean }[] = []
  zip.forEach((relativePath, zipEntry) => {
    entries.push({ path: relativePath, isDir: zipEntry.dir })
  })

  for (const { path: relativePath, isDir } of entries) {
    if (isDir) {
      stats.totalFolders++
      continue
    }

    stats.totalFiles++
    stats.maxDepth = Math.max(stats.maxDepth, depth)

    const entry = zip.file(relativePath)
    if (!entry) continue

    const fullPath = pathPrefix ? `${pathPrefix}/${relativePath}` : relativePath
    const filename = relativePath.split('/').pop() || relativePath

    if (relativePath.toLowerCase().endsWith('.zip')) {
      stats.totalNestedZips++

      const nestedPrefix = pathPrefix
        ? `${pathPrefix}/${relativePath}`
        : relativePath

      try {
        const nestedBuffer = await entry.async('arraybuffer')
        if (nestedBuffer.byteLength === 0) {
          console.warn(`ZIP anidado vacío: ${relativePath}`)
          continue
        }

        const nestedZip = await JSZip.loadAsync(nestedBuffer)
        const nestedSources = await extractSourcesRecursive(
          nestedZip,
          stats,
          onProgress,
          depth + 1,
          nestedPrefix
        )
        sources.push(...nestedSources)
      } catch (err) {
        console.warn(`ZIP anidado corrupto: ${relativePath} — ${err instanceof Error ? err.message : err}`)
      }
    } else if (isPdf(relativePath)) {
      const data = await entry.async('arraybuffer')

      let pageCount = 0
      try {
        const doc = await PDFDocument.load(data, { ignoreEncryption: true })
        pageCount = doc.getPageCount()
      } catch {
        pageCount = 1
      }

      sources.push({
        path: fullPath,
        filename,
        buffer: data,
        size: data.byteLength,
        depth,
        pageCount,
      })

      stats.totalPdfs++
      stats.totalPdfPages += pageCount

      onProgress?.({
        imagesExtracted: stats.totalImages,
        pdfsExtracted: stats.totalPdfs,
        zipsProcessed: stats.totalNestedZips,
        totalNestedZipsFound: stats.totalNestedZips,
        currentPath: fullPath,
        depth,
      })
    } else if (isImage(relativePath)) {
      const data = await entry.async('arraybuffer')

      sources.push({
        path: fullPath,
        filename,
        buffer: data,
        size: data.byteLength,
        depth,
      })

      stats.totalImages++

      onProgress?.({
        imagesExtracted: stats.totalImages,
        pdfsExtracted: stats.totalPdfs,
        zipsProcessed: stats.totalNestedZips,
        totalNestedZipsFound: stats.totalNestedZips,
        currentPath: fullPath,
        depth,
      })
    }
  }

  return sources
}

/** @deprecated Usar extractSourcesRecursive */
export async function extractImagesRecursive(
  zip: JSZip,
  stats: ExtractionStats,
  onProgress?: (progress: ExtractionProgress) => void,
  depth = 0,
  pathPrefix = ''
): Promise<ImageFile[]> {
  const sources = await extractSourcesRecursive(zip, stats, onProgress, depth, pathPrefix)
  return sources.filter((s): s is ImageFile => !('pageCount' in s))
}
