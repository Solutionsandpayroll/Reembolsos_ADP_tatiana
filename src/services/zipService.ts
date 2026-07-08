/**
 * Servicio de procesamiento de archivos ZIP.
 *
 * Responsabilidades:
 *  - Cargar archivos ZIP con JSZip
 *  - Analizar la estructura (Caso 1: ZIPs anidados, Caso 2: carpetas planas)
 *  - Extraer recursivamente todas las imágenes a cualquier profundidad
 *  - Reportar progreso detallado durante la extracción
 */

import JSZip from 'jszip'
import type { ImageFile, ExtractionStats, ZipStructure, ZipDetectionResult } from '../types'
import { isImage } from '../utils/imageDetection'

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
      return `Estructura detectada: ZIPs anidados (${structure.nestedZips.length} ZIP${structure.nestedZips.length !== 1 ? 's' : ''} interno${structure.nestedZips.length !== 1 ? 's' : ''})`
    case 'case2':
      return `Estructura detectada: Carpetas con imágenes (${structure.folders.length} carpeta${structure.folders.length !== 1 ? 's' : ''})`
    case 'mixed':
      return `Estructura mixta: ${structure.nestedZips.length} ZIP${structure.nestedZips.length !== 1 ? 's' : ''} + ${structure.images.length} imagen${structure.images.length !== 1 ? 'es' : ''} directa${structure.images.length !== 1 ? 's' : ''}`
    case 'empty':
      return 'ZIP vacío: no se encontraron imágenes ni ZIPs anidados'
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
    throw new Error(`No se pudo leer el archivo "${file.name}". Verificá que no esté dañado.`)
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

  if (detection === 'empty') {
    throw new Error(`"${file.name}" no contiene imágenes ni ZIPs anidados`)
  }

  let entryCount = 0
  zip.forEach(() => { entryCount++ })

  return {
    zip,
    fileName: file.name,
    fileSize: file.size,
    structure,
    detection,
    entryCount,
  }
}

/**
 * Extrae recursivamente todas las imágenes de un ZIP, incluyendo ZIPs anidados
 * a cualquier profundidad.
 *
 * Características:
 *  - Recorrido en profundidad (depth-first) para minimizar memoria
 *  - Estadísticas globales acumuladas en `stats`
 *  - Callback de progreso por cada imagen extraída
 *  - Tolerancia a ZIPs anidados corruptos (continúa con los demás)
 *  - Prefijo de ruta para imágenes de ZIPs anidados
 *
 * @param zip       - Instancia JSZip a procesar
 * @param stats     - Objeto mutable de estadísticas (se modifica in-place)
 * @param onProgress - Callback llamado tras cada imagen extraída
 * @param depth     - Profundidad actual en el árbol de ZIPs
 * @param pathPrefix - Prefijo de ruta para anidados (ej: "Persona_001.zip")
 */
export async function extractImagesRecursive(
  zip: JSZip,
  stats: ExtractionStats,
  onProgress?: (progress: ExtractionProgress) => void,
  depth = 0,
  pathPrefix = ''
): Promise<ImageFile[]> {
  const images: ImageFile[] = []
  const structure = analyzeStructure(zip)

  stats.totalFiles += structure.files.length
  stats.totalFolders += structure.folders.length
  stats.totalNestedZips += structure.nestedZips.length
  stats.maxDepth = Math.max(stats.maxDepth, depth)

  for (const imgPath of structure.images) {
    const entry = zip.file(imgPath)
    if (!entry) continue

    const data = await entry.async('arraybuffer')
    const fullPath = pathPrefix ? `${pathPrefix}/${imgPath}` : imgPath

    images.push({
      path: fullPath,
      filename: imgPath.split('/').pop() || imgPath,
      buffer: data,
      size: data.byteLength,
      depth,
    })

    stats.totalImages++

    onProgress?.({
      imagesExtracted: stats.totalImages,
      zipsProcessed: stats.totalNestedZips,
      totalNestedZipsFound: stats.totalNestedZips,
      currentPath: fullPath,
      depth,
    })
  }

  for (const nestedZipPath of structure.nestedZips) {
    const entry = zip.file(nestedZipPath)
    if (!entry) continue

    const nestedPrefix = pathPrefix
      ? `${pathPrefix}/${nestedZipPath}`
      : nestedZipPath

    try {
      const nestedBuffer = await entry.async('arraybuffer')

      if (nestedBuffer.byteLength === 0) {
        console.warn(`ZIP anidado vacío, ignorado: ${nestedZipPath}`)
        continue
      }

      const nestedZip = await JSZip.loadAsync(nestedBuffer)

      const nestedImages = await extractImagesRecursive(
        nestedZip,
        stats,
        onProgress,
        depth + 1,
        nestedPrefix
      )

      images.push(...nestedImages)
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Error desconocido'
      console.warn(`ZIP anidado corrupto o ilegible: ${nestedZipPath} — ${message}`)
    }
  }

  return images
}
