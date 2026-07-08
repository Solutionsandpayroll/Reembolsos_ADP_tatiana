export interface PdfPageInfo {
  /** Índice de la página (0-based) */
  index: number
  /** Ruta de la imagen original en el ZIP */
  imagePath: string
  /** Nombre del archivo de imagen */
  imageFilename: string
  /** Seleccionada por el usuario para el PDF A */
  selected: boolean
  /** URL para la vista previa de la página */
  previewUrl?: string
}

export interface SplitResult {
  pdfA: Uint8Array
  pdfB: Uint8Array
  pageCountA: number
  pageCountB: number
}
