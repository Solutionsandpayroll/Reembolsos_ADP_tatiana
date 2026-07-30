/**
 * Servicio de generación y división de PDFs.
 */

import { PDFDocument, PageSizes } from 'pdf-lib'
import type { ImageFile, PdfSourceFile, PageSource, PageMetadata, SplitResult } from '../types'
import { isPdfSource } from '../types'

export type ProgressCallback = (current: number, total: number) => void

const MAX_PAGE_DIMENSION = 14400
const A4_LANDSCAPE_WIDTH = PageSizes.A4[1]
const A4_LANDSCAPE_HEIGHT = PageSizes.A4[0]

function calculatePageSize(imgWidth: number, imgHeight: number): [number, number] {
  if (imgWidth <= MAX_PAGE_DIMENSION && imgHeight <= MAX_PAGE_DIMENSION) {
    return [imgWidth, imgHeight]
  }
  const scale = Math.min(
    A4_LANDSCAPE_WIDTH / imgWidth,
    A4_LANDSCAPE_HEIGHT / imgHeight,
    1
  )
  return [Math.floor(imgWidth * scale), Math.floor(imgHeight * scale)]
}

function getImageType(filename: string): 'png' | 'jpg' {
  return filename.toLowerCase().endsWith('.png') ? 'png' : 'jpg'
}

/**
 * Renderiza las páginas de un PDF a imágenes JPEG usando pdf.js (canvas).
 * Fallback cuando pdf-lib no puede leer el PDF (ej: encriptados complejos).
 */
async function renderPdfToImages(buffer: ArrayBuffer): Promise<ArrayBuffer[]> {
  const pdfjsLib = await import('pdfjs-dist')
  const pdf = await pdfjsLib.getDocument({ data: buffer.slice(0) }).promise
  const images: ArrayBuffer[] = []

  for (let i = 0; i < pdf.numPages; i++) {
    const page = await pdf.getPage(i + 1)
    const viewport = page.getViewport({ scale: 2.0 })

    const canvas = document.createElement('canvas')
    canvas.width = viewport.width
    canvas.height = viewport.height

    await page.render({ canvas, viewport }).promise

    const blob = await new Promise<Blob>((resolve) => {
      canvas.toBlob((b) => resolve(b!), 'image/jpeg', 0.92)
    })
    images.push(await blob.arrayBuffer())
  }

  return images
}

export interface GeneratePdfResult {
  pdfBytes: Uint8Array
  pagesMetadata: PageMetadata[]
  errors: { filename: string; error: string }[]
}

export async function generatePdf(
  sources: PageSource[],
  onProgress?: ProgressCallback
): Promise<GeneratePdfResult> {
  if (sources.length === 0) {
    throw new Error('No hay archivos para generar el PDF')
  }

  const pdfDoc = await PDFDocument.create()
  const pagesMetadata: PageMetadata[] = []
  const errors: { filename: string; error: string }[] = []
  const totalSteps = sources.length

  for (let i = 0; i < sources.length; i++) {
    const source = sources[i]

    if (isPdfSource(source)) {
      if (!source.buffer || source.buffer.byteLength === 0) {
        onProgress?.(i + 1, totalSteps)
        continue
      }

      try {
        const pageImages = await renderPdfToImages(source.buffer)
        for (let p = 0; p < pageImages.length; p++) {
          const embedded = await pdfDoc.embedJpg(pageImages[p])
          const [pw, ph] = calculatePageSize(embedded.width, embedded.height)
          pdfDoc.addPage([pw, ph]).drawImage(embedded, { x: 0, y: 0, width: pw, height: ph })
          pagesMetadata.push({
            index: pagesMetadata.length,
            sourceFilename: source.filename,
            sourcePath: source.path,
            sourceType: 'pdf',
            sourcePage: p + 1,
            sourceTotalPages: pageImages.length,
          })
        }
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Error desconocido'
        console.warn(`No se pudo procesar el PDF: ${source.filename} — ${message}`)
        errors.push({ filename: source.filename, error: `No se pudo procesar: ${message}` })
      }

      source.buffer = new ArrayBuffer(0)
    } else {
      // ImageFile
      if (!source.buffer || source.buffer.byteLength === 0) {
        onProgress?.(i + 1, totalSteps)
        continue
      }

      const type = getImageType(source.filename)

      let embeddedImage
      try {
        embeddedImage = type === 'png'
          ? await pdfDoc.embedPng(source.buffer)
          : await pdfDoc.embedJpg(source.buffer)
      } catch {
        console.warn(`No se pudo embeber la imagen: ${source.filename}`)
        onProgress?.(i + 1, totalSteps)
        continue
      }

      const [pageWidth, pageHeight] = calculatePageSize(
        embeddedImage.width,
        embeddedImage.height
      )

      pdfDoc.addPage([pageWidth, pageHeight]).drawImage(embeddedImage, {
        x: 0,
        y: 0,
        width: pageWidth,
        height: pageHeight,
      })

      pagesMetadata.push({
        index: pagesMetadata.length,
        sourceFilename: source.filename,
        sourcePath: source.path,
        sourceType: 'image',
      })

      source.buffer = new ArrayBuffer(0)
    }

    onProgress?.(i + 1, totalSteps)
  }

  if (pdfDoc.getPageCount() === 0) {
    throw new Error('No se pudo generar ninguna página en el PDF')
  }

  const pdfBytes = await pdfDoc.save()
  return { pdfBytes, pagesMetadata, errors }
}

export async function splitPdf(
  pdfBytes: Uint8Array,
  selectedIndices: Set<number>,
  onProgress?: ProgressCallback
): Promise<SplitResult> {
  const sourceDoc = await PDFDocument.load(pdfBytes)
  const docA = await PDFDocument.create()
  const docB = await PDFDocument.create()

  const pageCount = sourceDoc.getPageCount()

  for (let i = 0; i < pageCount; i++) {
    if (selectedIndices.has(i)) {
      const [copiedPage] = await docA.copyPages(sourceDoc, [i])
      docA.addPage(copiedPage)
    } else {
      const [copiedPage] = await docB.copyPages(sourceDoc, [i])
      docB.addPage(copiedPage)
    }
    onProgress?.(i + 1, pageCount)
  }

  const [pdfA, pdfB] = await Promise.all([docA.save(), docB.save()])

  return {
    pdfA,
    pdfB,
    pageCountA: docA.getPageCount(),
    pageCountB: docB.getPageCount(),
  }
}

export async function downloadPdfsSequential(
  pdfs: { bytes: Uint8Array; filename: string }[]
): Promise<void> {
  for (let i = 0; i < pdfs.length; i++) {
    const { bytes, filename } = pdfs[i]
    const blob = new Blob([bytes as BlobPart], { type: 'application/pdf' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = filename
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    await new Promise((resolve) => setTimeout(resolve, 300))
    URL.revokeObjectURL(url)
  }
}

export function downloadPdf(bytes: Uint8Array, filename: string): void {
  const blob = new Blob([bytes as BlobPart], { type: 'application/pdf' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
  URL.revokeObjectURL(url)
}
