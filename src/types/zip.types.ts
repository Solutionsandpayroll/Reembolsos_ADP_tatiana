export interface ImageFile {
  path: string
  filename: string
  buffer: ArrayBuffer
  size: number
  depth: number
}

export interface PdfSourceFile {
  path: string
  filename: string
  buffer: ArrayBuffer
  size: number
  depth: number
  pageCount: number
}

export type PageSource = ImageFile | PdfSourceFile

export function isPdfSource(source: PageSource): source is PdfSourceFile {
  return 'pageCount' in source
}

export interface PageMetadata {
  index: number
  sourceFilename: string
  sourcePath: string
  sourceType: 'image' | 'pdf'
  sourcePage?: number
  sourceTotalPages?: number
}

export interface ZipStructure {
  files: string[]
  folders: string[]
  nestedZips: string[]
  images: string[]
}

export interface ExtractionStats {
  totalFiles: number
  totalFolders: number
  totalNestedZips: number
  totalImages: number
  totalPdfs: number
  totalPdfPages: number
  maxDepth: number
}

export type ZipDetectionResult = 'case1' | 'case2' | 'mixed' | 'empty'
