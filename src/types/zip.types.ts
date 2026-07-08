export interface ImageFile {
  /** Ruta original dentro del ZIP */
  path: string
  /** Nombre del archivo (sin ruta) */
  filename: string
  /** Buffer con los datos binarios de la imagen */
  buffer: ArrayBuffer
  /** Tamaño en bytes */
  size: number
  /** Profundidad en la estructura del ZIP (0 = raíz) */
  depth: number
}

export interface ZipStructure {
  /** Rutas completas de todos los archivos */
  files: string[]
  /** Rutas de todas las carpetas */
  folders: string[]
  /** Rutas de ZIPs anidados encontrados */
  nestedZips: string[]
  /** Rutas de imágenes encontradas directamente */
  images: string[]
}

export interface ExtractionStats {
  totalFiles: number
  totalFolders: number
  totalNestedZips: number
  totalImages: number
  maxDepth: number
}

export type ZipDetectionResult = 'case1' | 'case2' | 'mixed' | 'empty'
