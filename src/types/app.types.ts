import type { ImageFile } from './zip.types'
import type { PdfPageInfo } from './pdf.types'

export type ProcessingStep =
  | 'idle'
  | 'loading'
  | 'extracting'
  | 'generating'
  | 'preview'
  | 'splitting'
  | 'done'
  | 'error'

export interface ProcessingProgress {
  step: ProcessingStep
  message: string
  current: number
  total: number
}

export interface AppState {
  files: File[]
  images: ImageFile[]
  pdfBytes: Uint8Array | null
  pages: PdfPageInfo[]
  progress: ProcessingProgress
  error: string | null
}

export const INITIAL_PROGRESS: ProcessingProgress = {
  step: 'idle',
  message: 'Listo para comenzar',
  current: 0,
  total: 0,
}

export const INITIAL_APP_STATE: AppState = {
  files: [],
  images: [],
  pdfBytes: null,
  pages: [],
  progress: INITIAL_PROGRESS,
  error: null,
}
